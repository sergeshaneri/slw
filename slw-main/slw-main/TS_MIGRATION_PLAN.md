# TS Migration Plan — SLW Frontend

Перевод React-фронта (`slw-main/slw-main/src/`) с JavaScript на **строгий TypeScript** (`strict: true`, без `any`).

Backend (Python/FastAPI) **не трогаем** — он остаётся как есть, только генерируем из него типы.

---

## Часть 1. Краткая карта для человека

### Что делаем

172 файла `.js`/`.jsx`, ~98k LOC переводим в `.ts`/`.tsx` со строгой типизацией. Логика не меняется — только добавляем типы, переименовываем файлы, чиним то что TypeScript ругает.

### Сколько агентов и почему именно столько

- **13 запусков агентов всего**, **пиковая параллельность — 7**.
- Параллельность ограничена тем, что строгий TS требует: сначала зафиксировать общие типы, потом всё остальное может работать одновременно.

| Фаза | Сколько агентов | Параллельно? | Зачем |
|------|----------------|-------------|-------|
| 0. Bootstrap | 1 | нет | Поставить tsconfig, ESLint, сгенерить типы API из FastAPI, написать базовые типы. **Все остальные ждут.** |
| 1. Foundation | 4 | да | Перевести «листья» — api/, hooks/, data/. Эти модули импортятся компонентами; они должны быть типизированы первыми. |
| 2. Components | 7 | да | Перевести React-компоненты по группам (одна группа = один агент = непересекающиеся папки). |
| 3. Integration | 1 | нет | Перевести App.jsx, main.jsx, прогнать финальный `tsc`, починить сквозные ошибки. |

### Как агенты не мешают друг другу

1. **Worktree-изоляция.** Каждый агент работает в своей копии репозитория (`git worktree`). Файлы физически разделены.
2. **Непересекающиеся зоны.** У каждого агента — точный список путей, к которым он имеет доступ. Всё остальное запрещено трогать.
3. **Типы зафиксированы до Phase 2.** Phase 0 создаёт `src/types/` с общими интерфейсами (`AspectKey`, `JourneyState`, `Skill`, `Script` и т.п.). Phase 2 эти типы только **импортирует**, не меняет.

### Как ты будешь это запускать

1. Сначала выполнить **«Setup-команды»** (раздел ниже) — это создаст ветку `ts-migration` и worktree-папки.
2. Запустить **агента Phase 0** — дождаться завершения.
3. Слить его ветку в `ts-migration`.
4. Запустить **4 агентов Phase 1 одновременно** — дождаться.
5. Слить их ветки в `ts-migration`.
6. Запустить **7 агентов Phase 2 одновременно** — дождаться.
7. Слить их ветки в `ts-migration`.
8. Запустить **агента Phase 3** — финал.
9. Протестировать локально (`npm run dev`), затем мерджить `ts-migration` → `slw-instruct`.

---

## Часть 2. Setup-команды (выполняешь ты один раз)

```bash
# 1. Перейти в корень git-репозитория
cd /c/Serge/slw-slw-instruct/slw-slw-instruct

# 2. Убедиться что ветка slw-instruct чистая
git status
git pull

# 3. Создать базовую ветку миграции
git checkout -b ts-migration
git push -u origin ts-migration

# 4. Создать папку под worktrees (рядом с репо, не внутри)
mkdir -p ../ts-worktrees

# 5. Worktree для Phase 0 (запускаешь сейчас)
git worktree add ../ts-worktrees/p0-bootstrap -b ts-p0-bootstrap ts-migration

# Worktree для Phase 1 (создашь ПОСЛЕ мержа Phase 0)
# git worktree add ../ts-worktrees/p1a-api      -b ts-p1a-api      ts-migration
# git worktree add ../ts-worktrees/p1b-skills   -b ts-p1b-skills   ts-migration
# git worktree add ../ts-worktrees/p1c-journey  -b ts-p1c-journey  ts-migration
# git worktree add ../ts-worktrees/p1d-aspects  -b ts-p1d-aspects  ts-migration

# Worktree для Phase 2 (создашь ПОСЛЕ мержа Phase 1)
# git worktree add ../ts-worktrees/p2a-journey-core   -b ts-p2a-journey-core   ts-migration
# git worktree add ../ts-worktrees/p2b-journey-trees  -b ts-p2b-journey-trees  ts-migration
# git worktree add ../ts-worktrees/p2c-aspects        -b ts-p2c-aspects        ts-migration
# git worktree add ../ts-worktrees/p2d-diary-dash     -b ts-p2d-diary-dash     ts-migration
# git worktree add ../ts-worktrees/p2e-admin-auth     -b ts-p2e-admin-auth     ts-migration
# git worktree add ../ts-worktrees/p2f-social         -b ts-p2f-social         ts-migration
# git worktree add ../ts-worktrees/p2g-shell          -b ts-p2g-shell          ts-migration

# Worktree для Phase 3 (создашь ПОСЛЕ мержа Phase 2)
# git worktree add ../ts-worktrees/p3-integration  -b ts-p3-integration  ts-migration
```

### Команды мержа после каждой фазы

```bash
# После завершения агента фазы (пример для Phase 0):
cd /c/Serge/slw-slw-instruct/slw-slw-instruct
git checkout ts-migration
git merge --no-ff ts-p0-bootstrap
git push
# Worktree-папку можно удалить
git worktree remove ../ts-worktrees/p0-bootstrap
git branch -d ts-p0-bootstrap
```

---

## Часть 3. Общие правила для ВСЕХ агентов (must-read)

Эти правила копируются в промпт каждого агента. Нарушение = отклонённый PR.

### Правило 1. tsconfig.json — единственный source of truth

`tsconfig.json` создаётся в Phase 0 со следующими настройками:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "allowImportingTsExtensions": false,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "skipLibCheck": true,

    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": false,

    "paths": {
      "@/*": ["./src/*"]
    },
    "baseUrl": "."
  },
  "include": ["src", "vite.config.ts"]
}
```

**Никакой агент не правит tsconfig.json** кроме Phase 0 и Phase 3. Если тип не сходится — задача агента типизировать код, а не ослаблять конфиг.

### Правило 2. `any` запрещён

- **Запрещено:** `any`, `as any`, `// @ts-ignore`, `// @ts-nocheck`.
- **Разрешено в крайних случаях:** `unknown` + явный narrowing, или `// @ts-expect-error <причина>` с однострочным комментарием.
- Если ты упёрся в тип, который требует менять чужой код вне твоей зоны — оставь `TODO(ts): <описание>` и в комментарии задачи отметь это для финального агента Phase 3.

### Правило 3. Имена файлов

- `.js` → `.ts` (для модулей без JSX)
- `.jsx` → `.tsx`
- **CSS-модули не трогаем** (`*.module.css` остаются как есть, типизация через ambient declaration в Phase 0)
- `.md` файлы импортируемые через `?raw` — не трогаем
- Имена переменных, экспортов, компонентов — не меняем (surgical changes)

### Правило 4. Импорты типов

- Импорт **типа** всегда через `import type { X } from '...'` (для tree-shaking и `isolatedModules`).
- Импорт значения + типа из одного модуля — два отдельных импорта.

```ts
// Хорошо
import type { AspectKey } from '@/types/aspect'
import { ASPECT_KEYS } from '@/data/aspects'

// Плохо
import { ASPECT_KEYS, type AspectKey } from '@/data/aspects'
```

### Правило 5. React-компоненты

```tsx
// Хорошо
type Props = {
  aspect: AspectKey
  onClose: () => void
}

export function MyComponent({ aspect, onClose }: Props) { ... }

// Плохо
export function MyComponent(props: any) { ... }
export const MyComponent: React.FC<Props> = ...  // React.FC устаревший паттерн
```

### Правило 6. Запрещённые зоны

Каждый агент имеет **точный whitelist путей**. ВСЁ остальное — запрещено:
- Не трогать backend (`backend/**`)
- Не трогать корневые `.md`, `.tsx` файлы (вроде `terraharmonia.tsx` в репо-корне)
- Не трогать `package.json` кроме своих `devDependencies` (если spec разрешает)
- Не трогать `.env.local`, `.env.production`, `vite.config.*`, `eslint.config.*` кроме Phase 0
- Не запускать `npm install` кроме Phase 0 (deps уже стоят)

### Правило 7. Verification

Каждый агент перед сдачей запускает:

```bash
cd /c/Serge/slw-slw-instruct/<worktree>/slw-main/slw-main
npx tsc --noEmit
```

И прикладывает в финальном сообщении полный stdout. Если ошибки есть — они **должны** быть в коде вне зоны агента (тогда отметить как `TODO для Phase 3`) или починены.

### Правило 8. Surgical changes

Из CLAUDE.md (project rules):
- Не «улучшай» соседний код.
- Не рефактори то, что не сломано.
- Не удаляй мёртвый код (если только TypeScript не ругается на неиспользуемый импорт после твоих правок).
- Каждая изменённая строка должна трассироваться к задаче перевода на TS.

### Правило 9. Aspect keys

`AspectKey = 'Si' | 'Se' | 'Ti' | 'Te' | 'Fi' | 'Fe' | 'Ni' | 'Ne'` — определяется в Phase 0 в `src/types/aspect.ts`.

Кириллические литералы (`'БС'`, `'ЧС'` и т.п.) остаются как строковые literals только в `src/api/client.js` для маппинга. Везде ещё — `AspectKey`.

Если видишь `string` где должен быть аспект — пиши `AspectKey`. Никаких `string` для аспектов.

### Правило 10. Коммиты

Один большой коммит в конце работы агента:

```
ts(<agent-id>): <одной строкой что сделано>

<список папок/файлов>
```

Пример: `ts(p1b): convert data/skills/ to TypeScript`

Без `Co-Authored-By` — это внутренние ветки.

---

## Часть 4. Phase 0 — Bootstrap (1 агент, ~30-60 мин)

### Agent P0 — Bootstrap

**Worktree:** `../ts-worktrees/p0-bootstrap`
**Branch:** `ts-p0-bootstrap`
**Зависимости:** нет
**Параллельность:** sequential (никто другой не работает)

#### Задача

Подготовить TypeScript-фундамент для остальных агентов. Никакой `.js`/`.jsx` файл не переводится — только инфраструктура и базовые типы.

#### Файлы которые СОЗДАЁТ

1. `slw-main/slw-main/tsconfig.json` — копия из «Правила 1» выше.

2. `slw-main/slw-main/tsconfig.node.json` — для `vite.config.ts`:
   ```json
   {
     "compilerOptions": {
       "composite": true,
       "skipLibCheck": true,
       "module": "ESNext",
       "moduleResolution": "Bundler",
       "allowSyntheticDefaultImports": true
     },
     "include": ["vite.config.ts"]
   }
   ```

3. `slw-main/slw-main/src/vite-env.d.ts`:
   ```ts
   /// <reference types="vite/client" />

   interface ImportMetaEnv {
     readonly VITE_API_URL: string
   }
   interface ImportMeta {
     readonly env: ImportMetaEnv
   }

   declare module '*.module.css' {
     const classes: Readonly<Record<string, string>>
     export default classes
   }

   declare module '*.md?raw' {
     const content: string
     export default content
   }

   declare module '*.svg' {
     const src: string
     export default src
   }
   ```

4. `slw-main/slw-main/src/types/aspect.ts`:
   ```ts
   export const ASPECT_KEYS = ['Te', 'Ti', 'Fe', 'Fi', 'Se', 'Si', 'Ne', 'Ni'] as const
   export type AspectKey = typeof ASPECT_KEYS[number]

   export const CYRILLIC_ASPECT_KEYS = ['ЧЛ', 'БЛ', 'ЧЭ', 'БЭ', 'ЧС', 'БС', 'ЧИ', 'БИ'] as const
   export type CyrillicAspectKey = typeof CYRILLIC_ASPECT_KEYS[number]

   export type AspectScores = Partial<Record<AspectKey, number>>
   ```

5. `slw-main/slw-main/src/types/api.ts` — **сгенерированные типы из FastAPI**:
   - Установить `openapi-typescript` как devDep.
   - Скачать `https://slw-production.up.railway.app/openapi.json` (curl).
   - Сгенерировать: `npx openapi-typescript ./openapi.json -o src/types/api.ts`
   - Файл `openapi.json` положить в `slw-main/slw-main/scripts/openapi.json` и закоммитить как snapshot.
   - Добавить npm-скрипт `"types:api": "openapi-typescript ./scripts/openapi.json -o src/types/api.ts"`.

6. `slw-main/slw-main/src/types/journey.ts` — типы для journey-state (читаешь `JourneyView.jsx` чтобы понять структуру; CLAUDE.md секция "Per-aspect journey state" даёт shape):
   ```ts
   import type { AspectKey } from './aspect'

   export type ScreenName = 'chat' | 'planets' | 'survey' | 'survey-choice' | 'survey-insight' | 'skill-tree' | 'skill-detail' | 'profile' | 'onboarding'

   export type AwaitingInput = null | 'number' | 'text' | 'choice' | 'step-insight' | 'exercise_note'

   export type ChatMessage = {
     id: string
     role: 'bot' | 'user'
     text: string
     scriptId?: string
     timestamp?: number
   }

   export type PendingTask = {
     id: string
     title: string
     scriptId: string
     status: 'taken' | 'deferred'
     createdAt: number
   }

   export type AspectState = {
     currentLevel: 0 | 1 | 2 | 3
     currentScriptIndex: number
     currentScriptId: string | null
     awaitingInput: AwaitingInput
     messages: ChatMessage[]
     completedScripts: string[]
     pendingTasks: PendingTask[]
   }

   export type SkillAnswer = {
     pass: number
     statementIndex: number
     value: number | string
     timestamp: number
   }

   export type SkillState = {
     id: string
     answers: Record<string, SkillAnswer[]>   // keyed by block name
     result?: number
     draft?: unknown
     lastUpdated?: number
   }

   export type JourneyState = {
     currentAspect: AspectKey
     aspects: Partial<Record<AspectKey, AspectState>>
     skills: Record<string, SkillState>
     activeSurvey: string | null
     skillDetailId: string | null
     xp: number
     streak: number
     stardust: number
     totalCompleted: number
     lastActiveDate: string | null
     screen: ScreenName
     onboardingStep: number
     contentVersion: number
     completedScripts?: string[]  // legacy global, может отсутствовать
   }
   ```

7. `slw-main/slw-main/src/types/skill.ts` — типы для skill-data (из `src/data/skills/*/*.js`):
   ```ts
   export type SkillRole = 'core' | 'common'
   export type ArchetypeId = 'healer' | 'hedonist' | 'organizer' | 'technologist' /* и т.д. — полный список выясняет Phase 0 */

   export type SkillPractice = {
     name: string
     desc: string
     xp: number
   }

   export type SkillLevel = {
     typage: string
     essence: string
     gift: { title: string; desc: string }
     shadow: { title: string; desc: string }
     actions: string[]
     practices: SkillPractice[]
     criteria: string[]
     pitfalls: string[]
     // L3-only:
     precaution?: string
     dilemma?: string
   }

   export type Skill = {
     id: string
     name: string
     archetype: ArchetypeId
     role: SkillRole
     intro: string
     levels: {
       1: SkillLevel
       2: SkillLevel
       3: SkillLevel
     }
   }
   ```

   Phase 0 agent: прочитай по одному файлу из каждой папки `src/data/skills/{Si,Se,Ne,Ni,Te,Ti,Fe,Fi}/` и сверь — все ли поля присутствуют. Если есть аспекты с расхождением shape — обозначь в типе как опциональные или сделай discriminated union по `archetype`.

8. `slw-main/slw-main/src/types/script.ts` — типы для parseScripts:
   ```ts
   export type ScriptType = 'theory' | 'word' | 'reflection' | 'exercise' | 'question' | 'survey' | 'choice'

   export type ScriptMetadata = {
     xp?: number
     scale?: '1-10'
     skill?: string
     block?: string
     followUp?: unknown   // уточнить shape по parseScripts.js
   }

   export type Script = {
     id: string
     type: ScriptType
     title: string
     body: string
     scale?: boolean
     skill?: string
     block?: string
     followUp?: unknown
     // ... остальные поля из parseScripts.js
   }

   export type Survey = {
     id: string
     skillId: string
     statements: Array<{ text: string; value?: number }>
     // ... уточнить по parseSurveys.js
   }
   ```

   Agent: прочитай `src/data/journey/parseScripts.js` целиком и зафиксируй точный shape. Если есть неоднозначность — выбери наиболее консервативный тип (всё опционально кроме `id`/`type`) и оставь `TODO(ts): tighten`.

9. `slw-main/slw-main/src/types/storage.ts`:
   ```ts
   export type LocalStorageKey = 'slw_token' | 'slw_dev_admin' | 'survey_insight_hint_dismissed' | string
   ```

10. `slw-main/slw-main/src/types/index.ts` — re-exports:
    ```ts
    export * from './aspect'
    export * from './journey'
    export * from './skill'
    export * from './script'
    export * from './storage'
    export type * from './api'
    ```

#### Файлы которые ИЗМЕНЯЕТ

- `slw-main/slw-main/package.json` — добавить devDeps:
  ```json
  "typescript": "^5.6.0",
  "openapi-typescript": "^7.0.0",
  "@types/react": "^18.3.0",
  "@types/react-dom": "^18.3.0"
  ```
  Затем `npm install`.

- `slw-main/slw-main/eslint.config.js` — переименовать в `eslint.config.js` (оставить .js, оно ESM) и добавить `typescript-eslint`. Точные правки:
  ```js
  import tseslint from 'typescript-eslint'
  // в конфиг добавить ...tseslint.configs.recommended
  ```
  Также установить `typescript-eslint` как devDep.

- `slw-main/slw-main/vite.config.js` → переименовать в `vite.config.ts`. Внутри добавить типы для `defineConfig`:
  ```ts
  import { defineConfig } from 'vite'
  import react from '@vitejs/plugin-react'

  export default defineConfig({
    plugins: [react()],
    base: '/slw/',
  })
  ```

#### Файлы которые ЗАПРЕЩЕНО трогать

- Любые `.js`/`.jsx` в `src/` — это работа Phase 1+2.
- `.env.*`
- `index.html`
- `public/**`
- `backend/**`

#### Acceptance criteria

```bash
cd slw-main/slw-main
npm install
npx tsc --noEmit          # должно пройти БЕЗ ошибок (так как ни одного .ts файла в src ещё нет кроме типов)
npm run build              # должно собраться (build не использует tsc, использует Vite — ошибки JS не блокируют)
npm run types:api          # должно перегенерировать api.ts
```

В финальном сообщении: список созданных файлов, версия `openapi.json` (дата скачивания), любые расхождения shape с моими предположениями выше.

---

## Часть 5. Phase 1 — Foundation (4 агента параллельно, ~2-4 часа каждый)

**Все 4 запускаются после мержа Phase 0.**
**Все 4 ждут друг друга перед Phase 2.**

---

### Agent P1A — API & Hooks

**Worktree:** `../ts-worktrees/p1a-api`
**Branch:** `ts-p1a-api`
**Зависимости:** Phase 0 завершена и смержена в `ts-migration`

#### Зона ответственности (whitelist)

- `src/api/client.js` → `src/api/client.ts`
- `src/hooks/useAuth.js` → `src/hooks/useAuth.ts`
- `src/tma/index.js` → `src/tma/index.ts`
- `src/tma/hooks.js` → `src/tma/hooks.ts`
- `src/locales/ru.js` → `src/locales/ru.ts`

Никаких других файлов.

#### Что делаем

1. **`api/client.ts`** — самый сложный файл фазы:
   - Все экспортируемые функции получают сигнатуру с типами из `@/types/api` (сгенерированных Phase 0).
   - Используй helper-тип `paths` из openapi-typescript:
     ```ts
     import type { paths } from '@/types/api'
     type GetMeResponse = paths['/api/auth/me']['get']['responses']['200']['content']['application/json']
     ```
   - `latToCyr`/`cyrToLat`: типизируются через discriminated union или overload — на вход `AspectKey | string`, на выход `CyrillicAspectKey | string` соответственно. Допускается `function latToCyr(s: string): string` если overload слишком ломок — главное чтобы вызывающий код видел нужный тип.
   - `translateAspectsInResponse` — generic `<T>(node: T): T`. Не пытайся типизировать рекурсивную мутацию ключей через сложный mapped type — это переусложнение. `unknown` + cast на возврат допустимо как pragmatic exit, оставь `TODO(ts): tighten translateAspectsInResponse`.
   - JWT handling: `localStorage.getItem('slw_token')` → `string | null`, обрабатывай null.

2. **`hooks/useAuth.ts`** — обычный custom hook:
   - `User` тип из `@/types/api` (паттерн: `paths['/api/auth/me']['get']['responses']['200']['content']['application/json']`).
   - `useState<User | null>`, return-type явно прописать.

3. **`tma/index.ts`** и **`tma/hooks.ts`** — Telegram Mini App обвязка:
   - Используй `@types/telegram-web-app` или объяви ambient types для `window.Telegram.WebApp` в `src/types/telegram.ts` (создай если нужно — это в твоей зоне как доп. тип).
   - Не устанавливай новые npm-deps без острой нужды.

4. **`locales/ru.ts`** — простой объект строк:
   ```ts
   export const ru = {
     // ... оригинал
   } as const

   export type LocaleKey = keyof typeof ru
   ```

#### Запрещено

- Не трогать `data/`, `components/`, `App.jsx`, `main.jsx`.
- Не менять логику маппинга кириллица↔латиница (это критично для совместимости с бэком).
- Не трогать openapi-генератор (Phase 0 уже сделал).

#### Verification

```bash
cd /c/Serge/slw-slw-instruct/../ts-worktrees/p1a-api/slw-slw-instruct/slw-main/slw-main
npx tsc --noEmit
```

Допустимы ошибки только в файлах вне твоей зоны (компоненты ещё не переведены, импортируют `.ts`-файлы которые ты создал). Подсчитай их и приложи в отчёте.

#### Commit message

`ts(p1a): convert api/, hooks/, tma/, locales/ to TypeScript`

---

### Agent P1B — Skills Data

**Worktree:** `../ts-worktrees/p1b-skills`
**Branch:** `ts-p1b-skills`
**Зависимости:** Phase 0

#### Зона ответственности

Все файлы в `src/data/skills/` — это 8 папок архетипов (Si, Se, Ne, Ni, Te, Ti, Fe, Fi) + общие файлы:

- `src/data/skills/index.js` → `index.ts`
- `src/data/skills/skillsContent.js` → `skillsContent.ts`
- `src/data/skills/Si/*.js` → `*.ts` (healer.js, hedonist.js, skill-blocks.js, и др.)
- `src/data/skills/Se/*.js` → `*.ts`
- `src/data/skills/Ne/*.js` → `*.ts`
- `src/data/skills/Ni/*.js` → `*.ts`
- `src/data/skills/Te/*.js` → `*.ts`
- `src/data/skills/Ti/*.js` → `*.ts`
- `src/data/skills/Fe/*.js` → `*.ts`
- `src/data/skills/Fi/*.js` → `*.ts`

`.md` файлы НЕ трогать.

#### Что делаем

Это **однотипная массовая конверсия**. Все skill-файлы имеют одинаковый shape (см. `src/types/skill.ts` из Phase 0).

1. Для каждого `<archetype>.js`:
   ```ts
   import type { Skill } from '@/types/skill'

   export const HEALER: Record<string, Skill> = {
     'signals': {
       id: 'signals',
       // ... оригинал
     },
   }
   ```

2. `skill-blocks.js` — содержит метаданные blocks (knowledge/practice/awareness/...). Создай тип `SkillBlock` локально в этом файле и затипизируй.

3. Если какой-то skill-файл расходится с `Skill` типом (отсутствует поле, лишнее поле) — **сначала проверь, не опечатка ли в данных**. Если данные правильные, а тип в `types/skill.ts` слишком узкий — оставь `TODO(ts): widen Skill type for <archetype>` и используй `as unknown as Skill` для этого единичного случая. **Не правь `src/types/skill.ts`** — это зона Phase 0/3.

4. `index.ts` — re-exports всех архетипов. Должен экспортировать `ALL_SKILLS: Record<string, Skill>` собранный из всех файлов.

#### Запрещено

- Не трогать `src/data/journey/skills/` (это tree.js / ne-tree.js / и т.п. — зона P1C).
- Не трогать `src/data/aspects.js` — зона P1D.
- Не менять контент skill-объектов (тексты практик, цитаты и т.п.) — surgical changes.

#### Verification

```bash
npx tsc --noEmit
```

Сосчитать ошибки **только в зоне `src/data/skills/`**. Должно быть 0. Ошибки в компонентах (вне зоны) — допустимы.

#### Commit message

`ts(p1b): convert data/skills/ to TypeScript`

---

### Agent P1C — Journey Data

**Worktree:** `../ts-worktrees/p1c-journey`
**Branch:** `ts-p1c-journey`
**Зависимости:** Phase 0

#### Зона ответственности

- `src/data/journey/registry.js` → `registry.ts`
- `src/data/journey/parseScripts.js` → `parseScripts.ts`
- `src/data/journey/onboarding.js` → `onboarding.ts`
- `src/data/journey/skills/*.js` → `*.ts` (tree.js, ne-tree.js, ni-tree.js, te-tree.js, ti-tree.js, resolve.js, и др.)
- `src/data/journey/fe-skills/*.js` → `*.ts` (вся подпапка)
- `src/data/journey/aspects/<Latin>/index.js` → `index.ts` (для каждой папки: Si, Ti, Ne, Fe, Ni)

`.md` файлы НЕ трогать.

#### Что делаем

1. **`parseScripts.ts`** — парсер L0/L1 markdown. Это центральный модуль; затипизируй максимально точно используя `Script`/`Survey` из `@/types`. Если встречаешь нетипизируемое место (динамический shape объектов в зависимости от metadata) — используй discriminated union по `type`:
   ```ts
   type ScriptCommon = { id: string; xp: number; title: string }
   type TheoryScript = ScriptCommon & { type: 'theory'; body: string }
   type ExerciseScript = ScriptCommon & { type: 'exercise'; instruction: string; followUp?: ... }
   type Script = TheoryScript | ExerciseScript | /* ... */
   ```

2. **`registry.ts`** — JOURNEYS/PLANETS:
   ```ts
   import type { AspectKey } from '@/types/aspect'

   export type Planet = {
     aspect: AspectKey
     name: string
     emoji: string
     available: boolean
     // ...
   }

   export const JOURNEYS: Record<AspectKey, ...> = { ... }
   export const PLANETS: Record<AspectKey, Planet> = { ... }
   ```

3. **`skills/tree.js`** и аналоги — деревья навыков:
   ```ts
   export type SkillTreeNode = {
     id: string
     name: string
     archetype: ArchetypeId
     role: 'common' | 'core'
     children?: SkillTreeNode[]
     // ...
   }
   ```

4. **`skills/resolve.js`** — `resolveSurvey(skillId)`:
   ```ts
   export function resolveSurvey(skillId: string): Survey | null { ... }
   ```

5. **`aspects/<Latin>/index.js`** — экспорты типа `SI_ASPECT_INTRO`, `SI_LEVEL_0_CORE`. Затипизируй как массивы Script:
   ```ts
   import type { Script } from '@/types/script'
   export const SI_LEVEL_0_CORE: Script[] = [...]
   ```

#### Запрещено

- Не трогать `src/data/skills/` (зона P1B).
- Не трогать `src/data/aspects.js` (зона P1D).
- Не править markdown файлы.
- Не менять `src/types/script.ts` — если тип Script не покрывает реальные данные, оставь `TODO(ts): tighten Script for <case>` в parseScripts.ts и используй `as unknown as Script` локально. Финальную правку типов сделает Phase 3.

#### Verification

```bash
npx tsc --noEmit
```

Ошибки только в зоне `src/data/journey/`: 0. Ошибки вне зоны — допустимы.

#### Commit message

`ts(p1c): convert data/journey/ to TypeScript`

---

### Agent P1D — Aspects Data

**Worktree:** `../ts-worktrees/p1d-aspects`
**Branch:** `ts-p1d-aspects`
**Зависимости:** Phase 0

#### Зона ответственности

- `src/data/aspects.js` → `aspects.ts` (9636 LOC — большой)
- `src/data/aspects-fi-extension.js` → `aspects-fi-extension.ts`
- `src/data/hallContent.js` → `hallContent.ts` (2191 LOC)

#### Что делаем

1. **`aspects.ts`** — содержит ASPECT_DATA, ASPECT_COLORS, ASPECT_KEYS, ASPECT_DISPLAY_KEY, ASPECT_REALMS:
   ```ts
   import type { AspectKey } from '@/types/aspect'

   export type AspectInfo = {
     name: string
     sub: string
     metaphor?: string
     color: string
     // ... смотри что есть в исходнике, типизируй ровно
   }

   export const ASPECT_DATA: Record<AspectKey, AspectInfo> = { ... }
   export const ASPECT_COLORS: Record<AspectKey, string> = { ... }
   export const ASPECT_KEYS: readonly AspectKey[] = ['Te', 'Ti', ...] as const
   export const ASPECT_DISPLAY_KEY: Record<AspectKey, string> = {
     Si: 'БС', Se: 'ЧС', /* ... */
   }
   ```

2. **`aspects-fi-extension.ts`** — расширение для Fi (досматриваешь оригинал):
   - Используй те же типы.

3. **`hallContent.ts`** — статика для Hall: quotes, figures, art, archetypes:
   ```ts
   export type Quote = { text: string; author: string }
   export type Figure = { name: string; bio: string; ... }
   export type ArtPiece = { title: string; artist: string; ... }
   export type ArchetypeInfo = { name: string; shadow: string; gift: string; ... }

   export type HallContent = {
     quotes: Quote[]
     figures: Figure[]
     art: ArtPiece[]
     archetypes: Record<string, ArchetypeInfo>
     // ... ровно по исходнику
   }

   export const HALL_CONTENT: Record<AspectKey, HallContent> = { ... }
   ```

Если структура hallContent неоднородна по аспектам (ЧИ детально, остальные затравки) — используй `Partial<HallContent>` или discriminated union.

#### Запрещено

- Не трогать `src/data/skills/` (P1B).
- Не трогать `src/data/journey/` (P1C).
- Не трогать `src/components/AspectsView/blocks.js` — это компонент, зона Phase 2.
- Не менять контент (тексты цитат, имена figures и т.п.).

#### Verification

```bash
npx tsc --noEmit
```

Ошибки только в зоне `src/data/aspects*` и `src/data/hallContent.ts`: 0.

#### Commit message

`ts(p1d): convert data/aspects.js, hallContent.js to TypeScript`

---

## Часть 6. Phase 2 — Components (7 агентов параллельно)

**Все 7 запускаются после мержа Phase 1.**

К этому моменту все `src/api/`, `src/hooks/`, `src/data/`, `src/tma/`, `src/locales/`, `src/types/` уже `.ts`. Компоненты их только импортируют.

### Общие принципы для Phase 2 агентов

- Каждый компонент `.jsx` → `.tsx`.
- Каждый `.js` (не-компонент) внутри компонентной папки → `.ts`.
- `.module.css` НЕ трогать.
- Пропсы каждого компонента типизируются как `type Props = { ... }`.
- `useState`/`useRef`/`useReducer` — явно указать generic тип где он не выводится автоматически.
- Event handlers: `React.MouseEvent<HTMLButtonElement>`, `React.ChangeEvent<HTMLInputElement>` и т.п. Не `any`.
- `children: React.ReactNode`.
- Если компонент использует `state.journey.aspects[X]` — импортируй типы из `@/types/journey`.

---

### Agent P2A — JourneyView Core

**Worktree:** `../ts-worktrees/p2a-journey-core`
**Branch:** `ts-p2a-journey-core`
**Зависимости:** Phase 1 завершён и смержен

#### Зона ответственности

`src/components/JourneyView/` (но НЕ файлы skill-tree — они у P2B):

- `JourneyView.jsx` → `.tsx` (2336 LOC — самый большой компонент)
- `Chat.jsx` → `.tsx`
- `InsightInput.jsx` → `.tsx`
- `JourneyProfile.jsx` → `.tsx`
- `LevelComplete.jsx` → `.tsx`
- `MarkdownLite.jsx` → `.tsx`
- `Onboarding.jsx` → `.tsx`
- `PlanetMap.jsx` → `.tsx`
- `ScriptButtons.jsx` → `.tsx`
- `ScriptCard.jsx` → `.tsx`
- `StepInsightPrompt.jsx` → `.tsx`
- `SurveyScreen.jsx` → `.tsx` (если есть)
- `AdminPanel.jsx` → `.tsx`
- `AdminSkillsEditor.jsx` → `.tsx`
- `FeCoreOverview.jsx` → `.tsx`
- (любые другие `.jsx` в JourneyView/ кроме `*SkillTree.jsx`)

#### Что делаем

1. **`JourneyView.tsx`** — самая сложная работа фазы:
   - Импортируй `JourneyState`, `AspectState`, `AwaitingInput`, `ChatMessage` из `@/types/journey`.
   - `migrateState`, `migrateCyrAspectKeys`, `aspectOf`, `updateAspect` — все получают типы.
   - `CONTENT_VERSION` — `const CONTENT_VERSION: number = 26` (текущая, см. CLAUDE.md).
   - `useState<JourneyState>` — явно указанный generic.
   - Helpers типа `awardXP`, `deliverScript`, `handleScriptAction`, `dismissActiveSurveyToDraft`, `handleSwitchAspect` — все получают сигнатуры.
   - Опасные места: `state.skills[id].draft` — это `unknown` (хранит произвольный объект). Не пытайся затипизировать всё внутри `draft`.
   - `migrateSkills`: тут `renameChePrefix` и `SKILL_ID_MIGRATION` — заметай ассерты типов аккуратно.

2. **`Chat.tsx`** — рендер чата:
   - Пропсы: `messages: ChatMessage[]`, `awaitingInput`, callbacks.
   - `StepInsightPrompt` подключается через `awaitingInput === 'step-insight'`.

3. **`StepInsightPrompt.tsx`** — textarea с minLength, передаёт строку наверх.

4. **`Onboarding.tsx`, `PlanetMap.tsx`, `ScriptButtons.tsx`, `ScriptCard.tsx`** — обычные React компоненты, типизация пропсов.

5. **`AdminPanel.tsx`, `AdminSkillsEditor.tsx`** — внутренние dev-tools, тоже типизировать.

6. **Не пытайся типизировать всю state-machine** — где `awaitingInput` ветвится на 5+ кейсов с разным shape, используй discriminated union если возможно, иначе оставь `unknown` для payload + явные narrow checks.

#### Запрещено

- Не трогать `*SkillTree.jsx` (FeSkillTree, NeSkillTree, FiSkillTree, NiSkillTree, SeSkillTree, SiSkillTree, TeSkillTree, TiSkillTree) — зона P2B.
- Не трогать `src/components/AspectsView/` — зона P2C.
- Не менять `CONTENT_VERSION` (это data-migration версия, не инфраструктурная).
- Не менять логику миграций (`migrateState`, `migrateCyrAspectKeys`, `renameChePrefix`).

#### Verification

```bash
npx tsc --noEmit
```

Ошибки в JourneyView/ кроме *SkillTree.jsx: 0.

#### Commit message

`ts(p2a): convert JourneyView core components to TypeScript`

---

### Agent P2B — Journey Skill Trees

**Worktree:** `../ts-worktrees/p2b-journey-trees`
**Branch:** `ts-p2b-journey-trees`
**Зависимости:** Phase 1

#### Зона ответственности

Только файлы skill-tree в JourneyView (специально вынесено в отдельного агента — там много однотипного кода):

- `src/components/JourneyView/FeSkillTree.jsx` → `.tsx`
- `src/components/JourneyView/FiSkillTree.jsx` → `.tsx`
- `src/components/JourneyView/NeSkillTree.jsx` → `.tsx`
- `src/components/JourneyView/NiSkillTree.jsx` → `.tsx`
- `src/components/JourneyView/SeSkillTree.jsx` → `.tsx`
- `src/components/JourneyView/SiSkillTree.jsx` → `.tsx` (он же SkillTree исторически)
- `src/components/JourneyView/TeSkillTree.jsx` → `.tsx`
- `src/components/JourneyView/TiSkillTree.jsx` → `.tsx`

Если есть `SkillTree.jsx` без префикса — он тоже здесь.

#### Что делаем

Все 8 файлов однотипные:
- Принимают `state: JourneyState`, callbacks, `onOpenPlanetMap`, и т.п.
- Импортируют tree из `@/data/journey/skills/{si,ne,ni,fe,te,ti}-tree.ts` (P1C уже перевёл их).
- Используют тип `SkillTreeNode` (из `@/types/skill` или из соответствующего tree-файла).

Шаблон одного:
```tsx
import type { JourneyState } from '@/types/journey'
import type { SkillTreeNode } from '@/data/journey/skills/tree'

type Props = {
  state: JourneyState
  onSkillClick: (skillId: string) => void
  onOpenPlanetMap: () => void
  // ...
}

export function SiSkillTree({ state, onSkillClick, onOpenPlanetMap }: Props) {
  // ...
}
```

#### Запрещено

- Не трогать остальные файлы JourneyView/ (зона P2A).
- Не менять рендер-логику, scoring helpers (`calcArchetypeAvg` если есть локально).

#### Verification

```bash
npx tsc --noEmit
```

Ошибки в файлах `*SkillTree.tsx`: 0.

#### Commit message

`ts(p2b): convert JourneyView/*SkillTree components to TypeScript`

---

### Agent P2C — AspectsView

**Worktree:** `../ts-worktrees/p2c-aspects`
**Branch:** `ts-p2c-aspects`
**Зависимости:** Phase 1

#### Зона ответственности

Вся папка `src/components/AspectsView/`:

- `AspectsView.jsx` → `.tsx`
- `FeWheel.jsx` → `.tsx`
- `FiWheel.jsx` → `.tsx` (если есть)
- `HabitSection.jsx` → `.tsx`
- `NeWheel.jsx` → `.tsx`
- `NiWheel.jsx` → `.tsx`
- `PlaceholderWheel.jsx` → `.tsx`
- `SeWheel.jsx` → `.tsx` (если есть)
- `SiWheel.jsx` → `.tsx`
- `TeWheel.jsx` → `.tsx`
- `TiWheel.jsx` → `.tsx`
- `blocks.js` → `blocks.ts` (это data-like модуль, но он внутри компонентной папки — переводит P2C)

#### Что делаем

1. **`blocks.ts`** — определение секций аспекта:
   ```ts
   export type BlockLevel = 0 | 1 | 2 | 3
   export type BlockKind = 'list' | 'numberedList' | 'titledList' | 'archetypes' | 'somatic' | 'dilemmas' | 'practices' | 'archetypePath' | 'synergy' | 'polysemy' | 'assessment' | 'fears' | 'text' | 'textItalic' | 'integration'

   export type Block = {
     key: string
     title: string
     level: BlockLevel
     kind: BlockKind
     teaserCount?: number
   }

   export const BLOCKS: Block[] = [...]

   export function teaseBlockData<T>(block: Block, data: T): T { ... }
   ```

2. **`*Wheel.tsx`** — SVG-колёса по аспекту. Все принимают похожие пропсы:
   ```tsx
   type Props = {
     aspect: AspectKey
     skills: Record<string, SkillState>
     onArchetypeClick?: (archetype: ArchetypeId) => void
     scores: AspectScores
   }
   ```

3. **`PlaceholderWheel.tsx`** — заглушка для Te/Ti/Se/Fi (по CLAUDE.md). Простой компонент с типизированными пропсами.

4. **`AspectsView.tsx`** — главный экран:
   - Получает `state: JourneyState`, `scores: AspectScores`, `onEnterHall`, `journey`, `isAdmin`.
   - Свитчер `aspect === 'Si'` → `<SiWheel/>`, etc.

5. **`HabitSection.tsx`** — секция привычки на странице аспекта. Использует API из P1A.

#### Запрещено

- Не трогать `src/data/` (P1).
- Не трогать другие компоненты.
- Не менять SVG-разметку колёс — surgical только в плане типов.

#### Verification

```bash
npx tsc --noEmit
```

Ошибки в `src/components/AspectsView/`: 0.

#### Commit message

`ts(p2c): convert AspectsView to TypeScript`

---

### Agent P2D — Diary, Dashboard, Heatmap

**Worktree:** `../ts-worktrees/p2d-diary-dash`
**Branch:** `ts-p2d-diary-dash`
**Зависимости:** Phase 1

#### Зона ответственности

- `src/components/DiaryView/*.jsx` → `.tsx` (DiaryView, DailyReview, AnalyticsTab, EmotionsTab, TrainingsTab, VaultSyncTab — 6 файлов)
- `src/components/DashboardView/*.jsx` → `.tsx` (DashboardView, MiniWheel, DiscoverMore — 3 файла)
- `src/components/Heatmap/*.jsx` → `.tsx` (1 файл)

#### Что делаем

1. **`DiaryView.tsx`** — root компонент с табами. Типизируй state табов:
   ```ts
   type DiaryTab = 'entries' | 'today' | 'search' | 'emotions' | 'trainings' | 'analytics' | 'sync'
   ```

2. **`DailyReview.tsx`** — большой компонент с 8 аккордеонами по аспектам. Используй `AspectKey` для итерации.

3. **`EmotionsTab.tsx`, `TrainingsTab.tsx`** — таблицы. Типы emotion/training возьми из `@/types/api` (генерируются из FastAPI: см. модели `emotions`, `trainings` в backend/app/db/models.py).

4. **`MiniWheel.tsx`** — SVG-колесо на дашборде. Пропсы:
   ```ts
   type Props = {
     scores: AspectScores
     onAspectClick?: (aspect: AspectKey) => void
   }
   ```

5. **`Heatmap.tsx`** — GitHub-style heatmap. Пропсы — массив `{ date: string; count: number }` из API.

#### Запрещено

- Не трогать `src/components/Search*`, `src/components/AdminView/`, etc.

#### Verification

```bash
npx tsc --noEmit
```

Ошибки в зоне: 0.

#### Commit message

`ts(p2d): convert DiaryView, DashboardView, Heatmap to TypeScript`

---

### Agent P2E — Admin & Auth

**Worktree:** `../ts-worktrees/p2e-admin-auth`
**Branch:** `ts-p2e-admin-auth`
**Зависимости:** Phase 1

#### Зона ответственности

- `src/components/AdminView/*.jsx` → `.tsx` (AdminView, BulkTab, ModerationTab, NotifyTab, StatsTab, UsersTab — 6 файлов)
- `src/components/Auth/*.jsx` → `.tsx` (AuthModal — 1 файл)
- `src/components/ProfileView/*.jsx` → `.tsx` (1 файл)
- `src/components/PublicProfileView/*.jsx` → `.tsx` (PublicProfileView + ReactorsList — 2 файла)
- `src/components/SettingsView/*.jsx` → `.tsx` (1 файл)

#### Что делаем

1. **AdminView/UsersTab.tsx** — таблица юзеров с метриками. Использует `@/api/client` (типизированные endpoints) и admin-endpoints (тоже типизированы из OpenAPI). Типы юзеров берутся через `paths['/admin/users']['get']['responses']['200']['content']['application/json']`.

2. **AdminView/ModerationTab.tsx, BulkTab.tsx, NotifyTab.tsx, StatsTab.tsx** — типизируй пропсы и API-вызовы.

3. **AuthModal.tsx** — 3 mode (login/register/telegram-link). Типизируй state mode:
   ```ts
   type AuthMode = 'login' | 'register' | 'link'
   ```

4. **ProfileView.tsx, PublicProfileView.tsx** — типы профиля из API. AVATAR_OPTIONS типизируй как `readonly string[]`.

5. **SettingsView.tsx** — простой компонент настроек.

#### Запрещено

- Не трогать другие зоны.
- Не менять auth-флоу (telegram-redirect, token handling).

#### Verification

```bash
npx tsc --noEmit
```

#### Commit message

`ts(p2e): convert Admin, Auth, Profile, Settings to TypeScript`

---

### Agent P2F — Social Views (Coach, Hall, DM, Leaderboard, Search, Notifications)

**Worktree:** `../ts-worktrees/p2f-social`
**Branch:** `ts-p2f-social`
**Зависимости:** Phase 1

#### Зона ответственности

- `src/components/CoachView/*.jsx` → `.tsx`
- `src/components/HallView/*.jsx` → `.tsx`
- `src/components/DMView/*.jsx` → `.tsx`
- `src/components/LeaderboardView/*.jsx` → `.tsx`
- `src/components/SearchView/*.jsx` → `.tsx`
- `src/components/Notifications/*.jsx` → `.tsx`

#### Что делаем

Все эти компоненты используют API клиент. Импортируй типы из `@/types/api`:

```ts
import type { paths } from '@/types/api'

type HallOverview = paths['/api/hall/{aspect}']['get']['responses']['200']['content']['application/json']
type Insight = paths['/api/profile/insights']['get']['responses']['200']['content']['application/json'][number]
```

1. **CoachView.tsx** — форма ИИ-коуча + история. Реакция `stardust` payment — типизируй `pay_with_stardust: boolean`.

2. **HallView.tsx** — 5 вкладок (Обзор / Чат / Вопросы / Инсайты / Сообщество). Внутренний `type HallTab = ...`.

3. **DMView.tsx** — личные сообщения. Типы из API.

4. **LeaderboardView.tsx, SearchView.tsx, Notifications/*.tsx** — стандартная типизация.

#### Запрещено

- Не трогать другие зоны.

#### Verification

```bash
npx tsc --noEmit
```

#### Commit message

`ts(p2f): convert social view components to TypeScript`

---

### Agent P2G — Shell (Header, Footer, Toast, Loading, Welcome, Onboarding)

**Worktree:** `../ts-worktrees/p2g-shell`
**Branch:** `ts-p2g-shell`
**Зависимости:** Phase 1

#### Зона ответственности

- `src/components/Header/*.jsx` → `.tsx` (включая NotificationsBell если внутри)
- `src/components/Footer/*.jsx` → `.tsx`
- `src/components/Toast/*.jsx` → `.tsx`
- `src/components/LoadingScreen/*.jsx` → `.tsx`
- `src/components/Welcome/*.jsx` → `.tsx`
- `src/components/Onboarding/*.jsx` → `.tsx`

#### Что делаем

1. **Header.tsx** — навигация. Пропсы:
   ```ts
   type Props = {
     view: ViewName
     onViewChange: (view: ViewName) => void
     user: User | null
     onLogout: () => void
   }
   ```
   `ViewName` — определи union type здесь (или добавь в `src/types/view.ts` если используется в нескольких местах):
   ```ts
   type ViewName = 'dashboard' | 'aspects' | 'journey' | 'diary' | 'coach' | 'hall' | 'profile' | 'public-profile' | 'settings' | 'admin' | 'leaderboard' | 'dm' | 'search'
   ```

2. **Toast.tsx** — очередь тостов:
   ```ts
   type Toast = {
     id: string
     kind: 'info' | 'success' | 'error' | 'achievement'
     title: string
     desc?: string
     icon?: string
   }
   ```

3. **WelcomeScreen.tsx, Onboarding/*.tsx** — гостевой и онбординг экраны.

4. **LoadingScreen.tsx, Footer.tsx** — простая типизация пропсов.

#### Запрещено

- Не трогать другие зоны.

#### Verification

```bash
npx tsc --noEmit
```

#### Commit message

`ts(p2g): convert shell components (Header, Footer, Toast, etc) to TypeScript`

---

## Часть 7. Phase 3 — Integration (1 агент, ~2-4 часа)

### Agent P3 — Integration & Final Pass

**Worktree:** `../ts-worktrees/p3-integration`
**Branch:** `ts-p3-integration`
**Зависимости:** Все агенты Phase 2 завершены и смержены в `ts-migration`.

#### Задача

1. **Перевести оставшиеся root-файлы:**
   - `src/App.jsx` → `App.tsx` (это центральный роутер, использует ВСЕ типы)
   - `src/main.jsx` → `main.tsx`

2. **Зачистить все `TODO(ts):` оставленные предыдущими агентами:**
   - Сгрепай `TODO(ts):` по всему `src/`.
   - По каждому: либо реально починить тип (теперь, когда виден весь контекст), либо обосновать почему оставляем (и заменить на `// NOTE(ts): ...`).

3. **Финальный `tsc --noEmit` без ошибок:**
   ```bash
   cd slw-main/slw-main
   npx tsc --noEmit
   ```
   Должно быть **0 ошибок**.

4. **Сборка:**
   ```bash
   npm run build
   ```
   Должна пройти без warnings (или с теми же warnings, что и до миграции).

5. **Smoke test локально** (если есть локально работающий backend):
   ```bash
   npm run dev
   ```
   Открыть в браузере, проверить:
   - Логин (email + telegram-redirect)
   - Дашборд
   - Aspects view с одним аспектом
   - JourneyView → выбрать планету → пройти один скрипт
   - DiaryView → создать запись

6. **Удалить артефакты миграции:**
   - `slw-main/slw-main/scripts/openapi.json` — оставить (это snapshot для регенерации).
   - Никаких `.bak` файлов, оставленных артефактов.

7. **Обновить `CLAUDE.md`** — добавить секцию «Frontend stack: TypeScript strict» наверху. Не больше 5 строк.

8. **Обновить `package.json` scripts:**
   ```json
   "scripts": {
     "dev": "vite",
     "build": "tsc --noEmit && vite build",
     "preview": "vite preview",
     "predeploy": "npm run build",
     "deploy": "gh-pages -d dist",
     "types:api": "openapi-typescript ./scripts/openapi.json -o src/types/api.ts",
     "typecheck": "tsc --noEmit"
   }
   ```
   `build` теперь включает typecheck — гарантия что прод не соберётся с ts-ошибками.

#### Acceptance criteria

```bash
npx tsc --noEmit    # 0 errors
npm run build       # success
grep -r "TODO(ts):" src/  # пусто или явно объяснённые остатки
grep -r ": any" src/      # пусто (кроме комментариев)
grep -r "@ts-ignore" src/ # пусто
```

#### Commit message

`ts(p3): App.tsx + main.tsx, final integration pass, strict mode green`

---

## Часть 8. Финальный merge

После Phase 3:

```bash
cd /c/Serge/slw-slw-instruct/slw-slw-instruct
git checkout ts-migration
git merge --no-ff ts-p3-integration

# Финальный smoke test
cd slw-main/slw-main
npm install
npm run typecheck
npm run build
npm run dev   # потыкать вживую

# Если всё ок:
git checkout slw-instruct
git merge --no-ff ts-migration
git push

# Деплой
npm run deploy   # gh-pages
# Backend деплоить не нужно — он не менялся
```

---

## Часть 9. Резюме: дерево агентов

```
Phase 0 (sequential)
└── P0 Bootstrap                                                 [30-60 min]

Phase 1 (4 parallel)
├── P1A api/hooks/tma/locales                                    [2-4 h]
├── P1B data/skills/                                             [3-5 h]
├── P1C data/journey/                                            [3-5 h]
└── P1D data/aspects.js, hallContent.js                          [2-4 h]

Phase 2 (7 parallel)
├── P2A JourneyView core (2.3k LOC main file)                    [6-10 h]
├── P2B JourneyView/*SkillTree                                   [3-5 h]
├── P2C AspectsView (12 files inc. wheels)                       [3-5 h]
├── P2D DiaryView + DashboardView + Heatmap                      [3-5 h]
├── P2E AdminView + Auth + Profile + Settings                    [3-5 h]
├── P2F Coach + Hall + DM + Leaderboard + Search + Notif         [3-5 h]
└── P2G Header + Footer + Toast + Loading + Welcome + Onboarding [2-3 h]

Phase 3 (sequential)
└── P3 App.tsx + main.tsx + final pass                           [2-4 h]
```

**Wall-clock при параллельном запуске:** Phase 0 (1ч) + Phase 1 (5ч max) + Phase 2 (10ч max — узкое место P2A) + Phase 3 (4ч) = **~20 часов реального времени** при условии что мерджи между фазами быстрые.

**Всего человеко-часов агентов:** ~60-80 часов. На одном бы агенте это заняло бы 2-3 недели.

---

## Часть 10. Чек-лист для тебя (запуск каждой фазы)

### Перед запуском Phase 0
- [ ] `git status` чистый в `slw-instruct`
- [ ] Создан worktree `../ts-worktrees/p0-bootstrap`
- [ ] Backend (Railway) работает — нужен для скачивания `/openapi.json`

### Перед запуском Phase 1 (4 параллельно)
- [ ] Phase 0 PR проверен и смержен в `ts-migration`
- [ ] `tsconfig.json` существует, `npx tsc --noEmit` проходит
- [ ] Созданы 4 worktree (p1a, p1b, p1c, p1d)

### Перед запуском Phase 2 (7 параллельно)
- [ ] Все 4 Phase 1 PR смержены в `ts-migration`
- [ ] `npx tsc --noEmit` показывает ошибки только в `src/components/` (data/api типизированы)
- [ ] Созданы 7 worktree (p2a..p2g)

### Перед запуском Phase 3
- [ ] Все 7 Phase 2 PR смержены
- [ ] `npx tsc --noEmit` показывает <50 ошибок и все в `App.jsx` или в файлах с `TODO(ts):` метками
- [ ] Создан worktree `../ts-worktrees/p3-integration`

### Перед деплоем
- [ ] Phase 3 смержен в `ts-migration`
- [ ] `npm run typecheck` зелёный
- [ ] `npm run build` собирается
- [ ] `npm run dev` — все основные экраны работают
- [ ] `ts-migration` смержен в `slw-instruct`
- [ ] `npm run deploy`

---

## Приложение A. Промпт-шаблон для запуска агента

Каждому агенту копируешь в первое сообщение этот блок (заменяя `<AGENT_ID>`):

```
Ты выполняешь TypeScript-миграцию проекта SLW по плану.

ПРОЧИТАЙ ПЕРЕД РАБОТОЙ:
1. /c/Serge/slw-slw-instruct/<твой-worktree>/slw-slw-instruct/slw-main/slw-main/TS_MIGRATION_PLAN.md — найди свою секцию "Agent <AGENT_ID>".
2. /c/Serge/slw-slw-instruct/<твой-worktree>/slw-slw-instruct/CLAUDE.md — общие правила проекта.
3. Раздел "Часть 3. Общие правила для ВСЕХ агентов" в плане — обязательно.

ТЫ РАБОТАЕШЬ В ИЗОЛИРОВАННОМ WORKTREE. Все правки только внутри своей зоны ответственности (whitelist путей в твоей секции). Любой файл вне зоны — не трогать, не читать чтобы править.

ВЫПОЛНИ:
- Все задачи из своей секции плана.
- Запусти `npx tsc --noEmit` в slw-main/slw-main, приложи stdout.
- Один коммит с указанным message.

НЕ ДЕЛАЙ:
- npm install (deps уже стоят после Phase 0)
- Изменения в tsconfig.json, package.json (кроме явных пунктов в твоей секции)
- Изменения в файлах вне whitelist
- Использование `any`, `@ts-ignore`, `@ts-nocheck`
- Рефакторинг логики — только типы и переименование файлов
```

---

## Приложение B. Если что-то пошло не так

### Агент A правит файл, который должен править агент B
- Откатить коммит проблемного агента: `git revert <hash>` в его ветке.
- Перезапустить агента с уточнённым промптом «зона X запрещена».

### `tsc` ругается на тип после мержа фаз
- Скорее всего расхождение в общем типе (Phase 0 предположил одно, реальность другая).
- Фиксит **только Phase 3** или вручную ты — менять `src/types/*.ts` нельзя агентам Phase 1/2.

### Конфликт мерджа между двумя ветками Phase 1
- Не должно случиться — зоны не пересекаются. Если случилось — найти агента, нарушившего whitelist, откатить.

### Backend `/openapi.json` недоступен
- Запустить backend локально, или вручную выгрузить схему через Railway dashboard.
- Положить файл в `slw-main/slw-main/scripts/openapi.json` руками.

### Build падает после Phase 3, dev-server работает
- Чаще всего `tsc` строже, чем Vite. Смотри `npx tsc --noEmit` — это финальный gate.

---

**Конец плана.**
