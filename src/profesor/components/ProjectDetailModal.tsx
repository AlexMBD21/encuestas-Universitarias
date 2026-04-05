import React, { useEffect, useState, useRef } from 'react'
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
  const [isVisible, setIsVisible] = useState(false)
  const [pullDownY, setPullDownY] = useState(0)
  const modalRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ y: number; scrollTop: number } | null>(null)

  useEffect(() => {
    if (ps) {
      const timer = setTimeout(() => setIsVisible(true), 10)
      return () => clearTimeout(timer)
    } else {
      setIsVisible(false)
    }
  }, [ps])

  const handleClose = () => {
    setIsVisible(false)
    setTimeout(onClose, 210)
  }

  // Handle pull-to-dismiss gesture
  useEffect(() => {
    const el = modalRef.current
    if (!el) return

    const onTouchStart = (e: TouchEvent) => {
      touchStartRef.current = {
        y: e.touches[0].clientY,
        scrollTop: el.scrollTop
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return
      const deltaY = e.touches[0].clientY - touchStartRef.current.y
      
      // If at the top and pulling down
      if (el.scrollTop <= 0 && deltaY > 0) {
        if (e.cancelable) e.preventDefault()
        setPullDownY(deltaY)
      } else {
        setPullDownY(0)
      }
    }

    const onTouchEnd = () => {
      if (pullDownY > 80) {
        handleClose()
      } else {
        setPullDownY(0)
      }
      touchStartRef.current = null
    }

    el.addEventListener('touchstart', onTouchStart)
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
    }
  }, [pullDownY, isVisible])

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

  const modal = (
    <div className={`fixed inset-0 z-[10000] flex items-end sm:items-center justify-center transition-opacity duration-300 ${isVisible ? 'opacity-100' : 'opacity-0'}`}>
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={handleClose} />
      
      <div 
        role="dialog" 
        aria-modal="true" 
        className={`relative w-full sm:max-w-3xl sm:mx-4 rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 shadow-2xl transition-all duration-300 flex flex-col max-h-[94dvh] sm:max-h-[85vh] overflow-hidden ${isVisible ? 'translate-y-0 sm:scale-100' : 'translate-y-full sm:translate-y-4 sm:scale-95'}`}
        style={{ transform: pullDownY > 0 ? `translateY(${pullDownY}px)` : undefined }}
      >
        {/* Drag handle for mobile (absolute inside modal) */}
        <div className="w-full flex justify-center pt-2 pb-3 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ backgroundColor: 'var(--color-primary)', touchAction: 'none' }} onClick={handleClose}>
          <div className="w-12 h-1.5 rounded-full bg-white/40"></div>
        </div>

        {/* Header (pt-7 mobile to clear the handle, pt-4 desktop) */}
        <div 
          className="sticky top-0 z-10 border-b px-4 sm:px-6 py-4 flex items-center justify-between text-white flex-shrink-0 pt-7 sm:pt-4" 
          style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit', top: '-1px', touchAction: 'none' }}
        >
          <div className="text-lg sm:text-xl font-bold truncate mr-4 tracking-wide">{ps.project.name}</div>
          <div className="ml-auto hidden sm:block">
            <button 
              type="button" 
              onClick={handleClose} 
              aria-label="Cerrar" 
              className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <span className="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div 
          ref={modalRef}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6"
        >
          {/* Overall score card */}
          {ps.overall !== null && (
            <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 flex flex-wrap items-center gap-4 sm:gap-6 shadow-sm font-sans">
              <div className="text-center shrink-0">
                <div className="text-4xl font-black text-slate-800 dark:text-slate-100">{ps.overall.toFixed(2)}</div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">de 5.00</div>
              </div>
              <div className="flex-1 min-w-[180px]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Promedio general</span>
                  <span className="text-sm font-black text-slate-700 dark:text-slate-200">{toPercent(ps.overall)}</span>
                </div>
                <ProgressBar value={toPercentNum(ps.overall)} height={12} showPercent={false} />
                <div className="text-[10px] text-slate-400 mt-2 leading-relaxed italic">Promedio de todos los criterios. Escala 1 (mín) → 5 (máx).</div>
              </div>
              <div className="text-center shrink-0 border-l border-slate-200 dark:border-slate-700 pl-4 sm:pl-6 hidden sm:block">
                <div className="text-2xl font-black text-slate-700 dark:text-slate-300">{ps.responses}</div>
                <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mt-1">votos</div>
              </div>
            </div>
          )}

          {ps.project.description && (
            <div className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed bg-blue-50/30 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100/50 dark:border-blue-900/30">
              {ps.project.description}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {membersArr && membersArr.length > 0 && (
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">groups</span> Integrantes
                </div>
                <ul className="space-y-1.5">
                  {membersArr.map((m, i) => (
                    <li key={i} className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>{m}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {advisor && (
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">school</span> Profesor asesor
                </div>
                <div className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 rounded-lg inline-block">{advisor}</div>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">analytics</span> Evaluación por criterio
            </div>

            {/* Scale legend */}
            <div className="mb-6 flex items-center gap-1 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 overflow-hidden shadow-inner">
              {[
                { score: 1, label: 'Deficiente', color: '#ef4444', pct: 0 },
                { score: 2, label: 'Regular', color: '#f97316', pct: 25 },
                { score: 3, label: 'Bueno', color: '#eab308', pct: 50 },
                { score: 4, label: 'Muy bueno', color: '#22c55e', pct: 75 },
                { score: 5, label: 'Excelente', color: '#06b6d4', pct: 100 },
              ].map(s => (
                <div key={s.score} className="flex-1 flex flex-col items-center py-2.5 px-1 gap-1 border-r border-slate-100 dark:border-slate-800 last:border-r-0">
                  <span className="text-lg font-black leading-none" style={{ color: s.color }}>{s.score}</span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase text-center leading-tight tracking-tighter truncate w-full">{s.label}</span>
                  <span className="text-[10px] font-black" style={{ color: s.color }}>{s.pct}%</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4">
              {ps.criteria.map(c => {
                const hasScore = c.avg !== null && c.avg !== undefined
                const pct = toPercentNum(c.avg)
                return (
                  <div key={c.id} className={`p-3 rounded-xl border ${hasScore ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3 leading-snug">{c.text}</div>
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
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 tracking-wider">Abierta</span>
                          <span className="text-xs text-slate-400">{c.texts && c.texts.length > 0 ? `${c.texts.length} respuesta${c.texts.length !== 1 ? 's' : ''}` : 'Sin datos'}</span>
                        </div>
                        {c.texts && c.texts.length > 0 && (
                          <div className="space-y-2">
                            {c.texts.slice(0, 5).map((t, ti) => (
                              <div key={ti} className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 rounded-lg px-3 py-2 leading-relaxed">
                                {t}
                              </div>
                            ))}
                            {c.texts.length > 5 && <div className="text-[10px] text-slate-400 text-center italic mt-1">+ {c.texts.length - 5} más</div>}
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
  )

  return ReactDOM.createPortal(modal, document.body)
}
