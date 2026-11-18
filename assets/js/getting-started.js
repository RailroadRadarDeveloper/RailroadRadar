(function(){'use strict';
var data={
quick:[
['STEP 1 · THE BASICS','Start with the Live Map','The Live Map is the main place to see train activity. Move around the map, zoom in on a corridor, and select a train marker to open its information.','Train availability and detail vary by railroad and by the data currently provided.','/map/','Explore the Live Map','Getting oriented'],
['STEP 2 · FIND A TRAIN','Search trains and stations','Use the search box to look up a train number, railroad, or station. Narrow results to trains or stations with the filter beside the search field.','Try a train number or station name. Select a result to focus the map or open its information.','/map/','Try the map search','Finding what you need'],
['STEP 3 · GO FURTHER','Explore more RailroadRadar tools','Check scheduled service in Timetables, browse community reports, or explore the equipment roster. You can use the map without an account; some contribution and personal features require sign-in.','You can return to this guide anytime from the site menu.','/timetables/','Explore Timetables','Ready to explore']
],
full:[
['STEP 1 · THE BASICS','Start with the Live Map','The Live Map is the main place to see train activity. Move around the map, zoom in on a corridor, and select a train marker to open its information.','Train availability and detail vary by railroad and by the data currently provided.','/map/','Explore the Live Map','Getting oriented'],
['STEP 2 · FIND A TRAIN','Search trains and stations','Use the search box to look up a train number, railroad, or station. Narrow results to trains or stations with the filter beside the search field.','Try a train number or station name. Select a result to focus the map or open its information.','/map/','Try the map search','Finding what you need'],
['STEP 3 · READ TRAIN DETAILS','Open a train marker','Select a train marker to view the information available for that service. Depending on the railroad and feed, details may include route, destination, stops, schedule, and reported equipment.','Scheduled information and live location are different things. A train may appear without a live position.','/map/','View trains on the map','Understanding train details'],
['STEP 4 · CHECK SCHEDULES','Use Timetables','Timetables help you look up scheduled service even when a train is not currently visible on the live map. Check the date and service information when planning.','Schedules can change. Confirm important travel details with the railroad before departure.','/timetables/','Open Timetables','Checking schedules'],
['STEP 5 · COMMUNITY REPORTS','See and submit reports','Recent Reports brings together community-submitted train and equipment information. Reports are contributions from users and may not be independently verified.','Provide clear, relevant details and avoid sharing private or sensitive information.','/specials/','View Recent Reports','Taking part'],
['STEP 6 · EQUIPMENT','Explore the Equipment Roster','Browse equipment associated with participating railroads, including locomotives and other listed units.','Roster coverage varies by railroad and is updated as information becomes available.','/roster/','Browse the Roster','Exploring equipment'],
['STEP 7 · YOUR RIDES','Keep track with MyTrips','MyTrips lets signed-in users record train journeys, keep personal trip history, and optionally share a public profile. Your personal trip log is separate from public train reports.','Review your profile and visibility settings before publishing anything publicly.','/mytrips/','Explore MyTrips','Your personal rail history'],
['STEP 8 · GET HELP','Tell us when something is wrong','If a feature is broken or information looks incorrect, use Report an Issue to contact the RailroadRadar team. Include only the information needed to explain the problem.','RailroadRadar is not an emergency service. If someone is in immediate danger, call 911.','/report-issue/','Report an Issue','Getting help']
]};
var mode='quick',step=0,$=function(id){return document.getElementById(id)};
function render(){var a=data[mode],s=a[step],n=a.length;
$('gs-count').textContent='Step '+(step+1)+' of '+n;$('gs-label').textContent=s[7];
$('gs-fill').style.width=((step+1)/n*100)+'%';$('gs-kicker').textContent=s[0];$('gs-title').textContent=s[1];$('gs-copy').textContent=s[2];$('gs-tip').textContent=s[3];$('gs-link').href=s[4];$('gs-link').innerHTML=s[5]+' <span aria-hidden="true">→</span>';
$('gs-back').disabled=step===0;$('gs-next').textContent=step===n-1?'Finish':'Next';$('gs-dots').textContent='';
for(var i=0;i<n;i++){var d=document.createElement('i');if(i===step)d.className='active';$('gs-dots').appendChild(d)}
$('gs-progress').setAttribute('aria-valuemin','1');$('gs-progress').setAttribute('aria-valuemax',String(n));$('gs-progress').setAttribute('aria-valuenow',String(step+1));
}
document.querySelectorAll('[data-mode]').forEach(function(b){b.addEventListener('click',function(){mode=b.getAttribute('data-mode');step=0;document.querySelectorAll('[data-mode]').forEach(function(x){var on=x===b;x.classList.toggle('is-active',on);x.setAttribute('aria-pressed',on?'true':'false')});render()})});
$('gs-back').addEventListener('click',function(){if(step>0){step--;render()}});
$('gs-next').addEventListener('click',function(){if(step<data[mode].length-1){step++;render()}else location.href='/map/'});
render();
})();