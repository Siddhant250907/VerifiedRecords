// =====================================================
// FIREBASE AUTHENTICATION
// =====================================================

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


// =====================================================
// CHECK LOGIN STATE
// =====================================================

auth.onAuthStateChanged(function (user) {

    const loginButton =
        document.getElementById("loginButton");

    const accountButton =
        document.getElementById("accountButton");

    const accountEmail =
        document.getElementById("accountEmail");


    if (user) {

        // ---------------------------------------------
        // USER IS LOGGED IN
        // ---------------------------------------------

        console.log("Logged in:", user.email);

        if (loginButton) {
            loginButton.style.display = "none";
        }

        if (accountButton) {
            accountButton.style.display = "block";
        }

        if (accountEmail) {
            accountEmail.textContent =
                user.email || "Logged in user";
        }

    } else {

        // ---------------------------------------------
        // USER IS NOT LOGGED IN
        // ---------------------------------------------

        console.log("User is not logged in.");

        if (loginButton) {
            loginButton.style.display = "block";
        }

        if (accountButton) {
            accountButton.style.display = "none";
        }

    }

});


// =====================================================
// ACCOUNT MENU
// =====================================================

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


// =====================================================
// LOGOUT
// =====================================================

function logoutUser() {

    auth.signOut()
        .then(function () {

            console.log("Logged out.");

            window.location.href = "index.html";

        })
        .catch(function (error) {

            console.error(
                "Logout error:",
                error
            );

        });

}


// =====================================================
// CLOSE ACCOUNT MENU WHEN CLICKING OUTSIDE
// =====================================================

document.addEventListener("click", function (event) {

    const accountButton =
        document.getElementById("accountButton");

    const accountMenu =
        document.getElementById("accountMenu");


    if (!accountButton || !accountMenu) {
        return;
    }


    if (
        !accountButton.contains(event.target) &&
        !accountMenu.contains(event.target)
    ) {

        accountMenu.style.display = "none";

    }

});