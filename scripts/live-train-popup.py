from pathlib import Path

OLD_ICON = '''function rrSpecialCreateIcon() {
      return L.divIcon({
        className: 'rr-special-share-icon',
        html: '<div class="rr-special-share-pin" title="Special move"></div>',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18]
      });
    }'''

NEW_ICON = '''function rrSpecialCreateIcon(heading) {
      const rot = (heading != null && isFinite(Number(heading))) ? Number(heading) : 0;
      return L.divIcon({
        className: 'rr-special-share-icon',
        html: '<img src="/assets/hsp46.png" alt="" style="width:42px;height:18px;object-fit:contain;transform:rotate(' + rot + 'deg);filter:drop-shadow(0 1px 2px rgba(0,0,0,.45));">',
        iconSize: [42, 18],
        iconAnchor: [21, 9],
        popupAnchor: [0, -12]
      });
    }
    function rrSpecialPopupHtml(d) {
      const title = String((d && d.title) || 'Live trip').replace(/</g, '&lt;');
      const who = String((d && d.displayName) || 'Rider').replace(/</g, '&lt;');
      const updated = Number(d && d.updatedAt) || 0;
      const ago = updated ? rrSpecialFmtAgo(Date.now() - updated) : 'just now';
      return '<div class="train-popup">' +
        '<div class="train-popup-header"><span style="font-size:14.5px;font-weight:700;color:#fff;font-style:italic;">' + title + '</span></div>' +
        '<div style="padding:8px 10px;font-size:13px;color:#07093e;">' +
          '<div style="font-weight:700;">Live trip</div>' +
          '<div>' + who + '</div>' +
          '<div>Updated ' + ago + '</div>' +
        '</div></div>';
    }'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace('RR_SPECIAL_SHARE_MIN_INTERVAL_MS = 10000', 'RR_SPECIAL_SHARE_MIN_INTERVAL_MS = 1000')
    t = t.replace('RR_SPECIAL_SHARE_MOVE_M = 25', 'RR_SPECIAL_SHARE_MOVE_M = 8')
    if OLD_ICON in t:
        t = t.replace(OLD_ICON, NEW_ICON, 1)
        print('icon', path)
    else:
        print('icon missing', path)
    t = t.replace(
        "const html = '<div class=\"rr-special-share-popup\"><strong>' + title + '</strong>' +\n          '<div class=\"rr-ss-meta\">' + who + '</div>' +\n          '<div class=\"rr-ss-meta\">' + pingLabel + '</div>' +\n          '<div class=\"rr-ss-meta\">Special move</div></div>';",
        'const html = rrSpecialPopupHtml(d);',
        1,
    )
    t = t.replace('icon: rrSpecialCreateIcon()', 'icon: rrSpecialCreateIcon(d.heading)')
    t = t.replace(
        'm = L.marker([ping.lat, ping.lon], { icon: rrSpecialCreateIcon(), zIndexOffset: 1800 });',
        'm = L.marker([ping.lat, ping.lon], { icon: rrSpecialCreateIcon(ping.heading), zIndexOffset: 1800 });',
        1,
    )
    t = t.replace(
        "const html = '<div class=\"rr-special-share-popup\"><strong>' + String(doc.title || '').replace(/</g, '&lt;') + '</strong>' +\n              '<div class=\"rr-ss-meta\">' + String(doc.displayName || 'You').replace(/</g, '&lt;') + '</div>' +\n              '<div class=\"rr-ss-meta\">Last ping just now</div>' +\n              '<div class=\"rr-ss-meta\">Special move</div></div>';",
        'const html = rrSpecialPopupHtml(doc);',
        1,
    )
    # rotate existing marker when it moves
    t = t.replace(
        'if (m) {\n              m.setLatLng([lat, lon]);',
        'if (m) {\n              m.setLatLng([lat, lon]);\n              try { m.setIcon(rrSpecialCreateIcon(d.heading)); } catch (_) {}',
        1,
    )
    p.write_text(t, encoding='utf-8')
    print('done', path)

patch('index.html')
patch('mytrips/index.html')
