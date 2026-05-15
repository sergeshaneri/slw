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
| `backend/app/web/routes/diary.py` | POST/GET /api/diary + GET /api/diary/emotions /trainings /analytics /template (структуры из vault-sync) |
| `backend/app/web/routes/sync_vault.py` | Мост Obsidian-vault SLW-Mine ↔ веб-БД: POST /import (с conflict-detection), GET /export (ZIP в формате vault), GET /diff |
| `backend/app/sync/parser.py` | Парсер диарийных markdown-файлов: дата из имени файла + raw text + emotions[] (таблицы 7 полей) + trainings[] (`- присед 3×10×60`) + extra meta (энергия/сон/кофе) |
| `backend/app/bot/handlers/aspect.py` | Bot-handler для переключения аспекта в TG и навигации по `user_aspect_state` |
| `backend/app/scripts/promote_admin.py` | CLI: `python -m app.scripts.promote_admin --email ...` |
| `tools/vault_sync.py` | CLI-скрипт на компе: `import` / `export` / `diff` / `status`. Конфиг через `tools/.env`. См. `tools/README.md`. |

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
| `slw-main/slw-main/src/data/aspects.js` | ASPECT_DATA + ASPECT_COLORS + ASPECT_KEYS (ключи на латинице: Si/Se/Ti/Te/Fi/Fe/Ni/Ne) |
| `slw-main/slw-main/src/data/hallContent.js` | Курируемый контент холлов: цитаты, личности, искусство, архетипы (детально для ЧИ/Ne, для остальных затравки) |
| `slw-main/slw-main/src/data/journey/aspects/<Latin>/` | Контент путешествия по аспекту: `index.js` + `l0.md..l3.md` + `l0-surveys.md`. Папки: `Si/`, `Ti/`, `Ne/`, `Fe/`, `Ni/` |
| `slw-main/slw-main/src/data/journey/registry.js` | `JOURNEYS` map, `PLANETS` map (ключи латинские), `getAllPlanets()` для Карты Планет |
| `slw-main/slw-main/src/data/journey/skills/tree.js` | Дерево навыков БС (Si): 4 общих + 4 архетипа (всего 47) |
| `slw-main/slw-main/src/data/journey/skills/ne-tree.js` | Дерево навыков ЧИ (Ne): 3 общих + 4 архетипа (всего 36) |
| `slw-main/slw-main/src/data/journey/skills/ni-tree.js` | Дерево навыков БИ (Ni): 3 общих + 4 архетипа (всего 43) |
| `slw-main/slw-main/src/data/journey/skills/te-tree.js` | Дерево навыков ЧЛ (Te): 4 общих + 4 архетипа (62 навыка). Контент анкет в `te-surveys.md` |
| `slw-main/slw-main/src/data/journey/skills/ti-tree.js` | Дерево навыков БЛ (Ti): 3 общих + 4 архетипа (41 навык: Аналитик 8, Архитектор 7, Хранитель Порядка 11, Энциклопедист 12). Контент анкет в `ti-surveys.md` |
| `slw-main/slw-main/src/data/journey/fe-skills/` | Отдельная подпапка с навыками ЧЭ (Fe). До v16 называлась `che-skills/` (русский транслит) — переименована в правильную соционическую нотацию |
| `slw-main/slw-main/src/components/AspectsView/{Si,Fe,Ne,Ni,Fi,Te,Ti,Se}Wheel.jsx` | Колесо аспекта с разбивкой по 4 архетипам. До рефактора 2026-05 называлось `BSWheel`/`CheWheel` (транслит). Все 8 аспектов теперь имеют свои реальные Wheel-компоненты. |
| `slw-main/slw-main/src/components/AspectsView/PlaceholderWheel.jsx` | Заглушка-колесо для аспектов без skill-tree (на сейчас не используется — все 8 имеют свои *Wheel). Оставлен как утилита для будущих аспектов. |
| `slw-main/slw-main/src/components/JourneyView/PlanetMap.jsx` | Экран выбора планеты-аспекта |
| `slw-main/slw-main/src/components/DiaryView/DailyReview.jsx` | Вкладка «📅 Сегодня» — запись дня одним заходом по 8 аспектам |
| `slw-main/slw-main/src/components/DiaryView/EmotionsTab.jsx` | Таблица эмоций (фильтр «пики ≥ 8», сортировка, топ-5 повторяющихся, раскрытие 7 полей) |
| `slw-main/slw-main/src/components/DiaryView/TrainingsTab.jsx` | Тренировки группированы по дате + статистика + рекорды веса |
| `slw-main/slw-main/src/components/DiaryView/AnalyticsTab.jsx` | Список аналитических отчётов (week/month) с просмотром markdown |
| `slw-main/slw-main/src/components/DiaryView/VaultSyncTab.jsx` | Кнопка «Скачать ZIP» + инструкция настройки `tools/vault_sync.py` + блок с JWT (показать/копировать) |

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

**Vault-sync layer** (импорт/экспорт локального Obsidian-vault'а SLW-Mine):
- `analytics_reports` — недельные/месячные/custom отчёты (markdown целиком, идемпотентно по type+period)
- `aspect_goals` — цели по конкретному аспекту (markdown файла `goals/{aspect}.md`)
- `emotions` — эмоции из таблиц дневника (7 полей: name/intensity/trigger/body_sensation/roots/lesson/action)
- `trainings` — тренировки из секции «Тренировки» (exercise/sets/reps/weight_kg/notes)
- `web_users.diary_template` — шаблон записи (TEXT)
- `web_users.categorization_rules` — правила категоризации из `learnings.md` (подаются в промпт коуча)

**Bot extension** (per-aspect):
- `user_aspect_state` — прогресс юзера в одном аспекте (current_step_id, finished); ключ — (telegram_id, aspect). `users.current_aspect` указывает на «текущую папку», но source-of-truth прогресса — в `user_aspect_state`.

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

### Vault sync (мост к локальному SLW-Mine)

См. `PIPELINE.md` для описания локального пайплайна. Веб умеет принимать снимок vault'а и отдавать обратно в том же формате.

**Поток import (vault → веб):** скрипт `tools/vault_sync.py import` сканирует папку, парсит и шлёт `POST /api/sync/vault/import` одним JSON. Бэкенд распихивает:
- `diary/<filename>.md` → `web_diary_entries.text` (raw markdown целиком, `source='vault'`, `extra.vault_date` + `extra.local_hash`)
- Эмоции из таблиц → `emotions` (по дате; перед записью старые на эту дату удаляются)
- Тренировки из секции → `trainings` (то же)
- `goals/<Cyrillic>-<…>.md` → `aspect_goals` (UPSERT по PK user+aspect)
- `analytics/{type}-{start}-{end}.md` → `analytics_reports` (идемпотентно по user+type+period)
- `templates/template.md` → `web_users.diary_template`
- `skills/skb-coach-skill/learnings.md` → `web_users.categorization_rules`

**Идемпотентность:** SHA1 контента файла приходит как `local_hash`. Если запись с тем же хешем уже есть — skip. Можно гонять `import` каждый день.

**Conflict-protocol:** если на ту же дату уже есть запись с `source != 'vault'` (юзер писал в вебе) — бэк не трогает БД и возвращает обе версии в `conflicts[]`. Скрипт пишет их в `<vault>/conflicts/{date}-{ts}.md` для ручного разбора.

**Поток export (веб → vault):** `GET /api/sync/vault/export` отдаёт ZIP в структуре Mine vault'а (`diary/YYYY-MM-DD.md` + `goals/<aspect>.md` + `analytics/*.md` + `templates/template.md` + `skills/skb-coach-skill/learnings.md` + `manifest.json`). Скрипт `tools/vault_sync.py export` распаковывает в `SLW_VAULT` (с опц. `--merge` чтобы не перезаписывать локальные файлы).

**Конфиг скрипта** — `tools/.env` (gitignored): `SLW_BACKEND` / `SLW_TOKEN` / `SLW_VAULT` / `SLW_YEAR` (год для дат `04.24 пт.md` без года). Токен берётся из `localStorage.slw_token`. Если истёк — обновить `.env`.

**Парсер диария** в двух местах: `backend/app/sync/parser.py` (для серверной валидации) и в `tools/vault_sync.py` (для парсинга на стороне клиента). Дублирование намеренное — клиент не должен зависеть от установленного бэка для парсинга.

**UI:** Дневник → вкладки `💗 Эмоции / 💪 Тренировки / 📊 Отчёты / 🔗 Sync`. Empty-states содержат подсказку как импортировать через скрипт.

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

`migrateState()` сравнивает сохранённый `contentVersion` с текущим. При несовпадении — сбрасывает `messages`, `completedScripts`, `pendingTasks`, но сохраняет XP / streak / stardust / totalCompleted / lastActiveDate / skills.

Без бампа юзер с кэшированным state увидит новые тексты, патченные в старую историю — визуально каша.

**Заметные версии в истории:**
- v8 — per-aspect рефакторинг state (`state.aspects[key]`)
- v9 — ревизия дерева навыков БС (33 → 47)
- v10 — добавлен аспект ЧЭ
- v11 — 3 универсальные анкеты в L0 БС + COMMON_BASE_SKILLS (signals/interoception/honesty)
- v14 — рефактор ключей кириллица → латиница (`migrateCyrAspectKeys` запускается ДО version-check, чат не сбрасывается)
- v15 — добавлен аспект БИ (Tempum Spiralis)
- v16 — пересборка COMMON_BASE_SKILLS БС: 3 → 4 (body-listening / needs-awareness / timely-care / details). Старые signals/interoception/honesty возвращены в SKILL_TREE.healer как обычные ядерные навыки Целителя (id сохраняется → state.skills.* по ним не теряется)
- v25 — попытка фикса миграции: сохранять completedScripts и
  currentLevel при бампе. Стирала только messages. **Сломало UI**: при
  открытии активного аспекта Chat видел пустой `messages` и
  инициализировал чат заново, перетирая восстановленный `currentLevel`
  и `completedScripts`. Юзер видел L0 хотя в БД было L1.
- v26 — **миграция полностью data-preserving** (как match-version
  ветка): сохраняем ВСЕ поля каждого аспекта (messages, completedScripts,
  currentLevel, currentScriptId, pendingTasks, awaitingInput). Чат-
  историю под старые тексты юзер может увидеть в случае правок md, но
  это редко критично. Если в будущем потребуется реально сбросить чат
  при несовместимых правках — это будет отдельный механизм (per-user
  флаг или whitelist аспектов).

Если изменения только структурные (rename ключей, добавление полей) — миграция должна быть data-preserving, чтобы не терять чат пользователю. Пример — `migrateCyrAspectKeys` в v14.

### Aspect keys: Latin internally, Russian on display

**Internal ключи аспектов — латиница (стандартная соционическая нотация):**

| Latin | Cyrillic | Полное имя |
|-------|----------|-----------|
| `Si`  | БС | Белая Сенсорика (introverted sensing) |
| `Se`  | ЧС | Чёрная Сенсорика (extraverted sensing) |
| `Ti`  | БЛ | Белая Логика (introverted thinking) |
| `Te`  | ЧЛ | Чёрная Логика (extraverted thinking) |
| `Fi`  | БЭ | Белая Этика (introverted feeling) |
| `Fe`  | ЧЭ | Чёрная Этика (extraverted feeling) |
| `Ni`  | БИ | Белая Интуиция (introverted intuition) |
| `Ne`  | ЧИ | Чёрная Интуиция (extraverted intuition) |

`ASPECT_KEYS` order: `['Te', 'Ti', 'Fe', 'Fi', 'Se', 'Si', 'Ne', 'Ni']`. Все объекты ключей (`ASPECT_DATA`, `ASPECT_COLORS`, `ASPECT_REALMS`, `JOURNEYS`, `PLANETS`) — на латинице. Внутри значений (`ASPECT_DATA[key].name = "Чёрная Логика"`) русские лейблы — это display-текст, его не трогаем.

State пользователя тоже на латинице: `state.currentAspect = 'Si'`, `state.aspects = { 'Si': {...}, 'Ne': {...} }`.

**Display-маппинг для UI** — `data/aspects.js:ASPECT_DISPLAY_KEY`:
```js
{ Si: 'БС', Se: 'ЧС', Ti: 'БЛ', Te: 'ЧЛ', Fi: 'БЭ', Fe: 'ЧЭ', Ni: 'БИ', Ne: 'ЧИ' }
```
Латинские ключи юзеру **не показываем**. Везде, где на UI выводится короткий код аспекта (карточки на дашборде/Аспектах/PlanetMap, пилюли scoresLine, заголовки секций в DailyReview, опции в `<select>`, лейблы радар-чарта в WheelView), используем `ASPECT_DISPLAY_KEY[key]`. Если добавляешь новое место отображения — не пиши `{key}`, всегда оборачивай в `{ASPECT_DISPLAY_KEY[key]}`.

**Текущее состояние рефактора (TODO):**
- Frontend ✓ (полностью на латинице)
- `client.js` — двусторонний маппинг на границе с бэком: `latToCyr()` для исходящих (paths/body), `translateAspectsInResponse()` для входящих
- Backend ✗ — пока на кириллице. DB колонки с `aspect` (`web_scores.aspect`, `web_diary_entries.aspect`, `aspect_messages.aspect`, `aspect_insights.aspect`, `bookmarks.target_id`, `user_habits.aspect`, `habit_ticks.aspect`, `inspirations[].aspect`) — кириллица.
- TG-бот ✗ — `scripts.aspect`, `user_state.current_aspect` — кириллица

**Когда мигрировать backend на латиницу:** убрать слой перевода в `client.js`, добавить `UPDATE` всех aspect-колонок в `serve.py:apply_ddl()` (идемпотентно, `WHERE aspect IN ('БС','ЧС',…)` → SET по маппингу), пройтись по бэк-коду и заменить литералы. Бэкенд должен принимать оба ключа в transition-период (compat shim) — иначе будет ~30s downtime между деплоем фронта и бэка.

**Migration в JourneyView.migrateState** — `migrateCyrAspectKeys()` запускается ДО проверки версии: переименовывает `currentAspect` и ключи `aspects` с кириллицы на латиницу для уже-сохранённых юзеров. Чат не сбрасывается (это просто rename). См. `CONTENT_VERSION = 14`.

### Folder structure: aspects/<Latin>/

`slw-main/slw-main/src/data/journey/aspects/` разложен по подпапкам, каждая названа по латинскому коду аспекта:

```
aspects/
  Si/
    index.js         # exports SI_ASPECT_INTRO, SI_LEVEL_0_CORE, …
    l0.md, l1.md, l2.md, l3.md
    l0-surveys.md    # анкеты навыков для skill-tree
    drafts.md
  Ti/  index.js + l0.md
  Ne/  index.js + l0.md..l3.md
  Fe/  index.js + l0.md..l3.md   # внутри файлы l0.md...l3.md (без транслит-префикса che-)
  Ni/  index.js + l0.md..l3.md
```

`registry.js` импортит `import { SI_LEVEL_0_CORE } from './aspects/Si'` и т.п. Для добавления нового аспекта — создать папку с латинским кодом, написать `index.js` по шаблону существующих, добавить ветку в `JOURNEYS` в `registry.js` и установить `available: true`.

### Per-aspect journey state

С v8 `state` переключился на per-aspect структуру: chat/level/tasks хранятся в папке аспекта, чтобы юзер мог свободно переключаться между планетами без коллизий.

```js
state = {
  currentAspect: 'Si',      // активная планета
  aspects: {
    Si: {
      currentLevel, currentScriptIndex, currentScriptId,
      awaitingInput, messages, completedScripts, pendingTasks
    },
    Ne: { ... }
  },
  // Глобально (общее на все аспекты):
  skills, activeSurvey, skillDetailId,
  xp, streak, stardust, totalCompleted, lastActiveDate,
  screen, onboardingStep
}
```

Хелперы в `JourneyView.jsx`:
- `aspectOf(s)` — безопасное чтение активной папки (с дефолтом `DEFAULT_ASPECT_STATE`).
- `updateAspect(s, patch)` — иммутабельный апдейт активной папки (patch может быть объект или функцией).

**Все per-aspect setState** идут через `updateAspect`. Глобальные поля (xp, skills, и т.п.) — обычным spread.

### Planet Map / переключение аспектов

Юзер переключается между планетами через **Карту Планет** (`screen='planets'`, компонент `PlanetMap.jsx`). Точки входа:
- **Из чата** — клик по пилюле «текущая планета ▾» в шапке (с шевроном) → `onOpenPlanetMap`
- **Из дерева навыков** — кнопка «🪐 Планеты» в шапке `SkillTree`/`FeSkillTree`/`NeSkillTree`/`NiSkillTree`/`TeSkillTree`
- **Из JourneyProfile** (статистика юзера по планете, открывается кликом по аватару ◐ в шапке чата) — две точки: кликабельный заголовок с шевроном «{Полное имя} ▾» и отдельная кнопка «🪐 Сменить планету» рядом с «Продолжить путешествие» / «Начать заново»
- **Из AdminPanel** — блок «Планета» с быстрыми переключателями
- **После онбординга** — шаг 4 ведёт на Карту, юзер выбирает первую планету

`handleSwitchAspect(key)` в JourneyView:
- Если открыта анкета (`activeSurvey` или `screen='survey/survey-choice/survey-insight'`) — текущий проход сохраняется в `state.skills[id].draft` через `dismissActiveSurveyToDraft` (механизм draft уже есть для прерываний). Юзер вернётся к этому навыку и продолжит с того же утверждения.
- Если у нового аспекта папки ещё нет (первый заход) — инжектим intro-сообщения и первый скрипт L0 в `messages`, затем `screen='chat'`.
- Если уже был — просто восстанавливаем сохранённый чат.

`onboardingStep` глобальный (один раз пройти онбординг). После выбора первой планеты он становится `≥6`, чтобы онбординг больше не показывался.

**PlanetMap status-label** — `computeStatus` смотрит на `completedScripts.length`, не на `messages.length`. Это важно: если юзер просто открыл карту, выбрал планету и сразу ушёл — intro+первый скрипт уже инжектятся в `messages`, но `completedScripts` пуст → карточка показывает «Не начато». Иначе бы любой случайный заход помечался как «✓ Уровень 0».

### Common base skills (общие навыки БС)

`tree.js` для аспекта Si выделяет **4 универсальных навыка** в `COMMON_BASE_SKILLS` (с v16):
- `body-listening` — Слушать тело (вход)
- `needs-awareness` — Осознавать потребности (понимание)
- `timely-care` — Своевременно заботиться (выход)
- `details` — Внимание к мелким деталям (базовое качество тонкости)

Это сквозная цепочка восприятия → понимания → действия + базовое качество тонкости. Содержательное описание навыков по уровням — `Si/Навыки БС — Универсальные.md`.

Они **отображаются в каждой ветке** SkillTree с пилюлей «общий» и **входят в средний по каждому архетипу** (`calcArchetypeAvg` использует `getSkillsForArchetype(arche) = [...COMMON_BASE_SKILLS, ...specific]`). То есть один проход по `body-listening` влияет на средний всех 4 архетипов одновременно.

В L0 чате БС эти 4 анкеты включены как первая оценка БС (`SURV-100/101/102/103` в `aspects/Si/l0.md`) с подготовительным сообщением. После прохождения user видит, что у каждого архетипа уже есть стартовое значение, и колесо начинает наполняться.

**История.** До v16 в COMMON_BASE были `signals` / `interoception` / `honesty` (см. v11 в JourneyView.jsx). В v16 эти три навыка вернулись в SKILL_TREE.healer как обычные ядерные навыки Целителя (id остался прежним → state.skills сохраняется). На их место в COMMON_BASE введены 4 новых сквозных навыка верхнего уровня. Полные анкеты для них — SURV-55..58 в l0-surveys.md и `### Навык: <…>` в surveys.md.

Аспект Ne (ЧИ) использует похожий паттерн — `COMMON_BASE_SKILLS` в `ne-tree.js` (3 общих базовых: `attention-essence`, `metacognition`, `mindfulness`). Перевод ЧИ на четвёрку — TODO.

Аспект Ni (БИ) тоже имеет 3 общих базовых: `attunement`, `subconscious-listening`, `inner-silence` — встроены инлайн в L0-чат БИ как 15 B-вопросов (B-1..B-15) с `scale: 1-10`.

### Survey: per-question insight

В `SurveyScreen.jsx` каждое утверждение анкеты имеет необязательную кнопку **«✎ Записать инсайт»** — раскрывает textarea. Текст сохраняется в дневник (`source: 'journey-survey-statement'`, `prompt = текст утверждения`, `promptTitle = название навыка`) при клике «Дальше →».

Подсказка-тултип показывается на стартовых вопросах, закрывается крестиком (запоминается в `localStorage['survey_insight_hint_dismissed']`), и поднимается на ховер через 3 секунды.

XP за анкету: 10 за каждый закрытый проход. 3 мини-прохода = 30 XP, как и один full-проход.

### Survey: scale metadata

Помимо followUp-блоков (формат A: 1-10 + бот-реакция за диапазон), вопрос можно пометить флагом `scale: 1-10` в metadata. Это включит ползунок (`awaitingInput='number'` → `Slider`) даже без followUp-секций. Логика в `parseScripts.js` (читает metadata.scale → `script.scale = true`) и `ScriptButtons.jsx` (`hasScale = !!followUp || !!scale`).

Используется когда нужна шкала самооценки, но bot-reaction за каждый диапазон писать не хочется.

### Per-aspect skill trees (Si / Ne / Ni / Fe / Te)

Каждый аспект имеет свой `tree.js` (architecture, skill list, archetypes). Текущие реализации:
- **Si** (БС) → `slw-main/.../data/journey/skills/tree.js` (4 общих + 4 архетипа × N навыков, всего 47)
- **Ne** (ЧИ) → `data/journey/skills/ne-tree.js` (3 общих + 4 архетипа × N, всего 36)
- **Ni** (БИ) → `data/journey/skills/ni-tree.js` (3 общих + 4 архетипа × N, всего 43)
- **Fe** (ЧЭ) → `data/journey/fe-skills/tree.js` (отдельная подпапка `fe-skills/`, своя структура; 34 навыка с префиксом `fe-`)
- **Te** (ЧЛ) → `data/journey/skills/te-tree.js` + `te-skills.js` + `te-surveys.md` (62 навыка)
- **Ti** (БЛ) → `data/journey/skills/ti-tree.js` + `ti-skills.js` + `ti-surveys.md` (41 навык: 3 общих + Аналитик 8 + Архитектор 7 + Хранитель Порядка 11 + Энциклопедист 12)
- **Fi / Se** — навыков пока нет

В UI-компоненте `JourneyView.jsx` свитчер по `currentAspect` выбирает нужное дерево (`SkillTree` / `NeSkillTree` / `NiSkillTree` / `FeSkillTree` / `TeSkillTree` / `TiSkillTree` / `FiSkillTree` / `SeSkillTree`). Пилюля «Оценить навыки» в шапке чата (`surveyRemaining`) считает remaining через свич по `currentAspect` — для аспектов без дерева возвращает 0.

`resolveSurvey(skillId)` (`data/journey/skills/resolve.js`) централизует резолюцию анкеты: знает, какие skill-id принадлежат каким аспектам (Ne/Ni/Te/Ti/Fi/Se живут отдельно от БС-tree). При добавлении нового аспекта — добавь импорт его `getXxxSurvey` + `ALL_SKILL_IDS` и Set-проверку.

Скоринг общего балла аспекта (`scores[aspect]`) после прохождения анкеты обновляется в `handleSurveyInsight` для всех 4 аспектов с tree через `calcSiScoreFromSkills` / `calcFeScoreFromSkills` / `calcNeScoreFromSkills` / `calcNiScoreFromSkills`. Колесо на странице Аспекта читает `skills` напрямую (через свой `calc*ArchetypeAvg`) — там score актуален всегда.

**Колесо аспекта на странице Аспекты:** для Si/Fe/Ne/Ni — реальное колесо с архетипами (`SiWheel`/`FeWheel`/`NeWheel`/`NiWheel`). Для Te/Ti/Se/Fi — заглушка `<PlaceholderWheel/>` (4 пунктирных сектора с подписью «скоро»). Когда напишешь реальное колесо для Te — убери `'Te'` из массива `['Te','Ti','Se','Fi']` в `AspectsView.jsx` и добавь `{aspect === 'Te' && <TeWheel … />}` рядом с остальными.

**Префикс `che-` → `fe-` (рефактор 2026-05):** до этого ID навыков ЧЭ имели префикс `che-` (русский транслит). Переименованы на правильную соционическую нотацию `fe-`. Миграция работает через `renameChePrefix(id)` внутри `migrateSkills` в JourneyView — при загрузке state любые ключи `che-X` переписываются на `fe-X`. CONTENT_VERSION для этого rename **не бампали** (data-preserving). Аналогично переименованы `BSWheel`→`SiWheel`, `calcBSScoreFromSkills`→`calcSiScoreFromSkills`, `goToBSSurveys`→`goToSiSurveys`, `BS_SKILL_BY_RUS_NAME`→`SI_SKILL_BY_RUS_NAME` и т.п. — везде где прежде был русский транслит.

### DiaryView вкладки

В `DiaryView.jsx` теперь N вкладок (видны только залогиненным):
- **Записи** — обычный список записей дневника + форма ручного добавления
- **📅 Сегодня** (`DailyReview.jsx`) — запись дня одним заходом: общий блок «События» + 8 свёрнутых аккордеонов на каждый аспект с вопросами-чипами + чекбоксы привычек. Авто-скролл при раскрытии аккордеона выше sticky save-bar.
- **🔍 Поиск** (`SearchView.jsx`) — раньше был отдельным view, перенесён внутрь дневника
- **💗 Эмоции / 💪 Тренировки / 📊 Отчёты / 🔗 Sync** — отдельные вкладки (см. `EmotionsTab.jsx`, `TrainingsTab.jsx`, `AnalyticsTab.jsx`, `VaultSyncTab.jsx`)

Все блоки опциональны в Daily Review — юзер заполняет только то, что хочется. На «Сохранить день»: создаются отдельные diary-записи (`source: 'daily-review'`) для каждого заполненного блока + sync галочек привычек через `tickHabit/untickHabit`.

### Premium aspect palette

`ASPECT_COLORS` (data/aspects.js) подобраны как единая премиум-палитра для тёмного UI: все цвета сидят в полосе HSL L\* 56-67%, чтобы ни один не «выпадал» по яркости. Каждый цвет несёт психологическую семантику аспекта.

```
Te → #5F7081 → slate steel        (cool blue-grey, металл, индустриал)
                Note: текущий вариант мог быть бампнут до #8FA8BD luminous
Ti → #DCE2EB → pearl platinum     (светлый кристалл, ясность мысли)
Fe → #D85160 → luminous crimson   (страстный рубиновый огонь)
Fi → #E6C158 → radiant honey gold (золото нравственной ценности)
Se → #CC7152 → luminous burnt sienna (земля + огонь, активная воля)
Si → #A8D97B → fresh pistachio    (мягкая природа, уют, тело)
Ne → #8975DD → luminous indigo    (искра видения, третий глаз)
Ni → #B97FD2 → luminous amethyst  (мистика, время, подсознание)
```

**Принципы при подборе нового цвета:**
- Целевая яркость L\* 56-67% (не темнее — иначе сольётся с фоном `#0A0A0F`/`#15161C` тёмной темы)
- Высокая насыщенность без флуоресценции (S 40-60% в HSL)
- Соседние на колесе аспекты (Te-Ti, Fe-Fi, Se-Si, Ne-Ni) разделены по светлоте/насыщенности, не сливаются
- Семантика: огонь/страсть → красные тона; земля/тело → зелёный/коричневый; ум/металл → серо-синий; интуиция/время → фиолетовый

### Aspect content gating (AspectsView)

`blocks.js` определяет 24 секции теории аспекта с полем `level: 0|1|2|3` (отображаются группами под `LEVEL_LABELS`). Доступ к полному контенту блока зависит от прогресса юзера в путешествии **по этому конкретному аспекту**:

```js
accessLevel = isAdmin ? 99 : (journey?.aspects?.[aspect]?.currentLevel ?? 0)
isUnlocked = block.level <= accessLevel
```

Расклад блоков по уровням (см. `BLOCKS` в blocks.js):
- **L0 «Первый контакт»** — `essence`, `archetypes` (Тени и Дары)
- **L1 «Эпоха племён»** — `archetypePath`, `skills`, `coachTips`, `goals`, `assessment`, `historicalFigures`, `art`
- **L2 «Эпоха цивилизаций»** — `superpower`, `integration`, `synergy`, `polysemy`, `resources`, `practices`, `myths`, `quotes`
- **L3 «Эпоха алхимии»** — `dilemmas`, `redFlags`, `fears`, `somatic`, `culturalDifferences`, `childRaising`

**Tеaser-механика для locked-блоков:** даже если блок заблокирован, юзеру показывается **N первых элементов** + ниже размытый silhouette + lock-overlay с CTA. Это даёт пользу всем, включая тех кто не прошёл journey, но при этом видит что глубже есть ещё контент. Реализация — `teaseBlockData(block, data)` в `blocks.js` (возвращает обрезанную копию data, ниже которой рендерится silhouette).

`TEASER_BY_KIND` defaults:
- `list/numberedList/titledList` → 2 элемента
- `archetypes/somatic` → 1 пара (1 shadow + 1 gift)
- `dilemmas/practices/archetypePath` → 1 элемент
- `synergy/polysemy` → 2 элемента
- `assessment` → 1 микрополе (5 вопросов)
- `fears` → 1 (показываем страхи, защиты прячем)
- `text/textItalic` → 0 (тело прячется, остаётся только заголовок+lead)
- `integration` → 0 (показываем `desc + opposite`, скрываем `practices[]`)

Per-block override через `block.teaserCount` если нужно.

**UI:**
- В **Toc** (оглавление аспекта) locked-блоки помечаются 🔒 и приглушаются (opacity 0.62). Кликабельны.
- В **BlockReader** locked-блок: тизер сверху → ниже `.blockSilhouette` (5 размытых grey-полос за `blur(6px)`) → поверх `.blockLockOverlay` с замочком, плашкой `LEVEL_LABELS[block.level].code` и подсказкой «Достигни Уровня X в путешествии этого аспекта».
- В **сайдбаре** BlockReader locked-пункты тоже мутно с 🔒.

`isAdmin` (включая `devAdmin` пасхалку) полностью обходит гейт — видит весь контент.

### B-question → skill auto-sync (parseScripts metadata)

В L0/L1 чате есть B-вопросы (`type: 'question'`) с `scale: 1-10`, которые юзер отвечает ползунком. У такого вопроса можно указать `skill:` + `block:` метаданные — тогда ответ автоматически пишется в `state.skills[skill].answers[block][0]` (соответствует pass=1, statementIndex=0).

```md
## B-1 · question · Тонкое восприятие тела
xp: 5
scale: 1-10
skill: body-listening
block: knowledge
```

Парсер (`parseScripts.js`): читает `metadata.skill` → `script.skill`, `metadata.block` → `script.block`.

Эффект: после 5 таких ответов из 5 разных блоков (`knowledge`/`practice`/`awareness`/`priority`/`confidence`) навык получает `result` через `calcSurveyResult`, и колесо аспекта обновляется через `calc*ScoreFromSkills`. Это синхронизирует L0-чат с деревом навыков: SURV-карточка в дереве потом предложит «продолжить с pass 2», уже видя что pass 1 закрыт через L0-чат.

Используется для COMMON_BASE_SKILLS аспекта (Si: 4 universal, Ni: 3 universal) и потенциально для других навыков, которые хочется собрать через диалог в чате, а не через отдельный анкета-flow.

### Wheel визуал в дашборде

`MiniWheel.jsx` на дашборде:
- Внешний обод (двойная окружность) + 8 спиц
- Подписи аспектов снаружи обода (не внутри)
- Контур каждого сектора **до 10** (не до текущей оценки) с неоновым свечением через SVG-фильтр `mwNeonGlow`
- Заполнение сектора = `(score/10) * maxR`
- В лейбле секции — SVG-цветок `WheelFlowerGlyph` с 8 лепестками по цветам аспектов вместо emoji-кружка

### Settings → внутри Profile

Раздел «Настройки» убран из nav-меню. Доступ через кнопку «⚙ Настройки» в шапке `ProfileView.jsx`. Маршрут `view='settings'` остался, чтобы `handleViewChange('settings')` работал. `SettingsView.jsx` не трогали.

### Frontend conventions

- **CSS Modules** — каждый компонент рядом с `.module.css`. Глобальный CSS — только в `index.css` и `App.module.css`.
- **`?raw` markdown imports** — journey-контент (`l0.md`, `l1.md`, `surveys.md`, `onboarding.md`, `SCRIPT_GUIDELINES.md` в подпапках `aspects/<Latin>/`) импортируется как сырой текст, парсится модулями `parseScripts.js` / `parseSurveys.js`. **Source of truth — `.md` файлы**, не JS-объекты.
- **Aspect short-code на UI** — никогда не выводи `{key}` / `{aspect}` напрямую (там латиница). Используй `{ASPECT_DISPLAY_KEY[key]}` из `data/aspects.js`. Полное имя — `{ASPECT_DATA[key].name}`.
- **Имена в стандартной соционической нотации** — никаких `che-*` / `bs_*` / `chi_*` префиксов в именах файлов, переменных, ID. Только `Si/Se/Ti/Te/Fi/Fe/Ni/Ne` (и lowercase для тех же кодов в файлах: `fe-skills/`, `ne-tree.js`, `fe-pause` skill id). Если видишь старый транслит — это либо строковые литералы для бэка (`'БС'` — оставь), либо забытое место (переименуй).
- **Locale** — `src/locales/ru.js`, проп `t` в компонентах. Только русский, и большая часть текста всё равно захардкожена в JSX. Полноценная i18n далеко.
- **Storage** — JWT в `localStorage['slw_token']`. Префикс `whl_*` (whl_scores и т.п.) — наследие гостевого режима, сейчас не используется (WelcomeScreen требует логин).
- **Reactions** — единый набор: `heart`/`thanks`/`aha`/`fire`. Один тип на (юзер, инсайт). Свои инсайты лайкать нельзя.
- **Avatar** — эмодзи-набор в ProfileView (`AVATAR_OPTIONS`). Позже придёт upload, но интерфейс должен оставаться: одно поле `public_profiles.avatar` строкой.
- **Deeplink на профиль** — URL `?u=<id>` парсится в App.jsx mount-эффекте, открывает PublicProfileView и удаляет параметр из URL.

### Hardcoded values worth knowing

- `auth.py:FRONTEND_URL = "https://sergeshaneri.github.io/slw"` — куда редиректит `/telegram-redirect` после OAuth.
- `auth.py:telegram_start` — `origin` и `return_to` URLs захардкожены.
- `AuthModal.jsx` — `data-telegram-login="skb_coach_bot"` (username бота для Login Widget).

### Где живёт что (быстрая шпаргалка)

| Что | Где |
|---|---|
| Все DDL | `backend/serve.py:apply_ddl()` |
| Регистрация роутеров | `backend/app/web/main.py` |
| Каталог ачивок | `routes/profile.py:ACHIEVEMENT_CATALOG` |
| Системный промпт ИИ-коуча | `routes/coach.py:SYSTEM_PROMPT` |
| Слово дня (курируемые цитаты) | `routes/dashboard.py:_QUOTES_BY_ASPECT` |
| Архетипы аспектов (статика) | `slw-main/.../data/hallContent.js` |
| Маппинг латиница ↔ кириллица аспектов (внутри ↔ бэк) | `slw-main/.../api/client.js` (`latToCyr`/`cyrToLat` + `translateAspectsInResponse`) |
| Маппинг латиница → кириллица для UI-отображения | `slw-main/.../data/aspects.js:ASPECT_DISPLAY_KEY` |
| Миграция ID навыков `che-X` → `fe-X` + БС-rename | `JourneyView.jsx:renameChePrefix` + `SKILL_ID_MIGRATION` (вызываются в `migrateSkills`) |
| Сборка контента бота из markdown | `backend/app/content/build.py:_parse_aspect_md` (универсальный парсер; раньше назывался `_parse_bs_md`). Читает `aspects/Si/l0..l3.md`, пишет `compiled.json` |
| Маппинг между ботом и web | `web_users.telegram_id` |
| Парсер диария | `backend/app/sync/parser.py` (бэк-side) + `tools/vault_sync.py` (CLI) |
| Заглушка-колесо для аспектов без skill-tree | `AspectsView/PlaceholderWheel.jsx` |
| Admin Panel + endpoints | `backend/app/web/routes/admin.py` + `slw-main/.../components/AdminView/` |
| Append-only журнал прогресса | `backend/app/web/routes/events.py` + `JourneyEvent` модель |
| Step-insight prompt после T/S/R | `JourneyView/StepInsightPrompt.jsx` |
| Optimistic locking PUT /api/state | `state.py` (expected_updated_at) + `App.jsx` (`stateVersionRef`, `saveStateGuarded` queue) |

Если меняешь домен фронта или username бота — все три места надо синхронить.

### Append-only журнал прогресса (`journey_events`)

С 2026-05 каждый завершённый шаг чата (T/S/U/B/R) идёт в `journey_events`
двумя путями:
- **Бот** — пишет напрямую при advance юзера в TG.
- **Веб** — `POST /api/events/step-completed` из `JourneyView.awardXP`,
  idempotently (dedupe по `web_user_id + source='web' + aspect + short_id + level`).

При следующей загрузке `GET /api/events` отдаёт все события юзера, фронт
в `App.jsx:loadFromApi` мёрджит **и web, и bot** события в
`journey.aspects[X].completedScripts`. Это страховка от потери прогресса
при сбросах `web_state` (CONTENT_VERSION-бамп, конфликт PUT, race
condition). XP считается по `max(events count, completedScripts.length)`
в `profile._xp()`.

`/api/admin/restore-from-diary` использует extra.scriptId записей дневника,
`/api/admin/auto-position-from-diary` ставит позицию по последнему
scriptId дневника, `/api/admin/normalize-counters` синхронизирует
`totalCompleted` с фактической суммой `completedScripts` когда восстановить
точные ID больше неоткуда.

### Optimistic locking для `PUT /api/state`

`web_state.updated_at` теперь работает как ETag:
- `GET /api/state` возвращает `updated_at`.
- `PUT /api/state` принимает `expected_updated_at`; при mismatch → 409
  с телом `{ code: 'state_conflict', current_updated_at, your_expected }`.
- Если `expected_updated_at` не передан — проверка не делается
  (обратная совместимость).

**Фронт** (`App.jsx`):
- `stateVersionRef` хранит последний known `updated_at`.
- `saveStateGuarded(patch)` — **queue** через promise-chain
  (`lastSavePromiseRef`). Множественные patch-и за один шаг мёрджатся в
  один PUT через `saveDebounceRef`. PUT-ы идут строго последовательно —
  ref всегда свежий между ними, race condition «сам с собой» исключён.
- На 409: тихое обновление ref из тела 409 (без `loadFromApi` — он был
  слишком агрессивным, триггерил «загрузку» и откатывал локальный state).
- Все вызовы PUT /api/state в App.jsx идут через `saveStateGuarded`
  (saveJourney/saveHistory/achievements-grant).

### Обязательный insight после T/S/R-шага

`handleScriptAction` для `theory/word/reflection` action='next' ставит
`awaitingInput='step-insight'` вместо мгновенного `awardXP+advance`.
Chat.jsx рендерит `<StepInsightPrompt kind={script.type} onSubmit={...}/>`
— textarea с минимумом 10 символов, кнопка disabled пока пусто.
В `handleSend` ветка `awaitingInput === 'step-insight'`: пишет в дневник
`source='journey-step-insight'` + scriptId/promptTitle, потом `awardXP`
+ `deliverScript(next)`.

Это гарантирует, что каждый теоретический/словарный/рефлексивный шаг
оставляет видимый след в дневнике юзера.

### U-упражнения: «🪐 Взять в ежедневные практики»

ScriptButtons для `type='exercise'` показывает 3 кнопки:
- **✓ Сделал, записать инсайт** → `complete_exercise` → обязательный
  `exercise_note` → дневник + XP + advance.
- **🪐 Взять в ежедневные практики** → `done` → `enqueueTask(taken)`
  + `chooseHabit({aspect, title, exerciseId})` (запись в `user_habits`,
  упражнение появляется в блоке «Сегодня» на дашборде).
- **Позже** → `next` → `enqueueTask(deferred)`.

### Admin Panel UI (`/admin`)

Виден юзерам с `is_admin=true` (кнопка `🛡 admin` в шапке). 4 вкладки:
- **👥 Юзеры** — поиск, список с метриками (XP, completedScripts, drift),
  диагностика выбранного, действия: restore-preview/apply, promote,
  impersonate, rollback, полный дневник, редактор `web_state.journey`
  (JSON textarea), правка позиции аспекта (с dropdown скриптов уровня
  по `getJourney(aspect).levels[L].core`), авто-позиция по дневнику,
  сброс позиции аспекта, синхронизация счётчиков.
- **📊 Статистика** — DAU/WAU/MAU, регистрации 24h/7d/30d, TG-linked,
  drift-юзеры топ-50.
- **⚙ Массовые операции** — bulk-restore с threshold/limit, preview/apply,
  таблица результатов.
- **🛡 Модерация** — лента всех инсайтов, фильтр по аспекту/only_public,
  кнопки «скрыть/показать» и «удалить».

Backend admin endpoints (`backend/app/web/routes/admin.py`):
- `GET /admin/user-diagnostic` — recommendation эвристика
  (`all_synced` / `data_drift_recoverable` / `bot_progress_no_events` / ...)
- `POST /admin/restore-from-diary` — собирает scriptId из дневника
  и мёрджит в completedScripts; опционально бампает уровень при наличии
  R-2/R-3.
- `POST /admin/bulk-restore` — то же массово для drift > threshold.
- `POST /admin/normalize-counters` — `totalCompleted = sum completedScripts`.
- `POST /admin/user/{id}/set-aspect-position` — ручная правка позиции
  (currentLevel, currentScriptId). **Всегда сбрасывает awaitingInput**
  и pendingTasks при смене scriptId — иначе застрявший ползунок.
- `POST /admin/user/{id}/auto-position-from-diary` — для каждого аспекта
  ставит currentScriptId = последний из дневника, бампает уровень
  по эвристике (R-2/R-3 или ≥6 уникальных scriptId).
- `POST /admin/user/{id}/reset-aspect-position` — чистит messages,
  currentScriptId=null, currentScriptIndex=0, awaitingInput=null.
  completedScripts и currentLevel остаются.
- `POST /admin/rollback-restore` — откатывает к `_backup_before_restore`.
- `POST /admin/promote` — toggle is_admin (защита от самовыстрела).
- `POST /admin/impersonate` — выдать JWT от имени другого юзера
  (`auth.create_token(target.id)`).
- `GET  /admin/users` — пагинированный список с метриками.
- `GET  /admin/user/{id}/diary` — полный дневник юзера.
- `GET  /admin/user/{id}/journey` — полный JSON journey + сравнение
  skills между текущим и `_backup_*` (для ручного merge при потере).
- `POST /admin/user/{id}/merge-skills-from-backup` — слить skills
  из бэкапа в текущий state (только новые ID).
- `PATCH /admin/user/{id}/state` — прямая правка journey (опасно).
- `GET  /admin/insights` + `DELETE /admin/insight/{id}` + `PATCH` —
  модерация публичных инсайтов.
- `GET  /admin/stats` — сводная статистика.

Все mutation-эндпоинты пишут бэкап старого state в `_backup_*` поля
внутри journey JSONB (соответственно `_backup_before_restore`,
`_backup_before_normalize`, `_backup_before_position_edit`,
`_backup_before_auto_position`, `_backup_before_state_edit`).
Только последний бэкап сохраняется (вложенные не разрастаются).

### Page Aspects: обогащённые карточки

`AspectsGrid` (`AspectsView.jsx`) показывает на каждой плитке:
- Код аспекта + scores[key]/10 (текущая оценка).
- Название + sub (новые теглайны «мир X и Y», см. `aspects.js`).
- **Прогресс-бар** — процент пройденности текущего уровня
  (`completedScripts ∩ levelScripts / levelScripts.length`). Берётся
  из `getJourney(key).levels[currentLevel].core`. Если уровень пустой
  (Se/Fi пока без контента) — 0%.
- **Бэдж уровня** (L0/L1/L2/L3) в цвете аспекта.
- Подпись «X из Y шагов · N%» или «→ начать путешествие» если не начато.

`metaphor` поле в ASPECT_DATA сейчас не выводится в карточках. План
заменить его блоком «какие полезные навыки в жизни раскрываются» —
TODO когда будет готов контент. Сейчас поле остаётся в данных для
HallView.subline.

### UI-рефактор 2026-05: убраны WheelView и ProgressView

Старые view удалены целиком (949 строк deleted). Колесо живёт только
как `MiniWheel` в дашборде. История оценок (line chart) не использовалась
и удалена вместе с Recharts (–430 KB bundle). Гость после WelcomeScreen
→ «Начать бесплатно» попадает в `AspectsView` (read-only с teaser-
механикой из blocks.js). Default view для гостя: `aspects`. Для
залогиненного: `dashboard`.

Dev-admin пасхалка (5 кликов → toggle `localStorage.slw_dev_admin`)
переехала из ProgressView в букву **«й»** в конце строки «X активных
дней · Y событий за 30 дней» в Heatmap-заголовке дашборда.

### Слайдер оценки в AspectsView убран (2026-05)

В шапке аспекта раньше был `<input type=range min=1 max=10>` для ручной
правки `scores[aspect]`. Удалён — scores теперь обновляются автоматически
через прохождение анкет навыков (`calc*ScoreFromSkills` в
`handleSurveyInsight`). Осталась только кнопка «🏛 Войти в холл» в
filled-стиле с цветом аспекта и свечением.
