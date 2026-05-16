import * as faceapi from '@vladmandic/face-api';

let preloadPromise: Promise<void> | null = null;
let isPreloaded = false;
let usingCpuFallback = false;

const MODEL_URL = '/models';

const loadAllNets = () => Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
]);

/**
 * Preload the face-api models in the background.
 * Safe to call concurrently — all callers await the same Promise.
 *
 * If the first attempt fails (often a WebGL init crash on older phones),
 * we switch the TFJS backend to 'cpu' and retry once. CPU is slower but
 * runs anywhere — better than blocking clock-in entirely.
 */
export const preloadFaceModels = (): Promise<void> => {
    if (isPreloaded) return Promise.resolve();
    if (preloadPromise) return preloadPromise;

    console.log('[Face API] Background model preloading started...');

    preloadPromise = loadAllNets()
        .then(() => {
            isPreloaded = true;
            console.log('[Face API] Background model preloading complete!');
        })
        .catch(async (err) => {
            console.error('[Face API] Initial load failed:', err);
            // Best-effort fallback: switch to CPU backend, then retry once.
            const tf = (faceapi as any).tf;
            if (tf && !usingCpuFallback) {
                try {
                    usingCpuFallback = true;
                    console.warn('[Face API] Switching TFJS backend to CPU and retrying...');
                    await tf.setBackend('cpu');
                    await tf.ready();
                    await loadAllNets();
                    isPreloaded = true;
                    console.log('[Face API] Models loaded successfully on CPU backend.');
                    return;
                } catch (cpuErr) {
                    console.error('[Face API] CPU fallback also failed:', cpuErr);
                }
            }
            preloadPromise = null;
            throw err;
        });

    return preloadPromise;
};

/**
 * Check if models are already preloaded
 */
export const areFaceModelsPreloaded = (): boolean => {
    return isPreloaded;
};

/**
 * Hard reset: dispose loaded weights, clear in-memory promise/flag, and
 * purge any service-worker-cached /models/* responses.
 *
 * Used by the "ลองใหม่" button on the FaceCapture error screen — covers
 * the case where a stale or corrupted cached model file is the cause.
 */
export const resetFaceModels = async () => {
    isPreloaded = false;
    preloadPromise = null;
    usingCpuFallback = false;
    try {
        faceapi.nets.tinyFaceDetector.dispose();
        faceapi.nets.faceLandmark68Net.dispose();
        faceapi.nets.faceRecognitionNet.dispose();
    } catch { /* ignore — dispose may throw if already disposed */ }
    try {
        if (typeof caches !== 'undefined') {
            const cacheNames = await caches.keys();
            for (const name of cacheNames) {
                const cache = await caches.open(name);
                const reqs = await cache.keys();
                for (const req of reqs) {
                    if (req.url.includes('/models/')) await cache.delete(req);
                }
            }
        }
    } catch { /* best-effort */ }
};
