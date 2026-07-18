import assert from 'node:assert/strict';
import test from 'node:test';
import { AiAuthoringDisabledError, aiAuthoringCapabilityEnabled, aiAuthoringMetric, parseAiAuthoringConfig, requireAiAuthoringCapability, unapprovedAiDraft } from './aiAuthoring.js';

test('defaults every provider path to disabled and requires privacy approval', () => {
  assert.equal(aiAuthoringCapabilityEnabled(undefined, 'routineTranslation'), false);
  assert.equal(aiAuthoringCapabilityEnabled({ globalEnabled: true, capabilities: { routineTranslation: true } }, 'routineTranslation'), false);
  assert.throws(() => requireAiAuthoringCapability({ globalEnabled: false, privacyApprovalId: 'approval', capabilities: { routineTranslation: true } }, 'routineTranslation'), AiAuthoringDisabledError);
  assert.equal(requireAiAuthoringCapability({ globalEnabled: true, privacyApprovalId: 'approval-1', capabilities: { routineTranslation: true } }, 'routineTranslation').promptVersion, 'routine-translation-v1');
});

test('fails closed on malformed configuration', () => { assert.deepEqual(parseAiAuthoringConfig('{'), {}); assert.deepEqual(parseAiAuthoringConfig(undefined), {}); });

test('keeps AI output pending review and impossible to publish assign or activate', () => {
  const draft = unapprovedAiDraft('routineTranslation', { name: 'Suggestion' });
  assert.equal(draft.approvalStatus, 'pending_human_review'); assert.equal(draft.publishable, false); assert.equal(draft.assignable, false); assert.equal(draft.activatable, false);
});

test('records only bounded operational dimensions', () => {
  assert.deepEqual(Object.keys(aiAuthoringMetric('prescriptionExtraction', 'provider_failure', 999_999)).sort(), ['capability', 'latencyMs', 'model', 'promptVersion', 'provider', 'status']);
  assert.equal(aiAuthoringMetric('prescriptionExtraction', 'invalid_output', 999_999).latencyMs, 120_000);
});
