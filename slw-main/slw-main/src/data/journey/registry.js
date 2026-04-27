// Реестр путешествий по аспектам.
//
// Сейчас доступны: БС — уровни 0, 1 и 2.
// Остальные 7 аспектов — заглушки с пометкой «скоро».
//
// Уровень состоит из core-сценария (массив скриптов в линейной
// последовательности) и опционально `surveys` — анкеты по навыкам
// аспекта, доступные параллельно через дерево навыков (Колесо).

import {
  BS_ASPECT_INTRO,
  BS_LEVEL_0_CORE, BS_LEVEL_0_SURVEYS, BS_LEVEL_0_COMPLETE,
  BS_LEVEL_1_CORE, BS_LEVEL_1_COMPLETE,
  BS_LEVEL_2_CORE, BS_LEVEL_2_COMPLETE
} from './aspects/bs'
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
        core: BS_LEVEL_0_CORE,
        surveys: BS_LEVEL_0_SURVEYS,
        complete: BS_LEVEL_0_COMPLETE,
        // Алиас для совместимости с местами, которые читали `scripts` напрямую.
        scripts: BS_LEVEL_0_CORE
      },
      1: {
        title: 'Карта и намерение',
        core: BS_LEVEL_1_CORE,
        complete: BS_LEVEL_1_COMPLETE,
        scripts: BS_LEVEL_1_CORE
      },
      2: {
        title: 'Системы заботы',
        core: BS_LEVEL_2_CORE,
        complete: BS_LEVEL_2_COMPLETE,
        scripts: BS_LEVEL_2_CORE
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
