from pathlib import Path

p = Path('press/index.html')
t = p.read_text(encoding='utf-8')

CLARITY = '''<script>
window.__rrLoadClarity = function () {
  if (window.__rrClarityLoaded) return;
  window.__rrClarityLoaded = true;
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "yie7bk3bns");
};
try {
  var _rrConsent = localStorage.getItem('rr_cookie_consent');
  var _rrPrefsRaw = localStorage.getItem('rr_cookie_prefs');
  var _rrClarityOk = _rrConsent === 'accepted';
  if (_rrPrefsRaw) {
    try {
      var _rrPrefs = JSON.parse(_rrPrefsRaw);
      if (_rrPrefs && _rrPrefs.decided) _rrClarityOk = !!_rrPrefs.clarity;
    } catch (_e) {}
  }
  if (_rrClarityOk) window.__rrLoadClarity();
} catch (_) {}
</script>
'''

CSS = '''.rr-cookie{display:none;position:fixed;left:12px;right:12px;bottom:12px;z-index:40;background:#0c1448;border:1px solid #1a3a5f;padding:12px 14px;color:#fff;font-size:13px;line-height:1.45}
.rr-cookie.on{display:block}
.rr-cookie a{color:#fff;font-weight:700}
.rr-cookie .row{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center}
.rr-cookie label{display:flex;gap:6px;align-items:center;margin:0;font-size:13px;font-weight:600;color:#fff}
'''

BAR = '''<div class="rr-cookie" id="rr-cookie" hidden>
  <div>We use cookies to run RailroadRadar and, if you allow, Microsoft Clarity analytics.</div>
  <div class="row">
    <label><input type="checkbox" id="rr-cookie-clarity"> Analytics \u2014 Microsoft Clarity</label>
    <button class="btn" id="rr-cookie-accept" type="button">Accept</button>
    <button class="btn sec" id="rr-cookie-decline" type="button">Decline</button>
  </div>
</div>
'''

JS = '''
function rrCookieDecided(){
  try{
    const raw=localStorage.getItem('rr_cookie_prefs');
    if(raw){const p=JSON.parse(raw);if(p&&p.decided)return p;}
    const c=localStorage.getItem('rr_cookie_consent');
    if(c==='accepted')return {decided:true,clarity:true};
    if(c==='declined')return {decided:true,clarity:false};
  }catch(e){}
  return null;
}
function rrSaveCookies(on){
  try{
    localStorage.setItem('rr_cookie_consent', on?'accepted':'declined');
    localStorage.setItem('rr_cookie_prefs', JSON.stringify({decided:true,clarity:!!on,preferences:true,decidedAt:Date.now()}));
  }catch(e){}
  if(on&&typeof window.__rrLoadClarity==='function')window.__rrLoadClarity();
}
function rrCookieBar(){
  const box=document.getElementById('rr-cookie');
  if(!box)return;
  const decided=rrCookieDecided();
  if(decided){
    box.hidden=true;box.classList.remove('on');
    if(decided.clarity&&typeof window.__rrLoadClarity==='function')window.__rrLoadClarity();
    return;
  }
  box.hidden=false;box.classList.add('on');
  const ck=document.getElementById('rr-cookie-clarity');
  if(ck)ck.checked=true;
  const acc=document.getElementById('rr-cookie-accept');
  const dec=document.getElementById('rr-cookie-decline');
  if(acc)acc.onclick=()=>rrSaveCookies(!!(ck&&ck.checked));
  if(dec)dec.onclick=()=>rrSaveCookies(false);
}
rrCookieBar();
'''

if 'yie7bk3bns' not in t:
    needle = "betterstack('init', { environment: 'production' });\n</script>"
    if needle not in t:
        raise SystemExit('clarity insert point missing')
    t = t.replace(needle, needle + '\n' + CLARITY, 1)

if '.rr-cookie{' not in t:
    t = t.replace('.comment .meta{color:var(--muted)}', '.comment .meta{color:var(--muted)}\n' + CSS, 1)

if 'id="rr-cookie"' not in t:
    t = t.replace('<div class="wrap" id="app" tabindex="-1"></div>', '<div class="wrap" id="app" tabindex="-1"></div>\n' + BAR, 1)

if 'function rrCookieBar()' not in t:
    t = t.replace("document.getElementById('in').onclick", JS + "document.getElementById('in').onclick", 1)

p.write_text(t, encoding='utf-8')
print('clarity added to press')
