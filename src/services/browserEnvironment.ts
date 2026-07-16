import type { AppRoute, RouteContext } from '../domain/appRouting';

const LOCALHOST_PATTERN = /^(localhost|127\.0\.0\.1|::1)$/;
const RELATIONSHIP_INVITATION_STORAGE_KEY = 'zadiag.relationshipInvitationCode';

const useFirebase = import.meta.env.VITE_USE_FIREBASE === 'true';
export const routineCentricUiEnabled = import.meta.env.VITE_ROUTINE_CENTRIC_UI !== 'false';

export type NotificationLaunchIntent = {
  kind: 'review';
  participantId: string;
  eventId?: string;
} | {
  kind: 'verification';
  sessionId: string;
};

export const notificationLaunchIntent = (search = window.location.search): NotificationLaunchIntent | undefined => {
  const parameters = new URLSearchParams(search);
  if (parameters.get('open') === 'verification') {
    const sessionId = parameters.get('session')?.trim();
    return sessionId ? { kind: 'verification', sessionId } : undefined;
  }
  const participantId = parameters.get('participant')?.trim();
  if (parameters.get('open') !== 'review' || !participantId) return undefined;
  const eventId = parameters.get('event')?.trim();
  return { kind: 'review', participantId, ...(eventId ? { eventId } : {}) };
};

export const notificationLaunchIntentFromMessage = (
  data: unknown,
  origin = window.location.origin,
): NotificationLaunchIntent | undefined => {
  const message = data as { type?: unknown; path?: unknown } | undefined;
  if (message?.type !== 'OPEN_NOTIFICATION' || typeof message.path !== 'string') return undefined;
  try {
    const url = new URL(message.path, origin);
    return url.origin === origin ? notificationLaunchIntent(url.search) : undefined;
  } catch {
    return undefined;
  }
};

export const clearNotificationLaunchUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('open');
  url.searchParams.delete('participant');
  url.searchParams.delete('event');
  url.searchParams.delete('session');
  window.history.replaceState(window.history.state, '', url);
};

export const relationshipInvitationCode = (hash = window.location.hash, storage = window.localStorage): string | undefined => {
  const hashCode = new URLSearchParams(hash.replace(/^#/, '')).get('invite')?.trim().toUpperCase();
  if (hashCode && /^ZI-\d{6}$/.test(hashCode)) return hashCode;
  const storedCode = storage.getItem(RELATIONSHIP_INVITATION_STORAGE_KEY)?.trim().toUpperCase();
  return storedCode && /^ZI-\d{6}$/.test(storedCode) ? storedCode : undefined;
};

export const captureRelationshipInvitationCode = (hash = window.location.hash, storage = window.localStorage) => {
  const code = relationshipInvitationCode(hash, storage);
  if (code) storage.setItem(RELATIONSHIP_INVITATION_STORAGE_KEY, code);
  return code;
};

export const relationshipInvitationUrl = (
  code: string,
  baseUrl = new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
) => {
  const url = new URL(baseUrl);
  url.hash = new URLSearchParams({ invite: code.trim().toUpperCase() }).toString();
  return url.toString();
};

export const clearRelationshipInvitationUrl = () => {
  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState(window.history.state, '', url);
  window.localStorage.removeItem(RELATIONSHIP_INVITATION_STORAGE_KEY);
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
  invitationCode: relationshipInvitationCode(),
});
