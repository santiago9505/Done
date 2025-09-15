import { state, VERSION } from './state.js';

export function applyTheme(){ 
  document.documentElement.setAttribute('data-theme', state.theme||'dark'); 
  const chip=document.getElementById('versionChip'); 
  if(chip) chip.textContent = 'v'+VERSION + ' · ' + (state.theme==='dark'?'🌙':'☀️'); 
  // Apply custom UI settings
  const ui = state.settings?.ui || {}; 
  const root = document.documentElement.style;
  if(ui.accent) root.setProperty('--primary', ui.accent);
  const r = parseInt(ui.radius,10); if(Number.isFinite(r)){
    root.setProperty('--radius', r+'px');
  }
  const fs = parseInt(ui.fontScale,10); if(Number.isFinite(fs)){
    root.setProperty('--fontScale', Math.max(85, Math.min(120, fs))+'%');
  }
  const density = ui.density||'comfortable';
  const pad = density==='compact'? 6 : density==='spacious'? 12 : 8;
  root.setProperty('--pad', pad+'px');
}
export function level(){return Math.floor((state.xp||0)/100)+1}
export function levelProgress(){return (state.xp||0)%100}
export function renderXP(){ const chip=document.getElementById('xpChip'); if(chip) chip.textContent = `Nivel ${level()} · ${levelProgress()} XP`; }
