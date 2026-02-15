/**
 * HR Mobile Connect — Host Build Script
 * Bundles frontend (Vite dist) + backend (PHP) + PWA assets into a single folder
 * for deployment to /domains/prima49.com/public_html/HR/
 *
 * Usage: npm run host:build
 */

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = __dirname;
const DIST = join(ROOT, 'dist');        // Vite build output
const OUT = join(ROOT, 'host-build');   // Final deployable folder

const BASE_PATH = '/HR';

console.log('\n🔨 HR Mobile Connect — Host Build\n');

// ── Step 1: Verify Vite build output ──
if (!existsSync(DIST)) {
    console.error('❌ dist/ folder not found. Vite build may have failed.');
    process.exit(1);
}
console.log('✅ Vite build output found at dist/');

// ── Step 2: Clean & create output directory ──
if (existsSync(OUT)) {
    rmSync(OUT, { recursive: true, force: true });
}
mkdirSync(OUT, { recursive: true });
console.log('📁 Created host-build/');

// ── Step 3: Copy Vite dist output ──
cpSync(DIST, OUT, { recursive: true });
console.log('📦 Copied Vite dist → host-build/');

// ── Step 4: Copy PHP backend ──
const apiSrc = join(ROOT, 'api');
const apiDst = join(OUT, 'api');
mkdirSync(apiDst, { recursive: true });

readdirSync(apiSrc).forEach(file => {
    const srcPath = join(apiSrc, file);
    if (statSync(srcPath).isFile()) {
        if (file === 'config.php') {
            // Use production config instead
            const prodConfig = join(apiSrc, 'config.production.php');
            if (existsSync(prodConfig)) {
                cpSync(prodConfig, join(apiDst, 'config.php'));
                console.log('🔐 Copied config.production.php → api/config.php');
            } else {
                cpSync(srcPath, join(apiDst, file));
                console.log('⚠️  config.production.php not found, using dev config.php');
            }
        } else if (file === 'config.production.php') {
            // Skip — already handled
        } else {
            cpSync(srcPath, join(apiDst, file));
        }
    }
});
console.log('📦 Copied PHP API files → host-build/api/');

// ── Step 5: Copy uploads directory (empty placeholder) ──
const uploadsDst = join(OUT, 'uploads');
mkdirSync(uploadsDst, { recursive: true });
writeFileSync(join(uploadsDst, '.gitkeep'), '');
console.log('📁 Created host-build/uploads/');

// ── Step 6: Copy database migrations ──
const dbSrc = join(ROOT, 'database');
if (existsSync(dbSrc)) {
    const dbDst = join(OUT, 'database');
    cpSync(dbSrc, dbDst, { recursive: true });
    console.log('📦 Copied database/ → host-build/database/');
}

// ── Step 7: Copy logoapp.png ──
const logoSrc = join(ROOT, 'logoapp.png');
if (existsSync(logoSrc)) {
    cpSync(logoSrc, join(OUT, 'logoapp.png'));
    console.log('🖼️  Copied logoapp.png');
}

// ── Step 8: Copy & patch PWA manifest ──
const manifestSrc = join(ROOT, 'public', 'manifest.json');
if (existsSync(manifestSrc)) {
    const manifest = JSON.parse(readFileSync(manifestSrc, 'utf-8'));

    // Patch start_url
    manifest.start_url = `${BASE_PATH}/`;

    // Patch icon paths
    if (manifest.icons) {
        manifest.icons = manifest.icons.map(icon => ({
            ...icon,
            src: icon.src.startsWith('/') ? `${BASE_PATH}${icon.src}` : icon.src,
        }));
    }

    writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 4));
    console.log('📝 Patched manifest.json with /HR/ paths');
}

// ── Step 9: Copy & patch Service Worker ──
const swSrc = join(ROOT, 'public', 'sw.js');
if (existsSync(swSrc)) {
    let swContent = readFileSync(swSrc, 'utf-8');

    // Patch static asset paths
    swContent = swContent.replace(
        "    '/',\n    '/index.html',",
        `    '${BASE_PATH}/',\n    '${BASE_PATH}/index.html',`
    );

    // Patch icon paths
    swContent = swContent.replace(/'\/(icons\/[^']+)'/g, `'${BASE_PATH}/$1'`);

    // Patch API path check
    swContent = swContent.replace(
        "url.pathname.startsWith('/api/')",
        `url.pathname.startsWith('${BASE_PATH}/api/')`
    );

    writeFileSync(join(OUT, 'sw.js'), swContent);
    console.log('📝 Patched sw.js with /HR/ paths');
}

// ── Step 10: Copy PWA icons ──
const iconsSrc = join(ROOT, 'public', 'icons');
const iconsDst = join(OUT, 'icons');
if (existsSync(iconsSrc)) {
    cpSync(iconsSrc, iconsDst, { recursive: true });
    console.log('📦 Copied PWA icons → host-build/icons/');
}

// Also copy the root-level icons folder
const rootIconsSrc = join(ROOT, 'icons');
if (existsSync(rootIconsSrc)) {
    const rootIconsDst = join(OUT, 'icons');
    cpSync(rootIconsSrc, rootIconsDst, { recursive: true });
}

// ── Step 11: Patch index.html for /HR/ base ──
const indexPath = join(OUT, 'index.html');
if (existsSync(indexPath)) {
    let html = readFileSync(indexPath, 'utf-8');

    // Patch manifest link
    html = html.replace('href="/manifest.json"', `href="${BASE_PATH}/manifest.json"`);

    // Patch apple touch icon
    html = html.replace('href="/icons/icon-512.png"', `href="${BASE_PATH}/icons/icon-512.png"`);

    // Patch service worker registration path
    html = html.replace("register('/sw.js')", `register('${BASE_PATH}/sw.js')`);

    // Remove phantom index.css link (file doesn't exist, all CSS is inline)
    html = html.replace(/\s*<link rel="stylesheet" href="[^"]*index\.css">\s*/g, '\n');

    // Remove importmap block (dev-only, Vite bundles everything in production)
    html = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>\s*/g, '\n');

    writeFileSync(indexPath, html);
    console.log('📝 Patched index.html references');
}

// ── Step 12: Create .htaccess ──
const htaccess = `# HR Mobile Connect — Apache SPA Routing
# Place this in /domains/prima49.com/public_html/HR/

RewriteEngine On
RewriteBase /HR/

# Don't rewrite API calls
RewriteRule ^api/ - [L]

# Don't rewrite uploads
RewriteRule ^uploads/ - [L]

# Don't rewrite database folder
RewriteRule ^database/ - [L]

# Don't rewrite real files/directories
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d

# Send everything else to index.html (SPA fallback)
RewriteRule . index.html [L]
`;

writeFileSync(join(OUT, '.htaccess'), htaccess);
console.log('📝 Created .htaccess for SPA routing');

// ── Done ──
console.log('\n✅ Host build complete!');
console.log(`📂 Output: ${OUT}`);
console.log(`\n🚀 Upload the contents of host-build/ to:`);
console.log(`   /domains/prima49.com/public_html/HR/`);
console.log(`\n🌐 Site: https://hr.prima49.com\n`);
