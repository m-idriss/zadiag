import { useMemo, useState } from 'react';
import type { Locale, ParticipantNotificationSource, RoutineAssignment, VerificationEvent } from '../domain/models';
import { profileColorFor } from '../domain/profileColor';
import { withResolvedEventStatuses } from '../domain/adherence';
import type { MessageKey } from '../services/i18n';
import { AdherenceSummaryCard, filterEventsBySummaryRange, type SummaryRange } from './AdherenceSummaryCard';
import { RoutineHistoryPanel } from './RoutineHistoryPanel';

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
  t,
}: {
  sources: ParticipantNotificationSource[];
  locale: Locale;
  range: SummaryRange;
  now: number;
  onRangeChange: (range: SummaryRange) => void;
  onSelectParticipant: (participantId: string) => void;
  t: (key: MessageKey) => string;
}) {
  const { assignments, events, eventContext } = useMemo(() => collectiveDashboardData(sources), [sources]);
  const resolvedEvents = useMemo(() => withResolvedEventStatuses(events, now), [events, now]);
  const [excludedParticipantIds, setExcludedParticipantIds] = useState<string[]>([]);
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

  return (
    <section className="today-section participant-history-section parent-history-section dashboard-summary-section multi-participant-overview" aria-labelledby="collective-summary-title">
      <h2 id="collective-summary-title">{t('overview')}</h2>
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
