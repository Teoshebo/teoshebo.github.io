(function(RW){
'use strict';

const LAYER_PALETTE = ['#8cf','#fc8','#8f8','#f8c','#c8f','#f88','#ff8','#8ff','#f8f'];
const PROTECTED_LAYER_NAMES = new Set(['Ground', 'Units', 'Items']);

function terrainHue(idx) { return (idx * 137.5) % 360; }
function terrainColorCss(idx, alpha) {
  return 'hsla(' + terrainHue(idx) + ', 75%, 55%, ' + alpha + ')';
}

// ═══════════════════════════════════════════════
// LAYERS
// ═══════════════════════════════════════════════
class LayersPanel {
  constructor(el, ctx) {
    this.el = el;
    this.ctx = ctx;
    this._delegated = false;
    this._flashTimers = new Map();
  }

  build() {
    const map = this.ctx.getMap();
    const r = this.ctx.getRenderer();
    const active = this.ctx.getActiveLayer();

    this.el.innerHTML = '';

    if (!this._delegated) {
      this._delegated = true;
      this.el.addEventListener('dblclick', (e) => {
        const nm = e.target.closest('.nm');
        if (!nm) return;
        const row = nm.closest('.layer');
        if (!row) return;
        const name = row.dataset.layerName;
        if (!name) return;
        e.stopPropagation();
        e.preventDefault();
        this.startRename(row, name);
      });
    }

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
      row.dataset.layerName = name;

      row.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        if (e.target.classList.contains('nm-editing')) return;
        this.ctx.setActiveLayer(name);
        Array.from(this.el.children).forEach(child => {
          if (child.classList && child.classList.contains('layer')) {
            child.classList.toggle('active', child.dataset.layerName === name);
          }
        });
        const lbl = this.el.querySelector('#activeLayerLabel');
        if (lbl) lbl.textContent = name;
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
      nm.title = 'Двойной клик — переименовать';

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
        Array.from(this.el.children).forEach(child => {
          if (child.classList && child.classList.contains('layer')) {
            const s = child.querySelector('.solo');
            if (s) s.classList.toggle('on', child.dataset.layerName === r.soloLayer);
          }
        });
        r.render();
      });

      row.append(cb, sw, nm, upBtn, dnBtn, clrBtn, delBtn, solo);
      this.el.appendChild(row);
    });
  }

  // ─── FLASH ───
  flash(name) {
    if (!name) return;
    const row = this.el.querySelector('.layer[data-layer-name="' + name + '"]');
    if (!row) return;
    row.classList.remove('flash');
    void row.offsetWidth;
    row.classList.add('flash');
    const prev = this._flashTimers.get(name);
    if (prev) clearTimeout(prev);
    const t = setTimeout(() => {
      row.classList.remove('flash');
      this._flashTimers.delete(name);
    }, 500);
    this._flashTimers.set(name, t);
  }

  startRename(row, oldName) {
    if (row.querySelector('.nm-editing')) return;
    const nm = row.querySelector('.nm');
    if (!nm) return;

    const inp = document.createElement('input');
    inp.type = 'text';
    inp.className = 'nm-editing';
    inp.value = oldName;
    inp.spellcheck = false;

    nm.replaceWith(inp);
    inp.focus();
    inp.select();

    let done = false;
    const finish = (commit) => {
      if (done) return;
      done = true;
      const newName = commit ? (inp.value || '').trim() : oldName;
      if (!commit || !newName || newName === oldName) { this.build(); return; }
      this.renameLayer(oldName, newName);
      this.build();
    };

    inp.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); finish(true); }
      else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
    });
    inp.addEventListener('blur', () => finish(true));
    inp.addEventListener('click', (e) => e.stopPropagation());
    inp.addEventListener('mousedown', (e) => e.stopPropagation());
    inp.addEventListener('dblclick', (e) => e.stopPropagation());
  }

  renameLayer(oldName, newName) {
    const map = this.ctx.getMap();
    const r = this.ctx.getRenderer();
    if (!map) return false;
    if (!map.layers[oldName]) return false;
    if (map.layers[newName] && newName !== oldName) {
      alert('Слой с именем "' + newName + '" уже существует');
      return false;
    }
    if (PROTECTED_LAYER_NAMES.has(oldName)) {
      if (!confirm(
        'Слой "' + oldName + '" — служебный RW. Переименование сломает:\n' +
        '• генератор (Ground / Items0)\n' +
        '• правила порядка слоёв\n\n' +
        'Переименовать всё равно?'
      )) return false;
    }
    const idx = map.layerOrder.indexOf(oldName);
    if (idx < 0) return false;

    map.layers[newName] = map.layers[oldName];
    delete map.layers[oldName];
    map.layerOrder[idx] = newName;

    if (map.layerOriginalXml[oldName]) {
      map.layerOriginalXml[newName] = map.layerOriginalXml[oldName];
      map.layerOriginalXml[newName].name = newName;
      delete map.layerOriginalXml[oldName];
    }

    if (r) {
      const vis = r.layerVisibility[oldName];
      delete r.layerVisibility[oldName];
      r.layerVisibility[newName] = vis !== false;
      if (r.soloLayer === oldName) r.soloLayer = newName;
    }
    if (this.ctx.getActiveLayer() === oldName) this.ctx.setActiveLayer(newName);
    if (r) { r.invalidate(); r.render(); }

    const st = document.getElementById('status');
    if (st) st.textContent = 'Слой "' + oldName + '" → "' + newName + '"';
    return true;
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
// BRUSH PANEL — 3 режима
// ═══════════════════════════════════════════════
class BrushPanel {
  constructor(opts) {
    this.listEl = opts.listEl;
    this.totalEl = opts.totalEl;
    this.settingsEl = opts.settingsEl;
    this.classicListEl = opts.classicListEl;
    this.tnsListEl = opts.tnsListEl;
    this.classicPanelEl = opts.classicPanelEl;
    this.tnsPanelEl = opts.tnsPanelEl;
    this.ctx = opts.ctx;
  }

  build() {
    const tool = this.ctx.getActiveTool ? this.ctx.getActiveTool() : 'brush';
    this.applyMode(tool);
    if (tool === 'classic') this.buildClassicList();
    else if (tool === 'terrain') this.buildTNSList();
    else { this.buildSettings(); this.buildList(); }
  }

  applyMode(tool) {
    const isClassic = (tool === 'classic');
    const isTNS = (tool === 'terrain');
    const isDefault = !isClassic && !isTNS;

    // ─── FIX: Size и Shape видны ВСЕГДА ───
    if (this.settingsEl) this.settingsEl.style.display = '';

    // Список тайлов (скрин 2) — только для обычных кистей
    if (this.listEl) this.listEl.style.display = isDefault ? '' : 'none';
    if (this.totalEl) this.totalEl.style.display = isDefault ? '' : 'none';

    // Панели Classic и TNS
    if (this.classicPanelEl) this.classicPanelEl.style.display = isClassic ? '' : 'none';
    if (this.tnsPanelEl) this.tnsPanelEl.style.display = isTNS ? '' : 'none';
  }

  // ─── DEFAULT: size/shape/brush list ───
  buildSettings() {
    if (!this.settingsEl) return;
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
    if (!this.listEl) return;
    const brush = this.ctx.getBrush();
    this.listEl.innerHTML = '';
    if (!brush.length) {
      const empty = document.createElement('div');
      empty.style.color = '#555';
      empty.style.fontSize = '10px';
      empty.style.padding = '4px';
      empty.textContent = 'Клик по тайлу в атласе. +EMPTY — пустота.';
      this.listEl.appendChild(empty);
      if (this.totalEl) this.totalEl.textContent = 'Σ 0';
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
    if (!this.totalEl) return;
    const sum = this.ctx.getBrush().reduce((s, b) => s + b.weight, 0);
    this.totalEl.textContent = 'Σ ' + sum.toFixed(2);
  }

  // ─── CLASSIC: список террейнов ───
  buildClassicList() {
    if (!this.classicListEl) return;
    this.classicListEl.innerHTML = '';
    const map = this.ctx.getMap();
    const renderer = this.ctx.getRenderer();
    if (!map) {
      const empty = document.createElement('div');
      empty.className = 'empty-inline';
      empty.textContent = 'Карта не загружена';
      this.classicListEl.appendChild(empty);
      return;
    }

    const activeAnchor = this.ctx.getActiveClassicTerrain ? this.ctx.getActiveClassicTerrain() : null;
    let anyItem = false;
    let firstRow = null;
    let activeRow = null;

    map.tilesets.forEach(ts => {
      if (!ts.terrainTypes || !ts.terrainTypes.length) return;
      ts.terrainTypes.forEach((tt, ti) => {
        anyItem = true;
        const isActive = activeAnchor &&
          activeAnchor.tsFirstgid === ts.firstgid &&
          activeAnchor.terrName === tt.name;

        const row = document.createElement('div');
        row.className = 'classic-row' + (isActive ? ' active' : '');
        row.title = ts.name + ' · ' + tt.name + ' · local ' + tt.tile + ' · global ' + (tt.tile + ts.firstgid);

        const cnv = document.createElement('canvas');
        cnv.className = 'classic-preview';
        cnv.width = 32; cnv.height = 32;
        const g = cnv.getContext('2d');
        g.imageSmoothingEnabled = false;
        if (ts.image) {
          const localID = tt.tile;
          const c = localID % ts.columns;
          const r = Math.floor(localID / ts.columns);
          g.drawImage(ts.image,
            c * ts.tileW, r * ts.tileH, ts.tileW, ts.tileH,
            0, 0, 32, 32);
        } else {
          g.fillStyle = '#333';
          g.fillRect(0, 0, 32, 32);
        }
        row.appendChild(cnv);

        const info = document.createElement('div');
        info.className = 'classic-info';
        const nmEl = document.createElement('div');
        nmEl.className = 'classic-name';
        nmEl.textContent = tt.name;
        const metaEl = document.createElement('div');
        metaEl.className = 'classic-meta';
        metaEl.textContent = 'local ' + tt.tile + ' · global ' + (tt.tile + ts.firstgid);
        info.append(nmEl, metaEl);
        row.appendChild(info);

        row.addEventListener('click', () => {
          this.ctx.setActiveClassicTerrain({
            tsFirstgid: ts.firstgid,
            terrName: tt.name
          });
          this.buildClassicList();
        });

        if (firstRow === null) firstRow = row;
        if (isActive) activeRow = row;
        this.classicListEl.appendChild(row);
      });
    });

    if (!anyItem) {
      const empty = document.createElement('div');
      empty.className = 'empty-inline';
      empty.textContent = 'Нет terraintypes в tileset\'ах. Зайди в ATLASES → ▶ Terrain.';
      this.classicListEl.appendChild(empty);
      return;
    }

    // Auto-select first if none active — исправляет баг «пишет не выбран»
    if (!activeRow && firstRow && this.ctx.setActiveClassicTerrain) {
      const tsFirst = parseInt(firstRow.title.split(' · ')[0].replace(/^.*? · /, ''), 10);
      // проще: перебрать tilesets ещё раз и взять первый
      const map2 = this.ctx.getMap();
      if (map2) {
        outer:
        for (const ts of map2.tilesets) {
          if (!ts.terrainTypes || !ts.terrainTypes.length) continue;
          for (const tt of ts.terrainTypes) {
            this.ctx.setActiveClassicTerrain({
              tsFirstgid: ts.firstgid,
              terrName: tt.name
            });
            break outer;
          }
        }
        this.buildClassicList();
      }
    }
  }

  // ─── TNS: список типов ───
  buildTNSList() {
    if (!this.tnsListEl) return;
    this.tnsListEl.innerHTML = '';

    const model = this.ctx.getTypesModel ? this.ctx.getTypesModel() : null;
    const renderer = this.ctx.getRenderer();
    const activeTypeId = this.ctx.getActiveType ? this.ctx.getActiveType() : null;

    if (!model || !model.types.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-inline';
      empty.textContent = 'Нет типов. Выбери TYPES в нижней панели и добавь.';
      this.tnsListEl.appendChild(empty);
      return;
    }

    const sorted = [...model.types].sort((a, b) => b.priority - a.priority);
    for (const t of sorted) {
      const row = document.createElement('div');
      row.className = 'tns-row' + (t.id === activeTypeId ? ' active' : '');

      const cnv = document.createElement('canvas');
      cnv.className = 'tns-preview';
      cnv.width = 32; cnv.height = 32;
      const g = cnv.getContext('2d');
      g.imageSmoothingEnabled = false;

      const firstSolid = (t.solids && t.solids.length) ? t.solids[0].tileID : 0;
      if (firstSolid && renderer) {
        const ts = renderer.findTileset(firstSolid);
        if (ts && ts.image) {
          const localID = firstSolid - ts.firstgid;
          const c = localID % ts.columns;
          const r = Math.floor(localID / ts.columns);
          g.drawImage(ts.image,
            c * ts.tileW, r * ts.tileH, ts.tileW, ts.tileH,
            0, 0, 32, 32);
        } else {
          g.fillStyle = '#222';
          g.fillRect(0, 0, 32, 32);
        }
      } else {
        g.fillStyle = '#222';
        g.fillRect(0, 0, 32, 32);
        g.strokeStyle = '#444';
        g.strokeRect(0.5, 0.5, 31, 31);
      }
      row.appendChild(cnv);

      const info = document.createElement('div');
      info.className = 'tns-info';
      const nmEl = document.createElement('div');
      nmEl.className = 'tns-name';
      nmEl.textContent = t.name || '(no name)';
      if (t.color) nmEl.style.color = t.color;
      const metaEl = document.createElement('div');
      metaEl.className = 'tns-meta';
      metaEl.textContent = 'P' + t.priority + ' · ' + (t.solids ? t.solids.length : 0) + ' solid';
      info.append(nmEl, metaEl);
      row.appendChild(info);

      row.addEventListener('click', () => {
        if (this.ctx.setActiveType) this.ctx.setActiveType(t.id);
        this.buildTNSList();
        // Уведомим app о смене
        if (this.ctx.onBrushChanged) this.ctx.onBrushChanged();
      });

      this.tnsListEl.appendChild(row);
    }
  }
}

// ═══════════════════════════════════════════════
// TILESET TABS — без изменений (полный код)
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
    this.showGrid = false;
    this.showGrid10 = false;
    this.canvasRef = null;
    this.redrawFn = null;
    this.infoEl = null;
    this.activeTerrainIdx = 0;
    this._restoreViewState = null;
  }

  get quadrantMode() { return this.editMode && this.terrainEditMode; }

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
      btn.className = 'ts-tab-btn';
      btn.textContent = ts.name.length > 20 ? ts.name.slice(0, 18) + '…' : ts.name;
      btn.title = ts.name + ' (firstgid=' + ts.firstgid + ')';
      btn.addEventListener('click', () => {
        this.activeIdx = i;
        this.activeTerrainIdx = 0;
        this.build();
      });
      if (i === this.activeIdx) btn.classList.add('active');
      this.tabsListEl.appendChild(btn);

      const del = document.createElement('button');
      del.className = 'ts-del';
      del.textContent = '×';
      del.title = 'Delete tileset';
      del.dataset.tilesetIdx = String(i);
      del.dataset.tilesetName = ts.name;
      del.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const idx = parseInt(del.dataset.tilesetIdx, 10);
        this.handleTilesetDelete(idx);
      });
      this.tabsListEl.appendChild(del);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'ts-tab-add';
    addBtn.textContent = '+ Tileset';
    addBtn.title = 'Add tileset from PNG';
    addBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.ctx.onAddTileset) this.ctx.onAddTileset();
    });
    this.tabsListEl.appendChild(addBtn);

    const ts = map.tilesets[this.activeIdx];
    if (ts) this.bodyEl.appendChild(this.buildBlock(ts));
  }

  saveViewState() {
    const wrap = this.canvasRef ? this.canvasRef.parentElement : null;
    return {
      zoom: this.zoom,
      scrollLeft: wrap ? wrap.scrollLeft : 0,
      scrollTop: wrap ? wrap.scrollTop : 0
    };
  }

  buildWithRestore(fn) {
    this._restoreViewState = this.saveViewState();
    fn.call(this);
  }

  handleTilesetDelete(idx) {
    try {
      const map = this.ctx.getMap();
      const r = (typeof this.ctx.getRenderer === 'function')
        ? this.ctx.getRenderer() : null;
      if (!map) { alert('Карта не открыта'); return; }
      const ts = map.tilesets[idx];
      if (!ts) { alert('Tileset не найден (idx=' + idx + ')'); return; }

      const maxId = ts.firstgid + ts.tilecount;
      let usage = 0;
      for (const lname of map.layerOrder) {
        const data = map.layers[lname];
        if (!data) continue;
        for (let i = 0; i < data.length; i++) {
          const id = data[i];
          if (id >= ts.firstgid && id < maxId) usage++;
        }
      }

      const msg = usage > 0
        ? 'Удалить tileset "' + ts.name + '"?\n\n' +
          'Используется в карте: ' + usage + ' тайлов.\n' +
          'Все они будут стёрты (одна undo-транзакция).'
        : 'Удалить tileset "' + ts.name + '"?\n\nОн не используется.';
      if (!confirm(msg)) return;

      if (usage > 0) {
        if (typeof map.clearTilesetTiles === 'function') {
          map.clearTilesetTiles(ts.firstgid, ts.tilecount);
        } else {
          const layers = [];
          for (const lname of map.layerOrder) {
            const data = map.layers[lname];
            if (!data) continue;
            const changes = [];
            for (let i = 0; i < data.length; i++) {
              const id = data[i];
              if (id >= ts.firstgid && id < maxId) {
                changes.push({ idx: i, before: id, after: 0 });
                data[i] = 0;
              }
            }
            if (changes.length) layers.push({ layer: lname, changes });
          }
          if (layers.length && map.undoStack) {
            map.undoStack.push({ type: 'multi', layers });
            if (map.undoStack.length > 50) map.undoStack.shift();
            if (map.redoStack) map.redoStack.length = 0;
          }
        }
      }

      if (typeof map.removeTileset === 'function') {
        map.removeTileset(idx);
      } else {
        map.tilesets.splice(idx, 1);
      }

      if (this.activeIdx >= map.tilesets.length) {
        this.activeIdx = Math.max(0, map.tilesets.length - 1);
      }
      this.activeTerrainIdx = 0;

      if (r) { r.invalidate(); r.render(); }
      this.build();

      const st = document.getElementById('status');
      if (st) st.textContent = 'Удалён tileset "' + ts.name + '"' +
        (usage ? ' (+' + usage + ' тайлов стёрто)' : '');
    } catch (err) {
      console.error('Tileset delete failed:', err);
      alert('Ошибка удаления tileset: ' + err.message);
    }
  }

  buildBlock(ts) {
    const block = document.createElement('div');
    block.className = 'ts-block';

    if (this._restoreViewState) {
      this.zoom = this._restoreViewState.zoom;
    }

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
    editLbl.title = 'Edit tile (terrain / properties)';
    const editCb = document.createElement('input');
    editCb.type = 'checkbox';
    editCb.checked = this.editMode;
    editCb.addEventListener('change', () => {
      this.editMode = editCb.checked;
      this.buildWithRestore(this.build);
    });
    editLbl.append(editCb, document.createTextNode(' Edit'));
    toolbar.appendChild(editLbl);

    const idsLbl = document.createElement('label');
    idsLbl.className = 'ts-check';
    idsLbl.title = 'Show tile IDs';
    const idsCb = document.createElement('input');
    idsCb.type = 'checkbox';
    idsCb.checked = this.showIds;
    idsCb.addEventListener('change', () => {
      this.showIds = idsCb.checked;
      this.refreshCanvasOnly();
    });
    idsLbl.append(idsCb, document.createTextNode(' IDs'));
    toolbar.appendChild(idsLbl);

    const gridLbl = document.createElement('label');
    gridLbl.className = 'ts-check';
    gridLbl.title = 'Tile grid (' + ts.tileW + '×' + ts.tileH + ' px)';
    const gridCb = document.createElement('input');
    gridCb.type = 'checkbox';
    gridCb.checked = this.showGrid;
    gridCb.addEventListener('change', () => {
      this.showGrid = gridCb.checked;
      this.refreshCanvasOnly();
    });
    gridLbl.append(gridCb, document.createTextNode(' Grid'));
    toolbar.appendChild(gridLbl);

    const grid10Lbl = document.createElement('label');
    grid10Lbl.className = 'ts-check ts-check-cyan';
    grid10Lbl.title = 'Sub-grid every 10 px';
    const grid10Cb = document.createElement('input');
    grid10Cb.type = 'checkbox';
    grid10Cb.checked = this.showGrid10;
    grid10Cb.addEventListener('change', () => {
      this.showGrid10 = grid10Cb.checked;
      this.refreshCanvasOnly();
    });
    grid10Lbl.append(grid10Cb, document.createTextNode(' 10×10'));
    toolbar.appendChild(grid10Lbl);

    const terrainBtn = document.createElement('button');
    terrainBtn.textContent = this.terrainEditMode ? '▼ Terrain' : '▶ Terrain';
    terrainBtn.className = 'ts-terrain-btn';
    terrainBtn.addEventListener('click', () => {
      this.terrainEditMode = !this.terrainEditMode;
      this.buildWithRestore(this.build);
    });
    toolbar.appendChild(terrainBtn);

    block.appendChild(toolbar);

    const pickMode = this.ctx.getPickMode ? this.ctx.getPickMode() : null;

    const info = document.createElement('div');
    info.className = 'ts-info';
    this.infoEl = info;
    this._renderInfoText(ts, info, pickMode);

    const wrapEl = document.createElement('div');
    wrapEl.className = 'ts-canvas-wrap';

    wrapEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 1) return;
      e.preventDefault();
      try { wrapEl.setPointerCapture(e.pointerId); } catch (_) {}
      wrapEl.classList.add('panning');
      const startX = e.clientX, startY = e.clientY;
      const sl0 = wrapEl.scrollLeft, st0 = wrapEl.scrollTop;
      const onMove = (ev) => {
        wrapEl.scrollLeft = sl0 - (ev.clientX - startX);
        wrapEl.scrollTop  = st0 - (ev.clientY - startY);
      };
      const onUp = () => {
        wrapEl.classList.remove('panning');
        wrapEl.removeEventListener('pointermove', onMove);
        wrapEl.removeEventListener('pointerup', onUp);
        wrapEl.removeEventListener('pointercancel', onUp);
      };
      wrapEl.addEventListener('pointermove', onMove);
      wrapEl.addEventListener('pointerup', onUp);
      wrapEl.addEventListener('pointercancel', onUp);
    });
    wrapEl.addEventListener('contextmenu', (e) => e.preventDefault());

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
        g.clearRect(0, 0, cnv.width, cnv.height);
        g.drawImage(ts.image, 0, 0);

        if (self.showGrid10) {
          g.save();
          g.strokeStyle = 'rgba(80,220,255,0.55)';
          g.lineWidth = 1;
          g.setLineDash([3, 3]);
          g.beginPath();
          const step10 = 10;
          for (let x = step10; x < cnv.width; x += step10) {
            if (ts.tileW > 0 && x % ts.tileW === 0) continue;
            g.moveTo(x + 0.5, 0);
            g.lineTo(x + 0.5, cnv.height);
          }
          for (let y = step10; y < cnv.height; y += step10) {
            if (ts.tileH > 0 && y % ts.tileH === 0) continue;
            g.moveTo(0, y + 0.5);
            g.lineTo(cnv.width, y + 0.5);
          }
          g.stroke();
          g.restore();
        }

        if (self.showGrid) {
          g.strokeStyle = 'rgba(255,220,80,0.55)';
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
        }

        if (self.showIds && !self.quadrantMode) {
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

        if (self.quadrantMode) {
          const activeTerr = self.activeTerrainIdx;
          const hw = ts.tileW / 2;
          const hh = ts.tileH / 2;
          for (let i = 0; i < ts.tilecount; i++) {
            const t = ts.tiles[i];
            if (!t || !t.terrain) continue;
            const col = i % ts.columns;
            const row = Math.floor(i / ts.columns);
            const x0 = col * ts.tileW;
            const y0 = row * ts.tileH;
            const qx = [0, 1, 0, 1];
            const qy = [0, 0, 1, 1];
            for (let q = 0; q < 4; q++) {
              const v = t.terrain[q];
              if (v == null || v < 0) continue;
              const isActive = (v === activeTerr);
              g.fillStyle = terrainColorCss(v, isActive ? 0.55 : 0.30);
              g.fillRect(x0 + qx[q]*hw, y0 + qy[q]*hh, hw, hh);
            }
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

      if (this._restoreViewState) {
        const st = this._restoreViewState;
        this._restoreViewState = null;
        wrapEl.scrollLeft = st.scrollLeft;
        wrapEl.scrollTop = st.scrollTop;
      }

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
        if (self.quadrantMode) return;
        const r = cnv.getBoundingClientRect();
        const col = Math.floor((e.clientX - r.left) / self.zoom / ts.tileW);
        const row = Math.floor((e.clientY - r.top) / self.zoom / ts.tileH);
        if (col < 0 || col >= ts.columns) { info.textContent = '—'; return; }
        const localID = row * ts.columns + col;
        if (localID < 0 || localID >= ts.tilecount) { info.textContent = '—'; return; }
        info.innerHTML = tileInfoString(ts, localID);
      });
      cnv.addEventListener('mouseleave', () => {
        if (self.quadrantMode) return;
        const pm = self.ctx.getPickMode ? self.ctx.getPickMode() : null;
        if (pm) {
          info.innerHTML = '<b style="color:#e8f">Режим выбора тайла</b> · клик — применить · повторный клик — убрать';
        } else if (self.editMode) {
          info.textContent = 'Edit: клик по тайлу — редактирование';
        } else {
          info.textContent = '— клик: выбрать · Shift+клик: добавить · колесо: zoom · MMB: pan —';
        }
      });
      cnv.addEventListener('click', (e) => {
        if (e.button === 1) return;
        const r = cnv.getBoundingClientRect();
        const px = (e.clientX - r.left) / self.zoom;
        const py = (e.clientY - r.top) / self.zoom;
        const col = Math.floor(px / ts.tileW);
        const row = Math.floor(py / ts.tileH);
        const localID = row * ts.columns + col;
        if (localID < 0 || localID >= ts.tilecount) return;

        if (self.quadrantMode) {
          if (!ts.terrainTypes.length) {
            alert('Нет terraintypes. Добавь хотя бы один в правой панели.');
            return;
          }
          const hw = ts.tileW / 2;
          const hh = ts.tileH / 2;
          const qx = (px % ts.tileW) < hw ? 0 : 1;
          const qy = (py % ts.tileH) < hh ? 0 : 1;
          const q = (qy === 0) ? (qx === 0 ? 0 : 1) : (qx === 0 ? 2 : 3);
          self.applyQuadrantClick(ts, localID, q);
          return;
        }

        const globalID = ts.firstgid + localID;

        const pm = self.ctx.getPickMode ? self.ctx.getPickMode() : null;
        if (pm) { self.ctx.applyPick(globalID); return; }

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

  _renderInfoText(ts, info, pickMode) {
    if (this.quadrantMode) {
      const tname = ts.terrainTypes[this.activeTerrainIdx]
        ? ts.terrainTypes[this.activeTerrainIdx].name
        : '(нет terrain)';
      info.innerHTML =
        '<b style="color:#fd4">QUADRANT MODE</b> · активный terrain: ' +
        '<b style="color:' + terrainColorCss(this.activeTerrainIdx, 1) + '">' +
        tname + '</b>' +
        ' · клик по квадранту тайла — toggle · клик в списке справа — выбрать terrain';
    } else if (pickMode) {
      info.innerHTML = '<b style="color:#e8f">Режим выбора тайла</b> · клик — применить · повторный клик — убрать';
    } else if (this.editMode) {
      info.textContent = 'Edit: клик по тайлу — редактирование';
    } else {
      info.textContent = '— клик: выбрать · Shift+клик: добавить · колесо: zoom · MMB: pan —';
    }
  }

  refreshCanvasOnly() {
    if (this.redrawFn) this.redrawFn();
    const map = this.ctx.getMap();
    if (!map) return;
    const ts = map.tilesets[this.activeIdx];
    if (!ts || !this.infoEl) return;
    const pickMode = this.ctx.getPickMode ? this.ctx.getPickMode() : null;
    this._renderInfoText(ts, this.infoEl, pickMode);
  }

  applyQuadrantClick(ts, localID, q) {
    if (!ts.tiles[localID]) ts.tiles[localID] = { terrain: null, props: {} };
    const tile = ts.tiles[localID];
    if (!tile.terrain) tile.terrain = [-1, -1, -1, -1];

    const active = this.activeTerrainIdx;
    if (tile.terrain[q] === active) tile.terrain[q] = -1;
    else tile.terrain[q] = active;

    const allEmpty = tile.terrain.every(v => v < 0);
    const noProps = !tile.props || Object.keys(tile.props).length === 0;
    if (allEmpty && noProps) delete ts.tiles[localID];

    ts._dirty = true;
    this.refreshCanvasOnly();
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
    const terrainLabels = ['TL','TR','BL','BR'];
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

    const head = document.createElement('div');
    head.className = 'ts-editor-head';
    head.innerHTML = 'Terrain Types <span>(' + ts.terrainTypes.length + ')</span>' +
      (this.quadrantMode ? ' · <b style="color:#fd4">ACTIVE для квадрантов</b>' : '');
    ed.appendChild(head);

    const list = document.createElement('div');
    list.className = 'solids-list';
    list.dataset.terrainList = '1';

    ts.terrainTypes.forEach((t, i) => {
      const row = document.createElement('div');
      row.className = 'solid-row terrain-row' +
        (this.quadrantMode && i === this.activeTerrainIdx ? ' active' : '');
      row.dataset.terrainIdx = String(i);

      const sw = document.createElement('span');
      sw.className = 'terrain-swatch';
      sw.style.background = terrainColorCss(i, 1);
      sw.title = 'Цвет в атласе';
      row.appendChild(sw);

      const nameInp = document.createElement('input');
      nameInp.type = 'text';
      nameInp.value = t.name;
      nameInp.placeholder = 'name';
      nameInp.style.width = '110px';
      nameInp.addEventListener('input', () => {
        t.name = nameInp.value;
        ts._dirty = true;
      });
      row.appendChild(nameInp);

      const tileInp = document.createElement('input');
      tileInp.type = 'number';
      tileInp.value = t.tile;
      tileInp.title = 'Solid tile index';
      tileInp.addEventListener('input', () => {
        const v = parseInt(tileInp.value, 10);
        t.tile = isNaN(v) ? 0 : v;
        ts._dirty = true;
      });
      row.appendChild(tileInp);

      const del = document.createElement('button');
      del.className = 'type-del';
      del.textContent = '×';
      del.title = 'Удалить terrain';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        ts.terrainTypes.splice(i, 1);
        if (this.activeTerrainIdx >= ts.terrainTypes.length) {
          this.activeTerrainIdx = Math.max(0, ts.terrainTypes.length - 1);
        }
        ts._dirty = true;
        this.buildWithRestore(this.build);
      });
      row.appendChild(del);

      row.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON') return;
        this.activeTerrainIdx = i;
        const listEl = ed.querySelector('[data-terrain-list]');
        if (listEl) {
          Array.from(listEl.children).forEach(child => {
            const idx = parseInt(child.dataset.terrainIdx, 10);
            child.classList.toggle('active', idx === i);
          });
        }
        this.refreshCanvasOnly();
      });

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
      this.buildWithRestore(this.build);
    });

    ed.append(list, addBtn);

    if (this.quadrantMode) {
      const hint = document.createElement('div');
      hint.className = 'terrain-hint';
      hint.innerHTML =
        'Клик по строке выше → выбрать активный terrain.<br>' +
        'Клик по квадранту тайла в атласе → toggle.<br>' +
        'Повторный клик по заполненному квадранту — очистить.';
      ed.appendChild(hint);
    }

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
