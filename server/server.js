const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const dns = require("dns");
require("dotenv").config();

// Ensure reliable DNS resolution for MongoDB Atlas SRV records
try {
    dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
    if (typeof dns.setDefaultResultOrder === "function") {
        dns.setDefaultResultOrder("ipv4first");
    }
} catch (e) {
    // Fallback to system default if custom servers cannot be set
}

const crypto = require("crypto");
const Certificate = require("./models/certificates");
const User = require("./models/user");
const Admin = require("./models/admin");
const Document = require("./models/document");
const Vault = require("./models/vault");
const VerificationEvent = require("./models/verificationEvent");
const { getLocalDateTime } = require("./dateHelper");
const { getAuth } = require("./auth");
const {
    checkBlockchainStatus,
    getCertificateFromChain,
    generateCertificateHash,
    encodeIssueCertificate,
    registerCertificateOnChain,
    verifyTransactionOnChain,
    encodeRegisterAdmin,
    getAdminFromChain,
    registerAdminOnChain,
    verifyAdminTransactionOnChain,
    normalizeNetwork,
    getWeb3ForNetwork,
    getContractForNetwork,
    getDocVaultContractForNetwork,
    contractAddress,
    sepoliaContractAddress,
    ganacheContractAddress,
    getBlockchainConfig,
    getContractOwner,
    isContractOwner,
    isAuthorizedIssuer,
    activeNetwork,
    chainId,
    isSepolia
} = require("./blockchain");

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return { salt, passwordHash };
}

function verifyPassword(password, salt, passwordHash) {
    if (!password || !salt || !passwordHash) return false;
    const computedHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return computedHash === passwordHash;
}

const app = express();


// ==================================================
// MIDDLEWARE
// ==================================================

app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));



// ==================================================
// SERVE FRONTEND
// ==================================================

app.use(
    express.static(
        path.join(__dirname, "..", "docs")
    )
);


// ==================================================
// PORT
// ==================================================

const PORT = process.env.PORT || 3000;


// ==================================================
// MONGODB CONNECTION
// ==================================================

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {

    console.error("❌ MONGODB_URI is missing from .env");

} else {

    mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000
    })
    .then(() => {

        console.log("=================================");
        console.log("✅ MongoDB Connected Successfully");
        console.log("Database:", mongoose.connection.name);
        console.log("=================================");

    })
    .catch((error) => {

        console.error("=================================");
        console.error("❌ MongoDB Connection Failed");
        console.error(error.message);
        console.error("=================================");

    });

}


// ==================================================
// HOME
// ==================================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "docs", "index.html"));
});

app.get(["/documents", "/documents.html"], (req, res) => {
    res.sendFile(path.join(__dirname, "..", "docs", "documents.html"));
});

// Document Vault API routes
app.use("/api/documents", require("./routes/documents"));


// ==================================================
// TEST API
// ==================================================

app.get("/api/test", (req, res) => {

    res.json({

        success: true,

        message:
            "Backend Connected Successfully!"

    });

});


// ==================================================
// AUTHENTICATION & USER SYNCHRONIZATION (MONGODB)
// ==================================================

// Resolve email or username identifier
app.get("/api/auth/resolve-identifier", async (req, res) => {
    try {
        const identifier = (req.query.identifier || "").trim();
        if (!identifier) {
            return res.status(400).json({ success: false, message: "Identifier is required." });
        }

        // If identifier has '@', treat as email
        if (identifier.includes("@")) {
            const normalizedEmail = identifier.toLowerCase();
            const user = await User.findOne({ email: normalizedEmail });
            return res.json({
                success: true,
                email: normalizedEmail,
                username: user ? user.username : null,
                exists: !!user
            });
        }

        // Otherwise resolve by username
        const normalizedUsername = identifier.toLowerCase();
        const user = await User.findOne({ username: normalizedUsername });
        if (!user || !user.email) {
            return res.status(404).json({
                success: false,
                message: `No registered account found with username "${identifier}".`
            });
        }

        return res.json({
            success: true,
            email: user.email,
            username: user.username,
            exists: true
        });
    } catch (err) {
        console.error("[Auth] Resolve identifier error:", err);
        return res.status(500).json({ success: false, message: "Error resolving user identifier." });
    }
});

// User synchronization & Profile registration in MongoDB
app.post("/api/auth/sync-user", async (req, res) => {
    try {
        const { email, uid, provider, firstName, lastName, username, dateOfBirth, phoneNumber } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required to sync user." });
        }

        const normalizedEmail = String(email).trim().toLowerCase();
        const localNow = getLocalDateTime();

        let verifiedPhone = null;
        let isPhoneVerified = false;

        // Verify Firebase ID Token if provided in Authorization header
        const authHeader = req.headers.authorization || "";
        if (authHeader.startsWith("Bearer ")) {
            const idToken = authHeader.split("Bearer ")[1].trim();
            if (idToken) {
                try {
                    const authAdmin = getAuth();
                    const decoded = await authAdmin.verifyIdToken(idToken);
                    if (decoded && decoded.uid) {
                        if (decoded.email && decoded.email.toLowerCase() !== normalizedEmail) {
                            return res.status(403).json({ success: false, message: "Token identity does not match email." });
                        }
                        if (decoded.phone_number) {
                            verifiedPhone = decoded.phone_number;
                            isPhoneVerified = true;
                        }
                    }
                } catch (tokenErr) {
                    console.warn("[Auth] Token verification note:", tokenErr.message);
                }
            }
        }

        // Check if username is provided and taken by a different account
        let normalizedUsername = null;
        if (username && typeof username === "string") {
            normalizedUsername = username.trim().toLowerCase();
            const existingWithUsername = await User.findOne({
                username: normalizedUsername,
                email: { $ne: normalizedEmail }
            });
            if (existingWithUsername) {
                return res.status(409).json({
                    success: false,
                    message: `Username "${username}" is already taken. Please choose another.`
                });
            }
        }

        const updateFields = {
            email: normalizedEmail,
            uid: uid ? String(uid).trim() : null,
            provider: provider ? String(provider).trim() : "password",
            lastLoginAt: localNow
        };

        if (firstName) updateFields.firstName = String(firstName).trim();
        if (lastName) updateFields.lastName = String(lastName).trim();
        if (normalizedUsername) updateFields.username = normalizedUsername;
        if (dateOfBirth) updateFields.dateOfBirth = String(dateOfBirth).trim();
        if (verifiedPhone) {
            updateFields.phoneNumber = verifiedPhone;
            updateFields.phoneVerified = true;
        } else if (phoneNumber) {
            updateFields.phoneNumber = String(phoneNumber).trim();
            if (isPhoneVerified) updateFields.phoneVerified = true;
        }

        const user = await User.findOneAndUpdate(
            { email: normalizedEmail },
            {
                $set: updateFields,
                $setOnInsert: {
                    createdAt: localNow,
                    role: "user"
                }
            },
            { upsert: true, returnDocument: 'after' }
        );

        // Ensure default Primary Vault exists for authenticated user
        if (user.uid) {
            try {
                await Vault.findOneAndUpdate(
                    { userId: user.uid, vaultId: "default" },
                    {
                        $setOnInsert: {
                            userId: user.uid,
                            vaultId: "default",
                            name: "Primary Vault",
                            isDefault: true,
                            createdAt: localNow
                        }
                    },
                    { upsert: true }
                );
            } catch (vErr) {
                console.warn("[Auth] Default vault sync notice:", vErr.message);
            }
        }

        res.json({
            success: true,
            message: "User account saved in MongoDB.",
            user: {
                email: user.email,
                uid: user.uid,
                role: user.role,
                username: user.username || null,
                firstName: user.firstName || null,
                lastName: user.lastName || null,
                phoneNumber: user.phoneNumber || null,
                phoneVerified: user.phoneVerified || false,
                lastLoginAt: user.lastLoginAt
            }
        });
    } catch (error) {
        console.error("User sync error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to sync user with database.",
            error: error.message
        });
    }
});

// Check username availability
app.get("/api/auth/check-username", async (req, res) => {
    try {
        const username = (req.query.username || "").trim().toLowerCase();
        if (!username || username.length < 3) {
            return res.json({ available: false, message: "Username must be at least 3 characters." });
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(username)) {
            return res.json({ available: false, message: "Username can only contain letters, numbers, underscores, and hyphens." });
        }
        const existing = await User.findOne({ username });
        res.json({ available: !existing });
    } catch (e) {
        res.status(500).json({ available: false, error: e.message });
    }
});

// ==================================================
// USER DASHBOARD & PROFILE DATA ENDPOINT
// ==================================================
app.get("/api/user/profile", async (req, res) => {
    try {
        const email = (req.query.email || "").trim().toLowerCase();
        const uid = (req.query.uid || "").trim();

        let user = null;
        if (email) {
            user = await User.findOne({ email }).lean();
        } else if (uid) {
            user = await User.findOne({ uid }).lean();
        }

        const effectiveUid = (user && user.uid) || uid;
        let vaultsCount = 1;
        let docsCount = 0;

        if (effectiveUid) {
            try {
                const [vCount, dCount] = await Promise.all([
                    Vault.countDocuments({ userId: effectiveUid }),
                    Document.countDocuments({ userId: effectiveUid })
                ]);
                vaultsCount = Math.max(1, vCount);
                docsCount = dCount;
            } catch (cntErr) {
                console.warn("[Profile stats count notice]", cntErr.message);
            }
        }

        // Return rich details for user dashboard
        res.json({
            success: true,
            profile: {
                firstName: (user && user.firstName) || "",
                lastName: (user && user.lastName) || "",
                fullName: (user && user.firstName && user.lastName) ? `${user.firstName} ${user.lastName}` : (user && (user.firstName || user.username || user.email)) || "Verified Citizen",
                username: (user && user.username) || (user && user.email ? user.email.split("@")[0] : "user"),
                email: (user && user.email) || email || "Not specified",
                phoneNumber: (user && user.phoneNumber) || "Not registered",
                dateOfBirth: (user && user.dateOfBirth) || "Not specified",
                provider: (user && user.provider) || "password",
                role: (user && user.role) || "Verified Citizen",
                createdAt: (user && user.createdAt) || new Date(),
                organization: "VerifiedRecords Academic Alliance",
                stats: {
                    vaultsCreated: vaultsCount,
                    certificatesVerified: Math.max(1, docsCount),
                    issuedCertificatesCount: user && user.role === "admin" ? 12 : 0,
                    organizationJoined: "VerifiedRecords Academic Alliance"
                }
            }
        });
    } catch (err) {
        console.error("[User profile error]", err);
        res.status(500).json({ success: false, message: "Failed to fetch user profile." });
    }
});

// ==================================================
// HEALTH CHECK
// ==================================================
app.get("/api/health", (req, res) => {
    res.json({
        status: "healthy",
        uptime: process.uptime(),
        timestamp: getLocalDateTime()
    });
});

// ==================================================
// REAL PUBLIC WEBSITE STATISTICS
// ==================================================

app.get("/api/stats/public", async (req, res) => {
    try {
        const [usersCount, orgsCount, verificationsCount, vaultsCount, docOwnersCount] = await Promise.all([
            User.countDocuments().catch(() => 0),
            Admin.countDocuments().catch(() => 0),
            VerificationEvent.countDocuments().catch(() => 0),
            Vault.countDocuments().catch(() => 0),
            Document.distinct("userId").then(arr => arr.length).catch(() => 0)
        ]);

        // Real counts directly from database
        const totalVaults = Math.max(vaultsCount, docOwnersCount);

        res.json({
            success: true,
            stats: {
                users: usersCount,
                organizations: orgsCount,
                verifications: verificationsCount,
                vaults: totalVaults
            }
        });
    } catch (error) {
        console.error("[Stats API] Error retrieving public statistics:", error);
        res.status(500).json({
            success: false,
            message: "Statistics temporarily unavailable."
        });
    }
});


// ==================================================
// ADMIN REGISTRATION & AUTHENTICATION (MONGODB + BLOCKCHAIN)
// ==================================================

// 1A. PREPARE ADMIN REGISTRATION FOR BLOCKCHAIN
app.post("/api/admin/prepare-register", async (req, res) => {
    try {
        const { adminUserId, password, adminAddress } = req.body;

        if (!adminUserId || !password) {
            return res.status(400).json({
                success: false,
                message: "Admin USER ID and Password (PWD) are required."
            });
        }

        const trimmedUserId = String(adminUserId).trim();
        if (trimmedUserId.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Admin USER ID must be at least 3 characters long."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Admin Password must be at least 6 characters long."
            });
        }

        // Check if adminUserId already exists in MongoDB
        const existingMongo = await Admin.findOne({
            adminUserId: new RegExp(`^${trimmedUserId}$`, "i")
        });

        if (existingMongo) {
            return res.status(409).json({
                success: false,
                message: `Admin USER ID "${trimmedUserId}" is already registered. Please sign in instead.`
            });
        }

        // Fetch authoritative contract owner
        const contractOwner = await getContractOwner();

        // Check if adminAddress was provided
        if (adminAddress) {
            const isAlreadyAuthorized = await isAuthorizedIssuer(adminAddress);
            const isOwner = contractOwner && contractOwner.toLowerCase() === adminAddress.toLowerCase();

            // If the wallet is already an authorized admin or owner on-chain
            if (isAlreadyAuthorized || isOwner) {
                return res.json({
                    success: true,
                    alreadyOnChain: true,
                    isOwner: Boolean(isOwner),
                    adminUserId: trimmedUserId,
                    adminAddress: adminAddress,
                    contractAddress: contractAddress,
                    contractOwner: contractOwner,
                    message: "This wallet is already an authorized administrator or owner on the smart contract. Off-chain credentials can be created directly."
                });
            }

            // Check if user ID is already registered on-chain
            try {
                const onChainAdmin = await getAdminFromChain(trimmedUserId);
                if (onChainAdmin.exists) {
                    return res.status(409).json({
                        success: false,
                        message: `Admin USER ID "${trimmedUserId}" is already registered on the blockchain.`
                    });
                }
            } catch (chainErr) {
                console.warn("[Admin Prepare] Could not read on-chain admin status:", chainErr.message);
            }

            // For a new admin address, encode registerAdmin(string, address)
            const txData = encodeRegisterAdmin(trimmedUserId, adminAddress);
            return res.json({
                success: true,
                alreadyOnChain: false,
                isOwner: false,
                adminUserId: trimmedUserId,
                adminAddress: adminAddress,
                contractAddress: contractAddress,
                contractOwner: contractOwner,
                txData: txData
            });
        }

        // Check if already registered on-chain by userId
        try {
            const onChainAdmin = await getAdminFromChain(trimmedUserId);
            if (onChainAdmin.exists) {
                return res.status(409).json({
                    success: false,
                    message: `Admin USER ID "${trimmedUserId}" is already registered on the blockchain.`
                });
            }
        } catch (chainErr) {
            console.warn("[Admin Prepare] Could not read on-chain admin status:", chainErr.message);
        }

        const txData = encodeRegisterAdmin(trimmedUserId);

        res.json({
            success: true,
            alreadyOnChain: false,
            adminUserId: trimmedUserId,
            contractAddress: contractAddress,
            contractOwner: contractOwner,
            txData: txData
        });
    } catch (error) {
        console.error("Prepare admin error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to prepare admin registration for blockchain.",
            error: error.message
        });
    }
});

// 1B. CREATE ADMIN ACCOUNT (BLOCKCHAIN CONFIRMED)
app.post("/api/admin/register", async (req, res) => {
    try {
        const { adminUserId, password, linkedEmail, transactionHash, adminAddress, isExistingOnChainAdmin } = req.body;

        if (!adminUserId || !password) {
            return res.status(400).json({
                success: false,
                message: "Admin USER ID and Password (PWD) are required."
            });
        }

        const trimmedUserId = String(adminUserId).trim();
        if (trimmedUserId.length < 3) {
            return res.status(400).json({
                success: false,
                message: "Admin USER ID must be at least 3 characters long."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Admin Password must be at least 6 characters long."
            });
        }

        // Check if adminUserId already exists in MongoDB
        const existing = await Admin.findOne({
            adminUserId: new RegExp(`^${trimmedUserId}$`, "i")
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: `Admin USER ID "${trimmedUserId}" is already registered. Please sign in instead.`
            });
        }

        // Blockchain Transaction / Authorization Confirmation
        let blockchainRecord;

        if (transactionHash) {
            console.log(`[Admin Blockchain] Verifying client transaction ${transactionHash} for admin "${trimmedUserId}"...`);
            blockchainRecord = await verifyAdminTransactionOnChain(transactionHash, trimmedUserId);
            console.log(`[Admin Blockchain] Confirmed on-chain in block ${blockchainRecord.blockNumber}`);
        } else if (isExistingOnChainAdmin && adminAddress) {
            // Address is already authorized on-chain (e.g. contract owner or pre-authorized issuer)
            const isAuthorized = await isAuthorizedIssuer(adminAddress);
            if (!isAuthorized) {
                return res.status(403).json({
                    success: false,
                    message: "The provided wallet address is not authorized as an administrator on the active smart contract."
                });
            }
            blockchainRecord = {
                adminAddress: adminAddress,
                transactionHash: "ON_CHAIN_PREAUTHORIZED_ISSUER",
                blockNumber: null,
                contractAddress: contractAddress,
                blockchainNetwork: activeNetwork,
                chainId: chainId
            };
            console.log(`[Admin Blockchain] Wallet ${adminAddress} verified as pre-authorized on-chain administrator.`);
        } else if (!isSepolia) {
            console.log(`[Admin Blockchain] Registering admin "${trimmedUserId}" on Ganache via backend account...`);
            blockchainRecord = await registerAdminOnChain(trimmedUserId, adminAddress);
            console.log(`[Admin Blockchain] Confirmed on-chain in block ${blockchainRecord.blockNumber}. Tx: ${blockchainRecord.transactionHash}`);
        } else {
            return res.status(400).json({
                success: false,
                message: "A confirmed blockchain transaction from the contract owner is required to register an administrator on Sepolia."
            });
        }

        if (!blockchainRecord || !blockchainRecord.adminAddress) {
            return res.status(400).json({
                success: false,
                message: "Blockchain authorization was not confirmed on the smart contract. Admin account cannot be created without on-chain verification."
            });
        }

        // Save admin details in MongoDB after blockchain confirmation
        const { salt, passwordHash } = hashPassword(password);
        const localNow = getLocalDateTime();
        const newAdmin = new Admin({
            adminUserId: trimmedUserId,
            passwordHash,
            salt,
            linkedEmail: linkedEmail ? String(linkedEmail).trim().toLowerCase() : null,
            adminAddress: blockchainRecord.adminAddress,
            transactionHash: blockchainRecord.transactionHash,
            blockchainRegistered: true,
            role: "admin",
            createdAt: localNow,
            lastLoginAt: localNow
        });

        await newAdmin.save();
        console.log(`[Admin] New admin registered in MongoDB: ${trimmedUserId} (On-chain status: ${blockchainRecord.transactionHash})`);

        res.status(201).json({
            success: true,
            message: "Admin account confirmed on blockchain and saved in MongoDB!",
            admin: {
                adminUserId: newAdmin.adminUserId,
                linkedEmail: newAdmin.linkedEmail,
                adminAddress: newAdmin.adminAddress,
                transactionHash: newAdmin.transactionHash,
                blockchainRegistered: true,
                role: newAdmin.role,
                createdAt: newAdmin.createdAt
            }
        });
    } catch (error) {
        console.error("Admin registration error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create admin account: " + error.message,
            error: error.message
        });
    }
});

// 2. ADMIN LOGIN (VERIFY ADMIN USER ID & PWD)
app.post("/api/admin/login", async (req, res) => {
    try {
        const { adminUserId, password } = req.body;

        if (!adminUserId || !password) {
            return res.status(400).json({
                success: false,
                message: "Please enter both Admin USER ID and Password (PWD)."
            });
        }

        const trimmedUserId = String(adminUserId).trim();
        const admin = await Admin.findOne({
            adminUserId: new RegExp(`^${trimmedUserId}$`, "i")
        });

        if (!admin) {
            return res.status(404).json({
                success: false,
                message: `Admin USER ID "${trimmedUserId}" not found. Would you like to create an admin account?`
            });
        }

        const isMatch = verifyPassword(password, admin.salt, admin.passwordHash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid password for this Admin USER ID. Please check your credentials."
            });
        }

        admin.lastLoginAt = getLocalDateTime();
        await admin.save();

        console.log(`[Admin] Admin authenticated successfully: ${admin.adminUserId}`);
        res.json({
            success: true,
            message: "Admin verified successfully!",
            admin: {
                adminUserId: admin.adminUserId,
                linkedEmail: admin.linkedEmail,
                role: admin.role,
                lastLoginAt: admin.lastLoginAt
            }
        });
    } catch (error) {
        console.error("Admin login error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to authenticate admin account.",
            error: error.message
        });
    }
});

// 3. ADMIN STATUS CHECK
app.get("/api/admin/status", async (req, res) => {
    try {
        const count = await Admin.countDocuments();
        res.json({
            success: true,
            hasAdmins: count > 0,
            adminCount: count
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


// ==================================================
// BLOCKCHAIN STATUS & CONFIGURATION
// ==================================================

/**
 * Public blockchain network and contract configuration endpoint.
 * Returns only sanitized public metadata (network, chainId, contract address, explorer URL).
 * Never exposes private keys, RPC credentials, or secrets.
 */
app.get("/api/blockchain/config", async (req, res) => {
    try {
        const config = await getBlockchainConfig(req.query.network);
        if (!config.success || !config.contractAddress) {
            return res.status(503).json({
                success: false,
                message: "Blockchain service configuration is invalid or contract address is missing for active network.",
                network: config.network,
                chainId: config.chainId
            });
        }
        res.json(config);
    } catch (error) {
        console.error("[Blockchain Config] Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve blockchain configuration: " + error.message,
            error: error.message
        });
    }
});

/**
 * Checks whether an Ethereum address is an authorized issuer on the active or requested Certificate contract.
 */
app.get("/api/blockchain/is-authorized", async (req, res) => {
    try {
        const address = req.query.address;
        const requestedNet = req.query.network;
        if (!address) {
            return res.status(400).json({ success: false, message: "Ethereum address query parameter is required." });
        }
        const resolvedNet = normalizeNetwork(requestedNet);
        const authorized = await isAuthorizedIssuer(address, resolvedNet);
        const netConfig = await getBlockchainConfig(resolvedNet);
        res.json({
            success: true,
            address: address,
            authorized: Boolean(authorized),
            network: resolvedNet,
            chainId: netConfig.chainId,
            contractAddress: netConfig.contractAddress
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to verify issuer authorization: " + error.message,
            error: error.message
        });
    }
});

/**
 * Checks whether an Ethereum address is the owner of the active or requested Certificate contract.
 */
app.get("/api/blockchain/is-owner", async (req, res) => {
    try {
        const address = req.query.address;
        const requestedNet = req.query.network;
        if (!address) {
            return res.status(400).json({ success: false, message: "Ethereum address query parameter is required." });
        }
        const resolvedNet = normalizeNetwork(requestedNet);
        const isOwner = await isContractOwner(address, resolvedNet);
        const ownerAddress = await getContractOwner(resolvedNet);
        const netConfig = await getBlockchainConfig(resolvedNet);
        res.json({
            success: true,
            address: address,
            isOwner: Boolean(isOwner),
            contractOwner: ownerAddress,
            network: resolvedNet,
            chainId: netConfig.chainId,
            contractAddress: netConfig.contractAddress
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to verify contract ownership: " + error.message,
            error: error.message
        });
    }
});

app.get("/api/blockchain/test", async (req, res) => {
    try {
        const resolvedNet = req.query.network ? normalizeNetwork(req.query.network) : null;
        const status = await checkBlockchainStatus(resolvedNet);
        res.json({
            success: true,
            message: "Blockchain connection test completed.",
            data: status
        });
    } catch (error) {
        console.error("Blockchain test error:", error);
        res.status(500).json({
            success: false,
            message: "Blockchain connection test failed.",
            error: error.message
        });
    }
});


// ==================================================
// PREPARE CERTIFICATE ISSUANCE (FOR METAMASK / CLIENT PRE-CHECK)
// ==================================================

app.post("/api/certificate/prepare", async (req, res) => {
    try {
        const {
            studentName,
            rollNumber,
            course,
            certificateId,
            issueDate,
            certificateType,
            fieldOfCertification,
            network,
            blockchainNetwork
        } = req.body;

        if (
            !studentName ||
            !rollNumber ||
            !course ||
            !certificateId ||
            !issueDate
        ) {
            return res.status(400).json({
                success: false,
                message: "All certificate fields are required."
            });
        }

        const trimmedCertId = String(certificateId).trim();
        const resolvedCertType = String(certificateType || fieldOfCertification || "").trim();
        const resolvedNet = normalizeNetwork(network || blockchainNetwork);

        // 1. Check network availability
        const netConfig = await getBlockchainConfig(resolvedNet);
        if (!netConfig.isAvailable) {
            return res.status(503).json({
                success: false,
                network: resolvedNet,
                message: netConfig.disabledReason || `Network "${resolvedNet}" is currently unavailable.`
            });
        }

        // 2. Check MongoDB uniqueness
        const existingCertificate = await Certificate.findOne({
            certificateId: new RegExp(`^${trimmedCertId}$`, "i")
        });

        if (existingCertificate) {
            return res.status(409).json({
                success: false,
                message: `Certificate ID "${trimmedCertId}" already exists in the institutional registry.`
            });
        }

        // 3. Check Smart Contract on-chain uniqueness for the selected chain
        const onChainCheck = await getCertificateFromChain(trimmedCertId, resolvedNet);
        if (onChainCheck.exists) {
            return res.status(409).json({
                success: false,
                message: `Certificate ID "${trimmedCertId}" is already registered on ${netConfig.label}.`
            });
        }

        // 4. Compute Deterministic Hash & Encoded Call Data for target contract
        const { hash: certificateHash, canonicalPayload } = generateCertificateHash({
            studentName,
            rollNumber,
            course,
            certificateId: trimmedCertId,
            issueDate,
            certificateType: resolvedCertType
        });

        const txData = encodeIssueCertificate(trimmedCertId, certificateHash, resolvedNet);

        res.json({
            success: true,
            certificateId: trimmedCertId,
            certificateType: resolvedCertType || "Certificate of Excellence",
            fieldOfCertification: resolvedCertType || "Certificate of Excellence",
            certificateHash: certificateHash,
            canonicalPayload: canonicalPayload,
            contractAddress: netConfig.contractAddress,
            blockchainNetwork: resolvedNet,
            chainId: netConfig.chainId,
            chainIdHex: netConfig.chainIdHex,
            isSepolia: resolvedNet === "sepolia",
            txData: txData
        });

    } catch (error) {
        console.error("Prepare Certificate Error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to prepare certificate data for blockchain registration: " + error.message,
            error: error.message
        });
    }
});


// ==================================================
// ISSUE CERTIFICATE
// ADMIN
// ==================================================

app.post("/api/certificate", async (req, res) => {

    try {

        const {
            studentName,
            rollNumber,
            course,
            certificateId,
            issueDate,
            certificateType,
            fieldOfCertification,
            adminUserId,
            transactionHash,
            blockchainIssuer,
            network,
            blockchainNetwork
        } = req.body;


        // ------------------------------------------
        // 1. CHECK REQUIRED FIELDS
        // ------------------------------------------

        if (
            !studentName ||
            !rollNumber ||
            !course ||
            !certificateId ||
            !issueDate
        ) {

            return res.status(400).json({
                success: false,
                message: "All certificate fields are required."
            });

        }

        const trimmedCertId = String(certificateId).trim();
        const resolvedCertType = String(certificateType || fieldOfCertification || "").trim();
        const resolvedNet = normalizeNetwork(network || blockchainNetwork);
        const netConfig = await getBlockchainConfig(resolvedNet);

        if (!netConfig.isAvailable) {
            return res.status(503).json({
                success: false,
                network: resolvedNet,
                message: netConfig.disabledReason || `Network "${resolvedNet}" is currently unavailable.`
            });
        }

        console.log("[2] Certificate data received:", {
            studentName: studentName.trim(),
            rollNumber: rollNumber.trim(),
            course: course.trim(),
            certificateType: resolvedCertType,
            certificateId: trimmedCertId,
            issueDate: issueDate.trim(),
            network: resolvedNet,
            clientTxProvided: Boolean(transactionHash)
        });


        // ------------------------------------------
        // 2. COMPUTE DETERMINISTIC HASH
        // ------------------------------------------

        const { hash: certificateHash, canonicalPayload } = generateCertificateHash({
            studentName,
            rollNumber,
            course,
            certificateId: trimmedCertId,
            issueDate,
            certificateType: resolvedCertType
        });

        console.log("[3] Hash generated:", certificateHash);


        // ------------------------------------------
        // 3. CHECK DUPLICATE IN MONGODB
        // ------------------------------------------

        const existingCertificate =
            await Certificate.findOne({
                certificateId: new RegExp(`^${trimmedCertId}$`, "i")
            });

        if (existingCertificate) {

            console.warn(`[Duplicate Check] Certificate ID "${trimmedCertId}" already exists in MongoDB.`);

            return res.status(409).json({
                success: false,
                message: `Certificate ID "${trimmedCertId}" already exists in the institutional registry.`
            });

        }


        // ------------------------------------------
        // 4. CHECK DUPLICATE ON TARGET SMART CONTRACT
        // ------------------------------------------

        const onChainCheck = await getCertificateFromChain(trimmedCertId, resolvedNet);

        // If not using an already submitted txHash, verify it doesn't already exist on-chain
        if (!transactionHash && onChainCheck.exists) {

            console.warn(`[Duplicate Check] Certificate ID "${trimmedCertId}" already exists on ${netConfig.label}.`);

            return res.status(409).json({
                success: false,
                message: `Certificate ID "${trimmedCertId}" is already registered on ${netConfig.label}.`
            });

        }


        // ------------------------------------------
        // 5. BLOCKCHAIN REGISTRATION / VERIFICATION
        // ------------------------------------------

        let blockchainRecord;

        if (transactionHash) {

            console.log(`[4] Blockchain transaction verification starting on [${resolvedNet}] for client tx:`, transactionHash);

            // Client signed via MetaMask and provided txHash for target chain
            blockchainRecord = await verifyTransactionOnChain(
                transactionHash,
                trimmedCertId,
                certificateHash,
                { network: resolvedNet, blockchainIssuer }
            );

            console.log("[5] Blockchain transaction hash verified:", blockchainRecord.transactionHash);
            console.log("[6] Blockchain receipt/status: confirmed on-chain in block", blockchainRecord.blockNumber);

            if (!blockchainRecord.verified) {

                return res.status(400).json({
                    success: false,
                    message: "Blockchain transaction verification failed or record does not match."
                });

            }

        } else {

            console.log(`[4] Direct blockchain transaction starting on [${resolvedNet}]...`);

            blockchainRecord = await registerCertificateOnChain(
                trimmedCertId,
                certificateHash,
                null,
                resolvedNet
            );

            console.log("[5] Blockchain transaction hash:", blockchainRecord.transactionHash);
            console.log("[6] Blockchain receipt/status: confirmed on-chain in block", blockchainRecord.blockNumber);

        }

        // Ensure blockchain transaction succeeded before saving to MongoDB
        if (!blockchainRecord || !blockchainRecord.transactionHash) {
            console.error("[Issuance Failed] No valid blockchain transaction hash confirmed for:", trimmedCertId);
            return res.status(400).json({
                success: false,
                message: "Blockchain transaction was not confirmed. Certificate cannot be recorded without valid on-chain proof."
            });
        }

        // ------------------------------------------
        // 6. SAVE TO MONGODB WITH REAL BLOCKCHAIN METADATA
        // ------------------------------------------

        console.log("[7] MongoDB save starting for certificate:", trimmedCertId);

        const newCertificate = new Certificate({

            studentName:
                String(studentName).trim(),

            rollNumber:
                String(rollNumber).trim(),

            course:
                String(course).trim(),

            certificateId:
                trimmedCertId,

            issueDate:
                String(issueDate).trim(),

            certificateType:
                resolvedCertType || "Certificate of Excellence",

            fieldOfCertification:
                resolvedCertType || "Certificate of Excellence",

            adminUserId:
                adminUserId ? String(adminUserId).trim() : null,

            issuedAt:
                getLocalDateTime(),

            certificateHash:
                certificateHash,

            transactionHash:
                blockchainRecord.transactionHash,

            contractAddress:
                blockchainRecord.contractAddress,

            blockchainIssuer:
                blockchainRecord.issuer || blockchainIssuer || null,

            blockchainIssuedAt:
                blockchainRecord.issuedAt || null,

            blockNumber:
                blockchainRecord.blockNumber || null,

            blockchainNetwork:
                blockchainRecord.blockchainNetwork || resolvedNet,

            chainId:
                blockchainRecord.chainId || netConfig.chainId

        });

        try {
            await newCertificate.save();
            console.log("[8] MongoDB save completed for certificate:", trimmedCertId);
        } catch (saveError) {
            console.error("[CRITICAL] Blockchain transaction confirmed, but MongoDB save failed:", saveError);
            return res.status(500).json({
                success: false,
                reconciliationRequired: true,
                message: "CRITICAL: Blockchain transaction was confirmed on-chain, but saving to the institutional registry failed. DO NOT resubmit the transaction to avoid duplicate fees. Please notify the administrator with your transaction hash for record reconciliation.",
                blockchain: {
                    transactionHash: blockchainRecord.transactionHash,
                    contractAddress: blockchainRecord.contractAddress,
                    blockNumber: blockchainRecord.blockNumber,
                    blockchainNetwork: blockchainRecord.blockchainNetwork || resolvedNet,
                    chainId: blockchainRecord.chainId || netConfig.chainId,
                    issuer: blockchainRecord.issuer || blockchainIssuer || null,
                    issuedAt: blockchainRecord.issuedAt || null
                },
                error: saveError.message
            });
        }


        // ------------------------------------------
        // 7. SEND SUCCESS RESPONSE
        // ------------------------------------------

        console.log("[9] Response sent to frontend for certificate:", trimmedCertId);

        const isSepoliaTx = (blockchainRecord.blockchainNetwork || resolvedNet) === "sepolia";
        const explorerUrl = isSepoliaTx && blockchainRecord.transactionHash
            ? `https://sepolia.etherscan.io/tx/${blockchainRecord.transactionHash}`
            : null;

        res.status(201).json({

            success: true,

            message:
                `Certificate issued and recorded successfully on ${netConfig.label} and institutional repository.`,

            certificate:
                newCertificate,

            blockchain: {
                transactionHash: blockchainRecord.transactionHash,
                contractAddress: blockchainRecord.contractAddress,
                certificateHash: certificateHash,
                issuer: blockchainRecord.issuer || blockchainIssuer || null,
                blockNumber: blockchainRecord.blockNumber || null,
                issuedAt: blockchainRecord.issuedAt || null,
                blockchainNetwork: blockchainRecord.blockchainNetwork || resolvedNet,
                chainId: blockchainRecord.chainId || netConfig.chainId,
                explorerUrl: explorerUrl
            }

        });

    }

    catch (error) {

        console.error(
            "Issue Certificate Error:",
            error
        );

        let friendlyMessage = error.message || "Server error occurred during certificate issuance.";
        let statusCode = 500;

        if (error.message && error.message.includes("Certificate already registered")) {
            friendlyMessage = "Certificate is already registered on the blockchain.";
            statusCode = 409;
        } else if (error.message && error.message.includes("reverted")) {
            friendlyMessage = "Blockchain transaction reverted by smart contract.";
            statusCode = 400;
        } else if (error.message && (
            error.message.includes("verification failed") ||
            error.message.includes("does not match") ||
            error.message.includes("not addressed to") ||
            error.message.includes("not found on blockchain") ||
            error.message.includes("not an authorized")
        )) {
            friendlyMessage = error.message;
            statusCode = 400;
        }

        res.status(statusCode).json({

            success: false,

            message:
                friendlyMessage,

            details:
                error.message

        });

    }

});


// ==================================================
// VERIFY CERTIFICATE (WITH AUDIT & STATS LOGGING)
// ==================================================

const recentVerifications = new Map();
async function recordVerificationAudit(certificateId, verified, network, req) {
    if (!certificateId) return;
    const ip = req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "local";
    const key = `${String(certificateId).trim().toUpperCase()}_${ip}`;
    const now = Date.now();
    if (recentVerifications.has(key) && (now - recentVerifications.get(key) < 5000)) {
        return; // debounce 5s to avoid accidental repeat inflation
    }
    recentVerifications.set(key, now);
    try {
        await VerificationEvent.create({
            certificateId: String(certificateId).trim(),
            verified: Boolean(verified),
            blockchainNetwork: network || null,
            clientIpHash: crypto.createHash("sha256").update(String(ip)).digest("hex").slice(0, 16)
        });
    } catch (e) {
        console.warn("[Verification Audit] Notice:", e.message);
    }
}

app.get(
    "/api/certificate/:certificateId",
    async (req, res) => {

        try {

            const certificateId =
                req.params.certificateId;


            // --------------------------------------
            // SEARCH MONGODB
            // --------------------------------------

            const certificate =
                await Certificate.findOne({

                    certificateId:
                        new RegExp(
                            `^${certificateId}$`,
                            "i"
                        )

                });


            // --------------------------------------
            // CERTIFICATE NOT FOUND IN MONGODB
            // --------------------------------------

            if (!certificate) {
                await recordVerificationAudit(certificateId, false, null, req);
                return res.status(404).json({

                    success: false,

                    verified: false,

                    message:
                        "Certificate not found in the institutional registry."

                });

            }

            // --------------------------------------
            // VERIFY STUDENT NAME IF PROVIDED
            // --------------------------------------

            const requestedName = (req.query.name || req.query.studentName || "").trim();
            if (requestedName) {
                const normReq = requestedName.toLowerCase().replace(/\s+/g, " ");
                const normCert = (certificate.studentName || "").toLowerCase().replace(/\s+/g, " ");
                if (normReq !== normCert) {
                    return res.status(404).json({
                        success: false,
                        verified: false,
                        message: "The provided User Name and Certificate ID combination does not match our records.",
                        certificateId: certificate.certificateId
                    });
                }
            }


            // --------------------------------------
            // GENERATE DETERMINISTIC CERTIFICATE HASH
            // --------------------------------------

            let { hash: computedHash } = generateCertificateHash(certificate);


            // --------------------------------------
            // CHECK SMART CONTRACT ON-CHAIN (READ-ONLY)
            // --------------------------------------

            let chainRecord = null;

            try {

                chainRecord = await getCertificateFromChain(
                    certificate.certificateId,
                    certificate.contractAddress,
                    certificate.blockchainNetwork
                );

            } catch (chainErr) {

                console.error("[Blockchain Verification] Read failed:", chainErr.message);

                return res.status(502).json({

                    success: false,

                    verified: false,

                    message:
                        "Unable to read verification proof from the blockchain network."

                });

            }

            // Historical/Local Ganache Proof Check:
            // If the certificate was registered on local Ganache and this hosted environment cannot reach it:
            if (chainRecord && chainRecord.localProofOnly) {
                const certObj = certificate.toObject ? certificate.toObject() : { ...certificate };
                certObj.certificateType = certObj.certificateType || certObj.fieldOfCertification || "Certificate of Excellence";
                certObj.fieldOfCertification = certObj.fieldOfCertification || certObj.certificateType;

                return res.status(200).json({
                    success: true,
                    verified: false,
                    localProofOnly: true,
                    message: "This certificate was registered on a local Ganache development blockchain. Live on-chain verification is unavailable from this hosted environment.",
                    certificate: certObj,
                    blockchain: {
                        status: "LocalProofOnly",
                        existsOnChain: false,
                        blockchainNetwork: "local",
                        chainId: 1337,
                        transactionHash: certificate.transactionHash,
                        contractAddress: certificate.contractAddress,
                        blockNumber: certificate.blockNumber || null,
                        issuer: certificate.blockchainIssuer || null,
                        issuedAt: certificate.blockchainIssuedAt || null,
                        explorerUrl: null
                    }
                });
            }


            // --------------------------------------
            // VALIDATE ON-CHAIN EXISTENCE & HASH MATCH
            // --------------------------------------

            if (!chainRecord || !chainRecord.exists) {

                console.warn(`[Verification Failed] Certificate ${certificate.certificateId} not found on-chain.`);

                return res.status(404).json({

                    success: false,

                    verified: false,

                    message:
                        "Certificate record does not exist on the blockchain registry.",

                    certificateId: certificate.certificateId

                });

            }

            let hashMatches =
                chainRecord.certificateHash &&
                chainRecord.certificateHash.toLowerCase() === computedHash.toLowerCase();

            // Backward compatibility fallback: if hash mismatch occurs, test without certificateType (for legacy on-chain records)
            if (!hashMatches && (certificate.certificateType || certificate.fieldOfCertification)) {
                const legacyRes = generateCertificateHash({
                    studentName: certificate.studentName,
                    rollNumber: certificate.rollNumber,
                    course: certificate.course,
                    certificateId: certificate.certificateId,
                    issueDate: certificate.issueDate
                });
                if (chainRecord.certificateHash && chainRecord.certificateHash.toLowerCase() === legacyRes.hash.toLowerCase()) {
                    hashMatches = true;
                    computedHash = legacyRes.hash;
                }
            }

            if (!hashMatches) {

                console.warn(`[Verification Failed] Hash mismatch for ${certificate.certificateId}. Chain: ${chainRecord.certificateHash}, Computed: ${computedHash}`);

                return res.status(400).json({

                    success: false,

                    verified: false,

                    message:
                        "Cryptographic hash mismatch. Certificate data has been altered or does not match the blockchain record.",

                    certificateId: certificate.certificateId

                });

            }


            // --------------------------------------
            // CERTIFICATE VERIFIED (MATCH CONFIRMED)
            // --------------------------------------

            const originalTxHash = certificate.transactionHash || null;
            const issuerAddress = chainRecord.issuer || certificate.blockchainIssuer || null;
            const blockchainTimestamp = Number(chainRecord.issuedAt || certificate.blockchainIssuedAt || 0);
            const resolvedContract = chainRecord.contractAddress || certificate.contractAddress || contractAddress || null;
            const certNetwork = chainRecord.blockchainNetwork || certificate.blockchainNetwork || activeNetwork;
            const certChainId = chainRecord.chainId || certificate.chainId || chainId;
            const isSepoliaRecord = certNetwork === "sepolia" ||
                (resolvedContract && sepoliaContractAddress && resolvedContract.toLowerCase() === sepoliaContractAddress.toLowerCase());

            const certObj = certificate.toObject ? certificate.toObject() : { ...certificate };
            certObj.certificateType = certObj.certificateType || certObj.fieldOfCertification || "Certificate of Excellence";
            certObj.fieldOfCertification = certObj.fieldOfCertification || certObj.certificateType;

            const explorerUrl = isSepoliaRecord && originalTxHash
                ? `https://sepolia.etherscan.io/tx/${originalTxHash}`
                : null;

            await recordVerificationAudit(certificate.certificateId, true, certNetwork, req);

            res.json({

                success: true,

                verified: true,

                message:
                    "Certificate verified successfully against blockchain and institutional records.",

                certificate:
                    certObj,

                blockchain: {
                    status: "Verified",
                    existsOnChain: true,
                    hashMatches: true,
                    certificateHash: chainRecord.certificateHash,
                    computedHash: computedHash,
                    issuer: issuerAddress,
                    issuedAt: blockchainTimestamp,
                    transactionHash: originalTxHash,
                    contractAddress: resolvedContract,
                    blockNumber: certificate.blockNumber || null,
                    blockchainNetwork: certNetwork,
                    chainId: certChainId,
                    explorerUrl: explorerUrl
                }

            });

        }

        catch (error) {

            console.error(
                "Verify Certificate Error:",
                error
            );


            res.status(500).json({

                success: false,

                verified: false,

                message:
                    "Server error during certificate verification."

            });

        }

    }
);


// ==================================================
// START SERVER
// ==================================================

const server = app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `VerifiedRecords running on port ${PORT}`
    );

});

// Extend server timeouts to 5 minutes to support large encrypted document uploads
server.setTimeout(300000);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;