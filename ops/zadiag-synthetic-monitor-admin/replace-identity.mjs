import { createRequire } from 'node:module';
import { constants as fsConstants } from 'node:fs';
import { copyFile, readFile, rename, rm, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { migratedIdentityDocuments, replaceMonitorIdInEnvironment } from './identity-migration.mjs';

const require = createRequire(import.meta.url);
const firebaseAuth = require('../../node_modules/firebase-tools/lib/auth');
const project = process.env.ZADIAG_FIREBASE_PROJECT || 'zadiag-22482';
const oldMonitorId = process.env.ZADIAG_MONITOR_ID?.trim();
const newMonitorId = process.argv[2]?.trim();
const participantId = process.env.ZADIAG_MONITOR_PARTICIPANT_ID?.trim();
const environmentPath = process.env.ZADIAG_MONITOR_ENV_PATH?.trim();
const documentIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
if (!oldMonitorId || !newMonitorId || !participantId || !environmentPath
  || !documentIdPattern.test(oldMonitorId) || !documentIdPattern.test(newMonitorId) || !documentIdPattern.test(participantId)) {
  throw new Error('Source the monitor environment and pass the replacement Firebase UID.');
}

const account = firebaseAuth.getGlobalDefaultAccount();
const accessToken = (await firebaseAuth.getAccessToken(account.tokens.refresh_token, account.tokens.scopes || [])).access_token;
const documentNameRoot = `projects/${project}/databases/(default)/documents`;
const documentsRoot = `https://firestore.googleapis.com/v1/${documentNameRoot}`;
const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
const read = async (path) => {
  const response = await fetch(`${documentsRoot}/${path}`, { headers });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`Unable to read ${path}: ${response.status}`);
  return response.json();
};
const decode = (item) => {
  if (!item) return undefined;
  if ('nullValue' in item) return null;
  for (const key of ['stringValue', 'booleanValue', 'doubleValue']) {
    if (key in item) return item[key];
  }
  if ('integerValue' in item) return Number(item.integerValue);
  if ('timestampValue' in item) return { __firestoreTimestamp: item.timestampValue };
  if (item.mapValue) return Object.fromEntries(Object.entries(item.mapValue.fields || {}).map(([key, value]) => [key, decode(value)]));
  if (item.arrayValue) return (item.arrayValue.values || []).map(decode);
  return undefined;
};
const document = (raw) => raw && Object.fromEntries(Object.entries(raw.fields || {}).map(([key, value]) => [key, decode(value)]));
const value = (input) => {
  if (input === null || input === undefined) return { nullValue: null };
  if (typeof input === 'string') return { stringValue: input };
  if (typeof input === 'boolean') return { booleanValue: input };
  if (typeof input === 'number') return Number.isInteger(input) ? { integerValue: String(input) } : { doubleValue: input };
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };
  if (typeof input === 'object' && typeof input.__firestoreTimestamp === 'string') {
    return { timestampValue: input.__firestoreTimestamp };
  }
  if (typeof input === 'object') return { mapValue: { fields: fields(input) } };
  throw new Error(`Unsupported Firestore value: ${typeof input}`);
};
const fields = (input) => Object.fromEntries(Object.entries(input).map(([key, item]) => [key, value(item)]));
const update = (path, data, exists) => ({
  update: { name: `${documentNameRoot}/${path}`, fields: fields(data) },
  currentDocument: { exists },
});
const remove = (path) => ({ delete: `${documentNameRoot}/${path}` });

const paths = {
  participant: `participants/${participantId}`,
  oldMembership: `participants/${participantId}/memberships/${oldMonitorId}`,
  newMembership: `participants/${participantId}/memberships/${newMonitorId}`,
  oldParticipantRef: `users/${oldMonitorId}/participantRefs/${participantId}`,
  newParticipantRef: `users/${newMonitorId}/participantRefs/${participantId}`,
  oldSubscription: `participants/${participantId}/pushSubscriptions/${oldMonitorId}`,
  newSubscription: `participants/${participantId}/pushSubscriptions/${newMonitorId}`,
  newUser: `users/${newMonitorId}`,
  oldMonitor: `syntheticMonitors/${oldMonitorId}`,
  newMonitor: `syntheticMonitors/${newMonitorId}`,
};
const [participantRaw, membershipRaw, participantRefRaw, monitorRaw, newUserRaw, newMembership, newParticipantRef, newMonitor, newSubscription] = await Promise.all([
  read(paths.participant),
  read(paths.oldMembership),
  read(paths.oldParticipantRef),
  read(paths.oldMonitor),
  read(paths.newUser),
  read(paths.newMembership),
  read(paths.newParticipantRef),
  read(paths.newMonitor),
  read(paths.newSubscription),
]);
if (!participantRaw || !membershipRaw || !participantRefRaw || !monitorRaw) throw new Error('The current synthetic identity is incomplete.');
if (newMembership || newParticipantRef || newMonitor || newSubscription) throw new Error('The replacement identity is already in use.');
const newUserData = document(newUserRaw);
if (newUserData?.familyId || newUserData?.role) throw new Error('The replacement account already owns a legacy relationship.');

const now = new Date().toISOString();
const migrated = migratedIdentityDocuments({
  oldMonitorId,
  newMonitorId,
  participantId,
  participant: document(participantRaw),
  membership: document(membershipRaw),
  participantRef: document(participantRefRaw),
  monitor: document(monitorRaw),
  now,
});
const environment = await readFile(environmentPath, 'utf8');
const nextEnvironment = replaceMonitorIdInEnvironment(environment, oldMonitorId, newMonitorId);
const temporaryEnvironmentPath = `${environmentPath}.identity-migration`;
const environmentBackupPath = `${environmentPath}.before-identity-migration`;
await copyFile(environmentPath, environmentBackupPath, fsConstants.COPYFILE_EXCL);
await writeFile(temporaryEnvironmentPath, nextEnvironment, { mode: 0o600 });

try {
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:commit`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ writes: [
      update(paths.participant, migrated.participant, true),
      update(paths.newMembership, migrated.membership, false),
      update(paths.newParticipantRef, migrated.participantRef, false),
      update(paths.newUser, { ...newUserData, ...migrated.user }, Boolean(newUserRaw)),
      update(paths.newMonitor, migrated.monitor, false),
      remove(paths.oldMembership),
      remove(paths.oldParticipantRef),
      remove(paths.oldSubscription),
      remove(paths.oldMonitor),
    ] }),
  });
  if (!response.ok) throw new Error(`Identity migration commit failed with status ${response.status}.`);
  await rename(temporaryEnvironmentPath, environmentPath);
} catch (error) {
  await rm(temporaryEnvironmentPath, { force: true });
  throw error;
}

console.log(JSON.stringify({ migrated: true, participantPreserved: true, environmentUpdated: true }));
