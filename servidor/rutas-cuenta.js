// rutas de la cuenta, la configuracion publica, el login con google y el perfil
module.exports = function rutasCuenta(app, db, GOOGLE_CLIENT_ID) {
  // config publica para el cliente
  // el index html pide el client id aqui para no repetirlo en cada pagina
  app.get('/config', (req, res) => {
    const configurado = GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith('PEGA_AQUI');
    res.json({ googleClientId: configurado ? GOOGLE_CLIENT_ID : null });
  });

  // login con google
  // 1 el navegador manda el token credential que le dio google
  // 2 le preguntamos a google si el token es valido y es para nuestra app
  // 3 si el usuario ya existe por google id o correo lo regresamos
  // si no, lo creamos
  app.post('/auth/google', async (req, res) => {
    const { credential } = req.body;
    if (!credential) return res.status(400).json({ error: 'Falta el token de Google.' });

    let info;
    try {
      const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
      info = await r.json();
      if (!r.ok) throw new Error(info.error_description || 'Token inválido');
    } catch (e) {
      return res.status(401).json({ error: 'No se pudo verificar la cuenta de Google.' });
    }

    if (info.aud !== GOOGLE_CLIENT_ID)
      return res.status(401).json({ error: 'El token no es para esta aplicación.' });
    if (info.email_verified !== 'true' && info.email_verified !== true)
      return res.status(401).json({ error: 'El correo de Google no está verificado.' });

    const googleId = info.sub;
    const correo   = info.email;
    const foto     = info.picture || null;
    const nombreBase = (info.given_name || info.name || correo.split('@')[0])
                         .replace(/\s+/g, '').slice(0, 20) || 'Operativo';

    const COLS = 'ID_Usuario,Username,Correo,Foto,Puntos,Partidas';

    db.query(`SELECT ${COLS} FROM usuario WHERE Google_ID=? OR Correo=? LIMIT 1`,
      [googleId, correo], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error BD.', detail: err.message });

        // ya existe a actualizar google id foto y regresar
        if (rows.length > 0) {
          const u = rows[0];
          db.query('UPDATE usuario SET Google_ID=?, Foto=? WHERE ID_Usuario=?',
            [googleId, foto, u.ID_Usuario]);
          u.Foto = foto;
          return res.json({ message: 'Login exitoso.', user: u });
        }

        // nuevo a crear si el username ya esta ocupado, se le agrega un sufijo
        const crear = (username, intento) => {
          db.query(
            'INSERT INTO usuario (Username,Correo,Google_ID,Foto,Puntos,Partidas) VALUES (?,?,?,?,0,0)',
            [username, correo, googleId, foto],
            (err, result) => {
              if (err && err.code === 'ER_DUP_ENTRY' && intento < 5) {
                const sufijo = Math.floor(Math.random() * 9000 + 1000);
                return crear(nombreBase.slice(0, 25) + sufijo, intento + 1);
              }
              if (err) return res.status(500).json({ error: 'Error al crear usuario.', detail: err.message });
              res.status(201).json({
                message: 'Cuenta creada.',
                user: { ID_Usuario: result.insertId, Username: username, Correo: correo,
                        Foto: foto, Puntos: 0, Partidas: 0 }
              });
            }
          );
        };
        crear(nombreBase, 0);
      }
    );
  });

  // perfil
  app.get('/perfil/:id', (req, res) => {
    db.query(
      'SELECT ID_Usuario,Username,Correo,Foto,Puntos,Partidas FROM usuario WHERE ID_Usuario=?',
      [req.params.id],
      (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error BD.' });
        if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
        res.json(rows[0]);
      }
    );
  });

  // cambiar nombre de perfil
  // lo usa configuracion html valida el formato y que no este ocupado
  app.put('/perfil/:id', (req, res) => {
    const username = (req.body.username || '').trim();
    if (!/^[A-Za-z0-9_\-ÁÉÍÓÚáéíóúÑñ]{3,20}$/.test(username))
      return res.status(400).json({ error: 'El nombre debe tener 3-20 letras, números, _ o - (sin espacios).' });

    db.query('UPDATE usuario SET Username=? WHERE ID_Usuario=?', [username, req.params.id], (err, result) => {
      if (err && err.code === 'ER_DUP_ENTRY')
        return res.status(409).json({ error: 'Ese nombre ya está ocupado.' });
      if (err) return res.status(500).json({ error: 'Error BD.' });
      if (result.affectedRows === 0)
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      res.json({ message: 'Nombre actualizado.', username });
    });
  });
};
