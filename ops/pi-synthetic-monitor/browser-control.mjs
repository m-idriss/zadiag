import { chromium } from 'playwright-core';
import process from 'node:process';

const command = process.argv[2] || 'status';
const profileDir = process.env.ZADIAG_MONITOR_PROFILE_DIR
  || '/home/idriss/dev/zadiag/.pi-monitor/chromium';
const appUrl = process.env.ZADIAG_MONITOR_APP_URL || 'https://www.zadiag.com';

const context = await chromium.launchPersistentContext(profileDir, {
  executablePath: process.env.ZADIAG_MONITOR_CHROMIUM || '/usr/bin/chromium',
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
const diagnostics = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') diagnostics.push(`console:${message.type()}:${message.text()}`.slice(0, 500));
});
page.on('pageerror', (error) => diagnostics.push(`pageerror:${error.message}`.slice(0, 500)));
page.on('requestfailed', (request) => diagnostics.push(`requestfailed:${request.url()}:${request.failure()?.errorText}`.slice(0, 500)));
if (!page.url().startsWith(appUrl)) await page.goto(appUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
await page.waitForTimeout(4_000);

const readUid = () => page.evaluate(async () => {
  const databases = await indexedDB.databases();
  const firebaseDatabase = databases.find((database) => database.name === 'firebaseLocalStorageDb');
  if (!firebaseDatabase?.name) return null;
  return new Promise((resolve) => {
    const request = indexedDB.open(firebaseDatabase.name);
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      if (![...db.objectStoreNames].includes('firebaseLocalStorage')) return resolve(null);
      const all = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').getAll();
      all.onerror = () => resolve(null);
      all.onsuccess = () => {
        const user = all.result.map((entry) => entry?.value).find((value) => value?.uid);
        resolve(user?.uid ?? null);
      };
    };
  });
});

const status = async () => page.evaluate(async () => {
  const registration = await navigator.serviceWorker?.ready.catch(() => undefined);
  const subscription = await registration?.pushManager.getSubscription().catch(() => null);
  return {
    url: location.href,
    title: document.title,
    notificationPermission: 'Notification' in globalThis ? Notification.permission : 'unsupported',
    serviceWorker: navigator.serviceWorker?.controller ? 'controlled' : 'uncontrolled',
    subscription: subscription ? { endpointPresent: true, endpointHost: new URL(subscription.endpoint).hostname } : { endpointPresent: false },
    text: document.body?.innerText?.replace(/\s+/g, ' ').slice(0, 500) ?? '',
  };
});

let result;
if (command === 'uid') {
  result = { uid: await readUid() };
} else if (command === 'renew-push') {
  const unsubscribed = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? subscription.unsubscribe() : true;
  });
  if (!unsubscribed) throw new Error('Unable to unsubscribe the stale Push endpoint');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(async () => {
    const activeRegistration = await navigator.serviceWorker?.ready.catch(() => undefined);
    return Boolean(await activeRegistration?.pushManager.getSubscription().catch(() => null));
  }, undefined, { timeout: 30_000 });
  await page.waitForTimeout(5_000);
  result = { uid: await readUid(), renewed: true, ...await status(), diagnostics };
} else if (command === 'activate') {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(5_000);
  const button = page.getByRole('button', { name: /Autoriser les notifications|Allow notifications/i });
  if (await button.count()) {
    await button.first().click();
    await page.waitForTimeout(8_000);
  }
  result = { uid: await readUid(), ...await status(), diagnostics };
} else {
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(6_000);
  result = { uid: await readUid(), ...await status(), diagnostics };
}

console.log(JSON.stringify(result, null, 2));
await context.close();
