from pathlib import Path

p = Path('index.html')
t = p.read_text(encoding='utf-8')

old_sig = 'async function getTripStops(tripId) {\n        if (tripStopsCache[tripId] && (Date.now() - tripStopsCache[tripId].timestamp) < 300000) return tripStopsCache[tripId].stops;'
new_sig = 'async function getTripStops(tripId, serviceDate) {\n        const cacheKey = String(tripId) + \'|\' + String(serviceDate || \'\');\n        if (tripStopsCache[cacheKey] && (Date.now() - tripStopsCache[cacheKey].timestamp) < 300000) return tripStopsCache[cacheKey].stops;'
if old_sig not in t:
    raise SystemExit('getTripStops signature not found')
t = t.replace(old_sig, new_sig, 1)

old_fetch = '''          const [schedRes, predRes] = await Promise.all([
            fetch(apiUrl('/api/mbta' + `/schedules?filter[trip]=${tripId}&include=stop`), { 
              signal: controller.signal 
            }),
            fetch(apiUrl('/api/mbta' + `/predictions?filter[trip]=${tripId}`), { 
              signal: controller.signal 
            })
          ]);
          clearTimeout(timeoutId);
          const schedData = await schedRes.json();
          const predData = await predRes.json();'''

new_fetch = '''          const nyYmd = d => d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
          const _now = new Date();
          const dates = [];
          if (serviceDate) dates.push(String(serviceDate));
          [nyYmd(_now), nyYmd(new Date(_now.getTime() + 24*60*60*1000)), nyYmd(new Date(_now.getTime() - 24*60*60*1000))].forEach(dt => { if (dates.indexOf(dt) === -1) dates.push(dt); });
          const predRes = await fetch(apiUrl('/api/mbta' + `/predictions?filter[trip]=${tripId}`), { signal: controller.signal });
          let schedData = { data: [], included: [] };
          for (const dt of dates) {
            const schedRes = await fetch(apiUrl('/api/mbta' + `/schedules?filter[trip]=${encodeURIComponent(tripId)}&filter[date]=${encodeURIComponent(dt)}&include=stop`), { signal: controller.signal });
            const json = await schedRes.json();
            if (json && json.data && json.data.length) { schedData = json; break; }
          }
          clearTimeout(timeoutId);
          const predData = await predRes.json();'''

if old_fetch not in t:
    raise SystemExit('getTripStops fetch block not found')
t = t.replace(old_fetch, new_fetch, 1)

if "tripStopsCache[tripId] = { stops, timestamp: Date.now() }" not in t:
    raise SystemExit('cache write not found')
t = t.replace("tripStopsCache[tripId] = { stops, timestamp: Date.now() };", "tripStopsCache[cacheKey] = { stops, timestamp: Date.now() };", 1)

old_click = "return `<li onclick=\"openTrainSchedule('${d.tripId}', '${d.routeName.replace(/'/g,\"\\\\'\"}'}', '${d.destination.replace(/'/g,\"\\\\'\"}'}')\" style=\"cursor:pointer\">"
# Use a looser unique substring from the actual file
old_li = "onclick=\"openTrainSchedule('${d.tripId}', '${d.routeName.replace(/'/g,\"\\'\"}'}', '${d.destination.replace(/'/g,\"\\'\"}'}')\""
# The file uses this exact sequence from earlier extract:
needle = "openTrainSchedule('${d.tripId}', '${d.routeName.replace(/'/g,\"\\'\"}'}', '${d.destination.replace(/'/g,\"\\'\"}'}')"
# Try the version we saw on the live site
live = "openTrainSchedule('${d.tripId}', '${d.routeName.replace(/'/g,\"\\'\"}'}', '${d.destination.replace(/'/g,\"\\'\"}'}')"

# Search a simple unique prefix
idx = t.find("onclick=\"openTrainSchedule('${d.tripId}'")
if idx < 0:
    idx = t.find('onclick="openTrainSchedule(\'${d.tripId}\'')
print('onclick idx', idx)
if idx < 0:
    raise SystemExit('onclick not found')
# print nearby for debug written to stdout only
print(t[idx:idx+220])

# Replace just the function call args by expanding to include date
old_call = "openTrainSchedule('${d.tripId}', '${d.routeName.replace(/'/g,\"\\'\"}'}', '${d.destination.replace(/'/g,\"\\'\"}'}')"
new_call = "openTrainSchedule('${d.tripId}', '${d.routeName.replace(/'/g,\"\\'\"}'}', '${d.destination.replace(/'/g,\"\\'\"}'}', '${((d.predictedDeparture||d.scheduledDeparture)||new Date()).toLocaleDateString(\'en-CA\',{timeZone:\'America/New_York\'})}')"

if old_call in t:
    t = t.replace(old_call, new_call, 1)
    print('replaced via old_call')
else:
    # fallback: insert 4th arg before closing of openTrainSchedule( ... )
    start = t.find("openTrainSchedule('${d.tripId}'")
    if start < 0:
        raise SystemExit('openTrainSchedule template not found')
    end = t.find(')', start)
    call = t[start:end+1]
    if "toLocaleDateString" not in call:
        t = t[:end] + ", '${((d.predictedDeparture||d.scheduledDeparture)||new Date()).toLocaleDateString(\'en-CA\',{timeZone:\'America/New_York\'})}'" + t[end:]
        print('inserted 4th arg', call[:120])

t = t.replace(
    'window.openTrainSchedule = async function(tid, rname = \'\', dest = \'\') {',
    'window.openTrainSchedule = async function(tid, rname = \'\', dest = \'\', serviceDate = \'\') {',
    1,
)
t = t.replace(
    'const stops = await getTripStops(tid);',
    'const stops = await getTripStops(tid, serviceDate);',
    1,
)

p.write_text(t, encoding='utf-8')
print('patched next-day stops')
