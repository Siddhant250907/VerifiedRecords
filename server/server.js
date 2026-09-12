const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const dns = require("dns");
require("dotenv").config();

// Ensure reliable DNS resolution for MongoDB Atlas SRV records
try {
    dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
    if (typeof dns.setDefaultResultOrder === "function") {
        dns.setDefaultResultOrder("ipv4first");
    }
} catch (e) {
    // Fallback to system default if custom servers cannot be set
}

const Certificate = require("./models/certificates");
const {
    checkBlockchainStatus,
    getCertificateFromChain,
    generateCertificateHash,
    encodeIssueCertificate,
    registerCertificateOnChain,
    verifyTransactionOnChain,
    contractAddress
} = require("./blockchain");

const app = express();


// ==================================================
// MIDDLEWARE
// ==================================================

app.use(cors());
app.use(express.json());


// ==================================================
// SERVE FRONTEND
// ==================================================

app.use(
    express.static(
        path.join(__dirname, "..", "docs")
    )
);


// ==================================================
// PORT
// ==================================================

const PORT = process.env.PORT || 3000;


// ==================================================
// MONGODB CONNECTION
// ==================================================

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {

    console.error("❌ MONGODB_URI is missing from .env");

} else {

    mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000
    })
    .then(() => {

        console.log("=================================");
        console.log("✅ MongoDB Connected Successfully");
        console.log("Database:", mongoose.connection.name);
        console.log("=================================");

    })
    .catch((error) => {

        console.error("=================================");
        console.error("❌ MongoDB Connection Failed");
        console.error(error.message);
        console.error("=================================");

    });

}


// ==================================================
// HOME
// ==================================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "docs", "index.html"));
});


// ==================================================
// TEST API
// ==================================================

app.get("/api/test", (req, res) => {

    res.json({

        success: true,

        message:
            "Backend Connected Successfully!"

    });

});


// ==================================================
// BLOCKCHAIN STATUS TEST
// ==================================================

app.get("/api/blockchain/test", async (req, res) => {

    try {

        const status = await checkBlockchainStatus();

        res.json({
            success: true,
            message: "Blockchain connection test completed.",
            data: status
        });

    } catch (error) {

        console.error("Blockchain test error:", error);

        res.status(500).json({
            success: false,
            message: "Blockchain connection test failed.",
            error: error.message
        });

    }

});


// ==================================================
// PREPARE CERTIFICATE ISSUANCE (FOR METAMASK / CLIENT PRE-CHECK)
// ==================================================

app.post("/api/certificate/prepare", async (req, res) => {

    try {

        const {
            studentName,
            rollNumber,
            course,
            certificateId,
            issueDate
        } = req.body;

        if (
            !studentName ||
            !rollNumber ||
            !course ||
            !certificateId ||
            !issueDate
        ) {
            return res.status(400).json({
                success: false,
                message: "All certificate fields are required."
            });
        }

        const trimmedCertId = String(certificateId).trim();

        // 1. Check MongoDB uniqueness
        const existingCertificate = await Certificate.findOne({
            certificateId: new RegExp(`^${trimmedCertId}$`, "i")
        });

        if (existingCertificate) {
            return res.status(409).json({
                success: false,
                message: `Certificate ID "${trimmedCertId}" already exists in the institutional registry.`
            });
        }

        // 2. Check Smart Contract on-chain uniqueness
        const onChainCheck = await getCertificateFromChain(trimmedCertId);
        if (onChainCheck.exists) {
            return res.status(409).json({
                success: false,
                message: `Certificate ID "${trimmedCertId}" is already registered on the blockchain.`
            });
        }

        // 3. Compute Deterministic Hash & Encoded Call Data
        const { hash: certificateHash, canonicalPayload } = generateCertificateHash({
            studentName,
            rollNumber,
            course,
            certificateId: trimmedCertId,
            issueDate
        });

        const txData = encodeIssueCertificate(trimmedCertId, certificateHash);

        res.json({
            success: true,
            certificateId: trimmedCertId,
            certificateHash: certificateHash,
            canonicalPayload: canonicalPayload,
            contractAddress: contractAddress,
            txData: txData
        });

    } catch (error) {

        console.error("Prepare Certificate Error:", error);

        res.status(500).json({
            success: false,
            message: "Failed to prepare certificate data for blockchain registration.",
            error: error.message
        });

    }

});


// ==================================================
// ISSUE CERTIFICATE
// ADMIN
// ==================================================

app.post("/api/certificate", async (req, res) => {

    try {

        const {
            studentName,
            rollNumber,
            course,
            certificateId,
            issueDate,
            transactionHash,
            blockchainIssuer
        } = req.body;


        // ------------------------------------------
        // 1. CHECK REQUIRED FIELDS
        // ------------------------------------------

        if (
            !studentName ||
            !rollNumber ||
            !course ||
            !certificateId ||
            !issueDate
        ) {

            return res.status(400).json({
                success: false,
                message: "All certificate fields are required."
            });

        }

        const trimmedCertId = String(certificateId).trim();

        console.log("[2] Certificate data received:", {
            studentName: studentName.trim(),
            rollNumber: rollNumber.trim(),
            course: course.trim(),
            certificateId: trimmedCertId,
            issueDate: issueDate.trim(),
            clientTxProvided: Boolean(transactionHash)
        });


        // ------------------------------------------
        // 2. COMPUTE DETERMINISTIC HASH
        // ------------------------------------------

        const { hash: certificateHash, canonicalPayload } = generateCertificateHash({
            studentName,
            rollNumber,
            course,
            certificateId: trimmedCertId,
            issueDate
        });

        console.log("[3] Hash generated:", certificateHash);


        // ------------------------------------------
        // 3. CHECK DUPLICATE IN MONGODB
        // ------------------------------------------

        const existingCertificate =
            await Certificate.findOne({
                certificateId: new RegExp(`^${trimmedCertId}$`, "i")
            });

        if (existingCertificate) {

            console.warn(`[Duplicate Check] Certificate ID "${trimmedCertId}" already exists in MongoDB.`);

            return res.status(409).json({
                success: false,
                message: `Certificate ID "${trimmedCertId}" already exists in the institutional registry.`
            });

        }


        // ------------------------------------------
        // 4. CHECK DUPLICATE ON SMART CONTRACT
        // ------------------------------------------

        const onChainCheck = await getCertificateFromChain(trimmedCertId);

        // If not using an already submitted txHash, verify it doesn't already exist on-chain
        if (!transactionHash && onChainCheck.exists) {

            console.warn(`[Duplicate Check] Certificate ID "${trimmedCertId}" already exists on smart contract.`);

            return res.status(409).json({
                success: false,
                message: `Certificate ID "${trimmedCertId}" is already registered on the blockchain.`
            });

        }


        // ------------------------------------------
        // 5. BLOCKCHAIN REGISTRATION / VERIFICATION
        // ------------------------------------------

        let blockchainRecord;

        if (transactionHash) {

            console.log("[4] Blockchain transaction verification starting for client tx:", transactionHash);

            // Client signed via MetaMask and provided txHash
            blockchainRecord = await verifyTransactionOnChain(
                transactionHash,
                trimmedCertId,
                certificateHash
            );

            console.log("[5] Blockchain transaction hash verified:", blockchainRecord.transactionHash);
            console.log("[6] Blockchain receipt/status: confirmed on-chain in block", blockchainRecord.blockNumber);

            if (!blockchainRecord.verified) {

                return res.status(400).json({
                    success: false,
                    message: "Blockchain transaction verification failed or record does not match."
                });

            }

        } else {

            console.log("[4] Blockchain transaction starting via Node.js Ganache account...");

            // Direct local Ganache registration via unlocked account (no private keys in source)
            blockchainRecord = await registerCertificateOnChain(
                trimmedCertId,
                certificateHash
            );

            console.log("[5] Blockchain transaction hash:", blockchainRecord.transactionHash);
            console.log("[6] Blockchain receipt/status: confirmed on-chain in block", blockchainRecord.blockNumber);

        }

        // Ensure blockchain transaction succeeded before saving to MongoDB
        if (!blockchainRecord || !blockchainRecord.transactionHash) {
            console.error("[Issuance Failed] No valid blockchain transaction hash confirmed for:", trimmedCertId);
            return res.status(400).json({
                success: false,
                message: "Blockchain transaction was not confirmed. Certificate cannot be recorded without valid on-chain proof."
            });
        }

        // ------------------------------------------
        // 6. SAVE TO MONGODB WITH BLOCKCHAIN METADATA
        // ------------------------------------------

        console.log("[7] MongoDB save starting for certificate:", trimmedCertId);

        const newCertificate = new Certificate({

            studentName:
                String(studentName).trim(),

            rollNumber:
                String(rollNumber).trim(),

            course:
                String(course).trim(),

            certificateId:
                trimmedCertId,

            issueDate:
                String(issueDate).trim(),

            issuedAt:
                new Date(),

            certificateHash:
                certificateHash,

            transactionHash:
                blockchainRecord.transactionHash,

            contractAddress:
                blockchainRecord.contractAddress,

            blockchainIssuer:
                blockchainRecord.issuer || blockchainIssuer || null,

            blockchainIssuedAt:
                blockchainRecord.issuedAt || null,

            blockNumber:
                blockchainRecord.blockNumber || null

        });

        await newCertificate.save();

        console.log("[8] MongoDB save completed for certificate:", trimmedCertId);


        // ------------------------------------------
        // 7. SEND SUCCESS RESPONSE
        // ------------------------------------------

        console.log("[9] Response sent to frontend for certificate:", trimmedCertId);

        res.status(201).json({

            success: true,

            message:
                "Certificate issued and recorded successfully on the blockchain and institutional repository.",

            certificate:
                newCertificate,

            blockchain: {
                transactionHash: blockchainRecord.transactionHash,
                contractAddress: blockchainRecord.contractAddress,
                certificateHash: certificateHash,
                issuer: blockchainRecord.issuer || blockchainIssuer || null,
                blockNumber: blockchainRecord.blockNumber || null,
                issuedAt: blockchainRecord.issuedAt || null
            }

        });

    }

    catch (error) {

        console.error(
            "Issue Certificate Error:",
            error
        );

        let friendlyMessage = "Server error occurred during certificate issuance.";
        let statusCode = 500;

        if (error.message && error.message.includes("Certificate already registered")) {
            friendlyMessage = "Certificate is already registered on the blockchain.";
            statusCode = 409;
        } else if (error.message && error.message.includes("reverted")) {
            friendlyMessage = "Blockchain transaction reverted by smart contract.";
            statusCode = 400;
        }

        res.status(statusCode).json({

            success: false,

            message:
                friendlyMessage,

            details:
                error.message

        });

    }

});


// ==================================================
// VERIFY CERTIFICATE
// USER
// ==================================================

app.get(
    "/api/certificate/:certificateId",
    async (req, res) => {

        try {

            const certificateId =
                req.params.certificateId;


            // --------------------------------------
            // SEARCH MONGODB
            // --------------------------------------

            const certificate =
                await Certificate.findOne({

                    certificateId:
                        new RegExp(
                            `^${certificateId}$`,
                            "i"
                        )

                });


            // --------------------------------------
            // CERTIFICATE NOT FOUND IN MONGODB
            // --------------------------------------

            if (!certificate) {

                return res.status(404).json({

                    success: false,

                    verified: false,

                    message:
                        "Certificate not found in the institutional registry."

                });

            }


            // --------------------------------------
            // GENERATE DETERMINISTIC CERTIFICATE HASH
            // --------------------------------------

            const { hash: computedHash } = generateCertificateHash(certificate);


            // --------------------------------------
            // CHECK SMART CONTRACT ON-CHAIN (READ-ONLY)
            // --------------------------------------

            let chainRecord = null;

            try {

                chainRecord = await getCertificateFromChain(certificate.certificateId);

            } catch (chainErr) {

                console.error("[Blockchain Verification] Read failed:", chainErr.message);

                return res.status(502).json({

                    success: false,

                    verified: false,

                    message:
                        "Unable to read verification proof from the blockchain network."

                });

            }


            // --------------------------------------
            // VALIDATE ON-CHAIN EXISTENCE & HASH MATCH
            // --------------------------------------

            if (!chainRecord || !chainRecord.exists) {

                console.warn(`[Verification Failed] Certificate ${certificate.certificateId} not found on-chain.`);

                return res.status(404).json({

                    success: false,

                    verified: false,

                    message:
                        "Certificate record does not exist on the blockchain registry.",

                    certificateId: certificate.certificateId

                });

            }

            const hashMatches =
                chainRecord.certificateHash &&
                chainRecord.certificateHash.toLowerCase() === computedHash.toLowerCase();

            if (!hashMatches) {

                console.warn(`[Verification Failed] Hash mismatch for ${certificate.certificateId}. Chain: ${chainRecord.certificateHash}, Computed: ${computedHash}`);

                return res.status(400).json({

                    success: false,

                    verified: false,

                    message:
                        "Cryptographic hash mismatch. Certificate data has been altered or does not match the blockchain record.",

                    certificateId: certificate.certificateId

                });

            }


            // --------------------------------------
            // CERTIFICATE VERIFIED (MATCH CONFIRMED)
            // --------------------------------------

            const originalTxHash = certificate.transactionHash || null;
            const issuerAddress = chainRecord.issuer || certificate.blockchainIssuer || null;
            const blockchainTimestamp = Number(chainRecord.issuedAt || certificate.blockchainIssuedAt || 0);
            const resolvedContract = certificate.contractAddress || contractAddress || null;

            res.json({

                success: true,

                verified: true,

                message:
                    "Certificate verified successfully against blockchain and institutional records.",

                certificate:
                    certificate,

                blockchain: {
                    status: "Verified",
                    existsOnChain: true,
                    hashMatches: true,
                    certificateHash: chainRecord.certificateHash,
                    computedHash: computedHash,
                    issuer: issuerAddress,
                    issuedAt: blockchainTimestamp,
                    transactionHash: originalTxHash,
                    contractAddress: resolvedContract,
                    blockNumber: certificate.blockNumber || null
                }

            });

        }

        catch (error) {

            console.error(
                "Verify Certificate Error:",
                error
            );


            res.status(500).json({

                success: false,

                verified: false,

                message:
                    "Server error during certificate verification."

            });

        }

    }
);


// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `VerifiedRecords running on port ${PORT}`
    );

});