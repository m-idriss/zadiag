import type { AppRoute, RouteContext } from '../domain/appRouting';

const LOCALHOST_PATTERN = /^(localhost|127\.0\.0\.1|::1)$/;

const useFirebase = import.meta.env.VITE_USE_FIREBASE === 'true';
export const routineCentricUiEnabled = import.meta.env.VITE_ROUTINE_CENTRIC_UI !== 'false';

export interface NotificationLaunchIntent {
  kind: 'review';
  participantId: string;
}

export const notificationLaunchIntent = (search = window.location.search): NotificationLaunchIntent | undefined => {
  const parameters = new URLSearchParams(search);
  const participantId = parameters.get('participant')?.trim();
  if (parameters.get('open') !== 'review' || !participantId) return undefined;
  return { kind: 'review', participantId };
};

const isLocalhostHostname = (hostname = window.location.hostname) => LOCALHOST_PATTERN.test(hostname);

export const isLocalDemoEnvironment = (hostname = window.location.hostname) => isLocalhostHostname(hostname) && !useFirebase;

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
  || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const setupPreviewRoute = (): Extract<AppRoute, 'install' | 'notifications'> | null => {
  const setupPreview = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('setup') : null;
  return setupPreview === 'install' || setupPreview === 'notifications' ? setupPreview : null;
};

export const browserRouteContext = (): RouteContext => ({
  setupPreview: setupPreviewRoute(),
  requiresInstall: isIos() && !isStandalone(),
  useLocalDemo: isLocalDemoEnvironment(),
});
