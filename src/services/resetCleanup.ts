import { isCheckNotificationTag } from './serviceWorkerNotifications';

const TRANSIENT_STORAGE_PREFIXES = [
  'zadiag.transient.',
  'zadiag.session.',
  'zadiag.notification.',
  'zadiag.journey.',
];

const navigatorBadge = navigator as Navigator & {
  clearAppBadge?: () => Promise<void>;
};

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
  registration?.active?.postMessage({ type: 'CLEAR_BADGE_AND_NOTIFICATIONS' });
  if (registration?.getNotifications) {
    tasks.push(registration.getNotifications().then((notifications) => {
      notifications
        .filter((notification) => isCheckNotificationTag(notification.tag))
        .forEach((notification) => notification.close());
    }));
  }

  removeTransientStorage(window.sessionStorage);
  removeTransientStorage(window.localStorage);

  await Promise.allSettled(tasks);
}

export const resetCleanupInternals = {
  shouldCloseResetNotification: isCheckNotificationTag,
  removeTransientStorage,
};
