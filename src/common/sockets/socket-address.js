const ipaddr = require('ipaddr.js');
import {nodePort} from './../../consts/const_global.js';

class SocketAddress {

    static checkIsSocketAddress(sckAddress){

        //console.log("checkIsSocketAddress", sckAddress);

        if (typeof sckAddress !== 'object' || sckAddress === null) return false;

        if (! (sckAddress.constructor.name === "SocketAddress" )) return false;

        return true;
    }

    /*
        Create a Socket Address in case the address is just a simple "address"
     */
    static createSocketAddress(address, port){

        //in case address is actually a Socket
        if (typeof address === "object" && address !== null && address.hasOwnProperty("node") && address.node.hasOwnProperty("sckAddress")) address = address.node.sckAddress;

        if (SocketAddress.checkIsSocketAddress(address)) return address;

        if ( typeof port === 'undefined' || port === '') port = nodePort;
        return new SocketAddress(address, port);
    }


    constructor(address, port){

        if (typeof address === 'undefined') address = '';
        if (typeof address === 'string') address = address.toLowerCase();

        if (typeof port === 'undefined') port = nodePort;

        try {
            if (typeof address === 'string')
                address = ipaddr.parse(address);
            else
            if (Array.isArray(address))
                address = ipaddr.fromByteArray(address);

        } catch (Exception){
        }

        this.addressString = address.toString();
        this.address = address;
        this.port = port;
    }

    matchAddress(address){

        //maybe it is a socket
        if (typeof address === "object" && address.hasOwnProperty("sckAddress") )
            address = address.sckAddress;

        //maybe address is actually a SocketAddress
        if (typeof address === 'object' && address.constructor.name === "SocketAddress")
            address = address.address;

        //converting address string to ipaddr
        try{
            if (typeof address === 'string') address = ipaddr.parse(address);
        } catch (Exception){

        }

        let myAddressString = this.address.toString();
        if (typeof this.address === 'object')  myAddressString = this.address.toNormalizedString();

        let addressString = address.toString();
        if (typeof address === 'object')  addressString = address.toNormalizedString();

        return ( myAddressString === addressString )
    }

    toString(){
        if (typeof this.address === 'object')  return this.address.toNormalizedString();
        return this.address;
    }

    getAddress(includePort){

        if (typeof includePort === 'undefined') includePort = true;

        if (typeof this.address === 'object')  return this.address.toNormalizedString() + (includePort ? this.port : '');

        return this.address.toString() + (includePort ? this.port : '');
    }

}

exports.SocketAddress = SocketAddress;