// ======================================================
// FIREBASE INITIALIZATION
// ======================================================

const firebaseConfig = {
    apiKey: "AIzaSyDWzv5T0GjwDAlghvi2DLmc5V6T0Pq19ps",
    authDomain: "verifiedrecords.firebaseapp.com",
    projectId: "verifiedrecords",
    storageBucket: "verifiedrecords.firebasestorage.app",
    messagingSenderId: "823611310124",
    appId: "1:823611310124:web:8beb8902077e4a5eebd189"
};


// Initialize Firebase only once
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();


// ======================================================
// CHECK LOGIN STATUS
// ======================================================

auth.onAuthStateChanged(function(user) {

    const loginButton =
        document.getElementById("loginButton");

    const accountButton =
        document.getElementById("accountButton");

    const accountEmail =
        document.getElementById("accountEmail");


    // ------------------------------------------
    // USER IS LOGGED IN
    // ------------------------------------------

    if (user) {

        console.log("Logged in:", user.email);

        // Hide Login / Sign Up
        if (loginButton) {
            loginButton.style.display = "none";
        }


        // Show account button
        if (accountButton) {
            accountButton.style.display = "block";
        }


        // Display email
        if (accountEmail) {
            accountEmail.textContent =
                user.email || "Logged in user";
        }

    }

    // ------------------------------------------
    // USER IS NOT LOGGED IN
    // ------------------------------------------

    else {

        console.log("User is not logged in");

        // Show Login / Sign Up
        if (loginButton) {
            loginButton.style.display = "block";
        }


        // Hide account button
        if (accountButton) {
            accountButton.style.display = "none";
        }


        // Clear email
        if (accountEmail) {
            accountEmail.textContent = "";
        }

    }

});


// ======================================================
// ACCOUNT MENU
// ======================================================

function toggleAccountMenu() {

    const menu =
        document.getElementById("accountMenu");

    if (!menu) return;

    if (menu.style.display === "block") {

        menu.style.display = "none";

    } else {

        menu.style.display = "block";

    }

}


// ======================================================
// LOGOUT
// ======================================================

function logoutUser() {

    auth.signOut()
        .then(function() {

            console.log("Logged out successfully");

            // Return to home page
            window.location.href = "index.html";

        })
        .catch(function(error) {

            console.error(
                "Logout error:",
                error
            );

        });

}


// ======================================================
// CLOSE ACCOUNT MENU WHEN CLICKING OUTSIDE
// ======================================================

document.addEventListener("click", function(event) {

    const accountContainer =
        document.querySelector(".account-container");

    const accountMenu =
        document.getElementById("accountMenu");

    if (!accountContainer || !accountMenu) {
        return;
    }


    if (!accountContainer.contains(event.target)) {

        accountMenu.style.display = "none";

    }

});