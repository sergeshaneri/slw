import { useEffect, useRef, useState, useCallback } from 'react'
import { postStepCompleted, chooseHabit } from '../../api/client'
import { ASPECT_COLORS, ASPECT_DATA } from '../../data/aspects'
import { ONBOARDING } from '../../data/journey/onboarding'
import { getJourney } from '../../data/journey/registry'
import {
  calcSurveyResult, calcSiScoreFromSkills, getSkillProgress,
  findFirstUnansweredSurveyIndex, ALL_SKILL_IDS, SURVEY_BLOCK_KEYS, SURVEYS,
  getNextPass, getStatementsForPass, getStatementsForFullRange,
  buildSurveyStatements, getCompletedPasses,
  ARCHETYPE_KEYS, SKILL_TREE
} from '../../data/journey/skills'
import { resolveSurvey, isNeSkill, isNiSkill, isTeSkill, isTiSkill, isFiSkill, isSeSkill } from '../../data/journey/skills/resolve'
import {
  calcNeScoreFromSkills, getNeSkillProgress,
  ALL_SKILL_IDS as NE_SKILL_IDS,
} from '../../data/journey/skills/ne-skills'
import {
  calcNiScoreFromSkills, getNiSkillProgress,
  ALL_SKILL_IDS as NI_SKILL_IDS,
} from '../../data/journey/skills/ni-skills'
import {
  calcTeScoreFromSkills, getTeSkillProgress,
  ALL_SKILL_IDS as TE_SKILL_IDS,
} from '../../data/journey/skills/te-skills'
import {
  calcTiScoreFromSkills, getTiSkillProgress,
  ALL_SKILL_IDS as TI_SKILL_IDS,
} from '../../data/journey/skills/ti-skills'
import {
  calcFiScoreFromSkills, getFiSkillProgress,
  ALL_SKILL_IDS as FI_SKILL_IDS,
} from '../../data/journey/skills/fi-skills'
import {
  calcSeScoreFromSkills, getSeSkillProgress,
  ALL_SKILL_IDS as SE_SKILL_IDS,
} from '../../data/journey/skills/se-skills'
import {
  ALL_SKILL_IDS as FE_SKILL_IDS,
  SURVEYS_FE,
  calcFeScoreFromSkills,
  getSkillProgress as getFeSkillProgress
} from '../../data/journey/fe-skills'
import Onboarding from './Onboarding'
import Chat from './Chat'
import LevelComplete from './LevelComplete'
import JourneyProfile from './JourneyProfile'
import TasksScreen from './TasksScreen'
import SurveyScreen from './SurveyScreen'
import SurveyChoice from './SurveyChoice'
import SurveyInsight from './SurveyInsight'
import SkillTree from './SkillTree'
import NeSkillTree from './NeSkillTree'
import NiSkillTree from './NiSkillTree'
import FeSkillTree from './FeSkillTree'
import TeSkillTree from './TeSkillTree'
import TiSkillTree from './TiSkillTree'
import FiSkillTree from './FiSkillTree'
import SeSkillTree from './SeSkillTree'
import SkillDetail from './SkillDetail'
import SkillTraits from './SkillTraits'
import FeCoreOverview from './FeCoreOverview'
import { getSkillContent, getUnlockedSkillLevel } from '../../data/skills'
import PlanetMap from './PlanetMap'
import AdminPanel from './AdminPanel'
import AdminSkillsEditor from './AdminSkillsEditor'
import Hint from '../Onboarding/Hint'
import styles from './JourneyView.module.css'

// Маленькая обёртка-хинт для skill-tree экранов (8 типов деревьев — не хочется
// внедряться в каждый отдельно). Хинт показывается ОДИН раз на любом дереве.
function SkillTreeIntroHint({ user }) {
  return (
    <div style={{ padding: '12px 16px 0' }}>
      <Hint id="skill-tree-intro" user={user}>
        Анкета 5 вопросов × 3 прохода. Можно идти по поверхности или углубляться. Колесо растёт по мере прокачки.
      </Hint>
    </div>
  )
}

// Версия контента уровня. При несовпадении с сохранённой в state
// чат-история сбрасывается, чтобы юзер увидел новые тексты с начала
// (статистика — XP/streak/totalCompleted — сохраняется).
//
// 3 — добавлен level в script-sообщения (для разрешения коллизий
//     ID между уровнями: T-1 в L0 ≠ T-1 в L1).
// 4 — переписан L1 «Карта и намерение» (25 шагов, 5×5, вопросы
//     формата B). Параллельно введён mode (core/pool), но он
//     совместим со старым state через спред DEFAULT_JOURNEY и
//     сам по себе бампа не требовал.
// 5 — прогрессивная анкета (5 вопросов × 3 прохода вместо 15 за
//     раз). state.skills[id] получил поля passes, insights[].
//     activeSurvey получил pass. Старые записи мигрируем в
//     migrateState (passes вычисляется по answers).
// 6 — анкеты вынесены из L0-чата (33 SURV-шага → отдельный
//     bs-l0-surveys.md, видны только через дерево навыков). B-1/2/3
//     перешли на open-text без слайдера, исчезли followUp-блоки.
//     Концепция `pool`/`mode` удалена. Старый state с mode='pool'
//     или индексом в pool — мигрируется со сбросом messages/
//     completedScripts/pendingTasks. state.skills сохраняется.
// 7 — добавлен L2 БС «Системы заботы»: 40 шагов core (8×5),
//     вопросы формата B (open-text). Также прошлись по L0/L1
//     и переименовали несколько шагов (Аудит комфорта → Что меня
//     окружает, и т.п.), убрали ID-метки из тела скриптов,
//     перевели «или проговорить» в обязательное «Запиши ответы».
// 8 — per-aspect рефакторинг state. Раньше currentLevel/messages/
//     currentScriptIndex/currentScriptId/awaitingInput/completedScripts/
//     pendingTasks были глобальными — теперь живут в state.aspects[aspect].
//     Это позволяет одному юзеру параллельно идти по БС и БЛ (и далее)
//     без коллизий. XP/streak/skills/stardust остаются глобальными.
//     При миграции с v<8 старые «плоские» поля помещаются в активный
//     аспект; чат сбрасывается (как при любом бампе CONTENT_VERSION).
// 9 — ревизия дерева навыков БС: 33 → 47 (7 слияний + 21 новый
//     навык). Слияния: scan→interoception, relax→balance,
//     aging→pain, env-quality→quality, env-design→ergonomics,
//     load→pause, library→pleasure. Старые id в state.skills
//     мигрируем через SKILL_ID_MIGRATION в migrateSkills (если
//     у юзера уже есть результат для нового id — старый
//     отбрасывается; иначе старый копируется под новым id).
//     Удалено 7 SURV-* шагов из bs-l0-surveys.md, добавлен 21 новый
//     SURV-34..54. Нумерация старых SURV-* оставлена с пропусками,
//     чтобы completedScripts существующих юзеров не сломались.
// 10 — добавлен аспект ЧЭ (Чёрная Этика, планета Passio Ignis):
//     L0 (15 шагов), L1 (25), L2 (40), L3 (стартовый — 20).
//     Регистрация в registry.js, новый файл aspects/che.js.
//     Контент в `che-l*.md`. Дерево навыков ЧЭ и анкеты пока не
//     интегрированы — будут добавлены отдельно. Существующие юзеры
//     получат сброс чат-истории по другим аспектам, но прогресс
//     XP/streak/skills сохранится.
// 11 — в L0 БС добавлены 3 универсальные анкеты (signals,
//     interoception, honesty) с подготовительным сообщением.
//     Эти 3 навыка вынесены в COMMON_BASE_SKILLS — они входят в
//     средний по каждому из 4 архетипов БС-колеса доп.слагаемыми.
//     Survey-карточки снова рендерятся в чат-ленте (Chat.jsx).
//     Старые архивные SURV из v6 не показываются благодаря бампу
//     (messages сбрасываются).
// 12 — добавлено колесо ЧЭ (CheSkillTree): 34 навыка по 4 архетипам
//     (Заводила, Оратор, Артист, Мастер Атмосферы) + 3 ядерных
//     общих (Эмо-осознанность, Выразительность, Конгруэнтность).
//     Новые файлы: che-skills/{tree,parseSurveys,index}.js, surveys.md
//     (510 утверждений, по 15 на навык). CSURV-1..3 для трёх ядерных
//     встроены инлайн в che-l0.md как часть L0-чата. getSurvey()
//     в skills/index.js теперь fallback-ит в ЧЭ-анкеты. JourneyView
//     dispatch-ит CheSkillTree для currentAspect === 'ЧЭ'. Skill ID
//     у ЧЭ имеют префикс `che-` для глобальной уникальности.
// 13 — UX-исправления для смены аспектов: handleStartSkillSurvey теперь
//     aspect-aware (определяет БС/ЧЭ по префиксу skill id + ищет
//     survey-шаг и в core, и в surveys). Кнопка «🪐 Планеты» добавлена
//     в шапку SkillTree/CheSkillTree/NeSkillTree — выход на PlanetMap
//     из колеса любого аспекта. AdminPanel получил блок «Планета» с
//     кнопками быстрого переключения между доступными аспектами.
// 14 — переименование внутренних ключей аспектов с кириллицы на латиницу
//     (БС→Si, ЧС→Se, БЛ→Ti, ЧЛ→Te, БЭ→Fi, ЧЭ→Fe, БИ→Ni, ЧИ→Ne). UI-лейблы
//     остались русскими (ASPECT_DATA[k].name). Миграция данных-сохраняющая:
//     `migrateCyrAspectKeys` ниже переименовывает stored.currentAspect и
//     все ключи в stored.aspects до проверки contentVersion, чтобы v13
//     юзеры получили латинские ключи без сброса чата. Бэкенд продолжает
//     использовать кириллицу — трансляция на границе api/client.js.
// 15 — добавлен аспект БИ (Белая Интуиция, планета Tempum Spiralis):
//     L0 (30 шагов), L1 (26), L2 (41), L3 (стартовый — 21).
//     Регистрация в registry.js, новый модуль aspects/Ni/index.js.
//     Контент в `aspects/Ni/l*.md`. Архетипы БИ: Мифотворец (на L0) →
//     Провидец → Разоблачитель → Шаман (на L1). 3 общих базовых навыка:
//     attunement / subconscious-listening / inner-silence — встроены инлайн
//     в l0.md (B-1..B-15 со scale: 1-10). Полное дерево навыков БИ
//     (43 навыка по 4 архетипам) и анкеты для архетипных навыков пока
//     не интегрированы — будут добавлены отдельно через модуль
//     skills/ni-skills.js + NiSkillTree-компонент.
// 16 — пересборка общих базовых навыков БС: signals / interoception /
//     honesty возвращены в SKILL_TREE.healer как обычные навыки архетипа
//     (id остался прежним → state.skills.* по этим id сохраняется).
//     На их место в COMMON_BASE_SKILLS введены 4 новых сквозных навыка:
//     body-listening, needs-awareness, timely-care, details. Это цепочка
//     «вход → понимание → выход + базовое качество тонкости», работающая
//     через все 4 архетипа БС. В L0-чате БС старые SURV-100/101/102
//     заменены на SURV-100..103 для четырёх новых навыков. Полные анкеты
//     SURV-55..58 добавлены в l0-surveys.md. Содержательное описание
//     навыков — `Si/Навыки БС — Универсальные.md`. Из-за бампа
//     L0/L1/L2-чаты у БС перезапустятся, XP/skills/streak/stardust
//     сохраняются.
// 17 — добавлен аспект БЭ (Белая Этика, планета Anima Humanitatis):
//     L0 (15 шагов), L1 (25), L2 (40), L3 (стартовый — 20). Регистрация
//     в registry.js, новый модуль aspects/Fi/index.js. Контент в
//     `aspects/Fi/l*.md`. Полное колесо БЭ: 58 навыков (2 корневых +
//     17 Дипломат + 14 Духовник + 9 Хранитель Рода + 16 Друг) по 4
//     архетипам, новые файлы skills/{fi-tree,fi-skills}.js + fi-surveys.md
//     (870 утверждений, по 15 на навык). Новый компонент FiSkillTree.jsx
//     дисптачится для currentAspect === 'Fi'. Skill ID у БЭ имеют
//     префикс `fi-` для глобальной уникальности. resolveSurvey() и
//     handleStartSkillSurvey обновлены для поддержки Fi. Существующие
//     юзеры получат сброс чат-истории по другим аспектам, прогресс
//     XP/streak/skills сохранится.
// 18 — добавлен аспект ЧС (Чёрная Сенсорика, планета Imperium Magnum):
//     L0 (15 шагов), L1 (25), L2 (40), L3 (60). Регистрация в registry.js,
//     новый модуль aspects/Se/index.js. Контент в `aspects/Se/l*.md`.
//     Полное колесо ЧС: 47 навыков (4 общих сквозных квартета
//     тело-восприятие-выбор-исполнение + 12 Защитник + 9 Правитель +
//     10 Строитель + 12 Герой включая синергический навык Радикальное
//     Принятие), новый файл skills/se-tree.js + l0-surveys.md (47 анкет
//     по 15 утверждений). SeSkillTree-компонент пока не реализован —
//     дерево навыков ЧС видно только через `JOURNEYS.Se` для чата
//     уровней. Survey-анкеты по навыкам ЧС будут добавлены отдельно.
//     Все 8 аспектов теперь имеют контент уровней. Существующие
//     юзеры получат сброс чат-истории по другим аспектам, прогресс
//     XP/streak/skills сохранится.
// 19 — унификация формата L0-оценки на B-вопросы со scale (по образцу
//     Ni/Ne). Новый механизм: `parseScripts.js` читает metadata
//     `skill:`/`block:` для type='question'; `handleSend` (number)
//     пишет ответ в `state.skills[skill].answers[block][0]`,
//     пересчитывает `result`/`passes`/`blocks` через `calcSurveyResult`
//     и общий score аспекта через `calc*ScoreFromSkills`. Это
//     синхронизирует L0-чат с деревом талантов: SURV-анкета сразу
//     знает «pass 1 пройден». Стартовый rollout: Se переписан, Ne/Ni
//     получили `block:`.
// 20 — финальная унификация L0 для всех 6 аспектов с skill-tree:
//     Si (4 раунда — body-listening, needs-awareness, timely-care,
//     details), Te (4 — work-vs-busyness, goal-holding,
//     cost-benefit-vision, technological-thinking), Fe (3 —
//     fe-awareness, fe-expressiveness, fe-congruence), Fi (2 —
//     fi-trust, fi-values-check + narrative-раунд об архетипах),
//     Ti (3 — structural-thinking, modality-distinction,
//     mental-discipline; pool B-4..B-6/U-4..U-5/S-4..S-6 удалён —
//     B-нумерация переехала на core).
//     Все B-вопросы со skill+block — тексты взяты как первое
//     утверждение каждого блока из соответствующего {aspect}-surveys.md.
//     Существующие SURV-карточки в дереве талантов автоматически
//     синхронизируются: после L0 navык получает passes=1, дерево
//     предложит «продолжить с pass 2» через getNextPass.
// 21 — экраны «Как развить» (SkillDetail) и «Какие черты» (SkillTraits)
//     для Fe-навыков. data/skills/Fe/{core,zavodila,orator,artist,master-atmo}.js
//     с полным контентом 34 навыков по 3 уровням (typage / essence / gift / shadow /
//     actions / practices / criteria / pitfalls; на L3 — precaution + dilemma).
//     Aspect-aware lookup в data/skills/index.js. Кнопка «Сохранить и узнать,
//     как развить →» в SurveyInsight + auto-redirect в SkillDetail при
//     открытом L1. Плашка-анонс для ядерных навыков, когда L1 ещё закрыт.
//     InsightInput на каждой unlocked-карточке SkillDetail и SkillTraits.
//     CTA «Узнать, как развить →» в FeSkillTree. Третья кнопка
//     «Изучить универсальные навыки» в LevelComplete для Fe на L0 →
//     FeCoreOverview с 3 карточками ядерных навыков.
//     state.skills[id].insights[] получили опциональные поля
//     source ('survey'|'detail'|'traits') и level (1|2|3).
//     Migration data-preserving: старые записи получают source='survey'.
//     Чат НЕ сбрасывается (только структурное расширение).
// v22 — БЭ-контент: расширение ASPECT_DATA.Fi 12 полями (skills, archetypePath,
//     historicalFigures, art, professions, myths, quotes, culturalDifferences,
//     childRaising, childhoodQuestions, fiSkillBlocksCore, fiSkillBlocks).
//     Источник — 11 .md-файлов в Fi/. data/skills/Fi/skill-blocks.js с 58
//     навыками × 4 блока психодинамики. Чат НЕ сбрасывается.
// v23 — БЭ Фаза 2: data/skills/Fi/ — 5 файлов (core, diplomat, confessor,
//     ancestor, friend) с детальным контентом всех 58 навыков по 3 уровням
//     (gift/shadow/actions/practices/criteria/pitfalls + precaution/dilemma на L3).
//     Подключение в data/skills/index.js (getSkillContent / getSkillName /
//     getArchetypeNameForSkill). Расширение HALL_CONTENT.Fi: 15 цитат, 18
//     личностей, 36 произведений, 4 архетипа. Чат НЕ сбрасывается.
// v24 — БЭ Фаза 3: допереносы контента в aspects-fi-extension.js до полного
//     покрытия исходных .md. Расширения: professions 17→107, art 18→102,
//     childRaising 20→100, quotes 14→80, myths 20→50, culturalDifferences
//     17→50, childhoodQuestions 20→50. Новое поле facts (90) + новый блок
//     'facts' в blocks.js (L2). Источник — 8 .md-файлов в Fi/. Чат НЕ
//     сбрасывается (только наполнение блоков теории аспекта).
// v25 — Поведенческое изменение migrateState: при бампе CONTENT_VERSION
//     теперь СОХРАНЯЕМ completedScripts и currentLevel каждого аспекта.
//     Раньше сбрасывали полностью — это привело к кейсу, когда у юзера
//     totalCompleted=114 а sum(completedScripts) свелся к 9 после бампа.
// v26 — Доразработка v25: миграция полностью data-preserving (как
//     match-version ветка). Стирание messages в v25 приводило к тому,
//     что UI активного аспекта видел messages=[] и инициализировал чат
//     заново, перетирая восстановленный currentLevel и completedScripts.
//     Теперь messages, pendingTasks, currentScriptId — всё сохраняется.
//     Если потребуется реально сбросить чат при несовместимых правках
//     контента — это будет отдельный механизм (per-user флаг).
// v27 — БЭ Фаза 3.5: восстановление полного контента в aspects-fi-extension.js,
//     ранее в Фазе 3 контент был сжат. Восстановлены до источника:
//     professions (107 — каждая 3-5 предложений + 4 ключевых навыка с
//     описанием), facts (90), childRaising (100). Также убраны блоки
//     historicalFigures / art / quotes из blocks.js — оставлены только
//     hallStub блоки (hallFigures / hallArts / hallQuotes), которые
//     отсылают в Холл. Чат не сбрасывается (data-preserving).
export const CONTENT_VERSION = 27

// Миграция id навыков после ревизии дерева (v9). Старый id → новый.
// Если у юзера уже есть запись по новому id, старая отбрасывается
// (приоритет — у новой записи). Если только старая — копируем под
// новым id.
const SKILL_ID_MIGRATION = {
  'scan': 'interoception',
  'relax': 'balance',
  'aging': 'pain',
  'env-quality': 'quality',
  'env-design': 'ergonomics',
  'load': 'pause',
  'library': 'pleasure',
}

// Дефолтные значения per-aspect папки.
export const DEFAULT_ASPECT_STATE = {
  currentLevel: 0,
  currentScriptIndex: 0,
  currentScriptId: null,
  awaitingInput: null,
  messages: [],
  completedScripts: [],
  pendingTasks: [],   // { id, scriptId, aspect, addedAt, status: 'taken' | 'deferred' }
}

// Безопасное чтение активной папки. Если её нет — отдаёт дефолт
// (чтобы старые места state.currentLevel и т.п. не падали).
export function aspectOf(s) {
  return s.aspects?.[s.currentAspect] ?? DEFAULT_ASPECT_STATE
}

// Иммутабельный апдейт активной папки. patch может быть объектом
// (мерджится поверх) или функцией (cur) => next.
export function updateAspect(s, patch) {
  const cur = s.aspects?.[s.currentAspect] ?? DEFAULT_ASPECT_STATE
  const next = typeof patch === 'function' ? patch(cur) : { ...cur, ...patch }
  return {
    ...s,
    aspects: { ...(s.aspects ?? {}), [s.currentAspect]: next },
  }
}

export const DEFAULT_JOURNEY = {
  screen: 'onboarding',
  onboardingStep: 0,
  currentAspect: 'Si',
  // Per-aspect «папки». Лениво создаются при первом обращении.
  aspects: {
    Si: { ...DEFAULT_ASPECT_STATE },
  },
  // Результаты анкет навыков (плоско по skillId — навыки уникальны в рамках всех аспектов).
  // skills[skillId] = { result: avg-навыка, blocks: { [blockKey]: avg }, completedAt }
  skills: {},
  // Активная анкета (если открыт screen='survey').
  // activeSurvey = { scriptId, skillId, blockIndex, statementIndex, answers: { [blockKey]: number[] } }
  activeSurvey: null,
  // Навык, открытый в детальном просмотре (screen='skill-detail').
  skillDetailId: null,
  xp: 0,
  stardust: 0,
  streak: 0,
  totalCompleted: 0,
  lastActiveDate: null,
  contentVersion: CONTENT_VERSION
}

// Префикс ID навыков ЧЭ переименован с `che-` (русский транслит) на `fe-`
// (стандартная соционическая нотация). Применяется до общего SKILL_ID_MIGRATION.
function renameChePrefix(id) {
  return id.startsWith('che-') ? 'fe-' + id.slice(4) : id
}

// Миграция skills-записей со старого формата (без passes/insights) на новый.
// Старые записи: { result, blocks, completedAt, answers? }.
// Новые: + passes (вычисляется по answers), + insights: [].
// v21: старые insights не имели поля source — добавляем 'survey'
// (это все уже сохранённые до v21 инсайты, они приходили из SurveyInsight).
function upgradeInsights(insights) {
  if (!Array.isArray(insights) || insights.length === 0) return insights ?? []
  return insights.map(ins => {
    if (!ins) return ins
    if (ins.source) return ins
    return { source: 'survey', ...ins }
  })
}

function migrateSkills(skills) {
  if (!skills || typeof skills !== 'object') return {}
  const out = {}
  for (const [id, entry] of Object.entries(skills)) {
    if (!entry) continue
    // Префикс che- → fe- для навыков ЧЭ + v9-переименования БС-навыков.
    const renamed = renameChePrefix(id)
    const targetId = SKILL_ID_MIGRATION[renamed] ?? renamed
    if (targetId !== id && skills[targetId]) continue
    // passes уже есть — оставляем как есть.
    if (Number.isFinite(entry.passes)) {
      out[targetId] = { ...entry, insights: upgradeInsights(entry.insights) }
      continue
    }
    // Вычисляем passes по answers (max длина массива).
    let passes = 0
    if (entry.answers) {
      for (const k of SURVEY_BLOCK_KEYS) {
        const arr = entry.answers[k] ?? []
        const len = arr.filter(n => Number.isFinite(n)).length
        if (len > passes) passes = len
      }
    } else if (Number.isFinite(entry.result)) {
      // У старых записей нет answers, но есть result — считаем как полную (3).
      passes = 3
    }
    out[targetId] = { ...entry, passes, insights: upgradeInsights(entry.insights) }
  }
  return out
}

// Нормализует одну per-aspect папку — заполняет недостающие ключи
// дефолтами. Используется и для актуальной версии (внутри aspects),
// и для старого «плоского» state при миграции.
function normalizeAspect(folder) {
  return {
    ...DEFAULT_ASPECT_STATE,
    ...(folder ?? {}),
    messages: folder?.messages ?? [],
    completedScripts: folder?.completedScripts ?? [],
    pendingTasks: folder?.pendingTasks ?? [],
  }
}

// Кириллица → латиница для ключей аспектов (v14). Применяется до проверки
// contentVersion — поэтому v13 юзеры получают плавный rename без сброса чата.
const CYR_TO_LAT_ASPECT = {
  'БС': 'Si', 'ЧС': 'Se', 'БЛ': 'Ti', 'ЧЛ': 'Te',
  'БЭ': 'Fi', 'ЧЭ': 'Fe', 'БИ': 'Ni', 'ЧИ': 'Ne',
}

// Перепишем stored.currentAspect и ключи stored.aspects в латиницу.
// Если у юзера каким-то образом уже есть и кир. и лат. ключ — латинская
// версия имеет приоритет (кириллический ключ отбрасывается).
function migrateCyrAspectKeys(stored) {
  if (!stored || typeof stored !== 'object') return stored
  let changed = false
  let next = stored

  if (typeof stored.currentAspect === 'string' && CYR_TO_LAT_ASPECT[stored.currentAspect]) {
    next = { ...next, currentAspect: CYR_TO_LAT_ASPECT[stored.currentAspect] }
    changed = true
  }

  if (stored.aspects && typeof stored.aspects === 'object') {
    const newAspects = {}
    let aspectsChanged = false
    for (const [k, v] of Object.entries(stored.aspects)) {
      const target = CYR_TO_LAT_ASPECT[k] ?? k
      if (target !== k) aspectsChanged = true
      // Латинский ключ уже есть — кириллический отбрасываем.
      if (newAspects[target]) continue
      newAspects[target] = v
    }
    if (aspectsChanged) {
      next = { ...next, aspects: newAspects }
      changed = true
    }
  }

  return changed ? next : stored
}

// Миграция при загрузке. Семантика та же, что была:
//   • контент-версия совпала → пропускаем state почти как есть (с safety
//     defaults для пропавших ключей в aspects);
//   • контент-версия не совпала → сбрасываем чат / completedScripts /
//     pendingTasks (и заодно currentLevel — как и до v8), сохраняем
//     XP/streak/stardust/totalCompleted/lastActiveDate/skills/activeSurvey.
//
// Тут же поддерживаем входной «плоский» state (v<8 либо bot-sync override
// из App.jsx, который в legacy-формате может прислать flat currentLevel
// и т.п.) — флэты складываем в aspects[currentAspect].
//
// Старое поле `mode` ('core'|'pool') v5 удаляется при чтении.
function migrateState(stored) {
  if (!stored) return DEFAULT_JOURNEY

  // v14: переименуем кириллические ключи в латиницу ДО проверки версии.
  // Для v13-юзеров это означает плавный rename без сброса чата (контент
  // не менялся, поэтому contentVersion после миграции бампнем до 14
  // в обеих ветках ниже).
  stored = migrateCyrAspectKeys(stored)
  const isV13Rename = stored.contentVersion === 13
  // v20 → v21: только структурное расширение (добавлены опциональные поля
  // source/level в insights[]). Чат не сбрасываем — лечим как match-version,
  // с миграцией insights через migrateSkills/upgradeInsights ниже.
  const isV20Insights = stored.contentVersion === 20

  const currentAspect = stored.currentAspect ?? 'Si'

  // Собираем aspects: если уже есть — нормализуем каждую папку; плоские
  // legacy-поля (currentLevel/messages/...) поглощаются в активный аспект.
  const incomingAspects = stored.aspects ?? {}
  const flatLegacy = {
    currentLevel: stored.currentLevel,
    currentScriptIndex: stored.currentScriptIndex,
    currentScriptId: stored.currentScriptId,
    awaitingInput: stored.awaitingInput,
    messages: stored.messages,
    completedScripts: stored.completedScripts,
    pendingTasks: stored.pendingTasks,
  }
  const hasFlatLegacy = Object.values(flatLegacy).some(v => v !== undefined)

  // v13 → v14: миграция была чисто переименованием ключей (см.
  // migrateCyrAspectKeys выше), контент не менялся. Лечим как match-version,
  // чтобы чат не сбросился.
  if (stored.contentVersion === CONTENT_VERSION || isV13Rename || isV20Insights) {
    const aspects = {}
    for (const [k, v] of Object.entries(incomingAspects)) {
      aspects[k] = normalizeAspect(v)
    }
    if (hasFlatLegacy) {
      // Bot-sync override может прийти с плоскими полями — поглощаем их
      // в активный аспект, не затирая то, что уже есть.
      const cur = aspects[currentAspect] ?? { ...DEFAULT_ASPECT_STATE }
      aspects[currentAspect] = normalizeAspect({
        ...cur,
        ...Object.fromEntries(
          Object.entries(flatLegacy).filter(([, v]) => v !== undefined)
        ),
      })
    }
    if (!aspects[currentAspect]) {
      aspects[currentAspect] = { ...DEFAULT_ASPECT_STATE }
    }
    // Сбрасываем legacy-плоские поля наверх, чтобы не плодить мусор в
    // сохранённом state (теперь они живут только в aspects).
    // eslint-disable-next-line no-unused-vars
    const {
      currentLevel: _l, currentScriptIndex: _i, currentScriptId: _id,
      awaitingInput: _ai, messages: _m, completedScripts: _cs, pendingTasks: _pt,
      mode: _mode,
      ...rest
    } = stored
    return {
      ...DEFAULT_JOURNEY,
      ...rest,
      aspects,
      currentAspect,
      skills: migrateSkills(stored.skills),
      activeSurvey: stored.activeSurvey ?? null,
      // Бампим версию (важно для ветки isV13Rename — иначе при следующей
      // загрузке снова попадём в эту же ветку).
      contentVersion: CONTENT_VERSION,
    }
  }

  // Контент-версия не совпала. С v26 миграция полностью data-preserving:
  // сохраняем ВСЕ поля каждого аспекта (messages, completedScripts,
  // currentLevel, currentScriptId, pendingTasks, etc.). Раньше стирали
  // messages — это приводило к UI-логике «начать L0 заново» при открытии
  // активного аспекта и перетирало восстановленный прогресс.
  // Если в будущем потребуется реально сбросить чат (например, при
  // несовместимых правках контента) — это будет отдельный механизм
  // (per-user флаг или whitelist аспектов).
  const aspects = {}
  for (const [k, v] of Object.entries(incomingAspects)) {
    aspects[k] = normalizeAspect(v)
  }
  if (hasFlatLegacy) {
    const cur = aspects[currentAspect] ?? { ...DEFAULT_ASPECT_STATE }
    aspects[currentAspect] = normalizeAspect({
      ...cur,
      ...Object.fromEntries(
        Object.entries(flatLegacy).filter(([, v]) => v !== undefined)
      ),
    })
  }
  if (!aspects[currentAspect]) {
    aspects[currentAspect] = { ...DEFAULT_ASPECT_STATE }
  }
  // eslint-disable-next-line no-unused-vars
  const {
    currentLevel: _l, currentScriptIndex: _i, currentScriptId: _id,
    awaitingInput: _ai, messages: _m, completedScripts: _cs, pendingTasks: _pt,
    mode: _mode,
    ...rest
  } = stored
  return {
    ...DEFAULT_JOURNEY,
    ...rest,
    aspects,
    currentAspect,
    skills: migrateSkills(stored.skills),
    activeSurvey: stored.activeSurvey ?? null,
    contentVersion: CONTENT_VERSION,
  }
}

const todayStr = () => new Date().toISOString().slice(0, 10)

function calcStreak(s) {
  const t = todayStr()
  if (!s.lastActiveDate) return 1
  if (s.lastActiveDate === t) return s.streak
  const diff = Math.round((new Date(t) - new Date(s.lastActiveDate)) / 86400000)
  return diff === 1 ? s.streak + 1 : 1
}

export default function JourneyView({ journey: extJourney, onJourneyChange, scores, onScoresChange, diary, onDiaryChange, t, isAdmin = false, user }) {
  // Локальный стейт — единственный source of truth.
  // Наружу синхронизируется через useEffect (ниже), чтобы persist-callback
  // не ломал серийные setState в одном хэндлере.
  // migrateState учитывает разные версии контента и пропавшие поля.
  const [state, setState] = useState(() => migrateState(extJourney))

  // Стабильная ссылка на текущий persist-callback (он пересоздаётся
  // каждый рендер родителя — через ref эффект-зависимость остаётся чистой).
  const persistRef = useRef(onJourneyChange)
  useEffect(() => { persistRef.current = onJourneyChange }, [onJourneyChange])

  // Сохраняем стейт наружу при каждом изменении, кроме первого рендера.
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    persistRef.current?.(state)
  }, [state])

  const [inputVal, setInputVal] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [toast, setToast] = useState(null)
  const chatRef = useRef(null)
  const inputRef = useRef(null)

  // Активная per-aspect папка. Все per-aspect чтения идут через `a`,
  // все per-aspect записи — через updateAspect(s, ...).
  const a = aspectOf(state)

  const currentJourney = getJourney(state.currentAspect)
  const currentLevel = currentJourney?.levels?.[a.currentLevel]
  // Linear core-маршрут уровня. Анкеты (currentLevel.surveys) живут
  // отдельно, доступны только через дерево навыков, не из chat-ленты.
  const scripts = currentLevel?.core ?? currentLevel?.scripts ?? []
  const aspectIntro = currentJourney?.intro ?? []
  const accent = ASPECT_COLORS[state.currentAspect] ?? '#4cc9f0'

  // Лукап скрипта по {scriptId, level} — нужен в чате для архивных
  // сообщений: T-1 в L0 ≠ T-1 в L1, ID может повторяться между
  // уровнями. Дополнительный fallback в surveys целевого уровня —
  // на случай чтения старых state с архивными SURV-сообщениями (v5).
  const resolveScript = useCallback((scriptId, level) => {
    const lvl = level ?? a.currentLevel
    const lvlData = currentJourney?.levels?.[lvl]
    const inCore = lvlData?.core?.find(s => s.id === scriptId)
    if (inCore) return inCore
    const inSurveys = lvlData?.surveys?.find(s => s.id === scriptId)
    if (inSurveys) return inSurveys
    return scripts.find(s => s.id === scriptId) ?? null
  }, [currentJourney, scripts, a.currentLevel])

  const nextLevel = currentJourney?.levels?.[a.currentLevel + 1] ?? null

  // Первый скрол после mount/смены экрана — мгновенный, чтобы юзер
  // сразу видел последние сообщения. Дальше — плавный.
  const isFirstScroll = useRef(true)
  useEffect(() => {
    if (chatRef.current) {
      const el = chatRef.current
      const behavior = isFirstScroll.current ? 'auto' : 'smooth'
      const id = setTimeout(() => {
        el.scrollTo({ top: el.scrollHeight, behavior })
        isFirstScroll.current = false
      }, 50)
      return () => clearTimeout(id)
    }
  }, [a.messages, isTyping, state.screen, a.awaitingInput])

  // Авто-открытие ползунка для question со шкалой (1-10).
  // Покрывает все кейсы появления такого вопроса: deliverScript на следующий
  // шаг, handleSwitchAspect → инжект первого скрипта, перезагрузка state.
  // Юзер видит сразу ползунок и кнопку «Ответить · X/10», без лишнего тыка.
  useEffect(() => {
    if (state.screen !== 'chat') return
    if (a.awaitingInput) return
    const sc = scripts[a.currentScriptIndex]
    if (!sc || sc.type !== 'question') return
    const hasScale = !!sc.followUp || !!sc.scale
    if (!hasScale) return
    setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: 'number' })))
  }, [state.screen, a.currentScriptIndex, a.awaitingInput, scripts, setState])

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }, [])

  const addBotMessage = useCallback((text, delay = 400) => new Promise((resolve) => {
    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      setState(s => updateAspect(s, cur => ({
        ...cur,
        messages: [...cur.messages, { id: Date.now() + Math.random(), role: 'bot', text }]
      })))
      resolve()
    }, delay)
  }), [setState])

  const addUserMessage = useCallback((text) => {
    setState(s => updateAspect(s, cur => ({
      ...cur,
      messages: [...cur.messages, { id: Date.now() + Math.random(), role: 'user', text }]
    })))
  }, [setState])

  const awardXP = useCallback((xp, stardust = 0, scriptId = null) => {
    if (xp <= 0 && stardust <= 0) return

    // Захватываем текущий state ДО setState — чтобы знать какой шаг
    // только что завершён (для append-only журнала событий).
    let completedSnapshot = null
    setState(s => {
      // Запоминаем что закрылось — отправим в журнал после setState.
      const folder = aspectOf(s)
      completedSnapshot = {
        aspect: s.currentAspect,
        level: folder.currentLevel ?? 0,
        short_id: scriptId || folder.currentScriptId,
      }

      // Глобальные счётчики (XP/streak/...).
      const globals = {
        ...s,
        xp: s.xp + xp,
        stardust: s.stardust + stardust,
        streak: calcStreak(s),
        totalCompleted: s.totalCompleted + 1,
        lastActiveDate: todayStr(),
      }
      // Per-aspect: completedScripts.
      return updateAspect(globals, cur => ({
        ...cur,
        completedScripts: scriptId
          ? [...cur.completedScripts, scriptId]
          : (cur.currentScriptId ? [...cur.completedScripts, cur.currentScriptId] : cur.completedScripts)
      }))
    })

    // Append-only журнал: страховка от потери completedScripts при сбросах
    // state. Best-effort, ошибки игнорируем — идемпотентно на бэке.
    // ВНЕ setState чтобы не вызывать side-effect в React 18 strict mode.
    if (completedSnapshot?.short_id && completedSnapshot?.aspect) {
      postStepCompleted(completedSnapshot)
        .catch(err => console.warn('event log failed:', err?.message))
    }

    const parts = []
    if (xp > 0) parts.push(`+${xp} XP`)
    if (stardust > 0) parts.push(`+${stardust} ✦`)
    showToast(parts.join('   '))
  }, [setState, showToast])

  const deliverScript = useCallback((index) => {
    const script = scripts[index]
    if (!script) {
      setState(s => updateAspect({ ...s, screen: 'levelcomplete' }, cur => ({ ...cur, awaitingInput: null })))
      return
    }
    setState(s => updateAspect(s, cur => ({
      ...cur,
      currentScriptIndex: index,
      currentScriptId: script.id,
      awaitingInput: null,
      // Архивируем скрипт в историю чата с level — чтобы lookup всегда
      // находил правильный текст, даже если ID совпадают между уровнями.
      messages: [
        ...cur.messages,
        { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: script.id, level: cur.currentLevel }
      ]
    })))
  }, [scripts, setState])

  // ─── Онбординг ───────────────────────────────────────────────
  // Шаги 0–3: общее интро, не привязанное к аспекту.
  // Упрощённый онбординг (2026-05): один вводный экран → Карта Планет.
  // Старые 4 шага в чате + IntroTour 5 страниц были переусложнены.
  // Теперь юзер видит один текст «Привет. Это твой компас.», жмёт
  // «Открыть карту» — попадает в PlanetMap. Подсказки на ключевых
  // местах появляются по мере навигации через <Hint/> компоненты.
  // Полный обзор тура — отдельная кнопка «🎓 Пройти обучение» в дашборде.
  const handleOnboardingNext = useCallback(async () => {
    // Любое нажатие кнопки в intro-state ведёт сразу на Карту Планет.
    addUserMessage(ONBOARDING[0]?.button || 'Открыть карту')
    setState(s => ({ ...s, onboardingStep: 4, screen: 'planets' }))
  }, [addUserMessage, setState])

  // Помещаем задание в очередь активных (без дублей по scriptId).
  const enqueueTask = useCallback((script, status) => {
    setState(s => updateAspect(s, cur => ({
      ...cur,
      pendingTasks: [
        ...(cur.pendingTasks ?? []).filter(t => t.scriptId !== script.id),
        {
          id: `${script.id}-${Date.now()}`,
          scriptId: script.id,
          aspect: s.currentAspect,
          addedAt: Date.now(),
          status
        }
      ]
    })))
  }, [])

  const removePending = useCallback((scriptId) => {
    setState(s => updateAspect(s, cur => ({
      ...cur,
      pendingTasks: (cur.pendingTasks ?? []).filter(t => t.scriptId !== scriptId)
    })))
  }, [])

  // ─── Действия в чате ─────────────────────────────────────────
  const handleScriptAction = useCallback(async (action, scriptId) => {
    const script = scripts.find(s => s.id === scriptId)
    if (!script) return

    // Postponable types add to pendingTasks.
    const isDeferrable = script.type === 'exercise' || script.type === 'question'

    if (action === 'next' || action === 'done' || action === 'skip') {
      if (action === 'skip') addUserMessage('Пропустить')
      else if (action === 'done') {
        // Для exercise — «взять в ежедневные практики» (привычка аспекта).
        // Для question (B) — просто «взял задание» в активные.
        if (script.type === 'exercise') {
          addUserMessage('Беру в ежедневные практики')
          await addBotMessage(
            `Упражнение «${script.title}» теперь твоя ежедневная практика для этого аспекта. Открой дашборд, чтобы ставить галочку каждый день.`,
            500
          )
          // Best-effort: пишем в user_habits, чтобы упражнение появилось
          // в блоке «Сегодня» на дашборде. Ошибки игнорируем — фронт
          // пока всё равно хранит в pendingTasks (enqueueTask ниже).
          chooseHabit({
            aspect: state.currentAspect,
            title: script.title,
            exerciseId: script.id,
          }).catch(err => console.warn('chooseHabit failed:', err?.message))
        } else {
          addUserMessage('Взял задание')
          await addBotMessage('Задание добавлено в активные. Открой раздел «Активные задания», когда выполнишь.', 500)
        }
      } else addUserMessage('Позже')

      if (isDeferrable && (action === 'done' || action === 'next')) {
        // Задание уехало в активные — XP даётся только при реальном выполнении
        // (через TasksScreen или через answer_number / complete_exercise).
        enqueueTask(script, action === 'done' ? 'taken' : 'deferred')
        setTimeout(() => deliverScript(a.currentScriptIndex + 1), 600)
      } else if (
        (script.type === 'theory' || script.type === 'word' || script.type === 'reflection')
        && action === 'next'
      ) {
        // Обязательный insight: открываем поле для записи в дневник.
        // XP/diary/advance произойдёт в handleSend для awaitingInput='step-insight'.
        // Сохраняем «прошлое сообщение от юзера» = «Дальше», как и раньше,
        // но не двигаем чат — ждём ввод инсайта.
        setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: 'step-insight' })))
        setTimeout(() => inputRef.current?.focus(), 50)
      } else {
        // Прочие случаи (например skip на reflection без insight) — без XP, advance.
        setTimeout(() => deliverScript(a.currentScriptIndex + 1), 600)
      }
    } else if (action === 'answer_number') {
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: 'number' })))
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (action === 'answer_text') {
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: 'text' })))
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (action === 'complete_exercise') {
      // Открываем поле для обязательного комментария. XP и переход к
      // следующему скрипту произойдут после ввода в handleSend
      // (ветка awaitingInput === 'exercise_note').
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: 'exercise_note' })))
      setTimeout(() => inputRef.current?.focus(), 50)
    } else if (action === 'start_survey') {
      // Запуск анкеты. Переходим на отдельный экран с поэтапным UI.
      // Если по этому навыку уже был сохранён черновик (юзер прервал
      // анкету раньше) — восстанавливаем прогресс. Иначе старт с нуля.
      const draft = state.skills?.[script.skill]?.draft
      setState(s => ({
        ...s,
        screen: 'survey',
        activeSurvey: draft
          ? { scriptId: script.id, skillId: script.skill, ...draft }
          : { scriptId: script.id, skillId: script.skill, blockIndex: 0, statementIndex: 0, answers: {} }
      }))
    }
  }, [scripts, a.currentScriptIndex, state.skills, addBotMessage, addUserMessage, awardXP, deliverScript, enqueueTask, removePending])

  // ─── Ввод текста / числа ─────────────────────────────────────
  // override — опциональный аргумент с уже известным значением (используется
  // в Chat для слайдера, чтобы обойти race condition с setInputVal).
  const handleSend = useCallback(async (override) => {
    const raw = typeof override === 'string' ? override : inputVal
    const val = raw.trim()
    if (!val) return
    const script = scripts[a.currentScriptIndex]
    if (a.awaitingInput === 'number') {
      const num = parseInt(val, 10)
      if (isNaN(num) || num < 1 || num > 10) {
        await addBotMessage('Пожалуйста, введи число от 1 до 10.', 400)
        return
      }
      addUserMessage(val)
      setInputVal('')
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: null })))
      if (script?.followUp) await addBotMessage(script.followUp(val), 700)
      else await addBotMessage(`Записал: ${val}/10.`, 500)

      // Если у скрипта есть skill+block — пишем ответ в state.skills как
      // statementIndex=0 (соответствует pass=1) и пересчитываем score
      // аспекта через calc*ScoreFromSkills. Иначе — старое поведение:
      // прямая запись в scores[aspect] (последний ответ перетирает).
      if (script?.skill && script?.block) {
        const aspect = state.currentAspect
        const prevSkills = state.skills ?? {}
        const prevEntry = prevSkills[script.skill] ?? { answers: {}, blocks: {}, insights: [], passes: 0 }
        const prevAnswers = prevEntry.answers ?? {}
        const blockArr = [...(prevAnswers[script.block] ?? [])]
        blockArr[0] = num
        const newAnswers = { ...prevAnswers, [script.block]: blockArr }
        const result = calcSurveyResult(newAnswers)
        let passes = 0
        for (const k of SURVEY_BLOCK_KEYS) {
          const arr = newAnswers[k] ?? []
          const len = arr.filter(n => Number.isFinite(n)).length
          if (len > passes) passes = len
        }
        const newEntry = {
          ...prevEntry,
          answers: newAnswers,
          blocks: result.blocks,
          result: Number.isFinite(result.skill) ? result.skill : prevEntry.result,
          passes: Math.min(3, passes),
          completedAt: Date.now(),
        }
        const newSkills = { ...prevSkills, [script.skill]: newEntry }
        setState(s => ({ ...s, skills: newSkills }))

        const calcByAspect = {
          Si: calcSiScoreFromSkills, Se: calcSeScoreFromSkills,
          Ti: calcTiScoreFromSkills, Te: calcTeScoreFromSkills,
          Fi: calcFiScoreFromSkills, Fe: calcFeScoreFromSkills,
          Ne: calcNeScoreFromSkills, Ni: calcNiScoreFromSkills,
        }
        const calcFn = calcByAspect[aspect]
        const aspScore = calcFn?.(newSkills)
        if (Number.isFinite(aspScore)) {
          onScoresChange({ ...scores, [aspect]: Math.round(aspScore) })
        }
      } else {
        // Старый путь: запись напрямую в scores[aspect]
        onScoresChange({ ...scores, [state.currentAspect]: num })
      }

      if (script?.id) removePending(script.id)
      awardXP(script?.xp ?? 10, 0, script?.id ?? null)
      setTimeout(() => deliverScript(a.currentScriptIndex + 1), 700)
    } else if (a.awaitingInput === 'text') {
      addUserMessage(val)
      setInputVal('')
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: null })))
      // Нейтральная реплика без похвалы за факт ответа (см. §3.6).
      // Для open-ended вопросов целей и для рефлексий используем одну формулировку.
      const ack = script?.type === 'question' ? 'Записано в карту.' : 'Записано в дневник.'
      await addBotMessage(ack, 500)
      // Сайд-эффект: рефлексия → запись в дневник с подписью «на какой вопрос ответ».
      onDiaryChange([
        {
          id: Date.now(),
          date: new Date().toLocaleDateString('ru-RU'),
          ts: Date.now(),
          aspect: state.currentAspect,
          text: val,
          source: 'journey',
          scriptId: script?.id ?? null,
          promptTitle: script?.title ?? null,
          prompt: script?.text ?? null
        },
        ...(diary ?? [])
      ])
      if (script?.id) removePending(script.id)
      // Word-скрипты («Слово дня: X») имеют stardust: 1 — начисляем его и
      // через answer_text, чтобы запись ответа не «съедала» стардаст
      // относительно ветки `next`. Для других типов (reflection, question)
      // stardust не задаётся, и он естественно равен 0.
      const stardust = script?.type === 'word' ? (script?.stardust ?? 0) : 0
      awardXP(script?.xp ?? 10, stardust, script?.id ?? null)
      setTimeout(() => deliverScript(a.currentScriptIndex + 1), 700)
    } else if (a.awaitingInput === 'exercise_note') {
      // Завершение упражнения с обязательным комментарием.
      // Пустая строка отсекается общим guard'ом в начале handleSend.
      addUserMessage(val)
      setInputVal('')
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: null })))
      await addBotMessage('Записано в дневник.', 500)
      onDiaryChange([
        {
          id: Date.now(),
          date: new Date().toLocaleDateString('ru-RU'),
          ts: Date.now(),
          aspect: state.currentAspect,
          text: val,
          source: 'journey',
          scriptId: script?.id ?? null,
          promptTitle: script?.title ?? null,
          prompt: script?.text ?? null
        },
        ...(diary ?? [])
      ])
      if (script?.id) removePending(script.id)
      awardXP(script?.xp ?? 15, script?.stardust ?? 0, script?.id ?? null)
      setTimeout(() => deliverScript(a.currentScriptIndex + 1), 700)
    } else if (a.awaitingInput === 'step-insight') {
      // Обязательный инсайт после T/S/R — раньше эти типы давали XP сразу
      // на «Дальше». Теперь юзер обязан записать рефлексию, она уходит в
      // дневник со scriptId, и только потом chat двигается дальше.
      // Это гарантирует, что каждый пройденный шаг оставляет видимый след.
      addUserMessage(val)
      setInputVal('')
      setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: null })))
      await addBotMessage('Записано в дневник.', 400)
      onDiaryChange([
        {
          id: Date.now(),
          date: new Date().toLocaleDateString('ru-RU'),
          ts: Date.now(),
          aspect: state.currentAspect,
          text: val,
          source: 'journey-step-insight',
          scriptId: script?.id ?? null,
          promptTitle: script?.title ?? null,
          prompt: script?.text ?? null,
        },
        ...(diary ?? [])
      ])
      // XP/stardust по типу скрипта. Word даёт stardust как и раньше.
      const stardust = script?.type === 'word' ? (script?.stardust ?? 0) : (script?.stardust ?? 0)
      awardXP(script?.xp ?? 10, stardust, script?.id ?? null)
      setTimeout(() => deliverScript(a.currentScriptIndex + 1), 600)
    }
  }, [inputVal, a.awaitingInput, a.currentScriptIndex, state.currentAspect, scripts, scores, diary, addBotMessage, addUserMessage, awardXP, deliverScript, onDiaryChange, onScoresChange, removePending])

  const handleReset = useCallback(() => {
    setState(DEFAULT_JOURNEY)
  }, [])

  // Переход на следующий уровень. Сохраняет всю историю сообщений
  // (с level=прошлый), добавляет первый скрипт нового уровня.
  const handleNextLevel = useCallback(() => {
    const next = currentJourney?.levels?.[a.currentLevel + 1]
    if (!next) return
    const firstScript = (next.core ?? next.scripts ?? [])[0]
    setState(s => updateAspect(
      { ...s, screen: 'chat' },
      cur => ({
        ...cur,
        currentLevel: cur.currentLevel + 1,
        currentScriptIndex: 0,
        currentScriptId: firstScript?.id ?? null,
        awaitingInput: null,
        messages: firstScript
          ? [...cur.messages, { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: firstScript.id, level: cur.currentLevel + 1 }]
          : cur.messages
      })
    ))
  }, [currentJourney, a.currentLevel])

  // ─── Анкета навыков (survey) ─────────────────────────────────
  // Режимы:
  //   mode='short' — 5 утверждений (один pass)
  //   mode='full'  — все оставшиеся утверждения (от startPass до 3)
  //
  // activeSurvey:
  //   { skillId, scriptId, mode, startPass, stepIndex, answers }
  //
  // Список утверждений вычисляется через buildSurveyStatements(survey, mode, startPass).
  // stepIndex итерирует по этому списку. Когда stepIndex >= statements.length —
  // конец сессии, переход на survey-insight.
  const handleSurveyAnswer = useCallback((value, insightText) => {
    // Если юзер записал инсайт по конкретному утверждению — кладём в дневник
    // отдельной записью с привязкой к навыку и тексту утверждения.
    const trimmedInsight = (insightText ?? '').trim()
    if (trimmedInsight) {
      const active = state.activeSurvey
      const survey = active ? resolveSurvey(active.skillId) : null
      const stmts = survey
        ? buildSurveyStatements(survey, active.mode ?? 'short', active.startPass ?? 1)
        : []
      const current = stmts[active?.stepIndex ?? 0]
      const statementText = current?.statement ?? ''
      const skillName = survey?.name ?? active?.skillId ?? ''
      onDiaryChange([
        {
          id: Date.now() + Math.random(),
          date: new Date().toLocaleDateString('ru-RU'),
          ts: Date.now(),
          aspect: state.currentAspect,
          text: trimmedInsight,
          source: 'journey-survey-statement',
          prompt: statementText,
          promptTitle: skillName,
          skillId: active?.skillId,
        },
        ...diary,
      ])
    }

    setState(s => {
      const active = s.activeSurvey
      if (!active) return s
      const survey = resolveSurvey(active.skillId)
      if (!survey) return s
      const stmts = buildSurveyStatements(survey, active.mode ?? 'short', active.startPass ?? 1)
      const current = stmts[active.stepIndex ?? 0]
      if (!current) return s

      const prevAnswers = active.answers?.[current.blockKey] ?? []
      const nextBlockAnswers = [...prevAnswers]
      nextBlockAnswers[current.statementIndex] = value
      const nextAnswers = { ...active.answers, [current.blockKey]: nextBlockAnswers }

      return {
        ...s,
        activeSurvey: {
          ...active,
          answers: nextAnswers,
          stepIndex: (active.stepIndex ?? 0) + 1
        }
      }
    })
  }, [setState, state.activeSurvey, state.currentAspect, diary, onDiaryChange])

  // Назад на одно утверждение (внутри текущей сессии).
  const handleSurveyBack = useCallback(() => {
    setState(s => {
      const active = s.activeSurvey
      if (!active) return s
      return {
        ...s,
        activeSurvey: {
          ...active,
          stepIndex: Math.max(0, (active.stepIndex ?? 0) - 1)
        }
      }
    })
  }, [setState])

  // Конец прохода (5 утверждений отвечены): переключаемся на экран
  // обязательного инсайта. Здесь НЕ пишем в state.skills и не выдаём XP —
  // это делает handleSurveyInsight после ввода рефлексии.
  const handleSurveyComplete = useCallback(() => {
    setState(s => ({ ...s, screen: 'survey-insight' }))
  }, [setState])

  // Открыть детальный разбор навыка (черты + практики + действия).
  // Доступен из дерева навыков для пройденных навыков и автоматически —
  // сразу после прохождения анкеты (см. handleSurveyInsight).
  const handleOpenSkillDetail = useCallback((skillId) => {
    setState(s => ({ ...s, skillDetailId: skillId, screen: 'skill-detail' }))
  }, [setState])

  // Юзер написал инсайт и нажал «Сохранить».
  // Считаем средние по всем накопленным ответам, пишем skill, апдейтим
  // passes по фактической длине массивов в answers.
  const handleSurveyInsight = useCallback((insightText) => {
    const active = state.activeSurvey
    if (!active) return
    const survey = resolveSurvey(active.skillId)
    if (!survey) return

    const result = calcSurveyResult(active.answers)
    const completedAt = Date.now()

    // Фактическое число проходов = max длина массивов ответов по блокам.
    let actualPasses = 0
    for (const k of SURVEY_BLOCK_KEYS) {
      const arr = active.answers?.[k] ?? []
      const len = arr.filter(n => Number.isFinite(n)).length
      if (len > actualPasses) actualPasses = len
    }
    actualPasses = Math.min(3, actualPasses)

    const prev = state.skills?.[active.skillId] ?? {}
    const wasPasses = prev.passes ?? 0
    const newSkillEntry = {
      ...prev,
      result: result.skill,
      blocks: result.blocks,
      answers: active.answers,
      passes: actualPasses,
      completedAt,
      insights: [
        ...(prev.insights ?? []),
        { text: insightText, completedAt, mode: active.mode, pass: actualPasses }
      ],
      draft: undefined
    }
    delete newSkillEntry.draft

    const newSkills = { ...state.skills, [active.skillId]: newSkillEntry }

    // Если анкета была запущена из чат-скрипта (например, SURV-* в L0)
    // — возвращаем юзера в чат и продвигаем на следующий шаг.
    // Если из дерева навыков — открываем экран деталей навыка, но только
    // если для него есть развёрнутый контент И L1 уже открыт (cl≥1 ∧ passes≥1).
    // Иначе возвращаем в дерево навыков (плашка-анонс уже была показана в SurveyInsight).
    const fromChatScript = scripts.some(sc => sc.id === active.scriptId)
    const cl = aspectOf(state).currentLevel ?? 0
    const skillContent = getSkillContent(active.skillId)
    const willOpenDetail = !!skillContent && getUnlockedSkillLevel(cl, actualPasses) >= 1

    setState(s => ({
      ...s,
      skills: newSkills,
      activeSurvey: null,
      skillDetailId: (fromChatScript || !willOpenDetail) ? null : active.skillId,
      screen: fromChatScript ? 'chat' : (willOpenDetail ? 'skill-detail' : 'skill-tree'),
    }))

    if (fromChatScript) {
      const nextIdx = (aspectOf(state).currentScriptIndex ?? 0) + 1
      setTimeout(() => deliverScript(nextIdx), 100)
    }

    // Пересчёт средних: БС / ЧЭ / ЧИ / БИ / ЧЛ / БЛ / БЭ / ЧС. Каждый calc смотрит только в свои id,
    // так что один newSkills корректно обновляет все score одновременно.
    const siScore  = calcSiScoreFromSkills(newSkills)
    const feScore = calcFeScoreFromSkills(newSkills)
    const neScore  = calcNeScoreFromSkills(newSkills)
    const niScore  = calcNiScoreFromSkills(newSkills)
    const teScore  = calcTeScoreFromSkills(newSkills)
    const tiScore  = calcTiScoreFromSkills(newSkills)
    const fiScore  = calcFiScoreFromSkills(newSkills)
    const seScore  = calcSeScoreFromSkills(newSkills)
    const nextScores = { ...scores }
    if (Number.isFinite(siScore))  nextScores['Si'] = Math.round(siScore)
    if (Number.isFinite(feScore)) nextScores['Fe'] = Math.round(feScore)
    if (Number.isFinite(neScore))  nextScores['Ne'] = Math.round(neScore)
    if (Number.isFinite(niScore))  nextScores['Ni'] = Math.round(niScore)
    if (Number.isFinite(teScore))  nextScores['Te'] = Math.round(teScore)
    if (Number.isFinite(tiScore))  nextScores['Ti'] = Math.round(tiScore)
    if (Number.isFinite(fiScore))  nextScores['Fi'] = Math.round(fiScore)
    if (Number.isFinite(seScore))  nextScores['Se'] = Math.round(seScore)
    onScoresChange(nextScores)

    // Запись в дневник.
    const script = scripts.find(sc => sc.id === active.scriptId)
    const sessionLabel =
      active.mode === 'full'
        ? `полный проход с ${active.startPass} до 3 (${actualPasses}/3 после сессии)`
        : `проход ${actualPasses}/3 (короткий)`
    onDiaryChange([
      {
        id: completedAt,
        date: new Date().toLocaleDateString('ru-RU'),
        ts: completedAt,
        aspect: state.currentAspect,
        text: `Анкета: ${survey.name} · ${sessionLabel}. Средняя ${result.skill?.toFixed(1) ?? '—'}/10. Инсайт: ${insightText}`,
        source: 'journey-survey',
        scriptId: active.scriptId,
        skillId: active.skillId,
        promptTitle: script?.title ?? survey.name,
        prompt: script?.text ?? null,
        insight: insightText,
        survey: {
          name: survey.name,
          archetype: survey.archetype,
          blocks: survey.blocks,
          answers: active.answers,
          blockAvgs: result.blocks,
          skillAvg: result.skill,
          pass: actualPasses,
          mode: active.mode
        }
      },
      ...(diary ?? [])
    ])

    // XP: 10 за каждый закрытый проход. Большой опрос = 3 прохода = 30,
    // три мини-прохода по очереди = 10+10+10 = те же 30.
    // Stardust по-прежнему только на финальном проходе (passes=3).
    const wentToFinal = wasPasses < 3 && actualPasses === 3
    const xp = (actualPasses - wasPasses) * 10
    if (script) removePending(script.id)
    awardXP(xp, wentToFinal ? (script?.stardust ?? 0) : 0, script?.id ?? null)
  }, [state, scripts, scores, diary, onDiaryChange, onScoresChange, awardXP, removePending, setState, deliverScript])

  // Сохранить inline-инсайт с карточки уровня (SkillDetail / SkillTraits).
  // Пишем в state.skills[id].insights[] с полями source ('detail'|'traits') и level,
  // а также в дневник (как обычный journey-skill-insight).
  const handleSaveSkillInsight = useCallback((skillId, level, source, text) => {
    if (!skillId || !text) return
    const completedAt = Date.now()

    setState(s => {
      const skillEntry = s.skills?.[skillId] ?? {}
      const insights = [
        ...(skillEntry.insights ?? []),
        { text, completedAt, source, level }
      ]
      return {
        ...s,
        skills: { ...s.skills, [skillId]: { ...skillEntry, insights } }
      }
    })

    // Имя навыка для записи в дневник.
    let skillName = skillId
    const survey = resolveSurvey(skillId)
    if (survey?.name) skillName = survey.name
    else {
      const c = getSkillContent(skillId)
      if (c?.name) skillName = c.name
    }

    const sourceLabel = source === 'detail' ? 'как развить' : source === 'traits' ? 'черты' : source
    onDiaryChange([
      {
        id: completedAt,
        date: new Date().toLocaleDateString('ru-RU'),
        ts: completedAt,
        aspect: state.currentAspect,
        text: `${skillName} · L${level} · ${sourceLabel}: ${text}`,
        source: 'journey-skill-insight',
        skillId,
        level,
        insightSource: source
      },
      ...(diary ?? [])
    ])
  }, [setState, onDiaryChange, diary, state.currentAspect])

  // Отмена анкеты или инсайта — сохраняем текущий прогресс как draft.
  const handleSurveyCancel = useCallback(() => {
    setState(s => {
      const active = s.activeSurvey
      if (!active) return { ...s, screen: 'skill-tree' }
      const hasAnyAnswer = Object.values(active.answers ?? {}).some(arr =>
        Array.isArray(arr) && arr.some(n => Number.isFinite(n))
      )
      if (!hasAnyAnswer) {
        return { ...s, activeSurvey: null, screen: 'skill-tree' }
      }
      const prevSkill = s.skills?.[active.skillId] ?? {}
      return {
        ...s,
        activeSurvey: null,
        screen: 'skill-tree',
        skills: {
          ...s.skills,
          [active.skillId]: {
            ...prevSkill,
            draft: {
              mode: active.mode ?? 'short',
              startPass: active.startPass ?? 1,
              stepIndex: active.stepIndex ?? 0,
              answers: active.answers,
            }
          }
        }
      }
    })
  }, [setState])

  // Открыть меню «Дерево навыков» — выбор любого навыка для оценки
  // вручную, с видимым прогрессом по веткам. Доступно с момента, когда
  // юзер дошёл до экрана LevelComplete L0 («Открыть Колесо БС») —
  // gate здесь лояльный, фактическая блокировка на UI-уровне.
  // Дерево есть у Si/Fe/Ne/Ni/Te/Ti/Fi/Se; для остальных аспектов — toast.
  const ASPECTS_WITH_SKILL_TREE = ['Si', 'Fe', 'Ne', 'Ni', 'Te', 'Ti', 'Fi', 'Se']
  const handleOpenSkillTree = useCallback(() => {
    if (!ASPECTS_WITH_SKILL_TREE.includes(state.currentAspect)) {
      showToast('У этой планеты пока нет колеса навыков')
      return
    }
    setState(s => ({ ...s, screen: 'skill-tree' }))
  }, [state.currentAspect, setState, showToast])

  // Тык на навык в дереве:
  //   - Если passes=3 → ничего не делаем.
  //   - Если есть draft (юзер прерывал) → сразу продолжаем с того же места.
  //   - Иначе → открываем экран выбора режима (short / full).
  // Анкета лежит в currentLevel.surveys (отдельный массив, не в core-чате).
  const handleStartSkillSurvey = useCallback((skillId) => {
    const skillEntry = state.skills?.[skillId]
    const draft = skillEntry?.draft

    // ЧИ (Ne) — анкеты живут отдельно (NE_SURVEYS из ne-skills.js), не как
    // journey-скрипты. Используем синтетический scriptId. Аспект в
    // state остаётся 'Ne' (юзер пришёл из Колеса Ne).
    if (isNeSkill(skillId)) {
      if (draft) {
        setState(s => ({
          ...s,
          currentAspect: 'Ne',
          screen: 'survey',
          activeSurvey: {
            scriptId: `ne-survey-${skillId}`,
            skillId,
            mode: draft.mode ?? 'short',
            startPass: draft.startPass ?? 1,
            stepIndex: draft.stepIndex ?? 0,
            answers: draft.answers ?? {},
          },
        }))
        return
      }
      if (getNextPass(skillEntry) === 0) return
      setState(s => ({
        ...s,
        currentAspect: 'Ne',
        screen: 'survey-choice',
        activeSurvey: { scriptId: `ne-survey-${skillId}`, skillId },
      }))
      return
    }

    // БИ (Ni) — анкеты живут отдельно (NI_SURVEYS из ni-skills.js), не как
    // journey-скрипты. Аналогично Ne. Аспект в state остаётся 'Ni'
    // (юзер пришёл из Колеса Ni).
    if (isNiSkill(skillId)) {
      if (draft) {
        setState(s => ({
          ...s,
          currentAspect: 'Ni',
          screen: 'survey',
          activeSurvey: {
            scriptId: `ni-survey-${skillId}`,
            skillId,
            mode: draft.mode ?? 'short',
            startPass: draft.startPass ?? 1,
            stepIndex: draft.stepIndex ?? 0,
            answers: draft.answers ?? {},
          },
        }))
        return
      }
      if (getNextPass(skillEntry) === 0) return
      setState(s => ({
        ...s,
        currentAspect: 'Ni',
        screen: 'survey-choice',
        activeSurvey: { scriptId: `ni-survey-${skillId}`, skillId },
      }))
      return
    }

    // ЧЛ (Te) — анкеты живут отдельно (TE_SURVEYS из te-skills.js), не как
    // journey-скрипты. Аналогично Ne/Ni. Аспект в state остаётся 'Te'
    // (юзер пришёл из Колеса Te).
    if (isTeSkill(skillId)) {
      if (draft) {
        setState(s => ({
          ...s,
          currentAspect: 'Te',
          screen: 'survey',
          activeSurvey: {
            scriptId: `te-survey-${skillId}`,
            skillId,
            mode: draft.mode ?? 'short',
            startPass: draft.startPass ?? 1,
            stepIndex: draft.stepIndex ?? 0,
            answers: draft.answers ?? {},
          },
        }))
        return
      }
      if (getNextPass(skillEntry) === 0) return
      setState(s => ({
        ...s,
        currentAspect: 'Te',
        screen: 'survey-choice',
        activeSurvey: { scriptId: `te-survey-${skillId}`, skillId },
      }))
      return
    }

    // БЛ (Ti) — анкеты живут отдельно (TI_SURVEYS из ti-skills.js), не как
    // journey-скрипты. Аналогично Ne/Ni/Te. Аспект в state остаётся 'Ti'
    // (юзер пришёл из Колеса Ti).
    if (isTiSkill(skillId)) {
      if (draft) {
        setState(s => ({
          ...s,
          currentAspect: 'Ti',
          screen: 'survey',
          activeSurvey: {
            scriptId: `ti-survey-${skillId}`,
            skillId,
            mode: draft.mode ?? 'short',
            startPass: draft.startPass ?? 1,
            stepIndex: draft.stepIndex ?? 0,
            answers: draft.answers ?? {},
          },
        }))
        return
      }
      if (getNextPass(skillEntry) === 0) return
      setState(s => ({
        ...s,
        currentAspect: 'Ti',
        screen: 'survey-choice',
        activeSurvey: { scriptId: `ti-survey-${skillId}`, skillId },
      }))
      return
    }

    // БЭ (Fi) — анкеты живут отдельно (FI_SURVEYS из fi-skills.js), не как
    // journey-скрипты. Аналогично Ne/Ni/Te. Аспект в state остаётся 'Fi'
    // (юзер пришёл из Колеса Fi).
    if (isFiSkill(skillId)) {
      if (draft) {
        setState(s => ({
          ...s,
          currentAspect: 'Fi',
          screen: 'survey',
          activeSurvey: {
            scriptId: `fi-survey-${skillId}`,
            skillId,
            mode: draft.mode ?? 'short',
            startPass: draft.startPass ?? 1,
            stepIndex: draft.stepIndex ?? 0,
            answers: draft.answers ?? {},
          },
        }))
        return
      }
      if (getNextPass(skillEntry) === 0) return
      setState(s => ({
        ...s,
        currentAspect: 'Fi',
        screen: 'survey-choice',
        activeSurvey: { scriptId: `fi-survey-${skillId}`, skillId },
      }))
      return
    }

    // ЧС (Se) — анкеты живут отдельно (SE_SURVEYS из se-skills.js), не как
    // journey-скрипты. Аналогично Ne/Ni/Te/Fi. Аспект в state остаётся 'Se'
    // (юзер пришёл из Колеса Se).
    if (isSeSkill(skillId)) {
      if (draft) {
        setState(s => ({
          ...s,
          currentAspect: 'Se',
          screen: 'survey',
          activeSurvey: {
            scriptId: `se-survey-${skillId}`,
            skillId,
            mode: draft.mode ?? 'short',
            startPass: draft.startPass ?? 1,
            stepIndex: draft.stepIndex ?? 0,
            answers: draft.answers ?? {},
          },
        }))
        return
      }
      if (getNextPass(skillEntry) === 0) return
      setState(s => ({
        ...s,
        currentAspect: 'Se',
        screen: 'survey-choice',
        activeSurvey: { scriptId: `se-survey-${skillId}`, skillId },
      }))
      return
    }

    // Определяем аспект по skill ID. У Fe-навыков id с префиксом `fe-`,
    // их анкеты живут инлайн в core (CSURV-1..3 в Fe/l0.md), у Si —
    // в отдельном пуле levels[0].surveys.
    const aspect = skillId.startsWith('fe-') ? 'Fe' : 'Si'
    const journeyData = getJourney(aspect)

    // Ищем survey-шаг и в core, и в surveys-pool — для ЧЭ они лежат в core,
    // для БС — в surveys.
    const allSteps = [
      ...(journeyData?.levels?.[0]?.surveys ?? []),
      ...(journeyData?.levels?.[0]?.core ?? [])
    ]
    const target = allSteps.find(s => s.type === 'survey' && s.skill === skillId)
    if (!target) return

    if (draft) {
      // Продолжаем как было — без выбора. currentScriptId не трогаем:
      // он нужен для chat-flow (core-шагов), а survey-id в нём только
      // путает resolveScript при возврате в чат.
      // Аспект переключаем на нужный (БС или ЧЭ), сбрасываем awaitingInput.
      setState(s => updateAspect(
        {
          ...s,
          currentAspect: aspect,
          screen: 'survey',
          activeSurvey: {
            scriptId: target.id,
            skillId,
            mode: draft.mode ?? 'short',
            startPass: draft.startPass ?? 1,
            stepIndex: draft.stepIndex ?? 0,
            answers: draft.answers ?? {},
          },
        },
        cur => ({ ...cur, awaitingInput: null })
      ))
      return
    }

    if (getNextPass(skillEntry) === 0) return  // всё пройдено

    // Открываем экран выбора. activeSurvey временно хранит skillId/scriptId,
    // mode выберется на следующем шаге.
    setState(s => updateAspect(
      {
        ...s,
        currentAspect: aspect,
        screen: 'survey-choice',
        activeSurvey: { scriptId: target.id, skillId },  // mode появится после choose
      },
      cur => ({ ...cur, awaitingInput: null })
    ))
  }, [state.skills, setState])

  // Юзер выбрал режим в SurveyChoice. Стартуем активную анкету.
  const handleChooseSurveyMode = useCallback((mode) => {
    setState(s => {
      const active = s.activeSurvey
      if (!active) return s
      const skillEntry = s.skills?.[active.skillId]
      const startPass = getNextPass(skillEntry) || 1
      return {
        ...s,
        screen: 'survey',
        activeSurvey: {
          ...active,
          mode,
          startPass,
          stepIndex: 0,
          // Накопленные ответы предыдущих проходов сохраняем, чтобы в новых
          // слотах писать дальше.
          answers: skillEntry?.answers ?? {},
        },
      }
    })
  }, [setState])

  const goToScreen = useCallback((screen) => {
    setState(s => ({ ...s, screen }))
  }, [setState])

  // Вспомогательное: если открыта анкета — сохраняем её черновик в
  // state.skills[id].draft и закрываем модалку. Возвращает state с
  // обнулёнными activeSurvey/skillDetailId. Используется при свободном
  // переключении планеты, чтобы не терять заполненную часть.
  const dismissActiveSurveyToDraft = useCallback((s) => {
    if (!s.activeSurvey) return { ...s, skillDetailId: null }
    const { skillId, mode, startPass, stepIndex, answers } = s.activeSurvey
    const skillEntry = s.skills?.[skillId] ?? {}
    return {
      ...s,
      activeSurvey: null,
      skillDetailId: null,
      skills: {
        ...s.skills,
        [skillId]: {
          ...skillEntry,
          draft: { mode, startPass, stepIndex, answers: answers ?? {} },
        },
      },
    }
  }, [])

  // Открыть Карту Планет. Если открыта анкета — сохраняем её draft.
  const handleOpenPlanetMap = useCallback(() => {
    setState(s => ({ ...dismissActiveSurveyToDraft(s), screen: 'planets' }))
  }, [setState, dismissActiveSurveyToDraft])

  // Переключение на другой аспект. Сохраняет анкету (если открыта) в
  // draft, ставит currentAspect, переводит экран в 'chat'.
  // Если у нового аспекта папки ещё нет (первый заход) — инжектим intro
  // нового аспекта + первый скрипт L0, чтобы юзер сразу попал в чат.
  // Иначе — возвращаемся к сохранённому состоянию.
  const handleSwitchAspect = useCallback((aspectKey) => {
    if (!aspectKey) return
    setState(s => {
      const cleaned = dismissActiveSurveyToDraft(s)
      const existing = cleaned.aspects?.[aspectKey]
      const isFresh = !existing || (
        !existing.messages?.length && !existing.currentScriptId
      )

      let folder = existing ?? { ...DEFAULT_ASPECT_STATE }
      if (isFresh) {
        const j = getJourney(aspectKey)
        const intro = j?.intro ?? []
        const firstScript = (j?.levels?.[0]?.core ?? j?.levels?.[0]?.scripts ?? [])[0]
        const msgs = []
        let idCounter = Date.now()
        for (let i = 0; i < intro.length; i++) {
          const e = intro[i]
          // intro[i>0] обычно содержит button — рисуем «псевдо-клик» юзера
          // перед ответным текстом бота, чтобы интро читалось как диалог.
          if (i > 0 && e.button) {
            msgs.push({ id: idCounter++, role: 'user', text: e.button })
          }
          if (e.text) {
            msgs.push({ id: idCounter++, role: 'bot', text: e.text })
          }
        }
        if (firstScript) {
          msgs.push({
            id: idCounter++,
            role: 'bot',
            kind: 'script',
            scriptId: firstScript.id,
            level: 0,
          })
        }
        folder = {
          ...DEFAULT_ASPECT_STATE,
          currentScriptId: firstScript?.id ?? null,
          currentScriptIndex: 0,
          messages: msgs,
        }
      }

      return {
        ...cleaned,
        currentAspect: aspectKey,
        screen: 'chat',
        // Переключение на любую планету закрывает общий онбординг.
        onboardingStep: Math.max(cleaned.onboardingStep ?? 0, 6),
        aspects: { ...(cleaned.aspects ?? {}), [aspectKey]: folder },
      }
    })
  }, [setState, dismissActiveSurveyToDraft])

  // ─── Админ-действия (видимы только при isAdmin) ──────────────
  // Все хендлеры обходят геймификацию: XP не выдаём, в дневник
  // не пишем, через addBotMessage не отвечаем.

  // 1. Пропустить текущий шаг в чате — просто двигаем currentScriptIndex.
  const handleAdminSkipStep = useCallback(() => {
    setState(s => updateAspect(s, cur => ({ ...cur, awaitingInput: null })))
    setTimeout(() => deliverScript(a.currentScriptIndex + 1), 50)
  }, [deliverScript, a.currentScriptIndex])

  // 2. Заполнить активную анкету. Все утверждения текущей сессии = 7.
  //    Сдвигаем stepIndex за конец → SurveyScreen.useEffect → survey-insight.
  //    resolveSurvey работает для всех аспектов (Si/Fe/Ne/Ni/Te/Fi).
  const handleAdminFillSurvey = useCallback(() => {
    setState(s => {
      if (!s.activeSurvey) return s
      const survey = resolveSurvey(s.activeSurvey.skillId)
      if (!survey) return s
      const mode = s.activeSurvey.mode ?? 'short'
      const startPass = s.activeSurvey.startPass ?? 1
      const stmts = buildSurveyStatements(survey, mode, startPass)
      const answers = { ...(s.activeSurvey.answers ?? {}) }
      for (const stm of stmts) {
        const arr = answers[stm.blockKey] ? [...answers[stm.blockKey]] : []
        arr[stm.statementIndex] = 7
        answers[stm.blockKey] = arr
      }
      return {
        ...s,
        activeSurvey: {
          ...s.activeSurvey,
          answers,
          stepIndex: stmts.length,
        },
      }
    })
  }, [setState])

  // 3. Заполнить все навыки 7/10 (полностью все 3 прохода).
  //    Охватывает все аспекты, у которых есть skill-tree:
  //    Si / Fe / Ne / Ni / Te / Fi. Анкета по skillId резолвится через
  //    resolveSurvey() — он сам выбирает нужный *_SURVEYS-словарь.
  //    Сразу пересчитываем средние по всем 6.
  const handleAdminFillAllSkills = useCallback(() => {
    const completedAt = Date.now()
    const newSkills = {}
    const fillFromIds = (skillIds) => {
      for (const skillId of skillIds) {
        const survey = resolveSurvey(skillId)
        const blocks = {}
        const answers = {}
        if (survey) {
          for (const key of SURVEY_BLOCK_KEYS) {
            const arr = survey.blocks[key] ?? []
            if (arr.length > 0) {
              blocks[key] = 7
              answers[key] = arr.map(() => 7)
            }
          }
        } else {
          for (const key of SURVEY_BLOCK_KEYS) blocks[key] = 7
        }
        newSkills[skillId] = {
          result: 7,
          blocks,
          completedAt,
          answers,
          passes: 3,
          insights: [],
          _admin: true
        }
      }
    }
    fillFromIds(ALL_SKILL_IDS)     // Si
    fillFromIds(FE_SKILL_IDS)      // Fe
    fillFromIds(NE_SKILL_IDS)      // Ne
    fillFromIds(NI_SKILL_IDS)      // Ni
    fillFromIds(TE_SKILL_IDS)      // Te
    fillFromIds(TI_SKILL_IDS)      // Ti
    fillFromIds(FI_SKILL_IDS)      // Fi
    fillFromIds(SE_SKILL_IDS)      // Se

    setState(s => ({ ...s, skills: newSkills }))

    const next = { ...scores }
    const si = calcSiScoreFromSkills(newSkills)
    const fe = calcFeScoreFromSkills(newSkills)
    const ne = calcNeScoreFromSkills(newSkills)
    const ni = calcNiScoreFromSkills(newSkills)
    const te = calcTeScoreFromSkills(newSkills)
    const ti = calcTiScoreFromSkills(newSkills)
    const fi = calcFiScoreFromSkills(newSkills)
    const se = calcSeScoreFromSkills(newSkills)
    if (Number.isFinite(si)) next['Si'] = Math.round(si)
    if (Number.isFinite(fe)) next['Fe'] = Math.round(fe)
    if (Number.isFinite(ne)) next['Ne'] = Math.round(ne)
    if (Number.isFinite(ni)) next['Ni'] = Math.round(ni)
    if (Number.isFinite(te)) next['Te'] = Math.round(te)
    if (Number.isFinite(ti)) next['Ti'] = Math.round(ti)
    if (Number.isFinite(fi)) next['Fi'] = Math.round(fi)
    if (Number.isFinite(se)) next['Se'] = Math.round(se)
    onScoresChange(next)
  }, [scores, onScoresChange, setState])

  // 4. Прыжок на конкретный уровень. Сбрасываем core-индекс, подаём
  //    первый скрипт в чат. Если уровня нет — no-op.
  const handleAdminJumpLevel = useCallback((targetLevel) => {
    const lvlData = currentJourney?.levels?.[targetLevel]
    if (!lvlData) return
    const first = (lvlData.core ?? lvlData.scripts ?? [])[0]
    setState(s => updateAspect(
      { ...s, screen: 'chat', activeSurvey: null },
      cur => ({
        ...cur,
        currentLevel: targetLevel,
        currentScriptIndex: 0,
        currentScriptId: first?.id ?? null,
        awaitingInput: null,
        messages: first
          ? [...cur.messages, { id: Date.now() + Math.random(), role: 'bot', kind: 'script', scriptId: first.id, level: targetLevel }]
          : cur.messages
      })
    ))
  }, [currentJourney, setState])

  // 5. Полный сброс journey-state. Без подтверждения.
  const handleAdminReset = useCallback(() => {
    setState(DEFAULT_JOURNEY)
  }, [setState])

  // 6. Открыть гранулярный редактор навыков.
  const handleOpenSkillsEditor = useCallback(() => {
    setState(s => ({ ...s, screen: 'admin-skills' }))
  }, [setState])

  // 7. Применить правки из редактора. edits = { [skillId]: { enabled, value, passes } }
  //    enabled=true  → перезаписываем skillId на новые значения
  //    enabled=false → удаляем skillId из state.skills (если есть)
  const handleAdminApplyEdits = useCallback((edits) => {
    const completedAt = Date.now()
    const newSkills = { ...(state.skills ?? {}) }
    for (const [id, e] of Object.entries(edits ?? {})) {
      if (!e?.enabled) {
        // Disabled — удаляем navыk если был.
        if (newSkills[id]) delete newSkills[id]
        continue
      }
      // resolveSurvey покрывает все аспекты, не только БС.
      const survey = resolveSurvey(id)
      const blocks = {}
      const answers = {}
      if (survey) {
        for (const k of SURVEY_BLOCK_KEYS) {
          const arr = survey.blocks[k] ?? []
          if (arr.length > 0) {
            blocks[k] = e.value
            answers[k] = arr.slice(0, e.passes).map(() => e.value)
          }
        }
      } else {
        for (const k of SURVEY_BLOCK_KEYS) blocks[k] = e.value
      }
      newSkills[id] = {
        result: e.value,
        blocks,
        answers,
        passes: e.passes,
        insights: [],
        completedAt,
        _admin: true,
      }
    }
    setState(s => ({ ...s, skills: newSkills, screen: 'skill-tree' }))
    const bs  = calcSiScoreFromSkills(newSkills)
    const che = calcFeScoreFromSkills(newSkills)
    const ne  = calcNeScoreFromSkills(newSkills)
    const ni  = calcNiScoreFromSkills(newSkills)
    const te  = calcTeScoreFromSkills(newSkills)
    const ti  = calcTiScoreFromSkills(newSkills)
    const fi  = calcFiScoreFromSkills(newSkills)
    const se  = calcSeScoreFromSkills(newSkills)
    const next = { ...scores }
    if (Number.isFinite(bs))  next['Si'] = Math.round(bs)
    if (Number.isFinite(che)) next['Fe'] = Math.round(che)
    if (Number.isFinite(ne))  next['Ne'] = Math.round(ne)
    if (Number.isFinite(ni))  next['Ni'] = Math.round(ni)
    if (Number.isFinite(te))  next['Te'] = Math.round(te)
    if (Number.isFinite(ti))  next['Ti'] = Math.round(ti)
    if (Number.isFinite(fi))  next['Fi'] = Math.round(fi)
    if (Number.isFinite(se))  next['Se'] = Math.round(se)
    onScoresChange(next)
  }, [state.skills, scores, onScoresChange, setState])

  const currentScript = scripts[a.currentScriptIndex]
  const progressPct = scripts.length > 0
    ? Math.round((a.currentScriptIndex / scripts.length) * 100)
    : 0

  // «Плоский» вид state для совместимости с детьми, которые читают
  // state.currentLevel / state.messages / state.awaitingInput / ... напрямую.
  // После рефакторинга эти поля живут в state.aspects[currentAspect],
  // но мерджим их сверху, чтобы не править все child-компоненты.
  const stateForChildren = { ...state, ...a }

  return (
    <div className={styles.shell} style={{ '--accent': accent }}>
      <div className={styles.stars} />

      {state.screen === 'onboarding' && (
        <Onboarding
          state={stateForChildren}
          accent={accent}
          isTyping={isTyping}
          chatRef={chatRef}
          onNext={handleOnboardingNext}
          aspectIntro={aspectIntro}
        />
      )}

      {state.screen === 'chat' && (
        <Chat
          state={stateForChildren}
          accent={accent}
          chatRef={chatRef}
          inputRef={inputRef}
          isTyping={isTyping}
          inputVal={inputVal}
          setInputVal={setInputVal}
          currentScript={currentScript}
          scripts={scripts}
          resolveScript={resolveScript}
          onAction={handleScriptAction}
          onSend={handleSend}
          onOpenProfile={() => goToScreen('profile')}
          onOpenTasks={() => goToScreen('tasks')}
          onGoToSurveys={handleOpenSkillTree}
          onOpenPlanetMap={handleOpenPlanetMap}
          // Пилюля «Оценить навыки» появляется только после L0 (или для админа).
          // Прогресс считается по skill-tree активного аспекта.
          surveyRemaining={(() => {
            if (!isAdmin && (a.currentLevel ?? 0) < 1) return 0
            const sk = state.skills ?? {}
            switch (state.currentAspect) {
              case 'Si': return getSkillProgress(sk).remaining
              case 'Fe': return getFeSkillProgress(sk).remaining
              case 'Ne': return getNeSkillProgress(sk).remaining
              case 'Ni': return getNiSkillProgress(sk).remaining
              case 'Te': return getTeSkillProgress(sk).remaining
              case 'Ti': return getTiSkillProgress(sk).remaining
              case 'Fi': return getFiSkillProgress(sk).remaining
              case 'Se': return getSeSkillProgress(sk).remaining
              default:   return 0
            }
          })()}
          pendingCount={a.pendingTasks?.length ?? 0}
          aspectName={currentJourney
            ? `Уровень ${a.currentLevel} · ${currentLevel?.title}`
            : 'Путешествие'}
          planet={currentJourney?.planet}
          user={user}
        />
      )}

      {state.screen === 'levelcomplete' && (() => {
        // На L0 после прохождения core — primary CTA «Открыть Колесо аспекта»
        // (skill-tree). Для БС — если у уровня есть анкеты (surveys).
        // Для ЧИ/БИ/ЧЛ/БЭ/ЧЭ — всегда (анкеты живут отдельно).
        const isNe = state.currentAspect === 'Ne'
        const isNi = state.currentAspect === 'Ni'
        const isTe = state.currentAspect === 'Te'
        const isFi = state.currentAspect === 'Fi'
        const isFe = state.currentAspect === 'Fe'
        const hasSurveys = (currentLevel?.surveys?.length ?? 0) > 0
        const showWheel = a.currentLevel === 0 && (hasSurveys || isNe || isNi || isTe || isFi || isFe)
        const wheelLabel = isNe
          ? 'Открыть Колесо ЧИ'
          : isNi
            ? 'Открыть Колесо БИ'
            : isTe
              ? 'Открыть Колесо ЧЛ'
              : isFi
                ? 'Открыть Колесо БЭ'
                : isFe
                  ? 'Открыть Колесо ЧЭ'
                  : 'Открыть Колесо БС'
        // Для Fe на L0 показываем третью кнопку — «Изучить универсальные навыки».
        // Открывает FeCoreOverview с 3 ядерными карточками (fe-awareness/expressiveness/congruence).
        const showCoreOverview = isFe && a.currentLevel === 0
        return (
          <LevelComplete
            state={stateForChildren}
            accent={accent}
            completeText={currentLevel?.complete?.text ?? ''}
            levelTitle={currentLevel?.title}
            planetName={currentJourney?.planet}
            wheelLabel={wheelLabel}
            onProfile={() => goToScreen('profile')}
            nextLevelTitle={nextLevel?.title}
            onNextLevel={nextLevel ? handleNextLevel : null}
            onOpenWheel={showWheel ? handleOpenSkillTree : null}
            onOpenCoreOverview={showCoreOverview ? () => goToScreen('fe-core-overview') : null}
            coreOverviewLabel="Изучить универсальные навыки"
          />
        )
      })()}

      {state.screen === 'profile' && (
        <JourneyProfile
          state={stateForChildren}
          accent={accent}
          totalSteps={scripts.length}
          progressPct={progressPct}
          levelTitle={currentLevel?.title}
          planet={currentJourney?.planet}
          aspectName={ASPECT_DATA[state.currentAspect]?.name ?? 'Путешествие'}
          // Возврат в чат должен очистить активную анкету: иначе её
          // SURV-script-карточка всплывает в chat-ленте через resolveScript
          // (который теперь fallback-ит в currentLevel.surveys), и юзер
          // вместо чата видит заглушку «Анкета по навыку БС…».
          // Прогресс анкеты сохраняем как draft в state.skills, чтобы юзер
          // мог продолжить с того же места из дерева навыков.
          onContinue={() => {
            setState(s => {
              let nextSkills = s.skills
              const active = s.activeSurvey
              if (active) {
                const hasAnyAnswer = Object.values(active.answers ?? {}).some(arr =>
                  Array.isArray(arr) && arr.some(n => Number.isFinite(n))
                )
                if (hasAnyAnswer) {
                  const prevSkill = s.skills?.[active.skillId] ?? {}
                  nextSkills = {
                    ...s.skills,
                    [active.skillId]: {
                      ...prevSkill,
                      draft: {
                        mode: active.mode ?? 'short',
                        startPass: active.startPass ?? 1,
                        stepIndex: active.stepIndex ?? 0,
                        answers: active.answers,
                      }
                    }
                  }
                }
              }
              const cur = aspectOf(s)
              return updateAspect(
                {
                  ...s,
                  skills: nextSkills,
                  activeSurvey: null,
                  screen: cur.currentScriptIndex >= scripts.length ? 'levelcomplete' : 'chat',
                },
                folder => ({ ...folder, awaitingInput: null })
              )
            })
          }}
          onReset={handleReset}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && (
        <SkillTreeIntroHint user={user} />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Ne' && (
        <NeSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Ni' && (
        <NiSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenSkillDetail={handleOpenSkillDetail}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Fe' && (
        <FeSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenSkillDetail={handleOpenSkillDetail}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Si' && (
        <SkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenSkillDetail={handleOpenSkillDetail}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Te' && (
        <TeSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Ti' && (
        <TiSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Fi' && (
        <FiSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-tree' && state.currentAspect === 'Se' && (
        <SeSkillTree
          accent={accent}
          skills={state.skills ?? {}}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'chat')}
          onStartSkill={handleStartSkillSurvey}
          onOpenPlanetMap={handleOpenPlanetMap}
        />
      )}

      {state.screen === 'skill-detail' && state.skillDetailId && (
        <SkillDetail
          skillId={state.skillDetailId}
          currentLevel={a.currentLevel ?? 0}
          passes={getCompletedPasses(state.skills?.[state.skillDetailId])}
          accent={accent}
          onClose={() => goToScreen('skill-tree')}
          onOpenTraits={(id) => setState(s => ({ ...s, skillDetailId: id, screen: 'skill-traits' }))}
          onSaveInsight={handleSaveSkillInsight}
        />
      )}

      {state.screen === 'skill-traits' && state.skillDetailId && (
        <SkillTraits
          skillId={state.skillDetailId}
          currentLevel={a.currentLevel ?? 0}
          passes={getCompletedPasses(state.skills?.[state.skillDetailId])}
          accent={accent}
          onSaveInsight={handleSaveSkillInsight}
          onClose={() => goToScreen('skill-detail')}
        />
      )}

      {state.screen === 'fe-core-overview' && (
        <FeCoreOverview
          accent={accent}
          onOpenSkill={(id) => setState(s => ({ ...s, skillDetailId: id, screen: 'skill-detail' }))}
          onClose={() => goToScreen(state.onboardingStep < 6 ? 'onboarding' : 'levelcomplete')}
        />
      )}

      {state.screen === 'survey-choice' && state.activeSurvey && (() => {
        // Найдём имя навыка для заголовка — сначала через resolveSurvey (универсально для всех аспектов),
        // потом через БС-дерево как фолбэк для случая, когда анкета ещё не загружена.
        let name = state.activeSurvey.skillId
        const survey = resolveSurvey(state.activeSurvey.skillId)
        if (survey?.name) {
          name = survey.name
        } else {
          for (const arche of ARCHETYPE_KEYS) {
            const found = (SKILL_TREE[arche] ?? []).find(s => s.id === state.activeSurvey.skillId)
            if (found) { name = found.name; break }
          }
        }
        return (
          <SurveyChoice
            skillId={state.activeSurvey.skillId}
            skillName={name}
            skillEntry={state.skills?.[state.activeSurvey.skillId]}
            accent={accent}
            onChoose={handleChooseSurveyMode}
            onCancel={() => goToScreen('skill-tree')}
          />
        )
      })()}

      {state.screen === 'survey' && state.activeSurvey && (
        <SurveyScreen
          activeSurvey={state.activeSurvey}
          accent={accent}
          onAnswer={handleSurveyAnswer}
          onBack={handleSurveyBack}
          onComplete={handleSurveyComplete}
          onCancel={handleSurveyCancel}
        />
      )}

      {state.screen === 'survey-insight' && state.activeSurvey && (
        <SurveyInsight
          activeSurvey={state.activeSurvey}
          accent={accent}
          currentLevel={a.currentLevel ?? 0}
          onSave={handleSurveyInsight}
          onCancel={handleSurveyCancel}
        />
      )}

      {state.screen === 'admin-skills' && isAdmin && (
        <AdminSkillsEditor
          skills={state.skills ?? {}}
          onApply={handleAdminApplyEdits}
          onClose={() => goToScreen('skill-tree')}
        />
      )}

      {state.screen === 'planets' && (
        <PlanetMap
          state={state}
          user={user}
          onSwitch={handleSwitchAspect}
          onClose={() => goToScreen('chat')}
          onLockedTap={() => showToast('Эта планета пока закрыта')}
        />
      )}

      {state.screen === 'tasks' && (
        <TasksScreen
          tasks={a.pendingTasks ?? []}
          // Лукап тасок ищет по scriptId — в задачах могут быть core-скрипты
          // и survey-шаги (отложенные анкеты).
          scripts={[...scripts, ...(currentLevel?.surveys ?? [])]}
          accent={accent}
          onBack={() => goToScreen('chat')}
          onCompleteWithNote={(script, noteText) => {
            removePending(script.id)
            awardXP(script.xp ?? 0, script.stardust ?? 0, script.id)
            onDiaryChange([
              {
                id: Date.now(),
                date: new Date().toLocaleDateString('ru-RU'),
                ts: Date.now(),
                aspect: state.currentAspect,
                text: noteText,
                source: 'journey',
                scriptId: script.id,
                promptTitle: script.title,
                prompt: script.text
              },
              ...(diary ?? [])
            ])
          }}
          onDelete={(scriptId) => removePending(scriptId)}
        />
      )}

      {toast && <div className={styles.toast}>{toast}</div>}

      {isAdmin && (
        <AdminPanel
          state={stateForChildren}
          aspect={state.currentAspect}
          onSkipStep={handleAdminSkipStep}
          onFillSurvey={handleAdminFillSurvey}
          onFillAllSkills={handleAdminFillAllSkills}
          onOpenSkillsEditor={handleOpenSkillsEditor}
          onJumpLevel={handleAdminJumpLevel}
          onReset={handleAdminReset}
          onSwitchAspect={handleSwitchAspect}
        />
      )}
    </div>
  )
}
