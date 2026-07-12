import type { Locale, RoutineLocalizedContent } from './models';

type BuiltinRoutineTranslations = Partial<Record<Locale, RoutineLocalizedContent>>;

// All localized content for built-in routines lives here. Routine definitions
// remain the locale-neutral source for scheduling, validation and persistence.
export const builtinRoutineTranslations: Record<string, BuiltinRoutineTranslations> = {
  'orthodontic-elastics': {
    fr: {
      name: 'Élastiques orthodontiques',
      description: 'Contrôles quotidiens du port des élastiques orthodontiques.',
      instructions: 'Porte tes élastiques selon les consignes de ton praticien et envoie une photo claire pour chaque contrôle.',
      proofExample: 'Photo de la bouche avec les élastiques visibles, en bonne lumière.',
      analysis: {
        expectedEvidence: 'Une vue claire de la bouche montrant si les élastiques orthodontiques sont portés.',
        detectedCriteria: 'les élastiques orthodontiques sont clairement visibles sur les dents ou l’appareil.',
        notDetectedCriteria: 'la bouche ou les dents sont visibles et les élastiques orthodontiques sont clairement absents.',
        uncertaintyCriteria: 'la bouche n’est pas assez visible, l’image est floue ou sombre, ou il est impossible de savoir si les élastiques sont présents.',
      },
      instructionSteps: [
        { id: 'wear', icon: '🦷', title: 'Mets tes élastiques', description: 'Suis les consignes de ton praticien.' },
        { id: 'photo', icon: '📷', title: 'Prends une photo', description: 'Cadre bien ta bouche avec une lumière claire.' },
        { id: 'send', icon: '📤', title: 'Envoie ta preuve', description: 'Le responsable pourra ensuite la vérifier.' },
      ],
    },
  },
  'daily-hydration': {
    fr: {
      name: 'Hydratation',
      description: 'Contrôle quotidien de l’hydratation.',
      instructions: 'Quand c’est demandé, envoie une photo où tu bois de l’eau ou une preuve claire d’hydratation.',
      proofExample: 'Photo du participant qui boit de l’eau, verre, bouteille ou suivi d’hydratation visible.',
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
  medication: {
    fr: {
      name: 'Médicament',
      description: 'Rappel de prise de médicament.',
      instructions: 'Prends le médicament selon la prescription et envoie une preuve quand elle est demandée.',
      proofExample: 'Photo de la boîte, du pilulier ou de la dose préparée selon la prescription.',
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
  'mobility-exercise': {
    fr: {
      name: 'Exercice',
      description: 'Contrôle quotidien d’exercice ou de mobilité.',
      instructions: 'Réalise l’exercice prévu et envoie une preuve quand elle est demandée.',
      proofExample: 'Photo montrant la position, le matériel ou la preuve d’activité prévue pour la routine.',
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
};

export const translationsForRoutine = (routineId: string) => builtinRoutineTranslations[routineId];
