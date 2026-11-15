/* Amtrak locomotive roster search for the Report a Train form.
   Expands the published series into searchable unit numbers and overlays named special-paint units. */
(function(root){
  'use strict';
  var URL='/assets/data/amtrak-locomotives.json?v=20261115b';
  var byKey=Object.create(null),list=[];
  function keys(raw){
    var s=String(raw==null?'':raw).trim().toUpperCase().replace(/[_-]+/g,' ').replace(/\s+/g,' ').trim();
    if(!s)return [];
    var out=[s],compact=s.replace(/\s+/g,'');
    if(out.indexOf(compact)===-1)out.push(compact);
    if(/^\d+$/.test(compact)){var n=String(parseInt(compact,10));if(out.indexOf(n)===-1)out.push(n);}
    return out;
  }
  function add(row){
    if(!row||row.number==null)return;
    var entry={number:String(row.number).trim(),type:String(row.type||'').trim(),paint:String(row.paint||'').trim(),iconUrl:String(row.iconUrl||'').trim(),special:!!row.special};
    if(!entry.number)return;
    var existing=list.find(function(x){return x.number===entry.number;});
    if(existing){Object.assign(existing,entry);return;}
    list.push(entry);
  }
  function index(data){
    byKey=Object.create(null);list=[];
    var specials=Object.create(null);
    (data&&data.specialUnits||[]).forEach(function(s){if(s&&s.id!=null)specials[String(s.id)] = s;});
    (data&&data.series||[]).forEach(function(series){
      var nums=[];
      (series.numbers||[]).forEach(function(n){nums.push(String(n));});
      (series.ranges||[]).forEach(function(range){
        var lo=Number(range[0]),hi=Number(range[1]);
        if(!Number.isFinite(lo)||!Number.isFinite(hi))return;
        for(var n=Math.min(lo,hi);n<=Math.max(lo,hi);n++)nums.push(String(n));
      });
      nums.forEach(function(number){
        var sp=specials[number];
        add({number:number,type:series.model,paint:sp?sp.paint:'',iconUrl:sp?(sp.iconUrl||''):(series.iconUrl||''),special:!!sp});
      });
    });
    Object.keys(specials).forEach(function(number){
      if(byKey[number])return;
      var sp=specials[number];
      add({number:number,type:sp.model,paint:sp.paint||sp.name,iconUrl:sp.iconUrl||'',special:true});
    });
    list.forEach(function(row){keys(row.number).forEach(function(k){if(!byKey[k])byKey[k]=row;});});
  }
  function byNumber(raw){var ks=keys(raw);for(var i=0;i<ks.length;i++)if(byKey[ks[i]])return byKey[ks[i]];return null;}
  function iconFor(raw){var row=byNumber(raw);return row?row.iconUrl:'';}
  function search(query,limit){
    var q=String(query||'').trim().toUpperCase().replace(/[\s_-]+/g,'');
    if(!q)return [];
    var scored=[];
    list.forEach(function(row){
      var n=row.number.toUpperCase().replace(/[\s_-]+/g,''),bare=/^\d+$/.test(n)?String(parseInt(n,10)):'';
      var idx=n.indexOf(q),bi=bare?bare.indexOf(q):-1;
      if(idx<0&&bi<0)return;
      scored.push({row:row,rank:(n===q||bare===q)?0:((idx===0||bi===0)?1:2)});
    });
    scored.sort(function(a,b){return a.rank-b.rank||(Number(a.row.number)-Number(b.row.number))||a.row.number.localeCompare(b.row.number);});
    return scored.slice(0,limit>0?limit:8).map(function(x){return x.row;});
  }
  root.rrAmtrakLocoByNumber=byNumber;
  root.rrAmtrakLocoIconFor=iconFor;
  root.rrAmtrakLocoSearch=search;
  root.rrAmtrakLocoRosterList=function(){return list.slice();};
  root.rrAmtrakLocoRosterReady=typeof fetch==='function'?fetch(URL,{credentials:'same-origin'}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(function(data){index(data);return list;}).catch(function(e){console.warn('[amtrak locomotives] roster load failed',e);return list;}):Promise.resolve(list);
})(typeof window!=='undefined'?window:globalThis);
