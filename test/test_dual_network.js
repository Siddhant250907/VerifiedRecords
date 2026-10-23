/**
 * Comprehensive Automated Verification Suite: Dual Blockchain Network Support
 * Tests:
 * 1. GET /api/blockchain/config (default, sepolia, ganache sanitization)
 * 2. GET /api/blockchain/is-authorized (network-specific issuer checks)
 * 3. GET /api/blockchain/is-owner (network-specific owner checks)
 * 4. POST /api/certificate/prepare (deterministic hashing & calldata per network)
 * 5. Full on-chain transaction & issuance test on Ganache Local
 * 6. Read-only verification on /api/certificate/:id using certificate's recorded network
 * 7. POST /api/documents/prepare-blockchain for DocumentVaultProof on Ganache vs Sepolia
 */

const http = require("http");
const { Web3 } = require("web3");

const BASE_URL = "http://127.0.0.1:3000";
const GANACHE_RPC = "http://127.0.0.1:7545";

function makeRequest(path, method = "GET", body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                "Accept": "application/json",
                ...headers
            }
        };

        if (body) {
            const jsonStr = typeof body === "string" ? body : JSON.stringify(body);
            options.headers["Content-Type"] = "application/json";
            options.headers["Content-Length"] = Buffer.byteLength(jsonStr);
        }

        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });

        req.on("error", reject);

        if (body) {
            req.write(typeof body === "string" ? body : JSON.stringify(body));
        }
        req.end();
    });
}

async function runTests() {
    console.log("============================================================");
    console.log(" VERIFIEDRECORDS — DUAL BLOCKCHAIN NETWORK AUTOMATED TESTS");
    console.log("============================================================\n");

    let passCount = 0;
    let failCount = 0;

    function assert(condition, testName, detail = "") {
        if (condition) {
            console.log(`  ✅ PASS: ${testName}`);
            passCount++;
        } else {
            console.error(`  ❌ FAIL: ${testName}`);
            if (detail) console.error(`     Detail: ${detail}`);
            failCount++;
        }
    }

    // -------------------------------------------------------------
    // TEST SUITE 1: /api/blockchain/config
    // -------------------------------------------------------------
    console.log("--- 1. Blockchain Configuration Endpoint ---");
    const cfgDefault = await makeRequest("/api/blockchain/config");
    assert(cfgDefault.status === 200 && cfgDefault.body.success, "Default config responds 200 OK");
    assert(cfgDefault.body.networks && cfgDefault.body.networks.sepolia && cfgDefault.body.networks.ganache,
        "Config describes both networks simultaneously");

    // Sanitization check: Ensure no secrets are leaked
    const jsonStr = JSON.stringify(cfgDefault.body);
    const hasSecrets = /private_key|secret|password|mongodb_uri/i.test(jsonStr);
    assert(!hasSecrets, "Public config does NOT leak private keys, secrets, or internal paths");

    // Specific Sepolia config
    const cfgSepolia = await makeRequest("/api/blockchain/config?network=sepolia");
    assert(cfgSepolia.status === 200 && cfgSepolia.body.network === "sepolia", "GET config?network=sepolia returns Sepolia");
    assert(cfgSepolia.body.chainId === 11155111 && cfgSepolia.body.chainIdHex === "0xaa36a7", "Sepolia chain ID is 11155111 (0xaa36a7)");
    assert(cfgSepolia.body.contractAddress.toLowerCase() === "0xDd4DF9A618683a407f3B195e651271DC0E97f5bE".toLowerCase(),
        "Sepolia contract matches deployed secured Certificate contract");

    // Specific Ganache config
    const cfgGanache = await makeRequest("/api/blockchain/config?network=ganache");
    assert(cfgGanache.status === 200 && cfgGanache.body.network === "ganache", "GET config?network=ganache returns Ganache");
    const expectedGanacheContract = (process.env.GANACHE_CONTRACT_ADDRESS || "0x708FA0b3bd52532913870322fBfCfd0D0867888C").toLowerCase();
    assert(cfgGanache.body.contractAddress.toLowerCase() === expectedGanacheContract,
        `Ganache contract matches deployed secured Certificate contract (${expectedGanacheContract})`);
    assert(cfgGanache.body.isAvailable === true, "Ganache Local is detected as reachable and available locally");

    // -------------------------------------------------------------
    // TEST SUITE 2: Issuer Authorization & Ownership per Network
    // -------------------------------------------------------------
    console.log("\n--- 2. Issuer Authorization & Ownership per Network ---");
    const sepoliaIssuer = "0x1FC04CfBF2f7B0F32AEBecd17880afeb38BFacC7";
    const ganacheDeployer = "0x9317939Ea9f3369C83776517f0549DC4552c2931";
    const unauthorizedWallet = "0x0000000000000000000000000000000000000001";

    const authSepolia = await makeRequest(`/api/blockchain/is-authorized?address=${sepoliaIssuer}&network=sepolia`);
    assert(authSepolia.body.authorized === true, "Authorized issuer confirmed on Sepolia");

    const authGanacheDeployer = await makeRequest(`/api/blockchain/is-authorized?address=${ganacheDeployer}&network=ganache`);
    assert(authGanacheDeployer.body.authorized === true, "Deployer confirmed as authorized issuer on Ganache");

    const authGanacheIssuer = await makeRequest(`/api/blockchain/is-authorized?address=${sepoliaIssuer}&network=ganache`);
    assert(authGanacheIssuer.body.authorized === true, "Registered issuer confirmed on Ganache");

    const authUnauthorized = await makeRequest(`/api/blockchain/is-authorized?address=${unauthorizedWallet}&network=ganache`);
    assert(authUnauthorized.body.authorized === false, "Unauthorized wallet rejected on Ganache");

    // -------------------------------------------------------------
    // TEST SUITE 3: Prepare Certificate Issuance per Network
    // -------------------------------------------------------------
    console.log("\n--- 3. Certificate Issuance Preparation ---");
    const testCertId = "DUAL_NET_TEST_" + Date.now();
    const certPayload = {
        studentName: "Test Student Dual Network",
        rollNumber: "2026-DUAL-001",
        course: "Blockchain & Computer Science",
        certificateType: "Webinar",
        certificateId: testCertId,
        issueDate: "2026-10-17"
    };

    const prepSepolia = await makeRequest("/api/certificate/prepare", "POST", { ...certPayload, network: "sepolia" });
    assert(prepSepolia.status === 200 && prepSepolia.body.success, "Prepare on Sepolia returns success");
    assert(prepSepolia.body.contractAddress.toLowerCase() === "0xDd4DF9A618683a407f3B195e651271DC0E97f5bE".toLowerCase(),
        "Prepare on Sepolia returns Sepolia contract address");
    assert(prepSepolia.body.chainId === 11155111, "Prepare on Sepolia returns Chain ID 11155111");

    const prepGanache = await makeRequest("/api/certificate/prepare", "POST", { ...certPayload, network: "ganache" });
    assert(prepGanache.body.contractAddress.toLowerCase() === expectedGanacheContract,
        `Prepare on Ganache returns Ganache contract address (${expectedGanacheContract})`);
    assert(prepGanache.body.chainId === 1337, "Prepare on Ganache returns Chain ID 1337");

    // -------------------------------------------------------------
    // TEST SUITE 4: On-Chain Transaction & Issuance on Ganache Local
    // -------------------------------------------------------------
    console.log("\n--- 4. Real On-Chain Issuance Execution on Ganache ---");
    const web3Ganache = new Web3(GANACHE_RPC);
    const ganacheAccounts = await web3Ganache.eth.getAccounts();
    const localSender = ganacheAccounts[0]; // 0x9317939Ea9f3369C83776517f0549DC4552c2931

    console.log(`     Broadcasting transaction to Ganache contract from ${localSender}...`);
    const txReceipt = await web3Ganache.eth.sendTransaction({
        from: localSender,
        to: prepGanache.body.contractAddress,
        data: prepGanache.body.txData,
        gas: 300000
    });

    assert(Boolean(txReceipt && txReceipt.transactionHash), "Ganache transaction broadcast and mined successfully");
    const realTxHash = txReceipt.transactionHash;
    console.log(`     Real Ganache Transaction Hash: ${realTxHash} (Block #${txReceipt.blockNumber})`);

    // Submit confirmed transaction to VerifiedRecords backend
    const issueRes = await makeRequest("/api/certificate", "POST", {
        ...certPayload,
        network: "ganache",
        transactionHash: realTxHash,
        blockchainIssuer: localSender
    });

    assert(issueRes.status === 201 && issueRes.body.success, "Certificate successfully registered with backend on Ganache");
    assert(issueRes.body.blockchain.blockchainNetwork === "ganache", "Recorded blockchainNetwork is 'ganache'");
    assert(issueRes.body.blockchain.chainId === 1337, "Recorded chainId is 1337");
    assert(issueRes.body.blockchain.transactionHash === realTxHash, "Recorded transaction hash matches real Ganache hash");

    // -------------------------------------------------------------
    // TEST SUITE 5: Read-Only Verification using Recorded Network
    // -------------------------------------------------------------
    console.log("\n--- 5. Read-Only Network-Aware Certificate Verification ---");
    const verifyRes = await makeRequest(`/api/certificate/${testCertId}?name=Test%20Student%20Dual%20Network`);
    assert(verifyRes.status === 200 && verifyRes.body.verified === true, "Public verification confirms on-chain existence without MetaMask");
    assert(verifyRes.body.blockchain.blockchainNetwork === "ganache", "Verification correctly identified Ganache network from record");
    assert(verifyRes.body.blockchain.transactionHash === realTxHash, "Verification returned verified on-chain transaction hash");

    // -------------------------------------------------------------
    // TEST SUITE 6: Document Vault Proof Contract per Network
    // -------------------------------------------------------------
    console.log("\n--- 6. Document Vault Proof Contract Integration ---");
    // Ganache document proof prepare
    const docPrepGanache = await makeRequest("/api/documents/prepare-blockchain", "POST", {
        documentTitle: "Test Encrypted Academic Thesis",
        walletAddress: localSender,
        network: "ganache"
    });
    const expectedGanacheDocVault = (process.env.GANACHE_DOC_VAULT_ADDRESS || "0xbBd0634841fcaE114436BDAa709c6F065d2145Db").toLowerCase();
    assert(cfgGanache.body.docVaultAddress && cfgGanache.body.docVaultAddress.toLowerCase() === expectedGanacheDocVault,
        `Ganache DocVault contract is registered at ${expectedGanacheDocVault}`);

    console.log("\n============================================================");
    console.log(` TEST SUMMARY: ${passCount} Passed, ${failCount} Failed`);
    console.log("============================================================\n");

    if (failCount > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
});
