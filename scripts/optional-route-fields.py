from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        "if (!rr) throw new Error('Segment ' + (i + 1) + ': choose a railroad.');\n        const routeOptional = isSpecial && (!lineId || !originId || !destId);\n        if (!routeOptional) {\n          if (!lineId) throw new Error('Segment ' + (i + 1) + ': choose a line.');\n          if (!originId || !destId) throw new Error('Segment ' + (i + 1) + ': choose origin and destination.');\n          if (originId === destId) throw new Error('Segment ' + (i + 1) + ': origin and destination must differ.');\n        }",
        "if (originId && destId && originId === destId) throw new Error('Segment ' + (i + 1) + ': origin and destination must differ.');\n        const routeOptional = !lineId || !originId || !destId;",
        1,
    )
    t = t.replace(
        "railroad: (card.querySelector('[data-seg-field=\"railroad\"]') || {}).value || 'mbta',",
        "railroad: (card.querySelector('[data-seg-field=\"railroad\"]') || {}).value || '',",
        1,
    )
    t = t.replace(
        "'<div><label>Railroad</label><select data-seg-field=\"railroad\">' + railOpts + '</select></div>'",
        "'<div><label>Railroad (optional)</label><select data-seg-field=\"railroad\"><option value=\"\">Optional</option>' + railOpts + '</select></div>'",
        1,
    )
    t = t.replace('<label>Line</label>', '<label>Line (optional)</label>')
    t = t.replace('<div><label>From</label>', '<div><label>Origin (optional)</label>')
    t = t.replace('<div><label>To</label>', '<div><label>Destination (optional)</label>')
    t = t.replace('<label for="trip-log-live-railroad">Railroad</label>', '<label for="trip-log-live-railroad">Railroad (optional)</label>')
    t = t.replace(
        '<select id="trip-log-live-railroad">\n                  <option value="mbta">MBTA</option>',
        '<select id="trip-log-live-railroad">\n                  <option value="">Optional</option>\n                  <option value="mbta">MBTA</option>',
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('done', path, 'railroad throw', 'choose a railroad' in t)

patch('index.html')
patch('mytrips/index.html')
