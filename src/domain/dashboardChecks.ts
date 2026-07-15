import type { RoutineAssignment, VerificationEvent } from './models';
import { currentPlannedWindow, nextPlannedWindow } from './monitoringPlan';
import { presentRoutine } from './routinePresentation';

interface UpcomingRoutineCheck {
  id: string;
  routineId: string;
  assignment: RoutineAssignment;
  planned: {
    start: Date;
    end: Date;
  };
}

export const activePendingEvents = (events: VerificationEvent[], now = Date.now()) => {
  const latestEventByRoutineId = new Map<string, VerificationEvent>();
  events.forEach((event) => {
    const current = latestEventByRoutineId.get(event.routineId);
    if (!current || Date.parse(event.requestedAt) > Date.parse(current.requestedAt)) {
      latestEventByRoutineId.set(event.routineId, event);
    }
  });
  const byRoutineId = new Map<string, VerificationEvent>();
  events.forEach((event) => {
    if (event.status !== 'pending' || Date.parse(event.expiresAt) <= now) return;
    if (latestEventByRoutineId.get(event.routineId)?.id !== event.id) return;
    const current = byRoutineId.get(event.routineId);
    if (!current || Date.parse(event.requestedAt) > Date.parse(current.requestedAt)) {
      byRoutineId.set(event.routineId, event);
    }
  });
  return [...byRoutineId.values()].sort((a, b) => Date.parse(a.expiresAt) - Date.parse(b.expiresAt));
};

export const coalesceActivePendingEventsByRoutine = (events: VerificationEvent[], now = Date.now()) => {
  const activeIds = new Set(activePendingEvents(events, now).map((event) => event.id));
  return events.filter((event) =>
    event.status !== 'pending'
    || Date.parse(event.expiresAt) <= now
    || activeIds.has(event.id));
};

export const upcomingRoutineChecks = (
  assignments: RoutineAssignment[],
  now = new Date(),
  limit = 3,
): UpcomingRoutineCheck[] =>
  assignments
    .map((assignment) => {
      const planned = nextPlannedWindow(assignment.plan, now);
      if (!planned) return undefined;
      return {
        id: assignment.id,
        routineId: assignment.routineId,
        assignment,
        planned,
      };
    })
    .filter((item): item is UpcomingRoutineCheck => Boolean(item))
    .sort((a, b) => a.planned.start.getTime() - b.planned.start.getTime())
    .slice(0, limit);

export const awaitingRoutineChecks = (
  assignments: RoutineAssignment[],
  events: VerificationEvent[],
  now = new Date(),
): UpcomingRoutineCheck[] => assignments.flatMap((assignment) => {
  if (assignment.status !== 'active') return [];
  const planned = currentPlannedWindow(assignment.plan, now);
  if (!planned) return [];
  const alreadyDispatched = events.some((event) => (
    event.routineId === assignment.routineId
    && Date.parse(event.requestedAt) >= planned.start.getTime()
    && Date.parse(event.requestedAt) < planned.end.getTime()
  ));
  return alreadyDispatched ? [] : [{ id: assignment.id, routineId: assignment.routineId, assignment, planned }];
});

export const presentedUpcomingRoutineChecks = (
  assignments: RoutineAssignment[],
  locale: Parameters<typeof presentRoutine>[1],
  now = new Date(),
) => upcomingRoutineChecks(assignments, now).map((item) => ({
  ...item,
  presentation: presentRoutine(item.assignment.routine, locale),
}));

export const presentedAwaitingRoutineChecks = (
  assignments: RoutineAssignment[],
  events: VerificationEvent[],
  locale: Parameters<typeof presentRoutine>[1],
  now = new Date(),
) => awaitingRoutineChecks(assignments, events, now).map((item) => ({
  ...item,
  presentation: presentRoutine(item.assignment.routine, locale),
}));
