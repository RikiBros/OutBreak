// tabla de puntuaciones, el ranking de todos y las tuyas

const SERVER = location.origin;
let tabActual  = 'global';
let mapaFiltro = '';
let usuario    = null;

// inicializar
window.addEventListener('DOMContentLoaded', () => {
  const raw = localStorage.getItem('usuario_actual');
  if (raw) {
    try { usuario = JSON.parse(raw); } catch { usuario = null; }
  }
  cargarDatos();
});

// cambiar tab
function switchTab(tab) {
  tabActual = tab;
  const esGlobal = tab === 'global';

  document.getElementById('tab-global-btn').classList.toggle('active',   esGlobal);
  document.getElementById('tab-personal-btn').classList.toggle('active', !esGlobal);
  document.getElementById('filter-bar').style.display          = esGlobal ? 'flex' : 'none';
  document.getElementById('personal-header-box').style.display = esGlobal ? 'none' : 'flex';

  // actualizar cabecera de la tabla
  document.getElementById('table-head').innerHTML = esGlobal
    ? '<th>#</th><th>OPERATIVO</th><th>PUNTOS</th><th>OLEADA</th><th>BAJAS</th><th>MAPA</th><th>FECHA</th>'
    : '<th>#</th><th>PUNTOS</th><th>OLEADA</th><th>BAJAS</th><th>MAPA</th><th>MODO</th><th>FECHA</th>';

  cargarDatos();
}

// filtrar por mapa
function filtrarMapa(mapa) {
  mapaFiltro = mapa;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  const ids = { '':'f-all','CIUDAD DEVASTADA':'f-ciudad','HOSPITAL INFECTADO':'f-hospital','AEROPUERTO CAÍDO':'f-aero' };
  const el = document.getElementById(ids[mapa]);
  if (el) el.classList.add('active');
  cargarDatos();
}

// cargar datos
async function cargarDatos() {
  mostrarCargando();

  if (tabActual === 'global') {
    await cargarGlobal();
  } else {
    await cargarPersonal();
  }
}

async function cargarGlobal() {
  try {
    const url = SERVER + '/ranking' + (mapaFiltro ? '?mapa=' + encodeURIComponent(mapaFiltro) : '');
    const res  = await fetch(url);
    if (!res.ok) throw new Error('Error del servidor');
    const rows = await res.json();
    renderGlobal(rows);
  } catch {
    // fallback leer localstorage
    const local = JSON.parse(localStorage.getItem('outbreak_scores') || '[]');
    if (local.length) {
      const filtrados = mapaFiltro ? local.filter(r => r.mapa === mapaFiltro) : local;
      const ordenados = filtrados.sort((a,b) => b.puntos - a.puntos).slice(0,20);
      renderGlobal(ordenados.map(r => ({
        Username   : r.usuario,
        Puntos     : r.puntos,
        Oleada     : r.oleada,
        Bajas      : r.bajas,
        Mapa       : r.mapa,
        Fecha      : r.fecha,
      })));
    } else {
      mostrarVacio('Sin conexión al servidor.<br>Juega una partida para ver registros.');
    }
  }
}

async function cargarPersonal() {
  if (!usuario) {
    mostrarVacio('Inicia sesión para ver tus puntuaciones personales.');
    return;
  }

  const nombreUsuario = usuario.username || usuario.Username || '---';
  document.getElementById('ph-username').textContent = nombreUsuario;

  // siempre leer localstorage primero tiene datos inmediatos
  const localRaw = JSON.parse(localStorage.getItem('outbreak_scores') || '[]');
  const localFiltrado = localRaw
    .filter(r => r.usuario === nombreUsuario)
    .sort((a,b) => b.puntos - a.puntos)
    .slice(0, 10);

  // mostrar localstorage de inmediato mientras carga el servidor
  if (localFiltrado.length > 0) {
    document.getElementById('ph-partidas').textContent = localFiltrado.length;
    const totalLocal = localFiltrado.reduce((s,r) => s + (r.puntos||0), 0);
    document.getElementById('ph-puntos').textContent = totalLocal.toLocaleString();
    renderPersonal(localFiltrado.map(r => ({
      Puntos: r.puntos, Oleada: r.oleada, Bajas: r.bajas,
      Mapa: r.mapa, Modo: r.modo || 'survival', Fecha: r.fecha
    })));
  }

  // luego intentar el servidor para datos mas completos actualizados
  const uid = usuario.id || usuario.ID_Usuario;
  if (!uid) return;

  try {
    const res  = await fetch(SERVER + '/mis_puntuaciones/' + uid);
    if (!res.ok) throw new Error('Error servidor');
    const rows = await res.json();

    if (rows.length > 0) {
      // datos del servidor disponibles mostrarlos y actualizar stats
      // refrescar perfil desde servidor para tener totales correctos
      const perfil = await fetch(SERVER + '/perfil/' + uid).then(r=>r.json()).catch(()=>null);
      if (perfil) {
        document.getElementById('ph-partidas').textContent = perfil.Partidas || rows.length;
        document.getElementById('ph-puntos').textContent   = (perfil.Puntos  || 0).toLocaleString();
      }
      renderPersonal(rows);
    } else if (localFiltrado.length === 0) {
      mostrarVacio('Sin partidas registradas todavía.<br>¡Entra a la zona y sobrevive!');
    }
    // si servidor dice 0 pero localstorage tiene datos, ya los mostramos arriba
  } catch {
    // servidor offline ya mostramos localstorage arriba
    if (localFiltrado.length === 0) {
      mostrarVacio('Servidor offline.<br>Las partidas se guardan cuando el servidor esté disponible.');
    }
  }
}

// render tablas
function renderGlobal(rows) {
  const tbody = document.getElementById('scores-body');
  if (!rows.length) { mostrarVacio('Sin registros para este filtro.'); return; }

  tbody.innerHTML = rows.map((r, i) => {
    const pos   = i + 1;
    const cls   = pos===1?'gold':pos===2?'silver':pos===3?'bronze':'';
    const fecha = r.Fecha ? new Date(r.Fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '---';
    return `<tr>
      <td><span class="rank-pos ${cls}">${pos}</span></td>
      <td class="username-cell">${r.Username || '---'}</td>
      <td class="points-cell">${(r.Puntos||0).toLocaleString()}</td>
      <td>${r.Oleada || 1}</td>
      <td>${r.Bajas || 0}</td>
      <td><span class="mapa-badge">${(r.Mapa||'---').split(' ')[0]}</span></td>
      <td style="font-size:11px;color:rgba(200,150,150,0.4)">${fecha}</td>
    </tr>`;
  }).join('');
}

function renderPersonal(rows) {
  const tbody = document.getElementById('scores-body');
  if (!rows.length) { mostrarVacio('Sin partidas registradas todavía.<br>¡Entra a la zona y sobrevive!'); return; }

  tbody.innerHTML = rows.map((r, i) => {
    const fecha = r.Fecha ? new Date(r.Fecha).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'}) : '---';
    return `<tr>
      <td><span class="rank-pos ${i===0?'gold':''}">${i+1}</span></td>
      <td class="points-cell">${(r.Puntos||0).toLocaleString()}</td>
      <td>${r.Oleada || 1}</td>
      <td>${r.Bajas || 0}</td>
      <td><span class="mapa-badge">${(r.Mapa||'---').split(' ')[0]}</span></td>
      <td style="font-size:11px;color:rgba(200,150,150,0.5)">${(r.Modo||'survival').toUpperCase()}</td>
      <td style="font-size:11px;color:rgba(200,150,150,0.4)">${fecha}</td>
    </tr>`;
  }).join('');
}

function mostrarCargando() {
  document.getElementById('scores-body').innerHTML =
    `<tr class="state-row"><td colspan="7"><div class="spinner"></div><br>CARGANDO REGISTROS...</td></tr>`;
}

function mostrarVacio(msg) {
  document.getElementById('scores-body').innerHTML =
    `<tr class="state-row"><td colspan="7"><br><br>${msg}</td></tr>`;
}
