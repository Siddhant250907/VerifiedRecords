/**
 * VerifiedRecords — Certificate Verification Controller
 * 
 * Flow:
 * 1. User inputs Certificate ID (or arrives via ?id= query param).
 * 2. Client performs input validation (empty check).
 * 3. Frontend locks UI, displays subtle loading indicator, and calls the existing backend API:
 *    GET https://verifiedrecords.onrender.com/api/certificate/:certificateId
 * 4. On Valid / Verified (200 & verified: true):
 *    - Renders official credential record card directly on the page.
 *    - Clears errors and ensures no popups are shown.
 * 5. On Invalid / Not Verified (404 / verified: false):
 *    - Displays clear inline error alert on the page.
 *    - Displays ONE clean, accessible, mobile-friendly popup modal.
 *    - Does NOT show certificate details in the popup.
 * 6. On Network / Server Error:
 *    - Provides human-friendly explanations without exposing raw code.
 */

(function () {
    "use strict";

    // -------------------------------------------------------------------------
    // BACKEND API ENDPOINT (DEFAULT TO RELATIVE FOR SAME-ORIGIN / LOCALHOST)
    // -------------------------------------------------------------------------
    const API_BASE = "/api/certificate/";

    // -------------------------------------------------------------------------
    // DOM ELEMENTS
    // -------------------------------------------------------------------------
    const verifyForm = document.getElementById("verifyForm");
    const certificateIdInput = document.getElementById("certificateId");
    const verifyInputGroup = document.getElementById("verifyInputGroup");
    const clearInputBtn = document.getElementById("clearInputBtn");
    const verifyBtn = document.getElementById("verifyBtn");
    const verifyBtnIcon = document.getElementById("verifyBtnIcon");
    const verifyBtnText = document.getElementById("verifyBtnText");

    const inlineAlert = document.getElementById("inlineAlert");
    const inlineAlertIcon = document.getElementById("inlineAlertIcon");
    const inlineAlertTitle = document.getElementById("inlineAlertTitle");
    const inlineAlertMessage = document.getElementById("inlineAlertMessage");

    const verificationResult = document.getElementById("verificationResult");
    const credentialDetailsGrid = document.getElementById("credentialDetailsGrid");
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

    let isSubmitting = false;

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

        // Dedicated feedback for transaction button
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

        // Focus dismiss button for quick keyboard navigation
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
        } else if (certificateIdInput) {
            certificateIdInput.focus();
        }
    }

    // Modal event listeners
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
    // INPUT INTERACTIONS & CLEAR BUTTON
    // -------------------------------------------------------------------------
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
    // RESULT SECTION RENDERING (ON-PAGE ONLY)
    // -------------------------------------------------------------------------
    function renderVerifiedResult(cert, blockchain) {
        if (!verificationResult || !credentialDetailsGrid) return;

        // Escape HTML to prevent injection
        const escapeHtml = (str) => {
            if (!str) return "";
            return String(str)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        };

        // Format issue date nicely if standard ISO / date string
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

        // Format system registration timestamp if present
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

        // Build HTML for actual returned fields
        let fieldsHtml = "";

        // 1. Student Name (Featured Full-Width Field)
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

        // 4. Certificate ID
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

        // 5. Issue Date
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

        // 6. Registry Registration Date (if present)
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
        // POPULATE ON-CHAIN BLOCKCHAIN PROOF PANEL
        // ---------------------------------------------------------------------
        const issuerVal = (blockchain && blockchain.issuer) || cert.blockchainIssuer || "—";
        const contractVal = (blockchain && blockchain.contractAddress) || cert.contractAddress || "—";
        const certHashVal = (blockchain && (blockchain.certificateHash || blockchain.computedHash)) || cert.certificateHash || "—";
        // Original Issuance Transaction Hash from MongoDB
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

        if (proofTxHash) {
            proofTxHash.textContent = origTxHashVal || "Not Recorded";
            proofTxHash.title = origTxHashVal ? "Issuance Transaction: " + origTxHashVal : "";
        }

        // Format Blockchain Timestamp
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

        // Display blockchain proof panel
        if (blockchainProofPanel) {
            blockchainProofPanel.style.display = "block";
        }

        // Reveal the section smoothly
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
    }

    // -------------------------------------------------------------------------
    // ACTION BUTTONS (Print & Verify Another)
    // -------------------------------------------------------------------------
    if (printCertBtn) {
        printCertBtn.addEventListener("click", function () {
            window.print();
        });
    }

    if (verifyAnotherBtn) {
        verifyAnotherBtn.addEventListener("click", function () {
            hideVerificationResult();
            hideInlineAlert();
            if (certificateIdInput) {
                certificateIdInput.value = "";
                certificateIdInput.focus();
            }
            if (clearInputBtn) {
                clearInputBtn.style.display = "none";
            }
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

        if (certificateIdInput) {
            certificateIdInput.disabled = isLoading;
        }

        if (clearInputBtn) {
            clearInputBtn.disabled = isLoading;
        }
    }

    // Expose quick fill helper for sample ID chips
    window.fillVerifyInput = function (certId) {
        if (!certificateIdInput) return;
        certificateIdInput.value = certId;
        certificateIdInput.focus();
        if (clearInputBtn) {
            clearInputBtn.style.display = "flex";
        }
        hideInlineAlert();
        hideVerificationResult();
    };

    // -------------------------------------------------------------------------
    // MAIN VERIFICATION HANDLER
    // -------------------------------------------------------------------------
    async function handleVerification(certificateId) {
        if (isSubmitting) return;

        // Reset previous views
        hideInlineAlert();
        hideVerificationResult();

        const trimmedId = (certificateId || "").trim();

        // 1. Client-side empty validation
        if (!trimmedId) {
            if (verifyInputGroup) verifyInputGroup.classList.add("input-error");
            showInlineAlert(
                "warning",
                "Certificate ID Required",
                "Please enter a Certificate ID to verify."
            );
            if (certificateIdInput) certificateIdInput.focus();
            return;
        }

        setLoading(true);

        try {
            // Build the exact API endpoint:
            // https://verifiedrecords.onrender.com/api/certificate/:certificateId
            const endpoint = `${API_BASE}${encodeURIComponent(trimmedId)}`;

            let response;
            try {
                response = await fetch(endpoint, {
                    method: "GET",
                    headers: {
                        "Accept": "application/json"
                    }
                });
            } catch (networkErr) {
                // If remote Render fails (e.g. offline or DNS), check if hosted locally
                if (window.location.origin && (window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1"))) {
                    try {
                        response = await fetch(`/api/certificate/${encodeURIComponent(trimmedId)}`, {
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

            // -----------------------------------------------------------------
            // RESPONSE EVALUATION
            // -----------------------------------------------------------------
            let result = null;
            try {
                result = await response.json();
            } catch (parseError) {
                result = null;
            }

            // A. NOT VERIFIED / NOT FOUND (404 or verified === false)
            if (!response.ok || !result || result.verified !== true) {
                const message = "Certificate could not be verified.";
                const subtext = "Please check the Certificate ID and try again.";

                // 1. Show ONE clean, non-alarming popup/modal
                openInvalidModal(message, subtext);

                // 2. ALSO show a short inline message on the verification page
                if (verifyInputGroup) verifyInputGroup.classList.add("input-error");
                showInlineAlert("danger", message, subtext);

                return;
            }

            // B. VALID / VERIFIED (200 & verified: true)
            if (result.verified && result.certificate) {
                // Do NOT use a popup for certificate details.
                // Close modal if open, clear inline alerts
                closeInvalidModal();
                hideInlineAlert();

                // Render verified certificate directly on page with blockchain proof
                renderVerifiedResult(result.certificate, result.blockchain);
            } else {
                // Fallback for unexpected valid HTTP with missing certificate body
                const message = "Certificate could not be verified.";
                const subtext = "Please check the Certificate ID and try again.";
                openInvalidModal(message, subtext);
                showInlineAlert("danger", message, subtext);
            }

        } catch (error) {
            console.error("Verification error:", error);

            const friendlyTitle = "Certificate could not be verified.";
            const friendlyMsg = "Please check your network connection and try again.";

            // 1. Show modal
            openInvalidModal(friendlyTitle, friendlyMsg);

            // 2. Show inline alert
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
            const certId = certificateIdInput ? certificateIdInput.value : "";
            handleVerification(certId);
        });
    }

    // -------------------------------------------------------------------------
    // URL QUERY PARAMETER AUTO-VERIFICATION
    // (e.g. from index.html quick-verify form: verify.html?id=CERT_CSE001)
    // -------------------------------------------------------------------------
    document.addEventListener("DOMContentLoaded", function () {
        const urlParams = new URLSearchParams(window.location.search);
        const queryId = urlParams.get("id");

        if (queryId && certificateIdInput) {
            certificateIdInput.value = queryId.trim();
            if (clearInputBtn) {
                clearInputBtn.style.display = "flex";
            }
            // Automatically execute verification
            handleVerification(queryId.trim());
        }
    });

})();