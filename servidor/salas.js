// todo lo de las salas en memoria, quien esta, quien esta listo y el marcador
// se pierde si reinicias el servidor, el historial queda en mysql
module.exports = function crearSalas(io, db) {
  const salasActivas = {};

  const MAPAS_VALIDOS = ['CIUDAD DEVASTADA', 'HOSPITAL INFECTADO'];
  const MODOS_VALIDOS = ['survival', 'zona'];

  // tiempo que espera una sala ya iniciada a que todos entren al juego, al cambiar de pagina se reconectan
  const ESPERA_RECONEXION_MS = 20000;
  const VERSION_SERVIDOR = 6;

  // solo las salas que tienen lugar y no han empezado
  function obtenerSalasPublicas() {
    return Object.values(salasActivas)
      .filter(s => !s.iniciada && s.jugadores.length < s.maxJugadores)
      .map(s => ({
        id          : s.id,
        nombre      : s.nombre,
        mapa        : s.mapa,
        modo        : s.modo,
        dificultad  : s.dificultad,
        host        : s.host,
        jugadores   : s.jugadores.length,
        maxJugadores: s.maxJugadores,
      }));
  }

  // quita de la sala a los sockets que ya no existen y a usuarios repetidos
  function limpiarFantasmas(sala) {
    const vistos = new Set();
    sala.jugadores = sala.jugadores.slice().reverse().filter(j => {
      if (!io.sockets.sockets.has(j.socketId)) return false;
      if (vistos.has(j.username)) return false;   // se queda la conexion mas nueva
      vistos.add(j.username);
      return true;
    }).reverse();
  }

  // lista real de jugadores conectados a todos ven el mismo numero
  function enviarJugadores(sala) {
    io.to(sala.id).emit('jugadores_sala', sala.jugadores.map(j => ({ socketId: j.socketId, username: j.username, color: j.color })));
  }

  // color de camisa valido rrggbb
  function colorCamisa(c) { return /^#[0-9a-fA-F]{6}$/.test(c || '') ? c : '#24508c'; }

  // estado de la sala de espera quien esta listo y su color
  function enviarEspera(sala) {
    const jugadores = sala.jugadores.map(j => ({ username: j.username, color: j.color, listo: !!j.listo }));
    const todos = sala.jugadores.every(j => j.username === sala.host || j.listo);
    io.to(sala.id).emit('espera_estado', { jugadores, host: sala.host, maxJugadores: sala.maxJugadores, todosListos: todos });
  }

  // pasar el control de los zombies a un jugador que siga en la partida
  function reasignarHost(sala) {
    const sig = sala.jugadores.find(j => {
      const m = sala.marcador && sala.marcador[j.username];
      return j.username !== sala.host && (!m || m.vivo);
    });
    if (!sig) return;
    sala.host = sig.username;
    io.to(sala.id).emit('nuevo_host', { username: sala.host });
    console.log(`Nuevo anfitrión de ${sala.nombre}: ${sala.host}`);
  }

  function jugadoresActivos(sala) {
    limpiarFantasmas(sala);
    // los que siguen conectados y no han terminado
    return sala.jugadores.filter(j => {
      const m = sala.marcador && sala.marcador[j.username];
      return !m || !m.termino;
    }).map(j => j.username);
  }

  function revisarListos(sala) {
    if (!sala.faseListo || !sala.listos) return;
    const activos = jugadoresActivos(sala);
    const listos  = activos.filter(u => sala.listos.has(u)).length;
    io.to(sala.id).emit('listos_estado', { fase: sala.faseListo, listos, total: activos.length });
    if (activos.length > 0 && listos >= activos.length) {
      io.to(sala.id).emit('todos_listos', { fase: sala.faseListo });
      sala.faseCompletada = sala.faseListo;
      sala.faseListo = null;
      sala.listos = null;
    }
  }

  // marcador de bajas partidas en linea
  function listaMarcador(sala) {
    const lista = Object.entries(sala.marcador || {})
      .map(([username, m]) => ({ username, kills: m.kills, puntos: m.puntos || 0, vivo: m.vivo, termino: !!m.termino, orden: m.orden || 99 }));
    // se gana por puntos en ambos modos empate a mas bajas
    return lista.sort((a, b) => (b.puntos - a.puntos) || (b.kills - a.kills));
  }

  function enviarMarcador(roomId) {
    const sala = salasActivas[roomId];
    if (sala && sala.marcador) io.to(roomId).emit('marcador', listaMarcador(sala));
  }

  // cuando todos terminaron gana quien tenga mas puntos
  function checarFin(roomId) {
    const sala = salasActivas[roomId];
    if (!sala || !sala.marcador || sala.finalizada) return;
    const todosCaidos = Object.values(sala.marcador).every(m => !m.vivo);
    if (!todosCaidos) return;
    sala.finalizada = true;
    const ranking = listaMarcador(sala);
    io.to(roomId).emit('partida_finalizada', { ranking });
    if (sala.dbId) db.query("UPDATE sala SET Estado='cerrada' WHERE ID_Sala=?", [sala.dbId]);
    console.log(`Partida terminada en ${sala.nombre}. Ganador: ${ranking[0] ? ranking[0].username : '-'}`);
  }

  // quitar jugador de su sala al salir o desconectarse
  function quitarJugador(socket) {
    const roomId = socket.data.roomId;
    socket.data.roomId = null;
    if (!roomId || !salasActivas[roomId]) return;
    const sala = salasActivas[roomId];

    sala.jugadores = sala.jugadores.filter(j => j.socketId !== socket.id);

    // si abandona una partida en curso, cuenta como caido
    const m = sala.marcador && sala.marcador[socket.data.username];
    if (sala.iniciada && m && m.llego && m.vivo) {
      m.vivo = false;
      enviarMarcador(roomId);
      checarFin(roomId);
    }

    socket.to(roomId).emit('jugador_salio', {
      socketId: socket.id,
      username: socket.data.username,
    });

    const borrarSala = () => {
      if (!salasActivas[roomId] || salasActivas[roomId].jugadores.length > 0) return;
      if (sala.dbId) db.query("UPDATE sala SET Estado='cerrada' WHERE ID_Sala=?", [sala.dbId]);
      delete salasActivas[roomId];
      io.emit('salas_actualizadas', obtenerSalasPublicas());
      console.log(`Sala eliminada (vacía): ${sala.nombre}`);
    };

    if (sala.jugadores.length === 0) {
      // partida ya iniciada dar tiempo a que todos entren a juego html
      if (sala.iniciada) {
        if (sala.timerBorrado) clearTimeout(sala.timerBorrado);
        sala.timerBorrado = setTimeout(borrarSala, ESPERA_RECONEXION_MS);
      } else {
        borrarSala();
      }
    } else if (sala.host === socket.data.username && !sala.iniciada) {
      sala.host = sala.jugadores[0].username;
      io.to(roomId).emit('nuevo_host', { username: sala.host });
    } else if (sala.host === socket.data.username && sala.iniciada && m && m.llego) {
      // el anfitrion salio de la partida otro jugador controla a los zombies
      reasignarHost(sala);
    }
    // si alguien se va mientras los demas esperan con listo, revisar de nuevo
    enviarJugadores(sala);
    if (!sala.iniciada) enviarEspera(sala);
    revisarListos(sala);

    io.emit('salas_actualizadas', obtenerSalasPublicas());
  }

  return {
    salasActivas, MAPAS_VALIDOS, MODOS_VALIDOS, ESPERA_RECONEXION_MS, VERSION_SERVIDOR,
    obtenerSalasPublicas, limpiarFantasmas, enviarJugadores, colorCamisa, enviarEspera,
    reasignarHost, jugadoresActivos, revisarListos, listaMarcador, enviarMarcador, checarFin, quitarJugador,
  };
};
