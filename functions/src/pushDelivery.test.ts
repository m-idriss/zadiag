import assert from 'node:assert/strict';
import test from 'node:test';
import { pushDeliveryGraceMs, shouldMarkPushUnconfirmed } from './pushDelivery.js';

test('marks an accepted push unconfirmed after the delivery grace period', () => {
  assert.equal(shouldMarkPushUnconfirmed({ expectedAtMs: 1_000, expectedReceiptId: 'receipt-1' }, 1_000 + pushDeliveryGraceMs), true);
});

test('keeps recent, received, and already-recovered pushes healthy', () => {
  assert.equal(shouldMarkPushUnconfirmed({ expectedAtMs: 1_000, expectedReceiptId: 'receipt-1' }, 1_000 + pushDeliveryGraceMs - 1), false);
  assert.equal(shouldMarkPushUnconfirmed({ expectedAtMs: 1_000, receivedAtMs: 2_000, expectedReceiptId: 'receipt-1' }, 1_000 + pushDeliveryGraceMs), false);
  assert.equal(shouldMarkPushUnconfirmed({ expectedAtMs: 1_000, expectedReceiptId: 'receipt-1', recoveryExpectedReceiptId: 'receipt-1' }, 1_000 + pushDeliveryGraceMs), false);
});
