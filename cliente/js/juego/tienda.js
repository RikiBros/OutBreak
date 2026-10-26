'use strict';
// descanso entre oleadas, tienda, daño al jugador, reaparecer y usar objetos

// descanso entre oleadas mas tienda
function iniciarDescanso() {
  if (game.over) return;
  game.intermission = true;
  game.interTime    = DESCANSO_SEG;
  document.getElementById('inter-title').textContent = `OLEADA ${game.wave} DE ${TOTAL_OLEADAS} SUPERADA`;
  document.getElementById('intermission').classList.add('visible');
  game.listo = false;
  // en el descanso suena la musica de la tienda
  Musica.tocar('tienda');
  if (tipoPartida === 'online') {
    document.getElementById('inter-sub-solo').style.display = 'none';
    document.getElementById('inter-listos').style.display = '';
    document.getElementById('inter-listos').textContent = 'B: TIENDA  ·  ENTER: ESTOY LISTO';
    showAlert('LA HORDA SE RETIRA — COMPRA (B) Y PRESIONA ENTER CUANDO ESTÉS LISTO');
  } else {
    showAlert('LA HORDA SE RETIRA — PRESIONA B PARA LA TIENDA');
  }
}

// en linea avisar que ya estas listo para la siguiente oleada
window.marcarListo = function() {
  if (!game.intermission || game.listo || game.over) return;
  game.listo = true;
  if (game.inShop) cerrarTienda();
  document.getElementById('inter-listos').textContent = 'ESPERANDO A LOS DEMÁS...';
  showAlert('LISTO — ESPERANDO A LOS DEMÁS');
  if (window.emitirListo) window.emitirListo('oleada' + game.wave);
};

window.iniciarSiguienteOleada = function() {
  if (!game.intermission || game.over) return;
  game.intermission = false;
  document.getElementById('intermission').classList.remove('visible');
  if (game.inShop) cerrarTienda(true);     // sin volver a capturar el mouse sigue el briefing
  game.wave++;
  iniciarOleada();
};

window.abrirTienda = function() {
  if (game.over || game.inShop) return;
  if (ES_ZONA) { showAlert('EN ESTE MODO NO HAY TIENDA: BUSCA OBJETOS EN EL MAPA'); return; }
  if (!game.intermission) return;
  // la primera vez se explican las reglas de la tienda
  if (!game.ayudaTiendaVista) { mostrarAyudaTienda(); return; }
  game.inShop = true;
  document.getElementById('shop-quote').textContent =
    FRASES_CHATARRERO[Math.floor(Math.random() * FRASES_CHATARRERO.length)];
  // en linea no se puede saltar el descanso es el mismo para todos
  const go = document.getElementById('shop-go');
  go.textContent   = tipoPartida === 'online' ? 'ESTOY LISTO' : 'SIGUIENTE OLEADA';
  go.onclick       = tipoPartida === 'online' ? () => marcarListo() : () => iniciarSiguienteOleada();
  renderTienda();
  document.getElementById('shop-overlay').classList.add('visible');
  controls.unlock();
};

function mostrarAyudaTienda() {
  game.inShop = true;                          // detiene el juego igual que la tienda
  document.getElementById('sh-list').innerHTML = TIENDA.map(t => `
    <div class="sh-row"><span class="ico" style="color:#c49bff">${ICONOS[t.icon]}</span>
      <div><b>${t.nombre}</b>${t.desc}</div></div>`).join('');
  document.getElementById('shop-help').classList.add('visible');
  controls.unlock();
}

window.cerrarAyudaTienda = function() {
  game.ayudaTiendaVista = true;
  game.inShop = false;
  document.getElementById('shop-help').classList.remove('visible');
  abrirTienda();
};

window.cerrarTienda = function(sinCapturar) {
  if (!game.inShop) return;
  game.inShop = false;
  document.getElementById('shop-overlay').classList.remove('visible');
  document.getElementById('shop-help').classList.remove('visible');
  if (!game.over && !sinCapturar) controls.lock();
};

// cuantos de ese tipo ya estan tirados en el mapa esperando a que los recojas
const enMapa = id => pickups.filter(p => p.tipo === id).length;

function renderTienda() {
  document.getElementById('shop-cash').textContent = '$' + game.cash.toLocaleString();
  document.getElementById('shop-items').innerHTML = TIENDA.map(t => {
    let costo, bloqueado = false, texto, barras = '';
    if (t.tipo === 'MEJORA') {
      const max   = t.precio.length;
      const nivel = game.mejoras[t.id === 'automatico' ? 'auto' : t.id] + enMapa(t.id);
      bloqueado = nivel >= max;
      costo = bloqueado ? 0 : precioDe(t, nivel);
      texto = bloqueado ? (enMapa(t.id) ? 'RECÓGELA EN EL MAPA' : 'YA LA TIENES') : '$' + costo;
      barras = t.precio.map((_, k) => `<span class="${k < nivel ? 'on' : ''}"></span>`).join('');
    } else {
      costo = precioDe(t);
      texto = '$' + costo;
    }
    return `<div class="shop-item">
      <div class="si-top"><span class="si-icon"><span class="ico">${ICONOS[t.icon]}</span></span>
        ${barras ? `<span class="si-lvl">${barras}</span>` : `<span class="si-tag">${t.tipo}</span>`}</div>
      <div class="si-name">${t.nombre}</div>
      <div class="si-desc">${t.desc}</div>
      <button ${bloqueado || game.cash < costo ? 'disabled' : ''} onclick="comprar('${t.id}')">${texto}</button>
    </div>`;
  }).join('');
}

// todo lo que compras aparece en algun punto del mapa
window.comprar = function(id) {
  const t = TIENDA.find(x => x.id === id);
  if (!t) return;
  let costo;
  if (t.tipo === 'MEJORA') {
    const nivel = game.mejoras[id === 'automatico' ? 'auto' : id] + enMapa(id);
    if (nivel >= t.precio.length) return;
    costo = precioDe(t, nivel);
  } else costo = precioDe(t);
  if (game.cash < costo) { Sonido.sfx('error'); return; }
  game.cash -= costo;
  Sonido.sfx('compra');
  soltarPickup(id);
  showAlert(t.nombre + ' SOLTADO EN EL MAPA');
  updateHUD(); renderTienda();
};

// recalcula los valores que dependen de las mejoras
function aplicarMejoras() {
  game.maxAmmo = 20 + 10 * game.mejoras.cargador;
}

// daño al jugador el escudo absorbe primero
function takeDamage(amount, directo) {
  if (game.over || game.muerto || game.inmuneT > 0) return;
  if (!directo && (game.abduccionY > 1 || game.saltoY > 0.9)) return;   // fuera del alcance de los zombies
  if (!directo) amount *= DIF.danoMult;  // en estandar los zombies hacen menos daño
  const f = document.getElementById('damage-flash');
  if (game.shield > 0) {
    const absorbe = Math.min(game.shield, amount);
    game.shield -= absorbe;
    amount -= absorbe;
    if (game.shield <= 0) showAlert('ESCUDO ROTO');
  }
  game.health = Math.max(0, game.health - amount);
  Sonido.sfx('dolor', 0.8);
  updateHUD();
  f.classList.add('hit'); setTimeout(() => f.classList.remove('hit'), 200);
  if (game.health <= 0) {
    // reapareces a los 5 s en ambos modos
    iniciarReaparicion();
  }
}

// reaparicion modo supervivencia 5 s de espera y 3 s de inmunidad
function iniciarReaparicion() {
  game.muerto = true;
  Sonido.sfx('caer');
  Musica.atenuar(true);
  game.respawnT = 5;
  game.muertes++;
  game.reloading = false;
  document.getElementById('reload-bar').classList.remove('visible');
  setApuntando(false);
  document.getElementById('respawn-overlay').classList.add('visible');
}

function reaparecer() {
  game.muerto = false;
  Sonido.sfx('reaparecer');
  Musica.atenuar(false);
  game.health = game.maxHealth;
  game.ammo = game.maxAmmo;
  game.inmuneT = 3;
  // aparecer en el punto de inicio o donde haya menos zombies cerca
  const opciones = [INICIO_JUGADOR, new THREE.Vector3(0, 1.7, -14), new THREE.Vector3(14, 1.7, 0), new THREE.Vector3(-14, 1.7, 0)]
    .filter(v => !puntoBloqueado(v.x, v.z, 0.6));
  let mejor = opciones[0] || INICIO_JUGADOR, menos = Infinity;
  opciones.forEach(v => {
    const cerca = enemies.filter(e => Math.hypot(e.mesh.position.x - v.x, e.mesh.position.z - v.z) < 10).length;
    if (cerca < menos) { menos = cerca; mejor = v; }
  });
  camera.position.copy(mejor);
  document.getElementById('respawn-overlay').classList.remove('visible');
  showAlert('REAPARECISTE — INMUNE 3 SEGUNDOS');
  updateHUD();
}

// disparos entre jugadores en linea
const PVP = () => tipoPartida === 'online';
function jugadorDe(obj) {
  for (const [id, jr] of Object.entries(jugadoresRemotos)) {
    let o = obj; while (o) { if (o === jr.mesh) return id; o = o.parent; }
  }
  return null;
}
function golpearJugador(socketId, dano) {
  const jr = jugadoresRemotos[socketId];
  if (!jr || jr.muerto) return;
  jr.mesh.traverse(n => { if (n.isMesh && n.material && n.material.emissive) { n.material.emissive.setHex(0x660000); setTimeout(() => n.material.emissive.setHex(0), 120); } });
  if (typeof window.emitirDisparoJugador === 'function') window.emitirDisparoJugador(socketId, Math.round(dano));
}
// llamado desde socket io cuando otro jugador te dispara
window._recibirDisparo = function(de, dano) {
  if (!game.started || game.over) return;
  takeDamage(dano, true);
  game.lentoT = 2.5;                    // te ralentiza 2 5 s
  showAlert('¡' + de + ' TE DISPARÓ! — RALENTIZADO');
};

// usar objetos, 1 escudo, 2 granada, 3 estamina, e botiquin y f linterna
window.useItem = function(i) {
  if (!game.started || game.over || game.paused || game.inShop || game.muerto) return;
  // la linterna se prende y apaga, gasta bateria
  if (i === 4) { alternarLinterna(); return; }
  const NOMBRES = ['ESCUDOS', 'GRANADAS', 'BEBIDAS DE ESTAMINA', 'BOTIQUINES'];
  if (game.items[i] <= 0) { Sonido.sfx('error'); showAlert('SIN ' + NOMBRES[i] + ' — CÓMPRALOS EN LA TIENDA (B)'); return; }
  if (i === 0 && game.shield >= ESCUDO_MAX) { showAlert('ESCUDO AL MÁXIMO'); return; }
  if (i === 2 && game.stamina >= DIF.staminaMax) { showAlert('TU ESTAMINA YA ESTÁ LLENA'); return; }
  if (i === 3 && game.health >= game.maxHealth)  { showAlert('TU VIDA YA ESTÁ LLENA'); return; }
  game.items[i]--;
  const slot = document.querySelector('#item' + i + '-wrap .item-slot');
  slot.classList.add('used'); setTimeout(() => slot.classList.remove('used'), 250);

  Sonido.sfx(['escudo', null, 'estamina', 'botiquin'][i]);
  if (i === 0) { game.shield = Math.min(ESCUDO_MAX, game.shield + 50); showAlert('+50 ESCUDO'); }
  if (i === 1) { lanzarGranada(); }
  if (i === 2) { game.stamina = DIF.staminaMax; game.agotado = false; showAlert('ESTAMINA AL 100%'); }
  if (i === 3) { game.health = Math.min(game.maxHealth, game.health + 35); showAlert('+35 VIDA'); }
  updateHUD();
};

// recarga con 5 segundos de espera
function reloadAmmo() {
  if (!game.started || game.over || game.reloading) return;
  if (game.arma === 'escopeta') { showAlert('LA ESCOPETA NO SE RECARGA: CADA DISPARO GASTA UN CARTUCHO'); return; }
  if (game.ammo >= game.maxAmmo) { showAlert('EL CARGADOR ESTÁ LLENO'); return; }
  game.reloading  = true;
  Sonido.sfx('recarga');
  game.reloadTime = RECARGA_SEG;
  document.getElementById('reload-bar').classList.add('visible');
  showAlert('RECARGANDO (' + RECARGA_SEG + 's)');
}
