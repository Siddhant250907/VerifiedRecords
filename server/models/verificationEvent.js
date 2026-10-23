const mongoose = require("mongoose");
const { getLocalDateTime } = require("../dateHelper");

// ============================================================================
// VERIFICATION EVENT MODEL — OFFICIAL AUDIT & ACTIVITY COUNTER
// Records genuine certificate verification queries without sensitive student identities.
// ============================================================================

const verificationEventSchema = new mongoose.Schema(
    {
        certificateId: {
            type: String,
            required: true,
            index: true
        },
        verified: {
            type: Boolean,
            default: false
        },
        blockchainNetwork: {
            type: String,
            default: null
        },
        clientIpHash: {
            type: String,
            default: null
        },
        timestamp: {
            type: Date,
            default: getLocalDateTime,
            index: true
        }
    },
    {
        timestamps: {
            currentTime: () => getLocalDateTime()
        }
    }
);

module.exports = mongoose.model("VerificationEvent", verificationEventSchema);
