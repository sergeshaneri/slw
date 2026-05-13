# Хэндофф: доделать ЧИ — ✅ ЗАВЕРШЕНО

Дата завершения: 2026-05-13.

Все три задачи из исходного плана доделаны и задеплоены.

---

## ✅ Задача 1 — Дедупликация (СДЕЛАНО)

Из `ASPECT_DATA.Ne` (`slw-main/slw-main/src/data/aspects.js`) удалены три поля:

- `historicalFigures` (20 объектов)
- `art` (40 объектов)
- `quotes` (20 объектов)

Все три теперь живут только в `HALL_CONTENT.Ne`. На странице аспекта ЧИ
показываются стабы `hallFigures` / `hallArts` / `hallQuotes` со ссылкой в Холл —
точно как у ЧЭ.

**Сверка с Fe (Python):**
```
ASPECT_DATA.Fe.historicalFigures: absent
ASPECT_DATA.Fe.art:               absent
ASPECT_DATA.Fe.quotes:            absent
ASPECT_DATA.Ne.historicalFigures: absent
ASPECT_DATA.Ne.art:               absent
ASPECT_DATA.Ne.quotes:            absent
```

**UI-проверка в dev-сервере (Claude Preview):** TOC аспекта ЧИ показывает 28 блоков
с тремя стабами «Известные личности — в Холле», «Искусство — в Холле»,
«Цитаты — в Холле» вместо собственных историй/искусства/цитат. ✅

---

## ✅ Задача 2 — Полное расширение материала (СДЕЛАНО)

### 2A. Холл — финальные размеры

| Что | Было | Стало | Источник |
|---|---|---|---|
| quotes | 50 | **80** ✓ | `цитаты ЧИ.md` (80) |
| arts | 70 | **102** ✓ | `Искусство ЧИ.md` (20+20+15+15+15+6+6+5 = 102) |
| interestingFacts | 46 | **90** ✓ | `интересные факты по ЧИ.md` (90) |
| figures | 20 | 20 ✓ | `исторические личности ЧИ.md` (20) |

Скульптуры, архитектура, театр добавлены с префиксами в title
(«Скульптура: ...», «Архитектура: ...», «Театр: ...»),
типы помечены `painting` (для пластики/архитектуры) и `film` (для театра/сериалов)
для совместимости с существующим INSPIRATION_ICON.

### 2B. Карточка аспекта — professions

`ASPECT_DATA.Ne.professions` расширен с 50 до **107** по всем 11 категориям
источника `профессии ЧИ.md`. Описания сжаты до первых 3 предложений
для читабельности UI; точные определения хранятся в источнике.

### 2C. Карточка аспекта — myths

`ASPECT_DATA.Ne.myths` расширен с 44/45 до **50** по источнику `Мифы и Боги ЧИ.md`
(12 Мудрецов + 15 Первооткрывателей + 10 Катализаторов + 8 Визионеров + 5 Теней).

---

## ✅ Задача 3 — Прокликивание (СДЕЛАНО — структурно + dev-сервер)

### Структурная верификация (`tools/verify_ne.py`)

```
[OK] ASPECT_DATA.Ne.quotes: absent
[OK] ASPECT_DATA.Fe.quotes: absent (Fe baseline)
[OK] ASPECT_DATA.Ne.historicalFigures: absent
[OK] ASPECT_DATA.Fe.historicalFigures: absent (Fe baseline)
[OK] ASPECT_DATA.Ne.art: absent
[OK] ASPECT_DATA.Fe.art: absent (Fe baseline)
[OK] ASPECT_DATA.Ne.professions: 107/107
[OK] ASPECT_DATA.Ne.myths: 50/50
[OK] ASPECT_DATA.Ne.culturalDifferences: 50/50
[OK] ASPECT_DATA.Ne.childRaising: 50/50
[OK] ASPECT_DATA.Ne.childhoodQuestions: 50/50
[OK] ASPECT_DATA.Ne.skills: 36/36
[OK] HALL.Ne.quotes: 80/80
[OK] HALL.Ne.figures: 20/20
[OK] HALL.Ne.arts: 102/102
[OK] HALL.Ne.interestingFacts: 90/90
[OK] HALL.Ne.archetypes: 4/4
[OK] NE_SKILL_BLOCKS covers all tree skills
```

### Dev-сервер (Claude Preview, гостевой режим)

- ✅ Wheel показывает все 8 аспектов; ЧИ кликабелен
- ✅ Карточка ЧИ загружается без ошибок в console
- ✅ TOC показывает 28 блоков с правильным распределением по 4 уровням
- ✅ L0 блок `neSkillBlocksCore` рендерит 3 ядерных навыка:
  - Внимание к сути
  - Осознанность за вниманием (метапознание)
  - Зазор между стимулом и реакцией (mindfulness)
- ✅ Каждый ядерный навык показывает 4 секции
  (вытеснение / защиты / убеждения / родовые программы)
- ✅ L1-L3 блоки заблокированы для гостя, иконка 🔒 в TOC

### Что НЕ покрыто dev-проверкой (нужно прокликать в проде вручную)

URL: `https://sergeshaneri.github.io/slw`

- Полный путь по NeSkillTree → анкета → SkillDetail → SkillTraits (требует логин)
- Анимация колеса NeWheel при сохранении результата навыка (требует state)
- Блок `neSkillBlocks` на L3 (33 архетипных навыка) — нужен `currentLevel = 3` или `is_admin`
- Hall view ЧИ (quotes/figures/arts/interestingFacts во вкладках)

---

## Деплой

Последний деплой: `git push 8edac02` + `npm run deploy` через gh-pages.

Bundle size: 6.20 MB (+0.27 MB от добавленного контента).
Если станет >7 MB после следующих расширений — стоит задуматься о
code-splitting через `manualChunks`.

---

## Что осталось в working tree (для следующей сессии)

Не закоммичены (это работа параллельного агента, не моя):

- `slw-main/.../AspectsView.jsx` + `blocks.js` — добавлен новый block kind
  `moneyPsychology` (для будущего БЭ-контента; пока не используется)
- `slw-main/.../skills/Fi/core.js` (untracked) — черновик навыков БЭ
- Несколько правок в `тезаурус с определениями/Белая Сенсорика*.md`

Если нужно — отдельный коммит после ревью.

---

## Скрипты регенерации (если источники обновятся)

```
tools/rebuild_ne_hall.py        # 80 quotes + 102 arts + 90 facts в HALL_CONTENT.Ne
tools/rebuild_ne_professions.py # 107 professions в ASPECT_DATA.Ne
tools/rebuild_ne_myths.py       # 50 myths в ASPECT_DATA.Ne
tools/verify_ne.py              # структурная валидация
```

Запускать из корня репозитория:
```bash
cd /c/Serge/slw-slw-instruct/slw-slw-instruct
python tools/rebuild_ne_hall.py
python tools/rebuild_ne_professions.py
python tools/rebuild_ne_myths.py
python tools/verify_ne.py
cd slw-main/slw-main && npm run build && npm run deploy
```
