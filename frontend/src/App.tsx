import React, { useState } from 'react'
import './theme/tokens.css'
import './theme/typography.css'
import './theme/shell.css'
import { TopNav, type TabKey } from './components/shell/TopNav'
import { DeviceRail } from './components/shell/DeviceRail'
import { CommandBar } from './components/shell/CommandBar'
import { PracticePage } from './pages/PracticePage'
import { SignalPage } from './pages/SignalPage'
import { JournalPage } from './pages/JournalPage'
import { useNeurolinkStore } from './hooks/useNeurolinkStore'
import { CalibrationCeremony } from './components/signal/CalibrationCeremony'

// Meditation-first shell: persistent top nav (Practice/Signal/Journal), a right
// Device rail, and a bottom Command bar frame the active page. A single store
// (useNeurolinkStore) owns the WS + REST wiring shared across pages.
export function App() {
  const [tab, setTab] = useState<TabKey>('practice')
  const [calibrating, setCalibrating] = useState(false)
  const store = useNeurolinkStore()

  return (
    <div className="nl-shell">
      <TopNav active={tab} onChange={setTab} />
      <main className="nl-main" role="main">
        {tab === 'practice' && <PracticePage store={store} />}
        {tab === 'signal' && <SignalPage store={store} />}
        {tab === 'journal' && <JournalPage />}
      </main>
      <DeviceRail store={store} onRecalibrate={() => setCalibrating(true)} />
      <CommandBar store={store} />
      {calibrating && <CalibrationCeremony store={store} onClose={() => setCalibrating(false)} />}
    </div>
  )
}
