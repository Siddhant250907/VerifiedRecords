const Certificate = artifacts.require("Certificate");

contract("Certificate Smart Contract Access Control & Hardening Test Suite", (accounts) => {
    const owner = accounts[0];
    const admin1 = accounts[1];
    const admin2 = accounts[2];
    const unauthorizedUser = accounts[3];
    const studentUser = accounts[4];

    let certificate;

    // Helper wrappers for overloaded contract functions
    const registerAdminWithAddress = (id, addr, tx) =>
        certificate.methods["registerAdmin(string,address)"](id, addr, tx);

    const registerAdminSelf = (id, tx) =>
        certificate.methods["registerAdmin(string)"](id, tx);

    const revokeAdminByAddress = (addr, tx) =>
        certificate.methods["revokeAdmin(address)"](addr, tx);

    const revokeAdminById = (id, tx) =>
        certificate.methods["revokeAdmin(string)"](id, tx);

    // Deterministic test hashes
    const sampleHash1 = web3.utils.keccak256("CERT_DATA_PAYLOAD_1");
    const sampleHash2 = web3.utils.keccak256("CERT_DATA_PAYLOAD_2");
    const sampleHash3 = web3.utils.keccak256("CERT_DATA_PAYLOAD_3");
    const emptyHash = "0x0000000000000000000000000000000000000000000000000000000000000000";

    // Reusable helper to assert reverts cleanly
    async function assertRevert(promise, expectedSnippet) {
        try {
            await promise;
            assert.fail("Expected transaction to revert, but it succeeded.");
        } catch (error) {
            if (error.message.includes("Expected transaction to revert")) {
                throw error;
            }
            if (expectedSnippet) {
                const errorStr = (error.message || "").toLowerCase();
                const expectedStr = expectedSnippet.toLowerCase();
                const matches = errorStr.includes(expectedStr);
                assert(
                    matches,
                    `Expected revert message to include "${expectedSnippet}", but got: "${error.message}"`
                );
            }
        }
    }

    beforeEach(async () => {
        // Deploy a fresh contract instance for each test case
        certificate = await Certificate.new({ from: owner });
    });

    // =========================================================================
    // 1. OWNERSHIP & INITIALIZATION
    // =========================================================================
    it("1. Contract deployment establishes the deployer as owner", async () => {
        const contractOwner = await certificate.owner();
        assert.strictEqual(
            contractOwner.toLowerCase(),
            owner.toLowerCase(),
            "Contract deployer must be set as initial owner"
        );
        const count = await certificate.adminCount();
        assert.strictEqual(count.toNumber(), 0, "Initial adminCount must be 0");
    });

    // =========================================================================
    // 2. ADMIN REGISTRATION PERMISSIONS
    // =========================================================================
    it("2. The owner can register an administrator with a designated address", async () => {
        const tx = await registerAdminWithAddress("REGISTRAR_01", admin1, { from: owner });

        // Verify state changes
        const isAdmin = await certificate.isRegisteredAdmin(admin1);
        assert.strictEqual(isAdmin, true, "admin1 must be registered as admin");

        const count = await certificate.adminCount();
        assert.strictEqual(count.toNumber(), 1, "adminCount must be 1 after registration");

        // Verify on-chain record query
        const record = await certificate.getAdmin("REGISTRAR_01");
        assert.strictEqual(record.userId, "REGISTRAR_01");
        assert.strictEqual(record.adminAddress.toLowerCase(), admin1.toLowerCase());
        assert.strictEqual(record.exists, true);

        // Verify event emission
        assert.strictEqual(tx.logs.length, 1, "AdminRegistered event must be emitted");
        assert.strictEqual(tx.logs[0].event, "AdminRegistered");
        assert.strictEqual(tx.logs[0].args.adminUserId, "REGISTRAR_01");
        assert.strictEqual(tx.logs[0].args.adminAddress.toLowerCase(), admin1.toLowerCase());
    });

    it("2b. The owner can register their own wallet under an admin ID", async () => {
        await registerAdminSelf("OWNER_ADMIN", { from: owner });
        const isOwnerAdmin = await certificate.isRegisteredAdmin(owner);
        assert.strictEqual(isOwnerAdmin, true, "Owner wallet must be registered as admin");
    });

    it("3. An unauthorized account cannot register an administrator", async () => {
        // Unauthorized user attempts to register someone else
        await assertRevert(
            registerAdminWithAddress("HACKER_ADMIN", admin2, { from: unauthorizedUser })
        );

        // Unauthorized user attempts to register themselves
        await assertRevert(
            registerAdminSelf("SELF_HACK", { from: unauthorizedUser })
        );

        const isAdmin = await certificate.isRegisteredAdmin(unauthorizedUser);
        assert.strictEqual(isAdmin, false, "Unauthorized user must not become admin");
    });

    it("3b. Registration rejects duplicate user IDs or duplicate addresses", async () => {
        await registerAdminWithAddress("REG_ALPHA", admin1, { from: owner });

        // Duplicate adminUserId
        await assertRevert(
            registerAdminWithAddress("REG_ALPHA", admin2, { from: owner }),
            "Admin USER ID already registered on-chain"
        );

        // Duplicate address
        await assertRevert(
            registerAdminWithAddress("REG_BETA", admin1, { from: owner }),
            "Admin address already registered"
        );
    });

    // =========================================================================
    // 3. CERTIFICATE ISSUANCE PERMISSIONS
    // =========================================================================
    it("4. An authorized administrator can issue a certificate", async () => {
        await registerAdminWithAddress("REGISTRAR_01", admin1, { from: owner });

        const tx = await certificate.issueCertificate("CERT_001", sampleHash1, { from: admin1 });

        // Verify CertificateIssued event
        assert.strictEqual(tx.logs.length, 1);
        assert.strictEqual(tx.logs[0].event, "CertificateIssued");
        assert.strictEqual(tx.logs[0].args.certificateId, "CERT_001");
        assert.strictEqual(tx.logs[0].args.certificateHash, sampleHash1);
        assert.strictEqual(tx.logs[0].args.issuer.toLowerCase(), admin1.toLowerCase());

        // Verify on-chain record
        const cert = await certificate.verifyCertificate("CERT_001");
        assert.strictEqual(cert.certificateHash, sampleHash1);
        assert.strictEqual(cert.issuer.toLowerCase(), admin1.toLowerCase());
        assert.strictEqual(cert.exists, true);
        assert(cert.issuedAt.toNumber() > 0);
    });

    it("5. The owner can issue a certificate directly", async () => {
        const tx = await certificate.issueCertificate("CERT_OWNER_001", sampleHash2, { from: owner });

        const cert = await certificate.verifyCertificate("CERT_OWNER_001");
        assert.strictEqual(cert.certificateHash, sampleHash2);
        assert.strictEqual(cert.issuer.toLowerCase(), owner.toLowerCase());
        assert.strictEqual(cert.exists, true);
    });

    it("6. An unauthorized account cannot issue a certificate", async () => {
        await assertRevert(
            certificate.issueCertificate("CERT_FRAUD_001", sampleHash1, { from: unauthorizedUser }),
            "Caller is not authorized to issue certificates"
        );

        const cert = await certificate.verifyCertificate("CERT_FRAUD_001");
        assert.strictEqual(cert.exists, false, "Certificate must not exist on-chain");
    });

    // =========================================================================
    // 4. CERTIFICATE DATA INTEGRITY CONSTRAINTS
    // =========================================================================
    it("7. Duplicate certificate IDs are rejected", async () => {
        await certificate.issueCertificate("CERT_DUP_001", sampleHash1, { from: owner });

        // Attempt to issue with same ID but different hash
        await assertRevert(
            certificate.issueCertificate("CERT_DUP_001", sampleHash2, { from: owner }),
            "Certificate already registered"
        );
    });

    it("8. Empty certificate IDs are rejected", async () => {
        await assertRevert(
            certificate.issueCertificate("", sampleHash1, { from: owner }),
            "Certificate ID cannot be empty"
        );
    });

    it("9. Empty certificate hashes are rejected", async () => {
        await assertRevert(
            certificate.issueCertificate("CERT_EMPTY_HASH", emptyHash, { from: owner }),
            "Certificate hash cannot be empty"
        );
    });

    it("10. verifyCertificate returns correct record for valid certificate and exists=false for nonexistent", async () => {
        await certificate.issueCertificate("CERT_LOOKUP_001", sampleHash3, { from: owner });

        // Query existing certificate
        const validRecord = await certificate.verifyCertificate("CERT_LOOKUP_001");
        assert.strictEqual(validRecord.certificateHash, sampleHash3);
        assert.strictEqual(validRecord.issuer.toLowerCase(), owner.toLowerCase());
        assert.strictEqual(validRecord.exists, true);
        assert(validRecord.issuedAt.toNumber() > 0);

        // Query nonexistent certificate
        const missingRecord = await certificate.verifyCertificate("NON_EXISTENT_ID");
        assert.strictEqual(missingRecord.exists, false);
        assert.strictEqual(missingRecord.issuedAt.toNumber(), 0);
        assert.strictEqual(missingRecord.certificateHash, emptyHash);
    });

    // =========================================================================
    // 5. ADMINISTRATOR REVOCATION LIFECYCLE
    // =========================================================================
    it("11. A registered administrator can be revoked by the owner", async () => {
        await registerAdminWithAddress("REG_REVOKE_01", admin1, { from: owner });
        assert.strictEqual(await certificate.isRegisteredAdmin(admin1), true);
        assert.strictEqual((await certificate.adminCount()).toNumber(), 1);

        // Revoke by address
        const tx = await revokeAdminByAddress(admin1, { from: owner });
        assert.strictEqual(tx.logs.length, 1);
        assert.strictEqual(tx.logs[0].event, "AdminRevoked");
        assert.strictEqual(tx.logs[0].args.adminAddress.toLowerCase(), admin1.toLowerCase());

        // Verify status
        assert.strictEqual(await certificate.isRegisteredAdmin(admin1), false);
        assert.strictEqual((await certificate.adminCount()).toNumber(), 0);

        const adminRecord = await certificate.getAdmin("REG_REVOKE_01");
        assert.strictEqual(adminRecord.exists, false, "Admin record exists flag must be false");
    });

    it("11b. An administrator can also be revoked by admin user ID", async () => {
        await registerAdminWithAddress("REG_REVOKE_02", admin2, { from: owner });
        assert.strictEqual(await certificate.isRegisteredAdmin(admin2), true);

        // Revoke by ID string
        await revokeAdminById("REG_REVOKE_02", { from: owner });
        assert.strictEqual(await certificate.isRegisteredAdmin(admin2), false);
    });

    it("11c. An unauthorized user cannot revoke an administrator", async () => {
        await registerAdminWithAddress("REG_SECURE", admin1, { from: owner });

        await assertRevert(
            revokeAdminByAddress(admin1, { from: unauthorizedUser })
        );

        assert.strictEqual(await certificate.isRegisteredAdmin(admin1), true, "Admin must remain registered");
    });

    it("12. A revoked administrator cannot issue certificates afterward", async () => {
        await registerAdminWithAddress("REG_TEMP", admin1, { from: owner });

        // While authorized, issuance succeeds
        await certificate.issueCertificate("CERT_BEFORE_REVOKE", sampleHash1, { from: admin1 });
        const cert1 = await certificate.verifyCertificate("CERT_BEFORE_REVOKE");
        assert.strictEqual(cert1.exists, true);

        // Revoke admin1
        await revokeAdminByAddress(admin1, { from: owner });
        assert.strictEqual(await certificate.isRegisteredAdmin(admin1), false);

        // After revocation, issuance must revert
        await assertRevert(
            certificate.issueCertificate("CERT_AFTER_REVOKE", sampleHash2, { from: admin1 }),
            "Caller is not authorized to issue certificates"
        );

        const cert2 = await certificate.verifyCertificate("CERT_AFTER_REVOKE");
        assert.strictEqual(cert2.exists, false, "Post-revocation certificate must not exist");
    });
});
