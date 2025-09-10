import { state, FINAL_STATUS } from '../core/state.js';
import { isSameDay, displayPoints } from '../core/utils.js';

let summaryMode='days';

function startOfWeekMonday(d){ const x=new Date(d); const day=(x.getDay()+6)%7; x.setHours(0,0,0,0); x.setDate(x.getDate()-day); return x; }
function getWeekNumber(d){ const dt=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const dayNum = (dt.getUTCDay() + 6) % 7; dt.setUTCDate(dt.getUTCDate() - dayNum + 3); const firstThursday = new Date(Date.UTC(dt.getUTCFullYear(),0,4)); const weekNum = 1 + Math.round(((dt - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7); return weekNum; }

export function renderSummary(){
  const host=document.getElementById('view-summary'); if(!host) return;

  const done = (state.tasks||[]).filter(t=>t.status===FINAL_STATUS);

  function daysOfCurrentWeek(){
    const start = startOfWeekMonday(new Date());
    return Array.from({length:7}, (_,i)=> {
      const d = new Date(start); d.setDate(start.getDate()+i);
      const pts=done.filter(t=> isSameDay(new Date(t.closed||0), d)).reduce((a,t)=>a+displayPoints(t),0);
      const cnt=done.filter(t=> isSameDay(new Date(t.closed||0), d)).length;
      return {label:d.toLocaleDateString(undefined,{weekday:'short'}), pts, cnt, isToday:isSameDay(d,new Date())};
    });
  }
  function lastNWeeks(n=8){
    const arr=[]; const now=new Date(); 
    for(let i=n-1;i>=0;i--){
      const start = new Date(startOfWeekMonday(now)); start.setDate(start.getDate()-7*i);
      const end = new Date(start); end.setDate(start.getDate()+7);
      const pts=done.filter(t=> (t.closed||0)>=start && (t.closed||0)<end).reduce((a,t)=>a+displayPoints(t),0);
      const cnt=done.filter(t=> (t.closed||0)>=start && (t.closed||0)<end).length;
      arr.push({label:`${start.toLocaleDateString(undefined,{month:'short'})} • W${getWeekNumber(start)}`, pts, cnt, isToday:false});
    } 
    return arr;
  }
  function monthsOfYear(){
    const y=new Date().getFullYear(); 
    return Array.from({length:12},(_,m)=>{
      const s=new Date(y,m,1); const e=new Date(y,m+1,1);
      const pts=done.filter(t=> (t.closed||0)>=s && (t.closed||0)<e).reduce((a,t)=>a+displayPoints(t),0);
      const cnt=done.filter(t=> (t.closed||0)>=s && (t.closed||0)<e).length;
      return {label:s.toLocaleDateString(undefined,{month:'short'}), pts, cnt, isToday:(new Date().getMonth()===m)};
    });
  }

  const data = summaryMode==='days'? daysOfCurrentWeek() : summaryMode==='weeks'? lastNWeeks(8) : monthsOfYear();

  const startOfDay = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
  const startWeek = startOfWeekMonday(new Date());
  const startMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const startYear = new Date(new Date().getFullYear(), 0, 1);
  const ptsDay = done.filter(t=> new Date(t.closed||0) >= startOfDay).reduce((a,t)=>a+displayPoints(t),0);
  const ptsWeek = done.filter(t=> new Date(t.closed||0) >= startWeek).reduce((a,t)=>a+displayPoints(t),0);
  const ptsMonth = done.filter(t=> new Date(t.closed||0) >= startMonth).reduce((a,t)=>a+displayPoints(t),0);
  const ptsYear = done.filter(t=> new Date(t.closed||0) >= startYear).reduce((a,t)=>a+displayPoints(t),0);

  host.innerHTML = `
    <div class="cards">
      <div class="card"><div style="font-size:12px;color:var(--muted)">Tareas totales</div><div style="font-size:28px;font-weight:800">${(state.tasks||[]).length}</div></div>
      <div class="card"><div style="font-size:12px;color:var(--muted)">Racha</div><div style="font-size:28px;font-weight:800">${state.streak||0} días</div></div>
      <div class="card"><div style="font-size:12px;color:var(--muted)">Sprint points</div><div class="chip">Día: ${ptsDay}</div><div class="chip">Semana: ${ptsWeek}</div><div class="chip">Mes: ${ptsMonth}</div><div class="chip">Año: ${ptsYear}</div></div>
      <div class="card"><div style="font-size:12px;color:var(--muted)">Vista</div><div class="seg"><button class="${summaryMode==='days'?'btn primary':'btn'}" data-mode="days">Días</button><button class="${summaryMode==='weeks'?'btn primary':'btn'}" data-mode="weeks">Semanas</button><button class="${summaryMode==='months'?'btn primary':'btn'}" data-mode="months">Meses</button></div></div>
    </div>
    <div class="card" style="margin-top:12px">
      <div style="font-weight:700;margin-bottom:8px">Puntos (${summaryMode})</div>
      <div style="display:grid;grid-template-columns:repeat(${data.length},1fr);gap:10px;align-items:end;min-height:180px">
        ${data.map(d=>`<div class="bar" title="${d.pts}" style="height:${10+ d.pts*12}px;${d.isToday?'outline:2px solid var(--accent);':''}">
            <div class="tooltip">${d.cnt} completadas · ${d.pts} pt</div>
        </div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(${data.length},1fr);gap:10px;margin-top:6px;color:var(--muted);font-size:12px">
        ${data.map(d=>`<div style="text-align:center">${d.label}</div>`).join('')}
      </div>
    </div>`;

  host.querySelectorAll('[data-mode]').forEach(b=> b.addEventListener('click', ()=>{ summaryMode=b.dataset.mode; renderSummary(); }));
}
