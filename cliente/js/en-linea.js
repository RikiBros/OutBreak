// salas en linea, crear, unirse, sala de espera, listo y color de camisa

const SERVER = location.origin;

// auth
let usuario = null;
const raw = localStorage.getItem('usuario_actual');
if (!raw) { window.location.href = 'index.html'; }
else {
  try {
    usuario = JSON.parse(raw);
    usuario.username = usuario.username || usuario.Username;
  } catch { window.location.href = 'index.html'; }
}

// socket io
let socket = null;
let selectedRoomId  = null;
let selectedMode    = 'survival';
let miRoomId        = null;
let soyHost         = false;
let maxJugadores    = 4;
let estoyListo      = false;
let todosListos     = false;
const COLORES_CAMISA = ['#24508c', '#b81d1d', '#2e7d32', '#e6b800', '#7b2fbf', '#e66a00', '#1fa3a3', '#e8e8e8', '#222222', '#d63c8f'];
let miColor = '#24508c';
try { miColor = localStorage.getItem('outbreak_color') || miColor; } catch (e) {}

function conectarSocket() {
  socket = io(SERVER);

  socket.on('connect', () => {
    document.getElementById('server-status').textContent = 'EN LÍNEA';
    document.getElementById('server-status').style.color = '#44ff88';
  });

  socket.on('disconnect', () => {
    document.getElementById('server-status').textContent = 'DESCONECTADO';
    document.getElementById('server-status').style.color = '#ff4444';
  });

  // lista de salas actualizada en tiempo real
  socket.on('salas_actualizadas', (salas) => {
    renderSalas(salas);
    const total = salas.reduce((a,s) => a + s.jugadores, 0);
    document.getElementById('online-count').textContent = total || 1;
  });

  // union a sala confirmada
  socket.on('sala_unida', ({ roomId, sala }) => {
    miRoomId = roomId;
    soyHost  = sala.host === usuario.username;
    estoyListo = false;
    mostrarSalaEspera(sala);
  });

  // otro jugador entro
  socket.on('jugador_entro', ({ username }) => {
    actualizarEspera();
  });

  // quien esta listo y de que color es su camisa
  socket.on('espera_estado', (est) => {
    if (!miRoomId) return;
    soyHost = est.host === usuario.username;
    todosListos = !!est.todosListos;
    const yo = est.jugadores.find(j => j.username === usuario.username);
    estoyListo = !!(yo && yo.listo);
    renderJugadoresEspera(est.jugadores, est.maxJugadores, est.host);
    actualizarBtnStart();
  });

  // otro jugador salio
  socket.on('jugador_salio', ({ username }) => {
    actualizarEspera();
    setMsg('join-msg', username + ' abandonó la sala.');
  });

  // nuevo host asignado
  socket.on('nuevo_host', ({ username }) => {
    soyHost = username === usuario.username;
    actualizarBtnStart();
  });

  // la partida empezo, todos al juego
  socket.on('partida_iniciada', ({ mapa, modo, dificultad }) => {
    localStorage.setItem('escenario_seleccionado', mapa);
    // partida en linea el juego se vuelve a conectar a la misma sala
    window.location.href = 'juego.html?tipo=online'
      + '&map='  + encodeURIComponent(mapa)
      + '&modo=' + encodeURIComponent(modo || 'survival')
      + '&dif='  + encodeURIComponent(dificultad || 'estandar')
      + '&room=' + encodeURIComponent(miRoomId);
  });

  // error de sala
  socket.on('error_sala', (msg) => {
    if (miRoomId) document.getElementById('waiting-txt').textContent = '' + msg;
    else setMsg('join-msg', '' + msg);
  });
}

conectarSocket();

// pedir la lista de salas al servidor
async function cargarSalas() {
  try {
    const res  = await fetch(SERVER + '/salas_activas');
    const salas = await res.json();
    renderSalas(salas);
  } catch {
    document.getElementById('rooms-list').innerHTML =
      '<div class="rooms-empty"><span>SERVIDOR OFFLINE</span></div>';
  }
}

function renderSalas(salas) {
  const list = document.getElementById('rooms-list');
  if (!salas.length) {
    list.innerHTML = '<div class="rooms-empty"><span>SIN PARTIDAS ACTIVAS</span><span style="font-size:9px">Crea la primera sala</span></div>';
    return;
  }
  list.innerHTML = salas.map(s => {
    const llena = s.jugadores >= s.maxJugadores;
    const modo = (s.modo === 'zona') ? 'POR HONOR' : 'RESISTE';
    return `<div class="room-card ${llena?'full':''} ${s.id===selectedRoomId?'selected':''}"
      ${llena ? '' : `onclick="seleccionarSala('${s.id}')"`}>
      <div>
        <div class="room-name">${esc(s.nombre)}</div>
        <div class="room-meta">
          HOST: ${esc(s.host||'?')} &nbsp;|&nbsp; ${esc(s.mapa)} &nbsp;|&nbsp; ${modo} &nbsp;|&nbsp; ${s.dificultad === 'dificil' ? 'DIFÍCIL' : 'ESTÁNDAR'}
        </div>
      </div>
      <div class="room-slots">${s.jugadores}/${s.maxJugadores}</div>
    </div>`;
  }).join('');
}

function seleccionarSala(id) {
  selectedRoomId = id;
  document.getElementById('btn-join').disabled = false;
  cargarSalas();
}

// modo de juego
window.selectMode = function(mode) {
  selectedMode = mode;
  document.getElementById('mode-survival').classList.toggle('selected', mode==='survival');
  document.getElementById('mode-zona').classList.toggle('selected',     mode==='zona');
  mostrarInfoDif();
};

// crear sala
async function crearSala() {
  const nombre = document.getElementById('room-name').value.trim() || (usuario.username + "'s ZONE");
  const mapa   = document.getElementById('room-map').value;
  maxJugadores = parseInt(document.getElementById('room-max').value);

  document.getElementById('btn-create').disabled = true;
  setMsg('create-msg', 'Creando sala...');

  try {
    const res  = await fetch(SERVER + '/crear_sala', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        nombre, mapa, modo: selectedMode, maxJugadores,
        dificultad: document.getElementById('room-dif').value,
        id_usuario: usuario.id || usuario.ID_Usuario
      })
    });
    const data = await res.json();
    if (!res.ok) { setMsg('create-msg', data.error); document.getElementById('btn-create').disabled=false; return; }

    setMsg('create-msg', 'Sala creada', true);
    // unirse por socket io
    socket.emit('unirse_sala', { roomId: data.roomId, username: usuario.username, color: miColor });

  } catch {
    setMsg('create-msg', 'Servidor offline.');
    document.getElementById('btn-create').disabled = false;
  }
}

// unirse a sala
function unirseASala() {
  if (!selectedRoomId) { setMsg('join-msg', 'Selecciona una sala primero.'); return; }
  socket.emit('unirse_sala', { roomId: selectedRoomId, username: usuario.username, color: miColor });
}

// sala de espera
function mostrarSalaEspera(sala) {
  document.getElementById('main-grid').style.display     = 'none';
  document.getElementById('waiting-room').classList.add('visible');
  document.getElementById('wr-nombre').textContent = sala.nombre;
  document.getElementById('wr-mapa').textContent   = sala.mapa;
  document.getElementById('wr-modo').textContent   = (sala.modo === 'zona' ? 'POR HONOR' : 'RESISTE') + ' · ' + (sala.dificultad === 'dificil' ? 'DIFÍCIL' : 'ESTÁNDAR');
  renderJugadoresEspera(sala.jugadores, sala.maxJugadores, sala.host);
  renderSwatches();
  actualizarBtnStart();
}

async function actualizarEspera() {
  if (!miRoomId) return;
  try {
    const res  = await fetch(SERVER + '/sala/' + miRoomId);
    const sala = await res.json();
    soyHost = sala.host === usuario.username;
    renderJugadoresEspera(sala.jugadores, sala.maxJugadores, sala.host);
    actualizarBtnStart();
  } catch {}
}

function renderJugadoresEspera(jugadores, max, host) {
  const slots = [];
  const colorOk = c => /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#24508c';
  for (let i=0; i<max; i++) {
    const j   = jugadores[i];
    const esYo = j && j.username === usuario.username;
    if (j) {
      const esHost = j.username === host;
      const estado = esHost ? '<span class="wr-estado host">ANFITRIÓN</span>'
        : (j.listo ? '<span class="wr-estado listo">LISTO</span>' : '<span class="wr-estado">NO LISTO</span>');
      const c = colorOk(j.color);
      slots.push(`
        <div class="wr-player">
          <div class="wr-avatar ${esYo?'you':''}" style="background:${c};border-color:${esYo ? '#fff' : c};color:#fff;text-shadow:0 1px 3px #000">${esc(j.username.substring(0,2).toUpperCase())}</div>
          <div class="wr-pname">${esc(j.username)}${esYo?' (TÚ)':''}</div>
          ${estado}
        </div>`);
    } else {
      slots.push(`
        <div class="wr-player">
          <div class="wr-avatar empty">?</div>
          <div class="wr-pname" style="color:rgba(200,150,150,0.2)">VACÍO</div>
        </div>`);
    }
  }
  document.getElementById('wr-players').innerHTML = slots.join('');
  const otros = jugadores.filter(j => j.username !== host);
  const listos = otros.filter(j => j.listo).length;
  document.getElementById('waiting-txt').textContent =
    otros.length === 0 ? 'ESPERANDO JUGADORES...'
    : (listos === otros.length ? '¡TODOS LISTOS! EL ANFITRIÓN PUEDE INICIAR' : `LISTOS: ${listos}/${otros.length} — ESPERANDO A QUE TODOS PRESIONEN LISTO`);
}

function actualizarBtnStart() {
  const btn = document.getElementById('btn-start');
  const bl  = document.getElementById('btn-listo');
  btn.classList.toggle('visible', soyHost);
  btn.disabled = !todosListos;
  btn.title = todosListos ? '' : 'Todos deben presionar LISTO';
  bl.classList.toggle('visible', !soyHost);
  bl.classList.toggle('on', estoyListo);
  bl.textContent = estoyListo ? 'LISTO (CLIC PARA CANCELAR)' : 'ESTOY LISTO';
}

function toggleListo() {
  if (!socket || !miRoomId || soyHost) return;
  socket.emit('listo_espera', { listo: !estoyListo });
}

function renderSwatches() {
  document.getElementById('swatches').innerHTML = COLORES_CAMISA.map(c =>
    `<button class="swatch ${c === miColor ? 'sel' : ''}" style="background:${c}" title="${c}" onclick="elegirColor('${c}')"></button>`).join('');
}
function elegirColor(c) {
  miColor = c;
  try { localStorage.setItem('outbreak_color', c); } catch (e) {}
  renderSwatches();
  if (socket && miRoomId) socket.emit('cambiar_color', { color: c });
}

// iniciar partida solo host
function iniciarPartida() {
  if (!soyHost || !miRoomId) return;
  socket.emit('iniciar_partida', { roomId: miRoomId });
}

// salir de sala
function salirDeSala() {
  if (socket && miRoomId) socket.emit('salir_sala');
  miRoomId = null; soyHost = false; estoyListo = false; todosListos = false;
  document.getElementById('waiting-room').classList.remove('visible');
  document.getElementById('main-grid').style.display = 'grid';
  document.getElementById('btn-create').disabled = false;
  setMsg('create-msg', '');
  cargarSalas();
}

// explicacion de cada dificultad cambia segun el modo
const INFO_DIF = {
  survival: {
    estandar: [
      'Un tipo de zombie por oleada: caminantes → corredores → tanques',
      'Los zombies hacen <b>40% menos daño</b>',
      'Tienda <b>30% más barata</b>',
      'Empiezas con <b>1 granada, 1 bebida de estamina y 1 botiquín</b>',
      'Estamina completa y velocidad normal',
    ],
    dificil: [
      'Los <b>3 tipos mezclados</b> en cada oleada y más zombies a la vez',
      'Zombies <b>20% más rápidos</b>, atacan más seguido y hacen <b>25% más daño</b>',
      'Tienda <b>40% más cara</b>',
      'Empiezas <b>sin objetos</b>',
      '<b>40% menos estamina</b> y te mueves <b>15% más lento</b>',
    ],
  },
  zona: {
    estandar: [
      'Cada minuto llega un tipo nuevo: <b>caminantes → corredores → tanques</b>',
      'Los zombies hacen <b>40% menos daño</b>',
      'Empiezas con <b>1 granada, 1 bebida de estamina y 1 botiquín</b>',
      'Sin tienda: los objetos aparecen al azar en el mapa',
      'Estamina completa y velocidad normal',
    ],
    dificil: [
      'Los <b>3 tipos desde el primer segundo</b> y cada minuto llegan más',
      'Zombies <b>20% más rápidos</b>, atacan más seguido y hacen <b>25% más daño</b>',
      'Empiezas <b>sin objetos</b>: todo lo tienes que encontrar en el mapa',
      '<b>40% menos estamina</b> y te mueves <b>15% más lento</b>: cuesta más llegar a la zona',
    ],
  },
};
function mostrarInfoDif() {
  const d = document.getElementById('room-dif').value;
  document.getElementById('dif-info').innerHTML = '<ul>' + INFO_DIF[selectedMode][d].map(t => '<li>' + t + '</li>').join('') + '</ul>';
}
mostrarInfoDif();

// ayudantes
function esc(t) {
  return String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function setMsg(id, txt, ok=false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = txt;
  el.className = 'mp-msg' + (ok ? ' ok' : '');
}

// cargar salas al inicio
cargarSalas();
