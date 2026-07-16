import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCheckNotificationPayload, buildReviewNotificationPayload, buildTestNotificationPayload, normalizePushPreferences, normalizePushSubscription } from './notifications.js';

test('normalizes bounded Web Push subscriptions', () => {
  const subscription = normalizePushSubscription({
    endpoint: 'https://push.example.test/send/device',
    keys: { p256dh: 'A'.repeat(87), auth: 'b'.repeat(22) },
    ignored: 'value',
  });
  assert.deepEqual(subscription, {
    endpoint: 'https://push.example.test/send/device',
    keys: { p256dh: 'A'.repeat(87), auth: 'b'.repeat(22) },
  });
  assert.equal(normalizePushSubscription({ endpoint: 'http://push.example.test', keys: { p256dh: 'A'.repeat(87), auth: 'b'.repeat(22) } }), undefined);
  assert.equal(normalizePushSubscription({ endpoint: `https://push.example.test/${'x'.repeat(4_100)}`, keys: { p256dh: 'A'.repeat(87), auth: 'b'.repeat(22) } }), undefined);
  assert.equal(normalizePushSubscription({ endpoint: 'https://push.example.test', keys: { p256dh: 'not valid', auth: 'short' } }), undefined);
});

test('normalizes push preference values before storage', () => {
  assert.deepEqual(normalizePushPreferences({ notificationWindowStart: '00:00', notificationWindowEnd: '23:59' }), {
    notificationWindowStart: '00:00',
    notificationWindowEnd: '23:59',
  });
  assert.deepEqual(normalizePushPreferences({ notificationWindowStart: '99:00', notificationWindowEnd: 'bad' }), {
    notificationWindowStart: '08:00',
    notificationWindowEnd: '21:00',
  });
  assert.equal(normalizePushPreferences(undefined), undefined);
});

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
    participantId: 'participant-alex',
    checkId: 'check-1',
    routineId: 'orthodontic-elastics',
    routineName: 'Orthodontic Elastics',
    routineNames: { fr: 'Élastiques orthodontiques' },
    routineIcon: '🦷',
    locale: 'fr',
  });

  assert.equal(payload.version, 2);
  assert.equal(payload.kind, 'review-needed');
  assert.equal(payload.participantId, 'participant-alex');
  assert.equal(payload.title, '🦷 Élastiques orthodontiques · à vérifier');
  assert.equal(payload.body, 'Une preuve attend votre validation.');
  assert.equal(payload.tag, 'review:check-1');
  assert.equal(payload.path, '/?open=review&participant=participant-alex&event=check-1');
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
