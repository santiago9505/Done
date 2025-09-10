import { state, save } from '../core/state.js';
import { renderBoard } from '../views/board.js';

export function nextDate(from, r){
  const d = new Date(from || Date.now());
  const n = Math.max(1, parseInt(r.every||1,10));
  const skip = !!r.skipWeekends;
  function addDays(k){
    d.setDate(d.getDate()+k);
    if(skip){ while(d.getDay()===0 || d.getDay()===6){ d.setDate(d.getDate()+1); } }
  }
  switch(r.type){
    case 'daily': addDays(n); break;
    case 'weekly': addDays(7*n); break;
    case 'monthly': d.setMonth(d.getMonth()+n); break;
    case 'yearly': d.setFullYear(d.getFullYear()+n); break;
    case 'daysAfter': addDays(n); break;
    default: addDays(n);
  }
  return d.getTime();
}

export function handleRecurrence(t){
  const r = t.recur || {type:'none'};
  if(!r || r.type==='none') return;
  if(r.trigger && r.trigger!=='complete' && r.trigger!=='done') return;

  if(r.last && r.last === t.closed) return;
  r.last = t.closed;

  const base = t.due || Date.now();
  const nd = nextDate(base, r);
  const newStatus = r.nextStatus || 'To do';

  if(r.createNew){
    const clone = {...t};
    clone.id = Math.random().toString(36).slice(2)+Date.now().toString(36);
    clone.status = newStatus;
    clone.created = Date.now(); clone.updated = Date.now();
    clone.closed = null; clone.due = nd;
    clone.subtasks = (t.subtasks||[]).map(st=>({id:Math.random().toString(36).slice(2), title:st.title, desc:st.desc||'', done:false, status:'To do', points:st.points||1, due:null}));
    (state.tasks||[]).push(clone);
  }else{
    t.status = newStatus; t.closed=null; t.due = nd; t.updated = Date.now();
    (t.subtasks||[]).forEach(st=>{ st.done=false; st.status='To do'; st.due=null; });
  }
  save(); renderBoard();
}

export function applyScheduledRecurrences(){
  const now = Date.now();
  (state.tasks||[]).forEach(t=>{
    const r = t.recur || {type:'none'};
    if(!r || r.type==='none') return;
    if(r.trigger!=='schedule') return;
    if(!t.due) return;
    if(t.due <= now){
      const nd = nextDate(t.due, r);
      const newStatus = r.nextStatus || t.status || 'To do';
      if(r.createNew){
        const clone = {...t}; 
        clone.id=Math.random().toString(36).slice(2)+Date.now().toString(36); 
        clone.status=newStatus; clone.created=Date.now(); clone.updated=Date.now(); 
        clone.closed=null; clone.due=nd;
        clone.subtasks=(t.subtasks||[]).map(st=>({id:Math.random().toString(36).slice(2), title:st.title, desc:st.desc||'', done:false, status:'To do', points:st.points||1, due:null}));
        (state.tasks||[]).push(clone);
        t.due = nd;
      }else{
        t.status=newStatus; t.closed=null; t.due=nd; t.updated=Date.now();
        (t.subtasks||[]).forEach(st=>{ st.done=false; st.status='To do'; st.due=null; });
      }
      save();
    }
  });
}
