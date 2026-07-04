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

export const normalizeNotificationLocale = (locale?: string): NotificationLocale =>
  locale === 'fr' ? 'fr' : 'en';

export const buildCheckNotificationPayload = (input: CheckNotificationInput): CheckNotificationPayload => {
  const locale = normalizeNotificationLocale(input.locale);
  const kind = input.resend ? 'check-reminder' : 'check-ready';
  const routineName = (input.routineNames?.[locale] ?? input.routineName).trim()
    || (locale === 'fr' ? 'Routine' : 'Routine');
  const routineIcon = input.routineIcon?.trim() || '✅';
  const titlePrefix = `${routineIcon} ${routineName}`;
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
