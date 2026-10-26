// elegir mapa, modo y dificultad para jugar solo

// mapas
// ordenados de mas facil a mas dificil, las coordenadas son del centro de monterrey
// el helipuerto esta en la azotea de una torre justo arriba de la ciudad devastada
// el hospital esta mas al poniente, la altitud es sobre el nivel del mar
const maps = [
  {
    name: "HELIPUERTO",
    desc: "Plataforma redonda en la azotea de una torre del centro, a más de 100 m sobre la calle.<br>No hay dónde cubrirse, pero los infectados solo llegan trepando por la orilla y los ves venir.",
    threat: "ALTO",
    image: "media/preview_helipuerto.jpg",
    lat: "25.6694° N", lng: "100.3099° W", alt: "645m", sector: "AZOTEA · TORRE CENTRO"
  },
  {
    name: "CIUDAD DEVASTADA",
    desc: "Las calles al pie de la torre: autos quemados, un autobús chocado y barricadas militares.<br>Hay edificios en ruinas para cubrirte y un muro de fuego cierra la zona.",
    threat: "CRÍTICO",
    image: "media/preview_ciudad.jpg",
    lat: "25.6716° N", lng: "100.3092° W", alt: "538m", sector: "CENTRO · NIVEL DE CALLE"
  },
  {
    name: "HOSPITAL INFECTADO",
    desc: "El tercer piso del hospital, sin luz: pasillos, cuartos, quirófano, farmacia y morgue.<br>Solo ves lo que alumbra tu linterna, y la batería se acaba.",
    threat: "EXTREMO",
    image: "media/preview_hospital.jpg",
    lat: "25.6887° N", lng: "100.3497° W", alt: "552m", sector: "HOSPITAL · PISO 3"
  }
];

let current = 0;

function buildDots(){
  const d = document.getElementById('dots');
  d.innerHTML = maps.map((_,i)=>`<div class="dot${i===0?' active':''}" onclick="goTo(${i})"></div>`).join('');
}

function goTo(i){
  current = i;
  updateDisplay();
  document.querySelectorAll('.dot').forEach((d,idx)=>{
    d.classList.toggle('active', idx===i);
  });
}

function changeMap(dir){
  current = (current + dir + maps.length) % maps.length;
  goTo(current);
}

function updateDisplay(){
  const m = maps[current];
  document.getElementById('map-name').textContent = m.name;
  document.getElementById('map-desc').innerHTML = m.desc;
  document.getElementById('threat-level').textContent = m.threat;
  document.getElementById('hud-lat').textContent = m.lat;
  document.getElementById('hud-lng').textContent = m.lng;
  document.getElementById('hud-alt').textContent = m.alt;
  document.getElementById('hud-sector').textContent = m.sector;

  const displayContainer = document.getElementById('map-display');
  displayContainer.innerHTML = `<img src="${m.image}" alt="${m.name}" onerror="this.style.display='none';">`
    + `<div class="map-tag">${String(current + 1).padStart(2, '0')} / ${String(maps.length).padStart(2, '0')}  ·  ${m.sector}</div>`;
}

// segundo paso, elegir modo de juego
let modoElegido = 'survival';

function abrirModos() {
  document.getElementById('mode-map-name').textContent = maps[current].name;
  document.getElementById('mode-modal').classList.add('open');
}
function cerrarModos() {
  document.getElementById('mode-modal').classList.remove('open');
}
let difElegida = 'estandar';
function elegirDif(d) {
  difElegida = d;
  document.getElementById('dif-estandar').classList.toggle('selected', d === 'estandar');
  document.getElementById('dif-dificil').classList.toggle('selected',  d === 'dificil');
}
function elegirModo(modo) {
  modoElegido = modo;
  document.getElementById('mode-survival').classList.toggle('selected', modo === 'survival');
  document.getElementById('mode-zona').classList.toggle('selected',     modo === 'zona');
  pintarDificultades();
}

// la explicacion de cada dificultad depende del modo elegido
const INFO_DIF = {
  survival: {
    estandar: [
      'Un tipo de zombie por oleada: caminantes → corredores → tanques',
      'Los zombies hacen <b>40% menos daño</b>',
      'Tienda <b>30% más barata</b>',
      'Empiezas con <b>1 granada, 1 bebida de estamina y 1 botiquín</b>',
      'Estamina completa y velocidad normal',
    ],
    dificil: [
      'Los <b>3 tipos mezclados</b> en cada oleada y más zombies a la vez',
      'Zombies <b>20% más rápidos</b>, atacan más seguido y hacen <b>25% más daño</b>',
      'Tienda <b>40% más cara</b>',
      'Empiezas <b>sin objetos</b>',
      '<b>40% menos estamina</b> y te mueves <b>15% más lento</b>',
    ],
  },
  zona: {
    estandar: [
      'Cada minuto llega un tipo nuevo: <b>caminantes → corredores → tanques</b>',
      'Los zombies hacen <b>40% menos daño</b>',
      'Empiezas con <b>1 granada, 1 bebida de estamina y 1 botiquín</b>',
      'Sin tienda: los objetos aparecen al azar en el mapa',
      'Estamina completa y velocidad normal',
    ],
    dificil: [
      'Los <b>3 tipos desde el primer segundo</b> y cada minuto llegan más',
      'Zombies <b>20% más rápidos</b>, atacan más seguido y hacen <b>25% más daño</b>',
      'Empiezas <b>sin objetos</b>: todo lo tienes que encontrar en el mapa',
      '<b>40% menos estamina</b> y te mueves <b>15% más lento</b>: cuesta más llegar a la zona',
    ],
  },
};
function pintarDificultades() {
  ['estandar', 'dificil'].forEach(d => {
    document.getElementById('dif-list-' + d).innerHTML = INFO_DIF[modoElegido][d].map(t => '<li>' + t + '</li>').join('');
  });
}
pintarDificultades();
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarModos(); });

// logica de la pantalla de carga y redireccion
function iniciarPartida() {
  cerrarModos();
  const loader = document.getElementById('loading-screen');
  const bar = document.getElementById('loading-bar');
  const statusText = document.getElementById('loading-status');

  // mostrar pantalla de carga
  loader.style.display = 'flex';

  // forzar repintado para asegurar la transicion de opacidad
  void loader.offsetWidth;
  loader.classList.add('active');

  // iniciar animacion de la barra
  setTimeout(() => {
    bar.style.width = '100%';
  }, 100);

  // textos aleatorios para dar inmersion
  const loadingTexts = [
    "Descargando topografía local...",
    "Calculando densidad de hordas...",
    "Estableciendo enlace de audio táctico...",
    "Sincronizando coordenadas GPS...",
    "Preparando armamento...",
    "Despliegue inminente..."
  ];

  let textIndex = 0;
  const textInterval = setInterval(() => {
    if (textIndex < loadingTexts.length) {
      statusText.textContent = loadingTexts[textIndex];
      textIndex++;
    }
  }, 600); // cambia el texto cada 0 6 segundos

  // redirigir a juego html despues de 4 segundos
  setTimeout(() => {
    clearInterval(textInterval);
    // partida en solitario con el mapa, modo y dificultad
    window.location.href = 'juego.html?tipo=solo'
      + '&map='  + encodeURIComponent(maps[current].name)
      + '&modo=' + modoElegido
      + '&dif='  + difElegida;
  }, 4000);
}

// inicializacion del sistema
buildDots();
updateDisplay();
