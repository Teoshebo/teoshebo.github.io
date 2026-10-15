(function(RW){
'use strict';

RW.Utils = {
  b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },

  bytesToB64(bytes) {
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return btoa(bin);
  },

  encodeUint32LE(arr) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    const compressed = pako.deflate(bytes);
    return RW.Utils.bytesToB64(compressed);
  },

  decodeUint32LE(b64) {
    let bytes = RW.Utils.b64ToBytes(b64.replace(/\s+/g, ''));
    bytes = pako.inflate(bytes);
    return new Uint32Array(bytes.buffer.slice(
      bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  },

  download(filename, content, type) {
    const blob = (content instanceof Blob)
      ? content
      : new Blob([content], { type: type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  },

  esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

// ═══════════════════════════════════════════════
// MARKERS
// ═══════════════════════════════════════════════
RW.Markers = {
  // 10 базовых цветов RW, циклично: team 0,10,20 → green; 1,11,21 → red; ...
  TEAM_COLORS: [
    '#4ade80', // 0 green
    '#ef4444', // 1 red
    '#3b82f6', // 2 blue
    '#eab308', // 3 yellow
    '#a855f7', // 4 purple
    '#06b6d4', // 5 cyan
    '#f97316', // 6 orange
    '#ec4899', // 7 pink
    '#84cc16', // 8 lime
    '#8b5cf6'  // 9 violet
  ],

  // Размеры в ТАЙЛАХ. userScale — из настроек.
  RADIUS_TILES: 5.0,       // радиус круга старта
  DOT_RADIUS_TILES: 2.5,   // радиус точки respool
  FONT_RATIO: 0.8,         // цифра = 80% от диаметра круга

  colorFor(team) {
    return this.TEAM_COLORS[((team % 10) + 10) % 10] || '#ffffff';
  },

  // Возвращает { starts:[{x,y,team}], respools:[{x,y}] }
  find(mapModel) {
    const empty = { starts: [], respools: [] };
    if (!mapModel) return empty;

    const tileInfo = new Map();
    for (const ts of mapModel.tilesets) {
      for (const idStr in ts.tiles) {
        const localID = parseInt(idStr, 10);
        const t = ts.tiles[localID];
        if (!t || !t.props) continue;
        const p = t.props;

        const hasRes = Object.prototype.hasOwnProperty.call(p, 'res_pool');
        const hasTeam = p.team != null && p.team !== '';
        const isCC = p.unit === 'commandCenter';

        if (!hasRes && !(hasTeam && isCC)) continue;

        tileInfo.set(ts.firstgid + localID, {
          res_pool: hasRes,
          isCC: hasTeam && isCC,
          team: hasTeam ? (parseInt(p.team, 10) || 0) : null
        });
      }
    }
    if (!tileInfo.size) return empty;

    const starts = [];
    const respools = [];
    const seenStart = new Set();
    const seenRes = new Set();

    for (let y = 0; y < mapModel.H; y++) {
      for (let x = 0; x < mapModel.W; x++) {
        const idx = y * mapModel.W + x;
        for (const lname of mapModel.layerOrder) {
          const id = mapModel.layers[lname][idx];
          if (!id) continue;
          const info = tileInfo.get(id);
          if (!info) continue;
          if (info.res_pool && !seenRes.has(idx)) {
            respools.push({ x, y });
            seenRes.add(idx);
          }
          if (info.isCC && info.team != null && !seenStart.has(idx)) {
            starts.push({ x, y, team: info.team });
            seenStart.add(idx);
          }
        }
      }
    }
    return { starts, respools };
  }
};

})(window.RWEditor = window.RWEditor || {});