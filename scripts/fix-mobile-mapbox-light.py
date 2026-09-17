from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')

old = (
    "const mapboxLightLayer = L.tileLayer(apiUrl('/api/mapbox/styles/v1/northeastamtrakrailfanalt/ckyq285h5219a14mpql9jt2r7/tiles/256/{z}/{x}/{y}'), {\n"
    "        attribution: '\u00a9 Mapbox \u00a9 OpenStreetMap contributors',\n"
    "        detectRetina: false,\n"
    "        maxZoom: 20,\n"
    "        errorTileUrl: EMPTY_TILE\n"
    "      });\n"
)
new = (
    "const mapboxAltLightLayer = L.tileLayer(apiUrl('/api/mapbox/styles/v1/northeastamtrakrailfanalt/ckyq285h5219a14mpql9jt2r7/tiles/256/{z}/{x}/{y}'), {\n"
    "        attribution: '\u00a9 Mapbox \u00a9 OpenStreetMap contributors',\n"
    "        detectRetina: false,\n"
    "        maxZoom: 20,\n"
    "        errorTileUrl: EMPTY_TILE\n"
    "      });\n"
    "      const mapboxLightLayer = L.tileLayer(apiUrl('/api/mapbox/styles/v1/mapbox/light-v11/tiles/256/{z}/{x}/{y}'), {\n"
    "        attribution: '\u00a9 Mapbox \u00a9 OpenStreetMap contributors',\n"
    "        detectRetina: false,\n"
    "        maxZoom: 20,\n"
    "        errorTileUrl: EMPTY_TILE\n"
    "      });\n"
)

if old in s:
    s = s.replace(old, new, 1)
elif "styles/v1/mapbox/light-v11/tiles" in s and "const mapboxAltLightLayer" in s:
    print('already using official Mapbox Light')
else:
    raise SystemExit('mapboxLightLayer definition not found')

old2 = (
    '          "Dark": mapboxDarkLayer,\n'
    '          "Light": mapboxLightLayer,\n'
    '          "Esri Dark": cartoDarkLayer,\n'
    '          "Esri Light": cartoLightLayer,\n'
    '          "OpenStreetMap": osmLayer\n'
)
new2 = (
    '          "Dark": mapboxDarkLayer,\n'
    '          "Light": mapboxLightLayer,\n'
    '          "Alt Light": mapboxAltLightLayer,\n'
    '          "Esri Dark": cartoDarkLayer,\n'
    '          "Esri Light": cartoLightLayer,\n'
    '          "OpenStreetMap": osmLayer\n'
)
if old2 in s:
    s = s.replace(old2, new2, 1)
elif '"Alt Light": mapboxAltLightLayer' in s:
    print('layer control already has Alt Light')
else:
    print('warning: layer control block not updated')

p.write_text(s, encoding='utf-8')
print('patched index.html')
