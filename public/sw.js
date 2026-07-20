/* IIChE AVVU SC — service worker for Web Push (free, no third-party) */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'IIChE AVVU', body: 'You have a new notification', url: '/dashboard' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // use defaults
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/logo.svg',
      badge: '/logo.svg',
      tag: payload.tag || 'iiche-portal',
      data: { url: payload.url || '/dashboard' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/dashboard';
  const absolute = new URL(target, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client && client.url.startsWith(self.location.origin)) {
          client.navigate(absolute);
          return client.focus();
        }
      }
      return self.clients.openWindow(absolute);
    }),
  );
});
