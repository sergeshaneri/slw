export type ContentAccessPolicy = Readonly<{
  fullContentAccess: boolean
}>

export const ONLINE_CONTENT_ACCESS: ContentAccessPolicy = Object.freeze({
  fullContentAccess: false,
})

export const LITE_CONTENT_ACCESS: ContentAccessPolicy = Object.freeze({
  fullContentAccess: true,
})

export function readableLevel(
  policy: ContentAccessPolicy | undefined,
  earnedLevel: number | null | undefined,
): number {
  return policy?.fullContentAccess ? Number.POSITIVE_INFINITY : (earnedLevel ?? 0)
}

export function canReadLevel(
  policy: ContentAccessPolicy | undefined,
  requiredLevel: number,
  earnedLevel: number | null | undefined,
): boolean {
  return requiredLevel <= readableLevel(policy, earnedLevel)
}

export function canReadSkillDetail(
  policy: ContentAccessPolicy | undefined,
  hasContent: boolean,
  unlockedLevel: number,
): boolean {
  return hasContent && (policy?.fullContentAccess === true || unlockedLevel >= 1)
}