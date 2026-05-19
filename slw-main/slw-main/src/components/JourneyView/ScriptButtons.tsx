import type { Script } from '@/types/script'
import styles from './JourneyView.module.css'

type Props = {
  script: Script
  onAction: (action: string, scriptId: string) => void
}

export default function ScriptButtons({ script, onAction }: Props) {
  const act = (a: string) => onAction(a, script.id)
  switch (script.type) {
    case 'theory':
      return (
        <div className={styles.btnRow}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => act('next')}>Далее</button>
        </div>
      )
    case 'question': {
      // Формат A: шкала 1–10 → числовой ввод (ползунок).
      //   Триггерится либо followUp-блоками, либо явным `scale: 1-10`.
      // Формат B: open-ended (ни того, ни другого) → текстовый ввод.
      // См. SCRIPT_GUIDELINES §4.2.
      // «Напомнить позже» убрано: вопрос либо отвечаешь сейчас (ответ
      // уходит в дневник/skill), либо «взять в активные задания» — но
      // тогда тоже остаётся след. Простого пропуска без записи нет.
      const hasScale = !!script.followUp || !!script.scale
      return (
        <div className={styles.btnRow}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnAccent}`}
            onClick={() => act(hasScale ? 'answer_number' : 'answer_text')}
          >
            {hasScale ? 'Ответить (1–10)' : 'Ответить'}
          </button>
        </div>
      )
    }
    case 'exercise':
      // «Позже» убрано — упражнение можно либо сделать сейчас (с инсайтом),
      // либо взять в ежедневные практики (запись в habits + pendingTasks).
      // Просто «пропустить без следа» больше нельзя.
      return (
        <div className={styles.btnRow}>
          {/* «Сделал, записать» — открывает обязательный insight о результате.
              См. handleScriptAction → complete_exercise → awaitingInput=exercise_note. */}
          <button type="button" className={`${styles.btn} ${styles.btnAccent}`} onClick={() => act('complete_exercise')}>
            ✓ Сделал, записать инсайт
          </button>
          {/* «Взять в практики» — заносит упражнение в активные задания
              и одновременно делает его ежедневной практикой аспекта
              (POST /api/habits/choose в handleScriptAction). */}
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => act('done')}>
            🪐 Взять в ежедневные практики
          </button>
        </div>
      )
    case 'word':
      // Word-скрипты («слова дня») заканчиваются прямым «Подумай: …»-вопросом.
      // Это микро-рефлексия, не задача — её не «откладывают», над ней либо
      // думают и записывают инсайт, либо пропускают сейчас и возвращаются
      // позже (просто не нажимая кнопку, скрипт остаётся в чате открытым).
      // Поэтому здесь одна кнопка: «Подумал об этом» открывает текстовый
      // ввод (action='answer_text'), запись уходит в дневник с привязкой
      // к слову дня (prompt = текст, promptTitle = «Слово дня: X»),
      // XP+stardust начисляются после записи (см. handleSend).
      return (
        <div className={styles.btnRow}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => act('answer_text')}>Подумал об этом</button>
        </div>
      )
    case 'reflection':
      // «Пропустить» убрано: после каждого шага в путешествии должна
      // оставаться запись — для reflection это инсайт в дневнике.
      // Если юзеру совсем нечего сказать — короткого ответа («да», «потом»)
      // достаточно (минимум 10 символов проверяется в SurveyScreen/insight UI).
      return (
        <div className={styles.btnRow}>
          <button type="button" className={`${styles.btn} ${styles.btnAccent}`} onClick={() => act('answer_text')}>Ответить</button>
        </div>
      )
    case 'survey':
      return (
        <div className={styles.btnRow}>
          <button type="button" className={`${styles.btn} ${styles.btnAccent}`} onClick={() => act('start_survey')}>Начать анкету</button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => act('next')}>Позже</button>
        </div>
      )
    default:
      return null
  }
}
