const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config();

const Certificate = require("./models/certificates");

const app = express();


// ==================================================
// MIDDLEWARE
// ==================================================

app.use(cors());
app.use(express.json());


// ==================================================
// SERVE FRONTEND
// ==================================================

app.use(
    express.static(
        path.join(__dirname, "..", "docs")
    )
);


// ==================================================
// PORT
// ==================================================

const PORT = process.env.PORT || 3000;


// ==================================================
// MONGODB CONNECTION
// ==================================================

// ==================================================
// MONGODB CONNECTION
// ==================================================

// ==================================================
// MONGODB CONNECTION
// ==================================================

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {

    console.error("❌ MONGODB_URI is missing from .env");

} else {

    mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 10000
    })
    .then(() => {

        console.log("=================================");
        console.log("✅ MongoDB Connected Successfully");
        console.log("Database:", mongoose.connection.name);
        console.log("=================================");

    })
    .catch((error) => {

        console.error("=================================");
        console.error("❌ MongoDB Connection Failed");
        console.error(error.message);
        console.error("=================================");

    });

}


// ==================================================
// HOME
// ==================================================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "docs", "index.html"));
});


// ==================================================
// TEST API
// ==================================================

app.get("/api/test", (req, res) => {

    res.json({

        success: true,

        message:
            "Backend Connected Successfully!"

    });

});


// ==================================================
// ISSUE CERTIFICATE
// ADMIN
// ==================================================

app.post("/api/certificate", async (req, res) => {

    try {

        const {

            studentName,
            rollNumber,
            course,
            certificateId,
            issueDate

        } = req.body;


        // ------------------------------------------
        // CHECK REQUIRED FIELDS
        // ------------------------------------------

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


        // ------------------------------------------
        // CHECK DUPLICATE CERTIFICATE ID
        // ------------------------------------------

        const existingCertificate =
            await Certificate.findOne({
                certificateId: certificateId
            });


        if (existingCertificate) {

            return res.status(409).json({

                success: false,

                message:
                    "Certificate ID already exists."

            });

        }


        // ------------------------------------------
        // CREATE CERTIFICATE
        // ------------------------------------------

        const newCertificate =
            new Certificate({

                studentName:
                    studentName,

                rollNumber:
                    rollNumber,

                course:
                    course,

                certificateId:
                    certificateId,

                issueDate:
                    issueDate,

                issuedAt:
                    new Date()

            });


        // ------------------------------------------
        // SAVE TO MONGODB
        // ------------------------------------------

        await newCertificate.save();


        console.log(
            "Certificate issued:",
            certificateId
        );


        // ------------------------------------------
        // SEND RESPONSE
        // ------------------------------------------

        res.status(201).json({

            success: true,

            message:
                "Certificate issued successfully.",

            certificate:
                newCertificate

        });

    }

    catch (error) {

        console.error(
            "Issue Certificate Error:",
            error
        );


        res.status(500).json({

            success: false,

            message:
                "Server error."

        });

    }

});


// ==================================================
// VERIFY CERTIFICATE
// USER
// ==================================================

app.get(
    "/api/certificate/:certificateId",
    async (req, res) => {

        try {

            const certificateId =
                req.params.certificateId;


            // --------------------------------------
            // SEARCH MONGODB
            // --------------------------------------

            const certificate =
                await Certificate.findOne({

                    certificateId:
                        new RegExp(
                            `^${certificateId}$`,
                            "i"
                        )

                });


            // --------------------------------------
            // CERTIFICATE NOT FOUND
            // --------------------------------------

            if (!certificate) {

                return res.status(404).json({

                    success: false,

                    verified: false,

                    message:
                        "Certificate not found."

                });

            }


            // --------------------------------------
            // CERTIFICATE FOUND
            // --------------------------------------

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

            console.error(
                "Verify Certificate Error:",
                error
            );


            res.status(500).json({

                success: false,

                verified: false,

                message:
                    "Server error."

            });

        }

    }
);


// ==================================================
// START SERVER
// ==================================================

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `VerifiedRecords running on port ${PORT}`
    );

});