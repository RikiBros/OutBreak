'use strict';
// mapa completo mientras se mantiene presionado tab, y la flecha que dice hacia donde miras

// hacia donde mira el jugador, en el plano del mapa
const _dirMirada = new THREE.Vector3();
// en el hospital solo se ve el mapa alrededor tuyo y solo con la linterna prendida
const VISTA_HOSPITAL = 12;
function anguloMirada() {
  camera.getWorldDirection(_dirMirada);
  return Math.atan2(_dirMirada.z, _dirMirada.x);
}

// cono de vision y flecha, se usa en el radar y en el mapa grande
function flechaJugador(ctx, x, y, escala) {
  const a = anguloMirada();
  const largo = 26 * escala, abre = 0.6;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, largo);
  grad.addColorStop(0, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath(); ctx.moveTo(x, y);
  ctx.arc(x, y, largo, a - abre, a + abre);
  ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
  // la flecha, un triangulo que apunta hacia donde miras
  const p = 7 * escala;
  ctx.beginPath();
  ctx.moveTo(x + Math.cos(a) * p * 1.4, y + Math.sin(a) * p * 1.4);
  ctx.lineTo(x + Math.cos(a + 2.5) * p, y + Math.sin(a + 2.5) * p);
  ctx.lineTo(x + Math.cos(a) * -p * 0.35, y + Math.sin(a) * -p * 0.35);
  ctx.lineTo(x + Math.cos(a - 2.5) * p, y + Math.sin(a - 2.5) * p);
  ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.lineWidth = Math.max(1, escala); ctx.strokeStyle = '#000'; ctx.stroke();
}

// la pantalla del mapa se arma una sola vez
const mapaGrande = document.createElement('div');
mapaGrande.id = 'mapa-grande';
mapaGrande.innerHTML = '<div class="mg-caja"><div class="mg-titulo"></div><canvas id="mapa-grande-canvas"></canvas>'
  + '<div class="mg-leyenda"></div><div class="mg-ayuda">SUELTA TAB PARA CERRAR · NO TE PUEDES MOVER MIENTRAS VES EL MAPA</div></div>';
document.body.appendChild(mapaGrande);

function abrirMapa() {
  if (!game.started || game.over || game.inShop || game.briefing || game.mapaAbierto) return;
  game.mapaAbierto = true;
  game.disparando = false;
  setApuntando(false);
  mapaGrande.querySelector('.mg-titulo').textContent = 'MAPA · ' + mapName;
  const ley = [['#ffffff', 'TÚ'], ['#ff6b6b', 'CAMINANTE'], ['#ff9933', 'CORREDOR'], ['#c0392b', 'TANQUE'], ['#4da3ff', 'OBJETO']];
  if (tipoPartida === 'online') ley.push(['#44ff88', 'COMPAÑERO']);
  if (ES_ZONA) ley.push(['#44ff88', 'ZONA'], ['#dddddd', 'SIGUIENTE ZONA']);
  mapaGrande.querySelector('.mg-leyenda').innerHTML = ley.map(([c, t]) => `<span><i style="background:${c}"></i>${t}</span>`).join('');
  mapaGrande.classList.add('visible');
  requestAnimationFrame(dibujarMapaGrande);
}

function cerrarMapa() {
  if (!game.mapaAbierto) return;
  game.mapaAbierto = false;
  mapaGrande.classList.remove('visible');
}

document.addEventListener('keydown', e => {
  if (e.code !== 'Tab') return;
  if (game.started) e.preventDefault();       // que tab no cambie de boton
  if (!e.repeat) abrirMapa();
});
document.addEventListener('keyup', e => { if (e.code === 'Tab') cerrarMapa(); });
window.addEventListener('blur', cerrarMapa);    // si cambias de ventana con tab presionado

// dibuja todo el mapa, se repite mientras este abierto
function dibujarMapaGrande() {
  if (!game.mapaAbierto) return;
  requestAnimationFrame(dibujarMapaGrande);
  const c = document.getElementById('mapa-grande-canvas');
  const lado = Math.floor(Math.min(innerHeight * 0.74, innerWidth * 0.9));
  if (c.width !== lado) { c.width = lado; c.height = lado; }
  const ctx = c.getContext('2d');
  const L = LIMITE + 2, S = lado / (L * 2);
  const X = x => (x + L) * S, Z = z => (z + L) * S;

  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, lado, lado);
  if (ES_HOSPITAL) {
    if (!game.linternaOn) {
      ctx.fillStyle = '#777'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('PRENDE LA LINTERNA PARA VER EL MAPA', lado / 2, lado / 2);
      return;
    }
    ctx.save(); ctx.beginPath(); ctx.arc(X(camera.position.x), Z(camera.position.z), VISTA_HOSPITAL * S, 0, Math.PI * 2); ctx.clip();
  }
  ctx.fillStyle = '#0d0505'; ctx.fillRect(0, 0, lado, lado);
  // cuadricula cada 10 metros
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for (let v = -40; v <= 40; v += 10) {
    ctx.beginPath(); ctx.moveTo(X(v), 0); ctx.lineTo(X(v), lado); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, Z(v)); ctx.lineTo(lado, Z(v)); ctx.stroke();
  }
  // el muro de fuego del borde en la ciudad, la orilla redonda en el helipuerto
  if (RADIO_MAPA) {
    ctx.beginPath(); ctx.arc(X(0), Z(0), RADIO_MAPA * S, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(80,78,75,0.5)'; ctx.fill(); ctx.strokeStyle = '#55ff88'; ctx.lineWidth = 3; ctx.stroke();
  } else if (!ES_HOSPITAL) {
    ctx.strokeStyle = 'rgba(255,90,30,0.8)'; ctx.lineWidth = 3;
    ctx.strokeRect(X(-LIMITE), Z(-LIMITE), LIMITE * 2 * S, LIMITE * 2 * S);
  }
  // edificios, autos y barricadas
  solidos.forEach(b => {
    ctx.fillStyle = 'rgba(150,115,100,0.55)';
    ctx.fillRect(X(b.minX), Z(b.minZ), (b.maxX - b.minX) * S, (b.maxZ - b.minZ) * S);
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1;
    ctx.strokeRect(X(b.minX), Z(b.minZ), (b.maxX - b.minX) * S, (b.maxZ - b.minZ) * S);
  });
  // zona de por honor y la siguiente
  if (ES_ZONA) {
    ctx.beginPath(); ctx.arc(X(ZONA_POS.x), Z(ZONA_POS.z), ZONA_RADIO * S, 0, Math.PI * 2);
    ctx.fillStyle = enZona() ? 'rgba(68,255,136,0.15)' : 'rgba(255,51,68,0.15)'; ctx.fill();
    ctx.strokeStyle = enZona() ? '#44ff88' : '#ff3344'; ctx.lineWidth = 3; ctx.stroke();
    if (zonaVisual && zonaVisual.verSig) {
      ctx.beginPath(); ctx.arc(X(zonaVisual.sig.position.x), Z(zonaVisual.sig.position.z), zonaVisual.sigR * S, 0, Math.PI * 2);
      ctx.setLineDash([8, 6]); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    }
  }
  // objetos tirados en el mapa
  const objeto = (x, z, color) => {
    ctx.fillStyle = color; ctx.fillRect(X(x) - 5, Z(z) - 5, 10, 10);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.strokeRect(X(x) - 5, Z(z) - 5, 10, 10);
  };
  const colorObj = t => '#' + PICKUPS[t].color.toString(16).padStart(6, '0');
  pickups.forEach(p => objeto(p.raiz.position.x, p.raiz.position.z, colorObj(p.tipo)));
  if (ES_ZONA) objetosZona.forEach(o => objeto(o.raiz.position.x, o.raiz.position.z, colorObj(o.tipo)));
  // zombies
  enemies.forEach(e => {
    const color = e.tipoId === 'tanque' ? '#c0392b' : e.tipoId === 'corredor' ? '#ff9933' : '#ff6b6b';
    ctx.beginPath(); ctx.arc(X(e.mesh.position.x), Z(e.mesh.position.z), e.tipoId === 'tanque' ? 6 : 4, 0, Math.PI * 2);
    ctx.fillStyle = e.paralizado > 0 ? '#4de8ff' : color; ctx.fill();
  });
  // compañeros en linea, con el color de su camisa y su nombre
  Object.values(jugadoresRemotos).forEach(jr => {
    if (!jr.mesh) return;
    const x = X(jr.mesh.position.x), z = Z(jr.mesh.position.z);
    ctx.beginPath(); ctx.arc(x, z, 7, 0, Math.PI * 2);
    ctx.fillStyle = jr.muerto ? '#555' : (jr.color || '#44ff88'); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#44ff88'; ctx.stroke();
    ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
    ctx.fillText((jr.username || '?') + (jr.muerto ? ' (CAÍDO)' : ''), x, z - 12);
  });
  if (ES_HOSPITAL) ctx.restore();
  // tu, con la flecha de hacia donde miras
  flechaJugador(ctx, X(camera.position.x), Z(camera.position.z), 2.2);
}
