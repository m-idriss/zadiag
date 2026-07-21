import assert from 'node:assert/strict';
import test from 'node:test';
import { AiAuthoringDisabledError, aiAuthoringApprovalValid, aiAuthoringCapabilityEnabled, aiAuthoringMetric, parseAiAuthoringConfig, requireAiAuthoringCapability, unapprovedAiDraft } from './aiAuthoring.js';

const approval = { id: 'approval-1', status: 'approved' as const, approvedAt: '2026-07-01T00:00:00.000Z', expiresAt: '2027-01-01T00:00:00.000Z', dpoApprovedBy: 'DPO Name', legalApprovedBy: 'Legal Name', securityApprovedBy: 'Security Name', provider: 'provider-contract-1', dataResidency: 'eu', capabilities: ['routineTranslation' as const] };

test('defaults every provider path to disabled and requires privacy approval', () => {
  assert.equal(aiAuthoringCapabilityEnabled(undefined, 'routineTranslation'), false);
  assert.equal(aiAuthoringCapabilityEnabled({ globalEnabled: true, capabilities: { routineTranslation: true } }, 'routineTranslation'), false);
  assert.equal(aiAuthoringCapabilityEnabled(undefined, 'dynamicQuizGeneration'), false);
  assert.throws(() => requireAiAuthoringCapability({ globalEnabled: false, approval, capabilities: { routineTranslation: true } }, 'routineTranslation'), AiAuthoringDisabledError);
  assert.equal(requireAiAuthoringCapability({ globalEnabled: true, approval, capabilities: { routineTranslation: true } }, 'routineTranslation').promptVersion, 'routine-translation-v1');
});

test('requires named unexpired approvals scoped to the capability', () => {
  const now = new Date('2026-07-18T00:00:00.000Z');
  assert.equal(aiAuthoringApprovalValid({ approval }, 'routineTranslation', now), true);
  assert.equal(aiAuthoringApprovalValid({ approval }, 'prescriptionExtraction', now), false);
  assert.equal(aiAuthoringApprovalValid({ approval: { ...approval, dpoApprovedBy: '' } }, 'routineTranslation', now), false);
  assert.equal(aiAuthoringApprovalValid({ approval: { ...approval, expiresAt: '2026-07-17T00:00:00.000Z' } }, 'routineTranslation', now), false);
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
