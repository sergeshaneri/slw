import type { CSSProperties } from 'react'
import type { JourneyState, AspectState } from '@/types/journey'
import { useConfirm } from '../Confirm/ConfirmProvider'
import styles from './JourneyView.module.css'

type FlatState = JourneyState & Partial<AspectState>

type AchievementDef = {
  code: string
  name: string
  desc: string
  test: (s: FlatState, totalSteps?: number | null) => boolean
}

const ACHIEVEMENTS: AchievementDef[] = [
  { code: 'first_step',  name: 'Первый шаг',         desc: 'Начал путешествие',                  test: s => s.xp > 0 },
  { code: 'theorist',    name: 'Теоретик',           desc: 'Прочитал первую теорию',             test: s => (s.completedScripts ?? []).includes('T-1') },
  { code: 'honest',      name: 'Честный взгляд',     desc: 'Ответил на вопрос самооценки',       test: s => (s.completedScripts ?? []).includes('B-1') },
  { code: 'practitioner',name: 'Практик',            desc: 'Выполнил первое упражнение',         test: s => (s.completedScripts ?? []).includes('U-1') },
  { code: 'collector',   name: 'Коллекционер слов',  desc: 'Собрал 3 слова дня',                 test: s => s.stardust >= 3 },
  { code: 'on_fire',     name: 'На огне',            desc: 'Streak 3 дня подряд',                test: s => s.streak >= 3 },
  { code: 'master_l0',   name: 'Первый Мастер',      desc: 'Завершил Уровень 0',                 test: (s, n) => n != null && (s.currentScriptIndex ?? 0) >= n }
]

type Props = {
  state: FlatState
  accent?: string
  totalSteps: number
  progressPct: number
  levelTitle?: string
  planet?: string
  aspectName?: string
  onContinue: () => void
  onReset: () => void
  onOpenPlanetMap?: () => void
}

export default function JourneyProfile({ state, accent, totalSteps, progressPct, levelTitle, planet, aspectName, onContinue, onReset, onOpenPlanetMap }: Props) {
  const confirm = useConfirm()

  // «Начать заново» стирает весь journey: XP, streak, skills, прогресс
  // ВСЕХ аспектов, чат-историю. Это самое деструктивное действие в продукте —
  // требуем типизированное подтверждение (юзер вводит слово), чтобы случайный
  // тап не мог уничтожить часы прогресса.
  const handleResetClick = async (): Promise<void> => {
    const ok = await confirm({
      title: 'Начать путешествие заново?',
      body: (
        <>
          Будут <strong>удалены</strong>: твой опыт ({state.xp ?? 0} XP),
          стрик ({state.streak ?? 0} дн.), все навыки и анкеты, прогресс
          по всем 8 планетам, чат-история. <strong>Восстановить не получится.</strong>
        </>
      ),
      confirmLabel: 'Стереть всё',
      cancelLabel: 'Оставить как есть',
      danger: true,
      typedConfirmation: 'сбросить',
    })
    if (ok) onReset()
  }

  return (
    <>
      <div className={styles.topbar}>
        <div className={styles.avatar}><span className={styles.avatarGlyph}>◐</span></div>
        <div className={styles.topbarInfo}>
          <div className={styles.topbarTitle}>Мой профиль</div>
          <div className={styles.topbarSub}>Исследователь</div>
        </div>
      </div>

      <div className={styles.profileScroll}>
        {onOpenPlanetMap ? (
          <button
            type="button"
            className={styles.profileHero}
            onClick={onOpenPlanetMap}
            aria-label="Сменить планету"
            title="Карта планет"
            style={{ cursor: 'pointer', background: 'transparent', border: 0, width: '100%', textAlign: 'inherit', color: 'inherit', padding: 0 }}
          >
            <div className={styles.profilePlanet}>◐</div>
            <div className={styles.profileTitle}>
              {aspectName ?? 'Путешествие'}{' '}
              <span className={styles.topbarChevron} aria-hidden="true">▾</span>
            </div>
            <div className={styles.profileSubtitle}>{planet} · Уровень {state.currentLevel ?? 0}</div>
          </button>
        ) : (
          <div className={styles.profileHero}>
            <div className={styles.profilePlanet}>◐</div>
            <div className={styles.profileTitle}>{aspectName ?? 'Путешествие'}</div>
            <div className={styles.profileSubtitle}>{planet} · Уровень {state.currentLevel ?? 0}</div>
          </div>
        )}

        <div className={styles.statsGrid}>
          <Stat val={state.xp} lbl="Опыт XP" accent={accent} />
          <Stat val={state.streak} lbl="Streak дней" accent={accent} />
          <Stat val={state.totalCompleted} lbl="Заданий" accent={accent} />
          <Stat val={state.stardust} lbl="Stardust" accent={accent} />
        </div>

        <div className={styles.progressBox}>
          <div className={styles.progressTitle}>
            <span>Прогресс уровня · {levelTitle ?? '—'}</span>
            <span className={styles.progressCount}>{state.currentScriptIndex ?? 0}/{totalSteps}</span>
          </div>
          <div className={styles.progressBarWrap}>
            <div
              className={styles.progressBar}
              style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${accent}, ${accent}aa)` }}
            />
          </div>
        </div>

        <div className={styles.achievementsBox}>
          <div className={styles.achievementsTitle}>Достижения</div>
          {ACHIEVEMENTS.map(a => {
            const done = a.test(state, totalSteps)
            return (
              <div key={a.code} className={`${styles.achievement} ${done ? '' : styles.achievementLocked}`}>
                <div className={styles.achievementName}>{a.name}</div>
                <div className={styles.achievementDesc}>{a.desc}</div>
                {done && <span className={styles.achievementCheck} style={{ color: accent }}>✓</span>}
              </div>
            )
          })}
        </div>

        {(state.currentScriptIndex ?? 0) < totalSteps && (
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`} onClick={onContinue}>
            Продолжить путешествие
          </button>
        )}

        {onOpenPlanetMap && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost} ${styles.btnFull}`}
            onClick={onOpenPlanetMap}
          >
            🪐 Сменить планету
          </button>
        )}

        <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnFull}`} onClick={handleResetClick}>
          Начать заново
        </button>
      </div>
    </>
  )
}

type StatProps = {
  val: number | string
  lbl: string
  accent?: string
}

function Stat({ val, lbl, accent }: StatProps) {
  const valStyle: CSSProperties = accent ? { color: accent } : {}
  return (
    <div className={styles.statCard}>
      <div className={styles.statVal} style={valStyle}>{val}</div>
      <div className={styles.statLbl}>{lbl}</div>
    </div>
  )
}
