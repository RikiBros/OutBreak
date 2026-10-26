'use strict';
// la linterna tiene bateria, prendida dura 30 segundos y se va apagando poco a poco
// apagada se recarga, de vacia a llena tarda 10 segundos

const LINTERNA_DURA = 30;
const LINTERNA_RECARGA = 10;
let bateria = 1;
let bateriaAgotada = false;    // si se vacio no prende hasta que se llene otra vez

function alternarLinterna(prender) {
  const quiere = prender ?? !game.linternaOn;
  if (quiere && bateriaAgotada) {
    Sonido.sfx('error');
    showAlert('LINTERNA SIN BATERÍA — ESPERA A QUE SE RECARGUE');
    return;
  }
  game.linternaOn = quiere;
  Sonido.sfx('linterna');
  aplicarLuzLinterna();
  updateHUD();
}

// mientras menos bateria queda, menos alumbra, y al final parpadea
function aplicarLuzLinterna() {
  if (!game.linternaOn) { linterna.intensity = 0; return; }
  let k = 0.3 + 0.7 * Math.min(1, bateria / 0.6);
  if (bateria < 0.15 && Math.random() < 0.2) k *= 0.25;
  linterna.intensity = LINTERNA_INT * k;
}

function actualizarLinterna(dt) {
  if (game.linternaOn) {
    bateria -= dt / LINTERNA_DURA;
    if (bateria <= 0) {
      bateria = 0;
      bateriaAgotada = true;
      game.linternaOn = false;
      Sonido.sfx('linterna');
      showAlert('SE ACABÓ LA BATERÍA DE LA LINTERNA');
      updateHUD();
    }
  } else {
    bateria = Math.min(1, bateria + dt / LINTERNA_RECARGA);
    if (bateriaAgotada && bateria >= 1) { bateriaAgotada = false; showAlert('LINTERNA RECARGADA'); }
  }
  aplicarLuzLinterna();
  const barra = document.getElementById('bateria-fill');
  if (barra) {
    barra.style.width = (bateria * 100).toFixed(1) + '%';
    barra.classList.toggle('baja', bateria < 0.25 || bateriaAgotada);
    barra.classList.toggle('cargando', !game.linternaOn && bateria < 1);
  }
}

function reiniciarBateria() {
  bateria = 1;
  bateriaAgotada = false;
}
