import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTINE_ID, type AppState, type VerificationEvent } from './domain/models';
import { appBadgeCountForState, documentLanguageForLocale, isParticipantInvitationCode, participantIdForNotificationLaunch, resetNoticeMessageKey } from './App';

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

describe('resetNoticeMessageKey', () => {
  it('explains responsible and participant reset outcomes separately', () => {
    expect(resetNoticeMessageKey('parent')).toBe('resetNoticeParent');
    expect(resetNoticeMessageKey('child')).toBe('resetNoticeChild');
    expect(resetNoticeMessageKey(undefined)).toBe('resetNoticeChild');
  });
});

describe('isParticipantInvitationCode', () => {
  it('routes ZI invitations separately from legacy ZD family codes', () => {
    expect(isParticipantInvitationCode(' zi-123456 ')).toBe(true);
    expect(isParticipantInvitationCode('ZD-123456')).toBe(false);
    expect(isParticipantInvitationCode('ZI-12345')).toBe(false);
  });
});

describe('documentLanguageForLocale', () => {
  it('keeps the document language aligned with the selected interface locale', () => {
    expect(documentLanguageForLocale('en')).toBe('en');
    expect(documentLanguageForLocale('fr')).toBe('fr');
  });
});

describe('participantIdForNotificationLaunch', () => {
  const state = {
    role: 'parent',
    participantAccess: [
      { participant: { id: 'alex', displayName: 'Alex' }, membership: { role: 'owner', status: 'active' } },
      { participant: { id: 'lea', displayName: 'Léa' }, membership: { role: 'owner', status: 'suspended' } },
    ],
  } as AppState;

  it('opens an active profile identified by a review notification', () => {
    expect(participantIdForNotificationLaunch(state, { kind: 'review', participantId: 'alex' })).toBe('alex');
  });

  it('does not switch to an unavailable profile or switch a participant account', () => {
    expect(participantIdForNotificationLaunch(state, { kind: 'review', participantId: 'lea' })).toBeUndefined();
    expect(participantIdForNotificationLaunch(
      { ...state, role: 'child' },
      { kind: 'review', participantId: 'alex' },
    )).toBeUndefined();
  });
});
