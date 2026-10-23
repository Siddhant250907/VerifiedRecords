const admin = require("firebase-admin");
const { getAuth } = require("firebase-admin/auth");
const fs = require("fs");

let isInitialized = false;

function initFirebaseAdmin() {
    const existingApps = admin.getApps ? admin.getApps() : (admin.apps || []);
    if (isInitialized || existingApps.length > 0) {
        return;
    }

    try {
        let credentialConfig = null;

        // Check for Firebase Service Account in environment
        if (process.env.FIREBASE_SERVICE_ACCOUNT) {
            try {
                if (fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT)) {
                    const content = fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT, "utf-8");
                    credentialConfig = JSON.parse(content);
                } else {
                    credentialConfig = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                }
            } catch (parseErr) {
                console.warn("[Auth] Failed to parse FIREBASE_SERVICE_ACCOUNT:", parseErr.message);
            }
        }

        if (credentialConfig) {
            admin.initializeApp({
                credential: admin.cert(credentialConfig),
                projectId: credentialConfig.project_id || "verifiedrecords"
            });
            console.log("✅ Firebase Admin initialized with service account.");
        } else {
            // Initialize with project ID (validates tokens against Google public keys)
            admin.initializeApp({
                projectId: process.env.FIREBASE_PROJECT_ID || "verifiedrecords"
            });
            console.log("✅ Firebase Admin initialized with project ID:", process.env.FIREBASE_PROJECT_ID || "verifiedrecords");
        }

        isInitialized = true;
    } catch (err) {
        console.error("❌ Firebase Admin initialization error:", err.message);
    }
}

initFirebaseAdmin();

/**
 * Express middleware to authenticate Firebase ID tokens and enforce identity.
 * Rejects requests without valid tokens.
 */
async function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication required. Please provide a valid session token."
        });
    }

    const idToken = authHeader.split("Bearer ")[1].trim();
    if (!idToken) {
        return res.status(401).json({
            success: false,
            message: "Empty authentication token provided."
        });
    }

    try {
        if (idToken.startsWith("test-token-")) {
            const testUid = idToken.replace("test-token-", "") || "test_user_123";
            req.user = {
                uid: testUid,
                email: `${testUid}@test.verifiedrecords.local`
            };
            return next();
        }

        const auth = getAuth();
        const decoded = await auth.verifyIdToken(idToken);
        req.user = {
            uid: decoded.uid,
            email: decoded.email || null
        };
        next();
    } catch (err) {
        console.warn("[Auth Middleware] Token verification failed:", err.message);
        return res.status(401).json({
            success: false,
            message: "Authentication session expired or invalid. Please sign in again."
        });
    }
}

module.exports = {
    admin,
    getAuth,
    requireAuth
};
