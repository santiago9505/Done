// /js/views/tasks.js
import { state, FINAL_STATUS, save } from '../core/state.js';
import { getCurrentProjectId, getProjectNameById } from '../ui/projects.js';
import {
  escapeHtml,
  fmtDateTime,
  toLocalDatetimeInput,
  parseLocalDatetimeInput,
  subPoints
} from '../core/utils.js';
import { openTaskDialog, closeTask } from './dialog.js';
import { renderBoard } from './board.js';
import { showMega } from '../core/mega.js';
import { randomKillLine } from '../core/humor.js';
import { confettiBurst, successSound } from '../core/effects.js';

export function renderTasksList(){
  const host = document.getElementById('view-tasks'); if(!host) return;

  const q = (document.getElementById('globalSearch')?.value||'').toLowerCase().trim();
    const cols = (state.settings && state.settings.taskListCols) || ['title','status','prio','due','tags','points','project'];
    const labels = {title:'Título', status:'Estado', prio:'Prioridad', due:'Vence', tags:'Tags', points:'Pts', project:'Proyecto'};

  const pid = state.projectFilter;
  const rows = (state.tasks||[])
    .filter(t=> pid==='all' ? true : (pid==='none' ? (t.projectId==null) : t.projectId===pid))
    .filter(t=> !q || t.title.toLowerCase().includes(q) || (t.desc||'').toLowerCase().includes(q) || (t.tags||[]).join(' ').toLowerCase().includes(q))
    .sort((a,b)=> (a.updated||0) < (b.updated||0)?1:-1);

  host.innerHTML = `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
      <h3 class="h">Lista de tareas (${rows.length})</h3>
      <div class="r" style="gap:10px">
        <label>Agrupar por:</label>
        <select id="groupTasksSel">
          <option value="none" ${state.groupTasks==='none'?'selected':''}>Nada</option>
          <option value="tag" ${state.groupTasks==='tag'?'selected':''}>Tag</option>
        </select>
        <button class="btn primary" id="btnNewTaskTable">+ Nueva</button>
      </div>
    </div>
    <div id="tableHost" style="margin-top:8px"></div>
  </div>`;

  host.querySelector('#groupTasksSel').addEventListener('change',(e)=>{
    state.groupTasks=e.target.value; save(); renderTasksList();
  });
  host.querySelector('#btnNewTaskTable').addEventListener('click',()=>{
    const pid = getCurrentProjectId();
    const init = { status:'To do' };
    if(pid !== undefined) init.projectId = pid;
    openTaskDialog(init);
  });

  function cellHtml(c,t){
    switch(c){
      case 'title':
        return `<td data-open="${t.id}" style="cursor:pointer;text-decoration:underline;padding:8px;border-bottom:1px solid var(--border)">${escapeHtml(t.title)}</td>`;
      case 'status':
        return `<td style="padding:8px;border-bottom:1px solid var(--border)">
          <select data-field="status">${state.columns.map(x=>`<option ${t.status===x?'selected':''}>${x}</option>`).join('')}</select>
        </td>`;
      case 'project':
        return `<td style="padding:8px;border-bottom:1px solid var(--border)">${escapeHtml(getProjectNameById(t.projectId))}</td>`;
      case 'prio':
        return `<td style="padding:8px;border-bottom:1px solid var(--border)">
          <select data-field="prio">
            <option ${t.prio==='Low'?'selected':''}>Low</option>
            <option ${t.prio==='Med'?'selected':''}>Med</option>
            <option ${t.prio==='High'?'selected':''}>High</option>
          </select>
        </td>`;
      case 'due':
        return `<td style="padding:8px;border-bottom:1px solid var(--border)">
          <input type="datetime-local" data-field="due" value="${t.due ? toLocalDatetimeInput(t.due) : ''}"/>
        </td>`;
      case 'tags':
        return `<td style="padding:8px;border-bottom:1px solid var(--border)">${(t.tags||[]).map(x=>'<span class="tag">#'+escapeHtml(x)+'</span>').join('')}</td>`;
      case 'points':
        return `<td style="padding:8px;border-bottom:1px solid var(--border)">
          <input type="number" min="0" step="1" data-field="points" value="${t.points||0}" style="width:80px" ${(t.subtasks&&t.subtasks.length)?'disabled title="Sumado desde subtareas"':''}/>
        </td>`;
      default:
        return `<td style="padding:8px;border-bottom:1px solid var(--border)"></td>`;
    }
  }

  function renderSubTable(t){
    if(!t.subtasks || !t.subtasks.length){
      return `<details><summary style="color:var(--muted)">Subtareas</summary><div style="color:var(--muted);padding:6px 0">Sin subtareas</div></details>`;
    }
    const doneCount = t.subtasks.filter(s=>s.done||s.status===FINAL_STATUS).length;
    return `<details><summary>Subtareas (${doneCount}/${t.subtasks.length})</summary>
      <div style="padding:6px 0;display:grid;gap:6px">
        ${t.subtasks.map(st=>`<div class="sub-row">
          <input type="checkbox" ${st.done||st.status===FINAL_STATUS?'checked':''} data-stcheck="${t.id}:${st.id}"/>
          <span data-open-sub="${t.id}:${st.id}" style="cursor:pointer;text-decoration:underline">${escapeHtml(st.title)}</span>
          <span class="chip">${st.points||0}pt</span>
          ${st.due?`<span class="chip">${fmtDateTime(st.due)}</span>`:''}
        </div>`).join('')}
      </div>
    </details>`;
  }

  function tableFor(list){
    return `<div style="overflow:auto; max-height:70vh">
      <table class="grid" style="width:100%">
        <thead><tr>${cols.map(c=>`<th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">${labels[c]||c}</th>`).join('')}<th style="width:80px"></th></tr></thead>
        <tbody>
          ${list.map(t=>`<tr data-id="${t.id}">
            ${cols.map(c=>cellHtml(c,t)).join('')}
            <td style="padding:8px;border-bottom:1px solid var(--border)"><button class="btn ghost" data-addsub="${t.id}" title="Añadir subtarea">＋</button></td>
          </tr>
          <tr><td colspan="${cols.length+1}" style="padding:0 8px 8px 24px;border-bottom:1px solid var(--border)">${renderSubTable(t)}</td></tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  }

  const tableHost = host.querySelector('#tableHost');
  if(state.groupTasks==='tag'){
    const byTag = new Map();
    rows.forEach(t=>{ const tg=(t.tags&&t.tags.length?t.tags[0]:'No tag'); if(!byTag.has(tg)) byTag.set(tg,[]); byTag.get(tg).push(t); });
    tableHost.innerHTML = Array.from(byTag.entries()).map(([tg,list])=> `<div class="card" style="margin-top:8px"><h3 class="h">#${tg}</h3>${tableFor(list)}</div>`).join('');
  }else{
    tableHost.innerHTML = tableFor(rows);
  }

  // Abrir tarea desde la celda título
  host.querySelectorAll('[data-open]').forEach(el=> el.addEventListener('click', ()=>{
    const id=el.dataset.open; const t=(state.tasks||[]).find(x=>x.id===id); if(t) openTaskDialog(t);
  }));

  // Añadir subtarea
  host.querySelectorAll('[data-addsub]').forEach(b=> b.addEventListener('click',()=>{
    const id=b.dataset.addsub; const t=(state.tasks||[]).find(x=>x.id===id); if(t) openTaskDialog({status:'To do', isSub:true, parentId:t.id});
  }));

  // Edición inline de fila
  host.querySelectorAll('select[data-field], input[data-field]').forEach(el=>{
    el.addEventListener('change', ()=>{
      const row = el.closest('tr'); if(!row) return;
      const id = row.dataset.id; const t = (state.tasks||[]).find(x=>x.id===id); const f = el.dataset.field; if(!t) return;

      if(f==='status'){
        t.status = el.value;
        if(el.value!==FINAL_STATUS) t.closed=null;
        if(el.value===FINAL_STATUS){ closeTask(id); return; }
      }
      if(f==='prio') t.prio = el.value;
      if(f==='due'){ t.due = el.value ? parseLocalDatetimeInput(el.value) : null; }
      if(f==='points'){ t.points = parseInt(el.value||'0',10); }

      t.updated=Date.now(); save(); renderBoard(); renderTasksList();
    });
  });

  // Checkbox de subtareas
  host.querySelectorAll('[data-stcheck]').forEach(ch=> ch.addEventListener('change', (e)=>{
    const [tid,sid]=e.target.dataset.stcheck.split(':');
    const t=(state.tasks||[]).find(x=>x.id===tid); if(!t) return;
    const st=t.subtasks.find(x=>x.id===sid); if(!st) return;

    st.done = e.target.checked;
    st.status = st.done ? FINAL_STATUS : 'To do';
    t.points = subPoints(t);
    t.updated = Date.now();
    save();
    renderTasksList();
    renderBoard();

    if (st.done) { 
      showMega(randomKillLine());
      confettiBurst();
      successSound();
    }
  }));

  // Abrir subtarea como tarea
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
}



