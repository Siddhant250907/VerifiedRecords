console.log("Admin JS Loaded");

document.getElementById("certificateForm").addEventListener("submit", async (e) => {

    e.preventDefault();

    const certificate = {
        studentName: document.getElementById("studentName").value,
        rollNumber: document.getElementById("rollNumber").value,
        course: document.getElementById("course").value,
        certificateId: document.getElementById("certificateId").value,
        issueDate: document.getElementById("issueDate").value
    };

    try {

        const response = await fetch("http://localhost:3000/api/certificate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(certificate)
        });

        const result = await response.json();

        console.log(result);

        alert(result.message);

    } catch (error) {

        console.error(error);

        alert("Cannot connect to backend.");

    }

});