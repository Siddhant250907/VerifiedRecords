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

    // Certification Field Combobox Elements [Search, Options, Other]
    const certTypeSearchInput = document.getElementById("certTypeSearchInput");
    const certificateTypeHidden = document.getElementById("certificateType");
    const certComboboxWrapper = document.getElementById("certComboboxWrapper");
    const groupCertType = document.getElementById("groupCertType");
    const toggleCertDropdownBtn = document.getElementById("toggleCertDropdownBtn");
    const clearCertTypeBtn = document.getElementById("clearCertTypeBtn");
    const certDropdownChevron = document.getElementById("certDropdownChevron");
    const certOptionsDropdown = document.getElementById("certOptionsDropdown");
    const certOptionsScrollable = document.getElementById("certOptionsScrollable");
    const certDropdownBadge = document.getElementById("certDropdownBadge");
    const certTypeDisplayIcon = document.getElementById("certTypeDisplayIcon");
    const customCertTypeBox = document.getElementById("customCertTypeBox");
    const customCertificateType = document.getElementById("customCertificateType");
    const groupCustomCertType = document.getElementById("groupCustomCertType");
    const clearCustomCertTypeBtn = document.getElementById("clearCustomCertTypeBtn");

    const groupStudentName = document.getElementById("groupStudentName");
    const groupRollNumber = document.getElementById("groupRollNumber");
    const groupCourse = document.getElementById("groupCourse");
    const groupCertificateId = document.getElementById("groupCertificateId");
    const groupIssueDate = document.getElementById("groupIssueDate");

    const issueButton = document.getElementById("issueButton");
    const issueBtnIcon = document.getElementById("issueBtnIcon");
    const issueBtnText = document.getElementById("issueBtnText");
    const registrarIssueBtn = document.getElementById("registrarIssueBtn");
    const registrarBtnIcon = document.getElementById("registrarBtnIcon");
    const registrarBtnText = document.getElementById("registrarBtnText");
    const resetButton = document.getElementById("resetButton");
    const messageElement = document.getElementById("message");

    const issuanceSuccessCard = document.getElementById("issuanceSuccessCard");
    const confirmStudentName = document.getElementById("confirmStudentName");
    const confirmRollNumber = document.getElementById("confirmRollNumber");
    const confirmCertId = document.getElementById("confirmCertId");
    const confirmCourse = document.getElementById("confirmCourse");
    const confirmCertType = document.getElementById("confirmCertType");
    const confirmIssueDate = document.getElementById("confirmIssueDate");
    const confirmTxItem = document.getElementById("confirmTxItem");
    const confirmTxHash = document.getElementById("confirmTxHash");
    const adminWalletBadge = document.getElementById("adminWalletBadge");
    const adminWalletAccount = document.getElementById("adminWalletAccount");
    const verifyLink = document.getElementById("verifyLink");
    const issueAnotherButton = document.getElementById("issueAnotherButton");

    // Network Selector DOM Elements
    const networkSelectorCard = document.getElementById("networkSelectorCard");
    const btnNetSepolia = document.getElementById("btnNetSepolia");
    const btnNetGanache = document.getElementById("btnNetGanache");
    const netActiveName = document.getElementById("netActiveName");
    const netActiveChainId = document.getElementById("netActiveChainId");
    const netActiveContract = document.getElementById("netActiveContract");
    const copyContractBtn = document.getElementById("copyContractBtn");
    const copyContractIcon = document.getElementById("copyContractIcon");
    const netActiveStatus = document.getElementById("netActiveStatus");
    const netActiveStatusText = document.getElementById("netActiveStatusText");
    const networkHostedNotice = document.getElementById("networkHostedNotice");
    const networkHostedNoticeText = document.getElementById("networkHostedNoticeText");
    const netInsufficientFundsBanner = document.getElementById("netInsufficientFundsBanner");
    const btnSwitchToGanacheFallback = document.getElementById("btnSwitchToGanacheFallback");
    const netAccountName = document.getElementById("netAccountName");
    const netAccountAddr = document.getElementById("netAccountAddr");
    const switchMetaMaskAccountBtn = document.getElementById("switchMetaMaskAccountBtn");

    const KNOWN_NETWORK_DEFAULTS = {
        sepolia: {
            address: "0x1FC04CfBF2f7B0F32AEBecd17880afeb38BFacC7",
            name: "Verified Records Sepolia",
            chainHex: "0xaa36a7",
            chainNum: 11155111,
            label: "Ethereum Sepolia"
        },
        ganache: {
            address: "0x9317939Ea9f3369C83776517f0549DC4552c2931",
            name: "Siddhant Personal account",
            chainHex: "0x539",
            chainNum: 1337,
            label: "Ganache Local"
        }
    };
    const EXPECTED_NETWORK_ACCOUNTS = KNOWN_NETWORK_DEFAULTS;

    const PREFERRED_NETWORK_KEY = "preferred_blockchain_network";
    let selectedNetwork = "sepolia";
    try {
        selectedNetwork = localStorage.getItem(PREFERRED_NETWORK_KEY) || "sepolia";
    } catch (e) {
        selectedNetwork = "sepolia";
    }

    let isProcessing = false;
    let connectedMetaMaskAccount = null;
    let currentTransactionPrep = null;

    // Comprehensive list of certification fields with standard options and 'Other'
    const CERTIFICATION_FIELDS = [
        {
            id: "webinar",
            name: "Webinar",
            icon: "fa-video",
            badge: "Webinar",
            desc: "Online interactive technical or academic webinar session"
        },
        {
            id: "seminar",
            name: "Seminar",
            icon: "fa-users-line",
            badge: "Seminar",
            desc: "Institutional lecture, symposium, or conference seminar"
        },
        {
            id: "excellence",
            name: "Certificate of Excellence",
            icon: "fa-crown",
            badge: "Excellence",
            desc: "Highest distinction in academic or extracurricular achievements"
        },
        {
            id: "participation",
            name: "Certificate of Participation",
            icon: "fa-certificate",
            badge: "Participation",
            desc: "Official recognition of active attendance and contribution"
        },
        {
            id: "annual",
            name: "Annual Certification",
            icon: "fa-calendar-check",
            badge: "Annual",
            desc: "Yearly institutional credential or milestone recognition"
        },
        {
            id: "workshop",
            name: "Workshop Certification",
            icon: "fa-screwdriver-wrench",
            badge: "Workshop",
            desc: "Hands-on practical skills development and training"
        },
        {
            id: "course",
            name: "Course Completion",
            icon: "fa-graduation-cap",
            badge: "Academic",
            desc: "Successful completion of prescribed academic syllabus"
        },
        {
            id: "hackathon",
            name: "Hackathon & Competition",
            icon: "fa-laptop-code",
            badge: "Competitive",
            desc: "Coding sprint, technical hackathon, or algorithmic contest"
        },
        {
            id: "degree",
            name: "Academic Degree / Diploma",
            icon: "fa-building-columns",
            badge: "Degree",
            desc: "Official university undergraduate or postgraduate degree"
        },
        {
            id: "merit",
            name: "Merit & Honor Award",
            icon: "fa-medal",
            badge: "Honors",
            desc: "Special commendation for meritorious academic performance"
        },
        {
            id: "internship",
            name: "Internship Certificate",
            icon: "fa-briefcase",
            badge: "Industry",
            desc: "Practical industry experience and apprenticeship completion"
        },
        {
            id: "symposium",
            name: "Technical Symposium",
            icon: "fa-microchip",
            badge: "Conference",
            desc: "Research presentation and tech symposium participation"
        },
        {
            id: "research",
            name: "Research & Publication",
            icon: "fa-book-journal-whills",
            badge: "Research",
            desc: "Scholarly research contribution and verified publication"
        },
        {
            id: "other",
            name: "Other (Specify Custom Type)",
            icon: "fa-pen-to-square",
            badge: "Custom Input",
            desc: "Specify any unique or specialized certification domain"
        }
    ];

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

        // Initialize Dual Blockchain Network Selector
        initNetworkSelector();

        // Initialize Admin Security Gate (MongoDB Auth)
        initAdminSecurityGate();
    });

    // ----------------------------------------------------------------------
    // 2B. METAMASK STATUS CHECK & LISTENERS
    // (Hidden prior to authentication; only revealed if authenticated admin opts in)
    // ----------------------------------------------------------------------
    let isWalletDetailsVisible = false;

    async function checkMetaMaskWallet() {
        if (typeof window.ethereum === "undefined") {
            if (adminWalletAccount) {
                adminWalletAccount.textContent = "Unavailable (Using Node)";
            }
            updateWalletBadge(null);
            updateAccountAndPermissionsDisplay(null);
            return;
        }

        try {
            const accounts = await window.ethereum.request({ method: "eth_accounts" });
            if (accounts && accounts.length > 0) {
                connectedMetaMaskAccount = accounts[0];
            } else {
                connectedMetaMaskAccount = null;
            }
            await updateAccountAndPermissionsDisplay(connectedMetaMaskAccount);

            // Listeners for account, chain switch or disconnect (Decoupled from network selector)
            window.ethereum.on("accountsChanged", async function (newAccounts) {
                console.log("[MetaMask Event] accountsChanged:", newAccounts);
                currentTransactionPrep = null; // Invalidate stale transaction preparation
                if (newAccounts && newAccounts.length > 0) {
                    connectedMetaMaskAccount = newAccounts[0];
                } else {
                    connectedMetaMaskAccount = null;
                }
                await updateAccountAndPermissionsDisplay(connectedMetaMaskAccount);
            });

            window.ethereum.on("chainChanged", async function (chainIdHex) {
                console.log("[MetaMask Event] chainChanged:", chainIdHex);
                currentTransactionPrep = null; // Invalidate stale transaction preparation
                const accounts = await window.ethereum.request({ method: "eth_accounts" }).catch(() => []);
                connectedMetaMaskAccount = (accounts && accounts.length > 0) ? accounts[0] : null;
                await updateAccountAndPermissionsDisplay(connectedMetaMaskAccount);
            });

            window.ethereum.on("disconnect", function (error) {
                console.log("[MetaMask Event] disconnect:", error);
                currentTransactionPrep = null;
                connectedMetaMaskAccount = null;
                updateAccountAndPermissionsDisplay(null);
            });

        } catch (err) {
            console.warn("MetaMask detection error:", err);
        }
    }

    /**
     * Dynamically updates the connected account badge and address in the network card
     * by querying real-time on-chain authorization for the active network.
     */
    async function updateAccountAndPermissionsDisplay(account, targetConfig = null) {
        connectedMetaMaskAccount = account || null;
        const config = targetConfig || cachedConfigs[selectedNetwork] || null;

        if (!account) {
            if (netAccountName) {
                netAccountName.textContent = "Not Connected";
                netAccountName.className = "account-name-badge offline";
            }
            if (netAccountAddr) {
                netAccountAddr.textContent = "Connect MetaMask";
                netAccountAddr.title = "No active MetaMask account connected";
            }
            updateWalletBadge(null);
            return;
        }

        const shortAddr = account.slice(0, 6) + "..." + account.slice(-4);
        if (netAccountAddr) {
            netAccountAddr.textContent = shortAddr;
            netAccountAddr.title = account;
        }

        const net = config ? config.network : (selectedNetwork || "sepolia");
        try {
            const [authRes, ownerRes] = await Promise.all([
                fetch(`/api/blockchain/is-authorized?address=${encodeURIComponent(account)}&network=${encodeURIComponent(net)}`).then(r => r.json()).catch(() => ({})),
                fetch(`/api/blockchain/is-owner?address=${encodeURIComponent(account)}&network=${encodeURIComponent(net)}`).then(r => r.json()).catch(() => ({}))
            ]);

            const isOwner = Boolean(ownerRes && ownerRes.isOwner);
            const isAuthorized = Boolean(authRes && authRes.authorized) || isOwner;

            if (netAccountName) {
                if (isOwner) {
                    netAccountName.textContent = "Contract Owner";
                    netAccountName.className = "account-name-badge owner";
                } else if (isAuthorized) {
                    netAccountName.textContent = "Authorized Issuer";
                    netAccountName.className = "account-name-badge authorized";
                } else {
                    netAccountName.textContent = "Unauthorized Account";
                    netAccountName.className = "account-name-badge unauthorized";
                }
            }

            updateWalletBadge(account, isOwner ? "Owner" : (isAuthorized ? "Authorized" : "Unauthorized"));
        } catch (err) {
            console.warn("[Account Display] Warning inspecting account permissions:", err);
            if (netAccountName) {
                netAccountName.textContent = "Connected";
                netAccountName.className = "account-name-badge";
            }
            updateWalletBadge(account, "Connected");
        }
    }

    function updateWalletBadge(account, roleLabel = null) {
        if (adminWalletAccount) {
            if (account) {
                const shortAddr = account.slice(0, 6) + "..." + account.slice(-4);
                const rolePrefix = roleLabel ? `${roleLabel}: ` : "";
                adminWalletAccount.textContent = `${rolePrefix}${shortAddr}`;
                adminWalletAccount.title = account;
            } else if (typeof window.ethereum === "undefined") {
                adminWalletAccount.textContent = "Unavailable (Using Node)";
            } else {
                adminWalletAccount.textContent = "Not Connected";
            }
        }
        // Never show before authentication; only show if authenticated admin has opted in
        const session = getAdminSession();
        const isAuthenticated = Boolean(session && session.adminUserId);
        if (adminWalletBadge) {
            adminWalletBadge.style.display = (isAuthenticated && isWalletDetailsVisible) ? "inline-flex" : "none";
        }
    }

    // ----------------------------------------------------------------------
    // 2B. DUAL BLOCKCHAIN NETWORK CONTROLLER & AUTHORIZATION
    // ----------------------------------------------------------------------
    const cachedConfigs = {};

    function normalizeClientNetwork(net) {
        if (!net) return "sepolia";
        const n = String(net).toLowerCase().trim();
        if (n === "ganache" || n === "local" || n === "1337" || n === "5777") return "ganache";
        return "sepolia";
    }

    /**
     * Fetches public blockchain network and contract configuration from /api/blockchain/config.
     * Supports fetching for a specific network (sepolia or ganache).
     */
    async function fetchBlockchainConfig(network = null, forceRefresh = false) {
        const net = network ? normalizeClientNetwork(network) : (selectedNetwork || "sepolia");
        if (cachedConfigs[net] && !forceRefresh) {
            return cachedConfigs[net];
        }
        try {
            const res = await fetch(`/api/blockchain/config?network=${encodeURIComponent(net)}`);
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success) {
                cachedConfigs[net] = data;
                return data;
            }
            throw new Error(data.message || `Failed to load blockchain configuration for ${net}.`);
        } catch (err) {
            console.error(`[Blockchain Config] Error fetching /api/blockchain/config for [${net}]:`, err);
            throw err;
        }
    }

    /**
     * Updates the Network Selector UI cards and badges based on the loaded config.
     */
    function updateNetworkSelectorDisplay(config) {
        if (!config) return;

        if (netActiveName) {
            netActiveName.textContent = config.label || (config.network === "sepolia" ? "Ethereum Sepolia" : "Ganache Local");
        }
        if (netActiveChainId) {
            netActiveChainId.textContent = `${config.chainId} (${config.chainIdHex})`;
        }
        if (netActiveContract) {
            const addr = config.contractAddress || "Not Deployed";
            netActiveContract.textContent = addr;
            netActiveContract.title = addr;
        }

        if (netActiveStatus && netActiveStatusText) {
            if (config.isAvailable) {
                netActiveStatus.className = "network-status-badge ready";
                netActiveStatusText.textContent = "Ready for Transactions";
            } else {
                netActiveStatus.className = "network-status-badge offline";
                netActiveStatusText.textContent = config.statusMessage || "Ledger Offline";
            }
        }

        if (networkHostedNotice) {
            const isHosted = window.location.hostname.includes("onrender.com") || window.location.hostname.includes("render.com");
            if (!config.isAvailable || (isHosted && config.network === "ganache")) {
                networkHostedNotice.style.display = "flex";
                if (networkHostedNoticeText) {
                    networkHostedNoticeText.textContent = config.statusMessage ||
                        "Ganache Local is available only when the local Ganache node is accessible from the local development environment (http://localhost:3000).";
                }
            } else {
                networkHostedNotice.style.display = "none";
            }
        }

        // Keep connected account badge updated against the newly loaded network configuration
        updateAccountAndPermissionsDisplay(connectedMetaMaskAccount, config);
    }

    /**
     * Ensures MetaMask is connected to the selected network chain AND verifies whether
     * the active MetaMask account is authorized to perform transactions on that network.
     */
    async function ensureCorrectNetworkAndAccount(targetNetwork, requestAccountIfMismatch = true) {
        if (typeof window.ethereum === "undefined") {
            throw new Error("MetaMask is not installed or available.");
        }

        const net = normalizeClientNetwork(targetNetwork);
        const config = await fetchBlockchainConfig(net);

        // 1. Ensure correct chain
        await ensureCorrectNetwork(config);

        // 2. Fetch active accounts (read passive accounts first to avoid triggering duplicate popups)
        let accounts = await window.ethereum.request({ method: "eth_accounts" }).catch(() => []);
        if (requestAccountIfMismatch && (!accounts || accounts.length === 0)) {
            accounts = await window.ethereum.request({ method: "eth_requestAccounts" }).catch((err) => {
                console.warn("[MetaMask Accounts Request Notice]", err && err.message);
                return [];
            });
        }

        const activeAccount = accounts && accounts[0] ? accounts[0] : null;
        if (!activeAccount) {
            await updateAccountAndPermissionsDisplay(null, config);
            return { success: false, account: null, reason: "No active MetaMask account connected." };
        }

        // 3. Check actual on-chain issuer authorization and ownership for the active contract
        const [authCheck, ownerCheck] = await Promise.all([
            checkAccountAuthorization(activeAccount, config),
            checkContractOwnership(activeAccount, config)
        ]);

        const isOwner = Boolean(ownerCheck && ownerCheck.isOwner);
        const isAuthorized = Boolean(authCheck && authCheck.authorized) || isOwner;

        connectedMetaMaskAccount = activeAccount;
        await updateAccountAndPermissionsDisplay(activeAccount, config);

        if (isAuthorized) {
            return {
                success: true,
                account: activeAccount,
                isOwner: isOwner,
                authorized: true
            };
        }

        // 4. Account is not authorized: Provide clear diagnostic message and options
        console.warn(`[MetaMask Account] Account ${activeAccount} is unauthorized on ${config.label}.`);
        const shortConnected = activeAccount.slice(0, 6) + "..." + activeAccount.slice(-4);
        const ownerAddr = config.contractOwner || config.expectedIssuer || "Authorized Owner";
        const shortOwner = (ownerAddr && ownerAddr.length === 42) ? (ownerAddr.slice(0, 6) + "..." + ownerAddr.slice(-4)) : ownerAddr;

        showMessage(
            `<div style="font-weight: 700; margin-bottom: 6px;">` +
            `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Account Authorization Notice for ${escapeHtml(config.label || net.toUpperCase())}` +
            `</div>` +
            `<div style="font-size: 0.85rem; line-height: 1.5; margin-bottom: 10px; opacity: 0.95;">` +
            `Active MetaMask account is <strong class="mono">${escapeHtml(shortConnected)}</strong>, which is <strong>not authorized</strong> to issue certificates on the deployed ${escapeHtml(config.label)} contract.<br>` +
            `Contract Owner / Issuer: <strong class="mono">${escapeHtml(shortOwner)}</strong>.<br>` +
            `• <strong>Option 1 (Fast & Recommended):</strong> Click below to issue directly on-chain via the Institutional Registrar node — no wallet prompts or account switching needed!<br>` +
            `• <strong>Option 2 (MetaMask):</strong> Switch to the authorized account in MetaMask.` +
            `</div>` +
            `<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">` +
            `<button type="button" class="admin-registrar-btn" id="promptIssueViaRegistrarBtn" style="height: 36px; font-size: 12px; padding: 0 14px;">` +
            `<i class="fa-solid fa-bolt"></i> Issue Instantly via Direct Registrar (No Wallet Prompts)` +
            `</button>` +
            `<button type="button" class="admin-account-switch-btn" id="promptSwitchAccountBtn" style="height: 36px; font-size: 12px; padding: 0 14px; border-radius: 6px; border: 1px solid currentColor; background: rgba(255,255,255,0.15); cursor: pointer; color: inherit; font-weight: 700;">` +
            `<i class="fa-solid fa-wallet"></i> Change Account in MetaMask` +
            `</button>` +
            `</div>`,
            "warning"
        );

        const promptRegBtn = document.getElementById("promptIssueViaRegistrarBtn");
        if (promptRegBtn) {
            promptRegBtn.addEventListener("click", () => {
                issueCertificateDirectRegistrar();
            });
        }

        const promptSwBtn = document.getElementById("promptSwitchAccountBtn");
        if (promptSwBtn) {
            promptSwBtn.addEventListener("click", async () => {
                await requestAccountSwitch();
            });
        }

        return {
            success: false,
            account: activeAccount,
            expectedAddress: ownerAddr,
            reason: `Account ${shortConnected} is not authorized on ${config.label}.`
        };
    }

    /**
     * Switches the active network in the UI, stores in localStorage, and updates display.
     */
    async function selectNetwork(targetNetwork, skipPrompt = false) {
        const normalized = normalizeClientNetwork(targetNetwork);
        selectedNetwork = normalized;

        try {
            localStorage.setItem(PREFERRED_NETWORK_KEY, normalized);
        } catch (e) {}

        // Invalidate stale transaction preparation
        currentTransactionPrep = null;

        // Update pills UI
        if (btnNetSepolia) {
            const isSep = normalized === "sepolia";
            btnNetSepolia.classList.toggle("active", isSep);
            btnNetSepolia.setAttribute("aria-checked", isSep ? "true" : "false");
        }
        if (btnNetGanache) {
            const isGan = normalized === "ganache";
            btnNetGanache.classList.toggle("active", isGan);
            btnNetGanache.setAttribute("aria-checked", isGan ? "true" : "false");
        }

        // Hide insufficient funds banner on explicit switch
        if (netInsufficientFundsBanner) {
            netInsufficientFundsBanner.style.display = "none";
        }

        try {
            const config = await fetchBlockchainConfig(normalized, true);
            updateNetworkSelectorDisplay(config);

            // If MetaMask is available and not skipPrompt, request chain switch
            if (!skipPrompt && typeof window.ethereum !== "undefined") {
                await ensureCorrectNetwork(config).catch(err => {
                    console.warn("[Network Switch Notice]", err && err.message);
                });
            }

            // Re-read eth_accounts passively and refresh account permissions display
            if (typeof window.ethereum !== "undefined") {
                const accounts = await window.ethereum.request({ method: "eth_accounts" }).catch(() => []);
                const acc = (accounts && accounts.length > 0) ? accounts[0] : null;
                connectedMetaMaskAccount = acc;
                await updateAccountAndPermissionsDisplay(acc, config);
            }

            return config;
        } catch (err) {
            console.error("[Network Selector Update Error]", err);
            if (netActiveStatus) netActiveStatus.className = "network-status-badge offline";
            if (netActiveStatusText) netActiveStatusText.textContent = "Configuration Error";
            return null;
        }
    }

    /**
     * Initializes the Dual Blockchain Network Selector component.
     */
    function initNetworkSelector() {
        // Read persisted preference
        const persisted = localStorage.getItem(PREFERRED_NETWORK_KEY) || "sepolia";
        selectNetwork(persisted, true);

        if (btnNetSepolia) {
            btnNetSepolia.addEventListener("click", () => selectNetwork("sepolia", false));
        }
        if (btnNetGanache) {
            btnNetGanache.addEventListener("click", () => selectNetwork("ganache", false));
        }

        // Copy Contract Address button
        if (copyContractBtn && netActiveContract) {
            copyContractBtn.addEventListener("click", async () => {
                const text = netActiveContract.textContent.trim();
                if (text && text !== "Not Deployed") {
                    try {
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                            await navigator.clipboard.writeText(text);
                        }
                        if (copyContractIcon) {
                            copyContractIcon.className = "fa-solid fa-check";
                            setTimeout(() => { copyContractIcon.className = "fa-regular fa-copy"; }, 1500);
                        }
                    } catch (e) {
                        console.warn("Copy address failed:", e);
                    }
                }
            });
        }

        // Switch MetaMask Account button on card
        if (switchMetaMaskAccountBtn) {
            switchMetaMaskAccountBtn.addEventListener("click", async () => {
                try {
                    const newAcc = await requestAccountSwitch();
                    if (newAcc) {
                        const config = await fetchBlockchainConfig(selectedNetwork);
                        const [authCheck, ownerCheck] = await Promise.all([
                            checkAccountAuthorization(newAcc, config),
                            checkContractOwnership(newAcc, config)
                        ]);
                        const isAuth = authCheck.authorized || ownerCheck.isOwner;
                        const shortAddr = newAcc.slice(0, 6) + "..." + newAcc.slice(-4);
                        if (isAuth) {
                            showMessage(`Connected to <strong>${shortAddr}</strong> on <strong>${config.label}</strong>. Account is authorized!`, "success", 4000);
                        } else {
                            const expectedOwner = config.contractOwner || config.expectedIssuer || "contract owner";
                            const shortOwner = expectedOwner.length === 42 ? (expectedOwner.slice(0, 6) + "..." + expectedOwner.slice(-4)) : expectedOwner;
                            showMessage(
                                `<div style="font-weight: 700; margin-bottom: 4px;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Account Connected: <span class="mono">${shortAddr}</span></div>` +
                                `<div style="font-size: 0.85rem; line-height: 1.5; margin-bottom: 8px;">` +
                                `This account is <strong>not authorized</strong> to issue certificates on ${config.label}.<br>` +
                                `Authorized owner: <span class="mono">${shortOwner}</span>.<br>` +
                                `Please choose an authorized account in MetaMask, or use Direct Registrar Issuance.` +
                                `</div>`,
                                "warning"
                            );
                        }
                    }
                } catch (e) {
                    console.warn("[MetaMask Account Switch Error]", e);
                }
            });
        }

        // Insufficient funds fallback button
        if (btnSwitchToGanacheFallback) {
            btnSwitchToGanacheFallback.addEventListener("click", async () => {
                await selectNetwork("ganache", false);
                hideMessage();
            });
        }
    }

    /**
     * Ensures MetaMask is switched to the active network (Sepolia or Ganache).
     * Handles adding the network via wallet_addEthereumChain if missing.
     */
    async function ensureCorrectNetwork(targetConfig) {
        if (typeof window.ethereum === "undefined") {
            throw new Error("MetaMask extension is not available.");
        }

        const isSep = targetConfig.network === "sepolia" || targetConfig.isSepolia;
        const targetHex = isSep ? "0xaa36a7" : "0x539";
        const targetNum = isSep ? 11155111 : 1337;

        const currentChainId = await window.ethereum.request({ method: "eth_chainId" }).catch(() => null);
        const currentNum = currentChainId ? parseInt(currentChainId, 16) : null;

        // Check if already on the expected network
        const isMatch = isSep
            ? (currentChainId && currentChainId.toLowerCase() === "0xaa36a7") || currentNum === 11155111
            : (currentChainId && currentChainId.toLowerCase() === "0x539") || currentNum === 1337 || currentNum === 5777;

        if (isMatch) {
            return true;
        }

        console.log(`[MetaMask] Network mismatch: currently on chain ${currentChainId} (${currentNum}), expected ${targetHex} (${targetNum})`);

        try {
            await window.ethereum.request({
                method: "wallet_switchEthereumChain",
                params: [{ chainId: targetHex }]
            });
        } catch (switchError) {
            if (switchError.code === 4902 || (switchError.message && switchError.message.includes("wallet_addEthereumChain"))) {
                if (isSep) {
                    await window.ethereum.request({
                        method: "wallet_addEthereumChain",
                        params: [{
                            chainId: "0xaa36a7",
                            chainName: "Ethereum Sepolia Testnet",
                            nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
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
            } else {
                throw switchError;
            }
        }

        // Recheck selected chain after switching
        const verifyChainId = await window.ethereum.request({ method: "eth_chainId" }).catch(() => null);
        const verifyNum = verifyChainId ? parseInt(verifyChainId, 16) : null;
        const verifyMatch = isSep
            ? (verifyChainId && verifyChainId.toLowerCase() === "0xaa36a7") || verifyNum === 11155111
            : (verifyChainId && verifyChainId.toLowerCase() === "0x539") || verifyNum === 1337 || verifyNum === 5777;

        if (!verifyMatch) {
            throw new Error(`MetaMask network switch did not complete. Expected chain ${targetConfig.label || targetConfig.network} (${targetHex}), currently on ${verifyChainId || 'unknown'}.`);
        }

        return true;
    }

    /**
     * Checks if the given account is an authorized issuer on the active smart contract.
     */
    async function checkAccountAuthorization(account, targetConfig) {
        if (!account) {
            return { authorized: false, reason: "No account connected." };
        }

        const net = targetConfig.network || selectedNetwork || "sepolia";

        // Direct check against configured expected issuer or contract owner
        if (targetConfig.expectedIssuer && targetConfig.expectedIssuer.toLowerCase() === account.toLowerCase()) {
            return { authorized: true };
        }
        if (targetConfig.contractOwner && targetConfig.contractOwner.toLowerCase() === account.toLowerCase()) {
            return { authorized: true };
        }

        // Verify with server endpoint for target network
        try {
            const res = await fetch(`/api/blockchain/is-authorized?address=${encodeURIComponent(account)}&network=${encodeURIComponent(net)}`);
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.authorized) {
                return { authorized: true };
            }
        } catch (e) {
            console.warn("[Authorization] Server check notice:", e.message);
        }

        return {
            authorized: false,
            reason: `Connected account (${account.slice(0, 6)}...${account.slice(-4)}) is not an authorized issuer on the active ${targetConfig.label || net.toUpperCase()} smart contract.`
        };
    }

    /**
     * Checks if the given account is the owner of the active Certificate smart contract.
     */
    async function checkContractOwnership(account, targetConfig) {
        if (!account) return { isOwner: false, reason: "No account connected." };
        const net = targetConfig.network || selectedNetwork || "sepolia";
        const expectedOwner = targetConfig.contractOwner || targetConfig.expectedIssuer || "0x1FC04CfBF2f7B0F32AEBecd17880afeb38BFacC7";
        if (expectedOwner && expectedOwner.toLowerCase() === account.toLowerCase()) {
            return { isOwner: true, contractOwner: expectedOwner };
        }
        try {
            const res = await fetch(`/api/blockchain/is-owner?address=${encodeURIComponent(account)}&network=${encodeURIComponent(net)}`);
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.isOwner) {
                return { isOwner: true, contractOwner: data.contractOwner || expectedOwner };
            }
            return { isOwner: false, contractOwner: data.contractOwner || expectedOwner };
        } catch (e) {
            console.warn("[Ownership] Server check notice:", e.message);
        }
        return { isOwner: false, contractOwner: expectedOwner };
    }

    /**
     * Prompts MetaMask account selector so user can switch to an authorized wallet.
     * Uses wallet_requestPermissions (EIP-2255) with fallback to eth_requestAccounts.
     * Re-queries eth_accounts immediately after the request finishes to verify the actual selection.
     */
    async function requestAccountSwitch() {
        if (typeof window.ethereum === "undefined") {
            showMessage("MetaMask is not installed or available.", "warning");
            return null;
        }

        currentTransactionPrep = null;

        try {
            // EIP-2255: Request permissions prompt which allows user to select or switch accounts
            await window.ethereum.request({
                method: "wallet_requestPermissions",
                params: [{ eth_accounts: {} }]
            });
        } catch (permErr) {
            console.warn("[MetaMask] wallet_requestPermissions:", permErr && permErr.message);
            // If user did not reject explicitly and permission request failed, try eth_requestAccounts
            if (permErr && permErr.code !== 4001) {
                try {
                    await window.ethereum.request({ method: "eth_requestAccounts" });
                } catch (accErr) {
                    console.warn("[MetaMask] eth_requestAccounts fallback notice:", accErr && accErr.message);
                }
            }
        }

        // Always re-query eth_accounts afterward to capture the actual user-selected account
        const accounts = await window.ethereum.request({ method: "eth_accounts" }).catch(() => []);
        const active = (accounts && accounts.length > 0) ? accounts[0] : null;
        connectedMetaMaskAccount = active;
        await updateAccountAndPermissionsDisplay(active);
        return active;
    }

    function isGanacheChain(chainId) {
        if (!chainId) return false;
        const dec = parseInt(chainId, 16);
        return dec === 1337 || dec === 5777;
    }

    // ----------------------------------------------------------------------
    // 2C. CERTIFICATION FIELD COMBOBOX CONTROLLER [SEARCH, OPTIONS, OTHER]
    // ----------------------------------------------------------------------
    let activeHighlightIndex = -1;

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function renderCertTypeOptions(query = "") {
        if (!certOptionsScrollable) return;

        const cleanQuery = query.toLowerCase().trim();
        const activeVal = certificateTypeHidden ? certificateTypeHidden.value : "";

        const matched = CERTIFICATION_FIELDS.filter(field => {
            if (!cleanQuery) return true;
            return (
                field.name.toLowerCase().includes(cleanQuery) ||
                field.badge.toLowerCase().includes(cleanQuery) ||
                field.desc.toLowerCase().includes(cleanQuery) ||
                field.id.toLowerCase().includes(cleanQuery)
            );
        });

        certOptionsScrollable.innerHTML = "";
        activeHighlightIndex = -1;

        if (certDropdownBadge) {
            certDropdownBadge.textContent = `${matched.length} option${matched.length === 1 ? "" : "s"}`;
        }

        if (matched.length === 0) {
            const emptyEl = document.createElement("div");
            emptyEl.className = "cert-option-empty";
            emptyEl.innerHTML = `
                <i class="fa-solid fa-magnifying-glass"></i>
                <span>No presets matching "<strong>${escapeHtml(query)}</strong>"</span>
                <button type="button" class="cert-option-use-custom-btn" id="useCustomTypedBtn">
                    <i class="fa-solid fa-pen-nib"></i> Set "${escapeHtml(query)}" as custom field
                </button>
            `;
            certOptionsScrollable.appendChild(emptyEl);

            const useCustomBtn = emptyEl.querySelector("#useCustomTypedBtn");
            if (useCustomBtn) {
                useCustomBtn.addEventListener("click", function (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    selectCertType({
                        id: "other",
                        name: "Other (Specify Custom Type)",
                        icon: "fa-pen-to-square"
                    });
                    if (customCertificateType) {
                        customCertificateType.value = query;
                        if (clearCustomCertTypeBtn) clearCustomCertTypeBtn.style.display = "flex";
                        if (groupCustomCertType) groupCustomCertType.classList.remove("input-error");
                    }
                });
            }
            return;
        }

        matched.forEach((opt, idx) => {
            const isOther = opt.id === "other";
            const isSelected = activeVal === opt.name || (isOther && activeVal === "Other");

            const itemEl = document.createElement("div");
            itemEl.className = `cert-option-item${isOther ? " is-other" : ""}${isSelected ? " selected" : ""}`;
            itemEl.setAttribute("role", "option");
            itemEl.setAttribute("tabindex", "-1");
            itemEl.dataset.id = opt.id;
            itemEl.dataset.name = opt.name;
            itemEl.dataset.icon = opt.icon;

            itemEl.innerHTML = `
                <div class="cert-option-left">
                    <div class="cert-option-icon-wrap" aria-hidden="true">
                        <i class="fa-solid ${opt.icon}"></i>
                    </div>
                    <div class="cert-option-info">
                        <span class="cert-option-name">${escapeHtml(opt.name)}</span>
                        <span class="cert-option-desc">${escapeHtml(opt.desc)}</span>
                    </div>
                </div>
                <span class="cert-option-badge">${escapeHtml(opt.badge)}</span>
            `;

            itemEl.addEventListener("click", function (e) {
                e.stopPropagation();
                selectCertType(opt);
            });

            itemEl.addEventListener("mouseenter", function () {
                highlightOption(idx);
            });

            certOptionsScrollable.appendChild(itemEl);
        });
    }

    function highlightOption(index) {
        if (!certOptionsScrollable) return;
        const items = certOptionsScrollable.querySelectorAll(".cert-option-item");
        if (items.length === 0) return;

        items.forEach((item, i) => {
            if (i === index) {
                item.classList.add("focused");
                item.scrollIntoView({ block: "nearest", behavior: "smooth" });
                activeHighlightIndex = i;
            } else {
                item.classList.remove("focused");
            }
        });
    }

    function openCertDropdown() {
        if (!certOptionsDropdown || !certComboboxWrapper) return;
        certComboboxWrapper.classList.add("dropdown-open");
        certOptionsDropdown.style.display = "block";

        const currentSearch = certTypeSearchInput ? certTypeSearchInput.value.trim() : "";
        const activeVal = certificateTypeHidden ? certificateTypeHidden.value.trim() : "";

        // If the search input exactly reflects the selected option name, show all options initially
        if (currentSearch && (currentSearch === activeVal || (activeVal === "Other" && currentSearch.startsWith("Other")))) {
            renderCertTypeOptions("");
        } else {
            renderCertTypeOptions(currentSearch);
        }
    }

    function closeCertDropdown() {
        if (!certOptionsDropdown || !certComboboxWrapper) return;
        certComboboxWrapper.classList.remove("dropdown-open");
        certOptionsDropdown.style.display = "none";
        activeHighlightIndex = -1;
    }

    function selectCertType(opt) {
        if (!opt) return;

        if (opt.id === "other") {
            if (certTypeSearchInput) certTypeSearchInput.value = "Other (Specify Custom Type)";
            if (certificateTypeHidden) certificateTypeHidden.value = "Other";
            if (certTypeDisplayIcon) certTypeDisplayIcon.className = "fa-solid fa-pen-to-square";
            if (customCertTypeBox) {
                customCertTypeBox.style.display = "block";
                setTimeout(() => {
                    if (customCertificateType) customCertificateType.focus();
                }, 50);
            }
        } else {
            if (certTypeSearchInput) certTypeSearchInput.value = opt.name;
            if (certificateTypeHidden) certificateTypeHidden.value = opt.name;
            if (certTypeDisplayIcon) certTypeDisplayIcon.className = `fa-solid ${opt.icon || "fa-award"}`;
            if (customCertTypeBox) customCertTypeBox.style.display = "none";
            if (customCertificateType) customCertificateType.value = "";
            if (clearCustomCertTypeBtn) clearCustomCertTypeBtn.style.display = "none";
        }

        if (clearCertTypeBtn) clearCertTypeBtn.style.display = "flex";
        if (groupCertType) groupCertType.classList.remove("input-error");
        if (groupCustomCertType) groupCustomCertType.classList.remove("input-error");

        closeCertDropdown();
    }

    function resetCertTypeSelection() {
        if (certTypeSearchInput) certTypeSearchInput.value = "";
        if (certificateTypeHidden) certificateTypeHidden.value = "";
        if (customCertificateType) customCertificateType.value = "";
        if (customCertTypeBox) customCertTypeBox.style.display = "none";
        if (clearCertTypeBtn) clearCertTypeBtn.style.display = "none";
        if (clearCustomCertTypeBtn) clearCustomCertTypeBtn.style.display = "none";
        if (certTypeDisplayIcon) certTypeDisplayIcon.className = "fa-solid fa-award";
        if (groupCertType) groupCertType.classList.remove("input-error");
        if (groupCustomCertType) groupCustomCertType.classList.remove("input-error");
        closeCertDropdown();
    }

    // Combobox Event Listeners
    if (certTypeSearchInput) {
        certTypeSearchInput.addEventListener("focus", function () {
            openCertDropdown();
        });

        certTypeSearchInput.addEventListener("click", function () {
            openCertDropdown();
        });

        certTypeSearchInput.addEventListener("input", function () {
            const val = this.value;
            if (clearCertTypeBtn) {
                clearCertTypeBtn.style.display = val ? "flex" : "none";
            }
            if (groupCertType) {
                groupCertType.classList.remove("input-error");
            }
            // If user cleared text or started typing something else, clear the hidden value
            if (certificateTypeHidden && certificateTypeHidden.value !== "Other" && certificateTypeHidden.value !== val) {
                certificateTypeHidden.value = "";
            }
            openCertDropdown();
            renderCertTypeOptions(val);
        });

        certTypeSearchInput.addEventListener("keydown", function (e) {
            const isOpen = certOptionsDropdown && certOptionsDropdown.style.display === "block";

            if (e.key === "ArrowDown") {
                e.preventDefault();
                if (!isOpen) {
                    openCertDropdown();
                    return;
                }
                const items = certOptionsScrollable ? certOptionsScrollable.querySelectorAll(".cert-option-item") : [];
                if (items.length === 0) return;
                let nextIdx = activeHighlightIndex + 1;
                if (nextIdx >= items.length) nextIdx = 0;
                highlightOption(nextIdx);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (!isOpen) {
                    openCertDropdown();
                    return;
                }
                const items = certOptionsScrollable ? certOptionsScrollable.querySelectorAll(".cert-option-item") : [];
                if (items.length === 0) return;
                let prevIdx = activeHighlightIndex - 1;
                if (prevIdx < 0) prevIdx = items.length - 1;
                highlightOption(prevIdx);
            } else if (e.key === "Enter") {
                if (isOpen && activeHighlightIndex >= 0) {
                    e.preventDefault();
                    const items = certOptionsScrollable.querySelectorAll(".cert-option-item");
                    if (items[activeHighlightIndex]) {
                        items[activeHighlightIndex].click();
                    }
                }
            } else if (e.key === "Escape") {
                closeCertDropdown();
            }
        });
    }

    if (toggleCertDropdownBtn) {
        toggleCertDropdownBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (certOptionsDropdown && certOptionsDropdown.style.display === "block") {
                closeCertDropdown();
            } else {
                openCertDropdown();
                if (certTypeSearchInput) certTypeSearchInput.focus();
            }
        });
    }

    if (clearCertTypeBtn) {
        clearCertTypeBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            resetCertTypeSelection();
            if (certTypeSearchInput) certTypeSearchInput.focus();
        });
    }

    if (customCertificateType) {
        customCertificateType.addEventListener("input", function () {
            const val = this.value.trim();
            if (clearCustomCertTypeBtn) {
                clearCustomCertTypeBtn.style.display = val ? "flex" : "none";
            }
            if (groupCustomCertType) {
                groupCustomCertType.classList.remove("input-error");
            }
        });
    }

    if (clearCustomCertTypeBtn) {
        clearCustomCertTypeBtn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (customCertificateType) {
                customCertificateType.value = "";
                customCertificateType.focus();
            }
            clearCustomCertTypeBtn.style.display = "none";
        });
    }

    // Close dropdown on click outside
    document.addEventListener("click", function (e) {
        if (certComboboxWrapper && !certComboboxWrapper.contains(e.target)) {
            closeCertDropdown();
        }
    });

    // ----------------------------------------------------------------------
    // 2D. ADMIN SECURITY GATE CONTROLLER (LOGIN & REGISTRATION WITH MONGODB)
    // ----------------------------------------------------------------------
    const ADMIN_SESSION_KEY = "vr_admin_session";

    const adminGateCard = document.getElementById("adminGateCard");
    const adminFormCard = document.getElementById("adminFormCard");
    const tabAdminLogin = document.getElementById("tabAdminLogin");
    const tabAdminRegister = document.getElementById("tabAdminRegister");
    const adminGateAlert = document.getElementById("adminGateAlert");

    const adminLoginForm = document.getElementById("adminLoginForm");
    const adminAuthUserId = document.getElementById("adminAuthUserId");
    const adminAuthPassword = document.getElementById("adminAuthPassword");
    const toggleAuthPwdBtn = document.getElementById("toggleAuthPwdBtn");
    const toggleAuthPwdIcon = document.getElementById("toggleAuthPwdIcon");
    const adminLoginBtn = document.getElementById("adminLoginBtn");
    const adminLoginBtnIcon = document.getElementById("adminLoginBtnIcon");
    const adminLoginBtnText = document.getElementById("adminLoginBtnText");
    const switchToRegisterBtn = document.getElementById("switchToRegisterBtn");

    const adminRegisterForm = document.getElementById("adminRegisterForm");
    const adminCreateUserId = document.getElementById("adminCreateUserId");
    const adminCreatePassword = document.getElementById("adminCreatePassword");
    const adminCreateConfirmPassword = document.getElementById("adminCreateConfirmPassword");
    const toggleCreatePwdBtn = document.getElementById("toggleCreatePwdBtn");
    const toggleCreatePwdIcon = document.getElementById("toggleCreatePwdIcon");
    const toggleConfirmPwdBtn = document.getElementById("toggleConfirmPwdBtn");
    const toggleConfirmPwdIcon = document.getElementById("toggleConfirmPwdIcon");
    const adminRegisterBtn = document.getElementById("adminRegisterBtn");
    const adminRegisterBtnIcon = document.getElementById("adminRegisterBtnIcon");
    const adminRegisterBtnText = document.getElementById("adminRegisterBtnText");
    const switchToLoginBtn = document.getElementById("switchToLoginBtn");

    const adminIdBadge = document.getElementById("adminIdBadge");
    const activeAdminUserId = document.getElementById("activeAdminUserId");
    const lockAdminBtn = document.getElementById("lockAdminBtn");

    const adminWalletToggleWrap = document.getElementById("adminWalletToggleWrap");
    const toggleWalletDetailsBtn = document.getElementById("toggleWalletDetailsBtn");
    const toggleWalletText = document.getElementById("toggleWalletText");
    const toggleWalletChevron = document.getElementById("toggleWalletChevron");

    function getAdminSession() {
        try {
            const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
            if (raw) return JSON.parse(raw);
        } catch (e) {}
        return null;
    }

    function setAdminSession(admin) {
        if (!admin) return;
        try {
            sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(admin));
        } catch (e) {}
    }

    function clearAdminSession() {
        try {
            sessionStorage.removeItem(ADMIN_SESSION_KEY);
        } catch (e) {}
    }

    function updateAdminGateUI() {
        const session = getAdminSession();
        const isAuthenticated = Boolean(session && session.adminUserId);

        if (isAuthenticated) {
            if (adminGateCard) adminGateCard.style.display = "none";
            if (adminFormCard) adminFormCard.style.display = "block";
            if (adminIdBadge && activeAdminUserId) {
                activeAdminUserId.textContent = session.adminUserId;
                adminIdBadge.style.display = "inline-flex";
            }
            // Give user an option to show MetaMask detail AFTER authentication
            if (adminWalletToggleWrap) {
                adminWalletToggleWrap.style.display = "inline-flex";
            }
            if (adminWalletBadge) {
                adminWalletBadge.style.display = isWalletDetailsVisible ? "inline-flex" : "none";
            }
        } else {
            if (adminGateCard) adminGateCard.style.display = "block";
            if (adminFormCard) adminFormCard.style.display = "none";
            if (adminIdBadge) adminIdBadge.style.display = "none";
            // Hide MetaMask button and badge completely prior to authentication
            if (adminWalletToggleWrap) {
                adminWalletToggleWrap.style.display = "none";
            }
            if (adminWalletBadge) {
                adminWalletBadge.style.display = "none";
            }
            isWalletDetailsVisible = false;
            if (toggleWalletText) {
                toggleWalletText.textContent = "View MetaMask Details";
            }
            if (toggleWalletChevron) {
                toggleWalletChevron.className = "fa-solid fa-chevron-down";
            }
        }
    }

    function showGateAlert(message, type = "error") {
        if (!adminGateAlert) return;
        adminGateAlert.className = `admin-gate-alert ${type}`;
        const icon = type === "success" ? "fa-circle-check" : (type === "warning" ? "fa-triangle-exclamation" : "fa-circle-exclamation");
        adminGateAlert.innerHTML = `
            <i class="fa-solid ${icon}" aria-hidden="true" style="margin-top: 2px; flex-shrink: 0;"></i>
            <span>${message}</span>
        `;
        adminGateAlert.style.display = "flex";
    }

    function hideGateAlert() {
        if (!adminGateAlert) return;
        adminGateAlert.style.display = "none";
        adminGateAlert.innerHTML = "";
    }

    function switchGateTab(targetTab) {
        hideGateAlert();
        if (targetTab === "register") {
            if (tabAdminLogin) {
                tabAdminLogin.classList.remove("active");
                tabAdminLogin.setAttribute("aria-selected", "false");
            }
            if (tabAdminRegister) {
                tabAdminRegister.classList.add("active");
                tabAdminRegister.setAttribute("aria-selected", "true");
            }
            if (adminLoginForm) adminLoginForm.style.display = "none";
            if (adminRegisterForm) adminRegisterForm.style.display = "block";
            if (adminCreateUserId) adminCreateUserId.focus();
        } else {
            if (tabAdminRegister) {
                tabAdminRegister.classList.remove("active");
                tabAdminRegister.setAttribute("aria-selected", "false");
            }
            if (tabAdminLogin) {
                tabAdminLogin.classList.add("active");
                tabAdminLogin.setAttribute("aria-selected", "true");
            }
            if (adminRegisterForm) adminRegisterForm.style.display = "none";
            if (adminLoginForm) adminLoginForm.style.display = "block";
            if (adminAuthUserId) adminAuthUserId.focus();
        }
    }

    function setupPasswordToggle(inputEl, iconEl, btnEl) {
        if (!inputEl || !iconEl || !btnEl) return;
        btnEl.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (inputEl.type === "password") {
                inputEl.type = "text";
                iconEl.className = "fa-regular fa-eye-slash";
            } else {
                inputEl.type = "password";
                iconEl.className = "fa-regular fa-eye";
            }
        });
    }

    function initAdminSecurityGate() {
        // Setup password visibility toggles
        setupPasswordToggle(adminAuthPassword, toggleAuthPwdIcon, toggleAuthPwdBtn);
        setupPasswordToggle(adminCreatePassword, toggleCreatePwdIcon, toggleCreatePwdBtn);
        setupPasswordToggle(adminCreateConfirmPassword, toggleConfirmPwdIcon, toggleConfirmPwdBtn);

        // Tab click listeners
        if (tabAdminLogin) {
            tabAdminLogin.addEventListener("click", () => switchGateTab("login"));
        }
        if (tabAdminRegister) {
            tabAdminRegister.addEventListener("click", () => switchGateTab("register"));
        }
        if (switchToRegisterBtn) {
            switchToRegisterBtn.addEventListener("click", () => switchGateTab("register"));
        }
        if (switchToLoginBtn) {
            switchToLoginBtn.addEventListener("click", () => switchGateTab("login"));
        }

        // Lock button listener
        if (lockAdminBtn) {
            lockAdminBtn.addEventListener("click", function (e) {
                e.preventDefault();
                isWalletDetailsVisible = false;
                clearAdminSession();
                updateAdminGateUI();
                switchGateTab("login");
                showGateAlert("Admin session locked. Please re-authenticate.", "warning");
                if (adminAuthUserId) adminAuthUserId.focus();
            });
        }

        // Toggle MetaMask details listener (Authenticated only)
        if (toggleWalletDetailsBtn) {
            toggleWalletDetailsBtn.addEventListener("click", function (e) {
                e.preventDefault();
                isWalletDetailsVisible = !isWalletDetailsVisible;
                if (adminWalletBadge) {
                    adminWalletBadge.style.display = isWalletDetailsVisible ? "inline-flex" : "none";
                }
                if (toggleWalletText) {
                    toggleWalletText.textContent = isWalletDetailsVisible ? "Hide MetaMask Details" : "View MetaMask Details";
                }
                if (toggleWalletChevron) {
                    toggleWalletChevron.className = isWalletDetailsVisible ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down";
                }
            });
        }

        // 1. Admin Login Form Submission
        if (adminLoginForm) {
            adminLoginForm.addEventListener("submit", async function (e) {
                e.preventDefault();
                hideGateAlert();

                const userId = (adminAuthUserId ? adminAuthUserId.value : "").trim();
                const pwd = adminAuthPassword ? adminAuthPassword.value : "";

                if (!userId || !pwd) {
                    showGateAlert("Please enter both Admin USER ID and Password (PWD).", "error");
                    return;
                }

                if (adminLoginBtn) {
                    adminLoginBtn.disabled = true;
                    if (adminLoginBtnIcon) adminLoginBtnIcon.className = "fa-solid fa-circle-notch fa-spin";
                    if (adminLoginBtnText) adminLoginBtnText.textContent = "Authenticating Admin...";
                }

                try {
                    const res = await fetch("/api/admin/login", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ adminUserId: userId, password: pwd })
                    });

                    const data = await res.json().catch(() => ({}));

                    if (!res.ok || !data.success) {
                        showGateAlert(data.message || "Admin authentication failed. Please check credentials.", "error");
                        return;
                    }

                    setAdminSession(data.admin);
                    showGateAlert("Admin verified successfully! Unlocking issuance terminal...", "success");

                    setTimeout(() => {
                        updateAdminGateUI();
                        showMessage(`Authenticated as Admin <strong>${escapeHtml(data.admin.adminUserId)}</strong>. Issuance terminal ready.`, "success");
                    }, 500);

                } catch (err) {
                    console.error("Admin login error:", err);
                    showGateAlert("Connection error while authenticating admin account.", "error");
                } finally {
                    if (adminLoginBtn) {
                        adminLoginBtn.disabled = false;
                        if (adminLoginBtnIcon) adminLoginBtnIcon.className = "fa-solid fa-unlock-keyhole";
                        if (adminLoginBtnText) adminLoginBtnText.textContent = "Authenticate & Unlock Terminal";
                    }
                }
            });
        }

        // 2. Admin Registration Form Submission with Blockchain Confirmation & Owner Validation
        if (adminRegisterForm) {
            adminRegisterForm.addEventListener("submit", async function (e) {
                e.preventDefault();
                hideGateAlert();

                const userId = (adminCreateUserId ? adminCreateUserId.value : "").trim();
                const pwd = adminCreatePassword ? adminCreatePassword.value : "";
                const confirmPwd = adminCreateConfirmPassword ? adminCreateConfirmPassword.value : "";

                if (!userId || !pwd || !confirmPwd) {
                    showGateAlert("Please fill in all admin registration fields.", "error");
                    return;
                }

                if (userId.length < 3) {
                    showGateAlert("Admin USER ID must be at least 3 characters long.", "error");
                    return;
                }

                if (pwd.length < 6) {
                    showGateAlert("Admin Password must be at least 6 characters long.", "error");
                    return;
                }

                if (pwd !== confirmPwd) {
                    showGateAlert("Passwords do not match. Please re-enter to confirm.", "error");
                    return;
                }

                let linkedEmail = null;
                if (typeof auth !== "undefined" && auth.currentUser) {
                    linkedEmail = auth.currentUser.email;
                }

                function setRegLoading(loading, text) {
                    if (!adminRegisterBtn) return;
                    adminRegisterBtn.disabled = loading;
                    if (loading) {
                        if (adminRegisterBtnIcon) adminRegisterBtnIcon.className = "fa-solid fa-circle-notch fa-spin";
                        if (adminRegisterBtnText) adminRegisterBtnText.textContent = text || "Processing...";
                    } else {
                        if (adminRegisterBtnIcon) adminRegisterBtnIcon.className = "fa-solid fa-user-plus";
                        if (adminRegisterBtnText) adminRegisterBtnText.textContent = "Create Admin Account & Unlock";
                    }
                }

                try {
                    // Step 1: Verify MetaMask Environment
                    if (typeof window.ethereum === "undefined") {
                        showGateAlert("MetaMask extension not detected. MetaMask is required to verify on-chain administrator authorization. Please install or enable MetaMask.", "error");
                        return;
                    }

                    // Step 2: Fetch active blockchain configuration from server
                    setRegLoading(true, "Loading blockchain configuration...");
                    let config;
                    try {
                        config = await fetchBlockchainConfig();
                    } catch (cfgErr) {
                        console.error("[Admin Register] Config load error:", cfgErr);
                        showGateAlert(cfgErr.message || "Unable to load active blockchain configuration from server.", "error");
                        setRegLoading(false);
                        return;
                    }

                    // Step 3: Ensure MetaMask is on the correct network (Sepolia 0xaa36a7 or Ganache)
                    setRegLoading(true, `Verifying ${config.network.toUpperCase()} network...`);
                    try {
                        await ensureCorrectNetwork(config);
                    } catch (netErr) {
                        console.warn("[Admin Register] Network check error:", netErr);
                        const netLabel = config.isSepolia ? "Ethereum Sepolia (Chain ID: 11155111 / 0xaa36a7)" : `Ganache Local (Chain ID: ${config.chainId})`;
                        showGateAlert(`Please switch your MetaMask network to <strong>${netLabel}</strong> before proceeding.`, "warning");
                        setRegLoading(false);
                        return;
                    }

                    // Step 4: Query connected MetaMask account using eth_accounts (or eth_requestAccounts if not connected)
                    setRegLoading(true, "Checking connected wallet...");
                    let accounts = await window.ethereum.request({ method: "eth_accounts" }).catch(() => []);
                    if (!accounts || accounts.length === 0) {
                        try {
                            accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
                        } catch (connErr) {
                            console.warn("Wallet connection rejected:", connErr);
                            showGateAlert("Wallet connection was cancelled. Admin registration was not completed.", "warning");
                            setRegLoading(false);
                            return;
                        }
                    }

                    // Always re-query eth_accounts after connection to ensure freshest state
                    const freshAccounts = await window.ethereum.request({ method: "eth_accounts" }).catch(() => accounts);
                    if (!freshAccounts || freshAccounts.length === 0) {
                        showGateAlert("No active wallet account selected in MetaMask. Please connect an account.", "warning");
                        setRegLoading(false);
                        return;
                    }

                    const connectedAccount = freshAccounts[0];
                    updateWalletBadge(connectedAccount);

                    // Step 5: Check contract ownership dynamically before broadcasting any owner-only transaction
                    const ownerCheck = await checkContractOwnership(connectedAccount, config);
                    const isOwner = Boolean(ownerCheck && ownerCheck.isOwner);
                    const expectedOwner = (ownerCheck && ownerCheck.contractOwner) || config.contractOwner || config.expectedIssuer;

                    // If NOT the contract owner, STOP immediately! Do NOT broadcast!
                    if (!isOwner) {
                        console.warn(`[Admin Register] Connected account (${connectedAccount}) is NOT the contract owner (${expectedOwner}).`);
                        const shortConnected = connectedAccount.slice(0, 6) + "..." + connectedAccount.slice(-4);
                        const shortOwner = expectedOwner.slice(0, 6) + "..." + expectedOwner.slice(-4);

                        showGateAlert(
                            `Connected wallet (<strong class="mono">${escapeHtml(shortConnected)}</strong>) is NOT the contract owner. ` +
                            `Only the contract owner (<strong class="mono">${escapeHtml(shortOwner)}</strong>) can register administrators on the smart contract. ` +
                            `Please switch to the owner wallet in MetaMask to continue. ` +
                            `<div style="margin-top: 10px;">` +
                            `<button type="button" class="admin-account-switch-btn" id="gateSwitchOwnerBtn" style="padding: 6px 12px; font-size: 11px; border-radius: 6px; border: 1px solid currentColor; background: rgba(255,255,255,0.15); cursor: pointer; color: inherit; font-weight: 700;">` +
                            `<i class="fa-solid fa-wallet" style="margin-right: 4px;"></i> Switch to Owner Account in MetaMask` +
                            `</button>` +
                            `</div>`,
                            "error"
                        );

                        const switchBtn = document.getElementById("gateSwitchOwnerBtn");
                        if (switchBtn) {
                            switchBtn.addEventListener("click", async () => {
                                const newAccount = await requestAccountSwitch();
                                if (newAccount) {
                                    if (newAccount.toLowerCase() === expectedOwner.toLowerCase()) {
                                        showGateAlert(`Switched to owner account (<strong class="mono">${escapeHtml(newAccount.slice(0, 6))}...${escapeHtml(newAccount.slice(-4))}</strong>). You may now submit the form.`, "success");
                                    } else {
                                        showGateAlert(`Active account is still not the owner (<strong class="mono">${escapeHtml(newAccount.slice(0, 6))}...${escapeHtml(newAccount.slice(-4))}</strong>). Please select <strong class="mono">${escapeHtml(shortOwner)}</strong>.`, "error");
                                    }
                                }
                            });
                        }

                        setRegLoading(false);
                        return;
                    }

                    // Step 6: Pre-validate credentials and on-chain status with backend
                    setRegLoading(true, "Validating on-chain administrator status...");
                    const prepRes = await fetch("/api/admin/prepare-register", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            adminUserId: userId,
                            password: pwd,
                            adminAddress: connectedAccount
                        })
                    });

                    const prepData = await prepRes.json().catch(() => ({}));

                    if (!prepRes.ok || !prepData.success) {
                        showGateAlert(prepData.message || "Failed to validate admin credentials.", "error");
                        setRegLoading(false);
                        return;
                    }

                    let txHash = null;

                    // Case A: Owner's wallet is already verified on-chain as owner / admin
                    if (prepData.alreadyOnChain) {
                        console.log(`[Admin Register] Wallet ${connectedAccount} is already verified on-chain as contract owner/admin.`);
                        setRegLoading(true, "Creating administrator account in institutional repository...");

                        const regRes = await fetch("/api/admin/register", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                adminUserId: userId,
                                password: pwd,
                                linkedEmail: linkedEmail,
                                adminAddress: connectedAccount,
                                isExistingOnChainAdmin: true
                            })
                        });

                        const regData = await regRes.json().catch(() => ({}));

                        if (!regRes.ok || !regData.success) {
                            showGateAlert(regData.message || "Failed to create admin account in database.", "error");
                            setRegLoading(false);
                            return;
                        }

                        setAdminSession(regData.admin);
                        showGateAlert("Administrator account verified on-chain and registered in MongoDB! Unlocking terminal...", "success");

                        setTimeout(() => {
                            updateAdminGateUI();
                            showMessage(`Administrator account <strong>${escapeHtml(userId)}</strong> created successfully! Verified as contract owner (<span class="mono">${escapeHtml(connectedAccount.slice(0, 6))}...${escapeHtml(connectedAccount.slice(-4))}</span>).`, "success");
                        }, 500);
                        return;
                    }

                    // Case B: Registering a new administrator address on-chain via smart contract
                    // Validate contract call & simulate gas estimation before submitting
                    setRegLoading(true, "Simulating transaction on blockchain...");
                    try {
                        await window.ethereum.request({
                            method: "eth_estimateGas",
                            params: [{
                                from: connectedAccount,
                                to: prepData.contractAddress,
                                data: prepData.txData
                            }]
                        });
                    } catch (simErr) {
                        console.warn("[Admin Register] Transaction simulation failed:", simErr);
                        showGateAlert(
                            "Transaction simulation failed: Gas estimation is unavailable because the smart contract would revert this call. " +
                            "Verify that your wallet has sufficient Sepolia ETH and that this administrator address or ID is not already registered.",
                            "error"
                        );
                        setRegLoading(false);
                        return;
                    }

                    // Broadcast registerAdmin transaction to smart contract
                    setRegLoading(true, "Please confirm transaction in MetaMask...");
                    let rawTxHash = null;
                    try {
                        rawTxHash = await window.ethereum.request({
                            method: "eth_sendTransaction",
                            params: [{
                                from: connectedAccount,
                                to: prepData.contractAddress,
                                data: prepData.txData
                            }]
                        });
                        console.log("[Admin Blockchain] Transaction submitted. Hash:", rawTxHash);
                    } catch (txErr) {
                        console.warn("Wallet transaction error:", txErr);
                        const isRejection = txErr.code === 4001 || (txErr.message && txErr.message.includes("rejected"));
                        const msg = isRejection ?
                            "Transaction rejected in MetaMask. Admin account was not created." :
                            (txErr.message || "Blockchain transaction failed.");
                        showGateAlert(msg, "error");
                        setRegLoading(false);
                        return;
                    }

                    // Await confirmation on blockchain
                    setRegLoading(true, "Confirming transaction on blockchain...");
                    let receipt = null;
                    const maxPollingAttempts = 50;
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
                            console.warn(`Polling receipt attempt ${attempt + 1}:`, receiptErr);
                        }
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                    if (!receipt) {
                        showGateAlert("Transaction was broadcast but confirmation receipt timed out.", "error");
                        setRegLoading(false);
                        return;
                    }

                    const statusNum = typeof receipt.status === "string" ? parseInt(receipt.status, 16) : Number(receipt.status);
                    if (statusNum !== 1) {
                        showGateAlert("Blockchain transaction reverted on the smart contract.", "error");
                        setRegLoading(false);
                        return;
                    }

                    txHash = receipt.transactionHash || rawTxHash;
                    console.log("[Admin Blockchain] Confirmed on-chain:", txHash);

                    // Step 7: Create and save in MongoDB
                    setRegLoading(true, "Saving admin credentials in MongoDB...");
                    const regRes = await fetch("/api/admin/register", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            adminUserId: userId,
                            password: pwd,
                            linkedEmail: linkedEmail,
                            transactionHash: txHash,
                            adminAddress: connectedAccount
                        })
                    });

                    const regData = await regRes.json().catch(() => ({}));

                    if (!regRes.ok || !regData.success) {
                        showGateAlert(regData.message || "Failed to create admin account in database.", "error");
                        setRegLoading(false);
                        return;
                    }

                    setAdminSession(regData.admin);
                    showGateAlert("Admin account confirmed on blockchain and saved in MongoDB! Unlocking terminal...", "success");

                    setTimeout(() => {
                        updateAdminGateUI();
                        const txNotice = regData.admin && regData.admin.transactionHash ?
                            ` On-Chain Proof Tx: <span class="mono">${regData.admin.transactionHash.slice(0, 14)}...</span>` : "";
                        showMessage(`Admin account <strong>${escapeHtml(userId)}</strong> registered on blockchain & created in MongoDB!${txNotice}`, "success");
                    }, 500);

                } catch (err) {
                    console.error("Admin registration flow error:", err);
                    showGateAlert("Error during administrator registration: " + err.message, "error");
                }
            });
        }

        // Initialize state on load
        updateAdminGateUI();
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
        [groupStudentName, groupRollNumber, groupCourse, groupCertType, groupCustomCertType, groupCertificateId, groupIssueDate].forEach(group => {
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
    function setLoading(loading, statusText, isRegistrar = false) {
        isProcessing = loading;

        if (issueButton) {
            issueButton.disabled = loading;
            if (loading && !isRegistrar) {
                if (issueBtnIcon) issueBtnIcon.className = "fa-solid fa-circle-notch fa-spin";
                if (issueBtnText) issueBtnText.textContent = statusText || "Registering on Blockchain...";
            } else {
                if (issueBtnIcon) issueBtnIcon.className = "fa-solid fa-wallet";
                if (issueBtnText) issueBtnText.textContent = "Issue via MetaMask";
            }
        }

        if (registrarIssueBtn) {
            registrarIssueBtn.disabled = loading;
            if (loading && isRegistrar) {
                if (registrarBtnIcon) registrarBtnIcon.className = "fa-solid fa-circle-notch fa-spin";
                if (registrarBtnText) registrarBtnText.textContent = statusText || "Signing & Broadcasting...";
            } else {
                if (registrarBtnIcon) registrarBtnIcon.className = "fa-solid fa-bolt";
                if (registrarBtnText) registrarBtnText.textContent = "Direct Registrar Issuance (Fast)";
            }
        }

        if (resetButton) {
            resetButton.disabled = loading;
        }

        [studentNameInput, rollNumberInput, courseInput, certTypeSearchInput, customCertificateType, certificateIdInput, issueDateInput].forEach(input => {
            if (input) input.disabled = loading;
        });

        if (toggleCertDropdownBtn) toggleCertDropdownBtn.disabled = loading;
        if (clearCertTypeBtn) clearCertTypeBtn.disabled = loading;
        if (clearCustomCertTypeBtn) clearCustomCertTypeBtn.disabled = loading;
    }

    // ----------------------------------------------------------------------
    // 5. ISSUE CERTIFICATE (BLOCKCHAIN-BACKED ISSUANCE FLOW)
    // ----------------------------------------------------------------------
    async function issueCertificate() {
        if (isProcessing) return;

        clearInputErrors();
        hideMessage();

        const activeAdmin = getAdminSession();
        if (!activeAdmin || !activeAdmin.adminUserId) {
            showMessage("Admin authorization required. Please authenticate with your Admin USER ID & PWD.", "danger");
            updateAdminGateUI();
            return;
        }

        const studentName = (studentNameInput ? studentNameInput.value : "").trim();
        const rollNumber = (rollNumberInput ? rollNumberInput.value : "").trim();
        const course = (courseInput ? courseInput.value : "").trim();
        const certificateId = (certificateIdInput ? certificateIdInput.value : "").trim();
        const issueDate = (issueDateInput ? issueDateInput.value : "").trim();

        // Resolve Certification Field [Search, Options, Other]
        const hiddenType = (certificateTypeHidden ? certificateTypeHidden.value : "").trim();
        const searchType = (certTypeSearchInput ? certTypeSearchInput.value : "").trim();
        const customType = (customCertificateType ? customCertificateType.value : "").trim();

        let resolvedCertType = "";
        let isOtherMode = hiddenType === "Other" ||
                          (customCertTypeBox && customCertTypeBox.style.display !== "none") ||
                          searchType.toLowerCase().startsWith("other");

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

        if (isOtherMode) {
            if (!customType) {
                if (groupCustomCertType) groupCustomCertType.classList.add("input-error");
                hasError = true;
            } else {
                resolvedCertType = customType;
            }
        } else if (hiddenType && hiddenType !== "Other") {
            resolvedCertType = hiddenType;
        } else if (searchType) {
            resolvedCertType = searchType;
        }

        if (!resolvedCertType && !isOtherMode) {
            if (groupCertType) groupCertType.classList.add("input-error");
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
            else if (isOtherMode && !customType && customCertificateType) customCertificateType.focus();
            else if (!resolvedCertType && certTypeSearchInput) certTypeSearchInput.focus();
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
            certificateType: resolvedCertType,
            fieldOfCertification: resolvedCertType,
            adminUserId: activeAdmin ? activeAdmin.adminUserId : null,
            certificateId: certificateId,
            issueDate: issueDate
        };

        console.log("[1] Admin submit triggered with data:", payload);

        const primaryEndpoint = "/api/certificate";
        const prepareEndpoint = "/api/certificate/prepare";

        try {
            const tIssuanceStart = Date.now();
            const timings = {
                network: selectedNetwork,
                configDurationMs: 0,
                metaMaskDetectDurationMs: 0,
                authQueryDurationMs: 0,
                hashPrepDurationMs: 0,
                txPrepDurationMs: 0,
                gasSimDurationMs: 0,
                userApprovalDurationMs: 0,
                miningReceiptDurationMs: 0,
                mongoSaveDurationMs: 0,
                totalDurationMs: 0
            };

            // Stage 1: Load Blockchain Configuration
            const tConfigStart = Date.now();
            setLoading(true, `Loading ${selectedNetwork.toUpperCase()} configuration...`);

            let config;
            try {
                config = await fetchBlockchainConfig(selectedNetwork, true);
            } catch (cfgErr) {
                timings.configDurationMs = Date.now() - tConfigStart;
                console.error("[Issuance] Config load error:", cfgErr);
                showMessage(cfgErr.message || "Unable to load active blockchain configuration from server.", "danger");
                setLoading(false);
                return;
            }
            timings.configDurationMs = Date.now() - tConfigStart;

            if (!config.isAvailable) {
                showMessage(`The selected network (<strong>${escapeHtml(config.label || selectedNetwork)}</strong>) is currently unavailable: ${escapeHtml(config.statusMessage || "Ledger unreachable.")}`, "danger");
                setLoading(false);
                return;
            }

            // Stage 2: MetaMask Account and Chain Detection
            const tDetectStart = Date.now();
            let signingIssuer = null;

            if (typeof window.ethereum === "undefined") {
                timings.metaMaskDetectDurationMs = Date.now() - tDetectStart;
                console.error("MetaMask not detected in browser window.ethereum.");
                showMessage("MetaMask extension not detected. MetaMask is required to sign certificate issuance on-chain. Please install or enable MetaMask.", "danger");
                setLoading(false);
                return;
            }

            setLoading(true, "Connecting to MetaMask...");
            let accounts = await window.ethereum.request({ method: "eth_accounts" }).catch(() => []);
            if (!accounts || accounts.length === 0) {
                try {
                    accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
                } catch (accErr) {
                    timings.metaMaskDetectDurationMs = Date.now() - tDetectStart;
                    console.warn("MetaMask connection request rejected:", accErr);
                    const isPending = accErr && (accErr.code === -32002 || (accErr.message && (accErr.message.includes("already pending") || accErr.message.includes("wallet_requestPermissions"))));
                    if (isPending) {
                        showMessage(
                            `<div style="font-weight: 700; margin-bottom: 4px;">` +
                            `<i class="fa-solid fa-clock-rotate-left" style="margin-right: 6px;"></i> MetaMask Approval Window Already Open` +
                            `</div>` +
                            `<div style="font-size: 0.85rem; line-height: 1.5; margin-bottom: 12px; opacity: 0.95;">` +
                            `MetaMask has a pending notification waiting for your approval in your browser toolbar.<br>` +
                            `• <strong>To resolve:</strong> Click the <strong>MetaMask fox icon</strong> with the notification badge in your browser's extension bar and approve or close the prompt.<br>` +
                            `• <strong>Or bypass MetaMask:</strong> Click below to issue on-chain immediately via the Institutional Registrar node with no wallet prompts!` +
                            `</div>` +
                            `<button type="button" class="admin-registrar-btn" id="btnPendingConnectRegistrar" style="height: 38px; font-size: 13px; padding: 0 16px;">` +
                            `<i class="fa-solid fa-bolt"></i> Issue Instantly via Direct Registrar (No Wallet Prompts)` +
                            `</button>`,
                            "warning"
                        );
                        const fb = document.getElementById("btnPendingConnectRegistrar");
                        if (fb) fb.addEventListener("click", () => issueCertificateDirectRegistrar());
                    } else {
                        showMessage("MetaMask connection was cancelled. Certificate was not issued.", "warning");
                    }
                    setLoading(false);
                    return;
                }
            }

            if (!accounts || accounts.length === 0) {
                timings.metaMaskDetectDurationMs = Date.now() - tDetectStart;
                showMessage("No active Ethereum account selected in MetaMask.", "warning");
                setLoading(false);
                return;
            }

            // Ensure MetaMask chain matches selected network
            try {
                await ensureCorrectNetwork(config);
            } catch (netErr) {
                timings.metaMaskDetectDurationMs = Date.now() - tDetectStart;
                showMessage(`Failed to align MetaMask network with ${escapeHtml(config.label)}. Please switch chains in MetaMask.`, "danger");
                setLoading(false);
                return;
            }
            timings.metaMaskDetectDurationMs = Date.now() - tDetectStart;

            // Stage 3: Contract Ownership or Issuer Authorization Query
            const tAuthStart = Date.now();
            setLoading(true, `Verifying issuer authorization on ${config.label}...`);
            const activeAccount = accounts[0];
            const [authCheck, ownerCheck] = await Promise.all([
                checkAccountAuthorization(activeAccount, config),
                checkContractOwnership(activeAccount, config)
            ]);
            timings.authQueryDurationMs = Date.now() - tAuthStart;

            const isOwner = Boolean(ownerCheck && ownerCheck.isOwner);
            const isAuthorized = Boolean(authCheck && authCheck.authorized) || isOwner;
            connectedMetaMaskAccount = activeAccount;
            await updateAccountAndPermissionsDisplay(activeAccount, config);

            if (!isAuthorized) {
                const shortAcc = activeAccount.slice(0, 6) + "..." + activeAccount.slice(-4);
                const ownerAddr = config.contractOwner || config.expectedIssuer || "Authorized Owner";
                const shortOwner = (ownerAddr && ownerAddr.length === 42) ? (ownerAddr.slice(0, 6) + "..." + ownerAddr.slice(-4)) : ownerAddr;

                showMessage(
                    `<div style="font-weight: 700; margin-bottom: 6px;">` +
                    `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Connected Account is Not Authorized to Issue Certificates` +
                    `</div>` +
                    `<div style="font-size: 0.85rem; line-height: 1.5; margin-bottom: 10px; opacity: 0.95;">` +
                    `Connected wallet <strong class="mono">${escapeHtml(shortAcc)}</strong> is not an authorized issuer on the active <strong>${escapeHtml(config.label)}</strong> contract.<br>` +
                    `Contract Owner: <strong class="mono">${escapeHtml(shortOwner)}</strong>.<br>` +
                    `• <strong>Option 1 (Fast & Recommended):</strong> Click below to issue directly on-chain via the Institutional Registrar node — no wallet prompts or account switching needed!<br>` +
                    `• <strong>Option 2:</strong> Switch to an authorized account in MetaMask.` +
                    `</div>` +
                    `<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px;">` +
                    `<button type="button" class="admin-registrar-btn" id="btnAuthFailRegistrar" style="height: 36px; font-size: 12px; padding: 0 14px;">` +
                    `<i class="fa-solid fa-bolt"></i> Issue Instantly via Direct Registrar (No Wallet Prompts)` +
                    `</button>` +
                    `<button type="button" class="admin-account-switch-btn" id="btnAuthFailSwitch" style="height: 36px; font-size: 12px; padding: 0 14px; border-radius: 6px; border: 1px solid currentColor; background: rgba(255,255,255,0.15); cursor: pointer; color: inherit; font-weight: 700;">` +
                    `<i class="fa-solid fa-wallet"></i> Change Account in MetaMask` +
                    `</button>` +
                    `</div>`,
                    "danger"
                );
                const rBtn = document.getElementById("btnAuthFailRegistrar");
                if (rBtn) rBtn.addEventListener("click", () => issueCertificateDirectRegistrar());
                const sBtn = document.getElementById("btnAuthFailSwitch");
                if (sBtn) sBtn.addEventListener("click", () => requestAccountSwitch());
                setLoading(false);
                return;
            }

            signingIssuer = activeAccount;

            // Pre-flight balance check: avoid hanging gas simulation if user has 0 Sepolia ETH
            let accountBalanceHex = "0x0";
            try {
                accountBalanceHex = await window.ethereum.request({
                    method: "eth_getBalance",
                    params: [signingIssuer, "latest"]
                });
            } catch (balErr) {
                console.warn("[Issuance] eth_getBalance warning:", balErr && balErr.message);
            }

            const balanceWei = BigInt(accountBalanceHex || "0x0");
            if (balanceWei === 0n && selectedNetwork === "sepolia") {
                console.warn(`[Issuance] Account ${signingIssuer} has 0 Sepolia ETH.`);
                showMessage(
                    `<div style="font-weight: 700; margin-bottom: 4px;">` +
                    `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Insufficient Sepolia Test ETH` +
                    `</div>` +
                    `<div style="font-size: 0.85rem; line-height: 1.5; margin-bottom: 10px; opacity: 0.95;">` +
                    `Connected account (<strong class="mono">${signingIssuer.slice(0, 6)}...${signingIssuer.slice(-4)}</strong>) has <strong>0 Sepolia test ETH</strong>.<br>` +
                    `Gas fees are required to execute transactions on Ethereum Sepolia.<br>` +
                    `• <strong>Option 1 (Recommended):</strong> Switch to <strong>Ganache Local</strong> to test with free local ETH.<br>` +
                    `• <strong>Option 2:</strong> Issue instantly via the <strong>Institutional Registrar node</strong> (no gas required).` +
                    `</div>` +
                    `<div style="display: flex; gap: 8px; flex-wrap: wrap;">` +
                    `<button type="button" class="network-switch-fallback-btn" id="btnInsufficientSepoliaGanache" style="height: 36px; font-size: 12px; padding: 0 14px;">` +
                    `<i class="fa-solid fa-server"></i> Switch to Ganache Local` +
                    `</button>` +
                    `<button type="button" class="admin-registrar-btn" id="btnInsufficientSepoliaRegistrar" style="height: 36px; font-size: 12px; padding: 0 14px;">` +
                    `<i class="fa-solid fa-bolt"></i> Issue via Direct Registrar` +
                    `</button>` +
                    `</div>`,
                    "warning"
                );
                const gBtn = document.getElementById("btnInsufficientSepoliaGanache");
                if (gBtn) gBtn.addEventListener("click", () => selectNetwork("ganache", false));
                const rBtn = document.getElementById("btnInsufficientSepoliaRegistrar");
                if (rBtn) rBtn.addEventListener("click", () => issueCertificateDirectRegistrar());
                setLoading(false);
                return;
            }

            // Stage 4: Certificate Hash Preparation
            const tHashStart = Date.now();
            setLoading(true, "Validating & preparing deterministic hash on backend...");
            const prepPayload = {
                ...payload,
                network: selectedNetwork
            };
            const prepResponse = await fetch(prepareEndpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify(prepPayload)
            });

            const prepData = await prepResponse.json().catch(() => ({}));
            timings.hashPrepDurationMs = Date.now() - tHashStart;

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

            // Stage 5: Backend Transaction Preparation
            const tTxPrepStart = Date.now();
            if (!prepData.contractAddress || prepData.contractAddress.toLowerCase() !== config.contractAddress.toLowerCase()) {
                showMessage("Contract address mismatch between server and client configuration.", "danger");
                setLoading(false);
                return;
            }
            if (!prepData.txData) {
                showMessage("Transaction data missing from server preparation response.", "danger");
                setLoading(false);
                return;
            }
            currentTransactionPrep = {
                contractAddress: prepData.contractAddress,
                txData: prepData.txData,
                certificateHash: prepData.certificateHash,
                network: selectedNetwork,
                signingIssuer: signingIssuer
            };
            timings.txPrepDurationMs = Date.now() - tTxPrepStart;

            // Stage 6: Transaction Simulation and Gas Estimation
            const tGasSimStart = Date.now();
            setLoading(true, "Simulating transaction on smart contract...");
            try {
                await window.ethereum.request({
                    method: "eth_estimateGas",
                    params: [{
                        from: signingIssuer,
                        to: prepData.contractAddress,
                        data: prepData.txData
                    }]
                });
            } catch (simErr) {
                timings.gasSimDurationMs = Date.now() - tGasSimStart;
                console.warn("[Issuance] Gas estimation simulation failed:", simErr);
                const errText = (simErr && (simErr.message || simErr.data || "")) || "";
                let failReason = "Transaction simulation indicates this call will revert on the smart contract.";
                if (errText.includes("Caller is not authorized") || errText.includes("unauthorized")) {
                    failReason = `Contract revert: Account ${signingIssuer.slice(0, 6)}...${signingIssuer.slice(-4)} is not authorized to issue certificates on this contract.`;
                } else if (errText.includes("already registered") || errText.includes("exists")) {
                    failReason = `Contract revert: Certificate ID "${escapeHtml(certificateId)}" is already registered on the blockchain.`;
                } else if (errText.includes("insufficient funds")) {
                    failReason = "Account has insufficient funds to cover the estimated gas fees.";
                }

                showMessage(
                    `<div style="font-weight: 700; margin-bottom: 4px;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Gas Estimation Simulation Failed</div>` +
                    `<div style="font-size: 0.85rem; line-height: 1.5; margin-bottom: 10px; opacity: 0.95;">` +
                    `${escapeHtml(failReason)}<br>` +
                    `Transaction was stopped before broadcast to protect against gas fee loss.` +
                    `</div>` +
                    `<button type="button" class="admin-registrar-btn" id="btnSimFailRegistrar" style="height: 36px; font-size: 12px; padding: 0 14px;">` +
                    `<i class="fa-solid fa-bolt"></i> Issue via Direct Registrar` +
                    `</button>`,
                    "danger"
                );
                const simFallback = document.getElementById("btnSimFailRegistrar");
                if (simFallback) simFallback.addEventListener("click", () => issueCertificateDirectRegistrar());
                setLoading(false);
                return;
            }
            timings.gasSimDurationMs = Date.now() - tGasSimStart;

            // Stage 7: MetaMask User Approval & Broadcast
            const tUserApproveStart = Date.now();
            console.log(`[Issuance] Blockchain transaction starting on [${config.network}] via MetaMask from:`, signingIssuer);
            setLoading(true, "Please sign transaction in MetaMask...");

            let rawTxHash = null;
            try {
                rawTxHash = await window.ethereum.request({
                    method: "eth_sendTransaction",
                    params: [{
                        from: signingIssuer,
                        to: prepData.contractAddress,
                        data: prepData.txData,
                        gas: "0x7a120", // 500,000 gas limit
                        value: "0x0"
                    }]
                });
                timings.userApprovalDurationMs = Date.now() - tUserApproveStart;
                console.log("[Issuance] Blockchain transaction submitted. Hash:", rawTxHash);
            } catch (txErr) {
                timings.userApprovalDurationMs = Date.now() - tUserApproveStart;
                console.warn("MetaMask transaction error:", txErr);
                const errStr = (txErr && (txErr.message || "")).toLowerCase();
                const isInsufficientFunds = errStr.includes("insufficient funds") || txErr.code === -32000;
                const isRejection = txErr.code === 4001 || errStr.includes("rejected") || errStr.includes("denied");

                if (isRejection) {
                    showMessage("Transaction cancelled in MetaMask. The certificate was not issued.", "warning", 5000);
                    setLoading(false);
                    return;
                }

                if (isInsufficientFunds && selectedNetwork === "sepolia") {
                    showMessage(
                        `<div style="font-weight: 700; margin-bottom: 4px;">` +
                        `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Not enough Sepolia test ETH.` +
                        `</div>` +
                        `<div style="font-size: 0.85rem; margin-bottom: 10px; opacity: 0.95;">` +
                        `You can switch to Ganache Local to issue a separate local test transaction.` +
                        `</div>` +
                        `<button type="button" class="network-switch-fallback-btn" id="inlineSwitchToGanacheBtn">` +
                        `<i class="fa-solid fa-server"></i> Switch to Ganache Local` +
                        `</button>`,
                        "warning"
                    );
                    const inlineBtn = document.getElementById("inlineSwitchToGanacheBtn");
                    if (inlineBtn) {
                        inlineBtn.addEventListener("click", () => {
                            selectNetwork("ganache", false);
                        });
                    }
                    setLoading(false);
                    return;
                }

                const msg = txErr.message || "Blockchain transaction failed.";
                showMessage(msg, "danger");
                setLoading(false);
                return;
            }

            // Stage 8: Transaction Confirmation & Receipt Capturing
            const tReceiptStart = Date.now();
            setLoading(true, `Confirming transaction on ${config.network.toUpperCase()} & capturing receipt...`);
            let receipt = null;
            const isGan = !config.isSepolia;
            const maxPollingAttempts = isGan ? 40 : 50;
            const pollDelay = isGan ? 80 : 800;

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
                if (attempt < maxPollingAttempts - 1) {
                    await new Promise((resolve) => setTimeout(resolve, pollDelay));
                }
            }
            timings.miningReceiptDurationMs = Date.now() - tReceiptStart;

            if (!receipt) {
                console.error("Failed to retrieve transaction receipt within timeout for tx:", rawTxHash);
                const shortTx = rawTxHash.slice(0, 14) + "...";
                const explorerLink = config.explorerUrl ? `${config.explorerUrl}/tx/${rawTxHash}` : null;
                showMessage(
                    `<div style="font-weight: 700; margin-bottom: 4px;"><i class="fa-solid fa-clock" style="margin-right: 6px;"></i> Transaction Confirmation Pending</div>` +
                    `<div style="font-size: 0.85rem; line-height: 1.5; margin-bottom: 10px;">` +
                    `Transaction was broadcast (<span class="mono">${shortTx}</span>), but receipt confirmation timed out after polling.<br>` +
                    `The transaction hash has been preserved. Do not resubmit blindly.` +
                    `${explorerLink ? `<br><a href="${explorerLink}" target="_blank" rel="noopener noreferrer" style="color: inherit; text-decoration: underline;">View on Block Explorer</a>` : ''}` +
                    `</div>`,
                    "warning"
                );
                setLoading(false);
                return;
            }

            // Verify status on the receipt (0x1 in hex or 1 in dec)
            const statusNum = typeof receipt.status === "string" ? parseInt(receipt.status, 16) : Number(receipt.status);
            if (statusNum !== 1) {
                console.error("Transaction reverted on-chain according to receipt:", receipt);
                showMessage(
                    `<div style="font-weight: 700; margin-bottom: 4px;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Transaction Reverted</div>` +
                    `<div style="font-size: 0.85rem; line-height: 1.5; margin-bottom: 10px;">` +
                    `The transaction was mined on-chain but reverted by the smart contract.` +
                    `</div>` +
                    `<button type="button" class="admin-registrar-btn" id="btnFallbackRevertRegistrar" style="height: 38px; font-size: 13px; padding: 0 16px;">` +
                    `<i class="fa-solid fa-bolt"></i> Complete Registration via Registrar Node` +
                    `</button>`,
                    "danger"
                );
                const fbBtn = document.getElementById("btnFallbackRevertRegistrar");
                if (fbBtn) fbBtn.addEventListener("click", () => issueCertificateDirectRegistrar());
                setLoading(false);
                return;
            }

            const confirmedTxHash = receipt.transactionHash || rawTxHash;

            // Stage 9: Recording in MongoDB
            const tMongoStart = Date.now();
            setLoading(true, "Recording in institutional repository...");

            const finalPayload = {
                ...payload,
                network: selectedNetwork,
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
            timings.mongoSaveDurationMs = Date.now() - tMongoStart;
            timings.totalDurationMs = Date.now() - tIssuanceStart;

            // Safe timing log (strictly no credentials, private keys, or passwords)
            console.log("[VerifiedRecords Timing Stages]", JSON.stringify(timings, null, 2));

            if (!response.ok) {
                if (data.reconciliationRequired) {
                    showMessage(data.message, "warning");
                    setLoading(false);
                    return;
                }
                let errMsg = data.message || "Failed to record certificate in repository.";
                if (data.details && data.details !== data.message) {
                    errMsg += ` <div style="font-size: 0.85rem; margin-top: 4px; opacity: 0.9;">${escapeHtml(data.details)}</div>`;
                }
                showMessage(errMsg, "danger");
                setLoading(false);
                return;
            }

            renderIssuanceSuccess(data, payload, config);

        } catch (error) {
            console.error("Certificate issuance error:", error);
            let errMsg = (error && error.message) ? error.message : "Unable to complete issuance.";
            const isPending = error && (error.code === -32002 || errMsg.includes("already pending") || errMsg.includes("wallet_requestPermissions"));
            if (errMsg.toLowerCase().includes("user rejected") || errMsg.toLowerCase().includes("rejected")) {
                errMsg = "Transaction was cancelled in MetaMask.";
            }

            let alertHtml = "";
            if (isPending) {
                alertHtml =
                    `<div style="font-weight: 700; margin-bottom: 4px;">` +
                    `<i class="fa-solid fa-clock-rotate-left" style="margin-right: 6px;"></i> MetaMask Window Already Pending` +
                    `</div>` +
                    `<div style="font-size: 0.85rem; line-height: 1.5; margin-bottom: 12px; opacity: 0.95;">` +
                    `A MetaMask request is already open or minimized in your browser.<br>` +
                    `• Click the <strong>MetaMask fox icon</strong> with the notification badge in your browser toolbar to approve or close it.<br>` +
                    `• <strong>Or bypass MetaMask entirely:</strong> Click below to issue directly on-chain via the Institutional Registrar node with zero wallet prompts!` +
                    `</div>` +
                    `<button type="button" class="admin-registrar-btn" id="btnFallbackErrorRegistrar" style="height: 38px; font-size: 13px; padding: 0 16px;">` +
                    `<i class="fa-solid fa-bolt"></i> Issue Instantly via Direct Registrar (No Wallet Prompts)` +
                    `</button>`;
            } else {
                alertHtml =
                    `<div style="font-weight: 700; margin-bottom: 4px;">` +
                    `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> MetaMask Issuance Notice` +
                    `</div>` +
                    `<div style="font-size: 0.85rem; margin-bottom: 10px; opacity: 0.95;">${escapeHtml(errMsg)}</div>` +
                    `<button type="button" class="admin-registrar-btn" id="btnFallbackErrorRegistrar" style="height: 38px; font-size: 13px; padding: 0 16px;">` +
                    `<i class="fa-solid fa-bolt"></i> Issue Instantly via Direct Registrar (No Wallet Prompts)` +
                    `</button>`;
            }

            showMessage(alertHtml, isPending ? "warning" : "danger");
            const errFallbackBtn = document.getElementById("btnFallbackErrorRegistrar");
            if (errFallbackBtn) {
                errFallbackBtn.addEventListener("click", () => {
                    issueCertificateDirectRegistrar();
                });
            }
        } finally {
            setLoading(false);
        }
    }

    // ----------------------------------------------------------------------
    // 5B. RENDER SUCCESSFUL ISSUANCE
    // ----------------------------------------------------------------------
    function renderIssuanceSuccess(data, payload, config) {
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

        if (confirmStudentName) confirmStudentName.textContent = issuedCert.studentName || payload.studentName;
        if (confirmRollNumber) confirmRollNumber.textContent = issuedCert.rollNumber || payload.rollNumber;
        if (confirmCertId) confirmCertId.textContent = issuedCert.certificateId || payload.certificateId;
        if (confirmCourse) confirmCourse.textContent = issuedCert.course || payload.course;
        if (confirmCertType) confirmCertType.textContent = issuedCert.certificateType || issuedCert.fieldOfCertification || payload.certificateType;
        if (confirmIssueDate) confirmIssueDate.textContent = displayDate;

        // Display blockchain transaction hash with Etherscan link when on Sepolia
        const finalTxHash = blockchainMeta.transactionHash || issuedCert.transactionHash;
        if (confirmTxItem && confirmTxHash && finalTxHash) {
            const isSepoliaTx = (blockchainMeta.blockchainNetwork || (config && config.network)) === "sepolia";
            if (isSepoliaTx) {
                confirmTxHash.innerHTML = `
                    <a href="https://sepolia.etherscan.io/tx/${encodeURIComponent(finalTxHash)}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-family: monospace; display: inline-flex; align-items: center; gap: 4px;" title="View on Sepolia Etherscan">
                        ${escapeHtml(finalTxHash)} <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 10px;"></i>
                    </a>
                    <span style="margin-left: 6px; font-size: 10px; background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Ethereum Sepolia</span>
                `;
            } else {
                confirmTxHash.innerHTML = `
                    <span style="font-family: monospace;">${escapeHtml(finalTxHash)}</span>
                    <span style="margin-left: 6px; font-size: 10px; background: #f1f5f9; color: #475569; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Ganache Local</span>
                `;
            }
            confirmTxItem.style.display = "flex";
        } else if (confirmTxItem) {
            confirmTxItem.style.display = "none";
        }

        if (verifyLink) {
            const targetId = issuedCert.certificateId || payload.certificateId;
            verifyLink.href = `verify.html?id=${encodeURIComponent(targetId)}`;
        }

        if (issuanceSuccessCard) {
            issuanceSuccessCard.style.display = "block";
            issuanceSuccessCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }

        showMessage("Certificate successfully registered on the blockchain and recorded in the institutional repository!", "success");

        // Reset form fields & certification type combobox
        if (studentNameInput) studentNameInput.value = "";
        if (rollNumberInput) rollNumberInput.value = "";
        if (courseInput) courseInput.value = "";
        if (certificateIdInput) certificateIdInput.value = "";
        if (issueDateInput) {
            const today = new Date().toISOString().split("T")[0];
            issueDateInput.value = today;
        }
        resetCertTypeSelection();
    }

    // ----------------------------------------------------------------------
    // 5C. DIRECT REGISTRAR ISSUANCE (FAST, ON-CHAIN, BYPASSES WALLET GLITCHES)
    // ----------------------------------------------------------------------
    async function issueCertificateDirectRegistrar() {
        if (isProcessing) return;

        clearInputErrors();
        hideMessage();

        const activeAdmin = getAdminSession();
        if (!activeAdmin || !activeAdmin.adminUserId) {
            showMessage("Admin authorization required. Please authenticate with your Admin USER ID & PWD.", "danger");
            updateAdminGateUI();
            return;
        }

        const studentName = (studentNameInput ? studentNameInput.value : "").trim();
        const rollNumber = (rollNumberInput ? rollNumberInput.value : "").trim();
        const course = (courseInput ? courseInput.value : "").trim();
        const certificateId = (certificateIdInput ? certificateIdInput.value : "").trim();
        const issueDate = (issueDateInput ? issueDateInput.value : "").trim();

        const resolvedCertType = getSelectedCertificationType();

        let hasError = false;
        if (!studentName) { if (groupStudentName) groupStudentName.classList.add("input-error"); hasError = true; }
        if (!rollNumber) { if (groupRollNumber) groupRollNumber.classList.add("input-error"); hasError = true; }
        if (!course) { if (groupCourse) groupCourse.classList.add("input-error"); hasError = true; }
        if (!resolvedCertType) {
            if (groupCertType) groupCertType.classList.add("input-error");
            if (groupCustomCertType && customCertTypeBox && customCertTypeBox.style.display !== "none") groupCustomCertType.classList.add("input-error");
            hasError = true;
        }
        if (!certificateId) { if (groupCertificateId) groupCertificateId.classList.add("input-error"); hasError = true; }
        if (!issueDate) { if (groupIssueDate) groupIssueDate.classList.add("input-error"); hasError = true; }

        if (hasError) {
            showMessage("Please fill in all required fields accurately before submitting.", "danger");
            return;
        }

        const payload = {
            studentName,
            rollNumber,
            course,
            certificateType: resolvedCertType,
            fieldOfCertification: resolvedCertType,
            certificateId,
            issueDate,
            adminUserId: activeAdmin.adminUserId
        };

        setLoading(true, `Registering on ${selectedNetwork === "ganache" ? "Ganache Local" : "Ethereum Sepolia"} via Registrar node...`, true);

        try {
            const config = await fetchBlockchainConfig(selectedNetwork).catch(() => ({
                network: selectedNetwork,
                isSepolia: selectedNetwork === "sepolia"
            }));

            const finalPayload = {
                ...payload,
                network: selectedNetwork
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
                if (data.reconciliationRequired) {
                    showMessage(data.message, "warning");
                    setLoading(false, null, true);
                    return;
                }
                let errMsg = data.message || "Failed to record certificate in repository.";
                showMessage(errMsg, "danger");
                setLoading(false, null, true);
                return;
            }

            renderIssuanceSuccess(data, payload, config);
        } catch (err) {
            console.error("[Registrar Issuance Error]", err);
            showMessage("Registrar issuance error: " + err.message, "danger");
        } finally {
            setLoading(false, null, true);
        }
    }

    // Expose functions globally for backwards compatibility & console testing
    window.issueCertificate = issueCertificate;
    window.issueCertificateDirectRegistrar = issueCertificateDirectRegistrar;

    // ----------------------------------------------------------------------
    // 6. FORM & BUTTON LISTENERS
    // ----------------------------------------------------------------------
    if (certificateForm) {
        certificateForm.addEventListener("submit", function (e) {
            e.preventDefault();
            console.log("[Admin] submit triggered (MetaMask path)");
            issueCertificate();
        });
        console.log("[Admin] submit handler attached");
    }

    if (registrarIssueBtn) {
        registrarIssueBtn.addEventListener("click", function (e) {
            e.preventDefault();
            console.log("[Admin] Direct Registrar issuance triggered");
            issueCertificateDirectRegistrar();
        });
        console.log("[Admin] Registrar button handler attached");
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
            resetCertTypeSelection();
            if (studentNameInput) studentNameInput.focus();
        });
    }

    if (issueAnotherButton) {
        issueAnotherButton.addEventListener("click", function () {
            hideMessage();
            clearInputErrors();
            if (issuanceSuccessCard) issuanceSuccessCard.style.display = "none";
            resetCertTypeSelection();
            if (certificateForm) {
                certificateForm.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            if (studentNameInput) studentNameInput.focus();
        });
    }

    console.log("[Admin] script loaded");

})();