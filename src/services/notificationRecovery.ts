import type { MessageKey } from './i18n';
import { PushSetupError } from './webPush';

export type NotificationRecoveryKind = 'install' | 'permission' | 'retry' | 'connection';

export const notificationSetupErrorMessageKey = (error: unknown): MessageKey => {
  const code = error instanceof PushSetupError
    ? error.code
    : String((error as { code?: unknown; message?: unknown })?.code ?? (error as { message?: unknown })?.message ?? '');
  switch (code) {
    case 'push_not_installed': return 'pushErrorNotInstalled';
    case 'notification_permission_denied': return 'pushErrorPermissionDenied';
    case 'notification_permission_reset': return 'pushErrorPermissionReset';
    case 'push_subscription_invalidated': return 'pushErrorSubscriptionInvalidated';
    case 'missing_web_push_public_key':
    case 'push_unsupported': return 'pushErrorUnsupported';
    default: return 'pushError';
  }
};

export const notificationRecoveryKind = (errorKey: MessageKey): NotificationRecoveryKind => {
  if (errorKey === 'pushErrorNotInstalled' || errorKey === 'pushErrorUnsupported') return 'install';
  if (errorKey === 'pushErrorPermissionDenied') return 'permission';
  if (errorKey === 'pushErrorPermissionReset' || errorKey === 'pushErrorSubscriptionInvalidated' || errorKey === 'pushErrorDeliveryUnconfirmed') return 'retry';
  return 'connection';
};
