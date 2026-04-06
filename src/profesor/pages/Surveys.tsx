import React, { useEffect, useState, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useLocation } from 'react-router-dom'
import CreateSurvey from './CreateSurvey'
import ViewSurvey from './ViewSurvey'
import RateProject from './RateProject'
import surveyHelpers from '../../services/surveyHelpers'
import AuthAdapter from '../../services/AuthAdapter'
import supabaseClient from '../../services/supabaseClient'
import { useAuth } from '../../services/AuthContext'
import ScrollFloatingButton from '../components/ScrollFloatingButton'

import { useNavigate } from 'react-router-dom';

export default function Surveys(): JSX.Element {
  const location = useLocation()
  const [currentUser, setCurrentUser] = useState<any | null>(() => AuthAdapter.getUser())
  const currentUserId = currentUser ? (currentUser.email || currentUser.id || null) : null
  const { user: authUser, loading: authLoading } = useAuth()
  // Computed once per render so all role checks are consistent
  const isAdmin = !!(authUser && String((authUser as any).role || '').toLowerCase() === 'admin')

  useEffect(() => {
    const onAuth = () => {
      try { setCurrentUser(AuthAdapter.getUser()) } catch (e) {}
    }
    try { window.addEventListener('auth:changed', onAuth as EventListener) } catch (e) {}
    return () => { try { window.removeEventListener('auth:changed', onAuth as EventListener) } catch (e) {} }
  }, [])
  // Determines if the current user owns a survey (or is admin).
  // ownerId stored in DB can be the user's email or their Supabase UUID.
  const isOwnerOf = (sOrOwnerId: any) => {
    try {
      // Admin has full control over all surveys
      if (isAdmin) return true
      const cur = AuthAdapter.getUser() || currentUser
      let ownerIdRaw = sOrOwnerId && typeof sOrOwnerId === 'object' ? sOrOwnerId.ownerId : sOrOwnerId
      if (ownerIdRaw && typeof ownerIdRaw === 'object') {
        ownerIdRaw = ownerIdRaw.ownerId || ownerIdRaw.id || ownerIdRaw.email || ownerIdRaw.userId || null
      }
      if (!ownerIdRaw) return false
      const normalize = (v: any) => (v === null || v === undefined) ? null : String(v).trim().toLowerCase()
      const ownerId = normalize(ownerIdRaw)
      const curCandidates = new Set<string>()
      const add = (v: any) => { const n = normalize(v); if (n) curCandidates.add(n) }
      // Identifiers from AuthAdapter (email + Supabase UUID)
      add(currentUserId)
      if (cur) { add(cur.email); add(cur.id) }
      // Identifiers from AuthContext (may differ during loading transitions)
      if (authUser) { add(authUser.email); add(authUser.id) }
      if (ownerId && Array.from(curCandidates).some(x => x === ownerId)) return true
      // Legacy: surveys created before login had ownerId = 'local'
      if (!currentUser && !authUser && ownerId === 'local') return true
      return false
    } catch (e) {
      return false
    }
  }
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editSurvey, setEditSurvey] = useState<any | null>(null)
  const [createInitialType, setCreateInitialType] = useState<'simple'|'project'|undefined>(undefined)
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleting, setConfirmDeleting] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState<null | { id: string, action: 'publish'|'unpublish' }>(null)
  const [confirmPublishing, setConfirmPublishing] = useState(false)
  const [confirmReportId, setConfirmReportId] = useState<string | null>(null)
  const [reportComment, setReportComment] = useState<string>('')
  const [confirmReporting, setConfirmReporting] = useState(false)
  const [surveyReports, setSurveyReports] = useState<any[]>([])
  const [reportsLoaded, setReportsLoaded] = useState(false)
  const [viewReportsFor, setViewReportsFor] = useState<string | null>(null)
  const [isReportsVisible, setIsReportsVisible] = useState(false)
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null)
  
  useEffect(() => {
    if (viewReportsFor) setTimeout(() => setIsReportsVisible(true), 50)
    else setIsReportsVisible(false)
  }, [viewReportsFor])
  
  const closeReportsModal = () => {
    setIsReportsVisible(false)
    setTimeout(() => {
      setViewReportsFor(null)
      setHighlightedReportId(null)
    }, 300)
  }

  const [isCreateVisible, setIsCreateVisible] = useState(false)

  useEffect(() => {
    if (createModalOpen) setTimeout(() => setIsCreateVisible(true), 50)
    else setIsCreateVisible(false)
  }, [createModalOpen])

  const closeCreateModal = () => {
    setIsCreateVisible(false)
    setTimeout(() => setCreateModalOpen(false), 300)
  }

  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [publishedFilter, setPublishedFilter] = useState<'all'|'published'|'unpublished'|'reported'>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [titleSearch, setTitleSearch] = useState<string>('')
  const [ownerEmailMap, setOwnerEmailMap] = useState<Record<string, string>>({})

  // close menu when clicking outside
  React.useEffect(() => {
    if (!menuOpenFor) return
    const onDocClick = () => setMenuOpenFor(null)
    window.addEventListener('click', onDocClick)
    return () => window.removeEventListener('click', onDocClick)
  }, [menuOpenFor])
  const handleCreate = () => {
    if ((window as any).showCreateSurvey) {
      (window as any).showCreateSurvey()
      return
    }
    // open as modal
    setEditSurvey(null)
    setCreateInitialType(undefined)
    setCreateModalOpen(true)
  }

  

  

  const handleBack = () => {
    if ((window as any).showDashboard) {
      (window as any).showDashboard()
      return
    }
    try { history.pushState(null, '', '/profesor') } catch (e) { window.location.href = '/profesor' }
  }
  const [surveys, setSurveys] = useState<any[]>([])
  const [surveysLoaded, setSurveysLoaded] = useState(false)

  // Resolve UUID → email for all survey owners
  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const client: any = supabaseClient
        if (!client || !client.isEnabled || !client.isEnabled()) return
        if (client.getPublishedSurveyOwners) {
          const map = await client.getPublishedSurveyOwners()
          if (mounted && map && Object.keys(map).length > 0) setOwnerEmailMap(map)
        } else if (client.resolveOwnerEmails) {
          const uids = Array.from(new Set(
            surveys.map((s: any) => String(s.ownerUid || s.ownerId || '')).filter((v: string) => v && !v.includes('@'))
          ))
          if (uids.length > 0) {
            const map = await client.resolveOwnerEmails(uids)
            if (mounted && map) setOwnerEmailMap(map)
          }
        }
      } catch (e) {}
    }
    load()
    return () => { mounted = false }
  }, [surveys])

  // Returns the best human-readable owner label for a survey
  const getOwnerDisplay = (s: any): string => {
    try {
      if (s.ownerEmail && String(s.ownerEmail).includes('@')) return String(s.ownerEmail)
      if (s.owner_email && String(s.owner_email).includes('@')) return String(s.owner_email)
      const uid = String(s.ownerUid || s.ownerId || '').trim()
      if (ownerEmailMap[uid]) return ownerEmailMap[uid]
      if (uid.includes('@')) return uid
      return uid
    } catch (e) { return '' }
  }
  const [showOnlyPending, setShowOnlyPending] = useState(false)
  const [modalSurveyId, setModalSurveyId] = useState<string | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)
  const [modalKind, setModalKind] = useState<'view' | 'projects' | null>(null)
  const [viewingProjectId, setViewingProjectId] = useState<string | null>(null)
  const [viewingReadOnly, setViewingReadOnly] = useState<boolean>(false)
  const [ratedMap, setRatedMap] = useState<Record<string, string[]>>({})
  const [projectFilter, setProjectFilter] = useState<'all'|'pending'|'rated'>('all')
  const [projectSearch, setProjectSearch] = useState<string>('')
  const [projectCategory, setProjectCategory] = useState<string>('all')
  const modalRef = useRef<HTMLDivElement | null>(null)
  const reportsModalRef = useRef<HTMLDivElement | null>(null)
  const createModalRef = useRef<HTMLDivElement | null>(null)
  const lastActiveElement = useRef<HTMLElement | null>(null)
  const [pullDownY, setPullDownY] = useState(0)
  const touchStartRef = useRef({ y: 0, scrollY: 0 })
  const activeSurvey = surveys.find(x => String(x.id) === String(modalSurveyId))
  // refs for per-survey menu toggle buttons so we can position a portal menu
  const menuButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [portalMenuRect, setPortalMenuRect] = useState<{ top?: number, bottom?: number, left: number, width: number } | null>(null)
  const [portalMenuSurveyId, setPortalMenuSurveyId] = useState<string | null>(null)

  // compute portal menu position when a menu is opened
  useEffect(() => {
    if (!menuOpenFor) { setPortalMenuRect(null); setPortalMenuSurveyId(null); return }
    try {
      const btn = menuButtonRefs.current[String(menuOpenFor)]
      if (!btn) { setPortalMenuRect(null); setPortalMenuSurveyId(null); return }
      const r = btn.getBoundingClientRect()
      const menuWidth = 220
      const left = Math.min(Math.max(r.right - menuWidth, 8), Math.max(8, window.innerWidth - menuWidth - 8))
      const margin = 8
      const spaceBelow = Math.max(0, window.innerHeight - r.bottom - margin)
      const spaceAbove = Math.max(0, r.top - margin)
      // Prefer showing below; if there's not enough space below and more above, anchor above using `bottom`.
      if (spaceBelow < 220 && spaceAbove > spaceBelow) {
        const bottom = Math.max(margin, Math.floor(window.innerHeight - r.top + margin))
        setPortalMenuRect({ bottom, left, width: menuWidth })
      } else {
        const top = Math.max(margin, Math.floor(r.bottom + margin))
        setPortalMenuRect({ top, left, width: menuWidth })
      }
      setPortalMenuSurveyId(String(menuOpenFor))
    } catch (e) { setPortalMenuRect(null); setPortalMenuSurveyId(null) }
    const onScrollResize = () => {
      try {
        const btn = menuButtonRefs.current[String(menuOpenFor)]
        if (!btn) return
        const r = btn.getBoundingClientRect()
        const menuWidth = 220
        const left = Math.min(Math.max(r.right - menuWidth, 8), Math.max(8, window.innerWidth - menuWidth - 8))
        const margin = 8
        const spaceBelow = Math.max(0, window.innerHeight - r.bottom - margin)
        const spaceAbove = Math.max(0, r.top - margin)
        if (spaceBelow < 220 && spaceAbove > spaceBelow) {
          const bottom = Math.max(margin, Math.floor(window.innerHeight - r.top + margin))
          setPortalMenuRect({ bottom, left, width: menuWidth })
        } else {
          const top = Math.max(margin, Math.floor(r.bottom + margin))
          setPortalMenuRect({ top, left, width: menuWidth })
        }
      } catch (e) {}
    }
    window.addEventListener('scroll', onScrollResize, { passive: true })
    window.addEventListener('resize', onScrollResize)
    return () => { try { window.removeEventListener('scroll', onScrollResize); window.removeEventListener('resize', onScrollResize) } catch (e) {} }
  }, [menuOpenFor, surveys])
  // modal project-level filter removed: top-level 'Sin calificar' controls list filtering

  const closeModal = useCallback(() => {
    setIsModalVisible(false)
    // wait for animation then unmount and reset modal state
    setTimeout(() => {
      setModalSurveyId(null)
      setModalKind(null)
      setViewingProjectId(null)
      setViewingReadOnly(false)
    }, 210)
  }, [])

  useEffect(() => {
    let unsubSurveys: (() => void) | null = null
    let unsubReports: (() => void) | null = null
    const supabaseEnabled = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
    const dbEnabled = supabaseEnabled
    const dataClient: any = supabaseClient

    const attachFallback = () => {
      // DB-only policy: do not use localStorage for survey data.
      // When no backend is available, clear lists and show a brief message.
      setSurveys([])
      setSurveyReports([])
      setReportsLoaded(true)
      setToastMessage('No hay servicio de datos configurado. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local')
      setTimeout(() => setToastMessage(null), 5000)
    }

    const setupRealtime = () => {
      try {
        unsubSurveys = dataClient.listenSurveys(async (arr: any[]) => {
          try {
            const current = AuthAdapter.getUser()
            const defaultOwner = (current && (current.email || (current.id as any))) || 'local'
            const normalized = arr.map((item: any) => {
              if (!item.ownerId) return { ...item, ownerId: defaultOwner }
              try {
                if (typeof item.ownerId === 'string' && current) {
                  const raw = item.ownerId.trim()
                  const lowerRaw = raw.toLowerCase()
                  if (lowerRaw && !lowerRaw.includes('@') && lowerRaw !== 'local') {
                    const curEmail = (current && (current.email || '') ) as string
                    const curPrefix = curEmail ? curEmail.split('@')[0].trim().toLowerCase() : null
                    if (curPrefix && curPrefix === lowerRaw) {
                      return { ...item, ownerId: curEmail || item.ownerId }
                    }
                  }
                }
              } catch (e) {}
              return item
            })
            setSurveys(normalized)
            setSurveysLoaded(true)
            // populate ratedMap from server once for current user to avoid transient flips
            try {
              const authUser = (dataClient && dataClient.getAuthCurrentUser && dataClient.getAuthCurrentUser()) || null
              const uid = authUser ? ((authUser as any).uid || (authUser as any).id) : null
              if (uid) {
                const all = await (dataClient.getUserResponsesByUser ? dataClient.getUserResponsesByUser(uid) : {})
                const map: Record<string, string[]> = {}
                for (const sid of Object.keys(all || {})) {
                  const arrResponses = all[sid] || []
                  if (arrResponses && arrResponses.length > 0) {
                    // if any responses exist for this survey, mark simple as responded or collect project ids
                    const sample = arrResponses[0]
                    if (sample && (sample as any).projectId) {
                      map[sid] = (arrResponses as any[]).map((r: any) => String(r.projectId)).filter(Boolean)
                    } else {
                      map[sid] = ['__simple']
                    }
                  }
                }
                setRatedMap(prev => ({ ...(prev || {}), ...(map || {}) }))
              }
            } catch (e) {
              // non-fatal
              console.warn('populate ratedMap failed', e)
            }
          } catch (e) { console.error(e) }
        })

        unsubReports = dataClient.listenSurveyReports((arr: any[]) => {
          try {
            // Filter out reports that were created as precomputed/public reports
            // so they don't appear in the UI as user-submitted reports.
            const filtered = Array.isArray(arr) ? arr.filter((r: any) => {
              if (!r) return false
              // skip entries explicitly marked as public
              if (r.isPublicReport === true) return false
              if (r.reportType && String(r.reportType).toLowerCase() === 'public') return false
              return true
            }) : []
            setSurveyReports(filtered)
          } catch (e) {
            console.error('filtering surveyReports failed', e)
            setSurveyReports(arr || [])
          }
          setReportsLoaded(true)
        })
      } catch (e) {
        console.error('realtime attach error', e)
        attachFallback()
      }
    }

    // Attempt to attach realtime listeners to any available backend (Supabase or Firebase).
    // setupRealtime contains internal error handling and will call attachFallback() on failure.
    if (dbEnabled) {
      setupRealtime()
    } else {
      // No backend configured: clear state and show brief message
      setSurveys([])
      setSurveysLoaded(true)
      setSurveyReports([])
      setReportsLoaded(true)
      setToastMessage('No hay servicio de datos configurado. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local')
      setTimeout(() => setToastMessage(null), 6000)
    }

    // when firebase reconnects, re-attach realtime listeners (safe to call multiple times)
    const onConnected = () => {
      try {
        // cleanup previous unsubscribes if any
        try { if (unsubSurveys) unsubSurveys() } catch (e) {}
        try { if (unsubReports) unsubReports() } catch (e) {}
        const supabaseNow = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
        if (supabaseNow) {
          setupRealtime()
        } else {
          attachFallback()
        }
      } catch (e) {}
    }
    window.addEventListener('realtime:connected', onConnected as EventListener)

    // keep existing window events for compatibility
    const onUpdated = (ev: any) => {
      // Optimistic: apply survey data from event immediately, before server re-fetch
      try {
        const detail = ev && ev.detail
        if (detail && detail.survey) {
          const sv = detail.survey
          setSurveys(prev => {
            const copy = Array.isArray(prev) ? [...prev] : []
            const idx = copy.findIndex((s: any) => String(s.id) === String(sv.id))
            return idx >= 0 ? copy.map((s: any) => String(s.id) === String(sv.id) ? sv : s) : [...copy, sv]
          })
        }
      } catch (e) {}
      if (dbEnabled) {
        // Realtime may be slow or disabled in dev — force a fresh fetch immediately
        dataClient.getSurveysOnce().then((arr: any[]) => {
          try { setSurveys(arr) } catch (e) {}
        }).catch(() => {})
        return
      }
      attachFallback()
    }
    const onResponded = (ev: any) => {
      try {
        const d = ev && ev.detail
        if (!d) {
          if (dbEnabled) return
          attachFallback()
          return
        }
        const sid = d.surveyId || d.survey || null
        const pid = d.projectId || null
        // If using a DB backend, update local ratedMap so UI reflects the new response immediately
        if (dbEnabled) {
          try {
            if (!sid) return
            if (pid) {
              setRatedMap(prev => {
                const copy: Record<string, string[]> = { ...(prev || {}) }
                const arr = Array.isArray(copy[String(sid)]) ? copy[String(sid)] : []
                if (!arr.includes(String(pid))) arr.push(String(pid))
                copy[String(sid)] = arr
                return copy
              })
            } else {
              // mark simple survey as responded using a special token
              setRatedMap(prev => {
                const copy: Record<string, string[]> = { ...(prev || {}) }
                const arr = Array.isArray(copy[String(sid)]) ? copy[String(sid)] : []
                if (!arr.includes('__simple')) arr.push('__simple')
                copy[String(sid)] = arr
                return copy
              })
            }
          } catch (e) {}
          return
        }
        // fallback for non-DB mode
        attachFallback()
      } catch (e) {}
    }
    const onReported = (ev: any) => {
      if (dbEnabled) return
      // DB-only: show empty reports if no DB backend available
      setSurveyReports([])
      setReportsLoaded(true)
    }
    window.addEventListener('surveys:updated', onUpdated as EventListener)
    window.addEventListener('survey:responded', onResponded as EventListener)
    window.addEventListener('survey:reported', onReported as EventListener)
    const onOpen = (ev: any) => {
      try {
        const d = ev && ev.detail
        if (!d) return
        const id = d.surveyId || d.id
        const kind = d.kind || 'view'
        if (!id) return
        setModalSurveyId(String(id))
        setModalKind(kind === 'projects' ? 'projects' : 'view')
      } catch (e) {}
    }
    window.addEventListener('surveys:open', onOpen as EventListener)

    return () => {
      try { if (unsubSurveys) unsubSurveys() } catch (e) {}
      try { if (unsubReports) unsubReports() } catch (e) {}
      window.removeEventListener('surveys:updated', onUpdated as EventListener)
      window.removeEventListener('survey:responded', onResponded as EventListener)
      window.removeEventListener('survey:reported', onReported as EventListener)
      window.removeEventListener('surveys:open', onOpen as EventListener)
        try { window.removeEventListener('realtime:connected', onConnected as EventListener) } catch (e) {}
    }
  }, [])

  const supabaseEnabledNow = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
  const backendEnabled = supabaseEnabledNow
  const dataClientNow: any = supabaseClient

  useEffect(() => {
    // If navigation passed state requesting to open a survey, handle it (useful when coming from notifications)
    try {
      const st = (location && (location as any).state) || null
      if (st && !st.openReports && (st.openSurveyId || st.surveyId)) {
        const id = st.openSurveyId || st.surveyId
        const kind = st.openSurveyKind || st.kind || 'view'
        setTimeout(() => {
          try {
            setModalSurveyId(String(id))
            setModalKind(kind === 'projects' ? 'projects' : 'view')
            // clear the state after handling so it doesn't reopen on refresh or unrelated nav
            try { history.replaceState({}, '', location.pathname) } catch (e) {}
          } catch (e) {}
        }, 80)
      }
      // support opening report viewer directly from navigation state
      if (st && st.openReports && (st.openSurveyId || st.surveyId)) {
        try {
          const idr = st.openSurveyId || st.surveyId
          const reportId = st.openReportId || null
          setTimeout(() => {
            try {
              setViewReportsFor(String(idr))
              if (reportId) setHighlightedReportId(String(reportId))
              try { history.replaceState({}, '', location.pathname) } catch (e) {}
            } catch (e) {}
          }, 120)
        } catch (e) {}
      }
      // support opening the CreateSurvey form from other pages via navigation state
      if (st && st.openCreate) {
        try {
          const type = st.initialType || undefined
          setTimeout(() => {
            try {
              setEditSurvey(null)
              setCreateInitialType(type)
              setCreateModalOpen(true)
              try { history.replaceState({}, '', location.pathname) } catch (e) {}
            } catch (e) {}
          }, 80)
        } catch (e) {}
      }
    } catch (e) {}
  }, [location])

  useEffect(() => {
    if (modalSurveyId !== null) {
      // open modal with small delay to trigger animation
      lastActiveElement.current = document.activeElement as HTMLElement | null
      setIsModalVisible(false)
      // prevent body scroll
      const prevOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      const onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') closeModal() }
      window.addEventListener('keydown', onKey)
      // show animation
      const t = setTimeout(() => {
        setIsModalVisible(true)
        // focus the modal container
        setTimeout(() => modalRef.current?.focus(), 40)
      }, 50)
      return () => {
        clearTimeout(t)
        window.removeEventListener('keydown', onKey)
        document.body.style.overflow = prevOverflow
        // restore previous focus
        setTimeout(() => lastActiveElement.current?.focus(), 40)
      }
    }
  }, [modalSurveyId, closeModal])

  // Helper for non-passive touchmove listeners to prevent browser pull-to-refresh
  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (touchStartRef.current.scrollY <= 0) {
        const delta = e.touches[0].clientY - touchStartRef.current.y;
        if (delta > 0) {
          if (e.cancelable) e.preventDefault();
          setPullDownY(delta);
        }
      }
    };

    const options: AddEventListenerOptions = { passive: false };
    const m = modalRef.current;
    const r = reportsModalRef.current;
    const c = createModalRef.current;

    if (m) m.addEventListener('touchmove', handleTouchMove, options);
    if (r) r.addEventListener('touchmove', handleTouchMove, options);
    if (c) c.addEventListener('touchmove', handleTouchMove, options);

    return () => {
      if (m) m.removeEventListener('touchmove', handleTouchMove);
      if (r) r.removeEventListener('touchmove', handleTouchMove);
      if (c) c.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isModalVisible, isReportsVisible, isCreateVisible]);

  const navigate = useNavigate();
  return (
    <div id="surveys-root" className="px-8 py-6">

      {/* ── Fila 1: Título + Acciones ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h1 className="text-3xl font-black">Encuestas</h1>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => {
            if (!backendEnabled) { setToastMessage('No se puede crear: no hay servicio de datos configurado.'); setTimeout(() => setToastMessage(null), 3000); return }
            handleCreate()
          }} className={`px-4 py-2 text-sm font-medium rounded-lg ${!backendEnabled ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20'}`} disabled={!backendEnabled}>
            + Nueva Encuesta
          </button>
          <button type="button" onClick={() => {
            if (!backendEnabled) { setToastMessage('No se puede crear: no hay servicio de datos configurado.'); setTimeout(() => setToastMessage(null), 3000); return }
            setEditSurvey(null); setCreateInitialType('project'); setCreateModalOpen(true)
          }} className={`px-4 py-2 text-sm font-medium rounded-lg ${!backendEnabled ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`} disabled={!backendEnabled}>
            + Calificación de proyecto
          </button>
        </div>
      </div>

      {/* ── Fila 2: Barra de filtros ───────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border rounded-xl px-4 py-3 mb-4 shadow-sm flex flex-col gap-3">
        {/* Fila superior: buscador (full width) */}
        <div className="relative w-full">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input
            type="text"
            value={titleSearch}
            onChange={e => setTitleSearch(e.target.value)}
            placeholder="Buscar por título..."
            className="pl-8 pr-7 py-1.5 border rounded-lg text-sm w-full bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          {titleSearch && (
            <button type="button" onClick={() => setTitleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" title="Limpiar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* Fila inferior: controles de filtro */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* Sin calificar */}
          <label className="text-sm flex items-center gap-1.5 cursor-pointer select-none text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={showOnlyPending} onChange={e => setShowOnlyPending(e.target.checked)} className="rounded" />
            Sin calificar
          </label>

          {/* Estado */}
          <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
            <span className="whitespace-nowrap">Estado:</span>
            <select value={publishedFilter} onChange={e => setPublishedFilter(e.target.value as any)} className="py-1 px-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400">
              <option value="all">Todas</option>
              <option value="published">Publicadas</option>
              <option value="unpublished">No publicadas</option>
              <option value="reported">Reportadas</option>
            </select>
          </div>

          {/* Propietario */}
          {(() => {
            const uniqueOwners = Array.from(
              new Set(surveys.map(s => getOwnerDisplay(s)).filter(Boolean))
            ).sort()
            if (uniqueOwners.length === 0) return null
            return (
              <div className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                <span className="whitespace-nowrap">Propietario:</span>
                <select value={ownerFilter} onChange={e => setOwnerFilter(e.target.value)} className="py-1 px-2 border rounded-lg text-sm bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-400 max-w-[160px]">
                  <option value="all">Todos</option>
                  {uniqueOwners.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )
          })()}

          {/* Limpiar filtros */}
          {(showOnlyPending || publishedFilter !== 'all' || ownerFilter !== 'all' || titleSearch.trim()) && (
            <button
              type="button"
              onClick={() => { setShowOnlyPending(false); setPublishedFilter('all'); setOwnerFilter('all'); setTitleSearch('') }}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 hover:border-red-200 transition-colors whitespace-nowrap"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* If the query param view=create, show inline CreateSurvey panel; if view=details show ViewSurvey */}
      {(() => {
        const view = new URLSearchParams(location.search).get('view')
        if (view === 'create') return <CreateSurvey />
        if (view === 'details') return <ViewSurvey />
        return null
      })()}

      <div className="bg-white dark:bg-slate-900 rounded-xl border p-4 shadow">
        <h3 className="text-lg font-semibold mb-4">Encuestas guardadas</h3>
        {!surveysLoaded ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 animate-pulse">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="relative p-5 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 flex flex-col justify-between h-[280px] overflow-hidden">
                {/* Acento superior placeholder */}
                <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-200 dark:bg-slate-800"></div>
                <div className="flex-1 mt-1">
                  {/* Badges placeholder */}
                  <div className="flex gap-1.5 mb-3">
                    <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-20"></div>
                    <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-full w-16"></div>
                  </div>
                  {/* Título placeholder */}
                  <div className="h-5 bg-slate-200 dark:bg-slate-800 rounded-lg w-11/12 mb-2.5"></div>
                  {/* Propietario placeholder */}
                  <div className="h-3 bg-slate-100 dark:bg-slate-800/50 rounded-lg w-1/2 mb-6"></div>
                  
                  {/* Detalles placeholder */}
                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 flex flex-col gap-3">
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                  </div>
                </div>
                {/* Botonera placeholder */}
                <div className="mt-5 flex justify-end gap-2">
                   <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-24"></div>
                </div>
              </div>
            ))}
          </div>
        ) : surveys.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/20 border-2 border-dashed border-slate-300 dark:border-slate-700">
            <div className="w-20 h-20 mb-6 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-4xl">inventory_2</span>
            </div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Aún no tienes encuestas</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
              Comienza a recopilar información valiosa. Crea tu primera campaña, ya sea una encuesta simple para recabar opiniones o un proyecto de calificación avanzada.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button type="button" onClick={() => handleCreate()} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30 transition duration-200">
                <span className="material-symbols-outlined text-lg">add_circle</span> Encuesta Simple
              </button>
              <button type="button" onClick={() => { setEditSurvey(null); setCreateInitialType('project'); setCreateModalOpen(true) }} className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 transition duration-200">
                <span className="material-symbols-outlined text-lg">fact_check</span> Proyecto
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {(() => {
              const filteredSurveys = surveys.filter(s => {
                // filter by pending (Sin calificar)
                if (showOnlyPending) {
                  // For project-type surveys: keep those where the user hasn't rated all projects
                  if (s.type === 'project') {
                    // compute per-user progress from ratedMap to avoid global flags
                    const userRatedArrTop = Array.isArray(ratedMap[String(s.id)]) ? ratedMap[String(s.id)].filter(x => x !== '__simple') : []
                    const progressTop = { rated: userRatedArrTop.length, total: ((s.projects || []).length) }
                    // fallback to helper only if we have no per-user index
                    if ((!progressTop || progressTop.rated === 0) && surveyHelpers.getProgressForUser) {
                      try { const p = surveyHelpers.getProgressForUser(String(s.id), (s.projects || []).length); if (!(p.rated < p.total)) return false } catch (e) { return false }
                    } else {
                      if (!(progressTop.rated < progressTop.total)) return false
                    }
                  } else {
                    // For non-project (simple) surveys: include when the current user has NOT responded
                    const userRespondedLocal = Array.isArray(ratedMap[String(s.id)]) && ratedMap[String(s.id)].includes('__simple')
                    let responded = !!userRespondedLocal
                    try {
                      if (!responded && surveyHelpers.hasUserResponded) {
                        responded = !!surveyHelpers.hasUserResponded(String(s.id))
                      }
                    } catch (e) { /* ignore */ }
                    if (responded) return false
                  }
                }
                // filter by reported state (exclusive)
                if (publishedFilter === 'reported') {
                  // Only show surveys that belong to the current user and
                  // that have reports submitted by OTHER users (exclude self-reports)
                  // Admins should see all reported surveys.
                  if (!isOwnerOf(s)) return false
                  const selfId = String(currentUserId || '').trim().toLowerCase()
                  const count = surveyReports.filter(r => {
                    try {
                      if (!r) return false
                      if (String(r.surveyId) !== String(s.id)) return false
                      const reporter = String(r.reporterId || r.reporterEmail || '').trim().toLowerCase()
                      // exclude reports created by the owner themself
                      return reporter && reporter !== selfId
                    } catch (e) { return false }
                  }).length
                  if (count === 0) return false
                } else {
                  // filter by published state
                  if (publishedFilter === 'published' && !s.published) return false
                  if (publishedFilter === 'unpublished' && s.published) return false
                }
                // visibility: unpublished surveys are visible only to their owner
                if (!s.published && !isOwnerOf(s)) return false
                // owner filter
                if (ownerFilter !== 'all') {
                  if (getOwnerDisplay(s) !== ownerFilter) return false
                }
                // title search (all users)
                if (titleSearch.trim()) {
                  const q = titleSearch.trim().toLowerCase()
                  const title = String(s.title || s.name || '').toLowerCase()
                  if (!title.includes(q)) return false
                }
                return true
              })
              const hasActive = showOnlyPending || publishedFilter !== 'all' || ownerFilter !== 'all' || !!titleSearch.trim()
              if (filteredSurveys.length === 0) return (
                <p className="col-span-full text-sm text-slate-500 py-6 text-center">
                  Sin resultados para los filtros aplicados.
                </p>
              )
              return [
                hasActive ? (
                  <p key="__count" className="col-span-full text-xs text-slate-400 -mt-1 mb-1">
                    Mostrando <strong>{filteredSurveys.length}</strong> de {surveys.length} encuesta{surveys.length !== 1 ? 's' : ''}
                    {ownerFilter !== 'all' && <> · Propietario: <strong>{ownerFilter}</strong></>}
                    {titleSearch.trim() && <> · Búsqueda: <strong>&ldquo;{titleSearch.trim()}&rdquo;</strong></>}
                  </p>
                ) : null,
                ...filteredSurveys.map(s => {
                const isProjectType = s.type === 'project' || ((s.projects || []).length > 0) || ((s.rubric || []).length > 0)
                // Prefer project-level metadata on the survey when available.
                // surveyHelpers.* functions return neutral defaults now, so avoid depending on them synchronously.
                const allProjects = s.projects || []
                // resolve responses count from several possible metadata locations
                const respCnt = (typeof s.responsesCount === 'number') ? s.responsesCount : (typeof s.responses === 'number') ? s.responses : (s.reportSummary && typeof s.reportSummary.totalResponses === 'number') ? s.reportSummary.totalResponses : (Array.isArray(s.responses) ? s.responses.length : 0)
                let fullyRated = false
                let progress = null as any
                if (isProjectType) {
                  // Compute per-user progress from ratedMap first; do not use
                  // global `projects[].graded` flags because they reflect other
                  // users' actions and should not affect the current user's view.
                  const userRatedArr = Array.isArray(ratedMap[String(s.id)]) ? ratedMap[String(s.id)].filter(x => x !== '__simple') : []
                  progress = { rated: userRatedArr.length, total: (allProjects || []).length }
                  // fallback to server / helper computed progress only when user index is empty
                  if ((!progress || progress.rated === 0) && surveyHelpers.getProgressForUser) {
                    try { progress = surveyHelpers.getProgressForUser(String(s.id), (s.projects || []).length) } catch (e) {}
                  }
                  fullyRated = progress ? progress.rated >= progress.total && progress.total > 0 : false
                }
                const userRespondedLocal = Array.isArray(ratedMap[String(s.id)]) && ratedMap[String(s.id)].includes('__simple')
                const userResponded = !isProjectType ? (userRespondedLocal || surveyHelpers.hasUserResponded(String(s.id))) : false
                const firstPending = allProjects.find((p: any) => !surveyHelpers.hasUserRated(String(s.id), String(p.id)))
                return (
                  <div key={s.id} id={`survey-${s.id}`} className={`group relative p-5 border rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-xl transform hover:-translate-y-1 transition duration-200 ease-out focus-within:ring-2 bg-white dark:bg-slate-900 ${isProjectType ? 'border-indigo-100 dark:border-indigo-900/50 hover:border-indigo-300 dark:hover:border-indigo-700/50 focus-within:ring-indigo-200' : 'border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-300 dark:hover:border-emerald-700/50 focus-within:ring-emerald-200'}`}>
                    {/* Acento superior de color */}
                    <div className={`absolute top-0 left-0 w-full h-1.5 ${isProjectType ? 'bg-indigo-600' : 'bg-emerald-600'}`}></div>
                    
                    <div className="flex-1">
                      {/* Badges y status */}
                      <div className="flex flex-wrap items-center gap-1.5 mb-3 mt-1">
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1 ${isProjectType ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800 border' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800 border'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isProjectType ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-emerald-600 dark:bg-emerald-400'}`}></span>
                          {isProjectType ? 'Proyecto' : 'Simple'}
                        </span>
                        
                        {s.published && (
                          <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2.5 py-0.5 rounded-full shadow-sm">
                            Publicado
                          </span>
                        )}
                        
                        {isOwnerOf(s) && (() => {
                          const count = surveyReports.filter(r => String(r.surveyId) === String(s.id)).length
                          if (count > 0) return (
                            <span className="text-[10px] uppercase font-bold tracking-wider bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-900/40 dark:text-rose-400 dark:border-rose-800 px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                              <span className="w-1.5 h-1.5 bg-rose-600 dark:bg-rose-400 rounded-full animate-pulse"></span>
                              {count} Reporte{count !== 1 ? 's' : ''}
                            </span>
                          )
                          return null
                        })()}
                      </div>

                      {/* Info principal */}
                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-base leading-tight pr-8 line-clamp-2">{s.title}</h4>
                      {getOwnerDisplay(s) && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex items-center gap-1.5 truncate" title={getOwnerDisplay(s)}>
                          <svg className="w-3.5 h-3.5 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                          {getOwnerDisplay(s)}
                        </div>
                      )}
                      
                      {/* Detalles técnicos */}
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex flex-col gap-2">
                          <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[15px] opacity-70">{isProjectType ? 'rule' : 'help_center'}</span>
                            {isProjectType ? (
                              <span>{(s.rubric?.length || 0)} criterios • {(s.projects || []).length} proyectos</span>
                            ) : (
                              <span>{(s.questions?.length || 0)} preguntas guardadas</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2">
                            <span className="material-symbols-outlined text-[15px] opacity-70">event</span>
                            <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Metricas mini */}
                        {typeof respCnt === 'number' && respCnt > 0 && !isProjectType && (
                          <div className="mt-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-lg p-2.5 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                             <span>Respuestas emitidas</span>
                             <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 px-2 py-0.5 rounded-md shadow-sm">{respCnt}</span>
                          </div>
                        )}
                        {progress && isProjectType && (
                           <div className="mt-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-lg p-2.5">
                             <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                               <span>Progreso de calificación</span>
                               <span className="font-bold">{progress.rated} / {progress.total}</span>
                             </div>
                             <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                               <div className="bg-indigo-500 h-1.5 transition-all duration-700 ease-out" style={{ width: `${progress.total > 0 ? (progress.rated / progress.total) * 100 : 0}%` }}></div>
                             </div>
                           </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Botonera inferior */}
                    <div className="mt-5 flex justify-end items-center gap-2">
                      {!s.published ? (
                        <button type="button" onClick={() => setConfirmPublish({ id: String(s.id), action: 'publish' })} className={`px-4 py-1.5 text-sm font-bold rounded-lg text-white shadow-md transition-all flex items-center gap-2 ${isProjectType ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'}`}>
                          <span className="material-symbols-outlined text-[18px]">publish</span> Publicar
                        </button>
                      ) : isProjectType ? (
                        fullyRated ? (
                          <button type="button" onClick={() => {
                            setModalSurveyId(String(s.id))
                            setModalKind('projects')
                            setViewingProjectId(null)
                          }} title="Ver proyectos (todos calificados)" className="px-4 py-1.5 text-sm font-semibold border-2 border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors dark:border-indigo-800 dark:text-indigo-400 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50">Revisar Notas</button>
                        ) : (
                          <button type="button" onClick={() => {
                            setModalSurveyId(String(s.id))
                            setModalKind('projects')
                            setViewingProjectId(null)
                          }} className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all">Calificar</button>
                        )
                      ) : (
                        userResponded ? (
                          <button type="button" onClick={() => { setModalSurveyId(String(s.id)); setModalKind('view') }} className="px-4 py-1.5 text-sm font-semibold border-2 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50">Respondido</button>
                        ) : (
                          <button type="button" onClick={() => { setModalSurveyId(String(s.id)); setModalKind('view') }} className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 transition-all">Responder</button>
                        )
                      )}

                      {/* Dropdown 3 dots Menu absolute */}
                      <div className="absolute top-4 right-4">
                        <div className="relative inline-block text-left">
                          <button ref={el => { menuButtonRefs.current[String(s.id)] = el as HTMLButtonElement | null }} type="button" onClick={(ev) => { ev.stopPropagation(); setMenuOpenFor(String(s.id) === menuOpenFor ? null : String(s.id)) }} aria-haspopup="true" aria-expanded={menuOpenFor === String(s.id)} className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors" title="Opciones">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                              <circle cx="12" cy="6" r="2" fill="currentColor" />
                              <circle cx="12" cy="12" r="2" fill="currentColor" />
                              <circle cx="12" cy="18" r="2" fill="currentColor" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })]
            })()}
          </div>
        )}
      {/* toast */}
      {toastMessage && (
        <div className="fixed right-4 bottom-4 z-[10000] bg-black text-white px-4 py-2 rounded shadow">
          {toastMessage}
        </div>
      )}
      {/* floating scroll button (solo scroll) */}
      <ScrollFloatingButton />
      </div>
      {/* Portal-rendered survey menu (anchored to the three-dots button) */}
      {portalMenuRect && portalMenuSurveyId && (() => {
        const s = surveys.find(x => String(x.id) === String(portalMenuSurveyId))
        if (!s) return null
        const style: React.CSSProperties = {
          position: 'fixed',
          left: portalMenuRect.left,
          width: portalMenuRect.width,
          zIndex: 99999,
          ...(portalMenuRect.bottom !== undefined ? { bottom: portalMenuRect.bottom } : { top: portalMenuRect.top })
        }
        return ReactDOM.createPortal(
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200/60 dark:border-slate-700/60 rounded-xl shadow-2xl z-50 survey-menu-panel overflow-hidden py-1.5" style={style} onClick={e => e.stopPropagation()}>
            {isOwnerOf(s) ? (
              <>
                {!s.published ? (
                  <button type="button" onClick={() => { setConfirmPublish({ id: String(s.id), action: 'publish' }); setMenuOpenFor(null) }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">visibility</span> Publicar encuesta
                  </button>
                ) : (
                  <button type="button" onClick={() => { setConfirmPublish({ id: String(s.id), action: 'unpublish' }); setMenuOpenFor(null) }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">visibility_off</span> Retirar publicación
                  </button>
                )}
                
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                
                <button type="button" onClick={() => {
                  if (!isOwnerOf(s)) { setToastMessage('No tienes permiso para editar esta encuesta'); setTimeout(() => setToastMessage(null), 3000); setMenuOpenFor(null); return }
                  setEditSurvey(s); setCreateInitialType(undefined); setCreateModalOpen(true); setMenuOpenFor(null)
                }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">edit</span> Editar contenidos
                </button>
                
                { (() => {
                  const count = surveyReports.filter(r => String(r.surveyId) === String(s.id)).length
                  if (count > 0) {
                    return (
                      <button type="button" onClick={() => { setViewReportsFor(String(s.id)); setMenuOpenFor(null) }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">flag</span>Ver reportes ({count})
                      </button>
                    )
                  }
                  return null
                })() }
                
                { isAdmin ? (
                  <button type="button" onClick={() => { setConfirmReportId(String(s.id)); setMenuOpenFor(null) }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">warning</span> Reportar
                  </button>
                ) : null }
                
                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                
                <button type="button" onClick={() => {
                  if (!isOwnerOf(s)) { setToastMessage('No tienes permiso para eliminar esta encuesta'); setTimeout(() => setToastMessage(null), 3000); setMenuOpenFor(null); return }
                  setConfirmDeleteId(String(s.id)); setMenuOpenFor(null)
                }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">delete</span> Eliminar encuesta
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setConfirmReportId(String(s.id)); setMenuOpenFor(null) }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">warning</span> Reportar encuesta
                </button>
              </>
            )}
          </div>, document.body
        )
      })()}
        {/* Modal for viewing a survey */}
        {(modalSurveyId !== null || isModalVisible) && ReactDOM.createPortal(
          <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => closeModal()} />
            <div className="relative w-full sm:max-w-4xl sm:mx-4 sm:mb-0">
              <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                className={`bg-slate-50 dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl h-[95dvh] sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col transform transition-all duration-300 ${isModalVisible ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-full sm:translate-y-4 sm:scale-95'}`}
                style={{
                  overscrollBehaviorY: 'contain',
                  ...(pullDownY > 0 ? { transform: `translateY(${pullDownY}px)`, transition: 'none' } : undefined)
                }}
                onTouchStart={(e) => {
                  const scrollContainer = e.currentTarget.querySelector('.overflow-y-auto');
                  touchStartRef.current = { y: e.touches[0].clientY, scrollY: scrollContainer ? scrollContainer.scrollTop : 0 };
                }}
                onTouchEnd={() => {
                  if (pullDownY > 80) closeModal();
                  setPullDownY(0);
                }}>
                {/* Drag handle for mobile */}
                <div className="w-full flex justify-center pt-2 pb-3 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ backgroundColor: 'var(--color-primary)', touchAction: 'none' }} onClick={() => closeModal()}>
                  <div className="w-12 h-1.5 rounded-full bg-white/40"></div>
                </div>
                {/* Header (sticky) */}
                <div className="sticky top-0 z-10 border-b px-4 sm:px-6 py-4 sm:py-4 flex items-center justify-between text-white flex-shrink-0 pt-7 sm:pt-4" style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit', top: '-1px', touchAction: 'none' }}>
                  <div className="text-lg sm:text-xl font-bold truncate mr-4 tracking-wide">{activeSurvey ? activeSurvey.title : 'Encuesta'}</div>
                  <div className="ml-auto hidden sm:block">
                    <button type="button" onClick={() => closeModal()} aria-label="Cerrar" title="Cerrar" className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
                      <span className="material-symbols-outlined text-[22px]">close</span>
                    </button>
                  </div>
                </div>
                {/* Scrollable content area */}
                <div className="p-3 sm:p-6 flex-1 overflow-y-auto w-full">
                  {/* If survey is a project-type, show projects list or the RateProject UI */}
                  {(() => {
                    const s = surveys.find(x => String(x.id) === String(modalSurveyId))
                    if (!s) return !surveysLoaded
                      ? <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 0',gap:10}}>
                          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{animation:'spin 0.9s linear infinite'}}>
                            <circle cx="18" cy="18" r="14" stroke="#e2e8f0" strokeWidth="4"/>
                            <path d="M18 4a14 14 0 0 1 14 14" stroke="#00628d" strokeWidth="4" strokeLinecap="round"/>
                          </svg>
                          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                          <div style={{fontSize:'0.8rem',color:'#94a3b8',fontWeight:500}}>Cargando...</div>
                        </div>
                      : <div className="text-slate-600">Encuesta no encontrada.</div>
                    if (modalKind === 'projects') {
                          // if viewing a single project, render RateProject
                        if (viewingProjectId) {
                        console.debug('[Surveys] rendering RateProject for surveyId=', s.id, 'viewingProjectId=', viewingProjectId)
                        const proj = (s.projects || []).find((p: any) => String(p.id) === String(viewingProjectId))
                        if (!proj) return <div className="text-slate-600">Proyecto no encontrado.</div>
                        return <RateProject survey={s} project={proj} readOnly={viewingReadOnly} onClose={() => setViewingProjectId(null)} onSaved={(opts) => {
                          // After saving a project's rating, return to the projects list view
                          // Update local ratedMap so the UI shows 'Calificado' immediately for this project
                          try {
                            const pid = opts && (opts as any).projectId
                            if (pid) {
                              setRatedMap(prev => {
                                const copy: Record<string, string[]> = { ...(prev || {}) }
                                const arr = Array.isArray(copy[String(s.id)]) ? copy[String(s.id)] : []
                                if (!arr.includes(String(pid))) arr.push(String(pid))
                                copy[String(s.id)] = arr
                                return copy
                              })
                            }
                          } catch (e) {}
                          setViewingProjectId(null)
                        }} />
                      }

                      // otherwise render list of projects with Calificar buttons
                      const allProjects = (s.projects || [])
                      // Prefer per-user indexed responses (ratedMap) here so the
                      // 'Calificados X / Y' shown in the modal reflects the
                      // current user's progress only.
                      const userRatedArrModal = Array.isArray(ratedMap[String(s.id)]) ? ratedMap[String(s.id)].filter(x => x !== '__simple') : []
                      let progress = { rated: userRatedArrModal.length, total: allProjects.length }
                      // fallback to server helper when no per-user index available
                      if ((!progress || progress.rated === 0) && surveyHelpers.getProgressForUser) {
                        try { progress = surveyHelpers.getProgressForUser(String(s.id), (s.projects || []).length) } catch (e) {}
                      }
                      // compute categories for dropdown
                      const categories = Array.from(new Set(allProjects.map((p: any) => (p.category || '').trim()).filter(Boolean))) as string[]

                      // apply project-level filter + search + category
                      const filteredProjects = allProjects.filter((p: any) => {
                        // search by name or category
                        const q = projectSearch.trim().toLowerCase()
                        if (q) {
                          const hay = `${p.name || ''} ${p.category || ''}`.toLowerCase()
                          if (!hay.includes(q)) return false
                        }
                        // category filter
                        if (projectCategory !== 'all') {
                          if ((p.category || '').trim() !== projectCategory) return false
                        }
                        const isRated = Array.isArray(ratedMap[String(s.id)]) && ratedMap[String(s.id)].includes(String(p.id));
                        if (projectFilter === 'pending') {
                          return !isRated;
                        }
                        if (projectFilter === 'rated') {
                          return isRated;
                        }
                        return true
                      })
                      return (
                        <div>
                          <div className="flex flex-col gap-4 mb-6">
                            {/* Stats */}
                            <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-3 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Proyectos: <span className="font-bold text-slate-800 dark:text-slate-200 ml-1">{allProjects.length}</span></div>
                              <div className="text-sm font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">done_all</span> Calificados: {progress.rated} / {progress.total}</div>
                            </div>
                            
                            {/* Filters */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <select value={projectFilter} onChange={e => setProjectFilter(e.target.value as any)} className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 shadow-sm font-medium text-slate-700 dark:text-slate-300">
                                <option value="all">Todos los estados</option>
                                <option value="pending">Sin calificar</option>
                                <option value="rated">Calificados</option>
                              </select>
                              <select value={projectCategory} onChange={e => setProjectCategory(e.target.value)} className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 shadow-sm font-medium text-slate-700 dark:text-slate-300">
                                <option value="all">Todas las categorías</option>
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                              <div className="relative w-full">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">search</span>
                                <input placeholder="Buscar proyecto..." value={projectSearch} onChange={e => setProjectSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 shadow-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400" />
                              </div>
                            </div>
                          </div>
                          {/* project-level filter intentionally removed; use top-level 'Sin calificar' */}
                          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredProjects.map((p: any) => {
                              const ratedLocal = Array.isArray(ratedMap[String(s.id)]) && ratedMap[String(s.id)].includes(String(p.id))
                              const rated = ratedLocal || surveyHelpers.hasUserRated(String(s.id), String(p.id))
                              return (
                                <div key={p.id} className="p-4 sm:p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 flex flex-col justify-between shadow-sm hover:shadow-md transition-all hover:border-indigo-300 dark:hover:border-indigo-500/50 group h-full">
                                  <div>
                                    <div className="mb-3">
                                      <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[15px] leading-snug line-clamp-2" title={p.name}>{p.name || 'Proyecto sin nombre'}</h4>
                                    </div>
                                    {p.category && (
                                      <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold mb-3">
                                        <span className="material-symbols-outlined text-[13px]">category</span> {p.category}
                                      </div>
                                    )}
                                    <div className="space-y-2 mt-1">
                                      {p.members && (
                                        <div className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-2 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                          <span className="material-symbols-outlined text-[15px] mt-[1px] text-slate-400">groups</span>
                                          <div className="flex-1 leading-relaxed whitespace-pre-wrap"><span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Integrantes:</span>{String(p.members).replace(/([a-zñáéíóú])([A-Z])/g, '$1, $2')}</div>
                                        </div>
                                      )}
                                      {p.advisor && (
                                        <div className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-2 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                          <span className="material-symbols-outlined text-[15px] text-slate-400">school</span>
                                          <div className="flex-1 leading-relaxed truncate"><span className="font-semibold text-slate-700 dark:text-slate-300 mr-1">Asesor:</span>{p.advisor}</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                                    {rated ? (
                                      <button type="button" onClick={() => { setModalSurveyId(String(s.id)); setModalKind('projects'); setViewingReadOnly(true); setViewingProjectId(String(p.id)) }} className="w-full sm:w-auto px-4 py-2 text-sm font-bold rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors flex justify-center items-center gap-2"><span className="material-symbols-outlined text-[18px]">check_circle</span> Calificado</button>
                                    ) : (
                                      <button type="button" onClick={() => { setModalSurveyId(String(s.id)); setModalKind('projects'); setViewingReadOnly(false); setViewingProjectId(String(p.id)) }} className="w-full sm:w-auto px-5 py-2 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all flex justify-center items-center gap-2"><span className="material-symbols-outlined text-[18px]">edit_document</span> Calificar</button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    }
                    // default for non-project surveys
                    return <ViewSurvey surveyId={modalSurveyId ?? undefined} onClose={() => closeModal()} hideCloseButton={true} />
                  })()}
                </div>
              </div>
            </div>
          </div>, document.body
        )}
        {/* Custom delete confirmation modal */}
        {confirmDeleteId && ReactDOM.createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center">
            <div className="absolute inset-0 bg-black opacity-40" onClick={() => { if (!confirmDeleting) setConfirmDeleteId(null) }} />
            <div className={`relative w-full max-w-md mx-4 bg-white dark:bg-slate-900 rounded p-6 shadow-lg` } role="dialog" aria-modal="true">
              <h3 className="text-lg font-semibold mb-2">¿Eliminar esta encuesta?</h3>
              <p className="text-sm text-slate-600 mb-4">Esta acción es irreversible. ¿Deseas eliminarla definitivamente?</p>
                <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={confirmDeleting} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
                <button type="button" onClick={async () => {
                      try {
                            setConfirmDeleting(true)
                            // If a DB backend is enabled, remove via its API
                            if (backendEnabled) {
                        // find target in local state for ownership check
                        const target = surveys.find((x: any) => String(x.id) === String(confirmDeleteId))
                        if (target && !isOwnerOf(target)) {
                          setToastMessage('No tienes permiso para eliminar esta encuesta')
                          setTimeout(() => setToastMessage(null), 3000)
                          setConfirmDeleting(false)
                          setConfirmDeleteId(null)
                          return
                        }
                        try {
                                // remove survey and all related data (responses, userResponses, reports, notifications, published index)
                                if ((dataClientNow as any).removeSurveyCascade) {
                                  await (dataClientNow as any).removeSurveyCascade(String(confirmDeleteId))
                                } else {
                                  await dataClientNow.removeSurveyById(String(confirmDeleteId))
                                }
                        } catch (e: any) {
                          console.error('delete survey failed', e)
                          const msg = (e && e.message) ? String(e.message) : 'Error al eliminar la encuesta'
                          setToastMessage(msg)
                          setTimeout(() => setToastMessage(null), 4000)
                          setConfirmDeleting(false)
                          setConfirmDeleteId(null)
                          return
                        }
                        // Only do optimistic removal after confirming DB delete succeeded
                        setSurveys(prev => prev.filter(x => String(x.id) !== String(confirmDeleteId)))
                        setToastMessage('Encuesta eliminada')
                        setTimeout(() => setToastMessage(null), 3000)
                        try { window.dispatchEvent(new CustomEvent('surveys:updated', { detail: { surveyId: confirmDeleteId } })) } catch (e) {}
                      } else {
                        // Not allowed when no backend is configured
                        setToastMessage('No se puede eliminar: no hay servicio de datos configurado.')
                        setTimeout(() => setToastMessage(null), 3000)
                        setConfirmDeleting(false)
                        setConfirmDeleteId(null)
                        return
                      }
                    } catch (e) {
                      console.error(e)
                    } finally {
                      setConfirmDeleting(false)
                      setConfirmDeleteId(null)
                    }
                  }} disabled={confirmDeleting} className="px-4 py-2 bg-red-600 text-white rounded">{confirmDeleting ? 'Eliminando...' : 'Eliminar'}</button>
              </div>
            </div>
          </div>, document.body
        )}
          {/* Publish / Unpublish confirmation modal */}
          {confirmPublish && ReactDOM.createPortal(
            <div className="fixed inset-0 z-[10000] flex items-center justify-center">
              <div className="absolute inset-0 bg-black opacity-40" onClick={() => { if (!confirmPublishing) setConfirmPublish(null) }} />
              <div className={`relative w-full max-w-md mx-4 bg-white dark:bg-slate-900 rounded p-6 shadow-lg` } role="dialog" aria-modal="true">
                <h3 className="text-lg font-semibold mb-2">{confirmPublish.action === 'publish' ? 'Publicar encuesta' : 'Retirar publicación'}</h3>
                <div className="text-sm text-slate-600 mb-4">
                  {(() => {
                    const s = surveys.find(x => String(x.id) === String(confirmPublish.id))
                    if (!s) return 'Encuesta no encontrada.'
                    if (confirmPublish.action === 'publish') {
                      // validate minimal requirements
                      const missing: string[] = []
                      if (s.type !== 'project' && !(s.questions && s.questions.length > 0)) missing.push('Al menos 1 pregunta')
                      if (s.type === 'project' && (!(s.rubric && s.rubric.length > 0) || !(s.projects && s.projects.length > 0))) {
                        if (!(s.rubric && s.rubric.length > 0)) missing.push('Al menos 1 criterio (rubric)')
                        if (!(s.projects && s.projects.length > 0)) missing.push('Al menos 1 proyecto')
                      }
                      if (missing.length === 0) return 'Confirma que deseas publicar esta encuesta. Será visible para el público.'
                      return (<div>
                        <div className="font-medium">No se puede publicar todavía:</div>
                        <ul className="list-disc pl-5 mt-2 text-sm text-slate-600">{missing.map(m => <li key={m}>{m}</li>)}</ul>
                      </div>)
                    }
                    return 'Confirma que deseas retirar la publicación de esta encuesta. La encuesta dejará de estar visible.'
                  })()}
                </div>
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setConfirmPublish(null)} disabled={confirmPublishing} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
                  <button type="button" onClick={async () => {
                    try {
                      setConfirmPublishing(true)
                        if (backendEnabled) {
                        const target = surveys.find((x: any) => String(x.id) === String(confirmPublish.id))
                        if (target && !isOwnerOf(target)) {
                          setToastMessage('No tienes permiso para cambiar el estado de publicación')
                          setTimeout(() => setToastMessage(null), 3000)
                          setConfirmPublishing(false)
                          setConfirmPublish(null)
                          return
                        }
                        const updated = { ...(target || {}), ...(confirmPublish.action === 'publish' ? { published: true, publishedAt: new Date().toISOString() } : { published: false }) }
                        if (confirmPublish.action !== 'publish') { delete (updated as any).publishedAt }
                        try {
                          await dataClientNow.setSurvey(String(confirmPublish.id), updated)
                        } catch (e) { console.error(e) }
                        // optimistic update
                        setSurveys(prev => prev.map(x => (String(x.id) === String(confirmPublish.id) ? updated : x)))
                        setToastMessage(confirmPublish.action === 'publish' ? 'Encuesta publicada' : 'Publicación retirada')
                        setTimeout(() => setToastMessage(null), 3000)
                        // create a global notification when publishing
                        if (confirmPublish.action === 'publish') {
                          try {
                            const s = updated
                            const note = {
                              id: `notif-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
                              type: 'survey_published',
                              surveyId: confirmPublish.id,
                              title: s ? (`Nueva encuesta: ${s.title}`) : 'Nueva encuesta publicada',
                              message: '',
                              createdAt: new Date().toISOString(),
                              read: false
                            }
                            try {
                              await dataClientNow.pushNotification(note)
                              // Supabase realtime does NOT echo the insert back to the sender,
                              // so we manually re-fetch and dispatch the fresh list so the
                              // publisher's own NotificationsPanel updates immediately.
                              try {
                                const freshNotifs = await dataClientNow.getNotificationsOnce()
                                window.dispatchEvent(new CustomEvent('notifications:updated', { detail: { notifications: freshNotifs } }))
                              } catch (e) {
                                window.dispatchEvent(new CustomEvent('notifications:updated', { detail: { notification: note } }))
                              }
                            } catch (e) { console.error(e) }
                          } catch (e) { console.error(e) }
                        }
                        // when unpublishing, remove any previous notifications and user reports for this survey
                        if (confirmPublish.action !== 'publish') {
                          try {
                            const notifs = await dataClientNow.getNotificationsOnce()
                            for (const n of notifs || []) {
                              try {
                                if (n && String(n.surveyId) === String(confirmPublish.id)) {
                                  await dataClientNow.removeNotificationById(String(n.id))
                                }
                              } catch (e) {}
                            }
                            try { window.dispatchEvent(new CustomEvent('notifications:updated', { detail: { surveyId: String(confirmPublish.id) } })) } catch (e) {}
                          } catch (e) {}
                          try {
                            const reps = await dataClientNow.getSurveyReportsOnce()
                            for (const r of reps || []) {
                              try {
                                if (r && String(r.surveyId) === String(confirmPublish.id)) {
                                  await dataClientNow.removeSurveyReportById(String(r.id))
                                }
                              } catch (e) {}
                            }
                            try { window.dispatchEvent(new CustomEvent('survey:reports:updated', { detail: { surveyId: String(confirmPublish.id) } })) } catch (e) {}
                          } catch (e) {}
                        }
                        try { window.dispatchEvent(new CustomEvent('surveys:updated', { detail: { surveyId: confirmPublish.id, survey: updated } })) } catch (e) {}
                      } else {
                        // Not allowed when no backend is configured
                        setToastMessage('No se puede cambiar el estado de publicación: no hay servicio de datos configurado.')
                        setTimeout(() => setToastMessage(null), 3000)
                        setConfirmPublishing(false)
                        setConfirmPublish(null)
                        return
                      }
                    } catch (e) { console.error(e) }
                    finally { setConfirmPublishing(false); setConfirmPublish(null) }
                  }} disabled={confirmPublishing} className={`px-4 py-2 rounded ${confirmPublishing ? 'btn-disabled' : 'btn btn-primary'}`}>{confirmPublishing ? 'Procesando...' : (confirmPublish.action === 'publish' ? 'Publicar' : 'Retirar')}</button>
                </div>
              </div>
            </div>, document.body
          )}
        {/* Reports viewer modal (owner) */}
        {viewReportsFor && ReactDOM.createPortal(
          <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { setViewReportsFor(null); setHighlightedReportId(null) }} />
            <div className={`relative w-full sm:max-w-2xl sm:mx-4 sm:mb-0 bg-slate-50 dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col h-[90dvh] sm:h-auto sm:max-h-[80vh] overflow-hidden transform transition-all duration-300 ${isReportsVisible ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-full sm:translate-y-4 sm:scale-95'}`} role="dialog" aria-modal="true"
                 ref={reportsModalRef}
                 style={{
                   overscrollBehaviorY: 'contain',
                   ...(pullDownY > 0 ? { transform: `translateY(${pullDownY}px)`, transition: 'none' } : undefined)
                 }}
                 onTouchStart={(e) => {
                   const scrollContainer = e.currentTarget.querySelector('.overflow-y-auto');
                   touchStartRef.current = { y: e.touches[0].clientY, scrollY: scrollContainer ? scrollContainer.scrollTop : 0 };
                 }}
                 onTouchEnd={() => {
                   if (pullDownY > 80) closeReportsModal();
                   setPullDownY(0);
                 }}>
              {/* Drag handle */}
              <div className="w-full flex justify-center pt-2 pb-3 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ touchAction: 'none' }} onClick={() => closeReportsModal()}>
                <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></div>
              </div>
              {/* Header */}
              <div className="px-5 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0 z-10" style={{ touchAction: 'none' }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[22px]">flag</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Buzón de Reportes</h3>
                </div>
                <div className="ml-auto hidden sm:block">
                  <button
                    type="button"
                    onClick={() => closeReportsModal()}
                    aria-label="Cerrar"
                    className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center justify-center hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[20px]">close</span>
                  </button>
                </div>
              </div>
              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {(() => {
                  if (!reportsLoaded) return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', gap: 10 }}>
                      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ animation: 'spin 0.9s linear infinite' }}>
                        <circle cx="18" cy="18" r="14" stroke="#e2e8f0" strokeWidth="4"/>
                        <path d="M18 4a14 14 0 0 1 14 14" stroke="#00628d" strokeWidth="4" strokeLinecap="round"/>
                      </svg>
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}>Cargando reportes...</div>
                    </div>
                  )
                  const reports = surveyReports.filter(r => String(r.surveyId) === String(viewReportsFor))
                  if (!reports || reports.length === 0) return <div className="text-slate-600 text-sm">No hay reportes para esta encuesta.</div>
                  return reports.map(r => {
                    const isHighlighted = highlightedReportId && String(r.id) === String(highlightedReportId)
                    return (
                      <div
                        key={r.id}
                        id={`report-item-${r.id}`}
                        ref={isHighlighted ? (el) => { if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80) } : undefined}
                        className={`p-4 border rounded-2xl shadow-sm ${isHighlighted ? 'bg-amber-50 border-amber-300 dark:bg-amber-900/20 dark:border-amber-500/50 ring-4 ring-amber-400/20' : 'bg-white border-slate-200 dark:bg-slate-800/80 dark:border-slate-700'} relative overflow-hidden group`}
                      >
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-red-400 dark:bg-red-500"></div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pl-2">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0 text-slate-500">
                               <span className="material-symbols-outlined text-[16px]">person_alert</span>
                             </div>
                             <div className="text-sm font-bold text-slate-700 dark:text-slate-300 truncate">{r.reporterEmail || r.reporterId || 'Usuario Anónimo'}</div>
                          </div>
                          <div className="text-xs text-slate-500 bg-slate-100 dark:bg-slate-700/50 px-2 py-1 rounded-md self-start sm:self-auto flex items-center gap-1.5 font-medium whitespace-nowrap ml-10 sm:ml-0"><span className="material-symbols-outlined text-[14px]">schedule</span>{new Date(r.createdAt).toLocaleString()}</div>
                        </div>
                        <div className="text-[15px] leading-relaxed text-slate-700 dark:text-slate-300 pl-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 ml-10 sm:ml-0">{r.comment}</div>
                        {isHighlighted && <div className="mt-3 text-xs text-amber-700 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-900/40 inline-flex px-2 py-1.5 rounded-md flex items-center gap-1.5 w-fit ml-10 sm:ml-0"><span className="material-symbols-outlined text-[14px]">notifications_active</span> Este es el reporte referenciado de la notificación</div>}
                      </div>
                    )
                  })
                })()}
              </div>
            </div>
          </div>, document.body
        )}
          {/* Report modal */}
          {confirmReportId && ReactDOM.createPortal(
            <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 perspective-1000">
              <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => { if (!confirmReporting) setConfirmReportId(null) }} />
              <div className={`relative w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl p-6 sm:p-8 shadow-2xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:fade-in sm:zoom-in-95 duration-200`} role="dialog" aria-modal="true">
                <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-6 sm:hidden"></div>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[22px]">warning</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Reportar encuesta</h3>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-5 pl-[52px]">
                  Describe detalladamente el problema con esta encuesta para que la moderación evalúe el caso.
                </div>
                <textarea value={reportComment} onChange={e => setReportComment(e.target.value)} rows={5} className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-red-400 focus:ring-4 focus:ring-red-400/20 rounded-xl text-sm p-4 text-slate-700 dark:text-slate-200 outline-none resize-none transition-all placeholder:text-slate-400 mb-6" placeholder="¿Qué problema encontraste?" />
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                  <button type="button" onClick={() => { setConfirmReportId(null); setReportComment('') }} disabled={confirmReporting} className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl transition-colors">Cancelar</button>
                  <button type="button" onClick={async () => {
                    try {
                      if (!reportComment || reportComment.trim().length < 3) {
                        setToastMessage('Escribe un comentario válido para reportar')
                        setTimeout(() => setToastMessage(null), 3000)
                        return
                      }
                      setConfirmReporting(true)
                      const _reportSurvey = (surveys || []).find((sv: any) => String(sv.id) === String(confirmReportId))
                      const report = {
                        id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
                        surveyId: confirmReportId,
                        reporterId: currentUserId,
                        reporterEmail: currentUser && (currentUser.email || null),
                        comment: reportComment.trim(),
                        createdAt: new Date().toISOString(),
                        payload: { surveyTitle: (_reportSurvey && (_reportSurvey.title || _reportSurvey.name)) || '' }
                      }
                      if (backendEnabled) {
                        try {
                          await (dataClientNow as any).pushSurveyReport(report)
                        } catch (e: any) {
                          console.error('[Surveys] pushSurveyReport failed:', e?.code, e?.message, e?.details, e?.hint)
                          setToastMessage('Error al enviar el reporte: ' + (e?.message || 'Error desconocido'))
                          setTimeout(() => setToastMessage(null), 5000)
                          setConfirmReporting(false)
                          return
                        }
                        // optimistic update until realtime notifies
                        setSurveyReports(prev => [...prev, report])
                        try { window.dispatchEvent(new CustomEvent('survey:reported', { detail: { report } })) } catch (e) {}
                        setToastMessage('Reporte enviado. Gracias.')
                        setTimeout(() => setToastMessage(null), 3000)
                        setConfirmReportId(null)
                        setReportComment('')
                      } else {
                        // Not allowed when no backend is configured
                        setToastMessage('No se puede enviar reportes: no hay servicio de datos configurado.')
                        setTimeout(() => setToastMessage(null), 3000)
                        setConfirmReporting(false)
                        return
                      }
                    } catch (e) { console.error(e) }
                    finally { setConfirmReporting(false) }
                  }} disabled={confirmReporting} className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${confirmReporting ? 'bg-red-200 text-red-500 cursor-not-allowed dark:bg-red-900/40 dark:text-red-400/50' : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20'}`}>{confirmReporting ? <><span className="material-symbols-outlined text-[18px] animate-spin">refresh</span> Procesando...</> : 'Enviar reporte'}</button>
                </div>
              </div>
            </div>, document.body
          )}
        {/* Create modal */}
        {createModalOpen && ReactDOM.createPortal(
          <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => closeCreateModal()} />
            <div className="relative w-full sm:max-w-xl sm:mx-4 sm:mb-0">
              <div className={`bg-slate-50 dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl h-[95dvh] sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col transform transition-all duration-300 ${isCreateVisible ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-full sm:translate-y-4 sm:scale-95'}`}
                   ref={createModalRef}
                   style={{
                     overscrollBehaviorY: 'contain',
                     ...(pullDownY > 0 ? { transform: `translateY(${pullDownY}px)`, transition: 'none' } : undefined)
                   }}
                   onTouchStart={(e) => {
                     const scrollContainer = e.currentTarget.querySelector('.overflow-y-auto');
                     touchStartRef.current = { y: e.touches[0].clientY, scrollY: scrollContainer ? scrollContainer.scrollTop : 0 };
                   }}
                   onTouchEnd={() => {
                     if (pullDownY > 80) closeCreateModal();
                     setPullDownY(0);
                   }}>
                {/* Drag handle for mobile */}
                <div className="w-full flex justify-center pt-2 pb-3 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ backgroundColor: 'var(--color-primary)', touchAction: 'none' }} onClick={() => closeCreateModal()}>
                  <div className="w-12 h-1.5 rounded-full bg-white/40"></div>
                </div>
                {/* Header (sticky) */}
                <div className="sticky top-0 z-10 border-b px-4 sm:px-6 py-4 sm:py-4 flex items-center justify-between text-white flex-shrink-0 pt-7 sm:pt-4" style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit', top: '-1px', touchAction: 'none' }}>
                  <div className="text-lg sm:text-xl font-bold truncate mr-4 tracking-wide">{editSurvey ? 'Editar encuesta' : 'Crear encuesta'}</div>
                  <div className="ml-auto hidden sm:block">
                    <button type="button" onClick={() => closeCreateModal()} aria-label="Cerrar" title="Cerrar" className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors">
                      <span className="material-symbols-outlined text-[22px]">close</span>
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-0 sm:px-4 pb-0 sm:pb-4 w-full">
                  <CreateSurvey
                    hideTypeSelector={true}
                    initialType={createInitialType}
                    editSurvey={editSurvey}
                    onSaved={(key: any, surveyData?: any) => {
                      const wasEditing = !!editSurvey
                      closeCreateModal()
                      setEditSurvey(null)
                      setCreateInitialType(undefined)
                      setToastMessage(wasEditing ? 'Encuesta actualizada' : 'Encuesta creada')
                      setTimeout(() => setToastMessage(null), 3000)
                      // Optimistic: add/update survey in local state immediately
                      if (surveyData) {
                        setSurveys(prev => {
                          const copy = Array.isArray(prev) ? [...prev] : []
                          const idx = copy.findIndex((s: any) => String(s.id) === String(key))
                          return idx >= 0
                            ? copy.map((s: any) => String(s.id) === String(key) ? surveyData : s)
                            : [...copy, surveyData]
                        })
                      }
                      // Then sync from server in case optimistic data differs
                      try {
                        dataClientNow.getSurveysOnce().then((arr: any[]) => {
                          try { setSurveys(arr) } catch (e) {}
                        }).catch(() => {})
                      } catch (e) {}
                    }}
                    onClose={() => { setCreateModalOpen(false); setEditSurvey(null); setCreateInitialType(undefined); }}
                  />
                </div>
              </div>
            </div>
          </div>, document.body
        )}
    </div>
  )
}
