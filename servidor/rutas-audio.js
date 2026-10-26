// dice que archivos de audio hay en cliente audio, asi el juego no pide archivos que no existen
const fs = require('fs');
const path = require('path');

module.exports = function rutasAudio(app) {
  const base = path.join(__dirname, '..', 'cliente', 'audio');

  // nombres de los mp3 de una carpeta, sin la extension y en minusculas
  function listar(carpeta) {
    try {
      return fs.readdirSync(path.join(base, carpeta))
        .filter(f => f.toLowerCase().endsWith('.mp3'))
        .map(f => f.slice(0, -4).toLowerCase());
    } catch (e) {
      return [];
    }
  }

  app.get('/audio_disponible', (req, res) => {
    res.json({ musica: listar('musica'), efectos: listar('efectos') });
  });
};
