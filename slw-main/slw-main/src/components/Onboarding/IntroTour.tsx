import { useState } from 'react'
import { ASPECT_KEYS, ASPECT_COLORS } from '../../data/aspects'
import styles from './IntroTour.module.css'

type VisualKind = 'wheel' | 'flow' | 'diary' | 'community' | 'planets'

type TourStep = {
  id: string
  eyebrow: string
  title: string
  body: string
  visual: VisualKind
}

// Quick Tour — 5 шагов. Тексты согласованы заранее (см. INSTRUCT-сценарий).
const TOUR_STEPS: TourStep[] = [
  {
    id: 'intro',
    eyebrow: 'Шаг 1 из 5',
    title: '8 сфер жизни',
    body: 'У каждого человека есть 8 ключевых сфер жизни — от тела и эмоций до логики и интуиции, от структуры и отношений до видения возможностей и времени. В одних ты уже силён и опираешься на них автоматически, другие почти не задействованы. Колесо Баланса показывает эту картину целиком, а курс помогает мягко докачать то, что обычно остаётся в тени.',
    visual: 'wheel',
  },
  {
    id: 'journey',
    eyebrow: 'Шаг 2 из 5',
    title: 'Путешествие по планетам',
    body: 'Каждая сфера — это своя планета со своим миром и своим путём. На планете идёт чат-курс: бот ведёт через короткие теоретические заметки, вопросы-самооценки и небольшие упражнения. По мере прохождения колесо сферы наполняется — ты видишь, что узнал и что освоил на практике.',
    visual: 'flow',
  },
  {
    id: 'diary',
    eyebrow: 'Шаг 3 из 5',
    title: 'Дневник — главный инструмент',
    body: 'Вкладка «📅 Сегодня» — это запись дня одним заходом: события, эмоции, тренировки, привычки. Достаточно короткого касания каждый день — серверный стрик считает дни подряд. Чем регулярнее ведёшь дневник, тем точнее работают подсказки коуча и аналитика по неделям.',
    visual: 'diary',
  },
  {
    id: 'community',
    eyebrow: 'Шаг 4 из 5',
    title: 'Не один в этом пути',
    body: 'У каждой планеты есть Холл — там общий чат, вопросы-ответы и инсайты других людей по этой сфере. Можно подписываться на тех, чьи мысли отзываются, и делиться своими инсайтами публично. Лидерборд по опыту показывает, кто сейчас активнее всех в путешествии.',
    visual: 'community',
  },
  {
    id: 'go',
    eyebrow: 'Шаг 5 из 5',
    title: 'Поехали',
    body: 'Сейчас откроется Карта Планет — выбери, с какой сферы хочешь начать. Можно пройти любую первой или подсмотреть теорию сразу по всем восьми. Прогресс на каждой планете сохраняется отдельно — переключайся свободно. Удачи в путешествии.',
    visual: 'planets',
  },
]

type Props = {
  onClose: () => void
  onGoToPlanets?: () => void
  isGuest?: boolean
}

/**
 * Полноэкранная модалка-онбординг (Layer 1).
 * Показывается сразу после первого логина (server flag onboarding_done=false)
 * или гостю один раз (localStorage). Re-open из Profile.
 *
 * Props:
 *   onClose       — закрыть и пометить пройденным (или localStorage).
 *   onGoToPlanets — финальный CTA (шаг 5): закрыть + переключить на journey.
 *   isGuest       — true если юзер не залогинен (используем localStorage).
 */
// NOTE(ts): isGuest приходит из App.jsx, но в этом компоненте напрямую
// не используется — поведение «гость vs логин» определяет родитель через
// разные onClose/onGoToPlanets хендлеры. Оставлен как часть публичного
// контракта пропсов (вызов `void` гасит unused-vars-предупреждение).
export default function IntroTour({ onClose, onGoToPlanets, isGuest = false }: Props) {
  void isGuest
  const [step, setStep] = useState(0)
  const last = step === TOUR_STEPS.length - 1
  const data = TOUR_STEPS[step]

  const handleNext = () => {
    if (last) onGoToPlanets?.()
    else setStep(s => s + 1)
  }

  const handleBack = () => setStep(s => Math.max(0, s - 1))

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Гид по приложению">
      <div className={styles.bgGlow} />

      <button
        type="button"
        className={styles.closeBtn}
        onClick={onClose}
        aria-label="Закрыть гид"
      >
        ×
      </button>

      <div className={styles.content}>
        <div className={styles.eyebrow}>{data.eyebrow}</div>

        <div className={styles.visualBox}>
          <Visual kind={data.visual} />
        </div>

        <h1 className={styles.title}>{data.title}</h1>
        <p className={styles.body}>{data.body}</p>
      </div>

      <div className={styles.bottom}>
        <div className={styles.dots}>
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              className={`${styles.dot} ${i === step ? styles.dotActive : ''}`}
            />
          ))}
        </div>

        <div className={styles.actions}>
          {step > 0 && (
            <button type="button" className={styles.btnGhost} onClick={handleBack}>
              ← Назад
            </button>
          )}
          {!last && (
            <button type="button" className={styles.btnLink} onClick={onClose}>
              Пропустить
            </button>
          )}
          <button type="button" className={styles.btnPrimary} onClick={handleNext}>
            {last ? '→ Карта Планет' : 'Дальше →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Визуалы для каждого шага ─────────────────────────────────────────────

function Visual({ kind }: { kind: VisualKind }) {
  if (kind === 'wheel') return <WheelVisual />
  if (kind === 'flow') return <FlowVisual />
  if (kind === 'diary') return <EmojiVisual emoji="📅" glow="#A8D97B" />
  if (kind === 'community') return <CommunityVisual />
  if (kind === 'planets') return <PlanetsVisual />
  return null
}

// 8 цветных кружочков по кольцу — компактное колесо аспектов.
function WheelVisual() {
  const cx = 90
  const cy = 90
  const r = 60
  return (
    <svg viewBox="0 0 180 180" className={styles.svgSpin} aria-hidden="true">
      <circle cx={cx} cy={cy} r={r} fill="none"
        stroke="rgba(255,255,255,0.10)" strokeWidth="1" />
      {ASPECT_KEYS.map((key, i) => {
        const angle = (i / ASPECT_KEYS.length) * Math.PI * 2 - Math.PI / 2
        const x = cx + Math.cos(angle) * r
        const y = cy + Math.sin(angle) * r
        return (
          <circle
            key={key}
            cx={x}
            cy={y}
            r={11}
            fill={ASPECT_COLORS[key]}
            opacity={0.92}
            style={{ filter: `drop-shadow(0 0 6px ${ASPECT_COLORS[key]}aa)` }}
          />
        )
      })}
      <circle cx={cx} cy={cy} r={5} fill="#fff5d6" opacity={0.9} />
    </svg>
  )
}

// Малая планета → стрелка → большая, как «прохождение наполняет колесо».
function FlowVisual() {
  return (
    <svg viewBox="0 0 280 160" aria-hidden="true">
      <circle cx={50} cy={80} r={20} fill="#8975DD" opacity={0.85}
        style={{ filter: 'drop-shadow(0 0 10px #8975DD88)' }} />
      <line x1={78} y1={80} x2={150} y2={80}
        stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeDasharray="4 4" />
      <polygon points="150,75 162,80 150,85" fill="rgba(255,255,255,0.6)" />
      <circle cx={210} cy={80} r={42} fill="none"
        stroke="rgba(255,255,255,0.18)" strokeWidth="2" />
      <circle cx={210} cy={80} r={42}
        fill="#A8D97B" opacity={0.55}
        className={styles.fillPulse}
        style={{ filter: 'drop-shadow(0 0 14px #A8D97B66)' }} />
    </svg>
  )
}

function EmojiVisual({ emoji, glow }: { emoji: string; glow: string }) {
  return (
    <div className={styles.emojiVisual}>
      <div
        className={styles.emojiGlow}
        style={{ background: `radial-gradient(circle, ${glow}55 0%, transparent 65%)` }}
      />
      <div className={styles.emoji}>{emoji}</div>
    </div>
  )
}

// 👥 + чат-пузырь рядом.
function CommunityVisual() {
  return (
    <div className={styles.emojiVisual}>
      <div
        className={styles.emojiGlow}
        style={{ background: 'radial-gradient(circle, #D8516055 0%, transparent 65%)' }}
      />
      <div className={styles.emoji}>👥</div>
      <div className={styles.bubble}>💬</div>
    </div>
  )
}

// 8 цветных точек дрейфуют облаком — намёк на «выбор планеты».
function PlanetsVisual() {
  return (
    <svg viewBox="0 0 220 160" aria-hidden="true">
      {ASPECT_KEYS.map((key, i) => {
        const angle = (i / ASPECT_KEYS.length) * Math.PI * 2
        const r = 50
        const cx = 110 + Math.cos(angle) * r
        const cy = 80 + Math.sin(angle) * r * 0.8
        return (
          <circle
            key={key}
            cx={cx}
            cy={cy}
            r={9}
            fill={ASPECT_COLORS[key]}
            opacity={0.92}
            className={styles.planetFloat}
            style={{
              animationDelay: `${i * 0.15}s`,
              filter: `drop-shadow(0 0 7px ${ASPECT_COLORS[key]}aa)`,
            }}
          />
        )
      })}
    </svg>
  )
}
