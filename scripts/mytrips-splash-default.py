from pathlib import Path

OLD_HTML = '''    <div class="mytrips-guest-inner">
      <picture class="mytrips-guest-logo-wrap">
        <source media="(min-width: 768px)" srcset="/assets/brand/mytrips-logo-wide.png">
        <img class="mytrips-guest-logo" src="/assets/brand/mytrips-logo.png" alt="MyTrips by RailroadRadar">
      </picture>'''

NEW_HTML = '''    <div class="mytrips-guest-inner">
      <div class="mytrips-guest-copy">
      <picture class="mytrips-guest-logo-wrap">
        <source media="(min-width: 768px)" srcset="/assets/brand/mytrips-logo-wide.png">
        <img class="mytrips-guest-logo" src="/assets/brand/mytrips-logo.png" alt="MyTrips by RailroadRadar">
      </picture>'''

OLD_ACTIONS_END = '''        <a class="mytrips-guest-map" href="/">Back to the live map</a>
      </div>
    </div>
  </div>'''

NEW_ACTIONS_END = '''        <a class="mytrips-guest-map" href="/">Back to the live map</a>
      </div>
      </div>
      <div class="mytrips-guest-phone-wrap">
        <img class="mytrips-guest-phone" src="/assets/brand/mytrips-phone.png" alt="MyTrips on a phone">
      </div>
    </div>
  </div>'''

OLD_BG = '''    .mytrips-guest {
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
    }'''

NEW_BG = '''    html.rr-mytrips-page.rr-mytrips-guest,
    html.rr-mytrips-page.rr-mytrips-guest body {
      background: #07093e !important;
    }
    .mytrips-guest {
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px 18px 48px;
      background: #07093e;
      color: #fff;
    }
    .mytrips-guest-inner {
      width: min(980px, 100%);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 28px;
    }
    @media (min-width: 860px) {
      .mytrips-guest-inner {
        flex-direction: row;
        text-align: left;
        align-items: center;
        justify-content: space-between;
        gap: 40px;
      }
      .mytrips-guest-copy { flex: 1 1 46%; }
      .mytrips-guest-points { text-align: left; margin-left: 0; }
      .mytrips-guest-actions { align-items: flex-start; }
    }
    .mytrips-guest-phone-wrap {
      flex: 1 1 42%;
      display: flex;
      justify-content: center;
    }
    .mytrips-guest-phone {
      width: min(280px, 70vw);
      height: auto;
      display: block;
      filter: drop-shadow(0 18px 40px rgba(0,0,0,.35));
    }'''

# light text on navy
COLOR_SWAPS = [
    ('.mytrips-guest-kicker {\n      margin: 14px 0 0;\n      font-size: 12px;\n      font-weight: 800;\n      letter-spacing: .12em;\n      text-transform: uppercase;\n      color: #07093e;',
     '.mytrips-guest-kicker {\n      margin: 14px 0 0;\n      font-size: 12px;\n      font-weight: 800;\n      letter-spacing: .12em;\n      text-transform: uppercase;\n      color: #c9d4ea;'),
    ('.mytrips-guest h1 {\n      margin: 8px 0 10px;\n      color: #07093e;',
     '.mytrips-guest h1 {\n      margin: 8px 0 10px;\n      color: #fff;'),
]

OLD_TICK = '''      const tryOpen = function() {
        if (!auth) {
          openTripLogModal(null, { tab: 'list', forceModal: true });
          return;
        }
        // wait briefly for first auth callback
        let tries = 0;
        const tick = function() {
          tries++;
          if (currentUser || (auth && auth.currentUser)) {
            hideMyTripsGuestHome();
            openTripLogModal(null, { tab: 'list', forceModal: true });
            return;
          }
          if (tries < 40) setTimeout(tick, 100);
          else {
            wireMyTripsGuestHome();
            showMyTripsGuestHome();
          }
        };
        tick();
      };
      tryOpen();'''

NEW_TICK = '''      wireMyTripsGuestHome();
      showMyTripsGuestHome();
      const tryOpen = function() {
        const readyUser = currentUser || (auth && auth.currentUser);
        if (readyUser) {
          hideMyTripsGuestHome();
          openTripLogModal(null, { tab: 'list', forceModal: true });
          return;
        }
        let tries = 0;
        const tick = function() {
          tries++;
          if (currentUser || (auth && auth.currentUser)) {
            hideMyTripsGuestHome();
            openTripLogModal(null, { tab: 'list', forceModal: true });
            return;
          }
          if (tries < 50) setTimeout(tick, 100);
        };
        tick();
      };
      tryOpen();'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_HTML in t and 'mytrips-guest-phone' not in t:
        t = t.replace(OLD_HTML, NEW_HTML, 1)
    if OLD_ACTIONS_END in t and 'mytrips-guest-phone' not in t:
        t = t.replace(OLD_ACTIONS_END, NEW_ACTIONS_END, 1)
    if OLD_BG in t:
        t = t.replace(OLD_BG, NEW_BG, 1)
    for a,b in COLOR_SWAPS:
        if a in t:
            t = t.replace(a, b, 1)
    t = t.replace('color: #3d4656;', 'color: #c9d4ea;')  # lead text - careful global?
    # only if leftover lead still dark — do targeted
    t = t.replace('.mytrips-guest-lead {\n      margin: 0 auto 18px;\n      max-width: 36em;\n      color: #3d4656;', '.mytrips-guest-lead {\n      margin: 0 auto 18px;\n      max-width: 36em;\n      color: #c9d4ea;')
    t = t.replace('.mytrips-guest-points {\n      list-style: none;\n      margin: 0 auto 22px;\n      padding: 0;\n      text-align: left;\n      width: min(420px, 100%);\n      color: #1a2030;', '.mytrips-guest-points {\n      list-style: none;\n      margin: 0 auto 22px;\n      padding: 0;\n      text-align: left;\n      width: min(420px, 100%);\n      color: #fff;')
    t = t.replace('.mytrips-guest-signin {\n      background: #07093e;\n      color: #fff;', '.mytrips-guest-signin {\n      background: #fff;\n      color: #07093e;')
    t = t.replace('.mytrips-guest-map {\n      color: #07093e;', '.mytrips-guest-map {\n      color: #fff;')
    if OLD_TICK in t:
        t = t.replace(OLD_TICK, NEW_TICK, 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
