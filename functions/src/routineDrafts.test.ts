import assert from 'node:assert/strict';
import test from 'node:test';
import { assertRoutineDraftRevision, createAssignmentForkPackage, createRoutineDraftDocument, parseRoutineDraftPackage, routineDraftSessionId, RoutineDraftConflictError, RoutineDraftInputError, selectReusableAssignmentDraft, updateRoutineDraftDocument, type RoutineDraftPackage } from './routineDrafts.js';

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

test('accepts typed responses and rejects malformed response configuration', () => {
  const confirmation = routinePackage();
  Object.assign(confirmation.routine, { response: { kind: 'confirmation', prompt: 'Did you complete the routine?' } });
  assert.equal(parseRoutineDraftPackage(confirmation).validation.status, 'valid');

  const duplicateChecklist = routinePackage();
  Object.assign(duplicateChecklist.routine, {
    response: { kind: 'checklist', prompt: 'Confirm each item', items: [{ id: 'dose', label: 'First' }, { id: 'dose', label: 'Second' }] },
  });
  assert.equal(parseRoutineDraftPackage(duplicateChecklist).validation.status, 'invalid');

  const malformedQuiz = routinePackage();
  Object.assign(malformedQuiz.routine, { response: { kind: 'quiz', prompt: 'Quiz', topic: 'Java', mode: 'generated', questionCount: 0, choiceCount: 3 } });
  assert.throws(() => parseRoutineDraftPackage(malformedQuiz), RoutineDraftInputError);
});

test('validates bounded photo checklist definitions and their localized labels', () => {
  const visual = routinePackage() as unknown as RoutineDraftPackage;
  const visualCriteria = [
    { id: 'upper-elastic', label: 'Upper elastic', criterion: 'The upper elastic is visibly attached.', required: true },
    { id: 'lower-elastic', label: 'Lower elastic', criterion: 'The lower elastic is visibly attached.', required: false },
  ];
  Object.assign(visual.routine, {
    response: {
      kind: 'photo_checklist',
      prompt: 'Show the completed setup',
      criteria: visualCriteria,
    },
  });
  visual.availableLocales = ['en', 'fr'];
  visual.routine.translations = {
    fr: {
      name: visual.routine.name,
      description: visual.routine.description,
      instructions: visual.routine.instructions,
      proofExample: visual.routine.proofExample,
      analysis: visual.routine.analysis,
      instructionSteps: visual.routine.instructionSteps,
      photoChecklist: {
        prompt: 'Montrez l’installation terminée',
        criteria: [
          { id: 'upper-elastic', label: 'Élastique supérieur' },
          { id: 'lower-elastic', label: 'Élastique inférieur' },
        ],
      },
    },
  };
  assert.equal(parseRoutineDraftPackage(visual).validation.status, 'valid');

  const duplicate = structuredClone(visual);
  if (duplicate.routine.response?.kind !== 'photo_checklist') throw new Error('invalid test fixture');
  duplicate.routine.response.criteria[1].id = 'upper-elastic';
  assert.equal(parseRoutineDraftPackage(duplicate).validation.status, 'invalid');

  const driftedTranslation = structuredClone(visual);
  if (driftedTranslation.routine.response?.kind !== 'photo_checklist') throw new Error('invalid test fixture');
  driftedTranslation.routine.translations!.fr!.photoChecklist!.criteria.reverse();
  assert.equal(parseRoutineDraftPackage(driftedTranslation).validation.status, 'invalid');

  for (const criteria of [
    visualCriteria.slice(0, 1),
    [...visualCriteria, ...Array.from({ length: 5 }, (_, index) => ({ id: `extra-${index}`, label: 'Extra', criterion: 'Extra criterion.', required: false }))],
  ]) {
    const invalid = structuredClone(visual);
    if (invalid.routine.response?.kind !== 'photo_checklist') throw new Error('invalid test fixture');
    invalid.routine.response.criteria = criteria;
    assert.throws(() => parseRoutineDraftPackage(invalid), RoutineDraftInputError);
  }
  const unknown = structuredClone(visual);
  if (unknown.routine.response?.kind !== 'photo_checklist') throw new Error('invalid test fixture');
  (unknown.routine.response.criteria[0] as Record<string, unknown>).unknown = true;
  assert.throws(() => parseRoutineDraftPackage(unknown), RoutineDraftInputError);
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

test('reuses the latest compatible active assignment draft', () => {
  const first = {
    id: 'first',
    ...createRoutineDraftDocument('owner-1', routinePackage(), '2026-07-20T10:00:00.000Z'),
    forkedFrom: { routineId: 'private-routine', sourceVersion: undefined, origin: 'builtin' as const },
  };
  const latest = {
    ...first,
    id: 'latest',
    revision: 2,
    updatedAt: '2026-07-20T10:05:00.000Z',
  };
  const archived = { ...latest, id: 'archived', state: 'archived' as const, updatedAt: '2026-07-20T10:10:00.000Z' };
  const otherOwner = { ...latest, id: 'other-owner', ownerId: 'owner-2', updatedAt: '2026-07-20T10:20:00.000Z' };

  assert.equal(selectReusableAssignmentDraft([first, archived, otherOwner, latest], 'owner-1', 'private-routine')?.id, 'latest');
  assert.equal(selectReusableAssignmentDraft([latest], 'owner-1', 'other-routine'), undefined);
  assert.equal(selectReusableAssignmentDraft([latest], 'owner-1', 'private-routine', 1), undefined);
});

test('uses one stable edit session per owner and assigned routine', () => {
  assert.equal(routineDraftSessionId('owner-1', 'routine-1'), routineDraftSessionId('owner-1', 'routine-1'));
  assert.notEqual(routineDraftSessionId('owner-1', 'routine-1'), routineDraftSessionId('owner-1', 'routine-2'));
  assert.notEqual(routineDraftSessionId('owner-1', 'routine-1'), routineDraftSessionId('owner-2', 'routine-1'));
});

test('rejects stale optimistic revisions actionably', () => {
  assert.doesNotThrow(() => assertRoutineDraftRevision(2, 2));
  assert.throws(() => assertRoutineDraftRevision(2, 1), RoutineDraftConflictError);
});
