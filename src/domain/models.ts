import { generatedRoutines } from '../generated/routineCatalog';

export type Role = 'parent' | 'child';
export type Locale = 'en' | 'fr';
export interface PilotParticipation {
  version: string;
  status: 'accepted' | 'declined' | 'withdrawn';
  role: Role;
  recordedAt: string;
}
export type VerificationStatus =
  | 'pending'
  | 'analyzing'
  | 'detected'
  | 'answered'
  | 'not_detected'
  | 'uncertain'
  | 'missed'
  | 'expired';

export interface ResponsibleAction {
  type: 'requested' | 'reminded' | 'approved' | 'rejected';
  at: string;
  actorUid: string;
  actorName: string;
}

export interface TimeWindow {
  id: string;
  start: string;
  end: string;
}

export interface ScheduleGroup {
  id: string;
  label?: string;
  weekdays: number[];
  windows: TimeWindow[];
}

export interface MonitoringPlan {
  checksPerDay: number;
  weekdays: number[];
  windows: TimeWindow[];
  scheduleGroups?: ScheduleGroup[];
  expiryMinutes: number;
  timeZone: string;
}

type RoutineStatus = 'active' | 'paused' | 'completed';
export type RoutineAssignmentCreator = 'parent' | 'child' | 'system';
export type RoutineValidationMode = 'ai' | 'auto';
export type RoutineCategory = 'dental' | 'wellness' | 'medication' | 'activity' | 'custom';

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
  | {
    kind: 'quiz';
    prompt: string;
    topic: string;
    mode: 'fixed' | 'generated';
    questionCount: number;
    choiceCount: number;
  };

interface RoutineInstructionStep {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface RoutineLocalizedContent {
  name?: string;
  description?: string;
  instructions?: string;
  proofExample?: string;
  instructionSteps?: RoutineInstructionStep[];
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
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  icon?: string;
  accentColor?: string;
  category?: RoutineCategory;
  response?: RoutineResponseDefinition;
  proofType?: string;
  proofExample?: string;
  recommendedValidationMode?: RoutineValidationMode;
  responsibleName?: string;
  instructionSteps?: RoutineInstructionStep[];
  analysis?: {
    expectedEvidence: string;
    detectedCriteria: string;
    notDetectedCriteria: string;
    uncertaintyCriteria?: string;
  };
  translations?: Partial<Record<Locale, RoutineLocalizedContent>>;
}

type RoutineTemplateVisibility = 'builtin' | 'private' | 'unlisted' | 'public';

export interface RoutineTemplate {
  id: string;
  routine: Routine;
  visibility: RoutineTemplateVisibility;
  ownerFamilyId?: string;
  sourceTemplateId?: string;
  shareCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoutineAssignment {
  id: string;
  routineId: string;
  routine: Routine;
  plan: MonitoringPlan;
  status: RoutineStatus;
  assignedAt: string;
  createdBy?: RoutineAssignmentCreator;
  validationMode?: RoutineValidationMode;
  sourceDraftId?: string;
  sourceRevision?: number;
  sourceVersion?: number;
  sourceCatalogEntryId?: string;
  contentUpdatedAt?: string;
}

export interface RoutineAppearance {
  name: string;
  icon: string;
  accentColor: string;
}

export interface RoutineChallengeSnapshot {
  routineId: string;
  routineRevision?: number;
  routineVersion?: number;
  name: string;
  instructions: string;
  response: RoutineResponseDefinition;
  quiz?: {
    questions: Array<{ id: string; prompt: string; concept: string; choices: Array<{ id: string; label: string }> }>;
    generatedAt: string;
    provider: string;
    model: string;
    promptVersion: string;
  };
}

export type RoutineResponseSubmission =
  | { kind: 'confirmation'; value: boolean }
  | { kind: 'checklist'; items: Array<{ id: string; value: boolean }> }
  | { kind: 'quiz'; answers: Array<{ questionId: string; choiceId: string }> };

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

export type ReviewCheckDecision =
  | 'detected'
  | 'not_detected'
  | {
      itemDecisions: Array<{
        criterionId: string;
        status: 'detected' | 'not_detected';
        reason: string;
      }>;
    };

export interface RoutineQuizResult {
  score: number;
  correctCount: number;
  totalCount: number;
  concepts: string[];
  corrections: Array<{ questionId: string; selectedChoiceId: string; correctChoiceId: string; correct: boolean; explanation: string }>;
  provider: string;
  model: string;
  promptVersion: string;
}

interface RoutineTask {
  id: string;
  routineId: string;
  requestedAt: string;
  expiresAt: string;
  status: VerificationStatus;
}

export interface VerificationEvent extends RoutineTask {
  sessionId: string;
  routineSourceDraftId?: string;
  routineSourceRevision?: number;
  routineSourceVersion?: number;
  capturedAt?: string;
  submittedAt?: string;
  challenge?: RoutineChallengeSnapshot;
  submission?: RoutineResponseSubmission;
  quizResult?: RoutineQuizResult;
  photoChecklistItems?: PhotoChecklistItemResult[];
  analysisSource?: 'ai' | 'fallback' | 'self';
  analysisProvider?: string;
  analysisModel?: string;
  analysisPromptVersion?: string;
  automatedStatus?: Extract<VerificationStatus, 'detected' | 'not_detected' | 'uncertain'>;
  confidence?: number;
  imageQuality?: number;
  reason?: string;
  proofImagePath?: string;
  proofImageExpiresAt?: string;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  reviewedAt?: string;
  reviewedBy?: string;
  reviewReason?: string;
  responsibleActions?: ResponsibleAction[];
}

const legacyPhotoResponse: RoutineResponseDefinition = { kind: 'photo' };

const nonEmptyString = (value: unknown, maximum: number) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
const exactKeys = (candidate: Record<string, unknown>, expected: string[]) =>
  Object.keys(candidate).every((key) => expected.includes(key));

export const parseRoutineResponse = (value: unknown): RoutineResponseDefinition | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'photo') return { kind: 'photo' };
  if (candidate.kind === 'confirmation' && nonEmptyString(candidate.prompt, 500)) {
    return {
      kind: 'confirmation',
      prompt: String(candidate.prompt),
      ...(nonEmptyString(candidate.positiveLabel, 80) ? { positiveLabel: String(candidate.positiveLabel) } : {}),
      ...(nonEmptyString(candidate.negativeLabel, 80) ? { negativeLabel: String(candidate.negativeLabel) } : {}),
    };
  }
  if (candidate.kind === 'checklist' && nonEmptyString(candidate.prompt, 500) && Array.isArray(candidate.items)) {
    const items = candidate.items.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const entry = item as Record<string, unknown>;
      return nonEmptyString(entry.id, 64) && nonEmptyString(entry.label, 200)
        ? [{ id: String(entry.id), label: String(entry.label) }]
        : [];
    });
    if (items.length === candidate.items.length && items.length >= 1 && items.length <= 20 && new Set(items.map((item) => item.id)).size === items.length) {
      return { kind: 'checklist', prompt: String(candidate.prompt), items };
    }
  }
  if (candidate.kind === 'photo_checklist' && nonEmptyString(candidate.prompt, 500) && Array.isArray(candidate.criteria)
    && exactKeys(candidate, ['kind', 'prompt', 'criteria'])) {
    const criteria = candidate.criteria.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const entry = item as Record<string, unknown>;
      return exactKeys(entry, ['id', 'label', 'criterion', 'required'])
        && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(entry.id))
        && nonEmptyString(entry.id, 64)
        && nonEmptyString(entry.label, 200)
        && nonEmptyString(entry.criterion, 500)
        && typeof entry.required === 'boolean'
        ? [{ id: String(entry.id), label: String(entry.label), criterion: String(entry.criterion), required: entry.required }]
        : [];
    });
    if (criteria.length === candidate.criteria.length && criteria.length >= 2 && criteria.length <= 6
      && new Set(criteria.map((criterion) => criterion.id)).size === criteria.length) {
      return { kind: 'photo_checklist', prompt: String(candidate.prompt), criteria };
    }
  }
  if (
    candidate.kind === 'quiz'
    && nonEmptyString(candidate.prompt, 500)
    && nonEmptyString(candidate.topic, 200)
    && ['fixed', 'generated'].includes(String(candidate.mode))
    && Number.isSafeInteger(candidate.questionCount)
    && Number(candidate.questionCount) >= 1
    && Number(candidate.questionCount) <= 10
    && Number.isSafeInteger(candidate.choiceCount)
    && Number(candidate.choiceCount) >= 2
    && Number(candidate.choiceCount) <= 5
  ) {
    return {
      kind: 'quiz',
      prompt: String(candidate.prompt),
      topic: String(candidate.topic),
      mode: candidate.mode as 'fixed' | 'generated',
      questionCount: Number(candidate.questionCount),
      choiceCount: Number(candidate.choiceCount),
    };
  }
  return undefined;
};

export const parsePhotoChecklistItemResults = (value: unknown): PhotoChecklistItemResult[] | undefined => {
  if (!Array.isArray(value) || value.length < 2 || value.length > 6) return undefined;
  const items = value.flatMap<PhotoChecklistItemResult>((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const entry = item as Record<string, unknown>;
    if (!exactKeys(entry, ['criterionId', 'status', 'confidence', 'reason', 'decision'])
      || !nonEmptyString(entry.criterionId, 64)
      || !['detected', 'not_detected', 'uncertain'].includes(String(entry.status))
      || !Number.isFinite(entry.confidence) || Number(entry.confidence) < 0 || Number(entry.confidence) > 1
      || !nonEmptyString(entry.reason, 500)
      || !entry.decision || typeof entry.decision !== 'object' || Array.isArray(entry.decision)) return [];
    const decision = entry.decision as Record<string, unknown>;
    if (decision.source === 'ai' && exactKeys(decision, ['source'])) {
      return [{ criterionId: String(entry.criterionId), status: entry.status as PhotoChecklistItemStatus, confidence: Number(entry.confidence), reason: String(entry.reason), decision: { source: 'ai' as const } }];
    }
    if (decision.source === 'fallback' && exactKeys(decision, ['source'])) {
      return [{ criterionId: String(entry.criterionId), status: entry.status as PhotoChecklistItemStatus, confidence: Number(entry.confidence), reason: String(entry.reason), decision: { source: 'fallback' as const } }];
    }
    if (decision.source === 'responsible' && exactKeys(decision, ['source', 'actorUid', 'decidedAt'])
      && nonEmptyString(decision.actorUid, 128) && nonEmptyString(decision.decidedAt, 40)
      && Number.isFinite(Date.parse(String(decision.decidedAt)))) {
      return [{ criterionId: String(entry.criterionId), status: entry.status as PhotoChecklistItemStatus, confidence: Number(entry.confidence), reason: String(entry.reason), decision: { source: 'responsible' as const, actorUid: String(decision.actorUid), decidedAt: String(decision.decidedAt) } }];
    }
    return [];
  });
  return items.length === value.length && new Set(items.map((item) => item.criterionId)).size === items.length ? items : undefined;
};

export const parseRoutineChallenge = (value: unknown): RoutineChallengeSnapshot | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  const response = parseRoutineResponse(candidate.response);
  if (!response || !nonEmptyString(candidate.routineId, 64) || !nonEmptyString(candidate.name, 120) || !nonEmptyString(candidate.instructions, 2_000)) return undefined;
  const quizCandidate = candidate.quiz && typeof candidate.quiz === 'object' && !Array.isArray(candidate.quiz) ? candidate.quiz as Record<string, unknown> : undefined;
  const questions = Array.isArray(quizCandidate?.questions) ? quizCandidate.questions.flatMap((question) => {
    if (!question || typeof question !== 'object' || Array.isArray(question)) return [];
    const entry = question as Record<string, unknown>;
    if (!nonEmptyString(entry.id, 64) || !nonEmptyString(entry.prompt, 500) || !nonEmptyString(entry.concept, 100) || !Array.isArray(entry.choices)) return [];
    const choices = entry.choices.flatMap((choice) => {
      if (!choice || typeof choice !== 'object' || Array.isArray(choice)) return [];
      const option = choice as Record<string, unknown>;
      return nonEmptyString(option.id, 64) && nonEmptyString(option.label, 200) ? [{ id: String(option.id), label: String(option.label) }] : [];
    });
    return choices.length === entry.choices.length && choices.length >= 2 ? [{ id: String(entry.id), prompt: String(entry.prompt), concept: String(entry.concept), choices }] : [];
  }) : [];
  const quiz = quizCandidate && Array.isArray(quizCandidate.questions) && questions.length === quizCandidate.questions.length
    && nonEmptyString(quizCandidate.generatedAt, 40) && nonEmptyString(quizCandidate.provider, 40)
    && nonEmptyString(quizCandidate.model, 100) && nonEmptyString(quizCandidate.promptVersion, 100)
    ? { questions, generatedAt: String(quizCandidate.generatedAt), provider: String(quizCandidate.provider), model: String(quizCandidate.model), promptVersion: String(quizCandidate.promptVersion) }
    : undefined;
  return {
    routineId: String(candidate.routineId),
    ...(Number.isSafeInteger(candidate.routineRevision) && Number(candidate.routineRevision) > 0 ? { routineRevision: Number(candidate.routineRevision) } : {}),
    ...(Number.isSafeInteger(candidate.routineVersion) && Number(candidate.routineVersion) > 0 ? { routineVersion: Number(candidate.routineVersion) } : {}),
    name: String(candidate.name),
    instructions: String(candidate.instructions),
    response,
    ...(quiz ? { quiz } : {}),
  };
};

export const parseRoutineSubmission = (value: unknown): RoutineResponseSubmission | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'confirmation' && typeof candidate.value === 'boolean') {
    return { kind: 'confirmation', value: candidate.value };
  }
  if (candidate.kind === 'checklist' && Array.isArray(candidate.items)) {
    const items = candidate.items.flatMap((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
      const entry = item as Record<string, unknown>;
      return nonEmptyString(entry.id, 64) && typeof entry.value === 'boolean'
        ? [{ id: String(entry.id), value: entry.value }]
        : [];
    });
    if (items.length === candidate.items.length && items.length >= 1 && items.length <= 20 && new Set(items.map((item) => item.id)).size === items.length) {
      return { kind: 'checklist', items };
    }
  }
  if (candidate.kind === 'quiz' && Array.isArray(candidate.answers)) {
    const answers = candidate.answers.flatMap((answer) => {
      if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return [];
      const entry = answer as Record<string, unknown>;
      return nonEmptyString(entry.questionId, 64) && nonEmptyString(entry.choiceId, 64)
        ? [{ questionId: String(entry.questionId), choiceId: String(entry.choiceId) }]
        : [];
    });
    if (answers.length === candidate.answers.length && answers.length >= 1 && answers.length <= 10 && new Set(answers.map((answer) => answer.questionId)).size === answers.length) return { kind: 'quiz', answers };
  }
  return undefined;
};

export const parseRoutineQuizResult = (value: unknown): RoutineQuizResult | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const candidate = value as Record<string, unknown>;
  if (!Number.isFinite(candidate.score) || Number(candidate.score) < 0 || Number(candidate.score) > 1
    || !Number.isSafeInteger(candidate.correctCount) || !Number.isSafeInteger(candidate.totalCount)
    || Number(candidate.totalCount) < 1 || Number(candidate.totalCount) > 10 || Number(candidate.correctCount) < 0 || Number(candidate.correctCount) > Number(candidate.totalCount)
    || !Array.isArray(candidate.concepts) || !Array.isArray(candidate.corrections)
    || !nonEmptyString(candidate.provider, 40) || !nonEmptyString(candidate.model, 100) || !nonEmptyString(candidate.promptVersion, 100)) return undefined;
  const concepts = candidate.concepts.filter((concept): concept is string => nonEmptyString(concept, 100));
  const corrections = candidate.corrections.flatMap((correction) => {
    if (!correction || typeof correction !== 'object' || Array.isArray(correction)) return [];
    const entry = correction as Record<string, unknown>;
    return nonEmptyString(entry.questionId, 64) && nonEmptyString(entry.selectedChoiceId, 64) && nonEmptyString(entry.correctChoiceId, 64)
      && typeof entry.correct === 'boolean' && nonEmptyString(entry.explanation, 500)
      ? [{ questionId: String(entry.questionId), selectedChoiceId: String(entry.selectedChoiceId), correctChoiceId: String(entry.correctChoiceId), correct: entry.correct, explanation: String(entry.explanation) }]
      : [];
  });
  if (concepts.length !== candidate.concepts.length || concepts.length > 10 || corrections.length !== candidate.corrections.length || corrections.length !== Number(candidate.totalCount)
    || new Set(corrections.map((correction) => correction.questionId)).size !== corrections.length
    || Math.abs(Number(candidate.score) - Number(candidate.correctCount) / Number(candidate.totalCount)) > 0.000_001) return undefined;
  return {
    score: Number(candidate.score), correctCount: Number(candidate.correctCount), totalCount: Number(candidate.totalCount), concepts, corrections,
    provider: String(candidate.provider), model: String(candidate.model), promptVersion: String(candidate.promptVersion),
  };
};

// Routine Package V1 originally stored only the presentational proofType string.
// Persisted packages without response remain photo routines until they are saved
// through the composer; this boundary can be removed after every active
// assignment and importable package carries a typed response definition.
export const responseForRoutine = (routine: Pick<Routine, 'response'>): RoutineResponseDefinition =>
  routine.response ?? legacyPhotoResponse;

interface FamilyState {
  id?: string;
  linked: boolean;
  childLinked: boolean;
  childName: string;
  linkingCode: string;
  parentRecoveryCode: string;
  consented: boolean;
}

export type MembershipRole = 'owner' | 'caregiver' | 'participant' | 'viewer';
type MembershipStatus = 'active' | 'suspended';
export type ProfileColorKey = 'blue' | 'indigo' | 'violet' | 'rose' | 'coral' | 'amber' | 'emerald' | 'teal';
export type MembershipPermission =
  | 'view'
  | 'manageRoutines'
  | 'requestChecks'
  | 'submitChecks'
  | 'reviewProofs'
  | 'manageCaregivers'
  | 'manageParticipant';
export type MembershipPermissions = Record<MembershipPermission, boolean>;

export interface ParticipantSummary {
  id: string;
  displayName: string;
  profileColor?: ProfileColorKey;
  selfManaged?: boolean;
}

export interface MembershipSummary {
  role: MembershipRole;
  status: MembershipStatus;
  label?: 'parent' | 'partner' | 'relative' | 'professional' | 'self' | 'other';
  permissions?: MembershipPermissions;
}

export interface ParticipantMember extends MembershipSummary {
  uid: string;
  displayName?: string;
  isCurrentUser?: boolean;
}

export interface ParticipantAccess {
  participant: ParticipantSummary;
  membership: MembershipSummary;
  members?: ParticipantMember[];
}

export interface ParticipantNotificationSource {
  participant: ParticipantSummary;
  role: Role;
  assignments: RoutineAssignment[];
  events: VerificationEvent[];
}

export interface PushSubscriptionHealth {
  permission: NotificationPermission | 'unsupported';
  endpointPresent: boolean;
  lastSuccessfulSaveAt?: string;
  lastDispatchResult?: 'success' | 'failed' | 'invalidated';
  lastDispatchAt?: string;
  lastDispatchError?: string;
  lastPushReceivedAt?: string;
  deliveryStatus?: 'ready' | 'expected' | 'received' | 'opened' | 'unconfirmed';
  recoveryRequired?: boolean;
}

export interface AppPreferences {
  notificationWindowStart: string;
  notificationWindowEnd: string;
}

export const defaultAppPreferences: AppPreferences = {
  notificationWindowStart: '08:00',
  notificationWindowEnd: '21:00',
};

export const normalizeAppPreferences = (preferences?: Partial<AppPreferences>): AppPreferences => ({
  notificationWindowStart: preferences?.notificationWindowStart ?? defaultAppPreferences.notificationWindowStart,
  notificationWindowEnd: preferences?.notificationWindowEnd ?? defaultAppPreferences.notificationWindowEnd,
});

export interface AppState {
  role?: Role;
  pilotParticipation?: PilotParticipation;
  accountDisplayName?: string;
  contactEmail?: string;
  accessStatus?: 'active' | 'suspended';
  locale: Locale;
  notificationsEnabled: boolean;
  pushHealth?: PushSubscriptionHealth;
  preferences?: AppPreferences;
  family: FamilyState;
  participantAccess?: ParticipantAccess[];
  notificationSources?: ParticipantNotificationSource[];
  activeParticipantId?: string;
  routineAssignments: RoutineAssignment[];
  routinesLoaded?: boolean;
  routinesError?: boolean;
  events: VerificationEvent[];
}

export interface AnalysisResult {
  status: Extract<VerificationStatus, 'detected' | 'not_detected' | 'uncertain'>;
  analysisSource?: 'ai' | 'fallback';
  confidence: number;
  imageQuality: number;
  reason?: string;
}

export const defaultPlan: MonitoringPlan = {
  checksPerDay: 3,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  windows: [
    { id: 'morning', start: '07:30', end: '09:30' },
    { id: 'midday', start: '12:00', end: '14:00' },
    { id: 'evening', start: '17:00', end: '20:00' },
  ],
  scheduleGroups: [
    {
      id: 'everyday',
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      windows: [
        { id: 'morning', start: '07:30', end: '09:30' },
        { id: 'midday', start: '12:00', end: '14:00' },
        { id: 'evening', start: '17:00', end: '20:00' },
      ],
    },
  ],
  expiryMinutes: 0,
  timeZone: 'Europe/Paris',
};

export const DEFAULT_ROUTINE_ID = 'orthodontic-elastics';

export const defaultRoutine = structuredClone(
  generatedRoutines.find((routine) => routine.id === DEFAULT_ROUTINE_ID),
) as unknown as Routine;

export const createDefaultRoutineAssignment = (assignedAt = new Date().toISOString()): RoutineAssignment => ({
  id: DEFAULT_ROUTINE_ID,
  routineId: DEFAULT_ROUTINE_ID,
  routine: defaultRoutine,
  plan: structuredClone(defaultPlan),
  status: 'active',
  assignedAt,
  createdBy: 'system',
  validationMode: 'ai',
});

export const createRoutineAssignment = (
  routine: Routine,
  assignedAt = new Date().toISOString(),
): RoutineAssignment => ({
  id: routine.id,
  routineId: routine.id,
  routine,
  plan: structuredClone(defaultPlan),
  status: 'active',
  assignedAt,
  createdBy: 'parent',
  validationMode: 'ai',
});

export const primaryRoutineAssignment = (state: Pick<AppState, 'routineAssignments'>) =>
  state.routineAssignments.find((assignment) => assignment.status === 'active') ?? state.routineAssignments[0];
