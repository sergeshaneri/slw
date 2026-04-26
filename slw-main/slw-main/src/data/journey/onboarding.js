// Общий онбординг при первом входе в «Путешествие».
// Источник правды — `onboarding.md` (4 шага: ## intro · 1 … 4).
// Здесь только парсим md и сохраняем порядок шагов.

import { parseJourneyMd } from './parseScripts'
import onboardingMd from './onboarding.md?raw'

const { intro } = parseJourneyMd(onboardingMd)

// Сохраняем имена id (`ob1`…`ob4`) для совместимости со старыми проверками,
// если где-то они ещё используются. По смыслу intro-1 → ob1.
export const ONBOARDING = intro.map((entry, i) => ({
  id: `ob${i + 1}`,
  text: entry.text,
  button: entry.button
}))
