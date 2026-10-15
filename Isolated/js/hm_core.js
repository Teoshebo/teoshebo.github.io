(function(RW){
'use strict';
const HM = RW.HM = RW.HM || {};

// ─── RNG + Perlin ───
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

let perm;
function initPerm(seed){
  const rng = mulberry32(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
}
function fade(t){return t*t*t*(t*(t*6-15)+10)}
function lerp(a,b,t){return a+(b-a)*t}
function grad(h,x,y){switch(h&3){case 0:return x+y;case 1:return -x+y;case 2:return x-y;case 3:return -x-y}return 0}
function perlin2(x,y){
  const X = Math.floor(x)&255, Y = Math.floor(y)&255;
  x -= Math.floor(x); y -= Math.floor(y);
  const u = fade(x), v = fade(y);
  const A = perm[X]+Y, B = perm[X+1]+Y;
  const n00 = grad(perm[A], x, y), n10 = grad(perm[B], x-1, y);
  const n01 = grad(perm[A+1], x, y-1), n11 = grad(perm[B+1], x-1, y-1);
  return lerp(lerp(n00,n10,u), lerp(n01,n11,u), v);
}
function fbm(x,y,oct){
  let s = 0, a = 1, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += perlin2(x*f, y*f)*a; n += a; f *= 2; a *= 0.5; }
  return s / n;
}

// ─── Generate heightmap ───
// Returns { level: Uint8Array(W*H), w, h, levels, floorIdx }
// level[i] ∈ [0 .. levels-1]. 0 = peak (dark), levels-1 = floor (light).
HM.generate = function(opts) {
  const { w, h, levels, flatten, noiseScale, octaves, flatPct,
          edgeBias, edgePow, symmetry, symStrength,
          passes, passWidth, passLength, seed } = opts;
  const rng = mulberry32(seed + 999);
  initPerm(seed);

  const raw = new Float32Array(w*h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      raw[y*w+x] = fbm(x/noiseScale, y/noiseScale, octaves);

  const square = (w === h);
  const field = new Float32Array(w*h);
  const hw = (w-1)/2, hh = (h-1)/2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y*w+x;
    let s = raw[i];
    switch (symmetry) {
      case 'mirror-x': s = (raw[i] + raw[y*w+(w-1-x)]) * 0.5; break;
      case 'mirror-y': s = (raw[i] + raw[(h-1-y)*w+x]) * 0.5; break;
      case 'rotate-180': s = (raw[i] + raw[(h-1-y)*w+(w-1-x)]) * 0.5; break;
      case 'quad': {
        const a=raw[i], b=raw[y*w+(w-1-x)], c=raw[(h-1-y)*w+x], d=raw[(h-1-y)*w+(w-1-x)];
        s = (a + b + c + d) * 0.25; break;
      }
      case 'diag':      if (square) s = (raw[i] + raw[x*w+y]) * 0.5; break;
      case 'anti-diag': if (square) s = (raw[i] + raw[(w-1-x)*w+(w-1-y)]) * 0.5; break;
    }
    const noise = (1 - symStrength) * raw[i] + symStrength * s;
    const dx = (x - hw) / hw, dy = (y - hh) / hh;
    const d = Math.min(1, Math.sqrt(dx*dx + dy*dy) / Math.SQRT2);
    field[i] = noise + edgeBias * Math.pow(d, edgePow);
  }

  const sorted = Float32Array.from(field).sort();
  const flatRatio = Math.max(0.05, Math.min(0.95, flatPct / 100));
  const flatThr = sorted[Math.floor(sorted.length * flatRatio)];
  const maxF = sorted[sorted.length - 1];
  const range = Math.max(1e-9, maxF - flatThr);

  const rawIdx = new Uint8Array(w*h);
  for (let i = 0; i < w*h; i++) {
    const v = field[i];
    if (v <= flatThr) rawIdx[i] = levels - 1;
    else {
      const t2 = (v - flatThr) / range;
      let l = Math.floor((1 - t2) * (levels - 1));
      rawIdx[i] = Math.max(0, Math.min(levels - 1, l));
    }
  }

  const newFloorIdx = Math.max(0, levels - 1 - flatten);
  const levelIdx = new Uint8Array(w*h);
  for (let i = 0; i < w*h; i++)
    levelIdx[i] = rawIdx[i] >= newFloorIdx ? newFloorIdx : rawIdx[i];

  // passes: прорубаем «тропы» вдоль рёбер peak-плато
  if (passes > 0) {
    const cand = [];
    for (let y = 1; y < h-1; y++) for (let x = 1; x < w-1; x++) {
      const i = y*w + x;
      if (levelIdx[i] !== 1) continue;
      if (levelIdx[i-1] === 0 || levelIdx[i+1] === 0 ||
          levelIdx[i-w] === 0 || levelIdx[i+w] === 0) cand.push(i);
    }
    for (let i = cand.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [cand[i], cand[j]] = [cand[j], cand[i]];
    }
    let placed = 0;
    for (const start of cand) {
      if (placed >= passes) break;
      const sx = start % w, sy = (start - sx) / w;
      let dx = 0, dy = 0;
      if      (levelIdx[start-1] === 0) dx = 1;
      else if (levelIdx[start+1] === 0) dx = -1;
      if      (levelIdx[start-w] === 0) dy = 1;
      else if (levelIdx[start+w] === 0) dy = -1;
      if (dx === 0 && dy === 0) continue;
      let cx = sx, cy = sy, dirX = dx, dirY = dy, drawn = 0;
      for (let step = 0; step < passLength; step++) {
        for (let by = -passWidth; by <= passWidth; by++)
          for (let bx = -passWidth; bx <= passWidth; bx++) {
            if (Math.abs(bx) + Math.abs(by) > passWidth) continue;
            const px = cx + bx, py = cy + by;
            if (px < 0 || px >= w || py < 0 || py >= h) continue;
            const pi = py * w + px;
            if (levelIdx[pi] === 1) { levelIdx[pi] = 0; drawn++; }
          }
        let ndx = dirX, ndy = dirY;
        if (rng() < 0.18) {
          if (dirX !== 0) { ndy = rng() < 0.5 ? 1 : -1; ndx = 0; }
          else            { ndx = rng() < 0.5 ? 1 : -1; ndy = 0; }
        }
        const ncx = cx + ndx, ncy = cy + ndy;
        if (ncx < 1 || ncx >= w-1 || ncy < 1 || ncy >= h-1) break;
        if (levelIdx[ncy*w + ncx] !== 1) break;
        cx = ncx; cy = ncy; dirX = ndx; dirY = ndy;
      }
      if (drawn > 5) placed++;
    }
  }

  return { level: levelIdx, w, h, levels, floorIdx: newFloorIdx };
};

// ─── Carve rivers into level array ───
// rivers: [{ points: [{x,y,width,tension}], smooth }]
HM.carveRivers = function(level, w, h, floorIdx, rivers) {
  if (!rivers || !rivers.length) return;
  const riverIdx = Math.min(255, floorIdx + 1);

  for (const riv of rivers) {
    if (!riv.points || riv.points.length < 2) continue;
    const mask = new Uint8Array(w*h);
    const samples = HM._splineSamples(riv.points, 20);
    let any = false;
    for (const s of samples) {
      const rad = Math.max(1, Math.round(s.width || 1));
      const px = Math.round(s.x), py = Math.round(s.y);
      const r2 = rad * rad;
      for (let by = -rad; by <= rad; by++)
        for (let bx = -rad; bx <= rad; bx++) {
          if (bx*bx + by*by > r2) continue;
          const nx = px + bx, ny = py + by;
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          mask[ny*w + nx] = 1; any = true;
        }
    }
    if (!any) continue;

    // distance field (2-pass chamfer)
    const INF = 65535;
    const dist = new Uint16Array(w*h).fill(INF);
    for (let i = 0; i < w*h; i++) if (mask[i]) dist[i] = 0;
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
    const smoothR = Math.max(0, riv.smooth || 0);
    if (smoothR > 0) {
      for (let i = 0; i < w*h; i++) {
        if (mask[i]) continue;
        const dC = dist[i] / 3;
        if (dC > smoothR) continue;
        if (level[i] >= floorIdx) continue;
        const tt = Math.min(1, dC / smoothR);
        const target = Math.round(floorIdx * (1 - tt));
        if (target > level[i]) level[i] = Math.min(floorIdx, target);
      }
    }
    for (let i = 0; i < w*h; i++) if (mask[i]) level[i] = riverIdx;
  }
};

// Cardinal spline sampler (Catmull-Rom). Экспортируется как HM._splineSamples.
HM._splineSamples = function(points, samplesPerSeg) {
  if (points.length < 2) return [];
  const pts = [points[0], ...points, points[points.length-1]];
  const out = [];
  for (let i = 1; i < pts.length - 2; i++) {
    const p0 = pts[i-1], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2];
    const segT = ((p1.tension ?? 0.5) + (p2.tension ?? 0.5)) * 0.5;
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg; const t2 = t*t, t3 = t2*t;
      const h00 = 2*t3 - 3*t2 + 1, h10 = t3 - 2*t2 + t;
      const h01 = -2*t3 + 3*t2, h11 = t3 - t2;
      const x = h00*p1.x + h10*segT*(p2.x-p0.x) + h01*p2.x + h11*segT*(p3.x-p1.x);
      const y = h00*p1.y + h10*segT*(p2.y-p0.y) + h01*p2.y + h11*segT*(p3.y-p1.y);
      const width = (p1.width || 1) + ((p2.width || 1) - (p1.width || 1)) * t;
      out.push({ x, y, width });
    }
  }
  const last = points[points.length-1];
  out.push({ x: last.x, y: last.y, width: last.width || 1 });
  return out;
};

})(window.RWEditor = window.RWEditor || {});
