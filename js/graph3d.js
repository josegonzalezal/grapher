/**
 * graph3d.js - zero-dependency 3D surface, revolution and curve renderer on HTML5 Canvas.
 * Includes orbital camera controls, screen-space pan around a movable target,
 * depth sorting with directional shading, and live performance telemetry.
 * Exposes the global `Graph3D` class.
 */
(function (global) {
  'use strict';

  const QUALITY_LEVELS = {
    low: { label: 'Low (32×32)', steps: 32 },
    medium: { label: 'Medium (56×56)', steps: 56 },
    high: { label: 'High (88×88)', steps: 88 },
    ultra: { label: 'Ultra (136×136)', steps: 136 },
  };

  function hexToRgb(hex) {
    const clean = String(hex || '#2b45d4').replace('#', '');
    if (clean.length !== 6) return [43, 69, 212];
    const n = parseInt(clean, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  class Graph3D {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.w = 0;
      this.h = 0;
      this.dpr = 1;
      this.camera = {
        yaw: -0.68,
        pitch: 0.42,
        distance: 8.5,
        range: 3.5,
        target: { x: 0, y: 0, z: 0 },
      };
      this.quality = 'medium';
      this.revolveMode = false;
      this.metrics = {
        fps: 60,
        frameMs: 0,
        meshMs: 0,
        triangles: 0,
        rating: 'Smooth',
      };
      this._frameSamples = [];
      this._lastTick = performance.now();
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

    home() {
      this.camera = {
        yaw: -0.68,
        pitch: 0.42,
        distance: 8.5,
        range: 3.5,
        target: { x: 0, y: 0, z: 0 },
      };
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

      const rightX = cy;
      const rightY = -sy;

      const upX = -sy * sp;
      const upY = -cy * sp;
      const upZ = cp;

      const mx = -dx / scale;
      const my = dy / scale;

      target.x += rightX * mx + upX * my;
      target.y += rightY * mx + upY * my;
      target.z += upZ * my;
    }

    zoom(factor) {
      this.camera.distance = Math.max(1.2, Math.min(80, this.camera.distance / factor));
      this.camera.range = Math.max(1.5, Math.min(30, this.camera.distance / 2.4));
    }

    project(x, y, z) {
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
      if (depth <= 0.15) return null;

      const focal = Math.min(this.w, this.h) * 1.15;
      const scale = focal / depth;
      return {
        X: this.w / 2 + cx * scale,
        Y: this.h / 2 - cz * scale,
        depth,
      };
    }

    drawAxesAndGrid(theme, op) {
      const c = this.ctx;
      const R = Math.ceil(this.camera.range);
      const step = R > 12 ? 2 : 1;
      const ox = Math.round(this.camera.target.x / step) * step;
      const oy = Math.round(this.camera.target.y / step) * step;

      if (op.grid) {
        c.strokeStyle = theme.gridFine || 'rgba(148, 163, 184, 0.24)';
        c.lineWidth = 1;
        c.beginPath();
        for (let i = -R; i <= R; i += step) {
          const gx = ox + i;
          const a1 = this.project(gx, oy - R, 0), b1 = this.project(gx, oy + R, 0);
          if (a1 && b1) { c.moveTo(a1.X, a1.Y); c.lineTo(b1.X, b1.Y); }

          const gy = oy + i;
          const a2 = this.project(ox - R, gy, 0), b2 = this.project(ox + R, gy, 0);
          if (a2 && b2) { c.moveTo(a2.X, a2.Y); c.lineTo(b2.X, b2.Y); }
        }
        c.stroke();
      }

      if (!op.axes) return;
      const span = Math.max(R, Math.hypot(this.camera.target.x, this.camera.target.y, this.camera.target.z) + R);
      const axes = [
        { from: [-span, 0, 0], to: [span, 0, 0], label: 'x', color: '#f43f5e' },
        { from: [0, -span, 0], to: [0, span, 0], label: 'y', color: '#10b981' },
        { from: [0, 0, -span], to: [0, 0, span], label: 'z', color: '#60a5fa' },
      ];
      c.font = '700 14px system-ui, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (const ax of axes) {
        const p0 = this.project(...ax.from);
        const p1 = this.project(...ax.to);
        if (!p0 || !p1) continue;
        c.strokeStyle = ax.color;
        c.lineWidth = 2.2;
        c.beginPath();
        c.moveTo(p0.X, p0.Y);
        c.lineTo(p1.X, p1.Y);
        c.stroke();
        c.fillStyle = ax.color;
        c.fillText(ax.label, p1.X + 10, p1.Y - 8);
      }
    }

    buildScene(objects, fast) {
      const cfg = QUALITY_LEVELS[this.quality] || QUALITY_LEVELS.medium;
      const steps = fast ? Math.max(20, Math.floor(cfg.steps * 0.55)) : cfg.steps;
      const R = this.camera.range;
      const tx = this.camera.target.x;
      const ty = this.camera.target.y;
      const zClamp = R * 1.65;
      const quads = [];
      const polylines = [];
      const points = [];

      const pushSurfaceQuads = (grid, nx, ny, baseColor, alpha = 0.9) => {
        const [r, g, b] = hexToRgb(baseColor);
        const lx = 0.45, ly = -0.55, lz = 0.7;
        for (let i = 0; i < nx; i++) {
          for (let j = 0; j < ny; j++) {
            const p00 = grid[i][j], p10 = grid[i + 1][j];
            const p11 = grid[i + 1][j + 1], p01 = grid[i][j + 1];
            if (!p00 || !p10 || !p11 || !p01) continue;
            const s00 = this.project(p00[0], p00[1], p00[2]);
            const s10 = this.project(p10[0], p10[1], p10[2]);
            const s11 = this.project(p11[0], p11[1], p11[2]);
            const s01 = this.project(p01[0], p01[1], p01[2]);
            if (!s00 || !s10 || !s11 || !s01) continue;

            const ux = p11[0] - p00[0], uy = p11[1] - p00[1], uz = p11[2] - p00[2];
            const vx = p01[0] - p10[0], vy = p01[1] - p10[1], vz = p01[2] - p10[2];
            let nxv = uy * vz - uz * vy;
            let nyv = uz * vx - ux * vz;
            let nzv = ux * vy - uy * vx;
            const len = Math.hypot(nxv, nyv, nzv) || 1;
            nxv /= len; nyv /= len; nzv /= len;

            const light = Math.abs(nxv * lx + nyv * ly + nzv * lz);
            const heightBoost = Math.max(-0.14, Math.min(0.18, ((p00[2] + p11[2]) * 0.5) / (zClamp * 2)));
            const shade = Math.max(0.45, Math.min(1.25, 0.55 + 0.62 * light + heightBoost));
            const cr = Math.min(255, Math.round(r * shade));
            const cg = Math.min(255, Math.round(g * shade));
            const cb = Math.min(255, Math.round(b * shade));

            quads.push({
              pts: [s00, s10, s11, s01],
              depth: (s00.depth + s10.depth + s11.depth + s01.depth) * 0.25,
              fill: `rgba(${cr},${cg},${cb},${alpha})`,
              stroke: `rgba(${Math.min(255, cr + 35)},${Math.min(255, cg + 35)},${Math.min(255, cb + 35)},0.35)`,
            });
          }
        }
      };

      for (const item of objects) {
        const { o, style } = item;
        if (o.type === 'surface3d') {
          const grid = Array.from({ length: steps + 1 }, () => new Array(steps + 1).fill(null));
          for (let i = 0; i <= steps; i++) {
            const x = tx - R + (2 * R * i) / steps;
            for (let j = 0; j <= steps; j++) {
              const y = ty - R + (2 * R * j) / steps;
              const z = o.f(x, y);
              if (Number.isFinite(z) && Math.abs(z) <= zClamp * 2.5) {
                grid[i][j] = [x, y, Math.max(-zClamp, Math.min(zClamp, z))];
              }
            }
          }
          pushSurfaceQuads(grid, steps, steps, style.color, 0.9);
        } else if (o.type === 'explicit') {
          if (this.revolveMode) {
            const segU = steps;
            const segV = Math.max(20, Math.round(steps * 0.65));
            const grid = Array.from({ length: segU + 1 }, () => new Array(segV + 1).fill(null));
            for (let i = 0; i <= segU; i++) {
              const x = tx - R + (2 * R * i) / segU;
              const rad = Math.abs(o.f(x));
              if (!Number.isFinite(rad) || rad > zClamp * 2) continue;
              const clampedR = Math.min(zClamp, rad);
              for (let j = 0; j <= segV; j++) {
                const phi = (2 * Math.PI * j) / segV;
                grid[i][j] = [x, clampedR * Math.cos(phi), clampedR * Math.sin(phi)];
              }
            }
            pushSurfaceQuads(grid, segU, segV, style.color, 0.88);
          } else {
            const grid = Array.from({ length: steps + 1 }, () => new Array(steps + 1).fill(null));
            for (let i = 0; i <= steps; i++) {
              const x = tx - R + (2 * R * i) / steps;
              const baseVal = o.f(x);
              if (!Number.isFinite(baseVal) || Math.abs(baseVal) > zClamp * 2.5) continue;
              for (let j = 0; j <= steps; j++) {
                const y = ty - R + (2 * R * j) / steps;
                const z = Math.max(-zClamp, Math.min(zClamp, baseVal));
                grid[i][j] = [x, y, z];
              }
            }
            pushSurfaceQuads(grid, steps, steps, style.color, 0.85);
          }
        } else if (o.type === 'polar') {
          const [a, b] = item.range;
          const n = Math.min(1800, Math.max(240, steps * 8));
          const seg = [];
          for (let i = 0; i <= n; i++) {
            const t = a + ((b - a) * i) / n;
            const r = o.f(t);
            if (!Number.isFinite(r) || Math.abs(r) > zClamp * 2) continue;
            const p = this.project(r * Math.cos(t), r * Math.sin(t), Math.sin(t * 2) * (r * 0.25));
            if (p) seg.push(p);
          }
          if (seg.length > 1) polylines.push({ pts: seg, style });
        } else if (o.type === 'parametric3d' || o.type === 'parametric') {
          const [a, b] = item.range;
          const n = Math.min(2000, Math.max(260, steps * 9));
          const seg = [];
          for (let i = 0; i <= n; i++) {
            const t = a + ((b - a) * i) / n;
            const raw = o.f(t);
            const x = raw[0], y = raw[1], z = o.type === 'parametric3d' ? raw[2] : Math.sin(t) * 1.5;
            if (![x, y, z].every(Number.isFinite)) continue;
            const p = this.project(x, y, z);
            if (p) seg.push(p);
          }
          if (seg.length > 1) polylines.push({ pts: seg, style });
        } else if (o.type === 'implicit' || o.type === 'inequality') {
          const grid = Array.from({ length: steps + 1 }, () => new Array(steps + 1).fill(null));
          for (let i = 0; i <= steps; i++) {
            const x = tx - R + (2 * R * i) / steps;
            for (let j = 0; j <= steps; j++) {
              const y = ty - R + (2 * R * j) / steps;
              const val = o.F(x, y, 0);
              if (!Number.isFinite(val)) continue;
              if (o.type === 'inequality') {
                if (o.inside(x, y, 0)) {
                  grid[i][j] = [x, y, Math.max(-zClamp, Math.min(zClamp, -val * 0.2))];
                }
              } else {
                grid[i][j] = [x, y, Math.max(-zClamp, Math.min(zClamp, val * 0.25))];
              }
            }
          }
          pushSurfaceQuads(grid, steps, steps, style.color, 0.82);
        } else if (o.type === 'point3d' || o.type === 'point') {
          const raw = o.f();
          const p = this.project(raw[0], raw[1], o.type === 'point3d' ? raw[2] : 0);
          if (p) points.push({ ...p, style });
        }
      }

      quads.sort((a, b) => b.depth - a.depth);
      return { quads, polylines, points };
    }

    draw(objects, theme, op = {}) {
      if (!this.w || !this.h) this.resize();
      const t0 = performance.now();
      const c = this.ctx;
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      c.fillStyle = theme.bg || '#111318';
      c.fillRect(0, 0, this.w, this.h);

      this.drawAxesAndGrid(theme, op);

      const m0 = performance.now();
      const scene = this.buildScene(objects, Boolean(op.fast));
      const meshMs = performance.now() - m0;

      c.lineWidth = 0.75;
      for (const q of scene.quads) {
        c.beginPath();
        c.moveTo(q.pts[0].X, q.pts[0].Y);
        c.lineTo(q.pts[1].X, q.pts[1].Y);
        c.lineTo(q.pts[2].X, q.pts[2].Y);
        c.lineTo(q.pts[3].X, q.pts[3].Y);
        c.closePath();
        c.fillStyle = q.fill;
        c.fill();
        if (scene.quads.length <= 5000) {
          c.strokeStyle = q.stroke;
          c.stroke();
        }
      }

      for (const line of scene.polylines) {
        c.save();
        c.strokeStyle = line.style.color;
        c.lineWidth = line.style.thickness;
        c.lineJoin = 'round';
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(line.pts[0].X, line.pts[0].Y);
        for (let i = 1; i < line.pts.length; i++) c.lineTo(line.pts[i].X, line.pts[i].Y);
        c.stroke();
        c.restore();
      }

      for (const pt of scene.points) {
        c.beginPath();
        c.arc(pt.X, pt.Y, 3 + pt.style.thickness, 0, 2 * Math.PI);
        c.fillStyle = pt.style.color;
        c.fill();
        c.lineWidth = 2;
        c.strokeStyle = theme.bg || '#111318';
        c.stroke();
      }

      const now = performance.now();
      const frameMs = now - t0;
      const dt = Math.max(1, now - this._lastTick);
      this._lastTick = now;
      this._frameSamples.push(1000 / dt);
      if (this._frameSamples.length > 24) this._frameSamples.shift();
      const avgFps = Math.round(this._frameSamples.reduce((a, b) => a + b, 0) / this._frameSamples.length);

      let rating = 'Smooth';
      if (frameMs > 34 || avgFps < 28) rating = 'Heavy';
      else if (frameMs > 18 || avgFps < 48) rating = 'Moderate';

      this.metrics = {
        fps: Math.min(240, avgFps),
        frameMs: Number(frameMs.toFixed(1)),
        meshMs: Number(meshMs.toFixed(1)),
        triangles: scene.quads.length * 2,
        rating,
      };
    }
  }

  Graph3D.QUALITY_LEVELS = QUALITY_LEVELS;
  global.Graph3D = Graph3D;
})(window);