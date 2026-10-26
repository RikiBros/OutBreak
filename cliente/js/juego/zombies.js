'use strict';
// los tres tipos de zombie, las dificultades y como se ven y se mueven

// zombies 3 tipos
// si existe modelos zombie glb se usa ese modelo con sus animaciones
// si no, se arma un modelo 3d por codigo con extremidades animadas
const TIPOS_ZOMBIE = {
  caminante: { nombre:'CAMINANTE', hp:90,  vel:3.6, dano:10, golpeCada:1.1, escala:1.0,  ancho:1.0,
               piel:0x6b7d5c, ropa:0x4a3b2a, pantalon:0x2b2f3a, ojos:0xffee55, ritmo:7,   inclinacion:0.25, altoGLB:1.8,
               puntos:100, dinero:5,
               desc:'El más común. Lento pero constante: te sigue sin detenerse y llega en grupos.', consejo:'3 disparos o 2 a la cabeza.' },
  corredor:  { nombre:'CORREDOR',  hp:45,  vel:6.2, dano:7,  golpeCada:0.7, escala:0.92, ancho:0.85,
               piel:0x8a6f62, ropa:0x6e1414, pantalon:0x1f1f1f, ojos:0xff2222, ritmo:13,  inclinacion:0.5,  altoGLB:1.65,
               puntos:150, dinero:8,
               desc:'Delgado, camisa roja y ojos rojos. Corre casi tan rápido como tú y golpea muy seguido.', consejo:'Frágil: 2 disparos. Elimínalo antes de que te alcance.' },
  tanque:    { nombre:'TANQUE',    hp:320, vel:2.4, dano:25, golpeCada:1.6, escala:1.45, ancho:1.5,
               piel:0x4c5a45, ropa:0x23262b, pantalon:0x1a1a1a, ojos:0x55ff55, ritmo:4.5, inclinacion:0.15, altoGLB:2.5,
               puntos:300, dinero:15,
               desc:'Enorme, ojos verdes. Avanza despacio pero aguanta mucho y cada golpe te quita 25 de vida.', consejo:'Unos 10 disparos. Mantén distancia y usa granadas.' },
};

// 3 oleadas de 1 minuto, la mezcla dice que tan seguido sale cada tipo
// dificultad no cambia el tiempo cambia que zombies salen, su daño y los precios
const DIF_ID = urlParams.get('dif') === 'dificil' ? 'dificil' : 'estandar';
const DIFICULTADES = {
  // un solo tipo de zombie por oleada, del mas tranquilo al mas dificil
  estandar: {
    nombre:'ESTÁNDAR',
    danoMult:0.6,          // los zombies hacen 40 por ciento menos daño
    precioMult:0.7,        // tienda 30 por ciento mas barata
    velJugador:1,          // velocidad normal
    staminaMax:100,        // estamina completa
    zombieVel:1, zombieAtaque:1,
    itemsIniciales:[0, 1, 1, 1],   // escudo, granada, bebida de estamina, botiquin
    oleadas:[
      { duracion:60, intervalo:1.3, maxVivos:16, mezcla:{ caminante:1 } },
      { duracion:60, intervalo:1.4, maxVivos:14, mezcla:{ corredor:1 } },
      { duracion:60, intervalo:2.4, maxVivos:9,  mezcla:{ tanque:1 } },
    ],
  },
  // los 3 tipos mezclados, zombies mas agresivos, tienda cara, menos estamina y sin objetos
  dificil: {
    nombre:'DIFÍCIL',
    danoMult:1.25,         // 25 por ciento mas daño
    precioMult:1.4,        // tienda 40 por ciento mas cara
    velJugador:0.85,       // te mueves 15 por ciento mas lento
    staminaMax:60,         // 40 por ciento menos estamina
    zombieVel:1.2,         // zombies 20 por ciento mas rapidos
    zombieAtaque:0.7,      // atacan mas seguido
    itemsIniciales:[0, 0, 0, 0],   // empiezas sin objetos
    oleadas:[
      { duracion:60, intervalo:1.4,  maxVivos:16, mezcla:{ caminante:0.60, corredor:0.25, tanque:0.15 } },
      { duracion:60, intervalo:1.0,  maxVivos:22, mezcla:{ caminante:0.50, corredor:0.30, tanque:0.20 } },
      { duracion:60, intervalo:0.75, maxVivos:28, mezcla:{ caminante:0.40, corredor:0.33, tanque:0.27 } },
    ],
  },
};
const DIF = DIFICULTADES[DIF_ID];
// objetos y estamina con los que se empieza segun la dificultad
function aplicarDificultadInicial() {
  game.items   = DIF.itemsIniciales.slice();
  game.stamina = DIF.staminaMax;
}
aplicarDificultadInicial();
// por honor es una sola oleada de 3 minutos, cada minuto usa la mezcla de una oleada
const OLEADAS = ES_ZONA ? [{ duracion:180, tramos: DIF.oleadas.map(o => ({ ...o })) }] : DIF.oleadas;
const TOTAL_OLEADAS  = OLEADAS.length;
const RECARGA_SEG    = 5;     // segundos para recargar
const ESCUDO_MAX     = 100;
const CADENCIA       = 0.11;  // segundos entre disparos con disparo automatico

// modelo 3d, si existe modelos zombie glb se usa en vez del hecho por codigo
const gltfLoader = new GLTFLoader();
const ZOMBIE_GLB_PATH = 'modelos/zombie.glb';
let zombieTemplate  = null;
let zombieAnimClips = [];
let zombieAltura    = 1.8;
const zombieMixers  = [];     // un animador por zombie cuando hay modelo glb
const clonarConEsqueleto = (SkeletonUtilsMod.SkeletonUtils && SkeletonUtilsMod.SkeletonUtils.clone) || SkeletonUtilsMod.clone;

gltfLoader.load(
  ZOMBIE_GLB_PATH,
  (gltf) => {
    zombieTemplate  = gltf.scene;
    zombieAnimClips = gltf.animations;
    zombieTemplate.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
    const caja = new THREE.Box3().setFromObject(zombieTemplate);
    zombieAltura = Math.max(0.01, caja.max.y - caja.min.y);
    console.log('zombie.glb cargado. Animaciones:', zombieAnimClips.map(a => a.name));
  },
  null,
  () => console.log('No hay modelos/zombie.glb — se usan los zombies hechos por código')
);

// busca una animacion cuyo nombre contenga alguna de las palabras
function findClip(palabras) {
  if (!zombieAnimClips.length) return null;
  const lista = Array.isArray(palabras) ? palabras : [palabras];
  for (const p of lista) {
    const c = zombieAnimClips.find(c => c.name.toLowerCase().includes(p));
    if (c) return c;
  }
  return null;
}

// modelo hecho por codigo humanoide con articulaciones
const _geoCache = {};
function caja(w, h, d) {
  const k = w + '_' + h + '_' + d;
  return _geoCache[k] || (_geoCache[k] = new THREE.BoxGeometry(w, h, d));
}

function crearHumanoide(op) {
  const mat = c => new THREE.MeshStandardMaterial({ color:c, roughness:0.85 });
  const mPiel = mat(op.piel), mRopa = mat(op.ropa), mPant = mat(op.pantalon);
  const mOjos = new THREE.MeshBasicMaterial({ color:op.ojos });
  const root   = new THREE.Group();
  const cuerpo = new THREE.Group();          // se rota completo al morir
  cuerpo.scale.setScalar(op.escala);
  root.add(cuerpo);
  const A = op.ancho || 1;
  const add = (padre, geo, m, x, y, z, sombra) => {
    const me = new THREE.Mesh(geo, m); me.position.set(x, y, z);
    if (sombra && SHADOWS) me.castShadow = true;
    padre.add(me); return me;
  };

  // piernas pivote en la cadera
  const pierna = lado => {
    const p = new THREE.Group(); p.position.set(lado * 0.13 * A, 0.95, 0); cuerpo.add(p);
    add(p, caja(0.17, 0.5, 0.18), mPant, 0, -0.25, 0, true);
    add(p, caja(0.15, 0.45, 0.16), mPant, 0, -0.71, 0);
    add(p, caja(0.17, 0.08, 0.26), mRopa, 0, -0.91, 0.04);
    return p;
  };
  const piernaI = pierna(-1), piernaD = pierna(1);

  // torso pivote en la cadera, inclinado hacia adelante
  const torso = new THREE.Group(); torso.position.y = 0.95; torso.rotation.x = op.inclinacion || 0; cuerpo.add(torso);
  add(torso, caja(0.5 * A, 0.62, 0.28), mRopa, 0, 0.33, 0, true);
  add(torso, caja(0.46 * A, 0.12, 0.26), mPiel, 0, 0.02, 0.01);      // piel expuesta ropa rota

  // cabeza
  const cabeza = new THREE.Group(); cabeza.position.y = 0.66; torso.add(cabeza);
  const craneo = add(cabeza, caja(0.27, 0.3, 0.27), mPiel, 0, 0.15, 0, true);
  craneo.userData.cabeza = true;
  [-0.06, 0.06].forEach(x => { const o = add(cabeza, caja(0.05, 0.035, 0.02), mOjos, x, 0.18, 0.14); o.userData.cabeza = true; });
  add(cabeza, caja(0.16, 0.05, 0.02), new THREE.MeshBasicMaterial({ color:0x110000 }), 0, 0.05, 0.14);

  // brazos pivote en el hombro
  const brazo = lado => {
    const b = new THREE.Group(); b.position.set(lado * (0.25 * A + 0.08), 0.58, 0); torso.add(b);
    add(b, caja(0.13, 0.4, 0.14), mRopa, 0, -0.2, 0);
    add(b, caja(0.11, 0.38, 0.12), mPiel, 0, -0.57, 0);
    add(b, caja(0.12, 0.12, 0.12), mPiel, 0, -0.81, 0);
    return b;
  };
  const brazoI = brazo(-1), brazoD = brazo(1);

  return { root, cuerpo, partes:{ piernaI, piernaD, brazoI, brazoD, torso, cabeza } };
}

function createEnemy(tipoId, x, z) {
  const t = TIPOS_ZOMBIE[tipoId];
  const e = {
    tipo: t, tipoId,
    hp: t.hp, speed: t.vel * DIF.zombieVel * (0.9 + Math.random() * 0.2),
    id: null, alive: true, attackTimer: 0.4, atacando: false,
    fase: Math.random() * 6, partes: null, cuerpo: null, mixer: null, acciones: {},
  };

  if (zombieTemplate && clonarConEsqueleto) {
    // modelo glb
    const g = new THREE.Group();
    const clone = clonarConEsqueleto(zombieTemplate);
    clone.scale.setScalar(t.altoGLB / zombieAltura);
    clone.traverse(n => {
      if (n.isMesh && n.material) {
        n.material = n.material.clone();             // material propio para el destello de daño
        if (tipoId === 'corredor') n.material.color.multiply(new THREE.Color(1.15, 0.8, 0.8));
        if (tipoId === 'tanque')   n.material.color.multiply(new THREE.Color(0.7, 0.8, 0.7));
      }
    });
    g.add(clone);
    e.mesh = g; e.cuerpo = clone;
    e.mixer = new THREE.AnimationMixer(clone);
    zombieMixers.push(e.mixer);
    setZombieAnim(e, tipoId === 'corredor' ? ['run', 'walk'] : ['walk']);
  } else {
    // modelo por codigo
    const h = crearHumanoide(t);
    e.mesh = h.root; e.cuerpo = h.cuerpo; e.partes = h.partes;
  }

  e.mesh.position.set(x, 0, z);
  scene.add(e.mesh);
  return e;
}

// cambiar la animacion del glb, caminar, correr, atacar o morir
function setZombieAnim(e, palabras, unaVez) {
  if (!e.mixer) return;
  const clip = findClip(palabras) || zombieAnimClips[0];
  if (!clip) return;
  const accion = e.mixer.clipAction(clip);
  if (e.accionActual === accion) return;
  if (e.accionActual) e.accionActual.fadeOut(0.2);
  accion.reset();
  if (unaVez) { accion.setLoop(THREE.LoopOnce, 1); accion.clampWhenFinished = true; }
  else accion.setLoop(THREE.LoopRepeat, Infinity);
  accion.fadeIn(0.2).play();
  e.accionActual = accion;
}

// animacion por codigo caminar atacar
function animarHumanoide(e, dt) {
  const p = e.partes; if (!p) return;
  e.fase += dt * e.tipo.ritmo * (e.atacando ? 1.4 : 1);
  const s = Math.sin(e.fase);
  if (!e.atacando) {
    p.piernaI.rotation.x =  s * 0.6;
    p.piernaD.rotation.x = -s * 0.6;
    p.brazoI.rotation.x = -1.35 + Math.sin(e.fase * 0.5) * 0.15;
    p.brazoD.rotation.x = -1.35 - Math.sin(e.fase * 0.5) * 0.15;
    e.cuerpo.position.y = Math.abs(Math.cos(e.fase)) * 0.05;
  } else {
    p.piernaI.rotation.x = p.piernaD.rotation.x = 0;
    p.brazoI.rotation.x = -1.7 + (Math.sin(e.fase * 1.5) + 1) * 0.55;
    p.brazoD.rotation.x = -1.7 + (Math.sin(e.fase * 1.5 + Math.PI) + 1) * 0.55;
  }
  p.cabeza.rotation.z = Math.sin(e.fase * 0.3) * 0.2;
}

function elegirTipo(mezcla) {
  let r = Math.random();
  for (const [tipo, prob] of Object.entries(mezcla)) { if ((r -= prob) <= 0) return tipo; }
  return 'caminante';
}

function spawnZombie(mezcla) {
  if (!esAutoridad()) return;          // en linea los zombies los crea el anfitrion
  let x = 0, z = 0;
  for (let intento = 0; intento < 8; intento++) {
    if (SPAWNS) {
      // entran por los extremos de las calles con un poco de variacion
      const sp = SPAWNS[Math.floor(Math.random() * SPAWNS.length)];
      x = sp[0] + (Math.random() - 0.5) * 3; z = sp[1] + (Math.random() - 0.5) * 3;
    } else {
      const ang = Math.random() * Math.PI * 2, r = 30 + Math.random() * 6;
      x = Math.cos(ang) * r; z = Math.sin(ang) * r;
    }
    const lejos = posicionesJugadores().every(p => Math.hypot(x - p.x, z - p.z) > 16);
    if (lejos && !puntoBloqueado(x, z, 0.5)) break;
  }
  const e = createEnemy(elegirTipo(mezcla), x, z);
  e.id = ++contadorZombies;
  enemies.push(e);
}

function damageEnemy(enemy, dmg, cabeza, atacante) {
  if (!enemy.alive) return;
  destelloZombie(enemy);
  // en linea, si no eres el anfitrion, el decide si el zombie muere
  if (!esAutoridad()) {
    if (window.emitirAHost) window.emitirAHost('golpe', { id: enemy.id, dmg, cabeza: !!cabeza });
    return;
  }
  enemy.hp -= dmg;
  if (enemy.hp <= 0) killEnemy(enemy, atacante || null, !!cabeza);
}

function destelloZombie(enemy) {
  enemy.mesh.traverse(n => {
    if (n.isMesh && n.material && n.material.color && !n.material.isMeshBasicMaterial) {
      if (n.userData.c0 === undefined) n.userData.c0 = n.material.color.getHex();
      n.material.color.set(0xff2222);
      setTimeout(() => n.material.color.setHex(n.userData.c0), 90);
    }
  });
}

const muriendo = [];   // zombies con animacion de muerte

function quitarZombie(e) {
  scene.remove(e.mesh);
  if (e.mixer) {
    e.mixer.stopAllAction();
    const i = zombieMixers.indexOf(e.mixer);
    if (i > -1) zombieMixers.splice(i, 1);
  }
}

// si no hay atacante lo mataste tu, si no, es el nombre de quien lo mato
function killEnemy(enemy, atacante, cabeza) {
  if (!enemy.alive) return;
  matarVisual(enemy);
  if (tipoPartida === 'online' && window.emitirZombieMuerto)
    window.emitirZombieMuerto(enemy.id, atacante || window._miUsername, !!cabeza, enemy.tipoId);
  if (!atacante) otorgarBaja(enemy.tipoId, cabeza);
}

// quitar al zombie de la lista y reproducir su caida
function matarVisual(enemy) {
  enemy.alive = false;
  const i = enemies.indexOf(enemy);
  if (i > -1) enemies.splice(i, 1);
  enemy.tMuerte = 0;
  if (enemy.mixer) setZombieAnim(enemy, ['death', 'die', 'dying'], true);
  muriendo.push(enemy);
}

// cada tipo de zombie da distintos puntos y dinero, a la cabeza vale mas
function otorgarBaja(tipoId, cabeza) {
  const t = TIPOS_ZOMBIE[tipoId] || TIPOS_ZOMBIE.caminante;
  if (ES_ZONA && !enZona()) { avisoFueraZona('BAJA'); return; }
  game.kills++;
  game.cash += t.dinero;
  const base = t.puntos + game.wave * 25;
  ganarPuntos(base, t.nombre + ' ELIMINADO');
  if (cabeza) ganarPuntos(Math.round(base * 0.5), 'BAJA A LA CABEZA');
}
