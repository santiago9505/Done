import { state, save, uid } from '../core/state.js';
import { renderBoard } from '../views/board.js';
import { renderTasksList } from '../views/tasks.js';
import { renderHome } from '../views/home.js';

// Quita cualquier prefijo no alfanumérico (emojis/símbolos) del nombre mostrado
function stripEmojiPrefix(txt){
  if(!txt) return '';
  return txt.replace(/^[^\p{L}\p{N}]+/u, '').trimStart();
}

function workspaceName(id){
  if(id===undefined) return 'Todos';
  if(id===null) return 'Sin workspace';
  const p = (state.workspaces||[]).find(x=>x.id===id);
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

/* ========== Export/Import (incluye proyectos, tareas y subtareas) ========== */
function deepClone(obj){ return JSON.parse(JSON.stringify(obj||{})); }

function getExportSnapshot(){
  // Incluye proyectos, tareas (con subtareas y comentarios + adjuntos como dataURL), docs y settings
  return {
    workspaces: JSON.parse(JSON.stringify(state.workspaces||[])),
    tasks: JSON.parse(JSON.stringify(state.tasks||[])), // contiene t.comments y sus files (dataUrl)
    docs: JSON.parse(JSON.stringify(state.docs||[])),
    settings: JSON.parse(JSON.stringify(state.settings||{})),
    columns: deepClone(state.columns||[]),
    streak: state.streak||0,
    lastDayClosed: state.lastDayClosed||null,
    workspaceFilter: state.workspaceFilter ?? 'all',
    groupTasks: state.groupTasks || 'none'
  };
}

function exportAllData(){
  const payload = { app:'Clickap', kind:'full-backup', version:1, exportedAt:new Date().toISOString(), state:getExportSnapshot() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const a = document.createElement('a');
  const d = new Date(), pad = n=>String(n).padStart(2,'0');
  a.download = `clickap-backup-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  a.href = URL.createObjectURL(blob);
  a.click();
  URL.revokeObjectURL(a.href);
}

function normalizeImportedState(incoming){
  // Asegura contenedores base
  if(!Array.isArray(incoming.workspaces) && Array.isArray(incoming.projects)) incoming.workspaces = incoming.projects;
  if(!Array.isArray(incoming.workspaces)) incoming.workspaces = [];
  if(!Array.isArray(incoming.tasks)) incoming.tasks = [];
  if(!Array.isArray(incoming.docs)) incoming.docs = [];
  if(!Array.isArray(incoming.columns)) incoming.columns = ['To do','In progress','Done'];
  if(typeof incoming.settings!=='object' || !incoming.settings) incoming.settings = {};

  // Normaliza proyectos (emoji por nombre)
  incoming.workspaces.forEach(ensureEmoji);

  // Normaliza tareas, subtareas y comentarios con adjuntos
  incoming.tasks.forEach(t=>{
    if(!t.id) t.id = uid();
    if(!Array.isArray(t.subtasks)) t.subtasks = [];
    if(!Array.isArray(t.comments)) t.comments = [];
    // Subtareas
    t.subtasks.forEach(st=>{
      if(!st.id) st.id = uid();
      if(st.done && !st.status) st.status = 'Done';
    });
    // Comentarios
    t.comments.forEach(c=>{
      if(!c.id) c.id = uid();
      if(!c.ts) c.ts = Date.now();
      if(!Array.isArray(c.files)) c.files = [];
      c.files.forEach(f=>{
        if(!f.id) f.id = uid();
        // Asegurar estructura mínima de archivo
        if(typeof f.name !== 'string') f.name = 'archivo';
        if(typeof f.type !== 'string') f.type = '';
        if(typeof f.size !== 'number') f.size = 0;
        // dataUrl debe ser string para que el preview funcione
        if(typeof f.dataUrl !== 'string') f.dataUrl = '';
      });
    });
  });

  return incoming;
}

async function importAllDataFromFile(file){
  const text = await file.text();
  let parsed;
  try{ parsed = JSON.parse(text); }catch{ alert('Archivo inválido'); return; }
  const incomingRaw = parsed?.state && typeof parsed.state==='object' ? parsed.state : parsed;
  if(!incomingRaw || typeof incomingRaw!=='object'){ alert('Contenido inválido'); return; }
  const incoming = normalizeImportedState(incomingRaw);

  Object.assign(state, {
    workspaces: incoming.workspaces,
    tasks: incoming.tasks,       // comentarios + adjuntos quedan preservados
    docs: incoming.docs,
    settings: incoming.settings,
    columns: incoming.columns,
    streak: incoming.streak||0,
    lastDayClosed: incoming.lastDayClosed||null,
    workspaceFilter: incoming.workspaceFilter ?? 'all',
    groupTasks: incoming.groupTasks || 'none'
  });

  save();
  renderProjectsSidebar(); renderBoard(); renderTasksList(); renderHome();
}

/* ========== Emoji picker ========== */
const EMOJI_SET = [
  '📁','⭐','✨','🌟','🔥','✅','🗓️','🧠','💡','📝','📌','📎','⏰','🕒','📈','📉','💹','💰','🏦','💼',
  '🛠️','🧪','🧰','🎯','🚀','🧭','⚙️','🔧','🔩','🧷',
  '🏋️','🏃','🧘','🚴','🥗','🍎','💧','🛌','🩺','💊',
  '👨‍👩‍👧','🏠','📚','🎓','🖥️','📱','🖊️','📖','🗃️','🗂️',
  '🎨','🎵','🎬','📷','🧳','✈️','🌍','💬','📣','🤝',
  '🐞','🔒','🧩','🔬','🧫','🔭','🧮','🧑‍🍳','🍽️'
];

function showEmojiPicker(anchorEl, workspaceId){
  let picker = document.getElementById('emojiPicker');
  if(!picker){
    picker = document.createElement('div');
    picker.id = 'emojiPicker';
    picker.className = 'emoji-picker';
    document.body.appendChild(picker);
    document.addEventListener('click', (e)=>{ if(picker && !picker.contains(e.target) && e.target!==anchorEl) picker.classList.remove('open'); });
  }
  picker.innerHTML = EMOJI_SET.map(e=>`<button data-emo="${e}" class="emoji-btn">${e}</button>`).join('');
  picker.querySelectorAll('[data-emo]').forEach(btn=>{
    btn.onclick = ()=>{
      const emo = btn.getAttribute('data-emo');
      const p = (state.workspaces||[]).find(x=>x.id===workspaceId);
      if(p){ p.emoji = emo; save(); renderProjectsSidebar(); renderBoard(); renderTasksList(); renderHome(); }
      picker.style.display='none';
    };
  });
  const r = anchorEl.getBoundingClientRect();
  picker.style.left = Math.min(window.innerWidth-340, Math.max(8, r.left)) + 'px';
  picker.style.top  = Math.min(window.innerHeight-280, Math.max(8, r.bottom+6)) + 'px';
  picker.classList.add('open');
}

/* ========== Render sidebar ========== */
function renderList(host){
  const list = (state.workspaces||[]).map(p=>{ ensureEmoji(p); if(typeof p.favorite==='undefined') p.favorite=false; if(typeof p.sort==='undefined') p.sort=0; return p; });
  const favs = list.filter(p=>p.favorite).sort((a,b)=> (a.sort||0)-(b.sort||0));
  const others = list.filter(p=>!p.favorite).sort((a,b)=> a.name.localeCompare(b.name));

  host.querySelector('.proj-list').innerHTML = `
  <div class="proj ${state.workspaceFilter==='all'?'active':''}" data-sel="all"><span class="name">Todos</span></div>
  <div class="proj ${state.workspaceFilter==='none'?'active':''}" data-sel="none"><span class="name">Sin workspace</span></div>
  <div class="muted-note my-6">Favoritos</div>
    <div class="fav-zone">
      ${favs.map(p=>`
  <div class="proj ${state.workspaceFilter===p.id?'active':''}" draggable="true" data-id="${p.id}" data-sel="${p.id}">
          <span class="emoji" data-emoji-edit="${p.id}" title="Cambiar emoji">${p.emoji||'📁'}</span>
          <span class="name">${stripEmojiPrefix(p.name||'')}</span>
          <span class="x" data-star="${p.id}" title="Quitar de favoritos">★</span>
        </div>`).join('')}
  ${!favs.length?'<div class="muted-note">Arrastra aquí</div>':''}
    </div>
    <details open>
      <summary class="sidebar-summary">Todos</summary>
      ${others.map(p=>`
  <div class="proj ${state.workspaceFilter===p.id?'active':''}" data-sel="${p.id}">
          <span class="emoji" data-emoji-edit="${p.id}" title="Cambiar emoji">${p.emoji||'📁'}</span>
          <span class="name">${stripEmojiPrefix(p.name||'')}</span>
          <span class="x" data-star="${p.id}" title="Añadir a favoritos">☆</span>
          <span class="x" data-del="${p.id}" title="Eliminar">×</span>
        </div>`).join('')}
    </details>
  `;

  // Selección
  host.querySelectorAll('[data-sel]').forEach(el=> el.addEventListener('click', ()=>{
    const val = el.getAttribute('data-sel');
    state.workspaceFilter = val==='all'? 'all' : (val==='none'? 'none' : val);
    save(); renderBoard(); renderTasksList(); renderHome(); renderProjectsSidebar();
  }));

  // Eliminar
  host.querySelectorAll('[data-del]').forEach(el=> el.addEventListener('click', (e)=>{
    e.stopPropagation();
    const id = el.getAttribute('data-del');
    if(!confirm('¿Eliminar workspace y desasignar sus tareas?')) return;
    state.workspaces = (state.workspaces||[]).filter(p=>p.id!==id);
    (state.tasks||[]).forEach(t=>{ if(t.workspaceId===id) t.workspaceId = null; });
    if(state.workspaceFilter===id) state.workspaceFilter='all';
    save(); renderBoard(); renderTasksList(); renderHome(); renderProjectsSidebar();
  }));

  // Favoritos
  host.querySelectorAll('[data-star]').forEach(el=> el.addEventListener('click', (e)=>{
    e.stopPropagation();
    const id=el.getAttribute('data-star');
    const p=(state.workspaces||[]).find(x=>x.id===id); if(!p) return;
    p.favorite = !p.favorite;
    if(p.favorite){ p.sort = Math.max(0, ...(state.workspaces||[]).map(pp=>pp.sort||0))+1; }
    save(); renderProjectsSidebar();
  }));

  // Drag & drop en favoritos
  const zone = host.querySelector('.fav-zone');
  let dragId=null;
  zone?.querySelectorAll('[draggable]')?.forEach(el=>{
    el.addEventListener('dragstart', ()=>{ dragId = el.getAttribute('data-id'); });
    el.addEventListener('dragover', (e)=> e.preventDefault());
    el.addEventListener('drop', (e)=>{
      e.preventDefault();
      const targetId = el.getAttribute('data-id');
      if(!dragId||!targetId||dragId===targetId) return;
  const favsNow = (state.workspaces||[]).filter(p=>p.favorite).sort((a,b)=> (a.sort||0)-(b.sort||0));
      const order = favsNow.map(p=>p.id);
      const from = order.indexOf(dragId), to = order.indexOf(targetId);
      if(from>-1 && to>-1){ order.splice(to,0, order.splice(from,1)[0]); }
      (state.workspaces||[]).forEach(p=>{ if(p.favorite){ p.sort = order.indexOf(p.id); } });
      save(); renderProjectsSidebar();
    });
  });

  // Emoji picker
  host.querySelectorAll('[data-emoji-edit]').forEach(el=>{
    el.addEventListener('click', (e)=>{
      e.stopPropagation();
      const wid = el.getAttribute('data-emoji-edit');
      showEmojiPicker(el, wid);
    });
  });
}

// Solo título y nombre; no crear elementos nuevos
function enforceAppTitleOnly(){
  document.title = 'Done';
  const brand = document.querySelector('.topbar .brand') || document.querySelector('header .brand') || document.querySelector('.brand');
  if(!brand) return;
  // Quita el extra que pudimos haber agregado
  brand.querySelector('.app-name')?.remove();
  // Reemplaza texto "Clickap" por "Done" en nodos de texto y spans simples
  brand.childNodes.forEach(n=>{
    if(n.nodeType===Node.TEXT_NODE && /clickap/i.test(n.nodeValue||'')){
      n.nodeValue = (n.nodeValue||'').replace(/clickap/ig,'Done');
    }
  });
  brand.querySelectorAll('span, b, strong, h1, h2').forEach(el=>{
    if(el.children.length===0 && /clickap/i.test(el.textContent||'')){
      el.textContent = el.textContent.replace(/clickap/ig,'Done');
    }
  });
}

// Inserta/actualiza el brand en el header y fija el título del documento
function ensureAppBrand(){
  try{
    document.title = 'Done';
    const header = document.querySelector('header .brand') || document.querySelector('.topbar .brand') || document.querySelector('.brand');
    if(!header) return;
    let logo = header.querySelector('.logo');
    if(!logo){
      logo = document.createElement('div');
      logo.className = 'logo';
      header.prepend(logo);
    }
    let name = header.querySelector('.app-name');
    if(!name){
      name = document.createElement('span');
      name.className = 'app-name';
      header.appendChild(name);
    }
    name.textContent = 'Done';
  }catch{}
}

export function renderProjectsSidebar(){
  const host = document.getElementById('projectsSidebar'); if(!host) return;
  host.innerHTML = `
    <div class="head"><b>Workspaces</b><span class="chip">${(state.workspaces||[]).length}</span></div>
    <div class="proj-list"></div>
    <div class="create">
      <input id="pjName" placeholder="Nuevo workspace…"/>
      <button class="btn" id="pjAdd">Añadir</button>
    </div>
    <div class="r mt-8">
      <button class="btn" id="pjExport">Exportar</button>
      <button class="btn" id="pjImport">Importar</button>
      <input type="file" id="pjImportFile" accept="application/json" class="hidden"/>
    </div>
  `;
  renderList(host);
  enforceAppTitleOnly(); // asegurar "Done" sin agregar elementos nuevos

  // Añadir
  host.querySelector('#pjAdd').addEventListener('click', ()=>{
    const inp = host.querySelector('#pjName');
    const name = (inp.value||'').trim(); if(!name){ inp.focus(); return; }
    const p={id:uid(), name, emoji:'', favorite:false, sort:(state.workspaces||[]).length};
    ensureEmoji(p);
    (state.workspaces || (state.workspaces=[])).push(p);
    save(); inp.value='';
    renderProjectsSidebar();
  });

  // Exportar / Importar
  host.querySelector('#pjExport').addEventListener('click', exportAllData);
  const importBtn = host.querySelector('#pjImport');
  const importFile = host.querySelector('#pjImportFile');
  importBtn.addEventListener('click', ()=> importFile.click());
  importFile.addEventListener('change', (e)=>{ const f=e.target.files && e.target.files[0]; if(f) importAllDataFromFile(f); e.target.value=''; });
}

export function getCurrentProjectId(){
  // backwards compatibility shim
  if(state.workspaceFilter==='all') return undefined;
  if(state.workspaceFilter==='none') return null;
  return state.workspaceFilter;
}

export function getProjectNameById(id){ return workspaceName(id); }
// New API names (optional future usage)
export const getCurrentWorkspaceId = getCurrentProjectId;
export const getWorkspaceNameById = getProjectNameById;
