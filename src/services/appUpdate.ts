const waitForInstalledState = (worker: ServiceWorker) => new Promise<void>((resolve) => {
  if (worker.state === 'installed') {
    resolve();
    return;
  }
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed') resolve();
  }, { once: true });
});

export type AppUpdateSeverity = 'patch' | 'minor' | 'major' | 'unknown';

export type AppUpdateInfo = {
  available: boolean;
  currentVersion: string;
  latestVersion?: string;
  severity: AppUpdateSeverity;
  patchCount?: number;
  badgeLabel?: string;
};

type VersionParts = {
  major: number;
  minor: number;
  patch: number;
};

type AppVersionManifest = {
  version?: string;
  updatedAt?: string;
};

const parseVersion = (version: string): VersionParts | undefined => {
  const match = version.trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) return undefined;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

const compareVersions = (current: VersionParts, latest: VersionParts) => {
  if (latest.major !== current.major) return latest.major - current.major;
  if (latest.minor !== current.minor) return latest.minor - current.minor;
  return latest.patch - current.patch;
};

export const describeAppUpdate = (currentVersion: string, latestVersion?: string): AppUpdateInfo | undefined => {
  if (!latestVersion || latestVersion === currentVersion) return undefined;
  const current = parseVersion(currentVersion);
  const latest = parseVersion(latestVersion);
  if (!current || !latest || compareVersions(current, latest) <= 0) return undefined;
  if (latest.major > current.major) {
    return { available: true, currentVersion, latestVersion, severity: 'major', badgeLabel: latestVersion };
  }
  if (latest.minor > current.minor) {
    return { available: true, currentVersion, latestVersion, severity: 'minor', badgeLabel: latestVersion };
  }
  const patchCount = latest.patch - current.patch;
  return {
    available: true,
    currentVersion,
    latestVersion,
    severity: 'patch',
    patchCount,
    badgeLabel: patchCount > 0 ? `+${patchCount}` : undefined,
  };
};

export const isMandatoryAppUpdate = (updateInfo: Pick<AppUpdateInfo, 'available' | 'severity'>) => (
  updateInfo.available && (updateInfo.severity === 'minor' || updateInfo.severity === 'major')
);

export const fetchLatestAppVersion = async (): Promise<string | undefined> => {
  const response = await fetch(`/app-version.json?t=${Date.now()}`, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return undefined;
  const manifest = await response.json() as AppVersionManifest;
  return typeof manifest.version === 'string' ? manifest.version : undefined;
};

export const refreshServiceWorkerRegistration = async (): Promise<ServiceWorkerRegistration | undefined> => {
  if (!('serviceWorker' in navigator)) return undefined;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return undefined;
  await registration.update();
  if (registration.installing) await waitForInstalledState(registration.installing);
  return registration;
};

export const runWhenStartupIsIdle = (task: () => void) => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(task, { timeout: 2500 });
    return;
  }
  globalThis.setTimeout(task, 800);
};
