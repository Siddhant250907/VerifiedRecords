// ============================================================================
// VERIFIEDRECORDS — SECURE VAULT CLIENT-SIDE CRYPTOGRAPHY ENGINE
// AES-256-GCM with PBKDF2-SHA-256 Key Derivation using Web Crypto API.
// All encryption & decryption executes strictly in browser memory.
// Vault passwords and raw plaintext keys NEVER leave the client.
// ============================================================================

(function (window) {
    "use strict";

    const PBKDF2_ITERATIONS = 100000;
    const KEY_LENGTH_BITS = 256;
    const SALT_LENGTH_BYTES = 16;
    const IV_LENGTH_BYTES = 12; // Standard recommended IV length for AES-GCM

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();

    // ------------------------------------------------------------------------
    // BINARY <-> STRING UTILITIES (HEX & BASE64)
    // ------------------------------------------------------------------------

    function bufferToHex(buffer) {
        const bytes = new Uint8Array(buffer);
        let hex = "";
        for (let i = 0; i < bytes.length; i++) {
            hex += bytes[i].toString(16).padStart(2, "0");
        }
        return hex;
    }

    function hexToUint8Array(hexString) {
        if (!hexString || typeof hexString !== "string") {
            throw new Error("Invalid hex string.");
        }
        const clean = hexString.replace(/^0x/i, "").trim();
        if (clean.length % 2 !== 0) {
            throw new Error("Invalid hex string length.");
        }
        const bytes = new Uint8Array(clean.length / 2);
        for (let i = 0; i < clean.length; i += 2) {
            bytes[i / 2] = parseInt(clean.substr(i, 2), 16);
        }
        return bytes;
    }

    function bufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }

    function base64ToUint8Array(base64String) {
        if (!base64String || typeof base64String !== "string") {
            throw new Error("Invalid base64 string.");
        }
        const binary = window.atob(base64String);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    // ------------------------------------------------------------------------
    // RANDOM GENERATORS (CRYPTOGRAPHICALLY SECURE)
    // ------------------------------------------------------------------------

    function generateSalt(length = SALT_LENGTH_BYTES) {
        const salt = new Uint8Array(length);
        window.crypto.getRandomValues(salt);
        return salt;
    }

    function generateIv(length = IV_LENGTH_BYTES) {
        const iv = new Uint8Array(length);
        window.crypto.getRandomValues(iv);
        return iv;
    }

    // ------------------------------------------------------------------------
    // KEY DERIVATION (PBKDF2-SHA-256)
    // ------------------------------------------------------------------------

    /**
     * Derives an AES-GCM 256-bit CryptoKey from a plaintext password and salt.
     * The derived key is held only in memory and cannot be exported.
     *
     * @param {string} password Vault password
     * @param {Uint8Array} salt Cryptographic salt
     * @param {number} [iterations=100000] PBKDF2 iteration count
     * @returns {Promise<CryptoKey>}
     */
    async function deriveKey(password, salt, iterations = PBKDF2_ITERATIONS) {
        if (!password || typeof password !== "string") {
            throw new Error("Vault password is required.");
        }
        if (!salt || !(salt instanceof Uint8Array)) {
            throw new Error("Valid salt is required.");
        }

        const passwordBuffer = textEncoder.encode(password);

        // Import raw password as key material for PBKDF2
        const baseKey = await window.crypto.subtle.importKey(
            "raw",
            passwordBuffer,
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );

        // Derive AES-GCM 256 key
        return await window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: salt,
                iterations: iterations,
                hash: "SHA-256"
            },
            baseKey,
            {
                name: "AES-GCM",
                length: KEY_LENGTH_BITS
            },
            false, // Non-extractable for memory security
            ["encrypt", "decrypt"]
        );
    }

    // ------------------------------------------------------------------------
    // ENCRYPTION & DECRYPTION (AES-256-GCM)
    // ------------------------------------------------------------------------

    /**
     * Encrypts a binary buffer or string using AES-256-GCM.
     *
     * @param {CryptoKey} key Derived AES-GCM key
     * @param {ArrayBuffer|Uint8Array} plaintextBuffer Data to encrypt
     * @param {Uint8Array} iv 12-byte initialization vector
     * @returns {Promise<ArrayBuffer>} Ciphertext with GCM auth tag
     */
    async function encryptBuffer(key, plaintextBuffer, iv) {
        if (!key) throw new Error("Encryption key is required.");
        if (!iv || iv.length !== IV_LENGTH_BYTES) throw new Error("Valid 12-byte IV is required.");

        return await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            plaintextBuffer
        );
    }

    /**
     * Decrypts an AES-256-GCM ciphertext buffer.
     * Rejects automatically if the authentication tag or key is invalid (wrong password).
     *
     * @param {CryptoKey} key Derived AES-GCM key
     * @param {ArrayBuffer|Uint8Array} ciphertextBuffer Encrypted data
     * @param {Uint8Array} iv 12-byte initialization vector
     * @returns {Promise<ArrayBuffer>} Plaintext buffer
     */
    async function decryptBuffer(key, ciphertextBuffer, iv) {
        if (!key) throw new Error("Decryption key is required.");
        if (!iv || iv.length !== IV_LENGTH_BYTES) throw new Error("Valid 12-byte IV is required.");

        try {
            return await window.crypto.subtle.decrypt(
                {
                    name: "AES-GCM",
                    iv: iv
                },
                key,
                ciphertextBuffer
            );
        } catch (decryptError) {
            throw new Error("Decryption failed. Incorrect vault password or corrupted data.");
        }
    }

    /**
     * Encrypts a JSON object into a Base64 ciphertext string.
     *
     * @param {CryptoKey} key
     * @param {Object} jsonObject
     * @param {Uint8Array} iv
     * @returns {Promise<string>} Base64 ciphertext string
     */
    async function encryptJson(key, jsonObject, iv) {
        const jsonString = JSON.stringify(jsonObject);
        const plaintextBytes = textEncoder.encode(jsonString);
        const ciphertextBuffer = await encryptBuffer(key, plaintextBytes, iv);
        return bufferToBase64(ciphertextBuffer);
    }

    /**
     * Decrypts a Base64 ciphertext string into a JSON object.
     *
     * @param {CryptoKey} key
     * @param {string} base64Ciphertext
     * @param {Uint8Array} iv
     * @returns {Promise<Object>}
     */
    async function decryptJson(key, base64Ciphertext, iv) {
        const ciphertextBytes = base64ToUint8Array(base64Ciphertext);
        const plaintextBuffer = await decryptBuffer(key, ciphertextBytes, iv);
        const jsonString = textDecoder.decode(plaintextBuffer);
        return JSON.parse(jsonString);
    }

    // Expose VaultCrypto API globally
    window.VaultCrypto = {
        PBKDF2_ITERATIONS,
        KEY_LENGTH_BITS,
        SALT_LENGTH_BYTES,
        IV_LENGTH_BYTES,
        generateSalt,
        generateIv,
        deriveKey,
        encryptBuffer,
        decryptBuffer,
        encryptJson,
        decryptJson,
        bufferToHex,
        hexToUint8Array,
        bufferToBase64,
        base64ToUint8Array
    };

})(window);
