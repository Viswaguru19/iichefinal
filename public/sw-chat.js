/* IIChE Chat — chat-scoped service worker for push + static asset caching */

const CACHE_NAME = 'iiche-chat-v3';
const STATIC_PREFIXES = ['/icons/', '/_next/static/'];

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith('iiche-chat-') && key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)) || url.pathname.endsWith('.svg');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || !isStaticAsset(url)) return;

  event.respondWith(
    fetch(request)
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, response.clone());
        }
        return response;
      })
      .catch(() => caches.match(request)),
  );
});

self.addEventListener('push', (event) => {
  let payload = {
    title: 'IIChE Chat',
    body: 'You have a new message',
    url: '/chat',
  };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Use the chat defaults.
  }

  const iconUrl = new URL('/api/pwa/chat-icon', self.location.origin).href;

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: iconUrl,
      badge: iconUrl,
      tag: payload.tag || 'iiche-chat',
      data: { url: payload.url || '/chat' },
      vibrate: [120, 60, 120],
      requireInteraction: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/chat';
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

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const status = await fetch('/api/push/status').then((r) => r.json()).catch(() => null);
      const key = status?.vapidPublicKey;
      if (!key) return;
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
    })(),
  );
});
