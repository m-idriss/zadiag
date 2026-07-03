import type { MonitoringPlan } from './planning.js';

export const DEFAULT_ROUTINE_ID = 'orthodontic-elastics';

export const defaultRoutine = {
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
    { id: 'photo', icon: '▣', title: 'Take a clear photo', description: 'Use good light and keep your mouth centered.' },
    { id: 'send', icon: '➤', title: 'Send your proof', description: 'Submit it so the responsible person can review it.' },
  ],
  translations: {
    fr: {
      name: 'Élastiques orthodontiques',
      description: 'Contrôles quotidiens du port des élastiques orthodontiques.',
      instructions: 'Porte tes élastiques selon les consignes de ton praticien et envoie une photo claire pour chaque contrôle.',
      instructionSteps: [
        { id: 'wear', icon: '🦷', title: 'Mets tes élastiques', description: 'Suis les consignes de ton praticien.' },
        { id: 'photo', icon: '▣', title: 'Prends une photo', description: 'Cadre bien ta bouche avec une lumière claire.' },
        { id: 'send', icon: '➤', title: 'Envoie ta preuve', description: 'Le responsable pourra ensuite la vérifier.' },
      ],
    },
  },
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
