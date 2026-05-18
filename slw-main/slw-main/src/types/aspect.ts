// Aspect-keys: Latin internally, Cyrillic on backend boundary.
// Order matches data/aspects.js:ASPECT_KEYS — UI sometimes iterates in this order.

export const ASPECT_KEYS = ['Te', 'Ti', 'Fe', 'Fi', 'Se', 'Si', 'Ne', 'Ni'] as const
export type AspectKey = typeof ASPECT_KEYS[number]

export const CYRILLIC_ASPECT_KEYS = ['ЧЛ', 'БЛ', 'ЧЭ', 'БЭ', 'ЧС', 'БС', 'ЧИ', 'БИ'] as const
export type CyrillicAspectKey = typeof CYRILLIC_ASPECT_KEYS[number]

export type AspectScores = Partial<Record<AspectKey, number>>
