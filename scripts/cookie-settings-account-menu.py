from pathlib import Path

ITEM = '<button type="button" class="header-auth-btn" id="header-menu-cookie-settings" role="menuitem">Cookie settings</button>\n            '

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    if 'id="header-menu-cookie-settings"' not in t:
        if 'id="header-menu-account-settings"' in t:
            t = t.replace(
                '<button type="button" class="header-auth-btn" id="header-menu-account-settings" role="menuitem">Account settings</button>\n',
                '<button type="button" class="header-auth-btn" id="header-menu-account-settings" role="menuitem">Account settings</button>\n            ' + ITEM,
                1,
            )
        else:
            t = t.replace(
                '<div class="header-account-email" id="header-account-email"></div>\n            <button type="button" class="header-auth-btn sign-out"',
                '<div class="header-account-email" id="header-account-email"></div>\n            ' + ITEM + '<button type="button" class="header-auth-btn sign-out"',
                1,
            )
    old_btn = '''          <button type="button" id="rr-cookie-settings-mytrips" aria-label="Cookie settings" title="Cookie settings">Cookie settings</button>\n'''
    if old_btn in t:
        t = t.replace(old_btn, '', 1)
    bind_old = '''      var mytripsCookieBtn = document.getElementById('rr-cookie-settings-mytrips');
      if (mytripsCookieBtn) {
        mytripsCookieBtn.addEventListener('click', function () {
          openModal();
        });
      }'''
    bind_new = bind_old + '''
      var cookieMenuBtn = document.getElementById('header-menu-cookie-settings');
      if (cookieMenuBtn) {
        cookieMenuBtn.addEventListener('click', function () {
          try { if (typeof closeAccountMenu === 'function') closeAccountMenu(); } catch (_) {}
          openModal();
        });
      }'''
    if bind_old in t and 'header-menu-cookie-settings' not in t[t.find("var mytripsCookieBtn"):t.find("var mytripsCookieBtn")+500]:
        t = t.replace(bind_old, bind_new, 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)

patch('index.html')
patch('mytrips/index.html')
