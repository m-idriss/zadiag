import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_ROUTINE_ID, migrateCheckRoutineId } from './routines.js';

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
