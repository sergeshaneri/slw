# Telegram Mini App (TMA) для SLW — план реализации

> Стек уже сильно подготовлен: FastAPI + python-telegram-bot v21 в одном asyncio loop, веб-фронт на React 18 + Vite, `web_users.telegram_id` уже связывает бот- и веб-юзера, есть `/api/auth/telegram-start` для OAuth. Под Mini App не нужен новый проект — это набор аддонов поверх существующего веба.
>
> Vault sync и export **из TMA-режима исключены** (по запросу) — соответствующие вкладки/кнопки скрыты, бэкенд-эндпоинты `/api/sync/vault/*` остаются живы для CLI-скрипта.

---

## 0. Стратегия билда

**Один SPA с runtime-детектом TMA.** Бандл `slw-main/slw-main/` грузится и в браузере (gh-pages), и внутри TG webview. На старте — проверка `window.Telegram.WebApp.initData`. Дальше ifы:

- скрыты: `AuthModal`, `WelcomeScreen`, `VaultSyncTab`, кнопки удаления аккаунта/смены пароля, форма привязки email
- авто-логин через `initData` → JWT в `localStorage['slw_token']`
- `themeParams` → CSS-переменные, перерисовка при `themeChanged`
- `MainButton` / `BackButton` подменяют свои sticky-кнопки и стрелки «назад»
- старт-параметр `?startapp=u_<id>` парсится как deeplink на профиль (аналог веб-`?u=<id>`)

`CONTENT_VERSION` бампать не нужно (формат `web_state.journey` не меняется).

Альтернативу с отдельным entrypoint / отдельным гх-пейджес-сабпасом отбрасываем: компонентный код переиспользуется почти весь, разница — десяток условных рендеров.

---

## 1. Backend: один новый эндпоинт + ослабление email-инварианта

### 1.1. `POST /api/auth/telegram-webapp`

Файл — [backend/app/web/routes/auth.py](backend/app/web/routes/auth.py).

```python
import hmac, hashlib, json, time
from urllib.parse import parse_qsl
from pydantic import BaseModel

class TMAInitBody(BaseModel):
    init_data: str

def verify_init_data(init_data: str, bot_token: str) -> dict | None:
    """HMAC-SHA256 верификация по спеке Telegram. Возвращает parsed dict или None."""
    parsed = dict(parse_qsl(init_data, strict_parsing=True))
    received_hash = parsed.pop("hash", None)
    if not received_hash:
        return None
    data_check = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    computed = hmac.new(secret, data_check.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed, received_hash):
        return None
    if int(parsed.get("auth_date", 0)) < time.time() - 86400:
        return None  # initData протух (> 24h)
    return parsed

@router.post("/telegram-webapp")
async def telegram_webapp(body: TMAInitBody, db: AsyncSession = Depends(get_db)):
    data = verify_init_data(body.init_data, settings.bot_token)
    if not data:
        raise HTTPException(401, "bad init_data")
    tg_user = json.loads(data["user"])
    user = await find_or_create_by_telegram(db, tg_user)
    return {
        "token": create_token(user.id),
        "user": serialize_user(user),
    }
```

### 1.2. `find_or_create_by_telegram`

Идёт в тот же `auth.py`. Логика:

1. `SELECT * FROM web_users WHERE telegram_id = :tid` — если есть, вернуть.
2. Иначе — `INSERT` с `email = NULL`, `password_hash = NULL`, `telegram_id = tid`, `display_name = first_name || username`, `tg_photo_url`, `created_at = now()`.
3. Создать пустой `web_state` (тот же шаблон, что в `register`).
4. Вернуть.

### 1.3. Email становится опциональным

Сейчас у `web_users` колонка `email` помечена `UNIQUE NOT NULL`. Менять на `UNIQUE NULL`. Идемпотентный ALTER в [backend/serve.py:apply_ddl()](backend/serve.py):

```python
await conn.execute(text(
    "ALTER TABLE web_users ALTER COLUMN email DROP NOT NULL"
))
```

PostgreSQL `UNIQUE` корректно работает с множественными `NULL`. Все запросы `WHERE email = ...` в auth-роутах не сломаются — они и так возвращали `None` для отсутствующих юзеров.

### 1.4. Опционально: rate-limit

`/api/auth/telegram-webapp` вызывается на каждый старт WebApp. Подержать в памяти dict `telegram_id → last_call_ts`, реджектить чаще 1 раза в 5 сек — защита от перебора при некорректном HMAC.

---

## 2. Frontend: bootstrap TMA

### 2.1. SDK

В [slw-main/slw-main/index.html](slw-main/slw-main/index.html) перед закрытием `<head>`:

```html
<script src="https://telegram.org/js/telegram-web-app.js?56"></script>
```

Версия `?56` — текущая стабильная. Скрипт сам подкладывает `window.Telegram.WebApp`.

### 2.2. Новый модуль `src/tma/index.js`

```js
import { API_URL } from "../api/client";

export const tma = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
export const isTMA = !!tma && tma.initData && tma.initData.length > 0;

export async function bootstrapTMA() {
  if (!isTMA) return null;
  tma.ready();
  tma.expand();
  tma.disableVerticalSwipes?.();  // свайп вниз не должен сворачивать WebApp

  const r = await fetch(`${API_URL}/api/auth/telegram-webapp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ init_data: tma.initData }),
  });
  if (!r.ok) throw new Error(`tma auth failed: ${r.status}`);
  const { token } = await r.json();
  localStorage.setItem("slw_token", token);
  return token;
}

export function getStartParam() {
  return tma?.initDataUnsafe?.start_param || null;
}

export function tmaHaptic(kind = "light") {
  tma?.HapticFeedback?.impactOccurred?.(kind);
}
```

### 2.3. Интеграция в `App.jsx`

В [slw-main/slw-main/src/App.jsx](slw-main/slw-main/src/App.jsx) — поверх существующего auth-gate'а:

```jsx
import { isTMA, bootstrapTMA, getStartParam } from "./tma";

const [tmaBootstrapped, setTmaBootstrapped] = useState(!isTMA);

useEffect(() => {
  if (!isTMA) return;
  bootstrapTMA()
    .then(() => setTmaBootstrapped(true))
    .catch(err => {
      console.error(err);
      setTmaBootstrapped(true);  // fallback на обычный auth-flow
    });
}, []);

if (!tmaBootstrapped) return <SplashScreen />;
```

Где раньше показывался `WelcomeScreen` / `AuthModal` — добавить `&& !isTMA`. В TMA-режиме после `bootstrapTMA` `useAuth` подхватывает свежий `slw_token` и сразу залогинивается.

### 2.4. Start-param как deeplink

В существующем эффекте парсинга `?u=<id>` (внизу `App.jsx`):

```jsx
useEffect(() => {
  const param = new URLSearchParams(location.search).get("u");
  const startParam = getStartParam();  // TMA
  const userId = param || (startParam?.startsWith("u_") ? startParam.slice(2) : null);
  if (userId) openPublicProfile(userId);
}, []);
```

Расширить под другие префиксы при необходимости: `aspect_Si`, `insight_<id>`, `coach` и т.п.

---

## 3. Темизация под TG

### 3.1. Маппинг `themeParams`

В `App.jsx` или отдельном `ThemeProvider`:

```js
function applyTgTheme() {
  if (!isTMA) return;
  const t = tma.themeParams;
  const root = document.documentElement;
  root.style.setProperty("--tg-bg", t.bg_color || "#0A0A0F");
  root.style.setProperty("--tg-text", t.text_color || "#E5E7EB");
  root.style.setProperty("--tg-hint", t.hint_color || "#6B7280");
  root.style.setProperty("--tg-link", t.link_color || "#60A5FA");
  root.style.setProperty("--tg-button", t.button_color || "#2563EB");
  root.style.setProperty("--tg-button-text", t.button_text_color || "#FFFFFF");
  root.style.setProperty("--tg-secondary-bg", t.secondary_bg_color || "#15161C");
  document.body.classList.toggle("tg-dark", tma.colorScheme === "dark");
}

useEffect(() => {
  applyTgTheme();
  tma?.onEvent?.("themeChanged", applyTgTheme);
  return () => tma?.offEvent?.("themeChanged", applyTgTheme);
}, []);
```

### 3.2. CSS-стратегия

Существующая премиум-палитра аспектов (`ASPECT_COLORS`) — **не трогаем**. Цвета аспектов несут семантику, тема ТГ их не должна перебивать.

В `index.css` добавить вариант:
```css
body.tma { background: var(--tg-bg); color: var(--tg-text); }
body.tma a { color: var(--tg-link); }
body.tma .secondaryPanel { background: var(--tg-secondary-bg); }
```

И в `bootstrapTMA` — `document.body.classList.add('tma')`.

Это страхует от резких контрастов на iOS-светлой теме у юзера.

---

## 4. Нативные элементы TG

### 4.1. Хуки

`src/tma/hooks.js`:

```js
import { useEffect } from "react";
import { tma, isTMA } from "./index";

export function useMainButton({ text, onClick, show = true, color, loading = false }) {
  useEffect(() => {
    if (!isTMA) return;
    const btn = tma.MainButton;
    if (!show) { btn.hide(); return; }
    btn.setText(text);
    if (color) btn.setParams({ color });
    if (loading) btn.showProgress(); else btn.hideProgress();
    btn.onClick(onClick);
    btn.show();
    return () => { btn.offClick(onClick); btn.hide(); };
  }, [text, onClick, show, color, loading]);
}

export function useBackButton(onClick) {
  useEffect(() => {
    if (!isTMA || !onClick) return;
    tma.BackButton.onClick(onClick);
    tma.BackButton.show();
    return () => { tma.BackButton.offClick(onClick); tma.BackButton.hide(); };
  }, [onClick]);
}
```

### 4.2. Где применяем MainButton

| View | Текст | Onclick |
|---|---|---|
| `CoachView` (форма) | «Спросить коуча» | submit формы |
| `DailyReview` | «Сохранить день» | saveDay() |
| `JourneyView` step-insight prompt | «Дальше →» | submit insight |
| `JourneyView` U-упражнение `exercise_note` | «Готово» | submit |
| `ProfileView` edit-mode | «Сохранить» | saveProfile() |
| `HallView` (Q&A, инсайт) | «Опубликовать» | submit |
| `AuthModal` | (не нужен — скрыт в TMA) | — |

В каждом из этих компонентов: внутренние sticky-bar'ы и кнопки `<button>` рендерим только `!isTMA && <Button…>`, в TMA-режиме их роль выполняет `useMainButton`.

### 4.3. Где применяем BackButton

Главное правило: BackButton показывается **везде кроме дашборда**. Дашборд = home. Везде остальное — `useBackButton(() => setView("dashboard"))` или `setScreen("planets")` по контексту.

Конкретные точки:
- `view === "hall"` → BackButton → `view = "dashboard"`
- `view === "coach"` → BackButton → `dashboard`
- `view === "diary"` → BackButton → `dashboard`
- `view === "profile"` (свой) → BackButton → `dashboard`
- `view === "public_profile"` → BackButton → закрыть, вернуться откуда пришли (`prevView` стейт)
- `JourneyView`, `screen === "skill-detail"` → BackButton → `screen = "tree"`
- `JourneyView`, `screen === "survey"` → BackButton → `screen = "tree"` (через `dismissActiveSurveyToDraft`)
- `BlockReader` в AspectsView → BackButton → закрыть → `view = "aspects"`

### 4.4. HapticFeedback

Точечно:
- `tmaHaptic('medium')` на завершение шага (`awardXP`)
- `tmaHaptic('light')` на тапы реакций (heart/thanks/aha/fire)
- `tmaHaptic('rigid')` на разблокировку ачивки (плюс существующий тост)
- `tma.HapticFeedback.notificationOccurred('success')` на «День сохранён», «Стрик +1», «Стардаст списан»

---

## 5. Адаптация UI: что скрыть / переделать

### 5.1. Полностью скрытое в TMA

| Компонент | Причина |
|---|---|
| `WelcomeScreen` | Auth автоматический |
| `AuthModal` | То же |
| `VaultSyncTab` | По запросу — vault sync вне TMA |
| `SettingsView` блоки: email, пароль, отвязка TG, удаление аккаунта | Идентичность = TG, нечего отвязывать; смена пароля не нужна |
| Header nav-меню | Заменяем на BackButton + дашборд как home |
| `AdminView` FAB | По желанию — оставить для `is_admin`, или скрыть (не для мобильного UX) |
| Кнопка «Скачать ZIP» в Diary | Файлы из webview не скачать |

### 5.2. Адаптация

| Компонент | Что меняется |
|---|---|
| `DashboardView` | OK как есть. MiniWheel SVG отлично смотрится на 360px. |
| `MiniWheel` | OK. |
| `HallView` | 5 вкладок (Обзор/Чат/Вопросы/Инсайты/Сообщество) — на узком экране надо проверить, что вкладки не уезжают; возможно `flex-wrap` или горизонтальный скролл |
| `CoachView` | Форма + история. MainButton вместо submit. |
| `DiaryView` (`Записи`/`Сегодня`/`Поиск`/`Эмоции`/`Тренировки`/`Отчёты`) | OK, без `Sync`. Sticky save-bar в `DailyReview` → MainButton. |
| `DailyReview` | 8 аккордеонов аспектов — есть scroll-into-view, mobile-friendly. Главное — заменить sticky save-bar. |
| `JourneyView` Chat | Ползунки 1-10, текстовый input, prompt-кнопки — всё работает. Sticky-form внизу: TG сам поднимает контент при клавиатуре. |
| `ProfileView` | OK; кнопка «⚙ Настройки» в шапке остаётся, но открывает урезанный `SettingsView`. |
| `PublicProfileView` | OK. |
| `AspectsView` | `BlockReader` модал на мобильном — full-screen overlay, BackButton закрывает. |
| `SkillTree` (все Si/Ne/Ni/Fe/Te/Ti) | SVG-деревья надо проверить на 360px: возможно нужен horizontal scroll или scale. |
| `Heatmap` | GitHub-style 52 недели × 7 дней на 360px = крошечные ячейки. Можно сжать до 12 недель в TMA. |

### 5.3. Sharing

Внутри TMA нельзя использовать `navigator.clipboard.writeText` свободно — на iOS требует gesture. Для шеринга инсайта/профиля:

```js
function shareToTelegram(text, url) {
  if (isTMA) {
    tma.openTelegramLink(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`
    );
  } else {
    navigator.clipboard.writeText(`${text}\n${url}`);
  }
}
```

Применить в `ProfileView` (кнопка «Поделиться профилем»), `InsightCard` (опционально кнопка «Поделиться»).

---

## 6. Deeplinks через start_param

Telegram прокидывает `?startapp=XYZ` в `WebApp.initDataUnsafe.start_param`.

Соглашение префиксов (расширяемое):
- `u_<id>` — открыть публичный профиль (аналог `?u=`)
- `aspect_<key>` — открыть AspectsView на конкретном аспекте
- `hall_<key>` — открыть холл аспекта
- `coach` — открыть коуча
- `insight_<id>` — открыть инсайт (через `view=public_profile&insight=<id>` или модал)

Парсинг — в `App.jsx` mount-эффект (см. 2.4).

Генерация ссылок для шеринга:
```js
const tmaLink = (param) => `https://t.me/skb_coach_bot/skb?startapp=${param}`;
```

Бот должен знать сокращённое имя WebApp — задаётся в BotFather (см. ниже, `skb`).

---

## 7. Push-уведомления через бота (опционально, фаза 3)

`backend/app/web/notify.py:notify()` уже пишет в таблицу `notifications`. Добавить параллельный канал — если у юзера есть `telegram_id`, послать TG-сообщение:

```python
async def notify(db, user_id: int, type: str, payload: dict, *, tg_text: str | None = None, tg_deeplink: str | None = None):
    # ... existing INSERT INTO notifications ...
    if tg_text:
        user = await db.get(WebUser, user_id)
        if user and user.telegram_id:
            try:
                kb = None
                if tg_deeplink:
                    kb = InlineKeyboardMarkup([[
                        InlineKeyboardButton("Открыть", web_app=WebAppInfo(url=tg_deeplink))
                    ]])
                await bot.send_message(user.telegram_id, tg_text, reply_markup=kb)
            except Exception:
                pass  # best-effort, как и остальной notify
```

Применять в существующих вызовах `notify` точечно — реакции на инсайты, новые DM, лучший ответ в Q&A. Не делать спам для каждого тика привычки.

`bot` импортируется из `app/bot/main.py` (тот же экземпляр, что бегает в `serve.py`).

---

## 8. Bot-side и BotFather

### 8.1. `/start` handler

В [backend/app/bot/handlers/](backend/app/bot/handlers/) — добавить или обновить `start.py`:

```python
async def start_handler(update: Update, ctx: CallbackContext):
    kb = InlineKeyboardMarkup([[
        InlineKeyboardButton(
            "🌟 Открыть SLW",
            web_app=WebAppInfo(url="https://sergeshaneri.github.io/slw/")
        )
    ]])
    await update.message.reply_text(
        "Привет 👋\nSLW — соционика + Колесо Баланса. Открой приложение:",
        reply_markup=kb
    )
```

Если у `update.message` есть `args` (`/start u_42`) — пробросить как `start_param`:
```python
deep = ctx.args[0] if ctx.args else None
url = "https://sergeshaneri.github.io/slw/"
# WebAppInfo не принимает query — start_param приходит автоматически только через t.me/<bot>/<app>?startapp=...
# Чтобы пробросить deep-параметр от /start <param> — оставить логику в боте отдельно: пуш сообщения с кнопкой t.me/bot/skb?startapp=<param>
```

Для proper deeplink — кнопка `url=` с `https://t.me/skb_coach_bot/skb?startapp={deep}` вместо `web_app=`. WebAppInfo через `web_app=` не несёт start_param сам.

### 8.2. BotFather настройка

Команды (в @BotFather):

```
/mybots → @skb_coach_bot → Bot Settings → Configure Mini App
  → "Add Mini App"
  → Title: SLW
  → Short name: skb
  → URL: https://sergeshaneri.github.io/slw/

/setmenubutton → @skb_coach_bot
  → Button text: Открыть SLW
  → URL: https://t.me/skb_coach_bot/skb

/setdomain → @skb_coach_bot
  → sergeshaneri.github.io
```

После этого:
- кнопка-меню рядом с полем ввода в чате с ботом запускает Mini App
- ссылка `https://t.me/skb_coach_bot/skb?startapp=u_42` открывает Mini App с `start_param = "u_42"`

---

## 9. Билд и деплой

### 9.1. Vite-конфиг

[slw-main/slw-main/vite.config.js](slw-main/slw-main/vite.config.js) — `base` уже настроен под `/slw/`. Менять не нужно.

### 9.2. CSP / iframe

Внутри TG webview iframe-фрейминг разрешён. Если на gh-pages есть `<meta http-equiv="X-Frame-Options" content="DENY">` — убрать. Проверить в `index.html`.

### 9.3. CORS

`allow_origins=["*"]` в `app/web/main.py` — TMA не требует ничего ещё. Bearer-токен не нуждается в credentials.

### 9.4. Деплой-чеклист

1. Frontend: `npm run deploy` в `slw-main/slw-main/` — пушит в `gh-pages`.
2. Backend: `git push origin slw-instruct` — Railway деплоит сам.
3. BotFather: настроить Mini App + menu button (один раз).
4. Smoke: открыть `@skb_coach_bot` → нажать menu button → должен открыться WebApp с авто-логином.

---

## 10. Тестирование

### 10.1. Локальная разработка

Telegram не пускает `http://localhost` в WebApp напрямую. Варианты:
- **`ngrok http 5173`** + кладёте HTTPS-URL в BotFather как Mini App URL (для dev-бота, не прода)
- **TG Web (web.telegram.org)** — кликнуть на menu button, открыть DevTools, симулировать `initDataUnsafe`
- **TG Desktop** beta — лучшая поддержка WebView devtools

### 10.2. Чек-лист сценариев

1. Открытие из чата → splash → дашборд за < 2 сек
2. Открытие со `startapp=u_<id>` → публичный профиль
3. Открытие со `startapp=aspect_Si` → AspectsView с Si
4. Прохождение шага в `JourneyView` → MainButton «Дальше →» работает, haptic срабатывает, XP начисляется
5. Coach call → MainButton «Спросить», стардаст списан, ответ пришёл
6. Daily Review → 3 аспекта заполнены → MainButton «Сохранить» → запись в дневнике
7. Тап на «🔙» (BackButton TG) из чужого профиля → возврат на дашборд
8. Тёмная тема ТГ → фон бэкграунд тёмный, контраст ок
9. Светлая тема ТГ → проверить читаемость
10. Закрыть/открыть WebApp → JWT в `localStorage` сохранён, login пропускается
11. Юзер уже залогинен через email на gh-pages, потом открыл TMA → должен получить тот же web_user через `telegram_id` (если был привязан) или новый (если не был)

### 10.3. Edge cases

- `initData` не прислан (открыли URL вне TG): fallback на обычный auth-flow → AuthModal
- `auth_date` старше 24h: 401 → фронт пытается `tma.close()` и просит переоткрыть
- `telegram_id` не привязан к email-аккаунту, но email-аккаунт уже есть с этим именем: создаётся отдельный web_user, можно потом смержить через UI (фаза 2)
- WebApp закрыт через свайп: данные в `localStorage` остаются, при следующем открытии — мгновенный auto-login через JWT (initData не дёргаем повторно если токен валиден)

---

## 11. Фазы внедрения

### Фаза 1: MVP (5-8 дней)

Цель: WebApp открывается из бота, юзер авто-логинится, видит дашборд, проходит шаги в `JourneyView`, пишет в дневник, общается с коучем.

- [ ] Backend: `verify_init_data`, `POST /api/auth/telegram-webapp`, `find_or_create_by_telegram`, ALTER email DROP NOT NULL
- [ ] Frontend: SDK в `index.html`, `src/tma/index.js`, `bootstrapTMA` в `App.jsx`
- [ ] Скрытие в TMA: `AuthModal`, `WelcomeScreen`, `VaultSyncTab`, нав-меню header
- [ ] BotFather: создать Mini App, menu button, domain
- [ ] `/start` handler в боте с WebApp-кнопкой
- [ ] Smoke-тест на TG Desktop + iOS + Android

### Фаза 2: Polish (5-7 дней)

- [ ] `useMainButton` / `useBackButton` хуки
- [ ] MainButton на: Coach submit, DailyReview save, ProfileView edit save, JourneyView step-insight submit, Hall публикация
- [ ] BackButton на всех view кроме dashboard
- [ ] HapticFeedback на: awardXP, реакции, ачивки, success-операции
- [ ] Темизация — `themeParams` → CSS-vars
- [ ] `start_param` парсинг для `u_<id>`, `aspect_<key>`, `hall_<key>`, `coach`
- [ ] Sharing: `shareToTelegram` в Profile/Insight

### Фаза 3: Мобильная отшлифовка (5-10 дней)

- [ ] Аудит на 360px viewport: `HallView` вкладки, `SkillTree` SVG, `Heatmap` (сжать до 12 недель в TMA)
- [ ] `BlockReader` full-screen overlay поведение
- [ ] Push через бота — добавить в `notify()` опциональный TG-канал, применить в 3-4 ключевых местах (DM, реакции на инсайты, лучший ответ)
- [ ] Сжатие `Heatmap` в TMA-режиме
- [ ] `SkillTree` zoom / horizontal scroll
- [ ] Опционально: скрыть `AdminView` в TMA или оставить компактный subset

### Фаза 4: Опциональное (по желанию)

- [ ] Слияние email-аккаунта и TMA-аккаунта если юзер открыл оба: UI «у тебя 2 профиля — слить?»
- [ ] Использование `tma.requestWriteAccess()` для пушей без диалога
- [ ] `tma.CloudStorage` для синхронизации каких-то клиентских настроек между девайсами
- [ ] Решение: оставлять ли старый бот-flow (`handlers/aspect.py`) или Mini App его полностью замещает

---

## 12. Известные риски

- **iOS WebView и `localStorage`**: TG иногда чистит storage между сессиями. Мы это покрываем — bootstrap всегда дёргает `/telegram-webapp` если нет токена.
- **`initData` устаревает за 24h**: при долгой неактивности — повторный bootstrap. Не проблема.
- **gh-pages cache**: новая версия фронта может несколько минут не подтягиваться. Релизный workflow тот же что и был.
- **`web_app=WebAppInfo()` vs `url=t.me/bot/app`**: первое не передаёт `start_param`. Для deeplink-кнопок в боте всегда использовать `url=https://t.me/skb_coach_bot/skb?startapp=...`.
- **PgBouncer hang при ALTER**: уже знаем — `apply_ddl` в `serve.py` с try/except + asyncio.timeout(15s) обходит. Добавить новый ALTER в существующий блок.
- **Двойная идентичность**: юзер залогинен через email на вебе, открыл TMA — создаётся новый web_user. Слияние — отдельная фича (фаза 4). На первое время — предупреждение в FAQ.

---

## 13. Места в коде, которые точно меняются

| Файл | Что |
|---|---|
| `backend/app/web/routes/auth.py` | + `verify_init_data`, + `POST /telegram-webapp`, + `find_or_create_by_telegram` |
| `backend/serve.py` | + ALTER `web_users` email DROP NOT NULL |
| `backend/app/bot/handlers/start.py` (новый или существующий) | + WebApp кнопка |
| `backend/app/web/notify.py` (фаза 3) | + опциональный TG-канал |
| `slw-main/slw-main/index.html` | + `<script>` SDK |
| `slw-main/slw-main/src/tma/index.js` (новый) | bootstrap, helpers |
| `slw-main/slw-main/src/tma/hooks.js` (новый) | useMainButton, useBackButton |
| `slw-main/slw-main/src/App.jsx` | + bootstrap useEffect, + `isTMA` гейты для AuthModal/Welcome, + start_param parsing |
| `slw-main/slw-main/src/components/Auth/AuthModal.jsx` | render guard `!isTMA` |
| `slw-main/slw-main/src/components/Welcome/WelcomeScreen.jsx` | render guard `!isTMA` |
| `slw-main/slw-main/src/components/DiaryView/VaultSyncTab.jsx` | в DiaryView не рендерить вкладку при `isTMA` |
| `slw-main/slw-main/src/components/Settings/SettingsView.jsx` | блоки `!isTMA` для email/password/unlink |
| `slw-main/slw-main/src/components/DashboardView/Header.jsx` (или где живёт nav) | nav-меню hide в TMA |
| `slw-main/slw-main/src/components/CoachView/CoachView.jsx` | useMainButton на submit |
| `slw-main/slw-main/src/components/DiaryView/DailyReview.jsx` | useMainButton на save, скрыть sticky save-bar |
| `slw-main/slw-main/src/components/JourneyView/StepInsightPrompt.jsx` | useMainButton на «Дальше →» |
| `slw-main/slw-main/src/components/HallView/*` | useMainButton на публикацию |
| `slw-main/slw-main/src/components/ProfileView/ProfileView.jsx` | useMainButton в edit-mode |
| `slw-main/slw-main/index.css` или `App.module.css` | + правила для `body.tma` |

---

## 14. Не делаем (out of scope этой итерации)

- Vault sync / vault export в TMA — по запросу
- Полная нативная переписка (Flutter / Compose Multiplatform) — overkill, gh-pages-веб справится
- Замена существующего TG-бота (`handlers/aspect.py` чат-flow) на TMA — отдельный архитектурный шаг, решается после фазы 1-2
- Платёжная интеграция через TG Stars вместо stardust — потенциальная фича, отдельный проект
- Полная i18n — только русский, как и сейчас
