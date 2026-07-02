import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultRoutineAssignment, DEFAULT_ROUTINE_ID, migrateCheckRoutineId } from './routines.js';

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

test('migrates legacy checks idempotently', () => {
  const legacy = { id: 'check-1', status: 'pending' };
  const migrated = migrateCheckRoutineId(legacy);
  assert.equal(migrated.routineId, DEFAULT_ROUTINE_ID);
  assert.deepEqual(migrateCheckRoutineId(migrated), migrated);
});
