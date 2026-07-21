import { createRequire } from 'node:module';
import process from 'node:process';
import { ensureMonitorAppCheckDebugToken } from './app-check-debug.mjs';

const require = createRequire(import.meta.url);
const firebaseAuth = require('../../node_modules/firebase-tools/lib/auth');
const account = firebaseAuth.getGlobalDefaultAccount();
const accessToken = (await firebaseAuth.getAccessToken(account.tokens.refresh_token, account.tokens.scopes || [])).access_token;
const environmentPath = process.env.ZADIAG_MONITOR_ENV_PATH?.trim();
if (!environmentPath) throw new Error('Set ZADIAG_MONITOR_ENV_PATH to the monitor runtime environment file');
const result = await ensureMonitorAppCheckDebugToken({
  accessToken,
  environmentPath,
  projectNumber: process.env.ZADIAG_FIREBASE_PROJECT_NUMBER,
  appId: process.env.ZADIAG_FIREBASE_APP_ID,
});

console.log(JSON.stringify(result));
