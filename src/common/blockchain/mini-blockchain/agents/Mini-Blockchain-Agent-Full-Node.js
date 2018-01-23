import PPoWBlockchainAgentFullNode from 'common/blockchain/ppow-blockchain/agents/PPoW-Blockchain-Agent-Full-Node'
import MiniBlockchainProtocol from "common/blockchain/mini-blockchain/protocol/Mini-Blockchain-Protocol"

class MiniBlockchainAgentFullNode extends PPoWBlockchainAgentFullNode{

    constructor(blockchain, blockchainProtocolClass){
        super(blockchain, blockchainProtocolClass||MiniBlockchainProtocol )
    }

}

export default MiniBlockchainAgentFullNode;