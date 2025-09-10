import { state, save } from './state.js';

export function exportBackup(){ 
  const blob=new Blob([JSON.stringify(state,null,2)], {type:'application/json'}); 
  const url=URL.createObjectURL(blob); 
  const a=document.createElement('a'); 
  a.href=url; a.download=`clickap-backup-${new Date().toISOString().slice(0,10)}.json`; 
  a.click(); URL.revokeObjectURL(url); 
}
export function importBackup(e, onDone){ 
  const f=e.target.files[0]; if(!f) return; 
  const reader=new FileReader(); 
  reader.onload = ev => { 
    try{ 
      const next = JSON.parse(ev.target.result); 
      Object.assign(state, next); 
      save(); 
      onDone?.(true);
    } catch(err){ alert('Archivo inválido'); onDone?.(false); } 
  }; 
  reader.readAsText(f); 
}
