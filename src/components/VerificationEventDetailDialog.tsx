import { useEffect, useState } from 'react';
import type { Locale, VerificationEvent } from '../domain/models';
import { isReviewableVerification } from '../domain/adherence';
import type { MessageKey } from '../services/i18n';
import { languageTag } from '../services/locale';
import { useModalFocus } from '../hooks/useModalFocus';
import { AppIcon } from './Icon';
import { StatusPill } from './StatusPill';

export function VerificationEventDetailDialog({ event, locale, proofUrl: providedProofUrl, getProofImageUrl, reviewCheck, requestCheck, onClose, t }: {
  event: VerificationEvent;
  locale: Locale;
  proofUrl?: string;
  getProofImageUrl?: (eventId: string) => Promise<string>;
  reviewCheck?: (eventId: string, decision: 'detected' | 'not_detected') => Promise<void>;
  requestCheck?: (routineId: string) => Promise<void>;
  onClose: () => void;
  t: (key: MessageKey) => string;
}) {
  const dialogRef = useModalFocus<HTMLDivElement>(true, onClose);
  const [loadedProofUrl, setLoadedProofUrl] = useState<string>();
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'sending' | 'sent' | 'error'>();
  const proofUrl = providedProofUrl ?? loadedProofUrl;
  const canReview = Boolean(reviewCheck) && isReviewableVerification(event);
  const isActive = event.status === 'pending' && Date.parse(event.expiresAt) > Date.now();
  const canRequest = Boolean(requestCheck) && (isActive || ['missed', 'expired'].includes(event.status));
  const formatterLocale = languageTag(locale);
  const formatDateTime = (value: string) => new Intl.DateTimeFormat(formatterLocale, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  const analysisSourceLabel = event.analysisSource ? t(event.analysisSource === 'ai' ? 'analysisSourceAi' : event.analysisSource === 'fallback' ? 'analysisSourceFallback' : 'analysisSourceSelf') : undefined;
  const reviewStatusLabel = event.reviewStatus ? t(event.reviewStatus === 'approved' ? 'historyReviewApproved' : event.reviewStatus === 'rejected' ? 'historyReviewRejected' : 'historyReviewPending') : undefined;
  const scoreLabel = (score?: number) => score === undefined ? undefined : `${Math.round(score * 100)}%`;

  useEffect(() => {
    if (providedProofUrl || !event.proofImagePath || !getProofImageUrl) return;
    let active = true;
    void getProofImageUrl(event.id)
      .then((url) => { if (active) setLoadedProofUrl(url); })
      .catch((error) => { console.error(error); });
    return () => { active = false; };
  }, [event.id, event.proofImagePath, getProofImageUrl, providedProofUrl]);

  const decide = async (decision: 'detected' | 'not_detected') => {
    if (!reviewCheck) return;
    setReviewing(true);
    setReviewError(false);
    try {
      await reviewCheck(event.id, decision);
    } catch (error) {
      console.error(error);
      setReviewError(true);
    } finally {
      setReviewing(false);
    }
  };
  const request = async () => {
    if (!requestCheck) return;
    setRequestStatus('sending');
    try {
      await requestCheck(event.routineId);
      setRequestStatus('sent');
    } catch (error) {
      console.error(error);
      setRequestStatus('error');
    }
  };

  return (
    <div className="history-detail-backdrop" onClick={onClose}>
      <div ref={dialogRef} className={`history-detail-dialog${proofUrl ? '' : ' no-proof'}${canReview || canRequest ? ' has-actions' : ''}`} role="dialog" aria-modal="true" aria-labelledby="history-detail-title" tabIndex={-1} onClick={(clickEvent) => clickEvent.stopPropagation()}>
        <header>
          <div className="history-detail-heading"><small>{t('historyDetailTitle')}</small><h2 id="history-detail-title">{formatDateTime(event.requestedAt)}</h2><StatusPill status={event.status} t={t} /></div>
          <button type="button" data-autofocus aria-label={t('close')} onClick={onClose}><AppIcon name="close" /></button>
        </header>
        {proofUrl ? <div className="history-detail-proof"><img src={proofUrl} alt={t('responsibleReviewImageAlt')} /></div> : null}
        {canReview ? (
          <div className="history-detail-review-actions">
            {reviewError ? <p className="request-feedback error" role="alert">{t('responsibleReviewError')}</p> : null}
            <div>
              <button type="button" className="parent-review-button reject" aria-label={t('responsibleReviewReject')} disabled={reviewing} onClick={() => { void decide('not_detected'); }}><AppIcon name="close" /></button>
              <button type="button" className="parent-review-button approve" aria-label={t('responsibleReviewApprove')} disabled={reviewing} onClick={() => { void decide('detected'); }}><AppIcon name="check" /></button>
            </div>
          </div>
        ) : null}
        {canRequest ? (
          <div className="history-detail-request-actions">
            <button type="button" disabled={requestStatus === 'sending' || requestStatus === 'sent'} onClick={() => { void request(); }}>
              {requestStatus === 'sending' ? t('requestingCheck') : t(isActive ? 'requestCheckAgain' : 'requestCheckNow')}
            </button>
            {requestStatus === 'sent' ? <p className="request-feedback success" role="status">{t('requestCheckSent')}</p> : null}
            {requestStatus === 'error' ? <p className="request-feedback error" role="alert">{t('requestCheckError')}</p> : null}
          </div>
        ) : null}
        <dl>
          <div><dt>{t('historyRequestedAt')}</dt><dd>{formatDateTime(event.requestedAt)}</dd></div>
          {event.capturedAt ? <div><dt>{t('historyCapturedAt')}</dt><dd>{formatDateTime(event.capturedAt)}</dd></div> : null}
          <div><dt>{t('historyExpiresAt')}</dt><dd>{formatDateTime(event.expiresAt)}</dd></div>
          {analysisSourceLabel ? <div><dt>{t('analysisSource')}</dt><dd>{analysisSourceLabel}</dd></div> : null}
          {scoreLabel(event.confidence) ? <div><dt>{t('analysisConfidence')}</dt><dd>{scoreLabel(event.confidence)}</dd></div> : null}
          {scoreLabel(event.imageQuality) ? <div><dt>{t('analysisQuality')}</dt><dd>{scoreLabel(event.imageQuality)}</dd></div> : null}
          {event.reason ? <div className="wide"><dt>{t('analysisReason')}</dt><dd>{event.reason}</dd></div> : null}
          {reviewStatusLabel ? <div><dt>{t('historyReviewDecision')}</dt><dd>{reviewStatusLabel}</dd></div> : null}
          {event.reviewedAt ? <div><dt>{t('historyReviewedAt')}</dt><dd>{formatDateTime(event.reviewedAt)}</dd></div> : null}
          {event.reviewReason ? <div className="wide"><dt>{t('historyReviewComment')}</dt><dd>{event.reviewReason}</dd></div> : null}
        </dl>
      </div>
    </div>
  );
}
