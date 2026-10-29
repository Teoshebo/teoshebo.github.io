# WebTiled

**Редактор карт для Rusted Warfare · формат `.tmx` · Beta 0.7**

[![Version](https://img.shields.io/badge/version-0.7--beta-8cf.svg)](#)
[![Format](https://img.shields.io/badge/format-.tmx-orange.svg)](#)
[![Discord](https://img.shields.io/badge/Discord-teoshebo-5865F2.svg)](https://discord.com/users/709138215935934525)

**WebTiled** — браузерный редактор карт для **Rusted Warfare** (`.tmx`). Заменяет NotTiled и добавляет семантические *Types*, процедурный генератор, изометрический 3D-вид, склейку карт, референс-слой, CAD-направляющие и зеркалирование карты.

> Вопросы и обратная связь: **teoshebo** в Discord — [discord.com/users/709138215935934525](https://discord.com/users/709138215935934525)

Полное руководство: **WebTiledDoc.html** — RU / EN.

---

## Что нового в 0.7

- **Wall Creator (Defer Void)**: Если рисовать `void`-солиды с зажатым `Shift`, слой `Ground` больше не очищается мгновенно. Вместо этого изменения накапливаются, а вверху экрана появляется кнопка **ACCEPT** для применения очистки.
- **Авто-открытие атласа**: При выборе TNS-типа в правой панели нижняя панель автоматически переключается на нужный атлас.
- **Исправлен Type Fill**: `Shift + F` теперь заливает выбранный TNS поверх другого TNS (а не самого себя).
- **Настройки кисти**: Размер и форма кисти теперь видны всегда. Размер изменен на **диаметр** (1 = 1 клетка, 3 = 3x3 и т.д.).
- **Умное удаление атласов**: При удалении тайлсета из TNS/terrain вычищаются все его тайлы. Если тайлы пропали не все — тип подсвечивается **желтой рамкой**.
- **MiniTNS Library (PC)**: Добавлено кэширование миниатюр и кнопка **REFRESH** для принудительного обновления библиотеки.
- **Mobile Merge**: Превью карт в окне склейки сжимаются сильнее для корректного отображения на мобильных устройствах.

---

## Быстрый старт

1. Открой `webtiled.html` в современном браузере.
2. Нажми **📂 Open** или перетащи `.tmx` на полотно.
3. Рисуй карту, используя панели ATLASES, TYPES, GENERATOR, 3D.
4. Для служебных операций открой **UTILS** на левой панели.
5. Сохрани карту кнопкой **💾 Save**.

---

## Ключевые возможности

- **Types** — семантический автотайл по приоритетам: Solids, Edges, Inner corners.
- **Wall Creator** — создание невидимых стен (`void`). С зажатым `Shift` откладывает очистку `Ground` до нажатия кнопки **ACCEPT**.
- **Classic autotile (CLS)** — классический corner-autotile по terrain-маске.
- **FLOOD** — заливка доминирующим типом по 3+ ортогональным соседям.
- **Empty Fill / Type Fill** — быстрые служебные заливки.
- **Generator** — heightmap, шум, симметрия, реки, auto points, импорт PNG.
- **3D-вид** — изометрический предпросмотр с экспортом PNG.
- **Merge** — склейка нескольких `.tmx` с приоритетами и снапом.
- **GUIDES** — направляющие фигуры только для редактора.
- **Map Mirror** — зеркалирование половины карты на другую половину.

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
| `Shift` + `F` | Type Fill — заливка выбранным TNS поверх другого |
| `Shift` + `Клик` | Wall Creator: отложенная очистка Ground (Defer Void) |
| `I` | Picker |
| `P` | Pan |
| `Ctrl+Z` / `Ctrl+Y` | Undo / Redo |
| `Ctrl+S` | Save |
| `Esc` | Отмена режима pick |

---

## Формат и ограничения

- Формат карты: `.tmx` для Rusted Warfare.
- Слои: `Ground`, `Items0`, `Units`, `Items1`, `Items2`, `Items`, далее при наличии.
- `GUIDES` и `Reference` не сохраняются в `.tmx` и не попадают в PNG-экспорт.
- Автосохранения нет. Несохранённые изменения теряются при перезагрузке.
- Склейка карт заменяет текущую карту без undo.

---

## English summary

**WebTiled** is a browser-based map editor for **Rusted Warfare** (`.tmx`).

### What's new in 0.7
- **Wall Creator (Defer Void)**: Hold `Shift` while painting `void` solids to defer `Ground` clearing. An **ACCEPT** button appears to apply the changes.
- **Auto-Open Atlas**: Selecting a TNS type automatically opens its corresponding tileset in the bottom panel.
- **Type Fill Fixed**: `Shift + F` now fills the target TNS with the currently selected TNS.
- **Brush Settings**: Always visible. Size now means **diameter**.
- **Smart Atlas Deletion**: Deleting a tileset cleans up TNS/Terrain tiles. Missing tiles highlight the type with a **yellow border**.
- **MiniTNS Library**: Added caching and a **REFRESH** button for PC.
- **Mobile Merge**: Compressed map previews for better performance on mobile.
