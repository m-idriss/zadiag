import { useMemo } from 'react';
import type { Locale, ParticipantNotificationSource, RoutineAssignment, VerificationEvent } from '../domain/models';
import { profileColorFor } from '../domain/profileColor';
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
  onRangeChange,
  onSelectParticipant,
  t,
}: {
  sources: ParticipantNotificationSource[];
  locale: Locale;
  range: SummaryRange;
  onRangeChange: (range: SummaryRange) => void;
  onSelectParticipant: (participantId: string) => void;
  t: (key: MessageKey) => string;
}) {
  const { assignments, events, eventContext } = useMemo(() => collectiveDashboardData(sources), [sources]);
  const participants = sources.map((source) => ({
    id: source.participant.id,
    displayName: source.participant.displayName,
    profileColor: profileColorFor(source.participant),
  }));
  const rangedEvents = useMemo(() => filterEventsBySummaryRange(events, range), [events, range]);
  const participantForEvent = (event: VerificationEvent) => eventContext.get(event.id)?.participant;

  return (
    <section className="today-section participant-history-section parent-history-section dashboard-summary-section multi-participant-overview" aria-labelledby="collective-summary-title">
      <h2 id="collective-summary-title">{t('overview')}</h2>
      <AdherenceSummaryCard
        events={events}
        assignments={assignments}
        locale={locale}
        subjectName={t('allParticipants')}
        range={range}
        onRangeChange={onRangeChange}
        t={t}
      />
      <RoutineHistoryPanel
        assignments={assignments}
        events={rangedEvents}
        locale={locale}
        titleId="collective-history-title"
        participants={participants}
        participantForEvent={participantForEvent}
        onOpenEvent={(event) => {
          const context = eventContext.get(event.id);
          if (context) onSelectParticipant(context.participant.id);
        }}
        t={t}
      />
    </section>
  );
}
