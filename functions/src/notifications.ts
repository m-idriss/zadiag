export type NotificationLocale = 'en' | 'fr';

export interface CheckNotificationInput {
  sessionId: string;
  routineId: string;
  routineName: string;
  routineNames?: Partial<Record<NotificationLocale, string>>;
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
  return {
    version: 2,
    kind,
    sessionId: input.sessionId,
    routineId: input.routineId,
    tag: input.resend ? `reminder:${input.sessionId}` : `verification:${input.sessionId}`,
    title: input.resend
      ? (locale === 'fr' ? 'Rappel' : 'Reminder')
      : (locale === 'fr' ? 'Contrôle prêt' : 'Check ready'),
    body: input.resend
      ? (locale === 'fr' ? `${routineName} · contrôle attendu.` : `${routineName} · check waiting.`)
      : (locale === 'fr' ? `${routineName} · envoie ta preuve.` : `${routineName} · send your proof.`),
    path: '/?open=verification',
  };
};
