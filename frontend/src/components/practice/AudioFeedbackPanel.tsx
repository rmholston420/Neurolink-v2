import React from 'react'
import { Card } from '../ui/Card'
import type { AudioFeedback } from '../../hooks/useAudioFeedback'
import type { Soundscape } from '../../lib/types'

// Controls for the synthesized audio feedback: mute, volume, and soundscape
// selection. Takes an existing useAudioFeedback instance so the page can share
// one audio engine across components (e.g. the timer's chimes).

const SOUNDSCAPES: Array<{ id: Soundscape; label: string; hint: string }> = [
  { id: 'silence', label: 'Silence', hint: 'No sound' },
  { id: 'singing-bowl', label: 'Singing bowl', hint: 'Sustained harmonic drone' },
  { id: 'alpha-binaural', label: 'Alpha binaural', hint: '10 Hz beat' },
  { id: 'theta-binaural', label: 'Theta binaural', hint: '6 Hz beat' },
  { id: 'guided-breath', label: 'Guided breath', hint: 'Swells at the breath cadence' },
]

export function AudioFeedbackPanel({ audio }: { audio: AudioFeedback }) {
  return (
    <Card
      title="Audio feedback"
      subtitle="Synthesized in-browser — no external assets"
      actions={
        <button className="nl-btn" aria-pressed={audio.muted} onClick={audio.toggleMute}>
          {audio.muted ? 'Unmute' : 'Mute'}
        </button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label className="font-mono" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="nl-muted" style={{ width: 60 }}>Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={audio.volume}
            aria-label="volume"
            onChange={(e) => audio.setVolume(Number(e.target.value))}
            style={{ flex: 1 }}
          />
          <span style={{ width: 40, textAlign: 'right' }}>{(audio.volume * 100).toFixed(0)}%</span>
        </label>

        <div role="radiogroup" aria-label="soundscape" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SOUNDSCAPES.map((s) => {
            const active = audio.soundscape === s.id
            return (
              <button
                key={s.id}
                role="radio"
                aria-checked={active}
                onClick={() => audio.setSoundscape(s.id)}
                className="font-mono"
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left',
                  border: `1px solid ${active ? 'var(--accent-gold)' : 'var(--stroke-veil)'}`,
                  background: active ? 'var(--bg-shrine-hi)' : 'transparent',
                  color: active ? 'var(--ink-primary)' : 'var(--ink-muted)',
                }}
              >
                <span>{s.label}</span>
                <span className="nl-whisper" style={{ fontSize: 11 }}>{s.hint}</span>
              </button>
            )
          })}
        </div>

        {!audio.supported && (
          <p className="nl-whisper" style={{ margin: 0 }}>Audio output is unavailable in this browser.</p>
        )}
      </div>
    </Card>
  )
}
