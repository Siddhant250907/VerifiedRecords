// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DocumentVaultProof
 * @dev Independent zero-knowledge cryptographic proof registry for VerifiedRecords Secure Document Vault.
 * Anchors only opaque document IDs and cryptographic hashes of encrypted payloads.
 * Never stores plaintext files, document titles, personal identifiers, passwords, or encryption keys.
 */
contract DocumentVaultProof is Ownable {

    struct DocumentRecord {
        bytes32 payloadHash;
        address submitter;
        uint256 anchoredAt;
        bool exists;
    }

    // Mapping from opaque document ID to on-chain proof record
    mapping(string => DocumentRecord) private documents;

    // Total count of anchored document proofs
    uint256 public documentCount;

    // Event emitted when a document proof is anchored
    event DocumentProofAnchored(
        string indexed documentId,
        bytes32 payloadHash,
        address indexed submitter,
        uint256 anchoredAt
    );

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Anchors an opaque document ID and the cryptographic hash of its encrypted ciphertext.
     * @param documentId Opaque unique document identifier
     * @param payloadHash Cryptographic hash (SHA-256 / Keccak-256) of the encrypted payload
     */
    function anchorDocumentProof(string calldata documentId, bytes32 payloadHash) external {
        require(bytes(documentId).length > 0, "Document ID cannot be empty");
        require(payloadHash != bytes32(0), "Payload hash cannot be zero");
        require(!documents[documentId].exists, "Document proof already anchored");

        documents[documentId] = DocumentRecord({
            payloadHash: payloadHash,
            submitter: msg.sender,
            anchoredAt: block.timestamp,
            exists: true
        });

        documentCount++;

        emit DocumentProofAnchored(documentId, payloadHash, msg.sender, block.timestamp);
    }

    /**
     * @notice Read-only verification of an anchored document proof.
     * @param documentId Opaque unique document identifier
     */
    function verifyDocumentProof(string calldata documentId)
        external
        view
        returns (
            bytes32 payloadHash,
            address submitter,
            uint256 anchoredAt,
            bool exists
        )
    {
        DocumentRecord memory record = documents[documentId];
        return (
            record.payloadHash,
            record.submitter,
            record.anchoredAt,
            record.exists
        );
    }
}
