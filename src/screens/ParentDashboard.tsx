import { useEffect, useMemo, useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import type { AppState, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from '../components/Icon';
import { CodeBox } from '../components/CodeBox';
import { RoutineHistoryPanel } from '../components/RoutineHistoryPanel';
import { AdherenceSummaryCard, filterEventsBySummaryRange, type SummaryRange } from '../components/AdherenceSummaryCard';
import { UpcomingChecksSection } from '../components/UpcomingChecksSection';
import { presentRoutine } from '../domain/routinePresentation';
import { eventWindowLabel } from '../domain/taskTimeLabel';
import { withResolvedEventStatuses } from '../domain/adherence';
import { EmptyState } from '../components/ui';
import { activePendingEvents as activePendingChecks, presentedUpcomingRoutineChecks } from '../domain/dashboardChecks';
import { ParticipantSelector } from '../components/ParticipantSelector';
import { languageTag } from '../services/locale';
import { ProofLightbox } from '../components/ProofLightbox';
import { SetupProgress } from '../components/SetupProgress';

export function ParentDashboard({
  state,
  regenerateCode,
  onCreateRoutine,
  getProofImageUrl,
  reviewCheck,
  requestCheck,
  summaryRange: controlledSummaryRange,
  onSummaryRangeChange,
  onSelectParticipant,
  onOpenHistoryEvent,
  t,
}: {
  state: AppState;
  regenerateCode: () => Promise<void>;
  onCreateRoutine?: () => void;
  getProofImageUrl?: (eventId: string) => Promise<string>;
  reviewCheck?: (eventId: string, decision: 'detected' | 'not_detected') => Promise<void>;
  requestCheck?: (routineId: string) => Promise<void>;
  summaryRange?: SummaryRange;
  onSummaryRangeChange?: (range: SummaryRange) => void;
  onSelectParticipant?: (participantId: string) => void;
  onOpenHistoryEvent?: (event: VerificationEvent) => void;
  t: (key: MessageKey) => string;
}) {
  const [regenerating, setRegenerating] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [localSummaryRange, setLocalSummaryRange] = useState<SummaryRange>('day');
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [proofErrors, setProofErrors] = useState<Record<string, boolean>>({});
  const [reviewingId, setReviewingId] = useState<string>();
  const [reviewErrorId, setReviewErrorId] = useState<string>();
  const [requestingActiveReminder, setRequestingActiveReminder] = useState(false);
  const [activeReminderStatus, setActiveReminderStatus] = useState<'sent' | 'error'>();
  const [enlargedProofUrl, setEnlargedProofUrl] = useState<string>();
  const swipeStartRef = useRef<{ eventId: string; x: number; y: number } | undefined>(undefined);
  const summaryRange = controlledSummaryRange ?? localSummaryRange;
  const setSummaryRange = onSummaryRangeChange ?? setLocalSummaryRange;
  const now = Date.now();
  const displayEvents = useMemo(() => withResolvedEventStatuses(state.events, now), [now, state.events]);
  const rangedEvents = filterEventsBySummaryRange(displayEvents, summaryRange, now);
  const rangedRawEvents = filterEventsBySummaryRange(state.events, summaryRange, now);
  const reviewEvents = useMemo(() => state.events
    .filter((event) => event.status === 'uncertain' && !['approved', 'rejected'].includes(event.reviewStatus ?? ''))
    .sort((a, b) => Date.parse(b.capturedAt ?? b.requestedAt) - Date.parse(a.capturedAt ?? a.requestedAt)),
  [state.events]);
  const locale = languageTag(state.locale);
  const nowDate = useMemo(() => new Date(now), [now]);
  const dateTimeFormatter = useMemo(() => new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
  }), [locale]);
  const routinePresentationsById = useMemo(() => new Map(state.routineAssignments.map((assignment) => [
    assignment.routineId,
    presentRoutine(assignment.routine, state.locale),
  ])), [state.locale, state.routineAssignments]);
  const activePendingEvents = useMemo(
    () => activePendingChecks(state.events, now),
    [now, state.events],
  );
  const upcomingChecks = useMemo(() => presentedUpcomingRoutineChecks(state.routineAssignments, state.locale, nowDate),
  [nowDate, state.locale, state.routineAssignments]);
  const responsibleEmptyState = !state.family.childLinked
    ? { icon: 'link' as const, title: t('responsibleEmptyParticipantNotLinkedTitle'), hint: t('responsibleEmptyParticipantNotLinkedHint') }
    : !state.routineAssignments.length
      ? { icon: 'add' as const, title: t('responsibleEmptyNoRoutineTitle'), hint: t('responsibleEmptyNoRoutineHint') }
      : !state.events.length && !upcomingChecks.length
          ? { icon: 'notifications' as const, title: t('responsibleEmptyNoCheckTitle'), hint: t('responsibleEmptyNoCheckHint') }
          : undefined;
  const setupStep = !state.family.childLinked ? 2 : !state.routineAssignments.length ? 3 : undefined;
  const formatDateTime = (value: string) => dateTimeFormatter.format(new Date(value));
  const routineNameFor = (event: VerificationEvent) =>
    routinePresentationsById.get(event.routineId)?.name ?? t('routine');
  const routinePresentationFor = (event: VerificationEvent) =>
    routinePresentationsById.get(event.routineId) ?? { name: t('routine'), icon: undefined, style: {} };
  const routineProofExampleFor = (event: VerificationEvent) =>
    routinePresentationsById.get(event.routineId)?.proofExample;
  const displayReason = (event: VerificationEvent) =>
    event.reason && event.reason !== 'analysis_unavailable' && event.reason !== 'self_validated'
      ? event.reason
      : undefined;
  const formatScore = (value?: number) => value === undefined ? undefined : `${Math.round(value * 100)}%`;
  const analysisSourceLabel = (event: VerificationEvent) => {
    if (event.analysisSource === 'ai') return t('analysisSourceAi');
    if (event.analysisSource === 'fallback') return t('analysisSourceFallback');
    if (event.analysisSource === 'self') return t('analysisSourceSelf');
    return undefined;
  };
  const automatedVerdictLabel = (event: VerificationEvent) => t(
    event.automatedStatus === 'not_detected'
      ? 'notDetected'
      : event.automatedStatus === 'detected'
        ? 'validated'
        : 'uncertain',
  );

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
  const resendActiveReminders = async (routineId?: string) => {
    if (!requestCheck || requestingActiveReminder) return;
    setRequestingActiveReminder(true);
    setActiveReminderStatus(undefined);
    try {
      const routineIds = routineId ? [routineId] : Array.from(new Set(activePendingEvents.map((event) => event.routineId)));
      await Promise.all(routineIds.map((routineId) => requestCheck(routineId)));
      setActiveReminderStatus('sent');
    } catch (error) {
      console.error(error);
      setActiveReminderStatus('error');
    } finally {
      setRequestingActiveReminder(false);
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
  const activeParticipantAccess = state.participantAccess?.find((entry) => entry.participant.id === state.activeParticipantId)
    ?? state.participantAccess?.find((entry) => entry.membership.status === 'active');
  return (
    <div className="content-screen child-home parent-overview-screen">
      <div className="page-context-top parent-context-top">
        <header className="screen-header page-context-heading">
          <div><h1>{t('activity')}</h1></div>
        </header>
      <ParticipantSelector
        access={state.participantAccess}
        activeParticipantId={state.activeParticipantId}
        label={t('followedPerson')}
        title={activeParticipantAccess?.participant.displayName ?? state.family.childName}
        actionLabel={t('relationshipSwitchAction')}
        onSelect={onSelectParticipant}
      />
      </div>

      {setupStep ? (
        <section className="card parent-onboarding-card" aria-labelledby="parent-onboarding-title">
          <div className="parent-onboarding-heading">
            <span className="eyebrow">{t('parentSetupEyebrow')}</span>
            <h2 id="parent-onboarding-title">{t('parentSetupTitle')}</h2>
            <p>{t(setupStep === 2 ? 'parentSetupLinkHint' : 'parentSetupRoutineHint')}</p>
          </div>
          <SetupProgress current={setupStep} role="parent" t={t} />
        </section>
      ) : null}

      {(responsibleEmptyState || activePendingEvents.length || (!state.family.childLinked && state.family.linkingCode) || (!state.routineAssignments.length && onCreateRoutine)) ? (
        <section className="settings-section parent-setup-section" aria-labelledby="parent-setup-title">
          <h2 id="parent-setup-title">{activePendingEvents.length ? `${activePendingEvents.length} ${t(activePendingEvents.length === 1 ? 'checkToComplete' : 'checksToComplete')}` : t('responsibleCurrentChecksTitle')}</h2>

          <div className="today-task-list">
            {activePendingEvents.length ? (
              <>
                {activePendingEvents
                  .slice()
                  .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))
                  .map((event) => {
                    const presentation = routinePresentationFor(event);
                    const proofExample = routineProofExampleFor(event);
                    return (
                      <article className="today-task today-routine-card parent-active-check-card actionable" style={presentation.style} key={event.id}>
                        <div className="today-routine-main">
                          <div className="today-routine-primary">
                            <div className="today-task-copy">
                              <span className="settings-row-icon today-task-icon" aria-hidden="true"><AppIcon name={routineIconName(presentation.icon)} /></span>
                              <div>
                                <h3>{presentation.name}</h3>
                                <p className="today-task-time">{eventWindowLabel(event.requestedAt, event.expiresAt, nowDate, locale, t)}</p>
                                {proofExample ? <p className="routine-proof-context"><b>{t('expectedProof')}:</b> {proofExample}</p> : null}
                              </div>
                            </div>
                            {requestCheck ? (
                              <button
                                type="button"
                                className="primary-action-button today-proof-button parent-remind-button"
                                aria-label={t('requestCheckAgain')}
                                aria-busy={requestingActiveReminder}
                                disabled={requestingActiveReminder}
                                onClick={() => { void resendActiveReminders(event.routineId); }}
                              >
                                {requestingActiveReminder ? <span className="button-spinner" aria-hidden="true" /> : null}
                                {requestingActiveReminder ? t('requestingCheck') : t('requestCheckShort')}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                {activeReminderStatus === 'sent' ? <span className="request-feedback success">{t('requestCheckSent')}</span> : null}
                {activeReminderStatus === 'error' ? <span className="request-feedback error">{t('requestCheckError')}</span> : null}
              </>
            ) : null}

            {responsibleEmptyState ? (
              <EmptyState
                className="responsible-state-card"
                icon={responsibleEmptyState.icon}
                title={responsibleEmptyState.title}
                detail={responsibleEmptyState.hint}
              >
                {!state.routineAssignments.length && onCreateRoutine ? (
                  <button type="button" className="request-check responsible-state-primary-action" onClick={onCreateRoutine}>{t('chooseRoutine')}</button>
                ) : null}
                {requestCheck && activePendingEvents.length ? (
                  <div className="responsible-state-actions">
                    <button
                      type="button"
                      className="responsible-reminder-button"
                      aria-label={t('requestCheckAgain')}
                      aria-busy={requestingActiveReminder}
                      disabled={requestingActiveReminder}
                      onClick={() => { void resendActiveReminders(); }}
                    >
                      {requestingActiveReminder ? <span className="button-spinner" aria-hidden="true" /> : <AppIcon name="send" />}
                      {requestingActiveReminder ? t('requestingCheck') : t('requestCheckAgain')}
                    </button>
                    {activeReminderStatus === 'sent' ? <span className="request-feedback success">{t('requestCheckSent')}</span> : null}
                    {activeReminderStatus === 'error' ? <span className="request-feedback error">{t('requestCheckError')}</span> : null}
                  </div>
                ) : null}
              </EmptyState>
            ) : null}

            {!state.family.childLinked && state.family.linkingCode ? (
              <CodeBox
                label={t('childLinkCode')}
                hint={t('childLinkCodeHint')}
                value={state.family.linkingCode}
                t={t}
                action={(
                  <>
                    <button type="button" className="regenerate-code" aria-busy={regenerating} disabled={regenerating} onClick={() => { void regenerate(); }}>
                      {regenerating ? <span className="button-spinner" aria-hidden="true" /> : null}
                      {regenerating ? t('regeneratingCode') : t('regenerateCode')}
                    </button>
                    {codeError ? <span className="form-error">{t('regenerateCodeError')}</span> : null}
                  </>
                )}
              />
            ) : null}

          </div>
        </section>
      ) : null}

      {!activePendingEvents.length && state.family.childLinked && state.routineAssignments.length && upcomingChecks.length ? (
        <UpcomingChecksSection checks={upcomingChecks} now={nowDate} locale={locale} titleId="responsible-upcoming-checks-title" t={t} />
      ) : null}

      {reviewEvents.length ? (
        <section className="settings-section parent-review-section" aria-labelledby="parent-review-title">
          <div className="section-heading parent-review-heading">
            <h2 id="parent-review-title">{t('responsibleReviewTitle')}</h2>
            <span>{reviewEvents.length}</span>
          </div>
          <div className="parent-review-list">
            {reviewEvents.map((event) => {
              const proofUrl = proofUrls[event.id];
              const reason = displayReason(event);
              const source = analysisSourceLabel(event);
              const confidence = formatScore(event.confidence);
              const quality = formatScore(event.imageQuality);
              const proofExample = routineProofExampleFor(event);
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
                          {proofExample ? <p className="routine-proof-context"><b>{t('expectedProof')}:</b> {proofExample}</p> : null}
                        </div>
                      </div>
                      {(source || confidence || quality) ? (
                        <div className="parent-review-analysis">
                          {source ? <span>{t('analysisSource')}: {source}</span> : null}
                          <span>{t('analysisVerdict')}: {automatedVerdictLabel(event)}</span>
                          {confidence ? <span>{t('analysisConfidence')} {confidence}</span> : null}
                          {quality ? <span>{t('analysisQuality')} {quality}</span> : null}
                        </div>
                      ) : null}
                      {reason ? <p>{reason}</p> : null}
                      {reviewErrorId === event.id ? <p className="request-feedback error">{t('responsibleReviewError')}</p> : null}
                    </div>
                    <div className="parent-review-actions">
                      <button
                        type="button"
                        className="parent-review-button reject"
                        aria-label={t('responsibleReviewReject')}
                        disabled={reviewingId === event.id}
                        onClick={() => { void decide(event.id, 'not_detected'); }}
                      >
                        <AppIcon name="close" />
                      </button>
                      <button
                        type="button"
                        className="parent-review-button approve"
                        aria-label={t('responsibleReviewApprove')}
                        disabled={reviewingId === event.id}
                        onClick={() => { void decide(event.id, 'detected'); }}
                      >
                        <AppIcon name="check" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {enlargedProofUrl ? (
        <ProofLightbox src={enlargedProofUrl} alt={t('responsibleReviewImageAlt')} closeLabel={t('close')} onClose={() => setEnlargedProofUrl(undefined)} />
      ) : null}

      <section className="today-section participant-history-section parent-history-section dashboard-summary-section" aria-labelledby="responsible-summary-title">
        <h2 id="responsible-summary-title">{t('overview')}</h2>
        <AdherenceSummaryCard events={displayEvents} range={summaryRange} onRangeChange={setSummaryRange} t={t} />
        <RoutineHistoryPanel assignments={state.routineAssignments} events={rangedRawEvents} locale={state.locale} titleId="responsible-history-title" onRequestCheck={requestCheck} onOpenEvent={onOpenHistoryEvent} t={t} />
      </section>
    </div>
  );
}
