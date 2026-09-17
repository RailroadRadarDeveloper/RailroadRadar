#!/usr/bin/env python3
from pathlib import Path
p = Path('index.html')
t = p.read_text(encoding='utf-8')

old_urls = "      const MARC_POSITIONS_URL = apiUrl('/api/marc/positions');\n      const MARC_TRIPUPDATES_URL = apiUrl('/api/marc/tripupdates');"
new_urls = """      function marcFeedUrl(path) {
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
              last = new Error(label + ' HTTP ' + (res && res.status) + ' ' + u);
            } catch (e) { last = e; }
          }
          throw last || new Error(label + ' unavailable');
        })();
      }
      const MARC_POSITIONS_URLS = [
        apiUrl('/api/marc/positions'),
        marcFeedUrl('/feeds/marc-vp.pb'),
        'https://raw.githubusercontent.com/RailroadRadarDeveloper/RailroadRadar/main/feeds/marc-vp.pb'
      ];
      const MARC_TRIPUPDATES_URLS = [
        apiUrl('/api/marc/tripupdates'),
        marcFeedUrl('/feeds/marc-tu.pb'),
        'https://raw.githubusercontent.com/RailroadRadarDeveloper/RailroadRadar/main/feeds/marc-tu.pb'
      ];
      const MARC_POSITIONS_URL = MARC_POSITIONS_URLS[0];
      const MARC_TRIPUPDATES_URL = MARC_TRIPUPDATES_URLS[0];"""

if old_urls not in t:
    raise SystemExit('MISSING url consts')
t = t.replace(old_urls, new_urls, 1)

old_fetch = """          const [posRes, tuRes] = await Promise.all([
            fetch(MARC_POSITIONS_URL),
            fetch(MARC_TRIPUPDATES_URL)
          ]);"""
new_fetch = """          const [posRes, tuRes] = await Promise.all([
            marcFetchFirstOk(MARC_POSITIONS_URLS, 'positions'),
            marcFetchFirstOk(MARC_TRIPUPDATES_URLS, 'tripupdates')
          ]);"""
if old_fetch not in t:
    raise SystemExit('MISSING fetch pair')
t = t.replace(old_fetch, new_fetch, 1)
p.write_text(t, encoding='utf-8')
print('patched', len(t))
