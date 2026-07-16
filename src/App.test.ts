import { describe, expect, it } from 'vitest';
import { DEFAULT_ROUTINE_ID, type AppState, type VerificationEvent } from './domain/models';
import { appBadgeCountForState, documentLanguageForLocale, eventIdForNotificationLaunch, isParticipantInvitationCode, participantIdForNotificationLaunch, resetNoticeMessageKey, setupCompletionTransition, syncStatusFor, syncStatusIsVisible } from './App';

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

describe('syncStatusFor', () => {
  it('prioritizes offline and active synchronization before failures', () => {
    expect(syncStatusFor(false, 1, true)).toBe('offline');
    expect(syncStatusFor(true, 1, true)).toBe('syncing');
    expect(syncStatusFor(true, 0, true)).toBe('failed');
    expect(syncStatusFor(true, 0, false)).toBe('synced');
  });

  it('hides the idle state after confirmation but keeps actionable states visible', () => {
    expect(syncStatusIsVisible('synced', false)).toBe(false);
    expect(syncStatusIsVisible('synced', true)).toBe(true);
    expect(syncStatusIsVisible('syncing', false)).toBe(true);
    expect(syncStatusIsVisible('offline', false)).toBe(true);
    expect(syncStatusIsVisible('failed', false)).toBe(true);
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

describe('eventIdForNotificationLaunch', () => {
  const state = {
    role: 'parent',
    activeParticipantId: 'alex',
    events: [{ id: 'check-42' }],
  } as AppState;

  it('opens an existing event only after its target profile is active', () => {
    expect(eventIdForNotificationLaunch(state, { kind: 'review', participantId: 'alex', eventId: 'check-42' })).toBe('check-42');
    expect(eventIdForNotificationLaunch({ ...state, activeParticipantId: 'lea' }, { kind: 'review', participantId: 'alex', eventId: 'check-42' })).toBeUndefined();
  });

  it('falls back safely for legacy links and events no longer available', () => {
    expect(eventIdForNotificationLaunch(state, { kind: 'review', participantId: 'alex' })).toBeUndefined();
    expect(eventIdForNotificationLaunch(state, { kind: 'review', participantId: 'alex', eventId: 'deleted' })).toBeUndefined();
  });
});

describe('setupCompletionTransition', () => {
  const completeParentState = {
    role: 'parent' as const,
    notificationsEnabled: true,
    family: { linked: true, childLinked: true, childName: 'Maya', linkingCode: '', parentRecoveryCode: '', consented: true },
    routineAssignments: [{ routineId: 'routine' }] as AppState['routineAssignments'],
    routinesLoaded: true,
  };

  it('ignores the temporary empty routine state while switching followed profiles', () => {
    const loading = setupCompletionTransition(true, {
      ...completeParentState,
      routineAssignments: [],
      routinesLoaded: false,
    });
    const loaded = setupCompletionTransition(loading.complete, completeParentState);

    expect(loading).toEqual({ complete: true });
    expect(loaded).toEqual({ complete: true });
  });

  it('still announces a real first routine completion', () => {
    expect(setupCompletionTransition(false, completeParentState)).toEqual({
      complete: true,
      noticeKey: 'parentSetupComplete',
    });
  });
});
