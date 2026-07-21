import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ensureMonitorAppCheckDebugToken } from './app-check-debug.mjs';

const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('synthetic monitor App Check debug token configuration', () => {
  it('registers one generated token and persists it without exposing the secret', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zadiag-pi-app-check-'));
    temporaryDirectories.push(directory);
    const environmentPath = join(directory, 'env');
    await writeFile(environmentPath, 'ZADIAG_MONITOR_ID=monitor\n', { mode: 0o600 });
    const fetcher = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const result = await ensureMonitorAppCheckDebugToken({
      accessToken: 'access-token',
      environmentPath,
      projectNumber: 'project-number',
      appId: 'app-id',
      fetcher,
      createToken: () => '123e4567-e89b-42d3-a456-426614174000',
    });

    expect(result).toEqual({ created: true, configured: true });
    expect(await readFile(environmentPath, 'utf8')).toContain(
      'ZADIAG_MONITOR_APP_CHECK_DEBUG_TOKEN=123e4567-e89b-42d3-a456-426614174000',
    );
    expect(fetcher).toHaveBeenCalledWith(
      'https://firebaseappcheck.googleapis.com/v1/projects/project-number/apps/app-id/debugTokens',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          displayName: 'Zadiag synthetic monitor',
          token: '123e4567-e89b-42d3-a456-426614174000',
        }),
      }),
    );
  });

  it('keeps an existing registered token when configuration is rerun', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'zadiag-pi-app-check-'));
    temporaryDirectories.push(directory);
    const environmentPath = join(directory, 'env');
    const contents = [
      'ZADIAG_MONITOR_ID=monitor',
      'ZADIAG_MONITOR_APP_CHECK_DEBUG_TOKEN=123e4567-e89b-42d3-a456-426614174000',
      '',
    ].join('\n');
    await writeFile(environmentPath, contents, { mode: 0o600 });

    await expect(ensureMonitorAppCheckDebugToken({
      accessToken: 'access-token',
      environmentPath,
      fetcher: vi.fn().mockResolvedValue({ ok: false, status: 409 }),
    })).resolves.toEqual({ created: false, configured: true });
    expect(await readFile(environmentPath, 'utf8')).toBe(contents);
  });
});
