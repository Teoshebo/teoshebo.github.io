(function(RW){
'use strict';

const CHUNK = 32;

class Renderer {
  constructor(canvas, getMap) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.getMap = getMap;
    this.wrap = canvas.parentElement;

    this.view = { x: 0, y: 0, zoom: 1 };
    this.chunkCache = new Map();

    this.layerVisibility = {};
    this.soloLayer = null;

    this.hoverTile = null;
    this.rectStart = null;
    this.rectCurrent = null;
    this.showGrid = true;

    this._fps = { frames: 0, last: performance.now() };
    this.onFps = null;

    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  isLayerVisible(name) {
    if (this.soloLayer) return name === this.soloLayer;
    return this.layerVisibility[name] !== false;
  }

  setLayerVisibility(name, v) {
    this.layerVisibility[name] = v;
    this.invalidate();
  }
  setSolo(name) {
    this.soloLayer = name;
    this.invalidate();
  }
  invalidate() { this.chunkCache.clear(); }
  invalidateCell(tx, ty) {
    const cx = Math.floor(tx / CHUNK);
    const cy = Math.floor(ty / CHUNK);
    this.chunkCache.delete(cx + ',' + cy);
  }
  invalidateRange(x0, y0, x1, y1) {
    const cx0 = Math.floor(Math.min(x0, x1) / CHUNK);
    const cx1 = Math.floor(Math.max(x0, x1) / CHUNK);
    const cy0 = Math.floor(Math.min(y0, y1) / CHUNK);
    const cy1 = Math.floor(Math.max(y0, y1) / CHUNK);
    for (let cy = cy0; cy <= cy1; cy++)
      for (let cx = cx0; cx <= cx1; cx++)
        this.chunkCache.delete(cx + ',' + cy);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const r = this.wrap.getBoundingClientRect();
    this.cv.width = Math.round(r.width * dpr);
    this.cv.height = Math.round(r.height * dpr);
    this.cv.style.width = r.width + 'px';
    this.cv.style.height = r.height + 'px';
    this.render();
  }

  fitView() {
    const map = this.getMap();
    if (!map) return;
    const r = this.wrap.getBoundingClientRect();
    const mapW = map.W * map.tw;
    const mapH = map.H * map.th;
    const z = Math.min(r.width / mapW, r.height / mapH) * 0.95;
    this.view.zoom = Math.max(0.02, Math.min(8, z));
    this.view.x = (r.width - mapW * this.view.zoom) / 2;
    this.view.y = (r.height - mapH * this.view.zoom) / 2;
    this.render();
  }

  resetView() {
    const map = this.getMap();
    if (!map) return;
    const r = this.wrap.getBoundingClientRect();
    this.view.zoom = 1;
    this.view.x = (r.width - map.W * map.tw) / 2;
    this.view.y = (r.height - map.H * map.th) / 2;
    this.render();
  }

  zoomAt(mx, my, factor) {
    const nz = Math.max(0.02, Math.min(16, this.view.zoom * factor));
    const k = nz / this.view.zoom;
    this.view.x = mx - (mx - this.view.x) * k;
    this.view.y = my - (my - this.view.y) * k;
    this.view.zoom = nz;
    this.render();
  }

  screenToTile(clientX, clientY) {
    const r = this.wrap.getBoundingClientRect();
    const map = this.getMap();
    if (!map) return { tx: 0, ty: 0 };
    const px = (clientX - r.left - this.view.x) / this.view.zoom;
    const py = (clientY - r.top - this.view.y) / this.view.zoom;
    return {
      tx: Math.floor(px / map.tw),
      ty: Math.floor(py / map.th)
    };
  }

  // ————————————————————
  findTileset(id) {
    const map = this.getMap();
    let found = null;
    for (const ts of map.tilesets) {
      if (id >= ts.firstgid) found = ts; else break;
    }
    return found;
  }

  drawTileTo(g, x, y, tileID, tw, th) {
    const ts = this.findTileset(tileID);
    if (!ts || !ts.image) return;
    const localID = tileID - ts.firstgid;
    const col = localID % ts.columns;
    const row = Math.floor(localID / ts.columns);
    g.drawImage(ts.image,
      col * ts.tileW, row * ts.tileH, ts.tileW, ts.tileH,
      x * tw, y * th, tw, th);
  }

  getChunk(cx, cy) {
    const key = cx + ',' + cy;
    let c = this.chunkCache.get(key);
    if (c) return c;
    const map = this.getMap();
    const cw = Math.min(CHUNK, map.W - cx * CHUNK);
    const ch = Math.min(CHUNK, map.H - cy * CHUNK);
    c = document.createElement('canvas');
    c.width = cw * map.tw;
    c.height = ch * map.th;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const baseX = cx * CHUNK;
    const baseY = cy * CHUNK;

    for (const name of map.layerOrder) {
      if (!this.isLayerVisible(name)) continue;
      const data = map.layers[name];
      for (let y = 0; y < ch; y++) {
        const rowOff = (baseY + y) * map.W;
        for (let x = 0; x < cw; x++) {
          const id = data[rowOff + baseX + x];
          if (id) this.drawTileTo(g, x, y, id, map.tw, map.th);
        }
      }
    }
    this.chunkCache.set(key, c);
    return c;
  }

  render() {
    const map = this.getMap();
    const r = this.wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const ctx = this.ctx;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, r.width, r.height);

    if (!map) { this._tickFps(); return; }

    ctx.save();
    ctx.translate(this.view.x, this.view.y);
    ctx.scale(this.view.zoom, this.view.zoom);
    ctx.imageSmoothingEnabled = false;

    const tw = map.tw, th = map.th;
    const chunksX = Math.ceil(map.W / CHUNK);
    const chunksY = Math.ceil(map.H / CHUNK);

    const mapPxX0 = -this.view.x / this.view.zoom;
    const mapPxY0 = -this.view.y / this.view.zoom;
    const mapPxX1 = mapPxX0 + r.width / this.view.zoom;
    const mapPxY1 = mapPxY0 + r.height / this.view.zoom;

    const cx0 = Math.max(0, Math.floor(mapPxX0 / (CHUNK * tw)));
    const cy0 = Math.max(0, Math.floor(mapPxY0 / (CHUNK * th)));
    const cx1 = Math.min(chunksX - 1, Math.floor(mapPxX1 / (CHUNK * tw)));
    const cy1 = Math.min(chunksY - 1, Math.floor(mapPxY1 / (CHUNK * th)));

    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const c = this.getChunk(cx, cy);
        ctx.drawImage(c, cx * CHUNK * tw, cy * CHUNK * th);
      }
    }

    if (this.showGrid && this.view.zoom >= 1) {
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.lineWidth = 1 / this.view.zoom;
      ctx.beginPath();
      const sx = Math.max(0, Math.floor(mapPxX0 / tw));
      const sy = Math.max(0, Math.floor(mapPxY0 / th));
      const ex = Math.min(map.W, Math.ceil(mapPxX1 / tw));
      const ey = Math.min(map.H, Math.ceil(mapPxY1 / th));
      for (let x = sx; x <= ex; x++) {
        ctx.moveTo(x * tw, sy * th);
        ctx.lineTo(x * tw, ey * th);
      }
      for (let y = sy; y <= ey; y++) {
        ctx.moveTo(sx * tw, y * th);
        ctx.lineTo(ex * tw, y * th);
      }
      ctx.stroke();
    }

    // подсветка клетки
    if (this.hoverTile) {
      const { tx, ty } = this.hoverTile;
      if (tx >= 0 && ty >= 0 && tx < map.W && ty < map.H) {
        ctx.strokeStyle = 'rgba(255,220,80,0.7)';
        ctx.lineWidth = Math.max(1, 2 / this.view.zoom);
        ctx.strokeRect(tx * tw + 0.5 / this.view.zoom, ty * th + 0.5 / this.view.zoom,
          tw - 1 / this.view.zoom, th - 1 / this.view.zoom);
      }
    }

    // превью прямоугольника
    if (this.rectStart && this.rectCurrent) {
      const x0 = Math.min(this.rectStart.x, this.rectCurrent.x);
      const y0 = Math.min(this.rectStart.y, this.rectCurrent.y);
      const x1 = Math.max(this.rectStart.x, this.rectCurrent.x);
      const y1 = Math.max(this.rectStart.y, this.rectCurrent.y);
      ctx.fillStyle = 'rgba(255,220,80,0.15)';
      ctx.fillRect(x0 * tw, y0 * th, (x1 - x0 + 1) * tw, (y1 - y0 + 1) * th);
      ctx.strokeStyle = 'rgba(255,220,80,0.9)';
      ctx.lineWidth = 2 / this.view.zoom;
      ctx.strokeRect(x0 * tw + 1 / this.view.zoom, y0 * th + 1 / this.view.zoom,
        (x1 - x0 + 1) * tw - 2 / this.view.zoom,
        (y1 - y0 + 1) * th - 2 / this.view.zoom);
    }

    ctx.restore();
    this._tickFps();
  }

  _tickFps() {
    this._fps.frames++;
    const now = performance.now();
    if (now - this._fps.last >= 500) {
      const fps = Math.round(this._fps.frames * 1000 / (now - this._fps.last));
      this._fps.frames = 0;
      this._fps.last = now;
      if (this.onFps) this.onFps(fps, this.chunkCache.size);
    }
  }
}

RW.Renderer = Renderer;
})(window.RWEditor = window.RWEditor || {});