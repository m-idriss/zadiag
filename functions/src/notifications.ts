export const buildCheckNotification = (input: {
  sessionId: string;
  locale?: string;
  resend: boolean;
}) => {
  const isFrench = input.locale === 'fr';
  return {
    title: isFrench
      ? "C'est l'heure de faire une vérification"
      : 'Time to do a check',
    body: isFrench
      ? 'Prends une photo de tes élastiques.'
      : 'Take a photo of your elastics.',
    tag: input.resend ? `reminder:${input.sessionId}` : `verification:${input.sessionId}`,
  };
};
