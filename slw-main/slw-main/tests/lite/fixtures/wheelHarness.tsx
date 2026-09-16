import React from 'react'
import { createRoot } from 'react-dom/client'
import { LiteHome } from '../../../src/lite/LiteHome'
import { useLiteSession } from '../../../src/lite/useLiteSession'
const keys = ['Si', 'Fe', 'Fi', 'Te', 'Ti', 'Se', 'Ne', 'Ni']
function Harness() {
  const session = useLiteSession()
  return <><button id="update" onClick={() => session.updateScores(Object.fromEntries(keys.map((key, i) => [key, Number(document.querySelector<HTMLInputElement>('#scores')!.value.split(',')[i])])))}>Update</button><input id="scores" defaultValue="9,5,5,5,5,5,5,5" /><LiteHome journey={session.data.journey} scores={session.data.scores} diaryCount={session.data.diary.length} onNavigate={() => {}} onUnavailable={() => {}} /></>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><Harness /></React.StrictMode>)
