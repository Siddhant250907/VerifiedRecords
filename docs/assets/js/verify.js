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
    // EXISTING BACKEND API ENDPOINT (PRESERVED)
    // -------------------------------------------------------------------------
    const API_BASE = "https://verifiedrecords.onrender.com/api/certificate/";

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

    const invalidModal = document.getElementById("invalidModal");
    const modalTitle = document.getElementById("modalTitle");
    const modalDesc = document.getElementById("modalDesc");
    const modalCloseBtn = document.getElementById("modalCloseBtn");
    const modalDismissBtn = document.getElementById("modalDismissBtn");

    let isSubmitting = false;

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
    function renderVerifiedResult(cert) {
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

                // Render verified certificate directly on page
                renderVerifiedResult(result.certificate);
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