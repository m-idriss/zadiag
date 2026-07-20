import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultRoutineAssignment, createDraftRoutineAssignment, createRoutineAssignmentVersionChange, DEFAULT_ROUTINE_ID, isRoutineValidationMode, migrateCheckRoutineId, routineAssignmentProvenance, shouldCreateDefaultRoutineAssignment } from './routines.js';

const plan = {
  checksPerDay: 1,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  windows: [{ id: 'evening', start: '18:00', end: '20:00' }],
  expiryMinutes: 20,
  timeZone: 'Europe/Paris',
};

test('creates a stable default routine assignment from a legacy plan', () => {
  const assignment = createDefaultRoutineAssignment(plan, '2026-07-02T00:00:00.000Z');
  assert.equal(assignment.routineId, DEFAULT_ROUTINE_ID);
  assert.deepEqual(assignment.plan, plan);
  assert.equal(assignment.assignedAt, '2026-07-02T00:00:00.000Z');
});

test('creates an isolated assignment snapshot with its source revision', () => {
  const routine = { id: 'private-evening', name: 'Evening', description: 'Private routine', recommendedValidationMode: 'auto' as const };
  const assignment = createDraftRoutineAssignment(routine, plan, 'draft-1', 3, '2026-07-17T12:00:00.000Z');
  routine.name = 'Changed draft';
  assert.equal(assignment.routine.name, 'Evening');
  assert.equal(assignment.sourceDraftId, 'draft-1');
  assert.equal(assignment.sourceRevision, 3);
  assert.equal(assignment.sourceVersion, 1);
  assert.equal(assignment.validationMode, 'auto');
});

test('preserves the replaced assignment and exposes check provenance', () => {
  const routine = { id: 'private-evening', name: 'Evening', description: 'Private routine' };
  const assignment = createDraftRoutineAssignment(routine, plan, 'draft-1', 4, '2026-07-20T08:00:00.000Z', 2);
  const change = createRoutineAssignmentVersionChange(assignment, { sourceDraftId: 'draft-2', sourceRevision: 3, sourceVersion: 3 }, 'owner-1', '2026-07-20T10:00:00.000Z');

  assert.deepEqual(routineAssignmentProvenance(assignment), { routineSourceDraftId: 'draft-1', routineSourceRevision: 4, routineSourceVersion: 2 });
  assert.equal(change.from.routine.name, assignment.routine.name);
  assert.deepEqual(change.to, { sourceDraftId: 'draft-2', sourceRevision: 3, sourceVersion: 3 });
  assert.equal(change.appliedBy, 'owner-1');
});

test('migrates legacy checks idempotently', () => {
  const legacy = { id: 'check-1', status: 'pending' };
  const migrated = migrateCheckRoutineId(legacy);
  assert.equal(migrated.routineId, DEFAULT_ROUTINE_ID);
  assert.deepEqual(migrateCheckRoutineId(migrated), migrated);
});

test('does not recreate a deliberately deleted default routine after migration', () => {
  assert.equal(shouldCreateDefaultRoutineAssignment(0, false), true);
  assert.equal(shouldCreateDefaultRoutineAssignment(1, false), false);
  assert.equal(shouldCreateDefaultRoutineAssignment(1, true), false);
});

test('accepts only supported routine validation modes', () => {
  assert.equal(isRoutineValidationMode('auto'), true);
  assert.equal(isRoutineValidationMode('ai'), true);
  assert.equal(isRoutineValidationMode('manual'), false);
  assert.equal(isRoutineValidationMode(undefined), false);
});
