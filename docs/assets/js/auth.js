// =====================================================
// FIREBASE CONFIG
// =====================================================

const firebaseConfig = {

    apiKey:
        "AIzaSyDWzv5T0GjwDAlghvi2DLmc5V6T0Pq19ps",

    authDomain:
        "verifiedrecords.firebaseapp.com",

    projectId:
        "verifiedrecords",

    storageBucket:
        "verifiedrecords.firebasestorage.app",

    messagingSenderId:
        "823611310124",

    appId:
        "1:823611310124:web:8beb8902077e4a5eebd189"

};


// =====================================================
// INITIALIZE FIREBASE
// =====================================================

if (!firebase.apps.length) {

    firebase.initializeApp(firebaseConfig);

}


const auth = firebase.auth();


// =====================================================
// CHECK LOGIN STATE
// =====================================================

auth.onAuthStateChanged(function(user) {


    const loginButton =
        document.getElementById("loginButton");


    const accountButton =
        document.getElementById("accountButton");


    const accountEmail =
        document.getElementById("accountEmail");


    if (user) {


        // =========================================
        // USER IS LOGGED IN
        // =========================================

        console.log(
            "Logged in:",
            user.email
        );


        if (loginButton) {

            loginButton.style.display =
                "none";

        }


        if (accountButton) {

            accountButton.style.display =
                "flex";

        }


        if (accountEmail) {

            accountEmail.innerText =
                user.email;

        }

    }

    else {


        // =========================================
        // USER IS NOT LOGGED IN
        // =========================================

        console.log(
            "No user logged in."
        );


        if (loginButton) {

            loginButton.style.display =
                "flex";

        }


        if (accountButton) {

            accountButton.style.display =
                "none";

        }

    }

});


// =====================================================
// ACCOUNT DROPDOWN
// =====================================================

function toggleAccountMenu() {


    const menu =
        document.getElementById(
            "accountMenu"
        );


    if (!menu) {

        return;

    }


    if (menu.style.display === "block") {

        menu.style.display =
            "none";

    }

    else {

        menu.style.display =
            "block";

    }

}


// =====================================================
// LOGOUT
// =====================================================

function logoutUser() {


    auth.signOut()

        .then(function() {


            console.log(
                "User logged out."
            );


            window.location.href =
                "index.html";


        })

        .catch(function(error) {


            console.error(
                "Logout error:",
                error
            );


        });

}


// =====================================================
// CLOSE ACCOUNT MENU WHEN CLICKING OUTSIDE
// =====================================================

document.addEventListener(
    "click",
    function(event) {


        const accountContainer =
            document.getElementById(
                "accountButton"
            );


        const menu =
            document.getElementById(
                "accountMenu"
            );


        if (
            accountContainer &&
            menu &&
            !accountContainer.contains(
                event.target
            )
        ) {

            menu.style.display =
                "none";

        }

    }
);