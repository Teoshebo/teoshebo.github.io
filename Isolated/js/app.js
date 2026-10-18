(function(RW){
'use strict';
const U = RW.Utils;

function on(id, event, handler) {
  const e = document.getElementById(id);
  if (e) e.addEventListener(event, handler);
  return e;
}
function el(id) { return document.getElementById(id); }

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

let _pendingImportTilesets = []; // Временное хранилище для импорта из .tmx

// ─── REFERENCE ───
let refImage = null;
let refHandle = null;

let settings = RW.Storage.loadSettings();
if (settings.showMarkers == null) settings.showMarkers = false;
if (settings.markerScale == null) settings.markerScale = 1;
if (settings.canvasBg == null) settings.canvasBg = '#0a0a0a';
if (settings.atlasBg == null) settings.atlasBg = '#0a0a0a';
if (settings.lang == null) settings.lang = 'en';
if (settings.reference == null) settings.reference = { path: '', opacity: 0.5, mode: 'overlay' };
if (settings.reference.path == null) settings.reference.path = '';
if (settings.reference.opacity == null) settings.reference.opacity = 0.5;
if (settings.reference.mode == null) settings.reference.mode = 'overlay';
RW.Storage.saveSettings(settings);

function applyAtlasBg(v) {
  document.documentElement.style.setProperty('--atlas-bg', v || '#0a0a0a');
}

const cv = el('cv');
const wrap = el('wrap');
const statusEl = el('status');
const infoEl = el('info');
const fpsEl = el('fps');
const zoomVal = el('zoomVal');
const layersEl = el('layers');
const brushListEl = el('brushList');
const brushTotalEl = el('brushTotal');
const brushSettingsEl = el('brushSettings');
const classicListEl = el('classicList');
const classicPanelEl = el('classicPanel');
const tnsListEl = el('tnsList');
const tnsPanelEl = el('tnsPanel');
const tsTabsListEl = el('tsTabsList');
const tsBodyEl = el('tsBody');
const typesBodyEl = el('typesBody');
const bottomEl = el('bottom');
const bottomGrabberEl = el('bottomGrabber');
const toolsEl = el('tools');
const mapNameEl = el('mapName');
const pickBannerEl = el('pickBanner');
const pickBannerTextEl = el('pickBannerText');
const warnBannerEl = el('warnBanner');
const warnBannerTextEl = el('warnBannerText');

function updateZoomLabels() {
  if (!renderer) return;
  const v = renderer.view.zoom.toFixed(2);
  const d = el('zoomVal'); if (d) d.textContent = v;
  const m = el('utilZoomVal'); if (m) m.textContent = v;
}

// ═══════════════════════════════════════════════
// I18N
// ═══════════════════════════════════════════════
const I18N = {
  en: {
    'title': 'WebTiled',
    'btn.new': 'New',
    'btn.open': 'Open',
    'btn.save': 'Save',
    'btn.resize': 'Size',
    'btn.merge': 'Merge',
    'btn.exportMap': '_map',
    'btn.savePreview': 'Save Preview',
    'btn.fit': 'Fit',
    'btn.reset': '1:1',
    'btn.ref': 'REF',
    'btn.fullscreen': 'Fullscreen',
    'btn.exitFullscreen': 'Exit Fullscreen',
    'field.filename': 'Filename',
    'field.zoom': 'Zoom',
    'status.idle': 'Load .tmx file',
    'tab.atlases': 'ATLASES',
    'tab.types': 'TYPES',
    'tab.gen': 'GENERATOR',
    'tab.v3': '3D',
    'settings.title': 'SETTINGS',
    'settings.language': 'LANGUAGE',
    'settings.appearance': 'APPEARANCE',
    'settings.canvasBg': 'Editor background',
    'settings.atlasBg': 'Atlas / tiles background',
    'settings.markers': 'MARKERS',
    'settings.showMarkers': 'Show markers',
    'settings.markerSize': 'Marker size',
    'settings.apply': 'APPLY',
    'settings.cancel': 'CANCEL',
    'settings.close': 'Close',
    'ref.title': 'REFERENCE',
    'ref.status': 'Status',
    'ref.pick': 'Choose file',
    'ref.clear': 'Remove',
    'ref.opacity': 'Opacity',
    'ref.underlay': 'Place under map (else overlay)',
    'ref.hint': 'Reference is not saved into .tmx and not included in Save Preview. Chrome/Edge remember the file path between sessions.'
  },
  ru: {
    'title': 'WebTiled',
    'btn.new': 'Новый',
    'btn.open': 'Открыть',
    'btn.save': 'Сохранить',
    'btn.resize': 'Размер',
    'btn.merge': 'Склейка',
    'btn.exportMap': '_map',
    'btn.savePreview': 'Скриншот',
    'btn.fit': 'Fit',
    'btn.reset': '1:1',
    'btn.ref': 'REF',
    'btn.fullscreen': 'На весь экран',
    'btn.exitFullscreen': 'Выйти',
    'field.filename': 'Имя файла',
    'field.zoom': 'Зум',
    'status.idle': 'Загрузи .tmx файл',
    'tab.atlases': 'АТЛАСЫ',
    'tab.types': 'ТИПЫ',
    'tab.gen': 'ГЕНЕРАТОР',
    'tab.v3': '3D',
    'settings.title': 'НАСТРОЙКИ',
    'settings.language': 'ЯЗЫК',
    'settings.appearance': 'ВНЕШНИЙ ВИД',
    'settings.canvasBg': 'Фон редактора',
    'settings.atlasBg': 'Фон атласов',
    'settings.markers': 'МАРКЕРЫ',
    'settings.showMarkers': 'Показывать маркеры',
    'settings.markerSize': 'Размер маркеров',
    'settings.apply': 'ПРИМЕНИТЬ',
    'settings.cancel': 'ОТМЕНА',
    'settings.close': 'Закрыть',
    'ref.title': 'РЕФЕРЕНС',
    'ref.status': 'Статус',
    'ref.pick': 'Выбрать файл',
    'ref.clear': 'Удалить',
    'ref.opacity': 'Прозрачность',
    'ref.underlay': 'Под карту (иначе поверх)',
    'ref.hint': 'Референс не сохраняется в .tmx и не попадает в Скриншот. Chrome/Edge запоминают путь между сессиями.'
  }
};

let currentLang = settings.lang || 'en';

RW.I18N = {
  get lang() { return currentLang; },
  t(key) {
    const d = I18N[currentLang] || I18N.en;
    return d[key] != null ? d[key] : (I18N.en[key] != null ? I18N.en[key] : key);
  },
  apply() {
    document.querySelectorAll('[data-i18n]').forEach(e => {
      e.textContent = this.t(e.dataset.i18n);
    });
    const t = document.querySelector('title');
    if (t) t.textContent = this.t('title');
  },
  set(lang) {
    if (!I18N[lang]) return;
    currentLang = lang;
    settings.lang = lang;
    RW.Storage.saveSettings(settings);
    this.apply();
    if (typeof updateMobileBrushBtn === 'function') updateMobileBrushBtn();
    if (typeof updateFullscreenBtn === 'function') updateFullscreenBtn();
  }
};

// ═══════════════════════════════════════════════
// CLASSIC AUTOTILE — stable anchor
// ═══════════════════════════════════════════════
function resolveClassicAnchor() {
  if (!activeClassicTerrain || !mapModel) return null;
  const a = activeClassicTerrain;
  const tsIdx = mapModel.tilesets.findIndex(t => t.firstgid === a.tsFirstgid);
  if (tsIdx < 0) return null;
  const ts = mapModel.tilesets[tsIdx];
  const terrIdx = ts.terrainTypes.findIndex(tt => tt.name === a.terrName);
  if (terrIdx < 0) return null;
  return { ts, tsIdx, terrIdx, terrType: ts.terrainTypes[terrIdx] };
}

// ═══════════════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════════════
const TOOLS = [
  { id: 'pan',     hk: 'KeyM', label: 'MOVE',    hkPos: 0, icon: 'asset/icon/move.png',    emoji: '✋', title: 'Move (M)' },
  { sep: true },
  { id: 'brush',   hk: 'KeyB', label: 'BRUSH',   hkPos: 0, icon: 'asset/icon/brush.png',   emoji: '🖌', title: 'Brush (B)' },
  { id: 'terrain', hk: 'KeyY', label: 'TYPE',    hkPos: 1, icon: 'asset/icon/type.png',    emoji: '🌍', title: 'Type / Solid (Y)' },
  { id: 'classic', hk: 'KeyT', label: 'TERRAIN', hkPos: 0, icon: 'asset/icon/terrain.png', emoji: '▦',  title: 'Terrain (T)' },
  { id: 'eraser',  hk: 'KeyE', label: 'ERASE',   hkPos: 0, icon: 'asset/icon/erase.png',   emoji: '🧽', title: 'Erase (E)' },
  { id: 'rect',    hk: 'KeyR', label: 'RECT',    hkPos: 0, icon: 'asset/icon/rect.png',    emoji: '▭',  title: 'Rect (R)' },
  { id: 'fill',    hk: 'KeyF', label: 'FILL',    hkPos: 0, icon: 'asset/icon/fill.png',    emoji: '🪣', title: 'Fill (F)' },
  { id: 'picker',  hk: 'KeyK', label: 'PICK',    hkPos: 3, icon: 'asset/icon/picker.png',  emoji: '💧', title: 'Picker (K)' },
  { sep: true },
  { id: 'autotile', label: 'AUTO', hkPos: -1, icon: 'asset/icon/auto.png', emoji: '⚙', title: 'Autotile area' }
];

const LONG_TAP_TOOLS = new Set(['brush', 'classic', 'terrain']);

function makeIconEl(t) {
  if (t.icon) {
    const img = document.createElement('img');
    img.className = 'tool-ic';
    img.src = t.icon;
    img.alt = '';
    img.onerror = () => {
      const span = document.createElement('span');
      span.className = 'ic';
      span.textContent = t.emoji || '?';
      img.replaceWith(span);
    };
    return img;
  }
  const span = document.createElement('span');
  span.className = 'ic';
  span.textContent = t.emoji || '?';
  return span;
}

function makeLabelEl(t) {
  const lbl = document.createElement('span');
  lbl.className = 'lbl';
  const label = t.label || '';
  const pos = (t.hkPos != null) ? t.hkPos : -1;

  if (pos < 0 || pos >= label.length) {
    lbl.textContent = label;
    return lbl;
  }

  const before = label.slice(0, pos);
  const ch = label.charAt(pos);
  const after = label.slice(pos + 1);

  if (before) lbl.appendChild(document.createTextNode(before));
  const b = document.createElement('b');
  b.className = 'hk';
  b.textContent = ch;
  lbl.appendChild(b);
  if (after) lbl.appendChild(document.createTextNode(after));
  return lbl;
}

function buildTools() {
  if (!toolsEl) return;
  toolsEl.innerHTML = '';
  for (const t of TOOLS) {
    if (t.sep) {
      const sep = document.createElement('div');
      sep.className = 'sep';
      toolsEl.appendChild(sep);
      continue;
    }
    const e = document.createElement('div');
    e.className = 'tool' + (t.id === activeTool ? ' active' : '');
    e.dataset.tool = t.id;
    e.title = t.title || '';
    e.appendChild(makeIconEl(t));
    e.appendChild(makeLabelEl(t));
    e.addEventListener('click', () => handleToolClick(t.id));
    toolsEl.appendChild(e);
  }
}

function checkTNSLayerWarning() {
  if (activeTool !== 'terrain') return;
  if (!mapModel) return;
  if (activeLayer && activeLayer !== 'Ground') {
    if (warnBannerTextEl) {
      warnBannerTextEl.textContent =
        'TYPE-инструмент рисует в Ground. Активный слой — "' + activeLayer +
        '". Поменяй на Ground или переключи инструмент — иначе склейка карт сломается.';
    }
    if (warnBannerEl) warnBannerEl.classList.remove('hidden');
  }
}

function handleToolClick(id) {
  if (pickMode) endPick();
  if (id === 'autotile') { runAutotileDialog(); return; }
  activeTool = id;
  document.querySelectorAll('#tools .tool').forEach(e => {
    e.classList.toggle('active', e.dataset.tool === id);
  });
  if (cv) cv.classList.toggle('crosshair', id !== 'pan');
  settings.activeTool = id;
  RW.Storage.saveSettings(settings);
  if (renderer) renderer.render();
  if (brushPanel) brushPanel.build();
  if (typeof updateMobileBrushBtn === 'function') updateMobileBrushBtn();
  checkTNSLayerWarning();
}

// ─── Pick mode ───
function ensureAtlasesVisible() {
  const b = el('btnAtlasesTab');
  if (b) b.classList.add('active');
  if (bottomEl) bottomEl.classList.remove('atlases-hidden');
}
function startPick(mode) {
  pickMode = mode;
  ensureAtlasesVisible();
  let label;
  if (mode.kind === 'edge') label = 'Pick tile for ' + mode.role;
  else if (mode.kind === 'solid') label = 'Pick solid tile';
  if (pickBannerTextEl) pickBannerTextEl.textContent = label + ' · click tile · click again to clear';
  if (pickBannerEl) pickBannerEl.classList.remove('hidden');
  if (typesPanel) typesPanel.build();
  if (tilesetTabs) tilesetTabs.build();
  if (statusEl) statusEl.textContent = label;
}
function endPick() {
  pickMode = null;
  if (pickBannerEl) pickBannerEl.classList.add('hidden');
  if (typesPanel) typesPanel.build();
  if (tilesetTabs) tilesetTabs.build();
  if (statusEl) statusEl.textContent = 'Pick cancelled';
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
  if (statusEl) statusEl.textContent = 'OK · #' + globalID;
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
  for (const b of brushGroup) { r -= b.weight; if (r <= 0) return b.tileID; }
  return brushGroup[brushGroup.length - 1].tileID;
}
function pickWeightedSolid(type) {
  if (!type || !type.solids || !type.solids.length) return 0;
  const total = type.solids.reduce((s, x) => s + (x.weight || 0), 0);
  if (total <= 0) return type.solids[0].tileID;
  let r = Math.random() * total;
  for (const s of type.solids) { r -= (s.weight || 0); if (r <= 0) return s.tileID; }
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
  let touchedGround = false;
  for (const c of cells) {
    const tx = c[0], ty = c[1];
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) continue;
    const idx = ty * map.W + tx;
    const v = tileFn();
    const before = data[idx];
    if (before === v) continue;
    data[idx] = v;
    recordChange(activeLayer, idx, before, v);
    renderer.invalidateCell(tx, ty);
    expandStrokeBound(tx, ty);
    if (activeLayer === 'Ground') touchedGround = true;
  }
  if (touchedGround) invalidateMarkersCache();
}
function paintTerrainCells(cx, cy) {
  const map = mapModel;
  if (!activeLayer) return;
  const type = typesModel.get(activeTypeId);
  if (!type || !type.solids.length) {
    if (statusEl) statusEl.textContent = 'No type selected or no solids';
    return;
  }
  const data = map.layers[activeLayer];
  const cells = brushCells(cx, cy);
  let touchedGround = false;
  for (const c of cells) {
    const tx = c[0], ty = c[1];
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) continue;
    const idx = ty * map.W + tx;
    const before = data[idx];
    const after = pickWeightedSolid(type);
    if (before === after) continue;
    data[idx] = after;
    recordChange(activeLayer, idx, before, after);
    renderer.invalidateCell(tx, ty);
    expandStrokeBound(tx, ty);
    if (activeLayer === 'Ground') touchedGround = true;
  }
  if (touchedGround) invalidateMarkersCache();
}

// ═══════════════════════════════════════════════
// CLASSIC AUTOTILE
// ═══════════════════════════════════════════════
function buildClassicMaskIndex(tsIdx) {
  const c = classicMaskCache.get(tsIdx);
  if (c) return c;
  const ts = mapModel.tilesets[tsIdx];
  const idx = new Map();
  for (const idStr in ts.tiles) {
    const id = parseInt(idStr, 10);
    const t = ts.tiles[id];
    if (!t.terrain) continue;
    const k = t.terrain.join(',');
    if (!idx.has(k)) idx.set(k, id + ts.firstgid);
  }
  classicMaskCache.set(tsIdx, idx);
  return idx;
}
function findEmptyValue(tsIdx, targetTerr) {
  const k = tsIdx + ':' + targetTerr;
  if (classicEmptyCache.has(k)) return classicEmptyCache.get(k);
  const ts = mapModel.tilesets[tsIdx];
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
  classicEmptyCache.set(k, best);
  return best;
}
function cellHasCorner(tx, ty, ci, tsIdx, targetTerr) {
  const map = mapModel;
  if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return false;
  const id = map.layers[activeLayer][ty * map.W + tx];
  if (!id) return false;
  const ts = map.tilesets[tsIdx];
  const nts = renderer.findTileset(id);
  if (!nts || nts !== ts) return false;
  const t = nts.tiles[id - nts.firstgid];
  if (!t || !t.terrain) return false;
  return t.terrain[ci] === targetTerr;
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
  const r = [];
  function rec(s, cur) {
    if (cur.length === k) { r.push(cur.slice()); return; }
    for (let i = s; i < arr.length; i++) { cur.push(arr[i]); rec(i+1, cur); cur.pop(); }
  }
  rec(0, []);
  return r;
}
function paintClassicCell(tx, ty, anchor) {
  if (!anchor) return;
  const map = mapModel;
  if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return;
  if (!activeLayer) return;
  const tsIdx = anchor.tsIdx;
  const terrIdx = anchor.terrIdx;
  const ev = findEmptyValue(tsIdx, terrIdx);
  const mask = resolveClassicMask(tx, ty, tsIdx, terrIdx, ev);
  const idx = buildClassicMaskIndex(tsIdx);
  let tileID = idx.get(mask.join(','));
  if (tileID === undefined) {
    const empty = [];
    for (let i = 0; i < 4; i++) if (mask[i] === ev) empty.push(i);
    outer:
    for (let n = empty.length; n >= 1; n--) {
      const combos = combinations(empty, n);
      for (const combo of combos) {
        const test = mask.slice();
        for (const i of combo) test[i] = terrIdx;
        tileID = idx.get(test.join(','));
        if (tileID !== undefined) break outer;
      }
    }
  }
  if (tileID === undefined) return;
  const i = ty * map.W + tx;
  const before = map.layers[activeLayer][i];
  if (before === tileID) return;
  map.layers[activeLayer][i] = tileID;
  recordChange(activeLayer, i, before, tileID);
  renderer.invalidateCell(tx, ty);
}
function paintClassicCells(cx, cy) {
  const map = mapModel;
  if (!map || !activeLayer) return;
  const anchor = resolveClassicAnchor();
  if (!anchor) {
    if (statusEl) statusEl.textContent = 'Classic: anchor not resolved';
    return;
  }
  const solidTile = anchor.terrType.tile + anchor.ts.firstgid;
  const cells = brushCells(cx, cy);
  const data = map.layers[activeLayer];
  for (const c of cells) {
    const tx = c[0], ty = c[1];
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) continue;
    const i = ty * map.W + tx;
    const before = data[i];
    if (before === solidTile) continue;
    data[i] = solidTile;
    recordChange(activeLayer, i, before, solidTile);
    renderer.invalidateCell(tx, ty);
    expandStrokeBound(tx, ty);
  }
  for (const c of cells) paintClassicCell(c[0], c[1], anchor);
}
function finalizeClassicForStroke() {
  if (!strokeChanges) return;
  const m = strokeChanges.get(activeLayer);
  if (!m || !m.size) return;
  const anchor = resolveClassicAnchor();
  if (!anchor) return;
  const solidTile = anchor.terrType.tile + anchor.ts.firstgid;
  const data = map.layers[activeLayer];
  const painted = new Set(m.keys());
  for (const i of painted) {
    const before = data[i];
    if (before === solidTile) continue;
    data[i] = solidTile;
    recordChange(activeLayer, i, before, solidTile);
    const x = i % mapModel.W, y = Math.floor(i / mapModel.W);
    renderer.invalidateCell(x, y);
  }
  const lookup = new Set();
  for (const i of painted) {
    const x = i % mapModel.W, y = Math.floor(i / mapModel.W);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= mapModel.W || ny >= mapModel.H) continue;
        lookup.add(ny * mapModel.W + nx);
      }
  }
  for (const i of lookup) {
    const x = i % mapModel.W, y = Math.floor(i / mapModel.W);
    paintClassicCell(x, y, anchor);
  }
}

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
    const x = c.idx % mapModel.W, y = Math.floor(c.idx / mapModel.W);
    renderer.invalidateCell(x, y);
    recordChange('Items0', c.idx, c.before, c.after);
  }
}

function endStroke() {
  if (!strokeChanges || !strokeChanges.size) {
    strokeChanges = null; strokeBound = null;
    return;
  }
  const map = mapModel;
  const layers = [];
  let total = 0;
  const touchedLayers = [];
  for (const kv of strokeChanges) {
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
    if (statusEl) statusEl.textContent = total + ' cells changed';
    if (layersPanel) {
      for (const ln of touchedLayers) layersPanel.flash(ln);
    }
  }
  invalidateMarkersCache();
  strokeChanges = null; strokeBound = null; lastPaintKey = null;
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
  renderer.invalidateRange(minX, minY, maxX, maxY);
  map.undoStack.push({ layer: activeLayer, changes });
  if (map.undoStack.length > 50) map.undoStack.shift();
  map.redoStack.length = 0;
  invalidateMarkersCache();
  if (layersPanel) layersPanel.flash(activeLayer);
  if (statusEl) statusEl.textContent = 'Fill: ' + changes.length + ' cells';
}

function runFloodDominant() {
  if (!mapModel || !generator) { if (statusEl) statusEl.textContent = 'No map'; return; }
  if (!mapModel.layers.Ground) { if (statusEl) statusEl.textContent = 'No Ground layer'; return; }
  const changes = generator.floodDominant(0, 0, mapModel.W - 1, mapModel.H - 1);
  if (!changes.length) { if (statusEl) statusEl.textContent = 'FLOOD: nothing to change'; return; }
  const data = mapModel.layers.Ground;
  for (const c of changes) data[c.idx] = c.after;
  renderer.invalidate();
  mapModel.undoStack.push({ layer: 'Ground', changes });
  if (mapModel.undoStack.length > 50) mapModel.undoStack.shift();
  mapModel.redoStack.length = 0;
  invalidateMarkersCache();
  renderer.render();
  if (layersPanel) layersPanel.flash('Ground');
  if (statusEl) statusEl.textContent = 'FLOOD: ' + changes.length + ' cells';
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
      const i = y * map.W + x;
      const before = data[i];
      const v = tileFn();
      if (before === v) continue;
      data[i] = v;
      changes.push({ idx: i, before, after: v });
    }
  }
  if (!changes.length) return;
  renderer.invalidateRange(minX, minY, maxX, maxY);
  map.undoStack.push({ layer: activeLayer, changes });
  if (map.undoStack.length > 50) map.undoStack.shift();
  map.redoStack.length = 0;
  invalidateMarkersCache();
  if (layersPanel) layersPanel.flash(activeLayer);
  if (statusEl) statusEl.textContent = 'Rect: ' + changes.length + ' cells';
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
      if (statusEl) statusEl.textContent = 'Picker: ' + name + ' #' + id;
      return;
    }
  }
  if (statusEl) statusEl.textContent = 'Picker: empty';
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
  if (!changes.length) { if (statusEl) statusEl.textContent = 'Autotile: no changes'; return; }
  const data = mapModel.layers.Items0;
  if (!data) { if (statusEl) statusEl.textContent = 'No Items0 layer'; return; }
  for (const c of changes) data[c.idx] = c.after;
  renderer.invalidateRange(x0, y0, x1, y1);
  mapModel.undoStack.push({ layer: 'Items0', changes });
  if (mapModel.undoStack.length > 50) mapModel.undoStack.shift();
  mapModel.redoStack.length = 0;
  invalidateMarkersCache();
  renderer.render();
  if (layersPanel) layersPanel.flash('Items0');
  if (statusEl) statusEl.textContent = 'Autotile: ' + changes.length + ' cells';
}

function doUndo() {
  if (!mapModel || !mapModel.canUndo()) { if (statusEl) statusEl.textContent = 'Nothing to undo'; return; }
  const entry = mapModel.undo();
  invalidateMarkersCache();
  if (entry.type === 'resize') {
    renderer.invalidate();
    renderer.fitView();
    updateZoomLabels();
    if (layersPanel) layersPanel.build();
  } else invalidateEntry(entry);
  renderer.render();
  if (statusEl) statusEl.textContent = 'Undo';
}
function doRedo() {
  if (!mapModel || !mapModel.canRedo()) { if (statusEl) statusEl.textContent = 'Nothing to redo'; return; }
  const entry = mapModel.redo();
  invalidateMarkersCache();
  if (entry.type === 'resize') {
    renderer.invalidate();
    renderer.fitView();
    updateZoomLabels();
    if (layersPanel) layersPanel.build();
  } else invalidateEntry(entry);
  renderer.render();
  if (statusEl) statusEl.textContent = 'Redo';
}
function invalidateEntry(entry) {
  if (!renderer) return;
  if (entry.type === 'resize') return;
  const list = entry.type === 'multi'
    ? entry.layers
    : [{ layer: entry.layer, changes: entry.changes }];
  for (const le of list) {
    if (!le.changes) continue;
    for (const c of le.changes) {
      const x = c.idx % mapModel.W, y = Math.floor(c.idx / mapModel.W);
      renderer.chunkCache.delete(Math.floor(x/32) + ',' + Math.floor(y/32));
    }
  }
}

// ═══════════════════════════════════════════════
// POINTER / TOUCH STATE
// ═══════════════════════════════════════════════
const pointers = new Map();
let drawingPointerId = null;
let longTapTimer = null;
let longTapFired = false;
let longTapStart = { x: 0, y: 0 };
let multiPointerActive = false;
let lastPinchDist = 0;
let lastPinchMidX = 0;
let lastPinchMidY = 0;

function cancelLongTap() {
  if (longTapTimer) { clearTimeout(longTapTimer); longTapTimer = null; }
}

function startLongTapTimer() {
  cancelLongTap();
  longTapFired = false;
  if (!LONG_TAP_TOOLS.has(activeTool)) return;
  longTapTimer = setTimeout(() => {
    longTapTimer = null;
    longTapFired = true;
    triggerLongTap();
  }, 500);
}

function triggerLongTap() {
  if (!renderer || !mapModel || !activeLayer) return;
  const pos = renderer.screenToTile(longTapStart.x, longTapStart.y);
  const tx = pos.tx, ty = pos.ty;
  if (tx < 0 || ty < 0 || tx >= mapModel.W || ty >= mapModel.H) return;
  strokeChanges = null;
  paintBrushCells(tx, ty, () => 0);
  endStroke();
  painting = false;
  rectStart = null; rectCurrent = null;
  renderer.rectStart = null; renderer.rectCurrent = null;
  renderer.render();
  if (statusEl) statusEl.textContent = 'Long-tap erase @ ' + tx + ',' + ty;
}

function beginMultiTouch() {
  if (painting) {
    painting = false;
    if (activeTool === 'terrain') finalizeAutotileForStroke();
    if (activeTool === 'classic') finalizeClassicForStroke();
    endStroke();
    renderer.rectStart = null; renderer.rectCurrent = null;
    renderer.render();
  }
  drag.active = false;
  if (cv) cv.classList.remove('drag');
  cancelLongTap();

  const arr = Array.from(pointers.values());
  if (arr.length >= 2) {
    lastPinchDist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    lastPinchMidX = (arr[0].x + arr[1].x) / 2;
    lastPinchMidY = (arr[0].y + arr[1].y) / 2;
  }
  multiPointerActive = true;
}

// ═══════════════════════════════════════════════
// CANVAS POINTER HANDLERS
// ═══════════════════════════════════════════════
if (cv) cv.addEventListener('pointerdown', (e) => {
  if (!renderer) return;
  if (e.pointerType === 'touch') e.preventDefault();
  if (e.button === 2) return;

  const isTouch = e.pointerType === 'touch';
  const isMiddle = e.button === 1;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, isTouch });
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}

  if (pointers.size >= 2) { beginMultiTouch(); return; }

  if (activeTool === 'pan' || isMiddle) {
    drag.active = true;
    drag.x = e.clientX; drag.y = e.clientY;
    if (!isTouch) cv.classList.add('drag');
    return;
  }

  if (!mapModel) return;
  if (!activeLayer) { if (statusEl) statusEl.textContent = 'Select active layer'; return; }

  drawingPointerId = e.pointerId;

  const pos = renderer.screenToTile(e.clientX, e.clientY);
  const tx = pos.tx, ty = pos.ty;

  longTapStart.x = e.clientX;
  longTapStart.y = e.clientY;
  startLongTapTimer();

  if (activeTool === 'brush') {
    if (!brushGroup.length) { if (statusEl) statusEl.textContent = 'Brush empty'; return; }
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
    if (!resolveClassicAnchor()) {
      if (statusEl) statusEl.textContent = 'Classic: выбери terrain в BRUSH панели';
      return;
    }
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
    if (!brushGroup.length) { if (statusEl) statusEl.textContent = 'Brush empty'; return; }
    floodFill(tx, ty, pickWeightedTile());
    renderer.render();
    cancelLongTap();
  } else if (activeTool === 'picker') {
    pickerAt(tx, ty);
    renderer.render();
    cancelLongTap();
  }
});

if (cv) cv.addEventListener('pointermove', (e) => {
  if (!renderer) return;

  if (!pointers.has(e.pointerId)) {
    if (e.pointerType === 'mouse' && mapModel) {
      const pos = renderer.screenToTile(e.clientX, e.clientY);
      renderer.hoverTile = { tx: pos.tx, ty: pos.ty };
      renderer.render();
      updateInfo(pos.tx, pos.ty);
    }
    return;
  }

  const prev = pointers.get(e.pointerId);
  const dx = e.clientX - prev.x;
  const dy = e.clientY - prev.y;
  prev.x = e.clientX;
  prev.y = e.clientY;

  if (longTapTimer && (Math.abs(e.clientX - longTapStart.x) > 6 ||
                       Math.abs(e.clientY - longTapStart.y) > 6)) {
    cancelLongTap();
  }

  if (pointers.size >= 2) {
    const arr = Array.from(pointers.values());
    const d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    const mx = (arr[0].x + arr[1].x) / 2;
    const my = (arr[0].y + arr[1].y) / 2;

    renderer.view.x += (mx - lastPinchMidX);
    renderer.view.y += (my - lastPinchMidY);

    if (lastPinchDist > 8 && d > 8) {
      const k = d / lastPinchDist;
      if (Math.abs(k - 1) > 0.002) {
        const r = wrap.getBoundingClientRect();
        renderer.zoomAt(mx - r.left, my - r.top, k);
      }
    }

    lastPinchDist = d;
    lastPinchMidX = mx;
    lastPinchMidY = my;
    renderer.render();
    updateZoomLabels();
    return;
  }

  if (drag.active) {
    renderer.view.x += dx;
    renderer.view.y += dy;
    renderer.render();
    return;
  }

  if (painting) {
    const pos = renderer.screenToTile(e.clientX, e.clientY);
    renderer.hoverTile = { tx: pos.tx, ty: pos.ty };
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
    renderer.render();
    updateInfo(pos.tx, pos.ty);
  }
});

if (cv) cv.addEventListener('pointerup', (e) => {
  if (!renderer) return;
  const wasDrawing = (drawingPointerId === e.pointerId);
  pointers.delete(e.pointerId);
  cancelLongTap();

  if (longTapFired) {
    longTapFired = false;
    if (pointers.size === 0) {
      multiPointerActive = false;
      drag.active = false;
      drawingPointerId = null;
    }
    return;
  }

  if (pointers.size === 0) {
    multiPointerActive = false;

    if (drag.active) {
      drag.active = false;
      if (cv) cv.classList.remove('drag');
    }

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
    drawingPointerId = null;
  } else if (pointers.size === 1 && multiPointerActive) {
    const rem = Array.from(pointers.values())[0];
    drag.active = true;
    drag.x = rem.x;
    drag.y = rem.y;
  }
});

if (cv) cv.addEventListener('pointercancel', (e) => {
  pointers.delete(e.pointerId);
  cancelLongTap();
  if (pointers.size === 0) {
    if (painting) { painting = false; endStroke(); }
    drag.active = false;
    multiPointerActive = false;
    drawingPointerId = null;
    if (renderer) renderer.render();
  }
});

if (cv) cv.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse' && !pointers.has(e.pointerId)) {
    if (renderer) {
      renderer.hoverTile = null;
      renderer.render();
    }
  }
});

if (cv) cv.addEventListener('contextmenu', (e) => e.preventDefault());

function updateInfo(tx, ty) {
  if (!infoEl) return;
  if (!mapModel) { infoEl.textContent = '—'; return; }
  if (tx < 0 || ty < 0 || tx >= mapModel.W || ty >= mapModel.H) { infoEl.textContent = '—'; return; }
  let out = 'Tile: <b>' + tx + ', ' + ty + '</b>';
  for (const n of mapModel.layerOrder) {
    const id = mapModel.layers[n][ty * mapModel.W + tx];
    if (id) out += ' · ' + n + '=<b>' + id + '</b>';
  }
  infoEl.innerHTML = out;
}

// ─── WASD pan ───
const panKeys = new Set();
let panRaf = null;
function startPanKey(code) {
  panKeys.add(code);
  if (!panRaf) panRaf = requestAnimationFrame(panTick);
}
function stopPanKey(code) { panKeys.delete(code); }
function panTick() {
  panRaf = null;
  if (!renderer || !panKeys.size) return;
  const speed = 12 / renderer.view.zoom;
  let dx = 0, dy = 0;
  if (panKeys.has('KeyW')) dy -= 1;
  if (panKeys.has('KeyS')) dy += 1;
  if (panKeys.has('KeyA')) dx -= 1;
  if (panKeys.has('KeyD')) dx += 1;
  if (dx || dy) {
    renderer.view.x -= dx * speed;
    renderer.view.y -= dy * speed;
    renderer.render();
  }
  if (panKeys.size) panRaf = requestAnimationFrame(panTick);
}

if (wrap) wrap.addEventListener('wheel', (e) => {
  if (!mapModel || !renderer) return;
  e.preventDefault();
  const r = wrap.getBoundingClientRect();
  const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  renderer.zoomAt(e.clientX - r.left, e.clientY - r.top, f);
  updateZoomLabels();
}, { passive: false });

// ─── Hotkeys ───
window.addEventListener('keydown', (e) => {
  const tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

  if (e.key === 'Escape') { if (pickMode) { endPick(); return; } }

  if (e.ctrlKey || e.metaKey) {
    if (e.code === 'KeyZ') { e.preventDefault(); doUndo(); return; }
    if (e.code === 'KeyY') { e.preventDefault(); doRedo(); return; }
    if (e.code === 'KeyS') { e.preventDefault(); saveMap(); return; }
    return;
  }

  if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
    if (!panKeys.has(e.code)) startPanKey(e.code);
    return;
  }

  const map = {
    KeyM: 'pan', KeyB: 'brush', KeyY: 'terrain', KeyT: 'classic',
    KeyE: 'eraser', KeyR: 'rect', KeyF: 'fill', KeyK: 'picker'
  };
  const tool = map[e.code];
  if (tool) { e.preventDefault(); handleToolClick(tool); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'KeyA' || e.code === 'KeyS' || e.code === 'KeyD') {
    stopPanKey(e.code);
  }
});
window.addEventListener('blur', () => { panKeys.clear(); });

on('btnUndo', 'click', doUndo);
on('btnRedo', 'click', doRedo);

on('btnNew', 'click', loadNewMap);

async function loadNewMap() {
  if (statusEl) statusEl.textContent = 'Loading new.tmx...';
  try {
    const res = await fetch('new.tmx', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' — проверь что new.tmx в корне');
    const text = await res.text();
    const parsed = RW.TMX.parse(text);
    await RW.TMX.loadImages(parsed);
    await initFromParsed(parsed, 'new.tmx');
    if (statusEl) statusEl.textContent = 'New map: ' + mapModel.W + '×' + mapModel.H +
      ' · layers: ' + mapModel.layerOrder.length;
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = 'New error: ' + err.message;
  }
}

on('btnOpen', 'click', () => { const f = el('fileInput'); if (f) f.click(); });

on('fileInput', 'change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (statusEl) statusEl.textContent = 'Parsing...';
  try {
    const text = await file.text();
    const parsed = RW.TMX.parse(text);
    await RW.TMX.loadImages(parsed);
    await initFromParsed(parsed, file.name);
    if (statusEl) statusEl.textContent = 'OK ' + mapModel.W + '×' + mapModel.H +
      ' · tilesets: ' + mapModel.tilesets.length +
      ' · layers: ' + mapModel.layerOrder.length;
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = 'Error: ' + err.message;
  }
  e.target.value = '';
});

async function initFromParsed(parsed, filename) {
  mapModel = new RW.MapModel(parsed);
  _markersCache = null;

  renderer = new RW.Renderer(cv, () => mapModel);
  
  // ─── FPS LOCK ───
  // На мобилках — 60 FPS (экономия батареи), на ПК — без ограничений
  renderer.targetFps = (typeof mobile !== 'undefined' && mobile.isMobile()) ? 60 : 0;

  renderer.layerVisibility = {};
  for (const n of mapModel.layerOrder) renderer.layerVisibility[n] = true;
  renderer.onFps = (fps, chunks) => {
    if (fpsEl) fpsEl.textContent = fps + ' fps · chunks ' + chunks;
  };
  renderer.getMarkers = () => getMarkersCached();
  renderer.showMarkers = !!settings.showMarkers;
  renderer.markerScale = settings.markerScale || 1;
  renderer.setBg(settings.canvasBg || '#0a0a0a');

  // Reference
  renderer.setReference(refImage);
  renderer.setReferenceOpacity(settings.reference.opacity);
  renderer.setReferenceMode(settings.reference.mode);

  activeLayer = mapModel.layerOrder[0] || null;
  brushGroup = [];
  pickMode = null;
  if (pickBannerEl) pickBannerEl.classList.add('hidden');

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

  brushPanel = new RW.BrushPanel({
    listEl: brushListEl,
    totalEl: brushTotalEl,
    settingsEl: brushSettingsEl,
    classicListEl: classicListEl,
    tnsListEl: tnsListEl,
    classicPanelEl: classicPanelEl,
    tnsPanelEl: tnsPanelEl,
    ctx: {
      getMap: () => mapModel,
      getRenderer: () => renderer,
      getBrush: () => brushGroup,
      getBrushSettings: () => brushSettings,
      getActiveTool: () => activeTool,
      getTypesModel: () => typesModel,
      getActiveType: () => activeTypeId,
      setActiveType: (id) => { activeTypeId = id; },
      getActiveClassicTerrain: () => activeClassicTerrain,
      setActiveClassicTerrain: (anchor) => {
        activeClassicTerrain = anchor;
        if (statusEl) {
          const a = resolveClassicAnchor();
          if (a) statusEl.textContent = 'Classic: ' + a.ts.name +
            ' · ' + a.terrType.name +
            ' (local ' + a.terrType.tile +
            ' → global ' + (a.terrType.tile + a.ts.firstgid) + ')';
        }
      },
      onBrushChanged: () => {
        if (tilesetTabs) tilesetTabs.refreshSelection();
      },
      onBrushSettingsChanged: () => {},
      findTileset: (id) => renderer.findTileset(id)
    }
  });

  tilesetTabs = new RW.TilesetTabs(tsTabsListEl, tsBodyEl, bottomEl, {
    getMap: () => mapModel,
    getRenderer: () => renderer,
    getBrush: () => brushGroup,
    getModel: () => typesModel,
    getPickMode: () => pickMode,
    addToBrush: (id, add) => addToBrush(id, add),
    applyPick: (id) => applyPick(id),
    onAddTileset: () => { const t = el('tilesetInput'); if (t) t.click(); }
  });

  typesPanel = new RW.TypesPanel(typesBodyEl, {
    getModel: () => typesModel,
    getActiveType: () => activeTypeId,
    setActiveType: (id) => { activeTypeId = id; },
    getPickMode: () => pickMode,
    startPick: (mode) => startPick(mode),
    endPick: () => endPick(),
    findTileset: (id) => renderer.findTileset(id),
    onChanged: () => { typesPanel.build(); if (brushPanel) brushPanel.build(); },
    onImportMiniTNS: () => startMiniTNSImport(),
    onOpenLibrary: () => openMiniTNSLibrary()
  });

  layersPanel.build();
  brushPanel.build();
  tilesetTabs.build();
  typesPanel.build();
  buildTools();

  if (mapNameEl) {
    const n = filename || parsed._restoredFilename || 'map.tmx';
    mapNameEl.value = n;
    const m = el('mapNameMobile'); if (m) m.value = n;
  }

  renderer.fitView();
  updateZoomLabels();

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

on('btnSave', 'click', saveMap);
function saveMap() {
  if (!mapModel) { if (statusEl) statusEl.textContent = 'No map'; return; }
  try {
    const mob = el('mapNameMobile');
    if (mob && mapNameEl && mob.value) mapNameEl.value = mob.value;
    const xml = RW.TMX.save(mapModel, typesModel);
    let filename = (mapNameEl && mapNameEl.value || '').trim() || 'map.tmx';
    if (!filename.toLowerCase().endsWith('.tmx')) filename += '.tmx';
    U.download(filename, xml, 'application/xml');
    if (statusEl) statusEl.textContent = 'Saved: ' + filename;
    mapModel.rawXml = xml;
    if (typeof closeMapModal === 'function') closeMapModal();
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = 'Save error: ' + err.message;
  }
}

function doResize() {
  if (!mapModel) { if (statusEl) statusEl.textContent = 'No map'; return; }
  const nw = parseInt(prompt('New width (' + mapModel.W + '):', String(mapModel.W)), 10);
  if (isNaN(nw) || nw < 1 || nw > 4096) return;
  const nh = parseInt(prompt('New height (' + mapModel.H + '):', String(mapModel.H)), 10);
  if (isNaN(nh) || nh < 1 || nh > 4096) return;
  const entry = mapModel.resize(nw, nh);
  if (!entry) return;
  renderer.invalidate();
  renderer.fitView();
  updateZoomLabels();
  if (layersPanel) layersPanel.build();
  renderer.render();
  if (statusEl) statusEl.textContent = 'Size: ' + nw + '×' + nh;
}

function doMerge() {
  if (!RW.MergeUI) return;
  RW.MergeUI.open({
    onMerge: async (merged) => {
      await RW.TMX.loadImages(merged);
      await initFromParsed(merged, 'merged.tmx');
      if (statusEl) statusEl.textContent = 'Merged: ' + merged.W + '×' + merged.H +
        ' · tilesets: ' + merged.tilesets.length +
        ' · layers: ' + merged.layerOrder.length;
    }
  });
}

on('btnResize', 'click', doResize);
on('btnMerge', 'click', doMerge);
on('btnExportMap', 'click', exportMapPNG);

on('tilesetInput', 'change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!mapModel) { if (statusEl) statusEl.textContent = 'Open a map first'; return; }

  // ─── NEW: IMPORT FROM TMX ───
  if (file.name.toLowerCase().endsWith('.tmx')) {
    if (statusEl) statusEl.textContent = 'Parsing .tmx for tilesets...';
    try {
      const text = await file.text();
      const parsed = RW.TMX.parse(text);
      await RW.TMX.loadImages(parsed);
      
      if (!parsed.tilesets || !parsed.tilesets.length) {
        alert('В этом .tmx нет тайлсетов.');
        if (statusEl) statusEl.textContent = 'No tilesets found in TMX';
        return;
      }

      openTmxImportModal(parsed.tilesets);
      if (statusEl) statusEl.textContent = 'Found ' + parsed.tilesets.length + ' tilesets';
    } catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = 'TMX Import error: ' + err.message;
    }
    return;
  }

  // ─── EXISTING: IMPORT IMAGE ───
  try {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const b64 = U.bytesToB64(bytes);
    const dataUrl = 'data:image/png;base64,' + b64;
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res; img.onerror = () => rej(new Error('Cannot read PNG'));
      img.src = dataUrl;
    });
    const tw = mapModel.tw, th = mapModel.th;
    const cols = Math.floor(img.naturalWidth / tw);
    const rows = Math.floor(img.naturalHeight / th);
    if (cols < 1 || rows < 1) throw new Error('PNG smaller than one tile ' + tw + '×' + th);
    const tilecount = cols * rows;
    const defName = (file.name || 'tileset').replace(/\.png$/i, '');
    const name = prompt('Tileset name:', defName);
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
      terrainTypes: [], tiles: {}, xmlStr: null, _dirty: true
    };
    mapModel.tilesets.push(ts);
    mapModel.tilesets.sort((a, b) => a.firstgid - b.firstgid);
    if (tilesetTabs) {
      tilesetTabs.activeIdx = mapModel.tilesets.indexOf(ts);
      tilesetTabs.build();
    }
    if (brushPanel) brushPanel.build();
    invalidateMarkersCache();
    if (statusEl) statusEl.textContent = 'Tileset added: ' + name +
      ' (' + cols + '×' + rows + ', firstgid=' + firstgid + ')';
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = 'Tileset error: ' + err.message;
  }
});

// ═══════════════════════════════════════════════
// TMX TILESET IMPORT MODAL LOGIC
// ═══════════════════════════════════════════════
function openTmxImportModal(tilesets) {
  _pendingImportTilesets = tilesets;
  const modal = el('importTmxTilesetsModal');
  const list = el('importTmxList');
  if (!modal || !list) return;

  list.innerHTML = '';
  tilesets.forEach((ts, idx) => {
    const row = document.createElement('label');
    row.className = 'import-tmx-item';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = true;
    cb.dataset.idx = idx;

    const cnv = document.createElement('canvas');
    cnv.width = 40; cnv.height = 40;
    const g = cnv.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (ts.image) {
      g.drawImage(ts.image, 0, 0, 40, 40);
    } else {
      g.fillStyle = '#333';
      g.fillRect(0, 0, 40, 40);
    }

    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('b');
    name.textContent = ts.name;
    const size = document.createElement('span');
    size.textContent = ts.tilecount + ' tiles · ' + ts.tileW + '×' + ts.tileH;
    info.append(name, size);

    row.append(cb, cnv, info);
    list.appendChild(row);
  });

  modal.classList.remove('hidden');
}

function closeTmxImportModal() {
  const modal = el('importTmxTilesetsModal');
  if (modal) modal.classList.add('hidden');
  _pendingImportTilesets = [];
}

on('importTmxClose', 'click', closeTmxImportModal);
on('importTmxCancel', 'click', closeTmxImportModal);

on('importTmxAdd', 'click', () => {
  const checkboxes = document.querySelectorAll('#importTmxList input[type=checkbox]:checked');
  if (!checkboxes.length) { closeTmxImportModal(); return; }
  if (!mapModel) { alert('Open a map first'); closeTmxImportModal(); return; }

  let addedCount = 0;

  checkboxes.forEach(cb => {
    const idx = parseInt(cb.dataset.idx, 10);
    const srcTs = _pendingImportTilesets[idx];
    if (!srcTs) return;

    // Find next firstgid
    let maxEnd = 1;
    for (const ts of mapModel.tilesets) {
      const end = ts.firstgid + ts.tilecount;
      if (end > maxEnd) maxEnd = end;
    }

    // Deep copy tileset
    const newTs = {
      firstgid: maxEnd,
      name: srcTs.name,
      columns: srcTs.columns,
      tilecount: srcTs.tilecount,
      tileW: srcTs.tileW,
      tileH: srcTs.tileH,
      image: srcTs.image,
      imageDataUrl: srcTs.imageDataUrl,
      embeddedPngB64: srcTs.embeddedPngB64,
      imageSource: srcTs.imageSource,
      imageW: srcTs.imageW,
      imageH: srcTs.imageH,
      terrainTypes: JSON.parse(JSON.stringify(srcTs.terrainTypes || [])),
      tiles: JSON.parse(JSON.stringify(srcTs.tiles || {})),
      xmlStr: null,
      _dirty: true
    };

    // Resolve name conflicts
    let finalName = newTs.name;
    if (mapModel.tilesets.find(t => t.name === finalName)) {
      let i = 2;
      while (mapModel.tilesets.find(t => t.name === finalName + '_' + i)) i++;
      newTs.name = finalName + '_' + i;
    }

    mapModel.tilesets.push(newTs);
    addedCount++;
  });

  mapModel.tilesets.sort((a, b) => a.firstgid - b.firstgid);
  
  if (tilesetTabs) {
    tilesetTabs.activeIdx = mapModel.tilesets.length - 1;
    tilesetTabs.build();
  }
  if (brushPanel) brushPanel.build();
  invalidateMarkersCache();
  
  closeTmxImportModal();
  if (statusEl) statusEl.textContent = `Imported ${addedCount} tilesets from TMX.`;
});

function startMiniTNSImport() {
  if (!mapModel) { if (statusEl) statusEl.textContent = 'Open a map first'; return; }
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/png,image/*';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try { await importMiniTNS(f); }
    catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = 'MiniTNS: ' + err.message;
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
  await new Promise((res, rej) => {
    img.onload = res; img.onerror = () => rej(new Error('Cannot read PNG'));
    img.src = dataUrl;
  });
  const tw = mapModel.tw, th = mapModel.th;
  const cols = Math.floor(img.naturalWidth / tw);
  const rows = Math.floor(img.naturalHeight / th);
  if (cols !== 3 || rows !== 5) throw new Error('PNG must be 3×5 tiles');
  const tilecount = 15;
  const defName = (file.name || 'MiniTNS').replace(/\.png$/i, '');
  const name = prompt('Tileset name:', defName);
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
    terrainTypes: [], tiles: {}, xmlStr: null, _dirty: true
  };
  mapModel.tilesets.push(ts);
  mapModel.tilesets.sort((a, b) => a.firstgid - b.firstgid);
  if (tilesetTabs) {
    tilesetTabs.activeIdx = mapModel.tilesets.indexOf(ts);
    tilesetTabs.build();
  }
  const typeName = prompt('Type name:', defName) || defName;
  const t = typesModel.add(typeName, typesModel.types.length);
  const g = (local) => firstgid + local;

  const isTileEmpty = RW.MiniTNSLib && RW.MiniTNSLib.isTileEmpty
    ? RW.MiniTNSLib.isTileEmpty
    : function(img, tw, th, col, row) {
        const c = document.createElement('canvas');
        c.width = tw; c.height = th;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, tw, th);
        ctx.drawImage(img, col*tw, row*th, tw, th, 0, 0, tw, th);
        const d = ctx.getImageData(0, 0, tw, th).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
        return true;
      };

  const solidLocals = [4];
  if (!isTileEmpty(img, tw, th, 2, 3)) solidLocals.push(11);
  if (!isTileEmpty(img, tw, th, 2, 4)) solidLocals.push(14);

  t.solids = [];
  for (const local of solidLocals) {
    t.solids.push({ tileID: g(local), weight: 1 });
  }

  t.edges.NWo = g(0); t.edges.N = g(1); t.edges.NEo = g(2);
  t.edges.W = g(3); t.edges.E = g(5);
  t.edges.SWo = g(6); t.edges.S = g(7); t.edges.SEo = g(8);
  t.edges.NWi = g(9); t.edges.NEi = g(10);
  t.edges.SWi = g(12); t.edges.SEi = g(13);
  activeTypeId = t.id;
  if (typesPanel) typesPanel.build();
  if (brushPanel) brushPanel.build();
  invalidateMarkersCache();
  if (statusEl) statusEl.textContent = 'MiniTNS: tileset "' + name + '" + type "' + typeName + '"';
}

let _markersCache = null;
function getMarkersCached() {
  if (!mapModel) return { starts: [], respools: [] };
  if (_markersCache) return _markersCache;
  _markersCache = RW.Markers.find(mapModel);
  return _markersCache;
}
function invalidateMarkersCache() { _markersCache = null; }

function findTsForId(tilesets, id) {
  let f = null;
  for (const ts of tilesets) { if (id >= ts.firstgid) f = ts; else break; }
  return f;
}
function renderMapToNative(mapModel, markers) {
  const W = mapModel.W, H = mapModel.H;
  const tw = mapModel.tw, th = mapModel.th;
  const nW = W * tw, nH = H * th;
  const off = document.createElement('canvas');
  off.width = nW; off.height = nH;
  const o = off.getContext('2d');
  o.imageSmoothingEnabled = false;
  for (const ln of mapModel.layerOrder) {
    const data = mapModel.layers[ln];
    if (!data) continue;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const id = data[y * W + x];
      if (!id) continue;
      const ts = findTsForId(mapModel.tilesets, id);
      if (!ts || !ts.image) continue;
      const l = id - ts.firstgid;
      o.drawImage(ts.image,
        (l % ts.columns) * ts.tileW, Math.floor(l / ts.columns) * ts.tileH,
        ts.tileW, ts.tileH, x * tw, y * th, tw, th);
    }
  }
  if (markers && RW.Markers) {
    const M = RW.Markers;
    const scale = settings.markerScale || 1;
    const nScale = Math.max(nW, nH) / 500;
    const dotR = M.DOT_RADIUS_TILES * tw * scale;
    const circR = M.RADIUS_TILES * tw * scale;
    const fontPx = circR * 2 * M.FONT_RATIO;
    for (const p of markers.respools) {
      const cx = p.x * tw + tw/2, cy = p.y * th + th/2;
      o.beginPath(); o.arc(cx, cy, dotR, 0, Math.PI*2);
      o.fillStyle = '#ffea30'; o.fill();
      o.strokeStyle = '#000'; o.lineWidth = Math.max(1, nScale); o.stroke();
    }
    for (const s of markers.starts) {
      const cx = s.x * tw + tw/2, cy = s.y * th + th/2;
      const color = M.colorFor(s.team);
      o.beginPath(); o.arc(cx, cy, circR, 0, Math.PI*2);
      o.fillStyle = 'rgba(0,0,0,0.5)'; o.fill();
      o.strokeStyle = 'rgba(0,0,0,0.7)';
      o.lineWidth = Math.max(1, circR * 0.06); o.stroke();
      o.font = 'bold ' + fontPx + 'px "Arial Black", Arial, sans-serif';
      o.textAlign = 'center'; o.textBaseline = 'middle';
      o.fillStyle = color;
      o.shadowColor = 'rgba(0,0,0,0.9)';
      o.shadowBlur = fontPx * 0.15;
      o.fillText(String(s.team + 1), cx, cy);
      o.shadowBlur = 0;
    }
  }
  return { off, nativeW: nW, nativeH: nH };
}
function composePNG(native, nW, nH, target) {
  const out = document.createElement('canvas');
  out.width = target; out.height = target;
  const o = out.getContext('2d');
  o.fillStyle = '#000'; o.fillRect(0, 0, target, target);
  const s = Math.min(target / nW, target / nH);
  const dw = Math.max(1, Math.round(nW * s));
  const dh = Math.max(1, Math.round(nH * s));
  const dx = Math.floor((target - dw) / 2);
  const dy = Math.floor((target - dh) / 2);
  o.imageSmoothingEnabled = true; o.imageSmoothingQuality = 'high';
  o.drawImage(native, 0, 0, nW, nH, dx, dy, dw, dh);
  return out;
}
function exportMapPNG() {
  if (!mapModel) { if (statusEl) statusEl.textContent = 'No map'; return; }
  try {
    const markers = settings.showMarkers ? getMarkersCached() : null;
    const { off, nativeW, nativeH } = renderMapToNative(mapModel, markers);
    const composed = composePNG(off, nativeW, nativeH, 500);
    composed.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      const base = (mapNameEl && mapNameEl.value || 'map').replace(/\.tmx$/i, '') || 'map';
      a.download = base + '_map.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, 'image/png');
    if (statusEl) statusEl.textContent = 'Export: ' + nativeW + '×' + nativeH + ' → 500×500';
  } catch (err) {
    console.error(err);
    if (statusEl) statusEl.textContent = 'Export error: ' + err.message;
  }
}

// ═══════════════════════════════════════════════
// REFERENCE
// ═══════════════════════════════════════════════
const REF_DB_NAME = 'webtiled_ref';
const REF_STORE = 'handles';

function refOpenDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(REF_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(REF_STORE)) db.createObjectStore(REF_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function refSaveHandle(handle) {
  try {
    const db = await refOpenDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(REF_STORE, 'readwrite');
      tx.objectStore(REF_STORE).put(handle, 'ref');
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) { console.warn('IDB save failed', e); }
}
async function refGetHandle() {
  try {
    const db = await refOpenDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(REF_STORE, 'readonly');
      const r = tx.objectStore(REF_STORE).get('ref');
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  } catch (e) { return null; }
}
async function refClearHandle() {
  try {
    const db = await refOpenDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(REF_STORE, 'readwrite');
      tx.objectStore(REF_STORE).delete('ref');
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {}
}

async function refLoadImage(handle) {
  const f = await handle.getFile();
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('image decode failed'));
      i.src = url;
    });
    return img;
  } finally { URL.revokeObjectURL(url); }
}

function updateRefStatus(txt) {
  const el = document.getElementById('refStatusText');
  if (el) el.textContent = txt != null ? txt : (settings.reference.path || 'не выбран');
}

function applyReferenceToRenderer() {
  if (!renderer) return;
  renderer.setReference(refImage);
  renderer.setReferenceOpacity(settings.reference.opacity);
  renderer.setReferenceMode(settings.reference.mode);
}

async function pickReference() {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Images',
          accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp'] }
        }]
      });
      if (!handle) return;
      refHandle = handle;
      await refSaveHandle(handle);
      refImage = await refLoadImage(handle);
      settings.reference.path = handle.name;
      RW.Storage.saveSettings(settings);
      applyReferenceToRenderer();
      updateRefStatus();
      if (statusEl) statusEl.textContent = 'Reference: ' + handle.name;
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.warn('ref pick failed', e);
        if (statusEl) statusEl.textContent = 'Reference error: ' + e.message;
      }
    }
    return;
  }
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    try {
      refImage = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('image decode failed'));
        i.src = url;
      });
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Reference error: ' + e.message;
      URL.revokeObjectURL(url);
      return;
    }
    URL.revokeObjectURL(url);
    settings.reference.path = f.name;
    RW.Storage.saveSettings(settings);
    applyReferenceToRenderer();
    updateRefStatus();
    if (statusEl) statusEl.textContent = 'Reference: ' + f.name + ' (не сохранится между сессиями)';
  };
  inp.click();
}

async function tryRestoreReference() {
  if (!settings.reference.path) { updateRefStatus(); return; }
  if (!window.showOpenFilePicker) {
    updateRefStatus('Firefox/Safari — выбери файл заново');
    return;
  }
  try {
    const handle = await refGetHandle();
    if (!handle) { updateRefStatus('Выбери файл заново'); return; }
    const perm = await handle.queryPermission({ mode: 'read' });
    if (perm !== 'granted') {
      updateRefStatus('Нужен доступ — выбери файл заново');
      return;
    }
    refHandle = handle;
    refImage = await refLoadImage(handle);
    applyReferenceToRenderer();
    updateRefStatus();
  } catch (e) {
    console.warn('ref restore failed', e);
    updateRefStatus('Выбери файл заново');
  }
}

async function clearReference() {
  refImage = null;
  refHandle = null;
  settings.reference.path = '';
  RW.Storage.saveSettings(settings);
  await refClearHandle();
  applyReferenceToRenderer();
  updateRefStatus('Удалён');
  if (statusEl) statusEl.textContent = 'Reference cleared';
}

function bindRefControls() {
  const op = el('refOpacity');
  const opv = el('refOpacityVal');
  const un = el('refUnderlay');
  if (op && !op._bound) {
    op._bound = true;
    op.value = settings.reference.opacity;
    if (opv) opv.textContent = (+settings.reference.opacity).toFixed(2);
    op.addEventListener('input', () => {
      const v = parseFloat(op.value) || 0;
      settings.reference.opacity = v;
      if (opv) opv.textContent = v.toFixed(2);
      RW.Storage.saveSettings(settings);
      if (renderer) renderer.setReferenceOpacity(v);
    });
  }
  if (un && !un._bound) {
    un._bound = true;
    un.checked = (settings.reference.mode === 'underlay');
    un.addEventListener('change', () => {
      settings.reference.mode = un.checked ? 'underlay' : 'overlay';
      RW.Storage.saveSettings(settings);
      if (renderer) renderer.setReferenceMode(settings.reference.mode);
    });
  }
  on('refPickBtn', 'click', pickReference);
  on('refClearBtn', 'click', clearReference);
}

// ═══════════════════════════════════════════════
// FULLSCREEN API
// ═══════════════════════════════════════════════
function toggleFullscreen() {
  const doc = window.document;
  const docEl = doc.documentElement;

  const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
  const cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

  if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
    if (requestFullScreen) {
      requestFullScreen.call(docEl).catch(err => {
        if (statusEl) statusEl.textContent = 'Fullscreen error: ' + err.message;
      });
    } else {
      if (statusEl) statusEl.textContent = 'Fullscreen не поддерживается на этом устройстве (iOS Safari)';
    }
  } else {
    if (cancelFullScreen) {
      cancelFullScreen.call(doc);
    }
  }
}

function updateFullscreenBtn() {
  const isFull = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
  const btnTop = el('btnMobileFullscreen');
  const btnUtil = el('utilFullscreen');
  
  if (btnTop) btnTop.textContent = isFull ? '⛶' : '⛶'; 
  if (btnUtil) {
    const lbl = btnUtil.querySelector('.ma-lbl');
    if (lbl) lbl.textContent = RW.I18N.t(isFull ? 'btn.exitFullscreen' : 'btn.fullscreen');
    const ic = btnUtil.querySelector('.ma-ic');
    if (ic) ic.textContent = isFull ? '🗗' : '⛶';
  }
  
  setTimeout(() => {
    if (renderer) renderer.resize();
  }, 200);
}

document.addEventListener('fullscreenchange', updateFullscreenBtn);
document.addEventListener('webkitfullscreenchange', updateFullscreenBtn);
document.addEventListener('mozfullscreenchange', updateFullscreenBtn);
document.addEventListener('MSFullscreenChange', updateFullscreenBtn);

// ═══════════════════════════════════════════════
// SETTINGS MODAL
// ═══════════════════════════════════════════════
let settingsModalEl = null;
let settingsSnapshot = null;

function openSettings() {
  settingsModalEl = el('settingsModal');
  if (!settingsModalEl) { if (statusEl) statusEl.textContent = 'Settings modal not found in HTML'; return; }

  if (!settingsModalEl._bound) {
    settingsModalEl._bound = true;
    on('settingsClose', 'click', closeSettings);
    on('settingsCancel', 'click', closeSettings);
    on('settingsApply', 'click', applySettings);
    on('settingsCanvasBg', 'input', (e) => {
      if (wrap) wrap.style.background = e.target.value;
      if (renderer) renderer.render();
    });
    on('settingsAtlasBg', 'input', (e) => { applyAtlasBg(e.target.value); });
    on('settingsMarkerScale', 'input', (e) => {
      const v = parseFloat(e.target.value);
      const valEl = el('settingsMarkerScaleVal');
      if (valEl) valEl.textContent = v.toFixed(2) + '×';
      if (renderer) { renderer.markerScale = v; renderer.render(); }
    });
  }

  settingsSnapshot = {
    canvasBg: settings.canvasBg, atlasBg: settings.atlasBg,
    showMarkers: settings.showMarkers, markerScale: settings.markerScale,
    lang: settings.lang
  };

  const lEn = el('settingsLangEn'), lRu = el('settingsLangRu');
  if (lEn) lEn.classList.toggle('active', settings.lang === 'en');
  if (lRu) lRu.classList.toggle('active', settings.lang === 'ru');
  const bgEl = el('settingsCanvasBg'); if (bgEl) bgEl.value = settings.canvasBg;
  const abEl = el('settingsAtlasBg'); if (abEl) abEl.value = settings.atlasBg;
  const smEl = el('settingsShowMarkers'); if (smEl) smEl.checked = !!settings.showMarkers;
  const msEl = el('settingsMarkerScale'); if (msEl) msEl.value = settings.markerScale || 1;
  const mvEl = el('settingsMarkerScaleVal'); if (mvEl) mvEl.textContent = (settings.markerScale || 1).toFixed(2) + '×';

  if (wrap) wrap.style.background = settings.canvasBg;
  settingsModalEl.classList.remove('hidden');
}

function closeSettings() {
  if (settingsSnapshot) {
    settings.canvasBg = settingsSnapshot.canvasBg;
    settings.atlasBg = settingsSnapshot.atlasBg;
    settings.showMarkers = settingsSnapshot.showMarkers;
    settings.markerScale = settingsSnapshot.markerScale;
    settings.lang = settingsSnapshot.lang;
    RW.Storage.saveSettings(settings);
  }
  if (wrap) wrap.style.background = settings.canvasBg;
  applyAtlasBg(settings.atlasBg);
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
  const bgEl = el('settingsCanvasBg');
  const abEl = el('settingsAtlasBg');
  const smEl = el('settingsShowMarkers');
  const msEl = el('settingsMarkerScale');
  if (bgEl) settings.canvasBg = bgEl.value || '#0a0a0a';
  if (abEl) settings.atlasBg = abEl.value || '#0a0a0a';
  if (smEl) settings.showMarkers = smEl.checked;
  if (msEl) settings.markerScale = parseFloat(msEl.value) || 1;
  RW.Storage.saveSettings(settings);
  if (wrap) wrap.style.background = settings.canvasBg;
  applyAtlasBg(settings.atlasBg);
  if (renderer) {
    renderer.setBg(settings.canvasBg);
    renderer.showMarkers = !!settings.showMarkers;
    renderer.markerScale = settings.markerScale;
    renderer.render();
  }
  if (settingsModalEl) settingsModalEl.classList.add('hidden');
  if (statusEl) statusEl.textContent = 'Settings applied';
}

function pickLang(lang) {
  settings.lang = lang;
  RW.I18N.set(lang);
  const lEn = el('settingsLangEn'), lRu = el('settingsLangRu');
  if (lEn) lEn.classList.toggle('active', lang === 'en');
  if (lRu) lRu.classList.toggle('active', lang === 'ru');
}

on('btnSettings', 'click', openSettings);
on('settingsLangEn', 'click', () => pickLang('en'));
on('settingsLangRu', 'click', () => pickLang('ru'));
on('btnDocs', 'click', () => window.open('WebTiledDoc.html', '_blank', 'noopener'));

on('btnAtlasesTab', 'click', () => {
  const b = el('btnAtlasesTab'); if (!b) return;
  const a = b.classList.toggle('active');
  if (bottomEl) bottomEl.classList.toggle('atlases-hidden', !a);
  if (a && tilesetTabs) tilesetTabs.build();
});
on('btnTypesTab', 'click', () => {
  const b = el('btnTypesTab'); if (!b) return;
  const a = b.classList.toggle('active');
  if (bottomEl) bottomEl.classList.toggle('types-hidden', !a);
  if (a && typesPanel) typesPanel.build();
});

// ─── GUARD: mobile vs desktop toggle ───
on('btnToggleBottom', 'click', (e) => {
  if (!bottomEl) return;
  if (typeof mobile !== 'undefined' && mobile.isMobile() && mobile.bottomOpen) {
    return;
  }
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
  if (!bottomGrabberEl || !bottomEl) return;
  let resizing = false;
  bottomGrabberEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    resizing = true;
    delete bottomEl.dataset.savedHeight;
    bottomEl.classList.remove('collapsed');
    const tb = el('btnToggleBottom'); if (tb) tb.textContent = '▼';
    bottomEl.classList.add('no-transition');
    bottomGrabberEl.classList.add('dragging');
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const h = window.innerHeight - e.clientY;
    const c = Math.max(60, Math.min(window.innerHeight - 120, h));
    bottomEl.style.height = c + 'px';
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

function doFit() {
  if (renderer) {
    renderer.fitView();
    updateZoomLabels();
  }
}
function doReset() {
  if (renderer) {
    renderer.resetView();
    updateZoomLabels();
  }
}
on('btnFit', 'click', doFit);
on('btnReset', 'click', doReset);
on('btnHelp', 'click', () => alert(
  'M — Move, B — Brush, Y — Type/Solid, T — Terrain (CLS)\n' +
  'E — Erase, R — Rect, F — Fill, K — Picker\n' +
  'WASD — pan · Middle-mouse — pan (editor & atlas)\n' +
  'Touch: 1 finger draw · 2 fingers pan/pinch · long-tap erase\n' +
  'Ctrl+Z / Ctrl+Y — Undo / Redo, Ctrl+S — Save'
));
on('btnAddEmpty', 'click', addEmptyToBrush);
on('btnFlood', 'click', runFloodDominant);
on('btnClearBrush', 'click', () => {
  brushGroup = [];
  if (brushPanel) brushPanel.build();
  if (tilesetTabs) tilesetTabs.refreshSelection();
});
if (mapNameEl) {
  mapNameEl.addEventListener('input', () => {
    const m = el('mapNameMobile');
    if (m) m.value = mapNameEl.value;
  });
}
on('btnPickCancel', 'click', () => endPick());
on('btnWarnClose', 'click', () => {
  if (warnBannerEl) warnBannerEl.classList.add('hidden');
});

function openMiniTNSLibrary() {
  if (!mapModel) { if (statusEl) statusEl.textContent = 'Open a map first'; return; }
  if (!RW.MiniTNSLib) { if (statusEl) statusEl.textContent = 'MiniTNSLib not loaded'; return; }
  RW.MiniTNSLib.open(async (entry) => {
    RW.MiniTNSLib.close();
    try { await addMiniTNSFromEntry(entry); }
    catch (err) {
      console.error(err);
      if (statusEl) statusEl.textContent = 'MiniTNS: ' + err.message;
    }
  });
}

async function addMiniTNSFromEntry(entry) {
  const tw = mapModel.tw, th = mapModel.th;
  const img = entry.img;
  const cols = Math.floor(img.naturalWidth / tw);
  const rows = Math.floor(img.naturalHeight / th);
  if (cols !== 3 || rows !== 5) throw new Error('PNG not 3×5 tiles');
  const tilecount = 15;
  let firstgid = 1;
  for (const ts of mapModel.tilesets) {
    const end = ts.firstgid + ts.tilecount;
    if (end > firstgid) firstgid = end;
  }
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
    terrainTypes: [], tiles: {}, xmlStr: null, _dirty: true
  };
  mapModel.tilesets.push(ts);
  mapModel.tilesets.sort((a, b) => a.firstgid - b.firstgid);
  if (tilesetTabs) {
    tilesetTabs.activeIdx = mapModel.tilesets.indexOf(ts);
    tilesetTabs.build();
  }
  let typeName = entry.name;
  if (typesModel.types.find(t => t.name === typeName)) {
    let i = 2;
    while (typesModel.types.find(t => t.name === typeName + '_' + i)) i++;
    typeName = typeName + '_' + i;
  }
  const t = typesModel.add(typeName, entry.priority);
  const g = (local) => firstgid + local;

  const isTileEmpty = RW.MiniTNSLib && RW.MiniTNSLib.isTileEmpty
    ? RW.MiniTNSLib.isTileEmpty
    : function(img, tw, th, col, row) {
        const c = document.createElement('canvas');
        c.width = tw; c.height = th;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, tw, th);
        ctx.drawImage(img, col*tw, row*th, tw, th, 0, 0, tw, th);
        const d = ctx.getImageData(0, 0, tw, th).data;
        for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return false;
        return true;
      };

  const solidLocals = [4];
  if (!isTileEmpty(img, tw, th, 2, 3)) solidLocals.push(11);
  if (!isTileEmpty(img, tw, th, 2, 4)) solidLocals.push(14);

  const entryProps = entry.properties || {};
  const hasProps = Object.keys(entryProps).length > 0;

  t.solids = [];
  for (const local of solidLocals) {
    if (hasProps) {
      if (!ts.tiles[local]) ts.tiles[local] = { terrain: null, props: {} };
      for (const k in entryProps) {
        ts.tiles[local].props[k] = entryProps[k];
      }
    }
    t.solids.push({ tileID: g(local), weight: 1 });
  }

  t.edges.NWo = g(0); t.edges.N = g(1); t.edges.NEo = g(2);
  t.edges.W = g(3); t.edges.E = g(5);
  t.edges.SWo = g(6); t.edges.S = g(7); t.edges.SEo = g(8);
  t.edges.NWi = g(9); t.edges.NEi = g(10);
  t.edges.SWi = g(12); t.edges.SEi = g(13);

  activeTypeId = t.id;
  if (typesPanel) typesPanel.build();
  if (brushPanel) brushPanel.build();
  invalidateMarkersCache();
  if (statusEl) statusEl.textContent = 'MiniTNS "' + entry.name + '" added (P' + entry.priority + ')';
}

function setupTopbarIcons() {
  document.querySelectorAll('#topbar img.btn-ic').forEach(img => {
    img.addEventListener('error', () => {
      const emo = img.dataset.emoji || '';
      if (!emo) { img.remove(); return; }
      const s = document.createElement('span');
      s.className = 'btn-emoji';
      s.textContent = emo;
      img.replaceWith(s);
    }, { once: true });
  });
}

// ═══════════════════════════════════════════════
// MOBILE UI
// ═══════════════════════════════════════════════
const mobile = {
  isMobile: () => window.matchMedia('(max-width: 820px), ((max-width: 1024px) and (pointer: coarse))').matches,
  rightOpen: false,
  bottomOpen: false
};

function updateMobileBrushBtn() {
  const btn = el('btnMobileBrush');
  if (!btn) return;
  const cur = TOOLS.find(t => t.id === activeTool);
  if (!cur) return;
  const icEl = btn.querySelector('.mtool-icon');
  const lblEl = btn.querySelector('.mtool-label');
  if (icEl) {
    let html = cur.emoji || '?';
    if (cur.icon) {
      html = '<img src="' + cur.icon + '" alt="" ' +
        'style="width:20px;height:20px;image-rendering:pixelated;vertical-align:-4px" ' +
        'onerror="this.outerHTML=\'' + (cur.emoji || '?') + '\'">';
    }
    icEl.innerHTML = html;
  }
  if (lblEl) lblEl.textContent = cur.label || cur.id.toUpperCase();
}

function openToolPicker() {
  const modal = el('toolPickerModal');
  const grid = el('toolPickerGrid');
  if (!modal || !grid) return;

  grid.innerHTML = '';
  for (const t of TOOLS) {
    if (t.sep) continue;
    const cell = document.createElement('div');
    cell.className = 'tool-picker-cell' + (t.id === activeTool ? ' active' : '');
    cell.dataset.tool = t.id;

    const ic = document.createElement('div');
    ic.className = 'tp-ic';
    if (t.icon) {
      const img = document.createElement('img');
      img.src = t.icon;
      img.alt = '';
      img.onerror = () => { ic.innerHTML = ''; ic.textContent = t.emoji || '?'; };
      ic.appendChild(img);
    } else {
      ic.textContent = t.emoji || '?';
    }
    cell.appendChild(ic);

    const lbl = document.createElement('div');
    lbl.className = 'tp-lbl';
    lbl.textContent = t.label || t.id.toUpperCase();
    cell.appendChild(lbl);

    cell.addEventListener('click', () => {
      handleToolClick(t.id);
      closeToolPicker();
    });

    grid.appendChild(cell);
  }

  modal.classList.remove('hidden');
}

function closeToolPicker() {
  const modal = el('toolPickerModal');
  if (modal) modal.classList.add('hidden');
}

function openMapModal() {
  const m = el('mapModal');
  if (!m) return;
  const mob = el('mapNameMobile');
  if (mob && mapNameEl) mob.value = mapNameEl.value;
  m.classList.remove('hidden');
}
function closeMapModal() {
  const m = el('mapModal');
  if (m) m.classList.add('hidden');
}

function openUtilityModal() {
  const m = el('utilityModal');
  if (!m) return;
  const uv = el('utilZoomVal');
  if (uv && renderer) uv.textContent = renderer.view.zoom.toFixed(2);
  m.classList.remove('hidden');
}
function closeUtilityModal() {
  const m = el('utilityModal');
  if (m) m.classList.add('hidden');
}

function openRefModal() {
  const m = el('refModal');
  if (!m) return;
  bindRefControls();
  const op = el('refOpacity');
  if (op) op.value = settings.reference.opacity;
  const opv = el('refOpacityVal');
  if (opv) opv.textContent = (+settings.reference.opacity).toFixed(2);
  const un = el('refUnderlay');
  if (un) un.checked = (settings.reference.mode === 'underlay');
  updateRefStatus();
  m.classList.remove('hidden');
}
function closeRefModal() {
  const m = el('refModal');
  if (m) m.classList.add('hidden');
}

function toggleRightPanel() {
  if (mobile.rightOpen) closeRightPanel();
  else openRightPanel();
}
function openRightPanel() {
  const panel = el('rightPanel');
  const back = el('rightBackdrop');
  if (!panel || !back) return;
  panel.classList.add('open');
  back.classList.remove('hidden');
  void back.offsetWidth;
  back.classList.add('show');
  mobile.rightOpen = true;
}
function closeRightPanel() {
  const panel = el('rightPanel');
  const back = el('rightBackdrop');
  if (!panel || !back) return;
  panel.classList.remove('open');
  back.classList.remove('show');
  mobile.rightOpen = false;
  setTimeout(() => {
    if (!mobile.rightOpen) back.classList.add('hidden');
  }, 250);
}
function openBottomMobile() {
  const b = el('bottom');
  const bar = el('mobileBottomBar');
  if (!b) return;
  b.classList.add('mobile-open');
  b.classList.remove('collapsed');
  if (bar) bar.classList.add('hidden');
  mobile.bottomOpen = true;
  if (renderer) setTimeout(() => renderer.resize(), 240);
}
function closeBottomMobile() {
  const b = el('bottom');
  const bar = el('mobileBottomBar');
  if (!b) return;
  b.classList.remove('mobile-open');
  if (bar) bar.classList.remove('hidden');
  mobile.bottomOpen = false;
  if (renderer) setTimeout(() => renderer.resize(), 240);
}

function setupMobileUI() {
  updateMobileBrushBtn();

  on('btnMobileBrush', 'click', openToolPicker);
  on('btnMobileMap', 'click', openMapModal);
  on('btnMobileUtility', 'click', openUtilityModal);
  on('btnMobileRightPanel', 'click', toggleRightPanel);
  on('btnMobileFullscreen', 'click', toggleFullscreen);
  on('utilFullscreen', 'click', () => { closeUtilityModal(); toggleFullscreen(); });

  on('toolPickerClose', 'click', closeToolPicker);
  on('mapModalClose', 'click', closeMapModal);
  on('utilityModalClose', 'click', closeUtilityModal);
  on('refClose', 'click', closeRefModal);

  // Map modal actions
  on('mapNewBtn', 'click', () => { closeMapModal(); loadNewMap(); });
  on('mapOpenBtn', 'click', () => { closeMapModal(); const f = el('fileInput'); if (f) f.click(); });
  on('mapSaveBtn', 'click', saveMap);
  on('mapResizeBtn', 'click', () => { closeMapModal(); doResize(); });
  on('mapMergeBtn', 'click', () => { closeMapModal(); doMerge(); });

  // Utility modal actions
  on('utilSavePreview', 'click', () => { closeUtilityModal(); exportMapPNG(); });
  on('utilFit', 'click', () => { doFit(); closeUtilityModal(); });
  on('utilReset', 'click', () => { doReset(); closeUtilityModal(); });
  on('utilRef', 'click', () => { closeUtilityModal(); openRefModal(); });

  const tpModal = el('toolPickerModal');
  if (tpModal) tpModal.addEventListener('click', (e) => { if (e.target === tpModal) closeToolPicker(); });
  const mm = el('mapModal');
  if (mm) mm.addEventListener('click', (e) => { if (e.target === mm) closeMapModal(); });
  const um = el('utilityModal');
  if (um) um.addEventListener('click', (e) => { if (e.target === um) closeUtilityModal(); });
  const rm = el('refModal');
  if (rm) rm.addEventListener('click', (e) => { if (e.target === rm) closeRefModal(); });

  on('rightPanelClose', 'click', closeRightPanel);
  on('rightBackdrop', 'click', closeRightPanel);

  on('btnMobileBottom', 'click', openBottomMobile);
  on('btnMobileBottomOpen', 'click', openBottomMobile);

  const toggleBtn = el('btnToggleBottom');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      if (mobile.isMobile() && mobile.bottomOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeBottomMobile();
      }
    }, true);
  }

  window.addEventListener('resize', () => {
    if (!mobile.isMobile()) {
      closeRightPanel();
      const b = el('bottom');
      if (b) b.classList.remove('mobile-open');
      const bar = el('mobileBottomBar');
      if (bar) bar.classList.remove('hidden');
      mobile.bottomOpen = false;
    }
  });
}

// Desktop REF button
on('btnRef', 'click', openRefModal);

// ═══════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  if (settings.activeTool) activeTool = settings.activeTool;
  if (wrap) wrap.style.background = settings.canvasBg || '#0a0a0a';
  applyAtlasBg(settings.atlasBg);
  RW.I18N.apply();
  buildTools();
  setupTopbarIcons();
  setupMobileUI();
  bindRefControls();
  tryRestoreReference();
});

RW.I18N.apply();
buildTools();
applyAtlasBg(settings.atlasBg);
setupTopbarIcons();
setupMobileUI();
bindRefControls();
tryRestoreReference();
})(window.RWEditor = window.RWEditor || {});
