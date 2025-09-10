import { state } from './state.js';

const KILLER_LINES=[
"💀 Task executed. No open casket.","🔥 You burned that task alive. Ashes only.","🪦 Another task buried. Cemetery’s getting full.","⚔️ You slaughtered that task like it owed you money.","💉 Task terminated. Flatline confirmed.","🧨 Boom. That task is now unrecognizable.","🕷️ Even Thanos would envy that efficiency.","☠️ The task begged for mercy. You didn’t listen.","🚬 Lit it, smoked it, tossed it. Task gone.","🧟 Task was a zombie. Headshot delivered.","🔪 Productivity machete strike. Fatal.","🎯 Bullseye to the skull. Task erased.","🦴 Snapped that task’s bones like twigs.","⚡ Electric chair productivity: fried another one.","🚑 Forget the ambulance. This one needs a coffin."
];
const EPIC_LINES=[
"💀 TASK GENOCIDE! Netflix is already writing a documentary about you.","🪦 The graveyard of unfinished business just expanded.","🔥 You’re burning tasks like witches in the Middle Ages.","🧨 That was nuclear. Hiroshima-level productivity.","☠️ If this were the mafia, that task is now sleeping with the fishes.","⚔️ Blood-soaked sword of productivity strikes again. Zero survivors.","🚬 You didn’t just finish it, you erased its existence from history.","🦹 Villain mode: unlocked. Even Joker would applaud this chaos.","💉 Another task overdosed on your efficiency.","🔥 That task went straight to hell. No round trip."
];

export function randomKillLine(){ 
  if(!state.humorOscuro) return "¡Tarea cerrada!"; 
  const epic=Math.random()<0.1; 
  const set=epic?EPIC_LINES:KILLER_LINES; 
  return set[Math.floor(Math.random()*set.length)]; 
}

