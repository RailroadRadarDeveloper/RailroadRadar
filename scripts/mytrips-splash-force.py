from pathlib import Path

NEW_BLOCK = '''  <div id="mytrips-guest" class="mytrips-guest">
    <div class="mytrips-guest-inner">
      <div class="mytrips-guest-copy">
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
      <div class="mytrips-guest-phone-wrap">
        <img class="mytrips-guest-phone" src="/assets/brand/mytrips-phone.png" alt="MyTrips phone preview">
      </div>
    </div>
  </div>
'''

NEW_CSS = '''    html.rr-mytrips-page.rr-mytrips-guest,
    html.rr-mytrips-page.rr-mytrips-guest body {
      background: #07093e !important;
    }
    .mytrips-guest[hidden] { display: none !important; }
    html.rr-mytrips-page .mytrips-guest {
      min-height: calc(100vh - 64px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 18px 48px;
      background: #07093e;
      color: #fff;
    }
    .mytrips-guest-inner {
      width: min(980px, 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 28px;
      text-align: center;
    }
    @media (min-width: 860px) {
      .mytrips-guest-inner {
        flex-direction: row;
        text-align: left;
        justify-content: space-between;
        align-items: center;
        gap: 40px;
      }
      .mytrips-guest-copy { flex: 1 1 48%; }
      .mytrips-guest-actions { align-items: flex-start; }
    }
    .mytrips-guest-logo {
      height: 56px; width: auto; max-width: min(320px, 80vw); object-fit: contain;
      filter: brightness(0) invert(1);
    }
    .mytrips-guest-kicker { margin: 14px 0 0; font-size: 12px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; color: #c9d4ea; }
    .mytrips-guest h1 { margin: 8px 0 10px; color: #fff; font-size: clamp(28px, 6vw, 40px); line-height: 1.15; }
    .mytrips-guest-lead { margin: 0 auto 18px; max-width: 36em; color: #c9d4ea; font-size: 16px; line-height: 1.5; }
    .mytrips-guest-points { list-style: none; margin: 0 auto 22px; padding: 0; width: min(420px, 100%); color: #fff; font-weight: 600; line-height: 1.55; text-align: left; }
    .mytrips-guest-points li { margin: 0 0 8px; padding-left: 18px; position: relative; }
    .mytrips-guest-points li::before { content: ''; position: absolute; left: 0; top: .55em; width: 8px; height: 8px; background: #fff; border-radius: 50%; }
    .mytrips-guest-actions { display: flex; flex-direction: column; gap: 12px; align-items: center; }
    .mytrips-guest-signin { background: #fff; color: #07093e; border: 0; padding: 14px 22px; font-size: 15px; font-weight: 800; cursor: pointer; }
    .mytrips-guest-map { color: #fff; font-weight: 700; text-decoration: none; }
    .mytrips-guest-phone-wrap { flex: 1 1 42%; display: flex; justify-content: center; }
    .mytrips-guest-phone { width: min(280px, 72vw); height: auto; display: block; filter: drop-shadow(0 18px 40px rgba(0,0,0,.35)); }
'''

def replace_between(t, start, end, new):
    a = t.find(start)
    b = t.find(end, a + 1)
    if a < 0 or b < 0:
        return t, False
    return t[:a] + new + t[b:], True

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t2, ok = replace_between(t, '  <div id="mytrips-guest"', '  <!-- Trip Log lightbox -->', NEW_BLOCK)
    if not ok:
        raise SystemExit('guest html block not found in ' + path)
    t = t2
    # replace existing guest css from first .mytrips-guest[hidden] or .mytrips-guest { through .mytrips-guest-map:hover
    start = t.find('    .mytrips-guest[hidden]')
    if start < 0:
        start = t.find('    .mytrips-guest {')
    end = t.find('    .mytrips-guest-map:hover { text-decoration: underline; }')
    if start >= 0 and end >= 0:
        end = t.find('\n', end + 1)
        t = t[:start] + NEW_CSS + t[end+1:]
    if 'showMyTripsGuestHome();\n      const tryOpen' not in t:
        t = t.replace(
            '      const tryOpen = function() {',
            '      wireMyTripsGuestHome();\n      showMyTripsGuestHome();\n      const tryOpen = function() {',
            1,
        )
    # if firebase missing, still show splash instead of dashboard
    t = t.replace(
        '''        if (!auth) {
          openTripLogModal(null, { tab: 'list', forceModal: true });
          return;
        }''',
        '''        if (!auth) {
          showMyTripsGuestHome();
          return;
        }''',
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('patched', path, 'phone' in t)

patch('index.html')
patch('mytrips/index.html')
