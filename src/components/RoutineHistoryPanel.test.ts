import { describe, expect, it } from 'vitest';
import type { VerificationEvent, VerificationStatus } from '../domain/models';
import { compareHistoryEvents } from './RoutineHistoryPanel';

const event = (id: string, status: VerificationStatus, requestedAt: string): VerificationEvent => ({
  id,
  routineId: 'routine',
  sessionId: id,
  requestedAt,
  expiresAt: requestedAt,
  status,
});

describe('compareHistoryEvents', () => {
  it('puts actionable items first, then merges every completed item by date', () => {
    const older = '2026-07-25T08:00:00.000Z';
    const newer = '2026-07-26T08:00:00.000Z';
    const newest = '2026-07-27T08:00:00.000Z';
    const events = [
      event('expired', 'expired', newer),
      event('validated', 'detected', newer),
      event('pending', 'pending', older),
      event('review', 'uncertain', older),
      event('missed', 'missed', newest),
      event('analyzing', 'analyzing', newer),
      event('rejected', 'not_detected', newer),
      event('answered', 'answered', older),
    ];

    expect(events.sort(compareHistoryEvents).map(({ id }) => id)).toEqual([
      'review',
      'analyzing',
      'pending',
      'missed',
      'expired',
      'validated',
      'rejected',
      'answered',
    ]);
  });
});
