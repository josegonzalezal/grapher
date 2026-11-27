# Grapher

Unzip the folder and double-click `index.html` to open it in any modern browser. No internet connection, installation, or server required. Uses no external libraries or AI services.

## Behavior

- The graph starts empty (blank formula line, no curves). Use "Load example…" or type a formula to begin.
- The last state (formulas, parameters, view, colors, settings, theme) is saved automatically in the browser's `localStorage` and restored on reload.
- The theme follows the system light/dark setting live. Pressing the theme button overrides it and that choice is remembered.
- "Clear all" (under "Save and open") returns to the empty start; "Save project" / "Open project" exports and imports a `.json` file.

## Project Structure

- `index.html` — page structure
- `css/styles.css` — colors, light/dark mode, and responsive layout
- `js/formulas.js` — expression parser (no `eval`)
- `js/graph.js` — canvas rendering
- `js/app.js` — interface, sliders, saving

## Customization & Help

- Colors can be customized in the first lines of `css/styles.css` and in `PALETTE` (`js/app.js`).
- Syntax help is available via the `?` button in the app.

## Browser support

Any current version of Chrome, Edge, Firefox or Safari (needs `<dialog>`, `localStorage` and canvas). If your browser blocks `localStorage` for local files, the app still works but will not remember the last state.

## Code conventions

- JavaScript: strict mode, `const`/`let`, JSDoc comments on functions, no `eval`.
- CSS: one declaration per line, design tokens as custom properties, sections marked with comments.
- All visible text is in English.
