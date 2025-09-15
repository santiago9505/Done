import { state, save } from './state.js';
import { renderXP } from './themeXp.js';

let AUDIO_CTX;
let AUDIO_UNLOCKED = false;
let PENDING_PLAYS = [];

function flushPending() {
  if (!AUDIO_UNLOCKED) return;
  const pending = PENDING_PLAYS.slice();
  PENDING_PLAYS.length = 0;
  pending.forEach(fn => {
    try { fn(); } catch {}
  });
}

export function unlockAudio() {
  try {
    if (!AUDIO_CTX) {
      AUDIO_CTX = new (window.AudioContext || window.webkitAudioContext)();
    }
    // If context is suspended, resume returns a promise on modern browsers
    if (AUDIO_CTX.state === 'suspended') {
      const p = AUDIO_CTX.resume();
      if (p && typeof p.then === 'function') {
        p.then(() => { AUDIO_UNLOCKED = true; flushPending(); }).catch(() => {});
      } else {
        AUDIO_UNLOCKED = true; flushPending();
      }
    } else {
      AUDIO_UNLOCKED = true; flushPending();
    }
  } catch (e) {
    // swallow – if creation fails, we'll retry on next gesture
  }
}

// Try to unlock on multiple first-user interactions to cover keyboard-only users
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('click', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

function playSuccessInternal() {
  const now = AUDIO_CTX.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const o = AUDIO_CTX.createOscillator();
    const g = AUDIO_CTX.createGain();
    o.type = i === notes.length - 1 ? 'triangle' : 'sine';
    o.frequency.setValueAtTime(f, now + i * 0.06);
    g.gain.setValueAtTime(0.0001, now + i * 0.06);
    g.gain.exponentialRampToValueAtTime(0.25, now + i * 0.06 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.00001, now + i * 0.06 + 0.35);
    o.connect(g); g.connect(AUDIO_CTX.destination);
    o.start(now + i * 0.06); o.stop(now + i * 0.06 + 0.4);
  });
}

export function successSound() {
  // Best-effort unlock if not yet available
  if (!AUDIO_UNLOCKED || !AUDIO_CTX) {
    PENDING_PLAYS.push(() => { if (AUDIO_CTX) playSuccessInternal(); });
    unlockAudio();
    return;
  }
  if (AUDIO_CTX.state === 'suspended') {
    // Queue if got suspended again (e.g., tab backgrounded)
    PENDING_PLAYS.push(() => playSuccessInternal());
    unlockAudio();
    return;
  }
  playSuccessInternal();
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
