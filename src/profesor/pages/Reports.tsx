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
            return { id: s.id, title: s.title || s.name || s.id, type: s.type || 'simple', totalResponses: r ? (r.totalResponses || 0) : 0 }
          } catch (e) {
            return { id: s.id, title: s.title || s.name || s.id, type: s.type || 'simple', totalResponses: 0 }
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
    <div id="reports-root" className="p-6">

      {/* Filtros */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <div className="flex flex-wrap items-center gap-2 action-buttons">
          <select value={filterOwner ?? ''} onChange={e => setFilterOwner(e.target.value || null)} className="p-2 border rounded w-full sm:w-64">
            <option value="">Todos los propietarios</option>
            {(availableOwners || []).map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>

          <select value={view} onChange={e => setView(e.target.value as any)} className="p-2 border rounded flex-1 sm:flex-none">
            <option value="auto">Todos los tipos</option>
            <option value="simple">Solo encuestas simples</option>
            <option value="projects">Solo proyectos</option>
          </select>

          <button onClick={() => { setFilterOwner(null); setView('auto') }} className="px-3 py-2 rounded w-full sm:w-auto text-sm font-medium transition-colors duration-150" style={{ background: '#f0f7ff', color: 'var(--color-primary)', border: '1px solid #bfdbfe' }} onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#dbeafe' }} onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#f0f7ff' }}>Limpiar filtros</button>
        </div>
      </div>
      {!loading && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-800">Todas las encuestas</h3>
              <p className="text-xs text-slate-400 mt-0.5">{filterOwner ? `Propietario: ${((availableOwners||[]).find(o=>o.id===filterOwner)||{label:filterOwner}).label}` : 'Mostrando encuestas de todos los propietarios'}</p>
            </div>
            {allSurveysSummary && allSurveysSummary.length > 0 && (
              <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-3 py-1 font-medium">{allSurveysSummary.length} encuesta{allSurveysSummary.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {/* Loading state */}
          {allSurveysSummary === null && (
            <div className="flex items-center gap-3 px-5 py-8 text-slate-400">
              <svg className="animate-spin shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#e2e8f0" strokeWidth="3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
              </svg>
              <span className="text-sm">Cargando resumen...</span>
            </div>
          )}

          {/* Empty state */}
          {allSurveysSummary && allSurveysSummary.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-slate-400">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mb-3 opacity-40">
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M3 9h18" stroke="currentColor" strokeWidth="1.5" />
                <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <p className="text-sm font-medium">No hay encuestas para mostrar</p>
            </div>
          )}

          {/* Table — desktop (md+) */}
          {allSurveysSummary && allSurveysSummary.length > 0 && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                      <th className="px-5 py-3 text-left font-semibold">Encuesta</th>
                      <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                      <th className="px-4 py-3 text-left font-semibold">Respuestas</th>
                      <th className="px-4 py-3 text-right font-semibold">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(allSurveysSummary || []).map((su: any) => (
                      <tr key={su.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-800">{su.title}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${su.type === 'project' ? 'bg-indigo-600 text-white' : 'bg-green-600 text-white'}`}>
                            {su.type === 'project' ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                            ) : (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            )}
                            {su.type === 'project' ? 'Proyecto' : 'Simple'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="text-slate-400"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                            {su.totalResponses}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => navigate('/profesor/encuestas/reports/' + String(su.id))}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                          >
                            Ver informe
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cards — mobile (below md) */}
              <div className="md:hidden divide-y divide-slate-100">
                {(allSurveysSummary || []).map((su: any) => (
                  <div key={su.id} className="px-4 py-4 flex flex-col gap-3">
                    {/* Title + type badge */}
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium text-slate-800 text-sm leading-snug flex-1 min-w-0">{su.title}</span>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full ${su.type === 'project' ? 'bg-indigo-600 text-white' : 'bg-green-600 text-white'}`}>
                        {su.type === 'project' ? (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                        {su.type === 'project' ? 'Proyecto' : 'Simple'}
                      </span>
                    </div>
                    {/* Footer: response count + action button */}
                    <div className="flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                        <span className="font-semibold text-slate-700">{su.totalResponses}</span> respuesta{su.totalResponses !== 1 ? 's' : ''}
                      </span>
                      <button
                        onClick={() => navigate('/profesor/encuestas/reports/' + String(su.id))}
                        className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      >
                        Ver informe
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}


      {toastMessage && (
        <div className="fixed right-4 bottom-4 z-[10000] bg-black text-white px-4 py-2 rounded shadow">
          {toastMessage}
        </div>
      )}
    </div>
  )
}
