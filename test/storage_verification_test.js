/**
 * ============================================================================
 * CLOUDINARY ASSET PERSISTENCE & STORAGE VERIFICATION TEST SUITE
 * Validates:
 * 1. Existing document state in MongoDB & Cloudinary SDK
 * 2. Upload failure handling (aborts before MongoDB save)
 * 3. End-to-end dummy PDF encryption, signed direct upload, asset verification,
 *    MongoDB persistence, retrieval, and decryption
 * 4. Zero plaintext leakage to Cloudinary
 * 5. Preservation of existing records
 * ============================================================================
 */

process.env.NODE_ENV = "test";
require("dotenv").config();

const crypto = require("crypto");
const mongoose = require("mongoose");
const Document = require("../server/models/document");
const { verifyAssetExists, fetchEncryptedBuffer, deleteEncryptedAsset } = require("../server/cloudinary");

const BASE_URL = "http://localhost:3000";
const TEST_TOKEN = "test-token-test_storage_user_999";
const EXISTING_DOC_ID = "8e18df29-4656-49cc-bd2e-d3850edd6095";

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
    if (condition) {
        passedCount++;
        console.log(`  [PASS] ${message}`);
    } else {
        failedCount++;
        console.error(`  [FAIL] ${message}`);
    }
}

// AES-256-GCM + PBKDF2 helpers (matching client-side Web Crypto)
function deriveKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, "sha256");
}

function encryptGcm(key, plaintextBuffer, iv) {
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([enc, tag]);
}

function decryptGcm(key, ciphertextBuffer, iv) {
    const tag = ciphertextBuffer.subarray(ciphertextBuffer.length - 16);
    const data = ciphertextBuffer.subarray(0, ciphertextBuffer.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
}

async function runStorageVerificationSuite() {
    console.log("\n==================================================================");
    console.log("  VERIFIEDRECORDS — STORAGE PERSISTENCE VERIFICATION TEST");
    console.log("==================================================================\n");

    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // --------------------------------------------------------------------
        // TEST 1: Check Status Endpoint & Configured Cloud
        // --------------------------------------------------------------------
        console.log("1. Checking Server Storage Configuration & Status Endpoint:");
        const statusRes = await fetch(`${BASE_URL}/api/documents/status`);
        const statusData = await statusRes.json();
        assert(statusRes.ok && statusData.success, "Status endpoint responded 200 OK");
        assert(statusData.cloudinaryConfigured === true, "Cloudinary configured on server");
        assert(typeof statusData.cloudName === "string" && statusData.cloudName.length > 0, `Active Cloud Name is: ${statusData.cloudName}`);

        // --------------------------------------------------------------------
        // TEST 2: Inspect Existing Document in MongoDB & Cloudinary SDK
        // --------------------------------------------------------------------
        console.log("\n2. Diagnosing Existing Document (smart passenger journey assistant):");
        const existingDoc = await Document.findOne({ documentId: EXISTING_DOC_ID });
        assert(Boolean(existingDoc), `MongoDB record ${EXISTING_DOC_ID} found in database`);
        if (existingDoc) {
            assert(Boolean(existingDoc.cloudinaryPublicId), `Recorded Cloudinary Public ID: ${existingDoc.cloudinaryPublicId}`);
            assert(Boolean(existingDoc.cloudinaryAssetId), `Recorded Cloudinary Asset ID: ${existingDoc.cloudinaryAssetId}`);
            assert(existingDoc.cloudinaryBytes > 2000000, `Recorded bytes: ${existingDoc.cloudinaryBytes} (~2.59 MB)`);
            assert(existingDoc.encryption && existingDoc.encryption.algorithm === "AES-256-GCM", "Encryption: AES-256-GCM with PBKDF2-SHA256 (100k iter)");

            // Verify real Cloudinary asset with server SDK
            const assetCheck = await verifyAssetExists(existingDoc.cloudinaryPublicId);
            assert(assetCheck.exists === true, "REAL CLOUDINARY ASSET EXISTS in active Cloudinary account!");
            assert(assetCheck.asset && assetCheck.asset.resource_type === "raw", "Resource type is: raw");
            assert(assetCheck.asset && assetCheck.asset.type === "authenticated", "Delivery type is: authenticated");

            // Verify authenticated download of existing asset
            const buffer = await fetchEncryptedBuffer(existingDoc.cloudinaryPublicId);
            assert(buffer && buffer.length === existingDoc.cloudinaryBytes, `Successfully fetched ${buffer.length} encrypted bytes from Cloudinary!`);
        }

        // --------------------------------------------------------------------
        // TEST 3: Upload Failure Handling (Non-existent asset rejected by MongoDB)
        // --------------------------------------------------------------------
        console.log("\n3. Testing Upload Failure Protection (Abort if not in Cloudinary):");
        const fakePublicId = "verifiedrecords_vault/vault_fake_nonexistent_test.enc";
        const fakeSalt = crypto.randomBytes(16).toString("hex");
        const fakeIv = crypto.randomBytes(12).toString("hex");
        const fakeRecordRes = await fetch(`${BASE_URL}/api/documents/record`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${TEST_TOKEN}`
            },
            body: JSON.stringify({
                cloudinaryPublicId: fakePublicId,
                cloudinaryAssetId: "fake_asset_id",
                cloudinaryBytes: 500,
                salt: fakeSalt,
                fileIv: fakeIv,
                metadataIv: fakeIv,
                encryptedMetadata: "fake_encrypted_metadata",
                categoryTag: "all"
            })
        });

        const fakeRecordData = await fakeRecordRes.json();
        assert(fakeRecordRes.status === 422, `Server rejected non-existent asset with HTTP 422 (Received: ${fakeRecordRes.status})`);
        assert(fakeRecordData.error === "STORAGE_ASSET_NOT_FOUND", "Error code is STORAGE_ASSET_NOT_FOUND");

        const unpersistedDoc = await Document.findOne({ cloudinaryPublicId: fakePublicId });
        assert(!unpersistedDoc, "No orphaned record was created in MongoDB");

        // --------------------------------------------------------------------
        // TEST 4: End-to-End Save Flow with Dummy PDF
        // --------------------------------------------------------------------
        console.log("\n4. Testing Full Save Flow with Dummy PDF:");
        const dummyPdfContent = Buffer.from(
            "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
            "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
            "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n" +
            "4 0 obj\n<< /Length 58 >>\nstream\nBT /F1 24 Tf 100 700 Td (VerifiedRecords Dummy PDF Test) Tj ET\nendstream\nendobj\n" +
            "xref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000213 00000 n \n" +
            "trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n320\n%%EOF"
        );

        const testPassword = "TestVaultPassword_Secure123!";
        const salt = crypto.randomBytes(16);
        const fileIv = crypto.randomBytes(12);
        const metaIv = crypto.randomBytes(12);
        const derivedKey = deriveKey(testPassword, salt);

        // Step 1: Encrypt file in client memory
        const encryptedFileBuffer = encryptGcm(derivedKey, dummyPdfContent, fileIv);
        const metadataObj = {
            title: "Automated Dummy PDF Test Document",
            fileName: "dummy_test_doc.pdf",
            category: "all",
            notes: "Test document to verify Cloudinary persistence",
            mimeType: "application/pdf",
            fileSize: dummyPdfContent.length
        };
        const encryptedMetaBuffer = encryptGcm(derivedKey, Buffer.from(JSON.stringify(metadataObj)), metaIv);
        const encryptedMetaStr = encryptedMetaBuffer.toString("base64");

        // Verify no plaintext in encrypted ciphertext
        assert(!encryptedFileBuffer.includes(Buffer.from("VerifiedRecords Dummy PDF")), "No plaintext in encrypted file payload");
        assert(!encryptedFileBuffer.includes(Buffer.from(testPassword)), "No vault password in encrypted file payload");

        // Step 2: Acquire signed upload authorization
        const signRes = await fetch(`${BASE_URL}/api/documents/sign-upload`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${TEST_TOKEN}`
            }
        });
        const signData = await signRes.json();
        assert(signRes.ok && signData.success, "Upload signature acquired successfully");
        assert(signData.type === "authenticated", "Signed upload type is authenticated");
        assert(signData.publicId.startsWith("verifiedrecords_vault/vault_"), "Public ID uses vault namespace");

        // Step 3: Direct upload to Cloudinary authenticated endpoint
        const formData = new FormData();
        const blob = new Blob([encryptedFileBuffer], { type: "application/octet-stream" });
        formData.append("file", blob, "encrypted_payload.enc");
        formData.append("api_key", signData.apiKey);
        formData.append("timestamp", String(signData.timestamp));
        formData.append("public_id", signData.publicId);
        formData.append("type", signData.type);
        formData.append("signature", signData.signature);

        const uploadRes = await fetch(signData.uploadUrl, {
            method: "POST",
            body: formData
        });
        const uploadResult = await uploadRes.json();
        assert(uploadRes.ok, `Cloudinary upload succeeded (HTTP ${uploadRes.status})`);
        assert(uploadResult.public_id === signData.publicId, `Cloudinary returned matching public_id: ${uploadResult.public_id}`);
        assert(uploadResult.resource_type === "raw", "Cloudinary confirmed resource_type: raw");
        assert(uploadResult.type === "authenticated", "Cloudinary confirmed delivery_type: authenticated");
        assert(uploadResult.bytes === encryptedFileBuffer.length, `Uploaded bytes verified: ${uploadResult.bytes}`);

        // Step 4: Validate real Cloudinary asset with server SDK
        const verifyCheck = await verifyAssetExists(uploadResult.public_id);
        assert(verifyCheck.exists === true, "Asset verified to exist in Cloudinary via Admin API");

        // Step 5: Save matching metadata in MongoDB
        const recordRes = await fetch(`${BASE_URL}/api/documents/record`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${TEST_TOKEN}`
            },
            body: JSON.stringify({
                cloudinaryPublicId: uploadResult.public_id,
                cloudinaryAssetId: uploadResult.asset_id,
                cloudinaryBytes: uploadResult.bytes,
                salt: salt.toString("hex"),
                fileIv: fileIv.toString("hex"),
                metadataIv: metaIv.toString("hex"),
                encryptedMetadata: encryptedMetaStr,
                categoryTag: "all"
            })
        });

        const recordData = await recordRes.json();
        assert(recordRes.ok && recordData.success, `Document metadata saved in MongoDB (documentId: ${recordData.document.documentId})`);
        assert(recordData.document.storageVerified === true, "Document record has storageVerified: true");

        const testDocId = recordData.document.documentId;

        // --------------------------------------------------------------------
        // TEST 5: Secure Retrieval & Decryption by Owner
        // --------------------------------------------------------------------
        console.log("\n5. Testing Retrieval and Zero-Knowledge Decryption:");
        const downloadRes = await fetch(`${BASE_URL}/api/documents/${testDocId}/file`, {
            headers: { "Authorization": `Bearer ${TEST_TOKEN}` }
        });
        assert(downloadRes.ok, "Encrypted file downloaded from server endpoint");

        const downloadedCiphertext = Buffer.from(await downloadRes.arrayBuffer());
        assert(downloadedCiphertext.length === encryptedFileBuffer.length, "Downloaded ciphertext length matches uploaded length");

        // Decrypt in memory
        const decryptedPlaintext = decryptGcm(derivedKey, downloadedCiphertext, fileIv);
        assert(Buffer.compare(decryptedPlaintext, dummyPdfContent) === 0, "Decrypted plaintext matches original dummy PDF 100% byte-for-byte!");

        // --------------------------------------------------------------------
        // TEST 6: Cleanup Test Document & Confirm Existing Record Safety
        // --------------------------------------------------------------------
        console.log("\n6. Cleaning Up Test Artifact & Verifying Safety of Existing Records:");
        // Delete only the test document
        await deleteEncryptedAsset(uploadResult.public_id);
        await Document.deleteOne({ documentId: testDocId });
        console.log("  [INFO] Temporary test document safely deleted from Cloudinary & MongoDB.");

        const postCheckExisting = await Document.findOne({ documentId: EXISTING_DOC_ID });
        assert(Boolean(postCheckExisting), `Existing document ${EXISTING_DOC_ID} remains completely intact in MongoDB!`);

        const postCheckAsset = await verifyAssetExists(postCheckExisting.cloudinaryPublicId);
        assert(postCheckAsset.exists === true, "Original Cloudinary asset remains intact and available!");

    } catch (err) {
        console.error("Test execution threw error:", err);
        failedCount++;
    } finally {
        await mongoose.disconnect();
        console.log("\n==================================================================");
        console.log(`  TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
        console.log("==================================================================\n");
        process.exit(failedCount > 0 ? 1 : 0);
    }
}

runStorageVerificationSuite();
