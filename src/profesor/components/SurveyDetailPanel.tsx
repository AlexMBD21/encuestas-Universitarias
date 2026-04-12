import React, { useState, useRef, useEffect } from 'react'
import ReactDOM from 'react-dom'

type Props = { report: any, usersCache?: Record<string, any> }

const monthNames = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic']

// ── Adaptive time-series helpers ────────────────────────────────────────────

type Granularity = 'hour' | 'day' | 'week' | 'month'

function chooseGranularity(minD: Date, maxD: Date): Granularity {
  const ms = maxD.getTime() - minD.getTime()
  const hours = ms / 3_600_000
  if (hours <= 48) return 'hour'
  const days = ms / 86_400_000
  if (days <= 21) return 'day'
  if (days <= 98) return 'week'
  return 'month'
}

function bucketKey(d: Date, gran: Granularity): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hr = String(d.getHours()).padStart(2, '0')
  if (gran === 'hour') return `${y}-${mo}-${day}T${hr}`
  if (gran === 'day') return `${y}-${mo}-${day}`
  if (gran === 'week') {
    // ISO week: floor to Monday
    const tmp = new Date(d)
    const dow = (tmp.getDay() + 6) % 7 // Mon=0
    tmp.setDate(tmp.getDate() - dow)
    return `${tmp.getFullYear()}-${String(tmp.getMonth()+1).padStart(2,'0')}-${String(tmp.getDate()).padStart(2,'0')}`
  }
  return `${y}-${mo}`
}

function bucketLabel(key: string, gran: Granularity): string {
  try {
    if (gran === 'hour') {
      const [datePart, hr] = key.split('T')
      const [, mo, day] = datePart.split('-')
      return `${day}/${mo} ${hr}h`
    }
    if (gran === 'day') {
      const [, mo, day] = key.split('-')
      return `${day}/${mo}`
    }
    if (gran === 'week') {
      const [, mo, day] = key.split('-')
      return `${day}/${mo}`
    }
    // month
    const [, mo] = key.split('-')
    return monthNames[Number(mo) - 1] ?? mo
  } catch { return key }
}

function buildBuckets(minD: Date, maxD: Date, gran: Granularity): string[] {
  const keys: string[] = []
  const cur = new Date(minD)
  // floor cur to bucket start
  if (gran === 'hour') { cur.setMinutes(0, 0, 0) }
  else if (gran === 'day') { cur.setHours(0, 0, 0, 0) }
  else if (gran === 'week') { const dow = (cur.getDay() + 6) % 7; cur.setDate(cur.getDate() - dow); cur.setHours(0,0,0,0) }
  else { cur.setDate(1); cur.setHours(0, 0, 0, 0) }

  const limit = new Date(maxD)
  while (cur <= limit) {
    keys.push(bucketKey(cur, gran))
    if (gran === 'hour') cur.setHours(cur.getHours() + 1)
    else if (gran === 'day') cur.setDate(cur.getDate() + 1)
    else if (gran === 'week') cur.setDate(cur.getDate() + 7)
    else cur.setMonth(cur.getMonth() + 1)
  }
  return keys
}

// ── SVG path helpers ────────────────────────────────────────────────────────

/** Builds a smooth cubic-bezier path through an array of {x,y} points. */
function smoothCurvePath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const cpx = (curr.x - prev.x) * 0.45
    d += ` C ${prev.x + cpx},${prev.y} ${curr.x - cpx},${curr.y} ${curr.x},${curr.y}`
  }
  return d
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SurveyDetailPanel({ report, usersCache }: Props) {
  if (!report) return null

  const isProjectSurvey = Array.isArray(report.rawResponses)

  // Build project id→name map for project surveys first to use as filter
  const projectMap: Record<string, string> = {}
  if (isProjectSurvey && Array.isArray(report.projectSummaries)) {
    report.projectSummaries.forEach((ps: any) => {
      if (ps.project?.id) projectMap[String(ps.project.id)] = ps.project.name || ps.project.id
    })
  }
  const totalProjects = Object.keys(projectMap).length

  // For project surveys, rawResponses holds the individual responses.
  // We filter out responses for projects that no longer exist in the survey.
  const allRows = Array.isArray(report.rawResponses) ? report.rawResponses : (Array.isArray(report.rows) ? report.rows : [])
  const rows = isProjectSurvey 
    ? allRows.filter((r: any) => r && r.projectId && projectMap[String(r.projectId)])
    : allRows

  // Parse submission dates
  const dated: Date[] = []
  rows.forEach((r: any) => {
    try {
      const s = r && (r.submittedAt || r.submitted_at || r.submitted)
      if (!s) return
      const d = new Date(s)
      if (!isNaN(d.getTime())) dated.push(d)
    } catch (e) {}
  })

  const totalResponses = rows.length
  const hasData = dated.length > 0

  // Determine range and granularity
  const minDate = hasData ? new Date(Math.min(...dated.map(d => d.getTime()))) : null
  const maxDate = hasData ? new Date(Math.max(...dated.map(d => d.getTime()))) : null
  const gran: Granularity = (minDate && maxDate) ? chooseGranularity(minDate, maxDate) : 'day'

  // Build cumulative series
  let bucketKeys: string[] = []
  let cumulativePoints: { key: string; label: string; cumulative: number }[] = []

  if (minDate && maxDate) {
    bucketKeys = buildBuckets(minDate, maxDate, gran)
    const byCounts = new Map<string, number>()
    dated.forEach(d => {
      const k = bucketKey(d, gran)
      byCounts.set(k, (byCounts.get(k) || 0) + 1)
    })
    let running = 0
    cumulativePoints = bucketKeys.map(k => {
      running += byCounts.get(k) || 0
      return { key: k, label: bucketLabel(k, gran), cumulative: running }
    })
  }

  const granLabel: Record<Granularity, string> = {
    hour: 'por hora',
    day: 'por día',
    week: 'por semana',
    month: 'por mes',
  }

  // SVG chart
  const width = 760
  const height = 180
  const leftPad = 44
  const rightPad = 24
  const topPad = 16
  const bottomPad = 28
  const innerW = width - leftPad - rightPad
  const innerH = height - topPad - bottomPad
  const maxVal = totalResponses || 1
  const baselineY = topPad + innerH  // y coordinate of the 0 line

  // Map each cumulative point to SVG coords (distribute evenly when ≥2 points)
  const rawPoints = cumulativePoints.map((p, i) => {
    const spread = cumulativePoints.length <= 1 ? 0.5 : i / (cumulativePoints.length - 1)
    const x = leftPad + innerW * spread
    const y = topPad + (innerH - innerH * (p.cumulative / maxVal))
    return { ...p, x, y }
  })

  // Always prepend a synthetic origin so there is a visible baseline-to-value rise
  const originX = leftPad
  const svgPoints = [
    { x: originX, y: baselineY, cumulative: 0, label: '', key: '__origin__', isSynthetic: true },
    ...rawPoints,
  ]

  // Smooth bezier line and closed area paths
  const lineD = smoothCurvePath(svgPoints)
  const areaD = lineD
    ? `${lineD} L ${svgPoints[svgPoints.length - 1].x} ${baselineY} L ${originX} ${baselineY} Z`
    : ''

  // Y-axis ticks: 0 → maxVal, max 5 ticks
  const yTickCount = Math.min(maxVal, 5)
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => Math.round((maxVal / yTickCount) * i))

  // X-axis: show up to 8 labels evenly spaced (skip synthetic origin)
  const maxLabels = 8
  const labelStep = Math.max(1, Math.ceil(rawPoints.length / maxLabels))

  // Per-user activity
  const userCounts: Record<string, number> = {}
  // For project surveys: also track which projects each user rated
  const userProjects: Record<string, Set<string>> = {}
  rows.forEach((r: any) => {
    const uid = String(r.userId || r.user || r.reporterId || 'anónimo')
    userCounts[uid] = (userCounts[uid] || 0) + 1
    if (isProjectSurvey && r.projectId) {
      if (!userProjects[uid]) userProjects[uid] = new Set()
      userProjects[uid].add(String(r.projectId))
    }
  })
  const userList = Object.keys(userCounts)
    .map(k => ({
      id: k,
      count: userCounts[k],
      label: (usersCache && usersCache[k] && (usersCache[k].email || usersCache[k].name || usersCache[k].displayName)) || k,
      ratedProjects: userProjects[k] ? Array.from(userProjects[k]) : [],
    }))
    .sort((a, b) => b.count - a.count)

  const [userSearch, setUserSearch] = useState('')
  const [userSelected, setUserSelected] = useState('')

  // Search filters by text; dropdown pins to one user. Combined: both must match.
  const filteredUserList = userList.filter(u => {
    const matchesSearch = !userSearch.trim() || u.label.toLowerCase().includes(userSearch.toLowerCase())
    const matchesSelect = !userSelected || u.id === userSelected
    return matchesSearch && matchesSelect
  })

  function clearFilters() {
    setUserSearch('')
    setUserSelected('')
  }

  return (
    <div className="space-y-6">
      {/* ── Cumulative responses chart ── */}
      <div className="rounded-3xl overflow-hidden bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-blue-500">monitoring</span>
              Respuestas acumuladas
            </h3>
            <span className="text-xs font-semibold text-slate-400 mt-0.5 block ml-6">{granLabel[gran]}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-3xl font-black text-slate-900 tabular-nums leading-none tracking-tight">{totalResponses}</span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Total</span>
          </div>
        </div>

        {!hasData && (
          <div className="text-slate-400 text-sm italic py-10 text-center px-5 bg-slate-50/50">Sin respuestas registradas aún.</div>
        )}

        {hasData && (
          <div style={{ width: '100%', overflow: 'hidden' }} className="bg-slate-50/30">
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }} preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="gArea2" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={isProjectSurvey ? '#4f46e5' : '#06b6d4'} stopOpacity="0.30" />
                  <stop offset="80%" stopColor={isProjectSurvey ? '#4f46e5' : '#06b6d4'} stopOpacity="0.02" />
                  <stop offset="100%" stopColor={isProjectSurvey ? '#4f46e5' : '#06b6d4'} stopOpacity="0" />
                </linearGradient>
                <linearGradient id="gLine2" x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0%" stopColor={isProjectSurvey ? '#6366f1' : '#10b981'} />
                  <stop offset="100%" stopColor={isProjectSurvey ? '#4338ca' : '#0891b2'} />
                </linearGradient>
                <filter id="lineShadow" x="-10%" y="-40%" width="120%" height="200%">
                  <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor={isProjectSurvey ? '#4f46e5' : '#06b6d4'} floodOpacity="0.25" />
                </filter>
                <filter id="dotGlow" x="-80%" y="-80%" width="260%" height="260%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={isProjectSurvey ? '#4f46e5' : '#06b6d4'} floodOpacity="0.5" />
                </filter>
              </defs>

              {yTicks.map((t, i) => {
                const yy = topPad + (innerH - innerH * (t / maxVal))
                const isBaseline = t === 0
                return (
                  <g key={i}>
                    <line
                      x1={leftPad} x2={width - rightPad} y1={yy} y2={yy}
                      stroke={isBaseline ? '#cbd5e1' : '#f1f5f9'}
                      strokeWidth={isBaseline ? 2 : 1}
                      strokeDasharray={isBaseline ? undefined : '4 4'}
                    />
                    <text x={leftPad - 8} y={yy + 4} fontSize={10} fontWeight={600} fill="#94a3b8" textAnchor="end">{t}</text>
                  </g>
                )
              })}

              {areaD && <path d={areaD} fill="url(#gArea2)" stroke="none" />}

              {lineD && (
                <path
                  d={lineD}
                  fill="none"
                  stroke="url(#gLine2)"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#lineShadow)"
                />
              )}

              {rawPoints.map((p, i) => (
                <g key={i} filter="url(#dotGlow)">
                  <circle cx={p.x} cy={p.y} r={7} fill={isProjectSurvey ? '#4f46e5' : '#0891b2'} opacity="0.12" />
                  <circle cx={p.x} cy={p.y} r={4.5} fill="#fff" stroke={isProjectSurvey ? '#4f46e5' : '#0891b2'} strokeWidth={2.5} />
                  <title>{p.label}: {p.cumulative} respuesta{p.cumulative !== 1 ? 's' : ''}</title>
                </g>
              ))}

              {rawPoints.filter((_, i) => i % labelStep === 0 || i === rawPoints.length - 1).map((p, i) => (
                <text key={i} x={p.x} y={height - 6} fontSize={10} fontWeight={600} fill="#94a3b8" textAnchor="middle">{p.label}</text>
              ))}
            </svg>
          </div>
        )}
      </div>

      {/* ── Per-user activity ── */}
      <div className="rounded-3xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex flex-col gap-4 px-6 pt-5 pb-5 border-b border-slate-100 rounded-t-3xl bg-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="material-symbols-outlined text-[22px] text-indigo-500 shrink-0">group</span>
              <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white truncate">Actividad por usuario</h2>
            </div>
            {(userSearch || userSelected) && (
              <button 
                onClick={clearFilters} 
                className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-xl hover:bg-indigo-100 transition-all shrink-0"
              >
                × Limpiar
              </button>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <select
                value={userSelected}
                onChange={e => { setUserSelected(e.target.value); setUserSearch('') }}
                className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50/30 px-3 py-2.5 pr-8 appearance-none focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 transition-all cursor-pointer truncate"
              >
                <option value="">Todos los usuarios</option>
                {userList.map(u => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
            
            <div className="relative flex-[1.5]">
              <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2.5" />
                <path d="M16.5 16.5L21 21" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
              <input
                type="text"
                placeholder="Buscar usuario..."
                value={userSearch}
                onChange={e => { setUserSearch(e.target.value); setUserSelected('') }}
                className="w-full pl-10 pr-10 py-2.5 text-xs font-semibold rounded-xl shadow-sm border border-slate-200 bg-white focus:outline-none focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 transition-all"
              />
              {userSearch && (
                <button onClick={() => setUserSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto] px-6 py-3 bg-white border-b border-slate-100">
          <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Usuario</span>
          <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase text-right">{isProjectSurvey ? 'Calificaciones' : 'Respuestas'}</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-slate-50 pb-2">
          {filteredUserList.length === 0 ? (
            <div className="px-6 py-10 text-xs font-medium text-slate-400 text-center flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-3xl opacity-50">search_off</span>
              Sin resultados para "{userSearch}"
            </div>
          ) : filteredUserList.map(u => (
            <UserActivityRow
              key={u.id}
              u={u}
              isProjectSurvey={isProjectSurvey}
              totalProjects={totalProjects}
              projectMap={projectMap}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function UserActivityRow({ u, isProjectSurvey, totalProjects, projectMap }: {
  u: { id: string; count: number; label: string; ratedProjects: string[] }
  isProjectSurvey: boolean
  totalProjects: number
  projectMap: Record<string, string>
}) {
  const [open, setOpen] = useState(false)
  const popRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const ratedCount = u.ratedProjects.length
  const missingCount = totalProjects - ratedCount
  const allRated = isProjectSurvey && totalProjects > 0 && missingCount === 0
  const ratedSet = new Set(u.ratedProjects)
  const missingProjects = Object.keys(projectMap).filter(id => !ratedSet.has(id))

  // Avatar / Badge color themes
  const avatarClass = isProjectSurvey 
    ? 'bg-indigo-50 text-indigo-700 border-indigo-200/60' 
    : 'bg-emerald-50 text-emerald-700 border-emerald-200/60'

  const scoreBadgeClass = allRated
    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
    : 'bg-amber-50 text-amber-600 border border-amber-200'

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (
        btnRef.current && !btnRef.current.contains(e.target as Node) &&
        popRef.current && !popRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div className="flex items-center gap-3 px-6 py-3.5 hover:bg-slate-50/80 transition-colors group">
      {/* Avatar */}
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border shadow-sm ${avatarClass}`}>
        {String((u.label || u.id)[0] || '?').toUpperCase()}
      </div>

      {/* Label */}
      <div className="flex-1 min-w-0 flex flex-col">
        <span className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-600 transition-colors">{u.label}</span>
      </div>

      {/* Right: score or count */}
      {isProjectSurvey ? (
        <div className="flex items-center gap-2.5 shrink-0">
          {totalProjects > 0 && (
            <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full tabular-nums shadow-sm ${scoreBadgeClass}`}>
              {ratedCount}&nbsp;/&nbsp;{totalProjects}
            </span>
          )}
          <div className="relative">
            <button
              ref={btnRef}
              onClick={() => setOpen(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                open ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700 shadow-sm'
              }`}
            >
              Ver
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className={`transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
                <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {open && (
              <div
                ref={popRef}
                className="absolute bottom-full right-0 mb-3 z-50 w-64 max-w-[calc(100vw-2rem)] bg-white border border-slate-200/80 rounded-2xl shadow-xl p-4 space-y-2 origin-bottom-right animate-fade-in-up"
              >
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 border-b border-slate-100 pb-2">Proyectos calificados</div>
                <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                  {u.ratedProjects.length === 0 && <span className="text-xs text-slate-400 italic">Ninguno</span>}
                  {u.ratedProjects.map(pid => (
                    <div key={pid} className="flex items-center gap-2.5 text-xs text-slate-700">
                      <span className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                          <path d="M5 13l4 4L19 7" stroke="#4f46e5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="truncate font-medium">{projectMap[pid] || pid}</span>
                    </div>
                  ))}
                  {missingProjects.length > 0 && (
                    <div className="pt-2 mt-2 border-t border-slate-100">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Pendientes</div>
                      {missingProjects.map(pid => (
                        <div key={pid} className="flex items-center gap-2.5 text-xs text-slate-700 mt-1.5">
                          <span className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="3" fill="#cbd5e1"/>
                            </svg>
                          </span>
                          <span className="truncate text-slate-500 line-through decoration-slate-300">{projectMap[pid] || pid}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <span className="text-xs font-black tabular-nums px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm">{u.count} res.</span>
      )}
    </div>
  )
}
