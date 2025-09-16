import { state, save, uid, FINAL_STATUS, XP_CREATE, XP_CLOSE, findTask } from '../core/state.js';
import { getProjectNameById } from '../ui/projects.js';
import { escapeHtml, escapeAttr, fmtDateTime, toLocalDatetimeInput, parseLocalDatetimeInput, subPoints, displayPoints } from '../core/utils.js';
import { addXP } from '../core/effects.js';
import { randomKillLine } from '../core/humor.js';
import { handleRecurrence } from '../logic/recurrence.js';
import { renderBoard } from './board.js';
import { renderTasksList } from './tasks.js';
import { showMega } from '../core/mega.js';
import { refresh } from '../core/bus.js';

// Quita prefijos no alfanuméricos (emojis/símbolos) para evitar doble emoji fuera del sidebar
function stripEmojiPrefix(txt){
  if(!txt) return '';
  return txt.replace(/^[^\p{L}\p{N}]+/u, '').trimStart();
}

function tagBoxHtml(tags){ 
  return `<div class="tagbox" id="t-tagbox">
    ${(tags||[]).map(x=>`<span class="tag">#${escapeHtml(x)} <span class="x" data-del="${escapeAttr(x)}">×</span></span>`).join('')}
    <input id="t-taginput" placeholder="Añadir tag…"/>
  </div>`; 
}
function captureTags(dlg){ 
  const out=[]; 
  dlg.querySelectorAll('#t-tagbox .tag').forEach(t=> 
    out.push(t.textContent.replace(/×$/,'').trim().replace(/^#/,''))
  ); 
  return out; 
}

export function openTaskDialog(init){
  const isSub = !!init.isSub;
  const isNew = !init.id;
  const t = Object.assign({
    id: uid(), title:'', desc:'', prio:'Med', due:null, tags:[], projectId: null,
    status: init.status || 'To do',
    created: Date.now(), updated: Date.now(), closed: null,
    docIds:[], points:1, subtasks:[],
    recur:{type:'none',every:1,trigger:'complete',skipWeekends:false,createNew:true,forever:true,nextStatus:'To do', last:null},
    comments: [] // NUEVO: actividad/comentarios
  }, init);
  t.comments = Array.isArray(t.comments) ? t.comments : [];

  const projectDisplayName = stripEmojiPrefix(getProjectNameById(t.projectId));

  const dlg = document.getElementById('taskDialog');
  dlg.innerHTML = `
    <form class="sheet" method="dialog" style="padding:16px 16px 10px 16px">
      <div>
        <div class="sheet-head"><div class="dot"></div><h3 class="h-title">${isSub?'Subtarea':'Tarea'}</h3><span class="chip">${isNew?'Nueva':'Editar'}</span></div>
        <div class="meta-bar">
          <span class="chip">Estado: ${t.status}</span>
          ${t.due?`<span class="chip">Vence: ${fmtDateTime(t.due)}</span>`:''}
          <span class="chip">Proyecto: ${escapeHtml(projectDisplayName)}</span>
          <span class="chip">Points: ${displayPoints(t)}</span>
        </div>
        <label>Título</label>
        <input id="t-title" value="${escapeAttr(t.title)}" placeholder="¿Qué harás?" required style="width:100%"/>
        <div class="inline-grid" style="margin-top:8px">
          <div><label>Estado</label><select id="t-status" style="width:100%">${state.columns.map(c=>`<option ${t.status===c?'selected':''}>${c}</option>`).join('')}</select></div>
          <div><label>Prioridad</label><select id="t-prio" style="width:100%"><option ${t.prio==='Low'?'selected':''}>Low</option><option ${t.prio==='Med'?'selected':''}>Med</option><option ${t.prio==='High'?'selected':''}>High</option></select></div>
        </div>
        ${isSub? '' : `<div class="inline-grid" style="margin-top:8px">
            <div>
              <label>Proyecto</label>
              <select id="t-project" style="width:100%">
                <option value="" ${t.projectId==null?'selected':''}>Sin proyecto</option>
                ${(state.projects||[]).map(p=>`<option value="${p.id}" ${t.projectId===p.id?'selected':''}>${escapeHtml(stripEmojiPrefix(p.name||''))}</option>`).join('')}
              </select>
            </div>
            <div></div>
          </div>`}
        <div class="inline-grid" style="margin-top:8px">
          <div><label>Inicio</label><input id="t-startAt" type="datetime-local" value="${t.startAt ? toLocalDatetimeInput(t.startAt) : ''}" style="width:100%"/></div>
          <div><label>Vence</label><input id="t-due" type="datetime-local" value="${t.due ? toLocalDatetimeInput(t.due) : ''}" style="width:100%"/></div>
          <div><label>Points</label><input id="t-points" type="number" min="0" step="1" value="${t.points||0}" style="width:100%" ${(t.subtasks&&t.subtasks.length && !isSub)?'disabled title="Sumado desde subtareas"':''}/></div>
        </div>
        <div style="margin-top:8px"><label>Descripción</label><textarea id="t-desc" placeholder="Detalles…" style="width:100%;min-height:120px">${escapeHtml(t.desc||'')}</textarea></div>
        <div style="margin-top:8px"><label>Tags</label>${tagBoxHtml(t.tags||[])}</div>
        ${isSub? '' : `<div style="margin-top:8px">
            <label>Subtareas (una por línea, usa [x] para marcadas) — <span class="chip">Tip: “Título | puntos”</span></label>
            <textarea id="t-subtasks" placeholder="[ ] Diseñar pantalla | 1\n[x] Escribir tests | 2" style="width:100%;min-height:100px">${(t.subtasks||[]).map(st=>`${(st.status===FINAL_STATUS||st.done)?'[x]':'[ ]'} ${escapeHtml(st.title||'')} | ${st.points||1}`).join('\n')}</textarea>
          </div>`}
        <div class="footer-actions">
          ${!isNew?`<button class="btn" id="t-delete" value="delete">Eliminar</button>`:''}
          <button class="btn" id="t-cancel" type="button">Cancelar</button>
          <button class="btn primary" id="t-save">Guardar</button>
        </div>
      </div>
      <div class="aside">
        <div class="card">
          <div class="r"><span class="chip">Recurrencia</span></div>
          <div class="r"><select id="t-recur-trigger"><option value="complete" ${t.recur?.trigger==='complete'?'selected':''}>On status change: Complete</option><option value="done" ${t.recur?.trigger==='done'?'selected':''}>On status change: Done</option><option value="schedule" ${t.recur?.trigger==='schedule'?'selected':''}>On a schedule</option></select></div>
          <div class="r"><select id="t-recur-type"><option value="none" ${t.recur?.type==='none'?'selected':''}>None</option><option value="daily" ${t.recur?.type==='daily'?'selected':''}>Daily</option><option value="weekly" ${t.recur?.type==='weekly'?'selected':''}>Weekly</option><option value="monthly" ${t.recur?.type==='monthly'?'selected':''}>Monthly</option><option value="yearly" ${t.recur?.type==='yearly'?'selected':''}>Yearly</option><option value="daysAfter" ${t.recur?.type==='daysAfter'?'selected':''}>Days after…</option></select><input id="t-recur-every" type="number" min="1" value="${t.recur?.every||1}" style="width:90px"/><span class="chip">Cada N</span></div>
          <label class="r"><input type="checkbox" id="t-recur-skip" ${t.recur?.skipWeekends?'checked':''}/> Skip weekends</label>
          <label class="r"><input type="checkbox" id="t-recur-create" ${t.recur?.createNew!==false?'checked':''}/> Create new task</label>
          <label class="r"><input type="checkbox" id="t-recur-forever" ${t.recur?.forever!==false?'checked':''}/> Recur forever</label>
          <div class="r"><span>Update status to:</span><select id="t-recur-nextstatus">${state.columns.map(c=>`<option ${t.recur?.nextStatus===c?'selected':''}>${c}</option>`).join('')}</select></div>
        </div>
        <div class="card"><div class="r"><span class="chip">Vincular docs</span></div><select id="t-docs" multiple size="6" style="width:100%">${(state.docs||[]).map(d=>`<option value="${d.id}" ${t.docIds?.includes(d.id)?'selected':''}>${escapeHtml(d.title||'Documento')}</option>`).join('')}</select></div>
        <!-- NUEVO: Comentarios/Actividad -->
        <div class="card" id="t-commentsCard">
          <div class="r" style="justify-content:space-between;align-items:center">
            <span class="chip">Comentarios</span>
            <small style="color:var(--muted)">Arrastra archivos o pega imágenes</small>
          </div>
          <div id="t-commentsList" class="sub-list" style="max-height:38vh;overflow:auto;margin-top:6px"></div>
          <div class="r" style="flex-direction:column;gap:6px;margin-top:8px">
            <div id="t-attachPreview" class="r" style="flex-wrap:wrap;gap:6px"></div>
            <textarea id="t-newComment" placeholder="Escribe un comentario…" style="width:100%;min-height:70px"></textarea>
            <div class="r" style="justify-content:space-between;width:100%">
              <div class="r" style="gap:6px">
                <input type="file" id="t-attachFile" multiple
                  accept="image/*,video/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/zip,*/*"
                  style="display:none"/>
                <button class="btn" type="button" id="t-attachBtn">Adjuntar</button>
                <span class="chip" id="t-dropHint" style="display:none">Suelta archivos aquí…</span>
              </div>
              <button class="btn primary" type="button" id="t-addComment">Agregar</button>
            </div>
          </div>
        </div>
      </div>
    </form>`;
  dlg.showModal();

  const tagBox = dlg.querySelector('#t-tagbox'); const tagInput = dlg.querySelector('#t-taginput');
  tagInput.addEventListener('keydown', (e)=>{
    if(e.key==='Enter' || e.key===','){
      e.preventDefault(); const v=tagInput.value.trim().replace(/^#/,''); if(!v) return;
      const span=document.createElement('span'); span.className='tag'; span.innerHTML=`#${escapeHtml(v)} <span class="x">×</span>`;
      span.querySelector('.x').addEventListener('click', ()=> span.remove());
      tagBox.insertBefore(span, tagInput); tagInput.value='';
    }
    if(e.key==='Backspace' && !tagInput.value){ const last=tagBox.querySelector('.tag:last-of-type'); last?.remove(); }
  });
  tagBox.querySelectorAll('.x').forEach(x=> x.addEventListener('click', ()=> x.parentElement.remove()));

  // ===== NUEVO: Comentarios con adjuntos =====
  const listEl = dlg.querySelector('#t-commentsList');
  const attachBtn = dlg.querySelector('#t-attachBtn');
  const attachInput = dlg.querySelector('#t-attachFile');
  const attachPreview = dlg.querySelector('#t-attachPreview');
  const newCommentEl = dlg.querySelector('#t-newComment');
  const dropHint = dlg.querySelector('#t-dropHint');

  let draftFiles = []; // {id,name,type,size,dataUrl}

  function renderAttachPreview(){
    attachPreview.innerHTML = draftFiles.map(f=>{
      const safeName = escapeHtml(f.name||'archivo');
      if((f.type||'').startsWith('image/')){
        return `<div class="tag" data-remove="${f.id}" title="${safeName}">
          <img src="${f.dataUrl}" alt="${safeName}" style="width:64px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--border)"/>
          <span class="x">×</span>
        </div>`;
      }
      if((f.type||'').startsWith('video/')){
        return `<div class="tag" data-remove="${f.id}" title="${safeName}">🎬 ${safeName} <span class="x">×</span></div>`;
      }
      return `<div class="tag" data-remove="${f.id}" title="${safeName}">📎 ${safeName} <span class="x">×</span></div>`;
    }).join('');
    attachPreview.querySelectorAll('[data-remove] .x').forEach(x=>{
      x.addEventListener('click', ()=>{
        const id = x.parentElement.getAttribute('data-remove');
        draftFiles = draftFiles.filter(df=>df.id!==id);
        renderAttachPreview();
      });
    });
  }

  function renderComments(){
    if(!Array.isArray(t.comments)) t.comments=[];
    listEl.innerHTML = t.comments.slice().sort((a,b)=>a.ts-b.ts).map(c=>{
      const when = new Date(c.ts||Date.now()).toLocaleString();
      const text = escapeHtml(c.text||'');
      const filesHtml = (c.files||[]).map(f=>{
        const safeName = escapeHtml(f.name||'archivo');
        if((f.type||'').startsWith('image/')){
          return `<a href="${f.dataUrl}" target="_blank" download="${safeName}" class="tag" title="${safeName}">
            <img src="${f.dataUrl}" alt="${safeName}" style="width:80px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border)"/>
          </a>`;
        }
        if((f.type||'').startsWith('video/')){
          return `<video src="${f.dataUrl}" controls style="width:160px;max-width:100%;border-radius:8px;border:1px solid var(--border)"></video>`;
        }
        return `<a href="${f.dataUrl}" download="${safeName}" class="tag" title="${safeName}">📎 ${safeName}</a>`;
      }).join('');
      return `<div class="sub-row" data-cid="${c.id}">
        <div style="flex:1">
          <div style="font-size:12px;color:var(--muted)">${when}</div>
          ${text?`<div style="margin:4px 0">${text.replace(/\n/g,'<br/>')}</div>`:''}
          <div class="r" style="flex-wrap:wrap;gap:6px">${filesHtml}</div>
        </div>
        <span class="x" data-delc="${c.id}" title="Eliminar">×</span>
      </div>`;
    }).join('');
    listEl.querySelectorAll('[data-delc]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-delc');
        t.comments = (t.comments||[]).filter(c=>c.id!==id);
        t.updated = Date.now(); save(); renderComments();
      });
    });
  }

  function fileToDataUrl(file){
    return new Promise((res,rej)=>{
      const fr = new FileReader();
      fr.onload = ()=> res(fr.result);
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }

  async function addFiles(files){
    for(const f of files){
      try{
        const dataUrl = await fileToDataUrl(f);
        draftFiles.push({ id:uid(), name:f.name, type:f.type, size:f.size, dataUrl });
      }catch{}
    }
    renderAttachPreview();
  }

  attachBtn.addEventListener('click', ()=> attachInput.click());
  attachInput.addEventListener('change', async (e)=>{
    const files = Array.from(e.target.files||[]);
    await addFiles(files);
    attachInput.value='';
  });

  // Soporte drag & drop en la tarjeta de comentarios
  const commentsCard = dlg.querySelector('#t-commentsCard');
  commentsCard.addEventListener('dragover', (e)=>{ e.preventDefault(); dropHint.style.display='inline-block'; });
  commentsCard.addEventListener('dragleave', ()=>{ dropHint.style.display='none'; });
  commentsCard.addEventListener('drop', async (e)=>{
    e.preventDefault(); dropHint.style.display='none';
    const files = Array.from(e.dataTransfer?.files||[]);
    if(files.length) await addFiles(files);
  });

  // Pegar imagen desde portapapeles
  newCommentEl.addEventListener('paste', async (e)=>{
    const items = Array.from(e.clipboardData?.items||[]);
    const files = items.filter(i=>i.kind==='file').map(i=>i.getAsFile()).filter(Boolean);
    if(files.length){ await addFiles(files); }
  });

  dlg.querySelector('#t-addComment').addEventListener('click', ()=>{
    const txt = (newCommentEl.value||'').trim();
    if(!txt && !draftFiles.length) return;
    const c = { id:uid(), ts:Date.now(), text:txt, files:[...draftFiles] };
    (t.comments || (t.comments=[])).push(c);
    draftFiles = []; newCommentEl.value=''; renderAttachPreview(); renderComments();
    t.updated = Date.now();
    if(!isNew){
      // Persistir inmediatamente en edición de tarea existente
      const idx = (state.tasks||[]).findIndex(x=>x.id===t.id);
      if(idx>=0){ state.tasks[idx]=t; save(); renderBoard(); renderTasksList(); refresh.home(); }
    }
  });

  renderComments();

  // ===== FIN NUEVO: Comentarios =====

  dlg.querySelector('#t-save').addEventListener('click', (e)=>{
    e.preventDefault();
    const title = dlg.querySelector('#t-title').value.trim(); if(!title){ alert('Falta título'); return; }
    t.title = title;
    t.status = dlg.querySelector('#t-status').value;
    t.prio   = dlg.querySelector('#t-prio').value;

    // NUEVO: guardar Inicio (startAt)
    const startVal = dlg.querySelector('#t-startAt').value;
    t.startAt = startVal ? parseLocalDatetimeInput(startVal) : null;

    const dueVal = dlg.querySelector('#t-due').value; t.due = dueVal ? parseLocalDatetimeInput(dueVal) : null;
    t.points = parseInt(dlg.querySelector('#t-points').value||'0',10);
    t.desc   = dlg.querySelector('#t-desc').value;
    t.tags   = captureTags(dlg);
    if(!isSub){
      const pjSel = dlg.querySelector('#t-project');
      if(pjSel){ const v=pjSel.value; t.projectId = v? v : null; }
    }
    t.recur = {
      type: dlg.querySelector('#t-recur-type').value,
      every: parseInt(dlg.querySelector('#t-recur-every').value||'1',10),
      trigger: dlg.querySelector('#t-recur-trigger').value,
      skipWeekends: dlg.querySelector('#t-recur-skip').checked,
      createNew: dlg.querySelector('#t-recur-create').checked,
      forever: dlg.querySelector('#t-recur-forever').checked,
      nextStatus: dlg.querySelector('#t-recur-nextstatus').value,
      last: t.recur?.last || null
    };
    t.docIds = Array.from(dlg.querySelector('#t-docs').selectedOptions).map(o=>o.value);

    if(!isSub){
      const stLines = (dlg.querySelector('#t-subtasks')?.value||'').split('\n').map(l=>l.trim()).filter(Boolean);
      t.subtasks = stLines.map(l=>{
        const done=/^\[x\]/i.test(l);
        const cleaned=l.replace(/^\[[x ]\]\s?/i,'');
        const [title, pts] = cleaned.split('|').map(s=>s?.trim()||'');
        return {id:uid(), title, desc:'', done, status: done? FINAL_STATUS : 'To do', points: parseInt(pts||'1',10), due:null};
      });
      if(t.subtasks.length) t.points = subPoints(t);
    }else{
      const p = findTask(t.parentId); if(p){
        const idx=p.subtasks.findIndex(s=>s.id===t.id);
        const newSt={id:t.id,title:t.title,desc:t.desc||'',done:(t.status===FINAL_STATUS),status:t.status,points:t.points,due:t.due};
        if(idx>=0) p.subtasks[idx]=newSt; else p.subtasks.push(newSt);
        p.points=subPoints(p); p.updated=Date.now(); save(); renderBoard(); renderTasksList(); refresh.home();
      }
      dlg.close(); return;
    }

    t.updated = Date.now();
    if(isNew){ (state.tasks||[]).push(t); save(); addXP(XP_CREATE); toast('Tarea creada'); }
    else{ const idx = state.tasks.findIndex(x=>x.id===t.id); if(idx>=0) state.tasks[idx]=t; save(); toast('Tarea guardada'); }
    dlg.close(); renderBoard(); renderTasksList(); refresh.home();
  });

  dlg.querySelector('#t-delete')?.addEventListener('click',(e)=>{
    e.preventDefault(); if(!confirm('¿Eliminar?')) return;
    if(isSub){ const p=findTask(t.parentId); p.subtasks=p.subtasks.filter(s=>s.id!==t.id); p.points=subPoints(p); p.updated=Date.now(); save(); }
    else { state.tasks = (state.tasks||[]).filter(x=>x.id!==t.id); save(); }
    dlg.close(); renderBoard(); renderTasksList(); refresh.home(); toast('Eliminada');
  });

  dlg.querySelector('#t-cancel').addEventListener('click',()=> dlg.close());
}

export function closeTask(id){
  const t = findTask(id); if(!t) return;
  if(t.status===FINAL_STATUS) return;
  t.status=FINAL_STATUS; t.closed=Date.now(); t.updated=Date.now(); save();

  const today=new Date().toISOString().slice(0,10);
  if(state.lastDayClosed!==today){
    const prev=state.lastDayClosed? new Date(state.lastDayClosed): null; 
    const diff=prev ? (new Date(today)-prev) : 0; 
    state.streak = (diff===86400000) ? (state.streak||0)+1 : 1; 
    state.lastDayClosed=today; 
  }

  addXP(XP_CLOSE); showMega(randomKillLine());
  try{ handleRecurrence(t); }catch{}
  renderBoard(); renderTasksList(); refresh.home();
}

function toast(msg){ 
  const t=document.createElement('div'); 
  t.textContent=msg; 
  t.style.cssText='position:fixed;bottom:16px;right:16px;background:var(--panel);border:1px solid var(--border);box-shadow:var(--shadow);padding:10px 14px;border-radius:12px;z-index:99999;max-width:360px'; 
  document.body.appendChild(t); 
  setTimeout(()=>{ t.style.opacity='0'; t.style.transform='translateY(6px)'; t.style.transition='all .3s' }, 2000); 
  setTimeout(()=> t.remove(), 2500); 
}
