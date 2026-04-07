import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom';
import reportHelpers from '../services/reportHelpers'
import supabaseClient from '../../services/supabaseClient'


export default function Reports(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dataClientNow: any = supabaseClient
  const [surveys, setSurveys] = useState<any[]>([])
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [view, setViewRaw] = useState<'auto'|'simple'|'projects'>((searchParams.get('view') as any) || 'auto')
  const [filterOwner, setFilterOwnerRaw] = useState<string | null>(searchParams.get('owner') || null)

  const setView = (val: 'auto'|'simple'|'projects') => {
    setViewRaw(val)
    setSearchParams(prev => { const p = new URLSearchParams(prev); val && val !== 'auto' ? p.set('view', val) : p.delete('view'); return p }, { replace: true })
  }
  const setFilterOwner = (val: string | null) => {
    setFilterOwnerRaw(val)
    setSearchParams(prev => { const p = new URLSearchParams(prev); val ? p.set('owner', val) : p.delete('owner'); return p }, { replace: true })
  }
  const [availableOwners, setAvailableOwners] = useState<Array<{id:string,label:string}>>([])
  const [usersCache, setUsersCache] = useState<Record<string, any>>({})
  const [ownerEmailMap, setOwnerEmailMap] = useState<Record<string, string>>({})
  const [allSurveysSummary, setAllSurveysSummary] = useState<any[] | null>(null)
  const [titleSearch, setTitleSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const loadIdRef = useRef(0)
  


  useEffect(() => {
    let mounted = true

    const fetchSurveys = async () => {
      try {
        if (mounted) setLoading(true)
        const enabled = !!(dataClientNow && (dataClientNow as any).isEnabled && (dataClientNow as any).isEnabled())
        if (enabled && (dataClientNow as any).getPublishedSurveysOnce) {
          try {
            const pubs = await (dataClientNow as any).getPublishedSurveysOnce()
            if (pubs && pubs.length > 0) {
              if (mounted) setSurveys(Array.isArray(pubs) ? pubs : [])
              return
            }
            if ((dataClientNow as any).getSurveysOnce) {
              try {
                const all = await (dataClientNow as any).getSurveysOnce()
                const pubsFromSurveys = (all || []).filter((x: any) => x && (x.published === true || x.published === 'true'))
                const norms = pubsFromSurveys.map((x: any) => ({ id: x.id, title: x.title || x.name || '', createdAt: x.createdAt || null, ownerId: x.ownerId || null, type: x.type || null }))
                if (norms.length && mounted) { setSurveys(norms); return }
              } catch (e) {}
            }
          } catch (e) {}
        }
        try {
          const local = await (reportHelpers as any).getSurveyList()
          if (mounted) setSurveys(local || [])
        } catch (e) {
          if (mounted) setSurveys([])
        }
      } catch (e) { if (mounted) setSurveys([]) }
      finally { if (mounted) setLoading(false) }
    }

    fetchSurveys()
    const onUpdated = () => fetchSurveys()
    window.addEventListener('surveys:updated', onUpdated as EventListener)
    window.addEventListener('realtime:connected', onUpdated as EventListener)
    return () => {
      mounted = false
      try { window.removeEventListener('surveys:updated', onUpdated as EventListener) } catch (e) {}
      try { window.removeEventListener('realtime:connected', onUpdated as EventListener) } catch (e) {}
    }
  }, [])

  

  // filtrar encuestas mostradas según propietario y tipo
  const filteredSurveys = (surveys || []).filter(s => {
    try {
      if (!s) return false
      if (filterOwner) {
        const ownerId = String(s.ownerId ?? s.owner ?? '')
        if (String(filterOwner) !== ownerId) return false
      }
      if (view === 'simple') return s?.type !== 'project'
      if (view === 'projects') return s?.type === 'project'
      return true
    } catch (e) { return false }
  })

  // compute available owners and survey types from surveys list
  // Load owner uid→email map from server (SECURITY DEFINER, works for all users)
  useEffect(() => {
    let mounted = true
    const loadOwnerEmails = async () => {
      try {
        if (!(dataClientNow && (dataClientNow as any).getPublishedSurveyOwners)) return
        const map = await (dataClientNow as any).getPublishedSurveyOwners()
        if (mounted && map && Object.keys(map).length > 0) setOwnerEmailMap(map)
      } catch (e) {}
    }
    loadOwnerEmails()
    return () => { mounted = false }
  }, [surveys])

  useEffect(() => {
    try {
      const ownersMap = new Map<string,string>()
      ;(surveys || []).forEach(s => {
        try {
          const id = String(s.ownerId ?? s.ownerUid ?? s.owner ?? '')
          if (id) ownersMap.set(id, id)
        } catch (e) {}
      })
      const owners = Array.from(ownersMap.keys()).map(k => {
        // Priority: server-resolved map > usersCache > ownerEmail on survey row > raw UUID
        const emailFromServer = ownerEmailMap[String(k)] || null
        const u = usersCache && (usersCache[String(k)]) ? usersCache[String(k)] : null
        const emailFromSurvey = (() => { try { const sv = (surveys || []).find((s: any) => String(s.ownerId ?? s.ownerUid ?? s.owner ?? '') === k); return sv ? (sv.ownerEmail || sv.owner_email || null) : null } catch (e) { return null } })()
        const label = emailFromServer
          || (u ? (u.email || u.emailAddress || u.name || u.displayName || null) : null)
          || emailFromSurvey
          || String(k)
        return { id: String(k), label }
      })
      setAvailableOwners(owners)
    } catch (e) { setAvailableOwners([]) }
    // (we only compute owners here; categories are controlled by `view`)
  }, [surveys, filterOwner, usersCache, ownerEmailMap])

  // load users once to map ids -> emails for owner labels
  useEffect(() => {
    let mounted = true
    const loadUsers = async () => {
      try {
        const idx: Record<string, any> = { ...usersCache }
        // Seed cache with current authenticated user's auth UUID so their own surveys resolve
        try {
          const authUser = (dataClientNow as any).getAuthCurrentUser ? (dataClientNow as any).getAuthCurrentUser() : null
          if (authUser && authUser.id && authUser.email) idx[String(authUser.id)] = authUser
        } catch (e) {}
        // Also load app_users (no RLS, accessible to all)
        try {
          if (dataClientNow && (dataClientNow as any).getUsersOnce) {
            const list = await (dataClientNow as any).getUsersOnce()
            ;(list || []).forEach((u: any) => {
              try {
                if (u && u.id) idx[String(u.id)] = u
                if (u && (u.uid || u.userId)) idx[String(u.uid || u.userId)] = u
                if (u && u.email) idx[String(u.email)] = u
              } catch (e) {}
            })
          }
        } catch (e) {}
        // Resolve any owner UUIDs from surveys not yet in the cache
        // using the resolve_owner_emails DB function (SECURITY DEFINER, works for all users)
        try {
          const ownerUids = Array.from(new Set(
            (surveys || []).flatMap((s: any) => [
              String(s.ownerId ?? ''), String(s.ownerUid ?? s.owner_uid ?? '')
            ]).filter(id => id && id.length > 10 && !idx[id])
          ))
          if (ownerUids.length > 0 && (dataClientNow as any).resolveOwnerEmails) {
            const resolved = await (dataClientNow as any).resolveOwnerEmails(ownerUids)
            Object.entries(resolved).forEach(([uid, email]) => {
              try { if (uid && email) idx[uid] = { id: uid, email } } catch (e) {}
            })
          }
        } catch (e) {}
        if (mounted) setUsersCache(idx)
      } catch (e) {
        try {
          const authUser = (dataClientNow as any).getAuthCurrentUser ? (dataClientNow as any).getAuthCurrentUser() : null
          if (authUser && authUser.id && authUser.email) { if (mounted) setUsersCache(prev => ({ ...prev, [String(authUser.id)]: authUser })) }
        } catch (e2) {}
      }
    }
    loadUsers()
    return () => { mounted = false }
  }, [surveys])

  // Load summary counts for the all-surveys table
  useEffect(() => {
    loadIdRef.current = (loadIdRef.current || 0) + 1
    const myLoadId = loadIdRef.current
    let mounted = true
    setAllSurveysSummary(null)
    let timeoutId: any = null
    const loadAllSummaries = async () => {
      try {
        let timedOut = false
        timeoutId = setTimeout(() => {
          timedOut = true
          try { if (loadIdRef.current === myLoadId) setAllSurveysSummary([]) } catch (e) {}
          try { if (loadIdRef.current === myLoadId) { setToastMessage('Tiempo de espera al cargar resúmenes'); setTimeout(() => setToastMessage(null), 4000) } } catch (e) {}
        }, 8000)
        const sums = await Promise.all((filteredSurveys || []).map(async (s: any) => {
          try {
            const kind = s.type === 'project' ? 'projects' : 'simple'
            let r: any = null
            if (kind === 'simple') r = await (reportHelpers as any).getSimpleSurveyReport(String(s.id))
            else r = await (reportHelpers as any).getProjectSurveyReport(String(s.id))
            // For project surveys, count unique evaluators from rawResponses
            let evaluatorsCount: number | null = null
            if (kind === 'projects' && r && Array.isArray(r.rawResponses)) {
              const uids = new Set(r.rawResponses.map((resp: any) => String(resp.userId || resp.user || resp.reporterId || '')).filter(Boolean))
              evaluatorsCount = uids.size
            }
            return { id: s.id, title: s.title || s.name || s.id, type: s.type || 'simple', totalResponses: r ? (r.totalResponses || 0) : 0, evaluatorsCount }
          } catch (e) {
            return { id: s.id, title: s.title || s.name || s.id, type: s.type || 'simple', totalResponses: 0, evaluatorsCount: null }
          }
        }))
        try { clearTimeout(timeoutId) } catch (e) {}
        if (loadIdRef.current === myLoadId && !timedOut && mounted) setAllSurveysSummary(sums)
      } catch (e) {}
    }
    loadAllSummaries()
    return () => { try { clearTimeout(timeoutId) } catch (e) {}; mounted = false }
  }, [surveys, filterOwner, view])

  return (
    <div id="reports-root" className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header Limpio Minimalista con mayor profundidad */}
      <div className="bg-white border-b border-slate-200 shadow-md">
        <div id="reports-header-inner" className="px-5 sm:px-8 py-8 md:py-12 max-w-7xl mx-auto">
          <div id="reports-header-title-row" className="flex items-center gap-3 mb-2 animate-fade-in-up">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20 text-white shrink-0">
              <span className="material-symbols-outlined text-xl">bar_chart</span>
            </div>
            <h1 className="text-slate-900 dark:text-slate-50 text-2xl md:text-3xl font-black leading-tight tracking-[-0.033em]" style={{ margin: 0 }}>Reportes</h1>
          </div>
          <p className="text-slate-500 text-sm md:text-base max-w-2xl animate-fade-in-up" style={{ animationDelay: '50ms' }}>
            Analiza el rendimiento y los resultados de tus encuestas. Encuentra insights importantes a través de nuestras estadísticas en tiempo real.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-20">
        
        {/* Barra de Filtros Premium (Pill-like) diferenciada del fondo */}
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-lg shadow-slate-300/50 rounded-2xl p-2 md:p-3 flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          
          {/* Buscador */}
          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            </div>
            <input
              type="text"
              value={titleSearch}
              onChange={e => setTitleSearch(e.target.value)}
              placeholder="Buscar reporte por título..."
              className="block w-full pl-11 pr-10 py-3 bg-slate-50/50 border-0 text-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors sm:text-sm shadow-inner"
            />
            {titleSearch && (
              <button type="button" onClick={() => setTitleSearch('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            )}
          </div>

          <div className="h-px md:h-10 w-full md:w-px bg-slate-200/60 hidden md:block" />

          {/* Filtros Dropdown */}
          <div id="reports-filter-chips" className="flex flex-row items-center gap-2 overflow-x-auto md:overflow-x-visible pb-0 hide-scrollbar">
            <div id="reports-filter-type" className="relative shrink-0">
              <select 
                value={view} 
                onChange={e => setView(e.target.value as any)} 
                className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl pl-4 pr-10 py-2.5 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors w-full cursor-pointer"
              >
                <option value="auto">Todos los tipos</option>
                <option value="simple">Simples</option>
                <option value="projects">Proyectos</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>

            {(availableOwners || []).length > 0 && (
              <div id="reports-filter-owner" className="relative shrink-0">
                <select 
                  value={filterOwner ?? ''} 
                  onChange={e => setFilterOwner(e.target.value || null)} 
                  className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-sm font-medium rounded-xl pl-4 pr-10 py-2.5 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors w-full truncate cursor-pointer"
                >
                  <option value="">Cualquier propietario</option>
                  {(availableOwners || []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            )}

            {(titleSearch.trim() || view !== 'auto' || filterOwner) && (
              <button
                type="button"
                onClick={() => { setTitleSearch(''); setView('auto'); setFilterOwner(null) }}
                className="shrink-0 p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100"
                title="Limpiar filtros"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" /><path d="M18 9l-6 6" /><path d="M12 9l6 6" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* Contenido Principal */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 h-[220px] p-5 md:p-6 flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100" />
                <div className="flex items-start justify-between gap-3 mb-4 mt-1">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                  <div className="h-5 bg-slate-100 rounded-full w-16" />
                </div>
                <div className="h-6 bg-slate-100 rounded-lg w-11/12 mb-2" />
                <div className="h-6 bg-slate-100 rounded-lg w-2/3 mb-4" />
                <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-50">
                  <div className="h-4 bg-slate-50 rounded w-24" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && (
          <div className="animate-fade-in-up" style={{ animationDelay: '150ms' }}>
            
            {/* Cabecera de resultados */}
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                {filterOwner ? `Reportes de ${((availableOwners||[]).find(o=>o.id===filterOwner)||{label:filterOwner}).label}` : 'Tus reportes listos'}
              </h3>
              {allSurveysSummary && allSurveysSummary.length > 0 && (
                <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2.5 py-1 rounded-full border border-blue-200">
                  {(() => { const c = allSurveysSummary.filter(su => !titleSearch.trim() || su.title.toLowerCase().includes(titleSearch.trim().toLowerCase())).length; return `${c} EN TOTAL` })()}
                </span>
              )}
            </div>

            {/* Skeleton Loading State */}
            {allSurveysSummary === null && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-white rounded-2xl border border-slate-200 h-[220px] p-5 md:p-6 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-slate-100" />
                    <div className="flex items-start justify-between gap-3 mb-4 mt-1">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
                      <div className="h-5 bg-slate-100 rounded-full w-16" />
                    </div>
                    <div className="h-6 bg-slate-100 rounded-lg w-11/12 mb-2" />
                    <div className="h-6 bg-slate-100 rounded-lg w-2/3 mb-4" />
                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-slate-50">
                      <div className="h-4 bg-slate-50 rounded w-24" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {allSurveysSummary && allSurveysSummary.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 px-4 bg-white rounded-3xl border border-slate-200 border-dashed">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-10 h-10 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">No hay reportes</h3>
                <p className="text-sm text-slate-500 text-center max-w-sm">No encontramos encuestas con las opciones de filtro actuales.</p>
              </div>
            )}

            {/* Grid de Reportes */}
            {allSurveysSummary && allSurveysSummary.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {(allSurveysSummary || []).filter(su => !titleSearch.trim() || su.title.toLowerCase().includes(titleSearch.trim().toLowerCase())).map((su: any, i: number) => {
                  const isProject = su.type === 'project';
                  return (
                    <div 
                      key={su.id} 
                      className="group bg-white rounded-2xl border border-slate-200 hover:border-blue-300 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 overflow-hidden flex flex-col relative"
                      style={{ animationDelay: `${i * 30 + 150}ms` }}
                    >
                      {/* Acento superior de color idéntico a Surveys.tsx */}
                      <div className={`absolute top-0 left-0 right-0 h-1.5 ${isProject ? 'bg-indigo-600' : 'bg-emerald-600'}`} />
                      
                      <div className="p-5 md:p-6 flex-1 flex flex-col">
                        <div className="flex items-start justify-between gap-3 mb-4 mt-1">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isProject ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'} border ${isProject ? 'border-indigo-100' : 'border-emerald-100'}`}>
                            <span className="material-symbols-outlined text-[20px]">
                              {isProject ? 'groups' : 'checklist'}
                            </span>
                          </div>
                          
                          {/* Badge idéntico a Encuestas */}
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 ${isProject ? 'bg-indigo-50 text-indigo-700 border-indigo-200 border' : 'bg-emerald-50 text-emerald-700 border-emerald-200 border'}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isProject ? 'bg-indigo-600' : 'bg-emerald-600'}`}></span>
                            {isProject ? 'Proyecto' : 'Simple'}
                          </span>
                        </div>
                        
                        <h4 className="text-lg font-bold text-slate-800 leading-snug mb-1 transition-colors line-clamp-2">
                          {su.title}
                        </h4>
                        
                        <div className="mt-auto pt-4 flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <span className="material-symbols-outlined text-base">forum</span>
                            <span className="text-sm font-semibold tabular-nums text-slate-700">{su.totalResponses}</span>
                            <span className="text-xs">respuestas</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-2 bg-slate-50/80 border-t border-slate-100">
                        <button
                          onClick={() => {
                            window.scrollTo(0, 0)
                            navigate('/profesor/encuestas/reports/' + String(su.id))
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl group-hover:bg-black group-hover:text-white group-hover:border-black transition-all shadow-sm active:scale-[0.98]"
                        >
                          Ver informe detallado
                          <span className="material-symbols-outlined text-[18px]">arrow_right_alt</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {toastMessage && (
        <div className="fixed right-4 bottom-4 z-[10000] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-fade-in-up">
          <span className="material-symbols-outlined text-blue-400">info</span>
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.4s ease-out forwards;
          opacity: 0;
        }
        /* Mobile-only: header y filtros de Reportes */
        @media (max-width: 767px) {
          #reports-header-title-row {
            justify-content: flex-start !important;
            align-items: center !important;
          }
          #reports-header-inner {
            text-align: left !important;
          }
          /* Filtros en grid 2 columnas */
          #reports-filter-chips {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            overflow-x: visible !important;
            width: 100% !important;
            padding-bottom: 0 !important;
          }
          #reports-filter-type {
            grid-column: 1 !important;
            min-width: 0 !important;
          }
          #reports-filter-owner {
            grid-column: 2 !important;
            min-width: 0 !important;
          }
          #reports-filter-type select,
          #reports-filter-owner select {
            width: 100% !important;
            min-width: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}
