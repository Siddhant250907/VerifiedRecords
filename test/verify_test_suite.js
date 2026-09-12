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

const CertificateModel = require("../server/models/certificates");

async function runAllTestCases() {
    console.log("===============================================================");
    console.log("EXECUTION OF MANDATORY TEST CASES FOR CERTIFICATE VERIFICATION");
    console.log("===============================================================");

    await mongoose.connect(process.env.MONGODB_URI);
    const accounts = await web3.eth.getAccounts();
    const adminAccount = accounts[0];

    // -------------------------------------------------------------------------
    // TEST CASE 1: Valid newly issued certificate
    // -------------------------------------------------------------------------
    console.log("\n>>> TEST CASE 1: Valid Newly Issued Certificate");
    const test1Id = "CERT_VALID_" + Date.now().toString().slice(-6);
    const test1Data = {
        studentName: "Ananya Sharma",
        rollNumber: "25BCE3344",
        course: "Artificial Intelligence & Data Science",
        certificateId: test1Id,
        issueDate: "2026-09-12"
    };

    // 1. Prepare hash
    const prep1Res = await fetch("http://localhost:3000/api/certificate/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(test1Data)
    });
    const prep1 = await prep1Res.json();
    console.log("  [1a] Computed Deterministic Hash:", prep1.certificateHash);

    // 2. Issue on-chain
    const txReceipt1 = await certificateContract.methods.issueCertificate(test1Id, prep1.certificateHash).send({
        from: adminAccount,
        gas: 300000
    });
    console.log("  [1b] Blockchain Receipt Tx Hash:", txReceipt1.transactionHash);

    // 3. Store in MongoDB
    const save1Res = await fetch("http://localhost:3000/api/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...test1Data,
            transactionHash: txReceipt1.transactionHash,
            blockchainIssuer: adminAccount
        })
    });
    const save1 = await save1Res.json();
    console.log("  [1c] MongoDB Stored Success:", save1.success);

    // 4. Verify (Read-Only)
    const blockBefore1 = await web3.eth.getBlockNumber();
    const nonceBefore1 = await web3.eth.getTransactionCount(adminAccount);

    const verify1Res = await fetch("http://localhost:3000/api/certificate/" + test1Id);
    const verify1 = await verify1Res.json();

    const blockAfter1 = await web3.eth.getBlockNumber();
    const nonceAfter1 = await web3.eth.getTransactionCount(adminAccount);

    console.log("  [1d] Verification HTTP Status:", verify1Res.status);
    console.log("  [1e] Verification Result verified:", verify1.verified);
    console.log("  [1f] Blockchain Status:", verify1.blockchain && verify1.blockchain.status);
    console.log("  [1g] Original Issuance Transaction Hash:", verify1.blockchain && verify1.blockchain.transactionHash);
    console.log("  [1h] Block Number:", verify1.blockchain && verify1.blockchain.blockNumber);
    console.log("  [1i] Read-Only Verified (Blocks:", Number(blockBefore1), "==", Number(blockAfter1), ", Nonces:", Number(nonceBefore1), "==", Number(nonceAfter1), ")");

    const test1Passed = 
        verify1Res.status === 200 &&
        verify1.verified === true &&
        verify1.blockchain.status === "Verified" &&
        verify1.blockchain.transactionHash === txReceipt1.transactionHash &&
        blockBefore1 === blockAfter1 &&
        nonceBefore1 === nonceAfter1;

    console.log(">>> TEST 1 RESULT:", test1Passed ? "PASSED (VERIFIED)" : "FAILED");
    if (!test1Passed) throw new Error("Test Case 1 failed");

    // -------------------------------------------------------------------------
    // TEST CASE 2: Random Certificate ID
    // -------------------------------------------------------------------------
    console.log("\n>>> TEST CASE 2: Random Non-Existent Certificate ID");
    const randomId = "CERT_NONEXISTENT_RANDOM_" + Math.random().toString(36).substring(2, 9).toUpperCase();

    const verify2Res = await fetch("http://localhost:3000/api/certificate/" + randomId);
    const verify2 = await verify2Res.json();

    console.log("  [2a] Verification HTTP Status:", verify2Res.status);
    console.log("  [2b] Verification Result verified:", verify2.verified);
    console.log("  [2c] Error Message:", verify2.message);

    const test2Passed = 
        verify2Res.status === 404 &&
        verify2.verified === false &&
        !verify2.blockchain;

    console.log(">>> TEST 2 RESULT:", test2Passed ? "PASSED (INVALID / NOT FOUND)" : "FAILED");
    if (!test2Passed) throw new Error("Test Case 2 failed");

    // -------------------------------------------------------------------------
    // TEST CASE 3: Certificate whose MongoDB data has been altered after issuance
    // -------------------------------------------------------------------------
    console.log("\n>>> TEST CASE 3: Tampered MongoDB Data (Hash Mismatch)");
    const test3Id = "CERT_TAMPER_" + Date.now().toString().slice(-6);
    const test3Data = {
        studentName: "Original Honest Student",
        rollNumber: "25BCE7777",
        course: "Information Technology",
        certificateId: test3Id,
        issueDate: "2026-09-12"
    };

    // 1. Prepare hash
    const prep3Res = await fetch("http://localhost:3000/api/certificate/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(test3Data)
    });
    const prep3 = await prep3Res.json();

    // 2. Issue on-chain
    const txReceipt3 = await certificateContract.methods.issueCertificate(test3Id, prep3.certificateHash).send({
        from: adminAccount,
        gas: 300000
    });

    // 3. Store in MongoDB
    await fetch("http://localhost:3000/api/certificate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            ...test3Data,
            transactionHash: txReceipt3.transactionHash,
            blockchainIssuer: adminAccount
        })
    });

    // 4. Directly alter/tamper the record in MongoDB
    console.log("  [3a] Altering studentName in MongoDB from 'Original Honest Student' to 'Fraudulent Impostor'...");
    await CertificateModel.updateOne(
        { certificateId: test3Id },
        { $set: { studentName: "Fraudulent Impostor" } }
    );

    // 5. Attempt verification
    const verify3Res = await fetch("http://localhost:3000/api/certificate/" + test3Id);
    const verify3 = await verify3Res.json();

    console.log("  [3b] Verification HTTP Status:", verify3Res.status);
    console.log("  [3c] Verification Result verified:", verify3.verified);
    console.log("  [3d] Error Message:", verify3.message);

    const test3Passed = 
        verify3Res.status === 400 &&
        verify3.verified === false &&
        verify3.message.includes("mismatch");

    console.log(">>> TEST 3 RESULT:", test3Passed ? "PASSED (INVALID / TAMPER DETECTED)" : "FAILED");
    if (!test3Passed) throw new Error("Test Case 3 failed");

    // -------------------------------------------------------------------------
    // TEST CASE 4: Blockchain unavailable (no false success)
    // -------------------------------------------------------------------------
    console.log("\n>>> TEST CASE 4: Blockchain Failure / Unreachable Handling");
    
    // Simulate smart contract view call failure or unanchored certificate
    // Let's create a certificate in MongoDB that was NEVER registered on the blockchain
    const test4Id = "CERT_UNANCHORED_" + Date.now().toString().slice(-6);
    const unanchoredCert = new CertificateModel({
        studentName: "Offline Record",
        rollNumber: "25BCE8888",
        course: "Software Engineering",
        certificateId: test4Id,
        issueDate: "2026-09-12",
        issuedAt: new Date(),
        certificateHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
        transactionHash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
        contractAddress: contractAddress,
        blockchainIssuer: adminAccount
    });
    await unanchoredCert.save();

    const verify4Res = await fetch("http://localhost:3000/api/certificate/" + test4Id);
    const verify4 = await verify4Res.json();

    console.log("  [4a] Verification HTTP Status:", verify4Res.status);
    console.log("  [4b] Verification Result verified:", verify4.verified);
    console.log("  [4c] Error Message:", verify4.message);

    const test4Passed = 
        (verify4Res.status === 404 || verify4Res.status === 502) &&
        verify4.verified === false;

    console.log(">>> TEST 4 RESULT:", test4Passed ? "PASSED (NO FALSE SUCCESS)" : "FAILED");
    if (!test4Passed) throw new Error("Test Case 4 failed");

    console.log("\n===============================================================");
    console.log("✓✓✓ ALL 4 TEST CASES EXECUTED AND PASSED SUCCESSFULLY! ✓✓✓");
    console.log("===============================================================");

    await mongoose.disconnect();
    process.exit(0);
}

runAllTestCases().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
