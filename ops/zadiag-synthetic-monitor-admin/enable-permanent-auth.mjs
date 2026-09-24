import { createRequire } from 'node:module';
import { constants as fsConstants } from 'node:fs';
import { copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import process from 'node:process';
import { withPermanentMonitorAuth } from './permanent-auth-config.mjs';

const require = createRequire(import.meta.url);
const firebaseAuth = require('../../node_modules/firebase-tools/lib/auth');
const project = process.env.ZADIAG_FIREBASE_PROJECT || 'zadiag-22482';
const monitorId = process.env.ZADIAG_MONITOR_ID?.trim();
const environmentPath = process.env.ZADIAG_MONITOR_ENV_PATH?.trim();
const documentIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
if (!monitorId || !documentIdPattern.test(monitorId) || !environmentPath) {
  throw new Error('Source the monitor environment and set ZADIAG_MONITOR_ENV_PATH.');
}

const account = firebaseAuth.getGlobalDefaultAccount();
const accessToken = (await firebaseAuth.getAccessToken(account.tokens.refresh_token, account.tokens.scopes || [])).access_token;
const email = `nemu-${monitorId.slice(0, 12).toLowerCase()}@synthetic.zadiag.com`;
const password = randomBytes(48).toString('base64url');
const probeUrl = `https://europe-west1-${project}.cloudfunctions.net/requestSyntheticPushProbe`;
const response = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:update`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ localId: monitorId, email, password, emailVerified: true }),
});
if (!response.ok) throw new Error(`Permanent Firebase account update failed with status ${response.status}.`);
const result = await response.json();
if (result.localId !== monitorId || result.email?.toLowerCase() !== email) {
  throw new Error('Permanent Firebase account update returned an unexpected identity.');
}

const environment = await readFile(environmentPath, 'utf8');
const nextEnvironment = withPermanentMonitorAuth(environment, { email, password, probeUrl });
const temporaryPath = `${environmentPath}.permanent-auth`;
const backupPath = `${environmentPath}.before-permanent-auth`;
await copyFile(environmentPath, backupPath, fsConstants.COPYFILE_EXCL).catch((error) => {
  if (error?.code !== 'EEXIST') throw error;
});
try {
  await writeFile(temporaryPath, nextEnvironment, { mode: 0o600 });
  await rename(temporaryPath, environmentPath);
} catch (error) {
  await rm(temporaryPath, { force: true });
  throw error;
}

console.log(JSON.stringify({ permanent: true, identityPreserved: true, environmentUpdated: true }));
