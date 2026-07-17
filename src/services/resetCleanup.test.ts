import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanupClientAfterReset, resetCleanupInternals } from './resetCleanup';

const originalServiceWorker = navigator.serviceWorker;
const originalClearAppBadge = navigator.clearAppBadge;

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: originalServiceWorker,
  });
  Object.defineProperty(navigator, 'clearAppBadge', {
    configurable: true,
    value: originalClearAppBadge,
  });
  localStorage.clear();
  sessionStorage.clear();
});

describe('reset cleanup', () => {
  it('matches only notification tags owned by checks and reminders', () => {
    expect(resetCleanupInternals.shouldCloseResetNotification('verification')).toBe(true);
    expect(resetCleanupInternals.shouldCloseResetNotification('verification:session-1')).toBe(true);
    expect(resetCleanupInternals.shouldCloseResetNotification('reminder:session-1')).toBe(true);
    expect(resetCleanupInternals.shouldCloseResetNotification('calendar:session-1')).toBe(false);
  });

  it('removes transient local and session state without touching persisted app data', async () => {
    localStorage.setItem('zadiag.transient.selectedSession', 'session-1');
    localStorage.setItem('zadiag.journey.family.app_ready.2026-07-17', '1');
    localStorage.setItem('zadiag.demo.v1', '{"role":"child"}');
    sessionStorage.setItem('zadiag.notification.lastRoute', '/?open=verification');
    sessionStorage.setItem('unrelated', 'keep');

    await cleanupClientAfterReset();

    expect(localStorage.getItem('zadiag.transient.selectedSession')).toBeNull();
    expect(localStorage.getItem('zadiag.journey.family.app_ready.2026-07-17')).toBeNull();
    expect(localStorage.getItem('zadiag.demo.v1')).toBe('{"role":"child"}');
    expect(sessionStorage.getItem('zadiag.notification.lastRoute')).toBeNull();
    expect(sessionStorage.getItem('unrelated')).toBe('keep');
  });

  it('clears the app badge and closes stale service worker notifications', async () => {
    const closeVerification = vi.fn();
    const closeReminder = vi.fn();
    const closeOther = vi.fn();
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    const getNotifications = vi.fn().mockResolvedValue([
      { tag: 'verification:session-1', close: closeVerification },
      { tag: 'reminder:session-2', close: closeReminder },
      { tag: 'calendar:event-1', close: closeOther },
    ]);
    const getRegistration = vi.fn().mockResolvedValue({ getNotifications });
    Object.defineProperty(navigator, 'clearAppBadge', {
      configurable: true,
      value: clearAppBadge,
    });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { getRegistration },
    });

    await cleanupClientAfterReset();

    expect(clearAppBadge).toHaveBeenCalledTimes(1);
    expect(getRegistration).toHaveBeenCalledTimes(1);
    expect(getNotifications).toHaveBeenCalledTimes(1);
    expect(closeVerification).toHaveBeenCalledTimes(1);
    expect(closeReminder).toHaveBeenCalledTimes(1);
    expect(closeOther).not.toHaveBeenCalled();
  });
});
