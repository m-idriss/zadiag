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

export const answerPendingCheck = async ({ context, page, appUrl, path, proofWaitMs = 20_000 }) => {
  await installSyntheticCamera(context);
  let destination = new URL('/', appUrl);
  try {
    const candidate = new URL(path || '/', appUrl);
    if (candidate.origin === new URL(appUrl).origin) destination = candidate;
  } catch {
    // Keep the application root for malformed notification paths.
  }
  await page.goto(destination.href, { waitUntil: 'domcontentloaded', timeout: 30_000 });
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
