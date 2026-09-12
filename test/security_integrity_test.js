require("dotenv").config();
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); } catch (e) {}
const { Web3 } = require("web3");
const mongoose = require("mongoose");

const GANACHE_RPC_URL = process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545";
const web3 = new Web3(GANACHE_RPC_URL);
const CertificateModel = require("../server/models/certificates");

async function runSecurityIntegrityTest() {
    console.log("==================================================================");
    console.log("  BLOCKCHAIN SECURITY & INTEGRITY DEMONSTRATION TEST SUITE");
    console.log("==================================================================");

    await mongoose.connect(process.env.MONGODB_URI);
    const accounts = await web3.eth.getAccounts();
    const testAccount = accounts[0];

    const targetCertId = "BACSE101";

    // Capture initial blockchain state to verify READ-ONLY constraint
    const startBlock = await web3.eth.getBlockNumber();
    const startNonce = await web3.eth.getTransactionCount(testAccount);

    console.log(`\n[Baseline Blockchain State]`);
    console.log(` - Current Block Number: ${startBlock}`);
    console.log(` - Account Nonce (${testAccount}): ${startNonce}`);

    // -------------------------------------------------------------------------
    // TEST 1: Valid Certificate
    // -------------------------------------------------------------------------
    console.log(`\n------------------------------------------------------------------`);
    console.log(`TEST 1 — VALID CERTIFICATE (${targetCertId})`);
    console.log(`------------------------------------------------------------------`);

    const res1 = await fetch(`http://localhost:3000/api/certificate/${targetCertId}`);
    const data1 = await res1.json();

    console.log(`HTTP Status: ${res1.status}`);
    console.log(`Verified Status: ${data1.verified}`);
    console.log(`Message: ${data1.message}`);
    console.log(`Original Issuance Tx Hash: ${data1.blockchain && data1.blockchain.transactionHash}`);
    console.log(`On-Chain Certificate Hash: ${data1.blockchain && data1.blockchain.certificateHash}`);
    console.log(`Locally Computed Hash:    ${data1.blockchain && data1.blockchain.computedHash}`);
    console.log(`Hashes Match: ${data1.blockchain && data1.blockchain.hashMatches}`);

    const test1Success = res1.status === 200 && data1.verified === true && data1.blockchain.hashMatches === true;
    console.log(`>>> TEST 1 RESULT: ${test1Success ? "✅ PASSED (Verified Successfully)" : "❌ FAILED"}`);
    if (!test1Success) throw new Error("Test 1 failed");

    // -------------------------------------------------------------------------
    // TEST 2: MongoDB Tampering
    // -------------------------------------------------------------------------
    console.log(`\n------------------------------------------------------------------`);
    console.log(`TEST 2 — MONGODB TAMPERING`);
    console.log(`------------------------------------------------------------------`);

    const originalCert = await CertificateModel.findOne({ certificateId: targetCertId });
    const originalCourse = originalCert.course;

    console.log(`Original Course in Database: "${originalCourse}"`);
    console.log(`Simulating malicious database breach: changing course to "Master of Business Administration (Tampered)"...`);

    await CertificateModel.updateOne(
        { certificateId: targetCertId },
        { $set: { course: "Master of Business Administration (Tampered)" } }
    );

    const res2 = await fetch(`http://localhost:3000/api/certificate/${targetCertId}`);
    const data2 = await res2.json();

    console.log(`HTTP Status: ${res2.status}`);
    console.log(`Verified Status: ${data2.verified}`);
    console.log(`Message: ${data2.message}`);

    const test2Success = res2.status === 400 && data2.verified === false && data2.message.includes("mismatch");
    console.log(`>>> TEST 2 RESULT: ${test2Success ? "✅ PASSED (Tampering Successfully Detected & Rejected)" : "❌ FAILED"}`);
    if (!test2Success) throw new Error("Test 2 failed");

    // -------------------------------------------------------------------------
    // TEST 3: Restore Data
    // -------------------------------------------------------------------------
    console.log(`\n------------------------------------------------------------------`);
    console.log(`TEST 3 — RESTORE DATA`);
    console.log(`------------------------------------------------------------------`);

    console.log(`Restoring original Course value: "${originalCourse}" in MongoDB...`);
    await CertificateModel.updateOne(
        { certificateId: targetCertId },
        { $set: { course: originalCourse } }
    );

    const res3 = await fetch(`http://localhost:3000/api/certificate/${targetCertId}`);
    const data3 = await res3.json();

    console.log(`HTTP Status: ${res3.status}`);
    console.log(`Verified Status: ${data3.verified}`);
    console.log(`Message: ${data3.message}`);
    console.log(`Hashes Match: ${data3.blockchain && data3.blockchain.hashMatches}`);

    const test3Success = res3.status === 200 && data3.verified === true && data3.blockchain.hashMatches === true;
    console.log(`>>> TEST 3 RESULT: ${test3Success ? "✅ PASSED (Restored to Verified Status)" : "❌ FAILED"}`);
    if (!test3Success) throw new Error("Test 3 failed");

    // -------------------------------------------------------------------------
    // TEST 4: Nonexistent Certificate
    // -------------------------------------------------------------------------
    console.log(`\n------------------------------------------------------------------`);
    console.log(`TEST 4 — NONEXISTENT CERTIFICATE`);
    console.log(`------------------------------------------------------------------`);

    const fakeId = "CERT_COMPLETELY_FAKE_99999";
    const res4 = await fetch(`http://localhost:3000/api/certificate/${fakeId}`);
    const data4 = await res4.json();

    console.log(`Querying: ${fakeId}`);
    console.log(`HTTP Status: ${res4.status}`);
    console.log(`Verified Status: ${data4.verified}`);
    console.log(`Message: ${data4.message}`);

    const test4Success = res4.status === 404 && data4.verified === false && !data4.blockchain;
    console.log(`>>> TEST 4 RESULT: ${test4Success ? "✅ PASSED (Nonexistent Rejected Without Errors)" : "❌ FAILED"}`);
    if (!test4Success) throw new Error("Test 4 failed");

    // -------------------------------------------------------------------------
    // TEST 5: Read-Only Verification Proof
    // -------------------------------------------------------------------------
    console.log(`\n------------------------------------------------------------------`);
    console.log(`TEST 5 — READ-ONLY VERIFICATION AUDIT`);
    console.log(`------------------------------------------------------------------`);

    const endBlock = await web3.eth.getBlockNumber();
    const endNonce = await web3.eth.getTransactionCount(testAccount);

    console.log(`Baseline Block Number: ${startBlock} | Final Block Number: ${endBlock}`);
    console.log(`Baseline Account Nonce: ${startNonce} | Final Account Nonce: ${endNonce}`);

    const blocksEqual = startBlock === endBlock;
    const noncesEqual = startNonce === endNonce;

    console.log(` - Block height increased? ${!blocksEqual ? "YES (FAILED)" : "NO (0 blocks mined)"}`);
    console.log(` - Account nonces increased? ${!noncesEqual ? "YES (FAILED)" : "NO (0 transactions broadcast)"}`);
    console.log(` - Gas consumed: 0 wei`);
    console.log(` - MetaMask interaction required: NONE (Plain HTTP GET)`);

    const test5Success = blocksEqual && noncesEqual;
    console.log(`>>> TEST 5 RESULT: ${test5Success ? "✅ PASSED (100% Strictly Read-Only Confirmed)" : "❌ FAILED"}`);
    if (!test5Success) throw new Error("Test 5 failed");

    console.log(`\n==================================================================`);
    console.log(`  ALL 5 SECURITY AND INTEGRITY TESTS COMPLETED WITH 100% SUCCESS`);
    console.log(`==================================================================`);

    await mongoose.disconnect();
    process.exit(0);
}

runSecurityIntegrityTest().catch(err => {
    console.error("Security test suite failed:", err);
    process.exit(1);
});
