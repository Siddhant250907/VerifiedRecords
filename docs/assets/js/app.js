// ==========================================================================
// VERIFIEDRECORDS — GLOBAL APP UTILITIES & INTERACTIVE CURSOR EFFECTS
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {

    // 1. Interactive Cursor Coordinates for Dynamic Background Spotlight & Grid Hover
    const updateCursorPosition = (e) => {
        document.documentElement.style.setProperty('--cursor-x', `${e.clientX}px`);
        document.documentElement.style.setProperty('--cursor-y', `${e.clientY}px`);
    };

    window.addEventListener('mousemove', updateCursorPosition, { passive: true });

    // 2. Navigation Item Click Feedback Animation
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

    // 3. Interactive Background Block / Card Tilt & Glow Micro-effects
    const interactiveBlocks = document.querySelectorAll('.attribute-pill, .step-card, .role-card, .about-card, .tech-item');
    interactiveBlocks.forEach(block => {
        block.addEventListener('mousemove', (e) => {
            const rect = block.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            block.style.setProperty('--block-x', `${x}px`);
            block.style.setProperty('--block-y', `${y}px`);
        });
    });

});