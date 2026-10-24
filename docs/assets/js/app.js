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

    // 4. Accessible Documents Navbar Dropdown Controller
    const navDropdowns = document.querySelectorAll(".nav-dropdown");
    navDropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector(".nav-dropdown-btn");
        const menu = dropdown.querySelector(".nav-dropdown-menu");

        if (!trigger || !menu) return;

        trigger.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = dropdown.classList.contains("show");
            
            navDropdowns.forEach(d => {
                if (d !== dropdown) {
                    d.classList.remove("show");
                    const otherBtn = d.querySelector(".nav-dropdown-btn");
                    if (otherBtn) otherBtn.setAttribute("aria-expanded", "false");
                }
            });

            if (isOpen) {
                dropdown.classList.remove("show");
                trigger.setAttribute("aria-expanded", "false");
            } else {
                dropdown.classList.add("show");
                trigger.setAttribute("aria-expanded", "true");
            }
        });

        dropdown.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                dropdown.classList.remove("show");
                trigger.setAttribute("aria-expanded", "false");
                trigger.focus();
            }
        });
    });

    document.addEventListener("click", (e) => {
        navDropdowns.forEach(dropdown => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove("show");
                const btn = dropdown.querySelector(".nav-dropdown-btn");
                if (btn) btn.setAttribute("aria-expanded", "false");
            }
        });
    });

    // 5. Global Floating Dots Background Canvas with Cursor Repulsion
    initGlobalBackgroundParticles();
});

// --------------------------------------------------------------------------
// GLOBAL BACKGROUND PARTICLES WITH CURSOR REPULSION
// --------------------------------------------------------------------------
function initGlobalBackgroundParticles() {
    // If on homepage with heroParticlesCanvas handled by home.js, do not conflict
    if (document.getElementById("heroParticlesCanvas")) return;

    let canvas = document.getElementById("bgParticlesCanvas");
    if (!canvas) {
        canvas = document.createElement("canvas");
        canvas.id = "bgParticlesCanvas";
        canvas.className = "bg-particles-canvas";
        canvas.setAttribute("aria-hidden", "true");
        document.body.prepend(canvas);
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let dpr = window.devicePixelRatio || 1;
    let particles = [];
    let isVisible = true;
    let isTabActive = true;
    let animationFrameId = null;

    const mouse = {
        x: null,
        y: null,
        active: false,
        radius: 110 // Repulsion radius threshold
    };

    function resizeCanvas() {
        width = window.innerWidth;
        height = window.innerHeight;
        dpr = window.devicePixelRatio || 1;

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
    }

    class Dot {
        constructor() {
            this.reset(true);
        }

        reset(initial = false) {
            this.x = initial ? Math.random() * width : (Math.random() > 0.5 ? 0 : width);
            this.y = Math.random() * height;
            // Varied slow, calm drift
            this.baseVx = (Math.random() - 0.5) * 0.32;
            this.baseVy = (Math.random() - 0.5) * 0.32;
            this.vx = this.baseVx;
            this.vy = this.baseVy;
            this.radius = 1.4 + Math.random() * 1.4; // Small, restrained 1.4 - 2.8px
            this.isGreen = Math.random() > 0.45;
            this.color = this.isGreen
                ? `rgba(0, 71, 65, ${(0.13 + Math.random() * 0.09).toFixed(3)})`
                : `rgba(165, 155, 138, ${(0.22 + Math.random() * 0.12).toFixed(3)})`;
        }

        update() {
            if (mouse.active && mouse.x !== null && mouse.y !== null) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const dist = Math.hypot(dx, dy);

                if (dist < mouse.radius && dist > 0) {
                    const force = (mouse.radius - dist) / mouse.radius;
                    const angle = Math.atan2(dy, dx);
                    this.vx += Math.cos(angle) * force * 0.70;
                    this.vy += Math.sin(angle) * force * 0.70;
                }
            }

            this.vx *= 0.95;
            this.vy *= 0.95;

            if (Math.abs(this.vx) < Math.abs(this.baseVx)) this.vx += this.baseVx * 0.08;
            if (Math.abs(this.vy) < Math.abs(this.baseVy)) this.vy += this.baseVy * 0.08;

            this.x += this.vx;
            this.y += this.vy;

            if (this.x < -15) this.x = width + 15;
            else if (this.x > width + 15) this.x = -15;

            if (this.y < -15) this.y = height + 15;
            else if (this.y > height + 15) this.y = -15;
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
    }

    function initParticlesList() {
        particles = [];
        const count = Math.min(Math.max(Math.floor((width * height) / 16000), 50), 85);
        for (let i = 0; i < count; i++) {
            particles.push(new Dot());
        }
    }

    function renderLoop() {
        if (!isVisible || !isTabActive) {
            animationFrameId = null;
            return;
        }

        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }

        animationFrameId = requestAnimationFrame(renderLoop);
    }

    function onPointerMove(e) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
    }

    function onPointerLeave() {
        mouse.active = false;
        mouse.x = null;
        mouse.y = null;
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("blur", onPointerLeave, { passive: true });

    let resizeTimer = null;
    window.addEventListener("resize", () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            resizeCanvas();
            initParticlesList();
            if (prefersReducedMotion) {
                ctx.clearRect(0, 0, width, height);
                particles.forEach((p) => p.draw());
            }
        }, 120);
    });

    document.addEventListener("visibilitychange", () => {
        isTabActive = document.visibilityState === "visible";
        if (isTabActive && isVisible && !animationFrameId && !prefersReducedMotion) {
            animationFrameId = requestAnimationFrame(renderLoop);
        }
    });

    resizeCanvas();
    initParticlesList();

    if (prefersReducedMotion) {
        particles.forEach((p) => p.draw());
    } else {
        renderLoop();
    }
}