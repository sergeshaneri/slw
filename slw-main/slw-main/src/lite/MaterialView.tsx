import { useState } from 'react'
import type { AspectKey } from '@/types/aspect'
import type { DiaryEntry } from '@/types/diary'
import type { JourneyState } from '@/types/journey'
import AspectsView from '@/components/AspectsView/AspectsView'
import MarkdownLite from '@/components/JourneyView/MarkdownLite'
import type { CatalogEntry } from './contentCatalog'
import type { ArchetypeId, SkillRole } from '@/types/skill'
import type { ScriptType } from '@/types/script'
import { LITE_CONTENT_ACCESS } from './contentAccess'
import styles from './CatalogView.module.css'

type Props = {
  entry: CatalogEntry
  journey: JourneyState
  scores: Partial<Record<AspectKey, number>>
  diary: DiaryEntry[]
  onDiaryChange: (next: DiaryEntry[]) => void
  onBack: () => void
  onNavigateAspectBlock: (blockId: string) => void
}

const KIND_LABELS: Record<CatalogEntry['kind'], string> = {
  'journey-intro': 'Введение в путешествие',
  'journey-core': 'Шаг путешествия',
  'journey-survey': 'Анкета путешествия',
  'journey-complete': 'Завершение уровня',
  'skill-intro': 'Описание навыка',
  'skill-level': 'Развитие навыка',
  'aspect-block': 'Материал аспекта',
}

const SCRIPT_TYPE_LABELS: Record<ScriptType, string> = {
  theory: 'Теория', word: 'Понятие', reflection: 'Рефлексия', exercise: 'Практика', question: 'Вопрос', survey: 'Анкета',
}

const ROLE_LABELS: Record<SkillRole, string> = {
  core: 'ядерный', aux: 'вспомогательный', archetypal: 'архетипический', common: 'общий', synergistic: 'синергетический',
}

const ARCHETYPE_LABELS: Record<ArchetypeId, string> = {
  common: 'общий', healer: 'Целитель', aesthete: 'Эстет', hedonist: 'Гедонист', keeper: 'Хранитель',
  hero: 'Герой', ruler: 'Правитель', defender: 'Защитник', builder: 'Строитель', pioneer: 'Первооткрыватель',
  visionary: 'Визионер', sage: 'Мудрец', catalyst: 'Катализатор', seer: 'Провидец', mythmaker: 'Мифотворец',
  shaman: 'Шаман', debunker: 'Разоблачитель', organizer: 'Организатор', technologist: 'Технолог', engineer: 'Инженер',
  virtuoso: 'Виртуоз', analyst: 'Аналитик', architect: 'Архитектор', guardian: 'Хранитель порядка', encyclopedist: 'Энциклопедист',
  artist: 'Артист', orator: 'Оратор', master_atmo: 'Мастер атмосферы', zavodila: 'Заводила', confessor: 'Духовник',
  diplomat: 'Дипломат', friend: 'Друг', ancestor: 'Хранитель рода',
}

export function MaterialView({ entry, journey, scores, diary, onDiaryChange, onBack, onNavigateAspectBlock }: Props) {
  const [note, setNote] = useState('')
  const saveNote = () => {
    const text = note.trim()
    if (!text) return
    const ts = Date.now()
    const next: DiaryEntry = {
      id: `catalog-${ts}`,
      date: new Date(ts).toLocaleDateString('ru-RU'),
      ts,
      aspect: entry.aspect,
      text,
      source: entry.kind === 'aspect-block' ? 'aspect' : 'manual',
      promptTitle: entry.title,
      scriptId: entry.kind === 'journey-core' || entry.kind === 'journey-survey' ? entry.sourceId : null,
      skillId: entry.kind === 'skill-intro' || entry.kind === 'skill-level' ? entry.sourceId : null,
      ...(entry.kind === 'aspect-block' ? {
        blockId: entry.sourceId,
        blockTitle: entry.title,
        prompt: entry.source.lead ?? null,
      } : {}),
      ...(entry.level == null ? {} : { level: entry.level }),
    }
    onDiaryChange([...diary, next])
    setNote('')
  }

  return (
    <article className={styles.material} data-material-id={entry.id} data-material-kind={entry.kind}>
      <button type="button" className={styles.back} onClick={onBack}>← К каталогу</button>
      <header>
        <p className={styles.kicker}>{KIND_LABELS[entry.kind]} · {entry.aspect}{entry.level == null ? '' : ` · уровень ${entry.level}`}</p>
        <h2>{entry.title}</h2>
        <p className={styles.readingNotice}>Режим чтения: XP, ответы, оценки и прохождение не изменяются.</p>
      </header>

      {entry.kind === 'journey-intro' && <div className={styles.prose}><MarkdownLite text={entry.source.text} /></div>}
      {(entry.kind === 'journey-core' || entry.kind === 'journey-survey') && (
        <div className={styles.prose}>
          <p className={styles.scriptType}>{SCRIPT_TYPE_LABELS[entry.source.type]}</p>
          <MarkdownLite text={entry.source.text} />
        </div>
      )}
      {entry.kind === 'journey-complete' && <div className={styles.prose}><MarkdownLite text={entry.source.text} /></div>}
      {entry.kind === 'skill-intro' && (
        <div className={styles.prose}>
          <p>Архетип: {ARCHETYPE_LABELS[entry.source.archetype]} · роль: {ROLE_LABELS[entry.source.role]}</p>
          <MarkdownLite text={entry.source.intro} />
        </div>
      )}
      {entry.kind === 'skill-level' && (
        <div className={styles.skillLevel}>
          {entry.source.typage && <p className={styles.typage}>{entry.source.typage}</p>}
          <MarkdownLite text={entry.source.essence} />
          <section className={styles.traits}>
            <div><h3>Что развиваешь</h3><h4>{entry.source.gift.title}</h4><MarkdownLite text={entry.source.gift.desc} /></div>
            <div><h3>От чего уходишь</h3><h4>{entry.source.shadow.title}</h4><MarkdownLite text={entry.source.shadow.desc} /></div>
          </section>
          <TextList title="Что делает ученик" values={entry.source.actions} />
          <section><h3>Практики</h3><ol>{entry.source.practices.map((practice, index) => <li key={index}><strong>{practice.name}</strong><MarkdownLite text={practice.desc} /><small>Награда в игровом режиме: {practice.xp} XP</small></li>)}</ol></section>
          <TextList title="Критерии освоения" values={entry.source.criteria} />
          {entry.source.pitfalls && <TextList title="Типичные ошибки" values={entry.source.pitfalls} />}
          {entry.source.precaution && <section><h3>Меры предосторожности</h3><MarkdownLite text={entry.source.precaution} /></section>}
          {entry.source.dilemma && <section><h3>Глубинная дилемма</h3><h4>{entry.source.dilemma.name}</h4><MarkdownLite text={entry.source.dilemma.desc} /></section>}
        </div>
      )}
      {entry.kind === 'aspect-block' && (
        <div className={styles.aspectMaterial}>
          <AspectsView
            selectedAspect={entry.aspect}
            initialBlockId={entry.sourceId}
            onAspectSelect={() => undefined}
            scores={scores}
            diary={diary}
            onDiaryChange={onDiaryChange}
            journey={journey}
            user={null}
            isAdmin={false}
            backendEnabled={false}
            contentAccess={LITE_CONTENT_ACCESS}
            onBlockNavigate={onNavigateAspectBlock}
          />
        </div>
      )}

      {entry.kind !== 'aspect-block' && <section className={styles.note}>
          <h3>Личная заметка</h3>
          <textarea value={note} onChange={event => setNote(event.target.value)} placeholder="Запишите наблюдение к материалу" />
          <button type="button" onClick={saveNote} disabled={!note.trim()}>Сохранить в дневник</button>
      </section>}
    </article>
  )
}

function TextList({ title, values }: { title: string; values: string[] }) {
  if (values.length === 0) return null
  return <section><h3>{title}</h3><ul>{values.map((value, index) => <li key={index}><MarkdownLite text={value} /></li>)}</ul></section>
}
