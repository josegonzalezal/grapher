# Grapher

A zero-dependency math grapher that runs entirely in the browser. Open `index.html` in any modern browser to start graphing. No internet connection, build step, or server is required, and no external libraries or AI services are used.

Live demo: <https://josegonzalezal.github.io/grapher/>

## Features

- **2D graphing:** explicit functions (`y = sin(x)`), polar curves, parametric curves, implicit equations, inequalities, points and piecewise domains such as `y = 1 / x {x >= 1}`.
- **3D graphing:** surfaces (`z = sin(x) cos(y)`), 3D parametric curves, solids of revolution and four mesh-quality levels with a live performance readout and a benchmark.
- **N-dimensional polytopes (3D–11D):** hypercube, orthoplex and simplex with multi-plane rotations, formula modulation and optional edge-bridging structural meshes (truss, lattice, ribs).
- **Sliders and animation:** any unused letter becomes a parameter with its own slider, range and play button.
- **Trace and analysis:** hover or click a curve to read coordinates and slope.
- **Projects:** `Save` downloads the current workspace as a `.json` file and `Open` loads one back. `PNG` exports the current view as an image.
- **Persistence:** the last state (formulas, parameters, view, colors, settings) is stored in `localStorage` and restored on reload.
- **Theme:** follows the system light/dark setting live until you press the theme button, which then remembers your choice.
- **Touch support:** pan, orbit and pinch-to-zoom work on touch screens.

## Project Structure

- `index.html` — page structure and UI controls
- `css/styles.css` — design tokens, light/dark mode, and responsive layout
- `js/formulas.js` — safe expression parser and evaluator (no `eval`, no `new Function`)
- `js/graph.js` — 2D canvas rendering and interaction
- `js/graph3d.js` — 3D canvas rendering and camera controls
- `js/polytope.js` — 3D–11D polytope generation, rotations, projections, and canvas rendering
- `js/app.js` — application state, UI bindings, sliders, project files, and persistence
- `tests/formulas.test.js` — parser tests

## Safety

Formulas are never executed as JavaScript. Every expression, including the ND formula box, goes through the recursive-descent parser in `js/formulas.js`. Project files and saved state are validated and clamped before use, so opening a `.json` file from someone else cannot run code.

## Tests

The parser tests need only Node.js:

```
node tests/formulas.test.js
```

## Customization & Help

- Colors and theme tokens can be customized in `css/styles.css` and `PALETTE` in `js/app.js`.
- Syntax and shortcut help is available via the **Guide** button in the app.

## Browser Support

Any current version of Chrome, Edge, Firefox, or Safari (requires HTML5 `<canvas>`, pointer events, `localStorage` and `CanvasRenderingContext2D.roundRect`, i.e. Chrome 99, Firefox 112 or Safari 16 and newer). If `localStorage` is restricted for local files, the app still runs without persisting state across reloads.

## Code Conventions

- JavaScript: strict mode, `const`/`let`, no `eval`.
- CSS: one declaration per line, custom properties for theming, sections separated by comments.
- All visible UI text is in English.

## License

MIT, see `LICENSE`.
