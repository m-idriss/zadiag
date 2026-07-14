import { createRequire } from 'node:module';
import process from 'node:process';
import { ensureMonitorAppCheckDebugToken } from './app-check-debug.mjs';

const require = createRequire(import.meta.url);
const firebaseAuth = require('../../node_modules/firebase-tools/lib/auth');
const account = firebaseAuth.getGlobalDefaultAccount();
const accessToken = (await firebaseAuth.getAccessToken(account.tokens.refresh_token, account.tokens.scopes || [])).access_token;
const environmentPath = new URL('../../.pi-monitor/env', import.meta.url).pathname;
const result = await ensureMonitorAppCheckDebugToken({
  accessToken,
  environmentPath,
  projectNumber: process.env.ZADIAG_FIREBASE_PROJECT_NUMBER,
  appId: process.env.ZADIAG_FIREBASE_APP_ID,
});

console.log(JSON.stringify(result));
