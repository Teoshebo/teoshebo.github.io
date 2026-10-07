(function(RW){
'use strict';
const U = RW.Utils;

// ─────────────────────────────────────────────
// PARSE
// ─────────────────────────────────────────────
function parse(xmlText) {
  if (xmlText.charCodeAt(0) === 0xFEFF) xmlText = xmlText.slice(1);

  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    const msg = doc.querySelector('parsererror').textContent || 'XML parse error';
    throw new Error(msg.trim().slice(0, 200));
  }
  const mapEl = doc.querySelector('map');
  if (!mapEl) throw new Error('No <map> element');

  const W = parseInt(mapEl.getAttribute('width'), 10);
  const H = parseInt(mapEl.getAttribute('height'), 10);
  const tw = parseInt(mapEl.getAttribute('tilewidth'), 10);
  const th = parseInt(mapEl.getAttribute('tileheight'), 10);
  const orientation = mapEl.getAttribute('orientation') || 'orthogonal';
  const renderorder = mapEl.getAttribute('renderorder') || 'right-down';
  const version = mapEl.getAttribute('version') || '1.2';

  const mapProps = {};
  const propsEl = mapEl.querySelector(':scope > properties');
  if (propsEl) for (const p of propsEl.querySelectorAll('property')) {
    mapProps[p.getAttribute('name')] = p.getAttribute('value') ?? p.textContent ?? '';
  }
  const typesConfigRaw = mapProps.types_config || null;

  const tilesets = [];
  for (const tsEl of mapEl.querySelectorAll(':scope > tileset')) {
    const firstgid = parseInt(tsEl.getAttribute('firstgid'), 10);
    const name = tsEl.getAttribute('name') || '(unnamed)';
    const columns = parseInt(tsEl.getAttribute('columns'), 10) || 1;
    const tilecount = parseInt(tsEl.getAttribute('tilecount'), 10) || 0;
    const tsTw = parseInt(tsEl.getAttribute('tilewidth'), 10) || tw;
    const tsTh = parseInt(tsEl.getAttribute('tileheight'), 10) || th;

    let imageDataUrl = null;
    let embeddedPngB64 = null;
    const tsProps = tsEl.querySelector(':scope > properties');
    if (tsProps) for (const p of tsProps.querySelectorAll('property')) {
      if (p.getAttribute('name') === 'embedded_png') {
        embeddedPngB64 = (p.textContent || '').replace(/\s+/g, '');
        imageDataUrl = 'data:image/png;base64,' + embeddedPngB64;
        break;
      }
    }

    const imageEl = tsEl.querySelector(':scope > image');
    const imageSource = imageEl ? imageEl.getAttribute('source') : null;
    const imageW = imageEl ? parseInt(imageEl.getAttribute('width'), 10) : 0;
    const imageH = imageEl ? parseInt(imageEl.getAttribute('height'), 10) : 0;

    const terrainTypes = [];
    const terrEl = tsEl.querySelector(':scope > terraintypes');
    if (terrEl) for (const t of terrEl.querySelectorAll('terrain')) {
      terrainTypes.push({
        name: t.getAttribute('name') || '',
        tile: parseInt(t.getAttribute('tile'), 10) || 0
      });
    }

    const tiles = {};
    for (const tileEl of tsEl.querySelectorAll(':scope > tile')) {
      const id = parseInt(tileEl.getAttribute('id'), 10);
      const terrainAttr = tileEl.getAttribute('terrain');
      const terrain = terrainAttr
        ? terrainAttr.split(',').map(v => parseInt(v, 10)) : null;
      const props = {};
      const tPropsEl = tileEl.querySelector(':scope > properties');
      if (tPropsEl) for (const p of tPropsEl.querySelectorAll('property')) {
        props[p.getAttribute('name')] = p.getAttribute('value') ?? '';
      }
      tiles[id] = { terrain, props };
    }

    const xmlStr = new XMLSerializer().serializeToString(tsEl);

    tilesets.push({
      firstgid, name, columns, tilecount,
      tileW: tsTw, tileH: tsTh,
      image: null, imageDataUrl, embeddedPngB64,
      imageSource, imageW, imageH,
      terrainTypes, tiles,
      xmlStr,
      _dirty: false
    });
  }
  tilesets.sort((a, b) => a.firstgid - b.firstgid);

  const layers = {};
  const layerOrder = [];
  const layerOriginalXml = {};
  const skipped = [];

  for (const lEl of mapEl.querySelectorAll(':scope > layer')) {
    const lname = lEl.getAttribute('name');
    const dataEl = lEl.querySelector(':scope > data');
    if (!dataEl) { skipped.push(lname + ' (no data)'); continue; }

    const encoding = dataEl.getAttribute('encoding');
    const compression = dataEl.getAttribute('compression');
    let arr = null;

    try {
      if (encoding === 'base64') {
        let bytes = U.b64ToBytes((dataEl.textContent || '').replace(/\s+/g, ''));
        if (compression === 'zlib') bytes = pako.inflate(bytes);
        if (bytes.byteLength !== W * H * 4) {
          skipped.push(lname + ' (size)'); continue;
        }
        arr = new Uint32Array(bytes.buffer.slice(
          bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
      } else if (encoding === 'csv') {
        const vals = (dataEl.textContent || '').trim().split(/[,\s]+/)
          .map(v => parseInt(v, 10) || 0);
        if (vals.length !== W * H) { skipped.push(lname + ' (csv)'); continue; }
        arr = new Uint32Array(vals);
      } else {
        skipped.push(lname + ' (enc ' + encoding + ')'); continue;
      }
    } catch (e) {
      skipped.push(lname + ' (' + e.message + ')'); continue;
    }

    let finalName = lname;
    if (layers[finalName]) {
      let i = 1;
      while (layers[lname + '_' + i]) i++;
      finalName = lname + '_' + i;
    }
    layers[finalName] = arr;
    layerOrder.push(finalName);
    layerOriginalXml[finalName] = {
      name: lname,
      width: parseInt(lEl.getAttribute('width'), 10) || W,
      height: parseInt(lEl.getAttribute('height'), 10) || H,
      opacity: lEl.getAttribute('opacity'),
      visible: lEl.getAttribute('visible')
    };
  }

  return {
    W, H, tw, th, orientation, renderorder, version,
    mapProps, tilesets, layers, layerOrder,
    layerOriginalXml, skipped,
    rawXml: xmlText,
    typesConfigRaw
  };
}

// ─────────────────────────────────────────────
async function loadImages(map) {
  await Promise.all(map.tilesets.map(ts => new Promise((resolve) => {
    if (!ts.imageDataUrl) return resolve();
    const img = new Image();
    img.onload = () => { ts.image = img; resolve(); };
    img.onerror = () => { console.warn('Image failed:', ts.name); resolve(); };
    img.src = ts.imageDataUrl;
  })));
}

// ─────────────────────────────────────────────
// Rebuild tileset element from model
// ─────────────────────────────────────────────
function serializeTilesetToDom(doc, ts) {
  const el = doc.createElement('tileset');
  el.setAttribute('firstgid', ts.firstgid);
  el.setAttribute('name', ts.name);
  el.setAttribute('columns', ts.columns);
  el.setAttribute('tilecount', ts.tilecount);
  el.setAttribute('tileheight', ts.tileH);
  el.setAttribute('tilewidth', ts.tileW);

  if (ts.embeddedPngB64) {
    const propsEl = doc.createElement('properties');
    const p = doc.createElement('property');
    p.setAttribute('name', 'embedded_png');
    p.textContent = '\n' + ts.embeddedPngB64 + '\n';
    propsEl.appendChild(p);
    el.appendChild(propsEl);
  }

  if (ts.imageSource) {
    const img = doc.createElement('image');
    img.setAttribute('source', ts.imageSource);
    img.setAttribute('width', ts.imageW || 0);
    img.setAttribute('height', ts.imageH || 0);
    el.appendChild(img);
  }

  if (ts.terrainTypes && ts.terrainTypes.length) {
    const tEl = doc.createElement('terraintypes');
    for (const t of ts.terrainTypes) {
      const tt = doc.createElement('terrain');
      tt.setAttribute('name', t.name || '');
      tt.setAttribute('tile', t.tile || 0);
      tEl.appendChild(tt);
    }
    el.appendChild(tEl);
  }

  const ids = Object.keys(ts.tiles).map(Number).sort((a, b) => a - b);
  for (const id of ids) {
    const tile = ts.tiles[id];
    const hasTerrain = tile.terrain && tile.terrain.some(v => v >= 0);
    const hasProps = Object.keys(tile.props).length > 0;
    if (!hasTerrain && !hasProps) continue;

    const tEl = doc.createElement('tile');
    tEl.setAttribute('id', id);
    if (hasTerrain) {
      tEl.setAttribute('terrain', tile.terrain.join(','));
    }
    if (hasProps) {
      const pEl = doc.createElement('properties');
      for (const k of Object.keys(tile.props)) {
        const p = doc.createElement('property');
        p.setAttribute('name', k);
        p.setAttribute('value', tile.props[k] || '');
        pEl.appendChild(p);
      }
      tEl.appendChild(pEl);
    }
    el.appendChild(tEl);
  }

  return el;
}

// ─────────────────────────────────────────────
// SAVE
//
// Изменения против старой версии:
//  - Слои пересобираются из map.layerOrder, а не из существующего XML.
//  - Новые tileset'ы (без XML-элемента) добавляются перед первым <layer>.
// ─────────────────────────────────────────────
function save(map, typesModel) {
  const doc = new DOMParser().parseFromString(map.rawXml, 'application/xml');
  const mapEl = doc.querySelector('map');
  if (!mapEl) throw new Error('raw XML damaged');

  mapEl.setAttribute('width', map.W);
  mapEl.setAttribute('height', map.H);

  // 1. Tileset'ы — обновить или добавить
  const existingTsEls = Array.from(mapEl.querySelectorAll(':scope > tileset'));
  const newTilesets = [];
  for (const ts of map.tilesets) {
    if (!ts._dirty) continue;
    const oldEl = existingTsEls.find(el =>
      parseInt(el.getAttribute('firstgid'), 10) === ts.firstgid);
    const newEl = serializeTilesetToDom(doc, ts);
    if (oldEl) {
      mapEl.replaceChild(newEl, oldEl);
      const i = existingTsEls.indexOf(oldEl);
      if (i >= 0) existingTsEls[i] = newEl;
    } else {
      newTilesets.push(newEl);
    }
    ts._dirty = false;
  }
  if (newTilesets.length) {
    const firstLayer = mapEl.querySelector(':scope > layer');
    for (const newEl of newTilesets) {
      if (firstLayer) mapEl.insertBefore(newEl, firstLayer);
      else mapEl.appendChild(newEl);
    }
  }

  // 2. Слои — удалить все, добавить заново в порядке layerOrder
  for (const el of Array.from(mapEl.querySelectorAll(':scope > layer'))) el.remove();

  for (const name of map.layerOrder) {
    const data = map.layers[name];
    if (!data) continue;
    const info = map.layerOriginalXml[name] || {};
    const lEl = doc.createElement('layer');
    lEl.setAttribute('name', info.name || name);
    lEl.setAttribute('width', map.W);
    lEl.setAttribute('height', map.H);
    if (info.opacity != null) lEl.setAttribute('opacity', info.opacity);
    if (info.visible != null) lEl.setAttribute('visible', info.visible);

    const dataEl = doc.createElement('data');
    dataEl.setAttribute('encoding', 'base64');
    dataEl.setAttribute('compression', 'zlib');
    dataEl.textContent = '\n' + U.encodeUint32LE(data) + '\n';
    lEl.appendChild(dataEl);
    mapEl.appendChild(lEl);
  }

  // 3. types_config в properties
  if (typesModel) {
    const json = JSON.stringify(typesModel.toJSON());
    let propsEl = mapEl.querySelector(':scope > properties');
    if (!propsEl) {
      propsEl = doc.createElement('properties');
      mapEl.insertBefore(propsEl, mapEl.firstChild);
    }
    let propEl = propsEl.querySelector(':scope > property[name="types_config"]');
    if (!propEl) {
      propEl = doc.createElement('property');
      propEl.setAttribute('name', 'types_config');
      propsEl.appendChild(propEl);
    }
    propEl.setAttribute('value', json);
  }

  // 4. Сериализация
  let xml = new XMLSerializer().serializeToString(doc);
  xml = xml.replace(/<\?xml[^?]*\?>\s*/gi, '');
  return "<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>\n" + xml;
}

RW.TMX = { parse, loadImages, save, serializeTilesetToDom };
})(window.RWEditor = window.RWEditor || {});