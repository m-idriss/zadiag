type NotificationLocale = 'en' | 'fr';

interface NormalizedPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface NormalizedPushPreferences {
  notificationWindowStart: string;
  notificationWindowEnd: string;
}

const base64UrlPattern = /^[A-Za-z0-9_-]+={0,2}$/;
const notificationTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const normalizePushSubscription = (value: unknown): NormalizedPushSubscription | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = typeof candidate.endpoint === 'string' ? candidate.endpoint : '';
  const p256dh = typeof candidate.keys?.p256dh === 'string' ? candidate.keys.p256dh : '';
  const auth = typeof candidate.keys?.auth === 'string' ? candidate.keys.auth : '';
  if (endpoint.length > 4_096 || p256dh.length < 40 || p256dh.length > 256 || auth.length < 8 || auth.length > 128) return undefined;
  if (!base64UrlPattern.test(p256dh) || !base64UrlPattern.test(auth)) return undefined;
  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password) return undefined;
  } catch {
    return undefined;
  }
  return { endpoint, keys: { p256dh, auth } };
};

export const normalizePushPreferences = (value: unknown): NormalizedPushPreferences | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  const notificationWindowStart = typeof candidate.notificationWindowStart === 'string'
    && notificationTimePattern.test(candidate.notificationWindowStart)
    ? candidate.notificationWindowStart
    : '08:00';
  const notificationWindowEnd = typeof candidate.notificationWindowEnd === 'string'
    && notificationTimePattern.test(candidate.notificationWindowEnd)
    ? candidate.notificationWindowEnd
    : '21:00';
  return { notificationWindowStart, notificationWindowEnd };
};

interface CheckNotificationInput {
  sessionId: string;
  routineId: string;
  routineName: string;
  routineNames?: Partial<Record<NotificationLocale, string>>;
  routineIcon?: string;
  resend: boolean;
  locale?: string;
}

interface CheckNotificationPayload {
  version: 2;
  kind: 'check-ready' | 'check-reminder';
  sessionId: string;
  routineId: string;
  tag: string;
  title: string;
  body: string;
  path: string;
}

export interface SyntheticReceiptPayload {
  monitorId: string;
  receiptId: string;
  token: string;
  url: string;
}

interface ReviewNotificationInput {
  participantId: string;
  checkId: string;
  routineId: string;
  routineName: string;
  routineNames?: Partial<Record<NotificationLocale, string>>;
  routineIcon?: string;
  locale?: string;
}

interface ReviewNotificationPayload {
  version: 2;
  kind: 'review-needed';
  participantId: string;
  checkId: string;
  routineId: string;
  tag: string;
  title: string;
  body: string;
  path: string;
}

interface TestNotificationInput {
  locale?: string;
  role?: 'child' | 'parent';
}

interface TestNotificationPayload {
  version: 2;
  kind: 'test';
  tag: string;
  title: string;
  body: string;
  path: string;
}

const normalizeNotificationLocale = (locale?: string): NotificationLocale =>
  locale === 'fr' ? 'fr' : 'en';

const notificationRoutineLabel = (
  input: Pick<CheckNotificationInput, 'routineName' | 'routineNames' | 'routineIcon'>,
  locale: NotificationLocale,
) => {
  const routineName = (input.routineNames?.[locale] ?? input.routineName).trim()
    || (locale === 'fr' ? 'Routine' : 'Routine');
  const routineIcon = input.routineIcon?.trim() || '✅';
  return `${routineIcon} ${routineName}`;
};

export const buildCheckNotificationPayload = (input: CheckNotificationInput): CheckNotificationPayload => {
  const locale = normalizeNotificationLocale(input.locale);
  const kind = input.resend ? 'check-reminder' : 'check-ready';
  const titlePrefix = notificationRoutineLabel(input, locale);
  return {
    version: 2,
    kind,
    sessionId: input.sessionId,
    routineId: input.routineId,
    tag: input.resend ? `reminder:${input.sessionId}` : `verification:${input.sessionId}`,
    title: input.resend
      ? (locale === 'fr' ? `${titlePrefix} · rappel` : `${titlePrefix} · reminder`)
      : (locale === 'fr' ? `${titlePrefix} · prêt` : `${titlePrefix} · ready`),
    body: input.resend
      ? (locale === 'fr' ? 'Contrôle attendu.' : 'Check waiting.')
      : (locale === 'fr' ? 'Envoie ta preuve.' : 'Send your proof.'),
    path: '/?open=verification',
  };
};

export const buildReviewNotificationPayload = (input: ReviewNotificationInput): ReviewNotificationPayload => {
  const locale = normalizeNotificationLocale(input.locale);
  const titlePrefix = notificationRoutineLabel(input, locale);
  return {
    version: 2,
    kind: 'review-needed',
    participantId: input.participantId,
    checkId: input.checkId,
    routineId: input.routineId,
    tag: `review:${input.checkId}`,
    title: locale === 'fr' ? `${titlePrefix} · à vérifier` : `${titlePrefix} · review`,
    body: locale === 'fr' ? 'Une preuve attend votre validation.' : 'A proof needs your review.',
    path: `/?open=review&participant=${encodeURIComponent(input.participantId)}&event=${encodeURIComponent(input.checkId)}`,
  };
};

export const buildTestNotificationPayload = (input: TestNotificationInput = {}): TestNotificationPayload => {
  const locale = normalizeNotificationLocale(input.locale);
  return {
    version: 2,
    kind: 'test',
    tag: `test:${input.role ?? 'device'}`,
    title: locale === 'fr' ? 'Notification test Zadiag' : 'Zadiag test notification',
    body: locale === 'fr' ? 'Ce téléphone peut recevoir les notifications.' : 'This phone can receive notifications.',
    path: '/?open=settings',
  };
};
