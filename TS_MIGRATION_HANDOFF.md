# TS Migration Handoff — Phase 3

Передача состояния от старой сессии Claude (Phase 0+1+2 завершены) к новой. Прочитай этот файл целиком + `slw-main/slw-main/TS_MIGRATION_PLAN.md` (минимум секции Phase 3 и Часть 3 «Общие правила») — и можно продолжать с Phase 3 (финал).

---

## Состояние на момент handoff

**Дата:** 2026-05-18.
**Что сделано:** Phase 0 (bootstrap) + Phase 1 (4 параллельных агента foundation) + Phase 2 (7 параллельных агентов components) — полностью.
**Что осталось:** Phase 3 (1 агент: `App.jsx` → `App.tsx`, `main.jsx` → `main.tsx`, очистка `TODO(ts):`, финал).

**Текущий tsc статус:** **0 ошибок** по всему проекту (`cd slw-main/slw-main && npx tsc --noEmit`).

### Git

- **Рабочая ветка:** `ts-migration` (запушена в `origin/ts-migration`)
- **HEAD коммит:** `ebc5550 ts: widen Hint.tsx HintUser to unknown, drop ts-expect-error`
- **Последние 12 коммитов** — финал Phase 2:
  ```
  ebc5550 ts: widen Hint.tsx HintUser to unknown, drop ts-expect-error
  e726e2b ts: merge p2c-aspects
  c2fa48b ts: merge p2a-journey-core
  d27e17b ts: merge p2e-admin-auth
  cd2bd1e ts: merge p2d-diary-dash
  9098fda ts: merge p2b-journey-trees
  ce0f291 ts: merge p2f-social
  2c2c364 ts: merge p2g-shell
  6cb8992 ts(p2c): convert AspectsView (11 components + blocks.ts) to TypeScript
  590db09 ts(p2a): convert JourneyView core components to TypeScript
  20dc6cf ts(p2e): convert Admin, Auth, Profile, PublicProfile, Settings to TypeScript
  ba1af51 ts(p2d): convert DiaryView, DashboardView, Heatmap to TypeScript
  ```
- **Baseline:** `slw-instruct` (не трогаем — туда мерджим в самом конце после Phase 3)
- **Worktrees:** удалены (только основной)
- **Pending stash:** `stash@{0}: On slw-instruct: fe-methodology-wip` — содержит правки пользователя в `Fe/_МЕТОДОЛОГИЯ опиания аспекта.md` (контент-работа, не TS). Восстанавливать **только после финального merge в slw-instruct**.

### Что осталось `.jsx`/`.js` в `src/`

```
src/App.jsx       (root компонент, ~1k+ LOC, использует ВСЕ типы)
src/main.jsx      (тривиальный entry-point)
```

Всё остальное — TypeScript. Plus `*.module.css` (типизированы через ambient в Phase 0) и `*.md?raw` (тоже ambient).

---

## Phase 2 итоги (для контекста P3)

### Что сделали 7 параллельных агентов
75 файлов `.jsx`/`.js` → `.tsx`/`.ts`:
- **P2A** (21): JourneyView core — JourneyView.tsx 2.3k LOC, Chat, PlanetMap, ScriptCard, SurveyScreen, и т.п.
- **P2B** (8): JourneyView/*SkillTree.tsx
- **P2C** (12): AspectsView + blocks.ts (12 файлов, 0 ошибок tsc сразу — образцовая работа)
- **P2D** (10): DiaryView (6) + DashboardView (3) + Heatmap (1)
- **P2E** (11): AdminView (6) + Auth + ProfileView + PublicProfileView (2) + SettingsView
- **P2F** (6): CoachView + HallView + DMView + LeaderboardView + SearchView + NotificationsBell (0 ошибок tsc сразу)
- **P2G** (7): Header + Footer + Toast + LoadingScreen + Welcome + Onboarding/{Hint,IntroTour}

### Координаторские правки в Phase 2 (что я делал руками)

Это правки **вне зон агентов**, которые потребовались для устранения in-zone ошибок:

1. **`src/types/journey.ts`** (стало моим, как координатора):
   - `SkillState.answers?: Record<string, SkillAnswer[]>` → `Record<string, number[]>` — runtime реально использует `number[]`, унификация с `SkillStateEntry`. `SkillAnswer` тип остался для возможного future use, можно удалить в P3.
   - `ScreenName` расширен: добавлены `'tasks' | 'fe-core-overview'` (использовались в runtime).

2. **`src/components/Onboarding/Hint.tsx`** (P2G): `HintUser` → `unknown` с runtime narrowing (через `as { hints_seen?: ... }`). Причина: компоненты-консьюмеры передают `user: unknown` из App.jsx (.jsx). После P3 можно сузить через canonical User.

3. **`src/components/DiaryView/DiaryView.tsx`** (P2D): `user: unknown` → `Record<string, unknown> | null`. Также cast при передаче `diary` в `DailyReview` через `as Parameters<typeof DailyReview>[0]['diary']` — DiaryView и DailyReview определили **два разных типа** `DiaryEntryRecord` vs `DiaryEntry`. Унификация — TODO для P3.

4. **`src/components/JourneyView/Chat.tsx` + `Onboarding.tsx`** (P2A): `RefObject<T | null>` → `RefObject<T>`. React 18 LegacyRef в JSX-атрибуте `ref` не принимает `RefObject<T | null>`.

### Lessons learned (Phase 2)

1. **Hybrid mode остался устойчивым** — sub-agents без shell, координатор делает git/npm/tsc. Worktree-create через явный `git worktree add <path> -b <branch> ts-migration`.

2. **Default vs named export — терпимо**: план рекомендовал named export (`export function Foo`), но P2D и P2E агенты использовали `export default function Foo`. Оба работают если импорты тоже соответствуют. Не настаивать на одном стиле — реально важно чтобы импорт и экспорт совпадали.

3. **Cross-zone ошибки от .jsx-импортов внутри worktree — нормально**. Все `Could not find a declaration file for module '...jsx'` / `implicitly has an 'any'` исчезают после merge всех веток. Не паниковать.

4. **P2A потребовал координаторской правки types/journey.ts** (как Phase 1 потребовал правки types/skill.ts для `pitfalls?`). Это нормальная цена строгости — Phase 0 не мог предсказать всё, agent корректно оставил `TODO(ts)` маркеры, координатор решил. P3 будет делать то же самое для `App.tsx`.

5. **HintUser=unknown — паттерн для "user приходит из .jsx с unknown шейпом"**: компонент принимает `unknown`, узко тянет нужные поля через `as { ... }` cast. Можно использовать в P3 если найдутся аналогичные узкие места.

6. **Один агент идеален (P2C)** — 0 ошибок tsc сразу после конверсии. Другие требовали 0-11 координаторских правок. План работает.

7. **Worktree paths на Windows работают** через bash-стиль `/c/Serge/...` или через PowerShell-стиль `C:\Serge\...`. Использовал Bash tool — POSIX-стиль везде.

---

## Phase 3 — план работ

**Worktree:** `.claude/worktrees/p3-integration`
**Branch:** `ts-p3-integration` от `ts-migration`
**Зависимости:** Phase 0 + 1 + 2 завершены и смержены (✓ — на момент handoff)

### Setup-команды (выполняешь ты, координатор)

```bash
cd /c/Serge/slw-slw-instruct/slw-slw-instruct

# 1. Проверка состояния
git status                          # clean on ts-migration
git log -1 --oneline                # ebc5550
git worktree list                   # только main
cd slw-main/slw-main
npx tsc --noEmit                    # 0 errors

# 2. Создать worktree для P3
cd /c/Serge/slw-slw-instruct/slw-slw-instruct
git worktree add .claude/worktrees/p3-integration -b ts-p3-integration ts-migration

# 3. npm install в worktree
cd .claude/worktrees/p3-integration/slw-main/slw-main
npm install --prefer-offline --no-audit --no-fund
```

### Что делает агент P3

Это **последний агент**, поэтому у него нет ограничений по «зонам» — он может править любые `.tsx` для устранения сквозных ошибок. Но **не должен** делать рефакторинг сверх необходимого.

**Задачи:**

1. **Конвертировать `src/App.jsx` → `App.tsx`** (главный root):
   - Большой файл, использует ВСЕ типы (`JourneyState`, `User`, `Toast`, `ViewName`, etc.)
   - Содержит `stateVersionRef`, `saveStateGuarded`, optimistic locking логику (см. CLAUDE.md «Optimistic locking»)
   - Содержит парсинг `?u=<id>` deeplink на профиль
   - Содержит тост-очередь
   - `view`-роутер с большим switch по `ViewName`
   - **Канонический User тип** — типизировать через `paths['/api/auth/me']` или объявить local `User` интерфейс в `src/types/user.ts` (опционально — если канонический тип нужен в нескольких местах).

2. **Конвертировать `src/main.jsx` → `main.tsx`** (тривиальный entry-point с `createRoot`).

3. **Зачистить `TODO(ts):` маркеры по всему `src/`:**
   ```bash
   cd /c/Serge/slw-slw-instruct/slw-slw-instruct/.claude/worktrees/p3-integration/slw-main/slw-main
   grep -rn "TODO(ts):" src/ | wc -l   # сколько осталось
   grep -rn "TODO(ts):" src/            # список с контекстом
   ```
   Для каждого — либо реально починить тип, либо обосновать и заменить на `// NOTE(ts): <причина>`.

4. **Возможные сквозные правки** (что P3 агент может встретить):
   - `User` тип — сейчас компоненты типизируют user как `unknown` / `Record<string, unknown>` / локальный `HintUser=unknown` / etc. Сузить через canonical User в `App.tsx` и пробросить вниз. **Не обязательно** широко — если только этот фикс не triggered тестом.
   - `DiaryEntry` vs `DiaryEntryRecord` (DiaryView vs DailyReview) — унификация. Cast в DiaryView.tsx уже стоит, можно убрать после унификации.
   - `SkillAnswer` тип в `types/journey.ts` — если не используется, удалить.
   - `ActiveSurvey` в `types/journey.ts` — P2A агент пометил расхождение (runtime использует `mode`/`startPass`/`stepIndex`, тип объявил `blockIndex`/`statementIndex`). Унифицировать.

5. **Финальный `tsc --noEmit` — 0 ошибок** (обязательно).

6. **Сборка** `npm run build` — должна пройти.

7. **Обновить `package.json`:**
   ```json
   "scripts": {
     "dev": "vite",
     "build": "tsc --noEmit && vite build",   // ← добавить tsc перед vite build
     "preview": "vite preview",
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist",
     "types:api": "openapi-typescript ./scripts/openapi.json -o src/types/api.ts",
     "typecheck": "tsc --noEmit"
   }
   ```

8. **Обновить `CLAUDE.md`** — добавить наверху (после `## Project: SLW` секции) одну строку:
   ```
   **Frontend stack:** TypeScript strict (`tsc --noEmit` is the gate; `npm run build` does typecheck before Vite).
   ```
   Не больше — `CLAUDE.md` уже большой.

### Whitelist для агента P3

- `src/App.jsx` → `App.tsx`
- `src/main.jsx` → `main.tsx`
- Любые `.tsx`/`.ts` где есть `TODO(ts):` маркер (правит точечно)
- `package.json` (только секция `scripts`)
- `CLAUDE.md` (только +1 строка про TS stack)
- Опционально `src/types/*.ts` — для канонического User, для уборки SkillAnswer, для унификации DiaryEntry, для ActiveSurvey

**Нельзя:**
- Делать массовый рефакторинг компонентов «на улучшение»
- Менять логику миграций (`migrateState`, `migrateCyrAspectKeys`, `CONTENT_VERSION`)
- Трогать backend, .md, .module.css

### Промпт для агента P3

```
You are executing **Phase P3 — final integration** of the TypeScript migration for the SLW frontend.

This is the LAST phase. You have broader whitelist than Phase 2 agents — you may edit `.tsx` files outside core conversion to fix cross-cutting type issues (after Phase 2 there are 0 tsc errors, but converting App.jsx will likely surface new ones).

## YOU HAVE NO SHELL ACCESS
Only Read, Edit, Write, Glob, Grep. The coordinator runs git/npm/tsc. Do NOT delete files (coordinator git-rm's App.jsx + main.jsx after you create .tsx siblings).

## Your worktree
C:\Serge\slw-slw-instruct\slw-slw-instruct\.claude\worktrees\p3-integration

## Verify baseline (Read each)
- C:\Serge\slw-slw-instruct\slw-slw-instruct\.claude\worktrees\p3-integration\slw-main\slw-main\tsconfig.json
- {WT}\slw-main\slw-main\src\App.jsx  (must still be .jsx — your job to convert)
- {WT}\slw-main\slw-main\src\main.jsx
- {WT}\slw-main\slw-main\src\types\index.ts

## Read first
1. {WT}\slw-main\slw-main\TS_MIGRATION_PLAN.md — section "Часть 7. Phase 3"
2. {WT}\TS_MIGRATION_HANDOFF.md — context from Phase 2
3. {WT}\CLAUDE.md — project rules (especially Auth flow, View routing, Optimistic locking, CONTENT_VERSION)

## Tasks (in this order)

### Task 1: Convert main.jsx → main.tsx
Trivial — `createRoot`, render `<App />`. Make sure imports use `.tsx` extension only if file uses one (e.g. `import App from './App'` — Vite resolves both).

### Task 2: Convert App.jsx → App.tsx (the big one)
- Use `JourneyState`, `User`, `Toast`, `ViewName`, `ChatMessage` from @/types
- For `User` — create canonical `src/types/user.ts` if not exists:
  ```ts
  // Minimal User shape used across frontend. Backend lacks response_model
  // for /api/auth/me, so OpenAPI gives index signature only — we declare
  // the fields the frontend actually reads.
  export type User = {
    id?: number | string
    email?: string | null
    is_admin?: boolean
    telegram_id?: number | string | null
    telegram_first_name?: string | null
    telegram_username?: string | null
    hints_seen?: Record<string, boolean>
    [key: string]: unknown
  }
  ```
  Then re-export from `src/types/index.ts`.
- `ViewName` union — confirm by reading App.jsx's view-switch:
  ```ts
  type ViewName = 'dashboard' | 'aspects' | 'journey' | 'diary' | 'coach' | 'hall' | 'profile' | 'public-profile' | 'settings' | 'admin' | 'leaderboard' | 'dm' | 'search'
  ```
- `Toast` — has shape `{ id, kind, title, desc?, icon?, stardust? }` (see Toast/AchievementToast.tsx; P2G already wired this).
- `stateVersionRef`, `saveStateGuarded`, `lastSavePromiseRef`, `saveDebounceRef` — type all refs/promises explicitly.
- `?u=<id>` deeplink — typed URL parsing.
- Tightening downstream: now that App.tsx provides typed `user: User`, you can also tighten:
  - `DiaryView.tsx` Props: `user: User` instead of `Record<string, unknown> | null`
  - `Header.tsx` Props: `user: User` instead of augmented inline type
  - `Hint.tsx` HintUser: `User | null | undefined` instead of unknown (or keep unknown if simpler)
  - But only if it's a quick win — don't refactor for the sake of it.

### Task 3: Sweep TODO(ts): markers
Run Grep over `src/`. For each:
- If trivially fixable (now that the full picture is in place) — fix.
- Else replace with `// NOTE(ts): <reason it stays>`.

Known ones (from Phase 2):
- `DiaryView.tsx`: `TODO(ts): unify DiaryEntry vs DiaryEntryRecord across DiaryView/DailyReview in P3` — unify (likely: both files share one type defined in DailyReview.tsx or a new shared local type).
- Several files: `TODO(ts): tighten when backend adds response_model` — these are real, leave as NOTE.
- `JourneyView.tsx`: `TODO(ts): widen ActiveSurvey` — runtime uses {mode, startPass, stepIndex}; the type in types/journey.ts declares {blockIndex, statementIndex}. Update types/journey.ts to match runtime (P2A left `as unknown as ActiveSurvey` casts in 8 places — fix the type, drop the casts).
- `SkillAnswer` type in `types/journey.ts` — Phase 2 stopped using it. Grep — if unused, delete.

### Task 4: Update package.json scripts
- `"build": "tsc --noEmit && vite build"` (was `"vite build"`)
- Add `"typecheck": "tsc --noEmit"` if not present

### Task 5: Update CLAUDE.md
Add ONE line near the top (after "## Project: SLW" section):
```
**Frontend stack:** TypeScript strict (`tsc --noEmit` is the gate; `npm run build` does typecheck before Vite).
```

## Rules
- No `any`, no `@ts-ignore`, no `@ts-nocheck`. `unknown` + narrowing, or `// @ts-expect-error <reason>` only as last resort.
- Type-only imports.
- Surgical changes — no rebrand, no rename, no logic refactor.
- DO NOT modify backend, .md content, .module.css.
- DO NOT modify `CONTENT_VERSION` value.
- DO NOT delete `.jsx` files (coordinator does).

## Final report
1. Files converted (App.tsx + main.tsx + any types tweaks)
2. TODO(ts) markers cleared (count + list of resolutions)
3. Shape changes in src/types/* (with one-line rationale each)
4. New: src/types/user.ts created? If yes, list of components updated to use canonical User
5. package.json + CLAUDE.md confirmed updated
6. Status: "Ready for coordinator verification — expect 0 tsc errors"

Coordinator will run `npx tsc --noEmit`, `npm run build`, smoke-test via `npm run dev`, then merge.

Begin.
```

### Команды после завершения агента P3

```bash
cd /c/Serge/slw-slw-instruct/slw-slw-instruct/.claude/worktrees/p3-integration/slw-main/slw-main

# git rm старых .jsx
git rm src/App.jsx src/main.jsx

# git add новых .tsx
git add src/App.tsx src/main.tsx
git add -u   # подберёт остальные правки (TODO sweep, types, package.json, CLAUDE.md)

# Финальный tsc — должно быть 0 ошибок
npx tsc --noEmit

# Если 0 — commit
git commit -m "ts(p3): App.tsx + main.tsx, final integration pass, strict mode green"

# Также: npm run build должен пройти
npm run build

# Merge into ts-migration
cd /c/Serge/slw-slw-instruct/slw-slw-instruct
git checkout ts-migration
git merge --no-ff ts-p3-integration -m "ts: merge p3-integration"
git push

# Cleanup
git worktree remove -f .claude/worktrees/p3-integration
git branch -D ts-p3-integration
```

---

## Финальный merge — ts-migration → slw-instruct

После Phase 3:

```bash
cd /c/Serge/slw-slw-instruct/slw-slw-instruct

# Сначала smoke test локально
cd slw-main/slw-main
npm run dev    # открыть в браузере, проверить ключевые экраны:
               # - Логин (email + telegram)
               # - Dashboard
               # - AspectsView (один аспект)
               # - JourneyView (выбрать планету, пройти один скрипт)
               # - DiaryView (создать запись)
# Если работает — продолжаем

# Merge
cd ../..
git checkout slw-instruct
git merge --no-ff ts-migration -m "feat(ts): full migration to TypeScript strict mode"
git push   # Railway auto-deploys backend (но backend не менялся — ничего страшного)

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
2. [ ] Прочитал `slw-main/slw-main/TS_MIGRATION_PLAN.md` — минимум секцию «Часть 7. Phase 3»
3. [ ] Выполнил Setup-команды (проверка состояния + worktree + npm install)
4. [ ] Запустил агента Phase 3 с промптом из этого файла
5. [ ] После завершения — git rm + commit + npm run build + smoke test
6. [ ] Merge → push → cleanup
7. [ ] Спросил пользователя готов ли к финальному merge в `slw-instruct` и `npm run deploy`

Когда пользователь скажет «запускай Phase 3» (или просто «продолжай») — действуй по плану выше.

---

## Что пошло хорошо в Phase 2 (для уверенности)

- 7 параллельных агентов в worktrees отработали без конфликтов мерджа (зоны не пересекаются)
- Hybrid mode (агенты = код, координатор = shell) масштабируется до 7 параллельных потоков
- Координаторских правок мало — `types/journey.ts` (2 строки), `Hint.tsx` (1 тип), `DiaryView.tsx` (2 правки), `Chat.tsx`+`Onboarding.tsx` (1 тип каждый)
- Из 75 файлов агенты сделали 0 синтаксических ошибок — только типовые несоответствия с types/journey.ts

## Что было сложно

- **P2A** (JourneyView core с 2.3k LOC main file) выдал 59 in-zone ошибок после первой попытки. Большинство — unification SkillState ↔ SkillStateEntry. Координатор быстро решил через правку types/journey.ts (упростил answers до `Record<string, number[]>` и добавил недостающие ScreenName литералы). React 18 RefObject типизация — отдельная мелкая правка.
- **P2D** оставил 8 in-zone (DiaryView.tsx: user:unknown + DiaryEntry mismatch). Координатор починил локально за 2 правки.
- **NPM install в 7 worktrees** — занял 3 минуты параллельно (260 пакетов × 7 копий). Если есть `pnpm`, можно было быстрее, но npm справился.

---

**Конец handoff. P3 — финальный спринт.**
