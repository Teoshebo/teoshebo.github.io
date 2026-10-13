(function(RW){
'use strict';
const U = RW.Utils;

let mapModel = null;
let renderer = null;
let layersPanel = null;
let brushPanel = null;
let tilesetTabs = null;
let typesModel = new RW.TypesModel();
let typesPanel = null;
let generator = null;
let activeTypeId = null;

let activeTool = 'pan';
let activeLayer = null;
let brushGroup = [];
let brushSettings = { size: 0, shape: 'square' };

let activeClassicTerrain = null;
let classicMaskCache = new Map();
let classicEmptyCache = new Map();

let pickMode = null;

let drag = { active: false, x: 0, y: 0 };
let painting = false;
let strokeChanges = null;
let strokeBound = null;
let rectStart = null, rectCurrent = null;
let lastPaintKey = null;

let settings = RW.Storage.loadSettings();
if (settings.showMarkers == null) settings.showMarkers = false;
if (settings.markerScale == null) settings.markerScale = 1;
if (settings.canvasBg == null) settings.canvasBg = '#0a0a0a';
if (settings.lang == null) settings.lang = 'en';
RW.Storage.saveSettings(settings);

const cv = document.getElementById('cv');
const wrap = document.getElementById('wrap');
const statusEl = document.getElementById('status');
const infoEl = document.getElementById('info');
const fpsEl = document.getElementById('fps');
const zoomVal = document.getElementById('zoomVal');
const layersEl = document.getElementById('layers');
const brushListEl = document.getElementById('brushList');
const brushTotalEl = document.getElementById('brushTotal');
const brushSettingsEl = document.getElementById('brushSettings');
const classicSelectEl = document.getElementById('classicSelect');
const tsTabsListEl = document.getElementById('tsTabsList');
const tsBodyEl = document.getElementById('tsBody');
const typesBodyEl = document.getElementById('typesBody');
const bottomEl = document.getElementById('bottom');
const bottomGrabberEl = document.getElementById('bottomGrabber');
const toolsEl = document.getElementById('tools');
const mapNameEl = document.getElementById('mapName');
const pickBannerEl = document.getElementById('pickBanner');
const pickBannerTextEl = document.getElementById('pickBannerText');

// ═══════════════════════════════════════════════
// I18N
// ═══════════════════════════════════════════════
const I18N = {
  en: {
    'title': 'WebTiled',
    'btn.open': '📂 Open',
    'btn.save': '💾 Save',
    'btn.resize': '⤢ Size',
    'btn.merge': '⌘ Merge',
    'btn.exportMap': '📷 _map',
    'btn.fit': 'Fit',
    'btn.reset': '1:1',
    'btn.settings': 'Settings',
    'btn.help': 'Help',
    'tool.pan': 'PAN',
    'tool.brush': 'BRUSH',
    'tool.terrain': 'TERRAIN',
    'tool.classic': 'CLS',
    'tool.eraser': 'ERASE',
    'tool.rect': 'RECT',
    'tool.fill': 'FILL',
    'tool.picker': 'PICK',
    'tool.autotile': 'AUTO',
    'tool.undo': 'UNDO',
    'tool.redo': 'REDO',
    'status.idle': 'Load .tmx file',
    'tab.atlases': 'ATLASES',
    'tab.types': 'TYPES',
    'tab.gen': 'GENERATOR',
    'tab.v3': '3D',
    'settings.title': 'SETTINGS',
    'settings.language': 'LANGUAGE',
    'settings.appearance': 'APPEARANCE',
    'settings.canvasBg': 'Canvas background',
    'settings.markers': 'MARKERS',
    'settings.showMarkers': 'Show markers',
    'settings.markerSize': 'Marker size',
    'settings.apply': 'APPLY',
    'settings.cancel': 'CANCEL',
    'settings.close': 'Close'
  },
  ru: {
    'title': 'WebTiled',
    'btn.open': '📂 Открыть',
    'btn.save': '💾 Сохранить',
    'btn.resize': '⤢ Размер',
    'btn.merge': '⌘ Склейка',
    'btn.exportMap': '📷 _map',
    'btn.fit': 'Fit',
    'btn.reset': '1:1',
    'btn.settings': 'Настройки',
    'btn.help': 'Помощь',
    'tool.pan': 'PAN',
    'tool.brush': 'КИСТЬ',
    'tool.terrain': 'ЛАНДШАФТ',
    'tool.classic': 'CLS',
    'tool.eraser': 'ЛАСТИК',
    'tool.rect': 'ПРЯМОУГ',
    'tool.fill': 'ЗАЛИВКА',
    'tool.picker': 'ПИПЕТКА',
    'tool.autotile': 'АВТО',
    'tool.undo': 'ОТМЕНА',
    'tool.redo': 'ПОВТОР',
    'status.idle': 'Загрузи .tmx файл',
    'tab.atlases': 'АТЛАСЫ',
    'tab.types': 'ТИПЫ',
    'tab.gen': 'ГЕНЕРАТОР',
    'tab.v3': '3D',
    'settings.title': 'НАСТРОЙКИ',
    'settings.language': 'ЯЗЫК',
    'settings.appearance': 'ВНЕШНИЙ ВИД',
    'settings.canvasBg': 'Фон канваса',
    'settings.markers': 'МАРКЕРЫ',
    'settings.showMarkers': 'Показывать маркеры',
    'settings.markerSize': 'Размер маркеров',
    'settings.apply': 'ПРИМЕНИТЬ',
    'settings.cancel': 'ОТМЕНА',
    'settings.close': 'Закрыть'
  }
};

let currentLang = settings.lang || 'en';

RW.I18N = {
  get lang() { return currentLang; },
  t(key) {
    const dict = I18N[currentLang] || I18N.en;
    return dict[key] != null ? dict[key] : (I18N.en[key] != null ? I18N.en[key] : key);
  },
  apply() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = this.t(key);
    });
    const titleEl = document.querySelector('title');
    if (titleEl) titleEl.textContent = this.t('title');
  },
  set(lang) {
    if (!I18N[lang]) return;
    currentLang = lang;
    settings.lang = lang;
    RW.Storage.saveSettings(settings);
    this.apply();
  }
};

// ─── Tools ───
const TOOLS = [
  { id: 'pan', ic: '✋', i18n: 'tool.pan', title: 'Pan (P)' },
  { sep: true },
  { id: 'brush', ic: '🖌', i18n: 'tool.brush', title: 'Brush (B)' },
  { id: 'terrain', ic: '🌍', i18n: 'tool.terrain', title: 'Terrain (T)' },
  { id: 'classic', ic: '▦', i18n: 'tool.classic', title: 'Classic autotile (C)' },
  { id: 'eraser', ic: '🧽', i18n: 'tool.eraser', title: 'Eraser (E)' },
  { id: 'rect', ic: '▭', i18n: 'tool.rect', title: 'Rect (R)' },
  { id: 'fill', ic: '🪣', i18n: 'tool.fill', title: 'Fill (F)' },
  { id: 'picker', ic: '💧', i18n: 'tool.picker', title: 'Picker (I)' },
  { sep: true },
  { id: 'autotile', ic: '⚙', i18n: 'tool.autotile', title: 'Autotile area' },
  { sep: true },
  { id: 'undo', ic: '↶', i18n: 'tool.undo', title: 'Undo (Ctrl+Z)' },
  { id: 'redo', ic: '↷', i18n: 'tool.redo', title: 'Redo (Ctrl+Y)' }
];

function buildTools() {
  toolsEl.innerHTML = '';
  for (const t of TOOLS) {
    if (t.sep) {
      const sep = document.createElement('div');
      sep.className = 'sep';
      toolsEl.appendChild(sep);
      continue;
    }
    const el = document.createElement('div');
    el.className = 'tool' + (t.id === activeTool ? ' active' : '');
    el.dataset.tool = t.id;
    el.title = t.title || '';
    el.innerHTML = '<span class="ic">' + t.ic + '</span>' +
      '<span data-i18n="' + t.i18n + '">' + RW.I18N.t(t.i18n) + '</span>';
    el.addEventListener('click', () => handleToolClick(t.id));
    toolsEl.appendChild(el);
  }
}

function handleToolClick(id) {
  if (pickMode) endPick();
  if (id === 'undo') { doUndo(); return; }
  if (id === 'redo') { doRedo(); return; }
  if (id === 'autotile') { runAutotileDialog(); return; }
  activeTool = id;
  document.querySelectorAll('#tools .tool').forEach(el => {
    el.classList.toggle('active', el.dataset.tool === id);
  });
  cv.classList.toggle('crosshair', id !== 'pan');
  settings.activeTool = id;
  RW.Storage.saveSettings(settings);
  if (renderer) renderer.render();
}

// ─── Pick mode ───
function ensureAtlasesVisible() {
  document.getElementById('btnAtlasesTab').classList.add('active');
  bottomEl.classList.remove('atlases-hidden');
}

function startPick(mode) {
  pickMode = mode;
  ensureAtlasesVisible();
  let label;
  if (mode.kind === 'edge') label = 'Pick tile for ' + mode.role;
  else if (mode.kind === 'solid') label = 'Pick solid tile';
  pickBannerTextEl.textContent = label + ' · click tile · click again to clear';
  pickBannerEl.classList.remove('hidden');
  if (typesPanel) typesPanel.build();
  if (tilesetTabs) tilesetTabs.build();
  statusEl.textContent = label;
}

function endPick() {
  pickMode = null;
  pickBannerEl.classList.add('hidden');
  if (typesPanel) typesPanel.build();
  if (tilesetTabs) tilesetTabs.build();
  statusEl.textContent = 'Pick cancelled';
}

function applyPick(globalID) {
  if (!pickMode) return;
  const t = typesModel.get(pickMode.typeId);
  if (!t) { endPick(); return; }
  if (pickMode.kind === 'edge') {
    if (t.edges[pickMode.role] === globalID) t.edges[pickMode.role] = 0;
    else t.edges[pickMode.role] = globalID;
  } else if (pickMode.kind === 'solid') {
    const idx = t.solids.findIndex(s => s.tileID === globalID);
    if (idx >= 0) t.solids.splice(idx, 1);
    else t.solids.push({ tileID: globalID, weight: 1 });
  }
  if (typesPanel) typesPanel.build();
  if (tilesetTabs) tilesetTabs.build();
  statusEl.textContent = 'OK · #' + globalID;
}

// ─── Brush helpers ───
function addToBrush(tileID, add) {
  if (tileID === 0 && !add) return;
  if (!add) brushGroup = [{ tileID, weight: 1 }];
  else {
    const ex = brushGroup.find(b => b.tileID === tileID);
    if (ex) ex.weight = 1;
    else brushGroup.push({ tileID, weight: 1 });
  }
  if (brushPanel) brushPanel.build();
  if (tilesetTabs) tilesetTabs.refreshSelection();
}

function addEmptyToBrush() {
  const ex = brushGroup.find(b => b.tileID === 0);
  if (ex) ex.weight = 1;
  else brushGroup.push({ tileID: 0, weight: 1 });
  if (brushPanel) brushPanel.build();
  if (tilesetTabs) tilesetTabs.refreshSelection();
}

function pickWeightedTile() {
  if (!brushGroup.length) return 0;
  const total = brushGroup.reduce((s, b) => s + b.weight, 0);
  if (total <= 0) return brushGroup[0].tileID;
  let r = Math.random() * total;
  for (const b of brushGroup) {
    r -= b.weight;
    if (r <= 0) return b.tileID;
  }
  return brushGroup[brushGroup.length - 1].tileID;
}

function pickWeightedSolid(type) {
  if (!type || !type.solids || !type.solids.length) return 0;
  const total = type.solids.reduce((s, x) => s + (x.weight || 0), 0);
  if (total <= 0) return type.solids[0].tileID;
  let r = Math.random() * total;
  for (const s of type.solids) {
    r -= (s.weight || 0);
    if (r <= 0) return s.tileID;
  }
  return type.solids[type.solids.length - 1].tileID;
}

function brushCells(cx, cy) {
  const size = brushSettings.size || 0;
  const shape = brushSettings.shape;
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
}

// ─── Painting ───
function ensureStrokeChanges() { if (!strokeChanges) strokeChanges = new Map(); }

function recordChange(layer, idx, before, after) {
  ensureStrokeChanges();
  if (!strokeChanges.has(layer)) strokeChanges.set(layer, new Map());
  const m = strokeChanges.get(layer);
  if (!m.has(idx)) m.set(idx, { before, after });
  else m.get(idx).after = after;
}

function expandStrokeBound(tx, ty) {
  if (!strokeBound) strokeBound = { x0: tx, y0: ty, x1: tx, y1: ty };
  else {
    if (tx < strokeBound.x0) strokeBound.x0 = tx;
    if (ty < strokeBound.y0) strokeBound.y0 = ty;
    if (tx > strokeBound.x1) strokeBound.x1 = tx;
    if (ty > strokeBound.y1) strokeBound.y1 = ty;
  }
}

function paintBrushCells(cx, cy, tileFn) {
  const map = mapModel;
  if (!activeLayer) return;
  const data = map.layers[activeLayer];
  const cells = brushCells(cx, cy);
  for (const cell of cells) {
    const tx = cell[0], ty = cell[1];
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) continue;
    const idx = ty * map.W + tx;
    const tileValue = tileFn();
    const before = data[idx];
    if (before === tileValue) continue;
    data[idx] = tileValue;
    recordChange(activeLayer, idx, before, tileValue);
    renderer.invalidateCell(tx, ty);
    expandStrokeBound(tx, ty);
  }
}

function paintTerrainCells(cx, cy) {
  const map = mapModel;
  if (!activeLayer) return;
  const type = typesModel.get(activeTypeId);
  if (!type || !type.solids.length) {
    statusEl.textContent = 'No type selected or no solids';
    return;
  }
  const data = map.layers[activeLayer];
  const cells = brushCells(cx, cy);
  for (const cell of cells) {
    const tx = cell[0], ty = cell[1];
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) continue;
    const idx = ty * map.W + tx;
    const before = data[idx];
    const after = pickWeightedSolid(type);
    if (before === after) continue;
    data[idx] = after;
    recordChange(activeLayer, idx, before, after);
    renderer.invalidateCell(tx, ty);
    expandStrokeBound(tx, ty);
  }
}

// ─── Classic autotile (без изменений) ───
function buildClassicMaskIndex(tsIdx) {
  const cached = classicMaskCache.get(tsIdx);
  if (cached) return cached;
  const ts = mapModel.tilesets[tsIdx];
  const index = new Map();
  for (const idStr in ts.tiles) {
    const id = parseInt(idStr, 10);
    const t = ts.tiles[id];
    if (!t.terrain) continue;
    const key = t.terrain.join(',');
    if (!index.has(key)) index.set(key, id + ts.firstgid);
  }
  classicMaskCache.set(tsIdx, index);
  return index;
}
function findEmptyValue(tsIdx, targetTerr) {
  const key = tsIdx + ':' + targetTerr;
  if (classicEmptyCache.has(key)) return classicEmptyCache.get(key);
  const ts = mapModel.tilesets[tsIdx];
  const counts = new Map();
  for (const idStr in ts.tiles) {
    const t = ts.tiles[idStr];
    if (!t.terrain) continue;
    const hasTarget = t.terrain.some(v => v === targetTerr);
    if (!hasTarget) continue;
    for (const v of t.terrain) {
      if (v === targetTerr) continue;
      counts.set(v, (counts.get(v) || 0) + 1);
    }
  }
  let best = -1, bestCount = 0;
  for (const kv of counts) {
    if (kv[1] > bestCount) { best = kv[0]; bestCount = kv[1]; }
  }
  classicEmptyCache.set(key, best);
  return best;
}
function cellHasCorner(tx, ty, cornerIdx, tsIdx, targetTerr) {
  const map = mapModel;
  if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return false;
  const id = map.layers[activeLayer][ty * map.W + tx];
  if (!id) return false;
  const ts = map.tilesets[tsIdx];
  const nts = renderer.findTileset(id);
  if (!nts || nts !== ts) return false;
  const t = nts.tiles[id - nts.firstgid];
  if (!t || !t.terrain) return false;
  return t.terrain[cornerIdx] === targetTerr;
}
function resolveClassicMask(tx, ty, tsIdx, targetTerr, emptyValue) {
  const tlOK = cellHasCorner(tx-1, ty-1, 3, tsIdx, targetTerr) &&
               cellHasCorner(tx, ty-1, 2, tsIdx, targetTerr) &&
               cellHasCorner(tx-1, ty, 1, tsIdx, targetTerr);
  const trOK = cellHasCorner(tx, ty-1, 3, tsIdx, targetTerr) &&
               cellHasCorner(tx+1, ty-1, 2, tsIdx, targetTerr) &&
               cellHasCorner(tx+1, ty, 0, tsIdx, targetTerr);
  const blOK = cellHasCorner(tx-1, ty, 3, tsIdx, targetTerr) &&
               cellHasCorner(tx-1, ty+1, 1, tsIdx, targetTerr) &&
               cellHasCorner(tx, ty+1, 0, tsIdx, targetTerr);
  const brOK = cellHasCorner(tx+1, ty, 2, tsIdx, targetTerr) &&
               cellHasCorner(tx+1, ty+1, 0, tsIdx, targetTerr) &&
               cellHasCorner(tx, ty+1, 1, tsIdx, targetTerr);
  return [
    tlOK ? targetTerr : emptyValue,
    trOK ? targetTerr : emptyValue,
    blOK ? targetTerr : emptyValue,
    brOK ? targetTerr : emptyValue
  ];
}
function combinations(arr, k) {
  const result = [];
  function rec(start, cur) {
    if (cur.length === k) { result.push(cur.slice()); return; }
    for (let i = start; i < arr.length; i++) {
      cur.push(arr[i]); rec(i + 1, cur); cur.pop();
    }
  }
  rec(0, []);
  return result;
}
function paintClassicCell(tx, ty) {
  if (!activeClassicTerrain) return;
  const map = mapModel;
  if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return;
  if (!activeLayer) return;
  const tsIdx = activeClassicTerrain.tsIdx;
  const terrIdx = activeClassicTerrain.terrIdx;
  const ts = map.tilesets[tsIdx];
  if (!ts) return;
  const emptyValue = findEmptyValue(tsIdx, terrIdx);
  const mask = resolveClassicMask(tx, ty, tsIdx, terrIdx, emptyValue);
  const index = buildClassicMaskIndex(tsIdx);
  let tileID = index.get(mask.join(','));
  if (tileID === undefined) {
    const emptyPos = [];
    for (let i = 0; i < 4; i++) if (mask[i] === emptyValue) emptyPos.push(i);
    outer:
    for (let numFill = emptyPos.length; numFill >= 1; numFill--) {
      const combos = combinations(emptyPos, numFill);
      for (const combo of combos) {
        const test = mask.slice();
        for (const i of combo) test[i] = terrIdx;
        tileID = index.get(test.join(','));
        if (tileID !== undefined) break outer;
      }
    }
  }
  if (tileID === undefined) return;
  const idx = ty * map.W + tx;
  const before = map.layers[activeLayer][idx];
  if (before === tileID) return;
  map.layers[activeLayer][idx] = tileID;
  recordChange(activeLayer, idx, before, tileID);
  renderer.invalidateCell(tx, ty);
}
function paintClassicCells(cx, cy) {
  const map = mapModel;
  if (!map || !activeLayer || !activeClassicTerrain) return;
  const tsIdx = activeClassicTerrain.tsIdx;
  const terrIdx = activeClassicTerrain.terrIdx;
  const ts = map.tilesets[tsIdx];
  if (!ts) return;
  const solidLocal = ts.terrainTypes[terrIdx] ? ts.terrainTypes[terrIdx].tile : 0;
  const solidTile = solidLocal + ts.firstgid;
  const cells = brushCells(cx, cy);
  const data = map.layers[activeLayer];
  for (const cell of cells) {
    const tx = cell[0], ty = cell[1];
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) continue;
    const idx = ty * map.W + tx;
    const before = data[idx];
    if (before === solidTile) continue;
    data[idx] = solidTile;
    recordChange(activeLayer, idx, before, solidTile);
    renderer.invalidateCell(tx, ty);
    expandStrokeBound(tx, ty);
  }
  for (const cell of cells) paintClassicCell(cell[0], cell[1]);
}
function finalizeClassicForStroke() {
  if (!strokeChanges || !activeClassicTerrain) return;
  const m = strokeChanges.get(activeLayer);
  if (!m || !m.size) return;
  const tsIdx = activeClassicTerrain.tsIdx;
  const terrIdx = activeClassicTerrain.terrIdx;
  const ts = map.tilesets[tsIdx];
  if (!ts) return;
  const solidLocal = ts.terrainTypes[terrIdx] ? ts.terrainTypes[terrIdx].tile : 0;
  const solidTile = solidLocal + ts.firstgid;
  const data = map.layers[activeLayer];
  const paintedSet = new Set(m.keys());
  for (const idx of paintedSet) {
    const before = data[idx];
    if (before === solidTile) continue;
    data[idx] = solidTile;
    recordChange(activeLayer, idx, before, solidTile);
    const x = idx % mapModel.W;
    const y = Math.floor(idx / mapModel.W);
    renderer.invalidateCell(x, y);
  }
  const lookup = new Set();
  for (const idx of paintedSet) {
    const x = idx % mapModel.W;
    const y = Math.floor(idx / mapModel.W);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= mapModel.W || ny >= mapModel.H) continue;
        lookup.add(ny * mapModel.W + nx);
      }
    }
  }
  for (const idx of lookup) {
    const x = idx % mapModel.W;
    const y = Math.floor(idx / mapModel.W);
    paintClassicCell(x, y);
  }
}
function rebuildClassicSelect() {
  const map = mapModel;
  classicSelectEl.innerHTML = '';
  if (!map) return;
  let hasAny = false;
  map.tilesets.forEach((ts, ti) => {
    if (!ts.terrainTypes.length) return;
    const group = document.createElement('optgroup');
    group.label = ts.name;
    ts.terrainTypes.forEach((tt, terri) => {
      hasAny = true;
      const opt = document.createElement('option');
      opt.value = ti + ':' + terri;
      opt.textContent = tt.name + '  · tile ' + tt.tile;
      if (activeClassicTerrain && activeClassicTerrain.tsIdx === ti
          && activeClassicTerrain.terrIdx === terri) {
        opt.selected = true;
      }
      group.appendChild(opt);
    });
    classicSelectEl.appendChild(group);
  });
  if (!hasAny) {
    const opt = document.createElement('option');
    opt.textContent = '— no terraintypes —';
    opt.disabled = true;
    classicSelectEl.appendChild(opt);
  }
}
classicSelectEl.addEventListener('change', () => {
  const v = classicSelectEl.value;
  if (!v) { activeClassicTerrain = null; return; }
  const parts = v.split(':');
  activeClassicTerrain = {
    tsIdx: parseInt(parts[0], 10),
    terrIdx: parseInt(parts[1], 10)
  };
  const ts = mapModel.tilesets[activeClassicTerrain.tsIdx];
  const tt = ts.terrainTypes[activeClassicTerrain.terrIdx];
  const emptyVal = findEmptyValue(activeClassicTerrain.tsIdx, activeClassicTerrain.terrIdx);
  const masksInTs = buildClassicMaskIndex(activeClassicTerrain.tsIdx).size;
  statusEl.textContent = 'Classic: ' + ts.name + ' · ' + tt.name
    + '  (empty=' + emptyVal + ', masks=' + masksInTs + ')';
});

function finalizeAutotileForStroke() {
  if (!generator || !strokeBound) return;
  const b = strokeBound;
  const pad = 1 + (brushSettings.size || 0);
  const changes = generator.generateRect(b.x0 - pad, b.y0 - pad, b.x1 + pad, b.y1 + pad);
  if (!changes.length) return;
  const data = mapModel.layers.Items0;
  if (!data) return;
  for (const c of changes) {
    data[c.idx] = c.after;
    const x = c.idx % mapModel.W;
    const y = Math.floor(c.idx / mapModel.W);
    renderer.invalidateCell(x, y);
    recordChange('Items0', c.idx, c.before, c.after);
  }
}

function endStroke() {
  if (!strokeChanges || !strokeChanges.size) {
    strokeChanges = null;
    strokeBound = null;
    return;
  }
  const map = mapModel;
  const layers = [];
  let totalChanged = 0;
  for (const kv of strokeChanges) {
    const layer = kv[0];
    const m = kv[1];
    const real = [];
    for (const kv2 of m) {
      const idx = kv2[0];
      const c = kv2[1];
      if (c.before !== c.after) real.push({ idx, before: c.before, after: c.after });
    }
    if (!real.length) continue;
    layers.push({ layer, changes: real });
    totalChanged += real.length;
  }
  if (layers.length) {
    map.undoStack.push({ type: 'multi', layers });
    if (map.undoStack.length > 50) map.undoStack.shift();
    map.redoStack.length = 0;
    statusEl.textContent = totalChanged + ' cells changed';
  }
  invalidateMarkersCache();
  strokeChanges = null;
  strokeBound = null;
  lastPaintKey = null;
}

function floodFill(tx, ty, newTile) {
  const map = mapModel;
  if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return;
  if (!activeLayer) return;
  const data = map.layers[activeLayer];
  const target = data[ty * map.W + tx];
  if (target === newTile) return;
  const stack = [[tx, ty]];
  const seen = new Set();
  const changes = [];
  while (stack.length) {
    const p = stack.pop();
    const x = p[0], y = p[1];
    if (x < 0 || y < 0 || x >= map.W || y >= map.H) continue;
    const idx = y * map.W + x;
    if (seen.has(idx) || data[idx] !== target) continue;
    seen.add(idx);
    changes.push({ idx, before: target, after: newTile });
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
  renderer.invalidateRange(minX, minY, maxX, maxY);
  map.undoStack.push({ layer: activeLayer, changes });
  if (map.undoStack.length > 50) map.undoStack.shift();
  map.redoStack.length = 0;
  invalidateMarkersCache();
  statusEl.textContent = 'Fill: ' + changes.length + ' cells';
}

function runFloodDominant() {
  if (!mapModel || !generator) { statusEl.textContent = 'No map'; return; }
  if (!mapModel.layers.Ground) { statusEl.textContent = 'No Ground layer'; return; }
  const changes = generator.floodDominant(0, 0, mapModel.W - 1, mapModel.H - 1);
  if (!changes.length) { statusEl.textContent = 'FLOOD: nothing to change'; return; }
  const data = mapModel.layers.Ground;
  for (const c of changes) data[c.idx] = c.after;
  renderer.invalidate();
  mapModel.undoStack.push({ layer: 'Ground', changes });
  if (mapModel.undoStack.length > 50) mapModel.undoStack.shift();
  mapModel.redoStack.length = 0;
  invalidateMarkersCache();
  renderer.render();
  statusEl.textContent = 'FLOOD: ' + changes.length + ' cells recolored';
}

function applyRect(x0, y0, x1, y1, tileFn) {
  const map = mapModel;
  if (!activeLayer) return;
  const minX = Math.max(0, Math.min(x0, x1));
  const maxX = Math.min(map.W - 1, Math.max(x0, x1));
  const minY = Math.max(0, Math.min(y0, y1));
  const maxY = Math.min(map.H - 1, Math.max(y0, y1));
  const data = map.layers[activeLayer];
  const changes = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = y * map.W + x;
      const before = data[idx];
      const tileValue = tileFn();
      if (before === tileValue) continue;
      data[idx] = tileValue;
      changes.push({ idx, before, after: tileValue });
    }
  }
  if (!changes.length) return;
  renderer.invalidateRange(minX, minY, maxX, maxY);
  map.undoStack.push({ layer: activeLayer, changes });
  if (map.undoStack.length > 50) map.undoStack.shift();
  map.redoStack.length = 0;
  invalidateMarkersCache();
  statusEl.textContent = 'Rect: ' + changes.length + ' cells';
}

function pickerAt(tx, ty) {
  const map = mapModel;
  if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return;
  for (let i = map.layerOrder.length - 1; i >= 0; i--) {
    const name = map.layerOrder[i];
    if (!renderer.isLayerVisible(name)) continue;
    const id = map.layers[name][ty * map.W + tx];
    if (id) {
      activeLayer = name;
      addToBrush(id, false);
      if (layersPanel) layersPanel.build();
      statusEl.textContent = 'Picker: ' + name + ' #' + id;
      return;
    }
  }
  statusEl.textContent = 'Picker: empty';
}

function runAutotileDialog() {
  if (!mapModel || !generator) return;
  const x0 = parseInt(prompt('x0:', '0'), 10);
  if (isNaN(x0)) return;
  const y0 = parseInt(prompt('y0:', '0'), 10);
  if (isNaN(y0)) return;
  const x1 = parseInt(prompt('x1:', String(mapModel.W - 1)), 10);
  if (isNaN(x1)) return;
  const y1 = parseInt(prompt('y1:', String(mapModel.H - 1)), 10);
  if (isNaN(y1)) return;

  const changes = generator.generateRect(x0, y0, x1, y1);
  if (!changes.length) { statusEl.textContent = 'Autotile: no changes'; return; }
  const data = mapModel.layers.Items0;
  if (!data) { statusEl.textContent = 'No Items0 layer'; return; }
  for (const c of changes) data[c.idx] = c.after;
  renderer.invalidateRange(x0, y0, x1, y1);
  mapModel.undoStack.push({ layer: 'Items0', changes });
  if (mapModel.undoStack.length > 50) mapModel.undoStack.shift();
  mapModel.redoStack.length = 0;
  invalidateMarkersCache();
  renderer.render();
  statusEl.textContent = 'Autotile: ' + changes.length + ' cells';
}

function doUndo() {
  if (!mapModel || !mapModel.canUndo()) { statusEl.textContent = 'Nothing to undo'; return; }
  const entry = mapModel.undo();
  invalidateMarkersCache();
  if (entry.type === 'resize') {
    renderer.invalidate();
    renderer.fitView();
    zoomVal.textContent = renderer.view.zoom.toFixed(2);
    if (layersPanel) layersPanel.build();
  } else {
    invalidateEntry(entry);
  }
  renderer.render();
  statusEl.textContent = 'Undo';
}
function doRedo() {
  if (!mapModel || !mapModel.canRedo()) { statusEl.textContent = 'Nothing to redo'; return; }
  const entry = mapModel.redo();
  invalidateMarkersCache();
  if (entry.type === 'resize') {
    renderer.invalidate();
    renderer.fitView();
    zoomVal.textContent = renderer.view.zoom.toFixed(2);
    if (layersPanel) layersPanel.build();
  } else {
    invalidateEntry(entry);
  }
  renderer.render();
  statusEl.textContent = 'Redo';
}
function invalidateEntry(entry) {
  if (!renderer) return;
  if (entry.type === 'resize') return;
  let list;
  if (entry.type === 'multi') list = entry.layers;
  else list = [{ layer: entry.layer, changes: entry.changes }];
  for (const le of list) {
    if (!le.changes) continue;
    for (const c of le.changes) {
      const x = c.idx % mapModel.W;
      const y = Math.floor(c.idx / mapModel.W);
      const key = Math.floor(x / 32) + ',' + Math.floor(y / 32);
      renderer.chunkCache.delete(key);
    }
  }
}

// ─── Mouse ───
cv.addEventListener('mousedown', (e) => {
  if (e.button !== 0 && e.button !== 1) return;
  if (activeTool === 'pan' || e.button === 1) {
    drag.active = true; drag.x = e.clientX; drag.y = e.clientY;
    cv.classList.add('drag');
    return;
  }
  if (!mapModel) return;
  if (!activeLayer) { statusEl.textContent = 'Select active layer'; return; }

  const pos = renderer.screenToTile(e.clientX, e.clientY);
  const tx = pos.tx, ty = pos.ty;

  if (activeTool === 'brush') {
    if (!brushGroup.length) { statusEl.textContent = 'Brush empty'; return; }
    painting = true; strokeChanges = null;
    paintBrushCells(tx, ty, pickWeightedTile);
    lastPaintKey = tx + ',' + ty;
    renderer.render();
  } else if (activeTool === 'terrain') {
    painting = true; strokeChanges = null;
    paintTerrainCells(tx, ty);
    lastPaintKey = tx + ',' + ty;
    renderer.render();
  } else if (activeTool === 'classic') {
    if (!activeClassicTerrain) { statusEl.textContent = 'Classic: select terrain in BRUSH panel'; return; }
    painting = true; strokeChanges = null;
    paintClassicCells(tx, ty);
    lastPaintKey = tx + ',' + ty;
    renderer.render();
  } else if (activeTool === 'eraser') {
    painting = true; strokeChanges = null;
    paintBrushCells(tx, ty, () => 0);
    lastPaintKey = tx + ',' + ty;
    renderer.render();
  } else if (activeTool === 'rect') {
    painting = true;
    rectStart = { x: tx, y: ty }; rectCurrent = { x: tx, y: ty };
    renderer.rectStart = rectStart; renderer.rectCurrent = rectCurrent;
    renderer.render();
  } else if (activeTool === 'fill') {
    if (!brushGroup.length) { statusEl.textContent = 'Brush empty'; return; }
    floodFill(tx, ty, pickWeightedTile());
    renderer.render();
  } else if (activeTool === 'picker') {
    pickerAt(tx, ty);
    renderer.render();
  }
});

window.addEventListener('mousemove', (e) => {
  if (drag.active) {
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    renderer.view.x += dx; renderer.view.y += dy;
    renderer.render();
    return;
  }
  if (!mapModel) { infoEl.textContent = '—'; return; }
  const pos = renderer.screenToTile(e.clientX, e.clientY);
  renderer.hoverTile = { tx: pos.tx, ty: pos.ty };

  const leftHeld = (e.buttons & 1) !== 0;
  if (painting && leftHeld) {
    const key = pos.tx + ',' + pos.ty;
    if (key !== lastPaintKey) {
      lastPaintKey = key;
      if (activeTool === 'brush' || activeTool === 'eraser') {
        const fn = activeTool === 'eraser' ? () => 0 : pickWeightedTile;
        paintBrushCells(pos.tx, pos.ty, fn);
      } else if (activeTool === 'terrain') {
        paintTerrainCells(pos.tx, pos.ty);
      } else if (activeTool === 'classic') {
        paintClassicCells(pos.tx, pos.ty);
      } else if (activeTool === 'rect' && rectStart) {
        rectCurrent = { x: pos.tx, y: pos.ty };
        renderer.rectCurrent = rectCurrent;
      }
    }
  } else if (painting && !leftHeld) {
    painting = false;
    if (activeTool === 'terrain') finalizeAutotileForStroke();
    if (activeTool === 'classic') finalizeClassicForStroke();
    endStroke();
    renderer.rectStart = null;
    renderer.rectCurrent = null;
  }
  renderer.render();
  updateInfo(pos.tx, pos.ty);
});

window.addEventListener('mouseup', () => {
  if (drag.active) { drag.active = false; cv.classList.remove('drag'); return; }
  if (painting) {
    if (activeTool === 'rect' && rectStart && rectCurrent && brushGroup.length) {
      applyRect(rectStart.x, rectStart.y, rectCurrent.x, rectCurrent.y, pickWeightedTile);
    } else {
      if (activeTool === 'terrain') finalizeAutotileForStroke();
      if (activeTool === 'classic') finalizeClassicForStroke();
      endStroke();
    }
    painting = false;
    rectStart = null; rectCurrent = null;
    renderer.rectStart = null; renderer.rectCurrent = null;
    renderer.render();
  }
});

cv.addEventListener('mouseleave', () => {
  renderer.hoverTile = null;
  renderer.render();
});

function updateInfo(tx, ty) {
  if (!mapModel) { infoEl.textContent = '—'; return; }
  if (tx < 0 || ty < 0 || tx >= mapModel.W || ty >= mapModel.H) {
    infoEl.textContent = '—';
    return;
  }
  let out = 'Tile: <b>' + tx + ', ' + ty + '</b>';
  for (const name of mapModel.layerOrder) {
    const id = mapModel.layers[name][ty * mapModel.W + tx];
    if (id) out += ' · ' + name + '=<b>' + id + '</b>';
  }
  infoEl.innerHTML = out;
}

wrap.addEventListener('wheel', (e) => {
  if (!mapModel) return;
  e.preventDefault();
  const r = wrap.getBoundingClientRect();
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  renderer.zoomAt(e.clientX - r.left, e.clientY - r.top, factor);
  zoomVal.textContent = renderer.view.zoom.toFixed(2);
}, { passive: false });

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === 'Escape') {
    if (pickMode) { endPick(); return; }
  }
  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z' || e.key === 'Z') { e.preventDefault(); doUndo(); return; }
    if (e.key === 'y' || e.key === 'Y') { e.preventDefault(); doRedo(); return; }
    if (e.key === 's' || e.key === 'S') { e.preventDefault(); saveMap(); return; }
  }
  const hk = { b:'brush', e:'eraser', r:'rect', f:'fill', i:'picker', p:'pan',
               t:'terrain', c:'classic' };
  const t = hk[e.key.toLowerCase()];
  if (t) handleToolClick(t);
});

document.getElementById('btnOpen').addEventListener('click', () => {
  document.getElementById('fileInput').click();
});

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  statusEl.textContent = 'Parsing...';
  try {
    const text = await file.text();
    const parsed = RW.TMX.parse(text);
    await RW.TMX.loadImages(parsed);
    await initFromParsed(parsed, file.name);
    statusEl.textContent = 'OK ' + mapModel.W + '×' + mapModel.H +
      ' · tilesets: ' + mapModel.tilesets.length +
      ' · layers: ' + mapModel.layerOrder.length;
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error: ' + err.message;
  }
  e.target.value = '';
});

async function initFromParsed(parsed, filename) {
  mapModel = new RW.MapModel(parsed);
  _markersCache = null;

  renderer = new RW.Renderer(cv, () => mapModel);
  renderer.layerVisibility = {};
  for (const n of mapModel.layerOrder) renderer.layerVisibility[n] = true;
  renderer.onFps = (fps, chunks) => {
    fpsEl.textContent = fps + ' fps · chunks ' + chunks;
  };
  renderer.getMarkers = () => getMarkersCached();
  renderer.showMarkers = !!settings.showMarkers;
  renderer.markerScale = settings.markerScale || 1;
  renderer.setBg(settings.canvasBg || '#0a0a0a');

  activeLayer = mapModel.layerOrder[0] || null;
  brushGroup = [];
  pickMode = null;
  pickBannerEl.classList.add('hidden');

  classicMaskCache.clear();
  classicEmptyCache.clear();
  activeClassicTerrain = null;

  typesModel = new RW.TypesModel();
  if (parsed.typesConfigRaw) {
    try { typesModel.fromJSON(JSON.parse(parsed.typesConfigRaw)); }
    catch (err) { console.warn('types config parse fail', err); }
  }
  activeTypeId = typesModel.types.length ? typesModel.types[0].id : null;

  generator = new RW.Generator(
    () => mapModel,
    (tileID) => typesModel.findBySolid(tileID)
  );

  layersPanel = new RW.LayersPanel(layersEl, {
    getMap: () => mapModel,
    getRenderer: () => renderer,
    getActiveLayer: () => activeLayer,
    setActiveLayer: (n) => { activeLayer = n; }
  });

  brushPanel = new RW.BrushPanel(brushListEl, brushTotalEl, brushSettingsEl, {
    getBrush: () => brushGroup,
    getRenderer: () => renderer,
    getBrushSettings: () => brushSettings,
    onBrushChanged: () => { if (tilesetTabs) tilesetTabs.refreshSelection(); },
    onBrushSettingsChanged: () => { /* */ }
  });

  tilesetTabs = new RW.TilesetTabs(tsTabsListEl, tsBodyEl, bottomEl, {
    getMap: () => mapModel,
    getRenderer: () => renderer,
    getBrush: () => brushGroup,
    getModel: () => typesModel,
    getPickMode: () => pickMode,
    addToBrush: (id, add) => addToBrush(id, add),
    applyPick: (id) => applyPick(id),
    onAddTileset: () => document.getElementById('tilesetInput').click()
  });

  typesPanel = new RW.TypesPanel(typesBodyEl, {
    getModel: () => typesModel,
    getActiveType: () => activeTypeId,
    setActiveType: (id) => { activeTypeId = id; },
    getPickMode: () => pickMode,
    startPick: (mode) => startPick(mode),
    endPick: () => endPick(),
    findTileset: (id) => renderer.findTileset(id),
    onChanged: () => { typesPanel.build(); },
    onImportMiniTNS: () => startMiniTNSImport(),
    onOpenLibrary: () => openMiniTNSLibrary()
  });

  layersPanel.build();
  brushPanel.build();
  tilesetTabs.build();
  typesPanel.build();
  buildTools();
  rebuildClassicSelect();

  mapNameEl.value = filename || parsed._restoredFilename || 'map.tmx';

  renderer.fitView();
  zoomVal.textContent = renderer.view.zoom.toFixed(2);

  if (RW.HMApp) {
    RW.HMApp.onMapReady({
      getMap: () => mapModel,
      getTypesModel: () => typesModel,
      getGenerator: () => generator,
      getRenderer: () => renderer,
      markDirty: () => {}
    });
  }
}

document.getElementById('btnSave').addEventListener('click', saveMap);
function saveMap() {
  if (!mapModel) { statusEl.textContent = 'No map'; return; }
  try {
    const xml = RW.TMX.save(mapModel, typesModel);
    let filename = (mapNameEl.value || '').trim() || 'map.tmx';
    if (!filename.toLowerCase().endsWith('.tmx')) filename += '.tmx';
    U.download(filename, xml, 'application/xml');
    statusEl.textContent = 'Saved: ' + filename;
    mapModel.rawXml = xml;
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Save error: ' + err.message;
  }
}

document.getElementById('btnResize').addEventListener('click', () => {
  if (!mapModel) { statusEl.textContent = 'No map'; return; }
  const nw = parseInt(prompt('New width (' + mapModel.W + '):', String(mapModel.W)), 10);
  if (isNaN(nw) || nw < 1 || nw > 4096) return;
  const nh = parseInt(prompt('New height (' + mapModel.H + '):', String(mapModel.H)), 10);
  if (isNaN(nh) || nh < 1 || nh > 4096) return;
  const entry = mapModel.resize(nw, nh);
  if (!entry) return;
  renderer.invalidate();
  renderer.fitView();
  zoomVal.textContent = renderer.view.zoom.toFixed(2);
  if (layersPanel) layersPanel.build();
  renderer.render();
  statusEl.textContent = 'Size: ' + nw + '×' + nh;
});

document.getElementById('btnMerge').addEventListener('click', () => {
  RW.MergeUI.open({
    onMerge: async (mergedParsed) => {
      await RW.TMX.loadImages(mergedParsed);
      await initFromParsed(mergedParsed, 'merged.tmx');
      statusEl.textContent = 'Merged: ' + mergedParsed.W + '×' + mergedParsed.H +
        ' · tilesets: ' + mergedParsed.tilesets.length +
        ' · layers: ' + mergedParsed.layerOrder.length;
    }
  });
});

document.getElementById('btnExportMap').addEventListener('click', exportMapPNG);

document.getElementById('tilesetInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!mapModel) { statusEl.textContent = 'Open a map first'; return; }
  try {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const b64 = U.bytesToB64(bytes);
    const dataUrl = 'data:image/png;base64,' + b64;
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Cannot read PNG'));
      img.src = dataUrl;
    });

    const tw = mapModel.tw, th = mapModel.th;
    const cols = Math.floor(img.naturalWidth / tw);
    const rows = Math.floor(img.naturalHeight / th);
    if (cols < 1 || rows < 1) {
      throw new Error('PNG smaller than one tile ' + tw + '×' + th);
    }
    const tilecount = cols * rows;

    const defaultName = (file.name || 'tileset').replace(/\.png$/i, '');
    const name = prompt('Tileset name:', defaultName);
    if (!name) return;

    let firstgid = 1;
    for (const ts of mapModel.tilesets) {
      const end = ts.firstgid + ts.tilecount;
      if (end > firstgid) firstgid = end;
    }

    const ts = {
      firstgid, name, columns: cols, tilecount,
      tileW: tw, tileH: th,
      image: img, imageDataUrl: dataUrl, embeddedPngB64: b64,
      imageSource: null, imageW: img.naturalWidth, imageH: img.naturalHeight,
      terrainTypes: [], tiles: {},
      xmlStr: null, _dirty: true
    };
    mapModel.tilesets.push(ts);
    mapModel.tilesets.sort((a, b) => a.firstgid - b.firstgid);

    if (tilesetTabs) {
      tilesetTabs.activeIdx = mapModel.tilesets.indexOf(ts);
      tilesetTabs.build();
    }
    invalidateMarkersCache();
    statusEl.textContent = 'Tileset added: ' + name +
      ' (' + cols + '×' + rows + ', firstgid=' + firstgid + ')';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Tileset error: ' + err.message;
  }
});

// ═══════════════════════════════════════════════
// IMPORT MINI TNS
// ═══════════════════════════════════════════════
function startMiniTNSImport() {
  if (!mapModel) { statusEl.textContent = 'Open a map first'; return; }
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/png,image/*';
  inp.onchange = async () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    try { await importMiniTNS(file); }
    catch (err) {
      console.error(err);
      statusEl.textContent = 'MiniTNS: ' + err.message;
    }
  };
  inp.click();
}

async function importMiniTNS(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const b64 = U.bytesToB64(bytes);
  const dataUrl = 'data:image/png;base64,' + b64;
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('Cannot read PNG'));
    img.src = dataUrl;
  });

  const tw = mapModel.tw, th = mapModel.th;
  const cols = Math.floor(img.naturalWidth / tw);
  const rows = Math.floor(img.naturalHeight / th);
  if (cols !== 3 || rows !== 5) {
    throw new Error('PNG must be exactly 3×5 tiles (' +
      (tw*3) + '×' + (th*5) + ' px, got ' +
      img.naturalWidth + '×' + img.naturalHeight +
      ' = ' + cols + '×' + rows + ' tiles)');
  }
  const tilecount = 15;

  const defaultName = (file.name || 'MiniTNS').replace(/\.png$/i, '');
  const name = prompt('Tileset name:', defaultName);
  if (!name) return;

  let firstgid = 1;
  for (const ts of mapModel.tilesets) {
    const end = ts.firstgid + ts.tilecount;
    if (end > firstgid) firstgid = end;
  }

  const ts = {
    firstgid, name, columns: cols, tilecount,
    tileW: tw, tileH: th,
    image: img, imageDataUrl: dataUrl, embeddedPngB64: b64,
    imageSource: null, imageW: img.naturalWidth, imageH: img.naturalHeight,
    terrainTypes: [], tiles: {},
    xmlStr: null, _dirty: true
  };
  mapModel.tilesets.push(ts);
  mapModel.tilesets.sort((a, b) => a.firstgid - b.firstgid);

  if (tilesetTabs) {
    tilesetTabs.activeIdx = mapModel.tilesets.indexOf(ts);
    tilesetTabs.build();
  }

  const typeName = prompt('Type name:', defaultName) || defaultName;
  const t = typesModel.add(typeName, typesModel.types.length);

  const g = (local) => firstgid + local;

  t.solids = [
    { tileID: g(4),  weight: 1 },
    { tileID: g(11), weight: 1 },
    { tileID: g(14), weight: 1 }
  ];
  t.edges.NWo = g(0);
  t.edges.N   = g(1);
  t.edges.NEo = g(2);
  t.edges.W   = g(3);
  t.edges.E   = g(5);
  t.edges.SWo = g(6);
  t.edges.S   = g(7);
  t.edges.SEo = g(8);
  t.edges.NWi = g(9);
  t.edges.NEi = g(10);
  t.edges.SWi = g(12);
  t.edges.SEi = g(13);

  activeTypeId = t.id;
  if (typesPanel) typesPanel.build();
  invalidateMarkersCache();
  statusEl.textContent = 'MiniTNS: tileset "' + name + '" + type "' + typeName +
    '" (firstgid=' + firstgid + ')';
}

// ═══════════════════════════════════════════════
// MARKERS CACHE
// ═══════════════════════════════════════════════
let _markersCache = null;

function getMarkersCached() {
  if (!mapModel) return { starts: [], respools: [] };
  if (_markersCache) return _markersCache;
  _markersCache = RW.Markers.find(mapModel);
  return _markersCache;
}

function invalidateMarkersCache() {
  _markersCache = null;
}

// ═══════════════════════════════════════════════
// EXPORT _map.png — 500×500, сохраняет пропорции
// ═══════════════════════════════════════════════
function findTsForId(tilesets, id) {
  let found = null;
  for (const ts of tilesets) {
    if (id >= ts.firstgid) found = ts; else break;
  }
  return found;
}

function renderMapToNative(mapModel, markers) {
  const W = mapModel.W, H = mapModel.H;
  const tw = mapModel.tw, th = mapModel.th;
  const nativeW = W * tw, nativeH = H * th;

  const off = document.createElement('canvas');
  off.width = nativeW;
  off.height = nativeH;
  const octx = off.getContext('2d');
  octx.imageSmoothingEnabled = false;

  for (const lname of mapModel.layerOrder) {
    const data = mapModel.layers[lname];
    if (!data) continue;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const id = data[y * W + x];
        if (!id) continue;
        const ts = findTsForId(mapModel.tilesets, id);
        if (!ts || !ts.image) continue;
        const localID = id - ts.firstgid;
        const col = localID % ts.columns;
        const row = Math.floor(localID / ts.columns);
        octx.drawImage(ts.image,
          col * ts.tileW, row * ts.tileH, ts.tileW, ts.tileH,
          x * tw, y * th, tw, th);
      }
    }
  }

  if (markers && RW.Markers) {
    const M = RW.Markers;
    const scale = settings.markerScale || 1;

    // 500px — эталон, чтобы маркер был читаем в выходном PNG
    const nativeScale = Math.max(nativeW, nativeH) / 500;

    const dotR  = M.DOT_RADIUS_TILES  * tw * scale;
    const circR = M.RADIUS_TILES      * tw * scale;
    const fontPx = circR * 2 * M.FONT_RATIO;

    for (const p of markers.respools) {
      const cx = p.x * tw + tw / 2;
      const cy = p.y * th + th / 2;
      octx.beginPath();
      octx.arc(cx, cy, dotR, 0, Math.PI * 2);
      octx.fillStyle = '#ffea30';
      octx.fill();
      octx.strokeStyle = '#000';
      octx.lineWidth = Math.max(1, nativeScale);
      octx.stroke();
    }

    for (const s of markers.starts) {
      const cx = s.x * tw + tw / 2;
      const cy = s.y * th + th / 2;
      const color = M.colorFor(s.team);

      octx.beginPath();
      octx.arc(cx, cy, circR, 0, Math.PI * 2);
      octx.fillStyle = 'rgba(0,0,0,0.5)';
      octx.fill();
      octx.strokeStyle = 'rgba(0,0,0,0.7)';
      octx.lineWidth = Math.max(1, circR * 0.06);
      octx.stroke();

      octx.font = 'bold ' + fontPx + 'px "Arial Black", Arial, sans-serif';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillStyle = color;
      octx.shadowColor = 'rgba(0,0,0,0.9)';
      octx.shadowBlur = fontPx * 0.15;
      octx.fillText(String(s.team + 1), cx, cy);
      octx.shadowBlur = 0;
    }
  }

  return { off, nativeW, nativeH };
}

function composePNG(native, nativeW, nativeH, targetSize) {
  const out = document.createElement('canvas');
  out.width = targetSize;
  out.height = targetSize;
  const o2 = out.getContext('2d');
  o2.fillStyle = '#000';
  o2.fillRect(0, 0, targetSize, targetSize);

  const scale = Math.min(targetSize / nativeW, targetSize / nativeH);
  const dw = Math.max(1, Math.round(nativeW * scale));
  const dh = Math.max(1, Math.round(nativeH * scale));
  const dx = Math.floor((targetSize - dw) / 2);
  const dy = Math.floor((targetSize - dh) / 2);

  o2.imageSmoothingEnabled = true;
  o2.imageSmoothingQuality = 'high';
  o2.drawImage(native, 0, 0, nativeW, nativeH, dx, dy, dw, dh);
  return out;
}

function exportMapPNG() {
  if (!mapModel) { statusEl.textContent = 'No map'; return; }
  try {
    const markers = settings.showMarkers ? getMarkersCached() : null;
    const { off, nativeW, nativeH } = renderMapToNative(mapModel, markers);
    const composed = composePNG(off, nativeW, nativeH, 500);

    composed.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      const baseName = (mapNameEl.value || 'map').replace(/\.tmx$/i, '') || 'map';
      a.download = baseName + '_map.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, 'image/png');

    statusEl.textContent = 'Export: ' + nativeW + '×' + nativeH + ' → 500×500' +
      (markers ? ' · markers ' + (markers.starts.length + markers.respools.length) : '');
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Export error: ' + err.message;
  }
}

// ═══════════════════════════════════════════════
// SETTINGS MODAL
// ═══════════════════════════════════════════════
let settingsModalEl = null;
let settingsSnapshot = null;

function openSettings() {
  if (!settingsModalEl) {
    settingsModalEl = document.getElementById('settingsModal');
    document.getElementById('settingsClose').onclick = closeSettings;
    document.getElementById('settingsCancel').onclick = closeSettings;
    document.getElementById('settingsApply').onclick = applySettings;
    // live-update от label чекбоксов
    document.getElementById('settingsCanvasBg').addEventListener('input', (e) => {
      wrap.style.background = e.target.value;
      if (renderer) renderer.render();
    });
    document.getElementById('settingsMarkerScale').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      document.getElementById('settingsMarkerScaleVal').textContent = v.toFixed(2) + '×';
      if (renderer) {
        renderer.markerScale = v;
        renderer.render();
      }
    });
  }

  settingsSnapshot = {
    canvasBg: settings.canvasBg,
    showMarkers: settings.showMarkers,
    markerScale: settings.markerScale,
    lang: settings.lang
  };

  document.getElementById('settingsLangEn').classList.toggle('active', settings.lang === 'en');
  document.getElementById('settingsLangRu').classList.toggle('active', settings.lang === 'ru');
  document.getElementById('settingsCanvasBg').value = settings.canvasBg;
  document.getElementById('settingsShowMarkers').checked = !!settings.showMarkers;
  document.getElementById('settingsMarkerScale').value = settings.markerScale || 1;
  document.getElementById('settingsMarkerScaleVal').textContent =
    (settings.markerScale || 1).toFixed(2) + '×';

  wrap.style.background = settings.canvasBg;

  settingsModalEl.classList.remove('hidden');
}

function closeSettings() {
  // откат live-preview к сохранённому
  settings.canvasBg = settingsSnapshot.canvasBg;
  settings.showMarkers = settingsSnapshot.showMarkers;
  settings.markerScale = settingsSnapshot.markerScale;
  settings.lang = settingsSnapshot.lang;
  RW.Storage.saveSettings(settings);

  wrap.style.background = settings.canvasBg;
  if (renderer) {
    renderer.setBg(settings.canvasBg);
    renderer.showMarkers = !!settings.showMarkers;
    renderer.markerScale = settings.markerScale || 1;
    renderer.render();
  }
  RW.I18N.set(settings.lang);
  if (settingsModalEl) settingsModalEl.classList.add('hidden');
}

function applySettings() {
  settings.canvasBg = document.getElementById('settingsCanvasBg').value || '#0a0a0a';
  settings.showMarkers = document.getElementById('settingsShowMarkers').checked;
  settings.markerScale = parseFloat(document.getElementById('settingsMarkerScale').value) || 1;
  RW.Storage.saveSettings(settings);

  wrap.style.background = settings.canvasBg;
  if (renderer) {
    renderer.setBg(settings.canvasBg);
    renderer.showMarkers = !!settings.showMarkers;
    renderer.markerScale = settings.markerScale;
    renderer.render();
  }

  if (settingsModalEl) settingsModalEl.classList.add('hidden');
  statusEl.textContent = 'Settings applied';
}

function pickLang(lang) {
  settings.lang = lang;
  RW.I18N.set(lang);
  document.getElementById('settingsLangEn').classList.toggle('active', lang === 'en');
  document.getElementById('settingsLangRu').classList.toggle('active', lang === 'ru');
}

document.getElementById('btnSettings').addEventListener('click', openSettings);
document.getElementById('settingsLangEn').addEventListener('click', () => pickLang('en'));
document.getElementById('settingsLangRu').addEventListener('click', () => pickLang('ru'));
// ─── Docs link ───
document.getElementById('btnDocs').addEventListener('click', () => {
  window.open('WebTiledDoc.html', '_blank', 'noopener');
});

// ═══════════════════════════════════════════════
// Bottom section toggles
// ═══════════════════════════════════════════════
document.getElementById('btnAtlasesTab').addEventListener('click', () => {
  const btn = document.getElementById('btnAtlasesTab');
  const on = btn.classList.toggle('active');
  bottomEl.classList.toggle('atlases-hidden', !on);
  if (on && tilesetTabs) tilesetTabs.build();
});

document.getElementById('btnTypesTab').addEventListener('click', () => {
  const btn = document.getElementById('btnTypesTab');
  const on = btn.classList.toggle('active');
  bottomEl.classList.toggle('types-hidden', !on);
  if (on && typesPanel) typesPanel.build();
});

document.getElementById('btnToggleBottom').addEventListener('click', (e) => {
  const isCollapsed = bottomEl.classList.contains('collapsed');
  if (!isCollapsed) {
    const h = bottomEl.getBoundingClientRect().height;
    bottomEl.dataset.savedHeight = String(Math.round(h));
    bottomEl.style.height = '';
    bottomEl.classList.add('collapsed');
    e.target.textContent = '▲';
  } else {
    bottomEl.classList.remove('collapsed');
    const saved = parseInt(bottomEl.dataset.savedHeight || '0', 10);
    bottomEl.style.height = saved > 40 ? saved + 'px' : '340px';
    e.target.textContent = '▼';
  }
  setTimeout(() => { if (renderer) renderer.resize(); }, 220);
});

(function setupBottomResize() {
  let resizing = false;
  bottomGrabberEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    resizing = true;
    delete bottomEl.dataset.savedHeight;
    bottomEl.classList.remove('collapsed');
    document.getElementById('btnToggleBottom').textContent = '▼';
    bottomEl.classList.add('no-transition');
    bottomGrabberEl.classList.add('dragging');
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const h = window.innerHeight - e.clientY;
    const clamped = Math.max(60, Math.min(window.innerHeight - 120, h));
    bottomEl.style.height = clamped + 'px';
    if (renderer) renderer.resize();
  });
  window.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = false;
    bottomEl.classList.remove('no-transition');
    bottomGrabberEl.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();

document.getElementById('btnFit').addEventListener('click', () => {
  if (renderer) { renderer.fitView(); zoomVal.textContent = renderer.view.zoom.toFixed(2); }
});
document.getElementById('btnReset').addEventListener('click', () => {
  if (renderer) { renderer.resetView(); zoomVal.textContent = renderer.view.zoom.toFixed(2); }
});
document.getElementById('btnHelp').addEventListener('click', () => alert(
  'B — Brush, T — Terrain, C — Classic autotile\n' +
  'E — Eraser, R — Rect, F — Fill, I — Picker, P — Pan\n' +
  'Ctrl+Z / Ctrl+Y — Undo / Redo, Ctrl+S — Save\n' +
  'Esc — cancel pick mode\n\n' +
  'Classic autotile works on the ACTIVE layer.\n' +
  'MiniTNS: PNG 3×5 tiles → new tileset + type.'
));
document.getElementById('btnAddEmpty').addEventListener('click', addEmptyToBrush);
document.getElementById('btnFlood').addEventListener('click', runFloodDominant);
document.getElementById('btnClearBrush').addEventListener('click', () => {
  brushGroup = [];
  if (brushPanel) brushPanel.build();
  if (tilesetTabs) tilesetTabs.refreshSelection();
});
mapNameEl.addEventListener('input', () => { /* autosave disabled */ });
document.getElementById('btnPickCancel').addEventListener('click', () => endPick());

// ═══════════════════════════════════════════════
// MiniTNS Library
// ═══════════════════════════════════════════════
function openMiniTNSLibrary() {
  if (!mapModel) { statusEl.textContent = 'Сначала открой карту'; return; }
  if (!RW.MiniTNSLib) { statusEl.textContent = 'MiniTNSLib не загружен'; return; }

  RW.MiniTNSLib.open(async (entry) => {
    RW.MiniTNSLib.close();
    try {
      await addMiniTNSFromEntry(entry);
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'MiniTNS: ' + err.message;
    }
  });
}

async function addMiniTNSFromEntry(entry) {
  const tw = mapModel.tw, th = mapModel.th;
  const img = entry.img;
  const cols = Math.floor(img.naturalWidth / tw);
  const rows = Math.floor(img.naturalHeight / th);
  if (cols !== 3 || rows !== 5) {
    throw new Error('PNG не 3×5 тайлов (' +
      (tw*3) + '×' + (th*5) + ' px, получил ' +
      img.naturalWidth + '×' + img.naturalHeight +
      ' = ' + cols + '×' + rows + ')');
  }
  const tilecount = 15;

  // firstgid
  let firstgid = 1;
  for (const ts of mapModel.tilesets) {
    const end = ts.firstgid + ts.tilecount;
    if (end > firstgid) firstgid = end;
  }

  // имя tileset (без дублей)
  const baseName = entry.name;
  let name = baseName;
  if (mapModel.tilesets.find(t => t.name === name)) {
    let i = 2;
    while (mapModel.tilesets.find(t => t.name === baseName + '_' + i)) i++;
    name = baseName + '_' + i;
  }

  const ts = {
    firstgid, name, columns: cols, tilecount,
    tileW: tw, tileH: th,
    image: img, imageDataUrl: entry.dataUrl, embeddedPngB64: entry.b64,
    imageSource: null, imageW: img.naturalWidth, imageH: img.naturalHeight,
    terrainTypes: [], tiles: {},
    xmlStr: null, _dirty: true
  };
  mapModel.tilesets.push(ts);
  mapModel.tilesets.sort((a, b) => a.firstgid - b.firstgid);

  if (tilesetTabs) {
    tilesetTabs.activeIdx = mapModel.tilesets.indexOf(ts);
    tilesetTabs.build();
  }

  // имя типа (без дублей)
  let typeName = entry.name;
  if (typesModel.types.find(t => t.name === typeName)) {
    let i = 2;
    while (typesModel.types.find(t => t.name === typeName + '_' + i)) i++;
    typeName = typeName + '_' + i;
  }

  const t = typesModel.add(typeName, entry.priority);
  const g = (local) => firstgid + local;

  t.solids = [
    { tileID: g(4),  weight: 1 },
    { tileID: g(11), weight: 1 },
    { tileID: g(14), weight: 1 }
  ];
  t.edges.NWo = g(0);
  t.edges.N   = g(1);
  t.edges.NEo = g(2);
  t.edges.W   = g(3);
  t.edges.E   = g(5);
  t.edges.SWo = g(6);
  t.edges.S   = g(7);
  t.edges.SEo = g(8);
  t.edges.NWi = g(9);
  t.edges.NEi = g(10);
  t.edges.SWi = g(12);
  t.edges.SEi = g(13);

  activeTypeId = t.id;
  if (typesPanel) typesPanel.build();
  invalidateMarkersCache();

  statusEl.textContent = 'MiniTNS "' + entry.name +
    '": tileset + тип "' + typeName +
    '" (P' + entry.priority + ', firstgid=' + firstgid + ')';
}

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  if (settings.activeTool) activeTool = settings.activeTool;
  wrap.style.background = settings.canvasBg || '#0a0a0a';
  RW.I18N.apply();
  buildTools();
});

RW.I18N.apply();
buildTools();
})(window.RWEditor = window.RWEditor || {});