import { applyTheme, renderXP } from './core/themeXp.js';
import { state, save } from './core/state.js';
import { setRefreshers } from './core/bus.js';
import { renderHome } from './views/home.js';
import { renderBoard } from './views/board.js';
import { renderTasksList } from './views/tasks.js';
import { renderDocs } from './views/docs.js';
import { renderSummary } from './views/summary.js';
import { renderSettings } from './views/settings.js';
import { wireToolbar } from './ui/toolbar.js';
import { applyScheduledRecurrences } from './logic/recurrence.js';
import { renderProjectsSidebar } from './ui/projects.js';

const ROUTES = ['home','board','tasks','docs','summary','settings'];
const ROUTE_TITLES = {
  home: 'Inicio',
  board: 'Tablero',
  tasks: 'Tareas',
  docs: 'Documentos',
  summary: 'Resumen',
  settings: 'Ajustes'
};

function setActive(view){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active', t.dataset.view===view));
  document.querySelectorAll('main .view').forEach(v=>{
    v.style.display = (v.id === 'view-'+view ? 'block' : 'none');
  });
  if(view==='home') renderHome();
  if(view==='board') renderBoard();
  if(view==='tasks') renderTasksList();
  if(view==='docs') renderDocs();
  if(view==='summary') renderSummary();
  if(view==='settings') renderSettings();

  // Update subbar aria-current
  document.querySelectorAll('.subbar .tab-btn').forEach(btn=>{
    const isActive = btn.getAttribute('data-route')===view;
    if(isActive) btn.setAttribute('aria-current','page'); else btn.removeAttribute('aria-current');
  });

  // Update document title
  const name = ROUTE_TITLES[view] || 'Inicio';
  try{ document.title = `Clickap — ${name}`; }catch{}
}
document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click', ()=> goto(t.dataset.view));
});

// Wire subbar navigation buttons to route switching
document.addEventListener('click', (e)=>{
  const btn = e.target.closest?.('.subbar .tab-btn');
  if(!btn) return;
  const route = btn.getAttribute('data-route');
  if(route) goto(route);
});

// Simple hash router
function parseHash(){
  const h = (window.location.hash || '').replace(/^#\/?/, ''); // remove leading #/
  const parts = h.split(/[?#]/)[0].split('/').filter(Boolean);
  const route = (parts[0] || '').toLowerCase();
  return ROUTES.includes(route) ? route : null;
}

export function goto(route){
  const target = ROUTES.includes(route) ? route : 'home';
  const newHash = `#/${target}`;
  if(window.location.hash === newHash){
    onHashChange(); // force render if same route
  }else{
    window.location.hash = newHash;
  }
}

function onHashChange(){
  let route = parseHash();
  if(!route){
    // fallback to saved or home
    const saved = localStorage.getItem('clickap.route');
    route = ROUTES.includes(saved||'') ? saved : 'home';
    if(!parseHash()) window.location.hash = `#/${route}`;
  }
  // persist
  try{ localStorage.setItem('clickap.route', route); }catch{}
  // render
  const actionsEl = document.getElementById('subActions');
  if(actionsEl) actionsEl.innerHTML='';
  setActive(route);
  // emit route-changed
  try{ window.dispatchEvent(new CustomEvent('route-changed', { detail:{ route } })); }catch{}
}

window.addEventListener('hashchange', onHashChange);

setRefreshers({ renderHome, renderBoard, renderTasksList });

wireToolbar();
applyTheme();
renderXP();
renderProjectsSidebar();

// Semilla mínima si está vacío
(function seedOnceIfEmpty(){
  if((state.tasks||[]).length===0){
    state.tasks.push({
      id:Math.random().toString(36).slice(2),
      title:'Explorar Clickap',
      desc:'Crea tareas, subtareas y ciérralas para ganar XP.',
      prio:'Med', due:null, tags:['onboarding'],
      status:(state.columns && state.columns[0]) || 'To do',
      created:Date.now(), updated:Date.now(), closed:null,
      points:1, docIds:[], subtasks:[],
      recur:{type:'none',every:1,trigger:'complete',skipWeekends:false,createNew:true,forever:true,nextStatus:'To do'}
    });
    save();
  }
})();

setInterval(applyScheduledRecurrences, 60000);
// Init route (hash or last saved)
if(!parseHash()){
  const saved = localStorage.getItem('clickap.route');
  const init = ROUTES.includes(saved||'') ? saved : 'home';
  window.location.hash = `#/${init}`;
} else {
  onHashChange();
}

// Global keyboard shortcuts: Ctrl/Cmd + 1..6 to navigate
window.addEventListener('keydown', (e)=>{
  if(!(e.ctrlKey || e.metaKey)) return;
  const t = e.target;
  const tag = (t && t.tagName) ? t.tagName.toLowerCase() : '';
  const isTextField = (tag==='input' || tag==='textarea' || tag==='select' || (t && t.isContentEditable));
  if(isTextField) return; // avoid conflicts while typing
  const map = { '1':'home','2':'board','3':'tasks','4':'docs','5':'summary','6':'settings' };
  const route = map[e.key];
  if(route){ e.preventDefault(); goto(route); }
});
