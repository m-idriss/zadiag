import assert from 'node:assert/strict';
import test from 'node:test';
import { rewardClaimForReveal, rewardPolicy, rewardPoolInput } from './rewards.js';

test('accepts only bounded active or revoked reward policies', () => {
  assert.deepEqual(rewardPolicy({ status: 'active' }), { status: 'active', claimLifetimeHours: 24 });
  assert.deepEqual(rewardPolicy({ status: 'revoked', claimLifetimeHours: 168 }), { status: 'revoked', claimLifetimeHours: 168 });
  assert.equal(rewardPolicy({ status: 'active', claimLifetimeHours: 0 }), undefined);
  assert.equal(rewardPolicy({ status: 'active', claimLifetimeHours: 169 }), undefined);
  assert.equal(rewardPolicy({ status: 'active', expiresAt: 'not-a-date' }), undefined);
  assert.equal(rewardPolicy({ status: 'paused' }), undefined);
});

test('accepts only bounded unique non-empty reward code imports', () => {
  assert.deepEqual(rewardPoolInput({ codes: [' CODE-A ', 'CODE-B'], claimLifetimeHours: 48 }), {
    codes: ['CODE-A', 'CODE-B'],
    claimLifetimeHours: 48,
  });
  assert.equal(rewardPoolInput({ codes: [] }), undefined);
  assert.equal(rewardPoolInput({ codes: ['CODE', 'CODE'] }), undefined);
  assert.equal(rewardPoolInput({ codes: [''] }), undefined);
  assert.equal(rewardPoolInput({ codes: ['x'.repeat(241)] }), undefined);
  assert.equal(rewardPoolInput({ codes: Array.from({ length: 101 }, (_, index) => `CODE-${index}`) }), undefined);
});

test('reveals only the active claim attached to a successful check', () => {
  const now = new Date('2026-07-24T08:00:00.000Z');
  const successful = { status: 'detected', reward: { status: 'claimed', resolvedAt: now.toISOString() } };
  assert.deepEqual(rewardClaimForReveal({ status: 'pending' }, { value: 'SECRET', expiresAt: '2026-07-24T09:00:00.000Z' }, now), { status: 'unavailable' });
  assert.deepEqual(rewardClaimForReveal(successful, { value: 'SECRET', expiresAt: '2026-07-24T07:00:00.000Z' }, now), { status: 'expired' });
  assert.deepEqual(rewardClaimForReveal({ status: 'detected', reward: { status: 'exhausted', resolvedAt: now.toISOString() } }, undefined, now), { status: 'exhausted' });
  assert.deepEqual(rewardClaimForReveal(successful, { value: 'SECRET', expiresAt: '2026-07-24T09:00:00.000Z' }, now), {
    status: 'claimed',
    value: 'SECRET',
    expiresAt: '2026-07-24T09:00:00.000Z',
  });
});
