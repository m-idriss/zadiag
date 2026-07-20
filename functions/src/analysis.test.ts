import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeGeminiResponse, analyzeWithGemini, extractJsonPayload, localizeAnalysisReason, normalizeAnalysisResult, routeAnalysisStatusForReview } from './analysis.js';

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
