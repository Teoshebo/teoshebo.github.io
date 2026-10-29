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

App.updateTNSEdgesAround = function(tx, ty) {
  if (!App.generator || !App.mapModel) return;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= App.mapModel.W || ny >= App.mapModel.H) continue;
      const idx = ny * App.mapModel.W + nx;

      const best = App.generator.pickDominant(nx, ny);
      const targetLayer = (best && best.type.edgeLayer) ? best.type.edgeLayer : 'Items0';
      const targetData = App.mapModel.layers[targetLayer];
      if (!targetData) continue;

      const before = targetData[idx];
      const after = App.generator.resolveEdge(nx, ny, best);
      if (before !== after) {
        targetData[idx] = after;
        App.recordChange(targetLayer, idx, before, after);
        App.renderer.invalidateCell(nx, ny);
      }
    }
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
    if (App.activeLayer === 'Ground') { touchedGround = true; App.updateTNSEdgesAround(tx, ty); }
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
    if (App.activeLayer === 'Ground') { touchedGround = true; App.updateTNSEdgesAround(tx, ty); }
  }
  if (touchedGround) App.invalidateMarkersCache();
};

// CLASSIC AUTOTILE
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

App.cellHasTarget = function(tx, ty, tsIdx, targetTerr, solidTileId, layerData) {
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
  return t.terrain[0] === targetTerr && t.terrain[1] === targetTerr &&
         t.terrain[2] === targetTerr && t.terrain[3] === targetTerr;
};

App.resolveClassicMask = function(tx, ty, tsIdx, targetTerr, emptyValue, solidTileId, layerData) {
  const tN  = App.cellHasTarget(tx,     ty - 1, tsIdx, targetTerr, solidTileId, layerData);
  const tS  = App.cellHasTarget(tx,     ty + 1, tsIdx, targetTerr, solidTileId, layerData);
  const tE  = App.cellHasTarget(tx + 1, ty,     tsIdx, targetTerr, solidTileId, layerData);
  const tW  = App.cellHasTarget(tx - 1, ty,     tsIdx, targetTerr, solidTileId, layerData);
  const tNW = App.cellHasTarget(tx - 1, ty - 1, tsIdx, targetTerr, solidTileId, layerData);
  const tNE = App.cellHasTarget(tx + 1, ty - 1, tsIdx, targetTerr, solidTileId, layerData);
  const tSW = App.cellHasTarget(tx - 1, ty + 1, tsIdx, targetTerr, solidTileId, layerData);
  const tSE = App.cellHasTarget(tx + 1, ty + 1, tsIdx, targetTerr, solidTileId, layerData);

  const qNW = (tNW || tN || tW) ? targetTerr : emptyValue;
  const qNE = (tNE || tN || tE) ? targetTerr : emptyValue;
  const qSW = (tSW || tS || tW) ? targetTerr : emptyValue;
  const qSE = (tSE || tS || tE) ? targetTerr : emptyValue;

  const mask = [qNW, qNE, qSW, qSE];
  if (mask[0] === emptyValue && mask[1] === emptyValue &&
      mask[2] === emptyValue && mask[3] === emptyValue) return mask;

  const idx = App.buildClassicMaskIndex(tsIdx);
  if (idx.has(mask.join(','))) return mask;

  let bestMask = mask, minDist = Infinity;
  for (const [k, id] of idx.entries()) {
    const testMask = k.split(',').map(Number);
    let dist = 0;
    for (let i = 0; i < 4; i++) {
      if (mask[i] === testMask[i]) continue;
      const wantSolid = (mask[i] === targetTerr);
      const gotSolid = (testMask[i] === targetTerr);
      if (wantSolid && !gotSolid) dist += 1;
      else if (!wantSolid && gotSolid) dist += 10;
      else dist += 100;
    }
    if (dist < minDist) { minDist = dist; bestMask = testMask; }
    if (minDist === 0) break;
  }
  return bestMask;
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
    if (tileID === undefined) tileID = 0;
  }
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
  for (const c of cells) {
    const tx = c[0], ty = c[1];
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      App.paintClassicCell(tx + dx, ty + dy, anchor);
    }
  }
};

App.finalizeClassicForStroke = function() {
  if (!App.strokeChanges) return;
  const m = App.strokeChanges.get(App.activeLayer);
  if (!m || !m.size) return;
  const anchor = App.resolveClassicAnchor();
  if (!anchor) return;

  const solidTile = anchor.terrType.tile + anchor.ts.firstgid;
  const painted = new Set();
  for (const [i, c] of m) if (c.after === solidTile) painted.add(i);

  const lookup = new Set();
  for (const i of painted) {
    const x = i % App.mapModel.W, y = Math.floor(i / App.mapModel.W);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
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
  for (const c of changes) {
    App.renderer.invalidateCell(c.idx % App.mapModel.W, Math.floor(c.idx / App.mapModel.W));
    App.recordChange(c.layer, c.idx, c.before, c.after);
  }
};

// [Patch 0.6.5] — Wall Creator (Void) logic in endStroke
App.endStroke = function() {
  if (!App.strokeChanges || !App.strokeChanges.size) {
    App.strokeChanges = null; App.strokeBound = null;
    return;
  }
  const map = App.mapModel;

  // ─── ПРОВЕРКА НА VOID (WALL CREATOR) ───
  const activeType = App.typesModel.get(App.activeTypeId);
  let isVoid = false;
  
  if (activeType && activeType.solids.length > 0) {
    // Проверяем ВСЕ солиды типа, так как pickWeightedSolid может выбрать любой
    for (const s of activeType.solids) {
      const ts = App.renderer.findTileset(s.tileID);
      if (ts) {
        const t = ts.tiles[s.tileID - ts.firstgid];
        // Если у солида есть проп 'void' (или 'wall'), считаем его невидимым
        if (t && t.props && (t.props.void !== undefined || t.props.wall !== undefined)) {
          isVoid = true;
          break;
        }
      }
    }
  }

  if (isVoid && App.strokeChanges.has('Ground')) {
    const groundChanges = App.strokeChanges.get('Ground');
    const groundData = map.layers.Ground;
    
    // 1. Возвращаем Ground в исходное состояние
    for (const [idx, c] of groundChanges.entries()) {
      groundData[idx] = c.before; 
      const x = idx % map.W;
      const y = Math.floor(idx / map.W);
      App.renderer.invalidateCell(x, y);
    }
    
    // 2. Удаляем изменения Ground из корзины Undo, чтобы они не сохранились
    App.strokeChanges.delete('Ground');
    
    if (App.statusEl) App.statusEl.textContent = 'Wall Creator: Солиды скрыты, края сохранены';
  }
  // ──────────────────────────────────────────────

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
    if (layers.length === 1) {
      map.undoStack.push({ layer: layers[0].layer, changes: layers[0].changes });
    } else {
      map.undoStack.push({ type: 'multi', layers });
    }
    if (map.undoStack.length > 50) map.undoStack.shift();
    map.redoStack.length = 0;
    if (App.statusEl && !isVoid) App.statusEl.textContent = total + ' cells changed';
    if (App.layersPanel) for (const ln of touchedLayers) App.layersPanel.flash(ln);
  }
  App.invalidateMarkersCache();
  App.strokeChanges = null; App.strokeBound = null; App.lastPaintKey = null;
};

// FLOOD / RECT / PICKER / AUTOTILE
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
    const stack = [[tx, ty]], seen = new Set(), changes = [];
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
  const stack = [[tx, ty]], seen = new Set(), changes = [];
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
  if (App.layersPanel) App.layersPanel.flash(App.activeLayer);
  if (App.statusEl) App.statusEl.textContent = 'Rect: ' + changes.length + ' cells';
};

App.pickerAt = function(tx, ty) {
  const map = App.mapModel;
  if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return;
  for (let i = map.layerOrder.length - 1; i >= 0; i--) {
    const name = map.layerOrder[i];
    if (!App.renderer.isLayerVisible(name)) continue;
    const id = map.layers[name][ty * map.W + tx];
    if (id) {
      App.activeLayer = name;
      App.addToBrush(id, false);
      if (App.layersPanel) App.layersPanel.build();
      if (App.statusEl) App.statusEl.textContent = 'Picker: ' + name + ' #' + id;
      return;
    }
  }
  if (App.statusEl) App.statusEl.textContent = 'Picker: empty';
};

App.runAutotileDialog = function() {
  if (!App.mapModel || !App.generator) return;
  const x0 = parseInt(prompt('x0:', '0'), 10); if (isNaN(x0)) return;
  const y0 = parseInt(prompt('y0:', '0'), 10); if (isNaN(y0)) return;
  const x1 = parseInt(prompt('x1:', String(App.mapModel.W - 1)), 10); if (isNaN(x1)) return;
  const y1 = parseInt(prompt('y1:', String(App.mapModel.H - 1)), 10); if (isNaN(y1)) return;

  const changes = App.generator.generateRect(x0, y0, x1, y1);
  if (!changes.length) { if (App.statusEl) App.statusEl.textContent = 'Autotile: no changes'; return; }

  const grouped = {};
  for (const c of changes) {
    if (!grouped[c.layer]) grouped[c.layer] = [];
    grouped[c.layer].push({ idx: c.idx, before: c.before, after: c.after });
  }
  const layersArr = Object.entries(grouped).map(([layer, changes]) => ({ layer, changes }));

  App.renderer.invalidateRange(x0, y0, x1, y1);
  if (layersArr.length === 1) {
    App.mapModel.undoStack.push({ layer: layersArr[0].layer, changes: layersArr[0].changes });
  } else {
    App.mapModel.undoStack.push({ type: 'multi', layers: layersArr });
  }
  if (App.mapModel.undoStack.length > 50) App.mapModel.undoStack.shift();
  App.mapModel.redoStack.length = 0;
  App.invalidateMarkersCache();
  App.renderer.render();
  if (App.layersPanel) for (const l of layersArr) App.layersPanel.flash(l.layer);
  if (App.statusEl) App.statusEl.textContent = 'Autotile: ' + changes.length + ' cells';
};

// CONCENTRIC RING FILL
App.fillRing = function(tx, ty, solidTile) {
  const map = App.mapModel;
  if (!map || !App.activeLayer) return false;
  const data = map.layers[App.activeLayer];
  if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return false;
  const target = data[ty * map.W + tx];
  if (!target) {
    if (App.statusEl) App.statusEl.textContent = 'Ring fill needs to start on a block';
    return false;
  }
  const anchor = App.resolveClassicAnchor();
  if (!anchor) return false;
  const terrIdx = anchor.terrIdx;
  const ts = anchor.ts;
  const isPartOfBlock = (id) => {
    if (!id) return false;
    if (id === solidTile) return true;
    const nts = App.renderer.findTileset(id);
    if (!nts || nts !== ts) return false;
    const t = nts.tiles[id - nts.firstgid];
    if (!t || !t.terrain) return false;
    return t.terrain.includes(terrIdx);
  };
  const region = new Set();
  const queue = [[tx, ty]];
  let minX = tx, maxX = tx, minY = ty, maxY = ty;
  while (queue.length) {
    const [cx, cy] = queue.pop();
    if (cx < 0 || cy < 0 || cx >= map.W || cy >= map.H) continue;
    const idx = cy * map.W + cx;
    if (region.has(idx)) continue;
    const id = data[idx];
    if (!isPartOfBlock(id)) continue;
    region.add(idx);
    if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
    queue.push([cx+1, cy], [cx-1, cy], [cx, cy+1], [cx, cy-1]);
  }
  if (region.size < 1) return false;
  const EXPAND_RADIUS = 15;
  const startX = Math.max(0, minX - EXPAND_RADIUS);
  const endX = Math.min(map.W - 1, maxX + EXPAND_RADIUS);
  const startY = Math.max(0, minY - EXPAND_RADIUS);
  const endY = Math.min(map.H - 1, maxY + EXPAND_RADIUS);
  const dist = new Uint16Array(map.W * map.H).fill(9999);
  const bfsQ = [];
  for (const idx of region) { dist[idx] = 0; bfsQ.push(idx); }
  let head = 0;
  while (head < bfsQ.length) {
    const curr = bfsQ[head++];
    const cx = curr % map.W, cy = Math.floor(curr / map.W);
    const cd = dist[curr];
    if (cd >= EXPAND_RADIUS) continue;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= map.W || ny >= map.H) continue;
      const nidx = ny * map.W + nx;
      if (cd + 1 < dist[nidx]) { dist[nidx] = cd + 1; bfsQ.push(nidx); }
    }
  }
  const tempLayer = new Uint32Array(data);
  const forcedSolid = new Uint8Array(map.W * map.H);
  const forcedEmpty = new Uint8Array(map.W * map.H);
  for (let y = startY; y <= endY; y++) for (let x = startX; x <= endX; x++) {
    const idx = y * map.W + x;
    if (dist[idx] === 9999) continue;
    if (dist[idx] % 2 === 0) { tempLayer[idx] = solidTile; forcedSolid[idx] = 1; }
    else { tempLayer[idx] = 0; forcedEmpty[idx] = 1; }
  }
  for (let y = startY - 1; y <= endY + 1; y++) for (let x = startX - 1; x <= endX + 1; x++) {
    App.paintClassicCell(x, y, anchor, tempLayer, forcedSolid, forcedEmpty);
  }
  const changes = [];
  for (let y = startY - 1; y <= endY + 1; y++) for (let x = startX - 1; x <= endX + 1; x++) {
    if (x < 0 || y < 0 || x >= map.W || y >= map.H) continue;
    const realIdx = y * map.W + x;
    const before = data[realIdx];
    const after = tempLayer[realIdx];
    if (before !== after) { data[realIdx] = after; changes.push({ idx: realIdx, before, after }); }
  }
  if (changes.length) {
    map.undoStack.push({ layer: App.activeLayer, changes });
    if (map.undoStack.length > 50) map.undoStack.shift();
    map.redoStack.length = 0;
    App.invalidateMarkersCache();
    App.renderer.invalidateRange(startX - 1, startY - 1, endX + 1, endY + 1);
    if (App.statusEl) App.statusEl.textContent = 'Pyramid expanded (' + changes.length + ' cells)';
    return true;
  }
  return false;
};

// UNDO / REDO
App.doUndo = function() {
  if (!App.mapModel || !App.mapModel.canUndo()) { if (App.statusEl) App.statusEl.textContent = 'Nothing to undo'; return; }
  const entry = App.mapModel.undo();
  App.invalidateMarkersCache();
  if (entry.type === 'resize') {
    App.renderer.invalidate();
    App.renderer.fitView();
    App.updateZoomLabels();
    if (App.layersPanel) App.layersPanel.build();
  } else App.invalidateEntry(entry);
  App.renderer.render();
  if (App.statusEl) App.statusEl.textContent = 'Undo';
};

App.doRedo = function() {
  if (!App.mapModel || !App.mapModel.canRedo()) { if (App.statusEl) App.statusEl.textContent = 'Nothing to redo'; return; }
  const entry = App.mapModel.redo();
  App.invalidateMarkersCache();
  if (entry.type === 'resize') {
    App.renderer.invalidate();
    App.renderer.fitView();
    App.updateZoomLabels();
    if (App.layersPanel) App.layersPanel.build();
  } else App.invalidateEntry(entry);
  App.renderer.render();
  if (App.statusEl) App.statusEl.textContent = 'Redo';
};

App.invalidateEntry = function(entry) {
  if (!App.renderer) return;
  if (entry.type === 'resize') return;
  const list = entry.type === 'multi'
    ? entry.layers
    : [{ layer: entry.layer, changes: entry.changes }];
  for (const le of list) {
    if (!le.changes) continue;
    for (const c of le.changes) {
      const x = c.idx % App.mapModel.W, y = Math.floor(c.idx / App.mapModel.W);
      App.renderer.chunkCache.delete(Math.floor(x/32) + ',' + Math.floor(y/32));
    }
  }
};

// MIRROR MAP
App.mirrorMap = function(mode, layersToMirror) {
  const map = App.mapModel;
  if (!map) return;
  const W = map.W, H = map.H;
  const halfW = Math.floor(W / 2), halfH = Math.floor(H / 2);
  const undoData = [];

  for (const layerName of layersToMirror) {
    const data = map.layers[layerName];
    if (!data) continue;
    const changes = [];
    const orig = new Uint32Array(data);
    const getNewTile = (id) => {
      if (!id) return 0;
      if (layerName === 'Ground') {
        const type = App.typesModel.findBySolid(id);
        if (type && type.solids && type.solids.length > 0) return App.pickWeightedSolid(type);
      }
      return id;
    };
    const apply = (tx, ty, sx, sy) => {
      const idx = ty * W + tx;
      const srcIdx = sy * W + sx;
      const before = data[idx];
      const after = getNewTile(orig[srcIdx]);
      if (before !== after) { data[idx] = after; changes.push({ idx, before, after }); }
    };
    if (mode === 'h') {
      for (let y = 0; y < H; y++) for (let x = 0; x < halfW; x++) apply(W - 1 - x, y, x, y);
    } else if (mode === 'h_inv') {
      for (let y = 0; y < H; y++) for (let x = 0; x < halfW; x++) apply(x, y, W - 1 - x, y);
    } else if (mode === 'v') {
      for (let y = 0; y < halfH; y++) for (let x = 0; x < W; x++) apply(x, H - 1 - y, x, y);
    } else if (mode === 'v_inv') {
      for (let y = 0; y < halfH; y++) for (let x = 0; x < W; x++) apply(x, y, x, H - 1 - y);
    } else if (mode === 'quad') {
      for (let y = 0; y < halfH; y++) for (let x = 0; x < halfW; x++) {
        apply(W - 1 - x, y, x, y);
        apply(x, H - 1 - y, x, y);
        apply(W - 1 - x, H - 1 - y, x, y);
      }
    }
    if (changes.length) undoData.push({ layer: layerName, changes });
  }

  if (layersToMirror.includes('Ground') && App.generator) {
    const edgeChanges = App.generator.generateRect(0, 0, W - 1, H - 1);
    const grouped = {};
    for (const c of edgeChanges) {
      if (!grouped[c.layer]) grouped[c.layer] = [];
      grouped[c.layer].push({ idx: c.idx, before: c.before, after: c.after });
    }
    for (const [layerName, changes] of Object.entries(grouped)) {
      if (!changes.length) continue;
      const existing = undoData.find(l => l.layer === layerName);
      if (existing) {
        const merged = new Map();
        for (const c of existing.changes) merged.set(c.idx, c);
        for (const c of changes) {
          const prev = merged.get(c.idx);
          if (prev) merged.set(c.idx, { idx: c.idx, before: prev.before, after: c.after });
          else merged.set(c.idx, c);
        }
        existing.changes = Array.from(merged.values());
      } else {
        undoData.push({ layer: layerName, changes });
      }
    }
  }

  const anchor = App.resolveClassicAnchor();
  if (layersToMirror.includes('Ground') && anchor) {
    const ground = map.layers.Ground;
    const classicChanges = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      const before = ground[idx];
      App.paintClassicCell(x, y, anchor, ground);
      const after = ground[idx];
      if (before !== after) classicChanges.push({ idx, before, after });
    }
    if (classicChanges.length) {
      const existing = undoData.find(l => l.layer === 'Ground');
      if (existing) {
        const mapFinal = new Map();
        for (const c of existing.changes) mapFinal.set(c.idx, c);
        for (const c of classicChanges) {
          const prev = mapFinal.get(c.idx);
          if (prev) mapFinal.set(c.idx, { idx: c.idx, before: prev.before, after: c.after });
          else mapFinal.set(c.idx, c);
        }
        existing.changes = Array.from(mapFinal.values());
      } else {
        undoData.push({ layer: 'Ground', changes: classicChanges });
      }
    }
  }

  if (undoData.length) {
    if (undoData.length === 1) map.undoStack.push({ layer: undoData[0].layer, changes: undoData[0].changes });
    else map.undoStack.push({ type: 'multi', layers: undoData });
    if (map.undoStack.length > 50) map.undoStack.shift();
    map.redoStack.length = 0;
    App.invalidateMarkersCache();
    App.renderer.invalidate();
    App.renderer.render();
    const total = undoData.reduce((s, l) => s + l.changes.length, 0);
    if (App.statusEl) App.statusEl.textContent = 'Mirror: ' + total + ' cells';
  } else {
    if (App.statusEl) App.statusEl.textContent = 'Mirror: no changes';
  }
};

// GUIDES
App.finalizeGuide = function() {
  if (!App.guideDrawStart) return;
  const s = App.guideDrawStart;
  const c = App.guideDrawCurrent || s;
  const type = App.activeGuideType;
  let helper = null;
  if (type === 'line') {
    if (s.tx === c.x && s.ty === c.y) { App.guideDrawStart = null; App.guideDrawCurrent = null; return; }
    helper = { type: 'line', x1: s.tx, y1: s.ty, x2: c.x, y2: c.y, color: '#0ff' };
  } else if (type === 'rect') {
    const x = Math.min(s.tx, c.x), y = Math.min(s.ty, c.y);
    const w = Math.abs(c.x - s.tx), h = Math.abs(c.y - s.ty);
    if (w === 0 || h === 0) { App.guideDrawStart = null; App.guideDrawCurrent = null; return; }
    helper = { type: 'rect', x, y, w, h, color: '#0ff' };
  } else if (type === 'circle') {
    const x = Math.min(s.tx, c.x), y = Math.min(s.ty, c.y);
    const w = Math.abs(c.x - s.tx), h = Math.abs(c.y - s.ty);
    if (w === 0 || h === 0) { App.guideDrawStart = null; App.guideDrawCurrent = null; return; }
    helper = { type: 'circle', x, y, w, h, color: '#0ff' };
  } else if (type === 'point') {
    helper = { type: 'point', x: s.tx, y: s.ty, color: '#0ff' };
  }
  if (helper) {
    App.helpers.push(helper);
    if (typeof App.renderGuidesList === 'function') App.renderGuidesList();
    if (App.statusEl) App.statusEl.textContent = 'Guide added: ' + helper.type + ' (' + App.helpers.length + ' total)';
  }
  App.guideDrawStart = null;
  App.guideDrawCurrent = null;
};

App.removeGuide = function(idx) {
  if (idx >= 0 && idx < App.helpers.length) {
    App.helpers.splice(idx, 1);
    if (App.selectedGuideIdx === idx) App.selectedGuideIdx = -1;
    else if (App.selectedGuideIdx > idx) App.selectedGuideIdx--;
    if (typeof App.renderGuidesList === 'function') App.renderGuidesList();
    if (App.renderer) App.renderer.render();
  }
};

App.clearGuides = function() {
  App.helpers = [];
  App.selectedGuideIdx = -1;
  if (typeof App.renderGuidesList === 'function') App.renderGuidesList();
  if (App.renderer) App.renderer.render();
  if (App.statusEl) App.statusEl.textContent = 'All guides cleared';
};

App.addGuideWithSymmetry = function(baseGuide) {
  const map = App.mapModel;
  if (!map) return;
  const W = map.W, H = map.H;
  App.helpers.push(baseGuide);
  const getMirrored = (g, mode) => {
    const ng = JSON.parse(JSON.stringify(g));
    ng.opacity = 0.5;
    ng.color = '#0a8';
    const mirrorPt = (pt) => {
      const nx = pt.x, ny = pt.y;
      if (mode === 'h') pt.x = W - 1 - nx;
      if (mode === 'v') pt.y = H - 1 - ny;
      if (mode === 'd') { pt.x = ny; pt.y = nx; }
      if (mode === 'ad') { pt.x = H - 1 - ny; pt.y = W - 1 - nx; }
    };
    if (ng.type === 'line') {
      const p1 = { x: ng.x1, y: ng.y1 }, p2 = { x: ng.x2, y: ng.y2 };
      mirrorPt(p1); mirrorPt(p2);
      ng.x1 = p1.x; ng.y1 = p1.y; ng.x2 = p2.x; ng.y2 = p2.y;
    } else if (ng.type === 'rect' || ng.type === 'circle') {
      const p1 = { x: ng.x, y: ng.y }, p2 = { x: ng.x + ng.w, y: ng.y + ng.h };
      mirrorPt(p1); mirrorPt(p2);
      ng.x = Math.min(p1.x, p2.x); ng.y = Math.min(p1.y, p2.y);
      ng.w = Math.abs(p2.x - p1.x); ng.h = Math.abs(p2.y - p1.y);
    } else if (ng.type === 'point') {
      const p = { x: ng.x, y: ng.y };
      mirrorPt(p);
      ng.x = p.x; ng.y = p.y;
    }
    return ng;
  };
  if (App.guideSymmetry.h) App.helpers.push(getMirrored(baseGuide, 'h'));
  if (App.guideSymmetry.v) App.helpers.push(getMirrored(baseGuide, 'v'));
  if (App.guideSymmetry.d) App.helpers.push(getMirrored(baseGuide, 'd'));
  if (App.guideSymmetry.ad) App.helpers.push(getMirrored(baseGuide, 'ad'));
  if (typeof App.renderGuidesList === 'function') App.renderGuidesList();
  if (App.statusEl) App.statusEl.textContent = 'Guide added +' + App.helpers.length + ' helpers';
  App.renderer.render();
};

})(window.RWEditor = window.RWEditor || {});
