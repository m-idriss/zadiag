import { adherenceSummary, isCompletedVerification } from './adherence';
import type { MonitoringPlan, RoutineAssignment, VerificationEvent } from './models';
import { buildMonitoringPlanFromGroups, groupsFromLegacyPlan } from './monitoringPlan';

export type SummaryRange = 'day' | 'twoDays' | 'week' | 'month' | 'quarter';

export interface RoutineAnomaly {
  routineId: string;
  kind: 'missed' | 'rejected';
  failed: number;
  checked: number;
  latestEventId: string;
}

export interface PlanningRecommendation {
  routineId: string;
  plan: MonitoringPlan;
  removedWindow: { start: string; end: string };
  preservedWindow?: { start: string; end: string };
  previousChecksPerDay: number;
  proposedChecksPerDay: number;
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

const eventScheduleParts = (value: string, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(part('weekday')) + 1;
  return { weekday, minute: Number(part('hour')) * 60 + Number(part('minute')) };
};

const timeMinutes = (value: string) => {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
};

export const planningRecommendation = (
  assignment: RoutineAssignment,
  events: VerificationEvent[],
  now = Date.now(),
): PlanningRecommendation | undefined => {
  const anomaly = routineAnomalies(events, now).find((item) => item.routineId === assignment.routineId && item.kind === 'missed');
  if (!anomaly) return undefined;
  const groups = groupsFromLegacyPlan(assignment.plan);
  const cutoff = now - 30 * 86_400_000;
  const performance = new Map<string, { failures: number; successes: number }>();

  events.filter((event) => event.routineId === assignment.routineId
    && eventTimestamp(event) >= cutoff && eventTimestamp(event) <= now
    && ['detected', 'missed', 'expired'].includes(event.status)).forEach((event) => {
    const schedule = eventScheduleParts(event.requestedAt, assignment.plan.timeZone);
    groups.forEach((group) => {
      if (!group.weekdays.includes(schedule.weekday)) return;
      group.windows.forEach((window) => {
        if (schedule.minute < timeMinutes(window.start) || schedule.minute > timeMinutes(window.end)) return;
        const key = `${group.id}:${window.id}`;
        const current = performance.get(key) ?? { failures: 0, successes: 0 };
        if (event.status === 'detected') current.successes += 1;
        else current.failures += 1;
        performance.set(key, current);
      });
    });
  });

  const candidate = groups.flatMap((group) => group.windows.length > 1 ? group.windows.map((window) => ({
    groupId: group.id, window, performance: performance.get(`${group.id}:${window.id}`) ?? { failures: 0, successes: 0 },
  })) : []).filter((item) => item.performance.failures >= 2)
    .sort((a, b) => b.performance.failures - a.performance.failures || a.performance.successes - b.performance.successes)[0];
  if (!candidate) return undefined;

  const nextGroups = groups.map((group) => group.id === candidate.groupId
    ? { ...group, windows: group.windows.filter((window) => window.id !== candidate.window.id) }
    : group);
  const plan = buildMonitoringPlanFromGroups(assignment.plan, nextGroups);
  if (plan.checksPerDay >= assignment.plan.checksPerDay) return undefined;
  const preserved = groups.flatMap((group) => group.windows.map((window) => ({
    groupId: group.id, window, performance: performance.get(`${group.id}:${window.id}`) ?? { failures: 0, successes: 0 },
  }))).filter((item) => !(item.groupId === candidate.groupId && item.window.id === candidate.window.id) && item.performance.successes > 0)
    .sort((a, b) => b.performance.successes - a.performance.successes || a.performance.failures - b.performance.failures)[0];
  return {
    routineId: assignment.routineId,
    plan,
    removedWindow: { start: candidate.window.start, end: candidate.window.end },
    ...(preserved ? { preservedWindow: { start: preserved.window.start, end: preserved.window.end } } : {}),
    previousChecksPerDay: assignment.plan.checksPerDay,
    proposedChecksPerDay: plan.checksPerDay,
  };
};
