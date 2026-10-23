/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation, and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * https://trufflesuite.com/docs/truffle/reference/configuration
 *
 * Hands-off deployment with Infura
 * --------------------------------
 *
 * Do you have a complex application that requires lots of transactions to deploy?
 * Use this approach to make deployment a breeze 🏖️:
 *
 * Infura deployment needs a wallet provider (like @truffle/hdwallet-provider)
 * to sign transactions before they're sent to a remote public node.
 * Infura accounts are available for free at 🔍: https://infura.io/register
 *
 * You'll need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. You can store your secrets 🤐 in a .env file.
 * In your project root, run `$ npm install dotenv`.
 * Create .env (which should be .gitignored) and declare your MNEMONIC
 * and Infura PROJECT_ID variables inside.
 * For example, your .env file will have the following structure:
 *
 * MNEMONIC = <Your 12 phrase mnemonic>
 * PROJECT_ID = <Your Infura project id>
 *
 * Deployment with Truffle Dashboard (Recommended for best security practice)
 * --------------------------------------------------------------------------
 *
 * Are you concerned about security and minimizing rekt status 🤔?
 * Use this method for best security:
 *
 * Truffle Dashboard lets you review transactions in detail, and leverages
 * MetaMask for signing, so there's no need to copy-paste your mnemonic.
 * More details can be found at 🔎:
 *
 * https://trufflesuite.com/docs/truffle/getting-started/using-the-truffle-dashboard/
 */

require("dotenv").config();

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a managed Ganache instance for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    development: {
      host: "127.0.0.1",     // Localhost (Ganache)
      port: 7545,            // Ganache standard RPC port
      network_id: "*",       // Match any network id (Ganache: 5777)
    },

    // Public Ethereum Sepolia testnet deployment
    // Lazily instantiates HDWalletProvider only when the sepolia network is invoked
    sepolia: {
      provider: () => {
        const { DEPLOYER_PRIVATE_KEY, SEPOLIA_RPC_URL } = process.env;
        if (!DEPLOYER_PRIVATE_KEY || !SEPOLIA_RPC_URL) {
          throw new Error(
            "Sepolia deployment requires DEPLOYER_PRIVATE_KEY and SEPOLIA_RPC_URL environment variables to be set."
          );
        }
        const privateKey = DEPLOYER_PRIVATE_KEY.trim();
        const rpcUrl = SEPOLIA_RPC_URL.trim();
        const customProvider = {
          send: (payload, cb) => customProvider.sendAsync(payload, cb),
          sendAsync: (payload, cb) => {
            fetch(rpcUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            })
              .then(async (res) => {
                if (!res.ok) {
                  const text = await res.text();
                  return cb(new Error(`HTTP ${res.status}: ${text}`));
                }
                const json = await res.json();
                cb(null, json);
              })
              .catch((err) => cb(err));
          }
        };
        const HDWalletProvider = require("@truffle/hdwallet-provider");
        return new HDWalletProvider({
          privateKeys: [privateKey],
          provider: customProvider,
          numberOfAddresses: 1,
          chainId: 11155111,
          pollingInterval: 8000
        });
      },
      network_id: 11155111,
      chain_id: 11155111,
      gas: 9500000,
      gasPrice: 100000000, // 0.1 gwei (optimal for Sepolia; basefee is ~21 wei)
      confirmations: 2,
      timeoutBlocks: 200,
      skipDryRun: true,
      networkCheckTimeout: 120000
    }
  },

  // Set default mocha options here, use special reporters, etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.21",      // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 200
        },
        evmVersion: "paris"
      }
    }
  },

  // Truffle DB is currently disabled by default; to enable it, change enabled:
  // false to enabled: true. The default storage location can also be
  // overridden by specifying the adapter settings, as shown in the commented code below.
  //
  // NOTE: It is not possible to migrate your contracts to truffle DB and you should
  // make a backup of your artifacts to a safe location before enabling this feature.
  //
  // After you backed up your artifacts you can utilize db by running migrate as follows:
  // $ truffle migrate --reset --compile-all
  //
  // db: {
  //   enabled: false,
  //   host: "127.0.0.1",
  //   adapter: {
  //     name: "indexeddb",
  //     settings: {
  //       directory: ".db"
  //     }
  //   }
  // }
};
