/* RailroadRadar service worker — home-screen notifications */
/* Failsafe: cached "currently unavailable" page for failed / 5xx navigations. */
var RR_SW_VERSION = 'rr-sw-v2';
var RR_FAILSAFE_CACHE = 'rr-failsafe-v74';
var RR_UNAVAILABLE_URL = '/unavailable.html';

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(RR_FAILSAFE_CACHE).then(function (cache) {
      return cache.add(new Request(RR_UNAVAILABLE_URL, { cache: 'reload' }));
    }).catch(function () {})
  );
});
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k.indexOf('rr-failsafe-') === 0 && k !== RR_FAILSAFE_CACHE) return caches.delete(k);
      }));
    }).catch(function () {}).then(function () { return self.clients.claim(); })
  );
});

function rrUnavailableResponse(fallback) {
  return caches.open(RR_FAILSAFE_CACHE).then(function (cache) {
    return cache.match(RR_UNAVAILABLE_URL);
  }).then(function (cached) {
    if (cached) return cached;
    if (fallback) return fallback;
    return new Response('<!DOCTYPE html><meta charset="utf-8"><title>RailroadRadar</title><body style="background:#07093e;color:#fff;font-family:sans-serif;text-align:center;padding-top:30vh"><p>RailroadRadar is currently unavailable. Please try again shortly.</p></body>', { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }).catch(function () {
    return fallback || Response.error();
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.mode !== 'navigate' || req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status >= 500 && res.status <= 599) return rrUnavailableResponse(res);
      if (res && res.status === 404) {
        /* Our own 404 page mentions RailroadRadar; GitHub's generic "site not found" page does not,
           which means the whole site is missing, so show the unavailable page instead. */
        return res.clone().text().then(function (body) {
          if (body && body.indexOf('RailroadRadar') !== -1) return res;
          return rrUnavailableResponse(res);
        }, function () { return res; });
      }
      return res;
    }, function () {
      return rrUnavailableResponse(null);
    })
  );
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

// Boarding-track pushes (tag rr-trip-*) are recorded so an open page doesn't show the same alert again.
function rrMarkTripFired(tag) {
  if (!tag || String(tag).indexOf('rr-trip-') !== 0) return Promise.resolve();
  return caches.open('rr-trip-fired').then(function (c) {
    return c.put('/__rr-trip-fired/' + encodeURIComponent(tag), new Response(String(Date.now())));
  }).catch(function () {});
}

self.addEventListener('push', function (event) {
  var data = rrPushPayload(event);
  var title = data.title || 'RailroadRadar';
  event.waitUntil(Promise.all([rrShow(title, data), rrMarkTripFired(data.tag)]));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = (event.notification && event.notification.data && event.notification.data.url) || '/map/';
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
