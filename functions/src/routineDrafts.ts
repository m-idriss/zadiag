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
  proofType: boundedString(50).optional(),
  proofExample: boundedString(500).optional(),
  recommendedValidationMode: z.enum(['ai', 'auto']).optional(),
  responsibleName: boundedString(120).optional(),
  analysis: analysisSchema,
  instructionSteps: instructionStepsSchema,
  translations: z.strictObject({ fr: localizedContentSchema.optional() }).optional(),
});
const routinePackageSchema = z.strictObject({
  schemaVersion: z.literal(1),
  version: z.number().int().positive(),
  defaultLocale: z.literal('en'),
  availableLocales: z.union([z.tuple([z.literal('en')]), z.tuple([z.literal('en'), z.literal('fr')])]),
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
}

export class RoutineDraftInputError extends Error {}
export class RoutineDraftConflictError extends Error {}

export const assertRoutineDraftRevision = (currentRevision: number, expectedRevision: number) => {
  if (currentRevision !== expectedRevision) throw new RoutineDraftConflictError('stale_revision');
};

const missing = (value: unknown, minimum = 1) => typeof value !== 'string' || value.trim().length < minimum;

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

  const hasFrench = routinePackage.availableLocales.length === 2;
  if (hasFrench !== Boolean(routine.translations?.fr)) issues.push({ code: 'invalid_package', path: 'availableLocales' });
  if (routine.translations?.fr) {
    const localized = routine.translations.fr;
    requireText(localized.name, 'routine.translations.fr.name', 2);
    requireText(localized.description, 'routine.translations.fr.description', 10);
    requireText(localized.instructions, 'routine.translations.fr.instructions', 10);
    requireText(localized.proofExample, 'routine.translations.fr.proofExample', 10);
    ['expectedEvidence', 'detectedCriteria', 'notDetectedCriteria', 'uncertaintyCriteria'].forEach((field) => {
      requireText(localized.analysis?.[field as keyof NonNullable<typeof localized.analysis>], `routine.translations.fr.analysis.${field}`, 20);
    });
    const translatedIds = localized.instructionSteps?.map((step) => step.id) ?? [];
    localized.instructionSteps?.forEach((step, index) => {
      requireText(step.id, `routine.translations.fr.instructionSteps.${index}.id`);
      requireText(step.icon, `routine.translations.fr.instructionSteps.${index}.icon`);
      requireText(step.title, `routine.translations.fr.instructionSteps.${index}.title`, 2);
      requireText(step.description, `routine.translations.fr.instructionSteps.${index}.description`, 10);
    });
    if (translatedIds.length !== stepIds.length || translatedIds.some((id, index) => id !== stepIds[index])) {
      issues.push({ code: 'invalid_package', path: 'routine.translations.fr.instructionSteps' });
    }
  }
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
