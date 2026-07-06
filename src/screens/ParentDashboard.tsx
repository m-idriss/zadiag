import { useEffect, useMemo, useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import type { AppState, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon } from '../components/Icon';
import { CodeBox } from '../components/CodeBox';
import { RoutineHistoryPanel } from '../components/RoutineHistoryPanel';
import { AdherenceSummaryCard, filterEventsBySummaryRange, type SummaryRange } from '../components/AdherenceSummaryCard';
import { presentRoutine } from '../domain/routinePresentation';
import { ActivityLog } from '../components/ActivityLog';

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
  const [summaryRange, setSummaryRange] = useState<SummaryRange>('day');
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [proofErrors, setProofErrors] = useState<Record<string, boolean>>({});
  const [reviewingId, setReviewingId] = useState<string>();
  const [reviewErrorId, setReviewErrorId] = useState<string>();
  const [enlargedProofUrl, setEnlargedProofUrl] = useState<string>();
  const swipeStartRef = useRef<{ eventId: string; x: number; y: number } | undefined>(undefined);
  const rangedEvents = filterEventsBySummaryRange(state.events, summaryRange);
  const reviewEvents = useMemo(() => state.events
    .filter((event) => event.status === 'uncertain' && !['approved', 'rejected'].includes(event.reviewStatus ?? ''))
    .sort((a, b) => Date.parse(b.capturedAt ?? b.requestedAt) - Date.parse(a.capturedAt ?? a.requestedAt)),
  [state.events]);
  const locale = state.locale === 'fr' ? 'fr-FR' : 'en-US';
  const activePendingEvents = state.events.filter((event) => event.status === 'pending' && Date.parse(event.expiresAt) > Date.now());
  const responsibleEmptyState = !state.family.childLinked
    ? { icon: 'link' as const, title: t('responsibleEmptyParticipantNotLinkedTitle'), hint: t('responsibleEmptyParticipantNotLinkedHint') }
    : !state.routineAssignments.length
      ? { icon: 'add' as const, title: t('responsibleEmptyNoRoutineTitle'), hint: t('responsibleEmptyNoRoutineHint') }
      : activePendingEvents.length
        ? { icon: 'time' as const, title: t('responsibleEmptyWaitingProofTitle'), hint: t('responsibleEmptyWaitingProofHint') }
        : !state.events.length
          ? { icon: 'notifications' as const, title: t('responsibleEmptyNoCheckTitle'), hint: t('responsibleEmptyNoCheckHint') }
          : undefined;
  const formatDateTime = (value: string) => new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
  const routineNameFor = (event: VerificationEvent) => {
    const assignment = state.routineAssignments.find((item) => item.routineId === event.routineId);
    return assignment ? presentRoutine(assignment.routine, state.locale).name : t('routine');
  };
  const displayReason = (event: VerificationEvent) =>
    event.reason && event.reason !== 'analysis_unavailable' && event.reason !== 'self_validated'
      ? event.reason
      : undefined;

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
  const beginSwipe = (eventId: string, x: number, y: number, target: EventTarget) => {
    if (reviewingId === eventId || (target as HTMLElement).closest('button')) return;
    swipeStartRef.current = { eventId, x, y };
  };
  const completeSwipe = (eventId: string, x: number, y: number) => {
    const swipeStart = swipeStartRef.current;
    if (!swipeStart || swipeStart.eventId !== eventId || reviewingId === eventId) return;
    swipeStartRef.current = undefined;
    const deltaX = x - swipeStart.x;
    const deltaY = y - swipeStart.y;
    if (Math.abs(deltaX) < 72 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    void decide(eventId, deltaX > 0 ? 'detected' : 'not_detected');
  };
  const handleTouchStart = (event: TouchEvent<HTMLElement>, eventId: string) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    beginSwipe(eventId, touch.clientX, touch.clientY, event.target);
  };
  const handleTouchEnd = (event: TouchEvent<HTMLElement>, eventId: string) => {
    const touch = event.changedTouches[0];
    if (!touch) return;
    completeSwipe(eventId, touch.clientX, touch.clientY);
  };
  const handleMouseDown = (event: MouseEvent<HTMLElement>, eventId: string) => beginSwipe(eventId, event.clientX, event.clientY, event.target);
  const handleMouseUp = (event: MouseEvent<HTMLElement>, eventId: string) => completeSwipe(eventId, event.clientX, event.clientY);

  return (
    <div className="content-screen child-home parent-overview-screen">
      <header className="screen-header participant-header">
        <div><h1>{t('activity')}</h1><p>{t('participantTodaySubtitle').replace('{name}', state.family.childName)}</p></div>
        <div className="avatar" aria-hidden="true">{state.family.childName.trim().charAt(0).toUpperCase() || '?'}</div>
      </header>

      {(responsibleEmptyState || (!state.family.childLinked && state.family.linkingCode) || (!state.routineAssignments.length && onCreateRoutine)) ? (
        <section className="today-section parent-setup-section" aria-labelledby="parent-setup-title">
          <div className="today-panel-heading">
            <div>
              <small>{t('overview')}</small>
              <h2 id="parent-setup-title">{state.family.childName} · {t('routine')}</h2>
            </div>
          </div>

          <div className="today-task-list">
            {responsibleEmptyState ? (
              <section className="card responsible-state-card">
                <span className="settings-row-icon today-task-icon" aria-hidden="true"><AppIcon name={responsibleEmptyState.icon} /></span>
                <div className="settings-row-copy">
                  <h2>{responsibleEmptyState.title}</h2>
                  <p>{responsibleEmptyState.hint}</p>
                </div>
              </section>
            ) : null}

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
                <div className="parent-create-routine-icon today-task-icon" aria-hidden="true">
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
          </div>
        </section>
      ) : null}

      {reviewEvents.length ? (
        <section className="today-section parent-review-section" aria-labelledby="parent-review-title">
          <div className="today-panel-heading parent-review-heading">
            <div>
              <small>{t('toDoToday')}</small>
              <h2 id="parent-review-title">{t('responsibleReviewTitle')}</h2>
            </div>
            <span>{reviewEvents.length}</span>
          </div>
          <div className="parent-review-list">
            {reviewEvents.map((event) => {
              const proofUrl = proofUrls[event.id];
              const reason = displayReason(event);
              const renderImage = () => proofUrls[event.id]
                ? <img src={proofUrls[event.id]} alt={t('responsibleReviewImageAlt')} />
                : <div role="status">{proofErrors[event.id] ? t('responsibleReviewImageError') : t('loadingProofImage')}</div>;
              return (
                <article
                  className="card parent-review-card"
                  key={event.id}
                  onMouseDown={(mouseEvent) => handleMouseDown(mouseEvent, event.id)}
                  onMouseLeave={() => { swipeStartRef.current = undefined; }}
                  onMouseUp={(mouseEvent) => handleMouseUp(mouseEvent, event.id)}
                  onTouchCancel={() => { swipeStartRef.current = undefined; }}
                  onTouchEnd={(touchEvent) => handleTouchEnd(touchEvent, event.id)}
                  onTouchStart={(touchEvent) => handleTouchStart(touchEvent, event.id)}
                >
                  <div className="parent-review-main">
                    {proofUrl ? (
                      <button
                        type="button"
                        className="parent-review-image parent-review-image-button"
                        aria-label={t('responsibleReviewImageAlt')}
                        onClick={() => setEnlargedProofUrl(proofUrl)}
                      >
                        {renderImage()}
                      </button>
                    ) : (
                      <div className="parent-review-image">{renderImage()}</div>
                    )}
                    <div className="parent-review-copy">
                      <div className="parent-review-title-row">
                        <div>
                          <strong>{routineNameFor(event)}</strong>
                          <small>{formatDateTime(event.capturedAt ?? event.requestedAt)}</small>
                        </div>
                      </div>
                      {reason ? <p>{reason}</p> : null}
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
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      <ActivityLog state={state} t={t} />

      {enlargedProofUrl ? (
        <div className="proof-lightbox" role="dialog" aria-modal="true" aria-label={t('responsibleReviewImageAlt')} onClick={() => setEnlargedProofUrl(undefined)}>
          <button type="button" className="proof-lightbox-close" aria-label={t('close')} onClick={() => setEnlargedProofUrl(undefined)}>×</button>
          <img src={enlargedProofUrl} alt={t('responsibleReviewImageAlt')} onClick={(event) => event.stopPropagation()} />
        </div>
      ) : null}

      <section className="today-section participant-history-section parent-history-section" aria-labelledby="responsible-history-title">
        <AdherenceSummaryCard events={state.events} range={summaryRange} onRangeChange={setSummaryRange} t={t} />
        <RoutineHistoryPanel assignments={state.routineAssignments} events={rangedEvents} locale={state.locale} titleId="responsible-history-title" t={t} />
      </section>
    </div>
  );
}
