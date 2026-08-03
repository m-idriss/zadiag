import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Locale, ParticipantAccess, ParticipantNotificationSource, ReviewCheckDecision, RoutineAssignment, VerificationEvent } from '../domain/models';
import { profileColorFor } from '../domain/profileColor';
import { isReviewableVerification, withResolvedEventStatuses } from '../domain/adherence';
import type { MessageKey } from '../services/i18n';
import { AdherenceSummaryCard, filterEventsBySummaryRange, type SummaryRange } from './AdherenceSummaryCard';
import { RoutineHistoryPanel } from './RoutineHistoryPanel';
import { HistoryFilterControls, useHistoryFilters } from './HistoryFilters';
import { DashboardStatusSummary } from './DashboardStatusSummary';
import { activePendingEvents, presentedAwaitingRoutineChecks, presentedUpcomingRoutineChecks } from '../domain/dashboardChecks';
import { participantAccessCan } from '../domain/participantAccess';
import { presentRoutine } from '../domain/routinePresentation';
import { AppIcon, routineIconName } from './Icon';
import { plannedWindowLabel } from '../domain/taskTimeLabel';
import { languageTag } from '../services/locale';
import { WeeklyInsightCard } from './WeeklyInsightCard';
import { ListRow } from './ui';
import { UpcomingCheckActionMenu } from './UpcomingCheckActionMenu';
import { VerificationEventDetailDialog } from './VerificationEventDetailDialog';
import { ProofLightbox } from './ProofLightbox';

type CollectiveParticipant = { id: string; displayName: string; profileColor: string };
type CollectiveEventContext = { participant: CollectiveParticipant; event: VerificationEvent };

const collectiveDashboardData = (sources: ParticipantNotificationSource[]) => {
  const assignments: RoutineAssignment[] = [];
  const events: VerificationEvent[] = [];
  const eventContext = new Map<string, CollectiveEventContext>();
  sources.forEach((source) => {
    const routineId = (id: string) => `${source.participant.id}:${id}`;
    source.assignments.forEach((assignment) => assignments.push({
      ...assignment,
      id: `${source.participant.id}:${assignment.id}`,
      routineId: routineId(assignment.routineId),
    }));
    source.events.forEach((event) => {
      const id = `${source.participant.id}:${event.id}`;
      events.push({
        ...event,
        id,
        sessionId: `${source.participant.id}:${event.sessionId}`,
        routineId: routineId(event.routineId),
      });
      eventContext.set(id, {
        event,
        participant: {
          id: source.participant.id,
          displayName: source.participant.displayName,
          profileColor: profileColorFor(source.participant),
        },
      });
    });
  });
  return { assignments, events, eventContext };
};

export function ParticipantDashboardOverview({
  sources,
  locale,
  range,
  now,
  onRangeChange,
  selectedStatus: controlledSelectedStatus,
  onSelectedStatusChange,
  participantAccess,
  requestParticipantCheck,
  skipParticipantPlannedCheck,
  onEditParticipantRoutinePlan,
  reviewParticipantCheck,
  cancelParticipantCheck,
  getParticipantProofImageUrl,
  t,
}: {
  sources: ParticipantNotificationSource[];
  locale: Locale;
  range: SummaryRange;
  now: number;
  onRangeChange: (range: SummaryRange) => void;
  selectedStatus?: 'active' | 'review' | 'next';
  onSelectedStatusChange?: (status: 'active' | 'review' | 'next' | undefined) => void;
  participantAccess?: ParticipantAccess[];
  requestParticipantCheck?: (participantId: string, routineId: string) => Promise<void>;
  skipParticipantPlannedCheck?: (participantId: string, routineId: string, plannedStart: Date, plannedEnd: Date) => Promise<void>;
  onEditParticipantRoutinePlan?: (participantId: string, routineId: string) => void | Promise<void>;
  reviewParticipantCheck?: (participantId: string, eventId: string, decision: ReviewCheckDecision) => Promise<void>;
  cancelParticipantCheck?: (participantId: string, eventId: string) => Promise<void>;
  getParticipantProofImageUrl?: (participantId: string, eventId: string) => Promise<string>;
  t: (key: MessageKey) => string;
}) {
  const { assignments, events, eventContext } = useMemo(() => collectiveDashboardData(sources), [sources]);
  const collective = sources.length > 1;
  const resolvedEvents = useMemo(() => withResolvedEventStatuses(events, now), [events, now]);
  const [localSelectedStatus, setLocalSelectedStatus] = useState<'active' | 'review' | 'next'>();
  const expandedStatus = controlledSelectedStatus ?? localSelectedStatus;
  const setExpandedStatus = onSelectedStatusChange ?? setLocalSelectedStatus;
  const [requestingKey, setRequestingKey] = useState<string>();
  const [reviewingKey, setReviewingKey] = useState<string>();
  const [actionError, setActionError] = useState<'request' | 'review'>();
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [proofErrors, setProofErrors] = useState<Record<string, boolean>>({});
  const [detailEventId, setDetailEventId] = useState<string>();
  const [enlargedProof, setEnlargedProof] = useState<{ participantId: string; eventId: string; url: string; canReview: boolean }>();
  const historyFilters = useHistoryFilters('collective-history-title');
  const dateTimeFormatter = useMemo(() => new Intl.DateTimeFormat(languageTag(locale), { dateStyle: 'short', timeStyle: 'short' }), [locale]);
  const visibleEvents = resolvedEvents;
  const visibleAssignments = assignments;
  const rangedEvents = useMemo(() => filterEventsBySummaryRange(visibleEvents, range), [range, visibleEvents]);
  const operationalSources = useMemo(() => sources.map((source) => {
    const access = participantAccess?.find((entry) => entry.participant.id === source.participant.id);
    const participant = {
      id: source.participant.id,
      displayName: source.participant.displayName,
      profileColor: profileColorFor(source.participant),
    };
    const presentationFor = (routineId: string) => {
      const assignment = source.assignments.find((item) => item.routineId === routineId);
      return assignment ? presentRoutine(assignment.routine, locale) : { name: t('routine'), icon: undefined, proofExample: undefined, style: {} };
    };
    return {
      participant,
      canRequest: Boolean(requestParticipantCheck && participantAccessCan(access, 'requestChecks')),
      canSkip: Boolean(skipParticipantPlannedCheck && participantAccessCan(access, 'requestChecks')),
      canManage: Boolean(onEditParticipantRoutinePlan && participantAccessCan(access, 'manageRoutines')),
      canReview: Boolean(reviewParticipantCheck && participantAccessCan(access, 'reviewProofs')),
      active: activePendingEvents(source.events, now).map((event) => ({
        event,
        presentation: presentationFor(event.routineId),
      })),
      awaiting: presentedAwaitingRoutineChecks(source.assignments, source.events, locale, new Date(now)),
      review: source.events.filter(isReviewableVerification)
        .sort((left, right) => Date.parse(right.capturedAt ?? right.requestedAt) - Date.parse(left.capturedAt ?? left.requestedAt)),
      upcoming: presentedUpcomingRoutineChecks(source.assignments, locale, new Date(now), source.events),
      presentationFor,
    };
  }), [locale, now, onEditParticipantRoutinePlan, participantAccess, requestParticipantCheck, reviewParticipantCheck, skipParticipantPlannedCheck, sources, t]);
  const activeCount = operationalSources.reduce((count, source) => count + source.active.length + source.awaiting.length, 0);
  const reviewCount = operationalSources.reduce((count, source) => count + source.review.length, 0);
  const upcomingCount = operationalSources.reduce((count, source) => count + source.upcoming.length, 0);
  useEffect(() => {
    if (expandedStatus !== 'review' || !getParticipantProofImageUrl) return;
    let cancelled = false;
    const loadProofs = async () => {
      for (const source of operationalSources) {
        for (const event of source.review) {
          const key = `${source.participant.id}:${event.id}`;
          if (proofUrls[key] || proofErrors[key]) continue;
          try {
            const url = await getParticipantProofImageUrl(source.participant.id, event.id);
            if (!cancelled) setProofUrls((current) => ({ ...current, [key]: url }));
          } catch (error) {
            console.error(error);
            if (!cancelled) setProofErrors((current) => ({ ...current, [key]: true }));
          }
        }
      }
    };
    void loadProofs();
    return () => { cancelled = true; };
  }, [expandedStatus, getParticipantProofImageUrl, operationalSources, proofErrors, proofUrls]);
  const request = async (participantId: string, routineId: string) => {
    if (!requestParticipantCheck || requestingKey) return;
    const key = `${participantId}:${routineId}`;
    setRequestingKey(key);
    setActionError(undefined);
    try {
      await requestParticipantCheck(participantId, routineId);
    } catch (error) {
      console.error(error);
      setActionError('request');
    } finally {
      setRequestingKey(undefined);
    }
  };
  const review = async (participantId: string, eventId: string, decision: ReviewCheckDecision) => {
    if (!reviewParticipantCheck || reviewingKey) return false;
    const key = `${participantId}:${eventId}`;
    setReviewingKey(key);
    setActionError(undefined);
    try {
      await reviewParticipantCheck(participantId, eventId, decision);
      return true;
    } catch (error) {
      console.error(error);
      setActionError('review');
      return false;
    } finally {
      setReviewingKey(undefined);
    }
  };

  return (
    <section className="today-section participant-history-section parent-history-section parent-dashboard-overview-section dashboard-summary-section participant-dashboard-overview" aria-labelledby="collective-summary-title">
      <h2 id="collective-summary-title">{t('overview')}</h2>
      <DashboardStatusSummary
        label={t('dashboardStatusSummary')}
        items={[
          { id: 'active', label: t('dashboardActive'), value: activeCount },
          { id: 'review', label: t('dashboardReview'), value: reviewCount, tone: 'attention' },
          { id: 'next', label: t('dashboardNext'), value: upcomingCount },
        ]}
        selectedId={expandedStatus}
        onSelect={(id) => setExpandedStatus(expandedStatus === id ? undefined : id as typeof expandedStatus)}
      />
      {expandedStatus === 'active' && activeCount ? (
        <section className="settings-section collective-operational-section" aria-label={t('dashboardActive')}>
          <div className="history-list parent-history-list">
            {operationalSources.flatMap((source) => [
              ...source.active.map(({ event, presentation }) => (
                <ListRow
                  as="article"
                  variant="bare"
                  className="card history-row parent-history-row has-participant-accent parent-active-check-card"
                  icon={<AppIcon name={routineIconName(presentation.icon)} />}
                  iconClassName="history-icon routine-history-icon"
                  title={presentation.name}
                  detail={source.participant.displayName}
                  style={{ ...presentation.style, '--history-participant-color': source.participant.profileColor } as CSSProperties}
                  trailing={source.canRequest ? (
                    <div className="history-row-actions">
                      <button type="button" className="history-retake-button" disabled={Boolean(requestingKey)} onClick={() => { void request(source.participant.id, event.routineId); }}>
                        {requestingKey === `${source.participant.id}:${event.routineId}` ? t('requestingCheck') : t('requestCheckShort')}
                      </button>
                    </div>
                  ) : null}
                  key={`${source.participant.id}:${event.id}`}
                />
              )),
              ...source.awaiting.map((item) => (
                <ListRow
                  as="article"
                  variant="bare"
                  className="card history-row parent-history-row has-participant-accent parent-active-check-card"
                  icon={<AppIcon name={routineIconName(item.presentation.icon)} />}
                  iconClassName="history-icon routine-history-icon"
                  title={item.presentation.name}
                  detail={source.participant.displayName}
                  style={{ ...item.presentation.style, '--history-participant-color': source.participant.profileColor } as CSSProperties}
                  trailing={source.canRequest ? (
                    <div className="history-row-actions">
                      <button type="button" className="history-retake-button" disabled={Boolean(requestingKey)} onClick={() => { void request(source.participant.id, item.routineId); }}>
                        {requestingKey === `${source.participant.id}:${item.routineId}` ? t('requestingCheck') : t('requestCheckShort')}
                      </button>
                    </div>
                  ) : null}
                  key={`${source.participant.id}:awaiting:${item.id}`}
                />
              )),
            ])}
            {actionError === 'request' ? <span className="request-feedback error" role="alert">{t('requestCheckError')}</span> : null}
          </div>
        </section>
      ) : null}
      {expandedStatus === 'review' && reviewCount ? (
        <section className="settings-section parent-review-section collective-operational-section" aria-label={t('dashboardReview')}>
          <div className="section-heading parent-review-heading"><h2>{t('responsibleReviewTitle')}</h2><span>{reviewCount}</span></div>
          <div className="parent-review-list">
            {operationalSources.flatMap((source) => source.review.map((event) => {
              const presentation = source.presentationFor(event.routineId);
              const key = `${source.participant.id}:${event.id}`;
              const analysisSource = event.analysisSource ? t(event.analysisSource === 'ai' ? 'analysisSourceAi' : event.analysisSource === 'fallback' ? 'analysisSourceFallback' : 'analysisSourceSelf') : undefined;
              const automatedVerdict = t(event.automatedStatus === 'not_detected' ? 'notDetected' : event.automatedStatus === 'detected' ? 'validated' : 'uncertain');
              return (
                <article className="card parent-review-card" key={key} onClick={(clickEvent) => {
                  if ((clickEvent.target as HTMLElement).closest('button')) return;
                  setDetailEventId(key);
                }}>
                  <div className="parent-review-main">
                    {getParticipantProofImageUrl ? proofUrls[key] ? (
                      <button
                        type="button"
                        className="parent-review-image parent-review-image-button"
                        aria-label={t('responsibleReviewImageAlt')}
                        onClick={() => setEnlargedProof({ participantId: source.participant.id, eventId: event.id, url: proofUrls[key], canReview: source.canReview })}
                      >
                        <img src={proofUrls[key]} alt={t('responsibleReviewImageAlt')} />
                      </button>
                    ) : <div className="parent-review-image"><div role="status">{proofErrors[key] ? t('responsibleReviewImageError') : t('loadingProofImage')}</div></div> : null}
                    <div className="parent-review-copy">
                      <div className="parent-review-title-row">
                        <div>
                          <strong>{presentation.name}</strong>
                          <small>{dateTimeFormatter.format(new Date(event.capturedAt ?? event.requestedAt))}{collective ? ` · ${source.participant.displayName}` : ''}</small>
                          {presentation.proofExample ? <p className="routine-proof-context"><b>{t('expectedProof')}:</b> {presentation.proofExample}</p> : null}
                        </div>
                        <button type="button" className="parent-review-detail-button" aria-label={`${t('historyDetailTitle')} · ${presentation.name}`} onClick={() => setDetailEventId(key)}><AppIcon name="chevron-forward" /></button>
                      </div>
                      {(analysisSource || event.confidence !== undefined || event.imageQuality !== undefined) ? <div className="parent-review-analysis">
                        {analysisSource ? <span>{t('analysisSource')}: {analysisSource}</span> : null}
                        <span>{t('analysisVerdict')}: {automatedVerdict}</span>
                        {event.confidence !== undefined ? <span>{t('analysisConfidence')} {Math.round(event.confidence * 100)}%</span> : null}
                        {event.imageQuality !== undefined ? <span>{t('analysisQuality')} {Math.round(event.imageQuality * 100)}%</span> : null}
                      </div> : null}
                      {event.reason && !['analysis_unavailable', 'self_validated'].includes(event.reason) ? <p>{event.reason}</p> : null}
                    </div>
                    <div className="parent-review-actions">
                      {source.canReview ? <button type="button" className="parent-review-button reject" aria-label={t('responsibleReviewReject')} disabled={Boolean(reviewingKey)} onClick={() => { void review(source.participant.id, event.id, 'not_detected'); }}><AppIcon name="close" /></button> : null}
                      {source.canReview ? <button type="button" className="parent-review-button approve" aria-label={t('responsibleReviewApprove')} disabled={Boolean(reviewingKey)} onClick={() => { void review(source.participant.id, event.id, 'detected'); }}><AppIcon name="check" /></button> : null}
                    </div>
                  </div>
                </article>
              );
            }))}
            {actionError === 'review' ? <p className="request-feedback error" role="alert">{t('responsibleReviewError')}</p> : null}
          </div>
        </section>
      ) : null}
      {enlargedProof ? (
        <ProofLightbox
          src={enlargedProof.url}
          alt={t('responsibleReviewImageAlt')}
          closeLabel={t('close')}
          onClose={() => setEnlargedProof(undefined)}
          actions={enlargedProof.canReview ? (
            <>
              <button type="button" className="parent-review-button reject" aria-label={t('responsibleReviewReject')} disabled={Boolean(reviewingKey)} onClick={() => { void review(enlargedProof.participantId, enlargedProof.eventId, 'not_detected').then((completed) => { if (completed) setEnlargedProof(undefined); }); }}><AppIcon name="close" /></button>
              <button type="button" className="parent-review-button approve" aria-label={t('responsibleReviewApprove')} disabled={Boolean(reviewingKey)} onClick={() => { void review(enlargedProof.participantId, enlargedProof.eventId, 'detected').then((completed) => { if (completed) setEnlargedProof(undefined); }); }}><AppIcon name="check" /></button>
            </>
          ) : undefined}
        />
      ) : null}
      {expandedStatus === 'next' && upcomingCount ? (
        <section className="today-section upcoming-checks-section collective-operational-section" aria-label={t('dashboardNext')}>
          <div className="history-list parent-history-list">
            {operationalSources.flatMap((source) => source.upcoming.map((item) => (
              <ListRow
                as="article"
                variant="bare"
                className="card history-row parent-history-row has-participant-accent collective-upcoming-check-card"
                icon={<AppIcon name={routineIconName(item.presentation.icon)} />}
                iconClassName="history-icon routine-history-icon"
                title={item.presentation.name}
                detail={`${source.participant.displayName} · ${plannedWindowLabel(item.planned.start, item.planned.end, new Date(now), languageTag(locale), t)}`}
                style={{ ...item.presentation.style, '--history-participant-color': source.participant.profileColor } as CSSProperties}
                trailing={source.canRequest || source.canSkip || source.canManage ? <UpcomingCheckActionMenu
                  actionId={`${source.participant.id}:${item.routineId}:${item.planned.start.toISOString()}`}
                  routineId={item.routineId}
                  routineName={`${item.presentation.name} · ${source.participant.displayName}`}
                  plannedStart={item.planned.start}
                  plannedEnd={item.planned.end}
                  onRequest={source.canRequest ? (routineId) => requestParticipantCheck!(source.participant.id, routineId) : undefined}
                  onSkip={source.canSkip ? (routineId, start, end) => skipParticipantPlannedCheck!(source.participant.id, routineId, start, end) : undefined}
                  onEditPlan={source.canManage ? (routineId) => onEditParticipantRoutinePlan!(source.participant.id, routineId) : undefined}
                  t={t}
                /> : null}
                key={`${source.participant.id}:${item.routineId}:${item.planned.start.toISOString()}`}
              />
            )))}
          </div>
        </section>
      ) : null}
      <WeeklyInsightCard
        assignments={assignments}
        events={resolvedEvents}
        locale={locale}
        now={now}
        onOpenReport={() => onRangeChange('week')}
        t={t}
      />
      <AdherenceSummaryCard
        events={visibleEvents}
        assignments={visibleAssignments}
        locale={locale}
        subjectName={collective ? t('allParticipants') : sources[0]?.participant.displayName ?? t('routine')}
        range={range}
        onRangeChange={onRangeChange}
        filters={<HistoryFilterControls assignments={visibleAssignments} events={rangedEvents} locale={locale} excludedRoutineIds={historyFilters.excludedRoutineIds} excludedStatuses={historyFilters.excludedStatuses} onToggleRoutine={historyFilters.toggleRoutine} onToggleStatuses={historyFilters.toggleStatuses} t={t} />}
        t={t}
      />
      <RoutineHistoryPanel
        assignments={visibleAssignments}
        events={rangedEvents}
        locale={locale}
        titleId="collective-history-title"
        colorForEvent={(event) => eventContext.get(event.id)?.participant.profileColor}
        excludedRoutineIds={historyFilters.excludedRoutineIds}
        excludedStatuses={historyFilters.excludedStatuses}
        onOpenEvent={(event) => {
          setDetailEventId(event.id);
        }}
        onRequestCheck={requestParticipantCheck ? (_routineId, event) => {
          const context = event ? eventContext.get(event.id) : undefined;
          if (!context) return Promise.reject(new Error('collective_event_context_missing'));
          return requestParticipantCheck(context.participant.id, context.event.routineId);
        } : undefined}
        onCancelCheck={cancelParticipantCheck ? (_eventId, event) => {
          const context = event ? eventContext.get(event.id) : undefined;
          if (!context) return Promise.reject(new Error('collective_event_context_missing'));
          return cancelParticipantCheck(context.participant.id, context.event.id);
        } : undefined}
        canManageCheck={(event) => {
          const participantId = eventContext.get(event.id)?.participant.id;
          const access = participantAccess?.find((entry) => entry.participant.id === participantId);
          return participantAccessCan(access, 'requestChecks');
        }}
        t={t}
      />
      {detailEventId && eventContext.get(detailEventId) ? (() => {
        const context = eventContext.get(detailEventId)!;
        const detailKey = `${context.participant.id}:${context.event.id}`;
        return <VerificationEventDetailDialog
          event={context.event}
          locale={locale}
          proofUrl={proofUrls[detailKey]}
          getProofImageUrl={getParticipantProofImageUrl ? (eventId) => getParticipantProofImageUrl(context.participant.id, eventId) : undefined}
          reviewCheck={reviewParticipantCheck ? (eventId, decision) => reviewParticipantCheck(context.participant.id, eventId, decision) : undefined}
          requestCheck={requestParticipantCheck ? (routineId) => requestParticipantCheck(context.participant.id, routineId) : undefined}
          cancelCheck={cancelParticipantCheck ? (eventId) => cancelParticipantCheck(context.participant.id, eventId) : undefined}
          onClose={() => setDetailEventId(undefined)}
          t={t}
        />;
      })() : null}
    </section>
  );
}
