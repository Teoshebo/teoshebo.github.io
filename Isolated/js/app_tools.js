(function(RW){
'use strict';
const App = RW.App;

// ═══════════════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════════════
const TOOLS = [
  { id: 'pan',     hk: 'KeyM', label: 'MOVE',    hkPos: 0, icon: 'asset/icon/move.png',    emoji: '✋', title: 'Move (M)' },
  { sep: true },
  { id: 'brush',   hk: 'KeyB', label: 'BRUSH',   hkPos: 0, icon: 'asset/icon/brush.png',   emoji: '🖌', title: 'Brush (B)' },
  { id: 'terrain', hk: 'KeyY', label: 'TYPE',    hkPos: 1, icon: 'asset/icon/type.png',    emoji: '🌍', title: 'Type / Solid (Y)' },
  { id: 'classic', hk: 'KeyT', label: 'TERRAIN', hkPos: 0, icon: 'asset/icon/terrain.png', emoji: '▦',  title: 'Terrain (T)' },
  { id: 'eraser',  hk: 'KeyE', label: 'ERASE',   hkPos: 0, icon: 'asset/icon/erase.png',   emoji: '🧽', title: 'Erase (E)' },
  { id: 'rect',    hk: 'KeyR', label: 'RECT',    hkPos: 0, icon: 'asset/icon/rect.png',    emoji: '▭',  title: 'Rect (R)' },
  { id: 'fill',    hk: 'KeyF', label: 'FILL',    hkPos: 0, icon: 'asset/icon/fill.png',    emoji: '🪣', title: 'Fill (F)' },
  { id: 'picker',  hk: 'KeyK', label: 'PICK',    hkPos: 3, icon: 'asset/icon/picker.png',  emoji: '💧', title: 'Picker (K)' },
  { sep: true },
  { id: 'guides',  hk: 'KeyG', label: 'GUIDE',   hkPos: 0, emoji: '📏', title: 'Guides (G)' },
  { id: 'utils',   hk: 'KeyU', label: 'UTILS',   hkPos: 0, emoji: '🛠', title: 'Utilities (U)' },
  { id: 'autotile', label: 'AUTO', hkPos: -1, icon: 'asset/icon/auto.png', emoji: '⚙', title: 'Autotile area' }
];

const LONG_TAP_TOOLS = new Set(['brush', 'classic', 'terrain']);

App.TOOLS = TOOLS;
App.LONG_TAP_TOOLS = LONG_TAP_TOOLS;

App.makeIconEl = function(t) {
  let ic;
  if (t.icon) {
    const img = document.createElement('img');
    img.className = 'tool-ic';
    img.src = t.icon;
    img.alt = '';
    img.onerror = () => {
      const span = document.createElement('span');
      span.className = 'ic';
      span.textContent = t.emoji || '?';
      img.replaceWith(span);
    };
    ic = img;
  } else {
    const span = document.createElement('span');
    span.className = 'ic';
    span.textContent = t.emoji || '?';
    ic = span;
  }

  if (t.id === 'fill' && (App.tempEmptyFill || App.tempTypeFill)) {
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    wrap.style.display = 'inline-block';
    wrap.appendChild(ic);
    
    const badge = document.createElement('span');
    badge.style.position = 'absolute';
    badge.style.bottom = '-5px';
    badge.style.right = '-5px';
    badge.style.fontSize = '12px';
    badge.style.lineHeight = '1';
    badge.style.pointerEvents = 'none';
    
    if (App.tempEmptyFill) badge.textContent = '🧽';
    else if (App.tempTypeFill) badge.textContent = 'T';
    
    wrap.appendChild(badge);
    return wrap;
  }

  return ic;
};

App.makeLabelEl = function(t) {
  const lbl = document.createElement('span');
  lbl.className = 'lbl';
  const label = t.label || '';
  const pos = (t.hkPos != null) ? t.hkPos : -1;

  if (pos < 0 || pos >= label.length) {
    lbl.textContent = label;
    return lbl;
  }

  const before = label.slice(0, pos);
  const ch = label.charAt(pos);
  const after = label.slice(pos + 1);

  if (before) lbl.appendChild(document.createTextNode(before));
  const b = document.createElement('b');
  b.className = 'hk';
  b.textContent = ch;
  lbl.appendChild(b);
  if (after) lbl.appendChild(document.createTextNode(after));
  return lbl;
};

App.buildTools = function() {
  if (!App.toolsEl) return;
  App.toolsEl.innerHTML = '';
  for (const t of TOOLS) {
    if (t.sep) {
      const sep = document.createElement('div');
      sep.className = 'sep';
      App.toolsEl.appendChild(sep);
      continue;
    }
    const e = document.createElement('div');
    e.className = 'tool' + (t.id === App.activeTool ? ' active' : '');
    e.dataset.tool = t.id;
    e.title = t.title || '';
    e.appendChild(App.makeIconEl(t));
    e.appendChild(App.makeLabelEl(t));
    e.addEventListener('click', () => App.handleToolClick(t.id));
    App.toolsEl.appendChild(e);
  }
};

App.updateMobileBrushBtn = function() {
  const btn = App.el('btnMobileBrush');
  if (!btn) return;
  const cur = TOOLS.find(t => t.id === App.activeTool);
  if (!cur) return;
  const icEl = btn.querySelector('.mtool-icon');
  const lblEl = btn.querySelector('.mtool-label');
  if (icEl) {
    let html = cur.emoji || '?';
    if (cur.icon) {
      html = '<img src="' + cur.icon + '" alt="" ' +
        'style="width:20px;height:20px;image-rendering:pixelated;vertical-align:-4px" ' +
        'onerror="this.outerHTML=\'' + (cur.emoji || '?') + '\'">';
    }
    icEl.innerHTML = html;
  }
  if (lblEl) lblEl.textContent = cur.label || cur.id.toUpperCase();
};

App.handleToolClick = function(id) {
  if (App.pickMode) App.endPick();

  if (id === 'utils') { App.openUtilityModal(); return; }

  if (id === 'guides') {
    if (typeof App.showGuidesPanel === 'function') App.showGuidesPanel();
  } else {
    if (typeof App.hideGuidesPanel === 'function') App.hideGuidesPanel();
  }

  if (App.tempEmptyFill || App.tempTypeFill) {
    App.tempEmptyFill = false;
    App.tempTypeFill = false;
  }
  
  if (id === 'autotile') { App.runAutotileDialog(); return; }
  App.activeTool = id;
  document.querySelectorAll('#tools .tool').forEach(e => {
    e.classList.toggle('active', e.dataset.tool === id);
  });
  if (App.cv) App.cv.classList.toggle('crosshair', id !== 'pan');
  App.settings.activeTool = id;
  RW.Storage.saveSettings(App.settings);
  if (App.renderer) App.renderer.render();
  if (App.brushPanel) App.brushPanel.build();
  App.updateMobileBrushBtn();
  App.checkTNSLayerWarning();
  App.autoSwitchBottomTabForTool(id);

  // [Patch 0.7.1] Обновляем видимость кнопки ACCEPT
  if (typeof App.updateAcceptWallsVisibility === 'function') {
    App.updateAcceptWallsVisibility();
  }
};

App.openToolPicker = function() {
  const modal = App.el('toolPickerModal');
  const grid = App.el('toolPickerGrid');
  if (!modal || !grid) return;

  grid.innerHTML = '';
  for (const t of TOOLS) {
    if (t.sep) continue;
    const cell = document.createElement('div');
    cell.className = 'tool-picker-cell' + (t.id === App.activeTool ? ' active' : '');
    cell.dataset.tool = t.id;

    const ic = document.createElement('div');
    ic.className = 'tp-ic';
    if (t.icon) {
      const img = document.createElement('img');
      img.src = t.icon;
      img.alt = '';
      img.onerror = () => { ic.innerHTML = ''; ic.textContent = t.emoji || '?'; };
      ic.appendChild(img);
    } else {
      ic.textContent = t.emoji || '?';
    }
    cell.appendChild(ic);

    const lbl = document.createElement('div');
    lbl.className = 'tp-lbl';
    lbl.textContent = t.label || t.id.toUpperCase();
    cell.appendChild(lbl);

    cell.addEventListener('click', () => {
      App.handleToolClick(t.id);
      App.closeToolPicker();
    });

    grid.appendChild(cell);
  }

  modal.classList.remove('hidden');
};

App.closeToolPicker = function() {
  const modal = App.el('toolPickerModal');
  if (modal) modal.classList.add('hidden');
};

// ═══════════════════════════════════════════════
// TEMP FILL MODES
// ═══════════════════════════════════════════════
App.runEmptyFill = function() {
  if (App.tempEmptyFill) {
    App.tempEmptyFill = false;
    if (App.prevTool) App.activeTool = App.prevTool;
    if (App.prevBrush) App.brushGroup = App.prevBrush;
    if (App.brushPanel) App.brushPanel.build();
    if (App.statusEl) App.statusEl.textContent = 'Reverted from Empty Fill';
  } else {
    App.tempTypeFill = false;
    App.prevTool = App.activeTool;
    App.prevBrush = App.brushGroup;
    App.activeTool = 'fill';
    App.brushGroup = [{ tileID: 0, weight: 1 }];
    App.tempEmptyFill = true;
    if (App.brushPanel) App.brushPanel.build();
    if (App.statusEl) App.statusEl.textContent = 'Empty Fill Mode (F to revert)';
  }
  App.buildTools();
};

App.runTypeFill = function() {
  if (App.tempTypeFill) {
    App.tempTypeFill = false;
    if (App.prevTool) App.activeTool = App.prevTool;
    if (App.brushPanel) App.brushPanel.build();
    if (App.statusEl) App.statusEl.textContent = 'Reverted from Type Fill';
  } else {
    App.tempEmptyFill = false;
    App.prevTool = App.activeTool;
    App.activeTool = 'fill';
    App.tempTypeFill = true;
    if (App.brushPanel) App.brushPanel.build();
    if (App.statusEl) App.statusEl.textContent = 'Type Fill Mode (Shift+F to revert)';
  }
  App.buildTools();
};

})(window.RWEditor = window.RWEditor || {});