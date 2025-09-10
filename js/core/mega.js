// /js/core/mega.js
export function showMega(msg){
  const layer = document.getElementById('mega');
  const box   = document.getElementById('megaTxt');

  // Fallback por si el HTML no tiene la capa
  if(!layer || !box){
    console.warn('[mega] Falta el contenedor #mega/#megaTxt. Usando alert como fallback.');
    alert(msg);
    return;
  }

  box.textContent = msg;
  layer.classList.add('show');

  function close(){
    layer.classList.remove('show');
    layer.removeEventListener('click', onClick);
    document.removeEventListener('keydown', onKey);
  }
  function onClick(e){
    if(e.target.id==='mega' || e.target.id==='megaClose'){ close(); }
  }
  function onKey(e){ if(e.key==='Escape'){ close(); } }

  layer.addEventListener('click', onClick);
  document.getElementById('megaClose')?.addEventListener('click', onClick, { once:true });
  document.addEventListener('keydown', onKey, { once:true });
}
