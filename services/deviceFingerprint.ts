/**
 * Device Fingerprint Generator
 * Creates a stable, unique identifier for this device/browser combination.
 * Uses browser characteristics + canvas fingerprint + SubtleCrypto hash.
 * No external libraries required.
 */

const STORAGE_KEY = 'hr_device_fp';

async function generateRawFingerprint(): Promise<string> {
    const components: string[] = [];

    // Screen properties
    components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    components.push(`${window.devicePixelRatio}`);

    // Timezone
    components.push(Intl.DateTimeFormat().resolvedOptions().timeZone);

    // Language
    components.push(navigator.language);

    // Platform
    components.push(navigator.platform);

    // Hardware concurrency
    components.push(String(navigator.hardwareConcurrency || 'unknown'));

    // Max touch points (distinguishes mobile from desktop)
    components.push(String(navigator.maxTouchPoints || 0));

    // Canvas fingerprint (slightly unique per device/GPU)
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(100, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('HRConnect🔒', 2, 15);
            ctx.fillStyle = 'rgba(102,204,0,0.7)';
            ctx.fillText('SecurityFP', 4, 17);
            components.push(canvas.toDataURL());
        }
    } catch {
        components.push('canvas-unavailable');
    }

    // WebGL renderer
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
        if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                components.push(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown');
            }
        }
    } catch {
        components.push('webgl-unavailable');
    }

    return components.join('|||');
}

async function hashFingerprint(raw: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Get or generate the device fingerprint.
 * Returns a stable SHA-256 hash string.
 */
export async function getDeviceFingerprint(): Promise<string> {
    // Check if we already have one stored
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.length === 64) {
        return stored;
    }

    // Generate new fingerprint
    const raw = await generateRawFingerprint();
    const hash = await hashFingerprint(raw);

    // Store for consistency
    localStorage.setItem(STORAGE_KEY, hash);

    return hash;
}

/**
 * Clear stored fingerprint (for testing/reset purposes)
 */
export function clearDeviceFingerprint(): void {
    localStorage.removeItem(STORAGE_KEY);
}
