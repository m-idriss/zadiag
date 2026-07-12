import assert from 'node:assert/strict';
import test from 'node:test';
import { isCheckRequestRateLimited } from './reminders.js';

test('rate limits duplicate manual check requests inside the cooldown', () => {
  const now = Date.parse('2026-07-11T10:00:10.000Z');
  assert.equal(isCheckRequestRateLimited('2026-07-11T10:00:00.001Z', now), true);
  assert.equal(isCheckRequestRateLimited('2026-07-11T10:00:00.000Z', now), false);
  assert.equal(isCheckRequestRateLimited('invalid', now), false);
  assert.equal(isCheckRequestRateLimited('2026-07-11T10:00:11.000Z', now), false);
});
