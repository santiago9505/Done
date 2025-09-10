import { state, VERSION } from './state.js';

export function applyTheme(){ 
  document.documentElement.setAttribute('data-theme', state.theme||'dark'); 
  const chip=document.getElementById('versionChip'); 
  if(chip) chip.textContent = 'v'+VERSION + ' · ' + (state.theme==='dark'?'🌙':'☀️'); 
}
export function level(){return Math.floor((state.xp||0)/100)+1}
export function levelProgress(){return (state.xp||0)%100}
export function renderXP(){ const chip=document.getElementById('xpChip'); if(chip) chip.textContent = `Nivel ${level()} · ${levelProgress()} XP`; }
