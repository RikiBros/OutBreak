'use strict';
// la pistola, la escopeta y los disparos

// armas en primera persona pistola y escopeta mas fogonazo
const vista = new THREE.Group();
vista.position.set(0.28, -0.26, -0.55);
camera.add(vista);
const metalArma = new THREE.MeshStandardMaterial({ color:0x2a2a2e, metalness:0.7, roughness:0.35 });
const maderaArma = new THREE.MeshStandardMaterial({ color:0x5a3218, roughness:0.7 });

const modeloPistola = new THREE.Group();
(() => {
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.3), metalArma); modeloPistola.add(cuerpo);
  const mango = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.07), metalArma);
  mango.position.set(0, -0.1, 0.09); mango.rotation.x = 0.25; modeloPistola.add(mango);
})();
const modeloEscopeta = new THREE.Group();
(() => {
  const canon = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.75, 10), metalArma);
  canon.rotation.x = Math.PI / 2; canon.position.set(0, 0.02, -0.22); modeloEscopeta.add(canon);
  const bomba = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.22), maderaArma);
  bomba.position.set(0, -0.03, -0.25); modeloEscopeta.add(bomba);
  const caja = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.22), metalArma);
  caja.position.set(0, -0.01, 0.1); modeloEscopeta.add(caja);
  const culata = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.3), maderaArma);
  culata.position.set(0, -0.05, 0.33); culata.rotation.x = 0.12; modeloEscopeta.add(culata);
})();
modeloEscopeta.visible = false;
vista.add(modeloPistola, modeloEscopeta);

const fogonazo = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6),
  new THREE.MeshBasicMaterial({ color:0xffd27a, transparent:true, opacity:0.95, blending:THREE.AdditiveBlending, depthWrite:false }));
fogonazo.visible = false;
vista.add(fogonazo);
let retroceso = 0;

function efectoDisparo(fuerza) {
  retroceso = fuerza;
  fogonazo.position.set(0, 0.02, game.arma === 'escopeta' ? -0.62 : -0.2);
  fogonazo.scale.setScalar(game.arma === 'escopeta' ? 2.2 : 1);
  fogonazo.visible = true;
  setTimeout(() => { fogonazo.visible = false; }, 55);
}

function actualizarVista(dt) {
  // al apuntar el arma se centra
  const objX = game.aiming ? 0.0 : 0.28, objY = game.aiming ? -0.19 : -0.26;
  vista.position.x += (objX - vista.position.x) * Math.min(1, dt * 12);
  vista.position.y += (objY - vista.position.y) * Math.min(1, dt * 12);
  retroceso = Math.max(0, retroceso - dt * 4);
  vista.position.z = -0.55 + retroceso * 0.25;
  vista.rotation.x = retroceso * 0.5;
}

window.cambiarArma = function(arma) {
  if (!arma) arma = game.arma === 'pistola' ? 'escopeta' : 'pistola';
  if (arma === 'escopeta' && !game.mejoras.escopeta) { showAlert('PRIMERO COMPRA LA ESCOPETA EN LA TIENDA'); return; }
  if (arma === game.arma) return;
  game.arma = arma;
  modeloPistola.visible  = arma === 'pistola';
  modeloEscopeta.visible = arma === 'escopeta';
  game.disparando = false;
  showAlert(arma === 'escopeta' ? 'ARMA: ESCOPETA' : 'ARMA: PISTOLA');
  updateHUD();
};

// escopeta 9 perdigones en abanico, alcanza a varios zombies 1 s entre disparos
function dispararEscopeta() {
  if (game.escopetaCD > 0) { showAlert('BOMBEANDO LA ESCOPETA...'); return; }
  if (game.cartuchos <= 0) { Sonido.sfx('vacio'); showAlert('SIN CARTUCHOS — CÓMPRALOS EN LA TIENDA'); return; }
  game.cartuchos--;
  game.escopetaCD = 1.0;
  efectoDisparo(1);
  Sonido.sfx('escopeta');
  if (window.emitirDisparoVisual) window.emitirDisparoVisual('e');
  const danoPor = new Map(), cabezaPor = new Set();
  raycaster.far = 22;
  const objetivos = enemies.map(e => e.mesh).concat(mallasSolidas, PVP() ? Object.values(jugadoresRemotos).map(j => j.mesh) : []);
  const danoJugador = new Map();
  for (let k = 0; k < 9; k++) {
    raycaster.setFromCamera(new THREE.Vector2((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.14), camera);
    const hits = raycaster.intersectObjects(objetivos, true);
    if (!hits.length) continue;
    const hit = hits[0];
    const idJ = PVP() ? jugadorDe(hit.object) : null;
    if (idJ) danoJugador.set(idJ, (danoJugador.get(idJ) || 0) + 6);
    const enemy = idJ ? null : enemies.find(e => { let o = hit.object; while (o) { if (o === e.mesh) return true; o = o.parent; } return false; });
    if (enemy) {
      const d = 30 * (hit.object.userData.cabeza ? 2 : 1) * (hit.distance < 8 ? 1 : 0.6);
      danoPor.set(enemy, (danoPor.get(enemy) || 0) + d);
      if (hit.object.userData.cabeza) cabezaPor.add(enemy);
    }
    const chispa = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), new THREE.MeshBasicMaterial({ color:0xffaa44 }));
    chispa.position.copy(hit.point); scene.add(chispa);
    setTimeout(() => scene.remove(chispa), 140);
  }
  raycaster.far = Infinity;
  // varios zombies de un disparo mas puntos segun cuantos
  if (danoPor.size > 1) ganarPuntos(30 * danoPor.size, 'MULTI-IMPACTO x' + danoPor.size);
  if (cabezaPor.size) ganarPuntos(10 * cabezaPor.size, 'DISPARO A LA CABEZA' + (cabezaPor.size > 1 ? ' x' + cabezaPor.size : ''));
  danoPor.forEach((d, e) => damageEnemy(e, d, cabezaPor.has(e)));
  danoJugador.forEach((d, id) => golpearJugador(id, d));
  if (danoJugador.size) showAlert('LE DISTE A ' + [...danoJugador.keys()].map(id => jugadoresRemotos[id] ? jugadoresRemotos[id].username : '?').join(', '));
  updateHUD();
}

function shoot() {
  if (game.arma === 'escopeta') { dispararEscopeta(); return; }
  if (game.reloading) { showAlert('RECARGANDO... ESPERA'); return; }
  if (game.ammo <= 0) { Sonido.sfx('vacio'); showAlert('SIN BALAS — PRESIONA R PARA RECARGAR'); return; }
  game.ammo--; updateHUD();
  efectoDisparo(0.5);
  Sonido.sfx('pistola');
  if (window.emitirDisparoVisual) window.emitirDisparoVisual('p');
  raycaster.setFromCamera(new THREE.Vector2(0,0), camera);
  // las paredes y autos detienen las balas
  const remotos = PVP() ? Object.values(jugadoresRemotos).map(j => j.mesh) : [];
  const hits = raycaster.intersectObjects(enemies.map(e=>e.mesh).concat(mallasSolidas, remotos), true);
  if (hits.length) {
    const hit   = hits[0];
    const idJugador = PVP() ? jugadorDe(hit.object) : null;
    if (idJugador) { golpearJugador(idJugador, 12); showAlert('LE DISTE A ' + (jugadoresRemotos[idJugador].username || 'OTRO JUGADOR')); }
    const enemy = idJugador ? null : enemies.find(e => {
      let obj = hit.object;
      while (obj) { if (obj === e.mesh) return true; obj = obj.parent; }
      return false;
    });
    if (enemy) {
      // disparo a la cabeza doble daño y mas puntos
      const esCabeza = !!hit.object.userData.cabeza;
      if (esCabeza) ganarPuntos(10, 'DISPARO A LA CABEZA');
      damageEnemy(enemy, 34 * (esCabeza ? 2 : 1), esCabeza);
    }
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.05,4,4), new THREE.MeshBasicMaterial({color:0xff4444}));
    spark.position.copy(hit.point); scene.add(spark);
    setTimeout(() => scene.remove(spark), 150);
  }
  if (game.ammo === 0) showAlert('SIN BALAS — PRESIONA R PARA RECARGAR');
}
