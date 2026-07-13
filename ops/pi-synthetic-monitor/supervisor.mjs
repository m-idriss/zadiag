import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { answerPendingCheck } from './synthetic-proof.mjs';

const required = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const chromiumPath = process.env.ZADIAG_MONITOR_CHROMIUM || '/usr/bin/chromium';
const appUrl = process.env.ZADIAG_MONITOR_APP_URL || 'https://www.zadiag.com';
const profileDir = required('ZADIAG_MONITOR_PROFILE_DIR');
const monitorId = required('ZADIAG_MONITOR_ID');
const receiptToken = required('ZADIAG_MONITOR_RECEIPT_TOKEN');
const receiptUrl = required('ZADIAG_MONITOR_RECEIPT_URL');
const heartbeatMs = Number(process.env.ZADIAG_MONITOR_HEARTBEAT_MS || 300_000);
const statePath = process.env.ZADIAG_MONITOR_STATE_PATH || resolve(profileDir, '..', 'handled-checks.json');

const log = (event, details = {}) => {
  process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), event, ...details })}\n`);
};

const context = await chromium.launchPersistentContext(profileDir, {
  executablePath: chromiumPath,
  headless: false,
  viewport: { width: 430, height: 820 },
  args: [
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--no-first-run',
    '--no-default-browser-check',
  ],
});

await context.grantPermissions(['notifications', 'camera'], { origin: new URL(appUrl).origin });
const page = context.pages()[0] || await context.newPage();
if (!page.url().startsWith(appUrl)) {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
}
log('chromium_started', { appUrl });

let consecutiveHealthFailures = 0;
const seenNotificationTags = new Set();
const processingCheckIds = new Set();
let checkState = {};
try {
  const persisted = JSON.parse(await readFile(statePath, 'utf8'));
  checkState = persisted?.checks && typeof persisted.checks === 'object' ? persisted.checks : {};
} catch (error) {
  if (error?.code !== 'ENOENT') log('check_state_load_failed', { error: String(error?.message ?? error).slice(0, 240) });
}
const persistCheckState = async () => {
  const entries = Object.entries(checkState)
    .sort(([, left], [, right]) => String(right?.updatedAt ?? '').localeCompare(String(left?.updatedAt ?? '')))
    .slice(0, 200);
  checkState = Object.fromEntries(entries);
  await mkdir(dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify({ checks: checkState }, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, statePath);
};
const sendReceipt = async (body) => {
  const receipt = await fetch(receiptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monitorId, token: receiptToken, ...body }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!receipt.ok) throw new Error(`Synthetic receipt returned ${receipt.status}`);
  if (receipt.status === 204) return {};
  return receipt.json().catch(() => ({}));
};

const renewPushSubscription = async () => {
  const unsubscribed = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
    const subscription = await registration?.pushManager.getSubscription().catch(() => null);
    return subscription ? subscription.unsubscribe() : true;
  });
  if (!unsubscribed) throw new Error('Unable to unsubscribe the stale Push endpoint');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(async () => {
    const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
    return Boolean(await registration?.pushManager.getSubscription().catch(() => null));
  }, undefined, { timeout: 30_000 });
  await page.waitForTimeout(5_000);
  log('push_subscription_renewed');
};

const heartbeat = async () => {
  try {
    if (page.isClosed()) throw new Error('Chromium page is closed');
    const health = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
      const subscription = await registration?.pushManager.getSubscription().catch(() => null);
      const notifications = registration
        ? await registration.getNotifications().catch(() => [])
        : [];
      return {
        url: location.href,
        controlled: Boolean(navigator.serviceWorker?.controller),
        subscription: Boolean(subscription),
        notifications: notifications.map((notification) => ({
          tag: notification.tag,
          kind: notification.data?.kind,
          checkId: notification.data?.checkId,
          sessionId: notification.data?.sessionId,
          routineId: notification.data?.routineId,
          path: notification.data?.path,
        })),
      };
    });
    if (!health.url.startsWith(appUrl)) await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    for (const notification of health.notifications) {
      const identity = notification.tag || JSON.stringify(notification);
      const receiptId = `notification-${createHash('sha256').update(identity).digest('hex').slice(0, 24)}`;
      if (!seenNotificationTags.has(identity)) {
        await sendReceipt({
          receiptId,
          stage: 'received',
          kind: notification.kind || 'browser-notification',
          checkId: notification.checkId,
          sessionId: notification.sessionId,
          routineId: notification.routineId,
        });
        seenNotificationTags.add(identity);
        log('push_received', { tag: notification.tag, kind: notification.kind });
      }
      const checkId = notification.checkId;
      const previous = checkId ? checkState[checkId] : undefined;
      const attempts = Number(previous?.attempts || 0);
      if (!checkId || previous?.status === 'completed' || attempts >= 3 || processingCheckIds.has(checkId)) continue;
      processingCheckIds.add(checkId);
      const startedAt = Date.now();
      checkState[checkId] = {
        status: 'processing',
        attempts: attempts + 1,
        updatedAt: new Date().toISOString(),
      };
      await persistCheckState();
      try {
        await sendReceipt({
          receiptId,
          stage: 'opened',
          kind: notification.kind || 'browser-notification',
          checkId,
          sessionId: notification.sessionId,
          routineId: notification.routineId,
        });
        const answer = await answerPendingCheck({ context, page, appUrl, path: notification.path });
        await page.evaluate(async (answeredCheckId) => {
          const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
          const notifications = await registration?.getNotifications().catch(() => []);
          notifications?.filter((item) => item.data?.checkId === answeredCheckId).forEach((item) => item.close());
        }, checkId);
        checkState[checkId] = {
          status: 'completed',
          attempts: attempts + 1,
          outcome: answer.outcome,
          durationMs: Date.now() - startedAt,
          updatedAt: new Date().toISOString(),
        };
        await persistCheckState();
        log('check_answered', { checkId, routineId: notification.routineId, outcome: answer.outcome, durationMs: Date.now() - startedAt });
      } catch (error) {
        checkState[checkId] = {
          status: attempts + 1 >= 3 ? 'failed' : 'retryable',
          attempts: attempts + 1,
          error: String(error?.message ?? error).slice(0, 240),
          updatedAt: new Date().toISOString(),
        };
        await persistCheckState();
        log('check_answer_failed', { checkId, attempts: attempts + 1, error: String(error?.message ?? error).slice(0, 240) });
      } finally {
        processingCheckIds.delete(checkId);
      }
    }
    const directive = await sendReceipt({
      receiptId: `heartbeat-${new Date().toISOString().slice(0, 13)}`,
      stage: 'heartbeat',
      kind: 'pi-browser',
    });
    if (directive.renewPushSubscription === true) await renewPushSubscription();
    consecutiveHealthFailures = 0;
    log('heartbeat_ok', { ...health, notifications: health.notifications.length });
  } catch (error) {
    consecutiveHealthFailures += 1;
    log('heartbeat_failed', { attempts: consecutiveHealthFailures, error: String(error?.message ?? error).slice(0, 240) });
    if (consecutiveHealthFailures >= 3) await context.close();
  }
};

const heartbeatTimer = setInterval(() => { void heartbeat(); }, heartbeatMs);
setTimeout(() => { void heartbeat(); }, 15_000);

let stopping = false;
const stop = async (signal) => {
  if (stopping) return;
  stopping = true;
  log('supervisor_stopping', { signal });
  clearInterval(heartbeatTimer);
  await context.close().catch(() => undefined);
};
process.on('SIGTERM', () => { void stop('SIGTERM'); });
process.on('SIGINT', () => { void stop('SIGINT'); });

await new Promise((resolve) => context.on('close', resolve));
clearInterval(heartbeatTimer);
log('chromium_exited');
process.exit(stopping ? 0 : 1);
