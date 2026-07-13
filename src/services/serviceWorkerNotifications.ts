export interface PushPayload {
  version?: number;
  kind?: string;
  sessionId?: string;
  routineId?: string;
  title?: string;
  body?: string;
  tag?: string;
  path?: string;
  checkId?: string;
  syntheticReceipt?: {
    monitorId?: string;
    receiptId?: string;
    token?: string;
    url?: string;
  };
}

export const notificationOptionsForPayload = (payload?: PushPayload): NotificationOptions => ({
  body: payload?.body ?? 'You can send your proof now.',
  icon: '/icons/icon-192.png',
  badge: '/icons/icon-192.png',
  tag: payload?.tag ?? payload?.sessionId ?? 'verification',
  data: {
    kind: payload?.kind,
    routineId: payload?.routineId,
    sessionId: payload?.sessionId,
    checkId: payload?.checkId,
    version: payload?.version,
    path: payload?.path ?? '/?open=verification',
    syntheticReceipt: payload?.syntheticReceipt,
  },
});

export const notificationClickPath = (notification: Pick<Notification, 'data'>) =>
  String((notification.data as { path?: string } | undefined)?.path ?? '/');

export const reportSyntheticPushReceipt = async (
  payload: PushPayload | undefined,
  stage: 'received' | 'opened',
  fetcher: typeof fetch = fetch,
) => {
  const receipt = payload?.syntheticReceipt;
  if (!receipt?.monitorId || !receipt.receiptId || !receipt.token || !receipt.url) return false;
  let url: URL;
  try {
    url = new URL(receipt.url);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.cloudfunctions.net')) return false;
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      monitorId: receipt.monitorId,
      receiptId: receipt.receiptId,
      token: receipt.token,
      stage,
      kind: payload?.kind,
      checkId: payload?.checkId,
      sessionId: payload?.sessionId,
      routineId: payload?.routineId,
    }),
  });
  return response.ok;
};

const CHECK_NOTIFICATION_TAG_PREFIXES = ['verification:', 'reminder:'];
const CHECK_NOTIFICATION_TAGS = new Set(['verification']);

export const isCheckNotificationTag = (tag = '') =>
  CHECK_NOTIFICATION_TAGS.has(tag)
  || CHECK_NOTIFICATION_TAG_PREFIXES.some((prefix) => tag.startsWith(prefix));

export const clearBadgeAndCheckNotifications = async (
  registration: Pick<ServiceWorkerRegistration, 'getNotifications'>,
  badgeApi: { clearAppBadge?: () => Promise<void> } = navigator,
) => {
  await badgeApi.clearAppBadge?.();
  const notifications = await registration.getNotifications();
  notifications
    .filter((notification) => isCheckNotificationTag(notification.tag))
    .forEach((notification) => notification.close());
};
