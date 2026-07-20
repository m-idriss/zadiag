import type { Locale, Routine } from './models';

export interface RoutinePackageV1 {
  schemaVersion: 1;
  version: number;
  defaultLocale: 'en' | 'fr';
  availableLocales: ['en'] | ['fr'] | ['en', 'fr'];
  routine: Routine;
}

export type RoutineDraftValidationIssueCode = 'required_field' | 'limit_exceeded' | 'invalid_package';

export interface RoutineDraftValidationIssue {
  code: RoutineDraftValidationIssueCode;
  path: string;
}

export interface RoutineDraftValidation {
  status: 'incomplete' | 'invalid' | 'valid';
  issues: RoutineDraftValidationIssue[];
}

export interface RoutineDraft {
  readonly id: string;
  readonly ownerId: string;
  revision: number;
  state: 'active' | 'archived';
  package: RoutinePackageV1;
  validation: RoutineDraftValidation;
  readonly createdAt: string;
  updatedAt: string;
  forkedFrom?: { routineId: string; sourceVersion?: number; origin?: 'builtin' | 'private' | 'community' };
}
export interface PublishedRoutineVersion {
  ownerId: string; authorName?: string; origin?: 'builtin' | 'private' | 'community'; sourceDraftId: string; sourceRevision: number; version: number; package: RoutinePackageV1; publishedAt: string; archivedAt?: string;
}

export const selectRoutineVersionTarget = (
  versions: Array<PublishedRoutineVersion & { routineId: string }>,
  routineId: string,
  currentVersion = 0,
) => {
  const candidates = versions.filter((version) => version.routineId === routineId && !version.archivedAt && version.version !== currentVersion);
  return candidates.filter((version) => version.version > currentVersion).sort((a, b) => b.version - a.version)[0]
    ?? candidates.filter((version) => version.version < currentVersion).sort((a, b) => b.version - a.version)[0];
};
export interface RoutineCatalogEntry extends PublishedRoutineVersion {
  id: string; routineId: string; authorName: string; visibility: 'listed' | 'unlisted'; sharedAt: string; revokedAt?: string;
  source?: 'external'; license?: string; checksum?: string;
}

export const DEFAULT_PRIVATE_ROUTINE_ACCENT = '#2563EB';

export const createBlankRoutinePackage = (locale: Locale, id = `private-${crypto.randomUUID().toLowerCase()}`): RoutinePackageV1 => ({
  schemaVersion: 1,
  version: 1,
  defaultLocale: locale,
  availableLocales: [locale],
  routine: {
    id, name: '', description: '', instructions: '', icon: 'sparkles', accentColor: DEFAULT_PRIVATE_ROUTINE_ACCENT, category: 'custom',
    proofType: 'photo', proofExample: '', recommendedValidationMode: 'ai', responsibleName: '',
    instructionSteps: [
      { id: 'step-1', icon: 'sparkles', title: '', description: '' },
      { id: 'step-2', icon: 'sparkles', title: '', description: '' },
    ],
    analysis: { expectedEvidence: '', detectedCriteria: '', notDetectedCriteria: '', uncertaintyCriteria: '' },
  },
});

type RoutineDraftErrorCode =
  | 'invalid_identity'
  | 'invalid_revision'
  | 'invalid_timestamp'
  | 'invalid_validation'
  | 'immutable_identity'
  | 'stale_revision'
  | 'invalid_transition'
  | 'not_assignable';

export class RoutineDraftError extends Error {
  constructor(readonly code: RoutineDraftErrorCode) {
    super(code);
    this.name = 'RoutineDraftError';
  }
}

const assertIdentity = (value: string) => {
  if (!value.trim()) throw new RoutineDraftError('invalid_identity');
};

const assertRevision = (revision: number) => {
  if (!Number.isSafeInteger(revision) || revision < 1) throw new RoutineDraftError('invalid_revision');
};

const assertTimestamp = (timestamp: string, earliest?: string) => {
  const time = Date.parse(timestamp);
  if (!Number.isFinite(time) || (earliest && time < Date.parse(earliest))) throw new RoutineDraftError('invalid_timestamp');
};

const assertValidation = (validation: RoutineDraftValidation) => {
  const validIssueCount = validation.status === 'valid' ? validation.issues.length === 0 : validation.issues.length > 0;
  if (!validIssueCount) throw new RoutineDraftError('invalid_validation');
};

const assertExpectedRevision = (draft: RoutineDraft, expectedRevision: number) => {
  assertRevision(expectedRevision);
  if (draft.revision !== expectedRevision) throw new RoutineDraftError('stale_revision');
};

const assertState = (draft: RoutineDraft, expected: RoutineDraft['state']) => {
  if (draft.state !== expected) throw new RoutineDraftError('invalid_transition');
};

const clonePackage = (routinePackage: RoutinePackageV1) => structuredClone(routinePackage);
const cloneValidation = (validation: RoutineDraftValidation) => structuredClone(validation);

export const createRoutineDraft = (input: {
  id: string;
  ownerId: string;
  package: RoutinePackageV1;
  validation: RoutineDraftValidation;
  createdAt: string;
}): RoutineDraft => {
  assertIdentity(input.id);
  assertIdentity(input.ownerId);
  assertValidation(input.validation);
  assertTimestamp(input.createdAt);
  return {
    id: input.id,
    ownerId: input.ownerId,
    revision: 1,
    state: 'active',
    package: clonePackage(input.package),
    validation: cloneValidation(input.validation),
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
};

export const updateRoutineDraft = (
  draft: RoutineDraft,
  input: {
    expectedRevision: number;
    package: RoutinePackageV1;
    validation: RoutineDraftValidation;
    updatedAt: string;
  },
): RoutineDraft => {
  assertExpectedRevision(draft, input.expectedRevision);
  assertState(draft, 'active');
  assertValidation(input.validation);
  assertTimestamp(input.updatedAt, draft.updatedAt);
  if (
    input.package.schemaVersion !== draft.package.schemaVersion
    || input.package.version !== draft.package.version
    || input.package.routine.id !== draft.package.routine.id
  ) throw new RoutineDraftError('immutable_identity');
  return {
    ...draft,
    revision: draft.revision + 1,
    package: clonePackage(input.package),
    validation: cloneValidation(input.validation),
    updatedAt: input.updatedAt,
  };
};

export const archiveRoutineDraft = (draft: RoutineDraft, expectedRevision: number, updatedAt: string): RoutineDraft => {
  assertExpectedRevision(draft, expectedRevision);
  assertState(draft, 'active');
  assertTimestamp(updatedAt, draft.updatedAt);
  return { ...draft, revision: draft.revision + 1, state: 'archived', updatedAt };
};

export const restoreRoutineDraft = (draft: RoutineDraft, expectedRevision: number, updatedAt: string): RoutineDraft => {
  assertExpectedRevision(draft, expectedRevision);
  assertState(draft, 'archived');
  assertTimestamp(updatedAt, draft.updatedAt);
  return { ...draft, revision: draft.revision + 1, state: 'active', updatedAt };
};

export const routineDraftIsComplete = (draft: RoutineDraft) => draft.validation.status !== 'incomplete';

export const routineDraftIsAssignable = (draft: RoutineDraft) =>
  draft.state === 'active' && draft.validation.status === 'valid';

export const routineDraftIsPublishable = routineDraftIsAssignable;

export type RoutineContentChange = 'identity' | 'instructions' | 'appearance' | 'proof' | 'analysis' | 'translations';

const sameContent = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export const routineContentChanges = (current: Routine, next: Routine): RoutineContentChange[] => {
  const groups: Array<[RoutineContentChange, unknown, unknown]> = [
    ['identity', [current.name, current.description, current.responsibleName], [next.name, next.description, next.responsibleName]],
    ['instructions', [current.instructions, current.instructionSteps], [next.instructions, next.instructionSteps]],
    ['appearance', [current.icon, current.accentColor, current.category], [next.icon, next.accentColor, next.category]],
    ['proof', [current.proofType, current.proofExample], [next.proofType, next.proofExample]],
    ['analysis', [current.recommendedValidationMode, current.analysis], [next.recommendedValidationMode, next.analysis]],
    ['translations', current.translations, next.translations],
  ];
  return groups.filter(([, before, after]) => !sameContent(before, after)).map(([change]) => change);
};

export const createRoutineDraftSnapshot = (draft: RoutineDraft): Routine => {
  if (!routineDraftIsAssignable(draft)) throw new RoutineDraftError('not_assignable');
  return structuredClone(draft.package.routine);
};
