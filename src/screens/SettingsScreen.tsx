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

  const switchUser = () => {
    const otherOrigin = window.location.hostname === 'zadiag.vercel.app'
      ? 'https://www.zadiag.com'
      : 'https://zadiag.vercel.app';
    window.location.assign(otherOrigin);
  };

  const confirmReset = () => {
    if (window.confirm(t('resetConfirm'))) reset();
  };

  return (
    <div className="content-screen settings-screen">
      <header className="screen-header"><div><small>Zadiag</small><h1>{t('settings')}</h1><p>{t('settingsHint')}</p></div></header>
      <section className="card install-card">
        <div className="install-icon">⇧</div>
        <div><h2>{t('installTitle')}</h2><p>{standalone ? t('installed') : t('installBody')}</p></div>
      </section>
      <section className="card">
        <h2>{t('notifications')}</h2>
        <p>{t('reminderHelp')}</p>
        <IonButton expand="block" disabled={!standalone} onClick={requestNotifications}>{t('enableReminders')}</IonButton>
        <small>{t('pushDemoHint')}</small>
      </section>
      <section className="card privacy-card">
        <h2>{t('privacyDefaults')}</h2>
        <ul><li>{t('noFaceRecognition')}</li><li>{t('noModelTraining')}</li><li>{t('noPhotoUpload')}</li><li>{t('immediateDeletion')}</li></ul>
      </section>
      <section className="card">
        <h2>{t('switchUser')}</h2>
        <p>{t('switchUserHint')}</p>
        <IonButton expand="block" fill="outline" onClick={switchUser}>{t('switchUser')}</IonButton>
      </section>
      <Disclaimer t={t} />
      <IonButton expand="block" fill="outline" color="danger" onClick={confirmReset}>{t('resetDemo')}</IonButton>
    </div>
  );
}
