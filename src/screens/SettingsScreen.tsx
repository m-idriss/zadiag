import { useEffect, useState } from 'react';
import {
  chevronDownOutline,
  informationCircleOutline,
  languageOutline,
  mailOutline,
  notificationsOutline,
  timeOutline,
  trashOutline,
} from 'ionicons/icons';
import type { AppPreferences, Locale, MembershipRole, ParticipantAccess, ParticipantMember, PushSubscriptionHealth, Role, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { buildDiagnosticsEmailBody, createCorrelationId } from '../services/appLogs';
import type { AppUpdateInfo } from '../services/appUpdate';
import { Disclaimer } from '../components/Disclaimer';
import { CodeBox } from '../components/CodeBox';
import { ActionButton, ListRow, SegmentedControl, Switch } from '../components/ui';
import { SvgIcon } from '../components/SvgIcon';
import { RelationshipManager } from '../components/RelationshipManager';

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
  pushHealth,
  preferences,
  setPreferences,
  enableNotifications,
  sendTestPushNotification,
  childInstalled,
  familyId,
  events,
  childLinkingCode,
  parentRecoveryCode,
  pendingChecks,
  totalChecks,
  serviceWorkerStatus,
  lastSyncAt,
  regenerateLinkCode,
  participantAccess,
  activeParticipantId,
  selectParticipant,
  createParticipant,
  inviteParticipantMember,
  acceptParticipantInvitation,
  leaveParticipant,
  removeParticipantMember,
  deleteParticipant,
  createRelationshipRecovery,
  recoverRelationship,
}: {
  t: (key: MessageKey) => string;
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
  updateInfo: AppUpdateInfo;
  forceAppUpdate: () => Promise<boolean>;
  reset: () => void;
  role: Role;
  notificationsEnabled: boolean;
  pushHealth?: PushSubscriptionHealth;
  preferences: AppPreferences;
  setPreferences: (preferences: Partial<AppPreferences>) => Promise<void>;
  enableNotifications: () => Promise<void>;
  sendTestPushNotification: () => Promise<void>;
  childInstalled: boolean;
  familyId?: string;
  events: VerificationEvent[];
  childLinkingCode?: string;
  parentRecoveryCode?: string;
  pendingChecks: number;
  totalChecks: number;
  serviceWorkerStatus: 'unsupported' | 'registered' | 'notRegistered';
  lastSyncAt?: string;
  regenerateLinkCode: () => Promise<void>;
  participantAccess?: ParticipantAccess[];
  activeParticipantId?: string;
  selectParticipant?: (participantId: string) => Promise<void>;
  createParticipant?: (displayName: string, selfManaged: boolean) => Promise<string>;
  inviteParticipantMember?: (participantId: string, role: Exclude<MembershipRole, 'owner'>) => Promise<{ code: string; expiresAt: string }>;
  acceptParticipantInvitation?: (code: string) => Promise<string>;
  leaveParticipant?: (participantId: string) => Promise<void>;
  removeParticipantMember?: (participantId: string, targetUid: string) => Promise<ParticipantMember[]>;
  deleteParticipant?: (participantId: string) => Promise<void>;
  createRelationshipRecovery?: (participantId: string) => Promise<{ recoveryCode: string; expiresAt: string }>;
  recoverRelationship?: (code: string) => Promise<{ participantId: string; recoveryCode?: string; expiresAt?: string }>;
}) {
  const [mailError, setMailError] = useState(false);
  const [contactMailError, setContactMailError] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);
  const [updateError, setUpdateError] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [sensitiveOpen, setSensitiveOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [enablingNotifications, setEnablingNotifications] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [testPushStatus, setTestPushStatus] = useState<'idle' | 'success' | 'error' | 'enableError'>('idle');
  const [localPushEndpointPresent, setLocalPushEndpointPresent] = useState(false);
  const [localPushDispatchAt, setLocalPushDispatchAt] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const refreshLocalPushEndpoint = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) setLocalPushEndpointPresent(false);
        return;
      }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled) setLocalPushEndpointPresent(Boolean(subscription?.endpoint));
      } catch {
        if (!cancelled) setLocalPushEndpointPresent(false);
      }
    };
    void refreshLocalPushEndpoint();
    return () => { cancelled = true; };
  }, [notificationsEnabled, diagnosticsOpen, testPushStatus]);

  const hasLocalPushEvidence = localPushEndpointPresent || testPushStatus === 'success' || Boolean(localPushDispatchAt);
  const effectivePushHealth: PushSubscriptionHealth | undefined = pushHealth || hasLocalPushEvidence
    ? {
      permission: pushHealth?.permission ?? ('Notification' in window ? Notification.permission : 'unsupported'),
      ...pushHealth,
      endpointPresent: pushHealth?.endpointPresent || hasLocalPushEvidence,
      lastDispatchResult: localPushDispatchAt ? 'success' : pushHealth?.lastDispatchResult,
      lastDispatchAt: localPushDispatchAt ?? pushHealth?.lastDispatchAt,
    }
    : pushHealth;

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
        pushHealth: effectivePushHealth,
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
  const testPush = async () => {
    setTestPushStatus('idle');
    setTestingPush(true);
    try {
      await sendTestPushNotification();
      const testedAt = new Date().toISOString();
      setLocalPushEndpointPresent(true);
      setLocalPushDispatchAt(testedAt);
      setTestPushStatus('success');
    } catch (error) {
      console.error(error);
      setTestPushStatus('error');
    } finally {
      setTestingPush(false);
    }
  };
  const activateNotifications = async () => {
    setTestPushStatus('idle');
    setEnablingNotifications(true);
    try {
      await enableNotifications();
      setLocalPushEndpointPresent(true);
    } catch (error) {
      console.error(error);
      setTestPushStatus('enableError');
    } finally {
      setEnablingNotifications(false);
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
  const serviceWorkerDetailKey = serviceWorkerStatus === 'registered'
    ? 'settingsServiceWorkerRegistered'
    : serviceWorkerStatus === 'unsupported'
      ? 'settingsServiceWorkerUnsupported'
      : 'settingsServiceWorkerMissing';
  const formattedLastSync = lastSyncAt
    ? new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(lastSyncAt))
    : t('settingsDiagnosticsMissing');
  const formatDiagnosticDate = (value?: string) => {
    if (!value) return t('settingsDiagnosticsMissing');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };
  const pushSavedDiagnostic = effectivePushHealth?.lastSuccessfulSaveAt
    ? formatDiagnosticDate(effectivePushHealth.lastSuccessfulSaveAt)
    : effectivePushHealth?.endpointPresent
      ? t('yes')
      : t('settingsDiagnosticsMissing');
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
            icon={<SvgIcon icon={languageOutline} />}
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
              icon={<SvgIcon icon={timeOutline} />}
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
              icon={<SvgIcon icon={notificationsOutline} />}
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
      <RelationshipManager
        access={participantAccess}
        activeParticipantId={activeParticipantId}
        onSelect={selectParticipant}
        onCreate={createParticipant}
        onInvite={inviteParticipantMember}
        onAccept={acceptParticipantInvitation}
        onLeave={leaveParticipant}
        onRemoveMember={removeParticipantMember}
        onDeleteParticipant={deleteParticipant}
        onCreateRecovery={createRelationshipRecovery}
        onRecover={recoverRelationship}
        t={t}
      />
      <section className="settings-section" aria-labelledby="settings-support-heading">
        <h2 id="settings-support-heading">{t('settingsSupportSection')}</h2>
        <div className="card settings-list">
          <ListRow
            icon={<SvgIcon icon={informationCircleOutline} />}
            title={(
              <span className="settings-diagnostics-header">
                <span>{t('settingsRecoveryDiagnosticsTitle')}</span>
                <button
                  type="button"
                  className="settings-diagnostics-toggle"
                  aria-expanded={diagnosticsOpen}
                  aria-label={t('settingsRecoveryDiagnosticsTitle')}
                  onClick={() => setDiagnosticsOpen((open) => !open)}
                >
                  <SvgIcon className={diagnosticsOpen ? 'expanded' : undefined} icon={chevronDownOutline} />
                </button>
              </span>
            )}
            detail={t('settingsRecoveryDiagnosticsDetail')}
          >
            <dl className="settings-diagnostics-list">
              {diagnosticsOpen ? (
                <>
                  <div><dt>{t('settingsDiagnosticsFamilyId')}</dt><dd>{familyId ?? t('settingsDiagnosticsMissing')}</dd></div>
                  <div><dt>{t('settingsDiagnosticsRole')}</dt><dd>{t(role)}</dd></div>
                  <div><dt>{t('settingsDiagnosticsParticipant')}</dt><dd>{childInstalled ? t('settingsChildInstallStatusLinked') : t('settingsChildInstallStatusPending')}</dd></div>
                  <div><dt>{t('settingsDiagnosticsNotifications')}</dt><dd>{notificationsEnabled ? t('settingsNotificationsStatusEnabled') : t('settingsNotificationsStatusDisabled')}</dd></div>
                  <div><dt>{t('settingsDiagnosticsPushPermission')}</dt><dd>{effectivePushHealth?.permission ?? t('settingsDiagnosticsMissing')}</dd></div>
                  <div><dt>{t('settingsDiagnosticsPushEndpoint')}</dt><dd>{effectivePushHealth?.endpointPresent ? t('yes') : t('no')}</dd></div>
                  <div><dt>{t('settingsDiagnosticsPushSaved')}</dt><dd>{pushSavedDiagnostic}</dd></div>
                  <div><dt>{t('settingsDiagnosticsPushDispatch')}</dt><dd>{effectivePushHealth?.lastDispatchResult ?? t('settingsDiagnosticsMissing')}</dd></div>
                  <div><dt>{t('settingsDiagnosticsPushDispatchAt')}</dt><dd>{formatDiagnosticDate(effectivePushHealth?.lastDispatchAt)}</dd></div>
                  <div><dt>{t('settingsDiagnosticsServiceWorker')}</dt><dd>{t(serviceWorkerDetailKey)}</dd></div>
                </>
              ) : null}
              <div><dt>{t('settingsDiagnosticsAppVersion')}</dt><dd>{import.meta.env.VITE_APP_VERSION}</dd></div>
              <div><dt>{t('settingsDiagnosticsLastSync')}</dt><dd>{formattedLastSync}</dd></div>
            </dl>
          </ListRow>
          <ListRow
            icon={<SvgIcon icon={informationCircleOutline} />}
            title={t('settingsUpdateTitle')}
            detail={updateDetail}
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
            {updateError ? <small className="settings-action-error">{t('settingsUpdateError')}</small> : null}
          </ListRow>
          <ListRow
            icon={<SvgIcon icon={mailOutline} />}
            title={t('settingsDebugMailTitle')}
            detail={t('settingsDebugMailDetail')}
            trailing={<button type="button" className="settings-inline-action settings-inline-action-contained" onClick={sendDiagnosticsEmail}>{t('settingsDebugMailSend')}</button>}
          >
            {mailError ? <small className="settings-action-error">{t('settingsDebugMailError')}</small> : null}
          </ListRow>
          <ListRow
            icon={<SvgIcon icon={notificationsOutline} />}
            title={t('settingsTestNotificationTitle')}
            detail={notificationsEnabled ? t('settingsTestNotificationDetail') : t('settingsTestNotificationDisabledDetail')}
            trailing={(
              <button
                type="button"
                className="settings-inline-action settings-inline-action-contained"
                disabled={testingPush || enablingNotifications}
                onClick={() => { void (notificationsEnabled ? testPush() : activateNotifications()); }}
              >
                {testingPush || enablingNotifications
                  ? t('settingsTestNotificationSending')
                  : notificationsEnabled
                    ? t('settingsTestNotificationAction')
                    : t('settingsEnableNotificationsAction')}
              </button>
            )}
          >
            {testPushStatus === 'success' ? <small>{t('settingsTestNotificationSuccess')}</small> : null}
            {testPushStatus === 'error' ? <small className="settings-action-error">{t('settingsTestNotificationError')}</small> : null}
            {testPushStatus === 'enableError' ? <small className="settings-action-error">{t('settingsEnableNotificationsError')}</small> : null}
          </ListRow>
        </div>
      </section>
      <Disclaimer t={t} />
      {contactMailError ? <small className="settings-action-error">{t('settingsContactError')}</small> : null}
      <ActionButton className="settings-contact-button" tone="navy" onClick={contactSupport}>
        <SvgIcon icon={mailOutline} />
        {t('settingsContactButton')}
      </ActionButton>
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
            <SvgIcon className={sensitiveOpen ? 'expanded' : undefined} icon={chevronDownOutline} />
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
            <SvgIcon className={sensitiveOpen ? 'expanded' : undefined} icon={chevronDownOutline} />
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
      <ActionButton className="settings-reset-button" tone="danger" onClick={confirmReset}>
        <SvgIcon icon={trashOutline} />
        {t('resetDemo')}
      </ActionButton>
      </section>
    </div>
  );
}
