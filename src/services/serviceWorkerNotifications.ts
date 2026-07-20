export interface PushPayload {
  version?: number;
  kind?: string;
  participantId?: string;
  sessionId?: string;
  routineId?: string;
  title?: string;
  body?: string;
  tag?: string;
  path?: string;
  checkId?: string;
  deliveryReceipt?: {
    aggregate?: string;
    aggregateId?: string;
    subscriptionId?: string;
    receiptId?: string;
    token?: string;
    url?: string;
  };
  syntheticReceipt?: {
    monitorId?: string;
    receiptId?: string;
    token?: string;
    url?: string;
  };
}

interface DeclarativePushPayload {
  web_push?: number;
  notification?: {
    title?: string;
    body?: string;
    tag?: string;
    navigate?: string;
    data?: PushPayload;
  };
}

export const pushPayloadFromData = (input: unknown): PushPayload | undefined => {
  if (!input || typeof input !== 'object') return undefined;
  const candidate = input as PushPayload & DeclarativePushPayload;
  if (candidate.web_push !== 8030 || !candidate.notification) return candidate;
  return {
    ...candidate.notification.data,
    title: candidate.notification.title,
    body: candidate.notification.body,
    tag: candidate.notification.tag,
    path: candidate.notification.data?.path ?? candidate.notification.navigate,
  };
};

export const notificationOptionsForPayload = (payload?: PushPayload): NotificationOptions => ({
  body: payload?.body ?? 'You can send your proof now.',
  icon: '/icons/icon-192.png',
  badge: '/icons/icon-192.png',
  tag: payload?.tag ?? payload?.sessionId ?? 'verification',
  data: {
    kind: payload?.kind,
    participantId: payload?.participantId,
    routineId: payload?.routineId,
    sessionId: payload?.sessionId,
    checkId: payload?.checkId,
    version: payload?.version,
    path: payload?.path ?? '/?open=verification',
    deliveryReceipt: payload?.deliveryReceipt,
    syntheticReceipt: payload?.syntheticReceipt,
  },
});

export const notificationClickPath = (notification: Pick<Notification, 'data'>) =>
  String((notification.data as { path?: string } | undefined)?.path ?? '/');

type NotificationWindowClient = Pick<WindowClient, 'focus' | 'postMessage' | 'visibilityState' | 'focused'>;
type NotificationClients = {
  matchAll: (options: ClientQueryOptions) => Promise<readonly (Client | NotificationWindowClient)[]>;
  openWindow: (url: string) => Promise<WindowClient | null>;
};

export const reportPushReceipt = async (
  payload: PushPayload | undefined,
  stage: 'received' | 'opened',
  fetcher: typeof fetch = fetch,
) => {
  const receipt = payload?.deliveryReceipt;
  if (!['families', 'participants'].includes(receipt?.aggregate ?? '') || !receipt?.aggregateId
    || !receipt.subscriptionId || !receipt.receiptId || !receipt.token || !receipt.url) return false;
  let url: URL;
  try { url = new URL(receipt.url); } catch { return false; }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.cloudfunctions.net')) return false;
  const response = await fetcher(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      aggregate: receipt.aggregate,
      aggregateId: receipt.aggregateId,
      subscriptionId: receipt.subscriptionId,
      receiptId: receipt.receiptId,
      token: receipt.token,
      stage,
    }),
  });
  return response.ok;
};

export const openNotificationClient = async (
  notification: Pick<Notification, 'data'>,
  clients: NotificationClients,
) => {
  const path = notificationClickPath(notification);
  const matchedClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  const windows = matchedClients.filter((client): client is NotificationWindowClient => 'focus' in client);
  const existing = windows.sort((left, right) => Number(right.focused) - Number(left.focused)
    || Number(right.visibilityState === 'visible') - Number(left.visibilityState === 'visible'))[0];
  if (!existing) return clients.openWindow(path);
  existing.postMessage({ type: 'OPEN_NOTIFICATION', path });
  return existing.focus();
};

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
