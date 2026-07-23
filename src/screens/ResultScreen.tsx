import type { Locale, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { Disclaimer } from '../components/Disclaimer';
import { StatusPill } from '../components/StatusPill';
import { ActionButton } from '../components/ui';
import { AppIcon } from '../components/Icon';
import { retakeGuidanceMessageKey } from '../services/retakeGuidance';
import { PhotoChecklistSummary } from '../components/PhotoChecklistSummary';

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
  const checklist = event.challenge?.response.kind === 'photo_checklist'
    ? event.challenge.response
    : undefined;
  const checklistTitle = event.status === 'detected'
    ? t('photoChecklistResultSuccessTitle')
    : event.status === 'not_detected'
      ? t('photoChecklistResultRetryTitle')
      : t('photoChecklistResultReviewTitle');
  const checklistMessage = event.status === 'detected'
    ? t('photoChecklistResultSuccessBody')
    : event.status === 'not_detected'
      ? t('photoChecklistResultRetryBody')
      : t('photoChecklistResultReviewBody');
  const confidence = event.confidence != null ? Math.round(event.confidence * 100) : undefined;
  const quality = event.imageQuality != null ? Math.round(event.imageQuality * 100) : undefined;
  const sourceLabel = event.analysisSource === 'ai'
    ? t('analysisSourceAi')
    : event.analysisSource === 'self'
      ? t('analysisSourceSelf')
      : t('analysisSourceFallback');
  return (
    <main className="page result-page">
      <div className={`result-icon ${success ? 'success' : ''}`} aria-hidden="true"><AppIcon name={success ? 'check' : 'refresh'} /></div>
      <h1>{checklist ? checklistTitle : success ? t('allSet') : t('uncertain')}</h1>
      <p className="hero-copy">{checklist ? checklistMessage : success ? t('visibleMessage') : t('unclearResult')}</p>
      <StatusPill status={event.status} t={t} />
      {checklist && event.photoChecklistItems ? (
        <PhotoChecklistSummary criteria={checklist.criteria} results={event.photoChecklistItems} title={t('photoChecklistResultItems')} t={t} />
      ) : null}
      {!checklist && event.analysisSource ? <p className="result-reason"><strong>{t('analysisSource')}:</strong> {sourceLabel}</p> : null}
      {!checklist && event.reason && event.analysisSource !== 'self' ? <p className="result-reason"><strong>{t('analysisReason')}:</strong> {event.reason}</p> : null}
      {!checklist && (confidence || quality) ? (
        <div className="result-metrics">
          {confidence ? <span>{t('analysisConfidence')} {confidence}%</span> : null}
          {quality ? <span>{t('analysisQuality')} {quality}%</span> : null}
        </div>
      ) : null}
      {!checklist && quality != null && quality <= 60 ? <p className="result-reason">{t('analysisQualityHint')}</p> : null}
      {event.status === 'uncertain' && event.proofImagePath ? <p className="result-reason">{t('proofPendingReviewPrivacy')}</p> : null}
      <Disclaimer t={t} />
      {retake ? <p className="result-choice-hint">{t(retakeGuidanceMessageKey(event))}</p> : null}
      {retake ? <ActionButton onClick={retake}>{t('retakeProof')}</ActionButton> : null}
      <ActionButton fill={retake ? 'outline' : 'solid'} onClick={done}>{t(retake ? 'sendAsIs' : 'backToday')}</ActionButton>
    </main>
  );
}
