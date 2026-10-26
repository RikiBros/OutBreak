'use strict';
// la informacion en pantalla, el radar, la pausa y el final de la partida

// hud
function updateHUD() {
  document.getElementById('health-fill').style.width=(game.health/game.maxHealth*100)+'%';
  document.getElementById('health-cur').textContent =Math.round(game.health);
  document.getElementById('health-max').textContent =game.maxHealth;
  document.getElementById('shield-wrap').style.display = game.shield > 0 ? 'grid' : 'none';
  document.getElementById('shield-fill').style.width = (game.shield / ESCUDO_MAX * 100) + '%';
  document.getElementById('shield-cur').textContent  = Math.round(game.shield);
  document.getElementById('cash-val').textContent   ='$' + game.cash.toLocaleString();
  if (ES_ZONA) {
    document.getElementById('wave-label').textContent = 'MINUTO';
    document.getElementById('wave-num').textContent   = (game.tramoZona + 1) + '/3';
  } else {
    document.getElementById('wave-num').textContent   = game.wave + '/' + TOTAL_OLEADAS;
  }
  document.getElementById('score-val').textContent  =game.score.toLocaleString();
  const av = document.getElementById('ammo-val');
  document.getElementById('ammo-label').textContent = (game.arma === 'escopeta' ? 'ESCOPETA' : 'PISTOLA') + (game.mejoras.escopeta ? '  ·  Q CAMBIAR' : '');
  if (game.arma === 'escopeta') {
    av.innerHTML = `${game.cartuchos}<small> CARTUCHOS</small>`;
    av.classList.toggle('bajo', game.cartuchos <= 2);
    if (game.escopetaCD <= 0) document.getElementById('reload-text').textContent = game.cartuchos === 0 ? 'COMPRA CARTUCHOS' : '';
  } else {
    av.innerHTML = `${game.ammo}<small>/ ${game.maxAmmo}</small>`;
    av.classList.toggle('bajo', game.ammo <= 5);
    if (!game.reloading) document.getElementById('reload-text').textContent = game.ammo === 0 ? 'PRESIONA R' : '';
  }
  [0,1,2,3].forEach(i => {
    document.getElementById('item'+i+'-count').textContent = game.items[i];
    document.getElementById('item'+i+'-wrap').classList.toggle('empty', game.items[i] <= 0);
  });
  document.getElementById('item4-count').textContent = game.linternaOn ? 'ON' : 'OFF';
  document.getElementById('item4-wrap').classList.toggle('on', game.linternaOn);
  document.getElementById('p-wave').textContent=String(game.wave).padStart(2,'0');
  document.getElementById('p-kills').textContent=game.kills;
  document.getElementById('p-score').textContent=game.score.toLocaleString();
}

function showWaveAlert(){
  const el=document.getElementById('wave-alert');
  el.textContent=`OLEADA ${game.wave} DE ${TOTAL_OLEADAS} — RESISTE 60 SEGUNDOS`;
  el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),3000);
}

function showAlert(msg){
  const el=document.getElementById('wave-alert');
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(showAlert._t);
  showAlert._t = setTimeout(()=>el.classList.remove('show'),1800);
}

// minimapa
function drawMinimap(){
  const c=document.getElementById('minimapCanvas');
  const ctx=c.getContext('2d');
  const W=c.width,H=c.height,S=W/80;
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(0,0,W,H);
  // en el hospital el radar solo muestra lo que alumbras, sin linterna no se ve nada
  if (ES_HOSPITAL) {
    ctx.fillStyle='#000'; ctx.fillRect(0,0,W,H);
    if (!game.linternaOn) { flechaJugador(ctx, W/2, H/2, 1.1); return; }
    ctx.save(); ctx.beginPath(); ctx.arc(W/2, H/2, VISTA_HOSPITAL*S, 0, Math.PI*2); ctx.clip();
  }
  // en el helipuerto se dibuja la orilla de la plataforma
  if (RADIO_MAPA) {
    ctx.beginPath(); ctx.arc(W/2 - camera.position.x*S, H/2 - camera.position.z*S, RADIO_MAPA*S, 0, Math.PI*2);
    ctx.fillStyle='rgba(90,90,90,0.25)'; ctx.fill(); ctx.strokeStyle='#55ff88'; ctx.lineWidth=1.5; ctx.stroke();
  }
  const punto = (x, z, r, color, cuadro) => {
    const dx=(x-camera.position.x)*S+W/2, dz=(z-camera.position.z)*S+H/2;
    const px=Math.max(3,Math.min(W-3,dx)), pz=Math.max(3,Math.min(H-3,dz));   // los objetos lejanos se pegan al borde
    ctx.fillStyle=color;
    if (cuadro) ctx.fillRect(px-r,pz-r,r*2,r*2);
    else if (dx>=0&&dx<=W&&dz>=0&&dz<=H) { ctx.beginPath(); ctx.arc(dx,dz,r,0,Math.PI*2); ctx.fill(); }
  };
  // edificios y obstaculos
  ctx.fillStyle='rgba(120,90,80,0.45)';
  solidos.forEach(b => {
    const x0=(b.minX-camera.position.x)*S+W/2, z0=(b.minZ-camera.position.z)*S+H/2;
    ctx.fillRect(x0, z0, (b.maxX-b.minX)*S, (b.maxZ-b.minZ)*S);
  });
  enemies.forEach(e => punto(e.mesh.position.x, e.mesh.position.z, e.tipoId==='tanque'?4:2.5, e.tipoId==='corredor'?'#ff9933':'#ff6b6b'));
  pickups.forEach(p => punto(p.raiz.position.x, p.raiz.position.z, 3, '#'+PICKUPS[p.tipo].color.toString(16).padStart(6,'0'), true));
  if (ES_ZONA) {
    objetosZona.forEach(o => punto(o.raiz.position.x, o.raiz.position.z, 3.5, '#'+PICKUPS[o.tipo].color.toString(16).padStart(6,'0'), true));
    const zx=(ZONA_POS.x-camera.position.x)*S+W/2, zz=(ZONA_POS.z-camera.position.z)*S+H/2;
    ctx.beginPath(); ctx.arc(zx, zz, ZONA_RADIO*S, 0, Math.PI*2);
    ctx.strokeStyle = enZona() ? '#44ff88' : '#ff3344'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = enZona() ? 'rgba(68,255,136,0.12)' : 'rgba(255,51,68,0.12)'; ctx.fill();
    if (zonaVisual && zonaVisual.verSig) {
      const sx=(zonaVisual.sig.position.x-camera.position.x)*S+W/2, sz=(zonaVisual.sig.position.z-camera.position.z)*S+H/2;
      ctx.beginPath(); ctx.arc(sx, sz, zonaVisual.sigR*S, 0, Math.PI*2);
      ctx.setLineDash([4, 3]); ctx.strokeStyle = '#ffffff'; ctx.stroke(); ctx.setLineDash([]);
    }
  }
  if (ES_HOSPITAL) ctx.restore();
  // tu en el centro, con la flecha de hacia donde miras
  flechaJugador(ctx, W/2, H/2, 1.1);
}

// pausa game over
function pauseGame(){
  if (tipoPartida === 'online') {
    // solo cuenta si fue el jugador esc, no si cambio de ventana
    if (document.hasFocus()) noHayPausa();
    return;
  }
  game.paused=true; controls.unlock();
  Musica.atenuar(true);
  pararLatido();
  document.getElementById('pause-overlay').classList.add('visible');
}

window.resumeGame=function(){
  game.paused=false;
  Musica.atenuar(false);
  document.getElementById('pause-overlay').classList.remove('visible');
  controls.lock();
};

window.restartGame=function(){
  if (tipoPartida === 'online') return;   // en linea no se reinicia
  enemies.forEach(quitarZombie);  enemies.length = 0;
  muriendo.forEach(quitarZombie); muriendo.length = 0;
  pickups.forEach(p => scene.remove(p.raiz)); pickups.length = 0;
  granadas.forEach(g => scene.remove(g.mesh)); granadas.length = 0;
  Object.assign(game, estadoInicial());
  pararHelicoptero(0.3);
  pararLatido();
  Musica.atenuar(false);
  aplicarDificultadInicial();
  game.started = true;
  linterna.intensity = 0;
  prepararLinterna();
  camera.position.copy(INICIO_JUGADOR);
  modeloPistola.visible = true; modeloEscopeta.visible = false;
  ['intermission','shop-overlay','shop-help','reload-bar'].forEach(id => document.getElementById(id).classList.remove('visible'));
  document.getElementById('pause-overlay').classList.remove('visible');
  document.getElementById('gameover-overlay').classList.remove('visible');
  document.getElementById('wave-brief').classList.remove('visible');
  document.getElementById('fin-screen').classList.remove('visible');
  document.getElementById('heli-white').style.opacity = 0;
  document.getElementById('heli-text').style.opacity = 0;
  document.getElementById('countdown').classList.remove('visible');
  document.getElementById('respawn-overlay').classList.remove('visible');
  limpiarObjetosZona(); objetosZonaT = 0;
  if (zonaVisual) { calcularCentrosZona(); ZONA_POS.set(centrosZona[0].x, 0, centrosZona[0].z); ZONA_RADIO = ZONA_R_MAX; zonaVisual.sig.visible = zonaVisual.verSig = false; aplicarZonaVisual(); }
  document.body.classList.remove('fuera-zona');
  updateHUD();
  iniciarOleada();
};

// victoria sobreviviste las 3 oleadas si no, moriste
function triggerGameOver(victoria){
  if (game.over) return;
  game.over=true; game.paused=true; game.waveActive=false; game.muerto=false; controls.unlock();
  // se apaga la musica y suena el final que toca
  Musica.parar(ES_ZONA ? 4 : 2);
  pararHelicoptero(4);
  pararLatido();
  Musica.remate(!victoria ? 'derrota' : (ES_ZONA ? 'fin_honor' : 'victoria'));
  document.getElementById('respawn-overlay').classList.remove('visible');
  document.querySelector('#gameover-overlay h1').textContent = victoria ? 'SOBREVIVISTE' : 'YOU DIED';
  document.querySelector('#gameover-overlay h1').style.color = victoria ? '#ffcc44' : '';

  const entrada = {
    usuario : usuario?.username || 'Anonimo',
    puntos  : game.score,
    oleada  : game.wave,
    bajas   : game.kills,
    mapa    : mapName,
    sala    : game.roomName,
    fecha   : new Date().toISOString()
  };

  // 1 guardar en localstorage siempre, funciona offline
  const scores = JSON.parse(localStorage.getItem('outbreak_scores') || '[]');
  scores.push(entrada);
  localStorage.setItem('outbreak_scores', JSON.stringify(scores));

  // 2 guardar en el servidor mysql si hay sesion y servidor disponible
  const uid = usuario?.id || usuario?.ID_Usuario;
  if (uid) {
    fetch('/guardar_puntuacion', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        id_usuario: uid,
        mapa      : mapName,
        modo      : game.gameMode || 'survival',
        puntos    : game.score,
        oleada    : game.wave,
        bajas     : game.kills,
        sala      : game.roomName || ''
      })
    })
    .then(r => r.json())
    .then(d => console.log('Puntuacion guardada en servidor:', d.message))
    .catch(() => console.warn('Servidor offline — puntuacion guardada solo en localStorage'));
  }

  // solitario record personal de puntos en este mapa
  const goRecord = document.getElementById('go-record');
  if (tipoPartida === 'solo') {
    const clave  = 'outbreak_record_pts_' + mapName + '_' + DIF_ID + (ES_ZONA ? '_zona' : '');
    const previo = parseInt(localStorage.getItem(clave) || '0');
    const pts = game.score.toLocaleString();
    if (game.score > previo) {
      localStorage.setItem(clave, game.score);
      goRecord.textContent = previo > 0 ? `¡NUEVO RÉCORD! ${pts} PUNTOS (antes ${previo.toLocaleString()})` : `RÉCORD: ${pts} PUNTOS`;
    } else {
      goRecord.textContent = `RÉCORD: ${previo.toLocaleString()} PUNTOS`;
    }
  } else {
    // en linea esperar a los demas el resultado llega por socket io
    goRecord.textContent = '';
    document.getElementById('go-retry').style.display = 'none';
    document.getElementById('go-wait').style.display  = 'block';
    if (victoria) { if (typeof window.emitirTermino === 'function') window.emitirTermino(); }
    else          { if (typeof window.emitirMuerte  === 'function') window.emitirMuerte(); }
  }
  ['intermission','shop-overlay','reload-bar'].forEach(id => document.getElementById(id).classList.remove('visible'));
  game.inShop = false;
  document.body.classList.remove('fuera-zona');

  document.getElementById('countdown').classList.remove('visible');
  if (victoria) {
    // pantalla blanca del helicoptero a fin con el puntaje final
    document.getElementById('fin-score').textContent = game.score.toLocaleString();
    if (ES_ZONA) document.querySelector('#fin-screen .fin-l').textContent = 'CAÍSTE CON HONOR  ·  PUNTAJE FINAL';
    document.getElementById('fin-sub').textContent   = (ES_ZONA ? 'POR HONOR  ·  ' : 'RESISTE  ·  ') + `${game.kills} BAJAS  ·  ${game.muertes} MUERTES  ·  ${mapName}  ·  DIFICULTAD ${DIF.nombre}`;
    document.getElementById('fin-rec').textContent   = goRecord.textContent;
    document.getElementById('fin-retry').style.display = tipoPartida === 'online' ? 'none' : '';
    document.getElementById('fin-wait').style.display  = tipoPartida === 'online' ? 'block' : 'none';
    if (tipoPartida === 'online') {
      window._finVictoria = true;
      document.getElementById('fin-screen').classList.add('online');
      if (window._pintarTablaFin) window._pintarTablaFin(null);
    }
    setTimeout(() => { document.getElementById('fin-screen').classList.add('visible'); document.getElementById('heli-text').style.opacity = 0; }, 400);
    return;
  }
  document.getElementById('go-wave').textContent =String(game.wave).padStart(2,'0');
  document.getElementById('go-kills').textContent=game.kills;
  document.getElementById('go-score').textContent=game.score.toLocaleString();
  document.getElementById('gameover-overlay').classList.add('visible');
}
