const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const Certificate = artifacts.require("Certificate");
const DocumentVaultProof = artifacts.require("DocumentVaultProof");

module.exports = async function (deployer, network, accounts) {
  // 1. Deploy the secured Certificate smart contract
  await deployer.deploy(Certificate);
  const certificateInstance = await Certificate.deployed();

  console.log(`\n=======================================================`);
  console.log(`[Migration] Certificate deployed at: ${certificateInstance.address}`);
  console.log(`[Migration] Network: ${network}`);
  console.log(`=======================================================`);

  // 2. Deploy DocumentVaultProof smart contract
  await deployer.deploy(DocumentVaultProof);
  const vaultInstance = await DocumentVaultProof.deployed();
  console.log(`[Migration] DocumentVaultProof deployed at: ${vaultInstance.address}`);
  console.log(`=======================================================`);

  // 2. Ensure initial issuer is authorized by contract owner if configured
  const initialIssuer = process.env.INITIAL_ISSUER_ADDRESS;
  if (initialIssuer && web3.utils.isAddress(initialIssuer)) {
    console.log(`[Migration] Verifying initial issuer: ${initialIssuer}`);
    const owner = await certificateInstance.owner();
    console.log(`[Migration] Contract owner: ${owner}`);

    const isAlreadyAdmin = await certificateInstance.isRegisteredAdmin(initialIssuer);
    if (!isAlreadyAdmin) {
      console.log(`[Migration] Authorizing initial issuer (${initialIssuer}) on-chain...`);
      const tx = await certificateInstance.registerAdmin("INITIAL_ISSUER", initialIssuer);
      console.log(`[Migration] Initial issuer authorized. Transaction hash: ${tx.tx}`);
    } else {
      console.log(`[Migration] Initial issuer is already registered as an administrator.`);
    }

    const isAuthorized = (await certificateInstance.owner()).toLowerCase() === initialIssuer.toLowerCase() ||
                         (await certificateInstance.isRegisteredAdmin(initialIssuer));
    console.log(`[Migration] Initial issuer authorized status: ${isAuthorized}`);
  }
};
