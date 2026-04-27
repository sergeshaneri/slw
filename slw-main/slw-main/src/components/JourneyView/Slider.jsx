import styles from './Slider.module.css'

/**
 * Слайдер 1–10 для оценок. Выделен из SurveyScreen — переиспользуется
 * также в Chat для шагов awaitingInput='number'.
 *
 * Props:
 *   value: number          — текущее значение (1..10)
 *   onChange: (n) => void  — каллбек при изменении
 *   showValueBig: bool     — показать большой числовой бейдж сверху
 *   showEnds: bool         — показать «1 ... 10» под слайдером
 *   min, max: number       — диапазон (default 1..10)
 */
export default function Slider({
  value,
  onChange,
  showValueBig = true,
  showEnds = true,
  min = 1,
  max = 10,
}) {
  const pct = ((value - min) / (max - min)) * 100

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
          style={{ '--val': pct }}
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
