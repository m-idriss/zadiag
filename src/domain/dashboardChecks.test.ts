import { describe, expect, it } from 'vitest';
import { buildMonitoringPlanFromGroups } from './monitoringPlan';
import { createDefaultRoutineAssignment, createRoutineAssignment, type VerificationEvent } from './models';
import { routineFromCatalog } from './routineCatalog';
import { activePendingEvents, upcomingRoutineChecks } from './dashboardChecks';

const event = (
  id: string,
  status: VerificationEvent['status'],
  expiresAt: string,
  routineId = 'orthodontic-elastics',
  requestedAt = '2026-07-09T08:00:00.000Z',
): VerificationEvent => ({
  id,
  routineId,
  sessionId: `session-${id}`,
  requestedAt,
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

  it('coalesces duplicate active pending checks by routine', () => {
    const now = Date.parse('2026-07-09T10:00:00.000Z');

    expect(activePendingEvents([
      event('older-elastics', 'pending', '2026-07-09T11:00:00.000Z', 'orthodontic-elastics', '2026-07-09T10:15:00.000Z'),
      event('hydration', 'pending', '2026-07-09T10:45:00.000Z', 'daily-hydration', '2026-07-09T10:05:00.000Z'),
      event('relanced-elastics', 'pending', '2026-07-09T11:00:00.000Z', 'orthodontic-elastics', '2026-07-09T10:18:00.000Z'),
    ], now).map((item) => item.id)).toEqual(['hydration', 'relanced-elastics']);
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
