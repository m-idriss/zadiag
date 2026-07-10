import assert from 'node:assert/strict';
import test from 'node:test';
import { expiredPendingCheckCleanupUpdate, staleCleanupCutoffs } from './cleanup.js';

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
