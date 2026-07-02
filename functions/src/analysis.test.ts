import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeGeminiResponse, analyzeWithGemini, extractJsonPayload, normalizeAnalysisResult } from './analysis.js';

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
  assert.match(String(sentInit?.body), /"responseMimeType":"application\/json"/);
  assert.deepEqual(result, {
    status: 'detected',
    confidence: 0.93,
    imageQuality: 0.95,
    reason: 'clear',
  });
});
