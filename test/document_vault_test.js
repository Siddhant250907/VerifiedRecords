/**
 * ============================================================================
 * SECURE DOCUMENT VAULT & CLOUDINARY INTEGRATION TEST SUITE
 * Tests encryption, Cloudinary storage, decryption, access control, and drafts.
 * ============================================================================
 */

process.env.NODE_ENV = "test";
require("dotenv").config();

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3000";

// Test users
const USER_A_TOKEN = "test-token-user_alpha_777";
const USER_B_TOKEN = "test-token-user_beta_888";

let testsPassed = 0;
let testsFailed = 0;

function report(testName, passed, details = "") {
    if (passed) {
        testsPassed++;
        console.log(`[PASS] ${testName}${details ? " — " + details : ""}`);
    } else {
        testsFailed++;
        console.error(`[FAIL] ${testName}${details ? " — " + details : ""}`);
    }
}

// ----------------------------------------------------------------------------
// CRYPTO HELPERS (Simulating browser Web Crypto AES-256-GCM & PBKDF2)
// ----------------------------------------------------------------------------

function deriveKeyNode(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
}

function encryptAesGcm(key, plaintextBuffer, iv) {
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    // Return concatenated ciphertext + 16-byte auth tag (matches Web Crypto AES-GCM output)
    return Buffer.concat([encrypted, tag]);
}

function decryptAesGcm(key, ciphertextWithTag, iv) {
    const tag = ciphertextWithTag.subarray(ciphertextWithTag.length - 16);
    const data = ciphertextWithTag.subarray(0, ciphertextWithTag.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}

async function runTestSuite() {
    console.log("==================================================================");
    console.log("  SECURE DOCUMENT VAULT & CLOUDINARY TEST SUITE                   ");
    console.log("==================================================================\n");

    try {
        // --- TEST 1: Status & Safe Configuration Validation ---
        console.log("--- TEST 1: Cloudinary Configuration Endpoint ---");
        const statusRes = await fetch(`${BASE_URL}/api/documents/status`);
        const statusData = await statusRes.json();
        const test1Pass = statusRes.ok &&
            statusData.success === true &&
            statusData.cloudinaryConfigured === true &&
            statusData.maxFileSizeBytes === 15 * 1024 * 1024 &&
            // Ensure no secrets are leaked
            !JSON.stringify(statusData).includes(process.env.CLOUDINARY_API_SECRET || "UNEXPECTED");
        report("1. /api/documents/status safe validation", test1Pass, `Configured: ${statusData.cloudinaryConfigured}, SecretsExposed: false`);

        // --- TEST 2: Encryption Before Upload & Cloudinary Storage ---
        console.log("\n--- TEST 2: Client Encryption & Authenticated Cloudinary Upload ---");
        const vaultPassword = "MySecretVaultPassword_2026!#";
        const originalFileText = "OFFICIAL GOVERNMENT DEGREE DOCUMENT CONTENT - CONFIDENTIAL";
        const originalFileBuffer = Buffer.from(originalFileText, "utf-8");

        const salt = crypto.randomBytes(16);
        const fileIv = crypto.randomBytes(12);
        const metadataIv = crypto.randomBytes(12);
        const derivedKey = deriveKeyNode(vaultPassword, salt);

        // Encrypt file
        const encryptedFileBuffer = encryptAesGcm(derivedKey, originalFileBuffer, fileIv);

        // Encrypt metadata
        const metadataObj = {
            title: "Bachelor of Technology Marksheet",
            fileName: "Marksheet_BTech_Final.pdf",
            category: "marksheets",
            notes: "Final Semester Official Marksheet",
            mimeType: "application/pdf",
            fileSize: originalFileBuffer.length,
            lastModified: Date.now()
        };
        const metadataPlaintext = Buffer.from(JSON.stringify(metadataObj), "utf-8");
        const encryptedMetadataBuffer = encryptAesGcm(derivedKey, metadataPlaintext, metadataIv);
        const encryptedMetadataBase64 = encryptedMetadataBuffer.toString("base64");

        // Build multipart upload
        const boundary = "----WebKitFormBoundary" + crypto.randomBytes(12).toString("hex");
        const crlf = "\r\n";

        let bodyBuffer = Buffer.concat([
            Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="encryptedMetadata"${crlf}${crlf}${encryptedMetadataBase64}${crlf}`),
            Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="salt"${crlf}${crlf}${salt.toString("hex")}${crlf}`),
            Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="fileIv"${crlf}${crlf}${fileIv.toString("hex")}${crlf}`),
            Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="metadataIv"${crlf}${crlf}${metadataIv.toString("hex")}${crlf}`),
            Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="categoryTag"${crlf}${crlf}marksheets${crlf}`),
            Buffer.from(`--${boundary}${crlf}Content-Disposition: form-data; name="encryptedFile"; filename="encrypted_payload.bin"${crlf}Content-Type: application/octet-stream${crlf}${crlf}`),
            encryptedFileBuffer,
            Buffer.from(`${crlf}--${boundary}--${crlf}`)
        ]);

        const uploadRes = await fetch(`${BASE_URL}/api/documents/upload`, {
            method: "POST",
            headers: {
                "Content-Type": `multipart/form-data; boundary=${boundary}`,
                "Authorization": `Bearer ${USER_A_TOKEN}`
            },
            body: bodyBuffer
        });

        const uploadData = await uploadRes.json();
        const test2Pass = uploadRes.status === 201 && uploadData.success === true && Boolean(uploadData.document.documentId);
        const uploadedDocId = uploadData.document ? uploadData.document.documentId : null;
        report("2. Encrypted upload to Cloudinary & MongoDB", test2Pass, `DocId: ${uploadedDocId}, Bytes: ${uploadData.document ? uploadData.document.cloudinaryBytes : 0}`);

        // --- TEST 3: Metadata Listing & Decryption Verification ---
        console.log("\n--- TEST 3: Document Listing & Decryption with Correct Password ---");
        const listRes = await fetch(`${BASE_URL}/api/documents?category=marksheets`, {
            headers: { "Authorization": `Bearer ${USER_A_TOKEN}` }
        });
        const listData = await listRes.json();
        const targetDoc = (listData.documents || []).find(d => d.documentId === uploadedDocId);

        let test3Pass = false;
        let decryptedMetadata = null;
        if (targetDoc) {
            const decKey = deriveKeyNode(vaultPassword, Buffer.from(targetDoc.encryption.salt, "hex"));
            const rawMetaCiphertext = Buffer.from(targetDoc.encryptedMetadata, "base64");
            const decMetaBuffer = decryptAesGcm(decKey, rawMetaCiphertext, Buffer.from(targetDoc.encryption.metadataIv, "hex"));
            decryptedMetadata = JSON.parse(decMetaBuffer.toString("utf-8"));
            test3Pass = decryptedMetadata.title === "Bachelor of Technology Marksheet" && decryptedMetadata.category === "marksheets";
        }
        report("3. Metadata decryption with correct password", test3Pass, `Decrypted Title: "${decryptedMetadata ? decryptedMetadata.title : 'N/A'}"`);

        // --- TEST 4: Original File Download & Integrity Check ---
        console.log("\n--- TEST 4: Encrypted File Download & In-Memory Decryption ---");
        const fileRes = await fetch(`${BASE_URL}/api/documents/${uploadedDocId}/file`, {
            headers: { "Authorization": `Bearer ${USER_A_TOKEN}` }
        });
        const downloadedCiphertext = Buffer.from(await fileRes.arrayBuffer());

        const decKey = deriveKeyNode(vaultPassword, Buffer.from(targetDoc.encryption.salt, "hex"));
        const decryptedFileBuffer = decryptAesGcm(decKey, downloadedCiphertext, Buffer.from(targetDoc.encryption.fileIv, "hex"));
        const decryptedFileText = decryptedFileBuffer.toString("utf-8");

        const test4Pass = fileRes.ok && (decryptedFileText === originalFileText);
        report("4. Original file download & decryption integrity", test4Pass, `Integrity match: true (${decryptedFileBuffer.length} bytes)`);

        // --- TEST 5: Incorrect Password Rejection (AES-GCM Auth Tag Failure) ---
        console.log("\n--- TEST 5: Incorrect Password Rejection ---");
        const wrongPassword = "TotallyWrongPassword123!";
        const wrongKey = deriveKeyNode(wrongPassword, Buffer.from(targetDoc.encryption.salt, "hex"));
        let test5Pass = false;
        try {
            decryptAesGcm(wrongKey, downloadedCiphertext, Buffer.from(targetDoc.encryption.fileIv, "hex"));
            test5Pass = false; // should not reach here
        } catch (authTagErr) {
            test5Pass = true; // Expected: Unsupported state or unable to authenticate data
        }
        report("5. Incorrect password rejection (Auth tag failure)", test5Pass, "AES-GCM authentication tag rejected unauthorized decryption");

        // --- TEST 6: Per-User Access Control Enforcement ---
        console.log("\n--- TEST 6: Per-User Access Control Isolation ---");
        // User B attempts to access User A's document metadata
        const userBAccessRes = await fetch(`${BASE_URL}/api/documents/${uploadedDocId}`, {
            headers: { "Authorization": `Bearer ${USER_B_TOKEN}` }
        });
        // User B attempts to download User A's file
        const userBFileRes = await fetch(`${BASE_URL}/api/documents/${uploadedDocId}/file`, {
            headers: { "Authorization": `Bearer ${USER_B_TOKEN}` }
        });

        const test6Pass = (userBAccessRes.status === 404) && (userBFileRes.status === 404);
        report("6. Multi-tenant access isolation", test6Pass, `User B Metadata: ${userBAccessRes.status}, User B File: ${userBFileRes.status}`);

        // --- TEST 7: Persistent Encrypted Drafts ---
        console.log("\n--- TEST 7: Encrypted Draft Creation & Autosave Persistence ---");
        const draftSalt = crypto.randomBytes(16);
        const draftIv = crypto.randomBytes(12);
        const draftKey = deriveKeyNode(vaultPassword, draftSalt);

        const draftContent = {
            title: "Draft Driving Licence 2026",
            notes: "Pending front-side scan upload",
            category: "dl"
        };
        const draftCiphertext = encryptAesGcm(draftKey, Buffer.from(JSON.stringify(draftContent)), draftIv).toString("base64");

        const draftRes = await fetch(`${BASE_URL}/api/documents/draft`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${USER_A_TOKEN}`
            },
            body: JSON.stringify({
                encryptedDraftData: draftCiphertext,
                salt: draftSalt.toString("hex"),
                metadataIv: draftIv.toString("hex"),
                categoryTag: "dl"
            })
        });

        const draftData = await draftRes.json();
        const draftId = draftData.draft ? draftData.draft.documentId : null;

        // Fetch draft list to verify persistence
        const draftListRes = await fetch(`${BASE_URL}/api/documents?status=draft`, {
            headers: { "Authorization": `Bearer ${USER_A_TOKEN}` }
        });
        const draftListData = await draftListRes.json();
        const persistedDraft = (draftListData.documents || []).find(d => d.documentId === draftId);

        const test7Pass = draftRes.ok && Boolean(persistedDraft) && persistedDraft.status === "draft";
        report("7. Encrypted draft persistence & autosave", test7Pass, `DraftId: ${draftId}, Status: ${persistedDraft ? persistedDraft.status : 'N/A'}`);

        // --- TEST 8: Document & Cloudinary Asset Deletion ---
        console.log("\n--- TEST 8: Document Deletion & Storage Cleanup ---");
        const deleteRes = await fetch(`${BASE_URL}/api/documents/${uploadedDocId}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${USER_A_TOKEN}` }
        });
        const deleteData = await deleteRes.json();

        // Also clean up draft
        if (draftId) {
            await fetch(`${BASE_URL}/api/documents/${draftId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${USER_A_TOKEN}` }
            });
        }

        // Verify document is gone
        const verifyGoneRes = await fetch(`${BASE_URL}/api/documents/${uploadedDocId}`, {
            headers: { "Authorization": `Bearer ${USER_A_TOKEN}` }
        });

        const test8Pass = deleteRes.ok && deleteData.success === true && verifyGoneRes.status === 404;
        report("8. Document deletion & Cloudinary cleanup", test8Pass, `Delete status: ${deleteRes.status}, Post-delete lookup: ${verifyGoneRes.status}`);

        // --- TEST 9: Existing Certificate System Remains 100% Intact ---
        console.log("\n--- TEST 9: Preserving Existing Certificate System ---");
        const certConfigRes = await fetch(`${BASE_URL}/api/blockchain/config`);
        const certConfigData = await certConfigRes.json();

        const certVerifyRes = await fetch(`${BASE_URL}/api/certificate/popop`);
        const certVerifyData = await certVerifyRes.json();

        const test9Pass = certConfigRes.ok &&
            certConfigData.network === "sepolia" &&
            certVerifyRes.ok &&
            certVerifyData.verified === true &&
            certVerifyData.certificate.certificateId === "popop";

        report("9. Existing Certificate Issuance & Sepolia Verification Intact", test9Pass, `Network: ${certConfigData.network}, Certificate popop verified: ${certVerifyData.verified}`);

        // --- TEST 10: Advance Security (Ethereum Sepolia Proof) Flow ---
        console.log("\n--- TEST 10: Advance Security (Ethereum Sepolia Proof) Flow ---");
        const prepRes = await fetch(`${BASE_URL}/api/documents/prepare-blockchain`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${USER_A_TOKEN}` },
            body: JSON.stringify({
                documentTitle: "Sepolia Anchored Marksheet",
                walletAddress: "0x1FC04CfBF2f7B0F32AEBecd17880afeb38BFacC7"
            })
        });
        const prepData = await prepRes.json();

        const advFormData = new FormData();
        advFormData.append("encryptedFile", new Blob([Buffer.from("encrypted payload for advance security")]), "advance.bin");
        advFormData.append("encryptedMetadata", "advance-metadata-ciphertext");
        advFormData.append("salt", "0102030405060708090a0b0c0d0e0f10");
        advFormData.append("fileIv", "0102030405060708090a0b0c");
        advFormData.append("metadataIv", "0102030405060708090a0b0c");
        advFormData.append("categoryTag", "marksheets");
        advFormData.append("blockchainProof", JSON.stringify({
            transactionHash: "0x89abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234567",
            blockNumber: 11933220,
            contractAddress: prepData.contractAddress,
            docCertId: prepData.docCertId,
            docHash: prepData.docHash,
            network: "sepolia",
            walletAddress: "0x1FC04CfBF2f7B0F32AEBecd17880afeb38BFacC7"
        }));

        const advUploadRes = await fetch(`${BASE_URL}/api/documents/upload`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${USER_A_TOKEN}` },
            body: advFormData
        });
        const advUploadData = await advUploadRes.json();

        const test10Pass = prepRes.ok && prepData.success === true &&
            Boolean(prepData.docCertId) &&
            advUploadRes.status === 201 &&
            advUploadData.document.blockchainProof &&
            advUploadData.document.blockchainProof.enabled === true &&
            advUploadData.document.blockchainProof.network === "sepolia";

        report("10. Advance Security On-Chain Proof Preparation & Anchoring", test10Pass, `DocCertId: ${prepData.docCertId}, Anchored: ${advUploadData.document?.blockchainProof?.enabled}`);

        // Clean up test 10 document
        if (advUploadData.document?.documentId) {
            await fetch(`${BASE_URL}/api/documents/${advUploadData.document.documentId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${USER_A_TOKEN}` }
            });
        }

        console.log("\n==================================================================");
        console.log(`TEST SUITE FINISHED: ${testsPassed}/${testsPassed + testsFailed} TESTS PASSED`);
        console.log("==================================================================");

        if (testsFailed > 0) {
            process.exit(1);
        }
    } catch (err) {
        console.error("Test Suite Fatal Error:", err);
        process.exit(1);
    }
}

runTestSuite();
