import { describe, expect, it } from 'vitest';
import type { ParticipantAccess } from './models';
import { activeParticipantAccess, participantAccessCan, participantRoleForAccess, preferredParticipantId } from './participantAccess';

const access: ParticipantAccess[] = [
  {
    participant: { id: 'alex', displayName: 'Alex' },
    membership: { role: 'owner', status: 'active' },
  },
  {
    participant: { id: 'sam', displayName: 'Sam' },
    membership: { role: 'caregiver', status: 'suspended' },
  },
];

describe('activeParticipantAccess', () => {
  it('selects an active participant from several relationships', () => {
    expect(activeParticipantAccess(access, 'alex')?.participant.displayName).toBe('Alex');
  });

  it('does not select suspended or unrelated relationships', () => {
    expect(activeParticipantAccess(access, 'sam')).toBeUndefined();
    expect(activeParticipantAccess(access, 'unrelated')).toBeUndefined();
  });
});

describe('participant access capabilities', () => {
  it('keeps a self-managed owner participant-facing without losing management permissions', () => {
    const selfManaged: ParticipantAccess = {
      participant: { id: 'jordan', displayName: 'Jordan', selfManaged: true },
      membership: { role: 'owner', status: 'active', label: 'self' },
    };
    expect(participantRoleForAccess(selfManaged)).toBe('child');
    expect(participantAccessCan(selfManaged, 'submitChecks')).toBe(true);
    expect(participantAccessCan(selfManaged, 'manageRoutines')).toBe(true);
  });

  it('keeps viewers read-only even though they use responsible presentation', () => {
    const viewer: ParticipantAccess = {
      participant: { id: 'jordan', displayName: 'Jordan' },
      membership: { role: 'viewer', status: 'active' },
    };
    expect(participantRoleForAccess(viewer)).toBe('parent');
    expect(participantAccessCan(viewer, 'view')).toBe(true);
    expect(participantAccessCan(viewer, 'manageRoutines')).toBe(false);
    expect(participantAccessCan(viewer, 'reviewProofs')).toBe(false);
  });

  it('honors deliberately restricted stored permissions', () => {
    const owner = structuredClone(access[0]);
    owner.membership.permissions = {
      view: true,
      manageRoutines: false,
      requestChecks: false,
      submitChecks: false,
      reviewProofs: false,
      manageCaregivers: false,
      manageParticipant: false,
    };
    expect(participantAccessCan(owner, 'manageRoutines')).toBe(false);
  });
});

describe('preferredParticipantId', () => {
  it('restores the remembered profile when no current selection exists', () => {
    const multiple = [...access, {
      participant: { id: 'zoe', displayName: 'Zoé' },
      membership: { role: 'owner' as const, status: 'active' as const },
    }];
    expect(preferredParticipantId(multiple, undefined, 'zoe')).toBe('zoe');
  });

  it('falls back safely when the remembered profile is unavailable', () => {
    expect(preferredParticipantId(access, undefined, 'removed')).toBe('alex');
  });
});
