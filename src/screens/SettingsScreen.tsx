import { useState } from 'react';
import { IonButton } from '@ionic/react';
import type { Locale, Role } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';

export function SettingsScreen({
  t,
  locale,
  setLocale,
  reset,
  role,
  enableNotifications,
  notificationsEnabled,
  childInstalled,
  childLinkingCode,
  parentRecoveryCode,
  regenerateLinkCode,
}: {
  t: (key: MessageKey) => string;
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  reset: () => void;
  role: Role;
  enableNotifications: () => Promise<void>;
  notificationsEnabled: boolean;
  childInstalled: boolean;
  childLinkingCode?: string;
  parentRecoveryCode?: string;
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
  const childInstallStatusKey = childInstalled
    ? 'settingsChildInstallStatusLinked'
    : 'settingsChildInstallStatusPending';
  const childInstallDetailKey = childInstalled
    ? 'settingsChildInstallDetailLinked'
    : 'settingsChildInstallDetailPending';
  const languageDetailKey = locale === 'fr'
    ? 'settingsLanguageDetailFr'
    : 'settingsLanguageDetailEn';
  const updatedAt = new Date(import.meta.env.VITE_APP_UPDATED_AT ?? '');
  const appUpdated = Number.isNaN(updatedAt.getTime())
    ? import.meta.env.VITE_APP_UPDATED_AT
    : new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(updatedAt);

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
      {role === 'parent' ? <section className="card history-row settings-history-row">
        <div className="history-icon settings-history-icon" aria-hidden="true">⌁</div>
        <div>
          <strong>{t('settingsChildInstallTitle')}</strong>
          <small>{t(childInstallDetailKey)}</small>
        </div>
        <span className={childInstalled ? 'status-pill status-detected' : 'status-pill status-missed'}>
          {t(childInstallStatusKey)}
        </span>
      </section> : null}
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
      <section className="card history-row settings-history-row">
        <div className="history-icon settings-history-icon" aria-hidden="true">🌐</div>
        <div>
          <strong>{t('settingsLanguageTitle')}</strong>
          <small>{t(languageDetailKey)}</small>
        </div>
        <div className="settings-locale-toggle">
          <button className={locale === 'en' ? 'active' : ''} onClick={() => { void setLocale('en'); }}>EN</button>
          <button className={locale === 'fr' ? 'active' : ''} onClick={() => { void setLocale('fr'); }}>FR</button>
        </div>
      </section>
      <section className="card history-row settings-history-row">
        <div className="history-icon settings-history-icon" aria-hidden="true">ⓘ</div>
        <div>
          <strong>{t('settingsAppInfoTitle')}</strong>
          <small>{t('settingsVersionLabel')} {import.meta.env.VITE_APP_VERSION} · {t('settingsUpdatedLabel')} {appUpdated}</small>
        </div>
      </section>
      <section className="card privacy-card">
        <h2>{t('privacyDefaults')}</h2>
        <ul><li>{t('noFaceRecognition')}</li><li>{t('noModelTraining')}</li><li>{t('noPhotoUpload')}</li><li>{t('immediateDeletion')}</li></ul>
      </section>
      {parentRecoveryCode ? (
        <section className="card code-box settings-link-code-card">
          <small>{t('parentRecoveryCode')}</small>
          <strong>{parentRecoveryCode}</strong>
          <span>{t('parentRecoverHelp')}</span>
        </section>
      ) : null}
      <Disclaimer t={t} />
      <IonButton expand="block" fill="outline" color="danger" onClick={confirmReset}>{t('resetDemo')}</IonButton>
    </div>
  );
}
