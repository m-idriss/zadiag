import { useState } from 'react';
import { IonButton } from '@ionic/react';
import type { Role } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';

export function SettingsScreen({
  t,
  reset,
  role,
  enableNotifications,
  notificationsEnabled,
}: {
  t: (key: MessageKey) => string;
  reset: () => void;
  role: Role;
  enableNotifications: () => Promise<void>;
  notificationsEnabled: boolean;
}) {
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const [notificationState, setNotificationState] = useState<'idle' | 'saving' | 'enabled' | 'error'>(
    notificationsEnabled ? 'enabled' : 'idle',
  );

  const requestNotifications = async () => {
    setNotificationState('saving');
    try {
      await enableNotifications();
      setNotificationState('enabled');
    } catch (error) {
      console.error(error);
      setNotificationState('error');
    }
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
      {role === 'child' ? <section className="card">
        <h2>{t('notifications')}</h2>
        <p>{t('reminderHelp')}</p>
        <IonButton
          expand="block"
          disabled={!standalone || notificationState === 'saving' || notificationState === 'enabled'}
          onClick={() => { void requestNotifications(); }}
        >
          {notificationState === 'saving'
            ? t('enablingReminders')
            : notificationState === 'enabled'
              ? t('remindersEnabled')
              : t('enableReminders')}
        </IonButton>
        <small>{notificationState === 'error' ? t('pushError') : t('pushReadyHint')}</small>
      </section> : null}
      <section className="card privacy-card">
        <h2>{t('privacyDefaults')}</h2>
        <ul><li>{t('noFaceRecognition')}</li><li>{t('noModelTraining')}</li><li>{t('noPhotoUpload')}</li><li>{t('immediateDeletion')}</li></ul>
      </section>
      <Disclaimer t={t} />
      <IonButton expand="block" fill="outline" color="danger" onClick={confirmReset}>{t('resetDemo')}</IonButton>
    </div>
  );
}
