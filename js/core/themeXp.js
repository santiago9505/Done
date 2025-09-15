import { state, VERSION } from './state.js';

export function applyTheme(){ 
  document.documentElement.setAttribute('data-theme', state.theme||'dark'); 
  const chip=document.getElementById('versionChip'); 
  if(chip) chip.textContent = 'v'+VERSION + ' · ' + (state.theme==='dark'?'🌙':'☀️'); 
  // Apply custom UI settings
  const ui = state.settings?.ui || {}; 
  const root = document.documentElement.style;
  // Accent by hour (AI-lite) or custom
  let primary = ui.accent||'#60a5fa';
  if(ui.accentMode === 'auto'){
    const h = new Date().getHours();
    // mañana (6-12), tarde (12-19), noche (19-6)
    if(h>=6 && h<12) primary = '#7aa2ff';
    else if(h>=12 && h<19) primary = '#f59e0b';
    else primary = '#a78bfa';
  }
  root.setProperty('--primary', primary);
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
