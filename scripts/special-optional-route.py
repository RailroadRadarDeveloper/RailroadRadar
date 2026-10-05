from pathlib import Path

OLD = '''            '<div class="trip-seg-grid">' +
              '<div><label>Railroad</label><select data-seg-field="railroad">' + railOpts + '</select></div>' +
              '<div><label>Line</label><select data-seg-field="line">' + lineOpts + '</select></div>' +
            '</div>' +
            trainPickHtml +
            '<div class="trip-seg-grid">' +
              '<div><label>From</label><select data-seg-field="origin">' + stOpts(originId, stations, true) + '</select></div>' +
              '<div><label>To</label><select data-seg-field="dest">' + stOpts(destId, destStations.length ? destStations : stations, true) + '</select></div>' +
            '</div>' +'''

NEW = '''            '<div class="trip-seg-grid">' +
              '<div><label>Railroad</label><select data-seg-field="railroad">' + railOpts + '</select></div>' +
              (specialMode ? '' : '<div><label>Line</label><select data-seg-field="line">' + lineOpts + '</select></div>') +
            '</div>' +
            (specialMode
              ? '<details class="trip-route-optional"><summary>Stations and times (optional)</summary>' +
                  '<label>Line</label><select data-seg-field="line">' + lineOpts + '</select>' +
                  trainPickHtml +
                  '<div class="trip-seg-grid">' +
                    '<div><label>From</label><select data-seg-field="origin">' + stOpts(originId, stations, true) + '</select></div>' +
                    '<div><label>To</label><select data-seg-field="dest">' + stOpts(destId, destStations.length ? destStations : stations, true) + '</select></div>' +
                  '</div>'
              : trainPickHtml +
                '<div class="trip-seg-grid">' +
                  '<div><label>From</label><select data-seg-field="origin">' + stOpts(originId, stations, true) + '</select></div>' +
                  '<div><label>To</label><select data-seg-field="dest">' + stOpts(destId, destStations.length ? destStations : stations, true) + '</select></div>' +
                '</div>') +'''

# close details before train text? times are after train text. Handle times separately.
OLD_TIMES = "'<div class=\"trip-segment-times\">' +"
NEW_TIMES = "(specialMode ? '' : '') + '<div class=\"trip-segment-times\">' +"

OLD_VAL = '''        if (!rr) throw new Error('Segment ' + (i + 1) + ': choose a railroad.');
        if (!lineId) throw new Error('Segment ' + (i + 1) + ': choose a line.');
        if (!originId || !destId) throw new Error('Segment ' + (i + 1) + ': choose origin and destination.');
        if (originId === destId) throw new Error('Segment ' + (i + 1) + ': origin and destination must differ.');'''

NEW_VAL = '''        const isSpecial = !!(specialOpts && specialOpts.specialMove);
        if (!rr) throw new Error('Segment ' + (i + 1) + ': choose a railroad.');
        const routeOptional = isSpecial && (!lineId || !originId || !destId);
        if (!routeOptional) {
          if (!lineId) throw new Error('Segment ' + (i + 1) + ': choose a line.');
          if (!originId || !destId) throw new Error('Segment ' + (i + 1) + ': choose origin and destination.');
          if (originId === destId) throw new Error('Segment ' + (i + 1) + ': origin and destination must differ.');
        }'''

OLD_TIME = '''        if (!seg.departTime) throw new Error('Segment ' + (i + 1) + ': enter a depart time.');
        if (!seg.arriveTime) throw new Error('Segment ' + (i + 1) + ': enter an arrive time.');'''

NEW_TIME = '''        if (!seg.departTime || !seg.arriveTime) {
          if (!(specialOpts && specialOpts.specialMove)) {
            if (!seg.departTime) throw new Error('Segment ' + (i + 1) + ': enter a depart time.');
            if (!seg.arriveTime) throw new Error('Segment ' + (i + 1) + ': enter an arrive time.');
          }
        }'''

OLD_STATION = '''        const origin = findTripStation(rr, originId);
        const dest = findTripStation(rr, destId);
        if (!origin || !dest) throw new Error('Segment ' + (i + 1) + ': station not found for this railroad.');
        const originCanon = String(origin.id || originId);
        const destCanon = String(dest.id || destId);
        let miles = estimateTripMiles(rr, originCanon, destCanon, lineId);
        if (miles == null) miles = 0;
        totalMiles += Number(miles) || 0;
        const segOut = {
          railroad: rr,
          lineId: lineId,
          lineName: lineNameFor(rr, lineId),
          originStationId: originCanon,
          originName: String(origin.name || originCanon),
          destStationId: destCanon,
          destName: String(dest.name || destCanon),
          trainNumber: trainNumber || ((specialOpts && specialOpts.specialMove) ? 'Extra' : ''),
          departTime: departIso,
          arriveTime: arriveIso,
          miles: Number(miles) || 0
        };'''

NEW_STATION = '''        let origin = originId ? findTripStation(rr, originId) : null;
        let dest = destId ? findTripStation(rr, destId) : null;
        if (!routeOptional && (!origin || !dest)) throw new Error('Segment ' + (i + 1) + ': station not found for this railroad.');
        const originCanon = origin ? String(origin.id || originId) : '';
        const destCanon = dest ? String(dest.id || destId) : '';
        let miles = (originCanon && destCanon) ? estimateTripMiles(rr, originCanon, destCanon, lineId) : 0;
        if (miles == null) miles = 0;
        totalMiles += Number(miles) || 0;
        const nowIso = new Date().toISOString();
        const segOut = {
          railroad: rr,
          lineId: lineId,
          lineName: lineId ? lineNameFor(rr, lineId) : '',
          originStationId: originCanon,
          originName: origin ? String(origin.name || originCanon) : '',
          destStationId: destCanon,
          destName: dest ? String(dest.name || destCanon) : '',
          trainNumber: trainNumber || ((specialOpts && specialOpts.specialMove) ? 'Extra' : ''),
          departTime: departIso || nowIso,
          arriveTime: arriveIso || departIso || nowIso,
          miles: Number(miles) || 0
        };'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD not in t:
        print('form block missing', path)
    else:
        t = t.replace(OLD, NEW, 1)
        print('form', path)
    # close details after times div if special. Find times close is hard; append close before train text close wrapper end.
    t = t.replace(
        "'</div>' +\n            (specialMode ? '<p class=\"trip-seg-train-optional-note\">",
        "'</div>' + (specialMode ? '</details>' : '') +\n            (specialMode ? '<p class=\"trip-seg-train-optional-note\">",
        1,
    )
    # if note was removed, close details before segment times end differently
    if "(specialMode ? '</details>' : '')" not in t:
        t = t.replace(
            "'<div class=\"trip-segment-times\">' +",
            "(specialMode ? '' : '') + '<div class=\"trip-segment-times\">' +",
            1,
        )
        # close details after the times block's closing — search unique end of times in return
        t = t.replace(
            "'</div>' +\n          '</div>'",
            "'</div>' + (specialMode ? '</details>' : '') +\n          '</div>'",
            1,
        )
        print('closed details via times', path)
    if OLD_VAL in t:
        t = t.replace(OLD_VAL, NEW_VAL, 1)
        print('val', path)
    else:
        print('val missing', path)
    if OLD_TIME in t:
        t = t.replace(OLD_TIME, NEW_TIME, 1)
    if 'if (!tripStationAllowed(seg, originId)' in t:
        t = t.replace(
            'if (!tripStationAllowed(seg, originId) || !tripStationAllowed(seg, destId)) {',
            'if (!routeOptional && (!tripStationAllowed(seg, originId) || !tripStationAllowed(seg, destId))) {',
            1,
        )
    if OLD_STATION in t:
        t = t.replace(OLD_STATION, NEW_STATION, 1)
        print('station', path)
    else:
        print('station missing', path)
    # skip iso parse when times blank
    t = t.replace(
        'const departIso = localInputToIso(seg.departTime);\n        const arriveIso = localInputToIso(seg.arriveTime);',
        'const departIso = seg.departTime ? localInputToIso(seg.departTime) : null;\n        const arriveIso = seg.arriveTime ? localInputToIso(seg.arriveTime) : null;',
        1,
    )
    t = t.replace(
        "if (!departIso) throw new Error('Segment ' + (i + 1) + ': invalid depart time.');\n        if (!arriveIso) throw new Error('Segment ' + (i + 1) + ': invalid arrive time.');",
        "if (seg.departTime && !departIso) throw new Error('Segment ' + (i + 1) + ': invalid depart time.');\n        if (seg.arriveTime && !arriveIso) throw new Error('Segment ' + (i + 1) + ': invalid arrive time.');",
        1,
    )
    t = t.replace(
        'if (Date.parse(arriveIso) < Date.parse(departIso)) {',
        'if (departIso && arriveIso && Date.parse(arriveIso) < Date.parse(departIso)) {',
        1,
    )
    css = '.trip-route-optional { margin: 8px 0; } .trip-route-optional summary { cursor: pointer; font-weight: 700; color: #07093e; }'
    if 'trip-route-optional' not in t.split('</head>')[0]:
        t = t.replace('</head>', '<style id="rr-special-optional">' + css + '</style>\n</head>', 1)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
