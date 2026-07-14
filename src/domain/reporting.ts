import { adherenceSummary } from './adherence';
import type { VerificationEvent } from './models';

export type SummaryRange = 'day' | 'twoDays' | 'week' | 'month' | 'quarter';

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
  return { current, previous, rateDelta, byRoutine };
};
