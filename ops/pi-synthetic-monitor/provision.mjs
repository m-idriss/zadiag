import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import process from 'node:process';
import { createMembership } from '../../functions/lib/relationships.js';
import { createDefaultRoutineAssignment, DEFAULT_ROUTINE_ID } from '../../functions/lib/routines.js';
import { ensureMonitorAppCheckDebugToken } from './app-check-debug.mjs';

const require = createRequire(import.meta.url);
const firebaseAuth = require('../../node_modules/firebase-tools/lib/auth');
const project = process.env.ZADIAG_FIREBASE_PROJECT || 'zadiag-22482';
const ownerUid = process.argv[2]?.trim();
const monitorUid = process.argv[3]?.trim();
const contactEmail = process.env.ZADIAG_MONITOR_CONTACT_EMAIL?.trim();
if (!ownerUid || !monitorUid || !contactEmail) {
  throw new Error('Set ZADIAG_MONITOR_CONTACT_EMAIL and run: node ops/pi-synthetic-monitor/provision.mjs OWNER_UID MONITOR_UID');
}

const account = firebaseAuth.getGlobalDefaultAccount();
const accessToken = (await firebaseAuth.getAccessToken(account.tokens.refresh_token, account.tokens.scopes || [])).access_token;
const documentsRoot = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
const documentNameRoot = `projects/${project}/databases/(default)/documents`;
const commitUrl = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:commit`;
const receiptUrl = `https://europe-west1-${project}.cloudfunctions.net/recordSyntheticPushReceipt`;
const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };

const request = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok && response.status !== 404) throw new Error(`${response.status} ${await response.text()}`);
  return response.status === 404 ? undefined : response.json().catch(() => ({}));
};

const value = (input) => {
  if (input === null || input === undefined) return { nullValue: null };
  if (typeof input === 'string') return { stringValue: input };
  if (typeof input === 'boolean') return { booleanValue: input };
  if (typeof input === 'number') return Number.isInteger(input) ? { integerValue: String(input) } : { doubleValue: input };
  if (Array.isArray(input)) return { arrayValue: { values: input.map(value) } };
  if (typeof input === 'object') return { mapValue: { fields: fields(input) } };
  throw new Error(`Unsupported Firestore value: ${typeof input}`);
};
const fields = (input) => Object.fromEntries(
  Object.entries(input).filter(([, item]) => item !== undefined).map(([key, item]) => [key, value(item)]),
);
const update = (path, data) => ({
  update: { name: `${documentNameRoot}/${path}`, fields: fields(data) },
});

const existingMonitor = await request(`${documentsRoot}/syntheticMonitors/${monitorUid}`);
if (existingMonitor) throw new Error(`Synthetic monitor ${monitorUid} already exists`);

const now = new Date().toISOString();
const participantId = randomBytes(18).toString('base64url').slice(0, 20);
const auditId = randomBytes(18).toString('base64url').slice(0, 20);
const receiptToken = randomBytes(32).toString('base64url');
const receiptTokenHash = (await import('node:crypto')).createHash('sha256').update(receiptToken.trim().toUpperCase()).digest('hex');
const displayName = 'Nemu';
const ownerMembership = createMembership({ uid: ownerUid, role: 'owner', now });
const participantMembership = createMembership({ uid: monitorUid, role: 'participant', invitedBy: ownerUid, now });
const plan = {
  checksPerDay: 1,
  weekdays: [1, 2, 3, 4, 5, 6, 7],
  windows: [{ id: 'daily-probe', start: '00:01', end: '23:59' }],
  expiryMinutes: 120,
  timeZone: 'Europe/Paris',
};
const assignment = createDefaultRoutineAssignment(plan, now);

const writes = [
  update(`participants/${participantId}`, {
    displayName,
    userId: monitorUid,
    status: 'active',
    createdBy: ownerUid,
    relationshipModelVersion: 2,
    routineMigrationVersion: 1,
    synthetic: true,
    excludeFromAnalytics: true,
    syntheticMonitorUid: monitorUid,
    createdAt: now,
    updatedAt: now,
  }),
  update(`participants/${participantId}/memberships/${ownerUid}`, ownerMembership),
  update(`participants/${participantId}/memberships/${monitorUid}`, participantMembership),
  update(`participants/${participantId}/routineAssignments/${DEFAULT_ROUTINE_ID}`, assignment),
  update(`users/${ownerUid}/participantRefs/${participantId}`, {
    participantId,
    role: 'owner',
    status: 'active',
    synthetic: true,
    updatedAt: now,
  }),
  update(`users/${monitorUid}`, {
    relationshipModelVersion: 2,
    notificationsEnabled: false,
    synthetic: true,
    updatedAt: now,
  }),
  update(`users/${monitorUid}/participantRefs/${participantId}`, {
    participantId,
    role: 'participant',
    status: 'active',
    synthetic: true,
    updatedAt: now,
  }),
  update(`syntheticMonitors/${monitorUid}`, {
    enabled: true,
    participantId,
    ownerUid,
    displayName,
    receiptToken,
    receiptTokenHash,
    receiptUrl,
    createdAt: now,
    updatedAt: now,
  }),
  update(`auditEvents/${auditId}`, {
    action: 'create_participant',
    actorUid: ownerUid,
    participantId,
    metadata: { selfManaged: false, synthetic: true },
    occurredAt: now,
    createdAt: now,
  }),
];

await request(commitUrl, { method: 'POST', body: JSON.stringify({ writes }) });

const runtimeDirectory = new URL('../../.pi-monitor/', import.meta.url);
await mkdir(runtimeDirectory, { recursive: true, mode: 0o700 });
const profileDirectory = new URL('chromium/', runtimeDirectory).pathname;
const environment = [
  `ZADIAG_MONITOR_ID=${monitorUid}`,
  `ZADIAG_MONITOR_PARTICIPANT_ID=${participantId}`,
  `ZADIAG_MONITOR_RECEIPT_TOKEN=${receiptToken}`,
  `ZADIAG_MONITOR_RECEIPT_URL=${receiptUrl}`,
  `ZADIAG_MONITOR_CONTACT_EMAIL=${contactEmail}`,
  `ZADIAG_MONITOR_PROFILE_DIR=${profileDirectory}`,
  'ZADIAG_MONITOR_APP_URL=https://www.zadiag.com',
  'ZADIAG_MONITOR_DEBUG_PORT=9223',
].join('\n');
const environmentUrl = new URL('env', runtimeDirectory);
await writeFile(environmentUrl, `${environment}\n`, { mode: 0o600 });
await ensureMonitorAppCheckDebugToken({
  accessToken,
  environmentPath: environmentUrl.pathname,
  projectNumber: process.env.ZADIAG_FIREBASE_PROJECT_NUMBER,
  appId: process.env.ZADIAG_FIREBASE_APP_ID,
});

console.log(JSON.stringify({ participantId, monitorUid, ownerUid, displayName, receiptUrl }, null, 2));
