from pathlib import Path

OLD = '''            let cls = 'status-on-time', disp = stop.formattedPredictedTime || stop.formattedScheduledTime || 'Scheduled';
            if (stop.isCompleted) {
              if (stop.formattedActualTime) {
                disp = stop.formattedActualTime;
              } else {
                disp = stop.formattedPredictedTime || stop.formattedScheduledTime || 'Passed';
              }
              if (stop.delayMinutes > 15) cls = 'status-very-delayed';
              else if (stop.delayMinutes > 5) cls = 'status-delayed';
              else cls = 'status-passed';
            } else if (!stop.predictedTime) {
              cls = 'status-scheduled';
              disp = 'Scheduled';
            } else if (stop.delayMinutes > 15) { cls = 'status-very-delayed'; disp = `Now ${stop.formattedPredictedTime}`; }
            else if (stop.delayMinutes > 5) { cls = 'status-delayed'; disp = `Now ${stop.formattedPredictedTime}`; }'''

NEW = '''            const sched = stop.formattedScheduledTime || '';
            const pred = stop.formattedPredictedTime || '';
            const actual = stop.formattedActualTime || '';
            let cls = 'status-on-time';
            let disp = 'On time';
            if (stop.isCompleted) {
              if (stop.delayMinutes > 15) cls = 'status-very-delayed';
              else if (stop.delayMinutes > 5) cls = 'status-delayed';
              else cls = 'status-passed';
              disp = (actual && actual !== sched) ? actual : 'Departed';
            } else if (!stop.predictedTime) {
              cls = 'status-scheduled';
              disp = 'Scheduled';
            } else if (stop.delayMinutes > 15) {
              cls = 'status-very-delayed';
              disp = pred ? ('Now ' + pred) : 'Delayed';
            } else if (stop.delayMinutes > 5) {
              cls = 'status-delayed';
              disp = pred ? ('Now ' + pred) : 'Delayed';
            } else {
              cls = 'status-on-time';
              disp = 'On time';
            }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if OLD in t:
        t = t.replace(OLD, NEW, 1)
        print('replaced', path)
    else:
        print('block missing', path)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
