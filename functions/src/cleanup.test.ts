import assert from 'node:assert/strict';
import test from 'node:test';
import { expiredPendingCheckCleanupUpdate, expiredRewardSecretCutoff, shouldDeleteProofAfterReview, shouldNotifyMissedCheck, staleCleanupCutoffs } from './cleanup.js';

test('computes conservative stale cleanup cutoffs', () => {
  const cutoffs = staleCleanupCutoffs(new Date('2026-07-10T12:00:00.000Z'));

  assert.equal(cutoffs.expiredBefore, '2026-07-10T12:00:00.000Z');
  assert.equal(cutoffs.consumedBefore, '2026-07-09T12:00:00.000Z');
  assert.equal(cutoffs.recoveryAttemptBefore, '2026-07-09T12:00:00.000Z');
  assert.equal(cutoffs.pendingCheckExpiredBefore, '2026-07-10T11:00:00.000Z');
});

test('marks stale pending checks as missed without deleting history', () => {
  assert.deepEqual(expiredPendingCheckCleanupUpdate(new Date('2026-07-10T12:00:00.000Z')), {
    status: 'missed',
    missedReason: 'expired_pending_cleanup',
    updatedAt: '2026-07-10T12:00:00.000Z',
  });
});

test('deletes proof images after every completed responsible review', () => {
  assert.equal(shouldDeleteProofAfterReview('detected'), true);
  assert.equal(shouldDeleteProofAfterReview('not_detected'), true);
  assert.equal(shouldDeleteProofAfterReview('uncertain'), false);
});

test('uses the current instant to remove expired reward secrets', () => {
  const now = new Date('2026-07-24T08:00:00.000Z');
  assert.equal(expiredRewardSecretCutoff(now), now.toISOString());
});

test('notifies only checks that became missed recently', () => {
  const now = new Date('2026-08-01T08:00:00.000Z');
  assert.equal(shouldNotifyMissedCheck('2026-08-01T07:55:00.000Z', now), true);
  assert.equal(shouldNotifyMissedCheck('2026-08-01T07:49:59.999Z', now), false);
  assert.equal(shouldNotifyMissedCheck('2026-08-01T08:01:00.000Z', now), false);
  assert.equal(shouldNotifyMissedCheck('invalid', now), false);
});
