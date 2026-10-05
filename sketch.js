/* p5.js effects: Wind flow, Halftone dots, and WEBGL Metaballs. */
(() => {
  'use strict';

  const effects = {
    wind: {
      title: 'Wind flow', description: 'Un piccolo studio sul vento.',
      label: 'Scie bianche con teste luminose e code sfumate su fondo nero.',
      storageKey: 'wind-flow-settings-v2-dark',
      definitions: [
        { key: 'speed', label: 'Velocità', min: 0.1, max: 2, step: 0.05, value: 0.7, format: v => `${v.toFixed(2)}×` },
        { key: 'density', label: 'Densità', min: 0.3, max: 2.5, step: 0.1, value: 1.4, format: v => `${Math.round(v * 100)}%` },
        { key: 'length', label: 'Lunghezza scie', min: 30, max: 340, step: 10, value: 180, format: v => `${v} px` },
        { key: 'curve', label: 'Curvatura', min: 0, max: 2, step: 0.05, value: 1.25, format: v => `${Math.round(v * 100)}%` },
        { key: 'weight', label: 'Spessore', min: 0.3, max: 2, step: 0.1, value: 1.3, format: v => `${v.toFixed(1)} px` },
        { key: 'direction', label: 'Direzione', min: 0, max: 360, step: 5, value: 335, format: v => `${v}°` },
      ],
    },
    halftone: {
      title: 'Halftone dots', description: 'Forme in movimento, punti fermi.',
      label: 'Griglia regolare di punti neri su fondo bianco, con dimensioni che cambiano lentamente.',
      storageKey: 'halftone-settings-v1',
      definitions: [
        { key: 'speed', label: 'Velocità', min: 0.05, max: 2, step: 0.05, value: 0.45, format: v => `${v.toFixed(2)}×` },
        { key: 'spacing', label: 'Passo griglia', min: 8, max: 40, step: 1, value: 20, format: v => `${v} px` },
        { key: 'size', label: 'Dimensione dot', min: 0.2, max: 0.98, step: 0.01, value: 0.9, format: v => `${Math.round(v * 100)}%` },
        { key: 'scale', label: 'Scala delle forme', min: 100, max: 700, step: 10, value: 300, format: v => `${v} px` },
        { key: 'coverage', label: 'Copertura', min: 0.1, max: 0.9, step: 0.01, value: 0.55, format: v => `${Math.round(v * 100)}%` },
        { key: 'contrast', label: 'Contrasto', min: 0.4, max: 2.5, step: 0.05, value: 1.35, format: v => `${v.toFixed(2)}×` },
      ],
    },
    metaballs: {
      title: 'Metaballs', description: 'Cerchi che si incontrano e si fondono.',
      label: 'Cerchi color avorio in movimento su fondo scuro, con fusioni fluide quando si avvicinano.',
      storageKey: 'metaballs-settings-v1',
      definitions: [
        { key: 'speed', label: 'Velocità', min: 0.05, max: 2, step: 0.05, value: 0.65, format: v => `${v.toFixed(2)}×` },
        { key: 'count', label: 'Numero cerchi', min: 2, max: 32, step: 1, value: 20, format: v => `${Math.round(v)}` },
        { key: 'radius', label: 'Raggio cerchi', min: 20, max: 150, step: 1, value: 72, format: v => `${v} px` },
        { key: 'fusion', label: 'Fusione', min: 0, max: 2, step: 0.05, value: 1.15, format: v => `${Math.round(v * 100)}%` },
        { key: 'motion', label: 'Ampiezza movimento', min: 0, max: 2, step: 0.05, value: 1, format: v => `${Math.round(v * 100)}%` },
      ],
    },
  };
  const activeKey = 'p5-effects-active-v1';
  let activeEffect = 'halftone';
  for (const effect of Object.values(effects)) {
    effect.settings = Object.fromEntries(effect.definitions.map(d => [d.key, d.value]));
    try {
      const saved = JSON.parse(localStorage.getItem(effect.storageKey));
      for (const d of effect.definitions) {
        if (saved && Number.isFinite(saved[d.key])) effect.settings[d.key] = Math.max(d.min, Math.min(d.max, saved[d.key]));
      }
    } catch { /* Storage is optional, including when opened as a local file. */ }
  }
  try {
    const saved = localStorage.getItem(activeKey);
    if (Object.hasOwn(effects, saved)) activeEffect = saved;
  } catch { /* Optional. */ }

  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sketch, canvas, halftone, metaballs;
  let metaballsError = false;
  const controls = document.querySelector('.controls');
  const panel = document.querySelector('#panel');
  const toggle = document.querySelector('#toggle');
  const pause = document.querySelector('#pause');
  const picker = document.querySelector('#effect');

  function setPanel(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.title = open ? 'Nascondi parametri (H)' : 'Mostra parametri (H)';
    if (!open && panel.contains(document.activeElement)) toggle.focus();
  }
  function save() {
    const effect = effects[activeEffect];
    try { localStorage.setItem(effect.storageKey, JSON.stringify(effect.settings)); } catch { /* Optional. */ }
  }
  function updatePause() {
    pause.textContent = paused ? 'Riprendi' : 'Pausa';
    pause.setAttribute('aria-pressed', String(paused));
    controls.classList.toggle('is-paused', paused);
    if (sketch) paused || document.hidden ? sketch.noLoop() : sketch.loop();
  }
  function syncInputs() {
    const effect = effects[activeEffect];
    for (const d of effect.definitions) {
      document.getElementById(d.key).value = effect.settings[d.key];
      document.getElementById(`${d.key}-value`).value = d.format(effect.settings[d.key]);
    }
  }
  function showEffect() {
    const effect = effects[activeEffect];
    document.documentElement.dataset.effect = activeEffect;
    document.title = `${effect.title} · p5`;
    document.querySelector('meta[name="theme-color"]').content = activeEffect === 'halftone' ? '#ffffff' : activeEffect === 'metaballs' ? '#121212' : '#0a0a0a';
    document.querySelector('#panel-title').textContent = effect.title;
    document.querySelector('#panel-description').textContent = effect.description;
    document.querySelector('#toggle-label').textContent = effect.title;
    document.querySelector('#wind').setAttribute('aria-label', effect.label);
    document.querySelector('#regenerate').hidden = activeEffect === 'wind';
    document.querySelector('#effect-status').hidden = !(activeEffect === 'metaballs' && metaballsError);
    if (canvas) canvas.elt.setAttribute('aria-label', effect.label);
    picker.value = activeEffect;
    const sliders = document.querySelector('#sliders');
    sliders.replaceChildren();
    for (const d of effect.definitions) {
      const row = document.createElement('div');
      row.innerHTML = `<div class="control-label"><label for="${d.key}">${d.label}</label><output id="${d.key}-value" for="${d.key}"></output></div><input id="${d.key}" type="range" min="${d.min}" max="${d.max}" step="${d.step}">`;
      row.querySelector('input').addEventListener('input', event => {
        effect.settings[d.key] = Number(event.target.value);
        syncInputs();
        save();
        if (paused && sketch) sketch.redraw();
      });
      sliders.append(row);
    }
    syncInputs();
    if (sketch) sketch.redraw();
  }

  showEffect();
  updatePause();
  picker.addEventListener('change', () => {
    if (!Object.hasOwn(effects, picker.value)) return;
    activeEffect = picker.value;
    try { localStorage.setItem(activeKey, activeEffect); } catch { /* Optional. */ }
    showEffect();
  });
  toggle.addEventListener('click', () => setPanel(panel.hidden));
  document.querySelector('#close').addEventListener('click', () => setPanel(false));
  pause.addEventListener('click', () => { paused = !paused; updatePause(); });
  document.querySelector('#reset').addEventListener('click', () => {
    const effect = effects[activeEffect];
    for (const d of effect.definitions) effect.settings[d.key] = d.value;
    syncInputs();
    save();
    if (paused) sketch.redraw();
  });
  document.querySelector('#regenerate').addEventListener('click', () => {
    const effect = activeEffect === 'metaballs' ? metaballs : halftone;
    effect.setSeed(Math.floor(Math.random() * 4294967296));
    if (paused) sketch.redraw();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') setPanel(false);
    if (event.key.toLowerCase() === 'h' && !event.metaKey && !event.ctrlKey && !event.altKey && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) setPanel(panel.hidden);
  });
  document.addEventListener('visibilitychange', updatePause);

  sketch = new p5(p => {
    let time = 0;
    let flow, field;
    const windSettings = effects.wind.settings;

    function setResolution() {
      const desired = Math.max(2, Math.min(window.devicePixelRatio || 1, 3));
      const budget = Math.sqrt(24000000 / (window.innerWidth * window.innerHeight));
      p.pixelDensity(Math.max(1, Math.min(desired, budget)));
    }

    p.setup = () => {
      canvas = p.createCanvas(window.innerWidth, window.innerHeight);
      canvas.parent('wind');
      canvas.elt.setAttribute('aria-label', effects[activeEffect].label);
      canvas.elt.setAttribute('role', 'img');
      setResolution();
      p.frameRate(60);
      p.noiseSeed(83);
      p.noiseDetail(3, 0.5);
      halftone = new HalftoneEffect((x, y, z) => p.noise(x, y, z));
      metaballs = new MetaballsEffect(p);
      field = new WindField(p.width, p.height);
      field.configure(windSettings.direction, windSettings.curve);
      flow = new WindFlow(p.width, p.height, (a, b) => p.random(a, b), (x, y) => field.sample(x, y));
      if (paused) p.noLoop();
    };

    p.draw = () => {
      const settings = effects[activeEffect].settings;
      const dt = paused ? 0 : Math.min(p.deltaTime / 1000, 0.04) * settings.speed;
      if (activeEffect === 'halftone') {
        p.background(255);
        halftone.advance(dt);
        halftone.draw(p.drawingContext, p.width, p.height, settings);
      } else if (activeEffect === 'metaballs') {
        p.background(18);
        if (!metaballsError) {
          try {
            metaballs.advance(dt);
            metaballs.draw(p.width, p.height, settings);
          } catch (error) {
            metaballsError = true;
            const status = document.querySelector('#effect-status');
            status.textContent = 'Metaballs non è disponibile in questo browser. Prova ad abilitare l’accelerazione grafica oppure scegli un altro effetto.';
            status.hidden = false;
            console.error('Metaballs WebGL:', error);
          }
        }
      } else {
        time += dt;
        p.background(10);
        field.configure(windSettings.direction, windSettings.curve);
        flow.advance(dt * field.gust(time), windSettings);
        for (const strand of flow.strands) {
          drawWindTrail(p.drawingContext, flow.visiblePoints(strand), strand.alpha * strand.fade, windSettings.weight);
        }
      }
    };

    p.windowResized = () => {
      p.resizeCanvas(window.innerWidth, window.innerHeight, true);
      setResolution();
      field.resize(p.width, p.height);
      flow.reset(p.width, p.height);
      if (!metaballsError) metaballs.resize(p.width, p.height);
      if (paused) p.redraw();
    };
  });
})();
