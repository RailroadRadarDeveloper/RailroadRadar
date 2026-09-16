      function rrEtParts(date) {
        const d = date instanceof Date ? date : new Date(date);
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', hourCycle: 'h23'
        }).formatToParts(d);
        const get = function(t) {
          for (let i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value;
          return '';
        };
        const wdMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), wd: wdMap[get('weekday')] != null ? wdMap[get('weekday')] : 1, hour: Number(get('hour')) };
      }
      function rrEtMidnightMs(y, m, d) {
        const mm = String(m).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const iso = y + '-' + mm + '-' + dd + 'T00:00:00';
        const cands = [iso + '-04:00', iso + '-05:00'];
        for (let i = 0; i < cands.length; i++) {
          const t = Date.parse(cands[i]);
          if (!t) continue;
          const p = rrEtParts(new Date(t));
          if (p.y === y && p.m === m && p.d === d && p.hour === 0) return t;
        }
        return Date.parse(iso + '-04:00');
      }
      function rrAddDaysYmd(y, m, d, days) {
        const dt = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
        return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
      }
      function rrWeekWindow(offsetWeeks) {
        const nowP = rrEtParts(new Date());
        const back = (nowP.wd + 6) % 7;
        const mon = rrAddDaysYmd(nowP.y, nowP.m, nowP.d, -back + (offsetWeeks || 0) * 7);
        const next = rrAddDaysYmd(mon.y, mon.m, mon.d, 7);
        const startMs = rrEtMidnightMs(mon.y, mon.m, mon.d);
        const endMs = rrEtMidnightMs(next.y, next.m, next.d);
        const pad = function(n) { return String(n).padStart(2, '0'); };
        return { startMs: startMs, endMs: endMs, weekId: mon.y + '-' + pad(mon.m) + '-' + pad(mon.d), monday: mon, nextMonday: next };
      }
      function rrFmtWeekRange(win) {
        try {
          const a = new Date(win.startMs);
          const b = new Date(win.endMs - 1000);
          const opts = { timeZone: 'America/New_York', month: 'short', day: 'numeric' };
          return a.toLocaleDateString('en-US', opts) + ' \u2013 ' + b.toLocaleDateString('en-US', opts);
        } catch (_) { return win.weekId; }
      }
      function rrLeaderboardDisplayName(row) {
        const raw = String(row.name || row.label || '').trim();
        if (raw && raw.toLowerCase() !== 'anonymous') return firstInitialLabel(raw, row.email || '');
        return firstInitialLabel('', row.email || '') || 'Anonymous';
      }
      function rrLeaderboardInitials(name) {
        const p = String(name || '').replace(/\./g, '').trim().split(/\s+/).filter(Boolean);
        if (!p.length) return '?';
        if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
        return (p[0].charAt(0) + p[p.length - 1].charAt(0)).toUpperCase();
      }
      function rrReportUids(rep) {
        const ids = [];
        function add(id) {
          const u = String(id || '').trim();
          if (u && ids.indexOf(u) === -1) ids.push(u);
        }
        add(rep && rep.firstReportedByUid);
        add(rep && rep.reportedByUid);
        if (rep && Array.isArray(rep.contributors)) rep.contributors.forEach(function(c) { if (c) add(c.uid); });
        return ids;
      }
      function rrReportNameForUid(rep, uid) {
        if (!rep) return '';
        if (rep.firstReportedByUid === uid && rep.firstReportedByLabel) return String(rep.firstReportedByLabel);
        if (rep.reportedByUid === uid && rep.reportedByLabel) return String(rep.reportedByLabel);
        if (Array.isArray(rep.contributors)) {
          for (let i = 0; i < rep.contributors.length; i++) {
            const c = rep.contributors[i];
            if (c && c.uid === uid && (c.label || c.name)) return String(c.label || c.name);
          }
        }
        return String(rep.reportedByLabel || rep.firstReportedByLabel || '');
      }
      function rrReportPhotoForUid(rep, uid) {
        if (!rep) return '';
        if (rep.reportedByUid === uid && rep.reportedByPhotoURL) return String(rep.reportedByPhotoURL);
        if (Array.isArray(rep.contributors)) {
          for (let i = 0; i < rep.contributors.length; i++) {
            const c = rep.contributors[i];
            if (c && c.uid === uid && c.photoURL) return String(c.photoURL);
          }
        }
        return '';
      }
      function buildWeeklyLeaderboardRows(offsetWeeks) {
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
        });
        const ptsEach = (typeof RR_POINTS_PER_REPORT === 'number') ? RR_POINTS_PER_REPORT : 5;
        const list = Object.keys(byUid).map(function(uid) {
          const r = byUid[uid];
          const reports = Object.keys(r.docs).filter(Boolean).length;
          return { uid: uid, name: rrLeaderboardDisplayName(r), photoURL: r.photoURL || '', reports: reports, points: reports * ptsEach };
        }).filter(function(r) { return r.reports > 0; });
        list.sort(function(a, b) {
          if (b.reports !== a.reports) return b.reports - a.reports;
          if (b.points !== a.points) return b.points - a.points;
          return String(a.name).localeCompare(String(b.name));
        });
        return { week: win, rows: list };
      }
      function rrLbPhotoHtml(url, name, extraClass) {
        const cls = extraClass || 'rr-lb-row-photo';
        if (url) return '<img class="' + cls + '" src="' + escapeHtmlLite(url) + '" alt="" width="40" height="40" referrerpolicy="no-referrer">';
        return '<span class="' + cls + ' placeholder">' + escapeHtmlLite(rrLeaderboardInitials(name)) + '</span>';
      }
      async function hydrateLeaderboardPhotos(rows) {
        if (!db || !rows || !rows.length) return rows;
        const missing = rows.filter(function(r) { return r.uid && !r.photoURL; }).slice(0, 40);
        await Promise.all(missing.map(function(r) {
          return db.collection('accounts').doc(r.uid).get().then(function(snap) {
            if (snap && snap.exists) {
              const d = snap.data() || {};
              if (d.photoURL) r.photoURL = d.photoURL;
              if ((!r.name || r.name === 'Anonymous') && d.displayName) r.name = firstInitialLabel(d.displayName, d.email || '');
            }
          }).catch(function() {});
        }));
        return rows;
      }
      async function loadSavedWeekWinner(weekId) {
        if (!db || !weekId) return null;
        try {
          const snap = await db.collection('leaderboardWeeks').doc(weekId).get();
          if (snap.exists) return Object.assign({ weekId: weekId }, snap.data() || {});
        } catch (_) {}
        return null;
      }
      async function saveWeekWinner(weekId, winner) {
        if (!db || !weekId || !winner) return winner;
        try {
          const ref = db.collection('leaderboardWeeks').doc(weekId);
          const snap = await ref.get();
          if (snap.exists) return Object.assign({ weekId: weekId }, snap.data() || {}, winner);
          await ref.set({
            weekId: weekId, uid: winner.uid || null, name: winner.name || '',
            photoURL: winner.photoURL || null, reports: winner.reports || 0, points: winner.points || 0,
            savedAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.warn('[leaderboard] save winner skipped', err && err.message ? err.message : err);
        }
        return winner;
      }
      async function renderWeeklyLeaderboard() {
        const listEl = document.getElementById('weekly-leaderboard-list');
        const emptyEl = document.getElementById('weekly-leaderboard-empty');
        const rangeEl = document.getElementById('weekly-leaderboard-range');
        const winWrap = document.getElementById('weekly-leaderboard-winner');
        const winText = document.getElementById('weekly-leaderboard-winner-text');
        const winPhoto = document.getElementById('weekly-leaderboard-winner-photo-slot');
        if (typeof loadTrainReports === 'function' && (!allTrainReports || !allTrainReports.length)) {
          try { await loadTrainReports(); } catch (_) {}
        }
        const current = buildWeeklyLeaderboardRows(0);
        await hydrateLeaderboardPhotos(current.rows);
        if (rangeEl) rangeEl.textContent = 'This week \u00b7 ' + rrFmtWeekRange(current.week) + ' \u00b7 ' + ((typeof RR_POINTS_PER_REPORT === 'number') ? RR_POINTS_PER_REPORT : 5) + ' points per report';
        if (!current.rows.length) {
          if (listEl) listEl.innerHTML = '';
          if (emptyEl) emptyEl.hidden = false;
        } else {
          if (emptyEl) emptyEl.hidden = true;
          if (listEl) {
            listEl.innerHTML = current.rows.map(function(r, i) {
              return '<div class="rr-lb-row">' +
                '<div class="rr-lb-rank">' + (i + 1) + '</div>' +
                rrLbPhotoHtml(r.photoURL, r.name) +
                '<div class="rr-lb-name">' + escapeHtmlLite(r.name) + '</div>' +
                '<div class="rr-lb-meta"><strong>' + r.points + ' pts</strong>' + r.reports + ' report' + (r.reports === 1 ? '' : 's') + '</div>' +
                '</div>';
            }).join('');
          }
        }
        const last = buildWeeklyLeaderboardRows(-1);
        await hydrateLeaderboardPhotos(last.rows);
        let winner = last.rows[0] || null;
        const saved = await loadSavedWeekWinner(last.week.weekId);
        if (saved && saved.uid) {
          winner = { uid: saved.uid, name: saved.name || (winner && winner.name) || 'Anonymous', photoURL: saved.photoURL || (winner && winner.photoURL) || '', reports: Number(saved.reports) || (winner && winner.reports) || 0, points: Number(saved.points) || (winner && winner.points) || 0 };
        } else if (winner) {
          await saveWeekWinner(last.week.weekId, winner);
        }
        if (winner && winner.reports > 0) {
          if (winWrap) winWrap.hidden = false;
          if (winPhoto) winPhoto.innerHTML = rrLbPhotoHtml(winner.photoURL, winner.name, 'rr-lb-winner-photo');
          if (winText) {
            winText.innerHTML = '<strong>' + escapeHtmlLite(winner.name) + '</strong> won last week\'s leaderboard with a total of <strong>' +
              winner.reports + '</strong> report' + (winner.reports === 1 ? '' : 's') +
              ' and <strong>' + winner.points + '</strong> points!';
          }
        } else {
          if (winWrap) winWrap.hidden = true;
          if (winText) winText.textContent = '';
          if (winPhoto) winPhoto.innerHTML = '';
        }
      }
      function openWeeklyLeaderboard() {
        const modal = document.getElementById('weekly-leaderboard-modal');
        if (modal) { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); }
        try {
          const panel = document.getElementById('control-panel');
          const overlay = document.getElementById('overlay');
          if (panel) panel.classList.remove('open');
          if (overlay) overlay.classList.remove('open');
        } catch (_) {}
        renderWeeklyLeaderboard();
      }
      function closeWeeklyLeaderboard() {
        const modal = document.getElementById('weekly-leaderboard-modal');
        if (modal) { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
      }
      function wireWeeklyLeaderboardUI() {
        const btnH = document.getElementById('btn-leaderboard-header');
        const btnP = document.getElementById('btn-leaderboard-panel');
        const btnC = document.getElementById('weekly-leaderboard-close');
        const modal = document.getElementById('weekly-leaderboard-modal');
        if (btnH) btnH.addEventListener('click', openWeeklyLeaderboard);
        if (btnP) btnP.addEventListener('click', openWeeklyLeaderboard);
        if (btnC) btnC.addEventListener('click', closeWeeklyLeaderboard);
        if (modal) modal.addEventListener('click', function(e) { if (e.target === modal) closeWeeklyLeaderboard(); });
      }
