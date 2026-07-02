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
  childLinkingCode,
  regenerateLinkCode,
}: {
  t: (key: MessageKey) => string;
  reset: () => void;
  role: Role;
  enableNotifications: () => Promise<void>;
  notificationsEnabled: boolean;
  childLinkingCode?: string;
  regenerateLinkCode: () => Promise<void>;
}) {
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const [notificationState, setNotificationState] = useState<'idle' | 'saving' | 'enabled' | 'error'>(
    notificationsEnabled ? 'enabled' : 'idle',
  );
  const [regenerating, setRegenerating] = useState(false);
  const [codeError, setCodeError] = useState(false);

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
  const regenerate = async () => {
    if (!window.confirm(t('regenerateCodeConfirm'))) return;
    setCodeError(false);
    setRegenerating(true);
    try {
      await regenerateLinkCode();
    } catch {
      setCodeError(true);
    } finally {
      setRegenerating(false);
    }
  };

  const confirmReset = () => {
    if (window.confirm(t('resetConfirm'))) reset();
  };
  const notificationEnabled = notificationState === 'enabled';
  const notificationStatusKey = notificationState === 'enabled'
    ? 'settingsNotificationsStatusEnabled'
    : 'settingsNotificationsStatusDisabled';
  const notificationDetailKey = notificationState === 'enabled'
    ? 'settingsNotificationsDetailEnabled'
    : 'settingsNotificationsDetailDisabled';

  return (
    <div className="content-screen settings-screen">
      <header className="screen-header"><div><small>Zadiag</small><h1>{t('settings')}</h1><p>{t('settingsHint')}</p></div></header>
      <section className="card history-row settings-history-row">
        <div className="history-icon settings-history-icon">⇧</div>
        <div>
          <strong>{t('installTitle')}</strong>
          <small>{t('settingsInstallDetail')}</small>
        </div>
        <span className="status-pill status-detected">{t('settingsInstallStatus')}</span>
      </section>
      {role === 'child' ? <section className="card history-row settings-history-row">
        <div className="history-icon settings-history-icon" aria-hidden="true">🔔</div>
        <div>
          <strong>{t('notifications')}</strong>
          <small>{t(notificationDetailKey)}</small>
        </div>
        <span className={notificationEnabled ? 'status-pill status-detected' : 'status-pill status-missed'}>
          {t(notificationStatusKey)}
        </span>
      </section> : null}
      {role === 'child' && !notificationEnabled ? <IonButton
        className="settings-inline-action"
        size="small"
        disabled={!standalone || notificationState === 'saving'}
        onClick={() => { void requestNotifications(); }}
      >
        {notificationState === 'saving' ? t('enablingReminders') : t('enableReminders')}
      </IonButton> : null}
      {role === 'child' && notificationState === 'error' ? <small className="notification-note">{t('pushError')}</small> : null}
      {role === 'parent' && childLinkingCode ? (
        <section className="card code-box settings-link-code-card">
          <small>{t('childLinkCode')}</small>
          <strong>{childLinkingCode}</strong>
          <span>{t('childLinkCodeHint')}</span>
          <button className="regenerate-code" disabled={regenerating} onClick={() => { void regenerate(); }}>
            {regenerating ? t('regeneratingCode') : t('regenerateCode')}
          </button>
          {codeError ? <span className="form-error">{t('regenerateCodeError')}</span> : null}
        </section>
      ) : null}
      <section className="card privacy-card">
        <h2>{t('privacyDefaults')}</h2>
        <ul><li>{t('noFaceRecognition')}</li><li>{t('noModelTraining')}</li><li>{t('noPhotoUpload')}</li><li>{t('immediateDeletion')}</li></ul>
      </section>
      <Disclaimer t={t} />
      <IonButton expand="block" fill="outline" color="danger" onClick={confirmReset}>{t('resetDemo')}</IonButton>
    </div>
  );
}
