import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeGeminiResponse,
  analyzePhotoChecklistWithGemini,
  analyzeWithGemini,
  extractJsonPayload,
  isCurrentAnalysisAttempt,
  localizeAnalysisReason,
  normalizeAnalysisResult,
  normalizePhotoChecklistAnalysis,
  routeAnalysisStatusForReview,
  unavailablePhotoChecklistAnalysis,
} from './analysis.js';
import type { RoutinePhotoChecklistCriterion } from './routines.js';

const photoChecklistCriteria: RoutinePhotoChecklistCriterion[] = [
  { id: 'required-elastic', label: 'Required elastic', criterion: 'The required elastic is attached.', required: true },
  { id: 'optional-case', label: 'Optional case', criterion: 'The storage case is visible.', required: false },
];

const checklistPayload = (
  requiredStatus: 'detected' | 'not_detected' | 'uncertain' = 'detected',
  optionalStatus: 'detected' | 'not_detected' | 'uncertain' = 'detected',
) => ({
  imageQuality: 0.91,
  items: [
    { criterionId: 'required-elastic', status: requiredStatus, confidence: 0.94, reason: 'Required elastic is visible.' },
    { criterionId: 'optional-case', status: optionalStatus, confidence: 0.88, reason: 'Case result is visible.' },
  ],
});

test('routes every negative AI verdict with proof to responsible review', () => {
  assert.deepEqual(routeAnalysisStatusForReview('not_detected', true), {
    status: 'uncertain', automatedStatus: 'not_detected', reviewRequired: true,
  });
  assert.deepEqual(routeAnalysisStatusForReview('uncertain', true), {
    status: 'uncertain', automatedStatus: 'uncertain', reviewRequired: true,
  });
  assert.deepEqual(routeAnalysisStatusForReview('detected', true), {
    status: 'detected', automatedStatus: 'detected', reviewRequired: false,
  });
  assert.deepEqual(routeAnalysisStatusForReview('not_detected', false), {
    status: 'not_detected', automatedStatus: 'not_detected', reviewRequired: false,
  });
});

test('accepts exactly one result per frozen criterion and derives the aggregate on the server', () => {
  assert.deepEqual(normalizePhotoChecklistAnalysis(
    checklistPayload('detected', 'not_detected'),
    photoChecklistCriteria,
    { model: 'gemini-test-model' },
  ), {
    status: 'detected',
    imageQuality: 0.91,
    items: [
      {
        criterionId: 'required-elastic',
        status: 'detected',
        confidence: 0.94,
        reason: 'Required elastic is visible.',
        decision: { source: 'ai' },
      },
      {
        criterionId: 'optional-case',
        status: 'not_detected',
        confidence: 0.88,
        reason: 'Case result is visible.',
        decision: { source: 'ai' },
      },
    ],
    provider: 'gemini',
    model: 'gemini-test-model',
    promptVersion: 'photo-checklist-v1',
  });
  assert.equal(normalizePhotoChecklistAnalysis(
    checklistPayload('not_detected'),
    photoChecklistCriteria,
    { model: 'gemini-test-model' },
  ).status, 'not_detected');
  assert.equal(normalizePhotoChecklistAnalysis(
    checklistPayload('uncertain'),
    photoChecklistCriteria,
    { model: 'gemini-test-model' },
  ).status, 'uncertain');
});

test('rejects missing, duplicate, unknown, malformed, oversized, and model aggregate checklist output', () => {
  const valid = checklistPayload();
  const invalid: unknown[] = [
    { ...valid, items: valid.items.slice(0, 1) },
    { ...valid, items: [valid.items[0], valid.items[0]] },
    { ...valid, items: [valid.items[0], { ...valid.items[1], criterionId: 'unknown' }] },
    { ...valid, items: [valid.items[0], { ...valid.items[1], confidence: 2 }] },
    { ...valid, items: [valid.items[0], { ...valid.items[1], reason: 'x'.repeat(221) }] },
    { ...valid, items: Array.from({ length: 7 }, (_, index) => ({ ...valid.items[0], criterionId: `item-${index}` })) },
    { ...valid, status: 'detected' },
  ];
  for (const candidate of invalid) {
    assert.throws(
      () => normalizePhotoChecklistAnalysis(candidate, photoChecklistCriteria, { model: 'gemini-test-model' }),
    );
  }
});

test('forces ambiguous required criteria to review when image quality is low', () => {
  const result = normalizePhotoChecklistAnalysis(
    { ...checklistPayload(), imageQuality: 0.49 },
    photoChecklistCriteria,
    { model: 'gemini-test-model' },
  );
  assert.equal(result.status, 'uncertain');
  assert.equal(result.items[0].status, 'uncertain');
  assert.equal(result.items[1].status, 'detected');
});

test('returns a complete privacy-safe fallback after provider or structural failure', () => {
  assert.deepEqual(unavailablePhotoChecklistAnalysis(photoChecklistCriteria, 'gemini-test-model'), {
    status: 'uncertain',
    imageQuality: 0,
    items: photoChecklistCriteria.map((criterion) => ({
      criterionId: criterion.id,
      status: 'uncertain',
      confidence: 0,
      reason: 'analysis_unavailable',
      decision: { source: 'fallback' },
    })),
    provider: 'gemini',
    model: 'gemini-test-model',
    promptVersion: 'photo-checklist-v1',
  });
});

test('only allows the matching in-flight attempt to write analysis results', () => {
  assert.equal(isCurrentAnalysisAttempt({ status: 'analyzing', capturedAt: 'capture-1' }, 'capture-1'), true);
  assert.equal(isCurrentAnalysisAttempt({ status: 'analyzing', capturedAt: 'capture-2' }, 'capture-1'), false);
  assert.equal(isCurrentAnalysisAttempt({ status: 'detected', capturedAt: 'capture-1' }, 'capture-1'), false);
  assert.equal(isCurrentAnalysisAttempt(undefined, 'capture-1'), false);
});

test('extracts and normalizes a Gemini JSON payload', () => {
  const payload = extractJsonPayload('```json\n{"status":"not detected","confidence":"87%","imageQuality":"0.72","reason":"clear enough"}\n```');
  assert.equal(payload, '{"status":"not detected","confidence":"87%","imageQuality":"0.72","reason":"clear enough"}');

  const result = normalizeAnalysisResult({
    status: 'not detected',
    confidence: '87%',
    imageQuality: '0.72',
    reason: 'clear enough',
  });

  assert.deepEqual(result, {
    status: 'not_detected',
    confidence: 0.87,
    imageQuality: 0.72,
    reason: 'clear enough',
  });
});

test('parses the backend response contract from Gemini', () => {
  const result = analyzeGeminiResponse({
    candidates: [
      {
        finishReason: 'STOP',
        content: {
          parts: [
            {
              text: '```json\n{"status":"detected","confidence":"94%","imageQuality":"91%","reason":"elastics visible"}\n```',
            },
          ],
        },
      },
    ],
  });

  assert.deepEqual(result, {
    status: 'detected',
    confidence: 0.94,
    imageQuality: 0.91,
    reason: 'elastics visible',
  });
});

test('calls Gemini with the expected payload and returns a conforming analysis result', async () => {
  let sentUrl = '';
  let sentInit: RequestInit | undefined;
  const result = await analyzeWithGemini('data:image/png;base64,AAAA', {
    model: 'gemini-test-model',
    getAccessToken: async () => 'token-123',
    fetchImpl: async (input, init) => {
      sentUrl = String(input);
      sentInit = init;
      return new Response(JSON.stringify({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  text: '{"status":"detected","confidence":"0.93","imageQuality":"0.95","reason":"clear"}',
                },
              ],
            },
          },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  assert.equal(sentUrl, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent');
  assert.equal(sentInit?.method, 'POST');
  assert.equal((sentInit?.headers as Record<string, string>)?.Authorization, 'Bearer token-123');
  const sentBody = JSON.parse(String(sentInit?.body)) as { generationConfig?: {
    maxOutputTokens?: number;
    responseMimeType?: string;
    responseSchema?: { required?: string[]; properties?: Record<string, { enum?: string[] }> };
    thinkingConfig?: { thinkingBudget?: number };
  } };
  assert.equal(sentBody.generationConfig?.responseMimeType, 'application/json');
  assert.equal(sentBody.generationConfig?.maxOutputTokens, 768);
  assert.equal(sentBody.generationConfig?.thinkingConfig?.thinkingBudget, 0);
  assert.deepEqual(sentBody.generationConfig?.responseSchema?.required, ['status', 'confidence', 'imageQuality', 'reason']);
  assert.deepEqual(sentBody.generationConfig?.responseSchema?.properties?.status.enum, ['detected', 'not_detected', 'uncertain']);
  assert.deepEqual(result, {
    status: 'detected',
    confidence: 0.93,
    imageQuality: 0.95,
    reason: 'clear',
  });
});

test('asks Gemini for criterion-only checklist output and preserves analysis metadata', async () => {
  let sentBody: {
    contents?: Array<{ parts?: Array<{ text?: string }> }>;
    generationConfig?: {
      maxOutputTokens?: number;
      responseSchema?: {
        required?: string[];
        properties?: { items?: { minItems?: number; maxItems?: number; items?: { properties?: { criterionId?: { enum?: string[] } } } } };
      };
    };
  } = {};
  const result = await analyzePhotoChecklistWithGemini('data:image/png;base64,AAAA', {
    model: 'gemini-test-model',
    locale: 'fr',
    prompt: 'Photographie les élastiques.',
    criteria: photoChecklistCriteria,
    getAccessToken: async () => 'token-123',
    fetchImpl: async (_input, init) => {
      sentBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(checklistPayload()) }] } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  const prompt = sentBody.contents?.[0]?.parts?.[0]?.text ?? '';
  assert.match(prompt, /Photographie les élastiques/);
  assert.match(prompt, /Criterion ID: required-elastic/);
  assert.match(prompt, /Do not return an aggregate or global status/);
  assert.match(prompt, /natural French/);
  assert.equal(sentBody.generationConfig?.maxOutputTokens, 1_536);
  assert.deepEqual(sentBody.generationConfig?.responseSchema?.required, ['imageQuality', 'items']);
  assert.equal(sentBody.generationConfig?.responseSchema?.properties?.items?.minItems, 2);
  assert.equal(sentBody.generationConfig?.responseSchema?.properties?.items?.maxItems, 2);
  assert.deepEqual(
    sentBody.generationConfig?.responseSchema?.properties?.items?.items?.properties?.criterionId?.enum,
    ['required-elastic', 'optional-case'],
  );
  assert.equal(result.provider, 'gemini');
  assert.equal(result.model, 'gemini-test-model');
  assert.equal(result.promptVersion, 'photo-checklist-v1');
});

test('retries a negative checklist verdict and keeps the first complete result if retry fails', async () => {
  let callCount = 0;
  const result = await analyzePhotoChecklistWithGemini('data:image/png;base64,AAAA', {
    model: 'gemini-test-model',
    prompt: 'Take a photo.',
    criteria: photoChecklistCriteria,
    getAccessToken: async () => 'token-123',
    fetchImpl: async () => {
      callCount += 1;
      if (callCount === 2) return new Response('provider unavailable', { status: 503 });
      return new Response(JSON.stringify({
        candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(checklistPayload('not_detected')) }] } }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  assert.equal(callCount, 2);
  assert.equal(result.status, 'not_detected');
  assert.equal(result.items.length, photoChecklistCriteria.length);
});

test('surfaces an initial provider failure for the callable to convert into review', async () => {
  await assert.rejects(
    analyzePhotoChecklistWithGemini('data:image/png;base64,AAAA', {
      model: 'gemini-test-model',
      prompt: 'Take a photo.',
      criteria: photoChecklistCriteria,
      getAccessToken: async () => 'token-123',
      fetchImpl: async () => new Response('provider unavailable', { status: 503 }),
    }),
    /status 503/,
  );
});

test('asks Gemini to answer in the requested locale', async () => {
  let bodyText = '';
  const result = await analyzeWithGemini('data:image/png;base64,AAAA', {
    model: 'gemini-test-model',
    locale: 'fr',
    getAccessToken: async () => 'token-123',
    fetchImpl: async (_input, init) => {
      bodyText = String(init?.body ?? '');
      return new Response(JSON.stringify({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  text: '{"status":"detected","confidence":"0.88","imageQuality":"0.91","reason":"Les élastiques sont visibles."}',
                },
              ],
            },
          },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  assert.match(bodyText, /Reply in French\./);
  assert.equal(result.reason, 'Les élastiques sont visibles.');
});

test('includes routine-specific evidence criteria in the Gemini prompt', async () => {
  let bodyText = '';
  await analyzeWithGemini('data:image/png;base64,AAAA', {
    model: 'gemini-test-model',
    getAccessToken: async () => 'token-123',
    routineAnalysis: {
      routineName: 'Hydration',
      expectedEvidence: 'A water bottle, glass of water, or hydration tracker.',
      detectedCriteria: 'hydration proof is clearly visible.',
      notDetectedCriteria: 'no hydration proof is visible.',
      uncertaintyCriteria: 'the object could be unrelated to hydration.',
    },
    fetchImpl: async (_input, init) => {
      bodyText = String(init?.body ?? '');
      return new Response(JSON.stringify({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  text: '{"status":"detected","confidence":"0.9","imageQuality":"0.92","reason":"hydration proof visible"}',
                },
              ],
            },
          },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  assert.match(bodyText, /Routine: Hydration/);
  assert.match(bodyText, /A water bottle, glass of water, or hydration tracker/);
  assert.match(bodyText, /hydration proof is clearly visible/);
});

test('translates the reason when locale is French', async () => {
  let bodyText = '';
  const translated = await localizeAnalysisReason('No treatment aid is visible on the teeth.', {
    model: 'gemini-test-model',
    locale: 'fr',
    getAccessToken: async () => 'token-123',
    fetchImpl: async (_input, init) => {
      bodyText = String(init?.body ?? '');
      return new Response(JSON.stringify({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  text: 'Aucun appareil de traitement n’est visible sur les dents.',
                },
              ],
            },
          },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  assert.match(bodyText, /Translate the following text to French/);
  assert.equal(translated, 'Aucun appareil de traitement n’est visible sur les dents.');
});

test('retries once when Gemini first answers not_detected', async () => {
  const bodies: string[] = [];
  let callCount = 0;
  const result = await analyzeWithGemini('data:image/png;base64,AAAA', {
    model: 'gemini-test-model',
    getAccessToken: async () => 'token-123',
    fetchImpl: async (_input, init) => {
      bodies.push(String(init?.body ?? ''));
      callCount += 1;
      const payload = callCount === 1
        ? {
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  parts: [
                    {
                      text: '{"status":"not_detected","confidence":"0.18","imageQuality":"0.41","reason":"first pass"}',
                    },
                  ],
                },
              },
            ],
          }
        : {
            candidates: [
              {
                finishReason: 'STOP',
                content: {
                  parts: [
                    {
                      text: '{"status":"detected","confidence":"0.91","imageQuality":"0.88","reason":"second pass"}',
                    },
                  ],
                },
              },
            ],
          };
      return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
  });

  assert.equal(callCount, 2);
  assert.equal(bodies.length, 2);
  assert.match(bodies[1], /second pass/i);
  assert.deepEqual(result, {
    status: 'detected',
    confidence: 0.91,
    imageQuality: 0.88,
    reason: 'second pass',
  });
});
