// Hand Cricket: a free, dependency-free team game for phones.
// Run:  node hand-cricket.js     (Node 16 or newer, no packages needed)
const http = require('http');
const os = require('os');
const crypto = require('crypto');

const ASSETS = {"app.html":"<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>Hand Cricket</title><link rel=\"stylesheet\" href=\"/style.css\"></head>\n<body>\n<div class=\"wrap\">\n  <header><div><h1>Hand <span>Cricket</span></h1><div class=\"room\" id=\"room\"></div></div><div class=\"timer\" id=\"timer\"></div></header>\n  <main id=\"app\"></main>\n</div>\n<script>\n(function(){\n'use strict';\nvar HOST=location.pathname.replace(/\\/$/,'')==='/host';\nif(HOST)document.body.className='host';\nvar $=function(id){return document.getElementById(id);};\nvar esc=function(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c];});};\nvar store={\n  get:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},\n  set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}},\n  del:function(k){try{localStorage.removeItem(k);}catch(e){}}\n};\nvar S=null,code=null,pid=null,es=null,clockOff=0,info={urls:[]};\nvar draft={bat:[],bowl:[]},draftInnings=0,overs=2,joinMsg='',sent={};\nvar tn=function(t){return t===0?'Team A':'Team B';};\nvar tc=function(t){return t===0?'ta':'tb';};\nvar P=function(id){return S.players.filter(function(p){return p.id===id;})[0];};\nvar nm=function(id){var p=P(id);return p?esc(p.name):'Someone';};\nvar ovr=function(b){return Math.floor(b/6)+'.'+(b%6);};\nvar plural=function(n,w){return n+' '+w+(n===1?'':'s');};\n\nasync function post(path,body){\n  try{\n    var r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});\n    return await r.json();\n  }catch(e){return {error:'network'};}\n}\nfunction doAct(type,extra){\n  return post('/api/act',Object.assign({code:code,pid:pid,host:HOST,type:type},extra||{}));\n}\n\n/* ---------- connection ---------- */\nfunction connect(){\n  if(es)es.close();\n  var url='/api/events?code='+code+(HOST?'&role=host':'&pid='+pid);\n  es=new EventSource(url);\n  es.onmessage=function(e){S=JSON.parse(e.data);clockOff=S.now-Date.now();render();};\n  es.addEventListener('gone',function(){es.close();gone();});\n}\nasync function gone(){\n  S=null;\n  if(HOST){try{sessionStorage.removeItem('hcHost');}catch(e){}boot();return;}\n  store.del('hcCode');store.del('hcPid');code=pid=null;\n  joinMsg='That game has ended. Join a new one.';showJoin();\n}\nasync function boot(){\n  try{info=await (await fetch('/api/info')).json();}catch(e){}\n  if(HOST){\n    try{code=sessionStorage.getItem('hcHost');}catch(e){}\n    if(!code){var r=await post('/api/create',{});code=r.code;try{sessionStorage.setItem('hcHost',code);}catch(e){}}\n    connect();return;\n  }\n  code=store.get('hcCode');pid=store.get('hcPid');\n  if(code&&pid)connect();else showJoin();\n}\nfunction showJoin(){\n  $('room').textContent='';$('timer').textContent='';\n  var qs=new URLSearchParams(location.search).get('room')||'';\n  $('app').innerHTML='<div class=\"card\"><h2>Join a game</h2><input id=\"rc\" placeholder=\"ROOM CODE\" maxlength=\"4\" autocapitalize=\"characters\" autocomplete=\"off\" value=\"'+esc(qs.toUpperCase())+'\"><input id=\"nm\" placeholder=\"Your name\" maxlength=\"16\" autocomplete=\"off\"><div class=\"err\" id=\"err\">'+esc(joinMsg)+'</div><button id=\"jn\">Join</button></div>';\n  var go=async function(){\n    var c=$('rc').value.trim().toUpperCase(),n=$('nm').value.trim();\n    var r=await post('/api/join',{code:c,name:n});\n    if(r.error){$('err').textContent=({no_room:'Room not found',name_taken:'That name is taken',bad_name:'Enter a name',full:'Room is full',started:'That game has already started',network:'Network error'})[r.error]||r.error;return;}\n    code=c;pid=r.pid;store.set('hcCode',code);store.set('hcPid',pid);joinMsg='';connect();\n  };\n  $('jn').onclick=go;\n  $('nm').onkeydown=function(e){if(e.key==='Enter')go();};\n}\n\nsetInterval(function(){\n  var t=$('timer');\n  if(S&&S.deadline){t.textContent=Math.max(0,Math.ceil((S.deadline-(Date.now()+clockOff))/1000));}\n  else t.textContent='';\n},200);\n\n/* ---------- pieces ---------- */\nfunction pad(act,selected,locked){\n  var h='<div class=\"pad\">';\n  for(var i=0;i<=10;i++)h+='<button class=\"'+(selected===i?'sel':'')+'\" data-act=\"'+act+'\" data-n=\"'+i+'\"'+(locked?' disabled':'')+'>'+i+'</button>';\n  return h+'</div>';\n}\nfunction scoreCard(){\n  var p=S.play;if(!p)return '';\n  var h='<div class=\"score '+tc(p.battingTeam)+'\"><div class=\"tn\">'+tn(p.battingTeam)+' batting · innings '+S.innings+'</div><div class=\"rs\">'+p.runs+'/'+p.wkts+'</div><div class=\"ov\">'+ovr(p.balls)+' of '+S.overs+' overs</div>';\n  if(p.target){\n    var left=S.overs*6-p.balls,need=p.target-p.runs;\n    h+='<div class=\"need\">Target '+p.target+(need>0?' · need '+need+' from '+plural(left,'ball'):' · target reached')+'</div>';\n  }\n  var f=p.results&&p.results[1];\n  if(f&&S.innings===2)h+='<div class=\"first\">'+tn(f.team)+' scored '+f.runs+'/'+f.wkts+'</div>';\n  return h+'</div>';\n}\nfunction teamCol(t){\n  var mem=S.players.filter(function(p){return p.team===t;});\n  var me=S.me;\n  var h='<div class=\"team '+tc(t)+'\"><h3>'+tn(t)+'</h3><ul>'+(mem.length?mem.map(function(p){return '<li>'+esc(p.name)+(p.captain?'<i>captain</i>':'')+(me&&p.id===me.id?' (you)':'')+'</li>';}).join(''):'<li class=\"mut\">No players yet</li>')+'</ul>';\n  if(me&&!HOST)h+=(me.team===t?'<p class=\"mut\" style=\"margin:0\">You are in this team.</p>':'<button data-act=\"team\" data-t=\"'+t+'\">'+(me.team===null?'Join '+tn(t):'Switch to '+tn(t))+'</button>');\n  return h+'</div>';\n}\nfunction lockChip(label,ok){return '<span class=\"chip'+(ok?' on':'')+'\">'+label+(ok?' ✓':' …')+'</span>';}\n\n/* ---------- screens ---------- */\nfunction lobby(){\n  var h='';\n  if(HOST){\n    var u=location.host;\n    var local=/^(localhost|127\\.)/.test(location.hostname);\n    var addr=(local&&info.urls[0]?info.urls[0].replace(/^https?:\\/\\//,''):u);\n    h+='<div class=\"card center\"><div class=\"mut\">On your phone open</div><div class=\"big\">'+esc(addr)+'</div><div class=\"mut\">and enter the room code</div><div class=\"code\">'+esc(S.code)+'</div></div>';\n  }\n  h+='<div class=\"teams\">'+teamCol(0)+teamCol(1)+'</div>';\n  var un=S.players.filter(function(p){return p.team===null;});\n  if(un.length)h+='<div class=\"card\" style=\"margin-top:12px\"><div class=\"mut\">Choosing a team</div>'+un.map(function(p){return esc(p.name);}).join(', ')+'</div>';\n  h+='<div class=\"card\" style=\"margin-top:12px\"><p class=\"mut\" style=\"margin:0\">The first player to join a team is its captain. Captains do the toss and choose the batting and bowling order.</p></div>';\n  if(HOST||(S.me&&S.me.isVip)){\n    var ok=!un.length&&S.players.some(function(p){return p.team===0;})&&S.players.some(function(p){return p.team===1;});\n    h+='<div class=\"card\"><label class=\"mut\" for=\"ov\">Overs per innings (6 balls each)</label><select id=\"ov\">'+[1,2,3,4,5].map(function(n){return '<option'+(n===overs?' selected':'')+'>'+n+'</option>';}).join('')+'</select><button data-act=\"start\"'+(ok?'':' disabled')+'>Start match</button><p class=\"mut\" style=\"margin:8px 0 0\">'+(ok?'Ready when you are.':'Everyone needs a team, and both teams need at least one player.')+'</p></div>';\n  }else if(S.me){\n    h+='<div class=\"card center mut\">Waiting for the host to start the match…</div>';\n  }\n  return h;\n}\n\nfunction tossCall(){\n  var t=S.toss,cap=null;\n  S.players.forEach(function(p){if(p.team===t.callerTeam&&p.captain)cap=p;});\n  var h='<div class=\"card\"><h2>Toss</h2><p>Each captain picks a number from 0 to 10. If the total matches the call, the calling team wins the toss and bats first.</p><p><b class=\"tcol '+tc(t.callerTeam)+'\">'+tn(t.callerTeam)+'</b> captain <b>'+(cap?esc(cap.name):'')+'</b> makes the call.</p></div>';\n  if(S.me&&S.me.isCaptain&&S.me.team===t.callerTeam){\n    h+='<div class=\"card\"><h3>Your call</h3><div class=\"row2\"><button data-act=\"call\" data-c=\"odd\">Odd</button><button data-act=\"call\" data-c=\"even\">Even</button></div></div>';\n  }\n  return h;\n}\nfunction tossNum(){\n  var t=S.toss,other=1-t.callerTeam;\n  var h='<div class=\"card\"><h2>Toss</h2><p><b class=\"tcol '+tc(t.callerTeam)+'\">'+tn(t.callerTeam)+'</b> called <b>'+t.choice.toUpperCase()+'</b>. <b class=\"tcol '+tc(other)+'\">'+tn(other)+'</b> has <b>'+(t.choice==='odd'?'EVEN':'ODD')+'</b>.</p><div class=\"chips\">'+lockChip(tn(0)+' captain',t.locked[0])+lockChip(tn(1)+' captain',t.locked[1])+'</div></div>';\n  if(S.me&&S.me.isCaptain){\n    var mine=S.me.pick;\n    h+='<div class=\"card\"><h3>'+(mine===null?'Pick a number (no pick means 0)':'Locked in: '+mine)+'</h3>'+pad('tosspick',mine,mine!==null)+'</div>';\n  }\n  return h;\n}\nfunction tossResult(){\n  var t=S.toss,par=t.sum%2===1?'odd':'even';\n  return '<div class=\"card center\"><h2>Toss result</h2><div class=\"big\">'+t.picks[0]+' + '+t.picks[1]+' = '+t.sum+'</div><p class=\"mut\">That is '+par+'.</p><div class=\"big tcol '+tc(t.winnerTeam)+'\">'+tn(t.winnerTeam)+' wins the toss</div><p class=\"mut\" style=\"margin-top:8px\">They bat first.</p></div>';\n}\n\nfunction resetDraft(){\n  if(draftInnings!==S.innings){draft={bat:[],bowl:[]};draftInnings=S.innings;}\n}\nfunction builder(kind,team){\n  var mem=S.players.filter(function(p){return p.team===team;});\n  var d=draft[kind];\n  var saved=kind==='bat'?S.play.orderBat:S.play.orderBowl;\n  if(!d.length&&saved&&saved.length)d=draft[kind]=saved.slice();\n  var done=S.play.confirmed[kind];\n  var title=kind==='bat'?'Set your batting order':'Set your bowling order (one bowler per over)';\n  var h='<div class=\"card\"><h3>'+title+'</h3><p class=\"mut\">Tap players in the order you want. Tap again to remove.</p><div class=\"chips\">';\n  mem.forEach(function(p){\n    var i=d.indexOf(p.id);\n    h+='<button class=\"chip'+(i>=0?' on':'')+'\" data-act=\"dr\" data-k=\"'+kind+'\" data-id=\"'+p.id+'\">'+(i>=0?'<b>'+(i+1)+'</b>':'')+esc(p.name)+'</button>';\n  });\n  h+='</div><div class=\"row2\"><button class=\"alt\" data-act=\"dr-auto\" data-k=\"'+kind+'\">Use join order</button><button data-act=\"dr-ok\" data-k=\"'+kind+'\"'+(d.length===mem.length?'':' disabled')+'>'+(done?'Update order':'Confirm')+'</button></div>'+(done?'<p class=\"ok\" style=\"margin:8px 0 0;color:var(--ok)\">Order confirmed. You can still change it.</p>':'')+'</div>';\n  return h;\n}\nfunction lineup(){\n  resetDraft();\n  var p=S.play,me=S.me;\n  var h='';\n  if(S.innings===2)h+=scoreCard().replace(/<div class=\"rs\">[^<]*<\\/div>/,'<div class=\"rs\">0/0</div>');\n  h+='<div class=\"card\"><h2>Innings '+S.innings+'</h2><p><b class=\"tcol '+tc(p.battingTeam)+'\">'+tn(p.battingTeam)+'</b> bats, <b class=\"tcol '+tc(p.bowlingTeam)+'\">'+tn(p.bowlingTeam)+'</b> bowls.'+(p.target?' Target: <b>'+p.target+'</b>.':'')+'</p><div class=\"chips\">'+lockChip('Batting order',p.confirmed.bat)+lockChip('Bowling order',p.confirmed.bowl)+'</div><p class=\"mut\" style=\"margin:0\">Captains set their order. Unset orders use join order when the timer ends.</p></div>';\n  if(me&&me.isCaptain){\n    if(me.team===p.battingTeam)h+=builder('bat',p.battingTeam);\n    else if(me.team===p.bowlingTeam)h+=builder('bowl',p.bowlingTeam);\n  }\n  return h;\n}\n\nfunction pitch(showNums){\n  var p=S.play,me=S.me,lb=p.lastBall;\n  var iAmBat=me&&me.id===p.curBatter,iAmBowl=me&&me.id===p.curBowler;\n  function side(role,id,mine,locked,num){\n    return '<div class=\"side'+(mine?' me':'')+'\"><div class=\"role\">'+role+'</div><div class=\"who\">'+nm(id)+(mine?' (you)':'')+'</div>'+(showNums?'<div class=\"num\">'+num+'</div>':'<div class=\"st'+(locked?' ok':'')+'\">'+(locked?'Locked in ✓':'Choosing…')+'</div>')+'</div>';\n  }\n  if(showNums)return '<div class=\"vs\">'+side('Batter',lb.batter,iAmBat,true,lb.b)+side('Bowler',lb.bowler,iAmBowl,true,lb.w)+'</div>';\n  return '<div class=\"vs\">'+side('Batter',p.curBatter,iAmBat,p.batLocked)+side('Bowler',p.curBowler,iAmBowl,p.bowlLocked)+'</div>';\n}\nfunction logCard(){\n  var l=S.play.log;if(!l.length)return '';\n  return '<div class=\"card\"><h3>Recent balls</h3><ul class=\"log\">'+l.map(function(x){\n    return '<li><span>'+x.label+' · '+nm(x.batter)+' '+x.b+' vs '+nm(x.bowler)+' '+x.w+'</span>'+(x.out?'<span class=\"o\">OUT</span>':'<span class=\"r\">+'+x.runs+'</span>')+'</li>';\n  }).join('')+'</ul></div>';\n}\nfunction ball(){\n  var p=S.play,me=S.me;\n  var h=scoreCard()+pitch(false);\n  var role=me&&me.id===p.curBatter?'bat':me&&me.id===p.curBowler?'bowl':null;\n  if(role){\n    var mine=me.pick;\n    h+='<div class=\"card\"><h3>You are '+(role==='bat'?'BATTING':'BOWLING')+'. '+(mine===null?'Pick 0 to 10 (no pick means 0)':'Locked in: '+mine)+'</h3>'+pad('ball',mine,mine!==null)+'</div>';\n  }else{\n    h+='<div class=\"card center mut\">'+nm(p.curBatter)+' is batting against '+nm(p.curBowler)+'.</div>';\n  }\n  return h+logCard();\n}\nfunction result(){\n  var lb=S.play.lastBall;\n  var h=scoreCard()+pitch(true);\n  h+='<div class=\"verdict '+(lb.out?'out':'runs')+'\">'+(lb.out?'OUT!':'+'+lb.runs+(lb.runs===1?' run':' runs'))+'</div>';\n  if(!lb.out&&lb.b===0&&lb.w>0)h+='<p class=\"center mut\">Batter played 0, so the bowler\\'s '+lb.w+' counts as runs.</p>';\n  if(lb.timedOut.bat||lb.timedOut.bowl)h+='<p class=\"center mut\">'+(lb.timedOut.bat?'The batter':'')+(lb.timedOut.bat&&lb.timedOut.bowl?' and ':'')+(lb.timedOut.bowl?'the bowler':'')+' ran out of time and played 0.</p>';\n  return h+logCard();\n}\nfunction brk(){\n  var r=S.play.results[1];\n  return '<div class=\"card center\"><h2>Innings over</h2><div class=\"big tcol '+tc(r.team)+'\">'+tn(r.team)+' '+r.runs+'/'+r.wkts+'</div><p class=\"mut\">in '+ovr(r.balls)+' overs</p><div class=\"big\">Target: '+S.play.target+'</div><p class=\"mut\">'+tn(1-r.team)+' now bats.</p></div>';\n}\nfunction final(){\n  var f=S.final,r=S.play.results,h='<div class=\"card center\"><div class=\"mut\">Match result</div>';\n  if(f.winner===null)h+='<div class=\"big\">Match tied</div>';\n  else h+='<div class=\"big tcol '+tc(f.winner)+'\">'+tn(f.winner)+' '+f.text+'</div>';\n  h+='</div><div class=\"teams\">';\n  [1,2].forEach(function(i){var x=r[i];if(x)h+='<div class=\"team '+tc(x.team)+'\"><h3>'+tn(x.team)+'</h3><div class=\"big\">'+x.runs+'/'+x.wkts+'</div><div class=\"mut\">'+ovr(x.balls)+' overs</div></div>';});\n  h+='</div>';\n  if(HOST||(S.me&&S.me.isVip))h+='<div class=\"card\" style=\"margin-top:12px\"><button data-act=\"restart\">Play again</button></div>';\n  return h;\n}\n\nfunction render(){\n  if(!S)return;\n  $('room').textContent='Room '+S.code;\n  var h='';\n  switch(S.phase){\n    case 'lobby':h=lobby();break;\n    case 'toss_call':h=tossCall();break;\n    case 'toss_num':h=tossNum();break;\n    case 'toss_result':h=tossResult();break;\n    case 'lineup':h=lineup();break;\n    case 'ball':h=ball();break;\n    case 'result':h=result();break;\n    case 'break':h=brk();break;\n    case 'final':h=final();break;\n  }\n  $('app').innerHTML=h;\n  var ov=$('ov');if(ov)ov.onchange=function(){overs=+ov.value;};\n}\n\n/* ---------- clicks ---------- */\ndocument.addEventListener('click',async function(e){\n  var b=e.target.closest&&e.target.closest('[data-act]');\n  if(!b||b.disabled)return;\n  var a=b.dataset.act,k=b.dataset.k;\n  if(a==='team')await doAct('team',{team:+b.dataset.t});\n  else if(a==='start')await doAct('start',{overs:overs});\n  else if(a==='call')await doAct('call',{choice:b.dataset.c});\n  else if(a==='tosspick'){S.me.pick=+b.dataset.n;render();await doAct('tosspick',{n:+b.dataset.n});}\n  else if(a==='ball'){S.me.pick=+b.dataset.n;render();await doAct('ball',{n:+b.dataset.n});}\n  else if(a==='dr'){\n    var d=draft[k],i=d.indexOf(b.dataset.id);\n    if(i>=0)d.splice(i,1);else d.push(b.dataset.id);\n    render();\n  }else if(a==='dr-auto'){\n    var team=k==='bat'?S.play.battingTeam:S.play.bowlingTeam;\n    draft[k]=S.players.filter(function(p){return p.team===team;}).map(function(p){return p.id;});\n    render();\n  }else if(a==='dr-ok'){\n    await doAct('order',{kind:k,order:draft[k]});\n  }else if(a==='restart')await doAct('restart');\n});\n\nboot();\n})();\n</script></body></html>\n","style.css":":root{--bg:#0d1b16;--surface:#15291f;--surface2:#1d372a;--ink:#eef6ef;--mute:#92ad9d;--line:#2a4a39;--lime:#c9f26a;--lime-ink:#10200a;--ta:#ff9a3c;--tb:#46b3ff;--bad:#ff6b6b;--ok:#6be3a0}\n*{box-sizing:border-box}\nhtml,body{margin:0}\nbody{background:var(--bg);color:var(--ink);font-family:system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;line-height:1.45;min-height:100vh}\n.wrap{max-width:640px;margin:0 auto;padding:14px 16px 48px}\n.host .wrap{max-width:1000px}\nheader{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}\nh1{margin:0;font-size:1.25rem;letter-spacing:.02em}\nh1 span{color:var(--lime)}\n.room{color:var(--mute);font-size:.8rem;text-transform:uppercase;letter-spacing:.1em}\n.timer{font-size:2rem;font-weight:800;color:var(--lime);font-variant-numeric:tabular-nums;min-width:1.6ch;text-align:right}\nh2{margin:0 0 8px;font-size:1.3rem;line-height:1.2}\nh3{margin:0 0 6px;font-size:1rem}\np{margin:0 0 10px}\n.mut{color:var(--mute)}\n.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:12px;min-width:0}\n.ta{--tc:var(--ta)}\n.tb{--tc:var(--tb)}\n.tcol{color:var(--tc)}\n.code{font-size:clamp(3.5rem,14vw,7rem);font-weight:900;letter-spacing:.14em;color:var(--lime);text-align:center;line-height:1.1}\n.center{text-align:center}\ninput,select{width:100%;font:inherit;color:#111;background:#fff;border:0;border-radius:12px;padding:13px 14px;margin-bottom:10px}\nbutton{font:inherit;font-weight:700;border:0;border-radius:12px;padding:13px 16px;cursor:pointer;width:100%;background:var(--lime);color:var(--lime-ink);margin-top:4px}\nbutton.alt{background:var(--surface2);color:var(--ink)}\nbutton:disabled{opacity:.45;cursor:default}\nbutton:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--lime);outline-offset:2px}\n.err{color:var(--bad);min-height:1.2em;margin:0 0 6px;font-size:.9rem}\n.teams{display:grid;grid-template-columns:1fr 1fr;gap:12px}\n.team{background:var(--surface);border:2px solid var(--tc);border-radius:14px;padding:14px;min-width:0}\n.team h3{color:var(--tc)}\n.team ul{list-style:none;margin:0 0 8px;padding:0}\n.team li{padding:5px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere}\n.team li:last-child{border-bottom:0}\n.team li i{font-style:normal;font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;background:var(--tc);color:#111;border-radius:6px;padding:1px 6px;margin-left:6px;font-weight:800}\n.team button{background:var(--tc);color:#111}\n.score{background:var(--surface);border:2px solid var(--tc);border-radius:14px;padding:14px 16px;margin-bottom:12px}\n.score .tn{color:var(--tc);font-weight:800;text-transform:uppercase;letter-spacing:.08em;font-size:.8rem}\n.score .rs{font-size:3rem;font-weight:900;line-height:1.05;font-variant-numeric:tabular-nums}\n.score .ov{color:var(--mute)}\n.score .need{margin-top:6px;font-weight:700;color:var(--lime)}\n.score .first{margin-top:4px;color:var(--mute);font-size:.9rem}\n.vs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}\n.side{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px;text-align:center;min-width:0}\n.side.me{border-color:var(--lime)}\n.side .role{color:var(--mute);font-size:.75rem;text-transform:uppercase;letter-spacing:.1em}\n.side .who{font-weight:800;font-size:1.15rem;overflow-wrap:anywhere}\n.side .st{font-size:.85rem;margin-top:4px;color:var(--mute)}\n.side .st.ok{color:var(--ok);font-weight:700}\n.side .num{font-size:3.6rem;font-weight:900;line-height:1.1;color:var(--lime)}\n.verdict{text-align:center;font-size:2rem;font-weight:900;margin:4px 0 6px}\n.verdict.out{color:var(--bad)}\n.verdict.runs{color:var(--ok)}\n.pad{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}\n.pad button{margin:0;padding:18px 0;font-size:1.6rem;background:var(--surface2);color:var(--ink);border:2px solid var(--line)}\n.pad button.sel{background:var(--lime);color:var(--lime-ink);border-color:var(--lime)}\n.pad button:disabled{opacity:.5}\n.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}\n.chip{display:inline-flex;align-items:center;gap:8px;background:var(--surface2);border:2px solid var(--line);border-radius:999px;padding:8px 14px;font:inherit;font-weight:700;color:var(--ink);width:auto;margin:0}\n.chip b{display:inline-flex;align-items:center;justify-content:center;min-width:1.5em;height:1.5em;border-radius:50%;background:var(--lime);color:var(--lime-ink);font-size:.85rem}\n.chip.on{border-color:var(--lime)}\n.log{list-style:none;margin:0;padding:0;font-size:.9rem}\n.log li{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid var(--line)}\n.log li:last-child{border-bottom:0}\n.log .o{color:var(--bad);font-weight:800}\n.log .r{color:var(--ok);font-weight:800}\n.big{font-size:2.2rem;font-weight:900;line-height:1.15;overflow-wrap:anywhere}\n.row2{display:flex;gap:10px}\n.row2>*{flex:1}\n@media (max-width:420px){.teams{grid-template-columns:1fr}.pad{gap:8px}}\n@media (prefers-reduced-motion:no-preference){button{transition:transform .08s}button:active:not(:disabled){transform:scale(.97)}}\n"};
const PORT = +process.env.PORT || 3000;
const K = +process.env.SPEED_SCALE || 1;            // only used for fast testing
const BALL_MS = 5000 * K, GRACE_MS = 700 * K, RESULT_MS = 3500 * K;
const TOSS_CALL_MS = 15000 * K, TOSS_NUM_MS = 5000 * K, TOSS_SHOW_MS = 5000 * K;
const LINEUP_MS = 60000 * K, BREAK_MS = 5000 * K;
const BALLS_PER_OVER = 6, MAX_PLAYERS = 12, MAX_NUM = 10;
const rooms = new Map();

const rnd = n => Math.random() * n | 0;
const validNum = n => Number.isInteger(n) && n >= 0 && n <= MAX_NUM;

function makeCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => L[rnd(L.length)]).join(''); } while (rooms.has(c));
  return c;
}

function createRoom() {
  const r = {
    code: makeCode(), phase: 'lobby', players: new Map(), clients: new Set(), vipId: null,
    overs: 2, innings: 0, toss: null, battingTeam: null, bowlingTeam: null,
    score: { runs: 0, wkts: 0, balls: 0 }, target: null, results: {}, log: [], lastBall: null,
    orderBat: null, orderBowl: null, confirmed: { bat: false, bowl: false },
    cur: { batter: null, bowler: null }, picks: { bat: null, bowl: null },
    final: null, deadline: 0, timer: null, last: Date.now()
  };
  rooms.set(r.code, r);
  return r;
}

const membersOf = (r, t) => [...r.players.values()].filter(p => p.team === t).sort((a, b) => a.teamAt - b.teamAt);
const capOf = (r, t) => { const m = membersOf(r, t); return m.length ? m[0].id : null; };

function schedule(r, ms, fn) {
  clearTimeout(r.timer);
  r.deadline = Date.now() + ms;
  r.timer = setTimeout(() => { try { fn(r); } catch (e) { console.error(e); } }, ms);
}

// ---------- state sent to clients (never includes hidden picks) ----------
function view(r, pid) {
  const caps = [capOf(r, 0), capOf(r, 1)];
  const v = {
    code: r.code, phase: r.phase, overs: r.overs, innings: r.innings, deadline: r.deadline, now: Date.now(),
    players: [...r.players.values()].sort((a, b) => (a.teamAt || a.at) - (b.teamAt || b.at)).map(p => ({
      id: p.id, name: p.name, team: p.team, connected: p.conns > 0,
      captain: p.team !== null && caps[p.team] === p.id
    }))
  };
  const me = pid && r.players.get(pid);
  if (me) {
    v.me = { id: me.id, name: me.name, team: me.team, isVip: r.vipId === me.id, isCaptain: me.team !== null && caps[me.team] === me.id, pick: null };
  }
  if (r.toss) {
    const t = r.toss, reveal = r.phase === 'toss_result';
    v.toss = {
      callerTeam: t.callerTeam, choice: t.choice, locked: [t.picks[0] !== null, t.picks[1] !== null],
      picks: reveal ? t.picks : null, sum: reveal ? t.sum : null, winnerTeam: reveal ? t.winnerTeam : null
    };
    if (me && me.team !== null && v.me.isCaptain && r.phase === 'toss_num') v.me.pick = t.picks[me.team];
  }
  if (r.innings >= 1) {
    const inLineup = r.phase === 'lineup';
    const own = team => me && v.me.isCaptain && me.team === team;
    v.play = {
      battingTeam: r.battingTeam, bowlingTeam: r.bowlingTeam, runs: r.score.runs, wkts: r.score.wkts, balls: r.score.balls,
      target: r.target, curBatter: r.cur.batter, curBowler: r.cur.bowler, lastBall: r.lastBall, log: r.log.slice(0, 8),
      results: r.results, confirmed: r.confirmed,
      batLocked: r.picks.bat !== null, bowlLocked: r.picks.bowl !== null,
      orderBat: (!inLineup || own(r.battingTeam)) ? r.orderBat : null,
      orderBowl: (!inLineup || own(r.bowlingTeam)) ? r.orderBowl : null
    };
    if (me && r.phase === 'ball') {
      if (me.id === r.cur.batter) v.me.pick = r.picks.bat;
      else if (me.id === r.cur.bowler) v.me.pick = r.picks.bowl;
    }
  }
  if (r.phase === 'final') v.final = r.final;
  return v;
}

function broadcast(r) {
  for (const c of r.clients) c.res.write('data: ' + JSON.stringify(view(r, c.pid)) + '\n\n');
}

// ---------- toss ----------
function startMatch(r, overs) {
  r.overs = overs; r.innings = 0; r.results = {}; r.target = null; r.final = null;
  r.log = []; r.lastBall = null; r.battingTeam = r.bowlingTeam = null;
  r.toss = { callerTeam: rnd(2), choice: null, picks: [null, null], sum: null, winnerTeam: null };
  r.phase = 'toss_call';
  schedule(r, TOSS_CALL_MS, rr => setCall(rr, Math.random() < 0.5 ? 'odd' : 'even'));
  broadcast(r);
}

function setCall(r, choice) {
  if (r.phase !== 'toss_call') return;
  r.toss.choice = choice;
  r.phase = 'toss_num';
  schedule(r, TOSS_NUM_MS + GRACE_MS, resolveToss);
  r.deadline = Date.now() + TOSS_NUM_MS;
  broadcast(r);
}

function resolveToss(r) {
  if (r.phase !== 'toss_num') return;
  const t = r.toss;
  t.picks = t.picks.map(p => (p === null ? 0 : p));
  t.sum = t.picks[0] + t.picks[1];
  const parity = t.sum % 2 === 1 ? 'odd' : 'even';
  t.winnerTeam = parity === t.choice ? t.callerTeam : 1 - t.callerTeam;
  r.phase = 'toss_result';
  schedule(r, TOSS_SHOW_MS, rr => beginInnings(rr, rr.toss.winnerTeam));
  broadcast(r);
}

// ---------- innings ----------
function beginInnings(r, battingTeam) {
  r.innings++;
  r.battingTeam = battingTeam; r.bowlingTeam = 1 - battingTeam;
  r.score = { runs: 0, wkts: 0, balls: 0 };
  r.log = []; r.lastBall = null;
  r.orderBat = r.orderBowl = null;
  r.confirmed = { bat: false, bowl: false };
  r.cur = { batter: null, bowler: null };
  r.phase = 'lineup';
  schedule(r, LINEUP_MS, finishLineup);
  broadcast(r);
}

function finishLineup(r) {
  if (r.phase !== 'lineup') return;
  if (!r.orderBat) r.orderBat = membersOf(r, r.battingTeam).map(p => p.id);
  if (!r.orderBowl) r.orderBowl = membersOf(r, r.bowlingTeam).map(p => p.id);
  r.confirmed = { bat: true, bowl: true };
  startBall(r);
}

function startBall(r) {
  const s = r.score;
  r.cur = {
    batter: r.orderBat[s.wkts],
    bowler: r.orderBowl[Math.floor(s.balls / BALLS_PER_OVER) % r.orderBowl.length]
  };
  r.picks = { bat: null, bowl: null };
  r.phase = 'ball';
  schedule(r, BALL_MS + GRACE_MS, resolveBall);
  r.deadline = Date.now() + BALL_MS;
  broadcast(r);
}

function resolveBall(r) {
  if (r.phase !== 'ball') return;
  const b = r.picks.bat === null ? 0 : r.picks.bat;
  const w = r.picks.bowl === null ? 0 : r.picks.bowl;
  const out = b === w;
  const runs = out ? 0 : (b === 0 ? w : b);       // batter 0 and bowler not 0: the bowler's number is scored
  const s = r.score;
  const over = Math.floor(s.balls / BALLS_PER_OVER), ball = s.balls % BALLS_PER_OVER + 1;
  s.balls++;
  if (out) s.wkts++; else s.runs += runs;
  r.lastBall = {
    over, ball, batter: r.cur.batter, bowler: r.cur.bowler, b, w, out, runs,
    timedOut: { bat: r.picks.bat === null, bowl: r.picks.bowl === null }
  };
  r.log.unshift({ label: over + '.' + ball, batter: r.cur.batter, bowler: r.cur.bowler, b, w, out, runs });
  r.phase = 'result';
  schedule(r, RESULT_MS, afterBall);
  r.deadline = 0;
  broadcast(r);
}

function afterBall(r) {
  if (r.phase !== 'result') return;
  const s = r.score, size = membersOf(r, r.battingTeam).length;
  const over = s.wkts >= size || s.balls >= r.overs * BALLS_PER_OVER || (r.innings === 2 && s.runs >= r.target);
  if (over) endInnings(r); else startBall(r);
}

function endInnings(r) {
  const s = r.score;
  r.results[r.innings] = { team: r.battingTeam, runs: s.runs, wkts: s.wkts, balls: s.balls };
  if (r.innings === 1) {
    r.target = s.runs + 1;
    r.phase = 'break';
    schedule(r, BREAK_MS, rr => beginInnings(rr, 1 - rr.battingTeam));
    return broadcast(r);
  }
  const first = r.results[1], second = r.results[2];
  const size = membersOf(r, second.team).length;
  let winner, text;
  if (second.runs >= r.target) { winner = second.team; const left = size - second.wkts; text = 'won by ' + left + ' wicket' + (left === 1 ? '' : 's'); }
  else if (second.runs === first.runs) { winner = null; text = 'Match tied'; }
  else { winner = first.team; const d = first.runs - second.runs; text = 'won by ' + d + ' run' + (d === 1 ? '' : 's'); }
  r.final = { winner, text };
  r.phase = 'final'; r.deadline = 0; clearTimeout(r.timer);
  broadcast(r);
}

// ---------- HTTP ----------
const STATIC = {
  '/': ['app.html', 'text/html; charset=utf-8'], '/host': ['app.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8']
};

function json(res, obj, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 10000) req.destroy(); });
    req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch (e) { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function lanUrls() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) out.push('http://' + i.address + ':' + PORT);
  return out;
}

const isAuthed = (r, b) => b.host === true || (b.pid && r.vipId === b.pid);

function act(r, b) {
  const p = r.players.get(b.pid);
  switch (b.type) {
    case 'team': {
      if (r.phase !== 'lobby' || !p) return { error: 'bad_phase' };
      if (b.team !== 0 && b.team !== 1) return { error: 'bad_team' };
      p.team = b.team; p.teamAt = Date.now();
      broadcast(r); return { ok: true };
    }
    case 'start': {
      if (!isAuthed(r, b)) return { error: 'not_allowed' };
      if (r.phase !== 'lobby') return { error: 'bad_phase' };
      const all = [...r.players.values()];
      if (all.some(x => x.team === null)) return { error: 'unassigned' };
      if (!membersOf(r, 0).length || !membersOf(r, 1).length) return { error: 'need_both_teams' };
      startMatch(r, Math.max(1, Math.min(+b.overs || 2, 5)));
      return { ok: true };
    }
    case 'call': {
      if (r.phase !== 'toss_call' || !p || p.id !== capOf(r, r.toss.callerTeam)) return { error: 'not_allowed' };
      if (b.choice !== 'odd' && b.choice !== 'even') return { error: 'bad_choice' };
      setCall(r, b.choice); return { ok: true };
    }
    case 'tosspick': {
      if (r.phase !== 'toss_num' || !p || p.team === null || p.id !== capOf(r, p.team)) return { error: 'not_allowed' };
      if (!validNum(b.n) || r.toss.picks[p.team] !== null) return { error: 'bad_pick' };
      r.toss.picks[p.team] = b.n;
      if (r.toss.picks[0] !== null && r.toss.picks[1] !== null) resolveToss(r); else broadcast(r);
      return { ok: true };
    }
    case 'order': {
      if (r.phase !== 'lineup' || !p) return { error: 'bad_phase' };
      const kind = b.kind;
      if (kind !== 'bat' && kind !== 'bowl') return { error: 'bad_kind' };
      const team = kind === 'bat' ? r.battingTeam : r.bowlingTeam;
      if (p.team !== team || p.id !== capOf(r, team)) return { error: 'not_allowed' };
      const ids = membersOf(r, team).map(m => m.id);
      const order = Array.isArray(b.order) ? b.order : [];
      if (order.length !== ids.length || !ids.every(i => order.includes(i)) || new Set(order).size !== order.length) return { error: 'bad_order' };
      if (kind === 'bat') { r.orderBat = order; r.confirmed.bat = true; } else { r.orderBowl = order; r.confirmed.bowl = true; }
      if (r.confirmed.bat && r.confirmed.bowl) startBall(r); else broadcast(r);
      return { ok: true };
    }
    case 'ball': {
      if (r.phase !== 'ball' || !p) return { error: 'bad_phase' };
      if (!validNum(b.n)) return { error: 'bad_pick' };
      const slot = p.id === r.cur.batter ? 'bat' : p.id === r.cur.bowler ? 'bowl' : null;
      if (!slot || r.picks[slot] !== null) return { error: 'not_allowed' };
      r.picks[slot] = b.n;
      if (r.picks.bat !== null && r.picks.bowl !== null) resolveBall(r); else broadcast(r);
      return { ok: true };
    }
    case 'restart': {
      if (!isAuthed(r, b)) return { error: 'not_allowed' };
      if (r.phase !== 'final') return { error: 'bad_phase' };
      clearTimeout(r.timer);
      r.phase = 'lobby'; r.innings = 0; r.toss = null; r.deadline = 0; r.final = null;
      broadcast(r); return { ok: true };
    }
  }
  return { error: 'unknown' };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;

  if (req.method === 'GET' && STATIC[path]) {
    const [name, type] = STATIC[path];
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    return res.end(ASSETS[name]);
  }
  if (req.method === 'GET' && path === '/api/info') return json(res, { urls: lanUrls() });

  if (req.method === 'GET' && path === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    const r = rooms.get((url.searchParams.get('code') || '').toUpperCase());
    const pid = url.searchParams.get('pid') || null;
    if (!r || (pid && !r.players.has(pid))) { res.write('event: gone\ndata: {}\n\n'); return res.end(); }
    const client = { res, pid };
    r.clients.add(client);
    if (pid) r.players.get(pid).conns++;
    r.last = Date.now();
    res.write('data: ' + JSON.stringify(view(r, pid)) + '\n\n');
    if (pid) broadcast(r);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      r.clients.delete(client);
      if (pid && r.players.has(pid)) { r.players.get(pid).conns--; broadcast(r); }
    });
    return;
  }

  if (req.method !== 'POST') { res.writeHead(404); return res.end('Not found'); }
  const b = await readBody(req);

  if (path === '/api/create') { const r = createRoom(); return json(res, { code: r.code }); }

  const r = rooms.get(String(b.code || '').toUpperCase());
  if (!r) return json(res, { error: 'no_room' });
  r.last = Date.now();

  if (path === '/api/join') {
    if (r.phase !== 'lobby') return json(res, { error: 'started' });
    const name = String(b.name || '').trim().slice(0, 16);
    if (!name) return json(res, { error: 'bad_name' });
    if (r.players.size >= MAX_PLAYERS) return json(res, { error: 'full' });
    if ([...r.players.values()].some(x => x.name.toLowerCase() === name.toLowerCase())) return json(res, { error: 'name_taken' });
    const id = crypto.randomBytes(8).toString('hex');
    r.players.set(id, { id, name, team: null, teamAt: 0, at: Date.now(), conns: 0 });
    if (!r.vipId) r.vipId = id;
    broadcast(r);
    return json(res, { pid: id });
  }
  if (path === '/api/act') return json(res, act(r, b));
  json(res, { error: 'unknown' }, 404);
});

setInterval(() => {
  for (const [code, r] of rooms)
    if (r.clients.size === 0 && Date.now() - r.last > 2 * 3600 * 1000) { clearTimeout(r.timer); rooms.delete(code); }
}, 600000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('\nHand Cricket is running!\n');
  console.log('  Big screen (optional):  http://localhost:' + PORT + '/host');
  const urls = lanUrls();
  if (urls.length) console.log('  Players join at:        ' + urls.join('  or  '));
  console.log('\n  Everyone must be on the same Wi-Fi. Press Ctrl+C to stop.\n');
});
