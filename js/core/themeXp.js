import { state, VERSION } from './state.js';

let _osMedia; let _osListenerAttached=false;

function resolvedSystemTheme(){
  try{
    _osMedia = _osMedia || window.matchMedia('(prefers-color-scheme: dark)');
    return _osMedia.matches ? 'dark' : 'light';
  }catch{ return 'dark'; }
}

function ensureOsListener(){
  if(_osListenerAttached) return;
  try{
    _osMedia = _osMedia || window.matchMedia('(prefers-color-scheme: dark)');
    const handler = ()=>{ if(state.theme==='auto') applyTheme(); };
    if(_osMedia.addEventListener) _osMedia.addEventListener('change', handler);
    else if(_osMedia.addListener) _osMedia.addListener(handler);
    _osListenerAttached = true;
  }catch{}
}

export function applyTheme(){ 
  // Sync from localStorage if present
  try{
    const ls = localStorage.getItem('clickap.theme');
    if(ls && ls!==state.theme){ state.theme = ls; }
  }catch{}

  const mode = state.theme || 'dark';
  const effective = (mode==='auto') ? resolvedSystemTheme() : mode;
  document.documentElement.setAttribute('data-theme', effective);
  // Persist selected mode
  try{ localStorage.setItem('clickap.theme', mode); }catch{}

  const chip=document.getElementById('versionChip'); 
  if(chip){
    const icon = mode==='auto' ? '🖥️' : (effective==='dark'?'🌙':'☀️');
    chip.textContent = 'v'+VERSION + ' · ' + icon;
  }
  // React to OS changes when in auto
  ensureOsListener();

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
