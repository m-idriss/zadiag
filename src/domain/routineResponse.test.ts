import { describe, expect, it } from 'vitest';
import { parseRoutineQuizResult, parseRoutineResponse, responseForRoutine } from './models';

describe('routine response definitions', () => {
  it('keeps legacy routines on the photo runtime', () => {
    expect(responseForRoutine({})).toEqual({ kind: 'photo' });
  });

  it('parses bounded confirmation, checklist, and quiz definitions', () => {
    expect(parseRoutineResponse({ kind: 'confirmation', prompt: 'As-tu terminé ?', positiveLabel: 'Oui' })).toEqual({
      kind: 'confirmation', prompt: 'As-tu terminé ?', positiveLabel: 'Oui',
    });
    expect(parseRoutineResponse({ kind: 'checklist', prompt: 'Médicaments pris ?', items: [{ id: 'dose-1', label: 'Dose du matin' }] })).toEqual({
      kind: 'checklist', prompt: 'Médicaments pris ?', items: [{ id: 'dose-1', label: 'Dose du matin' }],
    });
    expect(parseRoutineResponse({ kind: 'quiz', prompt: 'Teste tes acquis', topic: 'Java', mode: 'generated', questionCount: 3, choiceCount: 3 })).toEqual({
      kind: 'quiz', prompt: 'Teste tes acquis', topic: 'Java', mode: 'generated', questionCount: 3, choiceCount: 3,
    });
  });

  it('rejects malformed or ambiguous definitions instead of partially accepting them', () => {
    expect(parseRoutineResponse({ kind: 'checklist', prompt: 'Confirme', items: [{ id: 'dose', label: 'A' }, { id: 'dose', label: 'B' }] })).toBeUndefined();
    expect(parseRoutineResponse({ kind: 'quiz', prompt: 'Quiz', topic: 'Java', mode: 'generated', questionCount: 0, choiceCount: 3 })).toBeUndefined();
    expect(parseRoutineResponse({ kind: 'unknown' })).toBeUndefined();
  });

  it('accepts only internally consistent frozen quiz results', () => {
    const result = { score: 0.5, correctCount: 1, totalCount: 2, concepts: ['classes'], provider: 'gemini', model: 'gemini-2.5-flash', promptVersion: 'quiz-v1', corrections: [
      { questionId: 'q-1', selectedChoiceId: 'a', correctChoiceId: 'a', correct: true, explanation: 'Correct.' },
      { questionId: 'q-2', selectedChoiceId: 'b', correctChoiceId: 'a', correct: false, explanation: 'Use a.' },
    ] };
    expect(parseRoutineQuizResult(result)).toEqual(result);
    expect(parseRoutineQuizResult({ ...result, score: 1 })).toBeUndefined();
  });
});
