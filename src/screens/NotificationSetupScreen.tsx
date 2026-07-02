import { useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { notificationsOutline } from 'ionicons/icons';
import type { MessageKey } from '../services/i18n';
import { SetupProgress } from '../components/SetupProgress';

export function NotificationSetupScreen({
  enableNotifications,
  complete,
  t,
}: {
  enableNotifications: () => Promise<void>;
  complete: () => void;
  t: (key: MessageKey) => string;
}) {
  const [status, setStatus] = useState<'idle' | 'busy' | 'error'>('idle');

  const enable = async () => {
    setStatus('busy');
    try {
      await enableNotifications();
      complete();
    } catch (error) {
      console.error(error);
      setStatus('error');
    }
  };

  return (
    <main className="page setup-page notification-setup-page">
      <SetupProgress current={3} t={t} />
      <div className="setup-hero-icon bell" aria-hidden="true"><IonIcon icon={notificationsOutline} /></div>
      <p className="setup-eyebrow">{t('setupStepThree')}</p>
      <h1>{t('setupNotifyTitle')}</h1>
      <p className="setup-intro">{t('setupNotifyIntro')}</p>

      <section className="card notification-benefits">
        <div><span aria-hidden="true">✓</span><p>{t('setupNotifyBenefitOne')}</p></div>
        <div><span aria-hidden="true">✓</span><p>{t('setupNotifyBenefitTwo')}</p></div>
        <div><span aria-hidden="true">✓</span><p>{t('setupNotifyBenefitThree')}</p></div>
      </section>

      <aside className="setup-help"><span aria-hidden="true">ⓘ</span><p>{t('setupNotifyHelp')}</p></aside>
      {status === 'error' ? <p className="setup-error" role="alert">{t('pushError')}</p> : null}
      <IonButton expand="block" disabled={status === 'busy'} onClick={() => { void enable(); }}>
        {status === 'busy' ? t('enablingReminders') : t('setupNotifyAction')}
      </IonButton>
      <small className="required-note">{t('setupRequiredNote')}</small>
    </main>
  );
}
