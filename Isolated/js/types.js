(function(RW){
'use strict';

const EDGE_ROLES = ['N','E','S','W','NWo','NEo','SWo','SEo','NWi','NEi','SWi','SEi'];

class TypesModel {
  constructor() {
    this.types = [];
    this._nextId = 0;
  }

  add(name, priority) {
    const t = {
      id: 't' + (this._nextId++),
      name: name || ('Type' + this._nextId),
      priority: priority ?? this.types.length,
      color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
      solids: [],
      edges: {}
    };
    for (const r of EDGE_ROLES) t.edges[r] = 0;
    this.types.push(t);
    return t;
  }

  remove(id) {
    const i = this.types.findIndex(t => t.id === id);
    if (i >= 0) this.types.splice(i, 1);
  }

  get(id) { return this.types.find(t => t.id === id); }

  findBySolid(tileID) {
    for (const t of this.types) {
      for (const s of t.solids) if (s.tileID === tileID) return t;
    }
    return null;
  }

  toJSON() {
    return {
      version: 1,
      types: this.types.map(t => ({
        id: t.id,
        name: t.name,
        priority: t.priority,
        color: t.color,
        solids: t.solids.map(s => ({ tileID: s.tileID, weight: s.weight })),
        edges: Object.assign({}, t.edges)
      }))
    };
  }

  fromJSON(obj) {
    this.types = [];
    this._nextId = 0;
    if (!obj || !obj.types) return;
    for (const t of obj.types) {
      const nt = {
        id: t.id || ('t' + (this._nextId++)),
        name: t.name || '',
        priority: t.priority ?? 0,
        color: t.color || '#888',
        solids: (t.solids || []).map(s => ({
          tileID: s.tileID,
          weight: s.weight ?? 1
        })),
        edges: {}
      };
      for (const r of EDGE_ROLES) nt.edges[r] = (t.edges && t.edges[r]) || 0;
      this.types.push(nt);
      if (t.id && t.id.startsWith('t')) {
        const n = parseInt(t.id.slice(1), 10);
        if (!isNaN(n) && n >= this._nextId) this._nextId = n + 1;
      }
    }
  }
}

// ═══════════════════════════════════════════════
// TYPES PANEL  [Patch 03.6: dropdown + 4 кнопки]
// ═══════════════════════════════════════════════
class TypesPanel {
  constructor(rootEl, ctx) {
    this.root = rootEl;
    this.ctx = ctx;
  }

  build() {
    const model = this.ctx.getModel();
    const activeId = this.ctx.getActiveType();
    const pickMode = this.ctx.getPickMode ? this.ctx.getPickMode() : null;

    this.root.innerHTML = '';

    const topbar = document.createElement('div');
    topbar.className = 'types-topbar';

    const listStrip = document.createElement('div');
    listStrip.className = 'types-strip';
    listStrip.style.display = 'flex';
    listStrip.style.flexWrap = 'wrap';
    listStrip.style.alignItems = 'center';
    listStrip.style.gap = '6px';

    // 1. Выпадающий список типов (вместо карточек)
    const sel = document.createElement('select');
    sel.style.background = '#1a1024';
    sel.style.color = '#e8f';
    sel.style.border = '1px solid #3a2a4a';
    sel.style.fontFamily = 'inherit';
    sel.style.fontSize = '11px';
    sel.style.padding = '4px 8px';
    sel.style.borderRadius = '3px';
    sel.style.cursor = 'pointer';

    model.types.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = (t.name || '(no name)') + ' P' + t.priority;
      sel.appendChild(opt);
    });
    if (activeId) sel.value = activeId;
    sel.onchange = (e) => {
      this.ctx.setActiveType(e.target.value);
      this.ctx.onChanged();
    };
    listStrip.appendChild(sel);

    // 2. Кнопка "Создать TnS"
    const btnAdd = document.createElement('button');
    btnAdd.className = 'types-add-btn';
    btnAdd.textContent = 'Создать TnS';
    btnAdd.onclick = () => {
      const t = model.add('Type', model.types.length);
      this.ctx.setActiveType(t.id);
      this.ctx.onChanged();
    };
    listStrip.appendChild(btnAdd);

    // 3. Кнопка удаления текущего типа
    const btnDel = document.createElement('button');
    btnDel.className = 'types-add-btn';
    btnDel.innerHTML = '🗑 Удалить';
    btnDel.style.background = '#3a1a1a';
    btnDel.style.borderColor = '#833';
    btnDel.style.color = '#f88';
    btnDel.onclick = () => {
      if (!activeId) return;
      const t = model.get(activeId);
      if (!t) return;
      if (!confirm('Удалить тип "' + t.name + '"?')) return;
      model.remove(activeId);
      const next = model.types.length ? model.types[0].id : null;
      this.ctx.setActiveType(next);
      this.ctx.onChanged();
    };
    listStrip.appendChild(btnDel);

    // 4. Кнопка Import MiniTNS
    const btnMini = document.createElement('button');
    btnMini.className = 'types-add-btn';
    btnMini.textContent = '📦 Import MiniTNS';
    btnMini.onclick = () => {
      if (this.ctx.onImportMiniTNS) this.ctx.onImportMiniTNS();
    };
    listStrip.appendChild(btnMini);

    // 5. Кнопка Library
    const btnLib = document.createElement('button');
    btnLib.className = 'types-add-btn';
    btnLib.textContent = '📚 Library';
    btnLib.onclick = () => {
      if (this.ctx.onOpenLibrary) this.ctx.onOpenLibrary();
    };
    listStrip.appendChild(btnLib);

    topbar.appendChild(listStrip);
    this.root.appendChild(topbar);

    if (!model.types.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-msg';
      empty.textContent = 'Нет типов. Нажми "Создать TnS", "📦 Import MiniTNS" или "📚 Library".';
      this.root.appendChild(empty);
      return;
    }

    if (activeId) {
      const t = model.get(activeId);
      if (t) this.root.appendChild(this.buildDetail(t, pickMode));
    }
  }

  updateStrip() {
    const model = this.ctx.getModel();
    const strip = this.root.querySelector('.types-strip');
    if (!strip) return;

    const sel = strip.querySelector('select');
    if (sel) {
      // Перестроим options: сохраняем значение, если тип ещё есть
      const cur = sel.value;
      sel.innerHTML = '';
      for (const t of model.types) {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = (t.name || '(no name)') + ' P' + t.priority;
        sel.appendChild(opt);
      }
      if (model.types.some(t => t.id === cur)) sel.value = cur;
      else if (model.types.length) sel.value = model.types[0].id;
    }

    // Если у нас всё ещё карточки (не трогали) — обновим их; иначе просто no-op
    for (const card of strip.querySelectorAll('.type-card')) {
      const id = card.dataset.typeId;
      if (!id) continue;
      const t = model.get(id);
      if (!t) continue;
      const nm = card.querySelector('.type-name');
      const pr = card.querySelector('.type-priority');
      if (nm) nm.textContent = t.name || '(no name)';
      if (pr) pr.textContent = 'P' + t.priority;
      card.style.borderLeftColor = t.color;
    }
  }

  buildDetail(t, pickMode) {
    const el = document.createElement('div');
    el.className = 'type-detail';

    const head = document.createElement('div');
    head.className = 'type-head';

    const lName = document.createElement('label');
    lName.textContent = 'Имя';
    const iName = document.createElement('input');
    iName.type = 'text';
    iName.value = t.name;
    iName.addEventListener('input', () => {
      t.name = iName.value;
      this.updateStrip();
    });
    lName.appendChild(iName);
    head.appendChild(lName);

    const lPri = document.createElement('label');
    lPri.textContent = 'Priority';
    const iPri = document.createElement('input');
    iPri.type = 'number';
    iPri.value = t.priority;
    iPri.addEventListener('input', () => {
      const v = parseInt(iPri.value, 10);
      t.priority = isNaN(v) ? 0 : v;
      this.updateStrip();
    });
    lPri.appendChild(iPri);
    head.appendChild(lPri);

    const lCol = document.createElement('label');
    lCol.textContent = 'Цвет';
    const iCol = document.createElement('input');
    iCol.type = 'color';
    iCol.value = t.color;
    iCol.addEventListener('input', () => {
      t.color = iCol.value;
      this.updateStrip();
    });
    lCol.appendChild(iCol);
    head.appendChild(lCol);

    el.appendChild(head);

    const cols = document.createElement('div');
    cols.className = 'type-columns';
    cols.appendChild(this.buildSolidsColumn(t, pickMode));
    cols.appendChild(this.buildEdgesColumn(t, pickMode));
    cols.appendChild(this.buildInnerColumn(t, pickMode));
    el.appendChild(cols);
    return el;
  }

  buildSolidsColumn(t, pickMode) {
    const col = document.createElement('div');
    col.className = 'type-col';

    const isPickingSolid = pickMode && pickMode.kind === 'solid' && pickMode.typeId === t.id;

    const title = document.createElement('div');
    title.className = 'col-title';
    const lbl = document.createElement('span');
    lbl.innerHTML = '<b>Solids</b>';
    title.appendChild(lbl);

    const addBtn = document.createElement('button');
    addBtn.textContent = isPickingSolid ? '■ выбор...' : '+ из атласа';
    addBtn.className = 'mini-btn';
    if (isPickingSolid) {
      addBtn.style.background = '#c8f';
      addBtn.style.color = '#000';
    }
    addBtn.addEventListener('click', () => {
      if (isPickingSolid) this.ctx.endPick();
      else this.ctx.startPick({ kind: 'solid', typeId: t.id, role: null });
    });
    title.appendChild(addBtn);
    col.appendChild(title);

    const list = document.createElement('div');
    list.className = 'solids-list';
    if (!t.solids.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-inline';
      empty.textContent = '— нет —';
      list.appendChild(empty);
    } else {
      t.solids.forEach((s, i) => {
        const row = document.createElement('div');
        row.className = 'solid-row';

        const preview = document.createElement('canvas');
        preview.className = 'solid-preview';
        preview.width = 24; preview.height = 24;
        const g = preview.getContext('2d');
        g.imageSmoothingEnabled = false;
        const ts = this.ctx.findTileset(s.tileID);
        if (ts && ts.image) {
          const localID = s.tileID - ts.firstgid;
          const c = localID % ts.columns;
          const r = Math.floor(localID / ts.columns);
          g.drawImage(ts.image,
            c * ts.tileW, r * ts.tileH, ts.tileW, ts.tileH,
            0, 0, 24, 24);
        } else {
          g.fillStyle = '#333';
          g.fillRect(0, 0, 24, 24);
        }
        row.appendChild(preview);

        const idEl = document.createElement('span');
        idEl.className = 'solid-id';
        idEl.textContent = '#' + s.tileID;
        row.appendChild(idEl);

        const wInput = document.createElement('input');
        wInput.type = 'number';
        wInput.step = '0.1';
        wInput.min = '0';
        wInput.value = s.weight;
        wInput.title = 'Вес';
        wInput.addEventListener('input', () => {
          const v = parseFloat(wInput.value);
          s.weight = isNaN(v) ? 0 : Math.max(0, v);
        });
        row.appendChild(wInput);

        const delBtn = document.createElement('button');
        delBtn.textContent = '×';
        delBtn.className = 'type-del';
        delBtn.addEventListener('click', () => {
          t.solids.splice(i, 1);
          this.ctx.onChanged();
        });
        row.appendChild(delBtn);

        list.appendChild(row);
      });
    }
    col.appendChild(list);
    return col;
  }

  buildEdgesColumn(t, pickMode) {
    const col = document.createElement('div');
    col.className = 'type-col';

    const title = document.createElement('div');
    title.className = 'col-title';
    title.innerHTML = '<b>Edges</b> <span>стороны + углы</span>';
    col.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'edge-grid';

    const layout = [
      'NWo', 'N', 'NEo',
      'W',   null, 'E',
      'SWo', 'S', 'SEo'
    ];
    for (const role of layout) {
      if (!role) {
        const c = document.createElement('div');
        c.className = 'edge-cell center';
        c.textContent = '·';
        grid.appendChild(c);
        continue;
      }
      grid.appendChild(this.buildEdgeCell(t, role, pickMode));
    }
    col.appendChild(grid);
    return col;
  }

  buildInnerColumn(t, pickMode) {
    const col = document.createElement('div');
    col.className = 'type-col';

    const title = document.createElement('div');
    title.className = 'col-title';
    title.innerHTML = '<b>Inner</b> <span>внутренние углы</span>';
    col.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'edge-grid';

    const layout = [
      'NWi', null, 'NEi',
      null,  null, null,
      'SWi', null, 'SEi'
    ];
    for (const role of layout) {
      if (!role) {
        const c = document.createElement('div');
        c.className = 'edge-cell center';
        c.textContent = '·';
        grid.appendChild(c);
        continue;
      }
      grid.appendChild(this.buildEdgeCell(t, role, pickMode));
    }
    col.appendChild(grid);
    return col;
  }

  buildEdgeCell(t, role, pickMode) {
    const isPicking = pickMode && pickMode.kind === 'edge'
      && pickMode.typeId === t.id && pickMode.role === role;

    const c = document.createElement('div');
    c.className = 'edge-cell' + (isPicking ? ' picking' : '');

    const cur = t.edges[role] || 0;

    const preview = document.createElement('canvas');
    preview.className = 'edge-preview';
    preview.width = 20; preview.height = 20;
    const g = preview.getContext('2d');
    g.imageSmoothingEnabled = false;
    if (cur) {
      const ts = this.ctx.findTileset(cur);
      if (ts && ts.image) {
        const localID = cur - ts.firstgid;
        const col = localID % ts.columns;
        const row = Math.floor(localID / ts.columns);
        g.drawImage(ts.image,
          col * ts.tileW, row * ts.tileH, ts.tileW, ts.tileH,
          0, 0, 20, 20);
      } else {
        g.fillStyle = '#333';
        g.fillRect(0, 0, 20, 20);
      }
    } else {
      g.fillStyle = '#0a0510';
      g.fillRect(0, 0, 20, 20);
      g.strokeStyle = '#2a2030';
      g.strokeRect(0.5, 0.5, 19, 19);
    }
    c.appendChild(preview);

    const lbl = document.createElement('div');
    lbl.className = 'edge-label';
    lbl.textContent = role;
    c.appendChild(lbl);

    const val = document.createElement('div');
    val.className = 'edge-value' + (cur ? ' has' : '');
    val.textContent = cur ? '#' + cur : '—';
    c.appendChild(val);

    c.addEventListener('click', () => {
      if (isPicking) this.ctx.endPick();
      else this.ctx.startPick({ kind: 'edge', typeId: t.id, role });
    });

    return c;
  }
}

RW.TypesModel = TypesModel;
RW.TypesPanel = TypesPanel;
RW.EDGE_ROLES = EDGE_ROLES;

})(window.RWEditor = window.RWEditor || {});