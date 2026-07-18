import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PI_HEALTH_ROUTINE_IDS = new Set(['nemu-health', 'raspberry-pi-health']);
const PI_HEALTH_ROUTINE_NAME_PATTERN = /Santé du Raspberry Pi|Raspberry Pi Health/i;
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
          const health = globalThis.__ZADIAG_NEMU_HEALTH__;
          if (['nemu-health', 'raspberry-pi-health'].includes(globalThis.__ZADIAG_SYNTHETIC_ROUTINE_ID__) && health) {
            drawing.fillStyle = '#9fbeb6';
            drawing.fillRect(0, 0, canvas.width, canvas.height);
            drawing.fillStyle = '#123b35';
            drawing.font = 'bold 26px sans-serif';
            drawing.fillText('Raspberry Pi Health', 18, 48);
            drawing.font = '15px sans-serif';
            drawing.fillStyle = '#48645f';
            drawing.fillText(health.timestamp, 18, 76);
            health.rows.forEach((row, index) => {
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
  if (routineId) return undefined;
  return PI_HEALTH_ROUTINE_NAME_PATTERN.test(pageText) ? 'raspberry-pi-health' : undefined;
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

export const answerPendingCheck = async ({ context, page, appUrl, path, contactEmail, routineId, healthEvidence, proofWaitMs = 20_000 }) => {
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
  const healthCard = page.locator('.today-routine-card').filter({ hasText: PI_HEALTH_ROUTINE_NAME_PATTERN });
  const proofButton = healthCard.getByRole('button', { name: /Proof|Preuve/i }).first();
  try {
    await proofButton.waitFor({ state: 'visible', timeout: proofWaitMs });
  } catch {
    return { outcome: 'already_settled' };
  }
  const pageText = await healthCard.innerText();
  const resolvedRoutineId = resolveSyntheticRoutineId({ routineId, pageText });
  if (!resolvedRoutineId) return { outcome: 'unsupported_routine' };
  const evidence = healthEvidence ?? await collectNemuHealth();
  await page.evaluate(({ currentRoutineId, currentEvidence }) => {
    globalThis.__ZADIAG_SYNTHETIC_ROUTINE_ID__ = currentRoutineId;
    globalThis.__ZADIAG_NEMU_HEALTH__ = currentEvidence;
  }, { currentRoutineId: resolvedRoutineId, currentEvidence: evidence });
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
