// SPDX-License-Identifier: MIT
pragma solidity 0.8.21;

/**
 * @title Certificate
 * @dev Independent blockchain proof layer for VerifiedRecords.
 * Stores minimal cryptographic proof of university credentials without personal student data.
 */
contract Certificate {

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

    /**
     * @notice Issue and register a certificate hash on the blockchain.
     * @param certificateId Unique certificate identifier (e.g. CERT_CSE001)
     * @param certificateHash Deterministic hash of the certificate data
     */
    function issueCertificate(string memory certificateId, bytes32 certificateHash) external {
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
}
