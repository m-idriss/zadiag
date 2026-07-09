import { describe, expect, it } from 'vitest';
import { buildMonitoringPlanFromGroups } from './monitoringPlan';
import { createDefaultRoutineAssignment, createRoutineAssignment, type VerificationEvent } from './models';
import { routineFromCatalog } from './routineCatalog';
import { activePendingEvents, upcomingRoutineChecks } from './dashboardChecks';

const event = (
  id: string,
  status: VerificationEvent['status'],
  expiresAt: string,
): VerificationEvent => ({
  id,
  routineId: 'orthodontic-elastics',
  sessionId: `session-${id}`,
  requestedAt: '2026-07-09T08:00:00.000Z',
  expiresAt,
  status,
});

describe('dashboard check helpers', () => {
  it('keeps only pending events that can still be acted on', () => {
    const now = Date.parse('2026-07-09T10:00:00.000Z');

    expect(activePendingEvents([
      event('active', 'pending', '2026-07-09T10:30:00.000Z'),
      event('expired', 'pending', '2026-07-09T09:30:00.000Z'),
      event('analyzing', 'analyzing', '2026-07-09T10:30:00.000Z'),
    ], now).map((item) => item.id)).toEqual(['active']);
  });

  it('sorts upcoming routine checks and caps the result count', () => {
    const hydration = routineFromCatalog('daily-hydration');
    if (!hydration) throw new Error('missing_hydration_routine');
    const morning = createDefaultRoutineAssignment();
    const afternoon = createRoutineAssignment(hydration);
    morning.plan = buildMonitoringPlanFromGroups({}, [{
      id: 'morning',
      weekdays: [4],
      windows: [{ id: 'w1', start: '08:00', end: '09:00' }],
    }]);
    afternoon.plan = buildMonitoringPlanFromGroups({}, [{
      id: 'afternoon',
      weekdays: [4],
      windows: [{ id: 'w1', start: '14:00', end: '15:00' }],
    }]);

    const checks = upcomingRoutineChecks([afternoon, morning], new Date(2026, 6, 9, 7, 0), 1);

    expect(checks).toHaveLength(1);
    expect(checks[0].routineId).toBe(morning.routineId);
    expect(checks[0].planned.start.getHours()).toBe(8);
  });
});
