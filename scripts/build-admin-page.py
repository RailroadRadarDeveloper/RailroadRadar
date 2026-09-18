#!/usr/bin/env python3
"""Build admin.html from index.html and point the map header at /admin.html."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
OUT = ROOT / "admin.html"

src = INDEX.read_text(encoding="utf-8")
lines = src.splitlines()


def line_of(substr, start=0):
    for i in range(start, len(lines)):
        if substr in lines[i]:
            return i
    raise SystemExit("not found: " + substr)


def extract_block(start_substr, from_line=0):
    i = line_of(start_substr, from_line)
    depth = 0
    started = False
    chunk = []
    for j in range(i, len(lines)):
        l = lines[j]
        chunk.append(l)
        depth += l.count("{") - l.count("}")
        if "{" in l:
            started = True
        if started and depth <= 0:
            return "\n".join(chunk)
    raise SystemExit("unclosed: " + start_substr)


def extract_lines(a_sub, b_sub_exclusive=None):
    a = line_of(a_sub)
    if b_sub_exclusive is None:
        return "\n".join(lines[a:])
    b = line_of(b_sub_exclusive)
    return "\n".join(lines[a:b])


header_css = r"""
    :root { --primary-color: #07093e; --text-color: #333; --light-text: #fff; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0; height: 100%; overflow: hidden;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #e8ebf2;
      color: #1a1a2e;
    }
    .header {
      position: fixed; top: 0; left: 0; right: 0; height: 60px;
      background: var(--primary-color); color: #fff;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 16px; z-index: 40; gap: 12px;
    }
    .header-brand { display: flex; align-items: center; gap: 10px; color: #fff; text-decoration: none; font-weight: 800; min-width: 0; flex-shrink: 1; }
    .header-brand img, .header-logo { height: 40px; width: auto; display: block; }
    .header-center { font-weight: 800; letter-spacing: .04em; text-transform: uppercase; font-size: 14px; }
    .header-right { display: flex; align-items: center; gap: 8px; }
    .header-auth { display: flex; align-items: center; gap: 8px; }
    .header-auth-btn {
      background: #fff; color: #07093e; border: none; padding: 7px 12px;
      font-size: 12px; font-weight: 700; cursor: pointer; text-decoration: none; display: inline-block;
    }
    a.header-auth-btn { line-height: 1.2; }
    .header-auth-btn:hover { background: #e8eaf0; }
    .header-auth-user { display: flex; align-items: center; gap: 8px; color: #fff; font-size: 13px; font-weight: 700; }
    .header-user-avatar { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(255,255,255,.85); }
    #notification {
      display: none; position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: #07093e; color: #fff; padding: 12px 18px; z-index: 80; font-weight: 700;
      box-shadow: 0 8px 24px rgba(0,0,0,.25);
    }
    .rr-admin-shell {
      position: fixed; top: 60px; left: 0; right: 0; bottom: 0;
      width: 100%; max-width: none; margin: 0;
      background: #fff; box-shadow: none; z-index: 20;
    }
    .rr-admin-shell .rr-lightbox {
      display: flex; flex-direction: column;
      flex: 1; min-height: 0;
      width: 100%; max-width: none; height: 100%; max-height: none;
      box-shadow: none; overflow: hidden;
    }
    .rr-admin-shell .rr-modal-header { flex-shrink: 0; }
    .rr-admin-shell .rr-admin-tabs {
      flex-shrink: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 10px 24px;
      border-bottom: 1px solid #e8eaef;
      background: #f4f6fa;
      position: static;
      overflow: visible;
    }
    .rr-admin-shell .rr-lightbox-body {
      max-height: none; overflow: auto; flex: 1; min-height: 0;
      padding: 16px 24px 28px;
    }
    .rr-gate {
      max-width: 520px; margin: 120px auto; background: #fff; padding: 28px 24px;
      text-align: center; box-shadow: 0 10px 40px rgba(7,9,62,.12);
    }
    .rr-gate h1 { margin: 0 0 8px; color: #07093e; font-size: 22px; }
    .rr-gate p { color: #5a6577; margin: 0 0 18px; }
    .rr-gate .rr-btn { min-width: 160px; }
    #admin-dashboard { display: none; }
    #admin-dashboard.is-open { display: flex; flex-direction: column; }
    .rr-modal-close { text-decoration: none; }
    @media (max-width: 700px) {
      .header-center { display: none; }
      .header-brand img, .header-logo { height: 28px; }
      .rr-admin-shell { margin: 0; }
      .rr-admin-shell .rr-lightbox-body { padding: 12px 12px 24px; }
      .rr-admin-shell .rr-admin-tabs { padding: 10px 12px; }
      .rr-admin-table { font-size: 11px; }
    }
"""

css_a = line_of(".rr-modal-backdrop {")
css_b = line_of(".admin-badge-icon {")
admin_css = "\n".join(lines[css_a:css_b])
admin_css += """
   .rr-admin-table th {
     position: sticky;
     top: 0;
     z-index: 1;
   }
   .rr-lightbox-body input[type="url"],
   .rr-lightbox-body select {
     box-sizing: border-box;
     padding: 9px 10px;
     border: 1px solid #c5cad3;
     font-size: 14px;
     font-family: inherit;
     width: 100%;
   }
   .rr-lightbox-body label {
     display: block;
     font-size: 12px;
     font-weight: 700;
     color: #07093e;
     margin: 10px 0 4px;
   }
"""

html_a = line_of('id="admin-dashboard-modal"')
html_b = line_of("<!-- Toast Notification -->")
admin_html = "\n".join(lines[html_a:html_b])
admin_html = admin_html.replace(
    '<div class="rr-modal-backdrop" id="admin-dashboard-modal" aria-hidden="true">',
    '<div class="rr-admin-shell" id="admin-dashboard" aria-hidden="true">',
)
admin_html = admin_html.replace(
    '<div class="rr-modal rr-lightbox" role="dialog" aria-modal="true" aria-labelledby="admin-dashboard-title">',
    '<div class="rr-lightbox" role="main" aria-labelledby="admin-dashboard-title">',
)
admin_html = admin_html.replace(
    '<button type="button" class="rr-modal-close" id="admin-dashboard-close" aria-label="Close">×</button>',
    '<a class="rr-modal-close" id="admin-dashboard-close" href="https://railroadradar.com/" aria-label="Back to map">×</a>',
)
import re
admin_html = re.sub(
    r'(<div class="rr-lightbox-body">)\s*(<div class="rr-admin-tabs" role="tablist">[\s\S]*?</div>\s*)',
    r'\2\1',
    admin_html,
    count=1,
)

js_parts = []
js_parts.append(extract_lines("const FIREBASE_CONFIG = {", "const RR_EMBEDDED_ASSETS = {"))
js_parts.append("    const AUDIT_LOG_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;")
js_parts.append("""
    function rrAssetUrl(url) {
      const u = String(url == null ? '' : url).trim();
      if (!u) return u;
      if (/^data:/i.test(u) || /^https?:\\/\\//i.test(u)) return u;
      return (u.charAt(0) === '/' ? u : '/' + u);
    }
    let firebaseApp = null;
    let auth = null;
    let db = null;
    let currentUser = null;
    let currentUserSettings = { reportDisplayMode: 'first_initial', reportCustomLabel: '', interestedRailroads: [], interestedRailroadsSet: false, reportStats: null, legalAccepted: false, legalVersion: null };
    let currentAdminPerms = null;
    let verifiedReporterUids = new Set();
""")

needed = [
    "const BOOTSTRAP_ADMIN_EMAILS",
    "const ALL_ADMIN_PERMS",
    "function normalizeEmail",
    "function isBootstrapAdmin",
    "async function loadAdminRecord",
    "async function getAdminPerms",
    "function isAdminUser",
    "async function ensureBootstrapAdminDoc",
    "async function upsertAccountMirror",
    "async function refreshAdminState",
    "function updateAdminChrome",
    "async function loadUserSettings",
    "async function checkUserBanned",
    "function escapeHtmlLite",
    "async function loadVerifiedReporters",
    "function isVerifiedReporterUid",
    "function reporterShowsVerifiedBadge",
    "function reporterNameWithBadgeHtml",
    "function formatAdminWhen",
    "function setAdminError",
    "function switchAdminTab",
    "async function loadAdminTab",
    "function formatTrainReportLocoLabelAdmin",
    "async function loadAdminReports",
    "function renderAdminReports",
    "async function adminDeleteReport",
    "async function loadAdminBans",
    "async function adminBanUser",
    "async function adminUnbanUser",
    "async function resolveUidEmailFromReports",
    "async function loadAdminVerified",
    "async function adminVerifyReporter",
    "async function adminUnverifyReporter",
    "function readPermCheckboxes",
    "async function loadAdminAdmins",
    "async function adminAddAdmin",
    "async function adminSavePerms",
    "async function adminRemoveAdmin",
    "function specialUnitDocId",
    "function escapeAdminHtml",
    "function clearAdminRosterForm",
    "function fillAdminRosterForm",
    "function renderAdminRoster",
    "async function loadAdminRoster",
    "async function adminSaveSpecialUnit",
    "async function adminDeleteSpecialUnit",
    "function adminTsSeconds",
    "function accountRowUid",
    "function accountRowNewer",
    "function mergeAccountRowFields",
    "function dedupeAdminAccountRows",
    "async function loadAdminAccounts",
    "function formatAdminCookieCell",
    "function formatAdminLegalCell",
    "function renderAdminAccounts",
    "async function adminToggleReportHold",
    "async function loadAdminPendingReports",
    "function formatAuditAction",
    "function auditLogCutoffDate",
    "function rrEasternDateKey",
    "function rrMsUntilEasternMidnight",
    "async function purgeExpiredAuditLog",
    "function scheduleAuditLogMidnightPurge",
    "async function loadAdminAuditLog",
    "function renderAdminAuditLog",
    "function renderAdminPendingReports",
    "async function adminApprovePendingReport",
    "async function adminRejectPendingReport",
    "function adminAccountsPrefillVerify",
    "function adminAccountsPrefillBan",
    "function wireAccountAndAdminUI",
    "function showNotification",
    "function logUserAction",
    "async function signInWithGoogle",
    "async function signOutGoogle",
]
missing = []
for name in needed:
    try:
        js_parts.append(extract_block(name))
    except SystemExit:
        missing.append(name)

js_parts.append(extract_lines("const BUILTIN_SPECIAL_UNITS_ROSTER = [", "const MBTA_LOCO_TYPES = {"))

boot = r"""
    function closeAccountSettingsLightbox() {}
    function openAccountSettingsLightbox() {}
    function closeAccountMenu() {}
    function closeSignupPrompt() {}
    function closeLegalAcceptModal() {}
    function closeInterestRailroadsModal() {}
    function scheduleSignupPrompt() {}
    function persistCookieConsentToAccount() { return Promise.resolve(); }
    function readLocalCookiePrefs() { return null; }
    function isLegalPending() { return false; }
    function persistLegalAcceptance() { return Promise.resolve(); }

    async function openAdminDashboard() {
      const user = currentUser || (auth && auth.currentUser);
      if (!user) { showGate('signin'); return; }
      await refreshAdminState(user);
      if (!isAdminUser(user)) { showGate('forbidden'); return; }
      setAdminError('');
      const dash = document.getElementById('admin-dashboard');
      if (dash) {
        dash.classList.add('is-open');
        dash.setAttribute('aria-hidden', 'false');
      }
      hideGate();
      const perms = currentAdminPerms || {};
      const ids = {
        reports: 'admin-tab-reports', pending: 'admin-tab-pending', audit: 'admin-tab-audit',
        bans: 'admin-tab-bans', admins: 'admin-tab-admins', roster: 'admin-tab-roster',
        verified: 'admin-tab-verified', accounts: 'admin-tab-accounts'
      };
      const tabReports = document.getElementById(ids.reports);
      const tabPending = document.getElementById(ids.pending);
      const tabAudit = document.getElementById(ids.audit);
      const tabBans = document.getElementById(ids.bans);
      const tabAdmins = document.getElementById(ids.admins);
      if (tabReports) tabReports.style.display = perms.viewReports ? '' : 'none';
      if (tabPending) tabPending.style.display = perms.viewReports ? '' : 'none';
      if (tabAudit) tabAudit.style.display = perms.viewReports ? '' : 'none';
      if (tabBans) tabBans.style.display = perms.banUsers ? '' : 'none';
      if (tabAdmins) tabAdmins.style.display = perms.manageAdmins ? '' : 'none';
      let first = perms.viewReports ? 'reports' : (perms.banUsers ? 'bans' : (perms.manageAdmins ? 'admins' : 'roster'));
      switchAdminTab(first);
      await loadAdminTab(first);
    }
    function closeAdminDashboard() { window.location.href = 'https://railroadradar.com/'; }
    function showGate(which) {
      const dash = document.getElementById('admin-dashboard');
      if (dash) { dash.classList.remove('is-open'); dash.setAttribute('aria-hidden', 'true'); }
      document.getElementById('gate-loading').style.display = which === 'loading' ? 'block' : 'none';
      document.getElementById('gate-signin').style.display = which === 'signin' ? 'block' : 'none';
      document.getElementById('gate-forbidden').style.display = which === 'forbidden' ? 'block' : 'none';
    }
    function hideGate() {
      document.getElementById('gate-loading').style.display = 'none';
      document.getElementById('gate-signin').style.display = 'none';
      document.getElementById('gate-forbidden').style.display = 'none';
    }
    function updateHeaderAuthUI(user) {
      const btnIn = document.getElementById('btn-google-signin');
      const userWrap = document.getElementById('header-auth-user');
      const avatar = document.getElementById('header-user-avatar');
      const nameEl = document.getElementById('header-account-name-text');
      if (btnIn) btnIn.style.display = user ? 'none' : '';
      if (userWrap) userWrap.style.display = user ? 'flex' : 'none';
      if (user && avatar) {
        const photo = user.photoURL || '';
        avatar.style.display = photo ? '' : 'none';
        if (photo) avatar.src = photo;
      }
      if (nameEl) nameEl.textContent = user ? (user.displayName || user.email || 'Account') : '';
    }

    const firebaseConfigured = FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey !== 'YOUR_FIREBASE_API_KEY';
    if (firebaseConfigured && typeof firebase !== 'undefined') {
      try {
        firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
        auth = firebase.auth();
        db = firebase.firestore();
      } catch (e) { console.error('[Firebase] Init failed', e); }
    }

    document.addEventListener('DOMContentLoaded', function() {
      const btnIn = document.getElementById('btn-google-signin');
      const btnOut = document.getElementById('btn-google-signout');
      const gateSignin = document.getElementById('gate-signin-btn');
      if (btnIn) btnIn.addEventListener('click', function(e) { e.preventDefault(); signInWithGoogle(); });
      if (gateSignin) gateSignin.addEventListener('click', function(e) { e.preventDefault(); signInWithGoogle(); });
      if (btnOut) btnOut.addEventListener('click', function() { signOutGoogle(); });
      wireAccountAndAdminUI();
      showGate('loading');
      if (!auth) { showGate('signin'); return; }
      auth.onAuthStateChanged(async function(user) {
        currentUser = user;
        updateHeaderAuthUI(user);
        if (user) {
          try { await loadUserSettings(user.uid); } catch (_) {}
          try { await upsertAccountMirror(user); } catch (_) {}
          try { await loadVerifiedReporters(); } catch (_) {}
          try { await loadSpecialUnitsFromFirestore(); } catch (_) {}
          await refreshAdminState(user);
          if (isAdminUser(user)) await openAdminDashboard();
          else showGate('forbidden');
        } else {
          currentAdminPerms = null;
          showGate('signin');
        }
      });
    });
"""
js_parts.append(boot)

page = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard · RailroadRadar</title>
  <meta name="theme-color" content="#07093e">
  <meta name="robots" content="noindex,nofollow">
  <link rel="icon" type="image/png" sizes="32x32" href="https://railroadradar.com/assets/icons/favicon-32.png?v=3">
  <link rel="apple-touch-icon" href="https://railroadradar.com/apple-touch-icon.png?v=2">
  <script src="https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.14.0/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.14.0/firebase-firestore-compat.js"></script>
  <style>
{header_css}
{admin_css}
  </style>
</head>
<body>
  <div class="header">
    <a class="header-brand" href="https://railroadradar.com/">
      <img class="header-logo" src="https://railroadradar.com/assets/brand/railroadradar-wordmark.png" alt="RailroadRadar">
    </a>
    <div class="header-center">Admin Dashboard</div>
    <div class="header-right">
      <a class="header-auth-btn" href="https://railroadradar.com/">Back to map</a>
      <div class="header-auth" id="header-auth">
        <button type="button" class="header-auth-btn" id="btn-google-signin">Sign in</button>
        <div class="header-auth-user" id="header-auth-user" style="display:none;">
          <img class="header-user-avatar" id="header-user-avatar" alt="Account" width="34" height="34" referrerpolicy="no-referrer">
          <span id="header-account-name-text">Account</span>
          <button type="button" class="header-auth-btn" id="btn-google-signout">Sign out</button>
        </div>
      </div>
    </div>
  </div>

  <div class="rr-gate" id="gate-loading">
    <h1>Admin Dashboard</h1>
    <p>Checking your account…</p>
  </div>
  <div class="rr-gate" id="gate-signin" style="display:none;">
    <h1>Sign in required</h1>
    <p>Sign in with the Google account that has RailroadRadar admin access.</p>
    <button type="button" class="rr-btn" id="gate-signin-btn">Sign in with Google</button>
  </div>
  <div class="rr-gate" id="gate-forbidden" style="display:none;">
    <h1>Admin access required</h1>
    <p>This page is only for RailroadRadar admins. You’re signed in, but this account isn’t on the admin list.</p>
    <a class="rr-btn secondary" href="https://railroadradar.com/" style="display:inline-block;text-decoration:none;">Back to map</a>
  </div>

{admin_html}

  <div id="notification"><span id="notification-text"></span></div>
  <script>
{chr(10).join(js_parts)}
  </script>
</body>
</html>
"""
OUT.write_text(page, encoding="utf-8")
print("wrote", OUT, "bytes", OUT.stat().st_size)
if missing:
    print("MISSING FUNCTIONS:")
    for m in missing:
        print(" -", m)

idx = INDEX.read_text(encoding="utf-8")
old = """      if (adminHeaderBtn) adminHeaderBtn.addEventListener('click', function(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        openAdminDashboard();
      });"""
new = """      if (adminHeaderBtn) adminHeaderBtn.addEventListener('click', function(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        window.location.href = '/admin.html';
      });"""
if old not in idx:
    raise SystemExit("admin header click handler not found")
idx = idx.replace(old, new, 1)

old2 = """    async function openAdminDashboard() {
      const user = currentUser || (auth && auth.currentUser);
      if (!user) {
        showNotification('Sign in required.', 'error');
        return;
      }"""
new2 = """    async function openAdminDashboard() {
      window.location.href = '/admin.html';
      return;
      const user = currentUser || (auth && auth.currentUser);
      if (!user) {
        showNotification('Sign in required.', 'error');
        return;
      }"""
if old2 in idx:
    idx = idx.replace(old2, new2, 1)
else:
    print("WARN openAdminDashboard not patched")

INDEX.write_text(idx, encoding="utf-8")
print("patched index.html")
