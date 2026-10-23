// ============================================================================
// VERIFIEDRECORDS — SECURE DOCUMENT VAULT CONTROLLER
// Client-side AES-256-GCM Encryption, Cloudinary Upload & Zero-Knowledge Decryption
// ============================================================================

(function () {
    "use strict";

    // In-memory vault session variables (NEVER written to storage or cookies)
    let inMemoryVaultPassword = null;
    let cachedVaultDocuments = [];
    let cachedVaultDrafts = [];
    let activeCategory = "all";
    let isAutosaving = false;
    let autosaveTimer = null;
    let selectedUploadFile = null;
    let isUploading = false;
    let pendingCloudinaryUpload = null; // In-memory cache for retry safety against partial save failures
    let activeVaultId = "default";

    // DOM Elements
    const vaultAuthPrompt = document.getElementById("vaultAuthPrompt");
    const vaultFirstTimeCard = document.getElementById("vaultFirstTimeCard");
    const vaultFirstTimeForm = document.getElementById("vaultFirstTimeForm");
    const firstTimeVaultNameInput = document.getElementById("firstTimeVaultNameInput");
    const firstTimeVaultPasswordInput = document.getElementById("firstTimeVaultPasswordInput");
    const toggleFirstTimePwdBtn = document.getElementById("toggleFirstTimePwdBtn");
    const vaultLockedCard = document.getElementById("vaultLockedCard");
    const vaultUnlockedView = document.getElementById("vaultUnlockedView");
    const vaultUnlockForm = document.getElementById("vaultUnlockForm");
    const vaultPasswordInput = document.getElementById("vaultPasswordInput");
    const toggleVaultPasswordBtn = document.getElementById("toggleVaultPasswordBtn");
    const lockVaultBtn = document.getElementById("lockVaultBtn");
    const vaultAlert = document.getElementById("vaultAlert");

    // Multi-Vault Switcher Elements
    const vaultSelectDropdown = document.getElementById("vaultSelectDropdown");
    const btnOpenCreateVaultModal = document.getElementById("btnOpenCreateVaultModal");
    const createVaultModal = document.getElementById("createVaultModal");
    const closeCreateVaultModalBtn = document.getElementById("closeCreateVaultModalBtn");
    const createVaultForm = document.getElementById("createVaultForm");
    const newVaultNameInput = document.getElementById("newVaultNameInput");

    // Action bar & Grid
    const vaultSearchInput = document.getElementById("vaultSearchInput");
    const openUploadModalBtn = document.getElementById("openUploadModalBtn");
    const openDraftModalBtn = document.getElementById("openDraftModalBtn");
    const vaultDocumentsGrid = document.getElementById("vaultDocumentsGrid");
    const vaultEmptyState = document.getElementById("vaultEmptyState");
    const vaultDraftsContainer = document.getElementById("vaultDraftsContainer");
    const vaultDraftsGrid = document.getElementById("vaultDraftsGrid");

    // Category Tabs
    const categoryPills = document.querySelectorAll(".vault-category-pill");

    // Upload & Draft Modal
    const uploadModal = document.getElementById("uploadModal");
    const closeUploadModalBtn = document.getElementById("closeUploadModalBtn");
    const vaultUploadForm = document.getElementById("vaultUploadForm");
    const modalTitle = document.getElementById("modalTitle");
    const modalDraftId = document.getElementById("modalDraftId");
    const modalExistingDocId = document.getElementById("modalExistingDocId");
    const docTitleInput = document.getElementById("docTitleInput");
    const docCategorySelect = document.getElementById("docCategorySelect");
    const docNotesInput = document.getElementById("docNotesInput");
    const docFileInput = document.getElementById("docFileInput");
    const vaultDropzone = document.getElementById("vaultDropzone");
    const vaultSelectedFile = document.getElementById("vaultSelectedFile");
    const selectedFileName = document.getElementById("selectedFileName");
    const removeSelectedFileBtn = document.getElementById("removeSelectedFileBtn");
    const saveDraftBtn = document.getElementById("saveDraftBtn");
    const submitNormalUploadBtn = document.getElementById("submitNormalUploadBtn");
    const submitAdvanceUploadBtn = document.getElementById("submitAdvanceUploadBtn");
    const vaultNetGanacheBtn = document.getElementById("vaultNetGanacheBtn");
    const vaultNetSepoliaBtn = document.getElementById("vaultNetSepoliaBtn");
    const advanceBtnText = document.getElementById("advanceBtnText");
    const vaultDocProofStatusText = document.getElementById("vaultDocProofStatusText");
    const modalAlert = document.getElementById("modalAlert");
    const fileUploadContainer = document.getElementById("fileUploadContainer");

    const vaultAccountRequiredRow = document.getElementById("vaultAccountRequiredRow");
    const vaultAccountRequiredName = document.getElementById("vaultAccountRequiredName");
    const vaultAccountRequiredAddr = document.getElementById("vaultAccountRequiredAddr");
    const vaultSwitchMetaMaskAccountBtn = document.getElementById("vaultSwitchMetaMaskAccountBtn");

    const EXPECTED_NETWORK_ACCOUNTS = {
        sepolia: {
            address: "0x1FC04CfBF2f7B0F32AEBecd17880afeb38BFacC7",
            name: "Verified Records Sepolia",
            chainHex: "0xaa36a7",
            chainNum: 11155111,
            label: "Ethereum Sepolia",
            docVaultContract: "0xF858c586874aECd3C4324edA5C6Fcb4D0Db685D6"
        },
        ganache: {
            address: "0x9317939Ea9f3369C83776517f0549DC4552c2931",
            name: "Siddhant Personal account",
            chainHex: "0x539",
            chainNum: 1337,
            label: "Ganache Local",
            docVaultContract: "0xbBd0634841fcaE114436BDAa709c6F065d2145Db"
        }
    };

    let vaultDocProofNetwork = "sepolia";

    async function ensureCorrectNetworkAndAccount(targetNetwork, requestIfMismatch = false) {
        if (typeof window.ethereum === "undefined") {
            return { success: false, reason: "MetaMask not installed" };
        }
        const net = targetNetwork === "ganache" ? "ganache" : "sepolia";
        const expected = EXPECTED_NETWORK_ACCOUNTS[net];

        // 1. Ensure correct chain
        try {
            const currentChainHex = await window.ethereum.request({ method: "eth_chainId" }).catch(() => null);
            const currentNum = currentChainHex ? parseInt(currentChainHex, 16) : null;
            const isChainMatch = net === "sepolia"
                ? ((currentChainHex && currentChainHex.toLowerCase() === "0xaa36a7") || currentNum === 11155111)
                : ((currentChainHex && currentChainHex.toLowerCase() === "0x539") || currentNum === 1337 || currentNum === 5777);

            if (!isChainMatch) {
                try {
                    await window.ethereum.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: expected.chainHex }]
                    });
                } catch (switchErr) {
                    if (switchErr.code === 4902 || (switchErr.message && switchErr.message.includes("wallet_addEthereumChain"))) {
                        if (net === "sepolia") {
                            await window.ethereum.request({
                                method: "wallet_addEthereumChain",
                                params: [{
                                    chainId: "0xaa36a7",
                                    chainName: "Ethereum Sepolia Testnet",
                                    nativeCurrency: { name: "Sepolia Ether", symbol: "SEP", decimals: 18 },
                                    rpcUrls: ["https://rpc.sepolia.org", "https://sepolia.gateway.tenderly.co"],
                                    blockExplorerUrls: ["https://sepolia.etherscan.io"]
                                }]
                            });
                        } else {
                            await window.ethereum.request({
                                method: "wallet_addEthereumChain",
                                params: [{
                                    chainId: "0x539",
                                    chainName: "Ganache Local",
                                    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                                    rpcUrls: ["http://127.0.0.1:7545"]
                                }]
                            });
                        }
                    }
                }
            }
        } catch (chainErr) {
            console.warn("[MetaMask Switch Chain Error]", chainErr.message);
        }

        // 2. Account check
        let accounts = await window.ethereum.request({ method: "eth_accounts" }).catch(() => []);
        if (requestIfMismatch && (!accounts || accounts.length === 0)) {
            accounts = await window.ethereum.request({ method: "eth_requestAccounts" }).catch((err) => {
                console.warn("[MetaMask Accounts Request Notice]", err && err.message);
                return [];
            });
        }

        const finalActive = accounts && accounts[0] ? accounts[0] : null;
        const finalMatch = Boolean(finalActive && finalActive.toLowerCase() === expected.address.toLowerCase());

        return {
            success: finalMatch,
            account: finalActive,
            expected: expected
        };
    }

    function setVaultDocProofNetwork(net, triggerMetamask = false) {
        vaultDocProofNetwork = net === "ganache" ? "ganache" : "sepolia";
        const expected = EXPECTED_NETWORK_ACCOUNTS[vaultDocProofNetwork];

        if (vaultNetGanacheBtn) {
            const isGan = vaultDocProofNetwork === "ganache";
            vaultNetGanacheBtn.classList.toggle("active", isGan);
            vaultNetGanacheBtn.style.background = isGan ? "#ffffff" : "transparent";
            vaultNetGanacheBtn.style.color = isGan ? "#1e293b" : "#64748b";
            vaultNetGanacheBtn.style.fontWeight = isGan ? "700" : "600";
        }
        if (vaultNetSepoliaBtn) {
            const isSep = vaultDocProofNetwork === "sepolia";
            vaultNetSepoliaBtn.classList.toggle("active", isSep);
            vaultNetSepoliaBtn.style.background = isSep ? "#ffffff" : "transparent";
            vaultNetSepoliaBtn.style.color = isSep ? "#1e293b" : "#64748b";
            vaultNetSepoliaBtn.style.fontWeight = isSep ? "700" : "600";
        }
        if (advanceBtnText) {
            advanceBtnText.textContent = vaultDocProofNetwork === "ganache"
                ? "Advance Security (Ganache Local)"
                : "Advance Security (Ethereum Sepolia)";
        }
        if (vaultDocProofStatusText) {
            const shortContract = expected.docVaultContract.slice(0, 6) + "..." + expected.docVaultContract.slice(-4);
            vaultDocProofStatusText.textContent = vaultDocProofNetwork === "ganache"
                ? `Advance Security: Anchors proof on Ganache Local (Contract ${shortContract})`
                : `Advance Security: Anchors proof on Ethereum Sepolia (Contract ${shortContract})`;
        }
        if (vaultAccountRequiredName) {
            vaultAccountRequiredName.textContent = expected.name;
        }
        if (vaultAccountRequiredAddr) {
            vaultAccountRequiredAddr.textContent = expected.address.slice(0, 6) + "..." + expected.address.slice(-4);
            vaultAccountRequiredAddr.title = expected.address;
        }

        if (triggerMetamask && typeof window.ethereum !== "undefined") {
            ensureCorrectNetworkAndAccount(vaultDocProofNetwork, true).catch(() => {});
        }
    }

    if (vaultNetGanacheBtn) {
        vaultNetGanacheBtn.addEventListener("click", () => setVaultDocProofNetwork("ganache", true));
    }
    if (vaultNetSepoliaBtn) {
        vaultNetSepoliaBtn.addEventListener("click", () => setVaultDocProofNetwork("sepolia", true));
    }
    if (vaultSwitchMetaMaskAccountBtn) {
        vaultSwitchMetaMaskAccountBtn.addEventListener("click", async () => {
            const expected = EXPECTED_NETWORK_ACCOUNTS[vaultDocProofNetwork];
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(expected.address);
                }
            } catch (e) {}

            await window.ethereum.request({ method: "eth_requestAccounts" }).catch(() => {});

            const accounts = await window.ethereum.request({ method: "eth_accounts" }).catch(() => []);
            const active = accounts && accounts[0] ? accounts[0] : null;
            if (active && active.toLowerCase() === expected.address.toLowerCase()) {
                showModalAlert(`Active account matches ${expected.name} on ${expected.label}. Ready!`, "info");
            } else {
                const shortAddr = expected.address.slice(0, 6) + "..." + expected.address.slice(-4);
                showModalAlert(`In MetaMask, select "${expected.name}" (${shortAddr}). Address copied to clipboard!`, "info");
            }
        });
    }

    // Listen for accountsChanged to keep UI in sync
    if (typeof window.ethereum !== "undefined") {
        window.ethereum.on("accountsChanged", (newAccounts) => {
            const active = newAccounts && newAccounts[0] ? newAccounts[0] : null;
            const expected = EXPECTED_NETWORK_ACCOUNTS[vaultDocProofNetwork];
            if (active && expected && active.toLowerCase() === expected.address.toLowerCase()) {
                showModalAlert(`Connected to ${expected.name} on ${expected.label}. Ready!`, "info");
            }
        });
    }

    // Default to Sepolia or persisted network
    setVaultDocProofNetwork("sepolia", false);

    // Real-Time Multi-Stage Upload Progress Elements
    const uploadProgressContainer = document.getElementById("uploadProgressContainer");
    const uploadProgressTitle = document.getElementById("uploadProgressTitle");
    const uploadProgressPercent = document.getElementById("uploadProgressPercent");
    const uploadProgressBar = document.getElementById("uploadProgressBar");
    const uploadProgressStatus = document.getElementById("uploadProgressStatus");
    const uploadTransferStats = document.getElementById("uploadTransferStats");

    const stageItemEncryption = document.getElementById("stageItemEncryption");
    const stageIconEncryption = document.getElementById("stageIconEncryption");
    const stageTimeEncryption = document.getElementById("stageTimeEncryption");

    const stageItemAuth = document.getElementById("stageItemAuth");
    const stageIconAuth = document.getElementById("stageIconAuth");
    const stageTimeAuth = document.getElementById("stageTimeAuth");

    const stageItemUpload = document.getElementById("stageItemUpload");
    const stageIconUpload = document.getElementById("stageIconUpload");
    const stageTimeUpload = document.getElementById("stageTimeUpload");

    const stageItemBlockchain = document.getElementById("stageItemBlockchain");
    const stageIconBlockchain = document.getElementById("stageIconBlockchain");
    const stageTimeBlockchain = document.getElementById("stageTimeBlockchain");

    const stageItemPersistence = document.getElementById("stageItemPersistence");
    const stageIconPersistence = document.getElementById("stageIconPersistence");
    const stageTimePersistence = document.getElementById("stageTimePersistence");

    // Preview Modal
    const previewModal = document.getElementById("previewModal");
    const closePreviewModalBtn = document.getElementById("closePreviewModalBtn");
    const previewModalTitle = document.getElementById("previewModalTitle");
    const previewMetaSubtitle = document.getElementById("previewMetaSubtitle");
    const previewBody = document.getElementById("previewBody");
    const previewNotesBox = document.getElementById("previewNotesBox");
    const previewNotesText = document.getElementById("previewNotesText");
    const previewDownloadBtn = document.getElementById("previewDownloadBtn");
    const previewBlockchainProofBox = document.getElementById("previewBlockchainProofBox");
    const previewTxLink = document.getElementById("previewTxLink");
    const previewBlockNumber = document.getElementById("previewBlockNumber");
    const previewContractAddress = document.getElementById("previewContractAddress");
    let activePreviewBlobUrl = null;
    let activePreviewDownloadFn = null;

    // ------------------------------------------------------------------------
    // 1. ALERT / TOAST MESSAGING
    // ------------------------------------------------------------------------

    function showVaultAlert(message, type = "info", autoHide = 5000) {
        if (!vaultAlert) return;
        vaultAlert.textContent = message;
        vaultAlert.style.display = "block";

        if (type === "success") {
            vaultAlert.style.background = "#f0fdf4";
            vaultAlert.style.color = "#15803d";
            vaultAlert.style.border = "1px solid #bbf7d0";
        } else if (type === "danger") {
            vaultAlert.style.background = "#fef2f2";
            vaultAlert.style.color = "#b91c1c";
            vaultAlert.style.border = "1px solid #fecaca";
        } else if (type === "warning") {
            vaultAlert.style.background = "#fffbeb";
            vaultAlert.style.color = "#b45309";
            vaultAlert.style.border = "1px solid #fde68a";
        } else {
            vaultAlert.style.background = "#eff6ff";
            vaultAlert.style.color = "#1d4ed8";
            vaultAlert.style.border = "1px solid #bfdbfe";
        }

        if (autoHide) {
            setTimeout(() => {
                vaultAlert.style.display = "none";
            }, autoHide);
        }
    }

    function showModalAlert(message, type = "danger") {
        if (!modalAlert) return;
        modalAlert.textContent = message;
        modalAlert.style.display = "block";
        if (type === "danger") {
            modalAlert.style.background = "#fef2f2";
            modalAlert.style.color = "#b91c1c";
            modalAlert.style.border = "1px solid #fecaca";
        } else {
            modalAlert.style.background = "#f0fdf4";
            modalAlert.style.color = "#15803d";
            modalAlert.style.border = "1px solid #bbf7d0";
        }
    }

    function hideModalAlert() {
        if (modalAlert) modalAlert.style.display = "none";
    }

    // ------------------------------------------------------------------------
    // 2. URL QUERY CATEGORY SYNCHRONIZATION
    // ------------------------------------------------------------------------

    function syncCategoryFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const cat = urlParams.get("category");
        if (cat) {
            const valid = ["all", "aadhaar", "pan", "dl", "marksheets", "apaar"];
            if (valid.includes(cat.toLowerCase())) {
                activeCategory = cat.toLowerCase();
            }
        }
        updateCategoryPillsUI();
    }

    function updateCategoryPillsUI() {
        categoryPills.forEach(pill => {
            const cat = pill.getAttribute("data-category");
            if (cat === activeCategory) {
                pill.classList.add("active");
                pill.setAttribute("aria-selected", "true");
            } else {
                pill.classList.remove("active");
                pill.setAttribute("aria-selected", "false");
            }
        });
    }

    categoryPills.forEach(pill => {
        pill.addEventListener("click", () => {
            activeCategory = pill.getAttribute("data-category") || "all";
            updateCategoryPillsUI();
            const url = new URL(window.location);
            url.searchParams.set("category", activeCategory);
            window.history.replaceState({}, "", url);
            renderDocumentsGrid();
            renderDraftsGrid();
        });
    });

    // ------------------------------------------------------------------------
    // 3. FIREBASE AUTH STATE LISTENER
    // ------------------------------------------------------------------------

    firebase.auth().onAuthStateChanged(async function (user) {
        if (user) {
            if (vaultAuthPrompt) vaultAuthPrompt.style.display = "none";

            // If vault is already unlocked with in-memory password, show unlocked view
            if (inMemoryVaultPassword) {
                if (vaultFirstTimeCard) vaultFirstTimeCard.style.display = "none";
                if (vaultLockedCard) vaultLockedCard.style.display = "none";
                if (vaultUnlockedView) vaultUnlockedView.style.display = "flex";
                loadVaultDocuments();
            } else {
                // Determine if this user is a new user without an initialized vault
                const hasInit = localStorage.getItem("vr_vault_init_" + user.uid);
                let isBrandNewVaultUser = !hasInit;

                if (!hasInit) {
                    try {
                        const token = await user.getIdToken();
                        const res = await fetch("/api/documents/vaults", {
                            headers: { "Authorization": `Bearer ${token}` }
                        });
                        if (res.ok) {
                            const data = await res.json();
                            const vaults = data.vaults || [];
                            const totalDocs = vaults.reduce((acc, v) => acc + (v.documentCount || 0), 0);
                            // If user has documents or created custom vaults, they are returning
                            if (vaults.length > 1 || totalDocs > 0) {
                                isBrandNewVaultUser = false;
                                localStorage.setItem("vr_vault_init_" + user.uid, "true");
                            }
                        }
                    } catch (chkErr) {
                        console.warn("[Vault init check notice]", chkErr);
                    }
                }

                if (isBrandNewVaultUser) {
                    // Show "Create Your Vault" asking for Vault Name & Password Key
                    if (vaultFirstTimeCard) vaultFirstTimeCard.style.display = "flex";
                    if (vaultLockedCard) vaultLockedCard.style.display = "none";
                    if (vaultUnlockedView) vaultUnlockedView.style.display = "none";
                } else {
                    // Returning user: show only the Password Key unlock prompt
                    if (vaultFirstTimeCard) vaultFirstTimeCard.style.display = "none";
                    if (vaultLockedCard) vaultLockedCard.style.display = "flex";
                    if (vaultUnlockedView) vaultUnlockedView.style.display = "none";
                }
            }
        } else {
            // User logged out: clear memory key immediately and show login prompt
            lockVault();
            if (vaultAuthPrompt) vaultAuthPrompt.style.display = "flex";
            if (vaultFirstTimeCard) vaultFirstTimeCard.style.display = "none";
            if (vaultLockedCard) vaultLockedCard.style.display = "none";
            if (vaultUnlockedView) vaultUnlockedView.style.display = "none";
        }
    });

    // Helper to get active user's Firebase ID token
    async function getFirebaseToken() {
        const user = firebase.auth().currentUser;
        if (!user) {
            throw new Error("You must be logged in to access the vault.");
        }
        return await user.getIdToken();
    }

    // ------------------------------------------------------------------------
    // 4. VAULT UNLOCK & LOCK (ZERO-KNOWLEDGE) & FIRST-TIME VAULT CREATION
    // ------------------------------------------------------------------------

    // First-Time Vault Creation handler
    if (vaultFirstTimeForm) {
        vaultFirstTimeForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const vaultName = (firstTimeVaultNameInput.value || "").trim() || "Primary Vault";
            const password = (firstTimeVaultPasswordInput.value || "").trim();

            if (!password || password.length < 6) {
                showVaultAlert("Please enter a secure password key (minimum 6 characters).", "danger");
                return;
            }

            const btn = document.getElementById("btnCreateFirstTimeVault");
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Creating Vault...</span>';
            }

            try {
                const user = firebase.auth().currentUser;
                const token = await getFirebaseToken();

                // Save initial vault to backend
                try {
                    await fetch("/api/documents/vaults", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({ name: vaultName })
                    });
                } catch (vErr) {
                    console.warn("[Vault creation notice]", vErr);
                }

                // Initialize in-memory vault session key
                inMemoryVaultPassword = password;
                if (user) {
                    localStorage.setItem("vr_vault_init_" + user.uid, "true");
                }

                if (vaultFirstTimeCard) vaultFirstTimeCard.style.display = "none";
                if (vaultLockedCard) vaultLockedCard.style.display = "none";
                if (vaultUnlockedView) vaultUnlockedView.style.display = "flex";

                showVaultAlert(`Vault "${vaultName}" created and unlocked successfully.`, "success");
                loadVaultDocuments();
            } catch (err) {
                showVaultAlert(err.message || "Failed to create vault.", "danger");
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fa-solid fa-lock"></i> <span>Create & Unlock Vault</span>';
                }
            }
        });
    }

    // Toggle First-Time password visibility
    if (toggleFirstTimePwdBtn && firstTimeVaultPasswordInput) {
        toggleFirstTimePwdBtn.addEventListener("click", () => {
            const isPassword = firstTimeVaultPasswordInput.type === "password";
            firstTimeVaultPasswordInput.type = isPassword ? "text" : "password";
            toggleFirstTimePwdBtn.innerHTML = isPassword
                ? '<i class="fa-solid fa-eye-slash"></i>'
                : '<i class="fa-solid fa-eye"></i>';
        });
    }

    // Toggle unlock password visibility
    if (toggleVaultPasswordBtn && vaultPasswordInput) {
        toggleVaultPasswordBtn.addEventListener("click", () => {
            const isPassword = vaultPasswordInput.type === "password";
            vaultPasswordInput.type = isPassword ? "text" : "password";
    }

    // Unlock form submission
    if (vaultUnlockForm) {
        vaultUnlockForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const password = (vaultPasswordInput.value || "").trim();
            if (!password) {
                showVaultAlert("Please enter a valid vault password.", "danger");
                return;
            }

            const unlockBtn = document.getElementById("unlockVaultBtn");
            if (unlockBtn) {
                unlockBtn.disabled = true;
                unlockBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> <span>Unlocking...</span>';
            }

            try {
                const token = await getFirebaseToken();
                // 1. Fetch user's existing documents from backend
                const response = await fetch("/api/documents", {
                    headers: { "Authorization": `Bearer ${token}` }
                });

                if (!response.ok) {
                    throw new Error("Unable to contact vault server.");
                }

                const data = await response.json();
                const existingDocs = data.documents || [];

                // 2. If user already has encrypted documents, test password against the first doc
                if (existingDocs.length > 0) {
                    const testDoc = existingDocs.find(d => d.encryptedMetadata && d.encryption && d.encryption.salt && d.encryption.metadataIv);
                    if (testDoc) {
                        try {
                            const salt = VaultCrypto.hexToUint8Array(testDoc.encryption.salt);
                            const iv = VaultCrypto.hexToUint8Array(testDoc.encryption.metadataIv);
                            const key = await VaultCrypto.deriveKey(password, salt, testDoc.encryption.iterations || 100000);
                            await VaultCrypto.decryptJson(key, testDoc.encryptedMetadata, iv);
                        } catch (decryptErr) {
                            throw new Error("Incorrect vault password. Authentication tag verification failed.");
                        }
                    }
                }

                // Password verified or vault initialized for new user
                inMemoryVaultPassword = password;
                vaultPasswordInput.value = "";

                if (vaultLockedCard) vaultLockedCard.style.display = "none";
                if (vaultUnlockedView) vaultUnlockedView.style.display = "flex";

                showVaultAlert("Vault unlocked successfully. End-to-end encryption active.", "success");
                loadVaultDocuments();
            } catch (err) {
                console.warn("[Vault Unlock]", err.message);
                showVaultAlert(err.message, "danger");
            } finally {
                if (unlockBtn) {
                    unlockBtn.disabled = false;
                    unlockBtn.innerHTML = '<i class="fa-solid fa-lock-open"></i> <span>Unlock Vault</span>';
                }
            }
        });
    }

    // Lock Vault handler
    function lockVault() {
        inMemoryVaultPassword = null;
        cachedVaultDocuments = [];
        cachedVaultDrafts = [];
        if (vaultUnlockedView) vaultUnlockedView.style.display = "none";
        const user = firebase.auth().currentUser;
        if (user && vaultLockedCard) {
            if (vaultFirstTimeCard) vaultFirstTimeCard.style.display = "none";
            vaultLockedCard.style.display = "flex";
        }
        if (activePreviewBlobUrl) {
            URL.revokeObjectURL(activePreviewBlobUrl);
            activePreviewBlobUrl = null;
        }
    }

    if (lockVaultBtn) {
        lockVaultBtn.addEventListener("click", () => {
            lockVault();
            showVaultAlert("Vault locked. Cryptographic keys cleared from memory.", "info");
        });
    }

    // ------------------------------------------------------------------------
    // 5. FETCH & DECRYPT USER DOCUMENTS & MULTI-VAULT MANAGEMENT
    // ------------------------------------------------------------------------

    async function loadUserVaults() {
        try {
            const token = await getFirebaseToken();
            const res = await fetch("/api/documents/vaults", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!res.ok) return;
            const data = await res.json();
            const vaults = data.vaults || [];
            if (vaultSelectDropdown && vaults.length > 0) {
                vaultSelectDropdown.innerHTML = vaults.map(v => `
                    <option value="${v.vaultId}" ${v.vaultId === activeVaultId ? "selected" : ""}>
                        ${v.name} (${v.docCount || 0} doc${v.docCount === 1 ? "" : "s"})
                    </option>
                `).join("");
            }
        } catch (e) {
            console.warn("[Vaults] Notice loading vaults:", e.message);
        }
    }

    async function loadVaultDocuments() {
        if (!inMemoryVaultPassword) return;

        try {
            loadUserVaults();
            const token = await getFirebaseToken();
            const response = await fetch(`/api/documents?vaultId=${encodeURIComponent(activeVaultId || "default")}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!response.ok) {
                throw new Error("Failed to load documents from repository.");
            }

            const data = await response.json();
            const allItems = data.documents || [];

            // Update active cloud storage environment badge
            const vaultCloudBadge = document.getElementById("vaultCloudBadge");
            const vaultCloudNameText = document.getElementById("vaultCloudNameText");
            if (vaultCloudBadge && vaultCloudNameText && data.configuredCloudName) {
                vaultCloudNameText.textContent = data.configuredCloudName;
                vaultCloudBadge.style.display = "inline-flex";
            }

            const savedDocs = [];
            const drafts = [];

            // Decrypt metadata in browser memory for each item
            for (const item of allItems) {
                if (item.status === "saved") {
                    try {
                        const salt = VaultCrypto.hexToUint8Array(item.encryption.salt);
                        const iv = VaultCrypto.hexToUint8Array(item.encryption.metadataIv);
                        const key = await VaultCrypto.deriveKey(inMemoryVaultPassword, salt, item.encryption.iterations || 100000);
                        const meta = await VaultCrypto.decryptJson(key, item.encryptedMetadata, iv);
                        savedDocs.push({
                            ...item,
                            decryptedMeta: meta
                        });
                    } catch (decErr) {
                        console.warn("[Vault] Could not decrypt item:", item.documentId);
                    }
                } else if (item.status === "draft") {
                    try {
                        const salt = VaultCrypto.hexToUint8Array(item.encryption.salt);
                        const iv = VaultCrypto.hexToUint8Array(item.encryption.metadataIv);
                        const key = await VaultCrypto.deriveKey(inMemoryVaultPassword, salt, item.encryption.iterations || 100000);
                        const draftData = await VaultCrypto.decryptJson(key, item.encryptedDraftData, iv);
                        drafts.push({
                            ...item,
                            decryptedDraft: draftData
                        });
                    } catch (decErr) {
                        console.warn("[Vault] Could not decrypt draft:", item.documentId);
                    }
                }
            }

            cachedVaultDocuments = savedDocs;
            cachedVaultDrafts = drafts;

            renderDocumentsGrid();
            renderDraftsGrid();
        } catch (err) {
            console.error("[Vault Load]", err);
            showVaultAlert("Failed to load documents: " + err.message, "danger");
        }
    }

    // Format file size helper
    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    }

    // Escape HTML helper
    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Format category label
    function getCategoryLabel(tag) {
        switch (tag) {
            case "aadhaar": return { name: "E-Aadhaar", class: "badge-aadhaar", icon: "fa-fingerprint" };
            case "pan": return { name: "PAN ID", class: "badge-pan", icon: "fa-address-card" };
            case "dl": return { name: "Driving Licence", class: "badge-dl", icon: "fa-id-badge" };
            case "marksheets": return { name: "Marksheets", class: "badge-marksheets", icon: "fa-graduation-cap" };
            case "apaar": return { name: "APAAR ID", class: "badge-apaar", icon: "fa-award" };
            default: return { name: "Your Docs", class: "badge-all", icon: "fa-folder-open" };
        }
    }

    // ------------------------------------------------------------------------
    // 6. RENDER DOCUMENTS GRID
    // ------------------------------------------------------------------------

    function renderDocumentsGrid() {
        if (!vaultDocumentsGrid) return;
        vaultDocumentsGrid.innerHTML = "";

        const searchTerm = (vaultSearchInput ? vaultSearchInput.value : "").trim().toLowerCase();

        // Filter by category and search
        const filtered = cachedVaultDocuments.filter(doc => {
            const matchesCat = (activeCategory === "all") || (doc.categoryTag === activeCategory);
            if (!matchesCat) return false;

            if (searchTerm) {
                const title = (doc.decryptedMeta.title || "").toLowerCase();
                const notes = (doc.decryptedMeta.notes || "").toLowerCase();
                const filename = (doc.decryptedMeta.fileName || "").toLowerCase();
                return title.includes(searchTerm) || notes.includes(searchTerm) || filename.includes(searchTerm);
            }
            return true;
        });

        if (filtered.length === 0) {
            if (vaultEmptyState) vaultEmptyState.style.display = "flex";
            return;
        }

        if (vaultEmptyState) vaultEmptyState.style.display = "none";

        filtered.forEach(doc => {
            const meta = doc.decryptedMeta;
            const catInfo = getCategoryLabel(doc.categoryTag);
            const dateStr = doc.createdAt ? new Date(doc.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "Recent";
            const sizeStr = formatBytes(meta.fileSize || doc.cloudinaryBytes);

            const card = document.createElement("div");
            card.className = "vault-card";
            card.innerHTML = `
                <div>
                    <div class="vault-card-header">
                        <span class="vault-card-cat-badge ${catInfo.class}">
                            <i class="fa-solid ${catInfo.icon}"></i> ${escapeHtml(catInfo.name)}
                        </span>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            ${doc.storageVerified === false
                                ? `<span style="background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 6px; padding: 2px 7px; font-size: 0.7rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" title="Cloud storage asset needs verification or repair"><i class="fa-solid fa-triangle-exclamation"></i> Unverified</span>`
                                : ((doc.blockchainProof && doc.blockchainProof.enabled && doc.blockchainProof.transactionHash)
                                    ? `<span class="vault-card-chain-badge" style="background: rgba(37, 99, 235, 0.12); color: #1d4ed8; border: 1px solid rgba(37, 99, 235, 0.28); border-radius: 6px; padding: 2px 7px; font-size: 0.7rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" title="Anchored on ${doc.blockchainProof.network === 'ganache' || doc.blockchainProof.network === 'local' ? 'Ganache Local' : 'Ethereum Sepolia'}"><i class="fa-solid fa-shield-halved"></i> ${doc.blockchainProof.network === 'ganache' || doc.blockchainProof.network === 'local' ? 'Ganache' : 'Sepolia'}</span>`
                                    : `<span style="font-size: 0.68rem; color: #64748b; font-weight: 600;" title="Stored in Cloudinary (${escapeHtml(doc.cloudinaryCloudName || 'active cloud')})"><i class="fa-solid fa-cloud"></i> ${escapeHtml(doc.cloudinaryCloudName || 'Cloudinary')}</span>`
                                )
                            }
                            <span class="vault-card-enc-badge" title="Encrypted with AES-256-GCM">
                                <i class="fa-solid fa-lock"></i> AES-256
                            </span>
                        </div>
                    </div>

                    <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 4px;">
                        <h4 class="vault-card-title">${escapeHtml(meta.title || "Untitled Document")}</h4>
                        <div class="vault-card-filename">
                            <i class="fa-regular fa-file"></i>
                            <span>${escapeHtml(meta.fileName || "document.bin")}</span>
                        </div>
                    </div>

                    <div class="vault-card-meta" style="margin-top: 10px;">
                        <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
                        <span><i class="fa-solid fa-hard-drive"></i> ${sizeStr}</span>
                    </div>

                    ${meta.notes ? `<p class="vault-card-notes" style="margin-top: 10px;">${escapeHtml(meta.notes)}</p>` : ""}
                </div>

                <div class="vault-card-actions">
                    <button type="button" class="vault-btn-view" data-doc-id="${doc.documentId}">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                    <button type="button" class="vault-btn-dl" data-doc-id="${doc.documentId}">
                        <i class="fa-solid fa-download"></i> Download
                    </button>
                    <button type="button" class="vault-btn-delete" data-doc-id="${doc.documentId}" title="Delete Document">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            `;

            // Action listeners
            card.querySelector(".vault-btn-view").addEventListener("click", () => openPreviewModal(doc));
            card.querySelector(".vault-btn-dl").addEventListener("click", () => downloadOriginalDocument(doc));
            card.querySelector(".vault-btn-delete").addEventListener("click", () => deleteDocument(doc.documentId));

            vaultDocumentsGrid.appendChild(card);
        });
    }

    if (vaultSearchInput) {
        vaultSearchInput.addEventListener("input", renderDocumentsGrid);
    }

    // ------------------------------------------------------------------------
    // 7. RENDER DRAFTS SECTION
    // ------------------------------------------------------------------------

    function renderDraftsGrid() {
        if (!vaultDraftsContainer || !vaultDraftsGrid) return;

        const filteredDrafts = cachedVaultDrafts.filter(d => {
            return (activeCategory === "all") || (d.categoryTag === activeCategory);
        });

        if (filteredDrafts.length === 0) {
            vaultDraftsContainer.style.display = "none";
            return;
        }

        vaultDraftsContainer.style.display = "flex";
        vaultDraftsGrid.innerHTML = "";

        filteredDrafts.forEach(draft => {
            const data = draft.decryptedDraft || {};
            const catInfo = getCategoryLabel(draft.categoryTag);
            const draftCard = document.createElement("div");
            draftCard.className = "vault-draft-card";
            draftCard.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span class="vault-card-cat-badge ${catInfo.class}" style="font-size: 0.7rem;">
                        <i class="fa-solid ${catInfo.icon}"></i> ${escapeHtml(catInfo.name)}
                    </span>
                    <button type="button" class="delete-draft-btn" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 2px;" title="Discard Draft">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <strong style="font-size: 0.95rem; color: var(--color-text-primary);">${escapeHtml(data.title || "Untitled Draft")}</strong>
                ${data.notes ? `<p style="font-size: 0.8rem; color: var(--color-text-secondary); margin: 0; line-height: 1.3;">${escapeHtml(data.notes.slice(0, 60))}${data.notes.length > 60 ? '...' : ''}</p>` : ""}
                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: var(--color-text-muted); margin-top: 4px;">
                    <span><i class="fa-regular fa-clock"></i> Draft</span>
                    <span style="color: var(--color-brand-primary); font-weight: 600;">Resume <i class="fa-solid fa-arrow-right"></i></span>
                </div>
            `;

            draftCard.addEventListener("click", (e) => {
                if (e.target.closest(".delete-draft-btn")) return;
                openDraftInModal(draft);
            });

            draftCard.querySelector(".delete-draft-btn").addEventListener("click", async (e) => {
                e.stopPropagation();
                if (confirm("Discard this draft?")) {
                    await deleteDocument(draft.documentId);
                }
            });

            vaultDraftsGrid.appendChild(draftCard);
        });
    }

    // ------------------------------------------------------------------------
    // 8. DECRYPT & PREVIEW IN BROWSER
    // ------------------------------------------------------------------------

    async function openPreviewModal(doc) {
        if (!inMemoryVaultPassword) return;

        previewBody.innerHTML = '<div style="display: flex; align-items: center; gap: 10px; color: var(--color-text-secondary);"><i class="fa-solid fa-circle-notch fa-spin"></i> Decrypting file payload in browser memory...</div>';
        if (previewNotesBox) previewNotesBox.style.display = "none";
        previewModal.style.display = "flex";

        const meta = doc.decryptedMeta || {};
        previewModalTitle.textContent = meta.title || "Document Preview";
        previewMetaSubtitle.textContent = `${meta.fileName || ""} • ${formatBytes(meta.fileSize || doc.cloudinaryBytes)}`;

        if (meta.notes && previewNotesBox && previewNotesText) {
            previewNotesText.textContent = meta.notes;
            previewNotesBox.style.display = "block";
        }

        if (previewBlockchainProofBox) {
            if (doc.blockchainProof && doc.blockchainProof.enabled && doc.blockchainProof.transactionHash) {
                previewBlockchainProofBox.style.display = "block";
                if (previewTxLink) {
                    previewTxLink.href = `https://sepolia.etherscan.io/tx/${doc.blockchainProof.transactionHash}`;
                    previewTxLink.textContent = doc.blockchainProof.transactionHash;
                }
                if (previewBlockNumber) {
                    previewBlockNumber.textContent = doc.blockchainProof.blockNumber ? `#${doc.blockchainProof.blockNumber}` : "Confirmed";
                }
                if (previewContractAddress) {
                    previewContractAddress.textContent = doc.blockchainProof.contractAddress || "Sepolia Contract";
                }
            } else {
                previewBlockchainProofBox.style.display = "none";
            }
        }

        try {
            const token = await getFirebaseToken();
            const res = await fetch(`/api/documents/${doc.documentId}/file`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                if (errData.error === "STORAGE_ASSET_UNAVAILABLE" || res.status === 404) {
                    previewBody.innerHTML = `
                        <div style="text-align: center; padding: 24px 16px; display: flex; flex-direction: column; align-items: center; gap: 14px;">
                            <div style="width: 56px; height: 56px; border-radius: 50%; background: #fef2f2; display: flex; align-items: center; justify-content: center; color: #dc2626; font-size: 1.5rem;">
                                <i class="fa-solid fa-cloud-slash"></i>
                            </div>
                            <div>
                                <h4 style="margin: 0 0 6px 0; color: #1e293b; font-size: 1.1rem;">Asset Unavailable in Cloud Storage</h4>
                                <p style="margin: 0; color: #64748b; font-size: 0.85rem; max-width: 460px; line-height: 1.5;">
                                    ${escapeHtml(errData.message || "The encrypted file payload was not found in the active Cloudinary environment.")}
                                </p>
                            </div>
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; font-size: 0.78rem; font-family: var(--font-mono, monospace); color: #475569; text-align: left; width: 100%; max-width: 480px;">
                                <div><strong>Active Cloud:</strong> ${escapeHtml(errData.configuredCloudName || "active")}</div>
                                <div><strong>Recorded Cloud:</strong> ${escapeHtml(errData.recordedCloudName || doc.cloudinaryCloudName || "N/A")}</div>
                                <div><strong>Recorded Public ID:</strong> ${escapeHtml(errData.cloudinaryPublicId || doc.cloudinaryPublicId || "N/A")}</div>
                            </div>
                            <button type="button" id="repairAssetBtn" class="vault-btn-primary" style="margin-top: 8px;">
                                <i class="fa-solid fa-arrow-rotate-right"></i>
                                <span>Re-upload & Repair Document</span>
                            </button>
                        </div>
                    `;
                    const repairBtn = document.getElementById("repairAssetBtn");
                    if (repairBtn) {
                        repairBtn.addEventListener("click", () => {
                            previewModal.style.display = "none";
                            openUploadModal(null, doc);
                        });
                    }
                    return;
                }
                throw new Error(errData.message || "Failed to download encrypted asset from storage.");
            }

            const ciphertextBuffer = await res.arrayBuffer();

            // Decrypt in memory with AES-256-GCM
            const salt = VaultCrypto.hexToUint8Array(doc.encryption.salt);
            const fileIv = VaultCrypto.hexToUint8Array(doc.encryption.fileIv);
            const key = await VaultCrypto.deriveKey(inMemoryVaultPassword, salt, doc.encryption.iterations || 100000);

            const plaintextBuffer = await VaultCrypto.decryptBuffer(key, ciphertextBuffer, fileIv);

            // Create blob with original mime type
            const mimeType = meta.mimeType || "application/octet-stream";
            const blob = new Blob([plaintextBuffer], { type: mimeType });

            if (activePreviewBlobUrl) URL.revokeObjectURL(activePreviewBlobUrl);
            activePreviewBlobUrl = URL.createObjectURL(blob);

            // Render preview based on MIME type
            if (mimeType.startsWith("image/")) {
                previewBody.innerHTML = `<img src="${activePreviewBlobUrl}" alt="Decrypted document" class="vault-preview-img">`;
            } else if (mimeType === "application/pdf") {
                previewBody.innerHTML = `<iframe src="${activePreviewBlobUrl}" class="vault-preview-pdf" title="PDF Document"></iframe>`;
            } else if (mimeType.startsWith("text/")) {
                const text = new TextDecoder().decode(plaintextBuffer);
                previewBody.innerHTML = `<pre class="vault-preview-text">${escapeHtml(text)}</pre>`;
            } else {
                previewBody.innerHTML = `
                    <div style="text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                        <i class="fa-solid fa-file-shield" style="font-size: 3.5rem; color: var(--color-brand-primary);"></i>
                        <p style="margin: 0; font-size: 0.95rem; font-weight: 600;">Decrypted Successfully (${formatBytes(plaintextBuffer.byteLength)})</p>
                        <span style="font-size: 0.8rem; color: var(--color-text-muted);">In-browser preview is not supported for this file format. Click Download below to save the original file.</span>
                    </div>
                `;
            }

            // Bind download button
            activePreviewDownloadFn = () => triggerBrowserDownload(blob, meta.fileName || "document");
            if (previewDownloadBtn) {
                previewDownloadBtn.onclick = activePreviewDownloadFn;
            }

        } catch (err) {
            console.error("[Vault Preview]", err);
            previewBody.innerHTML = `<div style="color: #b91c1c; text-align: center;"><i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 8px;"></i><br>${escapeHtml(err.message)}</div>`;
        }
    }

    if (closePreviewModalBtn && previewModal) {
        closePreviewModalBtn.addEventListener("click", () => {
            previewModal.style.display = "none";
            if (activePreviewBlobUrl) {
                URL.revokeObjectURL(activePreviewBlobUrl);
                activePreviewBlobUrl = null;
            }
        });
    }

    // ------------------------------------------------------------------------
    // 9. DOWNLOAD ORIGINAL FILE
    // ------------------------------------------------------------------------

    function triggerBrowserDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    async function downloadOriginalDocument(doc) {
        if (!inMemoryVaultPassword) return;

        showVaultAlert("Decrypting document in browser memory for download...", "info", 3000);

        try {
            const token = await getFirebaseToken();
            const res = await fetch(`/api/documents/${doc.documentId}/file`, {
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                if (errData.error === "STORAGE_ASSET_UNAVAILABLE" || res.status === 404) {
                    showVaultAlert(`Asset unavailable in cloud (${errData.configuredCloudName || 'Cloudinary'}). Click View on the document to re-upload and repair it.`, "warning", 8000);
                    return;
                }
                throw new Error(errData.message || "Unable to download encrypted file from vault storage.");
            }

            const ciphertextBuffer = await res.arrayBuffer();
            const meta = doc.decryptedMeta || {};

            const salt = VaultCrypto.hexToUint8Array(doc.encryption.salt);
            const fileIv = VaultCrypto.hexToUint8Array(doc.encryption.fileIv);
            const key = await VaultCrypto.deriveKey(inMemoryVaultPassword, salt, doc.encryption.iterations || 100000);

            const plaintextBuffer = await VaultCrypto.decryptBuffer(key, ciphertextBuffer, fileIv);
            const blob = new Blob([plaintextBuffer], { type: meta.mimeType || "application/octet-stream" });

            triggerBrowserDownload(blob, meta.fileName || "decrypted_document");
            showVaultAlert("Document decrypted and downloaded successfully.", "success");
        } catch (err) {
            console.error("[Download Error]", err);
            showVaultAlert("Download failed: " + err.message, "danger");
        }
    }

    // ------------------------------------------------------------------------
    // 10. DELETE DOCUMENT
    // ------------------------------------------------------------------------

    async function deleteDocument(documentId) {
        if (!confirm("Are you sure you want to permanently delete this document from your vault and cloud storage?")) {
            return;
        }

        try {
            const token = await getFirebaseToken();
            const res = await fetch(`/api/documents/${documentId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || "Failed to delete document.");
            }

            showVaultAlert("Document deleted successfully from vault and Cloudinary.", "success");
            loadVaultDocuments();
        } catch (err) {
            console.error("[Delete Error]", err);
            showVaultAlert(err.message, "danger");
        }
    }

    // ------------------------------------------------------------------------
    // 11. UPLOAD & DRAFT MODAL CONTROLLER
    // ------------------------------------------------------------------------

    function openUploadModal(draft = null, existingDocToRepair = null) {
        hideModalAlert();
        selectedUploadFile = null;
        isUploading = false;
        resetUploadProgressUI(false);
        if (docFileInput) docFileInput.value = "";
        if (vaultSelectedFile) vaultSelectedFile.style.display = "none";
        if (vaultDropzone) vaultDropzone.style.display = "flex";

        if (existingDocToRepair) {
            modalTitle.textContent = "Re-upload & Repair Document File";
            if (modalDraftId) modalDraftId.value = "";
            if (modalExistingDocId) modalExistingDocId.value = existingDocToRepair.documentId;
            const meta = existingDocToRepair.decryptedMeta || {};
            docTitleInput.value = meta.title || "";
            docCategorySelect.value = existingDocToRepair.categoryTag || "all";
            docNotesInput.value = meta.notes || "";
            showModalAlert("Select the document file to upload and repair storage in the active Cloudinary environment.", "info");
        } else if (draft) {
            modalTitle.textContent = "Continue Draft / Upload Document";
            if (modalDraftId) modalDraftId.value = draft.documentId;
            if (modalExistingDocId) modalExistingDocId.value = "";
            const data = draft.decryptedDraft || {};
            docTitleInput.value = data.title || "";
            docCategorySelect.value = draft.categoryTag || "all";
            docNotesInput.value = data.notes || "";
        } else {
            modalTitle.textContent = "Upload Encrypted Document";
            if (modalDraftId) modalDraftId.value = "";
            if (modalExistingDocId) modalExistingDocId.value = "";
            docTitleInput.value = "";
            docCategorySelect.value = activeCategory !== "all" ? activeCategory : "all";
            docNotesInput.value = "";
        }

        uploadModal.style.display = "flex";
    }

    function openDraftInModal(draft) {
        openUploadModal(draft);
    }

    if (openUploadModalBtn) {
        openUploadModalBtn.addEventListener("click", () => openUploadModal(null));
    }

    if (openDraftModalBtn) {
        openDraftModalBtn.addEventListener("click", () => openUploadModal(null));
    }

    if (closeUploadModalBtn && uploadModal) {
        closeUploadModalBtn.addEventListener("click", () => {
            if (isUploading) {
                if (!confirm("An upload is currently in progress. Closing this modal will not cancel the transfer. Are you sure you want to close?")) {
                    return;
                }
            }
            uploadModal.style.display = "none";
        });
    }

    // Dropzone handling
    if (vaultDropzone && docFileInput) {
        vaultDropzone.addEventListener("click", () => docFileInput.click());

        vaultDropzone.addEventListener("dragover", (e) => {
            e.preventDefault();
            vaultDropzone.classList.add("dragover");
        });

        vaultDropzone.addEventListener("dragleave", () => {
            vaultDropzone.classList.remove("dragover");
        });

        vaultDropzone.addEventListener("drop", (e) => {
            e.preventDefault();
            vaultDropzone.classList.remove("dragover");
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleSelectedFile(e.dataTransfer.files[0]);
            }
        });

        docFileInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleSelectedFile(e.target.files[0]);
            }
        });
    }

    function handleSelectedFile(file) {
        // Enforce 15MB limit
        if (file.size > 15 * 1024 * 1024) {
            showModalAlert("File exceeds the 15MB size limit. Please choose a smaller file.", "danger");
            return;
        }

        // Validate supported file extensions
        const allowedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".webp", ".txt", ".doc", ".docx"];
        const lowerName = file.name.toLowerCase();
        const isAllowed = allowedExtensions.some(ext => lowerName.endsWith(ext));
        if (!isAllowed) {
            showModalAlert("Unsupported file type. Allowed: PDF, PNG, JPG, WEBP, TXT, DOC, DOCX.", "danger");
            return;
        }

        hideModalAlert();
        selectedUploadFile = file;
        if (selectedFileName) selectedFileName.textContent = `${file.name} (${formatBytes(file.size)})`;
        if (vaultDropzone) vaultDropzone.style.display = "none";
        if (vaultSelectedFile) vaultSelectedFile.style.display = "flex";

        // Auto-fill title if empty
        if (docTitleInput && !docTitleInput.value.trim()) {
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            docTitleInput.value = nameWithoutExt;
        }
    }

    if (removeSelectedFileBtn) {
        removeSelectedFileBtn.addEventListener("click", () => {
            selectedUploadFile = null;
            if (docFileInput) docFileInput.value = "";
            if (vaultSelectedFile) vaultSelectedFile.style.display = "none";
            if (vaultDropzone) vaultDropzone.style.display = "flex";
        });
    }

    // Autosave draft on input changes
    function triggerAutosaveDraft() {
        if (!inMemoryVaultPassword) return;
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(async () => {
            const title = (docTitleInput.value || "").trim();
            const notes = (docNotesInput.value || "").trim();
            const category = docCategorySelect.value || "all";

            if (!title && !notes) return;

            try {
                const token = await getFirebaseToken();
                const salt = VaultCrypto.generateSalt();
                const metadataIv = VaultCrypto.generateIv();
                const key = await VaultCrypto.deriveKey(inMemoryVaultPassword, salt);

                const draftPayload = {
                    title: title || "Untitled Draft",
                    notes: notes,
                    category: category,
                    updatedAt: new Date().toISOString()
                };

                const encryptedDraftData = await VaultCrypto.encryptJson(key, draftPayload, metadataIv);

                const body = {
                    draftId: modalDraftId.value || undefined,
                    encryptedDraftData: encryptedDraftData,
                    salt: VaultCrypto.bufferToHex(salt),
                    metadataIv: VaultCrypto.bufferToHex(metadataIv),
                    categoryTag: category,
                    vaultId: activeVaultId || "default"
                };

                const res = await fetch("/api/documents/draft", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(body)
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.draft && data.draft.documentId) {
                        modalDraftId.value = data.draft.documentId;
                    }
                    loadVaultDocuments();
                }
            } catch (e) {
                console.warn("[Autosave Warning]", e.message);
            }
        }, 1500);
    }

    if (docTitleInput) docTitleInput.addEventListener("input", triggerAutosaveDraft);
    if (docNotesInput) docNotesInput.addEventListener("input", triggerAutosaveDraft);
    if (docCategorySelect) docCategorySelect.addEventListener("change", triggerAutosaveDraft);

    // Explicit "Save as Draft" button
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener("click", async () => {
            const title = (docTitleInput.value || "").trim();
            if (!title) {
                showModalAlert("Please enter a document title to save as draft.", "danger");
                return;
            }

            saveDraftBtn.disabled = true;
            saveDraftBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';

            try {
                const token = await getFirebaseToken();
                const salt = VaultCrypto.generateSalt();
                const metadataIv = VaultCrypto.generateIv();
                const key = await VaultCrypto.deriveKey(inMemoryVaultPassword, salt);

                const draftPayload = {
                    title: title,
                    notes: (docNotesInput.value || "").trim(),
                    category: docCategorySelect.value || "all",
                    updatedAt: new Date().toISOString()
                };

                const encryptedDraftData = await VaultCrypto.encryptJson(key, draftPayload, metadataIv);

                const res = await fetch("/api/documents/draft", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        draftId: modalDraftId.value || undefined,
                        encryptedDraftData,
                        salt: VaultCrypto.bufferToHex(salt),
                        metadataIv: VaultCrypto.bufferToHex(metadataIv),
                        categoryTag: docCategorySelect.value || "all"
                    })
                });

                if (!res.ok) throw new Error("Draft save failed.");

                uploadModal.style.display = "none";
                showVaultAlert("Draft saved successfully.", "success");
                loadVaultDocuments();
            } catch (err) {
                showModalAlert(err.message, "danger");
            } finally {
                saveDraftBtn.disabled = false;
                saveDraftBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> <span>Save as Draft</span>';
            }
        });
    }

    // ------------------------------------------------------------------------
    // 10. REAL-TIME PROGRESS & DIRECT CLOUDINARY UPLOAD CONTROLLER
    // ------------------------------------------------------------------------

    function resetUploadProgressUI(isAdvance = false) {
        if (!uploadProgressContainer) return;
        uploadProgressContainer.style.display = "none";
        if (uploadProgressPercent) uploadProgressPercent.textContent = "0%";
        if (uploadProgressBar) uploadProgressBar.style.width = "0%";
        if (uploadProgressStatus) {
            uploadProgressStatus.textContent = "Preparing client-side encryption...";
            uploadProgressStatus.style.color = "#64748b";
        }
        if (uploadTransferStats) uploadTransferStats.textContent = "0 KB / 0 KB";

        if (stageItemBlockchain) {
            stageItemBlockchain.style.display = isAdvance ? "flex" : "none";
        }

        const stages = [
            { item: stageItemEncryption, icon: stageIconEncryption, time: stageTimeEncryption },
            { item: stageItemAuth, icon: stageIconAuth, time: stageTimeAuth },
            { item: stageItemUpload, icon: stageIconUpload, time: stageTimeUpload },
            { item: stageItemBlockchain, icon: stageIconBlockchain, time: stageTimeBlockchain },
            { item: stageItemPersistence, icon: stageIconPersistence, time: stageTimePersistence }
        ];

        stages.forEach(({ item, icon, time }) => {
            if (item) item.style.color = "#64748b";
            if (icon) {
                icon.className = "fa-regular fa-circle";
                icon.style.color = "#94a3b8";
            }
            if (time) time.textContent = "";
        });
    }

    function setStageState(stageKey, state, durationMs = null) {
        const stageMap = {
            encryption: { item: stageItemEncryption, icon: stageIconEncryption, time: stageTimeEncryption },
            auth: { item: stageItemAuth, icon: stageIconAuth, time: stageTimeAuth },
            upload: { item: stageItemUpload, icon: stageIconUpload, time: stageTimeUpload },
            blockchain: { item: stageItemBlockchain, icon: stageIconBlockchain, time: stageTimeBlockchain },
            persistence: { item: stageItemPersistence, icon: stageIconPersistence, time: stageTimePersistence }
        };

        const target = stageMap[stageKey];
        if (!target) return;

        if (state === "active") {
            if (target.item) target.item.style.color = "#1e293b";
            if (target.icon) {
                target.icon.className = "fa-solid fa-circle-notch fa-spin";
                target.icon.style.color = "#2563eb";
            }
        } else if (state === "completed") {
            if (target.item) target.item.style.color = "#047857";
            if (target.icon) {
                target.icon.className = "fa-solid fa-circle-check";
                target.icon.style.color = "#10b981";
            }
            if (target.time && durationMs !== null) {
                target.time.textContent = durationMs >= 1000 ? `${(durationMs / 1000).toFixed(2)}s` : `${Math.round(durationMs)}ms`;
                target.time.style.color = "#059669";
            }
        } else if (state === "error") {
            if (target.item) target.item.style.color = "#b91c1c";
            if (target.icon) {
                target.icon.className = "fa-solid fa-circle-xmark";
                target.icon.style.color = "#ef4444";
            }
        } else {
            if (target.item) target.item.style.color = "#64748b";
            if (target.icon) {
                target.icon.className = "fa-regular fa-circle";
                target.icon.style.color = "#94a3b8";
            }
        }
    }

    function setOverallProgress(percent, statusText, statsText = "") {
        const clampedPct = Math.min(100, Math.max(0, Math.round(percent)));
        if (uploadProgressBar) {
            uploadProgressBar.style.width = clampedPct + "%";
        }
        if (uploadProgressPercent) {
            uploadProgressPercent.textContent = clampedPct + "%";
        }
        if (uploadProgressStatus && statusText) {
            uploadProgressStatus.textContent = statusText;
        }
        if (uploadTransferStats && statsText) {
            uploadTransferStats.textContent = statsText;
        }
    }

    function uploadDirectToCloudinary(uploadUrl, formData, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", uploadUrl, true);
            xhr.timeout = 300000; // 5-minute timeout for network resilience

            if (xhr.upload && onProgress) {
                xhr.upload.onprogress = (event) => {
                    if (event.lengthComputable) {
                        onProgress(event.loaded, event.total);
                    }
                };
            }

            xhr.onload = function () {
                try {
                    const response = JSON.parse(xhr.responseText || "{}");
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(response);
                    } else {
                        const errMsg = (response.error && response.error.message) || `Upload failed with HTTP ${xhr.status}`;
                        reject(new Error(errMsg));
                    }
                } catch (parseErr) {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve({});
                    } else {
                        reject(new Error(`Storage service error (HTTP ${xhr.status})`));
                    }
                }
            };

            xhr.onerror = function () {
                reject(new Error("Network connection error during direct upload to secure storage."));
            };

            xhr.ontimeout = function () {
                reject(new Error("Upload timed out after 5 minutes. Please check your network connection and retry."));
            };

            xhr.send(formData);
        });
    }

    async function executeDocumentUpload(mode = "normal") {
        if (isUploading) {
            return;
        }

        if (modalAlert) {
            modalAlert.style.display = "none";
            modalAlert.textContent = "";
        }

        if (!inMemoryVaultPassword) {
            showModalAlert("Vault is locked. Please unlock the vault first.", "danger");
            return;
        }

        const title = (docTitleInput.value || "").trim();
        if (!title) {
            showModalAlert("Document Title is required.", "danger");
            return;
        }

        if (!selectedUploadFile) {
            showModalAlert("Please select or drop a file to upload.", "danger");
            return;
        }

        const isAdvance = mode === "advance";
        const activeBtn = isAdvance ? submitAdvanceUploadBtn : submitNormalUploadBtn;
        const otherBtn = isAdvance ? submitNormalUploadBtn : submitAdvanceUploadBtn;

        isUploading = true;
        if (activeBtn) {
            activeBtn.disabled = true;
            activeBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Processing...';
        }
        if (otherBtn) otherBtn.disabled = true;
        if (saveDraftBtn) saveDraftBtn.disabled = true;
        if (closeUploadModalBtn) closeUploadModalBtn.disabled = true;

        resetUploadProgressUI(isAdvance);
        if (uploadProgressContainer) {
            uploadProgressContainer.style.display = "block";
        }

        let activeStageKey = "encryption";
        const timing = {
            startTotal: performance.now(),
            encryptionMs: 0,
            authSignatureMs: 0,
            cloudinaryUploadMs: 0,
            blockchainAnchorMs: null,
            mongoRecordMs: 0,
            totalMs: 0
        };

        try {
            const token = await getFirebaseToken();
            if (!token) {
                throw new Error("Authentication required. Please sign in to save documents.");
            }

            // If Advance Security is selected, pre-initialize MetaMask & prepare transaction concurrently with file encryption/upload!
            let blockchainPrepPromise = null;
            if (isAdvance) {
                blockchainPrepPromise = (async () => {
                    const isSep = vaultDocProofNetwork === "sepolia";
                    const targetHex = isSep ? "0xaa36a7" : "0x539";
                    const targetName = isSep ? "Ethereum Sepolia" : "Ganache Local";

                    if (typeof window.ethereum === "undefined") {
                        throw new Error(`MetaMask not detected. Please install MetaMask to anchor documents on ${targetName}.`);
                    }

                    const netAlign = await ensureCorrectNetworkAndAccount(vaultDocProofNetwork, true);
                    if (!netAlign.account) {
                        throw new Error("No active Ethereum account selected in MetaMask.");
                    }
                    const signingAccount = netAlign.account;

                    const prepRes = await fetch("/api/documents/prepare-blockchain", {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            documentTitle: title,
                            walletAddress: signingAccount,
                            network: vaultDocProofNetwork
                        })
                    });
                    const prepData = await prepRes.json();
                    if (!prepRes.ok || !prepData.success) {
                        throw new Error(prepData.error || prepData.message || `Failed to prepare ${targetName} transaction.`);
                    }
                    return { signingAccount, prepData, targetName };
                })();
            }

            let fileBuffer;
            let salt;
            let fileIv;
            let metadataIv;
            let key;
            let encryptedFileArrayBuffer;
            let encryptedMetadataStr;
            let signData;
            let cloudinaryResult;

            const canReuseUploadedAsset = pendingCloudinaryUpload &&
                pendingCloudinaryUpload.fileName === selectedUploadFile.name &&
                pendingCloudinaryUpload.fileSize === selectedUploadFile.size &&
                pendingCloudinaryUpload.password === inMemoryVaultPassword;

            if (canReuseUploadedAsset) {
                // Reuse existing Cloudinary asset to avoid duplicate uploads
                salt = pendingCloudinaryUpload.salt;
                fileIv = pendingCloudinaryUpload.fileIv;
                metadataIv = pendingCloudinaryUpload.metadataIv;
                encryptedFileArrayBuffer = pendingCloudinaryUpload.encryptedFileArrayBuffer;
                encryptedMetadataStr = pendingCloudinaryUpload.encryptedMetadataStr;
                signData = pendingCloudinaryUpload.signData;
                cloudinaryResult = pendingCloudinaryUpload.cloudinaryResult;

                setStageState("encryption", "completed", 0);
                setStageState("auth", "completed", 0);
                setStageState("upload", "completed", 0);
                setOverallProgress(80, "Using previously verified Cloudinary upload payload.", "Cloud storage ready");
            } else {
                // STAGE 1: CLIENT-SIDE AES-256-GCM ENCRYPTION
                activeStageKey = "encryption";
                setStageState("encryption", "active");
                setOverallProgress(5, "Encrypting file in browser memory with AES-256-GCM...", "0% processed");

                const t0Enc = performance.now();
                fileBuffer = await selectedUploadFile.arrayBuffer();
                salt = VaultCrypto.generateSalt(16);
                fileIv = VaultCrypto.generateIv(12);
                metadataIv = VaultCrypto.generateIv(12);

                key = await VaultCrypto.deriveKey(inMemoryVaultPassword, salt);
                encryptedFileArrayBuffer = await VaultCrypto.encryptBuffer(key, fileBuffer, fileIv);

                const metadataObj = {
                    title: title,
                    fileName: selectedUploadFile.name,
                    category: docCategorySelect.value || "all",
                    notes: (docNotesInput.value || "").trim(),
                    mimeType: selectedUploadFile.type || "application/octet-stream",
                    fileSize: selectedUploadFile.size,
                    lastModified: selectedUploadFile.lastModified || Date.now()
                };

                encryptedMetadataStr = await VaultCrypto.encryptJson(key, metadataObj, metadataIv);
                timing.encryptionMs = performance.now() - t0Enc;

                setStageState("encryption", "completed", timing.encryptionMs);
                setOverallProgress(18, "Client encryption complete. Requesting upload authorization...", "Ciphertext ready");

                // STAGE 2: FIREBASE AUTH & SIGNED UPLOAD AUTHORIZATION
                activeStageKey = "auth";
                setStageState("auth", "active");
                setOverallProgress(22, "Acquiring authorized upload signature from server...", "Authorizing");

                const t0Auth = performance.now();
                const signRes = await fetch("/api/documents/sign-upload", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                });

                signData = await signRes.json().catch(() => ({}));
                if (!signRes.ok || !signData.success) {
                    throw new Error(signData.message || "Failed to obtain authorized upload signature from server.");
                }

                timing.authSignatureMs = performance.now() - t0Auth;
                setStageState("auth", "completed", timing.authSignatureMs);
                setOverallProgress(30, "Cloud authorization verified. Streaming directly to Cloudinary...", "Starting stream");

                // STAGE 3: DIRECT CLOUDINARY UPLOAD (BROWSER TO CLOUDINARY VIA XHR)
                activeStageKey = "upload";
                setStageState("upload", "active");

                const t0Upload = performance.now();
                const uploadFormData = new FormData();
                const encryptedBlob = new Blob([encryptedFileArrayBuffer], { type: "application/octet-stream" });
                uploadFormData.append("file", encryptedBlob, "encrypted_payload.enc");
                uploadFormData.append("api_key", signData.apiKey);
                uploadFormData.append("timestamp", signData.timestamp);
                uploadFormData.append("public_id", signData.publicId);
                uploadFormData.append("type", signData.type);
                uploadFormData.append("signature", signData.signature);

                let lastLoadedBytes = 0;
                let lastProgressTime = performance.now();
                let rollingSpeed = 0;

                cloudinaryResult = await uploadDirectToCloudinary(
                    signData.uploadUrl,
                    uploadFormData,
                    (loaded, total) => {
                        const now = performance.now();
                        const deltaSec = (now - lastProgressTime) / 1000;
                        if (deltaSec >= 0.4) {
                            const bytesDelta = loaded - lastLoadedBytes;
                            rollingSpeed = bytesDelta / deltaSec;
                            lastLoadedBytes = loaded;
                            lastProgressTime = now;
                        }

                        const pctFraction = total > 0 ? (loaded / total) : 0;
                        const overallPct = Math.min(80, Math.round(30 + pctFraction * 50));
                        const speedText = rollingSpeed > 0 ? `${formatBytes(rollingSpeed)}/s` : "";
                        const stats = `${formatBytes(loaded)} / ${formatBytes(total)} (${Math.round(pctFraction * 100)}%) ${speedText ? `• ${speedText}` : ""}`;
                        setOverallProgress(overallPct, `Direct upload to Cloudinary: ${Math.round(pctFraction * 100)}%`, stats);
                    }
                );

                timing.cloudinaryUploadMs = performance.now() - t0Upload;
                setStageState("upload", "completed", timing.cloudinaryUploadMs);
                setOverallProgress(80, "Encrypted payload stored in Cloudinary authenticated storage.", "Storage complete");

                // Save to retry cache in case MongoDB save or blockchain step fails
                pendingCloudinaryUpload = {
                    fileName: selectedUploadFile.name,
                    fileSize: selectedUploadFile.size,
                    password: inMemoryVaultPassword,
                    cloudinaryResult,
                    signData,
                    encryptedFileArrayBuffer,
                    salt,
                    fileIv,
                    metadataIv,
                    encryptedMetadataStr
                };
            }

            // STAGE 4 (OPTIONAL): ETHEREUM SEPOLIA BLOCKCHAIN ANCHORING
            let blockchainProofData = null;
            if (isAdvance) {
                activeStageKey = "blockchain";
                setStageState("blockchain", "active");
                setOverallProgress(82, "Awaiting MetaMask confirmation...", "MetaMask popup");

                const t0Chain = performance.now();
                if (!blockchainPrepPromise) {
                    throw new Error("MetaMask initialization failed.");
                }

                // Instantly consume pre-fetched preparation from parallel step
                const { signingAccount, prepData, targetName } = await blockchainPrepPromise;
                const netLabel = targetName || (prepData.network === "ganache" ? "Ganache Local" : "Ethereum Sepolia");

                setOverallProgress(85, `Confirm transaction in MetaMask popup on ${netLabel}...`, "Awaiting approval");
                showModalAlert(`MetaMask popup opened: Confirm the transaction on ${netLabel} to anchor proof.`, "info");

                let rawTxHash = null;
                try {
                    rawTxHash = await window.ethereum.request({
                        method: "eth_sendTransaction",
                        params: [{
                            from: signingAccount,
                            to: prepData.contractAddress,
                            data: prepData.txData,
                            gas: "0x7a120"
                        }]
                    });
                } catch (txErr) {
                    const isRejection = txErr.code === 4001 || (txErr.message && txErr.message.includes("rejected"));
                    throw new Error(isRejection ? "Transaction was rejected in MetaMask." : (txErr.message || "Blockchain transaction failed."));
                }

                setOverallProgress(88, `Proof broadcast on ${netLabel} (${rawTxHash.slice(0, 10)}...)`, "Transaction broadcast");

                // Fast receipt check (check immediately on attempt 0, fast 80ms polling on Ganache)
                let receipt = null;
                const isGan = (prepData.network || vaultDocProofNetwork) === "ganache";
                const pollDelay = isGan ? 80 : 800;
                for (let attempt = 0; attempt < 3; attempt++) {
                    try {
                        receipt = await window.ethereum.request({
                            method: "eth_getTransactionReceipt",
                            params: [rawTxHash]
                        });
                        if (receipt && receipt.blockNumber) break;
                    } catch (rErr) {}
                    if (attempt < 2) await new Promise(r => setTimeout(r, pollDelay));
                }

                blockchainProofData = {
                    enabled: true,
                    transactionHash: rawTxHash,
                    blockNumber: receipt && receipt.blockNumber ? parseInt(receipt.blockNumber, 16) || null : null,
                    contractAddress: prepData.contractAddress,
                    docCertId: prepData.docCertId,
                    docHash: prepData.docHash,
                    network: prepData.network || vaultDocProofNetwork,
                    issuerAddress: signingAccount
                };

                timing.blockchainAnchorMs = performance.now() - t0Chain;
                setStageState("blockchain", "completed", timing.blockchainAnchorMs);
            }

            // STAGE 5: SECURE MONGODB METADATA PERSISTENCE
            activeStageKey = "persistence";
            setStageState("persistence", "active");
            setOverallProgress(90, "Recording zero-knowledge metadata in MongoDB Atlas...", "Persisting metadata");

            const t0Mongo = performance.now();
            const targetExistingDocId = modalExistingDocId && modalExistingDocId.value ? modalExistingDocId.value.trim() : undefined;
            const recordBody = {
                cloudinaryPublicId: (cloudinaryResult && cloudinaryResult.public_id) || signData.publicId,
                cloudinaryAssetId: (cloudinaryResult && cloudinaryResult.asset_id) || null,
                cloudinaryBytes: (cloudinaryResult && cloudinaryResult.bytes) || encryptedFileArrayBuffer.byteLength,
                salt: VaultCrypto.bufferToHex(salt),
                fileIv: VaultCrypto.bufferToHex(fileIv),
                metadataIv: VaultCrypto.bufferToHex(metadataIv),
                encryptedMetadata: encryptedMetadataStr,
                categoryTag: docCategorySelect.value || "all",
                draftId: modalDraftId.value || undefined,
                existingDocId: targetExistingDocId,
                blockchainProof: blockchainProofData,
                vaultId: activeVaultId || "default"
            };

            const recordRes = await fetch("/api/documents/record", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(recordBody)
            });

            const recordData = await recordRes.json().catch(() => ({}));
            if (!recordRes.ok || !recordData.success) {
                throw new Error(recordData.message || "Failed to persist document metadata in database.");
            }

            // Clear partial-retry cache and repair ID on complete success
            pendingCloudinaryUpload = null;
            if (modalExistingDocId) modalExistingDocId.value = "";

            timing.mongoRecordMs = performance.now() - t0Mongo;
            timing.totalMs = performance.now() - timing.startTotal;

            setStageState("persistence", "completed", timing.mongoRecordMs);
            setOverallProgress(100, "All stages completed successfully!", `Total: ${(timing.totalMs / 1000).toFixed(2)}s`);

            // SAFE DIAGNOSTIC TIMING LOGS (Never logs sensitive data)
            console.log("[Vault Upload Performance Report]", {
                stage1_client_encryption_ms: Math.round(timing.encryptionMs),
                stage2_auth_and_signature_ms: Math.round(timing.authSignatureMs),
                stage3_cloudinary_direct_upload_ms: Math.round(timing.cloudinaryUploadMs),
                stage4_blockchain_anchor_ms: timing.blockchainAnchorMs !== null ? Math.round(timing.blockchainAnchorMs) : null,
                stage5_mongo_persistence_ms: Math.round(timing.mongoRecordMs),
                total_save_duration_ms: Math.round(timing.totalMs),
                raw_file_bytes: selectedUploadFile.size,
                ciphertext_bytes: encryptedFileArrayBuffer.byteLength
            });

            await new Promise(r => setTimeout(r, 600));
            uploadModal.style.display = "none";
            const successMsg = isAdvance
                ? `Document encrypted, uploaded directly to Cloudinary, and anchored on Ethereum Sepolia! Tx: ${blockchainProofData.transactionHash.slice(0, 10)}...`
                : "Document encrypted and uploaded directly to Cloudinary Secure Vault successfully!";
            showVaultAlert(successMsg, "success");
            loadVaultDocuments();

        } catch (err) {
            console.error("[Upload Error]", err);
            setStageState(activeStageKey, "error");
            showModalAlert(err.message || "Upload failed. Please check your network and try again.", "danger");
            if (uploadProgressStatus) {
                uploadProgressStatus.textContent = "Upload failed: " + (err.message || "Error");
                uploadProgressStatus.style.color = "#dc2626";
            }
        } finally {
            isUploading = false;
            if (submitNormalUploadBtn) {
                submitNormalUploadBtn.disabled = false;
                submitNormalUploadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up" style="color: #0284c7;"></i> <span>Save Normally</span>';
            }
            if (submitAdvanceUploadBtn) {
                submitAdvanceUploadBtn.disabled = false;
                submitAdvanceUploadBtn.innerHTML = '<i class="fa-solid fa-shield-halved"></i> <span>Advance Security (Sepolia)</span>';
            }
            if (saveDraftBtn) {
                saveDraftBtn.disabled = false;
            }
            if (closeUploadModalBtn) {
                closeUploadModalBtn.disabled = false;
            }
        }
    }

    // Button event listeners
    if (submitNormalUploadBtn) {
        submitNormalUploadBtn.addEventListener("click", () => executeDocumentUpload("normal"));
    }
    if (submitAdvanceUploadBtn) {
        submitAdvanceUploadBtn.addEventListener("click", () => executeDocumentUpload("advance"));
    }
    if (vaultUploadForm) {
        vaultUploadForm.addEventListener("submit", (e) => {
            e.preventDefault();
            executeDocumentUpload("normal");
        });
    }

    // Multi-Vault Selection and Creation Event Handlers
    if (vaultSelectDropdown) {
        vaultSelectDropdown.addEventListener("change", () => {
            activeVaultId = vaultSelectDropdown.value || "default";
            console.log("[Vaults] Switched active vault to:", activeVaultId);
            loadVaultDocuments();
        });
    }

    if (btnOpenCreateVaultModal && createVaultModal) {
        btnOpenCreateVaultModal.addEventListener("click", () => {
            createVaultModal.classList.add("active");
            createVaultModal.style.display = "flex";
            if (newVaultNameInput) {
                newVaultNameInput.value = "";
                newVaultNameInput.focus();
            }
        });
    }

    if (closeCreateVaultModalBtn && createVaultModal) {
        closeCreateVaultModalBtn.addEventListener("click", () => {
            createVaultModal.classList.remove("active");
            createVaultModal.style.display = "none";
        });
    }

    if (createVaultForm) {
        createVaultForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const name = (newVaultNameInput.value || "").trim();
            if (!name) return;

            const submitBtn = document.getElementById("btnSubmitNewVault");
            if (submitBtn) submitBtn.disabled = true;

            try {
                const token = await getFirebaseToken();
                const res = await fetch("/api/documents/vaults", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({ name })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || "Failed to create vault.");
                }

                // Auto-switch to newly created vault
                if (data.vault && data.vault.vaultId) {
                    activeVaultId = data.vault.vaultId;
                }

                if (createVaultModal) {
                    createVaultModal.classList.remove("active");
                    createVaultModal.style.display = "none";
                }

                showVaultAlert(`Vault "${name}" created successfully.`, "success");
                loadVaultDocuments();
            } catch (err) {
                showVaultAlert(err.message, "danger");
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // Initialize category sync on page load
    syncCategoryFromUrl();

})();
