# TS Migration Handoff — Phase 2 / Phase 3

Этот файл — оперативный передача состояния от старой сессии Claude (которая выполнила Phase 0 и Phase 1) к новой. Прочитай этот файл целиком + `slw-main/slw-main/TS_MIGRATION_PLAN.md` — и можно продолжать с Phase 2.

---

## Состояние на момент handoff

**Дата:** 2026-05-18.
**Что сделано:** Phase 0 (bootstrap) + Phase 1 (foundation, 4 параллельных агента) полностью.
**Что осталось:** Phase 2 (7 параллельных компонентов) + Phase 3 (integration + App.jsx + main.jsx).
**Текущий tsc статус:** 0 ошибок по всему проекту (`cd slw-main/slw-main && npx tsc --noEmit`).

### Git

- **Рабочая ветка:** `ts-migration` (запушена в `origin/ts-migration`)
- **HEAD коммит:** `dc4e5a5 ts(p1b): merge data/skills/`
- **Baseline:** `slw-instruct` (не трогаем — туда мерджим в самом конце)
- **Worktrees:** удалены, временные ветки удалены, остался только основной worktree в репо
- **Pending stash:** `stash@{0}: On slw-instruct: fe-methodology-wip` — содержит правки пользователя в `Fe/_МЕТОДОЛОГИЯ опиания аспекта.md` (контент-работа, не TS). Восстанавливать **только после финального merge в slw-instruct**.

### Что лежит на диске

- **Git repo root:** `C:\Serge\slw-slw-instruct\slw-slw-instruct\` (вложен — родительская папка `slw-slw-instruct\` НЕ git-repo)
- **Frontend root:** `slw-main\slw-main\` относительно git root
- **Все типы:** `src/types/` (создано Phase 0): `index.ts`, `aspect.ts`, `api.ts`, `journey.ts`, `skill.ts`, `script.ts`, `storage.ts`, `telegram.ts` (создан P1A)
- **План:** `slw-main/slw-main/TS_MIGRATION_PLAN.md` (1489 строк)
- **OpenAPI snapshot:** `slw-main/slw-main/scripts/openapi.json` (107.7 kB, схема FastAPI с Railway)

---

## Lessons learned — критично для Phase 2

### 1. Sub-agents НЕ имеют shell-доступа

Когда я запускал агентов через `Agent` tool **без** `isolation: "worktree"`, у них **нет Bash / PowerShell**. Только Read/Write/Edit/Glob/Grep. Они физически не могут запускать `git`, `npm`, `tsc`.

`isolation: "worktree"` **дал** shell agentам в Phase 0, но требует чтобы мой CWD был внутри git-репо. Моя CWD `/c/Serge/slw-slw-instruct/` (родительская, НЕ репо). Соответственно `isolation: "worktree"` не работает.

**Подход:** «гибридный режим».
- **Я (координатор)** создаю worktree через `git worktree add`, делаю `npm install`, запускаю `tsc`, делаю `git rm` старых `.js`, делаю `git commit`.
- **Агенты** только конвертируют файлы (Read/Write/Edit). Оставляют оригиналы `.js` на месте.

Это устойчиво работает.

### 2. Большие архетип-файлы упираются в token budget

P1B агент должен был конвертировать ~57 файлов (8 архетипов × ~5 файлов). Он успел сделать ~17 (foundation: aggregators + core.ts) и упёрся в budget на больших архетип-файлах (1500-2500 LOC каждый).

**Решение, которое сработало:** массовая конверсия через bash+sed. Архетип-файлы однотипные — `export const NAME = { ... }` где NAME заглавными. Шаблон:

```bash
declare -A MAP=(["Si/aesthete"]="AESTHETE" ["Si/healer"]="HEALER" ...)
for key in "${!MAP[@]}"; do
  name="${MAP[$key]}"
  src="${key}.js"; dst="${key}.ts"
  [ -f "$dst" ] && continue
  cp "$src" "$dst"
  sed -i "s|^export const ${name} = {|export const ${name}: Record<string, Skill> = {|" "$dst"
  sed -i "1i import type { Skill } from '@/types/skill'\n" "$dst"
done
```

Для Phase 2 это вряд ли применимо (компоненты сложнее), но если P2A (JourneyView core с 2.3k LOC главным файлом) упрётся — разбивай по файлам и/или делай вручную через Edit.

### 3. Phase 0 типы могут быть уже реальности

Phase 0 определил `SkillLevel.pitfalls: string[]` как required, но Fe-архетипы его не имеют → 106 tsc-ошибок. **Я исправил `pitfalls?: string[]`** в `src/types/skill.ts`.

**Аналогичный риск для Phase 2:** если компонент использует поле из `JourneyState`/`AspectState`/etc, которого Phase 0 не учёл — добавляй `?` (optional) в типе, не правь данные. Тип `src/types/*.ts` правится только координатором (тобой), не агентами. P3 будет финальная уборка.

### 4. Cross-zone ошибки до мержа — это нормально

После завершения P1B в worktree `tsc` показывал 8 ошибок «не может найти модуль `../journey/skills`» — это потому что `src/data/journey/` в этом worktree ещё `.js` (зона P1C). После мержа всех 4 веток в `ts-migration` — 0 ошибок. Это ожидаемое поведение, не баг.

**В Phase 2:** компоненты импортят `src/data/*` (уже `.ts`), `src/api/*` (уже `.ts`), и `src/App.jsx` (ещё `.jsx`!). App.jsx переводит Phase 3. Соответственно компоненты-агенты Phase 2 могут получать ошибки на импорте из App.jsx — это **разрешится в Phase 3**.

### 5. P1B специфические правки в `types/skill.ts` (уже сделано)

```ts
// src/types/skill.ts
export type SkillLevel = {
  // ...
  pitfalls?: string[]  // optional: Fe archetypes omit this
  // ...
}
```

Если Phase 2 потребует ещё расширения skill/journey/script типов — делай аналогично (optional поля, не required).

### 6. Te/skill-blocks использует index signature

`src/data/skills/Te/skill-blocks.ts` имеет локальный `type SkillBlock = { ... [key: string]: unknown }` потому что Te financial-блоки имеют расширенные поля (intro, selfWorth, confidence, sections). Не unify в общий тип сейчас — Phase 3 может.

### 7. Worktree path и Windows кириллица

`git stash push -- "Fe/<кириллица>.md"` упал с ошибкой кодировки. Пришлось делать `git stash push` без pathspec (стэшнуло все unstaged) и план остался untracked. Сейчас stash содержит только модификации Fe/.md, untracked не трогалось.

Не возникнет в Phase 2 если ты сам не будешь работать с Fe/.

---

## Команды для Phase 2 — что делать новому Claude

### Шаг 0: проверка состояния

```bash
cd /c/Serge/slw-slw-instruct/slw-slw-instruct
git status                          # should be clean on ts-migration
git log -1 --oneline                # should show dc4e5a5 ts(p1b): merge data/skills/
git worktree list                   # should show only main worktree
cd slw-main/slw-main
npx tsc --noEmit                    # should exit 0 with no output
```

Если что-то не так — STOP и разберись.

### Шаг 1: создать 7 worktrees + npm install

```bash
cd /c/Serge/slw-slw-instruct/slw-slw-instruct

# Создаём 7 веток + worktrees от ts-migration
for w in p2a-journey-core p2b-journey-trees p2c-aspects p2d-diary-dash p2e-admin-auth p2f-social p2g-shell; do
  git worktree add .claude/worktrees/${w} -b ts-${w} ts-migration
done

git worktree list   # verify 8 entries (main + 7)

# npm install в каждом worktree (параллельно через background)
for w in p2a-journey-core p2b-journey-trees p2c-aspects p2d-diary-dash p2e-admin-auth p2f-social p2g-shell; do
  (cd .claude/worktrees/${w}/slw-main/slw-main && npm install) &
done
wait
echo "all installed"
```

(Для bash tool это будут 7 параллельных background-команд, потом ждёшь их завершения через уведомления.)

### Шаг 2: запустить 7 агентов в фоне (одно сообщение, 7 Agent calls)

Промпт-шаблон для каждого — ниже. Различается только: зона ответственности + название агента + worktree path.

**Agent prompt template** (заменить `<AGENT_ID>` и `<WHITELIST>`):

```
You are executing **Phase <AGENT_ID>** of the TypeScript migration for the SLW frontend.

## YOU HAVE NO SHELL ACCESS
Only Read, Edit, Write, Glob, Grep. The coordinator runs all shell ops.

## Your worktree (absolute path)
C:/Serge/slw-slw-instruct/slw-slw-instruct/.claude/worktrees/<AGENT_ID-LC>

All paths in this prompt are relative to the worktree root. Use absolute paths in Read/Write.

## Verify Phase 1 artifacts
Use Read on:
- slw-main/slw-main/tsconfig.json
- slw-main/slw-main/src/types/index.ts  (must export AspectKey, Skill, JourneyState, Script, etc.)
- slw-main/slw-main/src/api/client.ts   (must be .ts, not .js)
- slw-main/slw-main/src/data/aspects.ts  (must be .ts)

If any missing → STOP and report. Phase 0+1 should be merged into ts-migration baseline.

## Read first
1. slw-main/slw-main/TS_MIGRATION_PLAN.md — sections "Часть 3" + "Agent <AGENT_ID>"
2. CLAUDE.md at worktree root
3. Spot-read 2-3 component files in your zone before writing types — actual shape matters

## Your whitelist (ONLY these files)
<WHITELIST — exact list of .jsx/.js paths under slw-main/slw-main/src/components/...>

## Rules (same as Phase 1)
- No `any`, no `@ts-ignore`, no `@ts-nocheck`. Use `unknown` + narrowing.
- Type-only imports: `import type { X } from '@/types/...'`
- Pattern: type Props = {...}, function Component({...}: Props) {...}
- Surgical: types + filename only. Don't refactor logic.
- DO NOT modify src/types/*.ts (coordinator handles that).
- LEAVE original .jsx/.js files alone — coordinator git-rm's them.

## Per-component pattern
```tsx
import type { AspectKey } from '@/types/aspect'
import type { JourneyState } from '@/types/journey'

type Props = {
  aspect: AspectKey
  state: JourneyState
  onClose: () => void
}

export function MyComponent({ aspect, state, onClose }: Props) {
  // original body unchanged
}
```

Common props patterns:
- `t: (key: string) => string` — locale fn (any string key for now)
- `user: User | null` — from `@/types/api` paths
- callbacks: `(arg: T) => void` (or `=> Promise<void>` if async)
- event handlers: `React.MouseEvent<HTMLButtonElement>`, `React.ChangeEvent<HTMLInputElement>`
- children: `React.ReactNode`

## Known shape-divergence gotchas
- `SkillLevel.pitfalls` is **optional** (Fe archetypes omit it). If you see `pitfalls?` errors, it's already the right shape.
- `ChatMessage.id` is `number | string` (some places use Date.now()+random, others string counters)
- `ChatMessage.text` is optional (script-kind messages reference scriptId without text)
- `ScreenName` includes 'levelcomplete', 'admin-skills', 'skill-traits' (not just plan-listed values)

## Final report
1. Files renamed (list)
2. New files created (if any, with justification)
3. Any TODO(ts): markers left + reasons
4. Anything flagged (shape divergence, unexpected shape)
5. Status: "Ready for coordinator verification"

Coordinator will run tsc and commit. If errors → returns to you.

Begin.
```

### Phase 2 зоны (whitelist для каждого агента)

#### P2A — JourneyView core
**Worktree:** `.claude/worktrees/p2a-journey-core`
**Branch:** `ts-p2a-journey-core`
**Whitelist:** `slw-main/slw-main/src/components/JourneyView/*.jsx` **КРОМЕ** `*SkillTree.jsx`

Список (~21 файл): `JourneyView.jsx` (2336 LOC — самый большой!), `Chat.jsx`, `InsightInput.jsx`, `JourneyProfile.jsx`, `LevelComplete.jsx`, `MarkdownLite.jsx`, `Onboarding.jsx`, `PlanetMap.jsx`, `ScriptButtons.jsx`, `ScriptCard.jsx`, `StepInsightPrompt.jsx`, `SurveyScreen.jsx` (если есть), `AdminPanel.jsx`, `AdminSkillsEditor.jsx`, `FeCoreOverview.jsx`, и другие НЕ `*SkillTree.jsx`.

**Внимание P2A:** `JourneyView.jsx` имеет много state-machine логики (`migrateState`, `migrateCyrAspectKeys`, `aspectOf`, `updateAspect`, `handleScriptAction`, `awardXP`). Все типы для state — в `@/types/journey`. `CONTENT_VERSION` оставить без изменений (это data versioning, не TS).

Если P2A упрётся в budget на `JourneyView.jsx` — спека плана разрешает выделить хелперы в отдельные файлы НО агент это делать **не должен**. Лучше координатор довод вручную через Edit.

#### P2B — Journey skill trees
**Worktree:** `.claude/worktrees/p2b-journey-trees`
**Branch:** `ts-p2b-journey-trees`
**Whitelist:** `slw-main/slw-main/src/components/JourneyView/*SkillTree.jsx` (8 файлов)

Имена: `FeSkillTree.jsx`, `FiSkillTree.jsx`, `NeSkillTree.jsx`, `NiSkillTree.jsx`, `SeSkillTree.jsx`, `SiSkillTree.jsx`, `TeSkillTree.jsx`, `TiSkillTree.jsx`. Возможно есть `SkillTree.jsx` без префикса — тоже сюда.

Все однотипные: принимают `state: JourneyState`, callbacks, рендерят дерево навыков. Импортят соответствующее tree из `@/data/journey/skills/*-tree.ts` (P1C сделал).

#### P2C — AspectsView
**Worktree:** `.claude/worktrees/p2c-aspects`
**Branch:** `ts-p2c-aspects`
**Whitelist:** `slw-main/slw-main/src/components/AspectsView/*` — все 12 файлов:
- `AspectsView.jsx`
- `FeWheel.jsx`, `FiWheel.jsx`, `NeWheel.jsx`, `NiWheel.jsx`, `SeWheel.jsx`, `SiWheel.jsx`, `TeWheel.jsx`, `TiWheel.jsx`
- `PlaceholderWheel.jsx`
- `HabitSection.jsx`
- `blocks.js` — это **data-like модуль в компонентной папке**. Перевести вместе с компонентами. Определить local types `Block`, `BlockKind`, `BlockLevel`.

#### P2D — Diary + Dashboard + Heatmap
**Worktree:** `.claude/worktrees/p2d-diary-dash`
**Branch:** `ts-p2d-diary-dash`
**Whitelist:** 
- `slw-main/slw-main/src/components/DiaryView/*.jsx` (6: DiaryView, DailyReview, AnalyticsTab, EmotionsTab, TrainingsTab, VaultSyncTab)
- `slw-main/slw-main/src/components/DashboardView/*.jsx` (3: DashboardView, MiniWheel, DiscoverMore)
- `slw-main/slw-main/src/components/Heatmap/*.jsx` (1)

#### P2E — Admin + Auth + Profile + Settings
**Worktree:** `.claude/worktrees/p2e-admin-auth`
**Branch:** `ts-p2e-admin-auth`
**Whitelist:**
- `slw-main/slw-main/src/components/AdminView/*.jsx` (6: AdminView, BulkTab, ModerationTab, NotifyTab, StatsTab, UsersTab)
- `slw-main/slw-main/src/components/Auth/*.jsx` (1: AuthModal)
- `slw-main/slw-main/src/components/ProfileView/*.jsx` (1)
- `slw-main/slw-main/src/components/PublicProfileView/*.jsx` (2)
- `slw-main/slw-main/src/components/SettingsView/*.jsx` (1)

#### P2F — Social views
**Worktree:** `.claude/worktrees/p2f-social`
**Branch:** `ts-p2f-social`
**Whitelist:**
- `slw-main/slw-main/src/components/CoachView/*.jsx`
- `slw-main/slw-main/src/components/HallView/*.jsx`
- `slw-main/slw-main/src/components/DMView/*.jsx`
- `slw-main/slw-main/src/components/LeaderboardView/*.jsx`
- `slw-main/slw-main/src/components/SearchView/*.jsx`
- `slw-main/slw-main/src/components/Notifications/*.jsx`

#### P2G — Shell
**Worktree:** `.claude/worktrees/p2g-shell`
**Branch:** `ts-p2g-shell`
**Whitelist:**
- `slw-main/slw-main/src/components/Header/*.jsx` (включая NotificationsBell если внутри)
- `slw-main/slw-main/src/components/Footer/*.jsx`
- `slw-main/slw-main/src/components/Toast/*.jsx`
- `slw-main/slw-main/src/components/LoadingScreen/*.jsx`
- `slw-main/slw-main/src/components/Welcome/*.jsx`
- `slw-main/slw-main/src/components/Onboarding/*.jsx` (если есть отдельно — иначе уже в JourneyView)

### Шаг 3: координирование завершений

Для каждого завершившегося агента (получаешь `<task-notification>`):
```bash
cd /c/Serge/slw-slw-instruct/slw-slw-instruct/.claude/worktrees/<wt>/slw-main/slw-main
git rm <list-of-old-jsx-files>           # удалить старые
git add -A                                # добавить новые .tsx
npx tsc --noEmit 2>&1 > /tmp/tsc.log
# Ожидаемо: ошибки в App.jsx (cross-zone, resolved by P3). Ошибки в зоне = 0.
git commit -m "ts(p2x): convert <zone> to TypeScript"
```

Если ошибки в зоне ≠ 0 — посмотри что за проблема. Часто это shape divergence — добавь optional поле в `src/types/*.ts` (после согласования с собой что это правильно).

После всех 7 завершившихся:
```bash
cd /c/Serge/slw-slw-instruct/slw-slw-instruct
git checkout ts-migration
for b in ts-p2a-journey-core ts-p2b-journey-trees ts-p2c-aspects ts-p2d-diary-dash ts-p2e-admin-auth ts-p2f-social ts-p2g-shell; do
  git merge --no-ff $b -m "ts: merge ${b#ts-}"
done

# Verify: tsc в основной должен показать ТОЛЬКО ошибки в App.jsx/main.jsx (cross-zone — resolve at Phase 3)
cd slw-main/slw-main
npx tsc --noEmit 2>&1 | grep "error TS" | wc -l   # expect: small count, all in App.jsx / main.jsx

# Push
cd ..; cd ..
git push

# Cleanup
for w in p2a-journey-core p2b-journey-trees p2c-aspects p2d-diary-dash p2e-admin-auth p2f-social p2g-shell; do
  git worktree remove -f -f .claude/worktrees/${w}
  git branch -D ts-${w}
done
```

---

## Phase 3 — final integration

После Phase 2 — один агент конвертит:
- `src/App.jsx` → `App.tsx` (большой root-компонент, читай по плану)
- `src/main.jsx` → `main.tsx`
- Прогнать финальный `tsc` (должно быть 0)
- Удалить все `TODO(ts):` маркеры (или обоснованно оставить как NOTE)
- Обновить `package.json` script: `"build": "tsc --noEmit && vite build"`
- Обновить `CLAUDE.md`: добавить «Frontend stack: TypeScript strict»

Создать worktree аналогично:
```bash
git worktree add .claude/worktrees/p3-integration -b ts-p3-integration ts-migration
cd .claude/worktrees/p3-integration/slw-main/slw-main
npm install
```

Запустить агента P3 (тоже hybrid mode, не shell). Whitelist:
- `slw-main/slw-main/src/App.jsx`
- `slw-main/slw-main/src/main.jsx`
- любые остаточные `*.jsx`/`*.js` в `src/` если есть (Glob проверит)
- разрешено править `package.json` (script `build`)
- разрешено править `CLAUDE.md` (минимально, +1 строка про TS)

После завершения P3:
```bash
# Verify tsc clean
cd slw-main/slw-main && npx tsc --noEmit   # MUST be 0 errors
npm run build                                # MUST succeed

# Merge into ts-migration
cd ../..
git checkout ts-migration
git merge --no-ff ts-p3-integration -m "ts(p3): merge final integration"
git push

# Cleanup
git worktree remove -f -f .claude/worktrees/p3-integration
git branch -D ts-p3-integration
```

---

## Финальный merge — ts-migration → slw-instruct

После Phase 3 готов production-merge:

```bash
cd /c/Serge/slw-slw-instruct/slw-slw-instruct

# Сначала smoke test локально
cd slw-main/slw-main
npm run dev    # открыть в браузере, проверить ключевые экраны
# Если работает — продолжаем

# Merge
cd ../..
git checkout slw-instruct
git merge --no-ff ts-migration -m "feat(ts): full migration to TypeScript strict mode"
git push   # Railway auto-deploys backend (но backend не менялся, ничего страшного)

# Frontend deploy
cd slw-main/slw-main
npm run deploy   # gh-pages

# Восстановить stash пользователя (Fe-контент)
cd /c/Serge/slw-slw-instruct/slw-slw-instruct
git stash pop   # вернёт правки в Fe/_МЕТОДОЛОГИЯ опиания аспекта.md в working dir
git status     # покажет modified Fe/.md — это нормально, пользователь сам решит когда коммитить
```

---

## Контрольный список для нового Claude

При старте новой сессии:

1. [ ] Прочитал этот файл целиком
2. [ ] Прочитал `slw-main/slw-main/TS_MIGRATION_PLAN.md` (минимум Phase 2 и Phase 3 секции)
3. [ ] Проверил состояние через «Шаг 0»
4. [ ] Готов запускать Phase 2

Когда пользователь скажет «запускай Phase 2» (или просто «продолжай») — действуй по плану выше.

Не ждать инструкций между Phase 2 → Phase 3, если пользователь не остановит — после успешного мержа Phase 2 сам предложи запускать Phase 3. После Phase 3 — спроси у пользователя готов ли он к финальному merge в slw-instruct и smoke test.

---

## Что пошло хорошо в Phase 1 (для уверенности)

- Phase 0 + Phase 1 закончились с **0 tsc ошибок по всему проекту**
- Все 4 параллельные ветки Phase 1 смержились без конфликтов (зоны были непересекающиеся)
- Cross-zone ошибки во время работы агента в worktree — нормальное явление, разрешаются мержем
- Hybrid mode (агенты = код, я = shell) работает устойчиво

## Что было сложно

- Phase 0 worktree случайно создался не от ts-migration — агент сам нашёл и сделал `git reset --hard`. В Phase 2 этого не будет (worktrees создаются явно мной с `-b ts-XXX ts-migration` — гарантированно от правильного коммита).
- P1B token budget — упёрся на 17/57 файлов. Я добил вручную через sed (см. Lessons learned #2). Для Phase 2 готов к тому же на P2A (`JourneyView.jsx` 2.3k LOC).
- `pitfalls` shape divergence — решилось `?` в `types/skill.ts`. Аналогичные правки могут потребоваться для других полей journey/script/etc.

---

**Конец handoff.**
