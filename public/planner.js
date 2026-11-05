(function(){
"use strict";
const KINDS={work:"Work",family:"Family",admin:"Admin",me:"Me time"};
const DAYN=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONL=["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYL=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const S={work:{start:"09:00",end:"16:00"},view:"home",cur:new Date(),tasks:[],blocks:[],routines:[],lead:10,alertsHere:false,devices:0};
S.cur.setHours(0,0,0,0);

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const fromYmd=s=>{const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c)};
const wd=d=>((d.getDay()+6)%7)+1; // Mon=1..Sun=7
const toMin=t=>{const[h,m]=(t||"0:0").split(":").map(Number);return h*60+m};
const hm=m=>pad(Math.floor(m/60))+":"+pad(m%60);
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const fmt=(d,o)=>{o=o||{};const p=[];if(o.weekday)p.push(o.weekday==="long"?DAYL[wd(d)-1]:DAYN[wd(d)-1]);if(o.day)p.push(d.getDate());if(o.month)p.push(o.month==="long"?MONL[d.getMonth()]:MON[d.getMonth()]);return p.join(" ")};
const shortD=ds=>fmt(fromYmd(ds),{weekday:"short",day:1,month:"short"});
const todayStr=()=>ymd(new Date());
const nowMin=()=>{const n=new Date();return n.getHours()*60+n.getMinutes()};
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const inFmt=x=>x<60?x+" min":Math.floor(x/60)+" h"+(x%60?" "+(x%60)+" min":"");
const durFmt=(a,b)=>inFmt(toMin(b)-toMin(a));
const isWorkday=d=>wd(d)<=5;
const reduced=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const strip=r=>{const o={...r};delete o.id;delete o.src;delete o._lane;delete o._lanes;return o};

/* ---------- colours ---------- */
const PALS=[["calm","Calm",["#3B8C7A","#5A9BD5","#C0607A","#A0742A"]],["ocean","Ocean",["#2F7FD8","#21B5A5","#C2557E","#B07A1E"]],["blossom","Blossom",["#7B6CE0","#E77FA0","#3E9B86","#B7802F"]],["collective","Cat Collective",["#D946EF","#8B5CF6","#0C0912","#FCD34D"]]];
function applyPalette(p){
  p=PALS.some(x=>x[0]===p)?p:"calm";
  if(p==="calm")document.documentElement.removeAttribute("data-palette");else document.documentElement.setAttribute("data-palette",p);
  try{localStorage.setItem("palette",p)}catch(_){}
  S.palette=p;
}
try{applyPalette(localStorage.getItem("palette")||"calm")}catch(_){applyPalette("calm")}

/* ---------- line icons (stroke, currentColor) ---------- */
const IC={
 work:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
 family:'<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="9" r="2.5"/><path d="M15.5 14.5A5 5 0 0 1 21 20"/>',
 admin:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
 me:'<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
 task:'<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
 tick:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 focus:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/>',
 repeat:'<path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><path d="M20 4v5h-5"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><path d="M4 20v-5h5"/>',
 clock:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
 cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
 bell:'<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
 note:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
 buffer:'<path d="M6 3h12M6 21h12M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9"/>',
 star:'<path d="M12 4l2.4 5 5.6.8-4 3.9.9 5.5L12 16.6 7.1 19.2l.9-5.5-4-3.9 5.6-.8z"/>',
 sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
 cloud:'<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7z"/>',
 rain:'<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8a3.5 3.5 0 0 0 1 7z"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>',
 storm:'<path d="M7 15h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 8a3.5 3.5 0 0 0 1 7z"/><path d="M12 15l-2 4h3l-2 4"/>',
 fog:'<path d="M4 9h16M3 13h18M5 17h14"/>',
 flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
 list:'<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
 down:'<path d="M6 9l6 6 6-6"/>',
 x:'<path d="M6 6l12 12M18 6L6 18"/>',
};
const ic=(n,c="")=>`<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]||""}</svg>`;
const wxIcon=c=>c===0||c===1?"sun":c===2||c===3?"cloud":c===45||c===48?"fog":c>=95?"storm":c>=51?"rain":"cloud";
const chk=(id,done)=>`<button class="check" data-toggle="${id}" aria-pressed="${!!done}" aria-label="${done?"Mark not done":"Mark done"}"><i>${ic("tick")}</i></button>`;

/* ---------- toast, with optional Undo ---------- */
function toast(msg,undo){
  const t=$("#toast");t.innerHTML=`<span>${esc(msg)}</span>${undo?`<button type="button" id="tUndo">Undo</button>`:""}`;t.hidden=false;
  if(undo)$("#tUndo").onclick=()=>{t.hidden=true;clearTimeout(toast._t);undo()};
  clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,undo?6000:2600);
}
function status(msg){const s=$("#status");s.textContent=msg||"";s.hidden=!msg}

/* ---------- data ---------- */
async function api(body){
  const r=await fetch("/api/data",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  if(r.status===401){location.href="/login";throw new Error("signed out")}
  if(!r.ok){let m="Couldn't save. Check your connection and try again.";try{m=(await r.json()).error||m}catch(_){}throw new Error(m)}
  return r.json();
}
async function save(col,id,data){
  const list=S[col],i=list.findIndex(x=>x.id===id),rec={...data,id};
  if(i>=0)list[i]=rec;else list.push(rec);
  render();
  const body={...data};delete body.id;
  try{await api({op:"set",col,id,data:body})}catch(e){toast(e.message);load()}
}
async function remove(col,id){
  S[col]=S[col].filter(x=>x.id!==id);render();
  try{await api({op:"delete",col,id})}catch(e){toast(e.message);load()}
}
function itemsFor(ds){
  const w=wd(fromYmd(ds));
  const b=S.blocks.filter(x=>x.date===ds).map(x=>({...x,src:"blocks"}));
  const r=S.routines.filter(x=>(x.days||[]).includes(w)&&(!x.from||ds>=x.from)&&(!x.until||ds<=x.until)&&!(x.skips||[]).includes(ds)).map(x=>({...x,src:"routines",date:ds}));
  return b.concat(r).sort((a,b)=>toMin(a.start)-toMin(b.start));
}
const tasksDue=ds=>S.tasks.filter(t=>t.date===ds);
const deadlinesFor=ds=>S.tasks.filter(t=>t.for===ds&&t.date!==ds);
const topFor=ds=>S.tasks.filter(t=>t.priority==="top"&&(t.date===ds||(ds===todayStr()&&t.date&&t.date<ds&&!t.done))).slice(0,3);

/* ---------- time maths ---------- */
function busy(ds){const r=itemsFor(ds).map(i=>[toMin(i.start),toMin(i.end)+(i.buffer||0)]).sort((a,b)=>a[0]-b[0]),m=[];r.forEach(x=>{const l=m[m.length-1];if(l&&x[0]<=l[1])l[1]=Math.max(l[1],x[1]);else m.push([...x])});return m}
function freeWork(ds){const ws=toMin(S.work.start),we=toMin(S.work.end);let free=we-ws;busy(ds).forEach(([a,b])=>{free-=Math.max(0,Math.min(b,we)-Math.max(a,ws))});return Math.max(0,free)}
function firstGap(ds,mins){const ws=toMin(S.work.start),we=toMin(S.work.end);let t=ws;if(ds===todayStr())t=Math.max(t,Math.ceil(nowMin()/15)*15);for(const[a,b]of busy(ds)){if(a-t>=mins&&t+mins<=we)return t;t=Math.max(t,b)}return t+mins<=we?t:null}
function ratio(){const d=S.tasks.filter(t=>t.mins&&t.actual);if(d.length<3)return 1;const r=d.reduce((a,t)=>a+t.actual/t.mins,0)/d.length;return Math.max(.5,Math.min(3,r))}
const REMINDS=[["d","Default"],[-1,"None"],[0,"At start"],[5,"5 min"],[15,"15 min"],[30,"30 min"],[60,"1 h"],[120,"2 h"],[1440,"1 day"]];
const REMINDS2=[["n","None"],[0,"At start"],[5,"5 min"],[15,"15 min"],[30,"30 min"],[60,"1 h"],[1440,"1 day"]];
const remindLabel=r=>r===undefined||r===null?`${S.lead} min before`:r<0?"No reminder":r===0?"At start":r>=1440?(r/1440)+" day"+(r>1440?"s":"")+" before":r>=60?(r/60)+" h before":r+" min before";

/* ---------- header ---------- */
function greet(h){return h<12?"Good morning":h<17?"Good afternoon":"Good evening"}
function renderHeader(){
  document.querySelectorAll(".tabs button").forEach(b=>b.setAttribute("aria-current",b.dataset.v===S.view?"page":"false"));
  const c=S.cur,n=new Date();let sub="",main="";
  if(S.view==="home"){sub=fmt(n,{weekday:"long",day:1,month:"long"});main=greet(n.getHours())+", Cat"}
  else if(S.view==="day"){const t=new Date();t.setHours(0,0,0,0);const diff=Math.round((c-t)/864e5);sub=diff===0?"Today":diff===1?"Tomorrow":diff===-1?"Yesterday":DAYL[wd(c)-1];main=fmt(c,{weekday:"short",day:1,month:"short"})}
  else if(S.view==="week"){const m=addDays(c,1-wd(c)),s=addDays(m,6);sub="Week";main=fmt(m,{day:1,month:"short"})+" to "+fmt(s,{day:1,month:"short"})}
  else if(S.view==="month"){sub=String(c.getFullYear());main=MONL[c.getMonth()]}
  else if(S.view==="tasks"){sub=fmt(n,{weekday:"long",day:1,month:"long"});main="Tasks"}
  else{sub="Repeats every week";main="Routines"}
  $("#dsub").textContent=sub;$("#dmain").textContent=main;
  const nav=S.view==="day"||S.view==="week"||S.view==="month";
  const onNow=(S.view==="day"&&ymd(c)===todayStr())||(S.view==="week"&&ymd(addDays(c,1-wd(c)))===ymd(addDays(n,1-wd(n))))||(S.view==="month"&&c.getMonth()===n.getMonth()&&c.getFullYear()===n.getFullYear());
  $("#prev").hidden=!nav;$("#next").hidden=!nav;$("#todayBtn").hidden=!nav||onNow;
  const fab=$("#fab");fab.hidden=S.view==="home";
  fab.setAttribute("aria-label",{tasks:"Add task",routines:"Add routine"}[S.view]||"Add time block");
}

/* ---------- shared day list: one-offs in full, routines as one compact strip ---------- */
function dayList(ds,its,tasks,dl){
  const one=its.filter(i=>i.src!=="routines"),rt=its.filter(i=>i.src==="routines");
  let h=one.map(it=>`<button class="wi k-${it.kind||"work"}" data-open="${it.src}:${it.id}:${ds}"><span class="tm">${it.start}–${it.end}</span>${ic(it.kind||"work","ki")}<span class="tt">${esc(it.title)}</span></button>`).join("");
  h+=(tasks||[]).map(t=>`<button class="wi" data-open="tasks:${t.id}" aria-label="${t.priority==="top"?"Top 3 task":"Task"}: ${esc(t.title)}"><span class="tm"></span>${ic(t.priority==="top"?"star":"task","ki")}<span class="tt ${t.done?"strike":""}">${esc(t.title)}</span></button>`).join("");
  h+=(dl||[]).map(t=>`<button class="wi dl" data-open="tasks:${t.id}"><span class="tm"></span>${ic("flag","ki")}<span class="tt ${t.done?"strike":""}">${esc(t.title)}<span class="sub"><b>Deadline</b> · ${t.done?"done":"do by "+(t.date?shortD(t.date):"any day")}</span></span></button>`).join("");
  if(rt.length)h+=`<div class="rstrip">${rt.map(it=>`<button class="rchip k-${it.kind||"work"}" data-open="routines:${it.id}:${ds}">${ic("repeat")}<span>${it.start}</span>${esc(it.title)}</button>`).join("")}</div>`;
  return h||`<div class="wi none">Nothing planned</div>`;
}
function top3Html(ds,withSteps){
  const top=topFor(ds),nDone=top.filter(t=>t.done).length;
  let h=`<section class="sec"><div class="sech"><h2>${ic("star")}Top 3${ds===todayStr()||S.view==="home"?"":" for "+fmt(fromYmd(ds),{weekday:"long"})}</h2>${top.length?`<span class="cnt ${nDone===top.length?"all":""}">${nDone} of ${top.length} done</span>`:""}</div><div class="top3">`;
  h+=top.map((t,i)=>{const st=t.steps||[];return `<div class="t3 ${t.done?"done":""}">${chk(t.id,t.done)}<span class="n">${i+1}</span><button class="t3b" data-open="tasks:${t.id}">${esc(t.title)}${withSteps&&st.length?`<small>${st.filter(x=>x.done).length} of ${st.length} steps</small>`:""}</button></div>`}).join("");
  if(top.length<3)h+=`<button class="addline" data-addtop="${ds}">${ic("plus")}Add a Top 3 task</button>`;
  return h+`</div></section>`;
}

/* ---------- home ---------- */
const WX={0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",66:"Freezing rain",67:"Freezing rain",71:"Light snow",73:"Snow",75:"Heavy snow",80:"Showers",81:"Showers",82:"Heavy showers",95:"Thunderstorms",96:"Thunderstorms",99:"Thunderstorms"};
S.wx=null;
async function loadWeather(force){
  if(S.wx&&!force&&Date.now()-S.wx.at<15*60000)return;
  try{const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude=-33.9249&longitude=18.4241&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Africa%2FJohannesburg&forecast_days=1");
    if(!r.ok)throw 0;const j=await r.json();
    S.wx={at:Date.now(),t:Math.round(j.current.temperature_2m),code:j.current.weather_code,wind:Math.round(j.current.wind_speed_10m),hi:Math.round(j.daily.temperature_2m_max[0]),lo:Math.round(j.daily.temperature_2m_min[0]),rain:j.daily.precipitation_probability_max[0]};
  }catch(_){S.wx={at:Date.now(),err:1}}
  if(S.view==="home"&&!$("#sheetRoot").innerHTML)renderHome();
}
function upcomingAlerts(ds){
  // Alerts that fire later today, including advance ones for events on later days.
  const m=nowMin(),out=[],base=fromYmd(ds);
  for(let d=0;d<8;d++){const day=ymd(addDays(base,d));itemsFor(day).forEach(it=>{[it.remind??S.lead,it.remind2].forEach(r=>{if(typeof r!=="number"||r<0)return;const at=d*1440+toMin(it.start)-r;if(at>=m&&at<24*60)out.push({at,it,r,day,d})})})}
  return out.sort((a,b)=>a.at-b.at).slice(0,5);
}
function renderHome(){
  const n=new Date(),ds=todayStr(),m=nowMin();
  let wx;
  if(!S.wx)wx=`<div class="wx"><span class="mut">Loading Cape Town weather</span></div>`;
  else if(S.wx.err)wx=`<div class="wx"><span class="mut">Cape Town weather unavailable</span></div>`;
  else wx=`<div class="wx">${ic(wxIcon(S.wx.code),"wxi")}<b>${S.wx.t}°</b><span class="wxd">${WX[S.wx.code]||""}</span><span class="wxm">Cape Town · high ${S.wx.hi}°, low ${S.wx.lo}° · rain&nbsp;${S.wx.rain??0}% · wind&nbsp;${S.wx.wind}&nbsp;km/h</span></div>`;
  let day="";
  if(isWorkday(n)){const ws=toMin(S.work.start),we=toMin(S.work.end),pct=Math.max(0,Math.min(100,Math.round((m-ws)/(we-ws)*100))),fw=freeWork(ds);
    day=`<div class="dayp"><div class="dpl"><span>Work day · ${m<ws?"starts "+S.work.start:m>=we?"finished":inFmt(we-m)+" left"}</span><span>${m>=we?"":(fw?inFmt(fw)+" free":"fully booked")}</span></div><div class="bar"><span style="width:${pct}%"></span></div></div>`}
  let h=`<section class="card hstrip">${wx}${day}</section>`;
  h+=nowNext(ds);
  h+=top3Html(ds,false);
  h+=`<div class="qa sec"><button data-qa="block">${ic("plus")}Block</button><button data-qa="task">${ic("task")}Task</button><button data-qa="focus">${ic("focus")}Focus</button><button data-qa="routines">${ic("repeat")}Routines</button></div>`;
  const tm=addDays(n,1),tds=ymd(tm),tIts=itemsFor(tds),tTasks=tasksDue(tds).filter(t=>!t.done),tDl=deadlinesFor(tds).filter(t=>!t.done);
  h+=`<section class="sec"><div class="sech"><h2>${ic("cal")}Tomorrow</h2><button class="ghost sm" data-goday="${tds}">${fmt(tm,{weekday:"short",day:1,month:"short"})}</button></div>`+(tIts.length||tTasks.length||tDl.length?`<div class="wd">${dayList(tds,tIts,tTasks,tDl)}</div>`:`<div class="empty">Nothing planned</div>`)+`</section>`;
  const al=upcomingAlerts(ds);
  h+=`<section class="sec"><div class="sech"><h2>${ic("bell")}Reminders today</h2></div>`+(al.length?`<div class="wd">${al.map(a=>`<button class="wi k-${a.it.kind||"work"}" data-open="${a.it.src}:${a.it.id}:${a.day}"><span class="tm">${hm(a.at)}</span>${ic("bell","ki")}<span class="tt">${esc(a.it.title)}<span class="sub">${a.d?`${a.d===1?"Tomorrow":shortD(a.day)} at ${a.it.start}`:(a.r===0?"At the start":inFmt(a.r)+" before it starts")}</span></span></button>`).join("")}</div>`:`<div class="empty">No more reminders today</div>`)+(S.alertsHere?"":`<p class="mut small">Phone alerts are off on this device. <button class="wmore" style="display:inline-flex;min-height:32px" data-settings>Turn them on</button></p>`)+`</section>`;
  $("#view").innerHTML=h;
  loadWeather();
}

/* ---------- now / next ---------- */
function nowNext(ds){
  const m=nowMin(),its=itemsFor(ds);
  const cur=its.filter(i=>toMin(i.start)<=m&&toMin(i.end)>m).pop(),nxt=its.find(i=>toMin(i.start)>m);
  const head=(lab,icn)=>`<span class="lb">${ic(icn)}${lab}</span>`;
  let a,b;
  if(cur){const s0=toMin(cur.start),e0=toMin(cur.end),pct=Math.max(0,Math.min(100,Math.round((m-s0)/(e0-s0)*100)));
    a=`<div class="k-${cur.kind||"work"}" data-open="${cur.src}:${cur.id}:${ds}">${head("Now","clock")}<span class="when">${cur.start}–${cur.end}</span><b>${esc(cur.title)}</b><div class="left"><div class="bar"><span style="width:${pct}%"></span></div><span class="lt">${inFmt(e0-m)} left</span></div><button class="fbtn" data-focus="${cur.src}:${cur.id}:${ds}" type="button">${ic("focus")}Focus</button></div>`}
  else a=`<div>${head("Now","clock")}<b class="free">Free time</b></div>`;
  if(nxt)b=`<div class="k-${nxt.kind||"work"}" data-open="${nxt.src}:${nxt.id}:${ds}">${head("Next","bell")}<span class="when">${nxt.start}–${nxt.end}</span><b>${esc(nxt.title)}</b><span class="rel">Starts in ${inFmt(toMin(nxt.start)-m)}</span></div>`;
  else b=`<div>${head("Next","bell")}<b class="free">Nothing else today</b></div>`;
  return `<div class="nn">${a}${b}</div>`;
}

/* ---------- today ---------- */
function layoutLanes(items){
  const out=[];let cluster=[],clusterEnd=-1;
  const flush=()=>{const lanes=[];cluster.forEach(it=>{let l=lanes.findIndex(e=>e<=toMin(it.start));if(l<0){l=lanes.length;lanes.push(0)}lanes[l]=toMin(it.end);it._lane=l});cluster.forEach(it=>it._lanes=lanes.length);out.push(...cluster);cluster=[]};
  items.forEach(it=>{if(toMin(it.start)>=clusterEnd&&cluster.length)flush();cluster.push(it);clusterEnd=Math.max(clusterEnd,toMin(it.end))});
  if(cluster.length)flush();return out;
}
function renderDay(){
  const ds=ymd(S.cur),isToday=ds===todayStr(),work=isWorkday(S.cur);
  const dayTasks=S.tasks.filter(t=>t.date===ds||(isToday&&t.date&&t.date<ds&&!t.done));
  let h=isToday?nowNext(ds):"";
  h+=top3Html(ds,true);
  const other=dayTasks.filter(t=>t.priority!=="top"),dls=deadlinesFor(ds);
  if(other.length||dls.length)h+=`<section class="sec"><div class="sech"><h2>${ic("task")}Also ${isToday?"today":"this day"}</h2></div><div class="wd">${dayList(ds,[],other,dls)}</div></section>`;
  const raw=itemsFor(ds),items=layoutLanes(raw),nm=nowMin();
  let sH=Math.min(7,Math.floor(toMin(S.work.start)/60)),eH=Math.max(18,Math.ceil(toMin(S.work.end)/60));
  raw.forEach(i=>{sH=Math.min(sH,Math.floor(toMin(i.start)/60));eH=Math.max(eH,Math.ceil(toMin(i.end)/60))});
  if(isToday){sH=Math.min(sH,new Date().getHours());eH=Math.max(eH,new Date().getHours()+1)}
  sH=Math.max(0,sH);eH=Math.min(24,eH);
  const ppm=1.4,height=(eH-sH)*60*ppm,y=m=>(m-sH*60)*ppm;
  let rail="",grid="";
  for(let hr=sH;hr<=eH;hr++){const top=y(hr*60);rail+=`<span style="top:${top}px">${pad(hr%24)}:00</span>`;grid+=`<div class="hr" style="top:${top}px"></div>`;
    if(hr<eH)grid+=`<div class="hr half" style="top:${y(hr*60+30)}px"></div><button class="slot" data-slot="${pad(hr)}:00" style="top:${top}px;height:${30*ppm}px" aria-label="Add block at ${pad(hr)}:00"></button><button class="slot" data-slot="${pad(hr)}:30" style="top:${y(hr*60+30)}px;height:${30*ppm}px" aria-label="Add block at ${pad(hr)}:30"></button>`}
  {const ws=toMin(S.work.start),we=toMin(S.work.end);if(ws>sH*60)grid+=`<div class="off" style="top:0;height:${y(ws)}px"></div>`;if(we<eH*60)grid+=`<div class="off" style="top:${y(we)}px;height:${y(eH*60)-y(we)}px"></div>`;if(work)grid+=`<span class="wl" style="top:${y(ws)}px">Work day starts</span><span class="wl" style="top:${y(we)}px">Work day ends</span>`}
  items.forEach(it=>{if(!it.buffer)return;const bs=toMin(it.end),be=Math.min(bs+it.buffer,eH*60);if(be>bs)grid+=`<div class="buf" style="top:${y(bs)+1}px;height:${(be-bs)*ppm-2}px"><span>Buffer ${it.buffer} min</span></div>`});
  items.forEach(it=>{const s=Math.max(toMin(it.start),sH*60),e=Math.min(Math.max(toMin(it.end),s+15),eH*60);if(e<=s)return;
    const w=100/it._lanes,ht=(e-s)*ppm-2,short=ht<60,isR=it.src==="routines";
    grid+=`<button class="blk k-${it.kind||"work"} ${isR?"rt":""} ${short?"short":""}" data-open="${it.src}:${it.id}:${ds}" style="top:${y(s)+1}px;height:${ht}px;left:calc(${w*it._lane}% + 4px);width:calc(${w}% - 8px)"><b>${ic(isR?"repeat":(it.kind||"work"),"bi")}${esc(it.title)}</b><span class="tm">${it.start}${short?"":"–"+it.end}</span></button>`});
  if(isToday&&nm>=sH*60&&nm<=eH*60)grid+=`<div class="now" style="top:${y(nm)}px"></div>`;
  const fw=freeWork(ds),need=dayTasks.filter(t=>!t.done&&t.mins&&!S.blocks.some(b=>b.taskId===t.id&&b.date===ds)).reduce((a,t)=>a+Math.round(t.mins*ratio()),0);
  h+=`<section class="sec"><div class="sech"><h2>${ic("clock")}Plan</h2><span class="cnt">${work?(fw?inFmt(fw)+" free in work day":"Work day fully booked"):"Day off"}</span></div>`;
  if(work&&need>fw)h+=`<div class="over"><b>Too much for one day</b><span>Tasks need about ${inFmt(need)}, you have ${fw?inFmt(fw):"no time"} free.</span></div>`;
  h+=`<div class="tl" style="height:${height}px;margin-top:14px"><div class="rail">${rail}</div><div class="grid">${grid}</div></div></section>`;
  $("#view").innerHTML=h;
  if(isToday&&!renderDay._scrolled){renderDay._scrolled=true;const el=document.querySelector(".tl");if(el){const top=el.getBoundingClientRect().top+scrollY+y(Math.max(nm-60,sH*60))-180;if(top>200)scrollTo({top})}}
}

/* ---------- week ---------- */
function renderWeek(){
  const mo=addDays(S.cur,1-wd(S.cur));let h=`<div class="week" style="margin-top:14px">`;
  for(let i=0;i<7;i++){const d=addDays(mo,i),ds=ymd(d),its=itemsFor(ds);
    const all=[...tasksDue(ds).filter(t=>!t.done).sort((a,b)=>(a.priority==="top"?0:1)-(b.priority==="top"?0:1)).map(t=>({t,k:"task"})),...deadlinesFor(ds).filter(t=>!t.done).map(t=>({t,k:"dl"}))];
    const open=S.wOpen&&S.wOpen[ds],list=open?all:all.slice(0,2),more=all.length-2;
    const evn=its.filter(x=>x.src!=="routines").length,parts=[evn&&`${evn} event${evn>1?"s":""}`,all.length&&`${all.length} task${all.length>1?"s":""}`].filter(Boolean).join(" · ");
    h+=`<section class="wd ${ds===todayStr()?"today":""}"><button class="wh" data-goday="${ds}"><span class="d">${fmt(d,{weekday:"short",day:1,month:"short"})}</span><span class="c">${ds===todayStr()?"Today":parts}</span></button>`;
    h+=dayList(ds,its,list.filter(x=>x.k==="task").map(x=>x.t),list.filter(x=>x.k==="dl").map(x=>x.t));
    if(more>0)h+=`<button class="wmore" data-wmore="${ds}">${open?"Show less":`Show ${more} more task${more>1?"s":""}`}</button>`;
    h+=`</section>`}
  $("#view").innerHTML=h+"</div>";
}

/* ---------- month ---------- */
function renderMonth(){
  const first=new Date(S.cur.getFullYear(),S.cur.getMonth(),1),start=addDays(first,1-wd(first)),td=todayStr();
  const inMonth=ds=>fromYmd(ds).getMonth()===first.getMonth();
  if(S.sel&&!inMonth(S.sel))S.sel=null;
  const dayInfo=ds=>({ev:itemsFor(ds).filter(x=>x.src!=="routines"),tk:S.tasks.filter(t=>t.date===ds&&!t.done),dl:S.tasks.filter(t=>t.for===ds&&t.date!==ds&&!t.done)});
  let h=`<div class="mgrid"><div class="mhead">${DAYN.map((d,i)=>`<span class="${i>4?"we":""}">${d.slice(0,2)}</span>`).join("")}</div><div class="mdays">`;
  for(let i=0;i<42;i++){const d=addDays(start,i),ds=ymd(d);if(i>=35&&d.getMonth()!==first.getMonth())break;
    const {ev,tk,dl}=dayInfo(ds),hol=ev.find(x=>/^Public holiday/i.test(x.title));
    const bars=[...ev.filter(x=>x!==hol).map(x=>`<i class="k-${x.kind||"work"}"></i>`),...dl.map(()=>`<i class="bdl"></i>`),...tk.map(()=>`<i class="btk"></i>`)];
    const label=[ev.length&&`${ev.length} event${ev.length>1?"s":""}`,tk.length&&`${tk.length} task${tk.length>1?"s":""}`,dl.length&&`${dl.length} deadline${dl.length>1?"s":""}`].filter(Boolean).join(", ")||"nothing planned";
    h+=`<button class="mday ${inMonth(ds)?"":"out"} ${wd(d)>5?"we":""} ${ds===td?"today":""} ${ds===S.sel?"sel":""} ${hol?"hol":""}" data-sel="${ds}" aria-label="${fmt(d,{weekday:"long",day:1,month:"long"})}: ${hol?esc(hol.title)+", ":""}${label}"><span class="num">${d.getDate()}</span><span class="bars">${bars.slice(0,3).join("")}</span>${bars.length>3?`<span class="bmore">+${bars.length-3}</span>`:""}</button>`}
  h+=`</div><div class="mleg" aria-hidden="true">${Object.entries(KINDS).map(([k,v])=>`<span class="k-${k}"><i></i>${v}</span>`).join("")}<span><i class="btk"></i>Task</span><span><i class="bdl"></i>Deadline</span></div></div>`;
  // Always-open list: every day in this month (from today if it's the current month) that has something on.
  const now=new Date(),lastDay=new Date(first.getFullYear(),first.getMonth()+1,0).getDate(),fromDay=(first.getMonth()===now.getMonth()&&first.getFullYear()===now.getFullYear())?now.getDate():1;
  let list="";
  for(let dd=fromDay;dd<=lastDay;dd++){const d=new Date(first.getFullYear(),first.getMonth(),dd),ds=ymd(d),{ev,tk,dl}=dayInfo(ds);if(!ev.length&&!tk.length&&!dl.length)continue;
    list+=`<section class="wd mag ${ds===S.sel?"selday":""} ${ds===td?"today":""}" id="mag-${ds}"><button class="wh" data-goday="${ds}"><span class="d">${fmt(d,{weekday:"short",day:1,month:"short"})}</span><span class="c">${ds===td?"Today":""}</span></button>${dayList(ds,ev,tk,dl)}</section>`}
  h+=`<section class="sec"><div class="sech"><h2>${ic("list")}${fromDay>1?"Still to come in ":""}${MONL[first.getMonth()]}</h2></div>`+(list?`<div class="week">${list}</div>`:`<div class="empty">Nothing planned</div>`)+`</section>`;
  $("#view").innerHTML=h;
  if(S.sel){const el=document.getElementById("mag-"+S.sel);if(el)el.scrollIntoView({behavior:reduced()?"auto":"smooth",block:"center"});else toast("Nothing planned on "+shortD(S.sel))}
}

/* ---------- tasks ---------- */
function taskRow(t){
  const td=todayStr(),due=t.date?(t.date===td?"Today":t.date<td&&!t.done?"Carried over from "+fmt(fromYmd(t.date),{weekday:"short"}):shortD(t.date)):"No date";
  const st=t.steps||[],sd=st.filter(x=>x.done).length,est=t.mins?(t.actual?` · est ${t.mins} min, took ${t.actual}`:` · ${t.mins} min`):(t.actual?` · took ${t.actual} min`:"");
  return `<div class="row ${t.done?"done":""}">${chk(t.id,t.done)}<button class="tt" data-open="tasks:${t.id}"><div>${t.priority==="top"?ic("star","star"):""}${esc(t.title)}${t.example?'<span class="ex">Example</span>':""}</div><div class="meta">${due}${t.for?` · for ${shortD(t.for)}`:""}${est}${st.length?` · ${sd} of ${st.length} steps`:""}</div></button>${t.done?"":`<button class="plan" data-plan="${t.id}">Block it</button>`}</div>`;
}
function renderTasks(){
  const td=todayStr(),open=S.tasks.filter(t=>!t.done),done=S.tasks.filter(t=>t.done);
  const byP=(a,b)=>(a.priority==="top"?0:1)-(b.priority==="top"?0:1)||(a.date||"9").localeCompare(b.date||"9");
  const today=open.filter(t=>t.date&&t.date<=td).sort(byP),later=open.filter(t=>t.date&&t.date>td).sort(byP),inbox=open.filter(t=>!t.date).sort(byP);
  const sec=(name,icn,list,empty)=>`<section class="sec"><div class="sech"><h2>${ic(icn)}${name}</h2>${list.length?`<span class="cnt">${list.length}</span>`:""}</div>`+(list.length?`<div class="list">${list.map(taskRow).join("")}</div>`:`<div class="empty">${empty}</div>`)+`</section>`;
  let h=`<form class="quick" id="quick" style="margin-top:14px"><input id="quickIn" placeholder="Add a task to your Inbox" autocomplete="off" aria-label="New task"><button type="submit">Add</button></form>`;
  h+=sec("Today","cal",today,"Nothing due")+sec("Inbox","task",inbox,"Empty")+sec("Coming up","list",later,"Nothing coming up");
  if(done.length)h+=`<details class="done-list"><summary>Done (${done.length})</summary><div class="list">${done.map(taskRow).join("")}</div></details>`;
  $("#view").innerHTML=h;
}

/* ---------- routines ---------- */
function dayLabel(days){days=[...(days||[])].sort();if(days.length===7)return"Every day";if(days.join()==="1,2,3,4,5")return"Weekdays";if(days.join()==="6,7")return"Weekends";return days.map(d=>DAYN[d-1]).join(", ")}
function renderRoutines(){
  const list=[...S.routines].sort((a,b)=>toMin(a.start)-toMin(b.start));
  let h=`<section class="sec"><div class="sech"><h2>${ic("repeat")}Every week</h2></div>`;
  h+=list.length?`<div class="list">${list.map(r=>`<div class="row kb k-${r.kind||"work"}"><button class="tt" data-open="routines:${r.id}"><div>${esc(r.title)}${r.example?'<span class="ex">Example</span>':""}</div><div class="meta">${r.start}–${r.end} · ${dayLabel(r.days)}${r.until?(r.until<todayStr()?" · ended":" · until "+fmt(fromYmd(r.until),{day:1,month:"short"})+" "+r.until.slice(0,4)):""}</div></button><span class="chip">${KINDS[r.kind]||"Work"}</span></div>`).join("")}</div>`:`<div class="empty">No routines yet</div>`;
  $("#view").innerHTML=h+`</section>`;
}

function render(){renderHeader();({home:renderHome,day:renderDay,week:renderWeek,month:renderMonth,tasks:renderTasks,routines:renderRoutines})[S.view]()}

/* ---------- details sheet ---------- */
function closeSheet(){$("#sheetRoot").innerHTML=""}
function sheet(label,inner){
  $("#sheetRoot").innerHTML=`<div class="scrim" id="scrim"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">${inner}</div>`;
  $("#scrim").onclick=closeSheet;
}
function openDetails(col,rec,date){
  const isR=col==="routines",isT=col==="tasks",d=date?fromYmd(date):null,rows=[];
  const long=ds=>fmt(fromYmd(ds),{weekday:"long",day:1,month:"long"});
  if(isT){if(rec.for)rows.push(["For",long(rec.for)]);rows.push(["Due",rec.date?long(rec.date):"No date"]);if(rec.priority==="top")rows.push(["Priority","Top 3"]);
    if(rec.mins||rec.actual)rows.push(["Time",(rec.mins?`Estimate ${rec.mins} min`:"")+(rec.actual?`${rec.mins?" · ":""}took ${rec.actual} min`:"")+(rec.mins&&ratio()!==1&&!rec.actual?` · likely ${Math.round(rec.mins*ratio())} min`:"")])}
  else{if(d)rows.push(["When",fmt(d,{weekday:"long",day:1,month:"long"})]);
    rows.push(["Time",`${rec.start}–${rec.end} · ${durFmt(rec.start,rec.end)}`]);
    if(isR)rows.push(["Repeats",dayLabel(rec.days)+(rec.until?` · until ${fmt(fromYmd(rec.until),{day:1,month:"short"})} ${rec.until.slice(0,4)}`:"")]);
    rows.push(["Reminder",remindLabel(rec.remind)+(typeof rec.remind2==="number"?" and "+remindLabel(rec.remind2):"")]);
    if(rec.buffer)rows.push(["Buffer",rec.buffer+" min after"])}
  if(rec.notes)rows.push(["Notes",esc(rec.notes).replace(/\n/g,"<br>")]);
  const ICN={For:"flag",Due:"cal",When:"cal",Time:"clock",Repeats:"repeat",Reminder:"bell",Buffer:"buffer",Notes:"note",Priority:"star"};
  const steps=rec.steps||[],skipped=isR&&date&&(rec.skips||[]).includes(date);
  const stepsHtml=steps.length?`<div class="steps"><div class="sh"><span class="lb">Steps</span><span class="cnt">${steps.filter(x=>x.done).length} of ${steps.length}</span></div>${steps.map((x,i)=>`<label class="step ${x.done?"done":""}"><input type="checkbox" data-step="${i}" ${x.done?"checked":""}><span>${esc(x.text)}</span></label>`).join("")}</div>`:"";
  const kind=rec.kind||(isT?"admin":"work");
  sheet(rec.title,`<div class="in"><div class="dhead k-${kind}"><span class="chip">${ic(isT?"task":isR?"repeat":kind)}${isT?(rec.priority==="top"?"Top 3 task":"Task"):(KINDS[rec.kind]||"Work")+(isR?" · repeats":"")}</span><h3 class="${isT&&rec.done?"strike":""}">${esc(rec.title)}</h3></div>
    <dl class="dl">${rows.map(([k,v])=>`<dt>${ic(ICN[k]||"note")}${k}</dt><dd>${v}</dd>`).join("")}</dl>${stepsHtml}
    <div class="acts">${isT?`<button class="ghost" id="dDone" type="button">${ic(rec.done?"x":"tick")} ${rec.done?"Not done":"Mark done"}</button>`:""}<button class="ghost" id="dEdit" type="button">Edit</button>${isR&&date?`<button class="ghost" id="dSkip" type="button">${skipped?"Bring back this day":"Skip this day"}</button>`:""}</div>
    <div class="acts sticky">${!(isT&&rec.done)?`<button class="primary" id="dFocus" type="button">${ic("focus")}Focus</button>`:""}<button class="ghost" id="dClose" type="button">Close</button></div></div>`);
  $("#dClose").onclick=closeSheet;
  $("#dEdit").onclick=()=>openSheet(col,rec,{});
  const fo=$("#dFocus");if(fo)fo.onclick=()=>startFocus(col,rec,date);
  const dn=$("#dDone");if(dn)dn.onclick=()=>{toggleTask(rec);closeSheet()};
  document.querySelectorAll("[data-step]").forEach(cb=>cb.onchange=()=>{const st=(rec.steps||[]).map(x=>({...x}));st[+cb.dataset.step].done=cb.checked;const nr={...rec,steps:st};save(col,rec.id,strip(nr));openDetails(col,S[col].find(x=>x.id===rec.id)||nr,date);if(cb.checked&&st.every(x=>x.done))cheer("All steps done")});
  const sk=$("#dSkip");if(sk)sk.onclick=()=>{const set=new Set(rec.skips||[]);skipped?set.delete(date):set.add(date);const before=strip(rec);save("routines",rec.id,{...before,skips:[...set]});closeSheet();toast(skipped?"Back on for that day":"Skipped for that day",()=>save("routines",rec.id,before))};
}

/* ---------- 24-hour time picker ---------- */
function tp(id,val,label){
  const [h,m]=(val||"09:00").split(":");const mins=["00","15","30","45"];if(!mins.includes(m))mins.push(m),mins.sort();
  return `<div class="f"><span class="lb" id="${id}L">${label}</span><div class="tp" id="${id}" role="group" aria-labelledby="${id}L"><select data-h aria-label="${label} hour">${Array.from({length:24},(_,i)=>`<option ${pad(i)===h?"selected":""}>${pad(i)}</option>`).join("")}</select><b>:</b><select data-m aria-label="${label} minutes">${mins.map(x=>`<option ${x===m?"selected":""}>${x}</option>`).join("")}</select></div></div>`;
}
const tpv=id=>{const g=$("#"+id);return g.querySelector("[data-h]").value+":"+g.querySelector("[data-m]").value};
const tpset=(id,v)=>{const g=$("#"+id),[h,m]=v.split(":"),ms=g.querySelector("[data-m]");g.querySelector("[data-h]").value=h;if(![...ms.options].some(o=>o.value===m))ms.add(new Option(m,m));ms.value=m};
// Moving the start keeps the length the same.
function linkTimes(a,b){let dur=toMin(tpv(b))-toMin(tpv(a));$("#"+a).onchange=()=>{const s=toMin(tpv(a));tpset(b,hm(Math.min(s+Math.max(dur,15),23*60+45)))};$("#"+b).onchange=()=>{dur=toMin(tpv(b))-toMin(tpv(a))}}

/* ---------- add / edit sheet ---------- */
const optsHtml=(id,items,cur,attr)=>`<div class="opts" id="${id}">${items.map(([v,l])=>`<button type="button" data-${attr}="${v}" aria-pressed="${String(v)===String(cur)}">${l}</button>`).join("")}</div>`;
const picked=(id,attr,def)=>{const b=document.querySelector(`#${id} [aria-pressed="true"]`);return b?b.dataset[attr]:def};
function openSheet(type,rec,preset){
  const isNew=!rec;rec=rec||{};preset=preset||{};
  const noun={blocks:"time block",tasks:"task",routines:"routine"}[type];
  const kind=rec.kind||preset.kind||"work";
  const kindOpts=`<div class="f"><span class="lb">Type</span>${optsHtml("fKind",Object.entries(KINDS),kind,"k")}</div>`;
  let main=`<div class="f"><label for="fTitle">What</label><input id="fTitle" value="${esc(rec.title||preset.title||"")}" placeholder="${type==="tasks"?"e.g. Send Virlocept proposal":type==="routines"?"e.g. School pickup":"e.g. Client call"}" autocomplete="off"></div>`;
  let more="",moreNote="",moreOpen=false;
  if(type==="blocks"){
    const st=rec.start||preset.start||"09:00",en=rec.end||preset.end||hm(Math.min(toMin(st)+60,23*60+45));
    main+=`<div class="f"><label for="fDate">Day</label><input id="fDate" type="date" value="${rec.date||preset.date||ymd(S.cur)}"></div><div class="two">${tp("fStart",st,"Start")}${tp("fEnd",en,"End")}</div>`+kindOpts;
  }else if(type==="tasks"){
    const pri=(rec.priority||preset.priority)==="top"?"top":"normal";
    main+=`<div class="f"><label for="fDate">Do by <span class="opt">(optional)</span></label><input id="fDate" type="date" value="${rec.date||preset.date||""}"></div><div class="f"><span class="lb">Priority</span>${optsHtml("fPri",[["top","Top 3"],["normal","Normal"]],pri,"p")}</div>`;
    more+=`<div class="two"><div class="f"><label for="fFor">For event on</label><input id="fFor" type="date" value="${rec.for||""}"></div><div class="f"><label for="fMins">Minutes</label><input id="fMins" type="number" min="5" step="5" inputmode="numeric" value="${rec.mins||""}" placeholder="e.g. 30"></div></div>`;
    moreNote="Event date, minutes, steps";moreOpen=!!(rec.for||rec.mins||(rec.steps||[]).length);
  }else{
    const days=rec.days||[1,2,3,4,5],st=rec.start||"08:00",en=rec.end||"08:30";
    main+=`<div class="two">${tp("fStart",st,"Start")}${tp("fEnd",en,"End")}</div><div class="f"><span class="lb">Repeats on</span><div class="opts" id="fDays">${DAYN.map((n,i)=>`<button type="button" data-d="${i+1}" aria-pressed="${days.includes(i+1)}">${n}</button>`).join("")}</div></div>`+kindOpts;
    more+=`<div class="f"><label for="fUntil">Repeats until</label><input id="fUntil" type="date" value="${rec.until||""}"></div>`;
    moreOpen=!!rec.until;
  }
  if(type!=="tasks"){
    const cur=rec.remind===undefined||rec.remind===null?"d":String(rec.remind),cur2=typeof rec.remind2==="number"?String(rec.remind2):"n",buf=rec.buffer??preset.buffer??0;
    more+=`<div class="f"><span class="lb">Reminder</span>${optsHtml("fRem",REMINDS.map(([v,l])=>[v,v==="d"?`${l} (${S.lead} min)`:l]),cur,"r")}</div><div class="f"><span class="lb">Second reminder</span>${optsHtml("fRem2",REMINDS2,cur2,"r")}</div><div class="f"><span class="lb">Buffer after</span>${optsHtml("fBuf",[0,10,15,30].map(v=>[v,v?v+" min":"None"]),buf,"b")}</div><div class="f"><label for="fNotes">Notes</label><textarea id="fNotes" rows="3">${esc(rec.notes||"")}</textarea></div>`;
    moreNote=(type==="routines"?"End date, ":"")+"reminders, buffer, notes"+(type==="blocks"?", steps":"");
    moreOpen=moreOpen||cur!=="d"||cur2!=="n"||!!buf||!!rec.notes||(rec.steps||[]).length>0;
  }
  if(type!=="routines")more+=`<div class="f"><span class="lb">Steps</span><div id="fSteps" class="stedit">${(rec.steps||[]).map(x=>`<div class="srow"><input value="${esc(x.text)}" data-done="${x.done?1:0}" aria-label="Step"><button type="button" class="srm" aria-label="Remove step">${ic("x")}</button></div>`).join("")}</div><div class="quick"><input id="fStepIn" placeholder="Add a step" autocomplete="off" aria-label="New step"><button type="button" id="fStepAdd">Add</button></div></div>`;
  sheet(`${isNew?"New":"Edit"} ${noun}`,`<form class="in" id="fForm"><h3>${isNew?"New":"Edit"} ${noun}</h3>${main}
    <details class="more" ${moreOpen?"open":""}><summary><span>More options<small>${moreNote}</small></span>${ic("down")}</summary><div class="in2">${more}</div></details>
    <div class="err" id="fErr" role="alert"></div>
    <div class="acts sticky"><button class="primary" type="submit">${isNew?"Add":"Save"}</button>${isNew?"":`<button type="button" class="danger" id="fDel">Delete</button>`}<button type="button" class="ghost" id="fCancel">Cancel</button></div></form>`);
  const form=$("#fForm");
  if(type!=="tasks")linkTimes("fStart","fEnd");
  const addStep=()=>{const i=$("#fStepIn"),v=i.value.trim();if(!v)return;const r=document.createElement("div");r.className="srow";r.innerHTML=`<input value="${esc(v)}" data-done="0" aria-label="Step"><button type="button" class="srm" aria-label="Remove step">${ic("x")}</button>`;$("#fSteps").appendChild(r);i.value="";i.focus()};
  if($("#fStepAdd")){$("#fStepAdd").onclick=addStep;$("#fStepIn").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();addStep()}};$("#fSteps").onclick=e=>{const b=e.target.closest(".srm");if(b)b.parentElement.remove()}}
  form.querySelectorAll(".opts").forEach(g=>g.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;if(g.id==="fDays")b.setAttribute("aria-pressed",b.getAttribute("aria-pressed")==="true"?"false":"true");else{g.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed","false"));b.setAttribute("aria-pressed","true")}}));
  $("#fCancel").onclick=closeSheet;
  if(!isNew){const del=$("#fDel");del.onclick=()=>{
    if(type==="routines"&&!del.dataset.armed){del.dataset.armed=1;del.textContent="Tap again: deletes every week";return}
    const before=strip(rec);remove(type,rec.id);closeSheet();toast("Deleted",()=>{save(type,rec.id,before);toast("Restored")})}}
  setTimeout(()=>{if(isNew)$("#fTitle").focus()},60);
  form.onsubmit=e=>{e.preventDefault();const err=$("#fErr");err.textContent="";
    const t=$("#fTitle").value.trim();if(!t){err.textContent="Give it a name first.";$("#fTitle").focus();return}
    const k=picked("fKind","k","work");let data;
    if(type==="blocks"){const s=tpv("fStart"),en=tpv("fEnd"),d=$("#fDate").value;
      if(!d){err.textContent="Pick a day.";return}if(toMin(en)<=toMin(s)){err.textContent="End time needs to be after the start time.";return}
      data={...strip(rec),title:t,date:d,start:s,end:en,kind:k};if(preset.taskId)data.taskId=preset.taskId}
    else if(type==="tasks"){const p=picked("fPri","p","normal"),d=$("#fDate").value||null,mins=parseInt($("#fMins").value)||null;
      if(p==="top"&&d){const n=S.tasks.filter(x=>x.id!==rec.id&&x.date===d&&x.priority==="top"&&!x.done).length;if(n>=3){err.textContent="That day already has 3 top tasks. Finish or downgrade one first.";return}}
      data={...strip(rec),title:t,date:d,priority:p,mins,done:!!rec.done,createdAt:rec.createdAt||Date.now()};const fv=$("#fFor").value;if(fv)data.for=fv;else delete data.for}
    else{const s=tpv("fStart"),en=tpv("fEnd"),days=[...form.querySelectorAll('#fDays [aria-pressed="true"]')].map(b=>+b.dataset.d);
      if(!days.length){err.textContent="Pick at least one day.";return}if(toMin(en)<=toMin(s)){err.textContent="End time needs to be after the start time.";return}
      data={...strip(rec),title:t,start:s,end:en,days,kind:k,skips:rec.skips||[]};const u=$("#fUntil").value;if(u)data.until=u;else delete data.until}
    if(type!=="tasks"){const rv=picked("fRem","r","d");if(rv==="d")delete data.remind;else data.remind=+rv;
      const r2=picked("fRem2","r","n");if(r2==="n")delete data.remind2;else data.remind2=+r2;
      const bf=+picked("fBuf","b",0);if(bf)data.buffer=bf;else delete data.buffer;
      const nt=$("#fNotes").value.trim();if(nt)data.notes=nt;else delete data.notes}
    if(type!=="routines"){if($("#fStepIn").value.trim())addStep();const st=[...form.querySelectorAll("#fSteps .srow input")].map(i=>({text:i.value.trim(),done:i.dataset.done==="1"})).filter(x=>x.text);if(st.length)data.steps=st;else delete data.steps}
    delete data.example;save(type,rec.id||uid(),data);closeSheet();toast(isNew?"Added":"Saved")};
}

/* ---------- focus timer ---------- */
let focusT=null,wake=null;
function startFocus(col,rec,date){
  const now=new Date(),nm=now.getHours()*60+now.getMinutes()+now.getSeconds()/60;
  let total;
  if(col==="tasks")total=(rec.mins||25)*60;
  else{const today=(date||rec.date)===todayStr(),s0=toMin(rec.start),e0=toMin(rec.end);total=(today&&nm>=s0&&nm<e0?e0-nm:e0-s0)*60}
  total=Math.max(60,Math.round(total));
  const F={col,id:rec.id,title:rec.title,kind:rec.kind||(col==="tasks"?"admin":"work"),total,left:total,started:Date.now(),paused:false,spent:0};
  closeSheet();
  const root=document.createElement("div");root.id="focus";root.className="focus k-"+F.kind;root.setAttribute("role","dialog");root.setAttribute("aria-label","Focus: "+F.title);
  root.innerHTML=`<div class="fin"><span class="lb">${ic("focus")}Focus</span><h2 class="ft">${esc(F.title)}</h2><div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="trk"/><circle cx="60" cy="60" r="52" class="prg" id="fPrg"/></svg><div class="fc"><span id="fLeft">--:--</span><small id="fOf"></small></div></div><div class="acts"><button class="ghost" id="fPause" type="button">Pause</button><button class="primary" id="fDoneB" type="button">${ic("tick")}Done</button><button class="ghost" id="fStop" type="button">Stop</button></div></div>`;
  document.body.appendChild(root);
  try{navigator.wakeLock?.request("screen").then(w=>wake=w).catch(()=>{})}catch(_){}
  const C=2*Math.PI*52,prg=$("#fPrg");prg.style.strokeDasharray=C;
  const tick=()=>{if(!F.paused)F.left=Math.max(0,F.total-F.spent-(Date.now()-F.started)/1000);
    const l=Math.ceil(F.left),mm=Math.floor(l/60),ss=l%60;$("#fLeft").textContent=(mm>=60?Math.floor(mm/60)+":"+pad(mm%60):mm)+":"+pad(ss);
    $("#fOf").textContent="of "+inFmt(Math.round(F.total/60));prg.style.strokeDashoffset=C*(1-F.left/F.total);
    if(F.left<=0&&!F.rang){F.rang=1;root.classList.add("over");try{navigator.vibrate?.([200,100,200])}catch(_){}}};
  tick();clearInterval(focusT);focusT=setInterval(tick,500);
  $("#fPause").onclick=()=>{if(F.paused){F.paused=false;F.started=Date.now();$("#fPause").textContent="Pause"}else{F.spent+=(Date.now()-F.started)/1000;F.paused=true;$("#fPause").textContent="Resume"}};
  const used=()=>Math.max(1,Math.round((F.total-F.left)/60));
  const end=finished=>{clearInterval(focusT);try{wake?.release()}catch(_){}root.remove();
    if(finished&&F.col==="tasks"){const t=S.tasks.find(x=>x.id===F.id);if(t){const before=strip(t);save("tasks",t.id,{...before,done:true,actual:(t.actual||0)+used()});cheer(`Done in ${inFmt(used())}`,()=>save("tasks",t.id,before));return}}
    if(finished)cheer(`${inFmt(used())} focused`)};
  $("#fDoneB").onclick=()=>end(true);
  $("#fStop").onclick=()=>{if(F.col==="tasks"){const t=S.tasks.find(x=>x.id===F.id);if(t&&used()>1)save("tasks",t.id,{...strip(t),actual:(t.actual||0)+used()})}end(false)};
}

/* ---------- little celebrations ---------- */
function cheer(msg,undo){toast(msg,undo);if(reduced())return;
  const c=document.createElement("canvas");c.className="confetti";document.body.appendChild(c);const x=c.getContext("2d"),dpr=devicePixelRatio,W=c.width=innerWidth*dpr,H=c.height=innerHeight*dpr;
  const cs=getComputedStyle(document.documentElement),cols=["--k-work","--k-family","--k-admin","--k-me","--accent"].map(v=>cs.getPropertyValue(v).trim());
  const P=Array.from({length:70},()=>({x:W/2+(Math.random()-.5)*W*.3,y:H*.62,vx:(Math.random()-.5)*14*dpr,vy:-(8+Math.random()*12)*dpr,r:(3+Math.random()*4)*dpr,c:cols[Math.floor(Math.random()*cols.length)],a:Math.random()*6}));
  let f=0;const step=()=>{x.clearRect(0,0,W,H);P.forEach(p=>{p.vy+=.45*dpr;p.x+=p.vx;p.y+=p.vy;p.a+=.2;x.save();x.translate(p.x,p.y);x.rotate(p.a);x.fillStyle=p.c;x.fillRect(-p.r,-p.r/2,p.r*2,p.r);x.restore()});if(++f<70)requestAnimationFrame(step);else c.remove()};step()}
function toggleTask(t){
  const before=strip(t),done=!t.done;save("tasks",t.id,{...before,done});
  const undo=()=>save("tasks",t.id,before);
  if(!done){toast("Marked not done",undo);return}
  const ds=todayStr(),top=S.tasks.filter(x=>x.priority==="top"&&(x.date===ds||(x.date&&x.date<ds&&!x.done)||x.id===t.id));
  if(t.priority==="top"&&top.length&&top.every(x=>x.id===t.id||x.done))cheer("Top 3 done. Great day.",undo);else toast("Done",undo);
}

/* ---------- events ---------- */
function quickBlock(d){const g=firstGap(d,60);openSheet("blocks",null,{date:d,start:g!==null?hm(g):S.work.start,end:g!==null?hm(g+60):hm(toMin(S.work.start)+60)})}
document.addEventListener("click",e=>{
  const v=e.target.closest(".tabs button");if(v){location.hash=v.dataset.v;return}
  const tg=e.target.closest("[data-toggle]");if(tg){const t=S.tasks.find(x=>x.id===tg.dataset.toggle);if(t)toggleTask(t);return}
  const fb=e.target.closest("[data-focus]");if(fb){e.stopPropagation();const[col,id,date]=fb.dataset.focus.split(":");const r=S[col].find(x=>x.id===id);if(r)startFocus(col,r,date);return}
  const op=e.target.closest("[data-open]");if(op){const[col,id,date]=op.dataset.open.split(":");const r=S[col].find(x=>x.id===id);if(r)openDetails(col,r,date||r.date);return}
  const se=e.target.closest("[data-sel]");if(se){S.sel=se.dataset.sel;renderMonth();return}
  const at=e.target.closest("[data-addtop]");if(at){openSheet("tasks",null,{date:at.dataset.addtop,priority:"top"});return}
  const sl=e.target.closest("[data-slot]");if(sl){openSheet("blocks",null,{start:sl.dataset.slot,date:ymd(S.cur)});return}
  const pl=e.target.closest("[data-plan]");if(pl){const t=S.tasks.find(x=>x.id===pl.dataset.plan);const m=t.mins||60;let d=t.date&&t.date>=todayStr()?t.date:todayStr(),g=firstGap(d,m);
    if(g===null&&!t.date){for(let i=1;i<8&&g===null;i++){const dd=ymd(addDays(fromYmd(todayStr()),i));if(isWorkday(fromYmd(dd))){g=firstGap(dd,m);if(g!==null)d=dd}}}
    const st=g??toMin(S.work.start);openSheet("blocks",null,{title:t.title,date:d,start:hm(st),end:hm(Math.min(st+m,23*60+45)),taskId:t.id,kind:"work"});return}
  const qa=e.target.closest("[data-qa]");if(qa){const a=qa.dataset.qa;
    if(a==="block")quickBlock(todayStr());else if(a==="task")openSheet("tasks");else if(a==="routines")location.hash="routines";
    else if(a==="focus"){const ds=todayStr(),mm=nowMin(),cur=itemsFor(ds).filter(i=>toMin(i.start)<=mm&&toMin(i.end)>mm).pop();
      if(cur)startFocus(cur.src,S[cur.src].find(x=>x.id===cur.id),ds);
      else{const t=S.tasks.find(x=>x.priority==="top"&&!x.done&&x.date&&x.date<=ds)||S.tasks.find(x=>!x.done&&x.date===ds);startFocus("tasks",t||{id:"_free",title:"Focus session",mins:25},ds)}}
    return}
  const wm=e.target.closest("[data-wmore]");if(wm){S.wOpen=S.wOpen||{};S.wOpen[wm.dataset.wmore]=!S.wOpen[wm.dataset.wmore];renderWeek();return}
  if(e.target.closest("[data-settings]")){openSettings();return}
  const gd=e.target.closest("[data-goday]");if(gd){S.cur=fromYmd(gd.dataset.goday);renderDay._scrolled=false;location.hash="day";if(S.view==="day")render();return}
});
const step=n=>{if(S.view==="month"){S.cur=new Date(S.cur.getFullYear(),S.cur.getMonth()+n,1);S.sel=null}else S.cur=addDays(S.cur,S.view==="week"?7*n:n);render()};
$("#prev").onclick=()=>step(-1);
$("#next").onclick=()=>step(1);
$("#todayBtn").onclick=()=>{S.cur=new Date();S.cur.setHours(0,0,0,0);S.sel=null;renderDay._scrolled=false;render()};
$("#fab").onclick=()=>{if(S.view==="tasks")openSheet("tasks");else if(S.view==="routines")openSheet("routines");else quickBlock(S.view==="month"&&S.sel?S.sel:ymd(S.cur))};
document.addEventListener("submit",e=>{if(e.target.id!=="quick")return;e.preventDefault();const i=$("#quickIn"),t=i.value.trim();if(!t)return;const id=uid();save("tasks",id,{title:t,date:null,priority:"normal",mins:null,done:false,createdAt:Date.now()});toast("Added to Inbox",()=>remove("tasks",id));setTimeout(()=>{const n=$("#quickIn");if(n)n.focus()},30)});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet()});
function route(){const h=location.hash.slice(1);S.view=["home","day","week","month","tasks","routines"].includes(h)?h:"home";closeSheet();render();scrollTo({top:0})}
addEventListener("hashchange",route);
setInterval(()=>{if($("#sheetRoot").innerHTML||$("#focus"))return;if(S.view==="day"&&ymd(S.cur)===todayStr())renderDay();else if(S.view==="home")renderHome()},30000);
route();

/* ---------- store ---------- */
async function load(){
  try{
    const r=await fetch("/api/data",{cache:"no-store"});
    if(r.status===401){location.href="/login";return}
    if(!r.ok)throw new Error();
    const d=await r.json();
    S.tasks=d.tasks;S.blocks=d.blocks;S.routines=d.routines;
    S.work={start:d.settings.workStart,end:d.settings.workEnd};S.lead=d.settings.leadMin;S.morning=d.settings.morning||null;
    if(d.settings.palette&&d.settings.palette!==S.palette)applyPalette(d.settings.palette);
    S.publicKey=d.alerts.publicKey;S.devices=d.alerts.devices;S.connector=d.connectorUrl;
    status("");
    if(!$("#sheetRoot").innerHTML&&document.activeElement?.id!=="quickIn")render();
  }catch(_){status("Can't reach your planner right now. Check your connection; changes will show once it's back.")}
}
// Pick up new versions: when the app comes back to the front, reload if a newer version is live.
let myVersion=null;
async function checkVersion(){try{const r=await fetch("/api/version",{cache:"no-store"});if(!r.ok)return;const v=(await r.json()).version;if(myVersion===null){myVersion=v;return}if(v!==myVersion&&!$("#sheetRoot").innerHTML&&!$("#focus"))location.reload()}catch(_){}}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){load();checkVersion()}});
checkVersion();

/* ---------- alerts ---------- */
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const installed=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const pushSupported="serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
let swReg=null;
async function initSW(){
  if(!("serviceWorker" in navigator))return;
  try{swReg=await navigator.serviceWorker.register("/sw.js");const sub=await swReg.pushManager?.getSubscription();S.alertsHere=!!sub;S.endpoint=sub?.endpoint||null;render()}catch(_){}
}
function b64ToBytes(b){const p="=".repeat((4-b.length%4)%4),r=atob((b+p).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(r,c=>c.charCodeAt(0))}
async function pushApi(body){const r=await fetch("/api/push",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"Alerts couldn't be changed. Try again.");return j}
async function enableAlerts(){
  if(!S.publicKey)throw new Error("Alerts aren't set up on the server yet.");
  if(Notification.permission==="denied")throw new Error("Notifications are blocked for this app. Turn them on in your phone's Settings, then try again.");
  const perm=await Notification.requestPermission();
  if(perm!=="granted")throw new Error("Alerts stay off until you allow notifications.");
  const reg=swReg||await navigator.serviceWorker.ready;
  const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(S.publicKey)});
  const j=await pushApi({action:"subscribe",subscription:sub.toJSON()});
  S.alertsHere=true;S.endpoint=sub.endpoint;S.devices=j.devices;
}
async function disableAlerts(){
  const reg=swReg||await navigator.serviceWorker.ready;const sub=await reg.pushManager.getSubscription();
  if(sub){await pushApi({action:"unsubscribe",endpoint:sub.endpoint});await sub.unsubscribe()}
  S.alertsHere=false;S.endpoint=null;
}

/* ---------- settings ---------- */
function openSettings(){
  let alertHtml;
  if(isIOS&&!installed)alertHtml=`<p class="hint">Alerts work in the Home Screen app.</p>`;
  else if(!pushSupported)alertHtml=`<p class="hint">This browser can't show alerts.</p>`;
  else if(S.alertsHere)alertHtml=`<details class="onrow"><summary><span class="on">${ic("tick")}On</span><span class="mg">Manage</span></summary><div class="acts"><button type="button" class="ghost" id="sTest">Send a test</button><button type="button" class="danger" id="sAlerts">Turn off on this device</button></div></details>`;
  else alertHtml=`<div class="acts"><button type="button" class="primary" id="sAlerts">${ic("bell")}Turn on alerts</button></div>`;
  sheet("Settings",`<form class="in" id="sForm"><h3>Settings</h3>
  <div class="f"><span class="lb">Colours</span><div class="pal" id="sPal">${PALS.map(([k,l,c])=>`<button type="button" data-p="${k}" aria-pressed="${S.palette===k}"><span class="sw">${c.map(x=>`<i style="background:${x}"></i>`).join("")}</span>${l}</button>`).join("")}</div></div>
  <div class="two">${tp("sStart",S.work.start,"Work day starts")}${tp("sEnd",S.work.end,"Work day ends")}</div>
  <div class="f"><span class="lb">Default reminder</span>${optsHtml("sLead",[5,10,15,30].map(n=>[n,n+" min"]),S.lead,"n")}</div>
  <div class="f"><span class="lb">Morning planning alert</span>${optsHtml("sMorn",["off","07:00","07:30","08:00","08:30"].map(v=>[v,v==="off"?"Off":v]),S.morning||"off","m")}</div>
  <div class="f"><span class="lb">Phone alerts</span>${alertHtml}</div>
  <div class="f"><span class="lb">Claude connector</span>${S.connector?`<details class="onrow"><summary><span class="on">${ic("tick")}Connected</span><span class="mg">Manage</span></summary><p class="hint">Keep this link private.</p><div class="quick"><input id="sConn" readonly value="${esc(S.connector)}" aria-label="Connector link"><button type="button" id="sCopy">Copy</button></div><div class="acts"><button type="button" class="ghost" id="sNewKey">Make a new link</button><button type="button" class="danger" id="sRevoke">Turn off</button></div></details>`:`<div class="acts"><button type="button" class="ghost" id="sNewKey">Create Claude link</button></div>`}</div>
  <div class="f"><span class="lb">Account</span><div class="acts"><button type="button" class="danger" id="sOut">Log out</button></div></div>
  <div class="err" id="sErr" role="alert"></div>
  <div class="acts sticky"><button class="primary" type="submit">Save</button><button type="button" class="ghost" id="sCancel">Cancel</button></div></form>`);
  const err=$("#sErr");
  $("#sCancel").onclick=closeSheet;
  $("#sPal").onclick=e=>{const b=e.target.closest("button");if(!b)return;applyPalette(b.dataset.p);$("#sPal").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));render()};
  ["sMorn","sLead"].forEach(id=>$("#"+id).onclick=e=>{const b=e.target.closest("button");if(!b)return;$("#"+id).querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed","false"));b.setAttribute("aria-pressed","true")});
  const al=$("#sAlerts");if(al)al.onclick=async()=>{al.disabled=true;err.textContent="";try{S.alertsHere?await disableAlerts():await enableAlerts();toast(S.alertsHere?"Alerts are on":"Alerts are off");openSettings()}catch(e){err.textContent=e.message;al.disabled=false}};
  const te=$("#sTest");if(te)te.onclick=async()=>{te.disabled=true;try{await pushApi({action:"test"});toast("Test sent. It should arrive in a few seconds.")}catch(e){err.textContent=e.message}te.disabled=false};
  const conn=async action=>{err.textContent="";const r=await fetch("/api/connector",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action})});const j=await r.json().catch(()=>({}));if(!r.ok){err.textContent=j.error||"That didn't work. Try again.";return}S.connector=j.url;openSettings();toast(action==="revoke"?"Claude link turned off":"New Claude link ready");if(action==="create"){const dt=document.querySelectorAll(".onrow");dt[dt.length-1]?.setAttribute("open","")}};
  const nk=$("#sNewKey");if(nk)nk.onclick=()=>{if(S.connector&&!nk.dataset.armed){nk.dataset.armed=1;nk.textContent="Tap again: the old link stops working";return}conn("create")};
  const rv=$("#sRevoke");if(rv)rv.onclick=()=>{if(!rv.dataset.armed){rv.dataset.armed=1;rv.textContent="Tap again to turn off";return}conn("revoke")};
  const cp=$("#sCopy");if(cp)cp.onclick=()=>{const i=$("#sConn");const done=()=>toast("Link copied");try{navigator.clipboard.writeText(i.value).then(done,()=>{i.select();document.execCommand("copy");done()})}catch(_){i.select();document.execCommand("copy");done()}};
  $("#sOut").onclick=async()=>{await fetch("/api/logout",{method:"POST"});location.href="/login"};
  $("#sForm").onsubmit=async e=>{e.preventDefault();const st=tpv("sStart"),en=tpv("sEnd"),lead=+picked("sLead","n",10),morn=picked("sMorn","m","off");
    if(toMin(en)<=toMin(st)){err.textContent="The work day needs to end after it starts.";return}
    try{const j=await api({op:"settings",data:{workStart:st,workEnd:en,leadMin:lead,morning:morn,palette:S.palette}});S.work={start:j.settings.workStart,end:j.settings.workEnd};S.lead=j.settings.leadMin;S.morning=j.settings.morning||null;closeSheet();render();toast("Saved")}catch(e){err.textContent=e.message}};
}
$("#gear").onclick=openSettings;

status("Loading your planner…");
load();initSW();
})();
