(function(RW){
'use strict';

const DEFAULT_PATH = 'asset/miniTNS/';
const INI_NAME = 'minitns.ini';
const LS_KEY = 'rweditor.minitns.path';

let modalEl = null;
let gridEl = null;
let statusEl = null;
let pathInputEl = null;
let onPickCb = null;
let entries = [];
let loaded = false;
let loading = false;
let currentPath = localStorage.getItem(LS_KEY) || DEFAULT_PATH;

function parseIni(text) {
  const out = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    const name = parts[0];
    const prio = parseInt(parts[1], 10);
    out.push({ name, priority: isNaN(prio) ? 0 : prio });
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

async function testPath(base) {
  const url = joinPath(base, INI_NAME);
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) {
      return { ok: false, url, msg: 'HTTP ' + res.status + ' ' + res.statusText };
    }
    const text = await res.text();
    const list = parseIni(text);
    if (!list.length) {
      return { ok: false, url, msg: 'ini пустой (нет строк вида "Name Priority")' };
    }
    return { ok: true, url, count: list.length, sample: list.slice(0, 3).map(e => e.name).join(', ') };
  } catch (err) {
    return { ok: false, url, msg: err.message || 'network error' };
  }
}

async function loadLibrary() {
  if (loading) return;
  loading = true;
  try {
    const url = joinPath(currentPath, INI_NAME);
    setStatus('Loading: ' + url, 'warn');

    const iniRes = await fetch(url, { cache: 'no-cache' });
    if (!iniRes.ok) throw new Error('ini → HTTP ' + iniRes.status + ' (' + url + ')');

    const list = parseIni(await iniRes.text());
    if (!list.length) throw new Error('ini пустой: ' + url);

    entries = [];
    let skipped = 0;
    for (const e of list) {
      try {
        const pngUrl = joinPath(currentPath, e.name + '.png');
        const b64 = await fetchB64(pngUrl);
        const dataUrl = 'data:image/png;base64,' + b64;
        const img = await new Promise((resolve, reject) => {
          const i = new Image();
          i.onload = () => resolve(i);
          i.onerror = () => reject(new Error('img decode'));
          i.src = dataUrl;
        });
        entries.push({ name: e.name, priority: e.priority, img, dataUrl, b64 });
      } catch (err) {
        skipped++;
        console.warn('MiniTNS skip:', e.name, err);
      }
    }

    loaded = true;
    localStorage.setItem(LS_KEY, currentPath);

    if (!entries.length) {
      setStatus('Найдено 0 PNG. Проверь, что файлы лежат в ' + currentPath, 'err');
    } else {
      setStatus('Загружено ' + entries.length + ' из ' + list.length +
        (skipped ? ' (пропущено ' + skipped + ')' : ''), 'ok');
    }
  } finally {
    loading = false;
  }
}

function ensureModal() {
  if (modalEl) return;

  modalEl = document.createElement('div');
  modalEl.id = 'miniLibModal';
  modalEl.className = 'hidden';

  const dialog = document.createElement('div');
  dialog.className = 'mini-lib-dialog';

  // ─── header ───
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

  // ─── path bar ───
  const pathBar = document.createElement('div');
  pathBar.className = 'mini-lib-pathbar';

  const pathLbl = document.createElement('span');
  pathLbl.className = 'mini-lib-path-lbl';
  pathLbl.textContent = 'PATH';
  pathBar.appendChild(pathLbl);

  pathInputEl = document.createElement('input');
  pathInputEl.type = 'text';
  pathInputEl.className = 'mini-lib-path-input';
  pathInputEl.value = currentPath;
  pathInputEl.spellcheck = false;
  pathInputEl.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); doReload(); }
  });
  pathBar.appendChild(pathInputEl);

  const testBtn = document.createElement('button');
  testBtn.className = 'mini-lib-path-btn';
  testBtn.textContent = 'TEST';
  testBtn.addEventListener('click', doTest);
  pathBar.appendChild(testBtn);

  const reloadBtn = document.createElement('button');
  reloadBtn.className = 'mini-lib-path-btn primary';
  reloadBtn.textContent = 'LOAD';
  reloadBtn.addEventListener('click', doReload);
  pathBar.appendChild(reloadBtn);

  dialog.appendChild(pathBar);

  // ─── body ───
  const body = document.createElement('div');
  body.className = 'mini-lib-body';
  gridEl = document.createElement('div');
  gridEl.className = 'mini-lib-grid';
  body.appendChild(gridEl);
  dialog.appendChild(body);

  // ─── status ───
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

async function doTest() {
  const base = pathInputEl.value.trim() || DEFAULT_PATH;
  setStatus('Testing: ' + joinPath(base, INI_NAME), 'warn');
  const r = await testPath(base);
  if (r.ok) {
    setStatus('✓ ' + r.url + ' — OK, ' + r.count + ' записей (' + r.sample + ')', 'ok');
  } else {
    setStatus('✗ ' + r.url + ' — ' + r.msg, 'err');
  }
}

async function doReload() {
  currentPath = pathInputEl.value.trim() || DEFAULT_PATH;
  loaded = false;
  entries = [];
  renderGrid();
  try {
    await loadLibrary();
    renderGrid();
  } catch (err) {
    console.error(err);
    setStatus('Ошибка: ' + err.message, 'err');
    renderGrid();
  }
}

function setStatus(text, cls) {
  if (!statusEl) return;
  statusEl.innerHTML = cls ? '<span class="' + cls + '">' + text + '</span>' : text;
}

function renderGrid() {
  if (!gridEl) return;
  gridEl.innerHTML = '';
  if (!entries.length) {
    const em = document.createElement('div');
    em.className = 'mini-lib-empty';
    em.textContent = loaded ? 'Library пустая' : 'Нажми LOAD или TEST';
    gridEl.appendChild(em);
    return;
  }

  for (const e of entries) {
    const item = document.createElement('div');
    item.className = 'mini-lib-item';
    item.title = e.name + ' · priority ' + e.priority;

    const cnv = document.createElement('canvas');
    cnv.width = 120;
    cnv.height = 200;
    cnv.className = 'mini-lib-preview';
    const g = cnv.getContext('2d');
    g.imageSmoothingEnabled = false;
    const iw = e.img.naturalWidth, ih = e.img.naturalHeight;
    const s = Math.min(120 / iw, 200 / ih);
    const dw = Math.round(iw * s);
    const dh = Math.round(ih * s);
    const dx = Math.floor((120 - dw) / 2);
    const dy = Math.floor((200 - dh) / 2);
    g.drawImage(e.img, 0, 0, iw, ih, dx, dy, dw, dh);
    item.appendChild(cnv);

    const nameEl = document.createElement('div');
    nameEl.className = 'mini-lib-name';
    nameEl.textContent = e.name;
    item.appendChild(nameEl);

    const prioEl = document.createElement('div');
    prioEl.className = 'mini-lib-prio';
    prioEl.textContent = 'P' + e.priority;
    item.appendChild(prioEl);

    item.addEventListener('click', () => {
      if (onPickCb) onPickCb(e);
    });

    gridEl.appendChild(item);
  }
}

function open(cb) {
  onPickCb = cb;
  ensureModal();
  modalEl.classList.remove('hidden');
  pathInputEl.value = currentPath;

  if (loaded) {
    renderGrid();
    return;
  }

  // авто-test при открытии, потом auto-load если test прошёл
  (async () => {
    setStatus('Проверка пути: ' + joinPath(currentPath, INI_NAME), 'warn');
    const r = await testPath(currentPath);
    if (!r.ok) {
      setStatus('✗ ' + r.url + ' — ' + r.msg +
        ' · измени PATH и нажми TEST', 'err');
      renderGrid();
      return;
    }
    setStatus('Найдено ' + r.count + ' записей, загрузка...', 'warn');
    try {
      await loadLibrary();
      renderGrid();
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
  currentPath: () => currentPath
};

})(window.RWEditor = window.RWEditor || {});