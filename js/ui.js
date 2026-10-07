(function(RW){
'use strict';

const LAYER_PALETTE = ['#8cf','#fc8','#8f8','#f8c','#c8f','#f88','#ff8','#8ff','#f8f'];

// ═══════════════════════════════════════════════
// LAYERS
// ═══════════════════════════════════════════════
class LayersPanel {
  constructor(el, ctx) {
    this.el = el;
    this.ctx = ctx;
  }

  build() {
    const map = this.ctx.getMap();
    const r = this.ctx.getRenderer();
    const active = this.ctx.getActiveLayer();

    this.el.innerHTML = '';

    const header = document.createElement('h3');
    const titleTxt = document.createElement('span');
    titleTxt.innerHTML = 'LAYERS';
    const activeLbl = document.createElement('span');
    activeLbl.id = 'activeLayerLabel';
    activeLbl.textContent = active || '—';
    const addBtn = document.createElement('button');
    addBtn.className = 'layer-add';
    addBtn.textContent = '+';
    addBtn.title = 'Добавить слой';
    addBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.addLayer();
    });

    header.append(titleTxt, addBtn, activeLbl);
    this.el.appendChild(header);

    if (!map) return;

    map.layerOrder.forEach((name, idx) => {
      const row = document.createElement('div');
      row.className = 'layer' + (active === name ? ' active' : '');
      row.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        this.ctx.setActiveLayer(name);
        this.build();
        r.render();
      });

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = r.layerVisibility[name] !== false;
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        r.setLayerVisibility(name, cb.checked);
        if (!cb.checked && r.soloLayer === name) r.soloLayer = null;
        r.invalidate();
        r.render();
      });

      const sw = document.createElement('span');
      sw.className = 'sw';
      sw.style.background = LAYER_PALETTE[idx % LAYER_PALETTE.length];

      const nm = document.createElement('span');
      nm.className = 'nm';
      nm.textContent = name;

      const upBtn = document.createElement('button');
      upBtn.className = 'layer-mv';
      upBtn.textContent = '▲';
      upBtn.title = 'Вверх';
      upBtn.disabled = idx === 0;
      upBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveLayer(name, -1);
      });

      const dnBtn = document.createElement('button');
      dnBtn.className = 'layer-mv';
      dnBtn.textContent = '▼';
      dnBtn.title = 'Вниз';
      dnBtn.disabled = idx === map.layerOrder.length - 1;
      dnBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.moveLayer(name, 1);
      });

      const clrBtn = document.createElement('button');
      clrBtn.className = 'layer-mv layer-clr';
      clrBtn.textContent = 'C';
      clrBtn.title = 'Очистить слой (стереть все тайлы)';
      clrBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearLayer(name);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'layer-mv layer-del';
      delBtn.textContent = '×';
      delBtn.title = 'Удалить слой';
      delBtn.disabled = map.layerOrder.length <= 1;
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeLayer(name);
      });

      const solo = document.createElement('span');
      solo.className = 'solo' + (r.soloLayer === name ? ' on' : '');
      solo.textContent = 'S';
      solo.addEventListener('click', (e) => {
        e.stopPropagation();
        r.setSolo(r.soloLayer === name ? null : name);
        r.invalidate();
        this.build();
        r.render();
      });

      row.append(cb, sw, nm, upBtn, dnBtn, clrBtn, delBtn, solo);
      this.el.appendChild(row);
    });
  }

  addLayer() {
    const map = this.ctx.getMap();
    if (!map) return;
    const name = prompt('Имя слоя:', 'Items_new');
    if (!name) return;
    if (map.layers[name]) { alert('Слой с таким именем уже есть'); return; }
    const itemsIdx = map.layerOrder.indexOf('Items');
    const insertBefore = itemsIdx >= 0 ? 'Items' : null;
    map.addLayer(name, insertBefore);
    const r = this.ctx.getRenderer();
    r.layerVisibility[name] = true;
    r.invalidate();
    this.build();
    r.render();
  }

  moveLayer(name, delta) {
    const map = this.ctx.getMap();
    if (!map) return;
    const idx = map.layerOrder.indexOf(name);
    if (idx < 0) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= map.layerOrder.length) return;
    const tmp = map.layerOrder[idx];
    map.layerOrder[idx] = map.layerOrder[newIdx];
    map.layerOrder[newIdx] = tmp;
    const r = this.ctx.getRenderer();
    r.invalidate();
    this.build();
    r.render();
  }

  clearLayer(name) {
    const map = this.ctx.getMap();
    if (!map) return;
    if (!map.layers[name]) return;
    if (!confirm('Очистить слой "' + name + '"? Все тайлы будут стёрты.')) return;
    map.clearLayer(name);
    const r = this.ctx.getRenderer();
    r.invalidate();
    r.render();
  }

  removeLayer(name) {
    const map = this.ctx.getMap();
    if (!map) return;
    if (!confirm('Удалить слой "' + name + '"? Данные будут потеряны.')) return;

    const active = this.ctx.getActiveLayer();
    const r = this.ctx.getRenderer();

    map.removeLayer(name);
    delete r.layerVisibility[name];
    if (r.soloLayer === name) r.soloLayer = null;

    if (active === name) {
      const next = map.layerOrder[0] || null;
      this.ctx.setActiveLayer(next);
    }

    r.invalidate();
    this.build();
    r.render();
  }
}

// ═══════════════════════════════════════════════
// BRUSH PANEL
// ═══════════════════════════════════════════════
class BrushPanel {
  constructor(listEl, totalEl, settingsEl, ctx) {
    this.listEl = listEl;
    this.totalEl = totalEl;
    this.settingsEl = settingsEl;
    this.ctx = ctx;
  }

  build() {
    this.buildSettings();
    this.buildList();
  }

  buildSettings() {
    const st = this.ctx.getBrushSettings();
    this.settingsEl.innerHTML = '';

    const sizeLbl = document.createElement('label');
    sizeLbl.textContent = 'Size';
    const sizeInp = document.createElement('input');
    sizeInp.type = 'number';
    sizeInp.min = '0'; sizeInp.max = '30';
    sizeInp.value = st.size;
    sizeInp.addEventListener('input', () => {
      const v = parseInt(sizeInp.value, 10);
      st.size = isNaN(v) ? 0 : Math.max(0, Math.min(30, v));
      this.ctx.onBrushSettingsChanged();
    });
    sizeLbl.appendChild(sizeInp);

    const shapeLbl = document.createElement('label');
    shapeLbl.textContent = 'Shape';
    const shapeSel = document.createElement('select');
    for (const opt of [['square','Квадрат'],['circle','Круг'],['diamond','Ромб']]) {
      const o = document.createElement('option');
      o.value = opt[0]; o.textContent = opt[1];
      shapeSel.appendChild(o);
    }
    shapeSel.value = st.shape;
    shapeSel.addEventListener('change', () => {
      st.shape = shapeSel.value;
      this.ctx.onBrushSettingsChanged();
    });
    shapeLbl.appendChild(shapeSel);

    this.settingsEl.append(sizeLbl, shapeLbl);
  }

  buildList() {
    const brush = this.ctx.getBrush();
    this.listEl.innerHTML = '';
    if (!brush.length) {
      const empty = document.createElement('div');
      empty.style.color = '#555';
      empty.style.fontSize = '10px';
      empty.style.padding = '4px';
      empty.textContent = 'Клик по тайлу в атласе. +EMPTY — пустота.';
      this.listEl.appendChild(empty);
      this.totalEl.textContent = 'Σ 0';
      return;
    }

    const renderer = this.ctx.getRenderer();

    brush.forEach((b, i) => {
      const row = document.createElement('div');
      row.className = 'bi';

      const cnv = document.createElement('canvas');
      cnv.width = 24; cnv.height = 24;
      const g = cnv.getContext('2d');
      g.imageSmoothingEnabled = false;
      if (b.tileID === 0) {
        const s = 6;
        for (let yy = 0; yy < 24; yy += s)
          for (let xx = 0; xx < 24; xx += s) {
            const dark = ((xx / s) + (yy / s)) % 2 === 0;
            g.fillStyle = dark ? '#2a2a2a' : '#3a3a3a';
            g.fillRect(xx, yy, s, s);
          }
      } else {
        const ts = renderer.findTileset(b.tileID);
        if (ts && ts.image) {
          const localID = b.tileID - ts.firstgid;
          const col = localID % ts.columns;
          const row2 = Math.floor(localID / ts.columns);
          g.drawImage(ts.image,
            col * ts.tileW, row2 * ts.tileH, ts.tileW, ts.tileH,
            0, 0, 24, 24);
        } else {
          g.fillStyle = '#333';
          g.fillRect(0, 0, 24, 24);
        }
      }

      const idEl = document.createElement('span');
      idEl.className = 'id';
      idEl.textContent = b.tileID === 0 ? 'EMPTY' : '#' + b.tileID;

      const wInput = document.createElement('input');
      wInput.type = 'number';
      wInput.min = '0';
      wInput.step = '0.1';
      wInput.value = b.weight;
      wInput.addEventListener('input', () => {
        const v = parseFloat(wInput.value);
        b.weight = isNaN(v) ? 0 : Math.max(0, v);
        this.updateTotal();
      });

      const del = document.createElement('button');
      del.className = 'del';
      del.textContent = '×';
      del.addEventListener('click', () => {
        brush.splice(i, 1);
        this.buildList();
        this.ctx.onBrushChanged();
      });

      row.append(cnv, idEl, wInput, del);
      this.listEl.appendChild(row);
    });
    this.updateTotal();
  }

  updateTotal() {
    const sum = this.ctx.getBrush().reduce((s, b) => s + b.weight, 0);
    this.totalEl.textContent = 'Σ ' + sum.toFixed(2);
  }
}

// ═══════════════════════════════════════════════
// TILESET TABS
// ═══════════════════════════════════════════════
class TilesetTabs {
  constructor(tabsListEl, bodyEl, bottomEl, ctx) {
    this.tabsListEl = tabsListEl;
    this.bodyEl = bodyEl;
    this.bottomEl = bottomEl;
    this.ctx = ctx;
    this.activeIdx = 0;
    this.zoom = 1;
    this.editMode = false;
    this.terrainEditMode = false;
    this.showIds = true;
    this.canvasRef = null;
    this.redrawFn = null;
  }

  build() {
    const map = this.ctx.getMap();
    this.tabsListEl.innerHTML = '';
    this.bodyEl.innerHTML = '';
    if (!map || !map.tilesets.length) {
      this.bodyEl.innerHTML = '<div class="empty-msg">Нет tileset\'ов</div>';
      return;
    }

    if (this.activeIdx < 0 || this.activeIdx >= map.tilesets.length) this.activeIdx = 0;

    map.tilesets.forEach((ts, i) => {
      const btn = document.createElement('button');
      btn.textContent = ts.name.length > 20 ? ts.name.slice(0, 18) + '…' : ts.name;
      btn.title = ts.name + ' (firstgid=' + ts.firstgid + ')';
      btn.addEventListener('click', () => {
        this.activeIdx = i;
        this.build();
      });
      if (i === this.activeIdx) btn.classList.add('active');
      this.tabsListEl.appendChild(btn);
    });

    const ts = map.tilesets[this.activeIdx];
    if (ts) this.bodyEl.appendChild(this.buildBlock(ts));
  }

  buildBlock(ts) {
    const block = document.createElement('div');
    block.className = 'ts-block';

    const head = document.createElement('div');
    head.className = 'ts-head';
    head.innerHTML =
      '<b>' + ts.name + '</b>' +
      '<span class="tag">firstgid=' + ts.firstgid + '</span>' +
      '<span class="tag">tiles=' + ts.tilecount + '</span>' +
      '<span class="tag">columns=' + ts.columns + '</span>' +
      '<span class="tag">' + ts.tileW + '×' + ts.tileH + '</span>';
    block.appendChild(head);

    const toolbar = document.createElement('div');
    toolbar.className = 'ts-toolbar';

    const zoomLabel = document.createElement('span');
    zoomLabel.className = 'ts-tool-label';
    zoomLabel.textContent = 'Zoom: ' + this.zoom + '×';
    toolbar.appendChild(zoomLabel);

    const editLbl = document.createElement('label');
    editLbl.className = 'ts-check';
    const editCb = document.createElement('input');
    editCb.type = 'checkbox';
    editCb.checked = this.editMode;
    editCb.addEventListener('change', () => {
      this.editMode = editCb.checked;
      this.build();
    });
    editLbl.append(editCb, document.createTextNode(' Edit'));
    toolbar.appendChild(editLbl);

    const idsLbl = document.createElement('label');
    idsLbl.className = 'ts-check';
    const idsCb = document.createElement('input');
    idsCb.type = 'checkbox';
    idsCb.checked = this.showIds;
    idsCb.addEventListener('change', () => {
      this.showIds = idsCb.checked;
      this.build();
    });
    idsLbl.append(idsCb, document.createTextNode(' Show IDs'));
    toolbar.appendChild(idsLbl);

    const terrainBtn = document.createElement('button');
    terrainBtn.textContent = this.terrainEditMode ? '▼ Terrain' : '▶ Terrain';
    terrainBtn.className = 'ts-terrain-btn';
    terrainBtn.addEventListener('click', () => {
      this.terrainEditMode = !this.terrainEditMode;
      this.build();
    });
    toolbar.appendChild(terrainBtn);

    block.appendChild(toolbar);

    const pickMode = this.ctx.getPickMode ? this.ctx.getPickMode() : null;

    const info = document.createElement('div');
    info.className = 'ts-info';
    if (pickMode) {
      info.innerHTML = '<b style="color:#e8f">Режим выбора тайла</b> · клик — применить · повторный клик — убрать';
    } else if (this.editMode) {
      info.textContent = 'Edit: клик по тайлу — редактирование';
    } else {
      info.textContent = '— клик: выбрать · Shift+клик: добавить · колесо: zoom —';
    }

    const wrapEl = document.createElement('div');
    wrapEl.className = 'ts-canvas-wrap';

    if (ts.image) {
      const cnv = document.createElement('canvas');
      cnv.className = 'ts-canvas';
      cnv.width = ts.image.naturalWidth;
      cnv.height = ts.image.naturalHeight;
      cnv.style.width = (cnv.width * this.zoom) + 'px';
      cnv.style.height = (cnv.height * this.zoom) + 'px';

      const g = cnv.getContext('2d');
      g.imageSmoothingEnabled = false;

      const self = this;
      function isSelected(localID) {
        const globalID = ts.firstgid + localID;
        return self.ctx.getBrush().some(b => b.tileID === globalID);
      }
      function isPickTarget(localID) {
        const pm = self.ctx.getPickMode ? self.ctx.getPickMode() : null;
        if (!pm) return false;
        const globalID = ts.firstgid + localID;
        if (pm.kind === 'edge') {
          const t = self.ctx.getModel().get(pm.typeId);
          return t && t.edges[pm.role] === globalID;
        }
        if (pm.kind === 'solid') {
          const t = self.ctx.getModel().get(pm.typeId);
          return t && t.solids.some(s => s.tileID === globalID);
        }
        return false;
      }

      function redraw() {
        cnv.style.width = (cnv.width * self.zoom) + 'px';
        cnv.style.height = (cnv.height * self.zoom) + 'px';
        g.drawImage(ts.image, 0, 0);
        g.strokeStyle = 'rgba(255,255,255,0.18)';
        g.lineWidth = 1;
        g.beginPath();
        for (let x = 0; x <= ts.columns; x++) {
          g.moveTo(x * ts.tileW + 0.5, 0);
          g.lineTo(x * ts.tileW + 0.5, cnv.height);
        }
        const rows = Math.ceil(ts.tilecount / ts.columns);
        for (let y = 0; y <= rows; y++) {
          g.moveTo(0, y * ts.tileH + 0.5);
          g.lineTo(cnv.width, y * ts.tileH + 0.5);
        }
        g.stroke();

        if (self.showIds) {
          g.font = 'bold 8px monospace';
          g.textAlign = 'left';
          g.textBaseline = 'top';
          for (let i = 0; i < ts.tilecount; i++) {
            const col = i % ts.columns;
            const row = Math.floor(i / ts.columns);
            const label = String(i);
            g.fillStyle = 'rgba(0,0,0,0.55)';
            g.fillRect(col * ts.tileW + 1, row * ts.tileH + 1, label.length * 6 + 3, 10);
            const isPick = isPickTarget(i);
            g.fillStyle = (isPick || isSelected(i)) ? '#fff' : '#fd4';
            g.fillText(label, col * ts.tileW + 2, row * ts.tileH + 2);
          }
        }
        for (let i = 0; i < ts.tilecount; i++) {
          if (!isSelected(i)) continue;
          const col = i % ts.columns;
          const row = Math.floor(i / ts.columns);
          g.strokeStyle = '#f44';
          g.lineWidth = 2;
          g.strokeRect(col * ts.tileW + 1, row * ts.tileH + 1, ts.tileW - 2, ts.tileH - 2);
        }
        for (let i = 0; i < ts.tilecount; i++) {
          if (!isPickTarget(i)) continue;
          const col = i % ts.columns;
          const row = Math.floor(i / ts.columns);
          g.strokeStyle = '#e8f';
          g.lineWidth = 2;
          g.strokeRect(col * ts.tileW + 1, row * ts.tileH + 1, ts.tileW - 2, ts.tileH - 2);
        }
      }

      this.canvasRef = cnv;
      this.redrawFn = redraw;
      redraw();

      wrapEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        const oldZoom = self.zoom;
        if (e.deltaY < 0) self.zoom = Math.min(8, self.zoom + 1);
        else self.zoom = Math.max(1, self.zoom - 1);
        if (oldZoom === self.zoom) return;
        const rect = wrapEl.getBoundingClientRect();
        const cx = e.clientX - rect.left + wrapEl.scrollLeft;
        const cy = e.clientY - rect.top + wrapEl.scrollTop;
        const k = self.zoom / oldZoom;
        redraw();
        wrapEl.scrollLeft = cx * k - (e.clientX - rect.left);
        wrapEl.scrollTop  = cy * k - (e.clientY - rect.top);
        zoomLabel.textContent = 'Zoom: ' + self.zoom + '×';
      }, { passive: false });

      cnv.addEventListener('mousemove', (e) => {
        const r = cnv.getBoundingClientRect();
        const col = Math.floor((e.clientX - r.left) / self.zoom / ts.tileW);
        const row = Math.floor((e.clientY - r.top) / self.zoom / ts.tileH);
        if (col < 0 || col >= ts.columns) { info.textContent = '—'; return; }
        const localID = row * ts.columns + col;
        if (localID < 0 || localID >= ts.tilecount) { info.textContent = '—'; return; }
        info.innerHTML = tileInfoString(ts, localID);
      });
      cnv.addEventListener('mouseleave', () => {
        const pm = self.ctx.getPickMode ? self.ctx.getPickMode() : null;
        if (pm) {
          info.innerHTML = '<b style="color:#e8f">Режим выбора тайла</b> · клик — применить · повторный клик — убрать';
        } else if (self.editMode) {
          info.textContent = 'Edit: клик по тайлу — редактирование';
        } else {
          info.textContent = '— клик: выбрать · Shift+клик: добавить · колесо: zoom —';
        }
      });
      cnv.addEventListener('click', (e) => {
        const r = cnv.getBoundingClientRect();
        const col = Math.floor((e.clientX - r.left) / self.zoom / ts.tileW);
        const row = Math.floor((e.clientY - r.top) / self.zoom / ts.tileH);
        const localID = row * ts.columns + col;
        if (localID < 0 || localID >= ts.tilecount) return;
        const globalID = ts.firstgid + localID;

        const pm = self.ctx.getPickMode ? self.ctx.getPickMode() : null;
        if (pm) {
          self.ctx.applyPick(globalID);
          return;
        }

        if (self.editMode) {
          self.openTileEditor(ts, localID, block, info);
        } else {
          self.ctx.addToBrush(globalID, e.shiftKey);
          redraw();
          info.innerHTML = tileInfoString(ts, localID) + ' · <b>#' + globalID + '</b>';
        }
      });

      wrapEl.appendChild(cnv);
    } else {
      const err = document.createElement('div');
      err.style.color = '#f88';
      err.style.fontSize = '11px';
      err.textContent = 'Нет изображения';
      wrapEl.appendChild(err);
    }

    if (this.terrainEditMode) {
      const split = document.createElement('div');
      split.className = 'ts-split';

      const left = document.createElement('div');
      left.className = 'ts-split-left';
      left.appendChild(wrapEl);
      left.appendChild(info);

      const right = document.createElement('div');
      right.className = 'ts-split-right';
      right.appendChild(this.buildTerrainEditor(ts));

      split.appendChild(left);
      split.appendChild(right);
      block.appendChild(split);
    } else {
      block.appendChild(wrapEl);
      block.appendChild(info);
    }

    return block;
  }

  openTileEditor(ts, localID, parentBlock, infoEl) {
    const old = parentBlock.querySelector('.ts-editor');
    if (old) old.remove();

    if (!ts.tiles[localID]) ts.tiles[localID] = { terrain: null, props: {} };
    const tile = ts.tiles[localID];

    const ed = document.createElement('div');
    ed.className = 'ts-editor';
    ed.innerHTML = '<div class="ts-editor-head">Tile #' + localID +
      ' <span>(global #' + (ts.firstgid + localID) + ')</span></div>';

    const trRow = document.createElement('div');
    trRow.className = 'form-row';
    const terrainLabels = ['TL','TR','BR','BL'];
    for (let i = 0; i < 4; i++) {
      const lbl = document.createElement('label');
      lbl.textContent = terrainLabels[i];
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.value = (tile.terrain && tile.terrain[i] != null) ? tile.terrain[i] : -1;
      inp.addEventListener('input', () => {
        const v = parseInt(inp.value, 10);
        const n = isNaN(v) ? -1 : v;
        if (!tile.terrain) tile.terrain = [-1,-1,-1,-1];
        tile.terrain[i] = n;
        ts._dirty = true;
      });
      lbl.appendChild(inp);
      trRow.appendChild(lbl);
    }
    ed.appendChild(trRow);

    const propSec = document.createElement('div');
    propSec.className = 'form-section';
    const propTitle = document.createElement('div');
    propTitle.className = 'section-title';
    propTitle.innerHTML = '<b>Properties</b>';
    const addPropBtn = document.createElement('button');
    addPropBtn.className = 'mini-btn';
    addPropBtn.textContent = '+ свойство';
    addPropBtn.addEventListener('click', () => {
      const name = prompt('Имя свойства:');
      if (!name) return;
      tile.props[name] = '';
      ts._dirty = true;
      this.openTileEditor(ts, localID, parentBlock, infoEl);
    });
    propTitle.appendChild(addPropBtn);
    propSec.appendChild(propTitle);

    const propList = document.createElement('div');
    propList.className = 'solids-list';
    const propKeys = Object.keys(tile.props);
    if (!propKeys.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-inline';
      empty.textContent = '— нет —';
      propList.appendChild(empty);
    }
    propKeys.forEach(k => {
      const row = document.createElement('div');
      row.className = 'solid-row';
      const kEl = document.createElement('span');
      kEl.className = 'solid-id';
      kEl.textContent = k;
      const vInp = document.createElement('input');
      vInp.type = 'text';
      vInp.value = tile.props[k] || '';
      vInp.placeholder = 'value';
      vInp.addEventListener('input', () => {
        tile.props[k] = vInp.value;
        ts._dirty = true;
      });
      const delBtn = document.createElement('button');
      delBtn.className = 'type-del';
      delBtn.textContent = '×';
      delBtn.addEventListener('click', () => {
        delete tile.props[k];
        ts._dirty = true;
        this.openTileEditor(ts, localID, parentBlock, infoEl);
      });
      row.append(kEl, vInp, delBtn);
      propList.appendChild(row);
    });
    propSec.appendChild(propList);
    ed.appendChild(propSec);

    parentBlock.appendChild(ed);
  }

  buildTerrainEditor(ts) {
    const ed = document.createElement('div');
    ed.className = 'ts-editor ts-terrain';
    ed.innerHTML = '<div class="ts-editor-head">Terrain Types <span>(' + ts.terrainTypes.length + ')</span></div>';

    const list = document.createElement('div');
    list.className = 'solids-list';

    ts.terrainTypes.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'solid-row';

      const nameInp = document.createElement('input');
      nameInp.type = 'text';
      nameInp.value = t.name;
      nameInp.placeholder = 'name';
      nameInp.style.width = '130px';
      nameInp.addEventListener('input', () => {
        t.name = nameInp.value;
        ts._dirty = true;
      });

      const tileInp = document.createElement('input');
      tileInp.type = 'number';
      tileInp.value = t.tile;
      tileInp.addEventListener('input', () => {
        const v = parseInt(tileInp.value, 10);
        t.tile = isNaN(v) ? 0 : v;
        ts._dirty = true;
      });

      const del = document.createElement('button');
      del.className = 'type-del';
      del.textContent = '×';
      del.addEventListener('click', () => {
        ts.terrainTypes.splice(i, 1);
        ts._dirty = true;
        this.build();
      });

      row.append(nameInp, tileInp, del);
      list.appendChild(row);
    });

    if (!ts.terrainTypes.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-inline';
      empty.textContent = '— пусто —';
      list.appendChild(empty);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'mini-btn';
    addBtn.style.marginTop = '6px';
    addBtn.textContent = '+ Terrain';
    addBtn.addEventListener('click', () => {
      ts.terrainTypes.push({ name: 'Terrain' + ts.terrainTypes.length, tile: 0 });
      ts._dirty = true;
      this.build();
    });

    ed.append(list, addBtn);
    return ed;
  }

  refreshSelection() {
    if (this.redrawFn) this.redrawFn();
  }
}

function tileInfoString(ts, localID) {
  const globalID = ts.firstgid + localID;
  const t = ts.tiles[localID];
  let s = 'local=<b>' + localID + '</b> · global=<b>' + globalID + '</b>';
  if (t) {
    if (t.terrain) {
      const names = t.terrain.map(v =>
        v >= 0 && ts.terrainTypes[v] ? ts.terrainTypes[v].name : v);
      s += ' · terrain=[' + names.join(', ') + ']';
    }
    const pk = Object.keys(t.props);
    if (pk.length) s += ' · ' + pk.map(k => k + '=' + (t.props[k] || '✓')).join(' · ');
  }
  return s;
}

RW.LayersPanel = LayersPanel;
RW.BrushPanel = BrushPanel;
RW.TilesetTabs = TilesetTabs;
})(window.RWEditor = window.RWEditor || {});
