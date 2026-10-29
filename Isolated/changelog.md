# Changelog

All notable changes to WebTiled are documented here.
Format: patch-level entries under each version line.

# Changelog

Все значимые изменения в проекте WebTiled.

## [0.7.2] — Фикс видимости кнопки ACCEPT

### Fixed
- **`webtiled.html`**: Кнопке `#btnAcceptWalls` жестко прописан инлайн-стиль `display: none`.
- **`style.css`**: Добавлено правило `#btnAcceptWalls.hidden { display: none !important; }`, блокирующее случайное появление.
- **`app_ui.js`**: Функция `updateAcceptWallsVisibility` теперь напрямую меняет `style.display` (блок/нон), а не полагается только на класс.
- **`app.js`**: В глобальные стейты добавлен `App.pendingVoidChanges = []`. При загрузке новой карты (`initFromParsed`) массив очищается, и вызывается `updateAcceptWallsVisibility`.
- **`app_paint.js`**: В функциях `doUndo` и `doRedo` добавлена очистка `App.pendingVoidChanges` и вызов `updateAcceptWallsVisibility`. Отмененные действия больше не оставляют "висящую" кнопку.

## [0.7.1] — Обновление логики Wall Creator / Accept

### Changed
- **`webtiled.html`**: Кнопка `#btnApplyWalls` заменена на `#btnAcceptWalls` (зеленый стиль, позиция top:60px).
- **`app_paint.js`**: Массив `App.pendingVoidCells` заменен на `App.pendingVoidChanges` (формат `{idx, before, after}`). В `endStroke` при зажатом Shift изменения Ground копятся в этом массиве.
- **`app_ui.js`**: Добавлена функция `App.updateAcceptWallsVisibility()`. Клик по кнопке `btnAcceptWalls` возвращает Ground в исходное состояние, пушит правильный Undo-евент и очищает массив.
- **`app_input.js`**: Обработчики `keydown` и `keyup` для клавиши Shift вызывают `updateAcceptWallsVisibility`.
- **`app_tools.js`**: В `handleToolClick` добавлен вызов `updateAcceptWallsVisibility`.

## [0.7.0] — UX & Logic Overhaul

### Added
- **`app.js`**: Функция `App.setActiveType(id)` — при выборе типа автоматически открывает вкладку ATLASES с нужным тайлсетом.
- **`webtiled.html`**: Скрытая кнопка `#btnApplyWalls` для отложенного применения стен (Wall Creator).
- **`app_paint.js`**: В `endStroke` добавлена логика `Wall Creator (Void)` — при наличии пропа `void` на солиде слой Ground не откатывается сразу, а ждет подтверждения (если зажат Shift).
- **`ui.js` / `types.js`**: Добавлен флаг `_missingTiles` и CSS-класс `.missing-tiles` (желтая подсветка) для типов, у которых были удалены тайлы вместе с атласом.

### Changed
- **`app_paint.js`**: `brushCells` теперь трактует `size` как диаметр (1 = 1 клетка, 2 = 2x2, 3 = 3x3 и т.д.).
- **`app_files.js`**: `importMiniTNS` больше не вызывает `prompt()`. Имя берется из 4-го аргумента `defaultName` или из имени файла.
- **`merge_ui.js`**: На мобильных устройствах превью карт в окне Merge сжимаются сильнее (0.25 вместо 0.5) для экономии памяти.

### Fixed
- **`app_paint.js`**: Исправлена логика `Shift+F` (Type Fill). Теперь заливка использует **активный** тип для покраски, а тип кликнутой клетки — только для определения области.
- **`ui.js`**: При удалении тайлсета (`handleTilesetDelete`) типы очищаются от битых ID солидов и краев.

## [0.6.14] — Умная очистка краев при отсутствии доминирующего типа

### Fixed
- **`generator.js`**: В `resolveEdge` добавлена прямая проверка `T.solids.some(s => Number(s.tileID) === Number(groundId))` с приведением к числу. 
- **`generator.js`**: В `generateRect` (двойная страховка) аналогичная проверка с `Number()`. При `best === null` целевой слой определяется через `self` (тип текущего солида), а не сбрасывается в дефолт.
- **`app_paint.js`**: `updateTNSEdgesAround` использует fallback на `self` для определения слоя очистки, предотвращая накопление мусорных краев.

## [0.6.13] — Фикс сравнения ID солидов

### Fixed
- **`generator.js`**: Внедрено принудительное приведение к числу (`Number()`) при сравнении `s.tileID === groundId` в `resolveEdge` и `generateRect`, так как после импорта ID могут храниться как строки.

## [0.6.12] — Критический фикс поиска солидов

### Fixed
- **`types.js`**: Функция `findBySolid` переведена на `Number()`, чтобы ID 125 совпадал со строкой "125".
- **`app_files.js`**: При импорте MiniTNS `solids` сохраняются с явным приведением к `Number`.
- **`generator.js`**: Откат предыдущих экспериментальных жестких проверок, возврат к `selfType === T`.

## [0.6.10] — Фикс Items и Void

### Fixed
- **`app.js`**: `importMiniTNSFromEntry` теперь передает `entry.properties` третьим аргументом.
- **`app_files.js`**: `importMiniTNS` принимает `properties` и применяет их к солидам (`Object.assign`). Теперь свойство `void` из ini-файла корректно записывается в тайл и срабатывает в Wall Creator.

---

## [0.6.10] — Фикс Items и Void

### Fixed
- **`app.js` → `importMiniTNSFromEntry`**: третий аргумент `entry.properties` передаётся в `importMiniTNS`.
- **`app_files.js` → `importMiniTNS`**: принимает `properties` и через `Object.assign` записывает их в `ts.tiles[local].props` для каждого solid-тайла.

### Result
Теперь `void` из `.ini` доходит до солида, и `Wall Creator` в `endStroke` срабатывает (до этого `properties` из парсера просто отбрасывались).

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

