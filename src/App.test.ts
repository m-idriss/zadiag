import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTINE_ID, type VerificationEvent } from './domain/models';
import { appBadgeCountForState } from './App';

const activePendingEvent = (expiresAt: string): VerificationEvent => ({
  id: 'check-1',
  routineId: DEFAULT_ROUTINE_ID,
  sessionId: 'session-1',
  requestedAt: '2026-07-06T08:00:00.000Z',
  expiresAt,
  status: 'pending',
});

describe('appBadgeCountForState', () => {
  it('counts active pending checks for participants', () => {
    expect(appBadgeCountForState(
      'child',
      [activePendingEvent('2026-07-06T09:30:00.000Z')],
      Date.parse('2026-07-06T09:00:00.000Z'),
    )).toBe(1);
  });

  it('clears the badge for responsible users even when a participant check is pending', () => {
    expect(appBadgeCountForState(
      'parent',
      [activePendingEvent('2026-07-06T09:30:00.000Z')],
      Date.parse('2026-07-06T09:00:00.000Z'),
    )).toBe(0);
  });

  it('does not badge passive or expired participant information', () => {
    expect(appBadgeCountForState(
      'child',
      [
        { ...activePendingEvent('2026-07-06T08:30:00.000Z'), id: 'expired' },
        { ...activePendingEvent('2026-07-06T09:30:00.000Z'), id: 'completed', status: 'detected' },
        { ...activePendingEvent('2026-07-06T09:30:00.000Z'), id: 'review', status: 'uncertain' },
      ],
      Date.parse('2026-07-06T09:00:00.000Z'),
    )).toBe(0);
  });
});
