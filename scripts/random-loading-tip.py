#!/usr/bin/env python3
from pathlib import Path
path = Path("index.html")
text = path.read_text(encoding="utf-8")

old_fn = """function startLoadingTips() {
        setLoadingTip(RR_LOADING_TIPS[0]);
        try { clearInterval(loadingTipTimer); } catch (_) {}
        loadingTipTimer = setInterval(function() {
          loadingTipIdx = (loadingTipIdx + 1) % RR_LOADING_TIPS.length;
          setLoadingTip(RR_LOADING_TIPS[loadingTipIdx]);
        }, 2800);
      }"""
new_fn = """function startLoadingTips() {
        if (!RR_LOADING_TIPS.length) return;
        if (typeof window.__rrLoadingTipIdx === 'number' && window.__rrLoadingTipIdx >= 0 && window.__rrLoadingTipIdx < RR_LOADING_TIPS.length) {
          loadingTipIdx = window.__rrLoadingTipIdx;
        } else {
          loadingTipIdx = Math.floor(Math.random() * RR_LOADING_TIPS.length);
        }
        setLoadingTip(RR_LOADING_TIPS[loadingTipIdx]);
        try { clearInterval(loadingTipTimer); } catch (_) {}
        loadingTipTimer = setInterval(function() {
          loadingTipIdx = (loadingTipIdx + 1) % RR_LOADING_TIPS.length;
          setLoadingTip(RR_LOADING_TIPS[loadingTipIdx]);
        }, 2800);
      }"""
if old_fn not in text:
    raise SystemExit('startLoadingTips not found')
text = text.replace(old_fn, new_fn, 1)

marker = 'id="loading-text"'
i = text.find(marker)
if i < 0:
    raise SystemExit('loading-text not found')
start = text.rfind('<div', 0, i)
end = text.find('</div>', i)
if start < 0 or end < 0:
    raise SystemExit('loading-text tags not found')
new_html = '''    <div id="loading-text" style="font-size: 15px; opacity: 0.9; max-width: 320px; text-align: center; padding: 0 16px; min-height: 42px; line-height: 1.35;"></div>
    <script>
      window.RR_LOADING_TIPS = window.RR_LOADING_TIPS || [
        'Check the weekly leaderboard to see if you\u2019re reporting the most!',
        'Guys where is the Readville Switcher??',
        'Worcester Line on time? Screenshot that.',
        'Booking a ticket on the concert train.',
        'Share a live trip with your family and friends using the share button on train pop-ups!'
      ];
      (function () {
        var t = window.RR_LOADING_TIPS;
        var el = document.getElementById('loading-text');
        if (!el || !t || !t.length) return;
        window.__rrLoadingTipIdx = Math.floor(Math.random() * t.length);
        el.textContent = t[window.__rrLoadingTipIdx];
      })();
    </script>'''
text = text[:start] + new_html + text[end+6:]

# reuse the early list later if present
old_arr_start = text.find('const RR_LOADING_TIPS = [')
if old_arr_start >= 0:
    old_arr_end = text.find(']', old_arr_start)
    text = text[:old_arr_start] + "const RR_LOADING_TIPS = window.RR_LOADING_TIPS || [\n        'Check the weekly leaderboard to see if you\u2019re reporting the most!'\n      ]" + text[old_arr_end+1:]

path.write_text(text, encoding='utf-8')
print('patched')
