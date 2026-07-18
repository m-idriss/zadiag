import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canGrantPermissions,
  canLeaveMembership,
  canRemoveMembership,
  createMembership,
  isProfileColorKey,
  defaultPermissionsForRole,
  hasParticipantPermission,
  membershipPermissions,
  pushRolesForMembership,
  scheduledAggregatePaths,
} from './relationships.js';

test('accepts only supported participant profile colors', () => {
  assert.equal(isProfileColorKey('violet'), true);
  assert.equal(isProfileColorKey('navy'), false);
  assert.equal(isProfileColorKey('#ffffff'), false);
});

test('defines explicit defaults for each membership role', () => {
  const owner = defaultPermissionsForRole('owner');
  const caregiver = defaultPermissionsForRole('caregiver');
  const participant = defaultPermissionsForRole('participant');
  const viewer = defaultPermissionsForRole('viewer');

  assert.equal(membershipPermissions.every((permission) => owner[permission]), true);
  assert.equal(caregiver.manageRoutines, true);
  assert.equal(caregiver.reviewProofs, true);
  assert.equal(caregiver.manageCaregivers, false);
  assert.equal(participant.submitChecks, true);
  assert.equal(participant.reviewProofs, false);
  assert.deepEqual(Object.entries(viewer).filter(([, enabled]) => enabled).map(([permission]) => permission), ['view']);
});

test('schedules migrated participants without processing their legacy family twice', () => {
  assert.deepEqual(scheduledAggregatePaths(['legacy', 'unmigrated'], [
    { id: 'legacy', status: 'active', sourceFamilyId: 'legacy', contentMigrationVersion: 1 },
    { id: 'new', status: 'active' },
    { id: 'archived', status: 'archived' },
  ]), [
    'families/unmigrated',
    'participants/legacy',
    'participants/new',
  ]);
});

test('models self-management as a regular owner membership', () => {
  const membership = createMembership({
    uid: 'jordan',
    displayName: 'Jordan',
    role: 'owner',
    label: 'self',
    now: '2026-07-10T10:00:00.000Z',
  });

  assert.equal(membership.uid, 'jordan');
  assert.equal(membership.displayName, 'Jordan');
  assert.equal(membership.label, 'self');
  assert.equal(hasParticipantPermission(membership, 'manageRoutines'), true);
  assert.equal(hasParticipantPermission(membership, 'submitChecks'), true);
  assert.deepEqual(pushRolesForMembership(membership), ['child', 'parent']);
});

test('routes caregiver and viewer notifications from explicit permissions', () => {
  assert.deepEqual(pushRolesForMembership(createMembership({ uid: 'caregiver', role: 'caregiver' })), ['parent']);
  assert.deepEqual(pushRolesForMembership(createMembership({ uid: 'viewer', role: 'viewer' })), []);
});

test('denies permissions to suspended or incomplete memberships', () => {
  const caregiver = createMembership({ uid: 'caregiver', role: 'caregiver' });
  assert.equal(hasParticipantPermission(caregiver, 'reviewProofs'), true);
  assert.equal(hasParticipantPermission({ ...caregiver, status: 'suspended' }, 'reviewProofs'), false);
  assert.equal(hasParticipantPermission(undefined, 'view'), false);
});

test('prevents permission escalation when inviting another member', () => {
  const owner = createMembership({ uid: 'owner', role: 'owner' });
  const delegatedOwner = createMembership({ uid: 'delegate', role: 'owner' });
  delegatedOwner.permissions.manageParticipant = false;

  assert.equal(canGrantPermissions(owner, defaultPermissionsForRole('caregiver')), true);
  assert.equal(canGrantPermissions(delegatedOwner, defaultPermissionsForRole('owner')), false);
  assert.equal(canGrantPermissions(createMembership({ uid: 'caregiver', role: 'caregiver' }), defaultPermissionsForRole('viewer')), false);
});

test('protects the last active owner from removal', () => {
  const owner = createMembership({ uid: 'owner', role: 'owner' });
  const caregiver = createMembership({ uid: 'caregiver', role: 'caregiver' });

  assert.equal(canRemoveMembership({ actor: owner, target: owner, activeOwnerCount: 1 }), false);
  assert.equal(canRemoveMembership({ actor: owner, target: owner, activeOwnerCount: 2 }), true);
  assert.equal(canRemoveMembership({ actor: owner, target: caregiver, activeOwnerCount: 1 }), true);
  assert.equal(canRemoveMembership({ actor: caregiver, target: owner, activeOwnerCount: 2 }), false);
  assert.equal(canLeaveMembership(owner, 1), false);
  assert.equal(canLeaveMembership(owner, 2), true);
  assert.equal(canLeaveMembership(caregiver, 1), true);
});
