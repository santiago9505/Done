export const VERSION = 82;
export const DEFAULT_COLUMNS = ['To do','In progress','Done'];
export const FINAL_STATUS = 'Done';
export const XP_CREATE = 5, XP_CLOSE = 10;

const emptyState = () => ({
  version: VERSION,
  theme: 'dark',
  humorOscuro: true,
  columns: [...DEFAULT_COLUMNS],
  groupBoard: 'status',
  groupTasks: 'none',
  // Proyectos
  projects: [], // {id, name}
  projectFilter: 'all', // 'all' | 'none' | <projectId>
  tasks: [],
  docs: [],
  settings: { taskListCols: ['title','status','prio','due','tags','points','project'] },
  xp: 0,
  lastDayClosed: null, streak: 0
});

export function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
export function save(){ localStorage.setItem('clickap', JSON.stringify(state)) }
export function load(){ try{ return JSON.parse(localStorage.getItem('clickap')) }catch{ return null } }

function migrate(s){
  s.version = VERSION;
  if(!s.settings) s.settings = { taskListCols: ['title','status','prio','due','tags','points','project'] };
  if(Array.isArray(s.settings?.taskListCols) && !s.settings.taskListCols.includes('project')){
    s.settings.taskListCols.push('project');
  }
  if(!Array.isArray(s.columns) || s.columns.length<2) s.columns=[...DEFAULT_COLUMNS];
  if(!Array.isArray(s.projects)) s.projects = [];
  if(!s.projectFilter) s.projectFilter = 'all';

  const fixNum = v => { const n=parseInt(v,10); return Number.isFinite(n)? n : 1; };
  const seen = new Set(); const dedup = [];
  (s.tasks||[]).forEach(t=>{
    if(seen.has(t.id)) return; seen.add(t.id); dedup.push(t);
    if(typeof t.projectId === 'undefined') t.projectId = null;
    t.points = fixNum(t.points);
    if(!Array.isArray(t.subtasks)) t.subtasks=[];
    t.subtasks.forEach(st=>{
      if(!st.id) st.id=uid();
      st.points = fixNum(st.points);
      if(!st.status) st.status = st.done?'Done':'To do';
    });
    if(t.subtasks.length){
      t.points = t.subtasks.reduce((a,st)=>{
        const n=parseInt(st.points,10); return a + (Number.isFinite(n)?n:0);
      },0);
    }
    if(!t.recur) t.recur = {type:'none', every:1, trigger:'complete', skipWeekends:false, createNew:true, forever:true, nextStatus:'To do', last:null};
    if(!DEFAULT_COLUMNS.includes(t.status)){ const map={'Inbox':'To do','Next':'To do','Doing':'In progress','Done':'Done'}; t.status=map[t.status]||'To do'; }
  });
  s.tasks = dedup;
  (s.docs||[]).forEach(d=>{ if(d.content && !d.html){ d.html = `<h1>${escapeHtml(d.title||'Documento')}</h1><pre>${escapeHtml(d.content)}</pre>`; delete d.content; } });
  if(!s.groupBoard) s.groupBoard='status';
  if(!s.groupTasks) s.groupTasks='none';
  // Si el filtro apunta a un proyecto inexistente, reestablecer a 'all'
  if(s.projectFilter !== 'all' && s.projectFilter !== 'none' && !s.projects.find(p=>p.id===s.projectFilter)){
    s.projectFilter = 'all';
  }
  return s;
}
function escapeHtml(x){return (x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}

export let state = migrate(load() || emptyState());
save();

export function findTask(id){ return (state.tasks||[]).find(x=>x.id===id); }
