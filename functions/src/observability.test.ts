import assert from 'node:assert/strict';
import test from 'node:test';
import { operationalAlertPayload, operationalEventPayload } from './observability.js';

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

test('builds a correlated operational event without nested sensitive details', () => {
  const payload = operationalEventPayload({
    kind: 'push_dispatch_summary',
    familyId: 'participant-1',
    checkId: 'check-1',
    routineId: 'routine-1',
    details: {
      notificationType: 'check',
      recipients: 2,
      success: 1,
      ignoredEndpoint: { endpoint: 'secret' } as never,
    },
  });

  assert.deepEqual(payload, {
    event: 'operational_event',
    kind: 'push_dispatch_summary',
    familyId: 'participant-1',
    checkId: 'check-1',
    routineId: 'routine-1',
    details: {
      notificationType: 'check',
      recipients: 2,
      success: 1,
    },
  });
});

test('truncates operational event errors used for successful fallbacks', () => {
  const payload = operationalEventPayload({
    kind: 'proof_image_fallback',
    error: new Error('x'.repeat(300)),
  });

  assert.equal(payload.error, 'x'.repeat(240));
});
