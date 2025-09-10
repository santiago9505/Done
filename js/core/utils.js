import { FINAL_STATUS } from './state.js';

export function todayStr(){return new Date().toISOString().slice(0,10)}
export function endOfDay(ts){ const d = new Date(ts||Date.now()); d.setHours(23,59,0,0); return d.getTime(); }
export function isSameDay(a,b){return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()}
export function escapeHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
export function escapeAttr(s){return escapeHtml(s).replace(/\"/g,'&quot;')}
export function fmtDateTime(ts){ if(!ts) return ''; const d=new Date(ts); return d.toLocaleDateString()+ ' ' + d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}); }
export function overdue(t){ return t.status!==FINAL_STATUS && t.due && t.due < Date.now(); }
export function getPrimaryTag(t){ return (t.tags&&t.tags[0]) || 'No tag'; }

// datetime-local (local, no UTC shift)
export function toLocalDatetimeInput(ts){
  if(!ts) return '';
  const d = new Date(ts);
  const pad = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function parseLocalDatetimeInput(v){
  if(!v) return null;
  const [date, time] = v.split('T');
  const [y,m,d] = date.split('-').map(Number);
  const [hh,mm] = time.split(':').map(Number);
  return new Date(y, m-1, d, hh, mm).getTime();
}

// puntos seguros
export function subPoints(t){
  return (t.subtasks||[]).reduce((a,s)=>{
    const n = parseInt(s?.points, 10);
    return a + (Number.isFinite(n) ? n : 0);
  }, 0);
}
export function displayPoints(t){
  if (t.subtasks && t.subtasks.length) return subPoints(t);
  const n = parseInt(t.points, 10);
  return Number.isFinite(n) ? n : 0;
}
