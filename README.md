# Grapher

A zero-dependency math grapher that runs in the browser. Open `index.html` in any modern browser to start graphing—no internet connection, build step, server, external libraries, or AI services required.

Live demo: <https://josegonzalezal.github.io/grapher/>

## Features

- **2D graphing:** explicit functions (`y = sin(x)`), polar curves, parametric curves, implicit equations, inequalities, points, curve tracing/slope readouts, and piecewise domains (`y = 1 / x {x >= 1}`).
- **3D graphing:** surfaces (`z = sin(x) cos(y)`), 3D parametric curves, solids of revolution, four mesh-quality levels, live performance telemetry, and a 3-second orbit benchmark.
- **N-dimensional polytopes (3D–11D):** hypercube, orthoplex, and simplex with per-plane rotation sliders, optional auto-spin, custom `w = ...` formula modulation, and structural edge meshes (`truss`, `lattice`, `ribs`).
- **Parameters & animation:** any unused identifier becomes an interactive slider with editable bounds and play/pause animation.
- **Save, export & persistence:** download/load `.json` project files, export a `.png` snapshot, and automatically restore workspace state from `localStorage`.
- **Theme & touch support:** follows system light/dark mode live until toggled manually; supports pointer/touch pan, orbit, and pinch-to-zoom.

## Project Structure

- `index.html` — page layout, controls, and help modal
- `css/styles.css` — theme tokens, light/dark styles, and responsive rules
- `js/formulas.js` — recursive-descent expression parser and evaluator (no `eval` or `new Function`)
- `js/graph.js` — 2D renderer, grid/axes, contour/region plotting, and trace
- `js/graph3d.js` — 3D surface/revolution/curve renderer, camera, and performance metrics
- `js/polytope.js` — 3D–11D polytope generation, rotations, projections, and edge meshes
- `js/app.js` — UI state, sliders, examples, mode switching, project I/O, and persistence
- `tests/formulas.test.js` — parser and evaluator unit tests

## Safety

Expressions are parsed into an AST and evaluated without `eval` or `new Function`. Imported `.json` projects and `localStorage` data are validated, type-checked, and clamped before use.

## Tests

Run the parser test suite with Node.js:

```bash
node tests/formulas.test.js
```

## Customization & Help

- Adjust theme colors in `css/styles.css` and default line colors in `PALETTE` inside `js/app.js`.
- Open **Guide** in the top bar for syntax examples, navigation tips, and keyboard shortcuts (`Enter`, `Backspace` on empty line, `Ctrl`+`↑`/`↓`, `Esc`).

## Browser Support

Any modern version of Chrome, Edge, Firefox, or Safari supporting HTML5 `<canvas>`, pointer events, `localStorage`, and `CanvasRenderingContext2D.roundRect`. If `localStorage` is blocked on `file://` URLs, graphing still works without persisting state across reloads.

## Code Conventions

- JavaScript: `'use strict'`, `const`/`let`, no `eval`.
- CSS: one declaration per line, custom properties for theming, comment-delimited sections.
- All visible UI text is in English.

## License

MIT — see `LICENSE`.
