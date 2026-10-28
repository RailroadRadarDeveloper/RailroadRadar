(function () {
  var links = [
    { id: 'map', href: '/map/', label: 'Live Map' },
    { id: 'timetables', href: '/timetables/', label: 'Timetables' },
    { id: 'mytrips', href: '/mytrips/', label: 'MyTrips' },
    { id: 'favorites', href: '/favorites/', label: 'Favorites' },
    { id: 'roster', href: '/roster/', label: 'Roster' },
    { id: 'press', href: '/press/', label: 'Press' },
    { id: 'survey', href: '/survey/', label: 'Survey' }
  ];
  function current() {
    var path = location.pathname.replace(/\/index\.html$/, '/');
    if (path.indexOf('/mytrips') === 0 || document.documentElement.classList.contains('rr-mytrips-page')) return 'mytrips';
    if (path.indexOf('/favorites') === 0) return 'favorites';
    if (path.indexOf('/roster') === 0) return 'roster';
    if (path.indexOf('/press') === 0) return 'press';
    if (path.indexOf('/survey') === 0) return 'survey';
    if (path.indexOf('/timetables') === 0) return 'timetables';
    if (path.indexOf('/map/') === 0 || path === '/map') return 'map';
    return '';
  }
  /* Display theme: 'device' (default, follows prefers-color-scheme), 'light' or 'dark'.
     Stored in localStorage as rr_theme (no value = device); only MyTrips has a dark style so far. */
  var THEME_KEY = 'rr_theme';
  var darkMq = null;
  try { darkMq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null; } catch (_) {}
  function getTheme() {
    try {
      var v = localStorage.getItem(THEME_KEY);
      return v === 'dark' || v === 'light' ? v : 'device';
    } catch (_) { return 'device'; }
  }
  function isDark(theme) {
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
    return !!(darkMq && darkMq.matches);
  }
  function applyTheme(theme) {
    document.documentElement.classList.toggle('rr-theme-dark', isDark(theme));
    document.querySelectorAll('.rr-theme-pick [data-rr-theme]').forEach(function (b) {
      var on = b.getAttribute('data-rr-theme') === theme;
      b.setAttribute('aria-checked', on ? 'true' : 'false');
      b.classList.toggle('is-active', on);
    });
  }
  function setTheme(theme) {
    theme = theme === 'dark' || theme === 'light' ? theme : 'device';
    try {
      if (theme === 'device') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, theme);
    } catch (_) {}
    applyTheme(theme);
    try { window.dispatchEvent(new CustomEvent('rr-theme-change', { detail: { theme: theme } })); } catch (_) {}
  }
  window.rrSetTheme = setTheme;
  window.rrGetTheme = getTheme;
  function themePicker() {
    var wrap = document.createElement('div');
    wrap.className = 'rr-theme-pick';
    wrap.innerHTML = '<span class="rr-theme-pick-label" id="rr-theme-label-' + Math.random().toString(36).slice(2, 7) + '">Theme</span>' +
      '<div class="rr-theme-pick-opts" role="radiogroup">' +
      '<button type="button" role="radio" data-rr-theme="device">Device</button>' +
      '<button type="button" role="radio" data-rr-theme="light">Light</button>' +
      '<button type="button" role="radio" data-rr-theme="dark">Dark</button></div>';
    wrap.querySelector('.rr-theme-pick-opts').setAttribute('aria-labelledby', wrap.firstChild.id);
    wrap.addEventListener('click', function (ev) {
      ev.stopPropagation();
      var b = ev.target.closest('[data-rr-theme]');
      if (b) setTheme(b.getAttribute('data-rr-theme'));
    });
    return wrap;
  }
  function addThemePicker(panel) {
    if (!panel || panel.querySelector('.rr-theme-pick')) return;
    panel.appendChild(themePicker());
    applyTheme(getTheme());
  }
  window.addEventListener('storage', function (ev) { if (ev.key === THEME_KEY) applyTheme(getTheme()); });
  // Device mode follows the OS setting live.
  if (darkMq) {
    var onOsTheme = function () { if (getTheme() === 'device') applyTheme('device'); };
    if (darkMq.addEventListener) darkMq.addEventListener('change', onOsTheme);
    else if (darkMq.addListener) darkMq.addListener(onOsTheme);
  }
  function ensureStyle() {
    if (document.getElementById('rr-site-nav-style')) return;
    var style = document.createElement('style');
    style.id = 'rr-site-nav-style';
    style.textContent = [
      '.rr-site-nav{display:flex;align-items:center;gap:4px;margin-left:12px;min-width:0}',
      '.rr-site-nav a{color:#fff;text-decoration:none;font:700 13px/1 Arial,sans-serif;padding:8px 8px;border-radius:6px;white-space:nowrap}',
      '.rr-site-nav a:hover,.rr-site-nav a[aria-current="page"]{background:rgba(255,255,255,.14)}', '@media (max-width:980px){.rr-site-nav{display:none !important}.rr-page-menu{display:block}.rr-page-menu-btn{background:#fff;color:#07093e;border:0;padding:6px 10px;font:700 12px/1 Arial,sans-serif;cursor:pointer}.rr-page-menu-panel{position:absolute;top:calc(100% + 8px);right:0;min-width:180px;background:#07093e;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px;display:flex;flex-direction:column;gap:4px;z-index:10020}.rr-page-menu-panel[hidden]{display:none}.rr-page-menu-panel a{color:#fff;text-decoration:none;font:700 13px/1 Arial,sans-serif;padding:8px 10px;border-radius:6px}.rr-page-menu-panel a:hover,.rr-page-menu-panel a[aria-current="page"]{background:rgba(255,255,255,.14)}} @media (min-width:981px){.rr-page-menu{display:none}}',
      '.header-tools{position:relative}',
      '.header-tools-panel{position:absolute;top:calc(100% + 8px);right:0;min-width:210px;background:#07093e;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px;z-index:10020;display:flex;flex-direction:column;gap:4px}',
      '.header-tools-panel[hidden]{display:none}',
      '.header-tools-panel .header-auth-btn{width:100%;box-sizing:border-box;margin:0;justify-content:flex-start;text-align:left}',
      'html.rr-mytrips-page #btn-report-train-menu{display:none !important}',
      '.rr-theme-pick{display:flex;flex-direction:column;gap:6px;padding:8px 6px 4px;margin-top:2px;border-top:1px solid rgba(255,255,255,.14)}',
      '.rr-theme-pick:first-child{border-top:0;margin-top:0}',
      '.rr-theme-pick-label{color:rgba(255,255,255,.72);font:500 12px/1 "Google Sans",Roboto,Arial,sans-serif}',
      '.rr-theme-pick-opts{display:flex;border:1px solid rgba(255,255,255,.7);border-radius:4px;overflow:hidden}',
      '.rr-theme-pick-opts button{flex:1;height:32px;margin:0;border:0;border-radius:0;background:transparent;color:#fff;font:600 13px/1 "Google Sans",Roboto,Arial,sans-serif;cursor:pointer;padding:0 10px;white-space:nowrap}',
      '.rr-theme-pick-opts button+button{border-left:1px solid rgba(255,255,255,.7)}',
      '.rr-theme-pick-opts button:hover{background:rgba(255,255,255,.1)}',
      '.rr-theme-pick-opts button.is-active{background:#fff;color:#07093e}',
      '.rr-theme-pick-opts button:focus-visible{outline:2px solid #8fd3ff;outline-offset:-2px}',
      '@media (max-width:760px){.rr-site-nav{gap:0;margin-left:6px}.rr-site-nav a{font-size:12px;padding:7px 6px}}'
    ].join('');
    document.head.appendChild(style);
  }
  function navHtml() {
    var here = current();
    return '<nav class="rr-site-nav" aria-label="RailroadRadar">' + links.map(function (link) {
      return '<a href="' + link.href + '"' + (link.id === here ? ' aria-current="page"' : '') + '>' + link.label + '</a>';
    }).join('') + '</nav>';
  }
  function mount() {
    ensureStyle();
    applyTheme(getTheme());
    var existing = document.querySelector('.rr-site-nav');
    if (existing) {
      var here = current();
      existing.querySelectorAll('a').forEach(function (a) {
        if (a.getAttribute('data-nav') === here) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
    }
    if (!existing) {
      var header = document.querySelector('.header') || document.querySelector('header');
      if (header) {
        var wrap = document.createElement('div');
        wrap.innerHTML = navHtml();
        var nav = wrap.firstChild;
        var right = header.querySelector('.header-right');
        if (right) header.insertBefore(nav, right);
        else header.appendChild(nav);
      }
    }
    if (!document.getElementById('btn-header-tools') && !document.querySelector('.rr-page-menu')) {
      var header = document.querySelector('.header') || document.querySelector('header');
      if (header) {
        var menu = document.createElement('div');
        menu.className = 'rr-page-menu';
        menu.style.position = 'relative';
        menu.innerHTML = '<button type="button" class="rr-page-menu-btn" aria-expanded="false">Menu</button><div class="rr-page-menu-panel" hidden>' + links.map(function (link) {
          return '<a href="' + link.href + '"' + (link.id === current() ? ' aria-current="page"' : '') + '>' + link.label + '</a>';
        }).join('') + '</div>';
        var right = header.querySelector('.header-right') || header;
        right.insertBefore(menu, right.firstChild);
        var pageBtn = menu.querySelector('button');
        var pagePanel = menu.querySelector('.rr-page-menu-panel');
        addThemePicker(pagePanel);
        pageBtn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          pagePanel.hidden = !pagePanel.hidden;
          pageBtn.setAttribute('aria-expanded', pagePanel.hidden ? 'false' : 'true');
        });
        document.addEventListener('click', function (ev) {
          if (!pagePanel.hidden && !menu.contains(ev.target)) {
            pagePanel.hidden = true;
            pageBtn.setAttribute('aria-expanded', 'false');
          }
        });
      }
    }
    var button = document.getElementById('btn-header-tools');
    var panel = document.getElementById('header-tools-panel');
    addThemePicker(panel);
    if (button && panel && !button.dataset.bound) {
      button.dataset.bound = '1';
      button.addEventListener('click', function (ev) {
        ev.stopPropagation();
        var open = panel.hidden;
        panel.hidden = !open;
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      document.addEventListener('click', function (ev) {
        if (!panel.hidden && !panel.contains(ev.target) && ev.target !== button) {
          panel.hidden = true;
          button.setAttribute('aria-expanded', 'false');
        }
      });
      panel.addEventListener('click', function (ev) {
        if (ev.target.closest('button')) {
          panel.hidden = true;
          button.setAttribute('aria-expanded', 'false');
        }
      });
      // When the header is too full, move Report a train into Menu, then the page links too.
      var nav = document.querySelector('.rr-site-nav');
      var root = document.documentElement;
      var crowded = function () {
        if (nav.scrollWidth > nav.clientWidth) return true;
        // Map page: the centered search box also needs room between the logo/links and the buttons
        try { if (typeof window.rrSearchTooTight === 'function' && window.rrSearchTooTight()) return true; } catch (_) {}
        return false;
      };
      var fit = new ResizeObserver(function () {
        root.classList.remove('rr-report-in-menu', 'rr-nav-in-menu');
        if (crowded()) root.classList.add('rr-report-in-menu');
        if (crowded()) root.classList.add('rr-nav-in-menu');
        try { if (typeof window.rrLayoutHeaderSearch === 'function') window.rrLayoutHeaderSearch(); } catch (_) {}
      });
      fit.observe(document.querySelector('.header'));
      fit.observe(document.getElementById('header-auth'));
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
