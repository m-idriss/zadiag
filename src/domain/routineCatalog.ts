import { generatedRoutines } from '../generated/routineCatalog';
import type { Routine } from './models';

export const availableRoutines = structuredClone(generatedRoutines) as unknown as Routine[];

export const routineFromCatalog = (routineId: string) =>
  availableRoutines.find((routine) => routine.id === routineId);
