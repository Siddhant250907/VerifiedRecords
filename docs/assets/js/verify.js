/**
 * VerifiedRecords — Certificate Verification Controller
 * 
 * Features:
 * 1. Dual-Factor Verification: Requires BOTH User Name ('Your Name') and Certificate ID ('Your Certificate ID').
 *    - Both must match the institutional registry record exactly; if either fails, verification is rejected.
 * 2. Verify as Admin Option Button:
 *    - Interactive toggle button ('Verify as Admin') without description box below.
 *    - Admin Active: Shows official certificate details AND on-chain blockchain cryptographic proof panel.
 *    - Normal User Mode (Default): Shows official certificate details only (blockchain details hidden).
 * 3. Save as PDF & Print (Single A4 Page Format):
 *    - Single clean action row in the certificate card footer (no duplicate buttons).
 *    - Download PDF: Generates and downloads a clean, official A4 PDF copy via html2pdf with generous 16mm margins.
 *    - Print (A4 Format): Optimized print styles guarantee the certificate fits strictly onto a single A4 page.
 */

(function () {
    "use strict";

    // -------------------------------------------------------------------------
    // API BASE ENDPOINT
    // -------------------------------------------------------------------------
    const API_BASE = "/api/certificate/";

    // -------------------------------------------------------------------------
    // DOM ELEMENTS
    // -------------------------------------------------------------------------
    const verifyForm = document.getElementById("verifyForm");
    const userNameInput = document.getElementById("userName");
    const verifyNameInputGroup = document.getElementById("verifyNameInputGroup");
    const clearNameBtn = document.getElementById("clearNameBtn");

    const certificateIdInput = document.getElementById("certificateId");
    const verifyInputGroup = document.getElementById("verifyInputGroup");
    const clearInputBtn = document.getElementById("clearInputBtn");

    const verifyAdminToggleBtn = document.getElementById("verifyAdminToggleBtn");
    const adminToggleIcon = document.getElementById("adminToggleIcon");
    const adminToggleBadge = document.getElementById("adminToggleBadge");

    const verifyBtn = document.getElementById("verifyBtn");
    const verifyBtnIcon = document.getElementById("verifyBtnIcon");
    const verifyBtnText = document.getElementById("verifyBtnText");

    const inlineAlert = document.getElementById("inlineAlert");
    const inlineAlertIcon = document.getElementById("inlineAlertIcon");
    const inlineAlertTitle = document.getElementById("inlineAlertTitle");
    const inlineAlertMessage = document.getElementById("inlineAlertMessage");

    const verificationResult = document.getElementById("verificationResult");
    const certificateResultCard = document.getElementById("certificateResultCard");
    const certCardHeaderTitle = document.getElementById("certCardHeaderTitle");
    const credentialDetailsGrid = document.getElementById("credentialDetailsGrid");
    const downloadPdfBtn = document.getElementById("downloadPdfBtn");
    const printCertBtn = document.getElementById("printCertBtn");
    const verifyAnotherBtn = document.getElementById("verifyAnotherBtn");

    // Blockchain Proof Panel DOM elements
    const blockchainProofPanel = document.getElementById("blockchainProofPanel");
    const proofIssuer = document.getElementById("proofIssuer");
    const copyIssuerBtn = document.getElementById("copyIssuerBtn");
    const proofTimestamp = document.getElementById("proofTimestamp");
    const proofContract = document.getElementById("proofContract");
    const copyContractBtn = document.getElementById("copyContractBtn");
    const proofBlockNumber = document.getElementById("proofBlockNumber");
    const proofCertHash = document.getElementById("proofCertHash");
    const copyCertHashBtn = document.getElementById("copyCertHashBtn");
    const proofTxHash = document.getElementById("proofTxHash");
    const proofTxHashClickable = document.getElementById("proofTxHashClickable");
    const copyTxHashBtn = document.getElementById("copyTxHashBtn");
    const copyTxIcon = document.getElementById("copyTxIcon");
    const copyTxText = document.getElementById("copyTxText");
    const proofCopyToast = document.getElementById("proofCopyToast");

    const invalidModal = document.getElementById("invalidModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalDesc = document.getElementById("modalDesc");
    const modalCloseBtn = document.getElementById("modalCloseBtn");
    const modalDismissBtn = document.getElementById("modalDismissBtn");

    // -------------------------------------------------------------------------
    // APPLICATION STATE
    // -------------------------------------------------------------------------
    let isSubmitting = false;
    let isAdminMode = false; // Default: normal user mode (no blockchain details)
    let currentCertificateData = null;
    let currentBlockchainData = null;

    // -------------------------------------------------------------------------
    // ADMIN MODE TOGGLE BUTTON CONTROLLER (JUST A BUTTON, NO DESCRIPTION)
    // -------------------------------------------------------------------------
    function updateAdminModeUI() {
        if (!verifyAdminToggleBtn) return;

        if (isAdminMode) {
            verifyAdminToggleBtn.classList.add("active");
            verifyAdminToggleBtn.setAttribute("aria-pressed", "true");
            if (adminToggleIcon) {
                adminToggleIcon.className = "fa-solid fa-shield-halved";
            }
            if (adminToggleBadge) {
                adminToggleBadge.innerHTML = '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Admin Enabled';
            }
        } else {
            verifyAdminToggleBtn.classList.remove("active");
            verifyAdminToggleBtn.setAttribute("aria-pressed", "false");
            if (adminToggleIcon) {
                adminToggleIcon.className = "fa-solid fa-user-shield";
            }
            if (adminToggleBadge) {
                adminToggleBadge.innerHTML = '<i class="fa-solid fa-circle-dot" aria-hidden="true"></i> OFF';
            }
        }

        // Dynamically update proof panel if certificate is currently rendered
        if (blockchainProofPanel && verificationResult && verificationResult.style.display !== "none") {
            blockchainProofPanel.style.display = isAdminMode ? "block" : "none";
        }
    }

    if (verifyAdminToggleBtn) {
        verifyAdminToggleBtn.addEventListener("click", function () {
            isAdminMode = !isAdminMode;
            updateAdminModeUI();
        });
    }

    // -------------------------------------------------------------------------
    // CLIPBOARD COPY UTILITIES WITH VISUAL FEEDBACK
    // -------------------------------------------------------------------------
    async function copyToClipboard(text, isTxAction = false, triggerBtn = null) {
        if (!text || text === "—" || text === "N/A") return;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const ta = document.createElement("textarea");
                ta.value = text;
                ta.style.position = "fixed";
                ta.style.opacity = "0";
                document.body.appendChild(ta);
                ta.select();
                document.execCommand("copy");
                document.body.removeChild(ta);
            }
        } catch (copyErr) {
            console.warn("Clipboard write failed:", copyErr);
        }

        // Show floating copy toast
        if (proofCopyToast) {
            proofCopyToast.style.display = "inline-flex";
            clearTimeout(proofCopyToast._timer);
            proofCopyToast._timer = setTimeout(() => {
                proofCopyToast.style.display = "none";
            }, 2500);
        }

        // Feedback for transaction button
        if (isTxAction) {
            if (copyTxIcon) copyTxIcon.className = "fa-solid fa-check";
            if (copyTxText) copyTxText.textContent = "Copied!";
            if (copyTxHashBtn) copyTxHashBtn.classList.add("copied");

            setTimeout(() => {
                if (copyTxIcon) copyTxIcon.className = "fa-regular fa-copy";
                if (copyTxText) copyTxText.textContent = "Copy";
                if (copyTxHashBtn) copyTxHashBtn.classList.remove("copied");
            }, 2500);
        } else if (triggerBtn) {
            const icon = triggerBtn.querySelector("i");
            if (icon) {
                const origClass = icon.className;
                icon.className = "fa-solid fa-check";
                setTimeout(() => {
                    icon.className = origClass;
                }, 2000);
            }
        }
    }

    // -------------------------------------------------------------------------
    // INLINE ALERT HELPERS
    // -------------------------------------------------------------------------
    function showInlineAlert(type, title, message) {
        if (!inlineAlert) return;

        inlineAlert.className = "inline-alert " + type;
        inlineAlert.style.display = "flex";

        if (inlineAlertTitle) inlineAlertTitle.textContent = title;
        if (inlineAlertMessage) inlineAlertMessage.textContent = message;

        if (inlineAlertIcon) {
            if (type === "danger") {
                inlineAlertIcon.className = "inline-alert-icon fa-solid fa-circle-exclamation";
            } else if (type === "warning") {
                inlineAlertIcon.className = "inline-alert-icon fa-solid fa-triangle-exclamation";
            } else {
                inlineAlertIcon.className = "inline-alert-icon fa-solid fa-circle-info";
            }
        }
    }

    function hideInlineAlert() {
        if (inlineAlert) {
            inlineAlert.style.display = "none";
        }
        if (verifyNameInputGroup) {
            verifyNameInputGroup.classList.remove("input-error");
        }
        if (verifyInputGroup) {
            verifyInputGroup.classList.remove("input-error");
        }
    }

    // -------------------------------------------------------------------------
    // MODAL DIALOG CONTROLLER (Accessible, Esc key, Backdrop, Focus)
    // -------------------------------------------------------------------------
    let lastFocusedElement = null;

    function openInvalidModal(title, message) {
        if (!invalidModal) return;

        if (modalTitle && title) modalTitle.textContent = title;
        if (modalDesc && message) modalDesc.textContent = message;

        lastFocusedElement = document.activeElement;
        invalidModal.style.display = "flex";
        document.body.style.overflow = "hidden";

        if (modalDismissBtn) {
            setTimeout(() => modalDismissBtn.focus(), 50);
        }
    }

    function closeInvalidModal() {
        if (!invalidModal) return;

        invalidModal.style.display = "none";
        document.body.style.overflow = "";

        if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
            lastFocusedElement.focus();
        } else if (userNameInput && !userNameInput.value.trim()) {
            userNameInput.focus();
        } else if (certificateIdInput) {
            certificateIdInput.focus();
        }
    }

    if (modalCloseBtn) modalCloseBtn.addEventListener("click", closeInvalidModal);
    if (modalDismissBtn) modalDismissBtn.addEventListener("click", closeInvalidModal);

    if (invalidModal) {
        invalidModal.addEventListener("click", function (e) {
            if (e.target === invalidModal) {
                closeInvalidModal();
            }
        });
    }

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && invalidModal && invalidModal.style.display !== "none") {
            closeInvalidModal();
        }
    });

    // -------------------------------------------------------------------------
    // INPUT INTERACTIONS & CLEAR BUTTONS
    // -------------------------------------------------------------------------
    if (userNameInput) {
        userNameInput.addEventListener("input", function () {
            const val = this.value.trim();
            if (clearNameBtn) {
                clearNameBtn.style.display = val ? "flex" : "none";
            }
            if (verifyNameInputGroup) {
                verifyNameInputGroup.classList.remove("input-error");
            }
        });
    }

    if (clearNameBtn) {
        clearNameBtn.addEventListener("click", function () {
            if (userNameInput) {
                userNameInput.value = "";
                userNameInput.focus();
            }
            clearNameBtn.style.display = "none";
            hideInlineAlert();
            hideVerificationResult();
        });
    }

    if (certificateIdInput) {
        certificateIdInput.addEventListener("input", function () {
            const val = this.value.trim();
            if (clearInputBtn) {
                clearInputBtn.style.display = val ? "flex" : "none";
            }
            if (verifyInputGroup) {
                verifyInputGroup.classList.remove("input-error");
            }
        });
    }

    if (clearInputBtn) {
        clearInputBtn.addEventListener("click", function () {
            if (certificateIdInput) {
                certificateIdInput.value = "";
                certificateIdInput.focus();
            }
            clearInputBtn.style.display = "none";
            hideInlineAlert();
            hideVerificationResult();
        });
    }

    // -------------------------------------------------------------------------
    // RESULT SECTION RENDERING (ON-PAGE)
    // -------------------------------------------------------------------------
    function getCertFieldIcon(type) {
        if (!type) return "fa-award";
        const t = type.toLowerCase();
        if (t.includes("webinar")) return "fa-video";
        if (t.includes("seminar")) return "fa-users-line";
        if (t.includes("excellence")) return "fa-crown";
        if (t.includes("participation")) return "fa-certificate";
        if (t.includes("annual")) return "fa-calendar-check";
        if (t.includes("workshop")) return "fa-screwdriver-wrench";
        if (t.includes("course")) return "fa-graduation-cap";
        if (t.includes("hackathon") || t.includes("competition")) return "fa-laptop-code";
        if (t.includes("degree") || t.includes("diploma")) return "fa-building-columns";
        if (t.includes("merit") || t.includes("honor")) return "fa-medal";
        if (t.includes("internship")) return "fa-briefcase";
        if (t.includes("symposium")) return "fa-microchip";
        if (t.includes("research") || t.includes("publication")) return "fa-book-journal-whills";
        return "fa-award";
    }

    function renderVerifiedResult(cert, blockchain) {
        if (!verificationResult || !credentialDetailsGrid) return;

        currentCertificateData = cert;
        currentBlockchainData = blockchain;

        const escapeHtml = (str) => {
            if (!str) return "";
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        const certType = cert.certificateType || cert.fieldOfCertification || "Certificate of Excellence";
        if (certCardHeaderTitle) {
            certCardHeaderTitle.textContent = certType;
        }

        // Format issue date nicely
        let formattedIssueDate = escapeHtml(cert.issueDate);
        if (cert.issueDate && !isNaN(Date.parse(cert.issueDate))) {
            try {
                const d = new Date(cert.issueDate);
                formattedIssueDate = d.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                });
            } catch (err) {
                formattedIssueDate = escapeHtml(cert.issueDate);
            }
        }

        // Format registry timestamp if present
        let formattedIssuedAt = "";
        if (cert.issuedAt && !isNaN(Date.parse(cert.issuedAt))) {
            try {
                const regDate = new Date(cert.issuedAt);
                formattedIssuedAt = regDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                });
            } catch (err) {
                formattedIssuedAt = "";
            }
        }

        // Credential Grid Fields
        let fieldsHtml = "";

        // 1. Student Name
        if (cert.studentName) {
            fieldsHtml += `
                <div class="credential-field featured">
                    <span class="credential-label">
                        <i class="fa-solid fa-user-graduate" aria-hidden="true"></i> Student Name
                    </span>
                    <span class="credential-value prominent">${escapeHtml(cert.studentName)}</span>
                </div>
            `;
        }

        // 2. Roll Number
        if (cert.rollNumber) {
            fieldsHtml += `
                <div class="credential-field">
                    <span class="credential-label">
                        <i class="fa-solid fa-id-card" aria-hidden="true"></i> Roll Number
                    </span>
                    <span class="credential-value mono">${escapeHtml(cert.rollNumber)}</span>
                </div>
            `;
        }

        // 3. Course
        if (cert.course) {
            fieldsHtml += `
                <div class="credential-field">
                    <span class="credential-label">
                        <i class="fa-solid fa-graduation-cap" aria-hidden="true"></i> Course
                    </span>
                    <span class="credential-value">${escapeHtml(cert.course)}</span>
                </div>
            `;
        }

        // 4. Field of Certification / Credential Type
        const certFieldIcon = getCertFieldIcon(certType);
        fieldsHtml += `
            <div class="credential-field cert-type-featured">
                <span class="credential-label">
                    <i class="fa-solid fa-layer-group" aria-hidden="true"></i> Field of Certification
                </span>
                <span class="credential-value">
                    <span class="cert-type-pill">
                        <i class="fa-solid ${certFieldIcon} cert-badge-icon" aria-hidden="true"></i>
                        ${escapeHtml(certType)}
                    </span>
                </span>
            </div>
        `;

        // 5. Certificate ID
        if (cert.certificateId) {
            fieldsHtml += `
                <div class="credential-field">
                    <span class="credential-label">
                        <i class="fa-solid fa-id-card-clip" aria-hidden="true"></i> Certificate ID
                    </span>
                    <span class="credential-value mono">${escapeHtml(cert.certificateId)}</span>
                </div>
            `;
        }

        // 6. Issue Date
        if (cert.issueDate) {
            fieldsHtml += `
                <div class="credential-field">
                    <span class="credential-label">
                        <i class="fa-solid fa-calendar-check" aria-hidden="true"></i> Issue Date
                    </span>
                    <span class="credential-value">${formattedIssueDate}</span>
                </div>
            `;
        }

        // 7. Registry Registration Date
        if (formattedIssuedAt) {
            fieldsHtml += `
                <div class="credential-field">
                    <span class="credential-label">
                        <i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Registry Recorded
                    </span>
                    <span class="credential-value">${formattedIssuedAt}</span>
                </div>
            `;
        }

        credentialDetailsGrid.innerHTML = fieldsHtml;

        // ---------------------------------------------------------------------
        // BLOCKCHAIN PROOF PANEL (SHOWN ONLY IF ADMIN MODE IS ENABLED)
        // ---------------------------------------------------------------------
        const issuerVal = (blockchain && blockchain.issuer) || cert.blockchainIssuer || "—";
        const contractVal = (blockchain && blockchain.contractAddress) || cert.contractAddress || "—";
        const certHashVal = (blockchain && (blockchain.certificateHash || blockchain.computedHash)) || cert.certificateHash || "—";
        const origTxHashVal = (blockchain && blockchain.transactionHash) || cert.transactionHash || "";

        if (proofIssuer) {
            proofIssuer.textContent = issuerVal;
            proofIssuer.title = issuerVal;
        }

        if (proofContract) {
            proofContract.textContent = contractVal;
            proofContract.title = contractVal;
        }

        const blockNumVal = (blockchain && blockchain.blockNumber) !== undefined ? blockchain.blockNumber : (cert && cert.blockNumber);
        if (proofBlockNumber) {
            proofBlockNumber.textContent = (blockNumVal !== null && blockNumVal !== undefined) ? `#${blockNumVal}` : "—";
        }

        if (proofCertHash) {
            proofCertHash.textContent = certHashVal;
            proofCertHash.title = certHashVal;
        }

        const isSepoliaRecord = (blockchain && (blockchain.blockchainNetwork === "sepolia" || blockchain.explorerUrl)) ||
                                (cert && cert.blockchainNetwork === "sepolia");
        const netDisplayName = isSepoliaRecord ? "Ethereum Sepolia" : "Ganache Local";

        if (proofTxHash) {
            if (origTxHashVal) {
                if (isSepoliaRecord) {
                    proofTxHash.innerHTML = `
                        <a href="https://sepolia.etherscan.io/tx/${encodeURIComponent(origTxHashVal)}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; display: inline-flex; align-items: center; gap: 4px;" title="View on Sepolia Etherscan">
                            ${escapeHtml(origTxHashVal)} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px;"></i>
                        </a>
                        <span style="margin-left: 6px; font-size: 10px; background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Ethereum Sepolia</span>
                    `;
                } else {
                    proofTxHash.innerHTML = `
                        <span>${escapeHtml(origTxHashVal)}</span>
                        <span style="margin-left: 6px; font-size: 10px; background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Ganache Local</span>
                    `;
                }
                proofTxHash.title = "Issuance Transaction: " + origTxHashVal;
            } else {
                proofTxHash.textContent = "Not Recorded";
                proofTxHash.title = "";
            }
        }

        const proofStatusText = document.querySelector(".proof-status-text");
        if (proofStatusText) {
            const isLocalProofOnly = blockchain && blockchain.status === "LocalProofOnly";
            if (isLocalProofOnly) {
                proofStatusText.innerHTML = `Blockchain Status: <strong style="color: #d97706;">Local Proof (Offline)</strong>`;
            } else {
                proofStatusText.innerHTML = `Blockchain Status: <strong>Verified</strong> (${escapeHtml(netDisplayName)})`;
            }
        }

        const rawTs = Number((blockchain && blockchain.issuedAt) || cert.blockchainIssuedAt || 0);
        if (proofTimestamp) {
            if (rawTs > 0) {
                try {
                    const blockDate = new Date(rawTs * 1000);
                    const formattedBlockTime = blockDate.toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        timeZoneName: "short"
                    });
                    proofTimestamp.innerHTML = `
                        <span>${escapeHtml(formattedBlockTime)}</span>
                        <span class="proof-unix-ts mono">(Unix: ${rawTs})</span>
                    `;
                } catch (e) {
                    proofTimestamp.textContent = String(rawTs);
                }
            } else {
                proofTimestamp.textContent = "—";
            }
        }

        // Toggle blockchain panel based on Admin status
        if (blockchainProofPanel) {
            blockchainProofPanel.style.display = isAdminMode ? "block" : "none";
        }

        // Display results smoothly
        verificationResult.style.display = "block";
        verificationResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function hideVerificationResult() {
        if (verificationResult) {
            verificationResult.style.display = "none";
        }
        if (credentialDetailsGrid) {
            credentialDetailsGrid.innerHTML = "";
        }
        if (blockchainProofPanel) {
            blockchainProofPanel.style.display = "none";
        }
        if (proofCopyToast) {
            proofCopyToast.style.display = "none";
        }

        currentCertificateData = null;
        currentBlockchainData = null;
    }

    // -------------------------------------------------------------------------
    // STANDALONE A4 CERTIFICATE HTML GENERATOR FOR HIGH-FIDELITY PDF EXPORT
    // (Eliminates viewport scroll clipping, guarantees perfect margins & official layout)
    // -------------------------------------------------------------------------
    function generatePdfCertificateHtml(cert, blockchain, isAdmin) {
        const escapeHtml = (str) => {
            if (!str) return "";
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        const certType = cert.certificateType || cert.fieldOfCertification || "Certificate of Excellence";

        let formattedIssueDate = escapeHtml(cert.issueDate || "—");
        if (cert.issueDate && !isNaN(Date.parse(cert.issueDate))) {
            try {
                const d = new Date(cert.issueDate);
                formattedIssueDate = d.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                });
            } catch (err) {
                formattedIssueDate = escapeHtml(cert.issueDate);
            }
        }

        let formattedIssuedAt = "";
        if (cert.issuedAt && !isNaN(Date.parse(cert.issuedAt))) {
            try {
                const regDate = new Date(cert.issuedAt);
                formattedIssuedAt = regDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric"
                });
            } catch (err) {
                formattedIssuedAt = "";
            }
        }

        // On-chain blockchain cryptographic proof section (Admin mode only)
        let blockchainSection = "";
        if (isAdmin && blockchain) {
            const issuer = (blockchain && blockchain.issuer) || cert.blockchainIssuer || "—";
            const contract = (blockchain && blockchain.contractAddress) || cert.contractAddress || "—";
            const certHash = (blockchain && (blockchain.certificateHash || blockchain.computedHash)) || cert.certificateHash || "—";
            const txHash = (blockchain && blockchain.transactionHash) || cert.transactionHash || "Not Recorded";
            const blockNum = (blockchain && blockchain.blockNumber) !== undefined ? blockchain.blockNumber : (cert && cert.blockNumber);
            const blockDisplay = (blockNum !== null && blockNum !== undefined) ? `#${blockNum}` : "—";
            const isSepNet = (blockchain && (blockchain.blockchainNetwork === "sepolia" || blockchain.explorerUrl)) ||
                             (cert && cert.blockchainNetwork === "sepolia");
            const netLabel = isSepNet ? "Ethereum Sepolia" : "Ganache Local";

            blockchainSection = `
                <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 12px 14px; margin-bottom: 14px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #bbf7d0; padding-bottom: 6px; margin-bottom: 8px;">
                        <span style="font-size: 11px; font-weight: 700; color: #166534;">⛓️ On-Chain Cryptographic Proof (${escapeHtml(netLabel)})</span>
                        <span style="font-size: 9px; font-weight: 700; background: #dcfce7; color: #15803d; padding: 2px 8px; border-radius: 12px; border: 1px solid #86efac;">Blockchain Status: Verified</span>
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 9.5px;">
                        <div style="background: #ffffff; padding: 6px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
                            <span style="color: #64748b; font-weight: 700; display: block; font-size: 8px;">ISSUER ADDRESS</span>
                            <span style="font-family: monospace; color: #0f172a; word-break: break-all;">${escapeHtml(issuer)}</span>
                        </div>
                        <div style="background: #ffffff; padding: 6px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
                            <span style="color: #64748b; font-weight: 700; display: block; font-size: 8px;">CONTRACT ADDRESS</span>
                            <span style="font-family: monospace; color: #0f172a; word-break: break-all;">${escapeHtml(contract)}</span>
                        </div>
                        <div style="background: #ffffff; padding: 6px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
                            <span style="color: #64748b; font-weight: 700; display: block; font-size: 8px;">BLOCK NUMBER</span>
                            <span style="font-family: monospace; color: #0f172a;">${escapeHtml(blockDisplay)}</span>
                        </div>
                        <div style="background: #ffffff; padding: 6px 8px; border-radius: 4px; border: 1px solid #e2e8f0;">
                            <span style="color: #64748b; font-weight: 700; display: block; font-size: 8px;">CRYPTOGRAPHIC HASH</span>
                            <span style="font-family: monospace; color: #0f172a; word-break: break-all;">${escapeHtml(certHash)}</span>
                        </div>
                        <div style="background: #ffffff; padding: 6px 8px; border-radius: 4px; border: 1px solid #e2e8f0; grid-column: 1 / -1;">
                            <span style="color: #64748b; font-weight: 700; display: block; font-size: 8px;">ORIGINAL ISSUANCE TRANSACTION</span>
                            <span style="font-family: monospace; color: #2563eb; word-break: break-all;">${escapeHtml(txHash)}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div style="font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; background: #ffffff; color: #0f172a; padding: 22px; box-sizing: border-box; width: 680px; margin: 0 auto; border: 3px solid #1e3a8a; border-radius: 12px;">
                <div style="border: 1.5px solid #93c5fd; border-radius: 8px; padding: 18px 22px; background: #ffffff;">
                    <!-- Top Institutional Masthead -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 14px;">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 44px; height: 44px; background: #eff6ff; border: 1.5px solid #3b82f6; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 22px;">
                                🏛️
                            </div>
                            <div>
                                <span style="font-size: 9.5px; font-weight: 700; color: #64748b; letter-spacing: 0.08em; text-transform: uppercase; display: block;">Institutional Credential Registry</span>
                                <h2 style="font-size: 17px; font-weight: 700; color: #0f172a; margin: 2px 0 0 0;">${escapeHtml(certType)}</h2>
                            </div>
                        </div>
                        <div style="border: 1.5px dashed #059669; background: #f0fdf4; color: #047857; padding: 6px 12px; border-radius: 6px; font-size: 9.5px; font-weight: 800; letter-spacing: 0.08em; text-align: center;">
                            AUTHENTIC RECORD
                        </div>
                    </div>

                    <!-- Formal Recognition Statement -->
                    <p style="font-size: 11.5px; color: #475569; margin: 0 0 14px 0; text-align: center; font-style: italic; line-height: 1.4;">
                        This official credential certifies that the student named below has successfully satisfied all prescribed academic and institutional requirements.
                    </p>

                    <!-- Student Name (Featured Highlight) -->
                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-left: 4px solid #2563eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 12px;">
                        <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 3px;">Student Name</span>
                        <span style="font-size: 20px; font-weight: 800; color: #1e3a8a;">${escapeHtml(cert.studentName)}</span>
                    </div>

                    <!-- Academic Details Grid -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 12px;">
                            <span style="font-size: 8.5px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">Roll Number</span>
                            <span style="font-size: 12.5px; font-weight: 700; font-family: monospace; color: #0f172a;">${escapeHtml(cert.rollNumber)}</span>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 12px;">
                            <span style="font-size: 8.5px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">Course</span>
                            <span style="font-size: 12.5px; font-weight: 700; color: #0f172a;">${escapeHtml(cert.course)}</span>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 12px;">
                            <span style="font-size: 8.5px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">Certificate ID</span>
                            <span style="font-size: 12.5px; font-weight: 700; font-family: monospace; color: #2563eb;">${escapeHtml(cert.certificateId)}</span>
                        </div>
                        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 9px 12px;">
                            <span style="font-size: 8.5px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">Issue Date</span>
                            <span style="font-size: 12.5px; font-weight: 700; color: #0f172a;">${formattedIssueDate}</span>
                        </div>
                        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 8px; padding: 9px 12px; grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center;">
                            <span style="font-size: 8.5px; font-weight: 700; color: #64748b; text-transform: uppercase;">Field of Certification / Credential Type</span>
                            <span style="font-size: 12px; font-weight: 700; color: #6d28d9; background: #f5f3ff; border: 1px solid #ddd6fe; padding: 2px 10px; border-radius: 12px;">🏅 ${escapeHtml(certType)}</span>
                        </div>
                    </div>

                    ${blockchainSection}

                    <!-- Official Verification Footer -->
                    <div style="border-top: 1px solid #e2e8f0; padding-top: 10px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <div style="font-size: 9.5px; color: #64748b; max-width: 440px; line-height: 1.4;">
                            🛡️ Authenticated and verified against permanent university records. Confirms academic completion in good standing.
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 8.5px; color: #059669; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; display: block;">Official Registry Record</span>
                            <span style="font-size: 8px; color: #94a3b8; font-family: monospace;">Verified System Copy</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // -------------------------------------------------------------------------
    // DOWNLOAD CERTIFICATE IN PDF FORMAT (A4 FORMAT WITH PROPER MARGINS)
    // -------------------------------------------------------------------------
    async function downloadCertificatePdf() {
        if (!currentCertificateData) return;

        const origBtnText = downloadPdfBtn ? downloadPdfBtn.innerHTML : "";
        if (downloadPdfBtn) {
            downloadPdfBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Preparing PDF...</span>';
            downloadPdfBtn.disabled = true;
        }

        try {
            const rawId = currentCertificateData.certificateId || "Verified";
            const safeCertId = String(rawId).replace(/[^a-zA-Z0-9_-]/g, "_");
            const fileName = `Certificate_${safeCertId}.pdf`;

            // Generate clean, self-contained A4 certificate markup
            const pdfHtml = generatePdfCertificateHtml(currentCertificateData, currentBlockchainData, isAdminMode);

            if (typeof html2pdf !== "undefined") {
                // PDF options with generous 15mm margins on all sides (not edge-to-edge)
                const opt = {
                    margin: [15, 15, 15, 15],
                    filename: fileName,
                    image: { type: "jpeg", quality: 0.98 },
                    html2canvas: {
                        scale: 2,
                        useCORS: true,
                        logging: false,
                        scrollY: 0,
                        scrollX: 0
                    },
                    jsPDF: {
                        unit: "mm",
                        format: "a4",
                        orientation: "portrait"
                    }
                };

                await html2pdf().set(opt).from(pdfHtml).save();
            } else {
                // Fallback to native print dialog
                window.print();
            }
        } catch (pdfErr) {
            console.error("PDF generation failed:", pdfErr);
            window.print();
        } finally {
            if (downloadPdfBtn) {
                downloadPdfBtn.innerHTML = origBtnText;
                downloadPdfBtn.disabled = false;
            }
        }
    }

    // -------------------------------------------------------------------------
    // PRINT CERTIFICATE (STRICT A4 FORMAT ONLY - 1 PAGE)
    // -------------------------------------------------------------------------
    function printCertificateA4() {
        window.print();
    }

    if (downloadPdfBtn) downloadPdfBtn.addEventListener("click", downloadCertificatePdf);
    if (printCertBtn) printCertBtn.addEventListener("click", printCertificateA4);



    if (verifyAnotherBtn) {
        verifyAnotherBtn.addEventListener("click", function () {
            hideVerificationResult();
            hideInlineAlert();
            if (userNameInput) {
                userNameInput.value = "";
            }
            if (certificateIdInput) {
                certificateIdInput.value = "";
            }
            if (clearNameBtn) clearNameBtn.style.display = "none";
            if (clearInputBtn) clearInputBtn.style.display = "none";
            if (userNameInput) userNameInput.focus();
            if (verifyForm) {
                verifyForm.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        });
    }

    // -------------------------------------------------------------------------
    // UI LOADING STATE MANAGEMENT
    // -------------------------------------------------------------------------
    function setLoading(isLoading) {
        isSubmitting = isLoading;

        if (verifyBtn) {
            verifyBtn.disabled = isLoading;
            if (isLoading) {
                verifyBtn.classList.add("loading");
                if (verifyBtnIcon) verifyBtnIcon.className = "fa-solid fa-circle-notch fa-spin";
                if (verifyBtnText) verifyBtnText.textContent = "Verifying...";
            } else {
                verifyBtn.classList.remove("loading");
                if (verifyBtnIcon) verifyBtnIcon.className = "fa-solid fa-magnifying-glass";
                if (verifyBtnText) verifyBtnText.textContent = "Verify Certificate";
            }
        }

        if (userNameInput) userNameInput.disabled = isLoading;
        if (certificateIdInput) certificateIdInput.disabled = isLoading;
        if (clearNameBtn) clearNameBtn.disabled = isLoading;
        if (clearInputBtn) clearInputBtn.disabled = isLoading;
        if (verifyAdminToggleBtn) verifyAdminToggleBtn.disabled = isLoading;
    }

    // -------------------------------------------------------------------------
    // QUICK FILL HELPER FOR SAMPLE ID CHIPS
    // -------------------------------------------------------------------------
    window.fillVerifyInput = function (certId, studentName) {
        if (certificateIdInput) {
            certificateIdInput.value = certId;
            if (clearInputBtn) clearInputBtn.style.display = "flex";
        }
        if (userNameInput && studentName) {
            userNameInput.value = studentName;
            if (clearNameBtn) clearNameBtn.style.display = "flex";
        }
        hideInlineAlert();
        hideVerificationResult();
    };

    // -------------------------------------------------------------------------
    // MAIN VERIFICATION HANDLER
    // Requires BOTH User Name and Certificate ID. If either fails -> NO certificate.
    // -------------------------------------------------------------------------
    async function handleVerification(userNameVal, certIdVal) {
        if (isSubmitting) return;

        hideInlineAlert();
        hideVerificationResult();

        const trimmedName = (userNameVal || "").trim();
        const trimmedId = (certIdVal || "").trim();

        // 1. Check for missing inputs
        if (!trimmedName && !trimmedId) {
            if (verifyNameInputGroup) verifyNameInputGroup.classList.add("input-error");
            if (verifyInputGroup) verifyInputGroup.classList.add("input-error");
            showInlineAlert(
                "warning",
                "Credentials Required",
                "Please enter both Your Name and Your Certificate ID to verify."
            );
            if (userNameInput) userNameInput.focus();
            return;
        }

        if (!trimmedName) {
            if (verifyNameInputGroup) verifyNameInputGroup.classList.add("input-error");
            showInlineAlert(
                "warning",
                "Name Required",
                "Please enter Your Name to complete verification."
            );
            if (userNameInput) userNameInput.focus();
            return;
        }

        if (!trimmedId) {
            if (verifyInputGroup) verifyInputGroup.classList.add("input-error");
            showInlineAlert(
                "warning",
                "Certificate ID Required",
                "Please enter Your Certificate ID to complete verification."
            );
            if (certificateIdInput) certificateIdInput.focus();
            return;
        }

        setLoading(true);

        try {
            // Build API endpoint with query param
            const endpoint = `${API_BASE}${encodeURIComponent(trimmedId)}?name=${encodeURIComponent(trimmedName)}`;

            let response;
            try {
                response = await fetch(endpoint, {
                    method: "GET",
                    headers: { "Accept": "application/json" }
                });
            } catch (networkErr) {
                // Local fallback check if applicable
                if (window.location.origin && (window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1"))) {
                    try {
                        response = await fetch(`/api/certificate/${encodeURIComponent(trimmedId)}?name=${encodeURIComponent(trimmedName)}`, {
                            method: "GET",
                            headers: { "Accept": "application/json" }
                        });
                    } catch (fallbackErr) {
                        throw networkErr;
                    }
                } else {
                    throw networkErr;
                }
            }

            let result = null;
            try {
                result = await response.json();
            } catch (parseError) {
                result = null;
            }

            // A. CHECK FOR HISTORICAL LOCAL PROOF ONLY (HOSTED ENVIRONMENT CHECK)
            if (result && result.localProofOnly && result.certificate) {
                showInlineAlert(
                    "warning",
                    "Historical Local Proof",
                    result.message || "This certificate was registered on a local Ganache development blockchain. Live on-chain verification is unavailable from this hosted environment."
                );
                renderVerifiedResult(result.certificate, result.blockchain);
                return;
            }

            // B. NOT VERIFIED / NOT FOUND
            if (!response.ok || !result || result.verified !== true || !result.certificate) {
                const message = "Certificate could not be verified.";
                const subtext = (result && result.message) ? result.message : "Please check both Your Name and Your Certificate ID and try again.";

                openInvalidModal(message, subtext);
                if (verifyInputGroup) verifyInputGroup.classList.add("input-error");
                if (verifyNameInputGroup) verifyNameInputGroup.classList.add("input-error");
                showInlineAlert("danger", message, subtext);
                return;
            }

            // B. STRICT CLIENT-SIDE NAME AND ID MATCH VERIFICATION
            const normalize = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
            const inputNameNorm = normalize(trimmedName);
            const certNameNorm = normalize(result.certificate.studentName);

            if (inputNameNorm !== certNameNorm) {
                const message = "Certificate could not be verified.";
                const subtext = "The provided User Name does not match our institutional record for this Certificate ID. Both must match.";

                openInvalidModal(message, subtext);
                if (verifyNameInputGroup) verifyNameInputGroup.classList.add("input-error");
                showInlineAlert("danger", message, subtext);
                return;
            }

            // C. BOTH MATCHED SUCCESSFULLY
            closeInvalidModal();
            hideInlineAlert();

            // Render verified certificate
            renderVerifiedResult(result.certificate, result.blockchain);

        } catch (error) {
            console.error("Verification error:", error);

            const friendlyTitle = "Certificate could not be verified.";
            const friendlyMsg = "Unable to reach verification service. Please check your network connection and try again.";

            openInvalidModal(friendlyTitle, friendlyMsg);
            if (verifyInputGroup) verifyInputGroup.classList.add("input-error");
            showInlineAlert("danger", friendlyTitle, friendlyMsg);

        } finally {
            setLoading(false);
        }
    }

    // -------------------------------------------------------------------------
    // ATTACH COPY EVENT LISTENERS
    // -------------------------------------------------------------------------
    if (copyTxHashBtn) {
        copyTxHashBtn.addEventListener("click", function (e) {
            e.stopPropagation();
            const val = proofTxHash ? proofTxHash.textContent.trim() : "";
            copyToClipboard(val, true, copyTxHashBtn);
        });
    }

    if (proofTxHashClickable) {
        proofTxHashClickable.addEventListener("click", function () {
            const val = proofTxHash ? proofTxHash.textContent.trim() : "";
            copyToClipboard(val, true, copyTxHashBtn);
        });

        proofTxHashClickable.addEventListener("keydown", function (e) {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                const val = proofTxHash ? proofTxHash.textContent.trim() : "";
                copyToClipboard(val, true, copyTxHashBtn);
            }
        });
    }

    if (copyIssuerBtn) {
        copyIssuerBtn.addEventListener("click", function () {
            const val = proofIssuer ? proofIssuer.textContent.trim() : "";
            copyToClipboard(val, false, copyIssuerBtn);
        });
    }

    if (copyContractBtn) {
        copyContractBtn.addEventListener("click", function () {
            const val = proofContract ? proofContract.textContent.trim() : "";
            copyToClipboard(val, false, copyContractBtn);
        });
    }

    if (copyCertHashBtn) {
        copyCertHashBtn.addEventListener("click", function () {
            const val = proofCertHash ? proofCertHash.textContent.trim() : "";
            copyToClipboard(val, false, copyCertHashBtn);
        });
    }

    // -------------------------------------------------------------------------
    // FORM SUBMISSION EVENT
    // -------------------------------------------------------------------------
    if (verifyForm) {
        verifyForm.addEventListener("submit", function (e) {
            e.preventDefault();
            const nameVal = userNameInput ? userNameInput.value : "";
            const certIdVal = certificateIdInput ? certificateIdInput.value : "";
            handleVerification(nameVal, certIdVal);
        });
    }

    // -------------------------------------------------------------------------
    // URL QUERY PARAMETER AUTO-VERIFICATION
    // -------------------------------------------------------------------------
    document.addEventListener("DOMContentLoaded", function () {
        updateAdminModeUI();

        const urlParams = new URLSearchParams(window.location.search);
        const queryId = urlParams.get("id");
        const queryName = urlParams.get("name") || urlParams.get("studentName");
        const queryAdmin = urlParams.get("admin");

        if (queryAdmin === "true" || queryAdmin === "1") {
            isAdminMode = true;
            updateAdminModeUI();
        }

        if (queryId && certificateIdInput) {
            certificateIdInput.value = queryId.trim();
            if (clearInputBtn) clearInputBtn.style.display = "flex";
        }

        if (queryName && userNameInput) {
            userNameInput.value = queryName.trim();
            if (clearNameBtn) clearNameBtn.style.display = "flex";
        }

        if (queryId && queryName) {
            handleVerification(queryName.trim(), queryId.trim());
        } else if (queryId && userNameInput) {
            userNameInput.focus();
        }
    });

})();