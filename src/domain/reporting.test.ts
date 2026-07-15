import { describe, expect, it } from 'vitest';
import type { VerificationEvent } from './models';
import { adherencePeriodReport, eventsForReportingPeriods } from './reporting';

const event = (id: string, routineId: string, capturedAt: string, status: VerificationEvent['status']): VerificationEvent => ({
  id,
  routineId,
  sessionId: `session-${id}`,
  requestedAt: capturedAt,
  expiresAt: capturedAt,
  capturedAt,
  status,
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
