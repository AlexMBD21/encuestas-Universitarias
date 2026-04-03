import React from 'react'
import ProgressBar from './ProgressBar'

type ProjectSummary = { project: any; overall: number | null }

type Props = { report: any }

function toPercent(value: number | null | undefined, min = 1, max = 5) {
  if (value === null || value === undefined || isNaN(Number(value))) return 0
  const v = Number(value)
  const pct = Math.round(((v - min) / (max - min)) * 100)
  if (pct < 0) return 0
  if (pct > 100) return 100
  return pct
}

export default function ReportOverviewChart({ report }: Props) {
  if (!report) return null

  const [hovered, setHovered] = React.useState<null | { label: string; cnt: number; pct: number; rect: DOMRect | null }>(null)

  let items: Array<{ label: string; value: number }> = []

  if (report.projectSummaries && report.projectSummaries.length) {
    items = report.projectSummaries.map((ps: ProjectSummary) => ({ label: ps.project.name || '—', value: toPercent(ps.overall) }))
  } else if (report.questionStats && report.questionStats.length) {
    // For simple surveys, render per-question option percentages.
    // We'll not flatten into items; instead render structured per-question blocks below.
    items = []
  }

  // If project summaries exist, render the simple project-overview list
  if (items.length) {
    return (
      <div className="mb-4">
        <div className="space-y-4">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-4" onMouseEnter={(e) => {
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
              setHovered({ label: it.label, cnt: Math.round((it.value/100) * 100), pct: it.value, rect })
            }} onMouseLeave={() => setHovered(null)}>
              <div style={{ width: 220, fontSize: 16, fontWeight: 600, color: '#0f172a' }}>{it.label}</div>
              <div style={{ flex: 1 }}>
                <ProgressBar value={it.value} />
              </div>
            </div>
          ))}
        </div>

        {hovered && hovered.rect && (
          <div style={{ position: 'fixed', left: Math.min(window.innerWidth - 260, (hovered.rect.right || 0) + 12), top: Math.max(8, (hovered.rect.top || 0) - 6), zIndex: 9999 }}>
            <div style={{ background: '#0f172a', color: '#fff', padding: '8px 10px', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', minWidth: 180 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{hovered.label}</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{hovered.cnt} respuestas — {hovered.pct}%</div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Otherwise, if we have questionStats, render each question with option bars
  if (report.questionStats && report.questionStats.length) {
    return (
      <div className="mb-4 space-y-6">
        {report.questionStats.map((q: any, qi: number) => {
          const total = q.answered || 0
          // use provided options order when available
          const opts: string[] = Array.isArray(q.options) && q.options.length ? q.options : Object.keys(q.counts || {})
          return (
            <div key={qi}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{q.question || `Pregunta ${qi + 1}`}</div>
              <div className="space-y-3">
                {opts.map((opt: string, oi: number) => {
                  const cnt = Number((q.counts && (q.counts[opt] ?? 0)) || 0)
                  const pct = total ? Math.round((cnt / total) * 100) : 0
                  return (
                    <div key={oi} className="flex items-center gap-4" onMouseEnter={(e) => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setHovered({ label: opt, cnt, pct, rect })
                    }} onMouseLeave={() => setHovered(null)}>
                      <div style={{ width: 200, fontSize: 14, color: cnt === 0 ? '#9CA3AF' : '#0f172a' }}>{opt}</div>
                      <div style={{ flex: 1 }}>
                        <ProgressBar value={pct} showPercent={false} />
                      </div>
                      <div style={{ width: 56, textAlign: 'right', fontSize: 13, color: '#374151' }}>{pct}%</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {hovered && hovered.rect && (
          <div style={{ position: 'fixed', left: Math.min(window.innerWidth - 260, (hovered.rect.right || 0) + 12), top: Math.max(8, (hovered.rect.top || 0) - 6), zIndex: 9999 }}>
            <div style={{ background: '#0f172a', color: '#fff', padding: '8px 10px', borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', minWidth: 180 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{hovered.label}</div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>{hovered.cnt} respuestas — {hovered.pct}%</div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return null
}
