from pathlib import Path

OLD_JS = '''        document.addEventListener('DOMContentLoaded', function() {
          var img = document.querySelector('img.header-logo');
          if (!img) return;
          img.src = '/assets/brand/mytrips-logo.png';
          img.alt = 'MyTrips by RailroadRadar';
          img.onerror = function() {
            img.onerror = null;
            img.src = 'https://i.postimg.cc/8PzqYZ2S/My-Trips-by-Railroad-Radar.png';
          };
        });'''

NEW_JS = '''        document.addEventListener('DOMContentLoaded', function() {
          var img = document.querySelector('img.header-logo');
          if (!img || img.getAttribute('data-mytrips-logo') === '1') return;
          img.setAttribute('data-mytrips-logo', '1');
          img.alt = 'MyTrips by RailroadRadar';
          var pic = document.createElement('picture');
          pic.className = 'header-logo-picture';
          var wide = document.createElement('source');
          wide.media = '(min-width: 768px)';
          wide.srcset = '/assets/brand/mytrips-logo-wide.png';
          img.src = '/assets/brand/mytrips-logo.png';
          img.onerror = function() {
            img.onerror = null;
            img.src = 'https://i.postimg.cc/8PzqYZ2S/My-Trips-by-Railroad-Radar.png';
          };
          if (img.parentNode) {
            img.parentNode.insertBefore(pic, img);
            pic.appendChild(wide);
            pic.appendChild(img);
          }
        });'''

OLD_CSS = '''    html.rr-mytrips-page img.header-logo {
      height: 48px;
      width: auto;
      max-width: min(320px, 46vw);
      object-fit: contain;
    }'''

NEW_CSS = '''    html.rr-mytrips-page .header-logo-picture {
      display: flex;
      align-items: center;
      margin-right: 10px;
      flex: none;
    }
    html.rr-mytrips-page img.header-logo {
      height: 42px;
      width: auto;
      max-width: min(210px, 48vw);
      object-fit: contain;
      margin-right: 0;
    }
    @media (min-width: 768px) {
      html.rr-mytrips-page img.header-logo {
        height: 48px;
        max-width: min(380px, 44vw);
      }
    }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_JS in t:
        t = t.replace(OLD_JS, NEW_JS, 1)
    elif 'mytrips-logo-wide.png' not in t:
        raise SystemExit('logo JS block not found in ' + path)
    if OLD_CSS in t:
        t = t.replace(OLD_CSS, NEW_CSS, 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
