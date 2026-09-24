from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        '''    function rrGoHomeFromMyTrips() {
      try { location.href = '/'; } catch (_) { location.href = '/index.html'; }
    }''',
        '''    function rrGoHomeFromMyTrips() {
      try { location.href = '/mytrips/'; } catch (_) { location.href = '/mytrips/index.html'; }
    }''',
        1,
    )
    t = t.replace("logo.setAttribute('title', 'Home');", "logo.setAttribute('title', 'MyTrips');", 1)
    # also make picture wrapper clickable
    old = '''        const logo = document.querySelector('.header-logo');
        if (logo) {
          logo.style.cursor = 'pointer';
          logo.addEventListener('click', function() { rrGoHomeFromMyTrips(); });
          logo.setAttribute('title', 'MyTrips');
          logo.setAttribute('role', 'link');
        }'''
    new = '''        const logo = document.querySelector('.header-logo-picture') || document.querySelector('.header-logo');
        if (logo) {
          logo.style.cursor = 'pointer';
          logo.addEventListener('click', function(e) {
            e.preventDefault();
            rrGoHomeFromMyTrips();
          });
          logo.setAttribute('title', 'MyTrips');
          logo.setAttribute('role', 'link');
        }'''
    if old in t:
        t = t.replace(old, new, 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path, "location.href = '/mytrips/'" in t)

patch('index.html')
patch('mytrips/index.html')
