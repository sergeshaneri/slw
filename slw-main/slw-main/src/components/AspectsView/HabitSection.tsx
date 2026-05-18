import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  fetchMyHabits,
  chooseHabit,
  clearHabit,
  tickHabit,
  untickHabit,
  fetchHabitsHistory,
} from '../../api/client'
import type { AspectKey } from '@/types/aspect'
import styles from './HabitSection.module.css'

// Запись об активной практике юзера по аспекту. Прилетает из
// `fetchMyHabits()` → массив `habits`. Бэк возвращает кириллический ключ
// аспекта, но к моменту попадания в этот компонент `translateAspectsInResponse`
// в client.ts уже перевёл его на латиницу.
//
// NOTE(ts): pending backend response_model — fetchMyHabits returns `unknown`.
type Habit = {
  aspect: AspectKey | string
  title: string
  exercise_id?: string | number | null
  ticked_today?: boolean
}

type Props = {
  aspect: AspectKey
  color: string
}

/**
 * Секция «Моя практика» на странице аспекта.
 *
 * Концепция (см. план): юзер выбирает упражнение — обычно с L1 этого
 * аспекта — и каждый день жмёт «✓ выполнил». На L1 это будет обязательным
 * шагом (TODO когда появятся скрипты уровней), на других уровнях —
 * опционально.
 *
 * Тик питает серверный стрик (через POST /habits/{aspect}/tick).
 */
export default function HabitSection({ aspect, color }: Props) {
  const [habit, setHabit] = useState<Habit | null>(null)        // {title, exercise_id, ticked_today}
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [history, setHistory] = useState<string[]>([])      // last 30 dates
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = async () => {
    setBusy(true)
    setError(null)
    try {
      const habitsResp = (await fetchMyHabits()) as { habits?: Habit[] } | undefined
      const habits = habitsResp?.habits ?? []
      const mine = habits.find(h => h.aspect === aspect) || null
      setHabit(mine)
      setDraft(mine?.title ?? '')
      const histResp = (await fetchHabitsHistory(aspect, 30)) as { dates?: string[] } | undefined
      setHistory(histResp?.dates ?? [])
    } catch (e) {
      setError((e as Error)?.message ?? 'Не удалось загрузить')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { reload() /* eslint-disable-next-line */ }, [aspect])

  const handleSave = async () => {
    const t = draft.trim()
    if (!t) return
    try {
      await chooseHabit({ aspect, title: t })
      setEditing(false)
      reload()
    } catch (e) {
      setError((e as Error)?.message ?? 'Не удалось сохранить')
    }
  }

  const handleClear = async () => {
    if (!habit) return
    if (!confirm('Снять активную практику для этого аспекта?')) return
    try {
      await clearHabit(aspect)
      reload()
    } catch (e) {
      setError((e as Error)?.message ?? 'Не удалось снять')
    }
  }

  const handleToggle = async () => {
    if (!habit) return
    try {
      if (habit.ticked_today) {
        await untickHabit(aspect)
      } else {
        await tickHabit(aspect)
      }
      reload()
    } catch (e) {
      setError((e as Error)?.message ?? 'Не удалось')
    }
  }

  const streak = computeStreak(history)

  return (
    <section className={styles.wrap} style={{ '--accent': color } as unknown as CSSProperties}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>Моя практика</span>
        {streak > 0 && (
          <span className={styles.streakBadge}>🔥 {streak} {pluralDays(streak)}</span>
        )}
      </div>

      {busy && <div className={styles.muted}>Загружаем…</div>}
      {error && <div className={styles.error}>{error}</div>}

      {!busy && !habit && !editing && (
        <div className={styles.emptyState}>
          <p className={styles.muted}>
            Выбери одно упражнение по этому аспекту как ежедневную практику. Обычно это что-то небольшое из L1 — что можешь делать каждый день.
          </p>
          <button
            type="button"
            className={styles.btnPrimary}
            onClick={() => setEditing(true)}
          >
            + Выбрать практику
          </button>
        </div>
      )}

      {!busy && habit && !editing && (
        <div className={styles.activeState}>
          <div className={styles.title}>{habit.title}</div>
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.tickBtn} ${habit.ticked_today ? styles.tickBtnDone : ''}`}
              onClick={handleToggle}
            >
              {habit.ticked_today ? '✓ Выполнено сегодня' : '☐ Отметить сегодня'}
            </button>
            <button type="button" className={styles.linkBtn} onClick={() => setEditing(true)}>
              ✎ изменить
            </button>
            <button type="button" className={styles.linkBtn} onClick={handleClear}>
              × снять
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className={styles.editState}>
          <input
            type="text"
            className={styles.input}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave() }}
            placeholder="Например: «прислушаться к телу 3 раза за день»"
            maxLength={200}
            autoFocus
          />
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnPrimary}
              onClick={handleSave}
              disabled={!draft.trim()}
            >
              Сохранить
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => { setEditing(false); setDraft(habit?.title ?? '') }}
            >
              отмена
            </button>
          </div>
          <p className={styles.muted}>
            Когда мы доделаем скрипты уровней, ты сможешь выбирать практику прямо из списка упражнений L1. Пока — формулируй своими словами.
          </p>
        </div>
      )}
    </section>
  )
}

function computeStreak(dates: string[]): number {
  // dates — массив 'YYYY-MM-DD' от новых к старым.
  if (!Array.isArray(dates) || dates.length === 0) return 0
  const sorted = [...dates].sort((a, b) => b.localeCompare(a))
  const today = new Date()
  let cursor = new Date(today)
  let streak = 0
  // Если первый — не сегодня и не вчера, стрик = 0.
  const first = sorted[0]
  const todayStr = today.toISOString().slice(0, 10)
  const yesterday = new Date(today.getTime() - 86400000).toISOString().slice(0, 10)
  if (first !== todayStr && first !== yesterday) return 0
  for (const d of sorted) {
    const cs = cursor.toISOString().slice(0, 10)
    if (d === cs) {
      streak++
      cursor = new Date(cursor.getTime() - 86400000)
    } else if (d < cs) {
      // пропустили день — конец стрика
      break
    }
    // d > cs (будущее) — пропускаем
  }
  return streak
}

function pluralDays(n: number): string {
  const m = n % 10
  if (n % 100 >= 11 && n % 100 <= 14) return 'дней'
  if (m === 1) return 'день'
  if (m >= 2 && m <= 4) return 'дня'
  return 'дней'
}
