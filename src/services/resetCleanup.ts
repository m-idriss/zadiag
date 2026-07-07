const TRANSIENT_STORAGE_PREFIXES = [
  'zadiag.transient.',
  'zadiag.session.',
  'zadiag.notification.',
];

const RESET_NOTIFICATION_TAG_PREFIXES = ['verification:', 'reminder:'];
const RESET_NOTIFICATION_TAGS = new Set(['verification']);

const navigatorBadge = navigator as Navigator & {
  clearAppBadge?: () => Promise<void>;
};

const shouldCloseResetNotification = (tag = '') =>
  RESET_NOTIFICATION_TAGS.has(tag)
  || RESET_NOTIFICATION_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix));

const removeTransientStorage = (storage: Storage | undefined) => {
  if (!storage) return;
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .filter((key): key is string => Boolean(key));
  keys
    .filter((key) => TRANSIENT_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)))
    .forEach((key) => storage.removeItem(key));
};

export async function cleanupClientAfterReset() {
  const tasks: Array<Promise<unknown>> = [];

  if (navigatorBadge.clearAppBadge) {
    tasks.push(navigatorBadge.clearAppBadge());
  }

  const registration = await navigator.serviceWorker?.getRegistration?.();
  if (registration?.getNotifications) {
    tasks.push(registration.getNotifications().then((notifications) => {
      notifications
        .filter((notification) => shouldCloseResetNotification(notification.tag))
        .forEach((notification) => notification.close());
    }));
  }

  removeTransientStorage(window.sessionStorage);
  removeTransientStorage(window.localStorage);

  await Promise.allSettled(tasks);
}

export const resetCleanupInternals = {
  shouldCloseResetNotification,
  removeTransientStorage,
};
