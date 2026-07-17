import { useState } from 'react';
import { notificationsOutline } from 'ionicons/icons';
import type { MessageKey } from '../services/i18n';
import { SetupProgress } from '../components/SetupProgress';
import { SvgIcon } from '../components/SvgIcon';
import { ActionButton } from '../components/ui';
import { AppIcon } from '../components/Icon';
import { notificationSetupErrorMessageKey } from '../services/notificationRecovery';
import { NotificationRecoveryGuide } from '../components/NotificationRecoveryGuide';

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
        <div><span aria-hidden="true"><AppIcon name="check" /></span><p>{t('setupNotifyBenefitOne')}</p></div>
        <div><span aria-hidden="true"><AppIcon name="check" /></span><p>{t('setupNotifyBenefitTwo')}</p></div>
        <div><span aria-hidden="true"><AppIcon name="check" /></span><p>{t('setupNotifyBenefitThree')}</p></div>
      </section>

      <aside className="setup-help"><span aria-hidden="true"><AppIcon name="info" /></span><p>{t('setupNotifyHelp')}</p></aside>
      {errorKey ? <NotificationRecoveryGuide errorKey={errorKey} t={t} /> : null}
      <ActionButton disabled={status === 'busy'} aria-busy={status === 'busy'} onClick={() => { void enable(); }}>
        {status === 'busy' ? <span className="button-spinner" aria-hidden="true" /> : null}
        {status === 'busy' ? t('enablingReminders') : t('setupNotifyAction')}
      </ActionButton>
      <small className="required-note">{t('setupRequiredNote')}</small>
    </main>
  );
}
