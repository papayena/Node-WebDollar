import InterfaceBlockchainFork from "../blockchain/forks/Interface-Blockchain-Fork";
import BlockchainMiningReward from 'common/blockchain/global/Blockchain-Mining-Reward'
import global from "consts/global"
import consts from 'consts/const_global'
import StatusEvents from "common/events/Status-Events"
import BufferExtended from "common/utils/BufferExtended";
import BansList from "common/utils/bans/BansList"

/**
 * Blockchain Protocol Fork Solver - that solves the fork of a new blockchain
 */
class InterfaceBlockchainProtocolForkSolver{

    constructor(blockchain, protocol){

        this.blockchain = blockchain;
        this.protocol = protocol;

    }

    async _discoverForkBinarySearch(socket, initialLeft, left, right){

        let answer;

        try {

            let mid = Math.trunc((left + right) / 2);

            console.log("_discoverForkBinarySearch", initialLeft, "left", left, "right ", right);
            answer = await socket.node.sendRequestWaitOnce("head/hash", mid, mid, consts.SETTINGS.PARAMS.CONNECTIONS.TIMEOUT.WAIT_ASYNC_DISCOVERY_TIMEOUT);

            if (left < 0 || answer === null || !Buffer.isBuffer(answer.hash) )
                return {position: null, header: answer };

            //i have finished the binary search
            if (left >= right) {
                //it the block actually is the same
                if (answer.hash.equals( this.blockchain.getHashPrev( mid+1 ) ) )
                    return {position: mid, header: answer.hash };
                else {

                    //it is not a match, but it was previously a match
                    if (mid-1 >= 0 && initialLeft <= mid-1 && initialLeft < left){

                        answer = await socket.node.sendRequestWaitOnce("head/hash", mid-1, mid-1, consts.SETTINGS.PARAMS.CONNECTIONS.TIMEOUT.WAIT_ASYNC_DISCOVERY_TIMEOUT );

                        if ( answer !== null && Buffer.isBuffer(answer.hash) )
                            if (answer.hash.equals( this.blockchain.getHashPrev(mid-1 +1) ) )
                                return {position: mid-1, header: answer.hash };
                    }
                    return {position: -1, header: answer.hash};
                }
            }

            //was not not found, search left because it must be there
            if (! answer.hash.equals( this.blockchain.getHashPrev(mid+1)  ) )
                return await this._discoverForkBinarySearch(socket, initialLeft, left, mid);
            else
            //was found, search right because the fork must be there
                return await this._discoverForkBinarySearch(socket, initialLeft, mid + 1, right);

        } catch (Exception){

            console.error("_discoverForkBinarySearch raised an exception" , Exception, answer);

            return {position: null, header: null};

        }

    }

    async _calculateForkBinarySearch(socket, newChainStartingPoint, newChainLength, currentBlockchainLength){

        if (newChainStartingPoint > currentBlockchainLength-1 || currentBlockchainLength === 0)
            return {position: -1, header: null};
        else {
            let binarySearchResult = await this._discoverForkBinarySearch(socket, newChainStartingPoint, newChainStartingPoint, currentBlockchainLength - 1);

            //forcing the binary search for download the next unmatching element
            if (binarySearchResult.position !== -1 && binarySearchResult.position+1 < newChainLength)
                binarySearchResult.position++;

            return binarySearchResult;
        }

    }


    /*
        may the fork be with you Otto
     */

    //TODO it will not update positions
    async discoverFork(socket, forkChainLength, forkChainStartingPoint, forkLastBlockHeader ){

        let binarySearchResult = {position: -1, header: null };
        let currentBlockchainLength = this.blockchain.blocks.length;

        let fork;

        try{

            if (currentBlockchainLength > forkChainLength)
                throw {message: "discoverAndProcessFork a smaller fork than I have"};

            let forkFound = this.blockchain.forksAdministrator.findForkBySockets(socket);
            if ( forkFound !== null ) {
                console.error("discoverAndProcessFork - fork already found by socket");
                return {result: true, fork: forkFound};
            }

            forkFound = this.blockchain.forksAdministrator.findForkByHeaders(forkLastBlockHeader);
            if ( forkFound !== null ) {
                console.error("discoverAndProcessFork - fork already found by forkLastBlockHeader");
                return {result: true, fork: forkFound};
            }

            fork = await this.blockchain.forksAdministrator.createNewFork( socket, undefined, undefined, undefined, [forkLastBlockHeader], false );
            fork.ready = false;

            // //optimization
            // //check if n-2 was ok, but I need at least 1 block
            // if (currentBlockchainLength === forkChainLength-1 && currentBlockchainLength-2  >= 0 && currentBlockchainLength > 0){
            //
            //     let answer = await socket.node.sendRequestWaitOnce( "head/hash", currentBlockchainLength-1, currentBlockchainLength-1, consts.SETTINGS.PARAMS.CONNECTIONS.TIMEOUT.WAIT_ASYNC_DISCOVERY_TIMEOUT );
            //     if (answer === null || answer.hash === undefined) throw {message: "connection dropped headers-info", height: currentBlockchainLength-1 };
            //
            //     if (  Buffer.compare ( this.blockchain.blocks.last.hash , answer.hash ) <= 0 )
            //         throw {message: "hash is bigger than mine" };
            //
            //     binarySearchResult = {
            //         position : currentBlockchainLength,
            //         header: answer.hash,
            //     };
            //
            // }

            // in case it was you solved previously && there is something in the blockchain

            //console.warn("discoverFork 555" , binarySearchResult);
            //Binary Search to detect the Fork Position
            if ( binarySearchResult.position === -1 ) {

                if (this.blockchain.agent.light) {
                    if (forkChainLength - forkChainStartingPoint > consts.BLOCKCHAIN.LIGHT.VALIDATE_LAST_BLOCKS) {
                        console.warn("LIGHT CHANGES from ", forkChainStartingPoint, " to ", forkChainLength - consts.BLOCKCHAIN.LIGHT.VALIDATE_LAST_BLOCKS - 1);
                        forkChainStartingPoint = forkChainLength - consts.BLOCKCHAIN.LIGHT.VALIDATE_LAST_BLOCKS - 1;
                    }
                }

                console.warn("discoverFork 6666" + forkChainStartingPoint);

                binarySearchResult = await this._calculateForkBinarySearch(socket, forkChainStartingPoint, forkChainLength, currentBlockchainLength );

                if (binarySearchResult.position === null)
                    throw {message: "connection dropped discoverForkBinarySearch"}

            }

            //console.warn("discoverFork 7777" , binarySearchResult);

            //process light and NiPoPow
            await this.optionalProcess(socket, binarySearchResult, currentBlockchainLength, forkChainLength, forkChainStartingPoint);

            //its a fork... starting from position
            console.log("fork position", binarySearchResult.position, "forkChainStartingPoint", forkChainStartingPoint, "forkChainLength", forkChainLength);

            if (binarySearchResult.position === -1 || (binarySearchResult.position > 0 && binarySearchResult.header !== undefined && binarySearchResult.header !== null) ){

                if (binarySearchResult.position === -1)
                    binarySearchResult.position = 0;

                try {

                    //maximum blocks to download
                    if (!this.blockchain.agent.light)
                        forkChainLength = Math.min(forkChainLength, this.blockchain.blocks.length + consts.SETTINGS.PARAMS.CONNECTIONS.FORKS.MAXIMUM_BLOCKS_TO_DOWNLOAD);

                    fork.forkStartingHeight = binarySearchResult.position;
                    fork.forkStartingHeightDownloading  = binarySearchResult.position;
                    fork.forkChainStartingPoint = forkChainStartingPoint;
                    fork.forkChainLength = forkChainLength;
                    fork.forkHeaders.push(binarySearchResult.header);
                    fork.ready = true;

                } catch (exception){

                    console.error( "discoverAndProcessFork - creating a fork raised an exception" , exception, "binarySearchResult", binarySearchResult )
                    throw exception;
                }

            } else
                //it is a totally new blockchain (maybe genesis was mined)
                console.log("fork is something new");


            return {result: true, fork:fork };

        } catch ( exception ){

            this.blockchain.forksAdministrator.deleteFork(fork);

            console.error("discoverAndProcessFork raised an exception", exception );

            BansList.addBan(socket, 2000, exception.message);

            return { result:false, error: exception };

        }

    }

    async optionalProcess(socket, binarySearchResult, currentBlockchainLength, forkChainLength, forkChainStartingPoint){

    }

    async processFork(fork){

        if (fork === null)
            throw {message: "fork doesn't exist"};

        try{

            if (! (await this._solveFork(fork) ))
                throw {message: "Fork Solved was failed"};

            return true;

        } catch (exception){

            console.error("solving a fork raised an exception" , exception );

            //let's ban the guy
            BansList.addBan(fork.getSocket(), 10000, exception.message );

            throw exception;
        }

    }

    /**
     * Solve Fork by Downloading  the blocks required in the fork
     * @param fork
     * @returns {Promise.<boolean>}
     */
    async _solveFork(fork) {

        StatusEvents.emit( "agent/status", {message: "Collecting Blockchain", blockHeight: fork.forkStartingHeight } );

        if (fork === null || fork === undefined || typeof fork !== "object" )
            throw {message: 'fork is null'};

        let nextBlockHeight = fork.forkStartingHeightDownloading;


        //interval timer
        let socket = fork.sockets[Math.floor(Math.random() * fork.sockets.length)];

        console.log(" < fork.forkChainLength", fork.forkChainLength, "fork.forkBlocks.length", fork.forkBlocks.length);

        while (fork.forkStartingHeight + fork.forkBlocks.length < fork.forkChainLength && !global.TERMINATED ) {


            // TODO you can paralyze the downloading code from multiple sockets

            console.log("nextBlockHeight", nextBlockHeight);

            StatusEvents.emit( "agent/status", {message: "Synchronizing - Downloading Block", blockHeight: nextBlockHeight, blockHeightMax: fork.forkChainLength } );

            //console.log("this.protocol.acceptBlocks", this.protocol.acceptBlocks);

            let onlyHeader;
            if (this.protocol.acceptBlocks)
                onlyHeader = false;
            else
            if (this.protocol.acceptBlockHeaders)
                onlyHeader = true;


            let answer = await socket.node.sendRequestWaitOnce("blockchain/blocks/request-block-by-height", { height: nextBlockHeight }, nextBlockHeight);

            if (answer === null || answer === undefined)
                throw {message: "block never received "+ nextBlockHeight};

            if ( !answer.result || answer.block === undefined  || !Buffer.isBuffer(answer.block) ) {
                console.error("Fork Answer received ", answer);
                throw {message: "Fork Answer is not Buffer"};
            }


            let blockValidation = fork._createBlockValidation_ForkValidation(nextBlockHeight, fork.forkBlocks.length-1);
            let block = this._deserializeForkBlock(fork, answer.block, nextBlockHeight, blockValidation );

            let result;

            try {

                result = await fork.includeForkBlock(block);

                if (block.interlink !== undefined)
                    console.log("block.interlink", block.interlink.length);

            } catch (Exception) {

                console.error("Error including block " + nextBlockHeight + " in fork ", Exception);

                throw {message: "fork.includeForkBlock returned an exception", Exception}

            }

            //if the block was included correctly
            if (result)
                nextBlockHeight++;
            else
                throw {message: "Fork didn't work at height ", nextBlockHeight};

        }

        if (fork.forkStartingHeight + fork.forkBlocks.length >= fork.forkChainLength ) {

            if (await fork.saveFork())
                return true;
            else
                throw {message: "Save Fork couldn't be saved"};

        }


    }

    _deserializeForkBlock( fork, blockData, blockHeight, validationBlock){

        let block = undefined;

        try {

            block = this.blockchain.blockCreator.createEmptyBlock(blockHeight, validationBlock);

            if (!this.protocol.acceptBlocks && this.protocol.acceptBlockHeaders)
                block.data._onlyHeader = true; //avoiding to store the transactions

            block.deserializeBlock( blockData, blockHeight, BlockchainMiningReward.getReward(block.height), fork.getForkDifficultyTarget(block.height) );

        } catch (Exception) {
            console.error("Error deserializing blocks ", Exception, blockData);
            return false;
        }

        return block;
    }

}


export default InterfaceBlockchainProtocolForkSolver;