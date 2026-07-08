import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCheckNotificationPayload, buildReviewNotificationPayload, buildTestNotificationPayload } from './notifications.js';

test('builds the current French check notification payload', () => {
  const payload = buildCheckNotificationPayload({
    sessionId: 'session-1',
    routineId: 'orthodontic-elastics',
    routineName: 'Orthodontic Elastics',
    routineNames: { fr: 'Élastiques orthodontiques' },
    routineIcon: '🦷',
    resend: false,
    locale: 'fr',
  });

  assert.equal(payload.version, 2);
  assert.equal(payload.kind, 'check-ready');
  assert.equal(payload.title, '🦷 Élastiques orthodontiques · prêt');
  assert.equal(payload.body, 'Envoie ta preuve.');
  assert.equal(payload.tag, 'verification:session-1');
});

test('builds the current English reminder notification payload', () => {
  const payload = buildCheckNotificationPayload({
    sessionId: 'session-2',
    routineId: 'orthodontic-elastics',
    routineName: 'Orthodontic Elastics',
    routineIcon: '🦷',
    resend: true,
    locale: 'en',
  });

  assert.equal(payload.version, 2);
  assert.equal(payload.kind, 'check-reminder');
  assert.equal(payload.title, '🦷 Orthodontic Elastics · reminder');
  assert.equal(payload.body, 'Check waiting.');
  assert.equal(payload.tag, 'reminder:session-2');
});

test('builds a French review notification payload for responsible users only', () => {
  const payload = buildReviewNotificationPayload({
    checkId: 'check-1',
    routineId: 'orthodontic-elastics',
    routineName: 'Orthodontic Elastics',
    routineNames: { fr: 'Élastiques orthodontiques' },
    routineIcon: '🦷',
    locale: 'fr',
  });

  assert.equal(payload.version, 2);
  assert.equal(payload.kind, 'review-needed');
  assert.equal(payload.title, '🦷 Élastiques orthodontiques · à vérifier');
  assert.equal(payload.body, 'Une preuve attend votre validation.');
  assert.equal(payload.tag, 'review:check-1');
  assert.equal(payload.path, '/?open=review');
});

test('builds a localized test notification payload', () => {
  const payload = buildTestNotificationPayload({ locale: 'fr', role: 'parent' });

  assert.equal(payload.version, 2);
  assert.equal(payload.kind, 'test');
  assert.equal(payload.title, 'Notification test Zadiag');
  assert.equal(payload.body, 'Ce téléphone peut recevoir les notifications.');
  assert.equal(payload.tag, 'test:parent');
  assert.equal(payload.path, '/?open=settings');
});
