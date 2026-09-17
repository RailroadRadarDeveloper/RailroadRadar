#!/usr/bin/env python3
from pathlib import Path
path = Path("index.html")
text = path.read_text(encoding="utf-8")

old_html = '    <div id="loading-text" style="font-size: 15px; opacity: 0.9;">0%</div>'
new_html = '    <div id="loading-text" style="font-size: 15px; opacity: 0.9; max-width: 320px; text-align: center; padding: 0 16px; min-height: 42px; line-height: 1.35;">Check the weekly leaderboard to see if you\u2019re reporting the most!</div>'
if old_html not in text:
    raise SystemExit("loading-text html not found")
text = text.replace(old_html, new_html, 1)

old_js = """      function setLoadingProgress(percent, message) {
        const bar = document.getElementById('loading-bar');
        const txt = document.getElementById('loading-text');
        const p = Math.round(Math.min(100, Math.max(0, Number(percent) || 0)));
        if (bar) bar.style.width = p + '%';
        // Show percentage only (message ignored \u2014 kept for call-site compatibility)
        if (txt) txt.textContent = p + '%';
      }
      function hideLoadingScreen() {
        if (loadingScreenHidden) return;
        loadingScreenHidden = true;
        try { clearTimeout(loadingFailsafeTimer); } catch (_) {}
        const loadingScreen = document.getElementById('loading-screen');
        if (!loadingScreen) return;
        setLoadingProgress(100, 'Ready!');
        setTimeout(() => {
          loadingScreen.style.opacity = '0';
          setTimeout(() => {
            loadingScreen.style.display = 'none';
          }, 400);
        }, 350);
      }"""

new_js = """      const RR_LOADING_TIPS = [
        'Check the weekly leaderboard to see if you\u2019re reporting the most!',
        'Guys where is the Readville Switcher??',
        'If you see a special, tap it. Then report it.',
        'Worcester Line on time? Screenshot that.',
        'HSP-46s don\u2019t sparkle themselves.',
        'North Station is a suggestion, not a promise.'
      ];
      let loadingTipTimer = null;
      let loadingTipIdx = 0;
      function setLoadingTip(msg) {
        const txt = document.getElementById('loading-text');
        if (txt) txt.textContent = msg;
      }
      function startLoadingTips() {
        setLoadingTip(RR_LOADING_TIPS[0]);
        try { clearInterval(loadingTipTimer); } catch (_) {}
        loadingTipTimer = setInterval(function() {
          loadingTipIdx = (loadingTipIdx + 1) % RR_LOADING_TIPS.length;
          setLoadingTip(RR_LOADING_TIPS[loadingTipIdx]);
        }, 2800);
      }
      function setLoadingProgress(percent, message) {
        const bar = document.getElementById('loading-bar');
        const p = Math.round(Math.min(100, Math.max(0, Number(percent) || 0)));
        if (bar) bar.style.width = p + '%';
      }
      function hideLoadingScreen() {
        if (loadingScreenHidden) return;
        loadingScreenHidden = true;
        try { clearTimeout(loadingFailsafeTimer); } catch (_) {}
        try { clearInterval(loadingTipTimer); } catch (_) {}
        const loadingScreen = document.getElementById('loading-screen');
        if (!loadingScreen) return;
        setLoadingProgress(100, 'Ready!');
        setLoadingTip('No defects. Detector out. \u270C\uFE0F');
        setTimeout(() => {
          loadingScreen.style.opacity = '0';
          setTimeout(() => {
            loadingScreen.style.display = 'none';
          }, 400);
        }, 2000);
      }
      startLoadingTips();"""

if old_js not in text:
    raise SystemExit("loading js not found")
text = text.replace(old_js, new_js, 1)
path.write_text(text, encoding="utf-8")
print("patched")
