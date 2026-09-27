from pathlib import Path

OLD_OPTS = '''        detectRetina: false,
        maxZoom: 20,
        errorTileUrl: EMPTY_TILE'''
NEW_OPTS = '''        detectRetina: false,
        maxZoom: 20,
        keepBuffer: 8,
        updateWhenIdle: false,
        updateWhenZooming: true,
        errorTileUrl: EMPTY_TILE'''

REFRESH = '''
      function rrRefreshMapTiles() {
        try {
          if (typeof map === 'undefined' || !map) return;
          map.invalidateSize({ animate: false });
          map.eachLayer(function(layer) {
            try { if (layer && typeof layer.redraw === 'function') layer.redraw(); } catch (_) {}
          });
        } catch (_) {}
      }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_OPTS in t:
        t = t.replace(OLD_OPTS, NEW_OPTS)
        print('tile opts', path, t.count(NEW_OPTS))
    if 'function rrRefreshMapTiles' not in t:
        t = t.replace('const map = L.map', REFRESH + '      const map = L.map', 1)
    if 'rrRefreshMapTiles()' not in t[t.find('function hideLoadingScreen'):t.find('function hideLoadingScreen')+900]:
        t = t.replace(
            '        loadingScreen.style.display = \'none\';',
            '        loadingScreen.style.display = \'none\';\n        try { rrRefreshMapTiles(); } catch (_) {}',
        )
    if 'window.addEventListener(\n        \'resize\'' not in t and "addEventListener('resize', rrRefreshMapTiles)" not in t:
        t = t.replace(
            'const map = L.map(\'map\').setView([43.0, -71.5], 7);',
            "const map = L.map('map').setView([43.0, -71.5], 7);\n      window.addEventListener('resize', function() { try { rrRefreshMapTiles(); } catch (_) {} });\n      map.whenReady(function() { try { rrRefreshMapTiles(); } catch (_) {} });",
            1,
        )
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
