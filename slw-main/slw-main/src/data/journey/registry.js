// Реестр путешествий по аспектам.
//
// Сейчас доступна только БС (Terra Harmonia) с уровнем 0.
// Остальные 7 аспектов — заглушки с пометкой «скоро».

import { BS_ASPECT_INTRO, BS_LEVEL_0_SCRIPTS, BS_LEVEL_0_COMPLETE } from './aspects/bs'
import { ASPECT_KEYS, ASPECT_DATA, ASPECT_REALMS, ASPECT_COLORS } from '../aspects'

const PLANETS = {
  БС: 'Terra Harmonia',
  ЧИ: 'Caelum Possibilis',
  БИ: 'Tempora Profunda',
  ЧС: 'Imperium Vivum',
  БЛ: 'Structura Mentis',
  ЧЛ: 'Officium Operum',
  БЭ: 'Cordia Vinculum',
  ЧЭ: 'Ignis Animae'
}

export const JOURNEYS = {
  БС: {
    available: true,
    planet: PLANETS.БС,
    intro: BS_ASPECT_INTRO,
    levels: {
      0: {
        title: 'Первый контакт',
        scripts: BS_LEVEL_0_SCRIPTS,
        complete: BS_LEVEL_0_COMPLETE
      }
    }
  }
}

// Список карточек для экрана выбора планеты — все 8 аспектов.
// available: false означает «скоро».
export function getAllPlanets() {
  return ASPECT_KEYS.map(key => ({
    aspect: key,
    name: ASPECT_DATA[key].name,
    realm: ASPECT_REALMS[key],
    color: ASPECT_COLORS[key],
    planet: PLANETS[key],
    available: !!JOURNEYS[key]?.available
  }))
}

export function getJourney(aspect) {
  return JOURNEYS[aspect] ?? null
}
