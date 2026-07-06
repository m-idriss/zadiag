import { useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import {
  informationCircleOutline,
  languageOutline,
  listOutline,
  mailOutline,
  notificationsOutline,
  optionsOutline,
  timeOutline,
  trashOutline,
} from 'ionicons/icons';
import type { AppPreferences, Locale, Role, VerificationEvent } from '../domain/models';
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
  notificationsEnabled,
  preferences,
  setPreferences,
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
  notificationsEnabled: boolean;
  preferences: AppPreferences;
  setPreferences: (preferences: Partial<AppPreferences>) => Promise<void>;
  childInstalled: boolean;
  familyId?: string;
  events: VerificationEvent[];
  childLinkingCode?: string;
  parentRecoveryCode?: string;
  pendingChecks: number;
  totalChecks: number;
  regenerateLinkCode: () => Promise<void>;
}) {
  const [mailError, setMailError] = useState(false);
  const [contactMailError, setContactMailError] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [codeError, setCodeError] = useState(false);

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
  const notificationDetailKey = notificationsEnabled
    ? 'settingsNotificationsDetailEnabled'
    : 'settingsNotificationsDetailDisabled';
  const languageDetailKey = locale === 'fr'
    ? 'settingsLanguageDetailFr'
    : 'settingsLanguageDetailEn';
  const notificationWindowLabel = `${preferences.notificationWindowStart}-${preferences.notificationWindowEnd}`;
  const reminderRepeatLabel = preferences.reminderRepeatMinutes === 0
    ? t('settingsReminderRepeatDetailOff')
    : t('settingsReminderRepeatDetail').replace('{minutes}', String(preferences.reminderRepeatMinutes));
  const updatedAt = new Date(import.meta.env.VITE_APP_UPDATED_AT ?? '');
  const appUpdated = Number.isNaN(updatedAt.getTime())
    ? import.meta.env.VITE_APP_UPDATED_AT
    : new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
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
  const linkCodeAction = (
    <>
      <button type="button" className="regenerate-code" disabled={regenerating} onClick={() => { void regenerate(); }}>
        {regenerating ? t('regeneratingCode') : t('regenerateCode')}
      </button>
      {codeError ? <span className="form-error">{t('regenerateCodeError')}</span> : null}
    </>
  );

  return (
    <div className="content-screen settings-screen">
      <header className="screen-header"><div><h1>{t('settings')}</h1><p>{t('settingsHint')}</p></div></header>
      <section className="settings-section" aria-labelledby="settings-device-heading">
        <h2 id="settings-device-heading">{t('settingsDeviceSection')}</h2>
        <div className="card settings-list">
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
          <div className="settings-row">
            <span className="settings-row-icon" aria-hidden="true"><IonIcon icon={listOutline} /></span>
            <div className="settings-row-copy">
              <strong>{t('settingsActivityLogTitle')}</strong>
              <small>{t(preferences.showActivityLog ? 'settingsActivityLogDetailVisible' : 'settingsActivityLogDetailHidden')}</small>
            </div>
            <button
              type="button"
              className={`settings-switch ${preferences.showActivityLog ? 'active' : ''}`}
              aria-pressed={preferences.showActivityLog}
              aria-label={t('settingsActivityLogTitle')}
              onClick={() => { void setPreferences({ showActivityLog: !preferences.showActivityLog }); }}
            >
              <span aria-hidden="true" />
            </button>
          </div>
          <div className="settings-row">
            <span className="settings-row-icon" aria-hidden="true"><IonIcon icon={optionsOutline} /></span>
            <div className="settings-row-copy">
              <strong>{t('settingsCompactModeTitle')}</strong>
              <small>{t(preferences.compactMode ? 'settingsCompactModeDetailOn' : 'settingsCompactModeDetailOff')}</small>
            </div>
            <button
              type="button"
              className={`settings-switch ${preferences.compactMode ? 'active' : ''}`}
              aria-pressed={preferences.compactMode}
              aria-label={t('settingsCompactModeTitle')}
              onClick={() => { void setPreferences({ compactMode: !preferences.compactMode }); }}
            >
              <span aria-hidden="true" />
            </button>
          </div>
          {role === 'child' ? <div className="settings-row">
            <span className="settings-row-icon" aria-hidden="true"><IonIcon icon={timeOutline} /></span>
            <div className="settings-row-copy">
              <strong>{t('settingsNotificationWindowTitle')}</strong>
              <small>{t('settingsNotificationWindowDetail')} {notificationWindowLabel}</small>
            </div>
            <div className="settings-locale-toggle settings-choice-toggle" role="group" aria-label={t('settingsNotificationWindowTitle')}>
              <button
                type="button"
                className={preferences.notificationWindowStart === '08:00' && preferences.notificationWindowEnd === '21:00' ? 'active' : ''}
                aria-pressed={preferences.notificationWindowStart === '08:00' && preferences.notificationWindowEnd === '21:00'}
                onClick={() => { void setPreferences({ notificationWindowStart: '08:00', notificationWindowEnd: '21:00' }); }}
              >
                {t('settingsNotificationWindowDay')}
              </button>
              <button
                type="button"
                className={preferences.notificationWindowStart === '00:00' && preferences.notificationWindowEnd === '23:59' ? 'active' : ''}
                aria-pressed={preferences.notificationWindowStart === '00:00' && preferences.notificationWindowEnd === '23:59'}
                onClick={() => { void setPreferences({ notificationWindowStart: '00:00', notificationWindowEnd: '23:59' }); }}
              >
                {t('settingsNotificationWindowAnytime')}
              </button>
            </div>
          </div> : null}
          {role === 'parent' ? <div className="settings-row">
            <span className="settings-row-icon" aria-hidden="true"><IonIcon icon={notificationsOutline} /></span>
            <div className="settings-row-copy">
              <strong>{t('settingsReminderRepeatTitle')}</strong>
              <small>{reminderRepeatLabel}</small>
            </div>
            <div className="settings-locale-toggle settings-choice-toggle" role="group" aria-label={t('settingsReminderRepeatTitle')}>
              {[0, 20, 30].map((minutes) => (
                <button
                  type="button"
                  className={preferences.reminderRepeatMinutes === minutes ? 'active' : ''}
                  aria-pressed={preferences.reminderRepeatMinutes === minutes}
                  onClick={() => { void setPreferences({ reminderRepeatMinutes: minutes }); }}
                  key={minutes}
                >
                  {minutes === 0 ? t('off') : `${minutes}m`}
                </button>
              ))}
            </div>
          </div> : null}
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
              <strong>{t('settingsAppInfoTitle')} v{import.meta.env.VITE_APP_VERSION}</strong>
              <small>{t('settingsUpdatedLabel')} {appUpdated}</small>
              {updateInfo.available ? <small>{updateDetail}</small> : null}
              {updateError ? <small className="settings-action-error">{t('settingsUpdateError')}</small> : null}
            </div>
            <div className="settings-row-control">
              {updateInfo.badgeLabel ? <span className={`settings-update-badge ${updateSeverity}`}>{updateInfo.badgeLabel}</span> : null}
              <IonButton
                className={`settings-inline-action settings-inline-action-contained settings-update-action ${updateSeverity}`}
                size="small"
                disabled={updatingApp}
                onClick={() => { void forceUpdate(); }}
              >
                {updatingApp ? t('settingsUpdateChecking') : updateInfo.available ? t('settingsUpdateAction') : t('settingsUpdateCheckAction')}
              </IonButton>
            </div>
          </div>
        </div>
      </section>
      <section className="settings-section" aria-labelledby="settings-install-heading">
        <h2 id="settings-install-heading">{t('settingsInstallSection')}</h2>
        {role === 'parent' ? (
          <section className="card privacy-card settings-device-card">
            <ul>
              <li className={childInstalled ? undefined : 'settings-device-missing'}>{t('settingsChildInstallTitle')}</li>
            </ul>
          </section>
        ) : (
          <section className="card privacy-card settings-device-card">
            <h2>{t('installTitle')}</h2>
            <ul>
              <li>{t('settingsInstallDetail')}</li>
              <li className={notificationsEnabled ? undefined : 'settings-device-missing'}>{t(notificationDetailKey)}</li>
            </ul>
          </section>
        )}
      </section>
      <section className="settings-section settings-account-section" aria-labelledby="settings-account-heading">
        <h2 id="settings-account-heading">{t('settingsAccountSection')}</h2>
      <section className="card privacy-card">
        <h2>{t('privacyDefaults')}</h2>
        <ul><li>{t('noFaceRecognition')}</li><li>{t('noModelTraining')}</li><li>{t('noPhotoUpload')}</li><li>{t('immediateDeletion')}</li></ul>
      </section>
      {role === 'parent' ? (
        childLinkingCode ? (
          <CodeBox
            label={t('childLinkCode')}
            hint={t('childLinkCodeHint')}
            value={childLinkingCode}
            maskValue
            t={t}
            action={linkCodeAction}
          />
        ) : (
          <section className="card code-box">
            <div className="code-box-header">
              <div>
                <small className="code-box-label">{t('childLinkCode')}</small>
                <div className="code-box-value-row">
                  <strong>{t('childLinkCodeEmpty')}</strong>
                </div>
              </div>
            </div>
            <span>{t('childLinkCodeEmptyHint')}</span>
            <div className="code-box-actions">{linkCodeAction}</div>
          </section>
        )
      ) : parentRecoveryCode ? (
        <CodeBox
          label={t('parentRecoveryCode')}
          hint={t('childRecoveryHelp')}
          value={parentRecoveryCode}
          maskValue
          t={t}
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
