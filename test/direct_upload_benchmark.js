const crypto = require("crypto");

// ============================================================================
// DIRECT CLOUDINARY UPLOAD BENCHMARK & DIAGNOSTIC TEST
// Measures exact stage durations for:
// 1. Client-side AES-256-GCM encryption
// 2. Auth & upload signature request
// 3. Direct Cloudinary upload
// 4. MongoDB metadata persistence
// 5. Total save duration
// Also verifies end-to-end authenticated retrieval and zero-knowledge decryption.
// ============================================================================

// Helper to create a dummy PDF file buffer
function generateDummyPdf(sizeBytes = 25000) {
    const header = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources <<>> /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length " + (sizeBytes) + " >>\nstream\n";
    const footer = "\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000214 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n350\n%%EOF";
    
    const bodyLength = Math.max(100, sizeBytes - header.length - footer.length);
    const body = Buffer.alloc(bodyLength, "A");
    return Buffer.concat([Buffer.from(header), body, Buffer.from(footer)]);
}

// Client-side WebCrypto / Node crypto equivalent for AES-256-GCM
function deriveKeySync(password, salt, iterations = 100000) {
    return crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
}

function encryptAesGcm(key, plaintextBuffer, iv) {
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([ciphertext, authTag]); // Matches WebCrypto AES-GCM output
}

function decryptAesGcm(key, encryptedBuffer, iv) {
    const authTag = encryptedBuffer.subarray(encryptedBuffer.length - 16);
    const ciphertext = encryptedBuffer.subarray(0, encryptedBuffer.length - 16);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

async function runBenchmark() {
    console.log("================================================================");
    console.log("🚀 STARTING DIRECT CLOUDINARY UPLOAD BENCHMARK & DIAGNOSTIC TEST");
    console.log("================================================================");

    const testPassword = "VaultBenchmarkPassword2026!#";
    const dummyPdf = generateDummyPdf(45000); // ~45 KB dummy PDF
    const serverBaseUrl = "http://localhost:3000";
    const testAuthToken = "test-token-benchmark_diagnostics_user";

    console.log(`📄 Test Dummy PDF Generated: ${dummyPdf.length} bytes (${(dummyPdf.length / 1024).toFixed(2)} KB)`);

    const stageTimings = {
        encryptionMs: 0,
        authSignatureMs: 0,
        cloudinaryUploadMs: 0,
        mongoPersistenceMs: 0,
        totalSaveDurationMs: 0
    };

    const overallStart = performance.now();

    // ------------------------------------------------------------------------
    // STAGE 1: Client-side AES-256-GCM Encryption
    // ------------------------------------------------------------------------
    const t0Enc = performance.now();
    const salt = crypto.randomBytes(16);
    const fileIv = crypto.randomBytes(12);
    const metadataIv = crypto.randomBytes(12);

    const derivedKey = deriveKeySync(testPassword, salt, 100000);
    const encryptedFileBuffer = encryptAesGcm(derivedKey, dummyPdf, fileIv);

    const metadataObj = {
        title: "Benchmark Academic Record 2026",
        fileName: "dummy_benchmark_transcript.pdf",
        category: "marksheets",
        notes: "Automated benchmark diagnostic record",
        mimeType: "application/pdf",
        fileSize: dummyPdf.length,
        lastModified: Date.now()
    };
    const encryptedMetadataBuffer = encryptAesGcm(derivedKey, Buffer.from(JSON.stringify(metadataObj)), metadataIv);
    const encryptedMetadataHex = encryptedMetadataBuffer.toString("hex");

    stageTimings.encryptionMs = performance.now() - t0Enc;
    console.log(`✅ [Stage 1] Client Encryption: ${stageTimings.encryptionMs.toFixed(2)} ms (Ciphertext: ${encryptedFileBuffer.length} bytes)`);

    // ------------------------------------------------------------------------
    // STAGE 2: Firebase Auth & Upload Signature Request
    // ------------------------------------------------------------------------
    const t0Auth = performance.now();
    const signRes = await fetch(`${serverBaseUrl}/api/documents/sign-upload`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${testAuthToken}`
        }
    });

    if (!signRes.ok) {
        throw new Error(`Sign upload request failed with HTTP ${signRes.status}: ${await signRes.text()}`);
    }

    const signData = await signRes.json();
    if (!signData.success || !signData.signature || !signData.publicId) {
        throw new Error("Invalid signature response from server: " + JSON.stringify(signData));
    }

    stageTimings.authSignatureMs = performance.now() - t0Auth;
    console.log(`✅ [Stage 2] Auth & Signature Request: ${stageTimings.authSignatureMs.toFixed(2)} ms (Public ID allocated: ${signData.publicId})`);

    // ------------------------------------------------------------------------
    // STAGE 3: Direct Browser-to-Cloudinary Raw Upload
    // ------------------------------------------------------------------------
    const t0Upload = performance.now();
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

    if (!uploadRes.ok) {
        throw new Error(`Direct Cloudinary upload failed with HTTP ${uploadRes.status}: ${await uploadRes.text()}`);
    }

    const cloudinaryResult = await uploadRes.json();
    stageTimings.cloudinaryUploadMs = performance.now() - t0Upload;
    console.log(`✅ [Stage 3] Direct Cloudinary Upload: ${stageTimings.cloudinaryUploadMs.toFixed(2)} ms (Bytes confirmed: ${cloudinaryResult.bytes})`);

    // ------------------------------------------------------------------------
    // STAGE 4: MongoDB Metadata Persistence
    // ------------------------------------------------------------------------
    const t0Mongo = performance.now();
    const recordPayload = {
        cloudinaryPublicId: cloudinaryResult.public_id || signData.publicId,
        cloudinaryAssetId: cloudinaryResult.asset_id || null,
        cloudinaryBytes: cloudinaryResult.bytes || encryptedFileBuffer.length,
        salt: salt.toString("hex"),
        fileIv: fileIv.toString("hex"),
        metadataIv: metadataIv.toString("hex"),
        encryptedMetadata: encryptedMetadataHex,
        categoryTag: "marksheets",
        blockchainProof: null
    };

    const recordRes = await fetch(`${serverBaseUrl}/api/documents/record`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${testAuthToken}`
        },
        body: JSON.stringify(recordPayload)
    });

    if (!recordRes.ok) {
        throw new Error(`Metadata persistence failed with HTTP ${recordRes.status}: ${await recordRes.text()}`);
    }

    const recordData = await recordRes.json();
    stageTimings.mongoPersistenceMs = performance.now() - t0Mongo;
    stageTimings.totalSaveDurationMs = performance.now() - overallStart;

    console.log(`✅ [Stage 4] MongoDB Metadata Persistence: ${stageTimings.mongoPersistenceMs.toFixed(2)} ms`);
    console.log(`🏆 [Stage 5] Total Save Duration: ${stageTimings.totalSaveDurationMs.toFixed(2)} ms (${(stageTimings.totalSaveDurationMs / 1000).toFixed(2)}s)`);

    const documentId = recordData.document && recordData.document.documentId;
    console.log(`\n📋 Saved Document ID: ${documentId}`);

    // ------------------------------------------------------------------------
    // VERIFICATION: Download & Decrypt to confirm data integrity
    // ------------------------------------------------------------------------
    console.log("\n🔒 Verifying Authenticated Download & Zero-Knowledge Decryption...");
    const downloadRes = await fetch(`${serverBaseUrl}/api/documents/${documentId}/file`, {
        headers: { "Authorization": `Bearer ${testAuthToken}` }
    });

    if (!downloadRes.ok) {
        throw new Error(`Download verification failed with HTTP ${downloadRes.status}`);
    }

    const downloadedEncryptedBuffer = Buffer.from(await downloadRes.arrayBuffer());
    console.log(`⬇️ Downloaded Ciphertext: ${downloadedEncryptedBuffer.length} bytes`);

    const decryptedPlaintext = decryptAesGcm(derivedKey, downloadedEncryptedBuffer, fileIv);
    const contentMatches = Buffer.compare(dummyPdf, decryptedPlaintext) === 0;

    if (!contentMatches) {
        throw new Error("❌ Decrypted content does NOT match original dummy PDF buffer!");
    }
    console.log("✅ Decryption successful: Plaintext matches original dummy PDF byte-for-byte!");

    // ------------------------------------------------------------------------
    // CLEANUP
    // ------------------------------------------------------------------------
    console.log("\n🧹 Cleaning up test document and Cloudinary asset...");
    const deleteRes = await fetch(`${serverBaseUrl}/api/documents/${documentId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${testAuthToken}` }
    });
    const deleteData = await deleteRes.json();
    console.log(`✅ Cleanup result: ${deleteData.message || "Document deleted"}`);

    // ------------------------------------------------------------------------
    // DIAGNOSTIC SUMMARY REPORT
    // ------------------------------------------------------------------------
    console.log("\n================================================================");
    console.log("📊 DIAGNOSTIC TIMING BREAKDOWN SUMMARY");
    console.log("================================================================");
    console.log(`1. Client-Side Encryption:               ${stageTimings.encryptionMs.toFixed(2)} ms  (${(stageTimings.encryptionMs / stageTimings.totalSaveDurationMs * 100).toFixed(1)}%)`);
    console.log(`2. Firebase Auth & Signature Request:    ${stageTimings.authSignatureMs.toFixed(2)} ms  (${(stageTimings.authSignatureMs / stageTimings.totalSaveDurationMs * 100).toFixed(1)}%)`);
    console.log(`3. Direct Cloudinary Upload:             ${stageTimings.cloudinaryUploadMs.toFixed(2)} ms  (${(stageTimings.cloudinaryUploadMs / stageTimings.totalSaveDurationMs * 100).toFixed(1)}%)`);
    console.log(`4. MongoDB Metadata Persistence:         ${stageTimings.mongoPersistenceMs.toFixed(2)} ms  (${(stageTimings.mongoPersistenceMs / stageTimings.totalSaveDurationMs * 100).toFixed(1)}%)`);
    console.log(`----------------------------------------------------------------`);
    console.log(`5. Total Save Duration:                  ${stageTimings.totalSaveDurationMs.toFixed(2)} ms  (100.0%)`);
    console.log("================================================================\n");

    return stageTimings;
}

runBenchmark().catch((err) => {
    console.error("❌ Benchmark Failed:", err);
    process.exit(1);
});
