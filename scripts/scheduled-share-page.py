from pathlib import Path

p = Path('index.html')
t = p.read_text(encoding='utf-8')

t = t.replace(
    "rrShareTrainBtnHtml('mbta', tid, (typeof extractTrainNumber === 'function' && extractTrainNumber(tid)) || tid)",
    "rrShareTrainBtnHtml('mbta', tid, tid)",
    1,
)

FN = r'''
      let rrScheduledPage = null;
      let rrScheduledLine = null;
      function rrClearScheduledLine() {
        if (rrScheduledLine && map) {
          try { map.removeLayer(rrScheduledLine); } catch (e) {}
        }
        rrScheduledLine = null;
      }
      function rrDepartsInMsg(date) {
        if (!date) return 'Scheduled';
        const totalMin = Math.round((date.getTime() - Date.now()) / 60000);
        if (totalMin <= 0) return 'Departed';
        const days = Math.floor(totalMin / 1440);
        const hours = Math.floor((totalMin % 1440) / 60);
        const mins = totalMin % 60;
        const parts = [];
        if (days) parts.push(days + ' day' + (days === 1 ? '' : 's'));
        if (hours) parts.push(hours + ' hour' + (hours === 1 ? '' : 's'));
        if (mins || !parts.length) parts.push(mins + ' minute' + (mins === 1 ? '' : 's'));
        return 'Departs in ' + (parts.length === 1 ? parts[0] : parts.length === 2 ? parts[0] + ' and ' + parts[1] : parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1]);
      }
      function rrDrawScheduledRoute(stops) {
        rrClearScheduledLine();
        if (!map || typeof L === 'undefined') return;
        const pts = (stops || []).filter(s => s && s.lat != null && s.lng != null).map(s => [Number(s.lat), Number(s.lng)]).filter(p => isFinite(p[0]) && isFinite(p[1]));
        if (pts.length < 2) return;
        rrScheduledLine = L.polyline(pts, { color: '#0ac700', weight: 5, opacity: 0.95 }).addTo(map);
        try { map.fitBounds(rrScheduledLine.getBounds(), { padding: [36, 36], maxZoom: 13 }); } catch (e) {}
      }
      function rrScheduledPopupHtml(page) {
        const shareBtn = (typeof rrShareTrainBtnHtml === 'function') ? rrShareTrainBtnHtml('mbta', page.tid, page.tid) : '';
        const stopsHtml = (typeof buildStopsHtml === 'function') ? buildStopsHtml(page.stops || []) : '';
        return '<div class="train-popup"><div class="train-popup-header"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:14.5px;line-height:1.3;color:#ffffff;font-style:italic;"><span style="font-weight:700;color:#ffffff;font-style:italic;">' +
          String(page.rname || 'Trip') + '</span><span style="font-weight:700;color:#ffffff;font-style:italic;">' +
          String(page.tid || '') + '</span><span style="color:#ffffff;font-weight:500;font-style:italic;"> to </span><span style="font-weight:700;color:#ffffff;font-style:italic;">' +
          String(page.dest || '—') + '</span></div></div><div class="train-popup-body"><div class="quick-status" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #eee;"><p class="status-desc" style="margin:0;">' +
          String(page.departsMsg || 'Scheduled') + '</p><span class="status-pill status-scheduled">Scheduled</span></div><div class="info-grid"><div class="info-item"><span class="info-label">Trip</span><span class="info-value">' +
          String(page.tid || '') + '</span></div><div class="info-item"><span class="info-label">From</span><span class="info-value">' +
          String(page.origin || '—') + '</span></div></div><div class="stops-wrapper">' + stopsHtml + '</div></div><div class="train-popup-footer">' + shareBtn + '</div></div>';
      }
      function rrRenderScheduledTrainPage() {
        const page = rrScheduledPage;
        if (!page) return false;
        const card = document.getElementById('rr-train-page-card');
        const slot = document.getElementById('rr-train-page-map-slot');
        const status = document.getElementById('rr-train-page-status');
        const mapEl = document.getElementById('map');
        document.documentElement.classList.add('rr-train-page');
        document.documentElement.classList.remove('rr-train-page-waiting');
        const pageEl = document.getElementById('rr-train-page');
        if (pageEl) pageEl.hidden = false;
        if (status) status.textContent = (page.rname ? page.rname + ' ' : '') + (page.tid || '') + (page.dest ? (' to ' + page.dest) : '');
        if (card) card.innerHTML = rrScheduledPopupHtml(page);
        const grid = card && card.querySelector('.info-grid');
        const body = card && card.querySelector('.train-popup-body');
        if (slot) {
          if (grid && grid.parentNode) grid.parentNode.insertBefore(slot, grid.nextSibling);
          else if (body) body.insertBefore(slot, body.firstChild);
          else if (card) card.appendChild(slot);
        }
        if (mapEl && slot && mapEl.parentNode !== slot) slot.appendChild(mapEl);
        try {
          if (typeof rrApplyOnlyThisTrain === 'function') rrApplyOnlyThisTrain({ id: '__scheduled__', markerMap: {} });
        } catch (e) {}
        rrDrawScheduledRoute(page.stops);
        return true;
      }
      async function rrLoadScheduledSharePage(spec) {
        if (!spec || !spec.id || rrLoadScheduledSharePage._busy) return false;
        const agency = (typeof rrNormShareAgency === 'function') ? rrNormShareAgency(spec.agency) : String(spec.agency || '');
        if (agency && agency !== 'mbta') return false;
        rrLoadScheduledSharePage._busy = true;
        try {
          if (typeof getTripStops !== 'function') return false;
          const stops = await getTripStops(spec.id);
          if (!stops || !stops.length) return false;
          const when = stops.map(s => s.predictedTime || s.scheduledTime).find(Boolean);
          rrScheduledPage = {
            tid: spec.id,
            rname: '',
            origin: (stops[0] && stops[0].name) || '',
            dest: (stops[stops.length - 1] && stops[stops.length - 1].name) || '',
            stops: stops,
            departsMsg: rrDepartsInMsg(when)
          };
          return rrRenderScheduledTrainPage();
        } catch (e) {
          return false;
        } finally {
          rrLoadScheduledSharePage._busy = false;
        }
      }
'''

if 'function rrLoadScheduledSharePage' not in t:
    needle = '      function rrRenderTrainPage() {'
    if needle not in t:
        raise SystemExit('rrRenderTrainPage not found')
    t = t.replace(needle, FN + needle, 1)

old_miss = '''        if (!row) {
          document.documentElement.classList.add('rr-train-page-waiting');
'''
new_miss = '''        if (!row) {
          if (rrScheduledPage) return rrRenderScheduledTrainPage();
          if (typeof rrLoadScheduledSharePage === 'function') rrLoadScheduledSharePage(rrTrainPageSpec);
          document.documentElement.classList.add('rr-train-page-waiting');
'''
if old_miss not in t:
    raise SystemExit('rrRenderTrainPage miss branch not found')
t = t.replace(old_miss, new_miss, 1)

# Prefer live train if it appears later; drop the scheduled overlay.
old_hit = '''        document.documentElement.classList.remove('rr-train-page-waiting');
        if (status) {
          status.textContent = (row.agency || '') + ' ' + (row.trainNum || '') + (row.dest ? (' to ' + row.dest) : '');
        }'''
new_hit = '''        document.documentElement.classList.remove('rr-train-page-waiting');
        rrScheduledPage = null;
        rrClearScheduledLine();
        if (status) {
          status.textContent = (row.agency || '') + ' ' + (row.trainNum || '') + (row.dest ? (' to ' + row.dest) : '');
        }'''
if old_hit in t:
    t = t.replace(old_hit, new_hit, 1)

p.write_text(t, encoding='utf-8')
print('scheduled share page wired')
