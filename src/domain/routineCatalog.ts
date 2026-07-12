import { defaultRoutine, type Locale, type Routine } from './models';
import { presentRoutine } from './routinePresentation';
import { translationsForRoutine } from './routineTranslations';

// Built-in routines shipped with the app. Shared/custom routines live in the
// marketplace layer and are snapshotted into RoutineAssignment when assigned.
export const availableRoutines: Routine[] = [
  defaultRoutine,
  {
    id: 'daily-hydration',
    name: 'Hydration',
    description: 'Daily water intake check.',
    instructions: 'When requested, send a photo showing you drinking water or a clear hydration proof.',
    icon: '💧',
    accentColor: '#2387c9',
    category: 'wellness',
    proofType: 'Photo',
    proofExample: 'Photo of the participant drinking water, a visible glass, bottle, or hydration tracker.',
    recommendedValidationMode: 'ai',
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
    translations: translationsForRoutine('daily-hydration'),
  },
  {
    id: 'medication',
    name: 'Medication',
    description: 'Medication adherence reminder.',
    instructions: 'Take the medication as prescribed and send proof when requested.',
    icon: '✚',
    accentColor: '#9468d7',
    category: 'medication',
    proofType: 'Photo',
    proofExample: 'Photo of the medication box, pill organizer, or prepared prescribed dose.',
    recommendedValidationMode: 'ai',
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
    translations: translationsForRoutine('medication'),
  },
  {
    id: 'mobility-exercise',
    name: 'Exercise',
    description: 'Daily mobility or exercise check.',
    instructions: 'Complete the planned exercise and send proof when requested.',
    icon: '✦',
    accentColor: '#c07a17',
    category: 'activity',
    proofType: 'Photo',
    proofExample: 'Photo showing the completed position, equipment, or activity proof agreed for the routine.',
    recommendedValidationMode: 'ai',
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
    translations: translationsForRoutine('mobility-exercise'),
  },
];

export const routineFromCatalog = (routineId: string) =>
  availableRoutines.find((routine) => routine.id === routineId);

export const assignableRoutines = (assignedRoutineIds: string[]) => {
  const assigned = new Set(assignedRoutineIds);
  return availableRoutines.filter((routine) => !assigned.has(routine.id));
};

export const presentCatalogRoutine = (routine: Routine, locale: Locale) => presentRoutine(routine, locale);
