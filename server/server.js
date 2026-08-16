const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(cors());
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, "..", "docs")));

const PORT = 3000;

// ===============================
// DATABASE FILE
// ===============================

const dataFile = path.join(
    __dirname,
    "data",
    "certificates.json"
);


// ===============================
// READ CERTIFICATES
// ===============================

function getCertificates() {

    const data = fs.readFileSync(
        dataFile,
        "utf8"
    );

    return JSON.parse(data);
}


// ===============================
// SAVE CERTIFICATES
// ===============================

function saveCertificates(certificates) {

    fs.writeFileSync(
        dataFile,
        JSON.stringify(certificates, null, 4)
    );
}


// ===============================
// HOME
// ===============================



// ===============================
// TEST API
// ===============================

app.get("/api/test", (req, res) => {

    res.json({

        success: true,

        message:
            "Backend Connected Successfully!"

    });

});


// ===============================
// ISSUE CERTIFICATE
// ADMIN
// ===============================

app.post("/api/certificate", (req, res) => {

    try {

        const {

            studentName,
            rollNumber,
            course,
            certificateId,
            issueDate

        } = req.body;


        // Check required fields

        if (
            !studentName ||
            !rollNumber ||
            !course ||
            !certificateId ||
            !issueDate
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "All certificate fields are required."

            });

        }


        // Get existing certificates

        const certificates =
            getCertificates();


        // Check duplicate Certificate ID

        const existingCertificate =
            certificates.find(
                certificate =>
                    certificate.certificateId ===
                    certificateId
            );


        if (existingCertificate) {

            return res.status(409).json({

                success: false,

                message:
                    "Certificate ID already exists."

            });

        }


        // Create certificate

        const newCertificate = {

            studentName,
            rollNumber,
            course,
            certificateId,
            issueDate,

            issuedAt:
                new Date().toISOString()

        };


        // Add certificate

        certificates.push(
            newCertificate
        );


        // Save certificate

        saveCertificates(
            certificates
        );


        console.log(
            "Certificate issued:",
            newCertificate
        );


        res.status(201).json({

            success: true,

            message:
                "Certificate issued successfully.",

            certificate:
                newCertificate

        });

    }

    catch (error) {

        console.error(error);

        res.status(500).json({

            success: false,

            message:
                "Server error."

        });

    }

});


// ===============================
// VERIFY CERTIFICATE
// USER
// ===============================

app.get(
    "/api/certificate/:certificateId",
    (req, res) => {

        try {

            const certificateId =
                req.params.certificateId;


            const certificates =
                getCertificates();


            // Search certificate

            const certificate =
                certificates.find(
                    certificate =>
                        certificate.certificateId
                        .toLowerCase() ===
                        certificateId.toLowerCase()
                );


            // Certificate not found

            if (!certificate) {

                return res.status(404).json({

                    success: false,

                    verified: false,

                    message:
                        "Certificate not found."

                });

            }


            // Certificate found

            res.json({

                success: true,

                verified: true,

                message:
                    "Certificate verified successfully.",

                certificate:
                    certificate

            });

        }

        catch (error) {

            console.error(error);

            res.status(500).json({

                success: false,

                message:
                    "Server error."

            });

        }

    }
);


// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {

    console.log(
        `VerifiedRecords Backend running on http://localhost:${PORT}`
    );

});