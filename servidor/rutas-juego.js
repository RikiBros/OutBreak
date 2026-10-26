// rutas de las salas y de las puntuaciones
module.exports = function rutasJuego(app, db, io, salas) {
  const { salasActivas, MAPAS_VALIDOS, MODOS_VALIDOS, obtenerSalasPublicas } = salas;

  // crear sala http
  // el cliente llama esto antes de conectarse por socket io
  // registra la sala en mysql para historial y en memoria para tiempo real
  app.post('/crear_sala', (req, res) => {
    const { nombre, mapa, modo, id_usuario } = req.body;
    if (!nombre || !mapa || !modo || !id_usuario)
      return res.status(400).json({ error: 'Faltan parámetros.' });
    if (!MAPAS_VALIDOS.includes(mapa))
      return res.status(400).json({ error: 'Mapa no válido.' });
    if (!MODOS_VALIDOS.includes(modo))
      return res.status(400).json({ error: 'Modo no válido.' });
    // entre 2 y 4 jugadores
    const maxJugadores = Math.min(4, Math.max(2, parseInt(req.body.maxJugadores) || 4));
    const dificultad   = req.body.dificultad === 'dificil' ? 'dificil' : 'estandar';

    // guardar en mysql historial permanente
    db.query(
      `INSERT INTO sala (Nombre, Mapa, Modo, MaxJugadores, ID_Host, Estado)
       VALUES (?, ?, ?, ?, ?, 'espera')`,
      [nombre, mapa, modo, maxJugadores, id_usuario],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Error al crear sala en BD.', detail: err.message });

        const roomId = 'room_' + result.insertId;

        // guardar en memoria para socket io
        salasActivas[roomId] = {
          id          : roomId,
          dbId        : result.insertId,
          nombre, mapa, modo, dificultad,
          maxJugadores,
          host        : null,          // se llena cuando se conecta por socket
          jugadores   : [],
          participantes: [],     // usernames que estaban al iniciar la partida
          timerBorrado: null,
          iniciada    : false,
          creada      : Date.now(),
        };

        // avisar a todos los clientes conectados que hay sala nueva
        io.emit('salas_actualizadas', obtenerSalasPublicas());

        res.status(201).json({
          message: 'Sala creada.',
          roomId,
          dbId: result.insertId,
        });
      }
    );
  });

  // listar salas activas http
  // las salas con cupo disponible y sin iniciar
  app.get('/salas_activas', (req, res) => {
    res.json(obtenerSalasPublicas());
  });

  // detalle de una sala
  app.get('/sala/:roomId', (req, res) => {
    const sala = salasActivas[req.params.roomId];
    if (!sala) return res.status(404).json({ error: 'Sala no encontrada.' });
    res.json({
      id: sala.id, nombre: sala.nombre, mapa: sala.mapa, modo: sala.modo, dificultad: sala.dificultad,
      maxJugadores: sala.maxJugadores, host: sala.host,
      jugadores: sala.jugadores, iniciada: sala.iniciada,
    });
  });

  // guardar puntuacion al terminar partida
  app.post('/guardar_puntuacion', (req, res) => {
    const { id_usuario, mapa, modo, puntos, oleada, bajas, sala } = req.body;
    if (!id_usuario || puntos === undefined)
      return res.status(400).json({ error: 'Faltan datos.' });

    db.query(
      `INSERT INTO puntuacion (ID_Usuario, Mapa, Modo, Puntos, Oleada, Bajas, Sala)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id_usuario, mapa, modo, puntos, oleada || 1, bajas || 0, sala || ''],
      (err) => {
        if (err) return res.status(500).json({ error: 'Error al guardar puntuación.', detail: err.message });

        // actualizar totales del usuario
        db.query(
          'UPDATE usuario SET Puntos=Puntos+?, Partidas=Partidas+1 WHERE ID_Usuario=?',
          [puntos, id_usuario]
        );

        res.json({ message: 'Puntuación guardada.' });
      }
    );
  });

  // ranking global
  app.get('/ranking', (req, res) => {
    const mapa = req.query.mapa;   // opcional filtrar por mapa

    let query = `
      SELECT u.Username, p.Mapa, p.Modo, p.Puntos, p.Oleada, p.Bajas, p.Fecha
      FROM puntuacion p
      JOIN usuario u ON p.ID_Usuario = u.ID_Usuario
    `;
    const params = [];
    if (mapa) { query += ' WHERE p.Mapa = ?'; params.push(mapa); }
    query += ' ORDER BY p.Puntos DESC LIMIT 20';

    db.query(query, params, (err, rows) => {
      if (err) return res.status(500).json({ error: 'Error al obtener ranking.' });
      res.json(rows);
    });
  });

  // top por usuario
  app.get('/mis_puntuaciones/:id_usuario', (req, res) => {
    db.query(
      `SELECT Mapa, Modo, Puntos, Oleada, Bajas, Fecha
       FROM puntuacion WHERE ID_Usuario=? ORDER BY Puntos DESC LIMIT 10`,
      [req.params.id_usuario],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error BD.' });
        res.json(rows);
      }
    );
  });
};
