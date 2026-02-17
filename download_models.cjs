const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';
const DIR = path.join(__dirname, 'public', 'models');

const files = [
    'tiny_face_detector_model-weights_manifest.json',
    'tiny_face_detector_model-shard1',
    'face_landmark_68_model-weights_manifest.json',
    'face_landmark_68_model-shard1',
    'face_recognition_model-weights_manifest.json',
    'face_recognition_model-shard1',
    'face_recognition_model-shard2',
];

if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

async function download(filename) {
    return new Promise((resolve, reject) => {
        const filePath = path.join(DIR, filename);
        const file = fs.createWriteStream(filePath);
        https.get(`${BASE}/${filename}`, (res) => {
            if (res.statusCode !== 200) {
                // Follow redirect
                if (res.statusCode === 301 || res.statusCode === 302) {
                    https.get(res.headers.location, (res2) => {
                        res2.pipe(file);
                        file.on('finish', () => {
                            file.close();
                            const size = fs.statSync(filePath).size;
                            console.log(`  OK: ${filename} (${size} bytes)`);
                            resolve();
                        });
                    }).on('error', reject);
                    return;
                }
                reject(new Error(`HTTP ${res.statusCode} for ${filename}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                const size = fs.statSync(filePath).size;
                console.log(`  OK: ${filename} (${size} bytes)`);
                resolve();
            });
        }).on('error', reject);
    });
}

(async () => {
    console.log('Downloading face-api.js models...\n');
    for (const f of files) {
        console.log(`Downloading ${f}...`);
        await download(f);
    }
    console.log('\nAll models downloaded!');
    const allFiles = fs.readdirSync(DIR);
    console.log('\nFiles in models/:');
    allFiles.forEach(f => {
        const size = fs.statSync(path.join(DIR, f)).size;
        console.log(`  ${f} - ${size} bytes`);
    });
})();
