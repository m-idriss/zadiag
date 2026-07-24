import assert from 'node:assert/strict';
import test from 'node:test';
import { rewardPolicy } from './rewards.js';

test('accepts only bounded active or revoked reward policies', () => {
  assert.deepEqual(rewardPolicy({ status: 'active' }), { status: 'active', claimLifetimeHours: 24 });
  assert.deepEqual(rewardPolicy({ status: 'revoked', claimLifetimeHours: 168 }), { status: 'revoked', claimLifetimeHours: 168 });
  assert.equal(rewardPolicy({ status: 'active', claimLifetimeHours: 0 }), undefined);
  assert.equal(rewardPolicy({ status: 'active', claimLifetimeHours: 169 }), undefined);
  assert.equal(rewardPolicy({ status: 'active', expiresAt: 'not-a-date' }), undefined);
  assert.equal(rewardPolicy({ status: 'paused' }), undefined);
});
