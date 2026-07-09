import type { RoutineAssignment, VerificationEvent } from './models';
import { nextPlannedWindow } from './monitoringPlan';

export interface UpcomingRoutineCheck {
  id: string;
  routineId: string;
  assignment: RoutineAssignment;
  planned: {
    start: Date;
    end: Date;
  };
}

export const activePendingEvents = (events: VerificationEvent[], now = Date.now()) =>
  events.filter((event) => event.status === 'pending' && Date.parse(event.expiresAt) > now);

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
