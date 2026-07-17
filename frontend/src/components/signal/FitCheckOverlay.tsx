import React from 'react'

// Fit-check UI (Fix 4). A gentle Vajra-Night overlay that appears on the Signal
// page when every electrode has been reading out of range for ~5 s — the usual
// cause of empty panels. It has no dismiss button: it clears automatically the
// moment any channel returns to range (driven by `active`).

const FIT_TIPS = [
  'Damp the electrode pads with a little saline or water.',
  'Press TP9 / TP10 firm against the mastoid bone behind each ear.',
  'Press AF7 / AF8 firm to the forehead.',
  'Sweep hair away from under the sensors.',
  'Sit still for about 20 seconds.',
]

// Schematic head with the Athena frontal-4 electrode positions. Not
// photorealistic — matches the topo mini-map used elsewhere in the shell.
function HeadSchematic() {
  const nodes: Array<{ x: number; y: number; label: string }> = [
    { x: 22, y: 60, label: 'TP9' },
    { x: 38, y: 30, label: 'AF7' },
    { x: 62, y: 30, label: 'AF8' },
    { x: 78, y: 60, label: 'TP10' },
  ]
  return (
    <svg viewBox="0 0 100 92" style={{ width: 160, height: 'auto', display: 'block', margin: '0 auto 16px' }} role="img" aria-label="Electrode positions on the head">
      <ellipse cx="50" cy="48" rx="38" ry="40" fill="rgba(255,255,255,0.03)" stroke="var(--stroke-veil)" strokeWidth="1.5" />
      <path d="M50 6 l-6 8 h12 z" fill="var(--stroke-veil)" />
      {nodes.map((n) => (
        <g key={n.label}>
          <circle cx={n.x} cy={n.y} r="6" fill="var(--accent-saffron)" opacity="0.9" />
          <text x={n.x} y={n.y + 2.5} textAnchor="middle" fontSize="5" fontWeight="700" fill="var(--bg-void)">
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

export function FitCheckOverlay({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Adjust headset fit"
      style={{
        position: 'absolute', inset: 0, zIndex: 20,
        background: 'rgba(6,6,12,0.86)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'left' }}>
        <HeadSchematic />
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--ink-primary)', textAlign: 'center', marginTop: 0 }}>
          Adjust headset fit
        </h2>
        <p className="nl-muted" style={{ textAlign: 'center' }}>
          All electrodes are reading outside the acceptable range. Real EEG is 10–100 µV;
          your channels are seeing much more, which usually means the electrodes aren&apos;t
          in skin contact.
        </p>
        <ul className="nl-muted" style={{ lineHeight: 1.7, paddingLeft: 20 }}>
          {FIT_TIPS.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// Subdued Practice-page banner. Doesn't cover the page — just points the user to
// the Signal page for the full fit-check guidance.
export function FitCheckBanner({ active, onGoToSignal }: { active: boolean; onGoToSignal?: () => void }) {
  if (!active) return null
  return (
    <div
      role="alert"
      className="nl-whisper"
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        padding: '10px 14px', borderRadius: 8,
        background: 'rgba(201,126,58,0.12)', border: '1px solid var(--accent-saffron)',
        color: 'var(--ink-primary)',
      }}
    >
      <span>Adjust headset fit — see Signal for details.</span>
      {onGoToSignal && (
        <button type="button" className="nl-btn" style={{ fontSize: 12 }} onClick={onGoToSignal} aria-label="Go to Signal page for fit-check details">
          Open Signal
        </button>
      )}
    </div>
  )
}
