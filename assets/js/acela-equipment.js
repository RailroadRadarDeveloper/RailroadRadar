/* Acela Equipment reports (live map): riders report ahead of time which Acela trains run as
   NextGen (Avelia Liberty) or Legacy equipment between two dates. Reports live in Firestore
   `acelaEquipment`; Acela train popups show today's majority with the newest agreeing reporter,
   e.g. "Reported by Arturo K. and 2 Others". Names follow the rider's report display setting and
   the verified badge, the same as Reported Unit reports (reportedByLabel / reportedByVerified).
   Report from the popup's Report Equipment button or the Menu's Report Acela Equipment.
   ?equipSample=1 (or window.rrAcelaEquipSample) uses clearly marked sample data and writes nothing. */
(function () {
  'use strict';
  var COLLECTION = 'acelaEquipment';
  var MAX_DAYS_AHEAD = 180;   // how far ahead a report may reach (open question)
  var MAX_SPAN_DAYS = 120;    // longest From → Until range one report may cover
  var TYPES = { nextgen: 'NextGen', legacy: 'Legacy' };
  var TYPE_DETAIL = { nextgen: 'Avelia Liberty', legacy: 'Original Acela' };

  var reports = [];
  var loaded = false;
  var loading = null;

  function sampleMode() {
    try { return !!window.rrAcelaEquipSample || /[?&]equipSample=1(&|$)/.test(location.search); } catch (_) { return false; }
  }

  // YYYY-MM-DD in Eastern time, the Northeast Corridor's local date.
  function easternDate(d) {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
      var get = function (t) { return (parts.find(function (p) { return p.type === t; }) || {}).value; };
      return get('year') + '-' + get('month') + '-' + get('day');
    } catch (_) {
      return d.toISOString().slice(0, 10);
    }
  }
  function addDays(ymd, n) {
    var d = new Date(ymd + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function daysBetween(a, b) {
    return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
  }
  function prettyDate(ymd) {
    var d = new Date(ymd + 'T12:00:00Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // Acela numbers are 2100–2299 on Amtrak; a train whose route says Acela always counts.
  function isAcelaNumber(n) {
    var v = parseInt(String(n || '').replace(/\D/g, ''), 10);
    return v >= 2100 && v <= 2299;
  }
  function isAcela(num, route) {
    return /acela/i.test(String(route || '')) || isAcelaNumber(num);
  }

  // ---- Sample data (mockup only) ----
  function sampleReports() {
    var today = easternDate(new Date());
    return [
      // 2153: today three riders say Legacy and one says NextGen (shows the Legacy map icon).
      { id: 's1', trainNumber: '2153', from: today, until: addDays(today, 30), type: 'legacy', uid: 'sample-a', reportedByLabel: 'Sample Rider A.', reportedByVerified: true, createdAtMs: 4 },
      { id: 's2', trainNumber: '2153', from: today, until: addDays(today, 20), type: 'legacy', uid: 'sample-b', reportedByLabel: 'Sample Rider B.', reportedByVerified: false, createdAtMs: 3 },
      { id: 's3', trainNumber: '2153', from: today, until: addDays(today, 14), type: 'legacy', uid: 'sample-c', reportedByLabel: 'Sample Rider C.', reportedByVerified: false, createdAtMs: 2 },
      { id: 's4', trainNumber: '2153', from: today, until: addDays(today, 7), type: 'nextgen', uid: 'sample-d', reportedByLabel: 'Sample Rider D.', reportedByVerified: false, createdAtMs: 5 },
      // 2160: two riders say NextGen today (keeps the current NextGen icon).
      { id: 's6', trainNumber: '2160', from: today, until: addDays(today, 21), type: 'nextgen', uid: 'sample-f', reportedByLabel: 'Sample Rider F.', reportedByVerified: false, createdAtMs: 2 },
      { id: 's7', trainNumber: '2160', from: today, until: addDays(today, 10), type: 'nextgen', uid: 'sample-g', reportedByLabel: 'Sample Rider G.', reportedByVerified: false, createdAtMs: 1 },
      // 2104: one rider says Legacy, starting in 10 days (nothing for today).
      { id: 's5', trainNumber: '2104', from: addDays(today, 10), until: addDays(today, 40), type: 'legacy', uid: 'sample-e', reportedByLabel: 'Sample Rider E.', reportedByVerified: false, createdAtMs: 1 }
    ];
  }

  function load() {
    if (loading) return loading;
    if (!sampleMode() && !(window.firebase && firebase.apps && firebase.apps.length)) return Promise.resolve(reports);
    loading = new Promise(function (resolve) {
      if (sampleMode()) { reports = sampleReports(); loaded = true; resolve(reports); return; }
      try {
        var fs = window.firebase && firebase.firestore ? firebase.firestore() : null;
        if (!fs) { loaded = true; resolve(reports); return; }
        // One range filter on `until`: reports that have not ended yet. No composite index needed.
        fs.collection(COLLECTION).where('until', '>=', easternDate(new Date())).limit(500).get().then(function (snap) {
          reports = snap.docs.map(function (d) { var x = d.data() || {}; x.id = d.id; return x; });
          loaded = true; resolve(reports);
        }).catch(function (e) { console.warn('[acela-equip] load failed', e); loaded = true; resolve(reports); });
      } catch (e) { loaded = true; resolve(reports); }
    });
    return loading;
  }

  function reportAt(r) {
    return r.createdAt && r.createdAt.toMillis ? r.createdAt.toMillis() : (r.createdAtMs || 0);
  }

  // Majority for one train on one date. One vote per rider (their newest matching report).
  // latest is the newest report among the majority, whose reporter the label names.
  function summarize(trainNumber, ymd) {
    var byUid = {};
    reports.forEach(function (r) {
      if (String(r.trainNumber) !== String(trainNumber)) return;
      if (!(r.from <= ymd && ymd <= r.until)) return;
      if (!TYPES[r.type]) return;
      var prev = byUid[r.uid];
      var at = reportAt(r);
      if (!prev || at >= prev.at) byUid[r.uid] = { type: r.type, at: at, r: r };
    });
    var counts = { nextgen: 0, legacy: 0 };
    var latest = { nextgen: null, legacy: null };
    Object.keys(byUid).forEach(function (u) {
      var v = byUid[u];
      counts[v.type]++;
      if (!latest[v.type] || v.at >= latest[v.type].at) latest[v.type] = v;
    });
    var total = counts.nextgen + counts.legacy;
    if (!total) return null;
    var top = counts.nextgen >= counts.legacy ? 'nextgen' : 'legacy';
    return { type: top, count: counts[top], total: total, tie: counts.nextgen === counts.legacy, counts: counts,
      latest: latest[top] ? latest[top].r : null };
  }

  // Reporter name as stored with the report (the rider's display setting at report time),
  // with the verified badge drawn the same way as Reported Unit reports.
  function reporterHtml(r) {
    var name = String((r && r.reportedByLabel) || '').trim() || 'A Rider';
    try {
      if (typeof reporterNameWithBadgeHtml === 'function') {
        return reporterNameWithBadgeHtml(name, { uid: r && r.uid, verified: !!(r && r.reportedByVerified) });
      }
    } catch (_) {}
    return esc(name);
  }

  function sourceHtml(sum) {
    if (sum.tie) return esc('Riders Are Split, ' + sum.counts.nextgen + ' and ' + sum.counts.legacy);
    var others = sum.count - 1;
    var html = 'Reported by ' + reporterHtml(sum.latest);
    if (others > 0) html += ' and ' + others + (others === 1 ? ' Other' : ' Others');
    return html;
  }
  // Riders who disagree with the majority, shown small under the label.
  function splitText(sum) {
    if (sum.tie) return '';
    var other = sum.type === 'nextgen' ? 'legacy' : 'nextgen';
    var n = sum.counts[other];
    return n ? (n + (n === 1 ? ' Rider Says ' : ' Riders Say ') + TYPES[other]) : '';
  }

  // ---- Live map popup block (Acela trains) ----
  // app-main.js createAmtrakPopupContent calls this; returns '' for non-Acela trains.
  function popupBlockInner(num) {
    var today = easternDate(new Date());
    var sum = loaded ? summarize(num, today) : null;
    var body;
    if (!loaded) {
      body = '<div class="acela-equip-pop-label">Equipment Today</div><div class="acela-equip-pop-type is-empty">Checking Reports...</div>';
    } else if (!sum) {
      body = '<div class="acela-equip-pop-label">Equipment Today</div><div class="acela-equip-pop-type is-empty">No Reports Yet</div>';
    } else {
      var main = sum.tie ? 'NextGen or Legacy' : TYPES[sum.type];
      body = '<div class="acela-equip-pop-label">Equipment Today</div>' +
        '<div class="acela-equip-pop-type" data-type="' + (sum.tie ? 'split' : sum.type) + '">' + esc(main) + '</div>' +
        '<div class="acela-equip-pop-src">' + sourceHtml(sum) + '</div>' +
        (splitText(sum) ? '<div class="acela-equip-pop-split">' + esc(splitText(sum)) + '</div>' : '');
    }
    if (sampleMode()) body += '<div class="acela-equip-pop-sample"><span class="acela-equip-sample">Sample Data</span></div>';
    var safe = String(num).replace(/[^0-9]/g, '');
    return '<div class="loco-report-text">' + body + '</div>' +
      '<button type="button" class="popup-action-btn update-pairing-btn acela-equip-pop-btn" onclick="rrAcelaEquipReport(\'' + safe + '\')">Report Equipment</button>';
  }
  function popupHtml(num, route) {
    num = String(num || '').trim();
    if (!num || !isAcela(num, route)) return '';
    if (!loaded) load().then(refreshPopups);
    return '<div class="loco-report-block acela-equip-pop" data-acela-train="' + esc(num) + '">' + popupBlockInner(num) + '</div>';
  }
  // Map icon: true only when today's majority is Legacy (a tie, NextGen or no reports keep the NextGen icon).
  function isLegacyToday(num) {
    num = String(num || '').trim();
    if (!num) return false;
    if (!loaded) { load().then(refreshPopups); return false; }
    var sum = summarize(num, easternDate(new Date()));
    return !!(sum && !sum.tie && sum.type === 'legacy');
  }
  // Fill in any open popup once reports arrive or change, and swap Acela map icons to match.
  function refreshPopups() {
    try { if (window.rrAcelaEquipRefreshIcons) window.rrAcelaEquipRefreshIcons(); } catch (_) {}
    document.querySelectorAll('.acela-equip-pop[data-acela-train]').forEach(function (n) {
      n.innerHTML = popupBlockInner(n.getAttribute('data-acela-train'));
    });
  }

  // Signed-out riders get the same sign-in prompt the map uses for Report a Train.
  function requireSignIn() {
    if (currentUid()) return true;
    try { showNotification('Sign in to report Acela equipment.', 'error'); } catch (_) {}
    var b = document.getElementById('btn-google-signin');
    if (b) b.click();
    return false;
  }
  function reportFromPopup(num) {
    if (!requireSignIn()) return;
    var today = easternDate(new Date());
    openForm({ trainNumber: String(num || ''), from: today, until: today });
  }
  function reportFromMenu() {
    try {
      var panel = document.getElementById('header-tools-panel');
      var tb = document.getElementById('btn-header-tools');
      if (panel && !panel.hidden && tb) tb.click();
    } catch (_) {}
    if (!requireSignIn()) return;
    openForm({});
  }

  // ---- Report Equipment form ----
  function el(id) { return document.getElementById(id); }
  var chosenType = '';

  function setType(t) {
    chosenType = t;
    document.querySelectorAll('#acela-equip-modal .acela-equip-choice').forEach(function (b) {
      var on = b.getAttribute('data-type') === t;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function currentSummaryHtml(num) {
    if (!isAcelaNumber(num)) return '';
    var mine = reports.filter(function (r) { return String(r.trainNumber) === String(num) && TYPES[r.type]; })
      .sort(function (a, b) { return a.from < b.from ? -1 : a.from > b.from ? 1 : reportAt(b) - reportAt(a); });
    if (!mine.length) return '<p class="acela-equip-none">No reports yet for Acela ' + esc(num) + '. Yours would be the first.</p>';
    return '<p class="acela-equip-current-title">Reports for Acela ' + esc(num) + '</p><ul class="acela-equip-current">' +
      mine.slice(0, 6).map(function (r) {
        return '<li><span class="acela-equip-type" data-type="' + r.type + '">' + TYPES[r.type] + '</span> ' +
          esc(prettyDate(r.from)) + ' to ' + esc(prettyDate(r.until)) +
          ' <span class="acela-equip-by">by ' + reporterHtml(r) + '</span></li>';
      }).join('') + '</ul>';
  }

  function refreshFormSummary() {
    var box = el('acela-equip-current-box');
    if (box) box.innerHTML = currentSummaryHtml(String(el('acela-equip-train').value || '').trim());
  }

  function setError(msg) {
    var e = el('acela-equip-error');
    if (!e) return;
    e.textContent = msg || '';
    e.classList.toggle('visible', !!msg);
  }

  function openForm(opts) {
    opts = opts || {};
    var modal = el('acela-equip-modal');
    if (!modal) return;
    var today = easternDate(new Date());
    var train = el('acela-equip-train'), from = el('acela-equip-from'), until = el('acela-equip-until');
    train.value = opts.trainNumber || '';
    from.min = today; until.min = today;
    from.max = addDays(today, MAX_DAYS_AHEAD); until.max = addDays(today, MAX_DAYS_AHEAD);
    from.value = opts.from || today;
    until.value = opts.until || opts.from || today;
    setType(opts.type || '');
    setError('');
    el('acela-equip-sample-note').hidden = !sampleMode();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    load().then(refreshFormSummary);
    refreshFormSummary();
    try { (opts.trainNumber ? from : train).focus({ preventScroll: true }); } catch (_) {}
  }

  function closeForm() {
    var modal = el('acela-equip-modal');
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function currentUid() {
    try { if (typeof rrAuthUser === 'function') { var u = rrAuthUser(); if (u) return u.uid; } } catch (_) {}
    try { return firebase.auth().currentUser.uid; } catch (_) { return ''; }
  }

  // Same public identity as Report a Train: the label from the rider's display setting, the
  // display mode, and the verified flag. No email or raw account name is stored.
  function reporterIdentity() {
    var user = null;
    try { user = (typeof rrAuthUser === 'function' && rrAuthUser()) || firebase.auth().currentUser; } catch (_) {}
    var settings = null;
    try { settings = typeof currentUserSettings !== 'undefined' ? currentUserSettings : null; } catch (_) {}
    var mode = (settings && settings.reportDisplayMode) || 'first_initial';
    var label = '';
    try { if (typeof computeReporterLabel === 'function') label = computeReporterLabel(settings, user && user.displayName, user && user.email); } catch (_) {}
    label = String(label || 'Anonymous').slice(0, 120);
    var verified = false;
    try { verified = !!(user && typeof isVerifiedReporterUid === 'function' && isVerifiedReporterUid(user.uid)); } catch (_) {}
    return { label: label, mode: mode, verified: verified };
  }

  function submit() {
    var num = String(el('acela-equip-train').value || '').trim();
    var from = el('acela-equip-from').value, until = el('acela-equip-until').value;
    var today = easternDate(new Date());
    if (!isAcelaNumber(num)) return setError('Enter an Acela train number, like 2153.');
    if (!from || !until) return setError('Pick a From date and an Until date.');
    if (from < today) return setError('From can be today or later.');
    if (until < from) return setError('Until has to be on or after From.');
    if (daysBetween(today, until) > MAX_DAYS_AHEAD) return setError('Reports can reach up to ' + MAX_DAYS_AHEAD + ' days ahead.');
    if (daysBetween(from, until) > MAX_SPAN_DAYS) return setError('One report can cover up to ' + MAX_SPAN_DAYS + ' days.');
    if (!TYPES[chosenType]) return setError('Choose NextGen or Legacy.');
    var uid = currentUid();
    if (!uid) { setError('Sign in to report equipment.'); requireSignIn(); return; }
    setError('');
    var who = reporterIdentity();
    var doc = { trainNumber: num, from: from, until: until, type: chosenType, uid: uid,
      reportedByLabel: who.label, reportedByDisplayMode: who.mode, reportedByVerified: who.verified };
    var done = function () {
      reports.push(Object.assign({ id: 'local-' + Date.now(), createdAtMs: Date.now() }, doc));
      closeForm();
      refreshPopups();
      try { showNotification(sampleMode() ? 'Sample report added on this page only' : 'Thanks! Your report helps other riders.'); } catch (_) {}
    };
    if (sampleMode()) return done();
    var btn = el('acela-equip-save');
    btn.disabled = true;
    firebase.firestore().collection(COLLECTION).add(Object.assign({}, doc, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }))
      .then(done)
      .catch(function (e) { console.warn('[acela-equip] save failed', e); setError('Could not save your report. Try again in a moment.'); })
      .then(function () { btn.disabled = false; });
  }

  function wire() {
    var modal = el('acela-equip-modal');
    if (!modal || modal.getAttribute('data-wired') === '1') return;
    modal.setAttribute('data-wired', '1');
    el('acela-equip-close').addEventListener('click', closeForm);
    el('acela-equip-cancel').addEventListener('click', closeForm);
    el('acela-equip-save').addEventListener('click', submit);
    el('acela-equip-train').addEventListener('input', refreshFormSummary);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeForm(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) closeForm(); });
    modal.querySelectorAll('.acela-equip-choice').forEach(function (b) {
      b.addEventListener('click', function () { setType(b.getAttribute('data-type')); });
    });
    var entry = el('btn-acela-equip-menu');
    if (entry) entry.addEventListener('click', reportFromMenu);
  }

  window.rrAcelaEquipPopupHtml = popupHtml;
  window.rrAcelaEquipReport = reportFromPopup;
  window.rrAcelaEquipOpen = openForm;
  window.rrAcelaEquipSummarize = summarize;
  window.rrAcelaEquipIsLegacy = isLegacyToday;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  if (sampleMode()) load().then(refreshPopups);
})();
