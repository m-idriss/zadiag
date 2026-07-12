import { describe, expect, it } from 'vitest';
import { availableRoutines } from './routineCatalog';
import { builtinRoutineTranslations } from './routineTranslations';

describe('built-in routine translations', () => {
  it('has one centralized translation entry for every built-in routine', () => {
    expect(Object.keys(builtinRoutineTranslations).sort()).toEqual(
      availableRoutines.map((routine) => routine.id).sort(),
    );
  });

  it('attaches the central entry instead of duplicating localized content', () => {
    for (const routine of availableRoutines) {
      expect(routine.translations).toBe(builtinRoutineTranslations[routine.id]);
      expect(routine.translations?.fr?.name).toBeTruthy();
    }
  });
});
