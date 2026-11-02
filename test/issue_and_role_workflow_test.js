const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('ISSUANCE STABILITY & ADMIN/OWNER WORKFLOW TEST');
console.log('====================================================\n');

const adminJsPath = path.join(__dirname, '../docs/assets/js/admin.js');
const adminHtmlPath = path.join(__dirname, '../docs/admin.html');
const styleCssPath = path.join(__dirname, '../docs/assets/css/style.css');

const adminJs = fs.readFileSync(adminJsPath, 'utf8');
const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
const styleCss = fs.readFileSync(styleCssPath, 'utf8');

let passed = 0;
let failed = 0;

function check(name, fn) {
    try {
        fn();
        console.log(`  [PASS] ${name}`);
        passed++;
    } catch (e) {
        console.error(`  [FAIL] ${name}: ${e.message}`);
        failed++;
    }
}

// 1. Issuance Stability: updateAdminGateUI never hides form inside workspace
check('1. updateAdminGateUI protects workspace from hiding adminFormCard', () => {
    assert(adminJs.includes('const orgWorkspace = document.getElementById("orgWorkspaceSection");'), 'Should look up orgWorkspaceSection');
    assert(adminJs.includes('if (orgWorkspace && orgWorkspace.style.display !== "none")'), 'Should return early if orgWorkspace is visible');
});

// 2. Issuance Stability: issueCertificate handles missing session for organization owner/admin
check('2. issueCertificate resolves activeAdmin for organization owners/admins', () => {
    assert(adminJs.includes('defaultAdminId = (session && session.adminUserId) ? session.adminUserId : (isConfiguredOwner ? "Platform Owner" : "Organization Owner")'), 'Should fallback cleanly to owner/admin identity');
    assert(adminJs.includes('if (currentWorkspaceOrg && isAdmin)'), 'Should recognize active organization admin/owner');
});

// 3. Issuance Stability: issueCertificate does not abruptly call switchTab("tabOrgPortal")
check('3. issueCertificate does not abruptly switch tabs when active org is resolved', () => {
    assert(!adminJs.includes('if (!currentActiveOrg) {\n            showMessage("Please select an approved organization in which you have issuing permission before issuing a certificate.", "warning");\n            if (typeof switchTab === "function") switchTab("tabOrgPortal");'), 'Should not kick user out of workspace');
});

// 4. Role Differentiation: vr_session_locked enables switching between Owner and Admin
check('4. Session lock flag vr_session_locked prevents auto-elevating to Owner on wallet match', () => {
    assert(adminJs.includes('sessionStorage.getItem("vr_session_locked") === "true"'), 'Should respect vr_session_locked');
    assert(adminJs.includes('sessionStorage.removeItem("vr_session_locked");'), 'Should clear vr_session_locked on Option B login');
    assert(adminJs.includes('sessionStorage.setItem("vr_session_locked", "true");'), 'Should set vr_session_locked when locking session');
});

// 5. Role Differentiation: wsLockAdminBtn is wired to lock session from Terminal Header
check('5. wsLockAdminBtn is wired to lock session from Terminal Header', () => {
    assert(adminJs.includes('const wsLockAdminBtn = document.getElementById("wsLockAdminBtn");'), 'Should locate wsLockAdminBtn');
    assert(adminJs.includes('wsLockAdminBtn.addEventListener("click", handleAdminLock);'), 'Should attach handleAdminLock listener');
});

// 6. UI Sizing: Tabs and header boxes are enlarged
check('6. Tab and box sizing increased in style.css', () => {
    assert(styleCss.includes('padding: 14px 26px;'), 'Tabs should have larger 14px 26px padding');
    assert(styleCss.includes('font-size: 1.05rem;'), 'Tabs should have 1.05rem font-size');
    assert(styleCss.includes('padding: 30px 34px;'), 'Header should have 30px 34px padding');
    assert(styleCss.includes('font-size: 2.1rem;'), 'Workspace title should have 2.1rem font-size');
});

// 7. No Horizontal Scroll: fixed-compact-table with colgroup in admin.html
check('7. Table has fixed-compact-table class and percentage colgroups', () => {
    assert(adminHtml.includes('class="members-list-table fixed-compact-table"'), 'Table should have fixed-compact-table class');
    assert(adminHtml.includes('<col style="width: 22%;">'), 'Requests table should have percentage colgroup');
    assert(!adminHtml.includes('min-width: 180px'), 'min-width: 180px should be removed to prevent overflow');
    assert(styleCss.includes('.members-list-table.fixed-compact-table {'), 'CSS should enforce table-layout: fixed');
});

console.log(`\n====================================================`);
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('====================================================\n');
if (failed > 0) process.exit(1);
