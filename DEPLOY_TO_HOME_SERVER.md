# Переезд SLW с GitHub Pages + Railway на домашний сервер (Windows Server 2019 + IIS)

Документ описывает, как перенести приложение с текущего хостинга (фронт на GitHub Pages, бэк и БД на Railway) на собственный сервер у друга — Windows Server 2019 со статическим IP и доменом.

Целевой стек: **IIS** в качестве веб-сервера + **PostgreSQL** + **Python/FastAPI** под управлением **NSSM** как Windows-сервис. Сертификаты HTTPS — через **win-acme** (Let's Encrypt). Связка выбрана потому, что друг знаком с IIS.

---

## Содержание

1. [Архитектура «после переезда»](#1-архитектура-после-переезда)
2. [Программы и их роли](#2-программы-и-их-роли)
3. [Фаза 0. Подготовка до подключения к серверу](#фаза-0-подготовка-до-подключения-к-серверу)
4. [Фаза 1. Базовая подготовка сервера](#фаза-1-базовая-подготовка-сервера)
5. [Фаза 2. PostgreSQL + миграция данных](#фаза-2-postgresql--миграция-данных)
6. [Фаза 3. Бэкенд (FastAPI + Telegram-бот)](#фаза-3-бэкенд-fastapi--telegram-бот)
7. [Фаза 4. Фронтенд (сборка React)](#фаза-4-фронтенд-сборка-react)
8. [Фаза 5. Публикация через IIS](#фаза-5-публикация-через-iis)
9. [Фаза 6. Telegram-бот](#фаза-6-telegram-бот)
10. [Фаза 7. Smoke-тест](#фаза-7-smoke-тест)
11. [Фаза 8. Что НЕ выключать сразу](#фаза-8-что-не-выключать-сразу)
12. [TODO на ближайшие недели после переезда](#todo-на-ближайшие-недели-после-переезда)
13. [Чек-лист для друга (IIS-часть)](#чек-лист-для-друга-iis-часть)

---

## 1. Архитектура «после переезда»

```
Интернет (пользователи + Telegram)
        │
        ▼
   [Роутер друга] — проброс портов 80 и 443 на сервер
        │
        ▼
[Windows Server 2019]
   │
   ├── Windows Firewall: разрешены входящие 80 и 443
   │
   ├── IIS (слушает 80 и 443) ◄── ЛИЦО сайта
   │     │
   │     ├── HTTPS-сертификат от Let's Encrypt (обновляется win-acme автоматически)
   │     ├── твой_домен/         → отдаёт файлы фронта из C:\slw\frontend\
   │     ├── твой_домен/api/...  → реверс-прокси на 127.0.0.1:8000 (ARR + URL Rewrite)
   │     └── HTTP → HTTPS редирект
   │
   ├── Python-процесс (FastAPI + uvicorn + telegram-bot)
   │     слушает 127.0.0.1:8000 (только локально, наружу не светит)
   │     запущен через NSSM как Windows-сервис `slw-backend`
   │     │
   │     ├── ходит в PostgreSQL на 127.0.0.1:5432
   │     ├── ходит наружу в OpenRouter (ИИ)
   │     └── ходит наружу в Telegram API (бот)
   │
   └── PostgreSQL (слушает 127.0.0.1:5432, только локально)
         Windows-сервис postgresql-x64-16
         данные в C:\slw\pgdata\
```

**Ключевая идея:** наружу из интернета доступен только IIS. Бэкенд и БД — на «локалхосте», и их никто извне не достанет напрямую. Это безопасно по умолчанию.

---

## 2. Программы и их роли

| Программа | Роль | Откуда взять |
|---|---|---|
| **IIS** + **URL Rewrite** + **ARR** | Веб-сервер на входе. Принимает HTTPS из интернета, отдаёт фронт-статику, проксирует `/api/*` на бэкенд. ARR (Application Request Routing) даёт способность работать как реверс-прокси. | Server Manager → Add Roles + два отдельных установщика с iis.net |
| **win-acme** | Получает бесплатные HTTPS-сертификаты от Let's Encrypt и автоматически их обновляет (создаёт Scheduled Task). | win-acme.com |
| **PostgreSQL 16** | База данных. Та же, что сейчас на Railway, просто переедет к тебе. | postgresql.org → Windows installer |
| **Python 3.11** | Среда, в которой работает бэкенд. | python.org (при установке — галка «Add Python to PATH») |
| **uv** | Быстрый менеджер зависимостей Python. Ставит библиотеки из `pyproject.toml`. | `irm https://astral.sh/uv/install.ps1 \| iex` |
| **FastAPI / uvicorn** | Сам наш бэкенд из `backend/`. FastAPI — фреймворк, uvicorn — сервер, слушающий порт 8000. | уже в `pyproject.toml`, ставится автоматически через `uv sync` |
| **python-telegram-bot** | Telegram-бот, поднимается тем же процессом, что и FastAPI. | в `pyproject.toml` |
| **NSSM** (Non-Sucking Service Manager) | Превращает Python-скрипт в Windows-сервис: автостарт при включении, перезапуск при падении, логи в файлы. | nssm.cc |
| **Node.js LTS + npm** | Нужны для сборки фронтенда (`npm run build`). Можно ставить на сервер или собирать локально и заливать готовое. | nodejs.org |
| **Git for Windows** | Клонирование репы, обновления. | git-scm.com |
| **AnyDesk** или **RDP** | Удалённый доступ к серверу. | anydesk.com |
| **Notepad++** / **VS Code** | Редактирование конфигов. Виндовый блокнот не умеет UTF-8 и переносы строк нормально. | notepad-plus-plus.org |
| **7-Zip** | Распаковка архивов. | 7-zip.org |

---

## Фаза 0. Подготовка до подключения к серверу

### 0.1. Купить домен
Регистратор на выбор:
- **Reg.ru** — российский, оплата в рублях, ~200₽/год за `.ru`
- **Cloudflare Registrar** — самый дешёвый для `.com` (~$10/год), нужна заграничная карта
- **Namecheap** — иностранный, удобный

### 0.2. Поставить AnyDesk
- На своём компе и на сервере
- Попросить друга создать на сервере локального пользователя с правами админа
  (Computer Management → Local Users → New User → Member of Administrators)

### 0.3. У друга в роутере проверить проброс портов
- Порт **443** → IP сервера в локалке (например 192.168.1.100), порт назначения 443
- Порт **80** → тот же IP, порт назначения 80
  *(80 нужен для выпуска сертификата через HTTP-01 challenge)*

### 0.4. Прописать DNS A-записи
В админке регистратора создать **две A-записи**:
- `@`  → статический IP друга
- `www` → статический IP друга

Распространение DNS — **до 24 часов**. Делай в первую очередь, чтобы к моменту настройки IIS домен уже резолвился.

Проверка с любого компа: `nslookup твой_домен` — должен вернуть IP друга.

---

## Фаза 1. Базовая подготовка сервера

Подключился к серверу через AnyDesk. Ставим базовые программы.

### 1.1. Установить через установщики
1. **Chrome** или **Firefox**
2. **7-Zip**
3. **Notepad++**
4. **Git for Windows** — выбрать «Use Git from command line», «Checkout as-is, commit as-is»
5. **Python 3.11** — поставить галку «**Add Python to PATH**» ⚠️ критично
6. **Node.js LTS** (v20.x) — default

### 1.2. Установить uv (через PowerShell от админа)
```powershell
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### 1.3. Установить NSSM
Скачать zip с nssm.cc → распаковать → скопировать `win64\nssm.exe` в `C:\Windows\System32\`.

### 1.4. Создать структуру папок
```
C:\slw\
  ├── app\          ← репа бэкенда + фронта
  ├── frontend\     ← собранный dist (что отдаёт IIS)
  ├── pgdata\       ← данные PostgreSQL (пока пустая)
  ├── logs\         ← логи бэкенда
  └── winacme\      ← бинарник win-acme
```

### 1.5. Windows Firewall — открыть 80 и 443
```powershell
New-NetFirewallRule -DisplayName "HTTP-In"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName "HTTPS-In" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

---

## Фаза 2. PostgreSQL + миграция данных

### 2.1. Установить PostgreSQL 16
Качаем с postgresql.org → запускаем установщик:
- Папка установки: `C:\Program Files\PostgreSQL\16\`
- **Папка данных: `C:\slw\pgdata\`** — это важно для удобства бэкапов
- Пароль суперюзера `postgres`: **сохранить в надёжное место**, потеря = переустановка
- Порт: 5432 (default)
- Locale: default

### 2.2. Создать базу и пользователя для приложения
```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres
```
В psql:
```sql
CREATE USER slw_app WITH PASSWORD 'длинный_пароль_сохрани_отдельно';
CREATE DATABASE slw OWNER slw_app;
\q
```

### 2.3. Снять дамп с Railway (делается на своём ноуте)
В Railway → Postgres-сервис → Connect → копируем `DATABASE_URL` вида
`postgresql://user:pass@host:port/dbname`.

```bash
pg_dump --no-owner --no-acl --no-privileges "postgresql://...railway..." > slw_dump.sql
```

### 2.4. Передать дамп на сервер
Через AnyDesk file transfer → положить в `C:\slw\slw_dump.sql`.

### 2.5. Залить дамп в новую БД
```powershell
$env:PGPASSWORD="пароль_slw_app"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U slw_app -d slw -h localhost -f C:\slw\slw_dump.sql
```

### 2.6. Проверить
```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U slw_app -d slw -h localhost
```
```sql
\dt                    -- список таблиц
SELECT count(*) FROM web_users;
\q
```

---

## Фаза 3. Бэкенд (FastAPI + Telegram-бот)

### 3.1. Склонировать репу
```powershell
cd C:\slw
git clone https://github.com/<твой_логин>/<имя_репы>.git app
cd app\backend
```

### 3.2. Поставить зависимости
```powershell
uv sync
```
*(если репа на pip — `python -m venv .venv; .venv\Scripts\activate; pip install -e .`)*

### 3.3. Создать `.env`
Файл `C:\slw\app\backend\.env`:
```ini
DATABASE_URL=postgresql+asyncpg://slw_app:пароль@localhost:5432/slw
JWT_SECRET=сгенерируй_новый_длинный_рандом_сюда
OPENROUTER_API_KEY=скопируй_с_Railway
LLM_PROVIDER=openrouter
LLM_MODEL=meta-llama/llama-3.1-8b-instruct:free
TELEGRAM_TOKEN=скопируй_с_Railway
APP_URL=https://твой_домен
```

⚠️ **JWT_SECRET — сгенерировать новый**, не тот же, что на Railway:
```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 3.4. Запустить руками для проверки
```powershell
cd C:\slw\app\backend
uv run uvicorn app.web.main:app --host 127.0.0.1 --port 8000
```
В другом окне:
```powershell
curl http://127.0.0.1:8000/api/health
```
Если ответил — `Ctrl+C` в первом окне, идём дальше.

### 3.5. Завернуть в Windows-сервис через NSSM
```powershell
nssm install slw-backend
```
В открывшемся окне:
- **Path**: `C:\Users\<твой_юзер>\.local\bin\uv.exe`
- **Startup directory**: `C:\slw\app\backend`
- **Arguments**: `run uvicorn app.web.main:app --host 127.0.0.1 --port 8000`

Вкладка **Details**:
- Display name: `SLW Backend`
- Startup type: `Automatic`

Вкладка **I/O**:
- stdout: `C:\slw\logs\backend.log`
- stderr: `C:\slw\logs\backend.err.log`

Вкладка **Exit actions**:
- Restart: Automatic (на случай падения)

Нажать **Install service**.

### 3.6. Запустить и проверить
```powershell
nssm start slw-backend
netstat -ano | findstr :8000          # должна быть строка LISTENING
curl http://127.0.0.1:8000/api/health  # должен вернуть JSON
```

Логи смотреть в `C:\slw\logs\backend.log`. Если что-то не запустилось — там будет причина.

---

## Фаза 4. Фронтенд (сборка React)

На своём ноуте, в `slw-main/slw-main/`:

### 4.1. Указать новый API URL
Создать/отредактировать `.env.production`:
```
VITE_API_URL=https://твой_домен/api
```

### 4.2. Собрать
```bash
npm install      # если ещё не делал
npm run build
```
Появится папка `dist/` с готовыми файлами.

### 4.3. Залить на сервер
Через AnyDesk file transfer (или скопировать в OneDrive/Я.Диск и забрать на сервере) → содержимое `dist/` положить в `C:\slw\frontend\`.

Внутри должны лежать `index.html`, `assets/...`, картинки и т.п.

---

## Фаза 5. Публикация через IIS

⚠️ **Этим разделом занимается друг** — он знаком с IIS. Чек-лист для него в конце документа.

### 5.1. Установить IIS-роль и нужные модули

Через Server Manager → Add roles and features → **Web Server (IIS)**. В фичах роли убедиться, что включены:
- Common HTTP Features (все подпункты)
- Static Content
- HTTP Redirection

Дальше — три отдельных установщика (без них ничего не работает):

1. **URL Rewrite Module 2.1** — https://www.iis.net/downloads/microsoft/url-rewrite
2. **Application Request Routing 3.0 (ARR)** — https://www.iis.net/downloads/microsoft/application-request-routing
   *Это то, что даёт IIS способность работать как реверс-прокси.*
3. **win-acme (wacs)** — https://www.win-acme.com
   *Бесплатные сертификаты Let's Encrypt + автообновление. Распаковать в `C:\slw\winacme\`.*

### 5.2. Включить ARR как прокси на уровне сервера

⚠️ **Главный подводный камень**. Без этого реверс-прокси даёт 404.

В IIS Manager:
1. Кликнуть на **корневой узел сервера** (самый верх дерева слева, не на сайт)
2. В центре открыть **Application Request Routing Cache**
3. Справа в Actions → **Server Proxy Settings...**
4. Поставить галку **Enable proxy** → Apply

### 5.3. Создать сайт

IIS Manager → Sites → правой кнопкой → Add Website:
- Site name: `slw`
- Physical path: `C:\slw\frontend`
- Binding:
  - Type: **http**
  - Port: **80**
  - Host name: `твой_домен`
- OK

Добавить второй биндинг на `www.твой_домен`: правой кнопкой на сайте `slw` → Edit Bindings → Add → Type http, Port 80, Host name = `www.твой_домен`.

«Default Web Site» — остановить (правой кнопкой → Stop), чтобы не мешалась.

Дать Application Pool сайта `slw` права на чтение `C:\slw\frontend\` (обычно IIS делает сам; если ловишь 401/403 — добавь чтение для пользователя `IIS_IUSRS`).

### 5.4. Положить web.config

В `C:\slw\frontend\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>

        <!-- 0) HTTP → HTTPS редирект (включить после получения сертификата в 5.6) -->
        <rule name="HTTPS Redirect" stopProcessing="true">
          <match url=".*" />
          <conditions>
            <add input="{HTTPS}" pattern="off" />
          </conditions>
          <action type="Redirect" url="https://{HTTP_HOST}/{R:0}" redirectType="Permanent" />
        </rule>

        <!-- 1) /api/* проксируется на FastAPI на localhost:8000 -->
        <rule name="API ReverseProxy" stopProcessing="true">
          <match url="^api/(.*)" />
          <action type="Rewrite" url="http://127.0.0.1:8000/api/{R:1}" />
          <serverVariables>
            <set name="HTTP_X_FORWARDED_PROTO" value="https" />
            <set name="HTTP_X_FORWARDED_HOST"  value="{HTTP_HOST}" />
          </serverVariables>
        </rule>

        <!-- 2) SPA fallback: если файла/папки нет — отдаём index.html
             (нужно для React Router, чтобы /dashboard работал при прямом заходе) -->
        <rule name="SPA Fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile"      negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/api/" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>

      </rules>

      <!-- Разрешаем set serverVariables (по умолчанию IIS их запрещает) -->
      <allowedServerVariables>
        <add name="HTTP_X_FORWARDED_PROTO" />
        <add name="HTTP_X_FORWARDED_HOST" />
      </allowedServerVariables>
    </rewrite>

    <!-- ARR-прокси (требует Enable Proxy в шаге 5.2) -->
    <proxy enabled="true" preserveHostHeader="true" reverseRewriteHostInResponseHeaders="false" />
  </system.webServer>
</configuration>
```

⚠️ Правило **HTTPS Redirect** временно **закомментировать** для первого теста по HTTP. Раскомментировать после шага 5.6.

### 5.5. Проверка по HTTP

Открыть `http://твой_домен` в браузере → должен показать фронтенд (без HTTPS, замочек серый — нормально).

Открыть `http://твой_домен/api/health` → должен вернуть JSON от FastAPI. Если ответил — реверс-прокси работает.

**Если 404 на `/api/health`** — забыт шаг 5.2 (включить Server Proxy в ARR).

### 5.6. Получить HTTPS-сертификат через win-acme

PowerShell от админа:
```powershell
cd C:\slw\winacme
.\wacs.exe
```

В интерактивном меню:
1. `N` — Create certificate (default settings)
2. Выбрать сайт `slw`
3. Подтвердить hostnames (оба: `твой_домен` и `www.твой_домен`)
4. Email для уведомлений Let's Encrypt
5. Согласиться с ToS
6. Storage: default (CertificateStore)
7. Installation: default (IIS)

win-acme:
- сходит к Let's Encrypt
- получит сертификат через HTTP-01 challenge (порт 80 как раз для этого)
- автоматически добавит **HTTPS-биндинг на 443** в твоём IIS-сайте
- создаст **Scheduled Task на автообновление** (раз в ~60 дней)

Проверь: открой `https://твой_домен` — должен быть **зелёный замочек**.

### 5.7. Включить HTTP → HTTPS редирект

Раскомментировать правило **HTTPS Redirect** в `web.config` (если комментировал в 5.4). IIS подхватит изменение автоматически.

Проверь: `http://твой_домен` → должен редиректить на `https://...`.

---

## Фаза 6. Telegram-бот

### Если бот в polling-режиме (default в нашем коде)
Ничего настраивать не надо — поднимется вместе с бэкендом (внутри сервиса `slw-backend`).

### Если в webhook-режиме
Обновить URL вебхука:
```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_TOKEN>/setWebhook" \
     -d "url=https://твой_домен/api/telegram/webhook"
```

Проверить, что вебхук установился:
```bash
curl "https://api.telegram.org/bot<TELEGRAM_TOKEN>/getWebhookInfo"
```

---

## Фаза 7. Smoke-тест

Пройти по этому списку после переезда:

- [ ] `https://твой_домен` открывается, замочек зелёный
- [ ] `http://твой_домен` редиректит на HTTPS
- [ ] Логин по email/паролю работает
- [ ] Telegram-логин работает (если используется)
- [ ] Дашборд показывает данные пользователя из БД (старые оценки/прогресс на месте после миграции)
- [ ] Прохождение шага в Journey пишется в БД и стрик прибавляется
- [ ] Аспекты — открываются, можно поставить оценку
- [ ] Дневник — можно добавить запись
- [ ] Telegram-бот отвечает на `/start`
- [ ] ИИ-коуч отдаёт ответ
- [ ] Лидерборд показывает пользователей
- [ ] Профиль другого юзера — открывается

Если что-то не работает — смотри логи:
- `C:\slw\logs\backend.log` — Python-бэкенд
- `C:\slw\logs\backend.err.log` — ошибки бэкенда
- IIS логи — `C:\inetpub\logs\LogFiles\W3SVC*\` или Event Viewer → Application

---

## Фаза 8. Что НЕ выключать сразу

⚠️ **Railway оставить включённым на 2 недели.**

Если что-то пойдёт не так на новом серваке — переключишь DNS обратно на Railway за 5 минут, и сайт продолжит работать. Это страховка.

Через 2 недели стабильной работы — можно гасить Railway-проект.

---

## TODO на ближайшие недели после переезда

| Задача | Зачем | Срочность |
|---|---|---|
| **Бэкапы PostgreSQL** | Сейчас сервер сгорит → теряешь всю базу. Минимум: ежедневный `pg_dump` в OneDrive/Я.Диск через Task Scheduler. | первая неделя |
| **Мониторинг uptime** | UptimeRobot (бесплатно): пингует домен каждые 5 минут, шлёт письмо если упал. | первая неделя |
| **Logrotate для backend.log** | Файл будет расти бесконечно, через год съест диск. Настроить ротацию через скрипт + Task Scheduler, или logrotate-аналог. | первый месяц |
| **Auto-deploy при пуше** | Сейчас обновление = руками `git pull` + `nssm restart slw-backend`. Можно прикрутить GitHub webhook + скрипт. Не критично. | необязательно |

### Простой скрипт бэкапа БД (положить в `C:\slw\backup.ps1`)

```powershell
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$backupDir = "C:\Users\<твой_юзер>\OneDrive\slw-backups"
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$env:PGPASSWORD = "пароль_slw_app"
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" `
    -U slw_app -h localhost -d slw `
    --no-owner --no-acl `
    -f "$backupDir\slw_$timestamp.sql"

# Удалить дампы старше 30 дней
Get-ChildItem $backupDir -Filter "slw_*.sql" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } |
    Remove-Item
```

Зарегистрировать в Task Scheduler на ежедневный запуск в 04:00.

### Простой скрипт обновления после `git push`

`C:\slw\update.ps1`:
```powershell
cd C:\slw\app
git pull
cd backend
uv sync
nssm restart slw-backend
Write-Host "Updated and restarted at $(Get-Date)"
```

Запускать руками через RDP/AnyDesk после каждого пуша в main.

Фронтенд — собираешь локально (`npm run build`) и копируешь dist/ в `C:\slw\frontend\`. IIS подхватит без рестарта.

---

## Чек-лист для друга (IIS-часть)

Это то, что лучше делать другу, который знаком с IIS. Остальное (БД, Python-бэкенд, фронтенд-сборка) — на стороне Сергея.

1. ✅ Установить роль **Web Server (IIS)** через Server Manager
2. ✅ Скачать и установить **URL Rewrite Module 2.1** — https://www.iis.net/downloads/microsoft/url-rewrite
3. ✅ Скачать и установить **Application Request Routing 3.0 (ARR)** — https://www.iis.net/downloads/microsoft/application-request-routing
4. ✅ Скачать **win-acme** (wacs) — https://www.win-acme.com — распаковать в `C:\slw\winacme\`
5. ✅ В IIS Manager: на корневом узле сервера → Application Request Routing Cache → Server Proxy Settings → **Enable proxy** ☑️
6. ✅ Создать сайт `slw`:
   - Physical path: `C:\slw\frontend`
   - Binding: HTTP, порт 80, host = `твой_домен`
   - Добавить второй биндинг на `www.твой_домен`
7. ✅ Остановить **Default Web Site**
8. ✅ Положить `web.config` в `C:\slw\frontend\` (текст из раздела 5.4)
9. ✅ Проверить: `http://твой_домен` показывает фронт, `http://твой_домен/api/health` возвращает JSON
10. ✅ Запустить `C:\slw\winacme\wacs.exe`, получить сертификат на оба hostname
11. ✅ Раскомментировать правило **HTTPS Redirect** в `web.config`
12. ✅ Проверить: `https://твой_домен` открывается с зелёным замочком, `http://...` редиректит

---

## Полезные команды для повседневной работы

### Управление сервисами
```powershell
nssm restart slw-backend    # перезапустить бэкенд
nssm stop slw-backend       # остановить
nssm start slw-backend      # запустить
nssm status slw-backend     # узнать состояние

# IIS целиком
iisreset
```

### Логи в реальном времени
```powershell
Get-Content -Path C:\slw\logs\backend.log -Tail 50 -Wait
```

### Проверить, кто слушает порт
```powershell
netstat -ano | findstr :8000
netstat -ano | findstr :443
```

### Зайти в БД
```powershell
$env:PGPASSWORD="пароль"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U slw_app -d slw -h localhost
```

### Снять бэкап вручную
```powershell
$env:PGPASSWORD="пароль"
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U slw_app -h localhost -d slw --no-owner --no-acl -f C:\slw\manual_backup_$(Get-Date -Format yyyyMMdd).sql
```

---

## Что считать «успешным переездом»

1. Все 11 пунктов из Smoke-теста (Фаза 7) — ✅
2. После ребута сервера (тестовый перезапуск через `Restart-Computer` ночью) сайт сам поднимается без ручных действий — ✅
3. Через сутки сертификат всё ещё валиден, замочек зелёный — ✅
4. Бэкап БД создаётся по расписанию — ✅

После этого можно гасить Railway.
