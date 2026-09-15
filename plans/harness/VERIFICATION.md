# Проверки и критерии

## Текущий снимок

| Gate | Состояние | Основание |
|---|---|---|
| GIT-REMOTE | PASS | Fetch/ls-remote, main и slw-instruct сверены с GitHub |
| GIT-BASE | PASS | codex/lite-local создана от c7f2b3c; tracked diff пуст |
| TS-BASE | PASS | npm.cmd run typecheck, exit 0, в созданной ветке |
| HARNESS | PASS (P7) | RUN-021: verify.ps1 -Mode Docs; scope и hashes защищённых файлов проверены |
| LITE-UNIT | PASS (P7) | RUN-021: root 32/32 |
| LITE-BUILD | PASS (P7) | RUN-021: production-lite и online build по 318 modules; outputDir разделены |
| LITE-NETWORK | PASS (P7) | RUN-021: 30/30 default, 30/30 с backend.invalid, 30/30 development React; 0 API/SDK/backend WebSocket attempts |
| LITE-BROWSER | PASS (P7) | RUN-021: полная матрица 30/30; отдельный preview 4173 HTTP 200 и navigation smoke 4/4 |
| LITE-GRAPH | PASS (P7) | RUN-021: production entry импортирует только LiteApp; online/Telegram отсутствуют в исполняемой цепочке lite |

## Команды

Сейчас: из Git-root `& ./plans/harness/verify.ps1 -Mode Preparation -Typecheck`. После начала правок продукта: Mode Docs.

Из slw-main/slw-main доступны typecheck, test:lite:unit, build, test:lite:list, test:lite:e2e. Итоговая матрица P7 выполнена в RUN-021.

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

Матрица выполнена в RUN-021. Открытый остаток ERR-015 относится к общей flat-схеме state.skills[rawId]: две пары одинаковых raw ID разделяют прогресс; доступ к правильным материалам и анкетам в lite проверен, миграция схемы в P1–P7 не входила.
