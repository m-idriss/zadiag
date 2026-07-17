import type { MessageKey } from '../services/i18n';
import { notificationRecoveryKind } from '../services/notificationRecovery';
import { AppIcon } from './Icon';

export function NotificationRecoveryGuide({ errorKey, t }: { errorKey: MessageKey; t: (key: MessageKey) => string }) {
  const kind = notificationRecoveryKind(errorKey);
  const steps: MessageKey[] = kind === 'install'
    ? ['notificationRecoveryInstallOne', 'notificationRecoveryInstallTwo', 'notificationRecoveryInstallThree']
    : kind === 'permission'
      ? ['notificationRecoveryPermissionOne', 'notificationRecoveryPermissionTwo', 'notificationRecoveryRetry']
      : kind === 'retry'
        ? ['notificationRecoveryRetryOne', 'notificationRecoveryRetry']
        : ['notificationRecoveryConnectionOne', 'notificationRecoveryRetry'];
  return (
    <aside className="notification-recovery-guide" role="alert">
      <AppIcon name="info" />
      <div><strong>{t('notificationRecoveryTitle')}</strong><p>{t(errorKey)}</p><ol>{steps.map((step) => <li key={step}>{t(step)}</li>)}</ol></div>
    </aside>
  );
}
