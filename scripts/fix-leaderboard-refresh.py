#!/usr/bin/env python3
"""Force weekly leaderboard to reload reports and count this-week activity."""
from pathlib import Path

path = Path("index.html")
text = path.read_text(encoding="utf-8")

old_build = """      function buildWeeklyLeaderboardRows(offsetWeeks) {
        const win = rrWeekWindow(offsetWeeks);
        const byUid = {};
        const rowsSrc = (typeof allTrainReports !== 'undefined' && allTrainReports && allTrainReports.length)
          ? allTrainReports
          : ((typeof trainReports !== 'undefined' && trainReports) ? trainReports : []);
        (rowsSrc || []).forEach(function(rep) {
          const when = parseReportTimestamp((rep && (rep.createdAt || rep.updatedAt)) || null);
          if (!when) return;
          const ms = when.getTime();
          if (ms < win.startMs || ms >= win.endMs) return;
          rrReportUids(rep).forEach(function(uid) {
            if (!byUid[uid]) byUid[uid] = { uid: uid, docs: {}, name: '', photoURL: '', email: '' };
            byUid[uid].docs[String(rep.id || '')] = true;
            const nm = rrReportNameForUid(rep, uid);
            if (nm && (!byUid[uid].name || byUid[uid].name === 'Anonymous')) byUid[uid].name = nm;
            const ph = rrReportPhotoForUid(rep, uid);
            if (ph && !byUid[uid].photoURL) byUid[uid].photoURL = ph;
          });
        });"""

new_build = """      function rrTsInWeek(ts, win) {
        const d = parseReportTimestamp(ts);
        if (!d || !win) return false;
        const ms = d.getTime();
        return ms >= win.startMs && ms < win.endMs;
      }
      function rrServiceDateInWeek(rep, win) {
        const sd = String((rep && rep.serviceDate) || '').trim();
        if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(sd) || !win) return false;
        const p = sd.split('-').map(Number);
        const ms = rrEtMidnightMs(p[0], p[1], p[2]);
        return ms >= win.startMs && ms < win.endMs;
      }
      function rrUidsActiveInWeek(rep, win) {
        const ids = [];
        function add(id) {
          const u = String(id || '').trim();
          if (u && ids.indexOf(u) === -1) ids.push(u);
        }
        if (!rep || !win) return ids;
        if (Array.isArray(rep.contributors)) {
          rep.contributors.forEach(function(c) {
            if (!c) return;
            if (c.at != null) {
              if (rrTsInWeek(c.at, win)) add(c.uid);
            } else if (rrTsInWeek(rep.updatedAt, win) && c.uid === rep.reportedByUid) {
              add(c.uid);
            }
          });
        }
        if (rrTsInWeek(rep.updatedAt, win)) add(rep.reportedByUid);
        if (rrTsInWeek(rep.createdAt, win)) add(rep.firstReportedByUid || rep.reportedByUid);
        if (rrTsInWeek(rep.submittedAt, win)) add(rep.reportedByUid);
        if (!ids.length && rrServiceDateInWeek(rep, win)) {
          rrReportUids(rep).forEach(add);
        }
        if (!ids.length && (rrTsInWeek(rep.updatedAt || rep.createdAt, win) || rrServiceDateInWeek(rep, win))) {
          const label = String(rep.reportedByLabel || rep.firstReportedByLabel || '').trim();
          if (label) add('label:' + label.toLowerCase());
        }
        return ids;
      }
      function buildWeeklyLeaderboardRows(offsetWeeks) {
        const win = rrWeekWindow(offsetWeeks);
        const byUid = {};
        const rowsSrc = (typeof allTrainReports !== 'undefined' && allTrainReports && allTrainReports.length)
          ? allTrainReports
          : ((typeof trainReports !== 'undefined' && trainReports) ? trainReports : []);
        (rowsSrc || []).forEach(function(rep) {
          rrUidsActiveInWeek(rep, win).forEach(function(uid) {
            if (!byUid[uid]) byUid[uid] = { uid: uid, docs: {}, name: '', photoURL: '', email: '' };
            byUid[uid].docs[String(rep.id || uid + ':' + (rep.serviceDate || ''))] = true;
            const nm = rrReportNameForUid(rep, uid.indexOf('label:') === 0 ? (rep.reportedByUid || '') : uid) || (uid.indexOf('label:') === 0 ? uid.slice(6) : '');
            if (nm && (!byUid[uid].name || byUid[uid].name === 'Anonymous')) byUid[uid].name = nm;
            const ph = rrReportPhotoForUid(rep, uid);
            if (ph && !byUid[uid].photoURL) byUid[uid].photoURL = ph;
          });
        });"""

old_render_load = """        if (typeof loadTrainReports === 'function' && (!allTrainReports || !allTrainReports.length)) {
          try { await loadTrainReports(); } catch (_) {}
        }"""

new_render_load = """        if (typeof loadTrainReports === 'function') {
          try { await loadTrainReports(); } catch (_) {}
        }"""

old_updated_html = """        <p class=\"rr-lb-empty\" id=\"weekly-leaderboard-empty\" hidden>No train reports this week yet. Report a consist to get on the board.</p>
        <p class=\"rr-lb-updated\" id=\"weekly-leaderboard-updated\">Updated at —</p>"""

new_updated_html = """        <p class=\"rr-lb-empty\" id=\"weekly-leaderboard-empty\" hidden>No train reports this week yet. Report a consist to get on the board.</p>
        <p class=\"rr-lb-updated\"><span id=\"weekly-leaderboard-updated\">Updated at —</span> · <button type=\"button\" class=\"rr-lb-refresh\" id=\"weekly-leaderboard-refresh\">Refresh</button></p>"""

old_wire = """      function wireWeeklyLeaderboardUI() {
        const btnH = document.getElementById('btn-leaderboard-header');
        const btnP = document.getElementById('btn-leaderboard-panel');
        const btnC = document.getElementById('weekly-leaderboard-close');
        const modal = document.getElementById('weekly-leaderboard-modal');
        if (btnH) btnH.addEventListener('click', openWeeklyLeaderboard);
        if (btnP) btnP.addEventListener('click', openWeeklyLeaderboard);
        if (btnC) btnC.addEventListener('click', closeWeeklyLeaderboard);
        if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeWeeklyLeaderboard(); });
      }"""

new_wire = """      function wireWeeklyLeaderboardUI() {
        const btnH = document.getElementById('btn-leaderboard-header');
        const btnP = document.getElementById('btn-leaderboard-panel');
        const btnC = document.getElementById('weekly-leaderboard-close');
        const btnR = document.getElementById('weekly-leaderboard-refresh');
        const modal = document.getElementById('weekly-leaderboard-modal');
        if (btnH) btnH.addEventListener('click', openWeeklyLeaderboard);
        if (btnP) btnP.addEventListener('click', openWeeklyLeaderboard);
        if (btnC) btnC.addEventListener('click', closeWeeklyLeaderboard);
        if (btnR) btnR.addEventListener('click', function() { renderWeeklyLeaderboard(); });
        if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeWeeklyLeaderboard(); });
      }"""

old_css = """    .rr-lb-updated {
      margin: 14px 0 0;
      padding-top: 10px;
      border-top: 1px solid #e6e9ef;
      font-size: 12px;
      color: #5a6577;
      text-align: center;
    }"""

new_css = """    .rr-lb-updated {
      margin: 14px 0 0;
      padding-top: 10px;
      border-top: 1px solid #e6e9ef;
      font-size: 12px;
      color: #5a6577;
      text-align: center;
    }
    .rr-lb-refresh {
      background: none;
      border: none;
      color: #1d4ed8;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
    }"""

old_load_meta = """          window.__rrTrainReportsLoadedAt = Date.now();
          try { if (typeof onTrainReportsUpdated === 'function') onTrainReportsUpdated(trainReports); } catch (_) {}"""

new_load_meta = """          window.__rrTrainReportsLoadedAt = Date.now();
          window.__rrTrainReportsLoadMeta = { fromServer: true, live: false, count: allTrainReports.length };
          try { if (typeof onTrainReportsUpdated === 'function') onTrainReportsUpdated(trainReports); } catch (_) {}"""

old_submit = """        await ref.set(data, { merge: true });
        try {
          if (typeof window.logUserAction === 'function') {
            await window.logUserAction('submit_report', (agency + ' ' + (trainNumber || vehicleId)).trim());
          }
        } catch (_) {}"""

new_submit = """        await ref.set(data, { merge: true });
        try {
          const localRow = Object.assign({ id: docId }, data, {
            createdAt: existing.exists ? Date.now() : Date.now(),
            updatedAt: Date.now()
          });
          delete localRow.reportedByEmail;
          delete localRow.reportedByName;
          delete localRow.firstReportedByEmail;
          delete localRow.firstReportedByName;
          if (existing.exists) {
            const prev = (allTrainReports || []).find(function(r) { return r && r.id === docId; });
            if (prev && prev.createdAt) localRow.createdAt = prev.createdAt;
          }
          const ix = allTrainReports.findIndex(function(r) { return r && r.id === docId; });
          if (ix >= 0) allTrainReports[ix] = Object.assign({}, allTrainReports[ix], localRow);
          else allTrainReports.push(localRow);
          window.__rrTrainReportsLoadedAt = Date.now();
          const lbOpen = document.getElementById('weekly-leaderboard-modal');
          if (lbOpen && lbOpen.classList.contains('open') && typeof renderWeeklyLeaderboard === 'function') {
            renderWeeklyLeaderboard();
          }
        } catch (_) {}
        try {
          if (typeof window.logUserAction === 'function') {
            await window.logUserAction('submit_report', (agency + ' ' + (trainNumber || vehicleId)).trim());
          }
        } catch (_) {}"""

replacements = [
    ("build rows", old_build, new_build),
    ("force reload", old_render_load, new_render_load),
    ("updated html", old_updated_html, new_updated_html),
    ("wire refresh", old_wire, new_wire),
    ("updated css", old_css, new_css),
    ("load meta", old_load_meta, new_load_meta),
    ("submit cache", old_submit, new_submit),
]

missing = []
for name, old, new in replacements:
    if old not in text:
        missing.append(name)
        print("MISSING:", name)
    else:
        text = text.replace(old, new, 1)
        print("OK:", name)

if missing:
    raise SystemExit("Failed patches: " + ", ".join(missing))

path.write_text(text, encoding="utf-8")
print("Patched index.html")
