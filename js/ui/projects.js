import { state, save, uid } from '../core/state.js';
import { renderBoard } from '../views/board.js';
import { renderTasksList } from '../views/tasks.js';
import { renderHome } from '../views/home.js';

function projectName(id){
  if(id===undefined) return 'Todos';
  if(id===null) return 'Sin proyecto';
  const p = (state.projects||[]).find(x=>x.id===id);
  return p? p.name : 'Desconocido';
}

function renderList(host){
  const q=(document.getElementById('globalSearch')?.value||'').toLowerCase().trim();
  const filtered = (state.projects||[]).filter(p=>!q || p.name.toLowerCase().includes(q));
  host.querySelector('.proj-list').innerHTML = `
    <div class="proj ${state.projectFilter==='all'?'active':''}" data-sel="all"><span class="name">Todos</span></div>
    <div class="proj ${state.projectFilter==='none'?'active':''}" data-sel="none"><span class="name">Sin proyecto</span></div>
    ${filtered.map(p=>`<div class="proj ${state.projectFilter===p.id?'active':''}" data-sel="${p.id}"><span class="name">${p.name}</span><span class="x" data-del="${p.id}" title="Eliminar">×</span></div>`).join('')}
  `;

  host.querySelectorAll('[data-sel]').forEach(el=> el.addEventListener('click', (e)=>{
    const val = el.getAttribute('data-sel');
    state.projectFilter = val==='all'? 'all' : (val==='none'? 'none' : val);
    save();
  renderBoard(); renderTasksList(); renderHome();
    // volver a pintar para refrescar active
    renderProjectsSidebar();
  }));
  host.querySelectorAll('[data-del]').forEach(el=> el.addEventListener('click', (e)=>{
    e.stopPropagation();
    const id = el.getAttribute('data-del');
    if(!confirm('¿Eliminar proyecto y desasignar sus tareas?')) return;
    state.projects = (state.projects||[]).filter(p=>p.id!==id);
    // Desasignar tareas del proyecto eliminado
    (state.tasks||[]).forEach(t=>{ if(t.projectId===id) t.projectId = null; });
    if(state.projectFilter===id) state.projectFilter='all';
    save();
  renderBoard(); renderTasksList(); renderHome();
    renderProjectsSidebar();
  }));
}

export function renderProjectsSidebar(){
  const host = document.getElementById('projectsSidebar'); if(!host) return;
  host.innerHTML = `
    <div class="head"><b>Proyectos</b><span class="chip">${(state.projects||[]).length}</span></div>
    <div class="proj-list"></div>
    <div class="create">
      <input id="pjName" placeholder="Nuevo proyecto…"/>
      <button class="btn" id="pjAdd">Añadir</button>
    </div>
  `;
  renderList(host);

  host.querySelector('#pjAdd').addEventListener('click', ()=>{
    const inp = host.querySelector('#pjName');
    const name = (inp.value||'').trim(); if(!name){ inp.focus(); return; }
    (state.projects|| (state.projects=[])).push({id:uid(), name});
    save(); inp.value='';
    renderProjectsSidebar();
  });
}

export function getCurrentProjectId(){
  if(state.projectFilter==='all') return undefined; // no preselección
  if(state.projectFilter==='none') return null;
  return state.projectFilter;
}

export function getProjectNameById(id){ return projectName(id); }
