import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_ROUTINE_ID, migrateCheckRoutineId } from './routines.js';
import { isCompatibleLegacyContentTarget, isCompatibleMembershipMigration, isCompatibleParticipantMigration, isCompatibleParticipantRefMigration, migrateLegacyFamilyRelationships } from './relationships.js';

test('rehearses routine migration against representative legacy checks', () => {
  const legacyChecks = [
    { id: 'pending', status: 'pending' },
    { id: 'completed', status: 'detected', capturedAt: '2026-06-01T08:10:00.000Z' },
    { id: 'expired', status: 'expired' },
  ];
  const migrated = legacyChecks.map(migrateCheckRoutineId);

  assert.equal(migrated.every((check) => check.routineId === DEFAULT_ROUTINE_ID), true);
  assert.deepEqual(migrated.map(migrateCheckRoutineId), migrated);
  assert.deepEqual(migrated.map(({ id, status }) => ({ id, status })), legacyChecks.map(({ id, status }) => ({ id, status })));
});

test('rehearsal preserves checks already assigned to another routine', () => {
  const check = { id: 'medication', status: 'detected', routineId: 'medication' };
  assert.deepEqual(migrateCheckRoutineId(check), check);
});

test('rehearses a family with two caregivers into additive owner memberships', () => {
  const migrated = migrateLegacyFamilyRelationships('family-alex', {
    childName: 'Alex',
    members: {
      mother: 'parent',
      father: 'parent',
      alex: 'child',
    },
    createdAt: '2026-06-01T08:00:00.000Z',
  }, '2026-07-10T12:00:00.000Z');

  assert.equal(migrated.participantId, 'family-alex');
  assert.equal(migrated.participant.userId, 'alex');
  assert.deepEqual(migrated.memberships.map(({ uid, role }) => ({ uid, role })), [
    { uid: 'alex', role: 'participant' },
    { uid: 'father', role: 'owner' },
    { uid: 'mother', role: 'owner' },
  ]);
  assert.equal(migrated.participantRefs.length, 3);
  assert.equal(migrated.memberships.filter(({ role }) => role === 'owner').every(({ permissions }) => permissions.manageCaregivers), true);
});

test('relationship migration is deterministic and does not guess among several participant accounts', () => {
  const family = {
    childName: 'Shared profile',
    members: { owner: 'parent', participantB: 'child', participantA: 'child', invalid: 'viewer' },
  };
  const first = migrateLegacyFamilyRelationships('family-shared', family, '2026-07-10T12:00:00.000Z');
  const rerun = migrateLegacyFamilyRelationships('family-shared', family, '2026-07-10T12:00:00.000Z');

  assert.deepEqual(rerun, first);
  assert.equal(first.participant.userId, undefined);
  assert.deepEqual(first.memberships.map(({ uid }) => uid), ['owner', 'participantA', 'participantB']);
});

test('relationship migration rejects a family without an owner', () => {
  assert.throws(
    () => migrateLegacyFamilyRelationships('orphan', { childName: 'Alex', members: { alex: 'child' } }, '2026-07-10T12:00:00.000Z'),
    /missing_owner/,
  );
});

test('relationship migration accepts reruns but detects conflicting target data', () => {
  const migrated = migrateLegacyFamilyRelationships('family-alex', {
    childName: 'Alex',
    members: { owner: 'parent', alex: 'child' },
  }, '2026-07-10T12:00:00.000Z');

  assert.equal(isCompatibleParticipantMigration(migrated.participant, migrated.participant), true);
  assert.equal(isCompatibleParticipantMigration({ ...migrated.participant, sourceFamilyId: 'another-family' }, migrated.participant), false);
  assert.equal(isCompatibleMembershipMigration(migrated.memberships[0], migrated.memberships[0]), true);
  assert.equal(isCompatibleMembershipMigration({ ...migrated.memberships[0], role: 'viewer' }, migrated.memberships[0]), false);
  assert.equal(isCompatibleParticipantRefMigration(migrated.participantRefs[0], migrated.participantRefs[0]), true);
  assert.equal(isCompatibleParticipantRefMigration({ ...migrated.participantRefs[0], participantId: 'another-participant' }, migrated.participantRefs[0]), false);
});

test('content migration accepts its own copies but rejects colliding participant data', () => {
  const sourcePath = 'families/family-alex/checks/check-1';
  assert.equal(isCompatibleLegacyContentTarget(undefined, 'family-alex', sourcePath), true);
  assert.equal(isCompatibleLegacyContentTarget({
    relationshipSourceFamilyId: 'family-alex',
    relationshipSourcePath: sourcePath,
  }, 'family-alex', sourcePath), true);
  assert.equal(isCompatibleLegacyContentTarget({ status: 'pending' }, 'family-alex', sourcePath), false);
  assert.equal(isCompatibleLegacyContentTarget({
    relationshipSourceFamilyId: 'another-family',
    relationshipSourcePath: sourcePath,
  }, 'family-alex', sourcePath), false);
});
