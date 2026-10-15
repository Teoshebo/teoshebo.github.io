(function(RW){
'use strict';
const M = RW.MergeUI = RW.MergeUI || {};

const MOBILE_MQ = '(max-width: 820px), ((max-width: 1024px) and (pointer: coarse))';
function isMobile() {
  return window.matchMedia(MOBILE_MQ).matches;
}

let modalEl, stageEl, listEl, infoEl, fileInputEl, guidesEl, snapCb;
let layout = [];                    // [{ parsed, name, x, y }]  x,y в ТАЙЛАХ
let zoom = 1, panX = 0, panY = 0;   // screen-пространство
let dragging = null;                // drag карты
let panning = null;                 // drag панорамы
let onMergeCb = null;
let activeGuides = [];              // [{type:'v'|'h', coord}]
const previewCache = new Map();

const ZOOM_MIN = 0.1, ZOOM_MAX = 4;
const SNAP_PX = 10;                 // порог снапа в экранных пикселях

// ── Multi-touch state ──
const pointers = new Map();
let multiActive = false;
let lastPinchDist = 0;
let lastPinchMidX = 0;
let lastPinchMidY = 0;

// ═══════════════════════════════════════════════
M.open = function(opts) {
  onMergeCb = opts.onMerge;
  ensureDom();
  layout = [];
  previewCache.clear();
  zoom = 1; panX = 0; panY = 0;
  activeGuides = [];
  pointers.clear();
  multiActive = false;
  modalEl.classList.remove('hidden');
  requestAnimationFrame(() => { fitView(); renderAll(); });
};

M.close = function() {
  if (modalEl) modalEl.classList.add('hidden');
  pointers.clear();
  multiActive = false;
  dragging = null;
  panning = null;
};

function ensureDom() {
  if (modalEl) return;
  modalEl     = document.getElementById('mergeModal');
  stageEl     = document.getElementById('mergeStage');
  listEl      = document.getElementById('mergeList');
  infoEl      = document.getElementById('mergeInfo');
  fileInputEl = document.getElementById('mergeFileInput');
  snapCb      = document.getElementById('mergeSnap');

  guidesEl = document.createElement('div');
  guidesEl.id = 'mergeGuides';
  stageEl.appendChild(guidesEl);

  document.getElementById('mergeClose').onclick  = M.close;
  document.getElementById('mergeCancel').onclick = M.close;

  document.getElementById('mergeClear').onclick = () => {
    if (!layout.length) return;
    if (!confirm('Очистить все карты?')) return;
    layout = [];
    previewCache.clear();
    activeGuides = [];
    renderAll();
  };

  document.getElementById('mergeFit').onclick = () => {
    fitView();
    renderStage();
  };

  document.getElementById('mergeAdd').onclick = () => fileInputEl.click();
  document.getElementById('mergeRun').onclick = doMerge;

  fileInputEl.onchange = async (e) => {
    const files = Array.from(e.target.files);
    for (const f of files) {
      try {
        const text = await f.text();
        const parsed = RW.TMX.parse(text);
        await RW.TMX.loadImages(parsed);
        addMap(parsed, f.name);
      } catch (err) {
        alert('Ошибка: ' + f.name + ' — ' + err.message);
      }
    }
    fileInputEl.value = '';
    renderAll();
  };

  stageEl.addEventListener('pointerdown', onStageDown);
  stageEl.addEventListener('wheel', onWheel, { passive: false });
  stageEl.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

// ═══════════════════════════════════════════════
// LAYOUT UTILS
// ═══════════════════════════════════════════════
function addMap(parsed, name) {
  const bbox = computeBBox();
  const x = bbox ? bbox.maxX : 0;
  const y = bbox ? bbox.minY : 0;
  layout.push({ parsed, name, x, y });
}

function computeBBox() {
  if (!layout.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of layout) {
    if (e.x < minX) minX = e.x;
    if (e.y < minY) minY = e.y;
    if (e.x + e.parsed.W > maxX) maxX = e.x + e.parsed.W;
    if (e.y + e.parsed.H > maxY) maxY = e.y + e.parsed.H;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

// ═══════════════════════════════════════════════
// VIEW
// ═══════════════════════════════════════════════
function fitView() {
  const bbox = computeBBox();
  const sr = stageEl.getBoundingClientRect();
  if (!bbox || !sr.width || !sr.height) { zoom = 1; panX = 0; panY = 0; return; }
  const pad = isMobile() ? 30 : 60;
  const sx = (sr.width  - pad*2) / bbox.w;
  const sy = (sr.height - pad*2) / bbox.h;
  zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(sx, sy)));
  panX = (sr.width  - bbox.w * zoom) / 2 - bbox.minX * zoom;
  panY = (sr.height - bbox.h * zoom) / 2 - bbox.minY * zoom;
}

function onWheel(e) {
  if (isMobile()) return;  // touch devices — pinch instead
  e.preventDefault();
  const sr = stageEl.getBoundingClientRect();
  const mx = e.clientX - sr.left;
  const my = e.clientY - sr.top;
  const mapX = (mx - panX) / zoom;
  const mapY = (my - panY) / zoom;
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * factor));
  panX = mx - mapX * zoom;
  panY = my - mapY * zoom;
  renderStage();
}

function toScreenX(mapX) { return mapX * zoom + panX; }
function toScreenY(mapY) { return mapY * zoom + panY; }

// ═══════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════
function renderAll() {
  renderStage();
  renderList();
  renderInfoFull();
}

function renderStage() {
  stageEl.querySelectorAll('.merge-rect').forEach(el => el.remove());
  layout.forEach((e, i) => {
    const el = document.createElement('div');
    el.className = 'merge-rect';
    el.dataset.idx = String(i);
    el.style.left   = toScreenX(e.x) + 'px';
    el.style.top    = toScreenY(e.y) + 'px';
    el.style.width  = (e.parsed.W * zoom) + 'px';
    el.style.height = (e.parsed.H * zoom) + 'px';
    el.style.zIndex = String(10 + i);

    const cv = getPreviewCanvas(e.parsed);
    el.appendChild(cv);

    const lbl = document.createElement('div');
    lbl.className = 'merge-label';
    lbl.textContent = e.name + ' · ' + e.parsed.W + '×' + e.parsed.H;
    el.appendChild(lbl);

    stageEl.appendChild(el);
  });
  renderGuides();
  updateOverlapWarnings();
}

function renderGuides() {
  if (!guidesEl) return;
  guidesEl.innerHTML = '';
  for (const g of activeGuides) {
    const el = document.createElement('div');
    el.className = 'merge-guide';
    if (g.type === 'v') {
      el.classList.add('v');
      el.style.left = toScreenX(g.coord) + 'px';
      el.style.top = '0';
      el.style.bottom = '0';
    } else {
      el.classList.add('h');
      el.style.top = toScreenY(g.coord) + 'px';
      el.style.left = '0';
      el.style.right = '0';
    }
    guidesEl.appendChild(el);
  }
}

function getPreviewCanvas(parsed) {
  if (previewCache.has(parsed)) return previewCache.get(parsed);
  const cv = makePreviewCanvas(parsed);
  previewCache.set(parsed, cv);
  return cv;
}

// 1 тайл = 1 px в превью-canvas. На мобиле — downscale ×0.5.
function makePreviewCanvas(parsed) {
  const W = parsed.W, H = parsed.H;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;

  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(W, H);
  const colorCache = new Map();

  function tileAvg(ts, localID) {
    const key = ts.firstgid + ':' + localID;
    if (colorCache.has(key)) return colorCache.get(key);
    if (!ts.image) { const v = [30,30,30,255]; colorCache.set(key, v); return v; }
    const tw = ts.tileW, th = ts.tileH;
    const col = localID % ts.columns;
    const row = Math.floor(localID / ts.columns);
    const oc = document.createElement('canvas');
    oc.width = tw; oc.height = th;
    const og = oc.getContext('2d', { willReadFrequently: true });
    og.drawImage(ts.image, col*tw, row*th, tw, th, 0, 0, tw, th);
    const px = og.getImageData(0, 0, tw, th).data;
    let sr = 0, sg = 0, sb = 0, sa = 0;
    const n = tw * th;
    for (let i = 0; i < n; i++) {
      const a = px[i*4+3];
      if (a === 0) continue;
      sr += px[i*4]   * a;
      sg += px[i*4+1] * a;
      sb += px[i*4+2] * a;
      sa += a;
    }
    const v = sa === 0 ? [0,0,0,0] : [sr/sa, sg/sa, sb/sa, sa / (n*255)];
    colorCache.set(key, v);
    return v;
  }

  function findTs(id) {
    let found = null;
    for (const ts of parsed.tilesets) {
      if (id >= ts.firstgid) found = ts; else break;
    }
    return found;
  }

  const BG = [15, 15, 18];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      let cr = BG[0], cg = BG[1], cb = BG[2];
      for (const lname of parsed.layerOrder) {
        const id = parsed.layers[lname][idx];
        if (!id) continue;
        const ts = findTs(id);
        if (!ts) continue;
        const c = tileAvg(ts, id - ts.firstgid);
        const a = c[3];
        if (a <= 0) continue;
        if (a >= 1) { cr = c[0]; cg = c[1]; cb = c[2]; continue; }
        cr = c[0]*a + cr*(1-a);
        cg = c[1]*a + cg*(1-a);
        cb = c[2]*a + cb*(1-a);
      }
      const p = idx * 4;
      img.data[p]   = cr;
      img.data[p+1] = cg;
      img.data[p+2] = cb;
      img.data[p+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // ── На мобиле — даунскейл ×0.5 для меньшей памяти и быстрее рендер ──
  if (isMobile()) {
    const sw = Math.max(24, Math.round(W * 0.5));
    const sh = Math.max(24, Math.round(H * 0.5));
    const small = document.createElement('canvas');
    small.width = sw;
    small.height = sh;
    const sg = small.getContext('2d');
    sg.imageSmoothingEnabled = false;
    sg.drawImage(cv, 0, 0, W, H, 0, 0, sw, sh);
    small.style.width = '100%';
    small.style.height = '100%';
    small.style.imageRendering = 'pixelated';
    small.style.position = 'absolute';
    small.style.inset = '0';
    small.style.pointerEvents = 'none';
    return small;
  }

  cv.style.width = '100%';
  cv.style.height = '100%';
  cv.style.imageRendering = 'pixelated';
  cv.style.position = 'absolute';
  cv.style.inset = '0';
  cv.style.pointerEvents = 'none';
  return cv;
}

function renderList() {
  listEl.innerHTML = '';
  if (!layout.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:#555;font-size:11px;padding:20px;text-align:center';
    empty.textContent = 'Пусто — нажми + ADD MAP';
    listEl.appendChild(empty);
    return;
  }
  layout.forEach((e, i) => {
    const row = document.createElement('div');
    row.className = 'merge-list-row';

    const idx = document.createElement('span');
    idx.className = 'merge-list-idx';
    idx.textContent = String(i + 1);
    row.appendChild(idx);

    const nm = document.createElement('span');
    nm.className = 'merge-list-name';
    nm.textContent = e.name;
    row.appendChild(nm);

    const sz = document.createElement('span');
    sz.className = 'merge-list-size';
    sz.textContent = e.parsed.W + '×' + e.parsed.H;
    row.appendChild(sz);

    const up = document.createElement('button');
    up.textContent = '▲';
    up.title = 'Выше (больше приоритета)';
    up.disabled = i === 0;
    up.onclick = () => swapPriority(i, i - 1);
    row.appendChild(up);

    const dn = document.createElement('button');
    dn.textContent = '▼';
    dn.title = 'Ниже';
    dn.disabled = i === layout.length - 1;
    dn.onclick = () => swapPriority(i, i + 1);
    row.appendChild(dn);

    const del = document.createElement('button');
    del.textContent = '×';
    del.className = 'danger';
    del.title = 'Удалить';
    del.onclick = () => {
      previewCache.delete(layout[i].parsed);
      layout.splice(i, 1);
      renderAll();
    };
    row.appendChild(del);

    listEl.appendChild(row);
  });
}

function swapPriority(i, j) {
  const t = layout[i]; layout[i] = layout[j]; layout[j] = t;
  renderAll();
}

function renderInfoFast() {
  if (!layout.length) { infoEl.textContent = 'Пусто'; return; }
  const b = computeBBox();
  infoEl.textContent = layout.length + ' карт · ' + b.w + '×' + b.h + ' тайлов' +
                       ' · zoom ' + (zoom * 100).toFixed(0) + '%';
}

function renderInfoFull() {
  if (!layout.length) { infoEl.textContent = 'Пусто'; return; }
  const b = computeBBox();
  const holes = countCoverageHoles();
  let msg = layout.length + ' карт · ' + b.w + '×' + b.h + ' тайлов' +
            ' · zoom ' + (zoom * 100).toFixed(0) + '%';
  msg += holes > 0 ? ' · дырок в Ground: ' + holes : ' · Ground полный';
  infoEl.textContent = msg;
}

function countCoverageHoles() {
  const b = computeBBox();
  if (!b) return 0;
  const W = b.w, H = b.h;
  const covered = new Uint8Array(W * H);
  for (const e of layout) {
    const g = e.parsed.layers.Ground;
    if (!g) continue;
    const ox = e.x - b.minX;
    const oy = e.y - b.minY;
    for (let y = 0; y < e.parsed.H; y++) {
      for (let x = 0; x < e.parsed.W; x++) {
        if (!g[y * e.parsed.W + x]) continue;
        covered[(oy + y) * W + (ox + x)] = 1;
      }
    }
  }
  let n = 0;
  for (let i = 0; i < covered.length; i++) if (!covered[i]) n++;
  return n;
}

function updateOverlapWarnings() {
  const set = new Set();
  for (let i = 0; i < layout.length; i++) {
    for (let j = i + 1; j < layout.length; j++) {
      if (rectsOverlap(layout[i], layout[j])) { set.add(i); set.add(j); }
    }
  }
  stageEl.querySelectorAll('.merge-rect').forEach(el => {
    const i = parseInt(el.dataset.idx, 10);
    el.classList.toggle('overlap', set.has(i));
  });
}

function rectsOverlap(a, b) {
  return !(a.x + a.parsed.W <= b.x ||
           b.x + b.parsed.W <= a.x ||
           a.y + a.parsed.H <= b.y ||
           b.y + b.parsed.H <= a.y);
}

// ═══════════════════════════════════════════════
// SNAP
// ═══════════════════════════════════════════════
function applySnap(movingIdx, proposedX, proposedY) {
  const res = { x: proposedX, y: proposedY, guides: [] };
  if (!snapCb || !snapCb.checked) return res;
  if (layout.length < 2) return res;

  const threshold = (isMobile() ? 14 : SNAP_PX) / zoom;
  const movingW = layout[movingIdx].parsed.W;
  const movingH = layout[movingIdx].parsed.H;

  const edgesX = [];
  const edgesY = [];
  for (let i = 0; i < layout.length; i++) {
    if (i === movingIdx) continue;
    const e = layout[i];
    edgesX.push(e.x, e.x + e.parsed.W);
    edgesY.push(e.y, e.y + e.parsed.H);
  }

  const movingXs = [proposedX, proposedX + movingW];
  let bestDx = null, bestDistX = Infinity, guideX = null;
  for (const mx of movingXs) {
    for (const ex of edgesX) {
      const d = ex - mx;
      const ad = Math.abs(d);
      if (ad < bestDistX) { bestDistX = ad; bestDx = d; guideX = ex; }
    }
  }
  if (bestDx != null && bestDistX <= threshold) {
    res.x = proposedX + bestDx;
    res.guides.push({ type: 'v', coord: guideX });
  }

  const movingYs = [proposedY, proposedY + movingH];
  let bestDy = null, bestDistY = Infinity, guideY = null;
  for (const my of movingYs) {
    for (const ey of edgesY) {
      const d = ey - my;
      const ad = Math.abs(d);
      if (ad < bestDistY) { bestDistY = ad; bestDy = d; guideY = ey; }
    }
  }
  if (bestDy != null && bestDistY <= threshold) {
    res.y = proposedY + bestDy;
    res.guides.push({ type: 'h', coord: guideY });
  }

  return res;
}

// ═══════════════════════════════════════════════
// POINTER INPUT
// ═══════════════════════════════════════════════
function onStageDown(e) {
  if (e.button !== 0 && e.button !== 1) return;

  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  try { stageEl.setPointerCapture(e.pointerId); } catch (_) {}

  // ── Два и больше пальцев → pinch / pan ──
  if (pointers.size >= 2) {
    dragging = null;
    panning = null;
    stageEl.classList.remove('panning');
    const arr = Array.from(pointers.values());
    lastPinchDist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    lastPinchMidX = (arr[0].x + arr[1].x) / 2;
    lastPinchMidY = (arr[0].y + arr[1].y) / 2;
    multiActive = true;
    e.preventDefault();
    return;
  }

  const rect = e.target.closest('.merge-rect');
  if (rect && e.button === 0) {
    // drag карты
    const i = parseInt(rect.dataset.idx, 10);
    dragging = {
      mapIdx: i,
      startMouseX: e.clientX, startMouseY: e.clientY,
      startMapX: layout[i].x, startMapY: layout[i].y
    };
    e.preventDefault();
  } else {
    // pan
    panning = {
      startMouseX: e.clientX, startMouseY: e.clientY,
      startPanX: panX, startPanY: panY
    };
    stageEl.classList.add('panning');
    e.preventDefault();
  }
}

function onPointerMove(e) {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  prev.x = e.clientX;
  prev.y = e.clientY;

  // ── Multi-touch: pinch + pan ──
  if (pointers.size >= 2) {
    const arr = Array.from(pointers.values());
    const d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
    const mx = (arr[0].x + arr[1].x) / 2;
    const my = (arr[0].y + arr[1].y) / 2;

    // pan midpoint
    panX += mx - lastPinchMidX;
    panY += my - lastPinchMidY;

    // zoom
    if (lastPinchDist > 8 && d > 8) {
      const k = d / lastPinchDist;
      if (Math.abs(k - 1) > 0.002) {
        const sr = stageEl.getBoundingClientRect();
        const zx = mx - sr.left;
        const zy = my - sr.top;
        const mapX = (zx - panX) / zoom;
        const mapY = (zy - panY) / zoom;
        zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom * k));
        panX = zx - mapX * zoom;
        panY = zy - mapY * zoom;
      }
    }

    lastPinchDist = d;
    lastPinchMidX = mx;
    lastPinchMidY = my;
    renderStage();
    renderInfoFast();
    return;
  }

  // ── Single pointer ──
  if (dragging) {
    e.preventDefault();
    const dx = (e.clientX - dragging.startMouseX) / zoom;
    const dy = (e.clientY - dragging.startMouseY) / zoom;
    const rawX = dragging.startMapX + dx;
    const rawY = dragging.startMapY + dy;

    const snapped = applySnap(dragging.mapIdx, rawX, rawY);
    const entry = layout[dragging.mapIdx];
    entry.x = Math.round(snapped.x);
    entry.y = Math.round(snapped.y);
    activeGuides = snapped.guides;

    const el = stageEl.querySelector('.merge-rect[data-idx="' + dragging.mapIdx + '"]');
    if (el) {
      el.style.left = toScreenX(entry.x) + 'px';
      el.style.top  = toScreenY(entry.y) + 'px';
    }
    renderGuides();
    updateOverlapWarnings();
    renderInfoFast();
    return;
  }
  if (panning) {
    e.preventDefault();
    panX = panning.startPanX + (e.clientX - panning.startMouseX);
    panY = panning.startPanY + (e.clientY - panning.startMouseY);
    renderStage();
  }
}

function onPointerUp(e) {
  pointers.delete(e.pointerId);

  if (multiActive && pointers.size === 0) {
    multiActive = false;
    return;
  }

  if (dragging) {
    dragging = null;
    activeGuides = [];
    renderGuides();
    renderInfoFull();
  }
  if (panning) {
    panning = null;
    stageEl.classList.remove('panning');
  }
}

// ═══════════════════════════════════════════════
// MERGE
// ═══════════════════════════════════════════════
async function doMerge() {
  if (layout.length < 2) { alert('Нужно минимум 2 карты'); return; }
  if (!confirm('Заменить текущую карту результатом merge?\n\nНесохранённые правки будут потеряны.')) return;
  try {
    const merged = await RW.Merge.run(layout);
    M.close();
    if (onMergeCb) onMergeCb(merged);
  } catch (err) {
    console.error(err);
    alert('Merge failed: ' + err.message);
  }
}

})(window.RWEditor = window.RWEditor || {});