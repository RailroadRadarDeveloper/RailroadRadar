#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

BETTERSTACK_TAG = '''  <script>
    !function(b,e,t,r){
      b[t]=b[t]||function(...args){(b[t].q=b[t].q||[]).push(args)};
      b[t].l=+new Date;
      var s=e.createElement('script'); s.async=1; s.crossOrigin='anonymous';
      s.src='https://betterstack.net/b.js?t='+r;
      (e.head||e.getElementsByTagName('head')[0]).appendChild(s);
    }(window,document,'betterstack','9YUqwW9LKdXPNgHo9Vg5Vzf3');
    betterstack('init', { environment: 'production' });
  </script>
'''

IDENTIFY_FN = '''    function rrIdentifyBetterStack(user) {
      try {
        if (typeof betterstack !== 'function') return;
        if (!user) return;
        betterstack('user', {
          id: user.uid || '',
          email: user.email || '',
          username: user.displayName || user.email || ''
        });
      } catch (_) {}
    }
'''

OLD_H1 = '    <h1>Admin access required</h1>'
NEW_H1 = '    <h1>Access denied</h1>'
OLD_P = "    <p>This page is only for RailroadRadar admins. You\u2019re signed in, but this account isn\u2019t on the admin list.</p>"
NEW_P = '    <p>You do not have permission to access this page.</p>'


def insert_tag(text):
    if "betterstack.net/b.js" in text:
        return text
    needle = '</head>'
    i = text.find(needle)
    if i < 0:
        raise SystemExit('no </head> found')
    return text[:i] + BETTERSTACK_TAG + text[i:]


def insert_identify(text):
    if 'function rrIdentifyBetterStack' in text:
        return text
    # after currentUser assignment in onAuthStateChanged
    old = '        currentUser = user;\n        updateHeaderAuthUI(user);'
    new = '        currentUser = user;\n        rrIdentifyBetterStack(user);\n        updateHeaderAuthUI(user);'
    if old in text:
        text = text.replace(old, new, 1)
    old2 = '          currentUser = user;\n          updateHeaderAuthUI(user);'
    new2 = '          currentUser = user;\n          rrIdentifyBetterStack(user);\n          updateHeaderAuthUI(user);'
    if old2 in text:
        text = text.replace(old2, new2, 1)
    # place helper near auth boot if possible
    marker = '    function updateHeaderAuthUI(user) {'
    if marker in text and 'function rrIdentifyBetterStack' not in text:
        text = text.replace(marker, IDENTIFY_FN + '\n' + marker, 1)
    elif 'function rrIdentifyBetterStack' not in text:
        # last-resort: inject before first onAuthStateChanged
        marker2 = 'auth.onAuthStateChanged'
        j = text.find(marker2)
        if j < 0:
            return text
        text = text[:j] + IDENTIFY_FN + '\n    ' + text[j:]
    return text


def patch_denied(text):
    text = text.replace(OLD_H1, NEW_H1)
    text = text.replace(OLD_P, NEW_P)
    # ascii apostrophe variant just in case
    text = text.replace(
        "    <p>This page is only for RailroadRadar admins. You're signed in, but this account isn't on the admin list.</p>",
        NEW_P,
    )
    return text


html_pages = [
    ROOT / 'index.html',
    ROOT / 'admin.html',
    ROOT / '404.html',
    ROOT / 'offline.html',
    ROOT / 'policies' / 'privacy' / 'index.html',
    ROOT / 'policies' / 'terms-of-use' / 'index.html',
]

for path in html_pages:
    if not path.exists():
        print('skip missing', path)
        continue
    text = path.read_text(encoding='utf-8')
    text = insert_tag(text)
    if path.name in ('index.html', 'admin.html') and path.parent == ROOT:
        text = insert_identify(text)
    if path.name == 'admin.html':
        text = patch_denied(text)
    path.write_text(text, encoding='utf-8')
    print('patched', path.relative_to(ROOT))

builder = ROOT / 'scripts' / 'build-admin-page.py'
if builder.exists():
    text = builder.read_text(encoding='utf-8')
    text = patch_denied(text)
    if "betterstack.net/b.js" not in text:
        old = '  <script src="https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js"></script>'
        new = BETTERSTACK_TAG + old
        if old not in text:
            raise SystemExit('builder firebase script tag not found')
        text = text.replace(old, new, 1)
    if 'function rrIdentifyBetterStack' not in text:
        marker = '    function updateHeaderAuthUI(user) {'
        if marker not in text:
            raise SystemExit('builder updateHeaderAuthUI not found')
        text = text.replace(marker, IDENTIFY_FN + '\n' + marker, 1)
    old = '        currentUser = user;\n        updateHeaderAuthUI(user);'
    new = '        currentUser = user;\n        rrIdentifyBetterStack(user);\n        updateHeaderAuthUI(user);'
    if old in text:
        text = text.replace(old, new, 1)
    builder.write_text(text, encoding='utf-8')
    print('patched scripts/build-admin-page.py')
