import { useState, useMemo, useEffect } from 'react'
import { ASPECT_KEYS, ASPECT_COLORS, ASPECT_DATA, ASPECT_DISPLAY_KEY } from '../../data/aspects'
import { HALL_CONTENT } from '../../data/hallContent'
import { BLOCKS, LEVEL_LABELS, getBlockItems, teaseBlockData } from './blocks'
import SiWheel from './SiWheel'
import FeWheel from './FeWheel'
import NeWheel from './NeWheel'
import NiWheel from './NiWheel'
import FiWheel from './FiWheel'
import TeWheel from './TeWheel'
import TiWheel from './TiWheel'
import SeWheel from './SeWheel'
import PlaceholderWheel from './PlaceholderWheel'
import HabitSection from './HabitSection'
import Hint from '../Onboarding/Hint'
import styles from './AspectsView.module.css'

export default function AspectsView({ selectedAspect, onAspectSelect, scores, onScoreChange, diary, onDiaryChange, journey, onGoToSiSurveys, onGoToFeSurveys, onGoToNeSurveys, onGoToNiSurveys, onGoToFiSurveys, onGoToTeSurveys, onGoToTiSurveys, onGoToSeSurveys, onEnterHall, isAdmin = false, t, user }) {
  const [blockId, setBlockId] = useState(null)

  useEffect(() => {
    setBlockId(null)
  }, [selectedAspect])

  if (!selectedAspect) {
    return <AspectsGrid scores={scores} onAspectSelect={onAspectSelect} />
  }

  const data = ASPECT_DATA[selectedAspect]
  const color = ASPECT_COLORS[selectedAspect]
  const available = BLOCKS.filter(b => b.has(data, selectedAspect))

  if (blockId) {
    const idx = available.findIndex(b => b.id === blockId)
    const block = available[idx]
    if (!block) {
      return <Toc aspect={selectedAspect} data={data} color={color} available={available}
        scores={scores} onScoreChange={onScoreChange} onAspectSelect={onAspectSelect}
        journey={journey} onGoToSiSurveys={onGoToSiSurveys} onGoToFeSurveys={onGoToFeSurveys} onGoToNeSurveys={onGoToNeSurveys} onGoToNiSurveys={onGoToNiSurveys} onGoToFiSurveys={onGoToFiSurveys} onGoToTeSurveys={onGoToTeSurveys} onGoToTiSurveys={onGoToTiSurveys} onGoToSeSurveys={onGoToSeSurveys} onOpenBlock={setBlockId}
    onEnterHall={onEnterHall} isAdmin={isAdmin} />
    }
    return (
      <BlockReader
        key={blockId}
        aspect={selectedAspect}
        data={data}
        color={color}
        block={block}
        available={available}
        prev={available[idx - 1]}
        next={available[idx + 1]}
        diary={diary}
        onDiaryChange={onDiaryChange}
        onBack={() => setBlockId(null)}
        onGoto={setBlockId}
        journey={journey}
        isAdmin={isAdmin}
        user={user}
        onEnterHall={onEnterHall}
      />
    )
  }

  return <Toc aspect={selectedAspect} data={data} color={color} available={available}
    scores={scores} onScoreChange={onScoreChange} onAspectSelect={onAspectSelect}
    journey={journey} onGoToSiSurveys={onGoToSiSurveys} onGoToFeSurveys={onGoToFeSurveys} onGoToNeSurveys={onGoToNeSurveys} onGoToNiSurveys={onGoToNiSurveys} onGoToFiSurveys={onGoToFiSurveys} onGoToTeSurveys={onGoToTeSurveys} onGoToTiSurveys={onGoToTiSurveys} onGoToSeSurveys={onGoToSeSurveys} onOpenBlock={setBlockId}
    onEnterHall={onEnterHall} isAdmin={isAdmin} />
}

// ─── Сетка 8 аспектов ──────────────────────────────────────────────────────

function AspectsGrid({ scores, onAspectSelect }) {
  return (
    <div className={`${styles.aspectsGrid} ${styles.fadeIn}`}>
      {ASPECT_KEYS.map((key, i) => {
        const d = ASPECT_DATA[key]
        const color = ASPECT_COLORS[key]
        return (
          <button
            key={key}
            type="button"
            onClick={() => onAspectSelect(key)}
            className={`${styles.aspectCard} ${styles.stagger}`}
            style={{ '--accent': color, '--i': i }}
          >
            <div className={styles.aspectGlow} style={{ background: `radial-gradient(circle at 30% 20%, ${color}22, transparent 60%)` }} />
            <div className={styles.aspectTop}>
              <span className={styles.aspectCode} style={{ color, textShadow: `0 0 30px ${color}66` }}>{ASPECT_DISPLAY_KEY[key]}</span>
              <span className={styles.aspectScore}>{scores[key]}<span>/10</span></span>
            </div>
            <div className={styles.aspectName}>{d.name}</div>
            <div className={styles.aspectSub}>{d.sub}</div>
            <div className={styles.aspectMeter}>
              <div className={styles.aspectMeterFill} style={{
                width: `${scores[key] * 10}%`,
                background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                boxShadow: `0 0 12px ${color}88`
              }} />
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Оглавление аспекта ────────────────────────────────────────────────────

function Toc({ aspect, data, color, available, scores, onScoreChange, onAspectSelect, journey, onGoToSiSurveys, onGoToFeSurveys, onGoToNeSurveys, onGoToNiSurveys, onGoToFiSurveys, onGoToTeSurveys, onGoToTiSurveys, onGoToSeSurveys, onOpenBlock, onEnterHall, isAdmin = false }) {
  const byLevel = useMemo(() => {
    const m = { 0: [], 1: [], 2: [], 3: [] }
    available.forEach(b => m[b.level].push(b))
    return m
  }, [available])

  // Уровень доступа = текущий уровень путешествия по этому аспекту.
  // Admin видит всё (99 — sentinel). При гостевом state и без journey
  // считаем 0 — тогда L1+ заблюрится в BlockReader, в Toc мы помечаем
  // карточки lock-иконкой.
  const accessLevel = isAdmin
    ? 99
    : (journey?.aspects?.[aspect]?.currentLevel ?? 0)

  return (
    <div className={`${styles.tocPage} ${styles.fadeIn}`}>
      <AspectHeader
        aspect={aspect}
        data={data}
        color={color}
        score={scores[aspect]}
        onScoreChange={v => onScoreChange({ ...scores, [aspect]: v })}
        onBack={() => onAspectSelect(null)}
        onEnterHall={onEnterHall ? () => onEnterHall(aspect) : null}
      />

      {/* Колесо БС с разбивкой по 4 архетипам — только на странице БС.
          Заблокировано до прохождения L0 (currentLevel >= 1). */}
      {aspect === 'Si' && (
        <SiWheel
          skills={journey?.skills ?? {}}
          color={color}
          onContinueSurveys={onGoToSiSurveys}
          isLocked={!isAdmin && (journey?.aspects?.['Si']?.currentLevel ?? 0) < 1}
        />
      )}

      {/* Колесо ЧЭ с разбивкой по 4 архетипам ЧЭ — только на странице ЧЭ.
          Заблокировано до прохождения L0 ЧЭ (currentLevel >= 1). */}
      {aspect === 'Fe' && (
        <FeWheel
          skills={journey?.skills ?? {}}
          color={color}
          onContinueSurveys={onGoToFeSurveys}
          isLocked={!isAdmin && (journey?.aspects?.['Fe']?.currentLevel ?? 0) < 1}
        />
      )}

      {/* Колесо ЧИ с разбивкой по 4 архетипам ЧИ (Мудрец, Первооткрыватель,
          Катализатор, Визионер) — только на странице ЧИ.
          Заблокировано до прохождения L0 ЧИ (currentLevel >= 1). */}
      {aspect === 'Ne' && (
        <NeWheel
          skills={journey?.skills ?? {}}
          color={color}
          onContinueSurveys={onGoToNeSurveys}
          isLocked={!isAdmin && (journey?.aspects?.['Ne']?.currentLevel ?? 0) < 1}
        />
      )}

      {/* Колесо БИ с разбивкой по 4 архетипам БИ (Мифотворец, Провидец,
          Разоблачитель, Шаман) — только на странице БИ.
          Заблокировано до прохождения L0 БИ (currentLevel >= 1). */}
      {aspect === 'Ni' && (
        <NiWheel
          skills={journey?.skills ?? {}}
          color={color}
          onContinueSurveys={onGoToNiSurveys}
          isLocked={!isAdmin && (journey?.aspects?.['Ni']?.currentLevel ?? 0) < 1}
        />
      )}

      {/* Колесо БЭ с разбивкой по 4 архетипам БЭ (Дипломат, Духовник,
          Хранитель Рода, Друг) — только на странице БЭ.
          Заблокировано до прохождения L0 БЭ (currentLevel >= 1). */}
      {aspect === 'Fi' && (
        <FiWheel
          skills={journey?.skills ?? {}}
          color={color}
          onContinueSurveys={onGoToFiSurveys}
          isLocked={!isAdmin && (journey?.aspects?.['Fi']?.currentLevel ?? 0) < 1}
        />
      )}

      {/* Колесо ЧЛ с разбивкой по 4 архетипам ЧЛ (Виртуоз, Технолог,
          Организатор, Инженер) — только на странице ЧЛ.
          Заблокировано до прохождения L0 ЧЛ (currentLevel >= 1). */}
      {aspect === 'Te' && (
        <TeWheel
          skills={journey?.skills ?? {}}
          color={color}
          onContinueSurveys={onGoToTeSurveys}
          isLocked={!isAdmin && (journey?.aspects?.['Te']?.currentLevel ?? 0) < 1}
        />
      )}

      {/* Колесо ЧС с разбивкой по 4 архетипам ЧС (Защитник, Правитель,
          Строитель, Герой) — только на странице ЧС.
          Заблокировано до прохождения L0 ЧС (currentLevel >= 1). */}
      {aspect === 'Se' && (
        <SeWheel
          skills={journey?.skills ?? {}}
          color={color}
          onContinueSurveys={onGoToSeSurveys}
          isLocked={!isAdmin && (journey?.aspects?.['Se']?.currentLevel ?? 0) < 1}
        />
      )}

      {/* Колесо БЛ с разбивкой по 4 архетипам БЛ (Аналитик, Архитектор,
          Хранитель Порядка, Энциклопедист) — только на странице БЛ.
          Заблокировано до прохождения L0 БЛ (currentLevel >= 1). */}
      {aspect === 'Ti' && (
        <TiWheel
          skills={journey?.skills ?? {}}
          color={color}
          onContinueSurveys={onGoToTiSurveys}
          isLocked={!isAdmin && (journey?.aspects?.['Ti']?.currentLevel ?? 0) < 1}
        />
      )}

      <HabitSection aspect={aspect} color={color} />

      {onEnterHall && (() => {
        const hall = HALL_CONTENT?.[aspect]
        const counts = [
          hall?.figures?.length > 0 && `${hall.figures.length} личностей`,
          hall?.arts?.length > 0 && `${hall.arts.length} произведений искусства`,
          hall?.quotes?.length > 0 && `${hall.quotes.length} цитат`,
          hall?.interestingFacts?.length > 0 && `${hall.interestingFacts.length} интересных фактов`
        ].filter(Boolean)
        if (counts.length === 0) return null
        return (
          <button
            type="button"
            className={styles.tocHallCta}
            onClick={() => onEnterHall(aspect)}
            style={{ '--accent': color }}
          >
            <span className={styles.tocHallCtaIcon}>🏛</span>
            <span className={styles.tocHallCtaBody}>
              <span className={styles.tocHallCtaTitle}>Обсудить {data.name} с сообществом</span>
              <span className={styles.tocHallCtaCounts}>В Холле: {counts.join(' · ')}</span>
            </span>
            <span className={styles.tocHallCtaArrow} aria-hidden="true">→</span>
          </button>
        )
      })()}

      <div className={styles.tocIntro}>
        <p className={styles.tocIntroText}>{data.essence}</p>
      </div>

      {[0, 1, 2, 3].map(lvl => (
        byLevel[lvl].length > 0 && (
          <section key={lvl} className={styles.tocLevel}>
            <header className={styles.tocLevelHeader} style={{ '--accent': color }}>
              <span className={styles.tocLevelCode} style={{ color }}>{LEVEL_LABELS[lvl].code}</span>
              <div className={styles.tocLevelTitles}>
                <h2 className={styles.tocLevelName}>{LEVEL_LABELS[lvl].name}</h2>
                <p className={styles.tocLevelHint}>{LEVEL_LABELS[lvl].hint}</p>
              </div>
              <span className={styles.tocLevelCount}>{byLevel[lvl].length}</span>
            </header>
            <ul className={styles.tocList}>
              {byLevel[lvl].map((b, i) => {
                const isUnlocked = b.level <= accessLevel
                return (
                  <li key={b.id} className={styles.stagger} style={{ '--i': i }}>
                    <button
                      type="button"
                      className={`${styles.tocItem} ${isUnlocked ? '' : styles.tocItemLocked}`}
                      style={{ '--accent': color }}
                      onClick={() => onOpenBlock(b.id)}
                    >
                      <span className={styles.tocItemIdx}>{String(i + 1).padStart(2, '0')}</span>
                      <span className={styles.tocItemBody}>
                        <span className={styles.tocItemTitle}>
                          {b.title}
                          {!isUnlocked && (
                            <span className={styles.tocItemLockIcon} aria-hidden="true">🔒</span>
                          )}
                        </span>
                        <span className={styles.tocItemLead}>{b.lead}</span>
                      </span>
                      <span className={styles.tocItemArrow} aria-hidden="true">→</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      ))}
    </div>
  )
}

// ─── Шапка аспекта (одинаковая в оглавлении и чтении) ──────────────────────

function AspectHeader({ aspect, data, color, score, onScoreChange, onBack, compact, onEnterHall }) {
  return (
    <header className={`${styles.aspectHeader} ${compact ? styles.aspectHeaderCompact : ''}`} style={{ '--accent': color }}>
      <div
        className={styles.aspectHeaderBackdrop}
        style={{ background: `radial-gradient(ellipse at 10% 0%, ${color}33, transparent 55%)` }}
      />
      <button type="button" className={styles.backLink} onClick={onBack}>
        <span className={styles.backArrow}>←</span>
        <span>{compact ? 'оглавление' : 'ко всем аспектам'}</span>
      </button>
      {!compact && (
        <div className={styles.aspectHeaderBody}>
          <div className={styles.aspectHeaderTitle}>
            <span className={styles.aspectHeaderCode} style={{ color, textShadow: `0 0 40px ${color}88` }}>{ASPECT_DISPLAY_KEY[aspect]}</span>
            <div>
              <h1 className={styles.aspectHeaderName}>{data.name}</h1>
              <p className={styles.aspectHeaderSub}>{data.sub}</p>
            </div>
          </div>
          <div className={styles.scoreBox}>
            <span className={styles.scoreLabel}>моя оценка</span>
            <div className={styles.scoreRow}>
              <input
                type="range"
                min="1"
                max="10"
                value={score}
                onChange={e => onScoreChange(+e.target.value)}
                style={{ accentColor: color }}
                className={styles.scoreRange}
              />
              <span className={styles.scoreValue} style={{ color }}>{score}</span>
            </div>
            {onEnterHall && (
              <button
                type="button"
                className={styles.hallBtn}
                onClick={onEnterHall}
                style={{ borderColor: `${color}aa`, color }}
              >
                ✦ Войти в холл
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

// ─── Чтение одного блока (с sidebar) ───────────────────────────────────────

function BlockReader({ aspect, data, color, block, available, prev, next, diary, onDiaryChange, onBack, onGoto, journey, isAdmin = false, user, onEnterHall }) {
  const byLevel = useMemo(() => {
    const m = { 0: [], 1: [], 2: [], 3: [] }
    available.forEach(b => m[b.level].push(b))
    return m
  }, [available])

  // Уровень доступа по этому аспекту. Admin видит всё.
  const accessLevel = isAdmin
    ? 99
    : (journey?.aspects?.[aspect]?.currentLevel ?? 0)
  const isBlockUnlocked = block.level <= accessLevel
  const teaserData = useMemo(
    () => isBlockUnlocked ? data : teaseBlockData(block, data),
    [isBlockUnlocked, block, data]
  )

  const [noteOpen, setNoteOpen] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteSaved, setNoteSaved] = useState(false)
  const [pickedItemId, setPickedItemId] = useState('')

  const blockItems = useMemo(() => getBlockItems(block, data), [block, data])
  const pickedItem = useMemo(
    () => blockItems.find(it => it.id === pickedItemId) ?? null,
    [blockItems, pickedItemId]
  )

  // Закрыть форму и сбросить при смене блока
  useEffect(() => {
    setNoteOpen(false)
    setNoteText('')
    setNoteSaved(false)
    setPickedItemId('')
  }, [block?.id])

  const handleSaveNote = () => {
    const text = noteText.trim()
    if (!text || !onDiaryChange) return
    const entry = {
      id: Date.now(),
      date: new Date().toLocaleDateString('ru-RU'),
      ts: Date.now(),
      aspect,
      text,
      source: pickedItem ? 'aspect-item' : 'aspect',
      blockId: block.id,
      blockTitle: block.title,
      promptTitle: pickedItem ? pickedItem.label : block.title,
      prompt: pickedItem ? pickedItem.text : (block.lead ?? null),
      itemId: pickedItem?.id ?? null
    }
    onDiaryChange([entry, ...(diary ?? [])])
    setNoteText('')
    setNoteSaved(true)
    setNoteOpen(false)
    setPickedItemId('')
    setTimeout(() => setNoteSaved(false), 2200)
  }

  return (
    <div className={`${styles.readerLayout} ${styles.fadeIn}`} style={{ '--accent': color }}>
      {/* Левая колонка: sidebar */}
      <aside className={styles.sidebar}>
        <button type="button" className={styles.sidebarBack} onClick={onBack}>
          <span className={styles.backArrow}>←</span>
          <span>все блоки</span>
        </button>
        <div className={styles.sidebarAspect}>
          <span className={styles.sidebarAspectCode} style={{ color }}>{ASPECT_DISPLAY_KEY[aspect]}</span>
          <span className={styles.sidebarAspectName}>{data.name}</span>
        </div>
        <nav className={styles.sidebarNav}>
          {[0, 1, 2, 3].map(lvl => (
            byLevel[lvl].length > 0 && (
              <div key={lvl} className={styles.sidebarLevel}>
                <div className={styles.sidebarLevelHeader}>
                  <span className={styles.sidebarLevelCode} style={{ color }}>{LEVEL_LABELS[lvl].code}</span>
                  <span className={styles.sidebarLevelName}>{LEVEL_LABELS[lvl].name}</span>
                </div>
                <ul className={styles.sidebarList}>
                  {byLevel[lvl].map(b => {
                    const active = b.id === block.id
                    const sidebarLocked = b.level > accessLevel
                    return (
                      <li key={b.id}>
                        <button
                          type="button"
                          className={`${styles.sidebarItem} ${active ? styles.sidebarItemActive : ''} ${sidebarLocked ? styles.sidebarItemLocked : ''}`}
                          onClick={() => onGoto(b.id)}
                          style={active ? { color, borderLeftColor: color, background: `${color}14` } : {}}
                        >
                          {b.title}
                          {sidebarLocked && <span className={styles.sidebarLock} aria-hidden="true"> 🔒</span>}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          ))}
        </nav>
      </aside>

      {/* Правая колонка: чтение */}
      <article className={styles.reader}>
        <div
          className={styles.readerBackdrop}
          style={{ background: `radial-gradient(ellipse at 50% -10%, ${color}22, transparent 60%)` }}
        />

        <header className={styles.readerHeader}>
          <span className={styles.readerLevel} style={{ color }}>
            {LEVEL_LABELS[block.level].code} · {LEVEL_LABELS[block.level].name}
          </span>
          <h1 className={styles.readerTitle}>{block.title}</h1>
          <p className={styles.readerLead}>{block.lead}</p>
        </header>

        <div className={styles.readerBody}>
          {isBlockUnlocked ? (
            <BlockBody block={block} data={data} color={color} aspect={aspect} onEnterHall={onEnterHall} />
          ) : (
            <div className={styles.blockLocked}>
              <Hint id="aspect-locked-intro" user={user}>
                Часть теории закрыта замком. Дойди до соответствующего уровня в путешествии этого аспекта — откроются.
              </Hint>
              <BlockBody block={block} data={teaserData} color={color} aspect={aspect} onEnterHall={onEnterHall} />
              <div className={styles.blockSilhouette} aria-hidden="true">
                <div className={styles.silhouetteLine} style={{ width: '88%' }} />
                <div className={styles.silhouetteLine} style={{ width: '72%' }} />
                <div className={styles.silhouetteLine} style={{ width: '94%' }} />
                <div className={styles.silhouetteLine} style={{ width: '64%' }} />
                <div className={styles.silhouetteLine} style={{ width: '80%' }} />
              </div>
              <div className={styles.blockLockOverlay} style={{ '--accent': color }}>
                <div className={styles.blockLockIcon} aria-hidden="true">🔒</div>
                <div className={styles.blockLockHead}>
                  Откроется на{' '}
                  <strong style={{ color }}>
                    {LEVEL_LABELS[block.level].code} · {LEVEL_LABELS[block.level].name}
                  </strong>
                </div>
                <div className={styles.blockLockHint}>
                  Достигни Уровня {block.level} в путешествии этого аспекта,
                  чтобы открыть весь раздел.
                </div>
              </div>
            </div>
          )}
        </div>

        {onDiaryChange && (
          <div className={styles.noteSection}>
            {!noteOpen && (
              <button
                type="button"
                className={styles.noteOpenBtn}
                onClick={() => setNoteOpen(true)}
              >
                <span className={styles.noteOpenIcon}>✎</span>
                <span>Записать заметку</span>
                {noteSaved && <span className={styles.noteSavedBadge}>сохранено</span>}
              </button>
            )}
            {noteOpen && (
              <div className={styles.noteForm}>
                <div className={styles.noteFormHead}>
                  <span className={styles.noteFormLabel}>Заметка</span>
                  <button
                    type="button"
                    className={styles.noteCancelBtn}
                    onClick={() => { setNoteOpen(false); setNoteText(''); setPickedItemId('') }}
                  >
                    отмена
                  </button>
                </div>

                {blockItems.length > 0 && (
                  <div className={styles.noteTarget}>
                    <label className={styles.noteTargetLabel}>К чему именно?</label>
                    <select
                      className={styles.noteSelect}
                      value={pickedItemId}
                      onChange={e => setPickedItemId(e.target.value)}
                    >
                      <option value="">Ко всему блоку «{block.title}»</option>
                      {blockItems.map(it => (
                        <option key={it.id} value={it.id}>{it.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={styles.notePreview} style={{ '--accent': color }}>
                  <div className={styles.notePreviewTitle}>
                    {pickedItem ? pickedItem.label : block.title}
                  </div>
                  {(pickedItem ? pickedItem.text : block.lead) && (
                    <div className={styles.notePreviewText}>
                      {pickedItem ? pickedItem.text : block.lead}
                    </div>
                  )}
                </div>

                <textarea
                  className={styles.noteTextarea}
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  placeholder="Что отзывается, что хочется попробовать, какие ассоциации…"
                />
                <div className={styles.noteFormActions}>
                  <button
                    type="button"
                    className={styles.noteSaveBtn}
                    onClick={handleSaveNote}
                    disabled={!noteText.trim()}
                    style={{ '--accent': color }}
                  >
                    В дневник
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <nav className={styles.readerNav}>
          {prev ? (
            <button type="button" className={styles.navBtn} onClick={() => onGoto(prev.id)}>
              <span className={styles.navDir}>← предыдущий</span>
              <span className={styles.navTitle}>{prev.title}</span>
            </button>
          ) : <span />}
          {next ? (
            <button type="button" className={`${styles.navBtn} ${styles.navBtnRight}`} onClick={() => onGoto(next.id)}>
              <span className={styles.navDir}>следующий →</span>
              <span className={styles.navTitle}>{next.title}</span>
            </button>
          ) : <span />}
        </nav>
      </article>
    </div>
  )
}

// ─── Рендереры для каждого вида блока ──────────────────────────────────────

function BlockBody({ block, data, color, aspect, onEnterHall }) {
  const { kind, field } = block
  switch (kind) {
    case 'hallStub': {
      const section = block.hallSection
      const hall = HALL_CONTENT?.[aspect] ?? {}
      const items = hall[section] ?? []
      // Тизер: первые 3 элемента — короткими карточками.
      const teaser = items.slice(0, 3)
      const remaining = Math.max(0, items.length - teaser.length)
      const sectionLabel = {
        figures: 'личностей',
        arts: 'произведений',
        quotes: 'цитат',
        interestingFacts: 'фактов'
      }[section] ?? 'элементов'
      return (
        <div className={styles.hallStubBlock}>
          <p className={styles.hallStubLead}>
            Полная коллекция и обсуждение — в Холле. Здесь — короткий тизер.
          </p>
          <ul className={styles.hallStubList}>
            {teaser.map((item, i) => {
              const title = item.text ?? item.title ?? item.name ?? '—'
              const sub = item.author ?? item.note ?? item.desc ?? ''
              return (
                <li key={i} className={styles.hallStubItem}>
                  <span className={styles.hallStubItemTitle}>{title}</span>
                  {sub && <span className={styles.hallStubItemSub}>{sub}</span>}
                </li>
              )
            })}
          </ul>
          {remaining > 0 && (
            <div className={styles.hallStubMore}>
              + ещё {remaining} {sectionLabel} в Холле
            </div>
          )}
          {onEnterHall && (
            <button
              type="button"
              className={styles.hallStubCta}
              onClick={() => onEnterHall(aspect, section)}
              style={{ '--accent': color }}
            >
              <span>🏛 Открыть в Холле</span>
              <span aria-hidden="true">→</span>
            </button>
          )}
        </div>
      )
    }

    case 'text':
      return <Prose>{data.essence}</Prose>

    case 'textItalic':
      return <Prose italic>{data.superpower}</Prose>

    case 'list': {
      const items = data[field] || []
      return (
        <ul className={styles.bulletList}>
          {items.map((it, i) => (
            <li key={i} className={styles.bulletItem}>
              <span className={styles.bulletMark} style={{ background: color, boxShadow: `0 0 8px ${color}99` }} />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      )
    }

    case 'numberedList': {
      const items = data[field] || []
      return (
        <ol className={styles.numberList}>
          {items.map((it, i) => (
            <li key={i} className={styles.numberItem}>
              <span className={styles.numberIdx} style={{ color }}>{String(i + 1).padStart(2, '0')}</span>
              <span className={styles.numberText}>{it}</span>
            </li>
          ))}
        </ol>
      )
    }

    case 'archetypes':
      return (
        <div className={styles.twoCols}>
          <PolarBlock label="Тень" tone="shadow" items={data.archetypes.shadow} />
          <PolarBlock label="Дар" tone="gift" items={data.archetypes.gift} />
        </div>
      )

    case 'dilemmas':
      return (
        <div className={styles.dilemmaList}>
          {data.dilemmas.map((d, i) => (
            <div key={i} className={styles.dilemmaBlock}>
              <h3 className={styles.dilemmaTitle}>{d.t}</h3>
              <div className={styles.twoCols}>
                <div className={styles.polar}>
                  <div className={`${styles.polarLabel} ${styles.polarShadow}`}>Тень</div>
                  <p className={styles.polarText}>{d.s}</p>
                </div>
                <div className={styles.polar}>
                  <div className={`${styles.polarLabel} ${styles.polarGift}`}>Дар</div>
                  <p className={styles.polarText}>{d.g}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )

    case 'integration':
      return (
        <>
          <p className={styles.integrationIntro}>
            Противоположный аспект — <b style={{ color }}>{data.integration.opposite}</b>.
            {' '}{data.integration.desc}
          </p>
          {data.integration.practices?.map((p, i) => (
            <PracticeItem key={i} name={p.name} desc={p.desc} color={color} />
          ))}
        </>
      )

    case 'synergy':
      return (
        <div className={styles.synergyList}>
          {data.synergy.map((s, i) => (
            <div key={i} className={styles.synergyBlock}>
              <div className={styles.synergyHead} style={{ color }}>
                <span className={styles.synergyPair}>{s.aspects}</span>
                <span className={styles.synergySep}>·</span>
                <span className={styles.synergyName}>{s.name}</span>
              </div>
              <p className={styles.synergyDesc}>{s.desc}</p>
            </div>
          ))}
        </div>
      )

    case 'polysemy':
      return (
        <div className={styles.polysemyList}>
          {data.polysemy.map((p, i) => (
            <div key={i} className={styles.polysemyBlock}>
              <div className={styles.polysemyWord} style={{ color }}>{p.word}</div>
              <div className={styles.polysemyVariants}>{p.variants}</div>
            </div>
          ))}
        </div>
      )

    case 'practices':
      return data.practices.map((p, i) => (
        <PracticeItem key={i} name={p.name} desc={p.desc} color={color} index={i + 1} />
      ))

    case 'titledList': {
      const items = data[field] || []
      return items.map((p, i) => (
        <PracticeItem key={i} name={p.name} desc={p.desc} color={color} index={i + 1} />
      ))
    }

    case 'archetypePath':
      return (
        <div className={styles.pathList}>
          {data.archetypePath.map((p, i) => (
            <div key={i} className={styles.pathBlock} style={{ borderColor: `${color}33` }}>
              <h3 className={styles.pathName} style={{ color }}>{p.name}</h3>
              <div className={styles.pathRow}>
                <div className={styles.pathLabel}>Предпосылка</div>
                <div className={styles.pathText}>{p.prerequisite}</div>
              </div>
              <div className={styles.pathRow}>
                <div className={styles.pathLabel}>Главный урок</div>
                <div className={styles.pathText}>{p.lesson}</div>
              </div>
              <div className={styles.pathTransition}>
                <span style={{ color }}>→</span> {p.transition}
              </div>
            </div>
          ))}
        </div>
      )

    case 'fears':
      return (
        <>
          <div className={styles.fearRow}>
            <div className={styles.fearLabel}>Страхи</div>
            <p className={styles.fearText}>{data.fears}</p>
          </div>
          <div className={styles.fearRow}>
            <div className={styles.fearLabel}>Защиты</div>
            <p className={styles.fearText}>{data.defenses}</p>
          </div>
        </>
      )

    case 'somatic':
      return (
        <div className={styles.twoCols}>
          <PolarBlock label="Тень" tone="shadow" items={data.somatic.shadow} />
          <PolarBlock label="Дар" tone="gift" items={data.somatic.gift} />
        </div>
      )

    case 'assessment':
      return (
        <div className={styles.assessList}>
          {data.selfAssessment.map((mp, mi) => (
            <div key={mi} className={styles.assessBlock}>
              <h3 className={styles.assessPole} style={{ color }}>
                <span className={styles.assessIdx}>{String(mi + 1).padStart(2, '0')}</span>
                {mp.pole}
              </h3>
              <ul className={styles.assessQs}>
                {mp.qs.map((q, qi) => (
                  <li key={qi} className={styles.assessQ}>{q}</li>
                ))}
              </ul>
            </div>
          ))}
          <p className={styles.assessNote}>Ответы записывай в раздел «Дневник».</p>
        </div>
      )

    case 'skillBlocks': {
      const items = data[field] || []
      return (
        <div className={styles.skillBlockList}>
          {items.map((sk, i) => (
            <SkillBlockCard key={sk.skillId || i} sk={sk} color={color} />
          ))}
        </div>
      )
    }

    default:
      return null
  }
}

// ─── Переиспользуемые кусочки ──────────────────────────────────────────────

function Prose({ children, italic }) {
  return <p className={`${styles.prose} ${italic ? styles.proseItalic : ''}`}>{children}</p>
}

function PolarBlock({ label, tone, items }) {
  return (
    <div className={styles.polar}>
      <div className={`${styles.polarLabel} ${tone === 'shadow' ? styles.polarShadow : styles.polarGift}`}>
        {label}
      </div>
      <ul className={styles.polarList}>
        {items.map((it, i) => <li key={i} className={styles.polarItem}>{it}</li>)}
      </ul>
    </div>
  )
}

// Карточка одного навыка с 4 блоками психодинамики:
// вытеснение / защита / убеждения / родовые программы.
// Простая bold-разметка `**текст**` подсвечивается курсивом-жирным;
// списки рендерятся как ul.
function SkillBlockCard({ sk, color }) {
  if (!sk) return null
  return (
    <div className={styles.skillBlockCard} style={{ borderColor: `${color}33` }}>
      <h3 className={styles.skillBlockName} style={{ color }}>{sk.name}</h3>

      {sk.suppression && (
        <div className={styles.skillBlockRow}>
          <div className={styles.skillBlockLabel}>1. Вытеснение</div>
          <p className={styles.skillBlockText}>{renderBoldRich(sk.suppression)}</p>
        </div>
      )}

      {sk.defense && (
        <div className={styles.skillBlockRow}>
          <div className={styles.skillBlockLabel}>2. Психологическая защита</div>
          <p className={styles.skillBlockText}>{renderBoldRich(sk.defense)}</p>
        </div>
      )}

      {sk.beliefs?.length > 0 && (
        <div className={styles.skillBlockRow}>
          <div className={styles.skillBlockLabel}>3. Ограничивающие убеждения</div>
          <ul className={styles.skillBlockList2}>
            {sk.beliefs.map((b, i) => (
              <li key={i} className={styles.skillBlockItem}>{renderBoldRich(b)}</li>
            ))}
          </ul>
        </div>
      )}

      {sk.family?.length > 0 && (
        <div className={styles.skillBlockRow}>
          <div className={styles.skillBlockLabel}>4. Родовые программы</div>
          <ul className={styles.skillBlockList2}>
            {sk.family.map((f, i) => (
              <li key={i} className={styles.skillBlockItem}>{renderBoldRich(f)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Минимальный inline-парсер `**bold**` для выделений в текстах блоков.
// Возвращает массив React-элементов / строк.
function renderBoldRich(text) {
  if (!text) return null
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    const m = /^\*\*(.+)\*\*$/.exec(p)
    if (m) return <strong key={i}>{m[1]}</strong>
    return p
  })
}

function PracticeItem({ name, desc, color, index }) {
  return (
    <div className={styles.practiceItem}>
      <h3 className={styles.practiceName} style={{ color }}>
        {index != null && <span className={styles.practiceIdx}>{String(index).padStart(2, '0')}</span>}
        {name}
      </h3>
      <p className={styles.practiceDesc}>{desc}</p>
    </div>
  )
}
