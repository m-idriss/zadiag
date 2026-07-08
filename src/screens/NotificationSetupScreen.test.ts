import { describe, expect, it } from 'vitest';
import { PushSetupError } from '../services/webPush';
import { notificationSetupErrorMessageKey } from './NotificationSetupScreen';

describe('notification setup errors', () => {
  it('maps iOS setup failures to actionable copy', () => {
    expect(notificationSetupErrorMessageKey(new PushSetupError('push_not_installed'))).toBe('pushErrorNotInstalled');
    expect(notificationSetupErrorMessageKey(new PushSetupError('notification_permission_denied'))).toBe('pushErrorPermissionDenied');
    expect(notificationSetupErrorMessageKey(new PushSetupError('notification_permission_reset'))).toBe('pushErrorPermissionReset');
    expect(notificationSetupErrorMessageKey(new PushSetupError('push_subscription_invalidated'))).toBe('pushErrorSubscriptionInvalidated');
  });

  it('falls back to the generic message for unknown setup failures', () => {
    expect(notificationSetupErrorMessageKey(new Error('unexpected'))).toBe('pushError');
  });
});
