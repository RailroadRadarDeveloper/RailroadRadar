(function () {
'use strict';
if (window.__rrYardReportsLoaded) return;
window.__rrYardReportsLoaded = true;
var FACILITIES = ['MBTA Rochester Maintenance Facility','Boston Engine Terminal'];
var LOCATIONS = FACILITIES.concat(['South Station','Back Bay','North Station','Ruggles','Forest Hills','Readville','Braintree','Worcester','Framingham','Providence','Pawtucket/Central Falls','Newburyport','Rockport','Lowell','Haverhill','Fitchburg','Wickford Junction','Hyannis','Middleborough/Lakeville']);
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function firestore(){return window.firebase&&firebase.firestore?firebase.firestore():null;}
function auth(){return window.firebase&&firebase.auth?firebase.auth():null;}
function asDate(v){if(!v)return null;if(v.toDate)return v.toDate();var d=v instanceof Date?v:new Date(v);return isNaN(d.getTime())?null:d;}
function fmt(v){var d=asDate(v);return d?d.toLocaleString([],{dateStyle:'medium',timeStyle:'short'}):'—';}
function style(){
 if(document.getElementById('rr-yard-reports-style'))return;
 var s=document.createElement('style');s.id='rr-yard-reports-style';
 s.textContent='.rr-yard-report-fields{border-top:1px solid rgba(100,116,139,.25);margin-top:12px;padding-top:12px}.rr-yard-report-fields .rr-yard-field{margin:10px 0}.rr-yard-report-fields label{display:block;font-weight:600;margin:0 0 5px}.rr-yard-report-fields input,.rr-yard-report-fields select,.rr-yard-report-fields textarea{box-sizing:border-box;width:100%;min-height:40px;border:1px solid #aab3c2;border-radius:8px;padding:9px 10px;font:inherit;background:#fff;color:#172033}.rr-yard-report-fields textarea{min-height:72px;resize:vertical}.rr-yard-toggle{display:flex!important;align-items:center;gap:9px;margin:12px 0!important}.rr-yard-toggle input{width:18px!important;min-height:18px!important}.rr-yard-subfields{padding:10px 12px;border-left:3px solid #4263a5;background:rgba(100,116,139,.07);border-radius:5px}.rr-yard-help,.rr-yard-muted{font-size:12px;opacity:.72;margin:5px 0 0}.rr-yard-admin-card,.rr-yard-public-card{border:1px solid rgba(100,116,139,.3);border-radius:10px;padding:12px;margin:10px 0;background:var(--card-bg,#fff);color:var(--text-color,inherit)}.rr-yard-admin-card p,.rr-yard-public-card p{margin:5px 0;white-space:pre-wrap;overflow-wrap:anywhere}.rr-yard-admin-actions{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}.rr-yard-admin-actions button{padding:7px 12px}';
 document.head.appendChild(s);
}
function addMapFields(){
 var list=document.getElementById('report-locos-list');if(!list||document.getElementById('rr-yard-report-fields'))return;
 var w=document.createElement('section');w.id='rr-yard-report-fields';w.className='rr-yard-report-fields';
 var opts=LOCATIONS.map(function(v){return '<option value="'+esc(v)+'"></option>';}).join('');
 w.innerHTML='<div class="rr-yard-field"><label for="rr-report-facility">Report at a facility (optional)</label><select id="rr-report-facility"><option value="">Not a facility report — normal train report</option>'+FACILITIES.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join('')+'</select><p class="rr-yard-help">Facility reports require a reason and stay private until approved by an admin.</p></div>'+
 '<label class="rr-yard-toggle" for="rr-report-shopped"><input type="checkbox" id="rr-report-shopped"><span>Shopped?</span></label>'+
 '<div class="rr-yard-subfields" id="rr-report-shopped-fields" hidden><div class="rr-yard-field"><label for="rr-report-shopped-location">Current location</label><input id="rr-report-shopped-location" list="rr-yard-location-options" placeholder="Search station, town, or facility" autocomplete="off"></div><div class="rr-yard-field"><label for="rr-report-shopped-reason">Reason (required)</label><textarea id="rr-report-shopped-reason" maxlength="500" placeholder="Why is this locomotive shopped?"></textarea></div></div>'+
 '<label class="rr-yard-toggle" for="rr-report-special-move"><input type="checkbox" id="rr-report-special-move"><span>Special Move?</span></label>'+
 '<div class="rr-yard-subfields" id="rr-report-special-fields" hidden><div class="rr-yard-field"><label for="rr-report-special-from">From station, town, or facility</label><input id="rr-report-special-from" list="rr-yard-location-options" placeholder="Search origin" autocomplete="off"></div><div class="rr-yard-field"><label for="rr-report-special-to">To station, town, or facility</label><input id="rr-report-special-to" list="rr-yard-location-options" placeholder="Search destination" autocomplete="off"></div><div class="rr-yard-field"><label for="rr-report-special-departure">Estimated departure time</label><input id="rr-report-special-departure" type="datetime-local"></div><div class="rr-yard-field"><label for="rr-report-special-arrival">Estimated arrival time</label><input id="rr-report-special-arrival" type="datetime-local"></div><div class="rr-yard-field"><label for="rr-report-special-equipment">Equipment</label><textarea id="rr-report-special-equipment" maxlength="500" placeholder="Locomotive numbers and any other equipment involved"></textarea></div><div class="rr-yard-field"><label for="rr-report-special-notes">Additional notes (optional)</label><textarea id="rr-report-special-notes" maxlength="1000" placeholder="Other details about the move"></textarea></div><p class="rr-yard-help">Special moves remain public through estimated arrival; they are not removed at departure.</p></div>'+
 '<div class="rr-yard-field" id="rr-report-facility-reason-wrap" hidden><label for="rr-report-facility-reason">Reason for facility report (required)</label><textarea id="rr-report-facility-reason" maxlength="500" placeholder="Why is the locomotive at this facility?"></textarea></div><datalist id="rr-yard-location-options">'+opts+'</datalist>';
 list.insertAdjacentElement('afterend',w);
 var facility=document.getElementById('rr-report-facility'),shopped=document.getElementById('rr-report-shopped'),special=document.getElementById('rr-report-special-move');
 function sync(){
  var sp=special.checked,sh=shopped.checked&&!sp,fa=!!facility.value&&!sp&&!sh;
  document.getElementById('rr-report-shopped-fields').hidden=!sh;
  document.getElementById('rr-report-special-fields').hidden=!sp;
  document.getElementById('rr-report-facility-reason-wrap').hidden=!fa;
  facility.disabled=sp||sh;shopped.disabled=sp;
  if(sp){facility.value='';shopped.checked=false;}if(sh)facility.value='';
 }
 facility.addEventListener('change',sync);shopped.addEventListener('change',sync);special.addEventListener('change',sync);sync();
}
function collectLocos(){
 var out=[];document.querySelectorAll('[id^="report-custom-vehicle-"],[id^="report-unit-select-"]').forEach(function(el){var v=String(el.value||'').trim();if(v&&out.indexOf(v)<0)out.push(v);});return out.slice(0,5);
}
function localDate(id){var v=String((document.getElementById(id)||{}).value||'').trim();if(!v)return null;var d=new Date(v);return isNaN(d.getTime())?null:d;}
function type(){
 if(document.getElementById('rr-report-special-move')&&document.getElementById('rr-report-special-move').checked)return 'special_move';
 if(document.getElementById('rr-report-shopped')&&document.getElementById('rr-report-shopped').checked)return 'shopped';
 if(document.getElementById('rr-report-facility')&&document.getElementById('rr-report-facility').value)return 'facility';
 return '';
}
function formError(msg){var e=document.getElementById('report-train-error');if(e){e.textContent=msg;e.classList.add('visible');}else alert(msg);}
function labelFor(user,settings){
 var mode=String(settings.reportDisplayMode||'first_initial'),name=String(user.displayName||'').trim();
 if(mode==='anonymous')return 'Anonymous';
 if(mode==='custom'&&settings.reportCustomLabel)return String(settings.reportCustomLabel).slice(0,120);
 if(mode==='full_name'&&name)return name.slice(0,120);
 if(name){var p=name.split(/\s+/);return p.length>1?p[0].charAt(0)+'. '+p[p.length-1]:p[0];}
 return String(user.email||'Reporter').split('@')[0].slice(0,120);
}
async function submitYard(button){
 var a=auth(),f=firestore(),user=a&&a.currentUser;
 if(!user||!user.emailVerified)throw new Error('Sign in with a verified email address to submit a report.');
 if(!f)throw new Error('Reports are temporarily unavailable.');
 var agency=String((document.getElementById('report-agency')||{}).value||'mbta').toLowerCase();
 if(agency!=='mbta')throw new Error('Facility, shopped, and special-move reports are currently for MBTA equipment only.');
 var locos=collectLocos();if(!locos.length)throw new Error('Add at least one locomotive before submitting this report.');
 var kind=type(),data={reportType:kind,agency:'mbta',locomotives:locos,reportedByUid:user.uid,reportedByLabel:'Reporter',reportedByDisplayMode:'first_initial',reportedByVerified:false,createdAt:firebase.firestore.FieldValue.serverTimestamp(),status:'pending'};
 var settings={};try{var us=await f.collection('userSettings').doc(user.uid).get();if(us.exists)settings=us.data()||{};}catch(_){}
 data.reportedByLabel=labelFor(user,settings);data.reportedByDisplayMode=String(settings.reportDisplayMode||'first_initial');
 try{var vr=await f.collection('verifiedReporters').doc(user.uid).get();data.reportedByVerified=!!vr.exists;}catch(_){}
 if(kind==='facility'){
  data.facility=String(document.getElementById('rr-report-facility').value||'');data.reason=String(document.getElementById('rr-report-facility-reason').value||'').trim();
  if(FACILITIES.indexOf(data.facility)<0)throw new Error('Choose a supported facility.');if(!data.reason)throw new Error('Enter a reason for the facility report.');
 }else if(kind==='shopped'){
  data.location=String(document.getElementById('rr-report-shopped-location').value||'').trim();data.reason=String(document.getElementById('rr-report-shopped-reason').value||'').trim();
  if(!data.location)throw new Error('Search for and select the locomotive location.');if(!data.reason)throw new Error('Enter a reason for marking this locomotive shopped.');
 }else{
  data.fromLocation=String(document.getElementById('rr-report-special-from').value||'').trim();data.toLocation=String(document.getElementById('rr-report-special-to').value||'').trim();
  data.departureAt=localDate('rr-report-special-departure');data.arrivalAt=localDate('rr-report-special-arrival');
  data.equipment=String(document.getElementById('rr-report-special-equipment').value||'').trim();data.notes=String(document.getElementById('rr-report-special-notes').value||'').trim();
  if(!data.fromLocation||!data.toLocation)throw new Error('Enter both the origin and destination.');
  if(!data.departureAt||!data.arrivalAt)throw new Error('Enter estimated departure and arrival times.');
  if(data.arrivalAt<=data.departureAt)throw new Error('Estimated arrival must be after estimated departure.');
  if(!data.equipment)throw new Error('Enter the equipment involved in this special move.');
  if(data.departureAt<new Date(Date.now()-3600000))throw new Error('Estimated departure cannot be more than one hour in the past.');
 }
 button.disabled=true;
 try{
  await f.collection('pendingYardReports').add(data);
  if(typeof window.showNotification==='function')window.showNotification('Report submitted for admin approval.');else alert('Report submitted for admin approval.');
  var modal=document.getElementById('report-train-modal');if(modal){modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}
  ['rr-report-facility','rr-report-facility-reason','rr-report-shopped-location','rr-report-shopped-reason','rr-report-special-from','rr-report-special-to','rr-report-special-departure','rr-report-special-arrival','rr-report-special-equipment','rr-report-special-notes'].forEach(function(id){var el=document.getElementById(id);if(el)el.value='';});
  ['rr-report-shopped','rr-report-special-move'].forEach(function(id){var el=document.getElementById(id);if(el)el.checked=false;});
  var fac=document.getElementById('rr-report-facility');if(fac)fac.value='';
  var sp=document.getElementById('rr-report-special-move');if(sp)sp.dispatchEvent(new Event('change'));
 }finally{button.disabled=false;}
}
function wireMap(){
 addMapFields();var btn=document.getElementById('report-train-submit');if(!btn||btn.dataset.rrYardHooked)return;btn.dataset.rrYardHooked='1';
 btn.addEventListener('click',function(ev){if(!type())return;ev.preventDefault();ev.stopImmediatePropagation();submitYard(btn).catch(function(e){console.error('[yard reports] submit failed',e);formError(e&&e.message?e.message:'Could not submit this report.');});},true);
}
function addPublicTab(){
 var tabs=document.querySelector('#specials-board-modal .rr-admin-tabs'),modal=document.getElementById('specials-board-modal');
 if(!tabs||!modal||document.getElementById('board-tab-yard-reports'))return;
 var b=document.createElement('button');b.type='button';b.className='rr-admin-tab';b.id='board-tab-yard-reports';b.dataset.boardTab='yard-reports';b.textContent='Yard Reports';tabs.appendChild(b);
 var pane=document.createElement('div');pane.className='rr-admin-pane';pane.id='board-pane-yard-reports';pane.dataset.boardPane='yard-reports';pane.innerHTML='<div id="rr-yard-public-list"><p>Loading yard reports…</p></div>';
 var all=modal.querySelectorAll('.rr-admin-pane[data-board-pane]');if(all.length)all[all.length-1].insertAdjacentElement('afterend',pane);else modal.appendChild(pane);
 b.addEventListener('click',function(){tabs.querySelectorAll('.rr-admin-tab').forEach(function(x){x.classList.toggle('active',x===b);});modal.querySelectorAll('.rr-admin-pane[data-board-pane]').forEach(function(x){x.classList.toggle('active',x===pane);});loadPublic();});
}
async function loadPublic(){
 var host=document.getElementById('rr-yard-public-list'),f=firestore();if(!host||!f)return;host.textContent='Loading yard reports…';
 try{
  var snap=await f.collection('yardReports').get(),rows=snap.docs.map(function(d){return Object.assign({id:d.id},d.data()||{});});
  rows=rows.filter(function(r){return r.reportType!=='special_move'||(asDate(r.arrivalAt)&&asDate(r.arrivalAt).getTime()>Date.now());});
  rows.sort(function(x,y){return (asDate(y.approvedAt||y.createdAt)||new Date(0))-(asDate(x.approvedAt||x.createdAt)||new Date(0));});
  host.innerHTML='';if(!rows.length){host.textContent='No active yard reports.';return;}
  rows.forEach(function(r){
   var card=document.createElement('article');card.className='rr-yard-public-card';
   var title=document.createElement('strong');title.textContent=(r.locomotives||[]).join(', ')||'MBTA equipment';card.appendChild(title);
   var p=document.createElement('p');
   if(r.reportType==='facility')p.textContent=r.facility+' · '+(r.reason||'');
   else if(r.reportType==='shopped')p.textContent='Shopped at '+r.location+' · '+(r.reason||'');
   else p.textContent='Special move: '+r.fromLocation+' → '+r.toLocation+'\nDeparture: '+fmt(r.departureAt)+'\nEstimated arrival: '+fmt(r.arrivalAt)+'\nEquipment: '+(r.equipment||'')+(r.notes?'\nNotes: '+r.notes:'');
   card.appendChild(p);var by=document.createElement('p');by.className='rr-yard-muted';by.textContent='Reported by '+(r.reportedByLabel||'RailroadRadar user')+' · Approved '+fmt(r.approvedAt||r.createdAt);card.appendChild(by);host.appendChild(card);
  });
 }catch(e){console.error('[yard reports] public load failed',e);host.textContent='Yard reports could not be loaded.';}
}
var adminRows=[];
function addAdminQueue(){
 var status=document.getElementById('admin-pending-status');if(!status||document.getElementById('rr-admin-yard-pending'))return;
 var section=document.createElement('section');section.id='rr-admin-yard-pending';section.innerHTML='<h3 style="margin:18px 0 6px">Facility, Shopped &amp; Special-Move Reports</h3><p class="rr-modal-hint" id="rr-admin-yard-status">Loading pending reports…</p><div id="rr-admin-yard-list"></div>';status.insertAdjacentElement('afterend',section);
 section.addEventListener('click',function(ev){var yes=ev.target.closest('[data-yard-approve]'),no=ev.target.closest('[data-yard-reject]');if(yes)review(yes.dataset.yardApprove,true);if(no)review(no.dataset.yardReject,false);});
 loadAdmin();
}
function desc(r){
 if(r.reportType==='facility')return r.facility+' — '+(r.reason||'');
 if(r.reportType==='shopped')return 'Shopped at '+r.location+' — '+(r.reason||'');
 return 'Special move '+r.fromLocation+' → '+r.toLocation+' · '+fmt(r.departureAt)+' to '+fmt(r.arrivalAt)+' · '+(r.equipment||'')+(r.notes?' · '+r.notes:'');
}
async function loadAdmin(){
 var host=document.getElementById('rr-admin-yard-list'),status=document.getElementById('rr-admin-yard-status'),f=firestore();if(!host||!f)return;
 try{
  var snap=await f.collection('pendingYardReports').get();adminRows=snap.docs.map(function(d){return Object.assign({id:d.id},d.data()||{});});
  adminRows.sort(function(a,b){return (asDate(b.createdAt)||new Date(0))-(asDate(a.createdAt)||new Date(0));});
  host.innerHTML='';if(status)status.textContent=adminRows.length+' pending report(s)';if(!adminRows.length){host.textContent='No pending facility or special-move reports.';return;}
  adminRows.forEach(function(r){
   var card=document.createElement('article');card.className='rr-yard-admin-card';
   var title=document.createElement('strong');title.textContent=(r.reportType||'Report').replace('_',' ').toUpperCase()+' · '+(r.locomotives||[]).join(', ');card.appendChild(title);
   var p=document.createElement('p');p.textContent=desc(r);card.appendChild(p);
   var by=document.createElement('p');by.className='rr-yard-muted';by.textContent='Submitted '+fmt(r.createdAt)+' by '+(r.reportedByLabel||'Unknown reporter');card.appendChild(by);
   var actions=document.createElement('div');actions.className='rr-yard-admin-actions';
   var yes=document.createElement('button');yes.type='button';yes.className='rr-btn';yes.textContent='Approve';yes.dataset.yardApprove=r.id;
   var no=document.createElement('button');no.type='button';no.className='rr-btn danger secondary';no.textContent='Reject';no.dataset.yardReject=r.id;
   actions.append(yes,no);card.appendChild(actions);host.appendChild(card);
  });
 }catch(e){console.error('[yard reports] admin load failed',e);if(status)status.textContent='Could not load pending yard reports.';}
}
async function removePairings(row){
 var f=firestore(),shopped=new Set((row.locomotives||[]).map(function(x){return String(x).trim();}).filter(Boolean));if(!shopped.size)return;
 var snap=await f.collection('trainReports').where('agency','==','mbta').get(),batch=f.batch(),changes=0;
 snap.docs.forEach(function(doc){
  var d=doc.data()||{},locos=Array.isArray(d.locomotives)?d.locomotives.slice():[];
  if(!locos.length&&(d.locomotiveId||d.locomotiveId2))locos=[d.locomotiveId,d.locomotiveId2].filter(Boolean).map(function(id){return {locomotiveId:String(id),unitName:String(id),locoType:'',locoIconUrl:null};});
  var remaining=locos.filter(function(l){return !shopped.has(String((l&&l.locomotiveId)||'').trim());});
  if(remaining.length===locos.length)return;
  if(!remaining.length)batch.delete(doc.ref);
  else{var one=remaining[0],two=remaining[1]||{};batch.update(doc.ref,{locomotives:remaining,locomotiveId:one.locomotiveId||'',unitName:one.unitName||one.locomotiveId||'',locoType:one.locoType||'',locoIconUrl:one.locoIconUrl||null,locomotiveId2:two.locomotiveId||'',unitName2:two.unitName||'',locoType2:two.locoType||'',locoIconUrl2:two.locoIconUrl||null,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});}
  changes++;
 });
 if(changes)await batch.commit();
}
async function review(id,approve){
 var row=adminRows.find(function(x){return x.id===id;}),f=firestore();if(!row||!f)return;
 try{
  if(approve){var data=Object.assign({},row);delete data.id;delete data.status;data.approvedAt=firebase.firestore.FieldValue.serverTimestamp();data.approvedByUid=(auth()&&auth().currentUser&&auth().currentUser.uid)||null;
   await f.collection('yardReports').doc(id).set(data);
   if(row.reportType==='shopped'&&row.agency==='mbta')await removePairings(row);
  }
  await f.collection('pendingYardReports').doc(id).delete();
  if(typeof window.showNotification==='function')window.showNotification(approve?'Yard report approved':'Yard report rejected');
  await loadAdmin();if(approve)await loadPublic();
 }catch(e){console.error('[yard reports] review failed',e);if(typeof window.showNotification==='function')window.showNotification('Could not review report: '+(e.message||e),'error');}
}
function boot(){style();wireMap();addPublicTab();addAdminQueue();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
if(window.firebase&&firebase.auth){try{firebase.auth().onAuthStateChanged(function(){addAdminQueue();});}catch(_){}}
})();