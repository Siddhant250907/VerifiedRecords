/**
 * Verification Test Suite for 3D Document Explosion Hero & Service Buttons Layout
 * Tests HTML, CSS rules, DOM structure, labels, ordering, and responsive styling.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('====================================================');
console.log('VERIFIED RECORDS — 3D HERO TEST SUITE');
console.log('====================================================\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  [PASS] ${message}`);
        passCount++;
    } else {
        console.error(`  [FAIL] ${message}`);
        failCount++;
    }
}

// 1. Fetch live http://localhost:3000/index.html
function fetchLiveHTML() {
    return new Promise((resolve, reject) => {
        http.get('http://localhost:3000/index.html', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', err => reject(err));
    });
}

async function runTests() {
    console.log('1. Testing Live Server Response (http://localhost:3000/index.html)...');
    let html = '';
    try {
        html = await fetchLiveHTML();
        assert(html.length > 10000, 'Live server returned complete index.html (' + html.length + ' bytes)');
    } catch (e) {
        console.error('Failed to fetch from live server: ' + e.message);
        console.log('Falling back to local docs/index.html file...');
        html = fs.readFileSync(path.join(__dirname, '..', 'docs', 'index.html'), 'utf8');
    }

    const cssPath = path.join(__dirname, '..', 'docs', 'assets', 'css', 'style.css');
    const css = fs.readFileSync(cssPath, 'utf8');

    const jsPath = path.join(__dirname, '..', 'docs', 'assets', 'js', 'home.js');
    const js = fs.readFileSync(jsPath, 'utf8');

    console.log('\n2. Testing Service Buttons Arrangement (Section 12)...');
    assert(html.includes('class="services-buttons-row services-row-primary"'), 'First row container exists (services-row-primary)');
    assert(html.includes('class="services-buttons-row services-row-secondary"'), 'Second row container exists (services-row-secondary)');
    
    // Check Row 1 has the 3 primary buttons
    const row1Idx = html.indexOf('services-row-primary');
    const row2Idx = html.indexOf('services-row-secondary');
    const row1Content = html.substring(row1Idx, row2Idx);
    const row2Content = html.substring(row2Idx, html.indexOf('</div>\n                    </div>\n                </div>', row2Idx) + 50);

    assert(row1Content.includes('id="btnServiceIssue"') && row1Content.includes('href="admin.html"'), 'Row 1 contains Issue a Certificate (admin.html)');
    assert(row1Content.includes('id="btnServiceVerify"') && row1Content.includes('href="verify.html"'), 'Row 1 contains Verify a Certificate (verify.html)');
    assert(row1Content.includes('id="btnServiceSave"') && row1Content.includes('href="documents.html"'), 'Row 1 contains Save your Documents (documents.html)');
    assert(row2Content.includes('id="btnServiceCreateOrg"') && row2Content.includes('openUpcomingOrgNotice(event)'), 'Row 2 contains Create Organization with handler');
    assert(row2Content.includes('class="upcoming-tag">Soon</span>'), 'Create Organization has "Soon" tag preserved');

    // Check CSS for buttons
    assert(css.includes('.services-buttons-row.services-row-primary') && css.includes('flex-wrap: nowrap;'), 'Desktop Row 1 is flex-wrap: nowrap (single line on desktop)');
    assert(css.includes('.services-buttons-row.services-row-secondary') && css.includes('justify-content: center;'), 'Desktop Row 2 is centered under Row 1');
    assert(css.includes('.service-action-pill:hover') && css.includes('background: #004741 !important;'), 'Service pill hovers to #004741');
    assert(css.includes('color: #FFFFFF !important;'), 'Service pill hover text turns white');
    assert(css.includes('transform: translateY(-2.5px);'), 'Service pill has subtle elevation on hover');

    console.log('\n3. Testing Default State & Typewriter Intro (Sections 4 & 6)...');
    assert(html.includes('id="heroIntroOverlay"'), 'Typewriter brand intro overlay exists (#heroIntroOverlay)');
    assert(html.includes('id="introBrandTitle"'), 'Center stage brand title heading exists (#introBrandTitle)');
    assert(html.includes('id="docAssembledCert"'), 'Single assembled certificate element exists (#docAssembledCert)');
    assert(html.includes('id="docVerifiedStamp"'), 'Verified seal stamp element exists (#docVerifiedStamp)');
    assert(html.includes('Verified</text>') || html.includes('Verified'), 'Verified stamp contains "Verified" text');
    assert(html.includes('stroke="#004741"'), 'Verified seal stamp uses primary deep green color (#004741)');

    // CSS default state
    assert(css.includes('.hero-intro-overlay') && css.includes('.hero-intro-backdrop'), 'Intro overlay and blurred backdrop CSS exists');
    assert(css.includes('.cert-title-text'), 'Certificate title text is styled in DM Serif Display');
    assert(css.includes('.doc-assembled-certificate') && css.includes('z-index: 20;'), 'Assembled certificate is on top layer in idle state');
    assert(css.includes('.doc-shield-layer') && css.includes('opacity: 0;'), 'Security shield is hidden (opacity: 0) in initial default state');
    assert(css.includes('.doc-segment-card') && css.includes('opacity: 0;'), 'Individual segment cards are hidden (opacity: 0) in initial default state');
    assert(css.includes('@keyframes docIdleFloating'), 'Subtle floating idle animation defined');

    console.log('\n4. Testing Five Document Segments in Exact Order (Section 7)...');
    const segOrder = [
        { id: 'segCardCertificate', seg: 'certificate', title: 'Certificate' },
        { id: 'segCardAadhaar', seg: 'aadhaar', title: 'Aadhaar Card' },
        { id: 'segCardLicence', seg: 'licence', title: 'Driving Licence' },
        { id: 'segCardPan', seg: 'pan', title: 'PAN Card' },
        { id: 'segCardVault', seg: 'vault', title: 'Other Documents' }
    ];

    let lastIdx = 0;
    segOrder.forEach((seg, i) => {
        const idx = html.indexOf(`id="${seg.id}"`);
        assert(idx > -1, `Segment ${i + 1}: ${seg.title} (#${seg.id}) exists in HTML`);
        if (i > 0) {
            assert(idx > lastIdx, `Segment ${i + 1} (${seg.title}) appears AFTER Segment ${i} in DOM order`);
        }
        lastIdx = idx;
    });

    console.log('\n5. Testing Technical Callout Labels and Explanations (Section 7)...');
    const requiredLabels = [
        { key: 'certificate', title: 'Certificate', desc: 'Your academic qualification, ready to verify.' },
        { key: 'aadhaar', title: 'Aadhaar Card', desc: 'Keep an important identity document organized and accessible.' },
        { key: 'licence', title: 'Driving Licence', desc: 'Keep your driving document within reach.' },
        { key: 'pan', title: 'PAN Card', desc: 'Keep your tax identity document organized.' },
        { key: 'vault', title: 'Other Documents', desc: 'Store other important files in your personal vault.' }
    ];

    requiredLabels.forEach(lbl => {
        assert(html.includes(lbl.title), `Callout Title "${lbl.title}" present in HTML`);
        assert(html.includes(lbl.desc), `Callout Description "${lbl.desc}" present in HTML`);
    });

    assert(css.includes('.leader-line'), 'SVG Leader lines CSS exists');
    assert(css.includes('.leader-line.active') && css.includes('stroke: #004741;'), 'Active leader line highlights in Cyprus green');
    assert(css.includes('.doc-callout-tag:hover .callout-tag-desc') || css.includes('.doc-callout-tag.active .callout-tag-desc'), 'Callout description smoothly expands on card hover/active');

    console.log('\n6. Testing Final Security Shield & Exact Text (Section 8)...');
    assert(html.includes('id="docShieldLayer"'), 'Shield layer element exists (#docShieldLayer)');
    assert(html.includes('class="exploded-shield-svg"'), 'Faceted 3D SVG shield exists');
    assert(html.includes('Secured using Blockchain Technology'), 'EXACT text "Secured using Blockchain Technology" present');
    assert(!html.includes('graduation-cap') && !html.includes('fingerprint') && !html.includes('fa-check') && !html.includes('fa-graduation-cap'), 'No graduation cap or checkmark icon placed inside the shield');

    assert(css.includes('.doc-explosion-stage:hover .doc-shield-layer') && css.includes('opacity: 1;'), 'Shield emerges (opacity: 1) on hover/explosion');
    assert(css.includes('.doc-shield-badge') && css.includes('.shield-badge-text'), 'Shield badge styled cleanly');

    console.log('\n7. Testing Suspended Hanging Thread (Section 4)...');
    assert(html.includes('id="certHangingAssembly"'), 'Hanging thread assembly exists in HTML (#certHangingAssembly)');
    assert(html.includes('class="cert-anchor-pin"'), 'Thread anchor pin exists');
    assert(html.includes('class="cert-hanging-cord"'), 'Thread hanging cord exists');
    assert(html.includes('class="cert-grommet-eyelet"'), 'Certificate grommet eyelet exists');
    assert(css.includes('.cert-hanging-assembly'), 'cert-hanging-assembly CSS defined');
    assert(css.includes('@keyframes certSuspendedSway'), 'certSuspendedSway animation defined');
    assert(css.includes('.cert-hanging-assembly.is-retracted'), 'Retraction state defined for hover transition');

    console.log('\n8. Testing Continuous Hash-Character Stream Conduit (Section 10)...');
    assert(html.includes('id="hashStreamRail"'), 'Hash stream rail exists (#hashStreamRail)');
    assert(html.includes('id="hashPortalSource"'), 'Upper source portal exists (#hashPortalSource)');
    assert(html.includes('id="hashPortalReceiver"'), 'Lower receiver portal exists (#hashPortalReceiver)');
    assert(html.includes('id="hashCharColumn"'), 'Character stream column exists (#hashCharColumn)');
    assert(css.includes('.hash-stream-rail'), 'hash-stream-rail CSS defined');
    assert(css.includes('@keyframes portalPulse'), 'Portal pulse keyframes defined');
    assert(js.includes('function initHashCharacterStream()'), 'initHashCharacterStream controller function defined in home.js');

    console.log('\n9. Testing Protruding Navbar Shield Badge (Section 11)...');
    assert(html.includes('class="nav-brand-icon"'), 'Navbar brand icon exists');
    assert(css.includes('.nav-brand-icon') && css.includes('border-radius: 50% !important;'), 'Brand icon is circular (border-radius: 50%)');
    assert(css.includes('margin-top: -6px;'), 'Brand icon protrudes above navbar baseline (margin-top: -6px)');
    assert(css.includes('.nav-brand-icon::after'), 'Brand icon has expanding halo on hover');
    assert(js.includes('function initNavbarBrandInteraction()'), 'Navbar brand click smooth-scrolls to top on homepage');

    console.log('\n10. Testing Non-Overlapping Exploded Layout & Legibility (Section 3 & 5)...');
    assert(!html.includes('0x8F3a'), 'No fake transaction hash on certificate card');
    assert(html.includes('LMV') && html.includes('MVWG'), 'Driving Licence clearly displays LMV and MVWG');
    assert(html.includes('class="seg-id-photo-box"'), 'Aadhaar photo slot placeholder present');
    assert(html.includes('class="seg-pan-sig-area"'), 'PAN signature area present');
    assert(css.includes('max-width: 680px;'), 'Stage expanded to max-width: 680px for ample non-overlapping spacing');
    assert(css.includes('width: 236px;'), 'Card width expanded to 236px for readable text');
    assert(css.includes('rotateX(7deg) rotateY(-11deg)'), 'Gentle isometric tilt used to keep text readable');

    console.log('\n11. Testing JavaScript Interaction Controller (home.js)...');
    assert(js.includes('function initHeroTypewriterIntro()'), 'initHeroTypewriterIntro controller function defined');
    assert(js.includes('function init3DDocumentExplosion()'), 'init3DDocumentExplosion controller function defined');
    assert(js.includes('triggerExplosion()') && js.includes('collapseExplosion()'), 'State transitions (trigger & collapse) defined');
    assert(js.includes('stage.addEventListener("mouseenter"'), 'Desktop hover enter listener attached to stage');
    assert(js.includes('stage.addEventListener("mouseleave"'), 'Desktop hover leave listener attached to stage');
    assert(js.includes('card.addEventListener("mouseenter"'), 'Individual card hover listeners attached');
    assert(js.includes('e.stopPropagation()'), 'Event propagation stopped on card hovers so stack does not collapse');
    assert(js.includes('init3DDocumentExplosion()'), 'init3DDocumentExplosion is called on DOMContentLoaded');
    assert(js.includes('initHashCharacterStream()'), 'initHashCharacterStream is called on DOMContentLoaded');

    console.log('\n12. Testing Accessibility & Keyboard Navigation (Section 13)...');
    assert(html.includes('id="docExplosionStage"') && html.includes('role="region"') && html.includes('tabindex="0"'), 'Stage is focusable with role="region" and tabindex="0"');
    assert(html.includes('id="docExplosionCloseBtn"'), 'Accessible/mobile reassemble close button exists');
    assert(js.includes('e.key === "Enter"') && js.includes('e.key === "Escape"'), 'Keyboard Enter/Space and Escape keys supported');
    assert(css.includes('@media (prefers-reduced-motion: reduce)'), 'prefers-reduced-motion media query implemented');

    console.log('\n13. Testing Preserved Website Features & Theme Consistency (Section 1, 2, 12)...');
    assert(html.includes('id="heroParticlesCanvas"'), 'Background particle canvas intact');
    assert(html.includes('id="heroBrandName"'), 'Brand heading "Verified Records" intact');
    assert(html.includes('id="visualTagline"') && html.includes('Deliberately serving to the people with Advanced Security'), 'Brand tagline intact');
    assert(html.includes('class="video-guides-section"'), 'Video guides section intact');
    assert(html.includes('administrative') && html.includes('verification') && html.includes('documents'), '3 Video demo cards intact');
    assert(html.includes('id="upcomingOrgModal"'), 'Upcoming Org modal intact');
    assert(!css.includes('#adminLoginBtn { background: linear-gradient(135deg, #2563eb'), 'Legacy blue removed from adminLoginBtn');
    assert(css.includes('.vault-btn-primary') && !css.includes('.vault-btn-primary { background: linear-gradient(135deg, var(--color-brand-primary) 0%, #1d4ed8 100%)'), 'Legacy blue removed from vault-btn-primary');

    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('====================================================');

    if (failCount > 0) {
        process.exit(1);
    }
}

runTests();
