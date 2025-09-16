import { state, FINAL_STATUS, save } from '../core/state.js';
import { escapeHtml, fmtDateTime, isSameDay, displayPoints, subPoints } from '../core/utils.js';
import { refresh } from '../core/bus.js';
import { openTaskDialog, closeTask } from './dialog.js';

export function renderHome(){
  const host=document.getElementById('view-home'); if(!host) return;
  host.innerHTML='';
  const isToday=t=> t.due && isSameDay(new Date(t.due), new Date());
  const pid = state.projectFilter;
  const pidMatch = t => (pid==='all' ? true : (pid==='none' ? (t.projectId==null) : t.projectId===pid));
  // Aplanar tareas + subtareas
  const items = [];
  (state.tasks||[]).filter(pidMatch).forEach(t=>{
    items.push({ kind:'task', t, due:t.due||null, status:t.status, overdue: t.due && t.due < Date.now() });
    (t.subtasks||[]).forEach(st=>{
      const stStatus = st.status || (st.done? FINAL_STATUS : 'To do');
      items.push({ kind:'sub', t, st, due: st.due||null, status: stStatus, overdue: st.due && st.due < Date.now() });
    });
  });
  const now = Date.now();
  const overdueList = items
    .filter(it=> it.status!==FINAL_STATUS && it.due && it.due < now)
    .sort((a,b)=> a.due - b.due);
  const todayList = items
    .filter(it=> it.status!==FINAL_STATUS && it.due && isToday({due:it.due}) && it.due >= now)
    .sort((a,b)=> a.due - b.due);

  // Buckets: Today / Tomorrow / This week
  const d = new Date(); const todayStr = d.toDateString();
  const tomorrowStr = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1).toDateString();
  const endOfWeek = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (7 - d.getDay()));
  const bucket = (it)=>{
    if(!it.due) return 'Sin fecha';
    const ds = new Date(it.due).toDateString();
    if(ds===todayStr && it.due>=now) return 'Hoy';
    if(ds===tomorrowStr) return 'Mañana';
    if(new Date(it.due) <= endOfWeek) return 'Esta semana';
    return 'Próximas';
  };
  const groups = new Map();
  items.filter(it=> state.settings?.showClosed ? true : (it.status!==FINAL_STATUS)).forEach(it=>{
    const g = bucket(it); if(!groups.has(g)) groups.set(g, []); groups.get(g).push(it);
  });
  groups.forEach(list=> list.sort((a,b)=> (a.due||Infinity) - (b.due||Infinity)));

  // KPI y recomendación (AI-lite)
  const kpiToday = todayList.length; const kpiOver = overdueList.length;
  const kpiMeet = items.filter(it=> it.due && isToday({due:it.due})).length;
  const prioVal = (p)=> p==='High'?3 : p==='Med'?2 : 1;
  const scored = items.filter(it=> it.status!==FINAL_STATUS).map(it=>{
    const p = prioVal(it.t.prio||'Med'); const dd = it.due? Math.abs(it.due - now) : 10*24*3600*1000;
    const late = it.due && it.due < now ? 1 : 0;
    const score = late*1000 + p*100 + (1/(dd+1));
    return {it, score};
  }).sort((a,b)=> b.score - a.score);
  const top = scored[0]?.it;
  const reco = top ? `Tu tarea clave: ${escapeHtml(top.st? top.st.title : top.t.title)} — intenta completarla antes de ${top.due? fmtDateTime(top.due).split(' ')[1] : 'fin del día'}` : 'Sin recomendaciones por ahora';

  // UI
  const focusPanel = `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <h3 class="h">Hoy, enfócate en…</h3>
        <label class="r" style="gap:6px"><input type="checkbox" id="toggleClosedHome" ${state.settings?.showClosed?'checked':''}/> Mostrar cerradas</label>
      </div>
      <div class="r" style="gap:8px;flex-wrap:wrap;margin:6px 0 8px 0">
        <span class="chip">Hoy: ${kpiToday}</span>
        <span class="chip">Atrasadas: ${kpiOver}</span>
        <span class="chip">Reuniones: ${kpiMeet}</span>
      </div>
      <div style="color:var(--muted)">${reco}</div>
    </div>`;

  const left=`${focusPanel}<div class="card"><h3 class="h">My Work</h3>
    ${overdueList.length?`<div style="margin-top:6px"><div style="font-weight:700;margin-bottom:6px">Overdue</div>
      ${overdueList.map(it=>{
        const t=it.t; const st=it.st; const isSub=it.kind==='sub';
        const title=isSub?st.title:t.title; const prio=t.prio||'Med'; const due=it.due; const pts=isSub?(parseInt(st.points||'0',10)||0):displayPoints(t);
        const tags=(t.tags||[]).slice(0,3); const indent=isSub?'padding-left:18px':'';
        const openAttr = isSub ? `data-open-sub="${t.id}:${st.id}"` : `data-open="${t.id}"`;
        const closeBtn = isSub ? `<button class="btn success" data-close-sub="${t.id}:${st.id}">✔</button>` : `<button class="btn success" data-close="${t.id}">✔</button>`;
        return `<div class="task over" style="cursor:default;${indent};background:rgba(248,113,113,.08);border-style:dashed;border-color:rgba(248,113,113,.25)">
          <header><h4 ${openAttr}>${escapeHtml(title)}</h4><div class="icons">${closeBtn}</div></header>
          <div class="meta">
            <span class="pill ${prio==='High'?'prio-high':prio==='Med'?'prio-med':'prio-low'}">${prio}</span>
            ${due?`<span class="pill overdue">⏰ ${fmtDateTime(due)}</span>`:''}
            <span class="pill">🧮 ${pts}pt</span>
            ${tags.map(x=>`<span class="pill">#${escapeHtml(x)}</span>`).join('')}
          </div>
        </div>`;
      }).join('')}</div>`:''}
    ${['Hoy','Mañana','Esta semana','Próximas','Sin fecha'].map(sec=>{
      const list = groups.get(sec)||[];
      if(!list.length) return '';
      const sectionHeader = sec==='Hoy'? 'Today' : sec;
      return `<div style="margin-top:6px"><div style="font-weight:700;margin-bottom:6px">${sectionHeader}</div>
        ${list.map(it=>{
          const t = it.t;
          const st = it.st;
          const isSub = it.kind==='sub';
          const title = isSub ? st.title : t.title;
          const prio = t.prio || 'Med';
          const due = it.due;
          const pts = isSub ? (parseInt(st.points||'0',10)||0) : displayPoints(t);
          const tags = (t.tags||[]).slice(0,3);
          const indent = isSub ? 'padding-left:18px' : '';
          const totalSubs=(t.subtasks||[]).length; const doneSubs=(t.subtasks||[]).filter(s=>s.done||s.status===FINAL_STATUS).length;
          const prog = totalSubs? Math.round((doneSubs/totalSubs)*100) : 0;
          const openAttr = isSub ? `data-open-sub="${t.id}:${st.id}"` : `data-open="${t.id}"`;
          const isClosed = it.status===FINAL_STATUS;
          const closeBtn = !isClosed ? (isSub ? `<button class="btn success" data-close-sub="${t.id}:${st.id}">✔</button>` : `<button class="btn success" data-close="${t.id}">✔</button>`) : '';
          return `<div class="task ${it.overdue?'over':''} ${isClosed?'closed':''}" style="cursor:default;${indent};${it.overdue?'background:rgba(248,113,113,.08);border-style:dashed;border-color:rgba(248,113,113,.25)':''}">
            <header><h4 ${openAttr}>${escapeHtml(title)}</h4>
              <div class="icons">${closeBtn}</div>
            </header>
            <div class="meta">
              <span class="pill ${prio==='High'?'prio-high':prio==='Med'?'prio-med':'prio-low'}">${prio}</span>
              ${due?`<span class="pill ${(due < now)?'overdue':''}">📅 ${fmtDateTime(due)}</span>`:''}
              <span class="pill">🧮 ${pts}pt</span>
              ${tags.map(x=>`<span class="pill">#${escapeHtml(x)}</span>`).join('')}
            </div>
            ${totalSubs?`<div style="height:4px;background:var(--border);border-radius:999px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${prog}%;background:linear-gradient(90deg,var(--primary),var(--accent))"></div></div>`:''}
          </div>`
        }).join('')}
      </div>`;
    }).join('')}
  </div>`;

  const hours=[...Array(13)].map((_,i)=> i+8);
  // Construir eventos usando startAt/endAt, con fallback a due; incluir si startAt es hoy
  const events = items
    .filter(it=>{
      const s = it.kind==='sub' ? (it.st.startAt||null) : (it.t.startAt||null);
      const isClosed = it.status===FINAL_STATUS;
      const closedOk = state.settings?.showClosed ? true : !isClosed;
      return s && closedOk && isSameDay(new Date(s), new Date());
    })
    .map(it=>{
      const s = it.kind==='sub' ? (it.st.startAt||null) : (it.t.startAt||null);
      let e = it.kind==='sub' ? (it.st.endAt || it.st.due || null) : (it.t.endAt || it.t.due || null);
      const defaultDurMs = 45*60*1000; // 45 min por defecto
      if(!e){ e = s + defaultDurMs; }
      const durationHours = Math.max(0.5, (e - s) / 3600000); // mínimo 30 min
      const startFloat = new Date(s).getHours() + (new Date(s).getMinutes()/60);
      return { it, startAt:s, endAt:e, start:startFloat, duration: durationHours };
    });
  const right=`<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h3 class="h">Calendar — ${new Date().toLocaleDateString()}</h3>
      <label class="r" style="gap:6px"><input type="checkbox" id="toggleClosedCal" ${state.settings?.showClosed?'checked':''}/> Mostrar cerradas</label>
    </div>
    <div style="display:grid;grid-template-columns:80px 1fr;gap:8px;max-height:70vh;overflow:auto">
      <div>${hours.map(h=>`<div style="height:48px;color:var(--muted)">${(h%12)||12}${h<12?'am':'pm'}</div>`).join('')}</div>
      <div id="timeline" style="position:relative;border-left:1px solid var(--border)">
        ${events.map(e=>{
          const top=(e.start-8)*48; const height=Math.max(24, e.duration*48);
          const it=e.it; const t=it.t; const st=it.st; const isSub=it.kind==='sub';
          const title = isSub ? st.title : t.title;
          const openAttr = isSub ? `data-open-sub="${t.id}:${st.id}"` : `data-open="${t.id}"`;
          const dataId = isSub ? `${t.id}:${st.id}` : `${t.id}`;
          const timeLabel = `${fmtDateTime(e.startAt).split(' ')[1]} — ${fmtDateTime(e.endAt).split(' ')[1]}`;
          const isClosed = it.status===FINAL_STATUS;
          return `<div class="task ${isClosed?'closed':''}" draggable="true" data-evt="${dataId}" style="position:absolute;left:8px;right:8px;top:${top}px;height:${height}px"><header><h4 ${openAttr}>${escapeHtml(title)}</h4></header><div class="meta"><span class="pill">${timeLabel}</span></div></div>`
        }).join('')}
        ${hours.map(h=>`<div class="slot" data-hour="${h}" style="position:absolute;left:0;right:0;top:${(h-8)*48}px;height:48px"></div>`).join('')}
      </div>
    </div>
  </div>`;

  host.innerHTML = `<div class="view-flex">${left}${right}</div>`;

  // Toggles de cerradas (Home)
  document.getElementById('toggleClosedHome')?.addEventListener('change', (e)=>{ state.settings.showClosed = !!e.target.checked; save(); renderHome(); });
  document.getElementById('toggleClosedCal')?.addEventListener('change', (e)=>{ state.settings.showClosed = !!e.target.checked; save(); renderHome(); });

  // DnD timeline: mover evento
  const tl = host.querySelector('#timeline');
  let dragging=null;
  tl?.querySelectorAll('[data-evt]')?.forEach(el=>{
    el.addEventListener('dragstart', ()=>{ dragging = el.getAttribute('data-evt'); });
  });
  tl?.querySelectorAll('.slot')?.forEach(slot=>{
    slot.addEventListener('dragover', e=> e.preventDefault());
    slot.addEventListener('drop', (e)=>{
      e.preventDefault(); if(!dragging) return; const hour=parseInt(slot.getAttribute('data-hour'),10);
      const [tid,sid] = dragging.includes(':')? dragging.split(':') : [dragging,null];
      const t=(state.tasks||[]).find(x=>x.id===tid); if(!t) return;
      const base = new Date(); base.setHours(hour, 0, 0, 0);
      const baseTs = base.getTime();
      if(sid){
        const st=t.subtasks.find(s=>s.id===sid); if(!st) return;
        const sOld = st.startAt || baseTs;
        const eOld = st.endAt || st.due || (sOld + 45*60*1000);
        const dur = Math.max(30*60*1000, eOld - sOld);
        st.startAt = baseTs;
        st.endAt = baseTs + dur;
        st.due = st.endAt;
      } else {
        const sOld = t.startAt || baseTs;
        const eOld = t.endAt || t.due || (sOld + 45*60*1000);
        const dur = Math.max(30*60*1000, eOld - sOld);
        t.startAt = baseTs;
        t.endAt = baseTs + dur;
        t.due = t.endAt;
      }
      save(); renderHome(); refresh.board(); refresh.tasks && refresh.tasks();
    });
    slot.addEventListener('click', ()=>{
      const hour=parseInt(slot.getAttribute('data-hour'),10);
      const base = new Date(); base.setHours(hour, 0, 0, 0);
      const startTs = base.getTime();
      const endTs = startTs + 45*60*1000;
      openTaskDialog({status:'To do', startAt: startTs, due: endTs, endAt: endTs});
    });
  });

  host.querySelectorAll('[data-open]').forEach(x=> x.addEventListener('click', ()=>{
    const id=x.dataset.open; const t=(state.tasks||[]).find(tt=>tt.id===id); if(t) openTaskDialog(t);
  }));
  host.querySelectorAll('[data-open-sub]').forEach(el=> el.addEventListener('click', ()=>{
    const [tid,sid]=el.dataset.openSub.split(':');
    const t=(state.tasks||[]).find(x=>x.id===tid); if(!t) return;
    const st=t.subtasks.find(x=>x.id===sid); if(!st) return;
    openTaskDialog({
      id:st.id, title:st.title, desc:st.desc||'',
      prio:t.prio, due:st.due||null, tags:[...(t.tags||[])],
      status:(st.status|| (st.done?FINAL_STATUS:'To do')),
      created:t.created, updated:Date.now(), closed:st.done?Date.now():null,
      docIds:[], points:st.points||1, subtasks:[],
      recur:{type:'none', every:1, trigger:'complete', skipWeekends:false, createNew:true, forever:true, nextStatus:'To do'},
      isSub:true, parentId: t.id
    });
  }));
  host.querySelectorAll('[data-close]').forEach(x=> x.addEventListener('click', ()=> closeTask(x.dataset.close)));
  host.querySelectorAll('[data-close-sub]').forEach(el=> el.addEventListener('click', ()=>{
    const [tid,sid]=el.dataset.closeSub.split(':');
    const t=(state.tasks||[]).find(x=>x.id===tid); if(!t) return;
    const st=t.subtasks.find(x=>x.id===sid); if(!st) return;
    st.status = FINAL_STATUS; st.done = true; st.updated = Date.now();
    t.points = subPoints(t); t.updated = Date.now(); save();
    renderHome(); refresh.board(); refresh.tasks && refresh.tasks();
  }));

  refresh.board();
}

