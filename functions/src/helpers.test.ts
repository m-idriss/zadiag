import assert from 'node:assert/strict';
import test from 'node:test';
import { assertChildName, createLinkCode, createRecoveryCode, createRelationshipInvitationCode, hashLinkCode, isFirestoreDocumentId, isFreshCheckSubmission, isLegacyRecoveryCode, isRecoveryCode, isRelationshipInvitationCode, normalizeLinkCode, sensitiveCodeAttemptState } from './helpers.js';

test('normalizes and hashes codes consistently', () => {
  assert.equal(normalizeLinkCode(' zd-123456 '), 'ZD-123456');
  assert.equal(hashLinkCode(' zd-123456 '), hashLinkCode('ZD-123456'));
});

test('creates a non-ambiguous code shape', () => {
  assert.match(createLinkCode(), /^ZD-\d{6}$/);
  assert.equal(isRecoveryCode(createRecoveryCode()), true);
  assert.equal(isRecoveryCode('PR-O0II-1111-AAAA'), false);
  assert.equal(isLegacyRecoveryCode('PR-123456'), true);
  assert.equal(isRelationshipInvitationCode(createRelationshipInvitationCode()), true);
  assert.equal(isRelationshipInvitationCode('ZD-123456'), false);
});

test('validates child names', () => {
  assert.equal(assertChildName(' Maya '), 'Maya');
  assert.throws(() => assertChildName(''));
});

test('accepts only safe Firestore document identifiers', () => {
  assert.equal(isFirestoreDocumentId('participant_123-abc'), true);
  assert.equal(isFirestoreDocumentId(''), false);
  assert.equal(isFirestoreDocumentId(' participant '), false);
  assert.equal(isFirestoreDocumentId('participants/other'), false);
  assert.equal(isFirestoreDocumentId('.'), false);
  assert.equal(isFirestoreDocumentId('..'), false);
  assert.equal(isFirestoreDocumentId('é'.repeat(751)), false);
});

test('limits sensitive code attempts inside a rolling window', () => {
  const now = Date.parse('2026-07-11T10:15:00.000Z');
  assert.deepEqual(sensitiveCodeAttemptState({ windowStartedAt: '2026-07-11T10:05:00.000Z', attempts: 4 }, now), {
    blocked: false,
    attempts: 5,
    windowStartedAt: '2026-07-11T10:05:00.000Z',
  });
  assert.equal(sensitiveCodeAttemptState({ windowStartedAt: '2026-07-11T10:05:00.000Z', attempts: 5 }, now).blocked, true);
  assert.deepEqual(sensitiveCodeAttemptState({ windowStartedAt: '2026-07-11T10:00:00.000Z', attempts: 99 }, now), {
    blocked: false,
    attempts: 1,
    windowStartedAt: '2026-07-11T10:15:00.000Z',
  });
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
  assert.equal(isFreshCheckSubmission({ ...pending, status: 'not_detected', capturedAt: '2026-07-02T07:59:00.000Z' }, '2026-07-02T08:00:00.000Z', now), true);
  assert.equal(isFreshCheckSubmission({ ...pending, status: 'uncertain', capturedAt: '2026-07-02T07:59:00.000Z' }, '2026-07-02T08:00:00.000Z', now), true);
  assert.equal(isFreshCheckSubmission({ ...pending, requestedAt: '2026-07-02T07:40:00.000Z', status: 'uncertain', capturedAt: '2026-07-02T07:44:00.000Z' }, '2026-07-02T08:00:00.000Z', now), false);
  assert.equal(isFreshCheckSubmission({ ...pending, expiresAt: '2026-07-02T07:59:00.000Z' }, '2026-07-02T07:58:00.000Z', now), false);
  assert.equal(isFreshCheckSubmission(pending, '2026-07-02T08:01:00.000Z', now), false);
  assert.equal(isFreshCheckSubmission({ ...pending, capturedAt: '2026-07-02T07:58:00.000Z' }, '2026-07-02T07:59:00.000Z', now), false);
});
