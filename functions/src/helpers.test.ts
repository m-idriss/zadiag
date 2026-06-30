import assert from 'node:assert/strict';
import test from 'node:test';
import { assertChildName, createLinkCode, hashLinkCode, normalizeLinkCode } from './helpers.js';

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
