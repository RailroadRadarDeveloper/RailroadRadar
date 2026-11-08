/* Discord invitation. Same timing as the old survey card: about a minute on the site,
   counted across pages, then once per visitor. "Maybe Later" asks again after 90 days.
   Storage keys are rr_discord / rr_discord_time, separate from the old survey keys, so
   someone who already dismissed the survey still sees this once.
   Survey links stay in the markup. Set RR_SHOW_SURVEY_LINKS to true to show them again. */
(function () {
  'use strict';
  var RR_SHOW_SURVEY_LINKS = false;
  var DISCORD_INVITE = 'https://discord.gg/6MbvNyv3yv';
  var K_STATE = 'rr_discord';
  var K_TIME = 'rr_discord_time';
  var NEED_S = 60;
  var REASK_MS = 90 * 24 * 60 * 60 * 1000;
  var TICK_MS = 2000;

  function hideSurveyLinks() {
    if (RR_SHOW_SURVEY_LINKS) return;
    var nodes = document.querySelectorAll('a[href="/survey/"], a[href^="/survey/"], a[href="https://railroadradar.com/survey/"], a[href^="https://railroadradar.com/survey/"]');
    for (var i = 0; i < nodes.length; i++) {
      var a = nodes[i];
      var first = '';
      for (var n = a.firstChild; n; n = n.nextSibling) {
        if (n.nodeType === 3 && n.textContent.trim()) { first = n.textContent.trim(); break; }
      }
      if (first !== 'Survey') continue;
      a.hidden = true;
      a.setAttribute('aria-hidden', 'true');
      var li = a.parentElement;
      if (li && li.tagName === 'LI' && li.querySelectorAll('a').length === 1) li.hidden = true;
    }
  }
  hideSurveyLinks();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hideSurveyLinks);

  var path = location.pathname;
  if (/^\/(survey|admin|unavailable)/.test(path)) return;

  function get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function readState() { try { return JSON.parse(get(K_STATE) || 'null'); } catch (_) { return null; } }
  function saveState(s) { set(K_STATE, JSON.stringify({ s: s, at: Date.now() })); }

  var st = readState();
  if (st && st.s === 'done') return;
  if (st && st.at && Date.now() - st.at < REASK_MS) return;
  if (st) {
    try { localStorage.removeItem(K_STATE); } catch (_) {}
    set(K_TIME, '0');
  }

  function visible(el) {
    if (!el || el.hidden) return false;
    if (!el.getClientRects().length) return false;
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }

  function blocked() {
    if (visible(document.getElementById('rr-cookie-bar')) || visible(document.getElementById('rr-cookie'))) return true;
    if (visible(document.getElementById('rr-cookie-modal'))) return true;
    var modals = document.querySelectorAll('[aria-modal="true"]');
    for (var i = 0; i < modals.length; i++) if (visible(modals[i])) return true;
    if (path.indexOf('/stationaudio') === 0) {
      var stop = document.getElementById('stop');
      if (stop && !stop.disabled) return true;
      try { if (window.speechSynthesis && speechSynthesis.speaking) return true; } catch (_) {}
    }
    return false;
  }

  var last = Date.now();
  var timer = 0;
  var card = null;

  function addTime() {
    var now = Date.now();
    var delta = Math.min(now - last, TICK_MS * 2);
    last = now;
    if (document.visibilityState !== 'visible' || delta <= 0) return;
    var t = (parseFloat(get(K_TIME)) || 0) + delta / 1000;
    set(K_TIME, String(Math.round(t * 10) / 10));
  }

  function tick() {
    addTime();
    if (card) return;
    st = readState();
    if (st) { stop(); return; }
    if ((parseFloat(get(K_TIME)) || 0) >= NEED_S && !blocked()) show();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = 0;
  }

  function fixedFooterHeight() {
    var f = document.querySelector('.footer');
    if (!f || !visible(f) || getComputedStyle(f).position !== 'fixed') return 0;
    return f.getBoundingClientRect().height;
  }

  function injectStyle() {
    if (document.getElementById('rr-survey-pop-css')) return;
    var css = '' +
      '.rr-survey-pop{position:fixed;right:16px;bottom:16px;z-index:10050;width:320px;max-width:calc(100vw - 24px);box-sizing:border-box;' +
      'background:#07093e;color:#fff;border:1px solid #2a4a7a;border-radius:4px;box-shadow:0 8px 28px rgba(0,0,0,.35);padding:16px 16px 14px;' +
      "font:14px/1.45 'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;animation:rrSurveyIn .28s ease-out}" +
      '.rr-survey-pop .rr-dc-badge{margin:0 0 10px}' +
      '.rr-survey-pop .rr-dc-badge img{width:40px;height:auto;display:block}' +
      '.rr-survey-pop h2{margin:0 0 6px;font-size:16px;font-weight:700;color:#fff;letter-spacing:0}' +
      '.rr-survey-pop p{margin:0 0 12px;color:#c9d6ec;font-weight:700}' +
      '.rr-survey-pop .rr-sp-row{display:flex;gap:8px}' +
      '.rr-survey-pop a,.rr-survey-pop button{flex:1;display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:8px 10px;box-sizing:border-box;' +
      'border-radius:3px;font-family:inherit;font-size:14px;font-weight:700;line-height:1.2;cursor:pointer;text-decoration:none;border:1px solid #fff}' +
      '.rr-survey-pop a{background:#fff;color:#07093e}' +
      '.rr-survey-pop a:hover{background:#e8eef9}' +
      '.rr-survey-pop button{background:transparent;color:#fff;border-color:#4a6fa5}' +
      '.rr-survey-pop button:hover{border-color:#fff}' +
      '.rr-survey-pop a:focus-visible,.rr-survey-pop button:focus-visible{outline:2px solid #7fb2ff;outline-offset:2px}' +
      '@keyframes rrSurveyIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}' +
      '@media (max-width:600px){.rr-survey-pop{left:12px;right:12px;width:auto;max-width:none}}' +
      '@media (prefers-reduced-motion:reduce){.rr-survey-pop{animation:none}}';
    var el = document.createElement('style');
    el.id = 'rr-survey-pop-css';
    el.textContent = css;
    document.head.appendChild(el);
  }

  function close(state) {
    saveState(state);
    stop();
    if (card && card.parentNode) card.parentNode.removeChild(card);
    card = null;
  }

  function show() {
    injectStyle();
    card = document.createElement('div');
    card.className = 'rr-survey-pop';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-labelledby', 'rr-survey-pop-title');
    card.setAttribute('aria-describedby', 'rr-survey-pop-text');
    var join = '';
    if (DISCORD_INVITE) {
      join = '<a href="' + DISCORD_INVITE + '" id="rr-survey-pop-go" target="_blank" rel="noopener noreferrer">Join Discord</a>';
    }
    card.innerHTML =
      '<div class="rr-dc-badge"><img src="/assets/img/discord-logo-white.png" alt="" width="128" height="98"></div>' +
      '<h2 id="rr-survey-pop-title">Join our Discord Server!</h2>' +
      '<p id="rr-survey-pop-text">Meet the RailroadRadar community and help shape the future of the platform.</p>' +
      '<div class="rr-sp-row">' + join +
      '<button type="button" id="rr-survey-pop-no">Maybe Later</button>' +
      '</div>';
    var fh = fixedFooterHeight();
    if (fh) card.style.bottom = Math.round(fh + 12) + 'px';
    document.body.appendChild(card);
    var go = card.querySelector('#rr-survey-pop-go');
    if (go) go.addEventListener('click', function () { close('opened'); });
    card.querySelector('#rr-survey-pop-no').addEventListener('click', function () { close('dismissed'); });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close('dismissed');
    });
  }

  function start() {
    timer = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', function () { last = Date.now(); });
    window.addEventListener('pagehide', addTime);
    tick();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
