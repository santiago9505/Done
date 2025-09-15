import { state, save } from '../core/state.js';
import { applyTheme } from '../core/themeXp.js';
import { exportBackup, importBackup } from '../core/exportImport.js';
import { renderBoard } from './board.js';

// Presets de apariencia curados
const PRESETS = [
  { id:'ocean',   name:'Ocean',   accent:'#60a5fa', radius:12, density:'comfortable', fontScale:100, theme:'dark' },
  { id:'sunset',  name:'Sunset',  accent:'#f59e0b', radius:14, density:'spacious',    fontScale:102, theme:'dark' },
  { id:'emerald', name:'Emerald', accent:'#10b981', radius:10, density:'comfortable', fontScale:100, theme:'light' },
  { id:'purple',  name:'Purple',  accent:'#a78bfa', radius:12, density:'compact',     fontScale:100, theme:'dark' },
  { id:'rose',    name:'Rose',    accent:'#f43f5e', radius:12, density:'comfortable', fontScale:101, theme:'dark' },
  { id:'minimal', name:'Minimal', accent:'#3b82f6', radius:8,  density:'compact',     fontScale:96,  theme:'light' }
];

export function renderSettings(){
  const host = document.getElementById('view-settings'); if(!host) return;

  host.innerHTML = `
    <div class="card"><h3 class="h">Columnas del tablero</h3>
      <p style="color:var(--muted);margin-top:-6px">Separa por coma. Mínimo 2 columnas.</p>
      <input id="colsInput" style="width:100%" value="${(state.columns||[]).join(', ')}"/>
      <div style="margin-top:8px"><button class="btn primary" id="saveCols">Guardar columnas</button></div>
    </div>
    <div class="card" style="margin-top:12px"><h3 class="h">Apariencia y personalización</h3>
      <div class="r" style="flex-wrap:wrap;margin-bottom:10px" id="presetRow">
        ${PRESETS.map(p=>{
          const active = (
            state.settings?.ui?.accent===p.accent &&
            state.settings?.ui?.radius===p.radius &&
            state.settings?.ui?.density===p.density &&
            state.settings?.ui?.fontScale===p.fontScale &&
            state.theme===p.theme
          );
          return `<button class="btn ${active?'primary':''}" data-preset="${p.id}" title="${p.name}">
            <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${p.accent};margin-right:6px"></span>${p.name}
          </button>`;
        }).join('')}
      </div>
      <div class="inline-grid">
        <div>
          <label style="display:block;margin-bottom:6px;color:var(--muted)">Color de acento</label>
          <input type="color" id="accentColor" value="${state.settings?.ui?.accent||'#60a5fa'}"/>
        </div>
        <div>
          <label style="display:block;margin-bottom:6px;color:var(--muted)">Densidad</label>
          <select id="densitySel">
            <option value="compact" ${state.settings?.ui?.density==='compact'?'selected':''}>Compacta</option>
            <option value="comfortable" ${state.settings?.ui?.density==='comfortable'?'selected':''}>Cómoda</option>
            <option value="spacious" ${state.settings?.ui?.density==='spacious'?'selected':''}>Amplia</option>
          </select>
        </div>
        <div>
          <label style="display:block;margin-bottom:6px;color:var(--muted)">Radio de esquinas: <b id="radiusVal">${state.settings?.ui?.radius||12}px</b></label>
          <input type="range" id="radiusRange" min="6" max="20" step="1" value="${state.settings?.ui?.radius||12}"/>
        </div>
        <div>
          <label style="display:block;margin-bottom:6px;color:var(--muted)">Escala de fuente: <b id="fontVal">${state.settings?.ui?.fontScale||100}%</b></label>
          <input type="range" id="fontRange" min="90" max="110" step="1" value="${state.settings?.ui?.fontScale||100}"/>
        </div>
      </div>
      <div class="r" style="margin-top:10px">
        <button class="btn" id="btnResetUI">Restablecer</button>
      </div>
    </div>
    <div class="card" style="margin-top:12px"><h3 class="h">Preferencias</h3>
      <label><input type="checkbox" id="humorChk" ${state.humorOscuro?'checked':''}/> Activar “Dark Humor Task Killers”</label>
      <div style="margin-top:8px"><button class="btn" id="btnTheme">${state.theme==='dark'?'Modo claro ☀️':'Modo oscuro 🌙'}</button></div>
    </div>
    <div class="card" style="margin-top:12px"><h3 class="h">Datos</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" id="btnExport2">Exportar backup</button>
        <label class="btn"><input type="file" id="fileImport2" hidden/>Importar backup</label>
        <button class="btn danger" id="btnReset">Borrar todo</button>
      </div>
    </div>`;

  host.querySelector('#saveCols').addEventListener('click',()=>{
    const list = host.querySelector('#colsInput').value.split(',').map(s=>s.trim()).filter(Boolean);
    if(list.length<2){ toast('Mínimo 2 columnas'); return; }
    state.columns = list; save(); toast('Columnas actualizadas'); renderBoard();
  });
  host.querySelector('#humorChk').addEventListener('change', (e)=>{ state.humorOscuro = e.target.checked; save(); });
  // Apariencia
  const ui = state.settings.ui;
  const applyUI = ()=>{ save(); applyTheme(); };
  // Aplicar preset
  host.querySelectorAll('[data-preset]').forEach(b=> b.addEventListener('click', ()=>{
    const id=b.dataset.preset; const p=PRESETS.find(x=>x.id===id); if(!p) return;
    ui.accent=p.accent; ui.density=p.density; ui.radius=p.radius; ui.fontScale=p.fontScale; state.theme=p.theme||state.theme;
    applyUI(); renderSettings();
  }));
  const acc = host.querySelector('#accentColor');
  const dens = host.querySelector('#densitySel');
  const rr = host.querySelector('#radiusRange');
  const fv = host.querySelector('#fontRange');
  acc.addEventListener('input', e=>{ ui.accent = e.target.value; applyUI(); });
  dens.addEventListener('change', e=>{ ui.density = e.target.value; applyUI(); });
  rr.addEventListener('input', e=>{ ui.radius = parseInt(e.target.value,10)||12; host.querySelector('#radiusVal').textContent = ui.radius+'px'; applyUI(); });
  fv.addEventListener('input', e=>{ ui.fontScale = parseInt(e.target.value,10)||100; host.querySelector('#fontVal').textContent = ui.fontScale+'%'; applyUI(); });
  host.querySelector('#btnResetUI').addEventListener('click', ()=>{
    ui.accent='#60a5fa'; ui.density='comfortable'; ui.radius=12; ui.fontScale=100; applyUI(); renderSettings();
  });
  host.querySelector('#btnExport2').addEventListener('click', exportBackup);
  host.querySelector('#fileImport2').addEventListener('change', e=> importBackup(e, ok=> ok && toast('Backup importado')));
  host.querySelector('#btnReset').addEventListener('click', ()=>{
    if(confirm('¿Borrar todos los datos?')){ localStorage.removeItem('clickap'); location.reload(); }
  });
  host.querySelector('#btnTheme').addEventListener('click', ()=>{ state.theme = (state.theme==='dark'?'light':'dark'); save(); applyTheme(); renderSettings(); });
}

function toast(msg){ 
  const t=document.createElement('div'); 
  t.textContent=msg; 
  t.style.cssText='position:fixed;bottom:16px;right:16px;background:var(--panel);border:1px solid var(--border);box-shadow:var(--shadow);padding:10px 14px;border-radius:12px;z-index:99999;max-width:360px'; 
  document.body.appendChild(t); 
  setTimeout(()=>{t.style.opacity='0'; t.style.transform='translateY(6px)'; t.style.transition='all .3s'}, 2000); 
  setTimeout(()=>t.remove(), 2500); 
}
