# План реализации: «Развитие навыков и черт после анкеты» для Fe (ЧЭ)

> **Прочитай этот файл первым делом, прежде чем приступать к работе.**
> План составлен под компактификацию — все необходимые детали ниже.
> После реализации можно удалить файл (или перенести в `_DONE_*`).

---

## Что сделать (контракт UX)

После прохождения анкеты по любому Fe-навыку юзер получает доступ к **двум отдельным экранам** с прогрессивной подачей:

1. **SurveyInsight** (есть) — итоги прохода + поле «инсайт о навыке».
   → Кнопка «Сохранить» переименовать в **«Сохранить и узнать, как развить →»**.
2. **SkillDetail** (рефакторим) — «Как развить» с essence/actions/practices/criteria/pitfalls по открытым уровням.
   → Внизу страницы кнопка **«Какие психологические черты это развивает →»**.
   → В каждой карточке открытого уровня — компонент **«✎ Записать инсайт»**.
3. **SkillTraits** (новый компонент) — gift/shadow + дилемма (только L3) по открытым уровням.
   → В каждой карточке открытого уровня — **«✎ Записать инсайт»**.

В **FeSkillTree** (колесо ЧЭ) у навыков с `passes>0` — пилюля **«Узнать, как развить →»** в дополнение к существующему ⓘ.

**Гейтинг** существующий в `data/skills/skillsContent.js` → `getUnlockedSkillLevel(currentLevel, passes)`:
- L1 unlocked: `cl≥1 ∧ passes≥1`
- L2 unlocked: `cl≥2 ∧ passes≥2`
- L3 unlocked: `cl≥3 ∧ passes≥3`

---

## Перед стартом — проверить актуальные имена и пути

| Сущность | Где смотреть |
|---|---|
| Имя папки навыков ЧЭ | `slw-main/slw-main/src/data/journey/fe-skills/` (или `che-skills/` если рефактор v16 ещё не дошёл) |
| Префикс ID навыков ЧЭ | в `data/journey/fe-skills/tree.js` поле `SKILL_BY_RUS_NAME` — должно быть `fe-` (если `che-` — переписать на `fe-` в плане) |
| Имя компонента колеса ЧЭ в SkillTree | `FeSkillTree.jsx` (или `CheSkillTree.jsx`) в `components/JourneyView/` |
| Имя компонента колеса в AspectsView | `FeWheel.jsx` (или `CheWheel.jsx`) в `components/AspectsView/` |
| Текущий `CONTENT_VERSION` | `JourneyView.jsx` начало файла, `export const CONTENT_VERSION = N` |
| Что сейчас в `data/skills/skillsContent.js` | проверить — если уже есть БС-навыки кроме `scan`, не ломать |

Если пути/имена отличаются — адаптируй план под актуальное состояние.

---

## Архитектура

### Источник истины контента
- `Fe/список навыков ЧЭ.md` (~3400 строк) — actions / practices / criteria / pitfalls / essence для каждого уровня каждого из 34 навыков. Уровни именуются «Уровень 1. Чувствующий», «Уровень 2. Выражающий», «Уровень 3. Излучающий». Ищи разделы `### Навык N. <Название>` и `#### Уровень N. <typage>`.
- `Fe/псих черты ЧЭ.md` (~400 строк) — gift/shadow матрица для всех навыков и уровней.
- L3 каждого навыка содержит дополнительно `*Меры предосторожности*` (→ `precaution`) и `*Связь с глубинной дилеммой*` (→ `dilemma`).

Контент храним как **JSON-литералы в JS** (не парсим из md в рантайме). Так быстрее и проще валидировать.

### Файловая структура (создать)

```
data/skills/
  skillsContent.js                # БС (Si) — существующий, не трогаем
  Fe/
    index.js                      # реэкспорт + getFeContent(skillId)
    core.js                       # 3 ядерных навыка
    zavodila.js                   # 9 навыков (4 доп + 5 архетипных)
    orator.js                     # 6 навыков (4 доп + 2 архетипных)
    artist.js                     # 8 навыков (4 доп + 4 архетипных)
    master-atmo.js                # 8 навыков (3 доп + 5 архетипных)
  index.js                        # общий getSkillContent с aspect-aware lookup
  _PLAN_fe_skill_detail.md        # этот файл — удалить после реализации
```

Один файл на ~5000 строк нечитаем. По 600–900 на файл — управляемо. При работе над одним архетипом не трогаешь другие.

### Schema одного навыка

```js
'fe-awareness': {
  id: 'fe-awareness',
  name: 'Эмоциональная осознанность',
  archetype: 'common',          // 'common' | 'zavodila' | 'orator' | 'artist' | 'master_atmo'
  role: 'core',                 // 'core' | 'aux' | 'archetypal'
  intro: '...',                 // 2-3 фразы общего описания
  levels: {
    1: {
      typage: 'Чувствующий',
      essence: '...',           // из *Суть*
      gift:    { title, desc }, // из псих-черт.md (формируемая черта)
      shadow:  { title, desc }, // из псих-черт.md (устраняемая тень)
      actions: ['...', '...'],  // из *Что делает ученик*
      practices: [
        { name, desc, xp: 15 }  // из *Конкретные практики*; xp по умолчанию 15
      ],
      criteria: ['...'],        // из *Критерии освоения*
      pitfalls: ['...'],        // из *Теневая ловушка уровня N* / *Типичные ошибки*
    },
    2: { typage: 'Выражающий', essence, gift, shadow, actions, practices, criteria, pitfalls },
    3: {
      typage: 'Излучающий',
      essence, gift, shadow, actions, practices, criteria, pitfalls,
      precaution: '...',        // только L3 — *Меры предосторожности*
      dilemma: {                // только L3 — *Связь с глубинной дилеммой*
        name: 'Подлинность vs Принятие',
        desc: '...'
      }
    }
  }
}
```

### Aspect-aware lookup (новый файл)

`data/skills/index.js`:
```js
import { SKILLS_CONTENT, getUnlockedSkillLevel, hasSkillContent as hasSi } from './skillsContent'
import { FE_CONTENT } from './Fe'

export function getSkillContent(skillId) {
  return SKILLS_CONTENT[skillId] ?? FE_CONTENT[skillId] ?? null
}

export function hasSkillContent(skillId) {
  return hasSi(skillId) || (skillId in FE_CONTENT)
}

export { getUnlockedSkillLevel }
```

ID не пересекаются: БС без префикса (`scan`, `interoception`), ЧЭ с префиксом `fe-`. Один lookup безопасен.

### State + роутинг

Новый `screen='skill-traits'` в дополнение к существующему `'skill-detail'`. Используем существующий `state.skillDetailId` как «currentSkillId» (концептуальное переименование, код не ломаем).

Переходы:
```
chat / skill-tree
  → анкета → screen='survey-insight' → [клик «Сохранить и узнать, как развить»]
  → screen='skill-detail' (с гейтингом, инсайт-инпуты, кнопка «Какие черты»)
  → [клик «Какие черты»] → screen='skill-traits'
  → [← назад в карточках] → screen='skill-detail'
  → [← назад на header] → screen='skill-tree'
```

### Запись инсайта

Расширяем существующий `state.skills[id].insights[]`:
```js
{
  text: string,
  completedAt: number,
  source: 'survey' | 'detail' | 'traits',  // новое
  level?: 1 | 2 | 3,                       // новое (для detail/traits)
  pass?: 1 | 2 | 3,                        // существующее (для survey)
}
```

**Migration data-preserving** в `migrateState`: старые записи без `source` получают `source: 'survey'`. Чат не сбрасывается.

Параллельно пишем в дневник (как делает SurveyInsight): `source: 'journey-skill-insight'`, `aspect: state.currentAspect`, в `text` пишем `«{skillName} · L{level} · {detail|traits}: {insight}»`. Серверный стрик бьётся через `diary.post → bump_streak` автоматически.

### Дилеммы L3 (заранее зафиксировано)

| Дилемма | Навыки на L3 |
|---|---|
| Подлинность vs Принятие | fe-awareness, fe-self-honesty, fe-congruence, fe-imagery, fe-body-instrument, fe-stage-fear, fe-group-history |
| Выражение vs Удержание | fe-open-emotion, fe-artistry, fe-play-humor, fe-call-action, fe-rituals |
| Слияние vs Граница | fe-read-others, fe-empathy, fe-emo-borders, fe-state-spread, fe-storytelling, fe-include-people |
| Тонус для себя vs Поле для других | fe-emo-hygiene, fe-warm-up, fe-hold-peak, fe-set-tone |
| Открытость vs Безопасность | fe-pause, fe-breath, fe-group-pulse, fe-targeted-delivery, fe-discharge, fe-improv, fe-protect-quiet |

(Если префикс по факту `che-` — заменить.)

### Маппинг ID навыков

Из `data/journey/fe-skills/tree.js` (или `che-skills/tree.js`):

**core (3):** `fe-awareness`, `fe-expressiveness`, `fe-congruence`

**zavodila (9):** `fe-pause`, `fe-emo-hygiene`, `fe-group-pulse`, `fe-open-emotion` (доп), `fe-warm-up`, `fe-state-spread`, `fe-play-humor`, `fe-hold-peak`, `fe-discharge` (арх)

**orator (6):** `fe-breath`, `fe-self-honesty`, `fe-targeted-delivery`, `fe-artistry` (доп), `fe-imagery`, `fe-call-action` (арх)

**artist (8):** `fe-shades`, `fe-triggers`, `fe-read-others`, `fe-empathy` (доп), `fe-body-instrument`, `fe-improv`, `fe-storytelling`, `fe-stage-fear` (арх)

**master_atmo (8):** `fe-containment`, `fe-emo-borders`, `fe-room-atmo` (доп), `fe-set-tone`, `fe-include-people`, `fe-protect-quiet`, `fe-rituals`, `fe-group-history` (арх)

Итого 34 навыка. Сверь актуальные ID с `tree.js` перед началом.

---

## Этапы реализации

### Этап 1. Контент Fe (5 файлов, ~5000 строк JSON)

| Шаг | Создать файл | Источник | Объём |
|---|---|---|---|
| 1.1 | `data/skills/Fe/core.js` | `Fe/список навыков ЧЭ.md` разделы Навык 1, 14, 15 + псих-черты | 3 нав × 3 уровня ≈ 700 |
| 1.2 | `data/skills/Fe/zavodila.js` | разделы Навык 4, 6, 13, 17, 19–23 | 9 нав × 3 уровня ≈ 2000 |
| 1.3 | `data/skills/Fe/orator.js` | разделы Навык 7, 8, 16, 18, 24, 25 | 6 нав × 3 уровня ≈ 1300 |
| 1.4 | `data/skills/Fe/artist.js` | разделы Навык 2, 3, 9, 10, 26–29 | 8 нав × 3 уровня ≈ 1700 |
| 1.5 | `data/skills/Fe/master-atmo.js` | разделы Навык 5, 11, 12, 30–34 | 8 нав × 3 уровня ≈ 1700 |

**После каждого шага:**
- Обновить `data/skills/Fe/index.js` (реэкспорт + добавить в `FE_CONTENT`)
- Verify: открыть в браузере страницу аспекта `Fe` → колесо → клик на навык из заполненного архетипа → ⓘ → видишь реальный контент вместо «Подробный разбор скоро будет»

`data/skills/Fe/index.js` (создать на шаге 1.1, потом расширять):
```js
import { CORE } from './core'
import { ZAVODILA } from './zavodila'
// ... по мере появления

export const FE_CONTENT = {
  ...CORE,
  ...ZAVODILA,
  // ...
}

export function getFeContent(skillId) {
  return FE_CONTENT[skillId] ?? null
}
```

### Этап 2. Aspect-aware lookup (1 шаг)

2.1. Создать `data/skills/index.js` с объединённым `getSkillContent` (см. секцию архитектуры).

2.2. В `SkillDetail.jsx` поменять импорт:
```js
// было:
import { getSkillContent, getUnlockedSkillLevel } from '../../data/skills/skillsContent'
// стало:
import { getSkillContent, getUnlockedSkillLevel } from '../../data/skills'
```

**Verify:** на любом ЧЭ-навыке (после анкеты) SkillDetail показывает контент из `Fe/`. На БС-навыке поведение не изменилось.

### Этап 3. Кнопка «Сохранить и узнать, как развить →» в SurveyInsight (1 шаг)

3.1. В `components/JourneyView/SurveyInsight.jsx`:
- Кнопку «Сохранить» переименовать в **«Сохранить и узнать, как развить →»** (только если `getSkillContent(activeSurvey.skillId)` есть; иначе оставить «Сохранить»).
- Логика клика не меняется — `onSave(text)`.

3.2. В `JourneyView.jsx → handleSurveyInsight`:
- После сохранения инсайта: если `getSkillContent(skillId)` есть и `passes ≥ 1` — `screen='skill-detail'` + `skillDetailId=skillId`.
- Иначе оставить старое поведение (возврат в skill-tree или chat).

**Verify:** прохожу анкету по `fe-awareness` → save insight → автоматически попадаю в SkillDetail с открытой L1.

### Этап 4. Компонент InsightInput (1 шаг)

4.1. Создать `components/JourneyView/InsightInput.jsx`:
```js
export default function InsightInput({ accent, onSave, placeholder = 'Что заметил, что хочешь сохранить?' }) {
  const [expanded, setExpanded] = useState(false)
  const [text, setText] = useState('')
  const canSave = text.trim().length > 0

  if (!expanded) {
    return (
      <button type="button" className={styles.insightInputBtn} onClick={() => setExpanded(true)}>
        ✎ Записать инсайт
      </button>
    )
  }

  return (
    <div className={styles.insightInputBox} style={{ '--accent': accent }}>
      <textarea
        className={styles.insightInputTextarea}
        placeholder={placeholder}
        value={text}
        onChange={e => setText(e.target.value)}
        autoFocus
      />
      <div className={styles.insightInputActions}>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => { setExpanded(false); setText('') }}>
          Отмена
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          disabled={!canSave}
          onClick={() => {
            if (!canSave) return
            onSave(text.trim())
            setText('')
            setExpanded(false)
          }}
        >
          Сохранить
        </button>
      </div>
    </div>
  )
}
```

4.2. CSS-классы добавить в `JourneyView.module.css`: `.insightInputBtn`, `.insightInputBox`, `.insightInputTextarea`, `.insightInputActions`. Можно переиспользовать `.btn`, `.btnGhost`, `.btnPrimary` если есть.

**Verify:** компонент рендерится, раскрытие/сворачивание работает, кнопка disabled до текста.

### Этап 5. Расширение SkillDetail (1 шаг)

5.1. В `components/JourneyView/SkillDetail.jsx`:
- Header: переименовать в «Как развить навык: {skillName}».
- В каждой `SkillLevelCard` (для unlocked) добавить под блоком «Как развить»:
  ```jsx
  <InsightInput
    accent={accent}
    placeholder="Что заметил про этот уровень? Где видно у себя?"
    onSave={(text) => onSaveInsight(skillId, level, 'detail', text)}
  />
  ```
- В конце страницы (после всех level-cards) кнопка-пилюля:
  ```jsx
  <button
    type="button"
    className={styles.skillTraitsCta}
    onClick={() => onOpenTraits(skillId)}
  >
    Какие психологические черты это развивает →
  </button>
  ```

5.2. В `JourneyView.jsx`:
- Новый handler:
  ```js
  const handleSaveSkillInsight = useCallback((skillId, level, source, text) => {
    setState(s => {
      const skillEntry = s.skills?.[skillId] ?? {}
      const insights = [...(skillEntry.insights ?? []), {
        text, completedAt: Date.now(), source, level
      }]
      return {
        ...s,
        skills: { ...s.skills, [skillId]: { ...skillEntry, insights } }
      }
    })
    // Также пишем в дневник
    const survey = getSurvey(skillId)
    const skillName = survey?.name ?? skillId
    onDiaryChange([{
      id: Date.now(),
      date: new Date().toLocaleDateString('ru-RU'),
      ts: Date.now(),
      aspect: state.currentAspect,
      text: `${skillName} · L${level} · ${source === 'detail' ? 'как развить' : 'черты'}: ${text}`,
      source: 'journey-skill-insight',
      skillId, level, insightSource: source
    }, ...(diary ?? [])])
  }, [setState, onDiaryChange, diary, state.currentAspect])
  ```
- Прокинуть в SkillDetail: `onSaveInsight={handleSaveSkillInsight}`, `onOpenTraits={(id) => setState(s => ({ ...s, screen: 'skill-traits', skillDetailId: id }))}`.

**Verify:** на SkillDetail инсайт сохраняется в `state.skills[id].insights[]` (с полями `source: 'detail'`, `level: N`) и в дневник (`source: 'journey-skill-insight'`). Кнопка «Какие черты» переводит на новый экран.

### Этап 6. Новый экран SkillTraits (1 шаг)

6.1. Создать `components/JourneyView/SkillTraits.jsx`:
- Header: «Психологические черты: {skillName}» + кнопка ← Назад.
- Для каждого уровня 1–3 — `<SkillTraitsCard>`:
  - Если unlocked: gift (title + desc), shadow (title + desc), для L3 ещё `dilemma` (name + desc).
  - InsightInput с `onSave={(text) => onSaveInsight(skillId, level, 'traits', text)}`.
  - Если locked: сообщение «Откроется на уровне N путешествия + N коротких анкет». Используй существующую функцию `lockMessage` из SkillDetail или скопируй её логику.

6.2. В `JourneyView.jsx`:
- Импорт SkillTraits.
- Рендер блок:
  ```jsx
  {state.screen === 'skill-traits' && state.skillDetailId && (
    <SkillTraits
      skillId={state.skillDetailId}
      currentLevel={a.currentLevel ?? 0}
      passes={getCompletedPasses(state.skills?.[state.skillDetailId])}
      accent={accent}
      onSaveInsight={handleSaveSkillInsight}
      onClose={() => goToScreen('skill-detail')}
    />
  )}
  ```

**Verify:** клик «Какие черты» с SkillDetail открывает SkillTraits → видны gift/shadow для открытых уровней (на L3 ещё дилемма) → инсайт сохраняется → ← Назад возвращает в SkillDetail.

### Этап 7. FeSkillTree — обновить CTA (1 шаг)

7.1. В `components/JourneyView/FeSkillTree.jsx` (или `CheSkillTree.jsx`):
- Для навыков с `passes>0` дополнительная пилюля под навыком:
  ```jsx
  <button
    type="button"
    className={styles.treeSkillDevBtn}
    onClick={(e) => { e.stopPropagation(); onOpenSkillDetail(skill.id) }}
  >
    Узнать, как развить →
  </button>
  ```
- Существующий ⓘ оставить как secondary (квадратная кнопка справа), tooltip «Как развить навык».

**Verify:** в колесе ЧЭ у пройденных навыков виден явный CTA вместо только мелкого ⓘ.

### Этап 8. Бамп CONTENT_VERSION + миграция insights (1 шаг)

8.1. Найти текущий `CONTENT_VERSION` в `JourneyView.jsx` (на момент написания плана был 16, мог уже подняться).

8.2. Бампнуть на +1, добавить комментарий:
```js
// vXX — экраны «Как развить» (SkillDetail) и «Какие черты» (SkillTraits)
//      для Fe-навыков. state.skills[id].insights[] получили опциональные
//      поля source ('survey'|'detail'|'traits') и level (1|2|3).
//      Migration data-preserving: старые записи получают source='survey'.
//      Чат НЕ сбрасывается.
```

8.3. В `migrateState` добавить миграцию инсайтов:
```js
function migrateSkillInsights(stored) {
  const skills = stored.skills ?? {}
  const next = { ...skills }
  let changed = false
  for (const [id, entry] of Object.entries(skills)) {
    const insights = entry?.insights ?? []
    if (!Array.isArray(insights) || insights.length === 0) continue
    const upgraded = insights.map(ins => ({ source: 'survey', ...ins }))
    if (upgraded.some((u, i) => u !== insights[i])) {
      next[id] = { ...entry, insights: upgraded }
      changed = true
    }
  }
  return changed ? { ...stored, skills: next } : stored
}
```
Вызвать в `migrateState` перед version-check (data-preserving). Это **не** должно триггерить сброс чата.

**Verify:** существующий юзер с сохранёнными инсайтами после анкет получает их обратно с полем `source: 'survey'`. Чат, прогресс, XP — всё на месте.

### Этап 9. Smoke-тесты на проде

End-to-end сценарий (проверить вручную, желательно в инкогнито с админ-флагом):

1. ✅ Дашборд → планета ЧЭ → пройти L0 (или admin jump на L1).
2. ✅ Колесо ЧЭ → клик на «Эмоциональная осознанность» → запускается анкета.
3. ✅ 5 утверждений первого прохода → SurveyInsight.
4. ✅ Кнопка читается «Сохранить и узнать, как развить →». Записать инсайт → клик.
5. ✅ Открылся SkillDetail с заголовком «Как развить навык: Эмоциональная осознанность».
6. ✅ L1 «Чувствующий» — открыта (essence/actions/practices/criteria/pitfalls); L2/L3 закрыты с понятным сообщением.
7. ✅ В L1-карточке раскрыть «✎ Записать инсайт» → ввести текст → сохранить. Видно, что инсайт уехал в дневник.
8. ✅ Внизу страницы найти «Какие психологические черты это развивает →» → клик.
9. ✅ SkillTraits: gift+shadow для L1, L2/L3 закрыты.
10. ✅ Записать инсайт на странице черт → сохранить.
11. ✅ ← Назад → возврат в SkillDetail. ← Назад → колесо.
12. ✅ Через админ jump на L1 + ещё один проход анкеты → теперь L2 открывается в обоих экранах.
13. ✅ В дневнике появились записи `source: 'journey-skill-insight'` для каждого сохранённого инсайта.
14. ✅ Перезагрузить страницу — `state.skills[id].insights[]` сохранились с правильными полями `source` и `level`.

### Этап 10. Деплой

```
git add -A
git commit -m "feat(fe): развитие навыков ЧЭ — экраны Как развить + Какие черты + инсайты"
git push origin slw-instruct
cd slw-main/slw-main && npm run deploy
```

---

## Что не делаем в этой задаче

1. **«Взять в задания» с экспой** — отдельная фича. Структура `practices: [{ name, desc, xp }]` готова к этому, кнопка добавится потом.
2. **Контент для БС/ЧИ/БИ/ЧЛ/БЭ** — повторяем паттерн потом для каждого аспекта в его подпапке `data/skills/<Latin>/`.
3. **Backend-эндпоинт для skill-insights отдельно** — не нужен. Пишем в `state.skills` (через `saveJourney`) + в дневник (через `postDiaryEntry`).
4. **Шаринг инсайтов в Холле** — отдельная фича.

---

## Принципы качества (без техдолга)

- Нет хардкода аспект-логики в компонентах: всё через единый `getSkillContent`.
- Нет дубликатов: `InsightInput` общий, `getUnlockedSkillLevel` общая.
- Нет magic strings: типы инсайтов в константах (`'survey'|'detail'|'traits'`).
- CSS Modules для всех новых компонентов; не плодить inline-styles.
- Бамп `CONTENT_VERSION` обязателен (изменена структура `state.skills[].insights[]`).
- Миграция data-preserving (чат не сбрасывается).
- Каждый этап имеет verify-критерий.
- Коммит после каждого этапа (или после группы 1.1–1.5 одним коммитом для контента).
- После реализации — этот файл удалить или переместить в `_DONE_*`.

---

## Шпаргалка: что трогать

**Создать:**
- `data/skills/Fe/{core,zavodila,orator,artist,master-atmo,index}.js`
- `data/skills/index.js`
- `components/JourneyView/InsightInput.jsx` (+ стили)
- `components/JourneyView/SkillTraits.jsx` (+ стили)

**Изменить:**
- `components/JourneyView/SkillDetail.jsx` — header, InsightInput на каждой unlocked-карточке, кнопка «Какие черты», импорт из `data/skills/`.
- `components/JourneyView/SurveyInsight.jsx` — кнопка «Сохранить и узнать, как развить →».
- `components/JourneyView/FeSkillTree.jsx` — пилюля «Узнать, как развить →» у навыков с `passes>0`.
- `components/JourneyView/JourneyView.jsx` — handler `handleSaveSkillInsight`, рендер `screen='skill-traits'`, импорт SkillTraits, переход после SurveyInsight, бамп `CONTENT_VERSION`, миграция `insights`.
