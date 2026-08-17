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
    }
});

module.exports = mongoose.model(
    "Certificate",
    certificateSchema
);