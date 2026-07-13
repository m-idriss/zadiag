import type { MonitoringPlan, RoutineValidationMode } from '../domain/models';

export const routineUpdatePayload = (
  familyId: string,
  routineId: string,
  plan: MonitoringPlan,
  validationMode?: RoutineValidationMode,
) => ({
  familyId,
  routineId,
  plan,
  ...(validationMode ? { validationMode } : {}),
});
