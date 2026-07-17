import assert from 'node:assert/strict';
import test from 'node:test';
import { ROUTINE_PACKAGE_MIME, parseRoutinePackageEnvelope, serializeRoutinePackage } from './routinePackages.js';

const pkg = () => ({ schemaVersion: 1 as const, version: 1, defaultLocale: 'en' as const, availableLocales: ['en'] as ['en'], routine: { id: 'private-test', name: 'Test routine', description: 'Long description', instructions: 'Long instructions', icon: 'sparkles', proofType: 'photo', proofExample: 'Visible evidence', responsibleName: 'Adult', instructionSteps: [{ id: 'one', icon: 'a', title: 'One', description: 'Description one' }, { id: 'two', icon: 'b', title: 'Two', description: 'Description two' }], analysis: { expectedEvidence: 'Expected evidence long enough', detectedCriteria: 'Detected criteria long enough', notDetectedCriteria: 'Missing criteria long enough', uncertaintyCriteria: 'Uncertain criteria long enough' } } });
test('exports deterministically and preserves provenance', () => { const value = serializeRoutinePackage('draft-1', 2, '2026-07-17T12:00:00.000Z', pkg()); assert.equal(value, serializeRoutinePackage('draft-1', 2, '2026-07-17T12:00:00.000Z', pkg())); assert.equal(parseRoutinePackageEnvelope(value, ROUTINE_PACKAGE_MIME).provenance.sourceDraftId, 'draft-1'); });
test('rejects malformed, traversal, executable, MIME and version inputs', () => {
  const valid = JSON.parse(serializeRoutinePackage('draft-1', 2, '2026-07-17T12:00:00.000Z', pkg()));
  for (const changed of [{ ...valid, path: '../routine.json' }, { ...valid, formatVersion: 2 }, { ...valid, package: { ...valid.package, routine: { ...valid.package.routine, description: '<script>alert(1)</script>' } } }]) assert.throws(() => parseRoutinePackageEnvelope(JSON.stringify(changed), ROUTINE_PACKAGE_MIME));
  assert.throws(() => parseRoutinePackageEnvelope('{', ROUTINE_PACKAGE_MIME));
  assert.throws(() => parseRoutinePackageEnvelope(JSON.stringify(valid), 'application/json'));
  assert.throws(() => parseRoutinePackageEnvelope('x'.repeat(96 * 1024 + 1), ROUTINE_PACKAGE_MIME));
});
