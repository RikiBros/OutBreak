// puntero rojo y barra roja para desplazarse, para todas las pantallas
// usa el cursor del navegador con forma de mira, asi nunca se pierde detras de una ventana
(function () {
  function svg(r, dot, color, glow) {
    var s = r * 2 + 8, c = s / 2;
    return 'url("data:image/svg+xml;utf8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + s + '" height="' + s + '">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + (r + 1) + '" fill="none" stroke="black" stroke-opacity="0.55" stroke-width="3"/>' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="' + glow + '" stroke="' + color + '" stroke-width="2"/>' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + (dot + 1) + '" fill="black" fill-opacity="0.55"/>' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + dot + '" fill="' + color + '"/>' +
      '</svg>') + '") ' + c + ' ' + c;
  }
  var normal = svg(12, 2.5, '#E74C3C', 'none') + ', crosshair';
  var hover  = svg(16, 3.5, '#ff4d4d', 'rgba(231,76,60,0.18)') + ', pointer';

  var css =
    'html, body, html *, html *::before, html *::after { cursor: ' + normal + ' !important; }' +
    'html a, html button, html select, html label, html summary, html [onclick], html [role="button"],' +
    'html .menu-btn, html .btn, html .item-slot, html input[type="checkbox"], html input[type="radio"],' +
    'html input[type="range"], html .toggle, html .map-card, html .mode-card { cursor: ' + hover + ' !important; }' +
    'html button:disabled { cursor: ' + normal + ' !important; }' +
    'html input[type="text"], html textarea { cursor: text !important; }' +
    '#cursor { display: none !important; }' +
    // barra de desplazamiento roja en todas las pantallas
    '::-webkit-scrollbar { width: 10px; height: 10px; }' +
    '::-webkit-scrollbar-track { background: #0a0000; }' +
    '::-webkit-scrollbar-thumb { background: #5a0a0a; border: 1px solid #a01818; }' +
    '::-webkit-scrollbar-thumb:hover { background: #8a1010; }' +
    'html { scrollbar-color: #8a1010 #0a0000; }';

  // en los menus no en el juego la pagina se puede desplazar si no cabe en la ventana
  if (!/juego\.html$/i.test(location.pathname)) {
    css += 'html, body { overflow-y: auto !important; height: auto !important; min-height: 100vh; }';
  }

  var st = document.createElement('style');
  st.id = 'cursor-rojo';
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);
})();
