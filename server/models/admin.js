const mongoose = require("mongoose");
const { getLocalDateTime } = require("../dateHelper");

const adminSchema = new mongoose.Schema({
    adminUserId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    salt: {
        type: String,
        required: true
    },
    linkedEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: null
    },
    adminAddress: {
        type: String,
        trim: true,
        default: null
    },
    transactionHash: {
        type: String,
        trim: true,
        default: null
    },
    blockchainRegistered: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        default: "admin"
    },
    createdAt: {
        type: Date,
        default: getLocalDateTime
    },
    lastLoginAt: {
        type: Date,
        default: getLocalDateTime
    }
});

module.exports = mongoose.model("Admin", adminSchema);
