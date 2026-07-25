import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { Locale, ParticipantAccess, ParticipantNotificationSource, ReviewCheckDecision, RoutineAssignment, VerificationEvent } from '../domain/models';
import { profileColorFor } from '../domain/profileColor';
import { isReviewableVerification, withResolvedEventStatuses } from '../domain/adherence';
import type { MessageKey } from '../services/i18n';
import { AdherenceSummaryCard, filterEventsBySummaryRange, type SummaryRange } from './AdherenceSummaryCard';
import { RoutineHistoryPanel } from './RoutineHistoryPanel';
import { DashboardStatusSummary } from './DashboardStatusSummary';
import { activePendingEvents, presentedAwaitingRoutineChecks, presentedUpcomingRoutineChecks } from '../domain/dashboardChecks';
import { participantAccessCan } from '../domain/participantAccess';
import { presentRoutine } from '../domain/routinePresentation';
import { AppIcon, routineIconName } from './Icon';
import { plannedWindowLabel } from '../domain/taskTimeLabel';
import { languageTag } from '../services/locale';
import { WeeklyInsightCard } from './WeeklyInsightCard';
import { ListRow } from './ui';

type CollectiveParticipant = { id: string; displayName: string; profileColor: string };
type CollectiveEventContext = { participant: CollectiveParticipant };

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

export function MultiParticipantOverview({
  sources,
  locale,
  range,
  now,
  onRangeChange,
  onSelectParticipant,
  participantAccess,
  requestParticipantCheck,
  reviewParticipantCheck,
  getParticipantProofImageUrl,
  t,
}: {
  sources: ParticipantNotificationSource[];
  locale: Locale;
  range: SummaryRange;
  now: number;
  onRangeChange: (range: SummaryRange) => void;
  onSelectParticipant: (participantId: string) => void;
  participantAccess?: ParticipantAccess[];
  requestParticipantCheck?: (participantId: string, routineId: string) => Promise<void>;
  reviewParticipantCheck?: (participantId: string, eventId: string, decision: ReviewCheckDecision) => Promise<void>;
  getParticipantProofImageUrl?: (participantId: string, eventId: string) => Promise<string>;
  t: (key: MessageKey) => string;
}) {
  const { assignments, events, eventContext } = useMemo(() => collectiveDashboardData(sources), [sources]);
  const resolvedEvents = useMemo(() => withResolvedEventStatuses(events, now), [events, now]);
  const [excludedParticipantIds, setExcludedParticipantIds] = useState<string[]>([]);
  const [expandedStatus, setExpandedStatus] = useState<'active' | 'review' | 'next'>();
  const [requestingKey, setRequestingKey] = useState<string>();
  const [reviewingKey, setReviewingKey] = useState<string>();
  const [actionError, setActionError] = useState<'request' | 'review'>();
  const [proofUrls, setProofUrls] = useState<Record<string, string>>({});
  const [proofErrors, setProofErrors] = useState<Record<string, boolean>>({});
  const participants = sources.map((source) => ({
    id: source.participant.id,
    displayName: source.participant.displayName,
    profileColor: profileColorFor(source.participant),
  }));
  const visibleEvents = useMemo(() => resolvedEvents.filter((event) => (
    !excludedParticipantIds.includes(eventContext.get(event.id)?.participant.id ?? '')
  )), [eventContext, excludedParticipantIds, resolvedEvents]);
  const visibleAssignments = useMemo(() => assignments.filter((assignment) => (
    !excludedParticipantIds.some((participantId) => assignment.routineId.startsWith(`${participantId}:`))
  )), [assignments, excludedParticipantIds]);
  const rangedEvents = useMemo(() => filterEventsBySummaryRange(visibleEvents, range), [range, visibleEvents]);
  const participantForEvent = (event: VerificationEvent) => eventContext.get(event.id)?.participant;
  const operationalSources = useMemo(() => sources.map((source) => {
    const access = participantAccess?.find((entry) => entry.participant.id === source.participant.id);
    const participant = {
      id: source.participant.id,
      displayName: source.participant.displayName,
      profileColor: profileColorFor(source.participant),
    };
    const presentationFor = (routineId: string) => {
      const assignment = source.assignments.find((item) => item.routineId === routineId);
      return assignment ? presentRoutine(assignment.routine, locale) : { name: t('routine'), icon: undefined, style: {} };
    };
    return {
      participant,
      canRequest: Boolean(requestParticipantCheck && participantAccessCan(access, 'requestChecks')),
      canReview: Boolean(reviewParticipantCheck && participantAccessCan(access, 'reviewProofs')),
      active: activePendingEvents(source.events, now).map((event) => ({
        event,
        presentation: presentationFor(event.routineId),
      })),
      awaiting: presentedAwaitingRoutineChecks(source.assignments, source.events, locale, new Date(now)),
      review: source.events.filter(isReviewableVerification)
        .sort((left, right) => Date.parse(right.capturedAt ?? right.requestedAt) - Date.parse(left.capturedAt ?? left.requestedAt)),
      upcoming: presentedUpcomingRoutineChecks(source.assignments, locale, new Date(now)),
      presentationFor,
    };
  }), [locale, now, participantAccess, requestParticipantCheck, reviewParticipantCheck, sources, t]);
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
    if (!reviewParticipantCheck || reviewingKey) return;
    const key = `${participantId}:${eventId}`;
    setReviewingKey(key);
    setActionError(undefined);
    try {
      await reviewParticipantCheck(participantId, eventId, decision);
    } catch (error) {
      console.error(error);
      setActionError('review');
    } finally {
      setReviewingKey(undefined);
    }
  };

  return (
    <section className="today-section participant-history-section parent-history-section dashboard-summary-section multi-participant-overview" aria-labelledby="collective-summary-title">
      <h2 id="collective-summary-title">{t('overview')}</h2>
      <DashboardStatusSummary
        label={t('dashboardStatusSummary')}
        items={[
          { id: 'active', label: t('dashboardActive'), value: activeCount },
          { id: 'review', label: t('dashboardReview'), value: reviewCount, tone: 'attention' },
          { id: 'next', label: t('dashboardNext'), value: upcomingCount },
        ]}
        selectedId={expandedStatus}
        onSelect={(id) => setExpandedStatus((current) => current === id ? undefined : id as typeof current)}
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
          <div className="parent-review-list">
            {operationalSources.flatMap((source) => source.review.map((event) => {
              const presentation = source.presentationFor(event.routineId);
              const key = `${source.participant.id}:${event.id}`;
              return (
                <article className="card parent-review-card" key={key}>
                  <div className="parent-review-main">
                    {getParticipantProofImageUrl ? <div className="parent-review-image">{proofUrls[key]
                      ? <img src={proofUrls[key]} alt={t('responsibleReviewImageAlt')} />
                      : <div role="status">{proofErrors[key] ? t('responsibleReviewImageError') : t('loadingProofImage')}</div>}</div> : null}
                    <div className="parent-review-copy"><strong>{presentation.name}</strong><small>{source.participant.displayName}</small>{event.reason ? <p>{event.reason}</p> : null}</div>
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
                key={`${source.participant.id}:${item.id}`}
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
        subjectName={t('allParticipants')}
        range={range}
        onRangeChange={onRangeChange}
        t={t}
      />
      <RoutineHistoryPanel
        assignments={visibleAssignments}
        events={rangedEvents}
        locale={locale}
        titleId="collective-history-title"
        participants={participants}
        participantForEvent={participantForEvent}
        colorForEvent={(event) => eventContext.get(event.id)?.participant.profileColor}
        excludedParticipantIds={excludedParticipantIds}
        onToggleParticipant={(participantId) => setExcludedParticipantIds((current) => (
          current.includes(participantId)
            ? current.filter((item) => item !== participantId)
            : [...current, participantId]
        ))}
        onOpenEvent={(event) => {
          const context = eventContext.get(event.id);
          if (context) onSelectParticipant(context.participant.id);
        }}
        t={t}
      />
    </section>
  );
}
