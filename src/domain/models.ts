import { translationsForRoutine } from './routineTranslations';

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
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  icon?: string;
  accentColor?: string;
  category?: RoutineCategory;
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
  capturedAt?: string;
  analysisSource?: 'ai' | 'fallback' | 'self';
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

export interface ParticipantSummary {
  id: string;
  displayName: string;
  profileColor?: ProfileColorKey;
  selfManaged?: boolean;
}

interface MembershipSummary {
  role: MembershipRole;
  status: MembershipStatus;
  label?: 'parent' | 'partner' | 'relative' | 'professional' | 'self' | 'other';
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

export const defaultRoutine: Routine = {
  id: DEFAULT_ROUTINE_ID,
  name: 'Orthodontic Elastics',
  description: 'Daily orthodontic elastic wear checks.',
  instructions: 'Wear your elastics as prescribed. When a check is ready, take a clear photo in good light.',
  icon: '🦷',
  accentColor: '#0d927d',
  category: 'dental',
  proofType: 'Photo',
  proofExample: 'Mouth photo with the elastics visible in good light.',
  recommendedValidationMode: 'ai',
  responsibleName: 'Care team',
  analysis: {
    expectedEvidence: 'A clear view of the mouth showing whether orthodontic elastics are being worn.',
    detectedCriteria: 'orthodontic elastics are clearly visible on the teeth or braces.',
    notDetectedCriteria: 'the mouth or teeth are visible and orthodontic elastics are clearly absent.',
    uncertaintyCriteria: 'the mouth is not visible enough, the image is blurry or dark, or it is impossible to tell whether elastics are present.',
  },
  instructionSteps: [
    { id: 'wear', icon: '🦷', title: 'Wear your elastics', description: 'Follow the instructions from your healthcare professional.' },
    { id: 'photo', icon: '📷', title: 'Take a clear photo', description: 'Use good light and keep your mouth centered.' },
    { id: 'send', icon: '📤', title: 'Send your proof', description: 'Submit it so the responsible person can review it.' },
  ],
  translations: translationsForRoutine(DEFAULT_ROUTINE_ID),
};

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
