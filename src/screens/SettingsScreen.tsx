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
import { ActionButton, ListRow, SegmentedControl } from '../components/ui';
import { SvgIcon } from '../components/SvgIcon';
import { RelationshipManager } from '../components/RelationshipManager';
import { languageTag } from '../services/locale';

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
  pendingChecks,
  totalChecks,
  serviceWorkerStatus,
  lastSyncAt,
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
  pendingChecks: number;
  totalChecks: number;
  serviceWorkerStatus: 'unsupported' | 'registered' | 'notRegistered';
  lastSyncAt?: string;
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
  const [contactMailError, setContactMailError] = useState(false);
  const [updatingApp, setUpdatingApp] = useState(false);
  const [updateError, setUpdateError] = useState(false);
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

  const confirmReset = () => {
    if (window.confirm(t('resetConfirm'))) reset();
  };
  const contactSupport = () => {
    setContactMailError(false);
    try {
      const correlationId = createCorrelationId();
      const subject = `Zadiag contact [${correlationId}]`;
      const diagnostics = buildDiagnosticsEmailBody({
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
      const body = `${t('settingsContactEmailPrompt')}\n\n\n${diagnostics}`;
      const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
  const languageDetailKey = locale === 'fr'
    ? 'settingsLanguageDetailFr'
    : 'settingsLanguageDetailEn';
  const notificationWindowLabel = `${preferences.notificationWindowStart}-${preferences.notificationWindowEnd}`;
  const notificationWindowValue = preferences.notificationWindowStart === '08:00' && preferences.notificationWindowEnd === '21:00'
    ? 'day'
    : 'anytime';
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
    ? new Intl.DateTimeFormat(languageTag(locale), {
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
    return new Intl.DateTimeFormat(languageTag(locale), {
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
  return (
    <div className="content-screen settings-screen">
      <div className="page-context-top settings-context-top">
        <header className="screen-header page-context-heading">
          <div><h1>{t('settings')}</h1></div>
        </header>
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
        hideHeading
        t={t}
      />
      </div>
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
            title={t('settingsContactButton')}
            detail={t('settingsContactDetail')}
            trailing={<button type="button" className="settings-inline-action settings-inline-action-contained" onClick={contactSupport}>{t('settingsContactButton')}</button>}
          >
            {contactMailError ? <small className="settings-action-error">{t('settingsContactError')}</small> : null}
          </ListRow>
        </div>
      </section>
      <section className="settings-section settings-account-section" aria-labelledby="settings-account-heading">
        <h2 id="settings-account-heading">{t('settingsAccountSection')}</h2>
      <Disclaimer t={t} />
      <section className="card privacy-card">
        <ul><li>{t('noFaceRecognition')}</li><li>{t('noModelTraining')}</li><li>{t('noPhotoUpload')}</li><li>{t('immediateDeletion')}</li></ul>
      </section>
      <ActionButton className="settings-reset-button" tone="danger" onClick={confirmReset}>
        <SvgIcon icon={trashOutline} />
        {t('resetDemo')}
      </ActionButton>
      </section>
    </div>
  );
}
