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
import { refresh } from '../core/bus.js';

// Estado UI local: tareas colapsadas en la lista (no se persiste)
const collapsed = new Set();

// Duración mínima por defecto (30 min) para evitar eventos de altura 0 en el calendario
const DEFAULT_TASK_DURATION_MS = 30 * 60 * 1000;

// Normaliza rango startAt/due asegurando duración mínima y sincroniza aliases usados por el calendario
function ensureTimeRange(taskLike){
  if(taskLike.startAt){
    if(!taskLike.due){
      taskLike.due = taskLike.startAt + DEFAULT_TASK_DURATION_MS;
    }else if(taskLike.due <= taskLike.startAt){
      taskLike.due = taskLike.startAt + DEFAULT_TASK_DURATION_MS;
    }
  }
  // Sincroniza campos alternativos que puede leer el calendario
  if(taskLike.startAt) taskLike.start = taskLike.startAt;
  if(taskLike.due){
    taskLike.endAt = taskLike.due;
    taskLike.end = taskLike.due;
  }
}

// Migra todas las tareas existentes (ejecutado al render)
function normalizeAllTaskTimeRanges(){
  (state.tasks||[]).forEach(t=>{
    ensureTimeRange(t);
    (t.subtasks||[]).forEach(st=> ensureTimeRange(st));
  });
}

// Recupera proyectos perdidos a partir de las tareas
function ensureProjectsFromTasks(){
  if(!Array.isArray(state.projects)) state.projects = [];
  const existingIds = new Set(state.projects.map(p=>p.id));
  const taskProjectIds = new Set(
    (state.tasks||[])
      .filter(t=> t.projectId!=null)
      .map(t=> t.projectId)
  );
  if(!taskProjectIds.size) return;
  const palette = ['#06b6d4','#6366f1','#ec4899','#84cc16','#0ea5e9','#a855f7','#14b8a6','#f472b6'];
  let added = false;
  let i = 0;
  taskProjectIds.forEach(pid=>{
    if(!existingIds.has(pid)){
      const niceName = pid
        .replace(/[-_]+/g,' ')
        .replace(/\s+/g,' ')
        .trim()
        .replace(/\b\w/g, c=>c.toUpperCase());
      state.projects.push({
        id: pid,
        name: niceName,          // sin emoji extra
        color: palette[i++ % palette.length],
        created: Date.now()
      });
      added = true;
    }
  });
  if(added) save();
}

// Seed inicial de proyectos (solo si no hay ninguno)
function seedDefaultProjects(){
  if(Array.isArray(state.projects) && state.projects.length) return;
  state.projects = [
    { id:'trading-finances', name:'💹 Trading & Finances', color:'#3b82f6', created:Date.now() },
    { id:'work',              name:'💼 Work',              color:'#8b5cf6', created:Date.now() },
    { id:'personal-branding', name:'🌟 Personal Branding', color:'#10b981', created:Date.now() },
    { id:'health-wellness',   name:'🏋️‍♂️ Health & Wellness', color:'#f59e0b', created:Date.now() },
    { id:'family-personal',   name:'👨‍👩‍👧‍👦 Family & Personal', color:'#ef4444', created:Date.now() },
  ];
  save();
}

export function renderTasksList(){
  seedDefaultProjects();      // NUEVO
  ensureProjectsFromTasks();  // existente (ahora después del seed)
  const host = document.getElementById('view-tasks'); if(!host) return;
  normalizeAllTaskTimeRanges(); // NUEVO: garantiza datos consistentes antes de render

  const q = (document.getElementById('globalSearch')?.value||'').toLowerCase().trim();
  const cols = (state.settings && state.settings.taskListCols) || ['title','status','prio','start','due','tags','points','project'];
  const labels = {title:'Título', status:'Estado', prio:'Prioridad', start:'Inicio', due:'Vence', tags:'Tags', points:'Pts', project:'Proyecto'};

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

  function cellHtml(c,t,st){
    const isSub = !!st;
    switch(c){
          case 'title':{
            const base = 'padding:8px;border-bottom:1px solid var(--border)';
            if(isSub){
              return `<td data-open-sub="${t.id}:${st.id}" style="${base};padding-left:24px;cursor:pointer;text-decoration:underline">${escapeHtml(st.title)}</td>`;
            }
            const hasSubs = Array.isArray(t.subtasks) && t.subtasks.length>0;
            const arrow = hasSubs ? (collapsed.has(t.id) ? '▸' : '▾') : '';
            const arrowHtml = hasSubs ? `<span data-toggle="${t.id}" title="Mostrar/ocultar subtareas" style="display:inline-block;width:16px;text-align:center;margin-right:6px;cursor:pointer;user-select:none">${arrow}</span>` : '';
            return `<td data-open="${t.id}" style="${base};cursor:pointer;text-decoration:underline">${arrowHtml}<span>${escapeHtml(t.title)}</span></td>`;
          }
          case 'status':{
            const val = isSub ? (st.status || (st.done?FINAL_STATUS:'To do')) : t.status;
            const dataSub = isSub ? `data-sub="${t.id}:${st.id}"` : '';
            return `<td style="padding:8px;border-bottom:1px solid var(--border)">
              <select data-field="status" ${dataSub}>${state.columns.map(x=>`<option ${val===x?'selected':''}>${x}</option>`).join('')}</select>
            </td>`;
          }
          case 'project':{
            return `<td style="padding:8px;border-bottom:1px solid var(--border)">${escapeHtml(getProjectNameById(t.projectId))}</td>`;
          }
          case 'prio':{
            if(isSub){
              return `<td style="padding:8px;border-bottom:1px solid var(--border)"><span class="chip">${t.prio||'Med'}</span></td>`;
            }
            return `<td style="padding:8px;border-bottom:1px solid var(--border)">
              <select data-field="prio">
                <option ${t.prio==='Low'?'selected':''}>Low</option>
                <option ${t.prio==='Med'?'selected':''}>Med</option>
                <option ${t.prio==='High'?'selected':''}>High</option>
              </select>
            </td>`;
          }
          case 'start':{
            const val = isSub ? (st.startAt||null) : (t.startAt||null);
            const dataSub = isSub ? `data-sub="${t.id}:${st.id}"` : '';
            return `<td style="padding:8px;border-bottom:1px solid var(--border)">
              <input type="datetime-local" data-field="start" ${dataSub} value="${val ? toLocalDatetimeInput(val) : ''}"/>
            </td>`;
          }
          case 'due':{
            const val = isSub ? (st.due||null) : (t.due||null);
            const dataSub = isSub ? `data-sub="${t.id}:${st.id}"` : '';
            return `<td style="padding:8px;border-bottom:1px solid var(--border)">
              <input type="datetime-local" data-field="due" ${dataSub} value="${val ? toLocalDatetimeInput(val) : ''}"/>
            </td>`;
          }
          case 'tags':{
            const tags = (t.tags||[]);
            return `<td style="padding:8px;border-bottom:1px solid var(--border)">${tags.map(x=>'<span class="tag">#'+escapeHtml(x)+'</span>').join('')}</td>`;
          }
          case 'points':{
            const canEditParent = !(t.subtasks&&t.subtasks.length);
            const value = isSub ? (st.points||0) : (t.points||0);
            const dataSub = isSub ? `data-sub="${t.id}:${st.id}"` : '';
            const disabled = isSub ? '' : (canEditParent? '' : 'disabled title="Sumado desde subtareas"');
            return `<td style="padding:8px;border-bottom:1px solid var(--border)">
              <input type="number" min="0" step="1" data-field="points" ${dataSub} value="${value}" style="width:80px" ${disabled}/>
            </td>`;
          }
          default:
            return `<td style="padding:8px;border-bottom:1px solid var(--border)"></td>`;
        }
  }

  function renderSubTable(t){
    // Subtareas se mostrarán como filas completas debajo de su tarea
  }

  function tableFor(list){
    return `<div style="overflow:auto; max-height:70vh">
      <table class="grid" style="width:100%">
        <thead><tr>${cols.map(c=>`<th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">${labels[c]||c}</th>`).join('')}<th style="width:80px"></th></tr></thead>
        <tbody>
          ${list.map(t=>{
            const taskRow = `<tr data-id="${t.id}">
              ${cols.map(c=>cellHtml(c,t,null)).join('')}
              <td style="padding:8px;border-bottom:1px solid var(--border)"><button class="btn ghost" data-addsub="${t.id}" title="Añadir subtarea">＋</button></td>
            </tr>`;
            const isCollapsed = collapsed.has(t.id);
            const subRows = isCollapsed ? '' : (t.subtasks||[]).map(st=>`
              <tr data-id="${t.id}" data-sub="${t.id}:${st.id}">
                ${cols.map(c=>cellHtml(c,t,st)).join('')}
                <td style="padding:8px;border-bottom:1px solid var(--border)"></td>
              </tr>
            `).join('');
            return taskRow + subRows;
          }).join('')}
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

  // Toggle mostrar/ocultar subtareas
  host.querySelectorAll('[data-toggle]').forEach(el=> el.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    const id = el.dataset.toggle;
    if(collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
    renderTasksList();
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
  const sub = el.getAttribute('data-sub');

      if(sub){
        const [tid,sid]=sub.split(':'); if(tid!==t.id) return;
        const st=t.subtasks.find(s=>s.id===sid); if(!st) return;
        if(f==='status'){
          const wasDone = st.status===FINAL_STATUS || st.done;
          st.status = el.value;
          st.done = (el.value===FINAL_STATUS);
          if(!wasDone && st.done){ showMega(randomKillLine()); confettiBurst(); successSound(); }
        }
        if(f==='start'){
          st.startAt = el.value ? parseLocalDatetimeInput(el.value) : null;
          ensureTimeRange(st);
        }
        if(f==='due'){
          st.due = el.value ? parseLocalDatetimeInput(el.value) : null;
          ensureTimeRange(st);
        }
        // Asegura propagación de actualización parent para sumar puntos y refrescar
        t.points = subPoints(t);
        t.updated=Date.now(); save(); renderBoard(); renderTasksList(); refresh.home();
        return;
      }

      if(f==='status'){
        t.status = el.value;
        if(el.value!==FINAL_STATUS) t.closed=null;
        if(el.value===FINAL_STATUS){ closeTask(id); return; }
      }
      if(f==='prio') t.prio = el.value;
  if(f==='start'){
    t.startAt = el.value ? parseLocalDatetimeInput(el.value) : null;
    ensureTimeRange(t);
  }
  if(f==='due'){
    t.due = el.value ? parseLocalDatetimeInput(el.value) : null;
    ensureTimeRange(t);
  }
      if(f==='points'){ t.points = parseInt(el.value||'0',10); }

      t.updated=Date.now(); save(); renderBoard(); renderTasksList(); refresh.home();
    });
  });

  // (Eliminado) Checkbox de subtareas: ahora se editan como filas completas

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

  patchBoardStartDates();
  scheduleStartPills(); // en lugar de ensureStartPills directa + observer
}

// --- reemplazado: sin observer, solo funciones limpias ---
function patchBoardStartDates(){
  const cards = document.querySelectorAll('.board .task[data-id]');
  if(!cards.length) return;
  cards.forEach(el=>{
    const id = el.dataset.id;
    const t = (state.tasks||[]).find(x=>x.id===id);
    if(t && t.startAt){
      const d = new Date(t.startAt);
      const val = d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'});
      // Solo set si cambia
      if(el.getAttribute('data-start') !== val){
        el.setAttribute('data-start', val);
      }
    }else if(el.hasAttribute('data-start')){
      el.removeAttribute('data-start');
    }
  });
}

let __startPillScheduled = false;
function scheduleStartPills(){
  if(__startPillScheduled) return;
  __startPillScheduled = true;
  requestAnimationFrame(()=>{
    ensureStartPills();
    __startPillScheduled = false;
  });
}

function ensureStartPills(){
  const cards = document.querySelectorAll('.board .task[data-id]');
  if(!cards.length) return;
  cards.forEach(el=>{
    const id = el.dataset.id;
    const t = (state.tasks||[]).find(x=>x.id===id);
    const meta = el.querySelector('.meta');
    if(!meta) return;
    const existing = meta.querySelector('.start-pill');
    if(t && t.startAt){
      const d = new Date(t.startAt);
      const label = d.toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit'});
      if(!existing){
        const span = document.createElement('span');
        span.className = 'pill start-pill';
        span.textContent = label;
        span.dataset.label = label;
        meta.prepend(span);
      }else if(existing.dataset.label !== label){
        existing.textContent = label;
        existing.dataset.label = label;
      }
    }else if(existing){
      existing.remove();
    }
  });
}

// --- eliminado el MutationObserver (loop) ---



