import { useRef, useState } from 'react';
import { IonButton } from '@ionic/react';
import type { Locale, Role, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { buildDiagnosticsEmailBody, createCorrelationId } from '../services/appLogs';
import { Disclaimer } from '../components/Disclaimer';
import { CodeBox } from '../components/CodeBox';

export function SettingsScreen({
  t,
  locale,
  setLocale,
  updateAvailable,
  forceAppUpdate,
  reset,
  role,
  enableNotifications,
  notificationsEnabled,
  childInstalled,
  familyId,
  events,
  childLinkingCode,
  parentRecoveryCode,
  pendingChecks,
  totalChecks,
  regenerateLinkCode,
}: {
  t: (key: MessageKey) => string;
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  updateAvailable: boolean;
  forceAppUpdate: () => Promise<boolean>;
  reset: () => void;
  role: Role;
  enableNotifications: () => Promise<void>;
  notificationsEnabled: boolean;
  childInstalled: boolean;
  familyId?: string;
  events: VerificationEvent[];
  childLinkingCode?: string;
  parentRecoveryCode?: string;
  pendingChecks: number;
  totalChecks: number;
  regenerateLinkCode: () => Promise<void>;
}) {
  const standalone = window.matchMedia('(display-mode: standalone)').matches;
  const [notificationState, setNotificationState] = useState<'idle' | 'saving' | 'enabled' | 'error'>(
    notificationsEnabled ? 'enabled' : 'idle',
  );
  const [mailError, setMailError] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const pullStartY = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const pullThreshold = 72;

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
  const sendDiagnosticsEmail = () => {
    setMailError(false);
    try {
      const correlationId = createCorrelationId();
      const subject = `Zadiag debug report [${correlationId}] - ${new Date().toISOString()}`;
      const body = buildDiagnosticsEmailBody({
        correlationId,
        locale,
        role,
        familyId,
        notificationsEnabled,
        childInstalled,
        pendingChecks,
        totalChecks,
        events,
      });
      const mailto = `mailto:contact@3dime.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
    } catch (error) {
      console.error(error);
      setMailError(true);
    }
  };
  const forceUpdate = async () => {
    setUpdateError(false);
    setUpdatingApp(true);
    try {
      await forceAppUpdate();
    } catch (error) {
      console.error(error);
      setUpdateError(true);
    } finally {
      setUpdatingApp(false);
    }
  };
  const startPull = (event: React.TouchEvent<HTMLDivElement>) => {
    if (updatingApp || event.currentTarget.scrollTop > 0 || event.touches.length !== 1) {
      pullStartY.current = null;
      return;
    }
    pullStartY.current = event.touches[0].clientY;
    setPullDistance(0);
  };
  const movePull = (event: React.TouchEvent<HTMLDivElement>) => {
    if (pullStartY.current === null || updatingApp) return;
    if (event.currentTarget.scrollTop > 0) {
      setPullDistance(0);
      return;
    }
    const distance = event.touches[0].clientY - pullStartY.current;
    setPullDistance(Math.max(0, Math.min(110, distance)));
  };
  const endPull = () => {
    if (pullStartY.current === null || updatingApp) return;
    const shouldUpdate = pullDistance >= pullThreshold;
    pullStartY.current = null;
    setPullDistance(0);
    if (shouldUpdate) void forceUpdate();
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
  const pullProgress = updatingApp
    ? 100
    : Math.max(0, Math.min(100, Math.round((pullDistance / pullThreshold) * 100)));
  const pullLabel = updatingApp
    ? t('settingsPullUpdateChecking')
    : pullDistance >= pullThreshold
      ? t('settingsPullUpdateRelease')
      : t('settingsPullUpdatePull');
  const pullVisible = updatingApp || pullDistance > 0;

  return (
    <div className="content-screen settings-screen" onTouchStart={startPull} onTouchMove={movePull} onTouchEnd={endPull} onTouchCancel={endPull}>
      <header className="screen-header"><div><small>Zadiag</small><h1>{t('settings')}</h1><p>{t('settingsHint')}</p></div></header>
      <div className={`settings-pull-indicator ${pullVisible ? 'visible' : ''}`} aria-live="polite">
        <small>{pullLabel}</small>
        <div className="settings-pull-bar" aria-hidden="true"><div style={{ width: `${pullProgress}%` }} /></div>
      </div>
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
      <section className="card history-row settings-history-row">
        <div className="history-icon settings-history-icon" aria-hidden="true">🌐</div>
        <div>
          <strong>{t('settingsLanguageTitle')}</strong>
          <small>{t(languageDetailKey)}</small>
        </div>
        <div className="settings-locale-toggle">
          <button type="button" className={locale === 'en' ? 'active' : ''} aria-pressed={locale === 'en'} onClick={() => { void setLocale('en'); }}>EN</button>
          <button type="button" className={locale === 'fr' ? 'active' : ''} aria-pressed={locale === 'fr'} onClick={() => { void setLocale('fr'); }}>FR</button>
        </div>
      </section>
      <section className="card history-row settings-history-row">
        <div className="history-icon settings-history-icon" aria-hidden="true">✉️</div>
        <div>
          <strong>{t('settingsDebugMailTitle')}</strong>
          <small>{t('settingsDebugMailDetail')}</small>
          {mailError ? <small className="settings-action-error">{t('settingsDebugMailError')}</small> : null}
        </div>
        <div>
          <IonButton className="settings-inline-action settings-inline-action-contained" size="small" onClick={sendDiagnosticsEmail}>
            {t('settingsDebugMailSend')}
          </IonButton>
        </div>
      </section>
      <section className="card history-row settings-history-row">
        <div className="history-icon settings-history-icon" aria-hidden="true">ⓘ</div>
        <div>
          <strong>{t('settingsAppInfoTitle')}</strong>
          <small>{t('settingsVersionLabel')} {import.meta.env.VITE_APP_VERSION} · {t('settingsUpdatedLabel')} {appUpdated}</small>
          {updateError ? <small className="settings-action-error">{t('settingsUpdateError')}</small> : null}
        </div>
        <div>
          <IonButton
            className="settings-inline-action settings-inline-action-contained"
            size="small"
            disabled={updatingApp || !updateAvailable}
            onClick={() => { void forceUpdate(); }}
          >
            {updatingApp ? t('settingsUpdateChecking') : t('settingsUpdateAction')}
          </IonButton>
        </div>
      </section>
      {role === 'parent' && childLinkingCode ? (
        <CodeBox
          label={t('childLinkCode')}
          hint={t('childLinkCodeHint')}
          value={childLinkingCode}
          t={t}
          action={(
            <>
              <button type="button" className="regenerate-code" disabled={regenerating} onClick={() => { void regenerate(); }}>
                {regenerating ? t('regeneratingCode') : t('regenerateCode')}
              </button>
              {codeError ? <span className="form-error">{t('regenerateCodeError')}</span> : null}
            </>
          )}
        />
      ) : null}
      {role === 'child' && parentRecoveryCode ? (
        <CodeBox
          label={t('parentRecoveryCode')}
          hint={t('childRecoveryHelp')}
          value={parentRecoveryCode}
          maskValue
          t={t}
        />
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
