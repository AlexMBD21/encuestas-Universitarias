import React from 'react'
import ReactDOM from 'react-dom'
import ProgressBar from './ProgressBar'

type Criterion = {
  id: string
  text: string
  avg: number | null
  count?: number
  texts?: string[]
}

type ProjectSummary = {
  project: {
    id: string
    name: string
    description?: string
    members?: string[] | string
    advisor?: string
  }
  responses: number
  overall: number | null
  criteria: Criterion[]
}

export default function ProjectDetailModal({ ps, onClose }: { ps: ProjectSummary | null, onClose: () => void }) {
  if (!ps) return null

  const toPercent = (v: number | null) => {
    if (v === null || v === undefined) return '—'
    const pct = Math.round(((v - 1) / (5 - 1)) * 100)
    return `${Math.max(0, Math.min(100, pct))}%`
  }

  const toPercentNum = (v: number | null) => {
    if (v === null || v === undefined || Number.isNaN(Number(v))) return 0
    const pct = Math.round(((Number(v) - 1) / (5 - 1)) * 100)
    return Math.max(0, Math.min(100, pct))
  }

  // Color matching the 1–5 scale legend
  const scoreColor = (avg: number | null): string => {
    if (avg === null || avg === undefined) return '#06b6d4'
    const v = Number(avg)
    if (v <= 1.5) return '#ef4444' // Deficiente
    if (v <= 2.5) return '#f97316' // Regular
    if (v <= 3.5) return '#eab308' // Bueno
    if (v <= 4.5) return '#22c55e' // Muy bueno
    return '#06b6d4'               // Excelente
  }

  // normalize members: allow array or comma/semicolon separated string
  const membersArr: string[] = Array.isArray(ps.project.members)
    ? ps.project.members
    : typeof ps.project.members === 'string'
      ? ps.project.members.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean)
      : []
  const advisor = typeof ps.project.advisor === 'string' ? ps.project.advisor.trim() : ''

  const modal = (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-40" onClick={onClose} />
      <div role="dialog" aria-modal="true" className={`relative w-full max-w-3xl mx-4 bg-white dark:bg-slate-900 rounded shadow-lg transform transition-all duration-200 max-h-[85vh] overflow-hidden`}>
        <div className="sticky top-0 z-10 border-b px-5 py-3 flex items-center justify-between text-white" style={{ background: 'var(--color-primary)', boxShadow: 'inset 0 8px 18px rgba(0,0,0,0.28), inset 0 -6px 12px rgba(255,255,255,0.04), 0 6px 24px rgba(15,23,42,0.08)', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit', top: '-1px' }}>
          <div className="text-lg font-semibold truncate mr-4">{ps.project.name}</div>
          <div className="ml-auto">
            <button type="button" onClick={onClose} aria-label="Cerrar" title="Cerrar" className="w-9 h-9 rounded-full bg-white bg-opacity-10 text-white flex items-center justify-center border border-white border-opacity-20 hover:bg-white hover:bg-opacity-20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5" style={{ maxHeight: 'calc(85vh - 56px)', overflowY: 'auto' }}>

          {/* Overall score card */}
          {ps.overall !== null && (
            <div className="mb-5 p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-5">
              <div className="text-center shrink-0">
                <div className="text-3xl font-black text-slate-800">{ps.overall.toFixed(2)}</div>
                <div className="text-xs text-slate-400 mt-0.5">de 5.00</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-slate-500">Promedio general</span>
                  <span className="text-sm font-black text-slate-700">{toPercent(ps.overall)}</span>
                </div>
                <ProgressBar value={toPercentNum(ps.overall)} height={10} showPercent={false} />
                <div className="text-xs text-slate-400 mt-1.5">Promedio de todos los criterios de evaluación. Escala 1&nbsp;(mínimo)&nbsp;→&nbsp;5&nbsp;(máximo).</div>
              </div>
              <div className="text-center shrink-0">
                <div className="text-2xl font-black text-slate-700">{ps.responses}</div>
                <div className="text-xs text-slate-400 mt-0.5">calificaciones</div>
              </div>
            </div>
          )}

          {ps.project.description && (
            <div className="mb-4 text-sm text-slate-700">{ps.project.description}</div>
          )}

          {membersArr && membersArr.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-semibold">Integrantes</div>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
                {membersArr.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </div>
          )}

          {advisor && (
            <div className="mt-3">
              <div className="text-sm font-semibold">Profesor asesor</div>
              <div className="mt-1 text-sm text-slate-700">{advisor}</div>
            </div>
          )}

          <div className="mt-6">
            <div className="text-sm font-semibold mb-3">Evaluación por criterio</div>

            {/* Scale legend */}
            <div className="mb-4 flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
              {[
                { score: 1, label: 'Deficiente', color: '#ef4444', pct: 0 },
                { score: 2, label: 'Regular', color: '#f97316', pct: 25 },
                { score: 3, label: 'Bueno', color: '#eab308', pct: 50 },
                { score: 4, label: 'Muy bueno', color: '#22c55e', pct: 75 },
                { score: 5, label: 'Excelente', color: '#06b6d4', pct: 100 },
              ].map(s => (
                <div key={s.score} className="flex-1 flex flex-col items-center py-2 px-1 gap-0.5" style={{ borderLeft: s.score > 1 ? '1px solid #e2e8f0' : 'none' }}>
                  <span className="text-base font-black" style={{ color: s.color }}>{s.score}</span>
                  <span className="text-[10px] text-slate-500 text-center leading-tight">{s.label}</span>
                  <span className="text-[10px] font-semibold" style={{ color: s.color }}>{s.pct}%</span>
                </div>
              ))}
            </div>

            <div style={{ maxHeight: '40vh', overflowY: 'auto', paddingRight: '8px' }}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {ps.criteria.map(c => {
                  const hasScore = c.avg !== null && c.avg !== undefined
                  const pct = toPercentNum(c.avg)
                  return (
                    <div key={c.id} className={`p-3 rounded-xl border ${hasScore ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200'}`}>
                      <div className="text-sm font-medium text-slate-700 mb-3 leading-snug">{c.text}</div>
                      {hasScore ? (
                        <>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-slate-500">{Number(c.avg).toFixed(2)} / 5</span>
                            <span className="text-sm font-bold" style={{ color: scoreColor(c.avg) }}>{pct}%</span>
                          </div>
                          <ProgressBar value={pct} height={10} showPercent={false} color={scoreColor(c.avg)} />
                          {c.count !== undefined && (
                            <div className="text-xs text-slate-400 mt-1.5">{c.count} respuesta{c.count !== 1 ? 's' : ''}</div>
                          )}
                        </>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Pregunta abierta</span>
                            <span className="text-xs text-slate-400">{c.texts && c.texts.length > 0 ? `${c.texts.length} respuesta${c.texts.length !== 1 ? 's' : ''}` : 'Sin respuestas aún'}</span>
                          </div>
                          {c.texts && c.texts.length > 0 && (
                            <div className="space-y-1.5 mt-2">
                              {c.texts.map((t, ti) => (
                                <div key={ti} className="text-xs text-slate-700 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 leading-relaxed">
                                  {t}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )

  return ReactDOM.createPortal(modal, document.body)
}
