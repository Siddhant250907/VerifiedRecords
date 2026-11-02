const fs = require('fs');
const assert = require('assert');

console.log('====================================================');
console.log('PORTAL INTERACTIVITY & BUTTON BEHAVIOR TEST SUITE');
console.log('====================================================');

// 1. Verify index.html
const indexHtml = fs.readFileSync('docs/index.html', 'utf8');
assert(!indexHtml.includes('>Issue a Certificate<'), 'Issue a Certificate button removed from homepage');
assert(indexHtml.includes('>Join the Organization<'), 'Join the Organization button present on homepage');
assert(indexHtml.includes('href="admin.html?action=join-org"'), 'Join the Organization links to admin.html?action=join-org');
assert(indexHtml.includes('href="admin.html?action=create-org"'), 'Create Organization links to admin.html?action=create-org');
assert(!indexHtml.includes('upcoming-tag'), 'Soon tag completely removed from Create Organization');
console.log('  [PASS] Homepage buttons updated: Join the Organization & active Create Organization');

// 2. Verify admin.html
const adminHtml = fs.readFileSync('docs/admin.html', 'utf8');
assert(adminHtml.includes('id="btnActionCreateOrg"'), 'btnActionCreateOrg exists');
assert(adminHtml.includes('id="btnActionJoinOrg"'), 'btnActionJoinOrg exists');
// Top switcher button removed as requested
assert(!adminHtml.includes('id="btnTabOrgPortal"'), 'btnTabOrgPortal cleanly removed above action buttons');
assert(!adminHtml.includes('id="btnTabIssuance"'), 'btnTabIssuance cleanly removed above action buttons');
assert(adminHtml.includes('id="btnCancelCreateOrg"'), 'btnCancelCreateOrg exists');
assert(adminHtml.includes('id="btnCancelJoinOrg"'), 'btnCancelJoinOrg exists');
assert(adminHtml.includes('Create Organization</span>'), 'Submit button renamed to Create Organization');
assert(adminHtml.includes('fa-users'), 'Join organization uses supported fa-users icon');
console.log('  [PASS] admin.html action cards, tabs removal, and modal buttons verified');

// 3. Verify admin.js logic
const adminJs = fs.readFileSync('docs/assets/js/admin.js', 'utf8');
assert(adminJs.includes('document.getElementById("btnActionCreateOrg")'), 'btnActionCreateOrg queried in admin.js');
assert(adminJs.includes('document.getElementById("btnActionJoinOrg")'), 'btnActionJoinOrg queried in admin.js');
assert(adminJs.includes('openCreateOrgModal'), 'openCreateOrgModal defined in admin.js');
assert(adminJs.includes('openJoinOrgModal'), 'openJoinOrgModal defined in admin.js');
assert(adminJs.includes('window.openCreateOrgModal = openCreateOrgModal'), 'openCreateOrgModal exposed on window');
assert(adminJs.includes('window.openJoinOrgModal = openJoinOrgModal'), 'openJoinOrgModal exposed on window');
assert(adminJs.includes('/api/organization/prepare-create'), 'prepare-create endpoint called in admin.js');
assert(adminJs.includes('eth_sendTransaction'), 'eth_sendTransaction called in admin.js');
assert(adminJs.includes('accountsChanged'), 'MetaMask accountsChanged event handled in admin.js');
console.log('  [PASS] admin.js event listeners, metamask connection, and tx dispatch verified');

// 4. Verify style.css for cancel button hover
const styleCss = fs.readFileSync('docs/assets/css/style.css', 'utf8');
assert(styleCss.includes('#DC2626'), 'Red outline color #DC2626 defined in style.css');
assert(styleCss.includes('#btnCancelCreateOrg:hover'), 'btnCancelCreateOrg:hover styled in style.css');
assert(styleCss.includes('#btnCancelJoinOrg:hover'), 'btnCancelJoinOrg:hover styled in style.css');
console.log('  [PASS] style.css cancel button hover red outline verified');

// 5. Verify home.js logic
const homeJs = fs.readFileSync('docs/assets/js/home.js', 'utf8');
assert(homeJs.includes('btnServiceJoinOrg'), 'btnServiceJoinOrg handled in home.js');
assert(homeJs.includes('btnServiceCreateOrg'), 'btnServiceCreateOrg handled in home.js');
assert(homeJs.includes('admin.html?action=join-org'), 'action=join-org routed in home.js');
assert(homeJs.includes('admin.html?action=create-org'), 'action=create-org routed in home.js');
console.log('  [PASS] home.js service link routing verified');

console.log('====================================================');
console.log('ALL INTERACTIVITY VERIFICATION TESTS PASSED (5/5)');
console.log('====================================================');
