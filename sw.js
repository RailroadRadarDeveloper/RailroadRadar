/* RailroadRadar service worker — home-screen notifications */
self.addEventListener('install', function (e) {
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    try { data = { body: event.data.text() }; } catch (__) { data = {}; }
  }
  var title = data.title || 'RailroadRadar';
  var opts = {
    body: data.body || 'A special unit just updated',
    icon: data.icon || '/assets/icons/icon-192.png',
    badge: data.badge || '/assets/icons/icon-192.png',
    tag: data.tag || ('rr-' + Date.now()),
    renotify: true,
    data: { url: data.url || '/' },
    vibrate: [80, 40, 80]
  };
  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clients) {
      for (var i = 0; i < clients.length; i++) {
        var c = clients[i];
        if (c.url && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('message', function (event) {
  var msg = event.data || {};
  if (msg.type !== 'rr-notify' || !msg.title) return;
  event.waitUntil(self.registration.showNotification(msg.title, {
    body: msg.body || '',
    icon: '/assets/icons/icon-192.png',
    badge: '/assets/icons/icon-192.png',
    tag: msg.tag || ('rr-' + Date.now()),
    renotify: true,
    data: { url: msg.url || '/' }
  }));
});
