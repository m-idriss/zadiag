import type { PushGateway } from './contracts';

function decodeVapidKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export class WebPushGateway implements PushGateway {
  async permission() {
    if (!('Notification' in window)) return 'denied';
    return Notification.requestPermission();
  }

  async subscribe() {
    const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
    if (!publicKey) throw new Error('missing_web_push_public_key');
    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing) return existing;
    return registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(publicKey),
    });
  }
}
