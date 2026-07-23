import { describe, expect, it } from 'vitest';
import { parsePhotoChecklistItemResults, parseRoutineQuizResult, parseRoutineResponse, responseForRoutine } from './models';

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
    expect(parseRoutineResponse({
      kind: 'photo_checklist',
      prompt: 'Prends une photo de l’installation',
      criteria: [
        { id: 'upper-elastic', label: 'Élastique supérieur', criterion: 'An elastic is visibly attached to the upper braces.', required: true },
        { id: 'lower-elastic', label: 'Élastique inférieur', criterion: 'An elastic is visibly attached to the lower braces.', required: false },
      ],
    })).toEqual({
      kind: 'photo_checklist',
      prompt: 'Prends une photo de l’installation',
      criteria: [
        { id: 'upper-elastic', label: 'Élastique supérieur', criterion: 'An elastic is visibly attached to the upper braces.', required: true },
        { id: 'lower-elastic', label: 'Élastique inférieur', criterion: 'An elastic is visibly attached to the lower braces.', required: false },
      ],
    });
  });

  it('rejects malformed or ambiguous definitions instead of partially accepting them', () => {
    expect(parseRoutineResponse({ kind: 'checklist', prompt: 'Confirme', items: [{ id: 'dose', label: 'A' }, { id: 'dose', label: 'B' }] })).toBeUndefined();
    expect(parseRoutineResponse({ kind: 'quiz', prompt: 'Quiz', topic: 'Java', mode: 'generated', questionCount: 0, choiceCount: 3 })).toBeUndefined();
    expect(parseRoutineResponse({ kind: 'unknown' })).toBeUndefined();
    const criterion = { id: 'elastic', label: 'Elastic', criterion: 'An elastic is visible.', required: true };
    expect(parseRoutineResponse({ kind: 'photo_checklist', prompt: 'Photo', criteria: [criterion] })).toBeUndefined();
    expect(parseRoutineResponse({ kind: 'photo_checklist', prompt: 'Photo', criteria: [criterion, criterion] })).toBeUndefined();
    expect(parseRoutineResponse({ kind: 'photo_checklist', prompt: 'Photo', criteria: [criterion, { ...criterion, id: 'other', unknown: true }] })).toBeUndefined();
    expect(parseRoutineResponse({ kind: 'photo_checklist', prompt: 'Photo', criteria: [criterion, { ...criterion, id: 'other', criterion: 'x'.repeat(501) }] })).toBeUndefined();
  });

  it('parses bounded item decisions with explicit provenance', () => {
    const results = [
      { criterionId: 'upper-elastic', status: 'detected', confidence: 0.92, reason: 'Visible.', decision: { source: 'ai' } },
      { criterionId: 'lower-elastic', status: 'uncertain', confidence: 0.45, reason: 'Partly hidden.', decision: { source: 'responsible', actorUid: 'owner-1', decidedAt: '2026-07-23T18:00:00.000Z' } },
    ];
    expect(parsePhotoChecklistItemResults(results)).toEqual(results);
    expect(parsePhotoChecklistItemResults([results[0], { ...results[1], criterionId: 'upper-elastic' }])).toBeUndefined();
    expect(parsePhotoChecklistItemResults([results[0], { ...results[1], confidence: 2 }])).toBeUndefined();
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
