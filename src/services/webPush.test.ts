import { afterEach, describe, expect, it, vi } from 'vitest';
import { isInstalledWebApp, WebPushGateway } from './webPush';

const defineNavigatorValue = (key: string, value: unknown) => {
  Object.defineProperty(window.navigator, key, {
    configurable: true,
    value,
  });
};

const mockDisplayMode = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches }),
  });
};

describe('WebPushGateway iOS resilience', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('detects a Home Screen installed web app', () => {
    mockDisplayMode(true);

    expect(isInstalledWebApp()).toBe(true);
  });

  it('blocks iOS subscriptions before the app is opened from the Home Screen', async () => {
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'BBBB');
    defineNavigatorValue('userAgent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    defineNavigatorValue('platform', 'iPhone');
    defineNavigatorValue('maxTouchPoints', 5);
    mockDisplayMode(false);
    Object.defineProperty(window, 'PushManager', { configurable: true, value: class PushManager {} });
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'granted', requestPermission: vi.fn() },
    });
    defineNavigatorValue('serviceWorker', { ready: Promise.resolve({}) });

    await expect(new WebPushGateway().permission()).rejects.toMatchObject({
      code: 'push_not_installed',
    });
    expect(Notification.requestPermission).not.toHaveBeenCalled();
    await expect(new WebPushGateway().subscribe()).rejects.toMatchObject({
      code: 'push_not_installed',
    });
  });

  it('reports permission reset before attempting a stale subscription', async () => {
    vi.stubEnv('VITE_WEB_PUSH_PUBLIC_KEY', 'BBBB');
    defineNavigatorValue('userAgent', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)');
    defineNavigatorValue('platform', 'MacIntel');
    defineNavigatorValue('maxTouchPoints', 0);
    mockDisplayMode(true);
    Object.defineProperty(window, 'PushManager', { configurable: true, value: class PushManager {} });
    Object.defineProperty(window, 'Notification', {
      configurable: true,
      value: { permission: 'default', requestPermission: vi.fn() },
    });
    defineNavigatorValue('serviceWorker', {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: vi.fn(),
          subscribe: vi.fn(),
        },
      }),
    });

    await expect(new WebPushGateway().subscribe()).rejects.toMatchObject({
      code: 'notification_permission_reset',
    });
  });
});
