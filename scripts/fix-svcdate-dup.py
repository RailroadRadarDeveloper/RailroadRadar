from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')
dup='''const svcDate = ((d.predictedDeparture||d.scheduledDeparture)||new Date()).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
              const svcDate = ((d.predictedDeparture||d.scheduledDeparture)||new Date()).toLocaleDateString('en-CA',{timeZone:'America/New_York'});'''
one='''const svcDate = ((d.predictedDeparture||d.scheduledDeparture)||new Date()).toLocaleDateString('en-CA',{timeZone:'America/New_York'});'''
if dup in t:
    t=t.replace(dup, one)
    p.write_text(t, encoding='utf-8')
    print('removed duplicate')
elif t.count('const svcDate')<=1:
    print('already unique', t.count('const svcDate'))
else:
    raise SystemExit('dup pattern not found, count='+str(t.count('const svcDate')))
