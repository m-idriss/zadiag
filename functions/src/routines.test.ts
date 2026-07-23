import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPhotoChecklistReview, challengeForAssignment, createDefaultRoutineAssignment, createDraftRoutineAssignment, createRoutineAssignmentVersionChange, DEFAULT_ROUTINE_ID, derivePhotoChecklistStatus, isRoutineValidationMode, migrateCheckRoutineId, parseRoutineResponseSubmission, responseForRoutine, RoutineResponseInputError, routineAssignmentProvenance, shouldCreateDefaultRoutineAssignment } from './routines.js';

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

test('routes legacy routines to the photo response boundary', () => {
  assert.deepEqual(responseForRoutine({}), { kind: 'photo' });
  assert.deepEqual(responseForRoutine({ response: { kind: 'confirmation', prompt: 'Done?' } }), { kind: 'confirmation', prompt: 'Done?' });
});

test('freezes the assigned challenge and validates structured responses exactly', () => {
  const assignment = createDraftRoutineAssignment({
    id: 'medication', name: 'Morning treatment', description: 'Track each morning dose.', instructions: 'Confirm each prescribed medicine.',
    response: { kind: 'checklist', prompt: 'Taken?', items: [{ id: 'dose-a', label: 'Medicine A' }, { id: 'dose-b', label: 'Medicine B' }] },
  }, plan, 'draft-1', 1);
  const challenge = challengeForAssignment(assignment);
  assignment.routine.name = 'Changed later';
  (assignment.routine.response as { kind: 'checklist'; items: Array<{ id: string; label: string }> }).items[0].label = 'Changed later';

  assert.equal(challenge.name, 'Morning treatment');
  assert.deepEqual(parseRoutineResponseSubmission(challenge.response, {
    kind: 'checklist', items: [{ id: 'dose-b', value: false }, { id: 'dose-a', value: true }],
  }), { kind: 'checklist', items: [{ id: 'dose-b', value: false }, { id: 'dose-a', value: true }] });
  assert.throws(() => parseRoutineResponseSubmission(challenge.response, {
    kind: 'checklist', items: [{ id: 'dose-a', value: true }],
  }), RoutineResponseInputError);
  assert.throws(() => parseRoutineResponseSubmission({ kind: 'photo' }, { kind: 'confirmation', value: true }), RoutineResponseInputError);
});

test('freezes photo checklist criteria independently from later routine edits', () => {
  const assignment = createDraftRoutineAssignment({
    id: 'elastics', name: 'Elastics', description: 'Check elastics.', instructions: 'Take one clear photo.',
    response: {
      kind: 'photo_checklist',
      prompt: 'Show both elastics',
      criteria: [
        { id: 'upper', label: 'Upper elastic', criterion: 'The upper elastic is attached.', required: true },
        { id: 'lower', label: 'Lower elastic', criterion: 'The lower elastic is attached.', required: false },
      ],
    },
  }, plan, 'draft-visual', 2);
  const challenge = challengeForAssignment(assignment);
  const response = assignment.routine.response;
  if (response?.kind !== 'photo_checklist') throw new Error('invalid test fixture');
  response.criteria[0].label = 'Changed after request';
  response.criteria.reverse();

  assert.deepEqual(challenge.response, {
    kind: 'photo_checklist',
    prompt: 'Show both elastics',
    criteria: [
      { id: 'upper', label: 'Upper elastic', criterion: 'The upper elastic is attached.', required: true },
      { id: 'lower', label: 'Lower elastic', criterion: 'The lower elastic is attached.', required: false },
    ],
  });
});

test('derives photo checklist status only from required criteria', () => {
  const criteria = [
    { id: 'required-a', label: 'Required A', criterion: 'A is visible.', required: true },
    { id: 'required-b', label: 'Required B', criterion: 'B is visible.', required: true },
    { id: 'optional', label: 'Optional', criterion: 'Optional detail is visible.', required: false },
  ];
  assert.equal(derivePhotoChecklistStatus(criteria, [
    { criterionId: 'required-a', status: 'detected' },
    { criterionId: 'required-b', status: 'detected' },
    { criterionId: 'optional', status: 'not_detected' },
  ]), 'detected');
  assert.equal(derivePhotoChecklistStatus(criteria, [
    { criterionId: 'required-a', status: 'uncertain' },
    { criterionId: 'required-b', status: 'not_detected' },
    { criterionId: 'optional', status: 'detected' },
  ]), 'not_detected');
  assert.equal(derivePhotoChecklistStatus(criteria, [
    { criterionId: 'required-a', status: 'uncertain' },
    { criterionId: 'required-b', status: 'detected' },
    { criterionId: 'optional', status: 'not_detected' },
  ]), 'uncertain');
  assert.throws(() => derivePhotoChecklistStatus(criteria, [
    { criterionId: 'required-a', status: 'detected' },
    { criterionId: 'required-b', status: 'detected' },
  ]), /invalid_photo_checklist_results/);
  assert.throws(() => derivePhotoChecklistStatus(criteria, [
    { criterionId: 'required-a', status: 'detected' },
    { criterionId: 'required-b', status: 'detected' },
    { criterionId: 'unknown', status: 'detected' },
  ]), /invalid_photo_checklist_results/);
});

test('reviews unresolved photo checklist items and finalizes only after every item is resolved', () => {
  const criteria = [
    { id: 'required', label: 'Required', criterion: 'Visible.', required: true },
    { id: 'optional', label: 'Optional', criterion: 'Visible.', required: false },
  ];
  const results = [
    { criterionId: 'required', status: 'uncertain' as const, confidence: 0.4, reason: 'Unclear.', decision: { source: 'ai' as const } },
    { criterionId: 'optional', status: 'uncertain' as const, confidence: 0.3, reason: 'Unclear.', decision: { source: 'ai' as const } },
  ];
  const reviewer = { actorUid: 'owner-1', decidedAt: '2026-07-23T20:00:00.000Z' };
  const partial = applyPhotoChecklistReview(criteria, results, [
    { criterionId: 'required', status: 'detected', reason: 'Visible on the retained proof.' },
  ], reviewer);
  assert.equal(partial.complete, false);
  assert.equal(partial.status, 'uncertain');
  assert.deepEqual(partial.items[0].decision, { source: 'responsible', ...reviewer });
  assert.equal(partial.items[1].status, 'uncertain');

  const complete = applyPhotoChecklistReview(criteria, partial.items, [
    { criterionId: 'optional', status: 'not_detected', reason: 'The optional case is absent.' },
  ], reviewer);
  assert.equal(complete.complete, true);
  assert.equal(complete.status, 'detected');
});

test('keeps repeated photo checklist reviews idempotent and rejects conflicts or clear AI overrides', () => {
  const criteria = [
    { id: 'required', label: 'Required', criterion: 'Visible.', required: true },
    { id: 'optional', label: 'Optional', criterion: 'Visible.', required: false },
  ];
  const reviewer = { actorUid: 'owner-1', decidedAt: '2026-07-23T20:00:00.000Z' };
  const resolved = [
    { criterionId: 'required', status: 'detected' as const, confidence: 1, reason: 'Visible.', decision: { source: 'responsible' as const, ...reviewer } },
    { criterionId: 'optional', status: 'detected' as const, confidence: 0.9, reason: 'Visible.', decision: { source: 'ai' as const } },
  ];
  const repeated = applyPhotoChecklistReview(criteria, resolved, [
    { criterionId: 'required', status: 'detected', reason: 'Visible.' },
  ], { actorUid: 'owner-2', decidedAt: '2026-07-23T20:01:00.000Z' });
  assert.equal(repeated.changed, false);
  assert.deepEqual(repeated.items, resolved);
  assert.throws(() => applyPhotoChecklistReview(criteria, resolved, [
    { criterionId: 'required', status: 'not_detected', reason: 'Missing.' },
  ], reviewer), /photo_checklist_item_already_resolved/);
  assert.throws(() => applyPhotoChecklistReview(criteria, resolved, [
    { criterionId: 'optional', status: 'not_detected', reason: 'Missing.' },
  ], reviewer), /photo_checklist_item_already_resolved/);
  assert.throws(() => applyPhotoChecklistReview(criteria, resolved, [
    { criterionId: 'unknown', status: 'detected', reason: 'Visible.' },
  ], reviewer), /invalid_photo_checklist_review/);
});
