import { chromium } from 'playwright-core';
import { createHash } from 'node:crypto';
import process from 'node:process';

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

await context.grantPermissions(['notifications'], { origin: new URL(appUrl).origin });
const page = context.pages()[0] || await context.newPage();
if (!page.url().startsWith(appUrl)) {
  await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
}
log('chromium_started', { appUrl });

let consecutiveHealthFailures = 0;
const seenNotificationTags = new Set();
const sendReceipt = async (body) => {
  const receipt = await fetch(receiptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ monitorId, token: receiptToken, ...body }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!receipt.ok) throw new Error(`Synthetic receipt returned ${receipt.status}`);
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
        })),
      };
    });
    if (!health.url.startsWith(appUrl)) await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await sendReceipt({
      receiptId: `heartbeat-${new Date().toISOString().slice(0, 13)}`,
      stage: 'heartbeat',
      kind: 'pi-browser',
    });
    for (const notification of health.notifications) {
      const identity = notification.tag || JSON.stringify(notification);
      if (seenNotificationTags.has(identity)) continue;
      const receiptId = `notification-${createHash('sha256').update(identity).digest('hex').slice(0, 24)}`;
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
