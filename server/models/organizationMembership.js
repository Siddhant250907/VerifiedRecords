const mongoose = require("mongoose");
const { getLocalDateTime } = require("../dateHelper");

const organizationMembershipSchema = new mongoose.Schema({
    // Associated Organization ID
    orgId: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    // User identifier (Firebase UID or MongoDB User ID)
    userId: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    userEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: null
    },

    // Verified wallet address associated with this membership
    walletAddress: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
        index: true
    },

    // Role within the organization
    // "owner": The creator/owner of the organization
    // "admin": An authorized administrator/issuer
    // "member": Regular member (cannot issue certificates)
    role: {
        type: String,
        enum: ["owner", "admin", "member"],
        default: "member",
        index: true
    },

    // Whether this member is explicitly authorized on-chain to issue/revoke certificates
    isAuthorizedIssuer: {
        type: Boolean,
        default: false,
        index: true
    },

    // Membership lifecycle:
    // "active": Confirmed member
    // "pending": Requested to join or nominated
    // "rejected": Membership denied
    // "suspended": Temporarily suspended
    status: {
        type: String,
        enum: ["active", "pending", "rejected", "suspended"],
        default: "pending",
        index: true
    },

    // Whether this role is registered/confirmed on the blockchain
    blockchainRegistered: {
        type: Boolean,
        default: false
    },

    blockchainTxHash: {
        type: String,
        trim: true,
        default: null
    },

    joinedAt: {
        type: Date,
        default: getLocalDateTime
    },

    updatedAt: {
        type: Date,
        default: getLocalDateTime
    }
});

// Compound unique index ensuring a user can have at most one membership record per organization
organizationMembershipSchema.index({ orgId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("OrganizationMembership", organizationMembershipSchema);
