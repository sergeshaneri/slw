# Журнал исполнения

Записывать только выполненное. Команды без запуска не получают PASS. Не помещать секреты/личный контент.

<a id="run-001"></a>

## RUN-001 — 2026-09-11, проверка Git и создание ветки

- Cwd: настоящий Git-root, указанный в baseline.json.
- git fetch origin --no-tags: exit 0; обновилась origin/gh-pages fbb0f04 → 03c6193.
- git ls-remote --symref origin HEAD refs/heads/main refs/heads/slw-instruct refs/heads/gh-pages: exit 0; default HEAD=gh-pages.
- origin/main=267eb52, origin/slw-instruct=c7f2b3c; текущая slw-instruct совпадает с origin (0/0).
- shallow=false; merge-base main/slw-instruct exit 1, no output; корни различны. Интерпретация: независимые истории.
- git switch -c codex/lite-local c7f2b3cd354cc6c92bb3b470a1164f0ddc6cb87f: exit 0.
- git diff --exit-code slw-instruct --: exit 0; исходники сохранены.
- main и remote default не менялись. Push/commit/deploy не выполнялись.
- Ошибка процесса ERR-005 зафиксирована отдельно.

<a id="run-002"></a>

## RUN-002 — 2026-09-11, исходная TypeScript-проверка

- Cwd: slw-main/slw-main.
- Команда: npm.cmd run typecheck.
- Реальная команда script: tsc --noEmit.
- Результат: exit 0, диагностик TypeScript нет.
- Ограничение: это исходная игра, не реализованная lite-версия. Browser/build/unit/e2e не запускались.

## Шаблон записи

RUN-NNN — дата, этап:
- Ветка/HEAD/cwd:
- Разрешённая цель и scope:
- Выполненные действия:
- Команды и exit codes:
- Что доказано / что не проверено:
- ERR-ID и corrective action:
- Изменение tasks.json:
- Следующий шаг:


<a id="run-003"></a>

## RUN-003 — 2026-09-11, создание и проверка harness

- Созданы AGENTS.md, план 002, harness: правила, задачи, baseline, решения, ошибки, verification, журнал и verify.ps1. План 001 помечен как заменённый технически.
- Первая общая команда записи не запустилась из-за Windows os error 206 (ERR-006). Документы записаны ограниченными пакетами, каждая команда exit 0.
- Команда: & ./plans/harness/verify.ps1 -Mode Preparation -Typecheck.
- Результат: exit 0; HARNESS PASS, 8 этапов, codex/lite-local, typecheck=True.
- Проверены локальные ссылки, граф задач, наличие evidence-файлов, Git-база, контрольные суммы посторонних документов и отсутствие tracked-правок продукта.
- git diff --exit-code c7f2b3c -- slw-main backend: exit 0.
- Исходники не менялись. Документы остаются untracked, коммит/публикация не выполнены.
- P0 DONE, P1–P7 TODO. Следующий шаг при указании реализовать: P1, тесты исходного поведения и перенос чистого состояния.
- Ограничение: build/browser/network/unit будущей lite-версии NOT_RUN; PASS harness их не заменяет.

## RUN-004 — 2026-09-11, подготовка локального коммита

- Пользователь разрешил коммит в codex/lite-local. Scope: AGENTS.md и 12 файлов plans; посторонние документы исключены.
- verify.ps1 -Mode Preparation: exit 0, HARNESS PASS.
- Первая проверка staged whitespace остановила команду до коммита: ERR-007. Исправлены только завершающие пустые строки.
- Перед коммитом повторно выполняется git diff --cached --check; успешный SHA доступен в Git log.
- Push и deploy не выполняются. P1–P7 остаются TODO.

<a id="run-005"></a>

## RUN-005 — 2026-09-11, начало P1 и возобновление после лимита

- Родительский HEAD: 1639516d7a7cb1cd2a109dacb42b837470953e07; ветка codex/lite-local.
- Cwd: D:\Сережа\CODING\ot Esyi\slw-slw-instruct\slw-slw-instruct.
- Прочитаны AGENTS.md, планы 001/002 и обязательные документы harness. Авторизация реализации и коммитов зафиксирована DEC-010.
- git status --short, git branch --show-current, git rev-parse HEAD: exit 0; tracked-правок нет, два защищённых untracked сохранены. После возобновления состояние повторно подтверждено.
- & ./plans/harness/verify.ps1 -Mode Preparation -Typecheck: exit 0, HARNESS PASS, TypeScript PASS. Unit/build/e2e ещё NOT_RUN.
- Повторился ERR-001: PowerShell и Node kernel не запускались из-за apply deny-read ACLs. Штатный require_escalated позволил чтение и baseline; причина среды не установлена.
- Первая попытка записи этой записи и запуска P1 остановлена usage limit (ERR-008), изменений не было. Пользователь попросил продолжить; read-only проверка снова завершилась exit 0.
- P1 IN_PROGRESS: один исполнитель gpt-5.6-sol medium; тесты исходной миграции до механического выделения чистого state. Коммиты и центральные статусы исполнителю запрещены.
- Следующий шаг: независимая проверка diff, typecheck и state unit оркестратором перед приёмкой P1.

<a id="run-006"></a>

## RUN-006 — 2026-09-11, приёмка P1

- Задача P1; родительский HEAD 1639516d7a7cb1cd2a109dacb42b837470953e07; codex/lite-local.
- Исполнитель gpt-5.6-sol medium. Отчёт получен: до переноса npm.cmd run test:lite:unit -- state, exit 0, 5/5; после переноса те же 5/5 и typecheck exit 0. Прерывание Selected model is at capacity устранено повторным запуском того же исполнителя без замены модели.
- Scope: frontend package/lock, vitest/playwright configs, state.test.ts и три синтетических fixtures, domain/journey/state.ts, JourneyView.tsx и import defaults в App.tsx.
- Оркестратор прочитал фактический diff, state tests/fixtures и конфиги. Сравнение блока с git show HEAD: совпадение точное после нормализации EOL и добавленных export. Алгоритмы не изменены; domain импортирует только типы и чистую константу SURVEY_BLOCK_KEYS из tree.ts.
- Cwd проверок frontend: slw-main/slw-main. Оркестратор: npm.cmd run typecheck exit 0; npm.cmd run test:lite:unit -- state exit 0, 5/5; npm.cmd run test:lite:list exit 1, No tests found, 0 specs. Последнее ожидаемо на P1 и не считается PASS e2e.
- Cwd остальных проверок: Git-root. git diff --exit-code -- backend slw-main/slw-main/src/data exit 0; git diff --check exit 0; verify.ps1 -Mode Docs exit 0 HARNESS PASS, защищённые SHA256 совпали.
- Исправлено при ревью: отдельный Playwright порт 4174, /slw/, strictPort, reuseExistingServer:false; удалён --pass-with-no-tests (ERR-010).
- P1 DONE. P2–P7 TODO; build/browser/network не выполнялись. Следующий этап P2: раздельный bootstrap и запрет транспорта.
