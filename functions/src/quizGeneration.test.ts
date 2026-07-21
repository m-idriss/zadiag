import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQuizWithGemini, gradeQuizSubmission, parseGeneratedQuiz } from './quizGeneration.js';

const output = {
  questions: [
    { prompt: 'What does final mean for a Java variable?', concept: 'final', choices: ['Assigned once', 'Globally visible', 'Persisted'], correctChoiceIndex: 0, explanation: 'A final variable can be assigned only once.' },
    { prompt: 'Which collection keeps unique values?', concept: 'collections', choices: ['List', 'Set', 'Queue'], correctChoiceIndex: 1, explanation: 'A Set does not contain duplicate elements.' },
    { prompt: 'Which keyword creates inheritance?', concept: 'inheritance', choices: ['extends', 'throws', 'imports'], correctChoiceIndex: 0, explanation: 'A class extends another class.' },
  ],
};

test('splits public questions from the private answer key', () => {
  const quiz = parseGeneratedQuiz(output, { questionCount: 3, choiceCount: 3 });
  assert.equal(quiz.questions.length, 3);
  assert.equal('correctChoiceId' in quiz.questions[0], false);
  assert.equal('explanation' in quiz.questions[0], false);
  assert.deepEqual(quiz.answerKey[0], { questionId: 'q-1', correctChoiceId: 'q-1-c-1', explanation: 'A final variable can be assigned only once.', concept: 'final' });
});

test('rejects wrong counts, duplicate choices, and invalid answer indexes', () => {
  assert.throws(() => parseGeneratedQuiz(output, { questionCount: 2, choiceCount: 3 }), /question_count/);
  assert.throws(() => parseGeneratedQuiz({ questions: [{ ...output.questions[0], choices: ['Same', 'Same', 'Other'] }, ...output.questions.slice(1)] }, { questionCount: 3, choiceCount: 3 }), /duplicate/);
  assert.throws(() => parseGeneratedQuiz({ questions: [{ ...output.questions[0], correctChoiceIndex: 3 }, ...output.questions.slice(1)] }, { questionCount: 3, choiceCount: 3 }), /choice_count/);
});

test('uses structured Gemini output without exposing prompt content in the result', async () => {
  const fetchImpl: typeof fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    assert.match(body.contents[0].parts[0].text, /exactly 3 questions/);
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(output) }] } }] }), { status: 200 });
  };
  const quiz = await generateQuizWithGemini({ topic: 'Java', questionCount: 3, choiceCount: 3, locale: 'en' }, { model: 'test-model', getAccessToken: async () => 'token', fetchImpl });
  assert.equal(quiz.questions[2].prompt, output.questions[2].prompt);
});

test('grades only a complete submission against the frozen private key', () => {
  const quiz = parseGeneratedQuiz(output, { questionCount: 3, choiceCount: 3 });
  const graded = gradeQuizSubmission(quiz.questions, quiz.answerKey, {
    kind: 'quiz', answers: [
      { questionId: 'q-1', choiceId: 'q-1-c-1' },
      { questionId: 'q-2', choiceId: 'q-2-c-1' },
      { questionId: 'q-3', choiceId: 'q-3-c-1' },
    ],
  });
  assert.equal(graded.result.score, 2 / 3);
  assert.equal(graded.result.corrections[1].correct, false);
  assert.throws(() => gradeQuizSubmission(quiz.questions, quiz.answerKey, { kind: 'quiz', answers: [{ questionId: 'q-1', choiceId: 'q-1-c-1' }] }), /incomplete/);
});
