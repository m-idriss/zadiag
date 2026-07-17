import assert from 'node:assert/strict';
import test from 'node:test';
import { auditEventDocument, journeyEventId } from './audit.js';

test('builds a minimal audit event document', () => {
  const event = auditEventDocument({
    action: 'request_check',
    actorUid: 'parent-1',
    familyId: 'family-1',
    role: 'parent',
    metadata: { routineId: 'routine-1', resend: false },
  });

  assert.equal(event.action, 'request_check');
  assert.equal(event.actorUid, 'parent-1');
  assert.equal(event.familyId, 'family-1');
  assert.equal(event.role, 'parent');
  assert.deepEqual(event.metadata, { routineId: 'routine-1', resend: false });
  assert.match(event.occurredAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(event.createdAt);
});

test('deduplicates daily and check-scoped journey stages without exposing the source values', () => {
  assert.equal(journeyEventId('user-1', 'app_ready', undefined, '2026-07-17'), journeyEventId('user-1', 'app_ready', undefined, '2026-07-17'));
  assert.notEqual(journeyEventId('user-1', 'app_ready', undefined, '2026-07-17'), journeyEventId('user-1', 'app_ready', undefined, '2026-07-18'));
  assert.notEqual(journeyEventId('user-1', 'check_opened', 'check-1', '2026-07-17'), journeyEventId('user-1', 'check_opened', 'check-2', '2026-07-17'));
  assert.doesNotMatch(journeyEventId('user-1', 'check_opened', 'check-1', '2026-07-17'), /user|check/);
});

test('drops non-scalar audit metadata', () => {
  const event = auditEventDocument({
    action: 'submit_proof',
    actorUid: 'child-1',
    metadata: {
      checkId: 'check-1',
      ignoredObject: { private: true } as never,
      ignoredArray: ['proof'] as never,
      ignoredUndefined: undefined,
    },
  });

  assert.deepEqual(event.metadata, { checkId: 'check-1' });
});
