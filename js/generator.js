(function(RW){
'use strict';

// Порядок обхода соседей. Сначала 4 ортогональных, потом 4 диагональных.
// Внутри каждой группы — канонический порядок для тай-брейка.
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

// Маска квадрантов → роль в T.edges.
// Квадранты идут в порядке [NW, NE, SW, SE] — совпадает с [TL, TR, BL, BR]
// в XML tileset'а, где каждый угол = квадрант тайла.
//
// count=1: T в одном углу → выпуклый угол T в противоположной стороне.
// count=2:
//   соседние квадранты → прямое ребро (T сверху/снизу/слева/справа)
//   противоположные (диагональ) → берём один угол (произвольно NW > NE)
// count=3: вогнутый угол в пропущенном квадранте.
// count=0 / count=4: ничего не ставим.
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
    if (nw && ne) return 'S';   // T на верхней половине
    if (sw && se) return 'N';   // T на нижней половине
    if (nw && sw) return 'E';   // T слева
    if (ne && se) return 'W';   // T справа
    if (nw && se) return 'NWo'; // диагональ — произвольно NW
    if (ne && sw) return 'NEo'; // диагональ — произвольно NE
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

  // Тип клетки на Ground (null для пустой или вне карты).
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

  // Выбор доминирующего соседа для клетки (tx, ty).
  // Возвращает { type, dir } или null.
  //
  // Правила:
  //  1. Приоритет победителя строго больше приоритета self (null → -1).
  //  2. При равных приоритетах ortho > diagonal.
  //  3. При равных по категории — канонический порядок DIRS.order.
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

      // Одинаковый приоритет: ortho важнее диагонали.
      if (d.ortho && !best.dir.ortho) { best = { type: n, dir: d }; continue; }
      if (!d.ortho && best.dir.ortho) continue;

      // Внутри категории — по порядку.
      if (d.order < best.dir.order) best = { type: n, dir: d };
    }
    return best;
  }

  // ID edge-тайла для клетки (tx, ty). Победивший тип T рисует свой edge
  // ИМЕННО НА ЭТОЙ клетке — то есть за пределами своей зоны.
  resolveEdge(tx, ty) {
    const best = this.pickDominant(tx, ty);
    if (!best) return 0;
    const T = best.type;

    // Присутствие T в 8 соседних клетках.
    const tN  = this.typeAt(tx,     ty - 1) === T;
    const tS  = this.typeAt(tx,     ty + 1) === T;
    const tE  = this.typeAt(tx + 1, ty    ) === T;
    const tW  = this.typeAt(tx - 1, ty    ) === T;
    const tNW = this.typeAt(tx - 1, ty - 1) === T;
    const tNE = this.typeAt(tx + 1, ty - 1) === T;
    const tSW = this.typeAt(tx - 1, ty + 1) === T;
    const tSE = this.typeAt(tx + 1, ty + 1) === T;

    // Квадрант «покрыт T», если хотя бы одна из его 3 клеток = T.
    //   NW-квадрант: NW, N, W
    //   NE-квадрант: NE, N, E
    //   SW-квадрант: SW, S, W
    //   SE-квадрант: SE, S, E
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
}

RW.Generator = Generator;
})(window.RWEditor = window.RWEditor || {});