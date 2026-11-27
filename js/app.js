/**
 * app.js - interface logic: formula rows, parameter sliders, style popup,
 * theme, canvas interaction, saving, SVG/LaTeX/MathML export and opening projects.
 * Depends on Formulas (formulas.js) and Graph (graph.js).
 */
(function () {
  'use strict';

  const $ = (q) => document.querySelector(q);
  const STORAGE_KEY = 'grapher-v1';
  const PALETTE = {
    light: ['#2b45d4', '#d92b4b', '#0a8a5f', '#c96a00', '#8b2fc9', '#007f9e', '#c0267e', '#5b7a00', '#8a4b2a', '#1b2342'],
    dark: ['#7f9bff', '#ff6f86', '#3fd6a0', '#ffab45', '#c88bff', '#45d4f0', '#ff7ac4', '#b4da45', '#d99a74', '#e6ecfa'],
  };
  const TWO_PI = 2 * Math.PI;

  const EXAMPLES = {
    'Getting started': ['f(x) = a sin(x)', 'y = x^2/8 - 3', 'a = 3'],
    'Traveling wave': ['y = a sin(b x - c) e^(-x^2/40)', 'y = a e^(-x^2/40)', 'y = -a e^(-x^2/40)', 'a = 4', 'b = 3', 'c = 0'],
    'Derivatives & tangent': ['f(x) = x^3/6 - 2x', "y = f'(x)", "y = f(a) + f'(a)(x - a)", '(a, f(a))', 'a = -1.5'],
    'Polar flower': ['r = 5cos(k θ)', 'r = 6', 'k = 4'],
    'Butterfly': [{ text: 'r = e^(sin θ) - 2cos(4θ) + sin((2θ - π)/24)^5', to: '24π' }],
    'Heart': ['(x^2 + y^2 - 9)^3 - 3x^2 y^3 <= 0'],
    'Lissajous curves': ['(6sin(a t + d), 4sin(b t))', 'a = 3', 'b = 4', 'd = 1.5'],
    'Regions': ['y >= x^2/4 - 4', 'y < x/2 + 2', 'x^2 + y^2 = 36'],
    'Asymptotes & jumps': ['y = tan(x)', 'y = 1/(x - 2)', 'y = floor(x)'],
    "Gabriel's horn": ['y = 1/x {x >= 1}', 'y = -1/x {x >= 1}', 'x = 1 {-1 <= y <= 1}'],
  };


  // ---- State and persistence ----
  let nextId = 1;
  const newLine = (data = {}) => {
    const id = nextId++;
    return {
      id, text: '', color: (id - 1) % 8, thickness: 2.5, stroke: 'solid', visible: true,
      derivative: false, from: '0', to: '2π', ...data,
    };
  };
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const state = {
    lines: [], parameters: {}, active: null,
    theme: systemDark.matches ? 'dark' : 'light',
    themeManual: false, // true once the user presses the theme button; otherwise the system theme is followed
    options: { grid: true, axes: true, polar: false, pi: false, notables: true },
  };
  const globals = Object.create(null);
  let compiled = { lines: [], parameters: [] };
  const animating = new Map();
  const graph = new Graph($('#graph'));
  const rows = new Map();

  let saveTimer;
  /**
   * Builds the plain-object snapshot used for localStorage and for the .json export.
   */
  function serialize() {
    return {
      version: 1, lines: state.lines.map(({ id, ...l }) => l), parameters: state.parameters,
      options: state.options, themeManual: state.themeManual,
      theme: state.themeManual ? state.theme : null, view: graph.view,
    };
  }
  /**
   * Saves the snapshot to localStorage. Errors (private mode, quota) are ignored.
   */
  function writeStorage() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize())); } catch (_) {}
  }
  /**
   * Debounced save (300 ms); called after every change.
   */
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(writeStorage, 300);
  }
  /**
   * Saves immediately; used when the page is reloaded, closed or hidden.
   */
  function flush() { clearTimeout(saveTimer); writeStorage(); }
  /**
   * Validates a saved snapshot and applies it to `state`. Throws if the format is invalid.
   * @param {object} data Parsed JSON snapshot.
   */
  function load(data) {
    if (!data || !Array.isArray(data.lines)) throw new Error('format');
    const num = (v, d) => (Number.isFinite(v) ? v : d);
    nextId = 1;
    state.lines = data.lines.slice(0, 100).map((l) => {
      const n = newLine();
      if (typeof l.text === 'string') n.text = l.text.slice(0, 500);
      if (Number.isInteger(l.color) ? PALETTE.light[l.color] : /^#[0-9a-f]{6}$/i.test(l.color)) n.color = l.color;
      n.thickness = Math.min(8, Math.max(1, num(l.thickness, 2.5)));
      if (['solid', 'dashed', 'dotted'].includes(l.stroke)) n.stroke = l.stroke;
      n.visible = l.visible !== false;
      n.derivative = l.derivative === true;
      if (typeof l.from === 'string') n.from = l.from;
      if (typeof l.to === 'string') n.to = l.to;
      return n;
    });
    if (!state.lines.length) state.lines.push(newLine());
    state.parameters = {};
    for (const [k, p] of Object.entries(data.parameters || {})) {
      if (p && /^[A-Za-zα-ω](_[A-Za-z0-9]+|\d+)?$/.test(k)) {
        state.parameters[k] = { value: num(p.value, 1), min: num(p.min, -10), max: num(p.max, 10) };
      }
    }
    for (const k of Object.keys(state.options)) {
      if (typeof data.options?.[k] === 'boolean') state.options[k] = data.options[k];
    }
    // Only a theme the user chose explicitly is restored; otherwise the system theme is used
    state.themeManual = data.themeManual === true && (data.theme === 'light' || data.theme === 'dark');
    state.theme = state.themeManual ? data.theme : (systemDark.matches ? 'dark' : 'light');
    const v = data.view;
    if (v && [v.cx, v.cy, v.sx, v.sy].every(Number.isFinite) && v.sx > 0 && v.sy > 0) {
      graph.view = { cx: v.cx, cy: v.cy, sx: v.sx, sy: v.sy };
    }
    state.active = state.lines[0].id;
  }


  // ---- Rendering ----
  let pending = false, colors = null, interacting = false, endInteraction;
  /**
   * Reads the canvas colors from the CSS custom properties of the current theme.
   */
  function readTheme() {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => s.getPropertyValue(n).trim();
    colors = { bg: v('--bg'), text: v('--text'), axis: v('--axis'), grid: v('--grid'), gridFine: v('--grid-fine') };
  }
  const colorOf = (l) => (typeof l.color === 'number' ? PALETTE[state.theme][l.color] : l.color);

  /**
   * Schedules a single repaint on the next animation frame.
   */
  function redraw() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; paint(); });
  }
  /**
   * Marks the view as moving (cheaper rendering) until 180 ms after the last event.
   */
  function motion() {
    interacting = true;
    clearTimeout(endInteraction);
    endInteraction = setTimeout(() => { interacting = false; redraw(); }, 180);
    hideTooltip();
    redraw();
  }

  /**
   * Returns [from, to] of a polar or parametric line, defaulting to 0..2π.
   */
  function rangeOf(l) {
    const a = Formulas.evaluateNumber(l.from), b = Formulas.evaluateNumber(l.to);
    return [Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : TWO_PI];
  }
  /**
   * Builds the list of drawable objects from the visible, compiled lines.
   */
  function objects() {
    const out = [];
    state.lines.forEach((l, i) => {
      const o = compiled.lines[i];
      if (!o || !l.visible || ['error', 'empty', 'constant', 'function'].includes(o.type)) return;
      out.push({
        id: l.id, o, range: rangeOf(l), derivative: l.derivative,
        style: { color: colorOf(l), thickness: l.thickness, stroke: l.stroke },
      });
    });
    return out;
  }
  /**
   * Draws the graph and refreshes the live values in the list.
   */
  function paint() {
    graph.draw(objects(), colors, { ...state.options, active: state.active, fast: interacting });
    updateValues();
  }

  /**
   * Recompiles every formula, syncs parameters and rows, then redraws and saves.
   */
  function recompile() {
    compiled = Formulas.compileAll(state.lines.map((l) => l.text), globals);
    for (const n of compiled.parameters) {
      state.parameters[n] ||= { value: 1, min: -10, max: 10 };
      globals[n] = state.parameters[n].value;
    }
    for (const o of compiled.lines) {
      if (o.type === 'constant' && o.literal) {
        const p = (state.parameters[o.name] ||= { value: o.value, min: -10, max: 10 });
        p.value = o.value;
        p.min = Math.min(p.min, o.value);
        p.max = Math.max(p.max, o.value);
        globals[o.name] = o.value;
      }
    }
    for (const n of [...animating.keys()]) {
      const keeps = compiled.parameters.includes(n) ||
        compiled.lines.some((o) => o.type === 'constant' && o.literal && o.name === n);
      if (!keeps) animating.delete(n);
    }
    state.lines.forEach((l, i) => updateRow(l, compiled.lines[i]));
    updateParameters();
    redraw();
    save();
  }


  // ---- Formula rows ----
  const SVG_EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>';
  const SVG_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const el = (tag, props = {}, ...children) => {
    const e = Object.assign(document.createElement(tag), props);
    e.append(...children);
    return e;
  };

  /**
   * Creates the DOM row of one formula line and wires its event handlers.
   * @returns {object} The row elements.
   */
  function createRow(l) {
    const color = el('button', { type: 'button', className: 'color', title: 'Color and style' });
    color.setAttribute('aria-label', 'Color and style');
    const input = el('input', {
      type: 'text', className: 'formula', value: l.text, placeholder: 'y = sin(x)',
      spellcheck: false, autocomplete: 'off', maxLength: 500,
    });
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('aria-label', 'Formula');
    const statusEl = el('p', { className: 'status' });
    const controls = el('div', { className: 'controls' });
    const viewBtn = el('button', { type: 'button', innerHTML: SVG_EYE, title: 'Show or hide' });
    viewBtn.setAttribute('aria-label', 'Show or hide');
    const delBtn = el('button', { type: 'button', innerHTML: SVG_X, title: 'Delete' });
    delBtn.setAttribute('aria-label', 'Delete formula');
    const li = el('li', { className: 'row' }, color,
      el('div', { className: 'body' }, input, statusEl, controls),
      el('div', { className: 'side' }, delBtn, viewBtn));

    input.addEventListener('input', () => { l.text = input.value; recompile(); });
    input.addEventListener('focus', () => { state.active = l.id; redraw(); });
    input.addEventListener('keydown', (e) => {
      const i = state.lines.indexOf(l);
      if (e.key === 'Enter') { e.preventDefault(); add('', i + 1); }
      if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); rows.get(state.lines[i - 1].id).input.focus(); }
      if (e.key === 'ArrowDown' && i < state.lines.length - 1) { e.preventDefault(); rows.get(state.lines[i + 1].id).input.focus(); }
      if (e.key === 'Backspace' && !input.value && state.lines.length > 1) { e.preventDefault(); remove(l); }
    });
    color.addEventListener('click', (e) => { e.stopPropagation(); openStyle(l, color); });
    viewBtn.addEventListener('click', () => {
      l.visible = !l.visible;
      updateRow(l, compiled.lines[state.lines.indexOf(l)]);
      redraw(); save();
    });
    delBtn.addEventListener('click', () => remove(l));
    const f = { li, color, input, statusEl, controls, viewBtn, signature: null };
    rows.set(l.id, f);
    return f;
  }

  const NAMES = {
    explicit: 'Function of x', explicitX: 'Function of y', polar: 'Polar curve', parametric: 'Parametric curve',
    point: 'Point', implicit: 'Implicit equation', inequality: 'Region', function: 'Defined function', constant: 'Constant', empty: '',
  };

  /**
   * Refreshes the status text and per-type controls (derivative, range, slider) of a row.
   */
  function updateRow(l, o) {
    const f = rows.get(l.id);
    if (!f || !o) return;
    f.li.style.setProperty('--c', colorOf(l));
    f.li.classList.toggle('hidden', !l.visible);
    f.viewBtn.setAttribute('aria-pressed', String(!l.visible));
    f.statusEl.classList.toggle('error', o.type === 'error');
    f.statusEl.textContent = o.type === 'error' ? o.error : (NAMES[o.type] || '') + (l.visible ? '' : ' (hidden)');

    const signature = [o.type, o.usesRange, o.name, o.literal].join('|');
    if (f.signature !== signature) {
      f.signature = signature;
      f.controls.textContent = '';
      if (o.type === 'explicit' || o.type === 'explicitX') {
        const b = el('button', { type: 'button', textContent: 'Derivative' });
        b.setAttribute('aria-pressed', String(l.derivative));
        b.addEventListener('click', () => {
          l.derivative = !l.derivative; b.setAttribute('aria-pressed', String(l.derivative)); redraw(); save();
        });
        f.controls.append(b);
      }
      if (o.usesRange) {
        const v = o.type === 'polar' ? 'θ' : 't';
        const field = (key, label) => {
          const i = el('input', { type: 'text', value: l[key] });
          i.setAttribute('aria-label', label);
          i.addEventListener('input', () => {
            const ok = Number.isFinite(Formulas.evaluateNumber(i.value));
            i.classList.toggle('bad', !ok);
            if (ok) { l[key] = i.value; redraw(); save(); }
          });
          return i;
        };
        f.controls.append(el('span', { textContent: `${v} from` }), field('from', `${v} from`),
          el('span', { textContent: 'to' }), field('to', `${v} to`));
      }
      if (o.type === 'constant' && o.literal) f.controls.append(createSlider(o.name));
    }
  }


  // ---- Parameters and sliders ----
  const sliders = new Set();
  const round = (v, p) => {
    const step = (p.max - p.min) / 1000 || 0.01;
    const dec = Math.max(0, Math.min(8, Math.ceil(-Math.log10(step))));
    return Number(v.toFixed(dec));
  };

  /**
   * Sets a parameter value, rewrites its defining line if any, and repaints.
   */
  function setParameter(name, value) {
    const p = state.parameters[name];
    p.value = value; globals[name] = value;
    state.lines.forEach((l, i) => {
      const o = compiled.lines[i];
      if (o?.type === 'constant' && o.literal && o.name === name) {
        const cond = l.text.indexOf('{');
        // Avoid scientific notation: the parser would read "e" as Euler's constant
        const written = String(value).includes('e') ? value.toFixed(10).replace(/\.?0+$/, '') : String(value);
        l.text = `${name} = ${written}${cond >= 0 ? ' ' + l.text.slice(cond) : ''}`;
        o.value = value;
        rows.get(l.id).input.value = l.text;
      }
    });
    sliders.forEach((d) => d.name === name && d.refresh());
    motion(); save();
  }

  /**
   * Creates a slider with min/max fields and an animate button for a parameter.
   * @returns {HTMLElement} The slider box.
   */
  function createSlider(name) {
    const p = state.parameters[name];
    const title = el('span', { className: 'name' });
    const range = el('input', { type: 'range', step: 'any' });
    range.setAttribute('aria-label', `Value of ${name}`);
    const play = el('button', { type: 'button', className: 'play' });
    const limit = (key, label) => {
      const i = el('input', { type: 'text', value: p[key] });
      i.setAttribute('aria-label', `${label} of ${name}`);
      i.addEventListener('change', () => {
        const v = Formulas.evaluateNumber(i.value);
        const ok = Number.isFinite(v) && (key === 'min' ? v < p.max : v > p.min);
        i.classList.toggle('bad', !ok);
        if (!ok) return;
        p[key] = v;
        setParameter(name, Math.min(p.max, Math.max(p.min, p.value)));
      });
      return i;
    };
    const min = limit('min', 'Minimum'), max = limit('max', 'Maximum');
    const box = el('div', { className: 'slider' }, title, el('span'), range, play,
      el('div', { className: 'limits' }, min, el('span', { textContent: 'min & max' }), max));
    const d = {
      name, box,
      refresh() {
        title.textContent = `${name} = ${String(p.value).replace('-', '−')}`;
        range.min = p.min; range.max = p.max; range.value = p.value;
        const on = animating.has(name);
        play.textContent = on ? '❚❚' : '▶';
        play.setAttribute('aria-label', `${on ? 'Pause' : 'Animate'} ${name}`);
        play.title = on ? 'Pause' : 'Animate';
      },
    };
    range.addEventListener('input', () => setParameter(name, round(Number(range.value), p)));
    play.addEventListener('click', () => {
      if (animating.has(name)) animating.delete(name); else animating.set(name, 1);
      sliders.forEach((x) => x.refresh());
      startAnimation();
    });
    sliders.add(d);
    d.refresh();
    return box;
  }

  let parameterSignature = '';
  /**
   * Rebuilds the Parameters panel when the set of parameters changes.
   */
  function updateParameters() {
    for (const d of sliders) if (!d.box.isConnected) sliders.delete(d);
    const list = compiled.parameters;
    $('#secParameters').hidden = !list.length;
    const signature = list.join(',');
    if (signature !== parameterSignature) {
      parameterSignature = signature;
      const cont = $('#parameters');
      cont.textContent = '';
      for (const d of sliders) if (!d.box.isConnected) sliders.delete(d);
      list.forEach((n) => cont.append(createSlider(n)));
    }
    sliders.forEach((d) => d.refresh());
  }

  /**
   * Updates the live status of points and computed constants.
   */
  function updateValues() {
    const f4 = (v) => (Number.isFinite(v) ? String(Number(v.toPrecision(6))).replace(/-/g, '−') : 'undefined');
    state.lines.forEach((l, i) => {
      const o = compiled.lines[i], f = rows.get(l.id);
      if (!o || !f) return;
      if (o.type === 'point') { const [x, y] = o.f(); f.statusEl.textContent = `Point (${f4(x)}, ${f4(y)})`; }
      if (o.type === 'constant' && !o.literal) f.statusEl.textContent = `Constant: ${f4(o.evaluate())}`;
    });
  }

  let animation = 0, previous = 0;
  /**
   * Runs the frame loop that moves animated parameters back and forth between min and max.
   */
  function startAnimation() {
    if (animation || !animating.size) return;
    previous = performance.now();
    const step = (now) => {
      const dt = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      for (const [n, dir] of animating) {
        const p = state.parameters[n];
        const span = p.max - p.min;
        let v = p.value + dir * dt * span / 8, d = dir;
        if (v >= p.max) { v = p.max; d = -1; }
        if (v <= p.min) { v = p.min; d = 1; }
        animating.set(n, d);
        setParameter(n, round(v, p));
      }
      animation = animating.size ? requestAnimationFrame(step) : 0;
    };
    animation = requestAnimationFrame(step);
  }

  /**
   * Rebuilds every row from `state.lines` and recompiles.
   */
  function mountList() {
    rows.clear(); sliders.clear(); parameterSignature = null;
    $('#list').textContent = '';
    state.lines.forEach((l) => $('#list').append(createRow(l).li));
    recompile();
  }
  /**
   * Inserts a new formula line and focuses it (maximum 100 lines).
   * @param {string} [text] Initial formula.
   * @param {number} [pos] Insert position.
   */
  function add(text = '', pos = state.lines.length) {
    if (state.lines.length >= 100) return;
    const used = new Set(state.lines.map((l) => l.color));
    const free = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !used.has(i));
    const l = newLine({ text });
    if (free !== undefined) l.color = free;
    state.lines.splice(pos, 0, l);
    const f = createRow(l);
    $('#list').insertBefore(f.li, $('#list').children[pos] || null);
    state.active = l.id;
    recompile();
    f.input.focus();
  }
  /**
   * Removes a line; an empty line is added if none remain.
   */
  function remove(l) {
    closeStyle();
    const i = state.lines.indexOf(l);
    state.lines.splice(i, 1);
    rows.get(l.id).li.remove();
    rows.delete(l.id);
    if (!state.lines.length) { add(); return; }
    recompile();
    rows.get(state.lines[Math.max(0, i - 1)].id).input.focus();
  }


  // ---- Style popup ----
  const popup = $('#stylePopup');
  let editing = null, anchor = null;
  /**
   * Opens the color, thickness and stroke popup next to a row's color button.
   */
  function openStyle(l, button) {
    if (editing === l) { closeStyle(); return; }
    editing = l; anchor = button;
    const cont = $('#swatches');
    cont.textContent = '';
    PALETTE[state.theme].forEach((c, i) => {
      const b = el('button', { type: 'button' });
      b.style.background = c;
      b.setAttribute('aria-label', `Color ${i + 1}`);
      b.setAttribute('aria-pressed', String(l.color === i));
      b.addEventListener('click', () => changeStyle('color', i));
      cont.append(b);
    });
    $('#customColor').value = colorOf(l);
    $('#thickness').value = l.thickness;
    $('#stroke').value = l.stroke;
    popup.hidden = false;
    const r = button.getBoundingClientRect();
    popup.style.left = `${Math.min(r.left, innerWidth - popup.offsetWidth - 8)}px`;
    popup.style.top = `${Math.max(8, Math.min(r.bottom + 8, innerHeight - popup.offsetHeight - 8))}px`;
    cont.firstChild.focus();
  }
  /**
   * Applies one style property to the line being edited.
   */
  function changeStyle(key, value) {
    if (!editing) return;
    editing[key] = value;
    if (key === 'color') {
      [...$('#swatches').children].forEach((b, i) => b.setAttribute('aria-pressed', String(value === i)));
      rows.get(editing.id).li.style.setProperty('--c', colorOf(editing));
    }
    redraw(); save();
  }
  function closeStyle() { popup.hidden = true; editing = null; }
  $('#customColor').addEventListener('input', (e) => changeStyle('color', e.target.value));
  $('#thickness').addEventListener('input', (e) => changeStyle('thickness', Number(e.target.value)));
  $('#stroke').addEventListener('change', (e) => changeStyle('stroke', e.target.value));
  document.addEventListener('pointerdown', (e) => {
    if (editing && !popup.contains(e.target) && e.target !== anchor) closeStyle();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && editing) { closeStyle(); anchor.focus(); }
  });
  $('.scrollable').addEventListener('scroll', closeStyle);

  /**
   * Applies `state.theme` to the page and the canvas colors.
   */
  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    readTheme();
    state.lines.forEach((l) => rows.get(l.id)?.li.style.setProperty('--c', colorOf(l)));
    closeStyle();
    redraw();
  }
  $('#btnTheme').addEventListener('click', () => {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    state.themeManual = true;
    applyTheme(); save();
  });
  systemDark.addEventListener('change', () => {
    if (state.themeManual) return;
    state.theme = systemDark.matches ? 'dark' : 'light';
    applyTheme(); save();
  });


  // ---- Canvas interaction ----
  const canvas = $('#graph'), tooltip = $('#tooltip'), coords = $('#coords');
  const pointers = new Map();
  const position = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const shortNum = (v) => (Math.abs(v) < 1e-9 ? '0' : String(Number(v.toPrecision(5))).replace(/-/g, '−'));
  function hideTooltip() {
    if (tooltip.hidden) return;
    tooltip.hidden = true;
  }
  /**
   * Updates the coordinates readout, tooltip and highlighted point under the pointer.
   */
  function track(X, Y) {
    coords.textContent = `x: ${shortNum(graph.mx(X))}   y: ${shortNum(graph.my(Y))}`;
    const p = graph.nearest(X, Y);
    paint();
    if (!p) { hideTooltip(); return; }
    graph.mark(p.X, p.Y, p.color, colors, 6);
    tooltip.textContent = `${p.label ? p.label + '\n' : ''}x = ${shortNum(p.x)}\ny = ${shortNum(p.y)}` +
      (Number.isFinite(p.slope) ? `\nslope = ${shortNum(Number(p.slope.toFixed(5)))}` : '');
    tooltip.style.setProperty('--c', p.color);
    tooltip.hidden = false;
    const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
    tooltip.style.left = `${p.X + 14 + w > graph.w ? p.X - w - 14 : p.X + 14}px`;
    tooltip.style.top = `${p.Y - h - 12 < 0 ? p.Y + 14 : p.Y - h - 12}px`;
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, position(e));
    if (e.pointerType !== 'mouse' && pointers.size === 1) track(...position(e));
  });
  canvas.addEventListener('pointermove', (e) => {
    const q = position(e), prev = pointers.get(e.pointerId);
    if (!prev) { if (e.pointerType === 'mouse') track(...q); return; }
    if (pointers.size === 1) {
      const dx = q[0] - prev[0], dy = q[1] - prev[1];
      if (!dx && !dy) return;
      graph.pan(dx, dy);
    } else if (pointers.size === 2) {
      const other = [...pointers].find(([id]) => id !== e.pointerId)[1];
      const d0 = Math.hypot(prev[0] - other[0], prev[1] - other[1]);
      const d1 = Math.hypot(q[0] - other[0], q[1] - other[1]);
      const center = [(q[0] + other[0]) / 2, (q[1] + other[1]) / 2];
      graph.pan((q[0] - prev[0]) / 2, (q[1] - prev[1]) / 2);
      if (d0 > 5 && d1 > 5) graph.zoom(d1 / d0, d1 / d0, ...center);
    }
    pointers.set(e.pointerId, q);
    motion(); save();
  });
  const release = (e) => pointers.delete(e.pointerId);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', (e) => {
    if (e.pointerType !== 'mouse') return;
    coords.textContent = ''; hideTooltip(); redraw();
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = (e.deltaY || e.deltaX) * (e.deltaMode === 1 ? 33 : 1);
    const k = Math.exp(-Math.max(-300, Math.min(300, delta)) * 0.0016);
    graph.zoom(e.altKey ? 1 : k, e.shiftKey ? 1 : k, ...position(e));
    motion(); save();
  }, { passive: false });
  canvas.addEventListener('dblclick', (e) => { graph.zoom(1.6, 1.6, ...position(e)); motion(); save(); });
  canvas.addEventListener('keydown', (e) => {
    const actions = {
      ArrowLeft: () => graph.pan(40, 0), ArrowRight: () => graph.pan(-40, 0),
      ArrowUp: () => graph.pan(0, 40), ArrowDown: () => graph.pan(0, -40),
      '+': () => graph.zoom(1.25, 1.25), '-': () => graph.zoom(0.8, 0.8), 0: () => graph.home(),
    };
    if (actions[e.key] && !e.ctrlKey && !e.metaKey) { e.preventDefault(); actions[e.key](); motion(); save(); }
  });
  document.querySelectorAll('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.zoom;
    if (t === 'home') graph.home(); else { const k = t === 'in' ? 1.4 : 1 / 1.4; graph.zoom(k, k); }
    motion(); save();
  }));

  function syncOptions() {
    document.querySelectorAll('[data-op]').forEach((c) => { c.checked = state.options[c.dataset.op]; });
  }
  document.querySelectorAll('[data-op]').forEach((c) => c.addEventListener('change', () => {
    state.options[c.dataset.op] = c.checked; redraw(); save();
  }));


  // ---- Examples and clearing ----
  const selector = $('#examples');
  Object.keys(EXAMPLES).forEach((n) => selector.append(el('option', { value: n, textContent: n })));
  /**
   * Replaces the current graph with one of the EXAMPLES.
   */
  function loadExample(name) {
    animating.clear(); closeStyle();
    nextId = 1;
    state.lines = EXAMPLES[name].map((t) => newLine(typeof t === 'string' ? { text: t } : t));
    state.parameters = {};
    state.active = state.lines[0].id;
    state.options.polar = name === 'Polar flower';
    state.options.pi = name === 'Asymptotes & jumps';
    if (name === 'Traveling wave') state.parameters.c = { value: 0, min: 0, max: 20 };
    if (name === 'Polar flower') state.parameters.k = { value: 4, min: 1, max: 8 };
    syncOptions();
    graph.home();
    mountList();
    if (name === 'Traveling wave') { animating.set('c', 1); sliders.forEach((d) => d.refresh()); startAnimation(); }
  }
  selector.addEventListener('change', () => { if (selector.value) loadExample(selector.value); selector.value = ''; });

  /**
   * Resets to a single blank formula line with no curves.
   */
  function startEmpty() {
    animating.clear(); closeStyle();
    nextId = 1;
    state.lines = [newLine()];
    state.parameters = {};
    state.active = state.lines[0].id;
    graph.home();
    mountList();
  }

  $('#btnNew').addEventListener('click', () => add());
  $('#btnClear').addEventListener('click', () => {
    const used = state.lines.some((l) => l.text.trim());
    if (used && !window.confirm('Remove all formulas and start with an empty graph?')) return;
    startEmpty();
    $('#notice').textContent = 'Graph cleared.';
  });
  $('#btnHelp').addEventListener('click', () => $('#help').showModal());

  // ---- Export and import (PNG, SVG, LaTeX, MathML, JSON) ----
  const xmlEscape = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function dashAttr(stroke, thickness) {
    if (stroke === 'dashed') return ` stroke-dasharray="${(thickness * 3.5).toFixed(2)} ${(thickness * 2.5).toFixed(2)}"`;
    if (stroke === 'dotted') return ` stroke-dasharray="0.1 ${(thickness * 2.4).toFixed(2)}"`;
    return '';
  }

  function polylineSvg(segments, style) {
    const d = segments
      .filter((s) => s.length > 1)
      .map((s) => s.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' '))
      .join(' ');
    if (!d) return '';
    return `<path d="${d}" fill="none" stroke="${xmlEscape(style.color)}" stroke-width="${style.thickness}" stroke-linecap="round" stroke-linejoin="round"${dashAttr(style.stroke, style.thickness)}${style.alpha != null ? ` opacity="${style.alpha}"` : ''}/>`;
  }

  /**
   * Generates a standalone vector SVG representation of the current graph.
   * @returns {string} SVG markup.
   */
  function buildSvg() {
    const w = Math.max(1, Math.round(graph.w)), h = Math.max(1, Math.round(graph.h));
    const v = graph.view, op = state.options;
    const gx = op.pi ? Graph.stepPi(v.sx) : Graph.step(v.sx);
    const gy = Graph.step(v.sy);
    const x0 = graph.mx(0), x1 = graph.mx(w), y0 = graph.my(h), y1 = graph.my(0);
    const parts = [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
      `<rect width="${w}" height="${h}" fill="${xmlEscape(colors.bg)}"/>`,
    ];

    if (op.grid) {
      if (op.polar) {
        const ox = graph.px(0), oy = graph.py(0);
        const far = Math.max(...[[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => Math.hypot(graph.mx(x), graph.my(y))));
        const near = Math.hypot(Math.max(graph.mx(0), 0, -graph.mx(w)), Math.max(graph.my(h), 0, -graph.my(0)));
        const start = Math.max(1, Math.floor(near / gy.major));
        for (let i = start; i * gy.major <= far && i < start + 200; i++) {
          parts.push(`<ellipse cx="${ox.toFixed(2)}" cy="${oy.toFixed(2)}" rx="${(i * gy.major * v.sx).toFixed(2)}" ry="${(i * gy.major * v.sy).toFixed(2)}" fill="none" stroke="${xmlEscape(colors.grid)}" stroke-width="1"/>`);
        }
        for (let k = 0; k < 24; k++) {
          const a = k * Math.PI / 12;
          parts.push(`<line x1="${ox.toFixed(2)}" y1="${oy.toFixed(2)}" x2="${graph.px(Math.cos(a) * far).toFixed(2)}" y2="${graph.py(Math.sin(a) * far).toFixed(2)}" stroke="${xmlEscape(colors.gridFine)}" stroke-width="1"/>`);
        }
      } else {
        const gridLine = (step, vertical, strokeCol) => {
          const a = vertical ? x0 : y0, b = vertical ? x1 : y1;
          for (let i = Math.ceil(a / step); i <= Math.floor(b / step); i++) {
            const q = Math.round(vertical ? graph.px(i * step) : graph.py(i * step)) + 0.5;
            if (vertical) parts.push(`<line x1="${q}" y1="0" x2="${q}" y2="${h}" stroke="${xmlEscape(strokeCol)}" stroke-width="1"/>`);
            else parts.push(`<line x1="0" y1="${q}" x2="${w}" y2="${q}" stroke="${xmlEscape(strokeCol)}" stroke-width="1"/>`);
          }
        };
        gridLine(gx.major / gx.div, true, colors.gridFine);
        gridLine(gy.major / gy.div, false, colors.gridFine);
        gridLine(gx.major, true, colors.grid);
        gridLine(gy.major, false, colors.grid);
      }
    }

    if (op.axes) {
      const ex = Math.round(graph.px(0)) + 0.5, ey = Math.round(graph.py(0)) + 0.5;
      parts.push(`<line x1="0" y1="${ey}" x2="${w}" y2="${ey}" stroke="${xmlEscape(colors.axis)}" stroke-width="1.5"/>`);
      parts.push(`<line x1="${ex}" y1="0" x2="${ex}" y2="${h}" stroke="${xmlEscape(colors.axis)}" stroke-width="1.5"/>`);
      const ly = Math.min(h - 16, Math.max(4, ey + 5));
      for (let i = Math.ceil(x0 / gx.major); i <= Math.floor(x1 / gx.major); i++) {
        if (i === 0) continue;
        const val = i * gx.major;
        const lbl = op.pi ? Graph.labelPi(val) : Graph.number(val, gx.major);
        parts.push(`<text x="${graph.px(val).toFixed(2)}" y="${ly}" text-anchor="middle" dominant-baseline="hanging" font-family="system-ui, sans-serif" font-size="12" fill="${xmlEscape(colors.text)}">${xmlEscape(lbl)}</text>`);
      }
      const inside = ex > 36, lx = Math.min(w - 6, Math.max(6, ex - 7));
      for (let i = Math.ceil(y0 / gy.major); i <= Math.floor(y1 / gy.major); i++) {
        if (i === 0) continue;
        const lbl = Graph.number(i * gy.major, gy.major);
        parts.push(`<text x="${lx}" y="${graph.py(i * gy.major).toFixed(2)}" text-anchor="${inside ? 'end' : 'start'}" dominant-baseline="central" font-family="system-ui, sans-serif" font-size="12" fill="${xmlEscape(colors.text)}">${xmlEscape(lbl)}</text>`);
      }
      if (ex > 14 && ey < h - 14) {
        parts.push(`<text x="${ex - 6}" y="${ey + 5}" text-anchor="end" dominant-baseline="hanging" font-family="system-ui, sans-serif" font-size="12" fill="${xmlEscape(colors.text)}">0</text>`);
      }
    }

    const drawn = objects();
    const order = [...drawn].sort((a, b) => (b.o.type === 'inequality') - (a.o.type === 'inequality'));
    for (const item of order) {
      const { o, style } = item;
      if (o.type === 'explicit' || o.type === 'explicitX') {
        const segs = graph.explicitSegments(o.f, o.type === 'explicit' ? 'x' : 'y');
        parts.push(polylineSvg(segs, style));
        if (item.derivative) {
          const dFn = (u) => Formulas.derivative(o.f, u);
          parts.push(polylineSvg(graph.explicitSegments(dFn, o.type === 'explicit' ? 'x' : 'y'),
            { ...style, thickness: Math.max(1.2, style.thickness * 0.65), stroke: 'dashed', alpha: 0.75 }));
        }
      } else if (o.type === 'polar' || o.type === 'parametric') {
        const [a, b] = item.range;
        const point = o.type === 'polar'
          ? (t) => { const r = o.f(t); return [graph.px(r * Math.cos(t)), graph.py(r * Math.sin(t)), t]; }
          : (t) => { const [x, y] = o.f(t); return [graph.px(x), graph.py(y), t]; };
        const n = Math.min(6000, Math.max(600, Math.ceil(Math.abs(b - a) * 60)));
        parts.push(polylineSvg(graph.sample(point, a, b, n), style));
      } else if (o.type === 'implicit' || o.type === 'inequality') {
        if (o.type === 'inequality') {
          const strict = o.op === '<' || o.op === '>';
          const borderStyle = { ...style, stroke: strict ? 'dashed' : style.stroke };
          const b = o.border;
          if (b && !b.restricted) {
            const segs = graph.explicitSegments(b.f, b.axis === 'y' ? 'x' : 'y');
            const vertical = b.axis === 'y';
            const bound = vertical ? (b.greater ? -10 : h + 10) : (b.greater ? w + 10 : -10);
            for (const t of segs) {
              if (!t.length) continue;
              const a = t[0], z = t[t.length - 1];
              const poly = vertical
                ? `${t.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')} ${z[0].toFixed(2)},${bound} ${a[0].toFixed(2)},${bound}`
                : `${t.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ')} ${bound},${z[1].toFixed(2)} ${bound},${a[1].toFixed(2)}`;
              parts.push(`<polygon points="${poly}" fill="${xmlEscape(style.color)}" fill-opacity="0.17"/>`);
            }
            parts.push(polylineSvg(segs, borderStyle));
          } else {
            parts.push(polylineSvg(graph.contour(o.F, 4), borderStyle));
          }
        } else {
          parts.push(polylineSvg(graph.contour(o.F, 3), { ...style, stroke: 'solid' }));
        }
      } else if (o.type === 'point') {
        const [x, y] = o.f();
        if (Number.isFinite(x) && Number.isFinite(y)) {
          parts.push(`<circle cx="${graph.px(x).toFixed(2)}" cy="${graph.py(y).toFixed(2)}" r="${(3 + style.thickness).toFixed(2)}" fill="${xmlEscape(style.color)}" stroke="${xmlEscape(colors.bg)}" stroke-width="2"/>`);
        }
      }
    }

    for (const p of graph.notables) {
      parts.push(`<circle cx="${p.X.toFixed(2)}" cy="${p.Y.toFixed(2)}" r="4" fill="${xmlEscape(p.color)}" stroke="${xmlEscape(colors.bg)}" stroke-width="2"/>`);
    }

    const visible = drawn.map((o) => ({ color: o.style.color, text: state.lines.find((l) => l.id === o.id)?.text || '' })).filter((v) => v.text);
    if (visible.length) {
      const measureCtx = canvas.getContext('2d');
      measureCtx.font = '15px "Cambria Math", Cambria, serif';
      const maxTextW = Math.max(...visible.map((v) => measureCtx.measureText(v.text).width), 140);
      const boxW = Math.min(w - 24, Math.ceil(maxTextW + 54));
      const boxH = visible.length * 22 + 12;
      parts.push(`<rect x="12" y="12" width="${boxW}" height="${boxH}" fill="${xmlEscape(colors.bg)}" stroke="${xmlEscape(colors.grid)}" stroke-width="1"/>`);
      visible.forEach((v, i) => {
        const y = 29 + i * 22;
        parts.push(`<rect x="20" y="${y - 3}" width="12" height="6" fill="${xmlEscape(v.color)}"/>`);
        parts.push(`<text x="40" y="${y}" dominant-baseline="central" font-family="Cambria Math, Cambria, serif" font-size="15" fill="${xmlEscape(colors.text)}">${xmlEscape(v.text)}</text>`);
      });
    }

    parts.push('</svg>');
    return parts.join('\n');
  }

  /**
   * Converts a plain Grapher formula expression into a readable LaTeX expression
   * for common elementary functions, constants, roots, and exponents.
   */
  function formulaToLatex(raw) {
    let s = raw.trim();
    if (!s) return '';
    s = s.replace(/\\text\{[^}]*\}/g, '');
    s = s.replace(/<=/g, '\\le ').replace(/>=/g, '\\ge ');
    s = s.replace(/\bpi\b/g, '\\pi').replace(/\btau\b/g, '\\tau').replace(/\btheta\b/g, '\\theta');
    s = s.replace(/\b(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log)\b/g, '\\$1');
    s = s.replace(/\bsqrt\(([^()]+)\)/g, '\\sqrt{$1}');
    s = s.replace(/\^(\([^()]+\)|[A-Za-z0-9]+)/g, (_, exp) => `^{${exp.replace(/^\(|\)$/g, '')}}`);
    return s;
  }

  /**
   * Builds a LaTeX (.tex) document containing the active formulas.
   */
  function buildLatex() {
    const items = state.lines.map((l) => l.text.trim()).filter((t) => t && !t.startsWith('#'));
    const body = items.length
      ? items.map((t, idx) => `  ${formulaToLatex(t)}${idx < items.length - 1 ? ' \\\\' : ''}`).join('\n')
      : '  y = x^2';
    return [
      '% Exported from Grapher',
      '\\documentclass{article}',
      '\\usepackage{amsmath}',
      '\\begin{document}',
      '\\begin{aligned}',
      body,
      '\\end{aligned}',
      '\\end{document}',
      '',
    ].join('\n');
  }

  /**
   * Builds a MathML (.xml / .mml) document representing the formulas.
   */
  function buildMathMl() {
    const items = state.lines.map((l) => l.text.trim()).filter((t) => t && !t.startsWith('#'));
    const children = (items.length ? items : ['y = x^2']).map((t) =>
      `    <semantics><annotation encoding="application/x-grapher">${xmlEscape(t)}</annotation><mtext>${xmlEscape(t)}</mtext></semantics>`
    ).join('\n');
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">',
      '  <mrow>',
      children,
      '  </mrow>',
      '</math>',
      '',
    ].join('\n');
  }

  /**
   * Converts common LaTeX or MathML constructs into Grapher formula lines.
   * @param {string} raw File text.
   * @returns {string[]} Extracted formula strings.
   */
  function parseLatexOrMathMl(raw) {
    const text = raw.trim();
    if (!text) return [];

    if (text.startsWith('<') || /<math[\s>]/i.test(text)) {
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      if (doc.querySelector('parsererror')) throw new Error('xml');
      const annotations = [...doc.querySelectorAll('annotation')].map((n) => n.textContent.trim()).filter(Boolean);
      if (annotations.length) return annotations;
      const mtexts = [...doc.querySelectorAll('mtext')].map((n) => n.textContent.trim()).filter(Boolean);
      if (mtexts.length) return mtexts;
      const root = doc.querySelector('math') || doc.documentElement;
      const tokens = [...root.querySelectorAll('mi, mn, mo')].map((n) => n.textContent.trim()).filter(Boolean);
      return tokens.length ? [tokens.join(' ')] : [];
    }

    const cleaned = text
      .replace(/%.*$/gm, '')
      .replace(/\\begin\{aligned\}|\\end\{aligned\}|\\\[|\\\]|\\\(|\\\)|\\documentclass(\[[^\]]*\])?\{[^}]*\}|\\usepackage(\[[^\]]*\])?\{[^}]*\}|\\begin\{document\}|\\end\{document\}/g, '\n');

    return cleaned
      .split(/\\\\|\n/)
      .map((line) => line
        .replace(/&=/g, '=')
        .replace(/&/g, ' ')
        .replace(/\\left|\\right/g, '')
        .replace(/\\le\b/g, '<=')
        .replace(/\\ge\b/g, '>=')
        .replace(/\\cdot|\\times/g, '*')
        .replace(/\\pi\b/g, 'π')
        .replace(/\\tau\b/g, 'τ')
        .replace(/\\theta\b/g, 'θ')
        .replace(/\\sqrt\{([^{}]+)\}/g, 'sqrt($1)')
        .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
        .replace(/\\(sin|cos|tan|sec|csc|cot|arcsin|arccos|arctan|sinh|cosh|tanh|ln|log)\b/g, '$1')
        .replace(/\^\{([^{}]+)\}/g, '^($1)')
        .replace(/[{}]/g, '')
        .trim())
      .filter(Boolean);
  }

  /**
   * Downloads a Blob as a file.
   */
  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = el('a', { href: url, download: filename });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  $('#btnPng').addEventListener('click', () => {
    interacting = false; paint();
    const copy = el('canvas', { width: canvas.width, height: canvas.height });
    const c = copy.getContext('2d');
    c.drawImage(canvas, 0, 0);
    c.scale(graph.dpr, graph.dpr);
    const visible = objects().map((o) => ({ color: o.style.color, text: state.lines.find((l) => l.id === o.id).text }));
    if (visible.length) {
      c.font = '16px "Cambria Math", Cambria, serif'; c.textBaseline = 'middle';
      const width = Math.min(graph.w - 24, Math.max(...visible.map((v) => c.measureText(v.text).width)) + 42);
      c.fillStyle = colors.bg; c.strokeStyle = colors.grid;
      c.fillRect(12, 12, width, visible.length * 24 + 12); c.strokeRect(12, 12, width, visible.length * 24 + 12);
      visible.forEach((v, i) => {
        const y = 30 + i * 24;
        c.fillStyle = v.color; c.fillRect(21, y - 3, 12, 6);
        c.fillStyle = colors.text; c.fillText(v.text, 41, y, width - 40);
      });
    }
    copy.toBlob((b) => { if (b) { download(b, 'graph.png'); $('#notice').textContent = 'Image saved.'; } });
  });
  $('#btnSvg').addEventListener('click', () => {
    interacting = false; paint();
    download(new Blob([buildSvg()], { type: 'image/svg+xml;charset=utf-8' }), 'graph.svg');
    $('#notice').textContent = 'SVG image saved.';
  });
  $('#btnTex').addEventListener('click', () => {
    download(new Blob([buildLatex()], { type: 'application/x-tex;charset=utf-8' }), 'grapher-formulas.tex');
    $('#notice').textContent = 'LaTeX saved.';
  });
  $('#btnMml').addEventListener('click', () => {
    download(new Blob([buildMathMl()], { type: 'application/mathml+xml;charset=utf-8' }), 'grapher-formulas.xml');
    $('#notice').textContent = 'MathML saved.';
  });
  $('#btnExport').addEventListener('click', () => {
    download(new Blob([JSON.stringify(serialize(), null, 2)], { type: 'application/json' }), 'grapher-project.json');
    $('#notice').textContent = 'Project saved.';
  });
  $('#btnImport').addEventListener('click', () => $('#fileInput').click());
  $('#fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      animating.clear(); load(data); applyTheme(); syncOptions(); mountList();
      $('#notice').textContent = 'Project opened.';
    } catch (_) {
      $('#notice').textContent = 'That file is not a valid project. Choose a .json saved from this grapher.';
    }
  });
  $('#btnImportMath').addEventListener('click', () => $('#mathInput').click());
  $('#mathInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = parseLatexOrMathMl(await file.text());
      if (!imported.length) throw new Error('empty');
      const remainingSlots = Math.max(0, 100 - state.lines.length);
      const hasOnlyBlank = state.lines.length === 1 && !state.lines[0].text.trim();
      if (hasOnlyBlank) {
        nextId = 1;
        state.lines = imported.slice(0, 100).map((item, idx) => newLine({
          text: item.slice(0, 500),
          color: idx % 8,
        }));
      } else {
        const used = new Set(state.lines.map((l) => l.color));
        const added = imported.slice(0, remainingSlots).map((item) => {
          const free = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !used.has(i));
          if (free !== undefined) used.add(free);
          return newLine({ text: item.slice(0, 500), ...(free !== undefined ? { color: free } : {}) });
        });
        state.lines.push(...added);
      }
      state.active = state.lines[state.lines.length - 1].id;
      mountList();
      rows.get(state.active)?.input.focus();
      $('#notice').textContent = `Imported ${imported.length} formula(s).`;
    } catch (_) {
      $('#notice').textContent = 'Could not parse formulas from that file. Choose a valid .tex or MathML .xml/.mml file.';
    }
  });


  // ---- Startup ----
  graph.resize();
  graph.home();
  let restored = false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { load(JSON.parse(saved)); restored = true; }
  } catch (_) {}
  applyTheme();
  syncOptions();
  if (restored) mountList(); else startEmpty();
  new ResizeObserver(() => { graph.resize(); motion(); }).observe(canvas);
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
})();