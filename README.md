# Grapher

Open `index.html` in any modern browser to start graphing. No internet connection, build step, or server required. Uses no external libraries or AI services.

## Features & Behavior

- **2D, 3D, and N-Dimensional (3D–11D) Graphing:** Plot 2D functions/expressions, 3D surfaces, and higher-dimensional polytopes (hypercube, orthoplex, simplex) with multi-plane rotations, formula modulation, and optional edge-bridging structural meshes.
- **Persistence:** The last state (formulas, parameters, view, colors, settings, theme) is saved automatically in `localStorage` and restored on reload.
- **Theme:** Follows the system light/dark setting live; toggling the theme button overrides it and remembers your choice.
- **Project & Export Tools:** Import/export `.json` project files, clear the workspace, or import/export SVG, LaTeX, and MathML.

## Project Structure

- `index.html` — page structure and UI controls
- `css/styles.css` — design tokens, light/dark mode, and responsive layout
- `js/formulas.js` — safe expression parser and evaluator (no `eval`)
- `js/graph.js` — 2D canvas rendering and interaction
- `js/graph3d.js` — 3D canvas rendering and camera controls
- `js/polytope.js` — 3D–11D polytope generation, rotations, projections, and canvas rendering
- `js/app.js` — application state, UI bindings, sliders, and persistence

## Customization & Help

- Colors and theme tokens can be customized in `css/styles.css` and `PALETTE` in `js/app.js`.
- Syntax and shortcut help is available via the `?` button in the app.

## Browser Support

Any current version of Chrome, Edge, Firefox, or Safari (requires `<dialog>`, `localStorage`, and HTML5 `<canvas>`). If `localStorage` is restricted for local files, the app still runs without persisting state across reloads.

## Code Conventions

- JavaScript: strict mode, `const`/`let`, no `eval`.
- CSS: one declaration per line, custom properties for theming, sections separated by comments.
- All visible UI text is in English.
