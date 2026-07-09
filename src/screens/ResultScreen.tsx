import type { Locale, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';
import { StatusPill } from '../components/StatusPill';
import { ActionButton } from '../components/ui';

export function ResultScreen({
  event,
  retake,
  done,
  t,
}: {
  event: VerificationEvent;
  retake?: () => void;
  done: () => void;
  t: (key: MessageKey) => string;
  }) {
  const success = event.status === 'detected';
  const confidence = event.confidence != null ? Math.round(event.confidence * 100) : undefined;
  const quality = event.imageQuality != null ? Math.round(event.imageQuality * 100) : undefined;
  const sourceLabel = event.analysisSource === 'ai'
    ? t('analysisSourceAi')
    : event.analysisSource === 'self'
      ? t('analysisSourceSelf')
      : t('analysisSourceFallback');
  return (
    <main className="page result-page">
      <div className={`result-icon ${success ? 'success' : ''}`}>{success ? '✓' : '↻'}</div>
      <h1>{success ? t('allSet') : t('uncertain')}</h1>
      <p className="hero-copy">{success ? t('visibleMessage') : t('unclearResult')}</p>
      <StatusPill status={event.status} t={t} />
      {event.analysisSource ? <p className="result-reason"><strong>{t('analysisSource')}:</strong> {sourceLabel}</p> : null}
      {event.reason && event.analysisSource !== 'self' ? <p className="result-reason"><strong>{t('analysisReason')}:</strong> {event.reason}</p> : null}
      {confidence || quality ? (
        <div className="result-metrics">
          {confidence ? <span>{t('analysisConfidence')} {confidence}%</span> : null}
          {quality ? <span>{t('analysisQuality')} {quality}%</span> : null}
        </div>
      ) : null}
      {quality != null && quality <= 60 ? <p className="result-reason">{t('analysisQualityHint')}</p> : null}
      <Disclaimer t={t} />
      {retake ? <p className="result-choice-hint">{t('sendAsIsHint')}</p> : null}
      {retake ? <ActionButton onClick={retake}>{t('retakeProof')}</ActionButton> : null}
      <ActionButton fill={retake ? 'outline' : 'solid'} onClick={done}>{t(retake ? 'sendAsIs' : 'backToday')}</ActionButton>
    </main>
  );
}
