# Changelog

All notable changes to WebTiled are documented here.
Format: version-based sections, patches grouped by feature area.

---

## [0.6.6] — TNS Edges Fix

### Fixed
- **`generator.js` → `resolveEdge`**: removed the erroneous `selfId !== 0` check. Replaced with `selfType === T` — an edge is no longer drawn over a cell that is already occupied by a solid of the same type. Fixes missing edges on fully-tiled maps.

---

## [0.6.5] — Wall Creator (Void)

### Added
- **`app_paint.js` → `endStroke`**: detects the `void` property on a solid tile. If present, changes to the `Ground` layer are rolled back, while changes to the `Items` layer (walls) are kept.

---

## [0.6.0] — Beta 0.6

### UTILS & Map Mirror

#### Added
- **`app_tools.js`** (`TOOLS`, `handleToolClick`): new tools `GUIDE` and `UTILS`.
- **`app_paint.js` → `App.mirrorArea`**: first version of mirror-by-selection.
- **`app_paint.js` → `App.mirrorMap`**: selection-based mirror replaced with hard map halves — modes `h`, `h_inv`, `v`, `v_inv`, `quad`.
- Solid randomization on copy via **`App.pickWeightedSolid`**.
- Classic Autotile and TNS recalculation after mirroring.

#### Changed
- **`app_ui.js` / `webtiled.html`**: `Resize` and `Ref` buttons moved from the topbar into the **UTILS** modal.

---

### GUIDES

#### Added
- **`app.js`** (`App.helpers`, `App.guideDrawStart`): state for helper lines.
- **`render.js` → `_doRender`**: base rendering of lines, rectangles, circles and coordinate labels.
- **`app_input.js`** (`pointerdown` / `move` / `up`): shape creation logic.
- **`app_paint.js` → `App.addGuideWithSymmetry`**: mirror copies along H, V, D, AD axes.
- **`render.js`** (`drawShape`, `drawHandle`): black outline and node markers for the selected shape.
- **`app_input.js`** (`pointerdown` / `move`): node dragging (corners / endpoints).
- **`app_paint.js` → `App.addGuideWithSymmetry`**: coordinate clamp to prevent shapes leaving the map on diagonals.
- **`app_input.js`** (`keydown`): `Delete` removes the selected guide.
- **`app_ui.js` / `webtiled.html`**: mini property editor (X, Y, W, H, Color) for the selected guide.

---

### UI Overhaul

#### Added
- **`app.js`** (proxy over `App.statusEl`): logs intercepted and rendered in the **bottom-right corner** above the canvas.
- **`webtiled.html` / `style.css`**: version badge (`v0.6(149)`) and log console (`#logConsole`).

#### Changed
- **`ui.js` → `TilesetTabs.build`**: horizontal tabs replaced with `< >` arrows + dropdown.
- **`ui.js` / `types.js`**: dropdowns for TNS types and tilesets; tileset delete button moved into the block header.

#### Removed
- Dead code — old card CSS classes.

---

### Bottom Tabs Controller

#### Added
- **`app_ui.js` → `App.updateBottomTabs`**: single controller for bottom tabs (ATLASES, TYPES, GEN, 3D). Independent on desktop, radio-mode (one open) on mobile.

#### Removed
- **`hm_app.js`**: duplicate `bindTabs` handler.

---

### TNS Edge Layer & MiniTNS 5th Parameter

#### Added
- **`types.js`** (`TypesModel.add`, `toJSON`, `fromJSON`, `buildDetail`): new `edgeLayer` property and UI selector for it.
- **`minitns_lib.js` → `parseIni`**: parser reads the 5th parameter (`large-rock`, `cliff-soft`, `large-cliff`).
- **`app_files.js` → `importMiniTNS`**: when the 5th parameter is present, applies the property to edge tiles and sets `edgeLayer = 'Items'`.

#### Changed
- **`generator.js`** (`generateRect`, `resolveEdge`): generator routes edges into the layer specified by `edgeLayer` (e.g. `Items`) and returns an array with layer info.
- **`app_paint.js` / `hm_apply.js`**: `generateRect` calls updated to the new format (group-by-layer for Undo).

---

### Fixes

- **`mirrorMap`** — protection against corrupting `Items0`.
- **`HM.commitToUndo`** — multi-layer support.
- **Classic merge** — keeps the earliest `before` snapshot.
- **`resolveEdge`** — optimization, `best` passed through.
