from pathlib import Path
p=Path('index.html')
t=p.read_text(encoding='utf-8')

css_old='''    html.rr-train-page,
    html.rr-train-page body {
      overflow: auto;
      height: auto;
      min-height: 100%;
      background: #07093e;
    }'''
css_new=css_old + '''
    html.rr-train-page #loading-screen {
      display: none !important;
    }'''
if 'html.rr-train-page #loading-screen' not in t:
    if css_old not in t:
        raise SystemExit('train-page css not found')
    t=t.replace(css_old, css_new, 1)

old='''        if (!loadingScreen) return;
        setLoadingProgress(100, 'Ready!');
        setLoadingTip('No defects. Detector out. \u270c\ufe0f');
        setTimeout(() => {
          loadingScreen.style.opacity = '0';
          setTimeout(() => {
            loadingScreen.style.display = 'none';
          }, 400);
        }, 2000);'''
# file may contain the emoji as real chars
old2='''        if (!loadingScreen) return;
        setLoadingProgress(100, 'Ready!');
        setLoadingTip('No defects. Detector out. ✌️');
        setTimeout(() => {
          loadingScreen.style.opacity = '0';
          setTimeout(() => {
            loadingScreen.style.display = 'none';
          }, 400);
        }, 2000);'''
fast='''        if (!loadingScreen) return;
        const skipWait = document.documentElement.classList.contains('rr-train-page') || !!(new URLSearchParams(location.search).get('train') || new URLSearchParams(location.search).get('t'));
        if (skipWait) {
          loadingScreen.style.display = 'none';
          loadingScreen.style.opacity = '0';
          return;
        }
        setLoadingProgress(100, 'Ready!');
        setLoadingTip('No defects. Detector out. ✌️');
        setTimeout(() => {
          loadingScreen.style.opacity = '0';
          setTimeout(() => {
            loadingScreen.style.display = 'none';
          }, 400);
        }, 2000);'''
if old2 in t:
    t=t.replace(old2, fast, 1)
elif old in t:
    t=t.replace(old, fast, 1)
elif 'skipWait' not in t:
    raise SystemExit('hideLoadingScreen block not found')

p.write_text(t, encoding='utf-8')
print('share links skip loading screen')
