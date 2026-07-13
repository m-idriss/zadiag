import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from 'react';
import { normalizeAppPreferences, type Locale, type Role, type VerificationEvent } from './domain/models';
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
import { browserRouteContext, isLocalDemoEnvironment, routineCentricUiEnabled } from './services/browserEnvironment';
import { runWhenStartupIsIdle } from './services/appUpdate';
import { InstallScreen } from './screens/InstallScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { ChildDashboard } from './screens/ChildDashboard';
import { canRetakeCapture } from './domain/adherence';
import { profileColorFor } from './domain/profileColor';
import { cleanupClientAfterReset } from './services/resetCleanup';
import { readUiStorageString, writeUiStorageString } from './services/uiStorage';
import { useAppUpdateController } from './hooks/useAppUpdateController';

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

const appBadgeApi = navigator as Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

const DASHBOARD_SUMMARY_RANGE_KEY = 'zadiag.dashboard.summaryRange';

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
  const [savingRoutineId, setSavingRoutineId] = useState<string>();
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [focusedHistoryEventId, setFocusedHistoryEventId] = useState<string>();
  const [lastSyncAt, setLastSyncAt] = useState<string>();
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
    writeUiStorageString(DASHBOARD_SUMMARY_RANGE_KEY, dashboardSummaryRange);
  }, [dashboardSummaryRange]);

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
    repository.initialize().then(() => {
      if (!alive) return;
      window.clearInterval(startupProgressTicker);
      const restored = repository.snapshot();
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
  const selectRole = async (role: Role) => {
    await repository.selectRole(role);
    sync();
    setRoute('link');
  };

  const submit = async (capturedAt: Date, imageDataUrl: string) => {
    const session = selectedSessionId
      ? state.events.find((event) => event.sessionId === selectedSessionId)
      : repository.activeSession();
    if (!session) return;
    setSubmitError(undefined);
    setBusy(true);
    try {
      const event = await repository.submitCapture(session.sessionId, capturedAt, imageDataUrl);
      sync();
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
        setLocale={(locale) => { void repository.setLocale(locale).then(sync); }}
        t={t}
      />
    );
  } else if (route === 'welcome') {
    content = (
      <WelcomeScreen
        locale={state.locale}
        setLocale={(locale) => { void repository.setLocale(locale).then(sync); }}
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
            requestCheck={canManageRoutines ? async (routineId) => { await repository.requestCheckNow(routineId); sync(); } : undefined}
            getProofImageUrl={(eventId) => repository.getProofImageUrl(eventId)}
            onAssignRoutine={canManageRoutines ? async (routineId) => { await repository.assignRoutine(routineId); sync(); } : undefined}
            onDeleteRoutine={canManageRoutines ? async (routineId) => { await repository.deleteRoutine(routineId); sync(); } : undefined}
            onRetryRoutines={repository.retryRemoteSync ? async () => { await repository.retryRemoteSync?.(); sync(); } : undefined}
            onSelectParticipant={repository.selectActiveParticipant
              ? (participantId) => { void repository.selectActiveParticipant?.(participantId).then(sync); }
              : undefined}
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
            setPreferences={async (nextPreferences) => { await repository.setPreferences(nextPreferences); sync(); }}
            enableNotifications={async () => { await enableNotifications(); sync(); }}
            sendTestPushNotification={async () => { await repository.sendTestPushNotification(); sync(); }}
            childInstalled={state.family.childLinked}
            familyId={state.family.id}
            events={state.events}
            pendingChecks={state.events.filter((event) => event.status === 'pending' && Date.parse(event.expiresAt) > Date.now()).length}
            totalChecks={state.events.length}
            serviceWorkerStatus={serviceWorkerStatus}
            lastSyncAt={lastSyncAt}
            participantAccess={state.participantAccess}
            activeParticipantId={state.activeParticipantId}
            accountDisplayName={state.accountDisplayName}
            updateAccountProfile={repository.updateAccountProfile ? async (displayName) => { const name = await repository.updateAccountProfile!(displayName); sync(); return name; } : undefined}
            updateParticipantColor={repository.updateParticipantColor ? async (participantId, profileColor) => { const color = await repository.updateParticipantColor!(participantId, profileColor); sync(); return color; } : undefined}
            selectParticipant={repository.selectActiveParticipant ? async (participantId) => { await repository.selectActiveParticipant?.(participantId); sync(); } : undefined}
            createParticipant={repository.createParticipant ? async (displayName, selfManaged) => { const id = await repository.createParticipant?.(displayName, selfManaged); sync(); return id!; } : undefined}
            inviteParticipantMember={repository.inviteParticipantMember ? (participantId, membershipRole) => repository.inviteParticipantMember!(participantId, membershipRole) : undefined}
            acceptParticipantInvitation={repository.acceptParticipantInvitation ? async (code) => { const id = await repository.acceptParticipantInvitation?.(code); sync(); return id!; } : undefined}
            leaveParticipant={repository.leaveParticipant ? async (participantId) => { await repository.leaveParticipant?.(participantId); sync(); } : undefined}
            removeParticipantMember={repository.removeParticipantMember ? async (participantId, targetUid) => { const members = await repository.removeParticipantMember?.(participantId, targetUid); sync(); return members ?? []; } : undefined}
            deleteParticipant={repository.deleteParticipant ? async (participantId) => { await repository.deleteParticipant?.(participantId); sync(); } : undefined}
            createRelationshipRecovery={repository.createRelationshipRecovery ? (participantId) => repository.createRelationshipRecovery!(participantId) : undefined}
            recoverRelationship={repository.recoverRelationship ? async (code) => { const recovered = await repository.recoverRelationship!(code); sync(); return recovered; } : undefined}
            locale={state.locale}
            setLocale={async (locale) => { await repository.setLocale(locale); sync(); }}
            updateInfo={appUpdateInfo}
            forceAppUpdate={forceAppUpdate}
            reset={() => { void reset(); }}
            role={role}
            t={t}
          />
        : role === 'parent'
          ? <ParentDashboard
              state={state}
              regenerateCode={async () => { await repository.regenerateLinkCode(); sync(); }}
              onCreateRoutine={() => setTab('routines')}
              getProofImageUrl={(eventId) => repository.getProofImageUrl(eventId)}
              reviewCheck={async (eventId, decision) => { await repository.reviewCheck(eventId, decision); sync(); }}
              requestCheck={async (routineId) => { await repository.requestCheckNow(routineId); sync(); }}
              summaryRange={dashboardSummaryRange}
              onSummaryRangeChange={setDashboardSummaryRange}
              onSelectParticipant={repository.selectActiveParticipant
                ? (participantId) => { void repository.selectActiveParticipant?.(participantId).then(sync); }
                : undefined}
              onOpenHistoryEvent={openHistoryEvent}
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
              t={t}
            />;
    content = (
      <PullToUpdate
        onHorizontalSwipe={(direction) => setTab((current) => tabAfterSwipe(navigationTabs(role, routineCentricUiEnabled), current, direction))}
        onUpdate={forceAppUpdate}
        t={t}
      >
        {screen}
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
    </>
  );
}
