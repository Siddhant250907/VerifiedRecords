document
    .getElementById("verifyForm")
    .addEventListener("submit", function (e) {

        e.preventDefault();

        const certificateId =
            document.getElementById("certificateId").value;

        alert(
            "Checking certificate: " + certificateId
        );

    });