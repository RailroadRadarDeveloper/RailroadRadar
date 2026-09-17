from pathlib import Path

p = Path('index.html')
s = p.read_text(encoding='utf-8')
changed = False

replacements = [
    (
        "      // Free no-key Carto fallbacks (auto-switch if Mapbox fails repeatedly)\n"
        "      const cartoLightLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {\n"
        "        attribution: '\u00a9 Esri \u00a9 OpenStreetMap contributors',\n"
        "        maxZoom: 19,\n"
        "        maxNativeZoom: 16,\n"
        "        errorTileUrl: EMPTY_TILE\n"
        "      });\n"
        "      const cartoDarkLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {\n"
        "        attribution: '\u00a9 Esri \u00a9 OpenStreetMap contributors',\n"
        "        maxZoom: 19,\n"
        "        maxNativeZoom: 16,\n"
        "        errorTileUrl: EMPTY_TILE\n"
        "      });\n",
        "      // Mapbox failure fallback is OpenStreetMap (no Esri layers).\n",
    ),
    (
        '          "Alt Light": mapboxAltLightLayer,\n'
        '          "Esri Dark": cartoDarkLayer,\n'
        '          "Esri Light": cartoLightLayer,\n'
        '          "OpenStreetMap": osmLayer\n',
        '          "Alt Light": mapboxAltLightLayer,\n'
        '          "OpenStreetMap": osmLayer\n',
    ),
    (
        "          console.warn('[RailroadRadar] Mapbox tiles failing repeatedly; switching to Esri fallback');\n",
        "          console.warn('[RailroadRadar] Mapbox tiles failing repeatedly; switching to OSM fallback');\n",
    ),
    (
        "        const fallback = currentTheme === 'light' ? cartoLightLayer : cartoDarkLayer;\n",
        "        const fallback = osmLayer;\n",
    ),
    (
        "        if (usingMapboxFallback) return light ? cartoLightLayer : cartoDarkLayer;\n",
        "        if (usingMapboxFallback) return osmLayer;\n",
    ),
    (
        "        if (name === 'Carto Light' || name === 'Carto Dark' || name === 'Esri Light' || name === 'Esri Dark') usingMapboxFallback = true;\n",
        "        if (name === 'OpenStreetMap') usingMapboxFallback = true;\n",
    ),
    (
        "      let currentBaseLayer = preferKeylessTiles ? cartoLightLayer : mapboxLightLayer;\n",
        "      let currentBaseLayer = mapboxLightLayer;\n",
    ),
]

for old, new in replacements:
    if old in s:
        s = s.replace(old, new, 1)
        changed = True
    else:
        print('skip missing block:', old[:80].replace('\n', ' / '))

if 'cartoLightLayer' in s or 'cartoDarkLayer' in s or 'Esri Light' in s or 'Esri Dark' in s or 'arcgisonline.com' in s:
    raise SystemExit('Esri references still present after patch')

if not changed:
    print('already patched')
else:
    p.write_text(s, encoding='utf-8')
    print('patched index.html')
