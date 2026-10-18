(function(RW){
'use strict';
const App = RW.App;

// ═══════════════════════════════════════════════
// TOUCH / POINTER
// ═══════════════════════════════════════════════
App.cancelLongTap = function() {
  if (App.longTapTimer) { clearTimeout(App.longTapTimer); App.longTapTimer = null; }
};

App.startLongTapTimer = function() {
  App.cancelLongTap();
  App.longTapFired = false;
  if (!App.LONG_TAP_TOOLS.has(App.activeTool)) return;
  App.longTapTimer = setTimeout(() => {
    App.longTapTimer = null;
    App.longTapFired = true;
    App.triggerLongTap();
  }, 500);
};

App.triggerLongTap = function() {
  if (!App.renderer || !App.mapModel || !App.activeLayer) return;
  const pos = App.renderer.screenToTile(App.longTapStart.x, App.longTapStart.y);
  const tx = pos.tx, ty = pos.ty;
  if (tx < 0 || ty < 0 || tx >= App.mapModel.W || ty >= App.mapModel.H) return;
  App.strokeChanges = null;
  App.paintBrushCells(tx, ty, () => 0);
  App.endStroke();
  App.painting = false;
  App.rectStart = null; App.rectCurrent = null;
  App.renderer.rectStart = null; App.renderer.rectCurrent = null;
  App.renderer.render();
  if (App.statusEl) App.statusEl.textContent = 'Long-tap erase @ ' + tx + ',' + ty;
};

App.beginMultiTouch = function() {
  if (App.painting) {
    App.painting = false;
    if (App.activeTool === 'terrain') App.finalizeAutotileForStroke();
    if (App.activeTool === 'classic') App.finalizeClassicForStroke();
    App.endStroke();
    App.renderer.rectStart = null; App.renderer.rectCurrent = null;
    App.renderer.render();
  }
  App.drag.active = false;
  if (App.cv) App.cv.classList.remove('drag');
  App.cancelLongTap();

  const arr = Array.from(App.pointers.values());
  if (arr.length >= 2) {
    App.lastPinchDist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    App.lastPinchMidX = (arr[0].x + arr[1].x) / 2;
    App.lastPinchMidY = (arr[0].y + arr[1].y) / 2;
  }
  App.multiPointerActive = true;
};

if (App.cv) App.cv.addEventListener('pointerdown', (e) => {
  if (!App.renderer) return;
  if (e.pointerType === 'touch') e.preventDefault();
  if (e.button === 2) return;

  const isTouch = e.pointerType === 'touch';
  const isMiddle = e.button === 1;
  App.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, isTouch });
  try { App.cv.setPointerCapture(e.pointerId); } catch (_) {}

  if (App.pointers.size >= 2) { App.beginMultiTouch(); return; }

  if (App.activeTool === 'pan' || isMiddle) {
    App.drag.active = true;
    App.drag.x = e.clientX; App.drag.y = e.clientY;
    if (!isTouch) App.cv.classList.add('drag');
    return;
  }

  if (!App.mapModel) return;
  if (!App.activeLayer) { if (App.statusEl) App.statusEl.textContent = 'Select active layer'; return; }

  App.drawingPointerId = e.pointerId;

  const pos = App.renderer.screenToTile(e.clientX, e.clientY);
  const tx = pos.tx, ty = pos.ty;

  App.longTapStart.x = e.clientX;
  App.longTapStart.y = e.clientY;
  App.startLongTapTimer();

  if (App.activeTool === 'brush') {
    if (!App.brushGroup.length) { if (App.statusEl) App.statusEl.textContent = 'Brush empty'; return; }
    App.painting = true; App.strokeChanges = null;
    App.paintBrushCells(tx, ty, App.pickWeightedTile);
    App.lastPaintKey = tx + ',' + ty;
    App.renderer.render();
  } else if (App.activeTool === 'terrain') {
    App.painting = true; App.strokeChanges = null;
    App.paintTerrainCells(tx, ty);
    App.lastPaintKey = tx + ',' + ty;
    App.renderer.render();
  } else if (App.activeTool === 'classic') {
    if (!App.resolveClassicAnchor()) {
      if (App.statusEl) App.statusEl.textContent = 'Classic: выбери terrain в BRUSH панели';
      return;
    }
    App.painting = true; App.strokeChanges = null;
    App.paintClassicCells(tx, ty);
    App.lastPaintKey = tx + ',' + ty;
    App.renderer.render();
  } else if (App.activeTool === 'eraser') {
    App.painting = true; App.strokeChanges = null;
    App.paintBrushCells(tx, ty, () => 0);
    App.lastPaintKey = tx + ',' + ty;
    App.renderer.render();
  } else if (App.activeTool === 'rect') {
    App.painting = true;
    App.rectStart = { x: tx, y: ty }; App.rectCurrent = { x: tx, y: ty };
    App.renderer.rectStart = App.rectStart; App.renderer.rectCurrent = App.rectCurrent;
    App.renderer.render();
  } else if (App.activeTool === 'fill') {
    if (!App.brushGroup.length) { if (App.statusEl) App.statusEl.textContent = 'Brush empty'; return; }
    App.floodFill(tx, ty, App.pickWeightedTile());
    App.renderer.render();
    App.cancelLongTap();
  } else if (App.activeTool === 'picker') {
    App.pickerAt(tx, ty);
    App.renderer.render();
    App.cancelLongTap();
  }
});

if (App.cv) App.cv.addEventListener('pointermove', (e) => {
  if (!App.renderer) return;

  if (!App.pointers.has(e.pointerId)) {
    if (e.pointerType === 'mouse' && App.mapModel) {
      const pos = App.renderer.screenToTile(e.clientX, e.clientY);
      App.renderer.hoverTile = { tx: pos.tx, ty: pos.ty };
      App.renderer.render();
      App.updateInfo(pos.tx, pos.ty);
    }
    return;
  }

  const prev = App.pointers.get(e.pointerId);
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  prev.x = e.clientX;
  prev.y = e.clientY;

  if (App.longTapTimer && (Math.abs(e.clientX - App.longTapStart.x) > 6 ||
                       Math.abs(e.clientY - App.longTapStart.y) > 6)) {
    App.cancelLongTap();
  }

  if (App.pointers.size >= 2) {
    const arr = Array.from(App.pointers.values());
    const d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    const mx = (arr[0].x + arr[1].x) / 2;
    const my = (arr[0].y + arr[1].y) / 2;

    App.renderer.view.x += (mx - App.lastPinchMidX);
    App.renderer.view.y += (my - App.lastPinchMidY);

    if (App.lastPinchDist > 8 && d > 8) {
      const k = d / App.lastPinchDist;
      if (Math.abs(k - 1) > 0.002) {
        const r = App.wrap.getBoundingClientRect();
        App.renderer.zoomAt(mx - r.left, my - r.top, k);
      }
    }

    App.lastPinchDist = d;
    App.lastPinchMidX = mx;
    App.lastPinchMidY = my;
    App.renderer.render();
    App.updateZoomLabels();
    return;
  }

  if (App.drag.active) {
    App.renderer.view.x += dx;
    App.renderer.view.y += dy;
    App.renderer.render();
    return;
  }

  if (App.painting) {
    const pos = App.renderer.screenToTile(e.clientX, e.clientY);
    App.renderer.hoverTile = { tx: pos.tx, ty: pos.ty };
    const key = pos.tx + ',' + pos.ty;
    if (key !== App.lastPaintKey) {
      App.lastPaintKey = key;
      if (App.activeTool === 'brush' || App.activeTool === 'eraser') {
        const fn = App.activeTool === 'eraser' ? () => 0 : App.pickWeightedTile;
        App.paintBrushCells(pos.tx, pos.ty, fn);
      } else if (App.activeTool === 'terrain') {
        App.paintTerrainCells(pos.tx, pos.ty);
      } else if (App.activeTool === 'classic') {
        App.paintClassicCells(pos.tx, pos.ty);
      } else if (App.activeTool === 'rect' && App.rectStart) {
        App.rectCurrent = { x: pos.tx, y: pos.ty };
        App.renderer.rectCurrent = App.rectCurrent;
      }
    }
    App.renderer.render();
    App.updateInfo(pos.tx, pos.ty);
  }
});

if (App.cv) App.cv.addEventListener('pointerup', (e) => {
  if (!App.renderer) return;
  const wasDrawing = (App.drawingPointerId === e.pointerId);
  App.pointers.delete(e.pointerId);
  App.cancelLongTap();

  if (App.longTapFired) {
    App.longTapFired = false;
    if (App.pointers.size === 0) {
      App.multiPointerActive = false;
      App.drag.active = false;
      App.drawingPointerId = null;
    }
    return;
  }

  if (App.pointers.size === 0) {
    App.multiPointerActive = false;

    if (App.drag.active) {
      App.drag.active = false;
      if (App.cv) App.cv.classList.remove('drag');
    }

    if (App.painting) {
      if (App.activeTool === 'rect' && App.rectStart && App.rectCurrent && App.brushGroup.length) {
        App.applyRect(App.rectStart.x, App.rectStart.y, App.rectCurrent.x, App.rectCurrent.y, App.pickWeightedTile);
      } else {
        if (App.activeTool === 'terrain') App.finalizeAutotileForStroke();
        if (App.activeTool === 'classic') App.finalizeClassicForStroke();
        App.endStroke();
      }
      App.painting = false;
      App.rectStart = null; App.rectCurrent = null;
      App.renderer.rectStart = null; App.renderer.rectCurrent = null;
      App.renderer.render();
    }
    App.drawingPointerId = null;
  } else if (App.pointers.size === 1 && App.multiPointerActive) {
    const rem = Array.from(App.pointers.values())[0];
    App.drag.active = true;
    App.drag.x = rem.x;
    App.drag.y = rem.y;
  }
});

if (App.cv) App.cv.addEventListener('pointercancel', (e) => {
  App.pointers.delete(e.pointerId);
  App.cancelLongTap();
  if (App.pointers.size === 0) {
    if (App.painting) { App.painting = false; App.endStroke(); }
    App.drag.active = false;
    App.multiPointerActive = false;
    App.drawingPointerId = null;
    if (App.renderer) App.renderer.render();
  }
});

if (App.cv) App.cv.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse' && !App.pointers.has(e.pointerId)) {
    if (App.renderer) {
      App.renderer.hoverTile = null;
      App.renderer.render();
    }
  }
});

if (App.cv) App.cv.addEventListener('contextmenu', (e) => e.preventDefault());

App.updateInfo = function(tx, ty) {
  if (!App.infoEl) return;
  if (!App.mapModel) { App.infoEl.textContent = '—'; return; }
  if (tx < 0 || ty < 0 || tx >= App.mapModel.W || ty >= App.mapModel.H) { App.infoEl.textContent = '—'; return; }
  let out = 'Tile: <b>' + tx + ', ' + ty + '</b>';
  for (const n of App.mapModel.layerOrder) {
    const id = App.mapModel.layers[n][ty * App.mapModel.W + tx];
    if (id) out += ' · ' + n + '=<b>' + id + '</b>';
  }
  App.infoEl.innerHTML = out;
};

// ═══════════════════════════════════════════════
// WASD PAN / WHEEL
// ═══════════════════════════════════════════════
App.startPanKey = function(code) {
  App.panKeys.add(code);
  if (!App.panRaf) App.panRaf = requestAnimationFrame(App.panTick);
};
App.stopPanKey = function(code) { App.panKeys.delete(code); };

App.panTick = function() {
  App.panRaf = null;
  if (!App.renderer || !App.panKeys.size) return;
  const speed = 12 / App.renderer.view.zoom;
  let dx = 0, dy = 0;
  if (App.panKeys.has('KeyW')) dy -= 1;
  if (App.panKeys.has('KeyS')) dy += 1;
  if (App.panKeys.has('KeyA')) dx -= 1;
  if (App.panKeys.has('KeyD')) dx += 1;
  if (dx || dy) {
    App.renderer.view.x -= dx * speed;
    App.renderer.view.y -= dy * speed;
    App.renderer.render();
  }
  if (App.panKeys.size) App.panRaf = requestAnimationFrame(App.panTick);
};

if (App.wrap) App.wrap.addEventListener('wheel', (e) => {
  if (!App.mapModel || !App.renderer) return;
  e.preventDefault();
  const r = App.wrap.getBoundingClientRect();
  const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  App.renderer.zoomAt(e.clientX - r.left, e.clientY - r.top, f);
  App.updateZoomLabels();
}, { passive: false });

// ═══════════════════════════════════════════════
// HOTKEYS
// ═══════════════════════════════════════════════
window.addEventListener('keydown', (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

  if (e.key === 'Escape') { if (App.pickMode) { App.endPick(); return; } }

  if (e.ctrlKey || e.metaKey) {
    if (e.code === 'KeyZ') { e.preventDefault(); App.doUndo(); return; }
    if (e.code === 'KeyY') { e.preventDefault(); App.doRedo(); return; }
    if (e.code === 'KeyS') { e.preventDefault(); App.saveMap(); return; }
    return;
  }

  if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
    if (!App.panKeys.has(e.code)) App.startPanKey(e.code);
    return;
  }

  const map = {
    KeyM: 'pan', KeyB: 'brush', KeyY: 'terrain', KeyT: 'classic',
    KeyE: 'eraser', KeyR: 'rect', KeyF: 'fill', KeyK: 'picker'
  };
  const tool = map[e.code];
  if (tool) { e.preventDefault(); App.handleToolClick(tool); }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
    App.stopPanKey(e.code);
  }
});
window.addEventListener('blur', () => { App.panKeys.clear(); });

})(window.RWEditor = window.RWEditor || {});
