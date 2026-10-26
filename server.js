// servidor de outbreak, node con express, mysql y socket io
// para correrlo, npm install la primera vez y luego node server js
// despues abre http localhost 3000 en chrome

const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const CONFIG = require('./config.js');
const conectarBaseDatos = require('./servidor/basedatos');
const crearSalas = require('./servidor/salas');
const rutasCuenta = require('./servidor/rutas-cuenta');
const rutasJuego = require('./servidor/rutas-juego');
const rutasAudio = require('./servidor/rutas-audio');
const socketsSala = require('./servidor/sockets-sala');
const socketsJuego = require('./servidor/sockets-juego');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });

app.use(cors());
app.use(express.json());

// solo se sirve la carpeta cliente, el codigo del servidor y las contraseñas no se ven desde el navegador
app.use(express.static(path.join(__dirname, 'cliente')));

const db = conectarBaseDatos(CONFIG);
const GOOGLE_CLIENT_ID = CONFIG.GOOGLE_CLIENT_ID || '';
const salas = crearSalas(io, db);

rutasCuenta(app, db, GOOGLE_CLIENT_ID);
rutasJuego(app, db, io, salas);
rutasAudio(app);

// cada jugador que se conecta recibe los eventos de sala y de partida
io.on('connection', (socket) => {
  socketsSala(socket, io, db, salas);
  socketsJuego(socket, io, db, salas);
});

server.listen(3000, () => {
  console.log('');
  console.log('  OUTBREAK servidor corriendo (v' + salas.VERSION_SERVIDOR + ')');
  console.log('  abre http://localhost:3000');
  console.log('');
  if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith('PEGA_AQUI'))
    console.warn('  falta poner tu GOOGLE_CLIENT_ID en config.js, sin eso no funciona el login con google');
});
