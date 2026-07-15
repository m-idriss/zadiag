import { describe, expect, it } from 'vitest';
import { buildMonitoringPlanFromGroups } from './monitoringPlan';
import { createDefaultRoutineAssignment, createRoutineAssignment, type VerificationEvent } from './models';
import { routineFromCatalog } from './routineCatalog';
import { activePendingEvents, awaitingRoutineChecks, coalesceActivePendingEventsByRoutine, upcomingRoutineChecks } from './dashboardChecks';

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

  it('keeps expired pending checks while removing duplicate active pending checks', () => {
    const now = Date.parse('2026-07-09T10:00:00.000Z');

    expect(coalesceActivePendingEventsByRoutine([
      event('older-active', 'pending', '2026-07-09T11:00:00.000Z', 'orthodontic-elastics', '2026-07-09T10:15:00.000Z'),
      event('latest-active', 'pending', '2026-07-09T11:00:00.000Z', 'orthodontic-elastics', '2026-07-09T10:18:00.000Z'),
      event('expired-pending', 'pending', '2026-07-09T09:00:00.000Z', 'orthodontic-elastics', '2026-07-09T08:30:00.000Z'),
      event('detected', 'detected', '2026-07-09T09:00:00.000Z', 'orthodontic-elastics', '2026-07-09T08:00:00.000Z'),
    ], now).map((item) => item.id)).toEqual(['latest-active', 'expired-pending', 'detected']);
  });

  it('hides an older active pending check after a newer routine event is completed', () => {
    const now = Date.parse('2026-07-09T10:00:00.000Z');

    expect(activePendingEvents([
      event('older-active', 'pending', '2026-07-09T11:00:00.000Z', 'orthodontic-elastics', '2026-07-09T10:15:00.000Z'),
      event('completed-relance', 'detected', '2026-07-09T11:00:00.000Z', 'orthodontic-elastics', '2026-07-09T10:18:00.000Z'),
    ], now)).toEqual([]);
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

  it('shows a started window until its server event arrives', () => {
    const assignment = createDefaultRoutineAssignment();
    assignment.plan = buildMonitoringPlanFromGroups({}, [{
      id: 'evening',
      weekdays: [4],
      windows: [{ id: 'w1', start: '17:00', end: '18:00' }],
    }]);
    const now = new Date(2026, 6, 9, 17, 1);

    expect(awaitingRoutineChecks([assignment], [], now)).toHaveLength(1);
    expect(awaitingRoutineChecks([assignment], [event(
      'dispatched',
      'pending',
      new Date(2026, 6, 9, 18, 0).toISOString(),
      assignment.routineId,
      new Date(2026, 6, 9, 17, 1).toISOString(),
    )], now)).toHaveLength(0);
  });
});
