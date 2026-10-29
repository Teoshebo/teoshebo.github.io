# Changelog

All notable changes to WebTiled are documented here.
Format: patch-level entries under each version line.

---

## [0.6.6] — Фикс TNS Edges

### Fixed
- **`generator.js` → `resolveEdge`**: убрана ошибочная проверка `selfId !== 0`. Вместо неё — проверка `selfType === T`: если клетка уже занята солидом этого же типа, край не рисуется. Исправлено пропадание краёв на застеленной карте.

---

## [0.6.5] — Wall Creator (Void)

### Added
- **`app_paint.js` → `endStroke`**: проверка на проп `void` у солида. Если он есть — изменения слоя `Ground` откатываются, изменения слоя `Items` (стены) остаются.

---

## [0.6.0] — Beta 0.6

### Патч 02.1 — Базовое Зеркало и UTILS
- **`app_tools.js`** (`TOOLS`, `handleToolClick`): добавлены инструменты `GUIDE` и `UTILS`.
- **`app_paint.js` → `App.mirrorArea`**: первая версия зеркала по выделенной области.
- **`app_ui.js` / `webtiled.html`**: кнопки `Resize` и `Ref` перенесены в модалку **UTILS**.

### Патч 02.2 — Каркас Guides
- **`app.js`** (`App.helpers`, `App.guideDrawStart`): добавлен стейт для вспомогательных линий.
- **`render.js` → `_doRender`**: базовая отрисовка линий, прямоугольников, кругов и текста с координатами.
- **`app_input.js`** (`pointerdown` / `move` / `up`): логика создания фигур.

### Патч 02.3–02.5 — Эволюция Зеркала
- **`app_paint.js` → `App.mirrorMap`**: переход от выделения к жёстким половинам карты — режимы `h`, `h_inv`, `v`, `v_inv`, `quad`.
- Добавлена рандомизация солидов (`App.pickWeightedSolid`) при копировании.
- Добавлен пересчёт Classic Autotile и TNS после зеркалирования.

### Патч 03.1–03.2 — Симметрия и Узлы Guides
- **`app_paint.js` → `App.addGuideWithSymmetry`**: создание копий фигур по осям H, V, D, AD.
- **`render.js`** (`drawShape`, `drawHandle`): чёрная обводка и маркеры узлов для выбранной фигуры.
- **`app_input.js`** (`pointerdown` / `move`): логика перетаскивания узлов (углов / концов) фигур.

### Патч 03.3 — Безопасность и Свойства Guides
- **`app_paint.js` → `App.addGuideWithSymmetry`**: добавлен clamp координат (защита от вылета за карту при диагоналях).
- **`app_input.js`** (`keydown`): удаление выбранного гайда по клавише `Delete`.
- **`app_ui.js` / `webtiled.html`**: мини-редактор свойств (X, Y, W, H, Color) для выбранного гайда.

### Патч 03.4 — UI Overhaul (Логи и Навигация)
- **`app.js`** (proxy над `App.statusEl`): перехват логов и вывод в правый нижний угол поверх канваса.
- **`webtiled.html` / `style.css`**: плашка версии (`v0.6(149)`) и лог-консоль (`#logConsole`).
- **`ui.js` → `TilesetTabs.build`**: замена горизонтальных вкладок на стрелки `< >` + выпадающий список.

### Патч 03.5–03.7 — Чистка UI
- **`ui.js` / `types.js`**: переход на выпадающие списки для типов TNS и тайлсетов; кнопка удаления тайлсета перенесена в шапку блока.
- Удалён мёртвый код (старые CSS-классы карточек).

### Патч 03.8–04.0 — Контроллер Вкладок
- **`app_ui.js` → `App.updateBottomTabs`**: единый контроллер вкладок (ATLASES, TYPES, GEN, 3D). На ПК — независимые, на мобилках — радио-режим (одна открыта).
- **`hm_app.js`**: удалён дублирующий обработчик `bindTabs`.

### Патч 04.1–04.3 — TNS Edge Layer & MiniTNS 5th Param
- **`types.js`** (`TypesModel.add`, `toJSON`, `fromJSON`, `buildDetail`): добавлено свойство `edgeLayer` (слой для краёв) и UI-селектор для него.
- **`generator.js`** (`generateRect`, `resolveEdge`): генератор маршрутизирует края в слой, указанный в `edgeLayer` (например, `Items`), и возвращает массив с указанием слоя.
- **`minitns_lib.js` → `parseIni`**: парсер читает 5-й параметр (`large-rock`, `cliff-soft`, `large-cliff`).
- **`app_files.js` → `importMiniTNS`**: при наличии 5-го параметра назначает краевым тайлам это свойство и ставит `edgeLayer = 'Items'`.
- **`app_paint.js` / `hm_apply.js`**: обновлены вызовы `generateRect` под новый формат (group-by-layer для Undo).

### Пи-3 — Фиксы
- **`mirrorMap`** — защита от порчи `Items0`.
- **`HM.commitToUndo`** — поддержка мульти-слоя.
- **Classic-merge** — сохранение самого раннего `before`.
- **`resolveEdge`** — оптимизация, передача `best`.
