import { describe, expect, it } from 'vitest';
import type { AppState } from './models';
import { routeForState } from './appRouting';
import { pilotParticipationRecord } from './pilotParticipation';

const state = (overrides: Partial<AppState> = {}): AppState => ({
  locale: 'en',
  contactEmail: 'user@example.com',
  accessStatus: 'active',
  notificationsEnabled: false,
  family: {
    linked: false,
    childLinked: false,
    childName: '',
    linkingCode: '',
    parentRecoveryCode: '',
    consented: false,
  },
  routineAssignments: [],
  events: [],
  ...overrides,
});

describe('app routing', () => {
  it('collects contact details before setup and stops suspended accounts', () => {
    expect(routeForState(state({ contactEmail: undefined }))).toBe('contact');
    expect(routeForState(state({ accessStatus: 'suspended' }))).toBe('suspended');
  });
  it('prioritizes setup preview and install requirements before account state', () => {
    expect(routeForState(state({ role: 'parent' }), { setupPreview: 'notifications' })).toBe('notifications');
    expect(routeForState(state({ role: 'parent' }), { requiresInstall: true })).toBe('install');
  });

  it('guides new users through role selection then family linking', () => {
    expect(routeForState(state())).toBe('welcome');
    expect(routeForState(state({ role: 'parent' }))).toBe('link');
  });

  it('resumes a relationship invitation after contact registration', () => {
    expect(routeForState(state(), { invitationCode: 'ZI-123456' })).toBe('invitation');
    expect(routeForState(state({ contactEmail: undefined }), { invitationCode: 'ZI-123456' })).toBe('contact');
  });

  it('only requires notifications for linked child devices outside local demo', () => {
    const linkedChild = state({ role: 'child', family: { ...state().family, linked: true }, pilotParticipation: pilotParticipationRecord('declined', 'child') });

    expect(routeForState(linkedChild)).toBe('notifications');
    expect(routeForState(linkedChild, { useLocalDemo: true })).toBe('app');
    expect(routeForState({ ...linkedChild, notificationsEnabled: true })).toBe('app');
  });

  it('asks every linked account for the current optional pilot choice first', () => {
    const linkedParent = state({ role: 'parent', family: { ...state().family, linked: true } });

    expect(routeForState(linkedParent)).toBe('pilot-consent');
    expect(routeForState({ ...linkedParent, pilotParticipation: { ...pilotParticipationRecord('accepted', 'parent'), version: 'previous' } })).toBe('pilot-consent');
    expect(routeForState({ ...linkedParent, pilotParticipation: pilotParticipationRecord('declined', 'parent') })).toBe('app');
  });
});
