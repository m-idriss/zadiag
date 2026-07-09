import { useCallback, useMemo, useState } from 'react';
import {
  describeAppUpdate,
  fetchLatestAppVersion,
  refreshServiceWorkerRegistration,
  type AppUpdateInfo,
} from '../services/appUpdate';

export const useAppUpdateController = (ready: boolean) => {
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateInfo>(() => ({
    available: false,
    currentVersion: import.meta.env.VITE_APP_VERSION,
    severity: 'unknown',
  }));
  const [updateActionBusy, setUpdateActionBusy] = useState(false);
  const [dismissedUpdateId, setDismissedUpdateId] = useState<string>();

  const refreshAppUpdateInfo = useCallback(async (
    shouldApply: () => boolean = () => true,
  ): Promise<ServiceWorkerRegistration | undefined> => {
    const [registration, latestVersion] = await Promise.all([
      refreshServiceWorkerRegistration(),
      fetchLatestAppVersion().catch((error) => {
        console.error(error);
        return undefined;
      }),
    ]);
    const versionUpdate = describeAppUpdate(import.meta.env.VITE_APP_VERSION, latestVersion);
    const waiting = Boolean(registration?.waiting);
    if (!shouldApply()) return registration;
    setAppUpdateInfo(versionUpdate ?? {
      available: waiting,
      currentVersion: import.meta.env.VITE_APP_VERSION,
      latestVersion,
      severity: waiting ? 'unknown' : 'patch',
    });
    return registration;
  }, []);

  const forceAppUpdate = useCallback(async (): Promise<boolean> => {
    const registration = await refreshAppUpdateInfo();
    if (!registration?.waiting) return false;
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    await new Promise<void>((resolve) => {
      const timer = window.setTimeout(resolve, 1500);
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.clearTimeout(timer);
        resolve();
      }, { once: true });
    });
    window.location.reload();
    return true;
  }, [refreshAppUpdateInfo]);

  const updateSnackbarId = appUpdateInfo.available
    ? appUpdateInfo.latestVersion ?? appUpdateInfo.badgeLabel ?? 'waiting-service-worker'
    : undefined;

  const showUpdateSnackbar = Boolean(ready
    && appUpdateInfo.available
    && updateSnackbarId
    && dismissedUpdateId !== updateSnackbarId);

  const applySnackbarUpdate = useCallback(async () => {
    setUpdateActionBusy(true);
    try {
      await forceAppUpdate();
    } catch (error) {
      console.error(error);
    } finally {
      setUpdateActionBusy(false);
    }
  }, [forceAppUpdate]);

  return useMemo(() => ({
    appUpdateInfo,
    applySnackbarUpdate,
    dismissUpdate: setDismissedUpdateId,
    forceAppUpdate,
    refreshAppUpdateInfo,
    resetDismissedUpdate: () => setDismissedUpdateId(undefined),
    showUpdateSnackbar,
    updateActionBusy,
    updateSnackbarId,
  }), [
    appUpdateInfo,
    applySnackbarUpdate,
    forceAppUpdate,
    refreshAppUpdateInfo,
    showUpdateSnackbar,
    updateActionBusy,
    updateSnackbarId,
  ]);
};
