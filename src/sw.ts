/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import {
  clearBadgeAndCheckNotifications,
  notificationOptionsForPayload,
  openNotificationClient,
  pushPayloadFromData,
  reportPushReceipt,
  reportSyntheticPushReceipt,
  type PushPayload,
} from './services/serviceWorkerNotifications';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const type = (event.data as { type?: string } | undefined)?.type;
  if (type === 'SKIP_WAITING') {
    void self.skipWaiting();
  } else if (type === 'CLEAR_BADGE_AND_NOTIFICATIONS') {
    event.waitUntil(clearBadgeAndCheckNotifications(self.registration));
  }
});

self.addEventListener('push', (event: PushEvent) => {
  const payload = pushPayloadFromData(event.data?.json()) as PushPayload | undefined;
  event.waitUntil(
    Promise.allSettled([
      self.registration.showNotification(payload?.title ?? 'Check ready', notificationOptionsForPayload(payload)),
      reportPushReceipt(payload, 'received'),
      reportSyntheticPushReceipt(payload, 'received'),
    ]),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const payload = event.notification.data as PushPayload | undefined;
  event.waitUntil(Promise.allSettled([
    reportPushReceipt(payload, 'opened'),
    reportSyntheticPushReceipt(payload, 'opened'),
    openNotificationClient(event.notification, self.clients),
  ]));
});
