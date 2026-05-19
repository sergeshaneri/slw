import type { CSSProperties, ReactNode } from 'react'
import {
  ARCHETYPES, ARCHETYPE_KEYS, SKILL_TREE,
  calcTiArchetypeAvg, calcTiScoreFromSkills, getTiSkillProgress
} from '../../data/journey/skills/ti-skills'
import type { SkillState } from '@/types/journey'
import styles from './SiWheel.module.css'

// `ARCHETYPE_KEYS` re-exported for parity with the JS source; not consumed here.
void ARCHETYPE_KEYS

// Колесо БЛ — реальное колесо баланса по 4 архетипам (Аналитик, Архитектор,
// Хранитель Порядка, Энциклопедист) + 3 общих базовых навыка, входящих в
// каждый архетип сквозным слоем (Структурное мышление, Различение модальностей,
// Дисциплина Ума).
//
// Структура и стадии — те же, что и в SiWheel/FeWheel/NeWheel/NiWheel/TeWheel:
// лепестки по avg, звёзды по пройденным анкетам, эволюция украшений
// per-архетип и глобально.
//
// Стадии per-архетип:
//   pre       — 0 анкет в архетипе
//   light     — 1+
//   medium    — 3+
//   strong    — 6+
//   masterful — все навыки архетипа пройдены

const CX = 160
const CY = 160
const R_INNER = 32
const R_OUTER = 130
const R_AVAILABLE = R_OUTER - R_INNER

type QuadrantKey = 'analyst' | 'architect' | 'guardian' | 'encyclopedist'

const QUADRANT_ORDER: QuadrantKey[] = ['analyst', 'architect', 'guardian', 'encyclopedist']

const ARCHETYPE_COLORS: Record<QuadrantKey, string> = {
  analyst:       '#06b6d4', // бирюзовый — Аналитик, ясность разбора
  architect:     '#f59e0b', // янтарный — Архитектор, строящая мощь
  guardian:      '#22c55e', // зелёный — Хранитель Порядка, живое поддержание
  encyclopedist: '#a855f7', // фиолетовый — Энциклопедист, мудрость эрудиции
}

type ArcheStage = 'pre' | 'light' | 'medium' | 'strong' | 'masterful'

const STAGE_ORDER: ArcheStage[] = ['pre', 'light', 'medium', 'strong', 'masterful']

function getArcheStage(completed: number, total: number): ArcheStage {
  if (completed >= total && total > 0) return 'masterful'
  if (completed >= 6) return 'strong'
  if (completed >= 3) return 'medium'
  if (completed >= 1) return 'light'
  return 'pre'
}

function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const a = (angleDeg - 90) * (Math.PI / 180)
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) }
}

function wedgePath(angleStart: number, angleEnd: number, rInner: number, rOuter: number): string {
  const p1 = polar(angleStart, rInner)
  const p2 = polar(angleStart, rOuter)
  const p3 = polar(angleEnd, rOuter)
  const p4 = polar(angleEnd, rInner)
  const largeArc = (angleEnd - angleStart) > 180 ? 1 : 0
  return [
    `M ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p3.x} ${p3.y}`,
    `L ${p4.x} ${p4.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p1.x} ${p1.y}`,
    `Z`,
  ].join(' ')
}

function arcPath(angleStart: number, angleEnd: number, radius: number): string {
  const p1 = polar(angleStart, radius)
  const p2 = polar(angleEnd, radius)
  const largeArc = (angleEnd - angleStart) > 180 ? 1 : 0
  return `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x} ${p2.y}`
}

function seedFromString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function makeRng(seed: number): () => number {
  let s = seed
  return () => {
    s = Math.imul(s ^ (s >>> 16), 2246822507)
    s = Math.imul(s ^ (s >>> 13), 3266489909)
    s = (s ^ (s >>> 16)) >>> 0
    return s / 4294967296
  }
}

type StarProps = { x: number; y: number; size?: number; opacity?: number }

function Star({ x, y, size = 2.6, opacity = 0.9 }: StarProps) {
  const s = size
  const t = s * 0.22
  return (
    <g transform={`translate(${x} ${y})`} opacity={opacity}>
      <circle r={s * 1.5} fill="white" opacity={0.08} />
      <path
        d={`M 0 ${-s} L ${t} ${-t} L ${s} 0 L ${t} ${t} L 0 ${s} L ${-t} ${t} L ${-s} 0 L ${-t} ${-t} Z`}
        fill="white"
      />
    </g>
  )
}

type TallyMarksProps = {
  qi: number
  count: number
  total: number
  radius: number
  length?: number
  opacity?: number
  color?: string
}

function TallyMarks({ qi, count, total, radius, length = 4, opacity = 0.55, color = 'currentColor' }: TallyMarksProps) {
  if (count === 0) return null
  const lines: ReactNode[] = []
  const pad = 6
  for (let i = 0; i < count; i++) {
    const angleFrac = total === 1 ? 0.5 : pad / 90 + (i / (total - 1)) * ((90 - 2 * pad) / 90)
    const angle = qi * 90 + angleFrac * 90
    const p1 = polar(angle, radius - length / 2)
    const p2 = polar(angle, radius + length / 2)
    lines.push(
      <line
        key={i}
        x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
        stroke={color}
        strokeOpacity={opacity}
        strokeWidth={1.4}
      />
    )
  }
  return <g>{lines}</g>
}

type QuadrantCoronaProps = {
  qi: number
  color: string
  dots?: number
  radius: number
  size?: number
  opacity?: number
}

function QuadrantCorona({ qi, color, dots = 5, radius, size = 1.6, opacity = 0.65 }: QuadrantCoronaProps) {
  const startA = qi * 90 + 8
  const endA = qi * 90 + 82
  const elements: ReactNode[] = []
  for (let i = 0; i < dots; i++) {
    const t = dots === 1 ? 0.5 : i / (dots - 1)
    const angle = startA + t * (endA - startA)
    const p = polar(angle, radius)
    elements.push(
      <circle
        key={i}
        cx={p.x} cy={p.y} r={size}
        fill={color}
        opacity={opacity}
      />
    )
  }
  return <g>{elements}</g>
}

type CompassMarksProps = {
  globalStage: ArcheStage
  radius: number
  color?: string
}

function CompassMarks({ globalStage, radius, color = 'currentColor' }: CompassMarksProps) {
  if (globalStage === 'pre') return null
  const size =
    globalStage === 'masterful' ? 3.2 :
    globalStage === 'strong'    ? 2.6 :
    globalStage === 'medium'    ? 2.2 : 1.6
  const opacity =
    globalStage === 'masterful' ? 0.85 :
    globalStage === 'strong'    ? 0.7 :
    globalStage === 'medium'    ? 0.55 : 0.4

  const elements: ReactNode[] = []
  for (let i = 0; i < 4; i++) {
    const angle = i * 90
    const p = polar(angle, radius)
    elements.push(
      <g key={i} transform={`translate(${p.x} ${p.y})`}>
        <circle r={size} fill={color} opacity={opacity} />
        {globalStage !== 'light' && (
          <circle r={size + 2} fill="none" stroke={color} strokeOpacity={opacity * 0.5} strokeWidth={0.7} />
        )}
        {(globalStage === 'strong' || globalStage === 'masterful') && (
          <circle r={size + 4.5} fill="none" stroke={color} strokeOpacity={opacity * 0.3} strokeWidth={0.5} />
        )}
      </g>
    )
  }
  return <g>{elements}</g>
}

type MasterfulArcsProps = { radius: number; color?: string }

function MasterfulArcs({ radius, color = 'currentColor' }: MasterfulArcsProps) {
  const elements: ReactNode[] = []
  for (let i = 0; i < 4; i++) {
    const startA = i * 90 + 6
    const endA = i * 90 + 84
    elements.push(
      <path
        key={i}
        d={arcPath(startA, endA, radius)}
        fill="none"
        stroke={color}
        strokeOpacity={0.5}
        strokeWidth={0.8}
        strokeDasharray="2 3"
      />
    )
  }
  return <g>{elements}</g>
}

type Props = {
  skills: Record<string, SkillState>
  color: string
  onContinueSurveys?: () => void
  isLocked?: boolean
}

export default function TiWheel({ skills, color, onContinueSurveys, isLocked = false }: Props) {
  // SkillState ↔ SkillStateEntry are structurally compatible — see SiWheel.
  const skillsArg = skills
  const tiScore = calcTiScoreFromSkills(skillsArg)
  const progress = getTiSkillProgress(skillsArg)

  // Per-архетип состояние — у БЛ ветки включают 3 общих базовых сверху
  // (Структурное мышление, Различение модальностей, Дисциплина Ума), которые
  // входят в средний подсчёт каждого архетипа. branch здесь — только
  // специфичные навыки; calcTiArchetypeAvg учитывает общие.
  const archeStates = QUADRANT_ORDER.map((key, qi) => {
    const branch = SKILL_TREE[key] ?? []
    const total = branch.length
    const completedSkills = branch.filter(s => Number.isFinite(skills?.[s.id]?.result))
    const completed = completedSkills.length
    const avg = calcTiArchetypeAvg(skillsArg, key)
    const stage = getArcheStage(completed, total)
    return { key, qi, branch, total, completed, completedSkills, avg, stage }
  })

  const globalStageIdx = Math.min(...archeStates.map(a => STAGE_ORDER.indexOf(a.stage)))
  const globalStage = STAGE_ORDER[globalStageIdx]

  const showDoubleRing  = globalStageIdx >= STAGE_ORDER.indexOf('medium')
  const showInnerDetail = globalStageIdx >= STAGE_ORDER.indexOf('medium')
  const showInnerRing   = globalStageIdx >= STAGE_ORDER.indexOf('strong')
  const showMasterArcs  = globalStageIdx >= STAGE_ORDER.indexOf('strong')
  const showPulse       = globalStage === 'masterful'
  const showBigBadge    = globalStage === 'masterful'
  const showGlow        = globalStageIdx >= STAGE_ORDER.indexOf('strong')

  const stageLabel = isLocked
    ? 'Пройди первый уровень в Путешествии — колесо откроется'
    : 'Оценивай навыки мышления, чтобы колесо росло'

  return (
    <section className={styles.wheel} style={{ '--accent': color } as unknown as CSSProperties}>
      <header className={styles.wheelHeader}>
        <div className={styles.wheelTitleBlock}>
          <span className={styles.wheelEyebrow}>Колесо БЛ</span>
          <h2 className={styles.wheelTitle}>Самооценка по архетипам</h2>
        </div>
        <div className={styles.wheelStat}>
          <div className={styles.wheelStatVal}>
            {Number.isFinite(tiScore) ? (tiScore as number).toFixed(1) : '—'}
            <span className={styles.wheelStatTotal}>/10</span>
          </div>
          <div className={styles.wheelStatLbl}>общее БЛ</div>
        </div>
      </header>

      <div className={styles.stageBadge}>{stageLabel}</div>

      <div className={`${styles.svgWrap} ${styles[`stage_${globalStage}`]} ${isLocked ? styles.lockedSvg : ''}`}>
        <svg
          viewBox="0 0 320 320"
          xmlns="http://www.w3.org/2000/svg"
          className={`${styles.svg} ${showPulse ? styles.svgPulse : ''}`}
        >
          {archeStates.map(({ key, qi, stage }) => {
            const opacity =
              stage === 'masterful' ? 0.18 :
              stage === 'strong'    ? 0.13 :
              stage === 'medium'    ? 0.10 :
              stage === 'light'     ? 0.08 : 0.05
            return (
              <path
                key={`bg-${key}`}
                d={wedgePath(qi * 90, qi * 90 + 90, R_INNER, R_OUTER + 4)}
                fill={ARCHETYPE_COLORS[key]}
                opacity={opacity}
              />
            )
          })}

          {archeStates.map(({ key, qi, avg, stage }) => {
            if (!Number.isFinite(avg)) return null
            if (stage !== 'strong' && stage !== 'masterful') return null
            const length = R_INNER + ((avg as number) / 10) * R_AVAILABLE
            return (
              <path
                key={`glow-${key}`}
                d={wedgePath(qi * 90 + 1.5, qi * 90 + 88.5, R_INNER, length)}
                fill={ARCHETYPE_COLORS[key]}
                opacity={0.25}
                filter={`blur(6px)`}
              />
            )
          })}

          {archeStates.map(({ key, qi, avg }) => {
            if (!Number.isFinite(avg)) return null
            const length = R_INNER + ((avg as number) / 10) * R_AVAILABLE
            return (
              <path
                key={`sector-${key}`}
                d={wedgePath(qi * 90 + 1.5, qi * 90 + 88.5, R_INNER, length)}
                fill={ARCHETYPE_COLORS[key]}
                opacity={0.92}
              />
            )
          })}

          {archeStates.map(({ key, qi, avg, completedSkills, stage }) => {
            if (completedSkills.length === 0 || !Number.isFinite(avg)) return null
            const filledOuter = R_INNER + ((avg as number) / 10) * R_AVAILABLE
            const innerR = R_INNER + 4
            const outerR = Math.max(innerR + 2, filledOuter - 4)
            return (
              <g key={`stars-${key}`} className={stage === 'masterful' ? styles.starsTwinkle : ''}>
                {completedSkills.map((skill) => {
                  const rng = makeRng(seedFromString(skill.id))
                  const angleFrac = 0.06 + rng() * 0.88
                  const angle = qi * 90 + angleFrac * 90
                  const radFrac = 0.1 + rng() * 0.8
                  const radius = innerR + radFrac * (outerR - innerR)
                  const p = polar(angle, radius)
                  const baseSize = filledOuter - R_INNER < 25 ? 1.6 : 2.4
                  const size = baseSize + rng() * 1.2
                  const opacity = 0.65 + rng() * 0.3
                  return <Star key={skill.id} x={p.x} y={p.y} size={size} opacity={opacity} />
                })}
              </g>
            )
          })}

          {archeStates.map(({ key, qi, stage }) => {
            if (stage === 'pre' || stage === 'light') return null
            const dots = stage === 'masterful' ? 9 : stage === 'strong' ? 7 : 5
            const radius = R_OUTER + 7
            return (
              <QuadrantCorona
                key={`corona-${key}`}
                qi={qi}
                color={ARCHETYPE_COLORS[key]}
                dots={dots}
                radius={radius}
                size={stage === 'masterful' ? 1.8 : 1.4}
                opacity={stage === 'masterful' ? 0.85 : stage === 'strong' ? 0.7 : 0.55}
              />
            )
          })}

          {archeStates.map(({ key, qi, completed, total }) => (
            <TallyMarks
              key={`tally-${key}`}
              qi={qi}
              count={completed}
              total={total}
              radius={R_OUTER + 4}
              length={5}
              color={ARCHETYPE_COLORS[key]}
              opacity={0.85}
            />
          ))}

          {archeStates.map(({ key, qi, avg, stage }) => {
            if (stage !== 'strong' && stage !== 'masterful') return null
            if (!Number.isFinite(avg)) return null
            const length = R_INNER + ((avg as number) / 10) * R_AVAILABLE
            const arcR = R_INNER + (length - R_INNER) * 0.55
            return (
              <path
                key={`inner-arc-${key}`}
                d={arcPath(qi * 90 + 12, qi * 90 + 78, arcR)}
                fill="none"
                stroke="white"
                strokeOpacity={0.18}
                strokeWidth={0.8}
              />
            )
          })}

          <circle
            cx={CX} cy={CY} r={R_OUTER + 4}
            fill="none"
            stroke="currentColor"
            strokeOpacity={
              globalStage === 'masterful' ? 0.75 :
              globalStage === 'strong'    ? 0.6 :
              globalStage === 'medium'    ? 0.5 :
              globalStage === 'light'     ? 0.45 : 0.4
            }
            strokeWidth={globalStage === 'pre' ? 1.2 : 1.6}
          />
          {showDoubleRing && (
            <circle
              cx={CX} cy={CY} r={R_OUTER + 9}
              fill="none"
              stroke="currentColor"
              strokeOpacity={globalStage === 'masterful' ? 0.5 : 0.32}
              strokeWidth={0.9}
            />
          )}
          {globalStage === 'masterful' && (
            <circle
              cx={CX} cy={CY} r={R_OUTER + 16}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeWidth={0.8}
              strokeDasharray="2 5"
            />
          )}

          <CompassMarks globalStage={globalStage} radius={R_OUTER + (showDoubleRing ? 9 : 4)} />

          {showMasterArcs && (
            <MasterfulArcs radius={R_OUTER + 12} />
          )}

          {globalStageIdx >= STAGE_ORDER.indexOf('strong') ? (
            QUADRANT_ORDER.map((_, qi) => {
              const angle = qi * 90
              const p1 = polar(angle, R_INNER + 2)
              const p2 = polar(angle, R_OUTER + 12)
              return (
                <line
                  key={`spoke-${qi}`}
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke="currentColor"
                  strokeOpacity={0.6}
                  strokeWidth={1.5}
                />
              )
            })
          ) : (
            QUADRANT_ORDER.map((_, qi) => {
              const angle = qi * 90
              const p1 = polar(angle, R_INNER + 2)
              const p2 = polar(angle, R_OUTER + 4)
              return (
                <line
                  key={`sep-${qi}`}
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke="currentColor"
                  strokeOpacity={
                    globalStage === 'medium' ? 0.4 :
                    globalStage === 'light'  ? 0.3 : 0.22
                  }
                  strokeWidth={1}
                />
              )
            })
          )}

          {showInnerDetail && (
            <circle
              cx={CX} cy={CY} r={R_INNER + 8}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.18}
              strokeWidth={0.6}
              strokeDasharray="1 2"
            />
          )}

          {showInnerRing && (
            <circle
              cx={CX} cy={CY} r={R_INNER + 5}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.4}
              strokeWidth={1}
            />
          )}

          <circle
            cx={CX} cy={CY} r={showBigBadge ? R_INNER + 2 : R_INNER - 2}
            fill="var(--surface-2, #1c1d25)"
            stroke="currentColor"
            strokeOpacity={
              globalStage === 'masterful' ? 0.75 :
              globalStage === 'strong'    ? 0.6 : 0.5
            }
            strokeWidth={1.2}
            className={showGlow ? styles.centerGlow : ''}
          />
          <text
            x={CX} y={showBigBadge ? CY - 4 : CY - 2}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="currentColor"
            fontSize={showBigBadge ? 17 : 14}
            fontWeight="700"
          >
            {Number.isFinite(tiScore) ? (tiScore as number).toFixed(1) : '—'}
          </text>
          <text
            x={CX} y={showBigBadge ? CY + 12 : CY + 11}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="currentColor"
            fontSize={showBigBadge ? 9 : 8}
            opacity={0.65}
            letterSpacing="0.1em"
          >
            БЛ
          </text>

          {archeStates.map(({ key, qi, stage }) => {
            const arche = ARCHETYPES[key]
            const midAngle = qi * 90 + 45
            const farOut = stage === 'masterful' || stage === 'strong'
            const pos = polar(midAngle, R_OUTER + (farOut ? 30 : 22))
            const fontSize =
              stage === 'masterful' ? 18 :
              stage === 'strong'    ? 16 :
              stage === 'medium'    ? 15 :
              stage === 'light'     ? 14 : 13
            return (
              <text
                key={`glyph-${key}`}
                x={pos.x} y={pos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={ARCHETYPE_COLORS[key]}
                fontSize={fontSize}
                opacity={
                  stage === 'pre'   ? 0.6 :
                  stage === 'light' ? 0.85 : 0.95
                }
              >
                {arche.glyph}
              </text>
            )
          })}
        </svg>
      </div>

      {!isLocked && progress.remaining > 0 && onContinueSurveys && (
        <button
          type="button"
          className={styles.wheelCta}
          onClick={onContinueSurveys}
        >
          {progress.completed === 0
            ? 'Начать оценивать →'
            : `Продолжить · ${progress.remaining} осталось →`}
        </button>
      )}
      {!isLocked && progress.remaining === 0 && onContinueSurveys && (
        <button
          type="button"
          className={styles.wheelCta}
          onClick={onContinueSurveys}
        >
          Пересмотреть навыки →
        </button>
      )}

      <div className={styles.archetypeRow}>
        {archeStates.map(({ key, avg, completed, total, stage }) => {
          const arche = ARCHETYPES[key]
          const stageGlyph =
            stage === 'masterful' ? '★' :
            stage === 'strong'    ? '✸' :
            stage === 'medium'    ? '◍' :
            stage === 'light'     ? '◌' : '♢'
          return (
            <div key={key} className={styles.archetype}>
              <span
                className={styles.archetypeGlyph}
                style={{ color: ARCHETYPE_COLORS[key] }}
              >
                {arche.glyph}
              </span>
              <span className={styles.archetypeName}>{arche.name}</span>
              <span className={styles.archetypeMeta}>
                {Number.isFinite(avg) ? `${(avg as number).toFixed(1)}` : '—'} · {stageGlyph} {completed}/{total}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
