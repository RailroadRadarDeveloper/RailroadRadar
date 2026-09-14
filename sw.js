/* RailroadRadar service worker — home-screen notifications */
self.addEventListener('install', function (e) {
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim());
});

function rrPushPayload(event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    try { data = { body: event.data.text() }; } catch (__) { data = {}; }
  }
  return data || {};
}

function rrShow(title, data) {
  var body = (data && data.body) ? String(data.body) : 'A special unit just updated';
  var tag = (data && data.tag) ? String(data.tag) : ('rr-' + Date.now());
  var url = (data && data.url) ? String(data.url) : '/';
  // iOS Web Push rejects vibrate / badge / renotify and treats a failed
  // showNotification as a silent push (which Apple then drops).
  return self.registration.showNotification(title, {
    body: body,
    icon: '/assets/icons/icon-192.png',
    tag: tag,
    data: { url: url }
  }).catch(function () {
    return self.registration.showNotification(title, { body: body });
  });
}

self.addEventListener('push', function (event) {
  var data = rrPushPayload(event);
  var title = data.title || 'RailroadRadar';
  event.waitUntil(rrShow(title, data));
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
  event.waitUntil(rrShow(msg.title, msg));
});
