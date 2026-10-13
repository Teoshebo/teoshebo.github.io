(function(RW){
'use strict';

const CANDIDATE_PATHS = [
  'asset/miniTNS/',
  'https://teoshebo.github.io/asset/miniTNS/'
];
const INI_NAME = 'minitns.ini';

// Разрешённые properties для solid-тайлов MiniTNS.
// Всё остальное из ini игнорируется.
const ALLOWED_PROPS = new Set([
  'water',
  'water-bridge',
  'large-cliff',
  'large-rock',
  'lava'
]);

let modalEl = null;
let gridEl = null;
let statusEl = null;
let searchInputEl = null;
let sortBtnEl = null;
let tagsBarEl = null;
let onPickCb = null;
let entries = [];
let loaded = false;
let loading = false;
let activePath = CANDIDATE_PATHS[0];

let searchQuery = '';
let sortAsc = true;
let activeTags = new Set();

// ─── Парсер ini ───
// Формат: name priority [tags] [properties]
//   tags       — "rock,stone"
//   properties — "water,team=0,unit=commandCenter"
// Сокращение: name 5 X — если X содержит '=', это props, иначе теги.
// В properties попадают ТОЛЬКО ключи из ALLOWED_PROPS.
function parseIni(text) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (!parts.length) continue;
    const name = parts[0];
    const prio = parseInt(parts[1], 10);

    let tagsTok = '';
    let propsTok = '';

    if (parts.length >= 4) {
      tagsTok = parts[2] || '';
      propsTok = parts.slice(3).join(' ');
    } else if (parts.length === 3) {
      if (parts[2].indexOf('=') >= 0) {
        propsTok = parts[2];
      } else {
        tagsTok = parts[2];
      }
    }

    const tags = tagsTok
      ? tagsTok.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    const properties = {};
    if (propsTok) {
      for (const tok of propsTok.split(',')) {
        const t = tok.trim();
        if (!t) continue;
        const eq = t.indexOf('=');
        let k, v;
        if (eq >= 0) {
          k = t.slice(0, eq).trim();
          v = t.slice(eq + 1).trim();
        } else {
          k = t;
          v = '';
        }
        if (!k) continue;
        if (!ALLOWED_PROPS.has(k)) continue;
        properties[k] = v;
      }
    }

    out.push({
      name,
      priority: isNaN(prio) ? 0 : prio,
      tags,
      properties
    });
  }
  return out;
}

async function fetchB64(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const buf = await res.arrayBuffer();
  return RW.Utils.bytesToB64(new Uint8Array(buf));
}

function joinPath(base, name) {
  if (!base.endsWith('/')) base += '/';
  return base + name;
}

// Проверка пустого тайла PNG: все пиксели alpha=0
function isTileEmpty(img, tw, th, col, row) {
  const cv = document.createElement('canvas');
  cv.width = tw; cv.height = th;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, tw, th);
  ctx.drawImage(img, col*tw, row*th, tw, th, 0, 0, tw, th);
  const data = ctx.getImageData(0, 0, tw, th).data;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) return false;
  }
  return true;
}

async function resolvePath() {
  for (const base of CANDIDATE_PATHS) {
    const url = joinPath(base, INI_NAME);
    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (!res.ok) continue;
      const text = await res.text();
      const list = parseIni(text);
      if (!list.length) continue;
      return { base, url, list };
    } catch (err) {
      // пробуем следующий
    }
  }
  return null;
}

async function loadLibrary() {
  if (loading) return;
  loading = true;
  try {
    setStatus('Поиск minitns.ini...', 'warn');

    const resolved = await resolvePath();
    if (!resolved) {
      throw new Error('minitns.ini не найден ни по одному пути: ' +
        CANDIDATE_PATHS.join(' · '));
    }
    activePath = resolved.base;
    setStatus('Источник: ' + activePath + ' — загрузка PNG...', 'warn');

    entries = [];
    let skipped = 0;
    for (const e of resolved.list) {
      try {
        const pngUrl = joinPath(activePath, e.name + '.png');
        const b64 = await fetchB64(pngUrl);
        const dataUrl = 'data:image/png;base64,' + b64;
        const img = await new Promise((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = () => reject(new Error('img decode'));
          i.src = dataUrl;
        });
        entries.push({
          name: e.name,
          priority: e.priority,
          tags: e.tags,
          properties: e.properties,
          img,
          dataUrl,
          b64,
          _solidCanvas: null
        });
      } catch (err) {
        skipped++;
        console.warn('MiniTNS skip:', e.name, err);
      }
    }

    loaded = true;

    if (!entries.length) {
      setStatus('Найдено 0 PNG по пути ' + activePath, 'err');
    } else {
      setStatus('Загружено ' + entries.length + ' из ' + resolved.list.length +
        (skipped ? ' (пропущено ' + skipped + ')' : '') +
        ' · ' + activePath, 'ok');
    }
  } finally {
    loading = false;
  }
}

// ── Solid-превью: рендерим local 4 (solid) один раз ──
function getSolidCanvas(entry) {
  if (entry._solidCanvas) return entry._solidCanvas;
  const cv = document.createElement('canvas');
  cv.width = 120;
  cv.height = 200;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const img = entry.img;
  const realTw = Math.round(img.naturalWidth / 3);
  const realTh = Math.round(img.naturalHeight / 5);
  const sx = 1 * realTw, sy = 1 * realTh;
  const scale = Math.min(120 / realTw, 120 / realTh);
  const dw = Math.round(realTw * scale);
  const dh = Math.round(realTh * scale);
  const dx = Math.floor((120 - dw) / 2);
  const dy = Math.floor((200 - dh) / 2);
  g.drawImage(img, sx, sy, realTw, realTh, dx, dy, dw, dh);
  entry._solidCanvas = cv;
  return cv;
}

function getFullCanvas(entry) {
  const cv = document.createElement('canvas');
  cv.width = 120;
  cv.height = 200;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const img = entry.img;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const s = Math.min(120 / iw, 200 / ih);
  const dw = Math.round(iw * s);
  const dh = Math.round(ih * s);
  const dx = Math.floor((120 - dw) / 2);
  const dy = Math.floor((200 - dh) / 2);
  g.drawImage(img, 0, 0, iw, ih, dx, dy, dw, dh);
  return cv;
}

function ensureModal() {
  if (modalEl) return;

  modalEl = document.createElement('div');
  modalEl.id = 'miniLibModal';
  modalEl.className = 'hidden';

  const dialog = document.createElement('div');
  dialog.className = 'mini-lib-dialog';

  // header
  const header = document.createElement('div');
  header.className = 'mini-lib-header';
  const ttl = document.createElement('span');
  ttl.textContent = 'MINI TNS LIBRARY';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.title = 'Close';
  closeBtn.addEventListener('click', close);
  header.append(ttl, closeBtn);
  dialog.appendChild(header);

  // filter bar (search + sort)
  const filterBar = document.createElement('div');
  filterBar.className = 'mini-lib-filterbar';

  searchInputEl = document.createElement('input');
  searchInputEl.type = 'text';
  searchInputEl.className = 'mini-lib-search';
  searchInputEl.placeholder = 'Search by name...';
  searchInputEl.spellcheck = false;
  searchInputEl.addEventListener('input', () => {
    searchQuery = searchInputEl.value.trim().toLowerCase();
    renderGrid();
  });
  searchInputEl.addEventListener('keydown', (e) => e.stopPropagation());
  filterBar.appendChild(searchInputEl);

  sortBtnEl = document.createElement('button');
  sortBtnEl.className = 'mini-lib-sort';
  sortBtnEl.textContent = 'Name ▲';
  sortBtnEl.title = 'Sort by name';
  sortBtnEl.addEventListener('click', () => {
    sortAsc = !sortAsc;
    sortBtnEl.textContent = sortAsc ? 'Name ▲' : 'Name ▼';
    renderGrid();
  });
  filterBar.appendChild(sortBtnEl);

  dialog.appendChild(filterBar);

  // body
  const body = document.createElement('div');
  body.className = 'mini-lib-body';
  gridEl = document.createElement('div');
  gridEl.className = 'mini-lib-grid';
  body.appendChild(gridEl);
  dialog.appendChild(body);

  // tags bar
  tagsBarEl = document.createElement('div');
  tagsBarEl.className = 'mini-lib-tagsbar';
  dialog.appendChild(tagsBarEl);

  // status
  statusEl = document.createElement('div');
  statusEl.className = 'mini-lib-status';
  statusEl.textContent = 'Ready.';
  dialog.appendChild(statusEl);

  modalEl.appendChild(dialog);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) close();
  });

  document.body.appendChild(modalEl);
}

function setStatus(text, cls) {
  if (!statusEl) return;
  statusEl.innerHTML = cls ? '<span class="' + cls + '">' + text + '</span>' : text;
}

function getFilteredEntries() {
  let list = entries.slice();
  if (searchQuery) list = list.filter(e => e.name.toLowerCase().includes(searchQuery));
  if (activeTags.size) {
    list = list.filter(e => e.tags.some(t => activeTags.has(t)));
  }
  list.sort((a, b) => sortAsc
    ? a.name.localeCompare(b.name)
    : b.name.localeCompare(a.name));
  return list;
}

function renderGrid() {
  if (!gridEl) return;
  gridEl.innerHTML = '';
  const list = getFilteredEntries();

  if (!list.length) {
    const em = document.createElement('div');
    em.className = 'mini-lib-empty';
    em.textContent = entries.length
      ? 'Ничего не найдено'
      : (loaded ? 'Library пустая' : 'Loading...');
    gridEl.appendChild(em);
    return;
  }

  for (const e of list) {
    const item = document.createElement('div');
    item.className = 'mini-lib-item';
    item.title = e.name + ' · priority ' + e.priority +
      (e.tags.length ? ' · #' + e.tags.join(' #') : '') +
      (Object.keys(e.properties).length
        ? ' · ' + Object.keys(e.properties).join(', ')
        : '');

    const preview = document.createElement('div');
    preview.className = 'mini-lib-preview-wrap';

    const solidCv = getSolidCanvas(e);
    solidCv.className = 'mini-lib-preview mini-lib-preview-solid';
    preview.appendChild(solidCv);

    const fullCv = getFullCanvas(e);
    fullCv.className = 'mini-lib-preview mini-lib-preview-full';
    preview.appendChild(fullCv);

    item.appendChild(preview);

    const nameEl = document.createElement('div');
    nameEl.className = 'mini-lib-name';
    nameEl.textContent = e.name;
    item.appendChild(nameEl);

    const prioEl = document.createElement('div');
    prioEl.className = 'mini-lib-prio';
    prioEl.textContent = 'P' + e.priority;
    item.appendChild(prioEl);

    if (e.tags.length) {
      const tagsRow = document.createElement('div');
      tagsRow.className = 'mini-lib-item-tags';
      for (const t of e.tags) {
        const tg = document.createElement('span');
        tg.className = 'mini-lib-item-tag';
        tg.textContent = '#' + t;
        tagsRow.appendChild(tg);
      }
      item.appendChild(tagsRow);
    }

    const propKeys = Object.keys(e.properties || {});
    if (propKeys.length) {
      const propRow = document.createElement('div');
      propRow.className = 'mini-lib-item-props';
      for (const k of propKeys) {
        const pr = document.createElement('span');
        pr.className = 'mini-lib-item-prop';
        pr.textContent = e.properties[k] ? k + '=' + e.properties[k] : k;
        propRow.appendChild(pr);
      }
      item.appendChild(propRow);
    }

    item.addEventListener('click', () => {
      if (onPickCb) onPickCb(e);
    });

    gridEl.appendChild(item);
  }
}

function renderTags() {
  if (!tagsBarEl) return;
  tagsBarEl.innerHTML = '';
  if (!entries.length) return;

  const all = new Set();
  for (const e of entries) for (const t of e.tags) all.add(t);
  if (!all.size) return;

  const label = document.createElement('span');
  label.className = 'mini-lib-tags-label';
  label.textContent = 'TAGS:';
  tagsBarEl.appendChild(label);

  const sorted = Array.from(all).sort();
  for (const t of sorted) {
    const btn = document.createElement('button');
    btn.className = 'mini-lib-tag' + (activeTags.has(t) ? ' active' : '');
    btn.textContent = '#' + t;
    btn.addEventListener('click', () => {
      if (activeTags.has(t)) activeTags.delete(t);
      else activeTags.add(t);
      renderGrid();
      renderTags();
    });
    tagsBarEl.appendChild(btn);
  }

  if (activeTags.size) {
    const clearBtn = document.createElement('button');
    clearBtn.className = 'mini-lib-tag-clear';
    clearBtn.textContent = 'clear';
    clearBtn.addEventListener('click', () => {
      activeTags.clear();
      renderGrid();
      renderTags();
    });
    tagsBarEl.appendChild(clearBtn);
  }
}

function open(cb) {
  onPickCb = cb;
  ensureModal();
  modalEl.classList.remove('hidden');

  if (loaded) {
    renderGrid();
    renderTags();
    return;
  }

  (async () => {
    try {
      await loadLibrary();
      renderGrid();
      renderTags();
    } catch (err) {
      setStatus('Ошибка загрузки: ' + err.message, 'err');
      renderGrid();
    }
  })();
}

function close() {
  if (modalEl) modalEl.classList.add('hidden');
}

RW.MiniTNSLib = {
  open,
  close,
  isLoaded: () => loaded,
  entries: () => entries,
  reload: () => { loaded = false; entries = []; },
  currentPath: () => activePath,
  isTileEmpty,
  ALLOWED_PROPS
};

})(window.RWEditor = window.RWEditor || {});