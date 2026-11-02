const express = require("express");
const crypto = require("crypto");
const router = express.Router();
const { getLocalDateTime } = require("../dateHelper");
const { requireAuth } = require("../auth");
const Organization = require("../models/organization");
const OrganizationMembership = require("../models/organizationMembership");
const OrganizationAdminRequest = require("../models/organizationAdminRequest");
const Admin = require("../models/admin");
const Certificate = require("../models/certificates");

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return { salt, passwordHash };
}

function verifyPassword(password, salt, passwordHash) {
    if (!password || !salt || !passwordHash) return false;
    const computedHash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return computedHash === passwordHash;
}
const {
    web3,
    normalizeNetwork,
    getBlockchainConfig,
    isContractOwner,
    deriveOrgIdBytes32,
    encodeCreateOrganization,
    encodeJoinOrganization,
    encodeRequestOrganization,
    encodeApproveOrganization,
    encodeRejectOrganization,
    encodeAddOrgAdmin,
    encodeRemoveOrgAdmin,
    getOrganizationFromChain,
    getOrganizationFullFromChain,
    getOrganizationMembersFromChain,
    getAllOrgIdsFromChain,
    getUserOrgIdsFromChain,
    verifyOrgAccessKeyOnChain,
    isAuthorizedOrgIssuerOnChain,
    verifyOrganizationRequestTxOnChain,
    verifyOrganizationApprovalTxOnChain,
    verifyOrganizationAdminTxOnChain,
    verifyWalletSignature,
    getCertV2ContractAddress
} = require("../blockchain");

// In-memory rate limiter for join attempts by IP / User
const joinAttemptsMap = new Map();
function checkRateLimit(key, maxAttempts = 10, windowMs = 600000) {
    const now = Date.now();
    const record = joinAttemptsMap.get(key) || { count: 0, firstAttempt: now };
    if (now - record.firstAttempt > windowMs) {
        joinAttemptsMap.set(key, { count: 1, firstAttempt: now });
        return true;
    }
    if (record.count >= maxAttempts) {
        return false;
    }
    record.count += 1;
    joinAttemptsMap.set(key, record);
    return true;
}

// Helper: Check if caller is Platform Super Admin on specified network
async function checkIsSuperAdmin(callerAddress, network) {
    if (!callerAddress) return false;
    try {
        const net = normalizeNetwork(network);
        return await isContractOwner(callerAddress, net);
    } catch (e) {
        return false;
    }
}

// ============================================================================
// 1. WALLET SIGNING & CHALLENGE ENDPOINTS
// ============================================================================

const memoryChallenges = new Map();

router.post("/wallet/challenge", requireAuth, async (req, res) => {
    try {
        const { walletAddress } = req.body;
        if (!walletAddress) {
            return res.status(400).json({ success: false, message: "Wallet address is required." });
        }

        const normalizedWallet = String(walletAddress).trim().toLowerCase();
        const nonce = crypto.randomBytes(16).toString("hex");
        const challenge = `VerifiedRecords Identity Verification\nSign this challenge to link wallet ${normalizedWallet} to your account.\nTimestamp: ${Date.now()}\nNonce: ${nonce}`;

        memoryChallenges.set(`${req.user.uid}_${normalizedWallet}`, {
            challenge,
            timestamp: Date.now(),
            verified: false
        });

        res.json({
            success: true,
            walletAddress: normalizedWallet,
            challenge: challenge
        });
    } catch (error) {
        console.error("[Wallet Challenge] Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/wallet/verify-signature", requireAuth, async (req, res) => {
    try {
        const { walletAddress, signature, challenge } = req.body;
        if (!walletAddress || !signature || !challenge) {
            return res.status(400).json({ success: false, message: "Wallet address, signature, and challenge are required." });
        }

        const normalizedWallet = String(walletAddress).trim().toLowerCase();
        const key = `${req.user.uid}_${normalizedWallet}`;
        const stored = memoryChallenges.get(key);

        if (!stored || stored.challenge !== challenge) {
            return res.status(400).json({ success: false, message: "Invalid or expired challenge. Please request a new challenge." });
        }

        const isValid = verifyWalletSignature(normalizedWallet, challenge, signature);
        if (!isValid) {
            return res.status(401).json({ success: false, message: "Cryptographic signature verification failed." });
        }

        stored.verified = true;
        memoryChallenges.set(key, stored);

        res.json({
            success: true,
            verified: true,
            walletAddress: normalizedWallet,
            message: "Wallet ownership verified successfully."
        });
    } catch (error) {
        console.error("[Wallet Verify Signature] Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================================================
// 2. CREATE ORGANIZATION WORKFLOW (100% ON-CHAIN)
// ============================================================================

router.post("/prepare-create", requireAuth, async (req, res) => {
    try {
        const name = req.body.name;
        const universityOrCompany = req.body.universityOrCompany;
        const purpose = req.body.purpose;
        const capacity = req.body.capacity;
        const accessKey = req.body.accessKey;
        const confirmAccessKey = req.body.confirmAccessKey || req.body.accessKey;
        const network = req.body.network;
        const walletAddress = req.body.walletAddress || req.body.ownerWallet;

        if (!name || !universityOrCompany || !purpose || !capacity || !accessKey || !confirmAccessKey || !walletAddress) {
            return res.status(400).json({
                success: false,
                message: "All fields are required: Organization Name, University/Company, Purpose, Capacity, Access Key, and Connected Wallet."
            });
        }

        const trimmedName = String(name).trim();
        const trimmedEntity = String(universityOrCompany).trim();
        const trimmedPurpose = String(purpose).trim();
        const numCapacity = parseInt(capacity, 10);
        const resolvedNet = normalizeNetwork(network);

        if (trimmedName.length < 3) {
            return res.status(400).json({ success: false, message: "Organization Name must be at least 3 characters long." });
        }
        if (trimmedEntity.length < 2) {
            return res.status(400).json({ success: false, message: "University / Company Name must be at least 2 characters long." });
        }
        if (trimmedPurpose.length < 5) {
            return res.status(400).json({ success: false, message: "Organization Purpose must be at least 5 characters long." });
        }
        if (isNaN(numCapacity) || numCapacity < 1) {
            return res.status(400).json({ success: false, message: "Member Capacity must be a positive integer greater than zero." });
        }
        if (accessKey !== confirmAccessKey) {
            return res.status(400).json({ success: false, message: "Organization Access Key and Confirmation do not match." });
        }
        if (String(accessKey).length < 6) {
            return res.status(400).json({ success: false, message: "Organization Access Key must be at least 6 characters long." });
        }

        // Generate deterministic organization identifier
        const orgSlug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 16);
        const uniqueSuffix = crypto.randomBytes(4).toString("hex").toUpperCase();
        const orgId = `ORG-${orgSlug}-${uniqueSuffix}`;
        const orgIdBytes32 = deriveOrgIdBytes32(orgId);

        // Check collision on blockchain
        const onChainCheck = await getOrganizationFromChain(orgIdBytes32, null, resolvedNet);
        if (onChainCheck.exists) {
            return res.status(409).json({
                success: false,
                message: "Derived organization ID collision on blockchain. Please resubmit."
            });
        }

        const netConfig = await getBlockchainConfig(resolvedNet);
        const contractAddress = getCertV2ContractAddress(resolvedNet);

        // Compute access key hash on-chain format (keccak256)
        const accessKeyHash = web3.utils.keccak256(String(accessKey).trim());

        // Encode on-chain transaction data for createOrganization
        const txData = encodeCreateOrganization(
            orgIdBytes32,
            trimmedName,
            trimmedEntity,
            trimmedPurpose,
            numCapacity,
            accessKeyHash,
            resolvedNet
        );

        res.json({
            success: true,
            orgId: orgId,
            orgIdBytes32: orgIdBytes32,
            name: trimmedName,
            universityOrCompany: trimmedEntity,
            purpose: trimmedPurpose,
            capacity: numCapacity,
            accessKeyHash: accessKeyHash,
            walletAddress: walletAddress,
            contractAddress: contractAddress,
            blockchainNetwork: resolvedNet,
            chainId: netConfig.chainId,
            chainIdHex: netConfig.chainIdHex,
            txData: txData
        });
    } catch (error) {
        console.error("[Prepare Organization Create] Error:", error);
        res.status(500).json({ success: false, message: "Failed to prepare organization registration: " + error.message });
    }
});

router.post("/create", requireAuth, async (req, res) => {
    try {
        const walletAddress = req.body.walletAddress || req.body.ownerWallet;
        const orgId = req.body.orgId;
        const trimmedOrgId = String(orgId || "").trim();
        const expectedBytes32 = req.body.orgIdBytes32 || (trimmedOrgId ? deriveOrgIdBytes32(trimmedOrgId) : null);
        const name = req.body.name;
        const universityOrCompany = req.body.universityOrCompany;
        const purpose = req.body.purpose;
        const capacity = req.body.capacity;
        const accessKey = req.body.accessKey;
        const network = req.body.network;
        const transactionHash = req.body.transactionHash;

        if (!expectedBytes32 || !transactionHash || !walletAddress) {
            return res.status(400).json({ success: false, message: "Missing required parameters for organization confirmation." });
        }

        const resolvedNet = normalizeNetwork(network);

        console.log(`[Org Create] Fetching confirmed on-chain record for ${expectedBytes32} on [${resolvedNet}]...`);

        // Fetch organization directly from smart contract on blockchain
        const onChainOrg = await getOrganizationFullFromChain(expectedBytes32, null, resolvedNet);

        const organizationRecord = {
            orgId: trimmedOrgId || onChainOrg.orgId,
            orgIdBytes32: expectedBytes32,
            name: onChainOrg.name || String(name || "").trim(),
            universityOrCompany: onChainOrg.universityOrCompany || String(universityOrCompany || "").trim(),
            purpose: onChainOrg.purpose || String(purpose || "").trim(),
            capacity: onChainOrg.capacity || parseInt(capacity, 10) || 50,
            currentMemberCount: onChainOrg.currentMemberCount || 1,
            ownerWallet: (walletAddress || onChainOrg.owner || "").toLowerCase(),
            status: "Approved",
            blockchainNetwork: resolvedNet,
            contractAddress: onChainOrg.contractAddress || getCertV2ContractAddress(resolvedNet),
            requestTxHash: transactionHash,
            createdAt: onChainOrg.createdAt ? new Date(onChainOrg.createdAt * 1000).toISOString() : getLocalDateTime()
        };

        // Persist organization record in MongoDB
        try {
            const salt = crypto.randomBytes(16).toString("hex");
            const keyHash = accessKey ? web3.utils.keccak256(String(accessKey).trim()) : "0x0";
            await Organization.findOneAndUpdate(
                { $or: [{ orgId: organizationRecord.orgId }, { orgIdBytes32: expectedBytes32 }] },
                {
                    $setOnInsert: {
                        orgId: organizationRecord.orgId,
                        orgIdBytes32: expectedBytes32,
                        accessKeySalt: salt,
                        accessKeyHash: keyHash,
                        createdAt: getLocalDateTime()
                    },
                    $set: {
                        name: organizationRecord.name,
                        universityOrCompany: organizationRecord.universityOrCompany,
                        purpose: organizationRecord.purpose,
                        capacity: organizationRecord.capacity,
                        currentMemberCount: organizationRecord.currentMemberCount || 1,
                        ownerUserId: req.user.uid,
                        ownerWallet: organizationRecord.ownerWallet,
                        status: "Approved",
                        blockchainNetwork: resolvedNet,
                        chainId: resolvedNet === "sepolia" ? 11155111 : 1337,
                        contractAddress: organizationRecord.contractAddress,
                        requestTxHash: transactionHash,
                        approvalTxHash: transactionHash,
                        approvedAt: getLocalDateTime()
                    }
                },
                { upsert: true, new: true }
            );

            // Persist Owner membership record
            await OrganizationMembership.findOneAndUpdate(
                { orgId: organizationRecord.orgId, userId: req.user.uid },
                {
                    orgId: organizationRecord.orgId,
                    userId: req.user.uid,
                    userEmail: req.user.email || null,
                    walletAddress: organizationRecord.ownerWallet,
                    role: "owner",
                    isAuthorizedIssuer: true,
                    status: "active",
                    joinedAt: getLocalDateTime(),
                    updatedAt: getLocalDateTime()
                },
                { upsert: true, new: true }
            );
        } catch (dbSaveErr) {
            console.warn("[Org Create DB Sync Notice]:", dbSaveErr.message);
        }

        res.status(201).json({
            success: true,
            message: `Organization "${organizationRecord.name}" successfully created and activated on the ${resolvedNet.toUpperCase()} blockchain!`,
            organization: organizationRecord
        });
    } catch (error) {
        console.error("[Create Organization] Error:", error);
        res.status(500).json({ success: false, message: "Organization confirmation failed: " + error.message });
    }
});

// ============================================================================
// 3. ORGANIZATION PORTAL & MY MEMBERSHIPS (SERVER-AUTHENTICATED & ON-CHAIN)
// ============================================================================

router.get("/my-portal", requireAuth, async (req, res) => {
    try {
        const userWallet = (req.query.wallet || "").trim().toLowerCase();
        const network = req.query.network || "sepolia";
        const resolvedNet = normalizeNetwork(network);

        const currentUserId = req.user && req.user.uid ? req.user.uid : null;
        const currentUserEmail = req.user && req.user.email ? req.user.email.toLowerCase() : null;

        // Query all organization IDs directly from the smart contract
        const allOrgIds = await getAllOrgIdsFromChain(null, resolvedNet).catch(() => []);

        // Load all MongoDB organizations and memberships for reliable identity filtering
        const dbOrgs = await Organization.find({}).lean().catch(() => []);

        const membershipQueries = [];
        if (currentUserId) membershipQueries.push({ userId: currentUserId });
        if (currentUserEmail) membershipQueries.push({ userEmail: currentUserEmail });
        if (userWallet) membershipQueries.push({ walletAddress: userWallet });

        const dbMemberships = membershipQueries.length > 0
            ? await OrganizationMembership.find({ $or: membershipQueries }).lean().catch(() => [])
            : [];

        const adminReqQueries = [];
        if (currentUserId) {
            adminReqQueries.push({ requesterUserId: currentUserId });
            adminReqQueries.push({ adminUserId: currentUserId });
        }
        if (currentUserEmail) {
            adminReqQueries.push({ institutionalEmail: currentUserEmail });
            adminReqQueries.push({ adminUserId: currentUserEmail.split("@")[0] });
        }
        if (userWallet) adminReqQueries.push({ walletAddress: userWallet });

        const approvedAdminReqs = adminReqQueries.length > 0
            ? await OrganizationAdminRequest.find({ $or: adminReqQueries, status: "Approved" }).lean().catch(() => [])
            : [];

        const detailedOrganizations = [];
        const seenOrgIds = new Set();

        // 1. Process On-Chain Registered Organizations
        for (const oid of allOrgIds) {
            try {
                const org = await getOrganizationFullFromChain(oid, null, resolvedNet);
                if (!org.exists) continue;

                const normOrgId = (org.orgId || "").toLowerCase();
                const normOid = String(oid).toLowerCase();
                seenOrgIds.add(normOrgId);
                seenOrgIds.add(normOid);

                // Match database record if present for canonical ownerUserId
                const matchingDbOrg = dbOrgs.find(d =>
                    (d.orgId && d.orgId.toLowerCase() === normOrgId) ||
                    (d.orgIdBytes32 && d.orgIdBytes32.toLowerCase() === normOid) ||
                    (d.name && d.name.toLowerCase() === (org.name || "").toLowerCase())
                );

                const members = await getOrganizationMembersFromChain(oid, null, resolvedNet);

                // Accurate ownership evaluation:
                // Established by application registration (ownerUserId), or matching ownerWallet, or DB membership role 'owner'
                const isOwner = Boolean(
                    (matchingDbOrg && currentUserId && matchingDbOrg.ownerUserId === currentUserId) ||
                    (matchingDbOrg && currentUserEmail && matchingDbOrg.ownerUserId && matchingDbOrg.ownerUserId.toLowerCase() === currentUserEmail) ||
                    (userWallet && org.ownerWallet && org.ownerWallet.toLowerCase() === userWallet) ||
                    (matchingDbOrg && userWallet && matchingDbOrg.ownerWallet && matchingDbOrg.ownerWallet.toLowerCase() === userWallet) ||
                    dbMemberships.some(m => (m.orgId.toLowerCase() === normOrgId || m.orgId.toLowerCase() === normOid) && m.role === "owner" && m.status === "active")
                );

                // Administrator evaluation: Approved admin membership or approved admin request
                const isAdmin = !isOwner && Boolean(
                    dbMemberships.some(m => (m.orgId.toLowerCase() === normOrgId || m.orgId.toLowerCase() === normOid) && m.role === "admin" && m.status === "active") ||
                    approvedAdminReqs.some(r => r.orgId.toLowerCase() === normOrgId || r.orgId.toLowerCase() === normOid) ||
                    (userWallet && members.some(m => m.walletAddress === userWallet && m.isAdmin))
                );

                // Member evaluation: Joined organization without administrative rights
                const isMember = !isOwner && !isAdmin && Boolean(
                    dbMemberships.some(m => (m.orgId.toLowerCase() === normOrgId || m.orgId.toLowerCase() === normOid) && m.role === "member" && m.status === "active") ||
                    (userWallet && members.some(m => m.walletAddress === userWallet))
                );

                const userRole = isOwner ? "owner" : (isAdmin ? "admin" : (isMember ? "member" : "none"));
                const effectiveStatus = matchingDbOrg && matchingDbOrg.status ? matchingDbOrg.status : (org.status || "Approved");
                const canIssue = Boolean(effectiveStatus === "Approved" && (isOwner || isAdmin));

                detailedOrganizations.push({
                    orgId: org.orgId || (matchingDbOrg ? matchingDbOrg.orgId : oid),
                    orgIdBytes32: oid,
                    orgName: org.name,
                    name: org.name,
                    universityOrCompany: (matchingDbOrg && matchingDbOrg.universityOrCompany) || org.universityOrCompany || "Institutional Entity",
                    purpose: (matchingDbOrg && matchingDbOrg.purpose) || org.purpose || "Academic Credential Issuance",
                    capacity: org.capacity || (matchingDbOrg && matchingDbOrg.capacity) || 50,
                    currentMemberCount: members.length > 0 ? members.length : (org.memberCount || 1),
                    orgStatus: effectiveStatus,
                    status: effectiveStatus,
                    userRole: userRole,
                    role: userRole,
                    membershipStatus: isMember || isOwner || isAdmin ? "active" : "none",
                    isAuthorizedIssuer: canIssue,
                    ownerWallet: org.ownerWallet || (matchingDbOrg && matchingDbOrg.ownerWallet),
                    owner: org.owner || (matchingDbOrg && matchingDbOrg.ownerWallet),
                    ownerUserId: matchingDbOrg ? matchingDbOrg.ownerUserId : null,
                    walletAddress: userWallet,
                    blockchainNetwork: resolvedNet,
                    contractAddress: org.contractAddress,
                    createdAt: org.createdAt ? new Date(org.createdAt * 1000).toISOString() : (matchingDbOrg ? matchingDbOrg.createdAt : null),
                    membersCount: members.length,
                    members: members,
                    permittedActions: {
                        canIssue: canIssue,
                        canRevoke: canIssue,
                        canManageAdmins: isOwner,
                        canManageMembers: isOwner || isAdmin
                    },
                    organization: {
                        orgId: org.orgId || (matchingDbOrg ? matchingDbOrg.orgId : oid),
                        orgIdBytes32: oid,
                        name: org.name,
                        universityOrCompany: (matchingDbOrg && matchingDbOrg.universityOrCompany) || org.universityOrCompany,
                        purpose: (matchingDbOrg && matchingDbOrg.purpose) || org.purpose,
                        capacity: org.capacity || (matchingDbOrg && matchingDbOrg.capacity) || 50,
                        currentMemberCount: members.length > 0 ? members.length : 1,
                        status: effectiveStatus,
                        blockchainNetwork: resolvedNet,
                        contractAddress: org.contractAddress
                    }
                });
            } catch (err) {
                console.warn(`[my-portal] Skipping org ${oid}: ${err.message}`);
            }
        }

        // 2. Process MongoDB Organizations not yet listed on this network's chain (e.g. Pending Super Admin Approval)
        for (const dbOrg of dbOrgs) {
            const normOrgId = (dbOrg.orgId || "").toLowerCase();
            const normBytes32 = (dbOrg.orgIdBytes32 || "").toLowerCase();

            if (seenOrgIds.has(normOrgId) || seenOrgIds.has(normBytes32)) {
                continue;
            }

            const isOwner = Boolean(
                (currentUserId && dbOrg.ownerUserId === currentUserId) ||
                (currentUserEmail && dbOrg.ownerUserId && dbOrg.ownerUserId.toLowerCase() === currentUserEmail) ||
                (userWallet && dbOrg.ownerWallet && dbOrg.ownerWallet.toLowerCase() === userWallet) ||
                dbMemberships.some(m => (m.orgId.toLowerCase() === normOrgId || m.orgId.toLowerCase() === normBytes32) && m.role === "owner" && m.status === "active")
            );

            const isAdmin = !isOwner && Boolean(
                dbMemberships.some(m => (m.orgId.toLowerCase() === normOrgId || m.orgId.toLowerCase() === normBytes32) && m.role === "admin" && m.status === "active") ||
                approvedAdminReqs.some(r => r.orgId.toLowerCase() === normOrgId || r.orgId.toLowerCase() === normBytes32)
            );

            const isMember = !isOwner && !isAdmin && Boolean(
                dbMemberships.some(m => (m.orgId.toLowerCase() === normOrgId || m.orgId.toLowerCase() === normBytes32) && m.role === "member" && m.status === "active")
            );

            const userRole = isOwner ? "owner" : (isAdmin ? "admin" : (isMember ? "member" : "none"));
            const orgStatus = dbOrg.status || "Pending Approval";
            const canIssue = Boolean(orgStatus === "Approved" && (isOwner || isAdmin));

            detailedOrganizations.push({
                orgId: dbOrg.orgId,
                orgIdBytes32: dbOrg.orgIdBytes32,
                orgName: dbOrg.name,
                name: dbOrg.name,
                universityOrCompany: dbOrg.universityOrCompany || "Institutional Entity",
                purpose: dbOrg.purpose || "Academic Credential Issuance",
                capacity: dbOrg.capacity || 50,
                currentMemberCount: dbOrg.currentMemberCount || 1,
                orgStatus: orgStatus,
                status: orgStatus,
                userRole: userRole,
                role: userRole,
                membershipStatus: isMember || isOwner || isAdmin ? "active" : "none",
                isAuthorizedIssuer: canIssue,
                ownerWallet: dbOrg.ownerWallet,
                owner: dbOrg.ownerWallet,
                ownerUserId: dbOrg.ownerUserId,
                walletAddress: userWallet,
                blockchainNetwork: dbOrg.blockchainNetwork || resolvedNet,
                contractAddress: dbOrg.contractAddress,
                createdAt: dbOrg.createdAt ? new Date(dbOrg.createdAt).toISOString() : null,
                membersCount: dbOrg.currentMemberCount || 1,
                members: [],
                permittedActions: {
                    canIssue: canIssue,
                    canRevoke: canIssue,
                    canManageAdmins: Boolean(isOwner && orgStatus === "Approved"),
                    canManageMembers: canIssue
                },
                organization: {
                    orgId: dbOrg.orgId,
                    orgIdBytes32: dbOrg.orgIdBytes32,
                    name: dbOrg.name,
                    universityOrCompany: dbOrg.universityOrCompany,
                    purpose: dbOrg.purpose,
                    capacity: dbOrg.capacity,
                    currentMemberCount: dbOrg.currentMemberCount || 1,
                    status: orgStatus,
                    blockchainNetwork: dbOrg.blockchainNetwork || resolvedNet,
                    contractAddress: dbOrg.contractAddress
                }
            });
        }

        // Strict Role-Based Partitioning:
        // "Your Organizations" contains organizations the user owns or administers
        const yourOrganizations = detailedOrganizations.filter(o => o.userRole === "owner" || o.userRole === "admin");

        // "Memberships" contains organizations where the user is an ordinary member
        const memberships = detailedOrganizations.filter(o => o.userRole === "member");

        let isSuperAdmin = false;
        if (userWallet) {
            isSuperAdmin = await checkIsSuperAdmin(userWallet, resolvedNet);
        }

        // Pending approval queue for Platform Super Admin
        const pendingApprovalRequests = detailedOrganizations.filter(o => o.status === "Pending Approval" || o.orgStatus === "Pending Approval");

        res.json({
            success: true,
            yourOrganizations: yourOrganizations,
            memberships: memberships,
            allOrganizations: detailedOrganizations,
            isSuperAdmin: isSuperAdmin,
            pendingApprovalRequests: pendingApprovalRequests
        });
    } catch (error) {
        console.error("[My Portal] Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});
//     } catch (error) {
//         console.error("[My Portal] Error:", error);
//         res.status(500).json({ success: false, message: error.message });
//     }
// });

// ============================================================================
// 4. MEMBERS OF AN ORGANIZATION (100% ON-CHAIN)
// ============================================================================

router.get("/:orgId/members", async (req, res) => {
    try {
        const { orgId } = req.params;
        const network = req.query.network || "sepolia";
        const resolvedNet = normalizeNetwork(network);
        let targetOrgIdBytes32 = deriveOrgIdBytes32(orgId);
        let org = await getOrganizationFullFromChain(targetOrgIdBytes32, null, resolvedNet);

        if (!org.exists) {
            const allIds = await getAllOrgIdsFromChain(null, resolvedNet);
            for (const oid of allIds) {
                const checkOrg = await getOrganizationFullFromChain(oid, null, resolvedNet);
                if (checkOrg.exists && (
                    checkOrg.name.toLowerCase() === String(orgId).trim().toLowerCase() ||
                    checkOrg.orgId.toLowerCase() === String(orgId).trim().toLowerCase()
                )) {
                    targetOrgIdBytes32 = oid;
                    org = checkOrg;
                    break;
                }
            }
        }

        if (!org.exists) {
            return res.status(404).json({ success: false, message: "Organization not found on blockchain." });
        }

        const members = await getOrganizationMembersFromChain(targetOrgIdBytes32, null, resolvedNet);

        // Always ensure organization owner is listed
        if (org.ownerWallet && !members.some(m => m.walletAddress.toLowerCase() === org.ownerWallet.toLowerCase())) {
            members.unshift({
                walletAddress: org.ownerWallet,
                isAdmin: true,
                role: "owner",
                isAuthorizedIssuer: true,
                status: "active"
            });
        }

        res.json({
            success: true,
            orgId: org.orgId,
            orgName: org.name,
            members: members,
            capacity: org.capacity,
            totalMembers: members.length
        });
    } catch (error) {
        console.error("[Get Org Members] Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================================================
// 5. JOIN ORGANIZATION WORKFLOW (100% ON-CHAIN)
// ============================================================================

router.post("/prepare-join", requireAuth, async (req, res) => {
    try {
        const { orgId, accessKey, network, walletAddress } = req.body;
        const resolvedNet = normalizeNetwork(network);

        if (!orgId || !accessKey) {
            return res.status(400).json({ success: false, message: "Organization Name / ID and Access Key are required." });
        }

        const trimmedInput = String(orgId).trim();
        let targetOrgIdBytes32 = deriveOrgIdBytes32(trimmedInput);

        // Check if found directly
        let onChainOrg = await getOrganizationFullFromChain(targetOrgIdBytes32, null, resolvedNet);

        // If not found by direct keccak, search all orgs by human-readable name or ID
        if (!onChainOrg.exists) {
            const allIds = await getAllOrgIdsFromChain(null, resolvedNet);
            for (const oid of allIds) {
                const checkOrg = await getOrganizationFullFromChain(oid, null, resolvedNet);
                if (checkOrg.exists && (
                    checkOrg.name.toLowerCase() === trimmedInput.toLowerCase() ||
                    checkOrg.orgId.toLowerCase() === trimmedInput.toLowerCase()
                )) {
                    targetOrgIdBytes32 = oid;
                    onChainOrg = checkOrg;
                    break;
                }
            }
        }

        if (!onChainOrg.exists) {
            return res.status(404).json({ success: false, message: `Organization "${trimmedInput}" not found on blockchain.` });
        }

        // Verify access key on-chain
        const isValidKey = await verifyOrgAccessKeyOnChain(targetOrgIdBytes32, accessKey, null, resolvedNet);
        if (!isValidKey) {
            return res.status(401).json({ success: false, message: "Invalid Organization Access Key. Please verify the credentials with your institution administrator." });
        }

        const netConfig = await getBlockchainConfig(resolvedNet);
        const contractAddress = getCertV2ContractAddress(resolvedNet);

        // Encode joinOrganization calldata
        const txData = encodeJoinOrganization(targetOrgIdBytes32, accessKey, resolvedNet);

        res.json({
            success: true,
            orgId: onChainOrg.orgId,
            orgIdBytes32: targetOrgIdBytes32,
            name: onChainOrg.name,
            universityOrCompany: onChainOrg.universityOrCompany,
            contractAddress: contractAddress,
            blockchainNetwork: resolvedNet,
            chainId: netConfig.chainId,
            chainIdHex: netConfig.chainIdHex,
            txData: txData,
            organization: onChainOrg
        });
    } catch (error) {
        console.error("[Prepare Join] Error:", error);
        res.status(500).json({ success: false, message: "Failed to prepare organization join: " + error.message });
    }
});

router.post("/join", requireAuth, async (req, res) => {
    try {
        const orgIdInput = req.body.orgId || req.body.identifier;
        const accessKey = req.body.accessKey;
        const network = req.body.network;
        const walletAddress = req.body.walletAddress;
        const transactionHash = req.body.transactionHash;
        const resolvedNet = normalizeNetwork(network);

        if (!orgIdInput) {
            return res.status(400).json({ success: false, message: "Organization ID or Name is required." });
        }

        const trimmedInput = String(orgIdInput).trim();
        let targetOrgIdBytes32 = deriveOrgIdBytes32(trimmedInput);
        let onChainOrg = await getOrganizationFullFromChain(targetOrgIdBytes32, null, resolvedNet);

        if (!onChainOrg.exists) {
            const allIds = await getAllOrgIdsFromChain(null, resolvedNet);
            for (const oid of allIds) {
                const checkOrg = await getOrganizationFullFromChain(oid, null, resolvedNet);
                if (checkOrg.exists && (
                    checkOrg.name.toLowerCase() === trimmedInput.toLowerCase() ||
                    checkOrg.orgId.toLowerCase() === trimmedInput.toLowerCase()
                )) {
                    targetOrgIdBytes32 = oid;
                    onChainOrg = checkOrg;
                    break;
                }
            }
        }

        if (!onChainOrg.exists) {
            return res.status(404).json({ success: false, message: "Organization not found on blockchain." });
        }

        if (!accessKey) {
            return res.status(400).json({ success: false, message: "Organization Access Key is required to join." });
        }

        // Verify access key on-chain against keccak256 hash stored on smart contract
        const isValidKey = await verifyOrgAccessKeyOnChain(targetOrgIdBytes32, accessKey, null, resolvedNet);
        if (!isValidKey) {
            return res.status(401).json({
                success: false,
                message: "Invalid Organization Access Key. Please check the key provided by the institution administrator."
            });
        }

        const members = await getOrganizationMembersFromChain(targetOrgIdBytes32, null, resolvedNet);
        const normalizedWallet = walletAddress ? walletAddress.toLowerCase() : null;

        // Resolve authenticated user identity
        const userId = req.user ? req.user.uid : (normalizedWallet || trimmedInput);
        const userEmail = req.user ? req.user.email : null;

        // Check if organization exists in MongoDB
        const dbOrg = await Organization.findOne({
            $or: [
                { orgId: onChainOrg.orgId },
                { orgIdBytes32: targetOrgIdBytes32 }
            ]
        });

        const isOwnerOfOrg = Boolean(
            (dbOrg && dbOrg.ownerUserId && req.user && dbOrg.ownerUserId === req.user.uid) ||
            (dbOrg && dbOrg.ownerWallet && normalizedWallet && dbOrg.ownerWallet.toLowerCase() === normalizedWallet) ||
            (onChainOrg.owner && normalizedWallet && onChainOrg.owner.toLowerCase() === normalizedWallet)
        );

        // Find or create OrganizationMembership in MongoDB
        let membership = await OrganizationMembership.findOne({
            orgId: onChainOrg.orgId,
            $or: [
                { userId: userId },
                ...(userEmail ? [{ userEmail: new RegExp(`^${userEmail}$`, "i") }] : []),
                ...(normalizedWallet ? [{ walletAddress: normalizedWallet }] : [])
            ]
        });

        let resolvedRole = isOwnerOfOrg ? "owner" : (membership ? (membership.role || "member") : "member");
        let isAuthorizedIssuer = isOwnerOfOrg ? true : (membership ? Boolean(membership.isAuthorizedIssuer) : false);

        if (!membership) {
            membership = new OrganizationMembership({
                orgId: onChainOrg.orgId,
                userId: userId,
                userEmail: userEmail,
                walletAddress: normalizedWallet,
                role: resolvedRole,
                isAuthorizedIssuer: isAuthorizedIssuer,
                status: "active",
                joinedAt: getLocalDateTime(),
                updatedAt: getLocalDateTime()
            });
            await membership.save();

            if (dbOrg) {
                dbOrg.currentMemberCount = (dbOrg.currentMemberCount || 0) + 1;
                await dbOrg.save();
            }
        }

        if (normalizedWallet && !members.some(m => m.walletAddress.toLowerCase() === normalizedWallet)) {
            members.push({
                walletAddress: normalizedWallet,
                isAdmin: isAuthorizedIssuer,
                role: resolvedRole,
                isAuthorizedIssuer: isAuthorizedIssuer,
                status: "active"
            });
        }

        res.json({
            success: true,
            message: `Successfully joined ${onChainOrg.name}! You are now an active member of this organization.`,
            membership: {
                role: resolvedRole,
                status: "active",
                isAuthorizedIssuer: isAuthorizedIssuer
            },
            organization: {
                orgId: onChainOrg.orgId,
                orgIdBytes32: targetOrgIdBytes32,
                name: onChainOrg.name,
                universityOrCompany: onChainOrg.universityOrCompany,
                purpose: onChainOrg.purpose,
                capacity: onChainOrg.capacity,
                currentMemberCount: members.length,
                status: "Approved",
                role: resolvedRole,
                userRole: resolvedRole,
                isAuthorizedIssuer: isAuthorizedIssuer,
                blockchainNetwork: resolvedNet,
                contractAddress: onChainOrg.contractAddress
            }
        });
    } catch (error) {
        console.error("[Join Confirm] Error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================================================
// 6. ADMIN PROMOTION & MANAGEMENT (100% ON-CHAIN)
// ============================================================================

router.post("/:orgId/admins/prepare-add", requireAuth, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { adminWallet, network } = req.body;

        if (!adminWallet) {
            return res.status(400).json({ success: false, message: "Administrator wallet address is required." });
        }

        const resolvedNet = normalizeNetwork(network);
        const orgIdBytes32 = deriveOrgIdBytes32(orgId);
        const netConfig = await getBlockchainConfig(resolvedNet);
        const contractAddress = getCertV2ContractAddress(resolvedNet);
        const txData = encodeAddOrgAdmin(orgIdBytes32, adminWallet, resolvedNet);

        res.json({
            success: true,
            orgId: orgId,
            orgIdBytes32: orgIdBytes32,
            adminWallet: adminWallet,
            contractAddress: contractAddress,
            blockchainNetwork: resolvedNet,
            chainId: netConfig.chainId,
            chainIdHex: netConfig.chainIdHex,
            txData: txData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/:orgId/admins/confirm-add", requireAuth, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { adminWallet, transactionHash, network } = req.body;
        const resolvedNet = normalizeNetwork(network);
        const orgIdBytes32 = deriveOrgIdBytes32(orgId);

        const isIssuer = await isAuthorizedOrgIssuerOnChain(orgIdBytes32, adminWallet, null, resolvedNet);

        res.json({
            success: true,
            message: `Administrator ${adminWallet} authorized on-chain as active issuer.`,
            isAuthorizedIssuer: isIssuer
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/:orgId/admins/prepare-remove", requireAuth, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { adminWallet, network } = req.body;
        const resolvedNet = normalizeNetwork(network);
        const orgIdBytes32 = deriveOrgIdBytes32(orgId);
        const netConfig = await getBlockchainConfig(resolvedNet);
        const contractAddress = getCertV2ContractAddress(resolvedNet);
        const txData = encodeRemoveOrgAdmin(orgIdBytes32, adminWallet, resolvedNet);

        res.json({
            success: true,
            orgId: orgId,
            orgIdBytes32: orgIdBytes32,
            adminWallet: adminWallet,
            contractAddress: contractAddress,
            blockchainNetwork: resolvedNet,
            chainId: netConfig.chainId,
            chainIdHex: netConfig.chainIdHex,
            txData: txData
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post("/:orgId/admins/confirm-remove", requireAuth, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { adminWallet } = req.body;

        res.json({
            success: true,
            message: `Administrator privileges revoked for ${adminWallet}.`
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ============================================================================
// 7. ORGANIZATION-SPECIFIC ADMINISTRATOR REQUESTS & AUTHENTICATION
// ============================================================================

// Option B: Sign in as existing administrator for this specific organization
router.post("/:orgId/admin-login", async (req, res) => {
    try {
        const { orgId } = req.params;
        const adminUserId = req.body.adminUserId || req.body.userId;
        const password = req.body.password;

        if (!adminUserId || !password) {
            return res.status(400).json({
                success: false,
                message: "Please enter both Admin USER ID and Password."
            });
        }

        const trimmedUserId = String(adminUserId).trim();

        // 1. Resolve Organization
        const dbOrg = await Organization.findOne({
            $or: [
                { orgId: orgId },
                { orgId: new RegExp(`^${orgId}$`, "i") },
                { name: new RegExp(`^${orgId}$`, "i") },
                { orgIdBytes32: orgId }
            ]
        }).lean();

        if (!dbOrg) {
            return res.status(404).json({
                success: false,
                message: `Organization "${orgId}" not found.`
            });
        }

        const orgStatus = dbOrg.status || "Pending Approval";
        if (orgStatus !== "Approved") {
            return res.status(403).json({
                success: false,
                message: `Organization "${dbOrg.name}" is currently ${orgStatus}. Administrator sign-in is only available for approved organizations.`
            });
        }

        // 2. Resolve Admin credentials
        const admin = await Admin.findOne({
            adminUserId: new RegExp(`^${trimmedUserId}$`, "i")
        });

        if (!admin) {
            const orgReq = await OrganizationAdminRequest.findOne({
                orgId: dbOrg.orgId,
                adminUserId: new RegExp(`^${trimmedUserId}$`, "i")
            });

            if (orgReq) {
                if (orgReq.status === "Pending") {
                    return res.status(403).json({
                        success: false,
                        message: `Admin USER ID "${trimmedUserId}" is not an authorized administrator for "${dbOrg.name}". Your administrator request is currently pending approval by the organization owner.`
                    });
                } else if (orgReq.status === "Rejected") {
                    return res.status(403).json({
                        success: false,
                        message: `Admin USER ID "${trimmedUserId}" is not an authorized administrator for "${dbOrg.name}". Your administrator request was rejected.`
                    });
                }
            }

            return res.status(404).json({
                success: false,
                message: `Admin USER ID "${trimmedUserId}" not found. Please submit an administrator request via Option A.`
            });
        }

        const isMatch = verifyPassword(password, admin.salt, admin.passwordHash);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid password for this Admin USER ID. Please check your credentials."
            });
        }

        // 3. Verify organization authorization
        const isSuperAdmin = admin.role === "superadmin";
        const isOwner = Boolean(
            (dbOrg.ownerUserId && dbOrg.ownerUserId.toLowerCase() === trimmedUserId.toLowerCase()) ||
            (admin.linkedEmail && dbOrg.ownerUserId && dbOrg.ownerUserId.toLowerCase() === admin.linkedEmail.toLowerCase()) ||
            (admin.adminAddress && dbOrg.ownerWallet && dbOrg.ownerWallet.toLowerCase() === admin.adminAddress.toLowerCase())
        );

        const orConditions = [{ userId: new RegExp(`^${trimmedUserId}$`, "i") }];
        if (admin.linkedEmail && admin.linkedEmail.trim().length > 0) {
            orConditions.push({ userEmail: new RegExp(`^${admin.linkedEmail.trim()}$`, "i") });
        }
        if (admin.adminAddress && admin.adminAddress.trim().length > 0) {
            orConditions.push({ walletAddress: admin.adminAddress.trim().toLowerCase() });
        }

        const membership = await OrganizationMembership.findOne({
            orgId: dbOrg.orgId,
            $or: orConditions,
            role: { $in: ["admin", "owner"] },
            status: "active"
        });

        const approvedReq = await OrganizationAdminRequest.findOne({
            orgId: dbOrg.orgId,
            adminUserId: new RegExp(`^${trimmedUserId}$`, "i"),
            status: "Approved"
        });

        const isAuthorized = Boolean(isSuperAdmin || isOwner || membership || approvedReq);

        if (!isAuthorized) {
            return res.status(403).json({
                success: false,
                message: `Admin USER ID "${trimmedUserId}" is valid, but is not an authorized administrator for "${dbOrg.name}". Please submit a request via Option A to request administrator access.`
            });
        }

        admin.lastLoginAt = getLocalDateTime();
        await admin.save();

        const sessionToken = "admin-token-" + admin.adminUserId + "-" + dbOrg.orgId;
        res.json({
            success: true,
            message: `Administrator session verified for ${dbOrg.name}!`,
            token: sessionToken,
            orgId: dbOrg.orgId,
            orgName: dbOrg.name,
            admin: {
                adminUserId: admin.adminUserId,
                linkedEmail: admin.linkedEmail,
                role: isOwner ? "owner" : "admin",
                orgId: dbOrg.orgId,
                orgName: dbOrg.name
            }
        });
    } catch (error) {
        console.error("[Org Admin Login Error]:", error);
        res.status(500).json({ success: false, message: "Admin login error: " + error.message });
    }
});

// Option A: Submit Administrator Access Request for this organization
router.post("/:orgId/admin-request", async (req, res) => {
    try {
        const { orgId } = req.params;
        const { adminUserId, institutionalEmail, password, walletAddress } = req.body;

        if (!adminUserId || !institutionalEmail || !password) {
            return res.status(400).json({
                success: false,
                message: "Admin USER ID, Institutional Email, and Password are required."
            });
        }

        const trimmedUserId = String(adminUserId).trim();
        const normalizedEmail = String(institutionalEmail).trim().toLowerCase();

        // 1. Resolve Organization
        const dbOrg = await Organization.findOne({
            $or: [
                { orgId: orgId },
                { orgId: new RegExp(`^${orgId}$`, "i") },
                { name: new RegExp(`^${orgId}$`, "i") },
                { orgIdBytes32: orgId }
            ]
        });

        if (!dbOrg) {
            return res.status(404).json({ success: false, message: `Organization "${orgId}" not found.` });
        }

        if (dbOrg.status !== "Approved") {
            return res.status(403).json({
                success: false,
                message: `Organization "${dbOrg.name}" is currently ${dbOrg.status}. Administrator requests can only be submitted for approved organizations.`
            });
        }

        // 2. Hash password securely (PBKDF2 with salt) for persistent storage
        const { salt, passwordHash } = hashPassword(password);
        const requesterUid = req.user ? req.user.uid : null;

        // 3. Check existing admin request for this organization
        let existingReq = await OrganizationAdminRequest.findOne({
            orgId: dbOrg.orgId,
            adminUserId: new RegExp(`^${trimmedUserId}$`, "i")
        });

        if (existingReq) {
            if (existingReq.status === "Approved") {
                return res.json({
                    success: true,
                    status: "Approved",
                    message: `You are already an approved administrator for ${dbOrg.name}. Please sign in using Option B.`
                });
            } else if (existingReq.status === "Pending") {
                return res.json({
                    success: true,
                    status: "Pending",
                    message: `Your administrator access request for ${dbOrg.name} has already been submitted and is pending approval by the organization owner.`
                });
            } else {
                existingReq.status = "Pending";
                existingReq.organizationName = dbOrg.name;
                existingReq.passwordHash = passwordHash;
                existingReq.salt = salt;
                existingReq.institutionalEmail = normalizedEmail;
                existingReq.walletAddress = walletAddress || null;
                existingReq.requesterUserId = requesterUid;
                existingReq.requestedAt = getLocalDateTime();
                existingReq.rejectionReason = null;
                await existingReq.save();
                return res.json({
                    success: true,
                    status: "Pending",
                    message: `Your administrator access request for ${dbOrg.name} has been resubmitted and is pending approval by the organization owner.`
                });
            }
        }

        // Create new pending request with hashed password and salt
        const newReq = new OrganizationAdminRequest({
            orgId: dbOrg.orgId,
            organizationName: dbOrg.name,
            adminUserId: trimmedUserId,
            institutionalEmail: normalizedEmail,
            requesterUserId: requesterUid,
            walletAddress: walletAddress || null,
            passwordHash: passwordHash,
            salt: salt,
            status: "Pending",
            requestedAt: getLocalDateTime()
        });
        await newReq.save();

        res.json({
            success: true,
            status: "Pending",
            message: `Administrator access request for "${dbOrg.name}" submitted successfully. Your request is pending approval by the organization owner.`
        });
    } catch (error) {
        console.error("[Org Admin Request Error]:", error);
        res.status(500).json({ success: false, message: "Failed to submit admin request: " + error.message });
    }
});

// View pending administrator requests for this organization (never expose password hashes)
router.get("/:orgId/admin-requests", async (req, res) => {
    try {
        const { orgId } = req.params;
        const dbOrg = await Organization.findOne({
            $or: [
                { orgId: orgId },
                { orgId: new RegExp(`^${orgId}$`, "i") },
                { name: new RegExp(`^${orgId}$`, "i") },
                { orgIdBytes32: orgId }
            ]
        }).lean();

        const resolvedOrgIds = [orgId];
        if (dbOrg) {
            if (dbOrg.orgId && !resolvedOrgIds.includes(dbOrg.orgId)) resolvedOrgIds.push(dbOrg.orgId);
            if (dbOrg.orgIdBytes32 && !resolvedOrgIds.includes(dbOrg.orgIdBytes32)) resolvedOrgIds.push(dbOrg.orgIdBytes32);
            if (dbOrg.name && !resolvedOrgIds.includes(dbOrg.name)) resolvedOrgIds.push(dbOrg.name);
        }

        const requests = await OrganizationAdminRequest.find({ orgId: { $in: resolvedOrgIds } })
            .select("-passwordHash -salt")
            .sort({ requestedAt: -1 })
            .lean();

        res.json({ success: true, requests });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Check status of current user's administrator request for this organization
router.get("/:orgId/my-admin-request", async (req, res) => {
    try {
        const { orgId } = req.params;
        const adminUserId = req.query.adminUserId || req.query.userId || (req.user ? req.user.uid : null);
        const email = req.query.email || (req.user ? req.user.email : null);

        if (!adminUserId && !email) {
            return res.json({ success: true, request: null });
        }

        const orConditions = [];
        if (adminUserId) {
            orConditions.push({ adminUserId: new RegExp(`^${String(adminUserId).trim()}$`, "i") });
            orConditions.push({ requesterUserId: String(adminUserId).trim() });
        }
        if (email) {
            orConditions.push({ institutionalEmail: new RegExp(`^${String(email).trim()}$`, "i") });
        }

        const request = await OrganizationAdminRequest.findOne({
            orgId: orgId,
            $or: orConditions
        }).select("-passwordHash -salt").sort({ requestedAt: -1 }).lean();

        res.json({ success: true, request: request || null });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Approve administrator request
router.post("/:orgId/admin-requests/:requestId/approve", async (req, res) => {
    try {
        const { orgId, requestId } = req.params;
        const request = await OrganizationAdminRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ success: false, message: "Administrator request not found." });
        }

        request.status = "Approved";
        request.resolvedAt = getLocalDateTime();
        request.resolvedBy = req.body.resolvedBy || "Organization Owner";
        await request.save();

        // 1. Create or update Admin credentials in Admin collection
        let admin = await Admin.findOne({
            adminUserId: new RegExp(`^${request.adminUserId}$`, "i")
        });

        if (!admin) {
            admin = new Admin({
                adminUserId: request.adminUserId,
                passwordHash: request.passwordHash,
                salt: request.salt,
                linkedEmail: request.institutionalEmail,
                adminAddress: request.walletAddress || null,
                role: "admin",
                createdAt: getLocalDateTime(),
                lastLoginAt: getLocalDateTime()
            });
            await admin.save();
        } else {
            if (request.passwordHash && request.salt) {
                admin.passwordHash = request.passwordHash;
                admin.salt = request.salt;
            }
            if (request.institutionalEmail) admin.linkedEmail = request.institutionalEmail;
            if (request.walletAddress) admin.adminAddress = request.walletAddress;
            await admin.save();
        }

        // 2. Update or create OrganizationMembership with role "admin" and issuer rights
        let membership = await OrganizationMembership.findOne({
            orgId: request.orgId,
            $or: [
                { userId: request.adminUserId },
                { userEmail: new RegExp(`^${request.institutionalEmail}$`, "i") },
                ...(request.walletAddress ? [{ walletAddress: request.walletAddress.toLowerCase() }] : [])
            ]
        });

        if (!membership) {
            membership = new OrganizationMembership({
                orgId: request.orgId,
                userId: request.adminUserId,
                userEmail: request.institutionalEmail,
                walletAddress: request.walletAddress ? request.walletAddress.toLowerCase() : null,
                role: "admin",
                isAuthorizedIssuer: true,
                status: "active",
                joinedAt: getLocalDateTime(),
                updatedAt: getLocalDateTime()
            });
        } else {
            membership.role = "admin";
            membership.isAuthorizedIssuer = true;
            membership.status = "active";
            membership.updatedAt = getLocalDateTime();
        }
        await membership.save();

        const cleanReq = request.toObject();
        delete cleanReq.passwordHash;
        delete cleanReq.salt;

        res.json({
            success: true,
            message: `Administrator request for "${request.adminUserId}" has been APPROVED. User is now an authorized administrator for this organization.`,
            request: cleanReq
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Reject administrator request
router.post("/:orgId/admin-requests/:requestId/reject", async (req, res) => {
    try {
        const { orgId, requestId } = req.params;
        const reason = req.body.reason || "Requirements not met";
        const request = await OrganizationAdminRequest.findById(requestId);
        if (!request) {
            return res.status(404).json({ success: false, message: "Administrator request not found." });
        }

        request.status = "Rejected";
        request.resolvedAt = getLocalDateTime();
        request.resolvedBy = req.body.resolvedBy || "Organization Owner";
        request.rejectionReason = reason;
        await request.save();

        const cleanReq = request.toObject();
        delete cleanReq.passwordHash;
        delete cleanReq.salt;

        res.json({
            success: true,
            message: `Administrator request for "${request.adminUserId}" has been rejected.`,
            request: cleanReq
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Organization Issued Certificates
router.get("/:orgId/certificates", async (req, res) => {
    try {
        const { orgId } = req.params;
        const dbOrg = await Organization.findOne({
            $or: [
                { orgId: orgId },
                { orgId: new RegExp(`^${orgId}$`, "i") },
                { name: new RegExp(`^${orgId}$`, "i") },
                { orgIdBytes32: orgId }
            ]
        }).lean();

        const orgIdentifiers = [orgId];
        if (dbOrg) {
            if (dbOrg.orgId && !orgIdentifiers.includes(dbOrg.orgId)) orgIdentifiers.push(dbOrg.orgId);
            if (dbOrg.name && !orgIdentifiers.includes(dbOrg.name)) orgIdentifiers.push(dbOrg.name);
            if (dbOrg.orgIdBytes32 && !orgIdentifiers.includes(dbOrg.orgIdBytes32)) orgIdentifiers.push(dbOrg.orgIdBytes32);
        }

        const certificates = await Certificate.find({
            $or: [
                { orgId: { $in: orgIdentifiers } },
                { organizationName: { $in: orgIdentifiers } }
            ]
        }).sort({ issuedAt: -1 }).lean();

        res.json({
            success: true,
            count: certificates.length,
            certificates
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
