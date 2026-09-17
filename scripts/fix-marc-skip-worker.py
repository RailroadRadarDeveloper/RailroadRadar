from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')
changed = False

old_urls = """      const MARC_POSITIONS_URLS = [
        apiUrl('/api/marc/positions'),
        marcFeedUrl('/feeds/marc-vp.pb'),
        'https://raw.githubusercontent.com/RailroadRadarDeveloper/RailroadRadar/main/feeds/marc-vp.pb'
      ];
      const MARC_TRIPUPDATES_URLS = [
        apiUrl('/api/marc/tripupdates'),
        marcFeedUrl('/feeds/marc-tu.pb'),
        'https://raw.githubusercontent.com/RailroadRadarDeveloper/RailroadRadar/main/feeds/marc-tu.pb'
      ];
"""

new_urls = """      const MARC_POSITIONS_URLS = [
        marcFeedUrl('/feeds/marc-vp.pb'),
        'https://raw.githubusercontent.com/RailroadRadarDeveloper/RailroadRadar/main/feeds/marc-vp.pb'
      ];
      const MARC_TRIPUPDATES_URLS = [
        marcFeedUrl('/feeds/marc-tu.pb'),
        'https://raw.githubusercontent.com/RailroadRadarDeveloper/RailroadRadar/main/feeds/marc-tu.pb'
      ];
"""

if old_urls in s:
    s = s.replace(old_urls, new_urls, 1)
    changed = True

old_single = """      const MARC_POSITIONS_URL = apiUrl('/api/marc/positions');
      const MARC_TRIPUPDATES_URL = apiUrl('/api/marc/tripupdates');
"""
if old_single in s:
    raise SystemExit('unexpected worker-only MARC constants still present')

if "apiUrl('/api/marc/positions')" in s or "apiUrl('/api/marc/tripupdates')" in s:
    raise SystemExit('worker MARC URLs still present after patch')

if not changed and "marcFeedUrl('/feeds/marc-vp.pb')" in s:
    print('already using snapshot feeds only')
else:
    p.write_text(s, encoding='utf-8')
    print('patched index.html')
