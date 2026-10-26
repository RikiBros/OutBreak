'use strict';
// construye la ciudad y el muro de fuego con el cielo rojo, el hospital y el helipuerto estan en sus propios archivos

// mapa 1 ciudad devastada
// cruce de dos avenidas con el helicoptero estrellado al centro
// calles secundarias, manzanas con edificios algunos en ruinas
// autos quemados, autobus, barricadas y fuego
function construirCiudad() {
  const rnd = rngSemilla(72);
  LIMITE = 38.5;
  // luz principal mas alta que los edificios para que sus sombras se vean completas
  sunLight.position.set(30, 60, 20);
  renderer.toneMappingExposure = 1.0;        // un poco mas oscuro la linterna se nota mas
  if (SHADOWS) { sunLight.shadow.camera.far = 160; sunLight.shadow.camera.updateProjectionMatrix(); }
  INICIO_JUGADOR = new THREE.Vector3(0, 1.7, 10);
  // zombies entran por los extremos de las calles
  SPAWNS = [];
  [-37, 37].forEach(a => { SPAWNS.push([a, 0], [0, a], [a, 23.5], [a, -23.5], [23.5, a], [-23.5, a]); });

  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness:0.9 }, o));

  // piso de asfalto
  const tAsf = texturaAsfalto(rnd); tAsf.repeat.set(12, 12);
  const piso = new THREE.Mesh(new THREE.PlaneGeometry(92, 92), std({ map:tAsf }));
  piso.rotation.x = -Math.PI / 2; piso.receiveShadow = true; scene.add(piso);

  // lineas de la calle
  const amarillo = new THREE.MeshBasicMaterial({ color:0x8a7420 });
  const blanco   = new THREE.MeshBasicMaterial({ color:0x77736c });
  const linea = (x, z, w, d, m) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
    l.rotation.x = -Math.PI / 2; l.position.set(x, 0.02, z); scene.add(l); };
  for (let t = -38; t <= 38; t += 4) {
    if (Math.abs(t) < 8) continue;
    linea(t, 0, 2, 0.18, amarillo); linea(0, t, 0.18, 2, amarillo);
  }
  [-7.5, 7.5].forEach(c => { for (let k = -5; k <= 5; k += 1.2) { linea(c, k, 1.6, 0.5, blanco); linea(k, c, 0.5, 1.6, blanco); } });

  // materiales de edificios
  const tBanq = texturaBanqueta(rnd);
  const matBanq = std({ map:tBanq });
  const paredes = ['#6b5d50', '#5a5d63', '#7a6a58', '#4f4a45', '#6e5f5f'];
  const fachadas = paredes.map(c => { const t = texturaFachada(rnd, c, false);
    return std({ map:t.map, emissive:0xffffff, emissiveMap:t.emissive, emissiveIntensity:0.9 }); });
  const quemadas = ['#3a332e', '#2e2b29'].map(c => std({ map:texturaFachada(rnd, c, true).map }));
  const techo = std({ color:0x2b2826 });

  const edificio = (cx, cz, w, d, h, ruina) => {
    const fach = ruina ? quemadas[Math.floor(rnd() * quemadas.length)] : fachadas[Math.floor(rnd() * fachadas.length)];
    const m = new THREE.Mesh(cajaUV(w, h, d, 8, 12), [fach, fach, techo, techo, fach, fach]);
    m.position.set(cx, h / 2 + 0.15, cz);
    m.castShadow = m.receiveShadow = true;
    scene.add(m); agregarSolido(m);
    if (ruina) {
      // pedazos irregulares arriba estructura destrozada
      for (let i = 0; i < 6; i++) {
        const pw = 1 + rnd() * (w / 2.5), pd = 1 + rnd() * (d / 2.5), ph = 1 + rnd() * 4;
        const px = cx + (rnd() - 0.5) * (w - pw), pz = cz + (rnd() - 0.5) * (d - pd);
        const pz2 = new THREE.Mesh(cajaUV(pw, ph, pd, 8, 12), [fach, fach, techo, techo, fach, fach]);
        pz2.position.set(px, h + 0.15 + ph / 2, pz); pz2.rotation.z = (rnd() - 0.5) * 0.15;
        pz2.castShadow = true; scene.add(pz2);
      }
      crearFuego(cx + (rnd() - 0.5) * w * 0.5, h + 0.2, cz + (rnd() - 0.5) * d * 0.5, 1.6);
    }
  };

  // manzanas 4 por cuadrante con banqueta y edificios
  const rangos = [[8, 19], [28, 40]];
  [-1, 1].forEach(sx => [-1, 1].forEach(sz => rangos.forEach(rx => rangos.forEach(rz => {
    const x0 = Math.min(sx * rx[0], sx * rx[1]), x1 = Math.max(sx * rx[0], sx * rx[1]);
    const z0 = Math.min(sz * rz[0], sz * rz[1]), z1 = Math.max(sz * rz[0], sz * rz[1]);
    const bw = x1 - x0, bd = z1 - z0, bx = (x0 + x1) / 2, bz = (z0 + z1) / 2;
    const banq = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.15, bd), matBanq);
    banq.position.set(bx, 0.075, bz); banq.receiveShadow = true; scene.add(banq);
    tBanq.repeat.set(1, 1);
    // edificios 1 o 2 por manzana, dejando 1 5 m de banqueta
    const ix0 = x0 + 1.5, ix1 = x1 - 1.5, iz0 = z0 + 1.5, iz1 = z1 - 1.5;
    const borde = Math.abs(bx) > 30 || Math.abs(bz) > 30;
    const alto  = () => borde ? 14 + rnd() * 16 : 8 + rnd() * 14;
    const ruina = () => rnd() < 0.3;
    if (rnd() < 0.5) {
      edificio((ix0 + ix1) / 2, (iz0 + iz1) / 2, ix1 - ix0, iz1 - iz0, alto(), ruina());
    } else if (ix1 - ix0 > iz1 - iz0) {
      const cut = ix0 + (ix1 - ix0) * (0.4 + rnd() * 0.2);
      const r1 = ruina();
      edificio((ix0 + cut) / 2 - 0.2, (iz0 + iz1) / 2, cut - ix0 - 0.4, iz1 - iz0, r1 ? 5 + rnd() * 5 : alto(), r1);
      const r2 = ruina();
      edificio((cut + ix1) / 2 + 0.2, (iz0 + iz1) / 2, ix1 - cut - 0.4, iz1 - iz0, r2 ? 5 + rnd() * 5 : alto(), r2);
    } else {
      const cut = iz0 + (iz1 - iz0) * (0.4 + rnd() * 0.2);
      const r1 = ruina();
      edificio((ix0 + ix1) / 2, (iz0 + cut) / 2 - 0.2, ix1 - ix0, cut - iz0 - 0.4, r1 ? 5 + rnd() * 5 : alto(), r1);
      const r2 = ruina();
      edificio((ix0 + ix1) / 2, (cut + iz1) / 2 + 0.2, ix1 - ix0, iz1 - cut - 0.4, r2 ? 5 + rnd() * 5 : alto(), r2);
    }
  }))));

  // silueta de la ciudad a lo lejos fuera del area jugable
  const matLejos = std({ color:0x1a1614, emissive:0xffffff, emissiveMap:texturaFachada(rnd, '#1a1614', false).emissive, emissiveIntensity:0.5 });
  for (let i = 0; i < 46; i++) {
    const ang = (i / 46) * Math.PI * 2 + rnd() * 0.1, r = 56 + rnd() * 18;
    const w = 6 + rnd() * 10, h = 20 + rnd() * 45;
    const m = new THREE.Mesh(cajaUV(w, h, w, 8, 12), matLejos);
    m.position.set(Math.cos(ang) * r, h / 2, Math.sin(ang) * r); m.rotation.y = rnd() * 3;
    scene.add(m);
  }

  // helicoptero estrellado el de la historia
  const heli = new THREE.Group();
  const verde = std({ map:texturaOxido(rnd, '#2d3226'), roughness:0.7, metalness:0.3 });
  const vidrio = std({ color:0x0b1014, roughness:0.2, metalness:0.6 });
  const fus = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2, 5), verde); fus.position.y = 1.1; heli.add(fus);
  const nariz = new THREE.Mesh(new THREE.SphereGeometry(1.15, 12, 10), vidrio);
  nariz.scale.set(0.95, 0.85, 1.1); nariz.position.set(0, 1.15, 2.6); heli.add(nariz);
  const cola = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 5.5, 8), verde);
  cola.rotation.x = Math.PI / 2 - 0.12; cola.position.set(0, 1.3, -5); heli.add(cola);
  const aleta = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.6, 1), verde); aleta.position.set(0, 2, -7.6); heli.add(aleta);
  [-1, 1].forEach(s => { const pat = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.5), std({ color:0x222222 }));
    pat.position.set(s * 1.2, 0.08, 0.3); heli.add(pat); });
  const aspa = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 6.5), std({ color:0x1a1a1a }));
  aspa.position.set(0, 2.2, 0); aspa.rotation.set(0.25, 0.6, 0.1); heli.add(aspa);
  const aspaSuelo = aspa.clone(); aspaSuelo.position.set(3.5, 0.05, -2); aspaSuelo.rotation.set(0, 1.2, 0); scene.add(aspaSuelo);
  heli.traverse(n => { if (n.isMesh) n.castShadow = n.receiveShadow = true; });
  heli.position.set(0, 0, -1); heli.rotation.set(0, 0.6, -0.12);
  scene.add(heli);
  agregarSolido(fus, 0.2); agregarSolido(cola, 0.1);
  accent1.position.set(0, 2.5, -1);
  crearFuego(0.4, 2.1, -0.5, 1.4, accent1);
  crearFuego(-1.6, 0.4, -3.5, 1.0);

  // autos quemados
  const coloresAuto = ['#3b1d1a', '#1f2a33', '#30302b', '#4a3a22', '#26231f'];
  const auto = (x, z, rot, enLlamas) => {
    const g = new THREE.Group();
    const pintura = std({ map:texturaOxido(rnd, coloresAuto[Math.floor(rnd() * coloresAuto.length)]), roughness:0.6, metalness:0.4 });
    const cristal = std({ color:0x2a3a46, roughness:0.15, metalness:0.7 });
    const negro   = std({ color:0x141414 });
    const add = (geo, m, px, py, pz) => { const me = new THREE.Mesh(geo, m); me.position.set(px, py, pz); me.castShadow = me.receiveShadow = true; g.add(me); return me; };
    const base = add(new THREE.BoxGeometry(1.9, 0.55, 4.3), pintura, 0, 0.62, 0);          // carroceria
    add(new THREE.BoxGeometry(1.86, 0.18, 1.2), pintura, 0, 0.98, 1.45);                   // cofre
    add(new THREE.BoxGeometry(1.86, 0.16, 0.9), pintura, 0, 0.97, -1.65);                  // cajuela
    // cabina vidrios a los lados frente atras y techo pintado
    add(new THREE.BoxGeometry(1.7, 0.55, 2.0), [cristal, cristal, pintura, negro, cristal, cristal], 0, 1.2, -0.2);
    add(new THREE.BoxGeometry(1.95, 0.18, 0.2), negro, 0, 0.5, 2.18);                      // defensas
    add(new THREE.BoxGeometry(1.95, 0.18, 0.2), negro, 0, 0.5, -2.18);
    const faro = std({ color:0x777766, emissive:0x221a00 });
    [-0.65, 0.65].forEach(fx => { add(new THREE.BoxGeometry(0.35, 0.14, 0.05), faro, fx, 0.72, 2.16);
      add(new THREE.BoxGeometry(0.35, 0.12, 0.05), std({ color:0x3a0606 }), fx, 0.72, -2.16); });
    const llanta = new THREE.CylinderGeometry(0.37, 0.37, 0.26, 14), rin = new THREE.CylinderGeometry(0.2, 0.2, 0.28, 10);
    [[-0.92, 1.35], [0.92, 1.35], [-0.92, -1.35], [0.92, -1.35]].forEach(([lx, lz]) => {
      const l = add(llanta, negro, lx, 0.37, lz); l.rotation.z = Math.PI / 2;
      const r = add(rin, std({ color:0x555555, metalness:0.6 }), lx, 0.37, lz); r.rotation.z = Math.PI / 2; });
    g.position.set(x, 0, z); g.rotation.y = rot;
    if (enLlamas) g.rotation.z = 0.04;                                                     // ligeramente hundido
    scene.add(g);
    agregarSolido(base, 0.08);
    if (enLlamas) crearFuego(x, 1.0, z, 1.1);
  };
  [[12, 2.5, Math.PI / 2 + 0.2, true], [-15, -3, Math.PI / 2 - 0.3, false], [28, -2.8, Math.PI / 2, false],
   [3, 17, 0.25, false], [-2.8, 30, -0.2, true], [2.5, -15, 0.1, false], [-3, -30, 0.4, false],
   [23.5, 12, 0.1, false], [-23.5, -14, -0.15, true], [14, 23.5, Math.PI / 2 + 0.1, false],
   [-13, 24.5, Math.PI / 2 - 0.2, false], [24.5, -30, 0.3, false]]
    .forEach(([x, z, r, f]) => auto(x, z, r, f));

  // autobus chocado atravesado en la avenida
  const bus = new THREE.Group();
  const matBus = std({ map:texturaOxido(rnd, '#5e4a1c'), roughness:0.7, metalness:0.3 });
  const caja = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.8, 10), matBus); caja.position.y = 1.6; bus.add(caja);
  const venta = new THREE.Mesh(new THREE.BoxGeometry(2.65, 0.9, 8.5), vidrio); venta.position.set(0, 2.2, 0.2); bus.add(venta);
  bus.traverse(n => { if (n.isMesh) n.castShadow = n.receiveShadow = true; });
  bus.position.set(-27, 0, 1.5); bus.rotation.y = Math.PI / 2 - 0.5; scene.add(bus);
  agregarSolido(caja, 0, true);
  accent2.position.set(-27, 3, 1.5);
  crearFuego(-28.5, 3.1, 0.5, 1.6, accent2);

  // barricadas de concreto y contenedores
  const concreto = std({ color:0x6d6a64 });
  const barrera = (x, z, rot) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 3), concreto);
    b.position.set(x, 0.45, z); b.rotation.y = rot; b.castShadow = b.receiveShadow = true; scene.add(b); agregarSolido(b); };
  [[7, -10, 0.3], [-9, 7.2, Math.PI / 2], [9.5, -7, Math.PI / 2 + 0.2], [-7, 14, 0.1],
   [16, -24, Math.PI / 2], [-21, 20, 0.2], [20, 21.5, 0.4]].forEach(([x, z, r]) => barrera(x, z, r));
  const contenedor = (x, z, rot, color) => { const c = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, 6), std({ map:texturaOxido(rnd, color), metalness:0.4 }));
    c.position.set(x, 1.3, z); c.rotation.y = rot; c.castShadow = c.receiveShadow = true; scene.add(c); };
  // barricada militar al final de cada calle borde del mapa
  [-40.5, 40.5].forEach(e => {
    [0, 23.5, -23.5].forEach(c => {
      contenedor(e, c - 3, Math.PI / 2 * 0, '#3d4a3a'); contenedor(e, c + 3, 0, '#4a2e22');
      contenedor(c - 3, e, Math.PI / 2, '#2e3a4a');     contenedor(c + 3, e, Math.PI / 2, '#3d4a3a');
    });
  });
  const basurero = (x, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.3, 1.1), std({ color:0x1f3a24 }));
    b.position.set(x, 0.65, z); b.castShadow = true; scene.add(b); agregarSolido(b); };
  [[7.4, 19], [-19, 7.4], [26.6, -12], [-26.6, 33], [12, -26.6], [-33, -26.6]].forEach(([x, z]) => basurero(x, z));

  // postes de luz dos todavia funcionan
  const metal = std({ color:0x2a2a2a, metalness:0.6, roughness:0.5 });
  const foco  = new THREE.MeshStandardMaterial({ color:0x333333, emissive:0xcfe0ff, emissiveIntensity:1.5 });
  const focoMuerto = std({ color:0x222222 });
  const poste = (x, z, rot, funciona) => {
    const g = new THREE.Group();
    const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.5, 8), metal); palo.position.y = 2.75; g.add(palo);
    const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 1.4), metal); brazo.position.set(0, 5.4, 0.7); g.add(brazo);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.5), funciona ? foco : focoMuerto); lamp.position.set(0, 5.3, 1.3); g.add(lamp);
    g.position.set(x, 0, z); g.rotation.y = rot; palo.castShadow = true; scene.add(g);
    agregarSolido(palo, 0.15, false);
    if (funciona) { const l = new THREE.PointLight(0xcfe0ff, 1.3, 16, 1.5); l.position.set(0, 5.1, 1.3); g.add(l); }
  };
  [[-12, 8.6, Math.PI, true], [30, 8.6, Math.PI, false], [12, -8.6, 0, false], [-30, -8.6, 0, false],
   [8.6, 12, -Math.PI / 2, false], [8.6, -30, -Math.PI / 2, false], [-8.6, -12, Math.PI / 2, true], [-8.6, 30, Math.PI / 2, false]]
    .forEach(([x, z, r, f]) => poste(x, z, r, f));

  // escombros instancedmesh muchos objetos en una sola llamada de dibujo
  const escombros = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), std({ color:0x4e4943 }), 140);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let n = 0;
  while (n < 140) {
    const x = (rnd() * 2 - 1) * 38, z = (rnd() * 2 - 1) * 38;
    if (puntoBloqueado(x, z, 0.5) || Math.hypot(x - INICIO_JUGADOR.x, z - INICIO_JUGADOR.z) < 3) continue;
    const t = 0.15 + rnd() * 0.55;
    m4.compose(p.set(x, t / 3, z), q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3)), s.set(t * (1 + rnd()), t * 0.6, t));
    escombros.setMatrixAt(n++, m4);
  }
  escombros.receiveShadow = escombros.castShadow = true;
  scene.add(escombros);

  // ceniza flotando en el aire
  const NC = 260, pc = new Float32Array(NC * 3);
  for (let i = 0; i < NC; i++) { pc[i*3] = (rnd() * 2 - 1) * 40; pc[i*3+1] = rnd() * 18; pc[i*3+2] = (rnd() * 2 - 1) * 40; }
  const gc = new THREE.BufferGeometry(); gc.setAttribute('position', new THREE.BufferAttribute(pc, 3));
  ceniza = new THREE.Points(gc, new THREE.PointsMaterial({ color:0xff8844, size:0.08, transparent:true, opacity:0.8,
    blending:THREE.AdditiveBlending, depthWrite:false }));
  scene.add(ceniza);
}

// el hospital se arma en hospital js
if (ES_HOSPITAL) construirHospital();
else if (ES_HELIPUERTO) construirHelipuerto();
else construirCiudad();
camera.position.copy(INICIO_JUGADOR);
camera.lookAt(0, 1.7, -1);

// shaders muro de fuego en el limite del mapa mas cielo con neblina roja
const GLSL_RUIDO = `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; } return v; }
`;
const uniformTiempo = { value: 0 };

// sin muro es para el helipuerto, ahi solo va el cielo
function crearLimiteYCielo(sinMuro) {
  // muro de fuego animado en los 4 bordes
  const matFuego = new THREE.ShaderMaterial({
    uniforms: { uTiempo: uniformTiempo },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: GLSL_RUIDO + `
      uniform float uTiempo; varying vec2 vUv;
      void main(){
        vec2 p = vec2(vUv.x * 38.0, vUv.y * 2.5 - uTiempo * 1.4);
        float n = fbm(p + fbm(p * 0.5 + uTiempo * 0.2));
        float base = 1.0 - vUv.y;                                   // mas fuerte abajo
        float llama = smoothstep(0.15, 0.95, n * 1.5 * base + base * 0.45 - 0.2);
        vec3 col = mix(vec3(0.45, 0.02, 0.0), vec3(1.0, 0.38, 0.04), llama);
        col = mix(col, vec3(1.0, 0.82, 0.45), smoothstep(0.8, 1.0, llama));
        gl_FragColor = vec4(col, llama * 0.9);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  if (!sinMuro) {
    const L = LIMITE + 1, alto = 7;
    [[0, L, 0], [0, -L, 0], [L, 0, Math.PI / 2], [-L, 0, Math.PI / 2]].forEach(([x, z, ry]) => {
      const muro = new THREE.Mesh(new THREE.PlaneGeometry(L * 2, alto, 1, 1), matFuego);
      muro.position.set(x, alto / 2, z); muro.rotation.y = ry;
      scene.add(muro);
      // resplandor rojo en el piso junto al muro
      const brillo = new THREE.Mesh(new THREE.PlaneGeometry(L * 2, 3),
        new THREE.MeshBasicMaterial({ color:0xff3a0a, transparent:true, opacity:0.22, depthWrite:false, blending:THREE.AdditiveBlending }));
      brillo.rotation.x = -Math.PI / 2; brillo.rotation.z = ry;
      brillo.position.set(x * 0.98, 0.03, z * 0.98);
      scene.add(brillo);
    });
  }

  // cielo domo con neblina roja que se mueve
  const matCielo = new THREE.ShaderMaterial({
    uniforms: { uTiempo: uniformTiempo },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: GLSL_RUIDO + `
      uniform float uTiempo; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.2, 1.0);
        vec3 arriba    = vec3(0.025, 0.006, 0.008);
        vec3 horizonte = vec3(0.20, 0.045, 0.025);
        vec3 col = mix(horizonte, arriba, smoothstep(0.0, 0.55, h));
        // nubes de humo rojizo iluminadas por los incendios
        vec2 uv = vDir.xz / (h + 0.35) * 2.2 + vec2(uTiempo * 0.015, uTiempo * 0.008);
        float nubes = fbm(uv) * fbm(uv * 1.7 + 3.0);
        col += vec3(0.55, 0.09, 0.03) * smoothstep(0.15, 0.55, nubes) * (1.0 - smoothstep(0.1, 0.8, h)) * 0.9;
        gl_FragColor = vec4(col, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const cielo = new THREE.Mesh(new THREE.SphereGeometry(170, 32, 16), matCielo);
  cielo.renderOrder = -1;
  scene.add(cielo);
  scene.background = null;
  scene.fog.color.setHex(0x2a0b07);                // la niebla del suelo combina con el horizonte rojo
}
// el hospital tiene techo, no lleva muro de fuego ni cielo
if (!ES_HOSPITAL) crearLimiteYCielo(ES_HELIPUERTO);
