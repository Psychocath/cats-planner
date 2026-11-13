(function(){
/* Hubs: the "Do this now" card, 4 hub blocks on Home and a page per hub.
   Loaded before planner.js. It only declares functions; planner.js calls them once everything is loaded.
   Nothing here stores new data: every page is a filtered view of the tasks, events and routines that already exist. */
const HUBS=[
  {k:"clients",t:"Clients",i:"work",c:"k-work"},
  {k:"family",t:"Family",i:"family",c:"k-family"},
  {k:"personal",t:"Personal",i:"me",c:"k-me"},
  {k:"food",t:"Shopping and Meals",i:"cart",c:"k-admin"}];
const hubRx=n=>new RegExp("\\b"+String(n).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\b","i");
const hubHas=(x,n)=>hubRx(n).test(x.title||"");
const hubOpen=t=>!t.done&&!isShop(t);
const hubDay=ds=>{const k=daysBetween(todayStr(),ds);return k===0?"Today":k===1?"Tomorrow":k>1&&k<7?DAYN[wd(fromYmd(ds))-1]+" "+fromYmd(ds).getDate():fmt(fromYmd(ds),{day:1,month:"short"})};

/* People are read from the planner itself: a name after "Fetch" in a Family routine, or a "Name:" prefix that a Family item also mentions. */
function hubPeople(){
  const fam=[...S.routines,...S.blocks].filter(x=>(x.kind||"work")==="family"),names=new Set();
  fam.forEach(x=>{const m=/^(?:Fetch|Collect|Pick up|Drop off|Drop)\s+([A-Z][a-z]+)/.exec(x.title||"");if(m)names.add(m[1])});
  [...S.tasks,...S.blocks].forEach(x=>{const p=rawClient(x);if(p&&/^[A-Z][a-z]+$/.test(p)&&fam.some(f=>hubHas(f,p)))names.add(p)});
  return[...names];
}
/* Clients are the names before the colon in titles, leaving out people, shopping lists and one-off prefixes. */
function hubClients(){
  const ppl=hubPeople().map(p=>p.toLowerCase()),m=new Map();
  [...S.tasks,...S.blocks].forEach(x=>{if(isShop(x))return;const c=clientOf(x);if(!c||ppl.includes(c.toLowerCase()))return;
    if(!m.has(c))m.set(c,{name:c,tasks:[],blocks:[]});(x.start?m.get(c).blocks:m.get(c).tasks).push(x)});
  const open=c=>c.tasks.filter(t=>!t.done).length;
  const list=[...m.values()].filter(c=>c.tasks.length+c.blocks.length>=2);
  /* a task that names a client without the "Client:" prefix still belongs on that client's page */
  [...S.tasks,...S.blocks].forEach(x=>{if(isShop(x)||clientOf(x))return;const c=list.find(k=>hubHas(x,k.name));if(c)(x.start?c.blocks:c.tasks).push(x)});
  return list.sort((a,b)=>open(b)-open(a));
}
function hubPersonalTasks(){
  const cl=new Set(hubClients().map(c=>c.name)),ppl=hubPeople();
  const names=[...cl];
  return S.tasks.filter(t=>hubOpen(t)&&!cl.has(clientOf(t))&&!names.some(n=>hubHas(t,n))&&!ppl.some(p=>hubHas(t,p)));
}
/* events and routines from today on; a routine shows once, at its next time */
function hubUpcoming(test,days){
  const out=[],seen=new Set(),td=todayStr(),nm=nowMin();
  for(let i=0;i<days;i++){const ds=ymd(addDays(fromYmd(td),i));
    allItemsFor(ds).forEach(it=>{if(!test(it)||(i===0&&toMin(it.end)<=nm))return;
      if(it.src==="routines"){if(seen.has(it.id))return;seen.add(it.id)}out.push({it,ds})})}
  return out;
}
const hubEvRow=({it,ds})=>`<button type="button" class="crow k-${it.kind||"work"}" data-open="${it.src}:${it.id}:${ds}"><span class="cd">${hubDay(ds)}</span><span class="tt"><b>${esc(it.title)}</b><small>${it.start}–${it.end}${it.src==="routines"?" · repeats":""}${it.location?" · "+esc(it.location):""}</small></span></button>`;
const hubTaskRow=(t,ds)=>`<button type="button" class="crow task" data-open="tasks:${t.id}"><span class="cd">${ds?hubDay(ds):"No day"}</span><span class="tt"><b>${esc(t.title)}</b>${t.waiting?`<small class="wait">Waiting on ${esc(t.waiting)}</small>`:""}</span></button>`;
const hubSec=(title,count,inner,empty)=>`<section class="sec"><div class="sech"><h2>${title}</h2>${count!==null?`<span class="cnt">${count}</span>`:""}</div>${inner?`<div class="card list">${inner}</div>`:`<p class="hubnone">${empty}</p>`}</section>`;
const hubByDate=(a,b)=>(a.date||"9999").localeCompare(b.date||"9999")||(a.priority==="top"?0:1)-(b.priority==="top"?0:1);
const hubTaskList=list=>{const k=(S.hub?S.hub.k+"|"+S.hub.sub:"")+"|"+list.length,all=!!(S.hubAll&&S.hubAll[k]),sorted=list.slice().sort(hubByDate),CAP=6;
  return (all?sorted:sorted.slice(0,CAP)).map(t=>sesTask(t,null,"")).join("")+(sorted.length>CAP?`<button type="button" class="latr" data-huball="${esc(k)}" aria-expanded="${all}">${all?"Show fewer":`Show all ${sorted.length}`}${ic(all?"left":"right")}</button>`:"")};

/* ---------- Home: Do this now ---------- */
function hubTodayOpen(){const td=todayStr();return S.tasks.filter(t=>hubOpen(t)&&t.date&&t.date<=td)}
function hubNow(){
  const open=hubTodayOpen();if(!open.length)return null;
  if(S.pick){const p=open.find(t=>t.id===S.pick);if(p)return p}
  const top=open.filter(t=>t.priority==="top");if(top.length)return top[0];
  const car=open.filter(t=>t.carries);if(car.length)return car[0];
  const sized=open.filter(t=>loadOf(t)).sort((a,b)=>loadOf(a)-loadOf(b));
  return sized[0]||open[0];
}
function doNowHtml(){
  const td=todayStr(),nm=nowMin(),all=S.tasks.filter(t=>!isShop(t)&&t.date===td),d=all.filter(t=>t.done).length,n=all.length,t=hubNow();
  const pct=n?d/n:0,C=2*Math.PI*15;
  const ring=`<span class="dn-ring" role="img" aria-label="${d} of ${n} of today's tasks done"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" class="rb"/><circle cx="18" cy="18" r="15" class="rf" stroke-dasharray="${(C*pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 18 18)"/></svg><b>${d}/${n}</b></span>`;
  const nx=allItemsFor(td).find(i=>toMin(i.start)>nm);
  const next=nx?`<p class="dn-n">${ic("clock")}Next: ${esc(nx.title)} in ${inFmt(toMin(nx.start)-nm)}</p>`:"";
  if(!t)return `<section class="donow done" aria-label="Do this now"><div class="dn-top"><span class="dn-l">${ic("focus")}Do this now</span>${ring}</div><p class="dn-e">${n?"Today's tasks are done.":"No tasks planned for today."}</p>${next}</section>`;
  const st=(t.steps||[]).find(x=>!x.done),meta=[t.size?SIZEL[t.size]:t.mins?inFmt(+t.mins):"",t.ai?"Claude working":"",st?"First step: "+st.text:""].filter(Boolean).join(" · ");
  const more=hubTodayOpen().length>1;
  return `<section class="donow" aria-label="Do this now"><div class="dn-top"><span class="dn-l">${ic("focus")}Do this now</span>${ring}</div>
    <button type="button" class="dn-t" data-open="tasks:${t.id}"><b>${esc(t.title)}</b>${meta?`<small>${esc(meta)}</small>`:""}</button>
    <div class="dn-a"><button type="button" class="dn-start" data-focus="tasks:${t.id}:${td}">${ic("clock")}Start</button>${more?`<button type="button" class="dn-pick" data-pickme>${ic("sparkle")}Pick for me</button>`:""}<span class="sp"></span>${chk(t.id,false)}</div>${next}</section>`;
}

/* ---------- Home: the 4 hub blocks, each with 2 live lines ---------- */
function hubBlocksHtml(){
  const td=todayStr(),cl=hubClients(),ppl=hubPeople();
  const nOpen=c=>c.tasks.filter(t=>!t.done).length;
  const famNext=hubUpcoming(it=>(it.kind||"work")==="family",8)[0];
  const pt=hubPersonalTasks(),inbox=S.tasks.filter(t=>hubOpen(t)&&t.inbox).length;
  const wins=S.tasks.filter(t=>t.done&&t.doneAt&&ymd(new Date(t.doneAt))===td).length;
  const bOpen=(S.bills||[]).filter(b=>!b.paid&&b.due&&b.due<=nextPayday()),bLate=bOpen.filter(billLate).length;
  const shops=S.tasks.filter(t=>isShop(t)&&!t.done),left=shops.reduce((a,t)=>a+(t.steps||[]).filter(x=>!x.done).length,0);
  const L={
    clients:cl.length?cl.slice(0,2).map(c=>`${esc(c.name)}: ${nOpen(c)} open`):["No client tasks yet",""],
    family:[famNext?`Next: ${esc(famNext.it.title)}, ${hubDay(famNext.ds).toLowerCase()} ${famNext.it.start}`:"Nothing in the next week",ppl.map(p=>`${esc(p)}: ${S.tasks.filter(t=>hubOpen(t)&&hubHas(t,p)).length} open`).join(" · ")],
    personal:[`${pt.length} task${pt.length===1?"":"s"} open`+(bOpen.length?` · bills ${rands(billSum(bOpen))}${bLate?`, ${bLate} overdue`:""}`:""),`Inbox ${inbox} · Wins today ${wins}`],
    food:[left?`${left} item${left===1?"":"s"} to buy`:"Shopping list is empty",shops.length?shops.map(t=>esc(String(t.title).replace(/\s*shopping\s*$/i,""))).slice(0,3).join(" · "):""]};
  return `<section class="sec hubs" aria-label="Your hubs"><div class="sech"><h2>${ic("flag")}Your hubs</h2></div><div class="hubg">${HUBS.map(h=>`<button type="button" class="hubb ${h.c}" data-hub="${h.k}"><span class="hb-h">${ic(h.i)}<b>${h.t}</b>${ic("right","go")}</span><small>${L[h.k][0]||""}</small><small>${L[h.k][1]||""}</small></button>`).join("")}</div></section>`;
}

/* ---------- hub pages ---------- */
function openHub(k,sub){
  const was=S.view;if(was==="cal")return;if(was==="home")rememberScroll();
  S.hub={k,sub:sub||""};S.view="hub";
  if(was!=="hub")history.pushState({v:"hub"},"","#hub");
  render(false);scrollTo(0,0);if(was!=="hub")animate("sl");
}
function renderHub(){
  const h=S.hub||{k:"clients",sub:""},def=HUBS.find(x=>x.k===h.k)||HUBS[0];
  const body=h.k==="clients"?hubClientsPage(h.sub):h.k==="family"?hubFamilyPage(h.sub):h.k==="personal"?hubPersonalPage():hubFoodPage();
  $("#view").innerHTML=`<div class="hubv ${def.c}"><div class="hubh"><span class="hubi">${ic(def.i)}</span><h2>${esc(h.k==="clients"&&h.sub?h.sub:def.t)}</h2>${h.k==="clients"&&h.sub?`<button type="button" class="tlink" data-hub="clients">All clients${ic("right")}</button>`:""}</div>${body}</div>`;
}
function hubClientsPage(name){
  const cl=hubClients();
  if(!name||!cl.find(c=>c.name===name)){
    if(!cl.length)return `<p class="hubnone">No clients yet. Start a task's title with the client's name and a colon, like "Acme: send the quote", and the client appears here.</p>`;
    return `<div class="hubcl">${cl.map(c=>{const open=c.tasks.filter(t=>!t.done),w=open.filter(t=>t.waiting).length,done=c.tasks.length-open.length,nx=hubUpcoming(it=>clientOf(it)===c.name,60)[0],pct=c.tasks.length?Math.round(done/c.tasks.length*100):0;
      return `<button type="button" class="hubc" data-hub="clients" data-sub="${esc(c.name)}"><span class="hc-h"><b>${esc(c.name)}</b>${ic("right","go")}</span><span class="hc-n">${open.length} open${w?` · ${w} waiting`:""} · ${done} done</span><span class="hbar"><i style="width:${pct}%"></i></span>${nx?`<small>Next: ${esc(nx.it.title)}, ${hubDay(nx.ds).toLowerCase()} ${nx.it.start}</small>`:""}</button>`}).join("")}</div>`;
  }
  const c=cl.find(x=>x.name===name),open=c.tasks.filter(t=>!t.done),done=c.tasks.filter(t=>t.done),waiting=open.filter(t=>t.waiting),pct=c.tasks.length?Math.round(done.length/c.tasks.length*100):0;
  const ev=hubUpcoming(it=>clientOf(it)===name||(!clientOf(it)&&hubHas(it,name)),60);
  return `<div class="hprog"><span class="hbar"><i style="width:${pct}%"></i></span><small>${done.length} of ${c.tasks.length} tasks done</small></div>`
    +hubSec("Appointments",ev.length,ev.map(hubEvRow).join(""),"No appointments coming up.")
    +hubSec("Waiting on",waiting.length,waiting.map(t=>hubTaskRow(t,t.date)).join(""),"Nothing is waiting on anyone.")
    +hubSec("Open tasks",open.length,hubTaskList(open),"Nothing open for this client.")
    +hubSec("Done",done.length,done.slice(-8).reverse().map(t=>`<button type="button" class="crow task dn" data-open="tasks:${t.id}"><span class="cd">${ic("tick")}</span><span class="tt"><b>${esc(t.title)}</b></span></button>`).join(""),"Nothing finished yet.");
}
function hubFamilyPage(person){
  const ppl=hubPeople();if(person&&!ppl.includes(person))person="";
  const tabs=`<div class="hubtabs" role="group" aria-label="Who">${[""].concat(ppl).map(p=>`<button type="button" data-hub="family" data-sub="${esc(p)}" aria-pressed="${p===person}">${p?esc(p):"Everyone"}</button>`).join("")}</div>`;
  if(!person){
    const ev=hubUpcoming(it=>(it.kind||"work")==="family",14);
    const tk=S.tasks.filter(t=>hubOpen(t)&&ppl.some(p=>hubHas(t,p)));
    return tabs+hubSec("Coming up for the family",ev.length,ev.map(hubEvRow).join(""),"Nothing in the next 2 weeks.")
      +hubSec("Family tasks",tk.length,hubTaskList(tk),"No open family tasks.");
  }
  const td=todayStr(),tk=S.tasks.filter(t=>hubOpen(t)&&hubHas(t,person));
  const dated=tk.map(t=>({t,d:[t.date,t.for,t.deadline].filter(x=>x&&x>=td).sort()[0]})).filter(x=>x.d).map(x=>({ds:x.d,html:hubTaskRow(x.t,x.d)}));
  const ev=hubUpcoming(it=>hubHas(it,person),60).map(x=>({ds:x.ds,html:hubEvRow(x)}));
  const coming=dated.concat(ev).sort((a,b)=>a.ds.localeCompare(b.ds));
  return tabs+`<form class="hubadd" data-hubadd="${esc(person)}" autocomplete="off"><input aria-label="Add something for ${esc(person)}" placeholder="Add something for ${esc(person)}" enterkeyhint="done"><button type="submit" class="primary">Add</button></form>`
    +hubSec("Coming up for "+esc(person),coming.length,coming.map(x=>x.html).join(""),"Nothing dated for "+esc(person)+" yet.")
    +hubSec("Tasks",tk.length,hubTaskList(tk),"No open tasks for "+esc(person)+".");
}
function hubPersonalPage(){
  const td=todayStr(),weekAgo=Date.now()-7*864e5,pt=hubPersonalTasks();
  const me=hubUpcoming(it=>(it.kind||"work")==="me",14);
  const rt=hubUpcoming(it=>it.src==="routines"&&(it.kind||"work")!=="family",8);
  const wins=S.tasks.filter(t=>t.done&&t.doneAt&&t.doneAt>=weekAgo).sort((a,b)=>b.doneAt-a.doneAt),today=wins.filter(t=>ymd(new Date(t.doneAt))===td).length;
  return billsBlockHtml()+hubSec("Me time",me.length,me.map(hubEvRow).join(""),"No me time booked in the next 2 weeks.")
    +hubSec("Personal tasks",pt.length,hubTaskList(pt),"No personal tasks open.")
    +hubSec("Routines",rt.length,rt.map(hubEvRow).join(""),"No personal routines yet.")
    +hubSec(`Wins this week`,wins.length,wins.slice(0,15).map(t=>`<button type="button" class="crow task dn" data-open="tasks:${t.id}"><span class="cd">${hubDay(ymd(new Date(t.doneAt)))}</span><span class="tt"><b>${esc(t.title)}</b></span></button>`).join(""),"Tick a task and it shows here. Wins are counted from today on.")
    +(wins.length?`<p class="hubnote">${today} today · ${wins.length} in the last 7 days</p>`:"");
}
function hubFoodPage(){
  const shops=S.tasks.filter(t=>isShop(t)&&!t.done);
  const lists=shops.map(t=>{const left=(t.steps||[]).filter(x=>!x.done).length;return `<section class="sec"><div class="sech"><h2>${esc(String(t.title).replace(/\s*shopping\s*$/i,""))}</h2><span class="cnt">${left} left</span></div><div class="card">${stepList(t)||`<p class="hubnone">No items on this list.</p>`}</div></section>`}).join("");
  return `<button type="button" class="tlink hubshop" data-shop>${ic("plus")}Add items or a shop</button>`+(lists||`<p class="hubnone">Your shopping list is empty.</p>`)
    +`<section class="sec"><div class="sech"><h2>Meals and recipes</h2></div><p class="hubnone">The meal planner, recipes and the grocery list builder arrive in the next update.</p></section>`;
}

/* ---------- Today's work: the day's tasks sorted by what each one needs from Cat ---------- */
const wlNextDay=ds=>{let d=fromYmd(ds);for(let i=0;i<8;i++){d=addDays(d,1);if(sessions(ymd(d)).some(s=>s.windows.length))return ymd(d)}return ymd(addDays(fromYmd(ds),1))};
const wlChip=t=>{const c=clientOf(t);return c?`<i class="wchip2">${esc(c)}</i>`:""};
function wlRow(t,extra){
  const c=clientOf(t),stp=t.steps||[],sd=stp.filter(x=>x.done).length;
  const meta=[t.size?SIZEL[t.size]:t.mins?inFmt(+t.mins):"",stp.length?`${sd} of ${stp.length} steps`:"",extra||""].filter(Boolean).join(" · ");
  return `<div class="wrow ${t.done?"done":""} ${S.flash===t.id?"grow":""}">${chk(t.id,t.done)}<button type="button" class="wmain" data-open="tasks:${t.id}"><b>${t.priority==="top"&&!t.done?ic("focus","pri"):""}${esc(shortTitle(t,c))}</b><small>${wlChip(t)}${esc(meta)}</small></button><button type="button" class="wmore" data-tmenu="${t.id}" aria-label="Move or change ${esc(t.title)}">${ic("more")}</button></div>`;
}
const wlLane=(key,label,sub,rows,openByDefault)=>{if(!rows.length)return"";const o=S.wl&&key in S.wl?S.wl[key]:!!openByDefault;
  return `<button type="button" class="latr wl" data-wlane="${key}" aria-expanded="${o}"><span>${label} · ${rows.length}${sub?`<small>${sub}</small>`:""}</span>${ic(o?"left":"right")}</button>${o?`<div class="wlist">${rows.join("")}</div>`:""}`};
function workListHtml(ds){
  const td=todayStr(),isT=ds===td,nm=nowMin(),ss=sessions(ds);
  let all=ss.flatMap(s=>s.tasks);
  if(!ss.length)all=S.tasks.filter(t=>t.date===ds&&!isShop(t));
  if(!all.length&&!ss.some(s=>s.windows.length))return"";
  const room=ss.reduce((a,s)=>a+s.room,0),openAll=all.filter(t=>!t.done),need=openAll.reduce((a,t)=>a+loadOf(t),0),nos=openAll.filter(t=>!loadOf(t)).length,doneN=all.length-openAll.length;
  const over=need-room,state=!openAll.length?"ok":over>0?"over":need>room*.85?"tight":"ok";
  const fitTxt=!openAll.length?(all.length?"Everything is ticked.":"No tasks planned."):`${inFmt(Math.max(0,room))} left${isT?" today":""} · about ${inFmt(need)} of tasks · ${over>0?inFmt(over)+" over":state==="tight"?"just fits":"fits"}${nos?` · ${nos} with no size`:""}`;
  const pct=all.length?Math.round(doneN/all.length*100):0;
  const clients=[...new Set(openAll.map(t=>clientOf(t)).filter(Boolean))],f=clients.includes(S.wf)?S.wf:"";
  const chips=clients.length>1?`<div class="wfil" role="group" aria-label="Show one client">${[""].concat(clients).map(c=>`<button type="button" data-wfilter="${esc(c)}" aria-pressed="${c===f}">${c?esc(c)+" "+openAll.filter(t=>clientOf(t)===c).length:"All"}</button>`).join("")}</div>`:"";
  const open=openAll.filter(t=>!f||clientOf(t)===f);
  const waiting=open.filter(t=>t.waiting),claude=open.filter(t=>t.ai&&!t.waiting),mine=open.filter(t=>!t.ai&&!t.waiting);
  mine.sort((a,b)=>(a.priority==="top"?0:1)-(b.priority==="top"?0:1));
  /* Next up: what fits before the next appointment, at least 3 and at most 6 */
  const nextBusy=isT?allItemsFor(ds).find(i=>toMin(i.start)>nm):null,gap=nextBusy?toMin(nextBusy.start)-nm:1e9;
  let used=0,n=0;for(const t of mine){const l=loadOf(t)||15;if(n>=3&&used+l>gap)break;used+=l;n++;if(n>=6)break}
  const next=mine.slice(0,n),later=mine.slice(n),ready=claude.filter(t=>t.review),working=claude.filter(t=>!t.review);
  const nextLbl=!isT?"Planned":nextBusy&&n<mine.length?`Next up · before ${esc(nextBusy.title)} at ${nextBusy.start}`:"Next up";
  let h=`<section class="sec wl-sec" aria-label="${isT?"Today's work":"Work for "+dayWord(ds)}"><div class="sech"><h2>${ic("task")}${isT?"Today's work":"Work for "+esc(dayWord(ds))}</h2><span class="cnt">${doneN} of ${all.length} done</span></div>
    <div class="card wl-card"><span class="hbar wl-${state}"><i style="width:${pct}%"></i></span><p class="wl-fit wl-${state}">${fitTxt}</p>${over>0?`<button type="button" class="wl-move" data-moveover="${ds}">Move what doesn't fit to ${esc(dayWord(wlNextDay(ds)))}</button>`:""}${chips}`;
  if(ready.length)h+=`<p class="wl-h rdy">${ic("sparkle")}Ready for you to check <span>${ready.length}</span></p><div class="wlist">${ready.map(t=>wlRow(t,"Claude finished")).join("")}</div>`;
  if(next.length)h+=`<p class="wl-h">${nextLbl}</p><div class="wlist">${next.map(t=>wlRow(t)).join("")}</div>`;
  else if(openAll.length&&!ready.length)h+=`<p class="hubnone">Nothing here needs you right now.</p>`;
  h+=wlLane(ds+"|later",isT?"Later today":"More",null,later.map(t=>wlRow(t)));
  h+=wlLane(ds+"|claude",`${ic("sparkle")}With Claude`,"Claude marks these ready when the work is done",working.map(t=>wlRow(t,"Claude working")));
  h+=wlLane(ds+"|wait","Waiting on others",null,waiting.map(t=>wlRow(t,"Waiting on "+t.waiting)));
  h+=wlLane(ds+"|done","Done",null,all.filter(t=>t.done&&(!f||clientOf(t)===f)).map(t=>wlRow(t)));
  return h+`<button type="button" class="tlink sadd" data-session="${ss.length?sesKey(ds,ss[0]):""}" data-sesfocus="1" ${ss.length?"":"hidden"}>${ic("plus")}Add a task</button></div></section>`;
}
/* after the work day ends: one card to tick what got done; the rest moves on overnight by itself */
function wrapUpHtml(){
  const td=todayStr();if(!isWorkday(new Date())||nowMin()<toMin(S.work.end))return"";
  const open=S.tasks.filter(t=>hubOpen(t)&&t.date&&t.date<=td&&!t.ai&&!t.waiting);if(!open.length)return"";
  const rows=(S.wrapAll?open:open.slice(0,6)).map(t=>wlRow(t)).join("");
  return `<section class="wrapup" aria-label="Wrap up your day"><div class="dn-top"><span class="dn-l">${ic("tick")}Wrap up your day</span><span class="cnt">${open.length} still open</span></div><p class="wu-p">Tick what you finished. Anything left moves to ${esc(dayWord(wlNextDay(td)))} overnight.</p><div class="wlist">${rows}</div>${open.length>6?`<button type="button" class="latr" data-wrapall>${S.wrapAll?"Show fewer":`Show all ${open.length}`}${ic(S.wrapAll?"left":"right")}</button>`:""}</section>`;
}
function taskMenu(id){
  const t=S.tasks.find(x=>x.id===id);if(!t)return;const td=todayStr(),base=t.date&&t.date>=td?t.date:td,nx=wlNextDay(base),isTop=t.priority==="top";
  sheet("Task actions",`<div class="in tmenu"><h3>${esc(t.title)}</h3>
    <button type="button" class="ghost" id="tmNext">${ic("right")}Move to ${esc(dayWord(nx))}</button>
    <button type="button" class="ghost" id="tmPri">${ic("focus")}${isTop?"Remove from priorities":"Make it a priority"}</button>
    <button type="button" class="ghost" id="tmWait">${ic("clock")}${t.waiting?"No longer waiting":"Waiting on someone"}</button>
    <button type="button" class="ghost" id="tmOpen">${ic("pen")}Open the task</button>
    <button type="button" class="ghost" id="tmX">Cancel</button></div>`);
  const before=strip(t);
  $("#tmX").onclick=closeSheet;
  $("#tmOpen").onclick=()=>{closeSheet();setTimeout(()=>openDock("tasks:"+t.id),120)};
  $("#tmNext").onclick=()=>{closeSheet();moveTask(t,nx,null);toast(`Moved to ${dayWord(nx)}`,()=>save("tasks",t.id,before))};
  $("#tmPri").onclick=()=>{closeSheet();const d=base;if(!isTop&&topFor(d).length>=3){toast(`${cap(dayWord(d))} already has 3 priorities.`);return}save("tasks",t.id,{...before,priority:isTop?"normal":"top",date:d,inbox:false});toast(isTop?"Removed from priorities":`Priority for ${dayWord(d)}`,()=>save("tasks",t.id,before))};
  $("#tmWait").onclick=()=>{closeSheet();if(t.waiting){const r={...before};delete r.waiting;save("tasks",t.id,r);toast("Back on your list",()=>save("tasks",t.id,before))}else{save("tasks",t.id,{...before,waiting:"someone"});toast("Parked under Waiting on others",()=>save("tasks",t.id,before))}};
}

/* ---------- clicks and the "add for a person" box ---------- */
function hubClick(e){
  const hb=e.target.closest("[data-hub]");if(hb){openHub(hb.dataset.hub,hb.dataset.sub||"");return true}
  const sa=e.target.closest("[data-sesall]");if(sa){S.sesAll=S.sesAll||{};S.sesAll[sa.dataset.sesall]=!S.sesAll[sa.dataset.sesall];render();return true}
  const ha=e.target.closest("[data-huball]");if(ha){S.hubAll=S.hubAll||{};S.hubAll[ha.dataset.huball]=!S.hubAll[ha.dataset.huball];render();return true}
  const tm=e.target.closest("[data-tmenu]");if(tm){taskMenu(tm.dataset.tmenu);return true}
  const wla=e.target.closest("[data-wlane]");if(wla){S.wl=S.wl||{};const k=wla.dataset.wlane;S.wl[k]=wla.getAttribute("aria-expanded")!=="true";render();return true}
  const wfi=e.target.closest("[data-wfilter]");if(wfi){S.wf=wfi.dataset.wfilter;render();return true}
  const mo=e.target.closest("[data-moveover]");if(mo){const d=mo.dataset.moveover;rebalanceFor(d).then(()=>{if(d===homeSel())render()});return true}
  if(e.target.closest("[data-wrapall]")){S.wrapAll=!S.wrapAll;render();return true}
  if(e.target.closest("[data-pickme]")){const cur=hubNow(),rest=hubTodayOpen().filter(t=>!cur||t.id!==cur.id);if(rest.length){S.pick=rest[Math.floor(Math.random()*rest.length)].id;render()}return true}
  return false;
}
document.addEventListener("submit",e=>{
  const f=e.target.closest&&e.target.closest("[data-hubadd]");if(!f)return;e.preventDefault();
  const inp=f.querySelector("input"),v=inp.value.trim(),p=f.dataset.hubadd;if(!v)return;
  const id=uid();save("tasks",id,{title:`${p}: ${v}`,date:null,priority:"normal",mins:null,done:false,inbox:true,createdAt:Date.now()});
  toast(`Added for ${p}`,()=>remove("tasks",id));
});

"use strict";
const KINDS={work:"Work",family:"Family",admin:"Admin",me:"Me time"};
const DAYN=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONL=["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYL=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const LEVEL={month:0,week:1,day:2};
const S={work:{start:"09:00",end:"16:00"},view:"home",zoom:"day",cur:new Date(),tasks:[],blocks:[],routines:[],slots:[],bills:[],lead:10,alertsHere:false,devices:0,open:null,dock:null,scroll:{}};
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
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
const reduced=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const strip=r=>{const o={...r};delete o.id;delete o.src;delete o._lane;delete o._lanes;return o};
const store={get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch(_){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}}};

/* ---------- colours and time-of-day tint ---------- */
const PALS=[["rainbow","Rainbow",["#F43F5E","#F59E0B","#10B981","#3B82F6","#8B5CF6"]],["calm","Calm",["#3B8C7A","#5A9BD5","#C0607A","#A0742A"]],["ocean","Ocean",["#2F7FD8","#21B5A5","#C2557E","#B07A1E"]],["blossom","Blossom",["#7B6CE0","#E77FA0","#3E9B86","#B7802F"]],["collective","Cat Collective",["#D946EF","#8B5CF6","#0C0912","#FCD34D"]]];
function applyPalette(p){
  p=PALS.some(x=>x[0]===p)?p:"rainbow";
  if(p==="calm")document.documentElement.removeAttribute("data-palette");else document.documentElement.setAttribute("data-palette",p);
  store.set("palette",p);S.palette=p;
}
applyPalette(store.get("palette","rainbow"));
function applyTint(){const h=new Date().getHours();document.documentElement.setAttribute("data-tod",h<5?"night":h<11?"morning":h<17?"day":h<21?"evening":"night")}
applyTint();

/* ---------- line icons (stroke, currentColor) ---------- */
const IC={copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',more:'<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',cart:`<path d="M3 4h2l2.4 11h10.2L20 7H6.2"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>`,
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
 pin:'<path d="M12 21s-6.5-5.7-6.5-11a6.5 6.5 0 0 1 13 0c0 5.3-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
 send:'<path d="M5 12h13M13 6l6 6-6 6"/>',
 left:'<path d="M15 6l-6 6 6 6"/>',
 right:'<path d="M9 6l6 6-6 6"/>',
 alert:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
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
function cacheData(){store.set("cache",{tasks:S.tasks,blocks:S.blocks,routines:S.routines,slots:S.slots,bills:S.bills,settings:{workStart:S.work.start,workEnd:S.work.end,leadMin:S.lead,morning:S.morning,palette:S.palette}})}
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
S.showDel=!!store.get("showDel",false);
const inCal=()=>S.view==="cal";
const shown=it=>!inCal()||(!S.hide.has(it.kind||"work")&&!(it.src==="routines"&&S.hide.has("repeats")));
const tasksShown=()=>!inCal()||!S.hide.has("tasks");
const itemsFor=ds=>allItemsFor(ds).filter(shown);
const tasksDue=ds=>tasksShown()?S.tasks.filter(t=>t.date===ds):[];
const deadlinesFor=ds=>tasksShown()?S.tasks.filter(t=>(t.for===ds||t.deadline===ds)&&t.date!==ds):[];
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
/* ---------- shopping list: tasks named "<Store> shopping" (or marked shop), items are its steps ---------- */
const isShop=t=>!!t&&(!!t.shop||/\bshopping\s*$/i.test(t.title||""));
const shopStore=t=>String(t.title||"").replace(/\s*shopping\s*$/i,"").trim()||"Shopping";
const shopLists=()=>S.tasks.filter(t=>isShop(t)&&!t.done);
const shopOpen=()=>shopLists().filter(t=>(t.steps||[]).some(x=>!x.done)||!(t.steps||[]).length).length;
function openShopping(){
  const lists=shopLists().sort((a,b)=>shopStore(a).localeCompare(shopStore(b)));
  const stores=[...new Set(lists.map(shopStore))];
  const ticked=lists.reduce((a,t)=>a+(t.steps||[]).filter(x=>x.done).length,0);
  sheet("Shopping list",`<div class="in"><h3>Shopping list</h3>
    <form class="shopadd" id="shAdd"><input id="shStore" list="shStores" placeholder="Shop" autocomplete="off" aria-label="Shop" value="${esc(S.lastShop||"")}"><input id="shItem" placeholder="Item" autocomplete="off" aria-label="Item"><button type="submit">Add</button><datalist id="shStores">${stores.map(x=>`<option value="${esc(x)}">`).join("")}</datalist></form>
    ${lists.length?`<div class="shopg">${lists.map(t=>`<div class="store"><div class="sth"><b>${esc(shopStore(t))}</b><span class="cnt">${(t.steps||[]).filter(x=>!x.done).length} left</span></div>${(t.steps||[]).map((x,i)=>`<label class="step ${x.done?"done":""}"><input type="checkbox" data-step="${i}" data-key="tasks:${t.id}" ${x.done?"checked":""}><span>${esc(x.text)}</span></label>`).join("")||`<p class="hint">No items yet.</p>`}</div>`).join("")}</div>`:`<p class="hint">Your shopping list is empty. Add a shop and an item above.</p>`}
    <div class="acts sticky">${ticked?`<button type="button" class="ghost" id="shClear">Clear ${ticked} ticked</button>`:""}<button class="ghost" type="button" data-sheetx style="flex:1">Close</button></div></div>`);
  $("#sheetRoot").addEventListener("change",e=>{if(e.target.closest("[data-step]"))setTimeout(()=>{if(sheetOpen())openShopping()},60)});
  $("#shAdd").onsubmit=e=>{e.preventDefault();const st=$("#shStore").value.trim(),it=$("#shItem").value.trim();if(!st){$("#shStore").focus();return}if(!it){$("#shItem").focus();return}
    S.lastShop=st;const t=shopLists().find(x=>shopStore(x).toLowerCase()===st.toLowerCase());
    if(t)save("tasks",t.id,{...strip(t),steps:[...(t.steps||[]),{text:it,done:false}]});
    else save("tasks",uid(),{title:st+" shopping",shop:true,date:null,inbox:false,priority:"normal",mins:null,done:false,createdAt:Date.now(),steps:[{text:it,done:false}]});
    openShopping();setTimeout(()=>$("#shItem")?.focus(),40)};
  const cl=$("#shClear");if(cl)cl.onclick=()=>{const before=lists.map(t=>strip(t));lists.forEach(t=>{const left=(t.steps||[]).filter(x=>!x.done);if(left.length===(t.steps||[]).length)return;if(left.length)save("tasks",t.id,{...strip(t),steps:left});else save("tasks",t.id,{...strip(t),steps:[],done:true})});
    openShopping();toast("Ticked items cleared",()=>{before.forEach((b,i)=>save("tasks",lists[i].id,b));if(sheetOpen())openShopping()})};
}

/* ---------- clients: the name before the colon in a title groups a task ("Kiddie Depot: finish catalogue") ---------- */
const rawClient=t=>{if(t.client)return String(t.client).trim();const m=/^([^:]{2,40}):\s+\S/.exec(t.title||"");return m?m[1].trim():""};
function knownClients(){const all=new Set();[...S.tasks,...S.blocks].forEach(x=>{const c=rawClient(x);if(c)all.add(c)});return[...all]}
function clientOf(t){const c=rawClient(t);if(!c)return"";const lc=c.toLowerCase();const base=knownClients().filter(k=>k.length<c.length&&lc.startsWith(k.toLowerCase()+" ")).sort((a,b)=>a.length-b.length)[0];return base||c}
/* the title without its client name: "Kiddie Depot mobile: review changes" under Kiddie Depot reads "Mobile: review changes" */
function shortTitle(t,c){const tt=String(t.title||"");if(!c)return tt;const lc=c.toLowerCase();
  if(tt.toLowerCase().startsWith(lc+":"))return tt.slice(c.length+1).trim().replace(/^./,x=>x.toUpperCase());
  if(tt.toLowerCase().startsWith(lc+" ")){const r=tt.slice(c.length+1).trim();return r.replace(/^./,x=>x.toUpperCase())}return tt}
function groupTasks(list){const g=new Map();list.forEach(t=>{const c=clientOf(t);if(!g.has(c))g.set(c,[]);g.get(c).push(t)});
  const keys=[...g.keys()].filter(Boolean).concat(g.has("")?[""]:[]);return keys.map(k=>({client:k,tasks:g.get(k)}))}

/* ---------- work sessions: windows that hold tasks with no set times ---------- */
/* appointments and routines cut the windows; sizes only warn when a session looks full; Claude's tasks count a third */
const SIZES={quick:15,medium:45,big:90},SIZEL={quick:"Quick",medium:"Medium",big:"Big"};
const loadOf=t=>{const m=SIZES[t.size]||Math.max(0,+t.mins||0);return t.ai?Math.round(m/3):m};
/* client tasks are work; anything else without a kind is admin */
const taskKind=t=>t.kind||(clientOf(t)?"work":"admin");
function slotDefs(ds){const w=wd(fromYmd(ds));
  if((S.slots||[]).length)return S.slots.filter(s=>(s.days||[]).includes(w)&&!(s.skips||[]).includes(ds)).map(s=>({id:s.id,title:s.title||"Work session",start:s.start,end:s.end,kind:s.kind||"work"})).sort((a,b)=>toMin(a.start)-toMin(b.start));
  return w<=5?[{id:"work",title:"Work session",start:S.work.start,end:S.work.end,kind:"work"}]:[]}
const sesOrder=(a,b)=>(b.carries||0)-(a.carries||0)||(a.priority==="top"?0:1)-(b.priority==="top"?0:1)||(a.createdAt||0)-(b.createdAt||0);
function sessions(ds){
  const b=busy(ds),td=todayStr(),nm=ds===td?nowMin():null;
  const ss=slotDefs(ds).map(s=>{let t=toMin(s.start);const e=toMin(s.end),w=[];for(const[x,y]of b){if(Math.min(x,e)-t>=15)w.push([t,Math.min(x,e)]);t=Math.max(t,y)}if(e-t>=15)w.push([t,e]);return{...s,windows:w,tasks:[],load:0,room:0}});
  const open=s=>s.windows.length&&(nm===null||s.windows.some(([,y])=>y>nm));
  const timed=new Set(S.blocks.filter(x=>x.taskId&&x.date===ds).map(x=>x.taskId));
  S.tasks.filter(t=>(t.date===ds||(ds===td&&t.date&&t.date<ds&&!t.done))&&!timed.has(t.id)&&!isShop(t)).sort(sesOrder).forEach(t=>{
    const s=ss.find(x=>x.id===t.slot&&open(x))||ss.find(open)||ss.find(x=>x.windows.length)||ss[0];if(s)s.tasks.push(t)});
  ss.forEach(s=>{s.room=s.windows.reduce((a,[x,y])=>a+Math.max(0,y-Math.max(x,nm??0)),0);s.load=s.tasks.filter(t=>!t.done).reduce((a,t)=>a+loadOf(t),0)});
  return ss;
}
const sesKey=(ds,s)=>ds+"|"+s.id;
const sesSpan=s=>s.windows.map(([a,b])=>hm(a)+"–"+hm(b)).join(", ");
const sesFull=s=>s.load>s.room&&s.tasks.some(t=>!t.done&&loadOf(t));
/* free work time that no session covers, for days with custom slots */
function looseGaps(ds,min){const ws=sessions(ds).flatMap(s=>s.windows);return gaps(ds,min).flatMap(([a,b])=>{let out=[[a,b]];ws.forEach(([x,y])=>{out=out.flatMap(([p,q])=>y<=p||x>=q?[[p,q]]:[[p,x],[y,q]].filter(([u,v])=>v-u>0))});return out.filter(([u,v])=>v-u>=min)})}
/* the session after this one: later that day, then the next work days */
function nextSession(ds,id){
  const ss=sessions(ds),i=ss.findIndex(s=>s.id===id),later=ss.slice(i+1).find(s=>s.room);if(later)return{ds,s:later};
  let d=ds;for(let k=0;k<14;k++){d=ymd(addDays(fromYmd(d),1));const f=sessions(d).find(s=>s.windows.length);if(f)return{ds:d,s:f}}return null}
function moveTask(t,ds,slot){const r={...strip(t),date:ds,inbox:false};if(slot&&slot!=="work")r.slot=slot;else delete r.slot;if(ds!==t.date){delete r.carries;delete r.from}return save("tasks",t.id,r)}
/* after an appointment or a sized task changes a day, the server moves overflow to the next session with room */
async function rebalanceFor(ds){
  if(!ds||ds<todayStr())return;
  let j;try{j=await api({op:"rebalance",data:{date:ds}})}catch(_){return}
  const mv=j.moved||[];if(!mv.length)return;
  await load();const to=mv[mv.length-1].to;
  toast(`${mv.length} task${mv.length>1?"s":""} moved to ${to.label}, ${dayWord(to.date)}`,()=>{mv.forEach(m=>{const t=S.tasks.find(x=>x.id===m.id);if(t){const r={...strip(t),date:m.from.date};if(m.from.slot)r.slot=m.from.slot;else delete r.slot;save("tasks",t.id,r)}});toast("Moved back")});
}
const sesRow=(ds,s,w,past)=>`<div class="ag ses-r k-${s.kind} ${past?"past":""}"><span class="at">${hm(w[0])}</span><button type="button" class="am" data-session="${sesKey(ds,s)}"><i class="kd" aria-hidden="true"></i><span class="tt"><b>${esc(s.title)}${past?`<span class="pastl">past</span>`:""}</b><small>${hm(w[0])}–${hm(w[1])} · ${inFmt(w[1]-w[0])}</small></span></button></div>`;
function stepList(t){const st=t.steps||[];if(!st.length)return"";return `<div class="tsteps">${st.map((x,i)=>`<label class="step ${x.done?"done":""}"><input type="checkbox" data-step="${i}" data-key="tasks:${t.id}" ${x.done?"checked":""}><span>${esc(x.text)}</span></label>`).join("")}</div>`}
function sesTask(t,ds,c){const stp=t.steps||[],sd=stp.filter(x=>x.done).length;const ns=[t.size?SIZEL[t.size]:t.mins?inFmt(+t.mins):"",stp.length?`${sd} of ${stp.length} steps`:""].filter(Boolean).join(" · ");
  return `<div class="trow ${t.done?"done":""} ${S.flash===t.id?"grow":""}">${chk(t.id,t.done)}<div class="tcol"><button type="button" class="tmain" data-open="tasks:${t.id}"><b>${esc(shortTitle(t,c))}</b>${dateLine(t,ds)}${ns?`<span class="dline">${ns}</span>`:""}</button></div></div>`}
function sesCard(ds,s){
  const td=todayStr(),nm=nowMin(),tops=new Set(topFor(ds).map(t=>t.id)),list=s.tasks.filter(t=>!tops.has(t.id)),prio=s.tasks.filter(t=>tops.has(t.id)),np=prio.length,nos=s.tasks.filter(t=>!t.done&&!loadOf(t)).length;
  const open=s.tasks.filter(t=>!t.done).length,all=s.windows.reduce((a,[x,y])=>a+y-x,0),ended=ds===td&&s.windows.every(([,y])=>y<=nm);
  const chips=s.windows.map(([a,b])=>`<span class="wchip ${ds===td&&b<=nm?"gone":""}">${hm(a)}–${hm(b)}</span>`).join("");
  let h=`<div class="scard k-${s.kind}"><div class="sch"><b>${esc(s.title)} tasks</b><span>${open} to do${np?`, incl. ${np} ${np>1?"priorities":"priority"}`:""} · ${inFmt(all)} in all</span>${sesFull(s)?`<span class="pill amber">Looks full</span>`:""}${nos&&s.tasks.some(t=>!t.done&&loadOf(t))?`<span class="nosz">${nos} with no size, not counted</span>`:""}</div>${s.windows.length>1?`<div class="wchips">${chips}</div>`:""}`;
  if(prio.length)h+=`<p class="cgrp prio">${ic("focus")}Priorities <span>do these first</span></p>${prio.map(t=>sesTask(t,ds,"")).join("")}`;
  const key=sesKey(ds,s),showAll=!!(S.sesAll&&S.sesAll[key]),openList=list.filter(t=>!t.done),doneList=list.filter(t=>t.done),CAP=5;
  const shown=showAll?list:openList.slice(0,CAP),later=showAll?0:openList.length-shown.length+doneList.length;
  h+=groupTasks(shown).map(g=>`<p class="cgrp ${g.client?"":"me"}">${esc(g.client||"Personal")} <span>${g.tasks.length} task${g.tasks.length>1?"s":""}</span></p>${g.tasks.map(t=>sesTask(t,ds,g.client)).join("")}`).join("");
  if(!list.length&&!prio.length)h+=`<p class="sesn">No tasks in this session yet.</p>`;
  if(ended&&open)h+=`<p class="sesn">Anything not ticked moves to your next work day overnight.</p>`;
  if(later>0||showAll&&list.length>CAP)h+=`<button type="button" class="latr" data-sesall="${key}" aria-expanded="${showAll}">${showAll?"Show fewer":`Later: ${openList.length-shown.length} more task${openList.length-shown.length===1?"":"s"}${doneList.length?` · ${doneList.length} done`:""}`}${ic(showAll?"left":"right")}</button>`;
  return h+`<button type="button" class="tlink sadd" data-session="${sesKey(ds,s)}" data-sesfocus="1">${ic("plus")}Add a task</button></div>`;
}
function openSession(key,focus){
  const[ds,id]=key.split("|"),s=sessions(ds).find(x=>x.id===id);if(!s){toast("That session isn't on this day any more.");return}
  const row=t=>`<div class="trow ${t.done?"done":""}">${chk(t.id,t.done)}<span class="tmain"><b>${esc(t.title)}</b>${dateLine(t,ds)}${t.size?`<span class="dline">${SIZEL[t.size]}</span>`:""}</span>${t.done?"":`<button type="button" class="tlink" data-sesnext="${t.id}" aria-label="Move ${esc(t.title)} to the next session">Next${ic("right")}</button>`}</div>`;
  sheet(s.title,`<div class="in"><h3>${esc(s.title)}, ${esc(dayWord(ds))}</h3><p class="hint">${s.windows.length?esc(sesSpan(s)):"Appointments fill this session"}${s.load?` · about ${inFmt(s.load)} of ${inFmt(s.room)} left`:""}. Work down the list in any order.</p>
    ${sesFull(s)?`<p class="over-l">${ic("hourglass")}The sized tasks here look like more than the time left.</p>`:""}
    <form class="quick" id="sesNew"><input id="sesIn" placeholder="Add a task to this session" autocomplete="off" aria-label="New task"><button type="submit">Add</button></form>
    <div class="f"><span class="lb">Size <span class="opt">(optional)</span></span>${optsHtml("sesSize",[["","Not sized"],["quick","Quick"],["medium","Medium"],["big","Big"]],"","s")}</div>
    <div class="f"><span class="lb">Who's doing it</span>${optsHtml("sesAi",[["0","Me"],["1","Claude"]],"0","a")}</div>
    ${s.tasks.length?`<div class="card list">${s.tasks.map(row).join("")}</div>`:`<p class="hint">No tasks in this session yet.</p>`}
    <div class="acts sticky"><button class="ghost" type="button" data-sheetx style="flex:1">Close</button></div></div>`);
  ["sesSize","sesAi"].forEach(g=>$("#"+g).onclick=e=>{const b=e.target.closest("button");if(!b)return;$("#"+g).querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed","false"));b.setAttribute("aria-pressed","true")});
  $("#sesNew").onsubmit=async e=>{e.preventDefault();const v=$("#sesIn").value.trim();if(!v)return;const id2=uid(),sz=picked("sesSize","s",""),ai=picked("sesAi","a","0")==="1";
    const r={title:v,date:ds,priority:"normal",mins:null,done:false,inbox:false,createdAt:Date.now()};if(id!=="work")r.slot=id;if(sz)r.size=sz;if(ai)r.ai=true;
    const p=save("tasks",id2,r);openSession(key);toast("Added to "+s.title,()=>remove("tasks",id2));if(sz){await p;rebalanceFor(ds)}};
  $("#sheetRoot").onclick=e=>{if(e.target.closest("[data-toggle]")){setTimeout(()=>{if(sheetOpen())openSession(key)},420);return}const n=e.target.closest("[data-sesnext]");if(!n)return;const t=S.tasks.find(x=>x.id===n.dataset.sesnext);if(!t)return;const nx=nextSession(ds,id);if(!nx){toast("There's no session in the next 2 weeks.");return}
    const before=strip(t);moveTask(t,nx.ds,nx.s.id);openSession(key);toast(`Moved to ${nx.s.title}, ${dayWord(nx.ds)}`,()=>save("tasks",t.id,before))};
  if(focus)setTimeout(()=>$("#sesIn")?.focus(),60);
}
/* weekly slots, set in Settings; until there are any, each weekday's work hours act as one session */
function openSlot(rec){
  const isNew=!rec;rec=rec||{title:"",start:S.work.start,end:"12:00",days:[1,2,3,4,5],kind:"work"};
  sheet(isNew?"New work slot":"Edit work slot",`<form class="in" id="slForm"><h3>${isNew?"New":"Edit"} work slot</h3>
    ${(S.slots||[]).length?"":`<p class="hint">Your first slot replaces the single all-day session, so add each window you want.</p>`}
    <div class="f"><label for="slTitle">Name</label><input id="slTitle" value="${esc(rec.title)}" placeholder="Client work" autocomplete="off"></div>
    <div class="two">${tp("slStart",rec.start,"Start")}${tp("slEnd",rec.end,"End")}</div>
    <div class="f"><span class="lb">Days</span><div class="opts" id="slDays">${DAYN.map((n,i)=>`<button type="button" data-d="${i+1}" aria-pressed="${(rec.days||[]).includes(i+1)}">${n}</button>`).join("")}</div></div>
    <div class="f"><span class="lb">Type</span>${optsHtml("slKind",Object.entries(KINDS),rec.kind||"work","k")}</div>
    <div class="err" id="slErr" role="alert"></div>
    <div class="acts sticky"><button class="primary" type="submit">${isNew?"Add":"Save"}</button>${isNew?"":`<button type="button" class="danger" id="slDel">Delete</button>`}<button type="button" class="ghost" id="slBack">Back</button></div></form>`);
  linkTimes("slStart","slEnd");
  $("#slDays").onclick=e=>{const b=e.target.closest("button");if(b)b.setAttribute("aria-pressed",b.getAttribute("aria-pressed")==="true"?"false":"true")};
  $("#slKind").onclick=e=>{const b=e.target.closest("button");if(!b)return;$("#slKind").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed","false"));b.setAttribute("aria-pressed","true")};
  $("#slBack").onclick=openSettings;
  if(!isNew)$("#slDel").onclick=()=>{const before=strip(rec);remove("slots",rec.id);openSettings();toast("Slot deleted",()=>save("slots",rec.id,before))};
  $("#slForm").onsubmit=e=>{e.preventDefault();const err=$("#slErr"),t=$("#slTitle").value.trim(),s=tpv("slStart"),en=tpv("slEnd"),days=[...document.querySelectorAll('#slDays [aria-pressed="true"]')].map(b=>+b.dataset.d);
    if(!t){err.textContent="Give the slot a name.";return}if(!days.length){err.textContent="Pick at least one day.";return}if(toMin(en)<=toMin(s)){err.textContent="End time needs to be after the start time.";return}
    save("slots",rec.id||uid(),{...strip(rec),title:t,start:s,end:en,days,kind:picked("slKind","k","work")});openSettings();toast(isNew?"Slot added":"Slot saved")};
}
const slotsHtml=()=>(S.slots||[]).length?`<div class="card list">${[...S.slots].sort((a,b)=>toMin(a.start)-toMin(b.start)).map(s=>`<button type="button" class="crow k-${s.kind||"work"}" data-slotedit="${s.id}"><span class="cd">${s.start}</span><span class="tt"><b>${esc(s.title)}</b><small>${s.start}–${s.end} · ${dayLabel(s.days)}</small></span></button>`).join("")}</div><button type="button" class="tlink" data-slotnew>${ic("plus")}Add a slot</button>`
  :`<p class="hint">Each weekday's work hours act as one work session that holds your tasks. Add slots to split it, e.g. Client work 09:00 to 13:00.</p><button type="button" class="tlink" data-slotnew>${ic("plus")}Add a slot</button>`;
const REMINDS=[["d","Default"],[-1,"None"],[0,"At start"],[5,"5 min"],[15,"15 min"],[30,"30 min"],[60,"1 h"],[120,"2 h"],[1440,"1 day"]];
const REMINDS2=[["n","None"],[0,"At start"],[5,"5 min"],[15,"15 min"],[30,"30 min"],[60,"1 h"],[1440,"1 day"]];
const remindLabel=r=>r===undefined||r===null?`${S.lead} min before`:r<0?"No reminder":r===0?"At start":r>=1440?(r/1440)+" day"+(r>1440?"s":"")+" before":r>=60?(r/60)+" h before":r+" min before";
/* timing state for today: past items fade, the next one glows from 15 min before */
function timing(it,ds){if(ds!==todayStr())return"";const m=nowMin(),s=toMin(it.start),e=toMin(it.end);if(e<=m)return"past";if(s>m&&s-m<=15)return"soon";return""}

/* ---------- dates in words: planned date, deadline and event date stay separate ---------- */
const relDay=ds=>{const n=daysBetween(todayStr(),ds);if(n===0)return"today";if(n===1)return"tomorrow";if(n===-1)return"yesterday";if(n>-7&&n<7)return DAYL[wd(fromYmd(ds))-1];return fmt(fromYmd(ds),{day:1,month:"short"})+(ds.slice(0,4)!==todayStr().slice(0,4)?" "+ds.slice(0,4):"")};
const dayWord=ds=>{const n=daysBetween(todayStr(),ds);return n===0?"today":n===1?"tomorrow":fmt(fromYmd(ds),{weekday:"long",day:1,month:"short"})};
const carried=t=>!t.done&&!!t.date&&(t.date<todayStr()||(!!t.carries&&!!t.from&&t.date===todayStr()));
const nextStep=t=>(t.steps||[]).find(x=>!x.done);
/* the event a prep task is for: a one-off block on that day whose title shares a word with the task */
function eventName(t){
  const bl=S.blocks.filter(b=>b.date===t.for);if(!bl.length)return"Event";
  const words=new Set((t.title||"").toLowerCase().match(/[a-z]{4,}/g)||[]);
  const hit=bl.find(b=>((b.title||"").toLowerCase().match(/[a-z]{4,}/g)||[]).some(w=>words.has(w)))||(bl.length===1?bl[0]:null);
  return hit?String(hit.title).split(/[:(]/)[0].trim():"Event";
}
function dateBits(t,ctx){
  const td=todayStr(),b=[];
  if(t.waiting&&!t.done)b.push(["wait","Waiting on "+esc(t.waiting)]);
  if(t.ai&&!t.done)b.push(["aiw","Claude working"]);
  if(carried(t)){const f=t.date<td?t.date:t.from,n=(t.carries||0)+(t.date<td?1:0);b.push([n>=3?"amber":"","From "+DAYN[wd(fromYmd(f))-1]+(n>=3?`, moved ${n} times`:"")])}
  else if(t.date&&t.date!==ctx)b.push(["","Planned "+relDay(t.date)]);
  if(t.deadline&&!t.done){const n=daysBetween(td,t.deadline);b.push(n<0?["red","Overdue since "+relDay(t.deadline)]:n===0?["amber","Due today"]:n===1?["amber","Due tomorrow"]:["","Do by "+relDay(t.deadline)])}
  if(t.for){const n=daysBetween(td,t.for),nm=esc(eventName(t));b.push(n<0?["",nm+" was "+relDay(t.for)]:["",nm+" "+relDay(t.for)])}
  return b;
}
const dateLine=(t,ctx)=>{const b=dateBits(t,ctx);return b.length?`<span class="dline">${b.map(([c,x])=>`<span class="${c}">${x}</span>`).join(" · ")}</span>`:""};
const blockOf=t=>S.blocks.filter(b=>b.taskId===t.id).sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start))[0];

/* ---------- details panel: slides up, scrolls, closes back to where you were ---------- */
function resolve(key){if(!key)return null;const[col,id,date]=key.split(":");const rec=(S[col]||[]).find(x=>x.id===id);return rec?{col,rec,date:date||(col==="blocks"?rec.date:null)||null}:null}
function scheduleChip(col,rec,date){
  if(col==="tasks"){const b=blockOf(rec);if(b)return`${shortD(b.date)} · ${b.start}–${b.end}`;if(rec.date)return`Planned ${shortD(rec.date)} · no time yet`;return"No time scheduled"}
  if(col==="routines")return(date?shortD(date)+" · ":dayLabel(rec.days)+" · ")+`${rec.start}–${rec.end}`;
  return`${shortD(rec.date)} · ${rec.start}–${rec.end}`;
}
function panelHtml(key){
  const r=resolve(key);if(!r)return"";const{col,rec,date}=r,isT=col==="tasks",isR=col==="routines",kind=rec.kind||(isT?taskKind(rec):"work");
  const task=!isT&&rec.taskId?S.tasks.find(t=>t.id===rec.taskId):null;
  const done=isT?!!rec.done:(task?!!task.done:itemDone({...rec,src:col},date));
  const chips=[`<span class="chip k-${kind}">${ic(itemIcon(rec,isR?"repeat":kind))}${KINDS[kind]||"Task"}</span>`,`<span class="chip plain">${ic(isT?"cal":"clock")}${esc(scheduleChip(col,rec,date))}</span>`];
  if(isT&&rec.priority==="top"&&rec.date)chips.push(`<span class="chip plain">${ic("star")}Priority ${carried(rec)?"today":relDay(rec.date)}</span>`);
  if(isR)chips.push(`<span class="chip plain">${ic("repeat")}${esc(dayLabel(rec.days))}</span>`);
  const rows=[];
  if(isT){
    rows.push(["cal","Planned for",rec.date?longD(rec.date)+(carried(rec)?` <span class="mut">· not done yet</span>`:""):`<span class="mut">No day yet</span>`]);
    if(rec.deadline){const n=daysBetween(todayStr(),rec.deadline);rows.push(["flag","Deadline",`<span class="${!rec.done&&n<0?"red":!rec.done&&n<=1?"amber":""}">${longD(rec.deadline)}</span>`])}
    if(rec.for)rows.push(["star","Event",`${esc(eventName(rec))} · ${longD(rec.for)}`]);
    if(rec.waiting)rows.push(["hourglass","Waiting on",esc(rec.waiting)]);
    if(rec.mins||rec.actual)rows.push(["clock","Time",(rec.mins?`About ${inFmt(rec.mins)}`:"")+(rec.actual?`${rec.mins?" · ":""}took ${inFmt(rec.actual)}`:"")]);
  }else{
    if(rec.location)rows.push(["pin","Where",`<a class="maplink" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rec.location)}" target="_blank" rel="noopener">${esc(rec.location)}</a>`]);
    rows.push(["bell","Reminder",remindLabel(rec.remind)+(typeof rec.remind2==="number"?" and "+remindLabel(rec.remind2):"")]);
    if(rec.buffer)rows.push(["buffer","Buffer",rec.buffer+" min after"]);
    if(isR&&rec.until)rows.push(["repeat","Repeats until",longD(rec.until)]);
    if(task)rows.push(["task","Task",`<button class="tlink" data-open="tasks:${task.id}">${esc(task.title)}</button>`]);
  }
  const steps=isR?null:(rec.steps||[]);
  const stepsHtml=steps?`<section class="dsec"><div class="dsh"><h3>${isT?"Next steps":"Steps"}</h3>${steps.length&&isT?`<span class="cnt">${steps.filter(x=>x.done).length} of ${steps.length} done</span>`:""}</div>${steps.length?(isT?`<div class="card list">${steps.map((x,i)=>`<label class="step ${x.done?"done":""}"><input type="checkbox" data-step="${i}" data-key="${key}" ${x.done?"checked":""}><span>${esc(x.text)}</span></label>`).join("")}</div>`:`<ul class="card list esteplist">${steps.map(x=>`<li>${esc(x.text)}</li>`).join("")}</ul>`):""}<form class="quick dstep" data-addstep="${key}"><input id="dStepIn" placeholder="Add a step" autocomplete="off" aria-label="New step"><button type="submit">Add</button></form></section>`:"";
  const noteVal=isR?(date?(rec.dayNotes?.[date]||""):""):(rec.notes||"");
  const notesHtml=(!isR||date)?`<section class="dsec"><div class="dsh"><h3>${isR?"Note for this day":"Notes"}</h3><span class="cnt" id="dNoteSt"></span></div><textarea id="dNote" data-key="${key}" rows="3" placeholder="Add a note">${esc(noteVal)}</textarea></section>`:"";
  const skipped=isR&&date&&(rec.skips||[]).includes(date);
  let acts="",more="";
  if(isT){
    acts=rec.done?`<button class="ghost wide" data-act="done" data-key="${key}" type="button">Mark not done</button>`:`<button class="ghost wide" data-act="schedule" data-key="${key}" type="button">${ic("cal")}Schedule</button><button class="primary wide" data-act="done" data-key="${key}" type="button">${ic("tick")}Mark complete</button>`;
    if(!rec.done){more+=`<button class="ghost" data-act="pri" data-key="${key}" type="button">${ic("star")}${rec.priority==="top"&&rec.date?"Remove from priorities":"Make a priority"}</button>`;
      if(!rec.date&&rec.inbox!==false)more+=`<button class="ghost" data-act="keep" data-key="${key}" type="button">Move to Unscheduled</button>`;
      more+=`<button class="ghost" data-act="focus" data-key="${key}" type="button">${ic("focus")}Focus</button>`}
  }else{
    acts=`<button class="ghost wide" data-act="edit" data-key="${key}" type="button">${ic("pen")}Edit</button>${task?`<button class="primary wide" data-act="idone" data-key="${key}" type="button">${done?"Mark not done":ic("tick")+"Mark done"}</button>`:""}`;
    if(!isR||date)more+=`<button class="ghost" data-act="focus" data-key="${key}" type="button">${ic("focus")}Focus</button>`;
    if(isR&&date)more+=`<button class="ghost" data-act="skip" data-key="${key}" type="button">${skipped?"Bring back this day":"Skip this day"}</button>`;
  }
  if(isT)more+=`<button class="ghost" data-act="edit" data-key="${key}" type="button">${ic("pen")}Edit</button>`;
  return `<div class="dhead"><h2 id="dTitle" class="${done?"strike":""}">${esc(rec.title)}</h2><button class="icon" data-dockx type="button" aria-label="Close details">${ic("x")}</button></div>
    <div class="dbody"><div class="chips">${chips.join("")}</div>${rows.length?`<dl class="facts">${rows.map(([i,k,v])=>`<div><dt>${ic(i)}${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`:""}${stepsHtml}${notesHtml}${more?`<div class="dmore">${more}</div>`:""}</div>
    <div class="dacts">${acts}</div>`;
}
function openDock(key){if(!S.dock&&!sheetOpen())pushOverlay();S.dockFrom=key;S.dock=key;renderDock();setTimeout(()=>{const x=document.querySelector("#dock [data-dockx].icon");if(x)x.focus({preventScroll:true})},40)}
function closeDock(){const from=S.dockFrom;S.dock=null;renderDock();release();if(from){const el=document.querySelector(`#view [data-open="${from}"],#view [data-dock="${from}"]`);if(el)el.focus({preventScroll:true})}}
function renderDock(){
  const d=$("#dock");if(!S.dock||!resolve(S.dock)){d.hidden=true;d.innerHTML="";S.dock=null;document.body.classList.remove("dockopen");return}
  const body=d.querySelector(".dbody"),y=body?body.scrollTop:0,same=d.dataset.key===S.dock;
  d.dataset.key=S.dock;
  d.innerHTML=`<div class="dscrim" data-dockx></div><div class="dpanel ${same?"":"enter"}" role="dialog" aria-modal="true" aria-labelledby="dTitle">${panelHtml(S.dock)}</div>`;
  d.hidden=false;document.body.classList.add("dockopen");
  if(same){const b=d.querySelector(".dbody");if(b)b.scrollTop=y}
}

/* ---------- header and Now bar (calendar only) ---------- */
function greet(h){return h<12?"Good morning":h<17?"Good afternoon":"Good evening"}
const weekLabel=d=>{const m=monday(d),s=addDays(m,6);return fmt(m,{day:1,month:"short"})+" to "+fmt(s,{day:1,month:"short"})};
function wxText(){if(!S.wx||S.wx.err)return"";return ` · ${S.wx.t}° ${WX[S.wx.code]||""}`}
function wxHtml(){if(!S.wx||S.wx.err)return"";const w=S.wx;return `<span class="wxp" aria-label="Weather">${ic(w.code>=51?"rain":w.code>=3?"cloud":"sun")}<span><b>${w.t}°</b> ${esc(WX[w.code]||"")}<small>${esc(w.place||"Durbanville")}${w.hi!==undefined?` · H ${w.hi}° L ${w.lo}°`:""}</small></span></span>`}
function renderHeader(){
  const c=S.cur,n=new Date(),cal=S.view==="cal";let sub="",main="";
  $("#backrow").hidden=!cal&&S.view!=="hub";
  document.body.classList.toggle("homehead",!cal);
  if(!cal){sub=`<button type="button" class="dlink" data-opencal="today" aria-label="${esc(fmt(n,{weekday:"long",day:1,month:"long"}))}. Open the calendar">${esc(fmt(n,{weekday:"short",day:1,month:"short"}))}</button>${wxHtml()}`;main=hm(n.getHours()*60+n.getMinutes())}
  else{
    const crumbs=[];
    if(S.zoom!=="month")crumbs.push(`<button data-crumb="month">${S.zoom==="day"?MONL[c.getMonth()].slice(0,3):MONL[c.getMonth()]}</button>`);else crumbs.push(`<span class="cur">${c.getFullYear()}</span>`);
    if(S.zoom==="day")crumbs.push(`<button data-crumb="week">${weekLabel(c).replace(/^(\d+) (\S+) to (\d+) \2$/,"$1 to $3 $2")}</button>`);
    if(S.zoom==="week")crumbs.push(`<span class="cur">Week</span>`);
    sub=`<span class="crumbs">${crumbs.join('<span class="sep">›</span>')}</span>`;
    main=S.zoom==="month"?MONL[c.getMonth()]:S.zoom==="week"?weekLabel(c):(ymd(c)===todayStr()?"Today, ":"")+fmt(c,{weekday:"short",day:1,month:"short"});
  }
  $("#dsub").innerHTML=sub;$("#dmain").textContent=main;
  $("#out").hidden=!(cal&&S.zoom!=="month");$("#prev").hidden=!cal;$("#next").hidden=!cal;
  const fab=$("#fab");fab.hidden=!cal;fab.setAttribute("aria-label","Add a time block, task or routine");
  renderNowbar();
}
function renderNowbar(){
  const b=$("#nowbar");if(S.view!=="cal"){b.hidden=true;return}
  const ds=todayStr(),m=nowMin(),its=allItemsFor(ds),cur=its.filter(i=>toMin(i.start)<=m&&toMin(i.end)>m).pop(),nxt=its.find(i=>toMin(i.start)>m);
  if(cur){b.className="nowbar k-"+(cur.kind||"work");b.innerHTML=`<span class="dot"></span><span class="nt"><b>Now</b> ${esc(cur.title)} · ${inFmt(toMin(cur.end)-m)} left</span>${nxt?`<span class="nr">Next ${nxt.start}</span>`:""}`}
  else{b.className="nowbar"+(nxt?" k-"+(nxt.kind||"work"):"");b.innerHTML=`<span class="dot"></span><span class="nt">${nxt?`<b>Free</b> until ${nxt.start} · ${esc(nxt.title)}`:"<b>Free</b> for the rest of today"}</span>`}
  b.setAttribute("aria-label",b.textContent+". Open today");b.hidden=false;
}

/* ---------- shared rows in the calendar ---------- */
function evRow(it,ds){
  const key=`${it.src}:${it.id}:${ds}`;
  return `<button class="wi k-${it.kind||"work"} ${timing(it,ds)} ${S.flash===it.id?"grow":""}" data-open="${key}"><span class="tm">${it.start}–${it.end}</span>${ic(itemIcon(it,it.kind||"work"),"ki")}<span class="tt">${esc(it.title)}${it.location?`<small class="wloc">${ic("pin")}${esc(it.location)}</small>`:""}</span></button>`;
}
function taskItem(t,dl,ds){
  const key=`tasks:${t.id}`;
  if(dl)return `<button class="wi dl" data-open="${key}"><span class="tm"></span>${ic(itemIcon(t,"flag"),"ki")}<span class="tt ${t.done?"strike":""}">${esc(t.title)}<span class="sub">${t.deadline===ds?"Deadline":"Prep for this day"}${t.date&&t.date!==ds?" · planned "+relDay(t.date):""}</span></span></button>`;
  return `<button class="wi" data-open="${key}" aria-label="${t.priority==="top"?"Priority":"Task"}: ${esc(t.title)}"><span class="tm"></span>${ic(itemIcon(t,t.priority==="top"?"star":"task"),"ki")}<span class="tt ${t.done?"strike":""}">${esc(t.title)}${dateLine(t,ds)}</span></button>`;
}
function dayList(ds,its,tasks,dl){
  const one=its.filter(i=>i.src!=="routines"),rt=its.filter(i=>i.src==="routines");
  let h=one.map(it=>evRow(it,ds)).join("")+(tasks||[]).map(t=>taskItem(t,false,ds)).join("")+(dl||[]).map(t=>taskItem(t,true,ds)).join("")+billsDue(ds).map(billRow).join("");
  if(rt.length)h+=`<div class="rstrip">${rt.map(it=>`<button class="rchip k-${it.kind||"work"} ${timing(it,ds)}" data-open="routines:${it.id}:${ds}">${ic(itemIcon(it,"repeat"))}<span>${it.start}</span>${esc(it.title)}</button>`).join("")}</div>`;
  return h||`<div class="wi none">Nothing planned</div>`;
}

/* ---------- weather (shown beside the date) ---------- */
const WX={0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",48:"Fog",51:"Light drizzle",53:"Drizzle",55:"Heavy drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",66:"Freezing rain",67:"Freezing rain",71:"Light snow",73:"Snow",75:"Heavy snow",80:"Showers",81:"Showers",82:"Heavy showers",95:"Thunderstorms",96:"Thunderstorms",99:"Thunderstorms"};
S.wx=store.get("wx",null);
async function loadWeather(force){
  if(S.wx&&!S.wx.err&&!force&&Date.now()-S.wx.at<15*60000)return;
  if(!force&&loadWeather.failedAt&&Date.now()-loadWeather.failedAt<5*60000)return;
  if(loadWeather.busy)return;loadWeather.busy=true;
  /* her phone's location when she has allowed it, otherwise home in Durbanville */
  let lat=-33.8325,lon=18.6474,place="Durbanville";
  try{const ps=navigator.permissions&&await navigator.permissions.query({name:"geolocation"});
    if(ps&&ps.state==="granted"){const pos=await new Promise((ok,no)=>navigator.geolocation.getCurrentPosition(ok,no,{maximumAge:30*60000,timeout:4000}));
      lat=+pos.coords.latitude.toFixed(3);lon=+pos.coords.longitude.toFixed(3);const far=Math.hypot(lat+33.8325,(lon-18.6474)*.83)*111;place=far<6?"Durbanville":"Where you are"}}catch(_){}
  try{const r=await fetch("https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+"&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Africa%2FJohannesburg&forecast_days=1");
    if(!r.ok)throw 0;const j=await r.json();
    S.wx={at:Date.now(),t:Math.round(j.current.temperature_2m),code:j.current.weather_code,wind:Math.round(j.current.wind_speed_10m),hi:Math.round(j.daily.temperature_2m_max[0]),lo:Math.round(j.daily.temperature_2m_min[0]),rain:j.daily.precipitation_probability_max[0],place};store.set("wx",S.wx);
    loadWeather.failedAt=0;
  }catch(_){loadWeather.failedAt=Date.now();if(!S.wx)S.wx={at:Date.now(),err:1}}
  loadWeather.busy=false;
  if(S.view==="home")renderHeader();
}
/* the day's plan counts as done once its tasks are ticked off and its last block has ended */
function todayDone(ds){
  const m=nowMin(),tk=S.tasks.filter(t=>t.date===ds),its=allItemsFor(ds);
  const tasksDone=tk.every(t=>t.done),open=its.filter(i=>!itemDone(i,ds)),last=open.length?Math.max(...open.map(i=>toMin(i.end))):0;
  return tasksDone&&last<=m&&(tk.length||its.length||m>=toMin(S.work.end));
}
/* blocks keep done and notes on the block; a routine keeps them per day (doneOn, dayNotes) */
function itemDone(it,ds){if(it.src==="routines"){const r=S.routines.find(x=>x.id===it.id);return!!r&&(r.doneOn||[]).includes(ds)}if(it.taskId){const t=S.tasks.find(x=>x.id===it.taskId);if(t)return!!t.done}return!!it.done}
function itemNote(it,ds){if(it.src==="routines"){const r=S.routines.find(x=>x.id===it.id);return r?.dayNotes?.[ds]||""}return it.notes||""}
function setItemDone(key){const r=resolve(key);if(!r)return;const{col,rec,date}=r;
  if(col==="routines"){const cut=ymd(addDays(new Date(),-30)),on=(rec.doneOn||[]).filter(d=>d>=cut),has=on.includes(date);save("routines",rec.id,{...rec,doneOn:has?on.filter(d=>d!==date):[...on,date]});return!has}
  if(col==="blocks"&&rec.taskId){const t=S.tasks.find(x=>x.id===rec.taskId);if(t){toggleTask(t);return!t.done}}
  save("blocks",rec.id,{...rec,done:!rec.done});return!rec.done}
function setItemNote(key,txt){const r=resolve(key);if(!r)return;const{col,rec,date}=r;
  if(col==="routines"){const dn={...(rec.dayNotes||{})};if(txt)dn[date]=txt;else delete dn[date];const cut=ymd(addDays(new Date(),-30));Object.keys(dn).forEach(d=>{if(d<cut)delete dn[d]});save("routines",rec.id,{...rec,dayNotes:dn});return}
  const nr={...rec};if(txt)nr.notes=txt;else delete nr.notes;save(col,rec.id,nr)}
function alertsStale(){if(!S.devices)return false;return !S.lastCheck||Date.now()-S.lastCheck>45*60000}
function lastCheckTxt(){if(!S.lastCheck)return "No alert check has run yet.";const d=new Date(S.lastCheck),same=ymd(d)===todayStr();return `Last alert check: ${hm(d.getHours()*60+d.getMinutes())}${same?" today":", "+fmt(d,{weekday:"short",day:1,month:"short"})}`}

/* ---------- Home: the one place everything starts ---------- */
/* the selected day: what you picked today, otherwise today (or tomorrow once today's plan is done) */
function homeSel(){const td=todayStr(),st=store.get("sel",null);if(st&&st.on===td&&st.d)return st.d;return todayDone(td)?ymd(addDays(fromYmd(td),1)):td}
const selAuto=()=>{const st=store.get("sel",null);return!(st&&st.on===todayStr())&&homeSel()!==todayStr()};
function setSel(ds){store.set("sel",{on:todayStr(),d:ds})}
S.grp=store.get("grp",{day:true});S.grpAll={};
const grpSet=(k,v)=>{S.grp[k]=v;store.set("grp",S.grp)};

function renderHome(){
  const ds=homeSel();
  $("#view").innerHTML=`<div class="homev">${homeTopHtml()}${quickAddHtml()}${wrapUpHtml()}${doNowHtml()}${homeMonthHtml(ds)}${billsHomeHtml()}${agendaHtml(ds)}${workListHtml(ds)}${hubBlocksHtml()}${attentionHtml(ds)}${prioritiesHtml(ds)}${otherTasksHtml(ds)}${comingUpHtml(ds)}</div>`;
  loadWeather();
}

/* 2. quick add: type and go; details can wait */
function homeTopHtml(){const n=shopOpen();
  return `<div class="htop"><p class="hgreet">${greet(new Date().getHours())}, Cat</p><button type="button" class="shopbtn" data-shop aria-label="Shopping list${n?`, ${n} shop${n>1?"s":""} with items`:", empty"}">${ic("cart")}<span>Shopping list</span>${n?`<i class="badge">${n}</i>`:""}</button></div>`}
function quickAddHtml(){
  const v=S.qa||"";
  return `<section class="qadd-w"><div class="addrow"><button type="button" class="madd" data-manualadd aria-label="Add with all the details">${ic("plus")}</button><form class="qadd" id="qadd" autocomplete="off"><input id="qaIn" value="${esc(v)}" placeholder="Quick add: just type it, I'll sort it" aria-label="Quick add: type a task, event or thought" enterkeyhint="send"><button type="submit" class="qgo" aria-label="Send to the planner assistant">${ic("send")}</button></form></div>
  <div class="qopts" id="qopts" ${v.trim()?"":"hidden"} role="group" aria-label="How to add it"><span class="qhint">${ic("sparkle")}Gemini plans it when you press send</span><button type="button" data-qadd="inbox">${ic("task")}Just add to Inbox</button><button type="button" data-qadd="bill">${ic("money")}It's a bill</button><button type="button" data-qadd="form">${ic("pen")}Add details myself</button></div></section>`;
}
function quickInbox(t){const id=uid();save("tasks",id,{title:t,date:null,priority:"normal",mins:null,done:false,inbox:true,createdAt:Date.now()});S.qa="";render();toast("Added to Inbox",()=>remove("tasks",id));setTimeout(()=>{const n=$("#qaIn");if(n)n.focus({preventScroll:true})},30)}

/* 3. the full month on Home: every day in front of you, tap one to plan it below */
function homeMonthHtml(ds){
  const sel=fromYmd(ds),first=new Date(sel.getFullYear(),sel.getMonth(),1),start=monday(first),td=todayStr();
  let rows="";
  for(let w=0;w<6;w++){const m=addDays(start,w*7);if(w>0&&m.getMonth()!==first.getMonth())break;
    rows+=`<div class="hmrow">`;
    for(let i=0;i<7;i++){const d=addDays(m,i),x=ymd(d),inM=d.getMonth()===first.getMonth(),ev=itemsFor(x).filter(y=>y.src!=="routines"),tk=tasksDue(x).filter(t=>!t.done),dl=deadlinesFor(x).filter(t=>!t.done),hol=ev.find(y=>/^Public holiday/i.test(y.title));
      const bars=[...ev.filter(y=>y!==hol).map(y=>`<i class="k-${y.kind||"work"}"></i>`),...dl.map(()=>`<i class="bdl"></i>`),...tk.map(()=>`<i class="btk"></i>`),...billsDue(ds).filter(b=>!b.paid).map(()=>`<i class="btk"></i>`)];
      const mins={};ev.forEach(y=>{const k=y.kind||"work";mins[k]=(mins[k]||0)+toMin(y.end)-toMin(y.start)});const top=Object.entries(mins).sort((a,b)=>b[1]-a[1])[0];
      const nev=ev.length,ntk=tk.length+dl.length,lab=`${longD(x)}${x===td?", today":""}${nev||ntk?`: ${nev?nev+" event"+(nev>1?"s":""):""}${nev&&ntk?", ":""}${ntk?ntk+" task"+(ntk>1?"s":""):""}`:": nothing planned"}`;
      rows+=`<button type="button" class="mday ${inM?"":"out"} ${i>4?"we":""} ${x===td?"today":""} ${x===ds?"sel":""} ${hol?"hol":""} ${top?"k-"+top[0]:""}" data-sel="${x}" aria-pressed="${x===ds}" aria-label="${esc(lab)}"><span class="fill" style="height:${bookedPct(x)}%"></span><span class="num">${d.getDate()}</span><span class="bars">${bars.slice(0,4).join("")}</span>${bars.length>4?`<span class="bmore">+${bars.length-4}</span>`:""}</button>`}
    rows+=`</div>`}
  const yr=sel.getFullYear()!==new Date().getFullYear()?" "+sel.getFullYear():"";
  return `<section class="wstrip hmonth" aria-label="Choose a day"><div class="wsh"><button type="button" class="wsnav" data-selmonth="-1" aria-label="Previous month">${ic("left")}</button><button type="button" class="mlink" data-opencal="month" aria-label="Open the ${MONL[sel.getMonth()]} calendar full screen">${MONL[sel.getMonth()]}${yr}${ic("right")}</button><span class="sp"></span>${ds!==td?`<button type="button" class="tdbtn" data-sel="${td}" aria-label="Back to today">Today</button>`:""}<button type="button" class="wsnav" data-selmonth="1" aria-label="Next month">${ic("right")}</button></div><div class="mgrid"><div class="mhead">${DAYN.map((d,i)=>`<span class="${i>4?"we":""}">${d.slice(0,2)}</span>`).join("")}</div><div class="mdays">${rows}</div><div class="mleg" aria-hidden="true">${Object.entries(KINDS).map(([k,v])=>`<span class="k-${k}"><i></i>${v}</span>`).join("")}<span><i class="btk"></i>Task</span><span><i class="bdl"></i>Deadline</span><span><i class="fl"></i>How booked</span></div></div>${selAuto()?`<p class="wsnote">${ic("tick")}Today's plan is done, so tomorrow is showing.</p>`:""}</section>`;
}
/* compact week strip (no longer on Home) */
function weekStripHtml(ds){
  const sel=fromYmd(ds),m=monday(sel),td=todayStr();
  const days=[0,1,2,3,4,5,6].map(i=>{const d=addDays(m,i),x=ymd(d),ev=S.blocks.filter(b=>b.date===x),tk=S.tasks.filter(t=>t.date===x&&!t.done).length;
    const dots=[...new Set(ev.map(b=>b.kind||"work"))].slice(0,3).map(k=>`<i class="k-${k}"></i>`).join("")+(tk?`<i class="tk"></i>`:"");
    const lab=`${longD(x)}${x===td?", today":""}${ev.length||tk?`: ${ev.length?ev.length+" event"+(ev.length>1?"s":""):""}${ev.length&&tk?", ":""}${tk?tk+" task"+(tk>1?"s":""):""}`:": nothing planned"}`;
    return `<button type="button" class="wsd ${x===ds?"on":""} ${x===td?"td":""} ${i>4?"we":""}" data-sel="${x}" aria-pressed="${x===ds}" aria-label="${esc(lab)}"><small>${DAYN[i]}</small><b>${d.getDate()}</b><span class="dots" aria-hidden="true">${dots}</span></button>`}).join("");
  const yr=sel.getFullYear()!==new Date().getFullYear()?" "+sel.getFullYear():"";
  return `<section class="wstrip" aria-label="Choose a day"><div class="wsh"><button type="button" class="wsnav" data-selweek="-1" aria-label="Previous week">${ic("left")}</button><button type="button" class="mlink" data-opencal="month" aria-label="Open the ${MONL[sel.getMonth()]} calendar">${MONL[sel.getMonth()]}${yr}${ic("right")}</button><span class="sp"></span>${ds!==td?`<button type="button" class="tdbtn" data-sel="${td}" aria-label="Back to today">Today</button>`:""}<button type="button" class="wsnav" data-selweek="1" aria-label="Next week">${ic("right")}</button></div><div class="wsd7">${days}</div>${selAuto()?`<p class="wsnote">${ic("tick")}Today's plan is done, so tomorrow is showing.</p>`:""}</section>`;
}

/* 4. needs attention: one card per task, most urgent first */
function attentionItems(ds){
  const td=todayStr(),tm=ymd(addDays(fromYmd(td),1)),tops=new Set(topFor(ds).map(t=>t.id)),out=[];
  S.tasks.forEach(t=>{if(t.done||tops.has(t.id)||isShop(t))return;
    let pill=null;
    if(t.deadline&&t.deadline<td)pill=["red","Overdue",0];
    else if(t.deadline===td)pill=["amber","Due today",1];
    else if(t.for&&t.for>=td&&daysBetween(td,t.for)<=2)pill=t.date&&t.date<=td?["amber","Do today",2]:["","Before "+relDay(t.for),3];
    else if(t.deadline===tm)pill=["","Due tomorrow",4];
    if(pill)out.push({t,pill});
  });
  return out.sort((a,b)=>a.pill[2]-b.pill[2]);
}
function attentionHtml(ds){
  const items=attentionItems(ds),stale=alertsStale();
  if(!items.length&&!stale)return"";
  const show=S.attAll?items:items.slice(0,3);
  let h=`<section class="sec att-w" aria-labelledby="attH"><h2 id="attH" class="vh">Needs attention</h2>`;
  h+=show.map(({t,pill})=>`<div class="att ${pill[0]?"att-"+pill[0]:""}">${ic("alert","ai")}<button type="button" class="amain" data-open="tasks:${t.id}"><span class="ah">Needs attention</span><b>${esc(t.title)}</b>${dateLine(t,todayStr())}</button><span class="pill ${pill[0]}">${esc(pill[1])}</span></div>`).join("");
  if(items.length>3)h+=`<button type="button" class="tlink" data-attall>${S.attAll?"Show fewer":`Show ${items.length-3} more`}</button>`;
  if(stale)h+=`<button type="button" class="att att-amber" data-settings>${ic("bell","ai")}<span class="amain"><span class="ah">Needs attention</span><b>Phone alerts have stopped</b><span class="dline">${esc(lastCheckTxt())}</span></span><span class="pill amber">Check</span></button>`;
  return h+`</section>`;
}

/* 5. priorities: up to 3, chosen for the selected day */
function prioritiesHtml(ds){
  const top=topFor(ds),d=top.filter(t=>t.done).length;
  let h=`<section class="sec"><div class="sech"><h2>${ic("focus")}Your priorities</h2>${top.length?`<span class="cnt ${d===top.length?"all":""}">${d} of ${top.length} complete</span>`:""}</div>`;
  if(!top.length)return h+`<button type="button" class="addline" data-pickpri="${ds}">${ic("plus")}Choose up to 3 priorities for ${esc(dayWord(ds))}</button></section>`;
  h+=`<div class="card list">${top.map(t=>{const ns=!t.done&&nextStep(t);return `<div class="trow ${t.done?"done":""}">${chk(t.id,t.done)}<button type="button" class="tmain" data-open="tasks:${t.id}"><b>${esc(t.title)}</b>${ns?`<span class="dline">Next: ${esc(ns.text)}</span>`:""}${dateLine(t,ds)}</button></div>`}).join("")}</div>`;
  if(top.length<3)h+=`<button type="button" class="tlink" data-pickpri="${ds}">Choose another priority${ic("right")}</button>`;
  return h+`</section>`;
}

/* 6. your day: appointments, routines, scheduled tasks and useful free gaps, in order */
function availText(ds){
  const td=todayStr();if(ds<td)return"";if(!isWorkday(fromYmd(ds)))return"Day off, no work hours";
  const free=gaps(ds,1).reduce((a,[x,y])=>a+y-x,0);
  if(ds===td){if(nowMin()>=toMin(S.work.end))return"Work hours are over for today";return free?`${inFmt(free)} free in the rest of today's work hours`:"No free time left in today's work hours"}
  return free?`${inFmt(free)} free in work hours`:"Work hours fully booked";
}
function agRow(it,ds,cls){
  const key=`${it.src}:${it.id}:${ds}`,done=itemDone(it,ds),nm=nowMin(),cur=ds===todayStr()&&toMin(it.start)<=nm&&toMin(it.end)>nm&&!done;
  const sub=[`${it.start}–${it.end}`,cur?`now, ${inFmt(toMin(it.end)-nm)} left`:"",it.src==="routines"?"repeats":"",it.taskId?"task":"",it.location?esc(it.location):""].filter(Boolean).join(" · ");
  const past=cls==="past";
  return `<div class="ag k-${it.kind||"work"} ${cls||""} ${done?"done":""} ${cur?"cur":""}"><span class="at">${it.start}</span><button type="button" class="am" data-open="${key}"><i class="kd" aria-hidden="true"></i><span class="tt"><b>${esc(it.title)}${past?`<span class="pastl">past</span>`:""}</b><small>${sub}</small>${(it.steps||[]).length&&!it.taskId?`<span class="esteps">${it.steps.map(x=>`<span>${esc(x.text)}</span>`).join("")}</span>`:""}</span></button>${it.taskId?`<button type="button" class="check" data-hdone="${key}" aria-pressed="${done}" aria-label="${done?"Mark not done":"Mark done"}: ${esc(it.title)}"><i>${ic("tick")}</i></button>`:""}</div>`;
}
function gapRow(ds,a,b){return `<div class="ag free"><span class="at">${hm(a)}</span><span class="gt">Free until ${hm(b)} <small>· ${inFmt(b-a)}</small></span><button type="button" class="tlink" data-fill="${ds}|${a}|${b}" aria-label="Add a task from ${hm(a)} to ${hm(b)}">Add a task${ic("right")}</button></div>`}
/* My day: start of day, before work, the work day band, after work, end of day; nothing folds away */
function nextWorkday(ds){let d=fromYmd(ds);for(let i=0;i<7;i++){d=addDays(d,1);if(isWorkday(d))return d}return d}
function agendaHtml(ds){
  const td=todayStr(),isT=ds===td,nm=nowMin(),its=allItemsFor(ds),work=isWorkday(fromYmd(ds));
  const ws=toMin(S.work.start),we=toMin(S.work.end);
  const ss=ds>=td?sessions(ds).filter(se=>se.windows.length||se.tasks.length):[],gs=work&&ds>=td?looseGaps(ds,30):[];
  const pastAt=e=>ds<td||(isT&&e<=nm);
  const rows=[];
  its.forEach(it=>rows.push({s:toMin(it.start),o:2,e:toMin(it.end),html:agRow(it,ds,pastAt(toMin(it.end))?"past":"")}));
  gs.forEach(([a,b])=>rows.push({s:a,o:2,e:b,html:gapRow(ds,a,b)}));
  ss.forEach(se=>{const w=se.windows.length?se.windows:[[toMin(se.start),toMin(se.end)]];
    const live=w.find(([,y])=>!pastAt(y)),head=live||w[w.length-1];
    w.forEach(x=>rows.push({s:x[0],o:2,e:x[1],html:sesRow(ds,se,x,pastAt(x[1]))}))});
  const firstS=rows.length?Math.min(...rows.map(r=>r.s)):ws,lastE=rows.length?Math.max(...rows.map(r=>r.e)):we;
  const morning=S.morning?toMin(S.morning):null;
  const dayStart=Math.min(firstS,morning??(work?ws:firstS)),dayEnd=Math.max(lastE,work?we:lastE);
  const mk=(t,label,note,cls)=>`<div class="mk ${cls||""}"><span class="at">${hm(t)}</span><span class="ml">${label}</span>${note?`<em>${note}</em>`:""}</div>`;
  const none=t=>`<div class="ag none"><span class="at"></span><span class="nt">${t}</span></div>`;
  const marks=[{s:dayStart,o:0,html:mk(dayStart,"Start of day",morning!==null&&dayStart===morning?"morning plan":"")}];
  if(work){
    if(!rows.some(r=>r.s<ws))marks.push({s:dayStart,o:1,html:none("Nothing before work")});
    marks.push({s:ws,o:1,html:mk(ws,"Work day starts","","work"),band:"open"});
    const nw=nextWorkday(ds);
    marks.push({s:we,o:1,html:mk(we,"Work day ends",`rest moves to ${DAYN[wd(nw)-1]}`,"work"),band:"close"});
    if(!rows.some(r=>r.s>=we))marks.push({s:we,o:3,html:none(isT&&nm>=we?"Nothing else this evening":"Nothing after work")});
  }else if(!rows.length)marks.push({s:dayStart,o:1,html:none("Nothing planned. Day off.")});
  marks.push({s:dayEnd+1,o:9,html:mk(dayEnd,"End of day","")});
  const all=[...rows,...marks].sort((a,b)=>a.s-b.s||a.o-b.o);
  let body="",inBand=false,nowShown=!isT;
  all.forEach(r=>{
    if(!nowShown&&r.s>nm){body+=`<div class="ag nowm" aria-label="Now, ${hm(nm)}"><span class="at">${hm(nm)}</span><span class="nl">Now</span></div>`;nowShown=true}
    if(r.band==="open"){body+=`<div class="band">`+r.html;inBand=true;return}
    if(r.band==="close"){body+=r.html+`</div>`;inBand=false;return}
    body+=r.html});
  if(inBand)body+=`</div>`;
  if(!nowShown)body+=`<div class="ag nowm" aria-label="Now, ${hm(nm)}"><span class="at">${hm(nm)}</span><span class="nl">Now</span></div>`;
  const av=availText(ds);
  return `<section class="sec myday"><div class="sech"><h2>${ic("cal")}My day</h2><button type="button" class="tlink" data-expand="${ds}">Timeline${ic("right")}</button></div>${av?`<p class="avail">${esc(av)}</p>`:""}<div class="card agenda">${body}</div></section>`;
}

/* 7. other tasks: the day's tasks without a time, Inbox, Unscheduled, routines, done */
function trow(t,ctx){const st=t.steps||[],meta=[t.size?SIZEL[t.size]:"",t.mins?inFmt(t.mins):"",st.length?`${st.filter(x=>x.done).length} of ${st.length} steps`:""].filter(Boolean).join(" · ");
  return `<div class="trow ${t.done?"done":""} ${S.flash===t.id?"grow":""}">${chk(t.id,t.done)}<button type="button" class="tmain" data-open="tasks:${t.id}"><b>${esc(t.title)}</b>${dateLine(t,ctx)}${meta?`<span class="dline">${meta}</span>`:""}</button></div>`}
function otherGroups(ds){
  const td=todayStr(),tops=new Set(topFor(ds).map(t=>t.id)),att=new Set(attentionItems(ds).map(a=>a.t.id));
  const timed=new Set(S.blocks.filter(b=>b.taskId&&b.date===ds).map(b=>b.taskId));
  const open=S.tasks.filter(t=>!t.done&&!tops.has(t.id)&&!isShop(t));
  const inSes=new Set(ds>=td?sessions(ds).flatMap(se=>se.tasks.map(t=>t.id)):[]);
  const day=open.filter(t=>(t.date===ds||(ds===td&&carried(t)))&&!att.has(t.id)&&!timed.has(t.id)&&!inSes.has(t.id)).sort((a,b)=>(carried(b)?1:0)-(carried(a)?1:0));
  const dayDone=S.tasks.filter(t=>t.done&&t.date===ds&&!tops.has(t.id)&&!inSes.has(t.id));
  const inbox=open.filter(t=>!t.date&&t.inbox!==false).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  const uns=open.filter(t=>!t.date&&t.inbox===false);
  const done=S.tasks.filter(t=>t.done&&t.date!==ds&&!isShop(t));
  return [
    {k:"day",name:"Planned for "+dayWord(ds),n:day.length,rows:[...day.map(t=>trow(t,ds)),...dayDone.map(t=>trow(t,ds))],hide:!day.length&&!dayDone.length},
    {k:"inbox",name:"Inbox",n:inbox.length,rows:inbox.map(t=>trow(t,ds)),hide:!inbox.length},
    {k:"uns",name:"Unscheduled",n:uns.length,rows:uns.map(t=>trow(t,ds)),hide:!uns.length},
    {k:"routines",name:"Weekly routines",n:S.routines.length,rows:routineRows(),hide:!S.routines.length},
    {k:"done",name:"Done",n:done.length,rows:done.map(t=>trow(t,ds)),hide:!done.length},
  ];
}
function otherTasksHtml(ds){
  const gs=otherGroups(ds),total=gs.filter(g=>["day","inbox","uns"].includes(g.k)).reduce((a,g)=>a+g.n,0);
  let h=`<section class="sec"><div class="sech"><h2>${ic("list")}Other tasks</h2>${total?`<span class="badge" aria-label="${total} open">${total}</span>`:""}</div>`;
  const vis=gs.filter(g=>!g.hide);
  if(!vis.length)return h+`<p class="avail">No other tasks. Anything you add above lands in your Inbox.</p></section>`;
  h+=`<div class="card grps">`+vis.map(g=>{const open=!!S.grp[g.k],all=S.grpAll[g.k],lim=4,rows=open?(all?g.rows:g.rows.slice(0,lim)):[];
    return `<div class="grp"><button type="button" class="gh" data-grp="${g.k}" aria-expanded="${open}"><span>${esc(g.name)}</span><span class="gn">${g.n}</span>${ic(open?"down":"right")}</button>${open?`<div class="gl">${rows.join("")}${g.rows.length>lim?`<button type="button" class="tlink" data-grpall="${g.k}">${all?"Show fewer":`Show all ${g.rows.length}`}</button>`:""}</div>`:""}</div>`}).join("")+`</div>`;
  return h+`</section>`;
}
function routineRows(){return [...S.routines].sort((a,b)=>toMin(a.start)-toMin(b.start)).map(r=>`<button type="button" class="crow k-${r.kind||"work"}" data-open="routines:${r.id}"><span class="cd">${r.start}</span><span class="tt"><b>${esc(r.title)}</b><small>${dayLabel(r.days)}${r.until?(r.until<todayStr()?" · ended":" · until "+fmt(fromYmd(r.until),{day:1,month:"short"})):""}</small></span></button>`)}

/* 8. coming up: one-off events and tasks planned after today */
function comingItems(ds){
  const td=todayStr(),tops=new Set(topFor(ds).map(t=>t.id)),out=[];
  for(let i=1;i<=60;i++){const d=ymd(addDays(fromYmd(td),i));if(d===ds)continue;S.blocks.filter(b=>b.date===d&&!b.taskId).forEach(b=>out.push({d,s:b.start,b}))}
  S.tasks.filter(t=>!t.done&&!tops.has(t.id)&&!isShop(t)).forEach(t=>{const d=t.date||(t.deadline&&!t.date?t.deadline:null);if(d&&d>td&&d!==ds)out.push({d,s:"99",t})});
  return out.sort((a,b)=>(a.d+a.s).localeCompare(b.d+b.s));
}
function comingUpHtml(ds){
  const items=comingItems(ds);if(!items.length)return"";
  const n=S.comingAll?Math.min(items.length,15):4,show=items.slice(0,n);
  const cd=d=>{const k=daysBetween(todayStr(),d);return k===1?"Tomorrow":k<7?DAYN[wd(fromYmd(d))-1]+" "+fromYmd(d).getDate():fmt(fromYmd(d),{day:1,month:"short"})};
  let h=`<section class="sec"><div class="sech"><h2>${ic("flag")}Coming up</h2><button type="button" class="tlink" data-opencal="month">Calendar${ic("right")}</button></div><div class="card list">`;
  h+=show.map(x=>x.b?`<button type="button" class="crow k-${x.b.kind||"work"}" data-open="blocks:${x.b.id}:${x.d}"><span class="cd">${cd(x.d)}</span><span class="tt"><b>${esc(x.b.title)}</b><small>${x.b.start}–${x.b.end}${x.b.location?" · "+esc(x.b.location):""}</small></span></button>`
    :`<button type="button" class="crow task" data-open="tasks:${x.t.id}"><span class="cd">${cd(x.d)}</span><span class="tt"><b>${esc(x.t.title)}</b>${dateLine(x.t,x.d)}</span></button>`).join("");
  h+=`</div>`;
  if(items.length>4)h+=`<button type="button" class="tlink" data-comingall>${S.comingAll?"Show fewer":`Show ${Math.min(items.length,15)-4} more`}</button>`;
  return h+`</section>`;
}

/* ---------- pickers: choose a priority, fill a free gap, schedule a task ---------- */
function pickRow(t,attr,meta){return `<button type="button" class="crow task" ${attr}><span class="tt"><b>${esc(t.title)}</b>${meta||dateLine(t,null)}</span>${ic("plus","pk")}</button>`}
function pickPriority(ds){
  const td=todayStr(),tops=new Set(topFor(ds).map(t=>t.id)),open=S.tasks.filter(t=>!t.done&&!tops.has(t.id));
  const day=open.filter(t=>t.date===ds||carried(t)),inbox=open.filter(t=>!t.date),later=open.filter(t=>t.date&&t.date>ds).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,10);
  const grp=(n,l)=>l.length?`<h4 class="ph">${n}</h4><div class="card list">${l.map(t=>pickRow(t,`data-mkpri="${t.id}"`)).join("")}</div>`:"";
  sheet("Choose a priority",`<div class="in"><h3>Choose a priority for ${esc(dayWord(ds))}</h3><p class="hint">${3-topFor(ds).length} of 3 places left. Choosing a task from another day moves it to ${esc(dayWord(ds))}.</p>
    <form class="quick" id="priNew"><input id="priIn" placeholder="New priority" autocomplete="off" aria-label="New priority"><button type="submit">Add</button></form>
    ${grp(ds===td?"Planned for today or moved":"Planned for "+dayWord(ds)+" or moved from earlier",day)}${grp("Inbox and unscheduled",inbox)}${grp("Later",later)}
    <div class="acts sticky"><button class="ghost" type="button" data-sheetx style="flex:1">Close</button></div></div>`);
  const mk=t=>{if(topFor(ds).length>=3){toast("That day already has 3 priorities.");return}const before=strip(t);save("tasks",t.id,{...before,priority:"top",date:ds,inbox:false});closeSheet();toast("Added to priorities",()=>save("tasks",t.id,before))};
  $("#sheetRoot").onclick=e=>{const b=e.target.closest("[data-mkpri]");if(b){const t=S.tasks.find(x=>x.id===b.dataset.mkpri);if(t)mk(t)}};
  $("#priNew").onsubmit=e=>{e.preventDefault();const v=$("#priIn").value.trim();if(!v)return;if(topFor(ds).length>=3){toast("That day already has 3 priorities.");return}const id=uid();save("tasks",id,{title:v,date:ds,priority:"top",mins:null,done:false,inbox:false,createdAt:Date.now()});closeSheet();toast("Priority added",()=>remove("tasks",id))};
}
function taskToBlock(t,ds,s,e){
  const id=uid(),before=strip(t);
  save("blocks",id,{title:t.title,date:ds,start:hm(s),end:hm(e),kind:t.kind||"admin",taskId:t.id,...(t.icon?{icon:t.icon}:{})});
  save("tasks",t.id,{...before,date:ds,inbox:false});
  return()=>{remove("blocks",id);save("tasks",t.id,before)};
}
function fillGap(ds,a,b){
  const td=todayStr(),open=S.tasks.filter(t=>!t.done&&!S.blocks.some(x=>x.taskId===t.id&&x.date>=td));
  const day=open.filter(t=>t.date===ds||(ds===td&&carried(t))).sort((x,y)=>(x.priority==="top"?0:1)-(y.priority==="top"?0:1)),loose=open.filter(t=>!t.date);
  const len=t=>Math.min(Math.max(t.mins||60,15),b-a);
  const grp=(n,l)=>l.length?`<h4 class="ph">${n}</h4><div class="card list">${l.map(t=>pickRow(t,`data-gapt="${t.id}"`,`<span class="dline">${hm(a)}–${hm(a+len(t))}${t.mins?"":" · 1 h unless you change it"}</span>`)).join("")}</div>`:"";
  sheet("Use free time",`<div class="in"><h3>Free ${hm(a)}–${hm(b)}, ${esc(dayWord(ds))}</h3><p class="hint">Pick a task to put in this gap, or add a new time block.</p>
    <button type="button" class="addline" id="gapNew">${ic("plus")}New time block at ${hm(a)}</button>
    ${grp("Planned for "+dayWord(ds),day)}${grp("Inbox and unscheduled",loose)}${!day.length&&!loose.length?`<p class="hint">No tasks are waiting for a time.</p>`:""}
    <div class="acts sticky"><button class="ghost" type="button" data-sheetx style="flex:1">Close</button></div></div>`);
  $("#gapNew").onclick=()=>openSheet("blocks",null,{date:ds,start:hm(a),end:hm(Math.min(a+60,b))});
  $("#sheetRoot").onclick=e=>{const x=e.target.closest("[data-gapt]");if(!x)return;const t=S.tasks.find(y=>y.id===x.dataset.gapt);if(!t)return;const undo=taskToBlock(t,ds,a,a+len(t));closeSheet();toast(`Scheduled ${hm(a)}–${hm(a+len(t))}`,undo)};
}
function scheduleSheet(t,day){
  const td=todayStr();day=day||(t.date&&t.date>=td?t.date:(homeSel()>=td?homeSel():td));
  const mins=Math.max(15,t.mins||60),bl=blockOf(t),days=[0,1,2,3,4,5,6].map(i=>ymd(addDays(fromYmd(td),i)));
  const work=isWorkday(fromYmd(day)),gs=work?gaps(day,Math.min(mins,30)):[];
  sheet("Schedule",`<div class="in"><h3>Schedule</h3><p class="hint sched-t">${esc(t.title)}${t.mins?` · about ${inFmt(t.mins)}`:""}</p>
    <div class="f"><span class="lb">Day</span><div class="opts" id="schDays">${days.map(d=>`<button type="button" data-schday="${d}" aria-pressed="${d===day}">${d===td?"Today":daysBetween(td,d)===1?"Tomorrow":DAYN[wd(fromYmd(d))-1]+" "+fromYmd(d).getDate()}</button>`).join("")}</div><input type="date" id="schDate" value="${day}" aria-label="Another day"></div>
    <div class="f"><span class="lb">Free times on ${esc(dayWord(day))}</span>${gs.length?`<div class="opts">${gs.map(([a,b])=>`<button type="button" data-schgap="${a}" data-schend="${Math.min(a+mins,b)}">${hm(a)}–${hm(Math.min(a+mins,b))}<small> · ${inFmt(b-a)} free</small></button>`).join("")}</div>`:`<p class="hint">${work?"No free time left in work hours.":"No work hours on this day."} Pick a time yourself below.</p>`}</div>
    <div class="card list"><button type="button" class="crow" id="schPick">${ic("clock","pk")}<span class="tt"><b>Pick a time yourself</b></span></button><button type="button" class="crow" id="schPlan">${ic("cal","pk")}<span class="tt"><b>Plan for ${esc(dayWord(day))}, no time</b></span></button>${t.date?`<button type="button" class="crow" id="schClear">${ic("x","pk")}<span class="tt"><b>Take it off ${esc(relDay(t.date))}</b><small>Moves it to Unscheduled</small></span></button>`:""}${bl?`<button type="button" class="crow" id="schUnblock">${ic("x","pk")}<span class="tt"><b>Remove the time block</b><small>${shortD(bl.date)} · ${bl.start}–${bl.end}</small></span></button>`:""}</div>
    <div class="acts sticky"><button class="ghost" type="button" data-sheetx style="flex:1">Cancel</button></div></div>`);
  const back=(msg,undo)=>{closeSheet();toast(msg,undo)};
  $("#schDays").onclick=e=>{const b=e.target.closest("[data-schday]");if(b)scheduleSheet(t,b.dataset.schday)};
  $("#schDate").onchange=e=>{if(e.target.value)scheduleSheet(t,e.target.value)};
  document.querySelectorAll("[data-schgap]").forEach(b=>b.onclick=()=>{const undo=taskToBlock(t,day,+b.dataset.schgap,+b.dataset.schend);back(`Scheduled ${shortD(day)} ${hm(+b.dataset.schgap)}`,undo)});
  $("#schPick").onclick=()=>{const g=gs[0];openSheet("blocks",null,{title:t.title,date:day,start:g?hm(g[0]):S.work.start,end:hm(Math.min((g?g[0]:toMin(S.work.start))+mins,23*60+45)),taskId:t.id,kind:taskKind(t),icon:t.icon})};
  $("#schPlan").onclick=()=>{const before=strip(t);save("tasks",t.id,{...before,date:day,inbox:false});back(`Planned for ${dayWord(day)}`,()=>save("tasks",t.id,before))};
  const cl=$("#schClear");if(cl)cl.onclick=()=>{const before=strip(t),n={...before,date:null,inbox:false};if(n.priority==="top")n.priority="normal";save("tasks",t.id,n);back("Moved to Unscheduled",()=>save("tasks",t.id,before))};
  const ub=$("#schUnblock");if(ub)ub.onclick=()=>{const before=strip(bl);remove("blocks",bl.id);back("Time block removed",()=>save("blocks",bl.id,before))};
}

/* ---------- calendar: context strip and layer chips ---------- */
function layersHtml(){
  const chips=[...Object.entries(KINDS).map(([k,v])=>`<button class="lc k-${k}" data-layer="${k}" aria-pressed="${!S.hide.has(k)}"><i></i>${v}</button>`),`<button class="lc" data-layer="repeats" aria-pressed="${!S.hide.has("repeats")}">${ic("repeat")}Repeats</button>`,`<button class="lc" data-layer="tasks" aria-pressed="${!S.hide.has("tasks")}"><i></i>Tasks</button>`];
  const n=new Date(),onNow=S.zoom==="day"?ymd(S.cur)===todayStr():S.zoom==="week"?ymd(monday(S.cur))===ymd(monday(n)):S.cur.getMonth()===n.getMonth()&&S.cur.getFullYear()===n.getFullYear();
  if(!onNow)chips.unshift(`<button class="lc today" data-today>${ic("cal")}${S.zoom==="day"?"Today":S.zoom==="week"?"This week":"This month"}</button>`);
  return `<div class="layers" role="group" aria-label="Show or hide">${chips.join("")}</div>`;
}
function topKind(ds){const mins={};S.blocks.filter(x=>x.date===ds).forEach(x=>{const k=x.kind||"work";mins[k]=(mins[k]||0)+toMin(x.end)-toMin(x.start)});const t=Object.entries(mins).sort((a,b)=>b[1]-a[1])[0];return t?t[0]:null}
function dayStrip(){
  const m=monday(S.cur),sel=ymd(S.cur),td=todayStr();
  return `<div class="strip" role="group" aria-label="Days this week">${[0,1,2,3,4,5,6].map(i=>{const d=addDays(m,i),ds=ymd(d),p=bookedPct(ds);const k=topKind(ds);return `<button class="sd ${ds===sel?"on":""} ${ds===td?"td":""} ${i>4?"we":""} ${k?"k-"+k:""}" data-pick="${ds}" aria-label="${longD(ds)}"><small>${DAYN[i].slice(0,2)}</small><b>${d.getDate()}</b><span class="ld"><span style="width:${p}%"></span></span></button>`}).join("")}</div>`;
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
  $("#view").innerHTML=dayStrip()+layersHtml()+`<div id="pane">${timelineHtml(ds,isWorkday(fromYmd(ds)))}${calDayTasks(ds)}</div>`;
  if(isToday&&!renderDay._scrolled){renderDay._scrolled=true;const el=document.querySelector(".tl .now");if(el){const top=el.getBoundingClientRect().top+scrollY-260;if(top>200)scrollTo({top})}}
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
  if(ds>=todayStr())sessions(ds).forEach(se=>se.windows.forEach(([a,b],i)=>{const n=se.tasks.filter(t=>!t.done).length;if(y(b)-y(a)<30)return;grid+=`<button class="gap ses-w k-${se.kind}" data-session="${sesKey(ds,se)}" style="top:${y(a)+3}px;height:${y(b)-y(a)-6}px" aria-label="${esc(se.title)} ${hm(a)} to ${hm(b)}, ${n} tasks. Open the session">${ic("list")}${esc(se.title)}${i?" continues":` · ${n} task${n===1?"":"s"}`}</button>`}));
  if(work&&ds>=todayStr())looseGaps(ds,30).forEach(([a,b])=>{grid+=`<button class="gap" data-slot="${hm(a)}" data-slotday="${ds}" style="top:${y(a)+3}px;height:${y(b)-y(a)-6}px" aria-label="${inFmt(b-a)} free from ${hm(a)}. Add a block">${ic("plus")}${inFmt(b-a)} free</button>`});
  items.forEach(it=>{if(!it.buffer)return;const bs=toMin(it.end),be=Math.min(bs+it.buffer,eH*60);if(be>bs)grid+=`<div class="buf" style="top:${y(bs)+1}px;height:${y(be)-y(bs)-2}px"><span>Buffer ${it.buffer} min</span></div>`});
  items.forEach(it=>{const s=Math.max(toMin(it.start),sH*60),e=Math.min(Math.max(toMin(it.end),s+1),eH*60);if(e<=s)return;
    const w=100/it._lanes,ht=y(e)-y(s)-2,short=ht<60,isR=it.src==="routines",key=`${it.src}:${it.id}:${ds}`,done=itemDone(it,ds),note=itemNote(it,ds),cur=isToday&&toMin(it.start)<=nm&&toMin(it.end)>nm&&!done;
    grid+=`<div class="blk k-${it.kind||"work"} ${isR?"rt":""} ${short?"short":""} ${done?"done":timing(it,ds)} ${cur?"cur":""} ${S.flash===it.id?"grow":""}" style="top:${y(s)+1}px;height:${ht}px;left:calc(${w*it._lane}% + 4px);width:calc(${w}% - 8px)"><button class="bm" data-dock="${key}"><b>${ic(itemIcon(it,isR?"repeat":(it.kind||"work")),"bi")}${esc(it.title)}</b><span class="tm">${it.start}${short?"":"–"+it.end}</span>${it.location&&ht>=60?`<span class="bloc">${ic("pin")}${esc(it.location)}</span>`:""}${note&&ht>=76?`<span class="bn">${ic("note")}${esc(note)}</span>`:""}</button><span class="ba"><button type="button" class="hbtn ${note?"has":""}" data-hnote="${key}" aria-label="${note?"Edit note":"Add a note"}">${ic("note")}</button>${it.taskId?`<button class="check" data-hdone="${key}" aria-pressed="${done}" aria-label="${done?"Mark not done":"Mark done"}"><i>${ic("tick")}</i></button>`:""}</span></div>`});
  if(isToday&&nm>=sH*60&&nm<=eH*60)grid+=`<div class="now" style="top:${y(nm)}px"></div>`;
  const fw=freeWork(ds);
  return `<section class="sec tls"><div class="sech"><h2>${ic("clock")}Timeline</h2><span class="cnt">${work?(fw?inFmt(fw)+" free in work day":"Work day fully booked"):"Day off"}</span></div><div class="tl" style="height:${height}px"><div class="rail">${rail}</div><div class="grid">${grid}</div></div></section>`;
}
/* tasks for the day in the full calendar: planned that day (plus moved ones today) and prep due */
function calDayTasks(ds){
  if(!tasksShown())return"";
  const isToday=ds===todayStr(),tk=S.tasks.filter(t=>t.date===ds||(isToday&&carried(t))).sort((a,b)=>a.done-b.done),dl=deadlinesFor(ds).filter(t=>!t.done);
  const bl=billsDue(ds);if(!tk.length&&!dl.length&&!bl.length)return"";
  return `<section class="sec"><div class="sech"><h2>${ic("task")}Tasks for ${esc(dayWord(ds))}</h2><span class="cnt">${tk.filter(t=>t.done).length} of ${tk.length} done</span></div><div class="card list">${tk.map(t=>trow(t,ds)).join("")}${dl.map(t=>taskItem(t,true,ds)).join("")}${bl.map(billRow).join("")}</div></section>`;
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
    const evn=its.filter(x=>x.src!=="routines").length,rtn=its.length-evn,nt=tk.length+dl.length,parts=[evn&&`${evn} event${evn>1?"s":""}`,rtn&&`${rtn} routine${rtn>1?"s":""}`,nt&&`${nt} task${nt>1?"s":""}`].filter(Boolean).join(" · ");
    h+=`<section class="wd mag ${ds===td?"today":""} ${ds===S.hl?"selday":""}" id="mag-${ds}"><button class="wh" data-zday="${ds}"><span class="dn ${topKind(ds)?"k-"+topKind(ds):""}">${d.getDate()}</span><span class="d">${DAYL[i]}<small>${ds===td?"Today":parts||"Nothing planned"}</small></span><span class="kd">${[...new Set(its.map(x=>x.kind||"work"))].map(k=>`<i class="k-${k}"></i>`).join("")}</span></button>${dayList(ds,its,tk,dl)}</section>`}
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
      const bars=[...ev.filter(x=>x!==hol).map(x=>`<i class="k-${x.kind||"work"}"></i>`),...dl.map(()=>`<i class="bdl"></i>`),...tk.map(()=>`<i class="btk"></i>`),...billsDue(ds).filter(b=>!b.paid).map(()=>`<i class="btk"></i>`)];
      const mins={};ev.forEach(x=>{const k=x.kind||"work";mins[k]=(mins[k]||0)+toMin(x.end)-toMin(x.start)});const top=Object.entries(mins).sort((a,b)=>b[1]-a[1])[0];
      h+=`<span class="mday ${inMonth(ds)?"":"out"} ${i>4?"we":""} ${ds===td?"today":""} ${hol?"hol":""} ${top?"k-"+top[0]:""}" data-zday-w="${ds}"><span class="fill" style="height:${bookedPct(ds)}%"></span><span class="num">${d.getDate()}</span><span class="bars">${bars.slice(0,4).join("")}</span>${bars.length>4?`<span class="bmore">+${bars.length-4}</span>`:""}</span>`}
    h+=`</div>`}
  h+=`</div><div class="mleg" aria-hidden="true">${Object.entries(KINDS).map(([k,v])=>`<span class="k-${k}"><i></i>${v}</span>`).join("")}<span><i class="btk"></i>Task</span><span><i class="bdl"></i>Deadline</span><span><i class="fl"></i>How booked</span></div></div>`;
  const now=new Date(),lastDay=new Date(first.getFullYear(),first.getMonth()+1,0).getDate(),fromDay=(first.getMonth()===now.getMonth()&&first.getFullYear()===now.getFullYear())?now.getDate():1;
  let list="";
  let listed=0;for(let dd=fromDay;dd<=lastDay&&listed<3;dd++){const d=new Date(first.getFullYear(),first.getMonth(),dd),ds=ymd(d),ev=itemsFor(ds).filter(x=>x.src!=="routines"),tk=tasksDue(ds).filter(t=>!t.done),dl=deadlinesFor(ds).filter(t=>!t.done);if(!ev.length&&!tk.length&&!dl.length)continue;listed++;
    list+=`<section class="wd ${ds===td?"today":""}"><button class="wh" data-zday="${ds}"><span class="d">${fmt(d,{weekday:"short",day:1,month:"short"})}</span><span class="c">${ds===td?"Today":""}</span></button>${dayList(ds,ev,tk,dl)}</section>`}
  h+=`<section class="sec"><div class="sech"><h2>${ic("list")}Next 3 planned days</h2></div>`+(list?`<div class="week">${list}</div>`:`<div class="empty">Nothing planned</div>`)+`</section></div>`;
  $("#view").innerHTML=h;
}

/* ---------- day names ---------- */
function dayLabel(days){days=[...(days||[])].sort();if(days.length===7)return"Every day";if(days.join()==="1,2,3,4,5")return"Weekdays";if(days.join()==="6,7")return"Weekends";return days.map(d=>DAYN[d-1]).join(", ")}

/* ---------- render: keeps your scroll position, no jumps ---------- */
function render(keepScroll=true){
  const y=scrollY;renderHeader();
  (S.view==="cal"?renderCal:S.view==="hub"?renderHub:renderHome)();
  if(keepScroll)scrollTo(0,y);
  if(S.dock)renderDock();
}
function animate(cls,origin){
  const v=(cls==="sl"||cls==="sr")&&$("#pane")||$("#view");v.classList.remove("zin","zout","sl","sr");void v.offsetWidth;
  if(origin){const r=v.getBoundingClientRect();v.style.setProperty("--ox",(origin.x-r.left)+"px");v.style.setProperty("--oy",(origin.y-r.top)+"px")}else{v.style.setProperty("--ox","50%");v.style.setProperty("--oy","0px")}
  v.classList.add(cls);v.addEventListener("animationend",()=>v.classList.remove(cls),{once:true});
}
function slide(update,dir,top=true){
  const keepTop=()=>{if(!top)return;const st=document.querySelector(".strip,.layers");if(!st)return;const hdr=$("header.top").offsetHeight,lim=Math.max(0,st.getBoundingClientRect().top+scrollY-hdr-8);if(scrollY>lim)scrollTo(0,lim)};
  if(document.startViewTransition&&!reduced()){document.documentElement.dataset.dir=dir;const t=document.startViewTransition(()=>{update();keepTop()});t.finished.finally(()=>delete document.documentElement.dataset.dir);return}
  update();keepTop();animate(dir==="next"?"sl":"sr");
}
function pickDay(ds){const dir=ds>ymd(S.cur)?"next":"prev";slide(()=>{S.cur=fromYmd(ds);S.dock=null;renderDock();renderDay._scrolled=true;setHash(calHash());render()},dir)}

/* ---------- navigation: Home is the base; the calendar opens over it and Back returns to the same spot ----------
   Device and browser back: the calendar and every panel or sheet get a history entry, so Back closes them in order. */
S.scroll=store.get("scroll",{});
const viewKey=()=>S.view==="cal"?"cal-"+S.zoom:S.view==="hub"?"hub":"home";
function rememberScroll(){S.scroll[viewKey()]=scrollY;store.set("scroll",S.scroll)}
const calHash=()=>`cal/${S.zoom}/${ymd(S.cur)}`;
function setHash(h){if(location.hash.slice(1)!==h)history.replaceState(history.state,"","#"+h)}
const sheetOpen=()=>!!$("#sheetRoot").innerHTML;
const overlayOpen=()=>sheetOpen()||!!S.dock;
function pushOverlay(){if(!S.ov){S.ov=true;history.pushState({ov:1},"",location.href)}}
/* drop the overlay's history entry once nothing is open (a sheet may hand over to another sheet or the panel) */
function release(){setTimeout(()=>{if(S.ov&&!overlayOpen()){S.ov=false;S.skipPop=true;history.back()}},80)}
function goCal(zoom,date,origin){
  const fromHome=S.view!=="cal";
  if(fromHome){rememberScroll();hideSheet();S.dock=null;S.returnDock=null;renderDock()}
  else{S.dock=null;renderDock()}
  const was=fromHome?null:LEVEL[S.zoom],to=LEVEL[zoom];
  S.view="cal";S.zoom=zoom;if(date)S.cur=typeof date==="string"?fromYmd(date):new Date(date);S.cur.setHours(0,0,0,0);
  if(zoom==="day")renderDay._scrolled=false;
  if(fromHome){if(S.ov){S.ov=false;history.replaceState({v:"cal"},"","#"+calHash())}else history.pushState({v:"cal"},"","#"+calHash());S.calPushed=true}
  else setHash(calHash());
  render(false);if(zoom!=="day"||ymd(S.cur)!==todayStr())scrollTo(0,0);
  if(was!==null&&was!==to)animate(to>was?"zin":"zout",origin);else animate("sl");
}
function showHome(){S.view="home";hideSheet();S.dock=null;renderDock();render(false);const y=S.scroll.home;scrollTo(0,y||0);animate("sr")}
function backToPlanner(){if(S.view==="hub"){history.back();return}if(S.calPushed){S.calPushed=false;history.back()}else{history.replaceState(null,"","#home");showHome()}}
function step(n){
  slide(()=>{if(S.zoom==="month")S.cur=new Date(S.cur.getFullYear(),S.cur.getMonth()+n,1);else S.cur=addDays(S.cur,S.zoom==="week"?7*n:n);
    S.dock=null;renderDock();renderDay._scrolled=true;setHash(calHash());render()},n>0?"next":"prev",false);
}
function zoomOut(){if(S.zoom==="day"){S.hl=ymd(S.cur);goCal("week")}else if(S.zoom==="week")goCal("month")}
function zoomIn(origin){
  if(S.zoom==="month"){const n=new Date(),same=S.cur.getMonth()===n.getMonth()&&S.cur.getFullYear()===n.getFullYear();goCal("week",monday(same?n:S.cur),origin)}
  else if(S.zoom==="week"){const m=monday(S.cur),t=todayStr();goCal("day",ymd(m)<=t&&t<=ymd(addDays(m,6))?t:ymd(m),origin)}
}
function route(first){
  const p=location.hash.slice(1).split("/");
  if(p[0]==="cal"){S.view="cal";S.zoom=LEVEL[p[1]]!==undefined?p[1]:"month";S.cur=p[2]&&/^\d{4}-\d\d-\d\d$/.test(p[2])?fromYmd(p[2]):new Date();S.cur.setHours(0,0,0,0);render(false);return}
  /* old Tasks and Routines links open Home with those groups showing */
  if(p[0]==="hub")history.replaceState(null,"","#home");
  if(p[0]==="tasks"){S.grp.inbox=S.grp.uns=true;history.replaceState(null,"","#home")}
  if(p[0]==="routines"){S.grp.routines=true;history.replaceState(null,"","#home")}
  if(first){S.view="home";render(false);return}
  showHome();
}
addEventListener("popstate",()=>{
  if(S.skipPop){S.skipPop=false;return}
  if(overlayOpen()){S.ov=false;hideSheet();S.returnDock=null;S.dock=null;renderDock()}
  S.ov=false;
  const wantHub=location.hash.slice(1).startsWith("hub");
  if(S.view==="hub"&&!wantHub){showHome();return}
  if(wantHub){if(S.view!=="hub"){if(S.hub){S.view="hub";render(false)}else history.replaceState(null,"","#home")}return}
  const wantCal=location.hash.slice(1).startsWith("cal");
  if(wantCal!==(S.view==="cal")){S.calPushed=false;if(wantCal)route();else showHome()}
});

/* ---------- search ---------- */
function openSearch(){
  sheet("Search",`<div class="in"><div class="sbox"><input id="sq" type="search" placeholder="Search tasks, events and routines" autocomplete="off" aria-label="Search"></div><div class="sres" id="sres"></div><div class="acts sticky"><button class="ghost" type="button" data-sheetx style="flex:1">Close</button></div></div>`);
  const q=$("#sq"),out=$("#sres");
  const mark=(t,w)=>esc(t).replace(new RegExp("("+esc(w).replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig"),"<mark>$1</mark>");
  const run=()=>{const w=q.value.trim();if(w.length<2){out.innerHTML=`<p class="hint">Type at least 2 letters.</p>`;return}const lw=w.toLowerCase(),hit=x=>(x.title||"").toLowerCase().includes(lw)||(x.notes||"").toLowerCase().includes(lw);
    const res=[...S.blocks.filter(hit).sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(b=>`<button class="wi k-${b.kind||"work"}" data-sgo="blocks:${b.id}:${b.date}">${ic(itemIcon(b,b.kind||"work"),"ki")}<span class="tt">${mark(b.title,w)}<span class="sub">${shortD(b.date)} · ${b.start}–${b.end}</span></span></button>`),
      ...S.routines.filter(hit).map(r=>`<button class="wi k-${r.kind||"work"}" data-sgo="routines:${r.id}">${ic(itemIcon(r,"repeat"),"ki")}<span class="tt">${mark(r.title,w)}<span class="sub">${dayLabel(r.days)} · ${r.start}–${r.end}</span></span></button>`),
      ...S.tasks.filter(hit).map(t=>`<button class="wi" data-sgo="tasks:${t.id}">${ic(itemIcon(t,t.priority==="top"?"star":"task"),"ki")}<span class="tt ${t.done?"strike":""}">${mark(t.title,w)}<span class="sub">${t.done?"Done":t.date?"Planned "+shortD(t.date):t.inbox===false?"Unscheduled":"Inbox"}</span></span></button>`)];
    out.innerHTML=res.length?res.join(""):`<p class="hint">Nothing matches "${esc(w)}".</p>`};
  q.oninput=run;run();setTimeout(()=>q.focus(),60);
  out.onclick=e=>{const b=e.target.closest("[data-sgo]");if(!b)return;const key=b.dataset.sgo,[col,,date]=key.split(":");
    hideSheet();
    if(col==="blocks"&&S.view==="home"){setSel(date);render()}
    openDock(key)};
}

/* ---------- sheets (edit, add, settings, search, pickers) ---------- */
function hideSheet(){$("#sheetRoot").innerHTML="";$("#sheetRoot").onclick=null;document.body.classList.remove("sheetopen")}
function closeSheet(){hideSheet();const back=S.returnDock;S.returnDock=null;if(back&&resolve(back)){S.dock=back;renderDock()}else release()}
function sheet(label,inner){
  if(S.dock){S.returnDock=S.returnDock||S.dock;S.dock=null;renderDock()}
  pushOverlay();
  const root=$("#sheetRoot");root.onclick=null;
  root.innerHTML=`<div class="scrim" id="scrim"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(label)}">${inner}</div>`;
  document.body.classList.add("sheetopen");
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
  const isNew=!rec;rec=rec||{};preset=preset||{};
  const noun={blocks:"time block",tasks:"task",routines:"routine"}[type];
  const kind=rec.kind||preset.kind||(type==="tasks"?"admin":"work"),icon=rec.icon||preset.icon||"";
  const kindOpts=`<div class="f"><span class="lb">Type</span>${optsHtml("fKind",Object.entries(KINDS),kind,"k")}</div>`;
  const iconOpts=`<div class="f"><span class="lb">Icon</span><div class="icp" id="fIcon"><button type="button" data-i="" aria-pressed="${!icon}" aria-label="Use the type's icon">Auto</button>${PICK.map(n=>`<button type="button" data-i="${n}" aria-pressed="${icon===n}" aria-label="${n}">${ic(n)}</button>`).join("")}</div></div>`;
  let main=`<div class="f"><label for="fTitle">What</label><input id="fTitle" value="${esc(rec.title||preset.title||"")}" placeholder="${type==="tasks"?"Send Virlocept proposal":type==="routines"?"School pickup":"Client call"}" autocomplete="off"></div>`;
  let more="",moreNote="",moreOpen=false;
  if(type==="blocks"){
    const st=rec.start||preset.start||"09:00",en=rec.end||preset.end||hm(Math.min(toMin(st)+60,23*60+45));
    main+=`<div class="f"><label for="fDate">Day</label><input id="fDate" type="date" value="${rec.date||preset.date||ymd(S.cur)}"></div><div class="two">${tp("fStart",st,"Start")}${tp("fEnd",en,"End")}</div><div class="f"><label for="fLoc">Where <span class="opt">(optional)</span></label><input id="fLoc" value="${esc(rec.location||preset.location||"")}" placeholder="Address or place" autocomplete="off"></div>`+kindOpts+iconOpts;
  }else if(type==="tasks"){
    const pri=(rec.priority||preset.priority)==="top"?"top":"normal";
    main+=`<div class="two"><div class="f"><label for="fDate">Planned for <span class="opt">(optional)</span></label><input id="fDate" type="date" value="${rec.date||preset.date||""}"></div><div class="f"><label for="fDeadline">Deadline <span class="opt">(optional)</span></label><input id="fDeadline" type="date" value="${rec.deadline||""}"></div></div><p class="hint fhint">Planned for is the day you mean to do it. Deadline is the last day it can be done.</p><div class="f"><span class="lb">Priority</span>${optsHtml("fPri",[["top","Priority for that day"],["normal","Normal"]],pri,"p")}</div><div class="f"><span class="lb">Size <span class="opt">(optional, warns when a session looks full)</span></span>${optsHtml("fSize",[["","Not sized"],["quick","Quick"],["medium","Medium"],["big","Big"]],rec.size||preset.size||"","s")}</div><div class="f"><label for="fClient">Client <span class="opt">(groups the task; filled from the title)</span></label><input id="fClient" list="fClients" value="${esc(rec.client||clientOf(rec)||"")}" placeholder="Personal" autocomplete="off"><datalist id="fClients">${knownClients().map(c=>`<option value="${esc(c)}">`).join("")}</datalist></div><div class="f"><span class="lb">Who's doing it</span>${optsHtml("fAi",[["0","Me"],["1","Claude"]],rec.ai||preset.ai?"1":"0","a")}</div>${(S.slots||[]).length?`<div class="f"><label for="fSlot">Work session</label><select id="fSlot"><option value="">First session that day</option>${S.slots.map(x=>`<option value="${x.id}" ${(rec.slot||preset.slot)===x.id?"selected":""}>${esc(x.title)} (${x.start}–${x.end}, ${dayLabel(x.days)})</option>`).join("")}</select></div>`:""}`+kindOpts.replace('"fKind",Object','"fKind",Object');
    more+=`<div class="two"><div class="f"><label for="fFor">Related event on</label><input id="fFor" type="date" value="${rec.for||""}"></div><div class="f"><label for="fMins">Minutes</label><input id="fMins" type="number" min="5" step="5" inputmode="numeric" value="${rec.mins||""}" placeholder="30"></div></div><div class="f"><label for="fWait">Waiting on <span class="opt">(only if something else has to happen first)</span></label><input id="fWait" value="${esc(rec.waiting||"")}" placeholder="e.g. landlord's reply" autocomplete="off"></div><div class="f"><label for="fNotes">Notes</label><textarea id="fNotes" rows="3">${esc(rec.notes||"")}</textarea></div>`+iconOpts;
    moreNote="Related event, minutes, waiting on, notes, icon, steps";moreOpen=!!(rec.for||rec.mins||rec.icon||rec.waiting||rec.notes||(rec.steps||[]).length);
  }else{
    const days=rec.days||[1,2,3,4,5],st=rec.start||"08:00",en=rec.end||"08:30";
    main+=`<div class="two">${tp("fStart",st,"Start")}${tp("fEnd",en,"End")}</div><div class="f"><span class="lb">Repeats on</span><div class="opts" id="fDays">${DAYN.map((n,i)=>`<button type="button" data-d="${i+1}" aria-pressed="${days.includes(i+1)}">${n}</button>`).join("")}</div></div><div class="f"><label for="fLoc">Where <span class="opt">(optional)</span></label><input id="fLoc" value="${esc(rec.location||preset.location||"")}" placeholder="Address or place" autocomplete="off"></div>`+kindOpts+iconOpts;
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
    <div class="acts sticky"><button class="primary" type="submit">${isNew?"Add":"Save"}</button>${isNew||!S.showDel?"":`<button type="button" class="danger" id="fDel">Delete</button>`}<button type="button" class="ghost" id="fCancel">Cancel</button></div></form>`);
  const form=$("#fForm");
  if(type!=="tasks")linkTimes("fStart","fEnd");
  const addStep=()=>{const i=$("#fStepIn"),v=i.value.trim();if(!v)return;const r=document.createElement("div");r.className="srow";r.innerHTML=`<input value="${esc(v)}" data-done="0" aria-label="Step"><button type="button" class="srm" aria-label="Remove step">${ic("x")}</button>`;$("#fSteps").appendChild(r);i.value="";i.focus()};
  if($("#fStepAdd")){$("#fStepAdd").onclick=addStep;$("#fStepIn").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();addStep()}};$("#fSteps").onclick=e=>{const b=e.target.closest(".srm");if(b)b.parentElement.remove()}}
  form.querySelectorAll(".opts,.icp").forEach(g=>g.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;if(g.id==="fDays")b.setAttribute("aria-pressed",b.getAttribute("aria-pressed")==="true"?"false":"true");else{g.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed","false"));b.setAttribute("aria-pressed","true")}}));
  $("#fCancel").onclick=closeSheet;
  if(!isNew&&$("#fDel")){const del=$("#fDel");del.onclick=()=>{
    if(type==="routines"&&!del.dataset.armed){del.dataset.armed=1;del.textContent="Tap again: deletes every week";return}
    const before=strip(rec);remove(type,rec.id);closeSheet();toast("Deleted",()=>{save(type,rec.id,before);toast("Restored")})}}
  setTimeout(()=>{if(isNew)$("#fTitle").focus()},60);
  form.onsubmit=e=>{e.preventDefault();const err=$("#fErr");err.textContent="";
    const t=$("#fTitle").value.trim();if(!t){err.textContent="Give it a name first.";$("#fTitle").focus();return}
    const k=picked("fKind","k","work"),icn=picked("fIcon","i","");let data;
    if(type==="blocks"){const s=tpv("fStart"),en=tpv("fEnd"),d=$("#fDate").value;
      if(!d){err.textContent="Pick a day.";return}if(toMin(en)<=toMin(s)){err.textContent="End time needs to be after the start time.";return}
      data={...strip(rec),title:t,date:d,start:s,end:en,kind:k};if(preset.taskId)data.taskId=preset.taskId}
    else if(type==="tasks"){const p=picked("fPri","p","normal"),d=$("#fDate").value||null,mins=parseInt($("#fMins").value)||null;
      if(p==="top"&&!d){err.textContent="Pick a planned day so it can be a priority for that day.";return}
      if(p==="top"&&d){const n=S.tasks.filter(x=>x.id!==rec.id&&x.date===d&&x.priority==="top"&&!x.done).length;if(n>=3){err.textContent="That day already has 3 priorities. Finish or remove one first.";return}}
      data={...strip(rec),title:t,date:d,priority:p,mins,kind:k,done:!!rec.done,inbox:false,createdAt:rec.createdAt||Date.now()};
      const fv=$("#fFor").value;if(fv)data.for=fv;else delete data.for;
      const dl=$("#fDeadline").value;if(dl)data.deadline=dl;else delete data.deadline;
      const wt=$("#fWait").value.trim();if(wt)data.waiting=wt;else delete data.waiting;
      const nt=$("#fNotes").value.trim();if(nt)data.notes=nt;else delete data.notes;
      const sz=picked("fSize","s","");if(sz)data.size=sz;else delete data.size;
      if(picked("fAi","a","0")==="1")data.ai=true;else delete data.ai;
      const cv=$("#fClient").value.trim(),auto=rawClient({title:t});if(cv&&cv!==auto&&cv!==clientOf({title:t}))data.client=cv;else delete data.client;
      const sl=$("#fSlot")?$("#fSlot").value:"";if(sl)data.slot=sl;else delete data.slot;
      if(d!==(rec.date||null)){delete data.carries;delete data.from}}
    else{const s=tpv("fStart"),en=tpv("fEnd"),days=[...form.querySelectorAll('#fDays [aria-pressed="true"]')].map(b=>+b.dataset.d);
      if(!days.length){err.textContent="Pick at least one day.";return}if(toMin(en)<=toMin(s)){err.textContent="End time needs to be after the start time.";return}
      data={...strip(rec),title:t,start:s,end:en,days,kind:k,skips:rec.skips||[]};const u=$("#fUntil").value;if(u)data.until=u;else delete data.until}
    if(icn)data.icon=icn;else delete data.icon;
    if(type!=="tasks"){const rv=picked("fRem","r","d");if(rv==="d")delete data.remind;else data.remind=+rv;
      const r2=picked("fRem2","r","n");if(r2==="n")delete data.remind2;else data.remind2=+r2;
      const bf=+picked("fBuf","b",0);if(bf)data.buffer=bf;else delete data.buffer;
      const nt=$("#fNotes").value.trim();if(nt)data.notes=nt;else delete data.notes;
      const lc=$("#fLoc").value.trim();if(lc)data.location=lc;else delete data.location}
    if(type!=="routines"){if($("#fStepIn").value.trim())addStep();const st=[...form.querySelectorAll("#fSteps .srow input")].map(i=>({text:i.value.trim(),done:i.dataset.done==="1"})).filter(x=>x.text);if(st.length)data.steps=st;else delete data.steps}
    delete data.example;const saved=save(type,rec.id||uid(),data);
    if(type==="blocks"||(type==="tasks"&&(data.size||data.mins)&&data.date))saved.then(()=>rebalanceFor(data.date));
    const clash=type==="blocks"?allItemsFor(data.date).filter(y=>y.id!==(rec.id||"")&&y.title!==data.title&&toMin(y.start)<toMin(data.end)&&toMin(y.end)>toMin(data.start))[0]:null;
    if(type==="blocks"&&preset.taskId){const tk=S.tasks.find(x=>x.id===preset.taskId);if(tk&&(tk.date!==data.date||tk.inbox!==false))save("tasks",tk.id,{...strip(tk),date:data.date,inbox:false})}
    if(isNew&&preset.title&&preset.title===(S.qa||"").trim())S.qa="";
    closeSheet();toast(clash?`Saved. It overlaps ${clash.title}, ${clash.start} to ${clash.end}`:isNew?"Added":"Saved")};
}

/* ---------- Bills: every bill in 1 place, lined up for payday on the 29th, each banking detail 1 tap from the banking app ----------
   Bills are their own records (collection "bills"), kept on the server behind the login like the rest of the planner.
   They show as tick-box rows on their due date in the calendar, in the Personal hub, and on Home near payday. */
const BCAT={medical:"Medical",household:"Household",leo:"Leo",work:"Work",other:"Other"};
const BFIELDS=[["payee","Payee name"],["amount","Amount (R)"],["bank","Bank"],["accountType","Account type"],["accountNo","Account number"],["branch","Branch code"],["ref","Reference"]];
const BCOPY=new Set(["payee","amount","accountNo","branch","ref"]);
const BNEED=["payee","amount","bank","accountNo","branch","ref"];
/* payday is the 29th, or the last day of a shorter month (28 Feb) */
const paydayOn=(y,m)=>ymd(new Date(y,m,Math.min(29,new Date(y,m+1,0).getDate())));
function nextPayday(ds){ds=ds||todayStr();const d=fromYmd(ds),p=paydayOn(d.getFullYear(),d.getMonth());return p>=ds?p:paydayOn(d.getFullYear(),d.getMonth()+1)}
function monthAfter(ds){const d=fromYmd(ds),t=new Date(d.getFullYear(),d.getMonth()+1,1),last=new Date(t.getFullYear(),t.getMonth()+1,0).getDate();return ymd(new Date(t.getFullYear(),t.getMonth(),Math.min(d.getDate(),last)))}
const rands=n=>"R"+(+n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g," ");
const billSum=l=>l.reduce((a,b)=>a+(+b.amount||0),0);
const billLate=b=>!b.paid&&!!b.due&&b.due<todayStr();
const billMissing=b=>BNEED.filter(k=>k==="amount"?!(+b.amount>0):!String(b[k]||"").trim());
const billsDue=ds=>tasksShown()?(S.bills||[]).filter(b=>b.due===ds):[];
const billByDue=(a,b)=>(billLate(b)?1:0)-(billLate(a)?1:0)||(b.urgent&&!b.paid?1:0)-(a.urgent&&!a.paid?1:0)||(a.due||"9999").localeCompare(b.due||"9999");
const sameName=(a,b)=>String(a||"").trim().toLowerCase()===String(b||"").trim().toLowerCase();
function billWhen(b){
  if(b.paid)return"Paid "+(b.paidOn?relDay(b.paidOn):"");
  if(!b.due)return"No due date";
  if(billLate(b))return"Overdue since "+relDay(b.due);
  if(b.urgent)return"Urgent · pay "+relDay(b.due);
  return(b.payday?"Payday, ":"Due ")+(b.due===todayStr()?"today":fmt(fromYmd(b.due),{weekday:"short",day:1,month:"short"}));
}
function billRow(b){
  const miss=b.paid?[]:billMissing(b);
  const meta=[`<span class="${billLate(b)?"bl-late":b.urgent&&!b.paid?"bl-urg":""}">${esc(billWhen(b))}</span>`,b.repeats==="monthly"?"monthly":"",b.category&&BCAT[b.category]?BCAT[b.category]:"",miss.length?`<span class="bl-miss">${ic("alert")}Details missing</span>`:""].filter(Boolean).join(" · ");
  return `<div class="trow bill ${b.paid?"done":""} ${billLate(b)?"late":""} ${S.flash===b.id?"grow":""}"><button type="button" class="check" data-billpay="${b.id}" aria-pressed="${!!b.paid}" aria-label="${b.paid?"Mark not paid":"Mark paid"}: ${esc(b.payee)}"><i>${ic("tick")}</i></button><button type="button" class="tmain" data-bill="${b.id}"><b>${esc(b.payee||"Bill")}<span class="bamt">${+b.amount>0?rands(b.amount):"No amount"}</span></b><span class="dline">${meta}</span></button></div>`;
}
function proofRow(b){
  return `<div class="trow bill proof"><button type="button" class="check" data-bproof="${b.id}" aria-pressed="false" aria-label="Proof sent to ${esc(b.payee)}"><i>${ic("tick")}</i></button><button type="button" class="tmain" data-bill="${b.id}"><b>Send proof: ${esc(b.payee)}</b><span class="dline">To ${esc(b.proofEmail)} · paid ${b.paidOn?relDay(b.paidOn):""}</span></button><a class="tlink" href="${proofLink(b)}">${ic("mail")}Email</a></div>`;
}
function proofLink(b){
  const sub=`Proof of payment: ${b.payee}${b.ref?" ref "+b.ref:""}`;
  const body=`Hi,\n\nPlease find attached proof of payment of ${rands(b.amount)}${b.ref?` for reference ${b.ref}`:""}, paid ${b.paidOn?longD(b.paidOn):"today"}.\n\nThank you,\nCatherine Vercuiel`;
  return `mailto:${encodeURIComponent(b.proofEmail||"")}?subject=${encodeURIComponent(sub)}&body=${encodeURIComponent(body)}`;
}

/* Home: "Due before payday" in the last 7 days before the 29th, "Pay today" on payday; overdue, urgent and proof reminders any day */
function billsHomeHtml(){
  const td=todayStr(),pd=nextPayday(td),days=daysBetween(td,pd),isPay=pd===td,all=S.bills||[];
  const late=all.filter(billLate),urgent=all.filter(b=>!b.paid&&b.urgent&&!billLate(b)),proof=all.filter(b=>b.paid&&b.proofPending);
  const cycle=all.filter(b=>!b.paid&&!billLate(b)&&!b.urgent&&b.due&&b.due<=pd);
  const paidNow=isPay?all.filter(b=>b.paid&&b.paidOn===td):[];
  const showCycle=days<=7&&(cycle.length||paidNow.length);
  if(!late.length&&!urgent.length&&!proof.length&&!showCycle)return"";
  const label=isPay?"Pay today":showCycle?"Due before payday":late.length?"Bills overdue":"Bills to sort";
  let sub="";
  if(isPay){const left=billSum([...late,...urgent,...cycle]),paid=billSum(paidNow);sub=`${rands(paid)} paid · ${rands(left)} left`}
  else if(showCycle)sub=`${cycle.length} bill${cycle.length===1?"":"s"} · ${rands(billSum(cycle))} on ${fmt(fromYmd(pd),{weekday:"short",day:1,month:"short"})}, ${days===1?"tomorrow":"in "+days+" days"}`;
  else sub=`${late.length+urgent.length} to pay · ${rands(billSum([...late,...urgent]))}`;
  const rows=[...late,...urgent,...(showCycle?cycle.sort(billByDue):[]),...paidNow].map(billRow).join("")+proof.map(proofRow).join("");
  const n=isPay?paidNow.length+late.length+urgent.length+cycle.length:0,pct=n?Math.round(paidNow.length/n*100):0;
  return `<section class="billcard ${late.length?"late":""}" aria-label="${label}"><div class="dn-top"><span class="dn-l">${ic("money")}${label}</span><button type="button" class="tlink" data-hub="personal">All bills${ic("right")}</button></div><p class="wu-p">${esc(sub)}</p>${isPay?`<span class="hbar"><i style="width:${pct}%"></i></span>`:""}<div class="card list">${rows}</div></section>`;
}

/* Personal hub: the Bills block, overdue first, then by due date, with the total still to pay this pay cycle */
function billsBlockHtml(){
  const td=todayStr(),pd=nextPayday(td),all=S.bills||[],open=all.filter(b=>!b.paid).sort(billByDue);
  const cycle=open.filter(b=>!b.due||b.due<=pd),later=open.filter(b=>b.due&&b.due>pd);
  const paid=all.filter(b=>b.paid).sort((a,b)=>(b.paidOn||"").localeCompare(a.paidOn||"")),proof=paid.filter(b=>b.proofPending);
  const showPaid=!!S.billPaidAll,PAIDN=8;
  const head=`<div class="bhead"><span><b>${rands(billSum(cycle))}</b> to pay by ${fmt(fromYmd(pd),{weekday:"short",day:1,month:"short"})}</span><small>${cycle.length} bill${cycle.length===1?"":"s"}${later.length?` · ${later.length} later (${rands(billSum(later))})`:""}</small></div>`;
  const adds=`<div class="badd"><button type="button" class="primary" data-billpaste>${ic("sparkle")}Paste a bill</button><button type="button" class="ghost" data-billnew>${ic("plus")}Add bill</button></div>`;
  const list=cycle.map(billRow).join("")+later.map(billRow).join("");
  return `<section class="sec bills"><div class="sech"><h2>${ic("money")}Bills</h2><span class="cnt">${open.length} open</span></div><div class="card">${head}${adds}</div>`
    +(list?`<div class="card list" style="margin-top:10px">${list}</div>`:`<p class="hubnone">No bills to pay. Paste one from an SMS or email and Gemini fills in the card.</p>`)
    +(proof.length?`<div class="card list" style="margin-top:10px">${proof.map(proofRow).join("")}</div>`:"")
    +(paid.length?`<button type="button" class="latr" data-billpaid aria-expanded="${showPaid}"><span>Paid · ${paid.length}</span>${ic(showPaid?"left":"right")}</button>${showPaid?`<div class="card list">${paid.slice(0,30).map(billRow).join("")}</div>`:""}`:"")
    +`</section>`;
}

/* the bill card: every value Cat pastes into her banking app has its own copy button */
function copyText(v,label){
  const done=()=>{buzz();toast(label+" copied")};
  const fallback=()=>{const t=document.createElement("textarea");t.value=v;t.setAttribute("readonly","");t.style.position="fixed";t.style.opacity="0";document.body.appendChild(t);t.select();try{document.execCommand("copy");done()}catch(_){toast("Couldn't copy. Press and hold to copy instead.")}t.remove()};
  try{navigator.clipboard.writeText(v).then(done,fallback)}catch(_){fallback()}
}
const billVal=(b,k)=>k==="amount"?(+b.amount>0?(+b.amount).toFixed(2):""):String(b[k]||"").trim();
function copyAllText(b){
  return [["Payee",b.payee],["Bank",[b.bank,b.accountType].filter(Boolean).join(", ")],["Account number",b.accountNo],["Branch code",b.branch],["Reference",b.ref],["Amount",billVal(b,"amount")]].filter(([,v])=>v).map(([l,v])=>`${l}: ${v}`).join("\n");
}
function openBill(id){
  const b=(S.bills||[]).find(x=>x.id===id);if(!b){toast("That bill couldn't be found.");return}
  const miss=billMissing(b);
  const rows=BFIELDS.map(([k,l])=>{const v=k==="amount"?(+b.amount>0?rands(b.amount):""):billVal(b,k),need=BNEED.includes(k)&&!billVal(b,k);
    return `<div class="bf ${need?"miss":""}"><span class="bl">${l}</span><span class="bv">${v?esc(v):`<em>${need?"Not added yet":"None"}</em>`}</span>${BCOPY.has(k)&&billVal(b,k)?`<button type="button" class="bcp" data-bcopy="${k}" aria-label="Copy ${l.toLowerCase()}">${ic("copy")}Copy</button>`:""}</div>`}).join("")
    +`<div class="bf"><span class="bl">Due</span><span class="bv">${esc(billWhen(b))}${b.repeats==="monthly"?" · monthly":" · once-off"}</span></div>`
    +(b.proofEmail?`<div class="bf"><span class="bl">Proof of payment</span><span class="bv">${esc(b.proofEmail)}</span><a class="bcp" href="${proofLink(b)}">${ic("mail")}Email</a></div>`:"")
    +(b.category?`<div class="bf"><span class="bl">Category</span><span class="bv">${esc(BCAT[b.category]||b.category)}</span></div>`:"")
    +(b.notes?`<div class="bf"><span class="bl">Notes</span><span class="bv">${esc(b.notes)}</span></div>`:"");
  sheet("Bill",`<div class="in bsheet"><h3>${esc(b.payee||"Bill")}</h3><p class="bbig">${+b.amount>0?rands(b.amount):"No amount yet"}<small class="${billLate(b)?"bl-late":""}">${esc(billWhen(b))}</small></p>
    ${miss.length&&!b.paid?`<p class="bwarn">${ic("alert")}Add the ${miss.map(k=>BFIELDS.find(f=>f[0]===k)[1].toLowerCase()).join(", ")} before you pay.</p>`:""}
    ${b.checked===false&&!b.paid?`<p class="bwarn">${ic("alert")}These banking details haven't been checked against an invoice or statement yet.</p>`:""}
    <div class="bfields">${rows}</div>
    <div class="acts"><button type="button" class="ghost" id="bAll">${ic("copy")}Copy all</button>${b.paid?`<button type="button" class="ghost" id="bPay">Mark not paid</button>`:`<button type="button" class="primary" id="bPay">${ic("tick")}Mark paid</button>`}</div>
    ${b.paid&&b.proofPending?`<div class="acts"><a class="ghost bmail" href="${proofLink(b)}">${ic("mail")}Send proof</a><button type="button" class="ghost" id="bProof">${ic("tick")}Proof sent</button></div>`:""}
    <div class="acts"><button type="button" class="ghost" id="bEdit">${ic("pen")}Edit</button><button type="button" class="danger" id="bDel">Delete</button><button type="button" class="ghost" id="bX">Close</button></div></div>`);
  $("#bX").onclick=closeSheet;
  document.querySelectorAll("[data-bcopy]").forEach(x=>x.onclick=()=>{const k=x.dataset.bcopy;copyText(billVal(b,k),BFIELDS.find(f=>f[0]===k)[1].replace(" (R)",""))});
  $("#bAll").onclick=()=>{const t=copyAllText(b);if(!t){toast("Nothing to copy yet.");return}copyText(t,"Banking details")};
  $("#bPay").onclick=()=>{closeSheet();b.paid?unpayBill(b):payBill(b)};
  const pr=$("#bProof");if(pr)pr.onclick=()=>{closeSheet();proofSent(b)};
  $("#bEdit").onclick=()=>{closeSheet();setTimeout(()=>openBillForm(b),120)};
  const del=$("#bDel");del.onclick=()=>{if(!del.dataset.armed){del.dataset.armed=1;del.textContent="Tap again to delete";return}const before=strip(b);closeSheet();remove("bills",b.id);toast("Bill deleted",()=>save("bills",b.id,before))};
}

/* paying: monthly bills make next month's bill straight away; once-off bills go to the Paid list */
function payBill(b){
  const td=todayStr(),before=strip(b),rec={...before,paid:true,paidOn:td};delete rec.urgent;
  if(b.proofEmail)rec.proofPending=true;
  let nextId=null;
  if(b.repeats==="monthly"){
    const base=b.due&&b.due>td?b.due:td;
    const due=b.payday?nextPayday(ymd(addDays(fromYmd(base),1))):monthAfter(b.due||td);
    nextId=uid();const nx={...before,due,paid:false,nextOf:b.id,createdAt:Date.now()};["paidOn","proofPending","urgent","nextId"].forEach(k=>delete nx[k]);
    rec.nextId=nextId;save("bills",nextId,nx);
  }
  save("bills",b.id,rec);buzz();
  const undo=()=>{save("bills",b.id,before);if(nextId)remove("bills",nextId)};
  const pd=nextPayday(td),left=(S.bills||[]).filter(x=>!x.paid&&x.due&&x.due<=pd);
  const msg=nextId?`Paid. Next one due ${relDay((S.bills.find(x=>x.id===nextId)||{}).due||td)}`:"Paid";
  if(pd===td&&!left.length)cheer("Every bill for payday is paid",undo);else toast(b.proofEmail?msg+". Send the proof when you can.":msg,undo);
}
function unpayBill(b){
  const before=strip(b),rec={...before,paid:false};["paidOn","proofPending"].forEach(k=>delete rec[k]);
  const nx=b.nextId&&(S.bills||[]).find(x=>x.id===b.nextId&&!x.paid),nxBefore=nx?strip(nx):null;
  if(nx){remove("bills",nx.id);delete rec.nextId}
  save("bills",b.id,rec);
  toast("Marked not paid",()=>{save("bills",b.id,before);if(nxBefore)save("bills",nx.id,nxBefore)});
}
function proofSent(b){const before=strip(b),rec={...before,proofSent:todayStr()};delete rec.proofPending;save("bills",b.id,rec);buzz();toast("Proof ticked off",()=>save("bills",b.id,before))}

/* adding a bill: paste the SMS or email (or a screenshot), Gemini fills the card, Cat checks it and saves */
const looksLikeBill=t=>/\b(acc(oun)?t?\.?\s*(no|nr|number|#)|account\s*number|branch(\s*code)?|beneficiary|banking\s*details|proof\s*of\s*payment|\bpop\b)/i.test(t)&&/\d{5,}/.test(t);
function shrinkImage(file){return new Promise((ok,no)=>{const img=new Image(),url=URL.createObjectURL(file);
  img.onload=()=>{const k=Math.min(1,1600/Math.max(img.width,img.height)),c=document.createElement("canvas");c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);c.getContext("2d").drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(url);ok({mime:"image/jpeg",data:c.toDataURL("image/jpeg",.85).split(",")[1]})};
  img.onerror=()=>{URL.revokeObjectURL(url);no(new Error("That image couldn't be opened. Try a PNG or JPG screenshot."))};img.src=url})}
function openBillPaste(text,file){
  sheet("Paste a bill",`<form class="in" id="bpForm"><h3>${ic("sparkle")}Paste a bill</h3><p class="hint">Paste the SMS or email, or add a screenshot. Gemini fills in the card and you check it before it saves.</p>
    <div class="f"><label for="bpText">The message</label><textarea id="bpText" rows="6" placeholder="Paste the message here">${esc(text||"")}</textarea></div>
    <div class="f"><span class="lb">Screenshot <span class="opt">(optional)</span></span><label class="ghost bfile">${ic("camera")}<span id="bpName">${file?esc(file.name||"Screenshot added"):"Add a screenshot"}</span><input type="file" id="bpFile" accept="image/*" hidden></label></div>
    <div class="err" id="bpErr" role="alert"></div>
    <div class="acts sticky"><button class="primary" type="submit" id="bpGo">${ic("sparkle")}Read it</button><button type="button" class="ghost" id="bpSelf">Fill in myself</button><button type="button" class="ghost" id="bpX">Cancel</button></div></form>`);
  let img=file||null;
  $("#bpX").onclick=closeSheet;
  $("#bpFile").onchange=e=>{img=e.target.files[0]||null;$("#bpName").textContent=img?img.name||"Screenshot added":"Add a screenshot"};
  $("#bpSelf").onclick=()=>{closeSheet();setTimeout(()=>openBillForm(null,{}),120)};
  $("#bpForm").onsubmit=async e=>{e.preventDefault();const t=$("#bpText").value.trim(),err=$("#bpErr");err.textContent="";
    if(!t&&!img){err.textContent="Paste the message or add a screenshot first.";return}
    if(!navigator.onLine){err.textContent="You're offline. Try again once you're connected.";return}
    const go=$("#bpGo");go.disabled=true;go.innerHTML=`<span class="dots"><i></i><i></i><i></i></span>Reading`;
    try{const image=img?await shrinkImage(img):undefined;const r=await askApi({bill:t,image});if(!$("#bpForm"))return;closeSheet();setTimeout(()=>openBillForm(null,{...r.bill,fromAi:true}),120)}
    catch(x){if(!$("#bpForm"))return;go.disabled=false;go.innerHTML=`${ic("sparkle")}Try again`;err.textContent=x.message}};
  if(file&&!text)setTimeout(()=>$("#bpGo").click(),60);
}
/* the saved details for a payee: the most recent checked bill with the same name */
function savedPayee(name,exceptId){return (S.bills||[]).filter(x=>x.id!==exceptId&&sameName(x.payee,name)&&x.checked!==false).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))[0]||null}
const BANKK=[["bank","bank"],["accountNo","account number"],["branch","branch code"]];
function billCheck(data,rec){
  const prior=rec&&rec.checked!==false&&rec.id?rec:savedPayee(data.payee,rec&&rec.id);
  if(!prior)return{need:true,msg:`New payee. Check these banking details against an invoice or statement from ${data.payee||"them"}. Fake payment SMSes are common.`};
  const diff=BANKK.filter(([k])=>String(data[k]||"")&&String(data[k]||"")!==String(prior[k]||""));
  if(diff.length)return{need:true,changed:true,msg:`The ${diff.map(d=>d[1]).join(", ")} ${diff.length>1?"are":"is"} different from the details saved for ${prior.payee}${diff.length===1&&prior[diff[0][0]]?` (was ${prior[diff[0][0]]})`:""}. Check them against an invoice or statement before you save.`};
  return{need:false};
}
function openBillForm(rec,preset){
  const isNew=!rec||!rec.id;rec=rec||{};preset=preset||{};
  let v={...preset,...strip(rec)};if(isNew)v={...preset};
  if(isNew&&v.payee){const sp=savedPayee(v.payee);if(sp){["bank","accountType","accountNo","branch","proofEmail","category"].forEach(k=>{if(!String(v[k]||"").trim()&&sp[k])v[k]=sp[k]});v.matched=sp.payee}}
  const pd=nextPayday(),dueMode=v.urgent?"urgent":isNew?(v.due&&v.due!==pd?"date":"payday"):(v.payday?"payday":"date");
  const inp=(k,l,o={})=>`<div class="f ${BNEED.includes(k)&&!String(k==="amount"?(+v.amount>0?v.amount:""):v[k]||"").trim()?"miss":""}" data-bfk="${k}"><label for="bF_${k}">${l}${o.opt?` <span class="opt">(optional)</span>`:""}</label><input id="bF_${k}" value="${esc(k==="amount"?(+v.amount>0?(+v.amount).toFixed(2):""):v[k]||"")}" ${o.attrs||""} autocomplete="off"></div>`;
  const payees=[...new Set((S.bills||[]).map(x=>x.payee).filter(Boolean))];
  sheet(isNew?"New bill":"Edit bill",`<form class="in" id="bForm"><h3>${isNew?"New bill":"Edit bill"}</h3>
    ${preset.fromAi?`<p class="hint">${ic("sparkle")} Gemini filled this in${v.matched?` and used the details saved for ${esc(v.matched)}`:""}. Check every field. Anything it couldn't find is highlighted.</p>`:""}
    ${inp("payee","Payee name",{attrs:'list="bPayees" placeholder="As the bank account is named"'})}<datalist id="bPayees">${payees.map(p=>`<option value="${esc(p)}">`).join("")}</datalist>
    <div class="two">${inp("amount","Amount (R)",{attrs:'inputmode="decimal" placeholder="320.00"'})}${inp("ref","Reference",{attrs:'placeholder="What the payee asked for"'})}</div>
    <div class="two">${inp("bank","Bank",{attrs:'placeholder="Investec, FNB"'})}${inp("accountType","Account type",{opt:1,attrs:'placeholder="Current, cheque"'})}</div>
    <div class="two">${inp("accountNo","Account number",{attrs:'inputmode="numeric"'})}${inp("branch","Branch code",{attrs:'inputmode="numeric"'})}</div>
    <div class="f"><span class="lb">When to pay</span>${optsHtml("bDue",[["payday",`Payday, ${fmt(fromYmd(pd),{weekday:"short",day:1,month:"short"})}`],["urgent","Urgent, pay now"],["date","Pick a date"]],dueMode,"w")}<input id="bF_due" type="date" value="${v.due||pd}" ${dueMode==="date"?"":"hidden"} aria-label="Due date"></div>
    <div class="f"><span class="lb">Repeats</span>${optsHtml("bRep",[["once","Once-off"],["monthly","Monthly"]],v.repeats==="monthly"?"monthly":"once","r")}</div>
    ${inp("proofEmail","Proof of payment email",{opt:1,attrs:'type="email" inputmode="email" placeholder="Where to send proof"'})}
    <div class="f"><span class="lb">Category</span>${optsHtml("bCat",Object.entries(BCAT),v.category||"other","c")}</div>
    <div class="f"><label for="bF_notes">Notes <span class="opt">(optional)</span></label><textarea id="bF_notes" rows="2">${esc(v.notes||"")}</textarea></div>
    <div class="bcheck" id="bChk" hidden><p id="bChkMsg"></p><label><input type="checkbox" id="bChkBox"> I checked these details against an invoice or statement</label></div>
    <div class="err" id="bErr" role="alert"></div>
    <div class="acts sticky"><button class="primary" type="submit">${isNew?"Save bill":"Save"}</button><button type="button" class="ghost" id="bCancel">Cancel</button></div></form>`);
  const form=$("#bForm"),val=k=>($("#bF_"+k)||{}).value?.trim()||"";
  form.querySelectorAll(".opts").forEach(g=>g.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;g.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed","false"));b.setAttribute("aria-pressed","true");if(g.id==="bDue")$("#bF_due").hidden=b.dataset.w!=="date"}));
  $("#bCancel").onclick=closeSheet;
  const collect=()=>{const amt=parseFloat(val("amount").replace(/[R\s,]/gi,m=>m===","?".":""));const w=picked("bDue","w","payday");
    const d={...strip(rec),payee:val("payee"),amount:amt>0?Math.round(amt*100)/100:null,bank:val("bank"),accountType:val("accountType"),accountNo:val("accountNo").replace(/[\s-]/g,""),branch:val("branch").replace(/[\s-]/g,""),ref:val("ref"),proofEmail:val("proofEmail"),category:picked("bCat","c","other"),repeats:picked("bRep","r","once"),notes:val("notes"),paid:!!rec.paid,createdAt:rec.createdAt||Date.now()};
    if(w==="payday"){d.payday=true;d.due=pd;delete d.urgent}else if(w==="urgent"){d.urgent=true;d.due=todayStr();delete d.payday}else{d.due=$("#bF_due").value||pd;delete d.payday;delete d.urgent}
    return d};
  const refresh=()=>{form.querySelectorAll("[data-bfk]").forEach(f=>{const k=f.dataset.bfk;if(BNEED.includes(k))f.classList.toggle("miss",!val(k))});
    const c=billCheck(collect(),rec),box=$("#bChk");box.hidden=!c.need;box.classList.toggle("changed",!!c.changed);if(c.need)$("#bChkMsg").textContent=c.msg};
  form.addEventListener("input",refresh);refresh();
  setTimeout(()=>{if(isNew&&!preset.fromAi)$("#bF_payee").focus()},60);
  form.onsubmit=e=>{e.preventDefault();const err=$("#bErr");err.textContent="";const d=collect();
    if(!d.payee){err.textContent="Add who the bill is from first.";$("#bF_payee").focus();return}
    if(d.proofEmail&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.proofEmail)){err.textContent="That proof of payment email doesn't look right.";return}
    const c=billCheck(d,rec);
    if(c.need&&!$("#bChkBox").checked){if(String(d.accountNo||d.branch)){err.textContent="Tick the box once you've checked the banking details.";$("#bChk").scrollIntoView({block:"center"});return}d.checked=false}
    else d.checked=true;
    delete d.fromAi;delete d.matched;
    save("bills",rec.id||uid(),d);closeSheet();
    const miss=billMissing(d);toast(miss.length?`Saved. Still missing: ${miss.map(k=>BFIELDS.find(f=>f[0]===k)[1].replace(" (R)","").toLowerCase()).join(", ")}`:isNew?"Bill added":"Bill saved")};
}

/* the first bill from the brief; account number and branch code are entered in the app */
function seedBills(){
  if(S.billsSeeded||S.seeding)return;S.seeding=true;
  const go=async()=>{if(!(S.bills||[]).some(b=>b.id==="b-magni"))await save("bills","b-magni",{payee:"Dr Paul R Magni Inc",amount:320,bank:"Investec",accountType:"current",accountNo:"",branch:"",ref:"004945",due:"2026-11-29",payday:true,repeats:"once",proofEmail:"admin@panoramapmc.co.za",category:"medical",notes:"",paid:false,checked:false,createdAt:Date.now()});
    try{await api({op:"settings",data:{billsSeeded:true}});S.billsSeeded=true}catch(_){}S.seeding=false};
  go();
}

function billClick(e){
  const bp=e.target.closest("[data-billpay]");if(bp){const b=(S.bills||[]).find(x=>x.id===bp.dataset.billpay);if(b)b.paid?unpayBill(b):payBill(b);return true}
  const pf=e.target.closest("[data-bproof]");if(pf){const b=(S.bills||[]).find(x=>x.id===pf.dataset.bproof);if(b)proofSent(b);return true}
  const bo=e.target.closest("[data-bill]");if(bo){openBill(bo.dataset.bill);return true}
  if(e.target.closest("[data-billpaste]")){openBillPaste("");return true}
  if(e.target.closest("[data-billnew]")){openBillForm(null,{});return true}
  if(e.target.closest("[data-billpaid]")){S.billPaidAll=!S.billPaidAll;render();return true}
  return false;
}
/* a screenshot pasted into Quick Add goes straight to the bill reader */
document.addEventListener("paste",e=>{if(e.target.id!=="qaIn")return;const f=[...(e.clipboardData?.files||[])].find(x=>/^image\//.test(x.type));if(!f)return;e.preventDefault();openBillPaste("",f)});

/* ---------- tell the planner (Gemini) ---------- */
async function askApi(body){
  const r=await fetch("/api/assistant",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  if(r.status===401){location.href="/login";throw new Error("signed out")}
  const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.error||"The planner assistant couldn't be reached. Try again.");return j;
}
const ACT_IC={add_block:"clock",add_task:"task",add_routine:"repeat",update_item:"pen",complete_task:"tick",skip_routine:"repeat",delete_item:"x"};
function askSheet(text,inner){sheet("Tell the planner",`<div class="in askv"><h3>${ic("sparkle")}Tell the planner</h3><p class="askq">${esc(text)}</p>${inner}</div>`)}
async function askPlanner(text){
  if(!navigator.onLine){toast("You're offline. Try again once you're connected.");return}
  askSheet(text,`<p class="askwait"><span class="dots"><i></i><i></i><i></i></span>Reading your plan</p><div class="acts"><button class="ghost" type="button" id="askX" style="flex:1">Cancel</button></div>`);
  let gone=false;$("#askX").onclick=()=>{gone=true;closeSheet()};
  let res;try{res=await askApi({text})}catch(e){if(gone)return;askSheet(text,`<p class="err">${esc(e.message)}</p><div class="acts"><button class="primary" type="button" id="askRetry">Try again</button><button class="ghost" type="button" id="askInbox">Add to Inbox instead</button><button class="ghost" type="button" id="askX">Close</button></div>`);$("#askRetry").onclick=()=>askPlanner(text);$("#askInbox").onclick=()=>{hideSheet();S.returnDock=null;quickInbox(text);release()};$("#askX").onclick=closeSheet;return}
  if(gone||!$(".askv"))return;
  const acts=res.actions||[];
  const list=acts.map((a,i)=>`<label class="acard ${a.danger?"danger":""}"><input type="checkbox" data-ai="${i}" checked><span class="aic">${ic(ACT_IC[a.name]||"note")}</span><span class="atx"><b>${esc(a.summary)}</b>${a.detail?`<small>${esc(a.detail)}</small>`:""}</span></label>`).join("");
  askSheet(text,`<p class="areply">${esc(res.reply||"")}</p>${acts.length?`<div class="alist">${list}</div>`:""}
    <div class="acts sticky">${acts.length?`<button class="primary" type="button" id="askGo">${acts.length===1?"Save this change":`Save ${acts.length} changes`}</button>`:""}<button class="ghost" type="button" id="askEdit">Reword</button><button class="ghost" type="button" id="askX">Cancel</button></div>`);
  $("#askX").onclick=closeSheet;
  $("#askEdit").onclick=()=>{closeSheet();S.qa=text;if(S.view==="home")render();setTimeout(()=>{const i=$("#qaIn");if(i){i.focus();i.select()}},120)};
  const go=$("#askGo");if(!go)return;
  const count=()=>{const n=document.querySelectorAll(".alist input:checked").length;go.disabled=!n;go.textContent=n===1?"Save this change":n?`Save ${n} changes`:"Nothing ticked"};
  document.querySelectorAll(".alist input").forEach(c=>c.onchange=count);
  go.onclick=async()=>{const keep=acts.filter((_,i)=>document.querySelector(`.alist input[data-ai="${i}"]`).checked).map(a=>({name:a.name,args:a.args}));
    go.disabled=true;go.textContent="Saving";
    try{const r=await askApi({apply:keep});closeSheet();S.qa="";await load();
      const bad=(r.results||[]).filter(x=>!x.ok);toast(bad.length?`${keep.length-bad.length} saved, ${bad.length} couldn't be: ${bad[0].error}`:keep.length===1?"Planner updated":`${keep.length} changes saved`)}
    catch(e){go.disabled=false;count();toast(e.message)}};
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
  hideSheet();S.returnDock=null;S.dock=null;renderDock();release();
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
  const commit=()=>{const rec={...before,done};if(done){rec.doneAt=Date.now();delete rec.review}else delete rec.doneAt;save("tasks",t.id,rec);S.blocks.filter(b=>b.taskId===t.id&&!!b.done!==done).forEach(b=>save("blocks",b.id,{...strip(b),done}));
    if(!done){toast("Marked not done",undo);return}
    const ds=t.date&&t.date>=todayStr()?t.date:todayStr(),top=topFor(ds);
    if(t.priority==="top"&&top.length&&top.every(x=>x.id===t.id||x.done))cheer("Priorities done. Great day.",undo);else toast("Done",undo)};
  if(done){buzz();const row=el&&el.closest(".trow,.att");if(row&&!reduced()){el.setAttribute("aria-pressed","true");row.classList.add("ticked");setTimeout(commit,260);return}}
  commit();
}
/* ---------- events ---------- */
function quickBlock(d){const g=firstGap(d,60);openSheet("blocks",null,{date:d,start:g!==null?hm(g):S.work.start,end:g!==null?hm(g+60):hm(toMin(S.work.start)+60)})}
const pt=e=>({x:e.clientX,y:e.clientY});
document.addEventListener("change",e=>{
  const cb=e.target.closest("[data-step]");
  if(cb){const r=resolve(cb.dataset.key);if(!r)return;const st=(r.rec.steps||[]).map(x=>({...x}));st[+cb.dataset.step].done=cb.checked;save(r.col,r.rec.id,{...strip(r.rec),steps:st});if(cb.checked&&st.every(x=>x.done)){if(r.col==="tasks"&&!r.rec.done){const before={...strip(r.rec),steps:(r.rec.steps||[]).map(x=>({...x}))};save("tasks",r.rec.id,{...strip(r.rec),steps:st,done:true,doneAt:Date.now()});cheer("All steps done, so the task is ticked",()=>save("tasks",r.rec.id,before))}else cheer("All steps done")}return}
  if(e.target.id==="dNote"){const k=e.target.dataset.key,v=e.target.value.trim(),r=resolve(k);if(!r)return;const old=r.col==="routines"?(r.rec.dayNotes?.[r.date]||""):(r.rec.notes||"");if(v===old)return;setItemNote(k,v);toast(v?"Note saved":"Note removed")}
});
document.addEventListener("input",e=>{
  if(e.target.id==="qaIn"){S.qa=e.target.value;const o=$("#qopts");if(o)o.hidden=!S.qa.trim();return}
  if(e.target.id==="dNote"){const s=$("#dNoteSt");if(s)s.textContent="Saves when you leave the box"}
});
document.addEventListener("submit",e=>{
  const f=e.target;
  if(f.id==="qadd"){e.preventDefault();const t=(S.qa||"").trim();if(!t){openAdd(homeSel());return}$("#qaIn").blur();if(looksLikeBill(t)){S.qa="";openBillPaste(t);setTimeout(()=>{const g=$("#bpGo");if(g)g.click()},60);return}askPlanner(t);return}
  if(f.dataset.addstep){e.preventDefault();const i=$("#dStepIn"),v=i.value.trim();if(!v)return;const r=resolve(f.dataset.addstep);if(!r)return;save(r.col,r.rec.id,{...strip(r.rec),steps:[...(r.rec.steps||[]),{text:v,done:false}]});setTimeout(()=>{const n=$("#dStepIn");if(n)n.focus({preventScroll:true})},30);return}
});
document.addEventListener("click",e=>{
  if(e.target.closest("[data-step]")||e.target.closest(".step"))return;
  if(e.target.closest("[data-dockx]")){closeDock();return}
  if(e.target.closest("[data-sheetx]")){closeSheet();return}
  if(billClick(e))return;
  const tg=e.target.closest("[data-toggle]");if(tg){const t=S.tasks.find(x=>x.id===tg.dataset.toggle);if(t)toggleTask(t,tg);return}
  const ac=e.target.closest("[data-act]");if(ac){const r=resolve(ac.dataset.key);if(!r)return;const{col,rec,date}=r,a=ac.dataset.act;
    if(a==="focus"){startFocus(col,rec,date);return}
    if(a==="edit"){openSheet(col,rec,{});return}
    if(a==="schedule"){scheduleSheet(rec);return}
    if(a==="done"){toggleTask(rec);return}
    if(a==="idone"){setItemDone(ac.dataset.key);return}
    if(a==="keep"){const before=strip(rec);save("tasks",rec.id,{...before,inbox:false});toast("Moved to Unscheduled",()=>save("tasks",rec.id,before));return}
    if(a==="pri"){const before=strip(rec);
      if(rec.priority==="top"&&rec.date){save("tasks",rec.id,{...before,priority:"normal"});toast("Removed from priorities",()=>save("tasks",rec.id,before));return}
      const d=rec.date&&rec.date>=todayStr()?rec.date:homeSel();if(topFor(d).length>=3){toast(`${cap(dayWord(d))} already has 3 priorities.`);return}
      save("tasks",rec.id,{...before,priority:"top",date:d,inbox:false});toast(`Priority for ${dayWord(d)}`,()=>save("tasks",rec.id,before));return}
    if(a==="skip"){const set=new Set(rec.skips||[]),sk=set.has(date);sk?set.delete(date):set.add(date);const before=strip(rec);save("routines",rec.id,{...before,skips:[...set]});toast(sk?"Back on for that day":"Skipped for that day",()=>save("routines",rec.id,before));closeDock();return}
    return}
  const fb=e.target.closest("[data-focus]");if(fb){const[col,id,date]=fb.dataset.focus.split(":");const r=S[col].find(x=>x.id===id);if(r)startFocus(col,r,date);return}
  const dk=e.target.closest("[data-dock]");if(dk){openDock(dk.dataset.dock);return}
  if(e.target.closest("[data-shop]")){openShopping();return}
  if(e.target.closest("[data-manualadd]")){openAdd(homeSel());return}
  const se=e.target.closest("[data-session]");if(se){openSession(se.dataset.session,!!se.dataset.sesfocus);return}
  const sle=e.target.closest("[data-slotedit]");if(sle){openSlot((S.slots||[]).find(x=>x.id===sle.dataset.slotedit));return}
  if(e.target.closest("[data-slotnew]")){openSlot(null);return}
  const op=e.target.closest("[data-open]");if(op){openDock(op.dataset.open);return}
  if(hubClick(e))return;
  /* Home */
  const sd=e.target.closest("[data-sel]");if(sd){const d=sd.dataset.sel;if(d!==homeSel()){setSel(d);S.earlier=false;render()}return}
  const smo=e.target.closest("[data-selmonth]");if(smo){const c=fromYmd(homeSel()),n=+smo.dataset.selmonth,t=new Date(c.getFullYear(),c.getMonth()+n,1),last=new Date(t.getFullYear(),t.getMonth()+1,0).getDate(),now=new Date();const pick=(t.getMonth()===now.getMonth()&&t.getFullYear()===now.getFullYear())?todayStr():ymd(new Date(t.getFullYear(),t.getMonth(),Math.min(c.getDate(),last)));setSel(pick);S.earlier=false;render();return}
  const sw=e.target.closest("[data-selweek]");if(sw){setSel(ymd(addDays(fromYmd(homeSel()),7*+sw.dataset.selweek)));render();return}
  const oc=e.target.closest("[data-opencal]");if(oc){const v=oc.dataset.opencal,d=v==="today"?new Date():fromYmd(homeSel());goCal("month",new Date(d.getFullYear(),d.getMonth(),1),pt(e));return}
  const ex=e.target.closest("[data-expand]");if(ex){goCal("day",ex.dataset.expand,pt(e));return}
  if(e.target.closest("[data-earlier]")){S.earlier=!S.earlier;render();return}
  if(e.target.closest("[data-attall]")){S.attAll=!S.attAll;render();return}
  if(e.target.closest("[data-comingall]")){S.comingAll=!S.comingAll;render();return}
  const gh=e.target.closest("[data-grp]");if(gh){const k=gh.dataset.grp;grpSet(k,!S.grp[k]);render();return}
  const ga=e.target.closest("[data-grpall]");if(ga){const k=ga.dataset.grpall;S.grpAll[k]=!S.grpAll[k];render();return}
  const pp=e.target.closest("[data-pickpri]");if(pp){pickPriority(pp.dataset.pickpri);return}
  const fl=e.target.closest("[data-fill]");if(fl){const[d,a,b]=fl.dataset.fill.split("|");fillGap(d,+a,+b);return}
  const qd=e.target.closest("[data-qadd]");if(qd){const t=(S.qa||"").trim();if(!t){$("#qaIn").focus();return}const k=qd.dataset.qadd;
    if(k==="inbox")quickInbox(t);else if(k==="bill"){S.qa="";openBillPaste(t);setTimeout(()=>{const g=$("#bpGo");if(g)g.click()},60)}else if(k==="ai")askPlanner(t);else{S.qaTitle=t;S.qa="";openAdd(homeSel())}return}
  const adt=e.target.closest("[data-addday]");if(adt&&!e.target.closest("[data-addk]")){openAdd(adt.dataset.addday);return}
  /* calendar */
  if(e.target.closest("#back")){backToPlanner();return}
  const ly=e.target.closest("[data-layer]");if(ly){const k=ly.dataset.layer;S.hide.has(k)?S.hide.delete(k):S.hide.add(k);store.set("hide",[...S.hide]);render();return}
  if(e.target.closest("[data-today]")){const n=new Date();n.setHours(0,0,0,0);const dir=n>S.cur?"next":"prev";slide(()=>{S.cur=n;renderDay._scrolled=true;setHash(calHash());render()},dir);return}
  if(e.target.closest("[data-search]")){openSearch();return}
  const cr=e.target.closest("[data-crumb]");if(cr){if(cr.dataset.crumb==="week")S.hl=ymd(S.cur);goCal(cr.dataset.crumb,null,pt(e));return}
  const pk=e.target.closest("[data-pick]");if(pk){if(pk.dataset.pick!==ymd(S.cur))pickDay(pk.dataset.pick);return}
  const pw=e.target.closest("[data-pickw]");if(pw){const n=pw.dataset.pickw;if(n!==ymd(monday(S.cur)))slide(()=>{S.cur=fromYmd(n);setHash(calHash());render()},n>ymd(monday(S.cur))?"next":"prev");return}
  const zd=e.target.closest("[data-zday]");if(zd){goCal("day",zd.dataset.zday,pt(e));return}
  const zw=e.target.closest("[data-zweek]");if(zw){const cell=e.target.closest("[data-zday-w]");S.hl=cell?cell.dataset.zdayW:null;goCal("week",zw.dataset.zweek,pt(e));return}
  const sl=e.target.closest("[data-slot]");if(sl){const s=sl.dataset.slot;openSheet("blocks",null,{start:s,end:hm(Math.min(toMin(s)+60,23*60+45)),date:sl.dataset.slotday||ymd(S.cur)});return}
  const ak=e.target.closest("[data-addk]");if(ak){const k=ak.dataset.addk,d=ak.dataset.addday,title=S.qaTitle;S.qaTitle="";
    if(k==="block"){const g=firstGap(d,60);openSheet("blocks",null,{title,date:d,start:g!==null?hm(g):S.work.start,end:g!==null?hm(g+60):hm(toMin(S.work.start)+60)})}
    else if(k==="task")openSheet("tasks",null,{title,date:d});else openSheet("routines",null,{title});return}
  const hdn=e.target.closest("[data-hdone]");if(hdn){const nowDone=setItemDone(hdn.dataset.hdone);if(nowDone)buzz();return}
  const hn=e.target.closest("[data-hnote]");if(hn){openDock(hn.dataset.hnote);setTimeout(()=>{const ta=$("#dNote");if(ta){ta.focus();ta.setSelectionRange(ta.value.length,ta.value.length)}},60);return}
  if(e.target.closest("[data-settings]")){openSettings();return}
});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){if(sheetOpen())closeSheet();else if(S.dock)closeDock();else if(S.view==="cal"){if(S.zoom==="month")backToPlanner();else zoomOut()}return}
  const mr=e.target.closest&&e.target.closest(".mrow");if(mr&&(e.key==="Enter"||e.key===" ")){e.preventDefault();goCal("week",mr.dataset.zweek)}});
$("#prev").onclick=()=>step(-1);
$("#next").onclick=()=>step(1);
$("#out").onclick=zoomOut;
$("#nowbar").onclick=()=>goCal("day",todayStr());
$("#search").onclick=openSearch;
$("#fab").onclick=()=>openAdd(S.view==="cal"&&S.zoom==="day"?ymd(S.cur):S.view==="home"?homeSel():todayStr());
/* one add sheet on every screen: block (in the next free time), task or routine */
function openAdd(ds){
  const g=firstGap(ds,30),when=g!==null?`Next free time ${hm(g)}`:"Pick a time",t=S.qaTitle;
  sheet("Add",`<div class="in"><h3>Add to ${esc(dayWord(ds))}</h3>${t?`<p class="hint">"${esc(t)}"</p>`:""}<div class="addc">
    <button type="button" data-addk="block" data-addday="${ds}">${ic("clock")}<b>Time block or event</b><span>${esc(when)}</span></button>
    <button type="button" data-addk="task" data-addday="${ds}">${ic("task")}<b>Task</b><span>Planned for ${esc(dayWord(ds))}, no time yet</span></button>
    <button type="button" data-addk="routine">${ic("repeat")}<b>Routine</b><span>Repeats every week</span></button></div>
    <div class="acts"><button class="ghost" type="button" data-sheetx style="flex:1">Cancel</button></div></div>`);
}

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

/* the clock on Home ticks without redrawing anything else */
setInterval(()=>{if(S.view!=="home")return;const n=new Date(),el=$("#dmain"),t=hm(n.getHours()*60+n.getMinutes());if(el&&el.textContent!==t)el.textContent=t},5000);
/* every 30 seconds: keep times live, without moving the page */
setInterval(()=>{applyTint();if($("#sheetRoot").innerHTML||$("#focus"))return;
  if(["qaIn","dNote","dStepIn"].includes(document.activeElement?.id))return;
  if(S.view==="home"||S.view==="hub"||(S.view==="cal"&&(S.zoom==="week"||(S.zoom==="day"&&ymd(S.cur)===todayStr()))))render();else renderNowbar()},30000);

/* ---------- store: cached data shows at once, fresh data follows ---------- */
function applyData(d){
  S.tasks=d.tasks||[];S.blocks=d.blocks||[];S.routines=d.routines||[];S.slots=d.slots||[];S.bills=d.bills||[];
  const st=d.settings||{};S.work={start:st.workStart||"09:00",end:st.workEnd||"16:00"};S.lead=st.leadMin??10;S.morning=st.morning||null;S.billsSeeded=!!st.billsSeeded;
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
    if(!S.billsSeeded)seedBills();
    if(!sheetOpen()&&!["qaIn","dNote","dStepIn"].includes(document.activeElement?.id))render();
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
  <div class="f"><span class="lb">Work sessions</span>${slotsHtml()}</div>
  <div class="f"><span class="lb">Delete buttons</span>${optsHtml("sDel",[["0","Hidden"],["1","Show on tasks and events"]],S.showDel?"1":"0","x")}</div>
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
  $("#sDel").onclick=e=>{const b=e.target.closest("button");if(!b)return;$("#sDel").querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));S.showDel=b.dataset.x==="1";store.set("showDel",S.showDel)};
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
if(!history.state)history.replaceState({base:1},"",location.href);
route(true);
if(!S.cached)status("Loading your planner…");
load();initSW();
})();
