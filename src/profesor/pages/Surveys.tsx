import React, { useEffect, useState, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useLocation } from 'react-router-dom'
const CreateSurvey = React.lazy(() => import('./CreateSurvey'))
const ViewSurvey = React.lazy(() => import('./ViewSurvey'))
const RateProject = React.lazy(() => import('./RateProject'))
import surveyHelpers from '../../services/surveyHelpers'
import AuthAdapter from '../../services/AuthAdapter'
import supabaseClient from '../../services/supabaseClient'
import ScrollFloatingButton from '../components/ScrollFloatingButton'
import { useSurveysData } from '../hooks/useSurveysData'

import { useNavigate } from 'react-router-dom';

import { Dropdown as FilterDropdown } from '../../components/ui/Dropdown';

import { EvaluatorAssignmentModal as EvaluatorModalContent } from '../components/surveys/EvaluatorAssignmentModal';
import { ManageCategoriesModal } from '../components/surveys/ManageCategoriesModal';
import { GenerateLinkModal } from '../components/surveys/GenerateLinkModal';
import { GenerateSatisfaccionLinkModal } from '../components/surveys/GenerateSatisfaccionLinkModal';
import { SatisfaccionResultsModal } from '../components/surveys/SatisfaccionResultsModal';
import { SurveyGridSkeleton } from '../../components/ui/SurveyCardSkeleton';
import Loader from '../../components/Loader';
import { toast } from '../../components/ui/Toast';
import { Modal } from '../../components/ui/Modal';
import ButtonLoader from '../../components/ButtonLoader';
import { getSatisfaccionTokensBySurveyId } from '../../services/satisfaccion.service';

export default function Surveys(): JSX.Element {
  const location = useLocation()
  const {
    surveys, setSurveys, surveysLoaded,
    surveyReports, setSurveyReports, reportsLoaded,
    ratedMap, setRatedMap, globalRatedMap, setGlobalRatedMap,
    toastMessage, setToastMessage, ownerEmailMap, evaluatorUsers,
    currentUser, currentUserId, authUser, authLoading, isAdmin, userAsignatura,
    isOwnerOf, getOwnerDisplay
  } = useSurveysData()
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editSurvey, setEditSurvey] = useState<any | null>(null)
  const [createInitialType, setCreateInitialType] = useState<'simple' | 'project' | undefined>(undefined)
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmDeleting, setConfirmDeleting] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState<null | { id: string, action: 'publish' | 'unpublish' }>(null)
  const [confirmPublishing, setConfirmPublishing] = useState(false)
  const [manageCategoriesId, setManageCategoriesId] = useState<string | null>(null)
  const [manageCategoriesList, setManageCategoriesList] = useState<string[]>([])
  const [confirmReportId, setConfirmReportId] = useState<string | null>(null)
  const [reportComment, setReportComment] = useState<string>('')
  const [confirmReporting, setConfirmReporting] = useState(false)
  const [viewReportsFor, setViewReportsFor] = useState<string | null>(null)
  const [isReportsVisible, setIsReportsVisible] = useState(false)
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null)
  const [isConfirmReportVisible, setIsConfirmReportVisible] = useState(false)
  const [reportSearch, setReportSearch] = useState<string>('')
  const [reportUserFilter, setReportUserFilter] = useState<string>('all')
  // satisfaction tokens map: { [surveyId]: token[] }
  const [satisfaccionTokensMap, setSatisfaccionTokensMap] = useState<Record<string, any[]>>({})
  const [generateSatisfaccionLinkSurveyId, setGenerateSatisfaccionLinkSurveyId] = useState<string | null>(null)
  const [confirmDeactivateSatisfaccionLinkSurveyId, setConfirmDeactivateSatisfaccionLinkSurveyId] = useState<string | null>(null)
  const [viewSatisfaccionResultsSurveyId, setViewSatisfaccionResultsSurveyId] = useState<string | null>(null)

  // Load satisfaction tokens for every simple survey I own
  useEffect(() => {
    // Load satisfaction tokens for every simple survey I own
    const simpleOwned = surveys.filter(
      (s: any) => s.type !== 'project' && isOwnerOf(s) && !String(s.id).startsWith('sys_')
    )
    if (!simpleOwned.length) return
    simpleOwned.forEach(async (s: any) => {
      try {
        const tokens = await getSatisfaccionTokensBySurveyId(String(s.id))
        setSatisfaccionTokensMap(prev => ({ ...prev, [String(s.id)]: tokens }))
      } catch (e) { /* silently ignore */ }
    })
  }, [surveys, isOwnerOf])

  useEffect(() => {
    if (viewReportsFor) setTimeout(() => setIsReportsVisible(true), 50)
    else setIsReportsVisible(false)
  }, [viewReportsFor])

  const closeReportsModal = () => {
    setViewReportsFor(null)
    setHighlightedReportId(null)
    setReportSearch('')
    setReportUserFilter('all')
    setPullDownY(0)
  }

  const [isCreateVisible, setIsCreateVisible] = useState(false)

  useEffect(() => {
    if (createModalOpen) setTimeout(() => setIsCreateVisible(true), 50)
    else setIsCreateVisible(false)
  }, [createModalOpen])

  const closeCreateModal = () => {
    setCreateModalOpen(false)
  }

  const [titleSearch, setTitleSearch] = useState<string>('')
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'published' | 'unpublished' | 'reported'>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [expandedTitles, setExpandedTitles] = useState<Set<string>>(new Set())

  const toggleTitleExpansion = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setExpandedTitles(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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

  const [showOnlyPending, setShowOnlyPending] = useState(false)
  const [modalSurveyId, setModalSurveyId] = useState<string | null>(null)
  const [isModalVisible, setIsModalVisible] = useState(false)

  // Control center states
  const [manageAccessSurveyId, setManageAccessSurveyId] = useState<string | null>(null)
  const [generateLinkSurveyId, setGenerateLinkSurveyId] = useState<string | null>(null)

  useEffect(() => {
    if (confirmReportId) {
      const prevOverflow = document.body.style.overflow
      const prevTouchAction = document.body.style.touchAction
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
      const t = setTimeout(() => setIsConfirmReportVisible(true), 50);
      return () => {
        clearTimeout(t)
        document.body.style.overflow = prevOverflow
        document.body.style.touchAction = prevTouchAction
      }
    } else {
      setIsConfirmReportVisible(false);
    }
  }, [confirmReportId]);



  const closeConfirmReportModal = useCallback(() => {
    setConfirmReportId(null)
    setReportComment('')
    setPullDownY(0)
  }, [])

  const [confirmDeactivateLinkSurveyId, setConfirmDeactivateLinkSurveyId] = useState<string | null>(null)

  const [modalKind, setModalKind] = useState<'view' | 'projects' | null>(null)
  const [viewingProjectId, setViewingProjectId] = useState<string | null>(null)
  const [viewingReadOnly, setViewingReadOnly] = useState<boolean>(false)

  useEffect(() => {
    const onOpen = (ev: any) => {
      try {
        const d = ev && ev.detail
        if (!d) return
        const id = d.surveyId || d.id
        const kind = d.kind || 'view'
        if (!id) return
        setModalSurveyId(String(id))
        setModalKind(kind === 'projects' ? 'projects' : 'view')
      } catch (e) { }
    }
    window.addEventListener('surveys:open', onOpen as EventListener)
    return () => window.removeEventListener('surveys:open', onOpen as EventListener)
  }, [])
  const [projectFilter, setProjectFilter] = useState<'all' | 'pending' | 'rated' | 'unassigned'>('all')
  const [projectSearch, setProjectSearch] = useState<string>('')
  const [projectCategory, setProjectCategory] = useState<string>('all')
  const modalRef = useRef<HTMLDivElement | null>(null)
  const reportsModalRef = useRef<HTMLDivElement | null>(null)
  const createModalRef = useRef<HTMLDivElement | null>(null)
  const manageCategoriesRef = useRef<HTMLDivElement | null>(null)
  const confirmReportRef = useRef<HTMLDivElement | null>(null)
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
      } catch (e) { }
    }
    window.addEventListener('scroll', onScrollResize, { passive: true })
    window.addEventListener('resize', onScrollResize)
    return () => { try { window.removeEventListener('scroll', onScrollResize); window.removeEventListener('resize', onScrollResize) } catch (e) { } }
  }, [menuOpenFor, surveys])
  // modal project-level filter removed: top-level 'Sin calificar' controls list filtering

  const closeModal = useCallback(() => {
    setModalSurveyId(null)
    setModalKind(null)
    setViewingProjectId(null)
    setViewingReadOnly(false)
    setPullDownY(0)
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
            try { history.replaceState({}, '', location.pathname) } catch (e) { }
          } catch (e) { }
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
              try { history.replaceState({}, '', location.pathname) } catch (e) { }
            } catch (e) { }
          }, 120)
        } catch (e) { }
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
              try { history.replaceState({}, '', location.pathname) } catch (e) { }
            } catch (e) { }
          }, 80)
        } catch (e) { }
      }
    } catch (e) { }
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

      // Load global rated projects for this survey (all evaluators, not just current user)
      const surveyIdStr = String(modalSurveyId)
        ; (async () => {
          try {
            const allResponses = await dataClientNow.getSurveyResponsesOnce(surveyIdStr)
            const ratedProjectIds = Array.from(
              new Set(
                (allResponses || []).map((r: any) => String(r.projectId || '')).filter(Boolean)
              )
            ) as string[]
            setGlobalRatedMap(prev => ({ ...prev, [surveyIdStr]: ratedProjectIds }))
          } catch (e) { /* non-fatal */ }
        })()

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
    const g = manageCategoriesRef.current;

    if (m) m.addEventListener('touchmove', handleTouchMove, options);
    if (r) r.addEventListener('touchmove', handleTouchMove, options);
    if (c) c.addEventListener('touchmove', handleTouchMove, options);
    if (g) g.addEventListener('touchmove', handleTouchMove, options);

    return () => {
      if (m) m.removeEventListener('touchmove', handleTouchMove);
      if (r) r.removeEventListener('touchmove', handleTouchMove);
      if (c) c.removeEventListener('touchmove', handleTouchMove);
      if (g) g.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isModalVisible, isReportsVisible, isCreateVisible, manageCategoriesId]);

  const navigate = useNavigate();
  return (
    <div id="surveys-root" className="min-h-screen bg-slate-100/80 dark:bg-[#0b1120] pb-20 transition-colors duration-300 relative">

      {/* Luces de Fondo Premium (Celestial Glass) — contenidas al área de contenido */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[80vw] max-w-[800px] h-[800px] bg-indigo-500/5 dark:bg-indigo-600/15 rounded-full blur-[120px]"></div>
        <div className="absolute top-[20%] right-[-10%] w-[60vw] max-w-[600px] h-[600px] bg-emerald-500/5 dark:bg-emerald-600/15 rounded-full blur-[120px]"></div>
      </div>

      {/* Header Surveys */}
      <div className="bg-white border-b border-slate-200 shadow-md relative z-10 rounded-b-3xl overflow-hidden">
        <div id="surveys-header-inner" className="px-5 sm:px-8 pt-8 pb-12 md:pt-12 md:pb-16 max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-8">
          <div className="animate-fade-in-up" id="surveys-header-text">
            <div id="surveys-header-title-row" className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/20 text-white shrink-0">
                <span className="material-symbols-outlined text-xl">assignment</span>
              </div>
              <h1 className="text-slate-900 dark:text-slate-50 text-2xl md:text-3xl font-black leading-tight tracking-[-0.033em]" style={{ margin: 0 }}>Encuestas</h1>
            </div>
            <p className="text-slate-500 text-sm md:text-base max-w-2xl" style={{ animationDelay: '50ms' }}>
              Crea o gestiona encuestas y proyectos. Captura y recolecta las respuestas y calificaciones que necesites de forma rápida.
            </p>
          </div>
          <div id="surveys-header-buttons" className="flex gap-3 shrink-0 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <button type="button" onClick={() => {
              if (!backendEnabled) { setToastMessage('No se puede crear: no hay servicio de datos configurado.'); setTimeout(() => setToastMessage(null), 3000); return }
              handleCreate()
            }} className={`btn btn-emerald ${!backendEnabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`} disabled={!backendEnabled}>
              <span className="material-symbols-outlined text-[18px]">add_circle</span> <span className="hidden sm:inline">Nueva</span> Opinión
            </button>
            <button type="button" onClick={() => {
              if (!backendEnabled) { setToastMessage('No se puede crear: no hay servicio de datos configurado.'); setTimeout(() => setToastMessage(null), 3000); return }
              setEditSurvey(null); setCreateInitialType('project'); setCreateModalOpen(true)
            }} className={`btn btn-indigo ${!backendEnabled ? 'opacity-50 grayscale cursor-not-allowed' : ''}`} disabled={!backendEnabled}>
              <span className="material-symbols-outlined text-[18px]">fact_check</span> <span className="hidden sm:inline">Calificar</span> Proyecto
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 md:-mt-8 relative z-20">

        {/* Barra de Filtros Premium */}
        <div id="surveys-filter-bar" className="bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-lg shadow-slate-300/50 rounded-2xl p-2 md:p-3 flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3 mb-8 animate-fade-in-up" style={{ animationDelay: '150ms' }}>

          {/* Buscador */}
          <div className="relative flex-1 min-w-0">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-800" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
            </div>
            <input
              type="text"
              value={titleSearch}
              onChange={e => setTitleSearch(e.target.value)}
              placeholder="Buscar por título..."
              className="block w-full pl-11 pr-10 py-3 bg-slate-50/50 border-0 text-slate-900 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors sm:text-sm shadow-inner"
            />
            {titleSearch && (
              <button type="button" onClick={() => setTitleSearch('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            )}
          </div>

          <div className="h-px md:h-10 w-full md:w-px bg-slate-200/60 hidden md:block" />

          {/* Filtros Auxiliares - Ahora apilados en móvil */}
          <div id="surveys-filter-chips" className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-3 w-full md:w-auto pb-0">

            {/* Checkbox Sin calificar */}
            <label id="surveys-filter-pending" className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl px-4 py-2.5 cursor-pointer transition-colors whitespace-nowrap shadow-sm">
              <input type="checkbox" checked={showOnlyPending} onChange={e => setShowOnlyPending(e.target.checked)} className="rounded text-slate-800 focus:ring-slate-600 w-4 h-4 cursor-pointer" />
              Sin calificar
            </label>

            {/* Select: Estado */}
            <FilterDropdown
              value={publishedFilter}
              label="Estado: Todas"
              icon="filter_list"
              options={[
                { id: 'all', label: 'Estado: Todas' },
                { id: 'published', label: 'Publicadas' },
                { id: 'unpublished', label: 'No publicadas' },
                ...(isAdmin || surveys.some(s => isOwnerOf(s) && surveyReports.some(r => String(r.surveyId) === String(s.id))) 
                  ? [{ id: 'reported', label: 'Reportadas' }] 
                  : [])
              ]}
              onChange={(val) => setPublishedFilter(val as any)}
            />

            {/* Select: Propietario */}
            {(() => {
              const uniqueOwners = Array.from(
                new Set(surveys.map(s => getOwnerDisplay(s)).filter(Boolean))
              ).sort()
              if (uniqueOwners.length === 0) return null
              return (
                <FilterDropdown
                  value={ownerFilter}
                  label="Cualquier propietario"
                  icon="person"
                  options={[
                    { id: 'all', label: 'Cualquier propietario' },
                    ...uniqueOwners.map(o => ({ id: o, label: o }))
                  ]}
                  onChange={(val) => setOwnerFilter(val)}
                />
              )
            })()}

            {/* Gestionar Categorías (Global para todos los usuarios) */}
            {authUser && (
              <button
                type="button"
                onClick={async () => {
                  const DEFAULT_CATS = ["Ingeniería de Software", "Sistemas", "Electrónica", "Otros"];
                  let cats = [];
                  try {
                    const sys = await (dataClientNow as any).getSurveyById('sys_settings_project_categories');
                    if (sys && Array.isArray(sys.rubric)) cats = sys.rubric;
                    else if (sys && Array.isArray(sys.allowed_categories)) cats = sys.allowed_categories;
                  } catch (e) {
                    console.error('Error fetching global categories:', e);
                  }

                  if (cats.length === 0) {
                    const firstProject = surveys.find(s => s.type === 'project');
                    cats = firstProject ? (firstProject.allowedCategories || firstProject.allowed_categories || []) : [];
                  }

                  setManageCategoriesList(Array.isArray(cats) && cats.length > 0 ? [...cats] : [...DEFAULT_CATS]);

                  setManageCategoriesId('sys_settings_project_categories');
                }}
                className="btn btn-primary shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all whitespace-nowrap shadow-sm active:scale-[0.98]"
                title="Gestionar categorías de proyectos"
              >
                <span className="material-symbols-outlined text-[18px]">category</span>
                Categorías
              </button>
            )}

            {/* Limpiar Filtros */}
            {(showOnlyPending || publishedFilter !== 'all' || ownerFilter !== 'all' || titleSearch.trim()) && (
              <button
                type="button"
                onClick={() => { setShowOnlyPending(false); setPublishedFilter('all'); setOwnerFilter('all'); setTitleSearch('') }}
                className="shrink-0 flex items-center justify-center p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-transparent hover:border-rose-100 active:scale-90"
                title="Limpiar filtros"
              >
                <span className="material-symbols-outlined text-[22px]">backspace</span>
              </button>
            )}
          </div>
        </div>


        {/* If the query param view=create, show inline CreateSurvey panel; if view=details show ViewSurvey */}
        {(() => {
          const view = new URLSearchParams(location.search).get('view')
          if (view === 'create') return <React.Suspense fallback={<SurveyGridSkeleton count={4} />}><CreateSurvey /></React.Suspense>
          if (view === 'details') return <React.Suspense fallback={<SurveyGridSkeleton count={4} />}><ViewSurvey /></React.Suspense>
          return null
        })()}

        <div className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          {/* Ocultamos el título "Encuestas guardadas" porque ya está explícito en la página y limpiamos el contenedor principal de la cuadrícula */}
          {!surveysLoaded ? (
            <SurveyGridSkeleton count={6} />
          ) : surveys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-900/20 border-2 border-dashed border-slate-300 dark:border-slate-700">
              <div className="w-20 h-20 mb-6 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-full flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-4xl">inventory_2</span>
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Aún no tienes encuestas</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
                Comienza a recopilar información valiosa. Crea tu primera campaña, ya sea una encuesta de opinión para recabar percepciones o un proyecto de calificación avanzada.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button type="button" onClick={() => handleCreate()} className="btn btn-emerald px-6">
                  <span className="material-symbols-outlined text-lg">add_circle</span> Encuesta de Opinión
                </button>
                <button type="button" onClick={() => { setEditSurvey(null); setCreateInitialType('project'); setCreateModalOpen(true) }} className="btn btn-indigo px-6">
                  <span className="material-symbols-outlined text-lg">fact_check</span> Proyecto
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
                  // filter system settings and internal records
                  if (s.type === 'system' || s.type === 'settings' || String(s.id).startsWith('sys_')) return false
                  // filter by reported state (exclusive)
                  if (publishedFilter === 'reported') {
                    // Only show reported surveys to the owner or admins
                    if (!isOwnerOf(s) && !isAdmin) return false
                    
                    const selfId = String(currentUserId || '').trim().toLowerCase()
                    const count = surveyReports.filter(r => {
                      try {
                        if (!r) return false
                        if (String(r.surveyId) !== String(s.id)) return false
                        const reporter = String(r.reporterId || r.reporterEmail || '').trim().toLowerCase()
                        // Admins see everything, owners see reports from others
                        return isAdmin || (reporter && reporter !== selfId)
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
                      const isOwnerOrAdmin = isOwnerOf(s) || isAdmin;
                      let filteredTotal = (allProjects || []).length;
                      if (!isOwnerOrAdmin) {
                        const currentUserEmail = String(currentUser?.email || currentUserId || '').trim().toLowerCase();
                        filteredTotal = (allProjects || []).filter((p: any) => {
                          if (!p) return false;
                          const evs = Array.isArray(p.evaluators) ? p.evaluators : (p.evaluator ? [p.evaluator] : []);
                          return evs.some((e: any) => e && String(e).trim().toLowerCase() === currentUserEmail);
                        }).length;
                      }
                      progress = { rated: userRatedArr.length, total: filteredTotal }
                      // fallback to server / helper computed progress only when user index is empty
                      if ((!progress || progress.rated === 0) && surveyHelpers.getProgressForUser) {
                        try { progress = surveyHelpers.getProgressForUser(String(s.id), (s.projects || []).length) } catch (e) { }
                      }
                      fullyRated = progress ? progress.rated >= progress.total && progress.total > 0 : false
                    }
                    const userRespondedLocal = Array.isArray(ratedMap[String(s.id)]) && ratedMap[String(s.id)].includes('__simple')
                    const userResponded = !isProjectType ? (userRespondedLocal || surveyHelpers.hasUserResponded(String(s.id))) : false
                    const firstPending = allProjects.find((p: any) => !surveyHelpers.hasUserRated(String(s.id), String(p.id)))
                    return (
                      <div key={s.id} id={`survey-${s.id}`} className={`group relative p-6 border rounded-[24px] flex flex-col justify-between shadow-sm hover:shadow-xl transform hover:-translate-y-1 transition duration-200 ease-out focus-within:ring-2 bg-white dark:bg-slate-900 ${isProjectType ? 'border-indigo-100 border-t-[6px] border-t-indigo-500 dark:border-indigo-900/50 hover:border-indigo-300 dark:hover:border-indigo-700/50 focus-within:ring-indigo-200' : 'border-emerald-100 border-t-[6px] border-t-emerald-500 dark:border-emerald-900/50 hover:border-emerald-300 dark:hover:border-emerald-700/50 focus-within:ring-emerald-200'}`}>


                        <div className="flex-1">
                          {/* Badges y status */}
                          <div className="flex flex-wrap items-center gap-1.5 mb-3 mt-1 pr-9">
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1 ${isProjectType ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800 border' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800 border'}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isProjectType ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-emerald-600 dark:bg-emerald-400'}`}></span>
                              {isProjectType ? 'Proyecto' : 'Opinión'}
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

                            {/* Satisfaction Progress (Simple Survey) */}
                            {(() => {
                              if (isProjectType || !isOwnerOf(s)) return null;
                              const tokens = satisfaccionTokensMap[String(s.id)] || [];
                              const respondidas = tokens.filter((t: any) => t.respondida === true).length;
                              const total = tokens.length;
                              if (total === 0) return null;
                              return (
                                <div className="mt-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 rounded-lg p-2.5">
                                  <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                                    <span>Progreso de satisfacción</span>
                                    <span className="font-bold">{respondidas} / {total}</span>
                                  </div>
                                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-emerald-500 h-1.5 transition-all duration-700 ease-out" style={{ width: `${total > 0 ? (respondidas / total) * 100 : 0}%` }}></div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Sección Satisfacción */}
                          {!isProjectType && isOwnerOf(s) && (
                            <div className={`mt-4 pt-3 border-t transition-colors rounded-xl max-w-full ${s.satisfaccionExpiresAt && new Date(s.satisfaccionExpiresAt) > new Date() ? 'border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10 p-3.5' : 'border-slate-100 dark:border-slate-800'}`}>
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex flex-col gap-2">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">SATISFACCIÓN</span>
                                    {s.satisfaccionExpiresAt && new Date(s.satisfaccionExpiresAt) > new Date() && (
                                      <span className="text-[11px] font-bold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                        <span className="material-symbols-outlined text-[15px]">calendar_month</span>
                                        Vence {new Date(s.satisfaccionExpiresAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                  {s.satisfaccionExpiresAt && new Date(s.satisfaccionExpiresAt) > new Date() && (
                                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black border shadow-sm self-start bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/50">
                                      <span className="w-1.5 h-1.5 rounded-full animate-pulse shadow-sm shrink-0 bg-emerald-500"></span>
                                      ACTIVO ({(() => {
                                        const diffDays = Math.floor((new Date(s.satisfaccionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                        const diffHrs = Math.floor(((new Date(s.satisfaccionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60)) % 24);
                                        return diffDays >= 1 ? `${diffDays}d ${diffHrs}h` : `${diffHrs}h`;
                                      })()})
                                    </div>
                                  )}
                                </div>

                                {s.satisfaccionExpiresAt && new Date(s.satisfaccionExpiresAt) > new Date() ? (
                                  <div className="flex flex-col gap-2 md:justify-end flex-1 w-full md:w-auto mt-1 md:mt-0">
                                    <div className="flex flex-col xs:flex-row items-center gap-2 w-full md:w-auto">
                                      <button type="button" onClick={() => {
                                        const link = window.location.origin + '/satisfaccion/votar/' + s.id + '?t=' + s.satisfaccionToken;
                                        if (navigator.clipboard && window.isSecureContext) {
                                          navigator.clipboard.writeText(link).then(() => {
                                            setToastMessage('Enlace copiado');
                                            setTimeout(() => setToastMessage(null), 3000);
                                          }).catch(() => fallback());
                                        } else { fallback(); }
                                        function fallback() {
                                          const ta = document.createElement('textarea'); ta.value = link; ta.style.position = 'fixed';
                                          document.body.appendChild(ta); ta.focus(); ta.select();
                                          try { document.execCommand('copy'); setToastMessage('Enlace copiado'); } catch { setToastMessage('Error'); }
                                          document.body.removeChild(ta); setTimeout(() => setToastMessage(null), 3000);
                                        }
                                      }} className="w-full xs:flex-1 flex items-center justify-center gap-2 text-[10px] font-black bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 shadow-sm px-3 py-2 rounded-xl transition-all active:scale-95 whitespace-nowrap" title="Copiar link de satisfacción">
                                        <span className="material-symbols-outlined text-[15px]">content_copy</span> Link
                                      </button>
                                      <button type="button"
                                        onClick={() => setConfirmDeactivateSatisfaccionLinkSurveyId(String(s.id))}
                                        className="w-full xs:flex-1 flex items-center justify-center gap-2 text-[10px] font-black bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700/50 shadow-sm text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 px-3 py-2 rounded-xl transition-all active:scale-95 whitespace-nowrap"
                                        title="Cerrar link">
                                        <span className="material-symbols-outlined text-[15px]">link_off</span> Cerrar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => setGenerateSatisfaccionLinkSurveyId(String(s.id))} className="text-[11px] bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 font-black shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap w-full md:w-auto mt-2 md:mt-0 active:scale-95">
                                    <span className="material-symbols-outlined text-[16px]">calendar_month</span> Definir Fecha
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {isProjectType && isOwnerOf(s) && (
                            <div className={`mt-4 pt-3 border-t transition-colors rounded-xl max-w-full ${s.linkExpiresAt && new Date(s.linkExpiresAt) > new Date() ? (isProjectType ? 'border-indigo-200/50 dark:border-indigo-800/50 bg-indigo-50/50 dark:bg-indigo-900/10 p-3.5' : 'border-emerald-200/50 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-900/10 p-3.5') : 'border-slate-100 dark:border-slate-800'}`}>
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex flex-col gap-2">
                                  <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Inscripción</span>
                                    {s.linkExpiresAt && new Date(s.linkExpiresAt) > new Date() && (
                                      <span className={`text-[11px] font-bold flex items-center gap-1 ${isProjectType ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        <span className="material-symbols-outlined text-[15px]">event</span>
                                        Vence {new Date(s.linkExpiresAt).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                  {s.linkExpiresAt && new Date(s.linkExpiresAt) > new Date() && (
                                    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-black border shadow-sm self-start ${isProjectType ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-200/50 dark:border-indigo-800/50' : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/50'}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-sm shrink-0 ${isProjectType ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
                                      ACTIVO ({(() => {
                                        const diffDays = Math.floor((new Date(s.linkExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                        const diffHrs = Math.floor(((new Date(s.linkExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60)) % 24);
                                        return diffDays >= 1 ? `${diffDays}d ${diffHrs}h` : `${diffHrs}h`;
                                      })()})
                                    </div>
                                  )}
                                </div>

                                {s.linkExpiresAt && new Date(s.linkExpiresAt) > new Date() ? (
                                  <div className="flex flex-col gap-2 md:justify-end flex-1 w-full md:w-auto mt-1 md:mt-0">
                                    <div className="flex flex-col xs:flex-row items-center gap-2 w-full md:w-auto">
                                      <button type="button" onClick={() => {
                                        const link = window.location.origin + '/inscripcion/' + s.linkToken;
                                        if (navigator.clipboard && window.isSecureContext) {
                                          navigator.clipboard.writeText(link).then(() => {
                                            setToastMessage('Enlace copiado');
                                            setTimeout(() => setToastMessage(null), 3000);
                                          }).catch(() => fallback());
                                        } else {
                                          fallback();
                                        }
                                        function fallback() {
                                          const textArea = document.createElement("textarea");
                                          textArea.value = link;
                                          textArea.style.position = "fixed";
                                          document.body.appendChild(textArea);
                                          textArea.focus();
                                          textArea.select();
                                          try {
                                            document.execCommand('copy');
                                            setToastMessage('Enlace copiado');
                                          } catch (err) {
                                            setToastMessage('Error');
                                          }
                                          document.body.removeChild(textArea);
                                          setTimeout(() => setToastMessage(null), 3000);
                                        }
                                      }} className={`w-full xs:flex-1 flex items-center justify-center gap-2 text-[10px] font-black bg-white dark:bg-slate-800 border shadow-sm px-3 py-2 rounded-xl transition-all active:scale-95 whitespace-nowrap ${isProjectType ? 'border-indigo-200 dark:border-indigo-700/50 text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:border-indigo-600' : 'border-emerald-200 dark:border-emerald-700/50 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:border-emerald-600'}`} title="Copiar link">
                                        <span className="material-symbols-outlined text-[15px]">content_copy</span> Link
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeactivateLinkSurveyId(String(s.id))}
                                        className="w-full xs:flex-1 flex items-center justify-center gap-2 text-[10px] font-black bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700/50 shadow-sm text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:border-amber-600 px-3 py-2 rounded-xl transition-all active:scale-95 whitespace-nowrap"
                                        title="Desactivar link"
                                      >
                                        <span className="material-symbols-outlined text-[15px]">link_off</span> Cerrar
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => setGenerateLinkSurveyId(String(s.id))} className="text-[11px] bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 font-black shadow-sm transition-all flex items-center justify-center gap-2 whitespace-nowrap w-full md:w-auto mt-2 md:mt-0">
                                    <span className="material-symbols-outlined text-[16px]">calendar_month</span> Definir Fecha
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Botonera inferior */}
                        <div className="mt-5 flex justify-end items-center gap-2">
                          {!s.published ? (
                            <button type="button" onClick={() => setConfirmPublish({ id: String(s.id), action: 'publish' })} className={`btn ${isProjectType ? 'btn-indigo' : 'btn-emerald'} px-4 py-1.5 text-xs`}>
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
                              }} className="btn btn-indigo px-4 py-1.5 text-xs">Calificar</button>
                            )
                          ) : (
                            isOwnerOf(s) ? (
                              /* Dueño → va directo a Reportes, no abre el formulario */
                              <button
                                type="button"
                                onClick={() => navigate('/profesor/encuestas/reports/' + String(s.id))}
                                className="px-4 py-1.5 text-sm font-semibold border-2 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 flex items-center gap-1.5 shadow-sm active:scale-95"
                                title="Ver reporte de respuestas"
                              >
                                <span className="material-symbols-outlined text-[16px]">bar_chart</span> Ver reporte
                              </button>
                            ) : userResponded ? (
                              /* Ya respondió → badge estático, sin acción */
                              <span className="px-4 py-1.5 text-sm font-semibold border-2 border-emerald-200 text-emerald-700 bg-emerald-50 rounded-lg dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-900/30 flex items-center gap-1.5 select-none">
                                <span className="material-symbols-outlined text-[16px]">check_circle</span> Respondido
                              </span>
                            ) : (
                              <button type="button" onClick={() => { setModalSurveyId(String(s.id)); setModalKind('view') }} className="btn btn-emerald px-4 py-1.5 text-xs">Responder</button>
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
        </div> {/* Cierra animacion grid */}
      </div> {/* Cierra max-w-7xl */}

      {/* floating scroll button (solo scroll) */}
      <ScrollFloatingButton />
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

                {!s.published && (
                  <button type="button" onClick={() => {
                    if (!isOwnerOf(s)) { setToastMessage('No tienes permiso para editar esta encuesta'); setTimeout(() => setToastMessage(null), 3000); setMenuOpenFor(null); return }
                    setEditSurvey(s); setCreateInitialType(undefined); setCreateModalOpen(true); setMenuOpenFor(null)
                  }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">edit</span> Editar contenidos
                  </button>
                )}

                {s.type === 'project' && (
                  <button type="button" onClick={() => {
                    const surveyProjects = s.projects || [];
                    if (surveyProjects.length === 0) {
                      setToastMessage('Aún no hay proyectos para evaluar');
                      setTimeout(() => setToastMessage(null), 3000);
                      setMenuOpenFor(null);
                      return;
                    }
                    setManageAccessSurveyId(String(s.id));
                    setMenuOpenFor(null);
                  }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">manage_accounts</span> Configurar Evaluadores
                  </button>
                )}


                {(() => {
                  const count = surveyReports.filter(r => String(r.surveyId) === String(s.id)).length
                  if (count > 0) {
                    return (
                      <button type="button" onClick={() => { setViewReportsFor(String(s.id)); setMenuOpenFor(null) }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                        <span className="material-symbols-outlined text-[18px]">flag</span>Ver reportes ({count})
                      </button>
                    )
                  }
                  return null
                })()}

                {isAdmin ? (
                  <button type="button" onClick={() => { setConfirmReportId(String(s.id)); setMenuOpenFor(null) }} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors">
                    <span className="material-symbols-outlined text-[18px]">warning</span> Reportar encuesta
                  </button>
                ) : null}

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

      {/* ── Manage Categories Modal ── */}
      <ManageCategoriesModal
        isOpen={manageCategoriesId !== null}
        onClose={() => setManageCategoriesId(null)}
        initialCategories={manageCategoriesList}
        onSaveSuccess={(cats) => {
          setSurveys((prev: any[]) => prev.map(x => (x.type === 'project') ? { ...x, allowedCategories: cats, allowed_categories: cats } : x));
          setToastMessage('Categorías guardadas globalmente');
          setTimeout(() => setToastMessage(null), 3000);
        }}
      />

      {/* Main Survey View/Project Modal */}
      <Modal 
        isOpen={!!modalSurveyId} 
        onClose={closeModal} 
        maxWidth={modalKind === 'projects' ? 'max-w-6xl' : 'max-w-4xl'}
        fullHeightOnMobile={true}
      >
        <div className="h-full flex flex-col">
          <React.Suspense fallback={<div className="flex-1 flex items-center justify-center py-20"><Loader size={60} text="Abriendo..." /></div>}>
            {modalKind === 'projects' ? (
              viewingProjectId ? (
                <RateProject 
                  survey={surveys.find(s => String(s.id) === modalSurveyId)} 
                  project={surveys.find(s => String(s.id) === modalSurveyId)?.projects?.find((p: any) => String(p.id) === viewingProjectId)} 
                  readOnly={viewingReadOnly} 
                  onClose={() => setViewingProjectId(null)} 
                  onSaved={(opts) => {
                    try {
                      const pid = opts && (opts as any).projectId
                      if (pid) {
                        setRatedMap(prev => {
                          const copy = { ...prev }
                          const arr = Array.isArray(copy[modalSurveyId!]) ? [...copy[modalSurveyId!]] : []
                          if (!arr.includes(String(pid))) arr.push(String(pid))
                          copy[modalSurveyId!] = arr
                          return copy
                        })
                      }
                    } catch (e) {}
                    setViewingProjectId(null)
                  }}
                />
              ) : (
                <div className="flex flex-col flex-1 min-h-0 w-full h-full">
                  <div className="shrink-0 px-4 sm:px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Proyectos: <span className="font-bold text-slate-800 dark:text-slate-200">{surveys.find(s => String(s.id) === modalSurveyId)?.projects?.length || 0}</span></div>
                        <div className="text-sm font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                          <span className="material-symbols-outlined text-[16px]">done_all</span>
                          Calificados: {(globalRatedMap[modalSurveyId!] || []).length} / {surveys.find(s => String(s.id) === modalSurveyId)?.projects?.length || 0}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative w-full">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">search</span>
                          <input 
                            placeholder="Buscar proyecto..." 
                            value={projectSearch} 
                            onChange={e => setProjectSearch(e.target.value)} 
                            className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 shadow-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400" 
                          />
                        </div>
                        <FilterDropdown
                          value={projectFilter}
                          label="Todos los proyectos"
                          icon="filter_list"
                          color="indigo"
                          options={[
                            { id: 'all', label: 'Todos los proyectos' },
                            { id: 'pending', label: 'Mis pendientes' },
                            { id: 'rated', label: 'Mis calificados' }
                          ]}
                          onChange={(val) => setProjectFilter(val as any)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar-sm">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                      {(surveys.find(s => String(s.id) === modalSurveyId)?.projects || [])
                        .filter((p: any) => {
                          if (projectSearch && !p.name?.toLowerCase().includes(projectSearch.toLowerCase())) return false;
                          const isRated = (ratedMap[modalSurveyId!] || []).includes(String(p.id));
                          if (projectFilter === 'pending' && isRated) return false;
                          if (projectFilter === 'rated' && !isRated) return false;
                          return true;
                        })
                        .map((p: any) => {
                          const isRated = (ratedMap[modalSurveyId!] || []).includes(String(p.id));
                          return (
                            <div key={p.id} className="p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 flex flex-col justify-between shadow-sm hover:shadow-md transition-all hover:border-indigo-300">
                              <div>
                                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-[15px] leading-snug mb-3 line-clamp-2">{p.name}</h4>
                                {p.category && (
                                  <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold mb-3">
                                    <span className="material-symbols-outlined text-[13px]">category</span> {p.category}
                                  </div>
                                )}
                              </div>
                              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                                {isRated ? (
                                  <button disabled className="w-full px-4 py-2 text-sm font-bold rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 flex justify-center items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">check_circle</span> Calificado
                                  </button>
                                ) : (
                                  <button onClick={() => setViewingProjectId(String(p.id))} className="w-full px-4 py-2 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all flex justify-center items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px]">edit_document</span> Calificar
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })
                      }
                    </div>
                  </div>
                </div>
              )
            ) : (
              <ViewSurvey surveyId={modalSurveyId} onClose={closeModal} hideCloseButton={true} />
            )}
          </React.Suspense>
        </div>
      </Modal>

      {/* Reports viewer modal */}
      <Modal 
        isOpen={!!viewReportsFor} 
        onClose={closeReportsModal} 
        maxWidth="max-w-3xl"
        title={
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-rose-500">flag</span>
            Reportes Recibidos
          </div>
        }
      >
        <div className="p-6">
          {(() => {
            const rs = surveyReports.filter(r => String(r.surveyId) === String(viewReportsFor))
            if (rs.length === 0) return <div className="text-center py-10 text-slate-500">No hay reportes para esta encuesta.</div>
            return (
              <div className="space-y-4">
                {rs.map((r, i) => (
                  <div key={i} className="p-4 rounded-xl border bg-white border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{new Date(r.createdAt).toLocaleString()}</span>
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[10px] font-black">REPORTE #{i+1}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 text-sm">{r.comment || 'Sin comentario.'}</p>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      </Modal>

      {/* Confirm Report Modal */}
      <Modal 
        isOpen={!!confirmReportId} 
        onClose={closeConfirmReportModal} 
        maxWidth="max-w-md"
        title={
          <div className="flex items-center gap-2 text-rose-600">
            <span className="material-symbols-outlined">report</span>
            Reportar Encuesta
          </div>
        }
      >
        <div className="p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">
            Si consideras que esta encuesta contiene contenido inapropiado, descríbelo a continuación:
          </p>
          <textarea 
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-slate-800 dark:text-slate-100 text-sm outline-none focus:border-rose-500 transition-all min-h-[120px] mb-6"
            placeholder="Motivo del reporte..."
            value={reportComment}
            onChange={e => setReportComment(e.target.value)}
          />
          <button 
            type="button" 
            onClick={async () => {
              if (!confirmReportId) return
              setConfirmReporting(true)
              try {
                const rep = { surveyId: confirmReportId, comment: reportComment.trim(), reporterId: currentUserId || 'anon', createdAt: new Date().toISOString() }
                await (dataClientNow as any).pushReport(rep)
                setToastMessage('Reporte enviado correctamente')
                setTimeout(() => setToastMessage(null), 3000)
              } catch (e) { console.error(e) }
              finally { setConfirmReporting(false); closeConfirmReportModal() }
            }} 
            disabled={confirmReporting || !reportComment.trim()} 
            className="btn btn-danger w-full py-3"
          >
            {confirmReporting ? <><ButtonLoader size={20} /> Enviando...</> : <><span className="material-symbols-outlined text-[20px]">send</span> Enviar Reporte</>}
          </button>
        </div>
      </Modal>

      {/* Create Survey Modal */}
      <Modal 
        isOpen={createModalOpen} 
        onClose={closeCreateModal} 
        maxWidth="max-w-4xl"
        fullHeightOnMobile={true}
      >
        <div className="h-full flex flex-col">
          <React.Suspense fallback={<div className="flex-1 flex items-center justify-center py-20"><Loader size={60} text="Cargando..." /></div>}>
            <CreateSurvey 
              editSurvey={editSurvey} 
              initialType={createInitialType}
              onClose={closeCreateModal} 
              onSaved={() => { setEditSurvey(null); closeCreateModal() }}
            />
          </React.Suspense>
        </div>
      </Modal>

      <React.Suspense fallback={null}>
        <EvaluatorModalContent 
          isOpen={!!manageAccessSurveyId} 
          onClose={() => setManageAccessSurveyId(null)}
          survey={surveys.find(s => String(s.id) === manageAccessSurveyId)}
          evaluatorUsers={evaluatorUsers}
          dataClientNow={dataClientNow}
          onSave={(updatedSurvey: any) => {
            setSurveys((prev: any[]) => prev.map(s => String(s.id) === String(updatedSurvey.id) ? { ...s, ...updatedSurvey } : s))
            setManageAccessSurveyId(null)
          }}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <GenerateLinkModal 
          isOpen={!!generateLinkSurveyId}
          onClose={() => setGenerateLinkSurveyId(null)}
          survey={surveys.find(s => String(s.id) === generateLinkSurveyId)}
          dataClientNow={dataClientNow}
          onSave={(updated: any) => {
            setSurveys((prev: any[]) => prev.map(s => String(s.id) === String(updated.id) ? { ...s, ...updated } : s))
            setGenerateLinkSurveyId(null)
          }}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <GenerateSatisfaccionLinkModal 
          isOpen={!!generateSatisfaccionLinkSurveyId}
          onClose={() => setGenerateSatisfaccionLinkSurveyId(null)}
          survey={surveys.find(s => String(s.id) === generateSatisfaccionLinkSurveyId)}
          dataClientNow={dataClientNow}
          onSave={(updated: any) => {
            setSurveys((prev: any[]) => prev.map(s => String(s.id) === String(updated.id) ? { ...s, ...updated } : s))
            setGenerateSatisfaccionLinkSurveyId(null)
          }}
        />
      </React.Suspense>

      {/* View Satisfaction Results Modal */}
      <SatisfaccionResultsModal 
        isOpen={!!viewSatisfaccionResultsSurveyId}
        onClose={() => setViewSatisfaccionResultsSurveyId(null)}
        surveyId={String(viewSatisfaccionResultsSurveyId || '')}
        surveyTitle={surveys.find(s => String(s.id) === viewSatisfaccionResultsSurveyId)?.title}
      />

      <Modal 
        isOpen={!!confirmDeactivateSatisfaccionLinkSurveyId} 
        onClose={() => setConfirmDeactivateSatisfaccionLinkSurveyId(null)} 
        maxWidth="max-w-sm"
      >
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto mb-4 shadow-sm">
            <span className="material-symbols-outlined text-[32px]">warning</span>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">¿Cerrar enlace de satisfacción?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">Esta acción invalidará el link de satisfacción inmediatamente. Los participantes ya no podrán acceder a él.</p>
          <button 
            type="button" 
            onClick={async () => {
              if (!confirmDeactivateSatisfaccionLinkSurveyId) return
              try {
                const s = surveys.find(x => String(x.id) === confirmDeactivateSatisfaccionLinkSurveyId)
                if (s) {
                  const updated = { ...s, satisfaccionToken: null, satisfaccionExpiresAt: null }
                  await dataClientNow.setSurvey(String(s.id), updated)
                  setSurveys((prev: any[]) => prev.map(x => String(x.id) === String(s.id) ? { ...x, ...updated } : x))
                }
              } catch (e) { console.error(e) }
              finally { setConfirmDeactivateSatisfaccionLinkSurveyId(null) }
            }} 
            className="btn w-full py-3 text-white font-black rounded-xl transition-all"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 15px rgba(217, 119, 6, 0.3)' }}
          >
            Sí, cerrar enlace
          </button>
        </div>
      </Modal>

      {/* Custom delete confirmation modal */}
      <Modal
        isOpen={confirmDeleteId !== null}
        onClose={() => { if (!confirmDeleting) setConfirmDeleteId(null) }}
        maxWidth="max-w-sm"
        hideCloseButton={false}
      >
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-4">
            <span className="material-symbols-outlined text-[32px]">delete_forever</span>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">¿Eliminar encuesta?</h3>
          <p className="text-sm text-slate-500 mb-6 font-medium">Esta acción no se puede deshacer.</p>
          <button 
            onClick={async () => {
              setConfirmDeleting(true);
              try {
                await dataClientNow.removeSurveyById(String(confirmDeleteId));
                setSurveys((prev: any[]) => prev.filter(x => String(x.id) !== String(confirmDeleteId)));
                setToastMessage('Encuesta eliminada');
                setTimeout(() => setToastMessage(null), 3000);
              } catch(e) { console.error(e) }
              finally { setConfirmDeleting(false); setConfirmDeleteId(null); }
            }}
            disabled={confirmDeleting}
            className="btn btn-danger w-full py-3"
          >
            {confirmDeleting ? <><ButtonLoader size={20} /> Eliminando...</> : 'Eliminar Definitivamente'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={confirmDeactivateLinkSurveyId !== null}
        onClose={() => setConfirmDeactivateLinkSurveyId(null)}
        maxWidth="max-w-sm"
      >
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto mb-4 shadow-sm">
            <span className="material-symbols-outlined text-[32px]">warning</span>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">¿Cerrar enlace de inscripción?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-medium">Esta acción invalidará el link de inscripción inmediatamente. No podrás deshacer este cambio.</p>
          <button
            type="button"
            onClick={async () => {
              try {
                const s = surveys.find(x => String(x.id) === String(confirmDeactivateLinkSurveyId));
                if (!s) return;
                const updated = { ...s, linkToken: null, linkExpiresAt: null };
                await dataClientNow.setSurvey(String(s.id), updated);
                setSurveys((prev: any[]) => prev.map((x: any) => String(x.id) === String(updated.id) ? updated : x));
                setConfirmDeactivateLinkSurveyId(null);
                setToastMessage('Enlace desactivado');
                setTimeout(() => setToastMessage(null), 3000);
                try { window.dispatchEvent(new CustomEvent('surveys:updated', { detail: { newId: updated.id, survey: updated } })) } catch (e) { }
              } catch (e) {
                setToastMessage('Error');
                setTimeout(() => setToastMessage(null), 3000);
              }
            }}
            className="btn w-full py-3 text-white font-black rounded-xl transition-all"
            style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 15px rgba(217, 119, 6, 0.3)' }}
          >
            Sí, cerrar enlace
          </button>
        </div>
      </Modal>

      {/* Confirm Publish/Unpublish Modal */}
      <Modal 
        isOpen={confirmPublish !== null} 
        onClose={() => setConfirmPublish(null)} 
        maxWidth="max-w-sm"
        hideCloseButton={false}
      >
        <div className="p-6 text-center">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${confirmPublish?.action === 'publish' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
            <span className="material-symbols-outlined text-[32px]">{confirmPublish?.action === 'publish' ? 'publish' : 'visibility_off'}</span>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">
            {confirmPublish?.action === 'publish' ? '¿Publicar encuesta?' : '¿Retirar publicación?'}
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            {confirmPublish?.action === 'publish' 
              ? 'Los usuarios podrán ver y responder esta encuesta una vez publicada.' 
              : 'La encuesta ya no estará visible para el público.'}
          </p>
          <button 
            onClick={async () => {
              if (!confirmPublish) return;
              setConfirmPublishing(true);
              try {
                const s = surveys.find(x => String(x.id) === confirmPublish.id);
                if (s) {
                  const updated = { ...s, published: confirmPublish.action === 'publish' };
                  await dataClientNow.setSurvey(String(s.id), updated);
                  setSurveys((prev: any[]) => prev.map(x => String(x.id) === String(s.id) ? updated : x));
                  setToastMessage(confirmPublish.action === 'publish' ? 'Encuesta publicada' : 'Publicación retirada');
                  setTimeout(() => setToastMessage(null), 3000);
                }
              } catch(e) { console.error(e) }
              finally { setConfirmPublishing(false); setConfirmPublish(null); }
            }}
            disabled={confirmPublishing}
            className={`btn w-full py-3 ${confirmPublish?.action === 'publish' ? 'btn-emerald' : 'btn-amber'}`}
          >
            {confirmPublishing ? <ButtonLoader size={20} /> : 'Confirmar'}
          </button>
        </div>
      </Modal>

      {/* Custom toast message */}
      {toastMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[999999] animate-fade-in-up">
          <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-white/10 dark:border-slate-200">
            <span className="material-symbols-outlined text-emerald-400">check_circle</span>
            <span className="text-sm font-bold">{toastMessage}</span>
          </div>
        </div>
      )}

      <ScrollFloatingButton />
    </div>
  )
}
