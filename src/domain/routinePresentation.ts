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
  const accent = safeAccent(source.accentColor);
  return {
    name: localized?.name ?? source.name,
    description: localized?.description ?? source.description,
    instructions: localized?.instructions ?? source.instructions ?? source.description,
    instructionSteps: localized?.instructionSteps ?? source.instructionSteps ?? [],
    icon: source.icon ?? '✦',
    accent,
    proofType: source.proofType ?? 'Photo',
    responsibleName: source.responsibleName ?? 'Care team',
    style: { '--routine-accent': accent } as CSSProperties,
  };
};
