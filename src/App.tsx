import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from 'react';
import { IonApp } from '@ionic/react';
import { normalizeAppPreferences, type Role, type VerificationEvent } from './domain/models';
import { routeForState, type AppRoute } from './domain/appRouting';
import { createRepository } from './services/repositoryFactory';
import { translate, type MessageKey } from './services/i18n';
import { BottomNav, type Tab } from './components/BottomNav';
import { SplashScreen } from './components/SplashScreen';
import { Snackbar } from './components/Snackbar';
import { PushSetupError, WebPushGateway } from './services/webPush';
import { firebaseEnabled } from './services/firebaseConfig';
import { browserRouteContext, isLocalDemoEnvironment, routineCentricUiEnabled } from './services/browserEnvironment';
import { describeAppUpdate, fetchLatestAppVersion, refreshServiceWorkerRegistration, runWhenStartupIsIdle, type AppUpdateInfo } from './services/appUpdate';
import { InstallScreen } from './screens/InstallScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { ChildDashboard } from './screens/ChildDashboard';
import { canRetakeCapture } from './domain/adherence';
import { cleanupClientAfterReset } from './services/resetCleanup';

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

export const appBadgeCountForState = (
  role: Role | undefined,
  events: VerificationEvent[],
  now = Date.now(),
) => role === 'child'
  ? events.filter((event) => event.status === 'pending' && Date.parse(event.expiresAt) > now).length
  : 0;

export const resetNoticeMessageKey = (role: Role | undefined): MessageKey =>
  role === 'parent' ? 'resetNoticeParent' : 'resetNoticeChild';

export function App() {
  const repository = useMemo(createRepository, []);
  const [state, setState] = useState(repository.snapshot());
  const [route, setRoute] = useState<AppRoute>(() => routeForState(state, browserRouteContext()));
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState(false);
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateInfo>(() => ({
    available: false,
    currentVersion: import.meta.env.VITE_APP_VERSION,
    severity: 'unknown',
  }));
  const [splashProgress, setSplashProgress] = useState(40);
  const [splashMessage, setSplashMessage] = useState<MessageKey>('splashLoading');
  const [tab, setTab] = useState<Tab>('home');
  const [busy, setBusy] = useState(false);
  const [updateActionBusy, setUpdateActionBusy] = useState(false);
  const [dismissedUpdateId, setDismissedUpdateId] = useState<string>();
  const [result, setResult] = useState<VerificationEvent>();
  const [submitError, setSubmitError] = useState<string>();
  const [resetNoticeKey, setResetNoticeKey] = useState<MessageKey>();
  const [savingRoutineId, setSavingRoutineId] = useState<string>();
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const [lastSyncAt, setLastSyncAt] = useState<string>();
  const [serviceWorkerStatus, setServiceWorkerStatus] = useState<'unsupported' | 'registered' | 'notRegistered'>(
    () => ('serviceWorker' in navigator ? 'notRegistered' : 'unsupported'),
  );
  const useLocalDemo = isLocalDemoEnvironment();
  const t = (key: MessageKey) => translate(state.locale, key);
  const preferences = normalizeAppPreferences(state.preferences);
  const appRootClassName = 'app-root app-compact';

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
  }, [repository]);

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

  const reset = async () => {
    const previousRole = state.role;
    await repository.reset();
    await cleanupClientAfterReset();
    sync();
    setResult(undefined);
    setSubmitError(undefined);
    setSelectedSessionId(undefined);
    setSavingRoutineId(undefined);
    setDismissedUpdateId(undefined);
    setResetNoticeKey(resetNoticeMessageKey(previousRole));
    setRoute('welcome');
    setTab('home');
  };

  const enableNotifications = async () => {
    if (!firebaseEnabled) {
      await repository.savePushSubscription({ endpoint: 'local-demo' } as PushSubscriptionJSON);
      return;
    }
    const push = new WebPushGateway();
    const permission = await push.permission();
    if (permission === 'denied') throw new PushSetupError('notification_permission_denied');
    if (permission !== 'granted') throw new PushSetupError('notification_permission_reset');
    const subscription = await push.subscribe();
    await repository.savePushSubscription(subscription.toJSON());
  };
  const refreshAppUpdateInfo = async (shouldApply: () => boolean = () => true): Promise<ServiceWorkerRegistration | undefined> => {
    const [registration, latestVersion] = await Promise.all([
      refreshServiceWorkerRegistration(),
      fetchLatestAppVersion().catch((error) => {
        console.error(error);
        return undefined;
      }),
    ]);
    const versionUpdate = describeAppUpdate(import.meta.env.VITE_APP_VERSION, latestVersion);
    const waiting = Boolean(registration?.waiting);
    if (!shouldApply()) return registration;
    setAppUpdateInfo(versionUpdate ?? {
      available: waiting,
      currentVersion: import.meta.env.VITE_APP_VERSION,
      latestVersion,
      severity: waiting ? 'unknown' : 'patch',
    });
    return registration;
  };
  const forceAppUpdate = async (): Promise<boolean> => {
    const registration = await refreshAppUpdateInfo();
    if (!registration?.waiting) return false;
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 1500);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
    });
    window.location.reload();
    return true;
  };
  const updateSnackbarId = appUpdateInfo.available
    ? appUpdateInfo.latestVersion ?? appUpdateInfo.badgeLabel ?? 'waiting-service-worker'
    : undefined;
  const updateSnackbarMessage = appUpdateInfo.severity === 'major'
    ? t('snackbarUpdateMajorAvailable')
    : appUpdateInfo.severity === 'minor'
      ? t('snackbarUpdateMinorAvailable')
      : t('snackbarUpdateAvailable');
  const showUpdateSnackbar = Boolean(ready && appUpdateInfo.available && updateSnackbarId && dismissedUpdateId !== updateSnackbarId);
  const applySnackbarUpdate = async () => {
    setUpdateActionBusy(true);
    try {
      await forceAppUpdate();
    } catch (error) {
      console.error(error);
    } finally {
      setUpdateActionBusy(false);
    }
  };

  if (startupError) {
    return (
      <IonApp className={appRootClassName}>
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
      </IonApp>
    );
  }

  if (!ready) {
    return (
      <IonApp className={appRootClassName}>
        <SplashScreen progress={splashProgress} message={t(splashMessage)} />
      </IonApp>
    );
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
        onChildLink={async (code) => { await repository.linkChild(code); sync(); setRoute(useLocalDemo ? 'app' : 'notifications'); }}
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
    const screen = tab === 'history'
      ? <HistoryScreen events={state.events} locale={state.locale} t={t} />
      : routineCentricUiEnabled && tab === 'routines'
        ? <RoutinesScreen
            state={state}
            start={role === 'child' ? () => startCapture() : undefined}
            edit
            requestCheck={role === 'parent' ? async (routineId) => { await repository.requestCheckNow(routineId); sync(); } : undefined}
            getProofImageUrl={(eventId) => repository.getProofImageUrl(eventId)}
            onAssignRoutine={async (routineId) => { await repository.assignRoutine(routineId); sync(); }}
            onDeleteRoutine={async (routineId) => { await repository.deleteRoutine(routineId); sync(); }}
            onRetryRoutines={repository.retryRemoteSync ? async () => { await repository.retryRemoteSync?.(); sync(); } : undefined}
            onSaveMonitoringPlan={async (routineId, plan, validationMode) => {
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
            }}
            savingRoutineId={savingRoutineId}
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
            childLinkingCode={state.family.linkingCode}
            parentRecoveryCode={state.family.parentRecoveryCode}
            pendingChecks={state.events.filter((event) => event.status === 'pending' && Date.parse(event.expiresAt) > Date.now()).length}
            totalChecks={state.events.length}
            serviceWorkerStatus={serviceWorkerStatus}
            lastSyncAt={lastSyncAt}
            regenerateLinkCode={async () => { await repository.regenerateLinkCode(); sync(); }}
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
              t={t}
            />
          : <ChildDashboard state={state} active={repository.activeSession()} start={startCapture} retake={retryCapture} t={t} />;
    content = <div className="app-shell">{screen}<BottomNav tab={tab} role={role} routineCentricEnabled={routineCentricUiEnabled} onChange={setTab} t={t} /></div>;
  }

  return (
    <IonApp className={appRootClassName}>
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
          closeLabel={t('close')}
          onAction={() => { void applySnackbarUpdate(); }}
          onClose={() => setDismissedUpdateId(updateSnackbarId)}
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
    </IonApp>
  );
}
