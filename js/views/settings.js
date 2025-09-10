import { state, save } from '../core/state.js';
import { applyTheme } from '../core/themeXp.js';
import { exportBackup, importBackup } from '../core/exportImport.js';
import { renderBoard } from './board.js';

export function renderSettings(){
  const host = document.getElementById('view-settings'); if(!host) return;

  host.innerHTML = `
    <div class="card"><h3 class="h">Columnas del tablero</h3>
      <p style="color:var(--muted);margin-top:-6px">Separa por coma. Mínimo 2 columnas.</p>
      <input id="colsInput" style="width:100%" value="${(state.columns||[]).join(', ')}"/>
      <div style="margin-top:8px"><button class="btn primary" id="saveCols">Guardar columnas</button></div>
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
