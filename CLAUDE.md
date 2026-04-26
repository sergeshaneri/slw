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
| `backend/app/web/routes/auth.py` | Auth: register, login, Telegram OAuth, link, me |
| `backend/app/web/routes/` | scores, diary, state, sync routes |
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

`web_users.telegram_id` links the two layers. Sync endpoints merge data at query time.

### Known gotchas

**Alembic hangs on Railway** — advisory lock issue with PgBouncer. Solution: keep `startCommand = "python serve.py"` (no alembic). Apply new columns via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `serve.py → apply_ddl()`.

**Telegram widget popup** doesn't work on mobile. Use direct link to `/api/auth/telegram-start` instead (full-page redirect, no popup).

**CORS** — `allow_origins=["*"]`, no `allow_credentials` (Bearer tokens don't need it).

**Bot + web in one process** — `serve.py` runs both via asyncio. Don't call `bot.run_polling()` (it calls `asyncio.run()` internally and conflicts). Use `bot.updater.start_polling()` + `uvicorn.Server.serve()` in one `async with bot:` block.

### Deploy checklist

Backend change → push to `slw-instruct` → Railway auto-deploys  
Frontend change → push to `slw-instruct` + `npm run deploy` in `slw-main/slw-main/`
