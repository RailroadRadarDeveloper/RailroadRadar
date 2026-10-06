from pathlib import Path

RAIL = '''<label for="trip-log-live-railroad">Railroad (optional)</label>
                <select id="trip-log-live-railroad">
                  <option value="">Optional</option>
                  <option value="mbta">MBTA</option>
                  <option value="amtrak">Amtrak</option>
                  <option value="mnr">Metro-North</option>
                  <option value="lirr">Long Island Rail Road</option>
                  <option value="njt">NJ Transit</option>
                  <option value="ctrail">CTrail</option>
                  <option value="marc">MARC</option>
                  <option value="other">Other</option>
                </select>
                '''

HANDLER = '''document.addEventListener('click', function(ev) {
      var btn = ev.target && ev.target.closest && ev.target.closest('#trip-log-go-live');
      if (!btn) return;
      ev.preventDefault();
      var cb = document.getElementById('trip-log-special-move');
      if (cb) cb.checked = true;
      var user = null;
      try { user = (typeof rrAuthUser === 'function') ? rrAuthUser() : null; } catch (e) {}
      if (!user) try { user = window.currentUser; } catch (e) {}
      if (!user && window.firebase && firebase.auth) try { user = firebase.auth().currentUser; } catch (e) {}
      if (!user || !user.uid) { alert('Sign in before going live.'); return; }
      var title = ((document.getElementById('trip-log-train-title') || {}).value || 'Live trip').trim().slice(0, 80);
      var go = function() { location.href = '/live/user.html?uid=' + encodeURIComponent(user.uid); };
      try { if (typeof saveTripLog === 'function') saveTripLog(); } catch (e) {}
      var finish = function(pos) {
        var now = Date.now();
        var share = { uid: user.uid, tripId: 'live-' + now, title: title, startedAt: now, expiresAt: now + 5 * 60 * 60 * 1000, updatedAt: now };
        if (pos && pos.coords) { share.lastLat = pos.coords.latitude; share.lastLon = pos.coords.longitude; }
        try { localStorage.removeItem('rrSpecialShareStopped'); localStorage.setItem('rrSpecialMoveShareV1', JSON.stringify(share)); } catch (e) {}
        var db = window.db || (firebase.firestore && firebase.firestore());
        if (!db || !pos || !pos.coords) { go(); return; }
        db.collection('specialMoveShares').doc(user.uid).set({
          uid: user.uid, displayName: (user.displayName || 'Rider').split(' ')[0], tripId: share.tripId, title: title, active: true,
          lat: pos.coords.latitude, lon: pos.coords.longitude, heading: pos.coords.heading, startedAt: now, expiresAt: share.expiresAt, updatedAt: now
        }, { merge: true }).then(go).catch(go);
      };
      if (!navigator.geolocation) finish(null);
      else navigator.geolocation.getCurrentPosition(finish, function() { finish(null); }, { enableHighAccuracy: true, timeout: 8000 });
    });'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        "if (!rr) throw new Error('Segment ' + (i + 1) + ': choose a railroad.');\n        const routeOptional = isSpecial && (!lineId || !originId || !destId);\n        if (!routeOptional) {\n          if (!lineId) throw new Error('Segment ' + (i + 1) + ': choose a line.');\n          if (!originId || !destId) throw new Error('Segment ' + (i + 1) + ': choose origin and destination.');\n          if (originId === destId) throw new Error('Segment ' + (i + 1) + ': origin and destination must differ.');\n        }",
        "if (originId && destId && originId === destId) throw new Error('Segment ' + (i + 1) + ': origin and destination must differ.');\n        const routeOptional = !rr || !lineId || !originId || !destId;",
        1,
    )
    if 'trip-log-live-railroad' not in t:
        t = t.replace('<label for="trip-log-train-title">Map title</label>', RAIL + '<label for="trip-log-train-title">Service name</label>', 1)
        t = t.replace('placeholder="e.g. Berkshire Flyer special"', 'placeholder="Service name"', 1)
    t = t.replace(
        "const title = data.specialMove ? String(data.trainTitle || '').trim() : '';\n        routeEl.textContent = (data.specialMove && noStations && title) ? title : '';\n        if (!(data.specialMove && noStations && title)) routeEl.innerHTML = tripRouteOdHtml(od.origin, od.dest);",
        "const title = data.specialMove ? String(data.trainTitle || data.title || '').trim() : '';\n        if (data.specialMove && title) routeEl.textContent = title;\n        else routeEl.innerHTML = tripRouteOdHtml(od.origin, od.dest);",
        1,
    )
    t = t.replace(
        'return tripRouteOdText(data.originName, data.destName);',
        "if (data && data.specialMove && String(data.trainTitle || data.title || '').trim()) return String(data.trainTitle || data.title).trim();\n      return tripRouteOdText(data.originName, data.destName);",
        1,
    )
    start = t.find("document.addEventListener('click', function(ev) {")
    start = t.find("closest('#trip-log-go-live')")
    if start > 0:
        start = t.rfind("document.addEventListener('click', function(ev) {", 0, start)
        end = t.find('});', t.find('.catch(function() {}', start))
        if start > 0 and end > start:
            t = t[:start] + HANDLER + t[end+3:]
    p.write_text(t, encoding='utf-8')
    print(path, 'railroad required', 'choose a railroad' in t, 'service', 'trip-log-live-railroad' in t)

patch('index.html')
patch('mytrips/index.html')

rules = Path('firestore.rules')
rt = rules.read_text(encoding='utf-8')
rt = rt.replace(
'''    match /specialMoveShares/{uid} {
      allow read: if true;
      allow create, update: if signedIn()
        && request.auth.uid == uid
        && request.resource.data.uid == uid
        && request.resource.data.active == true
        && request.resource.data.lat is number
        && request.resource.data.lon is number;
      allow delete: if signedIn() && request.auth.uid == uid;
    }''',
'''    match /specialMoveShares/{uid} {
      allow read: if true;
      allow create, update: if signedIn()
        && request.auth.uid == uid
        && request.resource.data.uid == uid
        && request.resource.data.lat is number
        && request.resource.data.lon is number;
      allow delete: if signedIn() && request.auth.uid == uid;
    }'''
)
rules.write_text(rt, encoding='utf-8')
print('rules active gate', 'active == true' in rt)

bar = Path('assets/js/live-share-bar.js')
b = bar.read_text(encoding='utf-8')
b = b.replace(
'''  function boot() {
    if (stopped()) { hide(); return; }''',
'''  function boot() {
    var existing = null;
    try { existing = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
    if (existing && existing.expiresAt && Date.now() < Number(existing.expiresAt)) {
      try { localStorage.removeItem(STOP); } catch (e) {}
    }
    if (stopped()) { hide(); return; }'''
)
bar.write_text(b, encoding='utf-8')
print('banner')
