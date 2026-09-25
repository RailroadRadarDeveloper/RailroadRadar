from pathlib import Path

REPLACEMENTS = [
    ('https://unpkg.com/leaflet@1.7.1/dist/leaflet.css', '/vendor/leaflet/leaflet.css'),
    ('https://unpkg.com/leaflet@1.7.1/dist/leaflet.js', '/vendor/leaflet/leaflet.js'),
    ('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', '/vendor/leaflet/leaflet.css'),
    ('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', '/vendor/leaflet/leaflet.js'),
    ('https://cdn.jsdelivr.net/npm/html-to-image@1.11.11/dist/html-to-image.min.js', '/vendor/html-to-image.min.js'),
    ('https://cdn.jsdelivr.net/npm/protobufjs@7.4.0/dist/light/protobuf.min.js', '/vendor/protobuf.min.js'),
    ('https://i.postimg.cc/3xMFGsJX/Alert.png', '/assets/brand/alert.png'),
    ('https://i.postimg.cc/8PdC8gPp/Needham-Heights-2.png', '/assets/brand/needham-heights-2.png'),
    ('https://i.postimg.cc/gjwV0kj6/Needham-Heights-1.png', '/assets/brand/needham-heights-1.png'),
    ('https://i.postimg.cc/wBWNG26K/Completed.png', '/assets/brand/completed.png'),
    ('https://i.postimg.cc/wjS055MP/Untitled-design-(9).png', '/assets/brand/header-icon.png'),
    ('https://i.postimg.cc/8PzqYZ2S/My-Trips-by-Railroad-Radar.png', '/assets/brand/mytrips-logo.png'),
    ('https://i.postimg.cc/W18XKxcx/Stay-Off-The-Tracks-5.png', '/assets/brand/rr-wordmark.png'),
    ('https://i.postimg.cc/YSgrjhMx/Background-Right-Top.png', '/assets/brand/tracks-right-top.png'),
    ('https://i.postimg.cc/c1vD3YVL/Backgrond404.png', '/assets/brand/tracks-left-bottom.png'),
    ('https://raw.githubusercontent.com/RailroadRadarDeveloper/RailroadRadar/main/feeds/marc-tu.pb', '/feeds/marc-tu.pb'),
    ('https://raw.githubusercontent.com/RailroadRadarDeveloper/RailroadRadar/main/feeds/marc-vp.pb', '/feeds/marc-vp.pb'),
]

PAGES = ['index.html', 'mytrips/index.html', 'user/index.html', '404.html', 'press/index.html']

def patch():
    for path in PAGES:
        p = Path(path)
        if not p.exists():
            print('skip missing', path)
            continue
        t = p.read_text(encoding='utf-8')
        n = 0
        for old, new in REPLACEMENTS:
            if old in t:
                c = t.count(old)
                t = t.replace(old, new)
                n += c
        p.write_text(t, encoding='utf-8')
        print(path, 'replacements', n, 'postimg left', t.count('i.postimg.cc'), 'unpkg left', t.count('unpkg.com'))

if __name__ == '__main__':
    patch()
