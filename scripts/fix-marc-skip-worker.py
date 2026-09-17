from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

old = (
    "      const MARC_POSITIONS_URL = apiUrl('/api/marc/positions');\n"
    "      const MARC_TRIPUPDATES_URL = apiUrl('/api/marc/tripupdates');\n"
)
new = '''      function marcFeedUrl(path) {
        try { return (typeof rrAssetUrl === 'function') ? rrAssetUrl(path) : path; } catch (_) { return path; }
      }
      function marcFetchFirstOk(urls, label) {
        return (async function() {
          let last = null;
          for (let i = 0; i < urls.length; i++) {
            const u = urls[i];
            try {
              const res = await fetch(u, { cache: 'no-store' });
              if (res && res.ok) return res;
              last = new Error(label + ' HTTP ' + (res && res.status));
            } catch (e) { last = e; }
          }
          throw last || new Error(label + ' unavailable');
        })();
      }
      const MARC_POSITIONS_URLS = [
        marcFeedUrl('/feeds/marc-vp.pb'),
        'https://raw.githubusercontent.com/RailroadRadarDeveloper/RailroadRadar/main/feeds/marc-vp.pb'
      ];
      const MARC_TRIPUPDATES_URLS = [
        marcFeedUrl('/feeds/marc-tu.pb'),
        'https://raw.githubusercontent.com/RailroadRadarDeveloper/RailroadRadar/main/feeds/marc-tu.pb'
      ];
      const MARC_POSITIONS_URL = MARC_POSITIONS_URLS[0];
      const MARC_TRIPUPDATES_URL = MARC_TRIPUPDATES_URLS[0];
'''

if old in s:
    s = s.replace(old, new, 1)
elif "marcFeedUrl('/feeds/marc-vp.pb')" in s and "apiUrl('/api/marc/positions')" not in s:
    print('already patched constants')
else:
    raise SystemExit('URL constants not found')

old2 = (
    "          const [posRes, tuRes] = await Promise.all([\n"
    "            fetch(MARC_POSITIONS_URL),\n"
    "            fetch(MARC_TRIPUPDATES_URL)\n"
    "          ]);\n"
)
new2 = (
    "          const [posRes, tuRes] = await Promise.all([\n"
    "            marcFetchFirstOk(MARC_POSITIONS_URLS, 'positions'),\n"
    "            marcFetchFirstOk(MARC_TRIPUPDATES_URLS, 'tripupdates')\n"
    "          ]);\n"
)
if old2 in s:
    s = s.replace(old2, new2, 1)

old3 = "console.warn('%c[MARC] GTFS-RT fetch failed \\u2014 add /api/marc/* to railroadradar-proxy', 'color:#f39c12', e);"
new3 = "console.warn('%c[MARC] GTFS-RT snapshot fetch failed', 'color:#f39c12', e);"
if old3 in s:
    s = s.replace(old3, new3, 1)

p.write_text(s, encoding='utf-8')
print('patched index.html')
