
(function(){
const KINDS={work:"Work",family:"Family",admin:"Admin",me:"Me time"};
const DAYN=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const START_H=5, END_H=22;
const S={work:{start:"09:00",end:"16:00"},view:"day",cur:new Date(),tasks:[],blocks:[],routines:[],db:null,live:false};
S.cur.setHours(0,0,0,0);

const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad=n=>String(n).padStart(2,"0");
const ymd=d=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const fromYmd=s=>{const[a,b,c]=s.split("-").map(Number);return new Date(a,b-1,c)};
const wd=d=>((d.getDay()+6)%7)+1; // Mon=1..Sun=7
const toMin=t=>{const[h,m]=(t||"0:0").split(":").map(Number);return h*60+m};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x};
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],MONL=["January","February","March","April","May","June","July","August","September","October","November","December"],DAYL=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const fmt=(d,o)=>{o=o||{};const p=[];if(o.weekday)p.push(o.weekday==="long"?DAYL[wd(d)-1]:DAYN[wd(d)-1]);if(o.day)p.push(d.getDate());if(o.month)p.push(o.month==="long"?MONL[d.getMonth()]:MON[d.getMonth()]);return p.join(" ")};
const todayStr=()=>ymd(new Date());
const uid=()=>Math.random().toString(36).slice(2,10)+Date.now().toString(36).slice(-4);

function toast(msg){const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,2600)}
function status(msg){const s=$("#status");s.textContent=msg||"";s.hidden=!msg}

/* ---------- data ---------- */
async function api(body){
  const r=await fetch("/api/data",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  if(r.status===401){location.href="/login";throw new Error("signed out")}
  if(!r.ok){let m="Couldn't save. Check your connection and try again.";try{m=(await r.json()).error||m}catch(_){}throw new Error(m)}
  return r.json();
}
async function save(col,id,data){
  const list=S[col];const i=list.findIndex(x=>x.id===id);
  const rec={...data,id};
  if(i>=0)list[i]=rec;else list.push(rec);
  render();
  const body={...data};delete body.id;
  try{await api({op:"set",col,id,data:body})}catch(e){toast(e.message);load()}
}
async function remove(col,id){
  S[col]=S[col].filter(x=>x.id!==id);render();
  try{await api({op:"delete",col,id})}catch(e){toast(e.message);load()}
}
function itemsFor(dateStr){
  const d=fromYmd(dateStr),w=wd(d);
  const b=S.blocks.filter(x=>x.date===dateStr).map(x=>({...x,src:"blocks"}));
  const r=S.routines.filter(x=>(x.days||[]).includes(w)&&!(x.skips||[]).includes(dateStr)).map(x=>({...x,src:"routines",date:dateStr}));
  return b.concat(r).sort((a,b)=>toMin(a.start)-toMin(b.start));
}

/* ---------- header ---------- */
function renderHeader(){
  document.querySelectorAll(".tabs button").forEach(b=>b.setAttribute("aria-current",b.dataset.v===S.view?"page":"false"));
  const c=S.cur,isToday=ymd(c)===todayStr();
  let sub="",main="";
  if(S.view==="day"){const t=new Date();t.setHours(0,0,0,0);const diff=Math.round((c-t)/864e5);sub=diff===0?"Today":diff===1?"Tomorrow":diff===-1?"Yesterday":DAYL[wd(c)-1];main=fmt(c,{weekday:"short",day:1,month:"short"})}
  else if(S.view==="week"){const m=addDays(c,1-wd(c)),s=addDays(m,6);sub="Week";main=fmt(m,{day:1,month:"short"})+" to "+fmt(s,{day:1,month:"short"})}
  else if(S.view==="month"){sub=String(c.getFullYear());main=MONL[c.getMonth()]}
  else if(S.view==="tasks"){sub=fmt(new Date(),{weekday:"long",day:1,month:"long"});main="Tasks"}
  else{sub="Repeats every week";main="Routines"}
  $("#dsub").textContent=sub;$("#dmain").textContent=main;
  const nav=S.view==="day"||S.view==="week"||S.view==="month";
  $("#prev").hidden=!nav;$("#next").hidden=!nav;$("#todayBtn").hidden=!nav||(S.view==="day"&&isToday)||(S.view==="week"&&ymd(addDays(c,1-wd(c)))===ymd(addDays(new Date(),1-wd(new Date()))))||(S.view==="month"&&c.getMonth()===new Date().getMonth()&&c.getFullYear()===new Date().getFullYear());
  $("#fab").textContent={day:"+ Block",week:"+ Block",month:"+ Block",tasks:"+ Task",routines:"+ Routine"}[S.view];
}

/* ---------- day ---------- */
function layoutLanes(items){
  const out=[];let cluster=[],clusterEnd=-1;
  const flush=()=>{const lanes=[];cluster.forEach(it=>{let l=lanes.findIndex(e=>e<=toMin(it.start));if(l<0){l=lanes.length;lanes.push(0)}lanes[l]=toMin(it.end);it._lane=l});cluster.forEach(it=>it._lanes=lanes.length);out.push(...cluster);cluster=[]};
  items.forEach(it=>{if(toMin(it.start)>=clusterEnd&&cluster.length)flush();cluster.push(it);clusterEnd=Math.max(clusterEnd,toMin(it.end))});
  if(cluster.length)flush();return out;
}
function nowNext(ds){
  const n=new Date(),m=n.getHours()*60+n.getMinutes(),its=itemsFor(ds);
  const cur=its.filter(i=>toMin(i.start)<=m&&toMin(i.end)>m).pop(),nxt=its.find(i=>toMin(i.start)>m);
  const card=(lab,it,empty)=>{if(!it)return null;const s0=toMin(it.start),e0=toMin(it.end),pct=Math.max(0,Math.min(100,Math.round((m-s0)/(e0-s0)*100)));
    return `<div class="k-${it.kind||"work"}" data-open="${it.src}:${it.id}:${ds}" style="cursor:pointer"><span class="label">${lab}</span><div class="when">${it.start}–${it.end}${lab==="Next"?" · in "+inFmt(s0-m):""}</div><b>${esc(it.title)}</b>${lab==="Now"?`<div class="left"><div class="bar"><span style="width:${pct}%"></span></div><span class="lt">${inFmt(e0-m)} left</span></div><button class="fbtn" data-focus="${it.src}:${it.id}:${ds}" type="button">Focus</button>`:""}</div>`};
  const card0=(lab,it,empty)=>card(lab,it)||`<div><span class="label">${lab}</span><b class="free">${empty}</b></div>`;
  return `<div class="nn">${card0("Now",cur,"Free time")}${card0("Next",nxt,"Nothing else today")}</div>`;
}
function busy(ds){const r=itemsFor(ds).map(i=>[toMin(i.start),toMin(i.end)+(i.buffer||0)]).sort((a,b)=>a[0]-b[0]),m=[];r.forEach(x=>{const l=m[m.length-1];if(l&&x[0]<=l[1])l[1]=Math.max(l[1],x[1]);else m.push([...x])});return m}
function freeWork(ds){const ws=toMin(S.work.start),we=toMin(S.work.end);let free=we-ws;busy(ds).forEach(([a,b])=>{free-=Math.max(0,Math.min(b,we)-Math.max(a,ws))});return Math.max(0,free)}
function firstGap(ds,mins){const ws=toMin(S.work.start),we=toMin(S.work.end);let t=ws;if(ds===todayStr()){const n=new Date(),nm=n.getHours()*60+n.getMinutes();t=Math.max(t,Math.ceil(nm/15)*15)}for(const[a,b]of busy(ds)){if(a-t>=mins&&t+mins<=we)return t;t=Math.max(t,b)}return t+mins<=we?t:null}
const REMINDS=[["d","Default"],[-1,"None"],[0,"At start"],[5,"5 min"],[15,"15 min"],[30,"30 min"],[60,"1 h"],[120,"2 h"],[1440,"1 day"]];
const remindLabel=r=>r===undefined||r===null?`${S.lead} min before (default)`:r<0?"No reminder":r===0?"At start":r>=1440?(r/1440)+" day"+(r>1440?"s":"")+" before":r>=60?(r/60)+" h before":r+" min before";
const durFmt=(a,b)=>inFmt(toMin(b)-toMin(a));
function ratio(){const d=S.tasks.filter(t=>t.mins&&t.actual);if(d.length<3)return 1;const r=d.reduce((a,t)=>a+t.actual/t.mins,0)/d.length;return Math.max(.5,Math.min(3,r))}
const hm=m=>pad(Math.floor(m/60))+":"+pad(m%60);
const inFmt=x=>x<60?x+" min":Math.floor(x/60)+" h"+(x%60?" "+(x%60)+" min":"");
function renderDay(){
  const ds=ymd(S.cur),isToday=ds===todayStr();
  const dayTasks=S.tasks.filter(t=>t.date===ds||(ds===todayStr()&&t.date&&t.date<ds&&!t.done));
  const top=dayTasks.filter(t=>t.priority==="top").slice(0,3);
  let h=isToday?nowNext(ds):"";
  const nDone=top.filter(t=>t.done).length;
  h+=`<div class="t3h"><h2>Top 3 for ${isToday?"today":fmt(S.cur,{weekday:"long"})}</h2>${top.length?`<span class="cnt ${nDone===top.length?"all":""}">${nDone===top.length?"✓ ":""}${nDone} of ${top.length} done</span>`:""}</div><div class="top3">`;
  h+=top.map((t,i)=>`<div class="t3 ${t.done?"done":""}"><span class="n">${i+1}</span><button class="tt t3b" data-open="tasks:${t.id}">${esc(t.title)}${(t.steps||[]).length?`<small>${t.steps.filter(x=>x.done).length}/${t.steps.length} steps</small>`:""}</button><button class="check" data-toggle="${t.id}" aria-pressed="${!!t.done}" aria-label="Mark done">${t.done?"✓":""}</button></div>`).join("");
  if(top.length<3)h+=`<button class="addline" data-addtop="${ds}">+ Top task</button>`;
  h+=`</div>`;
  const raw=itemsFor(ds),items=layoutLanes(raw);
  const n=new Date(),nm=n.getHours()*60+n.getMinutes();
  let sH=Math.min(7,Math.floor(toMin(S.work.start)/60)),eH=Math.max(18,Math.ceil(toMin(S.work.end)/60));
  raw.forEach(i=>{sH=Math.min(sH,Math.floor(toMin(i.start)/60));eH=Math.max(eH,Math.ceil(toMin(i.end)/60))});
  if(isToday){sH=Math.min(sH,n.getHours());eH=Math.max(eH,n.getHours()+1)}
  sH=Math.max(0,sH);eH=Math.min(24,eH);
  const ppm=1.6,height=(eH-sH)*60*ppm,y=m=>(m-sH*60)*ppm;
  let rail="",grid="";
  for(let hr=sH;hr<=eH;hr++){const top=y(hr*60);rail+=`<span style="top:${top}px">${pad(hr%24)}:00</span>`;grid+=`<div class="hr" style="top:${top}px"></div>`;if(hr<eH)grid+=`<div class="hr half" style="top:${y(hr*60+30)}px"></div><button class="slot" data-slot="${pad(hr)}:00" style="top:${top}px;height:${30*ppm}px" aria-label="Add block at ${pad(hr)}:00"></button><button class="slot" data-slot="${pad(hr)}:30" style="top:${y(hr*60+30)}px;height:${30*ppm}px" aria-label="Add block at ${pad(hr)}:30"></button>`}
  {const ws=toMin(S.work.start),we=toMin(S.work.end);if(ws>sH*60)grid+=`<div class="off" style="top:0;height:${y(ws)}px"></div>`;if(we<eH*60)grid+=`<div class="off" style="top:${y(we)}px;height:${y(eH*60)-y(we)}px"></div>`;if(wd(S.cur)<=5)grid+=`<span class="wl" style="top:${y(ws)}px">Work day starts</span><span class="wl" style="top:${y(we)}px">Work day ends</span>`}
  items.forEach(it=>{if(!it.buffer)return;const bs=toMin(it.end),be=Math.min(bs+it.buffer,eH*60);if(be>bs)grid+=`<div class="buf" style="top:${y(bs)+1}px;height:${(be-bs)*ppm-2}px"><span>Buffer ${it.buffer} min</span></div>`});
  items.forEach(it=>{const s=Math.max(toMin(it.start),sH*60),e=Math.min(Math.max(toMin(it.end),s+15),eH*60);if(e<=s)return;const w=100/it._lanes,ht=(e-s)*ppm-2,short=ht<60;
    grid+=`<button class="blk k-${it.kind||"work"} ${it.src==="routines"?"rt":""} ${short?"short":""}" data-open="${it.src}:${it.id}:${ds}" style="top:${y(s)+1}px;height:${ht}px;left:calc(${w*it._lane}% + 4px);width:calc(${w}% - 8px)"><b>${esc(it.title)}</b><span class="tm">${it.src==="routines"?"↻ ":""}${it.start}${short?"":"–"+it.end}</span></button>`});
  if(isToday&&nm>=sH*60&&nm<=eH*60)grid+=`<div class="now" style="top:${y(nm)}px"></div>`;
  const fw=freeWork(ds),need=dayTasks.filter(t=>!t.done&&t.mins&&!S.blocks.some(b=>b.taskId===t.id&&b.date===ds)).reduce((a,t)=>a+Math.round(t.mins*ratio()),0);
  if(wd(S.cur)<=5&&need>fw)h+=`<div class="over"><b>Too much for one day</b><span>Tasks need about ${inFmt(need)}, you have ${fw?inFmt(fw):"no time"} free.</span></div>`;h+=`<h2>Plan</h2><p class="label" style="margin:0 0 6px">${wd(S.cur)<=5?(fw?inFmt(fw)+" free in your work day":"Work day fully booked"):""}</p>`;
  h+=`<div class="tl" style="height:${height}px"><div class="rail">${rail}</div><div class="grid">${grid}</div></div>`;
  $("#view").innerHTML=h;
  if(isToday&&!renderDay._scrolled){renderDay._scrolled=true;const el=document.querySelector(".tl");if(el){const top=el.getBoundingClientRect().top+scrollY+y(Math.max(nm-60,sH*60))-180;if(top>200)scrollTo({top})}}
}

/* ---------- week ---------- */
function renderWeek(){
  const m=addDays(S.cur,1-wd(S.cur));let h=`<div class="week" style="margin-top:14px">`;
  for(let i=0;i<7;i++){const d=addDays(m,i),ds=ymd(d),its=itemsFor(ds),tc=S.tasks.filter(t=>t.date===ds&&!t.done).length;
    h+=`<section class="wd ${ds===todayStr()?"today":""}"><header data-goday="${ds}"><span class="d">${fmt(d,{weekday:"short",day:1,month:"short"})}</span><span class="c">${tc?tc+" task"+(tc>1?"s":"")+" · ":""}${its.length} item${its.length===1?"":"s"}</span></header>`;
    h+=its.length?its.map(it=>`<button class="wi k-${it.kind||"work"}" data-open="${it.src}:${it.id}:${ds}"><span class="tm">${it.start}–${it.end}</span><span class="dot"></span><span class="tt">${esc(it.title)}</span></button>`).join(""):`<div class="wi"><span class="tt" style="color:var(--muted)">Nothing planned</span></div>`;
    h+=`</section>`}
  $("#view").innerHTML=h+"</div>";
}

/* ---------- month ---------- */
function renderMonth(){
  const first=new Date(S.cur.getFullYear(),S.cur.getMonth(),1),start=addDays(first,1-wd(first)),td=todayStr();
  if(!S.sel||fromYmd(S.sel).getMonth()!==first.getMonth())S.sel=ymd(S.cur);
  let h=`<div class="mgrid" role="grid"><div class="mhead">${DAYN.map(d=>`<span>${d.slice(0,2)}</span>`).join("")}</div><div class="mdays">`;
  for(let i=0;i<42;i++){const d=addDays(start,i),ds=ymd(d);if(i>=35&&d.getMonth()!==first.getMonth())break;
    const its=itemsFor(ds),tc=S.tasks.filter(t=>t.date===ds&&!t.done).length,out=d.getMonth()!==first.getMonth();
    const hol=its.find(x=>/^Public holiday/i.test(x.title));
    h+=`<button class="mday ${out?"out":""} ${ds===td?"today":""} ${ds===S.sel?"sel":""} ${hol?"hol":""}" data-sel="${ds}" aria-label="${fmt(d,{weekday:"long",day:1,month:"long"})}, ${its.length} items"><span class="num">${d.getDate()}</span><span class="dots">${its.slice(0,4).map(x=>`<i class="k-${x.kind||"work"}"></i>`).join("")}${its.length>4?"<em>+</em>":""}</span>${tc?`<span class="tc">${tc}</span>`:""}</button>`}
  h+=`</div></div>`;
  const sd=fromYmd(S.sel),its=itemsFor(S.sel),tasks=S.tasks.filter(t=>t.date===S.sel);
  h+=`<div class="mlist"><header class="mlh"><h2>${fmt(sd,{weekday:"long",day:1,month:"long"})}</h2><button class="ghost" data-goday="${S.sel}">Open day</button></header>`;
  h+=its.length||tasks.length?`<div class="week"><section class="wd">${its.map(it=>`<button class="wi k-${it.kind||"work"}" data-open="${it.src}:${it.id}:${S.sel}"><span class="tm">${it.start}–${it.end}</span><span class="dot"></span><span class="tt">${esc(it.title)}</span></button>`).join("")}${tasks.map(t=>`<button class="wi" data-open="tasks:${t.id}"><span class="tm">${t.priority==="top"?"★ Top":"Task"}</span><span class="dot" style="background:var(--muted)"></span><span class="tt ${t.done?"strike":""}">${esc(t.title)}</span></button>`).join("")}</section></div>`:`<div class="empty">Nothing planned</div>`;
  $("#view").innerHTML=h+`</div>`;
}

/* ---------- details ---------- */
function openDetails(col,rec,date){
  const isR=col==="routines",isT=col==="tasks",d=date?fromYmd(date):null;
  const rows=[];
  if(isT){rows.push(["Due",rec.date?fmt(fromYmd(rec.date),{weekday:"long",day:1,month:"long"}):"No date"]);if(rec.priority==="top")rows.push(["Priority","Top 3"]);
    if(rec.mins||rec.actual)rows.push(["Time",(rec.mins?`Estimate ${rec.mins} min`:"")+(rec.actual?`${rec.mins?" · ":""}took ${rec.actual} min`:"")+(rec.mins&&ratio()!==1&&!rec.actual?` · likely ${Math.round(rec.mins*ratio())} min`:"")])}
  else{if(d)rows.push(["When",fmt(d,{weekday:"long",day:1,month:"long"})]);
    rows.push(["Time",`${rec.start}–${rec.end} · ${durFmt(rec.start,rec.end)}`]);
    if(isR)rows.push(["Repeats",dayLabel(rec.days)]);
    rows.push(["Reminder",remindLabel(rec.remind)+(typeof rec.remind2==="number"?" + "+remindLabel(rec.remind2):"")]);
    if(rec.buffer)rows.push(["Buffer",rec.buffer+" min after"])}
  if(rec.notes)rows.push(["Notes",esc(rec.notes).replace(/\n/g,"<br>")]);
  const steps=rec.steps||[],skipped=isR&&date&&(rec.skips||[]).includes(date);
  const stepsHtml=steps.length?`<div class="steps"><div class="sh"><span class="lb">Steps</span><span class="cnt">${steps.filter(x=>x.done).length} of ${steps.length}</span></div>${steps.map((x,i)=>`<label class="step ${x.done?"done":""}"><input type="checkbox" data-step="${i}" ${x.done?"checked":""}><span>${esc(x.text)}</span></label>`).join("")}</div>`:"";
  $("#sheetRoot").innerHTML=`<div class="scrim" id="scrim"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(rec.title)}"><div class="in"><div class="dhead k-${rec.kind||(isT?"admin":"work")}"><span class="chip">${isT?"Task":(KINDS[rec.kind]||"Work")+(isR?" · repeats":"")}</span><h3 class="${isT&&rec.done?"strike":""}">${esc(rec.title)}</h3></div><dl class="dl">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>${stepsHtml}<div class="acts">${!(isT&&rec.done)?`<button class="primary" id="dFocus" type="button">Focus</button>`:""}<button class="ghost" id="dEdit" type="button">Edit</button>${isT?`<button class="ghost" id="dDone" type="button">${rec.done?"Not done":"Done"}</button>`:""}${isR&&date?`<button class="ghost" id="dSkip" type="button">${skipped?"Bring back this day":"Skip this day"}</button>`:""}<button class="ghost" id="dClose" type="button">Close</button></div></div></div>`;
  $("#scrim").onclick=closeSheet;$("#dClose").onclick=closeSheet;
  $("#dEdit").onclick=()=>openSheet(col,rec,{});
  const fo=$("#dFocus");if(fo)fo.onclick=()=>startFocus(col,rec,date);
  const dn=$("#dDone");if(dn)dn.onclick=()=>{toggleTask(rec);closeSheet()};
  document.querySelectorAll("[data-step]").forEach(cb=>cb.onchange=()=>{const st=(rec.steps||[]).map(x=>({...x}));st[+cb.dataset.step].done=cb.checked;const nr={...rec,steps:st};save(col,rec.id,strip(nr));openDetails(col,S[col].find(x=>x.id===rec.id)||nr,date);if(cb.checked&&st.every(x=>x.done))cheer("All steps done")});
  const sk=$("#dSkip");if(sk)sk.onclick=()=>{const set=new Set(rec.skips||[]);skipped?set.delete(date):set.add(date);save("routines",rec.id,{...strip(rec),skips:[...set]});closeSheet();toast(skipped?"Back on":"Skipped for that day")};
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
  const root=document.createElement("div");root.id="focus";root.className="focus k-"+F.kind;
  root.innerHTML=`<div class="fin"><span class="label">Focus</span><h2 class="ft">${esc(F.title)}</h2><div class="ring"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52" class="trk"/><circle cx="60" cy="60" r="52" class="prg" id="fPrg"/></svg><div class="fc"><span id="fLeft">--:--</span><small id="fOf"></small></div></div><div class="acts fa"><button class="ghost" id="fPause" type="button">Pause</button><button class="primary" id="fDoneB" type="button">Done</button><button class="ghost" id="fStop" type="button">Stop</button></div></div>`;
  document.body.appendChild(root);
  try{navigator.wakeLock?.request("screen").then(w=>wake=w).catch(()=>{})}catch(_){}
  const C=2*Math.PI*52,prg=$("#fPrg");prg.style.strokeDasharray=C;
  const tick=()=>{if(!F.paused){F.left=Math.max(0,F.total-F.spent-(Date.now()-F.started)/1000)}
    const l=Math.ceil(F.left),mm=Math.floor(l/60),ss=l%60;$("#fLeft").textContent=(mm>=60?Math.floor(mm/60)+":"+pad(mm%60):mm)+":"+pad(ss);
    $("#fOf").textContent="of "+inFmt(Math.round(F.total/60));prg.style.strokeDashoffset=C*(1-F.left/F.total);
    if(F.left<=0&&!F.rang){F.rang=1;root.classList.add("over");try{navigator.vibrate?.([200,100,200])}catch(_){}}};
  tick();clearInterval(focusT);focusT=setInterval(tick,500);
  $("#fPause").onclick=()=>{if(F.paused){F.paused=false;F.started=Date.now();$("#fPause").textContent="Pause"}else{F.spent+= (Date.now()-F.started)/1000;F.paused=true;$("#fPause").textContent="Resume"}};
  const end=finished=>{clearInterval(focusT);try{wake?.release()}catch(_){}root.remove();
    const used=Math.max(1,Math.round((F.total-F.left)/60));
    if(finished&&F.col==="tasks"){const t=S.tasks.find(x=>x.id===F.id);if(t){save("tasks",t.id,{...strip(t),done:true,actual:(t.actual||0)+used});cheer(`Done in ${inFmt(used)}`);return}}
    if(finished)cheer(`${inFmt(used)} focused`);};
  $("#fDoneB").onclick=()=>end(true);$("#fStop").onclick=()=>{if(F.col==="tasks"){const t=S.tasks.find(x=>x.id===F.id);const used=Math.max(1,Math.round((F.total-F.left)/60));if(t&&used>1)save("tasks",t.id,{...strip(t),actual:(t.actual||0)+used})}end(false)};
}

/* ---------- little celebrations ---------- */
function cheer(msg){toast(msg);if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const c=document.createElement("canvas");c.className="confetti";document.body.appendChild(c);const x=c.getContext("2d"),W=c.width=innerWidth*devicePixelRatio,H=c.height=innerHeight*devicePixelRatio;
  const cs=getComputedStyle(document.documentElement),cols=["--k-work","--k-family","--k-admin","--k-me","--accent"].map(v=>cs.getPropertyValue(v).trim());
  const P=Array.from({length:70},()=>({x:W/2+(Math.random()-.5)*W*.3,y:H*.62,vx:(Math.random()-.5)*14*devicePixelRatio,vy:-(8+Math.random()*12)*devicePixelRatio,r:(3+Math.random()*4)*devicePixelRatio,c:cols[Math.floor(Math.random()*cols.length)],a:Math.random()*6}));
  let f=0;const step=()=>{x.clearRect(0,0,W,H);P.forEach(p=>{p.vy+=.45*devicePixelRatio;p.x+=p.vx;p.y+=p.vy;p.a+=.2;x.save();x.translate(p.x,p.y);x.rotate(p.a);x.fillStyle=p.c;x.fillRect(-p.r,-p.r/2,p.r*2,p.r);x.restore()});if(++f<70)requestAnimationFrame(step);else c.remove()};step()}
function toggleTask(t){const done=!t.done;save("tasks",t.id,{...strip(t),done});if(done){const ds=todayStr(),top=S.tasks.filter(x=>x.priority==="top"&&(x.date===ds||(x.date&&x.date<ds&&!x.done)||x.id===t.id));if(t.priority==="top"&&top.length&&top.every(x=>x.id===t.id?true:x.done))cheer("Top 3 done. Great day.");else toast("Done")}}

/* ---------- tasks ---------- */
function taskRow(t){const td=todayStr(),due=t.date?(t.date===td?"Today":t.date<td&&!t.done?"Carried over from "+fmt(fromYmd(t.date),{weekday:"short"}):fmt(fromYmd(t.date),{weekday:"short",day:1,month:"short"})):"No date";
  const st=t.steps||[],sd=st.filter(x=>x.done).length,est=t.mins?(t.actual?` · est ${t.mins} min, took ${t.actual}`:` · ${t.mins} min`):(t.actual?` · took ${t.actual} min`:"");
  return `<div class="row ${t.done?"done":""}"><button class="check" data-toggle="${t.id}" aria-pressed="${!!t.done}" aria-label="Mark done">${t.done?"✓":""}</button><button class="tt" data-open="tasks:${t.id}"><div>${t.priority==="top"?'<span class="star">★</span> ':""}${esc(t.title)}${t.example?'<span class="ex">Example</span>':""}</div><div class="meta">${due}${est}${st.length?` · ${sd}/${st.length} steps`:""}</div></button>${t.done?"":`<button class="plan" data-plan="${t.id}">Block it</button>`}</div>`}
function renderTasks(){
  const td=todayStr(),open=S.tasks.filter(t=>!t.done),done=S.tasks.filter(t=>t.done);
  const byP=(a,b)=>(a.priority==="top"?0:1)-(b.priority==="top"?0:1)||(a.date||"9").localeCompare(b.date||"9");
  const today=open.filter(t=>t.date&&t.date<=td).sort(byP),later=open.filter(t=>t.date&&t.date>td).sort(byP),inbox=open.filter(t=>!t.date).sort(byP);
  const sec=(name,list,empty)=>`<h2>${name}</h2>`+(list.length?`<div class="list">${list.map(taskRow).join("")}</div>`:`<div class="empty">${empty}</div>`);
  let h=`<form class="quick" id="quick"><input id="quickIn" placeholder="New task" autocomplete="off" aria-label="New task"><button type="submit">Add</button></form>`+sec("Today",today,"Nothing due")+sec("Inbox",inbox,"Empty")+sec("Coming up",later,"Nothing coming up");
  if(done.length)h+=`<details><summary>Done (${done.length})</summary><div class="list">${done.map(taskRow).join("")}</div></details>`;
  $("#view").innerHTML=h;
}

/* ---------- routines ---------- */
function renderRoutines(){
  const list=[...S.routines].sort((a,b)=>toMin(a.start)-toMin(b.start));
  let h=`<h2>Every week</h2>`;
  h+=list.length?`<div class="list">${list.map(r=>`<div class="row k-${r.kind||"work"}"><button class="tt" data-open="routines:${r.id}"><div>${esc(r.title)}${r.example?'<span class="ex">Example</span>':""}</div><div class="meta">${r.start}–${r.end} · ${dayLabel(r.days)}</div></button><span class="chip">${KINDS[r.kind]||"Work"}</span></div>`).join("")}</div>`:`<div class="empty">No routines</div>`;
  $("#view").innerHTML=h;
}
function dayLabel(days){days=[...(days||[])].sort();if(days.length===7)return"Every day";if(days.join()==="1,2,3,4,5")return"Weekdays";if(days.join()==="6,7")return"Weekends";return days.map(d=>DAYN[d-1]).join(", ")}

function render(){renderHeader();({day:renderDay,week:renderWeek,month:renderMonth,tasks:renderTasks,routines:renderRoutines})[S.view]()}

/* ---------- sheet ---------- */
function closeSheet(){$("#sheetRoot").innerHTML=""}
function openSheet(type,rec,preset){
  const isNew=!rec;rec=rec||{};preset=preset||{};
  const title={blocks:"time block",tasks:"task",routines:"routine"}[type];
  let f=`<div class="f"><label for="fTitle">What</label><input id="fTitle" value="${esc(rec.title||preset.title||"")}" placeholder="${type==="tasks"?"Send Virlocept proposal":"Client call"}" autocomplete="off"></div>`;
  const kind=rec.kind||preset.kind||"work";
  const kindOpts=`<div class="f"><span class="lb">Type</span><div class="opts" id="fKind">${Object.entries(KINDS).map(([k,v])=>`<button type="button" data-k="${k}" aria-pressed="${k===kind}">${v}</button>`).join("")}</div></div>`;
  if(type==="blocks"){
    const st=rec.start||preset.start||"09:00",en=rec.end||preset.end||pad(Math.min(23,Math.floor(toMin(st)/60)+1))+":"+st.slice(3);
    f+=`<div class="f"><label for="fDate">Day</label><input id="fDate" type="date" value="${rec.date||preset.date||ymd(S.cur)}"></div><div class="two"><div class="f"><label for="fStart">Start</label><input id="fStart" type="time" step="900" value="${st}"></div><div class="f"><label for="fEnd">End</label><input id="fEnd" type="time" step="900" value="${en}"></div></div>`+kindOpts;
  }else if(type==="tasks"){
    f+=`<div class="two"><div class="f"><label for="fDate">Due (optional)</label><input id="fDate" type="date" value="${rec.date||preset.date||""}"></div><div class="f"><label for="fMins">Minutes (optional)</label><input id="fMins" type="number" min="5" step="5" inputmode="numeric" value="${rec.mins||""}"></div></div><div class="f"><span class="lb">Priority</span><div class="opts" id="fPri"><button type="button" data-p="top" aria-pressed="${(rec.priority||preset.priority)==="top"}">★ Top 3</button><button type="button" data-p="normal" aria-pressed="${(rec.priority||preset.priority)!=="top"}">Normal</button></div></div>`;
  }else{
    const days=rec.days||[1,2,3,4,5];
    f+=`<div class="two"><div class="f"><label for="fStart">Start</label><input id="fStart" type="time" step="900" value="${rec.start||"08:00"}"></div><div class="f"><label for="fEnd">End</label><input id="fEnd" type="time" step="900" value="${rec.end||"08:30"}"></div></div><div class="f"><span class="lb">Repeats on</span><div class="opts" id="fDays">${DAYN.map((n,i)=>`<button type="button" data-d="${i+1}" aria-pressed="${days.includes(i+1)}">${n}</button>`).join("")}</div></div>`+kindOpts;
  }
  if(type!=="tasks"){const cur=rec.remind===undefined||rec.remind===null?"d":String(rec.remind);
    f+=`<div class="f"><span class="lb">Reminder</span><div class="opts" id="fRem">${REMINDS.map(([v,l])=>`<button type="button" data-r="${v}" aria-pressed="${String(v)===cur}">${v==="d"?l+" ("+S.lead+" min)":l}</button>`).join("")}</div></div><div class="f"><span class="lb">Second reminder</span><div class="opts" id="fRem2">${[["n","None"],[0,"At start"],[5,"5 min"],[15,"15 min"],[30,"30 min"],[60,"1 h"],[1440,"1 day"]].map(([v,l])=>`<button type="button" data-r="${v}" aria-pressed="${String(v)===(typeof rec.remind2==="number"?String(rec.remind2):"n")}">${l}</button>`).join("")}</div></div><div class="f"><span class="lb">Buffer after</span><div class="opts" id="fBuf">${[0,10,15,30].map(v=>`<button type="button" data-b="${v}" aria-pressed="${v===(rec.buffer??preset.buffer??0)}">${v?v+" min":"None"}</button>`).join("")}</div></div><div class="f"><label for="fNotes">Notes</label><textarea id="fNotes" rows="3">${esc(rec.notes||"")}</textarea></div>`}
  if(type!=="routines")f+=`<div class="f"><span class="lb">Steps</span><div id="fSteps" class="stedit">${(rec.steps||[]).map(x=>`<div class="srow"><input value="${esc(x.text)}" data-done="${x.done?1:0}" aria-label="Step"><button type="button" class="srm" aria-label="Remove step">×</button></div>`).join("")}</div><div class="quick" style="margin:0"><input id="fStepIn" placeholder="Add a step" autocomplete="off" aria-label="New step"><button type="button" id="fStepAdd">Add</button></div></div>`;
  const skipBtn="";
  $("#sheetRoot").innerHTML=`<div class="scrim" id="scrim"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${isNew?"New":"Edit"} ${title}"><form class="in" id="fForm"><h3>${isNew?"New":"Edit"} ${title}</h3>${f}<div class="err" id="fErr"></div><div class="acts"><button class="primary" type="submit">${isNew?"Add":"Save"}</button>${isNew?"":`<button type="button" class="danger" id="fDel">Delete</button>`}<button type="button" class="ghost" id="fCancel">Cancel</button></div>${skipBtn}</form></div>`;
  const form=$("#fForm");
  const addStep=()=>{const i=$("#fStepIn"),v=i.value.trim();if(!v)return;const r=document.createElement("div");r.className="srow";r.innerHTML=`<input value="${esc(v)}" data-done="0" aria-label="Step"><button type="button" class="srm" aria-label="Remove step">×</button>`;$("#fSteps").appendChild(r);i.value="";i.focus()};
  if($("#fStepAdd")){$("#fStepAdd").onclick=addStep;$("#fStepIn").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();addStep()}};$("#fSteps").onclick=e=>{const b=e.target.closest(".srm");if(b)b.parentElement.remove()}}
  form.querySelectorAll(".opts").forEach(g=>g.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;if(g.id==="fDays")b.setAttribute("aria-pressed",b.getAttribute("aria-pressed")==="true"?"false":"true");else{g.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed","false"));b.setAttribute("aria-pressed","true")}}));
  $("#scrim").onclick=closeSheet;$("#fCancel").onclick=closeSheet;
  if(!isNew){const del=$("#fDel");del.onclick=()=>{if(del.dataset.armed){remove(type,rec.id);closeSheet();toast("Deleted")}else{del.dataset.armed=1;del.textContent=type==="routines"?"Delete every week?":"Tap again to delete"}}}
  setTimeout(()=>{if(isNew)$("#fTitle").focus()},50);
  form.onsubmit=e=>{e.preventDefault();const err=$("#fErr");const t=$("#fTitle").value.trim();if(!t){err.textContent="Give it a name first.";return}
    const k=(form.querySelector('#fKind [aria-pressed="true"]')||{}).dataset?.k||"work";
    let data;
    if(type==="blocks"){const s=$("#fStart").value,en=$("#fEnd").value,d=$("#fDate").value;if(!d||!s||!en){err.textContent="Pick a day, a start and an end time.";return}if(toMin(en)<=toMin(s)){err.textContent="End time needs to be after the start time.";return}data={...strip(rec),title:t,date:d,start:s,end:en,kind:k};if(preset.taskId)data.taskId=preset.taskId}
    else if(type==="tasks"){const p=(form.querySelector('#fPri [aria-pressed="true"]')||{}).dataset?.p||"normal",d=$("#fDate").value||null,mins=parseInt($("#fMins").value)||null;
      if(p==="top"&&d){const n=S.tasks.filter(x=>x.id!==rec.id&&x.date===d&&x.priority==="top"&&!x.done).length;if(n>=3){err.textContent="That day already has 3 top tasks. Finish or downgrade one first.";return}}
      data={...strip(rec),title:t,date:d,priority:p,mins,done:!!rec.done,createdAt:rec.createdAt||Date.now()}}
    else{const s=$("#fStart").value,en=$("#fEnd").value,days=[...form.querySelectorAll('#fDays [aria-pressed="true"]')].map(b=>+b.dataset.d);if(!days.length){err.textContent="Pick at least one day.";return}if(toMin(en)<=toMin(s)){err.textContent="End time needs to be after the start time.";return}data={...strip(rec),title:t,start:s,end:en,days,kind:k,skips:rec.skips||[]}}
    if(type!=="tasks"){const rv=(form.querySelector('#fRem [aria-pressed="true"]')||{}).dataset?.r||"d";if(rv==="d")delete data.remind;else data.remind=+rv;const r2=(form.querySelector('#fRem2 [aria-pressed="true"]')||{}).dataset?.r||"n";if(r2==="n")delete data.remind2;else data.remind2=+r2;const bf=+((form.querySelector('#fBuf [aria-pressed="true"]')||{}).dataset?.b||0);if(bf)data.buffer=bf;else delete data.buffer;const nt=$("#fNotes").value.trim();if(nt)data.notes=nt;else delete data.notes}
    if(type!=="routines"){const pend=$("#fStepIn").value.trim();if(pend)addStep();const st=[...form.querySelectorAll("#fSteps .srow input")].map(i=>({text:i.value.trim(),done:i.dataset.done==="1"})).filter(x=>x.text);if(st.length)data.steps=st;else delete data.steps}
    delete data.example;save(type,rec.id||uid(),data);closeSheet();toast(isNew?"Added":"Saved")};
}
const strip=r=>{const o={...r};delete o.id;delete o.src;delete o._lane;delete o._lanes;return o};

/* ---------- events ---------- */
document.addEventListener("click",e=>{
  const v=e.target.closest(".tabs button");if(v){location.hash=v.dataset.v;return}
  const tg=e.target.closest("[data-toggle]");if(tg){const t=S.tasks.find(x=>x.id===tg.dataset.toggle);if(t)toggleTask(t);return}
  const fb=e.target.closest("[data-focus]");if(fb){e.stopPropagation();const[col,id,date]=fb.dataset.focus.split(":");const r=S[col].find(x=>x.id===id);if(r)startFocus(col,r,date);return}
  const op=e.target.closest("[data-open]");if(op){const[col,id,date]=op.dataset.open.split(":");const r=S[col].find(x=>x.id===id);if(!r)return;openDetails(col,r,date||r.date);return}
  const se=e.target.closest("[data-sel]");if(se){S.sel=se.dataset.sel;renderMonth();return}
  const at=e.target.closest("[data-addtop]");if(at){openSheet("tasks",null,{date:at.dataset.addtop,priority:"top"});return}
  const sl=e.target.closest("[data-slot]");if(sl){openSheet("blocks",null,{start:sl.dataset.slot,date:ymd(S.cur)});return}
  const pl=e.target.closest("[data-plan]");if(pl){const t=S.tasks.find(x=>x.id===pl.dataset.plan);const m=t.mins||60;let d=t.date&&t.date>=todayStr()?t.date:todayStr(),g=firstGap(d,m);if(g===null&&!t.date){for(let i=1;i<8&&g===null;i++){const dd=ymd(addDays(fromYmd(todayStr()),i));if(wd(fromYmd(dd))<=5){g=firstGap(dd,m);if(g!==null)d=dd}}}const st=g??toMin(S.work.start);openSheet("blocks",null,{title:t.title,date:d,start:hm(st),end:hm(Math.min(st+m,23*60+45)),taskId:t.id,kind:"work"});return}
  const gd=e.target.closest("[data-goday]");if(gd){S.cur=fromYmd(gd.dataset.goday);location.hash="day";return}
  if(e.target.closest("[data-settings]")){openSettings();return}
  if(e.target.id==="clearEx"){const b=e.target;if(!b.dataset.armed){b.dataset.armed=1;b.textContent="Tap again to clear";return}["tasks","blocks","routines"].forEach(c=>S[c].filter(x=>x.example).forEach(x=>remove(c,x.id)));toast("Examples cleared")}
});
const step=n=>{if(S.view==="month"){S.cur=new Date(S.cur.getFullYear(),S.cur.getMonth()+n,1);S.sel=null}else S.cur=addDays(S.cur,S.view==="week"?7*n:n);render()};
$("#prev").onclick=()=>step(-1);
$("#next").onclick=()=>step(1);
$("#todayBtn").onclick=()=>{S.cur=new Date();S.cur.setHours(0,0,0,0);S.sel=null;renderDay._scrolled=false;render()};
$("#fab").onclick=()=>{if(S.view==="tasks")openSheet("tasks");else if(S.view==="routines")openSheet("routines");else{const d=S.view==="month"&&S.sel?S.sel:ymd(S.cur),g=firstGap(d,60);openSheet("blocks",null,{date:d,start:g!==null?hm(g):S.work.start,end:g!==null?hm(g+60):hm(toMin(S.work.start)+60)})}};
document.addEventListener("submit",e=>{if(e.target.id!=="quick")return;e.preventDefault();const i=$("#quickIn"),t=i.value.trim();if(!t)return;save("tasks",uid(),{title:t,date:null,priority:"normal",mins:null,done:false,createdAt:Date.now()});toast("Added to Inbox");setTimeout(()=>{const n=$("#quickIn");if(n)n.focus()},30)});
document.addEventListener("keydown",e=>{if(e.key==="Escape")closeSheet()});
function route(){const h=location.hash.slice(1);S.view=["day","week","month","tasks","routines"].includes(h)?h:"day";closeSheet();render()}
addEventListener("hashchange",route);
setInterval(()=>{if(S.view==="day"&&ymd(S.cur)===todayStr()&&!$("#sheetRoot").innerHTML)renderDay()},60000);
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
    S.publicKey=d.alerts.publicKey;S.devices=d.alerts.devices;S.connector=d.connectorUrl;
    status("");
    if(!$("#sheetRoot").innerHTML&&document.activeElement?.id!=="quickIn")render();
  }catch(_){status("Can't reach your planner right now. Check your connection; changes will show once it's back.")}
}
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")load()});

/* ---------- alerts + settings ---------- */
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
function openSettings(){
  let alertHtml;
  if(isIOS&&!installed)alertHtml=`<p class="hint">Alerts work in the Home Screen app.</p>`;
  else if(!pushSupported)alertHtml=`<p class="hint">This browser can't show alerts.</p>`;
  else if(S.alertsHere)alertHtml=`<details class="onrow"><summary><span class="on">✓ On</span><span class="mg">Manage</span></summary><div class="acts"><button type="button" class="ghost" id="sTest">Send a test</button><button type="button" class="danger" id="sAlerts">Turn off on this device</button></div></details>`;
  else alertHtml=`<div class="acts"><button type="button" class="primary" id="sAlerts">Turn on alerts</button></div>`;
  $("#sheetRoot").innerHTML=`<div class="scrim" id="scrim"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="Settings"><form class="in" id="sForm"><h3>Settings</h3>
  <div class="two"><div class="f"><label for="sStart">Work day starts</label><input id="sStart" type="time" step="900" value="${S.work.start}"></div><div class="f"><label for="sEnd">Work day ends</label><input id="sEnd" type="time" step="900" value="${S.work.end}"></div></div>
  <div class="f"><span class="lb">Default reminder</span><div class="opts" id="sLead">${[5,10,15,30].map(n=>`<button type="button" data-n="${n}" aria-pressed="${S.lead===n}">${n} min</button>`).join("")}</div></div>
  <div class="f"><span class="lb">Morning planning alert</span><div class="opts" id="sMorn">${["off","07:00","07:30","08:00","08:30"].map(v=>`<button type="button" data-m="${v}" aria-pressed="${(S.morning||"off")===v}">${v==="off"?"Off":v}</button>`).join("")}</div></div>
  <div class="f"><span class="lb">Phone alerts</span>${alertHtml}</div>
  <div class="f"><span class="lb">Claude connector</span>${S.connector?`<details class="onrow"><summary><span class="on">✓ Connected</span><span class="mg">Manage</span></summary><p class="hint">Keep this link private.</p><div class="quick" style="margin:0"><input id="sConn" readonly value="${esc(S.connector)}" aria-label="Connector link"><button type="button" id="sCopy">Copy</button></div><div class="acts"><button type="button" class="ghost" id="sNewKey">Make a new link</button><button type="button" class="danger" id="sRevoke">Turn off</button></div></details>`:`<div class="acts"><button type="button" class="ghost" id="sNewKey">Create Claude link</button></div>`}</div>
  <div class="err" id="sErr"></div>
  <div class="acts"><button class="primary" type="submit">Save</button><button type="button" class="ghost" id="sCancel">Cancel</button><button type="button" class="danger" id="sOut">Log out</button></div></form></div>`;
  const err=$("#sErr");
  $("#scrim").onclick=closeSheet;$("#sCancel").onclick=closeSheet;
  $("#sMorn").onclick=e=>{const b=e.target.closest("button");if(!b)return;$("#sMorn").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed","false"));b.setAttribute("aria-pressed","true")};
  $("#sLead").onclick=e=>{const b=e.target.closest("button");if(!b)return;$("#sLead").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed","false"));b.setAttribute("aria-pressed","true")};
  const al=$("#sAlerts");if(al)al.onclick=async()=>{al.disabled=true;err.textContent="";try{S.alertsHere?await disableAlerts():await enableAlerts();toast(S.alertsHere?"Alerts are on":"Alerts are off");openSettings()}catch(e){err.textContent=e.message;al.disabled=false}};
  const te=$("#sTest");if(te)te.onclick=async()=>{te.disabled=true;try{await pushApi({action:"test"});toast("Test sent. It should arrive in a few seconds.")}catch(e){err.textContent=e.message}te.disabled=false};
  const conn=async action=>{err.textContent="";const r=await fetch("/api/connector",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action})});const j=await r.json().catch(()=>({}));if(!r.ok){err.textContent=j.error||"That didn't work. Try again.";return}S.connector=j.url;openSettings();toast(action==="revoke"?"Claude link turned off":"New Claude link ready");if(action==="create"){const dt=document.querySelectorAll(".onrow");dt[dt.length-1]?.setAttribute("open","")}};
  const nk=$("#sNewKey");if(nk)nk.onclick=()=>{if(S.connector&&!nk.dataset.armed){nk.dataset.armed=1;nk.textContent="Tap again: the old link stops working";return}conn("create")};
  const rv=$("#sRevoke");if(rv)rv.onclick=()=>{if(!rv.dataset.armed){rv.dataset.armed=1;rv.textContent="Tap again to turn off";return}conn("revoke")};
  const cp=$("#sCopy");if(cp)cp.onclick=()=>{const i=$("#sConn");const done=()=>toast("Link copied");try{navigator.clipboard.writeText(i.value).then(done,()=>{i.select();document.execCommand("copy");done()})}catch(_){i.select();document.execCommand("copy");done()}};
  $("#sOut").onclick=async()=>{await fetch("/api/logout",{method:"POST"});location.href="/login"};
  $("#sForm").onsubmit=async e=>{e.preventDefault();const st=$("#sStart").value,en=$("#sEnd").value,lead=+($("#sLead [aria-pressed=\"true\"]")?.dataset.n||10),morn=$("#sMorn [aria-pressed=\"true\"]")?.dataset.m||"off";
    if(!st||!en||toMin(en)<=toMin(st)){err.textContent="The work day needs to end after it starts.";return}
    try{const j=await api({op:"settings",data:{workStart:st,workEnd:en,leadMin:lead,morning:morn}});S.work={start:j.settings.workStart,end:j.settings.workEnd};S.lead=j.settings.leadMin;S.morning=j.settings.morning||null;closeSheet();render();toast("Saved")}catch(e){err.textContent=e.message}};
}
$("#gear").onclick=openSettings;

S.lead=10;S.alertsHere=false;S.devices=0;
status("Loading your planner…");
load();initSW();
})();
