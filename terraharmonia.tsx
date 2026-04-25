import { useState, useEffect, useRef, useCallback } from "react";

const ONBOARDING = [
  {
    id: "ob1",
    text: `🪐 Привет, Исследователь!\n\nЭто бот, который поможет тебе лучше узнать себя, сделать полный чек-ап своей жизни и стать осознанным капитаном корабля, на котором ты бороздишь свою судьбу!\n\nПредлагаю посмотреть на свою жизнь как на игру. Я помогу освоиться, разобраться в навыках и заданиях — и вместе мы создадим твой дальнейший путь.`,
    button: "🎮 Хочу поиграть!",
  },
  {
    id: "ob2",
    text: `Я — СКБ, коуч-бот. Помогаю составить соционическое колесо баланса и коучить тебя на пути к счастливой жизни.\n\n✨ Мои принципы:\n\n🔍 Осознание — глубокое знакомство с 8 ключевыми сферами жизни\n\n⚖️ Балансировка — выявление сильных сторон и зон роста\n\n🧬 Синтез — соционика + психология + коучинг в одном инструменте`,
    button: "Интересно, что дальше →",
  },
  {
    id: "ob3",
    text: `📋 Вот наш план:\n\n📖 Немного психологии — буду рассказывать о том, что умеет твоя психика\n\n❓ Вопросики — задаю вопросы, чтобы вызвать у тебя инсайты\n\n🏋️ Упражнения — задания на внимание, чтобы осваивать способности личности\n\n🗺️ Карта целей — твоя карта жизни, которую будешь наполнять`,
    button: "Рассказывай! →",
  },
  {
    id: "ob4",
    text: `🌍 Соционика + Колесо Баланса: в чём связь?\n\nПо Юнгу, в психике 4 базовые функции:\n• Сенсорика — восприятие через органы чувств\n• Интуиция — восприятие идей и возможностей\n• Логика — решения умом\n• Этика — решения сердцем\n\nКаждая функция бывает направлена вовнутрь (белая) или вовне (чёрная) — так получается 8 аспектов = 8 сфер жизни.\n\nДля курса знать свой тип не нужно — развиваем все 8 сфер!`,
    button: "🐉 Доставай сферы жизни!",
  },
];

const ASPECT_INTRO = [
  {
    id: "ai1",
    text: `🪐 Добро пожаловать на планету Белой Сенсорики — Terra Harmonia!\n\nТы ступил на землю, где правят ощущения, комфорт и забота о теле. Здесь нет спешки и гонки за результатами. Здесь важно научиться чувствовать себя настоящего.\n\nТвоя миссия — пройти путь от наблюдателя до Мастера Гармонии. Впереди 4 уровня, каждый откроет новые грани твоего тела и пространства.`,
    button: "Далее →",
  },
  {
    id: "ai2",
    text: `🔍 Уровень 0: «Первый контакт»\n\nЭто разведка. Ты будешь учиться замечать то, мимо чего обычно проходишь: сигналы тела, микро-дискомфорт, источники удовольствия. Никаких сложных действий — только наблюдение.\n\nГлавный инструмент сейчас — Дневник ощущений. Можно вести в заметках телефона или просто запоминать. Главное — начать замечать.\n\nГотов? Тогда поехали! 🚀`,
    button: "🌟 Начать путешествие!",
    xp: 10,
  },
];

const SCRIPTS = [
  { id: "T-1", type: "theory", order: 1, title: "Внутренний сканер", text: `📖 Что такое Белая Сенсорика?\n\nБелая Сенсорика (БС) — это часть психики, которая отвечает за восприятие информации изнутри тела. Это твой личный сканер, который постоянно задаёт вопросы: «Комфортно ли мне? Здоров ли я? Не устал ли? Гармонично ли это?»\n\n🚀 Метафора: Представь, что твоё тело — это космический корабль. БС — это приборная панель с датчиками топлива, температуры и давления. Если не смотреть на приборы, корабль однажды просто разобьётся.\n\nКогда БС развита, ты вовремя замечаешь усталость, чувствуешь, какая еда нужна, и умеешь создавать пространство, в котором восстанавливаются силы.`, xp: 5 },
  { id: "B-1", type: "question", order: 2, title: "Качество сна и отдыха", text: `❓ Вопрос на самооценку\n\nОцени от 1 до 10, насколько ты доволен качеством своего сна и отдыха за последнюю неделю.\n\n1 — постоянно не высыпаюсь, просыпаюсь разбитым\n10 — ложусь вовремя, сплю глубоко, просыпаюсь бодрым\n\nВведи число от 1 до 10 👇`, xp: 10, followUp: (ans) => `Ты оценил своё качество сна на ${ans}/10.\n\nЭто честный взгляд на себя — уже первый шаг к изменениям! 🌙` },
  { id: "U-1", type: "exercise", order: 3, title: "Сканирование тела за 3 минуты", text: `🏋️ Упражнение: Внутренний радар\n\nМы часто живём «головой», не замечая тело, пока оно не заболит. Это упражнение возвращает контакт.\n\n1️⃣ Сядь или ляг удобно, закрой глаза. Сделай три глубоких вдоха.\n\n2️⃣ Медленно веди внимание от макушки вниз: лицо → шея → плечи → руки → грудь → живот → спина → таз → ноги → стопы.\n\n3️⃣ Не оценивай — просто замечай: тепло, прохлада, покалывание, тяжесть, лёгкость.\n\nДлительность: ~3 минуты`, xp: 15 },
  { id: "S-1", type: "word", order: 4, title: "Слово дня: УЮТ", text: `💫 Слово дня\n\n✦ УЮТ ✦\n\nУют — это не про дизайнерские журналы и количество свечей. Это про диалог пространства с твоей нервной системой.\n\nУют — это когда среда говорит телу: «Ты в безопасности. Здесь можно расслабиться. Ты под защитой».\n\nИменно поэтому мы так по-разному чувствуем себя в разных домах: где-то не можем усидеть, а где-то засыпаем за 5 минут.\n\n🤔 Вопрос: В каком месте твоего дома ты чувствуешь себя по-настоящему уютно?`, xp: 5, stardust: 1 },
  { id: "R-1", type: "reflection", order: 5, title: "Итоги дня", text: `🪞 Рефлексия: Итоги дня\n\nДень на Terra Harmonia подходит к концу. Прежде чем идти дальше, сверься с картой ощущений.\n\n1. Какое одно телесное ощущение было самым ярким сегодня?\n\n2. Был ли момент, когда ты поймал себя на том, что существуешь «в голове», игнорируя тело?\n\n3. Если бы твоё тело могло сказать тебе спасибо — за что именно?\n\nНапиши пару слов или просто нажми «Пропустить» 👇`, xp: 10 },
  { id: "T-2", type: "theory", order: 6, title: "Тень и Дар БС", text: `📖 Две стороны медали\n\nУ каждой сферы психики есть два полюса — теневое проявление (через страх) и зрелое (через любовь).\n\n🌑 Тень БС — это либо полное игнорирование тела (работа на износ, недосып), либо гипертрофированная зацикленность на нём (ипохондрия, страх малейшего дискомфорта).\n\nТень БС похожа на радиоприёмник, поймавший только помехи: вы либо не слышите музыку вообще, либо слышите только шипение.\n\n✨ Дар БС — это когда ты слышишь своё тело ясно, как любимую мелодию, и знаешь, когда сделать громче (активность), а когда тише (отдых).`, xp: 5 },
  { id: "B-2", type: "question", order: 7, title: "Контакт с телом", text: `❓ Вопрос на самооценку\n\nОцени от 1 до 10, насколько хорошо ты сейчас слышишь сигналы своего тела.\n\n1 — вообще не понимаю, голоден я или тревожен, устал или скучно\n10 — чётко различаю оттенки ощущений, сразу понимаю, что нужно телу\n\nВведи число от 1 до 10 👇`, xp: 10, followUp: (ans) => `Контакт с телом на ${ans}/10.\n\n${parseInt(ans) <= 4 ? "Именно здесь живёт твой главный потенциал роста! Всё впереди 🌱" : parseInt(ans) <= 7 ? "Хороший базовый контакт! Курс поможет его углубить 🎯" : "Ты уже хорошо слышишь себя. Теперь научимся действовать тоньше ✨"}` },
  { id: "U-2", type: "exercise", order: 8, title: "Аудит комфорта", text: `🏋️ Упражнение: Три плюса и три минуса\n\nМы привыкаем к дискомфорту и перестаём его замечать, хотя он постоянно сливает нашу энергию.\n\n1️⃣ Прямо сейчас оглядись в комнате, где ты находишься.\n\n2️⃣ Найди 3 вещи, которые создают микро-дискомфорт (торчащая ручка, яркий свет, неудобный стул).\n\n3️⃣ Найди 3 вещи, которые дарят микро-удовольствие (мягкий плед, приятный запах, красивый вид).\n\n⏱️ Длительность: ~5 минут на наблюдение`, xp: 15 },
  { id: "S-2", type: "word", order: 9, title: "Слово дня: КАЧЕСТВО", text: `💫 Слово дня\n\n✦ КАЧЕСТВО ✦\n\nДля Белой Сенсорики качество — это не соответствие ГОСТу. Это про ощущение «в самый раз».\n\nКачественная еда — та, после которой легко и приятно. Качественная одежда — та, которую не замечаешь на теле. Качественный отдых — после которого не хочется «отдохнуть от отдыха».\n\nКачество определяется не ценником, а откликом в теле.\n\n🤔 Вспомни что-то из своей жизни, что можешь назвать «качественным». Что ты чувствуешь, когда думаешь об этом?`, xp: 5, stardust: 1 },
  { id: "R-2", type: "reflection", order: 10, title: "Итоги уровня", text: `🪞 Рефлексия: Итоги уровня\n\nТы прошёл важный этап исследования Terra Harmonia. Самое время оглянуться назад.\n\n1. Что нового ты узнал о своём теле за эти дни?\n\n2. Какое упражнение или ритуал оказался самым полезным?\n\n3. Что из нового опыта хочешь оставить в своей повседневности?\n\nНапиши что-нибудь или нажми «Пропустить» 👇`, xp: 10 },
  { id: "T-3", type: "theory", order: 11, title: "Архетип Целитель", text: `📖 Хранитель здоровья\n\nЗрелый архетип БС — это Целитель. Тот, кто глубоко понимает природу тела и умеет восстанавливать баланс.\n\nЭто не про врачебный диплом, а про внутреннее знание: какой чай заварить, когда грустно, когда проветрить комнату, а когда укутаться в плед.\n\n🌱 Метафора: Целитель — это садовник, который не дёргает растение за листья, чтобы оно росло быстрее, а создаёт плодородную почву, вовремя поливает и убирает сорняки.\n\nТы начинаешь замечать, что относишься к телу не как к инструменту, а как к партнёру, с которым договариваешься.`, xp: 5 },
  { id: "B-3", type: "question", order: 12, title: "Комфорт в пространстве", text: `❓ Вопрос на самооценку\n\nОцени от 1 до 10, насколько твоё текущее пространство (дом, рабочее место) поддерживает тебя.\n\n1 — хаос, раздражает, не могу расслабиться\n10 — каждая деталь радует, прихожу домой и выдыхаю\n\nВведи число от 1 до 10 👇`, xp: 10, followUp: (ans) => `Комфорт пространства — ${ans}/10.\n\n${parseInt(ans) <= 4 ? "Пространство сильно влияет на нас. Даже одно маленькое изменение может всё переменить 🏡" : parseInt(ans) <= 7 ? "Есть хорошая база! Подумай, одна какая деталь сделает его ещё лучше? 🔮" : "Ты создал себе место силы — это настоящее искусство! ✨"}` },
  { id: "U-3", type: "exercise", order: 13, title: "Осознанный глоток", text: `🏋️ Упражнение: Вкус момента\n\nЭто микро-версия осознанного питания. Её можно делать даже в офисе.\n\n1️⃣ Возьми любую жидкость — чай, кофе, воду.\n\n2️⃣ Сделай глоток, но не проглатывай сразу. Подержи во рту 2-3 секунды.\n\n3️⃣ Почувствуй температуру, текстуру, оттенки вкуса. Как жидкость проходит по языку, нёбу, горлу. Только потом глотай.\n\n⚡ 1 глоток = 10 секунд осознанности\n\nВыполни прямо сейчас!`, xp: 15 },
  { id: "S-3", type: "word", order: 14, title: "Слово дня: НАСЛАЖДЕНИЕ", text: `💫 Слово дня\n\n✦ НАСЛАЖДЕНИЕ ✦\n\nВ теневом проявлении наслаждение — это «запретный плод» или «заедание стресса». В зрелом — это искусство присутствия в моменте.\n\nНаслаждаться можно не только тортом или массажем, но и тем, как струится вода в душе, как пахнет утренний кофе, как солнце греет щеку.\n\nЭто способность сказать «да» тому, что уже есть здесь и сейчас.\n\n🤔 Какое самое простое, почти бесплатное наслаждение ты разрешаешь себе без чувства вины?`, xp: 5, stardust: 1 },
  { id: "R-3", type: "reflection", order: 15, title: "Намерение на завтра", text: `🪞 Рефлексия: Намерение на завтра\n\nЗавтра ты продолжишь исследование. Давай создадим мостик в новый день.\n\n1. За каким сигналом тела хочешь внимательнее следить завтра?\n\n2. Какое маленькое сенсорное удовольствие хочешь себе подарить?\n\n3. Сформулируй одной фразой:\n«Завтра моё тело для меня — это...»\n\nНапиши своё намерение 🌙`, xp: 10 },
];

const LEVEL_COMPLETE = {
  text: `🎉 Поздравляю, Исследователь!\n\nТы успешно завершил Уровень 0 «Первый контакт» на планете Terra Harmonia!\n\nЕщё недавно сигналы тела были для тебя загадкой, а теперь ты научился их замечать и понимать.\n\n🗝️ Ты открыл артефакт: «Ключ к следующему уровню»\n\nСледующие уровни находятся в разработке — они появятся скоро! А пока продолжай применять то, что уже узнал в повседневной жизни 🌱`,
};

const SCRIPT_TYPE_CONFIG = {
  theory:     { color: "#4f9eff", bg: "rgba(79,158,255,.12)", label: "Теория", icon: "📖" },
  question:   { color: "#f59e0b", bg: "rgba(245,158,11,.12)", label: "Вопрос", icon: "❓" },
  exercise:   { color: "#10b981", bg: "rgba(16,185,129,.12)", label: "Упражнение", icon: "🏋️" },
  word:       { color: "#8b5cf6", bg: "rgba(139,92,246,.12)", label: "Слово дня", icon: "💫" },
  reflection: { color: "#ec4899", bg: "rgba(236,72,153,.12)", label: "Рефлексия", icon: "🪞" },
};

const DEFAULT_STATE = {
  screen: "onboarding",
  onboardingStep: 0,
  messages: [],
  xp: 0,
  stardust: 0,
  streak: 0,
  totalCompleted: 0,
  currentScriptIndex: 0,
  lastActiveDate: null,
  completedScripts: [],
  awaitingInput: null,
  currentScriptId: null,
};

const todayStr = () => new Date().toISOString().slice(0, 10);

function calcStreak(s) {
  const t = todayStr();
  if (!s.lastActiveDate) return 1;
  if (s.lastActiveDate === t) return s.streak;
  const diff = Math.round((new Date(t) - new Date(s.lastActiveDate)) / 86400000);
  return diff === 1 ? s.streak + 1 : 1;
}

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800&family=Raleway:wght@700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #080c12; --surface: #0d1320; --surface2: #111927; --surface3: #16213a;
    --border: rgba(255,255,255,.07); --text: #e2eaf8; --muted: #4a5878;
    --blue: #4f9eff; --teal: #5ecfca; --amber: #f4a261; --purple: #9b72f4;
    --green: #52d18a; --pink: #f06ab3; --yellow: #fbbf24;
  }
  html, body, #root { height: 100%; }
  body { background: var(--bg); color: var(--text); font-family: 'Nunito', sans-serif; font-size: 15px; line-height: 1.6; -webkit-font-smoothing: antialiased; }
  .shell { max-width: 420px; height: 100dvh; margin: 0 auto; display: flex; flex-direction: column; background: var(--bg); position: relative; overflow: hidden; }
  .stars { position: absolute; inset: 0; pointer-events: none; z-index: 0; background-image: radial-gradient(1px 1px at 15% 25%, rgba(255,255,255,.18) 0%, transparent 100%), radial-gradient(1px 1px at 65% 10%, rgba(255,255,255,.14) 0%, transparent 100%), radial-gradient(1px 1px at 85% 55%, rgba(255,255,255,.12) 0%, transparent 100%), radial-gradient(1px 1px at 30% 80%, rgba(255,255,255,.1) 0%, transparent 100%), radial-gradient(1px 1px at 90% 30%, rgba(255,255,255,.15) 0%, transparent 100%), radial-gradient(300px 300px at 80% 0%, rgba(79,158,255,.07) 0%, transparent 60%), radial-gradient(300px 300px at 10% 100%, rgba(94,207,202,.05) 0%, transparent 60%); }
  .topbar { display: flex; align-items: center; gap: 12px; padding: 14px 18px 12px; background: rgba(13,19,32,.95); border-bottom: 1px solid var(--border); position: relative; z-index: 10; backdrop-filter: blur(12px); flex-shrink: 0; }
  .topbar-avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #1e3a5f 0%, #2d1b5e 100%); display: flex; align-items: center; justify-content: center; font-size: 20px; border: 2px solid rgba(79,158,255,.3); flex-shrink: 0; position: relative; }
  .topbar-avatar::after { content: ''; position: absolute; bottom: 1px; right: 1px; width: 9px; height: 9px; border-radius: 50%; background: var(--green); border: 2px solid var(--bg); }
  .topbar-info { flex: 1; }
  .topbar-name { font-weight: 800; font-size: 15px; line-height: 1.2; font-family: 'Raleway', sans-serif; }
  .topbar-status { font-size: 11px; color: var(--muted); }
  .topbar-xp { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .xp-badge { display: flex; align-items: center; gap: 4px; background: rgba(251,191,36,.12); border: 1px solid rgba(251,191,36,.25); color: var(--yellow); border-radius: 100px; padding: 3px 10px; font-size: 11px; font-weight: 700; }
  .streak-badge { display: flex; align-items: center; gap: 3px; color: var(--amber); font-size: 11px; font-weight: 600; }
  .nav { display: flex; border-top: 1px solid var(--border); background: rgba(13,19,32,.97); position: relative; z-index: 10; flex-shrink: 0; backdrop-filter: blur(12px); }
  .nav-btn { flex: 1; padding: 10px 4px 8px; display: flex; flex-direction: column; align-items: center; gap: 3px; background: none; border: none; cursor: pointer; font-family: 'Nunito', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); transition: color .2s; }
  .nav-btn.active { color: var(--blue); }
  .nav-btn-icon { font-size: 20px; line-height: 1; }
  .nav-btn.active .nav-btn-icon { filter: drop-shadow(0 0 6px rgba(79,158,255,.5)); }
  .chat-scroll { flex: 1; overflow-y: auto; padding: 16px 14px 8px; position: relative; z-index: 1; scroll-behavior: smooth; }
  .chat-scroll::-webkit-scrollbar { width: 0; }
  .msg { display: flex; gap: 8px; margin-bottom: 14px; animation: fadeUp .3s ease; }
  .msg.user { flex-direction: row-reverse; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
  .msg-avatar { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, #1e3a5f, #2d1b5e); display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; margin-top: 2px; border: 1px solid rgba(79,158,255,.2); }
  .msg-bubble { max-width: 82%; padding: 11px 14px; border-radius: 18px; font-size: 14px; line-height: 1.65; white-space: pre-wrap; position: relative; }
  .msg-bubble.bot { background: var(--surface2); border: 1px solid var(--border); border-top-left-radius: 4px; color: var(--text); }
  .msg-bubble.user { background: linear-gradient(135deg, #1a3548, #1e2f4a); border: 1px solid rgba(79,158,255,.2); border-top-right-radius: 4px; color: var(--blue); font-weight: 600; }
  .script-card { background: var(--surface2); border: 1px solid var(--border); border-radius: 18px; border-top-left-radius: 4px; overflow: hidden; max-width: 88%; animation: fadeUp .3s ease; margin-bottom: 14px; }
  .script-card-header { padding: 9px 14px 8px; display: flex; align-items: center; gap: 7px; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; border-bottom: 1px solid var(--border); }
  .script-card-body { padding: 13px 14px; font-size: 14px; line-height: 1.7; white-space: pre-wrap; }
  .script-card-xp { padding: 7px 14px 10px; display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--muted); }
  .typing-indicator { display: flex; gap: 8px; margin-bottom: 14px; animation: fadeUp .3s ease; }
  .typing-dots { background: var(--surface2); border: 1px solid var(--border); border-radius: 18px; border-top-left-radius: 4px; padding: 12px 16px; display: flex; gap: 4px; align-items: center; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muted); animation: bounce .9s infinite ease-in-out; }
  .dot:nth-child(2) { animation-delay: .15s; }
  .dot:nth-child(3) { animation-delay: .3s; }
  @keyframes bounce { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-5px); } }
  .btn-row { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 14px; padding: 0 14px; }
  .btn { padding: 10px 18px; border-radius: 100px; border: 1.5px solid; cursor: pointer; font-family: 'Nunito', sans-serif; font-size: 13px; font-weight: 700; transition: all .15s; white-space: nowrap; display: flex; align-items: center; gap: 6px; background: none; }
  .btn:active { transform: scale(.97); }
  .btn-primary { background: var(--blue); border-color: var(--blue); color: #fff; box-shadow: 0 4px 16px rgba(79,158,255,.3); }
  .btn-outline { border-color: rgba(255,255,255,.12); color: var(--muted); }
  .btn-outline:hover { border-color: rgba(255,255,255,.25); color: var(--text); }
  .btn-teal { background: rgba(94,207,202,.12); border-color: rgba(94,207,202,.35); color: var(--teal); }
  .btn-green { background: rgba(82,209,138,.12); border-color: rgba(82,209,138,.35); color: var(--green); }
  .btn-amber { background: rgba(244,162,97,.12); border-color: rgba(244,162,97,.35); color: var(--amber); }
  .btn-purple { background: rgba(155,114,244,.12); border-color: rgba(155,114,244,.35); color: var(--purple); }
  .btn-pink { background: rgba(236,72,153,.1); border-color: rgba(236,72,153,.4); color: var(--pink); }
  .input-area { padding: 10px 12px; background: rgba(13,19,32,.95); border-top: 1px solid var(--border); display: flex; gap: 8px; align-items: flex-end; position: relative; z-index: 10; flex-shrink: 0; backdrop-filter: blur(12px); }
  .input-field { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 20px; padding: 10px 16px; color: var(--text); font-family: 'Nunito', sans-serif; font-size: 14px; outline: none; resize: none; max-height: 100px; min-height: 42px; transition: border-color .2s; line-height: 1.5; }
  .input-field::placeholder { color: var(--muted); }
  .input-field:focus { border-color: rgba(79,158,255,.4); }
  .send-btn { width: 42px; height: 42px; border-radius: 50%; background: var(--blue); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; transition: all .15s; flex-shrink: 0; box-shadow: 0 4px 12px rgba(79,158,255,.35); color: white; }
  .send-btn:disabled { background: var(--surface2); box-shadow: none; opacity: .5; }
  .send-btn:active { transform: scale(.93); }
  .profile-scroll { flex: 1; overflow-y: auto; padding: 20px 16px 20px; position: relative; z-index: 1; }
  .profile-scroll::-webkit-scrollbar { width: 0; }
  .profile-hero { background: linear-gradient(135deg, #0d1a30 0%, #1a0d3a 100%); border: 1px solid rgba(79,158,255,.15); border-radius: 20px; padding: 24px 20px; text-align: center; margin-bottom: 16px; position: relative; overflow: hidden; }
  .profile-hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(200px 200px at 50% -20%, rgba(79,158,255,.1) 0%, transparent 70%); pointer-events: none; }
  .profile-planet { font-size: 52px; margin-bottom: 10px; line-height: 1; }
  .profile-title { font-family: 'Raleway', sans-serif; font-size: 20px; font-weight: 800; margin-bottom: 4px; }
  .profile-subtitle { color: var(--muted); font-size: 13px; }
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
  .stat-card { background: var(--surface2); border: 1px solid var(--border); border-radius: 16px; padding: 16px 14px; text-align: center; }
  .stat-val { font-family: 'Raleway', sans-serif; font-size: 28px; font-weight: 800; line-height: 1.1; margin-bottom: 4px; }
  .stat-lbl { font-size: 11px; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .08em; }
  .progress-section { background: var(--surface2); border: 1px solid var(--border); border-radius: 16px; padding: 16px; margin-bottom: 16px; }
  .progress-title { font-weight: 700; font-size: 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
  .progress-bar-wrap { background: rgba(255,255,255,.05); border-radius: 100px; height: 8px; overflow: hidden; }
  .progress-bar { height: 100%; border-radius: 100px; background: linear-gradient(90deg, var(--blue), var(--teal)); transition: width .5s ease; }
  .progress-labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-top: 6px; }
  .achievements-section { background: var(--surface2); border: 1px solid var(--border); border-radius: 16px; padding: 16px; margin-bottom: 16px; }
  .achievements-title { font-weight: 700; font-size: 14px; margin-bottom: 12px; }
  .achievement-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 13px; }
  .achievement-item:last-child { border-bottom: none; }
  .ach-icon { font-size: 22px; width: 36px; text-align: center; flex-shrink: 0; }
  .ach-locked { opacity: .3; filter: grayscale(1); }
  .ob-dots { display: flex; gap: 6px; justify-content: center; margin-top: 12px; }
  .ob-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--border); transition: all .3s; }
  .ob-dot.active { width: 20px; background: var(--blue); }
  .lc-screen { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px 20px; position: relative; z-index: 1; text-align: center; }
  .lc-glow { font-size: 72px; margin-bottom: 20px; animation: pulse 2s infinite; filter: drop-shadow(0 0 20px rgba(251,191,36,.4)); }
  @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
  .lc-title { font-family: 'Raleway', sans-serif; font-size: 26px; font-weight: 800; margin-bottom: 10px; }
  .lc-card { background: var(--surface2); border: 1px solid var(--border); border-radius: 20px; padding: 20px; margin: 20px 0; text-align: left; width: 100%; }
  .lc-text { white-space: pre-wrap; font-size: 14px; line-height: 1.7; color: #94a3b8; }
  .reward-toast { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%); background: rgba(16,185,129,.15); border: 1px solid rgba(82,209,138,.4); color: var(--green); border-radius: 100px; padding: 8px 20px; font-size: 13px; font-weight: 700; animation: toastIn .4s ease; white-space: nowrap; z-index: 100; display: flex; align-items: center; gap: 8px; }
  @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(10px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
`;

function ScriptCard({ script }) {
  const cfg = SCRIPT_TYPE_CONFIG[script.type];
  return (
    <div className="script-card">
      <div className="script-card-header" style={{ background: cfg.bg, color: cfg.color }}>
        <span>{cfg.icon}</span><span>{cfg.label}</span>
        <span style={{ marginLeft: "auto", fontSize: 10, opacity: .6 }}>{script.id}</span>
      </div>
      <div className="script-card-body">{script.text}</div>
      <div className="script-card-xp">
        <span style={{ color: "#fbbf24" }}>⚡</span><span>+{script.xp} XP</span>
        {script.stardust > 0 && <><span style={{ marginLeft: 6, color: "#8b5cf6" }}>💫</span><span>+{script.stardust} Stardust</span></>}
      </div>
    </div>
  );
}

function ScriptButtons({ script, onAction }) {
  const act = (a) => onAction(a, script.id);
  if (script.type === "theory") return <div className="btn-row"><button className="btn btn-primary" onClick={() => act("next")}>Далее →</button><button className="btn btn-outline" onClick={() => act("next")}>⭐ В избранное</button></div>;
  if (script.type === "question") return <div className="btn-row"><button className="btn btn-amber" onClick={() => act("answer_number")}>✏️ Ответить (1–10)</button><button className="btn btn-outline" onClick={() => act("next")}>Напомнить позже</button></div>;
  if (script.type === "exercise") return <div className="btn-row"><button className="btn btn-green" onClick={() => act("done")}>✅ Взял задание</button><button className="btn btn-teal" onClick={() => act("complete_exercise")}>Выполнил прямо сейчас!</button><button className="btn btn-outline" onClick={() => act("next")}>Выполню позже</button></div>;
  if (script.type === "word") return <div className="btn-row"><button className="btn btn-purple" onClick={() => act("next")}>💫 Подумал об этом</button><button className="btn btn-outline" onClick={() => act("next")}>Далее →</button></div>;
  if (script.type === "reflection") return <div className="btn-row"><button className="btn btn-pink" onClick={() => act("answer_text")}>✍️ Ответить</button><button className="btn btn-outline" onClick={() => act("skip")}>Пропустить</button></div>;
  return null;
}

export default function App() {
  const [state, setState] = useState(DEFAULT_STATE);
  const [inputVal, setInputVal] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [toast, setToast] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const chatRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("terra_state");
        if (res?.value) setState(JSON.parse(res.value));
      } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    (async () => { try { await window.storage.set("terra_state", JSON.stringify(state)); } catch {} })();
  }, [state, loaded]);

  useEffect(() => {
    if (chatRef.current) setTimeout(() => chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }), 80);
  }, [state.messages, isTyping]);

  const showToast = useCallback((msg) => { setToast(msg); setTimeout(() => setToast(null), 2800); }, []);

  const addBotMessage = useCallback((text, delay = 400) => new Promise((resolve) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setState(s => ({ ...s, messages: [...s.messages, { id: Date.now() + Math.random(), role: "bot", text }] }));
      resolve();
    }, delay);
  }), []);

  const addUserMessage = useCallback((text) => {
    setState(s => ({ ...s, messages: [...s.messages, { id: Date.now() + Math.random(), role: "user", text }] }));
  }, []);

  const awardXP = useCallback((xp, stardust = 0) => {
    if (xp <= 0 && stardust <= 0) return;
    setState(s => ({
      ...s, xp: s.xp + xp, stardust: s.stardust + stardust,
      streak: calcStreak(s), totalCompleted: s.totalCompleted + 1,
      lastActiveDate: todayStr(),
      completedScripts: [...s.completedScripts, s.currentScriptId],
    }));
    const parts = [];
    if (xp > 0) parts.push(`+${xp} XP`);
    if (stardust > 0) parts.push(`+${stardust} 💫`);
    showToast("✨ " + parts.join("  "));
  }, [showToast]);

  const deliverScript = useCallback(async (index) => {
    const script = SCRIPTS[index];
    if (!script) { setState(s => ({ ...s, screen: "levelcomplete" })); return; }
    setState(s => ({ ...s, currentScriptIndex: index, currentScriptId: script.id, awaitingInput: null }));
  }, []);

  const handleOnboardingNext = useCallback(async () => {
    const step = state.onboardingStep;
    addUserMessage(ONBOARDING[Math.min(step, 3)]?.button || "Далее");
    if (step < 3) {
      await addBotMessage(ONBOARDING[step + 1].text, 700);
      setState(s => ({ ...s, onboardingStep: step + 1 }));
    } else if (step === 3) {
      await addBotMessage("🌟 Доступен аспект для начала:\n\n🤍 Белая Сенсорика — Terra Harmonia\nПланета здоровья, комфорта и уюта\n\nНажми, чтобы начать путешествие!", 900);
      setState(s => ({ ...s, onboardingStep: 4 }));
    } else if (step === 4) {
      addUserMessage("🤍 Белая Сенсорика");
      await addBotMessage(ASPECT_INTRO[0].text, 900);
      setState(s => ({ ...s, onboardingStep: 5 }));
    } else if (step === 5) {
      addUserMessage(ASPECT_INTRO[1].button);
      await addBotMessage(ASPECT_INTRO[1].text, 700);
      awardXP(10, 0);
      setState(s => ({ ...s, screen: "chat", onboardingStep: 6, currentScriptIndex: 0, currentScriptId: SCRIPTS[0].id }));
    }
  }, [state.onboardingStep, addBotMessage, addUserMessage, awardXP]);

  const handleScriptAction = useCallback(async (action, scriptId) => {
    const script = SCRIPTS.find(s => s.id === scriptId);
    if (!script) return;
    if (action === "next" || action === "done" || action === "skip") {
      if (action === "skip") addUserMessage("Пропустить");
      else if (action === "done") { addUserMessage("Взял задание ✓"); await addBotMessage("Задание взято! 💪 Выполни его сегодня и отметь результат.", 500); }
      else addUserMessage("Далее →");
      awardXP(script.xp, script.stardust || 0);
      setTimeout(() => deliverScript(state.currentScriptIndex + 1), 600);
    } else if (action === "answer_number") {
      setState(s => ({ ...s, awaitingInput: "number" }));
      if (inputRef.current) inputRef.current.focus();
    } else if (action === "answer_text") {
      setState(s => ({ ...s, awaitingInput: "text" }));
      if (inputRef.current) inputRef.current.focus();
    } else if (action === "complete_exercise") {
      addUserMessage("Выполнил! ✅");
      await addBotMessage("Отлично! Каждое маленькое действие — это шаг к большим переменам 🌱", 500);
      awardXP(script.xp, script.stardust || 0);
      setTimeout(() => deliverScript(state.currentScriptIndex + 1), 600);
    }
  }, [state.currentScriptIndex, addBotMessage, addUserMessage, awardXP, deliverScript]);

  const handleSend = useCallback(async () => {
    const val = inputVal.trim();
    if (!val) return;
    const script = SCRIPTS[state.currentScriptIndex];
    if (state.awaitingInput === "number") {
      const num = parseInt(val);
      if (isNaN(num) || num < 1 || num > 10) { await addBotMessage("Пожалуйста, введи число от 1 до 10 🙏", 400); return; }
      addUserMessage(val); setInputVal(""); setState(s => ({ ...s, awaitingInput: null }));
      if (script?.followUp) await addBotMessage(script.followUp(val), 700);
      else await addBotMessage(`Записал: ${val}/10 ✨`, 500);
      awardXP(script?.xp || 10, 0);
      setTimeout(() => deliverScript(state.currentScriptIndex + 1), 700);
    } else if (state.awaitingInput === "text") {
      addUserMessage(val); setInputVal(""); setState(s => ({ ...s, awaitingInput: null }));
      await addBotMessage("Спасибо за честный ответ! Это важная работа 🌟", 600);
      awardXP(script?.xp || 10, 0);
      setTimeout(() => deliverScript(state.currentScriptIndex + 1), 700);
    }
  }, [inputVal, state.awaitingInput, state.currentScriptIndex, addBotMessage, addUserMessage, awardXP, deliverScript]);

  const handleReset = useCallback(async () => {
    try { await window.storage.delete("terra_state"); } catch {}
    setState(DEFAULT_STATE);
  }, []);

  if (!loaded) return <><style>{styles}</style><div className="shell" style={{ alignItems: "center", justifyContent: "center" }}><div style={{ color: "var(--muted)", fontSize: 13 }}>Загрузка...</div></div></>;

  const currentScript = SCRIPTS[state.currentScriptIndex];
  const progress = Math.round((state.currentScriptIndex / SCRIPTS.length) * 100);

  return (
    <>
      <style>{styles}</style>
      <div className="shell">
        <div className="stars" />

        {/* ONBOARDING */}
        {state.screen === "onboarding" && <>
          <div className="topbar">
            <div className="topbar-avatar">🪐</div>
            <div className="topbar-info">
              <div className="topbar-name">Terra Harmonia</div>
              <div className="topbar-status">Коуч по Белой Сенсорике</div>
            </div>
          </div>
          <div className="chat-scroll" ref={chatRef}>
            <div className="msg">
              <div className="msg-avatar">🪐</div>
              <div className="msg-bubble bot">{ONBOARDING[0].text}</div>
            </div>
            {state.messages.map(m => (
              <div key={m.id} className={`msg ${m.role === "user" ? "user" : ""}`}>
                {m.role === "bot" && <div className="msg-avatar">🪐</div>}
                <div className={`msg-bubble ${m.role}`}>{m.text}</div>
              </div>
            ))}
            {isTyping && <div className="typing-indicator"><div className="msg-avatar">🪐</div><div className="typing-dots"><div className="dot" /><div className="dot" /><div className="dot" /></div></div>}
          </div>
          {!isTyping && (
            <div style={{ padding: "10px 14px 16px", flexShrink: 0 }}>
              {state.onboardingStep === 4
                ? <button className="btn btn-outline" style={{ width: "100%", marginBottom: 8, justifyContent: "center", borderColor: "rgba(155,114,244,.4)", color: "var(--purple)" }} onClick={handleOnboardingNext}>🤍 Белая Сенсорика — Terra Harmonia</button>
                : <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={handleOnboardingNext}>
                    {state.onboardingStep === 3 ? "🌍 Доставай сферы жизни!" : state.onboardingStep === 5 ? ASPECT_INTRO[1].button : ONBOARDING[Math.min(state.onboardingStep, 3)].button}
                  </button>
              }
              <div className="ob-dots">
                {[0,1,2,3,4,5].map(i => <div key={i} className={`ob-dot ${state.onboardingStep === i ? "active" : ""}`} />)}
              </div>
            </div>
          )}
        </>}

        {/* CHAT */}
        {state.screen === "chat" && <>
          <div className="topbar">
            <div className="topbar-avatar">🪐</div>
            <div className="topbar-info">
              <div className="topbar-name">Terra Harmonia</div>
              <div className="topbar-status">Уровень 0 · Первый контакт</div>
            </div>
            <div className="topbar-xp">
              <div className="xp-badge">⚡ {state.xp} XP</div>
              <div className="streak-badge">🔥 {state.streak} дн</div>
            </div>
          </div>
          <div className="chat-scroll" ref={chatRef}>
            {state.messages.map(m => (
              <div key={m.id} className={`msg ${m.role === "user" ? "user" : ""}`}>
                {m.role === "bot" && <div className="msg-avatar">🪐</div>}
                <div className={`msg-bubble ${m.role}`}>{m.text}</div>
              </div>
            ))}
            {isTyping && <div className="typing-indicator"><div className="msg-avatar">🪐</div><div className="typing-dots"><div className="dot" /><div className="dot" /><div className="dot" /></div></div>}
            {!isTyping && currentScript && !state.awaitingInput && <>
              <ScriptCard script={currentScript} />
              <ScriptButtons script={currentScript} onAction={handleScriptAction} />
            </>}
            {state.awaitingInput && <div className="msg"><div className="msg-avatar">🪐</div><div className="msg-bubble bot" style={{ opacity: .7, fontStyle: "italic", fontSize: 13 }}>{state.awaitingInput === "number" ? "Введи число от 1 до 10 👇" : "Напиши свой ответ 👇"}</div></div>}
          </div>
          {state.awaitingInput
            ? <div className="input-area">
                <textarea ref={inputRef} className="input-field" placeholder={state.awaitingInput === "number" ? "Число 1–10..." : "Твой ответ..."} value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} rows={1} />
                <button className="send-btn" onClick={handleSend} disabled={!inputVal.trim()}>↑</button>
              </div>
            : <div style={{ height: 0, flexShrink: 0 }} />
          }
        </>}

        {/* LEVEL COMPLETE */}
        {state.screen === "levelcomplete" && <>
          <div className="topbar">
            <div className="topbar-avatar">🪐</div>
            <div className="topbar-info"><div className="topbar-name">Terra Harmonia</div><div className="topbar-status">Уровень завершён!</div></div>
          </div>
          <div className="lc-screen">
            <div className="lc-glow">🏆</div>
            <div className="lc-title">Уровень 0 пройден!</div>
            <div style={{ color: "var(--muted)", fontSize: 14, marginBottom: 6 }}>Первый контакт установлен</div>
            <div className="lc-card"><div className="lc-text">{LEVEL_COMPLETE.text}</div></div>
            <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              {[["⚡ "+state.xp, "var(--yellow)", "Всего XP"], [state.totalCompleted, "var(--teal)", "Заданий"], ["💫 "+state.stardust, "var(--amber)", "Stardust"]].map(([v, c, l]) => (
                <div key={l} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 24, fontFamily: "Raleway", fontWeight: 800, color: c }}>{v}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>{l}</div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setState(s => ({ ...s, screen: "profile" }))}>📊 Посмотреть профиль</button>
          </div>
        </>}

        {/* PROFILE */}
        {state.screen === "profile" && <>
          <div className="topbar">
            <div className="topbar-avatar">🪐</div>
            <div className="topbar-info"><div className="topbar-name">Мой профиль</div><div className="topbar-status">Исследователь Terra Harmonia</div></div>
          </div>
          <div className="profile-scroll">
            <div className="profile-hero">
              <div className="profile-planet">🪐</div>
              <div className="profile-title">Белая Сенсорика</div>
              <div className="profile-subtitle">Terra Harmonia · Уровень 0</div>
            </div>
            <div className="stats-grid">
              {[["⚡ "+state.xp, "var(--yellow)", "Опыт XP"], ["🔥 "+state.streak, "var(--amber)", "Streak дней"], [state.totalCompleted, "var(--green)", "Заданий выполнено"], ["💫 "+state.stardust, "var(--purple)", "Stardust"]].map(([v, c, l]) => (
                <div key={l} className="stat-card"><div className="stat-val" style={{ color: c }}>{v}</div><div className="stat-lbl">{l}</div></div>
              ))}
            </div>
            <div className="progress-section">
              <div className="progress-title"><span>Прогресс Уровня 0</span><span style={{ color: "var(--blue)", fontSize: 13 }}>{state.currentScriptIndex}/{SCRIPTS.length}</span></div>
              <div className="progress-bar-wrap"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
              <div className="progress-labels"><span>Первый контакт</span><span>{progress}%</span></div>
            </div>
            <div className="achievements-section">
              <div className="achievements-title">🏅 Достижения</div>
              {[
                { icon: "🚀", name: "Первый шаг", desc: "Начал путешествие", done: state.xp > 0 },
                { icon: "📖", name: "Теоретик", desc: "Прочитал первую теорию", done: state.completedScripts.includes("T-1") },
                { icon: "❓", name: "Честный взгляд", desc: "Ответил на вопрос самооценки", done: state.completedScripts.includes("B-1") },
                { icon: "🏋️", name: "Практик", desc: "Выполнил первое упражнение", done: state.completedScripts.includes("U-1") },
                { icon: "💫", name: "Коллекционер слов", desc: "Собрал 3 слова дня", done: state.stardust >= 3 },
                { icon: "🔥", name: "На огне", desc: "Streak 3 дня подряд", done: state.streak >= 3 },
                { icon: "🏆", name: "Мастер гармонии", desc: "Завершил Уровень 0", done: state.currentScriptIndex >= SCRIPTS.length },
              ].map((a, i) => (
                <div key={i} className={`achievement-item ${!a.done ? "ach-locked" : ""}`}>
                  <div className="ach-icon">{a.icon}</div>
                  <div><div style={{ fontWeight: 700, fontSize: 13 }}>{a.name}</div><div style={{ fontSize: 11, color: "var(--muted)" }}>{a.desc}</div></div>
                  {a.done && <div style={{ marginLeft: "auto", color: "var(--green)", fontSize: 16 }}>✓</div>}
                </div>
              ))}
            </div>
            {state.currentScriptIndex < SCRIPTS.length && (
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }} onClick={() => setState(s => ({ ...s, screen: "chat" }))}>▶ Продолжить путешествие</button>
            )}
            <button className="btn btn-outline" style={{ width: "100%", justifyContent: "center", fontSize: 12, color: "var(--muted)", marginTop: 4 }} onClick={handleReset}>↺ Начать заново</button>
          </div>
        </>}

        {/* BOTTOM NAV */}
        {(state.screen === "chat" || state.screen === "profile" || state.screen === "levelcomplete") && (
          <div className="nav">
            <button className={`nav-btn ${state.screen !== "profile" ? "active" : ""}`} onClick={() => setState(s => ({ ...s, screen: s.screen === "levelcomplete" ? "levelcomplete" : "chat" }))}>
              <div className="nav-btn-icon">🪐</div>Путешествие
            </button>
            <button className={`nav-btn ${state.screen === "profile" ? "active" : ""}`} onClick={() => setState(s => ({ ...s, screen: "profile" }))}>
              <div className="nav-btn-icon">👤</div>Профиль
            </button>
          </div>
        )}

        {toast && <div className="reward-toast">{toast}</div>}
      </div>
    </>
  );
}
