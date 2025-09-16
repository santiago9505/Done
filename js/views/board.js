// /js/views/board.js
// Tablero con DnD, agrupación por Estado/Tag y edición inline de subtareas
import { state, save, FINAL_STATUS, findTask } from '../core/state.js';
import {
  escapeHtml, escapeAttr, fmtDateTime, overdue,
  subPoints, displayPoints,
  toLocalDatetimeInput, parseLocalDatetimeInput
} from '../core/utils.js';
import { refresh as busRefresh } from '../core/bus.js';
import { closeTask, openTaskDialog } from './dialog.js';
import { showMega } from '../core/mega.js';
import { randomKillLine } from '../core/humor.js';
import { confettiBurst, successSound } from '../core/effects.js';
import { getCurrentProjectId, getProjectNameById } from '../ui/projects.js';

export function renderBoard(){
  // Dedup por id para evitar rarezas
  const uniq = new Map();
  (state.tasks||[]).forEach(t=>{ if(!uniq.has(t.id)) uniq.set(t.id,t); });
  state.tasks = Array.from(uniq.values()); save();

  const host=document.getElementById('view-board'); if(!host) return;
  // Inject subbar controls and workspace context for this view
  const sub = document.getElementById('subActions');
  if(sub){
    let ctx = '';
    const wf = state.workspaceFilter;
    if(wf !== 'all'){
      const label = (wf==='none') ? 'Sin workspace' : (getProjectNameById?.(wf) || '');
      let emoji = '📁';
      if(wf!=='none'){
        const ws=(state.workspaces||[]).find(w=>w.id===wf);
        if(ws && ws.emoji) emoji = ws.emoji;
      }
      ctx = `<span class="chip" id="wsCtx">${emoji} ${escapeHtml(label)}</span>`;
    }
    sub.innerHTML = `
      ${ctx}
      <label class="r" style="gap:6px"><input type="checkbox" id="sbShowClosed" ${state.settings?.showClosed?'checked':''}/> Mostrar cerradas</label>
      <label>Agrupar:</label>
      <select id="sbGroupBoard">
        <option value="status" ${state.groupBoard==='status'?'selected':''}>Estado</option>
        <option value="prio" ${state.groupBoard==='prio'?'selected':''}>Prioridad</option>
        <option value="workspace" ${state.groupBoard==='workspace'?'selected':''}>Workspace</option>
      </select>
      <button class="btn primary" id="addTaskBoard">+ Nueva</button>
    `;
    sub.querySelector('#sbShowClosed')?.addEventListener('change', (e)=>{ state.settings.showClosed = !!e.target.checked; save(); renderBoard(); });
    sub.querySelector('#sbGroupBoard')?.addEventListener('change', (e)=>{ state.groupBoard = e.target.value; save(); renderBoard(); });
    sub.querySelector('#addTaskBoard')?.addEventListener('click', ()=>{
      const pid = getCurrentProjectId();
      const init = { status:'To do' };
      if(pid !== undefined) init.workspaceId = pid;
      openTaskDialog(init);
    });
  }
  host.innerHTML='';

  // Removed old in-view top controls; subbar now hosts them

  const q=(document.getElementById('globalSearch')?.value||'').toLowerCase().trim();

  if(state.groupBoard==='status'){
    const grid=document.createElement('div');
    grid.className='board';
    grid.style.gridTemplateColumns=`repeat(${state.columns.length}, minmax(260px,1fr))`;

    state.columns.forEach(col=>{
      const colEl=document.createElement('div');
      colEl.className='column';
      colEl.dataset.col=col;

      colEl.innerHTML=`<div class="col-head">
        <div class="col-title">${col}</div>
        <button class="btn ghost" data-add="${col}">+ Nueva</button>
      </div>`;

      const dz=document.createElement('div');
      dz.className='dropzone';
      dz.addEventListener('dragover',e=>{e.preventDefault(); dz.classList.add('drag')});
      dz.addEventListener('dragleave',()=>dz.classList.remove('drag'));
      dz.addEventListener('drop',e=>{
        e.preventDefault(); dz.classList.remove('drag');
        const id=e.dataTransfer.getData('text/plain');
        moveTaskTo(id,col);
      });

  const pid = state.workspaceFilter;
      const tasks=(state.tasks||[])
        .filter(t=>t.status===col)
  .filter(t=> pid==='all' ? true : (pid==='none' ? (t.workspaceId==null) : t.workspaceId===pid))
        .filter(t=> (state.settings?.showClosed ? true : t.status!==FINAL_STATUS))
        .filter(t=> !q || t.title.toLowerCase().includes(q) || (t.desc||'').toLowerCase().includes(q) || (t.tags||[]).join(' ').toLowerCase().includes(q))
        .sort(globalTaskComparator);

      tasks.forEach(t=> dz.appendChild(renderTaskCard(t)));
      colEl.appendChild(dz);
      grid.appendChild(colEl);
    });

    host.appendChild(grid);
    host.querySelectorAll('[data-add]').forEach(b=> b.addEventListener('click', e=>{
      const col = e.currentTarget.getAttribute('data-add');
  const pid = getCurrentProjectId();
      const init = { status:col };
  if(pid !== undefined) init.workspaceId = pid;
      openTaskDialog(init);
    }));
  }else{
    // Agrupar por tag
    const allTags = Array.from(new Set((state.tasks||[]).flatMap(t=>t.tags||[]))).sort();
    const names = ['No tag', ...allTags];

    const grid=document.createElement('div');
    grid.className='board';
    grid.style.gridTemplateColumns=`repeat(${names.length}, minmax(260px,1fr))`;

    names.forEach(tag=>{
      const colEl=document.createElement('div');
      colEl.className='column';
      colEl.dataset.tag=tag;

      colEl.innerHTML=`<div class="col-head">
        <div class="col-title">#${tag}</div>
        <button class="btn ghost" data-addtag="${tag}">+ Nueva</button>
      </div>`;

      const dz=document.createElement('div');
      dz.className='dropzone';
      dz.addEventListener('dragover',e=>{e.preventDefault(); dz.classList.add('drag')});
      dz.addEventListener('dragleave',()=>dz.classList.remove('drag'));
      dz.addEventListener('drop',e=>{
        e.preventDefault(); dz.classList.remove('drag');
        const id=e.dataTransfer.getData('text/plain');
        const t=findTask(id); if(!t) return;
        const val=(tag==='No tag')? [] : [tag, ...(t.tags||[]).filter(x=>x!==tag)];
        t.tags=val; t.updated=Date.now(); save(); renderBoard();
      });

  const pid = state.workspaceFilter;
      const tasks=(state.tasks||[])
        .filter(t=> ((t.tags&&t.tags.includes(tag)) || (tag==='No tag' && (!t.tags || t.tags.length===0))))
  .filter(t=> pid==='all' ? true : (pid==='none' ? (t.workspaceId==null) : t.workspaceId===pid))
        .filter(t=> (state.settings?.showClosed ? true : t.status!==FINAL_STATUS))
        .filter(t=> !q || t.title.toLowerCase().includes(q) || (t.desc||'').toLowerCase().includes(q) || (t.tags||[]).join(' ').toLowerCase().includes(q))
        .sort(globalTaskComparator);

      tasks.forEach(t=> dz.appendChild(renderTaskCard(t)));
      colEl.appendChild(dz);
      grid.appendChild(colEl);
    });

    host.appendChild(grid);
    host.querySelectorAll('[data-addtag]').forEach(b=> b.addEventListener('click', e=>{
      const tag = e.currentTarget.getAttribute('data-addtag');
  const pid = getCurrentProjectId();
      const init = {status:'To do', tags: tag==='No tag'? [] : [tag]};
  if(pid !== undefined) init.workspaceId = pid;
      openTaskDialog(init);
    }));
  }
}

export function renderTaskCard(t){
  const el=document.createElement('div');
  el.className='task'+(t.status===FINAL_STATUS?' closed':'');
  el.draggable=true;
  el.dataset.id=t.id;
  el.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/plain', t.id); });

  const prioClass=t.prio==='High'?'prio-high':t.prio==='Med'?'prio-med':'prio-low';
  const dueText = t.due? fmtDateTime(t.due) : '';
  const startText = t.startAt? fmtDateTime(t.startAt) : '';
  const totalSubs=(t.subtasks||[]).length;
  const doneSubs=(t.subtasks||[]).filter(st=>st.status===FINAL_STATUS || st.done).length;

  const projectPill = (t.workspaceId!==undefined) ? `<span class="pill">📁 ${escapeHtml(getProjectNameById(t.workspaceId))}</span>` : '';
  el.innerHTML = `
    <header>
      <h4 data-open="${t.id}">${escapeHtml(t.title)}</h4>
      <div class="icons">
        <button class="btn ghost" title="Editar" data-edit="${t.id}">✏️</button>
        ${t.status!==FINAL_STATUS?`<button class="btn success" title="Cerrar" data-close="${t.id}">✔</button>`:''}
      </div>
    </header>
    <div class="meta">
      <span class="pill ${prioClass}">${t.prio||'Med'}</span>
      ${startText?`<span class="pill">🚀 ${startText}</span>`:''}
      ${dueText?`<span class="pill ${overdue(t)?'overdue':''}">📅 ${dueText}</span>`:''}
      ${(t.tags||[]).slice(0,3).map(x=>`<span class="pill">#${escapeHtml(x)}</span>`).join('')}
      <span class="pill">🧮 ${displayPoints(t)}pt</span>
      ${projectPill}
      ${totalSubs?`<span class="pill">☑️ ${doneSubs}/${totalSubs}</span>`:''}
    </div>
    <div class="row-actions"><button class="btn" data-addsub="${t.id}">＋ Sub</button></div>
  `;

  if(totalSubs || true){
    const det=document.createElement('details');
    det.open=false;
    det.innerHTML=`<summary>Subtareas (${doneSubs}/${totalSubs})</summary>`;
    const list=document.createElement('div'); list.style.marginTop='6px';
    // Header-like row
    const hdr=document.createElement('div');
    hdr.className='sub-row header';
    hdr.innerHTML = `
      <span style="width:20px"></span>
      <span style="flex:1;min-width:120px;color:var(--muted)">Título</span>
      <span style="width:80px;color:var(--muted)">Pts</span>
      <span style="width:180px;color:var(--muted)">Inicio</span>
      <span style="width:200px;color:var(--muted)">Vence</span>
      <span style="width:40px"></span>
    `;
    list.appendChild(hdr);
    (t.subtasks||[]).forEach((st,idx)=> list.appendChild(renderSubtaskRow(t, st, idx)) );
    // Inline add subtask row
    const addRow=document.createElement('div');
    addRow.className='sub-row';
    addRow.innerHTML = `
      <span style="width:20px"></span>
      <input type="text" placeholder="Nueva subtarea" style="flex:1;min-width:120px" />
      <input type="number" min="0" value="1" style="width:80px" title="Points"/>
      <input type="datetime-local" style="width:180px" title="Inicio"/>
      <input type="datetime-local" style="width:200px" title="Vence"/>
      <button class="btn" title="Añadir">＋</button>
    `;
    const [titleNew, ptsNew, startNew, dueNew, addBtn] = [addRow.children[1], addRow.children[2], addRow.children[3], addRow.children[4], addRow.children[5]];
    addBtn.addEventListener('click', ()=>{
      const title=(titleNew.value||'').trim(); if(!title) return;
      const st={ id:crypto.randomUUID(), title, done:false, status:'To do', points: parseInt(ptsNew.value||'1',10)||1 };
      st.startAt = startNew.value ? parseLocalDatetimeInput(startNew.value) : Date.now();
      st.endAt = dueNew.value ? parseLocalDatetimeInput(dueNew.value) : st.startAt;
      st.due = st.endAt;
      t.subtasks = t.subtasks || []; t.subtasks.push(st);
      t.updated = Date.now(); t.points = subPoints(t); save();
      renderBoard();
      busRefresh.home();
    });
    list.appendChild(addRow);
    det.appendChild(list);
    el.appendChild(det);
  }

  el.querySelector('[data-addsub]')?.addEventListener('click',()=> openTaskDialog({status:'To do', isSub:true, parentId:t.id}));
  el.querySelector('[data-edit]')?.addEventListener('click',()=> openTaskDialog(t));
  el.querySelector('[data-close]')?.addEventListener('click',()=> closeTask(t.id));
  el.querySelector('[data-open]')?.addEventListener('click',()=> openTaskDialog(t));

  el.addEventListener('click', (ev)=>{
    if(ev.target.closest('button')) return;
    if(ev.target.closest('summary')) return;
    if(ev.target.closest('input,select,textarea')) return;
    openTaskDialog(t);
  });

  return el;
}

function globalTaskComparator(a,b){
  const by = state.settings?.sortBy || 'updated';
  const dir = state.settings?.sortDir === 'asc' ? 1 : -1;
  const get = (t)=>{
    switch(by){
      case 'due': return t.due ?? null;
      case 'start': return t.startAt ?? null;
      case 'priority': return t.prio==='High'?3 : t.prio==='Med'?2 : 1;
  case 'workspace': return (getProjectNameById?.(t.workspaceId) || '').toString();
      case 'points': return displayPoints?.(t) ?? 0;
      case 'status': return (state.columns||[]).indexOf(t.status||'') ?? 0;
      case 'title': return (t.title||'');
      case 'updated': default: return t.updated || 0;
    }
  };
  let va=get(a), vb=get(b);
  // Fechas null al final, en ambos sentidos
  if((by==='due' || by==='start')){
    const aMissing = (va==null);
    const bMissing = (vb==null);
    if(aMissing && !bMissing) return 1;
    if(bMissing && !aMissing) return -1;
    va = aMissing ? 0 : va; vb = bMissing ? 0 : vb;
  }
  // String compare
  if(typeof va==='string' || typeof vb==='string'){
    va = String(va); vb = String(vb); return va.localeCompare(vb) * dir;
  }
  return (va===vb? 0 : (va>vb?1:-1)) * dir;
}

function renderSubtaskRow(parent, st){
  const row = document.createElement('div');
  row.className='sub-row';
  row.innerHTML = `
    <input type="checkbox" ${st.status===FINAL_STATUS||st.done?'checked':''} title="Hecha"/>
    <input type="text" value="${escapeAttr(st.title||'')}" placeholder="Título"/>
    <input type="number" min="0" value="${st.points||0}" style="width:80px" title="Points"/>
    <input type="datetime-local" value="${st.startAt? toLocalDatetimeInput(st.startAt):''}" style="width:180px" title="Inicio"/>
    <input type="datetime-local" value="${st.due? toLocalDatetimeInput(st.due):''}" style="width:200px" title="Vence"/>
    <button class="btn ghost" title="Abrir">✏️</button>
  `;
  const [chk, titleEl, ptsEl, startEl, dueEl, editBtn] =
    [row.children[0], row.children[1], row.children[2], row.children[3], row.children[4], row.children[5]];

  chk.addEventListener('change', ()=>{
    st.done = chk.checked;
    st.status = chk.checked ? FINAL_STATUS : 'To do';
    parent.updated = Date.now();
    parent.points = subPoints(parent);
    save();
    renderBoard();
  busRefresh.home();

    // 🎉 Efectos al completar subtarea
    if (chk.checked) {
      showMega(randomKillLine());
      confettiBurst();
      successSound();
    }
  });

  titleEl.addEventListener('blur', ()=>{
    st.title = titleEl.value.trim();
    parent.updated=Date.now();
    save();
  });

  ptsEl.addEventListener('change', ()=>{
    st.points = parseInt(ptsEl.value||'0',10);
    parent.points = subPoints(parent);
    parent.updated=Date.now();
    save();
    // refrescamos card para que se vea el total actualizado
    renderBoard();
  busRefresh.home();
  });

  startEl.addEventListener('change', ()=>{
    st.startAt = startEl.value ? parseLocalDatetimeInput(startEl.value) : null;
    parent.updated=Date.now();
    save();
    busRefresh.home();
  });

  dueEl.addEventListener('change', ()=>{
    st.due = dueEl.value ? parseLocalDatetimeInput(dueEl.value) : null;
    st.endAt = st.due;
    parent.updated=Date.now();
    save();
    busRefresh.home();
  });

  // Abrir subtarea como "tarea" (usa el editor con isSub)
  function openSub(){
    openTaskDialog({
      id:st.id, title:st.title, desc:st.desc||'',
      prio:parent.prio, due:st.due||null, tags:[...(parent.tags||[])],
      status:(st.status|| (st.done?FINAL_STATUS:'To do')),
      created:parent.created, updated:Date.now(), closed:st.done?Date.now():null,
      docIds:[], points:st.points||1, subtasks:[],
      recur:{type:'none', every:1, trigger:'complete', skipWeekends:false, createNew:true, forever:true, nextStatus:'To do'},
      isSub:true, parentId: parent.id
    });
  }
  editBtn.addEventListener('click', openSub);
  titleEl.addEventListener('click', openSub);

  return row;
}


function moveTaskTo(id,col){
  const t = findTask(id); if(!t) return;
  if(col===FINAL_STATUS && t.status!==FINAL_STATUS){ closeTask(id); return; }
  if(t.status===FINAL_STATUS && col!==FINAL_STATUS){ t.closed=null; }
  t.status = col;
  t.updated = Date.now();
  save();
  renderBoard();
  busRefresh.home();
}
