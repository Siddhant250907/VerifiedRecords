document
.getElementById("verifyBtn")
.addEventListener("click", function(){

    const id =
    document.getElementById("verifyId").value;

    if(id==""){

        alert("Enter Certificate ID");

        return;

    }

    document
    .getElementById("result")
    .innerHTML=

    `
    <div class="alert alert-info">

        Searching blockchain for
        <b>${id}</b>

    </div>
    `;

});