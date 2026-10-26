# OutBreak

Juego de terror y supervivencia en 3D para el navegador, hecho con Three.js, con partidas en solitario o en línea de hasta 4 jugadores.

Proyecto de la materia **Gráficas Computacionales en Web** (LMAD, FCFM, UANL).

| Integrante | Matrícula |
| --- | --- |
| Aguirre Miranda Mariely Alejandra | 2022816 |
| Polina Méndez Carlo Emilio | 2049948 |
| Reyes Hernández Ricardo | 1987560 |

Profesor: Edgar Alejandro Sosa Molina

---

## Contenido

1. [Requisitos](#1-requisitos)
2. [Descargar el proyecto](#2-descargar-el-proyecto)
3. [Crear la base de datos](#3-crear-la-base-de-datos)
4. [Crear el archivo config.js](#4-crear-el-archivo-configjs)
5. [Obtener el Client ID de Google](#5-obtener-el-client-id-de-google)
6. [Instalar y encender el servidor](#6-instalar-y-encender-el-servidor)
7. [Jugar](#7-jugar)
8. [Jugar en línea con otras personas](#8-jugar-en-línea-con-otras-personas)
9. [Archivos opcionales: música, efectos y modelos](#9-archivos-opcionales-música-efectos-y-modelos)
10. [Actualizar el proyecto](#10-actualizar-el-proyecto)
11. [Problemas comunes](#11-problemas-comunes)
12. [Estructura de carpetas](#12-estructura-de-carpetas)
13. [Controles](#13-controles)

---

## 1. Requisitos

Instala esto antes de empezar:

| Programa | Para qué | Dónde se descarga |
| --- | --- | --- |
| **Node.js** (versión LTS) | Corre el servidor del juego | https://nodejs.org |
| **XAMPP** | Trae MySQL y phpMyAdmin para la base de datos | https://www.apachefriends.org |
| **Google Chrome** o Microsoft Edge | Para jugar | |
| **Visual Studio Code** (recomendado) | Para abrir el proyecto y la terminal | https://code.visualstudio.com |
| **Git** (opcional) | Para descargar y actualizar el proyecto | https://git-scm.com |
| **ngrok** (opcional) | Solo para jugar por internet con otras personas | https://ngrok.com |

Para comprobar que Node.js quedó instalado, abre una terminal y escribe `node -v`. Debe mostrar un número de versión, por ejemplo `v20.11.0`.

---

## 2. Descargar el proyecto

Elige una opción:

- **Con Git:** abre una terminal en la carpeta donde lo quieras guardar y escribe:
  ```
  git clone https://github.com/RikiBros/OutBreak.git
  ```
- **Sin Git:** en la página del repositorio da clic en el botón verde **Code**, luego en **Download ZIP**, y descomprime el archivo.

Abre la carpeta `OutBreak` en Visual Studio Code (**Archivo → Abrir carpeta**).

---

## 3. Crear la base de datos

1. Abre **XAMPP** y da clic en **Start** en la fila de **MySQL**. Apache no hace falta.
2. Entra a http://localhost/phpmyadmin en el navegador.
3. Ve a la pestaña **SQL**.
4. Abre el archivo `basedatos/outbreak.sql` del proyecto, copia todo su contenido, pégalo en phpMyAdmin y da clic en **Continuar**.

Esto crea la base `bd_outbreak` con las tablas `usuario`, `sala` y `puntuacion`, y la vista `v_ranking`. Solo se hace una vez.

> Si ya tenías la base de una versión anterior del proyecto, corre también `basedatos/actualizar.sql` de la misma forma.

---

## 4. Crear el archivo config.js

El archivo `config.js` guarda tus datos privados (contraseña de MySQL y Client ID de Google). **No viene en el repositorio a propósito** y nunca se debe subir a GitHub; el `.gitignore` ya lo excluye.

1. En la carpeta principal del proyecto, copia el archivo `config.ejemplo.js`.
2. Renombra la copia a **`config.js`** (en la misma carpeta, junto a `server.js`).
3. Ábrelo y llena tus datos:

```js
module.exports = {
  MYSQL_HOST: 'localhost',
  MYSQL_USER: 'root',
  MYSQL_PASSWORD: '',            // con XAMPP normal se deja vacío
  MYSQL_DATABASE: 'bd_outbreak',

  GOOGLE_CLIENT_ID: 'TU_CLIENT_ID.apps.googleusercontent.com',
};
```

Si tu MySQL tiene contraseña, escríbela en `MYSQL_PASSWORD`.

---

## 5. Obtener el Client ID de Google

El juego inicia sesión con la cuenta de Google. Sin un Client ID válido el juego abre, pero no se puede iniciar sesión ni jugar.

**Opción rápida:** pídele el Client ID a quien ya lo tenga configurado en el equipo. Como todos abren el juego en `http://localhost:3000`, el mismo Client ID funciona para todos.

**Para crear uno propio:**

1. Entra a https://console.cloud.google.com y crea un proyecto (o elige uno).
2. Ve a **APIs y servicios → Pantalla de consentimiento de OAuth**, elige **Externo** y llena el nombre de la app y tu correo. En **Usuarios de prueba** agrega los correos de quienes van a jugar.
3. Ve a **APIs y servicios → Credenciales → Crear credenciales → ID de cliente de OAuth**.
4. En **Tipo de aplicación** elige **Aplicación web**.
5. En **Orígenes de JavaScript autorizados** agrega:
   - `http://localhost:3000`
   - `http://localhost`
   - si vas a usar ngrok, también tu dirección `https://...ngrok-free.dev`
6. Da clic en **Crear**, copia el **ID de cliente** (termina en `.apps.googleusercontent.com`) y pégalo en `GOOGLE_CLIENT_ID` dentro de `config.js`.

Los cambios en Google Cloud pueden tardar unos minutos en aplicarse.

---

## 6. Instalar y encender el servidor

Con MySQL encendido en XAMPP, abre la terminal de Visual Studio Code (**Terminal → Nueva terminal**, o `Ctrl + ñ`). Debe estar en la carpeta del proyecto, la que tiene `server.js`.

**Solo la primera vez**, instala las librerías:

```
npm install
```

Esto crea la carpeta `node_modules`. No se sube a GitHub porque cada quien la genera con este comando.

**Cada vez que quieras jugar**, enciende el servidor:

```
node server.js
```

Si todo está bien, la terminal muestra:

```
  OUTBREAK servidor corriendo (v6)
  abre http://localhost:3000

  mysql conectado, base bd_outbreak
```

Deja esa terminal abierta mientras juegas. Para apagar el servidor, presiona `Ctrl + C` en ella.

---

## 7. Jugar

1. Abre http://localhost:3000 en Chrome o Edge.
2. Da clic en **Iniciar sesión** y entra con tu cuenta de Google.
3. Da clic en **Jugar** y elige:
   - **Solitario:** escoges mapa, modo (Resiste o Por Honor) y dificultad (Estándar o Difícil).
   - **En línea:** creas una sala o te unes a una.

**Probar dos jugadores en una sola computadora:** abre una ventana normal y otra de incógnito (o dos navegadores distintos). Cada ventana guarda su propia sesión, así que funcionan como dos jugadores aunque uses la misma cuenta de Google.

---

## 8. Jugar en línea con otras personas

Solo **una** persona enciende el servidor; los demás solo abren la dirección que ella comparta.

**En la misma red Wi-Fi:** los demás pueden entrar con la IP local de la computadora que tiene el servidor, por ejemplo `http://192.168.1.50:3000`. Para iniciar sesión con Google esa dirección debe estar autorizada en el Client ID, por eso suele ser más fácil usar ngrok.

**Por internet con ngrok:**

1. Con el servidor encendido, abre **otra** terminal (sin cerrar la del servidor) y escribe:
   ```
   ngrok http 3000
   ```
2. ngrok muestra una dirección como `https://algo-algo-algo.ngrok-free.dev`. Compártela con los demás.
3. Agrega esa dirección en **Orígenes de JavaScript autorizados** de tu Client ID en Google Cloud (paso 5). Si no, nadie podrá iniciar sesión desde ella.

En la versión gratuita de ngrok la dirección puede cambiar cada vez que lo abres; si cambia, hay que volver a agregarla en Google Cloud.

**Cómo funciona una partida en línea:**

1. El anfitrión crea la sala eligiendo mapa, modo, dificultad y número de jugadores (2 a 4).
2. Los demás se unen desde la lista de salas, eligen el color de su camisa y presionan **Estoy listo**.
3. Cuando todos están listos, el anfitrión inicia la partida.
4. En línea no hay pausa: presionar ESC muestra "NO HAY TIEMPO PARA PAUSAS" y quita 1 de vida.

---

## 9. Archivos opcionales: música, efectos y modelos

El juego funciona sin estos archivos, pero se ve y se oye mejor con ellos.

### Música (`cliente/audio/musica/`)

Las canciones son archivos **mp3** con estos nombres exactos, en minúsculas. Si falta una, esa parte del juego se queda sin música.

| Archivo | Cuándo suena |
| --- | --- |
| `menu.mp3` | Pantallas del menú e historia antes de jugar |
| `mapa.mp3` | Modo Resiste en la Ciudad Devastada |
| `helipuerto.mp3` | Modo Resiste en el Helipuerto |
| `mapa2.mp3` | Modo Resiste en el Hospital Infectado |
| `tienda.mp3` | Descanso entre oleadas |
| `honor.mp3` | Modo Por Honor en cualquier mapa |
| `victoria.mp3` | Una vez, al ser rescatado (opcional) |
| `derrota.mp3` | Una vez, al perder (opcional) |
| `fin_honor.mp3` | Una vez, al terminar Por Honor (opcional) |

Si las canciones tienen derechos de autor, es mejor no subirlas al repositorio público y pasarlas aparte (por ejemplo por Drive).

### Efectos de sonido (`cliente/audio/efectos/`)

Todos los efectos se generan con código, así que esta carpeta es opcional. Si pones un mp3 con el nombre de un efecto (por ejemplo `pistola.mp3`), se usa ese en lugar del generado. La lista completa de nombres está en `cliente/audio/efectos/leeme.txt`.

### Modelo de zombie (`cliente/modelos/zombie.glb`)

Si existe un modelo 3D con animaciones en esa ruta, los zombies lo usan. Si no existe, se usan los zombies hechos con código.

### Imágenes de la selección de mapas (`cliente/media/`)

La pantalla de mapas muestra `preview_helipuerto.jpg`, `preview_ciudad.jpg` y `preview_hospital.jpg`. Si alguna falta, simplemente no se muestra la imagen.

---

## 10. Actualizar el proyecto

Cuando alguien del equipo suba cambios a GitHub:

1. Apaga el servidor (`Ctrl + C`).
2. En la terminal, dentro de la carpeta del proyecto:
   ```
   git pull
   ```
3. Si cambió el archivo `package.json`, vuelve a correr `npm install`.
4. Si cambió algún archivo de `basedatos/`, revisa si hay que correr un script nuevo en phpMyAdmin.
5. Enciende el servidor otra vez con `node server.js`.

Para subir tus propios cambios:

```
git add -A
git commit -m "descripcion de lo que cambiaste"
git push
```

Antes de hacer commit, revisa que `config.js` no aparezca en la lista de archivos.

---

## 11. Problemas comunes

| Síntoma | Causa y solución |
| --- | --- |
| `Cannot find module './config.js'` | No creaste `config.js`. Ve al paso 4. |
| `Cannot find module 'express'` (u otra librería) | Falta instalar las librerías. Corre `npm install`. |
| `error de mysql: connect ECONNREFUSED` | MySQL no está encendido. Dale Start en XAMPP. |
| `error de mysql: ... ER_BAD_DB_ERROR` | La base no existe. Corre `basedatos/outbreak.sql` (paso 3). |
| `error de mysql: Access denied for user 'root'` | La contraseña de `config.js` no coincide con la de tu MySQL. |
| `falta poner tu GOOGLE_CLIENT_ID en config.js` | `config.js` todavía tiene el valor de ejemplo. Ve al paso 5. |
| `EADDRINUSE: address already in use :::3000` | Ya hay un servidor corriendo en otra terminal. Ciérralo con `Ctrl + C` o cierra esa terminal. |
| El botón de Google no aparece o dice que el origen no está permitido | La dirección con la que abriste el juego no está en los orígenes autorizados del Client ID. Agrégala en Google Cloud y espera unos minutos. |
| Google dice que la app no está verificada o que no tienes acceso | Agrega tu correo en **Usuarios de prueba** de la pantalla de consentimiento. |
| Barra roja arriba: "EL SERVIDOR ESTÁ DESACTUALIZADO" | Estás corriendo una versión vieja del servidor. Apágalo, actualiza con `git pull` y vuelve a encenderlo. |
| En línea, a un compañero no le aparecen los zombies | Todos deben estar en la misma versión. Reinicien el servidor y vuelvan a entrar a la sala. |
| ngrok muestra `ERR_NGROK_8012` | El servidor no está encendido o no está en el puerto 3000. |
| No se escucha música | Faltan los mp3 en `cliente/audio/musica/`, o el navegador espera un primer clic o tecla para permitir audio. |
| Con touchpad no se puede girar ni disparar mientras caminas | Windows apaga el touchpad mientras se presionan teclas. Usa un mouse o desactiva esa protección en la configuración del panel táctil. |
| Los cambios no se ven en el navegador | Recarga sin caché con `Ctrl + F5`. Si cambiaste algo del servidor, reinícialo. |

---

## 12. Estructura de carpetas

```
OutBreak/
  server.js              punto de entrada del servidor (node server.js)
  config.ejemplo.js      plantilla de config.js
  package.json           librerías: express, socket.io, mysql2, cors
  servidor/              salas, login con Google, puntuaciones, audio y tiempo real
  basedatos/             outbreak.sql y actualizar.sql
  docs/                  documentos de la materia
  cliente/               todo lo que ve el navegador
    index.html           menú principal
    mapas.html           selección de mapa, modo y dificultad
    en-linea.html        crear o unirse a salas
    configuracion.html   opciones del jugador
    puntuaciones.html    ranking global y personal
    juego.html           pantalla del juego
    css/                 estilos de cada pantalla y del juego
    js/comun/            cursor, sonido y música (compartidos)
    js/juego/            el juego en 3D, partido en archivos que se cargan en orden desde arranque.js
    media/               video del menú, icono e imágenes
    audio/               música y efectos en mp3
```

**Tecnologías:** Three.js r128 (cargado por CDN), Node.js con Express, Socket.IO para el tiempo real, MySQL y Google Identity Services para el inicio de sesión.

---

## 13. Controles

| Tecla | Acción |
| --- | --- |
| W A S D | Moverse |
| Shift | Correr (gasta estamina) |
| Espacio | Saltar |
| Clic derecho (mantener) | Apuntar |
| Clic izquierdo | Disparar (solo apuntando) |
| R | Recargar |
| Q / rueda del mouse | Cambiar de arma (si compraste la escopeta) |
| 1 | Escudo |
| 2 | Granada paralizante |
| 3 | Bebida de estamina |
| E | Botiquín |
| F | Prender o apagar la linterna |
| TAB (mantener) | Ver el mapa completo |
| B | Tienda (entre oleadas, modo Resiste) |
| Enter | Comenzar oleada / Estoy listo (en línea) |
| ESC | Pausa (solo en solitario) |
