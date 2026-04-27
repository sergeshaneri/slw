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

| File | What it does |
|------|-------------|
| `backend/serve.py` | Entry point: starts bot + uvicorn together |
| `backend/app/web/main.py` | FastAPI app, CORS, router registration |
| `backend/app/web/routes/auth.py` | Auth + account settings: register, login, TG OAuth, link, add-email, profile, change-password, remove-email, unlink-tg, delete-account, export, me |
| `backend/app/web/routes/` | scores, diary, state, sync, events routes |
| `backend/app/web/routes/events.py` | GET `/api/events?since_id=N` — общий event-лог bot↔web (см. ниже) |
| `backend/app/bot/handlers/events.py` | `emit_step_completed(tg_id, step)` — bot пишет в `journey_events` на каждом advance |
| `backend/app/scripts/backfill_events.py` | Одноразовый бэкфилл прошлого TG-прогресса в `journey_events` |
| `backend/app/scripts/promote_admin.py` | One-shot CLI: `python -m app.scripts.promote_admin --email ...` to set `is_admin=true` |
| `backend/app/db/models.py` | SQLAlchemy models (bot tables + web_users/state/scores/diary) |
| `backend/app/config.py` | Settings from env vars (bot_token, database_url, secret_key) |
| `slw-main/slw-main/src/App.jsx` | Root: auth gate, data loading, view routing |
| `slw-main/slw-main/src/api/client.js` | All API calls, JWT token in localStorage (`slw_token`) |
| `slw-main/slw-main/src/hooks/useAuth.js` | Auth state: checks token on mount, handles `?token=` redirect |
| `slw-main/slw-main/src/components/Auth/AuthModal.jsx` | Login/register modal (3 modes: guest, link-TG, add-email) |
| `slw-main/slw-main/src/components/Welcome/WelcomeScreen.jsx` | Shown to unauthenticated users |

### Auth flow

JWT stored in `localStorage['slw_token']`. Three paths:

1. **Email** — POST `/api/auth/register` or `/api/auth/login` → token in response
2. **Telegram (login)** — `<a href="/api/auth/telegram-start">` → Telegram OAuth page → `/api/auth/telegram-redirect?...` → frontend `?token=JWT` → `useAuth` picks it up
3. **Telegram (link to email account)** — Telegram Login Widget with `data-onauth` callback → POST `/api/auth/link`

### DB schema (two layers)

**Bot tables** (Telegram users): `users`, `user_state`, `scores`, `diary_entries`, `answers`, `script_steps`, `achievements`  
**Web tables** (web users): `web_users`, `web_state`, `web_scores`, `web_diary_entries`  
**Sync layer**: `journey_events` — общий event-лог между ботом и веб-приложением (см. ниже).

`web_users.telegram_id` links the two layers. Sync endpoints merge data at query time.

### Sync layer: journey_events (B1)

Bot и web — две почти независимые игры с одним и тем же скриптом. Чтобы прогресс из TG доезжал в web, bot эмитит события в `journey_events`:

| Поле | Что |
|------|-----|
| `telegram_id` / `web_user_id` | Один из двух (для bot всегда tg_id; для web — web_user_id если TG не залинкован) |
| `source` | `'bot'` \| `'web'` |
| `type` | `'step_completed'` (пока единственный тип) |
| `aspect`, `level`, `short_id` | Уже распарсенный bot-id: `бс-L0-T-1` → aspect='БС', level=0, short_id='T-1' |
| `step_id` | Полный bot-id, для отладки |

**Bot пишет** в `app.bot.handlers.script.py` через `_mark_completed()` → `emit_step_completed()` перед каждым `next_step()` (next/ack/score/open_answer handlers).

**Web читает** в `App.jsx:loadFromApi` через `fetchEvents(0)` и обогащает `journey.completedScripts` для текущего `(currentAspect, currentLevel)`.

**Web пишет** в `App.jsx:saveJourney` — диффим `completedScripts` против предыдущего, на каждый новый short_id POST `/api/events` (`source='web'`, fire-and-forget).

**Bot читает** через `pull_web_progress(telegram_id)` в `cmd_go`/`cmd_resume` (только entry-points, не в mid-flow handler-ах). Логика: находим самый поздний web-`step_completed` по `ord`; если он позже текущего шага бота — двигаем `user_state.current_step_id` на следующий за ним. **Только эти две команды** триггерят подтяжку — кнопки "Далее"/числовые ответы в TG продолжают работать с тем шагом, на котором бот уже стоял (чтобы не сбивать середину разговора).

**ID-форматы** разные: bot хранит `бс-L0-T-1` / `онбординг-intro-1`, web хранит `T-1` / `intro-1`. Конверсия — strip префиксов `<aspect.lower()>-` и `L<level>-` (см. `_short_id` в `events.py` и `backfill_events.py` — два места, синхронить).

**Бэкфилл**: `python -m app.scripts.backfill_events [--telegram-id N | --dry-run]` — для каждого юзера с `user_state.current_step_id` эмитит events для всех шагов с меньшим `ord`. Идемпотентный (удаляет старые `step_completed` перед заливкой).

**Что НЕ синхронизируется** (B1+ ограничения): сообщения чата (web-чат и TG-чат остаются разными хранилищами), ответы юзера (`answers` живут только в bot-таблице, в web не уходят), уведомления (отдельный тип event-а будет позже). Это слой над текущим `/api/sync/bot-state` — он остаётся для синка позиции/streak.

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

### Hardcoded values worth knowing

- `auth.py:FRONTEND_URL = "https://sergeshaneri.github.io/slw"` — куда редиректит `/telegram-redirect` после OAuth.
- `auth.py:telegram_start` — `origin` и `return_to` URLs захардкожены.
- `AuthModal.jsx` — `data-telegram-login="skb_coach_bot"` (username бота для Login Widget).

Если меняешь домен фронта или username бота — все три места надо синхронить.
