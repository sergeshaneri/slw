import { useEffect } from 'react'
import type { AspectKey } from '@/types/aspect'
import type { HallSection } from '@/components/AspectsView/blocks'
import { ASPECT_COLORS, ASPECT_DATA, ASPECT_DISPLAY_KEY } from '@/data/aspects'
import { HALL_CONTENT } from '@/data/hallContent'
import type { UnavailableFeatureId } from './UnavailableFeature'
import styles from './LiteHallView.module.css'

const SECTION_LABELS: Record<HallSection, string> = {
  quotes: 'Цитаты', figures: 'Личности', arts: 'Произведения', interestingFacts: 'Интересные факты',
}

export function LiteHallView({ aspect, initialSection, onBack, onUnavailable }: {
  aspect: AspectKey
  initialSection?: HallSection
  onBack: () => void
  onUnavailable: (feature: UnavailableFeatureId) => void
}) {
  const content = HALL_CONTENT[aspect]
  const data = ASPECT_DATA[aspect]
  const color = ASPECT_COLORS[aspect]
  useEffect(() => {
    if (!initialSection) return
    document.getElementById(`lite-hall-${initialSection}`)?.scrollIntoView({ block: 'start' })
  }, [aspect, initialSection])

  return <article className={styles.hall} data-hall-aspect={aspect} style={{ '--hall-accent': color } as React.CSSProperties}>
    <button type="button" className={styles.back} onClick={onBack}>← Назад к аспекту</button>
    <header className={styles.heading}>
      <p>{ASPECT_DISPLAY_KEY[aspect]}: статическая коллекция</p>
      <h1>{data.name}</h1>
      {content.subline && <p className={styles.subline}>{content.subline}</p>}
      <p className={styles.boundary}>Все материалы этой подборки доступны для чтения. Публикации пользователей и обсуждения требуют подключения.</p>
    </header>
    <nav className={styles.contents} aria-label="Разделы статической коллекции">
      {(Object.keys(SECTION_LABELS) as HallSection[]).map(section => <button type="button" key={section} onClick={() => document.getElementById(`lite-hall-${section}`)?.scrollIntoView({ block: 'start' })}>{SECTION_LABELS[section]} <span>{content[section]?.length ?? 0}</span></button>)}
      <button type="button" onClick={() => document.getElementById('lite-hall-archetypes')?.scrollIntoView({ block: 'start' })}>Архетипы <span>{content.archetypes?.length ?? 0}</span></button>
    </nav>
    <section className={styles.serverActions} aria-label="Пользовательские функции холла">
      <button type="button" onClick={() => onUnavailable('hall-chat')}>Чат холла</button>
      <button type="button" onClick={() => onUnavailable('hall-qa')}>Вопросы и ответы</button>
      <button type="button" onClick={() => onUnavailable('hall-publications')}>Пользовательские публикации</button>
    </section>
    <HallSectionBlock id="quotes" title="Цитаты" count={content.quotes?.length ?? 0}>
      {(content.quotes ?? []).map((item, index) => <li key={index}><blockquote>{item.text}</blockquote><strong>{item.author}</strong>{item.note && <p>{item.note}</p>}</li>)}
    </HallSectionBlock>
    <HallSectionBlock id="figures" title="Личности" count={content.figures?.length ?? 0}>
      {(content.figures ?? []).map((item, index) => <li key={index}><h3>{item.name}</h3><p>{item.note}</p></li>)}
    </HallSectionBlock>
    <HallSectionBlock id="arts" title="Произведения" count={content.arts?.length ?? 0}>
      {(content.arts ?? []).map((item, index) => <li key={index}><p className={styles.itemType}>{item.type}</p><h3>{item.title}</h3><p>{item.note}</p></li>)}
    </HallSectionBlock>
    <HallSectionBlock id="interestingFacts" title="Интересные факты" count={content.interestingFacts?.length ?? 0}>
      {(content.interestingFacts ?? []).map((item, index) => <li key={index}><h3>{item.name}</h3><p>{item.desc}</p></li>)}
    </HallSectionBlock>
    <HallSectionBlock id="archetypes" title="Архетипы" count={content.archetypes?.length ?? 0}>
      {(content.archetypes ?? []).map((item, index) => <li key={item.id ?? index}><h3><span aria-hidden="true">{item.emoji}</span> {item.title}</h3><p>{item.desc}</p></li>)}
    </HallSectionBlock>
  </article>
}

function HallSectionBlock({ id, title, count, children }: { id: HallSection | 'archetypes'; title: string; count: number; children: React.ReactNode }) {
  return <section id={`lite-hall-${id}`} className={styles.collection} data-hall-section={id} data-item-count={count}>
    <h2>{title} <span>{count}</span></h2>
    {count > 0 ? <ol>{children}</ol> : <p className={styles.empty}>В этой подборке пока нет материалов.</p>}
  </section>
}
