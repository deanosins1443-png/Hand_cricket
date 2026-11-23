// Hand Cricket: a free, dependency-free team game for phones.
// Run:  node hand-cricket.js     (Node 16 or newer, no packages needed)
// The server only keeps score and timers. Visuals, animation, sound, charts and stats tables are drawn in the browser.
const http = require('http');
const os = require('os');
const zlib = require('zlib');
const crypto = require('crypto');

const ASSETS = {"app.html":"<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">\n<title>Hand Cricket</title>\n<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\"><link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;600;700&display=swap\">\n<link rel=\"stylesheet\" href=\"/style.css\"></head>\n<body>\n<canvas id=\"fx\"></canvas>\n<div class=\"wrap\">\n  <header>\n    <div class=\"brand\">\n      <svg class=\"logo\" viewBox=\"0 0 40 40\" aria-hidden=\"true\"><circle cx=\"20\" cy=\"20\" r=\"17\" fill=\"#b3202a\"/><path d=\"M8 12 Q20 20 8 28 M32 12 Q20 20 32 28\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2\" stroke-dasharray=\"3 2.5\"/></svg>\n      <div><h1>Hand <span>Cricket</span></h1><div class=\"room\" id=\"room\"></div></div>\n    </div>\n    <div class=\"hr\"><div class=\"timer\" id=\"timer\"></div><button class=\"icon\" id=\"vox\" aria-label=\"Commentary voice on or off\" title=\"Commentary voice\" hidden>🎙</button><button class=\"icon\" id=\"snd\" aria-label=\"Sound on or off\">🔊</button></div>\n  </header>\n  <nav class=\"tabs\" aria-label=\"Sections\"><button id=\"tabGame\" data-act=\"tab\" data-t=\"game\">Game</button><button id=\"tabStats\" data-act=\"tab\" data-t=\"stats\">Stats</button><button id=\"tabRules\" data-act=\"tab\" data-t=\"rules\">Rules</button></nav>\n  <main id=\"app\"></main>\n</div>\n<div class=\"hint\" id=\"hint\" hidden>🔊 Tap anywhere to turn on sound</div>\n<script>\n(function(){\n'use strict';\nvar PATH_HOST=location.pathname.replace(/\\/$/,'')==='/host';\nvar $=function(id){return document.getElementById(id);};\nvar esc=function(s){return String(s==null?'':s).replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c];});};\nvar store={\n  get:function(k){try{return localStorage.getItem(k);}catch(e){return null;}},\n  set:function(k,v){try{localStorage.setItem(k,v);}catch(e){}},\n  del:function(k){try{localStorage.removeItem(k);}catch(e){}}\n};\nvar parse=function(s){try{return JSON.parse(s);}catch(e){return null;}};\nvar reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;\nvar S=null,role=null,code=null,pid=null,hostKey=null,es=null,clockOff=0,info={urls:[]};\nvar ftab='summary',tab='game',landing=new URLSearchParams(location.search).get('room')?'join':'choose',msg='',armed=null,armTimer=null,lastSig='',lastTick=-1;\nvar draft={bat:[],bowl:[]},draftInnings=0,lastStats=null,padKey='',padPerm=[];\nvar muted=store.get('hcMute')==='1';\nvar tn=function(t){return esc(S.teamNames[t]);};\nvar tc=function(t){return 't'+t;};\nvar cv=function(t){return 'var(--c'+t+')';};\nvar oth=function(t){return t===S.match.a?S.match.b:S.match.a;};\nvar inM=function(t){return t===S.match.a||t===S.match.b;};\nvar slot=function(t){return t===S.match.a?0:1;};\nvar isSO=function(){return S.innings>2;};\nvar oversNow=function(){return S.innings>2?1:S.overs;};\nvar P=function(id){return S.players.filter(function(p){return p.id===id;})[0];};\nvar nm=function(id){var p=P(id);return p?esc(p.name):'Someone';};\nvar ovr=function(b){return Math.floor(b/6)+'.'+(b%6);};\nvar plural=function(n,w){return n+' '+w+(n===1?'':'s');};\n\n/* ---------- sound (made in the browser, no files) ---------- */\nvar AC=null,nb=null;\nfunction ctx(){\n  if(!AC){try{AC=new (window.AudioContext||window.webkitAudioContext)();}catch(e){AC=null;}}\n  if(AC&&AC.state==='suspended'){try{AC.resume();}catch(e){}}\n  return AC;\n}\nfunction live(){return AC&&!muted&&AC.state==='running';}\nfunction env(g,t,a,d,v){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+d);}\nfunction tone(f,d,type,v,delay,f2){\n  if(!live())return;\n  var t=AC.currentTime+(delay||0),o=AC.createOscillator(),g=AC.createGain();\n  o.type=type||'sine';o.frequency.setValueAtTime(f,t);\n  if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);\n  env(g,t,0.005,d,v||0.2);o.connect(g);g.connect(AC.destination);o.start(t);o.stop(t+d+0.05);\n}\nfunction nbuf(){\n  if(!nb){nb=AC.createBuffer(1,AC.sampleRate,AC.sampleRate);var x=nb.getChannelData(0);for(var i=0;i<x.length;i++)x[i]=Math.random()*2-1;}\n  return nb;\n}\nfunction noise(d,v,delay,ft,ff,att){\n  if(!live())return;\n  var a=att||Math.min(0.04,d/3),t=AC.currentTime+(delay||0),s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();\n  s.buffer=nbuf();s.loop=true;f.type=ft||'lowpass';f.frequency.value=ff||1000;\n  env(g,t,a,d,v);s.connect(f);f.connect(g);g.connect(AC.destination);s.start(t);s.stop(t+a+d+0.05);\n}\nfunction sweep(delay,dur,f1,f2,v){\n  if(!live())return;\n  var t=AC.currentTime+(delay||0),s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();\n  s.buffer=nbuf();s.loop=true;f.type='bandpass';f.Q.value=1.2;\n  f.frequency.setValueAtTime(f1,t);f.frequency.exponentialRampToValueAtTime(f2,t+dur);\n  env(g,t,dur*0.5,dur*0.5,v);s.connect(f);f.connect(g);g.connect(AC.destination);s.start(t);s.stop(t+dur+0.05);\n}\nfunction quack(delay){\n  if(!live())return;\n  var t=AC.currentTime+(delay||0);\n  [0,0.22].forEach(function(o){\n    var osc=AC.createOscillator(),g=AC.createGain(),f=AC.createBiquadFilter();\n    osc.type='sawtooth';osc.frequency.setValueAtTime(540,t+o);osc.frequency.exponentialRampToValueAtTime(250,t+o+0.15);\n    f.type='bandpass';f.frequency.value=1300;f.Q.value=2.2;\n    env(g,t+o,0.01,0.15,0.4);osc.connect(f);f.connect(g);g.connect(AC.destination);osc.start(t+o);osc.stop(t+o+0.22);\n  });\n}\nvar amb=null;\nfunction ambient(on){\n  if(!on){if(amb){try{amb.stop();}catch(e){}amb=null;}return;}\n  if(amb||!live())return;\n  var s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();\n  s.buffer=nbuf();s.loop=true;f.type='bandpass';f.frequency.value=550;f.Q.value=0.6;g.gain.value=0.03;\n  s.connect(f);f.connect(g);g.connect(AC.destination);s.start();amb=s;\n}\nvar SND={\n  lock:function(){tone(700,0.07,'square',0.07);tone(1000,0.08,'square',0.07,0.06);},\n  tick:function(){tone(1200,0.04,'square',0.06);},\n  ding:function(){tone(880,0.12,'sine',0.18);tone(1320,0.18,'sine',0.12,0.1);},\n  coin:function(){[0,0.14,0.28].forEach(function(d,i){tone(1500+i*200,0.14,'sine',0.14,d);});},\n  whoosh:function(d){sweep(d,0.55,300,2600,0.22);},\n  crack:function(d){noise(0.06,0.5,d,'highpass',2200);tone(900,0.05,'square',0.16,d,300);tone(160,0.12,'sine',0.35,d,60);},\n  stumps:function(d){[0,0.045,0.09,0.15].forEach(function(o,i){noise(0.05,0.35,d+o,'bandpass',3000);tone(700-i*150,0.05,'square',0.07,d+o);});tone(120,0.25,'sine',0.3,d,50);},\n  roar:function(d,dur){noise(dur,0.3,d,'bandpass',900,0.35);noise(dur,0.12,d,'highpass',2500,0.4);},\n  applause:function(d,dur){for(var i=0;i<26;i++)noise(0.035,0.14,d+Math.random()*dur,'highpass',2600);},\n  groan:function(d){tone(240,0.5,'sawtooth',0.06,d,110);noise(0.5,0.1,d,'lowpass',500,0.1);},\n  quack:quack,\n  fanfare:function(){[523,659,784,1047,784,1047].forEach(function(f,i){tone(f,0.28,'triangle',0.16,i*0.16);});}\n};\n\n/* ---------- commentary voice (the browser's own text-to-speech) ---------- */\nvar synth=window.speechSynthesis||null,voiceReady=false;\nfunction voiceOn(){var v=store.get('hcVoice');return v===null?role==='host':v==='1';}\nfunction pickVoice(){\n  if(!synth)return null;\n  var vs=synth.getVoices();if(!vs.length)return null;\n  var pref=['en-IN','en-GB','en-AU','en-US','en'];\n  for(var i=0;i<pref.length;i++){\n    var m=vs.filter(function(v){return v.lang&&v.lang.replace('_','-').indexOf(pref[i])===0;})[0];\n    if(m)return m;\n  }\n  return null;\n}\nfunction unlockVoice(){\n  if(voiceReady||!synth)return;voiceReady=true;\n  try{var u=new SpeechSynthesisUtterance(' ');u.volume=0;synth.speak(u);}catch(e){}\n}\nfunction say(text,delay){\n  if(!synth||!voiceOn()||!voiceReady)return;\n  setTimeout(function(){\n    try{\n      synth.cancel();\n      var u=new SpeechSynthesisUtterance(text),v=pickVoice();\n      u.rate=1.05;if(v){u.voice=v;u.lang=v.lang;}\n      synth.speak(u);\n    }catch(e){}\n  },delay||0);\n}\nvar pickOne=function(a){return a[Math.floor(Math.random()*a.length)];};\nfunction raw(id){var p=P(id);return p?p.name:'Someone';}\nfunction callBall(lb){\n  var bt=raw(lb.batter),bw=raw(lb.bowler);\n  if(lb.out){\n    if(lb.golden)return pickOne(['Golden duck! '+bt+' is out first ball!','What a start for '+bw+'! '+bt+' goes for a golden duck!']);\n    if(lb.duck)return pickOne(['Duck! '+bt+' is out for zero!',bt+' departs without scoring. A duck!']);\n    return pickOne(['Howzat! '+bt+' is out!','Clean bowled! '+bw+' gets '+bt+'!','Gone! '+bt+' has to walk back.']);\n  }\n  if(lb.pp&&lb.runs>0)return pickOne(['Powerplay bonus! '+bt+' gets '+lb.runs+'.',bt+' makes the most of the powerplay with '+lb.runs+'.']);\n  if(lb.runs>=6)return pickOne(['Massive hit! '+bt+' smashes '+lb.runs+'!',bt+' sends it flying for '+lb.runs+' runs!']);\n  if(lb.runs>=4)return pickOne(['Lovely shot! '+lb.runs+' runs for '+bt+'.',bt+' finds the gap. '+lb.runs+' runs.']);\n  return pickOne([bt+' takes '+lb.runs+'.',lb.runs+' runs for '+bt+'.']);\n}\nfunction syncHint(){\n  var h=$('hint');if(h)h.hidden=muted||(AC&&AC.state==='running');\n  $('snd').textContent=muted?'🔇':'🔊';\n  var v=$('vox');\n  if(v){v.hidden=!synth;v.className='icon'+(voiceOn()?'':' off');v.setAttribute('aria-pressed',voiceOn()?'true':'false');}\n}\n\n/* ---------- confetti (canvas, browser only) ---------- */\nfunction confetti(){\n  if(reduce)return;\n  var c=$('fx'),g=c.getContext('2d');c.width=innerWidth;c.height=innerHeight;\n  var cols=['#ffcf3f','#63c7ff','#6be3a0','#ff6b6b','#f6f1e1'],ps=[],i;\n  for(i=0;i<140;i++)ps.push({x:Math.random()*c.width,y:-20-Math.random()*c.height*0.5,vx:(Math.random()-0.5)*3,vy:2+Math.random()*4,s:5+Math.random()*7,r:Math.random()*6,vr:(Math.random()-0.5)*0.3,c:cols[i%cols.length]});\n  var start=Date.now();\n  (function frame(){\n    g.clearRect(0,0,c.width,c.height);\n    ps.forEach(function(p){p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;g.save();g.translate(p.x,p.y);g.rotate(p.r);g.fillStyle=p.c;g.fillRect(-p.s/2,-p.s/3,p.s,p.s*0.6);g.restore();});\n    if(Date.now()-start<4200)requestAnimationFrame(frame);else g.clearRect(0,0,c.width,c.height);\n  })();\n}\n\n/* ---------- network ---------- */\nasync function post(path,body){\n  try{\n    var r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});\n    return await r.json();\n  }catch(e){return {error:'network'};}\n}\nfunction doAct(type,extra){return post('/api/act',Object.assign({code:code,pid:pid,key:hostKey,type:type},extra||{}));}\n\nfunction connect(){\n  if(es)es.close();\n  var url='/api/events?code='+code+(role==='host'?'&role=host&key='+hostKey:'&pid='+pid);\n  es=new EventSource(url);\n  es.onmessage=function(e){onState(JSON.parse(e.data));};\n  es.addEventListener('gone',function(){leave('That room is no longer available.');});\n  es.addEventListener('closed',function(e){\n    var d=parse(e.data)||{};\n    leave(d.reason==='host_closed'?'The host closed the room.':d.reason==='host_left'?'The host left, so the room closed.':'The room was closed.');\n  });\n  es.addEventListener('kicked',function(){leave('The host removed you from the room.');});\n}\nfunction leave(m){\n  if(es)es.close();es=null;S=null;lastStats=null;role=null;code=pid=hostKey=null;\n  store.del('hcHost');store.del('hcPlayer');\n  msg=m||'';landing='choose';tab='game';render(true);\n}\nasync function hostGame(){\n  var r=await post('/api/create',{});\n  if(!r.code){msg=r.error==='busy'?'The server is busy. Try again in a minute.':'Could not create a room. Check your connection.';render(true);return;}\n  role='host';code=r.code;hostKey=r.key;store.set('hcHost',JSON.stringify({code:code,key:hostKey}));msg='';connect();\n}\nasync function joinGame(){\n  var c=$('rc').value.trim().toUpperCase(),n=$('nm').value.trim();\n  var r=await post('/api/join',{code:c,name:n});\n  if(r.error){$('err').textContent=({no_room:'Room not found',name_taken:'That name is taken',bad_name:'Enter a name',full:'Room is full',started:'That match has already started',locked:'The host has locked this room',network:'Network error'})[r.error]||r.error;return;}\n  role='player';code=c;pid=r.pid;store.set('hcPlayer',JSON.stringify({code:c,pid:pid}));msg='';connect();\n}\nfunction postSettings(){\n  var names=[],i,el;\n  for(i=0;i<6;i++){el=$('tn'+i);if(el)names.push(el.value);}\n  var g=function(id,d){var e=$(id);return e?e.value:d;};\n  doAct('settings',{mode:g('sMode',S.mode),numTeams:+g('sNt',S.numTeams),overs:+g('sOv',S.overs),ballSec:+g('sBs',S.ballSec),\n    ppOvers:+g('sPp',S.ppOvers),ppMult:+g('sPm',S.ppMult),superOn:g('sSo',S.superOn?'on':'off')==='on',names:names});\n}\n/* ---------- state changes: sounds, voice and effects ---------- */\nfunction ballSounds(lb){\n  SND.whoosh(0);\n  if(lb.out){\n    SND.stumps(0.65);SND.groan(0.95);\n    if(lb.duck){SND.quack(1.2);if(lb.golden)SND.quack(1.9);}\n  }else if(lb.runs>=6){SND.crack(0.65);SND.roar(0.8,2);SND.applause(0.9,1.8);}\n  else{SND.crack(0.65);SND.applause(0.85,0.9);}\n  say(callBall(lb),900);\n}\nfunction onState(n){\n  var p=S;S=n;clockOff=n.now-Date.now();\n  if(n.stats)lastStats=n.stats;\n  if(p&&p.phase!==n.phase){\n    padKey='';\n    var tname=function(t){return n.teamNames[t];};\n    if(n.phase==='result'&&n.play&&n.play.lastBall)ballSounds(n.play.lastBall);\n    else if(n.phase==='ball'||n.phase==='toss_call'||n.phase==='toss_choice'){\n      SND.ding();\n      if(n.phase==='ball'&&n.play&&n.play.balls===0&&ppFor(n))say('Powerplay! Runs count '+n.ppMult+' times.',300);\n    }\n    else if(n.phase==='toss_result'){SND.coin();say(tname(n.toss.winnerTeam)+' win the toss.',700);}\n    else if(n.phase==='lineup'&&n.innings===1&&n.toss&&n.toss.decision){say(tname(n.toss.winnerTeam)+' chose to '+n.toss.decision+'.',200);}\n    else if(n.phase==='lineup'&&n.innings>2&&n.innings%2===1){SND.ding();say('Super over. '+tname(n.play.battingTeam)+' bat first.',200);}\n    else if(n.phase==='break'&&n.play&&n.play.results[n.innings]){\n      var r=n.play.results[n.innings];SND.ding();\n      if(n.tieBreak)say('The scores are level! We are going to a super over!',300);\n      else say('Innings over. '+tname(r.team)+' scored '+r.runs+' for '+r.wkts+'. The target is '+n.play.target+'.',300);\n    }\n    else if(n.phase==='final'&&n.final){\n      SND.fanfare();if(n.final.winner!==null)confetti();\n      var c=calc(),line=n.final.winner===null?'The match is tied!':tname(n.final.winner)+' '+n.final.text+'!';\n      say(line+(c.pom?' Player of the match, '+c.pom.name+'.':''),900);\n    }\n    else if(n.phase==='champion'&&n.t){\n      SND.fanfare();confetti();setTimeout(confetti,2200);\n      say('And the champions are '+tname(n.t.champion)+'! Congratulations!',900);\n    }\n    else if(n.phase==='hub')SND.ding();\n  }\n  ambient(role==='host'&&n.phase!=='lobby'&&n.phase!=='final'&&n.phase!=='hub'&&n.phase!=='champion'&&!muted);\n  render(false);\n}\nsetInterval(function(){\n  var t=$('timer'),txt='',low=false;\n  if(S&&S.deadline){\n    var rem=Math.max(0,Math.ceil((S.deadline-(Date.now()+clockOff))/1000));\n    txt=rem;low=rem<=3&&(S.phase==='ball'||S.phase==='toss_num'||S.phase==='toss_choice');\n    if(rem!==lastTick){lastTick=rem;if(low&&rem>0)SND.tick();}\n  }\n  t.textContent=txt;t.className='timer'+(low?' low':'');\n},200);\n\n/* ---------- pieces ---------- */\nfunction shuffled(){\n  var a=[0,1,2,3,4,5,6,7,8,9,10],i,j,t;\n  var rnd=function(n){try{var u=new Uint32Array(1);crypto.getRandomValues(u);return u[0]%n;}catch(e){return Math.floor(Math.random()*n);}};\n  for(i=a.length-1;i>0;i--){j=rnd(i+1);t=a[i];a[i]=a[j];a[j]=t;}\n  return a;\n}\nfunction pad(act,sel,locked){\n  var key=S.phase+'|'+S.innings+'|'+(S.play?S.play.balls:0)+'|'+act;\n  if(key!==padKey||padPerm.length!==11){padKey=key;padPerm=shuffled();}\n  var h='<div class=\"pad\" aria-label=\"Numbers 0 to 10, in a new random order every ball\">';\n  padPerm.forEach(function(i){h+='<button class=\"'+(sel===i?'sel':'')+'\" data-act=\"'+act+'\" data-n=\"'+i+'\"'+(locked?' disabled':'')+'>'+i+'</button>';});\n  return h+'</div><p class=\"mut shufl\">Buttons are shuffled every ball.</p>';\n}\nfunction lockChip(label,ok){return '<span class=\"chip'+(ok?' on':'')+'\">'+label+(ok?' ✓':' …')+'</span>';}\nfunction overDots(){\n  var p=S.play,idx=S.phase==='result'?Math.floor((p.balls-1)/6):Math.floor(p.balls/6);\n  var items=p.log.filter(function(x){return x.label.split('.')[0]==String(idx);}).reverse();\n  if(!items.length)return '';\n  return '<div class=\"over\" aria-label=\"This over\">'+items.map(function(x){return '<span class=\"dotb'+(x.out?' w':(x.runs>=6?' big6':''))+'\">'+(x.out?'W':x.runs)+'</span>';}).join('')+'</div>';\n}\nfunction ppFor(st){\n  var p=st.play;if(!p||st.innings>2||!st.ppOvers)return false;\n  var idx=st.phase==='result'?Math.floor((p.balls-1)/6):Math.floor(p.balls/6);\n  return idx<st.ppOvers;\n}\nfunction board(zero){\n  var p=S.play,runs=zero?0:p.runs,w=zero?0:p.wkts,b=zero?0:p.balls,f=S.innings%2===0?p.results[S.innings-1]:null,ot=oversNow();\n  var h='<div class=\"board '+tc(p.battingTeam)+'\"><div class=\"meta\"><span class=\"tn\">'+tn(p.battingTeam)+' batting</span><span>'+(isSO()?'<b class=\"so\">SUPER OVER</b>':'Innings '+S.innings)+'</span></div>'+\n    '<div class=\"rs'+(S.phase==='result'&&!zero?' bump':'')+'\">'+runs+'/'+w+'</div>'+\n    '<div class=\"meta\"><span>Overs '+ovr(b)+' / '+ot+'</span>'+(f?'<span>'+tn(f.team)+' '+f.runs+'/'+f.wkts+'</span>':'')+'</div>';\n  if(p.target){var need=p.target-runs,left=ot*6-b;h+='<div class=\"need\">Target '+p.target+(need>0?' · need '+need+' from '+plural(left,'ball'):' · target reached')+'</div>';}\n  if(!zero&&ppFor(S))h+='<div class=\"ppb\">⚡ Powerplay: runs ×'+S.ppMult+'</div>';\n  if(!zero)h+=overDots();\n  return h+'</div>';\n}\nfunction duckSVG(){\n  return '<svg viewBox=\"0 0 70 58\" aria-hidden=\"true\"><path d=\"M10 34 L1 29 L4 40Z\" fill=\"#ffd23f\"/><ellipse cx=\"30\" cy=\"39\" rx=\"23\" ry=\"15\" fill=\"#ffd23f\"/><ellipse cx=\"27\" cy=\"40\" rx=\"12\" ry=\"7.5\" fill=\"#f2b705\"/><circle cx=\"49\" cy=\"20\" r=\"12\" fill=\"#ffd23f\"/><path d=\"M58 20 L69 24 L58 28Z\" fill=\"#ff7a1a\"/><circle cx=\"52\" cy=\"17\" r=\"2.4\" fill=\"#222\"/><path d=\"M22 54 L22 49 M34 54 L34 49\" stroke=\"#ff7a1a\" stroke-width=\"3\" stroke-linecap=\"round\"/></svg>';\n}\nfunction field(mode){\n  var p=S.play,lb=p.lastBall,cls='field '+tc(p.battingTeam),pop='',duck='';\n  if(mode==='result'){\n    cls+=' deliver '+(lb.out?'wicket shake':'hit'+(lb.runs>=6?' sixer':''));\n    if(lb.duck){\n      pop='<div class=\"pop duckpop'+(lb.golden?' gold':'')+'\">'+(lb.golden?'GOLDEN DUCK!':'DUCK!')+'</div>';\n      duck='<div class=\"duck'+(lb.golden?' gold':'')+'\">'+duckSVG()+'</div>';\n    }else pop='<div class=\"pop '+(lb.out?'out\">OUT!':'run\">+'+lb.runs)+'</div>';\n  }else cls+=' ready';\n  var st=function(x,y,c){return '<rect class=\"stump '+c+'\" x=\"'+x+'\" y=\"'+y+'\" width=\"4\" height=\"34\" rx=\"1\"/>';};\n  return '<div class=\"'+cls+'\" style=\"--bt:'+cv(p.bowlingTeam)+'\"><svg viewBox=\"0 0 240 300\" role=\"img\" aria-label=\"Cricket pitch\">'+\n    '<rect x=\"84\" y=\"6\" width=\"72\" height=\"288\" rx=\"5\" fill=\"#cfa96d\"/>'+\n    '<g stroke=\"#f6f1e1\" stroke-width=\"2\" opacity=\".9\"><line x1=\"70\" y1=\"70\" x2=\"170\" y2=\"70\"/><line x1=\"70\" y1=\"236\" x2=\"170\" y2=\"236\"/></g>'+\n    st(112,36,'s1')+st(118,36,'s2')+st(124,36,'s3')+\n    '<rect class=\"bail\" x=\"112\" y=\"32\" width=\"8\" height=\"3\" rx=\"1\"/><rect class=\"bail\" x=\"120\" y=\"32\" width=\"8\" height=\"3\" rx=\"1\"/>'+\n    st(112,240,'')+st(118,240,'')+st(124,240,'')+\n    '<g class=\"batter-fig\" style=\"fill:var(--tc)\"><circle cx=\"100\" cy=\"92\" r=\"8\"/><rect x=\"92\" y=\"98\" width=\"16\" height=\"22\" rx=\"6\"/><rect x=\"108\" y=\"84\" width=\"4\" height=\"30\" rx=\"2\" fill=\"#d9ad6a\"/></g>'+\n    '<g style=\"fill:var(--bt)\"><circle cx=\"146\" cy=\"262\" r=\"8\"/><rect x=\"138\" y=\"268\" width=\"16\" height=\"20\" rx=\"6\"/></g>'+\n    '<g class=\"ball\"><circle class=\"c\" r=\"7\"/><path class=\"s\" d=\"M-5.5,-3 Q0,0 -5.5,3 M5.5,-3 Q0,0 5.5,3\"/></g>'+\n    '</svg>'+duck+pop+'</div>';\n}\nfunction side(role,id,mine,locked,num,showNum){\n  return '<div class=\"side '+(role==='Batter'?'bat':'bowl')+(mine?' me':'')+'\"><div class=\"role\">'+role+'</div><div class=\"who\">'+nm(id)+(mine?' (you)':'')+'</div>'+\n    (showNum?'<div class=\"num\">'+num+'</div>':'<div class=\"st'+(locked?' ok':'')+'\">'+(locked?'Locked in ✓':'Choosing…')+'</div>')+'</div>';\n}\nfunction logCard(){\n  var l=S.play.log;if(!l.length)return '';\n  return '<div class=\"card\"><h3>Recent balls</h3><ul class=\"log\">'+l.map(function(x){\n    return '<li><span>'+x.label+' · '+nm(x.batter)+' '+x.b+' vs '+nm(x.bowler)+' '+x.w+'</span>'+(x.out?'<span class=\"o\">OUT</span>':'<span class=\"r\">+'+x.runs+(x.pp&&x.runs?' ⚡':'')+'</span>')+'</li>';\n  }).join('')+'</ul></div>';\n}\nfunction hostBar(){\n  var me='<div class=\"card\"><h3>Host controls</h3>';\n  if(S.phase!=='lobby'){\n    var on=S.players.filter(function(p){return p.connected;}).length;\n    me+='<p class=\"mut\">'+on+' of '+S.players.length+' players connected.</p>';\n  }\n  me+='<div class=\"row2\">';\n  if(S.phase!=='lobby')me+='<button class=\"alt\" data-act=\"h-end\">'+(armed==='end'?'Tap again to end':(S.mode==='tournament'?'End tournament':'End match'))+'</button>';\n  me+='<button class=\"danger\" data-act=\"h-close\">'+(armed==='close'?'Tap again to close':'Close room')+'</button></div><p class=\"mut\" style=\"margin:8px 0 0\">The room also closes if you close this page.</p></div>';\n  return me;\n}\n\n/* ---------- screens ---------- */\n/* ---------- tournament ---------- */\nfunction nrrOf(x){return (x.bf?x.rf/(x.bf/6):0)-(x.ba?x.ra/(x.ba/6):0);}\nfunction rankOrder(){\n  var tb=S.t.table;\n  return tb.map(function(_,i){return i;}).sort(function(a,b){var A=tb[a],B=tb[b];return B.pts-A.pts||nrrOf(B)-nrrOf(A)||B.w-A.w||a-b;});\n}\nfunction tableHTML(){\n  var tb=S.t.table,o=rankOrder(),done=S.t.fixtures.filter(function(f){return f.stage==='league'&&!f.done;}).length===0;\n  var h='<div class=\"card\"><h3>Points table</h3><div class=\"tw\"><table class=\"tbl pts\"><tr><th>#</th><th>Team</th><th>P</th><th>W</th><th>L</th><th>T</th><th>Pts</th><th>NRR</th></tr>';\n  o.forEach(function(t,i){var x=tb[t],n=nrrOf(x);\n    h+='<tr class=\"'+(i<2?'top':'')+'\"><td>'+(i+1)+'</td><td><b class=\"tcol '+tc(t)+'\">'+tn(t)+'</b></td><td>'+x.p+'</td><td>'+x.w+'</td><td>'+x.l+'</td><td>'+x.t+'</td><td><b>'+x.pts+'</b></td><td>'+(n>=0?'+':'')+n.toFixed(2)+'</td></tr>';});\n  return h+'</table></div><p class=\"mut\" style=\"margin:8px 0 0\">Win = 2 points, tie = 1. '+(done?'The top two play the final.':'The top two teams go to the final. Ties on points are split by net run rate.')+'</p></div>';\n}\nfunction fixturesHTML(){\n  var t=S.t;\n  return '<div class=\"card\"><h3>Fixtures</h3><ul class=\"log fxl\">'+t.fixtures.map(function(f,i){\n    var st=f.stage==='final'?'FINAL':'Match '+(i+1);\n    return '<li class=\"'+(i===t.fixIdx&&S.phase==='hub'?'cur':'')+'\"><span><b>'+st+'</b> · <span class=\"tcol '+tc(f.a)+'\">'+tn(f.a)+'</span> vs <span class=\"tcol '+tc(f.b)+'\">'+tn(f.b)+'</span></span>'+\n      (f.done?'<span class=\"r\">'+(f.winner===null?'Tied':tn(f.winner)+' won')+'</span>':'<span class=\"mut\">'+(i===t.fixIdx&&S.phase==='hub'?'Next':'—')+'</span>')+'</li>';\n  }).join('')+'</ul></div>';\n}\nfunction hubHTML(){\n  var t=S.t,fx=t.fixtures[t.fixIdx],isF=fx.stage==='final';\n  var nLeague=t.fixtures.filter(function(f){return f.stage==='league';}).length;\n  var h='<div class=\"card center\"><div class=\"mut\">'+(isF?'The grand final':'League match '+(t.fixIdx+1)+' of '+nLeague)+'</div>'+\n    '<div class=\"big\"><span class=\"tcol '+tc(fx.a)+'\">'+tn(fx.a)+'</span> <span class=\"mut\" style=\"font-size:1.2rem\">vs</span> <span class=\"tcol '+tc(fx.b)+'\">'+tn(fx.b)+'</span></div>'+\n    (isF?'<div class=\"trophyS\">'+trophySVG()+'</div><p class=\"mut\" style=\"margin:0\">The winner lifts the trophy.</p>':'');\n  if(role==='host')h+='<button style=\"margin-top:10px\" data-act=\"h-next\">'+(isF?'Start the final':'Start this match')+'</button>';\n  else h+='<p class=\"mut\" style=\"margin:10px 0 0\">Waiting for the host to start the match…'+(S.me&&S.me.team!==null&&!inM(S.me.team)?' Your team is not playing this one.':'')+'</p>';\n  h+='</div>';\n  return h+tableHTML()+fixturesHTML();\n}\nfunction matchBanner(){\n  if(S.mode!=='tournament'||!S.t)return '';\n  var t=S.t,fx=t.fixtures[t.fixIdx],nLeague=t.fixtures.filter(function(f){return f.stage==='league';}).length;\n  var watch=S.me&&S.me.team!==null&&!inM(S.me.team);\n  return '<div class=\"mbanner\">'+(fx.stage==='final'?'🏆 THE FINAL':'League match '+(t.fixIdx+1)+' of '+nLeague)+' · '+tn(fx.a)+' vs '+tn(fx.b)+(watch?' · you are watching':'')+'</div>';\n}\nfunction bigTrophy(){\n  return '<svg viewBox=\"0 0 64 72\" aria-hidden=\"true\"><defs><linearGradient id=\"gld\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff2a8\"/><stop offset=\".5\" stop-color=\"#ffd23f\"/><stop offset=\"1\" stop-color=\"#c98f00\"/></linearGradient></defs>'+\n    '<path d=\"M16 6h32v18a16 16 0 0 1-32 0z\" fill=\"url(#gld)\"/><path d=\"M16 12H6c0 12 6 18 13 19M48 12h10c0 12-6 18-13 19\" fill=\"none\" stroke=\"url(#gld)\" stroke-width=\"4\" stroke-linecap=\"round\"/>'+\n    '<rect x=\"28\" y=\"40\" width=\"8\" height=\"12\" fill=\"#e0a800\"/><rect x=\"18\" y=\"52\" width=\"28\" height=\"8\" rx=\"2\" fill=\"url(#gld)\"/><rect x=\"14\" y=\"60\" width=\"36\" height=\"8\" rx=\"2\" fill=\"#b57e00\"/><circle cx=\"32\" cy=\"22\" r=\"6\" fill=\"#fff6c4\" opacity=\".6\"/></svg>';\n}\nfunction capsHTML(l){\n  var by=function(f){return l.slice().sort(f)[0];};\n  var o=by(function(a,b){return b.runs-a.runs||a.balls-b.balls;});\n  var p=by(function(a,b){return b.wkts-a.wkts||a.bRuns-b.bRuns;});\n  var m=by(function(a,b){return b.pom-a.pom||b.wins-a.wins||b.runs-a.runs;});\n  var a='';\n  if(o&&o.runs>0)a+=award('Orange Cap · most runs',o.name,plural(o.runs,'run')+' in '+plural(o.m,'match'),o.team);\n  if(p&&p.wkts>0)a+=award('Purple Cap · most wickets',p.name,plural(p.wkts,'wicket')+' in '+plural(p.m,'match'),p.team);\n  if(m&&(m.pom>0||m.wins>0))a+=award('Most valuable player',m.name,plural(m.pom,'Player of the Match award')+' · '+plural(m.wins,'win'),m.team);\n  return a?'<div class=\"awards\">'+a+'</div>':'';\n}\nfunction championHTML(){\n  var t=S.t,w=t.champion,mem=S.players.filter(function(p){return p.team===w;});\n  var h='<div class=\"card center champ '+tc(w)+'\"><div class=\"cup\">'+bigTrophy()+'</div><div class=\"mut\">Tournament champions</div><div class=\"big tcol\">'+tn(w)+'</div><p class=\"mut\" style=\"margin:6px 0 0\">'+mem.map(function(p){return esc(p.name);}).join(' · ')+'</p></div>';\n  var fx=t.fixtures[t.fixtures.length-1];\n  if(fx&&fx.done)h+='<div class=\"card center\"><div class=\"mut\">Final</div><div class=\"big\">'+tn(fx.winner)+' '+fx.text+'</div></div>';\n  var l=statsList();\n  h+=capsHTML(l)+'<div style=\"height:12px\"></div>'+tableHTML();\n  if(role==='host')h+='<div class=\"card\"><button data-act=\"h-restart\">Play again</button></div>';\n  return h;\n}\nfunction statsList(){var st=lastStats||{};return Object.keys(st).map(function(id){return Object.assign({id:id},st[id]);});}\nfunction statsHTML(){\n  var l=statsList();\n  if(!l.length)return '<div class=\"card center\"><h2>Player stats</h2><p class=\"mut\" style=\"margin:0\">Nothing yet. Finish a match and every player who batted or bowled gets a line here. Stats add up across the matches of this room.</p></div>';\n  l.sort(function(a,b){return b.runs-a.runs||b.wkts-a.wkts;});\n  var h=capsHTML(l)+'<div class=\"card\" style=\"margin-top:12px\"><h3>Player stats</h3><div class=\"tw\"><table class=\"tbl\"><tr><th>Player</th><th>M</th><th>Runs</th><th>HS</th><th>SR</th><th>6+</th><th>Wkts</th><th>Econ</th><th>Ducks</th><th>POM</th></tr>';\n  l.forEach(function(x){\n    h+='<tr><td><span class=\"tcol '+tc(x.team)+'\">'+esc(x.name)+'</span></td><td>'+x.m+'</td><td><b>'+x.runs+'</b></td><td>'+x.hi+'</td><td>'+(x.balls?Math.round(x.runs/x.balls*100):'-')+'</td><td>'+x.bigs+'</td><td><b>'+x.wkts+'</b></td><td>'+(x.bBalls?(x.bRuns/x.bBalls*6).toFixed(1):'-')+'</td><td>'+x.ducks+'</td><td>'+x.pom+'</td></tr>';\n  });\n  return h+'</table></div><p class=\"mut\" style=\"margin:8px 0 0\">HS = highest score in a match, SR = runs per 100 balls, 6+ = hits of 6 or more, POM = Player of the Match. Super over balls are not counted.</p></div>';\n}\nfunction landingHTML(){\n  var h='';\n  if(msg)h+='<div class=\"card\"><p style=\"margin:0\">'+esc(msg)+'</p></div>';\n  h+='<div class=\"card center\"><h2>Pick a number. Beat the bowler.</h2><p class=\"mut\" style=\"margin:0\">A quick team cricket game played on your phones. Single match or a full tournament. Check the Rules tab before your first match.</p></div>';\n  h+='<div class=\"choose\"><button data-act=\"l-host\">Host a game</button><button class=\"alt\" data-act=\"l-join\">Join a game</button></div>';\n  h+='<p class=\"mut center\" style=\"margin-top:10px\">Host on a laptop or TV. Players join on their own phones with the room code.</p>';\n  if(landing==='join'){\n    var qs=new URLSearchParams(location.search).get('room')||'';\n    h+='<div class=\"card\" style=\"margin-top:12px\"><h2>Join a game</h2><input id=\"rc\" placeholder=\"ROOM CODE\" maxlength=\"4\" autocapitalize=\"characters\" autocomplete=\"off\" value=\"'+esc(qs.toUpperCase())+'\"><input id=\"nm\" placeholder=\"Your name\" maxlength=\"14\" autocomplete=\"off\"><div class=\"err\" id=\"err\"></div><button data-act=\"join\">Join</button></div>';\n  }\n  return h;\n}\n/* ---------- QR code (own encoder, byte mode, error correction M, versions 1 to 10) ---------- */\nfunction qrMake(text){\n  var data=Array.prototype.slice.call(new TextEncoder().encode(text));\n  var EC=[10,16,26,18,24,16,18,22,22,26],NB=[1,1,2,2,4,4,4,5,5,5];\n  var raw=function(v){var r=(16*v+128)*v+64;if(v>=2){var n=Math.floor(v/7)+2;r-=(25*n-10)*n-55;if(v>=7)r-=36;}return r;};\n  var ver,cap;\n  for(ver=1;ver<=10;ver++){cap=Math.floor(raw(ver)/8)-EC[ver-1]*NB[ver-1];if(data.length+(ver<10?2:3)<=cap)break;}\n  if(ver>10)return null;\n  var size=ver*4+17,bits=[];\n  var put=function(v,n){for(var i=n-1;i>=0;i--)bits.push((v>>>i)&1);};\n  put(4,4);put(data.length,ver<10?8:16);data.forEach(function(b){put(b,8);});\n  put(0,Math.min(4,cap*8-bits.length));while(bits.length%8)bits.push(0);\n  var cw=[];for(var i=0;i<bits.length;i+=8){var b=0;for(var k=0;k<8;k++)b=b*2+bits[i+k];cw.push(b);}\n  for(var pad=0xEC;cw.length<cap;pad^=0xEC^0x11)cw.push(pad);\n  // Reed-Solomon\n  var mul=function(x,y){var z=0;for(var i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x;}return z&255;};\n  var ecl=EC[ver-1],nb=NB[ver-1],rawCw=Math.floor(raw(ver)/8);\n  var div=[];for(i=0;i<ecl-1;i++)div.push(0);div.push(1);\n  var root=1;for(i=0;i<ecl;i++){for(var j=0;j<div.length;j++){div[j]=mul(div[j],root);if(j+1<div.length)div[j]^=div[j+1];}root=mul(root,2);}\n  var rs=function(d){var r=div.map(function(){return 0;});d.forEach(function(b){var f=b^r.shift();r.push(0);div.forEach(function(c,i){r[i]^=mul(c,f);});});return r;};\n  var shortN=nb-rawCw%nb,shortLen=Math.floor(rawCw/nb),blocks=[],k2=0;\n  for(i=0;i<nb;i++){var dat=cw.slice(k2,k2+shortLen-ecl+(i<shortN?0:1));k2+=dat.length;var ec=rs(dat);if(i<shortN)dat.push(0);blocks.push(dat.concat(ec));}\n  var all=[];\n  for(i=0;i<blocks[0].length;i++)blocks.forEach(function(bl,j){if(i!==shortLen-ecl||j>=shortN)all.push(bl[i]);});\n  // modules\n  var M=[],F=[];for(i=0;i<size;i++){M.push(new Array(size).fill(false));F.push(new Array(size).fill(false));}\n  var set=function(x,y,d){M[y][x]=d;F[y][x]=true;};\n  for(i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0);}\n  var finder=function(x,y){for(var dy=-4;dy<=4;dy++)for(var dx=-4;dx<=4;dx++){var d=Math.max(Math.abs(dx),Math.abs(dy)),xx=x+dx,yy=y+dy;if(xx>=0&&xx<size&&yy>=0&&yy<size)set(xx,yy,d!==2&&d!==4);}};\n  finder(3,3);finder(size-4,3);finder(3,size-4);\n  var ap=[];if(ver>1){var na=Math.floor(ver/7)+2,step=Math.ceil((ver*4+4)/(na*2-2))*2;ap=[6];for(var pos=size-7;ap.length<na;pos-=step)ap.splice(1,0,pos);}\n  ap.forEach(function(a,ia){ap.forEach(function(b,ib){\n    if((ia===0&&ib===0)||(ia===0&&ib===ap.length-1)||(ia===ap.length-1&&ib===0))return;\n    for(var dy=-2;dy<=2;dy++)for(var dx=-2;dx<=2;dx++)set(a+dx,b+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);\n  });});\n  var fmt=function(mask){\n    var d=mask,r=d;for(var q=0;q<10;q++)r=(r<<1)^((r>>>9)*0x537);\n    var bt=((d<<10)|r)^0x5412,g=function(n){return ((bt>>>n)&1)===1;},n;\n    for(n=0;n<=5;n++)set(8,n,g(n));set(8,7,g(6));set(8,8,g(7));set(7,8,g(8));for(n=9;n<15;n++)set(14-n,8,g(n));\n    for(n=0;n<8;n++)set(size-1-n,8,g(n));for(n=8;n<15;n++)set(8,size-15+n,g(n));set(8,size-8,true);\n  };\n  fmt(0);\n  if(ver>=7){var rv=ver;for(i=0;i<12;i++)rv=(rv<<1)^((rv>>>11)*0x1F25);var vb=(ver<<12)|rv;\n    for(i=0;i<18;i++){var c=((vb>>>i)&1)===1,a=size-11+i%3,b2=Math.floor(i/3);set(a,b2,c);set(b2,a,c);}}\n  var bi=0;\n  for(var right=size-1;right>=1;right-=2){if(right===6)right=5;\n    for(var vert=0;vert<size;vert++)for(j=0;j<2;j++){var x=right-j,up=((right+1)&2)===0,y=up?size-1-vert:vert;\n      if(!F[y][x]&&bi<all.length*8){M[y][x]=((all[bi>>>3]>>>(7-(bi&7)))&1)===1;bi++;}}}\n  var maskFn=[function(x,y){return (x+y)%2===0;},function(x,y){return y%2===0;},function(x,y){return x%3===0;},function(x,y){return (x+y)%3===0;},\n    function(x,y){return (Math.floor(x/3)+Math.floor(y/2))%2===0;},function(x,y){return x*y%2+x*y%3===0;},function(x,y){return (x*y%2+x*y%3)%2===0;},function(x,y){return ((x+y)%2+x*y%3)%2===0;}];\n  var apply=function(m){for(var y=0;y<size;y++)for(var x=0;x<size;x++)if(!F[y][x]&&maskFn[m](x,y))M[y][x]=!M[y][x];};\n  var penalty=function(){\n    var p=0,x,y,run,dark=0;\n    for(y=0;y<size;y++){run=1;for(x=1;x<size;x++){if(M[y][x]===M[y][x-1]){run++;if(run===5)p+=3;else if(run>5)p++;}else run=1;}}\n    for(x=0;x<size;x++){run=1;for(y=1;y<size;y++){if(M[y][x]===M[y-1][x]){run++;if(run===5)p+=3;else if(run>5)p++;}else run=1;}}\n    for(y=0;y<size-1;y++)for(x=0;x<size-1;x++)if(M[y][x]===M[y][x+1]&&M[y][x]===M[y+1][x]&&M[y][x]===M[y+1][x+1])p+=3;\n    for(y=0;y<size;y++)for(x=0;x<size;x++)if(M[y][x])dark++;\n    p+=Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10;\n    return p;\n  };\n  var best=0,bp=1e9;\n  for(var m=0;m<8;m++){apply(m);fmt(m);var pn=penalty();if(pn<bp){bp=pn;best=m;}apply(m);}\n  apply(best);fmt(best);\n  return {size:size,mod:M};\n}\nfunction qrSVG(text){\n  var q=qrMake(text);if(!q)return '';\n  var d='',x,y,pad=3;\n  for(y=0;y<q.size;y++)for(x=0;x<q.size;x++)if(q.mod[y][x])d+='M'+(x+pad)+' '+(y+pad)+'h1v1h-1z';\n  var n=q.size+pad*2;\n  return '<svg viewBox=\"0 0 '+n+' '+n+'\" role=\"img\" aria-label=\"QR code to join this room\" shape-rendering=\"crispEdges\"><rect width=\"'+n+'\" height=\"'+n+'\" fill=\"#fff\"/><path d=\"'+d+'\" fill=\"#000\"/></svg>';\n}\n\nfunction inviteCard(){\n  var local=/^(localhost|127\\.)/.test(location.hostname);\n  var base=(local&&info.urls[0])?info.urls[0]:location.origin;\n  return '<div class=\"card\"><div class=\"center\"><div class=\"mut\">Players open</div><div class=\"big\">'+esc(base.replace(/^https?:\\/\\//,''))+'</div><div class=\"mut\">and enter the room code</div><div class=\"code\">'+esc(S.code)+'</div></div>'+\n    '<div class=\"qrbox\"><div class=\"qr\">'+qrSVG(base+'/?room='+S.code)+'</div><div class=\"mut\">Or scan with a phone camera to join</div></div>'+\n    '<div class=\"invite\" style=\"margin-top:8px\"><span class=\"mut\" style=\"overflow-wrap:anywhere\">'+esc(base)+'/?room='+esc(S.code)+'</span><button class=\"sm alt\" data-act=\"h-copy\">Copy invite link</button></div></div>';\n}\nfunction sel(id,cur,opts){return '<select id=\"'+id+'\" class=\"sset\">'+opts.map(function(o){return '<option value=\"'+o[0]+'\"'+(String(o[0])===String(cur)?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>';}\nfunction rng(a,b,suf){var o=[];for(var k=a;k<=b;k++)o.push([k,k+(suf||'')]);return o;}\nfunction mvSel(p){\n  var o='<option value=\"\">'+(p.team===null?'Choose team…':'Move to…')+'</option>';\n  for(var t=0;t<S.numTeams;t++)if(t!==p.team)o+='<option value=\"'+t+'\">'+tn(t)+'</option>';\n  return '<select class=\"mvsel\" data-id=\"'+p.id+'\" aria-label=\"Move '+esc(p.name)+' to a team\">'+o+'</select>';\n}\nfunction hostLobby(){\n  var un=S.players.filter(function(p){return p.team===null;}),nt=S.numTeams,all=true,i;\n  for(i=0;i<nt;i++)if(!S.players.some(function(p){return p.team===i;}))all=false;\n  var ready=!un.length&&all&&S.players.length>0;\n  var h=inviteCard();\n  h+='<div class=\"card\"><h3>Match settings</h3><div class=\"grid2\">'+\n    '<div><label class=\"l\" for=\"sMode\">Game mode</label>'+sel('sMode',S.mode,[['single','Single match'],['tournament','Tournament (IPL style)']])+'</div>'+\n    (S.mode==='tournament'?'<div><label class=\"l\" for=\"sNt\">Number of teams</label>'+sel('sNt',nt,rng(3,6))+'</div>':'')+\n    '<div><label class=\"l\" for=\"sOv\">Overs per innings</label>'+sel('sOv',S.overs,rng(1,10))+'</div>'+\n    '<div><label class=\"l\" for=\"sBs\">Seconds per ball</label>'+sel('sBs',S.ballSec,rng(3,10,' s'))+'</div>'+\n    '<div><label class=\"l\" for=\"sPp\">Powerplay</label>'+sel('sPp',S.ppOvers,[[0,'Off'],[1,'First over'],[2,'First 2 overs'],[3,'First 3 overs']])+'</div>'+\n    '<div><label class=\"l\" for=\"sPm\">Powerplay runs</label>'+sel('sPm',S.ppMult,[[2,'Double (×2)'],[3,'Triple (×3)']])+'</div>'+\n    '<div><label class=\"l\" for=\"sSo\">If scores are tied</label>'+sel('sSo',S.superOn?'on':'off',[['on','Super over'],['off','Stay tied']])+'</div></div>'+\n    '<h3 style=\"margin-top:8px\">Team names</h3><div class=\"grid2\">'+\n    Array.apply(null,Array(nt)).map(function(_,k){return '<div><label class=\"l\" for=\"tn'+k+'\">Team '+(k+1)+'</label><input class=\"sset\" id=\"tn'+k+'\" maxlength=\"14\" value=\"'+esc(S.teamNames[k])+'\"></div>';}).join('')+'</div>'+\n    (S.mode==='tournament'?'<p class=\"mut\" style=\"margin:0\">Everyone plays everyone once. The top two teams meet in the final for the trophy.</p>':'')+'</div>';\n  var col=function(t){\n    var mem=S.players.filter(function(p){return p.team===t;});\n    return '<div class=\"team '+tc(t)+'\"><h3>'+tn(t)+'</h3><ul>'+(mem.length?mem.map(function(p){\n      return '<li class=\"'+(p.connected?'':'off')+'\"><span>'+esc(p.name)+(p.captain?'<span class=\"cap\">captain</span>':'')+'</span><span class=\"acts\">'+(p.captain?'':'<button class=\"sm alt\" data-act=\"h-cap\" data-id=\"'+p.id+'\" title=\"Make captain\" aria-label=\"Make '+esc(p.name)+' captain\">★</button>')+\n        mvSel(p)+'<button class=\"sm danger\" data-act=\"h-kick\" data-id=\"'+p.id+'\" title=\"Remove\" aria-label=\"Remove '+esc(p.name)+'\">✕</button></span></li>';\n    }).join(''):'<li class=\"mut\">No players yet</li>')+'</ul></div>';\n  };\n  h+='<div class=\"teams'+(nt>2?' many':'')+'\">'+Array.apply(null,Array(nt)).map(function(_,k){return col(k);}).join('')+'</div>';\n  if(un.length)h+='<div class=\"card\" style=\"margin-top:12px\"><h3>Choosing a team</h3><ul class=\"log\">'+un.map(function(p){\n    return '<li><span>'+esc(p.name)+'</span><span class=\"acts\" style=\"display:flex;gap:4px\">'+mvSel(p)+'<button class=\"sm danger\" data-act=\"h-kick\" data-id=\"'+p.id+'\" aria-label=\"Remove '+esc(p.name)+'\">✕</button></span></li>';\n  }).join('')+'</ul></div>';\n  h+='<div class=\"card\" style=\"margin-top:12px\"><p class=\"mut\">The first player in each team is its captain. Captains do the toss, set the batting and bowling order, and can rename their team.</p>'+\n    '<div class=\"row2\"><button class=\"alt\" data-act=\"h-lock\">'+(S.locked?'Room locked: tap to unlock':'Lock room (no new players)')+'</button><button data-act=\"h-start\"'+(ready?'':' disabled')+'>'+(S.mode==='tournament'?'Start tournament':'Start match')+'</button></div>'+\n    '<p class=\"mut\" style=\"margin:8px 0 0\">'+(ready?'Ready when you are.':'Every player needs a team, and every team needs at least one player.')+'</p></div>';\n  return h+hostBar();\n}\nfunction playerLobby(){\n  var me=S.me,un=S.players.filter(function(p){return p.team===null;}),nt=S.numTeams;\n  var col=function(t){\n    var mem=S.players.filter(function(p){return p.team===t;});\n    return '<div class=\"team '+tc(t)+'\"><h3>'+tn(t)+'</h3><ul>'+(mem.length?mem.map(function(p){return '<li class=\"'+(p.connected?'':'off')+'\"><span>'+esc(p.name)+(p.captain?'<span class=\"cap\">captain</span>':'')+(p.id===me.id?' (you)':'')+'</span></li>';}).join(''):'<li class=\"mut\">No players yet</li>')+'</ul>'+\n      (me.team===t?'<p class=\"mut\" style=\"margin:0\">You are in this team.</p>':'<button class=\"join\" data-act=\"team\" data-t=\"'+t+'\">'+(me.team===null?'Join '+tn(t):'Switch to '+tn(t))+'</button>')+'</div>';\n  };\n  var h='<div class=\"card\"><h2>You are in, '+esc(me.name)+'</h2><p class=\"mut\" style=\"margin:0\">'+(S.mode==='tournament'?'Tournament, '+nt+' teams · ':'')+S.overs+' over'+(S.overs===1?'':'s')+' per innings · '+S.ballSec+' seconds per ball'+(S.ppOvers?' · powerplay ×'+S.ppMult+' for '+plural(S.ppOvers,'over'):'')+(S.superOn?' · super over on a tie':'')+'. Pick a team below.</p></div>';\n  if(me.isCaptain)h+='<div class=\"card\"><h3>You are the captain</h3><label class=\"l\" for=\"tnC\">Team name</label><input id=\"tnC\" maxlength=\"14\" value=\"'+esc(S.teamNames[me.team])+'\"><button data-act=\"tname\" data-t=\"'+me.team+'\">Save team name</button></div>';\n  h+='<div class=\"teams'+(nt>2?' many':'')+'\">'+Array.apply(null,Array(nt)).map(function(_,k){return col(k);}).join('')+'</div>';\n  if(un.length)h+='<div class=\"card\" style=\"margin-top:12px\"><span class=\"mut\">Choosing a team: </span>'+un.map(function(p){return esc(p.name);}).join(', ')+'</div>';\n  h+='<div class=\"card center mut\" style=\"margin-top:12px\">Waiting for the host to start…<br>The first player in each team is its captain.</div>';\n  return h;\n}\nfunction tossCall(){\n  var t=S.toss,cap=null;\n  S.players.forEach(function(p){if(p.team===t.callerTeam&&p.captain)cap=p;});\n  var h='<div class=\"card center\"><h2>The toss</h2><p>Each captain picks 0 to 10. If the total matches the call, the calling team wins the toss.</p><p style=\"margin:0\"><b class=\"tcol '+tc(t.callerTeam)+'\">'+tn(t.callerTeam)+'</b> captain <b>'+(cap?esc(cap.name):'')+'</b> makes the call.</p></div>';\n  if(S.me&&S.me.isCaptain&&S.me.team===t.callerTeam)h+='<div class=\"card\"><h3>Your call</h3><div class=\"row2\"><button data-act=\"call\" data-c=\"odd\">Odd</button><button data-act=\"call\" data-c=\"even\">Even</button></div></div>';\n  return h;\n}\nfunction tossNum(){\n  var t=S.toss,o=oth(t.callerTeam);\n  var h='<div class=\"card center\"><h2>The toss</h2><p><b class=\"tcol '+tc(t.callerTeam)+'\">'+tn(t.callerTeam)+'</b> called <b>'+t.choice.toUpperCase()+'</b>. <b class=\"tcol '+tc(o)+'\">'+tn(o)+'</b> has <b>'+(t.choice==='odd'?'EVEN':'ODD')+'</b>.</p><div class=\"chips\" style=\"justify-content:center\">'+lockChip(tn(S.match.a)+' captain',t.locked[0])+lockChip(tn(S.match.b)+' captain',t.locked[1])+'</div></div>';\n  if(S.me&&S.me.isCaptain&&inM(S.me.team)){var m=S.me.pick;h+='<div class=\"card\"><h3>'+(m===null?'Pick a number (no pick counts as 0)':'Locked in: '+m)+'</h3>'+pad('tosspick',m,m!==null)+'</div>';}\n  return h;\n}\nfunction tossResult(){\n  var t=S.toss,par=t.sum%2===1?'odd':'even';\n  return '<div class=\"card center\"><h2>Toss result</h2><div class=\"coin\"><i>'+t.sum+'</i></div><div class=\"big\">'+t.picks[0]+' + '+t.picks[1]+' = '+t.sum+'</div><p class=\"mut\">That is '+par+'.</p><div class=\"big tcol '+tc(t.winnerTeam)+'\">'+tn(t.winnerTeam)+' win the toss</div><p class=\"mut\" style=\"margin-top:8px\">Their captain chooses what to do next.</p></div>';\n}\nfunction builder(kind,team){\n  var mem=S.players.filter(function(p){return p.team===team;});\n  var d=draft[kind],saved=kind==='bat'?S.play.orderBat:S.play.orderBowl,done=S.play.confirmed[kind];\n  if(!d.length&&saved&&saved.length)d=draft[kind]=saved.slice();\n  var h='<div class=\"card\"><h3>'+(kind==='bat'?'Set your batting order':'Set your bowling order (one bowler per over)')+'</h3><p class=\"mut\">Tap players in the order you want. Tap again to remove.</p><div class=\"chips\">';\n  mem.forEach(function(p){var i=d.indexOf(p.id);h+='<button class=\"chip'+(i>=0?' on':'')+'\" data-act=\"dr\" data-k=\"'+kind+'\" data-id=\"'+p.id+'\">'+(i>=0?'<b>'+(i+1)+'</b>':'')+esc(p.name)+'</button>';});\n  h+='</div><div class=\"row2\"><button class=\"alt\" data-act=\"dr-auto\" data-k=\"'+kind+'\">Use join order</button><button data-act=\"dr-ok\" data-k=\"'+kind+'\"'+(d.length===mem.length?'':' disabled')+'>'+(done?'Update order':'Confirm')+'</button></div>'+(done?'<p style=\"margin:8px 0 0;color:var(--ok)\">Order confirmed. You can still change it.</p>':'')+'</div>';\n  return h;\n}\nfunction lineup(){\n  if(draftInnings!==S.innings){draft={bat:[],bowl:[]};draftInnings=S.innings;}\n  var p=S.play,me=S.me,h='';\n  if(S.innings%2===0)h+=board(true);\n  h+='<div class=\"card\"><h2>'+(isSO()?'<span class=\"so\">SUPER OVER</span> ':'Innings '+S.innings)+'</h2>'+(S.innings===1&&S.toss&&S.toss.decision?'<p class=\"mut\">'+tn(S.toss.winnerTeam)+' won the toss and chose to '+S.toss.decision+' first.</p>':'')+'<p><b class=\"tcol '+tc(p.battingTeam)+'\">'+tn(p.battingTeam)+'</b> bats, <b class=\"tcol '+tc(p.bowlingTeam)+'\">'+tn(p.bowlingTeam)+'</b> bowls.'+(p.target?' Target: <b>'+p.target+'</b>.':'')+(isSO()?' One over, two wickets.':'')+'</p>'+\n    (!isSO()&&S.ppOvers?'<p style=\"color:var(--amber)\">⚡ Powerplay: runs count ×'+S.ppMult+' in the first '+plural(S.ppOvers,'over')+'.</p>':'')+\n    '<div class=\"chips\">'+lockChip('Batting order',p.confirmed.bat)+lockChip('Bowling order',p.confirmed.bowl)+'</div><p class=\"mut\" style=\"margin:0\">Captains set their order. Any order left unset uses join order when the timer ends.</p></div>';\n  if(me&&me.isCaptain){\n    if(me.team===p.battingTeam)h+=builder('bat',p.battingTeam);\n    else if(me.team===p.bowlingTeam)h+=builder('bowl',p.bowlingTeam);\n  }\n  return h;\n}\nfunction ball(){\n  var p=S.play,me=S.me,h=board(false)+field('ready');\n  var iBat=me&&me.id===p.curBatter,iBowl=me&&me.id===p.curBowler;\n  h+='<div class=\"vs\">'+side('Batter',p.curBatter,iBat,p.batLocked,0,false)+side('Bowler',p.curBowler,iBowl,p.bowlLocked,0,false)+'</div>';\n  if(iBat||iBowl){var m=me.pick;h+='<div class=\"card\"><h3>You are '+(iBat?'batting':'bowling')+'. '+(m===null?'Pick 0 to 10 (no pick counts as 0)':'Locked in: '+m)+'</h3>'+pad('ball',m,m!==null)+'</div>';}\n  else h+='<div class=\"card center mut\">'+nm(p.curBatter)+' is batting against '+nm(p.curBowler)+'.</div>';\n  return h+logCard();\n}\nfunction result(){\n  var p=S.play,lb=p.lastBall,me=S.me;\n  var h=board(false)+field('result');\n  h+='<div class=\"vs\">'+side('Batter',lb.batter,me&&me.id===lb.batter,true,lb.b,true)+side('Bowler',lb.bowler,me&&me.id===lb.bowler,true,lb.w,true)+'</div>';\n  h+='<div class=\"verdict '+(lb.out?'out':'runs')+'\">'+(lb.out?(lb.duck?(lb.golden?'GOLDEN DUCK!':'DUCK!'):'OUT!'):(lb.runs>=6?'WHAT A HIT! +':'+')+lb.runs+(lb.runs===1?' run':' runs'))+'</div>';\n  if(lb.pp&&!lb.out&&lb.runs>0)h+='<p class=\"center\" style=\"color:var(--amber);margin-top:0\">⚡ Powerplay: '+lb.base+' × '+S.ppMult+' = '+lb.runs+'</p>';\n  if(!lb.out&&lb.b===0&&lb.w>0)h+='<p class=\"center mut\">Batter played 0, so the bowler\\'s '+lb.w+' counts as runs.</p>';\n  if(lb.timedOut.bat||lb.timedOut.bowl)h+='<p class=\"center mut\">'+(lb.timedOut.bat?'The batter':'')+(lb.timedOut.bat&&lb.timedOut.bowl?' and the bowler':(lb.timedOut.bowl?'The bowler':''))+' ran out of time and played 0.</p>';\n  return h+logCard();\n}\nfunction brk(){\n  var r=S.play.results[S.innings],nxt=oth(r.team);\n  if(S.tieBreak){\n    var a=S.play.results[S.innings-1];\n    return '<div class=\"card center\"><div class=\"so\">SUPER OVER'+(S.soCount>1?' #'+S.soCount:'')+'</div><h2>The scores are level!</h2><div class=\"big\">'+tn(a.team)+' '+a.runs+'/'+a.wkts+' · '+tn(r.team)+' '+r.runs+'/'+r.wkts+'</div><p class=\"mut\" style=\"margin:8px 0 0\">One over each and two wickets. '+tn(r.team)+' bat first.</p></div>';\n  }\n  return '<div class=\"card center\"><h2>'+(isSO()?'Super over: innings over':'Innings over')+'</h2><div class=\"big tcol '+tc(r.team)+'\">'+tn(r.team)+' '+r.runs+'/'+r.wkts+'</div><p class=\"mut\">in '+ovr(r.balls)+' overs</p><div class=\"big\">Target: '+S.play.target+'</div><p class=\"mut\" style=\"margin:6px 0 0\">'+tn(nxt)+' bat next.</p></div>';\n}\nfunction tossChoice(){\n  var t=S.toss,w=t.winnerTeam,me=S.me,cap=null;\n  S.players.forEach(function(p){if(p.team===w&&p.captain)cap=p;});\n  var h='<div class=\"card center\"><h2>'+tn(w)+' won the toss</h2><p class=\"mut\" style=\"margin:0\">Captain '+(cap?esc(cap.name):'')+' chooses to bat or bowl first.</p></div>';\n  if(me&&me.isCaptain&&me.team===w)h+='<div class=\"card\"><h3>Your choice</h3><div class=\"row2\"><button data-act=\"tosschoice\" data-c=\"bat\">Bat first</button><button data-act=\"tosschoice\" data-c=\"bowl\">Bowl first</button></div><p class=\"mut\" style=\"margin:8px 0 0\">No choice means batting first.</p></div>';\n  return h;\n}\n\n/* ---------- match statistics (worked out in the browser from the ball-by-ball record) ---------- */\nfunction calc(){\n  var pl={},cnt={1:0,2:0},ov={1:{},2:{}},inn={1:{runs:0,wkts:0,balls:0,pts:[]},2:{runs:0,wkts:0,balls:0,pts:[]}},seen={};\n  S.players.forEach(function(p){pl[p.id]={id:p.id,name:p.name,team:p.team,runs:0,balls:0,out:false,duck:false,golden:false,big:0,hi:0,ord:0,inn:0,bBalls:0,bRuns:0,wkts:0,pts:0};});\n  (S.history||[]).forEach(function(h){\n    if(h.inn>2)return;\n    var b=pl[h.batter],w=pl[h.bowler],key=h.inn+'|'+h.batter;\n    if(b){\n      if(!seen[key]){seen[key]=1;b.inn=h.inn;b.ord=++cnt[h.inn];}\n      b.balls++;b.runs+=h.runs;if(h.runs>b.hi)b.hi=h.runs;if(h.runs>=6)b.big++;\n      if(h.out){b.out=true;if(h.duck)b.duck=true;if(h.golden)b.golden=true;}\n    }\n    if(w){w.bBalls++;w.bRuns+=h.runs;if(h.out)w.wkts++;}\n    ov[h.inn][h.over]=(ov[h.inn][h.over]||0)+h.runs;\n    var I=inn[h.inn];I.runs=h.score;I.wkts=h.wkts;I.balls++;I.pts.push({n:I.balls,runs:h.score,out:h.out});\n  });\n  var win=S.final?S.final.winner:null;\n  var list=Object.keys(pl).map(function(k){return pl[k];});\n  list.forEach(function(x){x.pts=x.runs+20*x.wkts+3*x.big-(x.duck?10:0)+(win!==null&&x.team===win?15:0);});\n  var played=list.filter(function(x){return x.balls>0||x.bBalls>0;});\n  var by=function(a,f){return a.slice().sort(f);};\n  var bats=list.filter(function(x){return x.balls>0;}),bowls=list.filter(function(x){return x.bBalls>0;});\n  var best=null;\n  [1,2].forEach(function(i){var r=S.play.results[i];if(!r)return;Object.keys(ov[i]).forEach(function(o){if(!best||ov[i][o]>best.runs)best={inn:i,team:r.team,over:+o+1,runs:ov[i][o]};});});\n  return {\n    pl:pl,list:list,ov:ov,inn:inn,\n    pom:(S.final&&S.final.pom&&pl[S.final.pom])||by(played,function(a,b){return b.pts-a.pts||b.runs-a.runs;})[0]||null,\n    top:by(bats,function(a,b){return b.runs-a.runs||a.balls-b.balls;})[0]||null,\n    bowl:by(bowls,function(a,b){return b.wkts-a.wkts||a.bRuns-b.bRuns;})[0]||null,\n    hit:by(bats,function(a,b){return b.hi-a.hi;})[0]||null,\n    bigs:by(bats,function(a,b){return b.big-a.big;})[0]||null,\n    ducks:list.filter(function(x){return x.duck;}),\n    best:best\n  };\n}\nvar sr=function(x){return x.balls?Math.round(x.runs/x.balls*100):0;};\nfunction trophySVG(){return '<svg viewBox=\"0 0 48 48\" aria-hidden=\"true\"><path d=\"M14 6h20v10a10 10 0 0 1-20 0z\" fill=\"#ffd23f\"/><path d=\"M14 10H6c0 8 4 12 9 12M34 10h8c0 8-4 12-9 12\" fill=\"none\" stroke=\"#ffd23f\" stroke-width=\"3\"/><rect x=\"21\" y=\"26\" width=\"6\" height=\"8\" fill=\"#e0a800\"/><rect x=\"14\" y=\"34\" width=\"20\" height=\"6\" rx=\"2\" fill=\"#ffd23f\"/></svg>';}\nfunction award(label,name,detail,team,icon){\n  return '<div class=\"award'+(team!=null?' '+tc(team):'')+'\"><div class=\"alab\">'+label+'</div><div class=\"anm\">'+(icon||'')+esc(name)+'</div><div class=\"adt\">'+detail+'</div></div>';\n}\nfunction summary(c){\n  var f=S.final,r=S.play.results,h='<div class=\"card center\"><div class=\"mut\">Match result</div>';\n  h+=f.winner===null?'<div class=\"big\">Match tied</div>':'<div class=\"big tcol '+tc(f.winner)+'\">'+tn(f.winner)+' '+f.text+'</div>';\n  h+='</div>';\n  if(c.pom){\n    var x=c.pom;\n    h+='<div class=\"card pom '+tc(x.team)+'\"><div class=\"trophy\">'+trophySVG()+'</div><div style=\"min-width:0\"><div class=\"mut\">Player of the Match</div><div class=\"big tcol\">'+esc(x.name)+'</div><div class=\"mut\">'+tn(x.team)+' · '+x.runs+' run'+(x.runs===1?'':'s')+(x.balls?' off '+x.balls+' ball'+(x.balls===1?'':'s'):'')+(x.bBalls?' · '+plural(x.wkts,'wicket'):'')+' · '+x.pts+' points</div></div></div>';\n  }\n  var a='';\n  if(c.top&&c.top.runs>0)a+=award('Top scorer',c.top.name,plural(c.top.runs,'run')+' off '+plural(c.top.balls,'ball'),c.top.team);\n  if(c.bowl&&c.bowl.wkts>0)a+=award('Best bowler',c.bowl.name,plural(c.bowl.wkts,'wicket')+' for '+c.bowl.bRuns+' runs',c.bowl.team);\n  if(c.hit&&c.hit.hi>0)a+=award('Biggest hit',c.hit.name,c.hit.hi+' runs off one ball',c.hit.team);\n  if(c.bigs&&c.bigs.big>0)a+=award('Most big hits',c.bigs.name,plural(c.bigs.big,'hit')+' of 6 or more',c.bigs.team);\n  if(c.best&&c.best.runs>0)a+=award('Best over',tn(c.best.team),c.best.runs+' runs in over '+c.best.over,c.best.team);\n  if(c.ducks.length)a+=award(c.ducks.some(function(d){return d.golden;})?'Golden duck':'Duck award',c.ducks.map(function(d){return d.name;}).join(', '),c.ducks.length===1?'Out without scoring':'Out without scoring',null,'<span class=\"mini\">'+duckSVG()+'</span>');\n  if(a)h+='<div class=\"awards\">'+a+'</div>';\n  h+='<div class=\"teams\" style=\"margin-top:12px\">';\n  [1,2].forEach(function(i){var x=r[i];if(x)h+='<div class=\"team '+tc(x.team)+'\"><h3>'+tn(x.team)+'</h3><div class=\"big\">'+x.runs+'/'+x.wkts+'</div><div class=\"mut\">'+ovr(x.balls)+' overs · innings '+i+'</div></div>';});\n  h+='</div>';\n  if(r[3]&&r[4])h+='<div class=\"card center\" style=\"margin-top:12px\"><div class=\"so\">SUPER OVER'+(S.soCount>1?'S':'')+'</div><p style=\"margin:0\">'+[3,4,5,6,7,8].filter(function(i){return r[i];}).map(function(i){return tn(r[i].team)+' '+r[i].runs+'/'+r[i].wkts;}).join(' · ')+'</p></div>';\n  h+='<div class=\"card\" style=\"margin-top:12px\"><button class=\"alt\" data-act=\"copyres\">Copy result to share</button></div>';\n  return h;\n}\nfunction scorecards(c){\n  var h='';\n  [1,2].forEach(function(i){\n    var res=S.play.results[i];if(!res)return;\n    var team=res.team;\n    var bat=c.list.filter(function(x){return x.team===team&&x.inn===i;}).sort(function(a,b){return a.ord-b.ord;});\n    var dnb=c.list.filter(function(x){return x.team===team&&x.balls===0;});\n    var bowl=c.list.filter(function(x){return x.team!==team&&x.bBalls>0;}).sort(function(a,b){return b.wkts-a.wkts||a.bRuns-b.bRuns;});\n    h+='<div class=\"card '+tc(team)+'\"><h3 class=\"tcol\">'+tn(team)+' batting · '+res.runs+'/'+res.wkts+' ('+ovr(res.balls)+' ov)</h3><div class=\"tw\"><table class=\"tbl\"><tr><th>Batter</th><th>Runs</th><th>Balls</th><th>SR</th><th>How out</th></tr>';\n    bat.forEach(function(x){h+='<tr><td>'+esc(x.name)+'</td><td><b>'+x.runs+'</b></td><td>'+x.balls+'</td><td>'+sr(x)+'</td><td>'+(x.out?(x.duck?(x.golden?'Golden duck':'Duck'):'Out'):'Not out')+'</td></tr>';});\n    h+='</table></div>'+(dnb.length?'<p class=\"mut\" style=\"margin:8px 0 0\">Did not bat: '+dnb.map(function(x){return esc(x.name);}).join(', ')+'</p>':'')+\n      '<h3 style=\"margin-top:14px\">Bowling</h3><div class=\"tw\"><table class=\"tbl\"><tr><th>Bowler</th><th>Overs</th><th>Runs</th><th>Wkts</th><th>Econ</th></tr>';\n    bowl.forEach(function(x){h+='<tr><td>'+esc(x.name)+'</td><td>'+ovr(x.bBalls)+'</td><td>'+x.bRuns+'</td><td><b>'+x.wkts+'</b></td><td>'+(x.bRuns/x.bBalls*6).toFixed(1)+'</td></tr>';});\n    h+='</table></div></div>';\n  });\n  return h;\n}\n\n/* ---------- charts (drawn as SVG in the browser) ---------- */\nfunction tx(x,y,s,anchor,size,fill){return '<text x=\"'+x+'\" y=\"'+y+'\" text-anchor=\"'+(anchor||'middle')+'\" style=\"fill:'+(fill||'var(--mute)')+';font-size:'+(size||10)+'px\">'+esc(s)+'</text>';}\nfunction wormChart(c){\n  var W=360,H=220,L=36,R=12,T=26,B=28,pw=W-L-R,ph=H-T-B,maxN=Math.max(6,S.overs*6);\n  var tgt=S.play.results[1]?S.play.results[1].runs+1:0,maxY=Math.max(c.inn[1].runs,c.inn[2].runs,tgt,8);maxY=Math.ceil(maxY/4)*4;\n  var x=function(n){return L+pw*n/maxN;},y=function(v){return T+ph*(1-v/maxY);};\n  var g='',i;\n  for(i=0;i<=4;i++){var v=maxY*i/4;g+='<line x1=\"'+L+'\" x2=\"'+(W-R)+'\" y1=\"'+y(v)+'\" y2=\"'+y(v)+'\" style=\"stroke:var(--line)\" stroke-width=\"1\"/>'+tx(L-5,y(v)+3,Math.round(v),'end');}\n  for(i=0;i<=S.overs;i++)g+=tx(x(i*6),H-12,i,'middle');\n  g+=tx(L+pw/2,H-1,'Overs','middle',9);\n  var legend='',lx=L;\n  [1,2].forEach(function(k){\n    var r=S.play.results[k];if(!r)return;\n    var col=cv(r.team),pts=c.inn[k].pts,d='M'+x(0)+','+y(0);\n    pts.forEach(function(q){d+=' L'+x(q.n)+','+y(q.runs);});\n    g+='<path d=\"'+d+'\" fill=\"none\" style=\"stroke:'+col+'\" stroke-width=\"2.5\" stroke-linejoin=\"round\"/>';\n    pts.forEach(function(q){if(q.out)g+='<circle cx=\"'+x(q.n)+'\" cy=\"'+y(q.runs)+'\" r=\"4\" style=\"fill:var(--bad);stroke:#fff\" stroke-width=\"1\"/>';});\n    legend+='<rect x=\"'+lx+'\" y=\"5\" width=\"12\" height=\"4\" rx=\"2\" style=\"fill:'+col+'\"/>'+tx(lx+16,10,S.teamNames[r.team],'start',10,'var(--cream)');\n    lx+=26+S.teamNames[r.team].length*6;\n  });\n  if(tgt)g+='<line x1=\"'+L+'\" x2=\"'+(W-R)+'\" y1=\"'+y(tgt)+'\" y2=\"'+y(tgt)+'\" stroke-dasharray=\"4 3\" style=\"stroke:var(--ok)\" stroke-width=\"1.5\"/>'+tx(W-R,y(tgt)-4,'Target '+tgt,'end',9,'var(--ok)');\n  legend+='<circle cx=\"'+(W-R-54)+'\" cy=\"7\" r=\"4\" style=\"fill:var(--bad)\"/>'+tx(W-R-46,10,'Wicket','start',10,'var(--cream)');\n  return '<svg viewBox=\"0 0 '+W+' '+H+'\" role=\"img\" aria-label=\"Runs scored ball by ball\">'+g+legend+'</svg>';\n}\nfunction overBars(c){\n  var W=360,H=200,L=30,R=8,T=16,B=26,pw=W-L-R,ph=H-T-B,n=S.overs,max=4,i,o;\n  [1,2].forEach(function(k){for(o=0;o<n;o++)max=Math.max(max,c.ov[k][o]||0);});\n  max=Math.ceil(max/4)*4;\n  var gw=pw/n,bw=Math.min(22,gw/2.6),g='';\n  for(i=0;i<=4;i++){var v=max*i/4,yy=T+ph*(1-v/max);g+='<line x1=\"'+L+'\" x2=\"'+(W-R)+'\" y1=\"'+yy+'\" y2=\"'+yy+'\" style=\"stroke:var(--line)\" stroke-width=\"1\"/>'+tx(L-5,yy+3,Math.round(v),'end');}\n  for(o=0;o<n;o++){\n    [1,2].forEach(function(k,j){\n      var r=S.play.results[k];if(!r)return;\n      var v=c.ov[k][o]||0,bh=ph*v/max,bx=L+gw*o+gw/2+(j?1:-bw-1);\n      g+='<rect x=\"'+bx+'\" y=\"'+(T+ph-bh)+'\" width=\"'+bw+'\" height=\"'+bh+'\" rx=\"2\" style=\"fill:'+cv(r.team)+'\"/>';\n      if(v>0)g+=tx(bx+bw/2,T+ph-bh-3,v,'middle',9,'var(--cream)');\n    });\n    g+=tx(L+gw*o+gw/2,H-10,o+1,'middle');\n  }\n  g+=tx(L+pw/2,H-0,'Over','middle',9);\n  return '<svg viewBox=\"0 0 '+W+' '+H+'\" role=\"img\" aria-label=\"Runs per over\">'+g+'</svg>';\n}\nfunction hbars(rows,key){\n  if(!rows.length)return '<p class=\"mut\" style=\"margin:0\">Nothing to show.</p>';\n  var max=Math.max(1,rows[0][key]);\n  return '<div class=\"hbars\">'+rows.map(function(x){return '<div class=\"hb\"><span class=\"hn\">'+esc(x.name)+'</span><span class=\"hbar\"><i class=\"'+tc(x.team)+'\" style=\"width:'+Math.max(3,x[key]/max*100)+'%\"></i></span><b>'+x[key]+'</b></div>';}).join('')+'</div>';\n}\nfunction chartsHTML(c){\n  var bats=c.list.filter(function(x){return x.balls>0;}).sort(function(a,b){return b.runs-a.runs;});\n  var bowl=c.list.filter(function(x){return x.bBalls>0&&x.wkts>0;}).sort(function(a,b){return b.wkts-a.wkts;});\n  return '<div class=\"card\"><h3>Run progress</h3><p class=\"mut\">Total runs after each ball. Red dots are wickets.</p><div class=\"chart\">'+wormChart(c)+'</div></div>'+\n    '<div class=\"card\"><h3>Runs per over</h3><div class=\"chart\">'+overBars(c)+'</div></div>'+\n    '<div class=\"card\"><h3>Runs by player</h3>'+hbars(bats,'runs')+'</div>'+\n    '<div class=\"card\"><h3>Wickets by bowler</h3>'+hbars(bowl,'wkts')+'</div>';\n}\nfunction finalHTML(){\n  var c=calc(),h='<div class=\"tabs sub\">'+[['summary','Summary'],['card','Scorecard'],['charts','Charts']].map(function(t){return '<button class=\"'+(ftab===t[0]?'on':'')+'\" data-act=\"ftab\" data-t=\"'+t[0]+'\">'+t[1]+'</button>';}).join('')+'</div>';\n  h+=ftab==='card'?scorecards(c):ftab==='charts'?chartsHTML(c):summary(c);\n  if(S.mode==='tournament'&&S.t){\n    var fx=S.t.fixtures[S.t.fixIdx];\n    if(role==='host')h+='<div class=\"card\" style=\"margin-top:12px\"><button data-act=\"h-cont\">'+(fx.stage==='final'?'Crown the champion 🏆':'Continue: points table and next match')+'</button></div>';\n    else h+='<div class=\"card center mut\" style=\"margin-top:12px\">Waiting for the host to continue…</div>';\n  }else if(role==='host')h+='<div class=\"card\" style=\"margin-top:12px\"><button data-act=\"h-restart\">Play again</button></div>';\n  return h;\n}\nfunction resultText(){\n  var f=S.final,r=S.play.results,c=calc();\n  var line=function(i){var x=r[i];return S.teamNames[x.team]+' '+x.runs+'/'+x.wkts+' ('+ovr(x.balls)+' ov)';};\n  return 'Hand Cricket: '+(f.winner===null?'match tied':S.teamNames[f.winner]+' '+f.text)+'. '+line(1)+', '+line(2)+'.'+(c.pom?' Player of the match: '+c.pom.name+'.':'');\n}\n\nfunction rules(){\n  var pp=S&&S.ppOvers?S.ppOvers:1,pm=S&&S.ppMult?S.ppMult:2;\n  return '<div class=\"card rules\"><h3>The idea</h3><p>Teams of friends, one ball at a time. The batter and the bowler each secretly pick a number from 0 to 10. If the numbers match, the batter is out. If not, the batter scores.</p>'+\n  '<h3>1. Teams</h3><ul><li>Each team has its own name. The first player to join a team is its captain, and the captain can rename the team. The host can rename teams too.</li><li>A single match has 2 teams. Tournament mode has 3 to 6 teams.</li></ul>'+\n  '<h3>2. The toss</h3><ul><li>One captain is chosen to call <b>odd</b> or <b>even</b>. The other team gets the opposite.</li><li>Both captains pick a number from 0 to 10 within the time limit. No pick counts as 0.</li><li>The two numbers are added. If the total matches the call, the calling team wins the toss.</li><li>The toss winner’s captain chooses to <b>bat or bowl first</b>.</li></ul>'+\n  '<h3>3. Batting and bowling order</h3><ul><li>The batting captain sets who bats in which order.</li><li>The bowling captain sets who bowls. Each over of 6 balls is bowled by the next bowler in the list.</li><li>Orders not set in time use the order players joined the team.</li></ul>'+\n  '<h3>4. Every ball</h3><ul><li>The batter and the bowler each tap a number from 0 to 10 before the timer ends. No pick counts as 0.</li><li>The number buttons are <b>shuffled on every ball</b>, so nobody can guess your pick from where your thumb moves.</li><li><b>Same number:</b> the batter is OUT.</li><li><b>Different numbers:</b> the batter’s number is added to the team score.</li><li><b>Special rule:</b> if the batter plays 0 and the bowler plays a number above 0, the bowler’s number is added to the score.</li></ul>'+\n  '<table class=\"ex\"><tr><th>Batter</th><th>Bowler</th><th>Result</th></tr><tr><td>4</td><td>2</td><td>+4 runs</td></tr><tr><td>3</td><td>3</td><td>OUT</td></tr><tr><td>0</td><td>5</td><td>+5 runs (bowler’s number)</td></tr><tr><td>0</td><td>0</td><td>OUT</td></tr><tr><td>no pick</td><td>6</td><td>+6 runs (no pick counts as 0)</td></tr></table>'+\n  '<h3>5. Powerplay</h3><ul><li>The host can switch on a powerplay before the match: the first 1 to 3 overs of each innings. Runs scored then are multiplied by 2 or 3. It is set to '+(pp?'':'')+(S&&S.ppOvers===0?'off':plural(pp,'over')+' with ×'+pm)+' in this room.</li><li>Wickets still fall the same way. Super overs have no powerplay.</li></ul>'+\n  '<h3>6. Ducks</h3><ul><li>A batter who is out without scoring a single run gets a <b>duck</b>. Out on the very first ball is a <b>golden duck</b>.</li></ul>'+\n  '<h3>7. Innings, the chase and the super over</h3><ul><li>An innings ends when all overs are bowled or every batter is out.</li><li>The second team then bats and must beat the target, which is the first team’s score plus 1. The match ends as soon as the chasing team passes the target.</li><li>If the scores finish level, and the host left super overs on, there is a <b>super over</b>: one over each and a maximum of 2 wickets. The team that batted second goes first. Up to 3 super overs are played.</li></ul>'+\n  '<h3>8. Tournament mode</h3><ul><li>Every team plays every other team once. A win is 2 points, a tie is 1. Net run rate splits teams with equal points.</li><li>The top two teams meet in the <b>final</b>. The winner gets the trophy.</li><li>Players of teams that are not playing can watch the match.</li></ul>'+\n  '<h3>9. Awards and stats</h3><ul><li>After each match: a full scorecard, charts and a <b>Player of the Match</b>. Points: 1 per run, 20 per wicket, 3 per hit of 6 or more, 15 for the winning team, and minus 10 for a duck.</li><li>The Stats tab keeps every player’s totals for the whole room. A tournament ends with the Orange Cap (most runs), the Purple Cap (most wickets) and the most valuable player.</li></ul>'+\n  '<h3>Tips</h3><ul><li>Change your numbers often. Bowlers who repeat get caught.</li><li>Tap fast. The timer is short.</li><li>The speaker button turns sound on or off. The microphone button turns the commentary voice on or off.</li></ul></div>';\n}\nfunction gameHTML(){\n  if(!S)return landingHTML();\n  var hb=role==='host'?hostBar():'',pre='',body='';\n  if(['toss_call','toss_num','toss_result','toss_choice','lineup','ball','result','break','final'].indexOf(S.phase)>=0)pre=matchBanner();\n  switch(S.phase){\n    case 'lobby':return role==='host'?hostLobby():playerLobby();\n    case 'hub':return hubHTML()+hb;\n    case 'champion':return championHTML()+hb;\n    case 'toss_call':body=tossCall()+hb;break;\n    case 'toss_num':body=tossNum()+hb;break;\n    case 'toss_result':body=tossResult()+hb;break;\n    case 'toss_choice':body=tossChoice()+hb;break;\n    case 'lineup':body=lineup()+hb;break;\n    case 'ball':body=ball()+hb;break;\n    case 'result':body=result()+hb;break;\n    case 'break':body=brk()+hb;break;\n    case 'final':body=finalHTML()+hb;break;\n  }\n  return pre+body;\n}\nfunction render(force){\n  var sig=ftab+'|'+tab+'|'+role+'|'+armed+'|'+msg+'|'+landing+'|'+(S?JSON.stringify(S,function(k,v){return k==='now'?undefined:v;}):'');\n  if(!force&&sig===lastSig)return;\n  lastSig=sig;\n  document.body.className=(role==='host'||PATH_HOST)?'host':'';\n  $('room').textContent=S?'Room '+S.code:'';\n  $('tabGame').className=tab==='game'?'on':'';$('tabStats').className=tab==='stats'?'on':'';$('tabRules').className=tab==='rules'?'on':'';\n  var keep=null,ae=document.activeElement;\n  if(ae&&ae.id&&$('app').contains(ae)&&(ae.tagName==='INPUT')){keep={id:ae.id,v:ae.value,s:ae.selectionStart,e:ae.selectionEnd};}\n  $('app').innerHTML=tab==='rules'?rules():tab==='stats'?statsHTML():gameHTML();\n  if(keep){var el=$(keep.id);if(el){el.value=keep.v;el.focus();try{el.setSelectionRange(keep.s,keep.e);}catch(x){}}}\n  syncHint();\n}\n\n/* ---------- clicks ---------- */\nfunction arm(name){armed=name;clearTimeout(armTimer);armTimer=setTimeout(function(){armed=null;render(true);},4000);render(true);}\ndocument.addEventListener('click',async function(e){\n  ctx();unlockVoice();syncHint();\n  if(e.target.id==='snd'){muted=!muted;store.set('hcMute',muted?'1':'0');syncHint();if(!muted){ctx();SND.ding();}return;}\n  if(e.target.id==='vox'){store.set('hcVoice',voiceOn()?'0':'1');syncHint();if(voiceOn())say('Commentary is on.',0);else if(synth)synth.cancel();return;}\n  var b=e.target.closest&&e.target.closest('[data-act]');\n  if(!b||b.disabled)return;\n  var a=b.dataset.act,k=b.dataset.k;\n  if(a==='tab'){tab=b.dataset.t;render(true);}\n  else if(a==='l-host')await hostGame();\n  else if(a==='l-join'){landing='join';render(true);}\n  else if(a==='join')await joinGame();\n  else if(a==='team')await doAct('team',{team:+b.dataset.t});\n  else if(a==='call')await doAct('call',{choice:b.dataset.c});\n  else if(a==='tosschoice')await doAct('tosschoice',{choice:b.dataset.c});\n  else if(a==='ftab'){ftab=b.dataset.t;render(true);}\n  else if(a==='copyres'){try{await navigator.clipboard.writeText(resultText());b.textContent='Copied';}catch(x){b.textContent=resultText();}}\n  else if(a==='tosspick'||a==='ball'){SND.lock();S.me.pick=+b.dataset.n;render(true);await doAct(a,{n:+b.dataset.n});}\n  else if(a==='dr'){var d=draft[k],i=d.indexOf(b.dataset.id);if(i>=0)d.splice(i,1);else d.push(b.dataset.id);render(true);}\n  else if(a==='dr-auto'){var team=k==='bat'?S.play.battingTeam:S.play.bowlingTeam;draft[k]=S.players.filter(function(p){return p.team===team;}).map(function(p){return p.id;});render(true);}\n  else if(a==='dr-ok')await doAct('order',{kind:k,order:draft[k]});\n  else if(a==='h-start')await doAct('start');\n  else if(a==='h-lock')await doAct('lock',{locked:!S.locked});\n  else if(a==='h-kick')await doAct('kick',{id:b.dataset.id});\n  else if(a==='h-cap')await doAct('captain',{id:b.dataset.id});\n  else if(a==='h-restart')await doAct('restart');\n  else if(a==='h-next')await doAct('startnext');\n  else if(a==='h-cont')await doAct('continue');\n  else if(a==='tname'){var inp=$('tnC');if(inp&&inp.value.trim())await doAct('teamname',{team:+b.dataset.t,name:inp.value});}\n  else if(a==='h-end'){if(armed==='end'){armed=null;await doAct('endmatch');render(true);}else arm('end');}\n  else if(a==='h-close'){if(armed==='close'){armed=null;await doAct('close');}else arm('close');}\n  else if(a==='h-copy'){\n    var local=/^(localhost|127\\.)/.test(location.hostname),base=(local&&info.urls[0])?info.urls[0]:location.origin,link=base+'/?room='+S.code;\n    try{await navigator.clipboard.writeText(link);b.textContent='Copied';}catch(x){b.textContent='Copy it from the text on the left';}\n  }\n});\ndocument.addEventListener('change',function(e){\n  var t=e.target;\n  if(t.classList&&t.classList.contains('sset'))postSettings();\n  else if(t.classList&&t.classList.contains('mvsel')){doAct('move',{id:t.dataset.id,team:t.value===''?null:+t.value});}\n});\ndocument.addEventListener('keydown',function(e){\n  if(e.key==='Enter'&&(e.target.id==='nm'||e.target.id==='rc'))joinGame();\n});\n\n/* ---------- start ---------- */\nasync function boot(){\n  try{info=await (await fetch('/api/info')).json();}catch(e){}\n  var hs=parse(store.get('hcHost')),ps=parse(store.get('hcPlayer'));\n  if(PATH_HOST){\n    if(hs&&hs.code){role='host';code=hs.code;hostKey=hs.key;connect();}else await hostGame();\n  }else if(ps&&ps.code){role='player';code=ps.code;pid=ps.pid;connect();}\n  else if(hs&&hs.code){role='host';code=hs.code;hostKey=hs.key;connect();}\n  else render(true);\n  syncHint();\n}\nboot();\n})();\n</script></body></html>\n","style.css":"/* Layout: a cricket ground. Striped outfield behind, dark-green panels, a stadium scoreboard and a pitch graphic. */\n:root{\n  --grass1:#14502c;--grass2:#18592f;--panel:rgba(6,32,18,.86);--panel2:rgba(255,255,255,.08);--line:rgba(246,241,225,.18);\n  --cream:#f6f1e1;--mute:#a9c4b2;--pitch:#cfa96d;--leather:#b3202a;--board:#0a0e0b;--amber:#ffb400;\n  --ta:#ffcf3f;--tb:#63c7ff;--c0:#ffcf3f;--c1:#63c7ff;--c2:#ff8fb1;--c3:#b6f26b;--c4:#c9a0ff;--c5:#ff9a4a;--ok:#6be3a0;--bad:#ff6b6b;--btn:#f6f1e1;--btn-ink:#0b2a17;\n  --display:\"Oswald\",\"Arial Narrow\",\"Impact\",system-ui,sans-serif;\n  --body:\"Inter\",system-ui,-apple-system,\"Segoe UI\",Roboto,sans-serif;\n}\n*{box-sizing:border-box}\nhtml,body{margin:0}\nbody{color:var(--cream);font-family:var(--body);line-height:1.45;min-height:100vh;\n  background:linear-gradient(180deg,rgba(0,0,0,.35),rgba(0,0,0,0) 220px),repeating-linear-gradient(90deg,var(--grass1) 0 64px,var(--grass2) 64px 128px);background-color:var(--grass1)}\n.wrap{max-width:660px;margin:0 auto;padding:12px 16px 56px}\n.host .wrap{max-width:1040px}\nheader{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}\n.brand{display:flex;align-items:center;gap:10px;min-width:0}\n.logo{width:34px;height:34px;flex:none}\nh1{margin:0;font-family:var(--display);font-weight:700;font-size:1.5rem;letter-spacing:.06em;text-transform:uppercase;line-height:1}\nh1 span{color:var(--ta)}\n.room{color:var(--mute);font-size:.75rem;text-transform:uppercase;letter-spacing:.14em}\n.hr{display:flex;align-items:center;gap:8px}\n.timer{font-family:var(--display);font-size:2.2rem;font-weight:700;color:var(--amber);font-variant-numeric:tabular-nums;min-width:1.4ch;text-align:right;text-shadow:0 0 12px rgba(255,180,0,.45)}\n.timer.low{color:#ff6b6b;animation:blink 1s steps(2) infinite}\n.icon{width:42px;height:42px;padding:0;margin:0;border-radius:50%;background:var(--panel);color:var(--cream);border:1px solid var(--line);font-size:1.1rem;flex:none}\n.tabs{display:flex;gap:8px;margin-bottom:12px}\n.tabs button{flex:1;margin:0;background:var(--panel);color:var(--mute);border:1px solid var(--line);border-radius:999px;padding:10px;font-family:var(--display);font-size:1rem;letter-spacing:.08em;text-transform:uppercase}\n.tabs button.on{background:var(--cream);color:var(--btn-ink)}\nh2{margin:0 0 8px;font-family:var(--display);font-weight:600;font-size:1.5rem;letter-spacing:.03em;line-height:1.15}\nh3{margin:0 0 6px;font-family:var(--display);font-weight:600;font-size:1.1rem;letter-spacing:.04em;text-transform:uppercase}\np{margin:0 0 10px}\n.mut{color:var(--mute)}\n.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:12px;min-width:0;animation:rise .35s ease both}\n.ta{--tc:var(--ta)}\n.tb{--tc:var(--tb)}\n.tcol{color:var(--tc)}\n.center{text-align:center}\n.code{font-family:var(--display);font-size:clamp(3.8rem,15vw,7.5rem);font-weight:700;letter-spacing:.16em;color:var(--ta);text-align:center;line-height:1.05;text-shadow:0 0 22px rgba(255,207,63,.35)}\n.big{font-family:var(--display);font-size:2.3rem;font-weight:700;line-height:1.1;overflow-wrap:anywhere}\ninput,select{width:100%;font:inherit;color:#111;background:#fff;border:0;border-radius:10px;padding:12px 14px;margin-bottom:10px}\nbutton{font:inherit;font-weight:700;border:0;border-radius:12px;padding:13px 16px;cursor:pointer;width:100%;background:var(--btn);color:var(--btn-ink);margin-top:4px}\nbutton.alt{background:var(--panel2);color:var(--cream);border:1px solid var(--line)}\nbutton.danger{background:#7d1f26;color:#fff}\nbutton.sm{width:auto;padding:6px 10px;font-size:.8rem;margin:0;border-radius:8px}\nbutton:disabled{opacity:.45;cursor:default}\nbutton:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--ta);outline-offset:2px}\n.err{color:var(--bad);min-height:1.2em;margin:0 0 6px;font-size:.9rem}\nlabel.l{display:block;font-size:.8rem;color:var(--mute);margin-bottom:4px;text-transform:uppercase;letter-spacing:.08em}\n.row2{display:flex;gap:10px}.row2>*{flex:1;min-width:0}\n.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}\n.choose{display:grid;gap:12px}\n\n/* teams and lobby */\n.teams{display:grid;grid-template-columns:1fr 1fr;gap:12px}\n.team{background:var(--panel);border:2px solid var(--tc);border-radius:14px;padding:14px;min-width:0}\n.team h3{color:var(--tc)}\n.team ul{list-style:none;margin:0 0 8px;padding:0}\n.team li{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere}\n.team li:last-child{border-bottom:0}\n.team li .acts{display:flex;gap:4px;flex:none}\n.cap{font-family:var(--display);font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;background:var(--tc);color:#111;border-radius:6px;padding:1px 6px;margin-left:6px}\n.off{opacity:.45}\n.team button.join{background:var(--tc);color:#111}\n.invite{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}\n\n/* scoreboard */\n.board{background:var(--board);border:2px solid var(--tc,#555);border-radius:14px;padding:12px 16px;margin-bottom:12px;box-shadow:inset 0 0 30px rgba(0,0,0,.6);animation:rise .35s ease both}\n.board .tn{font-family:var(--display);color:var(--tc);letter-spacing:.14em;text-transform:uppercase;font-size:.85rem}\n.board .rs{font-family:var(--display);font-size:3.6rem;font-weight:700;line-height:1;color:var(--amber);text-shadow:0 0 16px rgba(255,180,0,.5);font-variant-numeric:tabular-nums}\n.board .rs.bump{animation:pop .5s ease}\n.board .meta{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;color:var(--mute);font-size:.9rem}\n.board .need{margin-top:6px;font-family:var(--display);letter-spacing:.05em;color:var(--ok);font-size:1.05rem}\n.over{display:flex;gap:6px;margin-top:8px}\n.dotb{width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-family:var(--display);font-size:.9rem;background:#1b2a21;color:var(--cream);border:1px solid #3b5a47}\n.dotb.w{background:var(--bad);color:#fff;border-color:var(--bad)}\n.dotb.big6{background:var(--ok);color:#06281a;border-color:var(--ok)}\n\n/* pitch */\n.field{position:relative;margin-bottom:12px;border-radius:14px;overflow:hidden;background:rgba(0,0,0,.18);border:1px solid var(--line)}\n.field svg{display:block;width:100%;max-height:340px}\n.host .field svg{max-height:420px}\n.stump{fill:#f6e9c0}\n.bail{fill:#e8d28a}\n.ball .c{fill:var(--leather)}\n.ball .s{fill:none;stroke:#fff;stroke-width:1.2;opacity:.8}\n.ball{transform:translate(120px,238px)}\n.ready .ball{animation:bob 1.1s ease-in-out infinite}\n.deliver .ball{animation:deliver .7s cubic-bezier(.3,.1,.5,1) forwards}\n.deliver.hit .ball{animation:deliver .7s cubic-bezier(.3,.1,.5,1) forwards,fly .9s ease-out .7s forwards}\n.deliver.hit.sixer .ball{animation:deliver .7s cubic-bezier(.3,.1,.5,1) forwards,flyhigh 1.3s ease-out .7s forwards}\n.deliver.wicket .ball{animation:deliver .7s cubic-bezier(.3,.1,.5,1) forwards,through .5s ease-out .7s forwards}\n.deliver.wicket .s1{animation:fall1 .7s ease-out .68s forwards}\n.deliver.wicket .s2{animation:fall2 .7s ease-out .68s forwards}\n.deliver.wicket .s3{animation:fall3 .7s ease-out .68s forwards}\n.deliver.wicket .bail{animation:bailfly .9s ease-out .68s forwards}\n.s1,.s2,.s3{transform-box:fill-box;transform-origin:50% 100%}\n.bailL{transform-box:fill-box;transform-origin:50% 50%}\n.batter-fig{transform-box:fill-box;transform-origin:50% 100%}\n.deliver.hit .batter-fig{animation:swing .5s ease-out .55s both}\n.pop{position:absolute;left:0;right:0;top:34%;text-align:center;font-family:var(--display);font-weight:700;font-size:4rem;line-height:1;pointer-events:none;animation:floatup 1.6s ease-out .8s both;text-shadow:0 3px 12px rgba(0,0,0,.6);opacity:0}\n.pop.run{color:var(--ok)}\n.pop.out{color:var(--bad);font-size:4.6rem}\n.shake{animation:shake .5s ease .75s}\n\n/* ball by ball */\n.vs{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}\n.side{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px;text-align:center;min-width:0;animation:rise .35s ease both}\n.side.me{border-color:var(--ta);box-shadow:0 0 0 2px rgba(255,207,63,.25)}\n.side .role{color:var(--mute);font-size:.72rem;text-transform:uppercase;letter-spacing:.14em}\n.side .who{font-family:var(--display);font-weight:600;font-size:1.25rem;overflow-wrap:anywhere}\n.side .st{font-size:.85rem;margin-top:4px;color:var(--mute)}\n.side .st.ok{color:var(--ok);font-weight:700}\n.side .num{font-family:var(--display);font-size:4.4rem;font-weight:700;line-height:1.1;color:var(--ta);animation:flip .55s ease both}\n.side.bowl .num{animation-delay:.12s}\n.verdict{text-align:center;font-family:var(--display);font-size:2.4rem;font-weight:700;letter-spacing:.04em;margin:2px 0 8px;animation:pop .5s ease .7s both}\n.verdict.out{color:var(--bad)}\n.verdict.runs{color:var(--ok)}\n.pad{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}\n.pad button{margin:0;padding:16px 0;font-family:var(--display);font-size:1.9rem;background:var(--panel2);color:var(--cream);border:2px solid var(--line)}\n.pad button.sel{background:var(--ta);color:#241a00;border-color:var(--ta)}\n.pad button:disabled{opacity:.5}\n.chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}\n.chip{display:inline-flex;align-items:center;gap:8px;background:var(--panel2);border:2px solid var(--line);border-radius:999px;padding:8px 14px;font:inherit;font-weight:700;color:var(--cream);width:auto;margin:0}\n.chip b{display:inline-flex;align-items:center;justify-content:center;min-width:1.6em;height:1.6em;border-radius:50%;background:var(--ta);color:#241a00;font-size:.85rem}\n.chip.on{border-color:var(--ta)}\n.log{list-style:none;margin:0;padding:0;font-size:.9rem}\n.log li{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-bottom:1px solid var(--line)}\n.log li:last-child{border-bottom:0}\n.log .o{color:var(--bad);font-weight:800}\n.log .r{color:var(--ok);font-weight:800}\n\n/* toss coin */\n.coin{width:120px;height:120px;margin:6px auto 12px;perspective:600px}\n.coin i{display:flex;align-items:center;justify-content:center;width:100%;height:100%;border-radius:50%;font-style:normal;font-family:var(--display);font-size:3rem;font-weight:700;color:#4a3300;background:radial-gradient(circle at 35% 30%,#ffe58a,#d9a521 70%,#a87400);border:4px solid #f3c744;box-shadow:0 6px 18px rgba(0,0,0,.5);animation:coin 1.1s ease-out both}\n\n/* rules */\n.rules h3{margin-top:14px;color:var(--ta)}\n.rules h3:first-child{margin-top:0}\n.rules ul,.rules ol{margin:0 0 10px;padding-left:1.2em}\n.rules li{margin:4px 0}\ntable.ex{width:100%;border-collapse:collapse;font-size:.9rem;margin:6px 0 10px}\ntable.ex th,table.ex td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left}\ntable.ex th{color:var(--mute);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em}\n\n#fx{position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:50}\n.hint{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);background:var(--panel);border:1px solid var(--line);padding:8px 14px;border-radius:999px;font-size:.85rem;color:var(--mute);z-index:20}\n\n@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}\n@keyframes pop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.18);opacity:1}100%{transform:scale(1);opacity:1}}\n@keyframes flip{0%{transform:rotateX(90deg) scale(.7);opacity:0}100%{transform:none;opacity:1}}\n@keyframes blink{50%{opacity:.35}}\n@keyframes bob{0%,100%{transform:translate(120px,238px)}50%{transform:translate(120px,229px)}}\n@keyframes deliver{0%{transform:translate(120px,238px) scale(1)}55%{transform:translate(120px,130px) scale(.8)}100%{transform:translate(120px,84px) scale(1)}}\n@keyframes fly{0%{transform:translate(120px,84px)}100%{transform:translate(250px,-40px) scale(.5);opacity:0}}\n@keyframes flyhigh{0%{transform:translate(120px,84px)}60%{transform:translate(200px,-50px) scale(1.3)}100%{transform:translate(260px,-120px) scale(.4);opacity:0}}\n@keyframes through{0%{transform:translate(120px,84px)}100%{transform:translate(122px,10px) scale(.6);opacity:.2}}\n@keyframes fall1{to{transform:rotate(-70deg) translate(-8px,6px)}}\n@keyframes fall2{to{transform:rotate(12deg) translate(0,22px)}}\n@keyframes fall3{to{transform:rotate(75deg) translate(8px,6px)}}\n@keyframes bailfly{0%{transform:translate(0,0) rotate(0)}100%{transform:translate(18px,-34px) rotate(200deg);opacity:0}}\n@keyframes swing{0%{transform:rotate(0)}50%{transform:rotate(-60deg)}100%{transform:rotate(-20deg)}}\n@keyframes floatup{0%{opacity:0;transform:translateY(20px) scale(.7)}25%{opacity:1;transform:translateY(0) scale(1.1)}100%{opacity:0;transform:translateY(-50px) scale(1)}}\n@keyframes shake{0%,100%{transform:translate(0)}20%{transform:translate(-6px,2px)}40%{transform:translate(6px,-2px)}60%{transform:translate(-4px,1px)}80%{transform:translate(4px,-1px)}}\n@keyframes coin{0%{transform:translateY(60px) rotateX(0)}60%{transform:translateY(-30px) rotateX(1080deg)}100%{transform:translateY(0) rotateX(1440deg)}}\n\n@media (max-width:440px){.teams,.grid2{grid-template-columns:1fr}.pad{gap:8px}.board .rs{font-size:3.1rem}}\n@media (prefers-reduced-motion:reduce){\n  *,*::before,*::after{animation-duration:.01ms!important;animation-delay:0s!important;animation-iteration-count:1!important}\n}\n@media (max-width:600px){.field svg{max-height:230px}}\n\n/* duck, final screen, charts */\n.duck{position:absolute;left:-90px;bottom:16%;width:80px;pointer-events:none;opacity:0;animation:waddle 2.6s linear .9s both}\n.duck svg{display:block;width:100%;animation:bobduck .32s ease-in-out infinite alternate}\n.duck.gold{filter:drop-shadow(0 0 10px #ffd23f) saturate(1.5)}\n.pop.duckpop{color:#ffd23f;font-size:3.4rem}\n.pop.duckpop.gold{text-shadow:0 0 18px #ffd23f,0 3px 12px rgba(0,0,0,.6)}\n@keyframes waddle{0%{opacity:0;transform:translateX(0)}8%{opacity:1}92%{opacity:1}100%{opacity:0;transform:translateX(calc(100vw + 120px))}}\n@keyframes bobduck{from{transform:translateY(0) rotate(-6deg)}to{transform:translateY(-8px) rotate(6deg)}}\n.field .duck{max-width:80px}\n.tabs.sub{margin-bottom:12px}\n.icon.off{opacity:.45;text-decoration:line-through}\n.pom{display:flex;gap:14px;align-items:center;border:2px solid var(--tc)}\n.pom .trophy{width:64px;height:64px;flex:none;animation:pop .6s ease both}\n.pom .trophy svg{width:100%;height:100%;display:block}\n.awards{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px}\n.award{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--tc,var(--mute));border-radius:12px;padding:10px 12px;min-width:0;animation:rise .35s ease both}\n.award .alab{font-size:.7rem;text-transform:uppercase;letter-spacing:.12em;color:var(--mute)}\n.award .anm{font-family:var(--display);font-size:1.25rem;font-weight:600;overflow-wrap:anywhere;display:flex;align-items:center;gap:6px}\n.award .adt{font-size:.85rem;color:var(--mute)}\n.mini{display:inline-block;width:28px;flex:none}.mini svg{display:block;width:100%}\n.tw{overflow-x:auto}\n.tbl{width:100%;border-collapse:collapse;font-size:.92rem;min-width:300px}\n.tbl th,.tbl td{padding:6px 8px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}\n.tbl th:first-child,.tbl td:first-child{text-align:left;white-space:normal}\n.tbl th{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--mute);font-weight:600}\n.tbl td:last-child,.tbl th:last-child{text-align:right}\n.chart svg{display:block;width:100%;height:auto}\n.hbars{display:grid;gap:8px}\n.hb{display:grid;grid-template-columns:minmax(60px,26%) 1fr 2.2ch;gap:8px;align-items:center}\n.hb .hn{overflow-wrap:anywhere;font-size:.9rem}\n.hb .hbar{background:var(--panel2);border-radius:6px;height:16px;overflow:hidden}\n.hb .hbar i{display:block;height:100%;background:var(--tc);border-radius:6px}\n.hb b{text-align:right;font-variant-numeric:tabular-nums}\n@media (max-width:440px){h1{font-size:1.2rem}.logo{width:28px;height:28px}.icon{width:38px;height:38px}.timer{font-size:1.8rem}}\n\n/* v4: more teams, powerplay, super over, tournament */\n.t0{--tc:var(--c0)}.t1{--tc:var(--c1)}.t2{--tc:var(--c2)}.t3{--tc:var(--c3)}.t4{--tc:var(--c4)}.t5{--tc:var(--c5)}\n.teams.many{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}\n.mvsel{width:auto!important;margin:0!important;padding:5px 6px!important;font-size:.8rem;border-radius:8px;max-width:9.5em}\n.ppb{margin-top:6px;display:inline-block;font-family:var(--display);letter-spacing:.06em;text-transform:uppercase;font-size:.9rem;color:#241a00;background:var(--amber);border-radius:999px;padding:2px 12px;animation:pop .5s ease both}\n.so{font-family:var(--display);font-weight:700;letter-spacing:.14em;color:var(--amber);text-shadow:0 0 14px rgba(255,180,0,.5);animation:pop .6s ease both}\nb.so{font-size:inherit}\ndiv.so{font-size:1.6rem}\n.mbanner{font-family:var(--display);letter-spacing:.06em;text-transform:uppercase;font-size:.95rem;text-align:center;color:var(--amber);background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:6px 12px;margin-bottom:12px}\n.shufl{text-align:center;font-size:.78rem;margin:8px 0 0}\n.tbl.pts tr.top td{background:rgba(255,180,0,.08)}\n.tbl.pts tr.top td:first-child{border-left:3px solid var(--amber)}\n.fxl li.cur{background:rgba(255,180,0,.12);border-radius:8px;padding-left:6px;padding-right:6px}\n.fxl li>span:first-child{min-width:0;overflow-wrap:anywhere}\n.trophyS{width:70px;margin:8px auto 4px}.trophyS svg{display:block;width:100%}\n.champ{border:2px solid var(--tc);overflow:hidden;background:radial-gradient(circle at 50% 0%,rgba(255,210,63,.25),transparent 60%),var(--panel)}\n.champ .cup{width:140px;margin:0 auto 6px;animation:cup 1.4s cubic-bezier(.2,1.4,.4,1) both,glow 2.4s ease-in-out 1.4s infinite}\n.champ .cup svg{display:block;width:100%}\n.champ .big{font-size:3rem;text-shadow:0 0 20px var(--tc)}\n@keyframes cup{0%{transform:translateY(90px) scale(.3) rotate(-25deg);opacity:0}70%{transform:translateY(-8px) scale(1.12) rotate(4deg);opacity:1}100%{transform:none;opacity:1}}\n@keyframes glow{0%,100%{filter:drop-shadow(0 0 6px rgba(255,210,63,.4))}50%{filter:drop-shadow(0 0 22px rgba(255,210,63,.9))}}\n.tbl.pts th:nth-child(2),.tbl.pts td:nth-child(2){text-align:left}\n\n.qrbox{display:flex;flex-direction:column;align-items:center;gap:6px;margin-top:10px}\n.qr{width:min(220px,60vw);border-radius:10px;overflow:hidden;background:#fff}\n.qr svg{display:block;width:100%}\n.host .qr{width:min(260px,40vw)}\n"};
const GZ = {};
for (const k of Object.keys(ASSETS)) GZ[k] = zlib.gzipSync(ASSETS[k]);

const PORT = +process.env.PORT || 3000;
const K = +process.env.SPEED_SCALE || 1;            // only used for fast testing
const BASE = { GRACE: 700, RESULT: 4500, TOSS_CALL: 15000, TOSS_SHOW: 5000, TOSS_CHOICE: 15000, LINEUP: 60000, BREAK: 6000, HOST_GRACE: 30000 };
const T = k => BASE[k] * K;
const BALLS_PER_OVER = 6, MAX_PLAYERS = 24, MAX_NUM = 10, MAX_TEAMS = 6, MAX_SUPER = 3;
const DEFAULT_NAMES = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F'];
const rooms = new Map();

const rnd = n => Math.random() * n | 0;
const validNum = n => Number.isInteger(n) && n >= 0 && n <= MAX_NUM;
const clamp = (n, lo, hi, d) => { n = Math.round(+n); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
const ballMs = r => r.ballSec * 1000 * K;

function makeCode() {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c;
  do { c = Array.from({ length: 4 }, () => L[rnd(L.length)]).join(''); } while (rooms.has(c));
  return c;
}

function createRoom() {
  const r = {
    code: makeCode(), hostKey: crypto.randomBytes(12).toString('hex'), hostConns: 0, hostTimer: null,
    phase: 'lobby', players: new Map(), clients: new Set(), locked: false,
    mode: 'single', numTeams: 2, teamNames: DEFAULT_NAMES.slice(),
    overs: 2, ballSec: 5, ppOvers: 1, ppMult: 2, superOn: true,
    match: { a: 0, b: 1 }, innings: 0, soCount: 0, pendingSO: null, tieBreak: false,
    toss: null, battingTeam: null, bowlingTeam: null,
    score: { runs: 0, wkts: 0, balls: 0 }, target: null, results: {}, log: [], lastBall: null,
    orderBat: null, orderBowl: null, confirmed: { bat: false, bowl: false },
    cur: { batter: null, bowler: null }, picks: { bat: null, bowl: null },
    history: [], final: null,
    fixtures: [], fixIdx: 0, table: [], champion: null, stats: {},
    deadline: 0, timer: null, last: Date.now()
  };
  rooms.set(r.code, r);
  return r;
}

const membersOf = (r, t) => [...r.players.values()].filter(p => p.team === t).sort((a, b) => a.teamAt - b.teamAt);
const capOf = (r, t) => { const m = membersOf(r, t); return m.length ? m[0].id : null; };
const other = (r, t) => (t === r.match.a ? r.match.b : r.match.a);
const inMatch = (r, t) => t === r.match.a || t === r.match.b;
const slotOf = (r, t) => (t === r.match.a ? 0 : 1);
const isSuper = r => r.innings > 2;
const oversOf = r => (isSuper(r) ? 1 : r.overs);
const wicketLimit = r => { const n = membersOf(r, r.battingTeam).length; return isSuper(r) ? Math.min(2, n) : n; };

function schedule(r, ms, fn) {
  clearTimeout(r.timer);
  r.deadline = Date.now() + ms;
  r.timer = setTimeout(() => { try { fn(r); } catch (e) { console.error(e); } }, ms);
}

// ---------- state sent to clients (never includes hidden picks) ----------
function view(r, pid, isHost) {
  const caps = [];
  for (let t = 0; t < r.numTeams; t++) caps.push(capOf(r, t));
  const v = {
    code: r.code, phase: r.phase, mode: r.mode, numTeams: r.numTeams, teamNames: r.teamNames.slice(0, r.numTeams),
    overs: r.overs, ballSec: r.ballSec, ppOvers: r.ppOvers, ppMult: r.ppMult, superOn: r.superOn, locked: r.locked,
    match: r.match, innings: r.innings, soCount: r.soCount, tieBreak: r.tieBreak,
    deadline: r.deadline, now: Date.now(), isHost: !!isHost,
    players: [...r.players.values()].sort((a, b) => (a.teamAt || a.at) - (b.teamAt || b.at)).map(p => ({
      id: p.id, name: p.name, team: p.team, connected: p.conns > 0,
      captain: p.team !== null && caps[p.team] === p.id
    }))
  };
  const me = pid && r.players.get(pid);
  if (me) {
    v.me = { id: me.id, name: me.name, team: me.team, isCaptain: me.team !== null && caps[me.team] === me.id, pick: null };
  }
  if (r.toss) {
    const t = r.toss, reveal = r.phase !== 'toss_call' && r.phase !== 'toss_num';
    v.toss = {
      callerTeam: t.callerTeam, choice: t.choice, locked: [t.picks[0] !== null, t.picks[1] !== null],
      picks: reveal ? t.picks : null, sum: reveal ? t.sum : null, winnerTeam: reveal ? t.winnerTeam : null,
      decision: t.decision
    };
    if (me && v.me.isCaptain && inMatch(r, me.team) && r.phase === 'toss_num') v.me.pick = t.picks[slotOf(r, me.team)];
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
  if (r.phase === 'break' || r.phase === 'final') v.history = r.history;   // stats and charts are drawn in the browser
  if (r.mode === 'tournament' && r.fixtures.length) v.t = { fixtures: r.fixtures, fixIdx: r.fixIdx, table: r.table, champion: r.champion };
  if (['lobby', 'hub', 'final', 'champion'].includes(r.phase)) v.stats = r.stats;
  return v;
}

function send(c, r) { c.res.write('data: ' + JSON.stringify(view(r, c.pid, c.isHost)) + '\n\n'); }

function broadcast(r) {
  for (const c of [...r.clients]) {
    if (c.pid && !r.players.has(c.pid)) {            // removed by the host
      c.res.write('event: kicked\ndata: {}\n\n'); c.res.end(); r.clients.delete(c); continue;
    }
    send(c, r);
  }
}

function closeRoom(r, reason) {
  clearTimeout(r.timer); clearTimeout(r.hostTimer);
  for (const c of [...r.clients]) { try { c.res.write('event: closed\ndata: ' + JSON.stringify({ reason }) + '\n\n'); c.res.end(); } catch (e) {} }
  r.clients.clear();
  rooms.delete(r.code);
}

// ---------- match set-up and toss ----------
function startMatch(r) {
  r.innings = 0; r.results = {}; r.target = null; r.final = null; r.soCount = 0; r.pendingSO = null; r.tieBreak = false;
  r.log = []; r.history = []; r.lastBall = null; r.battingTeam = r.bowlingTeam = null;
  const callerTeam = Math.random() < 0.5 ? r.match.a : r.match.b;
  r.toss = { callerTeam, choice: null, picks: [null, null], sum: null, winnerTeam: null, decision: null };
  r.phase = 'toss_call';
  schedule(r, T('TOSS_CALL'), rr => setCall(rr, Math.random() < 0.5 ? 'odd' : 'even'));
  broadcast(r);
}

function setCall(r, choice) {
  if (r.phase !== 'toss_call') return;
  r.toss.choice = choice;
  r.phase = 'toss_num';
  schedule(r, ballMs(r) + T('GRACE'), resolveToss);
  r.deadline = Date.now() + ballMs(r);
  broadcast(r);
}

function resolveToss(r) {
  if (r.phase !== 'toss_num') return;
  const t = r.toss;
  t.picks = t.picks.map(p => (p === null ? 0 : p));
  t.sum = t.picks[0] + t.picks[1];
  const parity = t.sum % 2 === 1 ? 'odd' : 'even';
  t.winnerTeam = parity === t.choice ? t.callerTeam : other(r, t.callerTeam);
  r.phase = 'toss_result';
  schedule(r, T('TOSS_SHOW'), startChoice);
  broadcast(r);
}

// The toss winner's captain chooses to bat or bowl (default: bat).
function startChoice(r) {
  if (r.phase !== 'toss_result') return;
  r.phase = 'toss_choice';
  schedule(r, T('TOSS_CHOICE'), rr => setDecision(rr, 'bat'));
  broadcast(r);
}

function setDecision(r, choice) {
  if (r.phase !== 'toss_choice') return;
  r.toss.decision = choice;
  const w = r.toss.winnerTeam;
  beginInnings(r, choice === 'bat' ? w : other(r, w));
}

// ---------- innings (1 and 2 are the match, 3 and up are super overs) ----------
function beginInnings(r, battingTeam) {
  r.innings++;
  r.battingTeam = battingTeam; r.bowlingTeam = other(r, battingTeam);
  r.score = { runs: 0, wkts: 0, balls: 0 };
  if (r.innings % 2 === 1) r.target = null;          // a first innings (or first super-over innings) has no target
  r.log = []; r.lastBall = null;
  r.orderBat = r.orderBowl = null;
  r.confirmed = { bat: false, bowl: false };
  r.cur = { batter: null, bowler: null };
  r.tieBreak = false;
  r.phase = 'lineup';
  schedule(r, isSuper(r) ? T('LINEUP') / 2 : T('LINEUP'), finishLineup);
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
  schedule(r, ballMs(r) + T('GRACE'), resolveBall);
  r.deadline = Date.now() + ballMs(r);
  broadcast(r);
}

function resolveBall(r) {
  if (r.phase !== 'ball') return;
  const b = r.picks.bat === null ? 0 : r.picks.bat;
  const w = r.picks.bowl === null ? 0 : r.picks.bowl;
  const out = b === w;
  const base = out ? 0 : (b === 0 ? w : b);       // batter 0 and bowler not 0: the bowler's number is scored
  const s = r.score;
  const over = Math.floor(s.balls / BALLS_PER_OVER), ball = s.balls % BALLS_PER_OVER + 1;
  const pp = !isSuper(r) && over < r.ppOvers;     // powerplay: runs are multiplied in the first overs
  const runs = base * (pp ? r.ppMult : 1);
  // A duck is a dismissal with 0 runs scored in the innings. A golden duck is out on the first ball faced.
  const faced = r.history.filter(x => x.inn === r.innings && x.batter === r.cur.batter);
  const duck = out && faced.reduce((a, x) => a + x.runs, 0) === 0;
  const golden = duck && faced.length === 0;
  s.balls++;
  if (out) s.wkts++; else s.runs += runs;
  r.history.push({
    inn: r.innings, over, ball, batter: r.cur.batter, bowler: r.cur.bowler, b, w, out, runs, base, pp, duck, golden,
    score: s.runs, wkts: s.wkts
  });
  r.lastBall = {
    over, ball, batter: r.cur.batter, bowler: r.cur.bowler, b, w, out, runs, base, pp, duck, golden,
    timedOut: { bat: r.picks.bat === null, bowl: r.picks.bowl === null }
  };
  r.log.unshift({ label: over + '.' + ball, batter: r.cur.batter, bowler: r.cur.bowler, b, w, out, runs, pp });
  r.phase = 'result';
  schedule(r, T('RESULT'), afterBall);
  r.deadline = 0;
  broadcast(r);
}

function afterBall(r) {
  if (r.phase !== 'result') return;
  const s = r.score;
  const over = s.wkts >= wicketLimit(r) || s.balls >= oversOf(r) * BALLS_PER_OVER || (r.innings % 2 === 0 && s.runs >= r.target);
  if (over) endInnings(r); else startBall(r);
}

function endInnings(r) {
  const s = r.score;
  r.results[r.innings] = { team: r.battingTeam, runs: s.runs, wkts: s.wkts, balls: s.balls };
  if (r.innings % 2 === 1) {                       // first innings of a pair: set the target
    r.target = s.runs + 1;
    r.phase = 'break';
    schedule(r, T('BREAK'), rr => beginInnings(rr, other(rr, rr.battingTeam)));
    return broadcast(r);
  }
  const first = r.results[r.innings - 1], second = r.results[r.innings];
  let winner = null, text = 'Match tied';
  if (second.runs >= r.target) {
    winner = second.team;
    const left = wicketLimit(r) - second.wkts;
    text = isSuper(r) ? 'won in the super over' : 'won by ' + left + ' wicket' + (left === 1 ? '' : 's');
  } else if (second.runs !== first.runs) {
    winner = first.team;
    const d = first.runs - second.runs;
    text = isSuper(r) ? 'won in the super over' : 'won by ' + d + ' run' + (d === 1 ? '' : 's');
  }
  if (winner === null && r.superOn && r.soCount < MAX_SUPER) {   // tied: super over, the chasing team bats first
    r.soCount++; r.pendingSO = second.team; r.tieBreak = true;
    r.phase = 'break';
    schedule(r, T('BREAK') * 1.5, rr => beginInnings(rr, rr.pendingSO));
    return broadcast(r);
  }
  finishMatch(r, winner, text);
}

// ---------- results, stats and tournament ----------
function matchStats(r) {
  const ps = {};
  const get = id => ps[id] || (ps[id] = { runs: 0, balls: 0, out: false, duck: false, big: 0, hi: 0, bBalls: 0, bRuns: 0, wkts: 0, pts: 0 });
  for (const h of r.history) {
    if (h.inn > 2) continue;                       // super overs do not count towards stats
    const b = get(h.batter), w = get(h.bowler);
    b.balls++; b.runs += h.runs; if (h.runs > b.hi) b.hi = h.runs; if (h.runs >= 6) b.big++;
    if (h.out) { b.out = true; if (h.duck) b.duck = true; }
    w.bBalls++; w.bRuns += h.runs; if (h.out) w.wkts++;
  }
  return ps;
}

function finishMatch(r, winner, text) {
  const fx = r.mode === 'tournament' ? r.fixtures[r.fixIdx] : null;
  if (fx && fx.stage === 'final' && winner === null) { winner = fx.a; text = 'take the title on league position'; }
  const ms = matchStats(r);
  let best = null;
  for (const id of Object.keys(ms)) {
    const m = ms[id], pl = r.players.get(id);
    if (!pl) continue;
    m.pts = m.runs + 20 * m.wkts + 3 * m.big - (m.duck ? 10 : 0) + (winner !== null && pl.team === winner ? 15 : 0);
    if (!best || m.pts > ms[best].pts || (m.pts === ms[best].pts && m.runs > ms[best].runs)) best = id;
  }
  r.final = { winner, text, so: r.soCount > 0, pom: best };
  for (const id of Object.keys(ms)) {              // running player stats for the whole room
    const m = ms[id], pl = r.players.get(id);
    if (!pl) continue;
    const st = r.stats[id] || (r.stats[id] = { name: pl.name, team: pl.team, m: 0, runs: 0, balls: 0, outs: 0, hi: 0, ducks: 0, bigs: 0, wkts: 0, bBalls: 0, bRuns: 0, pom: 0, wins: 0 });
    st.name = pl.name; st.team = pl.team; st.m++; st.runs += m.runs; st.balls += m.balls; if (m.out) st.outs++;
    if (m.runs > st.hi) st.hi = m.runs; if (m.duck) st.ducks++; st.bigs += m.big;
    st.wkts += m.wkts; st.bBalls += m.bBalls; st.bRuns += m.bRuns;
    if (id === best) st.pom++;
    if (winner !== null && pl.team === winner) st.wins++;
  }
  if (fx) {
    fx.done = true; fx.winner = winner; fx.text = text; fx.so = r.final.so;
    const r1 = r.results[1], r2 = r.results[2];
    fx.res = {}; fx.res[r1.team] = r1; fx.res[r2.team] = r2;
    if (fx.stage === 'league') {
      const faced = res => (res.wkts >= membersOf(r, res.team).length ? r.overs * BALLS_PER_OVER : res.balls);
      for (const res of [r1, r2]) {
        const bat = r.table[res.team], bowl = r.table[other(r, res.team)];
        bat.rf += res.runs; bat.bf += faced(res); bowl.ra += res.runs; bowl.ba += faced(res);
      }
      const ta = r.table[fx.a], tb = r.table[fx.b];
      ta.p++; tb.p++;
      if (winner === null) { ta.t++; tb.t++; ta.pts++; tb.pts++; }
      else { const w = r.table[winner], l = r.table[other(r, winner)]; w.w++; w.pts += 2; l.l++; }
    }
  }
  r.phase = 'final'; r.deadline = 0; clearTimeout(r.timer);
  broadcast(r);
}

const nrr = t => (t.bf ? t.rf / (t.bf / 6) : 0) - (t.ba ? t.ra / (t.ba / 6) : 0);
function ranking(r) {
  return [...Array(r.numTeams).keys()].sort((x, y) => {
    const a = r.table[x], b = r.table[y];
    return b.pts - a.pts || nrr(b) - nrr(a) || b.w - a.w || x - y;
  });
}

function makeFixtures(n) {
  const ts = [...Array(n).keys()];
  if (n % 2) ts.push(null);
  const m = ts.length, fx = [];
  for (let rd = 0; rd < m - 1; rd++) {
    for (let i = 0; i < m / 2; i++) {
      const a = ts[i], b = ts[m - 1 - i];
      if (a !== null && b !== null) fx.push({ a, b, stage: 'league', done: false, winner: null, text: '', res: null });
    }
    ts.splice(1, 0, ts.pop());
  }
  return fx;
}

function startTournament(r) {
  r.fixtures = makeFixtures(r.numTeams); r.fixIdx = 0; r.champion = null; r.stats = {};
  r.table = [...Array(r.numTeams)].map(() => ({ p: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, bf: 0, ra: 0, ba: 0 }));
  r.phase = 'hub'; r.deadline = 0; r.toss = null; r.innings = 0;
  broadcast(r);
}

function afterMatch(r) {                           // host taps Continue on a finished tournament match
  const fx = r.fixtures[r.fixIdx];
  if (fx.stage === 'final') { r.champion = fx.winner; r.phase = 'champion'; return broadcast(r); }
  if (r.fixIdx + 1 < r.fixtures.length) r.fixIdx++;
  else {
    const o = ranking(r);
    r.fixtures.push({ a: o[0], b: o[1], stage: 'final', done: false, winner: null, text: '', res: null });
    r.fixIdx++;
  }
  r.phase = 'hub'; r.innings = 0; r.toss = null;
  broadcast(r);
}

function toLobby(r) {
  clearTimeout(r.timer);
  r.phase = 'lobby'; r.innings = 0; r.toss = null; r.deadline = 0; r.final = null; r.lastBall = null;
  r.fixtures = []; r.table = []; r.champion = null; r.fixIdx = 0; r.soCount = 0; r.tieBreak = false;
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

const isHostReq = (r, b) => typeof b.key === 'string' && b.key.length > 0 && b.key === r.hostKey;
const cleanName = s => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 14);
const teamOk = (r, t) => Number.isInteger(t) && t >= 0 && t < r.numTeams;

function uniqueNames(r) {
  const seen = new Set();
  for (let i = 0; i < r.numTeams; i++) {
    let n = r.teamNames[i], k = 2;
    while (seen.has(n.toLowerCase())) n = r.teamNames[i].slice(0, 11) + ' ' + k++;
    r.teamNames[i] = n; seen.add(n.toLowerCase());
  }
}

function act(r, b) {
  const p = r.players.get(b.pid);
  const host = isHostReq(r, b);
  switch (b.type) {
    // ----- host controls -----
    case 'settings': {
      if (!host) return { error: 'not_allowed' };
      if (r.phase !== 'lobby') return { error: 'bad_phase' };
      r.overs = clamp(b.overs, 1, 10, r.overs);
      r.ballSec = clamp(b.ballSec, 3, 10, r.ballSec);
      r.ppOvers = Math.min(clamp(b.ppOvers, 0, 3, r.ppOvers), r.overs);
      r.ppMult = +b.ppMult === 3 ? 3 : 2;
      if (typeof b.superOn === 'boolean') r.superOn = b.superOn;
      if (b.mode === 'single' || b.mode === 'tournament') r.mode = b.mode;
      let n = clamp(b.numTeams, 2, MAX_TEAMS, r.numTeams);
      n = r.mode === 'single' ? 2 : Math.max(3, n);
      if (n < r.numTeams) for (const q of r.players.values()) if (q.team !== null && q.team >= n) { q.team = null; q.teamAt = 0; }
      r.numTeams = n;
      if (Array.isArray(b.names)) b.names.slice(0, MAX_TEAMS).forEach((x, i) => { const c = cleanName(x); if (c) r.teamNames[i] = c; });
      uniqueNames(r);
      broadcast(r); return { ok: true };
    }
    case 'lock': {
      if (!host) return { error: 'not_allowed' };
      r.locked = !!b.locked; broadcast(r); return { ok: true };
    }
    case 'kick': {
      if (!host || r.phase !== 'lobby') return { error: 'not_allowed' };
      if (!r.players.delete(b.id)) return { error: 'no_player' };
      broadcast(r); return { ok: true };
    }
    case 'move': {
      if (!host || r.phase !== 'lobby') return { error: 'not_allowed' };
      const q = r.players.get(b.id);
      if (!q || !(b.team === null || teamOk(r, b.team))) return { error: 'bad_args' };
      q.team = b.team; q.teamAt = b.team === null ? 0 : Date.now();
      broadcast(r); return { ok: true };
    }
    case 'captain': {
      if (!host || r.phase !== 'lobby') return { error: 'not_allowed' };
      const q = r.players.get(b.id);
      if (!q || q.team === null) return { error: 'bad_args' };
      const first = membersOf(r, q.team)[0];
      q.teamAt = first.teamAt - 1;
      broadcast(r); return { ok: true };
    }
    case 'start': {
      if (!host) return { error: 'not_allowed' };
      if (r.phase !== 'lobby') return { error: 'bad_phase' };
      if ([...r.players.values()].some(x => x.team === null)) return { error: 'unassigned' };
      for (let t = 0; t < r.numTeams; t++) if (!membersOf(r, t).length) return { error: 'need_all_teams' };
      if (r.mode === 'tournament') startTournament(r);
      else { r.match = { a: 0, b: 1 }; startMatch(r); }
      return { ok: true };
    }
    case 'startnext': {
      if (!host || r.phase !== 'hub') return { error: 'bad_phase' };
      const fx = r.fixtures[r.fixIdx];
      r.match = { a: fx.a, b: fx.b };
      startMatch(r); return { ok: true };
    }
    case 'continue': {
      if (!host || r.phase !== 'final' || r.mode !== 'tournament') return { error: 'bad_phase' };
      afterMatch(r); return { ok: true };
    }
    case 'endmatch': {
      if (!host) return { error: 'not_allowed' };
      if (r.phase === 'lobby') return { error: 'bad_phase' };
      toLobby(r); return { ok: true };
    }
    case 'restart': {
      if (!host) return { error: 'not_allowed' };
      if (r.phase !== 'final' && r.phase !== 'champion') return { error: 'bad_phase' };
      toLobby(r); return { ok: true };
    }
    case 'close': {
      if (!host) return { error: 'not_allowed' };
      closeRoom(r, 'host_closed'); return { ok: true };
    }
    // ----- team set-up (lobby) -----
    case 'teamname': {
      if (r.phase !== 'lobby' || !teamOk(r, b.team)) return { error: 'bad_phase' };
      if (!host && !(p && p.team === b.team && capOf(r, b.team) === p.id)) return { error: 'not_allowed' };
      const c = cleanName(b.name);
      if (!c) return { error: 'bad_name' };
      r.teamNames[b.team] = c; uniqueNames(r);
      broadcast(r); return { ok: true };
    }
    case 'team': {
      if (r.phase !== 'lobby' || !p) return { error: 'bad_phase' };
      if (!teamOk(r, b.team)) return { error: 'bad_team' };
      p.team = b.team; p.teamAt = Date.now();
      broadcast(r); return { ok: true };
    }
    // ----- match play -----
    case 'call': {
      if (r.phase !== 'toss_call' || !p || p.id !== capOf(r, r.toss.callerTeam)) return { error: 'not_allowed' };
      if (b.choice !== 'odd' && b.choice !== 'even') return { error: 'bad_choice' };
      setCall(r, b.choice); return { ok: true };
    }
    case 'tosspick': {
      if (r.phase !== 'toss_num' || !p || p.team === null || !inMatch(r, p.team) || p.id !== capOf(r, p.team)) return { error: 'not_allowed' };
      const slot = slotOf(r, p.team);
      if (!validNum(b.n) || r.toss.picks[slot] !== null) return { error: 'bad_pick' };
      r.toss.picks[slot] = b.n;
      if (r.toss.picks[0] !== null && r.toss.picks[1] !== null) resolveToss(r); else broadcast(r);
      return { ok: true };
    }
    case 'tosschoice': {
      if (r.phase !== 'toss_choice' || !p || p.team !== r.toss.winnerTeam || p.id !== capOf(r, p.team)) return { error: 'not_allowed' };
      if (b.choice !== 'bat' && b.choice !== 'bowl') return { error: 'bad_choice' };
      setDecision(r, b.choice); return { ok: true };
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
  }
  return { error: 'unknown' };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const path = url.pathname;

  if (req.method === 'GET' && STATIC[path]) {
    const [name, type] = STATIC[path];
    const h = { 'Content-Type': type, 'Cache-Control': 'no-cache', 'Vary': 'Accept-Encoding' };
    if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      h['Content-Encoding'] = 'gzip';
      res.writeHead(200, h); return res.end(GZ[name]);
    }
    res.writeHead(200, h);
    return res.end(ASSETS[name]);
  }
  if (req.method === 'GET' && path === '/api/info') return json(res, { urls: lanUrls() });

  if (req.method === 'GET' && path === '/api/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
    const r = rooms.get((url.searchParams.get('code') || '').toUpperCase());
    const pid = url.searchParams.get('pid') || null;
    const asHost = url.searchParams.get('role') === 'host';
    const bad = !r || (asHost && url.searchParams.get('key') !== r.hostKey) || (!asHost && pid && !r.players.has(pid));
    if (bad) { res.write('event: gone\ndata: {}\n\n'); return res.end(); }
    const client = { res, pid: asHost ? null : pid, isHost: asHost };
    r.clients.add(client);
    if (asHost) { r.hostConns++; clearTimeout(r.hostTimer); }
    else if (pid) r.players.get(pid).conns++;
    r.last = Date.now();
    send(client, r);
    if (!asHost && pid) broadcast(r);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => {
      clearInterval(ping);
      r.clients.delete(client);
      if (asHost) {
        r.hostConns--;
        // The room closes when the host leaves (the short wait allows a page refresh).
        if (r.hostConns <= 0 && rooms.get(r.code) === r) r.hostTimer = setTimeout(() => closeRoom(r, 'host_left'), T('HOST_GRACE'));
      } else if (pid && r.players.has(pid)) { r.players.get(pid).conns--; broadcast(r); }
    });
    return;
  }

  if (req.method !== 'POST') { res.writeHead(404); return res.end('Not found'); }
  const b = await readBody(req);

  if (path === '/api/create') {
    if (rooms.size >= 200) return json(res, { error: 'busy' });
    const r = createRoom(); return json(res, { code: r.code, key: r.hostKey });
  }

  const r = rooms.get(String(b.code || '').toUpperCase());
  if (!r) return json(res, { error: 'no_room' });
  r.last = Date.now();

  if (path === '/api/join') {
    if (r.phase !== 'lobby') return json(res, { error: 'started' });
    if (r.locked) return json(res, { error: 'locked' });
    const name = cleanName(b.name);
    if (!name) return json(res, { error: 'bad_name' });
    if (r.players.size >= MAX_PLAYERS) return json(res, { error: 'full' });
    if ([...r.players.values()].some(x => x.name.toLowerCase() === name.toLowerCase())) return json(res, { error: 'name_taken' });
    const id = crypto.randomBytes(8).toString('hex');
    r.players.set(id, { id, name, team: null, teamAt: 0, at: Date.now(), conns: 0 });
    broadcast(r);
    return json(res, { pid: id });
  }
  if (path === '/api/act') return json(res, act(r, b));
  json(res, { error: 'unknown' }, 404);
});

setInterval(() => {
  for (const [, r] of rooms)
    if (r.clients.size === 0 && Date.now() - r.last > 30 * 60 * 1000) closeRoom(r, 'idle');
}, 300000);

server.listen(PORT, '0.0.0.0', () => {
  console.log('\nHand Cricket is running!\n');
  console.log('  Host a game:        http://localhost:' + PORT + '/host');
  const urls = lanUrls();
  if (urls.length) console.log('  Players join at:    ' + urls.join('  or  '));
  console.log('\n  Everyone must be on the same Wi-Fi. Press Ctrl+C to stop.\n');
});
