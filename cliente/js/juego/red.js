// todo lo que va y viene del servidor en las partidas en linea

// la conexion con el servidor
// expusimos en el modulo
let socket = null;
let currentRoomId = null;

// conectar al servidor cuando el lobby este visible
// se llama desde mostrarlobby cuando la partida es en linea
window.conectarSocket = function(roomId, username) {
  currentRoomId = roomId;
  window._miUsername = username;

  // si ya hay conexion activa, no crear otra
  if (socket && socket.connected) {
    entrarSala(roomId, username);
    return;
  }

  socket = io();

  // conexion exitosa
  socket.on('connect', () => {
    console.log('Socket conectado:', socket.id);
    document.getElementById('server-status').textContent = 'CONECTADO';
    entrarSala(roomId, username);
  });

  socket.on('disconnect', () => {
    document.getElementById('server-status').textContent = 'DESCONECTADO';
  });

  // sala unida con exito
  socket.on('sala_unida', ({ sala }) => {
    console.log('Sala unida:', sala.nombre);
    window._esHost = sala.host === username;
    if (window._actualizarIntroUI) window._actualizarIntroUI();
    // actualizar pips y crear el modelo de los compañeros que ya estaban
    actualizarJugadoresHUD(sala.jugadores);
    sala.jugadores.forEach(j => {
      if (j.socketId !== socket.id) window.spawnJugadorRemoto(j.socketId, j.username, j.color);
    });
    document.getElementById('online-count').textContent = sala.jugadores.length;
    // servidor viejo sin el sistema listo avisar que hay que reiniciarlo
    if (!sala.version || sala.version < 6) avisarServidorViejo();
  });

  // lista real de jugadores la manda el servidor
  socket.on('jugadores_sala', (lista) => {
    const ids = new Set(lista.map(j => j.socketId));
    (window._idsRemotos ? window._idsRemotos() : []).forEach(id => {
      if (!ids.has(id)) { removerPipJugador(id); window.removerJugadorRemoto(id); }
    });
    lista.forEach(j => { if (j.socketId !== socket.id) window.spawnJugadorRemoto(j.socketId, j.username, j.color); });
    actualizarJugadoresHUD(lista);
    document.getElementById('online-count').textContent = Math.max(1, lista.length);
  });

  // esta pestaña fue reemplazada por otra con la misma cuenta
  socket.on('sesion_reemplazada', () => {
    alert('Abriste esta partida en otra pestaña con la misma cuenta. Esta pestaña se cerrará.');
    window.location.href = 'index.html';
  });

  // otro jugador entro
  socket.on('jugador_entro', ({ socketId, username, color }) => {
    console.log('Entró:', username);
    agregarPipJugador(socketId, username);
    window.spawnJugadorRemoto(socketId, username, color);
  });

  // posicion de otro jugador
  socket.on('posicion_jugador', ({ socketId, username, x, y, z, rot, f, p, color }) => {
    // si todavia no existe su modelo, crearlo
    window.spawnJugadorRemoto(socketId, username, color);
    window.moverJugadorRemoto(socketId, x, y, z, rot, f, p);
  });

  // otro jugador disparo para ver el fogonazo
  socket.on('jugador_disparo', ({ socketId, a }) => { if (window._disparoRemoto) window._disparoRemoto(socketId, a); });

  // otro jugador salio
  socket.on('jugador_salio', ({ socketId, username }) => {
    console.log('Salió:', username);
    removerPipJugador(socketId);
    window.removerJugadorRemoto(socketId);
  });

  // la partida ya se inicio desde la sala de espera de en linea html

  // marcador de bajas en vivo
  socket.on('marcador', (lista) => renderMarcador(lista));

  // sincronizacion intro del anfitrion y boton listo
  socket.on('listos_estado', (d) => { if (window._listosEstado) window._listosEstado(d); });
  socket.on('todos_listos',  (d) => { if (window._todosListos)  window._todosListos(d); });

  // zombies compartidos los controla el anfitrion
  socket.on('zombies_estado', (l) => { if (window._zombiesEstado) window._zombiesEstado(l); });
  socket.on('zombie_muerto',  (d) => { if (window._zombieMuerto)  window._zombieMuerto(d); });
  socket.on('de_jugador',     (d) => { if (window._deJugador)     window._deJugador(d); });
  socket.on('del_host',       (d) => { if (window._delHost)       window._delHost(d); });

  // otro jugador te disparo
  socket.on('recibiste_disparo', ({ de, dano }) => {
    if (window._recibirDisparo) window._recibirDisparo(de, dano);
  });

  // todos terminaron, gana quien hizo mas puntos
  socket.on('partida_finalizada', ({ ranking }) => mostrarRanking(ranking));

  // compañero murio
  socket.on('compañero_murio', ({ username }) => {
    window._showAlert && window._showAlert(`${username} cayó`);
  });


  // error de sala
  socket.on('error_sala', (msg) => {
    alert('' + msg);
    window.location.href = 'en-linea.html';
  });

  // nuevo host asignado
  socket.on('nuevo_host', ({ username: nuevoHost }) => {
    console.log('Nuevo host:', nuevoHost);
    window._esHost = nuevoHost === username;
    if (window._actualizarIntroUI) window._actualizarIntroUI();
  });
};

// emitir evento de union a sala
function entrarSala(roomId, username) {
  let color = '#24508c';
  try { color = localStorage.getItem('outbreak_color') || color; } catch (e) {}
  socket.emit('unirse_sala', { roomId, username, color });
}

// emitir movimiento llamar desde el loop de three
let _ultimoMov = 0;
window.emitirMovimiento = function(x, y, z, rot, f, p) {
  if (!(socket && socket.connected && currentRoomId)) return;
  const ahora = performance.now();
  if (ahora - _ultimoMov < 33) return;        // 30 veces por segundo es suficiente
  _ultimoMov = ahora;
  socket.emit('jugador_movio', { x, y, z, rot, f: f || 0, p: p || 0 });
};
window.emitirDisparoVisual = function(a) {
  if (socket && socket.connected && currentRoomId) socket.emit('jugador_disparo', { a });
};

// sincronizacion
let _reenvioListo = null;
window.emitirListo = function(fase) {
  if (socket && socket.connected) socket.emit('listo', { fase });
  // reenviar cada 3 s mientras siga esperando por si se perdio el mensaje
  clearInterval(_reenvioListo);
  _reenvioListo = setInterval(() => {
    if (!window._sigoEsperando || !window._sigoEsperando()) { clearInterval(_reenvioListo); return; }
    if (socket && socket.connected) socket.emit('listo', { fase });
  }, 3000);
};

function avisarServidorViejo() {
  if (document.getElementById('aviso-servidor')) return;
  const d = document.createElement('div');
  d.id = 'aviso-servidor';
  d.textContent = 'EL SERVIDOR ESTÁ DESACTUALIZADO: copia el server.js nuevo y reinícialo (Ctrl+C y luego node server.js)';
  d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#b00;color:#fff;font:bold 16px sans-serif;padding:12px;text-align:center;letter-spacing:1px';
  document.body.appendChild(d);
}

// disparo a otro jugador en linea
window.emitirDisparoJugador = function(objetivo, dano) {
  if (socket && socket.connected) socket.emit('disparo_jugador', { objetivo, dano });
};

// emitir que sobrevivio las 3 oleadas
window.emitirTermino = function() {
  if (socket && socket.connected) socket.emit('jugador_termino');
};

// emitir que murio
window.emitirMuerte = function() {
  if (socket && socket.connected) socket.emit('jugador_murio');
};

// emitir bajas cada vez que eliminas a un infectado
window.emitirBajas = function(kills, piezas, puntos) {
  if (socket && socket.connected && currentRoomId) socket.emit('actualizar_bajas', { kills, piezas: piezas || 0, puntos: puntos || 0 });
};

// zombies compartidos
window.emitirZombies = function(lista) {
  if (socket && socket.connected && currentRoomId) socket.emit('zombies_estado', lista);
};
window.emitirZombieMuerto = function(id, killer, cabeza, tipo) {
  if (socket && socket.connected && currentRoomId) socket.emit('zombie_muerto', { id, killer, cabeza, tipo });
};
window.emitirDelHost = function(tipo, datos) {
  if (socket && socket.connected && currentRoomId) socket.emit('del_host', { tipo, datos });
};
window.emitirAHost = function(tipo, datos) {
  if (socket && socket.connected && currentRoomId) socket.emit('a_host', { tipo, datos });
};

// tabla de puntos del hud se gana por puntos, no por bajas
let ultimoMarcador = [];
function renderMarcador(lista) {
  ultimoMarcador = lista;
  window._jugadoresFuera = new Set(lista.filter(j => !j.vivo).map(j => j.username));
  const yo = window._miUsername;
  document.getElementById('board-rows').innerHTML = lista.map(j => `
    <div class="board-row ${j.username === yo ? 'me' : ''} ${j.vivo || j.termino ? '' : 'dead'}">
      <span>${j.termino ? '' : ''}${escTxt(j.username)}</span><b>${(j.puntos || 0).toLocaleString()}</b>
    </div>`).join('');
  if (window._finVictoria && !window._rankingFinal) pintarTablaFin(null);
}

function detalleJugador(j) {
  return j.kills + (j.kills === 1 ? ' BAJA' : ' BAJAS');
}

// tabla de resultados dentro de la pantalla blanca del fin
function pintarTablaFin(final) {
  const lista = final || ultimoMarcador;
  const yo = window._miUsername;
  document.getElementById('fin-tabla-l').textContent = final ? 'RESULTADOS FINALES' : 'RESULTADOS PARCIALES';
  document.getElementById('fin-win').textContent = final && final[0] ? 'GANADOR: ' + final[0].username : '';
  document.getElementById('fin-rows').innerHTML = lista.map((j, i) => `
    <div class="fin-row ${final && i === 0 ? 'first' : ''} ${j.username === yo ? 'me' : ''} ${!final && j.vivo ? '' : (j.termino || final ? '' : 'fuera')}">
      <span class="pos">${i + 1}</span>
      <span class="nom">${escTxt(j.username)}${j.username === yo ? ' (TÚ)' : ''}${!final && j.vivo ? ' · JUGANDO' : ''}</span>
      <span class="det">${detalleJugador(j)}</span>
      <span class="pts">${(j.puntos || 0).toLocaleString()} PTS</span>
    </div>`).join('');
}
window._pintarTablaFin = pintarTablaFin;

// pantalla final ganador y tabla
function mostrarRanking(ranking) {
  const yo = window._miUsername;
  if (window._finVictoria) {
    // ya estas en la pantalla blanca la tabla aparece ahi mismo
    window._rankingFinal = true;
    document.getElementById('fin-wait').style.display = 'none';
    pintarTablaFin(ranking);
    if (document.pointerLockElement) document.exitPointerLock();
    return;
  }
  const ganador = ranking[0];
  document.getElementById('rk-winner').textContent = ganador ? ganador.username : '---';
  document.getElementById('rk-list').innerHTML = ranking.map((j, i) => `
    <div class="rk-row ${i === 0 ? 'first' : ''} ${j.username === yo ? 'me' : ''}">
      <span>${i + 1}. ${escTxt(j.username)}${j.username === yo ? ' (TÚ)' : ''}</span>
      <span>${(j.puntos || 0).toLocaleString()} PTS · ${detalleJugador(j)}</span>
    </div>`).join('');
  document.getElementById('gameover-overlay').classList.remove('visible');
  document.getElementById('ranking-overlay').classList.add('visible');
  if (document.pointerLockElement) document.exitPointerLock();
}

function escTxt(t) {
  return String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// hud pips de jugadores
function actualizarJugadoresHUD(jugadores) {
  const row = document.getElementById('players-row');
  // mantener solo el pip propio
  const propio = row.querySelector('.you');
  row.innerHTML = '';
  if (propio) row.appendChild(propio);

  jugadores.forEach(j => {
    if (j.socketId === socket?.id) return;
    agregarPipJugador(j.socketId, j.username);
  });
}

function agregarPipJugador(socketId, username) {
  const row = document.getElementById('players-row');
  if (document.getElementById('pip-' + socketId)) return;
  const pip = document.createElement('div');
  pip.className = 'player-pip';
  pip.id = 'pip-' + socketId;
  pip.textContent = (username || 'P').substring(0, 3).toUpperCase();
  row.appendChild(pip);
}

function removerPipJugador(socketId) {
  const pip = document.getElementById('pip-' + socketId);
  if (pip) pip.remove();
}

// llamar al cargar para ver si el servidor responde
alCargar(() => {
  fetch('/salas_activas')
    .then(() => document.getElementById('server-status').textContent = 'EN LÍNEA')
    .catch(() => document.getElementById('server-status').textContent = 'OFFLINE');
});
