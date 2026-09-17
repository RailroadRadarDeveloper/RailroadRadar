#!/usr/bin/env python3
from pathlib import Path
root = Path('.')
text = (root / 'index.html').read_text(encoding='utf-8')
static = (root / 'scripts/marc-static.json').read_text(encoding='utf-8').strip()
shapes = (root / 'scripts/marc-shapes.json').read_text(encoding='utf-8').strip()
runtime = (root / 'scripts/marc-runtime.js').read_text(encoding='utf-8')
if '__MARC_STATIC_JSON__' not in runtime:
    raise SystemExit('MISSING placeholder in marc-runtime.js')
marc_js = runtime.replace('__MARC_STATIC_JSON__', static)

def must_replace(old, new, label, all=False):
    global text
    if old not in text:
        raise SystemExit('MISSING: ' + label)
    text = text.replace(old, new) if all else text.replace(old, new, 1)
    print('OK', label)

must_replace(
    '<div><input type="checkbox" id="show-ctrail" checked><label for="show-ctrail">Show CTrail</label></div>',
    '<div><input type="checkbox" id="show-ctrail" checked><label for="show-ctrail">Show CTrail</label></div>\n        <div><input type="checkbox" id="show-marc" checked><label for="show-marc">Show MARC Trains</label></div>',
    'checkbox'
)
must_replace(
    'Train data is provided by MassDOT, MBTA, Amtrak, MTA, Metra, NJ Transit, and CTrail.',
    'Train data is provided by MassDOT, MBTA, Amtrak, MTA, Metra, NJ Transit, CTrail, and MARC.',
    'disclaimer'
)
must_replace(
    '<option value="ctrail">CTrail</option>',
    '<option value="ctrail">CTrail</option>\n              <option value="marc">MARC</option>',
    'select options',
    all=True
)
must_replace(
    "if (a === 'nj transit' || a === 'njtransit' || a === 'nj-transit' || a === 'njt rail') return 'njt';\n        return a;",
    "if (a === 'nj transit' || a === 'njtransit' || a === 'nj-transit' || a === 'njt rail') return 'njt';\n        if (a === 'marc train' || a === 'marc trains' || a === 'maryland transit' || a === 'mta maryland') return 'marc';\n        return a;",
    'normalizeAgency'
)
must_replace(
    "activeTrainNumberReports = { amtrak: {}, mnr: {}, lirr: {}, mbta: {}, njt: {}, ctrail: {} };",
    "activeTrainNumberReports = { amtrak: {}, mnr: {}, lirr: {}, mbta: {}, njt: {}, ctrail: {}, marc: {} };",
    'activeTrainNumberReports',
    all=True
)
must_replace(
    "else if (agency === 'amtrak' || agency === 'mnr' || agency === 'lirr' || agency === 'njt' || agency === 'ctrail') {",
    "else if (agency === 'amtrak' || agency === 'mnr' || agency === 'lirr' || agency === 'njt' || agency === 'ctrail' || agency === 'marc') {",
    'report index agencies',
    all=True
)
must_replace(
    "const map = { mbta: 'MBTA', amtrak: 'Amtrak', mnr: 'Metro-North', lirr: 'LIRR', metra: 'Metra', njt: 'NJ Transit', ctrail: 'CTrail' };",
    "const map = { mbta: 'MBTA', amtrak: 'Amtrak', mnr: 'Metro-North', lirr: 'LIRR', metra: 'Metra', njt: 'NJ Transit', ctrail: 'CTrail', marc: 'MARC' };",
    'pretty names'
)
must_replace(
    "const labels = { mbta: 'MBTA', amtrak: 'Amtrak', mnr: 'Metro-North', lirr: 'LIRR', metra: 'Metra', njt: 'NJ Transit', ctrail: 'CTrail' };",
    "const labels = { mbta: 'MBTA', amtrak: 'Amtrak', mnr: 'Metro-North', lirr: 'LIRR', metra: 'Metra', njt: 'NJ Transit', ctrail: 'CTrail', marc: 'MARC' };",
    'station labels'
)
must_replace(
    "let showCtrail = true;\n      const njtMarkers = {};",
    "let showCtrail = true;\n      let showMarc = true;\n      const marcMarkers = {};\n      const marcTrainInfo = {};\n      const marcLastSeen = {};\n      const njtMarkers = {};",
    'state vars'
)
must_replace(
    "if (a === 'ctrail') return !!showCtrail;\n        return true;",
    "if (a === 'ctrail') return !!showCtrail;\n        if (a === 'marc') return !!showMarc;\n        return true;",
    'agencyStationsVisible'
)

needle = "      async function fetchStations() {"
if needle not in text:
    raise SystemExit('MISSING fetchStations anchor')
text = text.replace(needle, marc_js + "\n      async function fetchStations() {", 1)
print('OK marc js insert')

must_replace(
    "if (agency === 'ctrail') return showCtrail;\n        return true;",
    "if (agency === 'ctrail') return showCtrail;\n        if (agency === 'marc') return showMarc;\n        return true;",
    'shouldShowGtfsShape'
)
if 'const RR_MARC_SHAPES' not in text:
    must_replace(
        "      async function loadStaticGtfsShapes() {",
        "      const RR_MARC_SHAPES = " + shapes + ";\n      async function loadStaticGtfsShapes() {",
        'RR_MARC_SHAPES'
    )
must_replace(
    "{ id: 'ctrail', file: rrAssetUrl('/assets/shapes/ctrail.json'), fallback: '#EA0D2A' }",
    "{ id: 'ctrail', file: rrAssetUrl('/assets/shapes/ctrail.json'), fallback: '#EA0D2A' },\n          { id: 'marc', file: rrAssetUrl('/assets/shapes/marc.json'), fallback: '#FF8000' }",
    'shapes agency list'
)
must_replace(
    "if (ag.id === 'ctrail' && typeof RR_CTRAIL_SHAPES !== 'undefined') {\n              data = RR_CTRAIL_SHAPES;",
    "if (ag.id === 'ctrail' && typeof RR_CTRAIL_SHAPES !== 'undefined') {\n              data = RR_CTRAIL_SHAPES;\n            } else if (ag.id === 'marc' && typeof RR_MARC_SHAPES !== 'undefined') {\n              data = RR_MARC_SHAPES;",
    'shapes inline data'
)
marc_rows = '''
        try {
          for (const vid in marcTrainInfo) {
            const t = marcTrainInfo[vid];
            const num = t.trainNum || String(vid).replace(/^marc-/, '');
            const st = delayStatusParts(t.delayMinutes, t.statusText, t.statusPillClass);
            let stopLabel = 'Next', stopName = t.currentStopName or 'X'
'''
