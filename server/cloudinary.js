const cloudinary = require("cloudinary").v2;
const crypto = require("crypto");
const stream = require("stream");

// ============================================================================
// CLOUDINARY CONFIGURATION MODULE
// Server-side only. Secrets are never exposed to clients, APIs, or logs.
// ============================================================================

const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
const apiKey = (process.env.CLOUDINARY_API_KEY || "").trim();
const apiSecret = (process.env.CLOUDINARY_API_SECRET || "").trim();

if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
        timeout: 300000 // 5 minutes timeout for large file uploads
    });
    console.log("✅ Cloudinary SDK configured successfully for secure raw storage.");
} else {
    console.warn("⚠️ Cloudinary credentials incomplete in environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).");
}

/**
 * Safely validates whether Cloudinary has valid credentials configured
 * without ever exposing or printing credential values.
 *
 * @returns {{ configured: boolean, cloudName: string | null }}
 */
function validateCloudinaryConfig() {
    const isConfigured = Boolean(cloudName && apiKey && apiSecret);
    return {
        configured: isConfigured,
        cloudName: isConfigured ? cloudName : null
    };
}

/**
 * Single-attempt helper to upload an encrypted buffer to Cloudinary.
 */
function _attemptUpload(buffer, fullPublicId) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: "raw",
                type: "authenticated",
                public_id: fullPublicId,
                overwrite: true,
                timeout: 300000
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                resolve({
                    publicId: result.public_id,
                    assetId: result.asset_id || null,
                    bytes: result.bytes || buffer.length,
                    secureUrl: result.secure_url || null
                });
            }
        );

        uploadStream.on("error", (err) => {
            console.warn("[Cloudinary Stream Warning]", err.message);
        });

        // Write buffer directly to the Writable stream without intermediate pipe stalls
        uploadStream.end(buffer);
    });
}

/**
 * Uploads an already-encrypted document payload buffer to Cloudinary as an authenticated raw asset.
 * Includes automatic retry with backoff for resilient transmission over high-latency connections.
 *
 * @param {Buffer} buffer Encrypted ciphertext payload buffer
 * @param {Object} [options]
 * @param {string} [options.folder] Optional folder in Cloudinary
 * @param {number} [options.maxRetries=2] Retry count on network reset
 * @returns {Promise<{ publicId: string, assetId: string, bytes: number, secureUrl: string }>}
 */
async function uploadEncryptedBuffer(buffer, options = {}) {
    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error("Cloudinary is not configured on the server.");
    }

    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw new Error("Valid encrypted buffer is required for upload.");
    }

    const randomId = "vault_" + crypto.randomBytes(16).toString("hex");
    const folder = options.folder || "verifiedrecords_vault";
    const fullPublicId = `${folder}/${randomId}`;
    const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 2;

    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            const result = await _attemptUpload(buffer, fullPublicId);
            return result;
        } catch (err) {
            lastError = err;
            console.warn(`[Cloudinary Storage] Upload attempt ${attempt} failed: ${err.message}`);
            if (attempt <= maxRetries) {
                // Wait 1.5s before retrying
                await new Promise((resolve) => setTimeout(resolve, 1500));
            }
        }
    }

    console.error("[Cloudinary Storage] All upload attempts failed:", lastError ? lastError.message : "Unknown error");
    throw new Error("Secure storage upload failed: " + (lastError ? lastError.message : "Network error"));
}

/**
 * Generates an authorized, short-lived signed download URL for an authenticated raw asset.
 *
 * @param {string} publicId Cloudinary public_id
 * @param {number} [expiresInSeconds=300] Expiration time in seconds (default: 5 minutes)
 * @returns {string} Signed download URL
 */
function getSignedDownloadUrl(publicId, expiresInSeconds = 300) {
    if (!publicId) {
        throw new Error("Cloudinary public_id is required.");
    }
    const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
    return cloudinary.utils.private_download_url(publicId, "", {
        resource_type: "raw",
        type: "authenticated",
        expires_at: expiresAt
    });
}

/**
 * Fetches the encrypted raw buffer from Cloudinary for server-mediated authenticated streaming.
 *
 * @param {string} publicId Cloudinary public_id
 * @returns {Promise<Buffer>}
 */
async function fetchEncryptedBuffer(publicId) {
    const signedUrl = getSignedDownloadUrl(publicId, 120);
    const response = await fetch(signedUrl);
    if (!response.ok) {
        throw new Error(`Failed to retrieve asset from storage (status: ${response.status})`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Permanently deletes an encrypted asset from Cloudinary.
 *
 * @param {string} publicId Cloudinary public_id
 * @returns {Promise<Object>}
 */
function deleteEncryptedAsset(publicId) {
    return new Promise((resolve, reject) => {
        if (!publicId) {
            return resolve({ result: "not_found" });
        }
        cloudinary.uploader.destroy(
            publicId,
            { resource_type: "raw", type: "authenticated" },
            (error, result) => {
                if (error) {
                    console.error("[Cloudinary Storage] Asset destruction failed:", error.message);
                    return reject(error);
                }
                resolve(result);
            }
        );
    });
}

/**
 * Signs parameters for direct browser upload to Cloudinary authenticated raw storage.
 *
 * @param {string} publicId
 * @param {number} timestamp
 * @param {string} [type='authenticated']
 * @returns {string} SHA-1 signature
 */
function signUploadRequest(publicId, timestamp, type = "authenticated") {
    if (!apiSecret) {
        throw new Error("Cloudinary API secret is not configured.");
    }
    const paramsToSign = {
        public_id: publicId,
        timestamp: timestamp,
        type: type
    };
    return cloudinary.utils.api_sign_request(paramsToSign, apiSecret);
}

/**
 * Returns public Cloudinary configuration metadata (cloud name and public API key).
 * Secret is never returned or logged.
 */
function getCloudinaryPublicConfig() {
    return {
        configured: Boolean(cloudName && apiKey && apiSecret),
        cloudName: cloudName || null,
        apiKey: apiKey || null
    };
}

/**
 * Checks whether a raw authenticated asset exists in Cloudinary.
 *
 * @param {string} publicId
 * @returns {Promise<{ exists: boolean, asset: Object | null, error: string | null }>}
 */
async function verifyAssetExists(publicId) {
    if (!publicId) {
        return { exists: false, asset: null, error: "Missing public_id" };
    }
    try {
        const res = await cloudinary.api.resource(publicId, {
            resource_type: "raw",
            type: "authenticated"
        });
        return {
            exists: true,
            asset: {
                publicId: res.public_id,
                assetId: res.asset_id || null,
                bytes: res.bytes || 0,
                format: res.format || null,
                resource_type: res.resource_type || "raw",
                type: res.type || "authenticated",
                createdAt: res.created_at || null,
                cloudName: cloudName
            },
            error: null
        };
    } catch (err) {
        return {
            exists: false,
            asset: null,
            error: err.message
        };
    }
}

module.exports = {
    validateCloudinaryConfig,
    uploadEncryptedBuffer,
    getSignedDownloadUrl,
    fetchEncryptedBuffer,
    deleteEncryptedAsset,
    signUploadRequest,
    getCloudinaryPublicConfig,
    verifyAssetExists
};


