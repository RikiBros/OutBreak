'use strict';
// datos del juego, mapas, estado de la partida, iconos, objetos y textos de la historia

// corre una funcion cuando la pagina ya esta lista
function alCargar(fn) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
  else fn();
}

// colores y luces de cada mapa
const MAP_CONFIGS = {
  'CIUDAD DEVASTADA': {
    fogColor:0x1c110c, fogDensity:0.022,
    bgColor:0x150c09,
    ambient:{ color:0x6a5550, intensity:0.85 },
    sun:{ color:0xff9a66, intensity:0.55 },          // resplandor de los incendios en el cielo
    fill:{ color:0x5a6a99, intensity:0.32 },          // luz de luna fria
    accent1:{ color:0xff6a1a, intensity:3.2, dist:22 },
    accent2:{ color:0xff7a22, intensity:2.8, dist:20 },
    floorColor:0x2a0c08, wallColor:0x1a0504, ruinColor:0x2d1008,
    ruinCount:0, enemyBodyColor:0x4a2010, enemyEyeColor:0xff0000,
    glbPath:null,
  },

  'HOSPITAL INFECTADO': {
    fogColor:0x020d03, fogDensity:0.035,
    bgColor:0x020d03,
    ambient:{ color:0x1a4a1a, intensity:1.8 },
    sun:{ color:0x00AA44, intensity:1.5 },
    fill:{ color:0x44FF88, intensity:0.6 },
    accent1:{ color:0x00FF44, intensity:3, dist:22 },
    accent2:{ color:0x88FF00, intensity:2, dist:16 },
    floorColor:0x081a09, wallColor:0x050f05, ruinColor:0x0a1f0a,
    ruinCount:12, enemySpeed:3.0, enemyBodyColor:0x1a3d1a, enemyEyeColor:0x00ff44,
    startWaveEnemies:8, glbPath:null,
  },
};

// variables de sesion y mapa
const urlParams   = new URLSearchParams(window.location.search);
const mapName     = urlParams.get('map') || 'CIUDAD DEVASTADA';
const CFG         = MAP_CONFIGS[mapName] || MAP_CONFIGS['CIUDAD DEVASTADA'];
const savedCfg    = JSON.parse(localStorage.getItem('outbreak_config') || '{}');
let   sensMouse   = Math.pow(2.5, ((savedCfg.sensitivity ?? 50) - 50) / 50);   // 1 es lo normal
let   invertirY   = !!savedCfg.invertY;
const SHADOWS     = savedCfg.shadows !== false;
let   usuario     = null; // se llena cuando se revisa la sesion

// estado del juego
// estado de una partida tambien se usa para reiniciar
function estadoInicial() {
  return {
    paused:false, over:false,
    wave:1, score:0, kills:0,
    health:100, maxHealth:100,
    shield:0,                 // escudo absorbe daño antes que la vida
    ammo:20, maxAmmo:20,      // 20 balas por cargador
    reloading:false, reloadTime:0,
    items:[0, 1, 1, 0],       // escudo, granada paralizante, bebida de estamina, botiquin
    linternaOn:false,         // la linterna se prende y apaga con la tecla f
    disparando:false, fireTimer:0,               // disparo automatico
    waveActive:false, waveTime:0, spawnTimer:0,
    // economia y tienda
    cash:0,
    intermission:false, interTime:0, inShop:false,
    mejoras:{ cargador:0, auto:0, escopeta:0 },
    arma:'pistola', cartuchos:0, escopetaCD:0,    // escopeta se compra en la tienda
    saltoY:0, saltoV:0,                           // salto con espacio
    abduccionY:0,                                 // el helicoptero te eleva al final
    aiming:false,             // clic derecho presionado
    zonaT:0, tramoZona:0, zonaAviso:-1,   // modo por honor tiempo en la zona, minuto actual, ultimo aviso
    muerto:false, respawnT:0, inmuneT:0, muertes:0,   // reaparecer supervivencia
    lentoT:0,                 // ralentizado por disparo de otro jugador
    listo:false,              // en linea ya presiono listo
    briefingAuto:false,       // en linea el briefing cuenta solo y no suelta el mouse
    stamina:100, staminaPausa:0, agotado:false,   // correr con shift
    briefing:false, briefT:0,                     // pantalla antes de cada oleada
  };
}
const game = Object.assign({ started:false, roomName:'', gameMode:'survival', ayudaTiendaVista:false }, estadoInicial());

// iconos svg dibujados, sin emojis
const svgIco = (trazos, relleno) =>
  `<svg viewBox="0 0 24 24" fill="${relleno ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${trazos}</svg>`;
const ICONOS = {
  botiquin:   svgIco('<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M12 10.5v6M9 13.5h6"/>'),
  escudo:     svgIco('<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  granada:    svgIco('<circle cx="11" cy="14.5" r="6"/><path d="M9 8.8V6.5h4v2.3"/><path d="M13 6.5l3-2.5 2.5 2"/><path d="M8.5 12.5h5M8.5 16.5h5" opacity=".5"/>'),
  linterna:   svgIco('<path d="M7 3h10l-2 6H9z"/><rect x="9" y="9" width="6" height="12" rx="1"/><path d="M12 13v2.5"/>'),
  bateria:    svgIco('<rect x="7" y="4" width="10" height="17" rx="1.5"/><path d="M10 2h4v2"/><path d="M13 8l-3 5h4l-3 5"/>'),
  vida:       svgIco('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', true),
  estamina:   svgIco('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', true),
  dinero:     svgIco('<circle cx="12" cy="12" r="9"/><path d="M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2M12 16v2"/>'),
  dano:       svgIco('<path d="M12 2c2 2 3 4.5 3 7v8H9V9c0-2.5 1-5 3-7z"/><path d="M8 17h8v4H8z"/>'),
  resistencia:svgIco('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M12 9v6M9 12h6"/>'),
  cargador:   svgIco('<path d="M8 3h8v4H8z"/><path d="M7 7h10l-1 14H8z"/><path d="M10 11h4M10 14h4M10 17h4"/>'),
  automatico: svgIco('<path d="M2 9h14l2-2h4v4h-3l-2 2H9l-1.5 5H4l1.5-5H2z"/><path d="M19 15l2 1.5M16 16l1 2"/>'),
  escopeta:   svgIco('<path d="M2 9h17M2 11.5h17"/><path d="M19 8v5h3"/><path d="M11 11.5l-3 7H5l2-7"/><path d="M13 11.5v2h4v-2"/>'),
  cartuchos:  svgIco('<rect x="4" y="6" width="4.5" height="13" rx="1"/><rect x="9.75" y="6" width="4.5" height="13" rx="1"/><rect x="15.5" y="6" width="4.5" height="13" rx="1"/><path d="M4 15h4.5M9.75 15h4.5M15.5 15h4.5"/>'),
  adrenalina: svgIco('<circle cx="12" cy="12" r="9"/><path d="M13 5.5L8 13h4l-1 5.5 5-7.5h-4z"/>'),
};

// objetos del inventario y su tecla
const OBJETOS = [
  { id:'escudo',   tecla:'1', nombre:'ESCUDO',   fx:'+50 ESCUDO', color:'#4da3ff', desc:'Barra azul que recibe el daño antes que tu vida. Máximo 100.' },
  { id:'granada',  tecla:'2', nombre:'GRANADA',  fx:'PARALIZA',   color:'#4de8ff', desc:'No mata: deja inmóviles 5 s a los zombies cercanos.' },
  { id:'estamina', tecla:'3', nombre:'ESTAMINA', fx:'LLENA 100%', color:'#c8e04a', desc:'La estamina NO se recupera sola: esta bebida la llena.' },
  { id:'botiquin', tecla:'E', nombre:'BOTIQUÍN', fx:'+35 VIDA',   color:'#ff4d5a', desc:'Cura 35 de vida. La vida no se recupera sola.' },
  { id:'linterna', tecla:'F', nombre:'LINTERNA', fx:'PRENDER',    color:'#ffd95a', desc:'Se prende y apaga cuando quieras.', herramienta:true },
];

// todos los controles del juego
const CONTROLES = [
  ['W A S D', 'Moverse'],
  ['SHIFT', 'Correr (gasta estamina)'],
  ['ESPACIO', 'Saltar'],
  ['Q / RUEDA', 'Cambiar de arma'],
  ['CLIC DER.', 'Apuntar (mantener)'],
  ['CLIC IZQ.', 'Disparar (solo apuntando)'],
  ['R', 'Recargar (tarda 5 s)'],
  ['1', 'Usar escudo'],
  ['2', 'Lanzar granada paralizante'],
  ['3', 'Tomar bebida de estamina'],
  ['E', 'Usar botiquín (+35 vida)'],
  ['F', 'Prender / apagar linterna'],
  ['B', 'Tienda (entre oleadas)'],
  ['ESC', 'Pausa'],
  ['ENTER', 'Comenzar oleada'],
];

function pintarIconos(raiz = document) {
  raiz.querySelectorAll('[data-ico]').forEach(el => { el.innerHTML = ICONOS[el.dataset.ico] || ''; });
}

function renderControles() {
  const lista = new URLSearchParams(location.search).get('modo') === 'zona' ? CONTROLES.filter(([k]) => !['Q / RUEDA', 'B', 'ENTER'].includes(k)) : CONTROLES;
  const html = lista.map(([k, t]) => `<div class="ctrl"><kbd>${k}</kbd><span>${t}</span></div>`).join('');
  document.querySelectorAll('.controles-grid').forEach(el => { el.innerHTML = html; });
}

function renderHotbar() {
  document.getElementById('hud-items').innerHTML = OBJETOS.map((o, i) => `
    <div class="item-wrap" id="item${i}-wrap">
      <div class="item-slot" onclick="useItem(${i})" style="color:${o.color}">
        <span class="item-key">${o.tecla}</span>
        <span class="ico">${ICONOS[o.id]}</span>
        <span class="item-count" id="item${i}-count">${o.herramienta ? 'OFF' : '0'}</span>
      </div>
      <div class="item-name">${o.nombre}</div>
      <div class="item-fx">${o.fx}</div>
    </div>`).join('');
}

pintarIconos();
renderControles();
renderHotbar();

// historia de cada modo, se muestra antes de desplegar
const INTROS = {
  survival: {
    solo: [
      'Día 3 del brote. El virus R-72 convirtió la ciudad en un cementerio.\nEres el ÚNICO SOBREVIVIENTE de {LUGAR}.\nPor fin alguien respondió la radio: un helicóptero de rescate viene por ti. Solo tienes que seguir vivo hasta que llegue.',
      'OBJETIVO: resiste 3 oleadas de un minuto hasta que llegue el helicóptero.\nEntre oleadas, el Chatarrero te vende objetos con el dinero que ganas por cada infectado.\nBajas, tiros a la cabeza y granadas suman puntos.',
    ],
    online: [
      'Día 3 del brote. El virus R-72 convirtió la ciudad en un cementerio.\nUstedes son un GRUPO DE SOBREVIVIENTES atrapados en {LUGAR}.\nPor fin alguien respondió la radio: un helicóptero de rescate viene por el grupo. Tienen que seguir vivos hasta que llegue.',
      'OBJETIVO: resistan 3 oleadas de un minuto. Todos enfrentan a la misma horda.\nEntre oleadas compren en la tienda del Chatarrero y presionen LISTO.\nGana quien haga más puntos: bajas, tiros a la cabeza y granadas.',
    ],
  },
  zona: {
    solo: [
      'Día 3 del brote. Te mordieron.\nEres el ÚNICO SOBREVIVIENTE de {LUGAR} y ya nadie vendrá por ti.\nEl virus te deja 3 minutos antes de convertirte. No hay rescate: solo queda decidir cómo caer.',
      'OBJETIVO: pelea por honor dentro de la zona marcada. Solo cuenta lo que hagas ahí.\nLa zona empieza enorme, se encoge con el tiempo y cambia de lugar cada 25 segundos.\nNo hay tienda: los objetos aparecen al azar en el mapa.',
    ],
    online: [
      'Día 3 del brote. A todos los mordieron.\nUstedes son un GRUPO DE SOBREVIVIENTES de {LUGAR} y ya nadie vendrá por ustedes.\nEl virus les deja 3 minutos antes de convertirse. No hay rescate: solo honor.',
      'OBJETIVO: demuestra quién cae con más honor. Solo cuenta lo que hagas dentro de la zona.\nLa zona se encoge y cambia de lugar cada 25 segundos; al final apenas caben dos.\nNo hay tienda: los objetos del mapa son para todos y el primero que llega se los queda.',
    ],
  },
};

// tienda habilidades permanentes y suministros
// precio de cada nivel, el primero es el nivel 1
// tienda del chatarrero todo lo que se compra aparece en el mapa
// el precio es el de dificil, en estandar se cobra menos
const TIENDA = [
  { id:'escudo',     tipo:'OBJETO', icon:'escudo',     nombre:'ESCUDO',                desc:'Absorbe 50 de daño antes que tu vida. Se usa con la tecla 1.',                 precio:20 },
  { id:'granada',    tipo:'OBJETO', icon:'granada',    nombre:'GRANADA PARALIZANTE',   desc:'No mata: deja inmóviles 5 s a los zombies cercanos. Tecla 2.',                 precio:20 },
  { id:'botiquin',   tipo:'OBJETO', icon:'botiquin',   nombre:'BOTIQUÍN',              desc:'Cura 35 de vida. La vida no se recupera sola. Tecla E.',                     precio:18 },
  { id:'estamina',   tipo:'OBJETO', icon:'estamina',   nombre:'BEBIDA DE ESTAMINA',    desc:'Llena tu estamina al 100%. La estamina no se recupera sola. Tecla 3.',         precio:12 },
  { id:'cargador',   tipo:'MEJORA', icon:'cargador',   nombre:'MÁS CAPACIDAD DE BALAS', desc:'+10 balas por cargador. Permanente, se activa al recogerla.',                 precio:[30, 60] },
  { id:'automatico', tipo:'MEJORA', icon:'automatico', nombre:'DISPARO AUTOMÁTICO',    desc:'Pistola: mantén clic izquierdo para disparar sin parar. Permanente.',           precio:[60] },
  { id:'escopeta',   tipo:'MEJORA', icon:'escopeta',   nombre:'ESCOPETA',              desc:'Abanico de perdigones: le pega a varios zombies. 1 s entre disparos. Cambia de arma con Q. Trae 6 cartuchos.', precio:[50] },
  { id:'cartuchos',  tipo:'OBJETO', icon:'cartuchos',  nombre:'CARTUCHOS',             desc:'+8 cartuchos para la escopeta. Sus balas no son ilimitadas.',                 precio:15 },
];
function precioDe(item, nivel = 0) {
  const base = Array.isArray(item.precio) ? item.precio[nivel] : item.precio;
  return Math.max(1, Math.round(base * DIF.precioMult));
}
const FRASES_CHATARRERO = [
  '"Todo lo saqué de los escombros. No preguntes de quién era."',
  '"Paga primero. Los muertos no regresan a cobrar... bueno, casi nunca."',
  '"Sigues vivo. Eso es bueno para el negocio."',
  '"Si mueres, me quedo con tu chatarra. Sin rencores."',
];
const DESCANSO_SEG = 20;      // duracion del descanso entre oleadas
