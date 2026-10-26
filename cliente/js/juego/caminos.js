'use strict';
// caminos para los zombies dentro del hospital, asi rodean las paredes y entran por las puertas
// el piso se parte en cuadritos y se calcula que tan lejos esta cada cuadrito del jugador mas cercano
// cada zombie camina hacia el cuadrito vecino que este mas cerca

const CELDA = 0.5;
let CAMPO = null;
let caminosT = 0;

function prepararCaminos() {
  const n = Math.ceil((LIMITE * 2) / CELDA);
  const bloq = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = -LIMITE + (i + 0.5) * CELDA, z = -LIMITE + (j + 0.5) * CELDA;
      bloq[j * n + i] = puntoBloqueado(x, z, 0.3) ? 1 : 0;
    }
  }
  CAMPO = { n, bloq, dist: new Int32Array(n * n).fill(-1) };
}

function celdaDe(x, z) {
  const i = Math.floor((x + LIMITE) / CELDA), j = Math.floor((z + LIMITE) / CELDA);
  if (i < 0 || j < 0 || i >= CAMPO.n || j >= CAMPO.n) return -1;
  return j * CAMPO.n + i;
}

// se recalcula cada poco tiempo desde donde estan los jugadores
function actualizarCaminos(dt) {
  if (!ES_HOSPITAL || !esAutoridad()) return;
  if (!CAMPO) prepararCaminos();
  caminosT -= dt;
  if (caminosT > 0) return;
  caminosT = 0.35;
  const { n, bloq, dist } = CAMPO;
  dist.fill(-1);
  const cola = new Int32Array(n * n);
  let ini = 0, fin = 0;
  posicionesJugadores().forEach(p => {
    const c = celdaDe(p.x, p.z);
    if (c >= 0 && dist[c] < 0) { dist[c] = 0; cola[fin++] = c; }
  });
  while (ini < fin) {
    const c = cola[ini++], i = c % n, j = (c / n) | 0, d = dist[c] + 1;
    if (i > 0 && !bloq[c - 1] && dist[c - 1] < 0) { dist[c - 1] = d; cola[fin++] = c - 1; }
    if (i < n - 1 && !bloq[c + 1] && dist[c + 1] < 0) { dist[c + 1] = d; cola[fin++] = c + 1; }
    if (j > 0 && !bloq[c - n] && dist[c - n] < 0) { dist[c - n] = d; cola[fin++] = c - n; }
    if (j < n - 1 && !bloq[c + n] && dist[c + n] < 0) { dist[c + n] = d; cola[fin++] = c + n; }
  }
}

// hacia donde debe caminar un zombie, devuelve el angulo o null si no hay camino
function direccionCampo(pos) {
  if (!CAMPO) return null;
  const { n, bloq, dist } = CAMPO;
  const c = celdaDe(pos.x, pos.z);
  if (c < 0 || dist[c] <= 0) return null;
  const i = c % n, j = (c / n) | 0;
  let mejor = -1, dMin = dist[c];
  for (let dj = -1; dj <= 1; dj++) {
    for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
      const v = jj * n + ii;
      if (bloq[v] || dist[v] < 0) continue;
      // en diagonal solo si no se corta una esquina
      if (di && dj && (bloq[j * n + ii] || bloq[jj * n + i])) continue;
      if (dist[v] < dMin) { dMin = dist[v]; mejor = v; }
    }
  }
  if (mejor < 0) return null;
  const tx = -LIMITE + ((mejor % n) + 0.5) * CELDA, tz = -LIMITE + (((mejor / n) | 0) + 0.5) * CELDA;
  return Math.atan2(tx - pos.x, tz - pos.z);
}

// si hay una pared entre dos puntos, para que los zombies no peguen a traves de los muros
function hayPared(x1, z1, x2, z2) {
  if (!ES_HOSPITAL) return false;
  const pasos = 8;
  for (let k = 1; k < pasos; k++) {
    const t = k / pasos;
    if (puntoBloqueado(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, 0)) return true;
  }
  return false;
}
