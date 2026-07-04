import { defaultRoutine, type Locale, type Routine } from './models';
import { presentRoutine } from './routinePresentation';

export const availableRoutines: Routine[] = [
  defaultRoutine,
  {
    id: 'daily-hydration',
    name: 'Hydration',
    description: 'Daily water intake check.',
    instructions: 'When requested, send a photo showing you drinking water or a clear hydration proof.',
    icon: '💧',
    accentColor: '#2387c9',
    proofType: 'Photo',
    responsibleName: 'Care team',
    analysis: {
      expectedEvidence: 'A photo showing the participant drinking water is sufficient. Also accept a clearly visible glass of water, water bottle, hydration tracker, or another clear sign of water intake.',
      detectedCriteria: 'the photo clearly shows the participant drinking water, or another clear proof of water intake.',
      notDetectedCriteria: 'the image is clear but does not show the participant drinking, water, a bottle, a glass, a tracker, or any hydration proof.',
      uncertaintyCriteria: 'the action or proof is ambiguous, cropped, too dark, blurry, or could be unrelated to hydration.',
    },
    instructionSteps: [
      { id: 'prepare', icon: '💧', title: 'Keep water nearby', description: 'Make it easy to drink regularly during the day.' },
      { id: 'track', icon: '▣', title: 'Show hydration', description: 'A photo of you drinking water is enough. A bottle, glass, or tracker also works.' },
      { id: 'send', icon: '➤', title: 'Send your proof', description: 'Submit it so the responsible person can review it.' },
    ],
    translations: {
      fr: {
        name: 'Hydratation',
        description: 'Contrôle quotidien de l’hydratation.',
        instructions: 'Quand c’est demandé, envoie une photo où tu bois de l’eau ou une preuve claire d’hydratation.',
        analysis: {
          expectedEvidence: 'Une photo montrant le participant en train de boire de l’eau suffit. Accepte aussi un verre d’eau, une bouteille d’eau, un suivi d’hydratation ou un autre signe clair de consommation d’eau.',
          detectedCriteria: 'la photo montre clairement le participant en train de boire de l’eau, ou une autre preuve claire de consommation d’eau.',
          notDetectedCriteria: 'l’image est claire mais ne montre pas le participant en train de boire, ni eau, ni bouteille, ni verre, ni suivi, ni preuve d’hydratation.',
          uncertaintyCriteria: 'l’action ou la preuve est ambiguë, coupée, trop sombre, floue ou pourrait ne pas être liée à l’hydratation.',
        },
        instructionSteps: [
          { id: 'prepare', icon: '💧', title: 'Garde de l’eau à portée', description: 'Rends l’hydratation simple pendant la journée.' },
          { id: 'track', icon: '▣', title: 'Montre l’hydratation', description: 'Une photo où tu bois de l’eau suffit. Une bouteille, un verre ou un suivi fonctionne aussi.' },
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

export const routineFromCatalog = (routineId: string) =>
  availableRoutines.find((routine) => routine.id === routineId);

export const assignableRoutines = (assignedRoutineIds: string[]) => {
  const assigned = new Set(assignedRoutineIds);
  return availableRoutines.filter((routine) => !assigned.has(routine.id));
};

export const presentCatalogRoutine = (routine: Routine, locale: Locale) => presentRoutine(routine, locale);
