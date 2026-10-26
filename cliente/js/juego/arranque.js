// arranque del juego, primero carga three y despues los demas archivos en orden
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import * as SkeletonUtilsMod from 'three/examples/jsm/utils/SkeletonUtils.js';

// three queda disponible para todos los archivos
window.THREE = THREE;
window.GLTFLoader = GLTFLoader;
window.PointerLockControls = PointerLockControls;
window.SkeletonUtilsMod = SkeletonUtilsMod;

// el orden importa, cada archivo usa cosas de los anteriores
const ARCHIVOS = [
  'datos', 'red', 'inicio', 'escena', 'mapas', 'controles', 'remotos', 'armas', 'zombies',
  'puntos', 'briefing', 'por-honor', 'objetos', 'mundo', 'tienda', 'hud', 'bucle',
];

function cargar(nombre) {
  return new Promise((listo, fallo) => {
    const s = document.createElement('script');
    s.src = 'js/juego/' + nombre + '.js';
    s.onload = listo;
    s.onerror = () => fallo(new Error('no se pudo cargar ' + nombre));
    document.body.appendChild(s);
  });
}

for (const nombre of ARCHIVOS) await cargar(nombre);
