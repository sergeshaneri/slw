# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Project: SLW — Соционика, Колесо Баланса

### Stack

**Frontend** — React 18 + Vite, CSS Modules  
Path: `slw-main/slw-main/src/`  
Deploy: `npm run deploy` → gh-pages branch → `https://sergeshaneri.github.io/slw`  
Env: `VITE_API_URL=https://slw-production.up.railway.app` (in `.env.production`)

**Backend** — FastAPI + SQLAlchemy async (asyncpg) + python-telegram-bot v21  
Path: `backend/`  
Deploy: Railway auto-deploys from branch `slw-instruct`  
Start: `python serve.py` — runs bot + uvicorn in one asyncio event loop  
Config: `backend/railway.toml`

**Database** — PostgreSQL on Railway

### Key files

**Backend**
| File | What it does |
|------|-------------|
| `backend/serve.py` | Entry point: bot + uvicorn в одном loop. Содержит `apply_ddl()` — все DDL живут здесь (Alembic мёртв на Railway). |
| `backend/app/web/main.py` | FastAPI app, CORS, регистрация роутеров |
| `backend/app/db/models.py` | Все SQLAlchemy модели (3 слоя — см. DB schema) |
| `backend/app/config.py` | Settings: bot_token, database_url, secret_key, llm_provider, openrouter_api_key, mistral_api_key, llm_model, app_url |
| `backend/app/web/streak.py` | `bump_streak()` — best-effort пересчёт серверного стрика, вызывается из write-роутов |
| `backend/app/web/notify.py` | `notify()` + `notify_hall_writers()` — best-effort запись в `notifications` |
| `backend/app/llm/` | LLM-абстракция: `base.py` (интерфейс) + `stub.py` / `openrouter.py` / `mistral.py` (реализации). Фабрика `get_llm_client()` диспатчит по `settings.llm_provider`. |
| `backend/app/web/routes/auth.py` | Auth: register/login/TG OAuth/link/add-email/profile/change-password/remove-email/unlink-tg/delete-account/export/me |
| `backend/app/web/routes/profile.py` | Public-profile + insights CRUD + reactions + bookmarks-flag + achievements catalog (метаданные в коде, БД хранит только code) + heatmap + follow flag |
| `backend/app/web/routes/leaderboard.py` | Топ юзеров по XP (`step_completed` count + `completedScripts.length`, берётся max) |
| `backend/app/web/routes/coach.py` | ИИ-вызов: квота (1/день + бонус за streak), context-builder, stardust-оплата (trust-based) |
| `backend/app/web/routes/hall.py` | Холл аспекта: overview, chat (kind=message), Q&A (kind=question/answer/is_best), insights feed, leaderboard, inspirations |
| `backend/app/web/routes/dashboard.py` | Единый endpoint главной страницы для залогиненных |
| `backend/app/web/routes/notifications.py` | Список + mark-read |
| `backend/app/web/routes/dm.py` | Личные диалоги |
| `backend/app/web/routes/habits.py` | Выбор практики для аспекта + tick/untick + history |
| `backend/app/web/routes/streak.py` | GET /me + POST /shield (trust-based стардаст) |
| `backend/app/web/routes/bookmarks.py` | Закладки на инсайты |
| `backend/app/web/routes/search.py` | ILIKE-поиск по своим инсайтам/дневнику и публичным инсайтам сообщества |
| `backend/app/scripts/promote_admin.py` | CLI: `python -m app.scripts.promote_admin --email ...` |

**Frontend**
| File | What it does |
|------|-------------|
| `slw-main/slw-main/src/App.jsx` | Root: auth gate, data loading, view routing, тост-очередь, парсинг `?u=<id>` для deeplink на профиль |
| `slw-main/slw-main/src/api/client.js` | Все API-вызовы, JWT в `localStorage['slw_token']` |
| `slw-main/slw-main/src/hooks/useAuth.js` | Auth state, `?token=` в URL |
| `slw-main/slw-main/src/components/Auth/AuthModal.jsx` | Login/register (3 mode) |
| `slw-main/slw-main/src/components/Welcome/WelcomeScreen.jsx` | Гостевой стартовый экран |
| `slw-main/slw-main/src/components/DashboardView/` | Главная для залогиненных. `MiniWheel.jsx` — компактное SVG-колесо. |
| `slw-main/slw-main/src/components/HallView/` | Холл аспекта (4 вкладки: Обзор / Чат / Вопросы / Инсайты / Сообщество) |
| `slw-main/slw-main/src/components/ProfileView/` | Свой профиль, редактирование, секции стрика/практик/закладок |
| `slw-main/slw-main/src/components/PublicProfileView/` | Чужой профиль (read-only). `ReactorsList.jsx` — общий компонент списка реагировавших с переходом на профиль. |
| `slw-main/slw-main/src/components/CoachView/` | ИИ-коуч: форма + лента истории |
| `slw-main/slw-main/src/components/Heatmap/` | GitHub-style heatmap |
| `slw-main/slw-main/src/components/Toast/` | Очередь тостов (achievements, etc) |
| `slw-main/slw-main/src/data/aspects.js` | ASPECT_DATA + ASPECT_COLORS + ASPECT_KEYS |
| `slw-main/slw-main/src/data/hallContent.js` | Курируемый контент холлов: цитаты, личности, искусство, архетипы (детально для ЧИ, для остальных затравки) |

### Auth flow

JWT stored in `localStorage['slw_token']`. Three paths:

1. **Email** — POST `/api/auth/register` or `/api/auth/login` → token in response
2. **Telegram (login)** — `<a href="/api/auth/telegram-start">` → Telegram OAuth page → `/api/auth/telegram-redirect?...` → frontend `?token=JWT` → `useAuth` picks it up
3. **Telegram (link to email account)** — Telegram Login Widget with `data-onauth` callback → POST `/api/auth/link`

### DB schema (three layers)

**Bot tables** (Telegram users): `users`, `user_state`, `scores`, `diary_entries`, `answers`, `script_steps`, `achievements`

**Web identity / journey** (web users): `web_users`, `web_state`, `web_scores`, `web_diary_entries`

**Community / social layer** (всё на `web_user_id`):
- `public_profiles` — bio, avatar (эмодзи), focus_aspects, interests, inspirations[], goals[], is_public
- `aspect_insights` — публикации юзера по аспекту (kind: insight/recommendation, is_public)
- `insight_likes` — реакции (kind: heart/thanks/aha/fire) + опциональный `comment`
- `bookmarks` — закладки на инсайты, PK (web_user_id, kind, target_id)
- `subscriptions` — подписки follower→target
- `aspect_messages` — чат и Q&A в холле (kind: message/question/answer, parent_id для ответов, is_best для лучшего ответа)
- `notifications` — события юзеру (тип + payload JSONB + is_read)
- `direct_messages` — личные сообщения (sender_id, recipient_id, read_at)
- `habit_ticks` — ежедневные тики практик, PK (user, aspect, date)
- `user_habits` — выбранная практика для аспекта (один на (user, aspect))
- `user_streaks` — серверный стрик (current, longest, last_active_date, shield_until)
- `web_achievements` — разблокированные ачивки (PK user+code, метаданные в коде)
- `coach_calls` — лог ИИ-вызовов с tokens_in/out, paid_with_stardust

`web_users.telegram_id` links bot и web. Sync endpoints мерджат данные.

XP считается серверно: count `step_completed` в `journey_events` ИЛИ `web_state.journey.completedScripts.length` (берётся max). См. `_xp()` в profile.py и `leaderboard.py`.

### Known gotchas

**Alembic hangs on Railway** — advisory lock issue with PgBouncer. Solution: keep `startCommand = "python serve.py"` (no alembic). Apply new columns via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `serve.py → apply_ddl()`.

**Telegram widget popup** doesn't work on mobile. Use direct link to `/api/auth/telegram-start` instead (full-page redirect, no popup).

**CORS** — `allow_origins=["*"]`, no `allow_credentials` (Bearer tokens don't need it).

**Bot + web in one process** — `serve.py` runs both via asyncio. Don't call `bot.run_polling()` (it calls `asyncio.run()` internally and conflicts). Use `bot.updater.start_polling()` + `uvicorn.Server.serve()` in one `async with bot:` block.

### Deploy checklist

Backend change → push to `slw-instruct` → Railway auto-deploys  
Frontend change → push to `slw-instruct` + `npm run deploy` in `slw-main/slw-main/`

### Schema migrations workflow

**Alembic on Railway is dead** (см. gotcha). Файлы в `alembic/versions/*.py` существуют для документации и локальной разработки, но Railway их не выполняет.

For new columns, the only working path is `serve.py:apply_ddl()`:

```python
await conn.execute(text(
    "ALTER TABLE foo ADD COLUMN IF NOT EXISTS bar TEXT"
))
```

Все ALTER должны быть идемпотентны (`IF NOT EXISTS`), потому что `apply_ddl()` запускается на каждом старте контейнера. Когда добавляешь новое поле в SQLAlchemy-модель — сразу же добавь соответствующий ALTER в `apply_ddl`. Иначе бэк упадёт, как только код начнёт читать это поле с прода.

**Для новых таблиц / FK / индексов** проверенного пути пока нет: либо psql через Railway dashboard, либо реализовать `CREATE TABLE IF NOT EXISTS` через `apply_ddl`.

**Каждая таблица в своём try/except + asyncio.timeout(15s)** — если PgBouncer виснет на одном CREATE, остальной DDL и сам сервис продолжают подниматься. Шаблон уже устоявшийся, см. блоки в `serve.py`.

### Серверный стрик (важно)

Стрик считается на бэке через `app/web/streak.py:bump_streak()`. Best-effort функция вызывается из каждого «значимого» write-роута: `diary.post`, `profile.post_insight`, `profile.react`, `hall.post_message`, `habits.tick`, `dm.send`. **При добавлении новой write-операции — добавь хук**.

Старый `web_state.journey.streak` (frontend-managed) и `UserState.streak_days` (бот) остались как fallback в `_streak()` для миграции и для бот-юзеров. Но новый код пишет через `bump_streak`.

`shield_until` в `user_streaks` — серверная защита (один пропуск). Стардаст списывает фронт (trust-based), бэк только записывает дату.

### Stardust = trust-based на фронте

`stardust` живёт в `web_state.journey.stardust` (JSONB). Бэкенд стардаст не считает атомарно — **фронт обязан списать перед запросом** на оплачиваемый эндпоинт (coach `pay_with_stardust`, streak shield). Backend верит флагу `pay_with_stardust=true`.

Это сознательный технический долг. Phase 2 — перенести в колонку `web_users.stardust_balance` для атомарности.

### LLM-абстракция

ИИ-коуч ходит через `app/llm/get_llm_client()`. Провайдеры:
- `stub` (default) — echo-ответ, не требует ключа. Полезно для smoke-теста цепочки.
- `openrouter` — OpenAI-совместимый шлюз. Использует `openai` SDK с подменой `base_url`. Требует `OPENROUTER_API_KEY` + `app_url` (для `HTTP-Referer`).
- `mistral` — direct API. Требует `MISTRAL_API_KEY`.

Переключение: env `LLM_PROVIDER=...` + `LLM_MODEL=...`. Без релиза.

### Achievements catalog

Каталог в `routes/profile.py:ACHIEVEMENT_CATALOG` — словарь `{code: {title, icon, desc, check}}`. Метаданные в коде, БД (`web_achievements`) хранит только факт (`code` + `unlocked_at`). Проверка идёт в `_check_and_grant_achievements()` на каждый GET/PUT `/api/profile/me`. Idempotent (`ON CONFLICT DO NOTHING`).

При разблокировке возвращается `newly_unlocked` отдельным полем — фронт показывает тост и начисляет +1 стардаст.

### Дашборд = главная для залогиненных

`view='dashboard'` — дефолт после логина (см. App.jsx useEffect on `user`). Гость видит колесо с баннером «Ознакомься со сферами жизни». Колесо `view='wheel'` остаётся отдельной страницей.

Дашборд тянет всё одним запросом `GET /api/dashboard` (round-trip-экономия). Если добавляешь новый блок — расширяй существующий endpoint, не создавай новый.

### Концепция привычки = функция L1

В `user_habits` юзер сохраняет одно упражнение для аспекта (свободный текст). На L1 это будет обязательным выбором из упражнений уровня — TODO когда контент скриптов уровней будет готов (см. `data/journey/TODO.md`). Тики питают серверный стрик и heatmap.

### Header navigation

Сообщения и Профиль убраны из nav-меню, доступ через дашборд (карточки в блоке «✦ Я») + кликабельный аватар справа в Header (ведёт на свой профиль). Колокольчик уведомлений рядом — `NotificationsBell`.

### Admin / dev panel

`web_users.is_admin BOOLEAN` — гейт для dev-панели в JourneyView (skip step, autofill survey, fill all skills, jump levels, reset). Видна только в `view='journey'` правый-нижний угол как FAB 🛠.

Поставить флаг:
```sql
UPDATE web_users SET is_admin = true WHERE email = '...';
```
Или через `python -m app.scripts.promote_admin --email ...` (Railway CLI / Run command).

Фронт читает `user.is_admin` из `/auth/me`. После апдейта на бэке — релогин не нужен, достаточно перезагрузить вкладку.

### Journey content versioning

`slw-main/.../JourneyView/JourneyView.jsx → CONTENT_VERSION` (число). Бампать, когда меняешь L0/L1 markdown-контент так, что старая чат-история юзера ломается под новые тексты.

`migrateState()` сравнивает сохранённый `contentVersion` с текущим. При несовпадении — сбрасывает `messages`, `completedScripts`, `pendingTasks`, но сохраняет XP / streak / stardust / totalCompleted / lastActiveDate.

Без бампа юзер с кэшированным state увидит новые тексты, патченные в старую историю — визуально каша.

### Frontend conventions

- **CSS Modules** — каждый компонент рядом с `.module.css`. Глобальный CSS — только в `index.css` и `App.module.css`.
- **`?raw` markdown imports** — journey-контент (`bs-l0.md`, `bs-l1.md`, `surveys.md`, `onboarding.md`, `SCRIPT_GUIDELINES.md`) импортируется как сырой текст, парсится модулями `parseScripts.js` / `parseSurveys.js`. **Source of truth — `.md` файлы**, не JS-объекты.
- **Locale** — `src/locales/ru.js`, проп `t` в компонентах. Только русский, и большая часть текста всё равно захардкожена в JSX. Полноценная i18n далеко.
- **Storage** — JWT в `localStorage['slw_token']`. Префикс `whl_*` (whl_scores и т.п.) — наследие гостевого режима, сейчас не используется (WelcomeScreen требует логин).
- **Reactions** — единый набор: `heart`/`thanks`/`aha`/`fire`. Один тип на (юзер, инсайт). Свои инсайты лайкать нельзя.
- **Avatar** — эмодзи-набор в ProfileView (`AVATAR_OPTIONS`). Позже придёт upload, но интерфейс должен оставаться: одно поле `public_profiles.avatar` строкой.
- **Deeplink на профиль** — URL `?u=<id>` парсится в App.jsx mount-эффекте, открывает PublicProfileView и удаляет параметр из URL.

### Hardcoded values worth knowing

- `auth.py:FRONTEND_URL = "https://sergeshaneri.github.io/slw"` — куда редиректит `/telegram-redirect` после OAuth.
- `auth.py:telegram_start` — `origin` и `return_to` URLs захардкожены.
- `AuthModal.jsx` — `data-telegram-login="skb_coach_bot"` (username бота для Login Widget).

Если меняешь домен фронта или username бота — все три места надо синхронить.
