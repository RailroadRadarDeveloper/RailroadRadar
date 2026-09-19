from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

old_bind = "m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><div class=\"loading-departures\">Loading departures...</div></div>'); m.on('popupopen', async function() { const deps = await getCombinedStationDepartures(m._rrStation); if (m.getPopup) m.getPopup().setContent(createStationPopupContent(title, [key], deps, 1)); });"
new_bind = "m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><p class=\"no-departures\">' + agencyLabel + ' station</p></div>');"
if old_bind in t:
    t = t.replace(old_bind, new_bind)
else:
    # fallback: strip popupopen combined loader if quoting differs
    if "getCombinedStationDepartures(m._rrStation)" in t and 'agencyLabel + \' station\'' not in t[t.find('function upsertAgencyStationDot'):t.find('function upsertAgencyStationDot')+1800]:
        t = t.replace(
            "m.on('popupopen', async function() { const deps = await getCombinedStationDepartures(m._rrStation); if (m.getPopup) m.getPopup().setContent(createStationPopupContent(title, [key], deps, 1)); });",
            '',
        )
        t = t.replace(
            "m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><div class=\"loading-departures\">Loading departures...</div></div>');",
            "m.bindPopup('<div class=\"station-popup\"><h3>' + esc + '</h3><p class=\"no-departures\">' + agencyLabel + ' station</p></div>');",
        )

# Tighten train popup heading spacing
if 'word-spacing' not in t[t.find('.train-popup-header {'):t.find('.train-popup-header {')+250]:
    t = t.replace(
        '''    .train-popup-header {
      background: linear-gradient(145deg, #07093e 0%, #07093e 100%);
      color: white;
      padding: 14px 16px;
      border-radius: 0;
      position: relative;
    }''',
        '''    .train-popup-header {
      background: linear-gradient(145deg, #07093e 0%, #07093e 100%);
      color: white;
      padding: 14px 16px;
      border-radius: 0;
      position: relative;
      letter-spacing: 0;
      word-spacing: -0.06em;
    }
    .train-popup-header span {
      letter-spacing: 0;
      word-spacing: -0.06em;
    }''',
        1,
    )

t = t.replace(
    'display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:14.5px; line-height:1.3; color:#ffffff; font-style:italic;',
    'display:flex; align-items:center; gap:4px; flex-wrap:wrap; font-size:14.5px; line-height:1.25; color:#ffffff; font-style:italic; letter-spacing:0; word-spacing:-0.06em;',
)

p.write_text(t, encoding='utf-8')
print('amtrak popup simplified, heading spacing tightened')
