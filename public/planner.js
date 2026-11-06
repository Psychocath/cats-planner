(function(){
"use strict";
const KINDS={work:"Work",family:"Family",admin:"Admin",me:"Me time"};
const DAYN=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONL=["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYL=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const LEVEL={month:0,week:1,day:2};
const S={work:{start:"09:00",end:"16:00"},view:"home",zoom:"day",cur:new Date(),tasks:[],blocks:[],routines:[],lead:10,alertsHere:false,devices:0,open:null,dock:null,scroll:{}};
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
const monday=d=>addDays(d,1-wd(d));
const fmt=(d,o)=>{o=o||{};const p=[];if(o.weekday)p.push(o.weekday==="long"?DAYL[wd(d)-1]:DAYN[wd(d)-1]);if(o.day)p.push(d.getDate());if(o.month)p.push(o.month==="long"?MONL[d.getMonth()]:MON[d.getMonth()]);return p.join(" ")};
const shortD=ds=>fmt(fromYmd(ds),{weekday:"short",day:1,month:"short"});
const longD=ds=>fmt(fromYmd(ds),{weekday:"long",day:1,month:"long"});
const todayStr=()=>ymd(new Date());
const nowMin=()=>{const n=new Date();return n.getHours()*60+n.getMinutes()};
const daysBetween=(a,b)=>Math.round((fromYmd(b)-fromYmd(a))/864e5);
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);
const inFmt=x=>x<60?x+" min":Math.floor(x/60)+" h"+(x%60?" "+(x%60)+" min":"");
const durFmt=(a,b)=>inFmt(toMin(b)-toMin(a));
const isWorkday=d=>wd(d)<=5;
const reduced=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const strip=r=>{const o={...r};delete o.id;delete o.src;delete o._lane;delete o._lanes;return o};
const store={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch(_){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}}};

/* ---------- colours and time-of-day tint ---------- */
const PALS=[["calm","Calm",["#3B8C7A","#5A9BD5","#C0607A","#A0742A"]],["ocean","Ocean",["#2F7FD8","#21B5A5","#C2557E","#B07A1E"]],["blossom","Blossom",["#7B6CE0","#E77FA0","#3E9B86","#B7802F"]],["collective","Cat Collective",["#D946EF","#8B5CF6","#0C0912","#FCD34D"]]];
function applyPalette(p){
  p=PALS.some(x=>x[0]===p)?p:"calm";
  if(p==="calm")document.documentElement.removeAttribute("data-palette");else document.documentElement.setAttribute("data-palette",p);
  store.set("palette",p);S.palette=p;
}
applyPalette(store.get("palette","calm"));
function applyTint(){const h=new Date().getHours();document.documentElement.setAttribute("data-tod",h<5?"night":h<11?"morning":h<17?"day":h<21?"evening":"night")}
applyTint();

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
 search:'<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
 hourglass:'<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9"/>',
 /* item icons people can choose */
 phone:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
 video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
 mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
 laptop:'<rect x="5" y="5" width="14" height="10" rx="1.5"/><path d="M3 19h18"/>',
 pen:'<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>',
 camera:'<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
 money:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9h.01M17.5 15h.01"/>',
 school:'<path d="M6 9a6 6 0 0 1 12 0v11H6z"/><path d="M9 20v-5h6v5M10 4.4V3h4v1.4"/>',
 car:'<path d="M5 16V12l2-5h10l2 5v4z"/><path d="M5 12h14"/><circle cx="8" cy="17" r="1.8"/><circle cx="16" cy="17" r="1.8"/>',
 home:'<path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/>',
 cart:'<path d="M3 4h2l2.4 11h10.2L20 8H6.2"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/>',
 food:'<path d="M6 3v7a2 2 0 0 0 4 0V3M8 3v18"/><path d="M17 21V3c-2 1-3.5 4-3.5 8H17"/>',
 coffee:'<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3"/>',
 tooth:'<path d="M7 3c-2 0-3.5 1.7-3 4.5.4 2.2 1.5 3.5 2 6.5.4 2.6 1 7 2.5 7s1.5-4.5 3.5-4.5 2 4.5 3.5 4.5 2.1-4.4 2.5-7c.5-3 1.6-4.3 2-6.5C20.5 4.7 19 3 17 3c-2 0-3 1-5 1S9 3 7 3z"/>',
 medical:'<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/>',
 walk:'<circle cx="13" cy="4.5" r="1.8"/><path d="M9 21l2.5-6.5L14 17v4M7.5 12l3-4.5 3 2 3 1.5M11.5 14.5l1-5"/>',
 bed:'<path d="M3 18V7M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.8"/>',
 sparkle:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
 gift:'<rect x="4" y="9" width="16" height="11" rx="1"/><path d="M3 9h18M12 9v11M12 9c-1.5-4-6-4-5-1s5 1 5 1zM12 9c1.5-4 6-4 5-1s-5 1-5 1z"/>',
 paw:'<circle cx="6.5" cy="10" r="1.8"/><circle cx="10" cy="6.5" r="1.8"/><circle cx="14" cy="6.5" r="1.8"/><circle cx="17.5" cy="10" r="1.8"/><path d="M7.5 17c0-3 2-5 4.5-5s4.5 2 4.5 5c0 2-2 3-4.5 2.2-2.5.8-4.5-.2-4.5-2.2z"/>',
 book:'<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>',
 music:'<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
 plane:'<path d="M3 13l18-8-6 16-3-6z"/><path d="M12 15l9-10"/>',
};
const PICK=["phone","video","mail","laptop","pen","camera","money","school","car","home","cart","food","coffee","tooth","medical","walk","bed","sparkle","gift","paw","book","music","plane","star"];
const ic=(n,c="")=>`<svg class="ic ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]||""}</svg>`;
const iconOf=it=>it.icon&&IC[it.icon]?it.icon:null;
const itemIcon=(it,fallback)=>iconOf(it)||fallback;
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
function cacheData(){store.set("cache",{tasks:S.tasks,blocks:S.blocks,routines:S.routines,settings:{workStart:S.work.start,workEnd:S.work.end,leadMin:S.lead,morning:S.morning,palette:S.palette}})}
async function save(col,id,data){
  const list=S[col],i=list.findIndex(x=>x.id===id),rec={...data,id};
  if(i>=0)list[i]=rec;else{list.push(rec);S.flash=id;setTimeout(()=>S.flash=null,800)}
  cacheData();render();
  const body={...data};delete body.id;
  try{await api({op:"set",col,id,data:body})}catch(e){toast(e.message);load()}
}
async function remove(col,id){
  S[col]=S[col].filter(x=>x.id!==id);cacheData();render();
  try{await api({op:"delete",col,id})}catch(e){toast(e.message);load()}
}
function allItemsFor(ds){
  const w=wd(fromYmd(ds));
  const b=S.blocks.filter(x=>x.date===ds).map(x=>({...x,src:"blocks"}));
  const r=S.routines.filter(x=>(x.days||[]).includes(w)&&(!x.from||ds>=x.from)&&(!x.until||ds<=x.until)&&!(x.skips||[]).includes(ds)).map(x=>({...x,src:"routines",date:ds}));
  return b.concat(r).sort((a,b)=>toMin(a.start)-toMin(b.start));
}
/* layer chips hide kinds and tasks in the Calendar only */
S.hide=new Set(store.get("hide",[]));
const inCal=()=>S.view==="cal";
const shown=it=>!inCal()||(!S.hide.has(it.kind||"work")&&!(it.src==="routines"&&S.hide.has("repeats")));
const tasksShown=()=>!inCal()||!S.hide.has("tasks");
const itemsFor=ds=>allItemsFor(ds).filter(shown);
const tasksDue=ds=>tasksShown()?S.tasks.filter(t=>t.date===ds):[];
const deadlinesFor=ds=>tasksShown()?S.tasks.filter(t=>t.for===ds&&t.date!==ds):[];
const overdue=()=>S.tasks.filter(t=>t.date&&t.date<todayStr()&&!t.done);
const topFor=ds=>S.tasks.filter(t=>t.priority==="top"&&(t.date===ds||(ds===todayStr()&&t.date&&t.date<ds&&!t.done))).slice(0,3);

/* ---------- time maths ---------- */
function busy(ds){const r=allItemsFor(ds).map(i=>[toMin(i.start),toMin(i.end)+(i.buffer||0)]).sort((a,b)=>a[0]-b[0]),m=[];r.forEach(x=>{const l=m[m.length-1];if(l&&x[0]<=l[1])l[1]=Math.max(l[1],x[1]);else m.push([...x])});return m}
function freeWork(ds){const ws=toMin(S.work.start),we=toMin(S.work.end);let free=we-ws;busy(ds).forEach(([a,b])=>{free-=Math.max(0,Math.min(b,we)-Math.max(a,ws))});return Math.max(0,free)}
function gaps(ds,min){const ws=toMin(S.work.start),we=toMin(S.work.end),out=[];let t=ws;if(ds===todayStr())t=Math.max(t,Math.ceil(nowMin()/15)*15);for(const[a,b]of busy(ds)){if(Math.min(a,we)-t>=min)out.push([t,Math.min(a,we)]);t=Math.max(t,b)}if(we-t>=min)out.push([t,we]);return out}
function firstGap(ds,mins){const g=gaps(ds,mins)[0];return g?g[0]:null}
/* how booked a day is: one-off blocks only, so weekly routines don't make every weekday look the same */
function bookedPct(ds){const ws=Math.min(7*60,toMin(S.work.start)),we=Math.max(19*60,toMin(S.work.end)),r=S.blocks.filter(x=>x.date===ds).map(i=>[toMin(i.start),toMin(i.end)]).sort((a,b)=>a[0]-b[0]),m=[];r.forEach(x=>{const l=m[m.length-1];if(l&&x[0]<=l[1])l[1]=Math.max(l[1],x[1]);else m.push([...x])});let b=0;m.forEach(([a,c])=>b+=Math.max(0,Math.min(c,we)-Math.max(a,ws)));return Math.min(100,Math.round(b/(we-ws)*150))}
function ratio(){const d=S.tasks.filter(t=>t.mins&&t.actual);if(d.length<3)return 1;const r=d.reduce((a,t)=>a+t.actual/t.mins,0)/d.length;return Math.max(.5,Math.min(3,r))}
const REMINDS=[["d","Default"],[-1,"None"],[0,"At start"],[5,"5 min"],[15,"15 min"],[30,"30 min"],[60,"1 h"],[120,"2 h"],[1440,"1 day"]];
const REMINDS2=[["n","None"],[0,"At start"],[5,"5 min"],[15,"15 min"],[30,"30 min"],[60,"1 h"],[1440,"1 day"]];
const remindLabel=r=>r===undefined||r===null?`${S.lead} min before`:r<0?"No reminder":r===0?"At start":r>=1440?(r/1440)+" day"+(r>1440?"s":"")+" before":r>=60?(r/60)+" h before":r+" min before";
/* timing state for today: past items fade, the next one glows from 15 min before */
function timing(it,ds){if(ds!==todayStr())return"";const m=nowMin(),s=toMin(it.start),e=toMin(it.end);if(e<=m)return"past";if(s>m&&s-m<=15)return"soon";return""}

/* ---------- deadline track ---------- */
function track(t){
  if(!t.for)return"";const td=todayStr(),left=daysBetween(td,t.for);
  if(left<0)return`<span class="track red"><small>Event was ${shortD(t.for)}</small></span>`;
  const start=t.createdAt?ymd(new Date(t.createdAt)):td,span=Math.max(1,daysBetween(start,t.for)),pct=Math.max(4,Math.min(100,Math.round((1-left/span)*100)));
  const cls=left<=2?"red":left<=7?"amber":"",txt=left===0?"Event is today":left===1?"Event is tomorrow":`${left} days to ${shortD(t.for)}`;
  return`<span class="track ${cls}"><span class="tb"><span style="width:${pct}%"></span></span><small>${txt}</small></span>`;
}

/* ---------- details shown in place ---------- */
function resolve(key){if(!key)return null;const[col,id,date]=key.split(":");const rec=(S[col]||[]).find(x=>x.id===id);return rec?{col,rec,date:date||rec.date||null}:null}
function noteForm(key,txt){return `<form class="hnoteed" data-hnoteform="${key}"><textarea id="hNoteIn" rows="3" placeholder="Add a note">${esc(txt)}</textarea><div class="acts"><button class="primary" type="submit">Save note</button><button class="ghost" type="button" data-hnotecancel>Cancel</button></div></form>`}
function panel(key){
  const r=resolve(key);if(!r)return"";const{col,rec,date}=r,isR=col==="routines",isT=col==="tasks",rows=[];
  if(isT){if(rec.for)rows.push(["For",longD(rec.for)]);rows.push(["Due",rec.date?longD(rec.date):"No date"]);if(rec.priority==="top")rows.push(["Priority","Top 3"]);
    if(rec.mins||rec.actual)rows.push(["Time",(rec.mins?`Estimate ${rec.mins} min`:"")+(rec.actual?`${rec.mins?" · ":""}took ${rec.actual} min`:"")+(rec.mins&&ratio()!==1&&!rec.actual?` · likely ${Math.round(rec.mins*ratio())} min`:"")])}
  else{if(date)rows.push(["When",longD(date)]);
    rows.push(["Time",`${rec.start}–${rec.end} · ${durFmt(rec.start,rec.end)}`]);
    if(isR)rows.push(["Repeats",dayLabel(rec.days)+(rec.until?` · until ${fmt(fromYmd(rec.until),{day:1,month:"short"})} ${rec.until.slice(0,4)}`:"")]);
    rows.push(["Reminder",remindLabel(rec.remind)+(typeof rec.remind2==="number"?" and "+remindLabel(rec.remind2):"")]);
    if(rec.buffer)rows.push(["Buffer",rec.buffer+" min after"])}
  if(rec.notes&&S.noteFor!==key)rows.push(["Notes",esc(rec.notes).replace(/\n/g,"<br>")]);
  if(isR&&date&&rec.dayNotes?.[date]&&S.noteFor!==key)rows.push(["Note for this day",esc(rec.dayNotes[date]).replace(/\n/g,"<br>")]);
  const ICN={For:"flag",Due:"cal",When:"cal",Time:"clock",Repeats:"repeat",Reminder:"bell",Buffer:"buffer",Notes:"note","Note for this day":"note",Priority:"star"};
  const steps=rec.steps||[],skipped=isR&&date&&(rec.skips||[]).includes(date);
  const stepsHtml=steps.length?`<div class="steps"><div class="sh"><span class="lb">Steps</span><span class="cnt">${steps.filter(x=>x.done).length} of ${steps.length}</span></div>${steps.map((x,i)=>`<label class="step ${x.done?"done":""}"><input type="checkbox" data-step="${i}" data-key="${key}" ${x.done?"checked":""}><span>${esc(x.text)}</span></label>`).join("")}</div>`:"";
  return`<div class="peek"><dl class="dl">${rows.map(([k,v])=>`<dt>${ic(ICN[k]||"note")}${k}</dt><dd>${v}</dd>`).join("")}</dl>${isT?track(rec):""}${S.noteFor===key?noteForm(key,isR?(rec.dayNotes?.[date]||""):(rec.notes||"")):""}${stepsHtml}
    
    <div class="acts">${!(isT&&rec.done)?`<button class="primary" data-act="focus" data-key="${key}" type="button">${ic("focus")}Focus</button>`:""}${isT?`<button class="ghost" data-act="done" data-key="${key}" type="button">${rec.done?"Not done":"Mark done"}</button>`:""}${!isT&&(!isR||date)?`<button class="ghost" data-act="idone" data-key="${key}" type="button">${itemDone({...rec,src:col},date)?"Not done":"Mark done"}</button>`:""}${S.noteFor!==key&&(!isR||date)?`<button class="ghost" data-act="inote" data-key="${key}" type="button">${ic("note")}${(isR?rec.dayNotes?.[date]:rec.notes)?"Edit note":"Add note"}</button>`:""}${isT&&!rec.done?`<button class="ghost" data-plan="${rec.id}" type="button">Block it</button>`:""}${isR&&date?`<button class="ghost" data-act="skip" data-key="${key}" type="button">${skipped?"Bring back this day":"Skip this day"}</button>`:""}<button class="ghost" data-act="edit" data-key="${key}" type="button">Edit</button></div></div>`;
}
const openAttr=key=>`data-open="${key}" aria-expanded="${S.open===key}"`;
const peekIf=()=>""; // items open in the dock on every screen
function openDock(key){if(S.dock!==key&&S.noteFor!==key)S.noteFor=null;S.dock=key;renderDock()}
function renderDock(){
  const d=$("#dock");if(!S.dock||!resolve(S.dock)){d.hidden=true;d.innerHTML="";S.dock=null;return}
  const{rec,col}=resolve(S.dock),kind=rec.kind||(col==="tasks"?"admin":"work");
  d.innerHTML=`<div class="dh k-${kind}"><span class="chip">${ic(itemIcon(rec,col==="routines"?"repeat":kind))}${KINDS[kind]||"Task"}${col==="routines"?" · repeats":""}</span></div><div class="dh"><h3>${esc(rec.title)}</h3><button class="icon" id="dockX" aria-label="Close">${ic("x")}</button></div>${panel(S.dock)}`;
  d.hidden=false;$("#dockX").onclick=()=>{S.dock=null;S.noteFor=null;renderDock()};
}

/* ---------- header, trail and Now bar ---------- */
function greet(h){return h<12?"Good morning":h<17?"Good afternoon":"Good evening"}
const weekLabel=d=>{const m=monday(d),s=addDays(m,6);return fmt(m,{day:1,month:"short"})+" to "+fmt(s,{day:1,month:"short"})};
function renderHeader(){
  document.querySelectorAll(".tabs button").forEach(b=>b.setAttribute("aria-current",b.dataset.v===(S.view==="routines"?"tasks":S.view)?"page":"false"));
  const c=S.cur,n=new Date(),cal=S.view==="cal";let sub="",main="";
  if(S.view==="home"){sub=esc(fmt(n,{weekday:"long",day:1,month:"long"}));main=greet(n.getHours())+", Cat"}
  else if(cal){
    const crumbs=[];
    if(S.zoom!=="month")crumbs.push(`<button data-crumb="month">${MONL[c.getMonth()]}</button>`);else crumbs.push(`<span class="cur">${c.getFullYear()}</span>`);
    if(S.zoom==="day")crumbs.push(`<button data-crumb="week">${weekLabel(c)}</button>`);
    if(S.zoom==="week")crumbs.push(`<span class="cur">Week</span>`);
    sub=`<span class="crumbs">${crumbs.join('<span class="sep">›</span>')}</span>`;
    main=S.zoom==="month"?MONL[c.getMonth()]:S.zoom==="week"?weekLabel(c):(ymd(c)===todayStr()?"Today, ":"")+fmt(c,{weekday:"short",day:1,month:"short"});
  }
  else if(S.view==="tasks"){sub=esc(fmt(n,{weekday:"long",day:1,month:"long"}));main="Tasks"}
  else{sub="Repeats every week";main="Routines"}
  $("#dsub").innerHTML=sub;$("#dmain").textContent=main;
  $("#out").hidden=!(cal&&S.zoom!=="month");$("#prev").hidden=!cal;$("#next").hidden=!cal;
  $("#gear").hidden=false;$("#search").hidden=false;
  const fab=$("#fab");fab.hidden=false;fab.setAttribute("aria-label","Add a block, task or routine");
  renderNowbar();
}
function renderNowbar(){
  const b=$("#nowbar");if(S.view==="home"){b.hidden=true;return}
  const ds=todayStr(),m=nowMin(),its=allItemsFor(ds),cur=its.filter(i=>toMin(i.start)<=m&&toMin(i.end)>m).pop(),nxt=its.find(i=>toMin(i.start)>m);
  if(cur){b.className="nowbar k-"+(cur.kind||"work");b.innerHTML=`<span class="dot"></span><span class="nt"><b>Now</b> ${esc(cur.title)} · ${inFmt(toMin(cur.end)-m)} left</span>${nxt?`<span class="nr">Next ${nxt.start}</span>`:""}`}
  else{b.className="nowbar"+(nxt?" k-"+(nxt.kind||"work"):"");b.innerHTML=`<span class="dot"></span><span class="nt">${nxt?`<b>Free</b> until ${nxt.start} · ${esc(nxt.title)}`:"<b>Free</b> for the rest of today"}</span>`}
  b.setAttribute("aria-label",b.textContent+". Open today");b.hidden=false;
}

/* ---------- shared rows: one look per item everywhere ---------- */
function evRow(it,ds){
  const key=`${it.src}:${it.id}:${ds}`;
  return `<button class="wi k-${it.kind||"work"} ${timing(it,ds)} ${S.flash===it.id?"grow":""}" ${openAttr(key)}><span class="tm">${it.start}–${it.end}</span>${ic(itemIcon(it,it.kind||"work"),"ki")}<span class="tt">${esc(it.title)}</span></button>${peekIf(key)}`;
}
function taskItem(t,dl){
  const key=`tasks:${t.id}`;
  if(dl)return `<button class="wi dl" ${openAttr(key)}><span class="tm"></span>${ic(itemIcon(t,"flag"),"ki")}<span class="tt ${t.done?"strike":""}">${esc(t.title)}<span class="sub"><b>Deadline</b> · ${t.done?"done":"do by "+(t.date?shortD(t.date):"any day")}</span>${track(t)}</span></button>${peekIf(key)}`;
  return `<button class="wi" ${openAttr(key)} aria-label="${t.priority==="top"?"Top 3 task":"Task"}: ${esc(t.title)}"><span class="tm"></span>${ic(itemIcon(t,t.priority==="top"?"star":"task"),"ki")}<span class="tt ${t.done?"strike":""}">${esc(t.title)}${t.for?track(t):""}</span></button>${peekIf(key)}`;
}
function dayList(ds,its,tasks,dl){
  const one=its.filter(i=>i.src!=="routines"),rt=its.filter(i=>i.src==="routines");
  let h=one.map(it=>evRow(it,ds)).join("")+(tasks||[]).map(t=>taskItem(t,false)).join("")+(dl||[]).map(t=>taskItem(t,true)).join("");
  if(rt.length){h+=`<div class="rstrip">${rt.map(it=>{const key=`routines:${it.id}:${ds}`;return `<button class="rchip k-${it.kind||"work"} ${timing(it,ds)}" ${openAttr(key)}>${ic(itemIcon(it,"repeat"))}<span>${it.start}</span>${esc(it.title)}</button>`}).join("")}</div>`;
    const o=rt.find(it=>S.open===`routines:${it.id}:${ds}`);if(o)h+=panel(`routines:${o.id}:${ds}`)}
  return h||`<div class="wi none">Nothing planned</div>`;
}
function seg3(top){const d=top.filter(t=>t.done).length;return `<span class="seg3"><span class="sg">${[0,1,2].map(i=>`<i class="${i<d?"on":""}"></i>`).join("")}</span><span class="cnt ${top.length===3&&d===3?"all":""}">${d} of 3</span></span>`}
function top3Html(ds,withSteps){
  const top=topFor(ds);
  let h=`<section class="sec"><div class="sech"><h2>${ic("star")}Top 3${ds===todayStr()||S.view==="home"?"":" for "+fmt(fromYmd(ds),{weekday:"long"})}</h2>${seg3(top)}</div><div class="top3">`;
  h+=top.map((t,i)=>{const st=t.steps||[],key=`tasks:${t.id}`;return `<div class="t3 ${t.done?"done":""}" aria-expanded="${S.open===key}">${chk(t.id,t.done)}<span class="n">${i+1}</span><button class="t3b" data-open="${key}">${esc(t.title)}${withSteps&&st.length?`<small>${st.filter(x=>x.done).length} of ${st.length} steps</small>`:""}${t.for?track(t):""}</button>${iconOf(t)?ic(iconOf(t),"ki"):""}</div>${peekIf(key)}`}).join("");
  if(top.length<3)h+=`<button class="addline" data-addtop="${ds}">${ic("plus")}Add a Top 3 task</button>`;
  return h+`</div></section>`;
}

/* ---------- home ---------- */
const WX={0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",66:"Freezing rain",67:"Freezing rain",71:"Light snow",73:"Snow",75:"Heavy snow",80:"Showers",81:"Showers",82:"Heavy showers",95:"Thunderstorms",96:"Thunderstorms",99:"Thunderstorms"};
S.wx=store.get("wx",null);
async function loadWeather(force){
  if(S.wx&&!S.wx.err&&!force&&Date.now()-S.wx.at<15*60000)return;
  // after a failed fetch, wait 5 minutes before trying again, so an offline phone doesn't retry in a loop
  if(!force&&loadWeather.failedAt&&Date.now()-loadWeather.failedAt<5*60000)return;
  if(loadWeather.busy)return;loadWeather.busy=true;
  try{const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude=-33.9249&longitude=18.4241&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Africa%2FJohannesburg&forecast_days=1");
    if(!r.ok)throw 0;const j=await r.json();
    S.wx={at:Date.now(),t:Math.round(j.current.temperature_2m),code:j.current.weather_code,wind:Math.round(j.current.wind_speed_10m),hi:Math.round(j.daily.temperature_2m_max[0]),lo:Math.round(j.daily.temperature_2m_min[0]),rain:j.daily.precipitation_probability_max[0]};store.set("wx",S.wx);
    loadWeather.failedAt=0;
  }catch(_){loadWeather.failedAt=Date.now();if(!S.wx)S.wx={at:Date.now(),err:1}}
  loadWeather.busy=false;
  if(S.view==="home"&&!$("#sheetRoot").innerHTML&&document.activeElement?.id!=="hNoteIn")render();
}
function upcomingAlerts(ds){
  const m=nowMin(),out=[],base=fromYmd(ds);
  for(let d=0;d<8;d++){const day=ymd(addDays(base,d));allItemsFor(day).forEach(it=>{[it.remind??S.lead,it.remind2].forEach(r=>{if(typeof r!=="number"||r<0)return;const at=d*1440+toMin(it.start)-r;if(at>=m&&at<24*60)out.push({at,it,r,day,d})})})}
  return out.sort((a,b)=>a.at-b.at).slice(0,5);
}
/* day ring: 24-hour clock face, midnight at the top */
function ring(ds){
  const R=60,C=2*Math.PI*R,R2=71,C2=2*Math.PI*R2,m=nowMin(),its=allItemsFor(ds);
  const arc=(r,c,a,b,stroke,w,cls="")=>`<circle cx="80" cy="80" r="${r}" fill="none" class="${cls}" style="stroke:${stroke}" stroke-width="${w}" stroke-dasharray="${Math.max(1,(b-a)/1440*c).toFixed(1)} ${c.toFixed(1)}" stroke-dashoffset="${(-a/1440*c).toFixed(1)}"/>`;
  let g=`<circle cx="80" cy="80" r="${R}" fill="none" style="stroke:var(--sunk)" stroke-width="15"/><circle cx="80" cy="80" r="${R2}" fill="none" style="stroke:var(--line)" stroke-width="2.5"/>`;
  if(isWorkday(fromYmd(ds)))g+=arc(R2,C2,toMin(S.work.start),toMin(S.work.end),"var(--muted)",2.5);
  its.forEach(it=>{g+=arc(R,C,toMin(it.start),toMin(it.end),`var(--k-${it.kind||"work"})`,15,toMin(it.end)<=m?"past":"")});
  const ang=m/1440*2*Math.PI,sx=80+46*Math.sin(ang),sy=80-46*Math.cos(ang),hx=80+77*Math.sin(ang),hy=80-77*Math.cos(ang);
  const cur=its.filter(i=>toMin(i.start)<=m&&toMin(i.end)>m).pop();
  const labels=[["0",80,42],["6",122,84],["12",80,128],["18",38,84]].map(([t,x,y])=>`<text x="${x}" y="${y}" text-anchor="middle" class="rl">${t}</text>`).join("");
  return `<svg class="ring2" viewBox="0 0 160 160" role="img" aria-label="Today as a 24-hour ring. Open today" data-goday="${ds}"><g transform="rotate(-90 80 80)">${g}</g>${labels}<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" style="stroke:var(--now)" stroke-width="3" stroke-linecap="round"/><circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="3.5" style="fill:var(--now)"/><text x="80" y="84" text-anchor="middle" class="rt">${hm(m)}</text><text x="80" y="101" text-anchor="middle" class="rs">${cur?inFmt(toMin(cur.end)-m)+" left":"Free now"}</text></svg>`;
}
/* Home day card: today's plan until today's tasks are ticked off and its last block has ended, then tomorrow's */
function todayDone(ds){
  const m=nowMin(),tk=S.tasks.filter(t=>t.date===ds),its=allItemsFor(ds);
  const tasksDone=tk.every(t=>t.done),open=its.filter(i=>!itemDone(i,ds)),last=open.length?Math.max(...open.map(i=>toMin(i.end))):0;
  return tasksDone&&last<=m&&(tk.length||its.length||m>=toMin(S.work.end));
}
/* events can be ticked off and given a note from Home. Blocks keep done and notes on the block;
   a routine keeps them per day (doneOn, dayNotes) so ticking today's school run leaves the rest of the week alone */
function itemDone(it,ds){if(it.src==="routines"){const r=S.routines.find(x=>x.id===it.id);return!!r&&(r.doneOn||[]).includes(ds)}return!!it.done}
function itemNote(it,ds){if(it.src==="routines"){const r=S.routines.find(x=>x.id===it.id);return r?.dayNotes?.[ds]||""}return it.notes||""}
function setItemDone(key){const r=resolve(key);if(!r)return;const{col,rec,date}=r;
  if(col==="routines"){const cut=ymd(addDays(new Date(),-30)),on=(rec.doneOn||[]).filter(d=>d>=cut),has=on.includes(date);save("routines",rec.id,{...rec,doneOn:has?on.filter(d=>d!==date):[...on,date]});return!has}
  save("blocks",rec.id,{...rec,done:!rec.done});return!rec.done}
function setItemNote(key,txt){const r=resolve(key);if(!r)return;const{col,rec,date}=r;
  if(col==='tasks'){const nr={...rec};if(txt)nr.notes=txt;else delete nr.notes;save('tasks',rec.id,nr);return}
  if(col==="routines"){const dn={...(rec.dayNotes||{})};if(txt)dn[date]=txt;else delete dn[date];const cut=ymd(addDays(new Date(),-30));Object.keys(dn).forEach(d=>{if(d<cut)delete dn[d]});save("routines",rec.id,{...rec,dayNotes:dn});return}
  const nr={...rec};if(txt)nr.notes=txt;else delete nr.notes;save("blocks",rec.id,nr)}
function homeDay(ds){
  const pick=store.get("homeDay",null);
  if(pick&&pick.on===ds)return pick.v;
  return todayDone(ds)?"tomorrow":"today";
}
/* alerts health: the scheduler records each check; flag it on Home when checks stop */
function alertsStale(){if(!S.devices)return false;return !S.lastCheck||Date.now()-S.lastCheck>45*60000}
function lastCheckTxt(){if(!S.lastCheck)return "No alert check has run yet.";const d=new Date(S.lastCheck),same=ymd(d)===todayStr();return `Last alert check: ${hm(d.getHours()*60+d.getMinutes())}${same?" today":", "+fmt(d,{weekday:"short",day:1,month:"short"})}`}

function renderHome(){
  const n=new Date(),ds=todayStr(),m=nowMin(),v=homeDay(ds),tomorrow=v==="tomorrow",day=tomorrow?ymd(addDays(n,1)):ds;
  let wx;
  if(!S.wx)wx=`<span class="mut">Loading weather</span>`;
  else if(S.wx.err)wx=`<span class="mut">Weather unavailable</span>`;
  else wx=`${ic(wxIcon(S.wx.code),"wxi")}<b>${S.wx.t}°</b><span class="wxd">${WX[S.wx.code]||""} · high ${S.wx.hi}°, rain ${S.wx.rain??0}%</span>`;
  let work="";
  if(isWorkday(n)){const ws=toMin(S.work.start),we=toMin(S.work.end),pct=Math.max(0,Math.min(100,Math.round((m-ws)/(we-ws)*100)));
    work=`<div class="dayp"><div class="dpl"><span>Work day · ${m<ws?"starts "+S.work.start:m>=we?"finished":inFmt(we-m)+" left"}</span></div><div class="bar"><span style="width:${pct}%"></span></div></div>`}
  else work=`<div class="dpl"><span>Day off</span></div>`;
  let h=alertsStale()?`<button class="astale" data-settings>${ic("bell")}<span><b>Phone alerts have stopped</b>${esc(lastCheckTxt())} Tap to check.</span></button>`:"";
  h+=`<section class="card hhead">${ring(ds)}<div class="side"><div class="wx">${wx}</div>${work}${nowLines(ds)}</div></section>`;
  if(!S.alertsHere&&!alertsStale())h+=`<p class="mut small alerthint">Phone alerts are off on this device. <button class="wmore" data-settings>Turn them on</button></p>`;
  const sw=`<span class="dsw" role="group" aria-label="Show day">${[["today","Today"],["tomorrow","Tomorrow"]].map(([k,l])=>`<button type="button" data-homeday="${k}" aria-pressed="${v===k}">${l}</button>`).join("")}</span>`;
  const auto=!(store.get("homeDay",null)?.on===ds);
  h+=`<div class="daysw ${S.homeSlide||""}"><div class="sech"><h2>${ic("cal")}<span>${tomorrow?"Tomorrow":"Today"}<small>${fmt(fromYmd(day),{weekday:"long",day:1,month:"long"})}</small></span></h2>${sw}</div>${tomorrow&&auto&&todayDone(ds)?`<p class="ddone">${ic("tick")}Today is done. Here's tomorrow.</p>`:""}</div>`;
  h+=dayView(day,true);
  $("#view").innerHTML=`<div class="homev">${h}</div>`;
  loadWeather();
}
/* Now and Next as 2 lines in the Home header */
function nowLines(ds){
  const m=nowMin(),its=allItemsFor(ds).filter(i=>!itemDone(i,ds));
  const cur=its.filter(i=>toMin(i.start)<=m&&toMin(i.end)>m).pop(),nxt=its.find(i=>toMin(i.start)>m);
  const now=cur?`<button class="nl k-${cur.kind||"work"}" data-open="${cur.src}:${cur.id}:${ds}"><span class="lb">Now</span><span class="nt">${esc(cur.title)}</span><span class="nr">${inFmt(toMin(cur.end)-m)} left</span></button>`:`<div class="nl"><span class="lb">Now</span><span class="nt free">Free time</span></div>`;
  const next=nxt?`<button class="nl k-${nxt.kind||"work"} ${timing(nxt,ds)==="soon"?"soonl":""}" data-open="${nxt.src}:${nxt.id}:${ds}"><span class="lb">Next</span><span class="nt">${esc(nxt.title)}</span><span class="nr">${nxt.start}</span></button>`:`<div class="nl"><span class="lb">Next</span><span class="nt free">Nothing else today</span></div>`;
  return `<div class="nls">${now}${next}</div>`;
}

/* ---------- calendar: context strip and layer chips ---------- */
function layersHtml(){
  const chips=[...Object.entries(KINDS).map(([k,v])=>`<button class="lc k-${k}" data-layer="${k}" aria-pressed="${!S.hide.has(k)}"><i></i>${v}</button>`),`<button class="lc" data-layer="repeats" aria-pressed="${!S.hide.has("repeats")}">${ic("repeat")}Repeats</button>`,`<button class="lc" data-layer="tasks" aria-pressed="${!S.hide.has("tasks")}"><i></i>Tasks</button>`];
  const n=new Date(),onNow=S.zoom==="day"?ymd(S.cur)===todayStr():S.zoom==="week"?ymd(monday(S.cur))===ymd(monday(n)):S.cur.getMonth()===n.getMonth()&&S.cur.getFullYear()===n.getFullYear();
  if(!onNow)chips.unshift(`<button class="lc today" data-today>${ic("cal")}${S.zoom==="day"?"Today":S.zoom==="week"?"This week":"This month"}</button>`);
  return `<div class="layers" role="group" aria-label="Show or hide">${chips.join("")}</div>`;
}
function dayStrip(){
  const m=monday(S.cur),sel=ymd(S.cur),td=todayStr();
  return `<div class="strip" role="group" aria-label="Days this week">${[0,1,2,3,4,5,6].map(i=>{const d=addDays(m,i),ds=ymd(d),p=bookedPct(ds);return `<button class="sd ${ds===sel?"on":""} ${ds===td?"td":""} ${i>4?"we":""}" data-pick="${ds}" aria-label="${longD(ds)}"><small>${DAYN[i].slice(0,2)}</small><b>${d.getDate()}</b><span class="ld"><span style="width:${p}%"></span></span></button>`}).join("")}</div>`;
}
function weekStrip(){
  const first=new Date(S.cur.getFullYear(),S.cur.getMonth(),1),sel=ymd(monday(S.cur)),out=[];
  for(let m=monday(first),i=0;i<6&&(i===0||m.getMonth()===first.getMonth());m=addDays(m,7),i++){const s=addDays(m,6);out.push(`<button class="sd ${ymd(m)===sel?"on":""} ${ymd(m)===ymd(monday(new Date()))?"td":""}" data-pickw="${ymd(m)}" aria-label="Week of ${shortD(ymd(m))}"><small>${MON[m.getMonth()]}</small><b>${m.getDate()}–${s.getDate()}</b></button>`)}
  return `<div class="strip wk" role="group" aria-label="Weeks this month">${out.join("")}</div>`;
}
function renderCal(){({month:renderMonth,week:renderWeek,day:renderDay})[S.zoom]()}

/* ---------- day ---------- */
function layoutLanes(items){
  const out=[];let cluster=[],clusterEnd=-1;
  const flush=()=>{const lanes=[];cluster.forEach(it=>{let l=lanes.findIndex(e=>e<=toMin(it.start));if(l<0){l=lanes.length;lanes.push(0)}lanes[l]=toMin(it.end);it._lane=l});cluster.forEach(it=>it._lanes=lanes.length);out.push(...cluster);cluster=[]};
  items.forEach(it=>{if(toMin(it.start)>=clusterEnd&&cluster.length)flush();cluster.push(it);clusterEnd=Math.max(clusterEnd,toMin(it.end))});
  if(cluster.length)flush();return out;
}
/* Time scale for the Day timeline. Normally 1.4px a minute, but any block
   shorter than MIN px gets its minutes stretched so its title fits, short free
   gaps between blocks get GAP px so they stay visible, and the rest of the day
   shifts down instead of the blocks sitting on top of each other. */
function stretchScale(from,to,ppm,spans,MIN=44,GAP=22){
  const pts=[...new Set([from,to,...spans.flat()])].filter(m=>m>=from&&m<=to).sort((a,b)=>a-b);
  const seg=pts.slice(1).map((m,i)=>(m-pts[i])*ppm);
  spans.forEach(([a,b])=>{const i=pts.indexOf(a),j=pts.indexOf(b);if(i<0||j<=i)return;
    let px=0;for(let k=i;k<j;k++)px+=seg[k];if(px>=MIN)return;
    const add=MIN-px,mins=b-a;for(let k=i;k<j;k++)seg[k]+=add*((pts[k+1]-pts[k])/mins)});
  // short free gaps between blocks (like 5 min before a call) open up too, so the gap shows
  seg.forEach((v,k)=>{const a=pts[k],b=pts[k+1];if(b-a>=30||v>=GAP)return;
    const covered=spans.some(([x,y])=>x<b&&y>a),touches=spans.some(([x,y])=>y===a)&&spans.some(([x,y])=>x===b);
    if(!covered&&touches)seg[k]=GAP});
  const acc=[0];seg.forEach(v=>acc.push(acc[acc.length-1]+v));
  return m=>{if(m<=from)return(m-from)*ppm;if(m>=to)return acc[acc.length-1]+(m-to)*ppm;
    let k=0;while(pts[k+1]<m)k++;return acc[k]+seg[k]*(m-pts[k])/(pts[k+1]-pts[k])};
}
function renderDay(){
  const ds=ymd(S.cur),isToday=ds===todayStr();
  $("#view").innerHTML=dayStrip()+layersHtml()+`<div id="pane">${dayView(ds,false)}</div>`;
  if(isToday&&!renderDay._scrolled){renderDay._scrolled=true;const el=document.querySelector(".tl .now");if(el){const top=el.getBoundingClientRect().top+scrollY-260;if(top>200)scrollTo({top})}}
}
/* One view of a day, used by Home (today or tomorrow) and by Calendar › Day:
   overload warning, Top 3, the timeline, and tasks that have no time yet */
function dayView(ds,home){
  const isToday=ds===todayStr(),work=isWorkday(fromYmd(ds));
  const fw=freeWork(ds),need=S.tasks.filter(t=>(t.date===ds||(isToday&&t.date&&t.date<ds))&&!t.done&&t.mins&&!S.blocks.some(b=>b.taskId===t.id&&b.date===ds)).reduce((a,t)=>a+Math.round(t.mins*ratio()),0);
  let h="";
  if(work&&need>fw)h+=`<div class="over">${ic("hourglass")}<span><b>Too much for one day</b>Tasks need about ${inFmt(need)}, you have ${fw?inFmt(fw):"no time"} free in the work day.</span></div>`;
  if(tasksShown())h+=top3Html(ds,true);
  h+=timelineHtml(ds,work);
  h+=trayHtml(ds);
  return h;
}
function timelineHtml(ds,work){
  const isToday=ds===todayStr(),raw=itemsFor(ds),items=layoutLanes(raw),nm=nowMin();
  let sH=Math.min(7,Math.floor(toMin(S.work.start)/60)),eH=Math.max(18,Math.ceil(toMin(S.work.end)/60));
  raw.forEach(i=>{sH=Math.min(sH,Math.floor(toMin(i.start)/60));eH=Math.max(eH,Math.ceil(toMin(i.end)/60))});
  if(isToday){sH=Math.min(sH,new Date().getHours());eH=Math.max(eH,new Date().getHours()+1)}
  sH=Math.max(0,sH);eH=Math.min(24,eH);
  const ppm=1.4,y=stretchScale(sH*60,eH*60,ppm,items.map(it=>{const a=Math.max(toMin(it.start),sH*60);return[a,Math.min(Math.max(toMin(it.end),a+1),eH*60)]})),height=y(eH*60);
  let rail="",grid="";
  for(let hr=sH;hr<=eH;hr++){const top=y(hr*60);rail+=`<span style="top:${top}px">${pad(hr%24)}:00</span>`;grid+=`<div class="hr" style="top:${top}px"></div>`;
    if(hr<eH)grid+=`<div class="hr half" style="top:${y(hr*60+30)}px"></div><button class="slot" data-slot="${pad(hr)}:00" data-slotday="${ds}" style="top:${top}px;height:${y(hr*60+30)-top}px" aria-label="Add block at ${pad(hr)}:00"></button><button class="slot" data-slot="${pad(hr)}:30" data-slotday="${ds}" style="top:${y(hr*60+30)}px;height:${y(hr*60+60)-y(hr*60+30)}px" aria-label="Add block at ${pad(hr)}:30"></button>`}
  {const ws=toMin(S.work.start),we=toMin(S.work.end);if(ws>sH*60)grid+=`<div class="off" style="top:0;height:${y(ws)}px"></div>`;if(we<eH*60)grid+=`<div class="off" style="top:${y(we)}px;height:${y(eH*60)-y(we)}px"></div>`;if(work)grid+=`<span class="wl" style="top:${y(ws)}px">Work day starts</span><span class="wl" style="top:${y(we)}px">Work day ends</span>`}
  if(work)gaps(ds,30).forEach(([a,b])=>{grid+=`<button class="gap" data-slot="${hm(a)}" data-slotday="${ds}" style="top:${y(a)+3}px;height:${y(b)-y(a)-6}px" aria-label="${inFmt(b-a)} free from ${hm(a)}. Add a block">${ic("plus")}${inFmt(b-a)} free</button>`});
  items.forEach(it=>{if(!it.buffer)return;const bs=toMin(it.end),be=Math.min(bs+it.buffer,eH*60);if(be>bs)grid+=`<div class="buf" style="top:${y(bs)+1}px;height:${y(be)-y(bs)-2}px"><span>Buffer ${it.buffer} min</span></div>`});
  items.forEach(it=>{const s=Math.max(toMin(it.start),sH*60),e=Math.min(Math.max(toMin(it.end),s+1),eH*60);if(e<=s)return;
    const w=100/it._lanes,ht=y(e)-y(s)-2,short=ht<60,isR=it.src==="routines",key=`${it.src}:${it.id}:${ds}`,done=itemDone(it,ds),note=itemNote(it,ds),cur=isToday&&toMin(it.start)<=nm&&toMin(it.end)>nm&&!done;
    grid+=`<div class="blk k-${it.kind||"work"} ${isR?"rt":""} ${short?"short":""} ${done?"done":timing(it,ds)} ${cur?"cur":""} ${S.flash===it.id?"grow":""}" style="top:${y(s)+1}px;height:${ht}px;left:calc(${w*it._lane}% + 4px);width:calc(${w}% - 8px)"><button class="bm" data-dock="${key}"><b>${ic(itemIcon(it,isR?"repeat":(it.kind||"work")),"bi")}${esc(it.title)}</b><span class="tm">${it.start}${short?"":"–"+it.end}</span>${note&&ht>=76?`<span class="bn">${ic("note")}${esc(note)}</span>`:""}</button><span class="ba"><button type="button" class="hbtn ${note?"has":""}" data-hnote="${key}" aria-label="${note?"Edit note":"Add a note"}">${ic("note")}</button><button class="check" data-hdone="${key}" aria-pressed="${done}" aria-label="${done?"Mark not done":"Mark done"}"><i>${ic("tick")}</i></button></span></div>`});
  if(isToday&&nm>=sH*60&&nm<=eH*60)grid+=`<div class="now" style="top:${y(nm)}px"></div>`;
  const fw=freeWork(ds);
  return `<section class="sec tls"><div class="sech"><h2>${ic("clock")}Timeline</h2><span class="cnt">${work?(fw?inFmt(fw)+" free in work day":"Work day fully booked"):"Day off"}</span></div><div class="tl" style="height:${height}px"><div class="rail">${rail}</div><div class="grid">${grid}</div></div></section>`;
}
/* tasks for the day that aren't in Top 3 and have no time yet, plus waiting tasks and deadlines */
function trayHtml(ds){
  if(!tasksShown())return"";
  const isToday=ds===todayStr(),tops=new Set(topFor(ds).map(t=>t.id));
  const carried=isToday?overdue().filter(t=>!tops.has(t.id)):[];
  const due=S.tasks.filter(t=>t.date===ds&&!tops.has(t.id)).sort((a,b)=>(a.done-b.done)),dl=deadlinesFor(ds).filter(t=>!t.done);
  if(!carried.length&&!due.length&&!dl.length)return"";
  const all=[...carried,...due],done=all.filter(t=>t.done).length;
  const row=(t,meta)=>{const key=`tasks:${t.id}`;return `<div class="hrow ${t.done?"done":""}"><button class="hmain" data-open="${key}">${ic(itemIcon(t,"task"),"ki")}<span class="tt"><b>${esc(t.title)}</b>${meta?`<span class="sub ${meta.cls||""}">${meta.txt}</span>`:""}${t.notes?`<span class="hnote">${ic("note")}${esc(t.notes)}</span>`:""}${t.for?track(t):""}</span></button><button type="button" class="hbtn ${t.notes?"has":""}" data-hnote="${key}" aria-label="${t.notes?"Edit note":"Add a note"}">${ic("note")}</button>${chk(t.id,t.done)}</div>`};
  const metaOf=t=>{const st=t.steps||[],bits=[];if(t.mins)bits.push(`${t.mins} min`);if(st.length)bits.push(`${st.filter(x=>x.done).length} of ${st.length} steps`);return bits.length?{txt:bits.join(" · ")}:null};
  let h=`<section class="sec"><div class="sech"><h2>${ic("task")}Not scheduled yet</h2><span class="cnt">${all.length?`${done} of ${all.length} done`:""}</span></div><div class="wd tray">`;
  h+=carried.map(t=>{const w=daysBetween(t.date,ds);return row(t,{txt:`Waiting ${w} day${w>1?"s":""} · from ${shortD(t.date)}`,cls:"waitn"})}).join("");
  h+=due.map(t=>row(t,metaOf(t))).join("");
  h+=dl.map(t=>taskItem(t,true)).join("");
  return h+`</div></section>`;
}

/* ---------- week: load bars, then every day in full ---------- */
function renderWeek(){
  const mo=monday(S.cur),td=todayStr();
  const lo=Math.min(7*60,toMin(S.work.start)),hi=Math.max(18*60,toMin(S.work.end)),span=hi-lo,X=m=>Math.max(0,Math.min(100,(m-lo)/span*100));
  let h=weekStrip()+layersHtml()+`<div id="pane">`;
  h+=`<section class="card load" aria-label="How full each day is">${[0,1,2,3,4,5,6].map(i=>{const d=addDays(mo,i),ds=ymd(d),its=itemsFor(ds);
    const segs=its.map(it=>{const a=X(toMin(it.start)),b=X(toMin(it.end));return b>a?`<i class="k-${it.kind||"work"} ${timing(it,ds)}" style="left:${a}%;width:${b-a}%"></i>`:""}).join("");
    const wk=isWorkday(d)?`<span class="wk" style="left:${X(toMin(S.work.start))}%;width:${X(toMin(S.work.end))-X(toMin(S.work.start))}%"></span>`:"";
    const now=ds===td?`<span class="nowl" style="left:${X(nowMin())}%"></span>`:"";
    return `<button class="lrow ${ds===td?"td":""}" data-zday="${ds}" aria-label="${longD(ds)}: ${its.length} on. Open the day"><span>${DAYN[i].slice(0,2)} ${d.getDate()}</span><span class="lbar">${wk}${segs}${now}</span></button>`}).join("")}<div class="lticks"><span>${hm(lo)}</span><span>${hm(Math.round((lo+hi)/120)*60)}</span><span>${hm(hi)}</span></div></section>`;
  h+=`<div class="week" style="margin-top:14px">`;
  for(let i=0;i<7;i++){const d=addDays(mo,i),ds=ymd(d),its=itemsFor(ds);
    const tk=tasksDue(ds).filter(t=>!t.done).sort((a,b)=>(a.priority==="top"?0:1)-(b.priority==="top"?0:1)),dl=deadlinesFor(ds).filter(t=>!t.done);
    const evn=its.filter(x=>x.src!=="routines").length,nt=tk.length+dl.length,parts=[evn&&`${evn} event${evn>1?"s":""}`,nt&&`${nt} task${nt>1?"s":""}`].filter(Boolean).join(" · ");
    h+=`<section class="wd mag ${ds===td?"today":""} ${ds===S.hl?"selday":""}" id="mag-${ds}"><button class="wh" data-zday="${ds}"><span class="d">${fmt(d,{weekday:"short",day:1,month:"short"})}</span><span class="c">${ds===td?"Today":parts}</span></button>${dayList(ds,its,tk,dl)}</section>`}
  $("#view").innerHTML=h+"</div></div>";
  if(S.hl){const el=document.getElementById("mag-"+S.hl);S.hl=null;if(el)setTimeout(()=>el.scrollIntoView({behavior:reduced()?"auto":"smooth",block:"start"}),60)}
}

/* ---------- month: cells fill by how booked the day is ---------- */
function renderMonth(){
  const first=new Date(S.cur.getFullYear(),S.cur.getMonth(),1),start=monday(first),td=todayStr();
  const inMonth=ds=>fromYmd(ds).getMonth()===first.getMonth();
  let h=layersHtml()+`<div id="pane"><div class="mgrid"><div class="mhead">${DAYN.map((d,i)=>`<span class="${i>4?"we":""}">${d.slice(0,2)}</span>`).join("")}</div><div class="mdays">`;
  for(let w=0;w<6;w++){const m=addDays(start,w*7);if(w>0&&m.getMonth()!==first.getMonth())break;
    h+=`<div class="mrow" role="button" tabindex="0" data-zweek="${ymd(m)}" aria-label="Week of ${shortD(ymd(m))}. Open the week">`;
    for(let i=0;i<7;i++){const d=addDays(m,i),ds=ymd(d),ev=itemsFor(ds).filter(x=>x.src!=="routines"),tk=tasksDue(ds).filter(t=>!t.done),dl=deadlinesFor(ds).filter(t=>!t.done),hol=ev.find(x=>/^Public holiday/i.test(x.title));
      const bars=[...ev.filter(x=>x!==hol).map(x=>`<i class="k-${x.kind||"work"}"></i>`),...dl.map(()=>`<i class="bdl"></i>`),...tk.map(()=>`<i class="btk"></i>`)];
      h+=`<span class="mday ${inMonth(ds)?"":"out"} ${i>4?"we":""} ${ds===td?"today":""} ${hol?"hol":""}" data-zday-w="${ds}"><span class="fill" style="height:${bookedPct(ds)}%"></span><span class="num">${d.getDate()}</span><span class="bars">${bars.slice(0,3).join("")}</span>${bars.length>3?`<span class="bmore">+${bars.length-3}</span>`:""}</span>`}
    h+=`</div>`}
  h+=`</div><div class="mleg" aria-hidden="true">${Object.entries(KINDS).map(([k,v])=>`<span class="k-${k}"><i></i>${v}</span>`).join("")}<span><i class="btk"></i>Task</span><span><i class="bdl"></i>Deadline</span><span><i class="fl"></i>How booked</span></div></div>`;
  const now=new Date(),lastDay=new Date(first.getFullYear(),first.getMonth()+1,0).getDate(),fromDay=(first.getMonth()===now.getMonth()&&first.getFullYear()===now.getFullYear())?now.getDate():1;
  let list="";
  let listed=0;for(let dd=fromDay;dd<=lastDay&&listed<3;dd++){const d=new Date(first.getFullYear(),first.getMonth(),dd),ds=ymd(d),ev=itemsFor(ds).filter(x=>x.src!=="routines"),tk=tasksDue(ds).filter(t=>!t.done),dl=deadlinesFor(ds).filter(t=>!t.done);if(!ev.length&&!tk.length&&!dl.length)continue;listed++;
    list+=`<section class="wd ${ds===td?"today":""}"><button class="wh" data-zday="${ds}"><span class="d">${fmt(d,{weekday:"short",day:1,month:"short"})}</span><span class="c">${ds===td?"Today":""}</span></button>${dayList(ds,ev,tk,dl)}</section>`}
  h+=`<section class="sec"><div class="sech"><h2>${ic("list")}Next 3 planned days</h2></div>`+(list?`<div class="week">${list}</div>`:`<div class="empty">Nothing planned</div>`)+`</section></div>`;
  $("#view").innerHTML=h;
}

/* ---------- tasks ---------- */
function taskRow(t){
  const td=todayStr(),key=`tasks:${t.id}`,late=t.date&&t.date<td&&!t.done,w=late?daysBetween(t.date,td):0,due=t.date?(t.date===td?"Today":late?`Waiting ${w} day${w>1?"s":""}`:shortD(t.date)):"No date";
  const st=t.steps||[],sd=st.filter(x=>x.done).length,est=t.mins?(t.actual?` · est ${t.mins} min, took ${t.actual}`:` · ${t.mins} min`):(t.actual?` · took ${t.actual} min`:"");
  return `<div class="hrow ${t.done?"done":""} ${S.flash===t.id?"grow":""}"><button class="hmain" data-open="${key}">${ic(itemIcon(t,t.priority==="top"?"star":"task"),"ki")}<span class="tt"><b>${esc(t.title)}${t.example?'<span class="ex">Example</span>':""}</b><span class="sub"><span class="${late?"waitn":""}">${due}</span>${est}${st.length?` · ${sd} of ${st.length} steps`:""}</span>${t.notes?`<span class="hnote">${ic("note")}${esc(t.notes)}</span>`:""}${track(t)}</span></button><button type="button" class="hbtn ${t.notes?"has":""}" data-hnote="${key}" aria-label="${t.notes?"Edit note":"Add a note"}">${ic("note")}</button>${chk(t.id,t.done)}</div>`;
}
function renderTasks(){
  const td=todayStr(),open=S.tasks.filter(t=>!t.done),done=S.tasks.filter(t=>t.done);
  const byP=(a,b)=>(a.priority==="top"?0:1)-(b.priority==="top"?0:1)||(a.date||"9").localeCompare(b.date||"9");
  const today=open.filter(t=>t.date&&t.date<=td).sort(byP),later=open.filter(t=>t.date&&t.date>td).sort(byP),inbox=open.filter(t=>!t.date).sort(byP);
  const sec=(name,icn,list,empty)=>`<section class="sec"><div class="sech"><h2>${ic(icn)}${name}</h2>${list.length?`<span class="cnt">${list.length}</span>`:""}</div>`+(list.length?`<div class="wd">${list.map(taskRow).join("")}</div>`:`<div class="empty">${empty}</div>`)+`</section>`;
  let h=`<form class="quick" id="quick" style="margin-top:14px"><input id="quickIn" placeholder="Add a task to your Inbox" autocomplete="off" aria-label="New task"><button type="submit">Add</button></form>`;
  h+=sec("Today","cal",today,"Nothing due")+sec("Inbox","task",inbox,"Empty")+sec("Coming up","list",later,"Nothing coming up");
  h+=routinesHtml();
  if(done.length)h+=`<details class="done-list" ${S.doneOpen?"open":""}><summary>Done (${done.length})</summary><div class="wd">${done.map(taskRow).join("")}</div></details>`;
  $("#view").innerHTML=h;
  const dt=document.querySelector(".done-list");if(dt)dt.ontoggle=()=>S.doneOpen=dt.open;
}

/* ---------- routines ---------- */
function dayLabel(days){days=[...(days||[])].sort();if(days.length===7)return"Every day";if(days.join()==="1,2,3,4,5")return"Weekdays";if(days.join()==="6,7")return"Weekends";return days.map(d=>DAYN[d-1]).join(", ")}
function renderRoutines(){$("#view").innerHTML=routinesHtml()}
function routinesHtml(){
  const list=[...S.routines].sort((a,b)=>toMin(a.start)-toMin(b.start));
  let h=`<section class="sec"><div class="sech"><h2>${ic("repeat")}Every week</h2><span class="cnt">${list.length||""}</span></div>`;
  h+=list.length?`<div class="list">${list.map(r=>{const key=`routines:${r.id}`;return `<div class="row kb k-${r.kind||"work"}" aria-expanded="${S.open===key}">${ic(itemIcon(r,"repeat"),"star")}<button class="tt" data-open="${key}"><div>${esc(r.title)}${r.example?'<span class="ex">Example</span>':""}</div><div class="meta">${r.start}–${r.end} · ${dayLabel(r.days)}${r.until?(r.until<todayStr()?" · ended":" · until "+fmt(fromYmd(r.until),{day:1,month:"short"})+" "+r.until.slice(0,4)):""}</div></button><span class="chip">${KINDS[r.kind]||"Work"}</span></div>`}).join("")}</div>`:`<div class="empty">No routines yet. Add one with the + button.</div>`;
  return h+`</section>`;
}

/* ---------- render: keeps your scroll position, no jumps ---------- */
function render(keepScroll=true){
  const y=scrollY;renderHeader();
  ({home:renderHome,cal:renderCal,tasks:renderTasks,routines:renderRoutines})[S.view]();
  if(keepScroll)scrollTo(0,y);
  if(S.dock)renderDock();
}
function animate(cls,origin){
  const v=(cls==="sl"||cls==="sr")&&$("#pane")||$("#view");v.classList.remove("zin","zout","sl","sr");void v.offsetWidth;
  if(origin){const r=v.getBoundingClientRect();v.style.setProperty("--ox",(origin.x-r.left)+"px");v.style.setProperty("--oy",(origin.y-r.top)+"px")}else{v.style.setProperty("--ox","50%");v.style.setProperty("--oy","0px")}
  v.classList.add(cls);v.addEventListener("animationend",()=>v.classList.remove(cls),{once:true});
}

/* sideways moves: only the content under the strip slides and crossfades; the selected day glides along the strip */
function slide(update,dir,top=true){
  const keepTop=()=>{if(!top)return;const st=document.querySelector(".strip,.layers");if(!st)return;const hdr=$("header.top").offsetHeight,lim=Math.max(0,st.getBoundingClientRect().top+scrollY-hdr-8);if(scrollY>lim)scrollTo(0,lim)};
  if(document.startViewTransition&&!reduced()){document.documentElement.dataset.dir=dir;const t=document.startViewTransition(()=>{update();keepTop()});t.finished.finally(()=>delete document.documentElement.dataset.dir);return}
  update();keepTop();animate(dir==="next"?"sl":"sr");
}
function pickDay(ds){const dir=ds>ymd(S.cur)?"next":"prev";slide(()=>{S.cur=fromYmd(ds);S.open=null;S.dock=null;renderDock();renderDay._scrolled=true;setHash(calHash());store.set("lastCal",calHash());render()},dir)}

/* ---------- navigation ---------- */
S.scroll=store.get("scroll",{});
const viewKey=()=>S.view==="cal"?"cal-"+S.zoom:S.view;
function rememberScroll(){S.scroll[viewKey()]=scrollY;store.set("scroll",S.scroll)}
const calHash=()=>`cal/${S.zoom}/${ymd(S.cur)}`;
function setHash(h){if(location.hash.slice(1)!==h)history.replaceState(null,"","#"+h)}
function goCal(zoom,date,origin){
  rememberScroll();S.dock=null;renderDock();
  const was=S.view==="cal"?LEVEL[S.zoom]:null,to=LEVEL[zoom];
  S.view="cal";S.zoom=zoom;if(date)S.cur=typeof date==="string"?fromYmd(date):new Date(date);S.cur.setHours(0,0,0,0);
  if(zoom==="day")renderDay._scrolled=false;
  S.open=null;store.set("lastCal",calHash());setHash(calHash());
  render(false);if(zoom!=="day"||ymd(S.cur)!==todayStr())scrollTo(0,0);
  if(was!==null&&was!==to)animate(to>was?"zin":"zout",origin);else animate("sl");
}
function go(view){
  rememberScroll();S.dock=null;renderDock();S.open=null;
  if(view==="cal"){const n=new Date();S.zoom="month";S.cur=new Date(n.getFullYear(),n.getMonth(),1);S.view="cal";setHash(calHash())}
  else{S.view=view;setHash(view)}
  render(false);const y=S.scroll[viewKey()];if(y!==undefined)scrollTo(0,y);animate("sl");
}
function step(n){
  slide(()=>{if(S.zoom==="month")S.cur=new Date(S.cur.getFullYear(),S.cur.getMonth()+n,1);else S.cur=addDays(S.cur,S.zoom==="week"?7*n:n);
    S.open=null;S.dock=null;renderDock();renderDay._scrolled=true;store.set("lastCal",calHash());setHash(calHash());render()},n>0?"next":"prev",false);
}
function zoomOut(){if(S.zoom==="day"){S.hl=ymd(S.cur);goCal("week")}else if(S.zoom==="week")goCal("month")}
function zoomIn(origin){
  if(S.zoom==="month"){const n=new Date(),same=S.cur.getMonth()===n.getMonth()&&S.cur.getFullYear()===n.getFullYear();goCal("week",monday(same?n:S.cur),origin)}
  else if(S.zoom==="week"){const m=monday(S.cur),t=todayStr();goCal("day",ymd(m)<=t&&t<=ymd(addDays(m,6))?t:ymd(m),origin)}
}
function route(){
  const h=location.hash.slice(1),p=h.split("/");
  if(p[0]==="cal"){S.view="cal";S.zoom=LEVEL[p[1]]!==undefined?p[1]:"month";S.cur=p[2]&&/^\d{4}-\d\d-\d\d$/.test(p[2])?fromYmd(p[2]):new Date();S.cur.setHours(0,0,0,0)}
  else if(["day","week","month"].includes(p[0])){S.view="cal";S.zoom=p[0]}
  else S.view=["home","tasks","routines"].includes(p[0])?p[0]:"home";
  closeSheet();render(false);
}
addEventListener("hashchange",route);

/* ---------- search ---------- */
function openSearch(){
  sheet("Search",`<div class="in"><div class="sbox"><input id="sq" type="search" placeholder="Search tasks, blocks and routines" autocomplete="off" aria-label="Search"></div><div class="sres" id="sres"></div><div class="acts sticky"><button class="ghost" type="button" id="sClose" style="flex:1">Close</button></div></div>`);
  const q=$("#sq"),out=$("#sres");$("#sClose").onclick=closeSheet;
  const mark=(t,w)=>esc(t).replace(new RegExp("("+esc(w).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig"),"<mark>$1</mark>");
  const run=()=>{const w=q.value.trim();if(w.length<2){out.innerHTML=`<p class="hint">Type at least 2 letters.</p>`;return}const lw=w.toLowerCase(),hit=x=>(x.title||"").toLowerCase().includes(lw)||(x.notes||"").toLowerCase().includes(lw);
    const res=[...S.blocks.filter(hit).sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(b=>`<button class="wi k-${b.kind||"work"}" data-sgo="blocks:${b.id}:${b.date}">${ic(itemIcon(b,b.kind||"work"),"ki")}<span class="tt">${mark(b.title,w)}<span class="sub">${shortD(b.date)} · ${b.start}–${b.end}</span></span></button>`),
      ...S.routines.filter(hit).map(r=>`<button class="wi k-${r.kind||"work"}" data-sgo="routines:${r.id}">${ic(itemIcon(r,"repeat"),"ki")}<span class="tt">${mark(r.title,w)}<span class="sub">${dayLabel(r.days)} · ${r.start}–${r.end}</span></span></button>`),
      ...S.tasks.filter(hit).map(t=>`<button class="wi" data-sgo="tasks:${t.id}">${ic(itemIcon(t,t.priority==="top"?"star":"task"),"ki")}<span class="tt ${t.done?"strike":""}">${mark(t.title,w)}<span class="sub">${t.done?"Done":t.date?"Due "+shortD(t.date):"Inbox"}</span></span></button>`)];
    out.innerHTML=res.length?res.join(""):`<p class="hint">Nothing matches "${esc(w)}".</p>`};
  q.oninput=run;run();setTimeout(()=>q.focus(),60);
  out.onclick=e=>{const b=e.target.closest("[data-sgo]");if(!b)return;const[col,id,date]=b.dataset.sgo.split(":");closeSheet();
    if(col==="blocks"){goCal("day",date);openDock(`blocks:${id}:${date}`)}
    else{go("tasks");openDock(`${col}:${id}`)}};
}

/* ---------- sheets (edit, settings, search) ---------- */
function closeSheet(){$("#sheetRoot").innerHTML=""}
function sheet(label,inner){
  $("#sheetRoot").innerHTML=`<div class="scrim" id="scrim"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">${inner}</div>`;
  $("#scrim").onclick=closeSheet;
}

/* ---------- 24-hour time picker ---------- */
function tp(id,val,label){
  const [h,m]=(val||"09:00").split(":");const mins=["00","15","30","45"];if(!mins.includes(m))mins.push(m),mins.sort();
  return `<div class="f"><span class="lb" id="${id}L">${label}</span><div class="tp" id="${id}" role="group" aria-labelledby="${id}L"><select data-h aria-label="${label} hour">${Array.from({length:24},(_,i)=>`<option ${pad(i)===h?"selected":""}>${pad(i)}</option>`).join("")}</select><b>:</b><select data-m aria-label="${label} minutes">${mins.map(x=>`<option ${x===m?"selected":""}>${x}</option>`).join("")}</select></div></div>`;
}
const tpv=id=>{const g=$("#"+id);return g.querySelector("[data-h]").value+":"+g.querySelector("[data-m]").value};
const tpset=(id,v)=>{const g=$("#"+id),[h,m]=v.split(":"),ms=g.querySelector("[data-m]");g.querySelector("[data-h]").value=h;if(![...ms.options].some(o=>o.value===m))ms.add(new Option(m,m));ms.value=m};
function linkTimes(a,b){let dur=toMin(tpv(b))-toMin(tpv(a));$("#"+a).onchange=()=>{const s=toMin(tpv(a));tpset(b,hm(Math.min(s+Math.max(dur,15),23*60+45)))};$("#"+b).onchange=()=>{dur=toMin(tpv(b))-toMin(tpv(a))}}

/* ---------- add / edit sheet ---------- */
const optsHtml=(id,items,cur,attr)=>`<div class="opts" id="${id}">${items.map(([v,l])=>`<button type="button" data-${attr}="${v}" aria-pressed="${String(v)===String(cur)}">${l}</button>`).join("")}</div>`;
const picked=(id,attr,def)=>{const b=document.querySelector(`#${id} [aria-pressed="true"]`);return b?b.dataset[attr]:def};
function openSheet(type,rec,preset){
  const isNew=!rec;rec=rec||{};preset=preset||{};S.dock=null;renderDock();
  const noun={blocks:"time block",tasks:"task",routines:"routine"}[type];
  const kind=rec.kind||preset.kind||"work",icon=rec.icon||preset.icon||"";
  const kindOpts=`<div class="f"><span class="lb">Type</span>${optsHtml("fKind",Object.entries(KINDS),kind,"k")}</div>`;
  const iconOpts=`<div class="f"><span class="lb">Icon</span><div class="icp" id="fIcon"><button type="button" data-i="" aria-pressed="${!icon}" aria-label="Use the type's icon">Auto</button>${PICK.map(n=>`<button type="button" data-i="${n}" aria-pressed="${icon===n}" aria-label="${n}">${ic(n)}</button>`).join("")}</div></div>`;
  let main=`<div class="f"><label for="fTitle">What</label><input id="fTitle" value="${esc(rec.title||preset.title||"")}" placeholder="${type==="tasks"?"Send Virlocept proposal":type==="routines"?"School pickup":"Client call"}" autocomplete="off"></div>`;
  let more="",moreNote="",moreOpen=false;
  if(type==="blocks"){
    const st=rec.start||preset.start||"09:00",en=rec.end||preset.end||hm(Math.min(toMin(st)+60,23*60+45));
    main+=`<div class="f"><label for="fDate">Day</label><input id="fDate" type="date" value="${rec.date||preset.date||ymd(S.cur)}"></div><div class="two">${tp("fStart",st,"Start")}${tp("fEnd",en,"End")}</div>`+kindOpts+iconOpts;
  }else if(type==="tasks"){
    const pri=(rec.priority||preset.priority)==="top"?"top":"normal";
    main+=`<div class="f"><label for="fDate">Do by <span class="opt">(optional)</span></label><input id="fDate" type="date" value="${rec.date||preset.date||""}"></div><div class="f"><span class="lb">Priority</span>${optsHtml("fPri",[["top","Top 3"],["normal","Normal"]],pri,"p")}</div>`;
    more+=`<div class="two"><div class="f"><label for="fFor">For event on</label><input id="fFor" type="date" value="${rec.for||""}"></div><div class="f"><label for="fMins">Minutes</label><input id="fMins" type="number" min="5" step="5" inputmode="numeric" value="${rec.mins||""}" placeholder="30"></div></div>`+iconOpts;
    moreNote="Event date, minutes, icon, steps";moreOpen=!!(rec.for||rec.mins||rec.icon||(rec.steps||[]).length);
  }else{
    const days=rec.days||[1,2,3,4,5],st=rec.start||"08:00",en=rec.end||"08:30";
    main+=`<div class="two">${tp("fStart",st,"Start")}${tp("fEnd",en,"End")}</div><div class="f"><span class="lb">Repeats on</span><div class="opts" id="fDays">${DAYN.map((n,i)=>`<button type="button" data-d="${i+1}" aria-pressed="${days.includes(i+1)}">${n}</button>`).join("")}</div></div>`+kindOpts+iconOpts;
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
  form.querySelectorAll(".opts,.icp").forEach(g=>g.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;if(g.id==="fDays")b.setAttribute("aria-pressed",b.getAttribute("aria-pressed")==="true"?"false":"true");else{g.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed","false"));b.setAttribute("aria-pressed","true")}}));
  $("#fCancel").onclick=closeSheet;
  if(!isNew){const del=$("#fDel");del.onclick=()=>{
    if(type==="routines"&&!del.dataset.armed){del.dataset.armed=1;del.textContent="Tap again: deletes every week";return}
    const before=strip(rec);S.open=null;remove(type,rec.id);closeSheet();toast("Deleted",()=>{save(type,rec.id,before);toast("Restored")})}}
  setTimeout(()=>{if(isNew)$("#fTitle").focus()},60);
  form.onsubmit=e=>{e.preventDefault();const err=$("#fErr");err.textContent="";
    const t=$("#fTitle").value.trim();if(!t){err.textContent="Give it a name first.";$("#fTitle").focus();return}
    const k=picked("fKind","k","work"),icn=picked("fIcon","i","");let data;
    if(type==="blocks"){const s=tpv("fStart"),en=tpv("fEnd"),d=$("#fDate").value;
      if(!d){err.textContent="Pick a day.";return}if(toMin(en)<=toMin(s)){err.textContent="End time needs to be after the start time.";return}
      data={...strip(rec),title:t,date:d,start:s,end:en,kind:k};if(preset.taskId)data.taskId=preset.taskId}
    else if(type==="tasks"){const p=picked("fPri","p","normal"),d=$("#fDate").value||null,mins=parseInt($("#fMins").value)||null;
      if(p==="top"&&d){const n=S.tasks.filter(x=>x.id!==rec.id&&x.date===d&&x.priority==="top"&&!x.done).length;if(n>=3){err.textContent="That day already has 3 top tasks. Finish or downgrade one first.";return}}
      data={...strip(rec),title:t,date:d,priority:p,mins,done:!!rec.done,createdAt:rec.createdAt||Date.now()};const fv=$("#fFor").value;if(fv)data.for=fv;else delete data.for}
    else{const s=tpv("fStart"),en=tpv("fEnd"),days=[...form.querySelectorAll('#fDays [aria-pressed="true"]')].map(b=>+b.dataset.d);
      if(!days.length){err.textContent="Pick at least one day.";return}if(toMin(en)<=toMin(s)){err.textContent="End time needs to be after the start time.";return}
      data={...strip(rec),title:t,start:s,end:en,days,kind:k,skips:rec.skips||[]};const u=$("#fUntil").value;if(u)data.until=u;else delete data.until}
    if(icn)data.icon=icn;else delete data.icon;
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
  closeSheet();S.dock=null;renderDock();
  const root=document.createElement("div");root.id="focus";root.className="focus k-"+F.kind;root.setAttribute("role","dialog");root.setAttribute("aria-label","Focus: "+F.title);
  root.innerHTML=`<div class="fin"><span class="lb">${ic(itemIcon(rec,"focus"))}Focus</span><h2 class="ft">${esc(F.title)}</h2><div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="trk"/><circle cx="60" cy="60" r="52" class="prg" id="fPrg"/></svg><div class="fc"><span id="fLeft">--:--</span><small id="fOf"></small></div></div><div class="acts"><button class="ghost" id="fPause" type="button">Pause</button><button class="primary" id="fDoneB" type="button">${ic("tick")}Done</button><button class="ghost" id="fStop" type="button">Stop</button></div></div>`;
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
    if(finished&&F.col==="tasks"){const t=S.tasks.find(x=>x.id===F.id);if(t){const before=strip(t);buzz();save("tasks",t.id,{...before,done:true,actual:(t.actual||0)+used()});cheer(`Done in ${inFmt(used())}`,()=>save("tasks",t.id,before));return}}
    if(finished)cheer(`${inFmt(used())} focused`)};
  $("#fDoneB").onclick=()=>end(true);
  $("#fStop").onclick=()=>{if(F.col==="tasks"){const t=S.tasks.find(x=>x.id===F.id);if(t&&used()>1)save("tasks",t.id,{...strip(t),actual:(t.actual||0)+used()})}end(false)};
}

/* ---------- little celebrations ---------- */
const buzz=()=>{try{navigator.vibrate?.(15)}catch(_){}};
function cheer(msg,undo){toast(msg,undo);if(reduced())return;
  const c=document.createElement("canvas");c.className="confetti";document.body.appendChild(c);const x=c.getContext("2d"),dpr=devicePixelRatio,W=c.width=innerWidth*dpr,H=c.height=innerHeight*dpr;
  const cs=getComputedStyle(document.documentElement),cols=["--k-work","--k-family","--k-admin","--k-me","--accent"].map(v=>cs.getPropertyValue(v).trim());
  const P=Array.from({length:70},()=>({x:W/2+(Math.random()-.5)*W*.3,y:H*.62,vx:(Math.random()-.5)*14*dpr,vy:-(8+Math.random()*12)*dpr,r:(3+Math.random()*4)*dpr,c:cols[Math.floor(Math.random()*cols.length)],a:Math.random()*6}));
  let f=0;const st=()=>{x.clearRect(0,0,W,H);P.forEach(p=>{p.vy+=.45*dpr;p.x+=p.vx;p.y+=p.vy;p.a+=.2;x.save();x.translate(p.x,p.y);x.rotate(p.a);x.fillStyle=p.c;x.fillRect(-p.r,-p.r/2,p.r*2,p.r);x.restore()});if(++f<70)requestAnimationFrame(st);else c.remove()};st()}
function toggleTask(t,el){
  const before=strip(t),done=!t.done,undo=()=>save("tasks",t.id,before);
  const commit=()=>{save("tasks",t.id,{...before,done});
    if(!done){toast("Marked not done",undo);return}
    const ds=todayStr(),top=S.tasks.filter(x=>x.priority==="top"&&(x.date===ds||(x.date&&x.date<ds&&!x.done)||x.id===t.id));
    if(t.priority==="top"&&top.length&&top.every(x=>x.id===t.id||x.done))cheer("Top 3 done. Great day.",undo);else toast("Done",undo)};
  if(done){buzz();const row=el&&el.closest(".row,.t3");if(row&&!reduced()){el.setAttribute("aria-pressed","true");row.classList.add("ticked");setTimeout(commit,260);return}}
  commit();
}

/* ---------- events ---------- */
function quickBlock(d){const g=firstGap(d,60);openSheet("blocks",null,{date:d,start:g!==null?hm(g):S.work.start,end:g!==null?hm(g+60):hm(toMin(S.work.start)+60)})}
const pt=e=>({x:e.clientX,y:e.clientY});
document.addEventListener("change",e=>{const cb=e.target.closest("[data-step]");if(!cb)return;const r=resolve(cb.dataset.key);if(!r)return;const st=(r.rec.steps||[]).map(x=>({...x}));st[+cb.dataset.step].done=cb.checked;save(r.col,r.rec.id,{...strip(r.rec),steps:st});if(cb.checked&&st.every(x=>x.done))cheer("All steps done")});
document.addEventListener("click",e=>{
  if(e.target.closest("[data-step]")||e.target.closest(".step"))return;
  const v=e.target.closest(".tabs button");if(v){go(v.dataset.v);return}
  const tg=e.target.closest("[data-toggle]");if(tg){const t=S.tasks.find(x=>x.id===tg.dataset.toggle);if(t)toggleTask(t,tg);return}
  const ac=e.target.closest("[data-act]");if(ac){const r=resolve(ac.dataset.key);if(!r)return;const{col,rec,date}=r,a=ac.dataset.act;
    if(a==="focus")startFocus(col,rec,date);
    else if(a==="edit")openSheet(col,rec,{});
    else if(a==="done"){S.dock=null;toggleTask(rec)}
    else if(a==="idone"){setItemDone(ac.dataset.key)}
    else if(a==="inote"){S.noteFor=ac.dataset.key;renderDock();const ta=$("#hNoteIn");if(ta){ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)}return}
    else if(a==="skip"){const set=new Set(rec.skips||[]),sk=set.has(date);sk?set.delete(date):set.add(date);const before=strip(rec);S.dock=null;S.open=null;save("routines",rec.id,{...before,skips:[...set]});toast(sk?"Back on for that day":"Skipped for that day",()=>save("routines",rec.id,before))}
    renderDock();return}
  const fb=e.target.closest("[data-focus]");if(fb){const[col,id,date]=fb.dataset.focus.split(":");const r=S[col].find(x=>x.id===id);if(r)startFocus(col,r,date);return}
  const dk=e.target.closest("[data-dock]");if(dk){openDock(dk.dataset.dock);return}
  const op=e.target.closest("[data-open]");if(op){S.noteFor=null;openDock(op.dataset.open);return}
  const ly=e.target.closest("[data-layer]");if(ly){const k=ly.dataset.layer;S.hide.has(k)?S.hide.delete(k):S.hide.add(k);store.set("hide",[...S.hide]);render();return}
  if(e.target.closest("[data-today]")){const n=new Date();n.setHours(0,0,0,0);const dir=n>S.cur?"next":"prev";slide(()=>{S.cur=n;renderDay._scrolled=true;setHash(calHash());store.set("lastCal",calHash());render()},dir);return}
  if(e.target.closest("[data-search]")){openSearch();return}
  const cr=e.target.closest("[data-crumb]");if(cr){if(cr.dataset.crumb==="week")S.hl=ymd(S.cur);goCal(cr.dataset.crumb,null,pt(e));return}
  const pk=e.target.closest("[data-pick]");if(pk){if(pk.dataset.pick!==ymd(S.cur))pickDay(pk.dataset.pick);return}
  const pw=e.target.closest("[data-pickw]");if(pw){const n=pw.dataset.pickw;if(n!==ymd(monday(S.cur)))slide(()=>{S.cur=fromYmd(n);S.open=null;setHash(calHash());store.set("lastCal",calHash());render()},n>ymd(monday(S.cur))?"next":"prev");return}
  const zd=e.target.closest("[data-zday]");if(zd){goCal("day",zd.dataset.zday,pt(e));return}
  const zw=e.target.closest("[data-zweek]");if(zw){const cell=e.target.closest("[data-zday-w]");S.hl=cell?cell.dataset.zdayW:null;goCal("week",zw.dataset.zweek,pt(e));return}
  const at=e.target.closest("[data-addtop]");if(at){openSheet("tasks",null,{date:at.dataset.addtop,priority:"top"});return}
  const sl=e.target.closest("[data-slot]");if(sl){const s=sl.dataset.slot;openSheet("blocks",null,{start:s,end:hm(Math.min(toMin(s)+60,23*60+45)),date:sl.dataset.slotday||ymd(S.cur)});return}
  const pl=e.target.closest("[data-plan]");if(pl){const t=S.tasks.find(x=>x.id===pl.dataset.plan);const m=t.mins||60;let d=t.date&&t.date>=todayStr()?t.date:todayStr(),g=firstGap(d,m);
    if(g===null&&!t.date){for(let i=1;i<8&&g===null;i++){const dd=ymd(addDays(fromYmd(todayStr()),i));if(isWorkday(fromYmd(dd))){g=firstGap(dd,m);if(g!==null)d=dd}}}
    const st=g??toMin(S.work.start);openSheet("blocks",null,{title:t.title,date:d,start:hm(st),end:hm(Math.min(st+m,23*60+45)),taskId:t.id,kind:"work",icon:t.icon});return}
  const ak=e.target.closest("[data-addk]");if(ak){const k=ak.dataset.addk,d=ak.dataset.addday;closeSheet();if(k==="block")quickBlock(d);else if(k==="task")openSheet("tasks",null,{date:d});else openSheet("routines");return}
  const qa=e.target.closest("[data-qa]");if(qa){const a=qa.dataset.qa;
    if(a==="block")quickBlock(todayStr());else if(a==="task")openSheet("tasks");else if(a==="routines")go("routines");
    else if(a==="focus"){const ds=todayStr(),mm=nowMin(),cur=allItemsFor(ds).filter(i=>toMin(i.start)<=mm&&toMin(i.end)>mm).pop();
      if(cur)startFocus(cur.src,S[cur.src].find(x=>x.id===cur.id),ds);
      else{const t=S.tasks.find(x=>x.priority==="top"&&!x.done&&x.date&&x.date<=ds)||S.tasks.find(x=>!x.done&&x.date===ds);startFocus("tasks",t||{id:"_free",title:"Focus session",mins:25},ds)}}
    return}
  const hdn=e.target.closest("[data-hdone]");if(hdn){const nowDone=setItemDone(hdn.dataset.hdone);if(nowDone&&navigator.vibrate)try{navigator.vibrate(12)}catch(_){}return}
  const hn=e.target.closest("[data-hnote]");if(hn){S.noteFor=hn.dataset.hnote;openDock(hn.dataset.hnote);const ta=$("#hNoteIn");if(ta){ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)}return}
  if(e.target.closest("[data-hnotecancel]")){S.noteFor=null;renderDock();return}
  const hd=e.target.closest("[data-homeday]");if(hd){const v=hd.dataset.homeday,ds=todayStr();if(v===homeDay(ds))return;store.set("homeDay",v===(todayDone(ds)?"tomorrow":"today")?null:{on:ds,v});S.homeSlide=v==="tomorrow"?"in-next":"in-prev";render();S.homeSlide="";return}
  if(e.target.closest("[data-settings]")){openSettings();return}
  const gd=e.target.closest("[data-goday]");if(gd){goCal("day",gd.dataset.goday,pt(e));return}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if($("#sheetRoot").innerHTML)closeSheet();else if(S.dock){S.dock=null;renderDock()}else if(S.view==="cal")zoomOut();return}
  const mr=e.target.closest&&e.target.closest(".mrow");if(mr&&(e.key==="Enter"||e.key===" ")){e.preventDefault();goCal("week",mr.dataset.zweek)}});
$("#prev").onclick=()=>step(-1);
$("#next").onclick=()=>step(1);
$("#out").onclick=zoomOut;
$("#nowbar").onclick=()=>goCal("day",todayStr());
$("#search").onclick=openSearch;
$("#fab").onclick=()=>openAdd(S.view==="cal"&&S.zoom==="day"?ymd(S.cur):S.view==="home"&&homeDay(todayStr())==="tomorrow"?ymd(addDays(new Date(),1)):todayStr());
/* one add sheet on every screen: block (in the next free time), task or routine */
function openAdd(ds){
  const g=firstGap(ds,30),when=g!==null?`Next free time ${hm(g)}`:"Pick a time";
  sheet("Add",`<div class="in"><h3>Add to ${ds===todayStr()?"today":longD(ds)}</h3><div class="addc">
    <button type="button" data-addk="block" data-addday="${ds}">${ic("clock")}<b>Time block</b><span>${esc(when)}</span></button>
    <button type="button" data-addk="task" data-addday="${ds}">${ic("task")}<b>Task</b><span>For ${ds===todayStr()?"today":shortD(ds)}, no time yet</span></button>
    <button type="button" data-addk="routine">${ic("repeat")}<b>Routine</b><span>Repeats every week</span></button></div>
    <div class="acts"><button class="ghost" type="button" id="addX" style="flex:1">Cancel</button></div></div>`);
  $("#addX").onclick=closeSheet;
}
document.addEventListener("submit",e=>{const nf=e.target.closest("[data-hnoteform]");if(nf){e.preventDefault();const k=nf.dataset.hnoteform,v=$("#hNoteIn").value.trim();S.noteFor=null;setItemNote(k,v);toast(v?"Note saved":"Note removed");return}});
document.addEventListener("submit",e=>{if(e.target.id!=="quick")return;e.preventDefault();const i=$("#quickIn"),t=i.value.trim();if(!t)return;const id=uid();save("tasks",id,{title:t,date:null,priority:"normal",mins:null,done:false,createdAt:Date.now()});toast("Added to Inbox",()=>remove("tasks",id));setTimeout(()=>{const n=$("#quickIn");if(n)n.focus()},30)});

/* swipe left and right between periods; pinch to zoom in and out */
{let t0=null,pinch=null;
 const busyUI=()=>$("#sheetRoot").innerHTML||$("#focus");
 document.addEventListener("touchstart",e=>{if(S.view!=="cal"||busyUI())return;
   if(e.touches.length===2){const[a,b]=e.touches;pinch={d:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2};t0=null}
   else if(e.touches.length===1&&!e.target.closest(".layers,.dock,.tabs,header,.strip")){const p=e.touches[0];t0={x:p.clientX,y:p.clientY,t:Date.now()}}},{passive:true});
 document.addEventListener("touchmove",e=>{if(pinch&&e.touches.length===2){const[a,b]=e.touches;pinch.n=Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)}},{passive:true});
 document.addEventListener("touchend",e=>{
   if(pinch){if(e.touches.length)return;const r=(pinch.n||pinch.d)/pinch.d,o={x:pinch.x,y:pinch.y};pinch=null;if(r>1.25)zoomIn(o);else if(r<.8)zoomOut();return}
   if(!t0||e.changedTouches.length!==1)return;const p=e.changedTouches[0],dx=p.clientX-t0.x,dy=p.clientY-t0.y,dt=Date.now()-t0.t;t0=null;
   if(dt<600&&Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.8)step(dx<0?1:-1)},{passive:true});
}

/* every 30 seconds: keep times live, without moving the page */
setInterval(()=>{applyTint();if($("#sheetRoot").innerHTML||$("#focus"))return;
  if(document.activeElement?.id==="hNoteIn")return;
  if(S.view==="home"||(S.view==="cal"&&(S.zoom==="week"||(S.zoom==="day"&&ymd(S.cur)===todayStr()))))render();else renderNowbar()},30000);

/* ---------- store: cached data shows at once, fresh data follows ---------- */
function applyData(d){
  S.tasks=d.tasks||[];S.blocks=d.blocks||[];S.routines=d.routines||[];
  const st=d.settings||{};S.work={start:st.workStart||"09:00",end:st.workEnd||"16:00"};S.lead=st.leadMin??10;S.morning=st.morning||null;
  if(st.palette&&st.palette!==S.palette)applyPalette(st.palette);
}
async function load(){
  try{
    const r=await fetch("/api/data",{cache:"no-store"});
    if(r.status===401){location.href="/login";return}
    if(!r.ok)throw new Error();
    const d=await r.json();applyData(d);
    S.publicKey=d.alerts.publicKey;S.devices=d.alerts.devices;S.lastCheck=d.alerts.lastCheck||null;S.connector=d.connectorUrl;
    cacheData();status("");
    if(!$("#sheetRoot").innerHTML&&!["quickIn","hNoteIn"].includes(document.activeElement?.id))render();
  }catch(_){status(S.cached?"Showing your last saved plan. Changes will sync once you're back online.":"Can't reach your planner right now. Check your connection; changes will show once it's back.")}
}
let myVersion=null;
async function checkVersion(){try{const r=await fetch("/api/version",{cache:"no-store"});if(!r.ok)return;const v=(await r.json()).version;if(myVersion===null){myVersion=v;return}if(v!==myVersion&&!$("#sheetRoot").innerHTML&&!$("#focus"))location.reload()}catch(_){}}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){applyTint();load();checkVersion()}else rememberScroll()});
checkVersion();

/* ---------- alerts ---------- */
const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
const installed=matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;
const pushSupported="serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
let swReg=null;
async function initSW(){
  if(!("serviceWorker" in navigator))return;
  try{swReg=await navigator.serviceWorker.register("/sw.js");const sub=await swReg.pushManager?.getSubscription();S.alertsHere=!!sub;S.endpoint=sub?.endpoint||null;if(!$("#sheetRoot").innerHTML)render()}catch(_){}
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
  if(S.devices)alertHtml+=`<p class="hint ${alertsStale()?"warn":""}">${esc(lastCheckTxt())}${alertsStale()?" Alerts only go out while cron-job.org opens the alert link every 5 minutes.":""}</p>`;
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
  $("#sPal").onclick=e=>{const b=e.target.closest("button");if(!b)return;applyPalette(b.dataset.p);$("#sPal").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));renderHeader()};
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
    try{const j=await api({op:"settings",data:{workStart:st,workEnd:en,leadMin:lead,morning:morn,palette:S.palette}});S.work={start:j.settings.workStart,end:j.settings.workEnd};S.lead=j.settings.leadMin;S.morning=j.settings.morning||null;cacheData();closeSheet();render();toast("Saved")}catch(e){err.textContent=e.message}};
}
$("#gear").onclick=openSettings;

/* ---------- start ---------- */
{const c=store.get("cache",null);if(c){applyData(c);S.cached=true}}
route();
if(!S.cached)status("Loading your planner…");
load();initSW();
})();
