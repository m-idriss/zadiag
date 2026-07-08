export interface PushPayload {
  version?: number;
  kind?: string;
  sessionId?: string;
  routineId?: string;
  title?: string;
  body?: string;
  tag?: string;
  path?: string;
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
    version: payload?.version,
    path: payload?.path ?? '/?open=verification',
  },
});

export const notificationClickPath = (notification: Pick<Notification, 'data'>) =>
  String((notification.data as { path?: string } | undefined)?.path ?? '/');

export const clearBadgeAndCheckNotifications = async (
  registration: Pick<ServiceWorkerRegistration, 'getNotifications'>,
  badgeApi: { clearAppBadge?: () => Promise<void> } = navigator,
) => {
  await badgeApi.clearAppBadge?.();
  const notifications = await registration.getNotifications();
  notifications
    .filter((notification) => ['verification', 'verification:', 'reminder:'].some((prefix) => notification.tag === prefix || notification.tag.startsWith(prefix)))
    .forEach((notification) => notification.close());
};
