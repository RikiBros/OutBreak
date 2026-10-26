'use strict';
// arranca la partida y el ciclo que se repite en cada cuadro

// iniciar juego desde lobby
function iniciarJuego() {
  game.started = true;
  document.getElementById('lobby-screen').classList.remove('visible');
  // llenar hud con datos del usuario
  document.getElementById('active-map-name').textContent = mapName + ' · ' + DIF.nombre;
  document.getElementById('hud-username').textContent    = usuario?.username || '---';
  // llenar pip de jugador con el nombre
  document.getElementById('pip-local').textContent =
    (usuario?.username||'TÚ').substring(0,3).toUpperCase();
  if (ES_ZONA) { crearZona(); document.getElementById('heli-text').textContent = 'TU TIEMPO SE ACABÓ'; }
  else if (ES_HOSPITAL) document.getElementById('heli-text').textContent = 'EL RESCATE TE SUBE A LA AZOTEA';
  prepararLinterna();
  updateHUD();
  iniciarOleada();
}

// loop principal
const eulerYaw = new THREE.Euler(0, 0, 0, 'YXZ');
// diferencia de angulo por el camino mas corto para girar suave sin dar la vuelta completa
const difAngulo = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const clock = new THREE.Clock();
let flickerT = 0;

function animate() {
  requestAnimationFrame(animate);
  // getdelta en cada cuadro para que al quitar la pausa no haya un salto
  const dt = Math.min(clock.getDelta(), 0.1);
  actualizarFuegos(dt);
  if (!game.started || game.paused || game.over){ renderer.render(scene,camera); return; }

  // descanso entre oleadas en solitario se detiene mientras estas en la tienda
  if (game.intermission && tipoPartida === 'online') {
    document.getElementById('shop-timer').textContent = game.listo ? 'ESPERANDO A LOS DEMÁS' : 'PRESIONA LISTO CUANDO TERMINES';
  } else if (game.intermission && !(game.inShop && tipoPartida === 'solo')) {
    game.interTime -= dt;
    const seg = Math.max(0, Math.ceil(game.interTime));
    document.getElementById('inter-time').textContent = seg;
    document.getElementById('shop-timer').textContent = 'SIGUIENTE OLEADA EN ' + seg + 's';
    if (game.interTime <= 0) iniciarSiguienteOleada();
  } else if (game.inShop) {
    document.getElementById('shop-timer').textContent = 'EL TIEMPO ESTÁ DETENIDO';
  }

  // muerto cuenta para reaparecer
  if (game.muerto) {
    game.respawnT -= dt;
    document.getElementById('respawn-t').textContent = Math.max(1, Math.ceil(game.respawnT));
    if (game.respawnT <= 0) reaparecer();
  }
  if (game.inmuneT > 0) game.inmuneT -= dt;
  document.getElementById('hud-vitals').classList.toggle('inmune', game.inmuneT > 0);
  if (game.lentoT > 0) game.lentoT -= dt;

  // disparo automatico mejora mantener clic izquierdo
  if (game.arma === 'pistola' && game.mejoras.auto && game.disparando && game.aiming && controls.isLocked && !game.inShop && !game.briefing) {
    game.fireTimer -= dt;
    if (game.fireTimer <= 0) { shoot(); game.fireTimer = CADENCIA; }
  }

  // zoom al apuntar fov 75 a 45 y caminar mas lento
  const fovMeta = game.aiming ? 45 : 75;
  if (Math.abs(camera.fov - fovMeta) > 0.1) {
    camera.fov += (fovMeta - camera.fov) * Math.min(1, dt * 14);
    camera.updateProjectionMatrix();
  }
  // correr con shift gasta estamina
  const moviendo  = keys.w || keys.a || keys.s || keys.d;
  const corriendo = keys.shift && moviendo && !game.aiming && !game.agotado && game.stamina > 0 && !game.inShop && !game.briefing;
  if (corriendo) {
    game.stamina = Math.max(0, game.stamina - 24 * dt);
    game.staminaPausa = 0.9;
    if (game.stamina <= 0) { game.agotado = true; showAlert('SIN ESTAMINA — TOMA UNA BEBIDA (TECLA 3)'); }
  }
  // la estamina no se recupera sola solo con la bebida de estamina
  document.getElementById('stamina-fill').style.width = (game.stamina / DIF.staminaMax * 100) + '%';
  document.getElementById('stamina-cur').textContent = Math.round(game.stamina / DIF.staminaMax * 100);
  document.getElementById('stamina-wrap').classList.toggle('agotado', game.agotado);

  // briefing en linea arranca solo
  if (game.briefing && tipoPartida === 'online') {
    game.briefT -= dt;
    document.getElementById('wb-go').textContent = 'COMIENZA EN ' + Math.max(0, Math.ceil(game.briefT));
    if (game.briefT <= 0) comenzarOleada(true);
  }

  const vel = 8 * DIF.velJugador * (game.lentoT > 0 ? 0.55 : 1) * (game.aiming ? 0.55 : 1) * (corriendo ? 1.65 : 1);
  if (!game.inShop && !game.briefing && !game.muerto && !game.mapaAbierto) {
    if(keys.w) controls.moveForward( vel*dt);
    if(keys.s) controls.moveForward(-vel*dt);
    if(keys.d) controls.moveRight(   vel*dt);
    if(keys.a) controls.moveRight(  -vel*dt);
  }
  // colision del jugador con edificios, autos, barricadas, etc
  resolverColision(camera.position, 0.45);
  // salto gravedad mas elevacion del helicoptero al final
  if (game.saltoV !== 0 || game.saltoY > 0) {
    game.saltoV -= 18 * dt;
    game.saltoY += game.saltoV * dt;
    if (game.saltoY <= 0) { game.saltoY = 0; game.saltoV = 0; }
  }
  camera.position.y = (game.muerto ? 0.5 : 1.7) + game.saltoY + game.abduccionY;
  actualizarVista(dt);

  // zombies, oleadas, objetos del mapa, granadas y recarga
  if (!(game.inShop && tipoPartida === 'solo')) actualizarMundo(dt);

  // emitir posicion del jugador local al servidor socket io
  // la direccion a la que miras yaw se calcula en orden yxz camera rotation y no sirve
  if (typeof window.emitirMovimiento === 'function') {
    eulerYaw.setFromQuaternion(camera.quaternion, 'YXZ');
    const banderas = (game.aiming ? 1 : 0) | (game.muerto ? 2 : 0);
    window.emitirMovimiento(camera.position.x, camera.position.y, camera.position.z, eulerYaw.y, banderas, eulerYaw.x);
  }

  // actualizar jugadores remotos interpolacion suave
  Object.values(jugadoresRemotos).forEach(jr => {
    if (!jr.mesh) return;
    // interpolacion lineal hacia la posicion recibida lerp
    const antes = jr.mesh.position.clone();
    jr.mesh.position.lerp(jr.targetPos, 0.15);
    // animar piernas segun cuanto se movio
    const mov = antes.distanceTo(jr.mesh.position);
    if (jr.partes) {
      jr.fase += mov * 6;
      const sw = mov > 0.002 ? Math.sin(jr.fase) * 0.6 : 0;
      jr.partes.piernaI.rotation.x = sw; jr.partes.piernaD.rotation.x = -sw;
    }
    // apuntando brazos al frente siguiendo hacia donde mira arriba abajo
    if (jr.partes) {
      const k = Math.min(1, dt * 12);
      const metaD = jr.muerto ? -0.2 : (jr.apunta ? -(Math.PI / 2 + jr.pitch) : -0.25);
      const metaI = jr.muerto ? -0.2 : (jr.apunta ? -(Math.PI / 2 + jr.pitch) + 0.15 : -0.2);
      jr.partes.brazoD.rotation.x += (metaD - jr.partes.brazoD.rotation.x) * k;
      jr.partes.brazoI.rotation.x += (metaI - jr.partes.brazoI.rotation.x) * k;
      jr.partes.brazoI.rotation.z = jr.apunta && !jr.muerto ? -0.35 : 0;   // la otra mano sostiene el arma
    }
    // derribado el cuerpo cae al piso hasta que reaparece
    if (jr.cuerpo) {
      const caida = jr.muerto ? -Math.PI / 2 : 0;
      jr.cuerpo.rotation.x += (caida - jr.cuerpo.rotation.x) * Math.min(1, dt * 7);
      jr.cuerpo.position.y = jr.muerto ? 0.16 : 0;
    }
    // el modelo mira hacia mas z y la camara hacia z por eso se suma pi
    if (!jr.muerto) jr.mesh.rotation.y += difAngulo(jr.targetRot + Math.PI, jr.mesh.rotation.y) * 0.2;
    // actualizar mixer del jugador remoto
    if (jr.mixer) jr.mixer.update(dt);
  });

  flickerT+=dt;
  if(flickerT>0.1){
    flickerT=0;
    accent1.intensity=CFG.accent1.intensity*(0.85+Math.random()*0.3);
    accent2.intensity=CFG.accent2.intensity*(0.85+Math.random()*0.3);
  }

  drawMinimap();
  renderer.render(scene,camera);
}

window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);
});

animate();

// bateria llena al empezar, y en el hospital la linterna empieza prendida porque no se ve nada
function prepararLinterna() {
  reiniciarBateria();
  if (ES_HOSPITAL) alternarLinterna(true);
}
