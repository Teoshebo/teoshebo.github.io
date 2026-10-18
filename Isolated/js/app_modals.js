(function(RW){
'use strict';
const App = RW.App;

// ═══════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════
let settingsModalEl = null;
let settingsSnapshot = null;

App.openSettings = function() {
  settingsModalEl = App.el('settingsModal');
  if (!settingsModalEl) { if (App.statusEl) App.statusEl.textContent = 'Settings modal not found in HTML'; return; }

  if (!settingsModalEl._bound) {
    settingsModalEl._bound = true;
    App.on('settingsClose', 'click', App.closeSettings);
    App.on('settingsCancel', 'click', App.closeSettings);
    App.on('settingsApply', 'click', App.applySettings);
    App.on('settingsCanvasBg', 'input', (e) => {
      if (App.wrap) App.wrap.style.background = e.target.value;
      if (App.renderer) App.renderer.render();
    });
    App.on('settingsAtlasBg', 'input', (e) => { App.applyAtlasBg(e.target.value); });
    App.on('settingsMarkerScale', 'input', (e) => {
      const v = parseFloat(e.target.value);
      const valEl = App.el('settingsMarkerScaleVal');
      if (valEl) valEl.textContent = v.toFixed(2) + '×';
      if (App.renderer) { App.renderer.markerScale = v; App.renderer.render(); }
    });
  }

  settingsSnapshot = {
    canvasBg: App.settings.canvasBg, atlasBg: App.settings.atlasBg,
    showMarkers: App.settings.showMarkers, markerScale: App.settings.markerScale,
    lang: App.settings.lang
  };

  const lEn = App.el('settingsLangEn'), lRu = App.el('settingsLangRu');
  if (lEn) lEn.classList.toggle('active', App.settings.lang === 'en');
  if (lRu) lRu.classList.toggle('active', App.settings.lang === 'ru');
  const bgEl = App.el('settingsCanvasBg'); if (bgEl) bgEl.value = App.settings.canvasBg;
  const abEl = App.el('settingsAtlasBg'); if (abEl) abEl.value = App.settings.atlasBg;
  const smEl = App.el('settingsShowMarkers'); if (smEl) smEl.checked = !!App.settings.showMarkers;
  const msEl = App.el('settingsMarkerScale'); if (msEl) msEl.value = App.settings.markerScale || 1;
  const mvEl = App.el('settingsMarkerScaleVal'); if (mvEl) mvEl.textContent = (App.settings.markerScale || 1).toFixed(2) + '×';

  if (App.wrap) App.wrap.style.background = App.settings.canvasBg;
  settingsModalEl.classList.remove('hidden');
};

App.closeSettings = function() {
  if (settingsSnapshot) {
    App.settings.canvasBg = settingsSnapshot.canvasBg;
    App.settings.atlasBg = settingsSnapshot.atlasBg;
    App.settings.showMarkers = settingsSnapshot.showMarkers;
    App.settings.markerScale = settingsSnapshot.markerScale;
    App.settings.lang = settingsSnapshot.lang;
    RW.Storage.saveSettings(App.settings);
  }
  if (App.wrap) App.wrap.style.background = App.settings.canvasBg;
  App.applyAtlasBg(App.settings.atlasBg);
  if (App.renderer) {
    App.renderer.setBg(App.settings.canvasBg);
    App.renderer.showMarkers = !!App.settings.showMarkers;
    App.renderer.markerScale = App.settings.markerScale || 1;
    App.renderer.render();
  }
  RW.I18N.set(App.settings.lang);
  if (settingsModalEl) settingsModalEl.classList.add('hidden');
};

App.applySettings = function() {
  const bgEl = App.el('settingsCanvasBg');
  const abEl = App.el('settingsAtlasBg');
  const smEl = App.el('settingsShowMarkers');
  const msEl = App.el('settingsMarkerScale');
  if (bgEl) App.settings.canvasBg = bgEl.value || '#0a0a0a';
  if (abEl) App.settings.atlasBg = abEl.value || '#0a0a0a';
  if (smEl) App.settings.showMarkers = smEl.checked;
  if (msEl) App.settings.markerScale = parseFloat(msEl.value) || 1;
  RW.Storage.saveSettings(App.settings);
  if (App.wrap) App.wrap.style.background = App.settings.canvasBg;
  App.applyAtlasBg(App.settings.atlasBg);
  if (App.renderer) {
    App.renderer.setBg(App.settings.canvasBg);
    App.renderer.showMarkers = !!App.settings.showMarkers;
    App.renderer.markerScale = App.settings.markerScale;
    App.renderer.render();
  }
  if (settingsModalEl) settingsModalEl.classList.add('hidden');
  if (App.statusEl) App.statusEl.textContent = 'Settings applied';
};

App.pickLang = function(lang) {
  App.settings.lang = lang;
  RW.I18N.set(lang);
  const lEn = App.el('settingsLangEn'), lRu = App.el('settingsLangRu');
  if (lEn) lEn.classList.toggle('active', lang === 'en');
  if (lRu) lRu.classList.toggle('active', lang === 'ru');
};

App.on('btnSettings', 'click', App.openSettings);
App.on('settingsLangEn', 'click', () => App.pickLang('en'));
App.on('settingsLangRu', 'click', () => App.pickLang('ru'));
App.on('btnDocs', 'click', () => window.open('WebTiledDoc.html', '_blank', 'noopener'));

// ═══════════════════════════════════════════════
// REFERENCE
// ═══════════════════════════════════════════════
const REF_DB_NAME = 'webtiled_ref';
const REF_STORE = 'handles';

function refOpenDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(REF_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(REF_STORE)) db.createObjectStore(REF_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function refSaveHandle(handle) {
  try {
    const db = await refOpenDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(REF_STORE, 'readwrite');
      tx.objectStore(REF_STORE).put(handle, 'ref');
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) { console.warn('IDB save failed', e); }
}

async function refGetHandle() {
  try {
    const db = await refOpenDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(REF_STORE, 'readonly');
      const r = tx.objectStore(REF_STORE).get('ref');
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  } catch (e) { return null; }
}

async function refClearHandle() {
  try {
    const db = await refOpenDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(REF_STORE, 'readwrite');
      tx.objectStore(REF_STORE).delete('ref');
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) {}
}

async function refLoadImage(handle) {
  const f = await handle.getFile();
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('image decode failed'));
      i.src = url;
    });
    return img;
  } finally { URL.revokeObjectURL(url); }
}

App.updateRefStatus = function(txt) {
  const el = document.getElementById('refStatusText');
  if (el) el.textContent = txt != null ? txt : (App.settings.reference.path || 'не выбран');
};

App.applyReferenceToRenderer = function() {
  if (!App.renderer) return;
  App.renderer.setReference(App.refImage);
  App.renderer.setReferenceOpacity(App.settings.reference.opacity);
  App.renderer.setReferenceMode(App.settings.reference.mode);
};

App.pickReference = async function() {
  if (window.showOpenFilePicker) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'Images',
          accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.bmp'] }
        }]
      });
      if (!handle) return;
      App.refHandle = handle;
      await refSaveHandle(handle);
      App.refImage = await refLoadImage(handle);
      App.settings.reference.path = handle.name;
      RW.Storage.saveSettings(App.settings);
      App.applyReferenceToRenderer();
      App.updateRefStatus();
      if (App.statusEl) App.statusEl.textContent = 'Reference: ' + handle.name;
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.warn('ref pick failed', e);
        if (App.statusEl) App.statusEl.textContent = 'Reference error: ' + e.message;
      }
    }
    return;
  }
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    try {
      App.refImage = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('image decode failed'));
        i.src = url;
      });
    } catch (e) {
      if (App.statusEl) App.statusEl.textContent = 'Reference error: ' + e.message;
      URL.revokeObjectURL(url);
      return;
    }
    URL.revokeObjectURL(url);
    App.settings.reference.path = f.name;
    RW.Storage.saveSettings(App.settings);
    App.applyReferenceToRenderer();
    App.updateRefStatus();
    if (App.statusEl) App.statusEl.textContent = 'Reference: ' + f.name + ' (не сохранится между сессиями)';
  };
  inp.click();
};

App.tryRestoreReference = async function() {
  if (!App.settings.reference.path) { App.updateRefStatus(); return; }
  if (!window.showOpenFilePicker) {
    App.updateRefStatus('Firefox/Safari — выбери файл заново');
    return;
  }
  try {
    const handle = await refGetHandle();
    if (!handle) { App.updateRefStatus('Выбери файл заново'); return; }
    const perm = await handle.queryPermission({ mode: 'read' });
    if (perm !== 'granted') {
      App.updateRefStatus('Нужен доступ — выбери файл заново');
      return;
    }
    App.refHandle = handle;
    App.refImage = await refLoadImage(handle);
    App.applyReferenceToRenderer();
    App.updateRefStatus();
  } catch (e) {
    console.warn('ref restore failed', e);
    App.updateRefStatus('Выбери файл заново');
  }
};

App.clearReference = async function() {
  App.refImage = null;
  App.refHandle = null;
  App.settings.reference.path = '';
  RW.Storage.saveSettings(App.settings);
  await refClearHandle();
  App.applyReferenceToRenderer();
  App.updateRefStatus('Удалён');
  if (App.statusEl) App.statusEl.textContent = 'Reference cleared';
};

App.bindRefControls = function() {
  const op = App.el('refOpacity');
  const opv = App.el('refOpacityVal');
  const un = App.el('refUnderlay');
  if (op && !op._bound) {
    op._bound = true;
    op.value = App.settings.reference.opacity;
    if (opv) opv.textContent = (+App.settings.reference.opacity).toFixed(2);
    op.addEventListener('input', () => {
      const v = parseFloat(op.value) || 0;
      App.settings.reference.opacity = v;
      if (opv) opv.textContent = v.toFixed(2);
      RW.Storage.saveSettings(App.settings);
      if (App.renderer) App.renderer.setReferenceOpacity(v);
    });
  }
  if (un && !un._bound) {
    un._bound = true;
    un.checked = (App.settings.reference.mode === 'underlay');
    un.addEventListener('change', () => {
      App.settings.reference.mode = un.checked ? 'underlay' : 'overlay';
      RW.Storage.saveSettings(App.settings);
      if (App.renderer) App.renderer.setReferenceMode(App.settings.reference.mode);
    });
  }
  App.on('refPickBtn', 'click', App.pickReference);
  App.on('refClearBtn', 'click', App.clearReference);
};

// ═══════════════════════════════════════════════
// FULLSCREEN
// ═══════════════════════════════════════════════
App.toggleFullscreen = function() {
  const doc = window.document;
  const docEl = doc.documentElement;

  const requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
  const cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

  if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
    if (requestFullScreen) {
      requestFullScreen.call(docEl).catch(err => {
        if (App.statusEl) App.statusEl.textContent = 'Fullscreen error: ' + err.message;
      });
    } else {
      if (App.statusEl) App.statusEl.textContent = 'Fullscreen не поддерживается на этом устройстве (iOS Safari)';
    }
  } else {
    if (cancelFullScreen) {
      cancelFullScreen.call(doc);
    }
  }
};

App.updateFullscreenBtn = function() {
  const isFull = document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement;
  const btnTop = App.el('btnMobileFullscreen');
  const btnUtil = App.el('utilFullscreen');
  
  if (btnTop) btnTop.textContent = isFull ? '⛶' : '⛶'; 
  if (btnUtil) {
    const lbl = btnUtil.querySelector('.ma-lbl');
    if (lbl) lbl.textContent = RW.I18N.t(isFull ? 'btn.exitFullscreen' : 'btn.fullscreen');
    const ic = btnUtil.querySelector('.ma-ic');
    if (ic) ic.textContent = isFull ? '🗗' : '⛶';
  }
  
  setTimeout(() => {
    if (App.renderer) App.renderer.resize();
  }, 200);
};

document.addEventListener('fullscreenchange', App.updateFullscreenBtn);
document.addEventListener('webkitfullscreenchange', App.updateFullscreenBtn);
document.addEventListener('mozfullscreenchange', App.updateFullscreenBtn);
document.addEventListener('MSFullscreenChange', App.updateFullscreenBtn);

})(window.RWEditor = window.RWEditor || {});
