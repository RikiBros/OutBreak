'use strict';
// los puntos de cada accion y los zombies compartidos en linea

// puntos cada accion suma y aparece un texto
function ganarPuntos(n, etiqueta) {
  n = Math.round(n);
  if (!(n > 0)) return;
  if (ES_ZONA && !enZona()) { avisoFueraZona(etiqueta); return; }
  game.score += n;
  const feed = document.getElementById('puntos-feed');
  const el = document.createElement('div');
  el.className = 'pt-item' + (n >= 500 ? ' grande' : '');
  el.innerHTML = '<b>+' + n + '</b> ' + etiqueta;
  feed.appendChild(el);
  while (feed.children.length > 6) feed.firstChild.remove();
  setTimeout(() => el.remove(), 1900);
  updateHUD();
  if (typeof window.emitirBajas === 'function') window.emitirBajas(game.kills, 0, game.score);
}

// modo zona lo que hagas afuera no cuenta se avisa en gris
function avisoFueraZona(etiqueta) {
  const ahora = performance.now();
  if (ahora - (avisoFueraZona._t || 0) < 1200) return;
  avisoFueraZona._t = ahora;
  const feed = document.getElementById('puntos-feed');
  const el = document.createElement('div');
  el.className = 'pt-item nulo';
  el.innerHTML = '<b>+0</b> ' + etiqueta + ' — FUERA DE LA ZONA';
  feed.appendChild(el);
  setTimeout(() => el.remove(), 1900);
}

// zombies compartidos en linea
// el anfitrion crea y mueve a todos los zombies y manda su estado
// 10 veces por segundo los demas jugadores los dibujan, les disparan
// el anfitrion aplica el daño y calculan el daño que reciben
const TIPOS_IDS = ['caminante', 'corredor', 'tanque'];
let contadorZombies = Math.floor(Math.random() * 9000 + 1) * 10000;   // ids distintos si cambia el anfitrion
const muertosRecientes = new Set();
let envioZombiesT = 0, ultimoEnvioConZombies = false;

function esAutoridad() { return tipoPartida !== 'online' || !!window._esHost; }

// posiciones de todos los jugadores tu y tus compañeros
function posicionesJugadores() {
  const lista = [];
  if (!game.muerto) lista.push(camera.position);
  const fuera = window._jugadoresFuera || new Set();   // ya terminaron
  Object.values(jugadoresRemotos).forEach(jr => { if (jr.mesh && !fuera.has(jr.username)) lista.push(jr.mesh.position); });
  return lista.length ? lista : [camera.position];
}
function objetivoMasCercano(pos) {
  let mejor = null, dMin = Infinity;
  posicionesJugadores().forEach(p => {
    const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
    if (d < dMin) { dMin = d; mejor = p; }
  });
  return mejor;
}

// si eres compañero y en 8 s de oleada no llega nada del anfitrion, avisar
let sinZombiesT = 0;
function revisarZombiesRed(dt) {
  if (tipoPartida !== 'online' || esAutoridad() || !game.waveActive) { sinZombiesT = 0; return; }
  if (performance.now() - ultimoEstadoZombies < 3000) { sinZombiesT = 0; return; }
  sinZombiesT += dt;
  if (sinZombiesT > 8) { sinZombiesT = -20; showAlert('NO LLEGAN LOS ZOMBIES DEL ANFITRIÓN — REINICIEN EL SERVIDOR (DEBE DECIR v6)'); }
}

function enviarZombies(dt) {
  if (tipoPartida !== 'online' || !esAutoridad() || !window.emitirZombies) return;
  envioZombiesT -= dt;
  if (envioZombiesT > 0) return;
  envioZombiesT = 0.1;
  if (!enemies.length && !ultimoEnvioConZombies) return;
  ultimoEnvioConZombies = enemies.length > 0;
  window.emitirZombies(enemies.map(e => [
    e.id, TIPOS_IDS.indexOf(e.tipoId),
    Math.round(e.mesh.position.x * 100) / 100, Math.round(e.mesh.position.z * 100) / 100,
    Math.round(e.mesh.rotation.y * 100) / 100,
    (e.atacando ? 1 : 0) | (e.paralizado > 0 ? 2 : 0), Math.round(e.hp),
  ]));
}

// jugador que no es anfitrion estado de los zombies
let ultimoEstadoZombies = 0;
window._zombiesEstado = function(lista) {
  ultimoEstadoZombies = performance.now();
  const enCombate = game.started && !game.over && game.waveActive;
  if (esAutoridad() || !enCombate || !Array.isArray(lista)) return;
  const vistos = new Set();
  lista.forEach(([id, ti, x, z, rot, fl, hp]) => {
    vistos.add(id);
    if (muertosRecientes.has(id)) return;
    let e = enemies.find(q => q.id === id);
    if (!e) {
      e = createEnemy(TIPOS_IDS[ti] || 'caminante', x, z);
      e.id = id; e.mesh.rotation.y = rot;
      enemies.push(e);
    }
    e.netX = x; e.netZ = z; e.netRot = rot; e.netAtaca = !!(fl & 1); e.hp = hp;
    if (fl & 2) {
      if (!(e.paralizado > 0)) { tintarZombie(e, 0x1a7fa0); if (e.mixer) e.mixer.timeScale = 0; }
      e.paralizado = Math.max(e.paralizado || 0, 0.35);
    }
  });
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (!vistos.has(enemies[i].id)) { quitarZombie(enemies[i]); enemies.splice(i, 1); }
  }
};

// todos el anfitrion avisa que un zombie murio y quien lo mato
window._zombieMuerto = function({ id, killer, cabeza, tipo }) {
  if (esAutoridad()) return;
  muertosRecientes.add(id);
  if (muertosRecientes.size > 300) muertosRecientes.delete(muertosRecientes.values().next().value);
  const e = enemies.find(q => q.id === id);
  if (e) matarVisual(e);
  if (killer === window._miUsername && !game.over) otorgarBaja(tipo || (e && e.tipoId), cabeza);
};

// anfitrion acciones que mandan los demas jugadores
window._deJugador = function({ tipo, datos, de }) {
  if (!esAutoridad() || !datos) return;
  if (tipo === 'golpe') {
    const e = enemies.find(q => q.id === datos.id);
    if (e) damageEnemy(e, Math.max(0, Math.min(150, +datos.dmg || 0)), !!datos.cabeza, de);
  } else if (tipo === 'paralizar' && Array.isArray(datos.ids)) {
    datos.ids.slice(0, 60).forEach(id => { const e = enemies.find(q => q.id === id); if (e) paralizar(e); });
  } else if (tipo === 'recoger' && ES_ZONA) {
    tomarObjetoZona(datos.id, de);
  }
};

function paralizar(e) {
  e.paralizado = 5;
  tintarZombie(e, 0x1a7fa0);
  if (e.mixer) e.mixer.timeScale = 0;
}
