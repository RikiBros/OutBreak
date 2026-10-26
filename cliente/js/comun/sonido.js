// efectos de sonido del juego, la musica esta en musica js
// si en audio efectos hay un archivo mp3 con el nombre del efecto se usa ese,
// si no, el sonido se genera con codigo
const Sonido = (function () {
  const RUTA_EFECTOS = 'audio/efectos/';
  let ctx = null;
  const buffers = {};       // efectos que vienen de un archivo, ya listos para sonar
  const crudos = {};        // archivos descargados que esperan a que exista el audio
  let maestro = null, busMusica = null, busEfectos = null;
  let ruidoBuf = null;
  let destinoTemp = null;   // para mandar un efecto hecho con codigo a un volumen propio
  let volMusica = 1, volEfectos = 0.45;

  // lee el volumen guardado en la configuracion
  function leerVolumen() {
    try {
      const c = JSON.parse(localStorage.getItem('outbreak_config') || '{}');
      volMusica = (c.musicVolume ?? 100) / 100;
      volEfectos = (c.sfxVolume ?? 45) / 100;
    } catch (e) {}
    aplicarVolumen();
  }

  function aplicarVolumen() {
    if (!ctx) return;
    busMusica.gain.setTargetAtTime(volMusica * 0.55, ctx.currentTime, 0.05);
    busEfectos.gain.setTargetAtTime(volEfectos, ctx.currentTime, 0.05);
  }

  // cambiar el volumen al momento, por ejemplo desde los sliders de configuracion
  function volumenes(musica, efectos) {
    volMusica = musica / 100;
    volEfectos = efectos / 100;
    aplicarVolumen();
  }

  // el audio se crea hasta que el jugador da clic o presiona una tecla, asi lo pide el navegador
  function iniciar() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    maestro = ctx.createGain();
    maestro.connect(comp).connect(ctx.destination);
    busMusica = ctx.createGain(); busMusica.connect(maestro);
    busEfectos = ctx.createGain(); busEfectos.connect(maestro);
    // ruido blanco que se reusa para disparos, pasos y explosiones
    ruidoBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = ruidoBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    Object.keys(crudos).forEach(n => { decodificar(n, crudos[n]); delete crudos[n]; });
    leerVolumen();
    return ctx;
  }

  // el servidor dice que archivos de audio hay, asi no se piden archivos que no existen
  const disponibles = fetch('/audio_disponible')
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
    .then(d => d || { musica: null, efectos: [] });   // musica null, el servidor no respondio y se intenta igual

  function decodificar(nombre, datos) {
    ctx.decodeAudioData(datos, b => { buffers[nombre] = b; }, () => console.warn('no se pudo leer el audio de ' + nombre));
  }

  // descarga los efectos propios que haya en la carpeta
  disponibles.then(d => d.efectos.forEach(nombre => {
    fetch(RUTA_EFECTOS + nombre + '.mp3')
      .then(r => (r.ok ? r.arrayBuffer() : null))
      .then(datos => { if (!datos) return; if (ctx) decodificar(nombre, datos); else crudos[nombre] = datos; })
      .catch(() => {});
  }));

  // toca un efecto que viene de archivo
  function tocarArchivo(nombre, v) {
    const src = ctx.createBufferSource();
    src.buffer = buffers[nombre];
    const g = ctx.createGain(); g.gain.value = v;
    src.connect(g).connect(busEfectos);
    src.start();
  }

  function despertar() {
    iniciar();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, despertar, true));

  // un tono con su envolvente, f2 hace que la nota se deslice
  function tono(o) {
    if (!ctx) return;
    const t = o.t ?? ctx.currentTime;
    const dur = o.dur ?? 0.2;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.tipo || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.desliza ?? dur));
    if (o.detune) osc.detune.value = o.detune;
    const vol = (o.vol ?? 0.3);
    const ataque = o.ataque ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + ataque);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let ultimo = osc;
    if (o.filtro) {
      const fl = ctx.createBiquadFilter();
      fl.type = o.filtro; fl.Q.value = o.q || 0.8;
      fl.frequency.setValueAtTime(o.frec || 1200, t);
      if (o.frec2) fl.frequency.exponentialRampToValueAtTime(o.frec2, t + dur);
      ultimo.connect(fl); ultimo = fl;
    }
    ultimo.connect(g).connect(o.destino || destinoTemp || busEfectos);
    osc.start(t); osc.stop(t + dur + 0.05);
    return osc;
  }

  // un golpe de ruido filtrado, sirve para disparos, platillos y explosiones
  function ruido(o) {
    if (!ctx) return;
    const t = o.t ?? ctx.currentTime;
    const dur = o.dur ?? 0.1;
    const src = ctx.createBufferSource();
    src.buffer = ruidoBuf;
    src.loop = true;
    const fl = ctx.createBiquadFilter();
    fl.type = o.filtro || 'lowpass'; fl.Q.value = o.q || 0.7;
    fl.frequency.setValueAtTime(o.frec || 2000, t);
    if (o.frec2) fl.frequency.exponentialRampToValueAtTime(o.frec2, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.vol ?? 0.3), t + (o.ataque ?? 0.003));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl).connect(g).connect(o.destino || destinoTemp || busEfectos);
    src.start(t, Math.random() * 1.5); src.stop(t + dur + 0.05);
  }

  // gruñido de zombie, tono grave que tiembla con un filtro de voz
  function grunido(t, v, grave) {
    const f = (grave ? 55 : 85) + Math.random() * 40;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.linearRampToValueAtTime(f * 0.7, t + 0.9);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 7 + Math.random() * 6;
    const lfoG = ctx.createGain(); lfoG.gain.value = f * 0.12;
    lfo.connect(lfoG).connect(osc.frequency);
    const voz = ctx.createBiquadFilter(); voz.type = 'bandpass'; voz.frequency.value = 450 + Math.random() * 300; voz.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    osc.connect(voz).connect(g).connect(busEfectos);
    osc.start(t); lfo.start(t); osc.stop(t + 1.05); lfo.stop(t + 1.05);
    ruido({ t, dur: 0.7, vol: 0.12 * v, filtro: 'bandpass', frec: 900, q: 2 });
  }

  // todos los efectos, cada uno recibe el tiempo y el volumen
  const EFECTOS = {
    clic(t, v) { tono({ t, f: 900, f2: 600, dur: 0.06, vol: 0.18 * v, tipo: 'square', filtro: 'lowpass', frec: 3000 }); },
    hover(t, v) { tono({ t, f: 1400, dur: 0.03, vol: 0.05 * v, tipo: 'triangle' }); },
    error(t, v) { tono({ t, f: 180, dur: 0.18, vol: 0.2 * v, tipo: 'square', filtro: 'lowpass', frec: 900 }); tono({ t: t + 0.12, f: 140, dur: 0.2, vol: 0.2 * v, tipo: 'square', filtro: 'lowpass', frec: 900 }); },
    pistola(t, v) {
      ruido({ t, dur: 0.12, vol: 0.55 * v, filtro: 'highpass', frec: 900 });
      ruido({ t, dur: 0.18, vol: 0.5 * v, filtro: 'lowpass', frec: 1800, frec2: 200 });
      tono({ t, f: 160, f2: 45, dur: 0.16, vol: 0.5 * v, tipo: 'sine' });
    },
    escopeta(t, v) {
      ruido({ t, dur: 0.35, vol: 0.7 * v, filtro: 'lowpass', frec: 3000, frec2: 150 });
      ruido({ t, dur: 0.1, vol: 0.4 * v, filtro: 'highpass', frec: 1500 });
      tono({ t, f: 110, f2: 35, dur: 0.35, vol: 0.7 * v, tipo: 'sine' });
      ruido({ t: t + 0.45, dur: 0.06, vol: 0.25 * v, filtro: 'bandpass', frec: 2500, q: 3 });
      ruido({ t: t + 0.62, dur: 0.06, vol: 0.25 * v, filtro: 'bandpass', frec: 1800, q: 3 });
    },
    vacio(t, v) { ruido({ t, dur: 0.03, vol: 0.25 * v, filtro: 'bandpass', frec: 3500, q: 5 }); },
    recarga(t, v) {
      ruido({ t, dur: 0.05, vol: 0.3 * v, filtro: 'bandpass', frec: 2200, q: 4 });
      ruido({ t: t + 0.18, dur: 0.07, vol: 0.25 * v, filtro: 'bandpass', frec: 1400, q: 4 });
    },
    recarga_fin(t, v) {
      ruido({ t, dur: 0.05, vol: 0.3 * v, filtro: 'bandpass', frec: 1800, q: 4 });
      ruido({ t: t + 0.09, dur: 0.06, vol: 0.35 * v, filtro: 'bandpass', frec: 3000, q: 4 });
    },
    impacto(t, v) { ruido({ t, dur: 0.08, vol: 0.35 * v, filtro: 'lowpass', frec: 700 }); tono({ t, f: 90, f2: 60, dur: 0.08, vol: 0.3 * v }); },
    cabeza(t, v) { EFECTOS.impacto(t, v); tono({ t, f: 1800, f2: 1500, dur: 0.12, vol: 0.18 * v, tipo: 'triangle' }); },
    muerte_zombie(t, v) { grunido(t, v, true); ruido({ t: t + 0.5, dur: 0.25, vol: 0.3 * v, filtro: 'lowpass', frec: 300 }); },
    grunido(t, v) { grunido(t, v, false); },
    dolor(t, v) {
      tono({ t, f: 220, f2: 90, dur: 0.25, vol: 0.4 * v, tipo: 'sawtooth', filtro: 'lowpass', frec: 900 });
      ruido({ t, dur: 0.12, vol: 0.3 * v, filtro: 'lowpass', frec: 500 });
    },
    caer(t, v) {
      tono({ t, f: 300, f2: 40, dur: 1.4, vol: 0.45 * v, tipo: 'sawtooth', filtro: 'lowpass', frec: 1200, frec2: 120 });
      ruido({ t: t + 0.3, dur: 0.4, vol: 0.4 * v, filtro: 'lowpass', frec: 250 });
    },
    reaparecer(t, v) { [0, 0.08, 0.16].forEach((d, i) => tono({ t: t + d, f: 400 * (1 + i * 0.5), dur: 0.35, vol: 0.18 * v, tipo: 'triangle' })); },
    recoger(t, v) { [0, 0.07, 0.14].forEach((d, i) => tono({ t: t + d, f: [660, 880, 1320][i], dur: 0.18, vol: 0.18 * v, tipo: 'square', filtro: 'lowpass', frec: 3500 })); },
    compra(t, v) { tono({ t, f: 1568, dur: 0.12, vol: 0.2 * v, tipo: 'triangle' }); tono({ t: t + 0.08, f: 2093, dur: 0.35, vol: 0.2 * v, tipo: 'triangle' }); },
    lanzar(t, v) { ruido({ t, dur: 0.3, vol: 0.25 * v, filtro: 'bandpass', frec: 600, frec2: 2400, q: 1.5 }); },
    paralizar(t, v) {
      tono({ t, f: 1200, f2: 80, dur: 0.6, vol: 0.4 * v, tipo: 'square', filtro: 'lowpass', frec: 4000, frec2: 300 });
      ruido({ t, dur: 0.6, vol: 0.4 * v, filtro: 'lowpass', frec: 2500, frec2: 100 });
      for (let i = 0; i < 6; i++) ruido({ t: t + 0.1 + i * 0.07, dur: 0.04, vol: 0.2 * v, filtro: 'highpass', frec: 4000 });
    },
    escudo(t, v) { tono({ t, f: 300, f2: 900, dur: 0.4, vol: 0.25 * v, tipo: 'sawtooth', filtro: 'lowpass', frec: 1500 }); tono({ t: t + 0.1, f: 1200, dur: 0.4, vol: 0.12 * v, tipo: 'sine' }); },
    botiquin(t, v) { [523, 659, 784].forEach((f, i) => tono({ t: t + i * 0.09, f, dur: 0.3, vol: 0.18 * v, tipo: 'sine' })); },
    estamina(t, v) { ruido({ t, dur: 0.25, vol: 0.2 * v, filtro: 'bandpass', frec: 3000, q: 2 }); tono({ t: t + 0.15, f: 500, f2: 1500, dur: 0.3, vol: 0.15 * v, tipo: 'triangle' }); },
    linterna(t, v) { ruido({ t, dur: 0.025, vol: 0.3 * v, filtro: 'bandpass', frec: 2800, q: 6 }); },
    salto(t, v) { ruido({ t, dur: 0.15, vol: 0.12 * v, filtro: 'lowpass', frec: 600 }); },
    tic(t, v) { tono({ t, f: 880, dur: 0.1, vol: 0.2 * v, tipo: 'square', filtro: 'lowpass', frec: 2500 }); },
    tic_final(t, v) { tono({ t, f: 1320, dur: 0.25, vol: 0.25 * v, tipo: 'square', filtro: 'lowpass', frec: 3000 }); },
    oleada(t, v) {
      tono({ t, f: 110, dur: 1.2, vol: 0.35 * v, tipo: 'sawtooth', ataque: 0.15, filtro: 'lowpass', frec: 400, frec2: 1400 });
      tono({ t: t + 0.6, f: 165, dur: 1.4, vol: 0.3 * v, tipo: 'sawtooth', ataque: 0.15, filtro: 'lowpass', frec: 400, frec2: 1600 });
    },
    buzz(t, v) { tono({ t, f: 70, dur: 0.45, vol: 0.45 * v, tipo: 'sawtooth', filtro: 'lowpass', frec: 600 }); tono({ t, f: 73, dur: 0.45, vol: 0.4 * v, tipo: 'square', filtro: 'lowpass', frec: 500 }); },
    alerta(t, v) { [0, 0.25, 0.5].forEach(d => tono({ t: t + d, f: 740, f2: 560, dur: 0.18, vol: 0.2 * v, tipo: 'square', filtro: 'lowpass', frec: 2000 })); },
    latido(t, v) { tono({ t, f: 60, f2: 40, dur: 0.15, vol: 0.4 * v }); tono({ t: t + 0.22, f: 55, f2: 38, dur: 0.15, vol: 0.3 * v }); },
    helicoptero(t, v) {
      for (let i = 0; i < 40; i++) ruido({ t: t + i * 0.085, dur: 0.07, vol: 0.35 * v * Math.min(1, i / 10), filtro: 'lowpass', frec: 380, q: 2 });
    },
  };

  let ultimoHover = 0;
  // tocar un efecto, v es el volumen extra, por ejemplo segun la distancia
  function sfx(nombre, v = 1) {
    if (!ctx || ctx.state !== 'running' || v <= 0.01) return;
    if (nombre === 'hover') {
      if (performance.now() - ultimoHover < 70) return;
      ultimoHover = performance.now();
    }
    if (buffers[nombre]) { tocarArchivo(nombre, Math.min(1, v)); return; }
    const fn = EFECTOS[nombre];
    if (fn) fn(ctx.currentTime + 0.005, Math.min(1, v));
  }

  // sonido que se repite sin parar y se le puede subir o bajar el volumen, como el helicoptero
  // si hay archivo se repite el archivo, si no, se arma con ruido que se corta muy rapido como un rotor
  function bucle(nombre) {
    if (!ctx || ctx.state !== 'running') return null;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(busEfectos);
    const fuentes = [];
    if (buffers[nombre]) {
      const src = ctx.createBufferSource();
      src.buffer = buffers[nombre]; src.loop = true;
      src.connect(g); src.start(); fuentes.push(src);
    } else if (nombre !== 'helicoptero' && EFECTOS[nombre]) {
      // los demas efectos hechos con codigo se repiten cada poco, como el latido
      const tocar = () => { destinoTemp = g; EFECTOS[nombre](ctx.currentTime + 0.01, 1); destinoTemp = null; };
      tocar();
      const id = setInterval(tocar, 1100);
      fuentes.push({ stop: () => clearInterval(id) });
    } else {
      const src = ctx.createBufferSource();
      src.buffer = ruidoBuf; src.loop = true;
      const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 380; fl.Q.value = 2;
      const corte = ctx.createGain(); corte.gain.value = 0.5;
      const rotor = ctx.createOscillator(); rotor.type = 'square'; rotor.frequency.value = 11.5;
      const rotorG = ctx.createGain(); rotorG.gain.value = 0.5;
      rotor.connect(rotorG).connect(corte.gain);
      src.connect(fl).connect(corte).connect(g);
      src.start(); rotor.start(); fuentes.push(src, rotor);
    }
    return {
      volumen(v) { g.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.1); },
      parar(seg = 0.5) {
        g.gain.setTargetAtTime(0, ctx.currentTime, seg / 3);
        setTimeout(() => { fuentes.forEach(f => { try { f.stop(); } catch (e) {} }); g.disconnect(); }, seg * 1000 + 300);
      },
    };
  }

  // volumen segun la distancia, cerca suena fuerte y lejos casi nada
  function porDistancia(d, alcance = 30) {
    const k = Math.max(0, 1 - d / alcance);
    return k * k;
  }

  // sonido para los botones de todas las pantallas
  const SELECTOR = 'button, a, .menu-btn, .mode-card, .map-card, .swatch, .room-card, .item-slot, .toggle, input[type="checkbox"], select';
  document.addEventListener('click', e => { if (e.target.closest && e.target.closest(SELECTOR)) sfx('clic'); }, true);
  document.addEventListener('mouseover', e => {
    if (document.pointerLockElement) return;
    const el = e.target.closest && e.target.closest(SELECTOR);
    if (el && !el.contains(e.relatedTarget)) sfx('hover');
  }, true);
  window.addEventListener('storage', e => { if (e.key === 'outbreak_config') leerVolumen(); });
  leerVolumen();

  return {
    iniciar, sfx, bucle, porDistancia, volumenes, leerVolumen, tono, ruido, disponibles,
    nombres: () => Object.keys(EFECTOS),
    volMusica: () => volMusica,
    ctx: () => ctx,
    busMusica: () => busMusica,
  };
})();
