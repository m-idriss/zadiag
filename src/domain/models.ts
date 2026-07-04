export type Role = 'parent' | 'child';
export type Locale = 'en' | 'fr';
export type VerificationStatus =
  | 'pending'
  | 'analyzing'
  | 'detected'
  | 'not_detected'
  | 'uncertain'
  | 'missed'
  | 'expired';

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

export type RoutineStatus = 'active' | 'paused' | 'completed';

export interface RoutineInstructionStep {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export interface RoutineLocalizedContent {
  name?: string;
  description?: string;
  instructions?: string;
  instructionSteps?: RoutineInstructionStep[];
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  icon?: string;
  accentColor?: string;
  proofType?: string;
  responsibleName?: string;
  instructionSteps?: RoutineInstructionStep[];
  translations?: Partial<Record<Locale, RoutineLocalizedContent>>;
}

export interface RoutineAssignment {
  id: string;
  routineId: string;
  routine: Routine;
  plan: MonitoringPlan;
  status: RoutineStatus;
  assignedAt: string;
}

export interface RoutineTask {
  id: string;
  routineId: string;
  requestedAt: string;
  expiresAt: string;
  status: VerificationStatus;
}

export interface VerificationEvent extends RoutineTask {
  sessionId: string;
  capturedAt?: string;
  analysisSource?: 'ai' | 'fallback';
  confidence?: number;
  imageQuality?: number;
  reason?: string;
}

export interface FamilyState {
  id?: string;
  linked: boolean;
  childLinked: boolean;
  childName: string;
  linkingCode: string;
  parentRecoveryCode: string;
  consented: boolean;
}

export interface AppState {
  role?: Role;
  locale: Locale;
  notificationsEnabled: boolean;
  family: FamilyState;
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
      label: 'Every day',
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      windows: [
        { id: 'morning', start: '07:30', end: '09:30' },
        { id: 'midday', start: '12:00', end: '14:00' },
        { id: 'evening', start: '17:00', end: '20:00' },
      ],
    },
  ],
  expiryMinutes: 20,
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
  proofType: 'Photo',
  responsibleName: 'Care team',
  instructionSteps: [
    { id: 'wear', icon: '🦷', title: 'Wear your elastics', description: 'Follow the instructions from your healthcare professional.' },
    { id: 'photo', icon: '📷', title: 'Take a clear photo', description: 'Use good light and keep your mouth centered.' },
    { id: 'send', icon: '📤', title: 'Send your proof', description: 'Submit it so the responsible person can review it.' },
  ],
  translations: {
    fr: {
      name: 'Élastiques orthodontiques',
      description: 'Contrôles quotidiens du port des élastiques orthodontiques.',
      instructions: 'Porte tes élastiques selon les consignes de ton praticien et envoie une photo claire pour chaque contrôle.',
      instructionSteps: [
        { id: 'wear', icon: '🦷', title: 'Mets tes élastiques', description: 'Suis les consignes de ton praticien.' },
        { id: 'photo', icon: '📷', title: 'Prends une photo', description: 'Cadre bien ta bouche avec une lumière claire.' },
        { id: 'send', icon: '📤', title: 'Envoie ta preuve', description: 'Le responsable pourra ensuite la vérifier.' },
      ],
    },
  },
};

export const createDefaultRoutineAssignment = (assignedAt = new Date().toISOString()): RoutineAssignment => ({
  id: DEFAULT_ROUTINE_ID,
  routineId: DEFAULT_ROUTINE_ID,
  routine: defaultRoutine,
  plan: structuredClone(defaultPlan),
  status: 'active',
  assignedAt,
});

export const primaryRoutineAssignment = (state: Pick<AppState, 'routineAssignments'>) =>
  state.routineAssignments.find((assignment) => assignment.status === 'active') ?? state.routineAssignments[0];
