import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCheckNotificationPayload } from './notifications.js';

test('builds the current French check notification payload', () => {
  const payload = buildCheckNotificationPayload({
    sessionId: 'session-1',
    routineId: 'orthodontic-elastics',
    routineName: 'Orthodontic Elastics',
    routineNames: { fr: 'Élastiques orthodontiques' },
    resend: false,
    locale: 'fr',
  });

  assert.equal(payload.version, 2);
  assert.equal(payload.kind, 'check-ready');
  assert.equal(payload.title, 'Contrôle prêt');
  assert.equal(payload.body, 'Élastiques orthodontiques · envoie ta preuve.');
  assert.equal(payload.tag, 'verification:session-1');
});

test('builds the current English reminder notification payload', () => {
  const payload = buildCheckNotificationPayload({
    sessionId: 'session-2',
    routineId: 'orthodontic-elastics',
    routineName: 'Orthodontic Elastics',
    resend: true,
    locale: 'en',
  });

  assert.equal(payload.version, 2);
  assert.equal(payload.kind, 'check-reminder');
  assert.equal(payload.title, 'Reminder');
  assert.equal(payload.body, 'Orthodontic Elastics · check waiting.');
  assert.equal(payload.tag, 'reminder:session-2');
});
