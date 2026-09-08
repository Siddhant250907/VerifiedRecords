// ==========================================================================
// VERIFIEDRECORDS — ADMIN DASHBOARD CONTROLLER
// University Registrar Certificate Issuance Logic
// ==========================================================================

(function () {
    "use strict";

    // ----------------------------------------------------------------------
    // 1. DOM REFERENCES
    // ----------------------------------------------------------------------
    const certificateForm = document.getElementById("certificateForm");
    const studentNameInput = document.getElementById("studentName");
    const rollNumberInput = document.getElementById("rollNumber");
    const courseInput = document.getElementById("course");
    const certificateIdInput = document.getElementById("certificateId");
    const issueDateInput = document.getElementById("issueDate");

    const groupStudentName = document.getElementById("groupStudentName");
    const groupRollNumber = document.getElementById("groupRollNumber");
    const groupCourse = document.getElementById("groupCourse");
    const groupCertificateId = document.getElementById("groupCertificateId");
    const groupIssueDate = document.getElementById("groupIssueDate");

    const issueButton = document.getElementById("issueButton");
    const issueBtnIcon = document.getElementById("issueBtnIcon");
    const issueBtnText = document.getElementById("issueBtnText");
    const resetButton = document.getElementById("resetButton");
    const messageElement = document.getElementById("message");

    const issuanceSuccessCard = document.getElementById("issuanceSuccessCard");
    const confirmStudentName = document.getElementById("confirmStudentName");
    const confirmRollNumber = document.getElementById("confirmRollNumber");
    const confirmCertId = document.getElementById("confirmCertId");
    const confirmCourse = document.getElementById("confirmCourse");
    const confirmIssueDate = document.getElementById("confirmIssueDate");
    const verifyLink = document.getElementById("verifyLink");
    const issueAnotherButton = document.getElementById("issueAnotherButton");

    let isProcessing = false;

    // ----------------------------------------------------------------------
    // 2. AUTHENTICATED USER BADGE (PRESESRVED FOR AUTH.JS)
    // ----------------------------------------------------------------------
    document.addEventListener("DOMContentLoaded", function () {
        // Set default issue date to today's date
        if (issueDateInput && !issueDateInput.value) {
            const today = new Date().toISOString().split("T")[0];
            issueDateInput.value = today;
        }

        // Listen for Firebase auth state changes
        if (typeof auth !== "undefined") {
            auth.onAuthStateChanged(function (user) {
                const badge = document.getElementById("adminUserBadge");
                const emailEl = document.getElementById("userEmail");

                if (user && badge && emailEl) {
                    emailEl.textContent = user.email || "Registrar Officer";
                    badge.style.display = "inline-flex";
                }
            });
        }
    });

    // ----------------------------------------------------------------------
    // 3. MESSAGE & ALERT DISPLAY
    // ----------------------------------------------------------------------
    function showMessage(message, type) {
        if (!messageElement) return;

        // type can be: 'success', 'danger', or 'warning'
        const alertClass = type === true ? "success" : (type === false ? "danger" : type);
        messageElement.className = "admin-message " + alertClass;

        let iconClass = "fa-circle-exclamation";
        if (alertClass === "success") iconClass = "fa-circle-check";
        if (alertClass === "warning") iconClass = "fa-triangle-exclamation";

        messageElement.innerHTML = `
            <i class="fa-solid ${iconClass}" aria-hidden="true" style="margin-top: 2px; flex-shrink: 0;"></i>
            <div>${message}</div>
        `;
        messageElement.style.display = "flex";
    }

    function hideMessage() {
        if (!messageElement) return;
        messageElement.style.display = "none";
        messageElement.innerHTML = "";
    }

    function clearInputErrors() {
        [groupStudentName, groupRollNumber, groupCourse, groupCertificateId, groupIssueDate].forEach(group => {
            if (group) group.classList.remove("input-error");
        });
    }

    // Attach input listeners to clear errors on typing
    [studentNameInput, rollNumberInput, courseInput, certificateIdInput, issueDateInput].forEach(input => {
        if (input) {
            input.addEventListener("input", function () {
                const group = this.closest(".admin-input-group");
                if (group) group.classList.remove("input-error");
            });
        }
    });

    // ----------------------------------------------------------------------
    // 4. UI LOADING STATE CONTROLLER
    // ----------------------------------------------------------------------
    function setLoading(loading) {
        isProcessing = loading;

        if (issueButton) {
            issueButton.disabled = loading;
            if (loading) {
                if (issueBtnIcon) issueBtnIcon.className = "fa-solid fa-circle-notch fa-spin";
                if (issueBtnText) issueBtnText.textContent = "Registering in University Repository...";
            } else {
                if (issueBtnIcon) issueBtnIcon.className = "fa-solid fa-stamp";
                if (issueBtnText) issueBtnText.textContent = "Issue & Register Certificate";
            }
        }

        if (resetButton) {
            resetButton.disabled = loading;
        }

        [studentNameInput, rollNumberInput, courseInput, certificateIdInput, issueDateInput].forEach(input => {
            if (input) input.disabled = loading;
        });
    }

    // ----------------------------------------------------------------------
    // 5. ISSUE CERTIFICATE (PRESERVES EXISTING BACKEND INTEGRATION)
    // ----------------------------------------------------------------------
    async function issueCertificate() {
        if (isProcessing) return;

        clearInputErrors();
        hideMessage();

        const studentName = (studentNameInput ? studentNameInput.value : "").trim();
        const rollNumber = (rollNumberInput ? rollNumberInput.value : "").trim();
        const course = (courseInput ? courseInput.value : "").trim();
        const certificateId = (certificateIdInput ? certificateIdInput.value : "").trim();
        const issueDate = (issueDateInput ? issueDateInput.value : "").trim();

        // Field Validation
        let hasError = false;

        if (!studentName) {
            if (groupStudentName) groupStudentName.classList.add("input-error");
            hasError = true;
        }
        if (!rollNumber) {
            if (groupRollNumber) groupRollNumber.classList.add("input-error");
            hasError = true;
        }
        if (!course) {
            if (groupCourse) groupCourse.classList.add("input-error");
            hasError = true;
        }
        if (!certificateId) {
            if (groupCertificateId) groupCertificateId.classList.add("input-error");
            hasError = true;
        }
        if (!issueDate) {
            if (groupIssueDate) groupIssueDate.classList.add("input-error");
            hasError = true;
        }

        if (hasError) {
            showMessage("Please fill in all required certificate fields before submitting.", "warning");
            // Focus first empty field
            if (!studentName && studentNameInput) studentNameInput.focus();
            else if (!rollNumber && rollNumberInput) rollNumberInput.focus();
            else if (!course && courseInput) courseInput.focus();
            else if (!certificateId && certificateIdInput) certificateIdInput.focus();
            else if (!issueDate && issueDateInput) issueDateInput.focus();
            return;
        }

        // Hide success confirmation card while processing
        if (issuanceSuccessCard) {
            issuanceSuccessCard.style.display = "none";
        }

        setLoading(true);

        const payload = {
            studentName: studentName,
            rollNumber: rollNumber,
            course: course,
            certificateId: certificateId,
            issueDate: issueDate
        };

        // Determine primary and fallback endpoints
        // Primary: relative /api/certificate (when hosted on express)
        // Fallback / Remote: https://verifiedrecords.onrender.com/api/certificate
        const remoteEndpoint = "https://verifiedrecords.onrender.com/api/certificate";
        let primaryEndpoint = "/api/certificate";

        if (!window.location.origin || !window.location.origin.startsWith("http") || window.location.hostname.includes("github.io")) {
            primaryEndpoint = remoteEndpoint;
        }

        try {
            let response;
            try {
                response = await fetch(primaryEndpoint, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify(payload)
                });
            } catch (fetchErr) {
                // If relative request failed, try remote endpoint fallback
                if (primaryEndpoint !== remoteEndpoint) {
                    response = await fetch(remoteEndpoint, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        },
                        body: JSON.stringify(payload)
                    });
                } else {
                    throw fetchErr;
                }
            }

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                // Determine user-friendly error
                let errMsg = data.message || "Failed to register certificate.";
                if (response.status === 409) {
                    errMsg = `Certificate ID "${certificateId}" already exists in the registry. Please assign a unique identifier.`;
                    if (groupCertificateId) groupCertificateId.classList.add("input-error");
                    if (certificateIdInput) certificateIdInput.focus();
                } else if (response.status === 400) {
                    errMsg = "All certificate fields are required.";
                } else if (response.status >= 500) {
                    errMsg = "Registry server error occurred. Please try again shortly.";
                }

                showMessage(errMsg, "danger");
                return;
            }

            // ==============================================================
            // SUCCESSFUL ISSUANCE
            // ==============================================================
            const issuedCert = data.certificate || payload;

            // Format date for display
            let displayDate = issuedCert.issueDate;
            if (issuedCert.issueDate && !isNaN(Date.parse(issuedCert.issueDate))) {
                try {
                    displayDate = new Date(issuedCert.issueDate).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                    });
                } catch (e) {
                    displayDate = issuedCert.issueDate;
                }
            }

            // Populate confirmation card
            if (confirmStudentName) confirmStudentName.textContent = issuedCert.studentName || studentName;
            if (confirmRollNumber) confirmRollNumber.textContent = issuedCert.rollNumber || rollNumber;
            if (confirmCertId) confirmCertId.textContent = issuedCert.certificateId || certificateId;
            if (confirmCourse) confirmCourse.textContent = issuedCert.course || course;
            if (confirmIssueDate) confirmIssueDate.textContent = displayDate;

            // Update verify portal link
            if (verifyLink) {
                const targetId = issuedCert.certificateId || certificateId;
                verifyLink.href = `verify.html?id=${encodeURIComponent(targetId)}`;
            }

            // Reveal confirmation card
            if (issuanceSuccessCard) {
                issuanceSuccessCard.style.display = "block";
                issuanceSuccessCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }

            showMessage("Certificate issued and recorded successfully in the institutional repository!", "success");

            // Clear form inputs
            if (studentNameInput) studentNameInput.value = "";
            if (rollNumberInput) rollNumberInput.value = "";
            if (courseInput) courseInput.value = "";
            if (certificateIdInput) certificateIdInput.value = "";
            if (issueDateInput) {
                const today = new Date().toISOString().split("T")[0];
                issueDateInput.value = today;
            }

        } catch (error) {
            console.error("Certificate issuance error:", error);
            showMessage("Unable to connect to the registry backend. Please check your network connection.", "danger");
        } finally {
            setLoading(false);
        }
    }

    // Expose issueCertificate globally for backwards compatibility
    window.issueCertificate = issueCertificate;

    // ----------------------------------------------------------------------
    // 6. FORM & BUTTON LISTENERS
    // ----------------------------------------------------------------------
    if (certificateForm) {
        certificateForm.addEventListener("submit", function (e) {
            e.preventDefault();
            issueCertificate();
        });
    }

    if (resetButton) {
        resetButton.addEventListener("click", function () {
            clearInputErrors();
            hideMessage();
            if (issuanceSuccessCard) issuanceSuccessCard.style.display = "none";
            if (studentNameInput) studentNameInput.value = "";
            if (rollNumberInput) rollNumberInput.value = "";
            if (courseInput) courseInput.value = "";
            if (certificateIdInput) certificateIdInput.value = "";
            if (issueDateInput) {
                const today = new Date().toISOString().split("T")[0];
                issueDateInput.value = today;
            }
            if (studentNameInput) studentNameInput.focus();
        });
    }

    if (issueAnotherButton) {
        issueAnotherButton.addEventListener("click", function () {
            hideMessage();
            clearInputErrors();
            if (issuanceSuccessCard) issuanceSuccessCard.style.display = "none";
            if (certificateForm) {
                certificateForm.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            if (studentNameInput) studentNameInput.focus();
        });
    }

})();