import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import process from 'node:process';

const require = createRequire(import.meta.url);
const firebaseAuth = require('../../node_modules/firebase-tools/lib/auth');
const project = process.env.ZADIAG_FIREBASE_PROJECT || 'zadiag-22482';
const monitorId = process.env.ZADIAG_MONITOR_ID;
const receiptToken = process.env.ZADIAG_MONITOR_RECEIPT_TOKEN;
const receiptUrl = process.env.ZADIAG_MONITOR_RECEIPT_URL;
if (!monitorId || !receiptToken || !receiptUrl) throw new Error('Source Mayuri .zadiag-monitor/env before running sync-runtime.mjs');

const account = firebaseAuth.getGlobalDefaultAccount();
const accessToken = (await firebaseAuth.getAccessToken(account.tokens.refresh_token, account.tokens.scopes || [])).access_token;
const documentUrl = new URL(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/syntheticMonitors/${monitorId}`);
['receiptToken', 'receiptTokenHash', 'receiptUrl', 'enabled', 'updatedAt'].forEach((field) => documentUrl.searchParams.append('updateMask.fieldPaths', field));
const receiptTokenHash = createHash('sha256').update(receiptToken.trim().toUpperCase()).digest('hex');
const response = await fetch(documentUrl, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fields: {
      receiptToken: { stringValue: receiptToken },
      receiptTokenHash: { stringValue: receiptTokenHash },
      receiptUrl: { stringValue: receiptUrl },
      enabled: { booleanValue: true },
      updatedAt: { stringValue: new Date().toISOString() },
    },
  }),
});
if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
console.log(JSON.stringify({ monitorId, synchronized: true }));
