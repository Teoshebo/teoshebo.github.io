(function(RW) {
  'use strict';
  const App = RW.App = RW.App || {};

  // ═══════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════
  App.mapModel = null;
  App.renderer = null;
  App.layersPanel = null;
  App.brushPanel = null;
  App.tilesetTabs = null;
  App.typesModel = new RW.TypesModel();
  App.typesPanel = null;
  App.generator = null;
  App.activeTypeId = null;
  App.activeTool = 'pan';
  App.activeLayer = null;
  App.brushGroup = [];
  App.brushSettings = { size: 0, shape: 'square' };
  App.activeClassicTerrain = null;
  App.classicMaskCache = new Map();
  App.classicEmptyCache = new Map();
  App.pickMode = null;
  App.drag = { active: false, x: 0, y: 0 };
  App.painting = false;
  App.strokeChanges = null;
  App.strokeBound = null;
  App.rectStart = null;
  App.rectCurrent = null;
  App.lastPaintKey = null;
  App._pendingImportTilesets = [];

  // ─── GUIDES ───
  App.helpers = [];
  App.activeGuideType = 'line';
  App.guideDrawStart = null;
  App.guideDrawCurrent = null;
  App.lastSelection = null;
  App.guideMode = 'create';
  App.guideSymmetry = { h: false, v: false, d: false, ad: false };
  App.selectedGuideIdx = -1;
  App.activeGuideNode = null;

  // ─── TEMP FILL MODES ───
  App.tempEmptyFill = false;
  App.tempTypeFill = false;
  App.prevTool = null;
  App.prevBrush = null;

  // ─── REFERENCE ───
  App.refImage = null;
  App.refHandle = null;

  // ─── SETTINGS ───
  App.settings = RW.Storage.loadSettings();
  if (App.settings.showMarkers == null) App.settings.showMarkers = false;
  if (App.settings.markerScale == null) App.settings.markerScale = 1;
  if (App.settings.canvasBg == null) App.settings.canvasBg = '#0a0a0a';
  if (App.settings.atlasBg == null) App.settings.atlasBg = '#0a0a0a';
  if (App.settings.lang == null) App.settings.lang = 'en';
  if (App.settings.reference == null) App.settings.reference = { path: '', opacity: 0.5, mode: 'overlay' };
  if (App.settings.reference.path == null) App.settings.reference.path = '';
  if (App.settings.reference.opacity == null) App.settings.reference.opacity = 0.5;
  if (App.settings.reference.mode == null) App.settings.reference.mode = 'overlay';
  RW.Storage.saveSettings(App.settings);

  // ─── POINTER STATE ───
  App.pointers = new Map();
  App.drawingPointerId = null;
  App.longTapTimer = null;
  App.longTapFired = false;
  App.longTapStart = { x: 0, y: 0 };
  App.multiPointerActive = false;
  App.lastPinchDist = 0;
  App.lastPinchMidX = 0;
  App.lastPinchMidY = 0;
  App.pressedKeys = new Set();
  App.panKeys = new Set();
  App.panRaf = null;

  App._markersCache = null;

  App.mobile = {
    isMobile: () => window.matchMedia('(max-width: 820px), ((max-width: 1024px) and (pointer: coarse))').matches,
    rightOpen: false,
    bottomOpen: false
  };

  // ═══════════════════════════════════════════════
  // DOM REFS
  // ═══════════════════════════════════════════════
  App.on = function(id, event, handler) {
    const e = document.getElementById(id);
    if (e) e.addEventListener(event, handler);
    return e;
  };

  App.el = function(id) {
    return document.getElementById(id);
  };

  App.cv = App.el('cv');
  App.wrap = App.el('wrap');
  App.infoEl = App.el('info');
  App.fpsEl = App.el('fps');
  App.zoomVal = App.el('zoomVal');
  App.layersEl = App.el('layers');
  App.brushListEl = App.el('brushList');
  App.brushTotalEl = App.el('brushTotal');
  App.brushSettingsEl = App.el('brushSettings');
  App.classicListEl = App.el('classicList');
  App.classicPanelEl = App.el('classicPanel');
  App.tnsListEl = App.el('tnsList');
  App.tnsPanelEl = App.el('tnsPanel');
  App.tsTabsListEl = App.el('tsTabsList');
  App.tsBodyEl = App.el('tsBody');
  App.typesBodyEl = App.el('typesBody');
  App.bottomEl = App.el('bottom');
  App.bottomGrabberEl = App.el('bottomGrabber');
  App.toolsEl = App.el('tools');
  App.mapNameEl = App.el('mapName');
  App.pickBannerEl = App.el('pickBanner');
  App.pickBannerTextEl = App.el('pickBannerText');
  App.warnBannerEl = App.el('warnBanner');
  App.warnBannerTextEl = App.el('warnBannerText');

  // ═══════════════════════════════════════════════
  // [Patch 03.4-fix] STATUS → PROXY
  // Сохраняем DOM-методы старого элемента, перехватываем только textContent
  // ═══════════════════════════════════════════════
  const logConsoleEl = document.getElementById('logConsole');
  let logs = [];
  const originalStatusEl = document.getElementById('status');
  if (originalStatusEl) originalStatusEl.style.display = 'none';

  App.statusEl = new Proxy(originalStatusEl || {}, {
    set: function(target, prop, value) {
      if (prop === 'textContent') {
        if (!value) return true;
        const time = new Date().toLocaleTimeString('ru-RU', {
          hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        logs.push('[' + time + '] ' + value);
        if (logs.length > 5) logs.shift();
        if (logConsoleEl) {
          logConsoleEl.innerHTML = logs.map(l => '<div>' + l.replace(/</g, '&lt;') + '</div>').join('');
        }
        return true;
      }
      target[prop] = value;
      return true;
    },
    get: function(target, prop) {
      if (prop === 'textContent') return logs[logs.length - 1] || '';
      return target[prop];
    }
  });

  // toggle log console on #bottom collapse
  (function setupLogObserver() {
    const bottomEl = document.getElementById('bottom');
    if (!bottomEl) return;

    const applyVisibility = () => {
      if (!logConsoleEl) return;
      logConsoleEl.style.display = bottomEl.classList.contains('collapsed') ? 'flex' : 'none';
    };

    const observer = new MutationObserver(applyVisibility);
    observer.observe(bottomEl, { attributes: true, attributeFilter: ['class'] });

    requestAnimationFrame(applyVisibility);
  })();

  App.updateZoomLabels = function() {
    if (!App.renderer) return;
    const v = App.renderer.view.zoom.toFixed(2);
    const d = App.el('zoomVal');
    if (d) d.textContent = v;
    const m = App.el('utilZoomVal');
    if (m) m.textContent = v;
  };

  App.applyAtlasBg = function(v) {
    document.documentElement.style.setProperty('--atlas-bg', v || '#0a0a0a');
  };

  // ═══════════════════════════════════════════════
  // I18N
  // ═══════════════════════════════════════════════
  const I18N = {
    en: {
      'title': 'WebTiled', 'btn.new': 'New', 'btn.open': 'Open', 'btn.save': 'Save',
      'btn.resize': 'Size', 'btn.merge': 'Merge', 'btn.exportMap': '_map',
      'btn.savePreview': 'Save Preview', 'btn.fit': 'Fit', 'btn.reset': '1:1', 'btn.ref': 'REF',
      'btn.fullscreen': 'Fullscreen', 'btn.exitFullscreen': 'Exit Fullscreen',
      'field.filename': 'Filename', 'field.zoom': 'Zoom', 'status.idle': 'Load .tmx file',
      'tab.atlases': 'ATLASES', 'tab.types': 'TYPES', 'tab.gen': 'GENERATOR', 'tab.v3': '3D',
      'settings.title': 'SETTINGS', 'settings.language': 'LANGUAGE', 'settings.appearance': 'APPEARANCE',
      'settings.canvasBg': 'Editor background', 'settings.atlasBg': 'Atlas / tiles background',
      'settings.markers': 'MARKERS', 'settings.showMarkers': 'Show markers',
      'settings.markerSize': 'Marker size', 'settings.apply': 'APPLY', 'settings.cancel': 'CANCEL',
      'settings.close': 'Close', 'ref.title': 'REFERENCE', 'ref.status': 'Status',
      'ref.pick': 'Choose file', 'ref.clear': 'Remove', 'ref.opacity': 'Opacity',
      'ref.underlay': 'Place under map (else overlay)',
      'ref.hint': 'Reference is not saved into .tmx and not included in Save Preview. Chrome/Edge remember the file path between sessions.'
    },
    ru: {
      'title': 'WebTiled', 'btn.new': 'Новый', 'btn.open': 'Открыть', 'btn.save': 'Сохранить',
      'btn.resize': 'Размер', 'btn.merge': 'Склейка', 'btn.exportMap': '_map',
      'btn.savePreview': 'Скриншот', 'btn.fit': 'Fit', 'btn.reset': '1:1', 'btn.ref': 'REF',
      'btn.fullscreen': 'На весь экран', 'btn.exitFullscreen': 'Выйти',
      'field.filename': 'Имя файла', 'field.zoom': 'Зум', 'status.idle': 'Загрузи .tmx файл',
      'tab.atlases': 'АТЛАСЫ', 'tab.types': 'ТИПЫ', 'tab.gen': 'ГЕНЕРАТОР', 'tab.v3': '3D',
      'settings.title': 'НАСТРОЙКИ', 'settings.language': 'ЯЗЫК', 'settings.appearance': 'ВНЕШНИЙ ВИД',
      'settings.canvasBg': 'Фон редактора', 'settings.atlasBg': 'Фон атласов',
      'settings.markers': 'МАРКЕРЫ', 'settings.showMarkers': 'Показывать маркеры',
      'settings.markerSize': 'Размер маркеров', 'settings.apply': 'ПРИМЕНИТЬ',
      'settings.cancel': 'ОТМЕНА', 'settings.close': 'Закрыть', 'ref.title': 'РЕФЕРЕНС',
      'ref.status': 'Статус', 'ref.pick': 'Выбрать файл', 'ref.clear': 'Удалить',
      'ref.opacity': 'Прозрачность', 'ref.underlay': 'Под карту (иначе поверх)',
      'ref.hint': 'Референс не сохраняется в .tmx и не попадает в Скриншот. Chrome/Edge запоминают путь между сессиями.'
    }
  };

  let currentLang = App.settings.lang || 'en';

  App.I18N = {
    get lang() { return currentLang; },
    t(key) {
      const d = I18N[currentLang] || I18N.en;
      return d[key] != null ? d[key] : (I18N.en[key] != null ? I18N.en[key] : key);
    },
    apply() {
      document.querySelectorAll('[data-i18n]').forEach(e => { e.textContent = this.t(e.dataset.i18n); });
      const t = document.querySelector('title'); if (t) t.textContent = this.t('title');
    },
    set(lang) {
      if (!I18N[lang]) return;
      currentLang = lang; App.settings.lang = lang; RW.Storage.saveSettings(App.settings);
      this.apply();
      if (typeof App.updateMobileBrushBtn === 'function') App.updateMobileBrushBtn();
      if (typeof App.updateFullscreenBtn === 'function') App.updateFullscreenBtn();
    }
  };

  RW.I18N = App.I18N;

  // ═══════════════════════════════════════════════
  // CORE HELPERS
  // ═══════════════════════════════════════════════
  App.checkTNSLayerWarning = function() {
    if (App.activeTool !== 'terrain') return;
    if (!App.mapModel) return;
    if (App.activeLayer && App.activeLayer !== 'Ground') {
      if (App.warnBannerTextEl) {
        App.warnBannerTextEl.textContent = 'TYPE-инструмент рисует в Ground. Активный слой — "' + App.activeLayer + '". Поменяй на Ground или переключи инструмент — иначе склейка карт сломается.';
      }
      if (App.warnBannerEl) App.warnBannerEl.classList.remove('hidden');
    }
  };

  App.getMarkersCached = function() {
    if (!App.mapModel) return { starts: [], respools: [] };
    if (App._markersCache) return App._markersCache;
    App._markersCache = RW.Markers.find(App.mapModel);
    return App._markersCache;
  };

  App.invalidateMarkersCache = function() { App._markersCache = null; };

  // ═══════════════════════════════════════════════
  // INIT FROM PARSED
  // ═══════════════════════════════════════════════
  App.initFromParsed = async function(parsed, filename) {
    App.mapModel = new RW.MapModel(parsed);
    App._markersCache = null;
    App.renderer = new RW.Renderer(App.cv, () => App.mapModel);

    App.renderer.targetFps = App.mobile.isMobile() ? 60 : 0;
    App.renderer.layerVisibility = {};
    for (const n of App.mapModel.layerOrder) App.renderer.layerVisibility[n] = true;
    App.renderer.onFps = (fps, chunks) => {
      if (App.fpsEl) App.fpsEl.textContent = fps + ' fps · chunks ' + chunks;
    };
    App.renderer.getMarkers = () => App.getMarkersCached();
    App.renderer.showMarkers = !!App.settings.showMarkers;
    App.renderer.markerScale = App.settings.markerScale || 1;
    App.renderer.setBg(App.settings.canvasBg || '#0a0a0a');
    App.renderer.setReference(App.refImage);
    App.renderer.setReferenceOpacity(App.settings.reference.opacity);
    App.renderer.setReferenceMode(App.settings.reference.mode);

    App.activeLayer = App.mapModel.layerOrder[0] || null;
    App.brushGroup = [];
    App.pickMode = null;
    App.tempEmptyFill = false;
    App.tempTypeFill = false;
    if (App.pickBannerEl) App.pickBannerEl.classList.add('hidden');
    App.classicMaskCache.clear();
    App.classicEmptyCache.clear();
    App.activeClassicTerrain = null;

    App.typesModel = new RW.TypesModel();
    if (parsed.typesConfigRaw) {
      try { App.typesModel.fromJSON(JSON.parse(parsed.typesConfigRaw)); }
      catch (err) { console.warn('types config parse fail', err); }
    }
    App.activeTypeId = App.typesModel.types.length ? App.typesModel.types[0].id : null;

    App.generator = new RW.Generator(() => App.mapModel, (tileID) => App.typesModel.findBySolid(tileID));

    App.layersPanel = new RW.LayersPanel(App.layersEl, {
      getMap: () => App.mapModel, getRenderer: () => App.renderer,
      getActiveLayer: () => App.activeLayer, setActiveLayer: (n) => { App.activeLayer = n; }
    });

    App.brushPanel = new RW.BrushPanel({
      listEl: App.brushListEl, totalEl: App.brushTotalEl, settingsEl: App.brushSettingsEl,
      classicListEl: App.classicListEl, tnsListEl: App.tnsListEl,
      classicPanelEl: App.classicPanelEl, tnsPanelEl: App.tnsPanelEl,
      ctx: {
        getMap: () => App.mapModel, getRenderer: () => App.renderer,
        getBrush: () => App.brushGroup, getBrushSettings: () => App.brushSettings,
        getActiveTool: () => App.activeTool, getTypesModel: () => App.typesModel,
        getActiveType: () => App.activeTypeId, setActiveType: (id) => { App.activeTypeId = id; },
        getActiveClassicTerrain: () => App.activeClassicTerrain,
        setActiveClassicTerrain: (anchor) => {
          App.activeClassicTerrain = anchor;
          if (App.statusEl) {
            const a = App.resolveClassicAnchor();
            if (a) App.statusEl.textContent = 'Classic: ' + a.ts.name + ' · ' + a.terrType.name + ' (local ' + a.terrType.tile + ' → global ' + (a.terrType.tile + a.ts.firstgid) + ')';
          }
        },
        onBrushChanged: () => { if (App.tilesetTabs) App.tilesetTabs.refreshSelection(); },
        onBrushSettingsChanged: () => {},
        findTileset: (id) => App.renderer.findTileset(id)
      }
    });

    App.tilesetTabs = new RW.TilesetTabs(App.tsTabsListEl, App.tsBodyEl, App.bottomEl, {
      getMap: () => App.mapModel, getRenderer: () => App.renderer, getBrush: () => App.brushGroup,
      getModel: () => App.typesModel, getPickMode: () => App.pickMode,
      addToBrush: (id, add) => App.addToBrush(id, add), applyPick: (id) => App.applyPick(id),
      onAddTileset: () => { const t = App.el('tilesetInput'); if (t) t.click(); }
    });

    App.typesPanel = new RW.TypesPanel(App.typesBodyEl, {
      getModel: () => App.typesModel, getActiveType: () => App.activeTypeId,
      setActiveType: (id) => { App.activeTypeId = id; }, getPickMode: () => App.pickMode,
      startPick: (mode) => App.startPick(mode), endPick: () => App.endPick(),
      findTileset: (id) => App.renderer.findTileset(id),
      onChanged: () => { App.typesPanel.build(); if (App.brushPanel) App.brushPanel.build(); },
      onImportMiniTNS: () => App.startMiniTNSImport(),
      onOpenLibrary: () => App.openMiniTNSLibrary()
    });

    App.layersPanel.build(); App.brushPanel.build(); App.tilesetTabs.build(); App.typesPanel.build();
    App.buildTools();

    if (App.mapNameEl) {
      const n = filename || parsed._restoredFilename || 'map.tmx';
      App.mapNameEl.value = n; const m = App.el('mapNameMobile'); if (m) m.value = n;
    }
    App.renderer.fitView(); App.updateZoomLabels();
    if (RW.HMApp) {
      RW.HMApp.onMapReady({
        getMap: () => App.mapModel, getTypesModel: () => App.typesModel,
        getGenerator: () => App.generator, getRenderer: () => App.renderer, markDirty: () => {}
      });
    }
  };

  // ═══════════════════════════════════════════════
  // [Patch 01] MINI TNS LIBRARY
  // ═══════════════════════════════════════════════
  App.openMiniTNSLibrary = function() {
    if (!RW.MiniTNSLib) {
      if (App.statusEl) App.statusEl.textContent = 'MiniTNSLib не загружен';
      return;
    }
    RW.MiniTNSLib.open(async (entry) => {
      try { await App.importMiniTNSFromEntry(entry); }
      catch (err) { if (App.statusEl) App.statusEl.textContent = 'Ошибка импорта: ' + err.message; }
    });
  };

  App.importMiniTNSFromEntry = async function(entry) {
    if (!App.mapModel) {
      if (App.statusEl) App.statusEl.textContent = 'Сначала открой карту';
      return;
    }
    const byteString = atob(entry.b64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    const blob = new Blob([ab], { type: 'image/png' });
    const file = new File([blob], entry.name + '.png', { type: 'image/png' });
    await App.importMiniTNS(file);
    RW.MiniTNSLib.close();
  };

})(window.RWEditor = window.RWEditor || {});