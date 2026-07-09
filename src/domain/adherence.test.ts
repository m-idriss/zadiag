import { describe, expect, it } from 'vitest';
import { adherenceSummary, canRetakeCapture, isFreshCapture, resolvedEventStatus, stalePendingCheckReason } from './adherence';
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

describe('resolvedEventStatus', () => {
  it('treats expired pending checks as missed for display', () => {
    expect(resolvedEventStatus(event('pending'), Date.parse('2026-06-30T12:21:00.000Z'))).toBe('missed');
    expect(resolvedEventStatus(event('pending'), Date.parse('2026-06-30T12:19:00.000Z'))).toBe('pending');
  });
});

describe('stalePendingCheckReason', () => {
  it('explains expired and orphaned pending checks', () => {
    const pending = event('pending');
    const assignment = { routineId: pending.routineId };

    expect(stalePendingCheckReason(pending, [assignment], Date.parse('2026-06-30T12:21:00.000Z'))).toBe('expired');
    expect(stalePendingCheckReason(pending, [], Date.parse('2026-06-30T12:19:00.000Z'))).toBe('orphaned');
    expect(stalePendingCheckReason(pending, [assignment], Date.parse('2026-06-30T12:19:00.000Z'))).toBeUndefined();
    expect(stalePendingCheckReason(event('detected'), [assignment], Date.parse('2026-06-30T12:21:00.000Z'))).toBeUndefined();
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

  it('allows a prompt retake for non-positive results while the check window is still open', () => {
    const failed = { ...event('not_detected'), capturedAt: '2026-06-30T12:04:00.000Z' };
    const unclear = { ...event('uncertain'), capturedAt: '2026-06-30T12:04:00.000Z' };
    const success = { ...event('detected'), capturedAt: '2026-06-30T12:04:00.000Z' };
    expect(isFreshCapture(failed, new Date('2026-06-30T12:07:00.000Z'), new Date('2026-06-30T12:08:00.000Z'))).toBe(true);
    expect(isFreshCapture(unclear, new Date('2026-06-30T12:07:00.000Z'), new Date('2026-06-30T12:08:00.000Z'))).toBe(true);
    expect(isFreshCapture(success, new Date('2026-06-30T12:07:00.000Z'), new Date('2026-06-30T12:08:00.000Z'))).toBe(false);
    expect(isFreshCapture(failed, new Date('2026-06-30T12:07:00.000Z'), new Date('2026-06-30T12:21:00.000Z'))).toBe(false);
    expect(isFreshCapture(failed, new Date('2026-06-30T12:20:00.000Z'), new Date('2026-06-30T12:20:00.000Z'))).toBe(false);
  });
});

describe('canRetakeCapture', () => {
  it('allows non-positive captured results for a short retake window', () => {
    const failed = { ...event('not_detected'), capturedAt: '2026-06-30T12:04:00.000Z' };
    expect(canRetakeCapture(failed, [failed], new Date('2026-06-30T12:08:00.000Z'))).toBe(true);
    expect(canRetakeCapture(failed, [failed], new Date('2026-06-30T12:19:00.000Z'))).toBe(true);
    expect(canRetakeCapture(failed, [failed], new Date('2026-06-30T12:20:00.000Z'))).toBe(false);
    expect(canRetakeCapture(failed, [failed], new Date('2026-06-30T12:21:00.000Z'))).toBe(false);
    expect(canRetakeCapture(failed, [failed], new Date('2026-06-30T12:03:00.000Z'))).toBe(false);
    expect(canRetakeCapture({ ...failed, status: 'detected' }, [failed], new Date('2026-06-30T12:08:00.000Z'))).toBe(false);
  });

  it('stops retrying when the next check for the same routine has started', () => {
    const failed = { ...event('not_detected'), capturedAt: '2026-06-30T12:04:00.000Z', expiresAt: '2026-06-30T12:30:00.000Z' };
    const next = { ...event('pending'), requestedAt: '2026-06-30T12:10:00.000Z', expiresAt: '2026-06-30T12:30:00.000Z' };
    const otherRoutineNext = { ...next, routineId: 'daily-hydration' };
    expect(canRetakeCapture(failed, [failed, next], new Date('2026-06-30T12:09:00.000Z'))).toBe(true);
    expect(canRetakeCapture(failed, [failed, next], new Date('2026-06-30T12:10:00.000Z'))).toBe(false);
    expect(canRetakeCapture(failed, [failed, next], new Date('2026-06-30T12:11:00.000Z'))).toBe(false);
    expect(canRetakeCapture(failed, [failed, otherRoutineNext], new Date('2026-06-30T12:11:00.000Z'))).toBe(true);
  });
});
