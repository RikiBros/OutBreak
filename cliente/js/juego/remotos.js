'use strict';
// los otros jugadores en linea, su modelo, como apuntan, disparan y caen

// sistema de jugadores remotos
// cada jugador conectado tiene su modelo en la escena y se mueve suavecito
const jugadoresRemotos = {};   // guarda el modelo y hacia donde va cada jugador

// crear o recuperar el modelo 3d de un jugador remoto
const COLOR_CAMISA_DEF = '#24508c';
function colorValido(c) { return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : COLOR_CAMISA_DEF; }

window.spawnJugadorRemoto = function(socketId, username, color) {
  if (jugadoresRemotos[socketId]) {
    // si ya existia pero cambio de color, repintar la camisa
    const jr0 = jugadoresRemotos[socketId];
    if (color && colorValido(color) !== jr0.color) { jr0.color = colorValido(color); jr0.matRopa.color.set(jr0.color); }
    return;
  }

  const g = new THREE.Group();

  // modelo de superviviente mismo esqueleto por codigo la camisa es del color que eligio el jugador
  const camisa = colorValido(color);
  const h = crearHumanoide({ escala:1, ancho:1, piel:0xd9a77a, ropa:new THREE.Color(camisa).getHex(), pantalon:0x2b2b2b, ojos:0x222222, inclinacion:0 });
  h.partes.brazoI.rotation.x = h.partes.brazoD.rotation.x = -0.2;
  g.add(h.root);
  g.userData.partes = h.partes;
  // pistola en la mano derecha para ver cuando apunta y dispara
  const arma = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color:0x1d1d1d, roughness:0.5, metalness:0.6 });
  const cuerpoArma = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, 0.34), metal); cuerpoArma.position.z = 0.1; arma.add(cuerpoArma);
  const mango = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.08), metal); mango.position.set(0, -0.1, -0.02); mango.rotation.x = 0.25; arma.add(mango);
  const boca = new THREE.Object3D(); boca.position.z = 0.3; arma.add(boca);
  arma.position.set(0, -0.86, 0.06); arma.rotation.x = Math.PI / 2;   // apunta hacia donde apunta el brazo
  h.partes.brazoD.add(arma);
  // etiqueta con el nombre del jugador sobre su cabeza
  // se hace con un sprite de canvas 2d
  const labelCanvas  = document.createElement('canvas');
  labelCanvas.width  = 256;
  labelCanvas.height = 64;
  const ctx = labelCanvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 28px Oswald, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(username || 'P?', 128, 42);
  const labelTex     = new THREE.CanvasTexture(labelCanvas);
  const labelMat     = new THREE.SpriteMaterial({ map: labelTex, transparent: true });
  const labelSprite  = new THREE.Sprite(labelMat);
  labelSprite.scale.set(1.5, 0.4, 1);
  labelSprite.position.y = 2.2;
  g.add(labelSprite);

  g.position.set(0, 0, 5); // posicion inicial fuera del jugador
  scene.add(g);

  let matRopa = null;
  h.partes.torso.children[0] && (matRopa = h.partes.torso.children[0].material);
  jugadoresRemotos[socketId] = {
    mesh     : g,
    partes   : g.userData.partes,
    cuerpo   : h.cuerpo,
    boca,
    fase     : 0,
    mixer    : null,
    targetPos: new THREE.Vector3(0, 0, 5),
    targetRot: 0,
    pitch    : 0,
    apunta   : false,
    muerto   : false,
    color    : camisa,
    matRopa,
    username,
  };

  console.log('Jugador remoto spawneado:', username, socketId);
};

// mover el modelo 3d de un jugador remoto llamado desde socket io
window.moverJugadorRemoto = function(socketId, x, y, z, rot, f, p) {
  const jr = jugadoresRemotos[socketId];
  if (!jr) return;
  jr.targetPos.set(x, 0, z);
  jr.targetRot = rot;
  jr.apunta = !!(f & 1);          // esta apuntando
  jr.muerto = !!(f & 2);          // lo derribaron su cuerpo queda en el piso
  jr.pitch  = +p || 0;
};

// otro jugador disparo fogonazo en su arma y la estela de la bala
const _bocaPos = new THREE.Vector3();
window._disparoRemoto = function(socketId, arma) {
  const jr = jugadoresRemotos[socketId];
  if (!jr || jr.muerto) return;
  jr.mesh.updateWorldMatrix(true, true);
  jr.boca.getWorldPosition(_bocaPos);
  const yaw = jr.mesh.rotation.y, p = jr.pitch;
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(p), Math.sin(p), Math.cos(yaw) * Math.cos(p));
  const flash = new THREE.Mesh(new THREE.SphereGeometry(arma === 'e' ? 0.2 : 0.12, 8, 6), new THREE.MeshBasicMaterial({ color:0xffd27a }));
  flash.position.copy(_bocaPos); scene.add(flash);
  const luz = new THREE.PointLight(0xffaa44, 3, 6); luz.position.copy(_bocaPos); scene.add(luz);
  const rayos = arma === 'e' ? 6 : 1;
  const lineas = [];
  for (let i = 0; i < rayos; i++) {
    const d = dir.clone();
    if (arma === 'e') { d.x += (Math.random() - 0.5) * 0.18; d.y += (Math.random() - 0.5) * 0.1; d.z += (Math.random() - 0.5) * 0.18; d.normalize(); }
    const fin = _bocaPos.clone().addScaledVector(d, arma === 'e' ? 14 : 28);
    const geo = new THREE.BufferGeometry().setFromPoints([_bocaPos.clone(), fin]);
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ color:0xffe08a, transparent:true, opacity:0.85 }));
    scene.add(l); lineas.push(l);
  }
  setTimeout(() => { scene.remove(flash); scene.remove(luz); lineas.forEach(l => scene.remove(l)); }, 70);
};

// eliminar jugador remoto de la escena
window._idsRemotos = () => Object.keys(jugadoresRemotos);
window.removerJugadorRemoto = function(socketId) {
  const jr = jugadoresRemotos[socketId];
  if (!jr) return;
  scene.remove(jr.mesh);

  delete jugadoresRemotos[socketId];
  console.log('Jugador remoto removido:', socketId);
};
