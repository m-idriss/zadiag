import { strict as assert } from 'node:assert';
import { after, before, beforeEach, test } from 'node:test';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { cleanupExpiredRewardSecrets, deleteRoutineRewardSecrets, finalizeCheckWithReward } from './rewards.js';

const app = initializeApp({ projectId: 'demo-zadiag-rules' }, 'reward-integration');
const db = getFirestore(app);
db.settings({ host: process.env.FIRESTORE_EMULATOR_HOST, ssl: false });
const aggregateRef = db.collection('participants').doc('reward-participant');

before(async () => {
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST, 'Firestore emulator is required');
});

beforeEach(async () => {
  await db.recursiveDelete(aggregateRef);
  await aggregateRef.set({ displayName: 'Reward test' });
});

test('claims exactly one code when concurrent success transitions retry', async () => {
  const now = new Date('2026-07-24T08:00:00.000Z');
  const checkRef = aggregateRef.collection('checks').doc('check-1');
  const policyRef = aggregateRef.collection('rewardPolicies').doc('routine-1');
  await checkRef.set({ routineId: 'routine-1', status: 'pending' });
  await policyRef.set({ status: 'active', claimLifetimeHours: 24 });
  await policyRef.collection('rewardCodes').doc('code-a').set({ status: 'available', value: 'SECRET-A' });
  await policyRef.collection('rewardCodes').doc('code-b').set({ status: 'available', value: 'SECRET-B' });

  const results = await Promise.all([
    finalizeCheckWithReward(db, aggregateRef.path, checkRef.id, 'detected', now),
    finalizeCheckWithReward(db, aggregateRef.path, checkRef.id, 'detected', now),
  ]);
  assert.equal(results.every((result) => result?.status === 'claimed'), true);
  const [check, claim, codes] = await Promise.all([
    checkRef.get(),
    aggregateRef.collection('rewardClaims').doc(checkRef.id).get(),
    policyRef.collection('rewardCodes').get(),
  ]);
  assert.equal(check.data()?.reward.status, 'claimed');
  assert.equal(claim.data()?.value, 'SECRET-A');
  assert.equal(codes.docs.filter((code) => code.data().status === 'claimed').length, 1);
  assert.equal(codes.docs.find((code) => code.id === 'code-a')?.data().value, undefined);
  await policyRef.update({ status: 'revoked' });
  assert.equal((await finalizeCheckWithReward(db, aggregateRef.path, checkRef.id, 'detected', now))?.status, 'claimed');
  assert.equal((await checkRef.get()).data()?.status, 'detected');
});

test('does not claim for non-success and freezes explicit exhaustion, expiry and revocation outcomes', async () => {
  const now = new Date('2026-07-24T08:00:00.000Z');
  const policyRef = aggregateRef.collection('rewardPolicies').doc('routine-1');
  await policyRef.set({ status: 'active' });
  for (const [checkId, status] of [['failed', 'not_detected'], ['pending', 'pending'], ['uncertain', 'uncertain'], ['expired-check', 'expired'], ['missed', 'missed']] as const) {
    await aggregateRef.collection('checks').doc(checkId).set({ routineId: 'routine-1', status: 'pending' });
    assert.equal(await finalizeCheckWithReward(db, aggregateRef.path, checkId, status, now), undefined);
  }
  await aggregateRef.collection('checks').doc('exhausted').set({ routineId: 'routine-1', status: 'pending' });
  assert.equal((await finalizeCheckWithReward(db, aggregateRef.path, 'exhausted', 'detected', now))?.status, 'exhausted');
  await policyRef.set({ status: 'active', expiresAt: '2026-07-24T07:59:59.000Z' });
  await aggregateRef.collection('checks').doc('expired').set({ routineId: 'routine-1', status: 'pending' });
  assert.equal((await finalizeCheckWithReward(db, aggregateRef.path, 'expired', 'detected', now))?.status, 'expired');
  await policyRef.set({ status: 'revoked' });
  await aggregateRef.collection('checks').doc('revoked').set({ routineId: 'routine-1', status: 'pending' });
  assert.equal((await finalizeCheckWithReward(db, aggregateRef.path, 'revoked', 'detected', now))?.status, 'revoked');
});

test('deletes expired secrets without changing verification history or active claims', async () => {
  const policyRef = aggregateRef.collection('rewardPolicies').doc('routine-1');
  await aggregateRef.collection('checks').doc('check-1').set({ status: 'detected', reward: { status: 'claimed' } });
  await aggregateRef.collection('rewardClaims').doc('expired').set({ value: 'OLD', expiresAt: '2026-07-24T07:00:00.000Z' });
  await aggregateRef.collection('rewardClaims').doc('active').set({ value: 'CURRENT', expiresAt: '2026-07-24T09:00:00.000Z' });
  await policyRef.collection('rewardCodes').doc('expired').set({ status: 'available', value: 'OLD-CODE', expiresAt: '2026-07-24T07:00:00.000Z' });

  assert.equal(await cleanupExpiredRewardSecrets(db, new Date('2026-07-24T08:00:00.000Z')), 2);
  assert.equal((await aggregateRef.collection('rewardClaims').doc('expired').get()).exists, false);
  assert.equal((await policyRef.collection('rewardCodes').doc('expired').get()).exists, false);
  assert.equal((await aggregateRef.collection('rewardClaims').doc('active').get()).exists, true);
  assert.equal((await aggregateRef.collection('checks').doc('check-1').get()).data()?.status, 'detected');
});

test('deletes the policy, pool, and claims when its routine assignment is deleted', async () => {
  const policyRef = aggregateRef.collection('rewardPolicies').doc('routine-1');
  await policyRef.set({ status: 'active' });
  await policyRef.collection('rewardCodes').doc('code-1').set({ status: 'available', value: 'SECRET' });
  await aggregateRef.collection('rewardClaims').doc('check-1').set({ routineId: 'routine-1', value: 'CLAIM' });
  await aggregateRef.collection('rewardClaims').doc('other-check').set({ routineId: 'routine-2', value: 'OTHER' });

  assert.equal(await deleteRoutineRewardSecrets(db, aggregateRef.path, 'routine-1'), 1);
  assert.equal((await policyRef.get()).exists, false);
  assert.equal((await policyRef.collection('rewardCodes').doc('code-1').get()).exists, false);
  assert.equal((await aggregateRef.collection('rewardClaims').doc('check-1').get()).exists, false);
  assert.equal((await aggregateRef.collection('rewardClaims').doc('other-check').get()).exists, true);
});

after(async () => db.recursiveDelete(aggregateRef));
