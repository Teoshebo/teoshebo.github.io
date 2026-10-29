(function(RW){
'use strict';
const App = RW.App;

// ═══════════════════════════════════════════════
// MAP MODAL
// ═══════════════════════════════════════════════
App.openMapModal = function() {
  const m = App.el('mapModal');
  if (!m) return;
  const mob = App.el('mapNameMobile');
  if (mob && App.mapNameEl) mob.value = App.mapNameEl.value;
  m.classList.remove('hidden');
};
App.closeMapModal = function() {
  const m = App.el('mapModal');
  if (m) m.classList.add('hidden');
};

// ═══════════════════════════════════════════════
// UTILITY MODAL
// ═══════════════════════════════════════════════
App.openUtilityModal = function() {
  const m = App.el('utilityModal');
  if (!m) return;
  const uv = App.el('utilZoomVal');
  if (uv && App.renderer) uv.textContent = App.renderer.view.zoom.toFixed(2);

  const list = App.el('utilMirrorLayers');
  if (list && App.mapModel) {
    list.innerHTML = '';
    for (const ln of App.mapModel.layerOrder) {
      const lbl = document.createElement('label');
      lbl.style.cssText = 'display:flex; gap:6px; align-items:center; cursor:pointer;';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = ln;
      cb.checked = (ln === 'Ground');
      lbl.appendChild(cb);
      const span = document.createElement('span');
      span.textContent = ln;
      lbl.appendChild(span);
      list.appendChild(lbl);
    }
  }

  m.classList.remove('hidden');
};
App.closeUtilityModal = function() {
  const m = App.el('utilityModal');
  if (m) m.classList.add('hidden');
};

const runMirror = (mode) => {
  if (!App.mapModel) { App.closeUtilityModal(); return; }
  const list = App.el('utilMirrorLayers');
  if (!list) return;
  const checked = Array.from(list.querySelectorAll('input[type=checkbox]:checked')).map(cb => cb.value);
  if (!checked.length) { alert('Выбери хотя бы один слой'); return; }
  App.mirrorMap(mode, checked);
  App.closeUtilityModal();
};

// ═══════════════════════════════════════════════
// REFERENCE MODAL
// ═══════════════════════════════════════════════
App.openRefModal = function() {
  const m = App.el('refModal');
  if (!m) return;
  App.bindRefControls();
  const op = App.el('refOpacity');
  if (op) op.value = App.settings.reference.opacity;
  const opv = App.el('refOpacityVal');
  if (opv) opv.textContent = (+App.settings.reference.opacity).toFixed(2);
  const un = App.el('refUnderlay');
  if (un) un.checked = (App.settings.reference.mode === 'underlay');
  App.updateRefStatus();
  m.classList.remove('hidden');
};
App.closeRefModal = function() {
  const m = App.el('refModal');
  if (m) m.classList.add('hidden');
};

// ═══════════════════════════════════════════════
// RIGHT PANEL (mobile)
// ═══════════════════════════════════════════════
App.toggleRightPanel = function() {
  if (App.mobile.rightOpen) App.closeRightPanel();
  else App.openRightPanel();
};
App.openRightPanel = function() {
  const panel = App.el('rightPanel');
  const back = App.el('rightBackdrop');
  if (!panel || !back) return;
  panel.classList.add('open');
  back.classList.remove('hidden');
  void back.offsetWidth;
  back.classList.add('show');
  App.mobile.rightOpen = true;
};
App.closeRightPanel = function() {
  const panel = App.el('rightPanel');
  const back = App.el('rightBackdrop');
  if (!panel || !back) return;
  panel.classList.remove('open');
  back.classList.remove('show');
  App.mobile.rightOpen = false;
  setTimeout(() => {
    if (!App.mobile.rightOpen) back.classList.add('hidden');
  }, 250);
};

// ═══════════════════════════════════════════════
// BOTTOM PANEL (mobile)
// ═══════════════════════════════════════════════
App.openBottomMobile = function() {
  const b = App.el('bottom');
  const bar = App.el('mobileBottomBar');
  if (!b) return;
  b.classList.add('mobile-open');
  b.classList.remove('collapsed');
  if (bar) bar.classList.add('hidden');
  App.mobile.bottomOpen = true;
  if (App.renderer) setTimeout(() => App.renderer.resize(), 240);
};
App.closeBottomMobile = function() {
  const b = App.el('bottom');
  const bar = App.el('mobileBottomBar');
  if (!b) return;
  b.classList.remove('mobile-open');
  if (bar) bar.classList.remove('hidden');
  App.mobile.bottomOpen = false;
  if (App.renderer) setTimeout(() => App.renderer.resize(), 240);
};

// ═══════════════════════════════════════════════
// MOBILE SETUP
// ═══════════════════════════════════════════════
App.setupMobileUI = function() {
  App.updateMobileBrushBtn();

  App.on('btnMobileBrush', 'click', App.openToolPicker);
  App.on('btnMobileMap', 'click', App.openMapModal);
  App.on('btnMobileUtility', 'click', App.openUtilityModal);
  App.on('btnMobileRightPanel', 'click', App.toggleRightPanel);
  App.on('btnMobileFullscreen', 'click', App.toggleFullscreen);
  App.on('utilFullscreen', 'click', () => { App.closeUtilityModal(); App.toggleFullscreen(); });

  App.on('toolPickerClose', 'click', App.closeToolPicker);
  App.on('mapModalClose', 'click', App.closeMapModal);
  App.on('utilityModalClose', 'click', App.closeUtilityModal);
  App.on('refClose', 'click', App.closeRefModal);

  App.on('mapNewBtn', 'click', () => { App.closeMapModal(); App.loadNewMap(); });
  App.on('mapOpenBtn', 'click', () => { App.closeMapModal(); const f = App.el('fileInput'); if (f) f.click(); });
  App.on('mapSaveBtn', 'click', App.saveMap);
  App.on('mapResizeBtn', 'click', () => { App.closeMapModal(); App.doResize(); });
  App.on('mapMergeBtn', 'click', () => { App.closeMapModal(); App.doMerge(); });

  App.on('utilSavePreview', 'click', () => { App.closeUtilityModal(); App.exportMapPNG(); });
  App.on('utilFit', 'click', () => { App.doFit(); App.closeUtilityModal(); });
  App.on('utilReset', 'click', () => { App.doReset(); App.closeUtilityModal(); });
  App.on('utilRef', 'click', () => { App.closeUtilityModal(); App.openRefModal(); });
  App.on('utilResize', 'click', () => { App.closeUtilityModal(); App.doResize(); });

  App.on('utilMirrorH', 'click', () => runMirror('h'));
  App.on('utilMirrorHInv', 'click', () => runMirror('h_inv'));
  App.on('utilMirrorV', 'click', () => runMirror('v'));
  App.on('utilMirrorVInv', 'click', () => runMirror('v_inv'));
  App.on('utilMirrorQuad', 'click', () => runMirror('quad'));

  const tpModal = App.el('toolPickerModal');
  if (tpModal) tpModal.addEventListener('click', (e) => { if (e.target === tpModal) App.closeToolPicker(); });
  const mm = App.el('mapModal');
  if (mm) mm.addEventListener('click', (e) => { if (e.target === mm) App.closeMapModal(); });
  const um = App.el('utilityModal');
  if (um) um.addEventListener('click', (e) => { if (e.target === um) App.closeUtilityModal(); });
  const rm = App.el('refModal');
  if (rm) rm.addEventListener('click', (e) => { if (e.target === rm) App.closeRefModal(); });

  App.on('rightPanelClose', 'click', App.closeRightPanel);
  App.on('rightBackdrop', 'click', App.closeRightPanel);

  App.on('btnMobileBottom', 'click', App.openBottomMobile);
  App.on('btnMobileBottomOpen', 'click', App.openBottomMobile);

  const toggleBtn = App.el('btnToggleBottom');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      if (App.mobile.isMobile() && App.mobile.bottomOpen) {
        e.preventDefault();
        e.stopPropagation();
        App.closeBottomMobile();
      }
    }, true);
  }

  window.addEventListener('resize', () => {
    if (!App.mobile.isMobile()) {
      App.closeRightPanel();
      const b = App.el('bottom');
      if (b) b.classList.remove('mobile-open');
      const bar = App.el('mobileBottomBar');
      if (bar) bar.classList.remove('hidden');
      App.mobile.bottomOpen = false;
    }
  });
};

// ═══════════════════════════════════════════════
// [Patch 0.7.2] ФУНКЦИИ WALL CREATOR (ACCEPT)
// ═══════════════════════════════════════════════
App.updateAcceptWallsVisibility = function() {
  const btn = App.el('btnAcceptWalls');
  if (!btn) return;
  
  // Кнопка видна ТОЛЬКО если выбран инструмент Terrain И есть необработанные изменения
  if (App.activeTool === 'terrain' && App.pendingVoidChanges && App.pendingVoidChanges.length > 0) {
    btn.style.display = 'block';
    btn.classList.remove('hidden');
  } else {
    btn.style.display = 'none';
    btn.classList.add('hidden');
  }
};

App.on('btnAcceptWalls', 'click', () => {
  if (!App.pendingVoidChanges || !App.pendingVoidChanges.length) return;
  
  const map = App.mapModel;
  const groundData = map.layers.Ground;
  
  // 1. Возвращаем Ground в исходное состояние
  for (const c of App.pendingVoidChanges) {
    groundData[c.idx] = c.before;
    const x = c.idx % map.W;
    const y = Math.floor(c.idx / map.W);
    App.renderer.invalidateCell(x, y);
  }
  
  // 2. Формируем нормальный Undo-стек для этого действия
  // Чтобы можно было отменить через Ctrl+Z
  map.undoStack.push({ layer: 'Ground', changes: App.pendingVoidChanges });
  if (map.undoStack.length > 50) map.undoStack.shift();
  map.redoStack.length = 0;
  
  // 3. Очищаем и скрываем
  App.pendingVoidChanges = [];
  App.updateAcceptWallsVisibility();
  App.renderer.render();
  
  if (App.statusEl) App.statusEl.textContent = 'Wall Creator: стены применены (Ground очищен)';
});

// ═══════════════════════════════════════════════
// [Patch 04.0] ЕДИНЫЙ КОНТРОЛЛЕР ВКЛАДОК
// ═══════════════════════════════════════════════
App.updateBottomTabs = function(tabId) {
  const isMobile = App.mobile.isMobile();
  const bottomEl = App.bottomEl;
  if (!bottomEl) return;

  const allTabs = ['btnAtlasesTab', 'btnTypesTab', 'btnGenTab', 'btnV3Tab'];
  const tabEl = App.el(tabId);
  if (!tabEl) return;

  const isActive = !tabEl.classList.contains('active');
  tabEl.classList.toggle('active', isActive);

  if (isMobile) {
    if (isActive) {
      for (const t of allTabs) {
        if (t !== tabId) {
          const el = App.el(t);
          if (el) el.classList.remove('active');
        }
      }
      bottomEl.classList.add('atlases-hidden');
      bottomEl.classList.add('types-hidden');
      const genB = App.el('hmGenBody'); if (genB) genB.classList.add('hidden');
      const v3B = App.el('hmV3Body'); if (v3B) v3B.classList.add('hidden');

      if (tabId === 'btnAtlasesTab') {
        bottomEl.classList.remove('atlases-hidden');
        if (App.tilesetTabs) App.tilesetTabs.build();
      }
      if (tabId === 'btnTypesTab') {
        bottomEl.classList.remove('types-hidden');
        if (App.typesPanel) App.typesPanel.build();
      }
      if (tabId === 'btnGenTab' && genB) genB.classList.remove('hidden');
      if (tabId === 'btnV3Tab' && v3B) v3B.classList.remove('hidden');
    } else {
      if (tabId === 'btnAtlasesTab') bottomEl.classList.add('atlases-hidden');
      if (tabId === 'btnTypesTab') bottomEl.classList.add('types-hidden');
      if (tabId === 'btnGenTab') { const genB = App.el('hmGenBody'); if (genB) genB.classList.add('hidden'); }
      if (tabId === 'btnV3Tab') { const v3B = App.el('hmV3Body'); if (v3B) v3B.classList.add('hidden'); }
    }
  } else {
    if (tabId === 'btnAtlasesTab') {
      bottomEl.classList.toggle('atlases-hidden', !isActive);
      if (isActive && App.tilesetTabs) App.tilesetTabs.build();
    }
    if (tabId === 'btnTypesTab') {
      bottomEl.classList.toggle('types-hidden', !isActive);
      if (isActive && App.typesPanel) App.typesPanel.build();
    }
    if (tabId === 'btnGenTab') {
      const genB = App.el('hmGenBody'); if (genB) genB.classList.toggle('hidden', !isActive);
    }
    if (tabId === 'btnV3Tab') {
      const v3B = App.el('hmV3Body'); if (v3B) v3B.classList.toggle('hidden', !isActive);
    }
  }
};

App.on('btnAtlasesTab', 'click', () => App.updateBottomTabs('btnAtlasesTab'));
App.on('btnTypesTab', 'click', () => App.updateBottomTabs('btnTypesTab'));
App.on('btnGenTab', 'click', () => App.updateBottomTabs('btnGenTab'));
App.on('btnV3Tab', 'click', () => App.updateBottomTabs('btnV3Tab'));

// ─── Collapse / expand bottom ───
App.on('btnToggleBottom', 'click', (e) => {
  if (!App.bottomEl) return;
  if (App.mobile.isMobile() && App.mobile.bottomOpen) return;
  const isCollapsed = App.bottomEl.classList.contains('collapsed');
  if (!isCollapsed) {
    const h = App.bottomEl.getBoundingClientRect().height;
    App.bottomEl.dataset.savedHeight = String(Math.round(h));
    App.bottomEl.style.height = '';
    App.bottomEl.classList.add('collapsed');
    e.target.textContent = '▲';
  } else {
    App.bottomEl.classList.remove('collapsed');
    const saved = parseInt(App.bottomEl.dataset.savedHeight || '0', 10);
    App.bottomEl.style.height = saved > 40 ? saved + 'px' : '340px';
    e.target.textContent = '▼';
  }
  setTimeout(() => { if (App.renderer) App.renderer.resize(); }, 220);
});

(function setupBottomResize() {
  if (!App.bottomGrabberEl || !App.bottomEl) return;
  let resizing = false;
  App.bottomGrabberEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    resizing = true;
    delete App.bottomEl.dataset.savedHeight;
    App.bottomEl.classList.remove('collapsed');
    const tb = App.el('btnToggleBottom'); if (tb) tb.textContent = '▼';
    App.bottomEl.classList.add('no-transition');
    App.bottomGrabberEl.classList.add('dragging');
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
  });
  window.addEventListener('mousemove', (e) => {
    if (!resizing) return;
    const h = window.innerHeight - e.clientY;
    const c = Math.max(60, Math.min(window.innerHeight - 120, h));
    App.bottomEl.style.height = c + 'px';
    if (App.renderer) App.renderer.resize();
  });
  window.addEventListener('mouseup', () => {
    if (!resizing) return;
    resizing = false;
    App.bottomEl.classList.remove('no-transition');
    App.bottomGrabberEl.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();

App.doFit = function() {
  if (App.renderer) { App.renderer.fitView(); App.updateZoomLabels(); }
};
App.doReset = function() {
  if (App.renderer) { App.renderer.resetView(); App.updateZoomLabels(); }
};
App.on('btnFit', 'click', App.doFit);
App.on('btnReset', 'click', App.doReset);

// ═══════════════════════════════════════════════
// ICONS FALLBACK
// ═══════════════════════════════════════════════
App.setupTopbarIcons = function() {
  document.querySelectorAll('#topbar img.btn-ic').forEach(img => {
    img.addEventListener('error', () => {
      const emo = img.dataset.emoji || '';
      if (!emo) { img.remove(); return; }
      const s = document.createElement('span');
      s.className = 'btn-emoji';
      s.textContent = emo;
      img.replaceWith(s);
    }, { once: true });
  });
};

// ═══════════════════════════════════════════════
// BOTTOM TAB AUTO-SWITCH (при выборе инструмента)
// ═══════════════════════════════════════════════
const TOOL_TO_TAB = {
  brush:   'btnAtlasesTab',
  classic: 'btnAtlasesTab',
  eraser:  'btnAtlasesTab',
  rect:    'btnAtlasesTab',
  fill:    'btnAtlasesTab',
  picker:  'btnAtlasesTab',
  terrain: 'btnTypesTab'
};

App.autoSwitchBottomTabForTool = function(toolId) {
  const tabId = TOOL_TO_TAB[toolId];
  if (!tabId) return;

  if (App.bottomEl && App.bottomEl.classList.contains('collapsed')) {
    const tg = App.el('btnToggleBottom');
    if (tg) tg.click();
  }

  const target = App.el(tabId);
  if (!target) return;
  if (target.classList.contains('active')) return;
  target.click();
};

// ═══════════════════════════════════════════════
// MISC BINDS
// ═══════════════════════════════════════════════
App.on('btnUndo', 'click', App.doUndo);
App.on('btnRedo', 'click', App.doRedo);
App.on('btnOpen', 'click', () => { const f = App.el('fileInput'); if (f) f.click(); });
App.on('btnSave', 'click', App.saveMap);
App.on('btnNew', 'click', App.loadNewMap);
App.on('btnMerge', 'click', App.doMerge);
App.on('btnExportMap', 'click', App.exportMapPNG);
App.on('btnAddEmpty', 'click', App.addEmptyToBrush);
App.on('btnFlood', 'click', App.runFloodDominant);
App.on('btnClearBrush', 'click', () => {
  App.brushGroup = [];
  if (App.brushPanel) App.brushPanel.build();
  if (App.tilesetTabs) App.tilesetTabs.refreshSelection();
});
if (App.mapNameEl) {
  App.mapNameEl.addEventListener('input', () => {
    const m = App.el('mapNameMobile');
    if (m) m.value = App.mapNameEl.value;
  });
}
App.on('btnPickCancel', 'click', () => App.endPick());
App.on('btnWarnClose', 'click', () => {
  if (App.warnBannerEl) App.warnBannerEl.classList.add('hidden');
});

// ═══════════════════════════════════════════════
// GUIDES PANEL UI
// ═══════════════════════════════════════════════
App.showGuidesPanel = function() {
  const p = App.el('guidesPanel');
  if (p) p.style.display = 'block';
  App.renderGuidesList();
};

App.hideGuidesPanel = function() {
  const p = App.el('guidesPanel');
  if (p) p.style.display = 'none';
};

App.setGuideMode = function(mode) {
  App.guideMode = mode;
  const btnC = App.el('btnGuideModeCreate');
  const btnS = App.el('btnGuideModeSelect');
  if (btnC) {
    const isActive = mode === 'create';
    btnC.classList.toggle('active', isActive);
    btnC.style.background = isActive ? '#3a2050' : '#222';
    btnC.style.color = isActive ? '#e8f' : '#888';
    btnC.style.borderColor = isActive ? '#c8f' : '#444';
  }
  if (btnS) {
    const isActive = mode === 'select';
    btnS.classList.toggle('active', isActive);
    btnS.style.background = isActive ? '#3a2050' : '#222';
    btnS.style.color = isActive ? '#e8f' : '#888';
    btnS.style.borderColor = isActive ? '#c8f' : '#444';
  }
  if (mode === 'select') {
    App.guideDrawStart = null;
    App.guideDrawCurrent = null;
  }
  if (App.statusEl) App.statusEl.textContent = 'Guide mode: ' + mode;
};

App.setGuideType = function(type) {
  App.activeGuideType = type;
  document.querySelectorAll('.guide-type-btn').forEach(btn => {
    const isActive = btn.dataset.type === type;
    btn.classList.toggle('active', isActive);
    btn.style.background = isActive ? '#3a2050' : '#222';
    btn.style.color = isActive ? '#e8f' : '#888';
    btn.style.borderColor = isActive ? '#c8f' : '#444';
  });
};

App.renderGuidesList = function() {
  const list = App.el('guidesList');
  if (!list) return;
  list.innerHTML = '';
  if (!App.helpers || !App.helpers.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'color:#555;font-size:10px;padding:6px;text-align:center';
    empty.textContent = '— нет —';
    list.appendChild(empty);
    return;
  }
  App.helpers.forEach((h, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;padding:3px 6px;background:#0e0e0e;border:1px solid #2a2a2a;border-radius:3px;margin-bottom:3px';
    if (i === App.selectedGuideIdx) {
      row.style.borderColor = '#fff';
      row.style.background = '#2a2a2a';
    }

    const label = document.createElement('span');
    label.style.cssText = 'flex:1;font-size:10px;color:#0ff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer';
    let text = h.type.toUpperCase();
    if (h.type === 'line') text += ' [' + h.x1 + ',' + h.y1 + ']→[' + h.x2 + ',' + h.y2 + ']';
    else if (h.type === 'rect') text += ' [' + h.x + ',' + h.y + ' ' + h.w + '×' + h.h + ']';
    else if (h.type === 'circle') text += ' [' + h.x + ',' + h.y + ' r=' + (h.w / 2).toFixed(1) + ']';
    else if (h.type === 'point') text += ' [' + h.x + ',' + h.y + ']';
    label.textContent = text;
    label.title = text;
    label.addEventListener('click', () => {
      App.selectedGuideIdx = (App.selectedGuideIdx === i) ? -1 : i;
      App.renderGuidesList();
      if (App.renderer) App.renderer.render();
    });
    row.appendChild(label);

    const del = document.createElement('button');
    del.textContent = '×';
    del.title = 'Удалить';
    del.style.cssText = 'background:transparent;border:0;color:#f88;cursor:pointer;font-size:14px;padding:0 4px;font-family:inherit;line-height:1';
    del.addEventListener('click', () => App.removeGuide(i));
    row.appendChild(del);

    list.appendChild(row);
  });
};

App.removeGuide = function(idx) {
  if (idx >= 0 && idx < App.helpers.length) {
    App.helpers.splice(idx, 1);
    if (App.selectedGuideIdx === idx) App.selectedGuideIdx = -1;
    else if (App.selectedGuideIdx > idx) App.selectedGuideIdx--;
    if (typeof App.renderGuidesList === 'function') App.renderGuidesList();
    if (App.renderer) App.renderer.render();
  }
};

App.clearGuides = function() {
  App.helpers = [];
  App.selectedGuideIdx = -1;
  if (typeof App.renderGuidesList === 'function') App.renderGuidesList();
  if (App.renderer) App.renderer.render();
  if (App.statusEl) App.statusEl.textContent = 'All guides cleared';
};

App.on('btnClearGuides', 'click', () => {
  if (!App.helpers || !App.helpers.length) return;
  if (confirm('Удалить все guides?')) App.clearGuides();
});

document.querySelectorAll('.guide-type-btn').forEach(btn => {
  btn.addEventListener('click', () => App.setGuideType(btn.dataset.type));
});

App.on('btnGuideModeCreate', 'click', () => App.setGuideMode('create'));
App.on('btnGuideModeSelect', 'click', () => App.setGuideMode('select'));

App.on('symH',  'change', (e) => { App.guideSymmetry.h  = e.target.checked; });
App.on('symV',  'change', (e) => { App.guideSymmetry.v  = e.target.checked; });
App.on('symD',  'change', (e) => { App.guideSymmetry.d  = e.target.checked; });
App.on('symAD', 'change', (e) => { App.guideSymmetry.ad = e.target.checked; });

// ═══════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════
App.boot = function() {
  if (App.settings.activeTool) App.activeTool = App.settings.activeTool;
  if (App.wrap) App.wrap.style.background = App.settings.canvasBg || '#0a0a0a';
  App.applyAtlasBg(App.settings.atlasBg);
  RW.I18N.apply();
  App.buildTools();
  App.setupTopbarIcons();
  App.setupMobileUI();
  App.bindRefControls();
  App.tryRestoreReference();
  App.setGuideType(App.activeGuideType || 'line');
  App.setGuideMode(App.guideMode || 'create');
  App.renderGuidesList();
};

window.addEventListener('DOMContentLoaded', App.boot);

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(App.boot, 0);
}

})(window.RWEditor = window.RWEditor || {});