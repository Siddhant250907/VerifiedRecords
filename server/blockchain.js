require("dotenv").config();
const { Web3 } = require("web3");
const path = require("path");
const fs = require("fs");

// ============================================================================
// CONFIGURATION & DUAL-NETWORK DEFINITIONS
// ============================================================================

// Supported Networks: 'sepolia' (Ethereum Sepolia) and 'ganache' (Ganache Local)
const DEFAULT_NETWORK = (process.env.BLOCKCHAIN_NETWORK || "sepolia").trim().toLowerCase();

/**
 * Validates and normalizes client/internal network identifiers into canonical keys:
 * 'sepolia' or 'ganache'. Throws an error for unsupported networks.
 *
 * @param {string|number} network
 * @returns {"sepolia"|"ganache"}
 */
function normalizeNetwork(network) {
    if (!network) {
        return DEFAULT_NETWORK === "local" || DEFAULT_NETWORK === "ganache" ? "ganache" : "sepolia";
    }
    const netStr = String(network).trim().toLowerCase();
    if (netStr === "sepolia" || netStr === "ethereum sepolia" || netStr === "eth" || netStr === "11155111" || netStr === "0xaa36a7") {
        return "sepolia";
    }
    if (netStr === "ganache" || netStr === "local" || netStr === "ganache local" || netStr === "1337" || netStr === "5777" || netStr === "0x539") {
        return "ganache";
    }
    throw new Error(`Unsupported or invalid blockchain network "${network}". Only "sepolia" and "ganache" are supported.`);
}

/**
 * Checks whether the server is running in a hosted cloud environment (e.g., Render).
 * In hosted environments, local Ganache (127.0.0.1) cannot connect to a user's local PC.
 *
 * @returns {boolean}
 */
function isHostedEnvironment() {
    return Boolean(
        process.env.RENDER ||
        process.env.RENDER_EXTERNAL_URL ||
        process.env.IS_RENDER ||
        (process.env.NODE_ENV === "production" && !process.env.ALLOW_LOCAL_GANACHE)
    );
}

// ----------------------------------------------------------------------------
// LOAD CONTRACT ABIS
// ----------------------------------------------------------------------------
const certArtifactPath = path.join(__dirname, "..", "build", "contracts", "Certificate.json");
const docVaultArtifactPath = path.join(__dirname, "..", "build", "contracts", "DocumentVaultProof.json");

let contractAbi = [];
let artifactNetworks = {};
try {
    if (fs.existsSync(certArtifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(certArtifactPath, "utf-8"));
        contractAbi = artifact.abi || [];
        artifactNetworks = artifact.networks || {};
    } else {
        console.warn(`[Blockchain] Certificate artifact not found at ${certArtifactPath}`);
    }
} catch (err) {
    console.error(`[Blockchain] Failed to load Certificate artifact: ${err.message}`);
}

let docVaultAbi = [];
try {
    if (fs.existsSync(docVaultArtifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(docVaultArtifactPath, "utf-8"));
        docVaultAbi = artifact.abi || [];
    }
} catch (err) {
    console.warn(`[Blockchain] DocumentVaultProof artifact note: ${err.message}`);
}

const certV2ArtifactPath = path.join(__dirname, "..", "build", "contracts", "CertificateV2.json");
let certV2Abi = [];
let artifactV2Networks = {};
try {
    if (fs.existsSync(certV2ArtifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(certV2ArtifactPath, "utf-8"));
        certV2Abi = artifact.abi || [];
        artifactV2Networks = artifact.networks || {};
    } else {
        console.warn(`[Blockchain] CertificateV2 artifact not found at ${certV2ArtifactPath}`);
    }
} catch (err) {
    console.warn(`[Blockchain] CertificateV2 artifact note: ${err.message}`);
}

// ----------------------------------------------------------------------------
// NETWORK CONFIGURATIONS
// ----------------------------------------------------------------------------
const sepoliaContractAddress = (
    process.env.SEPOLIA_CONTRACT_ADDRESS ||
    (artifactNetworks["11155111"] && artifactNetworks["11155111"].address) ||
    "0xDd4DF9A618683a407f3B195e651271DC0E97f5bE"
).trim();

const ganacheContractAddress = (
    process.env.GANACHE_CONTRACT_ADDRESS ||
    process.env.CONTRACT_ADDRESS ||
    (artifactNetworks["5777"] && artifactNetworks["5777"].address) ||
    "0x708FA0b3bd52532913870322fBfCfd0D0867888C"
).trim();

const sepoliaCertV2Address = (
    process.env.SEPOLIA_CERT_V2_CONTRACT_ADDRESS ||
    (artifactV2Networks["11155111"] && artifactV2Networks["11155111"].address) ||
    "0x9cC54D8fb1066226B0492951A01c9E68d5ddb8E8"
).trim();

const ganacheCertV2Address = (
    process.env.GANACHE_CERT_V2_CONTRACT_ADDRESS ||
    (artifactV2Networks["5777"] && artifactV2Networks["5777"].address) ||
    "0x0000000000000000000000000000000000000000"
).trim();

const sepoliaDocVaultAddress = (process.env.SEPOLIA_DOC_VAULT_ADDRESS || "0xF858c586874aECd3C4324edA5C6Fcb4D0Db685D6").trim();
const ganacheDocVaultAddress = (process.env.GANACHE_DOC_VAULT_ADDRESS || "0xbBd0634841fcaE114436BDAa709c6F065d2145Db").trim();

const sepoliaRpcUrl = (process.env.SEPOLIA_RPC_URL || "").trim();
const ganacheRpcUrl = (process.env.GANACHE_RPC_URL || "http://127.0.0.1:7545").trim();

// ----------------------------------------------------------------------------
// INSTANTIATE WEB3 PROVIDERS & CONTRACTS (CONCURRENT DUAL NETWORK)
// ----------------------------------------------------------------------------
let sepoliaWeb3 = null;
let sepoliaContract = null;
let sepoliaDocVaultContract = null;
let sepoliaCertV2Contract = null;
if (sepoliaRpcUrl && contractAbi.length > 0) {
    try {
        sepoliaWeb3 = new Web3(sepoliaRpcUrl);
        sepoliaContract = new sepoliaWeb3.eth.Contract(contractAbi, sepoliaContractAddress);
        if (sepoliaDocVaultAddress && docVaultAbi.length > 0) {
            sepoliaDocVaultContract = new sepoliaWeb3.eth.Contract(docVaultAbi, sepoliaDocVaultAddress);
        }
        if (sepoliaCertV2Address && certV2Abi.length > 0 && Web3.utils.isAddress(sepoliaCertV2Address) && sepoliaCertV2Address !== "0x0000000000000000000000000000000000000000") {
            sepoliaCertV2Contract = new sepoliaWeb3.eth.Contract(certV2Abi, sepoliaCertV2Address);
        }
    } catch (err) {
        console.warn(`[Blockchain] Could not initialize Sepolia provider: ${err.message}`);
    }
}

let ganacheWeb3 = null;
let ganacheContract = null;
let ganacheDocVaultContract = null;
let ganacheCertV2Contract = null;
if (ganacheRpcUrl && contractAbi.length > 0) {
    try {
        ganacheWeb3 = new Web3(ganacheRpcUrl);
        ganacheContract = new ganacheWeb3.eth.Contract(contractAbi, ganacheContractAddress);
        if (ganacheDocVaultAddress && docVaultAbi.length > 0) {
            ganacheDocVaultContract = new ganacheWeb3.eth.Contract(docVaultAbi, ganacheDocVaultAddress);
        }
        if (ganacheCertV2Address && certV2Abi.length > 0 && Web3.utils.isAddress(ganacheCertV2Address) && ganacheCertV2Address !== "0x0000000000000000000000000000000000000000") {
            ganacheCertV2Contract = new ganacheWeb3.eth.Contract(certV2Abi, ganacheCertV2Address);
        }
    } catch (err) {
        console.warn(`[Blockchain] Could not initialize Ganache provider: ${err.message}`);
    }
}

// Global defaults for backwards compatibility
const defaultCanonicalNetwork = normalizeNetwork(DEFAULT_NETWORK);
const isSepolia = defaultCanonicalNetwork === "sepolia";
const activeNetwork = defaultCanonicalNetwork;
const web3 = isSepolia ? (sepoliaWeb3 || new Web3(sepoliaRpcUrl || undefined)) : (ganacheWeb3 || new Web3(ganacheRpcUrl));
const certificateContract = isSepolia ? sepoliaContract : ganacheContract;
const contractAddress = isSepolia ? sepoliaContractAddress : ganacheContractAddress;
const chainId = isSepolia ? 11155111 : 1337;
const networkId = isSepolia ? 11155111 : 5777;
const rpcUrl = isSepolia ? sepoliaRpcUrl : ganacheRpcUrl;

console.log(`[Blockchain] VerifiedRecords initialized. Default network: [${defaultCanonicalNetwork}].`);
console.log(`[Blockchain] Sepolia contract: ${sepoliaContractAddress} (Chain ID: 11155111)`);
console.log(`[Blockchain] Ganache contract: ${ganacheContractAddress} (Chain ID: 1337, Net ID: 5777)`);
if (sepoliaDocVaultAddress) {
    console.log(`[Blockchain] Sepolia DocumentVaultProof: ${sepoliaDocVaultAddress}`);
}
if (ganacheDocVaultAddress) {
    console.log(`[Blockchain] Ganache DocumentVaultProof: ${ganacheDocVaultAddress}`);
}

// ============================================================================
// DUAL-NETWORK INSTANCE RESOLVERS
// ============================================================================

/**
 * Returns the Web3 instance for the specified network.
 *
 * @param {string} [network]
 * @returns {Web3}
 */
function getWeb3ForNetwork(network) {
    const net = normalizeNetwork(network);
    if (net === "sepolia") {
        if (!sepoliaWeb3) {
            sepoliaWeb3 = new Web3(sepoliaRpcUrl || undefined);
        }
        return sepoliaWeb3;
    }
    if (!ganacheWeb3) {
        ganacheWeb3 = new Web3(ganacheRpcUrl);
    }
    return ganacheWeb3;
}

/**
 * Returns the Certificate contract instance for the specified network.
 *
 * @param {string} [network]
 * @returns {Object}
 */
function getContractForNetwork(network) {
    const net = normalizeNetwork(network);
    if (net === "sepolia") {
        if (!sepoliaContract && sepoliaWeb3 && sepoliaContractAddress) {
            sepoliaContract = new sepoliaWeb3.eth.Contract(contractAbi, sepoliaContractAddress);
        }
        return sepoliaContract;
    }
    if (!ganacheContract && ganacheWeb3 && ganacheContractAddress) {
        ganacheContract = new ganacheWeb3.eth.Contract(contractAbi, ganacheContractAddress);
    }
    return ganacheContract;
}

/**
 * Returns the DocumentVaultProof contract instance for the specified network.
 *
 * @param {string} [network]
 * @returns {Object|null}
 */
function getDocVaultContractForNetwork(network) {
    const net = normalizeNetwork(network);
    if (net === "sepolia") {
        if (!sepoliaDocVaultAddress) return null;
        if (!sepoliaDocVaultContract && sepoliaWeb3) {
            sepoliaDocVaultContract = new sepoliaWeb3.eth.Contract(docVaultAbi, sepoliaDocVaultAddress);
        }
        return sepoliaDocVaultContract;
    }
    if (!ganacheDocVaultAddress) return null;
    if (!ganacheDocVaultContract && ganacheWeb3) {
        ganacheDocVaultContract = new ganacheWeb3.eth.Contract(docVaultAbi, ganacheDocVaultAddress);
    }
    return ganacheDocVaultContract;
}

/**
 * Returns the CertificateV2 contract instance for the specified network.
 *
 * @param {string} [network]
 * @returns {Object|null}
 */
function getCertV2ContractForNetwork(network) {
    const net = normalizeNetwork(network);
    const targetAddress = net === "sepolia" ? sepoliaCertV2Address : ganacheCertV2Address;
    const netWeb3 = getWeb3ForNetwork(net);

    if (net === "sepolia") {
        if (!sepoliaCertV2Contract && netWeb3 && targetAddress && web3.utils.isAddress(targetAddress) && targetAddress !== "0x0000000000000000000000000000000000000000") {
            sepoliaCertV2Contract = new netWeb3.eth.Contract(certV2Abi, targetAddress);
        }
        return sepoliaCertV2Contract;
    }

    if (!ganacheCertV2Contract && netWeb3 && targetAddress && web3.utils.isAddress(targetAddress) && targetAddress !== "0x0000000000000000000000000000000000000000") {
        ganacheCertV2Contract = new netWeb3.eth.Contract(certV2Abi, targetAddress);
    }
    return ganacheCertV2Contract;
}

/**
 * Returns the CertificateV2 contract address for the specified network.
 *
 * @param {string} [network]
 * @returns {string}
 */
function getCertV2ContractAddress(network) {
    const net = normalizeNetwork(network);
    return net === "sepolia" ? sepoliaCertV2Address : ganacheCertV2Address;
}

/**
 * Checks whether Ganache local RPC is reachable.
 *
 * @param {number} [timeoutMs=600]
 * @returns {Promise<boolean>}
 */
async function isGanacheReachable(timeoutMs = 600) {
    if (!ganacheWeb3) return false;
    try {
        await Promise.race([
            ganacheWeb3.eth.getBlockNumber(),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeoutMs))
        ]);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Returns public, sanitized blockchain configuration for frontend & diagnostic endpoints.
 * Never exposes private keys or RPC credentials.
 *
 * @param {string} [requestedNetwork]
 * @returns {Promise<Object>}
 */
function getBlockchainConfig(requestedNetwork) {
    const rawNet = requestedNetwork || (process.env.BLOCKCHAIN_NETWORK || "sepolia").trim().toLowerCase();
    const resolvedNet = normalizeNetwork(rawNet);
    const hosted = isHostedEnvironment();
    const isLocalAlias = String(rawNet).trim().toLowerCase() === "local";
    const reportedKey = isLocalAlias ? "local" : resolvedNet;

    const sepoliaLive = Boolean(sepoliaRpcUrl && sepoliaContractAddress && sepoliaContract);
    const ganacheLive = Boolean(ganacheRpcUrl && ganacheContractAddress && ganacheContract);

    const sepoliaConfig = {
        key: "sepolia",
        label: "Ethereum Sepolia",
        chainId: 11155111,
        chainIdHex: "0xaa36a7",
        networkId: 11155111,
        contractAddress: sepoliaContractAddress,
        certV2Address: sepoliaCertV2Address,
        certV2Abi: certV2Abi,
        docVaultAddress: sepoliaDocVaultAddress,
        explorerUrl: "https://sepolia.etherscan.io",
        isAvailable: sepoliaLive,
        isLocal: false,
        expectedIssuer: process.env.INITIAL_ISSUER_ADDRESS || "0x1FC04CfBF2f7B0F32AEBecd17880afeb38BFacC7",
        expectedAccountName: "Verified Records Sepolia",
        contractOwner: process.env.INITIAL_ISSUER_ADDRESS || "0x1FC04CfBF2f7B0F32AEBecd17880afeb38BFacC7",
        disabledReason: sepoliaLive ? null : "Sepolia RPC or Certificate contract address is not configured."
    };

    const ganacheConfig = {
        key: "ganache",
        label: "Ganache Local",
        chainId: 1337,
        chainIdHex: "0x539",
        networkId: 5777,
        contractAddress: ganacheContractAddress,
        certV2Address: ganacheCertV2Address,
        certV2Abi: certV2Abi,
        docVaultAddress: ganacheDocVaultAddress,
        explorerUrl: null,
        isAvailable: hosted ? false : ganacheLive,
        isLocal: true,
        expectedIssuer: process.env.GANACHE_ISSUER_ADDRESS || "0x9317939Ea9f3369C83776517f0549DC4552c2931",
        expectedAccountName: "Siddhant Personal account",
        contractOwner: "0x9317939Ea9f3369C83776517f0549DC4552c2931",
        disabledReason: hosted
            ? "Ganache Local is only available when running VerifiedRecords on your local machine. Render hosted servers cannot reach your computer's local Ganache."
            : null
    };

    const networks = {
        sepolia: sepoliaConfig,
        ganache: ganacheConfig,
        local: ganacheConfig
    };

    const activeConfig = networks[reportedKey] || networks[resolvedNet];

    const result = {
        success: Boolean(activeConfig && activeConfig.contractAddress),
        defaultNetwork: defaultCanonicalNetwork,
        network: reportedKey,
        label: activeConfig.label,
        chainId: activeConfig.chainId,
        chainIdHex: activeConfig.chainIdHex,
        networkId: activeConfig.networkId,
        contractAddress: activeConfig.contractAddress,
        certV2Address: activeConfig.certV2Address,
        certV2Abi: activeConfig.certV2Abi,
        docVaultAddress: activeConfig.docVaultAddress,
        contractOwner: activeConfig.contractOwner,
        expectedIssuer: activeConfig.expectedIssuer,
        expectedAccountName: activeConfig.expectedAccountName,
        explorerUrl: activeConfig.explorerUrl,
        isSepolia: resolvedNet === "sepolia",
        isAvailable: activeConfig.isAvailable,
        disabledReason: activeConfig.disabledReason,
        isHosted: hosted,
        networks: {
            sepolia: sepoliaConfig,
            ganache: ganacheConfig
        }
    };

    // Make it thenable for async callers wanting live node probe
    result.then = function(onFulfilled, onRejected) {
        return (async () => {
            if (!hosted && ganacheWeb3) {
                const live = await isGanacheReachable(600);
                ganacheConfig.isAvailable = live;
                if (!live) {
                    ganacheConfig.disabledReason = "Ganache is not running. Start Ganache on http://127.0.0.1:7545 and retry.";
                }
                if (resolvedNet === "ganache") {
                    result.isAvailable = live;
                    result.disabledReason = ganacheConfig.disabledReason;
                }
            }
            const copy = { ...result };
            delete copy.then;
            return copy;
        })().then(onFulfilled, onRejected);
    };

    return result;
}

/**
 * Returns the on-chain contract owner address for the given network.
 *
 * @param {string} [network]
 * @returns {Promise<string|null>}
 */
async function getContractOwner(network) {
    const net = normalizeNetwork(network);
    const contract = getContractForNetwork(net);
    if (!contract) {
        return net === "sepolia" ? (process.env.INITIAL_ISSUER_ADDRESS || "0x1FC04CfBF2f7B0F32AEBecd17880afeb38BFacC7") : null;
    }
    try {
        const owner = await contract.methods.owner().call();
        return owner;
    } catch (e) {
        return net === "sepolia" ? (process.env.INITIAL_ISSUER_ADDRESS || "0x1FC04CfBF2f7B0F32AEBecd17880afeb38BFacC7") : null;
    }
}

/**
 * Checks whether an address is the contract owner on the given network.
 *
 * @param {string} address
 * @param {string} [network]
 * @returns {Promise<boolean>}
 */
async function isContractOwner(address, network) {
    const net = normalizeNetwork(network);
    const contractWeb3 = getWeb3ForNetwork(net);
    if (!address || !contractWeb3.utils.isAddress(address)) return false;
    try {
        const owner = await getContractOwner(net);
        if (!owner) return false;
        return owner.toLowerCase() === address.toLowerCase();
    } catch (e) {
        return false;
    }
}

/**
 * Validates whether an address is an authorized issuer (contract owner or registered admin)
 * on the specified network contract.
 *
 * @param {string} address
 * @param {string} [network]
 * @returns {Promise<boolean>}
 */
async function isAuthorizedIssuer(address, network) {
    const net = normalizeNetwork(network);
    const contract = getContractForNetwork(net);
    const contractWeb3 = getWeb3ForNetwork(net);

    if (!contract || !address || !contractWeb3.utils.isAddress(address)) {
        return false;
    }
    try {
        const owner = await contract.methods.owner().call();
        if (owner && owner.toLowerCase() === address.toLowerCase()) return true;
        const isAdmin = await contract.methods.isRegisteredAdmin(address).call();
        return Boolean(isAdmin);
    } catch (e) {
        console.warn(`[Blockchain] Authorization check notice for ${address} on [${net}]:`, e.message);
        return false;
    }
}

// ============================================================================
// DETERMINISTIC HASHING (CANONICAL ACROSS CHAINS)
// ============================================================================
/**
 * Generates a deterministic Keccak-256 hash (bytes32) from certificate data.
 *
 * @param {Object} certificateData
 * @returns {{ hash: string, canonicalPayload: string }}
 */
function generateCertificateHash(certificateData) {
    if (!certificateData) {
        throw new Error("Certificate data is required for hashing.");
    }

    const payloadObj = {
        certificateId: String(certificateData.certificateId || "").trim(),
        course: String(certificateData.course || "").trim(),
        issueDate: String(certificateData.issueDate || "").trim(),
        rollNumber: String(certificateData.rollNumber || "").trim(),
        studentName: String(certificateData.studentName || "").trim()
    };

    const certType = String(certificateData.certificateType || certificateData.fieldOfCertification || "").trim();
    if (certType) {
        payloadObj.certificateType = certType;
    }

    const canonicalPayload = JSON.stringify(payloadObj);
    const hash = web3.utils.keccak256(canonicalPayload);

    return {
        hash,
        canonicalPayload
    };
}

// ============================================================================
// READ-ONLY CERTIFICATE VERIFICATION (NETWORK-AWARE)
// ============================================================================
/**
 * Read-only call to verifyCertificate on the smart contract for the requested chain.
 * Does NOT require MetaMask or create any transaction.
 *
 * @param {string} certificateId
 * @param {string} [contractAddressOrNetwork] Contract address or network name
 * @param {string} [targetNetwork] Explicit target network if address was first argument
 * @returns {Promise<{ certificateHash: string, issuer: string, issuedAt: number, exists: boolean, contractAddress: string, blockchainNetwork: string, chainId: number, localProofOnly?: boolean }>}
 */
async function getCertificateFromChain(certificateId, contractAddressOrNetwork = null, targetNetwork = null) {
    if (!certificateId || typeof certificateId !== "string" || !certificateId.trim()) {
        throw new Error("A valid certificateId string is required.");
    }

    const trimmedId = certificateId.trim();

    // Determine target network & contract address
    let reqNet = null;
    let targetAddress = null;

    if (targetNetwork) {
        reqNet = targetNetwork;
        targetAddress = contractAddressOrNetwork;
    } else if (contractAddressOrNetwork) {
        const str = String(contractAddressOrNetwork).trim().toLowerCase();
        if (str === "sepolia" || str === "ganache" || str === "local") {
            reqNet = str;
        } else if (web3.utils.isAddress(contractAddressOrNetwork)) {
            targetAddress = contractAddressOrNetwork;
            if (sepoliaContractAddress && targetAddress.toLowerCase() === sepoliaContractAddress.toLowerCase()) {
                reqNet = "sepolia";
            } else if (ganacheContractAddress && targetAddress.toLowerCase() === ganacheContractAddress.toLowerCase()) {
                reqNet = "ganache";
            } else {
                // If it is an address that does not match Sepolia, it is an older local Ganache deployment
                reqNet = "ganache";
            }
        }
    }

    const resolvedNet = normalizeNetwork(reqNet);
    const netWeb3 = getWeb3ForNetwork(resolvedNet);
    const netContract = getContractForNetwork(resolvedNet);
    const defaultAddress = resolvedNet === "sepolia" ? sepoliaContractAddress : ganacheContractAddress;
    const finalAddress = targetAddress || defaultAddress;
    const netChainId = resolvedNet === "sepolia" ? 11155111 : 1337;

    // Special check for Ganache Local when queried in hosted mode or for older/historical local deployments
    const isHistoricalGanache = Boolean(
        resolvedNet === "ganache" &&
        targetAddress &&
        ganacheContractAddress &&
        targetAddress.toLowerCase() !== ganacheContractAddress.toLowerCase()
    );

    if (resolvedNet === "ganache") {
        if (isHostedEnvironment() || isHistoricalGanache) {
            return {
                certificateHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
                issuer: "0x0000000000000000000000000000000000000000",
                issuedAt: 0,
                exists: false,
                localProofOnly: true,
                contractAddress: finalAddress,
                blockchainNetwork: "ganache",
                chainId: 1337,
                message: isHistoricalGanache
                    ? "This certificate was issued on a previous Ganache deployment. Live on-chain verification is unavailable."
                    : "This certificate was issued on Ganache Local. Proof verification requires the local development environment."
            };
        }

        const isLive = await isGanacheReachable(600);
        if (!isLive) {
            return {
                certificateHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
                issuer: "0x0000000000000000000000000000000000000000",
                issuedAt: 0,
                exists: false,
                localProofOnly: true,
                contractAddress: finalAddress,
                blockchainNetwork: "ganache",
                chainId: 1337,
                message: "Ganache Local node is currently offline. Start Ganache to verify this local record on-chain."
            };
        }
    }

    // Query on-chain
    let reader = netContract;
    if (targetAddress && (!reader || reader.options.address.toLowerCase() !== targetAddress.toLowerCase())) {
        reader = new netWeb3.eth.Contract(contractAbi, targetAddress);
    }

    if (!reader) {
        throw new Error(`Smart contract reader not initialized for network [${resolvedNet}].`);
    }

    try {
        const result = await reader.methods.verifyCertificate(trimmedId).call();
        return {
            certificateHash: result.certificateHash || result[0],
            issuer: result.issuer || result[1],
            issuedAt: Number(result.issuedAt || result[2] || 0),
            exists: Boolean(result.exists !== undefined ? result.exists : result[3]),
            contractAddress: finalAddress,
            blockchainNetwork: resolvedNet,
            chainId: netChainId
        };
    } catch (err) {
        console.warn(`[Blockchain] verifyCertificate call error on [${resolvedNet}] for ${trimmedId}:`, err.message);
        return {
            certificateHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            issuer: "0x0000000000000000000000000000000000000000",
            issuedAt: 0,
            exists: false,
            contractAddress: finalAddress,
            blockchainNetwork: resolvedNet,
            chainId: netChainId,
            message: resolvedNet === "ganache" ? "Ganache Local node is offline or unreachable." : err.message
        };
    }
}

// ============================================================================
// TRANSACTION PREPARATION & VERIFICATION
// ============================================================================

/**
 * ABI-encodes the issueCertificate function call for the specified network.
 *
 * @param {string} certificateId
 * @param {string} certificateHash (bytes32 hex string)
 * @param {string} [network]
 * @returns {string} Encoded transaction data
 */
function encodeIssueCertificate(certificateId, certificateHash, network) {
    const net = normalizeNetwork(network);
    const contract = getContractForNetwork(net);
    if (!contract) {
        throw new Error(`Certificate smart contract is not initialized for network [${net}].`);
    }
    return contract.methods.issueCertificate(certificateId.trim(), certificateHash).encodeABI();
}

/**
 * Verifies that a client transaction was confirmed on-chain on the specified network
 * and matches the expected certificate ID and deterministic hash.
 *
 * @param {string} transactionHash
 * @param {string} certificateId
 * @param {string} certificateHash
 * @param {Object} [options] { network, blockchainIssuer }
 * @returns {Promise<Object>}
 */
async function verifyTransactionOnChain(transactionHash, certificateId, certificateHash, options = {}) {
    const net = normalizeNetwork(options.network || options.blockchainNetwork);
    const netWeb3 = getWeb3ForNetwork(net);
    const netContract = getContractForNetwork(net);
    const expectedContractAddress = net === "sepolia" ? sepoliaContractAddress : ganacheContractAddress;
    const expectedChainId = net === "sepolia" ? 11155111 : 1337;

    if (!netContract) {
        throw new Error(`Certificate smart contract is not initialized for network [${net}].`);
    }

    if (!transactionHash) {
        throw new Error(`Transaction hash is required for on-chain verification on [${net}].`);
    }

    // 1. Poll for receipt on the specified chain (fast poll with immediate check)
    let receipt = null;
    const isSep = net === "sepolia";
    const maxAttempts = isSep ? 25 : 20;
    const pollInterval = isSep ? 800 : 80;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            receipt = await netWeb3.eth.getTransactionReceipt(transactionHash);
            if (receipt && (receipt.blockNumber !== null && receipt.blockNumber !== undefined)) {
                break;
            }
        } catch (err) {
            console.warn(`[Blockchain] Polling receipt on [${net}] (attempt ${attempt + 1}):`, err.message);
        }
        if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }
    }

    if (!receipt) {
        throw new Error(`Transaction receipt not found on ${net} after confirmation timeout.`);
    }

    // 2. Receipt status check
    const statusVal = receipt.status;
    const isSuccess = statusVal === 1n || statusVal === 1 || statusVal === true || statusVal === "0x1";
    if (!isSuccess) {
        throw new Error(`Blockchain transaction failed or reverted on ${net}.`);
    }

    // 3. Verify target contract
    const isDirectTarget = Boolean(receipt.to && receipt.to.toLowerCase() === expectedContractAddress.toLowerCase());
    const isTargetInLogs = Boolean(Array.isArray(receipt.logs) && receipt.logs.some(
        log => log && log.address && log.address.toLowerCase() === expectedContractAddress.toLowerCase()
    ));

    if (!isDirectTarget && !isTargetInLogs) {
        throw new Error(`Transaction was not addressed to nor interacted with the [${net}] Certificate contract (${expectedContractAddress}). Target was: ${receipt.to}`);
    }

    // 4. Retrieve transaction details to verify chainId
    let tx = null;
    try {
        tx = await netWeb3.eth.getTransaction(transactionHash);
    } catch (txErr) {
        console.warn(`[Blockchain] Could not fetch transaction details on [${net}]:`, txErr.message);
    }

    if (tx && tx.chainId !== undefined && tx.chainId !== null) {
        const txChainIdNum = Number(tx.chainId);
        if (net === "sepolia" && txChainIdNum !== 11155111) {
            throw new Error(`Transaction chain ID (${txChainIdNum}) does not match expected Sepolia chain ID (11155111).`);
        }
        if (net === "ganache" && txChainIdNum !== 1337 && txChainIdNum !== 5777) {
            throw new Error(`Transaction chain ID (${txChainIdNum}) does not match expected Ganache chain ID (1337).`);
        }
    }

    // 5. Query on-chain certificate record on the selected chain
    const onChain = await getCertificateFromChain(certificateId, expectedContractAddress, net);
    if (!onChain.exists) {
        throw new Error(`Certificate record not found on ${net} smart contract after transaction confirmation.`);
    }

    // 6. Verify deterministic hash match
    if (onChain.certificateHash.toLowerCase() !== certificateHash.toLowerCase()) {
        throw new Error(`On-chain certificate hash on [${net}] does not match expected deterministic hash.`);
    }

    // 7. Verify issuer authorization on the selected network
    const isAuthorized = await isAuthorizedIssuer(onChain.issuer, net);
    if (!isAuthorized) {
        throw new Error(`On-chain issuer (${onChain.issuer}) is not an authorized administrator or owner on the [${net}] Certificate contract.`);
    }

    if (options.blockchainIssuer) {
        const declared = options.blockchainIssuer.toLowerCase();
        const matchesOnChain = Boolean(onChain.issuer && onChain.issuer.toLowerCase() === declared);
        const matchesTx = Boolean(tx && tx.from && tx.from.toLowerCase() === declared);
        if (!matchesOnChain && !matchesTx) {
            throw new Error(`Declared issuer (${options.blockchainIssuer}) matches neither transaction sender nor recorded on-chain issuer.`);
        }
    }

    // 8. Capture block timestamp
    let blockTimestamp = onChain.issuedAt;
    try {
        const block = await netWeb3.eth.getBlock(receipt.blockNumber);
        if (block && block.timestamp) {
            blockTimestamp = Number(block.timestamp);
        }
    } catch (bErr) {
        // Fallback
    }

    return {
        verified: true,
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        contractAddress: expectedContractAddress,
        blockchainNetwork: net,
        chainId: expectedChainId,
        issuer: onChain.issuer,
        issuedAt: blockTimestamp,
        gasUsed: Number(receipt.gasUsed)
    };
}

/**
 * Registers a certificate directly on Ganache using an unlocked account or
 * on Sepolia using configured registrar key.
 *
 * @param {string} certificateId
 * @param {string} certificateHash
 * @param {string} [fromAccount]
 * @param {string} [network="ganache"]
 * @returns {Promise<Object>}
 */
async function registerCertificateOnChain(certificateId, certificateHash, fromAccount = null, network = null) {
    const net = normalizeNetwork(network || (fromAccount ? "ganache" : null));
    const netWeb3 = getWeb3ForNetwork(net);
    const netContract = getContractForNetwork(net);
    const expectedContractAddress = net === "sepolia" ? sepoliaContractAddress : ganacheContractAddress;
    const expectedChainId = net === "sepolia" ? 11155111 : 1337;

    const trimmedId = String(certificateId || "").trim();
    if (!trimmedId) {
        throw new Error("Valid certificateId is required for blockchain registration.");
    }

    if (net === "sepolia") {
        const deployerKey = process.env.DEPLOYER_PRIVATE_KEY;
        if (!deployerKey) {
            throw new Error("Backend automated transaction signing on Sepolia requires DEPLOYER_PRIVATE_KEY in .env.");
        }
        const formattedKey = deployerKey.startsWith("0x") ? deployerKey : "0x" + deployerKey;
        const registrar = netWeb3.eth.accounts.privateKeyToAccount(formattedKey);

        const isAuth = await isAuthorizedIssuer(registrar.address, "sepolia");
        if (!isAuth) {
            throw new Error(`Registrar account (${registrar.address}) is not an authorized issuer on Sepolia contract (${sepoliaContractAddress}).`);
        }

        console.log(`[Blockchain] Signing Sepolia issuance for "${trimmedId}" via Registrar account: ${registrar.address}`);
        const txData = netContract.methods.issueCertificate(trimmedId, certificateHash).encodeABI();

        let gasLimit = 500000;
        try {
            const estimated = await netContract.methods.issueCertificate(trimmedId, certificateHash).estimateGas({
                from: registrar.address
            });
            gasLimit = Math.max(500000, Math.floor(Number(estimated) * 1.3));
        } catch (estErr) {
            console.warn("[Blockchain] Gas estimation warning:", estErr.message);
        }

        const gasPrice = await netWeb3.eth.getGasPrice();
        const nonce = await netWeb3.eth.getTransactionCount(registrar.address, "pending");

        const txObj = {
            from: registrar.address,
            to: sepoliaContractAddress,
            data: txData,
            gas: gasLimit,
            gasPrice: gasPrice,
            nonce: nonce,
            chainId: 11155111
        };

        const signedTx = await netWeb3.eth.accounts.signTransaction(txObj, formattedKey);
        const receipt = await netWeb3.eth.sendSignedTransaction(signedTx.rawTransaction);

        const statusVal = receipt.status;
        const isSuccess = statusVal === 1n || statusVal === 1 || statusVal === true || statusVal === "0x1";
        if (!isSuccess) {
            throw new Error(`Transaction reverted on-chain on Sepolia. Hash: ${receipt.transactionHash}`);
        }

        let blockTimestamp = Math.floor(Date.now() / 1000);
        try {
            const block = await netWeb3.eth.getBlock(receipt.blockNumber);
            if (block && block.timestamp) blockTimestamp = Number(block.timestamp);
        } catch (bErr) {}

        return {
            transactionHash: receipt.transactionHash,
            blockNumber: Number(receipt.blockNumber),
            contractAddress: sepoliaContractAddress,
            blockchainNetwork: "sepolia",
            chainId: 11155111,
            issuer: registrar.address,
            issuedAt: blockTimestamp,
            gasUsed: Number(receipt.gasUsed),
            signingMethod: "INSTITUTIONAL_REGISTRAR_SEPOLIA"
        };
    }

    // Ganache Local direct execution
    const accounts = await netWeb3.eth.getAccounts();
    const sender = fromAccount || accounts[0];
    if (!sender) {
        throw new Error("No unlocked Ethereum account available on Ganache to sign transaction.");
    }

    const receipt = await netContract.methods.issueCertificate(trimmedId, certificateHash).send({
        from: sender,
        gas: 300000
    });

    const block = await netWeb3.eth.getBlock(receipt.blockNumber);

    return {
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        contractAddress: expectedContractAddress,
        blockchainNetwork: "ganache",
        chainId: expectedChainId,
        issuer: sender,
        issuedAt: Number(block.timestamp),
        gasUsed: Number(receipt.gasUsed),
        signingMethod: "LOCAL_GANACHE"
    };
}

// ============================================================================
// ADMIN ACCOUNT MANAGEMENT (ON-CHAIN)
// ============================================================================

/**
 * ABI-encodes registerAdmin for the specified network.
 *
 * @param {string} adminUserId
 * @param {string} [adminAddress]
 * @param {string} [network]
 * @returns {string} Encoded bytecode
 */
function encodeRegisterAdmin(adminUserId, adminAddress, network) {
    const net = normalizeNetwork(network);
    const contract = getContractForNetwork(net);
    const netWeb3 = getWeb3ForNetwork(net);
    if (!contract) {
        throw new Error(`Certificate smart contract not initialized for [${net}].`);
    }
    const trimmedId = String(adminUserId).trim();
    if (adminAddress && netWeb3.utils.isAddress(adminAddress)) {
        return contract.methods.registerAdmin(trimmedId, adminAddress).encodeABI();
    }
    return contract.methods.registerAdmin(trimmedId).encodeABI();
}

/**
 * Retrieves on-chain admin record for adminUserId on the specified network.
 *
 * @param {string} adminUserId
 * @param {string} [network]
 * @returns {Promise<Object>}
 */
async function getAdminFromChain(adminUserId, network) {
    const net = normalizeNetwork(network);
    const contract = getContractForNetwork(net);
    if (!contract) {
        throw new Error(`Certificate smart contract not initialized for [${net}].`);
    }
    const trimmedId = String(adminUserId || "").trim();
    if (!trimmedId) {
        throw new Error("A valid adminUserId string is required.");
    }

    const result = await contract.methods.getAdmin(trimmedId).call();
    return {
        adminUserId: result.userId || result[0],
        adminAddress: result.adminAddress || result[1],
        registeredAt: Number(result.registeredAt || result[2]),
        exists: Boolean(result.exists !== undefined ? result.exists : result[3]),
        blockchainNetwork: net
    };
}

/**
 * Registers an admin account directly on Ganache using a local unlocked account.
 *
 * @param {string} adminUserId
 * @param {string} [adminAddress]
 * @param {string} [network="ganache"]
 * @returns {Promise<Object>}
 */
async function registerAdminOnChain(adminUserId, adminAddress, network = "ganache") {
    const net = normalizeNetwork(network);
    if (net === "sepolia") {
        throw new Error("Direct automated backend admin registration is not supported on Sepolia testnet. Must be signed via MetaMask by the contract owner.");
    }

    const netWeb3 = getWeb3ForNetwork("ganache");
    const netContract = getContractForNetwork("ganache");
    const accounts = await netWeb3.eth.getAccounts();
    const sender = accounts[0];
    if (!sender) {
        throw new Error("No unlocked Ethereum account available on Ganache to sign admin registration.");
    }

    const trimmedId = String(adminUserId).trim();
    let receipt;
    if (adminAddress && netWeb3.utils.isAddress(adminAddress)) {
        receipt = await netContract.methods.registerAdmin(trimmedId, adminAddress).send({
            from: sender,
            gas: 300000
        });
    } else {
        receipt = await netContract.methods.registerAdmin(trimmedId).send({
            from: sender,
            gas: 300000
        });
    }

    const block = await netWeb3.eth.getBlock(receipt.blockNumber);

    return {
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        contractAddress: ganacheContractAddress,
        adminAddress: adminAddress || sender,
        registeredAt: Number(block.timestamp),
        gasUsed: Number(receipt.gasUsed),
        blockchainNetwork: "ganache",
        chainId: 1337
    };
}

/**
 * Verifies that an admin registration transaction was confirmed on the specified network.
 *
 * @param {string} transactionHash
 * @param {string} adminUserId
 * @param {string} [network]
 * @returns {Promise<Object>}
 */
async function verifyAdminTransactionOnChain(transactionHash, adminUserId, network) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const expectedContractAddress = net === "sepolia" ? sepoliaContractAddress : ganacheContractAddress;
    const expectedChainId = net === "sepolia" ? 11155111 : 1337;

    if (!transactionHash) {
        throw new Error(`Transaction hash is required for on-chain admin verification on [${net}].`);
    }

    let receipt = null;
    const isSep = net === "sepolia";
    const maxAttempts = isSep ? 25 : 15;
    const pollInterval = isSep ? 1500 : 350;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            receipt = await netWeb3.eth.getTransactionReceipt(transactionHash);
            if (receipt && (receipt.blockNumber !== null && receipt.blockNumber !== undefined)) {
                break;
            }
        } catch (err) {
            console.warn(`[Blockchain] Polling admin receipt on [${net}] (attempt ${attempt + 1}):`, err.message);
        }
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    if (!receipt) {
        throw new Error(`Admin transaction receipt not found on ${net} after confirmation timeout.`);
    }

    const statusVal = receipt.status;
    const isSuccess = statusVal === 1n || statusVal === 1 || statusVal === true || statusVal === "0x1";
    if (!isSuccess) {
        throw new Error(`Blockchain admin registration transaction failed or reverted on ${net}.`);
    }

    const onChainAdmin = await getAdminFromChain(adminUserId, net);
    if (!onChainAdmin.exists) {
        throw new Error(`Admin account record not found on ${net} blockchain after transaction confirmation.`);
    }

    return {
        verified: true,
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        contractAddress: expectedContractAddress,
        blockchainNetwork: net,
        chainId: expectedChainId,
        adminAddress: onChainAdmin.adminAddress,
        registeredAt: onChainAdmin.registeredAt
    };
}

/**
 * Reads document proof from DocumentVaultProof contract on the specified network.
 *
 * @param {string} documentId
 * @param {string} [customContractAddress]
 * @param {string} [network]
 * @returns {Promise<Object>}
 */
async function getDocumentProofFromChain(documentId, customContractAddress, network) {
    const net = normalizeNetwork(network);
    const docVaultContract = getDocVaultContractForNetwork(net);
    if (!docVaultContract) {
        return { exists: false, error: `Document vault contract is not configured on ${net}.` };
    }
    try {
        const res = await docVaultContract.methods.verifyDocumentProof(documentId).call();
        return {
            exists: Boolean(res.exists),
            payloadHash: res.payloadHash,
            submitter: res.submitter,
            anchoredAt: Number(res.anchoredAt),
            network: net
        };
    } catch (err) {
        return { exists: false, error: err.message, network: net };
    }
}

/**
 * Diagnostics / Health status for the specified network (or both).
 *
 * @param {string} [network]
 * @returns {Promise<Object>}
 */
async function checkBlockchainStatus(network) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const netContract = getContractForNetwork(net);
    const expectedContractAddress = net === "sepolia" ? sepoliaContractAddress : ganacheContractAddress;
    const expectedChainId = net === "sepolia" ? 11155111 : 1337;

    const isListening = await netWeb3.eth.net.isListening();
    const detectedNetId = await netWeb3.eth.net.getId();
    const blockNumber = await netWeb3.eth.getBlockNumber();
    const accounts = await netWeb3.eth.getAccounts();

    let contractCode = null;
    let isContractDeployed = false;
    let testCallResult = null;
    let testCallSuccess = false;

    if (expectedContractAddress) {
        try {
            contractCode = await netWeb3.eth.getCode(expectedContractAddress);
            isContractDeployed = Boolean(contractCode && contractCode !== "0x" && contractCode !== "0x0");
            if (isContractDeployed && netContract) {
                testCallResult = await getCertificateFromChain("TEST_HEALTHCHECK_ID", expectedContractAddress, net);
                testCallSuccess = true;
            }
        } catch (callErr) {
            console.error(`[Blockchain] Test call error on [${net}]:`, callErr.message);
        }
    }

    const currentRpc = net === "sepolia" ? sepoliaRpcUrl : ganacheRpcUrl;
    const sanitizedRpc = net === "sepolia" && currentRpc
        ? currentRpc.replace(/\/v[23]\/[a-zA-Z0-9_-]+/, "/v[REDACTED]")
        : currentRpc;

    return {
        connected: Boolean(isListening),
        network: net,
        chainId: expectedChainId,
        rpcUrl: sanitizedRpc,
        networkId: Number(detectedNetId),
        latestBlock: Number(blockNumber),
        availableAccounts: accounts.length,
        deployerAccount: accounts[0] || null,
        contractAddress: expectedContractAddress,
        isContractDeployed,
        contractInitialized: Boolean(netContract),
        readOnlyTestCallSuccess: testCallSuccess,
        sampleTestCall: testCallResult
    };
}

// ============================================================================
// V2 ORGANIZATION & ROLE-BASED SMART CONTRACT FUNCTIONS
// ============================================================================

/**
 * Derives a deterministic bytes32 identifier from a string organization ID.
 *
 * @param {string} orgId
 * @returns {string} bytes32 hex string
 */
function deriveOrgIdBytes32(orgId) {
    if (!orgId) throw new Error("Organization ID is required.");
    const trimmed = String(orgId).trim();
    if (trimmed.startsWith("0x") && trimmed.length === 66) {
        return trimmed.toLowerCase();
    }
    return web3.utils.keccak256(trimmed);
}

/**
 * Generates a deterministic Keccak-256 hash (bytes32) from certificate data
 * including the authoritative organization identifier in the cryptographic commitment.
 *
 * @param {Object} certificateData
 * @returns {{ hash: string, canonicalPayload: string }}
 */
function generateCertificateV2Hash(certificateData, orgIdOverride) {
    if (!certificateData) {
        throw new Error("Certificate data is required for V2 hashing.");
    }

    const resolvedOrgId = String(orgIdOverride || certificateData.orgId || certificateData.organizationId || "").trim();

    const payloadObj = {
        certificateId: String(certificateData.certificateId || "").trim(),
        course: String(certificateData.course || "").trim(),
        issueDate: String(certificateData.issueDate || "").trim(),
        orgId: resolvedOrgId,
        rollNumber: String(certificateData.rollNumber || "").trim(),
        studentName: String(certificateData.studentName || "").trim()
    };

    const certType = String(certificateData.certificateType || certificateData.fieldOfCertification || "").trim();
    if (certType) {
        payloadObj.certificateType = certType;
    }

    const canonicalPayload = JSON.stringify(payloadObj);
    const hash = Web3.utils.keccak256(canonicalPayload);

    return {
        hash,
        canonicalPayload
    };
}

/**
 * Encodes createOrganization(bytes32, string, string, string, uint256, bytes32) transaction data.
 */
function encodeCreateOrganization(orgIdBytes32, orgName, universityOrCompany, purpose, capacity, accessKeyHash, network) {
    const net = normalizeNetwork(network);
    const contract = getCertV2ContractForNetwork(net);
    const safeName = String(orgName || "").trim();
    const safeEntity = String(universityOrCompany || "").trim();
    const safePurpose = String(purpose || "").trim();
    const safeCapacity = parseInt(capacity, 10) || 50;
    const safeHash = accessKeyHash && accessKeyHash.startsWith("0x") ? accessKeyHash : ("0x" + (accessKeyHash || "0".repeat(64)));

    if (!contract) {
        const dummyContract = new web3.eth.Contract(certV2Abi);
        return dummyContract.methods.createOrganization(
            orgIdBytes32,
            safeName,
            safeEntity,
            safePurpose,
            safeCapacity,
            safeHash
        ).encodeABI();
    }
    return contract.methods.createOrganization(
        orgIdBytes32,
        safeName,
        safeEntity,
        safePurpose,
        safeCapacity,
        safeHash
    ).encodeABI();
}

/**
 * Encodes joinOrganization(bytes32, string) transaction data.
 */
function encodeJoinOrganization(orgIdBytes32, accessKey, network) {
    const net = normalizeNetwork(network);
    const contract = getCertV2ContractForNetwork(net);
    const safeKey = String(accessKey || "").trim();

    if (!contract) {
        const dummyContract = new web3.eth.Contract(certV2Abi);
        return dummyContract.methods.joinOrganization(orgIdBytes32, safeKey).encodeABI();
    }
    return contract.methods.joinOrganization(orgIdBytes32, safeKey).encodeABI();
}

/**
 * Encodes requestOrganization(bytes32, string, address) transaction data.
 */
function encodeRequestOrganization(orgIdBytes32, orgName, orgOwner, network) {
    const net = normalizeNetwork(network);
    const contract = getCertV2ContractForNetwork(net);
    if (!contract) {
        // Fallback: encode using ABI definition directly
        const dummyContract = new web3.eth.Contract(certV2Abi);
        return dummyContract.methods.requestOrganization(orgIdBytes32, String(orgName).trim(), orgOwner).encodeABI();
    }
    return contract.methods.requestOrganization(orgIdBytes32, String(orgName).trim(), orgOwner).encodeABI();
}

/**
 * Encodes approveOrganization(bytes32) transaction data.
 */
function encodeApproveOrganization(orgIdBytes32, network) {
    const net = normalizeNetwork(network);
    const contract = getCertV2ContractForNetwork(net);
    if (!contract) {
        const dummyContract = new web3.eth.Contract(certV2Abi);
        return dummyContract.methods.approveOrganization(orgIdBytes32).encodeABI();
    }
    return contract.methods.approveOrganization(orgIdBytes32).encodeABI();
}

/**
 * Encodes rejectOrganization(bytes32) transaction data.
 */
function encodeRejectOrganization(orgIdBytes32, network) {
    const net = normalizeNetwork(network);
    const contract = getCertV2ContractForNetwork(net);
    if (!contract) {
        const dummyContract = new web3.eth.Contract(certV2Abi);
        return dummyContract.methods.rejectOrganization(orgIdBytes32).encodeABI();
    }
    return contract.methods.rejectOrganization(orgIdBytes32).encodeABI();
}

/**
 * Encodes addOrganizationAdmin(bytes32, address) transaction data.
 */
function encodeAddOrgAdmin(orgIdBytes32, adminAddress, network) {
    const net = normalizeNetwork(network);
    const contract = getCertV2ContractForNetwork(net);
    if (!contract) {
        const dummyContract = new web3.eth.Contract(certV2Abi);
        return dummyContract.methods.addOrganizationAdmin(orgIdBytes32, adminAddress).encodeABI();
    }
    return contract.methods.addOrganizationAdmin(orgIdBytes32, adminAddress).encodeABI();
}

/**
 * Encodes removeOrganizationAdmin(bytes32, address) transaction data.
 */
function encodeRemoveOrgAdmin(orgIdBytes32, adminAddress, network) {
    const net = normalizeNetwork(network);
    const contract = getCertV2ContractForNetwork(net);
    if (!contract) {
        const dummyContract = new web3.eth.Contract(certV2Abi);
        return dummyContract.methods.removeOrganizationAdmin(orgIdBytes32, adminAddress).encodeABI();
    }
    return contract.methods.removeOrganizationAdmin(orgIdBytes32, adminAddress).encodeABI();
}

/**
 * Encodes issueCertificate(bytes32, string, bytes32) transaction data for V2 contract.
 */
function encodeIssueCertificateV2(orgIdBytes32, certificateId, certificateHash, network) {
    const net = normalizeNetwork(network);
    const contract = getCertV2ContractForNetwork(net);
    if (!contract) {
        const dummyContract = new web3.eth.Contract(certV2Abi);
        return dummyContract.methods.issueCertificate(orgIdBytes32, String(certificateId).trim(), certificateHash).encodeABI();
    }
    return contract.methods.issueCertificate(orgIdBytes32, String(certificateId).trim(), certificateHash).encodeABI();
}

/**
 * Encodes revokeCertificate(bytes32, string) transaction data for V2 contract.
 */
function encodeRevokeCertificateV2(orgIdBytes32, certificateId, network) {
    const net = normalizeNetwork(network);
    const contract = getCertV2ContractForNetwork(net);
    if (!contract) {
        const dummyContract = new web3.eth.Contract(certV2Abi);
        return dummyContract.methods.revokeCertificate(orgIdBytes32, String(certificateId).trim()).encodeABI();
    }
    return contract.methods.revokeCertificate(orgIdBytes32, String(certificateId).trim()).encodeABI();
}

/**
 * Reads an organization from the V2 smart contract on-chain.
 */
async function getOrganizationFromChain(orgIdBytes32, customAddress = null, network = null) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const defaultAddress = getCertV2ContractAddress(net);
    const finalAddress = customAddress || defaultAddress;

    if (!finalAddress || !netWeb3.utils.isAddress(finalAddress) || finalAddress === "0x0000000000000000000000000000000000000000") {
        return { exists: false, error: "CertificateV2 contract address not configured for " + net };
    }

    try {
        const reader = new netWeb3.eth.Contract(certV2Abi, finalAddress);
        const res = await reader.methods.getOrganization(orgIdBytes32).call();
        const statusMap = ["None", "Pending", "Approved", "Rejected", "Suspended"];
        const statusNum = Number(res.status || res[3] || 0);

        return {
            exists: Boolean(res.exists !== undefined ? res.exists : res[6]),
            orgId: res.id || res[0],
            orgName: res.name || res[1],
            owner: res.orgOwner || res[2],
            status: statusMap[statusNum] || "Unknown",
            statusNum: statusNum,
            createdAt: Number(res.createdAt || res[4] || 0),
            approvedAt: Number(res.approvedAt || res[5] || 0),
            contractAddress: finalAddress,
            network: net
        };
    } catch (err) {
        return { exists: false, error: err.message, network: net };
    }
}

/**
 * Reads full organization details from the V2 smart contract on-chain.
 */
async function getOrganizationFullFromChain(orgIdBytes32, customAddress = null, network = null) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const defaultAddress = getCertV2ContractAddress(net);
    const finalAddress = customAddress || defaultAddress;

    if (!finalAddress || !netWeb3.utils.isAddress(finalAddress) || finalAddress === "0x0000000000000000000000000000000000000000") {
        return { exists: false, error: "CertificateV2 contract address not configured for " + net };
    }

    try {
        const reader = new netWeb3.eth.Contract(certV2Abi, finalAddress);
        const res = await reader.methods.getOrganizationFull(orgIdBytes32).call();
        const statusMap = ["None", "Pending", "Approved", "Rejected", "Suspended"];
        const statusNum = Number(res.status || res[7] || 0);

        return {
            exists: Boolean(res.exists !== undefined ? res.exists : res[9]),
            orgId: res.id || res[0],
            name: res.name || res[1],
            universityOrCompany: res.universityOrCompany || res[2] || "—",
            purpose: res.purpose || res[3] || "—",
            capacity: Number(res.capacity || res[4] || 0),
            memberCount: Number(res.memberCount || res[5] || 0),
            currentMemberCount: Number(res.memberCount || res[5] || 0),
            owner: res.orgOwner || res[6],
            ownerWallet: (res.orgOwner || res[6] || "").toLowerCase(),
            status: statusMap[statusNum] || "Approved",
            statusNum: statusNum,
            createdAt: Number(res.createdAt || res[8] || 0),
            contractAddress: finalAddress,
            blockchainNetwork: net
        };
    } catch (err) {
        // Fallback to basic getOrganizationFromChain
        const fallback = await getOrganizationFromChain(orgIdBytes32, finalAddress, net);
        return {
            ...fallback,
            name: fallback.orgName,
            universityOrCompany: "Institutional Credential Authority",
            purpose: "Academic & Professional Credential Verification",
            capacity: 50,
            memberCount: 1,
            currentMemberCount: 1,
            ownerWallet: (fallback.owner || "").toLowerCase()
        };
    }
}

/**
 * Returns all registered organization members from the V2 smart contract on-chain.
 */
async function getOrganizationMembersFromChain(orgIdBytes32, customAddress = null, network = null) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const defaultAddress = getCertV2ContractAddress(net);
    const finalAddress = customAddress || defaultAddress;

    if (!finalAddress || !netWeb3.utils.isAddress(finalAddress)) {
        return [];
    }

    try {
        const reader = new netWeb3.eth.Contract(certV2Abi, finalAddress);
        const res = await reader.methods.getOrganizationMembers(orgIdBytes32).call();
        const addresses = res.members || res[0] || [];
        const isAdmins = res.isAdmins || res[1] || [];

        return addresses.map((addr, i) => ({
            walletAddress: addr.toLowerCase(),
            isAdmin: Boolean(isAdmins[i]),
            role: Boolean(isAdmins[i]) ? "admin" : "member",
            isAuthorizedIssuer: Boolean(isAdmins[i]),
            status: "active"
        }));
    } catch (err) {
        console.warn(`[getOrganizationMembersFromChain] Notice: ${err.message}`);
        return [];
    }
}

/**
 * Returns all organization IDs registered on-chain.
 */
async function getAllOrgIdsFromChain(customAddress = null, network = null) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const defaultAddress = getCertV2ContractAddress(net);
    const finalAddress = customAddress || defaultAddress;

    if (!finalAddress || !netWeb3.utils.isAddress(finalAddress)) {
        return [];
    }

    try {
        const reader = new netWeb3.eth.Contract(certV2Abi, finalAddress);
        const ids = await reader.methods.getAllOrgIds().call();
        return Array.isArray(ids) ? ids : [];
    } catch (err) {
        console.warn(`[getAllOrgIdsFromChain] Notice: ${err.message}`);
        return [];
    }
}

/**
 * Returns all organization IDs where user is owner or member on-chain.
 */
async function getUserOrgIdsFromChain(userAddress, customAddress = null, network = null) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const defaultAddress = getCertV2ContractAddress(net);
    const finalAddress = customAddress || defaultAddress;

    if (!finalAddress || !userAddress || !netWeb3.utils.isAddress(userAddress)) {
        return [];
    }

    try {
        const reader = new netWeb3.eth.Contract(certV2Abi, finalAddress);
        const ids = await reader.methods.getUserOrgIds(userAddress).call();
        return Array.isArray(ids) ? ids : [];
    } catch (err) {
        // Fallback: query all org IDs
        return await getAllOrgIdsFromChain(finalAddress, net);
    }
}

/**
 * Verifies organization access key on-chain.
 */
async function verifyOrgAccessKeyOnChain(orgIdBytes32, accessKey, customAddress = null, network = null) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const defaultAddress = getCertV2ContractAddress(net);
    const finalAddress = customAddress || defaultAddress;

    try {
        const reader = new netWeb3.eth.Contract(certV2Abi, finalAddress);
        const isValid = await reader.methods.verifyOrgAccessKey(orgIdBytes32, String(accessKey).trim()).call();
        return Boolean(isValid);
    } catch (e) {
        return false;
    }
}

/**
 * Checks whether an address is an authorized issuer on-chain for a specific organization in V2.
 */
async function isAuthorizedOrgIssuerOnChain(orgIdBytes32, address, customAddress = null, network = null) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const targetAddress = customAddress || getCertV2ContractAddress(net);

    if (!targetAddress || !address || !netWeb3.utils.isAddress(address) || !netWeb3.utils.isAddress(targetAddress)) {
        return false;
    }

    try {
        const reader = new netWeb3.eth.Contract(certV2Abi, targetAddress);
        const authorized = await reader.methods.isAuthorizedIssuer(orgIdBytes32, address).call();
        return Boolean(authorized);
    } catch (e) {
        return false;
    }
}

/**
 * Reads certificate record from CertificateV2 on-chain.
 */
async function getCertificateV2FromChain(certificateId, customAddress = null, network = null) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const defaultAddress = getCertV2ContractAddress(net);
    const finalAddress = customAddress || defaultAddress;
    const netChainId = net === "sepolia" ? 11155111 : 1337;

    if (!finalAddress || !netWeb3.utils.isAddress(finalAddress) || finalAddress === "0x0000000000000000000000000000000000000000") {
        return { exists: false, error: "CertificateV2 contract not configured for " + net };
    }

    try {
        const reader = new netWeb3.eth.Contract(certV2Abi, finalAddress);
        const res = await reader.methods.verifyCertificate(String(certificateId).trim()).call();

        return {
            exists: Boolean(res.exists !== undefined ? res.exists : res[4]),
            orgId: res.orgId || res[0],
            certificateHash: res.certificateHash || res[1],
            issuer: res.issuer || res[2],
            issuedAt: Number(res.issuedAt || res[3] || 0),
            revoked: Boolean(res.revoked !== undefined ? res.revoked : res[5]),
            revokedAt: Number(res.revokedAt || res[6] || 0),
            contractAddress: finalAddress,
            blockchainNetwork: net,
            chainId: netChainId
        };
    } catch (err) {
        return { exists: false, error: err.message, network: net, chainId: netChainId };
    }
}

/**
 * Helper to poll for a transaction receipt with retries, handling node propagation latency.
 */
async function waitForTxReceipt(netWeb3, txHash, maxAttempts = 8, delayMs = 1200) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const receipt = await netWeb3.eth.getTransactionReceipt(txHash);
            if (receipt) return receipt;
        } catch (e) {
            // Ignore transient RPC errors during propagation
        }
        await new Promise(r => setTimeout(r, delayMs));
    }
    return null;
}

/**
 * Verifies that a transaction registered an organization request on-chain.
 */
async function verifyOrganizationRequestTxOnChain(txHash, expectedOrgIdBytes32, expectedOwner, network = null) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const expectedContractAddress = getCertV2ContractAddress(net);
    const expectedChainId = net === "sepolia" ? 11155111 : 1337;

    if (!txHash || !txHash.startsWith("0x")) {
        throw new Error("Invalid transaction hash format.");
    }

    const receipt = await waitForTxReceipt(netWeb3, txHash, 8, 1200);
    if (!receipt) {
        throw new Error(`Transaction ${txHash} not yet confirmed or not found on ${net}.`);
    }

    const isSuccess = receipt.status === true || receipt.status === 1 || receipt.status === "0x1" || receipt.status === 1n;
    if (!isSuccess) {
        throw new Error(`Blockchain transaction ${txHash} failed or reverted on ${net}.`);
    }

    if (expectedContractAddress && receipt.to && receipt.to.toLowerCase() !== expectedContractAddress.toLowerCase()) {
        throw new Error(`Transaction was addressed to ${receipt.to}, expected CertificateV2 at ${expectedContractAddress}.`);
    }

    // Verify on-chain state reflects registration
    const onChainOrg = await getOrganizationFromChain(expectedOrgIdBytes32, expectedContractAddress, net);
    if (!onChainOrg.exists) {
        throw new Error(`Organization record not found on ${net} blockchain after transaction confirmation.`);
    }

    return {
        verified: true,
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        contractAddress: receipt.to || expectedContractAddress,
        blockchainNetwork: net,
        chainId: expectedChainId,
        orgId: expectedOrgIdBytes32,
        owner: onChainOrg.owner,
        status: onChainOrg.status
    };
}

/**
 * Verifies that a transaction approved an organization on-chain by the platform super admin.
 */
async function verifyOrganizationApprovalTxOnChain(txHash, expectedOrgIdBytes32, network = null) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const expectedContractAddress = getCertV2ContractAddress(net);
    const expectedChainId = net === "sepolia" ? 11155111 : 1337;

    const receipt = await waitForTxReceipt(netWeb3, txHash, 8, 1200);
    if (!receipt) {
        throw new Error(`Approval transaction ${txHash} not yet confirmed on ${net}.`);
    }

    const isSuccess = receipt.status === true || receipt.status === 1 || receipt.status === "0x1" || receipt.status === 1n;
    if (!isSuccess) {
        throw new Error(`Approval transaction reverted on ${net}.`);
    }

    // Verify on-chain status is Approved
    const onChainOrg = await getOrganizationFromChain(expectedOrgIdBytes32, expectedContractAddress, net);
    if (!onChainOrg.exists || onChainOrg.status !== "Approved") {
        throw new Error(`Organization is not in Approved state on ${net} smart contract.`);
    }

    return {
        verified: true,
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        contractAddress: receipt.to || expectedContractAddress,
        blockchainNetwork: net,
        chainId: expectedChainId,
        approvedAt: onChainOrg.approvedAt
    };
}

/**
 * Verifies an organization admin addition or removal transaction on-chain.
 */
async function verifyOrganizationAdminTxOnChain(txHash, expectedOrgIdBytes32, expectedAdmin, isAdd = true, network = null) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const expectedContractAddress = getCertV2ContractAddress(net);

    const receipt = await waitForTxReceipt(netWeb3, txHash, 8, 1200);
    if (!receipt) {
        throw new Error(`Admin management transaction ${txHash} not found on ${net}.`);
    }

    const isSuccess = receipt.status === true || receipt.status === 1 || receipt.status === "0x1" || receipt.status === 1n;
    if (!isSuccess) {
        throw new Error(`Admin management transaction reverted on ${net}.`);
    }

    // Verify on-chain state
    const isNowAdmin = await isAuthorizedOrgIssuerOnChain(expectedOrgIdBytes32, expectedAdmin, expectedContractAddress, net);
    if (isAdd && !isNowAdmin) {
        throw new Error(`Address ${expectedAdmin} is not authorized on-chain for organization.`);
    }
    if (!isAdd && isNowAdmin) {
        throw new Error(`Address ${expectedAdmin} is still authorized on-chain for organization.`);
    }

    return {
        verified: true,
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        contractAddress: receipt.to || expectedContractAddress,
        blockchainNetwork: net
    };
}

/**
 * Verifies a V2 certificate issuance transaction on-chain.
 */
async function verifyCertificateV2TxOnChain(txHash, expectedOrgIdBytes32, expectedCertId, expectedHash, network = null) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const expectedContractAddress = getCertV2ContractAddress(net);
    const expectedChainId = net === "sepolia" ? 11155111 : 1337;

    const receipt = await waitForTxReceipt(netWeb3, txHash, 8, 1200);
    if (!receipt) {
        throw new Error(`Transaction ${txHash} not yet confirmed on ${net}.`);
    }

    const isSuccess = receipt.status === true || receipt.status === 1 || receipt.status === "0x1" || receipt.status === 1n;
    if (!isSuccess) {
        throw new Error(`Transaction reverted on ${net}.`);
    }

    const onChainRecord = await getCertificateV2FromChain(expectedCertId, expectedContractAddress, net);
    if (!onChainRecord.exists) {
        throw new Error(`Certificate record "${expectedCertId}" not found on ${net} smart contract.`);
    }

    if (onChainRecord.certificateHash.toLowerCase() !== expectedHash.toLowerCase()) {
        throw new Error("On-chain certificate hash does not match computed deterministic hash.");
    }

    return {
        verified: true,
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        contractAddress: receipt.to || expectedContractAddress,
        blockchainNetwork: net,
        chainId: expectedChainId,
        issuer: onChainRecord.issuer,
        issuedAt: onChainRecord.issuedAt,
        orgId: onChainRecord.orgId
    };
}

/**
 * Verifies a certificate revocation transaction on-chain.
 */
async function verifyRevocationTxOnChain(txHash, expectedOrgIdBytes32, expectedCertId, network = null) {
    const net = normalizeNetwork(network);
    const netWeb3 = getWeb3ForNetwork(net);
    const expectedContractAddress = getCertV2ContractAddress(net);

    const receipt = await waitForTxReceipt(netWeb3, txHash, 8, 1200);
    if (!receipt) {
        throw new Error(`Revocation transaction ${txHash} not confirmed on ${net}.`);
    }

    const isSuccess = receipt.status === true || receipt.status === 1 || receipt.status === "0x1" || receipt.status === 1n;
    if (!isSuccess) {
        throw new Error(`Revocation transaction reverted on ${net}.`);
    }

    const onChainRecord = await getCertificateV2FromChain(expectedCertId, expectedContractAddress, net);
    if (!onChainRecord.exists || !onChainRecord.revoked) {
        throw new Error(`Certificate "${expectedCertId}" is not recorded as revoked on ${net}.`);
    }

    return {
        verified: true,
        transactionHash: receipt.transactionHash,
        blockNumber: Number(receipt.blockNumber),
        contractAddress: receipt.to || expectedContractAddress,
        blockchainNetwork: net,
        revokedAt: onChainRecord.revokedAt
    };
}

/**
 * Cryptographically verifies a signed challenge to prove wallet ownership.
 *
 * @param {string} walletAddress
 * @param {string} message
 * @param {string} signature
 * @returns {boolean}
 */
function verifyWalletSignature(walletAddress, message, signature) {
    if (!walletAddress || !message || !signature) return false;
    try {
        const recoveredAddress = web3.eth.accounts.recover(message, signature);
        return Boolean(recoveredAddress && recoveredAddress.toLowerCase() === walletAddress.toLowerCase());
    } catch (e) {
        console.warn("[Wallet Signature] Verification error:", e.message);
        return false;
    }
}

module.exports = {
    // Core helpers
    normalizeNetwork,
    isHostedEnvironment,
    getBlockchainConfig,
    getWeb3ForNetwork,
    getContractForNetwork,
    getDocVaultContractForNetwork,
    isGanacheReachable,

    // Contract operations
    getContractOwner,
    isContractOwner,
    isAuthorizedIssuer,
    generateCertificateHash,
    getCertificateFromChain,
    getDocumentProofFromChain,
    checkBlockchainStatus,
    encodeIssueCertificate,
    registerCertificateOnChain,
    verifyTransactionOnChain,
    encodeRegisterAdmin,
    getAdminFromChain,
    registerAdminOnChain,
    verifyAdminTransactionOnChain,

    // Singletons for backward compatibility
    web3,
    certificateContract,
    contractAddress,
    sepoliaContractAddress,
    ganacheContractAddress,
    sepoliaCertV2Address,
    ganacheCertV2Address,
    sepoliaDocVaultAddress,
    ganacheDocVaultAddress,
    contractAbi,
    certV2Abi,
    docVaultAbi,
    activeNetwork,
    chainId,
    networkId,
    isSepolia,
    rpcUrl,

    // CertificateV2 & Organization operations
    getCertV2ContractForNetwork,
    getCertV2ContractAddress,
    deriveOrgIdBytes32,
    generateCertificateV2Hash,
    encodeCreateOrganization,
    encodeJoinOrganization,
    encodeRequestOrganization,
    encodeApproveOrganization,
    encodeRejectOrganization,
    encodeAddOrgAdmin,
    encodeRemoveOrgAdmin,
    encodeIssueCertificateV2,
    encodeRevokeCertificateV2,
    getOrganizationFromChain,
    getOrganizationFullFromChain,
    getOrganizationMembersFromChain,
    getAllOrgIdsFromChain,
    getUserOrgIdsFromChain,
    verifyOrgAccessKeyOnChain,
    isAuthorizedOrgIssuerOnChain,
    getCertificateV2FromChain,
    verifyOrganizationRequestTxOnChain,
    verifyOrganizationApprovalTxOnChain,
    verifyOrganizationAdminTxOnChain,
    verifyCertificateV2TxOnChain,
    verifyRevocationTxOnChain,
    verifyWalletSignature
};
