import { describe, expect, it } from 'vitest';
import type { Routine } from './models';
import {
  archiveRoutineDraft,
  createBlankRoutinePackage,
  prepareMinimalRoutinePackage,
  routinePackageInLocale,
  createRoutineDraft,
  createRoutineDraftSnapshot,
  restoreRoutineDraft,
  RoutineDraftError,
  routineDraftIsAssignable,
  routineDraftIsComplete,
  routineDraftIsPublishable,
  routineContentChanges,
  selectRoutineVersionTarget,
  updateRoutineDraft,
  type RoutineDraftValidation,
  type RoutinePackageV1,
} from './routineDraft';

const routine: Routine = {
  id: 'custom-routine',
  name: 'Custom routine',
  description: 'A private routine draft.',
};

const packageV1 = (): RoutinePackageV1 => ({
  schemaVersion: 1,
  version: 1,
  defaultLocale: 'en',
  availableLocales: ['en'],
  routine: structuredClone(routine),
});

describe('routine content changes', () => {
  it('reports only the user-facing groups that changed', () => {
    const current = draft().package.routine;
    const next = structuredClone(current);
    next.name = 'Updated name';
    next.instructionSteps = [{ id: 'one', icon: 'sparkles', title: 'First', description: 'Changed' }];
    next.analysis = { ...next.analysis!, detectedCriteria: 'New criteria' };

    expect(routineContentChanges(current, next)).toEqual(['identity', 'instructions', 'analysis']);
  });
});

describe('routine version targets', () => {
  const version = (value: number) => ({ routineId: 'routine-1', ownerId: 'owner', sourceDraftId: `draft-${value}`, sourceRevision: 1, version: value, package: packageV1(), publishedAt: `2026-07-2${value}T10:00:00.000Z` });

  it('prefers the latest update and offers the previous version for rollback', () => {
    const versions = [version(1), version(2), version(3)];
    expect(selectRoutineVersionTarget(versions, 'routine-1', 1)?.version).toBe(3);
    expect(selectRoutineVersionTarget(versions, 'routine-1', 3)?.version).toBe(2);
  });
});

const valid: RoutineDraftValidation = { status: 'valid', issues: [] };
const incomplete: RoutineDraftValidation = {
  status: 'incomplete',
  issues: [{ code: 'required_field', path: 'routine.instructions' }],
};
const overLimit: RoutineDraftValidation = {
  status: 'invalid',
  issues: [{ code: 'limit_exceeded', path: 'routine.instructions' }],
};

const draft = (validation = valid) => createRoutineDraft({
  id: 'draft-1',
  ownerId: 'owner-1',
  package: packageV1(),
  validation,
  createdAt: '2026-07-17T12:00:00.000Z',
});

describe('private routine draft domain', () => {
  it('creates a blank package in the selected primary locale', () => {
    const routinePackage = createBlankRoutinePackage('fr', 'private-evening');
    expect(routinePackage.defaultLocale).toBe('fr');
    expect(routinePackage.availableLocales).toEqual(['fr']);
    expect(routinePackage.routine.id).toBe('private-evening');
    expect(routinePackage.routine.response).toEqual({ kind: 'photo' });
    expect(routinePackage.routine.instructionSteps).toHaveLength(2);
  });

  it('builds a valid single-language routine from one instruction', () => {
    const prepared = prepareMinimalRoutinePackage({ ...createBlankRoutinePackage('fr', 'private-evening'), routine: { ...createBlankRoutinePackage('fr', 'private-evening').routine, instructions: 'Mettre les élastiques orthodontiques après le dîner.' } }, true);
    expect(prepared.availableLocales).toEqual(['fr']);
    expect(prepared.routine.translations).toBeUndefined();
    expect(prepared.routine.name).toBe('Mettre les élastiques orthodontiques après le dîner');
    expect(prepared.routine.instructionSteps).toHaveLength(2);
    expect(prepared.routine.proofType).toBe('photo');
    expect(prepared.routine.analysis?.detectedCriteria).toContain('élastiques orthodontiques');
  });

  it('uses the current user locale when translated content is available', () => {
    const source = createBlankRoutinePackage('en', 'private-evening');
    source.availableLocales = ['en', 'fr'];
    source.routine.name = 'Evening routine';
    source.routine.translations = { fr: { name: 'Routine du soir', instructions: 'Mettre les élastiques après le dîner.' } };
    const localized = routinePackageInLocale(source, 'fr');

    expect(localized.defaultLocale).toBe('fr');
    expect(localized.availableLocales).toEqual(['fr']);
    expect(localized.routine.name).toBe('Routine du soir');
    expect(localized.routine.instructions).toBe('Mettre les élastiques après le dîner.');
    expect(localized.routine.translations).toBeUndefined();
  });

  it('creates an owned active draft at revision one without retaining mutable input', () => {
    const sourcePackage = packageV1();
    const created = createRoutineDraft({
      id: 'draft-1', ownerId: 'owner-1', package: sourcePackage, validation: valid, createdAt: '2026-07-17T12:00:00.000Z',
    });
    sourcePackage.routine.name = 'Changed outside';

    expect(created).toMatchObject({ id: 'draft-1', ownerId: 'owner-1', revision: 1, state: 'active' });
    expect(created.package.routine.name).toBe('Custom routine');
  });

  it('classifies incomplete, invalid, assignable, and publishable drafts from validation', () => {
    expect(routineDraftIsComplete(draft(incomplete))).toBe(false);
    expect(routineDraftIsAssignable(draft(incomplete))).toBe(false);
    expect(routineDraftIsComplete(draft(overLimit))).toBe(true);
    expect(routineDraftIsAssignable(draft(overLimit))).toBe(false);
    expect(routineDraftIsAssignable(draft())).toBe(true);
    expect(routineDraftIsPublishable(draft())).toBe(true);
  });

  it('updates content with optimistic revision control while preserving identity', () => {
    const current = draft(incomplete);
    const nextPackage = packageV1();
    nextPackage.routine.name = 'Completed routine';
    const updated = updateRoutineDraft(current, {
      expectedRevision: 1, package: nextPackage, validation: valid, updatedAt: '2026-07-17T12:10:00.000Z',
    });

    expect(updated).toMatchObject({ id: current.id, ownerId: current.ownerId, revision: 2, state: 'active' });
    expect(updated.package.routine.name).toBe('Completed routine');
    expect(current.package.routine.name).toBe('Custom routine');
    expect(() => updateRoutineDraft(updated, {
      expectedRevision: 1, package: nextPackage, validation: valid, updatedAt: '2026-07-17T12:11:00.000Z',
    })).toThrowError(expect.objectContaining({ code: 'stale_revision' }));
  });

  it('rejects package identity changes through ordinary updates', () => {
    const nextPackage = packageV1();
    nextPackage.routine.id = 'another-routine';

    expect(() => updateRoutineDraft(draft(), {
      expectedRevision: 1, package: nextPackage, validation: valid, updatedAt: '2026-07-17T12:10:00.000Z',
    })).toThrowError(expect.objectContaining({ code: 'immutable_identity' }));
  });

  it('enforces archive and restore transitions', () => {
    const archived = archiveRoutineDraft(draft(), 1, '2026-07-17T12:10:00.000Z');
    expect(archived).toMatchObject({ revision: 2, state: 'archived' });
    expect(routineDraftIsAssignable(archived)).toBe(false);
    expect(() => archiveRoutineDraft(archived, 2, '2026-07-17T12:11:00.000Z')).toThrowError(expect.objectContaining({ code: 'invalid_transition' }));

    const restored = restoreRoutineDraft(archived, 2, '2026-07-17T12:12:00.000Z');
    expect(restored).toMatchObject({ revision: 3, state: 'active' });
  });

  it('creates an independent snapshot only from an active valid draft', () => {
    const source = draft();
    const snapshot = createRoutineDraftSnapshot(source);
    source.package.routine.name = 'Changed later';

    expect(snapshot.name).toBe('Custom routine');
    expect(() => createRoutineDraftSnapshot(draft(incomplete))).toThrowError(RoutineDraftError);
  });

  it('rejects contradictory validation results', () => {
    expect(() => draft({ status: 'valid', issues: [{ code: 'invalid_package', path: 'routine' }] })).toThrowError(
      expect.objectContaining({ code: 'invalid_validation' }),
    );
    expect(() => draft({ status: 'invalid', issues: [] })).toThrowError(expect.objectContaining({ code: 'invalid_validation' }));
  });

  it('rejects invalid or backwards lifecycle timestamps', () => {
    expect(() => createRoutineDraft({
      id: 'draft-1', ownerId: 'owner-1', package: packageV1(), validation: valid, createdAt: 'not-a-date',
    })).toThrowError(expect.objectContaining({ code: 'invalid_timestamp' }));
    expect(() => archiveRoutineDraft(draft(), 1, '2026-07-17T11:59:00.000Z')).toThrowError(
      expect.objectContaining({ code: 'invalid_timestamp' }),
    );
  });
});
