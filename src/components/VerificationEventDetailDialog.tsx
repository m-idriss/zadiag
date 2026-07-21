import { useEffect, useState } from 'react';
import type { Locale, VerificationEvent } from '../domain/models';
import { isReviewableVerification } from '../domain/adherence';
import type { MessageKey } from '../services/i18n';
import { languageTag } from '../services/locale';
import { useModalFocus } from '../hooks/useModalFocus';
import { AppIcon } from './Icon';
import { DisclosureToggle } from './DisclosureToggle';
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
  const [proofError, setProofError] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(() => ['approved', 'rejected'].includes(event.reviewStatus ?? ''));
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
  const reviewReason = event.reviewReason === 'responsible_review' ? undefined : event.reviewReason;
  const actionKeys: Record<NonNullable<VerificationEvent['responsibleActions']>[number]['type'], MessageKey> = {
    requested: 'historyActionRequested',
    reminded: 'historyActionReminded',
    approved: 'historyActionApproved',
    rejected: 'historyActionRejected',
  };
  const actionLabel = (type: NonNullable<VerificationEvent['responsibleActions']>[number]['type']) => t(actionKeys[type]);
  const scoreLabel = (score?: number) => score === undefined ? undefined : `${Math.round(score * 100)}%`;
  const submissionRows = event.submission?.kind === 'confirmation'
    ? [{ id: 'confirmation', label: event.challenge?.response.kind === 'confirmation' ? event.challenge.response.prompt : t('historyResponse'), value: event.submission.value }]
    : event.submission?.kind === 'checklist'
      ? event.submission.items.map((item) => ({
        id: item.id,
        label: event.challenge?.response.kind === 'checklist' ? event.challenge.response.items.find((definition) => definition.id === item.id)?.label ?? item.id : item.id,
        value: item.value,
      }))
      : [];

  useEffect(() => {
    if (providedProofUrl || !event.proofImagePath || !getProofImageUrl) return;
    let active = true;
    setProofError(false);
    void getProofImageUrl(event.id)
      .then((url) => { if (active) setLoadedProofUrl(url); })
      .catch((error) => { console.error(error); if (active) setProofError(true); });
    return () => { active = false; };
  }, [event.id, event.proofImagePath, getProofImageUrl, providedProofUrl]);

  useEffect(() => {
    if (['approved', 'rejected'].includes(event.reviewStatus ?? '')) setDetailsExpanded(true);
  }, [event.reviewStatus]);

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
      <div ref={dialogRef} className={`history-detail-dialog${event.proofImagePath ? ' has-proof' : ''}${canReview || canRequest ? ' has-actions' : ''}`} role="dialog" aria-modal="true" aria-labelledby="history-detail-title" tabIndex={-1} onClick={(clickEvent) => clickEvent.stopPropagation()}>
        <header>
          <div className="history-detail-heading"><small>{t('historyDetailTitle')}</small><h2 id="history-detail-title">{formatDateTime(event.requestedAt)}</h2><StatusPill status={event.status} t={t} /></div>
          <button type="button" data-autofocus aria-label={t('close')} onClick={onClose}><AppIcon name="close" /></button>
        </header>
        {event.proofImagePath ? <div className="history-detail-proof">{proofUrl
          ? <img src={proofUrl} alt={t('responsibleReviewImageAlt')} />
          : proofError
            ? <span role="alert">{t('responsibleReviewImageError')}</span>
            : <span className="history-detail-proof-loading" role="status"><span className="button-spinner" aria-hidden="true" />{t('loadingProofImage')}</span>}
        </div> : null}
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
        <div className="history-detail-disclosure">
          <span>{t('historyMoreDetails')}</span>
          <DisclosureToggle expanded={detailsExpanded} showLabel={t('historyShowDetails')} hideLabel={t('historyHideDetails')} onToggle={() => setDetailsExpanded((expanded) => !expanded)} />
        </div>
        {detailsExpanded ? <dl>
          <div><dt>{t('historyRequestedAt')}</dt><dd>{formatDateTime(event.requestedAt)}</dd></div>
          {event.capturedAt ? <div><dt>{t('historyCapturedAt')}</dt><dd>{formatDateTime(event.capturedAt)}</dd></div> : null}
          {event.submittedAt ? <div><dt>{t('historyRespondedAt')}</dt><dd>{formatDateTime(event.submittedAt)}</dd></div> : null}
          {submissionRows.length ? <div className="wide"><dt>{t('historyResponse')}</dt><dd className="history-structured-response">{submissionRows.map((item) => <span key={item.id}>{item.label} · <b>{t(item.value ? 'yes' : 'no')}</b></span>)}</dd></div> : null}
          {event.quizResult ? <div><dt>{t('historyQuizScore')}</dt><dd>{Math.round(event.quizResult.score * 100)}% · {event.quizResult.correctCount}/{event.quizResult.totalCount}</dd></div> : null}
          {event.quizResult?.concepts.length ? <div><dt>{t('historyQuizConcepts')}</dt><dd>{event.quizResult.concepts.join(' · ')}</dd></div> : null}
          {event.quizResult?.corrections.length ? <div className="wide"><dt>{t('historyQuizCorrection')}</dt><dd className="history-structured-response">{event.quizResult.corrections.map((correction) => {
            const question = event.challenge?.quiz?.questions.find((item) => item.id === correction.questionId);
            return <span key={correction.questionId}><b>{question?.prompt ?? correction.questionId}</b> · {correction.explanation}</span>;
          })}</dd></div> : null}
          <div><dt>{t('historyExpiresAt')}</dt><dd>{formatDateTime(event.expiresAt)}</dd></div>
          {analysisSourceLabel ? <div><dt>{t('analysisSource')}</dt><dd>{analysisSourceLabel}</dd></div> : null}
          {scoreLabel(event.confidence) ? <div><dt>{t('analysisConfidence')}</dt><dd>{scoreLabel(event.confidence)}</dd></div> : null}
          {scoreLabel(event.imageQuality) ? <div><dt>{t('analysisQuality')}</dt><dd>{scoreLabel(event.imageQuality)}</dd></div> : null}
          {event.reason ? <div className="wide"><dt>{t('analysisReason')}</dt><dd>{event.reason}</dd></div> : null}
          {reviewStatusLabel ? <div><dt>{t('historyReviewDecision')}</dt><dd>{reviewStatusLabel}</dd></div> : null}
          {event.reviewedAt ? <div><dt>{t('historyReviewedAt')}</dt><dd>{formatDateTime(event.reviewedAt)}</dd></div> : null}
          {reviewReason ? <div className="wide"><dt>{t('historyReviewComment')}</dt><dd>{reviewReason}</dd></div> : null}
          {event.responsibleActions?.length ? (
            <div className="wide history-responsible-actions">
              <dt>{t('historyResponsibleActions')}</dt>
              <dd>{event.responsibleActions.map((action) => <span key={`${action.type}-${action.at}`}>{actionLabel(action.type)} · {action.actorName} · {formatDateTime(action.at)}</span>)}</dd>
            </div>
          ) : null}
        </dl> : null}
      </div>
    </div>
  );
}
