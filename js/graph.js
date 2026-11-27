/**
 * graph.js - canvas renderer: grid and axes, curve sampling, implicit
 * contours, inequality regions, key points and hit testing.
 * Exposes the global `Graph` class.
 */
(function (global) {
  'use strict';

  class Graph {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.view = { cx: 0, cy: 0, sx: 60, sy: 60 };
      this.w = 0; this.h = 0;
      this.layer = document.createElement('canvas');
      this.paths = [];
      this.notables = [];
    }

    /**
     * Matches the canvas buffer to its CSS size and the device pixel ratio.
     */
    resize() {
      const r = this.canvas.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height); this.dpr = d;
      this.canvas.width = Math.round(this.w * d);
      this.canvas.height = Math.round(this.h * d);
    }

    px(x) { return this.w / 2 + (x - this.view.cx) * this.view.sx; }
    py(y) { return this.h / 2 - (y - this.view.cy) * this.view.sy; }
    mx(px) { return this.view.cx + (px - this.w / 2) / this.view.sx; }
    my(py) { return this.view.cy - (py - this.h / 2) / this.view.sy; }

    /**
     * Moves the view by a pixel offset.
     */
    pan(dx, dy) { this.view.cx -= dx / this.view.sx; this.view.cy += dy / this.view.sy; }

    /**
     * Scales the view around a pixel (default: the center).
     * @param {number} fx Horizontal factor.
     * @param {number} fy Vertical factor.
     */
    zoom(fx, fy, px = this.w / 2, py = this.h / 2) {
      const v = this.view, x = this.mx(px), y = this.my(py);
      const clamp = (s) => Math.min(1e8, Math.max(1e-6, s));
      v.sx = clamp(v.sx * fx); v.sy = clamp(v.sy * fy);
      v.cx = x - (px - this.w / 2) / v.sx;
      v.cy = y + (py - this.h / 2) / v.sy;
    }

    /**
     * Resets to the initial view centered on the origin.
     */
    home() {
      const s = Math.max(20, Math.min(this.w, this.h) / 12);
      this.view = { cx: 0, cy: 0, sx: s, sy: s };
    }

    /**
     * Chooses a "nice" major grid step for a pixel scale.
     */
    static step(scale, target = 90) {
      const raw = target / scale;
      const p = Math.pow(10, Math.floor(Math.log10(raw)));
      const m = raw / p;
      if (m < 1.5) return { major: p, div: 5 };
      if (m < 3.5) return { major: 2 * p, div: 4 };
      if (m < 7.5) return { major: 5 * p, div: 5 };
      return { major: 10 * p, div: 5 };
    }

    /**
     * Like step(), but in multiples of π for the x-axis.
     */
    static stepPi(scale) {
      const target = 90 / scale / Math.PI;
      const op = [1 / 12, 1 / 6, 1 / 4, 1 / 2, 1, 2, 4, 5, 10, 20, 50, 100, 200, 500, 1000, 1e4, 1e5, 1e6];
      const k = op.find((v) => v >= target * 0.75) || 1e6;
      return { major: k * Math.PI, div: 2, k };
    }

    /**
     * Formats an axis label.
     */
    static number(v, step) {
      if (Math.abs(v) < step * 1e-6) return '0';
      if (Math.abs(v) >= 1e6 || Math.abs(v) < 1e-4) return v.toExponential(2).replace(/\.?0+e/, 'e').replace('-', '−');
      const dec = Math.max(0, Math.min(10, -Math.floor(Math.log10(step) + 1e-9)));
      return v.toFixed(dec).replace('-', '−');
    }

    /**
     * Formats a multiple of π, e.g. 3π/2.
     */
    static labelPi(v) {
      const k = v / Math.PI;
      for (const den of [1, 2, 3, 4, 6, 12]) {
        const num = Math.round(k * den);
        if (Math.abs(k * den - num) < 1e-6) {
          if (num === 0) return '0';
          const a = Math.abs(num);
          return (num < 0 ? '−' : '') + (a === 1 ? '' : a) + 'π' + (den === 1 ? '' : '/' + den);
        }
      }
      return k.toFixed(2) + 'π';
    }

    /**
     * Draws the grid, axes and axis numbers.
     */
    grid(theme, op) {
      const c = this.ctx, v = this.view;
      const gx = op.pi ? Graph.stepPi(v.sx) : Graph.step(v.sx);
      const gy = Graph.step(v.sy);
      const x0 = this.mx(0), x1 = this.mx(this.w), y0 = this.my(this.h), y1 = this.my(0);

      const lines = (step, vertical, color) => {
        const a = vertical ? x0 : y0, b = vertical ? x1 : y1;
        c.beginPath();
        for (let i = Math.ceil(a / step); i <= Math.floor(b / step); i++) {
          const q = Math.round(vertical ? this.px(i * step) : this.py(i * step)) + 0.5;
          if (vertical) { c.moveTo(q, 0); c.lineTo(q, this.h); } else { c.moveTo(0, q); c.lineTo(this.w, q); }
        }
        c.strokeStyle = color; c.lineWidth = 1; c.stroke();
      };

      if (op.grid) {
        if (op.polar) this.polarGrid(theme, gy.major);
        else {
          lines(gx.major / gx.div, true, theme.gridFine);
          lines(gy.major / gy.div, false, theme.gridFine);
          lines(gx.major, true, theme.grid);
          lines(gy.major, false, theme.grid);
        }
      }
      if (!op.axes) return;

      const ex = Math.round(this.px(0)) + 0.5, ey = Math.round(this.py(0)) + 0.5;
      c.strokeStyle = theme.axis; c.lineWidth = 1.5; c.beginPath();
      c.moveTo(0, ey); c.lineTo(this.w, ey); c.moveTo(ex, 0); c.lineTo(ex, this.h); c.stroke();

      c.font = '12px system-ui, sans-serif';
      c.lineWidth = 3; c.strokeStyle = theme.bg; c.fillStyle = theme.text; c.lineJoin = 'round';
      const write = (t, x, y) => { c.strokeText(t, x, y); c.fillText(t, x, y); };

      const ly = Math.min(this.h - 16, Math.max(4, ey + 5));
      c.textAlign = 'center'; c.textBaseline = 'top';
      for (let i = Math.ceil(x0 / gx.major); i <= Math.floor(x1 / gx.major); i++) {
        if (i === 0) continue;
        const val = i * gx.major;
        write(op.pi ? Graph.labelPi(val) : Graph.number(val, gx.major), this.px(val), ly);
      }
      const inside = ex > 36, lx = Math.min(this.w - 6, Math.max(6, ex - 7));
      c.textAlign = inside ? 'right' : 'left'; c.textBaseline = 'middle';
      for (let i = Math.ceil(y0 / gy.major); i <= Math.floor(y1 / gy.major); i++) {
        if (i === 0) continue;
        write(Graph.number(i * gy.major, gy.major), lx, this.py(i * gy.major));
      }
      c.textAlign = 'right'; c.textBaseline = 'top';
      if (ex > 14 && ey < this.h - 14) write('0', ex - 6, ey + 5);
    }

    /**
     * Draws concentric circles and radial lines.
     */
    polarGrid(theme, step) {
      const c = this.ctx, v = this.view, ox = this.px(0), oy = this.py(0);
      const far = Math.max(...[[0, 0], [this.w, 0], [0, this.h], [this.w, this.h]]
        .map(([x, y]) => Math.hypot(this.mx(x), this.my(y))));
      const near = Math.hypot(Math.max(this.mx(0), 0, -this.mx(this.w)), Math.max(this.my(this.h), 0, -this.my(0)));
      c.strokeStyle = theme.grid; c.lineWidth = 1;
      const start = Math.max(1, Math.floor(near / step));
      for (let i = start; i * step <= far && i < start + 200; i++) {
        c.beginPath(); c.ellipse(ox, oy, i * step * v.sx, i * step * v.sy, 0, 0, 2 * Math.PI); c.stroke();
      }
      c.strokeStyle = theme.gridFine; c.beginPath();
      for (let k = 0; k < 24; k++) {
        const a = k * Math.PI / 12;
        c.moveTo(ox, oy); c.lineTo(this.px(Math.cos(a) * far), this.py(Math.sin(a) * far));
      }
      c.stroke();
    }

    /**
     * Samples a point function into continuous screen-space segments,
     * refining near jumps and splitting at asymptotes and undefined values.
     */
    sample(point, a, b, n) {
      const segments = [];
      let current = [];
      const split = () => { if (current.length > 1) segments.push(current); current = []; };
      const ok = (p) => Number.isFinite(p[0]) && Number.isFinite(p[1]);
      const clamp = (q) => Math.max(-1e5, Math.min(1e5, q));
      const push = (p) => current.push([clamp(p[0]), clamp(p[1]), p[2]]);
      const sameSide = (p, q) => (p[0] < -50 && q[0] < -50) || (p[0] > this.w + 50 && q[0] > this.w + 50) ||
        (p[1] < -50 && q[1] < -50) || (p[1] > this.h + 50 && q[1] > this.h + 50);
      let budget = 60000;

      const join = (u, p, v, q, depth) => {
        const pOk = ok(p), qOk = ok(q);
        if (!pOk && !qOk && depth >= 3) { split(); return; }
        const dist = pOk && qOk ? Math.hypot(q[0] - p[0], q[1] - p[1]) : Infinity;
        let refine = dist > 3 && !(pOk && qOk && sameSide(p, q));
        const m = (u + v) / 2;
        let pm = null;
        if (!refine && pOk && qOk && depth < 2 && !sameSide(p, q)) {
          pm = point(m);
          refine = !ok(pm) || Math.hypot(pm[0] - (p[0] + q[0]) / 2, pm[1] - (p[1] + q[1]) / 2) > 1;
        }
        if (refine && depth < 11 && budget > 0) {
          budget--;
          pm = pm || point(m);
          join(u, p, m, pm, depth + 1);
          join(m, pm, v, q, depth + 1);
          return;
        }
        if (!qOk) { split(); return; }
        if (!pOk || (dist > 12 && !sameSide(p, q))) { split(); }
        else if (!current.length) push(p);
        push(q);
      };

      let u = a, p = point(a);
      for (let i = 1; i <= n; i++) {
        const v = a + (b - a) * i / n, q = point(v);
        join(u, p, v, q, 0);
        u = v; p = q;
      }
      split();
      return segments;
    }

    /**
     * Strokes polylines with the given color, thickness and dash style.
     */
    strokeSegments(segments, style) {
      const c = this.ctx;
      c.save();
      c.strokeStyle = style.color; c.lineWidth = style.thickness;
      c.lineJoin = 'round'; c.lineCap = 'round';
      const g = style.thickness;
      if (style.stroke === 'dashed') c.setLineDash([g * 3.5, g * 2.5]);
      if (style.stroke === 'dotted') c.setLineDash([0.1, g * 2.4]);
      c.globalAlpha = style.alpha ?? 1;
      c.beginPath();
      for (const t of segments) {
        c.moveTo(t[0][0], t[0][1]);
        for (let i = 1; i < t.length; i++) c.lineTo(t[i][0], t[i][1]);
      }
      c.stroke();
      c.restore();
    }

    /**
     * Samples y = f(x) (axis "x") or x = f(y) (axis "y").
     */
    explicitSegments(f, axis) {
      if (axis === 'x') {
        return this.sample((x) => [this.px(x), this.py(f(x)), x], this.mx(-4), this.mx(this.w + 4), Math.ceil(this.w / 2));
      }
      return this.sample((y) => [this.px(f(y)), this.py(y), y], this.my(this.h + 4), this.my(-4), Math.ceil(this.h / 2));
    }

    /**
     * Marching-squares contour of F(x, y) = 0 for implicit equations.
     * @param {number} cell Cell size in pixels.
     */
    contour(F, cell) {
      const nx = Math.ceil(this.w / cell), ny = Math.ceil(this.h / cell);
      const dx = this.w / nx, dy = this.h / ny;
      let prev = new Float64Array(nx + 1), row = new Float64Array(nx + 1);
      const segments = [];
      const xs = Array.from({ length: nx + 1 }, (_, i) => this.mx(i * dx));
      // Small offset so grid samples rarely hit exact zeros
      const eps = 1e-7 / this.view.sx;
      const val = (i, y) => { const v = F(xs[i] + eps, y); return v === 0 ? 1e-300 : v; };
      for (let i = 0; i <= nx; i++) prev[i] = val(i, this.my(0) + eps);
      for (let j = 1; j <= ny; j++) {
        const yA = this.my((j - 1) * dy) + eps, yB = this.my(j * dy) + eps;
        for (let i = 0; i <= nx; i++) row[i] = val(i, yB);
        for (let i = 0; i < nx; i++) {
          const v = [prev[i], prev[i + 1], row[i + 1], row[i]];
          if (!v.every(Number.isFinite)) continue;
          if ((v[0] > 0) === (v[1] > 0) && (v[1] > 0) === (v[2] > 0) && (v[2] > 0) === (v[3] > 0)) continue;
          const corners = [[xs[i], yA], [xs[i + 1], yA], [xs[i + 1], yB], [xs[i], yB]];
          const cuts = [];
          for (let k = 0; k < 4; k++) {
            const a = v[k], b = v[(k + 1) % 4];
            if ((a > 0) === (b > 0)) continue;
            const t = a / (a - b), P = corners[k], Q = corners[(k + 1) % 4];
            const x = P[0] + (Q[0] - P[0]) * t, y = P[1] + (Q[1] - P[1]) * t;
            const r = F(x, y);
            // Reject sign flips caused by asymptotes rather than roots
            if (Math.abs(r) > Math.max(Math.abs(a), Math.abs(b))) continue;
            cuts.push([this.px(x), this.py(y)]);
          }
          for (let k = 0; k + 1 < cuts.length; k += 2) segments.push([cuts[k], cuts[k + 1]]);
        }
        [prev, row] = [row, prev];
      }
      return segments;
    }

    /**
     * Fills and outlines the area of an inequality.
     */
    region(o, style) {
      const c = this.ctx;
      const strict = o.op === '<' || o.op === '>';
      const borderStyle = { ...style, stroke: strict ? 'dashed' : style.stroke };
      const b = o.border;
      if (b && !b.restricted) {
        const segments = this.explicitSegments(b.f, b.axis === 'y' ? 'x' : 'y');
        c.save(); c.fillStyle = style.color; c.globalAlpha = 0.17;
        const vertical = b.axis === 'y';
        const bound = vertical ? (b.greater ? -10 : this.h + 10) : (b.greater ? this.w + 10 : -10);
        for (const t of segments) {
          const a = t[0], z = t[t.length - 1];
          c.beginPath(); c.moveTo(a[0], a[1]);
          for (const p of t) c.lineTo(p[0], p[1]);
          if (vertical) { c.lineTo(z[0], bound); c.lineTo(a[0], bound); }
          else { c.lineTo(bound, z[1]); c.lineTo(bound, a[1]); }
          c.closePath(); c.fill();
        }
        c.restore();
        this.strokeSegments(segments, borderStyle);
        return segments;
      }
      const step = 3, nx = Math.ceil(this.w / step), ny = Math.ceil(this.h / step);
      this.layer.width = nx; this.layer.height = ny;
      const cc = this.layer.getContext('2d');
      cc.fillStyle = style.color;
      for (let j = 0; j < ny; j++) {
        const y = this.my((j + 0.5) * step);
        let start = -1;
        for (let i = 0; i <= nx; i++) {
          const inside = i < nx && o.inside(this.mx((i + 0.5) * step), y);
          if (inside && start < 0) start = i;
          if (!inside && start >= 0) { cc.fillRect(start, j, i - start, 1); start = -1; }
        }
      }
      c.save(); c.globalAlpha = 0.2; c.imageSmoothingEnabled = true;
      c.drawImage(this.layer, 0, 0, nx * step, ny * step); c.restore();
      const segments = this.contour(o.F, 4);
      this.strokeSegments(segments, borderStyle);
      return segments;
    }

    /**
     * Draws a full frame: background, grid, every object and key points.
     */
    draw(objects, theme, op) {
      const c = this.ctx;
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.fillStyle = theme.bg; c.fillRect(0, 0, this.w, this.h);
      this.grid(theme, op);
      this.paths = [];

      const order = [...objects].sort((a, b) => (b.o.type === 'inequality') - (a.o.type === 'inequality'));
      for (const item of order) {
        const { o, style, id } = item;
        let segments = [];
        switch (o.type) {
          case 'explicit': case 'explicitX':
            segments = this.explicitSegments(o.f, o.type === 'explicit' ? 'x' : 'y');
            this.strokeSegments(segments, style);
            if (item.derivative) {
              const d = (u) => global.Formulas.derivative(o.f, u);
              this.strokeSegments(this.explicitSegments(d, o.type === 'explicit' ? 'x' : 'y'),
                { ...style, thickness: Math.max(1.2, style.thickness * 0.65), stroke: 'dashed', alpha: 0.75 });
            }
            break;
          case 'polar': case 'parametric': {
            const [a, b] = item.range;
            const point = o.type === 'polar'
              ? (t) => { const r = o.f(t); return [this.px(r * Math.cos(t)), this.py(r * Math.sin(t)), t]; }
              : (t) => { const [x, y] = o.f(t); return [this.px(x), this.py(y), t]; };
            const n = Math.min(6000, Math.max(600, Math.ceil(Math.abs(b - a) * 60)));
            segments = this.sample(point, a, b, n);
            this.strokeSegments(segments, style);
            break;
          }
          case 'implicit':
            segments = this.contour(o.F, op.fast ? 6 : 3);
            this.strokeSegments(segments, { ...style, stroke: 'solid' });
            break;
          case 'inequality':
            segments = this.region(o, style);
            break;
          case 'point': {
            const [x, y] = o.f();
            if (Number.isFinite(x) && Number.isFinite(y)) {
              this.mark(this.px(x), this.py(y), style.color, theme, 3 + style.thickness);
              segments = [[[this.px(x), this.py(y)]]];
            }
            break;
          }
        }
        this.paths.push({ id, o, color: style.color, segments });
      }

      this.notables = [];
      if (op.notables) this.drawNotables(objects, theme, op.active);
    }

    /**
     * Draws a dot with a background-colored outline.
     */
    mark(x, y, color, theme, r = 4.5) {
      const c = this.ctx;
      c.beginPath(); c.arc(x, y, r, 0, 2 * Math.PI);
      c.fillStyle = color; c.fill();
      c.lineWidth = 2; c.strokeStyle = theme.bg; c.stroke();
    }

    /**
     * Finds zeros of g in [a, b] by scanning n steps and bisecting sign changes.
     */
    static zeros(g, a, b, n) {
      const out = [];
      const h = (b - a) / n;
      let x0 = a, v0 = g(a);
      for (let i = 1; i <= n && out.length < 40; i++) {
        const x1 = a + i * h, v1 = g(x1);
        if (Number.isFinite(v0) && Number.isFinite(v1)) {
          if (v0 === 0 && v1 !== 0) out.push(x0);
          else if (v0 * v1 < 0) {
            let l = x0, r = x1, vl = v0;
            for (let k = 0; k < 50; k++) {
              const m = (l + r) / 2, vm = g(m);
              if (vl * vm <= 0) r = m; else { l = m; vl = vm; }
            }
            const m = (l + r) / 2;
            if (Math.abs(g(m)) < 1e-6 * (1 + Math.abs(v1 - v0))) out.push(m);
          }
        }
        x0 = x1; v0 = v1;
      }
      return out;
    }

    /**
     * Finds and draws roots, extrema, intersections and the y-intercept of the active function.
     */
    drawNotables(objects, theme, active) {
      const exp = objects.filter((q) => q.o.type === 'explicit');
      const primary = exp.find((q) => q.id === active) || exp[0];
      if (!primary) return;
      const f = primary.o.f, a = this.mx(0), b = this.mx(this.w), n = Math.ceil(this.w / 2);
      const add = (type, x, y, color) => {
        if (!Number.isFinite(y)) return;
        if (Math.abs(x) < 0.05 / this.view.sx) x = 0;
        if (Math.abs(y) < 0.05 / this.view.sy) y = 0;
        const X = this.px(x), Y = this.py(y);
        if (X < 0 || X > this.w || Y < 0 || Y > this.h) return;
        if (this.notables.some((p) => Math.hypot(p.X - X, p.Y - Y) < 4)) return;
        this.notables.push({ type, x, y, X, Y, color });
      };

      for (const other of exp) {
        if (other === primary) continue;
        for (const x of Graph.zeros((u) => f(u) - other.o.f(u), a, b, n)) add('Intersection', x, f(x), theme.text);
      }
      for (const x of Graph.zeros(f, a, b, n)) add('Root', x, 0, primary.style.color);
      const d = (u) => global.Formulas.derivative(f, u);
      // Dampen finite-difference noise on flat sections
      const d1 = (u) => { const v = d(u); return Math.abs(v) < 1e-9 ? 0 : v; };
      const h = 2 / this.view.sx;
      for (const x of Graph.zeros(d1, a, b, n)) {
        const y = f(x), l = f(x - h), r = f(x + h);
        if (y > l && y > r) add('Maximum', x, y, primary.style.color);
        else if (y < l && y < r) add('Minimum', x, y, primary.style.color);
      }
      add('y-intercept', 0, f(0), primary.style.color);
      for (const p of this.notables) this.mark(p.X, p.Y, p.color, theme, 4);
    }

    /**
     * Returns the closest curve or key point to a pixel position, or null.
     */
    nearest(X, Y) {
      for (const p of this.notables) if (Math.hypot(p.X - X, p.Y - Y) < 10) return { ...p, label: p.type };
      let best = null, dist = 24;
      for (const t of this.paths) {
        if (t.o.type === 'explicit') {
          const x = this.mx(X), y = t.o.f(x);
          if (Number.isFinite(y)) {
            const d = Math.abs(this.py(y) - Y);
            if (d < dist) {
              dist = d;
              best = { x, y, X, Y: this.py(y), color: t.color, slope: global.Formulas.derivative(t.o.f, x) };
            }
          }
        }
        for (const s of t.segments) {
          for (let i = 0; i < s.length; i++) {
            const A = s[i], B = s[i + 1] || A;
            const vx = B[0] - A[0], vy = B[1] - A[1], l2 = vx * vx + vy * vy;
            const k = l2 ? Math.max(0, Math.min(1, ((X - A[0]) * vx + (Y - A[1]) * vy) / l2)) : 0;
            const qx = A[0] + k * vx, qy = A[1] + k * vy, d = Math.hypot(qx - X, qy - Y);
            if (d < dist - (t.o.type === 'explicit' ? 4 : 0)) {
              dist = d;
              best = { x: this.mx(qx), y: this.my(qy), X: qx, Y: qy, color: t.color };
              if (t.o.type === 'explicit') {
                const y = t.o.f(best.x);
                if (Number.isFinite(y)) {
                  best.y = y; best.Y = this.py(y);
                  best.slope = global.Formulas.derivative(t.o.f, best.x);
                }
              }
            }
          }
        }
      }
      return best;
    }
  }

  global.Graph = Graph;
})(window);