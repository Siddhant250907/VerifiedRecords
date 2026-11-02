# Verified Records
### Trust Every Certificate. Verify Every Credential.

<p align="center">
  <strong>A Blockchain-Based Academic Certificate Verification & Secure Document Management Platform</strong>
</p>

<p align="center">
  <a href="https://verifiedrecords.onrender.com/"><strong>🌐 OPEN LIVE APPLICATION</strong></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Live-success?style=flat-square" />
  <img src="https://img.shields.io/badge/Blockchain-Ethereum%20Sepolia-222222?style=flat-square" />
  <img src="https://img.shields.io/badge/Smart%20Contracts-Solidity-black?style=flat-square" />
  <img src="https://img.shields.io/badge/Backend-Node.js-green?style=flat-square" />
  <img src="https://img.shields.io/badge/Database-MongoDB%20Atlas-green?style=flat-square" />
</p>

---

## 🌐 Live Project

**Website:** https://verifiedrecords.onrender.com/

Verified Records is a web-based platform designed to make academic credentials easier to issue, manage, and verify.

It combines blockchain technology, secure document storage, organizational access management, and digital certificate generation into one application.

The goal is straightforward: make certificate verification more reliable, reduce dependence on manually checking physical documents, and give institutions a structured way to manage their credentials.

---

## The Problem

Traditional certificate verification can be slow, fragmented, and difficult to manage.

Institutions issue certificates through different processes, while employers and other organizations may need to contact the issuing institution to confirm whether a credential is genuine.

Physical documents can also be misplaced, duplicated, altered, or presented without a reliable way to establish their authenticity.

Verified Records addresses these challenges by bringing certificate issuance, blockchain-backed verification, and document management into a single platform.

## What Verified Records Offers

### 1. Blockchain-Based Certificate Issuance

Institutions can issue academic certificates through a structured digital workflow.

- Enter student and academic credential details.
- Associate each certificate with its issuing organization.
- Register the certificate's cryptographic commitment through a blockchain transaction.
- Track successful issuance and transaction information.
- Generate a downloadable digital certificate.

### 2. Instant Certificate Verification

Anyone with the necessary certificate identifier can use the verification interface to check a credential.

- Retrieve the relevant certificate record.
- Check its blockchain commitment.
- Validate its issuing organization.
- Check its current issuance and revocation status.
- View the verification result.
- Download the verified certificate as a PDF.

### 3. Institutional Organization Management

Verified Records supports multiple organizations instead of treating every institution as one shared administrative unit.

The platform follows a hierarchical permission structure:

**Platform Super Admin → Organization Owner → Organization Admin → Certificate Issuance**

Organizations can:

- Register an institution or company.
- Submit registration requests for Super Admin approval.
- Invite or onboard members.
- Request administrative access.
- Accept or reject administrator requests.
- Manage organization-specific records.
- Issue and manage certificates within their organization.

The organization owner can access owner-authorized functions directly, while approved administrators use their assigned administrative accounts.

Each certificate is associated with its issuing organization, keeping institutional records logically separate.

### 4. Secure Personal Document Vault

Users can maintain a personal collection of important documents through the Document Vault.

Supported document categories include:

- Your Documents
- E-Aadhaar
- PAN ID
- Driving Licence
- Marksheets
- APAAR ID

The vault supports document management operations such as uploading, viewing, downloading, and organizing files.

Documents use browser-side AES-256-GCM encryption before encrypted files are stored through Cloudinary.

### 5. Digital Certificate Generation

A successfully issued and verified certificate can be generated as a downloadable PDF.

The certificate includes the relevant credential information and its issuing organization, providing a convenient digital record that can be shared and verified.

---

## How the System Works

The overall process follows a straightforward workflow:

```text
         USER / INSTITUTION
                |
                v
       Firebase Authentication
                |
                v
        VERIFIED RECORDS
          WEB APPLICATION
                |
                v
       Node.js + Express API
                |
          +-----+------+
          |            |
          v            v
      MongoDB       Cloudinary
      Atlas          Storage
          |
          |
          v
     BLOCKCHAIN LAYER
          |
     +----+------+
     |           |
     v           v
   Sepolia     Ganache
     |           |
     +-----+-----+
           |
           v
   Certificate Issuance
           |
           v
   Certificate Verification
           |
           v
    Verified Certificate
       & PDF Download
```

The database manages application records, while the blockchain provides cryptographic verification and transaction records. Encrypted document files are managed separately through Cloudinary.

## Organization Workflow

```text
Platform Super Admin
        |
        v
Approve Organization
        |
        v
Organization Owner
        |
        +----------------------+
        |                      |
        v                      v
Direct Owner Access      Admin Request
                               |
                               v
                       Owner Approval
                               |
                               v
                       Organization Admin
                               |
                               v
                       Certificate Issuance
                               |
                               v
                         Issued Records
```

This structure allows multiple organizations to operate independently while maintaining platform-level approval and organization-specific access control.

---

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML5, CSS3, JavaScript |
| Backend | Node.js, Express.js |
| Authentication | Firebase Authentication |
| Database | MongoDB Atlas |
| Smart Contracts | Solidity |
| Blockchain Development | Truffle |
| Local Blockchain | Ganache |
| Public Test Network | Ethereum Sepolia |
| Wallet Integration | MetaMask |
| Document Storage | Cloudinary |
| Document Encryption | Web Crypto API, AES-256-GCM |
| Hosting | Render |
| Version Control | Git & GitHub |

---

## Blockchain Integration

Verified Records uses Ethereum-compatible smart contracts to establish verifiable certificate records.

Two blockchain environments are supported:

**Ethereum Sepolia**
- Public Ethereum test network.
- Used for testing blockchain transactions without real-world financial value.
- Supports certificate registration and verification against deployed contracts.

**Ganache Local**
- Local blockchain development environment.
- Used for testing contract interactions and development workflows.

MetaMask provides wallet connectivity and transaction signing.

The application uses recorded network and contract information when verifying certificates, rather than assuming every certificate belongs to the currently selected network.

**Privacy principle:** Student names, personal identification numbers, passwords, and document contents should not be placed directly on a public blockchain. Certificate verification relies on cryptographic commitments and relevant blockchain status information.

---

## Security & Privacy

Security is an important part of the platform's design.

- Firebase Authentication for user authentication.
- Role-based access for platform and organization operations.
- Organization-specific access restrictions.
- Cryptographic certificate commitments for integrity verification.
- AES-256-GCM browser-side encryption for vault documents.
- Password-based protection for document-vault access.
- MetaMask-controlled blockchain transaction signing.
- Blockchain transaction receipt and status verification.

The application separates personal document storage, application metadata, authentication, and blockchain verification rather than treating them as a single storage system.

---

## Running the Project Locally

### Prerequisites

Install the following:

- Node.js and npm
- MongoDB Atlas account
- Firebase project
- MetaMask browser extension
- Ganache (for local blockchain development)
- Truffle

### Setup

**1. Clone the repository**

```bash
git clone https://github.com/Siddhant250907/University-Certificate-System.git
```

**2. Open the project directory**

```bash
cd University-Certificate-System
```

**3. Install dependencies**

```bash
npm install
```

**4. Configure environment variables**

Create your local `.env` file using the structure provided in `.env.example`.

Add your own configuration for:

- MongoDB Atlas
- Firebase
- Cloudinary
- Blockchain RPC endpoints
- Deployed contract addresses

Never commit your `.env` file, private keys, or other credentials to GitHub.

**5. Start the application**

Run the start command defined in `package.json`.

For a typical Node.js setup:

```bash
npm start
```

**6. Open the application**

```text
http://localhost:3000
```

Use the port configured by your local Express server if it differs.

For local blockchain testing, start Ganache and configure MetaMask with the project's local network and deployed contract.

---

## Project Structure

The application is organized around the following major components:

| Directory / File | Purpose |
|---|---|
| `docs/` | Frontend pages and static assets |
| `docs/assets/css/` | Stylesheets |
| `docs/assets/js/` | Frontend JavaScript |
| `server/` | Express backend and blockchain services |
| `contracts/` | Solidity smart contracts |
| `migrations/` | Truffle deployment scripts |
| `build/contracts/` | Compiled contract artifacts |
| `truffle-config.js` | Blockchain network and deployment configuration |
| `package.json` | Dependencies and application scripts |

---

## Why Verified Records?

Verified Records brings together three important aspects of digital credential management:

**Authenticity** — Blockchain-backed records help establish the integrity of issued credentials.

**Organization** — Institutions can manage their own members, administrators, and certificates through dedicated organizational workflows.

**Accessibility** — Users and verifiers can access digital credentials and document-management features through a single web application.

Instead of treating a certificate as just another PDF, Verified Records treats it as a verifiable digital record.

---

## Future Scope

Potential areas for further development include:

- Privacy-preserving certificate verification.
- Expanded institutional integrations.
- More advanced organization-management controls.
- Improved document recovery and key management.
- Additional blockchain network support.
- Automated institutional verification workflows.

---

## Author

**Siddhant Asati**

Verified Records — Blockchain-Based Academic Certificate Verification and Secure Document Management.

<p align="center">
  <strong>Built to make digital credentials more trustworthy.</strong>
</p>

<p align="center">
  <a href="https://verifiedrecords.onrender.com/">Visit Verified Records</a>
</p>
