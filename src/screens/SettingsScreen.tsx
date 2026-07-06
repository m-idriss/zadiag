import { useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import {
  informationCircleOutline,
  languageOutline,
  linkOutline,
  mailOutline,
  notificationsOutline,
  phonePortraitOutline,
  trashOutline,
} from 'ionicons/icons';
import type { Locale, Role, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { buildDiagnosticsEmailBody, createCorrelationId } from '../services/appLogs';
import type { AppUpdateInfo } from '../services/appUpdate';
import { Disclaimer } from '../components/Disclaimer';
import { CodeBox } from '../components/CodeBox';

const SUPPORT_EMAIL = 'contact@3dime.com';

export function SettingsScreen({
  t,
  locale,
  setLocale,
  updateInfo,
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
  updateInfo: AppUpdateInfo;
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
  const [contactMailError, setContactMailError] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);
  const [updateError, setUpdateError] = useState(false);
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
      const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      window.location.href = mailto;
    } catch (error) {
      console.error(error);
      setMailError(true);
    }
  };
  const contactSupport = () => {
    setContactMailError(false);
    try {
      const subject = 'Zadiag contact';
      const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
      window.location.href = mailto;
    } catch (error) {
      console.error(error);
      setContactMailError(true);
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
  const updateSeverity = updateInfo.available ? updateInfo.severity : 'none';
  const updateDetail = updateInfo.available
    ? updateInfo.severity === 'major'
      ? t('settingsUpdateMajorAvailable')
      : updateInfo.severity === 'minor'
        ? t('settingsUpdateMinorAvailable')
        : updateInfo.patchCount
          ? t('settingsUpdatePatchAvailable')
          : t('settingsUpdateAvailable')
    : t('settingsUpdateDetail');

  return (
    <div className="content-screen settings-screen">
      <header className="screen-header"><div><h1>{t('settings')}</h1><p>{t('settingsHint')}</p></div></header>
      <section className="settings-section" aria-labelledby="settings-device-heading">
        <h2 id="settings-device-heading">{t('settingsDeviceSection')}</h2>
        <div className="card settings-list">
          <div className="settings-row">
            <span className="settings-row-icon" aria-hidden="true"><IonIcon icon={phonePortraitOutline} /></span>
            <div className="settings-row-copy">
              <strong>{t('installTitle')}</strong>
              <small>{t('settingsInstallDetail')}</small>
            </div>
            <span className="status-pill status-detected">{t('settingsInstallStatus')}</span>
          </div>
          {role === 'parent' ? <div className="settings-row">
            <span className="settings-row-icon" aria-hidden="true"><IonIcon icon={linkOutline} /></span>
            <div className="settings-row-copy">
              <strong>{t('settingsChildInstallTitle')}</strong>
              <small>{t(childInstallDetailKey)}</small>
            </div>
            <span className={childInstalled ? 'status-pill status-detected' : 'status-pill status-missed'}>
              {t(childInstallStatusKey)}
            </span>
          </div> : null}
          {role === 'child' ? <div className="settings-row settings-row-expandable">
            <span className="settings-row-icon" aria-hidden="true"><IonIcon icon={notificationsOutline} /></span>
            <div className="settings-row-copy">
              <strong>{t('notifications')}</strong>
              <small>{t(notificationDetailKey)}</small>
              {notificationState === 'error' ? <small className="settings-action-error">{t('pushError')}</small> : null}
            </div>
            <div className="settings-row-control">
              <span className={notificationEnabled ? 'status-pill status-detected' : 'status-pill status-missed'}>
                {t(notificationStatusKey)}
              </span>
              {!notificationEnabled ? <IonButton
                className="settings-inline-action settings-inline-action-contained"
                size="small"
                disabled={!standalone || notificationState === 'saving'}
                onClick={() => { void requestNotifications(); }}
              >
                {notificationState === 'saving' ? t('enablingReminders') : t('enableReminders')}
              </IonButton> : null}
            </div>
          </div> : null}
          <div className="settings-row">
            <span className="settings-row-icon" aria-hidden="true"><IonIcon icon={languageOutline} /></span>
            <div className="settings-row-copy">
              <strong>{t('settingsLanguageTitle')}</strong>
              <small>{t(languageDetailKey)}</small>
            </div>
            <div className="settings-locale-toggle" role="group" aria-label={t('settingsLanguageTitle')}>
              <button type="button" className={locale === 'en' ? 'active' : ''} aria-pressed={locale === 'en'} onClick={() => { void setLocale('en'); }}>EN</button>
              <button type="button" className={locale === 'fr' ? 'active' : ''} aria-pressed={locale === 'fr'} onClick={() => { void setLocale('fr'); }}>FR</button>
            </div>
          </div>
        </div>
      </section>
      <section className="settings-section" aria-labelledby="settings-support-heading">
        <h2 id="settings-support-heading">{t('settingsSupportSection')}</h2>
        <div className="card settings-list">
          <div className="settings-row">
            <span className="settings-row-icon" aria-hidden="true"><IonIcon icon={mailOutline} /></span>
            <div className="settings-row-copy">
              <strong>{t('settingsDebugMailTitle')}</strong>
              <small>{t('settingsDebugMailDetail')}</small>
              {mailError ? <small className="settings-action-error">{t('settingsDebugMailError')}</small> : null}
            </div>
            <IonButton className="settings-inline-action settings-inline-action-contained" size="small" onClick={sendDiagnosticsEmail}>
              {t('settingsDebugMailSend')}
            </IonButton>
          </div>
          <div className="settings-row">
            <span className="settings-row-icon" aria-hidden="true"><IonIcon icon={informationCircleOutline} /></span>
            <div className="settings-row-copy">
              <strong>{t('settingsAppInfoTitle')}</strong>
              <small>{t('settingsVersionLabel')} {import.meta.env.VITE_APP_VERSION} · {t('settingsUpdatedLabel')} {appUpdated}</small>
              <small>{updateDetail}</small>
              {updateError ? <small className="settings-action-error">{t('settingsUpdateError')}</small> : null}
            </div>
            <div className="settings-row-control">
              {updateInfo.badgeLabel ? <span className={`settings-update-badge ${updateSeverity}`}>{updateInfo.badgeLabel}</span> : null}
              <IonButton
                className={`settings-inline-action settings-inline-action-contained settings-update-action ${updateSeverity}`}
                size="small"
                disabled={updatingApp || !updateInfo.available}
                onClick={() => { void forceUpdate(); }}
              >
                {updatingApp ? t('settingsUpdateChecking') : t('settingsUpdateAction')}
              </IonButton>
            </div>
          </div>
        </div>
      </section>
      <section className="settings-section settings-account-section" aria-labelledby="settings-account-heading">
        <h2 id="settings-account-heading">{t('settingsAccountSection')}</h2>
      <section className="card privacy-card">
        <h2>{t('privacyDefaults')}</h2>
        <ul><li>{t('noFaceRecognition')}</li><li>{t('noModelTraining')}</li><li>{t('noPhotoUpload')}</li><li>{t('immediateDeletion')}</li></ul>
      </section>
      {(role === 'parent' ? childLinkingCode : parentRecoveryCode) ? (
        <CodeBox
          label={t(role === 'parent' ? 'childLinkCode' : 'parentRecoveryCode')}
          hint={t(role === 'parent' ? 'childLinkCodeHint' : 'childRecoveryHelp')}
          value={(role === 'parent' ? childLinkingCode : parentRecoveryCode) || ''}
          maskValue
          t={t}
          {...(role === 'parent' ? {
            action: (
              <>
                <button type="button" className="regenerate-code" disabled={regenerating} onClick={() => { void regenerate(); }}>
                  {regenerating ? t('regeneratingCode') : t('regenerateCode')}
                </button>
                {codeError ? <span className="form-error">{t('regenerateCodeError')}</span> : null}
              </>
            ),
          } : {})}
        />
      ) : null}
      <Disclaimer t={t} />
      {contactMailError ? <small className="settings-action-error">{t('settingsContactError')}</small> : null}
      <IonButton className="settings-contact-button" expand="block" onClick={contactSupport}>
        <IonIcon slot="start" icon={mailOutline} />
        {t('settingsContactButton')}
      </IonButton>
      <IonButton className="settings-reset-button" expand="block" onClick={confirmReset}>
        <IonIcon slot="start" icon={trashOutline} />
        {t('resetDemo')}
      </IonButton>
      </section>
    </div>
  );
}
