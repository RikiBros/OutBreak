'use strict';
// mapa 2, un piso de hospital totalmente a oscuras
// pasillo que da la vuelta a todo el piso, habitaciones en las orillas
// y en el centro recepcion, quirofano, farmacia y morgue, separados por un pasillo en cruz

const ALTO_H = 3.2, GROSOR_H = 0.3, PUERTA_H = 1.8;

// pared recta con huecos para las puertas, puertas son las posiciones a lo largo de la pared
function muro(x1, z1, x2, z2, puertas = []) {
  const horizontal = z1 === z2;
  const a = Math.min(horizontal ? x1 : z1, horizontal ? x2 : z2);
  const b = Math.max(horizontal ? x1 : z1, horizontal ? x2 : z2);
  const fijo = horizontal ? z1 : x1;
  const cortes = [a];
  puertas.slice().sort((p, q) => p - q).forEach(p => cortes.push(p - PUERTA_H / 2, p + PUERTA_H / 2));
  cortes.push(b);
  const pieza = (u1, u2, y, alto, chocar) => {
    const largo = u2 - u1;
    if (largo < 0.05) return;
    const geo = cajaUV(horizontal ? largo : GROSOR_H, alto, horizontal ? GROSOR_H : largo, 3, ALTO_H);
    const m = new THREE.Mesh(geo, matH.pared);
    const c = (u1 + u2) / 2;
    m.position.set(horizontal ? c : fijo, y, horizontal ? fijo : c);
    if (SHADOWS) { m.castShadow = true; m.receiveShadow = true; }
    scene.add(m);
    if (chocar) agregarSolido(m);
  };
  for (let k = 0; k < cortes.length; k += 2) pieza(cortes[k], cortes[k + 1], ALTO_H / 2, ALTO_H, true);
  // el pedazo de pared arriba de cada puerta
  for (let k = 1; k < cortes.length - 1; k += 2) pieza(cortes[k], cortes[k + 1], 2.3 + (ALTO_H - 2.3) / 2, ALTO_H - 2.3, false);
}

// cuarto de pacientes, dos camas contra la pared de afuera y una cortina en medio
function habitacion(cx, cz, haciaAfuera, numero) {
  const lado = Math.sign(haciaAfuera);
  const xCama = cx + lado * 2.6;
  cama(xCama, cz - 2.3, lado > 0 ? -Math.PI / 2 : Math.PI / 2);
  if (Math.random() < 0.75) cama(xCama, cz + 2.3, lado > 0 ? -Math.PI / 2 : Math.PI / 2);
  const cortina = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.2), matH.cortina);
  cortina.position.set(xCama, 1.3, cz); scene.add(cortina);
  silla(cx - lado * 1.5, cz + 3.4, Math.random() * 6);
  if (Math.random() < 0.5) charco(cx + (Math.random() - 0.5) * 3, cz + (Math.random() - 0.5) * 4, 1.5 + Math.random() * 1.5);
  const xPuerta = cx - lado * 4.7;
  letrero('HABITACIÓN ' + numero, xPuerta, 2.55, cz + 1.6, lado > 0 ? -Math.PI / 2 : Math.PI / 2);
}

function construirHospital() {
  const rnd = rngSemilla(31);
  LIMITE = 29.5;
  renderer.toneMappingExposure = 1.4;
  scene.background = new THREE.Color(0x000000);
  INICIO_JUGADOR = new THREE.Vector3(0, 1.7, 18.5);
  // los zombies salen de los elevadores al final de los pasillos y de algunos cuartos
  SPAWNS = [[18.5, 28.5], [-18.5, 28.5], [18.5, -28.5], [-18.5, -28.5],
            [25.5, -25], [25.5, 25], [-25.5, -5], [-25.5, 15], [-12, -25.5], [12, 25.5], [12, -25.5], [-12, 25.5]];

  const tex = texturasHospital(rnd);
  const std = o => new THREE.MeshStandardMaterial(Object.assign({ roughness:0.85 }, o));
  tex.piso.repeat.set(15, 15);
  matH.pared = std({ map:tex.pared });
  matH.techo = std({ map:tex.techo, side:THREE.DoubleSide });
  matH.metal = std({ color:0x9aa0a4, metalness:0.6, roughness:0.4 });
  matH.metalOscuro = std({ color:0x3a3e42, metalness:0.5, roughness:0.5 });
  matH.colchon = std({ color:0x6f8a9a });
  matH.sabana = std({ color:0xd8d6cc });
  matH.plastico = std({ color:0x2f4f6a });
  matH.suero = std({ color:0xbfe6ff, transparent:true, opacity:0.7 });
  matH.cajaMed = std({ color:0xe8e2d0 });
  matH.madera = std({ color:0x5a4030 });
  matH.cortina = std({ color:0x7fa9a0, side:THREE.DoubleSide, transparent:true, opacity:0.85 });
  matH.sangre = new THREE.MeshStandardMaterial({ map:tex.sangre, transparent:true, depthWrite:false, roughness:0.3 });

  // piso y techo
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), std({ map:tex.piso, roughness:0.5 }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);
  tex.techo.repeat.set(15, 15);
  const techo = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), matH.techo);
  techo.rotation.x = Math.PI / 2; techo.position.y = ALTO_H; scene.add(techo);

  // paredes de afuera
  muro(-30, -30, 30, -30); muro(-30, 30, 30, 30); muro(-30, -30, -30, 30); muro(30, -30, 30, 30);
  // habitaciones del este y del oeste, 6 por lado
  const centrosZ = [-25, -15, -5, 5, 15, 25];
  muro(21, -30, 21, 30, centrosZ); muro(-21, -30, -21, 30, centrosZ);
  [-20, -10, 0, 10, 20].forEach(z => { muro(21, z, 30, z); muro(-30, z, -21, z); });
  centrosZ.forEach((z, k) => { habitacion(25.5, z, 1, 101 + k); habitacion(-25.5, z, -1, 201 + k); });
  // cuartos del norte y del sur, 4 por lado
  const centrosX = [-12, -4, 4, 12];
  muro(-16, -21, 16, -21, centrosX); muro(-16, 21, 16, 21, centrosX);
  [-8, 0, 8].forEach(x => { muro(x, -30, x, -21); muro(x, 21, x, 30); });
  [-16, 16].forEach(x => { muro(x, -30, x, -21); muro(x, 21, x, 30); });
  cuartosNorteSur();
  // el centro, rodeado por el pasillo, con un pasillo en cruz por dentro
  muro(-16, -16, 16, -16, [-9, 0, 9]); muro(-16, 16, 16, 16, [-9, 0, 9]);
  muro(-16, -16, -16, 16, [0]); muro(16, -16, 16, 16, [0]);
  muro(-2, -16, -2, -2, [-9]); muro(2, -16, 2, -2, [-9]); muro(-2, 2, -2, 16, [9]); muro(2, 2, 2, 16, [9]);
  muro(-16, -2, -2, -2, [-9]); muro(2, -2, 16, -2, [9]); muro(-16, 2, -2, 2, [-9]); muro(2, 2, 16, 2, [9]);
  cuartosCentro();
  pasillos(rnd);
  lucesHospital();
}

function cuartosNorteSur() {
  // norte, consultorio, laboratorio, bodega y baños
  letrero('CONSULTORIO', -12, 2.55, -20.8, 0); letrero('LABORATORIO', -4, 2.55, -20.8, 0);
  letrero('BODEGA', 4, 2.55, -20.8, 0); letrero('BAÑOS', 12, 2.55, -20.8, 0);
  bloque(1.6, 0.8, 0.8, matH.madera, -12, 0.4, -27, true); silla(-12, -25.8, Math.PI);
  bloque(3.2, 0.9, 0.7, matH.metal, -4, 0.45, -28.9, true); carrito(-2.5, -24.5, 0.4);
  estante(4, -29.4, 0, 3.5); estante(6.2, -26, Math.PI / 2, 2.5);
  for (let k = 0; k < 3; k++) bloque(1.2, 2.0, 0.08, matH.metalOscuro, 9.5 + k * 1.3, 1.0, -26.5, false);
  // sur, archivo, cuarto de maquinas, consultorio y lavanderia
  letrero('ARCHIVO', -12, 2.55, 20.8, Math.PI); letrero('MÁQUINAS', -4, 2.55, 20.8, Math.PI);
  letrero('CONSULTORIO 2', 4, 2.55, 20.8, Math.PI); letrero('LAVANDERÍA', 12, 2.55, 20.8, Math.PI);
  estante(-12, 29.4, 0, 6); estante(-12, 26, 0, 6);
  bloque(2.4, 1.8, 1.2, matH.metalOscuro, -4, 0.9, 28.3, true);
  bloque(1.6, 0.8, 0.8, matH.madera, 4, 0.4, 27, true); silla(4, 25.8, 0);
  [10, 12, 14].forEach(x => bloque(1.0, 1.0, 0.9, matH.metal, x, 0.5, 29, true));
}

function cuartosCentro() {
  // recepcion con mostrador y sillas
  letrero('RECEPCIÓN', -9, 2.55, -15.8, Math.PI);
  bloque(5, 1.1, 0.8, matH.madera, -9, 0.55, -10, true);
  bloque(0.8, 1.1, 2.6, matH.madera, -11.1, 0.55, -8.3, true);
  filaSillas(-9, -5.5, 6, 0); filaSillas(-13.5, -13.5, 4, 0);
  bloque(0.9, 1.9, 0.8, matH.metalOscuro, -15.2, 0.95, -3.2, true);
  // quirofano con mesa, lampara y carritos
  letrero('QUIRÓFANO', 9, 2.55, -15.8, Math.PI);
  bloque(0.9, 0.9, 2.1, matH.metal, 9, 0.45, -9, true);
  bloque(0.8, 0.12, 2.0, matH.sabana, 9, 0.95, -9, false);
  const lampara = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.4, 0.2, 16), new THREE.MeshBasicMaterial({ color:0x223038 }));
  lampara.position.set(9, 2.6, -9); scene.add(lampara);
  carrito(7, -11.5, 0.3); carrito(11.4, -7, -0.5); camilla(13.5, -13, Math.PI / 2, false);
  charco(9.5, -8, 2.5);
  // farmacia con estantes
  letrero('FARMACIA', -9, 2.55, 15.8, 0);
  [-13.5, -10, -6.5].forEach(x => estante(x, 9, Math.PI / 2, 8));
  bloque(2, 1.1, 0.7, matH.madera, -4, 0.55, 4.5, true);
  // morgue con cajones y camillas tapadas
  letrero('MORGUE', 9, 2.55, 15.8, 0);
  bloque(0.8, 2.2, 10, matH.metal, 15.4, 1.1, 9, true);
  camilla(9, 6, 0, true); camilla(6.5, 10.5, 0.2, true); camilla(11.5, 12, -0.3, true);
  charco(8, 8, 2); charco(12, 5, 1.2);
}

function pasillos(rnd) {
  // camillas y sillas de ruedas abandonadas pegadas a las paredes
  [[19.8, -8, 0], [-19.8, 6, 0], [19.8, 12, 0.1], [-19.8, -18, -0.1]].forEach(([x, z, g]) => camilla(x, z, g, rnd() < 0.4));
  [[-6, 19.9, Math.PI / 2], [10, -19.8, Math.PI / 2]].forEach(([x, z, g]) => camilla(x, z, g, false));
  [[17.2, 3, 1], [-17.3, -10, 2], [6, 17.2, 0.5], [-12, -17.3, 3]].forEach(([x, z, g]) => sillaRuedas(x, z, g));
  for (let k = 0; k < 18; k++) {
    const lado = Math.floor(rnd() * 4), t = (rnd() * 2 - 1) * 26;
    const p = [[18.5, t], [-18.5, t], [t * 0.6, 18.5], [t * 0.6, -18.5]][lado];
    if (rnd() < 0.5) placaCaida(p[0] + (rnd() - 0.5) * 3, p[1] + (rnd() - 0.5) * 3);
    else charco(p[0] + (rnd() - 0.5) * 3, p[1] + (rnd() - 0.5) * 3, 0.8 + rnd() * 2);
  }
  // elevadores al final de los pasillos, de ahi salen zombies
  [[18.5, 29.84, Math.PI], [-18.5, 29.84, Math.PI], [18.5, -29.84, 0], [-18.5, -29.84, 0]].forEach(([x, z, g]) => {
    const puerta = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.4), matH.metal);
    puerta.position.set(x, 1.2, z); puerta.rotation.y = g; scene.add(puerta);
    letrero('ELEVADOR', x, 2.7, z + (g ? -0.01 : 0.01), g);
  });
  // letreros verdes de salida, solo se ven si los alumbras
  [[0, 16.16, 0], [0, -16.16, Math.PI], [16.16, 0, Math.PI / 2], [-16.16, 0, -Math.PI / 2]]
    .forEach(([x, z, g]) => letrero('SALIDA', x, 2.85, z, g, true));
}

// luces, todo esta apagado, sin linterna no se ve nada, solo una lampara del pasillo que parpadea muy de vez en cuando
let lamparaParpadeo = null;
function lucesHospital() {
  accent1.position.set(18.5, 2.9, -18.5);
  accent2.position.set(-18.5, 2.9, 18.5);
  lamparaParpadeo = new THREE.PointLight(0xdfefff, 0, 9);
  lamparaParpadeo.position.set(0, 3.0, -18.5);
  scene.add(lamparaParpadeo);
  const tubo = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.2), new THREE.MeshBasicMaterial({ color:0x333a40 }));
  tubo.position.set(0, 3.17, -18.5); scene.add(tubo);
  lamparaParpadeo.userData.tubo = tubo;
}

// la lampara del pasillo norte se prende y apaga sola
let parpadeoT = 0;
function actualizarHospital(dt) {
  if (!lamparaParpadeo) return;
  parpadeoT -= dt;
  if (parpadeoT > 0) return;
  const prendida = Math.random() < 0.12;
  parpadeoT = prendida ? 0.04 + Math.random() * 0.08 : 2 + Math.random() * 6;
  lamparaParpadeo.intensity = prendida ? 1.6 : 0;
  lamparaParpadeo.userData.tubo.material.color.setHex(prendida ? 0xdfefff : 0x333a40);
}
