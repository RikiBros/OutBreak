// eventos en tiempo real durante la partida, listo, puntos, zombies compartidos y disparos
module.exports = function socketsJuego(socket, io, db, salas) {
  const { salasActivas, reasignarHost, revisarListos, enviarMarcador, checarFin } = salas;

  // listo la partida siguiente oleada empieza cuando todos estan listos
  socket.on('listo', ({ fase }) => {
    const sala = salasActivas[socket.data.roomId];
    if (!sala || typeof fase !== 'string') return;
    // si esa fase ya se completo jugador que llego tarde, avisarle de inmediato
    if (sala.faseCompletada === fase) { socket.emit('todos_listos', { fase }); return; }
    if (sala.faseListo !== fase) { sala.faseListo = fase; sala.listos = new Set(); }
    sala.listos.add(socket.data.username);
    console.log(`${socket.data.username} listo (${fase})`);
    revisarListos(sala);
  });

  // bajas del jugador cada vez que elimina a un infectado
  socket.on('actualizar_bajas', ({ kills, puntos }) => {
    const roomId = socket.data.roomId;
    const sala   = salasActivas[roomId];
    if (!sala || !sala.marcador || sala.finalizada) return;
    const m = sala.marcador[socket.data.username];
    if (!m || !m.vivo) return;
    m.kills  = Math.max(0, parseInt(kills) || 0);
    m.puntos = Math.max(0, parseInt(puntos) || 0);                 // se gana por puntos
    enviarMarcador(roomId);
  });

  // zombies compartidos el anfitrion los controla
  const esHostDe = (sala) => sala && sala.host === socket.data.username;

  socket.on('zombies_estado', (lista) => {
    const sala = salasActivas[socket.data.roomId];
    if (!esHostDe(sala) || !sala.iniciada || !Array.isArray(lista) || lista.length > 100) return;
    socket.to(sala.id).emit('zombies_estado', lista);
    if (!sala.zombiesLog) { sala.zombiesLog = true; console.log(`${sala.nombre}: el anfitrión ${sala.host} está enviando los zombies`); }
  });

  socket.on('zombie_muerto', (d) => {
    const sala = salasActivas[socket.data.roomId];
    if (!esHostDe(sala) || !d) return;
    socket.to(sala.id).emit('zombie_muerto', {
      id: d.id, killer: String(d.killer || '').slice(0, 40), cabeza: !!d.cabeza, tipo: String(d.tipo || '').slice(0, 20),
    });
  });

  // acciones de los demas jugadores sobre los zombies a al anfitrion
  socket.on('a_host', (msg) => {
    const sala = salasActivas[socket.data.roomId];
    if (!sala || !sala.iniciada || !msg || !['golpe', 'paralizar', 'recoger'].includes(msg.tipo)) return;
    const host = sala.jugadores.find(j => j.username === sala.host);
    if (!host || host.socketId === socket.id) return;
    io.to(host.socketId).emit('de_jugador', { tipo: msg.tipo, datos: msg.datos, de: socket.data.username });
  });

  // mensajes del anfitrion para todos objetos del modo zona
  socket.on('del_host', (msg) => {
    const sala = salasActivas[socket.data.roomId];
    if (!esHostDe(sala) || !sala.iniciada || !msg || !['objetos', 'objeto_tomado'].includes(msg.tipo)) return;
    socket.to(sala.id).emit('del_host', { tipo: msg.tipo, datos: msg.datos });
  });

  // disparo a otro jugador
  // el servidor solo lo reenvia si ambos estan en la misma sala en juego
  socket.on('disparo_jugador', ({ objetivo, dano }) => {
    const sala = salasActivas[socket.data.roomId];
    if (!sala || !sala.iniciada || sala.finalizada) return;
    if (!sala.jugadores.some(j => j.socketId === objetivo) || objetivo === socket.id) return;
    const d = Math.max(0, Math.min(60, parseInt(dano) || 0));
    if (d > 0) io.to(objetivo).emit('recibiste_disparo', { de: socket.data.username, dano: d });
  });

  // jugador sobrevivio las 3 oleadas
  socket.on('jugador_termino', () => {
    const sala = salasActivas[socket.data.roomId];
    const m = sala && sala.marcador && sala.marcador[socket.data.username];
    if (!m || !m.vivo) return;
    m.vivo = false;          // ya no esta jugando
    m.termino = true;        // pero sobrevivio
    m.orden = (sala.ordenTermino = (sala.ordenTermino || 0) + 1);
    if (sala.host === socket.data.username) reasignarHost(sala);
    enviarMarcador(socket.data.roomId);
    checarFin(socket.data.roomId);
  });

  // jugador murio
  socket.on('jugador_murio', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('compañero_murio', {
      socketId: socket.id,
      username: socket.data.username,
    });
    const sala = salasActivas[roomId];
    if (sala && sala.marcador && sala.marcador[socket.data.username]) {
      sala.marcador[socket.data.username].vivo = false;
      if (sala.host === socket.data.username) reasignarHost(sala);
      enviarMarcador(roomId);
      checarFin(roomId);
    }
  });
};
