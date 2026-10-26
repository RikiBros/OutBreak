// pantalla de configuracion, volumen, mouse, sombras y nombre del jugador


    // sincronizar slider valor visible mas relleno rojo
    function syncSlider(el, valId) {
      document.getElementById(valId).textContent = el.value;
      const pct = ((el.value - el.min) / (el.max - el.min) * 100).toFixed(1) + '%';
      el.style.setProperty('--pct', pct);
    }

    // inicializar relleno visual de todos los sliders
    document.querySelectorAll('input[type="range"].red-fill').forEach(s => {
      const pct = ((s.value - s.min) / (s.max - s.min) * 100).toFixed(1) + '%';
      s.style.setProperty('--pct', pct);
    });

    // persistencia
    // audio, controles y sombras se guardan en el navegador
    // el nombre se guarda en la base de datos y en la sesion
    const KEY    = 'outbreak_config';
    const SERVER = location.origin;

    function getUsuario() {
      try { return JSON.parse(localStorage.getItem('usuario_actual')); }
      catch (e) { return null; }
    }

    function showMsg(txt, ok) {
      const el = document.getElementById('save-msg');
      el.textContent = txt;
      el.className = 'show' + (ok ? ' ok' : '');
      clearTimeout(showMsg._t);
      showMsg._t = setTimeout(() => el.classList.remove('show'), 3000);
    }

    function loadConfig() {
      const cfg = JSON.parse(localStorage.getItem(KEY) || '{}');
      const set    = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };

      set('musicVolume', cfg.musicVolume ?? 100); setTxt('musicVal', cfg.musicVolume ?? 100);
      set('sfxVolume',   cfg.sfxVolume   ?? 45);  setTxt('sfxVal',   cfg.sfxVolume   ?? 45);
      set('sensitivity', cfg.sensitivity ?? 50);  setTxt('sensVal',  cfg.sensitivity ?? 50);
      setChk('invertY',  cfg.invertY     ?? false);
      setChk('shadows',  cfg.shadows     ?? true);

      // nombre viene de la cuenta con la que se inicio sesion
      const u = getUsuario();
      const nameInput = document.getElementById('playerName');
      if (u) {
        nameInput.value    = u.username || u.Username || '';
        nameInput.disabled = false;
      } else {
        nameInput.value    = '';
        nameInput.disabled = true;
      }

      // acomodar los sliders despues de cargar
      document.querySelectorAll('input[type="range"].red-fill').forEach(s => {
        const pct = ((s.value - s.min) / (s.max - s.min) * 100).toFixed(1) + '%';
        s.style.setProperty('--pct', pct);
      });
    }

    async function saveConfig() {
      const g = id => document.getElementById(id);

      // primero las opciones del navegador
      const cfg = {
        musicVolume: +g('musicVolume').value,
        sfxVolume:   +g('sfxVolume').value,
        sensitivity: +g('sensitivity').value,
        invertY:      g('invertY').checked,
        shadows:      g('shadows').checked,
      };
      localStorage.setItem(KEY, JSON.stringify(cfg));

      // luego el nombre, solo si cambio
      const u = getUsuario();
      const nuevo  = g('playerName').value.trim();
      const actual = u ? (u.username || u.Username || '') : '';

      if (!u || nuevo === actual) {
        showMsg('Configuración guardada', true);
        return;
      }
      if (!/^[A-Za-z0-9_\-ÁÉÍÓÚáéíóúÑñ]{3,20}$/.test(nuevo)) {
        showMsg('El nombre debe tener 3-20 letras, números, _ o - (sin espacios)');
        return;
      }

      try {
        const res  = await fetch(SERVER + '/perfil/' + u.id, {
          method : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ username: nuevo })
        });
        const data = await res.json();
        if (!res.ok) { showMsg(data.error || 'No se pudo cambiar el nombre'); return; }

        u.username = data.username;
        localStorage.setItem('usuario_actual', JSON.stringify(u));
        showMsg('Configuración y nombre guardados', true);
      } catch (e) {
        showMsg('Servidor offline. Ejecuta: node server.js');
      }
    }

    function resetConfig() {
      localStorage.removeItem(KEY);
      loadConfig();
      showMsg('Opciones restablecidas', true);
    }

    loadConfig();
