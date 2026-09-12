const { Web3 } = require("web3");
const path = require("path");
const fs = require("fs");

// ==================================================
// CONFIGURATION & CONSTANTS
// ==================================================
const GANACHE_RPC_URL = process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545";
const NETWORK_ID = process.env.NETWORK_ID || "5777";

// Initialize Web3 provider
const web3 = new Web3(GANACHE_RPC_URL);

// Load Contract ABI and Address from Truffle build artifact
const artifactPath = path.join(__dirname, "..", "build", "contracts", "Certificate.json");
let contractAbi = [];
let contractAddress = process.env.CONTRACT_ADDRESS || null;

try {
    if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
        contractAbi = artifact.abi || [];

        // If CONTRACT_ADDRESS is not set in .env, resolve from Truffle networks
        if (!contractAddress && artifact.networks && artifact.networks[NETWORK_ID]) {
            contractAddress = artifact.networks[NETWORK_ID].address;
        }
    } else {
        console.warn(`[Blockchain] Artifact not found at ${artifactPath}`);
    }
} catch (err) {
    console.error(`[Blockchain] Failed to load artifact: ${err.message}`);
}

// Initialize Contract instance
let certificateContract = null;
if (contractAddress && contractAbi.length > 0) {
    try {
        certificateContract = new web3.eth.Contract(contractAbi, contractAddress);
        console.log(`[Blockchain] Certificate contract loaded at: ${contractAddress}`);
    } catch (err) {
        console.error(`[Blockchain] Failed to instantiate contract: ${err.message}`);
    }
} else {
    console.warn("[Blockchain] Contract address or ABI not available.");
}

// ==================================================
// DETERMINISTIC HASHING
// ==================================================
/**
 * Generates a deterministic Keccak-256 hash (bytes32) from certificate data.
 * Uses a strict canonical structure with sorted keys and normalized strings.
 * Fields: studentName, rollNumber, course, certificateId, issueDate
 *
 * @param {Object} certificateData
 * @returns {{ hash: string, canonicalPayload: string }}
 */
function generateCertificateHash(certificateData) {
    if (!certificateData) {
        throw new Error("Certificate data is required for hashing.");
    }

    const canonicalPayload = JSON.stringify({
        certificateId: String(certificateData.certificateId || "").trim(),
        course: String(certificateData.course || "").trim(),
        issueDate: String(certificateData.issueDate || "").trim(),
        rollNumber: String(certificateData.rollNumber || "").trim(),
        studentName: String(certificateData.studentName || "").trim()
    });

    const hash = web3.utils.keccak256(canonicalPayload);

    return {
        hash,
        canonicalPayload
    };
}

// ==================================================
// SMART CONTRACT READ OPERATIONS
// ==================================================
/**
 * Read-only call to verifyCertificate on the smart contract.
 * Does NOT create any transaction or consume gas.
 *
 * @param {string} certificateId
 * @returns {Promise<{ certificateHash: string, issuer: string, issuedAt: number, exists: boolean }>}
 */
async function getCertificateFromChain(certificateId) {
    if (!certificateContract) {
        throw new Error("Certificate smart contract is not initialized on the backend.");
    }

    if (!certificateId || typeof certificateId !== "string" || !certificateId.trim()) {
        throw new Error("A valid certificateId string is required.");
    }

    const result = await certificateContract.methods.verifyCertificate(certificateId.trim()).call();

    return {
        certificateHash: result.certificateHash,
        issuer: result.issuer,
        issuedAt: Number(result.issuedAt),
        exists: Boolean(result.exists)
    };
}

// ==================================================
// DIAGNOSTIC / HEALTH STATUS
// ==================================================
/**
 * Tests connection to Ganache and queries contract status.
 *
 * @returns {Promise<Object>}
 */
async function checkBlockchainStatus() {
    const isListening = await web3.eth.net.isListening();
    const networkId = await web3.eth.net.getId();
    const blockNumber = await web3.eth.getBlockNumber();
    const accounts = await web3.eth.getAccounts();

    let contractCode = null;
    let isContractDeployed = false;
    let testCallResult = null;
    let testCallSuccess = false;

    if (contractAddress) {
        try {
            contractCode = await web3.eth.getCode(contractAddress);
            isContractDeployed = Boolean(contractCode && contractCode !== "0x" && contractCode !== "0x0");

            if (isContractDeployed && certificateContract) {
                testCallResult = await getCertificateFromChain("TEST_HEALTHCHECK_NONEXISTENT_ID");
                testCallSuccess = true;
            }
        } catch (callErr) {
            console.error("[Blockchain] Test call error:", callErr.message);
        }
    }

    return {
        connected: Boolean(isListening),
        rpcUrl: GANACHE_RPC_URL,
        networkId: Number(networkId),
        latestBlock: Number(blockNumber),
        availableAccounts: accounts.length,
        deployerAccount: accounts[0] || null,
        contractAddress: contractAddress,
        isContractDeployed,
        contractInitialized: Boolean(certificateContract),
        readOnlyTestCallSuccess: testCallSuccess,
        sampleTestCall: testCallResult
    };
}

// ==================================================
// SMART CONTRACT WRITE & PREPARE OPERATIONS
// ==================================================
/**
 * ABI-encodes the issueCertificate function call.
 * Used for preparing MetaMask transactions on the frontend.
 *
 * @param {string} certificateId
 * @param {string} certificateHash (bytes32 hex string)
 * @returns {string} Encoded transaction data
 */
function encodeIssueCertificate(certificateId, certificateHash) {
    if (!certificateContract) {
        throw new Error("Certificate smart contract is not initialized on the backend.");
    }
    return certificateContract.methods.issueCertificate(certificateId.trim(), certificateHash).encodeABI();
}

/**
 * Registers a certificate directly on Ganache using an unlocked account.
 * Used for local development and backend execution without requiring private keys.
 *
 * @param {string} certificateId
 * @param {string} certificateHash (bytes32 hex string)
 * @param {string} [fromAccount]
 * @returns {Promise<Object>}
 */
async function registerCertificateOnChain(certificateId, certificateHash, fromAccount) {
    if (!certificateContract) {
        throw new Error("Certificate smart contract is not initialized on the backend.");
    }

    const accounts = await web3.eth.getAccounts();
    const sender = fromAccount || accounts[0];
    if (!sender) {
        throw new Error("No unlocked Ethereum account available on Ganache to sign transaction.");
    }

    const receipt = await certificateContract.methods.issueCertificate(certificateId.trim(), certificateHash).send({
        from: sender,
        gas: 300000
    });

    const block = await web3.eth.getBlock(receipt.blockNumber);

    return {
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        contractAddress: contractAddress,
        issuer: sender,
        issuedAt: Number(block.timestamp),
        gasUsed: Number(receipt.gasUsed)
    };
}

/**
 * Verifies that a transaction submitted via MetaMask was confirmed on-chain
 * and that the certificate record is recorded correctly in the contract.
 *
 * @param {string} transactionHash
 * @param {string} certificateId
 * @param {string} certificateHash
 * @returns {Promise<Object>}
 */
async function verifyTransactionOnChain(transactionHash, certificateId, certificateHash) {
    if (!certificateContract) {
        throw new Error("Certificate smart contract is not initialized on the backend.");
    }

    if (!transactionHash) {
        throw new Error("Transaction hash is required for on-chain verification.");
    }

    // Poll for transaction receipt with retry in case of slight block propagation latency
    let receipt = null;
    for (let attempt = 0; attempt < 15; attempt++) {
        try {
            receipt = await web3.eth.getTransactionReceipt(transactionHash);
            if (receipt && (receipt.blockNumber !== null && receipt.blockNumber !== undefined)) {
                break;
            }
        } catch (err) {
            console.warn(`[Blockchain] Error polling receipt (attempt ${attempt + 1}):`, err.message);
        }
        await new Promise((resolve) => setTimeout(resolve, 350));
    }

    if (!receipt) {
        throw new Error("Transaction receipt not found on blockchain after confirmation timeout.");
    }

    // In web3 v4, receipt.status can be 1n, 1, true, or '0x1'
    const statusVal = receipt.status;
    const isSuccess = statusVal === 1n || statusVal === 1 || statusVal === true || statusVal === "0x1";
    if (!isSuccess) {
        throw new Error("Blockchain transaction failed or reverted on-chain.");
    }

    const onChain = await getCertificateFromChain(certificateId);
    if (!onChain.exists) {
        throw new Error("Certificate record not found on blockchain after transaction.");
    }

    if (onChain.certificateHash.toLowerCase() !== certificateHash.toLowerCase()) {
        throw new Error("On-chain certificate hash does not match expected deterministic hash.");
    }

    return {
        verified: true,
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        contractAddress: contractAddress,
        issuer: onChain.issuer,
        issuedAt: onChain.issuedAt
    };
}

module.exports = {
    web3,
    certificateContract,
    contractAddress,
    contractAbi,
    generateCertificateHash,
    getCertificateFromChain,
    checkBlockchainStatus,
    encodeIssueCertificate,
    registerCertificateOnChain,
    verifyTransactionOnChain
};

