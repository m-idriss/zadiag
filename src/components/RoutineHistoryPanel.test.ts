import { describe, expect, it } from 'vitest';
import type { VerificationEvent, VerificationStatus } from '../domain/models';
import { compareHistoryEvents, groupedVerificationStatuses } from './RoutineHistoryPanel';

const event = (id: string, status: VerificationStatus, requestedAt: string): VerificationEvent => ({
  id,
  routineId: 'routine',
  sessionId: id,
  requestedAt,
  expiresAt: requestedAt,
  status,
});

describe('groupedVerificationStatuses', () => {
  it('offers one validated filter for photo and structured-response successes', () => {
    expect(groupedVerificationStatuses(['detected', 'answered', 'missed'])).toEqual([
      { status: 'detected', eventStatuses: ['detected', 'answered'] },
      { status: 'missed', eventStatuses: ['missed'] },
    ]);
  });

  it('puts items to review or follow before completed and exceeded items', () => {
    const older = '2026-07-25T08:00:00.000Z';
    const newer = '2026-07-26T08:00:00.000Z';
    const events = [
      event('expired', 'expired', newer),
      event('validated', 'detected', newer),
      event('pending', 'pending', older),
      event('review', 'uncertain', older),
      event('missed', 'missed', newer),
      event('analyzing', 'analyzing', newer),
      event('rejected', 'not_detected', newer),
      event('answered', 'answered', older),
    ];

    expect(events.sort(compareHistoryEvents).map(({ id }) => id)).toEqual([
      'rejected',
      'review',
      'analyzing',
      'pending',
      'validated',
      'answered',
      'expired',
      'missed',
    ]);
  });
});
