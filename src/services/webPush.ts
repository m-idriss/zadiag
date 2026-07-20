import type { PushGateway } from './contracts';

type PushSetupErrorCode =
  | 'missing_web_push_public_key'
  | 'notification_permission_denied'
  | 'notification_permission_reset'
  | 'push_not_installed'
  | 'push_subscription_invalidated'
  | 'push_unsupported';

export class PushSetupError extends Error {
  constructor(public readonly code: PushSetupErrorCode, cause?: unknown) {
    super(code);
    this.name = 'PushSetupError';
    this.cause = cause;
  }
}

function decodeVapidKey(value: string) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

const isIosDevice = () => {
  const navigatorLike = window.navigator as Navigator & { standalone?: boolean };
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    || navigatorLike.standalone === true;
};

export const isInstalledWebApp = () => {
  const navigatorLike = window.navigator as Navigator & { standalone?: boolean };
  return navigatorLike.standalone === true
    || window.matchMedia?.('(display-mode: standalone)').matches === true
    || window.matchMedia?.('(display-mode: fullscreen)').matches === true;
};

const normalizeSubscribeError = (error: unknown): PushSetupError => {
  if (error instanceof PushSetupError) return error;
  const name = String((error as { name?: unknown })?.name ?? '');
  if (name === 'NotAllowedError') return new PushSetupError('notification_permission_denied', error);
  if (name === 'InvalidStateError' || name === 'AbortError') return new PushSetupError('push_subscription_invalidated', error);
  return new PushSetupError('push_unsupported', error);
};

export class WebPushGateway implements PushGateway {
  async permission() {
    if (isIosDevice() && !isInstalledWebApp()) throw new PushSetupError('push_not_installed');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new PushSetupError('push_unsupported');
    }
    if (!('Notification' in window)) throw new PushSetupError('push_unsupported');
    return Notification.requestPermission();
  }

  async subscribe(options: { forceRenewal?: boolean } = {}) {
    const publicKey = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY;
    if (!publicKey) throw new PushSetupError('missing_web_push_public_key');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new PushSetupError('push_unsupported');
    }
    if (isIosDevice() && !isInstalledWebApp()) throw new PushSetupError('push_not_installed');
    if (!('Notification' in window)) throw new PushSetupError('push_unsupported');
    if (Notification.permission === 'denied') throw new PushSetupError('notification_permission_denied');
    if (Notification.permission !== 'granted') throw new PushSetupError('notification_permission_reset');

    const registration = await navigator.serviceWorker.ready;
    const existing = await registration.pushManager.getSubscription();
    if (existing && !options.forceRenewal) return existing;
    if (existing) await existing.unsubscribe().catch(() => undefined);
    const subscribe = () => registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeVapidKey(publicKey),
    });
    try {
      return await subscribe();
    } catch (error) {
      const current = await registration.pushManager.getSubscription();
      if (current) {
        await current.unsubscribe().catch(() => undefined);
        try {
          return await subscribe();
        } catch (retryError) {
          throw normalizeSubscribeError(retryError);
        }
      }
      throw normalizeSubscribeError(error);
    }
  }
}
