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
  const notificationStatusKey = notificationState === 'enabled'
    ? 'settingsNotificationsStatusEnabled'
    : 'settingsNotificationsStatusDisabled';

  return (
    <div className="content-screen settings-screen">
      <header className="screen-header"><div><small>Zadiag</small><h1>{t('settings')}</h1><p>{t('settingsHint')}</p></div></header>
      <section className="card settings-row">
        <div className="install-icon">⇧</div>
        <div className="settings-row-copy">
          <div className="settings-row-head">
            <h2>{t('installTitle')}</h2>
            <span className="status-pill status-detected">{t('settingsInstallStatus')}</span>
          </div>
          <p>{standalone ? t('installed') : t('installBody')}</p>
        </div>
      </section>
      {role === 'child' ? <section className="card install-card notification-card">
        <div className="install-icon notification-icon" aria-hidden="true">🔔</div>
        <div className="settings-row-copy">
          <div className="settings-row-head">
            <h2>{t('notifications')}</h2>
            <span className={notificationState === 'enabled' ? 'status-pill status-detected' : 'status-pill status-missed'}>
              {t(notificationStatusKey)}
            </span>
          </div>
          <p>{standalone ? t('pushReadyHint') : t('reminderHelp')}</p>
          {notificationState !== 'enabled' ? <IonButton
            className="settings-inline-action"
            disabled={!standalone || notificationState === 'saving'}
            onClick={() => { void requestNotifications(); }}
          >
            {notificationState === 'saving' ? t('enablingReminders') : t('enableReminders')}
          </IonButton> : null}
          {notificationState === 'error' ? <small className="notification-note">{t('pushError')}</small> : null}
        </div>
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
