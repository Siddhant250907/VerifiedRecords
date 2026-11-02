const fs = require("fs");
const path = require("path");
const { Web3 } = require("web3");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function main() {
    console.log("=======================================================");
    console.log("DEPLOYING CertificateV2 TO ETHEREUM SEPOLIA");
    console.log("=======================================================");

    const rpcUrl = process.env.SEPOLIA_RPC_URL;
    const rawKey = process.env.DEPLOYER_PRIVATE_KEY;

    if (!rpcUrl || !rawKey) {
        throw new Error("Missing SEPOLIA_RPC_URL or DEPLOYER_PRIVATE_KEY in .env");
    }

    const web3 = new Web3(rpcUrl);
    const privateKey = rawKey.startsWith("0x") ? rawKey : "0x" + rawKey;
    const deployer = web3.eth.accounts.privateKeyToAccount(privateKey);
    web3.eth.accounts.wallet.add(deployer);

    console.log(`Deployer Address: ${deployer.address}`);
    const balance = await web3.eth.getBalance(deployer.address);
    console.log(`Deployer Balance: ${web3.utils.fromWei(balance, "ether")} ETH`);

    const artifactPath = path.join(__dirname, "..", "build", "contracts", "CertificateV2.json");
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`CertificateV2 artifact not found at ${artifactPath}`);
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
    const contract = new web3.eth.Contract(artifact.abi);

    console.log("\nPreparing deployment transaction...");
    const deployTx = contract.deploy({
        data: artifact.bytecode,
        arguments: []
    });

    const gasEstimate = await deployTx.estimateGas({ from: deployer.address }).catch(err => {
        console.warn("Gas estimation note:", err.message);
        return 3000000n;
    });

    console.log(`Estimated Gas: ${gasEstimate.toString()}`);

    const gasPrice = await web3.eth.getGasPrice();
    console.log(`Gas Price: ${web3.utils.fromWei(gasPrice, "gwei")} Gwei`);

    console.log("\nBroadcasting deployment transaction to Sepolia...");
    const deployedContract = await deployTx.send({
        from: deployer.address,
        gas: (BigInt(gasEstimate) * 12n) / 10n,
        gasPrice: (BigInt(gasPrice) * 12n) / 10n
    });

    const contractAddress = deployedContract.options.address;
    console.log(`\nSUCCESS! CertificateV2 deployed at: ${contractAddress}`);

    // Verify contract owner
    try {
        const owner = await deployedContract.methods.owner().call();
        console.log(`Contract Owner: ${owner}`);
    } catch (e) {
        console.warn("Could not read owner:", e.message);
    }

    // 1. Update build artifact
    if (!artifact.networks) artifact.networks = {};
    artifact.networks["11155111"] = {
        events: {},
        links: {},
        address: contractAddress,
        transactionHash: deployedContract.transactionHash
    };
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), "utf-8");
    console.log(`Updated build/contracts/CertificateV2.json with network 11155111.`);

    // 2. Update .env
    const envPath = path.join(__dirname, "..", ".env");
    let envContent = fs.readFileSync(envPath, "utf-8");
    if (envContent.includes("SEPOLIA_CERT_V2_CONTRACT_ADDRESS=")) {
        envContent = envContent.replace(/SEPOLIA_CERT_V2_CONTRACT_ADDRESS=.*/g, `SEPOLIA_CERT_V2_CONTRACT_ADDRESS=${contractAddress}`);
    } else {
        envContent += `\nSEPOLIA_CERT_V2_CONTRACT_ADDRESS=${contractAddress}\n`;
    }

    fs.writeFileSync(envPath, envContent, "utf-8");
    console.log(`Updated .env with SEPOLIA_CERT_V2_CONTRACT_ADDRESS=${contractAddress}`);

    console.log("=======================================================");
    console.log("DEPLOYMENT COMPLETE");
    console.log("=======================================================");
}

main().catch(err => {
    console.error("Deployment failed:", err);
    process.exit(1);
});
