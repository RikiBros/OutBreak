'use strict';
// escena, luces, colisiones, texturas y fuego

// escena three
const scene    = new THREE.Scene();
scene.fog      = new THREE.FogExp2(CFG.fogColor, CFG.fogDensity);
scene.background = new THREE.Color(CFG.bgColor);

const camera   = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 0);

const renderer = new THREE.WebGLRenderer({ canvas:document.getElementById('gameCanvas'), antialias:true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = SHADOWS;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.toneMapping       = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.2;   // mas exposicion mas brillo

// iluminacion con 3 fuentes para eliminar zonas negras
const ambientLight = new THREE.AmbientLight(CFG.ambient.color, CFG.ambient.intensity);
scene.add(ambientLight);

// luz principal sol luna segun el mapa
const sunLight = new THREE.DirectionalLight(CFG.sun.color, CFG.sun.intensity);
sunLight.position.set(10, 20, 10);
sunLight.castShadow = SHADOWS;
if (SHADOWS) {
  sunLight.shadow.mapSize.width = sunLight.shadow.mapSize.height = 2048;
  Object.assign(sunLight.shadow.camera, { near:0.5, far:100, left:-40, right:40, top:40, bottom:-40 });
}
scene.add(sunLight);

// luz de relleno desde el otro lado evita sombras totalmente negras
const fillLight = new THREE.DirectionalLight(CFG.fill.color, CFG.fill.intensity);
fillLight.position.set(-10, 10, -10);
scene.add(fillLight);

// luces de acento efectos especiales
const accent1 = new THREE.PointLight(CFG.accent1.color, CFG.accent1.intensity, CFG.accent1.dist);
accent1.position.set(-8, 4, -8); scene.add(accent1);
const accent2 = new THREE.PointLight(CFG.accent2.color, CFG.accent2.intensity, CFG.accent2.dist);
accent2.position.set(10, 4, 5);  scene.add(accent2);

// linterna spotlight luz focal pegada a la camara
const linterna = new THREE.SpotLight(0xfff1cc, 0, 60, Math.PI / 6, 0.35, 1.0);
linterna.position.set(0.25, -0.15, 0);      // un poco a la derecha y abajo, como en la mano
linterna.target.position.set(0, 0, -1);     // apunta hacia donde mira la camara
linterna.castShadow = SHADOWS;
camera.add(linterna);
camera.add(linterna.target);
scene.add(camera);                           // necesario para que se rendericen los hijos de la camara
const LINTERNA_INT = 5;      // intensidad de la linterna encendida

// escenario mas colisiones
// solidos son las cajas contra las que chocan el jugador, los zombies y las granadas
// mallassolidas son las mallas que detienen las balas
const solidos = [];
const mallasSolidas = [];
const fuegos = [];
let LIMITE = 38;            // borde jugable del mapa
let RADIO_MAPA = 0;         // si el mapa es redondo, su radio, como el helipuerto
let SPAWNS = null;          // puntos donde salen los zombies, si no hay salen en un anillo
let INICIO_JUGADOR = new THREE.Vector3(0, 1.7, 0);

function agregarSolido(obj, margen = 0, detieneBalas = true) {
  obj.updateWorldMatrix(true, true);          // incluye la posicion rotacion del grupo padre
  const b = new THREE.Box3().setFromObject(obj);
  solidos.push({ minX:b.min.x - margen, maxX:b.max.x + margen, minZ:b.min.z - margen, maxZ:b.max.z + margen });
  if (detieneBalas) mallasSolidas.push(obj);
}

// empuja un punto fuera de las cajas solidas, r es el radio del personaje
function resolverColision(p, r) {
  for (let i = 0; i < solidos.length; i++) {
    const b = solidos[i];
    if (p.x < b.minX - r || p.x > b.maxX + r || p.z < b.minZ - r || p.z > b.maxZ + r) continue;
    const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
    const dx = p.x - cx, dz = p.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) continue;
    if (d2 > 1e-8) {
      const d = Math.sqrt(d2);
      p.x = cx + dx / d * r; p.z = cz + dz / d * r;
    } else {
      // quedo dentro sacarlo por el lado mas cercano
      const izq = p.x - b.minX, der = b.maxX - p.x, atr = p.z - b.minZ, ade = b.maxZ - p.z;
      const m = Math.min(izq, der, atr, ade);
      if (m === izq) p.x = b.minX - r; else if (m === der) p.x = b.maxX + r;
      else if (m === atr) p.z = b.minZ - r; else p.z = b.maxZ + r;
    }
  }
  p.x = Math.max(-LIMITE, Math.min(LIMITE, p.x));
  p.z = Math.max(-LIMITE, Math.min(LIMITE, p.z));
  // en el mapa redondo no se puede pasar de la orilla
  if (RADIO_MAPA) {
    const d = Math.hypot(p.x, p.z), max = RADIO_MAPA - r;
    if (d > max) { p.x *= max / d; p.z *= max / d; }
  }
}

function puntoBloqueado(x, z, r) {
  if (Math.abs(x) > LIMITE || Math.abs(z) > LIMITE) return true;
  if (RADIO_MAPA && Math.hypot(x, z) + r > RADIO_MAPA) return true;
  for (let i = 0; i < solidos.length; i++) {
    const b = solidos[i];
    if (x > b.minX - r && x < b.maxX + r && z > b.minZ - r && z < b.maxZ + r) return true;
  }
  return false;
}

// texturas generadas con canvas
function rngSemilla(semilla) {               // mismo mapa en cada partida y para todos los jugadores
  let a = semilla >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function texCanvas(w, h, dibujar, repetir = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  dibujar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function ruido(ctx, w, h, n, colores, tam, rnd) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colores[Math.floor(rnd() * colores.length)];
    ctx.fillRect(rnd() * w, rnd() * h, tam * (0.5 + rnd()), tam * (0.5 + rnd()));
  }
}

function texturaAsfalto(rnd) {
  return texCanvas(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#26221f'; ctx.fillRect(0, 0, w, h);
    ruido(ctx, w, h, 9000, ['#2e2a26', '#1d1a18', '#332e29', '#221f1c'], 2, rnd);
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {              // grietas
      let x = rnd() * w, y = rnd() * h; ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 7; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; ctx.lineTo(x, y); }
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {               // manchas
      ctx.fillStyle = `rgba(${rnd() < 0.3 ? '60,8,8' : '10,10,10'},0.35)`;
      ctx.beginPath(); ctx.ellipse(rnd() * w, rnd() * h, 15 + rnd() * 40, 10 + rnd() * 25, rnd() * 3, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function texturaBanqueta(rnd) {
  return texCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#5a5550'; ctx.fillRect(0, 0, w, h);
    ruido(ctx, w, h, 2500, ['#625c56', '#4d4844', '#56514c'], 2, rnd);
    ctx.strokeStyle = '#3a3633'; ctx.lineWidth = 3;
    for (let i = 0; i <= 4; i++) { ctx.beginPath(); ctx.moveTo(i * 64, 0); ctx.lineTo(i * 64, h); ctx.stroke();
                                   ctx.beginPath(); ctx.moveTo(0, i * 64); ctx.lineTo(w, i * 64); ctx.stroke(); }
  });
}

// fachada devuelve textura de color y emissive ventanas encendidas que brillan
function texturaFachada(rnd, pared, quemada) {
  const lit = [];
  const map = texCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = pared; ctx.fillRect(0, 0, w, h);
    ruido(ctx, w, h, 1800, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.05)'], 3, rnd);
    for (let f = 0; f < 4; f++) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, f * 64 + 58, w, 6);          // cornisa
      for (let c = 0; c < 4; c++) {
        const x = c * 64 + 14, y = f * 64 + 14, r = rnd();
        const encendida = !quemada && r < 0.16;
        ctx.fillStyle = encendida ? '#ffcf7a' : (r < 0.55 ? '#0d1218' : '#1a222c');
        ctx.fillRect(x, y, 36, 36);
        if (!encendida && r > 0.85) {           // vidrio roto
          ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 36, y); ctx.lineTo(x + 20, y + 22); ctx.lineTo(x + 6, y + 30); ctx.fill();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 2, y + 36, 40, 3);         // repisa
        if (encendida) lit.push([x, y]);
      }
    }
    if (quemada) {                               // hollin
      for (let i = 0; i < 26; i++) {
        const g = ctx.createRadialGradient(rnd() * w, rnd() * h, 2, rnd() * w, rnd() * h, 50 + rnd() * 60);
        g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      }
    }
  });
  const emissive = texCanvas(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffbb66'; lit.forEach(([x, y]) => ctx.fillRect(x, y, 36, 36));
  });
  return { map, emissive };
}

function texturaOxido(rnd, base) {
  return texCanvas(128, 128, (ctx, w, h) => {
    ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
    ruido(ctx, w, h, 900, ['#3b2416', '#5a3218', '#1a1310', '#2b2a28'], 4, rnd);
  });
}

// caja con uvs escaladas a metros, para que la textura no se estire
function cajaUV(w, h, d, tileU, tileV) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const caras = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // caras de la caja
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * caras[f][0] / tileU, uv.getY(i) * caras[f][1] / tileV);
  }
  uv.needsUpdate = true;
  return g;
}

// fuego con particulas three points
function crearFuego(x, y, z, escala = 1, luz = null) {
  const N = Math.round(46 * escala);
  const pos = new Float32Array(N * 3), vida = new Float32Array(N), vel = [];
  for (let i = 0; i < N; i++) { vida[i] = Math.random(); vel.push(0.6 + Math.random() * 1.2); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const llama = new THREE.Points(geo, new THREE.PointsMaterial({ color:0xff7a22, size:0.55 * escala,
    transparent:true, opacity:0.9, blending:THREE.AdditiveBlending, depthWrite:false }));
  const humoPos = new Float32Array(N * 3), humoVida = new Float32Array(N);
  for (let i = 0; i < N; i++) humoVida[i] = Math.random();
  const hgeo = new THREE.BufferGeometry(); hgeo.setAttribute('position', new THREE.BufferAttribute(humoPos, 3));
  const humo = new THREE.Points(hgeo, new THREE.PointsMaterial({ color:0x2a2420, size:1.4 * escala,
    transparent:true, opacity:0.45, depthWrite:false }));
  scene.add(llama, humo);
  fuegos.push({ x, y, z, escala, llama, humo, vida, vel, humoVida, luz, base: luz ? luz.intensity : 0 });
}

function actualizarFuegos(dt) {
  uniformTiempo.value += dt;          // anima los shaders de fuego y cielo
  if (ES_HOSPITAL) actualizarHospital(dt);
  fuegos.forEach(f => {
    const p = f.llama.geometry.attributes.position.array, h = f.humo.geometry.attributes.position.array;
    for (let i = 0; i < f.vida.length; i++) {
      f.vida[i] += dt * f.vel[i];
      if (f.vida[i] > 1) f.vida[i] -= 1;
      const v = f.vida[i], ang = i * 2.4, rad = (1 - v) * 0.5 * f.escala;
      p[i*3] = f.x + Math.cos(ang) * rad; p[i*3+1] = f.y + v * 1.6 * f.escala; p[i*3+2] = f.z + Math.sin(ang) * rad;
      f.humoVida[i] += dt * 0.25; if (f.humoVida[i] > 1) f.humoVida[i] -= 1;
      const hv = f.humoVida[i];
      h[i*3] = f.x + Math.cos(ang) * hv * 1.5; h[i*3+1] = f.y + 1.2 * f.escala + hv * 7; h[i*3+2] = f.z + Math.sin(ang) * hv * 1.5;
    }
    f.llama.geometry.attributes.position.needsUpdate = true;
    f.humo.geometry.attributes.position.needsUpdate = true;
    if (f.luz) f.luz.intensity = f.base * (0.75 + Math.random() * 0.5);
  });
  if (ceniza) {
    const a = ceniza.geometry.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      a[i+1] += dt * 0.6; a[i] += Math.sin(a[i+1] + i) * dt * 0.3;
      if (a[i+1] > 18) a[i+1] = 0;
    }
    ceniza.geometry.attributes.position.needsUpdate = true;
  }
}
let ceniza = null;
