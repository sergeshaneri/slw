# План: заливка полного контента по аспектам в приложение

> Если ты только что прочитал этот файл — следующее, что должен прочитать:
> `slw-main/slw-main/src/data/aspects.js` (структура `ASPECT_DATA.Si` как эталон).
> Потом `slw-main/slw-main/src/components/AspectsView/blocks.js` (список блоков).
> Потом `slw-main/slw-main/src/data/hallContent.js` (HALL_CONTENT).

---

## Контекст

**Эталон полного пака** — `ASPECT_DATA.Si` (~1296 строк). Содержит все поля:
`name, sub, metaphor, essence, superpower, dilemmas, archetypes, archetypePath, skills, coachTips, goals, selfAssessment, historicalFigures, art, integration, synergy, polysemy, resources, practices, myths, quotes, redFlags, fears, defenses, somatic, culturalDifferences, childRaising`.

Состояние остальных:
- **Ni**: 641 строк (50% залит)
- **Fe / Fi / Se / Ne**: ~200 строк (минимум, заготовки)
- **Te / Ti**: 0 строк отдельных присваиваний — placeholder'ы внутри стартового объекта `export const ASPECT_DATA = {...}`

---

## Архитектурное решение (по запросу пользователя)

**3 типа контента переезжают в Холл:**
- `art` (Искусство) — было level 1 в AspectsView
- `historicalFigures` (Исторические личности) — было level 1
- `quotes` (Цитаты) — было level 2

**В AspectsView** для этих блоков рендерится **заглушка** (kind: `hallStub`) с CTA «Открыть в Холле →». Полный контент живёт в `HALL_CONTENT[aspect].{arts, figures, quotes}`.

**Кнопка «Перейти в Холл»** делается заметной — карточка-блок в самом верху Toc страницы аспекта.

**Новые блоки в AspectsView:**
- `professions` (level 2) — из `профессии X.md`. kind: `titledList` (как practices) или новый.
- `childhoodQuestions` (level 3) — из `вопросы про детство X.md`. kind: `numberedList`.

**Новый блок в Холле:**
- `interestingFacts` — из `интересные факты по X.md`. Куда конкретно — в HallView отдельная секция или вместе с цитатами.

---

## Маппинг md → поле → блок → level

### Остаются в ASPECT_DATA (карточка аспекта)

| md (в `<aspect>/`) | поле ASPECT_DATA | блок kind | level |
|---|---|---|---|
| `Мифы и Боги X.md` | `myths` | titledList | 2 |
| `Культурные отличия X.md` | `culturalDifferences` | numberedList | 3 |
| `как привить ребенку X.md` | `childRaising` | titledList | 3 |
| `профессии X.md` | `professions` (НОВОЕ) | titledList | 2 |
| `вопросы про детство X.md` | `childhoodQuestions` (НОВОЕ) | numberedList | 3 |

### Переезжают в HALL_CONTENT (Холл)

| md | поле HALL_CONTENT | блок в AspectsView |
|---|---|---|
| `цитаты X.md` | `quotes: [{ text, author }]` | hallStub (level 2) |
| `исторические личности X.md` | `figures: [{ name, note }]` | hallStub (level 1) |
| `Искусство X.md` | `arts: [{ type, title, note }]` | hallStub (level 1) |
| `интересные факты по X.md` | `interestingFacts: [{ name, desc }]` (НОВОЕ) | hallStub (level 1 или 2) |

### Не из md (концептуальный контент, пишется отдельно)

`dilemmas, archetypes, archetypePath, skills, coachTips, goals, selfAssessment, integration, synergy, polysemy, resources, practices, redFlags, fears, defenses, somatic` — этот контент остаётся в ASPECT_DATA, **берётся либо из других md либо пишется отдельно** (см. `скб X.md` где есть сводки, и `подробный список навыков X — *.md` где есть архетипные ходы).

### Уже залито отдельно

| md | где |
|---|---|
| `список навыков X.md` | `data/skills/X/{core,zavodila,...}.js` (только Fe полный, Si — только `scan`) |
| `блоки навыков X.md` | `data/skills/X/skill-blocks.js` (только Fe) |
| `псих черты X.md` | внутри тех же `*.js` как `gift/shadow` (только Fe) |
| `вопросы для оценки X.md` | `data/journey/X-skills/*-surveys.md` (анкеты) |
| `скб X.md` | проектная сводка, не заливается напрямую |

---

## Что менять в коде (общая структура)

### 1. `blocks.js`
- Добавить новый kind `'hallStub'` с полем `hallSection` ('arts'|'figures'|'quotes'|'interestingFacts') — для рендера CTA.
- Добавить блок `professions` (level 2, kind: titledList, field: 'professions').
- Добавить блок `childhoodQuestions` (level 3, kind: numberedList, field: 'childhoodQuestions').
- Текущие блоки `art`, `historicalFigures`, `quotes` — поменять kind на `hallStub` (или оставить kind как есть и переключать рендер условно). Лучше — новый kind.
- Добавить `hallStub` в `TEASER_BY_KIND` и `teaseBlockData` (с минимумом — показ карточки-CTA без скрытия).

### 2. `aspects.js`
- Удалить из `ASPECT_DATA.X.{art, historicalFigures, quotes}` для всех аспектов, где они есть (Si, Ni — поднабор). Они теперь живут в Холле.
- Добавить в каждый `ASPECT_DATA.X` поля `professions`, `childhoodQuestions`, плюс залить полное содержимое `myths`, `culturalDifferences`, `childRaising` из md.
- Для Fe/Fi/Se/Ne/Te/Ti — расширить остальные поля (dilemmas, archetypePath, skills и т.д.) до уровня Si из md и других источников.

### 3. `hallContent.js`
- Расширить `HALL_CONTENT[aspect].{quotes, figures, arts}` полным контентом из md.
- Добавить новое поле `interestingFacts` (если решим класть его в Hall).

### 4. `AspectsView.jsx`
- Новый рендерер `case 'hallStub':` — карточка с тизером 2-3 элементов из соответствующего HALL_CONTENT-массива + кнопка «Открыть в Холле →».
- Onclick кнопки → `onEnterHall(aspect, section?)` — пробросить.
- Заметная кнопка-карточка вверху Toc — «🏛 Обсудить {аспект} с сообществом» с подсчётом элементов.

### 5. `HallView.jsx`
- При навигации с параметром `section` — открывать сразу нужную вкладку (arts/figures/quotes).
- Добавить вкладку для `interestingFacts` если кладём в Холл.

### 6. Стили
- `.aspectsHallCta` (большая карточка вверху Toc).
- `.hallStubBlock` (заглушка с тизером и CTA).
- `.hallStubItem` (тизер-элемент).

---

## Порядок реализации

### Этап 1 — архитектура (один раз)
1. Новые блоки в `blocks.js`: `hallStub`, `professions`, `childhoodQuestions`.
2. Рендереры в `AspectsView.jsx`: hallStub (главное), titledList для professions, numberedList для childhoodQuestions (используют существующие рендереры если kind совпадает).
3. Стили в `AspectsView.module.css`.
4. Заметная кнопка в Холл в Toc.
5. **Vite build**, fix errors.
6. **Коммит**: `feat(aspects): hallStub + professions/childhoodQuestions blocks + prominent hall CTA`

### Этап 2 — Fe пилот
1. Прочитать все 10 Fe-md (исключая блоки навыков и список — уже залиты).
2. Залить в `ASPECT_DATA.Fe`:
   - Удалить из Fe `art`, `historicalFigures`, `quotes` (если есть).
   - Добавить полные `myths`, `culturalDifferences`, `childRaising`.
   - Добавить новые `professions`, `childhoodQuestions`.
   - Расширить остальные поля (dilemmas, archetypePath, skills, fears, defenses, somatic, selfAssessment, goals, resources, practices, integration, synergy, polysemy, redFlags, coachTips) из md и `скб чэ.md`.
3. Залить в `HALL_CONTENT.Fe`:
   - `quotes` из `цитаты ЧЭ.md` (≈20)
   - `figures` из `исторические личности ЧЭ.md` (≈20)
   - `arts` из `Искусство ЧЭ.md` (≈40)
   - (опц) `interestingFacts` из `интересные факты по ЧЭ.md` (≈10-15)
4. Vite build, smoke в dev.
5. **Коммит**: `content(fe): полный пак — myths, professions, childhood, etc. + hall move`

### Этап 3-9 — остальные аспекты по одному коммиту каждый
По образцу Fe:
- Si — уже залит, но `art/figures/quotes` надо вывести в Hall, добавить professions/childhoodQuestions
- Ni — частично залит, дополнить + Hall move + новые поля
- Ne / Fi / Se / Te / Ti — почти с нуля

### Этап 10 — deploy
`git push` + `npm run deploy`.

---

## Smoke-чек (для каждого аспекта)

После заливки контента и dev-перезапуска:
1. Открыть Аспекты → выбрать <аспект>.
2. Toc должен начинаться с большой карточки «🏛 В Холле».
3. На уровне 1 — заглушка для `art`/`historicalFigures` (вместо контента).
4. На уровне 2 — `myths`, `quotes` (заглушка), `professions` (новое), и т.д.
5. На уровне 3 — `culturalDifferences`, `childRaising`, `childhoodQuestions` (новое), `dilemmas` и т.д.
6. Клик «Открыть в Холле» → перейти в HallView соответствующего аспекта.
7. Если в `HALL_CONTENT[аспект]` залиты quotes/figures/arts — они отображаются в Холле.

---

## Источники md (по аспектам)

### Fe (ЧЭ)
- `Fe/Искусство ЧЭ.md` 269 строк → HALL_CONTENT.Fe.arts
- `Fe/Культурные отличия ЧЭ.md` 135 → culturalDifferences
- `Fe/Мифы и Боги ЧЭ.md` 155 → myths
- `Fe/блоки навыков ЧЭ.md` 882 → УЖЕ ЗАЛИТО (skill-blocks.js)
- `Fe/вопросы для оценки навыков ЧЭ.md` 1061 → УЖЕ ЗАЛИТО (анкеты)
- `Fe/вопросы про детство ЧЭ.md` 98 → childhoodQuestions
- `Fe/интересные факты по ЧЭ.md` 156 → HALL_CONTENT.Fe.interestingFacts
- `Fe/исторические личности ЧЭ.md` 80 → HALL_CONTENT.Fe.figures
- `Fe/как привить ребенку ЧЭ.md` 130 → childRaising
- `Fe/профессии ЧЭ.md` 1273 → professions
- `Fe/псих черты ЧЭ.md` 406 → УЖЕ ЗАЛИТО (skill-blocks gift/shadow)
- `Fe/скб чэ.md` 1774 → опционально для расширения других полей
- `Fe/список навыков ЧЭ.md` 3424 → УЖЕ ЗАЛИТО (data/skills/Fe/*.js)
- `Fe/цитаты ЧЭ.md` 214 → HALL_CONTENT.Fe.quotes

### Si (БС) — эталон, поля уже залиты в ASPECT_DATA, но нужно перенести art/figures/quotes в Hall
- `Si/блоки навыков БС.md` → ещё не залито (отложенный поток)
- `Si/Искусство БС.md` → переехать в HALL_CONTENT.Si.arts (сейчас art в ASPECT_DATA)
- `Si/исторические личности БС.md` → переехать в HALL_CONTENT.Si.figures
- `Si/цитаты бс.md` → переехать в HALL_CONTENT.Si.quotes
- + проверить полноту остальных полей по другим Si/*.md (Культурные отличия, Мифы и Боги, как привить ребенку и т.д.)

### Ni (БИ) — половина залита
- Аналогично, посмотреть что есть в `Ni/*.md` и довести до полного пака.

### Ne / Fi / Se / Te / Ti — почти пусто
- По каждому ~10-13 md в папке. Распарсить и залить как для Fe.

---

## Парсинг md → JS

Не делать парсер на лету. Структура md в разных аспектах **может различаться** (например, в Fe цитаты идут списком `- цитата (автор)`, а в Si — таблицей или другой структурой). Лучше — **писать JS-массив руками**, читая md и копируя контент в нужную структуру.

Утилита для каждого:

```js
// quotes
quotes: [
  { text: '...', author: '...' }
]

// figures
historicalFigures: [
  { name: 'Дар. Гиппократ (ок. 460–370 до н. э.)', desc: '...' }
]

// arts
art: [
  { name: 'Книга. ... — ... (год)', desc: '...' }
]

// professions
professions: [
  { name: 'Профессия N', desc: '...' }
]

// childhoodQuestions
childhoodQuestions: [ 'вопрос 1', 'вопрос 2', ... ]

// culturalDifferences
culturalDifferences: [ 'тип отличия 1', 'тип 2', ... ]
```

---

## Что НЕ делаем

- НЕ создаём блоков для всех md-файлов подряд — только те, которые в этом плане.
- НЕ трогаем `Колесо БС LP.md` и аналоги — это рамочный документ, не контент.
- НЕ парсим md в рантайме — пишем JS-массивы вручную.
- НЕ трогаем `data/skills/X/*.js` и `data/journey/X-skills/*` — это отдельный поток (контент навыков).
- НЕ заливаем для других аспектов `блоки навыков X.md` и `псих черты X.md` сейчас — это отдельный поток.

---

## Pre-start checks (перед началом каждого нового аспекта)

1. Есть ли уже у этого аспекта `ASPECT_DATA[X]` (не только заготовка)? → проверить размер `awk '/ASPECT_DATA\.X = \{/,/^\}/'`.
2. Какие md-файлы в `<X>/` папке? → `ls <X>/`.
3. Какая структура заголовков в md для контента? → быстрый `head -50` основных файлов.
4. Если контент в md уже расходится со старой версией в ASPECT_DATA — какую версию приоритизируем? → обычно md (он свежее).

---

## Текущий прогресс

- ✅ Этап 1 не сделан (новые блоки + hallStub + кнопка)
- ⏳ Этап 2 (Fe пилот) — в работе
- ⏳ Si — старый контент остаётся в ASPECT_DATA, надо переезжать quotes/figures/arts в Hall
- ⏳ Ni — частично залит, добивать
- ⏳ Ne / Fi / Se / Te / Ti — пусто, заливать

При компактификации — следующий агент должен:
1. Прочитать этот файл.
2. Прочитать `ASPECT_DATA.Si` (как эталон структуры полей).
3. Прочитать `blocks.js` (текущий список блоков).
4. Прочитать `hallContent.js` (HALL_CONTENT).
5. Прочитать `Fe/*.md` и проверить что уже залито в `ASPECT_DATA.Fe` (см. этап 2 выше).
6. Дальше по плану.
