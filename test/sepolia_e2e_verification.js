require("dotenv").config();
const dns = require("dns");
try { dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]); } catch (e) {}

const { Web3 } = require("web3");
const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const BASE_URL = "http://localhost:3000";
const EXPECTED_SEPOLIA_CONTRACT = "0xDd4DF9A618683a407f3B195e651271DC0E97f5bE";
const EXPECTED_INITIAL_ISSUER = "0x1FC04CfBF2f7B0F32AEBecd17880afeb38BFacC7";

async function runTestSuite() {
    console.log("==================================================================");
    console.log("  VERIFIEDRECORDS SEPOLIA INTEGRATION & VERIFICATION TEST SUITE   ");
    console.log("==================================================================");

    let allPassed = true;
    const testResults = [];

    function recordResult(testName, passed, details) {
        testResults.push({ testName, passed, details });
        console.log(`[${passed ? "PASS" : "FAIL"}] ${testName}: ${details}`);
        if (!passed) allPassed = false;
    }

    // -------------------------------------------------------------------------
    // TEST 1: Public Blockchain Configuration API (/api/blockchain/config)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 1: Blockchain Configuration Endpoint ---");
    try {
        const res = await fetch(`${BASE_URL}/api/blockchain/config`);
        const config = await res.json();
        
        const isSanitized = !config.privateKey && !config.rpcUrl && !config.mongoUri && !config.alchemyKey;
        const isSepolia = config.network === "sepolia" && config.chainId === 11155111 && config.chainIdHex === "0xaa36a7";
        const isCorrectAddress = config.contractAddress.toLowerCase() === EXPECTED_SEPOLIA_CONTRACT.toLowerCase();
        const hasExplorer = config.explorerUrl === "https://sepolia.etherscan.io";
        const hasExpectedIssuer = config.expectedIssuer.toLowerCase() === EXPECTED_INITIAL_ISSUER.toLowerCase();

        const pass = res.ok && isSanitized && isSepolia && isCorrectAddress && hasExplorer && hasExpectedIssuer;
        recordResult("1. /api/blockchain/config", pass, 
            `Network=${config.network}, ChainId=${config.chainId}, Address=${config.contractAddress}, SecretsExposed=${!isSanitized}`);
    } catch (err) {
        recordResult("1. /api/blockchain/config", false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Issuer Authorization Endpoint (/api/blockchain/is-authorized)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Issuer Authorization on Sepolia ---");
    try {
        const resAuth = await fetch(`${BASE_URL}/api/blockchain/is-authorized?address=${EXPECTED_INITIAL_ISSUER}`);
        const dataAuth = await resAuth.json();

        const resUnauth = await fetch(`${BASE_URL}/api/blockchain/is-authorized?address=0x000000000000000000000000000000000000dEaD`);
        const dataUnauth = await resUnauth.json();

        const pass = dataAuth.authorized === true && dataUnauth.authorized === false;
        recordResult("2. /api/blockchain/is-authorized", pass,
            `Authorized (0x1FC0...): ${dataAuth.authorized}, Unauthorized (0xdEaD...): ${dataUnauth.authorized}`);
    } catch (err) {
        recordResult("2. /api/blockchain/is-authorized", false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 3: Live Sepolia RPC State & Bytecode Verification
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Direct Sepolia Contract RPC State ---");
    try {
        const web3Sepolia = new Web3(process.env.SEPOLIA_RPC_URL);
        const code = await web3Sepolia.eth.getCode(EXPECTED_SEPOLIA_CONTRACT);
        const hasBytecode = code && code !== "0x" && code.length > 100;

        const artifactPath = path.join(__dirname, "..", "build", "contracts", "Certificate.json");
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
        const contract = new web3Sepolia.eth.Contract(artifact.abi, EXPECTED_SEPOLIA_CONTRACT);

        const owner = await contract.methods.owner().call();
        const isInitialIssuerAdmin = await contract.methods.isRegisteredAdmin(EXPECTED_INITIAL_ISSUER).call();

        const pass = hasBytecode && isInitialIssuerAdmin;
        recordResult("3. Sepolia Contract RPC State", pass,
            `Bytecode present: ${hasBytecode} (${code.length} bytes), Owner: ${owner}, IssuerAdmin: ${isInitialIssuerAdmin}`);
    } catch (err) {
        recordResult("3. Sepolia Contract RPC State", false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Certificate Preparation Endpoint (/api/certificate/prepare)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Certificate Issuance Preparation ---");
    try {
        const dummyCert = {
            studentName: "Sepolia Integration Test",
            rollNumber: "SEP-2026-TEST",
            course: "Blockchain Engineering",
            certificateId: "CERT_TEST_PREPARE_" + Date.now().toString().slice(-5),
            issueDate: "2026-10-17"
        };

        const res = await fetch(`${BASE_URL}/api/certificate/prepare`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dummyCert)
        });
        const prep = await res.json();

        const hasHash = Boolean(prep.certificateHash && prep.certificateHash.startsWith("0x"));
        const hasTxData = Boolean(prep.txData && prep.txData.startsWith("0x62c985c3")); // issueCertificate selector
        const matchesSepolia = prep.blockchainNetwork === "sepolia" && prep.chainId === 11155111;

        const pass = res.ok && hasHash && hasTxData && matchesSepolia;
        recordResult("4. /api/certificate/prepare", pass,
            `Hash=${prep.certificateHash}, Network=${prep.blockchainNetwork}, TxDataSelector=${prep.txData ? prep.txData.slice(0, 10) : 'none'}`);
    } catch (err) {
        recordResult("4. /api/certificate/prepare", false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Public Read-Only Verification with Invalid & Random Certificate ID
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Invalid & Non-Existent Certificate Handling ---");
    try {
        const randomId = "CERT_NON_EXISTENT_" + Math.random().toString(36).substring(2, 9).toUpperCase();
        const res = await fetch(`${BASE_URL}/api/certificate/${randomId}`);
        const data = await res.json();

        const pass = res.status === 404 && data.verified === false;
        recordResult("5. Non-Existent ID Verification", pass,
            `Status=${res.status}, Verified=${data.verified}, Message="${data.message}"`);
    } catch (err) {
        recordResult("5. Non-Existent ID Verification", false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 6: Historical Ganache Local Proof Identification
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Historical Local Proof Handling ---");
    try {
        const res = await fetch(`${BASE_URL}/api/certificate/CERT_CSE001`);
        const data = await res.json();

        const pass = res.ok && data.localProofOnly === true && data.verified === false;
        recordResult("6. Historical Local Proof Detection", pass,
            `LocalProofOnly=${data.localProofOnly}, Verified=${data.verified}, Network=${data.blockchain && data.blockchain.blockchainNetwork}`);
    } catch (err) {
        recordResult("6. Historical Local Proof Detection", false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 7: Cryptographic Tampering Detection
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Cryptographic Hash Mismatch on Tampered Record ---");
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const CertificateModel = require("../server/models/certificates");

        // Temporarily create a dummy certificate in MongoDB with an altered hash
        const tamperCertId = "CERT_TAMPER_TEST_" + Date.now().toString().slice(-5);
        const tamperCert = new CertificateModel({
            studentName: "Tamper Test Student",
            rollNumber: "ROLL_TMP_01",
            course: "Computer Science",
            certificateId: tamperCertId,
            issueDate: "2026-10-17",
            certificateType: "Certificate of Excellence",
            certificateHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
            contractAddress: EXPECTED_SEPOLIA_CONTRACT,
            blockchainNetwork: "sepolia",
            chainId: 11155111
        });
        await tamperCert.save();

        const res = await fetch(`${BASE_URL}/api/certificate/${tamperCertId}`);
        const data = await res.json();

        // Clean up test document
        await CertificateModel.deleteOne({ certificateId: tamperCertId });

        const pass = res.status === 404 && data.verified === false;
        recordResult("7. Tampered Record Detection", pass,
            `Status=${res.status}, Verified=${data.verified}, Message="${data.message}"`);
    } catch (err) {
        recordResult("7. Tampered Record Detection", false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 8: Dual-Network Switching Logic (Local vs Sepolia)
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: Dual-Network Configuration Switchability ---");
    try {
        const { getBlockchainConfig } = require("../server/blockchain");
        
        // Sepolia config check
        process.env.BLOCKCHAIN_NETWORK = "sepolia";
        delete require.cache[require.resolve("../server/blockchain")];
        const { getBlockchainConfig: getSepoliaConfig } = require("../server/blockchain");
        const sepConfig = getSepoliaConfig();

        // Local config check
        process.env.BLOCKCHAIN_NETWORK = "local";
        delete require.cache[require.resolve("../server/blockchain")];
        const { getBlockchainConfig: getLocalConfig } = require("../server/blockchain");
        const locConfig = getLocalConfig();

        // Restore original env
        process.env.BLOCKCHAIN_NETWORK = "sepolia";
        delete require.cache[require.resolve("../server/blockchain")];
        require("../server/blockchain");

        const isSepValid = sepConfig.network === "sepolia" && sepConfig.chainId === 11155111;
        const isLocValid = locConfig.network === "local" && locConfig.chainId === 1337 && locConfig.networkId === 5777;

        const pass = isSepValid && isLocValid;
        recordResult("8. Dual-Network Config Switching", pass,
            `Sepolia mode: [network=${sepConfig.network}, chainId=${sepConfig.chainId}], Local mode: [network=${locConfig.network}, chainId=${locConfig.chainId}, networkId=${locConfig.networkId}]`);
    } catch (err) {
        recordResult("8. Dual-Network Config Switching", false, err.message);
    }

    // -------------------------------------------------------------------------
    // TEST 9: Database Preservation
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 9: MongoDB Document Count & Record Preservation ---");
    try {
        const CertificateModel = require("../server/models/certificates");
        const count = await CertificateModel.countDocuments();
        const sampleRecord = await CertificateModel.findOne({ certificateId: "CERT_CSE001" });

        const pass = count > 0 && sampleRecord && sampleRecord.studentName === "Siddhant Asati";
        recordResult("9. MongoDB Record Preservation", pass,
            `Total certificates in DB: ${count}, Sample CERT_CSE001 preserved: ${Boolean(sampleRecord)}`);
    } catch (err) {
        recordResult("9. MongoDB Record Preservation", false, err.message);
    }

    console.log("\n==================================================================");
    console.log(`TEST SUITE FINISHED: ${allPassed ? "ALL TESTS PASSED (100%)" : "SOME TESTS FAILED"}`);
    console.log("==================================================================");

    process.exit(allPassed ? 0 : 1);
}

runTestSuite().catch(err => {
    console.error("Test suite fatal error:", err);
    process.exit(1);
});
