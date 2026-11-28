/**
 * app.js - UI controller, expression list, sliders, examples, 2D/3D/ND mode toggle,
 * PC benchmark runner and persistent state in localStorage.
 */
(function () {
  'use strict';

  const PALETTE = ['#2b45d4', '#d12c38', '#0f8a5f', '#d97706', '#7c3aed',
    '#0891b2', '#db2777', '#4f46e5', '#65a30d', '#334155', '#ea580c', '#0d9488'];

  const EXAMPLES = [
    {
      name: 'Getting started',
      view: [-8, 8, -5, 5],
      lines: [
        { text: 'y = a sin(b x)', color: '#2b45d4' },
        { text: 'y = 0.2 x^2 - 2', color: '#0f8a5f' },
      ],
      lines3d: [
        { text: 'z = a sin(b x) cos(b y)', color: '#2b45d4' },
        { text: 'z = 0.15 (x^2 - y^2) - 2', color: '#0f8a5f' },
      ],
      params: { a: { value: 2, min: -5, max: 5, step: 0.05 }, b: { value: 1.5, min: 0.2, max: 5, step: 0.05 } },
    },
    {
      name: 'Traveling wave',
      view: [-10, 10, -3.5, 3.5],
      lines: [
        { text: 'y = sin(x - t) + 0.5 sin(2x + t)', color: '#2b45d4' },
        { text: 'y = sin(x - t)', color: '#94a3b8', dash: 'dashed', thickness: 1.5 },
      ],
      lines3d: [
        { text: 'z = sin(x - t) cos(y) + 0.5 sin(2x + t)', color: '#2b45d4' },
      ],
      params: { t: { value: 0, min: 0, max: 12.56, step: 0.05, play: true } },
    },
    {
      name: 'Derivatives & tangent',
      view: [-4.5, 4.5, -4, 6],
      lines: [
        { text: 'f(x) = 0.25 x^3 - 1.5 x + 1', color: '#2b45d4' },
        { text: "y = f'(x)", color: '#0f8a5f', dash: 'dashed' },
        { text: "y = f(a) + f'(a)(x - a)", color: '#d12c38' },
        { text: '(a, f(a))', color: '#d12c38' },
      ],
      lines3d: [
        { text: 'z = 0.15 (x^3 - 3 x y^2) + 1', color: '#2b45d4' },
        { text: '(a, 0, 0.15 a^3 + 1)', color: '#d12c38' },
      ],
      params: { a: { value: 1.2, min: -3.5, max: 3.5, step: 0.05 } },
    },
    {
      name: 'Polar flower',
      view: [-4.5, 4.5, -4.5, 4.5],
      lines: [{ text: 'r = 3.5 cos(k θ)', color: '#7c3aed', tMin: '0', tMax: '2pi' }],
      lines3d: [
        { text: 'z = 2.5 exp(-0.18 (x^2 + y^2)) cos(k atan2(y, x))', color: '#7c3aed' },
      ],
      params: { k: { value: 5, min: 1, max: 12, step: 1 } },
    },
    {
      name: 'Butterfly',
      view: [-4.5, 4.5, -3.5, 4.5],
      lines: [{ text: '(sin(t)(exp(cos(t)) - 2 cos(4t) - sin(t/12)^5), cos(t)(exp(cos(t)) - 2 cos(4t) - sin(t/12)^5))', color: '#db2777', tMin: '0', tMax: '12pi' }],
      lines3d: [{ text: '(sin(t)(exp(cos(t)) - 2 cos(4t) - sin(t/12)^5), cos(t)(exp(cos(t)) - 2 cos(4t) - sin(t/12)^5), 1.4 sin(2t))', color: '#db2777', tMin: '0', tMax: '12pi' }],
    },
    {
      name: 'Heart',
      view: [-2.2, 2.2, -1.8, 2.2],
      lines: [{ text: '(x^2 + y^2 - 1)^3 = x^2 y^3', color: '#d12c38', thickness: 3 }],
      lines3d: [{ text: 'z = 1.6 sqrt(max(0, 1 - (x^2 + (y - 0.5 sqrt(|x|))^2) / 2.2))', color: '#d12c38' }],
    },
    {
      name: 'Lissajous curves',
      view: [-4.5, 4.5, -4.5, 4.5],
      lines: [{ text: '(3.5 sin(3t + d), 3.5 sin(4t))', color: '#0891b2', tMin: '0', tMax: '2pi' }],
      lines3d: [{ text: '(3.5 sin(3t + d), 3.5 sin(4t), 2.5 cos(5t))', color: '#0891b2', tMin: '0', tMax: '2pi' }],
      params: { d: { value: 0.7, min: 0, max: 6.28, step: 0.05, play: true } },
    },
    {
      name: 'Regions',
      view: [-6, 6, -4.5, 4.5],
      lines: [
        { text: 'x^2 + y^2 ≤ 9', color: '#2b45d4' },
        { text: 'y > 0.4 x^2 - 2', color: '#0f8a5f' },
      ],
      lines3d: [
        { text: 'z = 3 - 0.35 (x^2 + y^2)', color: '#2b45d4' },
        { text: 'z = 0.25 (x^2 - y^2)', color: '#0f8a5f' },
      ],
    },
    {
      name: 'Asymptotes & jumps',
      view: [-6, 6, -6, 6],
      lines: [
        { text: 'y = (x^2 - 1) / (x - 2)', color: '#2b45d4' },
        { text: 'y = floor(x)', color: '#d97706' },
      ],
      lines3d: [
        { text: 'z = (x^2 - y^2) / (x^2 + y^2 + 0.4)', color: '#2b45d4' },
        { text: 'z = 0.5 (floor(x) + floor(y))', color: '#d97706' },
      ],
    },
    {
      name: "Gabriel's horn",
      view: [-0.5, 11, -3, 3],
      revolve3d: true,
      lines: [
        { text: 'y = 1 / x {x ≥ 1}', color: '#2b45d4' },
        { text: 'y = -1 / x {x ≥ 1}', color: '#2b45d4' },
      ],
      lines3d: [
        { text: 'y = 1.4 / x {x ≥ 0.6}', color: '#2b45d4' },
      ],
    },
  ];

  const STORAGE = 'grapher.v1';
  const $ = (s, p = document) => p.querySelector(s);
  const canvas = $('#canvas');
  const canvas3d = $('#canvas3d');
  const graph = new Graph(canvas);
  const graph3d = new Graph3D(canvas3d);
  const polytope = typeof PolytopeND === 'function' ? new PolytopeND(canvas3d) : null;

  const state = {
    lines: [],
    params: {},
    options: { grid: true, axes: true, trace: true, equal: false, dark: false },
    nextId: 1,
    mode3d: false,
    polytopeMode: false,
    activeExample: null,
  };

  let compiled = { lines: [], parameters: [] };
  let globals = Object.create(null);
  let activeInput = null;
  let dirty = true;
  let fastUntil = 0;
  let styleTarget = null;
  let stylePop = null;
  let benchUntil = 0;

  const radToDeg = (rad) => Math.round((rad * 180) / Math.PI);

  const requestDraw = (fast = false) => {
    dirty = true;
    fastUntil = fast ? performance.now() + 140 : 0;
  };

  function save() {
    try {
      graph.syncBounds();
      localStorage.setItem(STORAGE, JSON.stringify({
        lines: state.lines,
        params: state.params,
        options: state.options,
        view: [graph.view.xmin, graph.view.xmax, graph.view.ymin, graph.view.ymax],
        mode3d: state.mode3d,
        polytopeMode: state.polytopeMode,
        polytopeDim: polytope ? polytope.dim : 4,
        polytopeShape: polytope ? polytope.shape : 'hypercube',
        polytopeFormula: polytope ? polytope.formulaText : '',
        mechEnabled: polytope ? polytope.mechEnabled : false,
        mechStyle: polytope ? polytope.mechStyle : 'truss',
        mechSubdivisions: polytope ? polytope.mechSubdivisions : 2,
        quality3d: graph3d.quality,
        revolve3d: graph3d.revolveMode,
        camera3d: graph3d.camera,
      }));
    } catch (_) {}
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE));
      if (!raw || !Array.isArray(raw.lines) || !raw.lines.length) return false;
      state.lines = raw.lines;
      state.nextId = Math.max(0, ...state.lines.map((l) => l.id || 0)) + 1;
      state.params = raw.params || {};
      Object.assign(state.options, raw.options);
      if (Array.isArray(raw.view) && raw.view.length === 4) graph.setView(...raw.view);
      state.mode3d = Boolean(raw.mode3d);
      state.polytopeMode = Boolean(raw.polytopeMode);
      if (polytope) {
        if (raw.polytopeDim) polytope.setDimension(raw.polytopeDim);
        if (raw.polytopeShape) polytope.setShape(raw.polytopeShape);
        if (raw.polytopeFormula) polytope.setFormula(raw.polytopeFormula);
        if (raw.mechEnabled) polytope.setMechEnabled(Boolean(raw.mechEnabled));
        if (raw.mechStyle) polytope.setMechStyle(raw.mechStyle);
        if (raw.mechSubdivisions) polytope.setMechSubdivisions(raw.mechSubdivisions);
      }
      if (raw.quality3d) graph3d.quality = raw.quality3d;
      if (raw.revolve3d) graph3d.revolveMode = Boolean(raw.revolve3d);
      if (raw.camera3d) {
        graph3d.camera = {
          yaw: Number.isFinite(raw.camera3d.yaw) ? raw.camera3d.yaw : -0.68,
          pitch: Number.isFinite(raw.camera3d.pitch) ? raw.camera3d.pitch : 0.42,
          distance: Number.isFinite(raw.camera3d.distance) ? raw.camera3d.distance : 8.5,
          range: Number.isFinite(raw.camera3d.range) ? raw.camera3d.range : 3.5,
          target: {
            x: Number.isFinite(raw.camera3d.target?.x) ? raw.camera3d.target.x : 0,
            y: Number.isFinite(raw.camera3d.target?.y) ? raw.camera3d.target.y : 0,
            z: Number.isFinite(raw.camera3d.target?.z) ? raw.camera3d.target.z : 0,
          },
        };
      }
      return true;
    } catch (_) { return false; }
  }

  function recompile() {
    globals = Object.create(null);
    for (const [k, p] of Object.entries(state.params)) globals[k] = p.value;
    compiled = Formulas.compileAll(state.lines.map((l) => l.text), globals);

    const used = new Set(compiled.parameters);
    for (const k of Object.keys(state.params)) if (!used.has(k)) delete state.params[k];
    for (const k of compiled.parameters) {
      if (!state.params[k]) state.params[k] = { value: 1, min: -5, max: 5, step: 0.05, play: false };
      globals[k] = state.params[k].value;
    }

    state.lines.forEach((line, i) => {
      const card = $(`.card[data-id="${line.id}"]`);
      if (!card) return;
      const res = compiled.lines[i];
      const err = $('.err-msg', card);
      const meta = $('.card-meta', card);
      const range = $('.range-row', card);
      const badge = $('.val-badge', card);

      card.classList.toggle('has-error', res.type === 'error');
      err.hidden = res.type !== 'error';
      err.textContent = res.error || '';

      const needsRange = res.usesRange;
      let valText = '';
      if (res.type === 'constant') {
        const v = res.literal ? res.value : res.evaluate();
        if (Number.isFinite(v)) valText = `= ${+v.toPrecision(7)}`;
      }
      range.hidden = !needsRange;
      badge.hidden = !valText;
      badge.textContent = valText;
      meta.hidden = !needsRange && !valText;
    });

    renderParams();
    save();
    requestDraw();
  }

  function objectsToDraw() {
    const out = [];
    state.lines.forEach((line, i) => {
      if (!line.visible) return;
      const o = compiled.lines[i];
      if (!o || ['empty', 'error', 'constant', 'function'].includes(o.type)) return;
      const a = Formulas.evaluateNumber(line.tMin);
      const b = Formulas.evaluateNumber(line.tMax);
      const defB = o.type === 'polar' ? 2 * Math.PI : 10;
      const range = [Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : defB];
      const dash = line.dash || 'solid';
      out.push({
        id: line.id,
        o,
        range,
        style: { color: line.color, thickness: line.thickness || 2.4, dash, stroke: dash },
      });
    });
    return out;
  }

  const listEl = $('#formula-list');

  function makeLine(data = {}) {
    const color = data.color || PALETTE[(state.nextId - 1) % PALETTE.length];
    return {
      id: state.nextId++,
      text: data.text || '',
      color,
      visible: data.visible !== false,
      thickness: data.thickness || 2.4,
      dash: data.dash || 'solid',
      tMin: data.tMin ?? '0',
      tMax: data.tMax ?? '2pi',
    };
  }

  function renderList() {
    listEl.innerHTML = '';
    for (const line of state.lines) listEl.appendChild(createCard(line));
  }

  function createCard(line) {
    const card = document.createElement('div');
    card.className = 'card' + (line.visible ? '' : ' hidden-line');
    card.dataset.id = line.id;
    card.innerHTML = `
      <div class="card-row">
        <button type="button" class="swatch${line.visible ? '' : ' off'}" style="background:${line.color}" title="Color and style"></button>
        <input type="text" class="formula-input" spellcheck="false" autocomplete="off" placeholder="Write a formula, e.g. y = sin(x) or z = sin(x) cos(y)">
        <div class="card-tools">
          <button type="button" class="mini-btn eye" title="Show / hide">👁</button>
          <button type="button" class="mini-btn dup" title="Duplicate">⧉</button>
          <button type="button" class="mini-btn del" title="Delete">✕</button>
        </div>
      </div>
      <div class="card-meta" hidden>
        <div class="range-row" hidden>
          <span>from</span><input type="text" class="tmin" value="${line.tMin}">
          <span>to</span><input type="text" class="tmax" value="${line.tMax}">
        </div>
        <span class="val-badge" hidden></span>
      </div>
      <div class="err-msg" hidden></div>`;

    const input = $('.formula-input', card);
    input.value = line.text;
    input.addEventListener('focus', () => { activeInput = input; });
    input.addEventListener('input', () => {
      line.text = input.value;
      state.activeExample = null;
      recompile();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const idx = state.lines.indexOf(line);
        const created = addLine({}, idx + 1);
        created.focus();
      } else if (e.key === 'Backspace' && !input.value && state.lines.length > 1) {
        e.preventDefault();
        const idx = state.lines.indexOf(line);
        removeLine(line.id);
        const prev = listEl.children[Math.max(0, idx - 1)];
        if (prev) $('.formula-input', prev).focus();
      } else if (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        moveLine(line.id, e.key === 'ArrowUp' ? -1 : 1);
      }
    });

    const swatch = $('.swatch', card);
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      openStylePop(line, swatch);
    });

    $('.eye', card).addEventListener('click', () => {
      line.visible = !line.visible;
      card.classList.toggle('hidden-line', !line.visible);
      swatch.classList.toggle('off', !line.visible);
      save();
      requestDraw();
    });
    $('.dup', card).addEventListener('click', () => {
      const idx = state.lines.indexOf(line);
      addLine({ ...line }, idx + 1).focus();
    });
    $('.del', card).addEventListener('click', () => removeLine(line.id));

    for (const cls of ['tmin', 'tmax']) {
      const el = $('.' + cls, card);
      el.addEventListener('input', () => {
        line[cls === 'tmin' ? 'tMin' : 'tMax'] = el.value;
        save();
        requestDraw();
      });
    }
    return card;
  }

  function addLine(data = {}, at = state.lines.length) {
    const line = makeLine(data);
    state.lines.splice(at, 0, line);
    const card = createCard(line);
    listEl.insertBefore(card, listEl.children[at] || null);
    recompile();
    return $('.formula-input', card);
  }

  function removeLine(id) {
    if (state.lines.length <= 1) {
      state.lines[0].text = '';
      renderList();
      recompile();
      return;
    }
    const idx = state.lines.findIndex((l) => l.id === id);
    if (idx < 0) return;
    state.lines.splice(idx, 1);
    listEl.children[idx].remove();
    recompile();
  }

  function moveLine(id, dir) {
    const i = state.lines.findIndex((l) => l.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= state.lines.length) return;
    [state.lines[i], state.lines[j]] = [state.lines[j], state.lines[i]];
    renderList();
    recompile();
    $('.formula-input', listEl.children[j]).focus();
  }

  function closeStylePop() {
    if (stylePop) { stylePop.remove(); stylePop = null; styleTarget = null; }
  }

  function openStylePop(line, anchor) {
    if (styleTarget === line.id) { closeStylePop(); return; }
    closeStylePop();
    styleTarget = line.id;
    const pop = document.createElement('div');
    pop.className = 'style-pop';
    pop.innerHTML = `
      <div class="colors">${PALETTE.map((c) => `<button type="button" data-c="${c}" style="background:${c}" class="${c === line.color ? 'active' : ''}"></button>`).join('')}</div>
      <div class="style-row"><span>Stroke</span>
        <div class="seg">
          <button type="button" data-d="solid" class="${line.dash === 'solid' ? 'active' : ''}">Solid</button>
          <button type="button" data-d="dashed" class="${line.dash === 'dashed' ? 'active' : ''}">Dashed</button>
          <button type="button" data-d="dotted" class="${line.dash === 'dotted' ? 'active' : ''}">Dotted</button>
        </div>
      </div>
      <div class="style-row"><span>Thickness</span><input type="range" min="1" max="6" step="0.2" value="${line.thickness}"></div>`;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.min(window.innerWidth - 236, r.left) + 'px';
    pop.style.top = Math.min(window.innerHeight - 170, r.bottom + 6) + 'px';

    pop.addEventListener('click', (e) => e.stopPropagation());
    pop.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => {
      line.color = b.dataset.c;
      anchor.style.background = line.color;
      pop.querySelectorAll('[data-c]').forEach((x) => x.classList.toggle('active', x === b));
      save();
      requestDraw();
    }));
    pop.querySelectorAll('[data-d]').forEach((b) => b.addEventListener('click', () => {
      line.dash = b.dataset.d;
      pop.querySelectorAll('[data-d]').forEach((x) => x.classList.toggle('active', x === b));
      save();
      requestDraw();
    }));
    $('input[type="range"]', pop).addEventListener('input', (e) => {
      line.thickness = parseFloat(e.target.value);
      save();
      requestDraw(true);
    });
    stylePop = pop;
  }

  const paramsSec = $('#params-section');
  const paramsEl = $('#params');

  function renderParams() {
    const names = Object.keys(state.params);
    paramsSec.hidden = !names.length;
    paramsEl.innerHTML = '';
    for (const name of names) {
      const p = state.params[name];
      const row = document.createElement('div');
      row.className = 'param';
      row.innerHTML = `
        <div class="param-top">
          <button type="button" class="mini-btn play" title="Animate">${p.play ? '⏸' : '▶'}</button>
          <span class="param-name">${name} =</span>
          <input type="text" class="param-val" value="${p.value}">
          <div class="param-bounds">
            <input type="text" class="pmin" value="${p.min}" title="Minimum">
            <span>…</span>
            <input type="text" class="pmax" value="${p.max}" title="Maximum">
          </div>
        </div>
        <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.value}">`;

      const slider = $('input[type="range"]', row);
      const valIn = $('.param-val', row);
      const playBtn = $('.play', row);

      const setVal = (v) => {
        if (!Number.isFinite(v)) return;
        p.value = +v.toPrecision(6);
        globals[name] = p.value;
        valIn.value = p.value;
        slider.value = p.value;
        compiled.lines.forEach((l, idx) => {
          if (l.type === 'constant' && !l.literal && state.lines[idx]) {
            const b = $(`.card[data-id="${state.lines[idx].id}"] .val-badge`);
            const cv = l.evaluate();
            if (b && Number.isFinite(cv)) b.textContent = `= ${+cv.toPrecision(7)}`;
          }
        });
        requestDraw(true);
      };

      slider.addEventListener('input', () => setVal(parseFloat(slider.value)));
      slider.addEventListener('change', save);
      valIn.addEventListener('change', () => {
        const v = Formulas.evaluateNumber(valIn.value);
        if (Number.isFinite(v)) {
          if (v < p.min) { p.min = v; slider.min = v; $('.pmin', row).value = v; }
          if (v > p.max) { p.max = v; slider.max = v; $('.pmax', row).value = v; }
          setVal(v);
          save();
        } else {
          valIn.value = p.value;
        }
      });
      for (const cls of ['pmin', 'pmax']) {
        const b = $('.' + cls, row);
        b.addEventListener('change', () => {
          const v = Formulas.evaluateNumber(b.value);
          if (!Number.isFinite(v)) { b.value = p[cls === 'pmin' ? 'min' : 'max']; return; }
          if (cls === 'pmin' && v < p.max) { p.min = v; slider.min = v; }
          if (cls === 'pmax' && v > p.min) { p.max = v; slider.max = v; }
          p.step = +((p.max - p.min) / 200).toPrecision(2) || 0.01;
          slider.step = p.step;
          save();
        });
      }
      playBtn.addEventListener('click', () => {
        p.play = !p.play;
        playBtn.textContent = p.play ? '⏸' : '▶';
        save();
      });

      row._sync = () => { valIn.value = p.value; slider.value = p.value; };
      paramsEl.appendChild(row);
    }
  }

  const viewInputs = { xmin: $('#xmin'), xmax: $('#xmax'), ymin: $('#ymin'), ymax: $('#ymax') };

  function syncViewInputs() {
    graph.syncBounds();
    for (const k of Object.keys(viewInputs)) {
      if (document.activeElement !== viewInputs[k]) {
        viewInputs[k].value = +graph.view[k].toPrecision(5);
      }
    }
  }

  for (const [k, el] of Object.entries(viewInputs)) {
    el.addEventListener('change', () => {
      const v = Formulas.evaluateNumber(el.value);
      if (!Number.isFinite(v)) { syncViewInputs(); return; }
      graph.syncBounds();
      const next = { ...graph.view, [k]: v };
      if (next.xmax > next.xmin && next.ymax > next.ymin) {
        graph.setView(next.xmin, next.xmax, next.ymin, next.ymax);
        if (state.options.equal) graph.equalize();
        save();
        requestDraw();
      }
      syncViewInputs();
    });
  }

  function bindOption(id, key, after) {
    const el = $(id);
    if (!el) return;
    el.checked = !!state.options[key];
    el.addEventListener('change', () => {
      state.options[key] = el.checked;
      if (after) after();
      save();
      requestDraw();
    });
  }
  bindOption('#opt-grid', 'grid');
  bindOption('#opt-axes', 'axes');
  bindOption('#opt-trace', 'trace', () => { if (!state.options.trace) graph.pinned = null; });
  bindOption('#opt-equal', 'equal', () => { if (state.options.equal) { graph.equalize(); syncViewInputs(); } });

  const btnMode3d = $('#btn-mode3d');
  const perfHud = $('#perf-hud');
  const ndBar = $('#nd-bar');
  const ndDrawer = $('#nd-drawer');
  const ndFormulaInput = $('#nd-formula');
  const ndFormulaErr = $('#nd-formula-err');
  const ndPlanesEl = $('#nd-planes');
  const btnNdFormulaClear = $('#btn-nd-formula-clear');
  const btnNdMech = $('#btn-nd-mech');
  const ndMechStyleSelect = $('#nd-mech-style');
  const ndMechSegsSelect = $('#nd-mech-segs');
  const meshSelect = $('#mesh-quality');
  const btnRevolve = $('#btn-revolve');
  const btnStress = $('#btn-stress');
  const ndDimSelect = $('#nd-dim');
  const ndShapeSelect = $('#nd-shape');
  const btnNdSpin = $('#btn-nd-spin');

  function renderNDPlanes() {
    if (!ndPlanesEl || !polytope) return;
    const planes = PolytopeND.listRotationPlanes(polytope.dim);
    ndPlanesEl.innerHTML = '';
    for (const p of planes) {
      const val = polytope.angles[p.key] || 0;
      const deg = radToDeg(val);
      const wrap = document.createElement('div');
      wrap.className = 'nd-plane';
      wrap.innerHTML = `
        <div class="nd-plane-head"><span>${p.label}</span><span class="nd-deg">${deg}°</span></div>
        <input type="range" min="-3.1416" max="3.1416" step="0.02" value="${val.toFixed(3)}">`;
      const slider = $('input[type="range"]', wrap);
      const degLabel = $('.nd-deg', wrap);
      slider.addEventListener('input', () => {
        const rad = parseFloat(slider.value);
        polytope.angles[p.key] = rad;
        degLabel.textContent = `${radToDeg(rad)}°`;
        state.polytopeMode = true;
        if (!state.mode3d) setMode3D(true);
        requestDraw(true);
      });
      ndPlanesEl.appendChild(wrap);
    }
  }

  function syncNDPlanesUI() {
    if (!ndPlanesEl || !polytope) return;
    const planes = PolytopeND.listRotationPlanes(polytope.dim);
    const items = ndPlanesEl.children;
    planes.forEach((p, idx) => {
      const item = items[idx];
      if (!item) return;
      const rad = polytope.angles[p.key] || 0;
      const slider = $('input[type="range"]', item);
      const degLabel = $('.nd-deg', item);
      if (slider && document.activeElement !== slider) slider.value = rad.toFixed(3);
      if (degLabel) degLabel.textContent = `${radToDeg(rad)}°`;
    });
  }

  if (ndFormulaInput && polytope) {
    ndFormulaInput.value = polytope.formulaText || '';
    ndFormulaInput.addEventListener('input', () => {
      const res = polytope.setFormula(ndFormulaInput.value);
      if (ndFormulaErr) {
        ndFormulaErr.hidden = !res.error;
        ndFormulaErr.textContent = res.error;
      }
      if (!res.error) {
        state.polytopeMode = true;
        if (!state.mode3d) setMode3D(true);
        save();
        requestDraw();
      }
    });
  }

  if (btnNdFormulaClear && polytope) {
    btnNdFormulaClear.addEventListener('click', () => {
      if (ndFormulaInput) ndFormulaInput.value = '';
      polytope.setFormula('');
      if (ndFormulaErr) ndFormulaErr.hidden = true;
      save();
      requestDraw();
    });
  }

  if (btnNdMech && polytope) {
    btnNdMech.setAttribute('aria-pressed', String(polytope.mechEnabled));
    btnNdMech.addEventListener('click', () => {
      polytope.setMechEnabled(!polytope.mechEnabled);
      btnNdMech.setAttribute('aria-pressed', String(polytope.mechEnabled));
      state.polytopeMode = true;
      if (!state.mode3d) setMode3D(true);
      save();
      requestDraw();
    });
  }

  if (ndMechStyleSelect && polytope) {
    ndMechStyleSelect.value = polytope.mechStyle;
    ndMechStyleSelect.addEventListener('change', () => {
      polytope.setMechStyle(ndMechStyleSelect.value);
      polytope.setMechEnabled(true);
      if (btnNdMech) btnNdMech.setAttribute('aria-pressed', 'true');
      state.polytopeMode = true;
      if (!state.mode3d) setMode3D(true);
      save();
      requestDraw();
    });
  }

  if (ndMechSegsSelect && polytope) {
    ndMechSegsSelect.value = String(polytope.mechSubdivisions);
    ndMechSegsSelect.addEventListener('change', () => {
      polytope.setMechSubdivisions(Number(ndMechSegsSelect.value));
      polytope.setMechEnabled(true);
      if (btnNdMech) btnNdMech.setAttribute('aria-pressed', 'true');
      state.polytopeMode = true;
      if (!state.mode3d) setMode3D(true);
      save();
      requestDraw();
    });
  }

  if (ndDimSelect && polytope) {
    ndDimSelect.value = String(polytope.dim);
    ndDimSelect.addEventListener('change', () => {
      polytope.setDimension(Number(ndDimSelect.value));
      renderNDPlanes();
      if (!state.mode3d) setMode3D(true);
      state.polytopeMode = true;
      save();
      requestDraw();
    });
  }

  if (ndShapeSelect && polytope) {
    ndShapeSelect.value = polytope.shape;
    ndShapeSelect.addEventListener('change', () => {
      polytope.setShape(ndShapeSelect.value);
      if (!state.mode3d) setMode3D(true);
      state.polytopeMode = true;
      save();
      requestDraw();
    });
  }

  if (btnNdSpin && polytope) {
    btnNdSpin.setAttribute('aria-pressed', String(polytope.autoRotate));
    btnNdSpin.addEventListener('click', () => {
      polytope.autoRotate = !polytope.autoRotate;
      btnNdSpin.setAttribute('aria-pressed', String(polytope.autoRotate));
      requestDraw();
    });
  }

  function updateMode3DUI() {
    btnMode3d.setAttribute('aria-pressed', String(state.mode3d));
    canvas.hidden = state.mode3d;
    canvas3d.hidden = !state.mode3d;
    if (perfHud) perfHud.hidden = !state.mode3d;
    if (ndBar) ndBar.hidden = !state.mode3d;
    if (ndDrawer) ndDrawer.hidden = !state.mode3d;
    if (btnNdMech && polytope) btnNdMech.setAttribute('aria-pressed', String(polytope.mechEnabled));
    if (ndMechStyleSelect && polytope) ndMechStyleSelect.value = polytope.mechStyle;
    if (ndMechSegsSelect && polytope) ndMechSegsSelect.value = String(polytope.mechSubdivisions);
    if (ndDimSelect && polytope) ndDimSelect.value = String(polytope.dim);
    if (ndShapeSelect && polytope) ndShapeSelect.value = polytope.shape;
    if (meshSelect) meshSelect.value = graph3d.quality;
    if (btnRevolve) btnRevolve.setAttribute('aria-pressed', String(graph3d.revolveMode));
    if (state.mode3d) {
      graph3d.resize();
      if (polytope) {
        polytope.resize();
        renderNDPlanes();
      }
      $('#coords').textContent = state.polytopeMode && polytope
        ? `${polytope.dim}D ${polytope.shape} · Drag to orbit · Shift/Right-drag to pan`
        : 'Drag to orbit · Shift/Right-drag to pan · Wheel to zoom';
    } else {
      graph.resize();
      syncViewInputs();
    }
  }

  function setMode3D(enabled) {
    state.mode3d = enabled;
    if (!enabled) state.polytopeMode = false;
    if (state.activeExample !== null && EXAMPLES[state.activeExample]) {
      loadExample(EXAMPLES[state.activeExample], state.activeExample, true);
      return;
    }
    updateMode3DUI();
    save();
    requestDraw();
  }

  btnMode3d.addEventListener('click', () => setMode3D(!state.mode3d));

  if (meshSelect) {
    meshSelect.addEventListener('change', () => {
      state.polytopeMode = false;
      graph3d.quality = meshSelect.value;
      save();
      requestDraw();
    });
  }

  if (btnRevolve) {
    btnRevolve.addEventListener('click', () => {
      state.polytopeMode = false;
      graph3d.revolveMode = !graph3d.revolveMode;
      btnRevolve.setAttribute('aria-pressed', String(graph3d.revolveMode));
      save();
      requestDraw();
    });
  }

  if (btnStress) {
    btnStress.addEventListener('click', () => {
      state.polytopeMode = false;
      if (!state.mode3d) setMode3D(true);
      benchUntil = performance.now() + 3000;
      requestDraw();
    });
  }

  function updatePerfHud() {
    if (!state.mode3d || !perfHud) return;
    const m = graph3d.metrics;
    $('#perf-fps').textContent = m.fps;
    $('#perf-frame').textContent = m.frameMs.toFixed(1);
    $('#perf-mesh').textContent = m.meshMs.toFixed(1);
    $('#perf-tris').textContent = m.triangles.toLocaleString();
    const badge = $('#perf-rating');
    badge.textContent = benchUntil > performance.now() ? 'Benchmarking…' : m.rating;
    badge.className = 'perf-badge' + (m.rating === 'Moderate' ? ' moderate' : m.rating === 'Heavy' ? ' heavy' : '');
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.options.dark ? 'dark' : 'light';
    requestDraw();
  }
  $('#btn-theme').addEventListener('click', () => {
    state.options.dark = !state.options.dark;
    applyTheme();
    save();
  });

  function canvasTheme() {
    const s = getComputedStyle(document.documentElement);
    return {
      bg: s.getPropertyValue('--bg').trim(),
      gridFine: state.options.dark ? 'rgba(255,255,255,.045)' : 'rgba(15,23,42,.055)',
      gridMajor: state.options.dark ? 'rgba(255,255,255,.10)' : 'rgba(15,23,42,.11)',
      axis: state.options.dark ? 'rgba(255,255,255,.42)' : 'rgba(15,23,42,.45)',
      text: s.getPropertyValue('--muted').trim(),
      labelBg: s.getPropertyValue('--panel').trim(),
    };
  }

  const coordsEl = $('#coords');
  const pointers = new Map();
  let drag = null;
  let pinch = null;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      drag = { x: e.clientX, y: e.clientY, view: { ...graph.view }, moved: false };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: [(a.x + b.x) / 2, (a.y + b.y) / 2] };
      drag = null;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 4 && pinch.dist > 4) {
        const factor = d / pinch.dist;
        graph.zoom(factor, factor, pinch.mid[0] - r.left, pinch.mid[1] - r.top);
        syncViewInputs();
        requestDraw(true);
      }
      pinch.dist = d;
      return;
    }

    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) > 3) {
        drag.moved = true;
        canvas.classList.add('panning');
      }
      if (drag.moved) {
        graph.view = { ...drag.view };
        graph.pan(dx, dy);
        syncViewInputs();
        requestDraw(true);
        return;
      }
    }

    const x = graph.toMathX(sx), y = graph.toMathY(sy);
    coordsEl.textContent = `${graph.fmt(x)}, ${graph.fmt(y)}`;
    if (state.options.trace) {
      const hit = graph.nearest(objectsToDraw(), sx, sy);
      graph.hover = hit ? { ...hit, features: e.shiftKey } : null;
      canvas.classList.toggle('hovering', !!hit);
      requestDraw();
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag) {
      const wasClick = !drag.moved && e.type === 'pointerup';
      drag = null;
      canvas.classList.remove('panning');
      fastUntil = 0;
      if (wasClick && state.options.trace) {
        const r = canvas.getBoundingClientRect();
        const hit = graph.nearest(objectsToDraw(), e.clientX - r.left, e.clientY - r.top);
        graph.pinned = hit ? { id: hit.id, x: hit.x, y: hit.y, t: hit.t } : null;
      }
      save();
      requestDraw();
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  canvas.addEventListener('pointerleave', () => {
    if (!drag && graph.hover) { graph.hover = null; requestDraw(); }
  });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const factor = Math.pow(1.0016, -e.deltaY);
    graph.zoom(factor, factor, e.clientX - r.left, e.clientY - r.top);
    syncViewInputs();
    save();
    requestDraw(true);
  }, { passive: false });

  canvas.addEventListener('dblclick', () => {
    graph.home();
    if (state.options.equal) graph.equalize();
    syncViewInputs();
    save();
    requestDraw();
  });

  let orbitDrag = null;

  canvas3d.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas3d.addEventListener('pointerdown', (e) => {
    canvas3d.setPointerCapture(e.pointerId);
    const isPan = e.shiftKey || e.button === 1 || e.button === 2;
    orbitDrag = {
      x: e.clientX,
      y: e.clientY,
      mode: isPan ? 'pan' : 'orbit',
    };
    canvas3d.classList.add('panning');
  });

  canvas3d.addEventListener('pointermove', (e) => {
    if (!orbitDrag) return;
    const dx = e.clientX - orbitDrag.x;
    const dy = e.clientY - orbitDrag.y;
    orbitDrag.x = e.clientX;
    orbitDrag.y = e.clientY;

    const active3d = state.polytopeMode && polytope ? polytope : graph3d;

    if (orbitDrag.mode === 'pan') {
      active3d.pan(dx, dy);
      const { x, y, z } = active3d.camera.target;
      coordsEl.textContent = `Target (${graph.fmt(x)}, ${graph.fmt(y)}, ${graph.fmt(z)})`;
    } else {
      active3d.orbit(dx, dy);
      coordsEl.textContent = `Yaw ${radToDeg(active3d.camera.yaw)}° · Pitch ${radToDeg(active3d.camera.pitch)}°`;
    }
    requestDraw(true);
  });

  const endOrbit = () => {
    if (!orbitDrag) return;
    orbitDrag = null;
    canvas3d.classList.remove('panning');
    fastUntil = 0;
    save();
    requestDraw();
  };
  canvas3d.addEventListener('pointerup', endOrbit);
  canvas3d.addEventListener('pointercancel', endOrbit);

  canvas3d.addEventListener('wheel', (e) => {
    e.preventDefault();
    const factor = Math.pow(1.0016, -e.deltaY);
    const active3d = state.polytopeMode && polytope ? polytope : graph3d;
    active3d.zoom(factor);
    save();
    requestDraw(true);
  }, { passive: false });

  canvas3d.addEventListener('dblclick', () => {
    const active3d = state.polytopeMode && polytope ? polytope : graph3d;
    active3d.home();
    if (state.polytopeMode && polytope) syncNDPlanesUI();
    save();
    requestDraw();
  });

  const stepZoom = (f) => {
    if (state.mode3d) {
      const active3d = state.polytopeMode && polytope ? polytope : graph3d;
      active3d.zoom(f);
      save();
      requestDraw();
      return;
    }
    graph.zoom(f, f, graph.w / 2, graph.h / 2);
    syncViewInputs();
    save();
    requestDraw();
  };
  $('#btn-zin').addEventListener('click', () => stepZoom(1.35));
  $('#btn-zout').addEventListener('click', () => stepZoom(1 / 1.35));

  const goHome = () => {
    if (state.mode3d) {
      const active3d = state.polytopeMode && polytope ? polytope : graph3d;
      active3d.home();
      if (state.polytopeMode && polytope) syncNDPlanesUI();
      save();
      requestDraw();
      return;
    }
    graph.home();
    if (state.options.equal) graph.equalize();
    syncViewInputs();
    save();
    requestDraw();
  };
  $('#btn-zhome').addEventListener('click', goHome);
  $('#btn-home').addEventListener('click', goHome);

  $('#btn-png').addEventListener('click', () => {
    const activeCanvas = state.mode3d ? canvas3d : canvas;
    if (state.mode3d) {
      if (state.polytopeMode && polytope) polytope.draw(canvasTheme());
      else graph3d.draw(objectsToDraw(), canvasTheme(), { ...state.options, fast: false });
    } else {
      graph.draw(objectsToDraw(), canvasTheme(), { ...state.options, fast: false });
    }
    const a = document.createElement('a');
    a.download = state.mode3d ? 'graph-3d.png' : 'graph.png';
    a.href = activeCanvas.toDataURL('image/png');
    a.click();
  });

  $('#keypad').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (!activeInput || !document.body.contains(activeInput)) {
      activeInput = $('.formula-input', listEl);
    }
    if (!activeInput) return;
    const ins = b.dataset.ins;
    const s = activeInput.selectionStart ?? activeInput.value.length;
    const end = activeInput.selectionEnd ?? s;
    activeInput.value = activeInput.value.slice(0, s) + ins + activeInput.value.slice(end);
    const caret = ins === '||' || ins === '{}' ? s + 1 : s + ins.length;
    activeInput.focus();
    activeInput.setSelectionRange(caret, caret);
    activeInput.dispatchEvent(new Event('input'));
  });

  const exPop = $('#examples-pop');
  const exBtn = $('#btn-examples');
  exPop.innerHTML = EXAMPLES.map((ex, i) => `
    <button type="button" class="ex-item" data-i="${i}">
      <strong>${ex.name}</strong>
      <span>${ex.lines.map((l) => l.text).join('  ·  ')}</span>
    </button>`).join('');

  exPop.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (!b) return;
    const idx = +b.dataset.i;
    state.polytopeMode = false;
    loadExample(EXAMPLES[idx], idx, false);
    exPop.hidden = true;
    exBtn.setAttribute('aria-expanded', 'false');
  });

  exBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = exPop.hidden;
    exPop.hidden = !open;
    exBtn.setAttribute('aria-expanded', String(open));
  });

  function loadExample(ex, idx, preserveMode) {
    state.activeExample = idx;
    const sourceLines = state.mode3d && ex.lines3d ? ex.lines3d : ex.lines;
    state.lines = sourceLines.map((l) => makeLine(l));
    state.params = {};
    if (ex.params) {
      for (const [k, v] of Object.entries(ex.params)) state.params[k] = { play: false, ...v };
    }
    if (!preserveMode && ex.revolve3d && state.mode3d) {
      graph3d.revolveMode = true;
    } else if (state.mode3d) {
      graph3d.revolveMode = Boolean(ex.revolve3d);
    }
    graph.setView(...ex.view);
    if (state.options.equal) graph.equalize();
    graph.pinned = null;
    syncViewInputs();
    renderList();
    recompile();
    updateMode3DUI();
    requestDraw();
    const first = $('.formula-input', listEl);
    if (first) first.focus();
  }

  const helpModal = $('#help-modal');
  $('#btn-help').addEventListener('click', () => { helpModal.hidden = false; });
  $('#btn-help-close').addEventListener('click', () => { helpModal.hidden = true; });
  helpModal.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.hidden = true; });

  document.addEventListener('click', (e) => {
    if (!exPop.hidden && !exPop.contains(e.target) && e.target !== exBtn) {
      exPop.hidden = true;
      exBtn.setAttribute('aria-expanded', 'false');
    }
    if (stylePop && !stylePop.contains(e.target)) closeStylePop();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { helpModal.hidden = true; exPop.hidden = true; closeStylePop(); }
  });

  const sidebar = $('#sidebar');
  $('#btn-panel').addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    onResize();
  });

  const splitter = $('#splitter');
  splitter.addEventListener('pointerdown', (e) => {
    splitter.setPointerCapture(e.pointerId);
    splitter.classList.add('dragging');
    const move = (ev) => {
      sidebar.style.width = Math.max(260, Math.min(window.innerWidth * 0.6, ev.clientX)) + 'px';
      onResize();
    };
    const up = () => {
      splitter.classList.remove('dragging');
      splitter.removeEventListener('pointermove', move);
      splitter.removeEventListener('pointerup', up);
    };
    splitter.addEventListener('pointermove', move);
    splitter.addEventListener('pointerup', up);
  });

  $('#btn-add').addEventListener('click', () => addLine().focus());
  $('#btn-clear').addEventListener('click', () => {
    state.activeExample = null;
    state.lines = [makeLine()];
    state.params = {};
    graph.pinned = null;
    renderList();
    recompile();
    $('.formula-input', listEl).focus();
  });

  let lastT = performance.now();

  function tick(now) {
    const dt = Math.min(0.1, (now - lastT) / 1000);
    lastT = now;

    let animated = false;
    const rows = paramsEl.children;
    Object.keys(state.params).forEach((name, idx) => {
      const p = state.params[name];
      if (!p.play) return;
      animated = true;
      p.value += ((p.max - p.min) / 6) * dt;
      if (p.value > p.max) p.value = p.min;
      p.value = +p.value.toPrecision(5);
      globals[name] = p.value;
      if (rows[idx] && rows[idx]._sync) rows[idx]._sync();
    });

    if (state.mode3d && state.polytopeMode && polytope) {
      polytope.stepAnimation(dt);
      if (polytope.autoRotate) {
        animated = true;
        syncNDPlanesUI();
      }
    }

    if (now < benchUntil && state.mode3d) {
      graph3d.orbit(3.2, 0.8);
      animated = true;
    }

    const inFastWindow = fastUntil > 0 && now < fastUntil;
    if (fastUntil > 0 && now >= fastUntil) {
      fastUntil = 0;
      dirty = true;
    }

    if (animated || dirty) {
      const fast = inFastWindow && now >= benchUntil;
      dirty = false;
      const drawOpts = { ...state.options, fast, notables: state.options.trace };
      if (state.mode3d) {
        if (state.polytopeMode && polytope) {
          polytope.draw(canvasTheme());
        } else {
          graph3d.draw(objectsToDraw(), canvasTheme(), drawOpts);
          updatePerfHud();
        }
      } else {
        graph.draw(objectsToDraw(), canvasTheme(), drawOpts);
      }
    }
    requestAnimationFrame(tick);
  }

  function onResize() {
    graph.resize();
    graph3d.resize();
    if (polytope) polytope.resize();
    if (state.options.equal) { graph.equalize(); syncViewInputs(); }
    requestDraw();
  }
  window.addEventListener('resize', onResize);

  if (!load()) {
    loadExample(EXAMPLES[0], 0, false);
  } else {
    for (const [id, k] of [['#opt-grid', 'grid'], ['#opt-axes', 'axes'], ['#opt-trace', 'trace'], ['#opt-equal', 'equal']]) {
      const el = $(id);
      if (el) el.checked = !!state.options[k];
    }
    renderList();
    recompile();
  }
  applyTheme();
  updateMode3DUI();
  onResize();
  requestAnimationFrame(tick);
})();