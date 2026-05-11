import * as faceapi from '@vladmandic/face-api';

let preloadPromise: Promise<void> | null = null;
let isPreloaded = false;

/**
 * Preload the face-api models in the background.
 * Safe to call concurrently — all callers await the same Promise.
 */
export const preloadFaceModels = (): Promise<void> => {
    if (isPreloaded) return Promise.resolve();
    if (preloadPromise) return preloadPromise;

    const MODEL_URL = '/models';
    console.log('[Face API] Background model preloading started...');

    preloadPromise = Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ])
        .then(() => {
            isPreloaded = true;
            console.log('[Face API] Background model preloading complete!');
        })
        .catch((err) => {
            console.error('[Face API] Failed to preload models:', err);
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
