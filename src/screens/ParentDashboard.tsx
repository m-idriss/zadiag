import { useEffect, useMemo, useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import type { AppState, MonitoringPlan, VerificationEvent } from '../domain/models';
import type { MessageKey } from '../services/i18n';
import { AppIcon, routineIconName } from '../components/Icon';
import { CodeBox } from '../components/CodeBox';
import { RoutineHistoryPanel } from '../components/RoutineHistoryPanel';
import { AdherenceSummaryCard, filterEventsBySummaryRange, type SummaryRange } from '../components/AdherenceSummaryCard';
import { UpcomingChecksSection } from '../components/UpcomingChecksSection';
import { presentRoutine } from '../domain/routinePresentation';
import { eventWindowLabel } from '../domain/taskTimeLabel';
import { isReviewableVerification, withResolvedEventStatuses } from '../domain/adherence';
import { EmptyState } from '../components/ui';
import { activePendingEvents as activePendingChecks, presentedAwaitingRoutineChecks, presentedUpcomingRoutineChecks } from '../domain/dashboardChecks';
import { ParticipantSelector } from '../components/ParticipantSelector';
import { languageTag } from '../services/locale';
import { ProofLightbox } from '../components/ProofLightbox';
import { SetupProgress } from '../components/SetupProgress';
import { DashboardStatusSummary } from '../components/DashboardStatusSummary';
import { NotificationCenter } from '../components/NotificationCenter';
import { AwaitingCheckCards } from '../components/AwaitingCheckCards';
import { useCurrentTime } from '../hooks/useCurrentTime';
import { VerificationEventDetailDialog } from '../components/VerificationEventDetailDialog';
import { planningRecommendation, routineAnomalies, weeklyInsight } from '../domain/reporting';
import { DisclosureToggle } from '../components/DisclosureToggle';

export function ParentDashboard({
  state,
  regenerateCode,
  onCreateRoutine,
  getProofImageUrl,
  reviewCheck,
  requestCheck,
  updateRoutine,
  summaryRange: controlledSummaryRange,
  onSummaryRangeChange,
  onSelectParticipant,
  onOpenNotificationEvent,
  notificationEventId,
  onNotificationEventConsumed,
  t,
}: {
  state: AppState;
  regenerateCode: () => Promise<void>;
  onCreateRoutine?: () => void;
  getProofImageUrl?: (eventId: string) => Promise<string>;
  reviewCheck?: (eventId: string, decision: 'detected' | 'not_detected') => Promise<void>;
  requestCheck?: (routineId: string) => Promise<void>;
  updateRoutine?: (routineId: string, plan: MonitoringPlan) => Promise<void>;
  summaryRange?: SummaryRange;
  onSummaryRangeChange?: (range: SummaryRange) => void;
  onSelectParticipant?: (participantId: string) => void;
  onOpenNotificationEvent?: (participantId: string, event: VerificationEvent) => void;
  notificationEventId?: string;
  onNotificationEventConsumed?: () => void;
  t: (key: MessageKey) => string;
}) {
  const [regenerating, setRegenerating] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [localSummaryRange, setLocalSummaryRange] = useState<SummaryRange>('day');
  const [expandedStatus, setExpandedStatus] = useState<'active' | 'review' | 'next'>();
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [proofErrors, setProofErrors] = useState<Record<string, boolean>>({});
  const [reviewingId, setReviewingId] = useState<string>();
  const [reviewErrorId, setReviewErrorId] = useState<string>();
  const [requestingActiveReminder, setRequestingActiveReminder] = useState(false);
  const [activeReminderStatus, setActiveReminderStatus] = useState<'sent' | 'error'>();
  const [enlargedProofUrl, setEnlargedProofUrl] = useState<string>();
  const [detailEventId, setDetailEventId] = useState<string>();
  const [dismissedAnomaly, setDismissedAnomaly] = useState<string>();
  const [planningRecommendationOpen, setPlanningRecommendationOpen] = useState(false);
  const [planningRecommendationStatus, setPlanningRecommendationStatus] = useState<'saving' | 'saved' | 'error'>();
  const [weeklyReportOpenSignal, setWeeklyReportOpenSignal] = useState(0);
  const [weeklyInsightOpen, setWeeklyInsightOpen] = useState(false);
  const swipeStartRef = useRef<{ eventId: string; x: number; y: number } | undefined>(undefined);
  const handledNotificationEventIdRef = useRef<string | undefined>(undefined);
  const summaryRange = controlledSummaryRange ?? localSummaryRange;
  const setSummaryRange = onSummaryRangeChange ?? setLocalSummaryRange;
  const now = useCurrentTime();
  const displayEvents = useMemo(() => withResolvedEventStatuses(state.events, now), [now, state.events]);
  const detailEvent = displayEvents.find((event) => event.id === detailEventId);
  const rangedEvents = filterEventsBySummaryRange(displayEvents, summaryRange, now);
  const rangedRawEvents = filterEventsBySummaryRange(state.events, summaryRange, now);
  const reviewEvents = useMemo(() => state.events
    .filter(isReviewableVerification)
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
  const awaitingChecks = useMemo(() => presentedAwaitingRoutineChecks(state.routineAssignments, state.events, state.locale, nowDate),
  [nowDate, state.events, state.locale, state.routineAssignments]);
  const currentCheckCount = activePendingEvents.length + awaitingChecks.length;
  const reportSubjectName = state.participantAccess?.find((entry) => entry.participant.id === state.activeParticipantId)?.participant.displayName
    ?? state.participantAccess?.find((entry) => entry.membership.status === 'active')?.participant.displayName
    ?? state.family.childName;
  const upcomingChecks = useMemo(() => presentedUpcomingRoutineChecks(state.routineAssignments, state.locale, nowDate),
  [nowDate, state.locale, state.routineAssignments]);
  const anomaly = useMemo(() => routineAnomalies(displayEvents, now)
    .sort((a, b) => b.failed - a.failed)[0], [displayEvents, now]);
  const anomalyFingerprint = anomaly ? `${anomaly.routineId}:${anomaly.latestEventId}` : undefined;
  const anomalyStorageKey = `zadiag.dashboard.anomaly.${state.activeParticipantId ?? state.family.childName}`;
  const visibleAnomaly = anomaly && dismissedAnomaly !== anomalyFingerprint
    && localStorage.getItem(anomalyStorageKey) !== anomalyFingerprint ? anomaly : undefined;
  const anomalyAssignment = visibleAnomaly ? state.routineAssignments.find((assignment) => assignment.routineId === visibleAnomaly.routineId) : undefined;
  const recommendedPlan = anomalyAssignment ? planningRecommendation(anomalyAssignment, displayEvents, now) : undefined;
  const weekly = useMemo(() => weeklyInsight(state.routineAssignments, displayEvents, now), [displayEvents, now, state.routineAssignments]);
  const weeklyPriorityKey: MessageKey | undefined = weekly ? {
    adjust_schedule: 'weeklyPriorityAdjustSchedule',
    review_proofs: 'weeklyPriorityReviewProofs',
    support_consistency: 'weeklyPrioritySupportConsistency',
    keep_course: 'weeklyPriorityKeepCourse',
  }[weekly.priority] as MessageKey : undefined;
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
  const notificationSources = state.notificationSources?.length ? state.notificationSources : activeParticipantAccess ? [{
    participant: activeParticipantAccess.participant,
    role: 'parent' as const,
    assignments: state.routineAssignments,
    events: displayEvents,
  }] : [];
  useEffect(() => {
    setExpandedStatus(undefined);
    setDismissedAnomaly(undefined);
    setPlanningRecommendationOpen(false);
    setPlanningRecommendationStatus(undefined);
    setWeeklyInsightOpen(false);
  }, [state.activeParticipantId]);
  useEffect(() => {
    if (!notificationEventId) {
      handledNotificationEventIdRef.current = undefined;
      return;
    }
    if (handledNotificationEventIdRef.current === notificationEventId) return;
    const event = state.events.find((item) => item.id === notificationEventId);
    if (!event) return;
    handledNotificationEventIdRef.current = notificationEventId;
    const needsReview = isReviewableVerification(event);
    const active = event.status === 'pending' && Date.parse(event.expiresAt) > now;
    if (needsReview) setExpandedStatus('review');
    else if (active) setExpandedStatus('active');
    setDetailEventId(event.id);
    onNotificationEventConsumed?.();
  }, [notificationEventId, now, onNotificationEventConsumed, state.events]);
  return (
    <div className="content-screen child-home parent-overview-screen">
      <div className="page-context-top parent-context-top">
        <header className="screen-header page-context-heading">
          <div><h1>{t('activity')}</h1></div>
          <NotificationCenter
            role="parent"
            sources={notificationSources}
            locale={state.locale}
            contextId="account"
            onOpenEvent={(participantId, event) => {
              if (onOpenNotificationEvent) onOpenNotificationEvent(participantId, event);
              else setDetailEventId(event.id);
            }}
            t={t}
          />
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

      {!setupStep ? (
        <DashboardStatusSummary
          label={t('dashboardStatusSummary')}
          items={[
            { id: 'active', label: t('dashboardActive'), value: currentCheckCount },
            { id: 'review', label: t('dashboardReview'), value: reviewEvents.length, tone: 'attention' },
            { id: 'next', label: t('dashboardNext'), value: upcomingChecks.length },
          ]}
          selectedId={expandedStatus}
          onSelect={(id) => setExpandedStatus((current) => current === id ? undefined : id as typeof current)}
        />
      ) : null}

      {visibleAnomaly ? (
        <section className="card routine-anomaly-card" role="status" aria-labelledby="routine-anomaly-title">
          <span className="settings-row-icon" aria-hidden="true"><AppIcon name="stats" /></span>
          <div>
            <span className="eyebrow">{t('routineAnomalyEyebrow')}</span>
            <h2 id="routine-anomaly-title">{routinePresentationsById.get(visibleAnomaly.routineId)?.name ?? t('routine')}</h2>
            <p>{t(visibleAnomaly.kind === 'missed' ? 'routineAnomalyMissed' : 'routineAnomalyRejected')}</p>
            <small>{visibleAnomaly.failed}/{visibleAnomaly.checked} {t('routineAnomalyRecentChecks')}</small>
          </div>
          <button type="button" className="routine-anomaly-action" disabled={planningRecommendationStatus === 'saving'} onClick={() => {
            if (recommendedPlan && updateRoutine) setPlanningRecommendationOpen((current) => !current);
            else if (visibleAnomaly.kind === 'missed' && requestCheck) {
              setExpandedStatus('active');
              void resendActiveReminders(visibleAnomaly.routineId);
            }
            else setSummaryRange('week');
          }}>{t(recommendedPlan && updateRoutine ? 'planningSuggestionView' : visibleAnomaly.kind === 'missed' && requestCheck ? 'routineAnomalyRequest' : 'routineAnomalyReview')}</button>
          <button type="button" className="routine-anomaly-dismiss" aria-label={t('routineAnomalyDismiss')} onClick={() => {
            if (!anomalyFingerprint) return;
            localStorage.setItem(anomalyStorageKey, anomalyFingerprint);
            setDismissedAnomaly(anomalyFingerprint);
          }}><AppIcon name="close" /></button>
          {planningRecommendationOpen && recommendedPlan && updateRoutine ? (
            <div className="planning-recommendation">
              <h3>{t('planningSuggestionTitle')}</h3>
              <p>{t('planningSuggestionDetail')} <strong>{recommendedPlan.removedWindow.start}–{recommendedPlan.removedWindow.end}</strong></p>
              {recommendedPlan.preservedWindow ? <p>{t('planningSuggestionPreserved')} <strong>{recommendedPlan.preservedWindow.start}–{recommendedPlan.preservedWindow.end}</strong></p> : null}
              <div className="planning-recommendation-comparison">
                <span><small>{t('planningSuggestionCurrent')}</small><strong>{recommendedPlan.previousChecksPerDay} {t('checksDay')}</strong></span>
                <AppIcon name="chevron-forward" />
                <span><small>{t('planningSuggestionProposed')}</small><strong>{recommendedPlan.proposedChecksPerDay} {t('checksDay')}</strong></span>
              </div>
              <p className="planning-recommendation-note">{t('planningSuggestionNote')}</p>
              {planningRecommendationStatus === 'saved' ? <p className="request-feedback success" role="status">{t('planningSuggestionSaved')}</p> : null}
              {planningRecommendationStatus === 'error' ? <p className="request-feedback error" role="alert">{t('planningSuggestionError')}</p> : null}
              <button type="button" disabled={planningRecommendationStatus === 'saving' || planningRecommendationStatus === 'saved'} onClick={() => {
                setPlanningRecommendationStatus('saving');
                void updateRoutine(recommendedPlan.routineId, recommendedPlan.plan)
                  .then(() => setPlanningRecommendationStatus('saved'))
                  .catch((error) => { console.error(error); setPlanningRecommendationStatus('error'); });
              }}>{planningRecommendationStatus === 'saving' ? t('planningSuggestionApplying') : t('planningSuggestionApply')}</button>
            </div>
          ) : null}
        </section>
      ) : null}

      {(responsibleEmptyState || (expandedStatus === 'active' && currentCheckCount) || (!state.family.childLinked && state.family.linkingCode) || (!state.routineAssignments.length && onCreateRoutine)) ? (
        <section className="settings-section parent-setup-section" aria-labelledby="parent-setup-title">
          <h2 id="parent-setup-title">{currentCheckCount ? `${currentCheckCount} ${t(currentCheckCount === 1 ? 'checkToComplete' : 'checksToComplete')}` : t('responsibleCurrentChecksTitle')}</h2>

          <div className="today-task-list">
            {expandedStatus === 'active' && activePendingEvents.length ? (
              <>
                {activePendingEvents
                  .slice()
                  .sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt))
                  .map((event) => {
                    const presentation = routinePresentationFor(event);
                    const proofExample = routineProofExampleFor(event);
                    return (
                      <article id={`active-${event.id}`} className="today-task today-routine-card parent-active-check-card actionable" style={presentation.style} key={event.id}>
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
            {expandedStatus === 'active' ? <AwaitingCheckCards checks={awaitingChecks} now={nowDate} locale={locale} t={t} /> : null}

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

      {state.family.childLinked ? (
        <section className="card weekly-insight-card" aria-labelledby="weekly-insight-title">
          <div className="weekly-insight-heading">
            <div><span className="eyebrow">{t('weeklyInsightEyebrow')}</span><h2 id="weekly-insight-title">{t('weeklyInsightTitle')}</h2></div>
            <span className="weekly-insight-rate"><strong>{weekly ? `${Math.round(weekly.rate * 100)}%` : '—'}</strong></span>
            <DisclosureToggle
              expanded={weeklyInsightOpen}
              showLabel={t('weeklyInsightShow')}
              hideLabel={t('weeklyInsightHide')}
              onToggle={() => setWeeklyInsightOpen((open) => !open)}
            />
          </div>
          {weeklyInsightOpen ? <div className="weekly-insight-content">
            {weekly && weeklyPriorityKey ? (
              <>
                <p className="weekly-insight-evolution">{weekly.rateDelta === undefined
                  ? t('summaryNoPreviousBaseline')
                  : weekly.rateDelta === 0
                    ? t('summaryComparedStable')
                    : `${t(weekly.rateDelta > 0 ? 'weeklyInsightUp' : 'weeklyInsightDown')} ${Math.abs(Math.round(weekly.rateDelta * 100))} ${t('summaryPoints')}`}</p>
                <div className="weekly-insight-metrics">
                  {weekly.strongestRoutineId && weekly.strongestRoutineId !== weekly.watchRoutineId ? <span><small>{t('weeklyInsightStrongest')}</small><strong>{routinePresentationsById.get(weekly.strongestRoutineId)?.name ?? t('routine')}</strong></span> : null}
                  {weekly.watchRoutineId ? <span><small>{t('weeklyInsightWatch')}</small><strong>{routinePresentationsById.get(weekly.watchRoutineId)?.name ?? t('routine')}</strong></span> : null}
                  {weekly.bestWindow ? <span><small>{t('weeklyInsightBestWindow')}</small><strong>{weekly.bestWindow.start}–{weekly.bestWindow.end}</strong></span> : null}
                  <span><small>{t('weeklyInsightResponsibleActions')}</small><strong>{weekly.responsibleActions.length ? weekly.responsibleActions.map((actor) => `${actor.actorName} · ${actor.count}`).join(', ') : weekly.responsibleActionCount}</strong></span>
                </div>
                <div className="weekly-insight-priority"><AppIcon name="sparkles" /><p><small>{t('weeklyInsightPriority')}</small><strong>{t(weeklyPriorityKey)}</strong></p></div>
                <button type="button" onClick={() => { setSummaryRange('week'); setWeeklyReportOpenSignal((current) => current + 1); }}>{t('weeklyInsightOpenReport')}</button>
              </>
            ) : <p className="weekly-insight-empty">{t('weeklyInsightEmpty')}</p>}
          </div> : null}
        </section>
      ) : null}

      {expandedStatus === 'review' && reviewEvents.length ? (
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
                  id={`review-${event.id}`}
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

      {expandedStatus === 'next' && state.family.childLinked && state.routineAssignments.length && upcomingChecks.length ? (
        <UpcomingChecksSection checks={upcomingChecks} now={nowDate} locale={locale} titleId="responsible-upcoming-checks-title" t={t} />
      ) : null}

      {enlargedProofUrl ? (
        <ProofLightbox src={enlargedProofUrl} alt={t('responsibleReviewImageAlt')} closeLabel={t('close')} onClose={() => setEnlargedProofUrl(undefined)} />
      ) : null}

      <section className="today-section participant-history-section parent-history-section dashboard-summary-section" aria-labelledby="responsible-summary-title">
        <h2 id="responsible-summary-title">{t('overview')}</h2>
        <AdherenceSummaryCard events={displayEvents} assignments={state.routineAssignments} locale={state.locale} subjectName={reportSubjectName} range={summaryRange} onRangeChange={setSummaryRange} detailedReportOpenSignal={weeklyReportOpenSignal} t={t} />
        <RoutineHistoryPanel assignments={state.routineAssignments} events={rangedRawEvents} locale={state.locale} titleId="responsible-history-title" onRequestCheck={requestCheck} onOpenEvent={(event) => setDetailEventId(event.id)} t={t} />
      </section>
      {detailEvent ? <VerificationEventDetailDialog event={detailEvent} locale={state.locale} proofUrl={proofUrls[detailEvent.id]} getProofImageUrl={getProofImageUrl} reviewCheck={reviewCheck} requestCheck={requestCheck} onClose={() => setDetailEventId(undefined)} t={t} /> : null}
    </div>
  );
}
