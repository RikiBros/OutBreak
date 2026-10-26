// eventos en tiempo real de las salas, entrar, moverse, listo, color y salir
module.exports = function socketsSala(socket, io, db, salas) {
  const { salasActivas, ESPERA_RECONEXION_MS, VERSION_SERVIDOR, obtenerSalasPublicas,
          limpiarFantasmas, enviarJugadores, colorCamisa, enviarEspera, revisarListos,
          enviarMarcador, checarFin, quitarJugador } = salas;

  console.log(`Conectado: ${socket.id}`);

  // unirse a sala
  // emitido por el cliente al hacer clic en unirse o desplegar
  socket.on('unirse_sala', ({ roomId, username, color }) => {
    // si estaba en otra sala, sacarlo de esa primero
    if (socket.data.roomId && socket.data.roomId !== roomId) quitarJugador(socket);

    const sala = salasActivas[roomId];
    if (!sala) {
      socket.emit('error_sala', 'La sala ya no existe.');
      return;
    }
    // si el mismo usuario ya estaba p ej viene de la sala de espera
    // a juego html, se quita su entrada vieja antes de volver a meterlo
    // quitar entradas fantasma pestañas viejas, conexiones caidas y la
    // entrada vieja de este mismo usuario, avisando a los demas
    limpiarFantasmas(sala);
    sala.jugadores.filter(j => j.username === username && j.socketId !== socket.id).forEach(j => {
      const viejo = io.sockets.sockets.get(j.socketId);
      if (viejo) { viejo.data.roomId = null; viejo.leave(roomId); viejo.emit('sesion_reemplazada'); }
      io.to(roomId).emit('jugador_salio', { socketId: j.socketId, username });
    });
    sala.jugadores = sala.jugadores.filter(j => j.username !== username);

    if (sala.jugadores.length >= sala.maxJugadores) {
      socket.emit('error_sala', 'La sala está llena.');
      return;
    }
    // una sala ya iniciada solo acepta a quienes estaban en la sala de espera
    if (sala.iniciada && !sala.participantes.includes(username)) {
      socket.emit('error_sala', 'La partida ya comenzó.');
      return;
    }
    if (sala.timerBorrado) { clearTimeout(sala.timerBorrado); sala.timerBorrado = null; }

    // guardar jugador en la sala
    const jugador = { socketId: socket.id, username, x:0, y:1.7, z:0, rot:0, color: colorCamisa(color), listo: false };
    sala.jugadores.push(jugador);
    if (!sala.host) sala.host = username;   // el primero en entrar es host

    socket.join(roomId);
    socket.data.roomId   = roomId;
    socket.data.username = username;

    // llego a juego html despues de iniciar la partida
    if (sala.iniciada && sala.marcador && sala.marcador[username]) {
      sala.marcador[username].llego = true;
      setTimeout(() => enviarMarcador(roomId), 200);
    }

    // avisar al jugador que entro le mandamos la lista actual de compañeros
    socket.emit('sala_unida', {
      roomId,
      sala: {
        nombre      : sala.nombre,
        mapa        : sala.mapa,
        modo        : sala.modo,
        dificultad  : sala.dificultad,
        jugadores   : sala.jugadores,
        maxJugadores: sala.maxJugadores,
        host        : sala.host,
        version     : VERSION_SERVIDOR,
      }
    });

    // avisar a los demas en la sala que alguien entro
    socket.to(roomId).emit('jugador_entro', {
      socketId: socket.id,
      username,
      color: jugador.color,
    });
    if (!sala.iniciada) enviarEspera(sala);

    enviarJugadores(sala);
    revisarListos(sala);
    // actualizar lista publica para todos
    io.emit('salas_actualizadas', obtenerSalasPublicas());

    console.log(`${username} → sala ${sala.nombre} (${sala.jugadores.length}/${sala.maxJugadores})`);
  });

  // movimiento del jugador
  // se emite muchas veces por segundo no toca mysql
  socket.on('jugador_movio', ({ x, y, z, rot, f, p }) => {
    const roomId = socket.data.roomId;
    if (!roomId || !salasActivas[roomId]) return;

    // actualizar posicion en memoria
    const jugador = salasActivas[roomId].jugadores.find(j => j.socketId === socket.id);
    if (jugador) { jugador.x=x; jugador.y=y; jugador.z=z; jugador.rot=rot; }

    // reenviar a los demas no a uno mismo f apunta derribado, p hacia arriba abajo
    socket.to(roomId).emit('posicion_jugador', {
      socketId: socket.id,
      username: socket.data.username,
      x, y, z, rot,
      f: (parseInt(f) || 0) & 3,
      p: Math.max(-1.6, Math.min(1.6, +p || 0)),
      color: jugador ? jugador.color : undefined,
    });
  });

  // otro jugador disparo solo para verlo
  socket.on('jugador_disparo', ({ a } = {}) => {
    const roomId = socket.data.roomId;
    if (!roomId || !salasActivas[roomId]) return;
    socket.to(roomId).emit('jugador_disparo', { socketId: socket.id, a: a === 'e' ? 'e' : 'p' });
  });

  // sala de espera listo y color de camisa
  socket.on('listo_espera', ({ listo } = {}) => {
    const sala = salasActivas[socket.data.roomId];
    if (!sala || sala.iniciada) return;
    const j = sala.jugadores.find(q => q.socketId === socket.id);
    if (j) { j.listo = !!listo; enviarEspera(sala); }
  });

  socket.on('cambiar_color', ({ color } = {}) => {
    const sala = salasActivas[socket.data.roomId];
    if (!sala) return;
    const j = sala.jugadores.find(q => q.socketId === socket.id);
    if (j) { j.color = colorCamisa(color); if (!sala.iniciada) enviarEspera(sala); }
  });

  // partida iniciada host confirma inicio
  socket.on('iniciar_partida', ({ roomId }) => {
    const sala = salasActivas[roomId];
    if (!sala || sala.host !== socket.data.username || sala.iniciada) return;
    // todos menos el anfitrion deben haber presionado listo
    const faltan = sala.jugadores.filter(j => j.username !== sala.host && !j.listo).map(j => j.username);
    if (faltan.length) { socket.emit('error_sala', 'Falta que estén listos: ' + faltan.join(', ')); return; }

    sala.iniciada = true;
    sala.participantes = sala.jugadores.map(j => j.username);
    // marcador de bajas gana quien elimine mas cuando todos hayan caido
    sala.marcador   = {};
    sala.finalizada = false;
    sala.participantes.forEach(u => { sala.marcador[u] = { kills: 0, puntos: 0, vivo: true, llego: false }; });
    // quien no entre a juego html a tiempo cuenta como caido
    setTimeout(() => {
      if (!salasActivas[roomId] || sala.finalizada) return;
      Object.values(sala.marcador).forEach(m => { if (!m.llego) m.vivo = false; });
      enviarMarcador(roomId);
      checarFin(roomId);
    }, ESPERA_RECONEXION_MS + 5000);
    io.to(roomId).emit('partida_iniciada', { mapa: sala.mapa, modo: sala.modo, dificultad: sala.dificultad });
    io.emit('salas_actualizadas', obtenerSalasPublicas());

    // marcar en mysql
    if (sala.dbId) {
      db.query("UPDATE sala SET Estado='en_juego' WHERE ID_Sala=?", [sala.dbId]);
    }
    console.log(`Partida iniciada: ${sala.nombre}`);
  });

  // salir de la sala boton salir de la sala de espera
  socket.on('salir_sala', () => {
    const roomId = socket.data.roomId;
    quitarJugador(socket);
    if (roomId) socket.leave(roomId);
  });

  // desconexion
  socket.on('disconnect', () => {
    quitarJugador(socket);
    console.log(`Desconectado: ${socket.id} (${socket.data.username || 'anónimo'})`);
  });
};
