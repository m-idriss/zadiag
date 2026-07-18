import assert from 'node:assert/strict';
import test from 'node:test';
import { operationalAlertDefinitions, operationalAlertPayload, operationalEventPayload, operationalRecoveryPayload } from './observability.js';

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
    severity: 'SEV-2',
    owner: 'pilot-operations',
    thresholdOccurrences: 5,
    thresholdWindowMinutes: 10,
    runbook: 'docs/pilot-support-incident-playbook.md#push-delivery',
    dedupeKey: 'operational:push_send_failed',
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
    severity: 'SEV-2',
    owner: 'ai-reliability',
    thresholdOccurrences: 3,
    thresholdWindowMinutes: 15,
    runbook: 'docs/pilot-support-incident-playbook.md#analysis',
    dedupeKey: 'operational:analysis_failed',
    details: { model: 'gemini' },
  });
});

test('defines every required threshold and a correlated recovery event', () => {
  for (const kind of ['push_send_failed', 'analysis_failed', 'app_check_rejected', 'storage_cleanup_failed', 'scheduler_dispatch_failed', 'push_delivery_unconfirmed'] as const) {
    assert.ok(operationalAlertDefinitions[kind].occurrences > 0);
    assert.ok(operationalAlertDefinitions[kind].windowMinutes > 0);
    assert.ok(operationalAlertDefinitions[kind].owner);
  }
  assert.deepEqual(operationalRecoveryPayload('analysis_failed'), { event: 'operational_recovery', kind: 'analysis_failed', owner: 'ai-reliability', dedupeKey: 'operational:analysis_failed', recoveryWindowMinutes: 15 });
});

test('builds a synthetic test alert without participant or proof fields', () => {
  const payload = operationalAlertPayload({ kind: 'operational_test', details: { source: 'manual_test' } });
  assert.equal(payload.severity, 'TEST');
  assert.equal('familyId' in payload, false);
  assert.equal('checkId' in payload, false);
  assert.equal(JSON.stringify(payload).includes('proof'), false);
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
