const http = require('http');

const routes = [
    '/index.html',
    '/about.html',
    '/admin.html',
    '/documents.html',
    '/login.html',
    '/signup.html',
    '/verify.html',
    '/assets/css/style.css',
    '/assets/js/home.js'
];

let passCount = 0;
let failCount = 0;

function checkRoute(path) {
    return new Promise((resolve) => {
        http.get(`http://localhost:3000${path}`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    console.log(`[PASS] ${path} returned 200 OK (${data.length} bytes)`);
                    if (path.endsWith('.html')) {
                        const hasFonts = data.includes('DM+Serif+Display') && data.includes('Manrope');
                        const hasCSS = data.includes('assets/css/style.css');
                        if (hasFonts && hasCSS) {
                            console.log(`  └─ [PASS] ${path} loads DM Serif Display & Manrope and links style.css`);
                            passCount += 2;
                        } else {
                            console.error(`  └─ [FAIL] ${path} missing fonts or style.css!`);
                            failCount++;
                        }
                    }
                    passCount++;
                } else {
                    console.error(`[FAIL] ${path} returned status ${res.statusCode}`);
                    failCount++;
                }
                resolve();
            });
        }).on('error', (err) => {
            console.error(`[FAIL] ${path} error: ${err.message}`);
            failCount++;
            resolve();
        });
    });
}

async function run() {
    console.log('Testing all platform routes on http://localhost:3000 ...\n');
    for (const route of routes) {
        await checkRoute(route);
    }
    console.log(`\nROUTE TEST RESULTS: ${passCount} passed, ${failCount} failed`);
    if (failCount > 0) process.exit(1);
}

run();
