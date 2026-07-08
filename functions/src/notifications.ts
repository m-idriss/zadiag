export type NotificationLocale = 'en' | 'fr';

export interface CheckNotificationInput {
  sessionId: string;
  routineId: string;
  routineName: string;
  routineNames?: Partial<Record<NotificationLocale, string>>;
  routineIcon?: string;
  resend: boolean;
  locale?: string;
}

export interface CheckNotificationPayload {
  version: 2;
  kind: 'check-ready' | 'check-reminder';
  sessionId: string;
  routineId: string;
  tag: string;
  title: string;
  body: string;
  path: string;
}

export interface ReviewNotificationInput {
  checkId: string;
  routineId: string;
  routineName: string;
  routineNames?: Partial<Record<NotificationLocale, string>>;
  routineIcon?: string;
  locale?: string;
}

export interface ReviewNotificationPayload {
  version: 2;
  kind: 'review-needed';
  checkId: string;
  routineId: string;
  tag: string;
  title: string;
  body: string;
  path: string;
}

export const normalizeNotificationLocale = (locale?: string): NotificationLocale =>
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
    checkId: input.checkId,
    routineId: input.routineId,
    tag: `review:${input.checkId}`,
    title: locale === 'fr' ? `${titlePrefix} · à vérifier` : `${titlePrefix} · review`,
    body: locale === 'fr' ? 'Une preuve attend votre validation.' : 'A proof needs your review.',
    path: '/?open=review',
  };
};
