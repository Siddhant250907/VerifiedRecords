// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CertificateV2
 * @dev Multi-tenant Organization-scoped Certificate Verification Smart Contract.
 * Integrates fully on-chain organization registry, direct member joining with cryptographic
 * access key verification, role-based issuer authorization, and verifiable certificate revocation.
 * Zero-PII commitment design and cross-organization cryptographic isolation.
 */
contract CertificateV2 is Ownable {

    // ==========================================
    // ENUMS & STRUCTURES
    // ==========================================

    enum OrgStatus { None, Pending, Approved, Rejected, Suspended }

    struct Organization {
        bytes32 orgId;
        string orgName;
        string universityOrCompany;
        string purpose;
        uint256 capacity;
        bytes32 accessKeyHash;
        address owner;
        OrgStatus status;
        uint256 createdAt;
        uint256 approvedAt;
        bool exists;
    }

    struct CertificateRecord {
        bytes32 orgId;
        bytes32 certificateHash;
        address issuer;
        uint256 issuedAt;
        bool exists;
        bool revoked;
        uint256 revokedAt;
    }

    // ==========================================
    // STORAGE MAPPINGS
    // ==========================================

    // Organization data: orgId => Organization
    mapping(bytes32 => Organization) private organizations;

    // Ordered list of all registered organization IDs for on-chain enumeration
    bytes32[] public allOrgIds;

    // Track total registered organizations count
    uint256 public organizationCount;

    // Organization Members: orgId => list of member wallet addresses
    mapping(bytes32 => address[]) private orgMembers;

    // Fast lookup: orgId => (wallet => isMember)
    mapping(bytes32 => mapping(address => bool)) public isOrganizationMember;

    // Organization Authorized Admins / Issuers: orgId => (wallet => isAuthorized)
    mapping(bytes32 => mapping(address => bool)) public isOrganizationAdmin;

    // Admin count per organization
    mapping(bytes32 => uint256) public organizationAdminCount;

    // Certificate Records: certificateId => CertificateRecord
    mapping(string => CertificateRecord) private certificates;

    // Organization issued certificate IDs
    mapping(bytes32 => string[]) private orgCertificates;

    // Total certificate counter
    uint256 public totalCertificatesIssued;
    uint256 public totalCertificatesRevoked;

    // ==========================================
    // EVENTS
    // ==========================================

    event OrganizationRequested(
        bytes32 indexed orgId,
        string orgName,
        address indexed owner,
        uint256 createdAt
    );

    event OrganizationCreated(
        bytes32 indexed orgId,
        string orgName,
        string universityOrCompany,
        address indexed owner,
        uint256 capacity,
        uint256 createdAt
    );

    event OrganizationApproved(
        bytes32 indexed orgId,
        address indexed approver,
        uint256 approvedAt
    );

    event OrganizationRejected(
        bytes32 indexed orgId,
        address indexed rejecter,
        uint256 rejectedAt
    );

    event MemberJoined(
        bytes32 indexed orgId,
        address indexed memberAddress,
        uint256 timestamp
    );

    event OrganizationAdminAdded(
        bytes32 indexed orgId,
        address indexed adminAddress,
        address indexed addedBy,
        uint256 timestamp
    );

    event OrganizationAdminRemoved(
        bytes32 indexed orgId,
        address indexed adminAddress,
        address indexed removedBy,
        uint256 timestamp
    );

    event CertificateIssued(
        bytes32 indexed orgId,
        string certificateId,
        bytes32 certificateHash,
        address indexed issuer,
        uint256 issuedAt
    );

    event CertificateRevoked(
        bytes32 indexed orgId,
        string certificateId,
        address indexed revoker,
        uint256 revokedAt
    );

    // ==========================================
    // CONSTRUCTOR & MODIFIERS
    // ==========================================

    constructor() Ownable(msg.sender) {}

    modifier onlyApprovedOrg(bytes32 orgId) {
        require(organizations[orgId].exists, "Organization does not exist");
        require(organizations[orgId].status == OrgStatus.Approved, "Organization is not approved or active");
        _;
    }

    modifier onlyOrgOwnerOrSuperAdmin(bytes32 orgId) {
        require(organizations[orgId].exists, "Organization does not exist");
        require(
            msg.sender == organizations[orgId].owner || msg.sender == owner(),
            "Caller is neither the organization owner nor the platform super admin"
        );
        _;
    }

    modifier onlyAuthorizedOrgIssuer(bytes32 orgId) {
        require(organizations[orgId].exists, "Organization does not exist");
        require(organizations[orgId].status == OrgStatus.Approved, "Organization is not approved or active");
        bool isOwner = (msg.sender == organizations[orgId].owner);
        bool isAdmin = isOrganizationAdmin[orgId][msg.sender];
        require(isOwner || isAdmin, "Caller is not authorized to issue for this organization");
        _;
    }

    // ==========================================
    // 1. ORGANIZATION MANAGEMENT WORKFLOW
    // ==========================================

    /**
     * @notice Create an approved organization directly on-chain with full metadata and access key hash.
     * Creator is immediately established as owner, initial member, and authorized administrator.
     */
    function createOrganization(
        bytes32 orgId,
        string memory orgName,
        string memory universityOrCompany,
        string memory purpose,
        uint256 capacity,
        bytes32 accessKeyHash
    ) external {
        require(orgId != bytes32(0), "Organization ID cannot be zero bytes");
        require(bytes(orgName).length > 0, "Organization name cannot be empty");
        require(capacity > 0, "Capacity must be greater than zero");
        require(!organizations[orgId].exists, "Organization ID already registered");

        organizations[orgId] = Organization({
            orgId: orgId,
            orgName: orgName,
            universityOrCompany: universityOrCompany,
            purpose: purpose,
            capacity: capacity,
            accessKeyHash: accessKeyHash,
            owner: msg.sender,
            status: OrgStatus.Approved,
            createdAt: block.timestamp,
            approvedAt: block.timestamp,
            exists: true
        });

        allOrgIds.push(orgId);
        organizationCount += 1;

        // Auto-enroll creator as first member and authorized admin
        orgMembers[orgId].push(msg.sender);
        isOrganizationMember[orgId][msg.sender] = true;

        isOrganizationAdmin[orgId][msg.sender] = true;
        organizationAdminCount[orgId] += 1;

        emit OrganizationCreated(orgId, orgName, universityOrCompany, msg.sender, capacity, block.timestamp);
        emit OrganizationApproved(orgId, msg.sender, block.timestamp);
        emit MemberJoined(orgId, msg.sender, block.timestamp);
        emit OrganizationAdminAdded(orgId, msg.sender, msg.sender, block.timestamp);
    }

    /**
     * @notice Submit a new organization registration request on-chain (Pending Approval).
     * Retained for full backward-compatibility with tests and legacy governance workflows.
     */
    function requestOrganization(
        bytes32 orgId,
        string memory orgName,
        address orgOwner
    ) external {
        require(orgId != bytes32(0), "Organization ID cannot be zero bytes");
        require(bytes(orgName).length > 0, "Organization name cannot be empty");
        require(orgOwner != address(0), "Owner address cannot be zero address");
        require(!organizations[orgId].exists, "Organization ID already registered");

        organizations[orgId] = Organization({
            orgId: orgId,
            orgName: orgName,
            universityOrCompany: "",
            purpose: "",
            capacity: 50,
            accessKeyHash: bytes32(0),
            owner: orgOwner,
            status: OrgStatus.Pending,
            createdAt: block.timestamp,
            approvedAt: 0,
            exists: true
        });

        allOrgIds.push(orgId);
        organizationCount += 1;

        emit OrganizationRequested(orgId, orgName, orgOwner, block.timestamp);
    }

    /**
     * @notice Approve a pending organization request. Restricted to Platform Super Admin (Contract Owner).
     */
    function approveOrganization(bytes32 orgId) external onlyOwner {
        require(organizations[orgId].exists, "Organization does not exist");
        require(organizations[orgId].status == OrgStatus.Pending, "Organization is not in Pending status");

        organizations[orgId].status = OrgStatus.Approved;
        organizations[orgId].approvedAt = block.timestamp;

        address orgOwner = organizations[orgId].owner;
        if (!isOrganizationMember[orgId][orgOwner]) {
            orgMembers[orgId].push(orgOwner);
            isOrganizationMember[orgId][orgOwner] = true;
            emit MemberJoined(orgId, orgOwner, block.timestamp);
        }

        if (!isOrganizationAdmin[orgId][orgOwner]) {
            isOrganizationAdmin[orgId][orgOwner] = true;
            organizationAdminCount[orgId] += 1;
            emit OrganizationAdminAdded(orgId, orgOwner, msg.sender, block.timestamp);
        }

        emit OrganizationApproved(orgId, msg.sender, block.timestamp);
    }

    /**
     * @notice Reject a pending organization request. Restricted to Platform Super Admin (Contract Owner).
     */
    function rejectOrganization(bytes32 orgId) external onlyOwner {
        require(organizations[orgId].exists, "Organization does not exist");
        require(organizations[orgId].status == OrgStatus.Pending, "Organization is not in Pending status");

        organizations[orgId].status = OrgStatus.Rejected;

        emit OrganizationRejected(orgId, msg.sender, block.timestamp);
    }

    /**
     * @notice Join an approved organization using its access key directly on-chain.
     */
    function joinOrganization(bytes32 orgId, string memory accessKey) external onlyApprovedOrg(orgId) {
        Organization memory org = organizations[orgId];
        require(orgMembers[orgId].length < org.capacity, "Organization capacity reached");

        if (org.accessKeyHash != bytes32(0)) {
            require(
                org.accessKeyHash == keccak256(bytes(accessKey)),
                "Invalid organization access key"
            );
        }

        if (!isOrganizationMember[orgId][msg.sender]) {
            orgMembers[orgId].push(msg.sender);
            isOrganizationMember[orgId][msg.sender] = true;
            emit MemberJoined(orgId, msg.sender, block.timestamp);
        }
    }

    /**
     * @notice Verify whether an access key matches the registered on-chain hash.
     */
    function verifyOrgAccessKey(bytes32 orgId, string memory accessKey) external view returns (bool) {
        if (!organizations[orgId].exists) return false;
        if (organizations[orgId].accessKeyHash == bytes32(0)) return true;
        return organizations[orgId].accessKeyHash == keccak256(bytes(accessKey));
    }

    /**
     * @notice Read basic registration details for an organization (Legacy Signature).
     */
    function getOrganization(bytes32 orgId)
        external
        view
        returns (
            bytes32 id,
            string memory name,
            address orgOwner,
            OrgStatus status,
            uint256 createdAt,
            uint256 approvedAt,
            bool exists
        )
    {
        Organization memory org = organizations[orgId];
        return (
            org.orgId,
            org.orgName,
            org.owner,
            org.status,
            org.createdAt,
            org.approvedAt,
            org.exists
        );
    }

    struct OrgView {
        bytes32 id;
        string name;
        string universityOrCompany;
        string purpose;
        uint256 capacity;
        uint256 memberCount;
        address orgOwner;
        uint8 status;
        uint256 createdAt;
        bool exists;
    }

    /**
     * @notice Read comprehensive organization details stored on-chain.
     */
    function getOrganizationFull(bytes32 orgId)
        external
        view
        returns (OrgView memory)
    {
        Organization storage org = organizations[orgId];
        return OrgView({
            id: org.orgId,
            name: org.orgName,
            universityOrCompany: org.universityOrCompany,
            purpose: org.purpose,
            capacity: org.capacity,
            memberCount: orgMembers[orgId].length,
            orgOwner: org.owner,
            status: uint8(org.status),
            createdAt: org.createdAt,
            exists: org.exists
        });
    }

    /**
     * @notice Read additional institutional metadata.
     */
    function getOrganizationMetadata(bytes32 orgId)
        external
        view
        returns (
            string memory universityOrCompany,
            string memory purpose,
            uint256 capacity,
            uint256 memberCount
        )
    {
        Organization storage org = organizations[orgId];
        return (
            org.universityOrCompany,
            org.purpose,
            org.capacity,
            orgMembers[orgId].length
        );
    }

    /**
     * @notice Return all members of an organization and whether each is an authorized admin.
     */
    function getOrganizationMembers(bytes32 orgId)
        external
        view
        returns (address[] memory members, bool[] memory isAdmins)
    {
        require(organizations[orgId].exists, "Organization does not exist");
        address[] memory list = orgMembers[orgId];
        bool[] memory adminFlags = new bool[](list.length);

        for (uint256 i = 0; i < list.length; i++) {
            address m = list[i];
            adminFlags[i] = (m == organizations[orgId].owner || isOrganizationAdmin[orgId][m]);
        }
        return (list, adminFlags);
    }

    /**
     * @notice Returns all registered organization IDs on-chain.
     */
    function getAllOrgIds() external view returns (bytes32[] memory) {
        return allOrgIds;
    }

    /**
     * @notice Return all organization IDs that the given user belongs to (as owner or member).
     */
    function getUserOrgIds(address user) external view returns (bytes32[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < allOrgIds.length; i++) {
            bytes32 oid = allOrgIds[i];
            if (organizations[oid].owner == user || isOrganizationMember[oid][user]) {
                count++;
            }
        }

        bytes32[] memory result = new bytes32[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allOrgIds.length; i++) {
            bytes32 oid = allOrgIds[i];
            if (organizations[oid].owner == user || isOrganizationMember[oid][user]) {
                result[idx] = oid;
                idx++;
            }
        }
        return result;
    }

    // ==========================================
    // 2. ROLE-BASED ISSUER PERMISSION MANAGEMENT
    // ==========================================

    /**
     * @notice Authorize an administrator/issuer wallet for an approved organization.
     */
    function addOrganizationAdmin(bytes32 orgId, address adminAddress)
        external
        onlyApprovedOrg(orgId)
        onlyOrgOwnerOrSuperAdmin(orgId)
    {
        require(adminAddress != address(0), "Admin address cannot be zero address");
        require(!isOrganizationAdmin[orgId][adminAddress], "Address is already an authorized admin for this organization");

        // Automatically enroll as member if not already present
        if (!isOrganizationMember[orgId][adminAddress]) {
            orgMembers[orgId].push(adminAddress);
            isOrganizationMember[orgId][adminAddress] = true;
            emit MemberJoined(orgId, adminAddress, block.timestamp);
        }

        isOrganizationAdmin[orgId][adminAddress] = true;
        organizationAdminCount[orgId] += 1;

        emit OrganizationAdminAdded(orgId, adminAddress, msg.sender, block.timestamp);
    }

    /**
     * @notice Revoke administrator/issuer permissions from a wallet for an organization.
     */
    function removeOrganizationAdmin(bytes32 orgId, address adminAddress)
        external
        onlyApprovedOrg(orgId)
        onlyOrgOwnerOrSuperAdmin(orgId)
    {
        require(adminAddress != address(0), "Admin address cannot be zero address");
        require(isOrganizationAdmin[orgId][adminAddress], "Address is not an admin for this organization");

        if (adminAddress == organizations[orgId].owner) {
            require(
                organizationAdminCount[orgId] > 1,
                "Cannot remove owner when no other authorized administrators exist"
            );
        }

        isOrganizationAdmin[orgId][adminAddress] = false;
        if (organizationAdminCount[orgId] > 0) {
            organizationAdminCount[orgId] -= 1;
        }

        emit OrganizationAdminRemoved(orgId, adminAddress, msg.sender, block.timestamp);
    }

    /**
     * @notice Check whether an address is an authorized issuer for a specific organization.
     */
    function isAuthorizedIssuer(bytes32 orgId, address caller)
        external
        view
        returns (bool)
    {
        if (!organizations[orgId].exists || organizations[orgId].status != OrgStatus.Approved) {
            return false;
        }
        return (caller == organizations[orgId].owner || isOrganizationAdmin[orgId][caller]);
    }

    // ==========================================
    // 3. CERTIFICATE ISSUANCE & REVOCATION
    // ==========================================

    /**
     * @notice Issue a cryptographic certificate record under a specific approved organization.
     */
    function issueCertificate(
        bytes32 orgId,
        string memory certificateId,
        bytes32 certificateHash
    )
        external
        onlyAuthorizedOrgIssuer(orgId)
    {
        require(bytes(certificateId).length > 0, "Certificate ID cannot be empty");
        require(certificateHash != bytes32(0), "Certificate hash cannot be empty");
        require(!certificates[certificateId].exists, "Certificate already registered");

        certificates[certificateId] = CertificateRecord({
            orgId: orgId,
            certificateHash: certificateHash,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            exists: true,
            revoked: false,
            revokedAt: 0
        });

        orgCertificates[orgId].push(certificateId);
        totalCertificatesIssued += 1;

        emit CertificateIssued(
            orgId,
            certificateId,
            certificateHash,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Revoke an issued certificate within its specific organization.
     */
    function revokeCertificate(bytes32 orgId, string memory certificateId)
        external
        onlyAuthorizedOrgIssuer(orgId)
    {
        require(bytes(certificateId).length > 0, "Certificate ID cannot be empty");
        CertificateRecord storage record = certificates[certificateId];
        require(record.exists, "Certificate does not exist");
        require(record.orgId == orgId, "Certificate does not belong to this organization");
        require(!record.revoked, "Certificate is already revoked");

        record.revoked = true;
        record.revokedAt = block.timestamp;
        totalCertificatesRevoked += 1;

        emit CertificateRevoked(orgId, certificateId, msg.sender, block.timestamp);
    }

    /**
     * @notice Get all certificate IDs issued under a specific organization.
     */
    function getOrganizationCertificates(bytes32 orgId)
        external
        view
        returns (string[] memory)
    {
        return orgCertificates[orgId];
    }

    /**
     * @notice Verify a certificate by ID on-chain.
     */
    function verifyCertificate(string memory certificateId)
        external
        view
        returns (
            bytes32 orgId,
            bytes32 certificateHash,
            address issuer,
            uint256 issuedAt,
            bool exists,
            bool revoked,
            uint256 revokedAt
        )
    {
        require(bytes(certificateId).length > 0, "Certificate ID cannot be empty");
        CertificateRecord memory record = certificates[certificateId];
        return (
            record.orgId,
            record.certificateHash,
            record.issuer,
            record.issuedAt,
            record.exists,
            record.revoked,
            record.revokedAt
        );
    }
}
