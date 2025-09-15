export const VERSION = 84;
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
  settings: { 
    taskListCols: ['title','status','prio','due','tags','points','project'],
    ui: {
      accent: '#60a5fa', // primary/accent color
      accentMode: 'auto', // 'auto' | 'custom'
      density: 'comfortable', // 'compact' | 'comfortable' | 'spacious'
      radius: 12, // px base radius
      fontScale: 100 // percentage 90-110
    },
    homeFilter: 'all'
  },
  xp: 0,
  lastDayClosed: null, streak: 0
});

export function uid(){return Math.random().toString(36).slice(2)+Date.now().toString(36)}
export function save(){ localStorage.setItem('clickap', JSON.stringify(state)) }
export function load(){ try{ return JSON.parse(localStorage.getItem('clickap')) }catch{ return null } }

function migrate(s){
  s.version = VERSION;
  if(!s.settings) s.settings = { taskListCols: ['title','status','prio','due','tags','points','project'] };
  if(Array.isArray(s.settings?.taskListCols)){
    if(!s.settings.taskListCols.includes('project')) s.settings.taskListCols.push('project');
    if(!s.settings.taskListCols.includes('start')) s.settings.taskListCols.splice(Math.max(0, s.settings.taskListCols.indexOf('due')), 0, 'start');
  }
  if(!s.settings.ui){
    s.settings.ui = { accent:'#60a5fa', accentMode:'auto', density:'comfortable', radius:12, fontScale:100 };
  }else{
    if(typeof s.settings.ui.accent !== 'string') s.settings.ui.accent = '#60a5fa';
    if(!['auto','custom'].includes(s.settings.ui.accentMode)) s.settings.ui.accentMode = 'auto';
    if(!['compact','comfortable','spacious'].includes(s.settings.ui.density)) s.settings.ui.density = 'comfortable';
    const r=parseInt(s.settings.ui.radius,10); s.settings.ui.radius = Number.isFinite(r)? r : 12;
    const fs=parseInt(s.settings.ui.fontScale,10); s.settings.ui.fontScale = Number.isFinite(fs)? fs : 100;
  }
  if(!s.settings.homeFilter) s.settings.homeFilter = 'all';
  // Task fields
  (s.tasks||[]).forEach(t=>{
    if(typeof t.startAt === 'undefined') t.startAt = null;
    if(typeof t.endAt === 'undefined') t.endAt = null;
  });
  // Projects defaults
  const autoEmoji = (name='')=>{
    const n=(name||'').toLowerCase();
    if(n.includes('trading')) return '💸';
    if(n.includes('health')) return '🏋️';
    if(n.includes('family')) return '👨‍👩‍👧';
    if(n.includes('work')) return '💼';
    if(n.includes('branding')) return '✨';
    return '📁';
  };
  (s.projects||[]).forEach((p,idx)=>{
    if(!p.emoji) p.emoji = autoEmoji(p.name);
    if(typeof p.favorite === 'undefined') p.favorite = false;
    if(typeof p.sort === 'undefined') p.sort = idx;
  });
  if(!Array.isArray(s.columns) || s.columns.length<2) s.columns=[...DEFAULT_COLUMNS];
  if(!Array.isArray(s.projects)) s.projects = [];
  if(!s.projectFilter) s.projectFilter = 'all';

  const fixNum = v => { const n=parseInt(v,10); return Number.isFinite(n)? n : 1; };
  const seen = new Set(); const dedup = [];
  (s.tasks||[]).forEach(t=>{
    if(seen.has(t.id)) return; seen.add(t.id); dedup.push(t);
    if(typeof t.projectId === 'undefined') t.projectId = null;
  if(typeof t.startAt === 'undefined' || t.startAt===null) t.startAt = t.created || Date.now();
  if(typeof t.endAt === 'undefined' || t.endAt===null) t.endAt = t.due || t.startAt;
  if(t.endAt && !t.due) t.due = t.endAt;
    t.points = fixNum(t.points);
    if(!Array.isArray(t.subtasks)) t.subtasks=[];
    t.subtasks.forEach(st=>{
      if(!st.id) st.id=uid();
      st.points = fixNum(st.points);
      if(!st.status) st.status = st.done?'Done':'To do';
  if(typeof st.startAt === 'undefined' || st.startAt===null) st.startAt = t.created || Date.now();
  if(typeof st.endAt === 'undefined' || st.endAt===null) st.endAt = st.due || st.startAt;
  if(st.endAt && !st.due) st.due = st.endAt;
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
