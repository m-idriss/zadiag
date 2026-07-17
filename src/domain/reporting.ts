import { adherenceSummary, isCompletedVerification } from './adherence';
import type { VerificationEvent } from './models';

export type SummaryRange = 'day' | 'twoDays' | 'week' | 'month' | 'quarter';

export interface RoutineAnomaly {
  routineId: string;
  kind: 'missed' | 'rejected';
  failed: number;
  checked: number;
  latestEventId: string;
}

const rangeDays: Record<SummaryRange, number> = {
  day: 1,
  twoDays: 2,
  week: 7,
  month: 30,
  quarter: 90,
};

export const isSummaryRange = (value: unknown): value is SummaryRange =>
  typeof value === 'string' && Object.hasOwn(rangeDays, value);

const eventTimestamp = (event: VerificationEvent) => Date.parse(event.capturedAt ?? event.requestedAt);

const startOfLocalDay = (now: number) => {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

export const reportingPeriodBounds = (range: SummaryRange, now = Date.now()) => {
  const duration = rangeDays[range] * 86_400_000;
  const currentStart = range === 'day' ? startOfLocalDay(now) : now - duration;
  const previousDay = new Date(currentStart);
  previousDay.setDate(previousDay.getDate() - 1);
  const previousStart = range === 'day' ? previousDay.getTime() : currentStart - duration;
  return { currentStart, currentEnd: now, previousStart, previousEnd: currentStart };
};

export const eventsInSummaryRange = (events: VerificationEvent[], range: SummaryRange, now = Date.now()) => {
  const { currentStart } = reportingPeriodBounds(range, now);
  return events.filter((event) => eventTimestamp(event) >= currentStart);
};

export const eventsForReportingPeriods = (events: VerificationEvent[], range: SummaryRange, now = Date.now()) => {
  const bounds = reportingPeriodBounds(range, now);
  return {
    current: events.filter((event) => {
      const timestamp = eventTimestamp(event);
      return timestamp >= bounds.currentStart && timestamp <= bounds.currentEnd;
    }),
    previous: events.filter((event) => {
      const timestamp = eventTimestamp(event);
      return timestamp >= bounds.previousStart && timestamp < bounds.previousEnd;
    }),
  };
};

export const adherencePeriodReport = (events: VerificationEvent[], range: SummaryRange, now = Date.now()) => {
  const periods = eventsForReportingPeriods(events, range, now);
  const current = adherenceSummary(periods.current);
  const previous = adherenceSummary(periods.previous);
  const completedEvents = periods.current.filter(isCompletedVerification);
  const rateDelta = current.completed > 0 && previous.completed > 0 ? current.rate - previous.rate : undefined;
  const byRoutine = Array.from(
    periods.current.reduce((groups, event) => {
      const routineEvents = groups.get(event.routineId) ?? [];
      routineEvents.push(event);
      groups.set(event.routineId, routineEvents);
      return groups;
    }, new Map<string, VerificationEvent[]>()),
  )
    .map(([routineId, routineEvents]) => ({
      routineId,
      ...adherenceSummary(routineEvents),
    }))
    .filter((routine) => routine.completed > 0);
  return { current, previous, rateDelta, byRoutine, completedEvents };
};

const isAnomalyFailure = (event: VerificationEvent) => ['missed', 'expired', 'not_detected'].includes(event.status)
  || event.reviewStatus === 'rejected';

export const routineAnomalies = (events: VerificationEvent[], now = Date.now()): RoutineAnomaly[] => {
  const cutoff = now - 7 * 86_400_000;
  const grouped = events.reduce((groups, event) => {
    if (!isCompletedVerification(event) || eventTimestamp(event) < cutoff || eventTimestamp(event) > now) return groups;
    const routineEvents = groups.get(event.routineId) ?? [];
    routineEvents.push(event);
    groups.set(event.routineId, routineEvents);
    return groups;
  }, new Map<string, VerificationEvent[]>());

  return Array.from(grouped, ([routineId, routineEvents]) => {
    const recent = routineEvents.sort((a, b) => eventTimestamp(b) - eventTimestamp(a)).slice(0, 5);
    const failures = recent.filter(isAnomalyFailure);
    if (recent.length < 3 || failures.length < 3) return undefined;
    const missed = failures.filter((event) => ['missed', 'expired'].includes(event.status)).length;
    return {
      routineId,
      kind: missed >= Math.ceil(failures.length / 2) ? 'missed' as const : 'rejected' as const,
      failed: failures.length,
      checked: recent.length,
      latestEventId: failures[0].id,
    };
  }).filter((anomaly): anomaly is RoutineAnomaly => Boolean(anomaly));
};
