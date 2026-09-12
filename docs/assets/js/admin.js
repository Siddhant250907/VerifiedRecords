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
    const confirmTxItem = document.getElementById("confirmTxItem");
    const confirmTxHash = document.getElementById("confirmTxHash");
    const adminWalletBadge = document.getElementById("adminWalletBadge");
    const adminWalletAccount = document.getElementById("adminWalletAccount");
    const verifyLink = document.getElementById("verifyLink");
    const issueAnotherButton = document.getElementById("issueAnotherButton");

    let isProcessing = false;
    let connectedMetaMaskAccount = null;

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

        // Initialize MetaMask detection
        checkMetaMaskWallet();
    });

    // ----------------------------------------------------------------------
    // 2B. METAMASK STATUS CHECK & LISTENERS
    // ----------------------------------------------------------------------
    async function checkMetaMaskWallet() {
        if (typeof window.ethereum === "undefined") {
            if (adminWalletBadge && adminWalletAccount) {
                adminWalletBadge.style.display = "inline-flex";
                adminWalletAccount.textContent = "Unavailable (Using Node)";
            }
            return;
        }

        try {
            const accounts = await window.ethereum.request({ method: "eth_accounts" });
            if (accounts && accounts.length > 0) {
                connectedMetaMaskAccount = accounts[0];
                updateWalletBadge(accounts[0]);
            } else {
                if (adminWalletBadge && adminWalletAccount) {
                    adminWalletBadge.style.display = "inline-flex";
                    adminWalletAccount.textContent = "Ready to Connect";
                }
            }

            // Listeners for account or network switch
            window.ethereum.on("accountsChanged", function (newAccounts) {
                if (newAccounts && newAccounts.length > 0) {
                    connectedMetaMaskAccount = newAccounts[0];
                    updateWalletBadge(newAccounts[0]);
                } else {
                    connectedMetaMaskAccount = null;
                    if (adminWalletAccount) adminWalletAccount.textContent = "Disconnected";
                }
            });

            window.ethereum.on("chainChanged", function () {
                window.location.reload();
            });

        } catch (err) {
            console.warn("MetaMask detection error:", err);
        }
    }

    function updateWalletBadge(account) {
        if (adminWalletBadge && adminWalletAccount && account) {
            const shortAddr = account.slice(0, 6) + "..." + account.slice(-4);
            adminWalletAccount.textContent = shortAddr;
            adminWalletAccount.title = account;
            adminWalletBadge.style.display = "inline-flex";
        }
    }

    function isGanacheChain(chainId) {
        if (!chainId) return false;
        const dec = parseInt(chainId, 16);
        return dec === 1337 || dec === 5777;
    }

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
    function setLoading(loading, statusText) {
        isProcessing = loading;

        if (issueButton) {
            issueButton.disabled = loading;
            if (loading) {
                if (issueBtnIcon) issueBtnIcon.className = "fa-solid fa-circle-notch fa-spin";
                if (issueBtnText) issueBtnText.textContent = statusText || "Registering on Blockchain...";
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
    // 5. ISSUE CERTIFICATE (BLOCKCHAIN-BACKED ISSUANCE FLOW)
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

        // 1. Field Validation
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

        const payload = {
            studentName: studentName,
            rollNumber: rollNumber,
            course: course,
            certificateId: certificateId,
            issueDate: issueDate
        };

        console.log("[1] Admin submit triggered with data:", payload);

        const primaryEndpoint = "/api/certificate";
        const prepareEndpoint = "/api/certificate/prepare";

        try {
            // 2. Step 1: Pre-validation & Hash Preparation
            setLoading(true, "Validating & preparing blockchain proof...");

            const prepResponse = await fetch(prepareEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const prepData = await prepResponse.json().catch(() => ({}));

            if (!prepResponse.ok) {
                let errMsg = prepData.message || "Failed to validate certificate parameters.";
                if (prepResponse.status === 409) {
                    if (groupCertificateId) groupCertificateId.classList.add("input-error");
                    if (certificateIdInput) certificateIdInput.focus();
                }
                console.warn("[Admin Pre-check Failed]", prepResponse.status, errMsg);
                showMessage(errMsg, "danger");
                setLoading(false);
                return;
            }

            console.log("[3] Hash generated & received from server:", prepData.certificateHash);

            // 3. Step 2: Blockchain Transaction via MetaMask
            let txHash = null;
            let signingIssuer = null;

            if (typeof window.ethereum === "undefined") {
                console.error("MetaMask not detected in browser window.ethereum.");
                showMessage("MetaMask extension not detected. MetaMask is required to sign certificate issuance on-chain. Please install or enable MetaMask.", "danger");
                setLoading(false);
                return;
            }

            // Prompt user to connect account in MetaMask
            setLoading(true, "Connecting to MetaMask...");
            let accounts;
            try {
                accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
            } catch (accErr) {
                console.warn("MetaMask connection request rejected:", accErr);
                showMessage("MetaMask connection was cancelled. Certificate was not issued.", "warning");
                setLoading(false);
                return;
            }

            if (!accounts || accounts.length === 0) {
                showMessage("No authorized Ethereum account selected in MetaMask.", "warning");
                setLoading(false);
                return;
            }

            signingIssuer = accounts[0];
            updateWalletBadge(accounts[0]);

            // Ensure connected to Ganache Local network
            const currentChainId = await window.ethereum.request({ method: "eth_chainId" }).catch(() => null);
            if (currentChainId && !isGanacheChain(currentChainId)) {
                try {
                    // Attempt to programmatically switch MetaMask network to Ganache
                    await window.ethereum.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: "0x539" }] // 1337 in hex
                    });
                } catch (switchErr) {
                    console.warn("Failed to switch network in MetaMask:", switchErr);
                    showMessage("Please switch your MetaMask network to 'Ganache Local' (RPC: http://127.0.0.1:7545, Chain ID: 1337).", "warning");
                    setLoading(false);
                    return;
                }
            }

            // Prompt signature / transaction via MetaMask
            console.log("[4] Blockchain transaction starting via MetaMask from:", signingIssuer);
            setLoading(true, "Please sign transaction in MetaMask...");

            let rawTxHash = null;
            try {
                rawTxHash = await window.ethereum.request({
                    method: "eth_sendTransaction",
                    params: [{
                        from: signingIssuer,
                        to: prepData.contractAddress,
                        data: prepData.txData
                    }]
                });
                console.log("[5] Blockchain transaction submitted. Hash:", rawTxHash);
            } catch (txErr) {
                console.warn("MetaMask transaction error:", txErr);
                const isRejection = txErr.code === 4001 || (txErr.message && txErr.message.includes("rejected"));
                const msg = isRejection ?
                    "Transaction rejected in MetaMask. The certificate was not issued." :
                    (txErr.message || "Blockchain transaction failed.");
                showMessage(msg, "danger");
                setLoading(false);
                return;
            }

            // Step 2B: Await and capture transaction receipt from blockchain
            setLoading(true, "Confirming transaction on blockchain & capturing receipt...");
            let receipt = null;
            const maxPollingAttempts = 40;

            for (let attempt = 0; attempt < maxPollingAttempts; attempt++) {
                try {
                    receipt = await window.ethereum.request({
                        method: "eth_getTransactionReceipt",
                        params: [rawTxHash]
                    });
                    if (receipt && receipt.blockNumber) {
                        break;
                    }
                } catch (receiptErr) {
                    console.warn(`[MetaMask] Receipt polling attempt ${attempt + 1}:`, receiptErr);
                }
                await new Promise((resolve) => setTimeout(resolve, 500));
            }

            if (!receipt) {
                console.error("Failed to retrieve transaction receipt within timeout for tx:", rawTxHash);
                showMessage("Transaction was broadcast but confirmation receipt timed out. Please check Ganache.", "danger");
                setLoading(false);
                return;
            }

            // Verify status on the receipt (0x1 in hex or 1 in dec)
            const statusNum = typeof receipt.status === "string" ? parseInt(receipt.status, 16) : Number(receipt.status);
            if (statusNum !== 1) {
                console.error("Transaction reverted on-chain according to receipt:", receipt);
                showMessage("Blockchain transaction reverted on the smart contract.", "danger");
                setLoading(false);
                return;
            }

            // Capture transaction hash directly from the confirmed blockchain receipt
            const confirmedTxHash = receipt.transactionHash || rawTxHash;
            console.log("[6] Confirmed blockchain receipt captured successfully:", receipt);
            console.log("[6b] Final confirmed transaction hash from receipt:", confirmedTxHash);

            // 4. Step 3: Record on Backend & MongoDB
            setLoading(true, "Recording in institutional repository...");

            const finalPayload = {
                ...payload,
                transactionHash: confirmedTxHash,
                blockchainIssuer: signingIssuer
            };

            const response = await fetch(primaryEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(finalPayload)
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                let errMsg = data.message || "Failed to record certificate in repository.";
                showMessage(errMsg, "danger");
                return;
            }

            // ==============================================================
            // 5. SUCCESSFUL ISSUANCE
            // ==============================================================
            const issuedCert = data.certificate || payload;
            const blockchainMeta = data.blockchain || {};

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

            if (confirmStudentName) confirmStudentName.textContent = issuedCert.studentName || studentName;
            if (confirmRollNumber) confirmRollNumber.textContent = issuedCert.rollNumber || rollNumber;
            if (confirmCertId) confirmCertId.textContent = issuedCert.certificateId || certificateId;
            if (confirmCourse) confirmCourse.textContent = issuedCert.course || course;
            if (confirmIssueDate) confirmIssueDate.textContent = displayDate;

            // Display blockchain transaction hash
            const finalTxHash = blockchainMeta.transactionHash || issuedCert.transactionHash;
            if (confirmTxItem && confirmTxHash && finalTxHash) {
                confirmTxHash.textContent = finalTxHash;
                confirmTxItem.style.display = "flex";
            } else if (confirmTxItem) {
                confirmTxItem.style.display = "none";
            }

            if (verifyLink) {
                const targetId = issuedCert.certificateId || certificateId;
                verifyLink.href = `verify.html?id=${encodeURIComponent(targetId)}`;
            }

            if (issuanceSuccessCard) {
                issuanceSuccessCard.style.display = "block";
                issuanceSuccessCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }

            showMessage("Certificate successfully registered on the blockchain and recorded in the institutional repository!", "success");

            // Reset form fields
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
            showMessage("Unable to complete issuance. Please verify your connection to Ganache and the server.", "danger");
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
            console.log("[Admin] submit triggered");
            issueCertificate();
        });
        console.log("[Admin] submit handler attached");
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

    console.log("[Admin] script loaded");

})();