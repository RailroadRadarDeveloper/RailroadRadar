(function(){'use strict';
var KEY='rr_getting_started_seen_v1';
try{if(localStorage.getItem(KEY))return}catch(_){return}
function visible(el){return el&&el.getClientRects().length&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'}
function show(){
 if(document.getElementById('rr-first-visit-guide'))return;
 var modals=document.querySelectorAll('[aria-modal="true"]');var modalOpen=false;for(var i=0;i<modals.length;i++){if(visible(modals[i])){modalOpen=true;break}}if(visible(document.getElementById('rr-cookie-bar'))||visible(document.getElementById('rr-cookie-modal'))||modalOpen){setTimeout(show,2500);return}
 var box=document.createElement('aside');box.id='rr-first-visit-guide';box.setAttribute('aria-label','Welcome to RailroadRadar');
 box.innerHTML='<button type="button" class="rr-guide-dismiss" aria-label="Dismiss">×</button><p>NEW TO RAILROADRADAR?</p><strong>Let’s get you started.</strong><span>Take a quick tour of the live map, train search, reports, and more.</span><a href="/getting-started/">Start the guide <b aria-hidden="true">→</b></a><button type="button" class="rr-guide-later">Maybe later</button>';
 var style=document.createElement('style');style.textContent='#rr-first-visit-guide{position:fixed;right:18px;bottom:18px;z-index:10040;width:310px;max-width:calc(100vw - 28px);padding:18px;background:#07093e;color:#fff;border:1px solid #344b85;border-radius:12px;box-shadow:0 12px 34px #0005;font:14px/1.45 "Google Sans",Roboto,Arial,sans-serif}#rr-first-visit-guide p{margin:0 0 6px;color:#a9c6ee;font-size:10px;font-weight:800;letter-spacing:1.1px}#rr-first-visit-guide strong{display:block;font-size:17px;margin:0 24px 5px 0}#rr-first-visit-guide span{display:block;color:#d2dcef;font-size:12px;margin-bottom:13px}#rr-first-visit-guide a{display:inline-flex;gap:9px;align-items:center;padding:9px 12px;border-radius:7px;background:#fff;color:#07093e;text-decoration:none;font-weight:800;font-size:12px}#rr-first-visit-guide .rr-guide-later{margin-left:8px;padding:8px 5px;border:0;background:transparent;color:#d2dcef;font:600 11px inherit;cursor:pointer}#rr-first-visit-guide .rr-guide-dismiss{position:absolute;right:9px;top:8px;border:0;background:transparent;color:#fff;font-size:22px;cursor:pointer}';
 document.head.appendChild(style);document.body.appendChild(box);
 function dismiss(){try{localStorage.setItem(KEY,'1')}catch(_){}box.remove()}
 box.querySelector('.rr-guide-dismiss').addEventListener('click',dismiss);box.querySelector('.rr-guide-later').addEventListener('click',dismiss);
 box.querySelector('a').addEventListener('click',function(){try{localStorage.setItem(KEY,'1')}catch(_){}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(show,4000)});else setTimeout(show,4000);
})();