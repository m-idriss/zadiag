import type { Locale, Role, VerificationEvent } from '../domain/models';
import { firebaseConfig, firebaseEnabled } from './firebaseConfig';

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface AppLogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
}

interface DiagnosticsInput {
  correlationId: string;
  locale: Locale;
  role: Role;
  familyId?: string;
  notificationsEnabled: boolean;
  childInstalled: boolean;
  pendingChecks: number;
  totalChecks: number;
  events: VerificationEvent[];
}

const STORAGE_KEY = 'zadiag:debug-logs:v1';
const MAX_LOGS = 200;
const DEFAULT_RECENT_LOG_LIMIT = 80;
const LOG_METHODS: readonly LogLevel[] = ['log', 'info', 'warn', 'error', 'debug'] as const;

let initialized = false;
let logBuffer: AppLogEntry[] = [];
const originalConsole: Partial<Record<LogLevel, (...args: unknown[]) => void>> = {};

const stringifyPart = (part: unknown): string => {
  if (part instanceof Error) return `${part.name}: ${part.message}\n${part.stack ?? ''}`.trim();
  if (typeof part === 'string') return part;
  try {
    return JSON.stringify(part);
  } catch {
    return String(part);
  }
};

const saveBuffer = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logBuffer));
  } catch (error) {
    const warn = originalConsole.warn ?? console.warn;
    warn('Unable to persist debug logs', error);
  }
};

const appendLog = (level: LogLevel, args: unknown[]) => {
  const entry: AppLogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message: args.map(stringifyPart).join(' '),
  };
  logBuffer = [...logBuffer, entry].slice(-MAX_LOGS);
  saveBuffer();
};

const restoreBuffer = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn('Ignoring invalid persisted debug logs', error);
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  if (!Array.isArray(parsed)) return;
  logBuffer = parsed
    .filter((item): item is AppLogEntry => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<AppLogEntry>;
      return typeof candidate.timestamp === 'string'
        && typeof candidate.level === 'string'
        && typeof candidate.message === 'string';
    })
    .map((item) => ({
      timestamp: item.timestamp,
      level: (LOG_METHODS.find((method) => method === item.level) ?? 'log'),
      message: item.message,
    }))
    .slice(-MAX_LOGS);
};

const collectDeviceInfo = () => ({
  userAgent: navigator.userAgent,
  language: navigator.language,
  languages: navigator.languages.join(', '),
  platform: navigator.platform,
  online: navigator.onLine,
  cookieEnabled: navigator.cookieEnabled,
  doNotTrack: navigator.doNotTrack ?? 'unspecified',
  screen: `${window.screen.width}x${window.screen.height} @${window.devicePixelRatio}x`,
  viewport: `${window.innerWidth}x${window.innerHeight}`,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  standalone: window.matchMedia('(display-mode: standalone)').matches,
  url: window.location.href,
  origin: window.location.origin,
});

const collectFirebaseContext = () => {
  return {
    firebaseEnabled,
    projectId: firebaseConfig.projectId ?? 'unset',
    authDomain: firebaseConfig.authDomain ?? 'unset',
    appId: firebaseConfig.appId ?? 'unset',
    functionsRegion: 'europe-west1',
    uid: 'unavailable',
  };
};

const summarizeRecentEvents = (events: VerificationEvent[]) => {
  const recentEvents = [...events]
    .sort((a, b) => Date.parse(b.requestedAt) - Date.parse(a.requestedAt))
    .slice(0, 15);
  const active = recentEvents.find((event) => event.status === 'pending' && Date.parse(event.expiresAt) > Date.now());
  return {
    activeCheckId: active?.id ?? 'none',
    activeSessionId: active?.sessionId ?? 'none',
    checkIds: recentEvents.map((event) => event.id),
    sessionIds: recentEvents.map((event) => event.sessionId),
    lines: recentEvents.length > 0
      ? recentEvents.map((event) => [
        `checkId=${event.id}`,
        `sessionId=${event.sessionId}`,
        `status=${event.status}`,
        `requestedAt=${event.requestedAt}`,
        `expiresAt=${event.expiresAt}`,
        `capturedAt=${event.capturedAt ?? 'n/a'}`,
      ].join(' | '))
      : ['No checks in local state.'],
  };
};

export const createCorrelationId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `cid-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

export const initializeAppLogs = () => {
  if (initialized) return;
  restoreBuffer();
  LOG_METHODS.forEach((method) => {
    originalConsole[method] = console[method].bind(console);
    console[method] = (...args: unknown[]) => {
      appendLog(method, args);
      const original = originalConsole[method];
      if (original) original(...args);
    };
  });
  window.addEventListener('error', (event) => {
    appendLog('error', [`WindowError: ${event.message}`, event.filename, event.lineno, event.colno]);
  });
  window.addEventListener('unhandledrejection', (event) => {
    appendLog('error', ['UnhandledRejection', event.reason]);
  });
  initialized = true;
};

export const getRecentAppLogs = (limit = DEFAULT_RECENT_LOG_LIMIT): AppLogEntry[] => logBuffer.slice(-limit);

export const buildDiagnosticsEmailBody = (input: DiagnosticsInput): string => {
  const now = new Date().toISOString();
  const logs = getRecentAppLogs();
  const deviceInfo = collectDeviceInfo();
  const firebaseContext = collectFirebaseContext();
  const eventSummary = summarizeRecentEvents(input.events);
  const appUpdatedAt = import.meta.env.VITE_APP_UPDATED_AT ?? 'unknown';
  const appVersion = import.meta.env.VITE_APP_VERSION ?? 'unknown';
  const appEnv = import.meta.env.MODE;

  const correlationLines = [
    `CorrelationId: ${input.correlationId}`,
    `TimestampUtc: ${now}`,
    `FamilyId: ${input.familyId ?? 'missing'}`,
    `Uid: ${firebaseContext.uid}`,
    `ActiveCheckId: ${eventSummary.activeCheckId}`,
    `ActiveSessionId: ${eventSummary.activeSessionId}`,
    `RecentCheckIds: ${eventSummary.checkIds.join(', ') || 'none'}`,
    `RecentSessionIds: ${eventSummary.sessionIds.join(', ') || 'none'}`,
  ];

  const appLines = [
    `Version: ${appVersion}`,
    `UpdatedAt: ${appUpdatedAt}`,
    `Environment: ${appEnv}`,
    `Locale: ${input.locale}`,
    `Role: ${input.role}`,
    `NotificationsEnabled: ${String(input.notificationsEnabled)}`,
    `ChildInstalled: ${String(input.childInstalled)}`,
    `PendingChecks: ${String(input.pendingChecks)}`,
    `TotalChecks: ${String(input.totalChecks)}`,
  ];

  const firebaseLines = Object.entries(firebaseContext).map(([key, value]) => `${key}: ${String(value)}`);
  const deviceLines = Object.entries(deviceInfo).map(([key, value]) => `${key}: ${String(value)}`);
  const logLines = logs.length > 0
    ? logs.map((entry) => `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}`)
    : ['No logs recorded yet.'];

  return [
    'Bonjour équipe 3Dime,',
    '',
    'Voici un rapport de debug généré depuis Zadiag.',
    '',
    '--- CORRELATION ---',
    ...correlationLines,
    '',
    '--- APP ---',
    ...appLines,
    '',
    '--- FIREBASE ---',
    ...firebaseLines,
    '',
    '--- DEVICE ---',
    ...deviceLines,
    '',
    '--- RECENT CHECKS ---',
    ...eventSummary.lines,
    '',
    '--- RECENT LOGS ---',
    ...logLines,
  ].join('\n');
};
