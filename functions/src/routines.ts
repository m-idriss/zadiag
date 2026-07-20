import { generatedRoutines } from './generated/routineCatalog.js';
import type { MonitoringPlan } from './planning.js';

export const DEFAULT_ROUTINE_ID = 'orthodontic-elastics';
const routineValidationModes = ['auto', 'ai'] as const;
type RoutineValidationMode = typeof routineValidationModes[number];

export const isRoutineValidationMode = (value: unknown): value is RoutineValidationMode =>
  routineValidationModes.includes(value as RoutineValidationMode);

export interface RoutineDocument {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  icon?: string;
  accentColor?: string;
  category?: string;
  proofType?: string;
  proofExample?: string;
  recommendedValidationMode?: RoutineValidationMode;
  responsibleName?: string;
  instructionSteps?: Array<{ id: string; icon: string; title: string; description: string }>;
  analysis?: {
    expectedEvidence: string;
    detectedCriteria: string;
    notDetectedCriteria: string;
    uncertaintyCriteria?: string;
  };
  translations?: Partial<Record<'en' | 'fr', {
    name?: string;
    description?: string;
    instructions?: string;
    proofExample?: string;
    instructionSteps?: Array<{ id: string; icon: string; title: string; description: string }>;
    analysis?: {
      expectedEvidence?: string;
      detectedCriteria?: string;
      notDetectedCriteria?: string;
      uncertaintyCriteria?: string;
    };
  }>>;
}

const availableRoutines = structuredClone(generatedRoutines) as unknown as RoutineDocument[];
const defaultRoutine = availableRoutines.find((routine) => routine.id === DEFAULT_ROUTINE_ID);
if (!defaultRoutine) throw new Error(`Missing default routine ${DEFAULT_ROUTINE_ID}`);

export interface RoutineAssignmentDocument {
  routineId: string;
  routine: RoutineDocument;
  plan: MonitoringPlan;
  status: 'active' | 'paused' | 'completed';
  assignedAt: string;
  createdBy?: 'parent' | 'child' | 'system';
  validationMode?: 'ai' | 'auto';
  sourceDraftId?: string;
  sourceRevision?: number;
  sourceVersion?: number;
  sourceCatalogEntryId?: string;
  contentUpdatedAt?: string;
}

export interface RoutineAssignmentVersionChangeDocument {
  from: { routine: RoutineDocument; sourceDraftId?: string; sourceRevision?: number; sourceVersion?: number };
  to: { sourceDraftId: string; sourceRevision: number; sourceVersion: number };
  appliedAt: string;
  appliedBy: string;
}

export const routineAssignmentProvenance = (assignment: RoutineAssignmentDocument) => ({
  ...(assignment.sourceDraftId ? { routineSourceDraftId: assignment.sourceDraftId } : {}),
  ...(assignment.sourceRevision ? { routineSourceRevision: assignment.sourceRevision } : {}),
  ...(assignment.sourceVersion ? { routineSourceVersion: assignment.sourceVersion } : {}),
});

export const createRoutineAssignmentVersionChange = (
  assignment: RoutineAssignmentDocument,
  target: { sourceDraftId: string; sourceRevision: number; sourceVersion: number },
  appliedBy: string,
  appliedAt = new Date().toISOString(),
): RoutineAssignmentVersionChangeDocument => ({
  from: {
    routine: structuredClone(assignment.routine),
    ...(assignment.sourceDraftId ? { sourceDraftId: assignment.sourceDraftId } : {}),
    ...(assignment.sourceRevision ? { sourceRevision: assignment.sourceRevision } : {}),
    ...(assignment.sourceVersion ? { sourceVersion: assignment.sourceVersion } : {}),
  },
  to: target,
  appliedAt,
  appliedBy,
});

export const routineFromCatalog = (routineId: string) =>
  availableRoutines.find((routine) => routine.id === routineId);

export const shouldCreateDefaultRoutineAssignment = (
  routineMigrationVersion: unknown,
  defaultAssignmentExists: boolean,
) => Number(routineMigrationVersion ?? 0) < 1 && !defaultAssignmentExists;

export const createDefaultRoutineAssignment = (
  plan: MonitoringPlan,
  assignedAt = new Date().toISOString(),
): RoutineAssignmentDocument => ({
  routineId: DEFAULT_ROUTINE_ID,
  routine: defaultRoutine,
  plan,
  status: 'active',
  assignedAt,
  createdBy: 'system',
  validationMode: 'ai',
});

export const createRoutineAssignment = (
  routine: RoutineDocument,
  plan: MonitoringPlan,
  assignedAt = new Date().toISOString(),
  createdBy: 'parent' | 'child' = 'parent',
): RoutineAssignmentDocument => ({
  routineId: routine.id,
  routine,
  plan,
  status: 'active',
  assignedAt,
  createdBy,
  validationMode: createdBy === 'child' ? 'auto' : 'ai',
});

export const createDraftRoutineAssignment = (
  routine: RoutineDocument,
  plan: MonitoringPlan,
  sourceDraftId: string,
  sourceRevision: number,
  assignedAt = new Date().toISOString(),
  sourceVersion = 1,
): RoutineAssignmentDocument => ({
  ...createRoutineAssignment(structuredClone(routine), plan, assignedAt, 'parent'),
  validationMode: routine.recommendedValidationMode ?? 'ai',
  sourceDraftId,
  sourceRevision,
  sourceVersion,
});

export const migrateCheckRoutineId = <T extends Record<string, unknown>>(check: T): T & { routineId: string } => ({
  ...check,
  routineId: typeof check.routineId === 'string' && check.routineId ? check.routineId : DEFAULT_ROUTINE_ID,
});
