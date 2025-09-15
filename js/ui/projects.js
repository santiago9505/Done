import { state, save, uid } from '../core/state.js';
import { renderBoard } from '../views/board.js';
import { renderTasksList } from '../views/tasks.js';
import { renderHome } from '../views/home.js';

// Quita cualquier prefijo no alfanumérico (emojis/símbolos) del nombre mostrado
function stripEmojiPrefix(txt){
  if(!txt) return '';
  return txt.replace(/^[^\p{L}\p{N}]+/u, '').trimStart();
}

function projectName(id){
  if(id===undefined) return 'Todos';
  if(id===null) return 'Sin proyecto';
  const p = (state.projects||[]).find(x=>x.id===id);
  return p ? stripEmojiPrefix(p.name) : 'Desconocido';
}

function ensureEmoji(p){
  if(p.emoji) return p.emoji;
  const n=(p.name||'').toLowerCase();
  if(n.includes('trading')) return p.emoji='💸';
  if(n.includes('health')) return p.emoji='🏋️';
  if(n.includes('family')) return p.emoji='👨‍👩‍👧';
  if(n.includes('work')) return p.emoji='💼';
  if(n.includes('branding')) return p.emoji='✨';
  return p.emoji='📁';
}

function renderList(host){
  const q=(document.getElementById('globalSearch')?.value||'').toLowerCase().trim();
  const list = (state.projects||[]).map(p=>{ ensureEmoji(p); if(typeof p.favorite==='undefined') p.favorite=false; if(typeof p.sort==='undefined') p.sort=0; return p; });
  const favs = list.filter(p=>p.favorite).sort((a,b)=> (a.sort||0)-(b.sort||0));
  const others = list.filter(p=>!p.favorite).sort((a,b)=> a.name.localeCompare(b.name));
  host.querySelector('.proj-list').innerHTML = `
    <div class="proj ${state.projectFilter==='all'?'active':''}" data-sel="all"><span class="name">Todos</span></div>
    <div class="proj ${state.projectFilter==='none'?'active':''}" data-sel="none"><span class="name">Sin proyecto</span></div>
    <div style="margin:6px 0;color:var(--muted);font-size:12px">Favoritos</div>
    <div class="fav-zone">${favs.map(p=>`
      <div class="proj ${state.projectFilter===p.id?'active':''}" draggable="true" data-id="${p.id}" data-sel="${p.id}">
        <span>${p.emoji||'📁'}</span><span class="name">${stripEmojiPrefix(p.name||'')}</span>
        <span class="x" data-star="${p.id}" title="Quitar de favoritos">★</span>
      </div>`).join('')}
      ${!favs.length?'<div style="color:var(--muted);font-size:12px">Arrastra aquí</div>':''}
    </div>
    <details open>
      <summary style="cursor:pointer;color:var(--muted);font-size:12px">Todos</summary>
      ${others.map(p=>`<div class="proj ${state.projectFilter===p.id?'active':''}" data-sel="${p.id}">
          <span>${p.emoji||'📁'}</span><span class="name">${stripEmojiPrefix(p.name||'')}</span>
          <span class="x" data-star="${p.id}" title="Añadir a favoritos">☆</span>
          <span class="x" data-del="${p.id}" title="Eliminar">×</span>
        </div>`).join('')}
    </details>
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
  // Star/unstar
  host.querySelectorAll('[data-star]').forEach(el=> el.addEventListener('click', (e)=>{
    e.stopPropagation();
    const id=el.getAttribute('data-star');
    const p=(state.projects||[]).find(x=>x.id===id); if(!p) return;
    if(!p.favorite){
      const count = (state.projects||[]).filter(pp=>pp.favorite).length;
      if(count>=5){ alert('Máximo 5 favoritos'); return; }
      p.favorite = true;
    }else{
      p.favorite = false;
    }
    if(p.favorite){ p.sort = Math.max(0, ...state.projects.map(pp=>pp.sort||0))+1; }
    save(); renderProjectsSidebar();
  }));
  // Drag & drop dentro de fav-zone
  const zone = host.querySelector('.fav-zone');
  let dragId=null;
  zone?.querySelectorAll('[draggable]')?.forEach(el=>{
    el.addEventListener('dragstart', ()=>{ dragId = el.getAttribute('data-id'); });
    el.addEventListener('dragover', (e)=>{ e.preventDefault(); });
    el.addEventListener('drop', (e)=>{
      e.preventDefault(); const targetId = el.getAttribute('data-id'); if(!dragId||!targetId||dragId===targetId) return;
      const favs = (state.projects||[]).filter(p=>p.favorite).sort((a,b)=> (a.sort||0)-(b.sort||0));
      const order = favs.map(p=>p.id);
      const from = order.indexOf(dragId); const to = order.indexOf(targetId);
      if(from>-1 && to>-1){ order.splice(to,0, order.splice(from,1)[0]); }
      (state.projects||[]).forEach(p=>{ if(p.favorite){ p.sort = order.indexOf(p.id); } });
      save(); renderProjectsSidebar();
    });
  });
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
    const p={id:uid(), name, emoji:'', favorite:false, sort:(state.projects||[]).length}; ensureEmoji(p);
    (state.projects|| (state.projects=[])).push(p);
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
