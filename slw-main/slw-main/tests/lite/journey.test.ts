import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ScriptButtons from '@/components/JourneyView/ScriptButtons'
import { UiPreferencesContext, useSendKeyMode } from '@/hooks/useSendKeyMode'
import type { Script } from '@/types/script'

const exercise = {
  id: 'U-1',
  type: 'exercise',
} as Script

function SendKeyModeConsumer() {
  const [mode] = useSendKeyMode()
  return createElement('span', null, mode)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Journey shared online defaults', () => {
  it('keeps the online exercise CTA by default and changes it only for explicit local task mode', () => {
    const online = renderToStaticMarkup(createElement(ScriptButtons, { script: exercise, onAction: vi.fn() }))
    const lite = renderToStaticMarkup(createElement(ScriptButtons, { script: exercise, onAction: vi.fn(), localTaskMode: true }))

    expect(online).toContain('Взять в ежедневные практики')
    expect(online).not.toContain('Взять в активные задания')
    expect(lite).toContain('Взять в активные задания')
  })

  it('reads the legacy online preference only when no snapshot provider exists', () => {
    const getItem = vi.fn(() => 'ctrl+enter')
    vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() })

    expect(renderToStaticMarkup(createElement(SendKeyModeConsumer))).toContain('ctrl+enter')
    expect(getItem).toHaveBeenCalledWith('slw_send_key_mode')

    getItem.mockClear()
    const preferences = {
      sendKeyMode: 'enter' as const,
      hintsSeen: {},
      setSendKeyMode: vi.fn(),
      markHintSeen: vi.fn(),
    }
    const provided = createElement(
      UiPreferencesContext.Provider,
      { value: preferences },
      createElement(SendKeyModeConsumer),
    )

    expect(renderToStaticMarkup(provided)).toContain('enter')
    expect(getItem).not.toHaveBeenCalled()
  })
})