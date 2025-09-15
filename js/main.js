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
}
document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click', ()=> setActive(t.dataset.view));
});

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
setActive('home');
