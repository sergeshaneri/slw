# Журнал ошибок и корректирующих действий

Фиксируются наблюдавшиеся ошибки работы над задачей. Возможные дефекты игры из аудита не объявляются воспроизведёнными ошибками. Статусы: OPEN / MITIGATED / RESOLVED / REJECTED. Журнал дополняется, старые записи не удаляются.

## ERR-001 — запуск shell не создаётся в стандартном sandbox

- Дата: 2026-09-11, предыдущий этап аудита.
- Категория: environment. Статус: MITIGATED.
- Наблюдение: exec_command вернул helper_unknown_error: apply deny-read ACLs ещё до выполнения PowerShell.
- Влияние: чтение исходников и инструкции не запускалось.
- Причина: не установлена; сообщение указывает на настройку ACL helper, а не код игры.
- Действие: штатный require_escalated для ограниченных read-only команд.
- Проверка: команды чтения/Git/typecheck затем выполнились. Исходная неисправность sandbox не устранена.
- Профилактика: RULES/Windows; не повторять одинаковый неработающий запуск и не выдавать его за проблему проекта.

## ERR-002 — исходный cwd не является Git-root

- Дата: 2026-09-11, предыдущий аудит.
- Категория: git/process. Статус: RESOLVED.
- Наблюдение: git status из внешнего slw-slw-instruct вернул not a git repository.
- Причина: checkout находится во вложенном slw-slw-instruct.
- Действие: явный workdir настоящего Git-root.
- Проверка: status/log/branch и switch успешно выполнены.
- Профилактика: baseline и verify.ps1 вычисляют root от расположения harness; RULES требует cwd.

## ERR-003 — wildcard в аргументе Windows-пути для rg

- Дата: 2026-09-11, предыдущий аудит.
- Категория: process. Статус: RESOLVED.
- Наблюдение: src/data/journey* и путь *SkillTree.tsx вызвали os error 123.
- Действие: каталог передавать буквально, шаблон — через -g.
- Проверка: rg по JourneyView с -g '*SkillTree.tsx' вернул совпадения.
- Профилактика: конкретный пример добавлен в RULES.

## ERR-004 — запись плана через apply_patch не состоялась

- Дата: 2026-09-11, предыдущий аудит.
- Категория: environment. Статус: MITIGATED.
- Наблюдение: Failed to write file .../plans/001-lite-local.md; последующий Test-Path plans = false.
- Причина: не установлена; не приписывать подтверждённо ACL или кириллице.
- Действие: создать plans и записать literal here-string через разрешённый PowerShell.
- Проверка: файл прочитан, Git показывает только новую plans и прежние untracked.
- Профилактика: после неудачной записи проверять наличие/содержимое; fallback не должен менять исходники.

## ERR-005 — чрезмерный вывод поиска инструментов

- Дата: 2026-09-11, подготовка harness.
- Категория: process. Статус: RESOLVED.
- Наблюдение: широкий фильтр метаданных инструментов дал ненужный большой вывод с усечением.
- Влияние: затраты контекста; результат Git всё же был доступен.
- Действие: дальнейшая работа через уже известный exec_command и узкие запросы.
- Проверка: последующие ответы ограничены конкретными Git-фактами и модулями.
- Профилактика: искать точное имя/capability, не все описания с file/exec.

## Шаблон следующей записи

ERR-NNN — краткий симптом
- Дата, RUN-ID, этап, категория, статус:
- Команда/cwd или сценарий:
- Ожидалось / наблюдалось:
- Воспроизведение:
- Установленная причина / отдельная гипотеза:
- Минимальное исправление:
- Проверка, exit code, свидетельство:
- Изменение процесса (RULE/DEC) и критерий эффективности:
- Остаточный риск / следующий шаг:

## ERR-006 — превышен лимит длины команды Windows

- Дата: 2026-09-11, подготовка harness.
- Категория: environment/process. Статус: RESOLVED.
- Наблюдение: пакет записи всех документов одним exec_command отклонён до старта: os error 206, The filename or extension is too long.
- Причина: общий текст документов передан в одной командной строке Windows.
- Действие: разбить записи на отдельные ограниченные команды; проверить каждый файл и выполнить verify.ps1.
- Проверка: отдельные пакеты записаны с exit 0; RUN-003, verify.ps1 -Mode Preparation -Typecheck завершился exit 0. Лимит Windows сохраняется, превышение устранено разбиением.
- Профилактика: пакетировать независимые чтения, но не собирать большие артефакты в одну Windows-команду.



## ERR-007 — лишние пустые строки в конце новых файлов

- Дата: 2026-09-11, подготовка коммита.
- Категория: process. Статус: RESOLVED.
- Наблюдение: git diff --cached --check вернул exit 2, new blank line at EOF; коммит не запускался.
- Причина: запись here-string через Set-Content добавила завершающие пустые строки.
- Исправление: нормализовать только окончание подготовленных файлов до одного перевода строки.
- Проверка: повторный diff --cached --check обязателен перед коммитом.
- Профилактика: проверять whitespace до git commit, не обходить gate.

## ERR-008 — лимит использования остановил P1

- Дата: 2026-09-11; RUN-005; environment; MITIGATED.
- Наблюдение: автоматическая проверка отклонила команду записи harness с сообщением usage limit; субагент завершился с тем же сообщением до реализации.
- Установлено: команда не была выполнена; после запроса продолжить Git HEAD прежний, tracked-правок нет. Причина исчерпания лимита отдельно не исследовалась.
- Действие: обход отказа не выполнялся. После нового запроса пользователя чтение состояния вновь разрешено, исполнитель возобновлён.
- Проверка: git status/branch/HEAD exit 0; реализация и её проверки ещё не приняты.

## ERR-009 — корректировки первого тестового пакета P1

- RUN-006; implementation/test/environment; RESOLVED в пределах P1.
- По отчёту исполнителя: попытка установки Vitest 5 с Vite 5 получила ERESOLVE; установлен Vitest 2.1.9 и Playwright 1.55.0 с lockfile. npm ls exit 0. Первоначальные ключи fixture не совпадали с SURVEY_BLOCK_KEYS: исправлены на knowledge/practice до переноса; baseline 5/5.
- После переноса typecheck обнаружил ссылки UI на InsightLike: добавлен export/import типа. Оркестратор подтвердил typecheck exit 0, state 5/5 и точное совпадение механического блока.
- npm install сообщил 17 уязвимостей полного дерева по отчёту исполнителя; audit fix не выполнялся, состав и применимость отдельно не проверены.

## ERR-010 — конфигурация тестов допускала ложное прохождение

- RUN-006; process/test; RESOLVED.
- Ревью обнаружило Playwright на ручном порту 4173 без strictPort и с reuseExistingServer. Исправлено: 4174, /slw/, strictPort, reuseExistingServer:false.
- При отсутствии specs исполнитель добавил --pass-with-no-tests. Оркестратор потребовал удалить флаг, поскольку он скрывал отсутствие сценариев. Обе scripts исправлены.
- Независимая проверка npm.cmd run test:lite:list: exit 1, 0 тестов. E2E остаётся NOT_RUN, обязательные P1 state/typecheck проходят. Gate не ослаблен.

## ERR-011 — комментарии миграции расходятся с действующим алгоритмом

- RUN-006; implementation/documentation; OPEN, исходное поведение, не регрессия P1.
- Коллизия кириллического/латинского ключа сохраняет первый перечисленный ключ; комментарий обещает латинский приоритет. Обе последовательности подтверждены state-тестом.
- Комментарий о сбросе при contentVersion mismatch устарел: текущие ветки сохраняют папки; fixture v7 подтверждает сохранение.
- P1 механически сохраняет алгоритм и комментарии. Исправление семантики миграции требует отдельной ограниченной задачи; lite не читает старые online-ключи.

### ERR-007 повтор при P1

RUN-006: git diff --cached --check обнаружил new blank line at EOF в новом domain/journey/state.ts, exit 2. Коммит не запускался. Оркестратор нормализовал только окончание файла до одного перевода строки; алгоритм не изменён. Повтор staged check обязателен.

## ERR-012 — браузерная среда и диагностическая команда P2

- RUN-008; environment/process; RESOLVED для Chromium tests.
- По отчёту исполнителя первый e2e exit 1 до теста: Chromium headless shell отсутствовал. npm.cmd exec playwright install chromium exit 0; установлен Chromium 140.0.7339.16 build 1187, Playwright 1.55.0.
- Ошибочная команда npm.cmd exec playwright install --dry-run не передала флаг и начала дополнительную загрузку Firefox/WebKit. Процесс завершился; cache не удалялся. Для будущей передачи flags использовать прямой node_modules/.bin/playwright.cmd или разделитель npm exec --.
- Прямой chrome --version дал Windows sandbox access errors; версия основана на installer output. Повторные e2e исполнителя и оркестратора 2/2 default + 2/2 backend.invalid, exit 0; listener освобождён.
- Исправление SDK failure fallback найдено ревью до приёмки. Ошибка CRLF-якоря при записи api/client не сохранила файл; повторная узкая правка подтверждена diff.

## ERR-013 — корректировки session/browser P3.2

- RUN-013; implementation/test; RESOLVED в пределах P3.2.
- Ревью выявило falsy-проверку пустого corrupt raw, отсутствие catch validation/serialization, пропуск storage clear event, повтор initial-save в StrictMode и устаревший corrupt marker после принятия external missing. Исправлены локально; соответствующие browser сценарии прошли независимо.
- Первый read-before-save тест записывал внешний revision до завершения React init; наблюдаемый durable соответствовал загрузке уже нового snapshot. Тест теперь ждёт отображения начального режима перед same-tab setItem и реальным click. Проверка конфликта сохранена.
- Serialization failure проверяется явным throw JSON.stringify; название теста уточнено, поскольку payload остаётся валидным. Предыдущие три serial-skipped сценария не считаются failures.
- Итог root: 13/13 browser exit 0. Перед конфликтными действиями синхронизировать тест с наблюдаемым исходным UI; не заменять критерий ослабленной проверкой.

## ERR-014 — узкие текстовые правки P4 в Windows

- RUN-014; 2026-09-13; environment/process; исправление проверяется в P4.
- Исполнитель повторно получил apply_patch deny-read и использовал штатный elevated PowerShell (ERR-001). Запись Hint завершилась exit 0 после задержки около 42 секунд без вывода; дубликат не запускался.
- CRLF-якорь Chat не совпал; команда успела изменить ScriptButtons до остановки. Следующая single-quoted regex replacement вставила буквальный backtick-n в два type Props. После двух попыток стратегия пересмотрена: точные Replace с настоящим newline и немедленный typecheck.
- Root поиск с Windows wildcard в пути получил rg os error 123; повтор с каталогами и -g '*.tsx' exit 0. Действующее правило RULES уже покрывает этот случай, нового запрета не требуется.
- Ревью до приёмки выявило сброс success message через LiteSettings key=epoch, потерю draft других панелей и зависание Promise/processing state после отмены таймера при смене аспекта. Обязательная проверка исправлений остаётся частью P4, DONE пока не выставлен.

### ERR-014: результат приёмки RUN-015

- Исправления подтверждены root: typecheck PASS, unit 27/27, browser 18/18 production и 18/18 development React StrictMode с backend.invalid. Открытого блокера P4 нет.
- Dev Vite запрашивал статический /slw/src/api/client.ts, который audit распознавал по /api/. Перешли на build+preview; audit и критерий 0 API attempts не ослаблялись. Запрос исходника не считается свидетельством реального backend-вызова.
- Тесты уточнены по наблюдаемому UI: точное имя кнопки активных заданий; после import Settings остаётся выбранным, Journey надо открыть; B-2 fixture имеет awaitingInput=number, соответствующий штатному mounted state. Seed выполняется только при missing snapshot. Реальные задержки concurrency заменены pause/runFor с проверкой отсутствия completion до управляющего действия.
- Root отклонил force-click обход pointer interception. Причина воспроизведена: desktop visualViewport существует, но blur не вызывает resize; inputFocused оставлял topbarHidden с pointer-events:none. Chat blur теперь вычисляет реальное состояние viewport. Обычный browser click прошёл.
- После доступного click выявлена отдельная причина отсутствующего первого Ti intro: значения присваивались внутри deferred setState updater и читались сразу после setState. Вычисление перенесено перед updater. Проверка первого intro, отмены старого ответа и возврата Si прошла.
- Существующие ERR-001/Windows quoting правила достаточны. Профилактика P4 закреплена browser-тестами: не обходить недоступный UI force-click; синхронизировать pending callbacks управляемыми часами; проверять видимый результат первого перехода, а не только currentAspect.

## ERR-015 — коллизии legacy skill lookup, обнаруженные при P5

- RUN-016; implementation/content; проверяется в P5.
- Независимый root runtime audit подтвердил два совпадающих raw ID между аспектами. getSkillContent('manipulation-detection') возвращает Ni-материал вместо Ti; getSkillContent('completion') возвращает Te-материал вместо Se. Комментарий старого lookup о непересекающихся IDs не соответствует фактическим реестрам.
- Scope P5: catalog composite ID + source refs; локальные SkillDetail/SkillTraits используют аспектный источник. Авторские IDs и исходники data не изменяются. Влияние одинаковых ключей на старую схему прогресса отделяется от доступа к чтению; не объявлять его исправленным без проверки и миграции.
- Read-only audit P5 подтвердил дополнительное проявление: resolveSurvey и handler выбора анкеты определяют аспект по rawId, ошибочно выбирая Ni/Te. P5 разрешён аспектный resolver с прежним online fallback. Flat skills map остаётся известной отдельной проблемой: совпавшие rawId разделяют passes/result; это не устраняется одним resolver и требует самостоятельной схемы/миграции. Не заявлять полностью исправленную изоляцию прогресса этих двух пар.

### ERR-015: результат P5

- Каталог хранит аспектный source ref; SkillDetail/SkillTraits и анкеты lite используют currentAspect как discriminator. Root browser проверил заголовок, первое утверждение и прохождение Ti manipulation-detection, а также заголовок и первое утверждение Se completion.
- Остаток OPEN: state.skills[rawId] объединяет passes/result этих пар. P5 устраняет ошибочный выбор материала и анкеты, но не изолирует их прогресс; отдельная schema migration с совместимостью старых snapshot остаётся будущей задачей.

## ERR-016 — stale navigation request и identity справочного блока при приёмке P5

- RUN-017; implementation/test; RESOLVED в P5.
- Независимое ревью установило, что сохранённый navigationRequest повторно применялся после sessionEpoch remount и мог перезаписать imported/reset currentAspect и screen. Request привязан к sessionEpoch и синхронно отфильтровывается до передачи новому JourneyView; browser проверяет wheel → import → один remount и неизменённые импортированные данные.
- Вложенный AspectsView менял block через next/sidebar/Toc без синхронизации внешнего composite ID и источника заметки. Единый переход сообщает blockId каталогу; внешний заголовок и ID обновляются, а заметку сохраняет текущий BlockReader.
- Первые browser-прогоны новых тестов выявляли только несоответствия selectors/fixtures наблюдаемому UI. Критерии не ослаблялись; итоговые content 8/8 и полный root e2e 26/26 прошли обычными кликами без force.

## ERR-017 — неоднозначные role-selectors после добавления Home

- RUN-018/RUN-019; test; RESOLVED в P6.
- Root production e2e перечислил 30 тестов. Первые serial-сценарии content и journey упали: неточные selectors по имени «Каталог» и «Путешествие» совпали одновременно с кнопкой Header и составным accessible name Home CTA. Результат: 17 PASS, 2 FAIL, 11 serial-skipped; это не приёмка P6.
- Минимальное исправление: 21 существующий literal role-selector «Каталог»/«Путешествие» и один обнаруженный тем же прогоном «Дневник» получили exact:true. Тексты Home, критерии, обычные клики и network audit сохранены; force не применяется. Targeted content+journey после правки: 13/13 PASS.

## ERR-018 — URL auth secrets, неполная stub matrix и history index в P6

- RUN-018/RUN-019; independent review; RESOLVED в P6.
- initialRoute показывал account stub для token/reset_token/auth/tgAuthResult, но оставлял значения в URL/history. Это против требования удалить auth-параметры через replaceState и повторно открывает stub после возврата Home + reload. Исправление должно сохранять legacy account storage и unrelated URL части.
- Header/stub покрывали общие server-группы, но не давали наблюдаемых входов для server tracker привычек, diary emotions/trainings/reports/Vault Sync и отдельных server streak/word bonus направлений. Скрытие online Diary tabs при user=null исключает network mount, но не выполняет требование явной заглушки.
- navigationDepth уменьшался при любом popstate, включая forward; Hall hash anchors создавали неучтённые history entries. Исправление: индекс в history.state, direction-independent восстановление целевого индекса; статическое оглавление Hall прокручивает без новой history entry. Browser должен проверить back/forward/back, hash и direct-deeplink return.

### ERR-018: результат приёмки RUN-019

- Auth intent определяется до очистки URL. token/reset_token/auth и tgAuthResult удаляются replaceState; unrelated query/hash и legacy storage сохраняются. Возврат Home + reload не повторяет account stub.
- Header даёт 22 наблюдаемых server-направления с отдельными feature IDs; browser проверяет каждый callback и byte-identical lite snapshot. Hall chat/Q&A/publications проверены отдельно.
- History route и index хранятся в history.state. Browser back, forward и реальная Header Back восстанавливают ожидаемые экраны; direct deeplink остаётся внутри Lite. Оглавление Hall прокручивает без изменения hash, section callback Aspects открывает соответствующую секцию.
- Повторное независимое read-only ревью не нашло блокирующих findings. Неблокирующие ограничения: специализированный текст каждой заглушки проверен source review, но e2e фиксирует общий текст и feature ID; non-auth deeplink URL после Back сохраняется и при reload снова открывает ту же заглушку.
