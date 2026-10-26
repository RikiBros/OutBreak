// menu principal, el video que se rebobina, el login con google y la ventana de jugar

var SERVER = location.origin;   // funciona en localhost o desde otra direccion


// efecto de cinta vhs, cuando el video termina se rebobina rapido y vuelve a empezar
var video      = document.getElementById('bg-gif');
var vhsOverlay = document.getElementById('vhs-overlay');
var isRewinding = false;
var rewindRAF   = null;

video.addEventListener('ended', function() {
  iniciarRewind();
});

function iniciarRewind() {
  if (isRewinding) return;
  isRewinding = true;

  // activar el overlay vhs
  vhsOverlay.classList.add('active');
  video.classList.add('rewinding');
  video.pause();

  // retrocede mas rapido que el video normal
    rewindRAF = requestAnimationFrame(rewindFrame);
}

function rewindFrame() {
  if (!isRewinding) return;

  // retrocede a velocidad 4x mas rapida que la reproduccion normal
  video.currentTime -= 0.12;

  if (video.currentTime <= 0.05) {
    // llego al inicio terminar el efecto
    terminarRewind();
  } else {
    rewindRAF = requestAnimationFrame(rewindFrame);
  }
}

function terminarRewind() {
  isRewinding = false;

  // quitar el overlay con pequeño fade
  vhsOverlay.classList.remove('active');
  video.classList.remove('rewinding');

  // pequeña pausa antes de reproducir como si la cinta tomara impulso
  setTimeout(function() {
    video.currentTime = 0;
    video.play();
  }, 180);
}

// estado de sesion
function verificarSesion() {
  var raw = localStorage.getItem('usuario_actual');
  if (raw) {
    try {
      var u = JSON.parse(raw);
      var nombre = u.username || u.Username || 'Operativo';
      document.getElementById('user-badge').style.display      = 'block';
      document.getElementById('btn-abrir-login').style.display = 'none';
      document.getElementById('badge-username').textContent    = nombre;
      document.getElementById('btn-cerrar-sesion').style.display = '';
      var foto = document.getElementById('badge-foto');
      if (u.foto) { foto.src = u.foto; foto.style.display = 'inline-block'; }
      else        { foto.style.display = 'none'; }
    } catch(e) {
      localStorage.removeItem('usuario_actual');
    }
  }
}
// sin sesion no hay nada que cerrar, el boton se esconde
document.getElementById('btn-cerrar-sesion').style.display = 'none';
verificarSesion();

// modal
function abrirAuth()  {
  document.getElementById('auth-modal').classList.add('open');
  prepararGoogle();
}
function cerrarAuth() { document.getElementById('auth-modal').classList.remove('open'); limpiarMsg(); }

function setMsg(txt, ok) {
  var el = document.getElementById('auth-msg');
  el.textContent = txt;
  el.className = 'auth-msg' + (ok ? ' ok' : '');
}
function limpiarMsg() { setMsg(''); }

// login con google
// primero le pide al servidor el id de google
// luego dibuja el boton de google
// 3 google devuelve un token credential
// 4 lo mandamos a auth google el servidor lo
// verifica y crea busca al usuario en mysql
var googleListo = false;

function prepararGoogle() {
  if (googleListo) return;

  // la libreria de google tarda un poco, hay que esperarla
  if (!window.google || !google.accounts || !google.accounts.id) {
    setMsg('Cargando Google...');
    setTimeout(prepararGoogle, 300);
    return;
  }

  fetch(SERVER + '/config')
    .then(function(res) { return res.json(); })
    .then(function(cfg) {
      if (!cfg.googleClientId) {
        setMsg('Falta configurar GOOGLE_CLIENT_ID en server.js');
        return;
      }
      google.accounts.id.initialize({
        client_id: cfg.googleClientId,
        callback : alRecibirCredencialGoogle,
        ux_mode  : 'popup'
      });
      google.accounts.id.renderButton(document.getElementById('google-btn-wrap'), {
        theme : 'filled_black',
        size  : 'large',
        text  : 'signin_with',
        shape : 'rectangular',
        width : 300,
        locale: 'es'
      });
      googleListo = true;
      limpiarMsg();
    })
    .catch(function() {
      setMsg('Servidor offline. Ejecuta: node server.js');
    });
}

function alRecibirCredencialGoogle(respuesta) {
  setMsg('Verificando cuenta...');
  fetch(SERVER + '/auth/google', {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({ credential: respuesta.credential })
  })
  .then(function(res) { return res.json().then(function(d){ return {ok:res.ok, data:d}; }); })
  .then(function(r) {
    if (!r.ok) { setMsg(r.data.error || 'No se pudo iniciar sesión.'); return; }
    var u = r.data.user;
    localStorage.setItem('usuario_actual', JSON.stringify({
      id      : u.ID_Usuario,
      username: u.Username,
      email   : u.Correo,
      foto    : u.Foto,
      puntos  : u.Puntos,
      partidas: u.Partidas
    }));
    setMsg('Bienvenido, ' + u.Username + '!', true);
    setTimeout(function() { cerrarAuth(); verificarSesion(); }, 900);
  })
  .catch(function() {
    setMsg('Servidor offline. Ejecuta: node server.js');
  });
}

// cerrar sesion
function cerrarSesion() {
  localStorage.removeItem('usuario_actual');
  // evita que google vuelva a entrar solo con la misma cuenta
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }
  document.getElementById('user-badge').style.display      = 'none';
  document.getElementById('btn-abrir-login').style.display = 'block';
  document.getElementById('btn-cerrar-sesion').style.display = 'none';
}

// antes de cerrar sesion se pregunta si estas seguro
function pedirCerrarSesion() {
  document.getElementById('logout-nombre').textContent = document.getElementById('badge-username').textContent;
  document.getElementById('logout-modal').classList.add('open');
}
function cancelarCerrarSesion() {
  document.getElementById('logout-modal').classList.remove('open');
}
function confirmarCerrarSesion() {
  cancelarCerrarSesion();
  cerrarSesion();
}

// navegacion con validacion de sesion
function irAJugar(e) {
  e.preventDefault();
  if (!localStorage.getItem('usuario_actual')) {
    abrirAuth();
    setMsg('Inicia sesión para jugar.');
    return;
  }
  document.getElementById('play-modal').classList.add('open');
}
function cerrarModoJuego() {
  document.getElementById('play-modal').classList.remove('open');
}

// esc cierra el modal
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') { cerrarAuth(); cerrarModoJuego(); cancelarCerrarSesion(); }
});
