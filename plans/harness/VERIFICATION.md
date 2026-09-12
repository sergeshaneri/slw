# Проверки и критерии

## Текущий снимок

| Gate | Состояние | Основание |
|---|---|---|
| GIT-REMOTE | PASS | Fetch/ls-remote, main и slw-instruct сверены с GitHub |
| GIT-BASE | PASS | codex/lite-local создана от c7f2b3c; tracked diff пуст |
| TS-BASE | PASS | npm.cmd run typecheck, exit 0, в созданной ветке |
| HARNESS | PASS | RUN-006: verify.ps1 -Mode Docs, exit 0; baseline Preparation/Typecheck также PASS |
| LITE-UNIT | PASS (P1 state) | RUN-011: 25/25 state/runtime/storage; content ещё не реализован |
| LITE-BUILD | NOT_RUN | Реализация ещё не начата |
| LITE-NETWORK | PASS (P2 startup) | RUN-008: 2/2 default + 2/2 backend.invalid; игровой цикл ещё NOT_RUN |
| LITE-BROWSER | PASS (P2 startup) | RUN-008; полная матрица P7 ещё NOT_RUN |

## Команды

Сейчас: из Git-root `& ./plans/harness/verify.ps1 -Mode Preparation -Typecheck`. После начала правок продукта: Mode Docs.

В будущем из slw-main/slw-main: typecheck, test:lite:unit, build, test:lite:list, test:lite:e2e. Последние тестовые scripts добавляются P1, сейчас их не запускать как существующие.

## Обязательная матрица P7

- Чистый storage, нет аккаунта: немедленно доступны каталог, дневник, путешествие.
- Старые slw_token/dev_admin/whl_* и URL token/reset/referral: нет auth/админки/API; старые ключи неизменны.
- Fake TMA initData/platform: локальный старт и back без backend bootstrap.
- Все восемь аспектов и существующие уровни/классы контента при нуле прогресса.
- Чтение не меняет XP/оценки/ответы/пройденные шаги.
- Реальный ответ/анкета/дневник/задание переживают reload; double-click/StrictMode не дублируют результат.
- Каталог не сбрасывает анкету; импорт при смонтированном JourneyView заменяет сессию один раз.
- Quota/SecurityError/битый snapshot/невалидный импорт: нет молчаливой потери/частичной замены.
- Export не содержит account-data; reset затрагивает только lite-ключи.
- Внешняя смена storage revision вызывает конфликт, а не известное молчаливое перетирание.
- Все server-заглушки доступны с возвратом, без polling/списания/ложного успеха.
- Network interception установлен до goto. Любая попытка API — FAIL, даже если route.abort сработал.
- Desktop/mobile, keyboard/back; preview под /slw/, реальный listener и корректные assets.
- Lite build с непустым VITE_API_URL остаётся без API; online build/typecheck отдельно, без подключения live backend.

PASS каждого gate должен иметь RUN-ID и результат команды. Невозможность запустить test/runtime даёт NOT_RUN/BLOCKED, не PASS.
