import { state, save, uid, XP_CREATE } from '../core/state.js';
import { applyTheme } from '../core/themeXp.js';
import { exportBackup, importBackup } from '../core/exportImport.js';
import { addXP } from '../core/effects.js';
import { renderBoard } from '../views/board.js';
import { renderHome } from '../views/home.js';
import { openTaskDialog } from '../views/dialog.js';
import { getCurrentProjectId } from './projects.js';
import { renderProjectsSidebar } from './projects.js';

export function wireToolbar(){
  // --- Theme-aware dynamic favicons
  function drawFavicon(size){
    const dpr = window.devicePixelRatio || 1;
    const px = Math.round(size * dpr);
    const c = document.createElement('canvas'); c.width = px; c.height = px; const ctx = c.getContext('2d');
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    // Clear
    ctx.clearRect(0,0,px,px);
    // Rounded gradient square
    const r = Math.round(px*0.18);
    const pad = Math.round(px*0.09);
    const x=pad, y=pad, w=px-2*pad, h=px-2*pad;
    const grad = ctx.createLinearGradient(x, y+h, x+w, y);
    grad.addColorStop(0, isLight ? '#7c3aed' : '#8b5cf6');
    grad.addColorStop(1, isLight ? '#3b82f6' : '#60a5fa');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y, x+w,y+h, r);
    ctx.arcTo(x+w,y+h, x,y+h, r);
    ctx.arcTo(x,y+h, x,y, r);
    ctx.arcTo(x,y, x+w,y, r);
    ctx.closePath(); ctx.fill();
    // Inner stroke
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = Math.max(1.25*dpr,1);
    ctx.stroke();
    // Check mark
    ctx.strokeStyle = '#ffffff'; ctx.lineCap='round'; ctx.lineJoin='round'; ctx.lineWidth = Math.max(2*dpr,1.8*dpr);
    const p1=[x+w*0.22,y+h*0.55], p2=[x+w*0.42,y+h*0.72], p3=[x+w*0.78,y+h*0.32];
    ctx.beginPath(); ctx.moveTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.lineTo(p3[0],p3[1]); ctx.stroke();
    return c.toDataURL('image/png');
  }
  function refreshFavicons(){
    const sizes=[16,32,48];
    sizes.forEach(s=>{ const link=document.getElementById(`icon-${s}`); if(link) link.href = drawFavicon(s); });
    const apple=document.getElementById('apple-icon'); if(apple) apple.href = drawFavicon(180);
  }
  // Initial pass
  refreshFavicons();
  function refreshCurrentView(){
    const current = document.querySelector('.tab.active')?.dataset.view || 'home';
    if(current==='home') renderHome();
    else if(current==='board') renderBoard();
    else if(current==='tasks') import('../views/tasks.js').then(m=>m.renderTasksList());
  }
  // Update favicons if theme changes externally
  try{
    const mo = new MutationObserver((muts)=>{
      for(const m of muts){ if(m.type==='attributes' && m.attributeName==='data-theme'){ refreshFavicons(); break; } }
    });
    mo.observe(document.documentElement, { attributes:true, attributeFilter:['data-theme'] });
  }catch{}

  document.getElementById('btnQuickAdd')?.addEventListener('click', ()=>{
    const input = document.getElementById('quickTitle');
    const v = (input?.value || '').trim();
    if(!v){ toast('Escribe un título'); input?.focus(); return; }
    // AI-lite: sugerir tag primaria
    const suggestTag=(txt)=>{
      const s=txt.toLowerCase();
      if(/gym|salud|dieta|health/.test(s)) return 'Health';
      if(/video|edici[oó]n|thumbnail|branding/.test(s)) return 'Branding';
      if(/broker|trade|setup|trading/.test(s)) return 'Trading';
      if(/familia|family/.test(s)) return 'Family';
      if(/work|trabajo|client/.test(s)) return 'Work';
      return null;
    };
    const pid = getCurrentProjectId();
    const t = {
      id: uid(), title: v, desc: '', prio: 'Med', due: null, tags: [],
      status: (state.columns && state.columns[0]) || 'To do',
      workspaceId: (pid !== undefined ? pid : null),
      created: Date.now(), updated: Date.now(), closed: null,
      docIds: [], points: 1, subtasks: [],
      recur: {type:'none', every:1, trigger:'complete', skipWeekends:false, createNew:true, forever:true, nextStatus:'To do'}
    };
    const tg = suggestTag(v); if(tg) t.tags=[tg.toLowerCase()];
  state.tasks.push(t); save(); addXP(XP_CREATE); if(input) input.value='';
  renderBoard(); renderHome();
  });

  document.getElementById('btnNewTask')?.addEventListener('click', ()=>{
    const pid = getCurrentProjectId();
    const init = { status:'To do' };
    if(pid !== undefined) init.workspaceId = pid;
    openTaskDialog(init);
  });
  document.getElementById('btnExport')?.addEventListener('click', exportBackup);
  document.getElementById('fileImport')?.addEventListener('change', e=> importBackup(e, ok=> ok && (renderBoard(), renderHome(), renderProjectsSidebar())));
  const themeBtn = document.getElementById('toggleTheme') || document.getElementById('themeToggle');
  function updateThemeButton(){
    if(!themeBtn) return;
    const mode = state.theme || 'dark';
    const icon = mode==='auto' ? '🖥️' : (mode==='dark' ? '🌙' : '☀️');
    themeBtn.textContent = icon;
    themeBtn.title = mode==='auto' ? 'Tema: Auto (sigue al sistema)' : `Tema: ${mode==='dark'?'Oscuro':'Claro'}`;
    themeBtn.setAttribute('aria-label', themeBtn.title);
  }
  function setThemeMode(mode){
    state.theme = mode; save(); try{ localStorage.setItem('clickap.theme', mode); }catch{}
    applyTheme(); refreshFavicons(); updateThemeButton();
  }
  updateThemeButton();
  let pressTimer=null, longPressFired=false;
  function openThemeMenu(){
    const old = document.getElementById('themeMenu'); if(old) old.remove();
    const r = themeBtn.getBoundingClientRect();
    const menu = document.createElement('div');
    menu.id='themeMenu';
    menu.style.cssText = `position:fixed; left:${Math.round(r.left)}px; top:${Math.round(r.bottom+8)}px; background:var(--panel); border:1px solid var(--hairline); border-radius:10px; box-shadow:var(--elev-1); padding:6px; z-index:10001; display:grid; gap:6px;`;
    const mk = (id,label)=>{ const b=document.createElement('button'); b.className='btn'; b.style.padding='8px 10px'; b.textContent=label; b.addEventListener('click',()=>{ setThemeMode(id); close(); }); return b; };
    const close = ()=> menu.remove();
    menu.appendChild(mk('light','☀️  Claro'));
    menu.appendChild(mk('dark','🌙  Oscuro'));
    menu.appendChild(mk('auto','🖥️  Auto'));
    document.body.appendChild(menu);
    const onDocClick=(e)=>{ if(!menu.contains(e.target) && e.target!==themeBtn){ close(); document.removeEventListener('mousedown', onDocClick, true); } };
    setTimeout(()=> document.addEventListener('mousedown', onDocClick, true), 0);
  }
  function clearPress(){ if(pressTimer){ clearTimeout(pressTimer); pressTimer=null; } }
  themeBtn?.addEventListener('pointerdown', ()=>{
    longPressFired=false; clearPress(); pressTimer=setTimeout(()=>{ longPressFired=true; openThemeMenu(); }, 400);
  });
  themeBtn?.addEventListener('pointerup', ()=>{ clearPress(); });
  themeBtn?.addEventListener('pointerleave', ()=>{ clearPress(); });
  themeBtn?.addEventListener('click', (e)=>{
    if(longPressFired) return; // handled by menu
    const order = ['light','dark','auto'];
    const cur = state.theme || 'dark';
    const idx = order.indexOf(cur);
    const next = order[(idx+1)%order.length];
    setThemeMode(next);
  });
  document.getElementById('fabNew')?.addEventListener('click', ()=>{
    const pid = getCurrentProjectId();
    const init = { status:'To do' };
    if(pid !== undefined) init.workspaceId = pid;
    openTaskDialog(init);
  });

  document.getElementById('globalSearch')?.addEventListener('input', refreshCurrentView);

  // Inicializar y manejar toggle de cerradas
  const closedChk = document.getElementById('toggleClosed');
  if(closedChk){
    closedChk.checked = !!state.settings?.showClosed;
    closedChk.addEventListener('change', ()=>{ state.settings.showClosed = !!closedChk.checked; save(); refreshCurrentView(); });
  }
  // Orden global
  const sortBySel = document.getElementById('globalSortBy');
  if(sortBySel){
    sortBySel.value = state.settings?.sortBy || 'updated';
    sortBySel.addEventListener('change', ()=>{ state.settings.sortBy = sortBySel.value; save(); refreshCurrentView(); });
  }
  const sortDirBtn = document.getElementById('globalSortDir');
  if(sortDirBtn){
    const setDirLabel = ()=>{ sortDirBtn.textContent = state.settings?.sortDir==='asc' ? '↑' : '↓'; };
    if(!['asc','desc'].includes(state.settings?.sortDir)) state.settings.sortDir='desc';
    setDirLabel();
    sortDirBtn.addEventListener('click', ()=>{ state.settings.sortDir = (state.settings.sortDir==='asc'?'desc':'asc'); save(); setDirLabel(); refreshCurrentView(); });
  }

  window.addEventListener('keydown', (e)=>{
    const key=e.key.toLowerCase();
    if((e.ctrlKey||e.metaKey) && key==='n'){ e.preventDefault(); openTaskDialog({status:'To do'}); }
    if((e.ctrlKey||e.metaKey) && key==='f'){ e.preventDefault(); document.getElementById('globalSearch')?.focus(); }
    if((e.ctrlKey||e.metaKey) && key==='k'){ e.preventDefault(); openCommandPalette(); }
  });

  // Header Command button
  document.getElementById('openCmd')?.addEventListener('click', ()=> openCommandPalette());

  // Logo click → go home
  document.getElementById('btnHome')?.addEventListener('click', ()=>{ if(window.goto) window.goto('home'); else window.location.hash = '#/home'; });
  // Quick links
  document.getElementById('quickHelp')?.addEventListener('click', ()=>{
    if(window.goto) window.goto('docs'); else window.location.hash = '#/docs';
    setTimeout(()=>{
      try{
        const host=document.getElementById('view-docs'); if(!host) return;
        const node = Array.from(host.querySelectorAll('.tree .node span')).find(el=>/guía|ayuda|help/i.test(el.textContent||''));
        node?.previousElementSibling?.click();
      }catch{}
    }, 60);
  });
  document.getElementById('quickChangelog')?.addEventListener('click', ()=>{
    if(window.goto) window.goto('docs'); else window.location.hash = '#/docs';
    setTimeout(async ()=>{
      try{
        const ensureAndSelect = async ()=>{
          const host=document.getElementById('view-docs'); if(!host) return false;
          let node = Array.from(host.querySelectorAll('.tree .node span')).find(el=>/changelog/i.test(el.textContent||''));
          if(node){ node.previousElementSibling?.click(); return true; }
          // Create placeholder doc if missing
          const exists = (state.docs||[]).some(d=>/changelog/i.test(d.title||''));
          if(!exists){
            (state.docs||(state.docs=[])).push({ id: uid(), title:'Changelog', parentId:null, html:'<h1>Changelog</h1><p>Próximamente…</p>', created:Date.now(), updated:Date.now() });
            save();
          }
          const m = await import('../views/docs.js'); m.renderDocs();
          setTimeout(()=>{
            const host2=document.getElementById('view-docs'); if(!host2) return;
            const node2 = Array.from(host2.querySelectorAll('.tree .node span')).find(el=>/changelog/i.test(el.textContent||''));
            node2?.previousElementSibling?.click();
          }, 20);
          return true;
        };
        await ensureAndSelect();
      }catch{}
    }, 60);
  });
}

// Basic user menu open/close and Esc handling
document.addEventListener('click', (e)=>{
  const btn = document.getElementById('userMenuBtn');
  const menu = document.getElementById('userDropdown');
  if(!btn || !menu) return;
  const clickedBtn = e.target.closest && e.target.closest('#userMenuBtn');
  if(clickedBtn){ menu.hidden = !menu.hidden; return; }
  if(!menu.hidden && !menu.contains(e.target)) menu.hidden = true;
});
window.addEventListener('keydown', (e)=>{
  if(e.key==='Escape'){
    const menu = document.getElementById('userDropdown');
    if(menu && !menu.hidden){ menu.hidden = true; }
  }
});

function toast(msg){ 
  const t=document.createElement('div'); 
  t.textContent=msg; 
  t.style.cssText='position:fixed;bottom:16px;right:16px;background:var(--panel);border:1px solid var(--border);box-shadow:var(--shadow);padding:10px 14px;border-radius:12px;z-index:99999;max-width:360px'; 
  document.body.appendChild(t); 
  setTimeout(()=>{t.style.opacity='0'; t.style.transform='translateY(6px)'; t.style.transition='all .3s'}, 2000); 
  setTimeout(()=>t.remove(), 2500); 
}

// ---------------- Command Palette ----------------
function buildCommands(){
  const go = (route)=>{ if(window.goto) window.goto(route); else window.location.hash = `#/${route}`; };
  const cmds = [
    { id:'go-home',    title:'Ir: Inicio',      keywords:'home inicio',      run:()=> go('home') },
    { id:'go-board',   title:'Ir: Tablero',     keywords:'board tablero',    run:()=> go('board') },
    { id:'go-tasks',   title:'Ir: Tareas',      keywords:'tasks tareas',     run:()=> go('tasks') },
    { id:'go-docs',    title:'Ir: Documentos',  keywords:'docs documentos',  run:()=> go('docs') },
    { id:'go-summary', title:'Ir: Resumen',     keywords:'summary resumen',  run:()=> go('summary') },
    { id:'go-settings',title:'Ir: Ajustes',     keywords:'settings ajustes', run:()=> go('settings') },
    { id:'change-workspace', title:'Cambiar workspace', keywords:'ws workspace @workspace', run:()=>{} },
    { id:'new-task',   title:'Nueva tarea',     keywords:'new nueva task',   run:()=>{
        const pid = getCurrentProjectId();
        const init = { status:'To do' };
        if(pid !== undefined) init.workspaceId = pid;
        openTaskDialog(init);
      }
    }
  ];
  return cmds;
}

function openCommandPalette(){
  // Prevent multiple
  if(document.getElementById('commandPalette')) return;
  const overlay = document.createElement('div');
  overlay.id = 'commandPalette';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:flex-start;justify-content:center;background:rgba(0,0,0,.35)';

  const box = document.createElement('div');
  box.style.cssText = 'margin-top:12vh;min-width:min(720px,94vw);background:var(--panel);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);overflow:hidden';

  const input = document.createElement('input');
  input.type='search'; input.placeholder='Escribe un comando…'; input.setAttribute('aria-label','Comando');
  input.style.cssText = 'width:100%;padding:12px 14px;background:var(--panel-2);border:none;border-bottom:1px solid var(--border);color:var(--text);font-size:15px;outline:none';

  const list = document.createElement('div');
  list.style.cssText = 'max-height:50vh;overflow:auto;padding:6px';

  const cmds = buildCommands();
  let mode = 'commands'; // 'commands' | 'workspaces'
  let filtered = cmds.slice();
  let wsList = [];
  let idx = 0;

  function stripEmojiPrefix(txt){
    if(!txt) return '';
    try{ return txt.replace(/^[^\p{L}\p{N}]+/u, '').trimStart(); }catch{ return txt; }
  }

  function buildWorkspaceList(){
    const w = (state.workspaces||[]).map(x=>{
      const name = stripEmojiPrefix(x.name||'');
      const emoji = x.emoji || '📁';
      return { id:x.id, title:`${emoji} ${name}`, rawName:name.toLowerCase(), emoji };
    }).sort((a,b)=> a.rawName.localeCompare(b.rawName));
    return [
      { id:'all', title:'📁 Todos', rawName:'todos' },
      { id:'none', title:'📁 Sin workspace', rawName:'sin workspace' },
      ...w
    ];
  }

  function renderList(){
    if(mode==='commands'){
      list.innerHTML = filtered.map((c,i)=> `
        <button data-id="${c.id}" style="display:flex;gap:8px;align-items:center;width:100%;text-align:left;background:transparent;border:1px solid var(--hairline);color:var(--text);padding:8px 10px;border-radius:10px;cursor:pointer;margin:4px 0;${i===idx?'outline:2px solid var(--primary);outline-offset:1px;background:rgba(255,255,255,.03)':''}">
          <span>${c.title}</span>
        </button>
      `).join('');
    } else {
      list.innerHTML = wsList.map((w,i)=>{
        const active = (i===idx);
        const isCurrent = (state.workspaceFilter===w.id);
        const mark = isCurrent ? '✓' : '';
        return `
          <button data-wid="${w.id}" style="display:flex;gap:8px;align-items:center;width:100%;justify-content:space-between;text-align:left;background:transparent;border:1px solid var(--hairline);color:var(--text);padding:8px 10px;border-radius:10px;cursor:pointer;margin:4px 0;${active?'outline:2px solid var(--primary);outline-offset:1px;background:rgba(255,255,255,.03)':''}">
            <span>${w.title}</span>
            <span style="opacity:.7">${mark}</span>
          </button>`;
      }).join('');
    }
  }

  function applyFilter(){
    const raw = input.value;
    const q = raw.trim().toLowerCase();
    if(mode==='commands'){
      // Shortcut: typing '@' switches to workspace mode
      if(q.startsWith('@')){
        mode='workspaces';
        input.placeholder='Buscar workspace…';
        wsList = buildWorkspaceList();
        const q2 = q.slice(1);
        if(q2){ wsList = wsList.filter(w=> w.title.toLowerCase().includes(q2) || w.rawName.includes(q2)); }
        idx = 0; renderList(); return;
      }
      filtered = !q ? cmds.slice() : cmds.filter(c=> c.title.toLowerCase().includes(q) || (c.keywords||'').includes(q));
      idx = 0; renderList();
    } else {
      wsList = buildWorkspaceList();
      if(q){ wsList = wsList.filter(w=> w.title.toLowerCase().includes(q) || w.rawName.includes(q)); }
      idx = 0; renderList();
    }
  }

  input.addEventListener('input', applyFilter);
  list.addEventListener('click', (e)=>{
    const wsBtn = e.target.closest('button[data-wid]');
    if(wsBtn){
      const wid = wsBtn.getAttribute('data-wid');
      applyWorkspaceSelection(wid);
      return;
    }
    const btn = e.target.closest('button[data-id]'); if(!btn) return;
    const c = filtered.find(x=>x.id===btn.getAttribute('data-id')); if(!c) return;
    if(c.id==='change-workspace'){
      mode='workspaces';
      input.placeholder='Buscar workspace…';
      input.value='';
      wsList = buildWorkspaceList();
      idx = 0; renderList();
      return;
    }
    close(); c.run();
  });
  window.addEventListener('keydown', onKey, true);

  function onKey(e){
    if(e.key==='Escape'){ e.preventDefault(); close(); return; }
    if(e.key==='ArrowDown'){ e.preventDefault(); if(filtered.length){ idx=(idx+1)%filtered.length; renderList(); ensureVisible(); } }
    if(e.key==='ArrowUp'){ e.preventDefault(); if(filtered.length){ idx=(idx-1+filtered.length)%filtered.length; renderList(); ensureVisible(); } }
    if(e.key==='Enter'){
      e.preventDefault();
      if(mode==='commands'){
        const c=filtered[idx]; if(!c) return;
        if(c.id==='change-workspace'){
          mode='workspaces'; input.placeholder='Buscar workspace…'; input.value=''; wsList=buildWorkspaceList(); idx=0; renderList(); return;
        }
        close(); c.run();
      }else{
        const w=wsList[idx]; if(!w) return; applyWorkspaceSelection(w.id);
      }
    }
  }
  function ensureVisible(){
    const el = list.querySelectorAll('button')[idx];
    if(el) el.scrollIntoView({block:'nearest'});
  }
  function close(){
    window.removeEventListener('keydown', onKey, true);
    overlay.remove();
  }

  function applyWorkspaceSelection(val){
    state.workspaceFilter = val==='all' ? 'all' : (val==='none' ? 'none' : val);
    save();
    // Re-render UI
    try{ renderProjectsSidebar(); }catch{}
    try{ renderBoard(); }catch{}
    try{ renderHome(); }catch{}
    try{ import('../views/tasks.js').then(m=>m.renderTasksList()); }catch{}
    // Emit event for any listener
    try{ window.dispatchEvent(new CustomEvent('workspace-filter-changed', { detail:{ filter: state.workspaceFilter } })); }catch{}
    close();
  }

  box.appendChild(input); box.appendChild(list);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  applyFilter();
  setTimeout(()=> input.focus(), 0);
}
