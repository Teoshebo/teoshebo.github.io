# WebTiled

**Редактор карт для Rusted Warfare · формат `.tmx` · Beta 0.6**

[![Version](https://img.shields.io/badge/version-0.6--beta-8cf.svg)](#)
[![Format](https://img.shields.io/badge/format-.tmx-orange.svg)](#)
[![Discord](https://img.shields.io/badge/Discord-teoshebo-5865F2.svg)](https://discord.com/users/709138215935934525)

**WebTiled** — браузерный редактор карт для **Rusted Warfare** (`.tmx`). Заменяет NotTiled и добавляет семантические *Types*, процедурный генератор, изометрический 3D-вид, склейку карт, референс-слой, CAD-направляющие и зеркалирование карты.

> Вопросы и обратная связь: **teoshebo** в Discord — [discord.com/users/709138215935934525](https://discord.com/users/709138215935934525)

Полное руководство: **WebTiledDoc.html** — RU / EN.

---

## Содержание

- [Что нового в 0.6](#что-нового-в-06)
- [Быстрый старт](#быстрый-старт)
- [Ключевые возможности](#ключевые-возможности)
- [Интерфейс кратко](#интерфейс-кратко)
- [Горячие клавиши](#горячие-клавиши)
- [Формат и ограничения](#формат-и-ограничения)
- [English summary](#english-summary)

---

## Что нового в 0.6

- **Логи перенесены** в правый нижний угол игрового полотна. Они накладываются поверх карты, не мешают рисованию, показывают последние 5 действий и скрываются при открытии нижней панели.
- **Навигация по атласам** — выпадающий список + кнопки «Влево» / «Вправо». Удаление тайлсета (🗑) теперь в шапке самого тайлсета.
- **Навигация по типам** — выпадающий список + кнопки «Создать TnS», «Удалить», «Import MiniTNS», «Library».
- **Меню UTILS** на левой панели инструментов. В нём собраны `Resize`, `Ref` и новое **зеркало карты**.
- **Map Mirror** — отражение половины карты на другую половину. Оригинал не стирается, копия накладывается сверху. Режимы: Left→Right, Right→Left, Top→Bottom, Bottom→Top, Quad. Работают чекбоксы слоёв; солиды автоматически перемешиваются, края autotile пересчитываются.
- **GUIDES** — CAD-слой только для редактора. Линии, прямоугольники, круги/эллипсы и точки с чёрной обводкой и подписями координат. Не сохраняется в `.tmx` и не попадает в PNG-экспорт. Есть режимы Create / Select и симметрия H-Sym, V-Sym, Diag, Anti-D.
- **Заливки:** `E + F` — Empty Fill, `Shift + F` — Type Fill.

---

## Быстрый старт

1. Открой `webtiled.html` в современном браузере.
2. Нажми **📂 Open** или перетащи `.tmx` на полотно.
3. Рисуй карту, используя панели ATLASES, TYPES, GENERATOR, 3D.
4. Для служебных операций открой **UTILS** на левой панели.
5. Сохрани карту кнопкой **💾 Save**.
6. Открой результат в **Rusted Warfare** или **Tiled**.

---

## Ключевые возможности

- **Types** — семантический автотайл по приоритетам: Solids, Edges, Inner corners.
- **Classic autotile (CLS)** — классический corner-autotile по terrain-маске.
- **FLOOD** — заливка доминирующим типом по 3+ ортогональным соседям.
- **Empty Fill / Type Fill** — быстрые служебные заливки.
- **Generator** — heightmap, шум, симметрия, реки, auto points, импорт PNG.
- **3D-вид** — изометрический предпросмотр с экспортом PNG.
- **Merge** — склейка нескольких `.tmx` с приоритетами и снапом.
- **Reference** — overlay / underlay картинка для обводки.
- **GUIDES** — направляющие фигуры только для редактора.
- **Map Mirror** — зеркалирование половины карты на другую половину.
- **Маркеры** — старты команд и respool-точки на 2D и 3D.
- **Скриншот** — экспорт превью 500×500 без референса и GUIDES.

---

## Интерфейс кратко

- **Верхняя панель:** Open, Save, Merge, Save Preview, Fit, 1:1, Zoom, Settings, Help. `Resize` и `Ref` теперь в **UTILS**.
- **Левая панель:** PAN, BRUSH, TERRAIN, CLS, ERASE, RECT, FILL, PICK, AUTO, **GUIDE**, **UTILS**, UNDO, REDO.
- **Правая панель:** LAYERS, BRUSH, свойства выбранной фигуры GUIDE.
- **Нижняя панель:** ATLASES, TYPES, GENERATOR, 3D.
- **Логи:** правый нижний угол полотна, последние 5 действий, скрываются при открытии нижней панели.

---

## Горячие клавиши

| Клавиша | Действие |
|---|---|
| `B` | Brush |
| `T` | Terrain |
| `C` | Classic autotile |
| `E` | Eraser |
| `R` | Rect |
| `F` | Fill |
| `E` + `F` | Empty Fill — заливка пустотой |
| `Shift` + `F` | Type Fill — заливка по типам |
| `I` | Picker |
| `P` | Pan |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+S` | Save |
| `Esc` | Отмена режима pick |

---

## Формат и ограничения

- Формат карты: `.tmx` для Rusted Warfare.
- Слои: `Ground`, `Items0`, `Units`, `Items1`, `Items2`, `Items`, далее при наличии.
- `GUIDES` не сохраняется в `.tmx` и не попадает в PNG-экспорт.
- `Reference` не сохраняется в `.tmx` и не попадает в Save Preview.
- Автосохранения нет. Несохранённые изменения теряются при перезагрузке.
- Склейка карт заменяет текущую карту без undo.

---

## English summary

**WebTiled** is a browser-based map editor for **Rusted Warfare** (`.tmx`). It replaces NotTiled and adds semantic **Types**, a procedural generator, isometric 3D view, map merging, reference overlay, CAD **GUIDES**, and **Map Mirror**.

### What's new in 0.6

- Logs moved to the bottom-right corner of the canvas: overlay, last 5 actions, hidden when the bottom panel is open.
- Atlas navigation: dropdown + Left/Right buttons; tileset delete (🗑) is in the tileset header.
- Type navigation: dropdown + Create TnS, Delete, Import MiniTNS, Library.
- **UTILS** modal on the left toolbar: Resize, Ref, Map Mirror.
- **Map Mirror**: mirror half of the map onto the other half; original is not erased; modes Left→Right, Right→Left, Top→Bottom, Bottom→Top, Quad; layer checkboxes; solids randomized; autotile edges recalculated.
- **GUIDES**: editor-only CAD layer with lines, rectangles, circles/ellipses, points; black outline and coordinate labels; Create/Select; symmetry H-Sym, V-Sym, Diag, Anti-D; not saved in `.tmx` or PNG.
- Fill hotkeys: `E + F` Empty Fill, `Shift + F` Type Fill.

### Quick start

1. Open `webtiled.html` in a modern browser.
2. Click **📂 Open** or drag a `.tmx` onto the canvas.
3. Edit the map using ATLASES, TYPES, GENERATOR, 3D.
4. Use **UTILS** for Resize, Ref, and Mirror.
5. Save with **💾 Save**.
6. Open the result in **Rusted Warfare** or **Tiled**.

Full documentation: **WebTiledDoc.html** — RU / EN.