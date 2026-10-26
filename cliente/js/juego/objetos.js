'use strict';
// los objetos tirados en el mapa y las granadas paralizantes

// objetos en el mapa lo que compras en la tienda
const PICKUPS = {
  escudo:     { slot:0, color:0x3399ff, nombre:'ESCUDO' },
  granada:    { slot:1, color:0x33e6ff, nombre:'GRANADA PARALIZANTE' },
  estamina:   { slot:2, color:0xc8f040, nombre:'BEBIDA DE ESTAMINA' },
  botiquin:   { slot:3, color:0xff3344, nombre:'BOTIQUÍN' },
  cargador:   { mejora:true, color:0xff9a2a, nombre:'MÁS CAPACIDAD DE BALAS' },
  automatico: { mejora:true, color:0xb06bff, nombre:'DISPARO AUTOMÁTICO' },
  escopeta:   { mejora:true, color:0xff5a3c, nombre:'ESCOPETA' },
  cartuchos:  { color:0xff3355, nombre:'CARTUCHOS' },
};
const pickups = [];

function modeloPickup(tipo) {
  const g = new THREE.Group();
  const def = PICKUPS[tipo];
  const brilla = c => new THREE.MeshStandardMaterial({ color:c, emissive:c, emissiveIntensity:0.45, roughness:0.4 });
  if (tipo === 'escudo') {
    const e = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.07, 6), brilla(0x2266dd));
    e.rotation.x = Math.PI / 2; g.add(e);
    const e2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.09, 6), brilla(0x88ccff));
    e2.rotation.x = Math.PI / 2; g.add(e2);
  } else if (tipo === 'granada') {
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), brilla(0x1a6a7a)));
    const anillo = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 6, 16), brilla(0x66f0ff));
    anillo.rotation.x = Math.PI / 2; g.add(anillo);
    const tapa = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8), brilla(0x888888));
    tapa.position.y = 0.2; g.add(tapa);
  } else if (tipo === 'botiquin') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.32), brilla(0xeeeeee)));
    const rojo = new THREE.MeshBasicMaterial({ color:0xff2222 });
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.08), rojo); c1.position.y = 0.16; g.add(c1);
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.24), rojo); c2.position.y = 0.16; g.add(c2);
  } else if (tipo === 'estamina') {
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.34, 14), brilla(0x7a9a1c)));
    const banda = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.1, 14), brilla(0xeeeeee));
    g.add(banda);
  } else if (tipo === 'cargador') {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.32), brilla(0x4a4a22)));
    const franja = new THREE.Mesh(new THREE.BoxGeometry(0.51, 0.06, 0.33), brilla(0xffaa22)); g.add(franja);
  } else if (tipo === 'escopeta') {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 8), brilla(0x555555));
    c.rotation.z = Math.PI / 2; g.add(c);
    const cu = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.08), brilla(0x7a3a18)); cu.position.set(0.5, -0.04, 0); g.add(cu);
  } else if (tipo === 'cartuchos') {
    for (let k = -1; k <= 1; k++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10), brilla(0xcc1133)); c.position.x = k * 0.12; g.add(c);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.06, 10), brilla(0xddaa33)); t.position.set(k * 0.12, -0.1, 0); g.add(t);
    }
  } else {
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.32, 0.36), brilla(0x3a2266)));
    const canon = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), brilla(0xc49bff));
    canon.rotation.z = Math.PI / 2; canon.position.y = 0.22; g.add(canon);
  }
  // haz de luz vertical y aro en el piso para encontrarlo
  const raro = new THREE.MeshBasicMaterial({ color:def.color, transparent:true, opacity:0.3, depthWrite:false });
  const haz = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 10, 6, 1, true), raro);
  haz.position.y = 5;
  const aro = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.62, 24),
    new THREE.MeshBasicMaterial({ color:def.color, transparent:true, opacity:0.6, side:THREE.DoubleSide }));
  aro.rotation.x = -Math.PI / 2; aro.position.y = 0.02;
  const raiz = new THREE.Group();
  raiz.add(g, haz, aro);
  return { raiz, modelo:g };
}

function soltarPickup(tipo) {
  let x = 0, z = 0;
  for (let intento = 0; intento < 60; intento++) {
    x = (Math.random() * 2 - 1) * 34; z = (Math.random() * 2 - 1) * 34;
    const d = Math.hypot(x - camera.position.x, z - camera.position.z);
    if (d > 8 && d < 30 && !puntoBloqueado(x, z, 1)) break;
  }
  const m = modeloPickup(tipo);
  m.raiz.position.set(x, 0, z);
  scene.add(m.raiz);
  pickups.push({ tipo, raiz:m.raiz, modelo:m.modelo, t:Math.random() * 6 });
}

function actualizarPickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.t += dt;
    p.modelo.rotation.y += dt * 2;
    p.modelo.position.y = 0.6 + Math.sin(p.t * 3) * 0.1;
    const d = Math.hypot(p.raiz.position.x - camera.position.x, p.raiz.position.z - camera.position.z);
    if (d < 1.6) {
      recogerPickup(p.tipo);
      scene.remove(p.raiz);
      pickups.splice(i, 1);
      updateHUD();
    }
  }
}

function recogerPickup(tipo) {
  const def = PICKUPS[tipo];
  if (tipo === 'cargador') {
    game.mejoras.cargador++;
    aplicarMejoras();
    game.ammo = Math.min(game.maxAmmo, game.ammo + 10);
    showAlert('MEJORA: CARGADOR DE ' + game.maxAmmo + ' BALAS');
  } else if (tipo === 'automatico') {
    game.mejoras.auto = 1;
    showAlert('MEJORA: DISPARO AUTOMÁTICO — MANTÉN CLIC IZQUIERDO');
  } else if (tipo === 'escopeta') {
    game.mejoras.escopeta = 1;
    game.cartuchos += 6;
    cambiarArma('escopeta');
    showAlert('ESCOPETA EQUIPADA — Q PARA CAMBIAR DE ARMA');
  } else if (tipo === 'cartuchos') {
    game.cartuchos += 8;
    showAlert('+8 CARTUCHOS DE ESCOPETA');
    updateHUD();
  } else {
    game.items[def.slot]++;
    showAlert('RECOGISTE: ' + def.nombre);
  }
}

// granadas mas explosion con particulas three points
const granadas   = [];
const explosiones = [];
const luzExplosion = new THREE.PointLight(0x66ddff, 0, 18);
scene.add(luzExplosion);

function lanzarGranada() {
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8),
    new THREE.MeshStandardMaterial({ color:0x1a6a7a, emissive:0x0a3a44 }));
  mesh.position.copy(camera.position).addScaledVector(dir, 0.6);
  scene.add(mesh);
  granadas.push({ mesh, vel: dir.multiplyScalar(15).add(new THREE.Vector3(0, 4, 0)), mecha: 1.6 });
  showAlert('¡GRANADA PARALIZANTE!');
}

function tintarZombie(e, hex) {
  e.mesh.traverse(n => { if (n.isMesh && n.material && n.material.emissive) n.material.emissive.setHex(hex); });
}

function explotar(pos) {
  // no hace daño paraliza 5 s a los zombies cercanos
  const ids = [];
  enemies.forEach(e => {
    const d = Math.hypot(e.mesh.position.x - pos.x, e.mesh.position.z - pos.z);
    if (d < 7) { paralizar(e); ids.push(e.id); }
  });
  const paralizados = ids.length;
  if (paralizados && !esAutoridad() && window.emitirAHost) window.emitirAHost('paralizar', { ids });
  // mas zombies paralizados de una vez mas puntos
  if (paralizados) ganarPuntos(25 * paralizados, paralizados > 1 ? 'PARALIZADOS x' + paralizados : 'ZOMBIE PARALIZADO');
  // destello
  luzExplosion.position.copy(pos).setY(1.5);
  luzExplosion.intensity = 9;
  // particulas
  const N = 140;
  const pos3 = new Float32Array(N * 3), vels = [];
  for (let i = 0; i < N; i++) {
    pos3[i*3] = pos.x; pos3[i*3+1] = pos.y + 0.2; pos3[i*3+2] = pos.z;
    const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 1.4, Math.random() * 2 - 1).normalize();
    vels.push(v.multiplyScalar(4 + Math.random() * 7));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos3, 3));
  const mat = new THREE.PointsMaterial({ color:0x88f4ff, size:0.28, transparent:true, opacity:1, depthWrite:false, blending:THREE.AdditiveBlending });
  const puntos = new THREE.Points(geo, mat);
  scene.add(puntos);
  // onda expansiva
  const onda = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshBasicMaterial({ color:0x44ddff, transparent:true, opacity:0.5, depthWrite:false }));
  onda.position.copy(pos); scene.add(onda);
  explosiones.push({ puntos, vels, onda, vida: 0.9 });
}

function actualizarGranadas(dt) {
  for (let i = granadas.length - 1; i >= 0; i--) {
    const g = granadas[i];
    g.vel.y -= 22 * dt;
    const prevX = g.mesh.position.x, prevZ = g.mesh.position.z;
    g.mesh.position.addScaledVector(g.vel, dt);
    if (g.mesh.position.y < 6 && puntoBloqueado(g.mesh.position.x, g.mesh.position.z, 0.12)) {   // rebota en paredes
      if (puntoBloqueado(g.mesh.position.x, prevZ, 0.12)) g.vel.x *= -0.4;
      if (puntoBloqueado(prevX, g.mesh.position.z, 0.12)) g.vel.z *= -0.4;
      g.mesh.position.x = prevX; g.mesh.position.z = prevZ;
    }
    if (g.mesh.position.y < 0.12) {          // rebote en el piso
      g.mesh.position.y = 0.12;
      g.vel.y *= -0.35; g.vel.x *= 0.6; g.vel.z *= 0.6;
    }
    g.mecha -= dt;
    if (g.mecha <= 0) {
      explotar(g.mesh.position.clone());
      scene.remove(g.mesh);
      granadas.splice(i, 1);
    }
  }
  for (let i = explosiones.length - 1; i >= 0; i--) {
    const ex = explosiones[i];
    ex.vida -= dt;
    const arr = ex.puntos.geometry.attributes.position.array;
    ex.vels.forEach((v, k) => {
      v.y -= 9 * dt;
      arr[k*3] += v.x * dt; arr[k*3+1] = Math.max(0.05, arr[k*3+1] + v.y * dt); arr[k*3+2] += v.z * dt;
    });
    ex.puntos.geometry.attributes.position.needsUpdate = true;
    ex.puntos.material.opacity = Math.max(0, ex.vida / 0.9);
    ex.onda.scale.setScalar(1 + (0.9 - ex.vida) * 7);
    ex.onda.material.opacity = Math.max(0, ex.vida / 0.9 * 0.5);
    if (ex.vida <= 0) { scene.remove(ex.puntos); scene.remove(ex.onda); explosiones.splice(i, 1); }
  }
  if (luzExplosion.intensity > 0) luzExplosion.intensity = Math.max(0, luzExplosion.intensity - dt * 18);
}
