import { state, FINAL_STATUS, save } from '../core/state.js';
import { escapeHtml, fmtDateTime, isSameDay, displayPoints, subPoints } from '../core/utils.js';
import { refresh } from '../core/bus.js';
import { openTaskDialog, closeTask } from './dialog.js';

export function renderHome(){
  const host=document.getElementById('view-home'); if(!host) return;

  const isToday=t=> t.due && isSameDay(new Date(t.due), new Date());
  const pid = state.projectFilter;
  const pidMatch = t => (pid==='all' ? true : (pid==='none' ? (t.projectId==null) : t.projectId===pid));
  // Aplanar tareas + subtareas para Home
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

  const left=`<div class="card"><h3 class="h">My Work</h3>
    <div style="margin:6px 0 10px 0;display:flex;gap:16px">
      <div><b>Today</b> <span class="chip">${todayList.length}</span></div>
      <div><b>Overdue</b> <span class="chip">${overdueList.length}</span></div>
    </div>
    ${['Today','Overdue'].map(sec=>{
      const list = sec==='Today'? todayList : overdueList;
      return `<div style="margin-top:6px"><div style="font-weight:700;margin-bottom:6px">${sec}</div>
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
          const openAttr = isSub ? `data-open-sub="${t.id}:${st.id}"` : `data-open="${t.id}"`;
          const closeBtn = it.status!==FINAL_STATUS ? (isSub ? `<button class="btn success" data-close-sub="${t.id}:${st.id}">✔</button>` : `<button class="btn success" data-close="${t.id}">✔</button>`) : '';
          return `<div class="task" style="cursor:default;${indent}">
            <header><h4 ${openAttr}>${escapeHtml(title)}</h4>
              <div class="icons">${closeBtn}</div>
            </header>
            <div class="meta">
              <span class="pill ${prio==='High'?'prio-high':prio==='Med'?'prio-med':'prio-low'}">${prio}</span>
              ${due?`<span class="pill ${(due < now)?'overdue':''}">📅 ${fmtDateTime(due)}</span>`:''}
              <span class="pill">🧮 ${pts}pt</span>
              ${tags.map(x=>`<span class="pill">#${escapeHtml(x)}</span>`).join('')}
            </div>
          </div>`
        }).join('')}
      </div>`;
    }).join('')}
  </div>`;

  const hours=[...Array(13)].map((_,i)=> i+8);
  const events = items
    .filter(it=> it.due && isToday({due:it.due}))
    .map(it=>({it,start:new Date(it.due).getHours()+new Date(it.due).getMinutes()/60}));
  const right=`<div class="card"><h3 class="h">Calendar — ${new Date().toLocaleDateString()}</h3>
    <div style="display:grid;grid-template-columns:80px 1fr;gap:8px;max-height:70vh;overflow:auto">
      <div>${hours.map(h=>`<div style="height:48px;color:var(--muted)">${(h%12)||12}${h<12?'am':'pm'}</div>`).join('')}</div>
      <div style="position:relative;border-left:1px solid var(--border)">
        ${events.map(e=>{
          const top=(e.start-8)*48; const it=e.it; const t=it.t; const st=it.st; const isSub=it.kind==='sub';
          const title = isSub ? st.title : t.title;
          const openAttr = isSub ? `data-open-sub="${t.id}:${st.id}"` : `data-open="${t.id}"`;
          return `<div class="task" style="position:absolute;left:8px;right:8px;top:${top}px"><header><h4 ${openAttr}>${escapeHtml(title)}</h4></header><div class="meta"><span class="pill">${fmtDateTime(it.due).split(' ')[1]}</span></div></div>`
        }).join('')}
      </div>
    </div>
  </div>`;

  host.innerHTML = `<div class="view-flex">${left}${right}</div>`;

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

