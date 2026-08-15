const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve the frontend folder
app.use(express.static("../frontend"));

// Home page
app.get("/", (req, res) => {
    res.sendFile("index.html", {
        root: "../frontend"
    });
});

// Test API
app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Backend Connected Successfully!"
    });
});

// Certificate API
app.post("/api/certificate", (req, res) => {

    console.log("Certificate received:");
    console.log(req.body);

    res.json({
        success: true,
        message: "Certificate Data Received",
        data: req.body
    });

});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});