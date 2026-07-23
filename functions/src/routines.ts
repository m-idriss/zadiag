import { generatedRoutines } from './generated/routineCatalog.js';
import type { MonitoringPlan } from './planning.js';

export const DEFAULT_ROUTINE_ID = 'orthodontic-elastics';
const routineValidationModes = ['auto', 'ai'] as const;
type RoutineValidationMode = typeof routineValidationModes[number];

export interface RoutineChecklistItem {
  id: string;
  label: string;
}

export interface RoutinePhotoChecklistCriterion {
  id: string;
  label: string;
  criterion: string;
  required: boolean;
}

export type RoutineResponseDefinition =
  | { kind: 'photo' }
  | { kind: 'confirmation'; prompt: string; positiveLabel?: string; negativeLabel?: string }
  | { kind: 'checklist'; prompt: string; items: RoutineChecklistItem[] }
  | { kind: 'photo_checklist'; prompt: string; criteria: RoutinePhotoChecklistCriterion[] }
  | { kind: 'quiz'; prompt: string; topic: string; mode: 'fixed' | 'generated'; questionCount: number; choiceCount: number };

export type PhotoChecklistItemStatus = 'detected' | 'not_detected' | 'uncertain';
export type PhotoChecklistDecision =
  | { source: 'ai' }
  | { source: 'fallback' }
  | { source: 'responsible'; actorUid: string; decidedAt: string };
export interface PhotoChecklistItemResult {
  criterionId: string;
  status: PhotoChecklistItemStatus;
  confidence: number;
  reason: string;
  decision: PhotoChecklistDecision;
}

export interface PhotoChecklistReviewDecision {
  criterionId: string;
  status: Exclude<PhotoChecklistItemStatus, 'uncertain'>;
  reason: string;
}

export const derivePhotoChecklistStatus = (
  criteria: RoutinePhotoChecklistCriterion[],
  results: Array<Pick<PhotoChecklistItemResult, 'criterionId' | 'status'>>,
): PhotoChecklistItemStatus => {
  const expectedIds = criteria.map((criterion) => criterion.id);
  const resultIds = results.map((result) => result.criterionId);
  if (criteria.length < 2 || criteria.length > 6
    || new Set(expectedIds).size !== expectedIds.length
    || results.length !== criteria.length
    || new Set(resultIds).size !== resultIds.length
    || resultIds.some((id) => !expectedIds.includes(id))) {
    throw new RoutineResponseInputError('invalid_photo_checklist_results');
  }
  const resultById = new Map(results.map((result) => [result.criterionId, result.status]));
  if (criteria.some((criterion) => criterion.required && resultById.get(criterion.id) === 'not_detected')) return 'not_detected';
  if (criteria.some((criterion) => criterion.required && resultById.get(criterion.id) === 'uncertain')) return 'uncertain';
  return 'detected';
};

export const applyPhotoChecklistReview = (
  criteria: RoutinePhotoChecklistCriterion[],
  results: PhotoChecklistItemResult[],
  decisions: PhotoChecklistReviewDecision[],
  reviewer: { actorUid: string; decidedAt: string },
) => {
  derivePhotoChecklistStatus(criteria, results);
  if (decisions.length < 1 || decisions.length > criteria.length
    || new Set(decisions.map((decision) => decision.criterionId)).size !== decisions.length) {
    throw new RoutineResponseInputError('invalid_photo_checklist_review');
  }
  const decisionById = new Map(decisions.map((decision) => {
    const reason = decision.reason.trim();
    if (!criteria.some((criterion) => criterion.id === decision.criterionId)
      || !['detected', 'not_detected'].includes(decision.status)
      || reason.length < 1 || reason.length > 220) {
      throw new RoutineResponseInputError('invalid_photo_checklist_review');
    }
    return [decision.criterionId, { ...decision, reason }] as const;
  }));
  let changed = false;
  const items = results.map((result) => {
    const decision = decisionById.get(result.criterionId);
    if (!decision) return result;
    if (result.status !== 'uncertain') {
      if (result.decision.source === 'responsible'
        && result.status === decision.status
        && result.reason === decision.reason) return result;
      throw new RoutineResponseInputError('photo_checklist_item_already_resolved');
    }
    changed = true;
    return {
      criterionId: result.criterionId,
      status: decision.status,
      confidence: 1,
      reason: decision.reason,
      decision: {
        source: 'responsible' as const,
        actorUid: reviewer.actorUid,
        decidedAt: reviewer.decidedAt,
      },
    };
  });
  const complete = items.every((item) => item.status !== 'uncertain');
  return {
    items,
    status: complete ? derivePhotoChecklistStatus(criteria, items) : 'uncertain' as const,
    complete,
    changed,
  };
};

export interface RoutineChallengeSnapshot {
  routineId: string;
  routineRevision?: number;
  routineVersion?: number;
  name: string;
  instructions: string;
  response: RoutineResponseDefinition;
}

export type RoutineResponseSubmission =
  | { kind: 'confirmation'; value: boolean }
  | { kind: 'checklist'; items: Array<{ id: string; value: boolean }> };

export class RoutineResponseInputError extends Error {}

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
  response?: RoutineResponseDefinition;
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
    photoChecklist?: {
      prompt: string;
      criteria: Array<{ id: string; label: string }>;
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

// Legacy Routine Package V1 documents predate typed responses and always used
// the photo capture runtime. Keep that behavior explicit at one migration edge.
export const responseForRoutine = (routine: Pick<RoutineDocument, 'response'>): RoutineResponseDefinition =>
  routine.response ?? { kind: 'photo' };

export const challengeForAssignment = (assignment: RoutineAssignmentDocument): RoutineChallengeSnapshot => ({
  routineId: assignment.routineId,
  ...(assignment.sourceRevision ? { routineRevision: assignment.sourceRevision } : {}),
  ...(assignment.sourceVersion ? { routineVersion: assignment.sourceVersion } : {}),
  name: assignment.routine.name,
  instructions: assignment.routine.instructions ?? assignment.routine.description,
  response: structuredClone(responseForRoutine(assignment.routine)),
});

export const parseRoutineResponseSubmission = (definition: RoutineResponseDefinition, input: unknown): RoutineResponseSubmission => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RoutineResponseInputError('invalid_response');
  const candidate = input as Record<string, unknown>;
  if (definition.kind === 'confirmation') {
    if (candidate.kind !== 'confirmation' || typeof candidate.value !== 'boolean' || Object.keys(candidate).some((key) => !['kind', 'value'].includes(key))) {
      throw new RoutineResponseInputError('invalid_confirmation');
    }
    return { kind: 'confirmation', value: candidate.value };
  }
  if (definition.kind === 'checklist') {
    if (candidate.kind !== 'checklist' || !Array.isArray(candidate.items) || Object.keys(candidate).some((key) => !['kind', 'items'].includes(key))) {
      throw new RoutineResponseInputError('invalid_checklist');
    }
    const items = candidate.items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new RoutineResponseInputError('invalid_checklist');
      const entry = item as Record<string, unknown>;
      if (typeof entry.id !== 'string' || typeof entry.value !== 'boolean' || Object.keys(entry).some((key) => !['id', 'value'].includes(key))) {
        throw new RoutineResponseInputError('invalid_checklist');
      }
      return { id: entry.id, value: entry.value };
    });
    const expectedIds = definition.items.map((item) => item.id).sort();
    const actualIds = items.map((item) => item.id).sort();
    if (actualIds.length !== expectedIds.length || actualIds.some((id, index) => id !== expectedIds[index]) || new Set(actualIds).size !== actualIds.length) {
      throw new RoutineResponseInputError('incomplete_checklist');
    }
    return { kind: 'checklist', items };
  }
  throw new RoutineResponseInputError('unsupported_response');
};

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
