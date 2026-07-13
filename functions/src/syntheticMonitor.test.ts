import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldRecoverSyntheticPush } from './syntheticMonitor.js';

test('requests recovery when an accepted synthetic push remains unconfirmed', () => {
  assert.equal(shouldRecoverSyntheticPush({ expectedAtMs: 1_000 }, 61_000), true);
});

test('waits for the delivery grace period', () => {
  assert.equal(shouldRecoverSyntheticPush({ expectedAtMs: 1_000 }, 60_999), false);
});

test('does not recover a received push or repeat recovery for the same dispatch', () => {
  assert.equal(shouldRecoverSyntheticPush({ expectedAtMs: 1_000, receivedAtMs: 1_001 }, 70_000), false);
  assert.equal(shouldRecoverSyntheticPush({ expectedAtMs: 1_000, recoveryRequestedAtMs: 1_001 }, 70_000), false);
});
