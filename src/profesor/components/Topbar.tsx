import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import surveyHelpers from '../../services/surveyHelpers'
import supabaseClient from '../../services/supabaseClient'
import { useAuth } from '../../services/AuthContext'
import ProfileModal, { loadProfile, loadProfileAsync, ProfileData } from './ProfileModal'

type Props = {
  notificationsOpen: boolean
  onToggleNotifications: () => void
  notifications?: any[]
  badgeCount?: number
  onToggleMobileSidebar?: () => void
}

export default function Topbar({ notificationsOpen, onToggleNotifications, notifications: notificationsProp, badgeCount, onToggleMobileSidebar }: Props) {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const userId = currentUser?.id || currentUser?.email || null
  const [profileOpen, setProfileOpen] = useState(false)
  const [chipMenuOpen, setChipMenuOpen] = useState(false)
  const chipMenuRef = useRef<HTMLDivElement>(null)
  const [profile, setProfile] = useState<ProfileData>(() => loadProfile(userId))

  // Reload profile when user changes (async from Supabase, sync cache first)
  useEffect(() => {
    setProfile(loadProfile(userId))
    loadProfileAsync(userId).then(p => setProfile(p))
  }, [userId])

  // Close chip menu on outside click
  useEffect(() => {
    if (!chipMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (chipMenuRef.current && !chipMenuRef.current.contains(e.target as Node)) {
        setChipMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [chipMenuOpen])

  const roleLabel = ({ admin: 'Administrador', profesor: 'Profesor', estudiante: 'Estudiante' } as Record<string, string>)[String(currentUser?.role || '')] ?? (currentUser ? 'Usuario' : 'Invitado')
  const avatarInitials = profile.displayName
    ? profile.displayName.trim().split(/\s+/).slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
    : (currentUser?.email ? String(currentUser.email).slice(0, 2).toUpperCase() : 'PM')
  const [unreadNotifications, setUnreadNotifications] = useState<number>(0)
  const [pendingResponses, setPendingResponses] = useState<number>(0)
  const [hiddenMap, setHiddenMap] = useState<Record<string, any>>({})
  const [hiddenMapLoaded, setHiddenMapLoaded] = useState(false)
  const [surveysList, setSurveysList] = useState<any[] | null>(null)



  // Recompute pendingResponses using the user's responses fetched from Firebase
  useEffect(() => {
    let cancelled = false
    const computePending = async () => {
      try {
        if (!surveysList || !Array.isArray(surveysList)) {
          if (!cancelled) setPendingResponses(0)
          return
        }
        const supabaseEnabled = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
        const dataClient: any = supabaseClient
        const authUser = (dataClient && dataClient.getAuthCurrentUser && dataClient.getAuthCurrentUser()) || null
        const uid = authUser ? (authUser as any).uid : (currentUser && currentUser.id) || null
        if (!uid) {
          if (!cancelled) setPendingResponses(0)
          return
        }

        // Fetch all responses by this user indexed by surveyId
        let userResponsesBySurvey: Record<string, any[]> = {}
        try {
          if (dataClient && dataClient.getUserResponsesByUser) {
            userResponsesBySurvey = await dataClient.getUserResponsesByUser(uid)
          }
        } catch (e) { userResponsesBySurvey = {} }

        let pending = 0
        surveysList.forEach((s: any) => {
          try {
            if (!s || !s.published) return
            const surveyId = String(s.id)
            const userRespForSurvey = Array.isArray(userResponsesBySurvey[surveyId]) ? userResponsesBySurvey[surveyId] : []
            if (s.type === 'project' || (s.projects && s.projects.length > 0)) {
              // count unique project responses by this user for this survey
              const projects = s.projects || []
              const uniqueProjectIds = new Set((userRespForSurvey || []).map((r: any) => String(r.projectId || r.project || r.projectId)))
              if (uniqueProjectIds.size < (projects || []).length) pending += 1
            } else {
              // non-project survey -> pending if user has no responses for this survey
              if (!userRespForSurvey || userRespForSurvey.length === 0) pending += 1
            }
          } catch (e) {}
        })

        if (!cancelled) setPendingResponses(pending)
      } catch (e) {
        if (!cancelled) setPendingResponses(0)
      }
    }
    computePending()
    return () => { cancelled = true }
  }, [surveysList, currentUser])



  useEffect(() => {
    let unsubSurv: (() => void) | null = null

    const loadLocal = () => {
      // localStorage fallback removed for surveys; default to zero counts
      setPendingResponses(0)
    }

    try {
      const supabaseEnabledG = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
      const dataClientG: any = supabaseClient
      if (dataClientG && dataClientG.isEnabled && dataClientG.isEnabled() && dataClientG.listenSurveys) {
        unsubSurv = dataClientG.listenSurveys((arr: any[]) => {
          // keep surveys in state and compute pending in a dedicated effect (below)
          setSurveysList(Array.isArray(arr) ? arr : [])
        })
      } else {
        loadLocal()
      }

      // when connected, explicitly re-fetch once to ensure counters are correct
      const onConnectedGlobal = async () => {
        try {
          if (!(dataClientG && dataClientG.isEnabled && dataClientG.isEnabled())) return
          try {
            // Fetch surveys and compute pendingResponses (no local hidden interaction needed)
            const arr = await (dataClientG.getSurveysOnce ? dataClientG.getSurveysOnce() : [])
            let pending = 0
            if (Array.isArray(arr)) {
              arr.forEach((s: any) => {
                if (!s || !s.published) return
                try {
                  if (s.type === 'project' || (s.projects && s.projects.length > 0)) {
                    const prog = surveyHelpers.getProgressForUser(String(s.id), (s.projects || []).length)
                    if (prog.rated < prog.total) pending += 1
                  } else {
                    if (!surveyHelpers.hasUserResponded(String(s.id))) pending += 1
                  }
                } catch (e) {}
              })
            }
            setPendingResponses(pending)
          } catch (e) {}
        } catch (e) {}
      }

      // call once immediately if client is available
      try { if (dataClientG && dataClientG.isEnabled && dataClientG.isEnabled()) onConnectedGlobal() } catch (e) {}

      window.addEventListener('realtime:connected', onConnectedGlobal as EventListener)
    } catch (e) { loadLocal() }

    return () => {
      if (unsubSurv) try { unsubSurv() } catch (e) {}
      try { window.removeEventListener('realtime:connected', () => {}) } catch (e) {}
    }
  }, [])

  // Listen to per-user hidden notifications and keep hiddenMap (with local fallback)
  useEffect(() => {
    let unsubHidden: (() => void) | null = null
    try {
      const supabaseEnabled = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
      const dataClient: any = supabaseClient
      const authUser = (dataClient && dataClient.getAuthCurrentUser && dataClient.getAuthCurrentUser()) || null
      const uid = authUser ? (authUser as any).uid : (currentUser && currentUser.id) || null
      if (!uid) { setHiddenMap({}); setHiddenMapLoaded(true); return () => {} }
      if (dataClient && dataClient.isEnabled && dataClient.isEnabled() && dataClient.listenHiddenNotifications) {
        unsubHidden = dataClient.listenHiddenNotifications(String(uid), (map: Record<string, any>) => {
          try { setHiddenMap(map || {}) } catch (e) { setHiddenMap({}) }
          setHiddenMapLoaded(true)
        })
      } else if (dataClient && dataClient.getHiddenNotificationsOnce) {
        try {
          dataClient.getHiddenNotificationsOnce(String(uid))
            .then((m: any) => { setHiddenMap(m || {}); setHiddenMapLoaded(true) })
            .catch(() => { setHiddenMap({}); setHiddenMapLoaded(true) })
        } catch (e) { setHiddenMap({}); setHiddenMapLoaded(true) }
      } else {
        setHiddenMapLoaded(true)
      }
      // also load any local fallback
      try {
        const localKey = `hiddenNotificationsLocal:${uid}`
        const raw = window.localStorage.getItem(localKey)
        if (raw) {
          try {
            const parsed = JSON.parse(raw || '{}')
            setHiddenMap(prev => ({ ...(prev || {}), ...(parsed || {}) }))
          } catch (e) {}
        }
      } catch (e) {}
    } catch (e) { setHiddenMap({}) }
    return () => { if (unsubHidden) try { unsubHidden() } catch (e) {} }
  }, [currentUser])

  // Badge count comes directly from NotificationsPanel via ProfesorLayout (badgeCount prop).
  // It reflects exactly what the panel renders, so badge and panel list are always in sync.
  useEffect(() => {
    if (badgeCount !== undefined) setUnreadNotifications(badgeCount)
  }, [badgeCount])

  return (
    <>
      <div id="top-bar" className="fixed top-0 right-0 left-0 z-30 flex items-center gap-1 py-2 px-3 shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text)'}}>

        {/* Hamburger — solo mobile */}
        <button
          className="topbar-hamburger"
          onClick={onToggleMobileSidebar}
          aria-label="Abrir menú"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>

        {/* Brand / Logo */}
        <div className="topbar-brand" onClick={() => { try { navigate('/profesor') } catch (e) {} }}>
          <span className="material-symbols-outlined topbar-brand-icon">school</span>
          <span className="topbar-brand-name">Encuestas</span>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Acciones derecha */}
        <div className="topbar-actions">
      <button
        id="btn-notifications"
        className="topbar-action-btn relative"
        aria-label="Notificaciones"
        aria-expanded={notificationsOpen}
        onClick={(e) => { e.stopPropagation(); onToggleNotifications() }}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadNotifications > 0 ? (
          // show numeric badge for unread notifications (matches what the panel shows)
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-semibold leading-none text-white bg-red-600 rounded-full border-2 border-white dark:border-gray-900">
            {unreadNotifications > 99 ? '99+' : String(unreadNotifications)}
          </span>
        ) : pendingResponses > 0 ? (
          // fallback: show pending (unresponded) surveys count when no unread notifications
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-semibold leading-none text-white bg-red-600 rounded-full border-2 border-white dark:border-gray-900">
            {pendingResponses > 99 ? '99+' : String(pendingResponses)}
          </span>
        ) : (
          <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-900 opacity-0" />
        )}
      </button>

      

      <div className="user-chip-wrapper" ref={chipMenuRef}>
        <button
          className="user-chip"
          onClick={() => setChipMenuOpen(v => !v)}
          aria-haspopup="true"
          aria-expanded={chipMenuOpen}
          aria-label="Menú de usuario"
        >
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="Avatar" className="user-avatar user-avatar-photo" />
          ) : (
            <div className="user-avatar placeholder">{avatarInitials}</div>
          )}
          <span className="user-chip-name">{roleLabel}</span>
          <span className={`material-symbols-outlined user-chip-chevron${chipMenuOpen ? ' open' : ''}`}>expand_more</span>
        </button>

        {chipMenuOpen && (
          <div className="chip-dropdown" role="menu">
            <button
              className="chip-dropdown-item"
              role="menuitem"
              onClick={() => { setChipMenuOpen(false); setProfileOpen(true) }}
            >
              <span className="material-symbols-outlined">manage_accounts</span>
              Perfil
            </button>
          </div>
        )}
      </div>

      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        userId={userId}
        onSave={(data) => {
          setProfile(data)
          window.dispatchEvent(new CustomEvent('profile:updated', { detail: data }))
        }}
      />
        </div>{/* end topbar-actions */}
    </div>
    </>
  )
}
