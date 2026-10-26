'use strict';
// revisa la sesion, muestra la historia y la pantalla para desplegar

// flujo de autenticacion
alCargar(() => {
  // espera un ratito y revisa si hay sesion guardada
  setTimeout(() => {
    const raw = localStorage.getItem('usuario_actual');
    if (!raw) {
      // no hay sesion, de regreso al menu
      window.location.href = 'index.html';
      return;
    }
    try {
      usuario = JSON.parse(raw);
      if (!usuario.username && !usuario.Username) throw new Error('sin nombre');
      usuario.username = usuario.username || usuario.Username;
    } catch {
      localStorage.removeItem('usuario_actual');
      window.location.href = 'index.html';
      return;
    }

    // si hay sesion, sigue la historia y luego la pantalla para desplegar
    document.getElementById('auth-check').style.display = 'none';
    prepararPartida();
  }, 1200);
});

// pantalla para desplegar, el tipo de partida, el mapa y el modo vienen en la direccion
// juego html tipo online y map y modo zona y room room 12
const tipoPartida = urlParams.get('tipo') === 'online' ? 'online' : 'solo';
const roomParam   = urlParams.get('room');
game.gameMode     = urlParams.get('modo') === 'zona' ? 'zona' : 'survival';
const NOMBRE_MODO = { survival: 'RESISTE', zona: 'POR HONOR' };
const ES_ZONA     = game.gameMode === 'zona';

function mostrarLobby() {
  document.getElementById('lobby-username').textContent = usuario.username;
  document.getElementById('lobby-map-tag').textContent  = 'ZONA: ' + mapName;
  document.getElementById('lobby-tipo').textContent     = tipoPartida === 'online' ? 'EN LÍNEA' : 'SOLITARIO';
  document.getElementById('lobby-modo').textContent     = NOMBRE_MODO[game.gameMode];
  document.getElementById('lobby-dif').textContent      = DIF.nombre;
  if (tipoPartida === 'online') document.getElementById('lobby-action-btn').textContent = 'LISTO';
  document.body.dataset.modo = game.gameMode;
  document.getElementById('lobby-screen').classList.add('visible');
}

function prepararPartida() {
  // en linea volver a entrar a la sala de inmediato aunque el jugador lea la intro
  if (tipoPartida === 'online' && roomParam && window.conectarSocket) {
    game.roomName = roomParam;
    window.conectarSocket(roomParam, usuario.username);
    document.getElementById('hud-board').classList.add('visible');
    // en linea no se puede reiniciar la partida es de todos
    document.querySelectorAll('#pause-overlay button').forEach(b => {
      if (b.textContent.includes('REINICIAR')) b.style.display = 'none';
    });
  }
  mostrarIntro();
}

// intro texto que se escribe letra por letra
let introPaginas = [], introIdx = 0, introTimer = null, introEscribiendo = false;

function mostrarIntro() {
  Musica.tocar('menu');
  // dos paginas la historia y el objetivo cambian segun el modo y si juegas solo o en grupo
  // en el helipuerto la zona de por honor no se mueve, se queda en el centro
  const zonaTxt = ES_HELIPUERTO ? 'se queda fija en el centro de la plataforma' : 'cambia de lugar cada 25 segundos';
  const lugar = { 'CIUDAD DEVASTADA':'la CIUDAD DEVASTADA', 'HOSPITAL INFECTADO':'el HOSPITAL INFECTADO', 'HELIPUERTO':'el HELIPUERTO de la azotea' }[mapName] || mapName;
  introPaginas = INTROS[game.gameMode][tipoPartida].map(t => t.replace('{LUGAR}', lugar).replace('{ZONA}', zonaTxt));
  introIdx = 0;
  document.getElementById('intro-place').textContent = mapName;
  document.getElementById('intro-time').textContent  = (ES_ZONA ? 'POR HONOR' : 'RESISTE') + '  ·  DÍA 3 DEL BROTE  ·  03:47 A.M.';
  document.getElementById('intro-progress').innerHTML = introPaginas.map(() => '<span></span>').join('');
  document.getElementById('intro-screen').classList.add('visible');
  const v = document.getElementById('intro-video');
  v.play().catch(() => {});
  escribirPagina();
  actualizarIntroUI();
}

// cada quien avanza su propia intro, el inicio se junta con el boton listo
function actualizarIntroUI() {
  document.querySelector('#intro-screen .intro-hint').textContent = 'ESPACIO / CLIC — CONTINUAR  ·  ESC — SALTAR';
}

function escribirPagina() {
  const el    = document.getElementById('intro-text');
  const texto = introPaginas[introIdx];
  let i = 0;
  introEscribiendo = true;
  clearInterval(introTimer);
  document.querySelectorAll('#intro-progress span').forEach((sp, k) => sp.classList.toggle('done', k <= introIdx));
  document.getElementById('intro-next').textContent =
    introIdx === introPaginas.length - 1 ? 'DESPLEGAR' : 'CONTINUAR';
  introTimer = setInterval(() => {
    i++;
    el.innerHTML = escHTML(texto.slice(0, i)) + '<span class="cursor"></span>';
    if (i >= texto.length) { clearInterval(introTimer); introEscribiendo = false; }
  }, 28);
}

window.avanzarIntro = function() {
  if (!document.getElementById('intro-screen').classList.contains('visible')) return;
  // si todavia se esta escribiendo, mostrar la pagina completa
  if (introEscribiendo) {
    clearInterval(introTimer); introEscribiendo = false;
    document.getElementById('intro-text').innerHTML = escHTML(introPaginas[introIdx]) + '<span class="cursor"></span>';
    return;
  }
  if (introIdx < introPaginas.length - 1) {
    introIdx++; escribirPagina();
  }
  else terminarIntro();
};

window.terminarIntro = function() {
  clearInterval(introTimer);
  document.getElementById('intro-screen').classList.remove('visible');
  document.getElementById('intro-video').pause();
  mostrarLobby();
};

function escHTML(t) {
  return t.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
}

document.getElementById('intro-screen').addEventListener('click', e => {
  if (e.target.tagName !== 'BUTTON') avanzarIntro();
});

window.desplegar = function() {
  if (game.started) { controls.lock(); return; }
  if (tipoPartida === 'online') {
    // en linea todos deben presionar listo para empezar al mismo tiempo
    if (game.listo) return;
    game.listo = true;
    controls.lock();
    document.getElementById('lobby-action-btn').textContent = 'ESPERANDO A LOS DEMÁS...';
    if (window.emitirListo) window.emitirListo('inicio');
    return;
  }
  iniciarJuego();
};

window._sigoEsperando = () => game.listo;

// cuantos jugadores ya estan listos lo manda el servidor
window._listosEstado = function({ fase, listos, total }) {
  const txt = `ESPERANDO A LOS DEMÁS (${listos}/${total} LISTOS)`;
  if (fase === 'inicio' && game.listo && !game.started) document.getElementById('lobby-action-btn').textContent = txt;
  if (fase.startsWith('oleada') && game.intermission) {
    document.getElementById('inter-listos').textContent = game.listo ? txt : `${listos}/${total} LISTOS — PRESIONA ENTER CUANDO ESTÉS LISTO`;
  }
};

// todos listos empezar la partida o la siguiente oleada al mismo tiempo
window._todosListos = function({ fase }) {
  game.listo = false;
  if (fase === 'inicio' && !game.started) { iniciarJuego(); return; }
  if (fase.startsWith('oleada') && game.intermission) iniciarSiguienteOleada();
};
