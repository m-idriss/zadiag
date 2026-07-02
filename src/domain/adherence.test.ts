import { describe, expect, it } from 'vitest';
import { adherenceSummary, isFreshCapture } from './adherence';
import type { VerificationEvent } from './models';

const event = (status: VerificationEvent['status']): VerificationEvent => ({
  id: crypto.randomUUID(),
  routineId: 'orthodontic-elastics',
  sessionId: crypto.randomUUID(),
  requestedAt: '2026-06-30T12:00:00.000Z',
  expiresAt: '2026-06-30T12:20:00.000Z',
  status,
});

describe('adherenceSummary', () => {
  it('excludes pending checks and calculates a supportive completion rate', () => {
    const result = adherenceSummary([
      event('detected'), event('detected'), event('uncertain'), event('pending'),
    ]);
    expect(result).toMatchObject({ completed: 3, successful: 2, attention: 1 });
    expect(result.rate).toBeCloseTo(2 / 3);
  });
});

describe('isFreshCapture', () => {
  it('accepts a capture inside the one-use session window', () => {
    const pending = event('pending');
    expect(isFreshCapture(pending, new Date('2026-06-30T12:05:00.000Z'), new Date('2026-06-30T12:06:00.000Z'))).toBe(true);
  });

  it('rejects an old capture and a replay', () => {
    const pending = event('pending');
    expect(isFreshCapture(pending, new Date('2026-06-30T11:59:00.000Z'), new Date('2026-06-30T12:06:00.000Z'))).toBe(false);
    expect(isFreshCapture({ ...pending, capturedAt: '2026-06-30T12:03:00.000Z' }, new Date('2026-06-30T12:05:00.000Z'), new Date('2026-06-30T12:06:00.000Z'))).toBe(false);
  });
});
