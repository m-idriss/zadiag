import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VerificationEvent } from '../domain/models';
import { translate } from '../services/i18n';
import { QuizResponseScreen } from './QuizResponseScreen';

const quizEvent = {
  id: 'check-1', routineId: 'routine-java', sessionId: 'session-1', requestedAt: '2026-07-21T08:00:00.000Z', expiresAt: '2026-07-21T10:00:00.000Z', status: 'pending' as const,
  challenge: {
    routineId: 'routine-java', name: 'Java learning', instructions: 'Review Java', response: { kind: 'quiz' as const, prompt: 'Ready for your quiz?', topic: 'Java', mode: 'generated' as const, questionCount: 2, choiceCount: 3 },
    quiz: { generatedAt: '2026-07-21T08:00:00.000Z', provider: 'gemini' as const, model: 'gemini-2.5-flash', promptVersion: 'quiz-v1', questions: [
      { id: 'q-1', prompt: 'What is a class?', concept: 'classes', choices: [{ id: 'q-1-c-1', label: 'A blueprint' }, { id: 'q-1-c-2', label: 'A loop' }, { id: 'q-1-c-3', label: 'A package' }] },
      { id: 'q-2', prompt: 'Which keyword creates an object?', concept: 'objects', choices: [{ id: 'q-2-c-1', label: 'new' }, { id: 'q-2-c-2', label: 'class' }, { id: 'q-2-c-3', label: 'this' }] },
    ] },
  },
} satisfies VerificationEvent;

describe('quiz response screen', () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it('requires one answer per question and displays frozen corrections', async () => {
    const report = vi.fn().mockResolvedValue(undefined);
    const submit = vi.fn().mockResolvedValue({ score: 0.5, correctCount: 1, totalCount: 2, concepts: ['classes', 'objects'], corrections: [
      { questionId: 'q-1', selectedChoiceId: 'q-1-c-1', correctChoiceId: 'q-1-c-1', correct: true, explanation: 'A class describes objects.' },
      { questionId: 'q-2', selectedChoiceId: 'q-2-c-2', correctChoiceId: 'q-2-c-1', correct: false, explanation: 'The new keyword creates an object.' },
    ] });
    act(() => root.render(<QuizResponseScreen event={quizEvent} prepare={vi.fn()} submit={submit} report={report} back={() => undefined} done={() => undefined} t={(key) => translate('en', key)} />));
    const send = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Check my answers');
    expect(send?.disabled).toBe(true);
    const questions = container.querySelectorAll('.quiz-question');
    act(() => questions[0]?.querySelectorAll('button')[0]?.click());
    act(() => questions[1]?.querySelectorAll('button')[1]?.click());
    expect(send?.disabled).toBe(false);
    await act(async () => { send?.click(); await Promise.resolve(); });
    expect(submit).toHaveBeenCalledWith([{ questionId: 'q-1', choiceId: 'q-1-c-1' }, { questionId: 'q-2', choiceId: 'q-2-c-2' }]);
    expect(container.textContent).toContain('50%');
    expect(container.textContent).toContain('1 correct answers out of 2');
    expect(container.textContent).toContain('The new keyword creates an object.');
    const reportButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find((button) => button.textContent === 'Report this question');
    expect(reportButton?.disabled).toBe(false);
    await act(async () => { reportButton?.click(); await Promise.resolve(); });
    expect(report).toHaveBeenCalledWith('q-1');
    expect(container.textContent).toContain('Question reported');
  });
});
