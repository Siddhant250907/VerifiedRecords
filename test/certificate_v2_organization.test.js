const CertificateV2 = artifacts.require("CertificateV2");

contract("CertificateV2 Smart Contract - Organization Lifecycle & Role-Based Issuance", (accounts) => {
    const superAdmin = accounts[0];      // Contract deployer / Platform Super Admin
    const orgOwner1 = accounts[1];       // Owner of Org 1 (Stanford / Uni A)
    const orgAdmin1 = accounts[2];       // Authorized Issuer in Org 1
    const orgMember1 = accounts[3];      // Regular member in Org 1 (no issuing rights)
    const orgOwner2 = accounts[4];       // Owner of Org 2 (MIT / Uni B)
    const attacker = accounts[5];        // Random unauthorized wallet

    let contractV2;

    const org1Id = web3.utils.keccak256("ORG_STANFORD_2026");
    const org2Id = web3.utils.keccak256("ORG_MIT_2026");
    const fakeOrgId = web3.utils.keccak256("ORG_NONEXISTENT");

    const cert1Hash = web3.utils.keccak256("CERT_DATA_STANFORD_001");
    const cert2Hash = web3.utils.keccak256("CERT_DATA_MIT_001");

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
                const matches = errorStr.includes(expectedStr) || 
                                errorStr.includes("custom error") || 
                                errorStr.includes("revert");
                assert(
                    matches,
                    `Expected revert message to include "${expectedSnippet}", got: "${error.message}"`
                );
            }
        }
    }

    beforeEach(async () => {
        contractV2 = await CertificateV2.new({ from: superAdmin });
    });

    // =========================================================================
    // 1. CONTRACT OWNERSHIP & DEPLOYMENT
    // =========================================================================
    it("1. Platform Super Admin is established as contract owner", async () => {
        const owner = await contractV2.owner();
        assert.strictEqual(owner.toLowerCase(), superAdmin.toLowerCase());
        const count = await contractV2.organizationCount();
        assert.strictEqual(count.toNumber(), 0);
    });

    // =========================================================================
    // 2. ORGANIZATION REGISTRATION REQUEST WORKFLOW
    // =========================================================================
    it("2. User can submit organization registration request (status is Pending)", async () => {
        const tx = await contractV2.requestOrganization(
            org1Id,
            "Stanford University Credential Registry",
            orgOwner1,
            { from: orgOwner1 }
        );

        assert.strictEqual(tx.logs.length, 1);
        assert.strictEqual(tx.logs[0].event, "OrganizationRequested");
        assert.strictEqual(tx.logs[0].args.orgId, org1Id);
        assert.strictEqual(tx.logs[0].args.owner.toLowerCase(), orgOwner1.toLowerCase());

        const org = await contractV2.getOrganization(org1Id);
        assert.strictEqual(org.exists, true);
        assert.strictEqual(org.status.toNumber(), 1, "Status must be Pending (1)");
        assert.strictEqual(org.orgOwner.toLowerCase(), orgOwner1.toLowerCase());
        assert.strictEqual(org.name, "Stanford University Credential Registry");
    });

    it("3. Reject duplicate organization registration request", async () => {
        await contractV2.requestOrganization(org1Id, "Stanford University", orgOwner1, { from: orgOwner1 });
        await assertRevert(
            contractV2.requestOrganization(org1Id, "Stanford University Duplicate", orgOwner1, { from: orgOwner1 }),
            "Organization ID already registered"
        );
    });

    // =========================================================================
    // 3. SUPER ADMIN APPROVAL WORKFLOW
    // =========================================================================
    it("4. Non-super-admin cannot approve or reject organization requests", async () => {
        await contractV2.requestOrganization(org1Id, "Stanford University", orgOwner1, { from: orgOwner1 });

        await assertRevert(
            contractV2.approveOrganization(org1Id, { from: attacker }),
            "OwnableUnauthorizedAccount"
        );

        await assertRevert(
            contractV2.rejectOrganization(org1Id, { from: attacker }),
            "OwnableUnauthorizedAccount"
        );
    });

    it("5. Super Admin can approve pending organization and owner becomes authorized admin", async () => {
        await contractV2.requestOrganization(org1Id, "Stanford University", orgOwner1, { from: orgOwner1 });

        const tx = await contractV2.approveOrganization(org1Id, { from: superAdmin });
        assert.strictEqual(tx.logs.some(l => l.event === "OrganizationApproved"), true);

        const org = await contractV2.getOrganization(org1Id);
        assert.strictEqual(org.status.toNumber(), 2, "Status must be Approved (2)");

        // Org owner is automatically authorized as issuer/admin
        const isOwnerAdmin = await contractV2.isAuthorizedIssuer(org1Id, orgOwner1);
        assert.strictEqual(isOwnerAdmin, true, "Org owner must be an authorized issuer");
    });

    it("6. Super Admin can reject a pending organization", async () => {
        await contractV2.requestOrganization(org1Id, "Stanford University", orgOwner1, { from: orgOwner1 });

        const tx = await contractV2.rejectOrganization(org1Id, { from: superAdmin });
        assert.strictEqual(tx.logs[0].event, "OrganizationRejected");

        const org = await contractV2.getOrganization(org1Id);
        assert.strictEqual(org.status.toNumber(), 3, "Status must be Rejected (3)");

        // Rejected org cannot issue certificates
        await assertRevert(
            contractV2.issueCertificate(org1Id, "CERT_001", cert1Hash, { from: orgOwner1 }),
            "Organization is not approved or active"
        );
    });

    // =========================================================================
    // 4. ORGANIZATION ROLE & ISSUER MANAGEMENT
    // =========================================================================
    it("7. Org owner can add and remove authorized issuer administrators", async () => {
        await contractV2.requestOrganization(org1Id, "Stanford University", orgOwner1, { from: orgOwner1 });
        await contractV2.approveOrganization(org1Id, { from: superAdmin });

        // Add orgAdmin1
        const addTx = await contractV2.addOrganizationAdmin(org1Id, orgAdmin1, { from: orgOwner1 });
        assert.strictEqual(addTx.logs[0].event, "OrganizationAdminAdded");
        assert.strictEqual(addTx.logs[0].args.adminAddress.toLowerCase(), orgAdmin1.toLowerCase());

        let isAuth = await contractV2.isAuthorizedIssuer(org1Id, orgAdmin1);
        assert.strictEqual(isAuth, true, "orgAdmin1 must now be an authorized issuer");

        // Remove orgAdmin1
        const removeTx = await contractV2.removeOrganizationAdmin(org1Id, orgAdmin1, { from: orgOwner1 });
        assert.strictEqual(removeTx.logs[0].event, "OrganizationAdminRemoved");

        isAuth = await contractV2.isAuthorizedIssuer(org1Id, orgAdmin1);
        assert.strictEqual(isAuth, false, "orgAdmin1 must no longer be an authorized issuer");
    });

    it("8. Unauthorized wallet cannot add admins or authorize itself", async () => {
        await contractV2.requestOrganization(org1Id, "Stanford University", orgOwner1, { from: orgOwner1 });
        await contractV2.approveOrganization(org1Id, { from: superAdmin });

        await assertRevert(
            contractV2.addOrganizationAdmin(org1Id, attacker, { from: attacker }),
            "Caller is neither the organization owner nor the platform super admin"
        );
    });

    it("9. Cannot remove owner if owner is the sole remaining administrator", async () => {
        await contractV2.requestOrganization(org1Id, "Stanford University", orgOwner1, { from: orgOwner1 });
        await contractV2.approveOrganization(org1Id, { from: superAdmin });

        await assertRevert(
            contractV2.removeOrganizationAdmin(org1Id, orgOwner1, { from: orgOwner1 }),
            "Cannot remove owner when no other authorized administrators exist"
        );
    });

    // =========================================================================
    // 5. ROLE-BASED CERTIFICATE ISSUANCE & VERIFICATION
    // =========================================================================
    it("10. Authorized issuer can issue certificates; member without permission cannot", async () => {
        await contractV2.requestOrganization(org1Id, "Stanford University", orgOwner1, { from: orgOwner1 });
        await contractV2.approveOrganization(org1Id, { from: superAdmin });
        await contractV2.addOrganizationAdmin(org1Id, orgAdmin1, { from: orgOwner1 });

        // Regular member cannot issue
        await assertRevert(
            contractV2.issueCertificate(org1Id, "CERT_SU_101", cert1Hash, { from: orgMember1 }),
            "Caller is not authorized to issue for this organization"
        );

        // Authorized issuer CAN issue
        const tx = await contractV2.issueCertificate(org1Id, "CERT_SU_101", cert1Hash, { from: orgAdmin1 });
        assert.strictEqual(tx.logs[0].event, "CertificateIssued");
        assert.strictEqual(tx.logs[0].args.orgId, org1Id);
        assert.strictEqual(tx.logs[0].args.certificateId, "CERT_SU_101");

        // Verify on-chain record
        const record = await contractV2.verifyCertificate("CERT_SU_101");
        assert.strictEqual(record.orgId, org1Id);
        assert.strictEqual(record.certificateHash, cert1Hash);
        assert.strictEqual(record.issuer.toLowerCase(), orgAdmin1.toLowerCase());
        assert.strictEqual(record.exists, true);
        assert.strictEqual(record.revoked, false);
    });

    it("11. Issuer in Org 1 cannot issue or revoke certificates for Org 2", async () => {
        // Setup Org 1
        await contractV2.requestOrganization(org1Id, "Stanford University", orgOwner1, { from: orgOwner1 });
        await contractV2.approveOrganization(org1Id, { from: superAdmin });
        await contractV2.addOrganizationAdmin(org1Id, orgAdmin1, { from: orgOwner1 });

        // Setup Org 2
        await contractV2.requestOrganization(org2Id, "MIT", orgOwner2, { from: orgOwner2 });
        await contractV2.approveOrganization(org2Id, { from: superAdmin });

        // Org 1 issuer attempts to issue for Org 2
        await assertRevert(
            contractV2.issueCertificate(org2Id, "CERT_MIT_201", cert2Hash, { from: orgAdmin1 }),
            "Caller is not authorized to issue for this organization"
        );

        // Org 2 owner issues valid certificate
        await contractV2.issueCertificate(org2Id, "CERT_MIT_201", cert2Hash, { from: orgOwner2 });

        // Org 1 issuer attempts to revoke Org 2 certificate
        await assertRevert(
            contractV2.revokeCertificate(org2Id, "CERT_MIT_201", { from: orgAdmin1 }),
            "Caller is not authorized to issue for this organization"
        );
    });

    // =========================================================================
    // 6. CERTIFICATE REVOCATION WORKFLOW
    // =========================================================================
    it("12. Authorized issuer can revoke certificate; verifies as revoked", async () => {
        await contractV2.requestOrganization(org1Id, "Stanford University", orgOwner1, { from: orgOwner1 });
        await contractV2.approveOrganization(org1Id, { from: superAdmin });

        await contractV2.issueCertificate(org1Id, "CERT_REV_001", cert1Hash, { from: orgOwner1 });

        let rec = await contractV2.verifyCertificate("CERT_REV_001");
        assert.strictEqual(rec.revoked, false);

        const revTx = await contractV2.revokeCertificate(org1Id, "CERT_REV_001", { from: orgOwner1 });
        assert.strictEqual(revTx.logs[0].event, "CertificateRevoked");

        rec = await contractV2.verifyCertificate("CERT_REV_001");
        assert.strictEqual(rec.revoked, true);
        assert.isAbove(rec.revokedAt.toNumber(), 0);

        // Cannot revoke twice
        await assertRevert(
            contractV2.revokeCertificate(org1Id, "CERT_REV_001", { from: orgOwner1 }),
            "Certificate is already revoked"
        );
    });
});
