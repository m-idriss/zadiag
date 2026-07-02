import assert from 'node:assert/strict';
import test from 'node:test';
import { assertChildName, createLinkCode, hashLinkCode, isFreshCheckSubmission, normalizeLinkCode } from './helpers.js';

test('normalizes and hashes codes consistently', () => {
  assert.equal(normalizeLinkCode(' zd-123456 '), 'ZD-123456');
  assert.equal(hashLinkCode(' zd-123456 '), hashLinkCode('ZD-123456'));
});

test('creates a non-ambiguous code shape', () => {
  assert.match(createLinkCode(), /^ZD-\d{6}$/);
});

test('validates child names', () => {
  assert.equal(assertChildName(' Maya '), 'Maya');
  assert.throws(() => assertChildName(''));
});

test('accepts only fresh pending check submissions', () => {
  const now = Date.parse('2026-07-02T08:00:00.000Z');
  const pending = {
    status: 'pending',
    requestedAt: '2026-07-02T07:55:00.000Z',
    expiresAt: '2026-07-02T08:05:00.000Z',
  };
  assert.equal(isFreshCheckSubmission(pending, '2026-07-02T07:59:59.000Z', now), true);
  assert.equal(isFreshCheckSubmission({ ...pending, status: 'detected' }, '2026-07-02T07:59:59.000Z', now), false);
  assert.equal(isFreshCheckSubmission({ ...pending, status: 'analyzing', capturedAt: '2026-07-02T07:59:00.000Z' }, '2026-07-02T07:59:00.000Z', now), true);
  assert.equal(isFreshCheckSubmission({ ...pending, expiresAt: '2026-07-02T07:59:00.000Z' }, '2026-07-02T07:58:00.000Z', now), false);
  assert.equal(isFreshCheckSubmission(pending, '2026-07-02T08:01:00.000Z', now), false);
  assert.equal(isFreshCheckSubmission({ ...pending, capturedAt: '2026-07-02T07:58:00.000Z' }, '2026-07-02T07:59:00.000Z', now), false);
});
