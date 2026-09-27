from pathlib import Path

OLD_LEFT = '''            // Left column shows actual time when we have it, otherwise scheduled
            const leftTime = (stop.isCompleted && stop.formattedActualTime) ? stop.formattedActualTime : stop.formattedScheduledTime;'''

NEW_LEFT = '''            // Past stops: actual / last live prediction. Upcoming: schedule.
            const leftTime = stop.isCompleted
              ? (stop.formattedActualTime || stop.formattedPredictedTime || stop.formattedScheduledTime)
              : (stop.formattedScheduledTime || stop.formattedPredictedTime || '');'''

OLD_MBTA = '''                formattedPredictedTime: predTime ? predTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null,
                isCompleted,'''

NEW_MBTA = '''                formattedPredictedTime: predTime ? predTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null,
                formattedActualTime: isCompleted
                  ? ((predTime || schedTime) ? (predTime || schedTime).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : null)
                  : null,
                isCompleted,'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    n = 0
    if OLD_LEFT in t:
        t = t.replace(OLD_LEFT, NEW_LEFT, 1); n += 1
    if OLD_MBTA in t:
        t = t.replace(OLD_MBTA, NEW_MBTA, 1); n += 1
    print(path, 'replacements', n)
    p.write_text(t, encoding='utf-8')

patch('index.html')
patch('mytrips/index.html')
