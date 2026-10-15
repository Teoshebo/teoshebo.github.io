(function(RW){
'use strict';
const M = RW.Merge = RW.Merge || {};

// ─── Быстрый не-крипто hash ───
function cyrb53(str, seed) {
  seed = seed || 0;
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// ─── Fingerprint PNG: длина + головной/средний/хвостовой срез ───
// Достаточно для отличения двух разных PNG с одинаковым именем tileset'а.
function pngFingerprint(b64) {
  if (!b64) return '0';
  const n = b64.length;
  const head = b64.slice(0, 256);
  const mid = b64.slice(Math.max(0, (n >> 1) - 128), (n >> 1) + 128);
  const tail = b64.slice(-256);
  return n + ':' + cyrb53(head + '|' + mid + '|' + tail);
}

// ═══════════════════════════════════════════════
// MAIN
// layout = [{ parsed, name, x, y }]  x,y — в ТАЙЛАХ (могут быть отрицательные)
// ═══════════════════════════════════════════════
M.run = async function(layout) {
  if (layout.length < 1) throw new Error('Нет карт');

  // tileW/tileH обязательно одинаковые
  const tw = layout[0].parsed.tw, th = layout[0].parsed.th;
  for (const e of layout) {
    if (e.parsed.tw !== tw || e.parsed.th !== th) {
      throw new Error('Разные tile-размеры: "' + e.name + '" — ' +
        e.parsed.tw + '×' + e.parsed.th);
    }
  }

  // Bounding box
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const e of layout) {
    minX = Math.min(minX, e.x);
    minY = Math.min(minY, e.y);
    maxX = Math.max(maxX, e.x + e.parsed.W);
    maxY = Math.max(maxY, e.y + e.parsed.H);
  }
  const W = maxX - minX, H = maxY - minY;
  if (W <= 0 || H <= 0) throw new Error('Некорректный bounding box');

  // Tileset merge (ремапит ID всех карт, включая первую)
  const { tilesets, remaps } = M.mergeTilesets(layout);

  // Layer merge (с ремапом ID)
  const { layers, layerOrder } = M.mergeLayers(layout, remaps, W, H, minX, minY);

  // Types config — из первой карты, с ремапом ID
  const typesConfigRaw = M.remapTypesConfig(
    layout[0].parsed.typesConfigRaw || null,
    remaps[0]
  );

  // Скелет XML для будущего save()
  const rawXml = "<?xml version='1.0' encoding='UTF-8' standalone='yes'?>\n" +
    '<map version="' + (layout[0].parsed.version || '1.2') + '"' +
    ' orientation="' + (layout[0].parsed.orientation || 'orthogonal') + '"' +
    ' renderorder="' + (layout[0].parsed.renderorder || 'right-down') + '"' +
    ' width="' + W + '" height="' + H + '"' +
    ' tilewidth="' + tw + '" tileheight="' + th + '" nextobjectid="0">\n' +
    '</map>';

  const layerOriginalXml = {};
  for (const n of layerOrder) {
    layerOriginalXml[n] = { name: n, width: W, height: H, opacity: null, visible: null };
  }

  return {
    W, H, tw, th,
    orientation: layout[0].parsed.orientation || 'orthogonal',
    renderorder: layout[0].parsed.renderorder || 'right-down',
    version: layout[0].parsed.version || '1.2',
    mapProps: Object.assign({}, layout[0].parsed.mapProps),
    tilesets, layers, layerOrder,
    layerOriginalXml,
    skipped: [],
    rawXml,
    typesConfigRaw
  };
};

// ═══════════════════════════════════════════════
// TILESET MERGE
// Возвращает { tilesets: merged[], remaps: [Map<oldID,newID>][] }
// ═══════════════════════════════════════════════
M.mergeTilesets = function(layout) {
  const result = [];
  const remaps = [];
  const byKey = new Map();
  let nextFirstgid = 1;

  for (let mi = 0; mi < layout.length; mi++) {
    const parsed = layout[mi].parsed;
    const remap = new Map();
    remap.set(0, 0);

    for (const ts of parsed.tilesets) {
      const fp = pngFingerprint(ts.embeddedPngB64 || '');
      const key = ts.name + '::' + fp;
      let existing = byKey.get(key);

      if (!existing) {
        // Разные PNG с одинаковым именем — авто-переименование
        let finalName = ts.name;
        if (result.find(x => x.name === finalName)) {
          let i = 2;
          while (result.find(x => x.name === finalName + '_' + i)) i++;
          finalName = ts.name + '_' + i;
        }
        existing = {
          firstgid: nextFirstgid,
          name: finalName,
          columns: ts.columns,
          tilecount: ts.tilecount,
          tileW: ts.tileW, tileH: ts.tileH,
          embeddedPngB64: ts.embeddedPngB64,
          imageDataUrl: ts.imageDataUrl,
          image: ts.image,
          terrainTypes: JSON.parse(JSON.stringify(ts.terrainTypes || [])),
          tiles: JSON.parse(JSON.stringify(ts.tiles || {})),
          xmlStr: null,
          _dirty: true
        };
        nextFirstgid += ts.tilecount;
        result.push(existing);
        byKey.set(key, existing);
      }

      // Ремап ID
      const delta = existing.firstgid - ts.firstgid;
      for (let localID = 0; localID < ts.tilecount; localID++) {
        const oldID = ts.firstgid + localID;
        remap.set(oldID, oldID + delta);
      }
    }
    remaps.push(remap);
  }

  return { tilesets: result, remaps };
};

// ═══════════════════════════════════════════════
// LAYER MERGE
// ═══════════════════════════════════════════════
M.mergeLayers = function(layout, remaps, W, H, minX, minY) {
  // Layer order: из первой карты, потом уникальные из остальных.
  // «Items» принудительно последний.
  const seen = new Set();
  const order = [];
  for (const e of layout) {
    for (const name of e.parsed.layerOrder) {
      if (seen.has(name)) continue;
      seen.add(name);
      order.push(name);
    }
  }
  const itemsIdx = order.indexOf('Items');
  if (itemsIdx >= 0 && itemsIdx !== order.length - 1) {
    order.splice(itemsIdx, 1);
    order.push('Items');
  }

  const layers = {};
  for (const name of order) {
    layers[name] = new Uint32Array(W * H);
  }

  // Fill bottom-to-top: layout[0] — низ, layout[last] — верх.
  // При overlap выигрывает тот, кто выше в списке (позже в layout).
  for (let mi = 0; mi < layout.length; mi++) {
    const e = layout[mi];
    const remap = remaps[mi];
    const ox = e.x - minX;
    const oy = e.y - minY;

    for (const name of order) {
      const src = e.parsed.layers[name];
      if (!src) continue;
      const dst = layers[name];

      for (let sy = 0; sy < e.parsed.H; sy++) {
        for (let sx = 0; sx < e.parsed.W; sx++) {
          const oldID = src[sy * e.parsed.W + sx];
          if (!oldID) continue;
          const newID = remap.get(oldID);
          if (newID == null || newID === 0) continue;
          dst[(oy + sy) * W + (ox + sx)] = newID;
        }
      }
    }
  }

  return { layers, layerOrder: order };
};

// ═══════════════════════════════════════════════
// TYPES CONFIG REMAP
// ═══════════════════════════════════════════════
M.remapTypesConfig = function(raw, remap) {
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw);
    for (const t of (cfg.types || [])) {
      if (t.edges) {
        for (const k in t.edges) {
          if (!t.edges[k]) continue;
          const n = remap.get(t.edges[k]);
          t.edges[k] = n != null ? n : 0;
        }
      }
      if (t.solids) {
        t.solids = t.solids
          .map(s => {
            const n = remap.get(s.tileID);
            return n != null ? { tileID: n, weight: s.weight } : null;
          })
          .filter(Boolean);
      }
    }
    return JSON.stringify(cfg);
  } catch (e) {
    return raw;
  }
};

})(window.RWEditor = window.RWEditor || {});