// Ambient types for Telegram Mini App `window.Telegram.WebApp` SDK.
// Only the surface actually used by src/tma/index.ts and src/tma/hooks.ts.
// Optional fields reflect runtime guards (e.g. tma.HapticFeedback?.…).

export type TelegramHapticImpact = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
export type TelegramHapticNotify = 'success' | 'error' | 'warning'

export type TelegramThemeParams = {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
}

export type TelegramBackButton = {
  show(): void
  hide(): void
  onClick(cb: () => void): void
  offClick(cb: () => void): void
}

export type TelegramHapticFeedback = {
  impactOccurred?: (kind: TelegramHapticImpact) => void
  notificationOccurred?: (kind: TelegramHapticNotify) => void
}

export type TelegramInitDataUnsafe = {
  start_param?: string
  // additional fields are present at runtime; not modelled here
}

export type TelegramWebApp = {
  platform: string
  initData: string
  initDataUnsafe?: TelegramInitDataUnsafe
  themeParams?: TelegramThemeParams
  colorScheme?: 'dark' | 'light' | string
  BackButton?: TelegramBackButton
  HapticFeedback?: TelegramHapticFeedback
  ready(): void
  expand(): void
  disableVerticalSwipes?: () => void
  onEvent?: (name: string, cb: () => void) => void
  offEvent?: (name: string, cb: () => void) => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

export {}
