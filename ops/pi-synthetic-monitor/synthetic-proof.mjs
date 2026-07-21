import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PI_HEALTH_ROUTINE_IDS = new Set(['nemu-health', 'raspberry-pi-health']);
const PI_CONNECTIVITY_ROUTINE_IDS = new Set(['raspberry-pi-connectivity']);
const PI_HEALTH_ROUTINE_NAME_PATTERN = /Santé du Raspberry Pi|Raspberry Pi Health/i;
const PI_CONNECTIVITY_ROUTINE_NAME_PATTERN = /Connectivité du Raspberry Pi|Raspberry Pi Connectivity/i;
const SUPPORTED_ROUTINE_NAME_PATTERN = /Santé du Raspberry Pi|Raspberry Pi Health|Connectivité du Raspberry Pi|Raspberry Pi Connectivity/i;
const resultPattern = /Validated|Validé|Not detected|Non détecté|Needs review|À vérifier/i;
const analyzingPattern = /Checking the photo|Analyse de la photo|Vérification de la photo/i;
const cameraEnabledContexts = new WeakSet();

const installSyntheticCamera = (context) => {
  if (cameraEnabledContexts.has(context)) return Promise.resolve();
  cameraEnabledContexts.add(context);
  return context.addInitScript(() => {
  const originalMediaDevices = navigator.mediaDevices;
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      ...originalMediaDevices,
      getUserMedia: async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 360;
        canvas.height = 480;
        const draw = () => {
          const drawing = canvas.getContext('2d');
          if (!drawing) return;
          const evidence = globalThis.__ZADIAG_SYNTHETIC_EVIDENCE__ ?? globalThis.__ZADIAG_NEMU_HEALTH__;
          if (['nemu-health', 'raspberry-pi-health', 'raspberry-pi-connectivity'].includes(globalThis.__ZADIAG_SYNTHETIC_ROUTINE_ID__) && evidence) {
            drawing.fillStyle = '#9fbeb6';
            drawing.fillRect(0, 0, canvas.width, canvas.height);
            drawing.fillStyle = '#123b35';
            drawing.font = `bold ${evidence.title?.length > 24 ? 21 : 26}px sans-serif`;
            drawing.fillText(evidence.title ?? 'Raspberry Pi Health', 18, 48);
            drawing.font = '15px sans-serif';
            drawing.fillStyle = '#48645f';
            drawing.fillText(evidence.timestamp, 18, 76);
            evidence.rows.forEach((row, index) => {
              const y = 102 + index * 54;
              drawing.fillStyle = '#bfd3ce';
              drawing.fillRect(14, y, 332, 44);
              drawing.fillStyle = row.status === 'ok' ? '#16866f' : row.status === 'warning' ? '#c77b12' : '#c43d3d';
              drawing.beginPath();
              drawing.arc(34, y + 22, 8, 0, Math.PI * 2);
              drawing.fill();
              drawing.fillStyle = '#183b35';
              drawing.font = 'bold 15px sans-serif';
              drawing.fillText(row.label, 52, y + 27);
              drawing.font = '15px sans-serif';
              drawing.textAlign = 'right';
              drawing.fillText(row.value, 332, y + 27);
              drawing.textAlign = 'left';
            });
            drawing.fillStyle = '#48645f';
            drawing.font = '13px sans-serif';
            drawing.fillText('Zadiag synthetic operational proof', 18, 458);
            return;
          }
          drawing.fillStyle = '#eef8f5';
          drawing.fillRect(0, 0, canvas.width, canvas.height);
          drawing.fillStyle = '#123b35';
          drawing.font = 'bold 28px sans-serif';
        drawing.fillText('No supported routine selected', 18, 245);
        };
        draw();
        const timer = window.setInterval(draw, 250);
        const stream = canvas.captureStream(8);
        stream.getTracks().forEach((track) => track.addEventListener('ended', () => window.clearInterval(timer), { once: true }));
        return stream;
      },
    },
  });
  Object.defineProperty(globalThis, 'FaceDetector', {
    configurable: true,
    value: class SyntheticFaceDetector {
      async detect() {
        return [{ boundingBox: new DOMRectReadOnly(45, 60, 270, 350) }];
      }
    },
  });
  });
};

export const resolveSyntheticRoutineId = ({ routineId, pageText = '' }) => {
  if (PI_HEALTH_ROUTINE_IDS.has(routineId)) return routineId;
  if (PI_CONNECTIVITY_ROUTINE_IDS.has(routineId)) return routineId;
  if (PI_HEALTH_ROUTINE_NAME_PATTERN.test(pageText)) return 'raspberry-pi-health';
  if (PI_CONNECTIVITY_ROUTINE_NAME_PATTERN.test(pageText)) return 'raspberry-pi-connectivity';
  return undefined;
};

const percentageStatus = (value, warning, failure) => value >= failure ? 'failure' : value >= warning ? 'warning' : 'ok';

export const collectNemuHealth = async () => {
  const memoryPercent = Math.round((1 - os.freemem() / os.totalmem()) * 100);
  const cpuCount = Math.max(os.cpus().length, 1);
  const loadPercent = Math.round((os.loadavg()[0] / cpuCount) * 100);
  const temperature = await readFile('/sys/class/thermal/thermal_zone0/temp', 'utf8')
    .then((value) => Math.round(Number(value.trim()) / 1000))
    .catch(() => undefined);
  const diskPercent = await execFileAsync('df', ['-P', '/'])
    .then(({ stdout }) => Number(stdout.trim().split('\n').at(-1)?.match(/(\d+)%/)?.[1]))
    .catch(() => NaN);
  const docker = await execFileAsync('docker', ['ps', '--format', '{{.Status}}'])
    .then(({ stdout }) => stdout.trim().split('\n').filter(Boolean))
    .catch(() => []);
  const unhealthyContainers = docker.filter((status) => !/^Up\b/.test(status) || /unhealthy/i.test(status)).length;
  return {
    title: 'Raspberry Pi Health',
    timestamp: new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Paris' }).format(new Date()),
    rows: [
      { label: 'Mémoire', value: `${memoryPercent}%`, status: percentageStatus(memoryPercent, 80, 92) },
      { label: 'Charge CPU', value: `${loadPercent}%`, status: percentageStatus(loadPercent, 80, 120) },
      { label: 'Disque', value: Number.isFinite(diskPercent) ? `${diskPercent}%` : 'indisponible', status: Number.isFinite(diskPercent) ? percentageStatus(diskPercent, 80, 92) : 'warning' },
      { label: 'Température', value: temperature === undefined ? 'indisponible' : `${temperature}°C`, status: temperature === undefined ? 'warning' : percentageStatus(temperature, 70, 80) },
      { label: 'Docker', value: `${docker.length} actifs`, status: unhealthyContainers ? 'failure' : docker.length ? 'ok' : 'warning' },
      { label: 'Agent', value: 'service actif', status: 'ok' }
    ]
  };
};

const latencyStatus = (latencyMs, warningMs, failureMs) => latencyMs >= failureMs ? 'failure' : latencyMs >= warningMs ? 'warning' : 'ok';
const boundedLatency = (startedAt, clock) => Math.max(0, Math.min(99_999, Math.round(clock() - startedAt)));

export const collectPiConnectivity = async ({
  execFileImpl = execFileAsync,
  fetchImpl = fetch,
  readFileImpl = readFile,
  clock = () => Date.now(),
  now = new Date(),
} = {}) => {
  const route = await execFileImpl('ip', ['route', 'show', 'default'])
    .then(({ stdout }) => stdout.trim())
    .catch(() => '');
  const interfaceName = route.match(/\bdev\s+([a-zA-Z0-9_.:-]+)/)?.[1];
  const gateway = route.match(/\bvia\s+([0-9a-fA-F:.]+)/)?.[1];
  const interfaceState = interfaceName
    ? await readFileImpl(`/sys/class/net/${interfaceName}/operstate`, 'utf8').then((value) => value.trim()).catch(() => 'indisponible')
    : 'indisponible';

  const gatewayStartedAt = clock();
  const gatewayOk = gateway
    ? await execFileImpl('ping', ['-c', '1', '-W', '2', gateway]).then(() => true).catch(() => false)
    : false;
  const gatewayLatency = boundedLatency(gatewayStartedAt, clock);

  const dnsStartedAt = clock();
  const dnsOk = await execFileImpl('getent', ['ahosts', 'www.zadiag.com'])
    .then(({ stdout }) => Boolean(stdout.trim()))
    .catch(() => false);
  const dnsLatency = boundedLatency(dnsStartedAt, clock);

  const httpsStartedAt = clock();
  const httpsStatus = await fetchImpl('https://www.zadiag.com/app-version.json', { signal: AbortSignal.timeout(8_000), cache: 'no-store' })
    .then((response) => response.ok ? response.status : response.status || 0)
    .catch(() => 0);
  const httpsLatency = boundedLatency(httpsStartedAt, clock);

  const ntpSynchronized = await execFileImpl('timedatectl', ['show', '--property=NTPSynchronized', '--value'])
    .then(({ stdout }) => stdout.trim().toLowerCase() === 'yes')
    .catch(() => false);

  return {
    title: 'Raspberry Pi Connectivity',
    timestamp: new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Paris' }).format(now),
    rows: [
      { label: 'Interface', value: interfaceName ? `${interfaceName} · ${interfaceState}` : 'indisponible', status: interfaceState === 'up' ? 'ok' : interfaceState === 'unknown' ? 'warning' : 'failure' },
      { label: 'Passerelle', value: gatewayOk ? `${gatewayLatency} ms` : 'injoignable', status: gatewayOk ? latencyStatus(gatewayLatency, 250, 1_000) : 'failure' },
      { label: 'DNS', value: dnsOk ? `résolu · ${dnsLatency} ms` : 'échec', status: dnsOk ? latencyStatus(dnsLatency, 500, 2_000) : 'failure' },
      { label: 'Zadiag HTTPS', value: httpsStatus ? `HTTP ${httpsStatus} · ${httpsLatency} ms` : 'injoignable', status: httpsStatus === 200 ? latencyStatus(httpsLatency, 1_500, 4_000) : 'failure' },
      { label: 'Horloge NTP', value: ntpSynchronized ? 'synchronisée' : 'non synchronisée', status: ntpSynchronized ? 'ok' : 'warning' },
      { label: 'Agent', value: 'service actif', status: 'ok' },
    ],
  };
};

const collectEvidenceForRoutine = (routineId) => routineId === 'raspberry-pi-connectivity'
  ? collectPiConnectivity()
  : collectNemuHealth();

const completeSyntheticOnboarding = async ({ page, contactEmail }) => {
  const contactInput = page.getByRole('textbox', { name: /Contact email|E-mail de contact/i }).first();
  if (await contactInput.isVisible().catch(() => false)) {
    if (!contactEmail) throw new Error('Synthetic monitor contact email is required');
    await contactInput.fill(contactEmail);
    await page.getByRole('button', { name: /Continue|Continuer/i }).first().click();
    await page.waitForLoadState('domcontentloaded').catch(() => undefined);
  }
  const declinePilot = page.getByRole('button', { name: /Continue without participating|Continuer sans participer/i }).first();
  if (await declinePilot.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false)) {
    await declinePilot.click();
  }
};

export const answerPendingCheck = async ({ context, page, appUrl, path, contactEmail, routineId, evidence, healthEvidence, proofWaitMs = 20_000 }) => {
  await installSyntheticCamera(context);
  let destination = new URL('/', appUrl);
  try {
    const candidate = new URL(path || '/', appUrl);
    if (candidate.origin === new URL(appUrl).origin) destination = candidate;
  } catch {
    // Keep the application root for malformed notification paths.
  }
  await page.goto(destination.href, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await completeSyntheticOnboarding({ page, contactEmail });
  const routineCard = routineId
    ? page.locator(`.today-routine-card[data-routine-id=${JSON.stringify(routineId)}]`).first()
    : page.locator('.today-routine-card').filter({ hasText: SUPPORTED_ROUTINE_NAME_PATTERN }).first();
  const proofButton = routineCard.getByRole('button', { name: /Proof|Preuve/i }).first();
  try {
    await proofButton.waitFor({ state: 'visible', timeout: proofWaitMs });
  } catch {
    return { outcome: 'already_settled' };
  }
  const pageText = await routineCard.innerText();
  const resolvedRoutineId = resolveSyntheticRoutineId({ routineId, pageText });
  if (!resolvedRoutineId) return { outcome: 'unsupported_routine' };
  const currentEvidence = evidence ?? healthEvidence ?? await collectEvidenceForRoutine(resolvedRoutineId);
  await page.evaluate(({ currentRoutineId, currentEvidence }) => {
    globalThis.__ZADIAG_SYNTHETIC_ROUTINE_ID__ = currentRoutineId;
    globalThis.__ZADIAG_SYNTHETIC_EVIDENCE__ = currentEvidence;
    globalThis.__ZADIAG_NEMU_HEALTH__ = currentEvidence;
  }, { currentRoutineId: resolvedRoutineId, currentEvidence });
  await proofButton.click();
  await page.waitForFunction(() => {
    const video = document.querySelector('video');
    return Boolean(video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0 && video.videoHeight > 0);
  }, undefined, { timeout: 20_000 });
  await page.locator('button.shutter').click({ timeout: 20_000 });
  await page.locator('.camera-preview').waitFor({ state: 'visible', timeout: 20_000 });
  await page.getByRole('button', { name: /Use photo|Utiliser la photo/i }).click({ timeout: 20_000 });
  const submission = await page.waitForFunction(({ analyzingSource }) => {
    const text = document.body?.innerText ?? '';
    if (new RegExp(analyzingSource, 'i').test(text)) return { started: true };
    const error = Array.from(document.querySelectorAll('[role="alert"]'))
      .map((element) => element.textContent?.trim())
      .find(Boolean);
    return error ? { error } : undefined;
  }, { analyzingSource: analyzingPattern.source }, { timeout: 30_000 }).then((handle) => handle.jsonValue());
  if (submission.error) throw new Error(`Synthetic proof rejected before analysis: ${submission.error}`);
  const completion = await page.waitForFunction(({ analyzingSource, resultSource }) => {
    const text = document.body?.innerText ?? '';
    if (new RegExp(analyzingSource, 'i').test(text)) return undefined;
    const result = text.match(new RegExp(resultSource, 'i'))?.[0];
    if (result) return { result };
    const error = Array.from(document.querySelectorAll('[role="alert"]'))
      .map((element) => element.textContent?.trim())
      .find(Boolean);
    return error ? { error } : undefined;
  }, {
    analyzingSource: analyzingPattern.source,
    resultSource: resultPattern.source,
  }, { timeout: 90_000 }).then((handle) => handle.jsonValue());
  if (completion.error) throw new Error(`Synthetic proof rejected: ${completion.error}`);
  return { outcome: completion.result ?? 'completed' };
};
