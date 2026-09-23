/* Friink Web Push worker. Payloads are limited to safe copy and a same-origin route. */
self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title : 'Friink';
  const body = typeof payload.body === 'string' ? payload.body : '';
  const route = typeof payload.route === 'string' && payload.route.startsWith('/') && !payload.route.startsWith('//')
    ? payload.route
    : '/notifications';

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    data: { route },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const route = event.notification.data && typeof event.notification.data.route === 'string'
    ? event.notification.data.route
    : '/notifications';
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        await client.focus();
        if ('navigate' in client) await client.navigate(new URL(route, self.location.origin).href);
        return;
      }
    }
    await self.clients.openWindow(new URL(route, self.location.origin).href);
  })());
});
