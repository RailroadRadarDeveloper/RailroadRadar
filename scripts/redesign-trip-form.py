from pathlib import Path

OLD_HEAD = '''            '<div class="trip-segment-head">' +
              '<div class="trip-segment-title">Segment ' + (idx + 1) +
                '<span class="trip-segment-rail-chip">' + tripRailBadgeHtml(seg.railroad) + '</span></div>' +
              removeBtn +
            '</div>' +
            '<label>Railroad</label>' +
            '<select data-seg-field="railroad">' + railOpts + '</select>' +
            '<label>Line</label>' +
            '<select data-seg-field="line">' + lineOpts + '</select>' +
            trainPickHtml +
            '<label>Origin</label>' +
            '<select data-seg-field="origin">' + stOpts(originId, stations, true) + '</select>' +
            '<label>Destination</label>' +
            '<select data-seg-field="dest">' + stOpts(destId, destStations.length ? destStations : stations, true) + '</select>' +
            '<label>' + trainLabel + '</label>' +
            '<input type="text" data-seg-field="train" maxlength="32" placeholder="' + trainPh + '" autocomplete="off" value="' + escapeTripOpt(seg.trainNumber || '') + '">' +'''

NEW_HEAD = '''            '<div class="trip-segment-head">' +
              '<div class="trip-segment-title">' + (tripLogSegmentsState.length > 1 ? ('Train ' + (idx + 1)) : 'Trip') + '</div>' +
              removeBtn +
            '</div>' +
            '<div class="trip-seg-grid">' +
              '<div><label>Railroad</label><select data-seg-field="railroad">' + railOpts + '</select></div>' +
              '<div><label>Line</label><select data-seg-field="line">' + lineOpts + '</select></div>' +
            '</div>' +
            trainPickHtml +
            '<div class="trip-seg-grid">' +
              '<div><label>From</label><select data-seg-field="origin">' + stOpts(originId, stations, true) + '</select></div>' +
              '<div><label>To</label><select data-seg-field="dest">' + stOpts(destId, destStations.length ? destStations : stations, true) + '</select></div>' +
            '</div>' +
            '<div class="trip-train-text"' + ((hasPicker && !seg.trainExtraMode) ? ' hidden' : '') + '>' +
              '<label>' + trainLabel + '</label>' +
              '<input type="text" data-seg-field="train" maxlength="32" placeholder="' + trainPh + '" autocomplete="off" value="' + escapeTripOpt(seg.trainNumber || '') + '">' +
            '</div>' +'''

OLD_HINT = "'<p class=\"trip-seg-train-hint\">Pick a scheduled train to autofill number, line, and stations when available. Metra/MARC stay free-text.</p>';"
NEW_HINT = "'<p class=\"trip-seg-train-hint\">Choosing a train fills the number and times.</p>';"

OLD_NOTE = "(specialMode ? '<p class=\"trip-seg-train-optional-note\">Map title is used on the live map; number only if you want it logged separately.</p>' : '') +"
NEW_NOTE = "'' +"

OLD_SPECIAL = '''              <p class="trip-special-hint" id="trip-special-hint">Excursion, rare, or extra \u2014 one map title below. Share location from the trip after saving.</p>
              <div id="trip-special-title-wrap" hidden>
                <label for="trip-log-train-title">Map title</label>
                <input type="text" id="trip-log-train-title" maxlength="80" placeholder='e.g. Berkshire Flyer special' autocomplete="off">
                <p class="trip-seg-train-optional-note" id="trip-special-title-note">Shown on the live map. Segment train number becomes optional.</p>
              </div>
            </div>
            <label for="trip-log-rolling-stock">Rolling stock number (optional)</label>
            <input type="text" id="trip-log-rolling-stock" maxlength="64" placeholder="e.g. loco/car number" autocomplete="off">
            <label for="trip-log-notes">Notes (optional)</label>
            <textarea id="trip-log-notes" maxlength="500" rows="3" placeholder="Optional notes"></textarea>'''

NEW_SPECIAL = '''              <div id="trip-special-title-wrap" hidden>
                <label for="trip-log-train-title">Map title</label>
                <input type="text" id="trip-log-train-title" maxlength="80" placeholder="e.g. Berkshire Flyer special" autocomplete="off">
              </div>
            </div>
            <details class="trip-form-more">
              <summary>Optional details</summary>
              <label for="trip-log-rolling-stock">Rolling stock</label>
              <input type="text" id="trip-log-rolling-stock" maxlength="64" placeholder="Loco or car number" autocomplete="off">
              <label for="trip-log-notes">Notes</label>
              <textarea id="trip-log-notes" maxlength="500" rows="2" placeholder="Anything else"></textarea>
            </details>'''

CSS = '''
    .trip-seg-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .trip-seg-grid label { margin-top: 6px; }
    .trip-form-more { margin-top: 10px; }
    .trip-form-more summary { cursor: pointer; font-weight: 700; color: #07093e; }
    .trip-train-text[hidden] { display: none !important; }
    #trip-log-add-segment { width: 100%; margin: 8px 0; }
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD_HEAD not in t:
        print('head missing', path)
    else:
        t = t.replace(OLD_HEAD, NEW_HEAD, 1)
        print('head', path)
    t = t.replace(OLD_HINT, NEW_HINT)
    if OLD_NOTE in t:
        t = t.replace(OLD_NOTE, NEW_NOTE, 1)
        print('note', path)
    if OLD_SPECIAL in t:
        t = t.replace(OLD_SPECIAL, NEW_SPECIAL, 1)
        print('special', path)
    else:
        print('special missing', path)
    t = t.replace('>Add segment for this trip<', '>Add another train<')
    if 'trip-seg-grid' not in t:
        t = t.replace('</head>', '<style id="rr-trip-form-tight">' + CSS + '</style>\n</head>', 1)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
