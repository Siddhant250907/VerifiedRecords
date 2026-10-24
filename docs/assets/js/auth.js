// ==========================================================================
// VERIFIEDRECORDS — AUTHENTICATION & NAVBAR CONTROLLER
// Academic Credential Verification & Document Security Platform
// ==========================================================================

// --------------------------------------------------------------------------
// 1. LIGHT THEME ENFORCEMENT (SAND & CYPRUS GREEN PALETTE)
// --------------------------------------------------------------------------
document.documentElement.setAttribute("data-theme", "light");
try {
    localStorage.removeItem("vr_theme");
} catch (e) {}

// --------------------------------------------------------------------------
// 2. FIREBASE INITIALIZATION
// --------------------------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyDWzv5T0GjwDAlghvi2DLmc5V6T0Pq19ps",
    authDomain: "verifiedrecords.firebaseapp.com",
    projectId: "verifiedrecords",
    storageBucket: "verifiedrecords.firebasestorage.app",
    messagingSenderId: "823611310124",
    appId: "1:823611310124:web:8beb8902077e4a5eebd189"
};

if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();

// --------------------------------------------------------------------------
// 3. AUTHENTICATION STATE MONITOR (SINGLE SOURCE OF TRUTH)
// --------------------------------------------------------------------------
function updateNavbarUserDisplay(name) {
    const navUserName = document.getElementById("navUserName");
    const welcomeUserNav = document.getElementById("welcomeUserNav");
    if (navUserName && name) {
        navUserName.textContent = name;
    }
    if (welcomeUserNav) {
        welcomeUserNav.style.display = "inline-flex";
    }
}

// Instant initialization from cache so the user name appears immediately without waiting
function initCachedUserDisplay() {
    try {
        const cachedName = localStorage.getItem("vr_username");
        if (cachedName) {
            updateNavbarUserDisplay(cachedName);
            const accBtn = document.getElementById("accountButton");
            const authLoggedOut = document.getElementById("authLoggedOutNav");
            const loginBtn = document.getElementById("loginButton");
            const signupBtn = document.getElementById("signupButton");
            if (accBtn) {
                accBtn.style.display = "inline-flex";
                accBtn.classList.remove("auth-hidden");
            }
            if (authLoggedOut) {
                authLoggedOut.style.display = "none";
                authLoggedOut.classList.add("auth-hidden");
            }
            if (loginBtn) loginBtn.classList.add("auth-hidden");
            if (signupBtn) signupBtn.classList.add("auth-hidden");
        }
    } catch (e) {}
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initCachedUserDisplay);
} else {
    initCachedUserDisplay();
}

auth.onAuthStateChanged(function(user) {
    const authLoggedOutNav = document.getElementById("authLoggedOutNav");
    const loginButton = document.getElementById("loginButton");
    const signupButton = document.getElementById("signupButton");
    const accountButton = document.getElementById("accountButton");
    const accountEmail = document.getElementById("accountEmail");
    const accountMenu = document.getElementById("accountMenu");
    const loadingScreen = document.getElementById("loading");
    const legacyUserEmail = document.getElementById("userEmail");

    // Detect if current page is protected admin dashboard
    const isProtectedAdminPage = window.location.pathname.toLowerCase().includes("admin.html");

    // ----------------------------------------------------------------------
    // STATE A: USER IS AUTHENTICATED
    // ----------------------------------------------------------------------
    if (user) {
        console.log("VerifiedRecords Auth: Signed in as", user.email);

        // Hide Logged-Out navigation controls strictly
        if (authLoggedOutNav) {
            authLoggedOutNav.style.display = "none";
            authLoggedOutNav.classList.add("auth-hidden");
        }
        if (loginButton) {
            loginButton.style.display = "none";
            loginButton.classList.add("auth-hidden");
        }
        if (signupButton) {
            signupButton.style.display = "none";
            signupButton.classList.add("auth-hidden");
        }

        // Show Account button strictly
        if (accountButton) {
            accountButton.style.display = "inline-flex";
            accountButton.classList.remove("auth-hidden");
        }

        // Show Welcome, UserName on left side of the boxy logo
        const storedUsername = localStorage.getItem("vr_username");
        const initialDisplayName = storedUsername || user.displayName || (user.email ? user.email.split("@")[0] : "User");
        updateNavbarUserDisplay(initialDisplayName);

        // Populate User Email in dropdown
        if (accountEmail) {
            accountEmail.innerHTML = '<span class="account-email-label">Signed in as</span><strong class="account-email-address">' + (user.email || "Verified User") + '</strong>';
        }

        // Populate legacy admin email if present
        if (legacyUserEmail) {
            legacyUserEmail.textContent = user.email || "";
        }

        // Remove loading overlay on protected pages
        if (loadingScreen) {
            loadingScreen.style.display = "none";
        }

        // Persist and sync user account details in MongoDB
        syncUserAccountToMongo(user);
    }

    // ----------------------------------------------------------------------
    // STATE B: USER IS NOT AUTHENTICATED (LOGGED OUT)
    // ----------------------------------------------------------------------
    else {
        console.log("VerifiedRecords Auth: No active session");

        // Hide welcome banner and account button strictly
        const welcomeUserNav = document.getElementById("welcomeUserNav");
        if (welcomeUserNav) {
            welcomeUserNav.style.display = "none";
        }

        if (accountButton) {
            accountButton.style.display = "none";
            accountButton.classList.add("auth-hidden");
        }

        // Show Logged-Out navigation controls strictly
        if (authLoggedOutNav) {
            authLoggedOutNav.style.display = "inline-flex";
            authLoggedOutNav.classList.remove("auth-hidden");
        }
        if (loginButton) {
            loginButton.style.display = "inline-flex";
            loginButton.classList.remove("auth-hidden");
        }
        if (signupButton) {
            signupButton.style.display = "inline-flex";
            signupButton.classList.remove("auth-hidden");
        }

        // Clear email
        if (accountEmail) {
            accountEmail.innerHTML = "";
        }

        // Close dropdown if open
        if (accountMenu) {
            accountMenu.classList.remove("show");
            accountMenu.style.display = "none";
        }

        // Enforce Protected Route Guard on Admin Page
        if (isProtectedAdminPage) {
            console.warn("Unauthorized access to admin page. Redirecting to login...");
            window.location.href = "login.html";
        }
    }
});

// --------------------------------------------------------------------------
// 4. ACCOUNT DROPDOWN MENU
// --------------------------------------------------------------------------
function toggleAccountMenu() {
    const menu = document.getElementById("accountMenu");
    const trigger = document.getElementById("accountMenuTrigger") || document.querySelector(".account-button");
    if (!menu) return;

    const isOpen = menu.classList.contains("show") || menu.style.display === "block";

    if (isOpen) {
        menu.classList.remove("show");
        menu.style.display = "none";
        if (trigger) trigger.setAttribute("aria-expanded", "false");
    } else {
        menu.classList.add("show");
        menu.style.display = "block";
        if (trigger) trigger.setAttribute("aria-expanded", "true");
    }
}

// --------------------------------------------------------------------------
// 5. LOGOUT HANDLER
// --------------------------------------------------------------------------
function logoutUser() {
    const accountMenu = document.getElementById("accountMenu");
    if (accountMenu) {
        accountMenu.classList.remove("show");
        accountMenu.style.display = "none";
    }
    try {
        localStorage.removeItem("vr_username");
        sessionStorage.removeItem("vr_admin_session");
    } catch (e) {}

    auth.signOut()
        .then(function() {
            console.log("VerifiedRecords Auth: Signed out successfully");
            window.location.href = "index.html";
        })
        .catch(function(error) {
            console.error("VerifiedRecords Auth: Logout error", error);
            alert("Error logging out. Please try again.");
        });
}

// --------------------------------------------------------------------------
// 6. USER ACCOUNT SYNC TO MONGODB
// --------------------------------------------------------------------------
function syncUserAccountToMongo(user, additionalProfile = {}) {
    if (!user || !user.email) return Promise.resolve();

    const payload = {
        email: user.email,
        uid: user.uid || null,
        provider: user.providerData && user.providerData[0] ? user.providerData[0].providerId : "password",
        firstName: additionalProfile.firstName || "",
        lastName: additionalProfile.lastName || "",
        username: additionalProfile.username || "",
        dateOfBirth: additionalProfile.dateOfBirth || null,
        phoneNumber: additionalProfile.phoneNumber || ""
    };

    return fetch("/api/auth/sync-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.success) {
            console.log("VerifiedRecords: User account saved in MongoDB:", user.email);
            if (data.user && data.user.username) {
                localStorage.setItem("vr_username", data.user.username);
                updateNavbarUserDisplay(data.user.username);
            } else if (additionalProfile.username) {
                localStorage.setItem("vr_username", additionalProfile.username);
                updateNavbarUserDisplay(additionalProfile.username);
            }
        }
        return data;
    })
    .catch(err => {
        console.warn("VerifiedRecords: MongoDB user sync notice:", err.message);
    });
}

// --------------------------------------------------------------------------
// 7. SOCIAL AUTHENTICATION (GOOGLE, APPLE)
// --------------------------------------------------------------------------

// Handle OAuth redirect return on page load (essential for mobile & Safari Apple OAuth)
auth.getRedirectResult()
    .then(result => {
        if (result && result.user) {
            const user = result.user;
            console.log("VerifiedRecords: Signed in via OAuth redirect:", user.email || user.uid);
            let additional = {};
            if (result.additionalUserInfo && result.additionalUserInfo.profile) {
                const profile = result.additionalUserInfo.profile;
                if (profile.name) {
                    additional.firstName = profile.name.firstName || "";
                    additional.lastName = profile.name.lastName || "";
                }
            }
            return syncUserAccountToMongo(user, additional).then(() => {
                const redirect = new URLSearchParams(window.location.search).get("redirect") || "dashboard.html";
                window.location.href = redirect;
            });
        }
    })
    .catch(error => {
        console.warn("VerifiedRecords: OAuth redirect notice:", error.code, error.message);
    });

function displaySocialAuthError(error, providerName, alertElementId) {
    const alertBox = alertElementId ? document.getElementById(alertElementId) : null;
    let message = error.message;

    if (error.code === "auth/operation-not-allowed" || error.code === "auth/configuration-not-found") {
        if (providerName.toLowerCase() === "apple") {
            message = "Apple Sign-In is configured. Please ensure Apple Provider is enabled in your Firebase Console (Authentication -> Sign-in method -> Apple) with your Apple Services ID & Team ID.";
        } else {
            message = `${providerName} Sign-In is not enabled in Firebase Console.`;
        }
    } else if (error.code === "auth/popup-closed-by-user") {
        message = "Sign-in popup was closed before completing.";
    } else if (error.code === "auth/cancelled-popup-request") {
        message = "Only one sign-in window allowed at a time.";
    } else if (error.code === "auth/unauthorized-domain") {
        message = "This domain is not authorized in Firebase Console -> Authentication -> Settings -> Authorized domains.";
    }

    if (alertBox) {
        alertBox.textContent = message;
        alertBox.style.display = "block";
        if (alertBox.classList.contains("signup-message-box") || alertElementId === "signupAlert") {
            alertBox.className = "signup-message-box error";
        } else if (alertBox.classList.contains("auth-message-box") || alertElementId === "authAlert") {
            alertBox.className = "auth-message-box error";
        } else {
            alertBox.className = "auth-alert alert-error";
        }
    } else {
        alert(message);
    }
}

function handleSocialAuth(provider, providerName, alertElementId) {
    const alertBox = alertElementId ? document.getElementById(alertElementId) : null;

    if (alertBox) {
        alertBox.style.display = "none";
        alertBox.textContent = "";
    }

    auth.signInWithPopup(provider)
        .then(result => {
            const user = result.user;
            console.log(`VerifiedRecords: Signed in via ${providerName}:`, user.email || user.uid);
            let additional = {};
            if (result.additionalUserInfo && result.additionalUserInfo.profile) {
                const profile = result.additionalUserInfo.profile;
                if (profile.name) {
                    additional.firstName = profile.name.firstName || "";
                    additional.lastName = profile.name.lastName || "";
                }
            }
            return syncUserAccountToMongo(user, additional).then(() => {
                const redirect = new URLSearchParams(window.location.search).get("redirect") || "dashboard.html";
                window.location.href = redirect;
            });
        })
        .catch(error => {
            console.warn(`${providerName} popup error:`, error.code, error.message);

            // If popup is blocked by browser (common on Safari / iOS), smoothly fall back to redirect
            if (error.code === "auth/popup-blocked") {
                console.log(`VerifiedRecords: Popup blocked for ${providerName}. Redirecting to sign in...`);
                auth.signInWithRedirect(provider).catch(redirectErr => {
                    displaySocialAuthError(redirectErr, providerName, alertElementId);
                });
                return;
            }

            displaySocialAuthError(error, providerName, alertElementId);
        });
}

function loginWithGoogle(alertElementId = "message") {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope("profile");
    provider.addScope("email");
    handleSocialAuth(provider, "Google", alertElementId);
}

function loginWithApple(alertElementId = "message") {
    const provider = new firebase.auth.OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    handleSocialAuth(provider, "Apple", alertElementId);
}

// --------------------------------------------------------------------------
// 8. DISMISS DROPDOWN ON OUTSIDE CLICK
// --------------------------------------------------------------------------
document.addEventListener("click", function(event) {
    const accountButton = document.getElementById("accountButton") || document.querySelector(".account-container");
    const accountMenu = document.getElementById("accountMenu");

    if (!accountButton || !accountMenu) return;

    if (!accountButton.contains(event.target)) {
        accountMenu.classList.remove("show");
        accountMenu.style.display = "none";
        const trigger = document.getElementById("accountMenuTrigger") || document.querySelector(".account-button");
        if (trigger) trigger.setAttribute("aria-expanded", "false");
    }
});