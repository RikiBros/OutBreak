'use strict';
// mouse, teclado, pausa, configuracion dentro de la partida, saltar y apuntar

// bloqueo del mouse dentro del juego
const controls = new PointerLockControls(camera, document.body);

controls.addEventListener('lock', () => {
  document.getElementById('no-pausa').classList.remove('visible');
  // si hay una pantalla abierta briefing o tienda, soltar el mouse para poder dar clic
  if ((game.briefing && !game.briefingAuto) || game.inShop) { controls.unlock(); return; }
  document.getElementById('hud').classList.add('visible');
  game.paused = false;
});
controls.addEventListener('unlock', () => {
  setApuntando(false);
  if (!game.over && game.started && !game.paused && !game.inShop && !game.briefing) pauseGame();
});

// en linea no se puede pausar cada esc muestra el aviso y quita 1 de vida
let _ultimoNoPausa = 0;
function noHayPausa() {
  const ahora = performance.now();
  if (ahora - _ultimoNoPausa < 200) return;   // un solo esc no cuenta doble
  _ultimoNoPausa = ahora;
  Sonido.sfx('buzz');
  const el = document.getElementById('no-pausa');
  el.classList.add('visible');
  el.classList.remove('golpe'); void el.offsetWidth; el.classList.add('golpe');
  clearTimeout(noHayPausa._t); noHayPausa._t = setTimeout(() => el.classList.remove('visible'), 2500);
  if (game.over || game.muerto || game.health <= 0) return;
  game.health = Math.max(0, game.health - 1);     // directo a la vida no al escudo
  updateHUD();
  const f = document.getElementById('damage-flash');
  f.classList.add('hit'); setTimeout(() => f.classList.remove('hit'), 200);
  if (game.health <= 0) iniciarReaparicion();
}

// teclado
const keys = { w:false, a:false, s:false, d:false, shift:false };
document.addEventListener('keydown', e => {
  switch(e.code) {
    case 'KeyW': keys.w=true; break; case 'KeyA': keys.a=true; break;
    case 'KeyS': keys.s=true; break; case 'KeyD': keys.d=true; break;
    case 'Escape':
      e.preventDefault();
      if (document.getElementById('intro-screen').classList.contains('visible')) { terminarIntro(); break; }
      if (document.getElementById('config-overlay').classList.contains('visible')) { cerrarConfig(); break; }
      if (game.inShop) { cerrarTienda(); break; }
      if (game.briefing) break;
      if (!game.started || game.over) break;
      game.paused ? resumeGame() : pauseGame();
      break;
    case 'Space':
    case 'Enter':
      if (document.getElementById('intro-screen').classList.contains('visible')) { e.preventDefault(); avanzarIntro(); }
      else if (game.briefing) { e.preventDefault(); if (!game.briefingAuto) comenzarOleada(); }
      else if (e.code === 'Enter' && game.intermission && tipoPartida === 'online') { e.preventDefault(); marcarListo(); }
      else if (e.code === 'Space') { e.preventDefault(); saltar(); }
      break;
    case 'KeyQ': if (game.started && !game.paused && !game.over && !game.inShop) cambiarArma(); break;
    case 'ShiftLeft': case 'ShiftRight': keys.shift = true; break;
    case 'KeyB':
      if (game.inShop) cerrarTienda();
      else if (game.started && !game.paused && !game.over) abrirTienda();
      break;
    case 'KeyR': reloadAmmo(); break;
    case 'Digit1': useItem(0); break;
    case 'Digit2': useItem(1); break;
    case 'Digit3': useItem(2); break;
    case 'KeyE': useItem(3); break;      // botiquin
    case 'KeyF': useItem(4); break;      // linterna
  }
});
document.addEventListener('keyup', e => {
  switch(e.code) {
    case 'KeyW': keys.w=false; break; case 'KeyA': keys.a=false; break;
    case 'KeyS': keys.s=false; break; case 'KeyD': keys.d=false; break;
    case 'ShiftLeft': case 'ShiftRight': keys.shift=false; break;
  }
});

// disparo
const raycaster = new THREE.Raycaster();
const enemies   = [];

document.addEventListener('click', (e) => {
  if (!game.started || game.paused || game.over || game.inShop || game.briefing || game.muerto || game.mapaAbierto) return;
  // si se perdio el mouse, por ejemplo al cerrar la tienda, un clic lo recupera
  if (!controls.isLocked) { if (e.target.id === 'gameCanvas') controls.lock(); return; }
  // solo se puede disparar mientras se apunta clic derecho
  if (!game.aiming) { avisoApuntar(); return; }
  if (game.arma === 'pistola' && game.mejoras.auto) return;   // con disparo automatico dispara el mousedown
  shoot();
});

// sensibilidad del mouse e invertir eje y
// el control del mouse gira siempre igual, aqui se ajusta ese giro
const eulerAjuste = new THREE.Euler(0, 0, 0, 'YXZ');
document.addEventListener('mousemove', e => {
  if (!controls.isLocked) return;
  const mx = e.movementX || 0, my = e.movementY || 0;
  if (sensMouse === 1 && !invertirY) return;
  eulerAjuste.setFromQuaternion(camera.quaternion);
  eulerAjuste.y -= mx * 0.002 * (sensMouse - 1);
  eulerAjuste.x -= my * 0.002 * (sensMouse * (invertirY ? -1 : 1) - 1);
  eulerAjuste.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, eulerAjuste.x));
  camera.quaternion.setFromEuler(eulerAjuste);
});

// configuracion dentro de la partida
window.abrirConfig = function() {
  const cfg = JSON.parse(localStorage.getItem('outbreak_config') || '{}');
  const set = (id, v) => { document.getElementById(id).value = v; const t = document.getElementById(id + '-v'); if (t) t.textContent = v; };
  set('cfg-sens', cfg.sensitivity ?? 50);
  set('cfg-musica', cfg.musicVolume ?? 100);
  set('cfg-efectos', cfg.sfxVolume ?? 45);
  document.getElementById('cfg-inv').checked     = !!cfg.invertY;
  document.getElementById('cfg-sombras').checked = cfg.shadows !== false;
  document.getElementById('pause-overlay').classList.remove('visible');
  document.getElementById('config-overlay').classList.add('visible');
};
['cfg-sens', 'cfg-musica', 'cfg-efectos'].forEach(id =>
  document.getElementById(id).addEventListener('input', e => { document.getElementById(id + '-v').textContent = e.target.value; }));

window.cerrarConfig = function() {
  const cfg = JSON.parse(localStorage.getItem('outbreak_config') || '{}');
  cfg.sensitivity = +document.getElementById('cfg-sens').value;
  cfg.musicVolume = +document.getElementById('cfg-musica').value;
  cfg.sfxVolume   = +document.getElementById('cfg-efectos').value;
  Sonido.volumenes(cfg.musicVolume, cfg.sfxVolume);
  cfg.invertY     = document.getElementById('cfg-inv').checked;
  cfg.shadows     = document.getElementById('cfg-sombras').checked;
  localStorage.setItem('outbreak_config', JSON.stringify(cfg));
  // aplicar de inmediato
  sensMouse = Math.pow(2.5, (cfg.sensitivity - 50) / 50);
  invertirY = cfg.invertY;
  if (renderer.shadowMap.enabled !== cfg.shadows) {
    renderer.shadowMap.enabled = cfg.shadows;
    sunLight.castShadow = cfg.shadows;
    scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
  }
  document.getElementById('config-overlay').classList.remove('visible');
  document.getElementById('pause-overlay').classList.add('visible');
};

// cambiar de arma con la rueda del mouse
document.addEventListener('wheel', () => {
  if (controls.isLocked && game.started && !game.paused && !game.over && game.mejoras.escopeta) cambiarArma();
});

// saltar
function saltar() {
  if (!controls.isLocked || game.paused || game.over || game.inShop || game.briefing || game.muerto || game.mapaAbierto) return;
  if (game.saltoY > 0 || game.abduccionY > 0) return;     // solo desde el piso
  game.saltoV = 6.2;
  Sonido.sfx('salto');
}

// apuntar con clic derecho mantener
document.addEventListener('contextmenu', e => { if (game.started) e.preventDefault(); });
document.addEventListener('mousedown', e => {
  if (e.button === 0) {
    game.disparando = true;
    if (game.arma === 'pistola' && game.mejoras.auto && game.aiming && controls.isLocked && !game.paused && !game.over && !game.inShop && !game.briefing) {
      shoot(); game.fireTimer = CADENCIA;
    }
    return;
  }
  if (e.button !== 2 || !controls.isLocked || game.paused || game.over || game.inShop) return;
  setApuntando(true);
});
document.addEventListener('mouseup', e => {
  if (e.button === 0) game.disparando = false;
  if (e.button === 2) setApuntando(false);
});

function setApuntando(on) {
  game.aiming = on;
  document.getElementById('crosshair').classList.toggle('aiming', on);
  document.getElementById('ads-vignette').classList.toggle('on', on);
}

let ultimoAviso = 0;
function avisoApuntar() {
  const ahora = performance.now();
  if (ahora - ultimoAviso < 1500) return;
  ultimoAviso = ahora;
  showAlert('MANTÉN CLIC DERECHO PARA APUNTAR');
}
