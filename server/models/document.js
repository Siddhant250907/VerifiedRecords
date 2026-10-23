const mongoose = require("mongoose");
const { getLocalDateTime } = require("../dateHelper");

// ============================================================================
// DOCUMENT MODEL — SECURE VAULT METADATA REPOSITORY
// Stores client-encrypted document metadata and Cloudinary storage references.
// Never stores vault passwords, plaintext files, or raw personal identities.
// ============================================================================

const documentSchema = new mongoose.Schema(
    {
        // Opaque unique identifier for client & API referencing
        documentId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },

        // Verified Firebase UID of the owner
        userId: {
            type: String,
            required: true,
            index: true
        },

        // Target vault identifier within the user's account (defaults to 'default')
        vaultId: {
            type: String,
            default: "default",
            index: true
        },

        // Cloudinary authenticated raw asset public_id
        cloudinaryPublicId: {
            type: String,
            default: null,
            index: true
        },

        // Cloudinary internal asset_id
        cloudinaryAssetId: {
            type: String,
            default: null
        },

        // Cloudinary cloud_name used during asset ingestion
        cloudinaryCloudName: {
            type: String,
            default: null
        },

        // Resource type: "raw" for encrypted ciphertext payloads
        cloudinaryResourceType: {
            type: String,
            default: "raw"
        },

        // Delivery type: "authenticated" for private zero-knowledge assets
        cloudinaryDeliveryType: {
            type: String,
            default: "authenticated"
        },

        // Whether storage existence has been verified
        storageVerified: {
            type: Boolean,
            default: false
        },

        // Encrypted payload size in bytes
        cloudinaryBytes: {
            type: Number,
            default: 0
        },

        // Cryptographic parameters required for client-side Web Crypto decryption
        encryption: {
            algorithm: {
                type: String,
                default: "AES-256-GCM"
            },
            kdf: {
                type: String,
                default: "PBKDF2-SHA256"
            },
            iterations: {
                type: Number,
                default: 100000
            },
            salt: {
                type: String,
                required: true
            },
            fileIv: {
                type: String,
                default: null
            },
            metadataIv: {
                type: String,
                default: null
            },
            version: {
                type: String,
                default: "1.0"
            }
        },

        // Encrypted ciphertext containing JSON { title, fileName, category, notes, mimeType, fileSize, lastModified }
        encryptedMetadata: {
            type: String,
            default: ""
        },

        // Coarse category tag for indexing and UI tab filtering
        // Valid tags: "all", "aadhaar", "pan", "dl", "marksheets", "apaar", "other"
        categoryTag: {
            type: String,
            default: "all",
            index: true
        },

        // Document lifecycle status: "draft" or "saved"
        status: {
            type: String,
            enum: ["draft", "saved"],
            default: "saved",
            index: true
        },

        // Encrypted draft data (JSON ciphertext) when status is "draft"
        encryptedDraftData: {
            type: String,
            default: null
        },

        // On-chain blockchain proof anchoring for Advance Security mode
        blockchainProof: {
            enabled: {
                type: Boolean,
                default: false
            },
            contractAddress: {
                type: String,
                default: null
            },
            transactionHash: {
                type: String,
                default: null
            },
            blockNumber: {
                type: Number,
                default: null
            },
            recordHash: {
                type: String,
                default: null
            },
            docCertId: {
                type: String,
                default: null
            },
            network: {
                type: String,
                default: "sepolia"
            },
            issuerAddress: {
                type: String,
                default: null
            },
            verifiedOnChain: {
                type: Boolean,
                default: false
            }
        }
    },
    {
        timestamps: {
            currentTime: () => getLocalDateTime()
        }
    }
);

module.exports = mongoose.model("Document", documentSchema);
