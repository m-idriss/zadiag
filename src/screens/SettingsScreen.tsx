import { useState } from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import {
  chevronDownOutline,
  informationCircleOutline,
  languageOutline,
  mailOutline,
  notificationsOutline,
  timeOutline,
  trashOutline,
} from 'ionicons/icons';
import type { AppPreferences, Locale, Role, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { buildDiagnosticsEmailBody, createCorrelationId } from '../services/appLogs';
import type { AppUpdateInfo } from '../services/appUpdate';
import { Disclaimer } from '../components/Disclaimer';
import { CodeBox } from '../components/CodeBox';
import { ListRow, SegmentedControl, Switch } from '../components/ui';

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
  const [sensitiveOpen, setSensitiveOpen] = useState(false);

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
  const notificationWindowValue = preferences.notificationWindowStart === '08:00' && preferences.notificationWindowEnd === '21:00'
    ? 'day'
    : 'anytime';
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
          <ListRow
            icon={<IonIcon icon={languageOutline} />}
            title={t('settingsLanguageTitle')}
            detail={t(languageDetailKey)}
            trailing={(
              <SegmentedControl
                ariaLabel={t('settingsLanguageTitle')}
                value={locale}
                onChange={(value) => { void setLocale(value); }}
                options={[
                  { value: 'en' as const, label: 'EN' },
                  { value: 'fr' as const, label: 'FR' },
                ]}
              />
            )}
          />
          {role === 'child' ? (
            <ListRow
              icon={<IonIcon icon={timeOutline} />}
              title={t('settingsNotificationWindowTitle')}
              detail={`${t('settingsNotificationWindowDetail')} ${notificationWindowLabel}`}
              trailing={(
                <SegmentedControl
                  ariaLabel={t('settingsNotificationWindowTitle')}
                  className="settings-choice-toggle"
                  value={notificationWindowValue}
                  onChange={(value) => {
                    void setPreferences(value === 'day'
                      ? { notificationWindowStart: '08:00', notificationWindowEnd: '21:00' }
                      : { notificationWindowStart: '00:00', notificationWindowEnd: '23:59' });
                  }}
                  options={[
                    { value: 'day' as const, label: t('settingsNotificationWindowDay') },
                    { value: 'anytime' as const, label: t('settingsNotificationWindowAnytime') },
                  ]}
                />
              )}
            />
          ) : null}
          {role === 'parent' ? (
            <ListRow
              icon={<IonIcon icon={notificationsOutline} />}
              title={t('settingsReminderRepeatTitle')}
              detail={reminderRepeatLabel}
              trailing={(
                <SegmentedControl
                  ariaLabel={t('settingsReminderRepeatTitle')}
                  className="settings-choice-toggle"
                  value={preferences.reminderRepeatMinutes}
                  onChange={(value) => { void setPreferences({ reminderRepeatMinutes: value }); }}
                  options={[0, 20, 30].map((minutes) => ({ value: minutes, label: minutes === 0 ? t('off') : `${minutes}m` }))}
                />
              )}
            />
          ) : null}
        </div>
      </section>
      <section className="settings-section" aria-labelledby="settings-support-heading">
        <h2 id="settings-support-heading">{t('settingsSupportSection')}</h2>
        <div className="card settings-list">
          <ListRow
            icon={<IonIcon icon={mailOutline} />}
            title={t('settingsDebugMailTitle')}
            detail={t('settingsDebugMailDetail')}
            trailing={<button type="button" className="settings-inline-action settings-inline-action-contained" onClick={sendDiagnosticsEmail}>{t('settingsDebugMailSend')}</button>}
          >
            {mailError ? <small className="settings-action-error">{t('settingsDebugMailError')}</small> : null}
          </ListRow>
          <ListRow
            icon={<IonIcon icon={informationCircleOutline} />}
            title={`${t('settingsAppInfoTitle')} v${import.meta.env.VITE_APP_VERSION}`}
            detail={`${t('settingsUpdatedLabel')} ${appUpdated}`}
            trailing={(
              <div className="settings-row-control">
                {updateInfo.badgeLabel ? <span className={`settings-update-badge ${updateSeverity}`}>{updateInfo.badgeLabel}</span> : null}
                <button
                  type="button"
                  className={`settings-inline-action settings-inline-action-contained settings-update-action ${updateSeverity}`}
                  disabled={updatingApp}
                  onClick={() => { void forceUpdate(); }}
                >
                  {updatingApp ? t('settingsUpdateChecking') : updateInfo.available ? t('settingsUpdateAction') : t('settingsUpdateCheckAction')}
                </button>
              </div>
            )}
          >
            {updateInfo.available ? <small>{updateDetail}</small> : null}
            {updateError ? <small className="settings-action-error">{t('settingsUpdateError')}</small> : null}
          </ListRow>
        </div>
      </section>
      <Disclaimer t={t} />
      {contactMailError ? <small className="settings-action-error">{t('settingsContactError')}</small> : null}
      <IonButton className="settings-contact-button" expand="block" onClick={contactSupport}>
        <IonIcon slot="start" icon={mailOutline} />
        {t('settingsContactButton')}
      </IonButton>
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
        <ul><li>{t('noFaceRecognition')}</li><li>{t('noModelTraining')}</li><li>{t('noPhotoUpload')}</li><li>{t('immediateDeletion')}</li></ul>
      </section>
      {role === 'parent' ? (
        <section className="settings-sensitive-area" aria-labelledby="settings-sensitive-heading">
          <h3 id="settings-sensitive-heading">{t('settingsSensitiveSection')}</h3>
          <button
            type="button"
            className="card settings-sensitive-toggle"
            aria-expanded={sensitiveOpen}
            aria-controls="settings-link-code-panel"
            onClick={() => setSensitiveOpen((open) => !open)}
          >
            <div>
              <strong>{t('childLinkCode')}</strong>
              <small>{childLinkingCode ? t('settingsSensitiveCodeHint') : t('childLinkCodeEmpty')}</small>
            </div>
            <IonIcon className={sensitiveOpen ? 'expanded' : undefined} icon={chevronDownOutline} aria-hidden="true" />
          </button>
          {sensitiveOpen ? (
            <div id="settings-link-code-panel">
              {childLinkingCode ? (
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
              )}
            </div>
          ) : null}
        </section>
      ) : parentRecoveryCode ? (
        <section className="settings-sensitive-area" aria-labelledby="settings-sensitive-heading">
          <h3 id="settings-sensitive-heading">{t('settingsSensitiveSection')}</h3>
          <button
            type="button"
            className="card settings-sensitive-toggle"
            aria-expanded={sensitiveOpen}
            aria-controls="settings-recovery-code-panel"
            onClick={() => setSensitiveOpen((open) => !open)}
          >
            <div>
              <strong>{t('parentRecoveryCode')}</strong>
              <small>{t('settingsSensitiveCodeHint')}</small>
            </div>
            <IonIcon className={sensitiveOpen ? 'expanded' : undefined} icon={chevronDownOutline} aria-hidden="true" />
          </button>
          {sensitiveOpen ? (
            <div id="settings-recovery-code-panel">
              <CodeBox
                label={t('parentRecoveryCode')}
                hint={t('childRecoveryHelp')}
                value={parentRecoveryCode}
                maskValue
                t={t}
              />
            </div>
          ) : null}
        </section>
      ) : null}
      <IonButton className="settings-reset-button" expand="block" onClick={confirmReset}>
        <IonIcon slot="start" icon={trashOutline} />
        {t('resetDemo')}
      </IonButton>
      </section>
    </div>
  );
}
