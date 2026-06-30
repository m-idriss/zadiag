import { IonButton } from '@ionic/react';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';

export function SettingsScreen({
  t,
  reset,
}: {
  t: (key: MessageKey) => string;
  reset: () => void;
}) {
  const standalone = window.matchMedia('(display-mode: standalone)').matches;

  const requestNotifications = async () => {
    if (!('Notification' in window)) return;
    await Notification.requestPermission();
  };

  return (
    <div className="content-screen settings-screen">
      <header className="screen-header"><div><small>Zadiag</small><h1>{t('settings')}</h1><p>Installation, reminders and privacy.</p></div></header>
      <section className="card install-card">
        <div className="install-icon">⇧</div>
        <div><h2>{t('installTitle')}</h2><p>{standalone ? 'Zadiag is installed on this device.' : t('installBody')}</p></div>
      </section>
      <section className="card">
        <h2>Notifications</h2>
        <p>{t('reminderHelp')}</p>
        <IonButton expand="block" disabled={!standalone} onClick={requestNotifications}>{t('enableReminders')}</IonButton>
        <small>Demo note: the production Web Push subscription is connected after Firebase deployment.</small>
      </section>
      <section className="card privacy-card">
        <h2>Privacy defaults</h2>
        <ul><li>No facial recognition</li><li>No model training</li><li>No photo upload in demo mode</li><li>Immediate deletion by default</li></ul>
      </section>
      <Disclaimer t={t} />
      <IonButton expand="block" fill="outline" color="danger" onClick={reset}>Reset demo data</IonButton>
    </div>
  );
}
