'use strict';
// la pantalla que explica cada oleada antes de empezar

// oleadas por tiempo 3 oleadas de 1 minuto
function iniciarOleada() {
  // primero se muestra el briefing la oleada arranca con comenzaroleada
  updateHUD();
  mostrarBriefing();
}

// briefing antes de cada oleada
const BRIEF = {
  estandar: [
    { titulo:'LOS CAMINANTES', consejo:'Son lentos: apunta con calma a la cabeza (doble daño). Cuida tus balas, recargar tarda 5 segundos.' },
    { titulo:'LOS CORREDORES', consejo:'Te alcanzan muy rápido. Una granada paralizante los deja quietos 5 segundos: aprovecha para eliminarlos.' },
    { titulo:'LOS TANQUES',    consejo:'Aguantan mucho y pegan fuerte. Corre con SHIFT para mantener distancia y activa el escudo antes de que te rodeen.' },
  ],
  dificil: [
    { titulo:'LA HORDA DESPIERTA', consejo:'Vienen los tres tipos juntos. Elimina primero a los corredores: son los que te alcanzan.' },
    { titulo:'LLEGAN LOS RÁPIDOS', consejo:'Más corredores. Paralízalos con una granada y recarga solo cuando estés a salvo.' },
    { titulo:'LA ÚLTIMA NOCHE',    consejo:'Los tanques llegan en grupo. Escudo activo y granada en medio de la horda.' },
  ],
};
const hex = n => '#' + n.toString(16).padStart(6, '0');

// dibujo del zombie vista de frente, mismo estilo que el modelo 3d
function svgZombie(t) {
  const A = t.ancho, tw = 28 * A, cx = 43;
  const piel = hex(t.piel), ropa = hex(t.ropa), pant = hex(t.pantalon), ojos = hex(t.ojos);
  return `<svg viewBox="0 0 86 110">
    <rect x="${cx - tw / 2 - 9}" y="34" width="9" height="20" fill="${ropa}"/><rect x="${cx - tw / 2 - 9}" y="52" width="9" height="12" fill="${piel}"/>
    <rect x="${cx + tw / 2}" y="34" width="9" height="20" fill="${ropa}"/><rect x="${cx + tw / 2}" y="52" width="9" height="12" fill="${piel}"/>
    <rect x="${cx - tw / 2}" y="32" width="${tw}" height="32" fill="${ropa}"/>
    <rect x="${cx - tw / 2 + 2}" y="58" width="${tw - 4}" height="6" fill="${piel}"/>
    <rect x="${cx - 11}" y="8" width="22" height="23" fill="${piel}"/>
    <rect x="${cx - 7}" y="16" width="5" height="3" fill="${ojos}"/><rect x="${cx + 2}" y="16" width="5" height="3" fill="${ojos}"/>
    <rect x="${cx - 6}" y="24" width="12" height="3" fill="#110000"/>
    <rect x="${cx - 11 * A}" y="64" width="${10 * A}" height="36" fill="${pant}"/>
    <rect x="${cx + 1 * A}" y="64" width="${10 * A}" height="36" fill="${pant}"/>
    <rect x="${cx - 12 * A}" y="99" width="${12 * A}" height="5" fill="${ropa}"/><rect x="${cx}" y="99" width="${12 * A}" height="5" fill="${ropa}"/>
  </svg>`;
}

function mostrarBriefing() {
  if (ES_ZONA) { mostrarBriefingZona(); return; }
  const n = game.wave, cfg = OLEADAS[n - 1], info = BRIEF[DIF_ID][n - 1];
  game.briefing = true;
  game.briefT   = 5;                   // en linea empieza sola a los 5 s todos al mismo tiempo
  game.briefingAuto = tipoPartida === 'online';
  document.getElementById('wb-wave').textContent  = `OLEADA ${n} DE ${TOTAL_OLEADAS}  ·  DIFICULTAD ${DIF.nombre}`;
  document.getElementById('wb-title').textContent = info.titulo;
  const tipos = Object.entries(TIPOS_ZOMBIE).filter(([id]) => (cfg.mezcla[id] || 0) > 0);
  document.getElementById('wb-sec').textContent = tipos.length === 1 ? 'EL ZOMBIE DE ESTA OLEADA' : 'LOS ZOMBIES DE ESTA OLEADA';
  document.getElementById('wb-zombies').classList.toggle('uno', tipos.length === 1);
  document.getElementById('wb-zombies').innerHTML = tipos.map(([id, t]) => {
    const pct = Math.round((cfg.mezcla[id] || 0) * 100);
    const barra = (lbl, v) => `<div class="wb-stat">${lbl}<div><span style="width:${Math.round(v * 100)}%"></span></div></div>`;
    return `<div class="wb-z">
      ${svgZombie(t)}
      <div>
        <div class="wb-zname">${t.nombre}<b>${pct === 100 ? 'TODA LA OLEADA' : pct + '% DE LA HORDA'}</b></div>
        <div class="wb-zdesc">${t.desc}</div>
        <div class="wb-ztip" style="color:#8fd14f;margin:0 0 6px">RECOMPENSA: +$${t.dinero} · ${t.puntos} PUNTOS</div>
        ${barra('VIDA', t.hp / 320)}${barra('VELOCIDAD', t.vel / 6.5)}${barra('DAÑO', t.dano / 25)}
        <div class="wb-ztip">${t.consejo}</div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('wb-tip').innerHTML = '<b>CONSEJO:</b> ' + info.consejo;
  document.getElementById('wb-go').textContent = tipoPartida === 'online' ? 'COMIENZA EN 5' : 'COMENZAR OLEADA';
  document.getElementById('wave-brief').classList.add('visible');
  setApuntando(false);
  if (!game.briefingAuto) controls.unlock();
}

window.comenzarOleada = function(automatico) {
  if (!game.briefing) return;
  if (game.briefingAuto && !automatico) return;      // en linea empieza sola para todos
  game.briefingAuto = false;
  game.briefing = false;
  document.getElementById('wave-brief').classList.remove('visible');
  const cfg = OLEADAS[game.wave - 1];
  game.waveActive = true;
  game.waveTime   = cfg.duracion;
  game.spawnTimer = 0.5;
  showWaveAlert(); updateHUD();
  Sonido.sfx('oleada');
  // en resiste la ciudad usa mapa y los mapas nuevos usan mapa2, por honor siempre usa honor
  Musica.tocar(ES_ZONA ? 'honor' : (ES_HELIPUERTO ? 'helipuerto' : (ES_HOSPITAL ? 'mapa2' : 'mapa')));
  // si compraste algo, avisar que esta esperando en el mapa
  if (pickups.length > 0) {
    const b = document.getElementById('objetos-banner');
    b.classList.add('show');
    setTimeout(() => b.classList.remove('show'), 4000);
  }
  controls.lock();
};
