// ==========================================================================
// VERIFIEDRECORDS — AUTHENTICATION & NAVBAR CONTROLLER
// Academic Blockchain Credential Verification System
// ==========================================================================

// --------------------------------------------------------------------------
// 1. THEME CONTROLLER (LIGHT / DARK THEME TOGGLE)
// --------------------------------------------------------------------------
function initTheme() {
    const savedTheme = localStorage.getItem("vr_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    const icon = document.getElementById("themeToggleIcon");
    if (!icon) return;

    if (theme === "light") {
        icon.className = "fa-solid fa-moon";
        icon.setAttribute("title", "Switch to Dark Mode");
    } else {
        icon.className = "fa-solid fa-sun";
        icon.setAttribute("title", "Switch to Light Mode");
    }
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
    const nextTheme = currentTheme === "dark" ? "light" : "dark";

    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("vr_theme", nextTheme);
    updateThemeIcon(nextTheme);
}

// Run theme init immediately to prevent flash of wrong theme
initTheme();

// Attach listener once DOM is ready
document.addEventListener("DOMContentLoaded", function() {
    initTheme();
    const themeBtn = document.getElementById("themeToggle");
    if (themeBtn) {
        themeBtn.addEventListener("click", toggleTheme);
    }
});


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

// Initialize Firebase only once across all pages
if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();


// --------------------------------------------------------------------------
// 3. AUTHENTICATION STATE MONITOR (SINGLE SOURCE OF TRUTH)
// --------------------------------------------------------------------------
auth.onAuthStateChanged(function(user) {
    const loginButton = document.getElementById("loginButton");
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

        // Hide Login / Sign Up button strictly (both display none and class)
        if (loginButton) {
            loginButton.style.display = "none";
            loginButton.classList.add("auth-hidden");
        }

        // Show Account button strictly
        if (accountButton) {
            accountButton.style.display = "flex";
            accountButton.classList.remove("auth-hidden");
        }

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
    }

    // ----------------------------------------------------------------------
    // STATE B: USER IS NOT AUTHENTICATED (LOGGED OUT)
    // ----------------------------------------------------------------------
    else {
        console.log("VerifiedRecords Auth: No active session");

        // Hide Account button strictly
        if (accountButton) {
            accountButton.style.display = "none";
            accountButton.classList.add("auth-hidden");
        }

        // Show Login / Sign Up button strictly
        if (loginButton) {
            loginButton.style.display = "inline-flex";
            loginButton.classList.remove("auth-hidden");
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
// 6. DISMISS DROPDOWN ON OUTSIDE CLICK
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