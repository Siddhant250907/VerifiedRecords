document.addEventListener("DOMContentLoaded", () => {

    const links = document.querySelectorAll(
        ".nav-item, .nav-link, .login-button"
    );

    links.forEach(link => {

        link.addEventListener("click", function () {

            this.classList.add("clicked");

            setTimeout(() => {

                this.classList.remove("clicked");

            }, 350);

        });

    });

});