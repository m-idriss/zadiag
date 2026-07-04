import type { MonitoringPlan } from './planning.js';

export const DEFAULT_ROUTINE_ID = 'orthodontic-elastics';

export interface RoutineDocument {
  id: string;
  name: string;
  description: string;
  instructions?: string;
  icon?: string;
  accentColor?: string;
  proofType?: string;
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
    instructionSteps?: Array<{ id: string; icon: string; title: string; description: string }>;
    analysis?: {
      expectedEvidence?: string;
      detectedCriteria?: string;
      notDetectedCriteria?: string;
      uncertaintyCriteria?: string;
    };
  }>>;
}

export const defaultRoutine = {
  id: DEFAULT_ROUTINE_ID,
  name: 'Orthodontic Elastics',
  description: 'Daily orthodontic elastic wear checks.',
  instructions: 'Wear your elastics as prescribed. When a check is ready, take a clear photo in good light.',
  icon: '🦷',
  accentColor: '#0d927d',
  proofType: 'Photo',
  responsibleName: 'Care team',
  analysis: {
    expectedEvidence: 'A clear view of the mouth showing whether orthodontic elastics are being worn.',
    detectedCriteria: 'orthodontic elastics are clearly visible on the teeth or braces.',
    notDetectedCriteria: 'the mouth or teeth are visible and orthodontic elastics are clearly absent.',
    uncertaintyCriteria: 'the mouth is not visible enough, the image is blurry or dark, or it is impossible to tell whether elastics are present.',
  },
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
      analysis: {
        expectedEvidence: 'Une vue claire de la bouche montrant si les élastiques orthodontiques sont portés.',
        detectedCriteria: 'les élastiques orthodontiques sont clairement visibles sur les dents ou l’appareil.',
        notDetectedCriteria: 'la bouche ou les dents sont visibles et les élastiques orthodontiques sont clairement absents.',
        uncertaintyCriteria: 'la bouche n’est pas assez visible, l’image est floue ou sombre, ou il est impossible de savoir si les élastiques sont présents.',
      },
      instructionSteps: [
        { id: 'wear', icon: '🦷', title: 'Mets tes élastiques', description: 'Suis les consignes de ton praticien.' },
        { id: 'photo', icon: '▣', title: 'Prends une photo', description: 'Cadre bien ta bouche avec une lumière claire.' },
        { id: 'send', icon: '➤', title: 'Envoie ta preuve', description: 'Le responsable pourra ensuite la vérifier.' },
      ],
    },
  },
};

export const availableRoutines: RoutineDocument[] = [
  defaultRoutine,
  {
    id: 'daily-hydration',
    name: 'Hydration',
    description: 'Daily water intake check.',
    instructions: 'Track your hydration during the day and send proof when requested.',
    icon: '💧',
    accentColor: '#2387c9',
    proofType: 'Photo',
    responsibleName: 'Care team',
    analysis: {
      expectedEvidence: 'A visible hydration proof such as a water bottle, glass of water, hydration tracker, or another clear sign of water intake.',
      detectedCriteria: 'the photo clearly shows hydration proof related to water intake.',
      notDetectedCriteria: 'the image is clear but does not show water, a bottle, a glass, a tracker, or any hydration proof.',
      uncertaintyCriteria: 'the proof is ambiguous, cropped, too dark, blurry, or could be unrelated to hydration.',
    },
    instructionSteps: [
      { id: 'prepare', icon: '💧', title: 'Keep water nearby', description: 'Make it easy to drink regularly during the day.' },
      { id: 'track', icon: '▣', title: 'Track your intake', description: 'Use your bottle, glass, or tracker as proof.' },
      { id: 'send', icon: '➤', title: 'Send your proof', description: 'Submit it so the responsible person can review it.' },
    ],
    translations: {
      fr: {
        name: 'Hydratation',
        description: 'Contrôle quotidien de l’hydratation.',
        instructions: 'Suis ton hydratation dans la journée et envoie une preuve quand elle est demandée.',
        analysis: {
          expectedEvidence: 'Une preuve d’hydratation visible, comme une bouteille d’eau, un verre d’eau, un suivi d’hydratation ou un signe clair de consommation d’eau.',
          detectedCriteria: 'la photo montre clairement une preuve d’hydratation liée à la consommation d’eau.',
          notDetectedCriteria: 'l’image est claire mais ne montre ni eau, ni bouteille, ni verre, ni suivi, ni preuve d’hydratation.',
          uncertaintyCriteria: 'la preuve est ambiguë, coupée, trop sombre, floue ou pourrait ne pas être liée à l’hydratation.',
        },
        instructionSteps: [
          { id: 'prepare', icon: '💧', title: 'Garde de l’eau à portée', description: 'Rends l’hydratation simple pendant la journée.' },
          { id: 'track', icon: '▣', title: 'Suis ta consommation', description: 'Utilise ta bouteille, ton verre ou ton suivi comme preuve.' },
          { id: 'send', icon: '➤', title: 'Envoie ta preuve', description: 'Le responsable pourra ensuite la vérifier.' },
        ],
      },
    },
  },
  {
    id: 'medication',
    name: 'Medication',
    description: 'Medication adherence reminder.',
    instructions: 'Take the medication as prescribed and send proof when requested.',
    icon: '✚',
    accentColor: '#9468d7',
    proofType: 'Photo',
    responsibleName: 'Care team',
    analysis: {
      expectedEvidence: 'A clear medication adherence proof such as the medication package, pill organizer, prescribed dose, or other expected medication proof.',
      detectedCriteria: 'the photo clearly shows medication-related proof consistent with taking or preparing the prescribed dose.',
      notDetectedCriteria: 'the image is clear but contains no medication, package, pill organizer, dose, or medication proof.',
      uncertaintyCriteria: 'the proof is ambiguous, the label or object is unclear, or the image quality prevents a reliable medication adherence decision.',
    },
    instructionSteps: [
      { id: 'check', icon: '✚', title: 'Check the dose', description: 'Follow the prescribed dose and timing.' },
      { id: 'photo', icon: '▣', title: 'Take a clear photo', description: 'Show the expected proof clearly.' },
      { id: 'send', icon: '➤', title: 'Send your proof', description: 'Submit it so the responsible person can review it.' },
    ],
    translations: {
      fr: {
        name: 'Médicament',
        description: 'Rappel de prise de médicament.',
        instructions: 'Prends le médicament selon la prescription et envoie une preuve quand elle est demandée.',
        analysis: {
          expectedEvidence: 'Une preuve claire de prise de médicament, comme la boîte, le pilulier, la dose prescrite ou une autre preuve attendue.',
          detectedCriteria: 'la photo montre clairement une preuve liée au médicament et cohérente avec la prise ou la préparation de la dose.',
          notDetectedCriteria: 'l’image est claire mais ne contient ni médicament, ni boîte, ni pilulier, ni dose, ni preuve liée au médicament.',
          uncertaintyCriteria: 'la preuve est ambiguë, l’objet ou l’étiquette n’est pas clair, ou la qualité empêche une décision fiable.',
        },
        instructionSteps: [
          { id: 'check', icon: '✚', title: 'Vérifie la dose', description: 'Suis la dose et l’horaire prescrits.' },
          { id: 'photo', icon: '▣', title: 'Prends une photo claire', description: 'Montre clairement la preuve attendue.' },
          { id: 'send', icon: '➤', title: 'Envoie ta preuve', description: 'Le responsable pourra ensuite la vérifier.' },
        ],
      },
    },
  },
  {
    id: 'mobility-exercise',
    name: 'Exercise',
    description: 'Daily mobility or exercise check.',
    instructions: 'Complete the planned exercise and send proof when requested.',
    icon: '✦',
    accentColor: '#c07a17',
    proofType: 'Photo',
    responsibleName: 'Care team',
    analysis: {
      expectedEvidence: 'A clear proof that the planned mobility or exercise routine was performed, such as the participant in position, exercise equipment, or a completed activity proof.',
      detectedCriteria: 'the photo clearly shows exercise or mobility activity proof matching the routine.',
      notDetectedCriteria: 'the image is clear but shows no exercise, mobility activity, equipment, position, or completed activity proof.',
      uncertaintyCriteria: 'the scene is ambiguous, too cropped, too dark, blurry, or does not show enough context to verify the exercise.',
    },
    instructionSteps: [
      { id: 'prepare', icon: '✦', title: 'Prepare the session', description: 'Choose a safe space and follow the plan.' },
      { id: 'complete', icon: '✓', title: 'Complete the exercise', description: 'Do the routine as agreed with your responsible person.' },
      { id: 'send', icon: '➤', title: 'Send your proof', description: 'Submit it so the responsible person can review it.' },
    ],
    translations: {
      fr: {
        name: 'Exercice',
        description: 'Contrôle quotidien d’exercice ou de mobilité.',
        instructions: 'Réalise l’exercice prévu et envoie une preuve quand elle est demandée.',
        analysis: {
          expectedEvidence: 'Une preuve claire que l’exercice ou la routine de mobilité prévue a été réalisée, comme le participant en position, du matériel d’exercice ou une preuve d’activité terminée.',
          detectedCriteria: 'la photo montre clairement une preuve d’exercice ou de mobilité correspondant à la routine.',
          notDetectedCriteria: 'l’image est claire mais ne montre ni exercice, ni mobilité, ni matériel, ni position, ni preuve d’activité terminée.',
          uncertaintyCriteria: 'la scène est ambiguë, trop coupée, trop sombre, floue ou ne montre pas assez de contexte pour vérifier l’exercice.',
        },
        instructionSteps: [
          { id: 'prepare', icon: '✦', title: 'Prépare la séance', description: 'Choisis un espace adapté et suis le plan.' },
          { id: 'complete', icon: '✓', title: 'Fais l’exercice', description: 'Réalise la routine convenue avec ton responsable.' },
          { id: 'send', icon: '➤', title: 'Envoie ta preuve', description: 'Le responsable pourra ensuite la vérifier.' },
        ],
      },
    },
  },
];

export interface RoutineAssignmentDocument {
  routineId: string;
  routine: RoutineDocument;
  plan: MonitoringPlan;
  status: 'active' | 'paused' | 'completed';
  assignedAt: string;
}

export const routineFromCatalog = (routineId: string) =>
  availableRoutines.find((routine) => routine.id === routineId);

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

export const createRoutineAssignment = (
  routine: RoutineDocument,
  plan: MonitoringPlan,
  assignedAt = new Date().toISOString(),
): RoutineAssignmentDocument => ({
  routineId: routine.id,
  routine,
  plan,
  status: 'active',
  assignedAt,
});

export const migrateCheckRoutineId = <T extends Record<string, unknown>>(check: T): T & { routineId: string } => ({
  ...check,
  routineId: typeof check.routineId === 'string' && check.routineId ? check.routineId : DEFAULT_ROUTINE_ID,
});
