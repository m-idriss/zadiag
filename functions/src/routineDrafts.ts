import { createHash } from 'node:crypto';
import { z } from 'zod';

const packageBytesLimit = 64 * 1024;
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const boundedString = (maximum: number) => z.string().max(maximum);
const analysisSchema = z.strictObject({
  expectedEvidence: boundedString(2_000).optional(),
  detectedCriteria: boundedString(2_000).optional(),
  notDetectedCriteria: boundedString(2_000).optional(),
  uncertaintyCriteria: boundedString(2_000).optional(),
}).optional();
const instructionStepSchema = z.strictObject({
  id: boundedString(64).refine((value) => !value || idPattern.test(value)),
  icon: boundedString(32),
  title: boundedString(120),
  description: boundedString(500),
});
const instructionStepsSchema = z.array(instructionStepSchema).max(4).optional();
const responsePrompt = boundedString(500);
const checklistItemSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(idPattern),
  label: z.string().min(1).max(200),
});
const routineResponseSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('photo') }),
  z.strictObject({
    kind: z.literal('confirmation'),
    prompt: responsePrompt,
    positiveLabel: boundedString(80).optional(),
    negativeLabel: boundedString(80).optional(),
  }),
  z.strictObject({
    kind: z.literal('checklist'),
    prompt: responsePrompt,
    items: z.array(checklistItemSchema).min(1).max(20),
  }),
  z.strictObject({
    kind: z.literal('quiz'),
    prompt: responsePrompt,
    topic: z.string().min(1).max(200),
    mode: z.enum(['fixed', 'generated']),
    questionCount: z.number().int().min(1).max(10),
    choiceCount: z.number().int().min(2).max(5),
  }),
]);
const localizedContentSchema = z.strictObject({
  name: boundedString(120).optional(),
  description: boundedString(500).optional(),
  instructions: boundedString(2_000).optional(),
  proofExample: boundedString(500).optional(),
  analysis: analysisSchema,
  instructionSteps: instructionStepsSchema,
});
const routineSchema = z.strictObject({
  id: z.string().min(1).max(64).regex(idPattern),
  name: boundedString(120).optional(),
  description: boundedString(500).optional(),
  instructions: boundedString(2_000).optional(),
  icon: boundedString(32).optional(),
  accentColor: z.string().max(7).regex(/^#[0-9a-fA-F]{6}$/).optional(),
  category: z.enum(['dental', 'wellness', 'medication', 'activity', 'custom']).optional(),
  response: routineResponseSchema.optional(),
  proofType: boundedString(50).optional(),
  proofExample: boundedString(500).optional(),
  recommendedValidationMode: z.enum(['ai', 'auto']).optional(),
  responsibleName: boundedString(120).optional(),
  analysis: analysisSchema,
  instructionSteps: instructionStepsSchema,
  translations: z.strictObject({ en: localizedContentSchema.optional(), fr: localizedContentSchema.optional() }).optional(),
});
const routinePackageSchema = z.strictObject({
  schemaVersion: z.literal(1),
  version: z.number().int().positive(),
  defaultLocale: z.enum(['en', 'fr']),
  availableLocales: z.union([z.tuple([z.literal('en')]), z.tuple([z.literal('fr')]), z.tuple([z.literal('en'), z.literal('fr')])]),
  routine: routineSchema,
});

export type RoutineDraftPackage = z.infer<typeof routinePackageSchema>;
export interface RoutineDraftValidationIssue {
  code: 'required_field' | 'invalid_package';
  path: string;
}
export interface RoutineDraftValidation {
  status: 'incomplete' | 'invalid' | 'valid';
  issues: RoutineDraftValidationIssue[];
}
export interface RoutineDraftDocument {
  ownerId: string;
  revision: number;
  state: 'active' | 'archived';
  package: RoutineDraftPackage;
  validation: RoutineDraftValidation;
  createdAt: string;
  updatedAt: string;
  forkedFrom?: { routineId: string; sourceVersion?: number; origin?: 'builtin' | 'private' | 'community' };
}

export interface PublishedRoutineVersionDocument {
  ownerId: string;
  authorName?: string;
  origin?: 'builtin' | 'private' | 'community';
  sourceDraftId: string;
  sourceRevision: number;
  version: number;
  package: RoutineDraftPackage;
  publishedAt: string;
  archivedAt?: string;
}

export class RoutineDraftInputError extends Error {}
export class RoutineDraftConflictError extends Error {}

export type IdentifiedRoutineDraft = RoutineDraftDocument & { id: string };

export const routineDraftSessionId = (ownerId: string, routineId: string) => createHash('sha256')
  .update(`${ownerId}:${routineId}`)
  .digest('hex');

export const selectReusableAssignmentDraft = (
  drafts: IdentifiedRoutineDraft[],
  ownerId: string,
  routineId: string,
  sourceVersion?: number,
) => drafts
  .filter((draft) => (
    draft.ownerId === ownerId
    && draft.state === 'active'
    && draft.forkedFrom?.routineId === routineId
    && (draft.forkedFrom?.sourceVersion ?? 0) === (sourceVersion ?? 0)
    && draft.package.version === (sourceVersion ?? 0) + 1
  ))
  .sort((left, right) => (
    right.updatedAt.localeCompare(left.updatedAt)
    || right.revision - left.revision
    || right.id.localeCompare(left.id)
  ))[0];

export const assertRoutineDraftRevision = (currentRevision: number, expectedRevision: number) => {
  if (currentRevision !== expectedRevision) throw new RoutineDraftConflictError('stale_revision');
};

const missing = (value: unknown, minimum = 1) => typeof value !== 'string' || value.trim().length < minimum;
const placeholders = (value: unknown) => typeof value === 'string' ? [...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map((match) => match[1]).sort() : [];

const completenessIssues = (routinePackage: RoutineDraftPackage): RoutineDraftValidationIssue[] => {
  const { routine } = routinePackage;
  const issues: RoutineDraftValidationIssue[] = [];
  const requireText = (value: unknown, path: string, minimum = 1) => {
    if (missing(value, minimum)) issues.push({ code: 'required_field', path });
  };
  requireText(routine.name, 'routine.name', 2);
  requireText(routine.description, 'routine.description', 10);
  requireText(routine.instructions, 'routine.instructions', 10);
  requireText(routine.icon, 'routine.icon');
  requireText(routine.proofType, 'routine.proofType');
  requireText(routine.proofExample, 'routine.proofExample', 10);
  requireText(routine.responsibleName, 'routine.responsibleName');
  if (routine.response?.kind === 'checklist') {
    const ids = routine.response.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) issues.push({ code: 'invalid_package', path: 'routine.response.items' });
  }
  ['expectedEvidence', 'detectedCriteria', 'notDetectedCriteria', 'uncertaintyCriteria'].forEach((field) => {
    requireText(routine.analysis?.[field as keyof NonNullable<typeof routine.analysis>], `routine.analysis.${field}`, 20);
  });
  if (!routine.instructionSteps || routine.instructionSteps.length < 2) {
    issues.push({ code: 'required_field', path: 'routine.instructionSteps' });
  }
  const stepIds = routine.instructionSteps?.map((step) => step.id) ?? [];
  routine.instructionSteps?.forEach((step, index) => {
    requireText(step.id, `routine.instructionSteps.${index}.id`);
    requireText(step.icon, `routine.instructionSteps.${index}.icon`);
    requireText(step.title, `routine.instructionSteps.${index}.title`, 2);
    requireText(step.description, `routine.instructionSteps.${index}.description`, 10);
  });
  if (new Set(stepIds).size !== stepIds.length) issues.push({ code: 'invalid_package', path: 'routine.instructionSteps' });

  const availableLocales: readonly string[] = routinePackage.availableLocales;
  if (!availableLocales.includes(routinePackage.defaultLocale)) issues.push({ code: 'invalid_package', path: 'defaultLocale' });
  (['en', 'fr'] as const).filter((locale) => locale !== routinePackage.defaultLocale).forEach((locale) => {
    const enabled = availableLocales.includes(locale);
    const localized = routine.translations?.[locale];
    if (enabled !== Boolean(localized)) issues.push({ code: 'invalid_package', path: 'availableLocales' });
    if (!localized) return;
    requireText(localized.name, `routine.translations.${locale}.name`, 2);
    requireText(localized.description, `routine.translations.${locale}.description`, 10);
    requireText(localized.instructions, `routine.translations.${locale}.instructions`, 10);
    requireText(localized.proofExample, `routine.translations.${locale}.proofExample`, 10);
    ([['name', routine.name], ['description', routine.description], ['instructions', routine.instructions], ['proofExample', routine.proofExample]] as const).forEach(([field, primary]) => {
      if (placeholders(localized[field]).join('|') !== placeholders(primary).join('|')) issues.push({ code: 'invalid_package', path: `routine.translations.${locale}.${field}` });
    });
    ['expectedEvidence', 'detectedCriteria', 'notDetectedCriteria', 'uncertaintyCriteria'].forEach((field) => {
      requireText(localized.analysis?.[field as keyof NonNullable<typeof localized.analysis>], `routine.translations.${locale}.analysis.${field}`, 20);
    });
    const translatedIds = localized.instructionSteps?.map((step) => step.id) ?? [];
    localized.instructionSteps?.forEach((step, index) => {
      requireText(step.id, `routine.translations.${locale}.instructionSteps.${index}.id`);
      requireText(step.icon, `routine.translations.${locale}.instructionSteps.${index}.icon`);
      requireText(step.title, `routine.translations.${locale}.instructionSteps.${index}.title`, 2);
      requireText(step.description, `routine.translations.${locale}.instructionSteps.${index}.description`, 10);
    });
    if (translatedIds.length !== stepIds.length || translatedIds.some((id, index) => id !== stepIds[index])) {
      issues.push({ code: 'invalid_package', path: `routine.translations.${locale}.instructionSteps` });
    }
  });
  return issues.slice(0, 50);
};

export const parseRoutineDraftPackage = (input: unknown): { package: RoutineDraftPackage; validation: RoutineDraftValidation } => {
  let bytes = 0;
  try {
    bytes = Buffer.byteLength(JSON.stringify(input), 'utf8');
  } catch {
    throw new RoutineDraftInputError('invalid_package');
  }
  if (bytes > packageBytesLimit) throw new RoutineDraftInputError('package_too_large');
  const parsed = routinePackageSchema.safeParse(input);
  if (!parsed.success) throw new RoutineDraftInputError('invalid_package');
  const issues = completenessIssues(parsed.data);
  const invalid = issues.some((issue) => issue.code === 'invalid_package');
  return {
    package: parsed.data,
    validation: {
      status: invalid ? 'invalid' : issues.length ? 'incomplete' : 'valid',
      issues,
    },
  };
};

export const createRoutineDraftDocument = (
  ownerId: string,
  input: unknown,
  now = new Date().toISOString(),
): RoutineDraftDocument => {
  const parsed = parseRoutineDraftPackage(input);
  return { ownerId, revision: 1, state: 'active', ...parsed, createdAt: now, updatedAt: now };
};

export const createAssignmentForkPackage = (
  routine: unknown,
  sourceVersion: number | undefined,
  preferredLocale: 'en' | 'fr',
): RoutineDraftPackage => {
  const clonedRoutine = structuredClone(routine) as { id?: unknown; translations?: { en?: unknown; fr?: unknown } };
  if (!clonedRoutine || typeof clonedRoutine !== 'object' || Array.isArray(clonedRoutine)) throw new RoutineDraftInputError('invalid_package');
  const hasEnglishTranslation = Boolean(clonedRoutine.translations?.en);
  const hasFrenchTranslation = Boolean(clonedRoutine.translations?.fr);
  const defaultLocale = hasFrenchTranslation && !hasEnglishTranslation
    ? 'en'
    : hasEnglishTranslation && !hasFrenchTranslation
      ? 'fr'
      : preferredLocale;
  const availableLocales = hasEnglishTranslation || hasFrenchTranslation
    ? ['en', 'fr'] as const
    : [defaultLocale] as ['en'] | ['fr'];
  return parseRoutineDraftPackage({ schemaVersion: 1, version: (sourceVersion ?? 0) + 1, defaultLocale, availableLocales, routine: clonedRoutine }).package;
};

export const updateRoutineDraftDocument = (
  current: RoutineDraftDocument,
  input: unknown,
  now = new Date().toISOString(),
): RoutineDraftDocument => {
  const parsed = parseRoutineDraftPackage(input);
  if (
    parsed.package.schemaVersion !== current.package.schemaVersion
    || parsed.package.version !== current.package.version
    || parsed.package.routine.id !== current.package.routine.id
  ) throw new RoutineDraftInputError('immutable_identity');
  return { ...current, revision: current.revision + 1, ...parsed, updatedAt: now };
};
