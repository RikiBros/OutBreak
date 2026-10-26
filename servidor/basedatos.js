// conexion con mysql, los datos vienen de config js
const mysql = require('mysql2');

module.exports = function conectarBaseDatos(CONFIG) {
  const db = mysql.createConnection({
    host: CONFIG.MYSQL_HOST,
    user: CONFIG.MYSQL_USER,
    password: CONFIG.MYSQL_PASSWORD,
    database: CONFIG.MYSQL_DATABASE,
  });

  db.connect((err) => {
    if (err) {
      console.error('  error de mysql:', err.message);
      // si la base no existe hay que crearla primero con el archivo sql
      if (err.code === 'ER_BAD_DB_ERROR') console.error('  primero ejecuta basedatos/outbreak.sql en mysql');
    } else {
      console.log('  mysql conectado, base ' + CONFIG.MYSQL_DATABASE);
    }
  });

  return db;
};
