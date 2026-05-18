import type { CSSProperties } from 'react'
import styles from './Slider.module.css'

/**
 * Слайдер 1–10 для оценок. Выделен из SurveyScreen — переиспользуется
 * также в Chat для шагов awaitingInput='number'.
 */
type Props = {
  value: number
  onChange: (n: number) => void
  showValueBig?: boolean
  showEnds?: boolean
  min?: number
  max?: number
}

// CSS custom property `--val` is set inline for gradient fill. React's
// CSSProperties does not know about custom props — cast via index sig.
type SliderStyle = CSSProperties & { '--val'?: number }

export default function Slider({
  value,
  onChange,
  showValueBig = true,
  showEnds = true,
  min = 1,
  max = 10,
}: Props) {
  const pct = ((value - min) / (max - min)) * 100

  const sliderStyle: SliderStyle = { '--val': pct }

  return (
    <div className={styles.wrap}>
      {showValueBig && (
        <div className={styles.valueRow}>
          <span className={styles.valueNum}>{value}</span>
          <span className={styles.valueTotal}>/{max}</span>
        </div>
      )}

      <div className={styles.sliderWrap}>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={e => onChange(parseInt(e.target.value, 10))}
          className={styles.slider}
          // --val 0..100 — для градиентной заливки трека до бегунка.
          style={sliderStyle}
          aria-label="Оценка"
        />
        {showEnds && (
          <div className={styles.ends}>
            <span>{min}</span>
            <span>{max}</span>
          </div>
        )}
      </div>
    </div>
  )
}
