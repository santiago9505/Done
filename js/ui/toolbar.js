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
    menu.className = 'menu-popup';
    menu.style.left = Math.round(r.left) + 'px';
    menu.style.top = Math.round(r.bottom+8) + 'px';
    const mk = (id,label)=>{ const b=document.createElement('button'); b.className='btn'; b.textContent=label; b.addEventListener('click',()=>{ setThemeMode(id); close(); }); return b; };
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
  // Hybrid command/search input behaviors
  const wrap = document.getElementById('searchWrap');
  const input = document.getElementById('globalSearch');
  const micBtn = document.getElementById('micBtn');
  const expBtn = document.getElementById('expandSearch');
  const dd = document.getElementById('searchDropdown');
  let ddItems = []; let ddIndex = -1; let recognizing = false; let rec; let recFinalText="";
  // Draft for create-task panel
  let createDraft = null;
  const getActiveField = ()=> document.getElementById('globalSearchML') || input;
  function autoGrow(ta){ if(!ta) return; ta.style.height='auto'; const max=Math.round(window.innerHeight*0.4); ta.style.height=Math.min(ta.scrollHeight, max)+"px"; }
  function isSearchModalOpen(){ return !!document.getElementById('searchOverlay'); }
  function textWidthForInput(txt){
    try{
      const el=input; if(!el) return 0; const cs=getComputedStyle(el);
      const canvas=textWidthForInput._c||(textWidthForInput._c=document.createElement('canvas'));
      const ctx=canvas.getContext('2d'); if(!ctx) return 0; ctx.font = cs.font || `${cs.fontSize} ${cs.fontFamily}`;
      return ctx.measureText(txt).width;
    }catch{ return 0; }
  }
  function ensureModalIfOverflow(){
    if(isSearchModalOpen()) return;
    const q=(input?.value||''); if(!q) return;
    if(/\n/.test(q)){ try{ openSearchModal(); }catch{} return; }
    // Estimate available width inside the small bar
    const sRight = wrap?.querySelector('.s-right');
    const leftIcon = wrap?.querySelector('#searchCmd');
    const avail = Math.max(0, (wrap?.clientWidth||0) - (sRight?.offsetWidth||0) - (leftIcon?.offsetWidth||0) - 32);
    const w = textWidthForInput(q);
    if(w > avail*0.96){ try{ openSearchModal(); }catch{} }
  }
  function setExpanded(on){ if(!wrap) return; wrap.classList.toggle('expanded', !!on); getActiveField()?.setAttribute('aria-expanded', on?'true':'false'); }
  function openDD(){ if(!dd) return; dd.hidden=false; getActiveField()?.setAttribute('aria-expanded','true'); }
  function closeDD(){
    if(!dd) return;
    dd.hidden=true;
    getActiveField()?.setAttribute('aria-expanded','false');
    ddIndex=-1;
    // Reset create draft so the form starts fresh next time
    createDraft = null;
    renderDD();
  }
  function renderDD(){
    if(!dd) return;
    const listHtml = ddItems.map((it,i)=>`<div class="item" role="option" aria-selected="${i===ddIndex?'true':'false'}" data-id="${i}"><span>${it.label}</span><span class="op-70">${it.kbd||''}</span></div>`).join('');
    const panelHtml = createDraft ? renderCreatePanel() : '';
    dd.innerHTML = panelHtml + listHtml;
    if(createDraft) wireCreatePanel();
  }
  // Escape utility for HTML
  function esc(s){ return (s||'').replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
  // Finalize phrases (ES/EN)
  function hasFinalizePhrase(q){
    const t=(q||'').toLowerCase().replace(/[’`]/g, "'");
    return /(eso\s+es\s+todo|con\s+eso\s+es\s+todo|listo)\b|\b(that'?s\s+it|that'?s\s+all|done)\b/.test(t);
  }
  function stripFinalizePhrases(txt){
    if(!txt) return txt;
    let t=txt.replace(/[’`]/g, "'");
    // remove trailing finalize phrases and surrounding punctuation/spaces
    t=t.replace(/[,;\s]*\b(eso\s+es\s+todo|con\s+eso\s+es\s+todo|that'?s\s+it|that'?s\s+all|done|listo)\b[,;\s]*$/i, '').trim();
    return t;
  }
  function sanitizeFinalizeEverywhere(txt){
    if(!txt) return txt;
    let t=txt.replace(/[’`]/g, "'");
    t=t.replace(/\b(eso\s+es\s+todo|con\s+eso\s+es\s+todo|that'?s\s+it|that'?s\s+all|done|listo)\b[\s,.;:!?]*/ig, ' ');
    return t.replace(/\s{2,}/g,' ').trimStart();
  }
  // Create-task triggers (ES/EN) anywhere
  const CREATE_TRIGGERS_RE = /\b(crear\s+(?:una\s+)?tarea|nueva\s+tarea|agregar\s+tarea|añadir\s+tarea|create\s+(?:a\s+)?task|new\s+task|add\s+(?:a\s+)?task)\b/ig;
  function sanitizeCreateTitle(txt){
    if(!txt) return '';
    let t = (''+txt).replace(/[’`]/g, "'");
    // remove finalize phrases and create triggers anywhere
    t = t.replace(/\b(eso\s+es\s+todo|con\s+eso\s+es\s+todo|that'?s\s+it|that'?s\s+all|done|listo)\b/ig,' ');
    t = t.replace(CREATE_TRIGGERS_RE, ' ');
    // collapse punctuation near spaces
    t = t.replace(/\s+[.,;:]+/g, match=>match.trim());
    // trim leading punctuation and dashes
    t = t.replace(/^[\s\p{Pd}.,;:!¡¿?\-–—]+/u,'');
    // collapse spaces and trim
    t = t.replace(/\s{2,}/g,' ').trim();
    return t;
  }
    // If the input starts with a create-task command, we want to hide that prefix in the field (show only the title)
    const CREATE_START_RE = /^\s*(crear\s+(?:una\s+)?tarea|nueva\s+tarea|agregar\s+tarea|añadir\s+tarea|create\s+(?:a\s+)?task|new\s+task|add\s+(?:a\s+)?task)\b[:\-\s]*/i;
  // Guess language based on text content
  function guessLangFromText(txt){
    const t=(txt||'').toLowerCase();
    const hasES = /(crear\s+tarea|nueva\s+tarea|agregar\s+tarea|añadir\s+tarea|hoy|mañana|semana|eso\s+es\s+todo|con\s+eso\s+es\s+todo|llamar|comprar|revisar)/.test(t);
    const hasEN = /(create\s+task|new\s+task|add\s+task|today|tomorrow|this\s+week|that'?s\s+(it|all)|call|buy|review)/.test(t);
    if(hasES && !hasEN) return 'es-ES';
    if(hasEN && !hasES) return 'en-US';
    // If both or none, fall back to preferred languages
    const prefs=(navigator.languages||[navigator.language||'en-US']).map(x=>String(x||'').toLowerCase());
    if(prefs.some(x=>x.startsWith('es'))) return 'es-ES';
    return 'en-US';
  }
  // Detect and parse "crear tarea" / "create task" intent; returns a draft or null
  function parseCreateTask(q){
    const raw=q||''; if(!raw.trim()) return null;
    const re=/(?:^|\s)(crear\s+(?:una\s+)?tarea|nueva\s+tarea|agregar\s+tarea|añadir\s+tarea|create\s+(?:a\s+)?task|new\s+task|add\s+(?:a\s+)?task)\s*[:\-]?\s*(.*)$/i;
    const m=re.exec(raw);
    if(!m) return null;
    let title=(m[2]||'').trim();
    // Pull quoted title if available
    const mQuote=raw.match(/"([^"]+)"|'([^']+)'/);
    if(!title && mQuote){ title=(mQuote[1]||mQuote[2]||'').trim(); }
    title = title.replace(/^(que|para)\s+/i,'').trim();
    title = sanitizeCreateTitle(title);
    return { title, prio:'Med', due:null, checklistRaw:'', _dueKey:'none', source:raw };
  }
  function dateForQuick(val){ const now=new Date(); const d=new Date(); d.setHours(23,59,0,0); if(val==='today') return d.getTime(); if(val==='tomorrow'){ d.setDate(now.getDate()+1); return d.getTime(); } if(val==='week'){ const day=(now.getDay()||7); const toSun=7-day; d.setDate(now.getDate()+toSun); return d.getTime(); } return null; }
  function renderCreatePanel(){ if(!dd || !createDraft) return ''; const d=createDraft; return `
    <div class="item create-panel" role="group" aria-label="Crear tarea">
      <div class="cp-title">Crear tarea</div>
      <div class="cp-field"><div class="label">Título</div><div class="cp-title-preview">${esc(d.title||'Nueva tarea')}</div></div>
      <div class="cp-chips"><span class="label">Prioridad</span>
        <button class="chip ${d.prio==='High'?'active':''}" data-act="set-prio" data-val="High" type="button">Alta</button>
        <button class="chip ${d.prio==='Med'?'active':''}" data-act="set-prio" data-val="Med" type="button">Media</button>
        <button class="chip ${d.prio==='Low'?'active':''}" data-act="set-prio" data-val="Low" type="button">Baja</button>
      </div>
      <div class="cp-chips"><span class="label">Vencimiento</span>
        <button class="chip ${d.due && d._dueKey==='today'?'active':''}" data-act="set-due" data-val="today" type="button">Hoy</button>
        <button class="chip ${d.due && d._dueKey==='tomorrow'?'active':''}" data-act="set-due" data-val="tomorrow" type="button">Mañana</button>
        <button class="chip ${d.due && d._dueKey==='week'?'active':''}" data-act="set-due" data-val="week" type="button">Esta semana</button>
        <button class="chip ${!d.due?'active':''}" data-act="set-due" data-val="none" type="button">Sin fecha</button>
      </div>
      <div class="cp-checklist"><label for="ddChecklist">Checklist (una por línea)</label>
        <textarea id="ddChecklist" rows="2" placeholder="Escribe subtareas…">${esc(d.checklistRaw||'')}</textarea>
      </div>
      <div class="cp-actions">
        <button class="btn primary" data-act="create" type="button">Crear</button>
      </div>
    </div>`; }
  function wireCreatePanel(){
    const panel = dd?.querySelector('.create-panel');
    if(!panel) return;
    panel.addEventListener('click', (e)=>{
      const btn=e.target.closest('button'); if(!btn) return; const act=btn.getAttribute('data-act'); const val=btn.getAttribute('data-val');
      if(act==='set-prio'){ createDraft.prio=val; renderDD(); return; }
      if(act==='set-due'){
        if(val==='none'){ createDraft.due=null; createDraft._dueKey='none'; }
        else { createDraft.due=dateForQuick(val); createDraft._dueKey=val; }
        renderDD(); return;
      }
      if(act==='create'){ createTaskFromDraft(); }
    });
    const ta=panel.querySelector('#ddChecklist');
    if(ta){ ta.addEventListener('input', ()=>{ createDraft.checklistRaw=ta.value; }); }
  }
  function checklistToSubtasks(raw){ const arr=(raw||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean); return arr.map(t=>({ id: uid(), title: t, done:false })); }
  function createTaskFromDraft(){ if(!createDraft) return; const title=(createDraft.title||'Nueva tarea').trim(); const subtasks=checklistToSubtasks(createDraft.checklistRaw); const pid=getCurrentProjectId(); const init={ title, prio:createDraft.prio||'Med', due:createDraft.due||null, subtasks, status:'To do' }; if(pid!==undefined) init.workspaceId=pid; closeDD(); try{ if(isSearchModalOpen()) closeSearchModal(); }catch{} openTaskDialog(init); }
  function setIndex(i){ ddIndex = Math.max(0, Math.min(ddItems.length-1, i)); renderDD(); const el = dd?.querySelector(`[data-id="${ddIndex}"]`); el?.scrollIntoView({block:'nearest'}); }
  function isCommand(s){ return s.trim().startsWith('>'); }
  function detectTaskIntent(s){
    // simple heuristic: verb + time keyword
    const txt=s.toLowerCase();
    const verb = /(hacer|crear|recordar|anotar|escribir|preparar|planear|comprar|llamar|enviar|revisar|terminar)/.test(txt);
    const time = /(hoy|mañana|pasado|\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo)\b|\b\d{1,2}(am|pm)\b|\b\d{1,2}:\d{2}\b)/.test(txt);
    return verb && time;
  }
  let debTimer=null;
  let finalizeToken=null; // prevent duplicate finalize actions for same text
  function onInput(){
    const fld = getActiveField();
    const qRaw=(fld?.value||'');
    const finalizeNow = hasFinalizePhrase(qRaw);
    // If finalize phrase present, sanitize it out of the field immediately
    let q = qRaw;
    if(finalizeNow && fld){
      const sanitized = sanitizeFinalizeEverywhere(qRaw);
      if(sanitized !== qRaw){ fld.value = sanitized; try{ const L=fld.value.length; fld.setSelectionRange(L,L); }catch{} }
      q = sanitized;
    }
    // Expand on focus/typing
    setExpanded(true);
    // Auto-open modal when text overflows small bar or is multiline
    if(fld===input){ ensureModalIfOverflow(); }
    clearTimeout(debTimer);
    // Build suggestions
    const items=[];
    // Detect create-task intent and build draft panel
    createDraft = parseCreateTask(q);
    // While in create mode, keep the field showing only the cleaned title (ignore trigger words)
    if(createDraft && fld){
      const newVal = sanitizeCreateTitle(createDraft.title||'');
      if(newVal !== (fld.value||'')){
        fld.value = newVal;
        q = newVal;
        try{ const L=fld.value.length; fld.setSelectionRange(L,L); }catch{}
      }
    }
  function createTaskFromDraft(){
    if(!createDraft) return;
    const title=sanitizeCreateTitle(createDraft.title||'Nueva tarea');
    const subtasks=checklistToSubtasks(createDraft.checklistRaw);
    const pid=getCurrentProjectId();
    const init={ title, prio:createDraft.prio||'Med', due:createDraft.due||null, subtasks, status:'To do' };
    if(pid!==undefined) init.workspaceId=pid;
    closeDD();
    try{ if(isSearchModalOpen()) closeSearchModal(); }catch{}
    // Open dialog to finish creating
    openTaskDialog(init);
    // Clear search fields so the command/query does not linger
    try{
      const fld = getActiveField();
      if(fld) fld.value='';
      if(input) input.value='';
      finalizeToken=null; createDraft=null;
    }catch{}
  }
    if(isCommand(q)){
      items.push({ type:'cmd', label:'Ejecutar comando', kbd:'Enter' });
    }else if(detectTaskIntent(q)){
      items.push({ type:'task', label:`Crear tarea: “${q.trim()}”`, kbd:'Enter' });
    }
    // Placeholder: global search results would go here
    ddItems = items; renderDD(); if(items.length || createDraft) openDD(); else closeDD();

    // Auto-finalize if phrase present
    if(createDraft && finalizeNow){
      const token=q.trim();
      if(token !== finalizeToken){ finalizeToken=token; createTaskFromDraft(); }
    } else if(finalizeToken && q.trim()!==finalizeToken) {
      // reset guard when text changes and finalize phrase no longer present
      finalizeToken=null;
    }
    debTimer=setTimeout(()=>{
      // emit global-search for other views
      try{ window.dispatchEvent(new CustomEvent('global-search', { detail:{ q } })); }catch{}
    }, 250);
  }
  input?.addEventListener('input', onInput);
  input?.addEventListener('focus', ()=> setExpanded(true));
  input?.addEventListener('blur', ()=> setTimeout(()=>{ setExpanded(false); closeDD(); }, 120));
  // Fullscreen search modal behavior
  let overlayEl=null, placeholderNode=null, originalParent=null, originalNext=null;
  function openSearchModal(){
    if(!wrap || overlayEl) return;
    originalParent = wrap.parentNode; originalNext = wrap.nextSibling; placeholderNode = document.createComment('searchWrap-placeholder');
    originalParent.insertBefore(placeholderNode, wrap);
    overlayEl = document.createElement('div'); overlayEl.id='searchOverlay'; overlayEl.className='search-overlay'; overlayEl.setAttribute('aria-modal','true'); overlayEl.setAttribute('role','dialog');
    const slot=document.createElement('div'); slot.className='search-modal-slot'; overlayEl.appendChild(slot);
    document.body.appendChild(overlayEl);
    document.body.classList.add('search-modal-open');
    slot.appendChild(wrap);
    // Create multiline field if not present
    let ml = wrap.querySelector('#globalSearchML');
    if(!ml){
      ml = document.createElement('textarea'); ml.id='globalSearchML'; ml.className='ml-field'; ml.rows=4;
      ml.placeholder = input?.getAttribute('placeholder')||''; ml.setAttribute('aria-label', input?.getAttribute('aria-label')||'Buscar');
      ml.value = input?.value || '';
      const sRight = wrap.querySelector('.s-right'); wrap.insertBefore(ml, sRight||null);
      ml.addEventListener('input', ()=>{ autoGrow(ml); onInput(); });
      ml.addEventListener('focus', ()=> setExpanded(true));
      ml.addEventListener('blur', ()=> setTimeout(()=>{ setExpanded(false); closeDD(); }, 120));
      ml.addEventListener('keydown', (e)=>{
        if(e.key==='Escape'){ if(recognizing) stopMic(); closeDD(); ml.blur(); return; }
        if(e.key==='ArrowDown'){ if(ddItems.length){ e.preventDefault(); setIndex(ddIndex<0?0:ddIndex+1); } }
        if(e.key==='ArrowUp'){ if(ddItems.length){ e.preventDefault(); setIndex(ddIndex<=0?ddItems.length-1:ddIndex-1); } }
      });
    }
    setExpanded(true);
    autoGrow(ml);
    ml?.focus();
    // Close on outside click
    overlayEl.addEventListener('mousedown', (e)=>{ if(e.target===overlayEl) closeSearchModal(); });
    // Close on Esc
    const onEsc=(e)=>{ if(e.key==='Escape'){ e.preventDefault(); closeSearchModal(); document.removeEventListener('keydown', onEsc, true); } };
    setTimeout(()=> document.addEventListener('keydown', onEsc, true), 0);
  }
  function closeSearchModal(){
    if(!overlayEl || !placeholderNode || !originalParent) return;
    // Play closing animation, then teardown
    try{ overlayEl.classList.add('closing'); }catch{}
    const doTeardown=()=>{
      // Sync back value and remove multiline
      const ml = wrap.querySelector('#globalSearchML'); if(ml && input){ input.value = ml.value; ml.remove(); }
      // Restore element to original position
      if(originalNext && originalNext.parentNode===originalParent){ originalParent.insertBefore(wrap, originalNext); }
      else { originalParent.appendChild(wrap); }
      placeholderNode.remove(); placeholderNode=null; originalParent=null; originalNext=null;
      document.body.classList.remove('search-modal-open');
      overlayEl?.remove(); overlayEl=null;
      setExpanded(false);
    };
    // Prefer waiting for overlay animation end; fallback with timeout
    let done=false; const fallback=setTimeout(()=>{ if(done) return; done=true; doTeardown(); }, 210);
    overlayEl.addEventListener('animationend', function handler(e){
      if(e.target!==overlayEl) return; // only when overlay fade finishes
      overlayEl.removeEventListener('animationend', handler);
      if(done) return; done=true; clearTimeout(fallback); doTeardown();
    });
  }
  // If task dialog is cancelled/closed without saving, forget pending creation and clear field
  try{
    window.addEventListener('task-dialog:cancelled', ()=>{
      createDraft=null; finalizeToken=null; const fld=getActiveField(); if(fld) fld.value=''; if(input) input.value=''; closeDD();
    });
    window.addEventListener('task-dialog:closed', ()=>{
      // If not saved (save handler triggers different refresh), ensure we're not stuck in create mode
      if(createDraft){ createDraft=null; finalizeToken=null; const fld=getActiveField(); if(fld) fld.value=''; if(input) input.value=''; closeDD(); }
    });
  }catch{}
  expBtn?.addEventListener('click', ()=>{ if(overlayEl) closeSearchModal(); else openSearchModal(); });
  dd?.addEventListener('click', (e)=>{
    const el=e.target.closest('.item[data-id]'); if(!el) return; ddIndex=parseInt(el.dataset.id,10); if(Number.isNaN(ddIndex)) return; applySelection();
  });
  function applySelection(){ const fld=getActiveField(); const it=ddItems[ddIndex]; if(!it) return; if(it.type==='task'){ try{ window.dispatchEvent(new CustomEvent('suggest-create-task', { detail:{ title:(fld?.value||'').trim() } })); }catch{} } closeDD(); }
  input?.addEventListener('keydown', (e)=>{
    if(e.key==='Escape'){ if(recognizing) stopMic(); closeDD(); input.blur(); return; }
    if(e.key==='ArrowDown'){ if(ddItems.length){ e.preventDefault(); setIndex(ddIndex<0?0:ddIndex+1); } }
    if(e.key==='ArrowUp'){ if(ddItems.length){ e.preventDefault(); setIndex(ddIndex<=0?ddItems.length-1:ddIndex-1); } }
    if(e.key==='Enter' && !e.shiftKey){
      if(createDraft){ e.preventDefault(); createTaskFromDraft(); return; }
      if(ddItems.length){ e.preventDefault(); applySelection(); }
    }
  });
  // Microphone (Web Speech API)
  function getSpeech(){
    const S=window.SpeechRecognition||window.webkitSpeechRecognition; return S? new S(): null;
  }
  let recRestartedOnce=false, recPendingSwitch=null, recNoResultTimer=null;
  function startMicWithLang(lang, isSwitch){
    if(recognizing && !isSwitch) return;
    if(rec && isSwitch){ try{ rec.onresult=null; rec.onend=null; rec.stop(); }catch{} }
    rec=getSpeech(); if(!rec){ toast('Tu navegador no soporta dictado'); return; }
    try{ rec.lang=lang||guessLangFromText(getActiveField()?.value||'')|| (navigator.language||'es-ES'); rec.continuous=true; rec.interimResults=true; }catch{}
  recognizing=true; micBtn?.classList.add('on'); micBtn?.setAttribute('aria-pressed','true'); wrap?.classList.add('listening');
    // Initialize dictation buffer with existing content
    try{ recFinalText = (getActiveField()?.value || '').trim(); }catch{ recFinalText=""; }
    if(dd){ dd.hidden=false; dd.innerHTML='<div class="item" aria-selected="true"><span>🎙️ Escuchando…</span><span class="op-70">Esc para cancelar</span></div>'; getActiveField()?.setAttribute('aria-expanded','true'); }
    let gotAnyResult=false;
    // Fallback switch if no results for a bit
    clearTimeout(recNoResultTimer);
    recNoResultTimer=setTimeout(()=>{
      if(!gotAnyResult && !recRestartedOnce){
        recRestartedOnce=true;
        const next = (rec.lang||'').startsWith('es') ? 'en-US' : 'es-ES';
        startMicWithLang(next, true);
      }
    }, 1500);
    rec.onresult=(ev)=>{
      gotAnyResult=true;
      let interim='';
      for(let i=ev.resultIndex; i<ev.results.length; i++){
        const r=ev.results[i];
        const t=(r[0].transcript||'').trim(); if(!t) continue;
        if(r.isFinal){
          recFinalText = recFinalText ? (recFinalText.replace(/\s+$/,'') + ' ' + t) : t;
        } else {
          interim = interim ? (interim + ' ' + t) : t;
        }
      }
      const fld=getActiveField();
      if(fld){
        const combined = (recFinalText + (interim ? (' ' + interim) : '')).replace(/\s{2,}/g,' ').trimStart();
        fld.value = combined;
        try{ const L=fld.value.length; fld.setSelectionRange(L,L); }catch{}
        onInput();
      }
    };
    rec.onend=()=>{
      clearTimeout(recNoResultTimer);
      recognizing=false; micBtn?.classList.remove('on'); micBtn?.removeAttribute('aria-pressed'); wrap?.classList.remove('listening'); closeDD();
    };
    try{ rec.start(); }catch{}
  }
  function startMic(){ recRestartedOnce=false; const guess=guessLangFromText(getActiveField()?.value||''); startMicWithLang(guess, false); }
  function stopMic(){ try{ rec&&rec.stop(); }catch{} recognizing=false; micBtn?.classList.remove('on'); micBtn?.removeAttribute('aria-pressed'); wrap?.classList.remove('listening'); closeDD(); }
  micBtn?.addEventListener('click', ()=> recognizing? stopMic(): startMic());

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

  // Search icon (magnifier) now opens Command Palette
  document.getElementById('searchCmd')?.addEventListener('click', ()=> openCommandPalette());

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

  // AI orb → open drawer
  document.getElementById('aiButton')?.addEventListener('click', ()=> openAIDrawer());
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

// User menu keyboard navigation
document.getElementById('userMenuBtn')?.addEventListener('keydown', (e)=>{
  const menu = document.getElementById('userDropdown'); if(!menu) return;
  if(e.key==='ArrowDown'){ e.preventDefault(); if(menu.hidden){ menu.hidden=false; } const first=menu.querySelector('button'); first?.focus(); }
});
document.getElementById('userDropdown')?.addEventListener('keydown', (e)=>{
  const items = Array.from(e.currentTarget.querySelectorAll('button'));
  const i = items.indexOf(document.activeElement);
  if(e.key==='ArrowDown'){ e.preventDefault(); const n=items[(i+1)%items.length]; n?.focus(); }
  if(e.key==='ArrowUp'){ e.preventDefault(); const n=items[(i-1+items.length)%items.length]; n?.focus(); }
  if(e.key==='Escape'){ e.preventDefault(); const menu=e.currentTarget; menu.hidden=true; document.getElementById('userMenuBtn')?.focus(); }
  if(e.key==='Enter'){ const btn=document.activeElement; if(btn?.click) btn.click(); }
});

function toast(msg){ 
  const t=document.createElement('div'); 
  t.textContent=msg; 
  t.className='toast';
  document.body.appendChild(t); 
  setTimeout(()=> t.classList.add('fade-out'), 2000); 
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
  overlay.className = 'cmd-overlay';

  const box = document.createElement('div');
  box.className = 'cmd-box';

  const input = document.createElement('input');
  input.type='search'; input.placeholder='Escribe un comando…'; input.setAttribute('aria-label','Comando');
  input.className = 'cmd-input';

  const list = document.createElement('div');
  list.className = 'cmd-list';

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
        <button data-id="${c.id}" class="cmd-item ${i===idx?'active':''}">
          <span>${c.title}</span>
        </button>
      `).join('');
    } else {
      list.innerHTML = wsList.map((w,i)=>{
        const active = (i===idx);
        const isCurrent = (state.workspaceFilter===w.id);
        const mark = isCurrent ? '✓' : '';
        return `
          <button data-wid="${w.id}" class="cmd-item justify-between ${active?'active':''}">
            <span>${w.title}</span>
            <span class="op-70">${mark}</span>
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

// ===================== AI Drawer (Assistant) =====================
function openAIDrawer(prefill){
  if(document.getElementById('aiOverlay')) return; // prevent duplicates
  const overlay=document.createElement('div'); overlay.id='aiOverlay'; overlay.className='ai-overlay'; overlay.setAttribute('aria-hidden','false');
  overlay.innerHTML = `
    <aside id="aiDrawer" class="ai-drawer" role="dialog" aria-modal="true" aria-labelledby="aiTitle">
      <header class="ai-head">
        <h3 id="aiTitle">AI Copilot</h3>
        <div class="spacer"></div>
        <button class="icon-btn" id="aiMicBtn" aria-pressed="false" aria-label="Dictado">🎙️</button>
        <button class="icon-btn" id="aiCloseBtn" aria-label="Cerrar">✕</button>
      </header>
      <div class="ai-quick">
        <button class="chip" data-q="checklist">Crear tarea de lo que diga</button>
        <button class="chip" data-q="resumen">Resumir mi día</button>
        <button class="chip" data-q="semana">Plan de semana</button>
      </div>
      <div class="ai-body" id="aiBody" tabindex="0" aria-live="polite"></div>
      <form class="ai-input" id="aiForm">
        <textarea id="aiText" rows="1" placeholder="Escribe… (Enter envía, Shift+Enter nueva línea)"></textarea>
        <button class="btn primary" id="aiSend" type="submit">Enviar</button>
      </form>
    </aside>`;
  document.body.appendChild(overlay);
  const drawer=overlay.querySelector('#aiDrawer');
  const aiText=overlay.querySelector('#aiText');
  const aiBody=overlay.querySelector('#aiBody');
  const aiForm=overlay.querySelector('#aiForm');
  const closeBtn=overlay.querySelector('#aiCloseBtn');
  const micBtn=overlay.querySelector('#aiMicBtn');
  // Slide-in
  requestAnimationFrame(()=> drawer.classList.add('show'));
  // Persisted session
  const storeKey='clickap.ai.session';
  function loadSession(){ try{ return JSON.parse(localStorage.getItem(storeKey)||'[]'); }catch{ return []; } }
  function saveSession(arr){ try{ localStorage.setItem(storeKey, JSON.stringify(arr.slice(-50))); }catch{} }
  function renderSession(){ const msgs=loadSession(); aiBody.innerHTML = msgs.map(m=>`<div class="msg ${m.role}"><div class="bubble">${escapeHtmlLite(m.text)}</div></div>`).join(''); aiBody.scrollTop=aiBody.scrollHeight; }
  function append(role,text){ const arr=loadSession(); arr.push({role,text,ts:Date.now()}); saveSession(arr); renderSession(); }
  function escapeHtmlLite(s){ return (s||'').replace(/[&<>]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }
  renderSession();
  if(prefill){ aiText.value=prefill; }
  // Context collector
  function currentContext(){
    const route = (window.location.hash||'').replace(/^#\/?/,'').split(/[?#]/)[0].split('/')[0]||'home';
    return { route, workspace: (window.state&&window.state.workspaceFilter)||'all' };
  }
  // Submit flow
  aiForm.addEventListener('submit', (e)=>{
    e.preventDefault(); const val=aiText.value.trim(); if(!val) return; append('user', val);
    const ctx=currentContext();
    try{ window.dispatchEvent(new CustomEvent('ai:submit', { detail:{ text: val, voice: aiRecActive, context: ctx } })); }catch{}
    aiText.value=''; aiText.focus();
  });
  // Quick chips
  overlay.querySelectorAll('.ai-quick .chip').forEach(btn=> btn.addEventListener('click', ()=>{
    const kind=btn.getAttribute('data-q');
    if(kind==='checklist'){ aiText.value = 'Crea subtareas/checklist para: ' + (aiText.value||'…'); }
    if(kind==='resumen'){ aiText.value = 'Resume mi día con próximos pasos.'; }
    if(kind==='semana'){ aiText.value = 'Planifica la semana con 3 objetivos y tareas clave.'; }
    aiText.focus();
  }));
  // Close handlers
  function close(){ drawer.classList.remove('show'); setTimeout(()=> overlay.remove(), 180); try{ window.dispatchEvent(new CustomEvent('ai:close')); }catch{} }
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('mousedown', (e)=>{ if(e.target===overlay) close(); });
  window.addEventListener('keydown', onEsc, true);
  function onEsc(e){ if(e.key==='Escape'){ e.preventDefault(); stopAiMic(); close(); window.removeEventListener('keydown', onEsc, true); } }
  // Focus trap
  const focusables=()=> Array.from(drawer.querySelectorAll('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')).filter(el=>!el.hasAttribute('disabled'));
  overlay.addEventListener('keydown', (e)=>{
    if(e.key!=='Tab') return; const els=focusables(); if(!els.length) return; const first=els[0], last=els[els.length-1];
    if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
    else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
  });
  // Voice (panel-only)
  let aiRec, aiRecActive=false;
  function aiGetSpeech(){ const S=window.SpeechRecognition||window.webkitSpeechRecognition; return S? new S(): null; }
  function startAiMic(){ if(aiRecActive) return; aiRec=aiGetSpeech(); if(!aiRec){ toast('Tu navegador no soporta dictado'); return; }
    try{ aiRec.lang='es-ES'; aiRec.continuous=true; aiRec.interimResults=true; }catch{}
    aiRecActive=true; micBtn.classList.add('on'); micBtn.setAttribute('aria-pressed','true');
    append('system','🎙️ Escuchando…');
    aiRec.onresult=(ev)=>{ let interim=''; let final=''; for(let i=ev.resultIndex;i<ev.results.length;i++){ const r=ev.results[i]; if(r.isFinal) final+=r[0].transcript; else interim+=r[0].transcript; } const txt=(final||interim).trim(); if(txt){ aiText.value=txt; aiText.dispatchEvent(new Event('input')); } };
    aiRec.onend=()=>{ aiRecActive=false; micBtn.classList.remove('on'); micBtn.removeAttribute('aria-pressed'); };
    try{ aiRec.start(); }catch{}
  }
  function stopAiMic(){ try{ aiRec&&aiRec.stop(); }catch{} aiRecActive=false; micBtn.classList.remove('on'); micBtn.removeAttribute('aria-pressed'); }
  micBtn.addEventListener('click', ()=> aiRecActive? stopAiMic(): startAiMic());
  // Autofocus
  setTimeout(()=>{ aiText.focus(); }, 50);
  try{ window.dispatchEvent(new CustomEvent('ai:open')); }catch{}
}
