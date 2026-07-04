const waitForInstalledState = (worker: ServiceWorker) => new Promise<void>((resolve) => {
  if (worker.state === 'installed') {
    resolve();
    return;
  }
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed') resolve();
  }, { once: true });
});

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
