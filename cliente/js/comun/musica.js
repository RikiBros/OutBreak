// musica del juego, cada cancion es un archivo mp3 en la carpeta audio musica
// si falta el archivo de una cancion, esa parte se queda sin musica
const Musica = (function () {
  const RUTA = 'audio/musica/';
  let deseada = null;          // la cancion que deberia sonar
  let actual = null;           // la que suena, con su audio y que tan fuerte va
  const apagandose = [];       // canciones que se estan desvaneciendo
  let atenuada = false;
  let hay = [];                // canciones que si tienen archivo, null si no se sabe

  // volumen final, el de configuracion por el desvanecido y por la pausa
  function volumen(c) {
    return Math.max(0, Math.min(1, Sonido.volMusica() * c.nivel * (atenuada ? 0.3 : 1) * 0.8));
  }

  // cada rato se acomoda el volumen de todo, asi los cambios se sienten suaves
  setInterval(() => {
    if (actual) {
      actual.nivel = Math.min(1, actual.nivel + 0.05);
      actual.audio.volume = volumen(actual);
    }
    for (let i = apagandose.length - 1; i >= 0; i--) {
      const c = apagandose[i];
      c.nivel -= c.paso;
      if (c.nivel <= 0) { c.audio.pause(); apagandose.splice(i, 1); }
      else c.audio.volume = volumen(c);
    }
  }, 50);

  function apagar(seg) {
    if (!actual) return;
    actual.paso = 0.05 / Math.max(0.1, seg);
    apagandose.push(actual);
    actual = null;
  }

  // intenta tocar, el navegador no deja hasta que el jugador da clic
  function reproducir(c) {
    const p = c.audio.play();
    if (p && p.catch) p.catch(() => { c.pendiente = true; });
  }
  ['pointerdown', 'keydown'].forEach(ev => document.addEventListener(ev, () => {
    if (actual && actual.pendiente) { actual.pendiente = false; reproducir(actual); }
  }, true));

  function arrancar(nombre) {
    if (hay && !hay.includes(nombre)) return;
    const audio = new Audio(RUTA + nombre + '.mp3');
    audio.loop = true;
    audio.addEventListener('error', () => { if (actual && actual.audio === audio) actual = null; });
    audio.volume = 0;
    const c = { nombre, audio, nivel: 0, paso: 0 };
    // en los menus la cancion sigue donde se quedo en la pagina anterior
    try {
      const g = JSON.parse(sessionStorage.getItem('outbreak_musica') || 'null');
      if (g && g.nombre === nombre && Date.now() - g.cuando < 15000) audio.currentTime = g.tiempo;
    } catch (e) {}
    actual = c;
    reproducir(c);
  }

  function tocar(nombre) {
    deseada = nombre;
    if (actual && actual.nombre === nombre) return;
    apagar(1.2);
    arrancar(nombre);
  }

  function parar(seg = 1.5) { deseada = null; apagar(seg); }

  function atenuar(si) { atenuada = si; }

  // pedacitos de musica para el final, victoria, derrota y fin honor, tambien son opcionales
  function remate(tipo) {
    if (hay && !hay.includes(tipo)) return;
    const audio = new Audio(RUTA + tipo + '.mp3');
    audio.volume = Math.min(1, Sonido.volMusica() * 0.8);
    audio.play().catch(() => {});
  }

  // al cambiar de pagina se guarda en que segundo iba la cancion
  window.addEventListener('pagehide', () => {
    try {
      if (actual) sessionStorage.setItem('outbreak_musica', JSON.stringify({ nombre: actual.nombre, tiempo: actual.audio.currentTime, cuando: Date.now() }));
    } catch (e) {}
  });

  // primero se pregunta que canciones hay, luego suena la que se haya pedido
  Sonido.disponibles.then(d => {
    hay = d.musica;
    if (deseada && !actual) arrancar(deseada);
  });

  // en los menus suena la musica del menu
  if (!/juego\.html$/i.test(location.pathname)) tocar('menu');

  return {
    tocar, parar, atenuar, remate,
    actual: () => (actual ? actual.nombre : null),
  };
})();
