export type NotificationLocale = 'en' | 'fr';

export interface CheckNotificationInput {
  sessionId: string;
  routineId: string;
  routineName: string;
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
  const routineName = input.routineName.trim() || (locale === 'fr' ? 'routine' : 'routine');
  return {
    version: 2,
    kind,
    sessionId: input.sessionId,
    routineId: input.routineId,
    tag: input.resend ? `reminder:${input.sessionId}` : `verification:${input.sessionId}`,
    title: input.resend
      ? (locale === 'fr' ? 'Rappel Zadiag' : 'Zadiag reminder')
      : (locale === 'fr' ? 'Contrôle prêt' : 'Check ready'),
    body: input.resend
      ? (locale === 'fr'
          ? `Un rappel t’attend pour ${routineName}.`
          : `A reminder is waiting for ${routineName}.`)
      : (locale === 'fr'
          ? `Tu peux envoyer ta preuve pour ${routineName}.`
          : `You can send your proof for ${routineName}.`),
    path: '/?open=verification',
  };
};
