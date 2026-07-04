import { defaultRoutine, type Locale, type Routine } from './models';
import { presentRoutine } from './routinePresentation';

export const availableRoutines: Routine[] = [
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
        instructionSteps: [
          { id: 'prepare', icon: '✦', title: 'Prépare la séance', description: 'Choisis un espace adapté et suis le plan.' },
          { id: 'complete', icon: '✓', title: 'Fais l’exercice', description: 'Réalise la routine convenue avec ton responsable.' },
          { id: 'send', icon: '➤', title: 'Envoie ta preuve', description: 'Le responsable pourra ensuite la vérifier.' },
        ],
      },
    },
  },
];

export const routineFromCatalog = (routineId: string) =>
  availableRoutines.find((routine) => routine.id === routineId);

export const assignableRoutines = (assignedRoutineIds: string[]) => {
  const assigned = new Set(assignedRoutineIds);
  return availableRoutines.filter((routine) => !assigned.has(routine.id));
};

export const presentCatalogRoutine = (routine: Routine, locale: Locale) => presentRoutine(routine, locale);
