(function(RW){
'use strict';
const App = RW.App;

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
    App.guideDrawStart = null; App.guideDrawCurrent = null; App.activeGuideNode = null;
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

  // GUIDES — перехватываем до проверки activeLayer
  if (App.activeTool === 'guides') {
    App.drawingPointerId = e.pointerId;
    const pos = App.renderer.screenToTile(e.clientX, e.clientY);
    const tx = pos.tx, ty = pos.ty;

    if (App.guideMode === 'create') {
      App.guideDrawStart = { x: tx, y: ty };
      App.guideDrawCurrent = { x: tx, y: ty };
      App.painting = true;
      App.renderer.render();
      return;
    } else if (App.guideMode === 'select') {
      App.activeGuideNode = null;

      if (App.selectedGuideIdx >= 0 && App.helpers[App.selectedGuideIdx]) {
        const h = App.helpers[App.selectedGuideIdx];
        const hitRadius = 15 / App.renderer.view.zoom;
        const rect = App.renderer.wrap.getBoundingClientRect();
        const mx = (e.clientX - rect.left - App.renderer.view.x) / App.renderer.view.zoom;
        const my = (e.clientY - rect.top - App.renderer.view.y) / App.renderer.view.zoom;

        const checkNode = (nx, ny) => {
          const px = nx * App.mapModel.tw;
          const py = ny * App.mapModel.th;
          return Math.hypot(px - mx, py - my) < hitRadius;
        };

        if (h.type === 'line') {
          if (checkNode(h.x1, h.y1)) App.activeGuideNode = 'p1';
          else if (checkNode(h.x2, h.y2)) App.activeGuideNode = 'p2';
        } else if (h.type === 'rect' || h.type === 'circle') {
          if (checkNode(h.x, h.y)) App.activeGuideNode = 'tl';
          else if (checkNode(h.x + h.w, h.y)) App.activeGuideNode = 'tr';
          else if (checkNode(h.x, h.y + h.h)) App.activeGuideNode = 'bl';
          else if (checkNode(h.x + h.w, h.y + h.h)) App.activeGuideNode = 'br';
        } else if (h.type === 'point') {
          if (checkNode(h.x, h.y)) App.activeGuideNode = 'p1';
        }

        if (App.activeGuideNode) { App.painting = true; App.renderer.render(); return; }
      }

      App.selectedGuideIdx = -1;
      for (let i = App.helpers.length - 1; i >= 0; i--) {
        const h = App.helpers[i];
        let minX, maxX, minY, maxY;
        if (h.type === 'line') {
          minX = Math.min(h.x1, h.x2); maxX = Math.max(h.x1, h.x2);
          minY = Math.min(h.y1, h.y2); maxY = Math.max(h.y1, h.y2);
        } else if (h.type === 'point') {
          minX = h.x; maxX = h.x; minY = h.y; maxY = h.y;
        } else {
          minX = h.x; maxX = h.x + h.w; minY = h.y; maxY = h.y + h.h;
        }
        if (tx >= minX - 1 && tx <= maxX + 1 && ty >= minY - 1 && ty <= maxY + 1) {
          App.selectedGuideIdx = i;
          break;
        }
      }
      if (typeof App.renderGuidesList === 'function') App.renderGuidesList();
      App.renderer.render();
      return;
    }
  }

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
    App.deferVoidRevert = e.shiftKey;
    App.painting = true; App.strokeChanges = null;
    App.paintTerrainCells(tx, ty);
    App.lastPaintKey = tx + ',' + ty;
    App.renderer.render();
  } else if (App.activeTool === 'classic') {
    if (!App.resolveClassicAnchor()) {
      if (App.statusEl) App.statusEl.textContent = 'Classic: выбери terrain в BRUSH панели';
      return;
    }
    if (e.shiftKey) {
      const anchor = App.resolveClassicAnchor();
      const solidTile = anchor.terrType.tile + anchor.ts.firstgid;
      if (App.fillRing(tx, ty, solidTile)) App.renderer.render();
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
    if (!App.tempTypeFill && !App.brushGroup.length) { if (App.statusEl) App.statusEl.textContent = 'Brush empty'; return; }
    App.floodFill(tx, ty, App.tempTypeFill ? 0 : App.pickWeightedTile());
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

  if (App.activeTool === 'guides' && App.painting) {
    const pos = App.renderer.screenToTile(e.clientX, e.clientY);
    const tx = pos.tx, ty = pos.ty;
    App.renderer.hoverTile = { tx, ty };

    if (App.guideMode === 'create' && App.guideDrawStart) {
      App.guideDrawCurrent = { x: tx, y: ty };
    } else if (App.guideMode === 'select' && App.selectedGuideIdx >= 0 && App.activeGuideNode) {
      const h = App.helpers[App.selectedGuideIdx];
      if (h) {
        if (h.type === 'line') {
          if (App.activeGuideNode === 'p1') { h.x1 = tx; h.y1 = ty; }
          if (App.activeGuideNode === 'p2') { h.x2 = tx; h.y2 = ty; }
        } else if (h.type === 'rect' || h.type === 'circle') {
          const x2 = h.x + h.w;
          const y2 = h.y + h.h;
          if (App.activeGuideNode === 'tl') {
            h.x = tx; h.y = ty;
            h.w = x2 - tx; h.h = y2 - ty;
          }
          if (App.activeGuideNode === 'tr') {
            h.y = ty; h.w = tx - h.x; h.h = y2 - ty;
          }
          if (App.activeGuideNode === 'bl') {
            h.x = tx; h.w = x2 - tx; h.h = ty - h.y;
          }
          if (App.activeGuideNode === 'br') {
            h.w = tx - h.x; h.h = ty - h.y;
          }
          if (h.w < 0) { h.x += h.w; h.w = -h.w; if (App.activeGuideNode === 'tl') App.activeGuideNode = 'tr'; else if (App.activeGuideNode === 'tr') App.activeGuideNode = 'tl'; else if (App.activeGuideNode === 'bl') App.activeGuideNode = 'br'; else if (App.activeGuideNode === 'br') App.activeGuideNode = 'bl'; }
          if (h.h < 0) { h.y += h.h; h.h = -h.h; if (App.activeGuideNode === 'tl') App.activeGuideNode = 'bl'; else if (App.activeGuideNode === 'tr') App.activeGuideNode = 'br'; else if (App.activeGuideNode === 'bl') App.activeGuideNode = 'tl'; else if (App.activeGuideNode === 'br') App.activeGuideNode = 'tr'; }
        } else if (h.type === 'point') {
          h.x = tx; h.y = ty;
        }
      }
    }
    App.renderer.render();
    App.updateInfo(tx, ty);
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
      if (App.activeTool === 'guides') {
        if (App.guideMode === 'create' && App.guideDrawStart && App.guideDrawCurrent) {
          const start = App.guideDrawStart;
          const end = App.guideDrawCurrent;
          if (start.x !== end.x || start.y !== end.y || App.activeGuideType === 'point') {
            let newGuide = { color: '#0ff' };
            if (App.activeGuideType === 'line') {
              newGuide = { ...newGuide, type: 'line', x1: start.x, y1: start.y, x2: end.x, y2: end.y };
            } else if (App.activeGuideType === 'rect' || App.activeGuideType === 'circle') {
              newGuide = {
                ...newGuide, type: App.activeGuideType,
                x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
                w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y)
              };
            } else if (App.activeGuideType === 'point') {
              newGuide = { ...newGuide, type: 'point', x: start.x, y: start.y };
            }
            App.addGuideWithSymmetry(newGuide);
          }
        }
        App.guideDrawStart = null;
        App.guideDrawCurrent = null;
        App.activeGuideNode = null;
      } else if (App.activeTool === 'rect') {
        if (App.rectStart && App.rectCurrent) {
          App.lastSelection = {
            x0: Math.min(App.rectStart.x, App.rectCurrent.x),
            y0: Math.min(App.rectStart.y, App.rectCurrent.y),
            x1: Math.max(App.rectStart.x, App.rectCurrent.x),
            y1: Math.max(App.rectStart.y, App.rectCurrent.y)
          };
          if (App.brushGroup.length) {
            App.applyRect(App.rectStart.x, App.rectStart.y, App.rectCurrent.x, App.rectCurrent.y, App.pickWeightedTile);
          }
        }
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
    App.guideDrawStart = null;
    App.guideDrawCurrent = null;
    App.activeGuideNode = null;
    if (App.renderer) App.renderer.render();
  }
});

if (App.cv) App.cv.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse' && !App.pointers.has(e.pointerId)) {
    if (App.renderer) { App.renderer.hoverTile = null; App.renderer.render(); }
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

window.addEventListener('keydown', (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

  if (App.pressedKeys) App.pressedKeys.add(e.code);

  if (e.key === 'Escape') { if (App.pickMode) { App.endPick(); return; } }

  if (e.key === 'Shift' && App.activeTool === 'terrain') {
    App.updateAcceptWallsVisibility();
  }

  if ((e.code === 'Delete' || e.code === 'Backspace') && App.activeTool === 'guides' && App.selectedGuideIdx >= 0) {
    e.preventDefault();
    App.removeGuide(App.selectedGuideIdx);
    if (App.renderer) App.renderer.render();
    return;
  }

  if (e.ctrlKey || e.metaKey) {
    if (e.code === 'KeyZ') { e.preventDefault(); App.doUndo(); return; }
    if (e.code === 'KeyY') { e.preventDefault(); App.doRedo(); return; }
    if (e.code === 'KeyS') { e.preventDefault(); App.saveMap(); return; }
    return;
  }

  if (e.code === 'KeyF') {
    if (e.shiftKey) { e.preventDefault(); App.runTypeFill(); return; }
    if (App.pressedKeys && App.pressedKeys.has('KeyE')) { e.preventDefault(); App.runEmptyFill(); return; }
    if (App.tempEmptyFill || App.tempTypeFill) {
      e.preventDefault();
      if (App.tempEmptyFill) App.runEmptyFill();
      if (App.tempTypeFill) App.runTypeFill();
      return;
    }
  }

  if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
    if (!App.panKeys.has(e.code)) App.startPanKey(e.code);
    return;
  }

  const map = {
    KeyM: 'pan', KeyB: 'brush', KeyY: 'terrain', KeyT: 'classic',
    KeyE: 'eraser', KeyR: 'rect', KeyF: 'fill', KeyK: 'picker',
    KeyG: 'guides', KeyU: 'utils'
  };
  const tool = map[e.code];
  if (tool) { e.preventDefault(); App.handleToolClick(tool); }
});

window.addEventListener('keyup', (e) => {
  if (App.pressedKeys) App.pressedKeys.delete(e.code);
  
  if (e.key === 'Shift' && App.activeTool === 'terrain') {
    App.updateAcceptWallsVisibility();
  }

  if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
    App.stopPanKey(e.code);
  }
});
window.addEventListener('blur', () => { App.panKeys.clear(); if (App.pressedKeys) App.pressedKeys.clear(); });

})(window.RWEditor = window.RWEditor || {});