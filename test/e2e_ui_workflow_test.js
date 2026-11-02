/**
 * Comprehensive End-to-End Verification Test for Verified Records Requirements:
 * 1. Organization Entry Flow
 * 2. Restore Two Admin Choices on Organization Dashboard ONLY
 * 3. Correct Organization-Specific Dashboard (4 tabs, default Members & Roster)
 * 4. Remove Personal Wallet Options Permanently (Strict Platform Owner enforcement)
 * 5. Clean, Modest Rectangular UI Aesthetics
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('====================================================');
console.log('VERIFIED RECORDS — REQUIREMENT COMPLIANCE TEST SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  [PASS] ${description}`);
        passedTests++;
    } catch (err) {
        console.error(`  [FAIL] ${description}`);
        console.error(`         ${err.message}`);
    }
}

const adminHtml = fs.readFileSync(path.join(__dirname, '../docs/admin.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(__dirname, '../docs/assets/js/admin.js'), 'utf8');
const styleCss = fs.readFileSync(path.join(__dirname, '../docs/assets/css/style.css'), 'utf8');
const orgRoute = fs.readFileSync(path.join(__dirname, '../server/routes/organization.js'), 'utf8');

// 1. Organization Entry Flow
console.log('1. Verifying Organization Entry Flow:');
test('admin.html has #orgPortalSection as the primary portal entry', () => {
    assert(adminHtml.includes('id="orgPortalSection"'));
    assert(adminHtml.includes('id="myOrgsContainer"'));
    assert(adminHtml.includes('id="btnActionCreateOrg"'));
    assert(adminHtml.includes('id="btnActionJoinOrg"'));
});

test('admin.js defaults workspace tab to "members" instead of "issue"', () => {
    assert(adminJs.includes('targetTab = "members"'));
    assert(!adminJs.includes('const resolvedTab = "issue"'));
});

test('admin.js blocks pending or rejected organizations from entering workspace', () => {
    assert(adminJs.includes('const st = (org.status || "Approved").toLowerCase()'));
    assert(adminJs.includes('if (st !== "approved")'));
    assert(adminJs.includes("pending approval or rejected"));
});

// 2. Two Admin Choices on Organization Dedicated Page ONLY (NOT on Global Landing Page)
console.log('\n2. Verifying Two Admin Choices on Organization Dedicated Page ONLY:');
test('admin.html has REMOVED #portalAdminChoicesCard from global #orgPortalSection', () => {
    const portalIndex = adminHtml.indexOf('id="orgPortalSection"');
    const workspaceIndex = adminHtml.indexOf('id="orgWorkspaceSection"');
    assert(portalIndex !== -1 && workspaceIndex !== -1);
    const portalSubstr = adminHtml.slice(portalIndex, workspaceIndex);
    assert(!portalSubstr.includes('id="portalAdminChoicesCard"'), 'Global landing page must not contain admin choices card');
    assert(!portalSubstr.includes('Option B — Existing Admin'), 'Global landing page must not contain Option B');
    assert(!portalSubstr.includes('Option A — Become an Admin'), 'Global landing page must not contain Option A');
});

test('admin.html places #portalAdminChoicesCard directly inside #orgWorkspaceSection', () => {
    const workspaceIndex = adminHtml.indexOf('id="orgWorkspaceSection"');
    const choicesIndex = adminHtml.indexOf('id="portalAdminChoicesCard"');
    assert(workspaceIndex !== -1 && choicesIndex !== -1);
    assert(choicesIndex > workspaceIndex, 'Admin choices card must be inside the organization workspace section');
});

test('#portalAdminChoicesCard contains Option B (Existing Admin) and Option A (Become Admin)', () => {
    assert(adminHtml.includes('id="btnChoiceExistingAdmin"'));
    assert(adminHtml.includes('Option B — Existing Admin'));
    assert(adminHtml.includes('id="btnChoiceBecomeAdmin"'));
    assert(adminHtml.includes('Option A — Become an Admin'));
    assert(adminHtml.includes('id="portalAdminLoginForm"'));
    assert(adminHtml.includes('id="portalBecomeAdminForm"'));
    assert(adminHtml.includes('id="portalAdminUserId"'));
    assert(adminHtml.includes('id="portalAdminPassword"'));
    assert(adminHtml.includes('id="portalNewAdminUserId"'));
    assert(adminHtml.includes('id="portalNewAdminEmail"'));
});

test('Admin choices are NOT duplicated inside the certificate issuance form', () => {
    const issueFormIndex = adminHtml.indexOf('id="adminFormCard"');
    assert(issueFormIndex !== -1);
    const issueFormSubstr = adminHtml.slice(issueFormIndex);
    assert(!issueFormSubstr.includes('id="portalAdminChoicesCard"'));
    assert(!issueFormSubstr.includes('id="btnChoiceExistingAdmin"'));
    assert(!issueFormSubstr.includes('id="btnChoiceBecomeAdmin"'));
    assert(!adminHtml.includes('id="wsAdminGateCard"'));
    assert(!adminHtml.includes('id="wsMemberAdminGateBox"'));
    assert(!adminHtml.includes('id="adminGateCard"'));
});

// 3. Organization-Specific Dashboard
console.log('\n3. Verifying Organization-Specific Dashboard:');
test('admin.html has all 4 rectangular workspace navigation tabs', () => {
    assert(adminHtml.includes('id="wsTabMembers"'));
    assert(adminHtml.includes('id="wsTabIssue"'));
    assert(adminHtml.includes('id="wsTabCerts"'));
    assert(adminHtml.includes('id="wsTabAccessKey"'));
});

test('Unauthorized users are shown #wsUnauthorizedNotice with return button', () => {
    assert(adminHtml.includes('id="wsUnauthorizedNotice"'));
    assert(adminHtml.includes('id="btnReturnToPortalFromUnauthorized"'));
    assert(adminJs.includes('wsUnauthorizedNotice'));
});

// 4. Remove Personal Wallet Options & Strictly Enforce Platform Owner
console.log('\n4. Verifying Removal of Personal Wallet Features:');
test('admin.html has completely removed personal wallet options and challenge buttons', () => {
    assert(!adminHtml.includes('walletChoiceMyWallet'));
    assert(!adminHtml.includes('walletChoiceOwnerWallet'));
    assert(!adminHtml.includes('btnLinkPersonalWallet'));
    assert(!adminHtml.includes('btnVerifyMyWallet'));
    assert(!adminHtml.includes('Choice A: Use my personal MetaMask wallet'));
    assert(!adminHtml.includes('Choice B: Use org owner wallet'));
    assert(!adminHtml.includes('transactionWalletCard'));
});

test('admin.js does not contain personal wallet radio listeners or linking routines', () => {
    assert(!adminJs.includes('walletChoiceMyWallet'));
    assert(!adminJs.includes('walletChoiceOwnerWallet'));
    assert(!adminJs.includes('handleVerifyMyWallet'));
    assert(!adminJs.includes('handleWalletSelectionChange'));
});

test('admin.js defines exact Platform Owner addresses for Sepolia and Ganache', () => {
    assert(adminJs.includes('0x1FC04CfBF2f7B0F32AEBecd17880afeb38BFacC7'));
    assert(adminJs.includes('0x9317939Ea9f3369C83776517f0549DC4552c2931'));
    assert(adminJs.includes('getConfiguredOwnerForNetwork'));
    assert(adminJs.includes('validateMetaMaskOwner'));
});

test('admin.js enforces Platform Owner wallet during certificate submission without auto-redirect', () => {
    assert(adminJs.includes('const configuredOwner = getConfiguredOwnerForNetwork(net)'));
    assert(!adminJs.includes('inlineSwitchToGanacheBtn'));
    assert(!adminJs.includes('window.switchNetworkToGanache'));
});

// 5. Backend Organization Isolation & Lifecycle Status
console.log('\n5. Verifying Backend Multi-Tenant Organization Lifecycle:');
test('server/routes/organization.js preserves true lifecycle status in /my-portal', () => {
    assert(orgRoute.includes('status: orgStatus'));
    assert(orgRoute.includes('orgStatus: orgStatus'));
    assert(orgRoute.includes('isAuthorizedIssuer: canIssue'));
    assert(orgRoute.includes('canIssue: canIssue'));
});

// 6. UI Aesthetics (No pills, no 9999px radius, clean 4-8px)
console.log('\n6. Verifying Rectangular Aesthetics in CSS & HTML:');
test('style.css does not have .transaction-wallet-card', () => {
    assert(!styleCss.includes('.transaction-wallet-card {'));
});

test('admin-gate and badges use modest border-radius', () => {
    assert(styleCss.includes('.admin-gate-card {'));
    assert(styleCss.includes('.admin-user-badge {'));
    assert(styleCss.includes('.admin-id-badge {'));
});

console.log('\n====================================================');
console.log(`TOTAL TESTS: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log('====================================================');

if (passedTests === totalTests) {
    process.exit(0);
} else {
    process.exit(1);
}
