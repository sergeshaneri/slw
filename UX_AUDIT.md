# UX-аудит SLW

Дата: 2026-05-19
Охват: фронт (`slw-main/slw-main/src/`), все view, гость и залогиненный, mobile + desktop, без правок.
Метод: эвристический ревью кода (.tsx + .module.css) + копи + флоу.

## Как читать

- **CRITICAL** — реально ломает юзера (теряет данные, тач-таргет не нажать, экран не открыть).
- **IMPORTANT** — мешает, путает, удлиняет путь, нарушает доверие.
- **NICE-TO-HAVE** — было бы лучше; косметика, формулировки, мелочи a11y.
- Ссылки `файл:строка` — точка входа, контекст вокруг ±10 строк.
- В кавычках — точный копи из исходника.

---

## TL;DR — три темы, которые повторяются по всему приложению

1. **iPhone safe-area везде проигнорирован.** `App.module.css`, `AuthModal.module.css`, `IntroTour.module.css`, sticky Header — нигде нет `env(safe-area-inset-*)`. На iPhone с notch / dynamic island шапка лезет под статус-бар, нижние CTA — под home-индикатор, закрывающие «×» в модалках попадают в опасную зону. Самый широкий критический риск, потому что трогает каждый экран.

2. **Тач-таргеты системно меньше 44×44px.** Avatar в Chat (42), backBtn (36→32 на мобиле), closeBtn в AuthModal (32), bell (28-30), info-btn в SkillTree (36), Hint close (22), tasksToggle (icon-only без подписи). Палец промахивается, юзер тыкает по соседним элементам. Не один экран — паттерн.

3. **Native `window.confirm` / `window.alert` ломают премиум-эстетику.** Header.tsx:131 (alert на locked nav), AspectsView:84, HabitSection:84, ProfileView:900 (confirm на удаление практики). Дёшево выглядит, особенно в TMA. Плюс блокирует UI-поток.

4. **Деструктивные действия без подтверждения.** `JourneyProfile.handleReset` сбрасывает весь journey (XP, streak, skills, прогресс всех аспектов), кнопка стоит рядом с «Сменить планету» в одинаковом `btnGhost`. TasksScreen «Удалить», HallView чат-сообщение «×», DiaryView entry delete — все без confirm/undo. Случайный тап = потеря.

5. **Гость теряет прогресс при логине.** `App.handleAuthSuccess` не мигрирует `whl_journey` / `whl_diary` / `whl_scores` из localStorage в бэк — `loadFromApi` перетирает пустыми данными с сервера. Молчаливая потеря. Это явно отмечено в CLAUDE.md как «миграция пока не делаем», но юзер этого не знает и не получает предупреждения.

6. **Race-conditions на double-click.** `handleScriptAction` / `handleSend` в JourneyView продвигают шаг до того, как 700ms `setTimeout(deliverScript)` отработает. На медленной мобильной сети спам по «Далее» = +2 XP, прогресс уехал на 2 шага, инсайт записан дважды. AuthModal submit и DMView send имеют тот же зазор.

Дальше — по разделам.

---

# Раздел 1. Вход, шелл, онбординг

## App.tsx (роутинг, гейт)

### CRITICAL

- **App.module.css:1-9** + **Header** — `.app { height: 100dvh; overflow: hidden }` плюс sticky `Header` без `padding-top: env(safe-area-inset-top)`. У iPhone-юзера верх шапки попадает под status bar / dynamic island. Влияет на ВСЕ экраны.

- **App.tsx:892-905 + 836-846** — переход «Welcome → Начать бесплатно → view='journey' → useEffect открывает IntroTour» происходит без переходного состояния. WelcomeScreen исчезает, фон становится чёрный, поверх — IntroTour-модал. Юзер видит две модалки подряд (одна закрылась, другая открылась), не понимая что произошло. Добавить хотя бы 200ms фейд между ними или один общий лоадер.

- **App.tsx:710-717 (handleAuthSuccess)** — нет миграции `whl_*` localStorage → бэк. Гость накопил journey/diary/scores, логинится → `loadFromApi` перетирает state серверными данными (обычно пустыми). Прогресс пропадает молча. Минимум — показать пред-логином warn «Войти и сохранить прогресс?» или сначала пушить локал на бэк.

### IMPORTANT

- **App.tsx:178-185** — логика «seenWelcome=1 и нет токена → view=journey» имеет дыру: юзер залогинился (welcome_seen=1), потом logout — он попадает в journey, а не на Welcome. Гостевой `whl_journey` может теперь конфликтовать с тем, что было в его аккаунте. Решение зависит от продукта (показать Welcome при logout, или явно сообщить «прогресс гостевой, не путать с аккаунтом»).

- **App.tsx:719-728** — гость кликает «Коуч» / «Профиль» / «Поиск» → `setShowAuth(true)` без контекстного заголовка. Юзер видит auth-модал и не понимает, почему — он жал «Коуч», не «Войти». В модал передать `reason: 'coach' | 'profile'` и менять заголовок: «Для коуча нужен аккаунт», «Профиль появится после регистрации».

- **App.tsx:797-822** — при первом логине после Welcome открывается тост с ачивкой + «+1 ✦ Stardust» без объяснения, что такое стардаст и за что. Первая ачивка должна сопровождаться onboarding-пояснением.

### NICE-TO-HAVE

- **App.module.css:13** — `.main { padding: 32px 24px 64px }`, на iPhone после sticky-шапки `padding-top: 32px` выглядит пустотой. На мобиле уменьшить до 16-20px.

---

## WelcomeScreen

### IMPORTANT

- **WelcomeScreen.tsx:9** — расхождение терминов: hero — «8 аспектов своей личности», карточка-фича — «8 аспектов личности», IntroTour шаг 1 — «8 ключевых сфер жизни», nav — «Аспекты». Выбрать одно ведущее слово (продукт постепенно переходит на «сферы» — Welcome остался на «аспектах»). Привести к единству.

### NICE-TO-HAVE

- **WelcomeScreen.tsx:48** — CTA «Начать бесплатно» намекает на freemium, которой нет в продукте. Создаёт ожидание платных уровней. Если их не планируется — нейтральнее «Попробовать», «Войти как гость».

- **WelcomeScreen.tsx:69** — кнопка «Начать путешествие →» дублирует основную CTA сверху, обе ведут в один `onContinueAsGuest`. На мобиле после скролла обе видны.

- **WelcomeScreen.tsx:13** — «Пошаговый курс через чат-бот» — слово «чат-бот» в первом экране может смутить. Лучше «через диалог».

---

## AuthModal

### CRITICAL

- **AuthModal.module.css:1-10** — оверлей `position: fixed` без `safe-area-inset-*`. На iPhone «×» (top:12) попадает под dynamic island, «Войти через Telegram» снизу может уехать под home-индикатор. Особенно критично потому что это вход — деться некуда.

### IMPORTANT

- **AuthModal.tsx:142-143** — текст «"Без аккаунта можно смотреть приложение, но Путешествие требует входа — данные привязываются к профилю"» противоречит фактическому поведению (гостям Путешествие открыто с 2026-05). Юзер, кликнувший «Войти» из шапки, ошибочно подумает, что без входа дальше нельзя. Переписать в духе «без входа прогресс хранится в браузере и потеряется при смене устройства».

- **AuthModal.tsx:125** — нет `role="dialog"`, `aria-modal="true"`, `aria-labelledby`. Скринридер не объявит модал, не зачитает заголовок.

- **AuthModal.tsx:127** — нет ESC. Клик-вне закрывает, но на маленьком модале на широком мониторе вся чёрная область — это overlay, не очевидно, что туда тапать. Юзер с клавиатурой ждёт ESC.

- **AuthModal.module.css:166** — `.closeBtn { 32×32 }` — меньше 44×44.

- **AuthModal.tsx:194** — loading-state «...» меняет лейбл, но не дизейблит input/ссылку Telegram. Юзер может изменить пароль во время отправки или кликнуть Tg-ссылку → full-page navigation посреди запроса.

- **AuthModal.tsx:166-188** — поля без `<label>`, только placeholder. VoiceOver / TalkBack читают как «edit text» без подсказки. Visually-hidden `<label>` или `aria-label`.

- **AuthModal.tsx:127 (close on overlay click)** — закрытие по тапу-вне без warn о потерянном вводе. На мобиле случайный тап рядом легко возможен, при регистрации обидно.

### NICE-TO-HAVE

- **AuthModal.tsx:174** — `<input name="name">` без `autoComplete="given-name"`. iOS не предлагает автозаполнение.
- **AuthModal.tsx:188** — нет toggle «показать пароль».
- **AuthModal.tsx:139** — «Соционика / Колесо Баланса» как заголовок модала дублирует Header. Оставить «Вход» / «Регистрация».

---

## IntroTour

### CRITICAL

- **IntroTour.module.css:11** — `padding: 48px 24px 28px` без `env(safe-area-inset-*)`. На iPhone «×» и нижняя `btnPrimary` попадают в опасные зоны.

### IMPORTANT

- **IntroTour.tsx:88** — нет ESC, нет focus trap. Юзер с клавиатурой попадает в ловушку.

- **IntroTour.tsx:80** — нет свайпа влево/вправо. На мобиле, где 5 шагов с большими визуалами, естественно свайпать (как сторис). Сейчас только кнопка «Дальше».

- **IntroTour.tsx:128** — «Пропустить» серым подчёркнутым текстом, рядом с «← Назад» (ghost-капсула) и «Дальше →» (primary). Визуально слабая иерархия: ghost и link читаются почти одинаково.

- **IntroTour.tsx:35 (шаг Diary)** — «"Вкладка «📅 Сегодня»"» упомянута без ориентира где её искать. Добавить «…в Дневнике».

### NICE-TO-HAVE

- **IntroTour.tsx:21 (шаг 1)** — абзац на 66 слов, на iPhone SE при `line-height:1.55` это 9-10 строк. Разбить на 2 предложения.
- **IntroTour.tsx:113** — dots без `aria-label` шага.

---

## Header

### CRITICAL

- **Header.tsx:131** — `window.alert(item.lockedTitle)` на клик по locked-кнопке. Системный диалог в премиум-теме выглядит грубо, блокирует UI. Заменить на встроенный tooltip/toast.

### IMPORTANT

- **Header.module.css:287** — на ≤1024px `.header { flex-wrap: wrap }`, nav уходит вторым рядом. На iPhone Safari sticky Header теперь 2 строки = 110-130px над контентом. В обычном вебе на journey Header НЕ скрыт (только в TMA через `hideHeader = isTMA && view === 'journey'`) — над чатом всё равно полтора-два ряда. Либо скрывать Header на journey и в обычном вебе на мобиле, либо убрать flex-wrap и пустить nav в горизонтальный скролл сразу.

- **Header.module.css:310-320** — nav на мобиле — горизонтальный скролл без индикатора (fade справа, стрелка). На iOS 17+ без видимого scrollbar юзер не догадается, что справа есть «Топ» / «Коуч».

- **Header.module.css:131** — `.navButton { color: #8a8a9a }` на фоне капсулы `rgba(255,255,255,0.025)` — контраст ~3.8:1, при `font-size: 10-12px` на мобиле — ниже WCAG AA для small text.

- **Header.tsx:75** — tooltip «"ИИ-коуч доступен тем, кто начал путешествие… и прошёл хотя бы 5 шагов"» появляется у гостя через `window.alert`. Гость должен видеть «Войди, чтобы открыть коуча», залогиненный — текущую фразу.

- **Header.tsx:201** — на узких экранах в правом блоке: `🔔` + «+ email» (если без email) + «🛡 admin» (если admin) + аватар + «выйти» — до 5 элементов. `authBlock` не оборачивается. На 360-375px (iPhone SE/12 mini) либо горизонтальный срез, либо overflow.

- **Header.module.css:51** — `.backBtn { 36×36, на мобиле 32×32 }`. Меньше 44.

### NICE-TO-HAVE

- **Header.tsx:123** — «"👈 Тут начинается игра"» — слово «игра» расходится с тоном остального продукта (терапевтический курс / путешествие / сферы). Если игровая метафора задумана — она должна звучать и в Welcome/IntroTour.

---

## Footer

### NICE-TO-HAVE

- **Footer.tsx:1-26** — Footer показывается под контентом везде кроме journey. Для гостя (default view=aspects) после короткого экрана аспектов footer виден сразу с «Обсудить с автором» первой ссылкой — для нового юзера выглядит как «закрыто, иди писать автору». Показывать footer только после того как юзер проскроллил вниз или повзаимодействовал.

- **Footer.module.css:38** — `.link { 11px, letter-spacing: 2px, uppercase }` тяжёл для чтения.

---

## Toast / AchievementToast

### CRITICAL

- **AchievementToast.module.css:74** — на мобиле тост ставится `top: 12px` поверх Header и без `pointer-events: none` родителя. Тост ширины во всю строку перекрывает sticky Header и юзер не может попасть в навигацию ~4.5 секунды × N тостов в очереди. После первого логина возможно 3-5 разблокированных ачивок = Header заблокирован 13.5-22 сек.

### IMPORTANT

- **AchievementToast.tsx:42** — нет группировки. 5 тостов по 4.5 сек = 22 сек последовательной анимации. Группировать «Разблокировано 5 достижений» с раскрытием.

- **AchievementToast.tsx:46** — весь тост `role="button" onClick={onDismiss}`. Если внутри добавить child-ссылку (на профиль/ачивку), любой тап = dismiss. Семантически весь блок — кнопка, скринридер теряет контекст.

- **AchievementToast.tsx:55** — при `kind !== 'achievement'` подпись «"Уведомление"» — бессодержательно. Разделить success / error / info.

---

## Hint (Onboarding/Hint.tsx)

### IMPORTANT

- **Hint.tsx:50** — гость dismiss-нул хинт локально (localStorage). Логинится — на сервере флага нет, хинт показывается снова, юзер тут же закрывает. UX-флип. При логине гостя пушить локальные `hint_*` ключи на бэк через `markHintSeen`.

- **Hint.module.css:48** — `.closeBtn { 22×22 }` — меньше 44.

---

## NotificationsBell

### IMPORTANT

- **NotificationsBell.tsx:94** — открытие dropdown стреляет `markNotificationsRead` автоматически. Юзер не может «оставить непрочитанным», случайный тап стирает badge. Mark-read только по клику на айтем / явной кнопке «Прочитать все».

- **NotificationsBell.tsx:129** — `title="Уведомления"` без `aria-label`. На мобильных скринридерах title часто не озвучивается. Нет `aria-haspopup="true"` и `aria-expanded={open}`.

- **NotificationsBell.tsx:136** — badge с числом не озвучивается отдельно. Скринридер прочитает «эмодзи колокольчик три» без контекста «3 непрочитанных».

- **NotificationsBell.module.css:23** — badge `min-width: 18px; padding: 1px 6px`. При `99+` обрезается.

- **NotificationsBell.module.css:108** — `.itemTime { color: #5f6169 }` на `#15161c` — контраст ~3:1. Время уведомления нечитабельно.

- **NotificationsBell.module.css:5-14** — `.bell { padding: 6px 10px }` — тач-таргет ~32×28.

---

# Раздел 2. Journey

PlanetMap, кнопка «Сменить», `Onboarding` плашка, idle «Начать» — недавно перебраны, в аудит не входят.

## JourneyView.tsx (контроллер)

### CRITICAL

- **JourneyView.tsx:847-986 (handleSend) + 1626-1629 (handleScriptAction)** — race на double-click. После `await addBotMessage()` (700 ms) пользователь может кликнуть «Далее» снова — `isTyping` блокирует только рендер кнопок, не сами обработчики. На медленной сети спам = +2*XP, прогресс ушёл на 2 шага, инсайт записан дважды. Завести `isAdvancingRef` / `isProcessing` и блокировать оба пока `setTimeout(deliverScript)` не выполнен.

- **JourneyView.tsx:577-621 (awardXP)** — `postStepCompleted` fire-and-forget без retry. При 409 фронтовый `completedScripts`/`xp` уже разъехались с сервером. Сейчас catch только `console.warn`. Юзер видит локальный XP, при перезагрузке — откат к серверному. Минимум — тихий toast или retry-очередь.

- **JourneyView.tsx:2079-2089** — `SkillDetail` рендерится без shell-гарда на уровне JourneyView. При гонке (skillDetailId стал null до анмаунта) юзер видит пустой звёздный фон без UI и без «назад». Аналог для `SkillTraits` (2091). Явный сброс в `skill-tree` при пропаже id.

### IMPORTANT

- **JourneyView.tsx:537** — авто-скролл зависит от `state.screen`, при смене survey → chat виден резкий jump к низу. После смены экрана сначала скроллить в начало, потом дать обычному auto-scroll отработать.

- **JourneyView.tsx:553-555** — `showToast` через `setTimeout(2800)` без cleanup и без очереди. Спам слайдером затирает тосты.

- **JourneyView.tsx:1995-2002 (NeSkillTree)** — `NeSkillTree` НЕ принимает `onOpenSkillDetail`. Это значит, на ЧИ юзер не может открыть SkillDetail из дерева вовсе. Если намеренно (контента нет) — добавить заметку «Подробный разбор скоро»; иначе починить prop.

- **JourneyView.tsx:1911-1921** — `LevelComplete.wheelBtnLabel = wheelLabel ?? 'Открыть Колесо БС'` — хардкоженный fallback на БС. Для Ti `wheelLabel` не задан, на ЧЛ юзер увидит «Колесо БС». Сделать fallback от `currentAspect`.

### NICE-TO-HAVE

- **JourneyView.tsx:122-130** — `SKILL_ID_MIGRATION` хардкодом без даты/версии. Перенести в `data/journey/migrations.ts` с per-version slot.
- **JourneyView.tsx:106-110** — `SkillTreeIntroHint` рендерится ДО SkillTree (1991-1993), визуально торчит выше шапки. Переместить внутрь SkillTree.

---

## Chat (топбар и пузыри)

### CRITICAL

- **Chat.tsx:80-131 + JourneyView.module.css:50-75** — sticky-инпут на iOS Safari/Telegram WebView. `position` у `.inputArea` / `.numberInputArea` / `.stepInsightArea` не задан, опирается на `flex-shrink:0`. При открытой клавиатуре `visualViewport` уменьшается, но порог `keyboardOpen = 100px` в TG WebView может не сработать. На 360-375px устройствах с клавиатурой ~270px остаётся ~280px → `stepInsightArea` (~150px) может перекрыться. Проверить `env(safe-area-inset-bottom)` и/или динамический `bottom: visualViewport.offsetTop`.

### IMPORTANT

- **Chat.tsx:137-181** — топбар на узких экранах (360px): `avatar (42) + topbarInfo + changePlanetBtn (~106px) + skillsBtn + tasksToggle + xpBadge` — 5-6 контролов в одной строке. При `surveyRemaining > 0` ломается на 2 ряда. Скрыть текст у «Сменить» на узких или схлопнуть `xpBadge` в иконку.

- **Chat.tsx:138-140** — `.avatar` — `<button>` 42×42, меньше 44. Семантика `aria-label="Профиль"`, но визуально это `◐` (символ полумесяца) — юзер не догадается, что это вход в профиль. Расширить + заменить эмодзи на 👤.

- **Chat.tsx:142-144** — `topbarTitle` = планета («Terra Harmonia»), `topbarSub` = `Уровень 0 · ${currentLevel?.title ?? ''}`. При пустом title виден висящий разделитель `· `.

- **Chat.tsx:166** — кнопка «Оценить навыки · 33» — `surveyRemaining=33` огромная цифра пугает. Переименовать в «Колесо навыков · 33» или добавить tooltip.

- **Chat.tsx:170-179** — `.tasksToggle` — icon-only `!` без подписи, при `pendingCount === 0` пустая загадка. Добавить мини-текст «Задания» как у `.skillsBtn`.

- **Chat.tsx:185-189** — Hint «Каждый ответ — XP. После теории… инсайт минимум 10 символов» — жёстко завязано на `minLength=10`. Изменят на 20 — рассинхрон. Вынести в константу или формулировать «короткий инсайт».

### NICE-TO-HAVE

- **Chat.tsx:213-217 vs :387** — `.msgBubble { max-width: 82% }` vs `.scriptCard { 92% }`. Несогласованно, разные сообщения «разной ширины». Унифицировать.

---

## Onboarding (Journey-Onboarding, 4 шага)

### IMPORTANT

- **Onboarding.tsx:27-33** — `step === 3` показывает кнопку «Доставай сферы жизни», `step === 4` — «Открыть Карту Планет →». Промежуточный шаг 4 (после клика на 3) добавляет bot-сообщение «Готово. Сейчас покажу Карту Планет…» — это 5 экранов на 4-step онбординг. Сократить: после шага 3 сразу открывать карту.

- **Onboarding.tsx:39-41** — `progressLabel = "Введение · шаг ${step + 1} из 4"` на шаге 3 показывает «4 из 4», после клика — внезапно «Готово · дальше — выбор планеты». Резкая смена прогресс-индикатора. На шаге 3 лучше «Перейти к выбору планеты», прогресс остаётся 4/4.

- **Onboarding.tsx:65** — `ONBOARDING[0].text` рендерится всегда в начале chatScroll. Если кто-то откатит state — дублирование. Хранить системно в `state.aspects[Si].messages`.

---

## ScriptButtons (типы шагов)

### IMPORTANT

- **ScriptButtons.tsx:13-17 (theory)** — единственная «Далее». Юзер не знает, что после клика откроется обязательный insight-textarea. «Прочитал · далее →» или «Записать вывод →» — намерение совпадёт со следующим экраном.

- **ScriptButtons.tsx:32-34 (question)** — «Ответить» без указания типа ответа. Юзер не знает, ждут ли число / слово / абзац. Показывать textarea inline без отдельного шага.

- **ScriptButtons.tsx:46-55 (exercise)** — две кнопки в `btnPrimary` визуально конкурируют («✓ Сделал, записать инсайт» vs «🪐 Взять в ежедневные практики»). При первом контакте непонятна разница. Вторую сделать `btnAccent` или `btnGhost` + подписи «один раз» / «делать каждый день».

- **ScriptButtons.tsx:69-71 (word)** — «Подумал об этом» (прошедшее время) — CTA должна отражать действие: «Записать мысль» / «Подумать и записать».

- **ScriptButtons.tsx:82-87 (survey)** — «Позже» в `btnGhost` действует ровно как `next`. Сейчас не отличается от «Начать анкету» по последствию. Точнее «Сейчас не буду» / «Пропустить эту анкету» (но из CLAUDE.md «везде должен оставаться след» — может быть просто «Открыть позже» с deferral в pendingTasks).

---

## SurveyScreen / SurveyChoice / SurveyInsight

### CRITICAL

- **SurveyScreen.tsx:84-91** — при «← Назад» теряется `insightText` (сбрасывается в `useEffect [idx]` 86-87). Юзер написал инсайт по вопросу 3, вернулся на 2 свериться, вернулся на 3 — текст пропал. Хранить per-statementIndex map.

### IMPORTANT

- **SurveyScreen.tsx:139** — `surveyClose aria-label="Прервать"` — агрессивно. Draft на самом деле сохраняется. «Закрыть» или «Отложить».

- **SurveyScreen.tsx:215-231** — `← Назад` при `idx === 0` — disabled без визуального стиля. Юзер тыкает, ничего не происходит. Глобальный `:disabled` стиль для `.btnGhost`.

- **SurveyScreen.tsx:156** — «Оцени по шкале от 1 (совсем не про меня) до 10 (полностью про меня)» — на 360px в 3 строки. Сократить: «1 — не я · 10 — точно я».

- **SurveyInsight.tsx:163-164** — «Отложить» = то же слово, что у SurveyScreen «Прервать», но действие разное (draft не записывается). Юзер привыкнет, что «отложить = сохранить и уйти», тут — нет. Одна формулировка «Закрыть» во всех точках выхода, или явно «Сохранить черновик» / «Прервать без сохранения».

- **SurveyInsight.tsx:171-172** — «Сохранить и узнать, как развить →» 28 символов, на 360px ломается в 2 строки. «Сохранить · Как развить →».

- **SurveyChoice.tsx:54-60** — статусы «Пройден 1 короткий проход — есть оценка» / «Пройдено 2 прохода — оценка точнее» в `surveySub` 12px text-muted. Важная инфа приглушена.

- **SurveyChoice.tsx:71-87** — «Короткая анкета» / «Полная анкета» без иконок, без оценки времени. Юзер выбирает вслепую. Добавить «~3 мин» / «~10 мин» или количество вопросов.

### NICE-TO-HAVE

- **SurveyScreen.tsx:179-194** — `surveyInsightHint` tooltip `position: absolute right:0` 260px шириной. На 320px перекрывает кнопку / уходит за viewport. Overflow-detection.
- **SurveyScreen.tsx:163-178** — `.surveyInsightBtn` 12px шрифт, спрятан под слайдером. Не воспринимается как часть процесса. Inline после ползунка с явной подписью.
- **SurveyInsight.tsx:131** — «Что думаешь об этом навыке? Запиши для себя на будущее.» — корявая фраза. «Запиши то, что не хочешь забыть».

---

## Slider / InsightInput / StepInsightPrompt

### IMPORTANT

- **Slider.tsx:42-53** — `aria-valuetext` отсутствует. Скринридер читает «5», теряя «из 10». Добавить `aria-valuetext={\`${value} из ${max}\`}`.

- **StepInsightPrompt.tsx:44-48** — `useEffect` deps пустой. При смене скрипта (T-1 → T-2) если `awaitingInput` остался `'step-insight'`, `text` остаётся со старым содержимым — юзер пишет про T-2 на текст T-1. Маловероятно после submit (awaitingInput=null), но при перезагрузке state — баг. `key={currentScript?.id}` в Chat.tsx:309 при рендере.

- **StepInsightPrompt.tsx:75** — «Минимум {minLength} символов · сейчас {text.trim().length}» — счёт по trim, но `canSubmit = text.trim().length >= 10`. Если юзер ввёл 9 видимых + 1 пробел, видит «10 / минимум 10», кнопка disabled (trim = 9). Validate либо на raw `text.length`, либо счёт тоже по trim.

- **InsightInput.tsx:36-47** — раскрытие textarea с `autoFocus`: на мобиле сразу всплывает клавиатура. Если тыкнули случайно, клавиатура съест половину экрана. Добавить `onBlur` → авто-коллапс если пустая.

- **InsightInput.tsx:39-47** — «✎ Записать инсайт» без подсказки, что произойдёт. В SkillDetail необязательное, в SurveyScreen тоже. Подпись «Записать инсайт (необязательно)».

### NICE-TO-HAVE

- **Slider.tsx (valueRow)** — `font-size: 56px` для текущего значения занимает место. На мобиле в `numberInputArea` 80+px над контролом — скорее декор. Уменьшить до 36px.

---

## TasksScreen / LevelComplete / JourneyProfile

### CRITICAL

- **JourneyProfile.tsx:123-125 (handleReset)** — `setState(DEFAULT_JOURNEY)` без подтверждения. Стирает XP, streak, skills, прогресс ВСЕХ аспектов. Кнопка «Начать заново» в `btnGhost` рядом с «🪐 Сменить планету» в том же `btnGhost` — нет визуальной разницы между обычным и destructive. Confirm-dialog с typed confirmation («введи "сбросить"») обязателен, и стиль `.btnDanger`.

- **TasksScreen.tsx:114-125** — «Удалить» без confirm. Случайный тап = задача пропала. Confirm или undo-toast.

### IMPORTANT

- **LevelComplete.tsx:79-119** — до 4 кнопок full-width подряд (Колесо, Следующий уровень, Универсальные навыки, Профиль). На L0 ЧЭ — 4 кнопки, не помещаются выше fold на мобиле. Сократить: одна primary (Колесо), остальное в свернутую группу «Что ещё».

- **LevelComplete.tsx:91-99** — «Перейти на «{nextLevelTitle ?? 'следующий уровень'}»» — кавычки внутри кавычек ломают типографику. Использовать em-dash или другую форму: «Перейти к уровню «Эпоха племён»».

- **TasksScreen.tsx:111-119** — `taskBody` с line-clamp 6, обрезка без «… развернуть» CTA. Юзер не знает, что под обрезкой.

- **JourneyProfile.tsx:48-71** — `profileHero` кликабельный (если `onOpenPlanetMap`), но визуально не похож на кнопку (inline `cursor: pointer`, нет hover-эффекта). Юзер не догадается тапать на «Уровень N · planet». Chevron справа или явная стилизация.

- **JourneyProfile.tsx:75-78** — «Streak дней» — англицизм + русская приставка. «Дней подряд». «Stardust» — англицизм без перевода — «Звёздная пыль» или просто `✦`.

- **JourneyProfile.tsx:14-22** — `ACHIEVEMENTS` хардкод на фронте, при том что бэк хранит в `web_achievements`. Дублирование. Один источник.

---

## SkillTree (Si) и расхождения между деревьями

### IMPORTANT

- **SkillTree.tsx:62-66** — комментарий «33 навыка сразу пугают, поэтому свёрнуты». Но юзер видит экран с 4 шапками и прогресс-баром 0/47 — нет первичной точки входа. Раскрывать первую ветку автоматически или подсказать «Начни с Целителя».

- **SkillTree.tsx:179-189 vs FeSkillTree:191-199 / SeSkillTree:209-216** — в Fe/Ni/Se есть дополнительная «Узнать, как развить →» под навыком. В Si/Ne/Te/Ti/Fi её нет. Гармонизировать: либо везде, либо везде через `treeSkillInfoBtn`.

- **SkillTree.tsx:179** — `.treeSkillInfoBtn { width: 36 }` — меньше 44.

- **SkillTree.tsx:170-178** — бейдж «общий» 9px, на retina нечитаем. Минимум 10px.

- **SkillTree.tsx:172-176** — «1.5/10 · 1/3 · углубить» — три значения через `·`, юзер не понимает «1/3» (это «пройдено 1 проход из 3 возможных»). Tooltip в шапке.

### NICE-TO-HAVE

- **FeCoreOverview.tsx:60-74** — `coreOverviewCard` без визуального состояния «уже видел/прошёл». Юзер не отличает осваиваемое от нетронутого.
- **SkillDetail.tsx:160-182** — `lockMessage` 95+ символов. Структурировать как чек-лист «✓/×».
- **SkillTraits.tsx:209-211** — «Глубинная дилемма» — тяжёлое слово. «Внутренний конфликт» / «Парадокс развития».

---

## GuestSaveNudge

### NICE-TO-HAVE

- **GuestSaveNudge.tsx:42-60** — `role="status" aria-live="polite"` на банере с CTA. Screen-reader озвучит весь текст + кнопку при появлении. Нудж — не критичное сообщение. `aria-live="off"` или вообще без role.

---

# Раздел 3. Контентные view (Aspects, Dashboard, Diary)

## AspectsView

PlanetMap-логику не трогаем; мобильный drawer + reader-progress свежие, не аудитятся.

### CRITICAL

- **AspectsView.tsx:84 + HabitSection.tsx:84** — `window.confirm('Снять активную практику для этого аспекта?')`. Системный prompt в премиум-теме выглядит дёшево, особенно в TMA. Заменить на custom-модал + явное пояснение что будет со стриком/историей.

- **AspectsView.tsx:759** — `<select>` для «К чему именно?» без `htmlFor`-связки и `min-height: 44px`. iOS системный picker открывается, юзер не понимает что выбирает.

### IMPORTANT

- **AspectsView.tsx:170-173** — текст под прогресс-баром карточки смешивает 3 варианта: «→ начать путешествие» / «N из M шагов · K%» / «K шаг(а/ов) пройдено». Унифицировать: при `levelTotal > 0` всегда `inLevel / levelTotal · %`; иначе скрыть.

- **AspectsView.tsx:118-121** — Hint обещает «теория, цели, дневник». «Цели» сильно ассоциируется с goals в Профиле. На странице аспекта целей в явном виде нет (есть блок `goals` в L1). Заменить «цели» на «упражнения».

- **AspectsView.tsx:719-723** — «Достигни Уровня X в путешествии этого аспекта» — «Уровня» с большой только тут, везде «уровень N» с маленькой. Нормализовать.

- **AspectsView.tsx:743-805 (форма заметки)** — «отмена» и «Сохранить» в одной строке `noteFormHead`. Случайный тап мимо = потеря введённого текста без warn.

- **AspectsView.tsx:1219 (HallStubBlock)** — «случайная тройка» даже если в секции 1-2 элемента. Динамическое «случайный фрагмент».

- **HabitSection.tsx:122-124** — «Обычно это что-то небольшое из L1» — упоминание L1 без объяснения юзеру, который не дошёл до уровней.

- **HabitSection.tsx:186-188** — «Когда мы доделаем скрипты уровней, ты сможешь выбирать практику прямо из списка упражнений L1» — TODO-message к юзеру. Переписать в нейтральную инструкцию.

- **SiWheel.tsx:288-290 (и аналоги во всех 8 *Wheel)** — текст «Пройди уровень 0, чтобы открыть колесо навыков» бессмыслен для гостя, не имеющего понятия что такое «уровень 0». Для гостя — «Зарегистрируйся, чтобы начать путешествие и получить доступ к колесу».

### NICE-TO-HAVE

- **AspectsView.tsx:143-178** — AspectsGrid 8 светящихся карточек подряд на мобиле = визуальный шум. Притушить `aspectGlow` или включать на hover.
- **AspectsView.tsx:608-617** — «Пересмотреть навыки →» (когда `remaining === 0`) неоднозначно — «снова посмотреть» или «изменить»? «Просмотреть свои оценки →».
- **AspectsView.tsx:357-362** — «🏛 Обсудить … с сообществом» — клик ведёт в Холл, где не только обсуждение. «Открыть холл …» лаконичнее.
- **AspectsView.tsx:626** — глифы стадий ★/✸/◍/◌/♢ без легенды.

---

## DashboardView

### CRITICAL

- **DashboardView.tsx:300** — `data.is_newbie` не объявлено в локальном типе `DashboardData`. Компилируется через `& Record<string, unknown>`. Если бэк хоть раз вернёт `null` вместо `false` — поведение разойдётся. Также `data?.diary_today_count_by_source?.['daily-review']` (DiscoverMore.tsx:50-54) — поля нет в типе.

- **DashboardView.tsx:439-444** — `scoresLine` рендерит 8 чипов в строку. На 360px переносятся по 2-3, ширина разная, длинные значения «БС 10.0» теряют последний символ. `grid-template-columns: repeat(4, 1fr)` или фикс ширины + `min-width: 0` на родителе.

- **DashboardView.tsx:343-361** — `habitRow` кнопки без явного `min-height` 44px. Случайные дабл-тапы.

### IMPORTANT

- **DashboardView.tsx:553, 610** + **CoachView.tsx:262-265, 324** + **DiaryView.tsx:159-167, 197-208, 262-265** + **PublicProfileView.tsx:351** + **ReactorsList.tsx:92** — везде сырая латиница ключей аспектов (`Si`, `Te`, `Fe`) вместо `ASPECT_DISPLAY_KEY[aspect]`. Прямое нарушение конвенции CLAUDE.md «никогда не выводи `{key}` напрямую». **Общее системное place across views.** Пройтись и заменить везде.

- **DashboardView.tsx:283** — приветствие «Доброе утро, {display_name}». При пустом display_name = «Доброе утро, » с висящей запятой.

- **DashboardView.tsx:225, 676** — `greeting()` по локальному времени без TZ. В TG-боте на сервере может вернуть «Доброй ночи» в 14:00 по юзеру. Не критично, но i18n-маркер.

- **DashboardView.tsx:475** — «Вернётся завтра» (когда `remaining_today === 0`) делает кнопку disabled, но визуально не отличается от «Позвать». Текст явнее: «Завтра новый вызов · 0/{daily_limit}» + ссылка «Использовать стардаст».

- **DashboardView.tsx:495-500** — `onKeyDown` сабмитит entry на Enter (mode=enter). `placeholder` про Enter не упоминает. Юзер случайно нажал — отправил недописанное. Hint «Enter — отправить, Shift+Enter — перенос» когда mode=enter.

- **DashboardView.tsx:633-650** — карточка «🎓 Пройти обучение» дублирует DiscoverMore. Новичок видит NewbieHero + DiscoverMore с all-planets + «Заполни профиль» + «Пройти обучение» — 4 крупных CTA на одном экране. Либо NewbieHero, либо DiscoverMore, не оба.

- **DashboardView.tsx:529-537** — уведомления списком без «Прочитать все» / «Открыть всё». Юзер видит 5 строк, не знает как пометить.

- **DiscoverMore.tsx:94** — «Заполни профиль» при `!bio || !avatar`. Если bio есть, а аватар «🧑» дефолтный (но не «»), карточка вечно висит. Разделить на две или показывать пока ни bio ни avatar не задано.

- **DashboardView.tsx:301-329** — `newbieHero` описывает «самокоучинговая игра» — self-promo. Тон не вяжется с минимализмом остального. Смягчить.

### NICE-TO-HAVE

- **DashboardView.tsx:467-485** — «N/M осталось сегодня · бонус +X» — механика не очевидна. «N свободных вызовов сегодня (1 базовый + X от стрика)».
- **DashboardView.tsx:651-655** — «📅 Активность за 30 дней» дублируется с тем что внутри Heatmap. Убрать одно.
- **DashboardView.tsx:384-421** — `personalRow` две карточки. На мобиле проверить single column, иначе текст «N непрочитанных» режется.

---

## MiniWheel / Heatmap

### IMPORTANT

- **Heatmap.tsx:117** — «N активных дней · M событий за 30 дне[й]» — `<DevAdminEggLetter>` пишет «й» отдельно. При `days === 1` будет «за 1 дне[й]» — некорректное склонение. `pluralDays` хелпер.

- **Heatmap.tsx:125-134** — каждая `cell` — `<div>` без `role` без клика. `title` на мобиле не показывается. Юзер не видит, что показывает квадратик. `aria-label` или tap-toggle с поповером.

- **Heatmap.tsx:148-153** — кнопка «↓ Показать всю историю» без `aria-expanded`.

### NICE-TO-HAVE

- **MiniWheel.tsx:106-119** — SVG `<text>` лейблы аспектов внутри `<g onClick>`. Проверить `cursor: pointer` на тексте и path внутри g.

---

## DiaryView и вкладки

### CRITICAL

- **DiaryView.tsx:282-285** — entry delete без confirm. Случайный тап = запись потеряна, особенно болезненно для длинного коуч-ответа / результата анкеты.

- **DiaryView.tsx:159-167, 197-208, 262-265** — латиница `{key}` в `<select>`, фильтрах и DiaryEntry (см. cross-cutting #3).

### IMPORTANT

- **DiaryView.tsx:34-41 (SOURCE_LABEL)** — мапа покрывает только часть source-типов. В коде есть `'aspect-item'`, `'daily-review'`, `'journey-step-insight'`, `'web'`, `'vault'`, `'journey-survey-statement'` — все отрисовываются raw. Юзер видит «daily-review» как label.

- **DiaryView.tsx:213** — при `filteredDiary.length === 0` показывает «Записей нет» без CTA. «Запиши первую запись» с фокусом в textarea.

- **DiaryView.tsx:328-330 (SurveyDetails)** — «▼ показать все 15 ответов» — число 15 хардкод. Анкеты бывают разной длины. Динамическое «N ответов».

### NICE-TO-HAVE

- **DiaryView.tsx:82-134** — Tab-row без `role="tablist"`, кнопки без `role="tab"` + `aria-selected`.

---

## DailyReview

### CRITICAL

- **DailyReview.tsx:379-396** — sticky `daySaveBar` без `bottom: env(safe-area-inset-bottom)`. На iOS Safari с открытой клавиатурой может перекрывать textarea / уехать под home-индикатор.

- **DailyReview.tsx:153-184** — autoScroll использует `window.innerHeight - 110` фиксом. На моб с большой клавиатурой `innerHeight` зависит от браузера и доскролл может быть недостаточным. `visualViewport.height` если доступно.

- **DailyReview.tsx:213-225** — `DiaryEntry.id = idCounter++` локально. При параллельных сейвах из других мест возможны коллизии. `crypto.randomUUID()` или `${ts}-${aspect}`.

### IMPORTANT

- **DailyReview.tsx:294-336** — chips-вопросы в раскрытой секции НЕ кликабельные (просто плэйсхолдеры). Юзер ожидает, что тап вставит вопрос в textarea. Сделать кликабельными или переоформить как пассивные tags.

- **DailyReview.tsx:386** — disabled save «Заполни хотя бы один блок» — на мобиле tooltip не работает. Inline-hint.

- **DailyReview.tsx:270-273** — «Заполняй только то, что хочется — все блоки опциональны, можно пропустить любой» — повторяет суть. «Все блоки опциональны».

### NICE-TO-HAVE

- **DailyReview.tsx:269** — `dayTitle = todayPretty()`. Нельзя записать вчерашний день. Date picker — будущая фича.

---

## EmotionsTab / TrainingsTab / AnalyticsTab / VaultSyncTab

### IMPORTANT

- **EmotionsTab.tsx:71-85** + **TrainingsTab.tsx:77-92** + **AnalyticsTab.tsx:74-87** — empty-states построены вокруг `python tools/vault_sync.py import`. Это для power-юзеров с Obsidian-vault'ом. Веб-юзер, не знающий Python, получает обескураживающий empty. Добавить альтернативу: «Если ты пишешь в приложении — эмоции/тренировки не парсятся отдельно, это для импорта из Obsidian».

- **EmotionsTab.tsx:142-156** — `<button>` оборачивает `.rowHead` + `.detail`. Если в `.detail` появятся интерактивные элементы — кнопка-в-кнопке (нарушение HTML). `<div role="button" tabIndex={0}>` + onKeyDown.

- **AnalyticsTab.tsx:111** — `<pre>{content_md}</pre>` рендерит markdown как plain text. `## Заголовок` и `**жирно**` видны как символы. Минимальный markdown-рендер.

- **AnalyticsTab.tsx:50-67** — открытый отчёт 50KB прокручивать без sticky «← к списку». Юзер должен скроллить до самого верха.

- **TrainingsTab.tsx:108-110** — «упражнений» неоднозначно. Это уникальных или всего? «Видов упражнений» / «уникальных».

### NICE-TO-HAVE

- **VaultSyncTab.tsx:96-99** — pre-блок с env-vars переносится неаккуратно на мобиле. `overflow-x: auto`.

---

## SearchView

### IMPORTANT

- **SearchView.tsx:98** — `autoFocus` на input. Как табик внутри Дневника может удивить (юзер хотел просто посмотреть). Опция или убрать.

- **SearchView.tsx:73-82** — debounce 250ms. При `q.length<2` показывается «Ищем…» от старого запроса до следующего ввода. Очистить `data` при `q.length<2` сразу.

- **SearchView.tsx:120-138** — при 200+ результатах рендерятся все. Пагинация / show-more.

---

# Раздел 4. Социальные (Profile / Hall / DM / Leaderboard / Coach)

## ProfileView (свой)

### CRITICAL

- **ProfileView.tsx:600** — `savedAt && !saving` показывает «Сохранено ✓», но `setSavedAt(Date.now())` без `setTimeout(setSavedAt(null), 2000)` — лейбл висит вечно до следующего сейва.

- **ProfileView.tsx:235-269** — `handleSave` не имеет unsaved-warning. Юзер ввёл bio/inspirations/goals и нажал «Назад» / сменил view — всё пропало. `beforeunload` + dirty-флаг.

- **ProfileView.tsx:900-904** — `window.confirm` на снятие практики (как в HabitSection и AspectsView).

- **ProfileView.tsx:858** — кнопка «🛡 Активировать защиту (⚡{SHIELD_COST})» без confirm. Тапнул — списались 50 stardust. Confirm обязателен на дорогую покупку.

### IMPORTANT

- **ProfileView.tsx:209** — `if (prev.length >= 3) return prev` — при попытке выбрать 4-й focus-aspect молча игнорируется. `disabled` есть на чипе, но визуально слабо отличается. Дополнительный toast «Максимум 3».

- **ProfileView.tsx:439-447** — `onKeyDown` в bio textarea — Enter уходит в save. Bio — длинный текст, Enter = перенос ожидаем. Убрать handler здесь.

- **ProfileView.tsx:213** — addInterest лимит 12 без явной подсказки. Кнопка `+` становится disabled — юзер не понимает почему. Hint «Не больше 12 тегов».

- **ProfileView.tsx:436-450** — `maxLength=600` без визуальной маркировки при 80%+. Юзер пытается дописать, буквы не появляются.

- **ProfileView.tsx:573-588** — цели показываются как 3 инпута даже пустые. Шум. Показывать заполненные + 1 пустой для добавления.

- **ProfileView.tsx:683-687** — `showAllInsights` рендерит ВСЕ при `length > 10`. При 50+ перформанс на слабом мобильнике падает. Виртуализация или подгрузка по 20.

- **ProfileView.tsx:794** — «🛡 защита до {data.shield_until}» — сырая дата ISO «2026-05-23». Форматировать «до 23 мая».

- **ProfileView.tsx:1067-1082** — achievement `title={a.desc}` — HTML-title на мобиле не работает. Tap-раскрытие.

### NICE-TO-HAVE

- **ProfileView.tsx:319** — «🔒 скрыт от других» статус, но переключение только в Настройках. Inline-toggle или подсказка.
- **ProfileView.tsx:371-393** — headerActions 4 кнопки на мобиле переносятся. Overflow-меню для второстепенных.

---

## PublicProfileView / ReactorsList

### CRITICAL

- **PublicProfileView.tsx:188 (404 fallback)** — кнопка «Назад» работает только если `onBack` передан. Иначе тупик. Гарантировать back или «← На главную».

- **PublicProfileView.tsx:351 + ReactorsList.tsx:92** — `aspect` сырой (см. cross-cutting #3).

### IMPORTANT

- **PublicProfileView.tsx:248-256** — «✉ Написать» с `title="Доступно при взаимной подписке"` — но кнопка кликабельна, ведёт в DM где юзер увидит «нельзя писать». Показывать disabled с явным «✉ Доступно при взаимной подписке».

- **PublicProfileView.tsx:243** — «✓ Подписан» / «+ Подписаться» — нет hover-варианта «Отписаться» на подписке. Стандартный паттерн.

- **PublicProfileView.tsx:362** — scoreBar `width: ${(value/10)*100}%` без `Math.max(0, Math.min(10, value))`. Баг бэка сломает визуал.

- **PublicProfileView.tsx:415** — «👥 кто реагировал (N)» кликабельно, но визуально пассивный текст. Border-bottom dashed.

### NICE-TO-HAVE

- **PublicProfileView.tsx:471-473** — Empty «не заполнил профиль» fallback после длинной цепочки условий. Если есть только achievements, empty не показывается, профиль выглядит пусто.
- **ReactorsList.tsx:104-107** — склонение «1 юзер скрыл / N юзеров скрыли» не полное (21 = «1»).

---

## LeaderboardView

### IMPORTANT

- **LeaderboardView.tsx:40-42** — «XP считается по завершённым шагам путешествия и заданиям» — неточно. По CLAUDE.md XP = `max(step_completed count, completedScripts.length)`, никаких «заданий». Юзер ищет «задания» в UI. «По шагам, пройденным в путешествии».

- **LeaderboardView.tsx:49-52** — «Будь первым в топе!» — продающий тон. «Пока никого нет — пройди первый шаг в путешествии, и появишься».

- **LeaderboardView.tsx:54-89** — Top-20 жёстко, без пагинации и «найти меня». Юзер на 25-м никогда не видит себя. «… ты на #87» внизу.

- **LeaderboardView.tsx:62-70** — `display_name` без аватара. Холодно. Добавить эмодзи-аватар.

### NICE-TO-HAVE

- Нет периодизации (неделя/месяц/всё). Сейчас «за всё время» — единственный режим.

---

## HallView

### CRITICAL

- **HallView.tsx:1147-1175 (DiscussCuratedItem.submit)** — `Promise.all([postInsight, postHallMessage])`. Если первая ок, вторая упала — состояние полупустое (инсайт в профиле, в чате нет). Обработать частичный сбой: «Опубликовано в профиль, но не в чат. Повторить?».

- **HallView.tsx:553** — `m.is_mine ? styles.chatMsgMine : ''` — при polling без флага `is_mine` сообщение перестаёт быть «моим» визуально. Гарантировать сохранение флага.

### IMPORTANT

- **HallView.tsx:506-514** — `chatDelete (×)` без confirm. Случайный тап = сообщение пропало.

- **HallView.tsx:451** — `POLL_INTERVAL_MS = 5000` — много трафика для мобильного. Backoff (увеличить интервал при отсутствии новых) или SSE/WebSocket.

- **HallView.tsx:1115-1132** — все Collapse-секции свёрнуты по умолчанию. «Инсайты по аспекту» (самая ценная вкладка) тоже скрыта. Открыть её по умолчанию.

- **HallView.tsx:944** — «Будь первым» — продающий тон. «Никто ещё не задавал вопросов — задай свой».

- **HallView.tsx:861** — `is_best` фон `rgba(179,157,219,0.05)` хардкод. Не учитывает accent холла. `var(--accent)`.

- **HallView.tsx:534-536** — placeholder textarea меняется в зависимости от `sendKeyMode`. Длинно, на узком обрезается. Сократить + hint снизу.

### NICE-TO-HAVE

- **HallView.tsx:198-200** — заголовок «{ASPECT_DISPLAY_KEY[aspect]} · {meta.name}» — на iPhone SE «БС · Белая Сенсорика» режется. Responsive.
- **HallView.tsx:1019** — «N инсайтов · M реакций» — нет склонения.
- **HallView.tsx:281-407 (CanonBlock)** — при смене seed перевыбирает рандом без fade. Резко.

---

## DMView

### CRITICAL

- **DMView.tsx:215-228** — нет индикатора «прочитано». `markDMThreadRead` вызывается, но в UI собеседник не видит, прочитал ли его юзер. Добавить `read_at` в bubble.

- **DMView.tsx:125-140** — `setSending(true)` после `if (!t || !activeId || sending) return`. Race на очень быстром дабл-тапе. `setSending(true)` сразу.

### IMPORTANT

- **DMView.tsx:115** — polling 5s, активного треда + списка тредов. Расход батареи. `document.visibilityState === 'visible'` чтобы pause при свёрнутой вкладке.

- **DMView.tsx:193-194** — Empty «Выбери диалог слева» — на мобиле «слева» бессмысленно. «Выбери диалог».

- **DMView.tsx:210** — «подпишитесь друг на друга» — без CTA «открыть его профиль и подписаться». Тупик.

- **DMView.tsx:271-280** — время сообщения: сегодня → «14:32», иначе «дата + время». Для вчера удобнее «вчера 14:32».

- **DMView.tsx:178** — длинный бэдж непрочитанных наезжает на имя. `flex-shrink: 0`.

### NICE-TO-HAVE

- Нет typing-indicator, нет lazy-load истории при 100+ сообщений.

---

## CoachView

### CRITICAL

- **CoachView.tsx:108-148** — стардаст списывается ДО запроса, откат через `await onJourneyChange`. Между этим юзер может закрыть вкладку → стардаст списан, ответа нет. Trust-based, риск реальный. Минимум — toast на ошибке.

- **CoachView.tsx:248-279** — ответ LLM без ограничения длины. 5000 символов = простыня. Collapse-by-default после ~600 + «развернуть».

### IMPORTANT

- **CoachView.tsx:174-183** — «Сегодня: 1/1 (стрик +3)» — юзеру неясно «1 осталось» или «1 использовано». «Сегодня использовано 1 из 4 (1 базовый + 3 от стрика)».

- **CoachView.tsx:262-265, 324** — `· Si` сырая латиница (см. cross-cutting #3).

- **CoachView.tsx:225-241** — `canCallFree=false` + `canBuyWithStardust=true` рендерит обе кнопки рядом. Disabled «Позвать» + светящийся стардаст = шум. Скрывать disabled.

- **CoachView.tsx:194-198** — `<option>Без фокус-аспекта</option>` длинно, на узком select обрезается. «— общий запрос —».

- **CoachView.tsx:55-62** — `PROMPT_TEMPLATE` как hint полезен новичку, лишний шум возвращающемуся. Collapse «Шаблон запроса ▼».

- **CoachView.tsx:281-300 (HistoryItem)** — свёрнутый `call.prompt` целиком в одну строку — длинный prompt выглядит ужасно. Trim до 80 символов.

### NICE-TO-HAVE

- **CoachView.tsx:171-172** — «Вызов ИИ-коуча» vs дашборд «🤖 ИИ-коуч» vs Header «Коуч». Унифицировать.

---

# Раздел 5. Системные (Settings, Admin)

## SettingsView

### CRITICAL

- **SettingsView.tsx:488-501** — `expected = (user.email || 'удалить').toLowerCase()`. Без email expected = `'удалить'`. Hint «Введи `удалить` и нажми «Удалить»» звучит как машинный перевод. «Чтобы подтвердить — введи слово `удалить`».

- **SettingsView.tsx:496-501** — при упавшем бэке `catch` ставит `busy=false`, но `err` может не выставиться явно. Юзер думает, что удалил, на самом деле нет. Гарантированно показать `err`.

### IMPORTANT

- **SettingsView.tsx:204** — «Если выключено — твой профиль не появляется в топе и недоступен по ссылке. Лайки и инсайты других юзеров остаются» — неясно, чужие реакции на МОИ инсайты или мои на чужие.

- **SettingsView.tsx:251-255** — «Один раз в день вечером, если есть что-то конкретное» — размытость. «Между 19:00 и 21:00 локального времени».

- **SettingsView.tsx:512** — «Удалит scores, journey, дневник и сам аккаунт. Бот-данные останутся» — не сказано, что необратимо. Прямо: «Восстановить нельзя».

- **SettingsView.tsx:264-302 (SendKeySection)** — две радио без savedAt feedback. Юзер выбрал — «сохранилось ли»? Toast.

### NICE-TO-HAVE

- **SettingsView.tsx:439-456** — экспорт JSON: показать размер дампа.

---

## AdminView (dev-only)

### IMPORTANT

- **AdminView.tsx:32-67** — нет глобального warn-banner типа «⚠ Здесь админ-инструменты, изменения влияют на других юзеров». Если случайно (impersonate) попал — пугающе.
- Опасные операции (delete user, impersonate, reset) — проверить, что везде typed-confirmation как в DangerSection.

---

# Положительное

Что сделано хорошо и при правках лучше не трогать без причины:

1. **IntroTour (Onboarding/IntroTour.tsx)** — переработанные 5 шагов с уникальными SVG-визуалами, `prefers-reduced-motion`, dots-навигация, `overflow-y: auto` на оверлее с явным комментарием почему. Видно что недавний рефактор онбординга снял основные ловушки.

2. **LoadingScreen** — брендированный лоадер, использует `prefers-reduced-motion`, цвета аспектов как спицы колеса. Превращает loading-time в продолжение онбординга, а не баннер «крутится круг».

3. **DailyReview** (DailyReview.tsx:153-184) — auto-scroll к раскрытому аккордеону с `requestAnimationFrame` x2, sticky save-bar, явный счётчик «N блоков · M практик». Видно что мобильный UX продумывали отдельно.

4. **Teaser-механика для locked-блоков аспекта** (AspectsView.tsx:712-724 + `teaseBlockData` в blocks.ts) — юзер не упирается в стену, видит обрезанный фрагмент + силуэт + явный «откроется на L1». Мотивация + информация.

5. **DiscoverMore** (DashboardView) — conditional-show карточек: появляется когда юзер ещё не сделал X, пропадает после dismiss. Чистый Layer 3 без надоедливости.

6. **Анкета как 3-проходный flow** (SurveyChoice → SurveyScreen → SurveyInsight) — разбиение длинного оценочного процесса на короткие сессии с draft-сохранением и явным обещанием будущей пользы. Юзер видит дорогу.

7. **TasksScreen + handleScriptAction** — петля «отложить → попало в активные → выполнил с обязательным комментарием» закрыта. Нет «потерянных» состояний.

8. **Архитектурно**: разделение per-aspect state (`state.aspects[X].messages`), Optimistic locking (`saveStateGuarded`), append-only журнал прогресса (`journey_events`) — это нижний слой, на который надёжно ложится UX-рефакторинг.

---

# Что делать первым (предлагаемый порядок)

1. **Cross-cutting #1 — safe-area** (один проход по `App.module.css`, `AuthModal.module.css`, `IntroTour.module.css`, `Header.module.css`, sticky `DailyReview.daySaveBar`). Самый широкий критический риск.

2. **Cross-cutting #3 — латинские ключи в UI** (быстрый sed-pass: `{aspect}` / `{key}` / `{it.aspect}` → `{ASPECT_DISPLAY_KEY[...]}`). Бьёт по конвенции, режет глаз везде.

3. **Destructive actions confirm** — `JourneyProfile.handleReset` (стирает весь journey без warn), TasksScreen «Удалить», HallView «×», DiaryView delete, ProfileView shield-activate, SettingsView delete-account error-handling.

4. **Race на double-click** — `handleScriptAction` / `handleSend` / `DMView.send` / `AuthModal.submit`. Один паттерн `isProcessing` на каждый.

5. **Тач-таргеты <44px** — Avatar, closeBtn, backBtn, info-btn, bell, Hint-close. Один проход по `.module.css` файлам.

6. **window.confirm/alert** → custom-модал — AspectsView, HabitSection, ProfileView, Header.

7. Дальше — секционно по приоритету.
