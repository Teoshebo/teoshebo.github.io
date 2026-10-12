(function(RW){
'use strict';

const MAX_UNDO = 50;

class MapModel {
  constructor(parsed) {
    this.W = parsed.W;
    this.H = parsed.H;
    this.tw = parsed.tw;
    this.th = parsed.th;
    this.orientation = parsed.orientation;
    this.renderorder = parsed.renderorder;
    this.version = parsed.version;
    this.mapProps = parsed.mapProps;
    this.tilesets = parsed.tilesets;
    this.layers = parsed.layers;
    this.layerOrder = parsed.layerOrder;
    this.layerOriginalXml = parsed.layerOriginalXml;
    this.rawXml = parsed.rawXml;

    this.undoStack = [];
    this.redoStack = [];
    this.onChange = null;
  }

  layerData(name) { return this.layers[name]; }

  get(idx, layer) {
    if (!this.layers[layer]) return 0;
    return this.layers[layer][idx];
  }

  // ─── Слои ───

  addLayer(name, insertBefore) {
    if (this.layers[name]) return null;
    const data = new Uint32Array(this.W * this.H);
    this.layers[name] = data;
    this.layerOriginalXml[name] = {
      name: name, width: this.W, height: this.H,
      opacity: null, visible: null
    };
    if (insertBefore) {
      const idx = this.layerOrder.indexOf(insertBefore);
      if (idx >= 0) this.layerOrder.splice(idx, 0, name);
      else this.layerOrder.push(name);
    } else {
      this.layerOrder.push(name);
    }
    return data;
  }

  removeLayer(name) {
    if (!this.layers[name]) return;
    delete this.layers[name];
    delete this.layerOriginalXml[name];
    const i = this.layerOrder.indexOf(name);
    if (i >= 0) this.layerOrder.splice(i, 1);
  }

  clearLayer(name) {
    const data = this.layers[name];
    if (!data) return false;
    data.fill(0);
    return true;
  }

  // ─── Tileset ───

  removeTileset(idx) {
    if (idx < 0 || idx >= this.tilesets.length) return null;
    const ts = this.tilesets[idx];
    this.tilesets.splice(idx, 1);
    return ts;
  }

  // Стирает все тайлы из заданного tileset'а во всех слоях.
  // Одна undo-транзакция. Возвращает массив {layer, changes}.
  clearTilesetTiles(firstgid, tilecount) {
    const maxId = firstgid + tilecount;
    const layers = [];
    for (const layerName of this.layerOrder) {
      const data = this.layers[layerName];
      if (!data) continue;
      const changes = [];
      for (let i = 0; i < data.length; i++) {
        const id = data[i];
        if (id >= firstgid && id < maxId) {
          changes.push({ idx: i, before: id, after: 0 });
          data[i] = 0;
        }
      }
      if (changes.length) layers.push({ layer: layerName, changes });
    }
    if (!layers.length) return [];
    const entry = { type: 'multi', layers };
    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack.length = 0;
    if (this.onChange) this.onChange(entry);
    return layers;
  }

  // ─── Resize ───

  resize(newW, newH) {
    newW = Math.max(1, Math.floor(newW));
    newH = Math.max(1, Math.floor(newH));
    if (newW === this.W && newH === this.H) return null;

    const oldW = this.W, oldH = this.H;
    const oldLayers = {};
    const newLayers = {};
    const copyW = Math.min(oldW, newW);
    const copyH = Math.min(oldH, newH);

    for (const name of this.layerOrder) {
      const oldData = this.layers[name];
      oldLayers[name] = oldData;
      const newData = new Uint32Array(newW * newH);
      for (let y = 0; y < copyH; y++) {
        const src = y * oldW;
        const dst = y * newW;
        for (let x = 0; x < copyW; x++) newData[dst + x] = oldData[src + x];
      }
      newLayers[name] = newData;
      this.layers[name] = newData;
    }

    const oldLayerOriginalXml = JSON.parse(JSON.stringify(this.layerOriginalXml));
    this.W = newW;
    this.H = newH;
    for (const name of this.layerOrder) {
      if (this.layerOriginalXml[name]) {
        this.layerOriginalXml[name].width = newW;
        this.layerOriginalXml[name].height = newH;
      }
    }
    const newLayerOriginalXml = JSON.parse(JSON.stringify(this.layerOriginalXml));

    const entry = {
      type: 'resize',
      oldW, oldH, newW, newH,
      oldLayers, newLayers,
      oldLayerOriginalXml, newLayerOriginalXml
    };
    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack.length = 0;
    if (this.onChange) this.onChange(entry);
    return entry;
  }

  // ─── Пакетные изменения ───

  applyBatch(layer, changes) {
    const data = this.layers[layer];
    if (!data) return null;
    const real = [];
    const seen = new Set();
    for (const c of changes) {
      if (seen.has(c.idx)) {
        const ex = real.find(r => r.idx === c.idx);
        if (ex) ex.after = c.after;
        continue;
      }
      seen.add(c.idx);
      const before = data[c.idx];
      if (before === c.after) continue;
      real.push({ idx: c.idx, before, after: c.after });
    }
    if (!real.length) return null;
    for (const c of real) data[c.idx] = c.after;
    const entry = { layer, changes: real };
    this.undoStack.push(entry);
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack.length = 0;
    if (this.onChange) this.onChange(entry);
    return entry;
  }

  // ─── Undo / Redo ───
  // Поддерживает 3 формата entries:
  //   {type:'resize', ...}       — ресайз карты
  //   {type:'multi', layers:[]}  — multi-layer stroke / tileset clear
  //   {layer, changes}           — legacy single-layer (floodFill, rect, autotile dialog)

  undo() {
    if (!this.undoStack.length) return null;
    const entry = this.undoStack.pop();
    if (entry.type === 'resize') {
      this.W = entry.oldW;
      this.H = entry.oldH;
      for (const name in entry.oldLayers) this.layers[name] = entry.oldLayers[name];
      this.layerOriginalXml = JSON.parse(JSON.stringify(entry.oldLayerOriginalXml));
    } else if (entry.type === 'multi') {
      for (const le of entry.layers) {
        const data = this.layers[le.layer];
        if (!data) continue;
        for (const c of le.changes) data[c.idx] = c.before;
      }
    } else {
      const data = this.layers[entry.layer];
      if (data) for (const c of entry.changes) data[c.idx] = c.before;
    }
    this.redoStack.push(entry);
    if (this.onChange) this.onChange(entry);
    return entry;
  }

  redo() {
    if (!this.redoStack.length) return null;
    const entry = this.redoStack.pop();
    if (entry.type === 'resize') {
      this.W = entry.newW;
      this.H = entry.newH;
      for (const name in entry.newLayers) this.layers[name] = entry.newLayers[name];
      this.layerOriginalXml = JSON.parse(JSON.stringify(entry.newLayerOriginalXml));
    } else if (entry.type === 'multi') {
      for (const le of entry.layers) {
        const data = this.layers[le.layer];
        if (!data) continue;
        for (const c of le.changes) data[c.idx] = c.after;
      }
    } else {
      const data = this.layers[entry.layer];
      if (data) for (const c of entry.changes) data[c.idx] = c.after;
    }
    this.undoStack.push(entry);
    if (this.onChange) this.onChange(entry);
    return entry;
  }

  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }
}

RW.MapModel = MapModel;
})(window.RWEditor = window.RWEditor || {});
