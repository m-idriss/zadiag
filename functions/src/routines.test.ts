import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultRoutineAssignment, createDraftRoutineAssignment, DEFAULT_ROUTINE_ID, isRoutineValidationMode, migrateCheckRoutineId } from './routines.js';

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
  assert.equal(assignment.validationMode, 'auto');
});

test('migrates legacy checks idempotently', () => {
  const legacy = { id: 'check-1', status: 'pending' };
  const migrated = migrateCheckRoutineId(legacy);
  assert.equal(migrated.routineId, DEFAULT_ROUTINE_ID);
  assert.deepEqual(migrateCheckRoutineId(migrated), migrated);
});

test('accepts only supported routine validation modes', () => {
  assert.equal(isRoutineValidationMode('auto'), true);
  assert.equal(isRoutineValidationMode('ai'), true);
  assert.equal(isRoutineValidationMode('manual'), false);
  assert.equal(isRoutineValidationMode(undefined), false);
});
