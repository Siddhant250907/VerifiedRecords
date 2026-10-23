// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Certificate
 * @dev Independent blockchain proof layer for VerifiedRecords.
 * Stores minimal cryptographic proof of university credentials and authorized admin accounts.
 * Hardened with role-based access control and OpenZeppelin Ownable for public Ethereum Sepolia deployment.
 */
contract Certificate is Ownable {

    // ==========================================
    // CERTIFICATE DATA STRUCTURES & EVENTS
    // ==========================================

    // Struct to store minimal on-chain certificate proof
    struct CertificateRecord {
        bytes32 certificateHash;
        address issuer;
        uint256 issuedAt;
        bool exists;
    }

    // Mapping from certificate ID to certificate record
    mapping(string => CertificateRecord) private certificates;

    // Event emitted when a certificate is successfully registered
    event CertificateIssued(
        string certificateId,
        bytes32 certificateHash,
        address indexed issuer,
        uint256 issuedAt
    );

    // ==========================================
    // ADMIN ACCOUNT DATA STRUCTURES & EVENTS
    // ==========================================

    // Struct to store on-chain admin account proof
    struct AdminRecord {
        string adminUserId;
        address adminAddress;
        uint256 registeredAt;
        bool exists;
    }

    // Mapping from admin user ID to admin record
    mapping(string => AdminRecord) private admins;

    // Mapping from wallet address to admin authorization status
    mapping(address => bool) public isRegisteredAdmin;

    // Mapping from wallet address to admin user ID string
    mapping(address => string) public adminUserByAddress;

    // Total count of on-chain registered administrators
    uint256 public adminCount;

    // Event emitted when a new admin account is registered on the blockchain
    event AdminRegistered(
        string adminUserId,
        address indexed adminAddress,
        uint256 registeredAt
    );

    // Event emitted when an administrator account is revoked on the blockchain
    event AdminRevoked(
        string adminUserId,
        address indexed adminAddress,
        uint256 revokedAt
    );

    // ==========================================
    // CONSTRUCTOR & ACCESS CONTROL MODIFIERS
    // ==========================================

    /**
     * @notice Initializes the Certificate contract, establishing the deployer as initial owner.
     * Compatible with OpenZeppelin Contracts v5.x.
     */
    constructor() Ownable(msg.sender) {}

    /**
     * @dev Restricts certificate issuance to authorized administrators or the contract owner.
     */
    modifier onlyAuthorizedIssuer() {
        require(
            msg.sender == owner() || isRegisteredAdmin[msg.sender],
            "Caller is not authorized to issue certificates"
        );
        _;
    }

    // ==========================================
    // CERTIFICATE FUNCTIONS
    // ==========================================

    /**
     * @notice Issue and register a certificate hash on the blockchain.
     * @dev Only the contract owner or an authorized administrator can issue certificates.
     * @param certificateId Unique certificate identifier (e.g. CERT_CSE001)
     * @param certificateHash Deterministic hash of the certificate data
     */
    function issueCertificate(string memory certificateId, bytes32 certificateHash)
        external
        onlyAuthorizedIssuer
    {
        require(bytes(certificateId).length > 0, "Certificate ID cannot be empty");
        require(certificateHash != bytes32(0), "Certificate hash cannot be empty");
        require(!certificates[certificateId].exists, "Certificate already registered");

        certificates[certificateId] = CertificateRecord({
            certificateHash: certificateHash,
            issuer: msg.sender,
            issuedAt: block.timestamp,
            exists: true
        });

        emit CertificateIssued(
            certificateId,
            certificateHash,
            msg.sender,
            block.timestamp
        );
    }

    /**
     * @notice Retrieve the blockchain record for a given certificate ID.
     * @dev Public read-only view function. Does not require wallet connection or gas.
     * @param certificateId Unique certificate identifier
     * @return certificateHash Stored cryptographic hash of the certificate
     * @return issuer Address of the account that registered the certificate
     * @return issuedAt Blockchain timestamp when the certificate was registered
     * @return exists Boolean indicating whether the certificate exists on-chain
     */
    function verifyCertificate(string memory certificateId)
        external
        view
        returns (
            bytes32 certificateHash,
            address issuer,
            uint256 issuedAt,
            bool exists
        )
    {
        require(bytes(certificateId).length > 0, "Certificate ID cannot be empty");
        CertificateRecord memory record = certificates[certificateId];
        return (record.certificateHash, record.issuer, record.issuedAt, record.exists);
    }

    // ==========================================
    // ADMIN REGISTRATION & MANAGEMENT FUNCTIONS
    // ==========================================

    /**
     * @notice Register an administrator with a designated wallet address and user ID.
     * @dev Only the contract owner can register administrators.
     * @param adminUserId Unique admin identifier (e.g. REGISTRAR_01)
     * @param adminAddress Wallet address of the administrator
     */
    function registerAdmin(string memory adminUserId, address adminAddress)
        public
        onlyOwner
    {
        require(bytes(adminUserId).length > 0, "Admin USER ID cannot be empty");
        require(adminAddress != address(0), "Admin address cannot be zero address");
        require(!admins[adminUserId].exists, "Admin USER ID already registered on-chain");
        require(!isRegisteredAdmin[adminAddress], "Admin address already registered");

        admins[adminUserId] = AdminRecord({
            adminUserId: adminUserId,
            adminAddress: adminAddress,
            registeredAt: block.timestamp,
            exists: true
        });

        isRegisteredAdmin[adminAddress] = true;
        adminUserByAddress[adminAddress] = adminUserId;
        adminCount += 1;

        emit AdminRegistered(
            adminUserId,
            adminAddress,
            block.timestamp
        );
    }

    /**
     * @notice Register the owner's own wallet under the given adminUserId.
     * @dev Preserves the 1-parameter registerAdmin(string) signature while strictly enforcing onlyOwner.
     * @param adminUserId Unique admin identifier (e.g. REGISTRAR_01)
     */
    function registerAdmin(string memory adminUserId)
        external
        onlyOwner
    {
        registerAdmin(adminUserId, msg.sender);
    }

    /**
     * @notice Revoke administrator permissions by wallet address.
     * @dev Only the contract owner can revoke administrators.
     * @param adminAddress Wallet address of the administrator to revoke
     */
    function revokeAdmin(address adminAddress)
        public
        onlyOwner
    {
        require(adminAddress != address(0), "Admin address cannot be zero address");
        require(isRegisteredAdmin[adminAddress], "Address is not a registered admin");

        string memory userId = adminUserByAddress[adminAddress];
        if (bytes(userId).length > 0) {
            admins[userId].exists = false;
            delete adminUserByAddress[adminAddress];
        }

        isRegisteredAdmin[adminAddress] = false;
        if (adminCount > 0) {
            adminCount -= 1;
        }

        emit AdminRevoked(userId, adminAddress, block.timestamp);
    }

    /**
     * @notice Revoke administrator permissions by admin user ID.
     * @dev Only the contract owner can revoke administrators.
     * @param adminUserId Unique admin identifier to revoke
     */
    function revokeAdmin(string memory adminUserId)
        external
        onlyOwner
    {
        require(bytes(adminUserId).length > 0, "Admin USER ID cannot be empty");
        require(admins[adminUserId].exists, "Admin USER ID does not exist");
        address adminAddress = admins[adminUserId].adminAddress;
        revokeAdmin(adminAddress);
    }

    /**
     * @notice Retrieve on-chain details for an admin account.
     * @param adminUserId Unique admin identifier
     * @return userId Stored admin user ID
     * @return adminAddress Wallet address of the admin
     * @return registeredAt Blockchain timestamp of registration
     * @return exists Boolean indicating if admin exists on-chain
     */
    function getAdmin(string memory adminUserId)
        external
        view
        returns (
            string memory userId,
            address adminAddress,
            uint256 registeredAt,
            bool exists
        )
    {
        require(bytes(adminUserId).length > 0, "Admin USER ID cannot be empty");
        AdminRecord memory record = admins[adminUserId];
        return (record.adminUserId, record.adminAddress, record.registeredAt, record.exists);
    }
}
