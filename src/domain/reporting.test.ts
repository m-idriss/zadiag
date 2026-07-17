import { describe, expect, it } from 'vitest';
import type { VerificationEvent } from './models';
import { adherencePeriodReport, eventsForReportingPeriods, planningRecommendation, routineAnomalies, weeklyInsight } from './reporting';
import { createDefaultRoutineAssignment } from './models';

const event = (id: string, routineId: string, capturedAt: string, status: VerificationEvent['status']): VerificationEvent => ({
  id,
  routineId,
  sessionId: `session-${id}`,
  requestedAt: capturedAt,
  expiresAt: capturedAt,
  capturedAt,
  status,
});

describe('routineAnomalies', () => {
  it('flags three failures among the last five checks and identifies missed-check trends', () => {
    const now = Date.parse('2026-07-17T12:00:00.000Z');
    const statuses = ['detected', 'missed', 'expired', 'detected', 'missed'] as const;
    const anomalies = routineAnomalies(statuses.map((status, index) => ({
      id: `event-${index}`, routineId: 'routine-1', sessionId: `session-${index}`,
      requestedAt: new Date(now - index * 3_600_000).toISOString(),
      expiresAt: new Date(now - index * 3_600_000 + 1_800_000).toISOString(), status,
    })), now);

    expect(anomalies).toEqual([{ routineId: 'routine-1', kind: 'missed', failed: 3, checked: 5, latestEventId: 'event-1' }]);
  });

  it('does not flag sparse or stale failures', () => {
    const now = Date.parse('2026-07-17T12:00:00.000Z');
    expect(routineAnomalies([0, 1].map((index) => ({
      id: `event-${index}`, routineId: 'routine-1', sessionId: `session-${index}`,
      requestedAt: new Date(now - (8 + index) * 86_400_000).toISOString(),
      expiresAt: new Date(now - (8 + index) * 86_400_000 + 1_800_000).toISOString(), status: 'missed' as const,
    })), now)).toEqual([]);
  });
});

describe('planningRecommendation', () => {
  it('proposes removing a repeatedly missed window while preserving the rest of the plan', () => {
    const now = Date.parse('2026-07-17T12:00:00.000Z');
    const assignment = createDefaultRoutineAssignment();
    assignment.plan.timeZone = 'UTC';
    const statuses = ['missed', 'missed', 'missed', 'detected', 'detected'] as const;
    const events = statuses.map((status, index) => ({
      id: `event-${index}`, routineId: assignment.routineId, sessionId: `session-${index}`,
      requestedAt: new Date(Date.parse(`2026-07-${17 - index}T${status === 'detected' ? '12:15' : '07:45'}:00.000Z`)).toISOString(),
      expiresAt: new Date(Date.parse(`2026-07-${17 - index}T09:30:00.000Z`)).toISOString(), status,
    }));

    const recommendation = planningRecommendation(assignment, events, now);
    expect(recommendation?.removedWindow).toEqual({ start: '07:30', end: '09:30' });
    expect(recommendation?.preservedWindow).toEqual({ start: '12:00', end: '14:00' });
    expect(recommendation?.previousChecksPerDay).toBe(3);
    expect(recommendation?.proposedChecksPerDay).toBe(2);
    expect(recommendation?.plan.scheduleGroups?.[0].windows.map((window) => window.id)).toEqual(['midday', 'evening']);
  });

  it('does not reduce a plan when misses are spread without a weak window', () => {
    const assignment = createDefaultRoutineAssignment();
    assignment.plan.timeZone = 'UTC';
    const now = Date.parse('2026-07-17T20:00:00.000Z');
    const hours = ['07:45', '12:15', '17:15'];
    const events = hours.map((hour, index) => ({
      id: `event-${index}`, routineId: assignment.routineId, sessionId: `session-${index}`,
      requestedAt: `2026-07-${17 - index}T${hour}:00.000Z`, expiresAt: `2026-07-${17 - index}T20:00:00.000Z`, status: 'missed' as const,
    }));
    expect(planningRecommendation(assignment, events, now)).toBeUndefined();
  });
});

describe('weeklyInsight', () => {
  it('summarizes progress, the best slot, responsible activity and one priority', () => {
    const now = Date.parse('2026-07-17T20:00:00.000Z');
    const assignment = createDefaultRoutineAssignment();
    assignment.plan.timeZone = 'UTC';
    const events: VerificationEvent[] = [
      { id: 'one', routineId: assignment.routineId, sessionId: 'one', requestedAt: '2026-07-17T12:15:00.000Z', expiresAt: '2026-07-17T14:00:00.000Z', status: 'detected', responsibleActions: [{ type: 'approved', at: '2026-07-17T13:00:00.000Z', actorUid: 'owner', actorName: 'Idriss' }] },
      { id: 'two', routineId: assignment.routineId, sessionId: 'two', requestedAt: '2026-07-16T12:15:00.000Z', expiresAt: '2026-07-16T14:00:00.000Z', status: 'detected' },
      { id: 'three', routineId: assignment.routineId, sessionId: 'three', requestedAt: '2026-07-15T07:45:00.000Z', expiresAt: '2026-07-15T09:30:00.000Z', status: 'missed' },
      { id: 'previous', routineId: assignment.routineId, sessionId: 'previous', requestedAt: '2026-07-08T12:15:00.000Z', expiresAt: '2026-07-08T14:00:00.000Z', status: 'detected' },
    ];

    const insight = weeklyInsight([assignment], events, now);
    expect(insight).toMatchObject({
      rate: 2 / 3,
      strongestRoutineId: assignment.routineId,
      watchRoutineId: assignment.routineId,
      bestWindow: { start: '12:00', end: '14:00' },
      responsibleActionCount: 1,
      responsibleActions: [{ actorName: 'Idriss', count: 1 }],
      priority: 'support_consistency',
    });
    expect(insight?.rateDelta).toBeCloseTo(-1 / 3);
  });

  it('waits for three completed checks before presenting a weekly conclusion', () => {
    const assignment = createDefaultRoutineAssignment();
    expect(weeklyInsight([assignment], [{
      id: 'one', routineId: assignment.routineId, sessionId: 'one', requestedAt: new Date().toISOString(), expiresAt: new Date().toISOString(), status: 'detected',
    }])).toBeUndefined();
  });
});

describe('reporting periods', () => {
  it('compares today with the previous local calendar day', () => {
    const now = new Date('2026-07-15T17:00:00').getTime();
    const periods = eventsForReportingPeriods([
      event('older', 'one', '2026-07-13T23:59:59', 'detected'),
      event('previous', 'one', '2026-07-14T10:00:00', 'detected'),
      event('current', 'one', '2026-07-15T08:00:00', 'detected'),
    ], 'day', now);

    expect(periods.current.map((item) => item.id)).toEqual(['current']);
    expect(periods.previous.map((item) => item.id)).toEqual(['previous']);
  });

  it('reports factual rate change and current results by routine', () => {
    const now = new Date('2026-07-15T12:00:00Z').getTime();
    const report = adherencePeriodReport([
      event('previous-ok', 'routine-a', '2026-07-07T13:00:00Z', 'detected'),
      event('previous-missed', 'routine-a', '2026-07-08T09:00:00Z', 'missed'),
      event('current-ok-a', 'routine-a', '2026-07-14T09:00:00Z', 'detected'),
      event('current-ok-b', 'routine-b', '2026-07-14T10:00:00Z', 'detected'),
    ], 'week', now);

    expect(report.current.rate).toBe(1);
    expect(report.previous.rate).toBe(.5);
    expect(report.rateDelta).toBe(.5);
    expect(report.completedEvents.map((item) => item.id)).toEqual(['current-ok-a', 'current-ok-b']);
    expect(report.byRoutine).toEqual([
      expect.objectContaining({ routineId: 'routine-a', completed: 1, successful: 1 }),
      expect.objectContaining({ routineId: 'routine-b', completed: 1, successful: 1 }),
    ]);
  });
});
