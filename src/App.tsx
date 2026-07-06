import { lazy, Suspense, useEffect, useMemo, useState, type ComponentType } from 'react';
import { IonApp } from '@ionic/react';
import type { Role, VerificationEvent } from './domain/models';
import { routeForState, type AppRoute } from './domain/appRouting';
import { createRepository } from './services/repositoryFactory';
import { translate, type MessageKey } from './services/i18n';
import { BottomNav, type Tab } from './components/BottomNav';
import { SplashScreen } from './components/SplashScreen';
import { Snackbar } from './components/Snackbar';
import { WebPushGateway } from './services/webPush';
import { firebaseEnabled } from './services/firebaseConfig';
import { browserRouteContext, isLocalDemoEnvironment, routineCentricUiEnabled } from './services/browserEnvironment';
import { describeAppUpdate, fetchLatestAppVersion, refreshServiceWorkerRegistration, runWhenStartupIsIdle, type AppUpdateInfo } from './services/appUpdate';
import { InstallScreen } from './screens/InstallScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { ChildDashboard } from './screens/ChildDashboard';
import { canRetakeCapture } from './domain/adherence';

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
  const [savingRoutineId, setSavingRoutineId] = useState<string>();
  const [selectedSessionId, setSelectedSessionId] = useState<string>();
  const useLocalDemo = isLocalDemoEnvironment();
  const t = (key: MessageKey) => translate(state.locale, key);

  useEffect(() => {
    let alive = true;
    const unsubscribe = repository.subscribe(() => setState(repository.snapshot()));
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
        const [registration, latestVersion] = await Promise.all([
          refreshServiceWorkerRegistration(),
          fetchLatestAppVersion().catch((error) => {
            console.error(error);
            return undefined;
          }),
        ]);
        if (!alive) return;
        const versionUpdate = describeAppUpdate(import.meta.env.VITE_APP_VERSION, latestVersion);
        const waiting = Boolean(registration?.waiting);
        setAppUpdateInfo(versionUpdate ?? {
          available: waiting,
          currentVersion: import.meta.env.VITE_APP_VERSION,
          latestVersion,
          severity: waiting ? 'unknown' : 'patch',
        });
      } catch (error) {
        console.error(error);
      }
    };
    repository.initialize().then(() => {
      if (!alive) return;
      window.clearInterval(startupProgressTicker);
      const restored = repository.snapshot();
      setState(restored);
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
    const pendingCount = state.events.filter((event) => event.status === 'pending' && Date.parse(event.expiresAt) > Date.now()).length;
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
    await repository.reset();
    sync();
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
    if (permission !== 'granted') throw new Error('notification_permission_denied');
    const subscription = await push.subscribe();
    await repository.savePushSubscription(subscription.toJSON());
  };
  const forceAppUpdate = async (): Promise<boolean> => {
    const registration = await refreshServiceWorkerRegistration();
    const available = Boolean(registration?.waiting);
    setAppUpdateInfo((current) => ({ ...current, available }));
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
      <IonApp className="app-root">
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
      <IonApp className="app-root">
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
            onAssignRoutine={async (routineId) => { await repository.assignRoutine(routineId); sync(); }}
            onDeleteRoutine={async (routineId) => { await repository.deleteRoutine(routineId); sync(); }}
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
            enableNotifications={enableNotifications}
            notificationsEnabled={state.notificationsEnabled}
            childInstalled={state.family.childLinked}
            familyId={state.family.id}
            events={state.events}
            childLinkingCode={state.family.linkingCode}
            parentRecoveryCode={state.family.parentRecoveryCode}
            pendingChecks={state.events.filter((event) => event.status === 'pending' && Date.parse(event.expiresAt) > Date.now()).length}
            totalChecks={state.events.length}
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
              t={t}
            />
          : <ChildDashboard state={state} active={repository.activeSession()} start={startCapture} retake={retryCapture} t={t} />;
    content = <div className="app-shell">{screen}<BottomNav tab={tab} role={role} routineCentricEnabled={routineCentricUiEnabled} onChange={setTab} t={t} /></div>;
  }

  return (
    <IonApp className="app-root">
      <Suspense fallback={<SplashScreen progress={ready ? 96 : splashProgress} message={t(ready ? 'splashFinalizing' : splashMessage)} />}>
        {content}
      </Suspense>
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
    </IonApp>
  );
}
