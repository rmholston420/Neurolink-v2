import React from 'react'

interface CardProps {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  style?: React.CSSProperties
  className?: string
}

export function Card({ title, subtitle, actions, children, style, className }: CardProps) {
  return (
    <section className={`nl-card ${className ?? ''}`} style={style}>
      {(title || actions) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: subtitle ? 4 : 12 }}>
          {title ? <h2 className="nl-card-title" style={{ marginBottom: 0 }}>{title}</h2> : <span />}
          {actions}
        </div>
      )}
      {subtitle ? <p className="nl-muted" style={{ marginTop: 0, marginBottom: 14 }}>{subtitle}</p> : null}
      {children}
    </section>
  )
}

export function StatusPill({ tone = 'neutral', children }: { tone?: 'good' | 'warn' | 'bad' | 'neutral'; children: React.ReactNode }) {
  const dot = tone === 'neutral' ? '' : tone
  return (
    <span className="nl-pill">
      <span className={`nl-dot ${dot}`} />
      {children}
    </span>
  )
}
