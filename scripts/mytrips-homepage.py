from pathlib import Path

HTML = '''\n  <div id="mytrips-guest" class="mytrips-guest" hidden>
    <div class="mytrips-guest-inner">
      <picture class="mytrips-guest-logo-wrap">
        <source media="(min-width: 768px)" srcset="/assets/brand/mytrips-logo-wide.png">
        <img class="mytrips-guest-logo" src="/assets/brand/mytrips-logo.png" alt="MyTrips by RailroadRadar">
      </picture>
      <p class="mytrips-guest-kicker">By RailroadRadar</p>
      <h1>Your rides, in one place.</h1>
      <p class="mytrips-guest-lead">Log trains, keep your miles, and share trips with a public MyTrips page.</p>
      <ul class="mytrips-guest-points">
        <li>Upcoming and past trips on one dashboard</li>
        <li>Route maps, miles, and train stats on every card</li>
        <li>Share a trip image or your public profile</li>
      </ul>
      <div class="mytrips-guest-actions">
        <button type="button" class="mytrips-guest-signin" id="mytrips-guest-signin">Sign in to open MyTrips</button>
        <a class="mytrips-guest-map" href="/">Back to the live map</a>
      </div>
    </div>
  </div>
'''

CSS = '''
    html.rr-mytrips-page.rr-mytrips-guest #trip-log-modal {
      display: none !important;
    }
    .mytrips-guest {
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px 18px 48px;
      background: linear-gradient(180deg, #f4f6fb 0%, #fff 55%);
    }
    .mytrips-guest-inner {
      width: min(560px, 100%);
      text-align: center;
    }
    .mytrips-guest-logo {
      height: 56px;
      width: auto;
      max-width: min(320px, 80vw);
      object-fit: contain;
    }
    @media (min-width: 768px) {
      .mytrips-guest-logo { height: 52px; max-width: 380px; }
    }
    .mytrips-guest-kicker {
      margin: 14px 0 0;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: .12em;
      text-transform: uppercase;
      color: #07093e;
    }
    .mytrips-guest h1 {
      margin: 8px 0 10px;
      color: #07093e;
      font-size: clamp(28px, 6vw, 40px);
      line-height: 1.15;
    }
    .mytrips-guest-lead {
      margin: 0 auto 18px;
      max-width: 36em;
      color: #3d4656;
      font-size: 16px;
      line-height: 1.5;
    }
    .mytrips-guest-points {
      list-style: none;
      margin: 0 auto 22px;
      padding: 0;
      text-align: left;
      width: min(420px, 100%);
      color: #1a2030;
      font-weight: 600;
      line-height: 1.55;
    }
    .mytrips-guest-points li {
      margin: 0 0 8px;
      padding-left: 18px;
      position: relative;
    }
    .mytrips-guest-points li::before {
      content: '';
      position: absolute;
      left: 0; top: .55em;
      width: 8px; height: 8px;
      background: #07093e;
      border-radius: 50%;
    }
    .mytrips-guest-actions { display: flex; flex-direction: column; gap: 12px; align-items: center; }
    .mytrips-guest-signin {
      background: #07093e;
      color: #fff;
      border: 0;
      padding: 14px 22px;
      font-size: 15px;
      font-weight: 800;
      cursor: pointer;
    }
    .mytrips-guest-map {
      color: #07093e;
      font-weight: 700;
      text-decoration: none;
    }
    .mytrips-guest-map:hover { text-decoration: underline; }
'''

JS = '''
    function showMyTripsGuestHome() {
      const el = document.getElementById('mytrips-guest');
      if (el) el.hidden = false;
      try { document.documentElement.classList.add('rr-mytrips-guest'); } catch (_) {}
      const modal = document.getElementById('trip-log-modal');
      if (modal) {
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
      }
    }
    function hideMyTripsGuestHome() {
      const el = document.getElementById('mytrips-guest');
      if (el) el.hidden = true;
      try { document.documentElement.classList.remove('rr-mytrips-guest'); } catch (_) {}
    }
    function wireMyTripsGuestHome() {
      const btn = document.getElementById('mytrips-guest-signin');
      if (!btn || btn.getAttribute('data-wired') === '1') return;
      btn.setAttribute('data-wired', '1');
      btn.addEventListener('click', function() {
        if (typeof requestGoogleSignIn === 'function') requestGoogleSignIn();
        else {
          const headerBtn = document.getElementById('btn-google-signin');
          if (headerBtn) headerBtn.click();
        }
      });
    }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'id="mytrips-guest"' not in t:
        needle = '  <!-- Trip Log lightbox -->'
        if needle not in t:
            raise SystemExit('modal comment missing in ' + path)
        t = t.replace(needle, HTML + needle, 1)
    if '.mytrips-guest {' not in t:
        t = t.replace('    html.rr-mytrips-page #header-auth {', CSS + '    html.rr-mytrips-page #header-auth {', 1)
    if 'function showMyTripsGuestHome' not in t:
        t = t.replace('    function rrBootstrapMyTripsPage() {', JS + '    function rrBootstrapMyTripsPage() {', 1)
    old = '''          else {
            if (typeof openSignupPrompt === 'function') openSignupPrompt(true);
            else if (typeof showNotification === 'function') showNotification('Sign in to open Trip log.', 'error');
          }'''
    new = '''          else {
            wireMyTripsGuestHome();
            showMyTripsGuestHome();
          }'''
    if old in t:
        t = t.replace(old, new, 1)
    # when signed in from homepage, hide guest and open dashboard
    old_auth = '''          if (user) {
            closeSignupPrompt();'''
    new_auth = '''          if (user) {
            if (typeof hideMyTripsGuestHome === 'function') hideMyTripsGuestHome();
            if (typeof rrIsMyTripsPage === 'function' && rrIsMyTripsPage() && typeof openTripLogModal === 'function') {
              openTripLogModal(null, { tab: 'list', forceModal: true });
            }
            closeSignupPrompt();'''
    if old_auth in t and 'hideMyTripsGuestHome' not in t[t.find('onAuthStateChanged'):t.find('onAuthStateChanged')+500]:
        t = t.replace(old_auth, new_auth, 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path, 'mytrips-guest' in t)

patch('index.html')
patch('mytrips/index.html')
