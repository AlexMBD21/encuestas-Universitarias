import React, { useEffect, useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import surveyHelpers from '../../services/surveyHelpers'
import supabaseClient from '../../services/supabaseClient'
import AuthAdapter from '../../services/AuthAdapter'
import { useAuth } from '../../services/AuthContext'
import { loadProfile, loadProfileAsync } from '../components/ProfileModal'
import { CalendarWidget, CalendarEvent } from '../components/CalendarWidget'
import '../styles/dashboard-profesor.css'
import { DashboardStatCardsSkeleton, DashboardNoticesSkeleton } from '../../components/ui/DashboardSkeleton'

export default function Dashboard() {
  const navigate = useNavigate()
  const [showDebugPanel, setShowDebugPanel] = useState<boolean>(() => {
    try { return !!(typeof window !== 'undefined' && window.location && window.location.search && window.location.search.indexOf('debug=1') >= 0) } catch (e) { return false }
  })
  const [calificadasCount, setCalificadasCount] = useState<number>(0)
  const [surveys, setSurveys] = useState<any[]>([])
  const [surveysLoaded, setSurveysLoaded] = useState(false)
  const [surveyReports, setSurveyReports] = useState<any[]>([])
  const [activeCount, setActiveCount] = useState<number>(0)
  const [notifications, setNotifications] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<any | null>(() => AuthAdapter.getUser())
  const userId = currentUser?.id || currentUser?.email || null
  const [profileName, setProfileName] = useState<string>(() => loadProfile(userId).displayName)
  const { user: authUser } = useAuth()
  const isAdmin = !!(authUser && String((authUser as any).role || '').toLowerCase() === 'admin')

  useEffect(() => {
    setProfileName(loadProfile(userId).displayName)
    loadProfileAsync(userId).then(p => setProfileName(p.displayName))
  }, [userId])

  const supabaseEnabledNow = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
  const backendEnabled = supabaseEnabledNow
  const dataClientNow: any = supabaseClient

  useEffect(() => {
    const onAuth = () => { try { setCurrentUser(AuthAdapter.getUser()) } catch (e) {} }
    const onProfile = (e: any) => { try { setProfileName((e as CustomEvent).detail?.displayName || '') } catch (e) {} }
    try { window.addEventListener('auth:changed', onAuth as EventListener) } catch (e) {}
    try { window.addEventListener('profile:updated', onProfile as EventListener) } catch (e) {}
    return () => {
      try { window.removeEventListener('auth:changed', onAuth as EventListener) } catch (e) {}
      try { window.removeEventListener('profile:updated', onProfile as EventListener) } catch (e) {}
    }
  }, [])

  const [userResponsesByUser, setUserResponsesByUser] = useState<Record<string, any[]>>({})
  const [liveSimpleSatisfaction, setLiveSimpleSatisfaction] = useState<number | null>(null)
  const [liveProjectSatisfaction, setLiveProjectSatisfaction] = useState<number | null>(null)
  const [liveSimpleResponses, setLiveSimpleResponses] = useState<number | null>(null)
  const [liveProjectResponses, setLiveProjectResponses] = useState<number | null>(null)

  useEffect(() => {
    try {
      if ((window as any).initializeDashboard) (window as any).initializeDashboard()
    } catch (e) { /* noop */ }

    let unsubSurveys: (() => void) | null = null
    let unsubReports: (() => void) | null = null

    const attachFallback = () => {
      // localStorage fallback removed for data; show empty lists when DB not available
      setSurveys([])
      setActiveCount(0)
      setSurveyReports([])
      setSurveysLoaded(true)
    }

    const setupRealtime = () => {
      try {
        unsubSurveys = (dataClientNow as any).listenSurveys((arr: any[]) => {
          console.debug('[Dashboard] listenSurveys ->', arr)
          setSurveys(arr)
          setActiveCount(Array.isArray(arr) ? arr.filter(a => a.published).length : 0)
          setSurveysLoaded(true)
        })
        unsubReports = (dataClientNow as any).listenSurveyReports((arr: any[]) => {
          try {
            const filtered = Array.isArray(arr) ? arr.filter((r: any) => {
              if (!r) return false
              if (r.isPublicReport === true) return false
              if (r.reportType && String(r.reportType).toLowerCase() === 'public') return false
              return true
            }) : []
            setSurveyReports(filtered)
          } catch (e) {
            console.error('filtering surveyReports failed (dashboard)', e)
            setSurveyReports(arr || [])
          }
        })
      } catch (e) {
        console.error('realtime attach error', e)
        attachFallback()
      }
    }

    if (backendEnabled) setupRealtime()
    else attachFallback()

    // Listen to surveys:updated custom event so the Dashboard refreshes
    // when a survey is created/edited (Supabase Realtime postgres_changes may be
    // disabled or slow in some environments).
    const onSurveysUpdated = (ev: any) => {
      // Optimistic: if the event carries the survey object, insert/update immediately
      try {
        const detail = ev && ev.detail
        if (detail && detail.survey) {
          const sv = detail.survey
          setSurveys(prev => {
            const copy = Array.isArray(prev) ? [...prev] : []
            const idx = copy.findIndex((s: any) => String(s.id) === String(sv.id))
            const next = idx >= 0 ? copy.map((s: any) => String(s.id) === String(sv.id) ? sv : s) : [...copy, sv]
            setActiveCount(next.filter((a: any) => a.published).length)
            return next
          })
        }
      } catch (e) {}
      // Then sync from server
      if (!backendEnabled) return
      try {
        dataClientNow.getSurveysOnce().then((arr: any[]) => {
          setSurveys(arr)
          setActiveCount(Array.isArray(arr) ? arr.filter((a: any) => a.published).length : 0)
          setSurveysLoaded(true)
        }).catch(() => {})
      } catch (e) {}
    }
    window.addEventListener('surveys:updated', onSurveysUpdated as EventListener)

    return () => {
      try { if (unsubSurveys) unsubSurveys() } catch (e) {}
      try { if (unsubReports) unsubReports() } catch (e) {}
      window.removeEventListener('surveys:updated', onSurveysUpdated as EventListener)
    }
  }, [])

  // Re-fetch survey reports when auth session is restored (avoids empty reports on page reload
  // caused by race condition: listenSurveyReports runs before Supabase restores the session)
  useEffect(() => {
    if (!currentUser) return
    try {
      const dataClient: any = supabaseClient
      if (dataClient && dataClient.isEnabled && dataClient.isEnabled() && dataClient.getSurveyReportsOnce) {
        dataClient.getSurveyReportsOnce().then((arr: any[]) => {
          try {
            const filtered = Array.isArray(arr) ? arr.filter((r: any) => {
              if (!r) return false
              if (r.isPublicReport === true) return false
              if (r.reportType && String(r.reportType).toLowerCase() === 'public') return false
              return true
            }) : []
            setSurveyReports(filtered)
          } catch (e) { setSurveyReports(arr || []) }
        }).catch(() => {})
      }
    } catch (e) {}
  }, [currentUser])

  // Auto-heal: fix surveys where owner_uid is missing/wrong so RLS policies work for reports
  useEffect(() => {
    if (!currentUser || !surveysLoaded || surveys.length === 0) return
    try {
      const dataClient: any = supabaseClient
      if (!dataClient || !dataClient.setSurvey) return
      const cur: any = currentUser
      const curUid = String(cur.id || cur.uid || '')
      const curEmail = String(cur.email || '')
      surveys.forEach((s: any) => {
        if (!s || !s.id) return
        const ownerEmail = String(s.ownerId || s.owner?.email || s.owner?.ownerId || '')
        const ownerUid = String(s.ownerUid || '')
        const isOwner = (curUid && ownerUid === curUid) ||
          (curEmail && ownerEmail && ownerEmail === curEmail) ||
          (curUid && String(s.ownerId || '') === curUid)
        if (isOwner && ownerUid !== curUid) {
          // Fix owner_uid silently so RLS EXISTS subquery works
          dataClient.setSurvey(s.id, { ...s, ownerUid: curUid }).catch(() => {})
        }
      })
    } catch (e) {}
  }, [currentUser, surveysLoaded, surveys])

  useEffect(() => {
    // systemNotices feature removed: keep notifications empty
    setNotifications([])
    return () => {}
  }, [])

  // load current user's responses (indexed by surveyId) so we can compute per-user totals
  useEffect(() => {
    let cancelled = false
    const loadUserResponses = async () => {
      try {
        const cur = currentUser || AuthAdapter.getUser()
        if (!cur || (!(cur as any).id && !(cur as any).uid)) {
          if (!cancelled) setUserResponsesByUser({})
          return
        }
        const uid = String((cur as any).id || (cur as any).uid)
        if (backendEnabled && dataClientNow && (dataClientNow as any).getUserResponsesByUser) {
          const map = await (dataClientNow as any).getUserResponsesByUser(uid).catch(() => ({}))
          if (!cancelled) setUserResponsesByUser(map || {})
          return
        }
        if (!cancelled) setUserResponsesByUser({})
      } catch (e) {
        if (!cancelled) setUserResponsesByUser({})
      }
    }
    loadUserResponses()
    return () => { cancelled = true }
  }, [currentUser])

  // Recalculate 'calificadasCount' whenever surveys change
  useEffect(() => {
    let cancelled = false
    const loadCount = async () => {
      try {
        if (!Array.isArray(surveys) || surveys.length === 0) {
          if (!cancelled) setCalificadasCount(0)
          return
        }
        // consider only published (activas)
        const published = surveys.filter(s => !!s.published)
        if (published.length === 0) { if (!cancelled) setCalificadasCount(0); return }

        // use already-loaded per-user responses (if any)
        const cur = currentUser || AuthAdapter.getUser()
        const userResponsesMap: Record<string, any[]> = userResponsesByUser || {}

        const checks = await Promise.all(published.map(async (s) => {
          try {
            // Prefer metadata if present to avoid extra reads
            const metaIndicatesGraded = (() => {
              try {
                if (!s) return false
                if (s.graded || s.graded === true) return true
                if (s.gradedAt || s.calificadaAt) return true
                if (s.calificada || s.calificada === true) return true
                if (typeof s.responsesCount === 'number' && s.responsesCount > 0) return true
                if (typeof s.responses === 'number' && s.responses > 0) return true
                if (s.projects && Array.isArray(s.projects)) {
                  const allMarked = s.projects.length > 0 && s.projects.every((p: any) => p && p.graded === true)
                  if (allMarked) return true
                }
                return false
              } catch (e) { return false }
            })()
            if (metaIndicatesGraded) return true

            // Determine ownership (normalize ownerId if necessary)
            const normalize = (v: any) => (v === null || v === undefined) ? null : String(v).trim().toLowerCase()
            let ownerIdRaw: any = s && s.ownerId ? s.ownerId : null
            if (ownerIdRaw && typeof ownerIdRaw === 'object') {
              ownerIdRaw = ownerIdRaw.ownerId || ownerIdRaw.id || ownerIdRaw.email || ownerIdRaw.userId || ownerIdRaw.owner || null
            }
            const ownerNormalized = ownerIdRaw ? normalize(ownerIdRaw) : null
            const curSet = new Set<string>()
            try {
              if (cur) {
                const nEmail = normalize((cur as any).email)
                const nId = normalize((cur as any).id)
                const nUserId = normalize((cur as any).userId)
                if (nEmail) curSet.add(nEmail)
                if (nId) curSet.add(nId)
                if (nUserId) curSet.add(nUserId)
              }
            } catch (e) {}
            const isOwner = ownerNormalized ? Array.from(curSet).some(x => x === ownerNormalized) : false

            // Prefer to evaluate 'calificada' based on the logged-in user's responses
            const isProject = s.type === 'project' || (s.projects && (s.projects.length > 0)) || (s.rubric && (s.rubric.length > 0))
            try {
              const uId = cur && (cur as any).id ? String((cur as any).id) : null
              if (uId && userResponsesMap) {
                // support keys as string/number variants
                const keyCandidates = [String(s.id), String(Number(s.id)), s.id]
                let ur: any[] = []
                for (const k of keyCandidates) {
                  if (k && userResponsesMap[k]) { ur = userResponsesMap[k]; break }
                }
                ur = Array.isArray(ur) ? ur : []
                if (isProject) {
                  const totalProjects = (s.projects || []).length || 0
                  if (totalProjects <= 0) return false
                  const projectIds = new Set<string>()
                  for (const r of ur) {
                    try { if (r && r.projectId) projectIds.add(String(r.projectId)) } catch (e) {}
                  }
                  return projectIds.size >= totalProjects
                }
                return ur.length > 0
              }
            } catch (e) {}

            // If there is no authenticated user or no per-user responses, treat as not-graded for this user
            return false
          } catch (e) { return false }
        }))

        const count = (checks || []).filter(Boolean).length
        if (!cancelled) setCalificadasCount(count)
      } catch (e) {
        if (!cancelled) setCalificadasCount(0)
      }
    }
    loadCount()
    return () => { cancelled = true }
  }, [surveys, currentUser])

  

  // build list: only relevant survey reports for the current user
  const noticesToShow = React.useMemo(() => {
    try {
      const cur = currentUser || AuthAdapter.getUser()
      const normalize = (v: any) => (v === null || v === undefined) ? null : String(v).trim().toLowerCase()
      const curCandidates = new Set<string>()
      if (cur) {
        if (cur.email) curCandidates.add(normalize(cur.email) || '')
        if (cur.id) curCandidates.add(normalize(cur.id) || '')
        if ((cur as any).uid) curCandidates.add(normalize((cur as any).uid) || '')
      }

      const reportNotices = Array.isArray(surveyReports) ? surveyReports.map((r: any) => {
        try {
          const s = Array.isArray(surveys) ? surveys.find(x => String(x.id) === String(r.surveyId)) : null
          // Skip orphaned reports whose survey was already deleted
          if (!s) return null
          // Admin sees all reports regardless of ownership
          if (isAdmin) return { report: r, survey: s }
          // Check ownerUid first (Supabase UUID stored in owner_uid column), then fallback to ownerId
          let ownerIdRaw: any = s ? (s.ownerUid || s.ownerId || null) : null
          if (ownerIdRaw && typeof ownerIdRaw === 'object') {
            ownerIdRaw = ownerIdRaw.ownerUid || ownerIdRaw.ownerId || ownerIdRaw.id || ownerIdRaw.email || ownerIdRaw.userId || ownerIdRaw.owner || null
          }
          const ownerNormalized = ownerIdRaw ? normalize(ownerIdRaw) : null

          const curSet = new Set<string>(Array.from(curCandidates))
          const addCandidate = (v: any) => { const n = normalize(v); if (n) curSet.add(n) }
              try {
                if (cur) {
                  addCandidate(cur.email)
                  addCandidate(cur.id)
                  addCandidate((cur as any).uid)
                  addCandidate((cur as any).username)
                  addCandidate((cur as any).userId)
                  addCandidate((cur as any).code)
                  addCandidate((cur as any).owner)
                  addCandidate((cur as any).name)
                }
              } catch (e) {}

          const isForCurrent = ownerNormalized ? Array.from(curSet).some(x => x === ownerNormalized) : false
          return isForCurrent ? { report: r, survey: s } : null
        } catch (e) { return null }
      }).filter(Boolean) : []

      // group reports by surveyId so we show one aggregated notice per survey
      const grouped: Record<string, any> = {}
      ;(reportNotices as any[]).forEach(x => {
        const r = x.report
        const s = x.survey
        const key = String(r && r.surveyId ? r.surveyId : (s && s.id ? s.id : 'unknown'))
        if (!grouped[key]) grouped[key] = { survey: s, count: 0, latest: r }
        grouped[key].count = (grouped[key].count || 0) + 1
        try {
          const prev = grouped[key].latest
          const ta = prev && prev.createdAt ? (typeof prev.createdAt === 'number' ? prev.createdAt : Date.parse(prev.createdAt || '') || 0) : 0
          const tb = r && r.createdAt ? (typeof r.createdAt === 'number' ? r.createdAt : Date.parse(r.createdAt || '') || 0) : 0
          if (tb >= ta) grouped[key].latest = r
        } catch (e) { grouped[key].latest = r }
      })

      const filteredReports = Object.keys(grouped).map(k => {
        const g = grouped[k]
        const r = g.latest
        const s = g.survey
        const surveyTitle = (s && (s.title || s.name)) || (r && (r.payload?.surveyTitle || r.surveyTitle || r.surveyName || r.title)) || 'Encuesta'
        const latestMsg = (r && (r.comment || r.message)) || ''
        const message = latestMsg ? `${latestMsg}` : `Hay ${g.count} reporte${g.count > 1 ? 's' : ''} en la encuesta "${surveyTitle}"`
        return {
          id: `report-${r.id}`,
          type: 'report',
          surveyTitle,
          title: `Reporte: ${surveyTitle}`,
          message,
          createdAt: r && r.createdAt ? r.createdAt : new Date().toISOString(),
          surveyId: r.surveyId,
          raw: r,
          count: g.count
        }
      })

      filteredReports.sort((a: any, b: any) => {
        const ta = (typeof a?.createdAt === 'number') ? a.createdAt : Date.parse(a?.createdAt || '') || 0
        const tb = (typeof b?.createdAt === 'number') ? b.createdAt : Date.parse(b?.createdAt || '') || 0
        return tb - ta
      })

      return filteredReports
    } catch (e) { return [] }
  }, [surveyReports, surveys, currentUser, isAdmin])

  const noticesRef = useRef<HTMLDivElement | null>(null)

  // measure first notice height and set CSS variable so max-height equals 2 notices
  useEffect(() => {
    const setHeight = () => {
      try {
        const el = noticesRef.current
        if (!el) return
        const first = el.querySelector('[data-notice-item]') as HTMLElement | null
        if (!first) return
        const h = Math.ceil(first.getBoundingClientRect().height)
        el.style.setProperty('--notice-h', `${h}px`)
      } catch (e) {}
    }
    setHeight()
    window.addEventListener('resize', setHeight)
    return () => { try { window.removeEventListener('resize', setHeight) } catch (e) {} }
  }, [noticesToShow])

  // Derived metrics for the summary cards
  const publishedSurveys = useMemo(() => {
    try { return Array.isArray(surveys) ? surveys.filter(s => !!s && !!s.published) : [] } catch (e) { return [] }
  }, [surveys])

  const isProjectSurvey = (s: any) => {
    try {
      if (!s) return false
      return s.type === 'project' || (s.projects && Array.isArray(s.projects) && s.projects.length > 0) || (s.rubric && Array.isArray(s.rubric) && s.rubric.length > 0)
    } catch (e) { return false }
  }

  const computeAvgForList = (list: any[]) => {
    try {
      if (!Array.isArray(list) || list.length === 0) return null
      let weighted = 0
      let weight = 0
      const keys = ['satisfaction','average','avgRating','avg','rating','overall','score','mean','avgScore']
      for (const s of list) {
        if (!s) continue
        let v: number | null = null
        for (const k of keys) {
          const cand = (s as any)[k]
          if (cand !== undefined && cand !== null && !isNaN(Number(cand))) { v = Number(cand); break }
        }
        if (v === null) continue
        let r = 0
        if (typeof s.responsesCount === 'number') r = s.responsesCount
        else if (typeof s.responses === 'number') r = s.responses
        else if (Array.isArray(s.responses)) r = s.responses.length
        else r = 1
        weighted += v * (r || 1)
        weight += (r || 1)
      }
      if (weight === 0) return null
      return +(weighted / weight).toFixed(1)
    } catch (e) { return null }
  }

  const simpleSatisfactionMeta = useMemo(() => computeAvgForList(publishedSurveys.filter(s => !isProjectSurvey(s))), [publishedSurveys])
  const projectSatisfactionMeta = useMemo(() => computeAvgForList(publishedSurveys.filter(s => isProjectSurvey(s))), [publishedSurveys])

  const computeCountForList = (list: any[]) => {
    try {
      if (!Array.isArray(list) || list.length === 0) return 0
      let total = 0
      for (const s of list) {
        if (!s) continue
        if (typeof s.responsesCount === 'number') total += s.responsesCount
        else if (typeof s.responses === 'number') total += s.responses
        else if (s.reportSummary && typeof s.reportSummary.totalResponses === 'number') total += s.reportSummary.totalResponses
        else if (Array.isArray(s.responses)) total += s.responses.length
      }
      return total
    } catch (e) { return 0 }
  }

  const simpleResponsesMeta = useMemo(() => computeCountForList(publishedSurveys.filter(s => !isProjectSurvey(s))), [publishedSurveys])
  const projectResponsesMeta = useMemo(() => computeCountForList(publishedSurveys.filter(s => isProjectSurvey(s))), [publishedSurveys])

  const myActiveCount = useMemo(() => {
    try {
      const cur = currentUser || AuthAdapter.getUser()
      if (!cur) return 0
      const norm = (v: any) => (v === null || v === undefined) ? null : String(v).trim().toLowerCase()
      const curSet = new Set<string>()
      try { const v = norm((cur as any).email); if (v) curSet.add(v) } catch (e) {}
      try { const v = norm((cur as any).id); if (v) curSet.add(v) } catch (e) {}
      try { const v = norm((cur as any).uid); if (v) curSet.add(v) } catch (e) {}
      try { const v = norm((cur as any).userId); if (v) curSet.add(v) } catch (e) {}
      return publishedSurveys.filter(s => {
        if (!s || !s.published) return false
        let owner: any = s.ownerUid || s.ownerId || (s.owner && (s.owner.ownerId || s.owner.id || s.owner.email)) || null
        if (owner === null || owner === undefined) return false
        owner = norm(owner)
        if (!owner) return false
        return Array.from(curSet).some(x => x === owner)
      }).length
    } catch (e) { return 0 }
  }, [publishedSurveys, currentUser])

  const myTotalResponses = useMemo(() => {
    try {
      const cur = currentUser || AuthAdapter.getUser()
      if (!cur) return 0
      const map = userResponsesByUser || {}
      const pubIds = new Set((publishedSurveys || []).map(s => String(s.id)))
      let tot = 0
      for (const sid of Object.keys(map || {})) {
        try {
          if (!pubIds.has(String(sid))) continue
          const arr = map[sid]
          if (!arr) continue
          tot += Array.isArray(arr) ? arr.length : Object.keys(arr).length
        } catch (e) {}
      }
      return tot
    } catch (e) { return 0 }
  }, [userResponsesByUser, publishedSurveys, currentUser])

  const totalResponses = useMemo(() => {
    try {
      if (!Array.isArray(publishedSurveys) || publishedSurveys.length === 0) return 0
      return publishedSurveys.reduce((acc: number, s: any) => {
        if (!s) return acc
        let val = 0
        if (typeof s.responsesCount === 'number') val = s.responsesCount
        else if (typeof s.responses === 'number') val = s.responses
        else if (Array.isArray(s.responses)) val = s.responses.length
        else if (s.reportSummary && typeof s.reportSummary.totalResponses === 'number') val = s.reportSummary.totalResponses
        return acc + (Number.isFinite(Number(val)) ? Number(val) : 0)
      }, 0)
    } catch (e) { return 0 }
  }, [surveys])

  const satisfactionAvg = useMemo(() => {
    try {
      if (!Array.isArray(publishedSurveys) || publishedSurveys.length === 0) return null
      let weighted = 0
      let weight = 0
      const keys = ['satisfaction','average','avgRating','avg','rating','overall','score','mean','avgScore']
      for (const s of publishedSurveys) {
        if (!s) continue
        let v: number | null = null
        for (const k of keys) {
          const cand = (s as any)[k]
          if (cand !== undefined && cand !== null && !isNaN(Number(cand))) { v = Number(cand); break }
        }
        if (v === null) continue
        let r = 0
        if (typeof s.responsesCount === 'number') r = s.responsesCount
        else if (typeof s.responses === 'number') r = s.responses
        else if (Array.isArray(s.responses)) r = s.responses.length
        else r = 1
        weighted += v * (r || 1)
        weight += (r || 1)
      }
      if (weight === 0) return null
      return +(weighted / weight).toFixed(1)
    } catch (e) { return null }
  }, [surveys])

  // Live async stats (override memo when available)
  const [liveTotalResponses, setLiveTotalResponses] = useState<number | null>(null)
  const [liveSatisfactionAvg, setLiveSatisfactionAvg] = useState<number | null>(null)
  const [statsLoading, setStatsLoading] = useState<boolean>(false)

  const extractNumericAnswers = (resp: any) => {
    const nums: number[] = []
    try {
      if (!resp) return nums
      // answersList (array) or answers (object)
      const al = resp.answersList || []
      if (Array.isArray(al) && al.length > 0) {
        for (const it of al) {
          try {
            if (!it) continue
            const v = it.value !== undefined ? it.value : (it.answer !== undefined ? it.answer : null)
            if (v === null || v === undefined) continue
            const n = Number(v)
            if (!isNaN(n)) nums.push(n)
          } catch (e) {}
        }
      }
      const amap = resp.answers || {}
      if (amap && typeof amap === 'object') {
        for (const k of Object.keys(amap)) {
          try {
            const v = (amap as any)[k]
            const n = Number(v)
            if (!isNaN(n)) nums.push(n)
          } catch (e) {}
        }
      }
      // some responses include top-level numeric fields
      const topKeys = ['overall', 'rating', 'score', 'avg', 'average']
      for (const k of topKeys) {
        try {
          const v = resp[k]
          if (v !== undefined && v !== null) {
            const n = Number(v)
            if (!isNaN(n)) nums.push(n)
          }
        } catch (e) {}
      }
    } catch (e) {}
    return nums
  }

  useEffect(() => {
    let cancelled = false
    const computeStats = async () => {
      try {
        if (!Array.isArray(publishedSurveys) || publishedSurveys.length === 0) {
          setLiveTotalResponses(0)
          setLiveSatisfactionAvg(null)
          setLiveSimpleSatisfaction(null)
          setLiveProjectSatisfaction(null)
          return
        }
        setStatsLoading(true)
        let total = 0
        let simpleTotal = 0
        let projectTotal = 0
        let numSumGlobal = 0
        let numCountGlobal = 0
        let numSumSimple = 0
        let numCountSimple = 0
        let numSumProject = 0
        let numCountProject = 0
        const toFetch: string[] = []

        const avgKeys = ['satisfaction','average','avgRating','avg','rating','overall','score','mean','avgScore']

        for (const s of publishedSurveys) {
          if (!s) continue
          const isProject = isProjectSurvey(s)
          // prefer explicit numeric counts
          let cnt: number | null = null
          if (typeof s.responsesCount === 'number') cnt = s.responsesCount
          else if (typeof s.responses === 'number') cnt = s.responses
          else if (s.reportSummary && typeof s.reportSummary.totalResponses === 'number') cnt = s.reportSummary.totalResponses
          else if (Array.isArray(s.responses)) cnt = s.responses.length

          if (cnt !== null) {
            total += cnt
            if (isProject) projectTotal += cnt
            else simpleTotal += cnt
          } else if (s.id) {
            toFetch.push(String(s.id))
          }

          // if survey exposes an average/overall, use it weighted by responses when available
          for (const k of avgKeys) {
            try {
              const cand = (s as any)[k]
              if (cand !== undefined && cand !== null && !isNaN(Number(cand))) {
                const weight = (typeof s.responsesCount === 'number') ? s.responsesCount : (typeof s.responses === 'number') ? s.responses : (cnt !== null ? cnt : 1)
                const w = (weight || 1)
                const n = Number(cand)
                numSumGlobal += n * w
                numCountGlobal += w
                if (isProject) { numSumProject += n * w; numCountProject += w } else { numSumSimple += n * w; numCountSimple += w }
                break
              }
            } catch (e) {}
          }
        }

        // fetch responses for published surveys missing metadata (batched)
        const concurrency = 4
        for (let i = 0; i < toFetch.length; i += concurrency) {
          const batch = toFetch.slice(i, i + concurrency)
          const results = await Promise.all(batch.map(id => (dataClientNow as any).getSurveyResponsesOnce(id).catch(() => [])))
          if (cancelled) return
          for (let idx = 0; idx < results.length; idx++) {
            const arr = Array.isArray(results[idx]) ? results[idx] : []
            const surveyId = batch[idx]
            const survey = publishedSurveys.find(s => String(s.id) === String(surveyId))
            const isProject = survey ? isProjectSurvey(survey) : false
            total += arr.length
            if (isProject) projectTotal += arr.length
            else simpleTotal += arr.length
            for (const r of arr) {
              try {
                const nums = (extractNumericAnswers(r) || []).filter((n: any) => typeof n === 'number' && !isNaN(n) && n >= 0 && n <= 5)
                if (!nums || nums.length === 0) continue
                const rAvg = nums.reduce((a: number, b: number) => a + b, 0) / nums.length
                // count one contribution per response
                numSumGlobal += rAvg
                numCountGlobal += 1
                if (isProject) { numSumProject += rAvg; numCountProject += 1 } else { numSumSimple += rAvg; numCountSimple += 1 }
              } catch (e) {}
            }
          }
        }

        const globalAvg = numCountGlobal > 0 ? +(numSumGlobal / numCountGlobal).toFixed(1) : null
        const simpleAvg = numCountSimple > 0 ? +(numSumSimple / numCountSimple).toFixed(1) : null
        const projectAvg = numCountProject > 0 ? +(numSumProject / numCountProject).toFixed(1) : null

        if (!cancelled) {
          setLiveTotalResponses(total)
          setLiveSatisfactionAvg(globalAvg)
          setLiveSimpleSatisfaction(simpleAvg)
          setLiveProjectSatisfaction(projectAvg)
          setLiveSimpleResponses(simpleTotal)
          setLiveProjectResponses(projectTotal)
        }
      } catch (e) {
        if (!cancelled) { setLiveTotalResponses(0); setLiveSatisfactionAvg(null) }
      } finally {
        if (!cancelled) setStatsLoading(false)
      }
    }
    computeStats()
    return () => { cancelled = true }
  }, [surveys])

  const displayTotalResponses = liveTotalResponses !== null ? liveTotalResponses : totalResponses
  const displaySatisfaction = liveSatisfactionAvg !== null ? liveSatisfactionAvg : satisfactionAvg
  const displaySimpleSatisfaction = liveSimpleSatisfaction !== null ? liveSimpleSatisfaction : simpleSatisfactionMeta
  const displayProjectSatisfaction = liveProjectSatisfaction !== null ? liveProjectSatisfaction : projectSatisfactionMeta
  const displaySimpleResponses = liveSimpleResponses !== null ? liveSimpleResponses : simpleResponsesMeta
  const displayProjectResponses = liveProjectResponses !== null ? liveProjectResponses : projectResponsesMeta

  const surveysWithAnyResponses = useMemo(() => {
    try {
      return (publishedSurveys || []).reduce((acc: number, s: any) => {
        try {
          if (!s) return acc
          let cnt = 0
          if (typeof s.responsesCount === 'number') cnt = s.responsesCount
          else if (typeof s.responses === 'number') cnt = s.responses
          else if (Array.isArray(s.responses)) cnt = s.responses.length
          else if (s.reportSummary && typeof s.reportSummary.totalResponses === 'number') cnt = s.reportSummary.totalResponses
          return acc + (cnt > 0 ? 1 : 0)
        } catch (e) { return acc }
      }, 0)
    } catch (e) { return 0 }
  }, [publishedSurveys])

  // precise counts computed from surveyResponses (only consider responses with submittedAt)
  const [surveyResponseSurveyCounts, setSurveyResponseSurveyCounts] = useState({ total: 0, simple: 0, project: 0, mine: 0 })
  const [summaryLoading, setSummaryLoading] = useState(true)
  useEffect(() => {
    let cancelled = false
    const compute = async () => {
      if (!cancelled) setSummaryLoading(true)
      try {
        if (!Array.isArray(publishedSurveys) || publishedSurveys.length === 0) {
          if (!cancelled && surveysLoaded) { setSurveyResponseSurveyCounts({ total: 0, simple: 0, project: 0, mine: 0 }); setSummaryLoading(false) }
          return
        }
        const cur = currentUser || AuthAdapter.getUser()
        const norm = (v: any) => (v === null || v === undefined) ? null : String(v).trim().toLowerCase()
        const curSet = new Set<string>()
        try { const v = norm((cur as any)?.email); if (v) curSet.add(v) } catch (e) {}
        try { const v = norm((cur as any)?.id); if (v) curSet.add(v) } catch (e) {}
        try { const v = norm((cur as any)?.uid); if (v) curSet.add(v) } catch (e) {}
        try { const v = norm((cur as any)?.userId); if (v) curSet.add(v) } catch (e) {}
        const ids = publishedSurveys.map(s => String(s.id))
        const concurrency = 4
        let simple = 0
        let project = 0
        let mine = 0
        for (let i = 0; i < ids.length; i += concurrency) {
          const batch = ids.slice(i, i + concurrency)
          const results = await Promise.all(batch.map(id => (dataClientNow as any).getSurveyResponsesOnce(id).catch(() => [])))
          if (cancelled) return
          for (let k = 0; k < results.length; k++) {
            try {
              const arr = Array.isArray(results[k]) ? results[k] : []
              // consider only responses that have submittedAt (finalized)
              const finalArr = arr.filter((r: any) => r && (r.submittedAt || r.submitted_at || r.submitted))
              if (!finalArr || finalArr.length === 0) continue
              const sid = batch[k]
              const survey = publishedSurveys.find(s => String(s.id) === String(sid))
              const isProject = survey ? (survey.type === 'project' || (survey.projects && Array.isArray(survey.projects) && survey.projects.length > 0) || (survey.rubric && Array.isArray(survey.rubric) && survey.rubric.length > 0)) : false
              if (isProject) project += 1
              else simple += 1
              if (survey) {
                let owner: any = survey.ownerUid || survey.ownerId || (survey.owner && (survey.owner.ownerId || survey.owner.id || survey.owner.email)) || null
                if (owner !== null && owner !== undefined) {
                  const ownerNorm = norm(owner)
                  if (ownerNorm && Array.from(curSet).some(x => x === ownerNorm)) mine += 1
                }
              }
            } catch (e) {}
          }
        }
        if (!cancelled) { setSurveyResponseSurveyCounts({ total: simple + project, simple, project, mine }); setSummaryLoading(false) }
      } catch (e) {
        if (!cancelled) { setSurveyResponseSurveyCounts({ total: 0, simple: 0, project: 0, mine: 0 }); setSummaryLoading(false) }
      }
    }
    compute()
    return () => { cancelled = true }
  }, [publishedSurveys, currentUser, surveysLoaded])

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const calendarEvents = useMemo(() => {
    const evs: CalendarEvent[] = [];
    try {
      (publishedSurveys || []).forEach((s: any) => {
        if (s && s.createdAt) {
          const dt = new Date(s.createdAt);
          if (!isNaN(dt.getTime())) {
            const isProject = s.surveyType === 'project' || s.type === 'project' || String(s.title || '').toLowerCase().includes('proyecto');
            evs.push({
              id: `ev-surv-${s.id}`,
              type: 'survey',
              title: `Encuesta: ${s.title || s.name || 'Sin Título'}`,
              date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
              color: isProject ? 'bg-indigo-500' : 'bg-emerald-500'
            });
          }
        }
      });
    } catch(e) {}
    try {
      (noticesToShow || []).forEach((n: any) => {
        if (n && n.createdAt) {
          const dt = new Date(n.createdAt);
          if (!isNaN(dt.getTime())) {
            evs.push({
              id: `ev-not-${n.id}`,
              type: 'report',
              title: `Aviso: ${n.surveyTitle || n.title || 'Reporte'}`,
              date: `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`,
              color: 'bg-rose-500'
            });
          }
        }
      });
    } catch(e) {}
    return evs;
  }, [publishedSurveys, noticesToShow]);

  return (
    <div id="dashboard-view" className="layout-content-container flex flex-col max-w-full flex-1 pt-4 relative">
      {/* Welcome Section */}
      <div className="flex flex-wrap justify-between items-start gap-3 px-4 py-0.5 relative z-10">
        <div>
          <h1 className="text-slate-900 dark:text-slate-50 text-2xl md:text-3xl font-black leading-tight tracking-[-0.033em] mb-1">
            {profileName ? (
              <>
                ¡Bienvenido de nuevo,{' '}
                <span className="block sm:inline text-blue-600 dark:text-blue-400">{profileName}!</span>
              </>
            ) : '¡Bienvenido de nuevo!'}
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-sm mt-1 max-w-xl">Revisa el estado de tus campañas activas y las últimas métricas de satisfacción recolectadas hoy.</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 pt-2">
        <div className="bg-white/90 dark:bg-slate-900/90 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 sm:p-8 md:p-10 shadow-lg transition-shadow duration-300 w-full max-w-full">
          <div className="flex items-center gap-3 mb-6">
            <span className="material-symbols-outlined text-blue-500 text-2xl">bar_chart_4_bars</span>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Resumen rápido</h2>
          </div>
          {summaryLoading ? (
            <DashboardStatCardsSkeleton />
          ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 w-full">
            <li className="stat-card">
              <div className="stat-left"><span className="material-symbols-outlined stat-icon">insights</span></div>
              <div className="stat-body">
                <div className="stat-value">{activeCount}</div>
                <div className="stat-label">Encuestas activas</div>
              </div>
              <div className="stat-badge">ESTADÍSTICAS</div>
              <div className="stat-subs">
                <div className="stat-sub"><span className="stat-sub-dot" style={{background:'#0ea5e9'}}></span><span>Tus activas: <strong>{myActiveCount}</strong></span></div>
              </div>
            </li>
            <li className="stat-card">
              <div className="stat-left"><span className="material-symbols-outlined stat-icon">grading</span></div>
              <div className="stat-body">
                <div className="stat-value">{surveyResponseSurveyCounts.total}</div>
                <div className="stat-label">Calificadas globalmente</div>
              </div>
              <div className="stat-badge">GLOBAL</div>
              <div className="stat-subs">
                <div className="stat-sub"><span className="stat-sub-dot" style={{background:'#3b82f6'}}></span><span>Encuestas calificadas: <strong>{myTotalResponses}</strong></span></div>
                <div className="stat-sub"><span className="stat-sub-dot" style={{background:'#0ea5e9'}}></span><span>Tus encuestas calificadas: <strong>{surveyResponseSurveyCounts.mine}</strong></span></div>
              </div>
            </li>
            <li className="stat-card">
              <div className="stat-left"><span className="material-symbols-outlined stat-icon">emoji_emotions</span></div>
              <div className="stat-body">
                <div className="stat-value">{(displaySatisfaction !== null ? displaySatisfaction : 0)}/5</div>
                <div className="stat-label">Satisfacción promedio</div>
              </div>
              <div className="stat-badge">MÉTRICA</div>
              <div className="stat-subs">
                <div className="stat-sub"><span className="stat-sub-dot" style={{background:'#16a34a'}}></span><span>Simples: <strong>{surveyResponseSurveyCounts.simple}</strong></span></div>
                <div className="stat-sub"><span className="stat-sub-dot" style={{background:'#4f46e5'}}></span><span>Proyectos: <strong>{surveyResponseSurveyCounts.project}</strong></span></div>
              </div>
            </li>
          </ul>
          )}
        </div>
        
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-4 mt-4">
        {/* Avisos Importantes */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg flex flex-col lg:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-rose-500 text-2xl">assignment_late</span>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">Reportes de seguimiento</h2>
          </div>

          <div ref={noticesRef} className="flex flex-col gap-2 mb-4 notices-scroll custom-scrollbar">
              {!surveysLoaded ? (
                <DashboardNoticesSkeleton count={3} />
              ) : noticesToShow && noticesToShow.length > 0 ? (
              noticesToShow.map((n: any, idx: number) => {
                const type = (n.type || '').toLowerCase()
                const cls = type === 'warning' ? 'alert-thin alert-warning' : type === 'danger' || type === 'error' ? 'alert-thin alert-danger' : 'alert-thin alert-info'
                const icon = type === 'warning' ? 'warning' : (type === 'danger' || type === 'error' ? 'error' : 'info')
                // Custom rendering for report items: emphasize in red and show survey name
                if ((n.type || '').toLowerCase() === 'report') {
                  const titleText = n.title || (n.raw && n.raw.surveyTitle) || 'Reporte de encuesta'
                  const messageText = n.message || `Hay un reporte en la encuesta "${titleText}"`
                  return (
                    <div data-notice-item key={`${n.id || idx}-${idx}`} className="notice-item notice-item--report" onClick={() => {
                      try {
                        if (n && n.surveyId) {
                          navigate('/profesor/encuestas', { state: { openSurveyId: String(n.surveyId), openReports: true, openReportId: n.raw && n.raw.id ? String(n.raw.id) : undefined } })
                          return
                        }
                      } catch (e) {}
                    }}>
                      <div className="notice-item__icon notice-item__icon--report">
                        <span className="material-symbols-outlined">error</span>
                      </div>
                      <div className="notice-item__body">
                        <div className="notice-item__title-row">
                          <span className="notice-item__title">{titleText}</span>
                          {n.count && n.count > 1 && (
                            <span className="notice-item__count">{n.count}</span>
                          )}
                        </div>
                        <div className="notice-item__message">{messageText}</div>
                        {n.createdAt && <div className="notice-item__date">{new Date(n.createdAt).toLocaleString()}</div>}
                      </div>
                      <svg className="notice-item__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  )
                }
                return (
                  <div
                    data-notice-item
                    key={`${n.id || idx}-${idx}`}
                    onClick={() => {
                      try {
                        if (n && n.type === 'report' && n.surveyId) {
                          navigate('/profesor/encuestas', { state: { openSurveyId: String(n.surveyId), openReports: true, openReportId: n.raw && n.raw.id ? String(n.raw.id) : undefined } })
                          return
                        }
                        if (n && n.surveyId) {
                          navigate('/profesor/encuestas', { state: { openSurveyId: String(n.surveyId), openSurveyKind: 'view' } })
                          return
                        }
                      } catch (e) {}
                    }}
                    className={`notice-item notice-item--${type || 'info'}`}
                  >
                    <div className={`notice-item__icon notice-item__icon--${type || 'info'}`}>
                      <span className="material-symbols-outlined">{icon}</span>
                    </div>
                    <div className="notice-item__body">
                      <span className="notice-item__title">{n.title || 'Aviso'}</span>
                      <span className="notice-item__message">{n.message}</span>
                      {n.createdAt && <span className="notice-item__date">{new Date(n.createdAt).toLocaleString()}</span>}
                    </div>
                    <svg className="notice-item__chevron" width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                )
              })
            ) : surveysLoaded ? (
              <p style={{color:'#94a3b8', fontSize:'0.95rem', textAlign:'center', padding:'24px 0'}}>Sin reportes de seguimiento.</p>
            ) : null}
          </div>

          {/* Notificaciones feature removed; no 'Ver todo' link */}
        </div>

        

        {/* Accesos Directos (rediseñado) */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-lg flex flex-col lg:row-start-1">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-4 flex items-center gap-2"><span className="material-symbols-outlined text-primary">quick_reference_all</span> Accesos rápidos</h3>
          <div className="flex flex-col gap-3 quick-actions">
            <button
              type="button"
              aria-label="Nueva encuesta simple"
              onClick={() => navigate('/profesor/encuestas', { state: { openCreate: true, initialType: 'simple' } })}
              className="quick-action-card qa-green"
            >
              <div className="qa-left">
                <div className="qa-icon-circle">
                  <span className="material-symbols-outlined">add</span>
                </div>
              </div>
              <div className="qa-body">
                <div className="qa-title">Nueva encuesta simple</div>
                <div className="qa-subtitle">Creación inmediata de formulario</div>
              </div>
              <div className="qa-right">
                <span className="material-symbols-outlined qa-chevron">arrow_forward_ios</span>
              </div>
            </button>

            <button
              type="button"
              aria-label="Crear proyecto de calificación"
              onClick={() => navigate('/profesor/encuestas', { state: { openCreate: true, initialType: 'project' } })}
              className="quick-action-card qa-blue"
            >
              <div className="qa-left">
                <div className="qa-icon-circle">
                  <span className="material-symbols-outlined">military_tech</span>
                </div>
              </div>
              <div className="qa-body">
                <div className="qa-title">Crear proyecto de calificación</div>
                <div className="qa-subtitle">Gestión avanzada de evaluaciones</div>
              </div>
              <div className="qa-right">
                <span className="material-symbols-outlined qa-chevron">arrow_forward_ios</span>
              </div>
            </button>
          </div>
        </div>

        
      </div>
      
      {/* Botón flotante derecho (siempre visible incluso al scrollear) */}
      {!isCalendarOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed right-0 z-[200] flex items-center" style={{ top: 'calc(var(--topbar-height) + 24px)' }}>
          <button
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className="group flex items-center justify-center pl-3 pr-4 py-3 text-white shadow-[-8px_0_20px_rgba(0,0,0,0.12)] rounded-l-2xl transition-all duration-500 ease-in-out border-y border-l border-white/20 active:scale-95"
            style={{ 
              background: 'var(--color-primary)',
              backdropFilter: 'blur(8px)'
            }}
            title="Abrir Calendario"
          >
            <span className="material-symbols-outlined text-xl drop-shadow-sm">calendar_month</span>
            <span className="overflow-hidden whitespace-nowrap max-w-0 opacity-0 group-hover:max-w-[120px] group-hover:opacity-100 group-hover:ml-3 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] font-semibold text-sm tracking-wide">
              Calendario
            </span>
          </button>
        </div>,
        document.body
      )}

      {isCalendarOpen && (
        <CalendarWidget 
          events={calendarEvents} 
          onClose={() => setIsCalendarOpen(false)} 
        />
      )}

    </div>
  )
}
