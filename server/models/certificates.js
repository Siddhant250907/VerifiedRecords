const mongoose = require("mongoose");

const certificateSchema = new mongoose.Schema({
    studentName: {
        type: String,
        required: true
    },

    rollNumber: {
        type: String,
        required: true
    },

    course: {
        type: String,
        required: true
    },

    certificateId: {
        type: String,
        required: true,
        unique: true
    },

    issueDate: {
        type: String,
        required: true
    },

    issuedAt: {
        type: Date,
        default: Date.now
    },

    certificateHash: {
        type: String,
        default: null
    },

    transactionHash: {
        type: String,
        default: null
    },

    contractAddress: {
        type: String,
        default: null
    },

    blockchainIssuer: {
        type: String,
        default: null
    },

    blockchainIssuedAt: {
        type: Number,
        default: null
    },

    blockNumber: {
        type: Number,
        default: null
    }
});

module.exports = mongoose.model(
    "Certificate",
    certificateSchema
);