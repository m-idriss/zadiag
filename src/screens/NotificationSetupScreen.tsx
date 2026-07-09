import { useState } from 'react';
import { notificationsOutline } from 'ionicons/icons';
import type { MessageKey } from '../services/i18n';
import { SetupProgress } from '../components/SetupProgress';
import { PushSetupError } from '../services/webPush';
import { SvgIcon } from '../components/SvgIcon';
import { ActionButton } from '../components/ui';

export const notificationSetupErrorMessageKey = (error: unknown): MessageKey => {
  const code = error instanceof PushSetupError
    ? error.code
    : String((error as { code?: unknown; message?: unknown })?.code ?? (error as { message?: unknown })?.message ?? '');
  switch (code) {
    case 'push_not_installed':
      return 'pushErrorNotInstalled';
    case 'notification_permission_denied':
      return 'pushErrorPermissionDenied';
    case 'notification_permission_reset':
      return 'pushErrorPermissionReset';
    case 'push_subscription_invalidated':
      return 'pushErrorSubscriptionInvalidated';
    case 'missing_web_push_public_key':
    case 'push_unsupported':
      return 'pushErrorUnsupported';
    default:
      return 'pushError';
  }
};

export function NotificationSetupScreen({
  enableNotifications,
  complete,
  t,
}: {
  enableNotifications: () => Promise<void>;
  complete: () => void;
  t: (key: MessageKey) => string;
}) {
  const [status, setStatus] = useState<'idle' | 'busy'>('idle');
  const [errorKey, setErrorKey] = useState<MessageKey>();

  const enable = async () => {
    setStatus('busy');
    setErrorKey(undefined);
    try {
      await enableNotifications();
      complete();
    } catch (error) {
      console.error(error);
      setErrorKey(notificationSetupErrorMessageKey(error));
    } finally {
      setStatus('idle');
    }
  };

  return (
    <main className="page setup-page notification-setup-page">
      <SetupProgress current={3} t={t} />
      <div className="setup-hero-icon bell" aria-hidden="true"><SvgIcon icon={notificationsOutline} /></div>
      <p className="setup-eyebrow">{t('setupStepThree')}</p>
      <h1>{t('setupNotifyTitle')}</h1>
      <p className="setup-intro">{t('setupNotifyIntro')}</p>

      <section className="card notification-benefits">
        <div><span aria-hidden="true">✓</span><p>{t('setupNotifyBenefitOne')}</p></div>
        <div><span aria-hidden="true">✓</span><p>{t('setupNotifyBenefitTwo')}</p></div>
        <div><span aria-hidden="true">✓</span><p>{t('setupNotifyBenefitThree')}</p></div>
      </section>

      <aside className="setup-help"><span aria-hidden="true">ⓘ</span><p>{t('setupNotifyHelp')}</p></aside>
      {errorKey ? <p className="setup-error" role="alert">{t(errorKey)}</p> : null}
      <ActionButton disabled={status === 'busy'} onClick={() => { void enable(); }}>
        {status === 'busy' ? t('enablingReminders') : t('setupNotifyAction')}
      </ActionButton>
      <small className="required-note">{t('setupRequiredNote')}</small>
    </main>
  );
}
