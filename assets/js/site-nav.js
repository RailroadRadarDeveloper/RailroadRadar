(function () {
  var links = [
    { id: 'map', href: '/', label: 'Live map' },
    { id: 'mytrips', href: '/mytrips/', label: 'MyTrips' },
    { id: 'favorites', href: '/favorites/', label: 'Favorites' },
    { id: 'press', href: '/press/', label: 'Press' }
  ];
  function current() {
    var path = location.pathname.replace(/\/index\.html$/, '/');
    if (path.indexOf('/mytrips') === 0 || document.documentElement.classList.contains('rr-mytrips-page')) return 'mytrips';
    if (path.indexOf('/favorites') === 0) return 'favorites';
    if (path.indexOf('/press') === 0) return 'press';
    if (path === '/' || path === '') return 'map';
    return '';
  }
  function ensureStyle() {
    if (document.getElementById('rr-site-nav-style')) return;
    var style = document.createElement('style');
    style.id = 'rr-site-nav-style';
    style.textContent = [
      '.rr-site-nav{display:flex;align-items:center;gap:4px;margin-left:12px;min-width:0}',
      '.rr-site-nav a{color:#fff;text-decoration:none;font:700 13px/1 Arial,sans-serif;padding:8px 8px;border-radius:6px;white-space:nowrap}',
      '.rr-site-nav a:hover,.rr-site-nav a[aria-current="page"]{background:rgba(255,255,255,.14)}',
      '.header-tools{position:relative}',
      '.header-tools-panel{position:absolute;top:calc(100% + 8px);left:0;min-width:210px;background:#07093e;border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:6px;z-index:10020;display:flex;flex-direction:column;gap:4px}',
      '.header-tools-panel[hidden]{display:none}',
      '.header-tools-panel .header-auth-btn{width:100%;justify-content:flex-start;text-align:left}',
      'html.rr-mytrips-page .header-tools{display:none}',
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
    var button = document.getElementById('btn-header-tools');
    var panel = document.getElementById('header-tools-panel');
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
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
