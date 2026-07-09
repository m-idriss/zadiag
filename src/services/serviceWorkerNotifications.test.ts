import { describe, expect, it, vi } from 'vitest';
import { clearBadgeAndCheckNotifications, isCheckNotificationTag } from './serviceWorkerNotifications';

describe('service worker notification helpers', () => {
  it('matches only check and reminder notification tags', () => {
    expect(isCheckNotificationTag('verification')).toBe(true);
    expect(isCheckNotificationTag('verification:session-1')).toBe(true);
    expect(isCheckNotificationTag('reminder:session-1')).toBe(true);
    expect(isCheckNotificationTag('calendar:session-1')).toBe(false);
    expect(isCheckNotificationTag()).toBe(false);
  });

  it('clears badges and closes only check notifications', async () => {
    const closeVerification = vi.fn();
    const closeReminder = vi.fn();
    const closeOther = vi.fn();
    const clearAppBadge = vi.fn().mockResolvedValue(undefined);
    const registration = {
      getNotifications: vi.fn().mockResolvedValue([
        { tag: 'verification:session-1', close: closeVerification },
        { tag: 'reminder:session-2', close: closeReminder },
        { tag: 'calendar:event-1', close: closeOther },
      ]),
    };

    await clearBadgeAndCheckNotifications(registration, { clearAppBadge });

    expect(clearAppBadge).toHaveBeenCalledTimes(1);
    expect(registration.getNotifications).toHaveBeenCalledTimes(1);
    expect(closeVerification).toHaveBeenCalledTimes(1);
    expect(closeReminder).toHaveBeenCalledTimes(1);
    expect(closeOther).not.toHaveBeenCalled();
  });
});
