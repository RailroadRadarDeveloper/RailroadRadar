from pathlib import Path

PICKER = '''
                <label for="trip-log-live-icon">Icon</label>
                <select id="trip-log-live-icon">
                  <option value="/assets/hsp46.png">HSP46</option>
                  <option value="/assets/f40ph.png">F40PH</option>
                  <option value="/assets/gp40mc.png">GP40MC</option>
                  <option value="/assets/amtrak-acs64.png">Amtrak ACS-64</option>
                  <option value="/assets/amtrak-empire.png">Amtrak Empire</option>
                  <option value="/assets/njt-alp.png">NJT ALP</option>
                  <option value="/assets/mbta-1036.png">MBTA 1036</option>
                  <option value="/assets/mbta-1072.png">MBTA 1072</option>
                  <option value="/assets/mbta-1776.png">MBTA 1776</option>
                </select>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'trip-log-live-icon' not in t:
        t = t.replace('<label for="trip-log-train-title">Service name</label>', PICKER + '                <label for="trip-log-train-title">Service name</label>', 1)
        print('picker', path)
    t = t.replace(
        "html: '<img src=\"/assets/hsp46.png\" alt=\"\" style=\"width:46px;height:20px;object-fit:contain;transform:rotate(' + rot + 'deg);display:block;\">'",
        "html: '<img src=\"' + (src || '/assets/hsp46.png') + '\" alt=\"\" style=\"width:46px;height:20px;object-fit:contain;transform:rotate(' + rot + 'deg);display:block;\">'",
    )
    t = t.replace('function rrLiveTrainIcon(heading) {', 'function rrLiveTrainIcon(heading, src) {')
    t = t.replace('icon: rrLiveTrainIcon(data.heading)', 'icon: rrLiveTrainIcon(data.heading, data.icon)')
    old = 'var title = ((document.getElementById(\'trip-log-train-title\') || {}).value || \'Live trip\').trim().slice(0, 80);'
    new = old + '\n      var icon = ((document.getElementById(\'trip-log-live-icon\') || {}).value || \'/assets/hsp46.png\');'
    if old in t:
        t = t.replace(old, new, 1)
    t = t.replace(
        'var share = { uid: user.uid, tripId: \'live-\' + now, title: title, startedAt: now, expiresAt: now + 5 * 60 * 60 * 1000, updatedAt: now };',
        'var share = { uid: user.uid, tripId: \'live-\' + now, title: title, icon: icon, startedAt: now, expiresAt: now + 5 * 60 * 60 * 1000, updatedAt: now };',
        1,
    )
    t = t.replace(
        'tripId: share.tripId, title: title, active: true,',
        'tripId: share.tripId, title: title, icon: icon, active: true,',
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('done', path, 'icon field', 'trip-log-live-icon' in t)

patch('index.html')
patch('mytrips/index.html')
user = Path('live/user.html')
u = user.read_text(encoding='utf-8')
u = u.replace(
    "html: '<img src=\"/assets/hsp46.png\" alt=\"\" style=\"width:46px;height:20px;object-fit:contain;transform:rotate(' + rot + 'deg);display:block;\">'",
    "html: '<img src=\"' + (src || '/assets/hsp46.png') + '\" alt=\"\" style=\"width:46px;height:20px;object-fit:contain;transform:rotate(' + rot + 'deg);display:block;\">'",
)
u = u.replace('function icon(heading) {', 'function icon(heading, src) {')
u = u.replace('icon: icon(d.heading)', 'icon: icon(d.heading, d.icon)')
user.write_text(u, encoding='utf-8')
print('user', 'd.icon' in u)
