const supportedLocales = ['en', 'fr'];
const requiredRoutineStrings = ['id', 'name', 'description', 'instructions', 'icon', 'accentColor', 'category', 'proofType', 'proofExample', 'recommendedValidationMode', 'responsibleName'];
const allowedRoutineFields = new Set([...requiredRoutineStrings, 'analysis', 'instructionSteps', 'translations']);
const localizedFields = ['name', 'description', 'instructions', 'proofExample'];
const analysisFields = ['expectedEvidence', 'detectedCriteria', 'notDetectedCriteria', 'uncertaintyCriteria'];
const stepFields = ['id', 'icon', 'title', 'description'];
const minimumLengths = Object.freeze({
  id: 1,
  name: 2,
  description: 10,
  instructions: 10,
  icon: 1,
  proofType: 1,
  proofExample: 10,
  responsibleName: 1,
});

export const ROUTINE_PACKAGE_SCHEMA_VERSION = 1;
export const routinePackageLimits = Object.freeze({
  packageBytes: 64 * 1024,
  locales: 2,
  steps: 4,
  id: 64,
  name: 120,
  description: 500,
  instructions: 2_000,
  icon: 32,
  proofType: 50,
  proofExample: 500,
  responsibleName: 120,
  analysis: 2_000,
  stepTitle: 120,
  stepDescription: 500,
});

const byteLength = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');
const ownKeysEqual = (actual, expected) => actual.length === expected.length && actual.every((value, index) => value === expected[index]);

export function validateRoutinePackage(file, routinePackage) {
  const fail = (message) => { throw new Error(`${file}: ${message}`); };
  const expectObject = (value, path) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${path} must be an object`);
  };
  const expectKeys = (value, allowed, path) => {
    Object.keys(value).forEach((field) => { if (!allowed.has(field)) fail(`${path} has unknown field ${field}`); });
  };
  const expectString = (value, path, { min = 1, max } = {}) => {
    if (typeof value !== 'string' || value.trim().length < min) fail(`${path} is required`);
    if (max && value.length > max) fail(`${path} exceeds ${max} characters`);
  };
  const validateAnalysis = (analysis, path) => {
    expectObject(analysis, path);
    expectKeys(analysis, new Set(analysisFields), path);
    analysisFields.forEach((field) => expectString(analysis[field], `${path}.${field}`, { min: 20, max: routinePackageLimits.analysis }));
  };
  const validateSteps = (steps, path, expectedIds) => {
    if (!Array.isArray(steps) || steps.length < 2 || steps.length > routinePackageLimits.steps) fail(`${path} must contain 2 to ${routinePackageLimits.steps} steps`);
    const ids = new Set();
    steps.forEach((step, index) => {
      const stepPath = `${path}[${index}]`;
      expectObject(step, stepPath);
      expectKeys(step, new Set(stepFields), stepPath);
      expectString(step.id, `${stepPath}.id`, { max: routinePackageLimits.id });
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(step.id)) fail(`${stepPath}.id must be kebab-case`);
      if (ids.has(step.id)) fail(`${path} has duplicate step ${step.id}`);
      ids.add(step.id);
      expectString(step.icon, `${stepPath}.icon`, { max: routinePackageLimits.icon });
      expectString(step.title, `${stepPath}.title`, { min: 2, max: routinePackageLimits.stepTitle });
      expectString(step.description, `${stepPath}.description`, { min: 10, max: routinePackageLimits.stepDescription });
    });
    const orderedIds = [...ids];
    if (expectedIds && !ownKeysEqual(orderedIds, expectedIds)) fail(`${path} step ids and order must match the default locale`);
    return orderedIds;
  };

  expectObject(routinePackage, 'package');
  expectKeys(routinePackage, new Set(['schemaVersion', 'version', 'defaultLocale', 'availableLocales', 'routine']), 'package');
  if (routinePackage.schemaVersion !== ROUTINE_PACKAGE_SCHEMA_VERSION) fail(`schemaVersion must be ${ROUTINE_PACKAGE_SCHEMA_VERSION}`);
  if (!Number.isSafeInteger(routinePackage.version) || routinePackage.version < 1) fail('version must be a positive integer');
  if (routinePackage.defaultLocale !== 'en') fail('defaultLocale must be en for schema version 1');
  if (!Array.isArray(routinePackage.availableLocales) || routinePackage.availableLocales.length < 1 || routinePackage.availableLocales.length > routinePackageLimits.locales) fail(`availableLocales must contain 1 to ${routinePackageLimits.locales} locales`);
  if (new Set(routinePackage.availableLocales).size !== routinePackage.availableLocales.length) fail('availableLocales must not contain duplicates');
  routinePackage.availableLocales.forEach((locale) => { if (!supportedLocales.includes(locale)) fail(`unsupported locale ${locale}`); });
  if (routinePackage.availableLocales[0] !== routinePackage.defaultLocale) fail('availableLocales must start with defaultLocale');

  const routine = routinePackage.routine;
  expectObject(routine, 'routine');
  expectKeys(routine, allowedRoutineFields, 'routine');
  requiredRoutineStrings.forEach((field) => expectString(routine[field], `routine.${field}`, { min: minimumLengths[field], max: routinePackageLimits[field] }));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(routine.id)) fail('routine.id must be kebab-case');
  if (!/^#[0-9a-fA-F]{6}$/.test(routine.accentColor)) fail('routine.accentColor must be a six-digit hex color');
  if (!['dental', 'wellness', 'medication', 'activity', 'custom'].includes(routine.category)) fail('routine.category is invalid');
  if (!['ai', 'auto'].includes(routine.recommendedValidationMode)) fail('routine.recommendedValidationMode is invalid');
  validateAnalysis(routine.analysis, 'routine.analysis');
  const stepIds = validateSteps(routine.instructionSteps, 'routine.instructionSteps');

  expectObject(routine.translations, 'routine.translations');
  expectKeys(routine.translations, new Set(supportedLocales.filter((locale) => locale !== routinePackage.defaultLocale)), 'routine.translations');
  const translationLocales = Object.keys(routine.translations).sort();
  const declaredLocales = routinePackage.availableLocales.filter((locale) => locale !== routinePackage.defaultLocale).sort();
  if (!ownKeysEqual(translationLocales, declaredLocales)) fail('availableLocales must exactly match the default locale and translations');
  translationLocales.forEach((locale) => {
    const localized = routine.translations[locale];
    const path = `routine.translations.${locale}`;
    expectObject(localized, path);
    expectKeys(localized, new Set([...localizedFields, 'analysis', 'instructionSteps']), path);
    localizedFields.forEach((field) => expectString(localized[field], `${path}.${field}`, { min: minimumLengths[field], max: routinePackageLimits[field] }));
    validateAnalysis(localized.analysis, `${path}.analysis`);
    validateSteps(localized.instructionSteps, `${path}.instructionSteps`, stepIds);
  });

  const size = byteLength(routinePackage);
  if (size > routinePackageLimits.packageBytes) fail(`package is ${size} bytes; limit is ${routinePackageLimits.packageBytes}`);
  return routine;
}
