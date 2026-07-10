import assert from 'node:assert/strict';
import test from 'node:test';
import { operationalAlertPayload } from './observability.js';

test('builds a structured operational alert payload', () => {
  const payload = operationalAlertPayload({
    kind: 'push_send_failed',
    familyId: 'family-1',
    checkId: 'check-1',
    details: { statusCode: 500, retryable: true },
    error: new Error('Push service failed'),
  });

  assert.deepEqual(payload, {
    alert: 'operational_alert',
    kind: 'push_send_failed',
    familyId: 'family-1',
    checkId: 'check-1',
    details: { statusCode: 500, retryable: true },
    error: 'Push service failed',
  });
});

test('drops non-scalar operational alert details', () => {
  const payload = operationalAlertPayload({
    kind: 'analysis_failed',
    details: {
      model: 'gemini',
      ignoredObject: { private: true } as never,
      ignoredArray: ['raw'] as never,
      ignoredUndefined: undefined,
    },
  });

  assert.deepEqual(payload, {
    alert: 'operational_alert',
    kind: 'analysis_failed',
    details: { model: 'gemini' },
  });
});
