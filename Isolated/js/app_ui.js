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
  m.classList.remove('hidden');
};
App.closeUtilityModal = function() {
  const m = App.el('utilityModal');
  if (m) m.classList.add('hidden');
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

  // Map modal actions
  App.on('mapNewBtn', 'click', () => { App.closeMapModal(); App.loadNewMap(); });
  App.on('mapOpenBtn', 'click', () => { App.closeMapModal(); const f = App.el('fileInput'); if (f) f.click(); });
  App.on('mapSaveBtn', 'click', App.saveMap);
  App.on('mapResizeBtn', 'click', () => { App.closeMapModal(); App.doResize(); });
  App.on('mapMergeBtn', 'click', () => { App.closeMapModal(); App.doMerge(); });

  // Utility modal actions
  App.on('utilSavePreview', 'click', () => { App.closeUtilityModal(); App.exportMapPNG(); });
  App.on('utilFit', 'click', () => { App.doFit(); App.closeUtilityModal(); });
  App.on('utilReset', 'click', () => { App.doReset(); App.closeUtilityModal(); });
  App.on('utilRef', 'click', () => { App.closeUtilityModal(); App.openRefModal(); });

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
// BOTTOM TABS / RESIZE / FIT
// ═══════════════════════════════════════════════
App.on('btnAtlasesTab', 'click', () => {
  const b = App.el('btnAtlasesTab'); if (!b) return;
  const a = b.classList.toggle('active');
  if (App.bottomEl) App.bottomEl.classList.toggle('atlases-hidden', !a);
  if (a && App.tilesetTabs) App.tilesetTabs.build();
});

App.on('btnTypesTab', 'click', () => {
  const b = App.el('btnTypesTab'); if (!b) return;
  const a = b.classList.toggle('active');
  if (App.bottomEl) App.bottomEl.classList.toggle('types-hidden', !a);
  if (a && App.typesPanel) App.typesPanel.build();
});

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
  if (App.renderer) {
    App.renderer.fitView();
    App.updateZoomLabels();
  }
};
App.doReset = function() {
  if (App.renderer) {
    App.renderer.resetView();
    App.updateZoomLabels();
  }
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
// BOTTOM TAB AUTO-SWITCH
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

  const otherId = (tabId === 'btnAtlasesTab') ? 'btnTypesTab' : 'btnAtlasesTab';
  const other = App.el(otherId);
  if (other && other.classList.contains('active')) other.click();

  target.click();
};

// ═══════════════════════════════════════════════
// MISC BINDS (add empty / flood / clear / pick cancel)
// ═══════════════════════════════════════════════
App.on('btnUndo', 'click', App.doUndo);
App.on('btnRedo', 'click', App.doRedo);
App.on('btnOpen', 'click', () => { const f = App.el('fileInput'); if (f) f.click(); });
App.on('btnSave', 'click', App.saveMap);
App.on('btnNew', 'click', App.loadNewMap);
App.on('btnResize', 'click', App.doResize);
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

// Desktop REF button
App.on('btnRef', 'click', App.openRefModal);

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
};

window.addEventListener('DOMContentLoaded', App.boot);

// Небольшая страховка: если скрипты загрузились после DOMContentLoaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  setTimeout(App.boot, 0);
}

})(window.RWEditor = window.RWEditor || {});
