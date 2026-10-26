-- solo si ya tenias la base creada de antes, correlo una vez
-- deja guardar salas del modo por honor, antes solo aceptaba survival y escape
USE `bd_outbreak`;

ALTER TABLE `sala` MODIFY `Modo` VARCHAR(20) DEFAULT 'survival';
