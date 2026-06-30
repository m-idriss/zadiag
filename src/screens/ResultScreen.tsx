import { IonButton } from '@ionic/react';
import type { VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';
import { StatusPill } from '../components/StatusPill';

export function ResultScreen({
  event,
  done,
  t,
}: {
  event: VerificationEvent;
  done: () => void;
  t: (key: MessageKey) => string;
}) {
  const success = event.status === 'detected';
  return (
    <main className="page result-page">
      <div className={`result-icon ${success ? 'success' : ''}`}>{success ? '✓' : '↻'}</div>
      <h1>{success ? t('allSet') : t('uncertain')}</h1>
      <p className="hero-copy">{success ? t('visibleMessage') : t('unclearResult')}</p>
      <StatusPill status={event.status} t={t} />
      <Disclaimer t={t} />
      <IonButton expand="block" onClick={done}>{t('backToday')}</IonButton>
    </main>
  );
}
