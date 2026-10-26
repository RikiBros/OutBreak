-- base de datos de outbreak, se corre una sola vez en phpmyadmin o workbench
-- crea la base, las tablas y la vista del ranking

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

CREATE DATABASE IF NOT EXISTS `bd_outbreak`
  CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE `bd_outbreak`;

-- jugadores, las cuentas se crean solas al entrar con google
CREATE TABLE IF NOT EXISTS `usuario` (
  `ID_Usuario`  INT(11)      NOT NULL AUTO_INCREMENT,
  `Username`    VARCHAR(30)  NOT NULL,
  `Correo`      VARCHAR(80)  NOT NULL,
  `Google_ID`   VARCHAR(64)  DEFAULT NULL,
  `Foto`        VARCHAR(255) DEFAULT NULL,
  `Puntos`      INT(11)      DEFAULT 0,
  `Partidas`    INT(11)      DEFAULT 0,
  `Creado`      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID_Usuario`),
  UNIQUE KEY `uk_correo`   (`Correo`),
  UNIQUE KEY `uk_username` (`Username`),
  UNIQUE KEY `uk_google`   (`Google_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- historial de las salas en linea, modo es survival para resiste o zona para por honor
CREATE TABLE IF NOT EXISTS `sala` (
  `ID_Sala`      INT(11)     NOT NULL AUTO_INCREMENT,
  `Nombre`       VARCHAR(60) NOT NULL,
  `Mapa`         VARCHAR(50) NOT NULL,
  `Modo`         VARCHAR(20) DEFAULT 'survival',
  `MaxJugadores` INT(11)     DEFAULT 4,
  `ID_Host`      INT(11)     NOT NULL,
  `Estado`       ENUM('espera','en_juego','cerrada') DEFAULT 'espera',
  `Creada`       TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID_Sala`),
  KEY `fk_sala_host` (`ID_Host`),
  CONSTRAINT `fk_sala_host` FOREIGN KEY (`ID_Host`) REFERENCES `usuario` (`ID_Usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- cada fila es una partida terminada por un jugador
CREATE TABLE IF NOT EXISTS `puntuacion` (
  `ID_Puntuacion` INT(11)     NOT NULL AUTO_INCREMENT,
  `ID_Usuario`    INT(11)     NOT NULL,
  `Mapa`          VARCHAR(50) NOT NULL,
  `Modo`          VARCHAR(20) DEFAULT 'survival',
  `Puntos`        INT(11)     DEFAULT 0,
  `Oleada`        INT(11)     DEFAULT 1,
  `Bajas`         INT(11)     DEFAULT 0,
  `Sala`          VARCHAR(60) DEFAULT '',
  `Fecha`         TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ID_Puntuacion`),
  KEY `fk_punt_usuario` (`ID_Usuario`),
  CONSTRAINT `fk_punt_usuario` FOREIGN KEY (`ID_Usuario`) REFERENCES `usuario` (`ID_Usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

COMMIT;

-- ranking de todos, de mas puntos a menos
CREATE OR REPLACE VIEW `v_ranking` AS
  SELECT u.Username, p.Mapa, p.Modo, p.Puntos, p.Oleada, p.Bajas, p.Fecha
  FROM puntuacion p
  JOIN usuario u ON p.ID_Usuario = u.ID_Usuario
  ORDER BY p.Puntos DESC;
