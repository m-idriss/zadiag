import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { normalizeAppPreferences, type AppState, type Locale, type Role, type VerificationEvent } from './domain/models';
import { routeForState, type AppRoute } from './domain/appRouting';
import { createRepository } from './services/repositoryFactory';
import { createTranslator, type MessageKey } from './services/i18n';
import { documentLanguage } from './services/locale';
import { BottomNav, navigationTabs, tabAfterSwipe, type Tab } from './components/BottomNav';
import { SplashScreen } from './components/SplashScreen';
import { Snackbar } from './components/Snackbar';
import { PullToUpdate } from './components/PullToUpdate';
import { isSummaryRange, type SummaryRange } from './components/AdherenceSummaryCard';
import { firebaseEnabled } from './services/firebaseConfig';
import { browserRouteContext, captureRelationshipInvitationCode, clearRelationshipInvitationUrl, isLocalDemoEnvironment, notificationLaunchIntent, routineCentricUiEnabled } from './services/browserEnvironment';
import { runWhenStartupIsIdle } from './services/appUpdate';
import { InstallScreen } from './screens/InstallScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { ContactEmailScreen, SuspendedScreen } from './screens/ContactEmailScreen';
import { ChildDashboard } from './screens/ChildDashboard';
import { canRetakeCapture } from './domain/adherence';
import { profileColorFor } from './domain/profileColor';
import { cleanupClientAfterReset } from './services/resetCleanup';
import { readUiStorageString, writeUiStorageString } from './services/uiStorage';
import { useAppUpdateController } from './hooks/useAppUpdateController';
import type { SyncStatus } from './services/contracts';

const lazyScreen = <TProps extends object>(
  load: () => Promise<Record<string, ComponentType<TProps>>>,
  name: string,
) => lazy(async () => ({ default: (await load())[name] as ComponentType<TProps> }));

const LinkScreen = lazyScreen(() => import('./screens/LinkScreen'), 'LinkScreen');
const NotificationSetupScreen = lazyScreen(() => import('./screens/NotificationSetupScreen'), 'NotificationSetupScreen');
const CameraScreen = lazyScreen(() => import('./screens/CameraScreen'), 'CameraScreen');
const ResultScreen = lazyScreen(() => import('./screens/ResultScreen'), 'ResultScreen');
const HistoryScreen = lazyScreen(() => import('./screens/HistoryScreen'), 'HistoryScreen');
const SettingsScreen = lazyScreen(() => import('./screens/SettingsScreen'), 'SettingsScreen');
const ParentDashboard = lazyScreen(() => import('./screens/ParentDashboard'), 'ParentDashboard');
const RoutinesScreen = lazyScreen(() => import('./screens/RoutinesScreen'), 'RoutinesScreen');
const InvitationScreen = lazyScreen(() => import('./screens/InvitationScreen'), 'InvitationScreen');

const appBadgeApi = navigator as Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

const DASHBOARD_SUMMARY_RANGE_KEY = 'zadiag.dashboard.summaryRange';
const syncStatusMessageKeys: Record<SyncStatus, MessageKey> = {
  synced: 'syncStatusSynced',
  syncing: 'syncStatusSyncing',
  offline: 'syncStatusOffline',
  failed: 'syncStatusFailed',
};

const readDashboardSummaryRange = (): SummaryRange => {
  const stored = readUiStorageString(DASHBOARD_SUMMARY_RANGE_KEY);
  return isSummaryRange(stored) ? stored : 'day';
};

export const appBadgeCountForState = (
  role: Role | undefined,
  events: VerificationEvent[],
  now = Date.now(),
) => role === 'child'
  ? events.filter((event) => event.status === 'pending' && Date.parse(event.expiresAt) > now).length
  : 0;

export const resetNoticeMessageKey = (role: Role | undefined): MessageKey =>
  role === 'parent' ? 'resetNoticeParent' : 'resetNoticeChild';

export const isParticipantInvitationCode = (code: string) => /^ZI-\d{6}$/.test(code.trim().toUpperCase());

export const documentLanguageForLocale = (locale: Locale) => documentLanguage(locale);

export const syncStatusFor = (online: boolean, pendingOperations: number, failed: boolean): SyncStatus => {
  if (!online) return 'offline';
  if (pendingOperations > 0) return 'syncing';
  return failed ? 'failed' : 'synced';
};

export const syncStatusIsVisible = (status: SyncStatus, recentSuccess: boolean) =>
  status !== 'synced' || recentSuccess;

export const setupCompletionTransition = (
  previous: boolean | undefined,
  state: Pick<AppState, 'role' | 'family' | 'notificationsEnabled' | 'routineAssignments' | 'routinesLoaded'>,
): { complete: boolean | undefined; noticeKey?: MessageKey } => {
  if (!state.role || (state.role === 'parent' && state.routinesLoaded === false)) return { complete: previous };
  const complete = state.role === 'parent'
    ? state.family.linked && state.family.childLinked && state.routineAssignments.length > 0
    : state.family.linked && state.notificationsEnabled;
  return {
    complete,
    ...(previous === false && complete
      ? { noticeKey: state.role === 'parent' ? 'parentSetupComplete' : 'participantSetupComplete' }
      : {}),
  };
};

export const participantIdForNotificationLaunch = (
  state: AppState,
  intent = notificationLaunchIntent(),
) => intent
  && state.role === 'parent'
  && state.participantAccess?.some((entry) => (
    entry.participant.id === intent.participantId && entry.membership.status === 'active'
  ))
  ? intent.participantId
  : undefined;

export function App() {
  const repository = useMemo(createRepository, []);
  const [state, setState] = useState(repository.snapshot());
  const [route, setRoute] = useState<AppRoute>(() => routeForState(state, browserRouteContext()));
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState(false);
  const [splashProgress, setSplashProgress] = useState(40);
  const [splashMessage, setSplashMessage] = useState<MessageKey>('splashLoading');
  const [tab, setTab] = useState<Tab>('home');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerificationEvent>();
  const [submitError, setSubmitError] = useState<string>();
  const [resetNoticeKey, setResetNoticeKey] = useState<MessageKey>();
  const [setupNoticeKey, setSetupNoticeKey] = useState<MessageKey>();
  const setupCompleteRef = useRef<boolean | undefined>(undefined);
  const [savingRoutineId, setSavingRoutineId] = useState<string>();
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [focusedHistoryEventId, setFocusedHistoryEventId] = useState<string>();
  const [lastSyncAt, setLastSyncAt] = useState<string>();
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendingSyncOperations, setPendingSyncOperations] = useState(0);
  const [syncFailed, setSyncFailed] = useState(false);
  const [syncConfirmationSequence, setSyncConfirmationSequence] = useState(0);
  const [syncConfirmationVisible, setSyncConfirmationVisible] = useState(false);
  const [invitationNeedsAccountName, setInvitationNeedsAccountName] = useState(false);
  const [pendingInvitationCode, setPendingInvitationCode] = useState(captureRelationshipInvitationCode);
  const [dashboardSummaryRange, setDashboardSummaryRange] = useState<SummaryRange>(readDashboardSummaryRange);
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState<'unsupported' | 'registered' | 'notRegistered'>(
    () => ('serviceWorker' in navigator ? 'notRegistered' : 'unsupported'),
  );
  const useLocalDemo = isLocalDemoEnvironment();
  const t = createTranslator(state.locale);
  const preferences = normalizeAppPreferences(state.preferences);
  const {
    appUpdateInfo,
    applySnackbarUpdate,
    dismissUpdate,
    forceAppUpdate,
    mandatoryUpdate,
    refreshAppUpdateInfo,
    resetDismissedUpdate,
    showUpdateSnackbar,
    updateActionBusy,
    updateSnackbarId,
  } = useAppUpdateController(ready);

  useEffect(() => {
    document.documentElement.lang = documentLanguageForLocale(state.locale);
  }, [state.locale]);

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  useEffect(() => {
    if (!syncConfirmationSequence) return;
    setSyncConfirmationVisible(true);
    const timeout = window.setTimeout(() => setSyncConfirmationVisible(false), 2_000);
    return () => window.clearTimeout(timeout);
  }, [syncConfirmationSequence]);

  useEffect(() => {
    if (state.accessStatus === 'suspended') setRoute('suspended');
  }, [state.accessStatus]);

  useEffect(() => {
    writeUiStorageString(DASHBOARD_SUMMARY_RANGE_KEY, dashboardSummaryRange);
  }, [dashboardSummaryRange]);

  useEffect(() => {
    if (!ready || !state.role) return;
    const transition = setupCompletionTransition(setupCompleteRef.current, state);
    if (transition.noticeKey) setSetupNoticeKey(transition.noticeKey);
    setupCompleteRef.current = transition.complete;
  }, [ready, state.family.childLinked, state.family.linked, state.notificationsEnabled, state.role, state.routineAssignments.length, state.routinesLoaded]);

  useEffect(() => {
    if (!ready || !firebaseEnabled || !state.family.id || !state.role) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    let cancelled = false;
    runWhenStartupIsIdle(() => {
      void import('./services/webPush').then(async ({ WebPushGateway }) => {
        const subscription = await new WebPushGateway().subscribe();
        if (!cancelled) await repository.savePushSubscription(subscription.toJSON());
      }).catch((error) => console.error('Unable to restore push subscription', error));
    });
    return () => { cancelled = true; };
  }, [ready, repository, state.family.id, state.role]);

  useEffect(() => {
    let alive = true;
    const syncFromRepository = () => {
      setState(repository.snapshot());
      setLastSyncAt(new Date().toISOString());
    };
    const unsubscribe = repository.subscribe(syncFromRepository);
    const startupProgressTicker = window.setInterval(() => {
      if (!alive) return;
      setSplashProgress((current) => {
        const ceiling = 94;
        if (current >= ceiling) return current;
        const remaining = ceiling - current;
        const step = remaining > 30 ? 8 : remaining > 16 ? 4 : 1.8;
        return Math.min(ceiling, Number((current + step).toFixed(1)));
      });
    }, 80);
    const setStartupStep = (progress: number, message: MessageKey) => {
      if (!alive) return;
      setSplashProgress(progress);
      setSplashMessage(message);
    };
    const checkForAppUpdate = async () => {
      try {
        await refreshAppUpdateInfo(() => alive);
      } catch (error) {
        console.error(error);
      }
    };
    repository.initialize().then(async () => {
      if (!alive) return;
      window.clearInterval(startupProgressTicker);
      let restored = repository.snapshot();
      const notificationParticipantId = participantIdForNotificationLaunch(restored);
      if (notificationParticipantId && repository.selectActiveParticipant) {
        await repository.selectActiveParticipant(notificationParticipantId);
        if (!alive) return;
        restored = repository.snapshot();
        setTab('home');
      }
      setState(restored);
      setLastSyncAt(new Date().toISOString());
      setRoute(routeForState(restored, browserRouteContext()));
      setStartupStep(100, 'splashFinalizing');
      setStartupError(false);
      setReady(true);
      runWhenStartupIsIdle(() => {
        void checkForAppUpdate();
      });
    }).catch((error) => {
      console.error(error);
      if (!alive) return;
      window.clearInterval(startupProgressTicker);
      setSplashProgress(100);
      setSplashMessage('startupRestoreError');
      setStartupError(true);
    });
    return () => {
      alive = false;
      window.clearInterval(startupProgressTicker);
      unsubscribe();
    };
  }, [repository, refreshAppUpdateInfo]);

  useEffect(() => {
    let alive = true;
    const refreshServiceWorkerStatus = async () => {
      if (!('serviceWorker' in navigator)) {
        setServiceWorkerStatus('unsupported');
        return;
      }
      const registration = await navigator.serviceWorker.getRegistration().catch(() => undefined);
      if (!alive) return;
      setServiceWorkerStatus(registration ? 'registered' : 'notRegistered');
    };
    void refreshServiceWorkerStatus();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const pendingCount = appBadgeCountForState(state.role, state.events);
    if (!appBadgeApi.setAppBadge || !appBadgeApi.clearAppBadge) return;
    void (pendingCount > 0 ? appBadgeApi.setAppBadge(pendingCount) : appBadgeApi.clearAppBadge()).catch(console.error);
  }, [state.events, state.role]);

  const sync = () => setState(repository.snapshot());
  const runRepositoryAction = async <TArgs extends unknown[], TResult>(
    action: (...args: TArgs) => Promise<TResult>,
    args: TArgs,
  ): Promise<TResult> => {
    setPendingSyncOperations((count) => count + 1);
    setSyncFailed(false);
    try {
      const result = await action.apply(repository, args);
      sync();
      setLastSyncAt(new Date().toISOString());
      setSyncConfirmationSequence((sequence) => sequence + 1);
      return result;
    } catch (error) {
      setSyncFailed(true);
      throw error;
    } finally {
      setPendingSyncOperations((count) => Math.max(0, count - 1));
    }
  };
  const withRepositorySync = <TArgs extends unknown[], TResult>(
    action: (...args: TArgs) => Promise<TResult>,
  ) => (...args: TArgs): Promise<TResult> => runRepositoryAction(action, args);
  const withOptionalRepositorySync = <TArgs extends unknown[], TResult>(
    action: ((...args: TArgs) => Promise<TResult>) | undefined,
  ) => action ? withRepositorySync(action) : undefined;
  const withRepositorySyncVoid = <TArgs extends unknown[]>(
    action: (...args: TArgs) => Promise<unknown>,
  ) => async (...args: TArgs): Promise<void> => {
    await runRepositoryAction(action, args);
  };
  const bindOptionalRepository = <TArgs extends unknown[], TResult>(
    action: ((...args: TArgs) => Promise<TResult>) | undefined,
  ) => action ? withRepositorySync(action) : undefined;
  const syncLocale = withRepositorySync(repository.setLocale);
  const selectActiveParticipant = withOptionalRepositorySync(repository.selectActiveParticipant);
  const selectRole = async (role: Role) => {
    await repository.selectRole(role);
    sync();
    setRoute('link');
  };
  const registerContactEmail = async (email: string) => {
    if (!repository.registerContactEmail) return;
    await repository.registerContactEmail(email);
    sync();
    setRoute(routeForState(repository.snapshot(), browserRouteContext()));
  };

  const submit = async (capturedAt: Date, imageDataUrl: string) => {
    const session = selectedSessionId
      ? state.events.find((event) => event.sessionId === selectedSessionId)
      : repository.activeSession();
    if (!session) return;
    setSubmitError(undefined);
    setBusy(true);
    try {
      const event = await runRepositoryAction(repository.submitCapture, [session.sessionId, capturedAt, imageDataUrl]);
      setResult(event);
      setSelectedSessionId(undefined);
      setRoute('result');
    } catch (error) {
      console.error(error);
      setSubmitError(t(selectedSessionId ? 'retakeProofError' : 'requestCheckError'));
    } finally {
      setBusy(false);
    }
  };

  const startCapture = (event?: VerificationEvent) => {
    setSelectedSessionId(event?.sessionId);
    setRoute('camera');
  };
  const retryCapture = (event: VerificationEvent) => {
    setResult(undefined);
    startCapture(event);
  };
  const openHistoryEvent = (event: VerificationEvent) => {
    if (!state.routineAssignments.some((assignment) => assignment.routineId === event.routineId)) return;
    setFocusedHistoryEventId(event.id);
    setTab('routines');
  };
  const openNotificationEvent = async (participantId: string, event: VerificationEvent) => {
    if (participantId !== state.activeParticipantId) {
      if (!selectActiveParticipant) return;
      await selectActiveParticipant(participantId);
    }
    const selectedState = repository.snapshot();
    if (selectedState.role === 'child' && event.status === 'pending' && Date.parse(event.expiresAt) > Date.now()) {
      startCapture(event);
      return;
    }
    setFocusedHistoryEventId(event.id);
    setTab('routines');
    setRoute('app');
  };

  const reset = async () => {
    const previousRole = state.role;
    await repository.reset();
    await cleanupClientAfterReset();
    sync();
    setResult(undefined);
    setSubmitError(undefined);
    setSelectedSessionId(undefined);
    setFocusedHistoryEventId(undefined);
    setSavingRoutineId(undefined);
    resetDismissedUpdate();
    setResetNoticeKey(resetNoticeMessageKey(previousRole));
    setRoute('welcome');
    setTab('home');
  };

  const enableNotifications = async () => {
    if (!firebaseEnabled) {
      await repository.savePushSubscription({ endpoint: 'local-demo' } as PushSubscriptionJSON);
      return;
    }
    const { PushSetupError, WebPushGateway } = await import('./services/webPush');
    const push = new WebPushGateway();
    const permission = await push.permission();
    if (permission === 'denied') throw new PushSetupError('notification_permission_denied');
    if (permission !== 'granted') throw new PushSetupError('notification_permission_reset');
    const subscription = await push.subscribe();
    await repository.savePushSubscription(subscription.toJSON());
  };
  const updateSnackbarMessage = appUpdateInfo.severity === 'major'
    ? t('snackbarUpdateMajorAvailable')
    : appUpdateInfo.severity === 'minor'
      ? t('snackbarUpdateMinorAvailable')
      : t('snackbarUpdateAvailable');
  const completeRelationshipInvitation = () => {
    const restored = repository.snapshot();
    clearRelationshipInvitationUrl();
    setPendingInvitationCode(undefined);
    setInvitationNeedsAccountName(false);
    setRoute(restored.role === 'child' && !restored.notificationsEnabled && !useLocalDemo ? 'notifications' : 'app');
  };

  if (startupError) {
    return (
      <main className="page startup-recovery-page">
        <section className="startup-recovery-card" aria-live="polite">
          <img src="/icons/icon-192.png" alt="" />
          <p className="eyebrow">{t('startupRestoreEyebrow')}</p>
          <h1>{t('startupRestoreTitle')}</h1>
          <p>{t('startupRestoreBody')}</p>
          <button type="button" className="primary-action-button startup-recovery-action" onClick={() => window.location.reload()}>
            {t('startupRestoreRetry')}
          </button>
        </section>
      </main>
    );
  }

  if (!ready) {
    return <SplashScreen progress={splashProgress} message={t(splashMessage)} />;
  }

  let content: React.ReactNode;
  if (route === 'install') {
    content = (
      <InstallScreen
        locale={state.locale}
        setLocale={(locale) => { void syncLocale(locale); }}
        t={t}
      />
    );
  } else if (route === 'contact') {
    content = <ContactEmailScreen locale={state.locale} setLocale={(locale) => { void syncLocale(locale); }} submit={registerContactEmail} t={t} />;
  } else if (route === 'suspended') {
    content = <SuspendedScreen t={t} />;
  } else if (route === 'invitation' && pendingInvitationCode) {
    content = <InvitationScreen
      code={pendingInvitationCode}
      accountNameRequired={invitationNeedsAccountName}
      accept={async () => {
        if (!repository.acceptParticipantInvitation) throw new Error('participant_invitation_unavailable');
        await runRepositoryAction(repository.acceptParticipantInvitation, [pendingInvitationCode]);
        if (!repository.snapshot().accountDisplayName && repository.updateAccountProfile) setInvitationNeedsAccountName(true);
        else completeRelationshipInvitation();
      }}
      saveAccountName={async (name) => {
        if (!repository.updateAccountProfile) throw new Error('account_profile_unavailable');
        await runRepositoryAction(repository.updateAccountProfile, [name]);
        completeRelationshipInvitation();
      }}
      cancel={() => {
        clearRelationshipInvitationUrl();
        setPendingInvitationCode(undefined);
        setInvitationNeedsAccountName(false);
        setRoute(routeForState(repository.snapshot(), browserRouteContext()));
      }}
      t={t}
    />;
  } else if (route === 'welcome') {
    content = (
      <WelcomeScreen
        locale={state.locale}
        setLocale={(locale) => { void syncLocale(locale); }}
        chooseRole={selectRole}
        t={t}
      />
    );
  } else if (route === 'link' && state.role) {
    content = (
      <LinkScreen
        role={state.role}
        code={state.family.linkingCode}
        childName={state.family.childName}
        back={() => setRoute('welcome')}
        onParentLink={async (name) => { await repository.linkParent(name); sync(); setTab('home'); setRoute('app'); }}
        onParentRecover={async (code) => { await repository.recoverParent(code); sync(); setRoute('app'); }}
        onChildLink={async (code) => {
          if (isParticipantInvitationCode(code) && repository.acceptParticipantInvitation) {
            await repository.acceptParticipantInvitation(code);
          } else {
            await repository.linkChild(code);
          }
          sync();
          setRoute(useLocalDemo ? 'app' : 'notifications');
        }}
        t={t}
      />
    );
  } else if (route === 'notifications') {
    content = (
      <NotificationSetupScreen
        complete={() => { sync(); setRoute('app'); }}
        enableNotifications={enableNotifications}
        t={t}
      />
    );
  } else if (route === 'camera') {
    content = <CameraScreen busy={busy} submitError={submitError} back={() => { setSelectedSessionId(undefined); setRoute('app'); }} submit={submit} t={t} />;
  } else if (route === 'result' && result) {
    const canRetake = canRetakeCapture(result, state.events);
    content = <ResultScreen event={result} retake={canRetake ? () => retryCapture(result) : undefined} done={() => { setResult(undefined); setRoute('app'); }} t={t} />;
  } else {
    const role = state.role ?? 'child';
    const syncStatus = syncStatusFor(online, pendingSyncOperations, syncFailed);
    const retrySync = repository.retryRemoteSync
      ? () => runRepositoryAction(repository.retryRemoteSync!, [])
      : undefined;
    const activeParticipant = state.participantAccess?.find((entry) => entry.participant.id === state.activeParticipantId)?.participant
      ?? state.participantAccess?.find((entry) => entry.membership.status === 'active')?.participant;
    const activeProfileColor = activeParticipant ? profileColorFor(activeParticipant) : undefined;
    const canManageRoutines = role === 'parent';
    const screen = tab === 'history'
      ? <HistoryScreen events={state.events} locale={state.locale} t={t} />
      : routineCentricUiEnabled && tab === 'routines'
        ? <RoutinesScreen
            state={state}
            start={role === 'child' ? () => startCapture() : undefined}
            edit={canManageRoutines}
            requestCheck={canManageRoutines ? withRepositorySync(repository.requestCheckNow) : undefined}
            getProofImageUrl={(eventId) => repository.getProofImageUrl(eventId)}
            onAssignRoutine={canManageRoutines ? withRepositorySync(repository.assignRoutine) : undefined}
            onDeleteRoutine={canManageRoutines ? withRepositorySync(repository.deleteRoutine) : undefined}
            onRetryRoutines={withOptionalRepositorySync(repository.retryRemoteSync)}
            onSelectParticipant={selectActiveParticipant}
            onSaveMonitoringPlan={canManageRoutines ? async (routineId, plan, validationMode) => {
              setSavingRoutineId(routineId);
              try {
                await repository.updateRoutine(routineId, plan, validationMode);
                sync();
              } catch (error) {
                console.error('Update routine error:', error);
                throw error;
              } finally {
                setSavingRoutineId(undefined);
              }
            } : undefined}
            savingRoutineId={savingRoutineId}
            focusedEventId={focusedHistoryEventId}
            onFocusedEventConsumed={() => setFocusedHistoryEventId(undefined)}
            t={t}
          />
      : tab === 'settings'
        ? <SettingsScreen
            notificationsEnabled={state.notificationsEnabled}
            pushHealth={state.pushHealth}
            preferences={preferences}
            setPreferences={withRepositorySync(repository.setPreferences)}
            enableNotifications={withRepositorySync(enableNotifications)}
            sendTestPushNotification={withRepositorySync(repository.sendTestPushNotification)}
            childInstalled={state.family.childLinked}
            familyId={state.family.id}
            events={state.events}
            pendingChecks={state.events.filter((event) => event.status === 'pending' && Date.parse(event.expiresAt) > Date.now()).length}
            totalChecks={state.events.length}
            serviceWorkerStatus={serviceWorkerStatus}
            lastSyncAt={lastSyncAt}
            syncStatus={syncStatus}
            retrySync={retrySync}
            participantAccess={state.participantAccess}
            activeParticipantId={state.activeParticipantId}
            accountDisplayName={state.accountDisplayName}
            updateAccountProfile={withOptionalRepositorySync(repository.updateAccountProfile)}
            updateParticipantColor={withOptionalRepositorySync(repository.updateParticipantColor)}
            selectParticipant={selectActiveParticipant}
            createParticipant={withOptionalRepositorySync(repository.createParticipant)}
            inviteParticipantMember={bindOptionalRepository(repository.inviteParticipantMember)}
            acceptParticipantInvitation={withOptionalRepositorySync(repository.acceptParticipantInvitation)}
            leaveParticipant={withOptionalRepositorySync(repository.leaveParticipant)}
            removeParticipantMember={withOptionalRepositorySync(repository.removeParticipantMember)}
            deleteParticipant={withOptionalRepositorySync(repository.deleteParticipant)}
            createRelationshipRecovery={bindOptionalRepository(repository.createRelationshipRecovery)}
            recoverRelationship={withOptionalRepositorySync(repository.recoverRelationship)}
            locale={state.locale}
            setLocale={syncLocale}
            updateInfo={appUpdateInfo}
            forceAppUpdate={forceAppUpdate}
            reset={reset}
            role={role}
            t={t}
          />
        : role === 'parent'
          ? <ParentDashboard
              state={state}
              regenerateCode={withRepositorySync(repository.regenerateLinkCode)}
              onCreateRoutine={() => setTab('routines')}
              getProofImageUrl={(eventId) => repository.getProofImageUrl(eventId)}
              reviewCheck={withRepositorySyncVoid(repository.reviewCheck)}
              requestCheck={withRepositorySync(repository.requestCheckNow)}
              summaryRange={dashboardSummaryRange}
              onSummaryRangeChange={setDashboardSummaryRange}
              onSelectParticipant={selectActiveParticipant}
              onOpenHistoryEvent={openHistoryEvent}
              onOpenNotificationEvent={(participantId, event) => { void openNotificationEvent(participantId, event); }}
              t={t}
            />
          : <ChildDashboard
              state={state}
              active={repository.activeSession()}
              start={startCapture}
              retake={retryCapture}
              summaryRange={dashboardSummaryRange}
              onSummaryRangeChange={setDashboardSummaryRange}
              onOpenHistoryEvent={openHistoryEvent}
              onOpenNotificationEvent={(participantId, event) => { void openNotificationEvent(participantId, event); }}
              t={t}
            />;
    content = (
      <PullToUpdate
        onHorizontalSwipe={(direction) => setTab((current) => tabAfterSwipe(navigationTabs(role, routineCentricUiEnabled), current, direction))}
        onUpdate={forceAppUpdate}
        t={t}
      >
        {screen}
        {syncStatusIsVisible(syncStatus, syncConfirmationVisible) ? (
          <div className={`global-sync-status ${syncStatus}`} role="status" aria-live="polite">
            <span aria-hidden="true" />
            <strong>{t(syncStatusMessageKeys[syncStatus])}</strong>
            {(syncStatus === 'failed' || syncStatus === 'offline') && retrySync ? (
              <button type="button" disabled={!online} onClick={() => { void retrySync(); }}>{t('retryNow')}</button>
            ) : null}
          </div>
        ) : null}
        <BottomNav
          tab={tab}
          role={role}
          routineCentricEnabled={routineCentricUiEnabled}
          profileColor={activeProfileColor}
          onChange={setTab}
          t={t}
        />
      </PullToUpdate>
    );
  }

  return (
    <>
      <Suspense fallback={<SplashScreen progress={ready ? 96 : splashProgress} message={t(ready ? 'splashFinalizing' : splashMessage)} />}>
        {content}
      </Suspense>
      <div className="orientation-lock-screen" role="status" aria-live="polite">
        <img src="/icons/icon-192.png" alt="" />
        <strong>{t('orientationLockTitle')}</strong>
        <span>{t('orientationLockBody')}</span>
      </div>
      {showUpdateSnackbar && updateSnackbarId ? (
        <Snackbar
          message={updateSnackbarMessage}
          actionLabel={t('settingsUpdateAction')}
          onAction={() => { void applySnackbarUpdate(); }}
          closeLabel={mandatoryUpdate ? undefined : t('close')}
          onClose={mandatoryUpdate ? undefined : () => dismissUpdate(updateSnackbarId)}
          busy={updateActionBusy}
        />
      ) : null}
      {resetNoticeKey ? (
        <Snackbar
          message={t(resetNoticeKey)}
          closeLabel={t('close')}
          onClose={() => setResetNoticeKey(undefined)}
        />
      ) : null}
      {setupNoticeKey ? (
        <Snackbar
          message={t(setupNoticeKey)}
          closeLabel={t('close')}
          onClose={() => setSetupNoticeKey(undefined)}
        />
      ) : null}
    </>
  );
}
