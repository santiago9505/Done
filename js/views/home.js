import { state, FINAL_STATUS } from '../core/state.js';
import { escapeHtml, fmtDateTime, isSameDay, overdue, displayPoints } from '../core/utils.js';
import { refresh } from '../core/bus.js';
import { openTaskDialog, closeTask } from './dialog.js';

export function renderHome(){
  const host=document.getElementById('view-home'); if(!host) return;

  const isToday=t=> t.due && isSameDay(new Date(t.due), new Date());
  const pid = state.projectFilter;
  const pidMatch = t => (pid==='all' ? true : (pid==='none' ? (t.projectId==null) : t.projectId===pid));
  const overdueList=(state.tasks||[])
    .filter(pidMatch)
    .filter(t=>t.status!==FINAL_STATUS && t.due && t.due< Date.now())
    .sort((a,b)=>a.due-b.due);
  const now = Date.now();
  const todayList=(state.tasks||[])
    .filter(pidMatch)
    .filter(t=> t.status!==FINAL_STATUS && isToday(t) && t.due >= now)
    .sort((a,b)=>a.due-b.due);

  const left=`<div class="card"><h3 class="h">My Work</h3>
    <div style="margin:6px 0 10px 0;display:flex;gap:16px">
      <div><b>Today</b> <span class="chip">${todayList.length}</span></div>
      <div><b>Overdue</b> <span class="chip">${overdueList.length}</span></div>
    </div>
    ${['Today','Overdue'].map(sec=>{
      const list = sec==='Today'? todayList : overdueList;
      return `<div style="margin-top:6px"><div style="font-weight:700;margin-bottom:6px">${sec}</div>
        ${list.map(t=>`<div class="task" style="cursor:default">
          <header><h4 data-open="${t.id}">${escapeHtml(t.title)}</h4>
            <div class="icons">${t.status!==FINAL_STATUS?`<button class="btn success" data-close="${t.id}">✔</button>`:''}</div>
          </header>
          <div class="meta">
            <span class="pill ${t.prio==='High'?'prio-high':t.prio==='Med'?'prio-med':'prio-low'}">${t.prio||'Med'}</span>
            ${t.due?`<span class="pill ${overdue(t)?'overdue':''}">📅 ${fmtDateTime(t.due)}</span>`:''}
            <span class="pill">🧮 ${displayPoints(t)}pt</span>
            ${(t.tags||[]).slice(0,3).map(x=>`<span class="pill">#${escapeHtml(x)}</span>`).join('')}
          </div>
        </div>`).join('')}
      </div>`;
    }).join('')}
  </div>`;

  const hours=[...Array(13)].map((_,i)=> i+8);
  const events = (state.tasks||[])
    .filter(pidMatch)
    .filter(t=> t.due && isToday(t))
    .map(t=>({t,start:new Date(t.due).getHours()+new Date(t.due).getMinutes()/60}));
  const right=`<div class="card"><h3 class="h">Calendar — ${new Date().toLocaleDateString()}</h3>
    <div style="display:grid;grid-template-columns:80px 1fr;gap:8px;max-height:70vh;overflow:auto">
      <div>${hours.map(h=>`<div style="height:48px;color:var(--muted)">${(h%12)||12}${h<12?'am':'pm'}</div>`).join('')}</div>
      <div style="position:relative;border-left:1px solid var(--border)">
        ${events.map(e=>{
          const top=(e.start-8)*48;
          return `<div class="task" style="position:absolute;left:8px;right:8px;top:${top}px"><header><h4 data-open="${e.t.id}">${escapeHtml(e.t.title)}</h4></header><div class="meta"><span class="pill">${fmtDateTime(e.t.due).split(' ')[1]}</span></div></div>`
        }).join('')}
      </div>
    </div>
  </div>`;

  host.innerHTML = `<div class="view-flex">${left}${right}</div>`;

  host.querySelectorAll('[data-open]').forEach(x=> x.addEventListener('click', ()=>{
    const id=x.dataset.open; const t=(state.tasks||[]).find(tt=>tt.id===id); if(t) openTaskDialog(t);
  }));
  host.querySelectorAll('[data-close]').forEach(x=> x.addEventListener('click', ()=> closeTask(x.dataset.close)));

  refresh.board();
}

