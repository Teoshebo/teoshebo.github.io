(function(RW){
'use strict';

RW.Utils = {
  b64ToBytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },

  bytesToB64(bytes) {
    let bin = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    }
    return btoa(bin);
  },

  // Uint32Array (LE) → base64(zlib)
  encodeUint32LE(arr) {
    const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
    const compressed = pako.deflate(bytes);
    return RW.Utils.bytesToB64(compressed);
  },

  // base64(zlib) → Uint32Array (LE)
  decodeUint32LE(b64) {
    let bytes = RW.Utils.b64ToBytes(b64.replace(/\s+/g, ''));
    bytes = pako.inflate(bytes);
    return new Uint32Array(bytes.buffer.slice(
      bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  },

  // Скачать файл
  download(filename, content, type) {
    const blob = (content instanceof Blob)
      ? content
      : new Blob([content], { type: type || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  },

  // XML escape
  esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
};

})(window.RWEditor = window.RWEditor || {});