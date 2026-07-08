import { describe, expect, it } from 'vitest';
import type { VerificationEvent } from '../domain/models';
import { filterEventsBySummaryRange } from './AdherenceSummaryCard';

const event = (id: string, capturedAt: string): VerificationEvent => ({
  id,
  routineId: 'orthodontic-elastics',
  sessionId: `session-${id}`,
  requestedAt: capturedAt,
  expiresAt: capturedAt,
  capturedAt,
  status: 'detected',
});

describe('filterEventsBySummaryRange', () => {
  it('uses the local calendar day for the Today range', () => {
    const now = new Date('2026-07-04T17:00:00').getTime();

    const result = filterEventsBySummaryRange([
      event('yesterday-evening', '2026-07-03T23:30:00'),
      event('today-morning', '2026-07-04T08:00:00'),
    ], 'day', now);

    expect(result.map((item) => item.id)).toEqual(['today-morning']);
  });

  it('filters the two day range from the current time', () => {
    const now = new Date('2026-07-04T17:00:00').getTime();

    const result = filterEventsBySummaryRange([
      event('outside-range', '2026-07-02T16:59:59'),
      event('inside-range', '2026-07-02T17:00:00'),
      event('today', '2026-07-04T08:00:00'),
    ], 'twoDays', now);

    expect(result.map((item) => item.id)).toEqual(['inside-range', 'today']);
  });
});
