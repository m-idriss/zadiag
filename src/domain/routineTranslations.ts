import { generatedRoutines } from '../generated/routineCatalog';
import type { Locale, RoutineLocalizedContent } from './models';

type BuiltinRoutineTranslations = Partial<Record<Locale, RoutineLocalizedContent>>;

export const builtinRoutineTranslations = Object.fromEntries(
  generatedRoutines.map((routine) => [routine.id, routine.translations ?? {}]),
) as unknown as Record<string, BuiltinRoutineTranslations>;

export const translationsForRoutine = (routineId: string) => builtinRoutineTranslations[routineId];
