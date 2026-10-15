(function(RW){
'use strict';

const KEY_SETTINGS = 'rweditor.settings';
const KEY_AUTOSAVE = 'rweditor.autosave';

class Storage {
  // ——— Settings
  static loadSettings() {
    try {
      const s = localStorage.getItem(KEY_SETTINGS);
      return s ? JSON.parse(s) : {};
    } catch (_) { return {}; }
  }
  static saveSettings(obj) {
    try { localStorage.setItem(KEY_SETTINGS, JSON.stringify(obj)); } catch (_) {}
  }

  // ——— Autosave
  static hasAutosave() {
    try { return !!localStorage.getItem(KEY_AUTOSAVE); } catch (_) { return false; }
  }

  static getAutosaveMeta() {
    try {
      const s = localStorage.getItem(KEY_AUTOSAVE);
      if (!s) return null;
      const obj = JSON.parse(s);
      return {
        timestamp: obj.timestamp,
        filename: obj.filename,
        W: obj.W, H: obj.H
      };
    } catch (_) { return null; }
  }

  static clearAutosave() {
    try { localStorage.removeItem(KEY_AUTOSAVE); } catch (_) {}
  }

  static saveAutosave(mapModel, typesModel, filename) {
    if (!mapModel) return false;
    const U = RW.Utils;

    // layers → base64
    const layersB64 = {};
    for (const name of mapModel.layerOrder) {
      const arr = mapModel.layers[name];
      const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
      layersB64[name] = U.bytesToB64(bytes);
    }

    const obj = {
      timestamp: Date.now(),
      filename: filename || 'map.tmx',
      W: mapModel.W, H: mapModel.H,
      tw: mapModel.tw, th: mapModel.th,
      orientation: mapModel.orientation,
      renderorder: mapModel.renderorder,
      version: mapModel.version,
      mapProps: mapModel.mapProps,
      layerOrder: mapModel.layerOrder,
      layerOriginalXml: mapModel.layerOriginalXml || {},
      layersB64,
      rawXml: mapModel.rawXml,
      typesConfig: typesModel ? typesModel.toJSON() : null
    };

    try {
      localStorage.setItem(KEY_AUTOSAVE, JSON.stringify(obj));
      return true;
    } catch (e) {
      console.warn('Autosave failed:', e.message);
      // попытка освободить место
      try { localStorage.removeItem(KEY_AUTOSAVE); } catch (_) {}
      return false;
    }
  }

  static restoreAutosave() {
    try {
      const s = localStorage.getItem(KEY_AUTOSAVE);
      if (!s) return null;
      const obj = JSON.parse(s);
      const U = RW.Utils;

      // Восстанавливаем из rawXml — это проще и надёжнее
      const parsed = RW.TMX.parse(obj.rawXml);

      // заменяем данные слоёв на сохранённые из base64
      for (const name of obj.layerOrder) {
        const b64 = obj.layersB64[name];
        if (!b64) continue;
        const bytes = U.b64ToBytes(b64);
        parsed.layers[name] = new Uint32Array(
          bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
      }
      parsed.typesConfigRaw = obj.typesConfig
        ? JSON.stringify(obj.typesConfig) : null;
      parsed._restoredFilename = obj.filename;
      parsed._restoredTimestamp = obj.timestamp;
      return parsed;
    } catch (e) {
      console.warn('Restore failed:', e);
      return null;
    }
  }
}

RW.Storage = Storage;
})(window.RWEditor = window.RWEditor || {});