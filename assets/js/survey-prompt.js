/* Survey invitation: a small card after about a minute on the site (time adds up across pages).
   Shown once per visitor. "Maybe Later" or opening the survey asks again after 90 days; finishing
   the survey (survey/index.html sets state "done") stops it for good. */
(function () {
  'use strict';
  var K_STATE = 'rr_survey';
  var K_TIME = 'rr_survey_time';
  var NEED_S = 60;
  var REASK_MS = 90 * 24 * 60 * 60 * 1000;
  var TICK_MS = 2000;

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
      '.rr-survey-pop h2{margin:0 0 6px;font-size:16px;font-weight:700;color:#fff;letter-spacing:0}' +
      '.rr-survey-pop p{margin:0 0 12px;color:#c9d6ec}' +
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
    card.innerHTML =
      '<h2 id="rr-survey-pop-title">Got a Minute? We\'d Love Your Help</h2>' +
      '<p id="rr-survey-pop-text">We\'re making RailroadRadar better for riders like you. Tell us how you use it and what you\'d like to see next. It only takes about two minutes.</p>' +
      '<div class="rr-sp-row">' +
      '<a href="/survey/?from=popup" id="rr-survey-pop-go">Sure, Let\'s Go</a>' +
      '<button type="button" id="rr-survey-pop-no">Maybe Later</button>' +
      '</div>';
    var fh = fixedFooterHeight();
    if (fh) card.style.bottom = Math.round(fh + 12) + 'px';
    document.body.appendChild(card);
    card.querySelector('#rr-survey-pop-go').addEventListener('click', function () { close('opened'); });
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
