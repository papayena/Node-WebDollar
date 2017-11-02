if((typeof window !== 'undefined' && !window._babelPolyfill) ||
    (typeof global !== 'undefined' && !global._babelPolyfill)) {
    require('babel-polyfill')
}

console.log(""); console.log(""); console.log("");
console.log("Node WebDollar");
console.log(process.env.PARAM);
console.log(""); console.log(""); console.log("");

let Node = require('./node/Node.js');

exports.helloWord = function() {
    console.log("This is a message from the demo package");
};

let exportObject = {
    NodeServer : Node.NodeServer,
    NodeClientsService : Node.NodeClientsService,
    NodeWebPeersService : Node.NodeWebPeersService,
    NodesStats : Node.NodesStats,
    NodesList : Node.NodesList,
    NetworkMap : Node.NetworkMap,
};

module.exports =  exportObject;
global.window.NodeWebDollar = exportObject;


//browser minimized script
if (typeof window !== 'undefined') {
    window.NodeServer = Node.NodeServer;
    window.NodeClientsService = Node.NodeClientsService;
    window.NodeWebPeersService = Node.NodeWebPeersService;
    window.NodesStats = Node.NodesStats;
    window.NodesList = Node.NodesList;
    window.NetworkMap = Node.NetworkMap;
}

// var mymodule = (function() { console.log("This is a message from the demo package"); })();
//
// if (module && module.exports) {
//     module.exports = mymodule;
// } else {
//     window.mymodule = mymodule;
// }

console.log("Node WebDollar End");