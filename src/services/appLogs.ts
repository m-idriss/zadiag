import type { Locale, PushSubscriptionHealth, Role, VerificationEvent } from '../domain/models';
import { firebaseConfig, firebaseEnabled } from './firebaseConfig';
import { translate } from './i18n';

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
  pushHealth?: PushSubscriptionHealth;
  childInstalled: boolean;
  pendingChecks: number;
  totalChecks: number;
  events: VerificationEvent[];
}

const STORAGE_KEY = 'zadiag:debug-logs:v1';
const MAX_LOGS = 200;
const LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_RECENT_LOG_LIMIT = 80;
const LOG_METHODS: readonly LogLevel[] = ['log', 'info', 'warn', 'error', 'debug'] as const;

let initialized = false;
let logBuffer: AppLogEntry[] = [];
const originalConsole: Partial<Record<LogLevel, (...args: unknown[]) => void>> = {};

const sensitiveFieldPattern = /((?:actor|authorization|check|family|linking|participant|recovery|routine|session|target|user)?(?:code|id|token|uid)["']?\s*[:=]\s*["']?)([^\s,"'}]+)/gi;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

export const redactDiagnosticText = (value: string): string => value
  .replace(emailPattern, '[redacted-email]')
  .replace(sensitiveFieldPattern, '$1[redacted]');

const isWithinRetentionWindow = (timestamp: string, now = Date.now()) => {
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) && parsed >= now - LOG_RETENTION_MS;
};

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
    message: redactDiagnosticText(args.map(stringifyPart).join(' ')),
  };
  logBuffer = [...logBuffer.filter((item) => isWithinRetentionWindow(item.timestamp)), entry].slice(-MAX_LOGS);
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
    .filter((item) => {
      return isWithinRetentionWindow(item.timestamp);
    })
    .map((item) => ({
      timestamp: item.timestamp,
      level: (LOG_METHODS.find((method) => method === item.level) ?? 'log'),
      message: redactDiagnosticText(item.message),
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
  standalone: typeof window.matchMedia === 'function'
    ? window.matchMedia('(display-mode: standalone)').matches
    : false,
  url: `${window.location.origin}${window.location.pathname}`,
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
    hasActiveCheck: Boolean(active),
    lines: recentEvents.length > 0
      ? recentEvents.map((event, index) => [
        `event=${index + 1}`,
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
    `FamilyContextPresent: ${String(Boolean(input.familyId))}`,
    `Uid: ${firebaseContext.uid}`,
    `ActiveCheckPresent: ${String(eventSummary.hasActiveCheck)}`,
  ];

  const appLines = [
    `Version: ${appVersion}`,
    `UpdatedAt: ${appUpdatedAt}`,
    `Environment: ${appEnv}`,
    `Locale: ${input.locale}`,
    `Role: ${input.role}`,
    `NotificationsEnabled: ${String(input.notificationsEnabled)}`,
    `PushPermission: ${input.pushHealth?.permission ?? 'unknown'}`,
    `PushEndpointPresent: ${String(input.pushHealth?.endpointPresent ?? false)}`,
    `PushLastSuccessfulSaveAt: ${input.pushHealth?.lastSuccessfulSaveAt ?? 'missing'}`,
    `PushLastDispatchResult: ${input.pushHealth?.lastDispatchResult ?? 'missing'}`,
    `PushLastDispatchAt: ${input.pushHealth?.lastDispatchAt ?? 'missing'}`,
    `ChildInstalled: ${String(input.childInstalled)}`,
    `PendingChecks: ${String(input.pendingChecks)}`,
    `TotalChecks: ${String(input.totalChecks)}`,
  ];

  const firebaseLines = Object.entries(firebaseContext).map(([key, value]) => `${key}: ${String(value)}`);
  const deviceLines = Object.entries(deviceInfo).map(([key, value]) => `${key}: ${String(value)}`);
  const logLines = logs.length > 0
    ? logs.map((entry) => `[${entry.timestamp}] ${entry.level.toUpperCase()} ${redactDiagnosticText(entry.message)}`)
    : ['No logs recorded yet.'];

  return [
    translate(input.locale, 'diagnosticsEmailGreeting'),
    '',
    translate(input.locale, 'diagnosticsEmailIntro'),
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
