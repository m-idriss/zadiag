/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

self.addEventListener('push', (event: PushEvent) => {
  const payload = event.data?.json() as {
    version?: number;
    kind?: string;
    sessionId?: string;
    routineId?: string;
    title?: string;
    body?: string;
    tag?: string;
    path?: string;
  } | undefined;
  event.waitUntil(
    self.registration.showNotification(payload?.title ?? 'Check ready', {
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
    }),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(String(event.notification.data?.path ?? '/')));
});
