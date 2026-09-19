from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

# Live MBTA popup: Trip / tid -> Line / rname
t=t.replace(
'''                <div class="info-item">
                  <span class="info-label">Trip</span>
                  <span class="info-value">${tid}</span>
                </div>''',
'''                <div class="info-item">
                  <span class="info-label">Line</span>
                  <span class="info-value">${rname || '\u2014'}</span>
                </div>''',
1)

# Other live popup that uses tripId
t=t.replace(
'''                <div class="info-item">
                  <span class="info-label">Trip</span>
                  <span class="info-value">${tripId}</span>
                </div>''',
'''                <div class="info-item">
                  <span class="info-label">Line</span>
                  <span class="info-value">${rname || route || '\u2014'}</span>
                </div>''',
1)

# Scheduled station popup: Trip + Route duplicate -> Line only
t=t.replace(
    '<div class="info-item"><span class="info-label">Trip</span><span class="info-value">${tid}</span></div>\n                  <div class="info-item"><span class="info-label">Route</span><span class="info-value">${rname || \'\u2014\'}</span></div>',
    '<div class="info-item"><span class="info-label">Line</span><span class="info-value">${rname || \'\u2014\'}</span></div>',
    1,
)
# if previous polish changed the Trip value to extractTrainNumber
t=t.replace(
    '<div class="info-item"><span class="info-label">Trip</span><span class="info-value">${(typeof extractTrainNumber===\'function\' && extractTrainNumber(tid)) || tid}</span></div>',
    '<div class="info-item"><span class="info-label">Line</span><span class="info-value">${rname || \'\u2014\'}</span></div>',
    1,
)

# Shared scheduled page
t=t.replace(
    "<div class=\"info-item\"><span class=\"info-label\">Trip</span><span class=\"info-value\">' +\n          String(page.tid || '') + '</span></div>",
    "<div class=\"info-item\"><span class=\"info-label\">Line</span><span class=\"info-value\">' +\n          String(page.rname || '\u2014') + '</span></div>",
    1,
)

# Fill rname from MBTA route when building scheduled share page
old_page='''          rrScheduledPage = {
            tid: spec.id,
            rname: '',
            origin: (stops[0] && stops[0].name) || '',
            dest: (stops[stops.length - 1] && stops[stops.length - 1].name) || '',
            stops: stops,
            departsMsg: rrDepartsInMsg(when)
          };'''
new_page='''          let lineName = '';
          try {
            const tr = await fetch(apiUrl('/api/mbta' + '/trips/' + encodeURIComponent(spec.id) + '?include=route'));
            const td = await tr.json();
            const route = (td.included || []).find(function(x) { return x && x.type === 'route'; });
            if (route && route.attributes) lineName = route.attributes.long_name || route.attributes.short_name || '';
          } catch (e) {}
          rrScheduledPage = {
            tid: spec.id,
            rname: lineName,
            origin: (stops[0] && stops[0].name) || '',
            dest: (stops[stops.length - 1] && stops[stops.length - 1].name) || '',
            stops: stops,
            departsMsg: rrDepartsInMsg(when)
          };'''
if old_page in t:
    t=t.replace(old_page, new_page, 1)

p.write_text(t, encoding='utf-8')
print('trip -> line name')
