const mongoose = require("mongoose");
const { getLocalDateTime } = require("../dateHelper");

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    uid: {
        type: String,
        sparse: true,
        trim: true,
        default: null
    },
    provider: {
        type: String,
        default: "password"
    },
    firstName: {
        type: String,
        trim: true,
        default: null
    },
    lastName: {
        type: String,
        trim: true,
        default: null
    },
    username: {
        type: String,
        sparse: true,
        unique: true,
        trim: true,
        lowercase: true,
        default: null
    },
    dateOfBirth: {
        type: String,
        default: null
    },
    phoneNumber: {
        type: String,
        trim: true,
        default: null
    },
    phoneVerified: {
        type: Boolean,
        default: false
    },
    role: {
        type: String,
        default: "user"
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

module.exports = mongoose.model("User", userSchema);
