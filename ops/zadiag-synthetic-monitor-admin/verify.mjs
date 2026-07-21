import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);
const firebaseAuth = require('../../node_modules/firebase-tools/lib/auth');
const project = process.env.ZADIAG_FIREBASE_PROJECT || 'zadiag-22482';
const participantId = process.env.ZADIAG_MONITOR_PARTICIPANT_ID;
const monitorId = process.env.ZADIAG_MONITOR_ID;
if (!participantId || !monitorId) throw new Error('Source the monitor runtime environment before running verify.mjs');

const account = firebaseAuth.getGlobalDefaultAccount();
const accessToken = (await firebaseAuth.getAccessToken(account.tokens.refresh_token, account.tokens.scopes || [])).access_token;
const root = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const headers = { Authorization: `Bearer ${accessToken}` };
const request = async (path) => {
  const response = await fetch(`${root}/${path}`, { headers });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
};
const decode = (item) => {
  if (!item) return undefined;
  if ('nullValue' in item) return null;
  for (const key of ['stringValue', 'timestampValue', 'booleanValue', 'integerValue', 'doubleValue']) {
    if (key in item) return item[key];
  }
  if (item.mapValue) return Object.fromEntries(Object.entries(item.mapValue.fields || {}).map(([key, value]) => [key, decode(value)]));
  if (item.arrayValue) return (item.arrayValue.values || []).map(decode);
  return undefined;
};
const document = (raw) => raw && Object.fromEntries(Object.entries(raw.fields || {}).map(([key, value]) => [key, decode(value)]));

const [participant, subscription, monitor, receipts] = await Promise.all([
  request(`participants/${participantId}`),
  request(`participants/${participantId}/pushSubscriptions/${monitorId}`),
  request(`syntheticMonitors/${monitorId}`),
  request(`syntheticMonitors/${monitorId}/receipts?pageSize=100`),
]);
const monitorData = document(monitor);
delete monitorData?.receiptToken;
delete monitorData?.receiptTokenHash;
const subscriptionData = document(subscription);
delete subscriptionData?.endpoint;
delete subscriptionData?.keys;

console.log(JSON.stringify({
  participant: document(participant),
  subscription: subscriptionData,
  monitor: monitorData,
  receipts: (receipts?.documents || []).map(document),
}, null, 2));
