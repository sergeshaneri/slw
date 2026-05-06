// Реестр путешествий по аспектам.
//
// Доступно: Si (уровни 0–3, 3 в работе), Ti (только L0), Ne (уровни 0–3, 3 в работе),
// Fe (уровни 0–3, 3 в работе), Ni (уровни 0–3, 3 в работе).
// Остальные 3 аспекта — заглушки с пометкой «скоро» на Карте Планет.
//
// Уровень состоит из core-сценария (массив скриптов в линейной
// последовательности) и опционально `surveys` — анкеты по навыкам
// аспекта, доступные параллельно через дерево навыков (Колесо).

import {
  SI_ASPECT_INTRO,
  SI_LEVEL_0_CORE, SI_LEVEL_0_SURVEYS, SI_LEVEL_0_COMPLETE,
  SI_LEVEL_1_CORE, SI_LEVEL_1_COMPLETE,
  SI_LEVEL_2_CORE, SI_LEVEL_2_COMPLETE,
  SI_LEVEL_3_CORE, SI_LEVEL_3_COMPLETE
} from './aspects/Si'
import {
  TI_ASPECT_INTRO,
  TI_LEVEL_0_CORE, TI_LEVEL_0_COMPLETE
} from './aspects/Ti'
import {
  NE_ASPECT_INTRO,
  NE_LEVEL_0_CORE, NE_LEVEL_0_COMPLETE,
  NE_LEVEL_1_CORE, NE_LEVEL_1_COMPLETE,
  NE_LEVEL_2_CORE, NE_LEVEL_2_COMPLETE,
  NE_LEVEL_3_CORE, NE_LEVEL_3_COMPLETE
} from './aspects/Ne'
import {
  FE_ASPECT_INTRO,
  FE_LEVEL_0_CORE, FE_LEVEL_0_COMPLETE,
  FE_LEVEL_1_CORE, FE_LEVEL_1_COMPLETE,
  FE_LEVEL_2_CORE, FE_LEVEL_2_COMPLETE,
  FE_LEVEL_3_CORE, FE_LEVEL_3_COMPLETE
} from './aspects/Fe'
import {
  NI_ASPECT_INTRO,
  NI_LEVEL_0_CORE, NI_LEVEL_0_COMPLETE,
  NI_LEVEL_1_CORE, NI_LEVEL_1_COMPLETE,
  NI_LEVEL_2_CORE, NI_LEVEL_2_COMPLETE,
  NI_LEVEL_3_CORE, NI_LEVEL_3_COMPLETE
} from './aspects/Ni'
import { ASPECT_KEYS, ASPECT_DATA, ASPECT_REALMS, ASPECT_COLORS } from '../aspects'

// Латинские имена планет. Только для тех, у кого они уже придуманы.
// Остальные — отображаются на карте без латинской подписи.
const PLANETS = {
  Si: 'Terra Harmonia',
  Ti: 'Structura Mentis',
  Fe: 'Passio Ignis',
  Ne: 'Essence Prime',
  Ni: 'Tempum Spiralis',
}

export const JOURNEYS = {
  Si: {
    available: true,
    planet: PLANETS.Si,
    intro: SI_ASPECT_INTRO,
    levels: {
      0: {
        title: 'Первый контакт',
        core: SI_LEVEL_0_CORE,
        surveys: SI_LEVEL_0_SURVEYS,
        complete: SI_LEVEL_0_COMPLETE,
        // Алиас для совместимости с местами, которые читали `scripts` напрямую.
        scripts: SI_LEVEL_0_CORE
      },
      1: {
        title: 'Карта и намерение',
        core: SI_LEVEL_1_CORE,
        complete: SI_LEVEL_1_COMPLETE,
        scripts: SI_LEVEL_1_CORE
      },
      2: {
        title: 'Системы заботы',
        core: SI_LEVEL_2_CORE,
        complete: SI_LEVEL_2_COMPLETE,
        scripts: SI_LEVEL_2_CORE
      },
      3: {
        title: 'Тень и принятие',
        core: SI_LEVEL_3_CORE,
        complete: SI_LEVEL_3_COMPLETE,
        scripts: SI_LEVEL_3_CORE
      }
    }
  },
  Ti: {
    available: true,
    planet: PLANETS.Ti,
    intro: TI_ASPECT_INTRO,
    levels: {
      0: {
        title: 'Первый контакт',
        core: TI_LEVEL_0_CORE,
        complete: TI_LEVEL_0_COMPLETE,
        scripts: TI_LEVEL_0_CORE
      }
    }
  },
  Ne: {
    available: true,
    planet: PLANETS.Ne,
    intro: NE_ASPECT_INTRO,
    levels: {
      0: {
        title: 'Первый контакт',
        core: NE_LEVEL_0_CORE,
        complete: NE_LEVEL_0_COMPLETE,
        scripts: NE_LEVEL_0_CORE
      },
      1: {
        title: 'Карта и намерение',
        core: NE_LEVEL_1_CORE,
        complete: NE_LEVEL_1_COMPLETE,
        scripts: NE_LEVEL_1_CORE
      },
      2: {
        title: 'Системы видения',
        core: NE_LEVEL_2_CORE,
        complete: NE_LEVEL_2_COMPLETE,
        scripts: NE_LEVEL_2_CORE
      },
      3: {
        title: 'Тень и трансмутация',
        core: NE_LEVEL_3_CORE,
        complete: NE_LEVEL_3_COMPLETE,
        scripts: NE_LEVEL_3_CORE
      }
    }
  },
  Fe: {
    available: true,
    planet: PLANETS.Fe,
    intro: FE_ASPECT_INTRO,
    levels: {
      0: {
        title: 'Первый контакт',
        core: FE_LEVEL_0_CORE,
        complete: FE_LEVEL_0_COMPLETE,
        scripts: FE_LEVEL_0_CORE
      },
      1: {
        title: 'Карта и намерение',
        core: FE_LEVEL_1_CORE,
        complete: FE_LEVEL_1_COMPLETE,
        scripts: FE_LEVEL_1_CORE
      },
      2: {
        title: 'Системы эмо-канала',
        core: FE_LEVEL_2_CORE,
        complete: FE_LEVEL_2_COMPLETE,
        scripts: FE_LEVEL_2_CORE
      },
      3: {
        title: 'Тень и трансмутация',
        core: FE_LEVEL_3_CORE,
        complete: FE_LEVEL_3_COMPLETE,
        scripts: FE_LEVEL_3_CORE
      }
    }
  },
  Ni: {
    available: true,
    planet: PLANETS.Ni,
    intro: NI_ASPECT_INTRO,
    levels: {
      0: {
        title: 'Первый контакт',
        core: NI_LEVEL_0_CORE,
        complete: NI_LEVEL_0_COMPLETE,
        scripts: NI_LEVEL_0_CORE
      },
      1: {
        title: 'Карта и намерение',
        core: NI_LEVEL_1_CORE,
        complete: NI_LEVEL_1_COMPLETE,
        scripts: NI_LEVEL_1_CORE
      },
      2: {
        title: 'Системы чутья',
        core: NI_LEVEL_2_CORE,
        complete: NI_LEVEL_2_COMPLETE,
        scripts: NI_LEVEL_2_CORE
      },
      3: {
        title: 'Тень и трансмутация',
        core: NI_LEVEL_3_CORE,
        complete: NI_LEVEL_3_COMPLETE,
        scripts: NI_LEVEL_3_CORE
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
    planet: PLANETS[key] ?? null,
    available: !!JOURNEYS[key]?.available
  }))
}

export function getJourney(aspect) {
  return JOURNEYS[aspect] ?? null
}
