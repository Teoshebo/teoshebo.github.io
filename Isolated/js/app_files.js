(function(RW){
'use strict';
const App = RW.App;
const U = RW.Utils;

// ═══════════════════════════════════════════════
// NEW / OPEN / SAVE / RESIZE / MERGE
// ═══════════════════════════════════════════════
App.loadNewMap = async function() {
  if (App.statusEl) App.statusEl.textContent = 'Loading new.tmx...';
  try {
    const res = await fetch('new.tmx', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' — проверь что new.tmx в корне');
    const text = await res.text();
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      throw new Error('Получен HTML вместо TMX. Убедись, что файл new.tmx существует в корне.');
    }
    const parsed = RW.TMX.parse(text);
    await RW.TMX.loadImages(parsed);
    await App.initFromParsed(parsed, 'new.tmx');
    if (App.statusEl) App.statusEl.textContent = 'New map: ' + App.mapModel.W + '×' + App.mapModel.H +
      ' · layers: ' + App.mapModel.layerOrder.length;
  } catch (err) {
    console.error(err);
    if (App.statusEl) App.statusEl.textContent = 'New error: ' + err.message;
  }
};

App.on('fileInput', 'change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (App.statusEl) App.statusEl.textContent = 'Parsing...';
  try {
    const text = await file.text();
    const parsed = RW.TMX.parse(text);
    await RW.TMX.loadImages(parsed);
    await App.initFromParsed(parsed, file.name);
    if (App.statusEl) App.statusEl.textContent = 'OK ' + App.mapModel.W + '×' + App.mapModel.H +
      ' · tilesets: ' + App.mapModel.tilesets.length +
      ' · layers: ' + App.mapModel.layerOrder.length;
  } catch (err) {
    console.error(err);
    if (App.statusEl) App.statusEl.textContent = 'Error: ' + err.message;
  }
  e.target.value = '';
});

App.saveMap = function() {
  if (!App.mapModel) { if (App.statusEl) App.statusEl.textContent = 'No map'; return; }
  try {
    const mob = App.el('mapNameMobile');
    if (mob && App.mapNameEl && mob.value) App.mapNameEl.value = mob.value;
    const xml = RW.TMX.save(App.mapModel, App.typesModel);
    let filename = (App.mapNameEl && App.mapNameEl.value || '').trim() || 'map.tmx';
    if (!filename.toLowerCase().endsWith('.tmx')) filename += '.tmx';
    U.download(filename, xml, 'application/xml');
    if (App.statusEl) App.statusEl.textContent = 'Saved: ' + filename;
    App.mapModel.rawXml = xml;
    if (typeof App.closeMapModal === 'function') App.closeMapModal();
  } catch (err) {
    console.error(err);
    if (App.statusEl) App.statusEl.textContent = 'Save error: ' + err.message;
  }
};

App.doResize = function() {
  if (!App.mapModel) { if (App.statusEl) App.statusEl.textContent = 'No map'; return; }
  const nw = parseInt(prompt('New width (' + App.mapModel.W + '):', String(App.mapModel.W)), 10);
  if (isNaN(nw) || nw < 1 || nw > 4096) return;
  const nh = parseInt(prompt('New height (' + App.mapModel.H + '):', String(App.mapModel.H)), 10);
  if (isNaN(nh) || nh < 1 || nh > 4096) return;
  const entry = App.mapModel.resize(nw, nh);
  if (!entry) return;
  App.renderer.invalidate();
  App.renderer.fitView();
  App.updateZoomLabels();
  if (App.layersPanel) App.layersPanel.build();
  App.renderer.render();
  if (App.statusEl) App.statusEl.textContent = 'Size: ' + nw + '×' + nh;
};

App.doMerge = function() {
  if (!RW.MergeUI) return;
  RW.MergeUI.open({
    onMerge: async (merged) => {
      await RW.TMX.loadImages(merged);
      await App.initFromParsed(merged, 'merged.tmx');
      if (App.statusEl) App.statusEl.textContent = 'Merged: ' + merged.W + '×' + merged.H +
        ' · tilesets: ' + merged.tilesets.length +
        ' · layers: ' + merged.layerOrder.length;
    }
  });
};

// ═══════════════════════════════════════════════
// TMX TILESET IMPORT
// ═══════════════════════════════════════════════
App.openTmxImportModal = function(tilesets) {
  App._pendingImportTilesets = tilesets;
  const modal = App.el('importTmxTilesetsModal');
  const list = App.el('importTmxList');
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
    if (ts.image) g.drawImage(ts.image, 0, 0, 40, 40);
    else { g.fillStyle = '#333'; g.fillRect(0, 0, 40, 40); }
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
};

App.closeTmxImportModal = function() {
  const modal = App.el('importTmxTilesetsModal');
  if (modal) modal.classList.add('hidden');
  App._pendingImportTilesets = [];
};

App.on('importTmxClose', 'click', () => App.closeTmxImportModal());
App.on('importTmxCancel', 'click', () => App.closeTmxImportModal());
App.on('importTmxAdd', 'click', () => {
  const checkboxes = document.querySelectorAll('#importTmxList input[type=checkbox]:checked');
  if (!checkboxes.length) { App.closeTmxImportModal(); return; }
  if (!App.mapModel) { alert('Open a map first'); App.closeTmxImportModal(); return; }
  let addedCount = 0;
  checkboxes.forEach(cb => {
    const idx = parseInt(cb.dataset.idx, 10);
    const srcTs = App._pendingImportTilesets[idx];
    if (!srcTs) return;
    let maxEnd = 1;
    for (const ts of App.mapModel.tilesets) {
      const end = ts.firstgid + ts.tilecount;
      if (end > maxEnd) maxEnd = end;
    }
    const newTs = {
      firstgid: maxEnd, name: srcTs.name,
      columns: srcTs.columns, tilecount: srcTs.tilecount,
      tileW: srcTs.tileW, tileH: srcTs.tileH,
      image: srcTs.image, imageDataUrl: srcTs.imageDataUrl,
      embeddedPngB64: srcTs.embeddedPngB64,
      imageSource: srcTs.imageSource,
      imageW: srcTs.imageW, imageH: srcTs.imageH,
      terrainTypes: JSON.parse(JSON.stringify(srcTs.terrainTypes || [])),
      tiles: JSON.parse(JSON.stringify(srcTs.tiles || {})),
      xmlStr: null, _dirty: true
    };
    let finalName = newTs.name;
    if (App.mapModel.tilesets.find(t => t.name === finalName)) {
      let i = 2;
      while (App.mapModel.tilesets.find(t => t.name === finalName + '_' + i)) i++;
      newTs.name = finalName + '_' + i;
    }
    App.mapModel.tilesets.push(newTs);
    addedCount++;
  });
  App.mapModel.tilesets.sort((a, b) => a.firstgid - b.firstgid);
  if (App.tilesetTabs) {
    App.tilesetTabs.activeIdx = App.mapModel.tilesets.length - 1;
    App.tilesetTabs.build();
  }
  if (App.brushPanel) App.brushPanel.build();
  App.invalidateMarkersCache();
  App.closeTmxImportModal();
  if (App.statusEl) App.statusEl.textContent = 'Imported ' + addedCount + ' tilesets from TMX.';
});

App.on('tilesetInput', 'change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!App.mapModel) { if (App.statusEl) App.statusEl.textContent = 'Open a map first'; return; }

  if (file.name.toLowerCase().endsWith('.tmx')) {
    if (App.statusEl) App.statusEl.textContent = 'Parsing .tmx for tilesets...';
    try {
      const text = await file.text();
      const parsed = RW.TMX.parse(text);
      await RW.TMX.loadImages(parsed);
      if (!parsed.tilesets || !parsed.tilesets.length) {
        alert('В этом .tmx нет тайлсетов.');
        if (App.statusEl) App.statusEl.textContent = 'No tilesets found in TMX';
        return;
      }
      App.openTmxImportModal(parsed.tilesets);
      if (App.statusEl) App.statusEl.textContent = 'Found ' + parsed.tilesets.length + ' tilesets';
    } catch (err) {
      console.error(err);
      if (App.statusEl) App.statusEl.textContent = 'TMX Import error: ' + err.message;
    }
    return;
  }

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
    const tw = App.mapModel.tw, th = App.mapModel.th;
    const cols = Math.floor(img.naturalWidth / tw);
    const rows = Math.floor(img.naturalHeight / th);
    if (cols < 1 || rows < 1) throw new Error('PNG smaller than one tile ' + tw + '×' + th);
    const tilecount = cols * rows;
    const defName = (file.name || 'tileset').replace(/\.png$/i, '');
    const name = prompt('Tileset name:', defName);
    if (!name) return;
    let firstgid = 1;
    for (const ts of App.mapModel.tilesets) {
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
    App.mapModel.tilesets.push(ts);
    App.mapModel.tilesets.sort((a, b) => a.firstgid - b.firstgid);
    if (App.tilesetTabs) {
      App.tilesetTabs.activeIdx = App.mapModel.tilesets.indexOf(ts);
      App.tilesetTabs.build();
    }
    if (App.brushPanel) App.brushPanel.build();
    App.invalidateMarkersCache();
    if (App.statusEl) App.statusEl.textContent = 'Tileset added: ' + name +
      ' (' + cols + '×' + rows + ', firstgid=' + firstgid + ')';
  } catch (err) {
    console.error(err);
    if (App.statusEl) App.statusEl.textContent = 'Tileset error: ' + err.message;
  }
});

// ═══════════════════════════════════════════════
// MINI TNS IMPORT
// ═══════════════════════════════════════════════
App.startMiniTNSImport = function() {
  if (!App.mapModel) { if (App.statusEl) App.statusEl.textContent = 'Open a map first'; return; }
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/png,image/*';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    try { await App.importMiniTNS(f); }
    catch (err) {
      console.error(err);
      if (App.statusEl) App.statusEl.textContent = 'MiniTNS: ' + err.message;
    }
  };
  inp.click();
};

// [Patch 0.7.0] Убран prompt, добавлен defaultName
App.importMiniTNS = async function(file, extraProp, properties, defaultName) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const b64 = U.bytesToB64(bytes);
  const dataUrl = 'data:image/png;base64,' + b64;
  const img = new Image();
  await new Promise((res, rej) => {
    img.onload = res; img.onerror = () => rej(new Error('Cannot read PNG'));
    img.src = dataUrl;
  });
  const tw = App.mapModel.tw, th = App.mapModel.th;
  const cols = Math.floor(img.naturalWidth / tw);
  const rows = Math.floor(img.naturalHeight / th);
  if (cols !== 3 || rows !== 5) throw new Error('PNG must be 3×5 tiles');
  const tilecount = 15;
  const baseName = (defaultName || (file.name || 'MiniTNS').replace(/\.png$/i, '')).trim();
  const name = baseName || 'MiniTNS';
  const typeName = name;

  let firstgid = 1;
  for (const ts of App.mapModel.tilesets) {
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
  App.mapModel.tilesets.push(ts);
  App.mapModel.tilesets.sort((a, b) => a.firstgid - b.firstgid);
  if (App.tilesetTabs) {
    App.tilesetTabs.activeIdx = App.mapModel.tilesets.indexOf(ts);
    App.tilesetTabs.build();
  }
  
  const t = App.typesModel.add(typeName, App.typesModel.types.length);
  const g = (local) => Number(firstgid + local);

  const isEmpty = (col, row) => {
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
  if (!isEmpty(2, 3)) solidLocals.push(11);
  if (!isEmpty(2, 4)) solidLocals.push(14);

  t.solids = [];
  for (const local of solidLocals) {
    t.solids.push({ tileID: g(local), weight: 1 });
    if (properties && Object.keys(properties).length > 0) {
      if (!ts.tiles[local]) ts.tiles[local] = { terrain: null, props: {} };
      if (!ts.tiles[local].props) ts.tiles[local].props = {};
      Object.assign(ts.tiles[local].props, properties);
    }
  }

  t.edges.NWo = g(0); t.edges.N = g(1); t.edges.NEo = g(2);
  t.edges.W = g(3); t.edges.E = g(5);
  t.edges.SWo = g(6); t.edges.S = g(7); t.edges.SEo = g(8);
  t.edges.NWi = g(9); t.edges.NEi = g(10);
  t.edges.SWi = g(12); t.edges.SEi = g(13);

  if (extraProp) {
    t.edgeLayer = 'Items';
    const solidSet = new Set(solidLocals);
    for (let local = 0; local < 15; local++) {
      if (solidSet.has(local)) continue;
      if (isEmpty(local % 3, Math.floor(local / 3))) continue;
      if (!ts.tiles[local]) ts.tiles[local] = { terrain: null, props: {} };
      if (!ts.tiles[local].props) ts.tiles[local].props = {};
      ts.tiles[local].props[extraProp] = '';
    }
    ts._dirty = true;
  }

  App.setActiveType(t.id);
  if (App.typesPanel) App.typesPanel.build();
  if (App.brushPanel) App.brushPanel.build();
  App.invalidateMarkersCache();
  if (App.statusEl) App.statusEl.textContent = 'MiniTNS: tileset "' + name + '" + type "' + typeName + '"' +
    (extraProp ? ' · edge=' + extraProp + ' → Items' : '');
  return t;
};

// ═══════════════════════════════════════════════
// EXPORT PNG
// ═══════════════════════════════════════════════
App.findTsForId = function(tilesets, id) {
  let f = null;
  for (const ts of tilesets) { if (id >= ts.firstgid) f = ts; else break; }
  return f;
};

App.renderMapToNative = function(mapModel, markers) {
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
      const ts = App.findTsForId(mapModel.tilesets, id);
      if (!ts || !ts.image) continue;
      const l = id - ts.firstgid;
      o.drawImage(ts.image,
        (l % ts.columns) * ts.tileW, Math.floor(l / ts.columns) * ts.tileH,
        ts.tileW, ts.tileH, x * tw, y * th, tw, th);
    }
  }
  if (markers && RW.Markers) {
    const M = RW.Markers;
    const scale = App.settings.markerScale || 1;
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
};

App.composePNG = function(native, nW, nH, target) {
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
};

App.exportMapPNG = function() {
  if (!App.mapModel) { if (App.statusEl) App.statusEl.textContent = 'No map'; return; }
  try {
    const markers = App.settings.showMarkers ? App.getMarkersCached() : null;
    const { off, nativeW, nativeH } = App.renderMapToNative(App.mapModel, markers);
    const composed = App.composePNG(off, nativeW, nativeH, 500);
    composed.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      const base = (App.mapNameEl && App.mapNameEl.value || 'map').replace(/\.tmx$/i, '') || 'map';
      a.download = base + '_map.png'; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    }, 'image/png');
    if (App.statusEl) App.statusEl.textContent = 'Export: ' + nativeW + '×' + nativeH + ' → 500×500';
  } catch (err) {
    console.error(err);
    if (App.statusEl) App.statusEl.textContent = 'Export error: ' + err.message;
  }
};

})(window.RWEditor = window.RWEditor || {});