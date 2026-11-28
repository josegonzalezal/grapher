/**
 * polytope.js - N-dimensional polytope generator (hypercube, orthoplex, simplex),
 * multi-plane rotations, multidimensional formula modulation, edge-bridging mesh
 * generator between polytope edges, cascade projection (ND -> 3D -> 2D) and
 * high-contrast canvas renderer for dimensions 3D..11D.
 * Exposes the global `PolytopeND` class.
 */
(function (global) {
  'use strict';

  const AXIS_NAMES = ['X', 'Y', 'Z', 'W', 'V', 'U', 'T', 'S', 'R', 'Q', 'P'];
  const VAR_NAMES = ['x', 'y', 'z', 'w', 'v', 'u', 't', 's', 'r', 'q', 'p'];

  function buildHypercube(dim) {
    const count = 1 << dim;
    const vertices = new Array(count);
    for (let mask = 0; mask < count; mask++) {
      const v = new Array(dim);
      for (let axis = 0; axis < dim; axis++) {
        v[axis] = (mask >> axis) & 1 ? 1 : -1;
      }
      vertices[mask] = v;
    }

    const edges = [];
    for (let i = 0; i < count; i++) {
      for (let axis = 0; axis < dim; axis++) {
        const j = i ^ (1 << axis);
        if (i < j) edges.push([i, j]);
      }
    }
    return { vertices, edges };
  }

  function buildOrthoplex(dim) {
    const vertices = [];
    for (let axis = 0; axis < dim; axis++) {
      const pos = new Array(dim).fill(0);
      const neg = new Array(dim).fill(0);
      pos[axis] = 1.65;
      neg[axis] = -1.65;
      vertices.push(pos, neg);
    }

    const edges = [];
    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        const sameAxis = Math.floor(i / 2) === Math.floor(j / 2);
        if (!sameAxis) edges.push([i, j]);
      }
    }
    return { vertices, edges };
  }

  function buildSimplex(dim) {
    const vertices = [];
    for (let i = 0; i <= dim; i++) {
      const v = new Array(dim).fill(-0.55);
      if (i < dim) v[i] = 1.45;
      vertices.push(v);
    }

    const edges = [];
    for (let i = 0; i < vertices.length; i++) {
      for (let j = i + 1; j < vertices.length; j++) {
        edges.push([i, j]);
      }
    }
    return { vertices, edges };
  }

  function listRotationPlanes(dim) {
    const planes = [];
    for (let i = 0; i < dim; i++) {
      for (let j = i + 1; j < dim; j++) {
        const a = AXIS_NAMES[i] || `x${i + 1}`;
        const b = AXIS_NAMES[j] || `x${j + 1}`;
        planes.push({ key: `${a}${b}`, i, j, label: `${a}${b}` });
      }
    }
    return planes;
  }

  function compileNDFormula(expr) {
    const raw = String(expr || '').trim();
    if (!raw) return { targetAxis: null, fn: null, error: '' };

    let targetAxis = null;
    let body = raw;
    const eqMatch = raw.match(/^([a-zA-Z]\w*)\s*=\s*(.+)$/);
    if (eqMatch) {
      const lhs = eqMatch[1].toLowerCase();
      const idx = VAR_NAMES.indexOf(lhs);
      if (idx === -1) {
        return { targetAxis: null, fn: null, error: `Unknown target axis "${eqMatch[1]}"` };
      }
      targetAxis = idx;
      body = eqMatch[2].trim();
    }

    const Formulas = global.Formulas;
    if (!Formulas || typeof Formulas.compileExpression !== 'function') {
      return { targetAxis: null, fn: null, error: 'Formula parser is not available' };
    }

    const argNames = [...VAR_NAMES, 'i', 'd'];
    const compiled = Formulas.compileExpression(body, argNames);
    if (!compiled.fn) {
      return { targetAxis: null, fn: null, error: compiled.error || 'Invalid formula' };
    }
    const testVal = compiled.fn(...new Array(argNames.length).fill(0.5));
    if (typeof testVal !== 'number') {
      return { targetAxis: null, fn: null, error: 'Expression must evaluate to a number' };
    }
    return { targetAxis, fn: compiled.fn, error: '' };
  }

  function buildEdgeMech(vertices, edges, dim, subdivisions, mechStyle) {
    const segs = Math.max(1, Math.min(6, Number(subdivisions) || 2));
    const maxSourceEdges = dim >= 10 ? 240 : dim >= 8 ? 480 : dim >= 6 ? 900 : edges.length;
    const activeEdges = edges.slice(0, maxSourceEdges);

    const meshEdges = [];
    const meshNodes = [];
    const edgeMidpoints = [];

    for (let eIdx = 0; eIdx < activeEdges.length; eIdx++) {
      const [i, j] = activeEdges[eIdx];
      const a = vertices[i];
      const b = vertices[j];
      if (!a || !b) continue;

      const ortho = new Array(dim).fill(0);
      for (let ax = 0; ax < dim; ax++) {
        const diff = b[ax] - a[ax];
        const orthoAx = (ax + 1) % dim;
        ortho[orthoAx] += (0.14 + 0.04 * (eIdx % 3)) * (ax % 2 === 0 ? 1 : -1);
        if (Math.abs(diff) < 1e-5) {
          ortho[ax] += 0.06 * Math.sin(eIdx + ax);
        }
      }

      let prevPt = null;
      for (let s = 0; s <= segs; s++) {
        const t = s / segs;
        const arch = Math.sin(Math.PI * t);
        const pt = new Array(dim);
        for (let ax = 0; ax < dim; ax++) {
          pt[ax] = a[ax] + (b[ax] - a[ax]) * t + ortho[ax] * arch * 0.45;
        }
        if (s > 0 && s < segs) meshNodes.push(pt);
        if (s === Math.floor(segs / 2)) edgeMidpoints.push({ pt, a, b, ortho, eIdx });
        if (prevPt) {
          meshEdges.push([prevPt, pt, 0.85]);
        }
        prevPt = pt;
      }
    }

    const maxBridges = Math.min(edgeMidpoints.length, 420);
    for (let m = 0; m < maxBridges; m++) {
      const cur = edgeMidpoints[m];
      const next = edgeMidpoints[(m + 1) % maxBridges];
      if (!next) continue;

      let distSq = 0;
      for (let ax = 0; ax < dim; ax++) {
        const d = cur.pt[ax] - next.pt[ax];
        distSq += d * d;
      }
      if (distSq <= 9.5) {
        meshEdges.push([cur.pt, next.pt, 0.55]);
      }

      if (mechStyle === 'truss' || mechStyle === 'lattice') {
        const strutA = new Array(dim);
        const strutB = new Array(dim);
        for (let ax = 0; ax < dim; ax++) {
          strutA[ax] = cur.pt[ax] + cur.ortho[ax] * 0.65;
          strutB[ax] = cur.pt[ax] - cur.ortho[ax] * 0.65;
        }
        meshEdges.push([cur.pt, strutA, 0.65]);
        meshEdges.push([cur.pt, strutB, 0.65]);
        if (mechStyle === 'lattice') {
          meshEdges.push([strutA, strutB, 0.48]);
          if (distSq <= 9.5) {
            const nextStrutA = new Array(dim);
            for (let ax = 0; ax < dim; ax++) {
              nextStrutA[ax] = next.pt[ax] + next.ortho[ax] * 0.65;
            }
            meshEdges.push([strutA, nextStrutA, 0.42]);
          }
        }
      }
    }

    return { meshEdges, meshNodes };
  }

  class PolytopeND {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.w = 0;
      this.h = 0;
      this.dpr = 1;
      this.dim = 4;
      this.shape = 'hypercube';
      this.autoRotate = true;
      this.wDistance = 3.6;
      this.formulaText = '';
      this.compiledFormula = { targetAxis: null, fn: null, error: '' };
      this.mechEnabled = false;
      this.mechStyle = 'truss';
      this.mechSubdivisions = 2;
      this.camera = {
        yaw: -0.68,
        pitch: 0.42,
        distance: 8.5,
        target: { x: 0, y: 0, z: 0 },
      };
      this.angles = {};
      this._ensureAngles();
    }

    setFormula(expr) {
      this.formulaText = String(expr || '');
      this.compiledFormula = compileNDFormula(this.formulaText);
      return this.compiledFormula;
    }

    setMechEnabled(enabled) {
      this.mechEnabled = Boolean(enabled);
    }

    setMechStyle(style) {
      if (['truss', 'lattice', 'ribs'].includes(style)) {
        this.mechStyle = style;
      }
    }

    setMechSubdivisions(subs) {
      this.mechSubdivisions = Math.max(1, Math.min(6, Number(subs) || 2));
    }

    _ensureAngles() {
      const planes = listRotationPlanes(this.dim);
      for (const p of planes) {
        if (!Number.isFinite(this.angles[p.key])) {
          this.angles[p.key] = p.i >= 3 || p.j >= 3 ? 0.55 : 0.25;
        }
      }
    }

    setDimension(dim) {
      this.dim = Math.max(3, Math.min(11, Number(dim) || 4));
      this._ensureAngles();
    }

    setShape(shape) {
      if (['hypercube', 'orthoplex', 'simplex'].includes(shape)) {
        this.shape = shape;
      }
    }

    home() {
      this.camera = {
        yaw: -0.68,
        pitch: 0.42,
        distance: 8.5,
        target: { x: 0, y: 0, z: 0 },
      };
      for (const p of listRotationPlanes(this.dim)) {
        this.angles[p.key] = p.i >= 3 || p.j >= 3 ? 0.55 : 0.25;
      }
    }

    stepAnimation(dt) {
      if (!this.autoRotate) return;
      const planes = listRotationPlanes(this.dim);
      let extraIdx = 0;
      for (const p of planes) {
        if (p.j >= 3) {
          const speed = 0.52 + extraIdx * 0.11;
          this.angles[p.key] = (this.angles[p.key] + speed * dt) % (Math.PI * 2);
          extraIdx++;
        }
      }
    }

    orbit(dx, dy) {
      this.camera.yaw += dx * 0.0085;
      this.camera.pitch = Math.max(-1.48, Math.min(1.48, this.camera.pitch + dy * 0.0085));
    }

    pan(dx, dy) {
      const { yaw, pitch, distance, target } = this.camera;
      const focal = Math.min(this.w || 800, this.h || 500) * 1.15;
      const scale = focal / Math.max(1, distance);

      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);

      const rightX = cy, rightY = -sy;
      const upX = -sy * sp, upY = -cy * sp, upZ = cp;

      const mx = -dx / scale;
      const my = dy / scale;

      target.x += rightX * mx + upX * my;
      target.y += rightY * mx + upY * my;
      target.z += upZ * my;
    }

    zoom(factor) {
      this.camera.distance = Math.max(2.0, Math.min(50, this.camera.distance / factor));
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      const d = window.devicePixelRatio || 1;
      this.w = Math.max(1, r.width || this.canvas.clientWidth || 800);
      this.h = Math.max(1, r.height || this.canvas.clientHeight || 500);
      this.dpr = d;
      this.canvas.width = Math.round(this.w * d);
      this.canvas.height = Math.round(this.h * d);
    }

    getGeometry() {
      let geom;
      if (this.shape === 'orthoplex') geom = buildOrthoplex(this.dim);
      else if (this.shape === 'simplex') geom = buildSimplex(this.dim);
      else geom = buildHypercube(this.dim);

      const { targetAxis, fn } = this.compiledFormula;
      if (!fn) return geom;

      const modulated = geom.vertices.map((rawV, idx) => {
        const v = rawV.slice();
        const args = VAR_NAMES.map((name, axIdx) => (axIdx < this.dim ? v[axIdx] : 0));
        args.push(idx, this.dim);
        const val = fn(...args);
        if (!Number.isFinite(val)) return v;
        const clamped = Math.max(-4, Math.min(4, val));
        if (targetAxis !== null && targetAxis < this.dim) {
          v[targetAxis] = clamped;
        } else {
          const fallbackAxis = this.dim > 3 ? this.dim - 1 : 2;
          v[fallbackAxis] = clamped;
        }
        return v;
      });

      return { vertices: modulated, edges: geom.edges };
    }

    projectPoint(rawPoint) {
      const vec = rawPoint.slice();
      const planes = listRotationPlanes(this.dim);

      for (const p of planes) {
        const theta = this.angles[p.key] || 0;
        if (Math.abs(theta) < 1e-6) continue;
        const c = Math.cos(theta);
        const s = Math.sin(theta);
        const vi = vec[p.i];
        const vj = vec[p.j];
        vec[p.i] = vi * c - vj * s;
        vec[p.j] = vi * s + vj * c;
      }

      let coords = vec;
      const highestExtra = this.dim > 3 ? vec[this.dim - 1] : 0;
      const stepDist = this.wDistance + Math.max(0, this.dim - 4) * 0.45;

      for (let d = this.dim - 1; d >= 3; d--) {
        const extra = coords[d] * 0.65;
        const denom = Math.max(1.1, stepDist - extra);
        const factor = stepDist / denom;
        coords = coords.slice(0, d).map((val) => val * factor);
      }

      const dimBoost = this.dim > 6 ? 1 + (this.dim - 6) * 0.16 : 1;
      const x = (coords[0] || 0) * dimBoost;
      const y = (coords[1] || 0) * dimBoost;
      const z = (coords[2] || 0) * dimBoost;

      const { yaw, pitch, distance, target } = this.camera;
      const tx = x - target.x;
      const ty = y - target.y;
      const tz = z - target.z;

      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cp = Math.cos(pitch), sp = Math.sin(pitch);

      const rx = tx * cy - ty * sy;
      const ry = tx * sy + ty * cy;
      const rz = tz;

      const cx = rx;
      const cz = rz * cp - ry * sp;
      const depth = ry * cp + rz * sp + distance;
      if (depth <= 0.2) return null;

      const focal = Math.min(this.w, this.h) * 1.18;
      const scale = focal / depth;
      return {
        X: this.w / 2 + cx * scale,
        Y: this.h / 2 - cz * scale,
        depth,
        wCoord: highestExtra,
      };
    }

    drawDimensionBadge(vertexCount, edgeCount, mechCount, theme) {
      const c = this.ctx;
      const extraAxes = AXIS_NAMES.slice(0, this.dim).join('·');
      const mechPart = this.mechEnabled ? ` · +${mechCount.toLocaleString()} mech` : '';
      const label = `${this.dim}D (${extraAxes}) · ${vertexCount.toLocaleString()}V / ${edgeCount.toLocaleString()}E${mechPart}`;

      c.save();
      c.font = '600 12px ui-monospace, "Cascadia Code", monospace';
      const padX = 10;
      const textW = c.measureText(label).width;
      const boxW = textW + padX * 2;
      const boxH = 26;
      const x = 14;
      const y = Math.max(14, this.h - 54 - boxH);

      c.fillStyle = theme.labelBg || 'rgba(24, 27, 34, 0.92)';
      c.strokeStyle = 'rgba(148, 163, 184, 0.32)';
      c.lineWidth = 1;
      c.beginPath();
      c.roundRect(x, y, boxW, boxH, 8);
      c.fill();
      c.stroke();

      c.fillStyle = theme.text || '#eceff5';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(label, x + padX, y + boxH / 2 + 0.5);
      c.restore();
    }

    draw(theme = {}) {
      if (!this.w || !this.h) this.resize();
      const c = this.ctx;
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.fillStyle = theme.bg || '#111318';
      c.fillRect(0, 0, this.w, this.h);

      const { vertices, edges } = this.getGeometry();
      const projected = vertices.map((v) => this.projectPoint(v));

      const drawnEdges = [];

      let mechEdgeCount = 0;
      let projectedMechNodes = [];
      if (this.mechEnabled) {
        const { meshEdges, meshNodes } = buildEdgeMech(
          vertices,
          edges,
          this.dim,
          this.mechSubdivisions,
          this.mechStyle
        );
        mechEdgeCount = meshEdges.length;

        for (const [ptA, ptB, weight] of meshEdges) {
          const pA = this.projectPoint(ptA);
          const pB = this.projectPoint(ptB);
          if (!pA || !pB) continue;
          drawnEdges.push({
            a: pA,
            b: pB,
            avgDepth: (pA.depth + pB.depth) * 0.5,
            avgW: (pA.wCoord + pB.wCoord) * 0.5,
            isMech: true,
            weight,
          });
        }

        projectedMechNodes = meshNodes.map((n) => this.projectPoint(n)).filter(Boolean);
      }

      for (const [i, j] of edges) {
        const a = projected[i];
        const b = projected[j];
        if (!a || !b) continue;
        drawnEdges.push({
          a,
          b,
          avgDepth: (a.depth + b.depth) * 0.5,
          avgW: (a.wCoord + b.wCoord) * 0.5,
          isMech: false,
          weight: 1,
        });
      }

      drawnEdges.sort((e1, e2) => e2.avgDepth - e1.avgDepth);

      const dense = drawnEdges.length > 4000;
      const baseAlpha = dense ? 0.48 : 0.92;
      const lineW = this.dim >= 9 ? 1.15 : this.dim >= 6 ? 1.55 : 2.35;

      c.lineCap = 'round';
      for (const e of drawnEdges) {
        const t = Math.max(0, Math.min(1, (e.avgW + 1.4) / 2.8));
        const depthFade = Math.max(0.28, Math.min(1, 12 / Math.max(2.5, e.avgDepth)));
        if (e.isMech) {
          const r = Math.round(245 - t * 90);
          const g = Math.round(158 + t * 55);
          const b = Math.round(66 + t * 150);
          const alpha = (dense ? 0.28 : 0.58) * e.weight * depthFade;
          c.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
          c.lineWidth = Math.max(0.75, lineW * 0.65 * e.weight);
        } else {
          const r = Math.round(56 + t * 195);
          const g = Math.round(202 - t * 96);
          const b = Math.round(252 - t * 32);
          c.strokeStyle = `rgba(${r}, ${g}, ${b}, ${(baseAlpha * depthFade).toFixed(3)})`;
          c.lineWidth = lineW * (0.75 + 0.45 * depthFade);
        }
        c.beginPath();
        c.moveTo(e.a.X, e.a.Y);
        c.lineTo(e.b.X, e.b.Y);
        c.stroke();
      }

      if (!dense && projectedMechNodes.length) {
        for (const mn of projectedMechNodes) {
          c.beginPath();
          c.arc(mn.X, mn.Y, 1.8, 0, Math.PI * 2);
          c.fillStyle = 'rgba(245, 158, 11, 0.72)';
          c.fill();
        }
      }

      const vertexRadius = this.dim >= 9 ? 2.0 : this.dim >= 6 ? 2.8 : 4.2;
      for (const p of projected) {
        if (!p) continue;
        const prox = Math.max(0.35, Math.min(1, 10 / Math.max(2.5, p.depth)));
        if (!dense && prox > 0.65) {
          c.beginPath();
          c.arc(p.X, p.Y, vertexRadius + 2.4, 0, Math.PI * 2);
          c.fillStyle = 'rgba(108, 140, 255, 0.22)';
          c.fill();
        }
        c.beginPath();
        c.arc(p.X, p.Y, vertexRadius * (0.75 + 0.35 * prox), 0, Math.PI * 2);
        c.fillStyle = theme.text || '#eceff5';
        c.fill();
      }

      this.drawDimensionBadge(vertices.length, edges.length, mechEdgeCount, theme);
    }
  }

  PolytopeND.AXIS_NAMES = AXIS_NAMES;
  PolytopeND.VAR_NAMES = VAR_NAMES;
  PolytopeND.listRotationPlanes = listRotationPlanes;
  PolytopeND.compileNDFormula = compileNDFormula;
  PolytopeND.buildEdgeMech = buildEdgeMech;
  global.PolytopeND = PolytopeND;
})(window);