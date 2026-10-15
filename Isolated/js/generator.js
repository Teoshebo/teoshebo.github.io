(function(RW){
'use strict';

// Порядок обхода соседей. Сначала 4 ортогональных, потом 4 диагональных.
const DIRS = [
  { dx:  0, dy: -1, ortho: true,  order: 0 }, // N
  { dx:  0, dy:  1, ortho: true,  order: 1 }, // S
  { dx:  1, dy:  0, ortho: true,  order: 2 }, // E
  { dx: -1, dy:  0, ortho: true,  order: 3 }, // W
  { dx: -1, dy: -1, ortho: false, order: 4 }, // NW
  { dx:  1, dy: -1, ortho: false, order: 5 }, // NE
  { dx: -1, dy:  1, ortho: false, order: 6 }, // SW
  { dx:  1, dy:  1, ortho: false, order: 7 }  // SE
];

const ORTHO_DIRS = [[0,-1],[0,1],[1,0],[-1,0]];

function maskToRole(nw, ne, sw, se) {
  const c = (nw?1:0) + (ne?1:0) + (sw?1:0) + (se?1:0);
  if (c === 0 || c === 4) return null;

  if (c === 3) {
    if (!nw) return 'NWi';
    if (!ne) return 'NEi';
    if (!sw) return 'SWi';
    if (!se) return 'SEi';
  }
  if (c === 2) {
    if (nw && ne) return 'S';
    if (sw && se) return 'N';
    if (nw && sw) return 'E';
    if (ne && se) return 'W';
    if (nw && se) return 'NWo';
    if (ne && sw) return 'NEo';
  }
  if (c === 1) {
    if (nw) return 'SEo';
    if (ne) return 'SWo';
    if (sw) return 'NEo';
    if (se) return 'NWo';
  }
  return null;
}

class Generator {
  constructor(getMap, getTypeOfTile) {
    this.getMap = getMap;
    this.getTypeOfTile = getTypeOfTile;
  }

  typeAt(tx, ty) {
    const map = this.getMap();
    if (!map) return null;
    if (tx < 0 || ty < 0 || tx >= map.W || ty >= map.H) return null;
    const g = map.layers.Ground;
    if (!g) return null;
    const id = g[ty * map.W + tx];
    if (!id) return null;
    return this.getTypeOfTile(id);
  }

  pickDominant(tx, ty) {
    const self = this.typeAt(tx, ty);
    const selfP = self ? self.priority : -1;

    let best = null;
    for (const d of DIRS) {
      const n = this.typeAt(tx + d.dx, ty + d.dy);
      if (!n) continue;
      if (n.priority <= selfP) continue;

      if (!best) { best = { type: n, dir: d }; continue; }

      if (n.priority > best.type.priority) { best = { type: n, dir: d }; continue; }
      if (n.priority < best.type.priority) continue;

      if (d.ortho && !best.dir.ortho) { best = { type: n, dir: d }; continue; }
      if (!d.ortho && best.dir.ortho) continue;

      if (d.order < best.dir.order) best = { type: n, dir: d };
    }
    return best;
  }

  resolveEdge(tx, ty) {
    const best = this.pickDominant(tx, ty);
    if (!best) return 0;
    const T = best.type;

    const tN  = this.typeAt(tx,     ty - 1) === T;
    const tS  = this.typeAt(tx,     ty + 1) === T;
    const tE  = this.typeAt(tx + 1, ty    ) === T;
    const tW  = this.typeAt(tx - 1, ty    ) === T;
    const tNW = this.typeAt(tx - 1, ty - 1) === T;
    const tNE = this.typeAt(tx + 1, ty - 1) === T;
    const tSW = this.typeAt(tx - 1, ty + 1) === T;
    const tSE = this.typeAt(tx + 1, ty + 1) === T;

    const qNW = (tNW || tN || tW) ? 1 : 0;
    const qNE = (tNE || tN || tE) ? 1 : 0;
    const qSW = (tSW || tS || tW) ? 1 : 0;
    const qSE = (tSE || tS || tE) ? 1 : 0;

    const role = maskToRole(qNW, qNE, qSW, qSE);
    if (!role) return 0;

    const edges = T.edges || {};
    return edges[role] || 0;
  }

  generateRect(x0, y0, x1, y1) {
    const map = this.getMap();
    const items0 = map.layers.Items0;
    if (!items0) return [];

    const minX = Math.max(0, Math.min(x0, x1));
    const maxX = Math.min(map.W - 1, Math.max(x0, x1));
    const minY = Math.max(0, Math.min(y0, y1));
    const maxY = Math.min(map.H - 1, Math.max(y0, y1));

    const changes = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * map.W + x;
        const before = items0[idx];
        const after = this.resolveEdge(x, y);
        if (before !== after) changes.push({ idx, before, after });
      }
    }
    return changes;
  }

  generateAround(tx, ty, r) {
    return this.generateRect(tx - r, ty - r, tx + r, ty + r);
  }

  // ─────────────────────────────────────────────
  // FLOOD DOMINANT
  //
  // Правило: если клетка Type A имеет ≥3 ортогональных соседа
  // одного и того же Type B, и B.priority > A.priority —
  // клетка на Ground перекрашивается в тайл B (берётся самый
  // частый ID среди этих 3+ соседей).
  //
  // Используется снапшот Ground до изменений — чтобы эффект
  // не каскадился за один проход.
  // ─────────────────────────────────────────────
  floodDominant(x0, y0, x1, y1) {
    const map = this.getMap();
    const ground = map.layers.Ground;
    if (!ground) return [];

    const minX = Math.max(0, Math.min(x0, x1));
    const maxX = Math.min(map.W - 1, Math.max(x0, x1));
    const minY = Math.max(0, Math.min(y0, y1));
    const maxY = Math.min(map.H - 1, Math.max(y0, y1));

    const typeCache = new Map();
    const getType = (id) => {
      if (!typeCache.has(id)) typeCache.set(id, this.getTypeOfTile(id));
      return typeCache.get(id);
    };

    const origGround = new Uint32Array(ground);
    const changes = [];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * map.W + x;
        const selfId = origGround[idx];
        if (!selfId) continue;
        const selfType = getType(selfId);
        if (!selfType) continue;

        const groups = new Map();
        for (const [dx, dy] of ORTHO_DIRS) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= map.W || ny >= map.H) continue;
          const nid = origGround[ny * map.W + nx];
          if (!nid) continue;
          const nt = getType(nid);
          if (!nt) continue;
          if (!groups.has(nt.id)) groups.set(nt.id, { type: nt, ids: [] });
          groups.get(nt.id).ids.push(nid);
        }

        let best = null;
        for (const g of groups.values()) {
          if (g.ids.length < 3) continue;
          if (g.type.priority <= selfType.priority) continue;
          if (!best || g.type.priority > best.type.priority) best = g;
        }
        if (!best) continue;

        const idCounts = new Map();
        for (const id of best.ids) idCounts.set(id, (idCounts.get(id) || 0) + 1);
        let topId = best.ids[0], topCount = 0;
        for (const [id, c] of idCounts) {
          if (c > topCount) { topId = id; topCount = c; }
        }

        if (topId !== selfId) {
          changes.push({ idx, before: selfId, after: topId });
        }
      }
    }
    return changes;
  }
}

RW.Generator = Generator;
})(window.RWEditor = window.RWEditor || {});
