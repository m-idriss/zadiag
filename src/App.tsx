import { useEffect, useMemo, useState } from 'react';
import { IonApp } from '@ionic/react';
import type { Role, VerificationEvent } from './domain/models';
import { createRepository } from './services/repositoryFactory';
import { translate, type MessageKey } from './services/i18n';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { LinkScreen } from './screens/LinkScreen';
import { ParentDashboard } from './screens/ParentDashboard';
import { ChildDashboard } from './screens/ChildDashboard';
import { HistoryScreen } from './screens/HistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CameraScreen } from './screens/CameraScreen';
import { ResultScreen } from './screens/ResultScreen';
import { BottomNav, type Tab } from './components/BottomNav';
import { SplashScreen } from './components/SplashScreen';
import { WebPushGateway } from './services/webPush';
import { firebaseEnabled } from './services/firebaseClient';
import { InstallScreen } from './screens/InstallScreen';
import { NotificationSetupScreen } from './screens/NotificationSetupScreen';

type Route = 'install' | 'welcome' | 'link' | 'notifications' | 'app' | 'camera' | 'result';

const isLocalhost = /^(localhost|127\.0\.0\.1|::1)$/.test(window.location.hostname);
const useFirebase = import.meta.env.VITE_USE_FIREBASE === 'true';
const useLocalDemo = isLocalhost && !useFirebase;
const appBadgeApi = navigator as Navigator & {
  setAppBadge?: (contents?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
  || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const routeForState = (state: ReturnType<ReturnType<typeof createRepository>['snapshot']>): Route => {
  const setupPreview = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('setup') : null;
  if (setupPreview === 'install' || setupPreview === 'notifications') return setupPreview;
  if (isIos() && !isStandalone()) return 'install';
  if (!state.role) return 'welcome';
  if (!state.family.linked) return 'link';
  if (useLocalDemo && state.role === 'child' && !state.notificationsEnabled) return 'app';
  if (state.role === 'child' && !state.notificationsEnabled) return 'notifications';
  return 'app';
};

const waitForInstalledState = (worker: ServiceWorker) => new Promise<void>((resolve) => {
  if (worker.state === 'installed') {
    resolve();
    return;
  }
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed') resolve();
  }, { once: true   });
});

const refreshServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration | undefined> => {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return undefined;
  await registration.update();
  if (registration.installing) await waitForInstalledState(registration.installing);
  return registration;
};

export function App() {
  const repository = useMemo(createRepository, []);
  const [state, setState] = useState(repository.snapshot());
  const [route, setRoute] = useState<Route>(() => routeForState(state));
  const [ready, setReady] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [splashProgress, setSplashProgress] = useState(12);
  const [splashMessage, setSplashMessage] = useState<MessageKey>('splashLoading');
  const [tab, setTab] = useState<Tab>('home');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerificationEvent>();
  const [submitError, setSubmitError] = useState<string>();
  const t = (key: MessageKey) => translate(state.locale, key);

  useEffect(() => {
    let alive = true;
    const startedAt = Date.now();
    const unsubscribe = repository.subscribe(() => setState(repository.snapshot()));
    const setStartupStep = (progress: number, message: MessageKey) => {
      if (!alive) return;
      setSplashProgress(progress);
      setSplashMessage(message);
    };
    repository.initialize().then(async () => {
      if (!alive) return;
      const restored = repository.snapshot();
      setState(restored);
      setRoute(routeForState(restored));
      setStartupStep(48, 'splashCheckingUpdate');
      const registration = await refreshServiceWorkerRegistration();
      if (!alive) return;
      setUpdateAvailable(Boolean(registration?.waiting));
      setStartupStep(92, 'splashFinalizing');
      const elapsed = Date.now() - startedAt;
      window.setTimeout(() => {
        if (!alive) return;
        setSplashProgress(100);
        setReady(true);
      }, Math.max(150, 700 - elapsed));
    }).catch((error) => {
      console.error(error);
      if (!alive) return;
      setSplashProgress(100);
      setReady(true);
    });
    return () => {
      alive = false;
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
    const session = repository.activeSession();
    if (!session) return;
    setSubmitError(undefined);
    setBusy(true);
    try {
      const event = await repository.submitCapture(session.sessionId, capturedAt, imageDataUrl);
      sync();
      setResult(event);
      setRoute('result');
    } catch (error) {
      console.error(error);
      setSubmitError(t('requestCheckError'));
    } finally {
      setBusy(false);
    }
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
    setUpdateAvailable(available);
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
        onParentLink={async (name) => { await repository.linkParent(name); sync(); setRoute('app'); }}
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
    content = <CameraScreen busy={busy} submitError={submitError} back={() => setRoute('app')} submit={submit} t={t} />;
  } else if (route === 'result' && result) {
    content = <ResultScreen event={result} done={() => { setResult(undefined); setRoute('app'); }} t={t} />;
  } else {
    const role = state.role ?? 'child';
    const screen = tab === 'history'
      ? <HistoryScreen events={state.events} locale={state.locale} t={t} />
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
            updateAvailable={updateAvailable}
            forceAppUpdate={forceAppUpdate}
            reset={() => { void reset(); }}
            role={role}
            t={t}
          />
        : role === 'parent'
          ? <ParentDashboard
              state={state}
              regenerateCode={async () => { await repository.regenerateLinkCode(); sync(); }}
              requestCheck={async () => { await repository.requestCheckNow(); sync(); }}
              t={t}
            />
          : <ChildDashboard state={state} active={repository.activeSession()} start={() => setRoute('camera')} t={t} />;
    content = <div className="app-shell">{screen}<BottomNav tab={tab} role={role} onChange={setTab} t={t} /></div>;
  }

  return <IonApp>{content}{!ready ? <SplashScreen progress={splashProgress} message={t(splashMessage)} /> : null}</IonApp>;
}
