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
  const confidence = event.confidence != null ? Math.round(event.confidence * 100) : undefined;
  const quality = event.imageQuality != null ? Math.round(event.imageQuality * 100) : undefined;
  return (
    <main className="page result-page">
      <div className={`result-icon ${success ? 'success' : ''}`}>{success ? '✓' : '↻'}</div>
      <h1>{success ? t('allSet') : t('uncertain')}</h1>
      <p className="hero-copy">{success ? t('visibleMessage') : t('unclearResult')}</p>
      <StatusPill status={event.status} t={t} />
      {event.analysisSource ? <p className="result-reason"><strong>{t('analysisSource')}:</strong> {event.analysisSource === 'ai' ? t('analysisSourceAi') : t('analysisSourceFallback')}</p> : null}
      {event.reason ? <p className="result-reason"><strong>{t('analysisReason')}:</strong> {event.reason}</p> : null}
      {confidence || quality ? (
        <div className="result-metrics">
          {confidence ? <span>{t('analysisConfidence')} {confidence}%</span> : null}
          {quality ? <span>{t('analysisQuality')} {quality}%</span> : null}
        </div>
      ) : null}
      {quality != null && quality <= 60 ? <p className="result-reason">{t('analysisQualityHint')}</p> : null}
      <Disclaimer t={t} />
      <IonButton expand="block" onClick={done}>{t('backToday')}</IonButton>
    </main>
  );
}
