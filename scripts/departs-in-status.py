from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

old='''          const stops = await getTripStops(tid, serviceDate);
          const title = rname ? `${rname} to ${dest}` : `Trip ${tid}`;'''

new='''          const stops = await getTripStops(tid, serviceDate);
          const title = rname ? `${rname} to ${dest}` : `Trip ${tid}`;
          const _when = (stops||[]).map(s => s.predictedTime || s.scheduledTime).find(tm => tm);
          let departsMsg = 'Scheduled';
          if (_when) {
            const totalMin = Math.round((_when.getTime() - Date.now()) / 60000);
            if (totalMin <= 0) departsMsg = 'Departed';
            else {
              const days = Math.floor(totalMin / 1440);
              const hours = Math.floor((totalMin % 1440) / 60);
              const mins = totalMin % 60;
              const parts = [];
              if (days) parts.push(days + ' day' + (days === 1 ? '' : 's'));
              if (hours) parts.push(hours + ' hour' + (hours === 1 ? '' : 's'));
              if (mins || !parts.length) parts.push(mins + ' minute' + (mins === 1 ? '' : 's'));
              departsMsg = 'Departs in ' + (days && parts.length > 1 ? parts[0] + ', ' + parts.slice(1).join(' ') : parts.join(' '));
            }
          }'''

if old not in t:
    raise SystemExit('openTrainSchedule insert point not found')
t=t.replace(old,new,1)

if 'Scheduled \u2014 no live vehicle yet' in t:
    t=t.replace('Scheduled \u2014 no live vehicle yet', '${departsMsg}', 1)
elif 'Scheduled — no live vehicle yet' in t:
    t=t.replace('Scheduled — no live vehicle yet', '${departsMsg}', 1)
else:
    raise SystemExit('status string not found')

p.write_text(t, encoding='utf-8')
print('departs-in status ready')
