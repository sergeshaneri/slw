import { FE_CORE_BLOCKS, FE_NON_CORE_BLOCKS } from '../../data/skills/Fe/skill-blocks'
import { SI_CORE_BLOCKS, SI_NON_CORE_BLOCKS } from '../../data/skills/Si/skill-blocks'
import { NE_CORE_BLOCKS, NE_NON_CORE_BLOCKS } from '../../data/skills/Ne/skill-blocks'
import { FI_CORE_BLOCKS, FI_NON_CORE_BLOCKS } from '../../data/skills/Fi/skill-blocks'
import { HALL_CONTENT } from '../../data/hallContent'

// Утилита для блоков
const truncate = (s, n) => {
  if (!s) return ''
  const v = String(s).replace(/\s+/g, ' ').trim()
  return v.length > n ? v.slice(0, n - 1) + '…' : v
}

// Извлечение «комментабельных пунктов» из блока для дропдауна
// «К чему именно записать заметку?». Возвращает [{id, label, text}].
export function getBlockItems(block, data) {
  const { kind, field, id: blockId } = block
  switch (kind) {
    case 'list': {
      const items = data[field] || []
      return items.map((it, i) => ({
        id: `${blockId}-${i}`,
        label: truncate(it, 64),
        text: it
      }))
    }
    case 'numberedList': {
      const items = data[field] || []
      return items.map((it, i) => ({
        id: `${blockId}-${i}`,
        label: `${i + 1}. ${truncate(it, 60)}`,
        text: it
      }))
    }
    case 'archetypes': {
      const out = []
      data.archetypes?.shadow?.forEach((it, i) => out.push({
        id: `${blockId}-shadow-${i}`,
        label: `Тень: ${truncate(it, 50)}`,
        text: it
      }))
      data.archetypes?.gift?.forEach((it, i) => out.push({
        id: `${blockId}-gift-${i}`,
        label: `Дар: ${truncate(it, 50)}`,
        text: it
      }))
      return out
    }
    case 'dilemmas': {
      return (data.dilemmas ?? []).flatMap((d, i) => [
        { id: `${blockId}-${i}-shadow`, label: `${d.t} — тень`, text: `${d.t} — тень: ${d.s}` },
        { id: `${blockId}-${i}-gift`, label: `${d.t} — дар`, text: `${d.t} — дар: ${d.g}` }
      ])
    }
    case 'integration': {
      const out = []
      if (data.integration?.desc) {
        out.push({
          id: `${blockId}-desc`,
          label: 'Описание интеграции',
          text: data.integration.desc
        })
      }
      data.integration?.practices?.forEach((p, i) => out.push({
        id: `${blockId}-p-${i}`,
        label: p.name,
        text: `${p.name}\n\n${p.desc}`
      }))
      return out
    }
    case 'synergy':
      return (data.synergy ?? []).map((s, i) => ({
        id: `${blockId}-${i}`,
        label: `${s.aspects} · ${s.name}`,
        text: `${s.aspects} — ${s.name}\n\n${s.desc}`
      }))
    case 'polysemy':
      return (data.polysemy ?? []).map((p, i) => ({
        id: `${blockId}-${i}`,
        label: p.word,
        text: `${p.word}\n${p.variants}`
      }))
    case 'practices':
      return (data.practices ?? []).map((p, i) => ({
        id: `${blockId}-${i}`,
        label: p.name,
        text: `${p.name}\n\n${p.desc}`
      }))
    case 'titledList': {
      const items = data[field] || []
      return items.map((p, i) => ({
        id: `${blockId}-${i}`,
        label: p.name,
        text: `${p.name}\n\n${p.desc}`
      }))
    }
    case 'archetypePath':
      return (data.archetypePath ?? []).map((p, i) => ({
        id: `${blockId}-${i}`,
        label: p.name,
        text: `${p.name}\n\nПредпосылка: ${p.prerequisite}\nГлавный урок: ${p.lesson}\nПереход: ${p.transition}`
      }))
    case 'fears':
      return [
        ...(data.fears ? [{ id: `${blockId}-fears`, label: 'Страхи', text: data.fears }] : []),
        ...(data.defenses ? [{ id: `${blockId}-defenses`, label: 'Защиты', text: data.defenses }] : [])
      ]
    case 'somatic': {
      const out = []
      data.somatic?.shadow?.forEach((it, i) => out.push({
        id: `${blockId}-shadow-${i}`,
        label: `Тень: ${truncate(it, 50)}`,
        text: it
      }))
      data.somatic?.gift?.forEach((it, i) => out.push({
        id: `${blockId}-gift-${i}`,
        label: `Дар: ${truncate(it, 50)}`,
        text: it
      }))
      return out
    }
    case 'assessment':
      return (data.selfAssessment ?? []).flatMap((mp, mi) =>
        mp.qs.map((q, qi) => ({
          id: `${blockId}-${mi}-${qi}`,
          label: `${mp.pole}: ${truncate(q, 50)}`,
          text: `Микрополе «${mp.pole}»\n\n${q}`
        }))
      )
    case 'skillBlocks': {
      const items = data[block.field] ?? []
      return items.flatMap((sk, i) => [
        { id: `${blockId}-${i}-suppression`, label: `${sk.name} — вытеснение`, text: sk.suppression },
        { id: `${blockId}-${i}-defense`, label: `${sk.name} — защита`, text: sk.defense }
      ])
    }
    case 'moneyPsychology': {
      const mp = data[block.field]
      if (!mp) return []
      const out = []
      if (mp.intro) out.push({ id: `${blockId}-intro`, label: 'Вводный текст', text: mp.intro })
      mp.sections?.forEach((s, i) => out.push({
        id: `${blockId}-section-${i}`,
        label: s.title,
        text: `${s.title}\n\n${s.desc}`
      }))
      mp.scenarios?.forEach((s, i) => out.push({
        id: `${blockId}-scenario-${i}`,
        label: s.title,
        text: `${s.title}\n\n${s.desc}`
      }))
      mp.signs?.forEach((sign, i) => out.push({
        id: `${blockId}-sign-${i}`,
        label: `Признак: ${truncate(sign, 50)}`,
        text: sign
      }))
      mp.practices?.forEach((p, i) => out.push({
        id: `${blockId}-practice-${i}`,
        label: p.title,
        text: `${p.title}\n\n${p.desc}`
      }))
      return out
    }
    case 'text':
    case 'textItalic':
    default:
      return []
  }
}

// Блоки по каждому аспекту в порядке, соответствующем файлу "Колесо БС LP":
// Уровень 0 — Первый контакт · Уровень 1 — Эпоха племён · Уровень 2 — Эпоха цивилизаций · Уровень 3 — Эпоха алхимии
//
// Каждая запись описывает один «главу» для экрана чтения. Блок показывается
// в оглавлении, только если для аспекта есть соответствующие данные.

export const LEVEL_LABELS = {
  0: { code: 'I', name: 'Первый контакт', hint: 'Знакомство с аспектом' },
  1: { code: 'II', name: 'Эпоха племён', hint: 'Навыки, цели и первые ритуалы' },
  2: { code: 'III', name: 'Эпоха цивилизаций', hint: 'Суперспособности и взаимодействие' },
  3: { code: 'IV', name: 'Эпоха алхимии', hint: 'Тени, страхи, соматика, трансформация' }
}

// Default teaser count per block kind. Используется когда блок заблокирован
// доступом по уровню — пользователю показывается N первых элементов как
// «попробуй вкус», остальное скрывается под blur+overlay.
const TEASER_BY_KIND = {
  text: 0,
  textItalic: 0,
  list: 2,
  numberedList: 2,
  titledList: 2,
  archetypes: 1,
  dilemmas: 1,
  integration: 0, // показываем описание + opposite, прячем practices
  synergy: 2,
  polysemy: 2,
  practices: 1,
  archetypePath: 1,
  fears: 1,
  somatic: 1,
  assessment: 1,
  skillBlocks: 1,
  moneyPsychology: 1,
}

// Возвращает «обрезанную» копию data — с первыми N элементами для блока,
// остальное скрыто. Используется для тизер-режима заблокированного блока.
// `n` берётся из block.teaserCount (опционально per-block override) или
// TEASER_BY_KIND[kind].
export function teaseBlockData(block, data) {
  const n = block.teaserCount ?? TEASER_BY_KIND[block.kind] ?? 2
  const out = { ...data }
  switch (block.kind) {
    case 'list':
    case 'numberedList':
      out[block.field] = (data[block.field] ?? []).slice(0, n)
      break
    case 'titledList':
      out[block.field] = (data[block.field] ?? []).slice(0, n)
      break
    case 'archetypes':
      out.archetypes = {
        shadow: (data.archetypes?.shadow ?? []).slice(0, n),
        gift: (data.archetypes?.gift ?? []).slice(0, n)
      }
      break
    case 'dilemmas':
      out.dilemmas = (data.dilemmas ?? []).slice(0, n)
      break
    case 'integration':
      // Показываем описание, скрываем практики (они под лок-плашкой).
      out.integration = data.integration
        ? { ...data.integration, practices: [] }
        : data.integration
      break
    case 'synergy':
      out.synergy = (data.synergy ?? []).slice(0, n)
      break
    case 'polysemy':
      out.polysemy = (data.polysemy ?? []).slice(0, n)
      break
    case 'practices':
      out.practices = (data.practices ?? []).slice(0, n)
      break
    case 'archetypePath':
      out.archetypePath = (data.archetypePath ?? []).slice(0, n)
      break
    case 'fears':
      // Показываем страхи, защиты прячем (под блюром).
      out.defenses = null
      break
    case 'somatic':
      out.somatic = {
        shadow: (data.somatic?.shadow ?? []).slice(0, n),
        gift: (data.somatic?.gift ?? []).slice(0, n)
      }
      break
    case 'assessment':
      out.selfAssessment = (data.selfAssessment ?? []).slice(0, n)
      break
    case 'skillBlocks':
      out[block.field] = (data[block.field] ?? []).slice(0, n)
      break
    case 'moneyPsychology': {
      // Тизер: только intro + первая секция, остальное скрыто под лок-оверлеем.
      const mp = data[block.field]
      out[block.field] = mp ? {
        ...mp,
        sections: (mp.sections ?? []).slice(0, n),
        scenarios: [],
        signs: [],
        practices: []
      } : mp
      break
    }
    case 'text':
      // Заголовок + лид остаются. Тело полностью прячется до разблокировки.
      out.essence = ''
      break
    case 'textItalic':
      out.superpower = ''
      break
    default:
      break
  }
  return out
}

export const BLOCKS = [
  // ── Уровень 0 ─────────────────────────────────────────────
  {
    id: 'essence',
    level: 0,
    title: 'Суть аспекта',
    lead: 'О чём этот аспект в одном абзаце.',
    kind: 'text',
    has: d => !!d.essence
  },
  {
    id: 'archetypes',
    level: 0,
    title: 'Тени и дары',
    lead: 'Два полюса — то, во что аспект соскальзывает в тени, и то, каким становится в даре.',
    kind: 'archetypes',
    has: d => !!d.archetypes
  },
  {
    id: 'feSkillBlocksCore',
    level: 0,
    title: 'Защиты ядерных навыков',
    lead: 'Психодинамика сопротивления развитию трёх ядерных навыков ЧЭ — вытеснение, защиты, ограничивающие убеждения, родовые программы. Открыто с самого начала.',
    kind: 'skillBlocks',
    field: 'feSkillBlocksCore',
    has: d => d.feSkillBlocksCore?.length > 0
  },
  {
    id: 'niSkillBlocksCore',
    level: 0,
    title: 'Защиты общих базовых навыков',
    lead: 'Психодинамика сопротивления развитию трёх общих базовых навыков БИ — Сонастройки, Слушания Подсознания и Внутренней Тишины. Вытеснение, защиты, ограничивающие убеждения, родовые программы. Открыто с самого начала.',
    kind: 'skillBlocks',
    field: 'niSkillBlocksCore',
    has: d => d.niSkillBlocksCore?.length > 0
  },
  {
    id: 'siSkillBlocksCore',
    level: 0,
    title: 'Защиты общих базовых навыков',
    lead: 'Психодинамика сопротивления развитию четырёх общих базовых навыков БС — Слушать тело, Осознавать потребности, Своевременно заботиться, Внимание к мелким деталям. Вытеснение, защиты, ограничивающие убеждения, родовые программы. Открыто с самого начала.',
    kind: 'skillBlocks',
    field: 'siSkillBlocksCore',
    has: d => d.siSkillBlocksCore?.length > 0
  },
  {
    id: 'teSkillBlocksCore',
    level: 0,
    title: 'Защиты универсальных навыков',
    lead: 'Психодинамика сопротивления развитию семи универсальных навыков ЧЛ — 4 сквозных (различение работы и суеты, удержание цели, видение затрат и отдачи, технологичность мышления) и 3 распределённых (прагматическое мышление, тайм-менеджмент, доведение до конца). Вытеснение, защиты, ограничивающие убеждения, родовые программы. Открыто с самого начала.',
    kind: 'skillBlocks',
    field: 'teSkillBlocksCore',
    has: d => d.teSkillBlocksCore?.length > 0
  },
  {
    id: 'neSkillBlocksCore',
    level: 0,
    title: 'Защиты общих базовых навыков',
    lead: 'Психодинамика сопротивления развитию трёх общих базовых навыков ЧИ — Внимание к сути, Метапознание, Mindfulness (зазор между стимулом и реакцией). Вытеснение, защиты, ограничивающие убеждения, родовые программы. Открыто с самого начала.',
    kind: 'skillBlocks',
    field: 'neSkillBlocksCore',
    has: d => d.neSkillBlocksCore?.length > 0
  },
  {
    id: 'fiSkillBlocksCore',
    level: 0,
    title: 'Защиты корневых навыков',
    lead: 'Психодинамика сопротивления развитию двух корневых навыков БЭ — Установление Доверия и Внутренняя Сверка с Ценностями. Вытеснение, защиты, ограничивающие убеждения, родовые программы. Открыто с самого начала.',
    kind: 'skillBlocks',
    field: 'fiSkillBlocksCore',
    has: d => d.fiSkillBlocksCore?.length > 0
  },
  {
    id: 'tiSkillBlocksCore',
    level: 0,
    title: 'Защиты универсальных базовых навыков',
    lead: 'Психодинамика сопротивления развитию трёх универсальных базовых навыков БЛ — Структурное мышление, Различение модальностей высказывания, Дисциплина Ума. Вытеснение, защиты, ограничивающие убеждения, родовые программы. Открыто с самого начала.',
    kind: 'skillBlocks',
    field: 'tiSkillBlocksCore',
    has: d => d.tiSkillBlocksCore?.length > 0
  },

  // ── Уровень 1 ─────────────────────────────────────────────
  {
    id: 'archetypePath',
    level: 1,
    title: 'Путь становления архетипов',
    lead: 'Предпосылки, главный урок и переход от тени к дару.',
    kind: 'archetypePath',
    has: d => d.archetypePath?.length > 0
  },
  {
    id: 'skills',
    level: 1,
    title: 'Психологические навыки',
    lead: 'Конкретные способности, через которые аспект проявляется в жизни.',
    kind: 'list',
    field: 'skills',
    has: d => d.skills?.length > 0
  },
  {
    id: 'coachTips',
    level: 1,
    title: 'Советы суперкоуча',
    lead: 'Короткие ориентиры от наставника, проходившего этот путь.',
    kind: 'numberedList',
    field: 'coachTips',
    has: d => d.coachTips?.length > 0
  },
  {
    id: 'goals',
    level: 1,
    title: 'Вопросы для желаний и целей',
    lead: 'Вопросы, которые помогают сформулировать, куда расти.',
    kind: 'numberedList',
    field: 'goals',
    has: d => d.goals?.length > 0
  },
  {
    id: 'assessment',
    level: 1,
    title: 'Самооценка по микрополям',
    lead: 'Вопросы для честного взгляда на себя. Ответы — в дневник.',
    kind: 'assessment',
    has: d => d.selfAssessment?.length > 0
  },
  {
    id: 'hallFigures',
    level: 1,
    title: 'Известные личности — в Холле',
    lead: 'Биографии и их связь с аспектом обсуждаются с сообществом в Холле.',
    kind: 'hallStub',
    hallSection: 'figures',
    has: (d, aspect) => (HALL_CONTENT?.[aspect]?.figures?.length ?? 0) > 0
  },
  {
    id: 'hallArts',
    level: 1,
    title: 'Искусство — в Холле',
    lead: 'Книги, фильмы и музыка по этому аспекту обсуждаются с сообществом в Холле.',
    kind: 'hallStub',
    hallSection: 'arts',
    has: (d, aspect) => (HALL_CONTENT?.[aspect]?.arts?.length ?? 0) > 0
  },
  {
    id: 'hallInterestingFacts',
    level: 2,
    title: 'Интересные факты — в Холле',
    lead: 'Научные, исторические и инженерные факты, расширяющие понимание аспекта. Показывается случайная тройка с возможностью обновить.',
    kind: 'hallStub',
    hallSection: 'interestingFacts',
    has: (d, aspect) => (HALL_CONTENT?.[aspect]?.interestingFacts?.length ?? 0) > 0
  },

  // ── Уровень 2 ─────────────────────────────────────────────
  {
    id: 'superpower',
    level: 2,
    title: 'Суперспособность',
    lead: 'То, что даёт этот аспект, когда он в ресурсе.',
    kind: 'textItalic',
    has: d => !!d.superpower
  },
  {
    id: 'integration',
    level: 2,
    title: 'Интеграция с противоположностью',
    lead: 'Как развивать пару-противоположность, чтобы усилить себя.',
    kind: 'integration',
    has: d => !!d.integration
  },
  {
    id: 'synergy',
    level: 2,
    title: 'Взаимодействие с другими аспектами',
    lead: 'Что получается в союзе с другими аспектами.',
    kind: 'synergy',
    has: d => d.synergy?.length > 0
  },
  {
    id: 'polysemy',
    level: 2,
    title: 'Ложные друзья аспекта',
    lead: 'Слова, которые в разных контекстах означают разные аспекты.',
    kind: 'polysemy',
    has: d => d.polysemy?.length > 0
  },
  {
    id: 'resources',
    level: 2,
    title: 'Ресурсные действия',
    lead: 'Конкретные дела, которые наполняют этот аспект.',
    kind: 'list',
    field: 'resources',
    has: d => d.resources?.length > 0
  },
  {
    id: 'practices',
    level: 2,
    title: 'Практики и упражнения',
    lead: 'Пошаговые упражнения для регулярной работы.',
    kind: 'practices',
    has: d => d.practices?.length > 0
  },
  {
    id: 'professions',
    level: 2,
    title: 'Профессии',
    lead: 'Где этот аспект становится профессиональным инструментом — от ремесленных ролей до публичных.',
    kind: 'titledList',
    field: 'professions',
    has: d => d.professions?.length > 0
  },
{
    id: 'characterTraits',
    level: 2,
    title: 'Психологический портрет',
    lead: 'Двенадцать ключевых черт зрелого носителя аспекта — с дарами и теневыми двойниками.',
    kind: 'titledList',
    field: 'characterTraits',
    has: d => d.characterTraits?.length > 0
  },
  {
    id: 'myths',
    level: 2,
    title: 'Мифы и Боги',
    lead: 'Мифологические образы и архетипы, в которых проступает аспект.',
    kind: 'titledList',
    field: 'myths',
    has: d => d.myths?.length > 0
  },
  {
    id: 'hallQuotes',
    level: 2,
    title: 'Цитаты — в Холле',
    lead: 'Подборка цитат обсуждается с сообществом в Холле.',
    kind: 'hallStub',
    hallSection: 'quotes',
    has: (d, aspect) => (HALL_CONTENT?.[aspect]?.quotes?.length ?? 0) > 0
  },
  {
    id: 'facts',
    level: 2,
    title: 'Интересные факты и исследования',
    lead: 'Факты из нейробиологии, психологии, культуры и истории, расширяющие понимание аспекта.',
    kind: 'titledList',
    field: 'facts',
    has: d => d.facts?.length > 0
  },

  // ── Уровень 3 ─────────────────────────────────────────────
  {
    id: 'dilemmas',
    level: 3,
    title: 'Ключевые дилеммы',
    lead: 'Внутренние развилки, с которыми живёт этот аспект.',
    kind: 'dilemmas',
    has: d => d.dilemmas?.length > 0
  },
  {
    id: 'redFlags',
    level: 3,
    title: 'Красные флаги',
    lead: 'Сигналы, что аспект уходит в тень.',
    kind: 'list',
    field: 'redFlags',
    has: d => d.redFlags?.length > 0
  },
  {
    id: 'fears',
    level: 3,
    title: 'Страхи и защиты',
    lead: 'Глубинные страхи и типичные механизмы защиты.',
    kind: 'fears',
    has: d => !!d.fears || !!d.defenses
  },
  {
    id: 'somatic',
    level: 3,
    title: 'Соматические маркеры',
    lead: 'Как аспект живёт в теле — в тени и в даре.',
    kind: 'somatic',
    has: d => !!d.somatic
  },
  {
    id: 'culturalDifferences',
    level: 3,
    title: 'Культурные отличия',
    lead: 'Как аспект преломляется в разных культурах — японской, французской, русской.',
    kind: 'numberedList',
    field: 'culturalDifferences',
    has: d => d.culturalDifferences?.length > 0
  },
  {
    id: 'childRaising',
    level: 3,
    title: 'Как привить ребёнку',
    lead: 'Практические пункты по передаче ценностей аспекта детям через действия и среду.',
    kind: 'titledList',
    field: 'childRaising',
    has: d => d.childRaising?.length > 0
  },
  {
    id: 'childhoodQuestions',
    level: 3,
    title: 'Вопросы про своё детство',
    lead: 'Вопросы для самоанализа: как этот аспект формировался в детстве, что в семейной истории его поддерживало или подавляло.',
    kind: 'numberedList',
    field: 'childhoodQuestions',
    has: d => d.childhoodQuestions?.length > 0
  },
  {
    id: 'feSkillBlocks',
    level: 3,
    title: 'Защиты и родовые программы по навыкам',
    lead: 'Глубинные блоки сопротивления для каждого из 31 архетипного и дополнительного навыка ЧЭ. Открывается на третьем уровне путешествия.',
    kind: 'skillBlocks',
    field: 'feSkillBlocks',
    has: d => d.feSkillBlocks?.length > 0
  },
  {
    id: 'niSkillBlocks',
    level: 3,
    title: 'Защиты и родовые программы по навыкам',
    lead: 'Глубинные блоки сопротивления для каждого из 40 архетипных навыков БИ — по 10 у Мифотворца, Провидца, Разоблачителя и Шамана. Открывается на третьем уровне путешествия.',
    kind: 'skillBlocks',
    field: 'niSkillBlocks',
    has: d => d.niSkillBlocks?.length > 0
  },
  {
    id: 'siSkillBlocks',
    level: 3,
    title: 'Защиты и родовые программы по навыкам',
    lead: 'Глубинные блоки сопротивления для каждого из 47 архетипных навыков БС — у Целителя (17), Эстета (8), Мастера Наслаждения (13) и Хранителя Очага (9). Вытеснение, защиты, ограничивающие убеждения, родовые программы. Открывается на третьем уровне путешествия.',
    kind: 'skillBlocks',
    field: 'siSkillBlocks',
    has: d => d.siSkillBlocks?.length > 0
  },
  {
    id: 'teSkillBlocks',
    level: 3,
    title: 'Защиты и родовые программы по навыкам',
    lead: 'Глубинные блоки сопротивления для каждого из 55 архетипных навыков ЧЛ — у Виртуоза (12), Технолога (14), Организатора (18, включая 4 финансовых навыка с расширенной денежной психологией) и Инженера (11). Вытеснение, защиты, ограничивающие убеждения, родовые программы. Открывается на третьем уровне путешествия.',
    kind: 'skillBlocks',
    field: 'teSkillBlocks',
    has: d => d.teSkillBlocks?.length > 0
  },
  {
    id: 'teMoneyPsychology',
    level: 3,
    title: 'Психология денег',
    lead: 'Общий пласт денежных блоков, проходящий через всю ЧЛ-практику Организатора. Деньги как символ собственной ценности и мера контакта с обществом; шесть глубинных сценариев; признаки блокировок; восемь практик проработки. Открывается на третьем уровне путешествия.',
    kind: 'moneyPsychology',
    field: 'teMoneyPsychology',
    has: d => !!d.teMoneyPsychology?.sections?.length
  },
  {
    id: 'neSkillBlocks',
    level: 3,
    title: 'Защиты и родовые программы по навыкам',
    lead: 'Глубинные блоки сопротивления для каждого из 33 архетипных навыков ЧИ — у Мудреца (7), Первооткрывателя (7), Катализатора (10) и Визионера (9). Вытеснение, защиты, ограничивающие убеждения, родовые программы. Открывается на третьем уровне путешествия.',
    kind: 'skillBlocks',
    field: 'neSkillBlocks',
    has: d => d.neSkillBlocks?.length > 0
  },
  {
    id: 'fiSkillBlocks',
    level: 3,
    title: 'Защиты и родовые программы по навыкам',
    lead: 'Глубинные блоки сопротивления для каждого из 56 архетипных навыков БЭ — у Дипломата (17), Духовника (14), Хранителя Рода (9) и Друга (16). Вытеснение, защиты, ограничивающие убеждения, родовые программы. Опираются на теорию привязанности (Боулби, Эйнсуорт), системную семейную терапию (Боуэн), schema therapy, трансгенерационную передачу (Шутценбергер, Хеллингер). Открывается на третьем уровне путешествия.',
    kind: 'skillBlocks',
    field: 'fiSkillBlocks',
    has: d => d.fiSkillBlocks?.length > 0
  },
  {
    id: 'tiSkillBlocks',
    level: 3,
    title: 'Защиты и родовые программы по навыкам',
    lead: 'Глубинные блоки сопротивления для каждого из 38 архетипных навыков БЛ — у Аналитика (8), Архитектора (7), Хранителя Порядка (11) и Энциклопедиста (12). Вытеснение, защиты, ограничивающие убеждения, родовые программы. Открывается на третьем уровне путешествия.',
    kind: 'skillBlocks',
    field: 'tiSkillBlocks',
    has: d => d.tiSkillBlocks?.length > 0
  }
]
