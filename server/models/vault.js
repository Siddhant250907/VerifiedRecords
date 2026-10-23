const mongoose = require("mongoose");
const { getLocalDateTime } = require("../dateHelper");

// ============================================================================
// VAULT MODEL — MULTIPLE INDEPENDENT SECURE VAULTS PER USER
// Stores vault entity metadata (name, ownership, creation time).
// Never stores encryption passwords, keys, or plaintext contents.
// ============================================================================

const vaultSchema = new mongoose.Schema(
    {
        vaultId: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        userId: {
            type: String,
            required: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 60
        },
        isDefault: {
            type: Boolean,
            default: false
        },
        createdAt: {
            type: Date,
            default: getLocalDateTime
        }
    },
    {
        timestamps: {
            currentTime: () => getLocalDateTime()
        }
    }
);

// Compound index: a user cannot have two vaults with the exact same name (case-insensitive)
vaultSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model("Vault", vaultSchema);
