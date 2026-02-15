/**
 * Push Notification Service
 * Handles browser push notification permission, subscription, and API sync
 */
import { API_BASE } from './api';

const VAPID_PUBLIC_KEY = 'BCwSjv55yp7HKvPYV52l2yYpxdW-rrDWc3aCiWI5UIaBEY_qQuufaW6ye8nuM_ZeHSAQEqeh22-HHvy6T5meU7M';

/**
 * Convert URL-safe base64 to Uint8Array (required for applicationServerKey)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get current notification permission status
 */
export function getPermissionStatus(): NotificationPermission | 'unsupported' {
    if (!isPushSupported()) return 'unsupported';
    return Notification.permission;
}

/**
 * Subscribe to push notifications
 * Returns true if subscription was successful
 */
export async function subscribeToPush(employeeId: string): Promise<boolean> {
    if (!isPushSupported()) {
        console.log('Push notifications not supported');
        return false;
    }

    // Check/request permission
    let permission = Notification.permission;
    if (permission === 'default') {
        permission = await Notification.requestPermission();
    }

    if (permission !== 'granted') {
        console.log('Notification permission denied');
        return false;
    }

    try {
        // Get service worker registration
        const registration = await navigator.serviceWorker.ready;

        // Check for existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Create new subscription
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
            });
        }

        // Send subscription to server
        const subJson = subscription.toJSON();
        const response = await fetch(`${API_BASE}/push_subscriptions.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                employee_id: employeeId,
                endpoint: subJson.endpoint,
                keys: {
                    p256dh: subJson.keys?.p256dh,
                    auth: subJson.keys?.auth,
                },
            }),
        });

        if (response.ok) {
            console.log('Push subscription saved successfully');
            return true;
        } else {
            console.error('Failed to save push subscription');
            return false;
        }
    } catch (err) {
        console.error('Push subscription failed:', err);
        return false;
    }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(employeeId: string): Promise<boolean> {
    if (!isPushSupported()) return false;

    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            await subscription.unsubscribe();

            // Remove from server
            await fetch(`${API_BASE}/push_subscriptions.php?employee_id=${employeeId}`, {
                method: 'DELETE',
            });
        }

        return true;
    } catch (err) {
        console.error('Push unsubscribe failed:', err);
        return false;
    }
}
