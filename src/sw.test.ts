import { describe, expect, it, vi } from 'vitest';
import { clearBadgeAndCheckNotifications, notificationClickPath, notificationOptionsForPayload, openNotificationClient } from './services/serviceWorkerNotifications';

describe('service worker notification helpers', () => {
  it('builds notification options from the push payload', () => {
    expect(notificationOptionsForPayload({
      version: 2,
      kind: 'check-ready',
      participantId: 'participant-1',
      sessionId: 'session-1',
      routineId: 'routine-1',
      body: 'Send proof.',
      tag: 'verification:session-1',
      path: '/?open=verification&session=session-1',
    })).toMatchObject({
      body: 'Send proof.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'verification:session-1',
      data: {
        kind: 'check-ready',
        participantId: 'participant-1',
        routineId: 'routine-1',
        sessionId: 'session-1',
        version: 2,
        path: '/?open=verification&session=session-1',
      },
    });
  });

  it('falls back to the verification route when click data is missing', () => {
    expect(notificationClickPath({ data: { path: '/settings' } })).toBe('/settings');
    expect(notificationClickPath({ data: undefined })).toBe('/');
  });

  it('focuses an existing app window and forwards the notification without reloading', async () => {
    const focus = vi.fn().mockResolvedValue(undefined);
    const postMessage = vi.fn();
    const openWindow = vi.fn();
    await openNotificationClient({ data: { path: '/?open=review&participant=alex&event=check-1' } }, {
      matchAll: vi.fn().mockResolvedValue([{ focused: false, visibilityState: 'visible', focus, postMessage }]),
      openWindow,
    });
    expect(postMessage).toHaveBeenCalledWith({ type: 'OPEN_NOTIFICATION', path: '/?open=review&participant=alex&event=check-1' });
    expect(focus).toHaveBeenCalledOnce();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('opens a new app window only when no instance exists', async () => {
    const openWindow = vi.fn().mockResolvedValue(null);
    await openNotificationClient({ data: { path: '/?open=verification&session=session-1' } }, {
      matchAll: vi.fn().mockResolvedValue([]),
      openWindow,
    });
    expect(openWindow).toHaveBeenCalledWith('/?open=verification&session=session-1');
  });

  it('clears app badge and closes check notification tags', async () => {
    const closeVerification = vi.fn();
    const closeReminder = vi.fn();
    const closeOther = vi.fn();
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    const getNotifications = vi.fn().mockResolvedValue([
      { tag: 'verification:session-1', close: closeVerification },
      { tag: 'reminder:session-2', close: closeReminder },
      { tag: 'calendar:session-3', close: closeOther },
    ]);

    await clearBadgeAndCheckNotifications({ getNotifications }, { clearAppBadge });

    expect(clearAppBadge).toHaveBeenCalledTimes(1);
    expect(closeVerification).toHaveBeenCalledTimes(1);
    expect(closeReminder).toHaveBeenCalledTimes(1);
    expect(closeOther).not.toHaveBeenCalled();
  });
});
