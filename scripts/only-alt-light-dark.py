from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')
changed = False

replacements = [
    (
        "      let currentBaseLayer = mapboxLightLayer;\n",
        "      let currentBaseLayer = mapboxAltLightLayer;\n",
    ),
    (
        '          "Dark": mapboxDarkLayer,\n'
        '          "Light": mapboxLightLayer,\n'
        '          "Alt Light": mapboxAltLightLayer,\n'
        '          "OpenStreetMap": osmLayer\n',
        '          "Dark": mapboxDarkLayer,\n'
        '          "Alt Light": mapboxAltLightLayer\n',
    ),
    (
        "        if (usingMapboxFallback) return osmLayer;\n"
        "        return light ? mapboxLightLayer : mapboxDarkLayer;\n",
        "        return light ? mapboxAltLightLayer : mapboxDarkLayer;\n",
    ),
    (
        "        if (name === 'OpenStreetMap') usingMapboxFallback = true;\n"
        "        else if (name === 'Light' || name === 'Dark') {\n",
        "        if (name === 'Alt Light' || name === 'Dark' || name === 'Light') {\n",
    ),
    (
        "      mapboxLightLayer.on('tileerror', onMapboxTileError);\n"
        "      mapboxDarkLayer.on('tileerror', onMapboxTileError);\n",
        "      mapboxAltLightLayer.on('tileerror', onMapboxTileError);\n"
        "      mapboxDarkLayer.on('tileerror', onMapboxTileError);\n",
    ),
]

for old, new in replacements:
    if old in s:
        s = s.replace(old, new, 1)
        changed = True
    else:
        print('skip missing block:', old[:90].replace('\n', ' / '))

# Do not auto-switch onto OSM anymore.
s = s.replace(
    "        const fallback = osmLayer;\n"
    "        if (map.hasLayer(currentBaseLayer)) map.removeLayer(currentBaseLayer);\n"
    "        fallback.addTo(map);\n"
    "        currentBaseLayer = fallback;\n",
    "        return;\n",
    1,
)

bad = []
if '"Light": mapboxLightLayer' in s:
    bad.append('official Light still in picker')
if '"OpenStreetMap": osmLayer' in s:
    bad.append('OSM still in picker')
if '"Esri Light"' in s or '"Esri Dark"' in s:
    bad.append('Esri still in picker')
if 'return light ? mapboxLightLayer' in s:
    bad.append('theme still uses official Light')
if 'let currentBaseLayer = mapboxLightLayer' in s:
    bad.append('default still official Light')
if '"Alt Light": mapboxAltLightLayer' not in s:
    bad.append('Alt Light missing from picker')
if '"Dark": mapboxDarkLayer' not in s:
    bad.append('Dark missing from picker')
if bad:
    raise SystemExit('; '.join(bad))

p.write_text(s, encoding='utf-8')
print('patched index.html' if changed else 'wrote index.html')
