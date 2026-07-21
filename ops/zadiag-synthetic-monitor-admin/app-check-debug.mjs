import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';

export const defaultAppCheckProjectNumber = '1030334725553';
export const defaultAppCheckAppId = '1:1030334725553:web:fea2ffb0f79bd8c5d85190';

const environmentValue = (contents, name) => contents
  .split(/\r?\n/)
  .find((line) => line.startsWith(`${name}=`))
  ?.slice(name.length + 1)
  .trim();

export const ensureMonitorAppCheckDebugToken = async ({
  accessToken,
  environmentPath,
  projectNumber = defaultAppCheckProjectNumber,
  appId = defaultAppCheckAppId,
  fetcher = fetch,
  createToken = randomUUID,
}) => {
  const contents = await readFile(environmentPath, 'utf8');
  const existingToken = environmentValue(contents, 'ZADIAG_MONITOR_APP_CHECK_DEBUG_TOKEN');
  const token = existingToken || createToken();
  const parent = `projects/${projectNumber}/apps/${appId}`;
  const response = await fetcher(`https://firebaseappcheck.googleapis.com/v1/${parent}/debugTokens`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName: 'Zadiag synthetic monitor',
      token,
    }),
  });
  if (!response.ok && response.status !== 409) {
    throw new Error(`Unable to register the synthetic monitor App Check debug token: ${response.status} ${await response.text()}`);
  }
  if (!existingToken) {
    const temporaryPath = `${environmentPath}.tmp`;
    const separator = contents.endsWith('\n') ? '' : '\n';
    await writeFile(temporaryPath, `${contents}${separator}ZADIAG_MONITOR_APP_CHECK_DEBUG_TOKEN=${token}\n`, { mode: 0o600 });
    await rename(temporaryPath, environmentPath);
  }
  return { created: response.ok, configured: true };
};
