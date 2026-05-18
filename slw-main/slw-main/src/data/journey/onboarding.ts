// Общий онбординг при первом входе в «Путешествие».
// Источник правды — `onboarding.md` (4 авторских шага: ## intro · 1 … 4).
// Полноэкранный IntroTour автоматически не запускается — открывается
// только кнопкой «🎓 Пройти обучение» в дашборде. Контекстные подсказки
// в интерфейсе работают параллельно через <Hint/> компоненты.

import { parseJourneyMd } from './parseScripts'
import onboardingMd from './onboarding.md?raw'

export type OnboardingStep = {
  id: string
  text: string
  button: string
}

const { intro } = parseJourneyMd(onboardingMd)

// Сохраняем имена id (`ob1`…`ob4`) для совместимости со старыми проверками,
// если где-то они ещё используются. По смыслу intro-1 → ob1.
export const ONBOARDING: OnboardingStep[] = intro.map((entry, i) => ({
  id: `ob${i + 1}`,
  text: entry.text,
  button: entry.button
}))
