import { describe, expect, it } from 'vitest';
import { ROUTINE_PACKAGE_SCHEMA_VERSION, routinePackageLimits, validateRoutinePackage } from './routine-package.mjs';

const validPackage = () => ({
  schemaVersion: ROUTINE_PACKAGE_SCHEMA_VERSION,
  version: 1,
  defaultLocale: 'en',
  availableLocales: ['en', 'fr'],
  routine: {
    id: 'test-routine', name: 'Test routine', description: 'A complete test routine description.',
    instructions: 'Complete the routine and provide the expected proof.', icon: 'star', accentColor: '#2387c9',
    category: 'custom', proofType: 'Photo', proofExample: 'A clear photo showing the completed routine.',
    recommendedValidationMode: 'ai', responsibleName: 'Care team',
    analysis: {
      expectedEvidence: 'A clear photo showing the expected test evidence.',
      detectedCriteria: 'The expected evidence is clearly visible in the photo.',
      notDetectedCriteria: 'The photo is clear but the expected evidence is absent.',
      uncertaintyCriteria: 'The photo is too dark, blurry, cropped, or ambiguous.',
    },
    instructionSteps: [
      { id: 'prepare', icon: 'star', title: 'Prepare', description: 'Prepare everything needed for the routine.' },
      { id: 'send', icon: 'send', title: 'Send proof', description: 'Send a clear photo of the expected proof.' },
    ],
    translations: { fr: {
      name: 'Routine de test', description: 'Une description complète de la routine de test.',
      instructions: 'Réalise la routine et fournis la preuve attendue.', proofExample: 'Une photo claire montrant la routine terminée.',
      analysis: {
        expectedEvidence: 'Une photo claire montrant la preuve de test attendue.',
        detectedCriteria: 'La preuve attendue est clairement visible sur la photo.',
        notDetectedCriteria: 'La photo est claire mais la preuve attendue est absente.',
        uncertaintyCriteria: 'La photo est trop sombre, floue, coupée ou ambiguë.',
      },
      instructionSteps: [
        { id: 'prepare', icon: 'star', title: 'Prépare', description: 'Prépare tout le nécessaire pour la routine.' },
        { id: 'send', icon: 'send', title: 'Envoie', description: 'Envoie une photo claire de la preuve attendue.' },
      ],
    } },
  },
});

describe('Routine Package V1 validation', () => {
  it('returns only the compatible routine payload', () => {
    const routinePackage = validPackage();
    expect(validateRoutinePackage('test.json', routinePackage)).toBe(routinePackage.routine);
  });

  it('rejects unsupported schema versions and undeclared translations', () => {
    const wrongVersion = validPackage();
    wrongVersion.schemaVersion = 2;
    expect(() => validateRoutinePackage('test.json', wrongVersion)).toThrow('schemaVersion must be 1');

    const missingLocale = validPackage();
    missingLocale.availableLocales = ['en'];
    expect(() => validateRoutinePackage('test.json', missingLocale)).toThrow('availableLocales must exactly match');
  });

  it('rejects translated steps that diverge from the default locale', () => {
    const routinePackage = validPackage();
    routinePackage.routine.translations.fr.instructionSteps.reverse();
    expect(() => validateRoutinePackage('test.json', routinePackage)).toThrow('step ids and order must match');
  });

  it('rejects unknown executable fields and oversized packages', () => {
    const executable = validPackage();
    executable.routine.script = 'alert(1)';
    expect(() => validateRoutinePackage('test.json', executable)).toThrow('unknown field script');

    const oversized = validPackage();
    oversized.routine.instructions = 'x'.repeat(routinePackageLimits.packageBytes);
    expect(() => validateRoutinePackage('test.json', oversized)).toThrow(/exceeds|package is/);
  });
});
