/**
 * Comprehensive Automated Verification Suite for Video Guides Integration
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  [PASS] ${message}`);
        passed++;
    } else {
        console.error(`  [FAIL] ${message}`);
        failed++;
    }
}

async function runVideoIntegrationTests() {
    console.log('====================================================');
    console.log('VERIFIED RECORDS — VIDEO INTEGRATION TEST SUITE');
    console.log('====================================================\n');

    const docsDir = path.join(__dirname, '../docs');
    const homeJsPath = path.join(docsDir, 'assets/js/home.js');
    const indexHtmlPath = path.join(docsDir, 'index.html');
    const cssPath = path.join(docsDir, 'assets/css/style.css');

    // 1. Check video files on disk
    console.log('1. Checking Video Files on Disk:');
    const videoFiles = [
        { key: 'administrative', file: 'administrative.mp4', minSize: 5000000 },
        { key: 'verification', file: 'verification.mp4', minSize: 3000000 },
        { key: 'document-uploads', file: 'document-uploads.mp4', minSize: 4000000 }
    ];

    for (const vf of videoFiles) {
        const fullPath = path.join(docsDir, 'assets/videos', vf.file);
        const exists = fs.existsSync(fullPath);
        assert(exists, `File exists on disk: docs/assets/videos/${vf.file}`);
        if (exists) {
            const stats = fs.statSync(fullPath);
            assert(stats.size > vf.minSize, `File size is healthy (${(stats.size / 1024 / 1024).toFixed(2)} MB): ${vf.file}`);
        }
    }

    // 2. Check index.html DOM structure
    console.log('\n2. Checking Homepage (index.html) DOM Elements:');
    const htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    assert(htmlContent.includes('class="video-guides-section"'), 'Video guides section container present');
    assert(htmlContent.includes('id="videoCardLeft"') && htmlContent.includes('data-video="administrative"'), 'Card 1 (Administrative) markup present');
    assert(htmlContent.includes('id="videoCardMiddle"') && htmlContent.includes('data-video="verification"'), 'Card 2 (Verification) markup present');
    assert(htmlContent.includes('id="videoCardRight"') && htmlContent.includes('data-video="documents"'), 'Card 3 (Document Uploads) markup present');
    assert(htmlContent.includes('id="videoModalBackdrop"'), 'Enlarged modal backdrop present');
    assert(htmlContent.includes('id="videoModalTitle"'), 'Modal title container present');
    assert(htmlContent.includes('id="videoModalMedia"'), 'Modal media container present');
    assert(htmlContent.includes('id="videoModalInstructionsList"'), 'Modal instructions list container present');
    assert(htmlContent.includes('id="videoModalCloseBtn"'), 'Modal close button present');

    // 3. Check home.js configuration & logic
    console.log('\n3. Checking home.js Configuration & Handlers:');
    const homeJs = fs.readFileSync(homeJsPath, 'utf8');

    // Check sources
    assert(homeJs.includes('src: "/assets/videos/administrative.mp4"'), 'Administrative mapped to root-relative /assets/videos/administrative.mp4');
    assert(homeJs.includes('src: "/assets/videos/verification.mp4"'), 'Verification mapped to root-relative /assets/videos/verification.mp4');
    assert(homeJs.includes('src: "/assets/videos/document-uploads.mp4"'), 'Document Uploads mapped to root-relative /assets/videos/document-uploads.mp4');

    // Check instructions
    assert(homeJs.includes('Open the Registrar Portal.'), 'Administrative Step 1 present');
    assert(homeJs.includes('Sign in with the appropriate administrator account.'), 'Administrative Step 2 present');
    assert(homeJs.includes('Enter and review the certificate details.'), 'Administrative Step 3 present');
    assert(homeJs.includes('Submit the issuance request.'), 'Administrative Step 4 present');
    assert(homeJs.includes('Complete the required confirmation.'), 'Administrative Step 5 present');
    assert(homeJs.includes('Review the result.'), 'Administrative Step 6 present');

    assert(homeJs.includes('Open the verification page.'), 'Verification Step 1 present');
    assert(homeJs.includes('Enter the certificate details required by the real form.'), 'Verification Step 2 present');
    assert(homeJs.includes('Submit the request.'), 'Verification Step 3 present');
    assert(homeJs.includes('Review the verification result.'), 'Verification Step 4 present');
    assert(homeJs.includes('Download or print the certificate only when the existing application supports it and verification succeeds.'), 'Verification Step 5 present');

    assert(homeJs.includes('Open the document vault.'), 'Document Uploads Step 1 present');
    assert(homeJs.includes('Create or open the required vault.'), 'Document Uploads Step 2 present');
    assert(homeJs.includes('Unlock it using the vault password.'), 'Document Uploads Step 3 present');
    assert(homeJs.includes('Select the document category.'), 'Document Uploads Step 4 present');
    assert(homeJs.includes('Upload and save the document.'), 'Document Uploads Step 5 present');
    assert(homeJs.includes('Return to the vault to view or download it.'), 'Document Uploads Step 6 present');

    // Check preview & modal lifecycle functions
    assert(homeJs.includes('function pauseAllPreviewVideos()'), 'pauseAllPreviewVideos function defined');
    assert(homeJs.includes('function resumeVisiblePreviewVideos()'), 'resumeVisiblePreviewVideos function defined');
    assert(homeJs.includes('function initVideoCards()'), 'initVideoCards function defined');
    assert(homeJs.includes('function openVideoModal('), 'openVideoModal function defined');
    assert(homeJs.includes('function closeVideoModal()'), 'closeVideoModal function defined');
    assert(homeJs.includes('previewVideo.muted = true;'), 'Card preview video is muted');
    assert(homeJs.includes('modalVideo.muted = false;'), 'Modal enlarged video allows audio');
    assert(homeJs.includes('modalVideo.controls = true;'), 'Modal enlarged video enables playback controls');
    assert(homeJs.includes('video.load();'), 'Modal cleanup calls video.load() to free decoder buffer');

    // 4. Check CSS styling
    console.log('\n4. Checking CSS Styling (style.css):');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    assert(cssContent.includes('.video-modal-media-wrap video') && cssContent.includes('object-fit: contain'), 'Modal video styled with object-fit: contain');
    assert(cssContent.includes('.video-modal-backdrop') && cssContent.includes('backdrop-filter: blur('), 'Modal backdrop blur retained');
    assert(cssContent.includes('.video-card') && cssContent.includes('border-radius:'), 'Card rounded corners retained');

    // 5. Check Live HTTP Serving on Local Express Server
    console.log('\n5. Checking Live Express HTTP Serving (http://localhost:3000):');
    const testEndpoints = [
        { path: '/assets/videos/administrative.mp4', expectedType: 'video/mp4' },
        { path: '/assets/videos/verification.mp4', expectedType: 'video/mp4' },
        { path: '/assets/videos/document-uploads.mp4', expectedType: 'video/mp4' }
    ];

    for (const ep of testEndpoints) {
        await new Promise((resolve) => {
            const req = http.request({
                hostname: 'localhost',
                port: 3000,
                path: ep.path,
                method: 'HEAD'
            }, (res) => {
                assert(res.statusCode === 200, `HTTP 200 OK for ${ep.path}`);
                assert(res.headers['content-type'] === ep.expectedType, `Content-Type is ${ep.expectedType} for ${ep.path}`);
                assert(res.headers['accept-ranges'] === 'bytes', `Accept-Ranges is bytes for ${ep.path}`);
                resolve();
            });
            req.on('error', (e) => {
                assert(false, `HTTP request failed for ${ep.path}: ${e.message}`);
                resolve();
            });
            req.end();
        });
    }

    // Check Range Request (seeking/streaming)
    await new Promise((resolve) => {
        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: '/assets/videos/administrative.mp4',
            method: 'GET',
            headers: { 'Range': 'bytes=0-100' }
        }, (res) => {
            assert(res.statusCode === 206, 'HTTP 206 Partial Content returned for byte range request');
            assert(res.headers['content-range'] && res.headers['content-range'].startsWith('bytes 0-100/'), 'Content-Range header matches requested range');
            resolve();
        });
        req.on('error', (e) => {
            assert(false, `Range request failed: ${e.message}`);
            resolve();
        });
        req.end();
    });

    console.log('\n====================================================');
    console.log(`VIDEO INTEGRATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================');

    if (failed > 0) {
        process.exit(1);
    }
}

runVideoIntegrationTests();
