import { useEffect, useMemo, useState } from 'react';
import type { AppState, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon } from '../components/Icon';
import { CodeBox } from '../components/CodeBox';
import { RoutineHistoryPanel } from '../components/RoutineHistoryPanel';
import { AdherenceSummaryCard, filterEventsBySummaryRange, type SummaryRange } from '../components/AdherenceSummaryCard';
import { presentRoutine } from '../domain/routinePresentation';

export function ParentDashboard({
  state,
  regenerateCode,
  onCreateRoutine,
  getProofImageUrl,
  reviewCheck,
  t,
}: {
  state: AppState;
  regenerateCode: () => Promise<void>;
  onCreateRoutine?: () => void;
  getProofImageUrl?: (eventId: string) => Promise<string>;
  reviewCheck?: (eventId: string, decision: 'detected' | 'not_detected') => Promise<void>;
  t: (key: MessageKey) => string;
}) {
  const [regenerating, setRegenerating] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [summaryRange, setSummaryRange] = useState<SummaryRange>('week');
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [proofErrors, setProofErrors] = useState<Record<string, boolean>>({});
  const [reviewingId, setReviewingId] = useState<string>();
  const [reviewErrorId, setReviewErrorId] = useState<string>();
  const rangedEvents = filterEventsBySummaryRange(state.events, summaryRange);
  const reviewEvents = useMemo(() => state.events
    .filter((event) => event.status === 'uncertain' && event.reviewStatus === 'pending' && Boolean(event.proofImagePath))
    .sort((a, b) => Date.parse(b.capturedAt ?? b.requestedAt) - Date.parse(a.capturedAt ?? a.requestedAt)),
  [state.events]);
  const locale = state.locale === 'fr' ? 'fr-FR' : 'en-US';
  const formatDateTime = (value: string) => new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
  const routineNameFor = (event: VerificationEvent) => {
    const assignment = state.routineAssignments.find((item) => item.routineId === event.routineId);
    return assignment ? presentRoutine(assignment.routine, state.locale).name : t('routine');
  };

  useEffect(() => {
    if (!getProofImageUrl) return;
    reviewEvents.forEach((event) => {
      if (proofUrls[event.id] || proofErrors[event.id]) return;
      void getProofImageUrl(event.id)
        .then((url) => setProofUrls((current) => ({ ...current, [event.id]: url })))
        .catch((error) => {
          console.error(error);
          setProofErrors((current) => ({ ...current, [event.id]: true }));
        });
    });
  }, [getProofImageUrl, proofErrors, proofUrls, reviewEvents]);

  const regenerate = async () => {
    if (!window.confirm(t('regenerateCodeConfirm'))) return;
    setCodeError(false);
    setRegenerating(true);
    try {
      await regenerateCode();
    } catch {
      setCodeError(true);
    } finally {
      setRegenerating(false);
    }
  };
  const decide = async (eventId: string, decision: 'detected' | 'not_detected') => {
    if (!reviewCheck) return;
    setReviewingId(eventId);
    setReviewErrorId(undefined);
    try {
      await reviewCheck(eventId, decision);
    } catch (error) {
      console.error(error);
      setReviewErrorId(eventId);
    } finally {
      setReviewingId(undefined);
    }
  };

  return (
    <div className="content-screen parent-overview-screen">
      <header className="screen-header">
        <div><small>{t('overview')}</small><h1>{state.family.childName} · {t('routine')}</h1></div>
        <div className="avatar">{state.family.childName.charAt(0)}</div>
      </header>

      <AdherenceSummaryCard events={state.events} range={summaryRange} onRangeChange={setSummaryRange} t={t} />

      {!state.family.childLinked && state.family.linkingCode ? (
        <CodeBox
          label={t('childLinkCode')}
          hint={t('childLinkCodeHint')}
          value={state.family.linkingCode}
          t={t}
          action={(
            <>
              <button type="button" className="regenerate-code" disabled={regenerating} onClick={() => { void regenerate(); }}>
                {regenerating ? t('regeneratingCode') : t('regenerateCode')}
              </button>
              {codeError ? <span className="form-error">{t('regenerateCodeError')}</span> : null}
            </>
          )}
        />
      ) : null}

      {!state.routineAssignments.length && onCreateRoutine ? (
        <section className="card parent-create-routine-card">
          <div className="parent-create-routine-icon" aria-hidden="true">
            <AppIcon name="add" />
          </div>
          <div className="parent-create-routine-copy">
            <div>
              <small>{t('routineSetupEyebrow')}</small>
              <h2>{t('createFirstRoutine')}</h2>
            </div>
            <p>{t('createFirstRoutineHint')}</p>
          </div>
          <button type="button" className="request-check" onClick={onCreateRoutine}>{t('chooseRoutine')}</button>
        </section>
      ) : null}

      {reviewEvents.length ? (
        <section className="parent-review-section" aria-labelledby="parent-review-title">
          <div className="section-heading parent-history-heading">
            <h2 id="parent-review-title">{t('responsibleReviewTitle')}</h2>
            <span>{reviewEvents.length}</span>
          </div>
          <div className="parent-review-list">
            {reviewEvents.map((event) => (
              <article className="card parent-review-card" key={event.id}>
                <div className="parent-review-image">
                  {proofUrls[event.id]
                    ? <img src={proofUrls[event.id]} alt={t('responsibleReviewImageAlt')} />
                    : <div role="status">{proofErrors[event.id] ? t('responsibleReviewImageError') : t('loadingProofImage')}</div>}
                </div>
                <div className="parent-review-copy">
                  <strong>{routineNameFor(event)}</strong>
                  <small>{formatDateTime(event.capturedAt ?? event.requestedAt)}</small>
                  {event.reason ? <p>{event.reason}</p> : null}
                  {reviewErrorId === event.id ? <p className="request-feedback error">{t('responsibleReviewError')}</p> : null}
                </div>
                <div className="parent-review-actions">
                  <button
                    type="button"
                    className="parent-review-button approve"
                    disabled={reviewingId === event.id}
                    onClick={() => { void decide(event.id, 'detected'); }}
                  >
                    {t('responsibleReviewApprove')}
                  </button>
                  <button
                    type="button"
                    className="parent-review-button reject"
                    disabled={reviewingId === event.id}
                    onClick={() => { void decide(event.id, 'not_detected'); }}
                  >
                    {t('responsibleReviewReject')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <RoutineHistoryPanel assignments={state.routineAssignments} events={rangedEvents} locale={state.locale} t={t} />
    </div>
  );
}
