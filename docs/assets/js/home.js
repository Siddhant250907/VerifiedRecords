// ==========================================================================
// VERIFIEDRECORDS — HOMEPAGE CONTROLLER
// Calligraphic Intro Reveal, Scroll Dispersion, Video Cards & Live Statistics
// ==========================================================================

// --------------------------------------------------------------------------
// 1. CENTRALIZED VIDEO CONFIGURATION
// Easily replace temporary demonstration animations by placing MP4 files into:
// - docs/assets/videos/administrative-demo.mp4
// - docs/assets/videos/verification-demo.mp4
// - docs/assets/videos/document-uploads-demo.mp4
// --------------------------------------------------------------------------
const VIDEO_CONFIG = {
    administrative: {
        id: "administrative",
        title: "Administrative",
        subtitle: "Learn how authorized registrars issue and manage verified university credentials",
        src: "/assets/videos/administrative.mp4",
        badge: "Registrar Guide",
        steps: [
            "Open the Registrar Portal.",
            "Sign in with the appropriate administrator account.",
            "Enter and review the certificate details.",
            "Submit the issuance request.",
            "Complete the required confirmation.",
            "Review the result."
        ]
    },
    verification: {
        id: "verification",
        title: "Verification",
        subtitle: "Instantly check the authenticity and conferral details of any issued credential",
        src: "/assets/videos/verification.mp4",
        badge: "Public Verification",
        steps: [
            "Open the verification page.",
            "Enter the certificate details required by the real form.",
            "Submit the request.",
            "Review the verification result.",
            "Download or print the certificate only when the existing application supports it and verification succeeds."
        ]
    },
    documents: {
        id: "documents",
        title: "Document Uploads",
        subtitle: "Safeguard personal academic and identity documents in your encrypted vault",
        src: "/assets/videos/document-uploads.mp4",
        badge: "Secure Vault",
        steps: [
            "Open the document vault.",
            "Create or open the required vault.",
            "Unlock it using the vault password.",
            "Select the document category.",
            "Upload and save the document.",
            "Return to the vault to view or download it.",
        ]
    }
};

// Canvas animation state storage
const canvasAnimations = {};
let activeModalTriggerCard = null;

// --------------------------------------------------------------------------
// 2. FIRST-OPEN TYPEWRITER BRAND REVEAL & FLIP SLIDE TRANSITION
// --------------------------------------------------------------------------
function initHeroTypewriterIntro() {
    const overlay = document.getElementById("heroIntroOverlay");
    const backdrop = document.getElementById("heroIntroBackdrop");
    const introTitle = document.getElementById("introBrandTitle");
    const heroBrandName = document.getElementById("heroBrandName");
    const heroTagline = document.getElementById("heroBrandTagline");
    const heroGraphicCol = document.getElementById("heroGraphicCol");
    const heroServices = document.getElementById("heroServicesSection");

    if (!heroBrandName) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Fast path if reduced motion is requested
    if (prefersReducedMotion || !overlay || !introTitle) {
        if (overlay) overlay.style.display = "none";
        heroBrandName.style.visibility = "visible";
        heroBrandName.style.opacity = "1";
        if (heroTagline) heroTagline.classList.add("revealed");
        if (heroGraphicCol) heroGraphicCol.classList.add("revealed");
        if (heroServices) heroServices.classList.add("revealed");
        return;
    }

    // Hide real heading initially so no duplicate text appears beneath the blur
    heroBrandName.style.visibility = "hidden";
    heroBrandName.style.opacity = "0";

    const brandText = "Verified Records";
    introTitle.innerHTML = "";

    const charSpans = [];
    Array.from(brandText).forEach((char) => {
        const span = document.createElement("span");
        span.className = "intro-char" + (char === " " ? " intro-space" : "");
        span.textContent = char === " " ? "\u00A0" : char;
        introTitle.appendChild(span);
        charSpans.push(span);
    });

    // 1. Typewriter Letter Reveal (~70ms interval = ~1.12s total duration)
    let charIndex = 0;
    const typingInterval = setInterval(() => {
        if (charIndex < charSpans.length) {
            charSpans[charIndex].classList.add("typed");
            charIndex++;
        } else {
            clearInterval(typingInterval);
            onTypingComplete();
        }
    }, 70);

    function onTypingComplete() {
        // Hold complete title very briefly before sliding
        setTimeout(() => {
            executeFLIPTransition();
        }, 220);
    }

    function executeFLIPTransition() {
        // Measure start (center of viewport) vs target (real hero heading)
        const introRect = introTitle.getBoundingClientRect();
        const targetRect = heroBrandName.getBoundingClientRect();

        const deltaX = targetRect.left - introRect.left;
        const deltaY = targetRect.top - introRect.top;
        const scale = targetRect.height / (introRect.height || 1);

        // Slide title from center into exact settled heading position
        introTitle.style.transition = "transform 0.78s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.78s cubic-bezier(0.16, 1, 0.3, 1)";
        introTitle.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scale})`;

        // Progressively remove blur
        if (backdrop) {
            backdrop.classList.add("backdrop-cleared");
        }

        // When transition completes: hand off seamlessly to real accessible heading
        setTimeout(() => {
            heroBrandName.style.visibility = "visible";
            heroBrandName.style.opacity = "1";
            overlay.style.display = "none";

            // Sequential Reveals:
            // 6. Show tagline after heading settles
            setTimeout(() => {
                if (heroTagline) heroTagline.classList.add("revealed");
            }, 180);

            // 7. Reveal certificate illustration from the right side after tagline begins appearing
            setTimeout(() => {
                if (heroGraphicCol) heroGraphicCol.classList.add("revealed");
            }, 380);

            // 8. Reveal buttons and rest of hero in settled positions
            setTimeout(() => {
                if (heroServices) heroServices.classList.add("revealed");
            }, 580);
        }, 790);
    }
}

// --------------------------------------------------------------------------
// 2A. TAGLINE LETTER DISPERSION & SCROLL-LINKED HERO NARRATIVE
// --------------------------------------------------------------------------
function initHeroAnimations() {
    const brandName = document.getElementById("heroBrandName");
    const visualTagline = document.getElementById("visualTagline");
    const brandTagline = document.getElementById("heroBrandTagline");
    const heroServices = document.getElementById("heroServicesSection");
    const graphicCol = document.getElementById("heroGraphicCol");

    if (!brandName) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Tagline Character Dispersion Preparation
    if (visualTagline) {
        const text = visualTagline.textContent.trim();
        visualTagline.innerHTML = "";
        const chars = Array.from(text);

        chars.forEach((char, index) => {
            const span = document.createElement("span");
            span.className = "tagline-char";
            span.textContent = char;
            const normalizedPos = (index / (chars.length - 1)) - 0.5; // -0.5 to 0.5
            const angle = normalizedPos * Math.PI * 0.85;
            span.dataset.dx = (Math.sin(angle) * (65 + Math.abs(normalizedPos) * 150)).toFixed(1);
            span.dataset.dy = (-Math.cos(angle) * (38 + (index % 3) * 26)).toFixed(1);
            span.dataset.rot = (normalizedPos * 42).toFixed(1);
            visualTagline.appendChild(span);
        });
    }

    if (prefersReducedMotion) return;

    // 3. Scroll-Linked Horizontal Heading & Outward Character Dispersal
    let isTicking = false;

    function onHeroScroll() {
        if (!isTicking) {
            requestAnimationFrame(() => {
                updateHeroScrollNarrative();
                isTicking = false;
            });
            isTicking = true;
        }
    }

    function updateHeroScrollNarrative() {
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        const heroEl = brandName.closest(".hero-minimal");
        const heroHeight = heroEl ? heroEl.offsetHeight : 650;
        const progress = Math.min(Math.max(scrollY / (heroHeight * 0.78), 0), 1);

        // Heading moves horizontally to left, subtly reduces scale and fades out
        if (brandName) {
            const headingX = -(progress * 85);
            const headingScale = 1 - progress * 0.04;
            brandName.style.transform = `translate3d(${headingX}px, 0, 0) scale(${headingScale})`;
            brandName.style.opacity = Math.max(1 - progress * 1.35, 0);
        }

        // Tagline characters disperse outward along calculated arcs with rotation and fade
        const charSpans = document.querySelectorAll(".tagline-char");
        charSpans.forEach((span) => {
            const dx = parseFloat(span.dataset.dx || 0) * progress * 1.6;
            const dy = parseFloat(span.dataset.dy || 0) * progress * 1.6;
            const rot = parseFloat(span.dataset.rot || 0) * progress;
            const charOpacity = Math.max(1 - progress * 1.6, 0);

            span.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg)`;
            span.style.opacity = charOpacity;
        });

        // Services group lifts slightly and transitions to transparent
        if (heroServices) {
            heroServices.style.transform = `translate3d(0, ${-(progress * 26)}px, 0)`;
            heroServices.style.opacity = Math.max(1 - progress * 1.5, 0);
        }

        // 3D Document Explosion Stage subtly shifts on scroll when idle
        const explosionStage = document.getElementById("docExplosionStage");
        if (explosionStage && !explosionStage.classList.contains("is-exploded")) {
            const shiftX = progress * 24;
            const shiftY = progress * 12;
            explosionStage.style.transform = `translate3d(${shiftX}px, ${shiftY}px, 0)`;
        }

        if (graphicCol) {
            graphicCol.style.opacity = Math.max(1 - progress * 1.35, 0);
        }
    }

    window.addEventListener("scroll", onHeroScroll, { passive: true });
}

// --------------------------------------------------------------------------
// 2A. INTERACTIVE 3D DOCUMENT EXPLOSION CONTROLLER
// Deterministic State Machine: IDLE -> 3D ROTATION -> EXPLODED -> RETURN
// --------------------------------------------------------------------------
function init3DDocumentExplosion() {
    const stage = document.getElementById("docExplosionStage");
    if (!stage) return;

    const cards = stage.querySelectorAll(".doc-segment-card");
    const tags = stage.querySelectorAll(".doc-callout-tag");
    const lines = stage.querySelectorAll(".leader-line");
    const dots = stage.querySelectorAll(".leader-dot");
    const announcer = document.getElementById("docExplosionAnnounce");
    const hangingAssembly = document.getElementById("certHangingAssembly");

    let isExploded = false;
    let activeSegment = null;

    function announce(msg) {
        if (announcer) announcer.textContent = msg;
    }

    function triggerExplosion() {
        if (isExploded) return;
        isExploded = true;
        stage.classList.add("is-exploded");
        stage.setAttribute("aria-expanded", "true");
        if (hangingAssembly) hangingAssembly.classList.add("is-retracted");
        announce("Exploded 3D view active. 5 document segments separated: Certificate, Aadhaar Card, Driving Licence, PAN Card, Other Documents. Secured using Blockchain Technology.");
    }

    function collapseExplosion() {
        if (!isExploded) return;
        isExploded = false;
        stage.classList.remove("is-exploded");
        stage.setAttribute("aria-expanded", "false");
        if (hangingAssembly) hangingAssembly.classList.remove("is-retracted");
        clearActiveSegment();
        announce("Document reassembled into default verified credential view.");
    }

    function setActiveSegment(segmentKey) {
        if (!segmentKey || activeSegment === segmentKey) return;
        activeSegment = segmentKey;

        cards.forEach((card) => {
            if (card.dataset.segment === segmentKey) {
                card.classList.add("active");
                card.setAttribute("aria-current", "true");
            } else {
                card.classList.remove("active");
                card.removeAttribute("aria-current");
            }
        });

        tags.forEach((tag) => {
            if (tag.dataset.target === segmentKey) {
                tag.classList.add("active");
            } else {
                tag.classList.remove("active");
            }
        });

        lines.forEach((line) => {
            if (line.classList.contains("line-" + segmentKey)) {
                line.classList.add("active");
            } else {
                line.classList.remove("active");
            }
        });

        dots.forEach((dot) => {
            if (dot.classList.contains("dot-" + segmentKey)) {
                dot.classList.add("active");
            } else {
                dot.classList.remove("active");
            }
        });
    }

    function clearActiveSegment() {
        activeSegment = null;
        cards.forEach((c) => {
            c.classList.remove("active");
            c.removeAttribute("aria-current");
        });
        tags.forEach((t) => t.classList.remove("active"));
        lines.forEach((l) => l.classList.remove("active"));
        dots.forEach((d) => d.classList.remove("active"));
    }

    // Desktop Mouse Hover Trigger (Immediate deterministic activation)
    stage.addEventListener("mouseenter", () => {
        triggerExplosion();
    });

    stage.addEventListener("mouseleave", () => {
        collapseExplosion();
    });

    // Individual Segment Hovers (Maintains overall exploded stability, reveals callout)
    cards.forEach((card) => {
        const seg = card.dataset.segment;
        card.addEventListener("mouseenter", (e) => {
            e.stopPropagation();
            setActiveSegment(seg);
        });

        card.addEventListener("focus", () => {
            triggerExplosion();
            setActiveSegment(seg);
        });
    });

    // Callout Tag Hovers
    tags.forEach((tag) => {
        const target = tag.dataset.target;
        tag.addEventListener("mouseenter", (e) => {
            e.stopPropagation();
            setActiveSegment(target);
        });

        tag.addEventListener("click", (e) => {
            e.stopPropagation();
            setActiveSegment(target);
        });
    });

    // Keyboard Accessibility (Enter or Space toggles, Escape closes)
    stage.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (isExploded) {
                collapseExplosion();
            } else {
                triggerExplosion();
                setActiveSegment("certificate");
            }
        } else if (e.key === "Escape") {
            collapseExplosion();
        }
    });

    // Touch Support for mobile and tablets
    stage.addEventListener("click", (e) => {
        if (e.target.closest(".doc-explosion-close-btn")) {
            collapseExplosion();
            return;
        }
        const clickedCard = e.target.closest(".doc-segment-card");
        if (clickedCard) {
            triggerExplosion();
            setActiveSegment(clickedCard.dataset.segment);
            return;
        }
        if (!isExploded) {
            triggerExplosion();
        }
    });

    window.handleDocExplosionClose = function(e) {
        if (e) e.stopPropagation();
        collapseExplosion();
    };
}

// --------------------------------------------------------------------------
// 2B. SUBTLE FLOATING PARTICLES CANVAS WITH CURSOR REPULSION
// --------------------------------------------------------------------------
function initFloatingParticles() {
    const canvas = document.getElementById("heroParticlesCanvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const heroEl = canvas.closest(".hero-minimal");
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
        radius: 95 // Repulsion radius threshold
    };

    function resizeCanvas() {
        if (!heroEl) return;
        const rect = heroEl.getBoundingClientRect();
        width = rect.width;
        height = rect.height;
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
            // Muted green-grey or darker ivory tones
            this.isGreen = Math.random() > 0.45;
            this.color = this.isGreen
                ? `rgba(0, 71, 65, ${(0.12 + Math.random() * 0.08).toFixed(3)})`
                : `rgba(165, 155, 138, ${(0.22 + Math.random() * 0.12).toFixed(3)})`;
        }

        update() {
            // Local cursor repulsion
            if (mouse.active && mouse.x !== null && mouse.y !== null) {
                const dx = this.x - mouse.x;
                const dy = this.y - mouse.y;
                const dist = Math.hypot(dx, dy);

                if (dist < mouse.radius && dist > 0) {
                    const force = (mouse.radius - dist) / mouse.radius;
                    const angle = Math.atan2(dy, dx);
                    // Gentle outward repulsion force
                    this.vx += Math.cos(angle) * force * 0.65;
                    this.vy += Math.sin(angle) * force * 0.65;
                }
            }

            // Smooth friction / dampening to return to natural drifting speed
            this.vx *= 0.95;
            this.vy *= 0.95;

            // Maintain gentle natural background drift
            if (Math.abs(this.vx) < Math.abs(this.baseVx)) this.vx += this.baseVx * 0.08;
            if (Math.abs(this.vy) < Math.abs(this.baseVy)) this.vy += this.baseVy * 0.08;

            this.x += this.vx;
            this.y += this.vy;

            // Toroidal boundary wrapping
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
        const count = Math.min(Math.max(Math.floor((width * height) / 16000), 45), 70);
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

    // Pointer events for cursor repulsion
    function onPointerMove(e) {
        if (!heroEl) return;
        const rect = heroEl.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.active = (
            mouse.x >= 0 &&
            mouse.x <= rect.width &&
            mouse.y >= 0 &&
            mouse.y <= rect.height
        );
    }

    function onPointerLeave() {
        mouse.active = false;
        mouse.x = null;
        mouse.y = null;
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("blur", onPointerLeave, { passive: true });

    // Window resize observer
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

    // Tab visibility handling (pause when tab hidden)
    document.addEventListener("visibilitychange", () => {
        isTabActive = document.visibilityState === "visible";
        if (isTabActive && isVisible && !animationFrameId && !prefersReducedMotion) {
            animationFrameId = requestAnimationFrame(renderLoop);
        }
    });

    // IntersectionObserver to pause when hero scrolls out of view
    if ("IntersectionObserver" in window && heroEl) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                isVisible = entry.isIntersecting;
                if (isVisible && isTabActive && !animationFrameId && !prefersReducedMotion) {
                    animationFrameId = requestAnimationFrame(renderLoop);
                }
            });
        }, { threshold: 0.05 });
        observer.observe(heroEl);
    }

    // Initial setup
    resizeCanvas();
    initParticlesList();

    if (prefersReducedMotion) {
        // Draw single static frame
        particles.forEach((p) => p.draw());
    } else {
        animationFrameId = requestAnimationFrame(renderLoop);
    }
}

// --------------------------------------------------------------------------
// 2C. STICKY NAVBAR SCROLL ELEVATION & BACKDROP BLUR
// --------------------------------------------------------------------------
function initNavbarScroll() {
    const navbar = document.querySelector(".top-navbar") || document.querySelector(".navbar");
    if (!navbar) return;

    let isTicking = false;

    function checkNavbarScroll() {
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        if (scrollY > 20) {
            navbar.classList.add("scrolled");
        } else {
            navbar.classList.remove("scrolled");
        }
        isTicking = false;
    }

    window.addEventListener("scroll", () => {
        if (!isTicking) {
            requestAnimationFrame(checkNavbarScroll);
            isTicking = true;
        }
    }, { passive: true });

    // Initial check
    checkNavbarScroll();
}

// --------------------------------------------------------------------------
// 3. VIDEO CARDS & REAL TUTORIAL PREVIEWS (WITH FALLBACK CANVASES)
// --------------------------------------------------------------------------
function pauseAllPreviewVideos() {
    document.querySelectorAll(".video-card video").forEach((video) => {
        try { video.pause(); } catch (e) {}
    });
}

function resumeVisiblePreviewVideos() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }
    const isModalActive = document.getElementById("videoModalBackdrop")?.classList.contains("active");
    if (isModalActive) return;

    document.querySelectorAll(".video-card").forEach((card) => {
        const rect = card.getBoundingClientRect();
        const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
        const video = card.querySelector("video");
        if (video && inViewport) {
            video.play().catch(() => {});
        }
    });
}

function initVideoCards() {
    const cards = document.querySelectorAll(".video-card");
    const prefersReducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    cards.forEach((card) => {
        const videoType = card.dataset.video;
        const config = VIDEO_CONFIG[videoType];
        if (!config) return;

        const previewContainer = card.querySelector(".video-preview-wrapper");
        if (!previewContainer) return;

        // Create the actual video element for preview
        const previewVideo = document.createElement("video");
        previewVideo.className = "video-preview-media";
        previewVideo.muted = true;
        previewVideo.loop = true;
        previewVideo.playsInline = true;
        previewVideo.preload = "metadata";
        previewVideo.setAttribute("aria-hidden", "true");
        previewVideo.setAttribute("tabindex", "-1");

        let videoLoaded = false;

        previewVideo.addEventListener("loadeddata", () => {
            videoLoaded = true;
            // Clean up fallback canvas if one was inserted
            const fallbackCanvas = previewContainer.querySelector("canvas");
            if (fallbackCanvas) fallbackCanvas.remove();

            if (!prefersReducedMotion) {
                const rect = card.getBoundingClientRect();
                const inViewport = rect.top < window.innerHeight && rect.bottom > 0;
                const isModalOpen = document.getElementById("videoModalBackdrop")?.classList.contains("active");
                if (inViewport && !isModalOpen) {
                    previewVideo.play().catch(() => {});
                }
            }
        });

        previewVideo.addEventListener("error", () => {
            if (!videoLoaded && !previewContainer.querySelector("canvas")) {
                setupFallbackCanvas(previewContainer, videoType, false);
            }
        });

        previewVideo.src = config.src;
        previewContainer.insertBefore(previewVideo, previewContainer.firstChild);

        // Card Click Handler -> Open Enlarged Modal
        card.addEventListener("click", () => openVideoModal(videoType, card));
        card.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openVideoModal(videoType, card);
            }
        });
    });

    // Pause video loops when off-screen to preserve CPU and bandwidth
    if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver((entries) => {
            const isModalActive = document.getElementById("videoModalBackdrop")?.classList.contains("active");
            entries.forEach((entry) => {
                const videoEl = entry.target.querySelector("video");
                if (videoEl) {
                    if (entry.isIntersecting && !isModalActive && !prefersReducedMotion) {
                        videoEl.play().catch(() => {});
                    } else {
                        videoEl.pause();
                    }
                }
                const type = entry.target.dataset.video;
                if (canvasAnimations[type]) {
                    canvasAnimations[type].active = entry.isIntersecting && !isModalActive;
                }
            });
        }, { threshold: 0.15 });

        cards.forEach((c) => observer.observe(c));
    }
}

// --------------------------------------------------------------------------
// 3B. FALLBACK ANIMATED CANVASES (TACTILE CYPRUS GREEN & SAND AESTHETIC)
// --------------------------------------------------------------------------
function setupFallbackCanvas(container, type, isModal = false) {
    const existing = container.querySelector("canvas");
    if (existing) existing.remove();

    const canvas = document.createElement("canvas");
    canvas.className = "video-preview-media";
    container.insertBefore(canvas, container.firstChild);

    const ctx = canvas.getContext("2d");
    const width = 640;
    const height = 360;
    canvas.width = width;
    canvas.height = height;

    let frame = 0;
    const animKey = isModal ? `${type}_modal` : type;

    function render() {
        if (canvasAnimations[animKey] && !canvasAnimations[animKey].active && !isModal) {
            requestAnimationFrame(render);
            return;
        }

        frame++;
        ctx.clearRect(0, 0, width, height);

        // Background Warm Sand / Deep Tone
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, "#FAF8F5");
        bgGrad.addColorStop(1, "#E8E4DC");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Grid lines
        ctx.strokeStyle = "rgba(0, 71, 65, 0.05)";
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 32) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let y = 0; y < height; y += 32) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        if (type === "administrative") {
            drawAdminAnimation(ctx, width, height, frame);
        } else if (type === "verification") {
            drawVerifyAnimation(ctx, width, height, frame);
        } else {
            drawVaultAnimation(ctx, width, height, frame);
        }

        canvasAnimations[animKey] = {
            active: true,
            raf: requestAnimationFrame(render)
        };
    }

    render();
}

function drawAdminAnimation(ctx, width, height, frame) {
    const cx = width / 2;
    const cy = height / 2;

    // Simulated Certificate Card
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0, 71, 65, 0.12)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    roundRect(ctx, cx - 140, cy - 85, 280, 170, 14);
    ctx.fill();
    ctx.restore();

    // Card Header Bar
    ctx.fillStyle = "#004741";
    roundRect(ctx, cx - 140, cy - 85, 280, 24, { tl: 14, tr: 14, br: 0, bl: 0 });
    ctx.fill();

    // Text Lines
    ctx.fillStyle = "rgba(0, 71, 65, 0.25)";
    roundRect(ctx, cx - 110, cy - 35, 120, 8, 4);
    ctx.fill();
    roundRect(ctx, cx - 110, cy - 18, 180, 7, 4);
    ctx.fill();
    roundRect(ctx, cx - 110, cy - 3, 150, 7, 4);
    ctx.fill();

    // Student ID badge
    ctx.fillStyle = "rgba(0, 71, 65, 0.08)";
    roundRect(ctx, cx - 110, cy + 18, 90, 16, 6);
    ctx.fill();

    // Floating Stamping Seal
    const stampProgress = (Math.sin(frame * 0.04) + 1) / 2;
    const sealScale = 0.85 + stampProgress * 0.15;
    ctx.save();
    ctx.translate(cx + 80, cy + 25);
    ctx.scale(sealScale, sealScale);
    ctx.beginPath();
    ctx.arc(0, 0, 28, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 71, 65, 0.92)";
    ctx.fill();

    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 12px Switzer, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ISSUED", 0, 0);
    ctx.restore();
}

function drawVerifyAnimation(ctx, width, height, frame) {
    const cx = width / 2;
    const cy = height / 2;

    // Center Verification Terminal
    ctx.save();
    ctx.fillStyle = "#FAF8F5";
    ctx.strokeStyle = "rgba(0, 71, 65, 0.25)";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(0, 71, 65, 0.14)";
    ctx.shadowBlur = 20;
    roundRect(ctx, cx - 150, cy - 90, 300, 180, 16);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Input line simulation
    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#004741";
    ctx.lineWidth = 1.5;
    roundRect(ctx, cx - 120, cy - 60, 240, 34, 8);
    ctx.fill();
    ctx.stroke();

    // Verification Scanner Beam
    const scanY = cy - 20 + Math.sin(frame * 0.05) * 45;
    const beamGrad = ctx.createLinearGradient(0, scanY - 10, 0, scanY + 10);
    beamGrad.addColorStop(0, "rgba(5, 150, 105, 0)");
    beamGrad.addColorStop(0.5, "rgba(5, 150, 105, 0.45)");
    beamGrad.addColorStop(1, "rgba(5, 150, 105, 0)");
    ctx.fillStyle = beamGrad;
    ctx.fillRect(cx - 120, scanY - 10, 240, 20);

    // Verified Status Badge with Checkmark
    const checkScale = 0.95 + (Math.sin(frame * 0.06) + 1) * 0.05;
    ctx.save();
    ctx.translate(cx, cy + 40);
    ctx.scale(checkScale, checkScale);
    roundRect(ctx, -75, -16, 150, 32, 16);
    ctx.fillStyle = "#004741";
    ctx.fill();

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 13px Switzer, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("✓ AUTHENTIC", 0, 0);
    ctx.restore();
}

function drawVaultAnimation(ctx, width, height, frame) {
    const cx = width / 2;
    const cy = height / 2;

    // Vault Safe Shape
    ctx.save();
    ctx.fillStyle = "#FFFFFF";
    ctx.shadowColor = "rgba(0, 71, 65, 0.16)";
    ctx.shadowBlur = 22;
    roundRect(ctx, cx - 100, cy - 95, 200, 190, 20);
    ctx.fill();
    ctx.restore();

    // Vault Wheel Dial
    const rot = frame * 0.025;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);

    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fillStyle = "#004741";
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Wheel spokes
    for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 15, Math.sin(a) * 15);
        ctx.lineTo(Math.cos(a) * 44, Math.sin(a) * 44);
        ctx.strokeStyle = "#FFFFFF";
        ctx.lineWidth = 2.5;
        ctx.stroke();
    }
    ctx.restore();

    // Lock Center Keyhole
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    // Encryption Status Pill
    ctx.fillStyle = "rgba(0, 71, 65, 0.08)";
    roundRect(ctx, cx - 75, cy + 62, 150, 22, 11);
    ctx.fill();

    ctx.fillStyle = "#004741";
    ctx.font = "bold 10px JetBrains Mono, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("AES-256 ENCRYPTED", cx, cy + 73);
}

// Canvas helper
function roundRect(ctx, x, y, width, height, radius) {
    if (typeof radius === "number") {
        radius = { tl: radius, tr: radius, br: radius, bl: radius };
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
}

// --------------------------------------------------------------------------
// 4. CLICK-TO-ENLARGE VIDEO MODAL WITH STEP-BY-STEP INSTRUCTIONS
// --------------------------------------------------------------------------
function openVideoModal(videoType, triggerElement) {
    const config = VIDEO_CONFIG[videoType];
    if (!config) return;

    activeModalTriggerCard = triggerElement;

    // Pause preview playback across all background cards
    pauseAllPreviewVideos();

    const backdrop = document.getElementById("videoModalBackdrop");
    const modalTitle = document.getElementById("videoModalTitle");
    const mediaContainer = document.getElementById("videoModalMedia");
    const instructionsList = document.getElementById("videoModalInstructionsList");

    if (!backdrop || !modalTitle || !mediaContainer || !instructionsList) return;

    // Set title
    modalTitle.textContent = config.title;

    // Populate Numbered Steps
    instructionsList.innerHTML = config.steps.map((step, idx) => `
        <div class="instruction-step">
            <span class="step-number-badge">${idx + 1}</span>
            <span class="step-text">${step}</span>
        </div>
    `).join("");

    // Load Enlarged Video with full controls and unmuted audio support
    mediaContainer.innerHTML = "";
    const modalVideo = document.createElement("video");
    modalVideo.controls = true;
    modalVideo.autoplay = true;
    modalVideo.playsInline = true;
    modalVideo.preload = "auto";
    modalVideo.muted = false; // Enabled audio playback on user gesture
    modalVideo.setAttribute("aria-label", `${config.title} Tutorial Video`);
    modalVideo.className = "video-modal-player";
    modalVideo.style.width = "100%";
    modalVideo.style.height = "100%";

    modalVideo.onerror = function() {
        console.warn(`Tutorial video could not be loaded from ${config.src}. Rendering fallback.`);
        mediaContainer.innerHTML = "";
        setupFallbackCanvas(mediaContainer, videoType, true);
    };

    modalVideo.src = config.src;
    mediaContainer.appendChild(modalVideo);

    // Open Modal
    backdrop.classList.add("active");
    backdrop.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    // Start playback (direct user click permits audio playback)
    modalVideo.play().catch((err) => {
        console.warn("Playback awaiting user interaction:", err);
    });

    // Set focus on close button
    const closeBtn = document.getElementById("videoModalCloseBtn");
    if (closeBtn) closeBtn.focus();
}

function closeVideoModal() {
    const backdrop = document.getElementById("videoModalBackdrop");
    if (!backdrop) return;

    backdrop.classList.remove("active");
    backdrop.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";

    // Stop and clear video/canvas in modal to halt streaming and free memory
    const mediaContainer = document.getElementById("videoModalMedia");
    if (mediaContainer) {
        const video = mediaContainer.querySelector("video");
        if (video) {
            video.pause();
            video.removeAttribute("src");
            video.load(); // Immediately releases decoder and buffer resources
        }
        mediaContainer.innerHTML = "";
    }

    // Cancel modal RAF loop
    Object.keys(canvasAnimations).forEach((key) => {
        if (key.includes("_modal")) {
            cancelAnimationFrame(canvasAnimations[key].raf);
            delete canvasAnimations[key];
        }
    });

    // Resume visible preview videos in viewport
    resumeVisiblePreviewVideos();

    // Return focus to triggered card
    if (activeModalTriggerCard) {
        activeModalTriggerCard.focus();
    }
}

// Global modal dismiss & accessible keyboard trap
document.addEventListener("keydown", (e) => {
    const backdrop = document.getElementById("videoModalBackdrop");
    if (!backdrop || !backdrop.classList.contains("active")) return;

    if (e.key === "Escape") {
        closeVideoModal();
    } else if (e.key === "Tab") {
        const focusable = backdrop.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), video[controls]');
        if (focusable.length > 0) {
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    }
});

// --------------------------------------------------------------------------
// 4B. SYNCHRONIZED 3-PANEL VIDEO CARDS SCROLL ANIMATION
// - When scrolling down from Verified Records into Video Guides:
//   Leftmost card enters from left side
//   Rightmost card enters from right side
//   Middle card enters from bottom
//   All 3 align side-by-side at the same time
// - When scrolling further down past Video Guides:
//   Leftmost card exits to left side
//   Rightmost card exits to right side
//   Middle card exits upside
//   All 3 exit simultaneously in perfect synchrony
// --------------------------------------------------------------------------
function initVideoCardsScrollAnimation() {
    const section = document.querySelector(".video-guides-section");
    const cardLeft = document.getElementById("videoCardLeft");
    const cardMiddle = document.getElementById("videoCardMiddle");
    const cardRight = document.getElementById("videoCardRight");

    if (!section || !cardLeft || !cardMiddle || !cardRight) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
        cardLeft.style.transform = "none";
        cardMiddle.style.transform = "none";
        cardRight.style.transform = "none";
        cardLeft.style.opacity = "1";
        cardMiddle.style.opacity = "1";
        cardRight.style.opacity = "1";
        return;
    }

    let isTicking = false;

    function onScroll() {
        if (!isTicking) {
            requestAnimationFrame(() => {
                updateTransforms();
                isTicking = false;
            });
            isTicking = true;
        }
    }

    function updateTransforms() {
        const rect = section.getBoundingClientRect();
        const vh = window.innerHeight || 800;

        // Full-screen edge offsets so panels start and exit from the leftmost & rightmost sides of the entire screen
        const screenW = window.innerWidth || document.documentElement.clientWidth || 1200;
        const maxOffsetDistX = Math.max(screenW * 0.75, 880);
        const maxOffsetDistY = Math.max(vh * 0.65, 420);

        // Entrance range: starts as section reaches viewport, completes when section is well in view
        const enterStart = vh * 0.95;
        const enterEnd = vh * 0.35;
        let enterFactor = 0;
        if (rect.top <= enterEnd) {
            enterFactor = 1;
        } else if (rect.top >= enterStart) {
            enterFactor = 0;
        } else {
            enterFactor = (enterStart - rect.top) / (enterStart - enterEnd);
        }

        // Exit range: starts when section bottom starts leaving, completes as section leaves viewport
        const exitStart = vh * 0.85;
        const exitEnd = vh * 0.15;
        let exitFactor = 0;
        if (rect.bottom <= exitEnd) {
            exitFactor = 1;
        } else if (rect.bottom >= exitStart) {
            exitFactor = 0;
        } else {
            exitFactor = (exitStart - rect.bottom) / (exitStart - exitEnd);
        }

        if (exitFactor > 0) {
            // Simultaneous exit:
            // Left card goes to leftmost screen edge
            // Right card goes to rightmost screen edge
            // Middle card goes UPSIDE
            const leftExitX = -(exitFactor * maxOffsetDistX);
            const rightExitX = (exitFactor * maxOffsetDistX);
            const middleExitY = -(exitFactor * maxOffsetDistY);
            const exitOpacity = Math.max(1 - exitFactor * 1.35, 0);

            cardLeft.style.transform = `translate3d(${leftExitX}px, 0, 0)`;
            cardLeft.style.opacity = exitOpacity;

            cardRight.style.transform = `translate3d(${rightExitX}px, 0, 0)`;
            cardRight.style.opacity = exitOpacity;

            cardMiddle.style.transform = `translate3d(0, ${middleExitY}px, 0)`;
            cardMiddle.style.opacity = exitOpacity;
        } else if (enterFactor < 1) {
            // Simultaneous entrance:
            // Left comes from leftmost screen edge
            // Right comes from rightmost screen edge
            // Middle comes from bottom
            // All align at the exact same moment
            const leftEnterX = -((1 - enterFactor) * maxOffsetDistX);
            const rightEnterX = ((1 - enterFactor) * maxOffsetDistX);
            const middleEnterY = ((1 - enterFactor) * maxOffsetDistY);
            const enterOpacity = Math.min(Math.max(0.12 + 0.88 * enterFactor, 0), 1);

            cardLeft.style.transform = `translate3d(${leftEnterX}px, 0, 0)`;
            cardLeft.style.opacity = enterOpacity;

            cardRight.style.transform = `translate3d(${rightEnterX}px, 0, 0)`;
            cardRight.style.opacity = enterOpacity;

            cardMiddle.style.transform = `translate3d(0, ${middleEnterY}px, 0)`;
            cardMiddle.style.opacity = enterOpacity;
        } else {
            // Perfectly aligned side-by-side in comfortable viewing zone
            cardLeft.style.transform = "";
            cardRight.style.transform = "";
            cardMiddle.style.transform = "";
            cardLeft.style.opacity = "1";
            cardRight.style.opacity = "1";
            cardMiddle.style.opacity = "1";
        }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    updateTransforms();
}

// --------------------------------------------------------------------------
// 4C. UPCOMING ORGANIZATION MODAL CONTROLLER
// --------------------------------------------------------------------------
function openUpcomingOrgNotice(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    const modal = document.getElementById("upcomingOrgModal");
    if (!modal) return;
    modal.style.display = "flex";
    void modal.offsetWidth; // Force layout
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeUpcomingOrgModal() {
    const modal = document.getElementById("upcomingOrgModal");
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    setTimeout(() => {
        modal.style.display = "none";
    }, 250);
    document.body.style.overflow = "";
}

window.openUpcomingOrgNotice = openUpcomingOrgNotice;
window.closeUpcomingOrgModal = closeUpcomingOrgModal;

// Keyboard listener for modal dismiss
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        const upcomingModal = document.getElementById("upcomingOrgModal");
        if (upcomingModal && upcomingModal.classList.contains("active")) {
            closeUpcomingOrgModal();
        }
    }
});

// --------------------------------------------------------------------------
// 5. REAL LIVE WEBSITE STATISTICS (REAL-TIME AUTO-POLLING & LIVE INCREMENT)
// --------------------------------------------------------------------------
let currentStats = {
    statUsers: 0,
    statOrgs: 0,
    statVerifications: 0,
    statVaults: 0
};
let isInitialStatsFetch = true;

function initLiveStats() {
    const statsSection = document.getElementById("liveStatsSection");
    if (!statsSection) return;

    // Initial fetch
    fetchAndAnimateStats();

    // High frequency live synchronization polling (every 2.5s)
    setInterval(() => {
        fetchAndAnimateStats(false);
    }, 2500);

    // BroadcastChannel listener for instant cross-tab live updates
    try {
        const bc = new BroadcastChannel("vr_live_sync");
        bc.onmessage = (ev) => {
            console.log("VerifiedRecords: Live event broadcast received:", ev.data);
            fetchAndAnimateStats(true);
        };
    } catch (e) {}

    // Storage event listener for fallback cross-tab sync
    window.addEventListener("storage", (ev) => {
        if (ev.key === "vr_last_user_created") {
            fetchAndAnimateStats(true);
        }
    });
}

function fetchAndAnimateStats(isImmediate = false) {
    fetch("/api/stats/public")
        .then((res) => {
            if (!res.ok) throw new Error("Stats service unavailable");
            return res.json();
        })
        .then((data) => {
            if (data && data.success && data.stats) {
                const targetUsers = Number(data.stats.users) || 0;
                const targetOrgs = Number(data.stats.organizations) || 0;
                const targetVerifications = Number(data.stats.verifications) || 0;
                const targetVaults = Number(data.stats.vaults) || 0;

                // Detect lively increment for users (e.g. newly created account)
                if (!isInitialStatsFetch && targetUsers > currentStats.statUsers) {
                    const card = document.getElementById("statUsersCard");
                    if (card) {
                        card.classList.remove("stat-updated-pulse");
                        void card.offsetWidth; // trigger reflow
                        card.classList.add("stat-updated-pulse");
                        setTimeout(() => card.classList.remove("stat-updated-pulse"), 2000);
                    }
                }

                animateCounter("statUsers", currentStats.statUsers, targetUsers);
                animateCounter("statOrgs", currentStats.statOrgs, targetOrgs);
                animateCounter("statVerifications", currentStats.statVerifications, targetVerifications);
                animateCounter("statVaults", currentStats.statVaults, targetVaults);

                currentStats.statUsers = targetUsers;
                currentStats.statOrgs = targetOrgs;
                currentStats.statVerifications = targetVerifications;
                currentStats.statVaults = targetVaults;

                isInitialStatsFetch = false;
            }
        })
        .catch((err) => {
            console.warn("Live stats notice:", err.message);
        });
}

function animateCounter(elementId, startValue, targetValue) {
    const el = document.getElementById(elementId);
    if (!el) return;

    if (startValue === targetValue && !isInitialStatsFetch) {
        el.textContent = targetValue.toLocaleString();
        return;
    }

    const duration = isInitialStatsFetch ? 1400 : 800; // ms
    const startTime = performance.now();

    function update(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease Out Cubic
        const ease = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(startValue + (targetValue - startValue) * ease);

        el.textContent = current.toLocaleString();

        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            el.textContent = targetValue.toLocaleString();
        }
    }

    requestAnimationFrame(update);
}

// --------------------------------------------------------------------------
// 6. REAL REGISTRY OPERATIONAL STATUS
// --------------------------------------------------------------------------
function checkRegistryStatus() {
    const statusEl = document.getElementById("registryStatusText");
    if (!statusEl) return;

    fetch("/api/health")
        .then((res) => res.json())
        .then((data) => {
            if (data && data.status === "healthy") {
                statusEl.textContent = "Registry Operational";
            }
        })
        .catch(() => {
            statusEl.textContent = "Registry Offline";
            const pulse = document.querySelector(".status-dot-pulse");
            if (pulse) pulse.style.background = "#d97706";
        });
}

// --------------------------------------------------------------------------
// 7. CONTINUOUS HASH-CHARACTER STREAM CONTROLLER (HOMEPAGE LEFT CONDUIT)
// --------------------------------------------------------------------------
function initHashCharacterStream() {
    const rail = document.getElementById("hashStreamRail");
    const charCol = document.getElementById("hashCharColumn");
    if (!rail || !charCol) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
        rail.style.display = "none";
        return;
    }

    // Harmless, illustrative character sequences (0-9, a-f, #, *, .)
    function generateHashBlock() {
        const prefixes = ["#308*", "#7f2*", "#a91*", "#e4c*", "#5b0*", "#92a*", "#4d1*"];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        let hexBody = "";
        for (let i = 0; i < 6; i++) {
            hexBody += Math.floor(Math.random() * 16).toString(16);
        }
        let tail = "";
        for (let j = 0; j < 5; j++) {
            tail += Math.floor(Math.random() * 16).toString(16);
        }
        return `${prefix}${hexBody}...${tail}...`;
    }

    // Initialize with 6 rolling blocks
    const streamBlocks = [];
    for (let k = 0; k < 6; k++) {
        streamBlocks.push(generateHashBlock());
    }
    charCol.textContent = streamBlocks.join(" · ");

    let streamOffset = 0;
    let animId = null;
    let isRunning = true;

    function renderStream() {
        if (!isRunning) return;
        streamOffset += 0.55; // Steady, elegant speed
        if (streamOffset >= 160) {
            streamOffset = 0;
            streamBlocks.shift();
            streamBlocks.push(generateHashBlock());
            charCol.textContent = streamBlocks.join(" · ");
        }
        charCol.style.transform = `translateY(${streamOffset}px)`;
        animId = requestAnimationFrame(renderStream);
    }

    animId = requestAnimationFrame(renderStream);

    // Pause on hidden tab to conserve CPU
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            isRunning = false;
            if (animId) cancelAnimationFrame(animId);
        } else {
            if (!isRunning) {
                isRunning = true;
                animId = requestAnimationFrame(renderStream);
            }
        }
    });
}

// --------------------------------------------------------------------------
// 8. NAVBAR BRAND INTERACTION (Smooth Scroll to Top on Homepage)
// --------------------------------------------------------------------------
function initNavbarBrandInteraction() {
    const navBrand = document.querySelector(".nav-brand");
    if (!navBrand) return;

    navBrand.addEventListener("click", (e) => {
        const path = window.location.pathname;
        const isHomePage = path.endsWith("index.html") || path === "/" || path === "" || path.endsWith("/");
        if (isHomePage) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    });
}

// --------------------------------------------------------------------------
// 9. INITIALIZE ON DOM CONTENT LOADED
// --------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
    initHeroTypewriterIntro();
    initHeroAnimations();
    initHashCharacterStream();
    init3DDocumentExplosion();
    initFloatingParticles();
    initNavbarScroll();
    initNavbarBrandInteraction();
    initVideoCards();
    initVideoCardsScrollAnimation();
    initLiveStats();
    checkRegistryStatus();
});
