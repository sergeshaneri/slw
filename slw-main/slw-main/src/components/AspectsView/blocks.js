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
    id: 'historicalFigures',
    level: 1,
    title: 'Известные личности',
    lead: 'Двадцать фигур из истории — десять зрелых проявлений и десять теневых.',
    kind: 'titledList',
    field: 'historicalFigures',
    has: d => d.historicalFigures?.length > 0
  },
  {
    id: 'art',
    level: 1,
    title: 'Искусство',
    lead: 'Книги, фильмы, картины и музыка, в которых живёт сенсорная природа аспекта.',
    kind: 'titledList',
    field: 'art',
    has: d => d.art?.length > 0
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
    id: 'myths',
    level: 2,
    title: 'Мифы и Боги',
    lead: 'Мифологические образы и архетипы, в которых проступает аспект.',
    kind: 'titledList',
    field: 'myths',
    has: d => d.myths?.length > 0
  },
  {
    id: 'quotes',
    level: 2,
    title: 'Цитаты',
    lead: 'Подборка цитат — каждая с короткой привязкой к теме аспекта.',
    kind: 'titledList',
    field: 'quotes',
    has: d => d.quotes?.length > 0
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
  }
]
