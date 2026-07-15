import { describe, expect, it } from 'vitest';
import type { VerificationEvent } from './models';
import { notificationsForEvents } from './notificationCenter';

const event = (id: string, status: VerificationEvent['status'], requestedAt: string): VerificationEvent => ({
  id,
  routineId: 'routine',
  sessionId: `session-${id}`,
  requestedAt,
  expiresAt: '2026-07-15T14:00:00.000Z',
  status,
});

describe('notification center feed', () => {
  it('keeps only actionable participant events from the last 30 days', () => {
    const now = Date.parse('2026-07-15T12:00:00.000Z');
    const notifications = notificationsForEvents('child', [
      event('ready', 'pending', '2026-07-15T11:00:00.000Z'),
      event('retry', 'not_detected', '2026-07-14T11:00:00.000Z'),
      event('ok', 'detected', '2026-07-14T10:00:00.000Z'),
      event('old', 'missed', '2026-05-01T10:00:00.000Z'),
    ], now);

    expect(notifications.map(({ id, kind }) => [id, kind])).toEqual([
      ['check_ready:ready', 'check_ready'],
      ['retry:retry', 'retry'],
    ]);
  });

  it('routes unresolved uncertainty to responsible review without duplicating it', () => {
    const uncertain = { ...event('review', 'uncertain', '2026-07-15T10:00:00.000Z'), reviewStatus: 'pending' as const };
    expect(notificationsForEvents('parent', [uncertain], Date.parse('2026-07-15T12:00:00.000Z')))
      .toEqual([expect.objectContaining({ id: 'review:review', kind: 'review' })]);
  });
});
