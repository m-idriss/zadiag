import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRoutineDraftRevision, createAssignmentForkPackage, createRoutineDraftDocument, parseRoutineDraftPackage, RoutineDraftConflictError, RoutineDraftInputError, updateRoutineDraftDocument } from './routineDrafts.js';

const routinePackage = () => ({
  schemaVersion: 1,
  version: 1,
  defaultLocale: 'en',
  availableLocales: ['en'],
  routine: {
    id: 'private-routine',
    name: 'Private routine',
    description: 'A complete private routine.',
    instructions: 'Complete the private routine and send proof.',
    icon: 'star', accentColor: '#2387c9', category: 'custom', proofType: 'Photo',
    proofExample: 'A clear photo of the completed routine.', recommendedValidationMode: 'ai', responsibleName: 'Care team',
    analysis: {
      expectedEvidence: 'A clear photo showing the completed private routine.',
      detectedCriteria: 'The completed private routine is clearly visible.',
      notDetectedCriteria: 'The image is clear but the routine proof is absent.',
      uncertaintyCriteria: 'The image is blurry, dark, cropped, or ambiguous.',
    },
    instructionSteps: [
      { id: 'prepare', icon: 'star', title: 'Prepare', description: 'Prepare everything needed for the routine.' },
      { id: 'send', icon: 'send', title: 'Send proof', description: 'Send a clear photo of the routine proof.' },
    ],
  },
});

test('parses complete packages as valid and incomplete packages as resumable', () => {
  assert.equal(parseRoutineDraftPackage(routinePackage()).validation.status, 'valid');
  const incomplete = routinePackage();
  delete (incomplete.routine as Partial<typeof incomplete.routine>).instructions;
  const result = parseRoutineDraftPackage(incomplete);
  assert.equal(result.validation.status, 'incomplete');
  assert.deepEqual(result.validation.issues, [{ code: 'required_field', path: 'routine.instructions' }]);
});

test('accepts French as the primary package locale', () => {
  const french = { ...routinePackage(), defaultLocale: 'fr', availableLocales: ['fr'] };
  assert.equal(parseRoutineDraftPackage(french).package.defaultLocale, 'fr');
  assert.equal(parseRoutineDraftPackage(french).validation.status, 'valid');
});

test('rejects translated placeholder drift', () => {
  const translated = routinePackage() as ReturnType<typeof routinePackage> & { routine: ReturnType<typeof routinePackage>['routine'] & { translations?: unknown } };
  translated.availableLocales = ['en', 'fr'];
  translated.routine.name = 'Routine for {name}';
  translated.routine.translations = { fr: { name: 'Routine traduite', description: translated.routine.description, instructions: translated.routine.instructions, proofExample: translated.routine.proofExample, analysis: translated.routine.analysis, instructionSteps: translated.routine.instructionSteps } };
  assert.equal(parseRoutineDraftPackage(translated).validation.status, 'invalid');
});

test('rejects unknown, malformed, and oversized package data', () => {
  assert.throws(() => parseRoutineDraftPackage({ ...routinePackage(), executable: '<script>' }), RoutineDraftInputError);
  assert.throws(() => parseRoutineDraftPackage({ ...routinePackage(), schemaVersion: 2 }), RoutineDraftInputError);
  const oversized = routinePackage();
  oversized.routine.instructions = 'x'.repeat(65_536);
  assert.throws(() => parseRoutineDraftPackage(oversized), /package_too_large/);
});

test('creates owned revisions and preserves package identity on update', () => {
  const created = createRoutineDraftDocument('owner-1', routinePackage(), '2026-07-17T12:00:00.000Z');
  const changed = routinePackage();
  changed.routine.name = 'Updated private routine';
  const updated = updateRoutineDraftDocument(created, changed, '2026-07-17T12:10:00.000Z');
  assert.equal(updated.ownerId, 'owner-1');
  assert.equal(updated.revision, 2);
  assert.equal(updated.package.routine.name, 'Updated private routine');

  const replaced = routinePackage();
  replaced.routine.id = 'other-routine';
  assert.throws(() => updateRoutineDraftDocument(created, replaced), /immutable_identity/);
});

test('forks an assignment snapshot into an independent next-version package', () => {
  const source = routinePackage();
  const fork = createAssignmentForkPackage(source.routine, 3, 'fr');

  assert.equal(fork.version, 4);
  assert.equal(fork.routine.id, source.routine.id);
  assert.equal(fork.routine.name, source.routine.name);
  assert.notEqual(fork.routine, source.routine);
  assert.equal(source.routine.id, 'private-routine');
});

test('rejects stale optimistic revisions actionably', () => {
  assert.doesNotThrow(() => assertRoutineDraftRevision(2, 2));
  assert.throws(() => assertRoutineDraftRevision(2, 1), RoutineDraftConflictError);
});
