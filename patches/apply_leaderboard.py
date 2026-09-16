#!/usr/bin/env python3
from pathlib import Path
here = Path(__file__).resolve().parent
root = here.parent if here.name == 'patches' else here
text = (root / 'index.html').read_text()
insert = (here / 'lb_insert.js').read_text() if (here / 'lb_insert.js').exists() else (root / 'patches/lb_insert.js').read_text()
if 'function wireWeeklyLeaderboardUI' in text:
    print('already applied')
    raise SystemExit(0)

def must_replace(old, new, n=1):
    global text
    if text.count(old) < 1:
        raise SystemExit('missing snippet: ' + old[:80].replace('\n',' | '))
    text = text.replace(old, new, n)

must_replace(
    '    html.rr-train-page #btn-report-train-header,\n    html.rr-train-page #btn-specials-header,',
    '    html.rr-train-page #btn-report-train-header,\n    html.rr-train-page #btn-specials-header,\n    html.rr-train-page #btn-leaderboard-header,')
must_replace(
    '     #btn-report-train-header, #btn-specials-header { display: none !important; }\n     #btn-report-train-panel, #btn-specials-panel { display: block; }',
    '     #btn-report-train-header, #btn-specials-header, #btn-leaderboard-header { display: none !important; }\n     #btn-report-train-panel, #btn-specials-panel, #btn-leaderboard-panel { display: block; }')
must_replace(
    '     #btn-report-train-panel, #btn-specials-panel { display: none !important; }',
    '     #btn-report-train-panel, #btn-specials-panel, #btn-leaderboard-panel { display: none !important; }')
must_replace(
    '      #btn-report-train-header, #btn-specials-header { font-size: 11px; padding: 6px 8px; }',
    '      #btn-report-train-header, #btn-specials-header, #btn-leaderboard-header { font-size: 11px; padding: 6px 8px; }')
css = '''   #specials-board-modal .rr-lightbox { width: min(720px, 100%); max-height: min(88vh, 820px); }
    .header-leaderboard-btn { display: inline-flex; align-items: center; gap: 6px; margin-left: 6px; }
    .header-leaderboard-icon { display: inline-flex; width: 16px; height: 16px; flex-shrink: 0; }
    .header-leaderboard-icon svg { width: 16px; height: 16px; display: block; }
    #weekly-leaderboard-modal .rr-lightbox { width: min(1080px, 96vw); max-height: 94vh; height: 94vh; }
    .rr-lb-winner { display: flex; align-items: center; gap: 12px; background: #0b1048; color: #fff; border-radius: 12px; padding: 12px 14px; margin: 0 0 16px; }
    .rr-lb-winner-trophy { width: 42px; height: 42px; flex-shrink: 0; }
    .rr-lb-winner-trophy svg { width: 42px; height: 42px; display: block; }
    .rr-lb-winner-photo, .rr-lb-row-photo { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: #2c3e6b; flex-shrink: 0; border: 2px solid rgba(255,255,255,.35); }
    .rr-lb-winner-photo.placeholder, .rr-lb-row-photo.placeholder { display: inline-flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 13px; }
    .rr-lb-winner-text { font-size: 15px; line-height: 1.35; font-weight: 650; }
    .rr-lb-winner-text strong { font-weight: 800; }
    .rr-lb-list { display: flex; flex-direction: column; gap: 8px; overflow: auto; }
    .rr-lb-row { display: flex; align-items: center; gap: 12px; background: #f4f6f9; border-radius: 10px; padding: 10px 12px; }
    .rr-lb-rank { width: 28px; text-align: center; font-weight: 800; color: #07093e; flex-shrink: 0; }
    .rr-lb-name { flex: 1; font-weight: 750; color: #07093e; min-width: 0; }
    .rr-lb-meta { text-align: right; font-size: 13px; color: #2c3340; white-space: nowrap; }
    .rr-lb-meta strong { display: block; color: #07093e; font-size: 15px; }
    .rr-lb-empty { color: #5a6577; text-align: center; padding: 28px 12px; }
    @media (max-width: 640px) {
      .header-leaderboard-label { display: none; }
      .rr-lb-winner-text { font-size: 13px; }
    }'''
must_replace('   #specials-board-modal .rr-lightbox { width: min(720px, 100%); max-height: min(88vh, 820px); }', css)
ICON_BARS = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="1.5" y="12.2" width="6" height="10.3" rx="1.4" fill="#22c55e"/><rect x="9" y="1.5" width="6" height="21" rx="1.4" fill="#22c55e"/><rect x="16.5" y="6.2" width="6" height="16.3" rx="1.4" fill="#22c55e"/></svg>'
ICON_TROPHY = '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path fill="#22c55e" d="M12 10h40c1.2 0 2 .8 2 2v6c0 8.4-6.2 15.4-14.4 16.7-.6 4.2-3.4 7.7-7.6 9.1v6.2h8.2c1.1 0 2 .9 2 2v3.2H21.8V52c0-1.1.9-2 2-2H32v-6.2c-4.2-1.4-7-4.9-7.6-9.1C16.2 33.4 10 26.4 10 18v-6c0-1.2.8-2 2-2zm4.2 4v4.2c0 5.3 3.3 9.9 8.1 12.1 1.2-5.3 5.8-9.2 11.7-9.2s10.5 3.9 11.7 9.2c4.8-2.2 8.1-6.8 8.1-12.1V14H16.2z"/><polygon fill="#fff" points="22,18 44,28 22,36"/></svg>'
must_replace(
    '      <button type="button" class="header-auth-btn" id="btn-specials-header">Specials</button>',
    '      <button type="button" class="header-auth-btn" id="btn-specials-header">Specials</button>\n      <button type="button" class="header-auth-btn header-leaderboard-btn" id="btn-leaderboard-header" title="Weekly Leaderboard" aria-label="Weekly Leaderboard">\n        <span class="header-leaderboard-icon">' + ICON_BARS + '</span>\n        <span class="header-leaderboard-label">Weekly Leaderboard</span>\n      </button>')
must_replace(
    '      <button type="button" id="btn-specials-panel" class="cabcar-report-btn" style="margin-top:8px;">Specials & reports</button>',
    '      <button type="button" id="btn-specials-panel" class="cabcar-report-btn" style="margin-top:8px;">Specials & reports</button>\n      <button type="button" id="btn-leaderboard-panel" class="cabcar-report-btn" style="margin-top:8px;">Weekly Leaderboard</button>')
modal = (
'  </div>\n\n  <div class="rr-modal-backdrop" id="weekly-leaderboard-modal" aria-hidden="true">\n'
'    <div class="rr-modal rr-lightbox" role="dialog" aria-modal="true" aria-labelledby="weekly-leaderboard-title">\n'
'      <div class="rr-modal-header">\n'
'        <span id="weekly-leaderboard-title">Weekly Leaderboard</span>\n'
'        <button type="button" class="rr-modal-close" id="weekly-leaderboard-close" aria-label="Close">'
+ '\u00d7'
+ '</button>\n'
'      </div>\n'
'      <div class="rr-lightbox-body">\n'
'        <div class="rr-lb-winner" id="weekly-leaderboard-winner" hidden>\n'
'          <div class="rr-lb-winner-trophy">' + ICON_TROPHY + '</div>\n'
'          <div id="weekly-leaderboard-winner-photo-slot"></div>\n'
'          <div class="rr-lb-winner-text" id="weekly-leaderboard-winner-text"></div>\n'
'        </div>\n'
'        <p class="rr-modal-hint" id="weekly-leaderboard-range" style="margin-top:0;"></p>\n'
'        <div class="rr-lb-list" id="weekly-leaderboard-list"></div>\n'
'        <p class="rr-lb-empty" id="weekly-leaderboard-empty" hidden>No train reports this week yet. Report a consist to get on the board.</p>\n'
'      </div>\n'
'    </div>\n'
'  </div>\n\n'
'  <div class="rr-modal-backdrop signup-prompt-modal" id="signup-prompt-modal" aria-hidden="true">'
)
must_replace(
    '  </div>\n\n  <div class="rr-modal-backdrop signup-prompt-modal" id="signup-prompt-modal" aria-hidden="true">',
    modal)
must_replace(
    '          reportedByUid: user.uid,\n          reportedByDisplayMode: reportedByDisplayMode,\n          reportedByLabel: reportedByLabel,',
    '          reportedByUid: user.uid,\n          reportedByDisplayMode: reportedByDisplayMode,\n          reportedByLabel: reportedByLabel,\n          reportedByPhotoURL: user.photoURL || null,')
must_replace('      function openSpecialsBoard() {', insert.rstrip() + '\n      function openSpecialsBoard() {')
must_replace('      wireSpecialsBoardUI();', '      wireSpecialsBoardUI();\n      wireWeeklyLeaderboardUI();')
(root / 'index.html').write_text(text)
print('applied', text.count('wireWeeklyLeaderboardUI'))
