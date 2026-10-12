(function(RW){
'use strict';
const HM = RW.HM = RW.HM || {};

// ─── Import PNG → level array ───
// Returns { level: Uint8Array(W*H), w, h }.
// Brightness: dark → level 0 (peak), bright → level N-1 (floor).
HM.importPNG = async function(file, levels) {
  const buf = await file.arrayBuffer();
  const blob = new Blob([buf], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('PNG read failed'));
      i.src = url;
    });
    const w = img.naturalWidth, h = img.naturalHeight;
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    const oc = off.getContext('2d', { willReadFrequently: true });
    oc.drawImage(img, 0, 0);
    const data = oc.getImageData(0, 0, w, h).data;
    const level = new Uint8Array(w*h);
    for (let i = 0; i < w*h; i++) {
      const r = data[i*4], g = data[i*4+1], b = data[i*4+2];
      const lum = 0.299*r + 0.587*g + 0.114*b;   // 0..255
      const norm = lum / 255;
      let idx = Math.round(norm * (levels - 1));
      if (idx < 0) idx = 0;
      if (idx > levels - 1) idx = levels - 1;
      level[i] = idx;
    }
    return { level, w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
};

// PNG → Uint8ClampedArray RGBA (для colorMode='png' в 3D).
HM.importPNG_RGBA = async function(file, targetW, targetH) {
  const buf = await file.arrayBuffer();
  const blob = new Blob([buf], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('PNG read failed'));
      i.src = url;
    });
    const off = document.createElement('canvas');
    off.width = targetW; off.height = targetH;
    const oc = off.getContext('2d', { willReadFrequently: true });
    oc.drawImage(img, 0, 0, targetW, targetH);
    return oc.getImageData(0, 0, targetW, targetH).data;
  } finally {
    URL.revokeObjectURL(url);
  }
};

// ─── Level array → ImageData (grayscale preview) ───
HM.levelToImageData = function(level, w, h, levels) {
  const img = new ImageData(w, h);
  const maxL = levels - 1;
  const denom = Math.max(1, maxL);
  for (let i = 0; i < w*h; i++) {
    const v = Math.round((level[i] / denom) * 255);
    img.data[i*4]   = v;
    img.data[i*4+1] = v;
    img.data[i*4+2] = v;
    img.data[i*4+3] = 255;
  }
  return img;
};

})(window.RWEditor = window.RWEditor || {});
