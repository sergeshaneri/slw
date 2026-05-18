import { useEffect, useRef, useState } from 'react'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA, ASPECT_DISPLAY_KEY } from '../../data/aspects'
import { fetchHabitsToday, tickHabit, untickHabit } from '../../api/client'
import { tmaNotify } from '../../tma/hooks'
import type { AspectKey } from '@/types/aspect'
import type { DiaryEntry } from '@/types/diary'
import styles from './DiaryView.module.css'

// Backend table `user_habits` (one row per (user, aspect)). Endpoint
// /api/habits/today returns list (or { habits: [...] }) — нет
// response_model. Локальный тип.
// NOTE(ts): pending backend response_model for /api/habits/today.
type HabitToday = {
  aspect: AspectKey
  title: string
  ticked_today?: boolean
} & Record<string, unknown>

type Props = {
  diary: DiaryEntry[]
  onDiaryChange: (next: DiaryEntry[]) => void
}

// Подсказки-«вопросы дня» по каждому аспекту. Список — это лишь гайд,
// юзер пишет свободным текстом. Все блоки опциональны.
// Ключи — латинские (Si/Se/...) под внутренний state.
const ASPECT_PROMPTS: Record<AspectKey, string[]> = {
  Ne: [
    'Что нового',
    'Что творческого',
    'Какие инсайты',
    'Как раскрыл свой потенциал',
    'Что увидел впервые',
  ],
  Si: [
    'Как себя чувствовал',
    'Что ел',
    'Как о себе заботился',
    'Что улучшил в уровне жизни',
    'Где было комфортно или неудобно',
  ],
  Fe: [
    'Какие были эмоции',
    'Какие впечатления',
    'Как это влияло на твою энергию',
    'Что зажгло, а что погасило',
  ],
  Ti: [
    'Что изучил',
    'Что упорядочил',
    'Что воплотил в структуру',
    'Что продумал',
    'Какую систему собрал',
  ],
  Te: [
    'Что сделал по работе',
    'Улучшил в профессиональной деятельности',
    'Что для улучшения дохода',
    'Какой результат измерим',
  ],
  Fi: [
    'Уровень счастья',
    'С кем поддерживал контакт',
    'Что было в сфере отношений (с собой, семьёй, друзьями, работой, клиентами…)',
    'Что согрело',
  ],
  Se: [
    'Тренировки',
    'Вклад в опору по жизни',
    'Победы дня',
    'Приближение к цели',
    'Где проявил волю',
  ],
  Ni: [
    'Сны',
    'Знаки',
    'Насколько был в потоке',
    'Работа с подсознанием',
    'Что подсказала интуиция',
  ],
}

function todayPretty(): string {
  return new Date().toLocaleDateString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export default function DailyReview({ diary, onDiaryChange }: Props) {
  const [eventsText, setEventsText] = useState<string>('')
  const [aspectTexts, setAspectTexts] = useState<Partial<Record<AspectKey, string>>>({})
  // Раскрытые карточки аспектов — по умолчанию все свёрнуты, чтобы экран
  // не был стеной textarea. Юзер раскрывает только то, о чём хочет писать.
  const [expanded, setExpanded] = useState<Partial<Record<AspectKey, boolean>>>({})

  // Привычки на сегодня — фетчим один раз. Локальная галочка,
  // финальный sync с бэком при «Сохранить день».
  const [habits, setHabits] = useState<HabitToday[]>([])
  const [habitTicks, setHabitTicks] = useState<Partial<Record<AspectKey, boolean>>>({})
  const [habitsLoading, setHabitsLoading] = useState<boolean>(true)

  const [saving, setSaving] = useState<boolean>(false)
  const [saved, setSaved] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Рефы на каждую аспектную секцию + тик-счётчик для авто-скролла,
  // когда юзер раскрывает аккордеон, и низ секции уезжает под sticky
  // save-панель.
  const sectionRefs = useRef<Partial<Record<AspectKey, HTMLElement | null>>>({})
  const justOpenedRef = useRef<AspectKey | null>(null)
  const [scrollTick, setScrollTick] = useState<number>(0)

  useEffect(() => {
    let cancelled = false
    fetchHabitsToday()
      .then((list: unknown) => {
        if (cancelled) return
        const arr: HabitToday[] = Array.isArray(list)
          ? (list as HabitToday[])
          : (((list as { habits?: HabitToday[] } | null | undefined)?.habits) ?? [])
        setHabits(arr)
        const init: Partial<Record<AspectKey, boolean>> = {}
        for (const h of arr) init[h.aspect] = !!h.ticked_today
        setHabitTicks(init)
      })
      .catch(() => {
        if (cancelled) return
        setHabits([])
      })
      .finally(() => {
        if (cancelled) return
        setHabitsLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const setAspectText = (aspect: AspectKey, value: string): void => {
    setAspectTexts(prev => ({ ...prev, [aspect]: value }))
  }

  const toggleExpanded = (aspect: AspectKey): void => {
    setExpanded(prev => {
      const next: Partial<Record<AspectKey, boolean>> = { ...prev, [aspect]: !prev[aspect] }
      // Если раскрываем — запоминаем, чтобы потом авто-скроллом дотянуть
      // textarea выше sticky save-bar.
      if (next[aspect]) {
        justOpenedRef.current = aspect
        setScrollTick(t => t + 1)
      }
      return next
    })
  }

  // После раскрытия аккордеона — если низ секции уехал под sticky
  // save-bar, доскроллим, чтобы textarea был полностью виден.
  useEffect(() => {
    const aspect = justOpenedRef.current
    if (!aspect || scrollTick === 0) return
    // Ждём 2 кадра, чтобы layout с раскрытым textarea успел установиться.
    let raf1: number | undefined
    let raf2: number | undefined
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const node = sectionRefs.current[aspect]
        if (!node) return
        const rect = node.getBoundingClientRect()
        // Резерв снизу под sticky save-bar (~80px) + воздух.
        const safeBottom = window.innerHeight - 110
        if (rect.bottom <= safeBottom) return
        const scroller: Element =
          node.closest('main') ??
          document.scrollingElement ??
          document.documentElement
        scroller.scrollBy({
          top: rect.bottom - safeBottom + 16,
          behavior: 'smooth',
        })
      })
    })
    return () => {
      if (raf1 !== undefined) cancelAnimationFrame(raf1)
      if (raf2 !== undefined) cancelAnimationFrame(raf2)
    }
  }, [scrollTick])

  const toggleHabit = (aspect: AspectKey): void => {
    setHabitTicks(prev => ({ ...prev, [aspect]: !prev[aspect] }))
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    try {
      const ts = Date.now()
      const dateStr = new Date().toLocaleDateString('ru-RU')
      const newEntries: DiaryEntry[] = []
      let idCounter = ts

      // 1. Общий блок «События дня».
      if (eventsText.trim()) {
        newEntries.push({
          id: idCounter++,
          date: dateStr,
          ts,
          aspect: 'general',
          text: eventsText.trim(),
          source: 'daily-review',
          promptTitle: 'События дня',
        })
      }

      // 2. Per-aspect блоки — только заполненные.
      for (const aspect of ASPECT_KEYS) {
        const txt = (aspectTexts[aspect] ?? '').trim()
        if (!txt) continue
        newEntries.push({
          id: idCounter++,
          date: dateStr,
          ts,
          aspect,
          text: txt,
          source: 'daily-review',
          promptTitle: `День · ${ASPECT_DATA[aspect].name}`,
        })
      }

      // 3. Если что-то записано — кладём в дневник одним батчем.
      if (newEntries.length > 0) {
        onDiaryChange([...newEntries, ...diary])
      }

      // 4. Sync галочек привычек — только то, что изменилось.
      for (const h of habits) {
        const wasTicked = !!h.ticked_today
        const nowTicked = !!habitTicks[h.aspect]
        if (wasTicked === nowTicked) continue
        try {
          if (nowTicked) await tickHabit(h.aspect)
          else await untickHabit(h.aspect)
        } catch (e) { console.error(e) }
      }

      setSaved(true)
      tmaNotify('success')   // вибро-фидбек в TG, no-op вне TMA
      // Очищаем форму, чтобы не запутать юзера если вернётся на эту же вкладку.
      setEventsText('')
      setAspectTexts({})
      setExpanded({})
      setTimeout(() => setSaved(false), 2200)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось сохранить день')
      tmaNotify('error')
    } finally {
      setSaving(false)
    }
  }

  const filledCount =
    (eventsText.trim() ? 1 : 0) +
    ASPECT_KEYS.filter(k => (aspectTexts[k] ?? '').trim()).length
  const habitsChangedCount = habits.filter(
    h => !!h.ticked_today !== !!habitTicks[h.aspect]
  ).length

  return (
    <div className={styles.dailyReview}>
      <div className={styles.dayHeader}>
        <div className={styles.dayEyebrow}>Сегодня</div>
        <h2 className={styles.dayTitle}>{todayPretty()}</h2>
        <p className={styles.dayHelp}>
          Запиши день одним заходом. Заполняй только то, что хочется — все
          блоки опциональны, можно пропустить любой.
        </p>
      </div>

      {/* ── События дня ─────────────────────────────── */}
      <section className={styles.daySection}>
        <div className={styles.daySectionHead}>
          <div className={styles.daySectionTitle}>📜 События дня</div>
          <div className={styles.daySectionSub}>Что было — простой перечень</div>
        </div>
        <textarea
          className={styles.dayTextarea}
          value={eventsText}
          onChange={e => setEventsText(e.target.value)}
          placeholder="Утром… Днём… Вечером… (необязательно)"
          rows={3}
          maxLength={2000}
        />
      </section>

      {/* ── По аспектам ─────────────────────────────── */}
      {ASPECT_KEYS.map(aspect => {
        const text = aspectTexts[aspect] ?? ''
        const isOpen = !!expanded[aspect] || !!text
        const color = ASPECT_COLORS[aspect]
        return (
          <section
            key={aspect}
            ref={el => { sectionRefs.current[aspect] = el }}
            className={`${styles.daySection} ${styles.daySectionAspect} ${isOpen ? styles.daySectionOpen : ''}`}
            style={{ '--aspect-color': color } as React.CSSProperties}
          >
            <button
              type="button"
              className={styles.daySectionToggle}
              onClick={() => toggleExpanded(aspect)}
              aria-expanded={isOpen}
            >
              <span className={styles.dayAspectKey} style={{ color }}>{ASPECT_DISPLAY_KEY[aspect]}</span>
              <span className={styles.dayAspectName}>{ASPECT_DATA[aspect].name}</span>
              <span className={styles.dayAspectChevron} aria-hidden="true">
                {isOpen ? '▴' : '▾'}
              </span>
            </button>

            {isOpen && (
              <div className={styles.daySectionBody}>
                <div className={styles.dayPrompts}>
                  {ASPECT_PROMPTS[aspect].map((p, i) => (
                    <span key={i} className={styles.dayPromptChip}>{p}</span>
                  ))}
                </div>
                <textarea
                  className={styles.dayTextarea}
                  value={text}
                  onChange={e => setAspectText(aspect, e.target.value)}
                  placeholder="Что хочется записать… (необязательно)"
                  rows={3}
                  maxLength={2000}
                  style={{ borderColor: text.trim() ? color : undefined }}
                />
              </div>
            )}
          </section>
        )
      })}

      {/* ── Сегодняшние практики ────────────────────── */}
      {!habitsLoading && habits.length > 0 && (
        <section className={styles.daySection}>
          <div className={styles.daySectionHead}>
            <div className={styles.daySectionTitle}>🎯 Сегодняшние практики</div>
            <div className={styles.daySectionSub}>Отметь те, что сегодня выполнил</div>
          </div>
          <div className={styles.dayHabitsList}>
            {habits.map(h => {
              const ticked = !!habitTicks[h.aspect]
              return (
                <label
                  key={h.aspect}
                  className={`${styles.dayHabitItem} ${ticked ? styles.dayHabitItemDone : ''}`}
                  style={{ '--habit-color': ASPECT_COLORS[h.aspect] } as React.CSSProperties}
                >
                  <input
                    type="checkbox"
                    checked={ticked}
                    onChange={() => toggleHabit(h.aspect)}
                    className={styles.dayHabitCheckbox}
                  />
                  <span
                    className={styles.dayHabitAspect}
                    style={{ color: ASPECT_COLORS[h.aspect] }}
                  >
                    {ASPECT_DISPLAY_KEY[h.aspect] ?? h.aspect}
                  </span>
                  <span className={styles.dayHabitTitle}>{h.title}</span>
                </label>
              )
            })}
          </div>
        </section>
      )}

      {/* ── Сохранить ───────────────────────────────── */}
      {error && <div className={styles.dayError}>{error}</div>}
      {/* Web save-bar показывается всегда (даже в TMA как fallback) —
          MainButton параллельно тоже подключается через useMainButton выше. */}
      <div className={styles.daySaveBar}>
        <div className={styles.daySaveSummary}>
          {filledCount > 0 && <span>{filledCount} {pluralize(filledCount, ['блок', 'блока', 'блоков'])}</span>}
          {filledCount > 0 && habitsChangedCount > 0 && <span> · </span>}
          {habitsChangedCount > 0 && <span>{habitsChangedCount} {pluralize(habitsChangedCount, ['практика', 'практики', 'практик'])}</span>}
          {filledCount === 0 && habitsChangedCount === 0 && (
            <span className={styles.dayMuted}>Заполни хотя бы один блок или отметь практику</span>
          )}
        </div>
        <button
          type="button"
          className={styles.daySaveBtn}
          onClick={handleSave}
          disabled={saving || (filledCount === 0 && habitsChangedCount === 0)}
        >
          {saving ? 'Сохраняю…' : saved ? '✓ Сохранено' : 'Сохранить день'}
        </button>
      </div>
    </div>
  )
}

function pluralize(n: number, forms: [string, string, string]): string {
  // forms = [одна, две, пять]
  const m10 = n % 10
  const m100 = n % 100
  if (m10 === 1 && m100 !== 11) return forms[0]
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1]
  return forms[2]
}
