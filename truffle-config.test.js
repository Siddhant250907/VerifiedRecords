module.exports = {
  // Ephemeral test configuration: no persistent networks defined
  // Truffle spins up an isolated, in-memory test blockchain and discards it after execution
  networks: {},
  compilers: {
    solc: {
      version: "0.8.21",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "paris"
      }
    }
  }
};
