(function(RW){
'use strict';
const V3 = RW.View3D = RW.View3D || {};

const STOPS = [
  [0.00, [ 22, 44, 92]],
  [0.12, [ 44, 96,164]],
  [0.26, [ 74,152,152]],
  [0.40, [ 92,172, 92]],
  [0.56, [162,182, 74]],
  [0.70, [192,162, 92]],
  [0.84, [154,124,102]],
  [0.93, [202,202,206]],
  [1.00, [255,255,255]]
];

function palette(t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i], b = STOPS[i+1];
    if (t >= a[0] && t <= b[0]) {
      const k = (t - a[0]) / ((b[0] - a[0]) || 1);
      return [
        a[1][0] + (b[1][0] - a[1][0]) * k,
        a[1][1] + (b[1][1] - a[1][1]) * k,
        a[1][2] + (b[1][2] - a[1][2]) * k
      ];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

const rgbStr = c => 'rgb(' + (c[0]|0) + ',' + (c[1]|0) + ',' + (c[2]|0) + ')';
const shadeStr = (c, k) =>
  'rgb(' + Math.min(255, c[0]*k|0) + ',' +
            Math.min(255, c[1]*k|0) + ',' +
            Math.min(255, c[2]*k|0) + ')';

// ─────────────────────────────────────────────
// opts = {
//   canvas,
//   w, h, levels,
//   getLevel(x, y) → 0..levels-1   (0 = peak),
//   colorMode: 'gray' | 'palette' | 'png',
//   pngData: Uint8ClampedArray(RGBA w*h),    // для mode='png'
//   cell: px per cell (default 3),
//   heightPx: max height (default 90)
// }
// ─────────────────────────────────────────────
V3.render = function(opts) {
  const cv = opts.canvas;
  const w = opts.w, h = opts.h;
  const levels = opts.levels;
  const maxIdx = levels - 1;
  const denom = Math.max(1, maxIdx);
  const cell = opts.cell || 3;
  const heightPx = opts.heightPx || 90;
  const colorMode = opts.colorMode || 'palette';
  const getLevel = opts.getLevel;

  const COS = Math.cos(Math.PI / 6);
  const SIN = Math.sin(Math.PI / 6);

  const W = Math.ceil((w + h) * COS * cell) + 8;
  const H = Math.ceil((w + h) * SIN * cell + heightPx) + 8;

  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#0b0d11';
  ctx.fillRect(0, 0, W, H);

  const offX = h * COS * cell + 4;
  const offY = heightPx + 4;

  const px = (x, y, z) => [
    (x - y) * COS * cell + offX,
    (x + y) * SIN * cell - z + offY
  ];

  const zOf = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    const idx = getLevel(x, y);
    return (maxIdx - idx) / denom * heightPx;
  };

  const colorOf = (x, y, z) => {
    if (colorMode === 'gray') {
      const idx = getLevel(x, y);
      const v = Math.round(idx / denom * 255);
      return [v, v, v];
    }
    if (colorMode === 'png' && opts.pngData &&
        x >= 0 && y >= 0 && x < w && y < h) {
      const p = (y * w + x) * 4;
      return [opts.pngData[p], opts.pngData[p+1], opts.pngData[p+2]];
    }
    return palette(z / Math.max(1, heightPx));
  };

  function poly(pts, color) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
  }

  // painter's algorithm: back-to-front по (x+y)
  for (let s = 0; s <= w + h - 2; s++) {
    const x0 = Math.max(0, s - h + 1);
    const x1 = Math.min(w - 1, s);
    for (let x = x0; x <= x1; x++) {
      const y = s - x;
      const z = zOf(x, y);
      const col = colorOf(x, y, z);

      const zx = zOf(x + 1, y);
      if (zx < z - 0.05) {
        poly([px(x+1,y,z), px(x+1,y+1,z), px(x+1,y+1,zx), px(x+1,y,zx)],
             shadeStr(col, 0.70));
      }
      const zy = zOf(x, y + 1);
      if (zy < z - 0.05) {
        poly([px(x,y+1,z), px(x+1,y+1,z), px(x+1,y+1,zy), px(x,y+1,zy)],
             shadeStr(col, 0.50));
      }
      poly([px(x,y,z), px(x+1,y,z), px(x+1,y+1,z), px(x,y+1,z)], rgbStr(col));
    }
  }
};

})(window.RWEditor = window.RWEditor || {});
