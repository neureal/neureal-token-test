module.exports = {
  networks: { //truffle develop
    develop: {
      host: '127.0.0.1',
      port: 9545,
      network_id: '*', // Match any network id
    },
    development: { //truffle console
      host: '127.0.0.1',
      port: 8545,
      network_id: '*', // Match any network id
      gas: 4712388, //Gas limit used as default (around the block limit)
      gasPrice: 100000000000, //Gas price used as default (100 gwei)
    },
    ropsten: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '3', // Match any network id
      gas: 1000000, //Gas limit used as default
      gasPrice: 5000000000, //Gas price used as default (5 gwei)
    },
    // test: {
    //   provider: function() {
    //     const Web3 = require('web3');
    //     const net = require('net');
    //     const provider = new Web3.providers.IpcProvider('\\\\.\\pipe\\geth.ipc', net);
    //     return provider._provider;
    //   },
    //   network_id: '*',
    // },
    // ropsten: {
    //   provider: function() {
    //     //const HDWalletProvider = require("truffle-hdwallet-provider");
    //     //var mnemonic = "orange apple banana ... ";
    //     //return new HDWalletProvider(mnemonic, 'https://ropsten.infura.io/<INFURA_Access_Token>', 0);
    //   },
    //   network_id: '3',
    //   // optional config values:
    //   // gas: 4712388, //Gas limit used for deploys.
    //   // gasPrice: 100000000000, //Gas price used for deploys.
    //   // from: //default address to use for any transaction Truffle makes during migrations
    //   // provider: //web3 provider instance Truffle should use to talk to the Ethereum network.
    //   //           //function that returns a web3 provider instance (see below.)
    //   //           //if specified, host and port are ignored.
    // },
  }
};
