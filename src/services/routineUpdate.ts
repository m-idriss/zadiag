import type { MonitoringPlan, RoutineAppearance, RoutineValidationMode } from '../domain/models';

export const routineUpdatePayload = (
  familyId: string,
  routineId: string,
  plan: MonitoringPlan,
  validationMode?: RoutineValidationMode,
  appearance?: RoutineAppearance,
) => ({
  familyId,
  routineId,
  plan,
  ...(validationMode ? { validationMode } : {}),
  ...(appearance ? { appearance } : {}),
});
