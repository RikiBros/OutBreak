'use strict';
// lo que pasa en cada cuadro, zombies, oleadas, recarga

// mundo zombies, objetos, granadas, recarga y oleadas
// se llama cada cuadro desde animate
function actualizarMundo(dt) {
  // oleada en curso
  if (game.waveActive) {
    const ola = OLEADAS[game.wave - 1];
    game.waveTime -= dt;
    game.spawnTimer -= dt;
    const cfg = ola.tramos ? ola.tramos[tramoZona()] : ola;   // zona cada minuto cambia la horda
    if (esAutoridad() && game.spawnTimer <= 0 && enemies.length < cfg.maxVivos) {
      spawnZombie(cfg.mezcla);
      game.spawnTimer = cfg.intervalo;
    }
    const seg = Math.max(0, Math.ceil(game.waveTime));
    document.getElementById('wave-timer').textContent = Math.floor(seg / 60) + ':' + String(seg % 60).padStart(2, '0');
    // cuenta regresiva gigante en los ultimos 10 segundos
    const cd = document.getElementById('countdown');
    if (game.waveTime <= 10 && game.waveTime > 0) {
      const num = String(Math.ceil(game.waveTime));
      if (cd.textContent !== num) { cd.textContent = num; cd.classList.remove('pulso'); void cd.offsetWidth; cd.classList.add('pulso'); }
      cd.classList.add('visible');
    } else cd.classList.remove('visible');
    // ultima oleada la pantalla se va poniendo blanca llega el helicoptero
    // ultimos 5 segundos de la ultima oleada el helicoptero te alumbra y te eleva
    if (game.wave === TOTAL_OLEADAS) {
      const t = Math.max(0, Math.min(1, (5 - game.waveTime) / 5));
      document.getElementById('heli-white').style.opacity = t;
      document.getElementById('heli-text').style.opacity = t > 0.15 ? 1 : 0;
      game.abduccionY = ES_ZONA ? 0 : t * t * 18;     // por honor no hay helicoptero, solo oscuridad
      if (t > 0 && game.muerto && !ES_ZONA) reaparecer();
    }
    if (game.waveTime <= 0) terminarOleada();
  }

  // escopeta 1 s entre disparos
  if (game.escopetaCD > 0) {
    game.escopetaCD -= dt;
    if (game.arma === 'escopeta') document.getElementById('reload-text').textContent = game.escopetaCD > 0 ? 'BOMBEANDO...' : '';
    if (game.escopetaCD <= 0) updateHUD();
  }

  // recarga
  if (game.reloading) {
    game.reloadTime -= dt;
    document.getElementById('reload-fill').style.width = (1 - game.reloadTime / RECARGA_SEG) * 100 + '%';
    if (game.arma === 'pistola') document.getElementById('reload-text').textContent = 'RECARGANDO ' + Math.max(0, game.reloadTime).toFixed(1) + 's';
    if (game.reloadTime <= 0) {
      game.reloading = false;
      game.ammo = game.maxAmmo;
      document.getElementById('reload-bar').classList.remove('visible');
      showAlert('ARMA LISTA');
      updateHUD();
    }
  }

  // animaciones glb
  for (let i = 0; i < zombieMixers.length; i++) zombieMixers[i].update(dt);

  // zombies perseguir, atacar y animar
  const autoridad = esAutoridad();
  enemies.forEach(e => {
    // paralizado por granada no se mueve ni ataca
    if (e.paralizado > 0) {
      e.paralizado -= dt;
      if (e.paralizado <= 0) { tintarZombie(e, 0x000000); if (e.mixer) e.mixer.timeScale = 1; }
      return;
    }
    const alcance = e.tipoId === 'tanque' ? 1.9 : 1.4;
    // cada jugador calcula el daño que le hacen a el
    const dYo = Math.hypot(camera.position.x - e.mesh.position.x, camera.position.z - e.mesh.position.z);
    if (dYo <= alcance + 0.25 && !game.muerto) {
      e.attackTimer -= dt;
      if (e.attackTimer <= 0) { takeDamage(e.tipo.dano); e.attackTimer = e.tipo.golpeCada * DIF.zombieAtaque; }
    }
    if (!autoridad) {
      // seguir la posicion que manda el anfitrion suavizado
      if (e.netX !== undefined) {
        const k = Math.min(1, dt * 10);
        e.mesh.position.x += (e.netX - e.mesh.position.x) * k;
        e.mesh.position.z += (e.netZ - e.mesh.position.z) * k;
        e.mesh.rotation.y += difAngulo(e.netRot, e.mesh.rotation.y) * k;
      }
      const atac = !!e.netAtaca;
      if (atac !== e.atacando) { e.atacando = atac; setZombieAnim(e, atac ? ['attack', 'punch', 'bite'] : (e.tipoId === 'corredor' ? ['run', 'walk'] : ['walk'])); }
      animarHumanoide(e, dt);
      return;
    }
    // anfitrion perseguir al jugador mas cercano
    const obj = objetivoMasCercano(e.mesh.position);
    const dx = obj.x - e.mesh.position.x;
    const dz = obj.z - e.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    e.mesh.rotation.y = Math.atan2(dx, dz);
    if (dist > alcance) {
      // rodear obstaculos si el camino directo choca, probar otros angulos
      const r = 0.35 * e.tipo.escala;
      let ang = Math.atan2(dx, dz);
      e.desvioT = (e.desvioT || 0) - dt;
      if (e.desvioT > 0) ang += e.desvio;
      else if (puntoBloqueado(e.mesh.position.x + Math.sin(ang) * 1.2, e.mesh.position.z + Math.cos(ang) * 1.2, r)) {
        for (const off of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8, 2.5, -2.5]) {
          if (!puntoBloqueado(e.mesh.position.x + Math.sin(ang + off) * 1.2, e.mesh.position.z + Math.cos(ang + off) * 1.2, r)) {
            e.desvio = off; e.desvioT = 0.6; ang += off; break;
          }
        }
      }
      e.mesh.position.x += Math.sin(ang) * e.speed * dt;
      e.mesh.position.z += Math.cos(ang) * e.speed * dt;
      resolverColision(e.mesh.position, r);
      e.mesh.rotation.y = ang;
      if (e.atacando) { e.atacando = false; setZombieAnim(e, e.tipoId === 'corredor' ? ['run', 'walk'] : ['walk']); }
    } else {
      if (!e.atacando) { e.atacando = true; setZombieAnim(e, ['attack', 'punch', 'bite']); }
    }
    animarHumanoide(e, dt);
  });

  // separar zombies para que no se encimen
  for (let i = 0; autoridad && i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i].mesh.position, b = enemies[j].mesh.position;
      const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz);
      const min = 0.4 * (enemies[i].tipo.escala + enemies[j].tipo.escala);
      if (d > 0.001 && d < min) {
        const empuje = (min - d) / 2 / d;
        a.x += dx * empuje; a.z += dz * empuje; b.x -= dx * empuje; b.z -= dz * empuje;
      }
    }
  }

  // zombies muriendo
  for (let i = muriendo.length - 1; i >= 0; i--) {
    const e = muriendo[i];
    e.tMuerte += dt;
    if (!e.mixer || !findClip(['death', 'die', 'dying'])) {
      e.cuerpo.rotation.x = -Math.min(1, e.tMuerte / 0.45) * Math.PI / 2;   // cae de espaldas
    }
    if (e.tMuerte > 1.3) e.mesh.position.y -= dt * 1.5;                      // se hunde
    if (e.tMuerte > 2.2) { quitarZombie(e); muriendo.splice(i, 1); }
  }

  if (ES_ZONA) actualizarZona(dt);
  actualizarPickups(dt);
  actualizarGranadas(dt);
  enviarZombies(dt);
  revisarZombiesRed(dt);
}
