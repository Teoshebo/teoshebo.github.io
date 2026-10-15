(function(RW){
'use strict';
const HM = RW.HM = RW.HM || {};

// ═══════════════════════════════════════════════
// GENERATOR PANEL
// ═══════════════════════════════════════════════
class HMGeneratorPanel {
  constructor(rootEl, ctx) {
    this.root = rootEl;
    this.ctx = ctx;
    this.level = null;
    this.importedPNG = null;
    this.rivers = [];
    this.points = null;
    this.previewCanvas = null;
  }

  build() {
    this.root.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'hm-panel';

    wrap.appendChild(this.section('PROCEDURAL GENERATION', () => {
      const g = this.grid();
      g.appendChild(this.field('WIDTH', 'hm_w', 'number', 256, { min: 32, max: 2048 }));
      g.appendChild(this.field('HEIGHT', 'hm_h', 'number', 256, { min: 32, max: 2048 }));
      g.appendChild(this.field('LEVELS', 'hm_levels', 'number', 10, { min: 3, max: 14 }));
      g.appendChild(this.field('FLATTEN BOTTOM', 'hm_flatten', 'number', 3, { min: 0, max: 10 }));
      g.appendChild(this.field('NOISE SCALE', 'hm_nscale', 'number', 160, { min: 30, max: 600 }));
      g.appendChild(this.field('OCTAVES', 'hm_oct', 'number', 3, { min: 1, max: 6 }));
      g.appendChild(this.field('PLAYABLE %', 'hm_flat', 'number', 15, { min: 5, max: 90 }));
      g.appendChild(this.field('EDGE BIAS', 'hm_edge', 'number', 0, { min: -6, max: 6, step: 0.1 }));
      g.appendChild(this.field('EDGE CURVE', 'hm_edgepow', 'number', 1, { min: 0.3, max: 4, step: 0.1 }));
      g.appendChild(this.field('SYMMETRY', 'hm_sym', 'select', 'rotate-180', {
        options: [
          ['none','none'], ['mirror-x','mirror X'], ['mirror-y','mirror Y'],
          ['rotate-180','rotate 180°'], ['quad','quad'],
          ['diag','diag'], ['anti-diag','anti-diag']
        ]
      }));
      g.appendChild(this.field('SYM STRENGTH', 'hm_symstr', 'number', 0.8, { min: 0, max: 1, step: 0.05 }));
      g.appendChild(this.field('PASSES', 'hm_passes', 'number', 8, { min: 0, max: 80 }));
      g.appendChild(this.field('PASS W', 'hm_pw', 'number', 2, { min: 1, max: 8 }));
      g.appendChild(this.field('PASS LEN', 'hm_plen', 'number', 50, { min: 5, max: 300 }));
      g.appendChild(this.field('SEED', 'hm_seed', 'number', 651422, {}));
      return g;
    }));

    wrap.appendChild(this.btnRow([
      { id: 'hm_gen', text: 'GENERATE', cls: 'primary', onClick: () => this.doGenerate() },
      { id: 'hm_rand', text: 'RANDOM SEED', onClick: () => {
        document.getElementById('hm_seed').value = Math.floor(Math.random()*1e6);
      }}
    ]));

    wrap.appendChild(this.section('PNG IMPORT (base heightmap)', () => {
      const box = document.createElement('div');
      box.style.display = 'flex';
      box.style.gap = '8px';
      box.style.alignItems = 'center';
      box.style.flexWrap = 'wrap';

      const inp = document.createElement('input');
      inp.type = 'file';
      inp.id = 'hm_pngFile';
      inp.accept = 'image/*';
      inp.addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const levels = parseInt(document.getElementById('hm_levels').value, 10) || 10;
          const res = await HM.importPNG(f, levels);
          this.importedPNG = { level: res.level, w: res.w, h: res.h, name: f.name };
          document.getElementById('hm_w').value = res.w;
          document.getElementById('hm_h').value = res.h;
          this.updatePngStatus();
          this.renderPreview();
        } catch (err) {
          this.status('Ошибка PNG: ' + err.message, 'err');
        }
        e.target.value = '';
      });
      box.appendChild(inp);

      const btnClear = document.createElement('button');
      btnClear.textContent = 'CLEAR';
      btnClear.className = 'danger';
      btnClear.style.background = '#3a1a1a';
      btnClear.style.borderColor = '#833';
      btnClear.style.color = '#fdd';
      btnClear.style.padding = '6px 12px';
      btnClear.style.fontFamily = 'inherit';
      btnClear.style.fontSize = '10px';
      btnClear.style.borderRadius = '3px';
      btnClear.style.cursor = 'pointer';
      btnClear.addEventListener('click', () => {
        this.importedPNG = null;
        this.updatePngStatus();
        this.renderPreview();
      });
      box.appendChild(btnClear);

      const status = document.createElement('span');
      status.id = 'hm_pngStatus';
      status.style.fontSize = '10px';
      status.style.color = '#8cf';
      status.textContent = 'PNG не загружен';
      box.appendChild(status);

      return box;
    }));

    wrap.appendChild(this.section('RIVERS', () => {
      const g = this.grid();
      g.appendChild(this.field('ENABLE', 'hm_rivOn', 'checkbox', true, {}));
      g.appendChild(this.field('SMOOTH', 'hm_rivSmooth', 'number', 50, { min: 0, max: 120 }));
      return g;
    }));

    wrap.appendChild(this.btnRow([
      { id: 'hm_riv_auto', text: '+ AUTO RIVER', onClick: () => this.addAutoRiver() },
      { id: 'hm_riv_clr', text: 'CLEAR', cls: 'danger', onClick: () => {
        this.rivers = []; this.renderPreview();
      }}
    ]));

    wrap.appendChild(this.section('AUTO POINTS', () => {
      const g = this.grid();
      g.appendChild(this.field('PLAYERS', 'hm_aP', 'number', 2, { min: 1, max: 5 }));
      g.appendChild(this.field('HOME / PLAYER', 'hm_aK', 'number', 1, { min: 0, max: 6 }));
      g.appendChild(this.field('FRONT PTS', 'hm_aF', 'number', 4, { min: 0, max: 20 }));
      g.appendChild(this.field('SPREAD', 'hm_aspr', 'number', 1, { min: 0.5, max: 2, step: 0.1 }));
      g.appendChild(this.field('EDGE MARGIN %', 'hm_aedge', 'number', 10, { min: 0, max: 30 }));
      g.appendChild(this.field('HEIGHT MARGIN', 'hm_aheight', 'number', 10, { min: 0, max: 40 }));
      return g;
    }));

    wrap.appendChild(this.btnRow([
      { id: 'hm_pts_gen', text: 'GENERATE POINTS', cls: 'good', onClick: () => this.doGeneratePoints() },
      { id: 'hm_pts_clr', text: 'CLEAR', cls: 'danger', onClick: () => {
        this.points = null; this.renderPreview();
      }}
    ]));

    wrap.appendChild(this.section('PREVIEW', () => {
      const cv = document.createElement('canvas');
      cv.id = 'hm_preview';
      cv.width = 256; cv.height = 256;
      cv.style.background = '#000';
      cv.style.imageRendering = 'pixelated';
      cv.style.border = '1px solid #222';
      cv.style.maxWidth = '256px';
      cv.style.display = 'block';
      this.previewCanvas = cv;
      return cv;
    }));

    wrap.appendChild(this.section('APPLY TO MAP', () => {
      const g = this.grid();
      g.appendChild(this.field('TARGET LAYER', 'hm_target', 'text', 'Ground', {}));
      g.appendChild(this.field('EDGE LAYER', 'hm_edgeLayer', 'text', 'Items0', {}));
      return g;
    }));

    wrap.appendChild(this.btnRow([
      { id: 'hm_apply', text: 'APPLY', cls: 'primary', onClick: () => this.doApply() }
    ]));

    const rep = document.createElement('div');
    rep.id = 'hm_report';
    rep.className = 'report';
    rep.textContent = 'Готов.';
    wrap.appendChild(rep);

    this.root.appendChild(wrap);
  }

  section(title, contentFn) {
    const s = document.createElement('div');
    s.className = 'hm-section';
    const t = document.createElement('div');
    t.className = 'hm-section-title';
    t.textContent = title;
    s.appendChild(t);
    const content = contentFn();
    if (content) s.appendChild(content);
    return s;
  }
  grid() {
    const g = document.createElement('div');
    g.className = 'hm-grid';
    return g;
  }
  field(label, id, type, value, opts) {
    const l = document.createElement('label');
    l.className = 'hm-field';
    const span = document.createElement('span');
    span.textContent = label;
    l.appendChild(span);

    let input;
    if (type === 'select') {
      input = document.createElement('select');
      for (const [v, txt] of (opts.options || [])) {
        const o = document.createElement('option');
        o.value = v; o.textContent = txt;
        input.appendChild(o);
      }
      input.value = value;
    } else if (type === 'checkbox') {
      input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = !!value;
    } else {
      input = document.createElement('input');
      input.type = type;
      input.value = value;
      if (opts.min != null) input.min = opts.min;
      if (opts.max != null) input.max = opts.max;
      if (opts.step != null) input.step = opts.step;
    }
    input.id = id;
    l.appendChild(input);
    return l;
  }
  btnRow(btns) {
    const row = document.createElement('div');
    row.className = 'hm-btnrow';
    for (const b of btns) {
      const el = document.createElement('button');
      el.id = b.id;
      el.textContent = b.text;
      if (b.cls) el.classList.add(b.cls);
      el.addEventListener('click', b.onClick);
      row.appendChild(el);
    }
    return row;
  }

  status(text, cls) {
    const rep = document.getElementById('hm_report');
    if (!rep) return;
    rep.innerHTML = cls ? '<span class="' + cls + '">' + text + '</span>' : text;
  }

  updatePngStatus() {
    const el = document.getElementById('hm_pngStatus');
    if (!el) return;
    el.textContent = this.importedPNG
      ? 'PNG: ' + this.importedPNG.name + ' (' + this.importedPNG.w + '×' + this.importedPNG.h + ')'
      : 'PNG не загружен';
  }

  collectOpts() {
    const num = id => parseFloat(document.getElementById(id).value) || 0;
    const int = id => parseInt(document.getElementById(id).value, 10) || 0;
    const str = id => document.getElementById(id).value;
    const chk = id => document.getElementById(id).checked;
    return {
      w: int('hm_w'), h: int('hm_h'), levels: int('hm_levels'),
      flatten: int('hm_flatten'),
      noiseScale: int('hm_nscale'), octaves: int('hm_oct'),
      flatPct: num('hm_flat'),
      edgeBias: num('hm_edge'), edgePow: num('hm_edgepow'),
      symmetry: str('hm_sym'), symStrength: num('hm_symstr'),
      passes: int('hm_passes'), passWidth: int('hm_pw'), passLength: int('hm_plen'),
      seed: int('hm_seed'),
      riversOn: chk('hm_rivOn'),
      riverSmooth: num('hm_rivSmooth'),
    };
  }

  doGenerate() {
    const opts = this.collectOpts();
    if (opts.w < 2 || opts.h < 2) { this.status('W/H слишком малы', 'err'); return; }

    let level, w, h, levels, floorIdx;

    if (this.importedPNG && this.importedPNG.w === opts.w && this.importedPNG.h === opts.h) {
      levels = opts.levels;
      w = opts.w; h = opts.h;
      level = new Uint8Array(this.importedPNG.level);
      floorIdx = Math.max(0, levels - 1 - opts.flatten);
      for (let i = 0; i < level.length; i++)
        if (level[i] >= floorIdx) level[i] = floorIdx;
    } else {
      const res = HM.generate(opts);
      level = res.level; w = res.w; h = res.h;
      levels = res.levels; floorIdx = res.floorIdx;
    }

    if (opts.riversOn && this.rivers.length) {
      HM.carveRivers(level, w, h, floorIdx, this.rivers.map(r => ({
        points: r.points, smooth: opts.riverSmooth
      })));
    }

    this.level = { level, w, h, levels, floorIdx };
    this.renderPreview();
    this.status('GENERATE ok · ' + w + '×' + h + ' · уровней ' + levels);
  }

  addAutoRiver() {
    if (!this.level) { this.status('Сначала GENERATE', 'err'); return; }
    const { w, h } = this.level;
    const horiz = Math.random() < 0.5;
    const pts = [];
    const N = 4;
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const baseX = horiz ? Math.round(t * (w - 1)) : Math.round((0.5 + (t - 0.5) * 0.4) * w);
      const baseY = horiz ? Math.round((0.5 + (t - 0.5) * 0.4) * h) : Math.round(t * (h - 1));
      const jitterX = horiz ? 0 : Math.round((Math.random() - 0.5) * w * 0.15);
      const jitterY = horiz ? Math.round((Math.random() - 0.5) * h * 0.15) : 0;
      pts.push({
        x: Math.max(0, Math.min(w - 1, baseX + jitterX)),
        y: Math.max(0, Math.min(h - 1, baseY + jitterY)),
        width: 4 + Math.random() * 3,
        tension: 0.5,
      });
    }
    this.rivers.push({ points: pts });
    this.renderPreview();
    this.status('Добавлена река #' + this.rivers.length);
  }

  doGeneratePoints() {
    if (!this.level) { this.status('Сначала GENERATE', 'err'); return; }
    const num = id => parseFloat(document.getElementById(id).value) || 0;
    const opts = {
      level: this.level.level, w: this.level.w, h: this.level.h,
      levels: this.level.levels,
      players: parseInt(document.getElementById('hm_aP').value, 10) || 2,
      homePerPlayer: parseInt(document.getElementById('hm_aK').value, 10) || 0,
      frontPts: parseInt(document.getElementById('hm_aF').value, 10) || 0,
      spread: num('hm_aspr'),
      edgePct: num('hm_aedge') / 100,
      heightMargin: num('hm_aheight'),
      seed: parseInt(document.getElementById('hm_seed').value, 10) || 0,
    };
    const res = HM.generatePoints(opts);
    this.points = res;
    this.renderPreview();
    this.status('POINTS: ' + res.starts.length + ' стартов, ' + res.respools.length + ' respools');
  }

  renderPreview() {
    const cv = this.previewCanvas;
    if (!cv) return;
    if (!this.level) {
      const g = cv.getContext('2d');
      g.fillStyle = '#000';
      g.fillRect(0, 0, cv.width, cv.height);
      return;
    }
    const { level, w, h, levels } = this.level;
    cv.width = w;
    cv.height = h;
    const img = HM.levelToImageData(level, w, h, levels);
    cv.getContext('2d').putImageData(img, 0, 0);

    const g = cv.getContext('2d');
    if (this.points) {
      for (const s of this.points.starts) {
        g.fillStyle = s.team === 1 ? '#44ee44' : '#ee4444';
        g.strokeStyle = '#000';
        g.lineWidth = 1;
        g.beginPath(); g.arc(s.x, s.y, 4, 0, Math.PI*2);
        g.fill(); g.stroke();
      }
      for (const p of this.points.respools) {
        g.fillStyle = 'rgba(255,240,120,0.95)';
        g.strokeStyle = '#000';
        g.beginPath(); g.arc(p.x, p.y, 2, 0, Math.PI*2);
        g.fill(); g.stroke();
      }
    }

    const maxSide = 256;
    const scale = Math.min(maxSide / w, maxSide / h, 1);
    cv.style.width = Math.round(w * scale) + 'px';
    cv.style.height = Math.round(h * scale) + 'px';
  }

  doApply() {
    if (!this.level) { this.status('Сначала GENERATE', 'err'); return; }
    const mapModel = this.ctx.getMap();
    const typesModel = this.ctx.getTypesModel();
    const generator = this.ctx.getGenerator();
    if (!mapModel) { this.status('Нет карты', 'err'); return; }

    const targetLayer = document.getElementById('hm_target').value.trim() || 'Ground';
    const edgeLayer   = document.getElementById('hm_edgeLayer').value.trim() || 'Items0';

    const res = HM.applyToMap({
      mapModel, typesModel, generator,
      level: this.level.level,
      w: this.level.w, h: this.level.h,
      levels: this.level.levels,
      targetLayer, edgeLayer
    });
    if (!res.ok) { this.status('APPLY: ' + res.error, 'err'); return; }

    HM.commitToUndo(mapModel, res);
    const r = this.ctx.getRenderer();
    if (r) { r.invalidate(); r.render(); }
    this.status('APPLY ok: ' + res.changesTarget.length + ' клеток в ' +
      targetLayer + ', ' + res.changesEdge.length + ' в ' + edgeLayer);
  }
}

// ═══════════════════════════════════════════════
// 3D PANEL
//
// HEIGHT SOURCE: Generator/PNG — ИЛИ — Ground layer
// COLOR MODE:    Map texture / palette / grayscale / PNG-file
// MARKERS:       включается чекбоксом showMarkers в топбаре
// ═══════════════════════════════════════════════
class HMView3DPanel {
  constructor(rootEl, ctx) {
    this.root = rootEl;
    this.ctx = ctx;
    this.canvas = null;
    this.pngRGBA = null;
    this.pngW = 0; this.pngH = 0;
    this._texCache = new Map();
    this._lastSourceInfo = '';
  }

  build() {
    this.root.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'hm-panel';

    wrap.appendChild(this.section('SOURCE', () => {
      const g = document.createElement('div');
      g.className = 'hm-grid';

      g.appendChild(this.select('HEIGHT SOURCE', 'v3_heightSrc', 'generator', [
        ['generator', 'Generator / PNG'],
        ['ground',    'Ground layer']
      ]));

      g.appendChild(this.select('COLOR MODE', 'v3_colorMode', 'texture', [
        ['texture', 'Map texture (screenshot)'],
        ['palette', 'Classic palette'],
        ['gray',    'Grayscale'],
        ['png',     'Imported PNG file']
      ]));

      const l2 = document.createElement('label');
      l2.className = 'hm-field';
      l2.innerHTML = '<span>PNG (для color=PNG)</span>';
      const png = document.createElement('input');
      png.type = 'file'; png.id = 'v3_pngFile';
      png.accept = 'image/*';
      png.addEventListener('change', async (e) => {
        const f = e.target.files[0];
        if (!f) return;
        try {
          const map = this.ctx.getMap();
          if (!map) throw new Error('Нет карты');
          this.pngRGBA = await RW.HM.importPNG_RGBA(f, map.W, map.H);
          this.pngW = map.W; this.pngH = map.H;
          this.status('PNG загружен (' + map.W + '×' + map.H + ')');
        } catch (err) {
          this.status('Ошибка PNG: ' + err.message);
        }
        e.target.value = '';
      });
      l2.appendChild(png);
      g.appendChild(l2);

      g.appendChild(this.slider('CELL', 'v3_cell', 1, 8, 0.5, 3));
      g.appendChild(this.slider('HEIGHT PX', 'v3_height', 10, 300, 5, 90));
      return g;
    }));

    wrap.appendChild(this.btnRow([
      { id: 'v3_render', text: 'RENDER 3D', cls: 'primary', onClick: () => this.doRender() },
      { id: 'v3_dl', text: 'DOWNLOAD PNG', onClick: () => this.doDownload() },
    ]));

    const body = document.createElement('div');
    body.style.background = '#0b0d11';
    body.style.border = '1px solid #222833';
    body.style.borderRadius = '8px';
    body.style.padding = '8px';
    body.style.display = 'flex';
    body.style.justifyContent = 'center';
    body.style.alignItems = 'center';
    body.style.minHeight = '300px';
    body.style.overflow = 'auto';

    const cv = document.createElement('canvas');
    cv.id = 'v3_canvas';
    cv.width = 10; cv.height = 10;
    cv.style.maxWidth = '100%';
    cv.style.maxHeight = '80vh';
    body.appendChild(cv);
    this.canvas = cv;
    wrap.appendChild(body);

    const status = document.createElement('div');
    status.id = 'v3_status';
    status.style.fontSize = '11px';
    status.style.color = '#8cf';
    status.style.margin = '6px 0';
    status.textContent = 'Ready.';
    wrap.appendChild(status);

    this.root.appendChild(wrap);
  }

  section(title, contentFn) {
    const s = document.createElement('div');
    s.className = 'hm-section';
    const t = document.createElement('div');
    t.className = 'hm-section-title';
    t.textContent = title;
    s.appendChild(t);
    const content = contentFn();
    if (content) s.appendChild(content);
    return s;
  }
  select(label, id, value, opts) {
    const l = document.createElement('label');
    l.className = 'hm-field';
    l.innerHTML = '<span>' + label + '</span>';
    const sel = document.createElement('select');
    sel.id = id;
    for (const [v, txt] of opts) {
      const o = document.createElement('option');
      o.value = v; o.textContent = txt;
      sel.appendChild(o);
    }
    sel.value = value;
    l.appendChild(sel);
    return l;
  }
  slider(label, id, min, max, step, value) {
    const l = document.createElement('label');
    l.className = 'hm-field';
    l.innerHTML = '<span>' + label + '</span>';
    const inp = document.createElement('input');
    inp.type = 'range';
    inp.id = id;
    inp.min = min; inp.max = max; inp.step = step; inp.value = value;
    l.appendChild(inp);
    return l;
  }
  btnRow(btns) {
    const row = document.createElement('div');
    row.className = 'hm-btnrow';
    for (const b of btns) {
      const el = document.createElement('button');
      el.id = b.id;
      el.textContent = b.text;
      if (b.cls) el.classList.add(b.cls);
      el.addEventListener('click', b.onClick);
      row.appendChild(el);
    }
    return row;
  }
  status(t) {
    const s = document.getElementById('v3_status');
    if (s) s.textContent = t;
  }

  // ─────────────────────────────────────────────
  // СКРИНШОТ КАРТЫ: 1 пиксель на тайл.
  //
  // Композитинг снизу вверх по всем видимым слоям:
  //   result = sample * a + result * (1 - a)
  //
  // Цвет и альфа тайла — средневзвешенные по альфе пиксели
  // (это даёт корректный downscale тайла 20×20 → 1×1 с
  // сохранением полупрозрачности). Decor-тайлы с
  // крапинками становятся полупрозрачным налётом,
  // а не сплошной плашкой.
  // ─────────────────────────────────────────────
  grabMapTexture() {
    const map = this.ctx.getMap();
    const r = this.ctx.getRenderer();
    if (!map || !r) return null;

    const w = map.W, h = map.H;
    const data = new Uint8ClampedArray(w * h * 4);
    const visibleLayers = map.layerOrder.filter(n => r.isLayerVisible(n));

    const tileAvg = (id) => {
      const cached = this._texCache.get(id);
      if (cached) return cached;
      const ts = r.findTileset(id);
      if (!ts || !ts.image) {
        const v = { r: 40, g: 40, b: 40, a: 1 };
        this._texCache.set(id, v);
        return v;
      }
      const localID = id - ts.firstgid;
      const col = localID % ts.columns;
      const row = Math.floor(localID / ts.columns);
      const tw = ts.tileW, th = ts.tileH;

      const oc = document.createElement('canvas');
      oc.width = tw; oc.height = th;
      const og = oc.getContext('2d', { willReadFrequently: true });
      og.drawImage(ts.image,
        col * tw, row * th, tw, th,
        0, 0, tw, th);
      const px = og.getImageData(0, 0, tw, th).data;

      let sr = 0, sg = 0, sb = 0, sa = 0;
      const n = tw * th;
      for (let i = 0; i < n; i++) {
        const a = px[i*4+3];
        if (a === 0) continue;
        sr += px[i*4]   * a;
        sg += px[i*4+1] * a;
        sb += px[i*4+2] * a;
        sa += a;
      }
      let v;
      if (sa === 0) {
        v = { r: 0, g: 0, b: 0, a: 0 };
      } else {
        v = {
          r: sr / sa,
          g: sg / sa,
          b: sb / sa,
          a: sa / (n * 255)
        };
      }
      this._texCache.set(id, v);
      return v;
    };

    const BG = { r: 10, g: 10, b: 10 };

    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      let cr = BG.r, cg = BG.g, cb = BG.b;

      for (let li = 0; li < visibleLayers.length; li++) {
        const id = map.layers[visibleLayers[li]][idx];
        if (!id) continue;
        const t = tileAvg(id);
        const a = t.a;
        if (a <= 0) continue;
        if (a >= 1) {
          cr = t.r; cg = t.g; cb = t.b;
          continue;
        }
        cr = t.r * a + cr * (1 - a);
        cg = t.g * a + cg * (1 - a);
        cb = t.b * a + cb * (1 - a);
      }

      data[idx*4]   = cr;
      data[idx*4+1] = cg;
      data[idx*4+2] = cb;
      data[idx*4+3] = 255;
    }

    return data;
  }

  doRender() {
    const mapModel = this.ctx.getMap();
    const heightSrc = document.getElementById('v3_heightSrc').value;
    const colorMode = document.getElementById('v3_colorMode').value;

    let w, h, levels, getLevel;
    let diag = '';

    if (heightSrc === 'generator') {
      const genLevel = this.ctx.getGeneratorLevel ? this.ctx.getGeneratorLevel() : null;
      if (!genLevel) {
        this.status('Генератор пуст — нажми GENERATE во вкладке GENERATOR');
        return;
      }
      w = genLevel.w; h = genLevel.h; levels = genLevel.levels;
      const lv = genLevel.level;
      getLevel = (x, y) => {
        if (x < 0 || y < 0 || x >= w || y >= h) return levels - 1;
        return lv[y * w + x];
      };
      const minMax = this.minMax(lv);
      diag = 'h=generator ' + w + '×' + h + ' lv=' + levels +
             ' min=' + minMax[0] + ' max=' + minMax[1];
    } else {
      if (!mapModel) { this.status('Нет карты'); return; }
      const ground = mapModel.layers.Ground;
      if (!ground) { this.status('Нет слоя Ground'); return; }

      const typesModel = this.ctx.getTypesModel();
      const typesByPrio = [...typesModel.types].sort((a, b) => b.priority - a.priority);
      const idToLevel = new Map();
      typesByPrio.forEach((t, i) => {
        for (const s of t.solids) idToLevel.set(s.tileID, i);
      });
      const allIds = new Set();
      for (let i = 0; i < ground.length; i++) {
        const id = ground[i];
        if (id) allIds.add(id);
      }
      const sortedIds = Array.from(allIds).sort((a, b) => a - b);
      const idFallback = new Map();
      sortedIds.forEach((id, i) => idFallback.set(id, i));

      const useFallback = typesByPrio.length === 0 || idToLevel.size === 0;
      levels = Math.max(typesByPrio.length, sortedIds.length) || 1;
      const maxLvl = Math.max(1, levels - 1);

      getLevel = (x, y) => {
        if (x < 0 || y < 0 || x >= mapModel.W || y >= mapModel.H) return maxLvl;
        const id = ground[y * mapModel.W + x];
        if (!id) return maxLvl;
        const lv = useFallback ? idFallback.get(id) : idToLevel.get(id);
        if (lv == null) return useFallback ? 0 : maxLvl;
        return lv;
      };
      w = mapModel.W; h = mapModel.H;
      diag = 'h=ground ' + w + '×' + h + (useFallback ? ' [fallback]' : '');
    }

    const cell = parseFloat(document.getElementById('v3_cell').value) || 3;
    const heightPx = parseFloat(document.getElementById('v3_height').value) || 90;

    let texture = null;
    let pngData = null;
    if (colorMode === 'texture') {
      if (mapModel && w === mapModel.W && h === mapModel.H) {
        texture = this.grabMapTexture();
        diag += ' | tex=map';
      } else {
        diag += ' | tex=none (size mismatch)';
      }
    } else if (colorMode === 'png') {
      if (this.pngRGBA && this.pngW === w && this.pngH === h) {
        pngData = this.pngRGBA;
        diag += ' | png';
      } else {
        diag += ' | png=none';
      }
    }

    // ─── MARKERS ───
    let markers = null;
    const showMarkers = document.getElementById('showMarkers');
    if (showMarkers && showMarkers.checked && RW.Markers) {
      if (mapModel && w === mapModel.W && h === mapModel.H) {
        markers = RW.Markers.find(mapModel);
        diag += ' | markers=' + (markers.starts.length + markers.respools.length);
      } else {
        diag += ' | markers=skip (size mismatch)';
      }
    }

    RW.View3D.render({
      canvas: this.canvas,
      w, h, levels,
      getLevel,
      colorMode,
      pngData,
      texture,
      cell, heightPx,
      markers
    });
    this._lastSourceInfo = diag;
    this.status('OK · ' + this.canvas.width + '×' + this.canvas.height + ' · ' + diag);
  }

  minMax(arr) {
    let mn = 255, mx = 0;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] < mn) mn = arr[i];
      if (arr[i] > mx) mx = arr[i];
    }
    return [mn, mx];
  }

  doDownload() {
    if (!this.canvas) return;
    this.canvas.toBlob(b => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = 'view3d.png';
      a.click();
      URL.revokeObjectURL(a.href);
    }, 'image/png');
  }
}

RW.HMGeneratorPanel = HMGeneratorPanel;
RW.HMView3DPanel = HMView3DPanel;
})(window.RWEditor = window.RWEditor || {});