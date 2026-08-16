document
    .getElementById("certificateForm")
    .addEventListener("submit", async function (e) {

        e.preventDefault();


        const certificate = {

            studentName:
                document.getElementById("studentName").value,

            rollNumber:
                document.getElementById("rollNumber").value,

            course:
                document.getElementById("course").value,

            certificateId:
                document.getElementById("certificateId").value,

            issueDate:
                document.getElementById("issueDate").value

        };


        try {

            const response = await fetch(
                "http://localhost:3000/api/certificate",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify(certificate)

                }
            );


            const result =
                await response.json();


            if (!response.ok) {

                alert(
                    "❌ " + result.message
                );

                return;

            }


            alert(
                "✅ " +
                result.message +
                "\n\nCertificate ID: " +
                result.certificate.certificateId
            );


            console.log(
                "Certificate stored:",
                result.certificate
            );


            // Clear form

            document
                .getElementById("certificateForm")
                .reset();

        }

        catch (error) {

            console.error(error);

            alert(
                "❌ Cannot connect to backend."
            );

        }

    });