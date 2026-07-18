import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const PI_HEALTH_ROUTINE_IDS = new Set(['nemu-health', 'raspberry-pi-health']);
const resultPattern = /Validated|Validé|Not detected|Non détecté|Needs review|À vérifier/i;
const analyzingPattern = /Checking the photo|Analyse de la photo/i;
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
        canvas.width = 640;
        canvas.height = 480;
        const draw = () => {
          const drawing = canvas.getContext('2d');
          if (!drawing) return;
          const health = globalThis.__ZADIAG_NEMU_HEALTH__;
          if (['nemu-health', 'raspberry-pi-health'].includes(globalThis.__ZADIAG_SYNTHETIC_ROUTINE_ID__) && health) {
            drawing.fillStyle = '#eef8f5';
            drawing.fillRect(0, 0, canvas.width, canvas.height);
            drawing.fillStyle = '#123b35';
            drawing.font = 'bold 34px sans-serif';
            drawing.fillText('Raspberry Pi Health', 34, 55);
            drawing.font = '18px sans-serif';
            drawing.fillStyle = '#48645f';
            drawing.fillText(health.timestamp, 34, 86);
            health.rows.forEach((row, index) => {
              const y = 120 + index * 52;
              drawing.fillStyle = '#ffffff';
              drawing.fillRect(28, y, 584, 42);
              drawing.fillStyle = row.status === 'ok' ? '#16866f' : row.status === 'warning' ? '#c77b12' : '#c43d3d';
              drawing.beginPath();
              drawing.arc(52, y + 21, 9, 0, Math.PI * 2);
              drawing.fill();
              drawing.fillStyle = '#183b35';
              drawing.font = 'bold 17px sans-serif';
              drawing.fillText(row.label, 76, y + 26);
              drawing.font = '17px sans-serif';
              drawing.textAlign = 'right';
              drawing.fillText(row.value, 590, y + 26);
              drawing.textAlign = 'left';
            });
            drawing.fillStyle = '#48645f';
            drawing.font = '16px sans-serif';
            drawing.fillText('Zadiag synthetic operational proof', 34, 458);
            return;
          }
          drawing.fillStyle = '#c88f70';
          drawing.fillRect(0, 0, canvas.width, canvas.height);
          drawing.fillStyle = '#6b3029';
          drawing.beginPath();
          drawing.ellipse(320, 260, 155, 85, 0, 0, Math.PI * 2);
          drawing.fill();
          drawing.fillStyle = '#f6f1dd';
          drawing.fillRect(205, 220, 230, 42);
          drawing.fillStyle = '#d8d1ba';
          for (let x = 220; x < 430; x += 30) drawing.fillRect(x, 220, 3, 42);
          drawing.strokeStyle = '#6cc7d4';
          drawing.lineWidth = 8;
          drawing.beginPath();
          drawing.moveTo(210, 242);
          drawing.lineTo(430, 242);
          drawing.stroke();
          drawing.fillStyle = '#44201d';
          drawing.fillRect(255, 292, 130, 18);
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
        return [{ boundingBox: new DOMRectReadOnly(120, 80, 400, 320) }];
      }
    },
  });
  });
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
  if (PI_HEALTH_ROUTINE_IDS.has(routineId)) {
    const evidence = healthEvidence ?? await collectNemuHealth();
    await page.evaluate(({ currentRoutineId, currentEvidence }) => {
      globalThis.__ZADIAG_SYNTHETIC_ROUTINE_ID__ = currentRoutineId;
      globalThis.__ZADIAG_NEMU_HEALTH__ = currentEvidence;
    }, { currentRoutineId: routineId, currentEvidence: evidence });
  }
  const proofButton = page.getByRole('button', { name: /Proof|Preuve/i }).first();
  try {
    await proofButton.waitFor({ state: 'visible', timeout: proofWaitMs });
  } catch {
    return { outcome: 'already_settled' };
  }
  await proofButton.click();
  await page.getByRole('button', { name: /Use photo|Utiliser la photo/i }).click({ timeout: 20_000 });
  await page.getByRole('button', { name: /Use photo|Utiliser la photo/i }).click({ timeout: 20_000 });
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
