/**
 * Миграция гостевого прогресса в аккаунт при логине.
 *
 * Гость играет → его данные пишутся в localStorage['whl_*'].
 * Юзер логинится → App.tsx fetches state с бэка (loadFromApi) и перезаписывает
 * локальный state бэк-данными. Без миграции `whl_*` остаётся orphan'ом, юзер
 * видит «свежий» аккаунт без своего прогресса.
 *
 * Стратегия: **max-merge без подтверждения**. Не разрушает данные:
 *   • Глобальные скаляры (xp, streak, stardust, totalCompleted) — max обоих
 *   • aspects[X].completedScripts — union
 *   • aspects[X].currentLevel/Index — max
 *   • messages — берём из бэка если есть, иначе из guest (чтобы у юзеров с
 *     прогрессом на разных устройствах не дублировались сообщения)
 *   • skills — union (бэк имеет приоритет на конфликтах)
 *   • diary entries — все из guest добавляются (бэк дальше переиндексирует)
 *   • scores — max
 *
 * После успешного push на бэк — `whl_*` стирается. Если юзер выйдет из
 * аккаунта, начнёт играть как гость заново — будет чистый старт.
 */
import type { JourneyState, AspectState } from '@/types/journey'
import type { DiaryEntry } from '@/types/diary'
import type { AspectKey, AspectScores } from '@/types/aspect'

const LS = {
  scores:  'whl_scores',
  diary:   'whl_diary',
  journey: 'whl_journey',
} as const

export type GuestProgress = {
  journey: JourneyState | null
  scores: AspectScores | null
  diary: DiaryEntry[]
  summary: {
    xp: number
    totalCompleted: number
    diaryCount: number
    aspectsTouched: number
  }
}

function lsGet<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : null
  } catch {
    return null
  }
}

/**
 * Прочитать гостевой прогресс из localStorage.
 * Возвращает структуру с summary. Если в LS вообще ничего — null.
 * Если есть, но «незначимое» (xp=0, completedScripts пусты везде) —
 * вернётся объект с summary.* = 0 (вызывающий пусть решает что делать).
 */
export function readGuestProgress(): GuestProgress | null {
  const journey = lsGet<JourneyState>(LS.journey)
  const diary   = lsGet<DiaryEntry[]>(LS.diary) ?? []
  const scores  = lsGet<AspectScores>(LS.scores)

  if (!journey && diary.length === 0 && !scores) return null

  const xp = journey?.xp ?? 0
  const totalCompleted = journey?.totalCompleted ?? 0
  const aspects = journey?.aspects ?? {}
  let aspectsTouched = 0
  for (const k of Object.keys(aspects)) {
    const a = (aspects as Record<string, AspectState | undefined>)[k]
    if (((a?.completedScripts?.length ?? 0) > 0) || ((a?.currentLevel ?? 0) > 0)) {
      aspectsTouched++
    }
  }

  return {
    journey,
    scores,
    diary,
    summary: {
      xp,
      totalCompleted,
      diaryCount: diary.length,
      aspectsTouched,
    },
  }
}

/**
 * Стоит ли мигрировать? «Значимый» прогресс — хотя бы один из:
 *   • xp > 0
 *   • totalCompleted > 0
 *   • есть аспект с completedScripts.length > 0 или currentLevel > 0
 *   • есть записи в дневнике
 */
export function hasMeaningfulGuestProgress(gp: GuestProgress | null): boolean {
  if (!gp) return false
  const { xp, totalCompleted, diaryCount, aspectsTouched } = gp.summary
  return xp > 0 || totalCompleted > 0 || diaryCount > 0 || aspectsTouched > 0
}

/**
 * Max-merge двух journey-state. api имеет приоритет на конфликтах кроме
 * скаляров (там Math.max). messages берём из api если непустой, иначе guest.
 */
export function mergeJourneys(
  api: JourneyState | null | undefined,
  guest: JourneyState | null | undefined,
): JourneyState {
  const a: Partial<JourneyState> = (api ?? {}) as Partial<JourneyState>
  const g: Partial<JourneyState> = (guest ?? {}) as Partial<JourneyState>

  // Глобальные скаляры — max
  const xp             = Math.max(a.xp ?? 0,             g.xp ?? 0)
  const streak         = Math.max(a.streak ?? 0,         g.streak ?? 0)
  const stardust       = Math.max(a.stardust ?? 0,       g.stardust ?? 0)
  const totalCompleted = Math.max(a.totalCompleted ?? 0, g.totalCompleted ?? 0)

  // skills — union, api имеет приоритет если у обоих есть один id
  const skills: Record<string, unknown> = { ...(g.skills ?? {}) as Record<string, unknown>, ...(a.skills ?? {}) as Record<string, unknown> }

  // currentAspect — берём api если есть, иначе guest
  const currentAspect = (a.currentAspect ?? g.currentAspect ?? 'Si') as AspectKey

  // aspects — union, для каждого аспекта берём свой max-merge
  const apiAspects   = (a.aspects ?? {}) as Record<string, AspectState>
  const guestAspects = (g.aspects ?? {}) as Record<string, AspectState>
  const allKeys = new Set([...Object.keys(apiAspects), ...Object.keys(guestAspects)])
  const aspects: Record<string, AspectState> = {}
  for (const k of allKeys) {
    const apA = apiAspects[k] ?? ({} as AspectState)
    const gsA = guestAspects[k] ?? ({} as AspectState)

    const apMsgsLen = apA.messages?.length ?? 0
    aspects[k] = {
      currentLevel:        Math.max(apA.currentLevel ?? 0, gsA.currentLevel ?? 0) as 0 | 1 | 2 | 3,
      currentScriptIndex:  Math.max(apA.currentScriptIndex ?? 0, gsA.currentScriptIndex ?? 0),
      currentScriptId:     apA.currentScriptId ?? gsA.currentScriptId ?? null,
      awaitingInput:       apA.awaitingInput ?? gsA.awaitingInput ?? null,
      // messages: если api имеет историю, не трогаем — иначе берём guest
      messages:            apMsgsLen > 0 ? apA.messages : (gsA.messages ?? []),
      completedScripts:    Array.from(new Set([
        ...(apA.completedScripts ?? []),
        ...(gsA.completedScripts ?? []),
      ])),
      pendingTasks:        apA.pendingTasks ?? gsA.pendingTasks ?? [],
    }
  }

  // lastActiveDate — берём свежее
  const apDate = a.lastActiveDate ?? ''
  const gsDate = g.lastActiveDate ?? ''
  const lastActiveDate = apDate >= gsDate ? apDate : gsDate

  return {
    ...(a as JourneyState),
    xp, streak, stardust, totalCompleted,
    skills: skills as JourneyState['skills'],
    currentAspect,
    aspects: aspects as JourneyState['aspects'],
    lastActiveDate,
  } as JourneyState
}

/**
 * Max-merge оценок аспектов (1-10 шкала).
 */
export function mergeScores(
  api: AspectScores | null | undefined,
  guest: AspectScores | null | undefined,
): AspectScores {
  const out = { ...(api ?? {}) } as Record<string, number>
  if (guest) {
    for (const [k, v] of Object.entries(guest)) {
      const existing = out[k] ?? 0
      out[k] = Math.max(existing, v as number)
    }
  }
  return out as AspectScores
}

/**
 * Стереть гостевые ключи из localStorage. Вызывается после успешного
 * push'а смерженного state на бэк.
 */
export function clearGuestProgress(): void {
  try {
    localStorage.removeItem(LS.scores)
    localStorage.removeItem(LS.diary)
    localStorage.removeItem(LS.journey)
  } catch {
    /* private mode / SSR */
  }
}
