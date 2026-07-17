import type { CSSProperties } from 'react';
import { DEFAULT_ROUTINE_ID, defaultRoutine, type Locale, type Routine } from './models';

const safeAccent = (value?: string) => /^#[0-9a-f]{6}$/i.test(value ?? '') ? value! : '#0d927d';

const isOrthodonticRoutine = (routine: Routine) => {
  const values = [routine.id, routine.name, routine.description].join(' ').toLowerCase();
  return routine.id === DEFAULT_ROUTINE_ID
    || values.includes('orthodontic')
    || values.includes('elastique')
    || values.includes('élastique')
    || values.includes('elastic');
};

export const presentRoutine = (routine: Routine, locale: Locale) => {
  const source = isOrthodonticRoutine(routine) ? { ...defaultRoutine, ...routine, translations: { ...defaultRoutine.translations, ...routine.translations } } : routine;
  const localized = source.translations?.[locale];
  const text = (value: string | undefined, primary: string | undefined, safe = '') => value?.trim() || primary?.trim() || safe;
  const candidateSteps = localized?.instructionSteps;
  const localizedSteps = candidateSteps && candidateSteps.length === source.instructionSteps?.length && candidateSteps.every((step, index) => step.id === source.instructionSteps?.[index]?.id && step.title.trim() && step.description.trim()) ? candidateSteps : undefined;
  const accent = safeAccent(source.accentColor);
  return {
    name: text(localized?.name, source.name, 'Routine'),
    description: text(localized?.description, source.description),
    instructions: text(localized?.instructions, source.instructions, source.description),
    instructionSteps: localizedSteps ?? source.instructionSteps ?? [],
    icon: source.icon ?? '✦',
    accent,
    category: source.category ?? 'custom',
    proofType: source.proofType ?? 'Photo',
    proofExample: text(localized?.proofExample, source.proofExample, localized?.analysis?.expectedEvidence ?? source.analysis?.expectedEvidence ?? source.description),
    recommendedValidationMode: source.recommendedValidationMode ?? 'ai',
    responsibleName: source.responsibleName ?? 'Care team',
    style: { '--routine-accent': accent } as CSSProperties,
  };
};
