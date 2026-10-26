'use strict';
// mapa 3, el helipuerto redondo en la azotea de un edificio
// no hay donde cubrirse, solo la caseta de la escalera por donde sube la gente
// los zombies trepan por la orilla y la ciudad se ve muy abajo

const RADIO_HELI = 28;

// textura del piso con las marcas del helipuerto
function texturaHelipuerto(rnd) {
  return texCanvas(1024, 1024, (ctx, w, h) => {
    ctx.fillStyle = '#4a4744'; ctx.fillRect(0, 0, w, h);
    ruido(ctx, w, h, 22000, ['#524e4a', '#3f3c39', '#57534e', '#45423f'], 3, rnd);
    for (let i = 0; i < 18; i++) {
      const g = ctx.createRadialGradient(rnd() * w, rnd() * h, 4, rnd() * w, rnd() * h, 60 + rnd() * 120);
      g.addColorStop(0, 'rgba(20,18,16,0.35)'); g.addColorStop(1, 'rgba(20,18,16,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    // cuadro naranja
    ctx.strokeStyle = '#d2601e'; ctx.lineWidth = 14;
    ctx.strokeRect(w * 0.22, h * 0.22, w * 0.56, h * 0.56);
    // circulo amarillo con la h
    ctx.strokeStyle = '#e0b520'; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.12, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#e0b520';
    ctx.fillRect(w / 2 - 70, h / 2 - 60, 26, 120); ctx.fillRect(w / 2 + 44, h / 2 - 60, 26, 120); ctx.fillRect(w / 2 - 44, h / 2 - 13, 88, 26);
    // flechas y letreros pintados
    ctx.fillStyle = '#d2601e';
    ctx.fillRect(w * 0.72, h * 0.3, 10, h * 0.16);
    ctx.beginPath(); ctx.moveTo(w * 0.72 - 16, h * 0.3); ctx.lineTo(w * 0.72 + 26, h * 0.3); ctx.lineTo(w * 0.72 + 5, h * 0.26); ctx.fill();
    ctx.fillRect(w * 0.5, h * 0.74, w * 0.2, 10);
    ctx.beginPath(); ctx.moveTo(w * 0.7, h * 0.74 - 16); ctx.lineTo(w * 0.7, h * 0.74 + 26); ctx.lineTo(w * 0.74, h * 0.74 + 5); ctx.fill();
    ctx.font = 'bold 44px sans-serif'; ctx.save(); ctx.translate(w * 0.27, h * 0.32); ctx.rotate(Math.PI / 2); ctx.fillText('MAX 6t', 0, 0); ctx.restore();
    ctx.save(); ctx.translate(w * 0.27, h * 0.7); ctx.rotate(Math.PI / 2); ctx.fillText('009', 0, 0); ctx.restore();
    // la orilla mas oscura
    const borde = ctx.createRadialGradient(w / 2, h / 2, w * 0.4, w / 2, h / 2, w * 0.5);
    borde.addColorStop(0, 'rgba(0,0,0,0)'); borde.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = borde; ctx.fillRect(0, 0, w, h);
  }, false);
}

function construirHelipuerto() {
  const rnd = rngSemilla(9);
  LIMITE = RADIO_HELI;
  RADIO_MAPA = RADIO_HELI - 0.6;
  renderer.toneMappingExposure = 1.1;
  INICIO_JUGADOR = new THREE.Vector3(0, 1.7, RADIO_HELI - 7);
  // los zombies solo salen trepando por la orilla
  SPAWNS = [];
  for (let k = 0; k < 28; k++) {
    const a = k / 28 * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI / 2) < 0.25) continue;   // no junto a la escalera
    SPAWNS.push([Math.cos(a) * (RADIO_HELI - 2.2), Math.sin(a) * (RADIO_HELI - 2.2)]);
  }
  sunLight.position.set(-20, 50, 15);
  if (SHADOWS) { sunLight.shadow.camera.far = 140; sunLight.shadow.camera.updateProjectionMatrix(); }

  const std = o => new THREE.MeshStandardMaterial(Object.assign({ roughness:0.9 }, o));
  // la plataforma redonda
  const texPiso = texturaHelipuerto(rnd);
  // se gira media vuelta para que las letras se lean bien desde la escalera
  texPiso.center.set(0.5, 0.5); texPiso.rotation = Math.PI;
  const piso = std({ map:texPiso });
  const lado = std({ color:0x8c8f92, roughness:0.6, metalness:0.3 });
  const plataforma = new THREE.Mesh(new THREE.CylinderGeometry(RADIO_HELI, RADIO_HELI, 1.2, 96), [lado, piso, lado]);
  plataforma.position.y = -0.6; plataforma.receiveShadow = true; scene.add(plataforma);
  // el borde levantado de la plataforma
  const borde = new THREE.Mesh(new THREE.TorusGeometry(RADIO_HELI - 0.15, 0.22, 8, 120), std({ color:0xb7babd, metalness:0.4, roughness:0.5 }));
  borde.rotation.x = Math.PI / 2; borde.position.y = 0.2; scene.add(borde);
  // luces de la orilla, verdes y blancas
  const verde = new THREE.MeshBasicMaterial({ color:0x55ff88 }), blanca = new THREE.MeshBasicMaterial({ color:0xfff4d0 });
  for (let k = 0; k < 48; k++) {
    const a = k / 48 * Math.PI * 2;
    const foco = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), k % 4 === 0 ? blanca : verde);
    foco.position.set(Math.cos(a) * (RADIO_HELI - 0.5), 0.3, Math.sin(a) * (RADIO_HELI - 0.5));
    scene.add(foco);
  }
  accent1.position.set(-RADIO_HELI * 0.7, 1.5, -RADIO_HELI * 0.7);
  accent2.position.set(RADIO_HELI * 0.7, 1.5, -RADIO_HELI * 0.7);
  estructuraDebajo(std);
  casetaEscalera(std);
  ciudadAbajo(rnd);
}

// vigas de acero que sostienen la plataforma, se ven al asomarte por la orilla
function estructuraDebajo(std) {
  const acero = std({ color:0x6d7276, metalness:0.6, roughness:0.4 });
  const edificio = new THREE.Mesh(new THREE.BoxGeometry(46, 80, 46), std({ color:0x2b2d30 }));
  edificio.position.y = -42; scene.add(edificio);
  for (let k = 0; k < 16; k++) {
    const a = k / 16 * Math.PI * 2;
    const viga = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, RADIO_HELI - 20), acero);
    viga.position.set(Math.cos(a) * (RADIO_HELI + 20) / 2, -1.6, Math.sin(a) * (RADIO_HELI + 20) / 2);
    viga.rotation.y = -a + Math.PI / 2; scene.add(viga);
    const poste = new THREE.Mesh(new THREE.BoxGeometry(0.4, 4, 0.4), acero);
    poste.position.set(Math.cos(a) * (RADIO_HELI - 3), -3.2, Math.sin(a) * (RADIO_HELI - 3)); scene.add(poste);
  }
}

// la caseta de la escalera, por aqui subio la gente, es lo unico donde chocas
function casetaEscalera(std) {
  const z = RADIO_HELI - 2.2;
  const muro = std({ color:0x9a9c98 });
  const caseta = new THREE.Group();
  caseta.position.set(0, 0, z);
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.8, 2.6), muro);
  cuerpo.position.y = 1.4; caseta.add(cuerpo);
  const techo = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.2, 3.0), std({ color:0x55585b }));
  techo.position.y = 2.9; caseta.add(techo);
  const puerta = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.1), std({ color:0x3b4d5c, metalness:0.4 }));
  puerta.position.set(0, 1.05, -1.31); puerta.rotation.y = Math.PI; caseta.add(puerta);
  // puerta entreabierta, se ve oscuro adentro
  const hueco = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 2.1), new THREE.MeshBasicMaterial({ color:0x050505 }));
  hueco.position.set(0.5, 1.05, -1.32); hueco.rotation.y = Math.PI; caseta.add(hueco);
  if (SHADOWS) caseta.traverse(n => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } });
  scene.add(caseta);
  agregarSolido(cuerpo);
  letrero('ESCALERA', 0, 2.45, z - 1.32, Math.PI);
  const foco = new THREE.PointLight(0xffd9a0, 1.4, 9);
  foco.position.set(0, 2.6, z - 1.8); scene.add(foco);
  const bombilla = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color:0xffe2b0 }));
  bombilla.position.copy(foco.position); scene.add(bombilla);
  // mochilas y cajas que dejo la gente al subir
  [[1.6, -2.3], [-1.9, -2.0], [-1.2, -3.1]].forEach(([x, dz]) => {
    const caja = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), std({ color:0x5a4a32 }));
    caja.position.set(x, 0.18, z + dz); caja.rotation.y = Math.random() * 3; scene.add(caja);
  });
}

// edificios de la ciudad muy abajo con algunas ventanas prendidas
function ciudadAbajo(rnd) {
  const ventanas = texturaFachada(rnd, '#22252a', false);
  const mat = new THREE.MeshStandardMaterial({ map:ventanas.map, emissive:0xffffff, emissiveMap:ventanas.emissive, emissiveIntensity:0.6, roughness:0.9 });
  const N = 140;
  const caja = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2, r = 45 + rnd() * 120;
    const alto = 20 + rnd() * 50, ancho = 8 + rnd() * 14;
    p.set(Math.cos(a) * r, -95 + alto / 2, Math.sin(a) * r);
    s.set(ancho, alto, ancho);
    m.compose(p, q, s); caja.setMatrixAt(i, m);
  }
  scene.add(caja);
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color:0x0a0606 }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = -95; scene.add(suelo);
}
