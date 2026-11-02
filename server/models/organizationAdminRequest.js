const mongoose = require("mongoose");
const { getLocalDateTime } = require("../dateHelper");

const organizationAdminRequestSchema = new mongoose.Schema({
    orgId: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    organizationName: {
        type: String,
        trim: true,
        default: null
    },
    adminUserId: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    institutionalEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    requesterUserId: {
        type: String,
        trim: true,
        default: null
    },
    walletAddress: {
        type: String,
        trim: true,
        lowercase: true,
        default: null
    },
    passwordHash: {
        type: String,
        default: null
    },
    salt: {
        type: String,
        default: null
    },
    status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending",
        index: true
    },
    requestedAt: {
        type: Date,
        default: getLocalDateTime
    },
    resolvedAt: {
        type: Date,
        default: null
    },
    resolvedBy: {
        type: String,
        trim: true,
        default: null
    },
    rejectionReason: {
        type: String,
        trim: true,
        default: null
    }
});

// Ensure a user has at most one active request record per organization
organizationAdminRequestSchema.index({ orgId: 1, adminUserId: 1 });

module.exports = mongoose.model("OrganizationAdminRequest", organizationAdminRequestSchema);
