/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string }>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event: PushEvent) => {
  const payload = event.data?.json() as { sessionId?: string; title?: string; body?: string } | undefined;
  event.waitUntil(
    self.registration.showNotification(payload?.title ?? 'Zadiag', {
      body: payload?.body ?? 'A quick check is ready when you are.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload?.sessionId ?? 'verification',
      data: { path: '/?open=verification' },
    }),
  );
});

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(String(event.notification.data?.path ?? '/')));
});
