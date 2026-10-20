(function(RW){
'use strict';
const App = RW.App;

// ═══════════════════════════════════════════════
// CLASSIC AUTOTILE
// ═══════════════════════════════════════════════
App.resolveClassicAnchor = function() {
  if (!App.activeClassicTerrain || !App.mapModel) return null;
  const a = App.activeClassicTerrain;
  const tsIdx = App.mapModel.tilesets.findIndex(t => t.firstgid === a.tsFirstgid);
  if (tsIdx < 0) return null;
  const ts = App.mapModel.tilesets[tsIdx];
  const terrIdx = ts.terrainTypes.findIndex(tt => tt.name === a.terrName);
  if (terrIdx < 0) return null;
  return { ts, tsIdx, terrIdx, terrType: ts.terrainTypes[terrIdx] };
};

// ═══════════════════════════════════════════════
// PICK MODE
// ═══════════════════════════════════════════════
App.ensureAtlasesVisible = function() {
  const b = App.el('btnAtlasesTab');
  if (b) b.classList.add('active');
  if (App.bottomEl) App.bottomEl.classList.remove('atlases-hidden');
};

App.startPick = function(mode) {
  App.pickMode = mode;
  App.ensureAtlasesVisible();
  let label;
  if (mode.kind === 'edge') label = 'Pick tile for ' + mode.role;
  else if (mode.kind === 'solid') label = 'Pick solid tile';
  if (App.pickBannerTextEl) App.pickBannerTextEl.textContent = label + ' · click tile · click again to clear';
  if (App.pickBannerEl) App.pickBannerEl.classList.remove('hidden');
  if (App.typesPanel) App.typesPanel.build();
  if (App.tilesetTabs) App.tilesetTabs.build();
  if (App.statusEl) App.statusEl.textContent = label;
};

App.endPick = function() {
  App.pickMode = null;
  if (App.pickBannerEl) App.pickBannerEl.classList.add('hidden');
  if (App.typesPanel) App.typesPanel.build();
  if (App.tilesetTabs) App.tilesetTabs.build();
  if (App.statusEl) App.statusEl.textContent = 'Pick cancelled';
};

App.applyPick = function(globalID) {
  if (!App.pickMode) return;
  const t = App.typesModel.get(App.pickMode.typeId);
  if (!t) { App.endPick(); return; }
  if (App.pickMode.kind === 'edge') {
    if (t.edges[App.pickMode.role] === globalID) t.edges[App.pickMode.role] = 0;
    else t.edges[App.pickMode.role] = globalID;
  } else if (App.pickMode.kind === 'solid') {
    const idx = t.solids.findIndex(s => s.tileID === globalID);
    if (idx >= 0) t.solids.splice(idx, 1);
    else t.solids.push({ tileID: globalID, weight: 1 });
  }
  if (App.typesPanel) App.typesPanel.build();
  if (App.tilesetTabs) App.tilesetTabs.build();
  if (App.statusEl) App.statusEl.textContent = 'OK · #' + globalID;
};

// ═══════════════════════════════════════════════
// BRUSH HELPERS
// ═══════════════════════════════════════════════
App.addToBrush = function(tileID, add) {
  if (tileID === 0 && !add) return;
  if (!add) App.brushGroup = [{ tileID, weight: 1 }];
  else {
    const ex = App.brushGroup.find(b => b.tileID === tileID);
    if (ex) ex.weight = 1;
    else App.brushGroup.push({ tileID, weight: 1 });
  }
  if (App.brushPanel) App.brushPanel.build();
  if (App.tilesetTabs) App.tilesetTabs.refreshSelection();
};

App.addEmptyToBrush = function() {
  const ex = App.brushGroup.find(b => b.tileID === 0);
  if (ex) ex.weight = 1;
  else App.brushGroup.push({ tileID: 0, weight: 1 });
  if (App.brushPanel) App.brushPanel.build();
  if (App.tilesetTabs) App.tilesetTabs.refreshSelection();
};

App.pickWeightedTile = function() {
  if (!App.brushGroup.length) return 0;
  const total = App.brushGroup.reduce((s, b) => s + b.weight, 0);
  if (total <= 0) return App.brushGroup[0].tileID;
  let r = Math.random() * total;
  for (const b of App.brushGroup) { r -= b.weight; if (r <= 0) return b.tileID; }
  return App.brushGroup[App.brushGroup.length - 1].tileID;
};

App.pickWeightedSolid = function(type) {
  if (!type || !type.solids || !type.solids.length) return 0;
  const total = type.solids.reduce((s, x) => s + (x.weight || 0), 0);
  if (total <= 0) return type.solids[0].tileID;
  let r = Math.random() * total;
  for (const s of type.solids) { r -= (s.weight || 0); if (r <= 0) return s.tileID; }
  return type.solids[type.solids.length - 1].tileID;
};

App.brushCells = function(cx, cy) {
  const size = App.brushSettings.size || 0;
  const shape = App.brushSettings.shape;
  if (size === 0) return [[cx, cy]];
  const cells = [];
  for (let dy = -size; dy <= size; dy++) {
    for (let dx = -size; dx <= size; dx++) {
      let ok = false;
      if (shape === 'square') ok = true;
      else if (shape === 'circle') ok = dx*dx + dy*dy <= size*size;
      else if (shape === 'diamond') ok = Math.abs(dx) + Math.abs(dy) <= size;
      if (ok) cells.push([cx + dx, cy + dy]);
    }
  }
  return cells;
};

// ═══════════════════════════════════════════════
// PAINTING
// ═══════════════════════════════════════════════
App.ensureStrokeChanges = function() { if (!App.strokeChanges) App.strokeChanges = new Map(); };

App.recordChange = function(layer, idx, before, after) {
  App.ensureStrokeChanges();
  if (!App.strokeChanges.has(layer)) App.strokeChanges.set(layer, new Map());
  const m = App.strokeChanges.get(layer);
  if (!m.has(idx)) m.set(idx, { before, after });
  else m.get(idx).after = after;
};

App.expandStrokeBound = function(tx, ty) {
  if (!App.strokeBound) App.strokeBound = { x0: tx, y0: ty, x1: tx, y1: ty };
  else {
    if (tx < App.strokeBound.x0) App.strokeBound.x0 = tx;
    if (ty < App.strokeBound.y0) App.strokeBound.y0 = ty;
    if (tx > App.strokeBound.x1) App.strokeBound.x1 = tx;
    if (ty > App.strokeBound.y1) App.strokeBound.y1 = ty;
  }
};

App.paintBrushCells = function(cx, cy, tileFn) {
  const map = App.mapModel;
  if (!App.activeLayer) return;
  const data = map.layers[App.activeLayer];
  const cells = App.brushCells(cx, cy);
  let touchedGround = false;
  for (const c of cells) {
    const tx = c[0], ty = c[1];
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) continue;
    const idx = ty * map.W + tx;
    const v = tileFn();
    const before = data[idx];
    if (before === v) continue;
    data[idx] = v;
    App.recordChange(App.activeLayer, idx, before, v);
    App.renderer.invalidateCell(tx, ty);
    App.expandStrokeBound(tx, ty);
    if (App.activeLayer === 'Ground') touchedGround = true;
  }
  if (touchedGround) App.invalidateMarkersCache();
};

App.paintTerrainCells = function(cx, cy) {
  const map = App.mapModel;
  if (!App.activeLayer) return;
  const type = App.typesModel.get(App.activeTypeId);
  if (!type || !type.solids.length) {
    if (App.statusEl) App.statusEl.textContent = 'No type selected or no solids';
    return;
  }
  const data = map.layers[App.activeLayer];
  const cells = App.brushCells(cx, cy);
  let touchedGround = false;
  for (const c of cells) {
    const tx = c[0], ty = c[1];
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) continue;
    const idx = ty * map.W + tx;
    const before = data[idx];
    const after = App.pickWeightedSolid(type);
    if (before === after) continue;
    data[idx] = after;
    App.recordChange(App.activeLayer, idx, before, after);
    App.renderer.invalidateCell(tx, ty);
    App.expandStrokeBound(tx, ty);
    if (App.activeLayer === 'Ground') touchedGround = true;
  }
  if (touchedGround) App.invalidateMarkersCache();
};

// ─── CLASSIC AUTOTILE ───
App.buildClassicMaskIndex = function(tsIdx) {
  const c = App.classicMaskCache.get(tsIdx);
  if (c) return c;
  const ts = App.mapModel.tilesets[tsIdx];
  const idx = new Map();
  for (const idStr in ts.tiles) {
    const id = parseInt(idStr, 10);
    const t = ts.tiles[id];
    if (!t.terrain) continue;
    const k = t.terrain.join(',');
    if (!idx.has(k)) idx.set(k, id + ts.firstgid);
  }
  App.classicMaskCache.set(tsIdx, idx);
  return idx;
};

App.findEmptyValue = function(tsIdx, targetTerr) {
  const k = tsIdx + ':' + targetTerr;
  if (App.classicEmptyCache.has(k)) return App.classicEmptyCache.get(k);
  const ts = App.mapModel.tilesets[tsIdx];
  const counts = new Map();
  for (const idStr in ts.tiles) {
    const t = ts.tiles[idStr];
    if (!t.terrain) continue;
    if (!t.terrain.some(v => v === targetTerr)) continue;
    for (const v of t.terrain) {
      if (v === targetTerr) continue;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
  }
  let best = -1, bestCount = 0;
  for (const kv of counts) if (kv[1] > bestCount) { best = kv[0]; bestCount = kv[1]; }
  App.classicEmptyCache.set(k, best);
  return best;
};

App.cellHasCorner = function(tx, ty, ci, tsIdx, targetTerr, solidTileId, layerData) {
  const map = App.mapModel;
  if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return false;
  const data = layerData || map.layers[App.activeLayer];
  if (!data) return false;
  const id = data[ty * map.W + tx];
  if (!id) return false;
  if (id === solidTileId) return true;
  
  const ts = App.mapModel.tilesets[tsIdx];
  const nts = App.renderer.findTileset(id);
  if (!nts || nts !== ts) return false;
  const t = nts.tiles[id - nts.firstgid];
  if (!t || !t.terrain) return false;
  return t.terrain[ci] === targetTerr;
};

App.resolveClassicMask = function(tx, ty, tsIdx, targetTerr, emptyValue, solidTileId, layerData) {
  // 47-tile blob (оригинальная логика Беты-32)
  const tlOK = App.cellHasCorner(tx-1, ty-1, 3, tsIdx, targetTerr, solidTileId, layerData) &&
               App.cellHasCorner(tx, ty-1, 2, tsIdx, targetTerr, solidTileId, layerData) &&
               App.cellHasCorner(tx-1, ty, 1, tsIdx, targetTerr, solidTileId, layerData);
  const trOK = App.cellHasCorner(tx, ty-1, 3, tsIdx, targetTerr, solidTileId, layerData) &&
               App.cellHasCorner(tx+1, ty-1, 2, tsIdx, targetTerr, solidTileId, layerData) &&
               App.cellHasCorner(tx+1, ty, 0, tsIdx, targetTerr, solidTileId, layerData);
  const blOK = App.cellHasCorner(tx-1, ty, 3, tsIdx, targetTerr, solidTileId, layerData) &&
               App.cellHasCorner(tx-1, ty+1, 1, tsIdx, targetTerr, solidTileId, layerData) &&
               App.cellHasCorner(tx, ty+1, 0, tsIdx, targetTerr, solidTileId, layerData);
  const brOK = App.cellHasCorner(tx+1, ty, 2, tsIdx, targetTerr, solidTileId, layerData) &&
               App.cellHasCorner(tx+1, ty+1, 0, tsIdx, targetTerr, solidTileId, layerData) &&
               App.cellHasCorner(tx, ty+1, 1, tsIdx, targetTerr, solidTileId, layerData);
  
  let mask = [
    tlOK ? targetTerr : emptyValue,
    trOK ? targetTerr : emptyValue,
    blOK ? targetTerr : emptyValue,
    brOK ? targetTerr : emptyValue
  ];
  
  // Edge-fallback: если 47-blob дал полностью пустую маску, но рядом есть
  // ортогональный солид — рисуем прямые края.
  if (mask[0] === emptyValue && mask[1] === emptyValue &&
      mask[2] === emptyValue && mask[3] === emptyValue) {
    const up = App.cellHasCorner(tx, ty-1, 2, tsIdx, targetTerr, solidTileId, layerData);
    const down = App.cellHasCorner(tx, ty+1, 0, tsIdx, targetTerr, solidTileId, layerData);
    const left = App.cellHasCorner(tx-1, ty, 1, tsIdx, targetTerr, solidTileId, layerData);
    const right = App.cellHasCorner(tx+1, ty, 3, tsIdx, targetTerr, solidTileId, layerData);
    
    if (up) { mask[0] = targetTerr; mask[1] = targetTerr; }
    if (down) { mask[2] = targetTerr; mask[3] = targetTerr; }
    if (left) { mask[0] = targetTerr; mask[2] = targetTerr; }
    if (right) { mask[1] = targetTerr; mask[3] = targetTerr; }
  }
  
  return mask;
};

App.combinations = function(arr, k) {
  const r = [];
  function rec(s, cur) {
    if (cur.length === k) { r.push(cur.slice()); return; }
    for (let i = s; i < arr.length; i++) { cur.push(arr[i]); rec(i+1, cur); cur.pop(); }
  }
  rec(0, []);
  return r;
};

App.paintClassicCell = function(tx, ty, anchor, layerData, forcedSolid, forcedEmpty) {
  if (!anchor) return;
  const map = App.mapModel;
  if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return;
  const isTemp = !!layerData;
  if (!layerData) layerData = map.layers[App.activeLayer];
  if (!layerData) return;
  
  const i = ty * map.W + tx;
  const solidTileId = anchor.terrType.tile + anchor.ts.firstgid;

  // 1. Принудительный солид (пирамида / forced)
  if (forcedSolid && forcedSolid[i]) {
    const prev = layerData[i];
    if (prev !== solidTileId) {
      layerData[i] = solidTileId;
      if (!isTemp) {
        App.recordChange(App.activeLayer, i, prev, solidTileId);
        App.renderer.invalidateCell(tx, ty);
      }
    }
    return;
  }

  // 2. Принудительная пустота (пирамида: пустые кольца)
  if (forcedEmpty && forcedEmpty[i]) {
    const prev = layerData[i];
    if (prev !== 0) {
      layerData[i] = 0;
      if (!isTemp) {
        App.recordChange(App.activeLayer, i, prev, 0);
        App.renderer.invalidateCell(tx, ty);
      }
    }
    return;
  }

  // 3. СОЛИД — СВЯТОЕ. Никогда не перезаписываем существующий солид.
  const before = layerData[i];
  if (before === solidTileId) return;

  const tsIdx = anchor.tsIdx;
  const terrIdx = anchor.terrIdx;
  const ev = App.findEmptyValue(tsIdx, terrIdx);
  
  const mask = App.resolveClassicMask(tx, ty, tsIdx, terrIdx, ev, solidTileId, layerData);
  let tileID;

  if (mask[0] === terrIdx && mask[1] === terrIdx && mask[2] === terrIdx && mask[3] === terrIdx) {
    tileID = solidTileId;
  } else if (mask[0] === ev && mask[1] === ev && mask[2] === ev && mask[3] === ev) {
    tileID = 0;
  } else {
    const idx = App.buildClassicMaskIndex(tsIdx);
    tileID = idx.get(mask.join(','));
    
    // Fallback: только в сторону "пустее". Никогда не ставим солиднее —
    // иначе чёрные дуги/солиды на пустых клетках.
    if (tileID === undefined) {
      const solid = [];
      for (let j = 0; j < 4; j++) if (mask[j] === terrIdx) solid.push(j);
      outer:
      for (let n = solid.length; n >= 1; n--) {
        const combos = App.combinations(solid, n);
        for (const combo of combos) {
          const test = mask.slice();
          for (const j of combo) test[j] = ev;
          tileID = idx.get(test.join(','));
          if (tileID !== undefined) break outer;
        }
      }
      if (tileID === undefined) tileID = 0;
    }
  }
  
  if (tileID === undefined) return;
  if (before === tileID) return;
  
  layerData[i] = tileID;
  
  if (!isTemp) {
    App.recordChange(App.activeLayer, i, before, tileID);
    App.renderer.invalidateCell(tx, ty);
  }
};

App.paintClassicCells = function(cx, cy) {
  const map = App.mapModel;
  if (!map || !App.activeLayer) return;
  const anchor = App.resolveClassicAnchor();
  if (!anchor) {
    if (App.statusEl) App.statusEl.textContent = 'Classic: anchor not resolved';
    return;
  }
  const solidTile = anchor.terrType.tile + anchor.ts.firstgid;
  const cells = App.brushCells(cx, cy);
  const data = map.layers[App.activeLayer];
  for (const c of cells) {
    const tx = c[0], ty = c[1];
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) continue;
    const i = ty * map.W + tx;
    const before = data[i];
    if (before === solidTile) continue;
    data[i] = solidTile;
    App.recordChange(App.activeLayer, i, before, solidTile);
    App.renderer.invalidateCell(tx, ty);
    App.expandStrokeBound(tx, ty);
  }
};

App.finalizeClassicForStroke = function() {
  if (!App.strokeChanges) return;
  const m = App.strokeChanges.get(App.activeLayer);
  if (!m || !m.size) return;
  const anchor = App.resolveClassicAnchor();
  if (!anchor) return;
  const painted = new Set(m.keys());
  
  const lookup = new Set();
  for (const i of painted) {
    const x = i % App.mapModel.W, y = Math.floor(i / App.mapModel.W);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= App.mapModel.W || ny >= App.mapModel.H) continue;
        const nidx = ny * App.mapModel.W + nx;
        if (!painted.has(nidx)) lookup.add(nidx);
      }
  }
  
  for (const i of lookup) {
    const x = i % App.mapModel.W, y = Math.floor(i / App.mapModel.W);
    App.paintClassicCell(x, y, anchor);
  }
};

App.finalizeAutotileForStroke = function() {
  if (!App.generator || !App.strokeBound) return;
  const b = App.strokeBound;
  const pad = 1 + (App.brushSettings.size || 0);
  const changes = App.generator.generateRect(b.x0 - pad, b.y0 - pad, b.x1 + pad, b.y1 + pad);
  if (!changes.length) return;
  const data = App.mapModel.layers.Items0;
  if (!data) return;
  for (const c of changes) {
    data[c.idx] = c.after;
    const x = c.idx % App.mapModel.W, y = Math.floor(c.idx / App.mapModel.W);
    App.renderer.invalidateCell(x, y);
    App.recordChange('Items0', c.idx, c.before, c.after);
  }
};

App.endStroke = function() {
  if (!App.strokeChanges || !App.strokeChanges.size) {
    App.strokeChanges = null; App.strokeBound = null;
    return;
  }
  const map = App.mapModel;
  const layers = [];
  let total = 0;
  const touchedLayers = [];
  for (const kv of App.strokeChanges) {
    const layer = kv[0], m = kv[1];
    const real = [];
    for (const kv2 of m) {
      const i = kv2[0], c = kv2[1];
      if (c.before !== c.after) real.push({ idx: i, before: c.before, after: c.after });
    }
    if (!real.length) continue;
    layers.push({ layer, changes: real });
    touchedLayers.push(layer);
    total += real.length;
  }
  if (layers.length) {
    map.undoStack.push({ type: 'multi', layers });
    if (map.undoStack.length > 50) map.undoStack.shift();
    map.redoStack.length = 0;
    if (App.statusEl) App.statusEl.textContent = total + ' cells changed';
    if (App.layersPanel) {
      for (const ln of touchedLayers) App.layersPanel.flash(ln);
    }
  }
  App.invalidateMarkersCache();
  App.strokeChanges = null; App.strokeBound = null; App.lastPaintKey = null;
};

// ═══════════════════════════════════════════════
// FLOOD / RECT / PICKER / AUTOTILE DIALOG
// ═══════════════════════════════════════════════
App.floodFill = function(tx, ty, newTile) {
  if (App.tempTypeFill) {
    const map = App.mapModel;
    if (!map || !App.activeLayer) return;
    const data = map.layers[App.activeLayer];
    const target = data[ty * map.W + tx];
    if (!target) return;
    
    const type = App.typesModel.findBySolid(target);
    if (!type) { if (App.statusEl) App.statusEl.textContent = 'Tile is not in any Type'; return; }
    
    const solidIds = new Set(type.solids.map(s => s.tileID));
    const newTileId = App.pickWeightedSolid(type);
    
    const stack = [[tx, ty]];
    const seen = new Set();
    const changes = [];
    while (stack.length) {
        const p = stack.pop();
        const x = p[0], y = p[1];
        if (x < 0 || y < 0 || x >= map.W || y >= map.H) continue;
        const i = y * map.W + x;
        if (seen.has(i) || !solidIds.has(data[i])) continue;
        seen.add(i);
        changes.push({ idx: i, before: data[i], after: newTileId });
        stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
    }
    if (!changes.length) return;
    for (const c of changes) data[c.idx] = c.after;
    
    let minX = map.W, maxX = 0, minY = map.H, maxY = 0;
    for (const c of changes) {
        const x = c.idx % map.W, y = Math.floor(c.idx / map.W);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    App.renderer.invalidateRange(minX, minY, maxX, maxY);
    map.undoStack.push({ layer: App.activeLayer, changes });
    if (map.undoStack.length > 50) map.undoStack.shift();
    map.redoStack.length = 0;
    App.invalidateMarkersCache();
    if (App.layersPanel) App.layersPanel.flash(App.activeLayer);
    if (App.statusEl) App.statusEl.textContent = 'Type Fill: ' + changes.length + ' cells';
    return;
  }

  const map = App.mapModel;
  if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return;
  if (!App.activeLayer) return;
  const data = map.layers[App.activeLayer];
  const target = data[ty * map.W + tx];
  if (target === newTile) return;
  const stack = [[tx, ty]];
  const seen = new Set();
  const changes = [];
  while (stack.length) {
    const p = stack.pop();
    const x = p[0], y = p[1];
    if (x < 0 || y < 0 || x >= map.W || y >= map.H) continue;
    const i = y * map.W + x;
    if (seen.has(i) || data[i] !== target) continue;
    seen.add(i);
    changes.push({ idx: i, before: target, after: newTile });
    stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]);
  }
  if (!changes.length) return;
  for (const c of changes) data[c.idx] = c.after;
  let minX = map.W, maxX = 0, minY = map.H, maxY = 0;
  for (const c of changes) {
    const x = c.idx % map.W, y = Math.floor(c.idx / map.W);
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  App.renderer.invalidateRange(minX, minY, maxX, maxY);
  map.undoStack.push({ layer: App.activeLayer, changes });
  if (map.undoStack.length > 50) map.undoStack.shift();
  map.redoStack.length = 0;
  App.invalidateMarkersCache();
  if (App.layersPanel) App.layersPanel.flash(App.activeLayer);
  if (App.statusEl) App.statusEl.textContent = 'Fill: ' + changes.length + ' cells';
};

App.runFloodDominant = function() {
  if (!App.mapModel || !App.generator) { if (App.statusEl) App.statusEl.textContent = 'No map'; return; }
  if (!App.mapModel.layers.Ground) { if (App.statusEl) App.statusEl.textContent = 'No Ground layer'; return; }
  const changes = App.generator.floodDominant(0, 0, App.mapModel.W - 1, App.mapModel.H - 1);
  if (!changes.length) { if (App.statusEl) App.statusEl.textContent = 'FLOOD: nothing to change'; return; }
  const data = App.mapModel.layers.Ground;
  for (const c of changes) data[c.idx] = c.after;
  App.renderer.invalidate();
  App.mapModel.undoStack.push({ layer: 'Ground', changes });
  if (App.mapModel.undoStack.length > 50) App.mapModel.undoStack.shift();
  App.mapModel.redoStack.length = 0;
  App.invalidateMarkersCache();
  App.renderer.render();
  if (App.layersPanel) App.layersPanel.flash('Ground');
  if (App.statusEl) App.statusEl.textContent = 'FLOOD: ' + changes.length + ' cells';
};

App.applyRect = function(x0, y0, x1, y1, tileFn) {
  const map = App.mapModel;
  if (!App.activeLayer) return;
  const minX = Math.max(0, Math.min(x0, x1));
  const maxX = Math.min(map.W - 1, Math.max(x0, x1));
  const minY = Math.max(0, Math.min(y0, y1));
  const maxY = Math.min(map.H - 1, Math.max(y0, y1));
  const data = map.layers[App.activeLayer];
  const changes = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i = y * map.W + x;
      const before = data[i];
      const v = tileFn();
      if (before === v) continue;
      data[i] = v;
      changes.push({ idx: i, before, after: v });
    }
  }
  if (!changes.length) return;
  App.renderer.invalidateRange(minX, minY, maxX, maxY);
  map.undoStack.push({ layer: App.activeLayer, changes });
  if (map.undoStack.length > 50) map.undoStack.shift();
  map.redoStack.length = 0;
  App.invalidateMarkersCache();
  if (App
