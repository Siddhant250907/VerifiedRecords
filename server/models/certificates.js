const mongoose = require("mongoose");
const { getLocalDateTime } = require("../dateHelper");

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

    certificateType: {
        type: String,
        required: false,
        default: "Certificate of Excellence"
    },

    fieldOfCertification: {
        type: String,
        required: false,
        default: null
    },

    issuedAt: {
        type: Date,
        default: getLocalDateTime
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
    },

    adminUserId: {
        type: String,
        required: false,
        default: null
    },

    blockchainNetwork: {
        type: String,
        required: false,
        default: null
    },

    chainId: {
        type: Number,
        required: false,
        default: null
    }
});

module.exports = mongoose.model(
    "Certificate",
    certificateSchema
);