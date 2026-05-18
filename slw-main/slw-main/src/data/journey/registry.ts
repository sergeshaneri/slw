// Реестр путешествий по аспектам.
//
// Доступно: Si (уровни 0–3, 3 в работе), Ti (уровни 0–3, 3 в работе), Ne (уровни 0–3, 3 в работе),
// Fe (уровни 0–3, 3 в работе), Ni (уровни 0–3, 3 в работе), Fi (уровни 0–3, 3 в работе),
// Te (уровни 0–3, 3 в работе), Se (уровни 0–3, 3 в работе).
// Все 8 аспектов теперь имеют контент.
//
// Уровень состоит из core-сценария (массив скриптов в линейной
// последовательности) и опционально `surveys` — анкеты по навыкам
// аспекта, доступные параллельно через дерево навыков (Колесо).

import type { AspectKey } from '@/types/aspect'
import type { Script } from '@/types/script'
import type { CompleteEntry, IntroEntry } from './parseScripts'
import {
  SI_ASPECT_INTRO,
  SI_LEVEL_0_CORE, SI_LEVEL_0_SURVEYS, SI_LEVEL_0_COMPLETE,
  SI_LEVEL_1_CORE, SI_LEVEL_1_COMPLETE,
  SI_LEVEL_2_CORE, SI_LEVEL_2_COMPLETE,
  SI_LEVEL_3_CORE, SI_LEVEL_3_COMPLETE
} from './aspects/Si'
import {
  TI_ASPECT_INTRO,
  TI_LEVEL_0_CORE, TI_LEVEL_0_SURVEYS, TI_LEVEL_0_COMPLETE,
  TI_LEVEL_1_CORE, TI_LEVEL_1_COMPLETE,
  TI_LEVEL_2_CORE, TI_LEVEL_2_COMPLETE,
  TI_LEVEL_3_CORE, TI_LEVEL_3_COMPLETE
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
import {
  FI_ASPECT_INTRO,
  FI_LEVEL_0_CORE, FI_LEVEL_0_COMPLETE,
  FI_LEVEL_1_CORE, FI_LEVEL_1_COMPLETE,
  FI_LEVEL_2_CORE, FI_LEVEL_2_COMPLETE,
  FI_LEVEL_3_CORE, FI_LEVEL_3_COMPLETE
} from './aspects/Fi'
import {
  TE_ASPECT_INTRO,
  TE_LEVEL_0_CORE, TE_LEVEL_0_SURVEYS, TE_LEVEL_0_COMPLETE,
  TE_LEVEL_1_CORE, TE_LEVEL_1_COMPLETE,
  TE_LEVEL_2_CORE, TE_LEVEL_2_COMPLETE,
  TE_LEVEL_3_CORE, TE_LEVEL_3_COMPLETE
} from './aspects/Te'
import {
  SE_ASPECT_INTRO,
  SE_LEVEL_0_CORE, SE_LEVEL_0_SURVEYS, SE_LEVEL_0_COMPLETE,
  SE_LEVEL_1_CORE, SE_LEVEL_1_COMPLETE,
  SE_LEVEL_2_CORE, SE_LEVEL_2_COMPLETE,
  SE_LEVEL_3_CORE, SE_LEVEL_3_COMPLETE
} from './aspects/Se'
import { ASPECT_KEYS, ASPECT_DATA, ASPECT_REALMS, ASPECT_COLORS } from '../aspects'

// Уровень путешествия. `surveys` присутствует только у L0 для аспектов
// с интегрированным анкетным пулом (Si/Ti/Te/Se).
export type JourneyLevel = {
  title: string
  core: Script[]
  surveys?: Script[]
  complete: CompleteEntry
  // Алиас для совместимости с местами, которые читали `scripts` напрямую.
  scripts: Script[]
}

export type Journey = {
  available: boolean
  planet: string
  intro: IntroEntry[]
  levels: {
    0: JourneyLevel
    1: JourneyLevel
    2: JourneyLevel
    3: JourneyLevel
  }
}

export type Planet = {
  aspect: AspectKey
  name: string
  realm: string
  color: string
  planet: string | null
  available: boolean
}

// Латинские имена планет. Только для тех, у кого они уже придуманы.
// Остальные — отображаются на карте без латинской подписи.
const PLANETS: Record<AspectKey, string> = {
  Si: 'Terra Harmonia',
  Ti: 'Structura Mentalis',
  Fe: 'Passio Ignis',
  Fi: 'Anima Humanitatis',
  Ne: 'Essence Prime',
  Ni: 'Tempum Spiralis',
  Te: 'Praxis Effectus',
  Se: 'Imperium Magnum',
}

export const JOURNEYS: Record<AspectKey, Journey> = {
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
        surveys: TI_LEVEL_0_SURVEYS,
        complete: TI_LEVEL_0_COMPLETE,
        scripts: TI_LEVEL_0_CORE
      },
      1: {
        title: 'Карта и намерение',
        core: TI_LEVEL_1_CORE,
        complete: TI_LEVEL_1_COMPLETE,
        scripts: TI_LEVEL_1_CORE
      },
      2: {
        title: 'Системы мышления',
        core: TI_LEVEL_2_CORE,
        complete: TI_LEVEL_2_COMPLETE,
        scripts: TI_LEVEL_2_CORE
      },
      3: {
        title: 'Тень и трансмутация',
        core: TI_LEVEL_3_CORE,
        complete: TI_LEVEL_3_COMPLETE,
        scripts: TI_LEVEL_3_CORE
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
  },
  Fi: {
    available: true,
    planet: PLANETS.Fi,
    intro: FI_ASPECT_INTRO,
    levels: {
      0: {
        title: 'Первый контакт',
        core: FI_LEVEL_0_CORE,
        complete: FI_LEVEL_0_COMPLETE,
        scripts: FI_LEVEL_0_CORE
      },
      1: {
        title: 'Карта и намерение',
        core: FI_LEVEL_1_CORE,
        complete: FI_LEVEL_1_COMPLETE,
        scripts: FI_LEVEL_1_CORE
      },
      2: {
        title: 'Системы связей',
        core: FI_LEVEL_2_CORE,
        complete: FI_LEVEL_2_COMPLETE,
        scripts: FI_LEVEL_2_CORE
      },
      3: {
        title: 'Тень и трансмутация',
        core: FI_LEVEL_3_CORE,
        complete: FI_LEVEL_3_COMPLETE,
        scripts: FI_LEVEL_3_CORE
      }
    }
  },
  Te: {
    available: true,
    planet: PLANETS.Te,
    intro: TE_ASPECT_INTRO,
    levels: {
      0: {
        title: 'Первый контакт',
        core: TE_LEVEL_0_CORE,
        surveys: TE_LEVEL_0_SURVEYS,
        complete: TE_LEVEL_0_COMPLETE,
        scripts: TE_LEVEL_0_CORE
      },
      1: {
        title: 'Карта и намерение',
        core: TE_LEVEL_1_CORE,
        complete: TE_LEVEL_1_COMPLETE,
        scripts: TE_LEVEL_1_CORE
      },
      2: {
        title: 'Эпоха цивилизаций',
        core: TE_LEVEL_2_CORE,
        complete: TE_LEVEL_2_COMPLETE,
        scripts: TE_LEVEL_2_CORE
      },
      3: {
        title: 'Эпоха алхимии',
        core: TE_LEVEL_3_CORE,
        complete: TE_LEVEL_3_COMPLETE,
        scripts: TE_LEVEL_3_CORE
      }
    }
  },
  Se: {
    available: true,
    planet: PLANETS.Se,
    intro: SE_ASPECT_INTRO,
    levels: {
      0: {
        title: 'Первый контакт',
        core: SE_LEVEL_0_CORE,
        surveys: SE_LEVEL_0_SURVEYS,
        complete: SE_LEVEL_0_COMPLETE,
        scripts: SE_LEVEL_0_CORE
      },
      1: {
        title: 'Карта и намерение',
        core: SE_LEVEL_1_CORE,
        complete: SE_LEVEL_1_COMPLETE,
        scripts: SE_LEVEL_1_CORE
      },
      2: {
        title: 'Эпоха цивилизаций',
        core: SE_LEVEL_2_CORE,
        complete: SE_LEVEL_2_COMPLETE,
        scripts: SE_LEVEL_2_CORE
      },
      3: {
        title: 'Эпоха алхимии',
        core: SE_LEVEL_3_CORE,
        complete: SE_LEVEL_3_COMPLETE,
        scripts: SE_LEVEL_3_CORE
      }
    }
  }
}

// Список карточек для экрана выбора планеты — все 8 аспектов.
// available: false означает «скоро».
export function getAllPlanets(): Planet[] {
  return ASPECT_KEYS.map(key => ({
    aspect: key,
    name: ASPECT_DATA[key].name,
    realm: ASPECT_REALMS[key],
    color: ASPECT_COLORS[key],
    planet: PLANETS[key] ?? null,
    available: !!JOURNEYS[key]?.available
  }))
}

export function getJourney(aspect: AspectKey): Journey | null {
  return JOURNEYS[aspect] ?? null
}
