from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

old_menu = '''            <div class="header-account-email" id="header-account-email"></div>
            <button type="button" class="header-auth-btn sign-out" id="btn-google-signout" role="menuitem">Sign out</button>'''
new_menu = '''            <div class="header-account-email" id="header-account-email"></div>
            <a class="header-auth-btn" id="header-menu-mytrips" href="/mytrips/" role="menuitem">MyTrips</a>
            <button type="button" class="header-auth-btn" id="header-menu-account-settings" role="menuitem">Account settings</button>
            <button type="button" class="header-auth-btn sign-out" id="btn-google-signout" role="menuitem">Sign out</button>'''
if old_menu not in t:
    raise SystemExit('account menu block not found')
t = t.replace(old_menu, new_menu, 1)

# Style dropdown links like the other items
if '.header-account-menu a.header-auth-btn' not in t:
    t = t.replace(
        '    .header-account-menu .header-auth-btn:hover { background: #f1f2f6; }',
        '    .header-account-menu a.header-auth-btn { text-decoration: none; box-sizing: border-box; }\n    .header-account-menu .header-auth-btn:hover { background: #f1f2f6; }',
        1,
    )

# Remove MyTrips button from settings modal
old_sec = '''        <div class="rr-lightbox-section">
          <h3>Trip log</h3>
          <p class="rr-modal-hint" style="margin-top:0;">Log rides and track your miles (approximate). No GPS breadcrumbs stored.</p>
          <a class="rr-btn" id="account-open-trip-log" href="/mytrips/" style="display:inline-flex;align-items:center;justify-content:center;text-decoration:none;">MyTrips</a>
        </div>
'''
if old_sec in t:
    t = t.replace(old_sec, '', 1)

# Make username easier to find in settings
t = t.replace('<h3>Public profile</h3>', '<h3>Username &amp; public profile</h3>', 1)

# Wire dropdown Account settings
old_bind = "      if (btnSettings) btnSettings.addEventListener('click', openAccountSettingsLightbox);"
new_bind = '''      if (btnSettings) btnSettings.addEventListener('click', openAccountSettingsLightbox);
      const menuSettings = document.getElementById('header-menu-account-settings');
      if (menuSettings) menuSettings.addEventListener('click', function(e) {
        if (typeof closeAccountMenu === 'function') closeAccountMenu();
        openAccountSettingsLightbox(e);
      });'''
if old_bind in t:
    t = t.replace(old_bind, new_bind, 1)

p.write_text(t, encoding='utf-8')
print('dropdown + username heading updated')
