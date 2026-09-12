require("dotenv").config();
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); } catch (e) {}
const { Web3 } = require("web3");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const GANACHE_RPC_URL = process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545";
const web3 = new Web3(GANACHE_RPC_URL);

const artifactPath = path.join(__dirname, "..", "build", "contracts", "Certificate.json");
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
const contractAddress = process.env.CONTRACT_ADDRESS || artifact.networks["5777"].address;
const certificateContract = new web3.eth.Contract(artifact.abi, contractAddress);

async function runTest() {
    console.log("==================================================");
    console.log("STARTING END-TO-END BLOCKCHAIN VERIFICATION TEST");
    console.log("==================================================");

    const testCertId = "CERT_E2E_" + Date.now().toString().slice(-6);
    const certPayload = {
        studentName: "Aditya Verma",
        rollNumber: "25BCE2045",
        course: "Computer Science & Engineering",
        certificateId: testCertId,
        issueDate: "2026-09-12"
    };

    console.log("\n[Step 1] Preparing certificate for issuance:", testCertId);
    const prepRes = await fetch("http://localhost:3000/api/certificate/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(certPayload)
    });
    const prepData = await prepRes.json();
    console.log("Prepare response status:", prepRes.status);
    console.log("Computed deterministic hash:", prepData.certificateHash);

    if (!prepRes.ok) {
        throw new Error("Prepare failed: " + JSON.stringify(prepData));
    }

    console.log("\n[Step 2] Executing on-chain issuance transaction via Ganache provider...");
    const accounts = await web3.eth.getAccounts();
    const adminIssuer = accounts[0];
    console.log("Signing issuer account:", adminIssuer);

    // Call issueCertificate on the smart contract
    const sendTx = certificateContract.methods.issueCertificate(testCertId, prepData.certificateHash);
    const txReceipt = await sendTx.send({
        from: adminIssuer,
        gas: 300000
    });

    console.log("✓ Blockchain transaction mined into Ganache block!");
    console.log("✓ Confirmed Receipt Transaction Hash:", txReceipt.transactionHash);
    console.log("✓ Block Number:", Number(txReceipt.blockNumber));
    console.log("✓ Gas Used:", Number(txReceipt.gasUsed));
    console.log("✓ Status:", txReceipt.status);

    const issuanceTxHash = txReceipt.transactionHash;

    console.log("\n[Step 3] Verifying Ganache shows the transaction...");
    const block = await web3.eth.getBlock(txReceipt.blockNumber);
    const txFoundInBlock = block.transactions.some(tx => 
        (typeof tx === "string" ? tx.toLowerCase() : tx.hash.toLowerCase()) === issuanceTxHash.toLowerCase()
    );
    console.log("✓ Ganache Block timestamp:", Number(block.timestamp));
    console.log("✓ Ganache Block contains transaction:", txFoundInBlock);
    if (!txFoundInBlock) {
        throw new Error("Transaction not found in mined Ganache block!");
    }

    console.log("\n[Step 4] Storing certificate with blockchain metadata in MongoDB...");
    const recordRes = await fetch("http://localhost:3000/api/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...certPayload,
            transactionHash: issuanceTxHash,
            blockchainIssuer: adminIssuer
        })
    });
    const recordData = await recordRes.json();
    console.log("Record response status:", recordRes.status);
    console.log("Record response message:", recordData.message);

    if (!recordRes.ok) {
        throw new Error("Record failed: " + JSON.stringify(recordData));
    }

    console.log("\n[Step 5] Checking MongoDB stored document directly...");
    await mongoose.connect(process.env.MONGODB_URI);
    const CertificateModel = require("../server/models/certificates");
    const savedCert = await CertificateModel.findOne({ certificateId: testCertId });
    
    console.log("✓ MongoDB Record Retrieved:");
    console.log("  - certificateId:     ", savedCert.certificateId);
    console.log("  - certificateHash:   ", savedCert.certificateHash);
    console.log("  - transactionHash:   ", savedCert.transactionHash);
    console.log("  - contractAddress:   ", savedCert.contractAddress);
    console.log("  - blockchainIssuer:  ", savedCert.blockchainIssuer);
    console.log("  - blockchainIssuedAt:", savedCert.blockchainIssuedAt);
    console.log("  - blockNumber:       ", savedCert.blockNumber);

    if (savedCert.transactionHash !== issuanceTxHash) {
        throw new Error("Stored transactionHash does not match blockchain transaction hash!");
    }
    if (!savedCert.certificateHash || !savedCert.contractAddress || !savedCert.blockchainIssuer) {
        throw new Error("Missing required blockchain metadata in MongoDB!");
    }

    console.log("\n[Step 6] Testing Verification Endpoint (Strict Read-Only)...");
    const blockNumberBefore = await web3.eth.getBlockNumber();
    const nonceBefore = await web3.eth.getTransactionCount(adminIssuer);

    const verifyRes = await fetch("http://localhost:3000/api/certificate/" + testCertId);
    const verifyData = await verifyRes.json();

    const blockNumberAfter = await web3.eth.getBlockNumber();
    const nonceAfter = await web3.eth.getTransactionCount(adminIssuer);

    console.log("✓ Verification Status Code:", verifyRes.status);
    console.log("✓ Verification verified:", verifyData.verified);
    console.log("✓ Blockchain Status:", verifyData.blockchain && verifyData.blockchain.status);
    console.log("✓ Returned Transaction Hash:", verifyData.blockchain && verifyData.blockchain.transactionHash);
    console.log("✓ Returned Issuer:", verifyData.blockchain && verifyData.blockchain.issuer);
    console.log("✓ Returned Timestamp:", verifyData.blockchain && verifyData.blockchain.issuedAt);
    console.log("✓ Returned Contract Address:", verifyData.blockchain && verifyData.blockchain.contractAddress);

    // Verify Read-Only Guarantee
    console.log("\n[Verification Read-Only Proof]:");
    console.log("  - Block number before:", Number(blockNumberBefore), "| after:", Number(blockNumberAfter));
    console.log("  - Account nonce before:", Number(nonceBefore), "| after:", Number(nonceAfter));
    if (blockNumberBefore !== blockNumberAfter || nonceBefore !== nonceAfter) {
        throw new Error("CRITICAL: Verification altered blockchain state! It must remain strictly read-only!");
    }
    console.log("✓ Zero transactions created during verification (Read-Only Verified).");

    // Verify transactionHash matches original issuance
    if (verifyData.blockchain.transactionHash !== issuanceTxHash) {
        throw new Error("Verification did not return original issuance transaction hash!");
    }
    console.log("✓ Original issuance transaction hash verified perfectly.");

    console.log("\n==================================================");
    console.log("✓✓✓ ALL 6 VERIFICATION REQUIREMENTS CONFIRMED ✓✓✓");
    console.log("==================================================");
    await mongoose.disconnect();
    process.exit(0);
}

runTest().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
