from pathlib import Path
p = Path('index.html')
t = p.read_text(encoding='utf-8')

broken = '''return `<li onclick="openTrainSchedule('${d.tripId}', '${d.routeName.replace(/'/g,"\\'", '${((d.predictedDeparture||d.scheduledDeparture)||new Date()).toLocaleDateString('en-CA',{timeZone:'America/New_York'})}')}', '${d.destination.replace(/'/g,"\\'")}')" style="cursor:pointer">'''

# Read the actual substring from file rather than guessing escapes
start = t.find('return `<li onclick="openTrainSchedule(\'${d.tripId}\'')
if start < 0:
    start = t.find('return `<li onclick="openTrainSchedule(\'${d.tripId}\'')
start = t.find('return `<li onclick="openTrainSchedule')
if start < 0:
    raise SystemExit('li onclick not found')
end = t.find('style="cursor:pointer">', start)
if end < 0:
    raise SystemExit('li end not found')
end = end + len('style="cursor:pointer">')
old = t[start:end]
print('OLD:', old)

fixed = '''const svcDate = ((d.predictedDeparture||d.scheduledDeparture)||new Date()).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
              return `<li onclick="openTrainSchedule('${d.tripId}', '${d.routeName.replace(/'/g,"\\'")}', '${d.destination.replace(/'/g,"\\'")}', '${svcDate}')" style="cursor:pointer">'''

t = t[:start] + fixed + t[end:]
p.write_text(t, encoding='utf-8')
print('FIXED')
