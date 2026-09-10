/**
 * VerifiedRecords — Security Intro Animation Engine
 * Creates a cinematic 2.4s opening sequence:
 * 1. Cyber atom particles orbit and converge towards center
 * 2. Particles fuse to generate a luminous cryptographic security shield
 * 3. Energy shockwave pulses with "Ease to Security" status
 * 4. Shield icon flies with high precision and docks into the site navbar logo
 * 5. Logo flashes on docking as overlay dissolves smoothly
 */

(function () {
    'use strict';

    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function initSecurityIntro(forceReplay = false) {
        const isHomePage = window.location.pathname.endsWith('index.html') || 
                           window.location.pathname.endsWith('/') || 
                           window.location.pathname === '';
        
        const hasPlayedThisSession = sessionStorage.getItem('vr_security_intro_played');
        const urlParams = new URLSearchParams(window.location.search);
        const urlReplay = urlParams.has('intro') || urlParams.has('replay');

        if (!forceReplay && !urlReplay && hasPlayedThisSession) {
            return;
        }

        if (prefersReducedMotion && !forceReplay) {
            sessionStorage.setItem('vr_security_intro_played', 'true');
            return;
        }

        sessionStorage.setItem('vr_security_intro_played', 'true');

        const existing = document.getElementById('securityIntroOverlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'securityIntroOverlay';
        overlay.className = 'security-intro-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', 'Security Verification Intro Animation');

        overlay.innerHTML = `
            <div class="intro-backdrop"></div>
            <canvas id="introCanvas" class="intro-canvas"></canvas>
            
            <div class="intro-center-stage" id="introCenterStage">
                <div class="intro-shield-wrapper" id="introShieldWrapper">
                    <div class="intro-shockwave" id="introShockwave"></div>
                    <div class="intro-atom-glow" id="introAtomGlow"></div>
                    <div class="intro-shield-halo"></div>
                    <div class="intro-shield-core" id="introShieldCore">
                        <i class="fa-solid fa-shield-halved" aria-hidden="true"></i>
                    </div>
                </div>

                <div class="intro-text-cluster" id="introTextCluster">
                    <div class="intro-badge-pill">
                        <span class="intro-status-dot"></span>
                        <span>Ease to Security</span>
                    </div>
                    <h2 class="intro-brand-title">VerifiedRecords</h2>
                    <p class="intro-brand-subtitle">Cryptographic Credential Node • Initialized</p>
                </div>
            </div>

            <button type="button" class="intro-skip-button" id="introSkipButton" title="Skip Intro">
                <span>Skip</span>
                <i class="fa-solid fa-forward-step" aria-hidden="true"></i>
            </button>
        `;

        document.body.appendChild(overlay);
        document.body.classList.add('intro-active');

        const canvas = document.getElementById('introCanvas');
        const ctx = canvas.getContext('2d');
        let animationFrameId;
        let isTerminated = false;

        let width = (canvas.width = window.innerWidth);
        let height = (canvas.height = window.innerHeight);

        const handleResize = () => {
            if (isTerminated) return;
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };
        window.addEventListener('resize', handleResize);

        const centerX = () => width / 2;
        const centerY = () => height / 2;

        const TOTAL_PARTICLES = 44;
        const particles = [];

        const orbits = [
            { rx: 140, ry: 50, tilt: -32 * (Math.PI / 180), speed: 0.040, color: '#3b82f6' },
            { rx: 140, ry: 50, tilt: 32 * (Math.PI / 180), speed: -0.042, color: '#6366f1' },
            { rx: 130, ry: 50, tilt: 90 * (Math.PI / 180), speed: 0.036, color: '#06b6d4' }
        ];

        for (let i = 0; i < TOTAL_PARTICLES; i++) {
            const orbit = orbits[i % orbits.length];
            particles.push({
                orbitIndex: i % orbits.length,
                angle: (i / TOTAL_PARTICLES) * Math.PI * 2 + Math.random() * 0.5,
                speed: orbit.speed * (0.85 + Math.random() * 0.3),
                radius: 2 + Math.random() * 2.5,
                color: orbit.color,
                collapseProgress: 0,
                collapseSpeed: 0.035 + Math.random() * 0.02
            });
        }

        const startTime = performance.now();
        let phase = 'orbit';

        function render(now) {
            if (isTerminated) return;

            const elapsed = now - startTime;
            ctx.clearRect(0, 0, width, height);

            const cx = centerX();
            const cy = centerY();

            if (elapsed > 900 && phase === 'orbit') {
                phase = 'converge';
            }

            if (elapsed > 1200 && phase === 'converge') {
                phase = 'fuse';
                triggerShieldFusion();
            }

            if (elapsed > 1750 && phase === 'fuse') {
                phase = 'dock';
                startDockingSequence();
            }

            if (phase === 'orbit' || phase === 'converge') {
                const ringAlpha = phase === 'converge' ? Math.max(0, 1 - (elapsed - 900) / 300) : 0.45;
                if (ringAlpha > 0.01) {
                    orbits.forEach(orbit => {
                        ctx.save();
                        ctx.translate(cx, cy);
                        ctx.rotate(orbit.tilt);
                        ctx.beginPath();
                        ctx.ellipse(0, 0, orbit.rx, orbit.ry, 0, 0, Math.PI * 2);
                        ctx.strokeStyle = `rgba(148, 163, 184, ${0.28 * ringAlpha})`;
                        ctx.lineWidth = 1.2;
                        ctx.setLineDash([4, 6]);
                        ctx.stroke();
                        ctx.restore();
                    });
                }
            }

            particles.forEach((p, idx) => {
                p.angle += p.speed;
                const orbit = orbits[p.orbitIndex];

                const cosA = Math.cos(p.angle);
                const sinA = Math.sin(p.angle);
                const ex = cosA * orbit.rx;
                const ey = sinA * orbit.ry;

                const cosT = Math.cos(orbit.tilt);
                const sinT = Math.sin(orbit.tilt);
                let targetX = cx + (ex * cosT - ey * sinT);
                let targetY = cy + (ex * sinT + ey * cosT);

                if (phase === 'converge' || phase === 'fuse' || phase === 'dock') {
                    p.collapseProgress = Math.min(1, p.collapseProgress + p.collapseSpeed);
                    targetX = targetX + (cx - targetX) * p.collapseProgress;
                    targetY = targetY + (cy - targetY) * p.collapseProgress;
                }

                if (p.collapseProgress < 0.98) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(targetX, targetY, p.radius * (1 - p.collapseProgress * 0.5), 0, Math.PI * 2);
                    ctx.fillStyle = p.color;
                    ctx.shadowColor = p.color;
                    ctx.shadowBlur = 8;
                    ctx.fill();

                    for (let j = idx + 1; j < particles.length; j += 4) {
                        const p2 = particles[j];
                        if (p2.collapseProgress < 0.95) {
                            const o2 = orbits[p2.orbitIndex];
                            const p2TargetX = cx + (Math.cos(p2.angle) * o2.rx * Math.cos(o2.tilt) - Math.sin(p2.angle) * o2.ry * Math.sin(o2.tilt));
                            const p2TargetY = cy + (Math.cos(p2.angle) * o2.rx * Math.sin(o2.tilt) + Math.sin(p2.angle) * o2.ry * Math.cos(o2.tilt));
                            const dist = Math.hypot(targetX - p2TargetX, targetY - p2TargetY);
                            if (dist < 60) {
                                ctx.beginPath();
                                ctx.moveTo(targetX, targetY);
                                ctx.lineTo(p2TargetX, p2TargetY);
                                ctx.strokeStyle = `rgba(59, 130, 246, ${(1 - dist / 60) * 0.35})`;
                                ctx.lineWidth = 0.8;
                                ctx.stroke();
                            }
                        }
                    }
                    ctx.restore();
                }
            });

            if (phase === 'orbit' || phase === 'converge') {
                const pulse = 1 + Math.sin(elapsed * 0.008) * 0.2;
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, 14 * pulse, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
                ctx.shadowColor = '#2563eb';
                ctx.shadowBlur = 18;
                ctx.fill();
                ctx.restore();
            }

            if (!isTerminated && phase !== 'done') {
                animationFrameId = requestAnimationFrame(render);
            }
        }

        function triggerShieldFusion() {
            const wrapper = document.getElementById('introShieldWrapper');
            const shockwave = document.getElementById('introShockwave');
            const textCluster = document.getElementById('introTextCluster');

            if (wrapper) wrapper.classList.add('fused');
            if (shockwave) shockwave.classList.add('blast');
            if (textCluster) textCluster.classList.add('visible');
        }

        function startDockingSequence() {
            const shieldWrapper = document.getElementById('introShieldWrapper');
            const textCluster = document.getElementById('introTextCluster');
            const canvasEl = document.getElementById('introCanvas');
            const targetLogo = document.querySelector('.nav-brand-icon') || document.querySelector('.nav-brand');

            if (textCluster) textCluster.classList.add('fade-out');
            if (canvasEl) canvasEl.classList.add('fade-out');

            if (!shieldWrapper) {
                finishIntro();
                return;
            }

            let targetX = 50;
            let targetY = 40;
            let targetScale = 0.40;

            if (targetLogo) {
                const rect = targetLogo.getBoundingClientRect();
                targetX = rect.left + rect.width / 2;
                targetY = rect.top + rect.height / 2;
                targetScale = Math.max(0.34, rect.width / 88);
            }

            const startX = width / 2;
            const startY = height / 2;
            const deltaX = targetX - startX;
            const deltaY = targetY - startY;

            shieldWrapper.style.transition = 'transform 650ms cubic-bezier(0.16, 1, 0.3, 1), opacity 650ms ease';
            shieldWrapper.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${targetScale})`;

            setTimeout(() => {
                if (targetLogo) {
                    targetLogo.classList.add('logo-dock-flash');
                    setTimeout(() => targetLogo.classList.remove('logo-dock-flash'), 900);
                }
                finishIntro();
            }, 600);
        }

        function finishIntro() {
            if (isTerminated) return;
            isTerminated = true;
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);

            overlay.classList.add('intro-dismiss');
            document.body.classList.remove('intro-active');

            setTimeout(() => {
                if (overlay.parentNode) {
                    overlay.remove();
                }
            }, 450);
        }

        const skipBtn = document.getElementById('introSkipButton');
        if (skipBtn) {
            skipBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                finishIntro();
            });
        }

        overlay.addEventListener('click', () => {
            finishIntro();
        });

        const handleKeyDown = (e) => {
            if (e.key === 'Escape' || e.code === 'Space') {
                finishIntro();
                window.removeEventListener('keydown', handleKeyDown);
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        animationFrameId = requestAnimationFrame(render);

        setTimeout(() => {
            if (!isTerminated) finishIntro();
        }, 3200);
    }

    window.replaySecurityIntro = function () {
        initSecurityIntro(true);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => initSecurityIntro(false));
    } else {
        initSecurityIntro(false);
    }
})();
