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
  function refreshCurrentView(){
    const current = document.querySelector('.tab.active')?.dataset.view || 'home';
    if(current==='home') renderHome();
    else if(current==='board') renderBoard();
    else if(current==='tasks') import('../views/tasks.js').then(m=>m.renderTasksList());
  }

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
      projectId: (pid !== undefined ? pid : null),
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
    if(pid !== undefined) init.projectId = pid;
    openTaskDialog(init);
  });
  document.getElementById('btnExport')?.addEventListener('click', exportBackup);
  document.getElementById('fileImport')?.addEventListener('change', e=> importBackup(e, ok=> ok && (renderBoard(), renderHome(), renderProjectsSidebar())));
  document.getElementById('toggleTheme')?.addEventListener('click', ()=>{
    state.theme = (state.theme==='dark' ? 'light' : 'dark'); save(); applyTheme();
  });
  document.getElementById('fabNew')?.addEventListener('click', ()=>{
    const pid = getCurrentProjectId();
    const init = { status:'To do' };
    if(pid !== undefined) init.projectId = pid;
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
  });
}

function toast(msg){ 
  const t=document.createElement('div'); 
  t.textContent=msg; 
  t.style.cssText='position:fixed;bottom:16px;right:16px;background:var(--panel);border:1px solid var(--border);box-shadow:var(--shadow);padding:10px 14px;border-radius:12px;z-index:99999;max-width:360px'; 
  document.body.appendChild(t); 
  setTimeout(()=>{t.style.opacity='0'; t.style.transform='translateY(6px)'; t.style.transition='all .3s'}, 2000); 
  setTimeout(()=>t.remove(), 2500); 
}
