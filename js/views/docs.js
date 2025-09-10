import { state, save, uid } from '../core/state.js';
import { escapeHtml, todayStr } from '../core/utils.js';

export function renderDocs(){
  const host = document.getElementById('view-docs'); if(!host) return;

  host.innerHTML = `
    <div class="docs">
      <div>
        <div class="tree">
          <div style="display:flex;gap:6px; padding:6px">
            <button class="btn primary" id="addDoc">+ Doc</button>
            <button class="btn" id="addSubDoc">+ Subdoc</button>
            <button class="btn" id="renameDoc">Renombrar</button>
            <button class="btn" id="delDoc">Eliminar</button>
          </div>
          <div id="treeHost"></div>
        </div>
      </div>
      <div class="doc-editor">
        <input id="docTitle" class="doc-title" placeholder="Título del documento"/>
        <div class="ribbon">
          <button class="btn" data-cmd="formatBlock:h1">H1</button>
          <button class="btn" data-cmd="formatBlock:h2">H2</button>
          <button class="btn" data-cmd="formatBlock:h3">H3</button>
          <button class="btn" data-cmd="bold">B</button>
          <button class="btn" data-cmd="italic">I</button>
          <button class="btn" data-cmd="insertUnorderedList">• Lista</button>
          <button class="btn" data-cmd="insertOrderedList">1. Lista</button>
          <label class="btn"><input type="file" id="imgUpload" accept="image/*" hidden/>Imagen</label>
        </div>
        <div id="rich" class="rich" contenteditable="true"></div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <button class="btn primary" id="saveDoc">Guardar</button>
          <button class="btn" id="previewDoc">Previsualizar</button>
        </div>
        <div id="docPreview" class="card" style="display:none;margin-top:8px"></div>
      </div>
    </div>`;

  const treeHost = host.querySelector('#treeHost');
  let currentDocId = state.docs[0]?.id || null;

  function buildTree(){
    const map = new Map();
    (state.docs||[]).forEach(d=>{ if(!map.has(d.parentId)) map.set(d.parentId, []); map.get(d.parentId).push(d) });
    function node(parent){
      const ul = document.createElement('ul');
      (map.get(parent)||[]).sort((a,b)=> a.title.localeCompare(b.title)).forEach(d=>{
        const li = document.createElement('li');
        const a = document.createElement('div'); a.className='node';
        a.innerHTML = `<input type="radio" name="docSel" ${d.id===currentDocId?'checked':''} value="${d.id}"> <span>📄 ${escapeHtml(d.title)}</span>`;
        a.querySelector('input').addEventListener('change', ()=>{ currentDocId=d.id; loadDoc(); });
        li.appendChild(a); li.appendChild(node(d.id)); ul.appendChild(li);
      });
      return ul;
    }
    treeHost.innerHTML = ''; treeHost.appendChild(node(null));
  }
  function defaultNotesTemplateHTML(){
    const d = todayStr();
    return `<h1>Título</h1><p><strong>Fecha:</strong> ${d}</p>
    <h2>Preguntas</h2><ul><li>...</li></ul>
    <h2>Palabras Clave</h2><ul><li>...</li></ul>
    <h2>Apuntes</h2><ul><li>...</li></ul>
    <h2>Resumen</h2><ul><li>...</li></ul>`;
  }
  function loadDoc(){
    const d = (state.docs||[]).find(x=>x.id===currentDocId);
    host.querySelector('#docTitle').value = d? d.title : 'Notas (Cornell)';
    host.querySelector('#rich').innerHTML = d? (d.html||'') : defaultNotesTemplateHTML();
  }
  function saveDoc(){
    const title = host.querySelector('#docTitle').value.trim(); if(!title){ toast('Pon un título'); return; }
    const html = host.querySelector('#rich').innerHTML;
    if(!currentDocId){
      const d = {id:uid(), title, parentId:null, html, created:Date.now(), updated:Date.now()};
      (state.docs||[]).push(d); currentDocId = d.id;
    }else{
      const d = (state.docs||[]).find(x=>x.id===currentDocId); d.title=title; d.html=html; d.updated=Date.now();
    }
    save(); buildTree(); loadDoc(); toast('Documento guardado');
  }

  buildTree(); loadDoc();

  host.querySelector('#addDoc').addEventListener('click',()=>{ currentDocId=null; loadDoc(); });
  host.querySelector('#addSubDoc').addEventListener('click',()=>{
    const p = currentDocId? (state.docs||[]).find(x=>x.id===currentDocId): null; if(!p){ toast('Selecciona un documento padre'); return; }
    const d = {id:uid(), title:'Nuevo subdocumento', parentId:p.id, html:defaultNotesTemplateHTML(), created:Date.now(), updated:Date.now()};
    (state.docs||[]).push(d); save(); currentDocId=d.id; buildTree(); loadDoc();
  });
  host.querySelector('#renameDoc').addEventListener('click',()=>{
    const d = (state.docs||[]).find(x=>x.id===currentDocId); if(!d){ toast('Nada seleccionado'); return; }
    const nv = prompt('Nuevo título', d.title); if(nv){ d.title = nv.trim(); d.updated=Date.now(); save(); buildTree(); loadDoc(); }
  });
  host.querySelector('#delDoc').addEventListener('click',()=>{
    if(!currentDocId){ toast('Nada seleccionado'); return; }
    const hasKids = (state.docs||[]).some(x=>x.parentId===currentDocId);
    if(hasKids){ toast('Elimina primero los subdocumentos'); return; }
    if(!confirm('¿Eliminar este documento?')) return;
    state.docs = (state.docs||[]).filter(x=>x.id!==currentDocId);
    currentDocId = (state.docs||[])[0]?.id || null; save(); buildTree(); loadDoc();
  });
  host.querySelector('#saveDoc').addEventListener('click', saveDoc);
  host.querySelector('#previewDoc').addEventListener('click', ()=>{
    const prev = host.querySelector('#docPreview'); const rich = host.querySelector('#rich');
    if(prev.style.display==='none'){ prev.style.display='block'; prev.innerHTML = rich.innerHTML; }
    else prev.style.display='none';
  });

  // WYSIWYG commands
  host.querySelectorAll('.ribbon [data-cmd]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ const [cmd, val] = btn.dataset.cmd.split(':'); document.execCommand(cmd, false, val||null); host.querySelector('#rich').focus(); });
  });

  // Imagen: paste o file input
  const rich = host.querySelector('#rich');
  function insertImage(src){
    const img=document.createElement('img'); img.src=src;
    const sel=window.getSelection(); if(!sel.rangeCount){ rich.appendChild(img); return; }
    const range=sel.getRangeAt(0); range.insertNode(img); range.setStartAfter(img); range.setEndAfter(img); sel.removeAllRanges(); sel.addRange(range);
  }
  rich.addEventListener('paste', (e)=>{
    const items=e.clipboardData?.items||[]; 
    for(const it of items){ 
      if(it.type && it.type.startsWith('image/')){ 
        const file=it.getAsFile(); const r=new FileReader(); 
        r.onload=ev=> insertImage(ev.target.result); r.readAsDataURL(file); e.preventDefault(); break; 
      } 
    }
  });
  host.querySelector('#imgUpload').addEventListener('change', (e)=>{
    const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=> insertImage(ev.target.result); r.readAsDataURL(f);
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
