import React from 'react'
import ProgressBar from './ProgressBar'
import { Modal } from '../../components/ui/Modal'

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
  // rawResponses for this project to extract evaluators
  rawResponses?: Array<{ userId?: string; user?: string; reporterId?: string; submittedAt?: string }>
}

export default function ProjectDetailModal({
  ps,
  onClose,
  usersCache,
}: {
  ps: (ProjectSummary & { _rawResponses?: any[] }) | null
  onClose: () => void
  usersCache?: Record<string, any>
}) {
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

  const membersArr: string[] = Array.isArray(ps.project.members)
    ? ps.project.members
    : typeof ps.project.members === 'string'
      ? ps.project.members.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean)
      : []
  const advisor = typeof ps.project.advisor === 'string' ? ps.project.advisor.trim() : ''

  // ── Build evaluators list from rawResponses on the ps object ──
  const rawForProject: any[] = Array.isArray((ps as any)._rawResponses) ? (ps as any)._rawResponses : []
  const evaluatorMap = new Map<string, { uid: string; label: string; count: number; lastAt?: string }>()
  rawForProject.forEach((r: any) => {
    const uid = String(r.userId || r.user || r.reporterId || r.reporterUid || 'anónimo')
    const existing = evaluatorMap.get(uid)
    const label = (usersCache && usersCache[uid] && (usersCache[uid].email || usersCache[uid].name || usersCache[uid].displayName)) || uid
    const at = r.submittedAt || r.submitted_at || ''
    evaluatorMap.set(uid, {
      uid,
      label,
      count: (existing?.count || 0) + 1,
      lastAt: at || existing?.lastAt,
    })
  })
  const evaluators = Array.from(evaluatorMap.values()).sort((a, b) => b.count - a.count)

  return (
    <Modal
      isOpen={!!ps}
      onClose={onClose}
      maxWidth="max-w-3xl"
      title="Detalle de Resultados"
      fullHeightOnMobile={true}
      scrollableBody={false}
    >
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 sm:px-8 space-y-6 sm:space-y-8 custom-scrollbar bg-slate-50/50 w-full h-full">
        {/* Project Title as primary Heading */}
        <div className="mb-2">
          <h2 className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight leading-tight break-all">
            {ps.project.name}
          </h2>
        </div>

        {/* Overall score card */}
        {ps.overall !== null && (
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-slate-500/10 transition-all flex flex-wrap items-center gap-4 sm:gap-6 shadow-sm font-sans relative overflow-hidden">
            <div className="text-center shrink-0 relative z-10 w-24">
              <div className="text-5xl font-black text-slate-800 tracking-tighter">{ps.overall.toFixed(2)}</div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1.5 flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-[12px]">star</span>
                de 5.00
              </div>
            </div>
            <div className="flex-1 min-w-[200px] relative z-10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
                  Promedio general
                </span>
                <span className="text-sm font-black text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">{toPercent(ps.overall)}</span>
              </div>
              <ProgressBar value={toPercentNum(ps.overall)} height={14} showPercent={false} />
              <div className="text-[10px] text-slate-400 mt-2.5 leading-relaxed font-medium">Promedio de todos los criterios evaluados.</div>
            </div>
            <div className="text-center shrink-0 border-l border-slate-100 pl-4 sm:pl-6 hidden sm:flex flex-col items-center justify-center relative z-10 min-w-[80px]">
              <div className="text-3xl font-black text-slate-800 tabular-nums">{ps.responses}</div>
              <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">votos</div>
            </div>
          </div>
        )}

        {ps.project.description && (
          <div className="text-sm sm:text-base text-slate-700 leading-relaxed bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm relative">
            <span className="absolute top-4 left-4 text-4xl text-slate-100 font-serif leading-none rotate-180">"</span>
            <div className="relative z-10 pl-2">
              {ps.project.description}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {membersArr && membersArr.length > 0 && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition-colors">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">groups</span> Integrantes
              </div>
              <ul className="space-y-2.5">
                {membersArr.map((m, i) => (
                  <li key={i} className="text-sm font-medium text-slate-700 flex items-center gap-2.5 bg-slate-50/50 px-3 py-2 rounded-xl border border-slate-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0"></span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {advisor && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:border-slate-300 transition-colors h-fit">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">school</span> Profesor asesor
              </div>
              <div className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100/50">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center shrink-0 shadow-sm text-white font-bold">
                  {advisor.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">{advisor}</div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Tutor Asignado</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Evaluadores que calificaron este proyecto ── */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">how_to_reg</span>
              </div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight">Profesores que calificaron</h3>
            </div>
            {evaluators.length > 0 && (
              <span className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full">
                {evaluators.length} evaluador{evaluators.length !== 1 ? 'es' : ''}
              </span>
            )}
          </div>

          {evaluators.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-2xl text-slate-300">person_off</span>
              </div>
              <p className="text-sm font-medium text-slate-400">Sin calificaciones aún</p>
              <p className="text-xs text-slate-300 mt-1">Nadie ha evaluado este proyecto todavía.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {evaluators.map((ev, i) => {
                const initials = String(ev.label[0] || '?').toUpperCase()
                const avatarColors = [
                  'bg-indigo-100 text-indigo-700',
                  'bg-violet-100 text-violet-700',
                  'bg-blue-100 text-blue-700',
                  'bg-cyan-100 text-cyan-700',
                  'bg-teal-100 text-teal-700',
                ]
                const colorClass = avatarColors[i % avatarColors.length]
                return (
                  <div key={ev.uid} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-slate-50/80 transition-colors">
                    {/* Avatar */}
                    <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border shadow-sm ${colorClass}`}>
                      {initials}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{ev.label}</div>
                      {ev.lastAt && (
                        <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                          {(() => {
                            try { return new Date(ev.lastAt!).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) }
                            catch { return ev.lastAt }
                          })()}
                        </div>
                      )}
                    </div>
                    {/* Badge */}
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 tabular-nums">
                        <span className="material-symbols-outlined text-[12px]">grade</span>
                        {ev.count} cal.
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2 px-1 mt-2">
            <span className="material-symbols-outlined text-[16px]">analytics</span> Evaluación por criterio
          </div>

          {/* Scale legend */}
          <div className="mb-6 flex items-center rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
            {[
              { score: 1, label: 'Deficiente', color: '#ef4444', pct: 0 },
              { score: 2, label: 'Regular', color: '#f97316', pct: 25 },
              { score: 3, label: 'Bueno', color: '#eab308', pct: 50 },
              { score: 4, label: 'Muy bueno', color: '#22c55e', pct: 75 },
              { score: 5, label: 'Excelente', color: '#06b6d4', pct: 100 },
            ].map(s => (
              <div key={s.score} className="flex-1 flex flex-col items-center py-2 sm:py-3 px-0.5 sm:px-1 gap-1 border-r border-slate-100 last:border-r-0 hover:bg-slate-50 transition-colors justify-start">
                <span className="text-lg sm:text-xl font-black leading-none" style={{ color: s.color }}>{s.score}</span>
                <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase text-center leading-[1.1] tracking-wider sm:tracking-widest break-words w-full px-0.5">{s.label}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
            {ps.criteria.map(c => {
              const hasScore = c.avg !== null && c.avg !== undefined
              const pct = toPercentNum(c.avg)
              return (
                <div key={c.id} className={`p-5 rounded-3xl border transition-all ${hasScore ? 'bg-white border-slate-200/80 hover:border-slate-300 shadow-sm' : 'bg-slate-50 border-slate-200 border-dashed'}`}>
                  <div className="text-sm font-semibold text-slate-800 mb-3.5 leading-snug pr-2 flex items-center justify-between break-words">
                    {c.text}
                    {!hasScore && c.texts && c.texts.length > 0 && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded uppercase tracking-tighter">Abierta</span>
                    )}
                  </div>

                  {hasScore && (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black text-slate-900 leading-none">{Number(c.avg).toFixed(2)}</span>
                          <span className="text-[10px] text-slate-400 font-bold">/ 5</span>
                        </div>
                        <span className="text-[11px] font-black px-2 py-0.5 rounded-md" style={{ color: scoreColor(c.avg), backgroundColor: `${scoreColor(c.avg)}15` }}>{pct}%</span>
                      </div>
                      <ProgressBar value={pct} height={8} showPercent={false} color={scoreColor(c.avg)} />
                      {c.count !== undefined && (
                        <div className="text-[10px] text-slate-400 mt-2 font-medium flex items-center justify-end gap-1">
                          <span className="material-symbols-outlined text-[12px]">how_to_vote</span>
                          {c.count} votos
                        </div>
                      )}
                    </div>
                  )}

                  {c.texts && c.texts.length > 0 && (
                    <div className={`space-y-2 ${hasScore ? 'mt-4 pt-4 border-t border-slate-50' : 'mt-2'}`}>
                      {hasScore && (
                         <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">Observaciones</div>
                      )}
                      {c.texts.slice(0, 5).map((t, ti) => (
                        <div key={ti} className="text-xs text-slate-600 bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50 shadow-sm rounded-xl px-3.5 py-2.5 leading-relaxed relative hover:border-slate-200 transition-colors">
                          <span className="absolute top-2 left-2 text-slate-200 dark:text-slate-800/50 font-serif leading-none">"</span>
                          <span className="relative z-10 pl-2 block">{t}</span>
                        </div>
                      ))}
                      {c.texts.length > 5 && <div className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-widest mt-2 bg-slate-100/50 dark:bg-slate-800/50 py-1 rounded-full">+ {c.texts.length - 5} más</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
