# 002. Реструктуризация для локальной временной версии

Статус: TODO реализации; подготовка P0 завершена. Дата: 2026-09-11. База: c7f2b3cd354cc6c92bb3b470a1164f0ddc6cb87f. Ветка codex/lite-local уже создана. Приоритет P1; объём M–L; риск средний.

Этот документ заменяет техническую последовательность и область изменений плана 001. Матрица пользовательского поведения и границы контента из 001 сохраняются. Не выполнять повторно создание ветки. При расхождении архитектурных указаний руководствоваться 002 и решениями harness/DECISIONS.md.

## 1. Установленная Git-база

После git fetch origin --no-tags и git ls-remote:
- origin/main = 267eb5226bcdd842dc9d35d6caea5aec5dec35bd, дата 2026-03-03.
- slw-instruct и origin/slw-instruct = c7f2b3cd354cc6c92bb3b470a1164f0ddc6cb87f, дата 2026-05-19.
- origin/gh-pages = 03c6193a71cc8baaa717e1c481620e94a5b23798; remote HEAD указывает на gh-pages.
- git rev-parse --is-shallow-repository = false.
- git merge-base origin/main slw-instruct: exit 1, общего предка нет.
- У main корень c943d362ad48fb4ce8bee294e5b47f997ea77b79, у slw-instruct — 3af9d4c220ff025cfd466f5ffda1dafe93da91be.
- rev-list --left-right --count origin/main...slw-instruct = 6 / 259. Это размеры независимых историй, не «main отстаёт на 259».
- main содержит прежний JS-проект в корне; нынешняя версия содержит TypeScript-фронтенд во вложенной папке, бэкенд и исследовательские материалы.
- Сравнение деревьев показывает 1371 изменённый файл, но это включает перенос структуры и материалы; это не оценка количества дефектов.
- gh-pages содержит сборку. Совпадение времени коммитов не доказывает происхождение каждого артефакта; действующий сайт в браузере не сравнивался.

Ветка создана от нынешней slw-instruct, исходная ветка сохранена. main не обновлять, истории не объединять через allow-unrelated-histories. Возможная нормализация main/default branch — отдельная задача после проверки deployment-настроек.

## 2. Причины выделения границ

Все пути далее относительно фронтенда slw-main/slw-main:
- App.tsx: 1330 строк, одновременно auth, API sync, guest storage, награды и маршрутизация. При импорте выполняется captureReferralFromURL (строка 173).
- JourneyView.tsx: 2248 строк; хранит defaults/migration и интерактивное состояние. Первоначальная инициализация через migrateState(extJourney) выполняется при mount (строка 470), наружное сохранение — через effect (строки 478–489). Простая замена props после импорта файла сама по себе не гарантирует обновление внутреннего состояния.
- main.tsx: статически импортирует App и запускает bootstrapTMA; user=false в useAuth не предотвращает ранние эффекты.
- api/client.ts: request с fetch и отдельный fetch в downloadVaultZip; tma/index.ts содержит третий прямой fetch.
- JourneyView вызывает postStepCompleted и chooseHabit; shared-компоненты Hint, DiaryView и другие импортируют API.
- Доступ к чтению распределён между AspectsView, восемью skill trees, SkillDetail/SkillTraits, SurveyInsight и App.
- App импортирует DEFAULT_JOURNEY из UI-компонента. Локальное хранилище не должно зависеть от UI и его сетевых импортов.

Цель реструктуризации — отделить эти обязанности только в объёме lite. Полная декомпозиция движка JourneyView, унификация восьми деревьев, переезд репозитория и переписывание online-интерфейса откладываются.

## 3. Целевая структура

```text
src/
  main.tsx                         # выбор runtime до импорта оболочки
  App.tsx                          # существующая online-оболочка
  bootstrap/
    online.tsx                     # прежние mount/TMA/storage bridge для online
  config/
    runtime.ts                     # единое build-time правило режима
  domain/journey/
    state.ts                       # defaults, normalizers, migrateState, aspectOf/updateAspect
  utils/
    contentAccess.ts               # доступ к чтению; без начисления прогресса
    liteStorage.ts                 # один атомарно записываемый snapshot
    liteTransfer.ts                # экспорт, полная валидация импорта
  lite/
    LiteApp.tsx                    # локальная оболочка и маршруты
    useLiteSession.ts              # загрузка, durable/volatile status, replace/reset
    contentCatalog.ts             # производный каталог существующего контента
    LiteHome.tsx
    LiteHeader.tsx
    CatalogView.tsx
    MaterialView.tsx
    LiteSettings.tsx
    UnavailableFeature.tsx
    *.module.css
  components/                      # существующие UI, выборочные изменения
  data/                            # прежний единственный источник материалов
tests/lite/
  state.test.ts
  storage.test.ts
  content.test.ts
  network.spec.ts
  journey.spec.ts
  navigation.spec.ts
```

Dependencies: main → runtime → выбранная оболочка. LiteApp → session/contentAccess/shared UI. Session → storage/transfer → domain types/state. Domain не импортирует React, browser storage, API или UI. Shared UI получает конкретные props/callbacks; серверная запись допускается только при backendEnabled. Не вводить общий service locator или mock API.

По умолчанию обычные dev/build/preview этой временной ветки используют lite. Online запускается только явным отдельным режимом. runtime не может включить сервер по query/localStorage/наличию токена/ответу healthcheck. Не удалять защиту в api/client даже при раздельных оболочках: shared UI всё ещё может импортировать API.

## 4. Контракты

### Сохранение

Вместо четырёх новых lite-ключей из 001 использовать один slw_lite_v1_state:
```ts
type LiteSnapshot = {
  format: 'slw-lite'
  schemaVersion: 1
  revision: number
  updatedAt: string
  data: {
    journey: JourneyState
    scores: AspectScores
    diary: DiaryEntry[]
    history: unknown[]
    preferences: { sendKeyMode?: string; hintsSeen?: Record<string, boolean> }
  }
}
```
Точный sendKeyMode взять из useSendKeyMode, не ослаблять тип до произвольной строки в реализации. Пример обозначает границы payload. updatedAt относится к локальным данным, не server-version.

Одна JSON-сериализация и один setItem обеспечивают замену snapshot без частично записанных разделов. При ошибке quota/security прежняя запись остаётся, текущие действия остаются в React memory, статус volatile виден; экспорт памяти доступен. Никаких обещаний транзакции между несколькими localStorage-ключами. Чтение повреждённой записи не перезаписывает её автоматически: предложить скачать сырой локальный файл/сбросить с подтверждением, пока работать в volatile-сессии.

Импорт валидирует format/version, ключи аспектов, формы массивов/объектов, допустимые поля и типы, затем подтверждает полную замену. Не переносить токены/неизвестные executable данные/произвольные поля из импортированного файла. Не обращаться к URL из файла. Импорт поддерживает только документированный lite-формат. Сначала persist, затем заменить активную сессию; при неуспешной durable-записи сообщить отказ импорта и сохранить прежнюю активную сессию. До подтверждения доступны прежний экспорт и сводка нового файла.

Старые whl_*, slw_token, slw_dev_admin сохраняются нетронутыми. Lite не загружает их и не отправляет. Хранилище UI-предпочтений из shared hooks тоже переводится на lite-snapshot или отдельные строго перечисленные lite-ключи, без записи online-ключей.

revision/storage event служат обнаружению конфликтов вкладок. Перед записью сверить ревизию и блокировать молчаливое перетирание известного внешнего изменения. localStorage не предоставляет compare-and-swap: полностью одновременную запись это не исключает. Не заявлять гарантированную многовкладочную транзакционность; при необходимости строгой блокировки выделить отдельную задачу Web Locks/IndexedDB. Для первой версии — одна редактирующая вкладка и ясный конфликт при обнаруженном изменении.

### Источник состояния путешествия

Сохранить внутреннее состояние JourneyView при обычном игровом действии. useLiteSession получает onJourneyChange и сохраняет snapshot. Импорт/сброс после подтверждения создаёт новый sessionEpoch и remount JourneyView через key; epoch не меняется при каждом автосохранении. Каталог не использует это состояние как навигационный курсор. Уход из незавершённого ввода требует сохранить draft либо предупредить; готовые данные анкеты не теряются.

### Доступ к материалам

Правило fullContentAccess открывает существующий уровень чтения; значения currentLevel, passes, completedScripts, оценки, XP не переписываются. getUnlockedSkillLevel остаётся прежней online-функцией, для UI вводится явная политика. Открытый материал и пройденный материал — разные состояния.

Идентификатор шага каталога: aspect + level + kind + scriptId, поскольку T-1 может повторяться между уровнями. Каталог учитывает intro/core/surveys/complete; core/scripts — алиасы, не два набора. Skill levels имеют собственные составные ключи. Сохранять ссылки на исходные объекты, не копировать тексты. MarkdownLite/ScriptCard переиспользовать только без игровых side effects; интерактивный чат остаётся отдельным сценарием. Анкеты доступны для реальных ответов через существующий опросный UI.

### Серверные возможности

API-защита бросает BackendUnavailableError до чтения токена и fetch. Это страховка от ошибки разработчика; штатный UI не вызывает API. Не подменять все ответы на успешные пустые объекты. Запросы событий, Telegram auth, ZIP export закрыты отдельно. Lite не импортирует App, online-bootstrap и auth-модули в цепочке запуска. Shared TMA hooks в lite не скрывают обычную навигацию даже при window.Telegram; SDK в lite не загружается.

Матрица функций из 001 сохраняется: локальные путешествие/анкеты/дневник/задания; заглушки коуча, сообщества, серверных вкладок, уведомлений и административных действий. В каталоге можно сохранять личные заметки, без server-публикации.

## 5. Этапы исполнения

P0 уже DONE. Остальные этапы не начаты. Их machine-readable состояние — harness/tasks.json. Варианты кода ниже — спецификация, а не уже выполненные изменения.

### P0. База и harness — DONE

Fetch, проверка независимых историй, создание codex/lite-local, повторный typecheck. Проверяемый результат: HEAD c7f2b3c, исходники идентичны slw-instruct, подготовленные документы и harness. Коммиты/push не выполнялись.

### P1. Характеризационные тесты и выделение чистого состояния

Добавить Vitest и Playwright как dev dependencies с lockfile, команды test:lite:unit, test:lite:e2e, test:lite:list. CI пока не добавлять. Сначала тестировать наблюдаемое сохранение с fixtures текущего journey, включая legacy Cyrillic/che- ID, разные contentVersion, activeSurvey, pendingTasks. Тесты должны давать ожидаемый результат по действующему коду до его переноса; миграцию можно временно export из JourneyView.

Перенести defaults, aspectOf/updateAspect, migrateState и его чистые зависимости в domain/journey/state.ts. UI импортирует их; если существуют другие импортеры старых экспортов — временно оставить re-export для совместимости. Не менять алгоритмы в том же шаге. Не переносить calcStreak/awardXP/обработчики чата на этом этапе.

Проверка: npm.cmd run typecheck; npm.cmd run test:lite:unit -- state → exit 0. Fixtures сохраняют навыки, историю, задания и реальные показатели. Domain не импортирует api/components/React/localStorage.

### P2. Раздельный запуск и запрет серверного транспорта

main читает runtime до динамического импорта LiteApp или bootstrap/online. Старое поведение mount/storage bridge/TMA перенести в online-bootstrap без функциональных изменений. App оставить online-оболочкой. Базовый LiteApp сначала рендерит локальный каркас. Не копировать весь App.

Защитить request, downloadVaultZip, bootstrapTMA, useAuth. В общей цепочке TMA/Hint/путешествия mode явно выключает серверные эффекты. Удалить Telegram script из lite-entry либо загружать только через online-bootstrap. VITE_API_URL не определяет режим.

Проверка: typecheck; unit runtime; первый network e2e с чистым storage, фиктивным токеном, auth URL и fake window.Telegram. Ни одного API request; нет реферальной записи. Повторить с VITE_API_URL на тестовом API origin.

### P3. Snapshot, импорт/экспорт и локальная сессия

Реализовать storage/transfer/useLiteSession по контрактам раздела 4. Load/save через один snapshot. Подключить ошибки хранилища к видимому статусу и экспорту памяти. Подтвердить поведение импорта/сброса/повреждённой записи. Экспорт исключает account keys.

Проверка: unit storage — success/quota/security/invalid JSON/unknown schema/невалидные поля; e2e reload/import/reset; имитация известной смены revision другой вкладкой. Старые account/guest keys byte-for-byte совпадают до/после. При ошибке импорта память и durable-состояние прежние.

### P4. Работающий локальный игровой цикл

Подключить JourneyView, AspectsView и DiaryView к LiteApp. Критические props backendEnabled/fullContentAccess либо небольшой явно типизированный capability-object; единая политика без дублирования условий.

awardXP начисляет уже существующий локальный XP и сохраняет прогресс; postStepCompleted выключен. chooseHabit заменяется локальным pendingTask, текст не обещает dashboard привычек. Инсайты и дневник сохраняются callback-ами. useSendKeyMode/Hint не пишут старые ключи. Импорт меняет sessionEpoch; обычное автосохранение — нет. Online-код проверять typecheck и mock-характеризационными тестами, не реальным backend.

Проверка: пройти шаг, дать ответ, записать инсайт, взять/завершить задание, открыть анкету, reload, сменить аспект, вернуться. Нет дубликата XP/записи от double-click или StrictMode. Проверить импорт в момент смонтированного JourneyView и незавершённый ввод при навигации.

### P5. Свободное чтение и каталог

contentAccess применяется к обоим уровням AspectsView, sidebar/teasers/колёсам, всем skill trees, деталям/чертам, SurveyInsight и переходам JourneyView. Не выполнять старые App.makeGoToAspectSurveys в lite: LiteApp имеет локальный вход без auth.

Каталог из реестров даёт доступ ко всем существующим материалам при нулевом прогрессе. Инвентаризация: число элементов каждого вида, дубли composite-key, пропуски и фактические пустые материалы. Тесты строят ожидаемый набор непосредственно из исходных реестров, а не вызывают ту же функцию, что создаёт каталог, иначе проверка тавтологична.

Проверка: unit manifest; e2e всех аспектов и существующих уровней, навигация в каждый класс материала, подсчёт доступных ID. Равенство XP/passes/answers/completedScripts до/после чтения. Отдельно проверить доступ к анкете и реальный результат её прохождения.

### P6. Заглушки и локальная оболочка

Реализовать LiteHome/Header/Settings/UnavailableFeature. Главная без регистрации; каталог и путешествие доступны сразу; вводный тур опционален. Все menu/callback/deeplink server-направления попадают в заглушки до mount online-компонентов. Старое неизвестное значение route получает безопасный локальный fallback.

Сохранить полный доступ к локальному HALL_CONTENT, хотя пользовательские холлы недоступны. Нет активных server notification/dm таймеров. Заглушки не списывают валюту, не меняют прогресс. На узком экране доступны back и настройки. Не обещать работу без интернета: статические файлы всё ещё загружаются с хостинга.

Проверка: navigation e2e desktop/mobile, все меню/заглушки, fake TMA, keyboard/back, отсутствие auth-форм и бесконечной загрузки. Ноль API на всех сценариях.

### P7. Приёмка и проверка сборки

Существующий build = tsc --noEmit && vite build. После добавления тестов выполнить:
```powershell
npm.cmd run typecheck
npm.cmd run test:lite:unit
npm.cmd run build
npm.cmd run test:lite:list
npm.cmd run test:lite:e2e
npm.cmd run preview -- --host 127.0.0.1 --port 4173 --strictPort
```
Первые пять: exit 0; список тестов непустой. Preview — отдельный длительный процесс для ручной проверки /slw/, а не завершающаяся проверка. Playwright webServer использует свой свободный порт, strictPort и проверенный PID, завершается после тестов. Если браузер отсутствует — явная установка и запись версии; не использовать фиктивный PASS.

Проверить network attempts до навигации, включая failed requests и отсутствие ожидаемых нормальных ответов: только блокировка server-origin без проверки попыток недостаточна. Запрет охватывает /api на любом origin, заданный backend origin целиком, fetch/XHR/beacon/WebSocket при появлении новых путей. Наблюдать дольше максимального фактически найденного polling/retry, отдельно тестировать unmount timer cleanup; не вводить произвольное «5 секунд достаточно». Источник тестов — фиктивные данные, без личных заметок.

Проверить сборку lite с непустым API URL и online typecheck/build в отдельном outputDir, чтобы не перепутать артефакты. Статический module graph не должен включать online-shell в исполняемую цепочку lite; наличие неиспользуемого online-chunk на диске само по себе не доказывает вызов. Bundle-размер измерить и записать, но не обещать уменьшение до измерения.

Приёмка требует реальных тестов персистентности, независимого каталога и сетевой изоляции. Результаты — harness/RUN_LOG.md и VERIFICATION.md; все незакрытые проблемы — ERRORS.md.

## 6. Разрешённые файлы и порядок переносов

Новые файлы только по целевой структуре, tests/lite, vitest.config.ts/playwright.config.ts и harness. Существующие изменения: main, App (только импорты чистого state), api/client, tma/index/hooks, useAuth/useSendKeyMode, Hint, JourneyView и восемь skill trees, SkillDetail/SkillTraits/SurveyInsight, AspectsView, DiaryView; CSS только для затронутых UI; типы и package/config/README по необходимости.

src/data — read-only, один источник контента. Не выносить frontend из slw-main/slw-main, не переименовывать aspect IDs, не менять backend/OpenAPI/DDL, не переносить nested .github/workflows в корень. В текущей ветке workflow лежит внутри frontend, а root .github отсутствует; его перенос способен активировать публикацию и относится к отдельной задаче.

Каждый перенос проверять до изменения поведения. Один этап — одна понятная единица diff, без параллельной переработки контента и игрового движка. Scope уточнён этим документом относительно 001.

## 7. Готовность, возврат и остановка

Готово, когда все P1–P7 DONE с evidence, 0 API attempts, все существующие материалы достижимы без auth/прогресса, реальные ответы и задания переживают reload, чтение не изменяет оценки, старые ключи нетронуты, импорт/ошибки проверены, server-функции честно недоступны, content/backend не изменены.

Нынешний deploy может перезаписать gh-pages. Не запускать его без отдельного указания. Перед публикацией подтвердить target/base и снять текущий опубликованный SHA/артефакт. Действующий remote HEAD=gh-pages не менять автоматически. Возврат — публикация проверенной исходной online-ветки или сохранённого артефакта; lite-snapshot online-приложение не отправляет. Слияние lite в main не является частью возврата.

При расхождении базы, необходимости server-only материала, неучтённом transport или двух неуспешных попытках исправить одну причину остановить зависимый этап, записать свидетельства и продолжить независимое. Не менять определения DONE ради прохождения. Критические проверки без runtime остаются NOT_RUN.

Оценка исполнения: 7 последовательных проверяемых пакетов; календарный срок без browser baseline не фиксируется. Полный аудит безопасности, семантики материалов и live hosting не выполнен.
