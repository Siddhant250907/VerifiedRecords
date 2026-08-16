document
    .getElementById("verifyForm")
    .addEventListener("submit", async function (e) {

        e.preventDefault();


        const certificateId =
            document
                .getElementById("certificateId")
                .value
                .trim();


        if (!certificateId) {

            alert(
                "Please enter a Certificate ID."
            );

            return;

        }


        try {

            const response = await fetch(
                `http://localhost:3000/api/certificate/${encodeURIComponent(certificateId)}`
            );


            const result =
                await response.json();


            // =========================
            // CERTIFICATE NOT FOUND
            // =========================

            if (!response.ok) {

                alert(
                    "❌ Certificate NOT Verified\n\n" +
                    result.message
                );

                return;

            }


            // =========================
            // CERTIFICATE FOUND
            // =========================

            if (result.verified) {

                const certificate =
                    result.certificate;


                alert(
                    "✅ CERTIFICATE VERIFIED\n\n" +

                    "Student: " +
                    certificate.studentName +

                    "\nRoll Number: " +
                    certificate.rollNumber +

                    "\nCourse: " +
                    certificate.course +

                    "\nCertificate ID: " +
                    certificate.certificateId +

                    "\nIssue Date: " +
                    certificate.issueDate
                );


                console.log(
                    "Verified certificate:",
                    certificate
                );

            }

        }

        catch (error) {

            console.error(error);

            alert(
                "❌ Cannot connect to backend."
            );

        }

    });