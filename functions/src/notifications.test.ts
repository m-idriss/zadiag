import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCheckNotification } from './notifications.js';

test('builds a concise French notification', () => {
  const notification = buildCheckNotification({ sessionId: 'abc', locale: 'fr', resend: false });

  assert.deepEqual(notification, {
    title: "C'est l'heure de faire une vérification",
    body: 'Prends une photo de tes élastiques.',
    tag: 'verification:abc',
  });
});

test('builds a concise English reminder notification', () => {
  const notification = buildCheckNotification({ sessionId: 'abc', locale: 'en', resend: true });

  assert.deepEqual(notification, {
    title: 'Time to do a check',
    body: 'Take a photo of your elastics.',
    tag: 'reminder:abc',
  });
});
