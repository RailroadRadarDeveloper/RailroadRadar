from pathlib import Path

user = Path('live/user.html')
t = user.read_text(encoding='utf-8')
t = t.replace(
    '#live-stats { position: fixed; top: 60px; left: 0; right: 0; z-index: 9000; display: flex; gap: 18px; padding: 10px 16px; background: #07093e; color: #fff; font-size: 14px; font-weight: 700; }\n    #map { position: fixed; top: 104px; left: 0; right: 0; bottom: 0; background: #d7dde6; }',
    '#rr-live-bar, #live-share-banner { position: fixed; top: 60px; left: 0; right: 0; z-index: 10040; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: #b00020; color: #fff; padding: 10px 16px; font: 700 14px/1.3 sans-serif; }\n    #live-stats { position: fixed; top: 104px; left: 0; right: 0; z-index: 9000; display: flex; gap: 18px; padding: 10px 16px; background: #07093e; color: #fff; font-size: 14px; font-weight: 700; }\n    #map { position: fixed; top: 148px; left: 0; right: 0; bottom: 0; background: #d7dde6; }',
    1,
)
if 'id="live-share-banner"' not in t:
    t = t.replace(
        '<div id="live-stats">',
        '<div id="live-share-banner">Sharing live location <button type="button" id="live-share-stop" style="background:#fff;color:#b00020;border:0;border-radius:999px;padding:6px 10px;font-weight:800;">Stop sharing</button></div>\n  <div id="live-stats">',
        1,
    )
stop = '''
    document.getElementById('live-share-stop').onclick = function() {
      try { localStorage.setItem('rrSpecialShareStopped', '1'); localStorage.removeItem('rrSpecialMoveShareV1'); } catch (e) {}
      document.getElementById('live-share-banner').hidden = true;
      if (window.firebase && firebase.auth && firebase.auth().currentUser) {
        firebase.firestore().collection('specialMoveShares').doc(firebase.auth().currentUser.uid).delete();
      }
    };
'''
if 'live-share-stop' in t and 'live-share-stop\').onclick' not in t:
    t = t.replace('var marker = null;', 'var marker = null;\n' + stop, 1)
user.write_text(t, encoding='utf-8')
print('user banner', 'live-share-banner' in t)

bar = Path('assets/js/live-share-bar.js')
b = bar.read_text(encoding='utf-8')
b = b.replace('top:60px', 'top:60px')
b = b.replace('z-index:9000', 'z-index:10040')
old = '''    if (!navigator.permissions) return;
    navigator.permissions.query({ name: 'geolocation' }).then(function (p) {
      if (!stopped() && p.state === 'granted') startWatch(read());
    }).catch(function () {});
  }'''
new = '''    startWatch(read());
  }'''
if old in b:
    b = b.replace(old, new, 1)
    print('resume')
bar.write_text(b, encoding='utf-8')
