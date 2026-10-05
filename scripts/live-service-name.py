from pathlib import Path

FIELD = '''
                <label for="trip-log-live-railroad">Railroad</label>
                <select id="trip-log-live-railroad">
                  <option value="mbta">MBTA</option>
                  <option value="amtrak">Amtrak</option>
                  <option value="mnr">Metro-North</option>
                  <option value="lirr">Long Island Rail Road</option>
                  <option value="njt">NJ Transit</option>
                  <option value="ctrail">CTrail</option>
                  <option value="marc">MARC</option>
                  <option value="other">Other</option>
                </select>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'trip-log-live-railroad' not in t:
        t = t.replace('<label for="trip-log-train-title">Map title</label>', FIELD + '                <label for="trip-log-train-title">Service name</label>', 1)
        t = t.replace('placeholder="e.g. Berkshire Flyer special"', 'placeholder="Service name"', 1)
        print('field', path)
    t = t.replace(
        "const title = data.specialMove ? String(data.trainTitle || '').trim() : '';\n        routeEl.textContent = (data.specialMove && noStations && title) ? title : '';\n        if (!(data.specialMove && noStations && title)) routeEl.innerHTML = tripRouteOdHtml(od.origin, od.dest);",
        "const title = data.specialMove ? String(data.trainTitle || data.title || '').trim() : '';\n        if (data.specialMove && title) routeEl.textContent = title;\n        else routeEl.innerHTML = tripRouteOdHtml(od.origin, od.dest);",
        1,
    )
    t = t.replace(
        'return tripRouteOdText(data.originName, data.destName);',
        "if (data && data.specialMove && String(data.trainTitle || data.title || '').trim()) return String(data.trainTitle || data.title).trim();\n      return tripRouteOdText(data.originName, data.destName);",
        1,
    )
    old = "return { specialMove: specialMove, trainTitle: title || null };"
    new = "var railroadEl = document.getElementById('trip-log-live-railroad');\n      return { specialMove: specialMove, trainTitle: title || null, railroad: railroadEl ? railroadEl.value : '' };"
    if old in t:
        t = t.replace(old, new, 1)
        print('read', path)
    t = t.replace(
        'trainTitle: (specialOpts && specialOpts.trainTitle) ? String(specialOpts.trainTitle).slice(0, 80) : null',
        'trainTitle: (specialOpts && specialOpts.trainTitle) ? String(specialOpts.trainTitle).slice(0, 80) : null, railroad: (specialOpts && specialOpts.railroad) ? String(specialOpts.railroad) : null',
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('done', path)

patch('index.html')
patch('mytrips/index.html')
