const http = require('http');
const assert = require('assert');

console.log('====================================================');
console.log('ORGANIZATION WORKSPACE & ADMIN APPROVAL WORKFLOW TEST');
console.log('====================================================\n');

function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const payload = body ? JSON.stringify(body) : null;
        const reqHeaders = { ...headers };
        if (payload) {
            reqHeaders['Content-Type'] = 'application/json';
            reqHeaders['Content-Length'] = Buffer.byteLength(payload);
        }

        const req = http.request({
            hostname: 'localhost',
            port: 5000,
            path,
            method,
            headers: reqHeaders
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {
                    parsed = data;
                }
                resolve({ status: res.statusCode, headers: res.headers, body: parsed });
            });
        });

        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

async function runTests() {
    let passed = 0;
    let failed = 0;

    async function check(name, fn) {
        try {
            await fn();
            console.log(`  [PASS] ${name}`);
            passed++;
        } catch (err) {
            console.error(`  [FAIL] ${name}`);
            console.error(`         ${err.message}`);
            failed++;
        }
    }

    // 1. Check /api/organization/my-portal
    let testOrgId = null;
    let testOrgName = null;
    await check('1. GET /api/organization/my-portal returns organizations', async () => {
        const res = await request('GET', '/api/organization/my-portal', null, {
            'Authorization': 'Bearer test-token-admin'
        });
        assert.strictEqual(res.status, 200);
        assert(res.body.success, 'my-portal should return success');
        const orgs = res.body.allOrganizations || res.body.memberships || [];
        assert(orgs.length > 0, 'Should return at least one organization');
        const approvedOrg = orgs.find(o => (o.status || o.orgStatus) === 'Approved');
        assert(approvedOrg, 'Should find an Approved organization');
        console.log('       Approved org found:', approvedOrg.orgId, approvedOrg.name, 'status:', approvedOrg.status);
        testOrgId = approvedOrg.orgId;
        testOrgName = approvedOrg.name;
    });

    const testAdminUserId = 'test_dean_' + Date.now();
    const testPassword = 'Password123!';
    const testEmail = `dean_${Date.now()}@university.edu`;
    let createdRequestId = null;

    // 2. Submit Option A request
    await check('2. POST /api/organization/:orgId/admin-request (Option A) submits a Pending admin request', async () => {
        const res = await request('POST', `/api/organization/${encodeURIComponent(testOrgId)}/admin-request`, {
            adminUserId: testAdminUserId,
            institutionalEmail: testEmail,
            password: testPassword
        });
        if (res.status !== 200) {
            console.log('       admin-request failed:', res.status, res.body);
        }
        assert.strictEqual(res.status, 200);
        assert(res.body.success, 'Option A should return success');
        assert.strictEqual(res.body.status, 'Pending', 'Status must be Pending approval by organization owner');
        assert(res.body.message.toLowerCase().includes('pending'), 'Message should indicate pending approval');
    });

    // 3. Option B before approval should be blocked with 403 Forbidden
    await check('3. POST /api/organization/:orgId/admin-login (Option B) BLOCKS unapproved admin with 403', async () => {
        const res = await request('POST', `/api/organization/${encodeURIComponent(testOrgId)}/admin-login`, {
            adminUserId: testAdminUserId,
            password: testPassword
        });
        assert.strictEqual(res.status, 403, 'Must return 403 Forbidden when not authorized for this org');
        assert.strictEqual(res.body.success, false);
        assert(res.body.message.includes('not an authorized administrator'), 'Message must inform user that account is not authorized for this org');
    });

    // 4. View pending admin requests for this org
    await check('4. GET /api/organization/:orgId/admin-requests lists the pending request', async () => {
        const res = await request('GET', `/api/organization/${encodeURIComponent(testOrgId)}/admin-requests`);
        assert.strictEqual(res.status, 200);
        assert(res.body.success, 'Should return success');
        const reqs = res.body.requests || [];
        const found = reqs.find(r => r.adminUserId === testAdminUserId);
        assert(found, 'Should find the submitted admin request');
        assert.strictEqual(found.status, 'Pending');
        createdRequestId = found._id;
    });

    // 5. Organization Owner approves the administrator request
    await check('5. POST /api/organization/:orgId/admin-requests/:requestId/approve approves the request', async () => {
        assert(createdRequestId, 'RequestId must exist');
        const res = await request('POST', `/api/organization/${encodeURIComponent(testOrgId)}/admin-requests/${encodeURIComponent(createdRequestId)}/approve`, {
            resolvedBy: 'Organization Owner'
        });
        assert.strictEqual(res.status, 200);
        assert(res.body.success, 'Approval should succeed');
        assert.strictEqual(res.body.request.status, 'Approved');
    });

    // 6. Option B after approval succeeds and issues session token
    await check('6. POST /api/organization/:orgId/admin-login (Option B) SUCCEEDS after approval', async () => {
        const res = await request('POST', `/api/organization/${encodeURIComponent(testOrgId)}/admin-login`, {
            adminUserId: testAdminUserId,
            password: testPassword
        });
        assert.strictEqual(res.status, 200, 'Must return 200 OK after owner approval');
        assert(res.body.success, 'Login should succeed');
        assert(res.body.token, 'Should return admin session token');
        assert.strictEqual(res.body.admin.adminUserId, testAdminUserId);
        assert.strictEqual(res.body.admin.role, 'admin');
    });

    // 7. Verify multi-tenant isolation: Admin cannot log into non-authorized org
    await check('7. Multi-Tenant Isolation: Admin cannot log into a different organization', async () => {
        const res = await request('POST', `/api/organization/fake_diff_org_9999/admin-login`, {
            adminUserId: testAdminUserId,
            password: testPassword
        });
        assert(res.status === 404 || res.status === 403, 'Should reject unauthorized organization login');
        assert.strictEqual(res.body.success, false);
    });

    console.log('\n====================================================');
    console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
    console.log('====================================================');

    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('Test execution fatal error:', err);
    process.exit(1);
});
