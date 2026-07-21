import { z } from 'zod';

export interface QuizGenerationRequest {
  topic: string;
  questionCount: number;
  choiceCount: number;
  locale: 'en' | 'fr';
  recentQuestions?: string[];
  weakConcepts?: string[];
}

export interface PublicQuizQuestion {
  id: string;
  prompt: string;
  concept: string;
  choices: Array<{ id: string; label: string }>;
}

export interface QuizAnswerKeyEntry {
  questionId: string;
  correctChoiceId: string;
  explanation: string;
  concept: string;
}

export interface GeneratedQuiz {
  questions: PublicQuizQuestion[];
  answerKey: QuizAnswerKeyEntry[];
}

export interface QuizSubmission {
  kind: 'quiz';
  answers: Array<{ questionId: string; choiceId: string }>;
}

const responseQuestionSchema = z.strictObject({
  prompt: z.string().trim().min(5).max(500),
  concept: z.string().trim().min(1).max(100),
  choices: z.array(z.string().trim().min(1).max(200)).min(2).max(5),
  correctChoiceIndex: z.number().int().min(0).max(4),
  explanation: z.string().trim().min(5).max(500),
});

const quizResponseSchema = z.strictObject({ questions: z.array(responseQuestionSchema).min(1).max(10) });

type GeminiGenerateContentResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  error?: unknown;
};

const responseSchema = {
  type: 'OBJECT',
  required: ['questions'],
  properties: {
    questions: {
      type: 'ARRAY',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'OBJECT',
        required: ['prompt', 'concept', 'choices', 'correctChoiceIndex', 'explanation'],
        properties: {
          prompt: { type: 'STRING', maxLength: 500 },
          concept: { type: 'STRING', maxLength: 100 },
          choices: { type: 'ARRAY', minItems: 2, maxItems: 5, items: { type: 'STRING', maxLength: 200 } },
          correctChoiceIndex: { type: 'INTEGER', minimum: 0, maximum: 4 },
          explanation: { type: 'STRING', maxLength: 500 },
        },
      },
    },
  },
} as const;

const jsonFrom = (text: string) => {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '');
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('quiz_invalid_output');
  return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
};

export const parseGeneratedQuiz = (value: unknown, request: Pick<QuizGenerationRequest, 'questionCount' | 'choiceCount'>): GeneratedQuiz => {
  const parsed = quizResponseSchema.parse(value);
  if (parsed.questions.length !== request.questionCount) throw new Error('quiz_question_count_mismatch');
  const normalizedPrompts = new Set<string>();
  const questions = parsed.questions.map((question, questionIndex) => {
    if (question.choices.length !== request.choiceCount || question.correctChoiceIndex >= question.choices.length) throw new Error('quiz_choice_count_mismatch');
    const promptKey = question.prompt.toLocaleLowerCase();
    if (normalizedPrompts.has(promptKey) || new Set(question.choices.map((choice) => choice.toLocaleLowerCase())).size !== question.choices.length) {
      throw new Error('quiz_duplicate_content');
    }
    normalizedPrompts.add(promptKey);
    return {
      id: `q-${questionIndex + 1}`,
      prompt: question.prompt,
      concept: question.concept,
      choices: question.choices.map((label, choiceIndex) => ({ id: `q-${questionIndex + 1}-c-${choiceIndex + 1}`, label })),
      correctChoiceIndex: question.correctChoiceIndex,
      explanation: question.explanation,
    };
  });
  return {
    questions: questions.map(({ correctChoiceIndex: _correctChoiceIndex, explanation: _explanation, ...question }) => question),
    answerKey: questions.map((question) => ({
      questionId: question.id,
      correctChoiceId: question.choices[question.correctChoiceIndex].id,
      explanation: question.explanation,
      concept: question.concept,
    })),
  };
};

export const gradeQuizSubmission = (
  questions: PublicQuizQuestion[],
  answerKey: QuizAnswerKeyEntry[],
  input: unknown,
) => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('quiz_invalid_submission');
  const candidate = input as Record<string, unknown>;
  if (candidate.kind !== 'quiz' || !Array.isArray(candidate.answers) || Object.keys(candidate).some((key) => !['kind', 'answers'].includes(key))) throw new Error('quiz_invalid_submission');
  const answers = candidate.answers.map((answer) => {
    if (!answer || typeof answer !== 'object' || Array.isArray(answer)) throw new Error('quiz_invalid_submission');
    const entry = answer as Record<string, unknown>;
    if (typeof entry.questionId !== 'string' || typeof entry.choiceId !== 'string' || Object.keys(entry).some((key) => !['questionId', 'choiceId'].includes(key))) throw new Error('quiz_invalid_submission');
    return { questionId: entry.questionId, choiceId: entry.choiceId };
  });
  if (answers.length !== questions.length || answerKey.length !== questions.length || new Set(answers.map((answer) => answer.questionId)).size !== answers.length) throw new Error('quiz_incomplete_submission');
  const corrections = questions.map((question) => {
    const answer = answers.find((candidateAnswer) => candidateAnswer.questionId === question.id);
    const key = answerKey.find((candidateKey) => candidateKey.questionId === question.id);
    if (!answer || !key || !question.choices.some((choice) => choice.id === answer.choiceId) || !question.choices.some((choice) => choice.id === key.correctChoiceId)) throw new Error('quiz_invalid_submission');
    return { questionId: question.id, selectedChoiceId: answer.choiceId, correctChoiceId: key.correctChoiceId, correct: answer.choiceId === key.correctChoiceId, explanation: key.explanation };
  });
  const correctCount = corrections.filter((correction) => correction.correct).length;
  return {
    submission: { kind: 'quiz' as const, answers },
    result: {
      score: correctCount / questions.length,
      correctCount,
      totalCount: questions.length,
      concepts: [...new Set(answerKey.map((entry) => entry.concept))],
      corrections,
    },
  };
};

const promptFor = (request: QuizGenerationRequest) => [
  `Create a learning quiz about: ${request.topic}.`,
  `Return exactly ${request.questionCount} questions and exactly ${request.choiceCount} answer choices per question.`,
  'Each question must have exactly one unambiguously correct answer.',
  'Provide a short factual explanation and a concise concept label.',
  request.locale === 'fr' ? 'Write every learner-facing field in French.' : 'Write every learner-facing field in English.',
  request.weakConcepts?.length ? `Revisit these weaker concepts when relevant: ${request.weakConcepts.slice(0, 10).join(', ')}.` : '',
  request.recentQuestions?.length ? `Do not repeat these recent questions: ${request.recentQuestions.slice(0, 10).join(' | ')}.` : '',
  'Do not include trick questions, personal data, medical advice, or markdown. Return JSON only.',
].filter(Boolean).join(' ');

export const generateQuizWithGemini = async (request: QuizGenerationRequest, options: {
  model: string;
  getAccessToken: () => Promise<string | null | undefined>;
  fetchImpl?: typeof fetch;
}): Promise<GeneratedQuiz> => {
  const token = await options.getAccessToken();
  if (!token) throw new Error('quiz_missing_access_token');
  const response = await (options.fetchImpl ?? fetch)(`https://generativelanguage.googleapis.com/v1beta/models/${options.model}:generateContent`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: promptFor(request) }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 3_000,
        responseMimeType: 'application/json',
        responseSchema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  });
  if (!response.ok) throw new Error(`quiz_provider_${response.status}`);
  const payload = await response.json() as GeminiGenerateContentResponse;
  if (payload.error) throw new Error('quiz_provider_error');
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
  if (!text) throw new Error('quiz_empty_output');
  return parseGeneratedQuiz(jsonFrom(text), request);
};
