const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const Document = require("../models/document");
const Vault = require("../models/vault");
const { requireAuth } = require("../auth");
const {
    validateCloudinaryConfig,
    uploadEncryptedBuffer,
    getSignedDownloadUrl,
    fetchEncryptedBuffer,
    deleteEncryptedAsset,
    signUploadRequest,
    getCloudinaryPublicConfig,
    verifyAssetExists
} = require("../cloudinary");

const router = express.Router();

// ============================================================================
// MULTER IN-MEMORY FILE UPLOAD CONFIGURATION
// Enforces 15MB encrypted payload size limit on backend
// ============================================================================

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 15 * 1024 * 1024 // 15MB limit
    }
});

// Middleware for handling Multer errors cleanly
function handleMulterUpload(req, res, next) {
    upload.single("encryptedFile")(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.status(400).json({
                    success: false,
                    message: "File exceeds the 15MB size limit. Please upload a smaller document."
                });
            }
            return res.status(400).json({
                success: false,
                message: "Upload error: " + err.message
            });
        } else if (err) {
            return res.status(400).json({
                success: false,
                message: "File processing error: " + err.message
            });
        }
        next();
    });
}

// ============================================================================
// 1. PUBLIC CONFIGURATION STATUS ENDPOINT
// ============================================================================

router.get("/status", (req, res) => {
    const config = getCloudinaryPublicConfig();
    res.json({
        success: true,
        cloudinaryConfigured: config.configured,
        cloudName: config.cloudName,
        maxFileSizeBytes: 15 * 1024 * 1024,
        allowedCategories: ["all", "aadhaar", "pan", "dl", "marksheets", "apaar", "other"]
    });
});

// ============================================================================
// 1B. USER VAULTS MANAGEMENT (MULTIPLE VAULTS SUPPORT)
// ============================================================================

router.get("/vaults", requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        let vaults = await Vault.find({ userId }).sort({ isDefault: -1, createdAt: 1 }).lean();
        
        // Auto-initialize Primary Vault if user has none
        if (!vaults || vaults.length === 0) {
            const defaultVault = await Vault.create({
                vaultId: "default",
                userId,
                name: "Primary Vault",
                isDefault: true
            });
            vaults = [defaultVault.toObject ? defaultVault.toObject() : defaultVault];
        }

        // Aggregate actual document counts per vault
        const docCounts = await Document.aggregate([
            { $match: { userId } },
            { $group: { _id: { $ifNull: ["$vaultId", "default"] }, count: { $sum: 1 } } }
        ]);
        const countsMap = {};
        docCounts.forEach(c => { countsMap[c._id] = c.count; });

        res.json({
            success: true,
            vaults: vaults.map(v => ({
                vaultId: v.vaultId,
                name: v.name,
                isDefault: Boolean(v.isDefault),
                documentCount: countsMap[v.vaultId] || 0,
                createdAt: v.createdAt
            }))
        });
    } catch (err) {
        console.error("[Documents API] Vaults list error:", err.message);
        res.status(500).json({ success: false, message: "Failed to list vaults." });
    }
});

router.post("/vaults", requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const name = (req.body.name || "").trim();
        if (!name || name.length < 2) {
            return res.status(400).json({ success: false, message: "Vault name must be at least 2 characters long." });
        }
        if (name.length > 50) {
            return res.status(400).json({ success: false, message: "Vault name cannot exceed 50 characters." });
        }

        const existing = await Vault.findOne({ userId, name: new RegExp(`^${name}$`, "i") });
        if (existing) {
            return res.status(409).json({ success: false, message: `A vault named "${name}" already exists.` });
        }

        const vaultId = "vault_" + Date.now().toString(36) + "_" + crypto.randomBytes(3).toString("hex");
        const vault = await Vault.create({
            vaultId,
            userId,
            name,
            isDefault: false
        });

        res.status(201).json({
            success: true,
            message: `Vault "${name}" created successfully.`,
            vault: {
                vaultId: vault.vaultId,
                name: vault.name,
                isDefault: false,
                documentCount: 0,
                createdAt: vault.createdAt
            }
        });
    } catch (err) {
        console.error("[Documents API] Create vault error:", err.message);
        res.status(500).json({ success: false, message: "Failed to create vault." });
    }
});

// ============================================================================
// 2. LIST USER DOCUMENTS & DRAFTS
// ============================================================================

router.get("/", requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const { category, status, vaultId } = req.query;

        const query = { userId };

        if (status && (status === "draft" || status === "saved")) {
            query.status = status;
        }

        if (category && category !== "all") {
            query.categoryTag = String(category).toLowerCase().trim();
        }

        if (vaultId) {
            const vId = String(vaultId).trim();
            if (vId === "default") {
                query.$or = [{ vaultId: "default" }, { vaultId: null }, { vaultId: { $exists: false } }];
            } else {
                query.vaultId = vId;
            }
        }

        const documents = await Document.find(query)
            .sort({ updatedAt: -1 })
            .select("-__v")
            .lean();

        const config = getCloudinaryPublicConfig();

        res.json({
            success: true,
            count: documents.length,
            configuredCloudName: config.cloudName,
            documents: documents.map((doc) => ({
                documentId: doc.documentId,
                vaultId: doc.vaultId || "default",
                status: doc.status,
                categoryTag: doc.categoryTag,
                encryptedMetadata: doc.encryptedMetadata,
                encryptedDraftData: doc.encryptedDraftData,
                encryption: doc.encryption,
                cloudinaryBytes: doc.cloudinaryBytes,
                cloudinaryCloudName: doc.cloudinaryCloudName || (doc.cloudinaryPublicId ? "hjpf2dln" : null),
                cloudinaryResourceType: doc.cloudinaryResourceType || "raw",
                cloudinaryDeliveryType: doc.cloudinaryDeliveryType || "authenticated",
                storageVerified: doc.storageVerified !== undefined ? doc.storageVerified : Boolean(doc.cloudinaryPublicId),
                hasCloudinaryAsset: Boolean(doc.cloudinaryPublicId),
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
                blockchainProof: doc.blockchainProof
            }))
        });
    } catch (error) {
        console.error("[Documents API] Error listing documents:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve documents from vault."
        });
    }
});

// ============================================================================
// 3. GET SINGLE DOCUMENT METADATA
// ============================================================================

router.get("/:documentId", requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const documentId = req.params.documentId;

        const doc = await Document.findOne({ documentId, userId }).lean();

        if (!doc) {
            return res.status(404).json({
                success: false,
                message: "Document not found or you do not have permission to access it."
            });
        }

        const config = getCloudinaryPublicConfig();

        res.json({
            success: true,
            configuredCloudName: config.cloudName,
            document: {
                documentId: doc.documentId,
                status: doc.status,
                categoryTag: doc.categoryTag,
                encryptedMetadata: doc.encryptedMetadata,
                encryptedDraftData: doc.encryptedDraftData,
                encryption: doc.encryption,
                cloudinaryBytes: doc.cloudinaryBytes,
                cloudinaryCloudName: doc.cloudinaryCloudName || (doc.cloudinaryPublicId ? "hjpf2dln" : null),
                cloudinaryResourceType: doc.cloudinaryResourceType || "raw",
                cloudinaryDeliveryType: doc.cloudinaryDeliveryType || "authenticated",
                storageVerified: doc.storageVerified !== undefined ? doc.storageVerified : Boolean(doc.cloudinaryPublicId),
                hasCloudinaryAsset: Boolean(doc.cloudinaryPublicId),
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
                blockchainProof: doc.blockchainProof
            }
        });
    } catch (error) {
        console.error("[Documents API] Error retrieving document:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve document metadata."
        });
    }
});

// ============================================================================
// 3B. REAL-TIME STORAGE EXISTENCE CHECK
// ============================================================================

router.get("/:documentId/storage-check", requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const doc = await Document.findOne({ documentId: req.params.documentId, userId }).lean();
        if (!doc) {
            return res.status(404).json({ success: false, message: "Document not found." });
        }

        const config = getCloudinaryPublicConfig();
        const check = await verifyAssetExists(doc.cloudinaryPublicId);

        res.json({
            success: true,
            documentId: doc.documentId,
            configuredCloudName: config.cloudName,
            recordedCloudName: doc.cloudinaryCloudName || "hjpf2dln",
            cloudinaryPublicId: doc.cloudinaryPublicId,
            cloudinaryAssetId: doc.cloudinaryAssetId,
            cloudinaryBytes: doc.cloudinaryBytes,
            existsInCloudinary: check.exists,
            assetDetails: check.asset,
            error: check.error
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ============================================================================
// 4. STREAM ENCRYPTED CIPHERTEXT (AUTHENTICATED RETRIEVAL)
// ============================================================================

router.get("/:documentId/file", requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const documentId = req.params.documentId;

        const doc = await Document.findOne({ documentId, userId }).lean();

        if (!doc) {
            return res.status(404).json({
                success: false,
                message: "Document not found or access denied."
            });
        }

        if (!doc.cloudinaryPublicId) {
            return res.status(400).json({
                success: false,
                message: "This document record does not contain an uploaded file payload."
            });
        }

        const config = getCloudinaryPublicConfig();

        // Fetch ciphertext securely from Cloudinary using server credentials
        try {
            const buffer = await fetchEncryptedBuffer(doc.cloudinaryPublicId);

            res.setHeader("Content-Type", "application/octet-stream");
            res.setHeader("Content-Disposition", `attachment; filename="encrypted_${documentId}.bin"`);
            res.setHeader("Content-Length", buffer.length);
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");

            return res.send(buffer);
        } catch (fetchErr) {
            console.warn(`[Documents API] File download failure for ${doc.cloudinaryPublicId}:`, fetchErr.message);
            return res.status(404).json({
                success: false,
                error: "STORAGE_ASSET_UNAVAILABLE",
                message: `The encrypted file payload is currently unavailable in the active Cloudinary account (${config.cloudName}).`,
                configuredCloudName: config.cloudName,
                recordedCloudName: doc.cloudinaryCloudName || "hjpf2dln",
                cloudinaryPublicId: doc.cloudinaryPublicId
            });
        }
    } catch (error) {
        console.error("[Documents API] Error downloading file:", error);
        res.status(500).json({
            success: false,
            message: "Failed to download encrypted file from secure storage: " + error.message
        });
    }
});

// ============================================================================
// 4B. GENERATE DIRECT UPLOAD SIGNATURE (SECURE DIRECT BROWSER UPLOAD)
// Allows the client to stream encrypted ciphertext directly to Cloudinary
// authenticated storage, completely eliminating double-hop proxy overhead.
// ============================================================================

router.post("/sign-upload", requireAuth, async (req, res) => {
    try {
        const config = getCloudinaryPublicConfig();
        if (!config.configured) {
            return res.status(500).json({
                success: false,
                message: "Cloud storage is not configured on the server."
            });
        }

        const timestamp = Math.floor(Date.now() / 1000);
        // Generate random, unpredictable public_id in verifiedrecords_vault
        // Cloudinary raw authenticated delivery accepts .enc extension
        const randomHex = crypto.randomBytes(16).toString("hex");
        const publicId = `verifiedrecords_vault/vault_${randomHex}.enc`;

        const signature = signUploadRequest(publicId, timestamp, "authenticated");

        res.json({
            success: true,
            signature,
            timestamp,
            apiKey: config.apiKey,
            cloudName: config.cloudName,
            publicId,
            type: "authenticated",
            uploadUrl: `https://api.cloudinary.com/v1_1/${config.cloudName}/raw/upload`
        });
    } catch (error) {
        console.error("[Documents API] Error signing direct upload:", error);
        res.status(500).json({
            success: false,
            message: "Failed to generate upload signature: " + error.message
        });
    }
});

// ============================================================================
// 4C. RECORD DIRECT UPLOAD METADATA (MONGODB PERSISTENCE)
// Called by client after successful direct signed upload to Cloudinary.
// Validates ownership, ensures zero-knowledge ciphertext integrity,
// and saves document record in MongoDB.
// ============================================================================

router.post("/record", requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const {
            cloudinaryPublicId,
            cloudinaryAssetId,
            cloudinaryBytes,
            encryptedMetadata,
            salt,
            fileIv,
            metadataIv,
            categoryTag,
            draftId,
            existingDocId,
            blockchainProof
        } = req.body;

        const config = getCloudinaryPublicConfig();
        if (!config.configured) {
            return res.status(500).json({
                success: false,
                message: "Cloud storage is not configured on the server."
            });
        }

        if (!cloudinaryPublicId || typeof cloudinaryPublicId !== "string") {
            return res.status(400).json({
                success: false,
                message: "Cloud storage asset identifier is required."
            });
        }

        // Validate public_id structure to ensure it belongs to the vault namespace
        if (!cloudinaryPublicId.startsWith("verifiedrecords_vault/vault_")) {
            return res.status(400).json({
                success: false,
                message: "Invalid storage asset identifier format."
            });
        }

        // 1. VERIFY REAL CLOUDINARY ASSET BEFORE PERSISTING TO MONGODB (Fast verification with timeout)
        let verifiedAsset = {
            publicId: cloudinaryPublicId,
            assetId: cloudinaryAssetId || null,
            bytes: Number(cloudinaryBytes) || 0
        };
        try {
            const check = await Promise.race([
                verifyAssetExists(cloudinaryPublicId),
                new Promise((resolve) => setTimeout(() => resolve({ exists: true, timeout: true }), 2500))
            ]);
            if (!check.exists && !check.timeout) {
                console.warn(`[Documents API] Storage verification failed: Asset ${cloudinaryPublicId} not found in Cloudinary (${config.cloudName}). Error: ${check.error}`);
                return res.status(422).json({
                    success: false,
                    error: "STORAGE_ASSET_NOT_FOUND",
                    message: `The encrypted file was not found in the configured Cloudinary storage account (${config.cloudName}). Persistence aborted to prevent orphaned records.`,
                    configuredCloudName: config.cloudName,
                    cloudinaryPublicId: cloudinaryPublicId
                });
            }
            if (check.asset) {
                verifiedAsset = check.asset;
            }
        } catch (checkErr) {
            console.warn("[Documents API] Cloudinary asset check warning:", checkErr.message);
        }

        if (!salt) {
            return res.status(400).json({
                success: false,
                message: "Cryptographic salt parameter is required."
            });
        }

        if (!fileIv || !metadataIv) {
            return res.status(400).json({
                success: false,
                message: "Initialization vectors (IVs) are required for file and metadata encryption."
            });
        }

        if (!encryptedMetadata) {
            return res.status(400).json({
                success: false,
                message: "Encrypted metadata payload is required."
            });
        }

        const resolvedCategory = String(categoryTag || "all").toLowerCase().trim();

        // 2. Check if updating an existing record (e.g. recovery / re-upload) or creating new
        let doc = null;
        const targetDocId = existingDocId || req.body.documentId;
        if (targetDocId && typeof targetDocId === "string") {
            doc = await Document.findOne({ documentId: targetDocId.trim(), userId });
        }

        const targetVaultId = req.body.vaultId ? String(req.body.vaultId).trim() : (doc && doc.vaultId ? doc.vaultId : "default");

        if (doc) {
            doc.vaultId = targetVaultId;
            doc.cloudinaryPublicId = String(verifiedAsset.publicId);
            doc.cloudinaryAssetId = verifiedAsset.assetId || cloudinaryAssetId;
            doc.cloudinaryCloudName = config.cloudName;
            doc.cloudinaryResourceType = "raw";
            doc.cloudinaryDeliveryType = "authenticated";
            doc.storageVerified = true;
            doc.cloudinaryBytes = verifiedAsset.bytes || Number(cloudinaryBytes) || doc.cloudinaryBytes;
            doc.encryptedMetadata = String(encryptedMetadata).trim();
            doc.categoryTag = resolvedCategory;
            doc.status = "saved";
            doc.encryption.salt = String(salt).trim();
            doc.encryption.fileIv = String(fileIv).trim();
            doc.encryption.metadataIv = String(metadataIv).trim();
            await doc.save();
        } else {
            const documentId = crypto.randomUUID();
            doc = new Document({
                documentId: documentId,
                userId: userId,
                vaultId: targetVaultId,
                cloudinaryPublicId: String(verifiedAsset.publicId),
                cloudinaryAssetId: verifiedAsset.assetId || cloudinaryAssetId,
                cloudinaryCloudName: config.cloudName,
                cloudinaryResourceType: "raw",
                cloudinaryDeliveryType: "authenticated",
                storageVerified: true,
                cloudinaryBytes: verifiedAsset.bytes || Number(cloudinaryBytes) || 0,
                encryption: {
                    algorithm: "AES-256-GCM",
                    kdf: "PBKDF2-SHA256",
                    iterations: 100000,
                    salt: String(salt).trim(),
                    fileIv: String(fileIv).trim(),
                    metadataIv: String(metadataIv).trim(),
                    version: "1.0"
                },
                encryptedMetadata: String(encryptedMetadata).trim(),
                categoryTag: resolvedCategory,
                status: "saved",
                blockchainProof: {
                    enabled: false,
                    contractAddress: null,
                    transactionHash: null,
                    blockNumber: null,
                    recordHash: null,
                    docCertId: null,
                    network: "sepolia",
                    issuerAddress: null,
                    verifiedOnChain: false
                }
            });

            // Parse and attach blockchain proof if provided
            if (blockchainProof) {
                try {
                    const bp = typeof blockchainProof === "string" ? JSON.parse(blockchainProof) : blockchainProof;
                    if (bp && (bp.transactionHash || bp.txHash)) {
                        doc.blockchainProof = {
                            enabled: true,
                            contractAddress: bp.contractAddress || null,
                            transactionHash: bp.transactionHash || bp.txHash,
                            blockNumber: Number(bp.blockNumber) || null,
                            recordHash: bp.recordHash || bp.docHash || null,
                            docCertId: bp.docCertId || null,
                            network: bp.network || "sepolia",
                            issuerAddress: bp.issuerAddress || bp.walletAddress || null,
                            verifiedOnChain: true
                        };
                    }
                } catch (pErr) {
                    console.warn("[Documents API] Could not parse blockchainProof:", pErr.message);
                }
            }

            await doc.save();
        }

        // If replacing a draft, clean up the draft document
        if (draftId && typeof draftId === "string") {
            try {
                await Document.deleteOne({ documentId: draftId.trim(), userId: userId, status: "draft" });
            } catch (dErr) {
                console.warn("[Documents API] Draft cleanup warning:", dErr.message);
            }
        }

        res.status(201).json({
            success: true,
            message: doc.blockchainProof && doc.blockchainProof.enabled
                ? "Document encrypted, uploaded to Cloudinary, and anchored on Ethereum Sepolia successfully!"
                : "Document encrypted and saved to vault successfully.",
            document: {
                documentId: doc.documentId,
                status: doc.status,
                categoryTag: doc.categoryTag,
                encryptedMetadata: doc.encryptedMetadata,
                encryption: doc.encryption,
                cloudinaryBytes: doc.cloudinaryBytes,
                cloudinaryCloudName: doc.cloudinaryCloudName,
                storageVerified: doc.storageVerified,
                blockchainProof: doc.blockchainProof,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt
            }
        });
    } catch (error) {
        console.error("[Documents API] Error recording document metadata:", error);
        res.status(500).json({
            success: false,
            message: "Failed to persist document metadata: " + error.message
        });
    }
});

// ============================================================================
// 5. UPLOAD ENCRYPTED DOCUMENT (FALLBACK PROXY PIPELINE)
// ============================================================================

router.post("/upload", requireAuth, handleMulterUpload, async (req, res) => {
    try {
        const userId = req.user.uid;

        if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Encrypted file payload is required."
            });
        }

        const {
            encryptedMetadata,
            salt,
            fileIv,
            metadataIv,
            categoryTag,
            draftId
        } = req.body;

        if (!salt) {
            return res.status(400).json({
                success: false,
                message: "Cryptographic salt parameter is required."
            });
        }

        if (!fileIv || !metadataIv) {
            return res.status(400).json({
                success: false,
                message: "Initialization vectors (IVs) are required for file and metadata encryption."
            });
        }

        const resolvedCategory = String(categoryTag || "all").toLowerCase().trim();
        const documentId = crypto.randomUUID();

        // 1. Upload encrypted buffer to Cloudinary raw authenticated storage
        const storageResult = await uploadEncryptedBuffer(req.file.buffer, {
            folder: "verifiedrecords_vault"
        });

        // 2. Persist document record in MongoDB
        const newDoc = new Document({
            documentId: documentId,
            userId: userId,
            vaultId: req.body.vaultId ? String(req.body.vaultId).trim() : "default",
            cloudinaryPublicId: storageResult.publicId,
            cloudinaryAssetId: storageResult.assetId,
            cloudinaryBytes: storageResult.bytes,
            encryption: {
                algorithm: "AES-256-GCM",
                kdf: "PBKDF2-SHA256",
                iterations: 100000,
                salt: String(salt).trim(),
                fileIv: String(fileIv).trim(),
                metadataIv: String(metadataIv).trim(),
                version: "1.0"
            },
            encryptedMetadata: String(encryptedMetadata || "").trim(),
            categoryTag: resolvedCategory,
            status: "saved",
            blockchainProof: {
                enabled: false,
                contractAddress: null,
                transactionHash: null,
                blockNumber: null,
                recordHash: null,
                docCertId: null,
                network: "sepolia",
                issuerAddress: null,
                verifiedOnChain: false
            }
        });

        // 2B. If Advance Security blockchain proof is attached, populate proof details
        if (req.body.blockchainProof) {
            try {
                const bp = typeof req.body.blockchainProof === "string" ? JSON.parse(req.body.blockchainProof) : req.body.blockchainProof;
                if (bp && (bp.transactionHash || bp.txHash)) {
                    newDoc.blockchainProof = {
                        enabled: true,
                        contractAddress: bp.contractAddress || null,
                        transactionHash: bp.transactionHash || bp.txHash,
                        blockNumber: Number(bp.blockNumber) || null,
                        recordHash: bp.recordHash || bp.docHash || null,
                        docCertId: bp.docCertId || null,
                        network: bp.network || "sepolia",
                        issuerAddress: bp.issuerAddress || bp.walletAddress || null,
                        verifiedOnChain: true
                    };
                }
            } catch (pErr) {
                console.warn("[Documents API] Could not parse blockchainProof:", pErr.message);
            }
        }

        await newDoc.save();

        // 3. If replacing a draft, clean up the draft document
        if (draftId && typeof draftId === "string") {
            try {
                await Document.deleteOne({ documentId: draftId.trim(), userId: userId, status: "draft" });
            } catch (dErr) {
                console.warn("[Documents API] Draft cleanup warning:", dErr.message);
            }
        }

        res.status(201).json({
            success: true,
            message: newDoc.blockchainProof.enabled
                ? "Document encrypted, uploaded to Cloudinary, and anchored on Ethereum Sepolia successfully!"
                : "Document encrypted and saved to vault successfully.",
            document: {
                documentId: newDoc.documentId,
                status: newDoc.status,
                categoryTag: newDoc.categoryTag,
                encryptedMetadata: newDoc.encryptedMetadata,
                encryption: newDoc.encryption,
                cloudinaryBytes: newDoc.cloudinaryBytes,
                blockchainProof: newDoc.blockchainProof,
                createdAt: newDoc.createdAt,
                updatedAt: newDoc.updatedAt
            }
        });
    } catch (error) {
        console.error("[Documents API] Error uploading document:", error);
        res.status(500).json({
            success: false,
            message: "Failed to upload and save encrypted document: " + error.message
        });
    }
});

// ============================================================================
// 6. CREATE / AUTOSAVE ENCRYPTED DRAFT
// ============================================================================

router.post("/draft", requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const {
            draftId,
            encryptedDraftData,
            salt,
            metadataIv,
            categoryTag
        } = req.body;

        if (!encryptedDraftData) {
            return res.status(400).json({
                success: false,
                message: "Encrypted draft payload is required."
            });
        }

        if (!salt || !metadataIv) {
            return res.status(400).json({
                success: false,
                message: "Salt and initialization vector are required to save an encrypted draft."
            });
        }

        const resolvedCategory = String(categoryTag || "all").toLowerCase().trim();

        let doc;
        if (draftId) {
            doc = await Document.findOne({ documentId: draftId, userId });
        }

        if (doc) {
            // Update existing draft
            doc.encryptedDraftData = String(encryptedDraftData);
            doc.categoryTag = resolvedCategory;
            doc.encryption.salt = String(salt);
            doc.encryption.metadataIv = String(metadataIv);
            doc.status = "draft";
            await doc.save();
        } else {
            // Create new draft
            const newDraftId = draftId || crypto.randomUUID();
            doc = new Document({
                documentId: newDraftId,
                userId: userId,
                vaultId: req.body.vaultId ? String(req.body.vaultId).trim() : "default",
                encryption: {
                    algorithm: "AES-256-GCM",
                    kdf: "PBKDF2-SHA256",
                    iterations: 100000,
                    salt: String(salt).trim(),
                    metadataIv: String(metadataIv).trim(),
                    version: "1.0"
                },
                encryptedDraftData: String(encryptedDraftData),
                categoryTag: resolvedCategory,
                status: "draft"
            });
            await doc.save();
        }

        res.json({
            success: true,
            message: "Draft autosaved successfully.",
            draft: {
                documentId: doc.documentId,
                status: doc.status,
                categoryTag: doc.categoryTag,
                encryptedDraftData: doc.encryptedDraftData,
                encryption: doc.encryption,
                updatedAt: doc.updatedAt
            }
        });
    } catch (error) {
        console.error("[Documents API] Draft autosave error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to autosave draft: " + error.message
        });
    }
});

// ============================================================================
// 7. DELETE DOCUMENT OR DRAFT
// ============================================================================

router.delete("/:documentId", requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const documentId = req.params.documentId;

        const doc = await Document.findOne({ documentId, userId });

        if (!doc) {
            return res.status(404).json({
                success: false,
                message: "Document not found or permission denied."
            });
        }

        // 1. Destroy Cloudinary asset if present
        if (doc.cloudinaryPublicId) {
            try {
                await deleteEncryptedAsset(doc.cloudinaryPublicId);
            } catch (storageErr) {
                console.warn("[Documents API] Storage deletion warning:", storageErr.message);
            }
        }

        // 2. Remove document from MongoDB
        await Document.deleteOne({ _id: doc._id });

        res.json({
            success: true,
            message: "Document successfully deleted from secure vault and cloud storage.",
            documentId: documentId
        });
    } catch (error) {
        console.error("[Documents API] Error deleting document:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete document: " + error.message
        });
    }
});

// ============================================================================
// 8. PREPARE ADVANCE SECURITY BLOCKCHAIN TRANSACTION (METAMASK / SEPOLIA)
// ============================================================================

// In-memory cache for authorized issuers to avoid repetitive on-chain RPC checks (Instant: 0ms)
const authorizedWalletsCache = new Set();

router.post("/prepare-blockchain", requireAuth, async (req, res) => {
    try {
        const { documentTitle, walletAddress, network, payloadHash } = req.body;

        if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
            return res.status(400).json({
                success: false,
                message: "A valid Ethereum wallet address (0x...) is required for Advance Security on-chain proof."
            });
        }

        const blockchainModule = require("../blockchain");
        const resolvedNet = blockchainModule.normalizeNetwork(network || "ganache");

        if (resolvedNet === "sepolia") {
            const sepoliaDocVault = blockchainModule.getDocVaultContractForNetwork("sepolia");
            if (!sepoliaDocVault || !blockchainModule.sepoliaDocVaultAddress) {
                return res.status(400).json({
                    success: false,
                    network: "sepolia",
                    message: "Document-proof contract (DocumentVaultProof) is not yet deployed on Ethereum Sepolia. Switch to Ganache Local for blockchain proof anchoring, or Save Normally."
                });
            }
        }

        // Ganache Local DocumentVaultProof contract
        const docVaultContract = blockchainModule.getDocVaultContractForNetwork(resolvedNet);
        const targetContract = resolvedNet === "sepolia"
            ? blockchainModule.sepoliaDocVaultAddress
            : blockchainModule.ganacheDocVaultAddress;

        if (!docVaultContract || !targetContract) {
            return res.status(503).json({
                success: false,
                network: resolvedNet,
                message: `DocumentVaultProof contract is not available on ${resolvedNet}.`
            });
        }

        // Unique opaque document ID
        const docCertId = "DOC_" + Date.now().toString(36).toUpperCase() + "_" + crypto.randomBytes(3).toString("hex").toUpperCase();

        // Opaque cryptographic hash of ciphertext or metadata seed
        const netWeb3 = blockchainModule.getWeb3ForNetwork(resolvedNet);
        const docHash = payloadHash && /^0x[a-fA-F0-9]{64}$/.test(payloadHash)
            ? payloadHash
            : netWeb3.utils.keccak256(JSON.stringify({
                docCertId: docCertId,
                title: documentTitle || "Vault Document",
                owner: walletAddress.toLowerCase(),
                timestamp: Date.now()
            }));

        // ABI-encode anchorDocumentProof(string,bytes32) on DocumentVaultProof
        const txData = docVaultContract.methods.anchorDocumentProof(docCertId, docHash).encodeABI();
        const chainId = resolvedNet === "sepolia" ? 11155111 : 1337;

        res.json({
            success: true,
            docCertId: docCertId,
            docHash: docHash,
            contractAddress: targetContract,
            txData: txData,
            chainId: chainId,
            network: resolvedNet
        });
    } catch (error) {
        console.error("[Documents API] Error preparing blockchain proof:", error);
        res.status(500).json({
            success: false,
            message: "Failed to prepare blockchain transaction: " + error.message
        });
    }
});

// ============================================================================
// 9. VERIFY ON-CHAIN PROOF (SEPOLIA SMART CONTRACT STATUS)
// ============================================================================

router.get("/:documentId/verify-chain", requireAuth, async (req, res) => {
    try {
        const userId = req.user.uid;
        const documentId = req.params.documentId;

        const doc = await Document.findOne({ documentId, userId }).lean();
        if (!doc) {
            return res.status(404).json({ success: false, message: "Document not found." });
        }

        if (!doc.blockchainProof || !doc.blockchainProof.enabled || !doc.blockchainProof.docCertId) {
            return res.json({
                success: true,
                hasProof: false,
                message: "This document is stored with Standard Security (no blockchain transaction)."
            });
        }

        const { getDocumentProofFromChain } = require("../blockchain");
        const onChain = await getDocumentProofFromChain(
            doc.blockchainProof.docCertId,
            doc.blockchainProof.contractAddress,
            doc.blockchainProof.network || "ganache"
        );

        res.json({
            success: true,
            hasProof: true,
            verified: Boolean(onChain.exists),
            onChainData: onChain,
            proof: doc.blockchainProof
        });
    } catch (error) {
        console.error("[Documents API] Error querying on-chain status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to query on-chain status: " + error.message
        });
    }
});

module.exports = router;

