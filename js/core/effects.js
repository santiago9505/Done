import { state, save } from './state.js';
import { renderXP } from './themeXp.js';

let AUDIO_CTX, AUDIO_UNLOCKED=false; 
export function unlockAudio(){ try{ if(!AUDIO_CTX){ AUDIO_CTX = new (window.AudioContext||window.webkitAudioContext)(); } if(AUDIO_CTX.state==='suspended'){ AUDIO_CTX.resume(); } AUDIO_UNLOCKED=true; }catch(e){} } 
window.addEventListener('pointerdown', unlockAudio, {once:true});

export function successSound(){ 
  if(!AUDIO_UNLOCKED) return; 
  const now=AUDIO_CTX.currentTime; 
  const notes=[523.25,659.25,783.99,1046.5]; 
  notes.forEach((f,i)=>{ 
    const o=AUDIO_CTX.createOscillator(); 
    const g=AUDIO_CTX.createGain(); 
    o.type = i===notes.length-1?'triangle':'sine'; 
    o.frequency.setValueAtTime(f, now+i*0.06); 
    g.gain.setValueAtTime(0.0001, now+i*0.06); 
    g.gain.exponentialRampToValueAtTime(0.25, now+i*0.06+0.02); 
    g.gain.exponentialRampToValueAtTime(0.00001, now+i*0.06+0.35); 
    o.connect(g); g.connect(AUDIO_CTX.destination); 
    o.start(now+i*0.06); o.stop(now+i*0.06+0.4); 
  }); 
}

export function confettiBurst(){ 
  const holder=document.getElementById('confetti'); if(!holder) return;
  const colors=['#34d399','#60a5fa','#fbbf24','#f87171','#a78bfa']; 
  const N=120; 
  for(let i=0;i<N;i++){ 
    const p=document.createElement('i'); 
    p.style.left=(Math.random()*100)+'%'; 
    p.style.background=colors[i%colors.length]; 
    const delay=(Math.random()*0.4).toFixed(2); 
    const dur=(1.3+Math.random()*1.4).toFixed(2); 
    p.style.transform=`translateY(-10px) rotate(${Math.random()*360}deg)`; 
    p.style.animation=`fall ${dur}s cubic-bezier(.4,.8,.6,1) ${delay}s forwards`; 
    holder.appendChild(p); 
    setTimeout(()=>p.remove(), (parseFloat(delay)+parseFloat(dur))*1000+100);
  } 
  const chip=document.getElementById('xpChip'); 
  chip?.animate([{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:450,easing:'ease-out'}); 
}

export function addXP(n){ 
  state.xp=(state.xp||0)+n; 
  save(); 
  renderXP(); 
  confettiBurst(); 
  successSound(); 
}
