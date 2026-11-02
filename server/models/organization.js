const mongoose = require("mongoose");
const { getLocalDateTime } = require("../dateHelper");

const organizationSchema = new mongoose.Schema({
    // Stable application-layer unique ID (e.g. ORG-Stanford-01)
    orgId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },

    // Consistently derived bytes32 hex string used in smart contract operations (0x...)
    orgIdBytes32: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true
    },

    // Display Name (e.g. "Stanford Engineering Registry")
    name: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    // Institutional / Enterprise Entity
    universityOrCompany: {
        type: String,
        required: true,
        trim: true
    },

    // Stated Purpose
    purpose: {
        type: String,
        required: true,
        trim: true
    },

    // Configured member capacity (maximum membership capacity)
    capacity: {
        type: Number,
        required: true,
        min: 1
    },

    // Actual current registered member count
    currentMemberCount: {
        type: Number,
        default: 1,
        min: 1
    },

    // Owner's User ID (Firebase UID or MongoDB User identifier)
    ownerUserId: {
        type: String,
        required: true,
        trim: true,
        index: true
    },

    // Owner's Ethereum wallet address
    ownerWallet: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },

    // Salt and Hash for Organization Access Key (used for membership joining)
    accessKeyHash: {
        type: String,
        required: true
    },

    accessKeySalt: {
        type: String,
        required: true
    },

    // Organization Lifecycle Status
    status: {
        type: String,
        enum: ["Pending Approval", "Approved", "Rejected", "Suspended"],
        default: "Pending Approval",
        index: true
    },

    // Blockchain network & transaction metadata
    blockchainNetwork: {
        type: String,
        enum: ["ganache", "sepolia"],
        required: true
    },

    chainId: {
        type: Number,
        required: true
    },

    contractAddress: {
        type: String,
        required: true,
        trim: true
    },

    requestTxHash: {
        type: String,
        required: true,
        trim: true
    },

    approvalTxHash: {
        type: String,
        trim: true,
        default: null
    },

    rejectionTxHash: {
        type: String,
        trim: true,
        default: null
    },

    createdAt: {
        type: Date,
        default: getLocalDateTime
    },

    approvedAt: {
        type: Date,
        default: null
    },

    rejectedAt: {
        type: Date,
        default: null
    }
});

module.exports = mongoose.model("Organization", organizationSchema);
