'use strict';
// texturas y muebles del hospital, camas, camillas, sillas, mostrador, estantes y letreros

const matH = {};      // materiales del hospital, se llenan al construirlo

function texturasHospital(rnd) {
  // piso de mosaico blanco sucio
  const piso = texCanvas(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#8f9290'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const v = 135 + Math.floor(rnd() * 25);
      ctx.fillStyle = `rgb(${v},${v + 3},${v})`; ctx.fillRect(x * 64 + 1, y * 64 + 1, 62, 62);
    }
    ruido(ctx, w, h, 5000, ['rgba(0,0,0,0.08)', 'rgba(60,50,30,0.1)'], 3, rnd);
    for (let i = 0; i < 10; i++) {
      const g = ctx.createRadialGradient(rnd() * w, rnd() * h, 2, rnd() * w, rnd() * h, 40 + rnd() * 70);
      g.addColorStop(0, 'rgba(40,30,20,0.35)'); g.addColorStop(1, 'rgba(40,30,20,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  });
  // pared verde abajo, blanca arriba con una franja
  const pared = texCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#b9bdb5'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#5f7f6c'; ctx.fillRect(0, h * 0.62, w, h * 0.38);
    ctx.fillStyle = '#3c4a42'; ctx.fillRect(0, h * 0.6, w, 8);
    ruido(ctx, w, h, 2500, ['rgba(0,0,0,0.1)', 'rgba(70,60,40,0.12)'], 3, rnd);
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = 'rgba(30,25,15,0.25)';
      ctx.fillRect(rnd() * w, rnd() * h * 0.5, 2 + rnd() * 4, 40 + rnd() * 90);
    }
  });
  // techo de placas, algunas faltan
  const techo = texCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#6d6e6a'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const falta = rnd() < 0.12;
      ctx.fillStyle = falta ? '#0b0b0b' : '#a9a99f'; ctx.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
    }
    ruido(ctx, w, h, 1500, ['rgba(0,0,0,0.12)'], 2, rnd);
  });
  // charcos de sangre para el piso
  const sangre = texCanvas(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = `rgba(${70 + rnd() * 40},0,0,${0.5 + rnd() * 0.4})`;
      ctx.beginPath(); ctx.ellipse(w / 2 + (rnd() - 0.5) * 120, h / 2 + (rnd() - 0.5) * 120, 10 + rnd() * 50, 8 + rnd() * 30, rnd() * 3, 0, Math.PI * 2); ctx.fill();
    }
  }, false);
  return { piso, pared, techo, sangre };
}

// caja con material, sombra y opcion de chocar
function bloque(w, h, d, mat, x, y, z, chocar, padre) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (SHADOWS) { m.castShadow = true; m.receiveShadow = true; }
  (padre || scene).add(m);
  if (chocar) agregarSolido(m, 0.05);
  return m;
}

// grupo girado, los muebles se arman en su lugar y luego se acomodan
function grupoEn(x, z, giro) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = giro || 0; scene.add(g);
  return g;
}

function cama(x, z, giro) {
  const g = grupoEn(x, z, giro);
  bloque(1.0, 0.12, 2.1, matH.metal, 0, 0.55, 0, false, g);
  bloque(0.95, 0.18, 2.0, matH.colchon, 0, 0.7, 0, false, g);
  bloque(0.6, 0.1, 0.35, matH.colchon, 0, 0.84, -0.78, false, g);
  bloque(1.0, 0.7, 0.06, matH.metal, 0, 0.75, -1.05, false, g);
  [[-0.45, -0.95], [0.45, -0.95], [-0.45, 0.95], [0.45, 0.95]].forEach(([a, b]) => bloque(0.05, 0.5, 0.05, matH.metal, a, 0.25, b, false, g));
  agregarSolido(g, 0.05);
  // suero junto a la cama
  bloque(0.04, 1.8, 0.04, matH.metal, 0.75, 0.9, -0.8, false, g);
  bloque(0.18, 0.26, 0.06, matH.suero, 0.75, 1.65, -0.8, false, g);
  return g;
}

function camilla(x, z, giro, sabana) {
  const g = grupoEn(x, z, giro);
  bloque(0.75, 0.08, 1.9, matH.metal, 0, 0.85, 0, false, g);
  bloque(0.72, 0.1, 1.85, sabana ? matH.sabana : matH.colchon, 0, 0.94, 0, false, g);
  if (sabana) bloque(0.45, 0.25, 1.5, matH.sabana, 0, 1.05, 0.1, false, g);   // alguien tapado
  [[-0.32, -0.85], [0.32, -0.85], [-0.32, 0.85], [0.32, 0.85]].forEach(([a, b]) => bloque(0.04, 0.8, 0.04, matH.metal, a, 0.42, b, false, g));
  agregarSolido(g, 0.05);
  return g;
}

function silla(x, z, giro, chocar = true) {
  const g = grupoEn(x, z, giro);
  bloque(0.5, 0.06, 0.5, matH.plastico, 0, 0.45, 0, false, g);
  bloque(0.5, 0.5, 0.06, matH.plastico, 0, 0.72, -0.24, false, g);
  [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]].forEach(([a, b]) => bloque(0.04, 0.45, 0.04, matH.metal, a, 0.22, b, false, g));
  if (chocar) agregarSolido(g, 0.02);
  return g;
}

function filaSillas(x, z, n, giro) {
  for (let k = 0; k < n; k++) {
    const off = (k - (n - 1) / 2) * 0.6;
    silla(x + Math.cos(giro || 0) * off, z - Math.sin(giro || 0) * off, giro, false);
  }
  const largo = n * 0.6;
  const caja = new THREE.Mesh(new THREE.BoxGeometry(giro ? 0.6 : largo, 1, giro ? largo : 0.6));
  caja.position.set(x, 0.5, z); caja.visible = false; scene.add(caja);
  agregarSolido(caja, 0.02, false);
}

function estante(x, z, giro, largo) {
  const g = grupoEn(x, z, giro);
  bloque(largo, 2.0, 0.45, matH.metalOscuro, 0, 1.0, 0, false, g);
  for (let k = 0; k < 4; k++) {
    for (let c = 0; c < Math.floor(largo / 0.35); c++) {
      if (Math.random() < 0.35) continue;
      const mat = Math.random() < 0.5 ? matH.cajaMed : matH.suero;
      bloque(0.22, 0.2, 0.25, mat, -largo / 2 + 0.2 + c * 0.35, 0.3 + k * 0.48, 0.12, false, g);
    }
  }
  agregarSolido(g, 0.03);
  return g;
}

function carrito(x, z, giro) {
  const g = grupoEn(x, z, giro);
  bloque(0.6, 0.06, 0.45, matH.metal, 0, 0.9, 0, false, g);
  bloque(0.6, 0.06, 0.45, matH.metal, 0, 0.4, 0, false, g);
  bloque(0.5, 0.4, 0.35, matH.cajaMed, 0, 0.65, 0, false, g);
  agregarSolido(g, 0.03);
  return g;
}

function sillaRuedas(x, z, giro) {
  const g = grupoEn(x, z, giro);
  const rueda = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 6, 16), matH.metalOscuro);
  [-0.3, 0.3].forEach(a => { const r = rueda.clone(); r.position.set(a, 0.3, 0); r.rotation.y = Math.PI / 2; g.add(r); });
  bloque(0.5, 0.06, 0.45, matH.plastico, 0, 0.48, 0, false, g);
  bloque(0.5, 0.45, 0.05, matH.plastico, 0, 0.75, -0.22, false, g);
  agregarSolido(g, 0.02);
  return g;
}

// letrero con texto, como habitacion 101 o quirofano
function letrero(texto, x, y, z, giro, verde) {
  const tex = texCanvas(256, 64, (ctx, w, h) => {
    ctx.fillStyle = verde ? '#0a3' : '#ddd'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = verde ? '#dfffe0' : '#123'; ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(texto, w / 2, h / 2 + 2);
  }, false);
  const mat = new THREE.MeshStandardMaterial({ map:tex, roughness:0.6 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(verde ? 0.7 : 1.0, verde ? 0.18 : 0.25), mat);
  m.position.set(x, y, z); m.rotation.y = giro || 0;
  scene.add(m);
  return m;
}

// mancha de sangre en el piso
function charco(x, z, tam) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(tam, tam), matH.sangre);
  m.rotation.x = -Math.PI / 2; m.rotation.z = Math.random() * 6;
  m.position.set(x, 0.015, z); scene.add(m);
}

// placa del techo que se cayo al piso
function placaCaida(x, z) {
  const m = bloque(0.6, 0.03, 0.6, matH.techo, x, 0.02, z, false);
  m.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * 3, (Math.random() - 0.5) * 0.3);
}
