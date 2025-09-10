// /js/views/board.js
// Tablero con DnD, agrupación por Estado/Tag y edición inline de subtareas
import { state, save, FINAL_STATUS, findTask } from '../core/state.js';
import {
  escapeHtml, escapeAttr, fmtDateTime, overdue,
  subPoints, displayPoints,
  toLocalDatetimeInput, parseLocalDatetimeInput
} from '../core/utils.js';
import { refresh } from '../core/bus.js';
import { closeTask, openTaskDialog } from './dialog.js';
import { showMega } from '../core/mega.js';
import { randomKillLine } from '../core/humor.js';
import { confettiBurst, successSound } from '../core/effects.js';

export function renderBoard(){
  // Dedup por id para evitar rarezas
  const uniq = new Map();
  (state.tasks||[]).forEach(t=>{ if(!uniq.has(t.id)) uniq.set(t.id,t); });
  state.tasks = Array.from(uniq.values()); save();

  const host=document.getElementById('view-board'); if(!host) return;
  host.innerHTML='';

  // Barra superior
  const top = document.createElement('div');
  top.className='card';
  top.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
    <div class="r"><b>Tablero</b></div>
    <div class="r" style="gap:10px;display:flex;align-items:center">
      <label>Agrupar por:</label>
      <select id="groupBoardSel">
        <option value="status" ${state.groupBoard==='status'?'selected':''}>Estado</option>
        <option value="tag" ${state.groupBoard==='tag'?'selected':''}>Tag</option>
      </select>
      <button class="btn primary" id="addTaskBoard">+ Nueva</button>
    </div>
  </div>`;
  host.appendChild(top);

  top.querySelector('#groupBoardSel').addEventListener('change', (e)=>{
    state.groupBoard=e.target.value; save(); renderBoard();
  });
  top.querySelector('#addTaskBoard').addEventListener('click', ()=> openTaskDialog({status:'To do'}));

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

      const tasks=(state.tasks||[])
        .filter(t=>t.status===col && (!q || t.title.toLowerCase().includes(q) || (t.desc||'').toLowerCase().includes(q) || (t.tags||[]).join(' ').toLowerCase().includes(q)))
        .sort((a,b)=> (a.updated||0) < (b.updated||0)?1:-1);

      tasks.forEach(t=> dz.appendChild(renderTaskCard(t)));
      colEl.appendChild(dz);
      grid.appendChild(colEl);
    });

    host.appendChild(grid);
    host.querySelectorAll('[data-add]').forEach(b=> b.addEventListener('click', e=>{
      const col = e.currentTarget.getAttribute('data-add');
      openTaskDialog({status:col});
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

      const tasks=(state.tasks||[])
        .filter(t=> ((t.tags&&t.tags.includes(tag)) || (tag==='No tag' && (!t.tags || t.tags.length===0)))
          && (!q || t.title.toLowerCase().includes(q) || (t.desc||'').toLowerCase().includes(q) || (t.tags||[]).join(' ').toLowerCase().includes(q)))
        .sort((a,b)=> (a.updated||0) < (b.updated||0)?1:-1);

      tasks.forEach(t=> dz.appendChild(renderTaskCard(t)));
      colEl.appendChild(dz);
      grid.appendChild(colEl);
    });

    host.appendChild(grid);
    host.querySelectorAll('[data-addtag]').forEach(b=> b.addEventListener('click', e=>{
      const tag = e.currentTarget.getAttribute('data-addtag');
      openTaskDialog({status:'To do', tags: tag==='No tag'? [] : [tag]});
    }));
  }
}

export function renderTaskCard(t){
  const el=document.createElement('div');
  el.className='task';
  el.draggable=true;
  el.dataset.id=t.id;
  el.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/plain', t.id); });

  const prioClass=t.prio==='High'?'prio-high':t.prio==='Med'?'prio-med':'prio-low';
  const dueText = t.due? fmtDateTime(t.due) : '';
  const totalSubs=(t.subtasks||[]).length;
  const doneSubs=(t.subtasks||[]).filter(st=>st.status===FINAL_STATUS || st.done).length;

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
      ${dueText?`<span class="pill ${overdue(t)?'overdue':''}">📅 ${dueText}</span>`:''}
      ${(t.tags||[]).slice(0,3).map(x=>`<span class="pill">#${escapeHtml(x)}</span>`).join('')}
      <span class="pill">🧮 ${displayPoints(t)}pt</span>
      ${totalSubs?`<span class="pill">☑️ ${doneSubs}/${totalSubs}</span>`:''}
    </div>
    <div class="row-actions"><button class="btn" data-addsub="${t.id}">＋ Sub</button></div>
  `;

  if(totalSubs){
    const det=document.createElement('details');
    det.open=false;
    det.innerHTML=`<summary>Subtareas (${doneSubs}/${totalSubs})</summary>`;
    const list=document.createElement('div'); list.style.marginTop='6px';
    (t.subtasks||[]).forEach((st,idx)=> list.appendChild(renderSubtaskRow(t, st, idx)) );
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

function renderSubtaskRow(parent, st){
  const row = document.createElement('div');
  row.className='sub-row';
  row.innerHTML = `
    <input type="checkbox" ${st.status===FINAL_STATUS||st.done?'checked':''} title="Hecha"/>
    <input type="text" value="${escapeAttr(st.title||'')}" placeholder="Título"/>
    <input type="number" min="0" value="${st.points||0}" style="width:80px" title="Points"/>
    <input type="datetime-local" value="${st.due? toLocalDatetimeInput(st.due):''}" style="width:200px" title="Vence"/>
    <button class="btn ghost" title="Abrir">✏️</button>
  `;
  const [chk, titleEl, ptsEl, dueEl, editBtn] =
    [row.children[0], row.children[1], row.children[2], row.children[3], row.children[4]];

  chk.addEventListener('change', ()=>{
    st.done = chk.checked;
    st.status = chk.checked ? FINAL_STATUS : 'To do';
    parent.updated = Date.now();
    parent.points = subPoints(parent);
    save();
    renderBoard();
    refresh.home();

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
  });

  dueEl.addEventListener('change', ()=>{
    st.due = dueEl.value ? parseLocalDatetimeInput(dueEl.value) : null;
    parent.updated=Date.now();
    save();
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
  refresh.home();
}
