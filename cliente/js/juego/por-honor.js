'use strict';
// el modo por honor, la zona que se encoge y se mueve y los objetos para todos

// modo por honor, una sola oleada de 3 minutos
// solo cuentan las bajas, tiros a la cabeza y granadas dentro de la zona, no hay tienda
// los objetos aparecen al azar en el mapa y son los mismos para
// todos el primero que llega se los queda
// la zona empieza enorme alrededor del punto de inicio, se encoge hasta que
// apenas caben 2 jugadores cuando el reloj marca 0 30 y cambia de lugar cada 25 s
// todos calculan las mismas posiciones usando el nombre de la sala
const ZONA_R_MAX   = 30;
const ZONA_R_MIN   = 2.2;
const ZONA_ENCOGE_HASTA = 150;   // segundos que pasan hasta que el reloj marca 0 30
const ZONA_MUEVE_CADA   = 25;
const ZONA_DESLIZA      = 2.5;   // segundos que tarda en llegar al nuevo lugar
const ZONA_AVISO        = 5;     // aviso antes de moverse
const ZONA_POS     = new THREE.Vector3(0, 0, 10);
let   ZONA_RADIO   = ZONA_R_MAX;
let   centrosZona  = [];
const ZONA_PERMANENCIA = 5;    // cada 5 s dentro de la zona puntos
const OBJETOS_ZONA_MAX = 6;
const OBJETOS_ZONA_CADA = 9;   // segundos entre objetos nuevos
// objetos que pueden aparecer todos menos la escopeta el numero es que tan seguido salen
const OBJETOS_ZONA_TIPOS = [['escudo', 3], ['granada', 3], ['estamina', 3], ['botiquin', 3], ['cargador', 1]];   // sin escopeta ni disparo automatico
const objetosZona = [];
let zonaVisual = null;
let contadorObjetos = Math.floor(Math.random() * 9000 + 1) * 1000;
// el latido se repite mientras estes afuera y se corta en cuanto regresas a la zona
let latidoSonido = null;
function pararLatido() {
  if (latidoSonido) { latidoSonido.parar(0.15); latidoSonido = null; }
}
let objetosZonaT = 0, envioObjetosT = 0, avisoFueraT = 0;

function enZona() {
  return Math.hypot(camera.position.x - ZONA_POS.x, camera.position.z - ZONA_POS.z) < ZONA_RADIO;
}

// numeros al azar con semilla todos los jugadores obtienen la misma secuencia
function rngTexto(texto) {
  let h = 1779033703 ^ texto.length;
  for (let i = 0; i < texto.length; i++) { h = Math.imul(h ^ texto.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function radioZonaEn(t) {   // t son los segundos que ya pasaron
  const k = Math.min(1, Math.max(0, t / ZONA_ENCOGE_HASTA));
  return ZONA_R_MAX + (ZONA_R_MIN - ZONA_R_MAX) * k;
}

function calcularCentrosZona() {
  const rnd = rngTexto(String(roomParam || ('solo' + Math.random())) + mapName);
  // en el helipuerto la zona siempre esta en el centro y nunca se mueve
  if (ES_HELIPUERTO) { centrosZona = [{ x: 0, z: 0 }]; return; }
  centrosZona = [{ x: INICIO_JUGADOR.x, z: INICIO_JUGADOR.z }];          // empieza donde aparecen los jugadores
  for (let k = 1; k * ZONA_MUEVE_CADA < 180; k++) {
    const r = radioZonaEn(k * ZONA_MUEVE_CADA);
    const lim = Math.max(2, LIMITE - r - 1);
    const prev = centrosZona[k - 1];
    let mejor = null;
    for (let i = 0; i < 80; i++) {
      const x = (rnd() * 2 - 1) * lim, z = (rnd() * 2 - 1) * lim;
      if (puntoBloqueado(x, z, Math.min(r, 2.5))) continue;
      mejor = { x, z };
      if (Math.hypot(x - prev.x, z - prev.z) > Math.min(12, r + 4)) break;   // que si se mueva
    }
    centrosZona.push(mejor || { x: prev.x, z: prev.z });
  }
}

function crearZona() {
  if (zonaVisual) return;
  calcularCentrosZona();
  const g = new THREE.Group();
  const mat = (op, extra) => new THREE.MeshBasicMaterial(Object.assign({ color:0x44ff88, transparent:true, opacity:op, side:THREE.DoubleSide, depthWrite:false }, extra || {}));
  const anillo = new THREE.Mesh(new THREE.RingGeometry(1, 1.01, 64), mat(0.75));
  anillo.rotation.x = -Math.PI / 2; anillo.position.y = 0.05;
  const piso = new THREE.Mesh(new THREE.CircleGeometry(1, 64), mat(0.08));
  piso.rotation.x = -Math.PI / 2; piso.position.y = 0.04;
  const muro = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 3.5, 64, 1, true), mat(0.10, { blending:THREE.AdditiveBlending }));
  muro.position.y = 1.75;
  g.add(anillo, piso, muro);
  scene.add(g);
  // marca blanca de la siguiente posicion aparece 5 s antes de moverse
  const sig = new THREE.Mesh(new THREE.RingGeometry(1, 1.01, 64), new THREE.MeshBasicMaterial({ color:0xffffff, transparent:true, opacity:0.6, side:THREE.DoubleSide, depthWrite:false }));
  sig.rotation.x = -Math.PI / 2; sig.position.y = 0.06; sig.visible = false;
  scene.add(sig);
  zonaVisual = { g, anillo, piso, muro, sig, anilloR: 0, sigR: 0 };
  ZONA_POS.set(centrosZona[0].x, 0, centrosZona[0].z);
  ZONA_RADIO = ZONA_R_MAX;
  aplicarZonaVisual();
}

// el anillo se rehace cuando cambia el radio para que su grosor no crezca
function anilloDe(mesh, r) {
  mesh.geometry.dispose && mesh.geometry.dispose();
  mesh.geometry = new THREE.RingGeometry(Math.max(0.05, r - 0.35), r, 64);
}

function aplicarZonaVisual() {
  const zv = zonaVisual;
  zv.g.position.set(ZONA_POS.x, 0, ZONA_POS.z);
  zv.piso.scale.set(ZONA_RADIO, ZONA_RADIO, 1);
  zv.muro.scale.set(ZONA_RADIO, 1, ZONA_RADIO);
  if (Math.abs(zv.anilloR - ZONA_RADIO) > 0.2) { anilloDe(zv.anillo, ZONA_RADIO); zv.anilloR = ZONA_RADIO; }
}

// posicion y tamaño de la zona segun el tiempo transcurrido igual para todos
function actualizarFormaZona() {
  const t = OLEADAS[0].duracion - game.waveTime;
  ZONA_RADIO = radioZonaEn(t);
  const k = Math.min(centrosZona.length - 1, Math.floor(t / ZONA_MUEVE_CADA));
  const desde = centrosZona[Math.max(0, k - 1)], hacia = centrosZona[k];
  const a = k === 0 ? 1 : Math.min(1, (t - k * ZONA_MUEVE_CADA) / ZONA_DESLIZA);
  const s = a * a * (3 - 2 * a);
  ZONA_POS.set(desde.x + (hacia.x - desde.x) * s, 0, desde.z + (hacia.z - desde.z) * s);
  aplicarZonaVisual();
  // aviso y marca de la siguiente posicion
  const prox = centrosZona[k + 1];
  const faltan = (k + 1) * ZONA_MUEVE_CADA - t;
  const zv = zonaVisual;
  zv.verSig = !!prox && faltan <= ZONA_AVISO;
  zv.sig.visible = zv.verSig;
  if (zv.verSig) {
    const rSig = radioZonaEn((k + 1) * ZONA_MUEVE_CADA);
    if (Math.abs(zv.sigR - rSig) > 0.2) { anilloDe(zv.sig, rSig); zv.sigR = rSig; }
    zv.sig.position.set(prox.x, 0.06, prox.z);
    zv.sig.material.opacity = 0.35 + Math.sin(uniformTiempo.value * 8) * 0.25;
    if (game.zonaAviso !== k) { game.zonaAviso = k; mostrarBanner('LA ZONA SE MUEVE EN 5 SEGUNDOS', 'SIGUE LA MARCA BLANCA'); Sonido.sfx('alerta'); }
  }
  return { prox, faltan };
}

function mostrarBanner(titulo, sub) {
  const b = document.getElementById('mision-banner');
  b.querySelector('.t').textContent = titulo;
  b.querySelector('.s').textContent = sub || '';
  b.classList.add('show');
  clearTimeout(mostrarBanner._t);
  mostrarBanner._t = setTimeout(() => b.classList.remove('show'), 3800);
}

// tramo minuto de la oleada de 3 minutos
function tramoZona() {
  const cfg = OLEADAS[0];
  return Math.max(0, Math.min(cfg.tramos.length - 1, Math.floor((cfg.duracion - game.waveTime) / 60)));
}

// pantalla de mision antes de empezar usa el mismo panel del briefing
function mostrarBriefingZona() {
  game.briefing = true;
  game.briefT   = 5;
  game.briefingAuto = tipoPartida === 'online';
  document.getElementById('wb-wave').textContent  = 'POR HONOR  ·  DIFICULTAD ' + DIF.nombre;
  document.getElementById('wb-title').textContent = '3 MINUTOS DE HONOR';
  document.getElementById('wb-sec').textContent   = 'REGLAS';
  const hordas = DIF_ID === 'estandar'
    ? 'Cada minuto llega un tipo nuevo: minuto 1 caminantes, minuto 2 corredores, minuto 3 tanques.'
    : 'Los 3 tipos de zombie salen desde el principio y cada minuto llegan más.';
  const z = document.getElementById('wb-zombies');
  z.classList.remove('uno');
  z.innerHTML = [
    ['1', 'QUÉDATE EN LA ZONA', (ES_HELIPUERTO ? 'El círculo verde está en el centro de la plataforma, empieza enorme y se encoge hasta que apenas caben 2. Nunca se mueve.' : 'El círculo verde empieza enorme y se encoge hasta que apenas caben 2. Cada 25 s se mueve: una marca blanca te dice a dónde.') + ' Adentro ganas +25 cada 5 s.'],
    ['2', 'AFUERA NO CUENTA', 'Bajas, disparos a la cabeza y granadas solo dan puntos si los haces DENTRO de la zona.'],
    ['3', 'OBJETOS PARA TODOS', 'No hay tienda. Los objetos aparecen al azar en el mapa y son los mismos para todos: el primero que llega se los queda.'],
    ['4', 'TE QUEDAN 3 MINUTOS', hordas + ' Si caes, te levantas a los 5 s.'],
  ].map(([n, t, d]) => `<div class="wb-step"><b>${n}</b><div class="wb-zname" style="font-size:22px">${t}</div><div class="wb-zdesc">${d}</div></div>`).join('');
  z.classList.add('pasos');
  document.getElementById('wb-tip').innerHTML = '<b>CONSEJO:</b> Sal de la zona solo para recoger objetos y regresa rápido. '
    + (tipoPartida === 'online' ? 'Los otros jugadores pueden dispararte para ralentizarte y sacarte de la zona.' : 'La granada paralizante te da tiempo para volver.');
  document.querySelector('.wb-dur').innerHTML = 'DURACIÓN: 3 MINUTOS<br><span style="font-size:14px;color:var(--text-dim);white-space:nowrap">SIN RESCATE · GANA QUIEN HAGA MÁS PUNTOS</span>';
  document.getElementById('wb-go').textContent = tipoPartida === 'online' ? 'COMIENZA EN 5' : 'COMENZAR';
  document.getElementById('wave-brief').classList.add('visible');
  setApuntando(false);
  if (!game.briefingAuto) controls.unlock();
}

// objetos compartidos
function crearObjetoZona(id, tipo, x, z) {
  if (objetosZona.some(o => o.id === id) || !PICKUPS[tipo]) return;
  const m = modeloPickup(tipo);
  m.raiz.position.set(x, 0, z);
  scene.add(m.raiz);
  objetosZona.push({ id, tipo, raiz:m.raiz, modelo:m.modelo, t:Math.random() * 6, pedido:false });
}
function quitarObjetoZona(id) {
  const i = objetosZona.findIndex(o => o.id === id);
  if (i > -1) { scene.remove(objetosZona[i].raiz); objetosZona.splice(i, 1); }
}
function limpiarObjetosZona() { objetosZona.forEach(o => scene.remove(o.raiz)); objetosZona.length = 0; }

function tipoObjetoAlAzar() {
  const total = OBJETOS_ZONA_TIPOS.reduce((a, [, w]) => a + w, 0);
  let r = Math.random() * total;
  for (const [t, w] of OBJETOS_ZONA_TIPOS) { if ((r -= w) <= 0) return t; }
  return 'botiquin';
}

function aparecerObjetoZona() {
  let x = 0, z = 0;
  for (let k = 0; k < 60; k++) {
    x = (Math.random() * 2 - 1) * (LIMITE - 3); z = (Math.random() * 2 - 1) * (LIMITE - 3);
    if (!puntoBloqueado(x, z, 1) && !objetosZona.some(o => Math.hypot(o.raiz.position.x - x, o.raiz.position.z - z) < 6)) break;
  }
  crearObjetoZona(++contadorObjetos, tipoObjetoAlAzar(), Math.round(x * 10) / 10, Math.round(z * 10) / 10);
  envioObjetosT = 0;   // avisar a todos de inmediato
}

function listaObjetosZona() {
  return objetosZona.map(o => [o.id, o.tipo, o.raiz.position.x, o.raiz.position.z]);
}

// anfitrion alguien tomo un objeto solo el primero se lo queda
function tomarObjetoZona(id, por) {
  const o = objetosZona.find(q => q.id === id);
  if (!o) return;
  quitarObjetoZona(id);
  if (tipoPartida === 'online' && window.emitirDelHost) {
    window.emitirDelHost('objeto_tomado', { id, por: por || window._miUsername, tipo: o.tipo });
    window.emitirDelHost('objetos', listaObjetosZona());
  }
  if (!por) { recogerPickup(o.tipo); updateHUD(); }
}

// compañeros mensajes del anfitrion
window._delHost = function({ tipo, datos }) {
  if (!ES_ZONA || esAutoridad() || !datos) return;
  if (tipo === 'objetos' && Array.isArray(datos)) {
    const ids = new Set(datos.map(d => d[0]));
    objetosZona.slice().forEach(o => { if (!ids.has(o.id)) quitarObjetoZona(o.id); });
    datos.forEach(([id, t, x, z]) => crearObjetoZona(id, t, x, z));
  } else if (tipo === 'objeto_tomado') {
    quitarObjetoZona(datos.id);
    if (datos.por === window._miUsername) { recogerPickup(datos.tipo); updateHUD(); }
    else if (datos.por) showAlert(String(datos.por).toUpperCase() + ' TOMÓ: ' + (PICKUPS[datos.tipo] ? PICKUPS[datos.tipo].nombre : 'UN OBJETO'));
  }
};

function actualizarZona(dt) {
  if (!zonaVisual || game.over) return;
  const t = uniformTiempo.value;
  const dentro = enZona() && !game.muerto;
  // afuera de la zona se oye tu corazon
  if (game.waveActive && !dentro && !game.muerto) {
    if (!latidoSonido) { latidoSonido = Sonido.bucle('latido'); if (latidoSonido) latidoSonido.volumen(1); }
  } else pararLatido();

  // colores verde si estas adentro, rojo si estas afuera
  const col = dentro ? 0x44ff88 : 0xff3344;
  zonaVisual.anillo.material.color.setHex(col);
  zonaVisual.piso.material.color.setHex(col);
  zonaVisual.muro.material.color.setHex(col);
  zonaVisual.anillo.material.opacity = 0.55 + Math.sin(t * 4) * 0.2;
  zonaVisual.muro.material.opacity   = 0.08 + Math.sin(t * 2) * 0.03;
  document.body.classList.toggle('fuera-zona', game.waveActive && !dentro && !game.muerto);

  if (game.waveActive) {
    const { prox, faltan } = actualizarFormaZona();
    // puntos por quedarte en la zona
    if (dentro) {
      game.zonaT += dt;
      if (game.zonaT >= ZONA_PERMANENCIA) { game.zonaT -= ZONA_PERMANENCIA; ganarPuntos(25, 'EN LA ZONA'); }
    }
    document.getElementById('objetivo-txt').textContent = (prox && faltan <= ZONA_AVISO)
      ? 'LA ZONA SE MUEVE EN ' + Math.ceil(faltan) + ' — SIGUE LA MARCA BLANCA'
      : (dentro ? 'EN LA ZONA — TUS PUNTOS CUENTAN' : 'FUERA DE LA ZONA — NADA CUENTA, REGRESA');
    document.getElementById('objetivo-txt').style.color = dentro ? '#6dff9a' : '#ff5a5a';
    // minuto nuevo
    const tr = tramoZona();
    if (tr !== game.tramoZona) {
      game.tramoZona = tr;
      if (DIF_ID === 'estandar') {
        const nombres = { caminante:'CAMINANTES', corredor:'CORREDORES', tanque:'TANQUES' };
        const tipo = Object.keys(OLEADAS[0].tramos[tr].mezcla)[0];
        mostrarBanner('MINUTO ' + (tr + 1) + ': LLEGAN LOS ' + nombres[tipo], TIPOS_ZOMBIE[tipo].consejo.toUpperCase());
      } else {
        mostrarBanner('MINUTO ' + (tr + 1) + ': LA HORDA CRECE', 'MÁS ZOMBIES, MÁS RÁPIDO');
      }
      updateHUD();
    }
  }

  // objetos del mapa girar y recoger
  for (let i = objetosZona.length - 1; i >= 0; i--) {
    const o = objetosZona[i];
    o.t += dt;
    o.modelo.rotation.y += dt * 2;
    o.modelo.position.y = 0.6 + Math.sin(o.t * 3) * 0.1;
    if (game.muerto) continue;
    const d = Math.hypot(o.raiz.position.x - camera.position.x, o.raiz.position.z - camera.position.z);
    if (d < 1.6) {
      if (esAutoridad()) tomarObjetoZona(o.id, null);
      else if (!o.pedido) { o.pedido = true; window.emitirAHost && window.emitirAHost('recoger', { id: o.id }); }
    } else o.pedido = false;
  }

  // anfitrion o solitario hacer aparecer objetos y avisar a todos
  if (esAutoridad() && game.waveActive) {
    objetosZonaT -= dt;
    if (objetosZonaT <= 0) {
      objetosZonaT = OBJETOS_ZONA_CADA;
      if (objetosZona.length < OBJETOS_ZONA_MAX) aparecerObjetoZona();
    }
    if (tipoPartida === 'online' && window.emitirDelHost) {
      envioObjetosT -= dt;
      if (envioObjetosT <= 0) { envioObjetosT = 2; window.emitirDelHost('objetos', listaObjetosZona()); }
    }
  }
}

function terminarOleada() {
  game.waveActive = false;
  // la horda restante se dispersa
  enemies.forEach(quitarZombie); enemies.length = 0;
  document.getElementById('countdown').classList.remove('visible');
  if (game.wave >= TOTAL_OLEADAS) {
    // el helicoptero llego pantalla blanca total y fin
    document.getElementById('heli-white').style.opacity = 1;
    triggerGameOver(true);
    return;
  }
  iniciarDescanso();
}
