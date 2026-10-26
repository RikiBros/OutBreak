outbreak, juego de terror y supervivencia en 3d hecho con three

como correrlo
1, prende mysql en xampp
2, en phpmyadmin corre basedatos/outbreak.sql, si ya tenias la base de antes corre basedatos/actualizar.sql
3, copia config.ejemplo.js con el nombre config.js y pon tu id de cliente de google
4, en la terminal, dentro de esta carpeta, npm install la primera vez y luego node server.js
5, abre http://localhost:3000 en chrome

carpetas
cliente, todo lo que ve el navegador, paginas, estilos, codigo del juego e imagenes
cliente/js/juego, el juego partido en archivos chicos, se cargan en orden desde arranque.js
servidor, el codigo del servidor, salas, login, puntuaciones y tiempo real
basedatos, los archivos sql
docs, documentos de la materia

modelo de zombie opcional
si quieres usar un modelo 3d con animaciones ponlo en cliente/modelos/zombie.glb
si no existe se usan los zombies hechos por codigo

imagenes de los mapas opcionales
la pantalla de mapas busca cliente/media/ciudad_devastada.png y cliente/media/hospital_infectado.jpg
si no estan solo no se muestra la imagen
