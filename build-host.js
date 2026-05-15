/**
 * HR Mobile Connect — Host Build Script
 * Bundles frontend (Vite dist) + backend (PHP) + PWA assets into a single folder
 * for deployment to /domains/prima49.com/public_html/HR/
 *
 * Since hr.prima49.com points directly to /public_html/HR/,
 * all paths are ROOT-relative (no /HR/ prefix needed).
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
    const isFile = statSync(srcPath).isFile();
    if (isFile) {
        // Skip dev-only debug helpers (they expose internals)
        if (file.startsWith('_')) {
            return;
        }
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
    } else {
        // Recursively copy subdirectories under api/ (e.g. api/lib/ for mPDF).
        // Skip composer dev artifacts that bloat the upload.
        cpSync(srcPath, join(apiDst, file), {
            recursive: true,
            filter: (src) => {
                const norm = src.replace(/\\/g, '/');
                if (norm.endsWith('/composer.json')) return false;
                if (norm.endsWith('/composer.lock')) return false;
                if (norm.endsWith('/.gitignore')) return false;
                if (norm.endsWith('/README.md')) return false;
                return true;
            },
        });
        console.log(`📦 Copied api/${file}/ recursively`);
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

// ── Step 8: Copy PWA manifest (no path patching needed) ──
const manifestSrc = join(ROOT, 'public', 'manifest.json');
if (existsSync(manifestSrc)) {
    cpSync(manifestSrc, join(OUT, 'manifest.json'));
    console.log('📝 Copied manifest.json');
}

// ── Step 9: Copy Service Worker (no path patching needed) ──
const swSrc = join(ROOT, 'public', 'sw.js');
if (existsSync(swSrc)) {
    cpSync(swSrc, join(OUT, 'sw.js'));
    console.log('📝 Copied sw.js');
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

// ── Step 10.5: Copy face-api.js models ──
const modelsSrc = join(ROOT, 'public', 'models');
const modelsDst = join(OUT, 'models');
if (existsSync(modelsSrc)) {
    cpSync(modelsSrc, modelsDst, { recursive: true });
    const modelFiles = readdirSync(modelsDst);
    console.log(`🤖 Copied ${modelFiles.length} face-api model files → host-build/models/`);
}

// ── Step 11: Clean index.html (remove dev-only artifacts) ──
const indexPath = join(OUT, 'index.html');
if (existsSync(indexPath)) {
    let html = readFileSync(indexPath, 'utf-8');

    // Remove phantom index.css link (file doesn't exist, all CSS is inline)
    html = html.replace(/\s*<link rel="stylesheet" href="[^"]*index\.css">\s*/g, '\n');

    // Remove importmap block (dev-only, Vite bundles everything in production)
    html = html.replace(/\s*<script type="importmap">[\s\S]*?<\/script>\s*/g, '\n');

    writeFileSync(indexPath, html);
    console.log('📝 Cleaned index.html (removed dev-only artifacts)');
}

// ── Step 12: Create .htaccess ──
const htaccess = `# HR Mobile Connect — Apache SPA Routing
# Deployed at hr.prima49.com (subdomain points to /public_html/HR/)

# Allow Geolocation API (fixes "Permissions policy violation" error)
<IfModule mod_headers.c>
    Header always set Permissions-Policy "geolocation=(self)"
</IfModule>

RewriteEngine On
RewriteBase /

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
