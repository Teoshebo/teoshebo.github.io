(function(RW){
'use strict';
const HM = RW.HM = RW.HM || {};

// ─────────────────────────────────────────────
// APPLY HEIGHTMAP → MAP
//
// opts = {
//   mapModel, typesModel, generator,
//   level: Uint8Array(w*h),
//   w, h, levels,
//   targetLayer: 'Ground',
//   edgeLayer:   'Items0',
//   levelToType: array[levels] of typeId (optional; null → default by priority)
// }
//
// Возвращает:
//   { ok: true, changesTarget, changesEdge, snapTarget, snapEdge }
//   { ok: false, error: '...' }
//
// После вызова НЕ пишет в undoStack — это делает вызывающий код.
// ─────────────────────────────────────────────
HM.applyToMap = function(opts) {
  const { mapModel, typesModel, generator, level, w, h, levels } = opts;
  const targetLayer = opts.targetLayer || 'Ground';
  const edgeLayer   = opts.edgeLayer   || 'Items0';

  const target = mapModel.layers[targetLayer];
  if (!target) return { ok: false, error: 'Нет слоя ' + targetLayer };
  if (w !== mapModel.W || h !== mapModel.H) {
    return { ok: false, error: 'Размер heightmap (' + w + '×' + h +
      ') ≠ размер карты (' + mapModel.W + '×' + mapModel.H + ')' };
  }

  const typesByPrio = [...typesModel.types].sort((a, b) => b.priority - a.priority);
  if (!typesByPrio.length) return { ok: false, error: 'Нет типов в TypesModel' };

  // Построить level → type
  const mapping = new Array(levels);
  for (let lv = 0; lv < levels; lv++) {
    if (opts.levelToType && opts.levelToType[lv]) {
      mapping[lv] = typesModel.get(opts.levelToType[lv]);
    } else {
      // level 0 (пик) → тип с макс. priority; level N-1 (пол) → мин. priority
      const idx = Math.min(typesByPrio.length - 1, lv);
      mapping[lv] = typesByPrio[idx];
    }
  }
  // Проверка, что у каждого уровня есть solid
  for (let lv = 0; lv < levels; lv++) {
    const t = mapping[lv];
    if (!t || !t.solids || !t.solids.length) {
      return { ok: false, error: 'Уровень ' + lv + ' → тип без solids. Заполни Solids во вкладке TYPES.' };
    }
  }

  // ─── Снапшоты для undo ───
  const snapTarget = new Uint32Array(target);
  const edgeData = mapModel.layers[edgeLayer];
  const snapEdge = edgeData ? new Uint32Array(edgeData) : null;

  // ─── Pass 1: target layer ───
  const changesTarget = [];
  for (let i = 0; i < w*h; i++) {
    const t = mapping[level[i]];
    const tileID = t.solids[0].tileID;
    if (target[i] === tileID) continue;
    changesTarget.push({ idx: i, before: target[i], after: tileID });
    target[i] = tileID;
  }

  // ─── Pass 2: edges через существующий generator ───
  const changesEdge = [];
  if (edgeData && generator) {
    const edgeChanges = generator.generateRect(0, 0, w - 1, h - 1);
    for (const c of edgeChanges) {
      if (edgeData[c.idx] !== c.after) {
        changesEdge.push({ idx: c.idx, before: edgeData[c.idx], after: c.after });
        edgeData[c.idx] = c.after;
      }
    }
  }

  return {
    ok: true,
    targetLayer, edgeLayer,
    changesTarget, changesEdge,
    snapTarget, snapEdge
  };
};

// ─────────────────────────────────────────────
// Применить результат (после подтверждения) к mapModel.undoStack.
// Помещает ДВА undo-элемента: один на target, один на edge.
// ─────────────────────────────────────────────
HM.commitToUndo = function(mapModel, result) {
  if (!result || !result.ok) return 0;
  let n = 0;
  if (result.changesTarget.length) {
    mapModel.undoStack.push({ layer: result.targetLayer, changes: result.changesTarget });
    n += result.changesTarget.length;
  }
  if (result.changesEdge.length) {
    mapModel.undoStack.push({ layer: result.edgeLayer, changes: result.changesEdge });
    n += result.changesEdge.length;
  }
  if (mapModel.undoStack.length > 50) {
    mapModel.undoStack.splice(0, mapModel.undoStack.length - 50);
  }
  mapModel.redoStack.length = 0;
  return n;
};

// ─────────────────────────────────────────────
// AUTO POINTS: генерация стартов и res-pool'ов на основании level-массива.
//
// opts = {
//   level, w, h, levels,
//   players: 2, homePerPlayer: 1, frontPts: 4,
//   spread: 1.0, edgePct: 0.10, heightMargin: 10,
//   seed: 0,
// }
//
// Возвращает { starts: [{x,y,team}], respools: [{x,y}] }
// ─────────────────────────────────────────────
HM.generatePoints = function(opts) {
  const { level, w, h, levels } = opts;
  const P = Math.max(1, opts.players || 2);
  const K = Math.max(0, opts.homePerPlayer || 1);
  const F = Math.max(0, opts.frontPts || 4);
  const spread = Math.max(0.5, opts.spread || 1);
  const edgePct = Math.max(0, opts.edgePct || 0.10);
  const heightMargin = Math.max(0, opts.heightMargin || 10);
  const seed = (opts.seed || 0) + 31337;

  // RNG
  let s = seed >>> 0;
  const rnd = () => {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };

  const floorIdx = Math.max(0, levels - 1);
  // distance field: сколько до ближайшей non-floor клетки
  const INF = 65535;
  const dist = new Uint16Array(w*h).fill(INF);
  for (let i = 0; i < w*h; i++) if (level[i] !== floorIdx) dist[i] = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y*w + x; let d = dist[i];
    if (y > 0) d = Math.min(d, dist[i-w] + 3);
    if (x > 0) d = Math.min(d, dist[i-1] + 3);
    if (y > 0 && x > 0) d = Math.min(d, dist[i-w-1] + 4);
    if (y > 0 && x < w-1) d = Math.min(d, dist[i-w+1] + 4);
    dist[i] = d;
  }
  for (let y = h-1; y >= 0; y--) for (let x = w-1; x >= 0; x--) {
    const i = y*w + x; let d = dist[i];
    if (y < h-1) d = Math.min(d, dist[i+w] + 3);
    if (x < w-1) d = Math.min(d, dist[i+1] + 3);
    if (y < h-1 && x < w-1) d = Math.min(d, dist[i+w+1] + 4);
    if (y < h-1 && x > 0)   d = Math.min(d, dist[i+w-1] + 4);
    dist[i] = d;
  }

  const minX = Math.floor(w * edgePct);
  const maxX = Math.ceil(w * (1 - edgePct));
  const minY = Math.floor(h * edgePct);
  const maxY = Math.ceil(h * (1 - edgePct));
  const minDist = heightMargin * 3;

  const playable = [];
  for (let y = minY; y < maxY; y++) for (let x = minX; x < maxX; x++) {
    const i = y*w + x;
    if (level[i] !== floorIdx) continue;
    if (dist[i] < minDist) continue;
    playable.push({ x, y });
  }
  if (playable.length < 20) return { starts: [], respools: [] };

  const cx = w/2, cy = h/2;
  const minD = Math.min(w, h) * 0.12 * spread;

  function pickFar(arr, count, md) {
    const out = [];
    const sh = arr.slice();
    for (let i = sh.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [sh[i], sh[j]] = [sh[j], sh[i]];
    }
    for (const c of sh) {
      if (out.length >= count) break;
      let ok = true;
      for (const p of out) if (Math.hypot(c.x-p.x, c.y-p.y) < md) { ok = false; break; }
      if (ok) out.push(c);
    }
    return out;
  }

  // 180° mirror для 2 команд
  const pickSide = (x, y) => ((x - cx) + (y - cy) < 0) ? 1 : 2;
  const mirror = (p) => ({ x: w-1-p.x, y: h-1-p.y });

  const t1 = playable.filter(p => pickSide(p.x, p.y) === 1);
  t1.sort((a, b) =>
    Math.hypot(b.x-cx, b.y-cy) - Math.hypot(a.x-cx, a.y-cy));
  const s1 = pickFar(t1.slice(0, Math.max(P * 20, 60)), P, minD * 1.5);
  const s2 = s1.map(mirror);

  const starts = [];
  for (const s of s1) starts.push({ x: s.x, y: s.y, team: 1 });
  for (const s of s2) starts.push({ x: s.x, y: s.y, team: 2 });

  const respools = [];
  for (const s of [...s1, ...s2]) {
    const near = playable.filter(p => {
      const d = Math.hypot(p.x-s.x, p.y-s.y);
      return d > minD*0.4 && d < minD*1.6;
    });
    for (const p of pickFar(near, K, minD*0.5)) respools.push({ x: p.x, y: p.y });
  }
  // фронтальные respools вдоль оси 180°
  const axisFn = c => Math.abs((c.x-cx) + (c.y-cy)) / Math.SQRT2;
  const front = playable.slice().sort((a, b) => axisFn(a) - axisFn(b));
  const fronts = pickFar(front.slice(0, Math.max(F*30, 120)), F, minD*0.9);
  for (const p of fronts) respools.push({ x: p.x, y: p.y });

  return { starts, respools };
};

})(window.RWEditor = window.RWEditor || {});
