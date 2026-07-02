import type { MonitoringPlan } from './planning.js';

export const DEFAULT_ROUTINE_ID = 'orthodontic-elastics';

export const defaultRoutine = {
  id: DEFAULT_ROUTINE_ID,
  name: 'Orthodontic Elastics',
  description: 'Daily orthodontic elastic wear checks.',
};

export interface RoutineAssignmentDocument {
  routineId: string;
  routine: typeof defaultRoutine;
  plan: MonitoringPlan;
  status: 'active' | 'paused' | 'completed';
  assignedAt: string;
}

export const createDefaultRoutineAssignment = (
  plan: MonitoringPlan,
  assignedAt = new Date().toISOString(),
): RoutineAssignmentDocument => ({
  routineId: DEFAULT_ROUTINE_ID,
  routine: defaultRoutine,
  plan,
  status: 'active',
  assignedAt,
});

export const migrateCheckRoutineId = <T extends Record<string, unknown>>(check: T): T & { routineId: string } => ({
  ...check,
  routineId: typeof check.routineId === 'string' && check.routineId ? check.routineId : DEFAULT_ROUTINE_ID,
});
