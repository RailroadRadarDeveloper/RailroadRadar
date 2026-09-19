from pathlib import Path

p = Path('index.html')
t = p.read_text(encoding='utf-8')

old_fetch = """          const [predRes, schedRes] = await Promise.all([
            fetch(apiUrl('/api/mbta' + `/predictions?filter[stop]=${stationIds.join(',')}&include=trip,route,schedule,stop&sort=departure_time`)),
            fetch(apiUrl('/api/mbta' + `/schedules?filter[stop]=${stationIds.join(',')}&include=trip,route,stop&sort=departure_time`))
          ]);
          const predData = await predRes.json();
          const schedData = await schedRes.json();
          const departures = [];
          const now = new Date();"""

new_fetch = """          const now = new Date();
          const horizon = new Date(now.getTime() + 24 * 60 * 60 * 1000);
          const nyYmd = d => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
          const dates = [nyYmd(now)];
          const endDay = nyYmd(horizon);
          if (dates.indexOf(endDay) === -1) dates.push(endDay);
          const stopQ = stationIds.join(',');
          const predRes = await fetch(apiUrl('/api/mbta' + `/predictions?filter[stop]=${stopQ}&include=trip,route,schedule,stop&sort=departure_time`));
          const schedResList = await Promise.all(dates.map(dt => fetch(apiUrl('/api/mbta' + `/schedules?filter[stop]=${stopQ}&filter[date]=${encodeURIComponent(dt)}&include=trip,route,stop&sort=departure_time`))));
          const predData = await predRes.json();
          const schedData = { data: [], included: [] };
          for (const r of schedResList) {
            try {
              const j = await r.json();
              if (j.data) schedData.data = schedData.data.concat(j.data);
              if (j.included) schedData.included = schedData.included.concat(j.included);
            } catch (e) {}
          }
          const departures = [];"""

if old_fetch not in t:
    raise SystemExit('fetch block not found')
t = t.replace(old_fetch, new_fetch, 1)

# Keep past trains out and drop anything beyond 24 hours.
# There are two identical checks in getStationDepartures.
fn_start = t.find('async function getStationDepartures')
fn_end = t.find('\n      // Enrich completed stops', fn_start)
if fn_start < 0 or fn_end < 0:
    raise SystemExit('function bounds not found')
fn = t[fn_start:fn_end]
fn2 = fn.replace('if (depTime < now) return;', 'if (depTime < now || depTime > horizon) return;')
if fn2 == fn:
    raise SystemExit('depTime filter not found')
t = t[:fn_start] + fn2 + t[fn_end:]

t = t.replace(
    'const limited = departures.slice(0, 15);',
    'const limited = departures;',
    1,
)
t = t.replace(
    'Next Departures <small>(click for full schedule)</small>',
    'Next 24 hours <small>(click a train for its schedule)</small>',
    1,
)
t = t.replace(
    '''.departures-list {
      list-style: none;
      padding: 0;
      margin: 0;
      max-height: 250px;''',
    '''.departures-list {
      list-style: none;
      padding: 0;
      margin: 0;
      max-height: 360px;''',
    1,
)

p.write_text(t, encoding='utf-8')
print('station popups set to 24h')
