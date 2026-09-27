from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace('.leaflet-popup {\n      zoom: 0.82;\n    }', '.leaflet-popup {\n      zoom: 0.72;\n    }')
    t = t.replace('.leaflet-popup {\n        zoom: 0.78;\n      }', '.leaflet-popup {\n        zoom: 0.68;\n      }')
    p.write_text(t, encoding='utf-8')
    print(path, '0.72', t.count('zoom: 0.72'), '0.68', t.count('zoom: 0.68'))

patch('index.html')
patch('mytrips/index.html')
