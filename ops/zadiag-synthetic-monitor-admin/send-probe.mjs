import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import process from 'node:process';
import { buildTestNotificationPayload } from '../../functions/lib/notifications.js';

const require = createRequire(import.meta.url);
const firebaseAuth = require('../../node_modules/firebase-tools/lib/auth');
const webpush = require('../../functions/node_modules/web-push');
const project = process.env.ZADIAG_FIREBASE_PROJECT || 'zadiag-22482';
const participantId = process.env.ZADIAG_MONITOR_PARTICIPANT_ID;
const monitorId = process.env.ZADIAG_MONITOR_ID;
if (!participantId || !monitorId) throw new Error('Source the monitor runtime environment before running send-probe.mjs');

const account = firebaseAuth.getGlobalDefaultAccount();
const accessToken = (await firebaseAuth.getAccessToken(account.tokens.refresh_token, account.tokens.scopes || [])).access_token;
const headers = { Authorization: `Bearer ${accessToken}` };
const decode = (item) => {
  if (!item) return undefined;
  for (const key of ['stringValue', 'booleanValue', 'integerValue', 'doubleValue']) if (key in item) return item[key];
  if (item.mapValue) return Object.fromEntries(Object.entries(item.mapValue.fields || {}).map(([key, value]) => [key, decode(value)]));
  return undefined;
};
const firestoreDocument = async (path) => {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/${path}`, { headers });
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${await response.text()}`);
  const document = await response.json();
  return Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decode(value)]));
};
const secret = async (name) => {
  const response = await fetch(`https://secretmanager.googleapis.com/v1/projects/${project}/secrets/${name}/versions/latest:access`, { headers });
  if (!response.ok) throw new Error(`Secret Manager ${response.status}: ${await response.text()}`);
  const result = await response.json();
  return Buffer.from(result.payload.data, 'base64').toString('utf8');
};

const [subscription, monitor, publicKey, privateKey] = await Promise.all([
  firestoreDocument(`participants/${participantId}/pushSubscriptions/${monitorId}`),
  firestoreDocument(`syntheticMonitors/${monitorId}`),
  secret('WEB_PUSH_VAPID_PUBLIC_KEY'),
  secret('WEB_PUSH_VAPID_PRIVATE_KEY'),
]);
if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) throw new Error('Synthetic monitor push subscription is incomplete');
if (!monitor.receiptToken || !monitor.receiptUrl) throw new Error('Synthetic monitor receipt configuration is incomplete');

const receiptId = randomUUID();
const payload = {
  ...buildTestNotificationPayload({ locale: subscription.locale, role: 'child' }),
  syntheticReceipt: {
    monitorId,
    receiptId,
    token: monitor.receiptToken,
    url: monitor.receiptUrl,
  },
};
webpush.setVapidDetails('https://www.zadiag.com', publicKey.trim(), privateKey.trim());
const response = await webpush.sendNotification({
  endpoint: subscription.endpoint,
  keys: subscription.keys,
}, JSON.stringify(payload), { TTL: 120 });

console.log(JSON.stringify({ monitorId, participantId, receiptId, pushStatusCode: response.statusCode }));
