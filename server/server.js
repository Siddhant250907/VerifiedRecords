const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();

app.use(cors());
app.use(bodyParser.json());

const PORT = 3000;

// Home
app.get("/", (req, res) => {
    res.send("University Certificate Verification Backend Running 🚀");
});

// Test GET API
app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "Backend Connected Successfully!"
    });
});

// Test POST API
app.post("/api/certificate", (req, res) => {

    console.log(req.body);

    res.json({
        success: true,
        message: "Certificate Data Received",
        data: req.body
    });

});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});