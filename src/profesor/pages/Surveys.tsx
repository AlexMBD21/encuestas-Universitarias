import React, { useEffect, useState, useRef, useCallback } from 'react'
import ReactDOM from 'react-dom'
import { useLocation } from 'react-router-dom'
const CreateSurvey = React.lazy(() => import('./CreateSurvey'))
const ViewSurvey   = React.lazy(() => import('./ViewSurvey'))
const RateProject  = React.lazy(() => import('./RateProject'))
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
import { SurveyGridSkeleton } from '../../components/ui/SurveyCardSkeleton';
import Loader from '../../components/Loader';
import { toast } from '../../components/ui/Toast';
import { Modal } from '../../components/ui/Modal';

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

  useEffect(() => {
    if (viewReportsFor) setTimeout(() => setIsReportsVisible(true), 50)
    else setIsReportsVisible(false)
  }, [viewReportsFor])

  const closeReportsModal = () => {
    setIsReportsVisible(false)
    setTimeout(() => {
      setViewReportsFor(null)
      setHighlightedReportId(null)
      setReportSearch('')
      setReportUserFilter('all')
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
    setIsConfirmReportVisible(false)
    setTimeout(() => {
      setConfirmReportId(null)
      setReportComment('')
      setPullDownY(0)
    }, 300)
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
    setIsModalVisible(false)
    // wait for animation then unmount and reset modal state
    setTimeout(() => {
      setModalSurveyId(null)
      setModalKind(null)
      setViewingProjectId(null)
      setViewingReadOnly(false)
    }, 210)
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
      ;(async () => {
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
    <div id="surveys-root" className="min-h-screen bg-slate-50 pb-20">

      {/* Header Surveys */}
      <div className="bg-white border-b border-slate-200 shadow-md relative z-10">
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
              <span className="material-symbols-outlined text-[18px]">add_circle</span> <span className="hidden sm:inline">Nueva</span> Encuesta
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
              <svg className="h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
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
              <input type="checkbox" checked={showOnlyPending} onChange={e => setShowOnlyPending(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-600 w-4 h-4 cursor-pointer" />
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
                { id: 'reported', label: 'Reportadas' }
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
                className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-sm font-bold rounded-xl transition-all whitespace-nowrap shadow-sm active:scale-[0.98]"
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
            <SurveyGridSkeleton count={8} />
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
                  // filter system settings and internal records
                  if (s.type === 'system' || s.type === 'settings' || String(s.id).startsWith('sys_')) return false
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
                      <div key={s.id} id={`survey-${s.id}`} className={`group relative p-5 border rounded-2xl flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-xl transform hover:-translate-y-1 transition duration-200 ease-out focus-within:ring-2 bg-white dark:bg-slate-900 ${isProjectType ? 'border-indigo-100 dark:border-indigo-900/50 hover:border-indigo-300 dark:hover:border-indigo-700/50 focus-within:ring-indigo-200' : 'border-emerald-100 dark:border-emerald-900/50 hover:border-emerald-300 dark:hover:border-emerald-700/50 focus-within:ring-emerald-200'}`}>
                        {/* Acento superior de color Premium */}
                        <div className={`absolute top-0 left-0 w-full h-[5px] ${isProjectType ? 'bg-gradient-to-r from-indigo-500 to-indigo-800 shadow-[0_2px_10px_rgba(99,102,241,0.3)]' : 'bg-gradient-to-r from-emerald-500 to-emerald-800 shadow-[0_2px_10px_rgba(16,185,129,0.3)]'}`}></div>

                        <div className="flex-1">
                          {/* Badges y status */}
                          <div className="flex flex-wrap items-center gap-1.5 mb-3 mt-1 pr-9">
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
                            userResponded ? (
                              <button type="button" onClick={() => { setModalSurveyId(String(s.id)); setModalKind('view') }} className="px-4 py-1.5 text-sm font-semibold border-2 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors dark:border-emerald-800 dark:text-emerald-400 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50">Respondido</button>
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

      {/* ── Categories Manager Modal ── */}
      {/* ── Categories Manager Modal ── */}
      <ManageCategoriesModal 
        isOpen={manageCategoriesId !== null}
        onClose={() => setManageCategoriesId(null)}
        initialCategories={manageCategoriesList}
        onSaveSuccess={(cats) => {
          setSurveys(prev => prev.map(x => (x.type === 'project') ? { ...x, allowedCategories: cats, allowed_categories: cats } : x));
          setToastMessage('Categorías guardadas globalmente');
          setTimeout(() => setToastMessage(null), 3000);
        }}
      />


      {/* Modal for viewing a survey */}

      {(modalSurveyId !== null || isModalVisible) && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60 transition-opacity" onClick={() => closeModal()} />
          <div className={`relative w-full sm:mx-4 sm:mb-0 transition-all duration-300 ${
            modalKind === 'view' ? 'sm:max-w-2xl' : 
            (modalKind === 'projects' && viewingProjectId) ? 'sm:max-w-3xl' : 
            'sm:max-w-4xl'
          }`}>
            <div
              ref={modalRef}
              role="dialog"
              aria-modal="true"
              tabIndex={-1}
              className={`bg-slate-50 dark:bg-slate-900 rounded-t-[20px] sm:rounded-[20px] shadow-2xl h-[95dvh] sm:h-auto sm:max-h-[85vh] overflow-hidden flex flex-col transform transition-all duration-300 ${isModalVisible ? 'opacity-100 translate-y-0 sm:scale-100' : 'opacity-0 translate-y-full sm:translate-y-4 sm:scale-95'}`}
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
              <div className="w-full flex justify-center pt-2 pb-3 sm:hidden absolute top-0 z-20 cursor-pointer" style={{ touchAction: 'none' }} onClick={() => closeModal()}>
                <div className="w-12 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700"></div>
              </div>
              {/* Header (sticky) */}
              <div className="sticky top-0 z-10 border-b border-slate-100 dark:border-slate-800 px-4 sm:px-6 py-4 sm:py-4 flex items-center justify-between bg-white dark:bg-slate-900 flex-shrink-0 pt-7 sm:pt-4 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.45)]" style={{ borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit', top: '-1px', touchAction: 'none' }}>
                <div className="text-lg sm:text-xl font-black text-slate-800 dark:text-slate-100 truncate mr-4 tracking-tight max-w-[calc(100%-48px)]">{activeSurvey ? activeSurvey.title : 'Encuesta'}</div>
                <div className="ml-auto hidden sm:block">
                  <button 
                    type="button" 
                    onClick={() => closeModal()} 
                    aria-label="Cerrar" 
                    title="Cerrar" 
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-[#0f172a] text-white hover:bg-[#1e293b] transition-all active:scale-95 shadow-sm group"
                  >
                    <span className="material-symbols-outlined text-[20px] group-hover:rotate-90 transition-transform duration-300">close</span>
                  </button>
                </div>
              </div>
              {/* Split scrolling responsibilities to children */}
              <div className="flex-1 flex flex-col min-h-0 w-full relative">

                {/* If survey is a project-type, show projects list or the RateProject UI */}
                {(() => {
                  const s = surveys.find(x => String(x.id) === String(modalSurveyId))
                  if (!s) return !surveysLoaded
                    ? <div className="flex-1 w-full h-full flex flex-col items-center justify-center p-8"><Loader size={56} text="Cargando..." /></div>
                    : <div className="p-6 text-slate-600">Encuesta no encontrada.</div>
                  if (modalKind === 'projects') {
                    // if viewing a single project, render RateProject
                    if (viewingProjectId) {
                      console.debug('[Surveys] rendering RateProject for surveyId=', s.id, 'viewingProjectId=', viewingProjectId)
                      const proj = (s.projects || []).find((p: any) => String(p.id) === String(viewingProjectId))
                      if (!proj) return <div className="text-slate-600">Proyecto no encontrado.</div>
                      return <React.Suspense fallback={<div className="flex-1 flex items-center justify-center py-16"><Loader size={56} text="Cargando..." innerColor="#a5b4fc" outerColor="#4f46e5" /></div>}><RateProject survey={s} project={proj} readOnly={viewingReadOnly} onClose={() => setViewingProjectId(null)} onSaved={(opts) => {
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
                        } catch (e) { }
                        setViewingProjectId(null)
                      }} /></React.Suspense>
                    }

                    // otherwise render list of projects with Calificar buttons
                    const allProjects = (s.projects || [])
                    // Calificados globales: proyectos calificados por CUALQUIER evaluador
                    const globalRatedArr = Array.isArray(globalRatedMap[String(s.id)]) ? globalRatedMap[String(s.id)] : []
                    const globalProgress = { rated: globalRatedArr.length, total: allProjects.length }
                    // compute categories for dropdown
                    const categories = Array.from(new Set(allProjects.map((p: any) => (p.category || '').trim()).filter(Boolean))) as string[]

                    // apply project-level filter + search + category + assignment restrictions
                    const isSurveyOwnerOrAdmin = isOwnerOf(s) || isAdmin
                    // we remove the filter that hides projects not assigned to this evaluator, 
                    // instead we show them all and conditionally disable the button below
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
                      const evs = Array.isArray(p.evaluators) ? p.evaluators : (p.evaluator ? [p.evaluator] : []);
                      const currentUserEmail = String(currentUser?.email || currentUserId || '').trim().toLowerCase();
                      const canEvaluate = isSurveyOwnerOrAdmin || evs.some((e: any) => e && String(e).trim().toLowerCase() === currentUserEmail);
                      
                      if (projectFilter === 'pending') {
                        return canEvaluate && !isRated;
                      }
                      if (projectFilter === 'rated') {
                        return canEvaluate && isRated;
                      }
                      if (projectFilter === 'unassigned') {
                        return !canEvaluate;
                      }
                      return true
                    })
                    // ... other branches
                    return (
                      <div className="flex flex-col flex-1 min-h-0 w-full h-full">
                        {/* Static stats + filters bar — casts shadow downward */}
                        <div className="shrink-0 px-3 sm:px-6 py-3 sm:py-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 relative z-10 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.45)]">
                          <div className="flex flex-col gap-3">
                            {/* Stats */}
                            <div className="flex flex-nowrap items-center justify-between gap-2 sm:gap-3 bg-slate-50 dark:bg-slate-800/50 p-2 sm:p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                              <div className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">Total Proyectos: <span className="font-bold text-slate-800 dark:text-slate-200">{allProjects.length}</span></div>
                              <div className="text-xs sm:text-sm font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/40 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg flex items-center gap-1 sm:gap-1.5 whitespace-nowrap shrink-0"><span className="material-symbols-outlined text-[13px] sm:text-[16px]">done_all</span> Calificados: {globalProgress.rated} / {globalProgress.total}</div>
                            </div>
                            {/* Filters */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <FilterDropdown 
                                value={projectFilter} 
                                label="Todos los proyectos" 
                                icon="filter_list"
                                color="indigo"
                                options={[
                                  { id: 'all', label: 'Todos los proyectos' },
                                  { id: 'pending', label: 'Mis pendientes' },
                                  { id: 'rated', label: 'Mis calificados' },
                                  { id: 'unassigned', label: 'No asignados a mí' }
                                ]} 
                                onChange={(val) => setProjectFilter(val as any)} 
                              />
                              <FilterDropdown 
                                value={projectCategory} 
                                label="Todas las categorías" 
                                icon="category"
                                color="indigo"
                                options={[
                                  { id: 'all', label: 'Todas las categorías' },
                                  ...categories.map(c => ({ id: c, label: c }))
                                ]} 
                                onChange={(val) => setProjectCategory(val)} 
                              />
                              <div className="relative w-full">
                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">search</span>
                                <input placeholder="Buscar proyecto..." value={projectSearch} onChange={e => setProjectSearch(e.target.value)} className="w-full pl-9 pr-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 shadow-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Scrollable projects list */}
                        <div className="flex-1 overflow-y-auto p-3 sm:p-6 w-full custom-scrollbar-sm relative z-0">
                          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                            {filteredProjects.length === 0 && !isSurveyOwnerOrAdmin && (
                              <div className="col-span-full py-12 flex flex-col items-center justify-center text-center">
                                <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600 mb-3 block">inventory_2</span>
                                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">Aún no se te han asignado proyectos</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                                  El administrador debe asignarte proyectos individualmente para poder calificarlos.
                                </p>
                              </div>
                            )}
                            {filteredProjects.map((p: any) => {
                              const ratedLocal = Array.isArray(ratedMap[String(s.id)]) && ratedMap[String(s.id)].includes(String(p.id))
                              const rated = ratedLocal || surveyHelpers.hasUserRated(String(s.id), String(p.id))
                              return (
                                <div key={p.id} className="p-4 sm:p-5 border border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-800 flex flex-col justify-between shadow-sm hover:shadow-md transition-all hover:border-indigo-300 dark:hover:border-indigo-500/50 group h-full">
                                  <div>
                                    <div className="mb-3">
                                      <h4 
                                    onClick={(e) => toggleTitleExpansion(e, p.id)}
                                    className={`font-bold text-slate-800 dark:text-slate-100 text-[15px] leading-snug break-all cursor-pointer transition-all ${expandedTitles.has(p.id) ? 'whitespace-normal' : 'line-clamp-2'}`} 
                                    title={p.name}
                                  >
                                    {p.name || 'Proyecto sin nombre'}
                                  </h4>
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
                                    {(() => {
                                      const evs = Array.isArray(p.evaluators) ? p.evaluators : (p.evaluator ? [p.evaluator] : []);
                                      const currentUserEmail = String(currentUser?.email || currentUserId || '').trim().toLowerCase();
                                      const canEvaluate = isSurveyOwnerOrAdmin || evs.some((e: any) => e && String(e).trim().toLowerCase() === currentUserEmail);
                                      
                                      if (!canEvaluate) {
                                        return (
                                          <button type="button" disabled className="w-full sm:w-auto px-5 py-2 text-sm font-bold rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed flex justify-center items-center gap-2 shadow-inner">
                                            <span className="material-symbols-outlined text-[18px]">lock</span> No Asignado
                                          </button>
                                        )
                                      }

                                      if (rated) {
                                        return <button type="button" onClick={() => { setModalSurveyId(String(s.id)); setModalKind('projects'); setViewingReadOnly(true); setViewingProjectId(String(p.id)) }} className="w-full sm:w-auto px-4 py-2 text-sm font-bold rounded-xl border-2 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 transition-colors flex justify-center items-center gap-2"><span className="material-symbols-outlined text-[18px]">check_circle</span> Calificado</button>
                                      }
                                      
                                      return (
                                        <button type="button" onClick={() => { setModalSurveyId(String(s.id)); setModalKind('projects'); setViewingReadOnly(false); setViewingProjectId(String(p.id)) }} className="w-full sm:w-auto px-5 py-2 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 transition-all flex justify-center items-center gap-2"><span className="material-symbols-outlined text-[18px]">edit_document</span> Calificar</button>
                                      )
                                    })()}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    )
                  }
                  // default for non-project surveys
                  return <React.Suspense fallback={<div className="flex-1 flex items-center justify-center py-16"><Loader size={56} text="Cargando..." /></div>}><ViewSurvey surveyId={modalSurveyId ?? undefined} onClose={() => closeModal()} hideCloseButton={true} /></React.Suspense>
                })()}
              </div>
            </div>
          </div>
        </div>, document.body
      )}
      {/* Custom delete confirmation modal */}
      <Modal
        isOpen={confirmDeleteId !== null}
        onClose={() => { if (!confirmDeleting) setConfirmDeleteId(null) }}
        maxWidth="max-w-sm"
        hideCloseButton={true}
      >
        <div className="p-6 text-center bg-white dark:bg-slate-900 flex-1 flex flex-col justify-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-4 shadow-sm">
            <span className="material-symbols-outlined text-[32px]">delete_forever</span>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">¿Eliminar esta encuesta?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Esta acción es irreversible. ¿Deseas eliminarla definitivamente?</p>
          <div className="flex flex-col-reverse sm:flex-row gap-3 mt-auto sm:mt-0">
            <button type="button" onClick={() => setConfirmDeleteId(null)} disabled={confirmDeleting} className="btn btn-ghost flex-1">
              Cancelar y Volver
            </button>
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
                  try { window.dispatchEvent(new CustomEvent('surveys:updated', { detail: { surveyId: confirmDeleteId } })) } catch (e) { }
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
            }} disabled={confirmDeleting} className="btn btn-primary flex-1 !bg-red-600 hover:!bg-red-700 !shadow-red-600/20">
              {confirmDeleting ? 'Eliminando...' : 'Eliminar Definivamente'}
            </button>
          </div>
        </div>
      </Modal>
      {/* Publish / Unpublish confirmation modal */}
      {confirmPublish && (() => {
        const s = surveys.find(x => String(x.id) === String(confirmPublish.id))
        if (!s) return null


        const missing: string[] = []
        const warnings: string[] = []
        if (confirmPublish.action === 'publish') {
          if (s.type !== 'project' && !(s.questions && s.questions.length > 0)) missing.push('Al menos 1 pregunta')
          if (s.type === 'project') {
            if (!(s.rubric && s.rubric.length > 0)) missing.push('Al menos 1 criterio (rubric)')
            
            const hasProjects = s.projects && s.projects.length > 0;
            const isLinkActive = s.linkExpiresAt && new Date(s.linkExpiresAt).getTime() > Date.now();
            
            if (!hasProjects) {
              missing.push('No hay proyectos inscritos. Debes esperar a que los estudiantes se inscriban.')
            } else if (isLinkActive) {
              warnings.push('El periodo de inscripción sigue abierto. Al publicar, se desactivará el enlace de inscripción.')
            }
          }
        }

        return (
          <Modal 
            isOpen={confirmPublish !== null} 
            onClose={() => { if (!confirmPublishing) setConfirmPublish(null) }} 
            maxWidth="max-w-md"
            hideCloseButton={true}
            title={
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined ${confirmPublish.action === 'publish' ? 'text-indigo-500' : 'text-amber-500'}`}>
                  {confirmPublish.action === 'publish' ? 'publish' : 'unpublished'}
                </span>
                {confirmPublish.action === 'publish' ? 'Publicar encuesta' : 'Retirar publicación'}
              </div>
            }
          >
            <div className="p-6 pt-0">
              <div className="text-sm mb-6 mt-4">
                {confirmPublish.action === 'publish' ? (
                  missing.length === 0 ? (
                    warnings.length === 0 ? (
                      <p className="text-slate-600 dark:text-slate-400 font-medium">Confirma que deseas publicar esta encuesta. Será visible para el público.</p>
                    ) : (
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50">
                        <div className="font-bold flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-400">
                          <span className="material-symbols-outlined text-[18px]">warning</span> Advertencia
                        </div>
                        <ul className="list-disc pl-6 mt-1 text-sm font-semibold text-amber-600/90 dark:text-amber-400/90 space-y-1">
                          {warnings.map(w => <li key={w}>{w}</li>)}
                        </ul>
                        <p className="mt-3 text-amber-800 dark:text-amber-300 font-bold">¿Estás seguro que quieres publicar sin haber finalizado el tiempo del link?</p>
                      </div>
                    )
                  ) : (
                    <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-900/50">
                      <div className="font-bold flex items-center gap-2 mb-2 text-red-700 dark:text-red-400">
                        <span className="material-symbols-outlined text-[18px]">error</span> No se puede publicar todavía:
                      </div>
                      <ul className="list-disc pl-6 mt-1 text-sm font-semibold text-red-600/90 dark:text-red-400/90 space-y-1">
                        {missing.map(m => <li key={m}>{m}</li>)}
                      </ul>
                    </div>
                  )
                ) : (
                  <p className="text-slate-600 dark:text-slate-400 font-medium">Confirma que deseas retirar la publicación de esta encuesta. La encuesta dejará de estar visible.</p>
                )}
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                <button type="button" onClick={() => setConfirmPublish(null)} disabled={confirmPublishing} className="btn btn-ghost px-8">
                  Cancelar y Volver
                </button>
                {(confirmPublish.action !== 'publish' || missing.length === 0) && (
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
                        
                        if (confirmPublish.action === 'publish' && updated.type === 'project') {
                          updated.linkExpiresAt = null;
                          updated.linkToken = null;
                        }
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
                              id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
                            if (dataClientNow.removeNotificationsBySurveyId) {
                              await dataClientNow.removeNotificationsBySurveyId(String(confirmPublish.id))
                            }
                            try { window.dispatchEvent(new CustomEvent('notifications:updated', { detail: { surveyId: String(confirmPublish.id) } })) } catch (e) { }
                          } catch (e) { }
                          try {
                            if (dataClientNow.removeSurveyReportsBySurveyId) {
                              await dataClientNow.removeSurveyReportsBySurveyId(String(confirmPublish.id))
                            }
                            try { window.dispatchEvent(new CustomEvent('survey:reports:updated', { detail: { surveyId: String(confirmPublish.id) } })) } catch (e) { }
                          } catch (e) { }
                        }
                        try { window.dispatchEvent(new CustomEvent('surveys:updated', { detail: { surveyId: confirmPublish.id, survey: updated } })) } catch (e) { }
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
                  }} disabled={confirmPublishing} className="btn btn-primary px-10">
                    {confirmPublishing ? 'Procesando...' : (confirmPublish.action === 'publish' ? 'Publicar Ahora' : 'Confirmar Retiro')}
                  </button>
                )}
              </div>
            </div>
          </Modal>
        )
      })()}
      {/* Reports viewer modal (owner) */}
      {viewReportsFor && ReactDOM.createPortal(
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => { setViewReportsFor(null); setHighlightedReportId(null) }} />
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
            <div className="px-5 py-3.5 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-shrink-0 z-10 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.45)]" style={{ touchAction: 'none' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[24px]">flag</span>
                </div>
                <div className="flex flex-col min-w-0">
                  <h3 className="text-[17px] font-bold text-slate-800 dark:text-slate-100 leading-tight">Buzón de Reportes</h3>
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate mt-0.5 tracking-tight">
                    {(() => {
                      const reportsSurvey = surveys.find(x => String(x.id) === String(viewReportsFor))
                      return reportsSurvey ? (reportsSurvey.title || reportsSurvey.name) : 'Cargando información...'
                    })()}
                  </div>
                </div>
              </div>
              <div className="ml-auto hidden sm:block">
                <button
                  type="button"
                  onClick={() => closeReportsModal()}
                  aria-label="Cerrar"
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-[#0f172a] text-white hover:bg-[#1e293b] active:scale-95 transition-all duration-300 outline-none shadow-sm group"
                >
                  <span className="material-symbols-outlined text-[20px] group-hover:rotate-90 transition-transform duration-300">close</span>
                </button>
              </div>
            </div>

            {/* Static filter bar */}
            <div className="shrink-0 px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 relative z-10 shadow-[0_8px_20px_-4px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_20px_-4px_rgba(0,0,0,0.45)]">
              <div className="flex flex-col sm:flex-row gap-2">
                {/* User filter dropdown — options built from current survey reports */}
                {(() => {
                  const currentReports = surveyReports.filter(r => String(r.surveyId) === String(viewReportsFor))
                  const uniqueUsers = Array.from(new Set(currentReports.map(r => r.reporterEmail || r.reporterId || 'Anónimo').filter(Boolean)))
                  return uniqueUsers.length > 1 ? (
                    <div className="sm:w-56 shrink-0">
                      <FilterDropdown
                        value={reportUserFilter}
                        label="Todos los usuarios"
                        icon="person_alert"
                        color="red"
                        options={[
                          { id: 'all', label: 'Todos los usuarios' },
                          ...uniqueUsers.map(u => ({ id: u, label: u }))
                        ]}
                        onChange={(val) => setReportUserFilter(val)}
                      />
                    </div>
                  ) : null
                })()}
                {/* Text search */}
                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">search</span>
                  <input
                    type="text"
                    placeholder="Buscar por usuario o mensaje..."
                    value={reportSearch ?? ''}
                    onChange={e => setReportSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 transition-all"
                  />
                  {reportSearch && (
                    <button type="button" onClick={() => setReportSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-0 custom-scrollbar-sm">
              {(() => {
                if (!reportsLoaded) return (
                  <div className="flex items-center justify-center py-12">
                    <Loader size={48} text="Cargando reportes..." />
                  </div>
                )
                const allReports = surveyReports.filter(r => String(r.surveyId) === String(viewReportsFor))
                const reports = allReports.filter(r => {
                  // User filter
                  if (reportUserFilter !== 'all') {
                    const userKey = r.reporterEmail || r.reporterId || 'Anónimo'
                    if (userKey !== reportUserFilter) return false
                  }
                  // Text search filter
                  const q = (reportSearch ?? '').trim().toLowerCase()
                  if (q) {
                    const hay = `${r.reporterEmail || r.reporterId || ''} ${r.comment || ''}`.toLowerCase()
                    if (!hay.includes(q)) return false
                  }
                  return true
                })
                if (!allReports || allReports.length === 0) return <div className="text-slate-600 text-sm py-4 text-center">No hay reportes para esta encuesta.</div>
                if (reports.length === 0) return (
                  <div className="py-10 flex flex-col items-center text-center gap-2">
                    <span className="material-symbols-outlined text-[40px] text-slate-300 dark:text-slate-600">manage_search</span>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Sin resultados{reportSearch ? <span className="font-bold"> para "{reportSearch}"</span> : ''}</p>
                  </div>
                )
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
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center overscroll-none touch-none">
          <div className={`absolute inset-0 bg-slate-900/60 transition-opacity duration-300 pointer-events-auto ${isConfirmReportVisible ? 'opacity-100' : 'opacity-0'}`} onClick={() => !confirmReporting && closeConfirmReportModal()} style={{ touchAction: 'none' }} />
          <div 
            ref={confirmReportRef}
            className={`relative w-full sm:max-w-md sm:mx-4 sm:mb-0 transform transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${isConfirmReportVisible ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 sm:translate-y-4 sm:scale-95'}`}
            style={{ 
              transform: pullDownY > 0 ? `translateY(${pullDownY}px)` : '',
              overscrollBehaviorY: 'contain',
              touchAction: 'pan-y'
            }}
            onTouchStart={(e) => {
              touchStartRef.current = { y: e.touches[0].clientY, scrollY: confirmReportRef.current?.querySelector('.overflow-y-auto')?.scrollTop || 0 }
            }}
            onTouchMove={(e) => {
              const deltaY = e.touches[0].clientY - touchStartRef.current.y
              if (deltaY > 0 && touchStartRef.current.scrollY <= 0) {
                setPullDownY(deltaY)
                if (e.cancelable) e.preventDefault()
              }
            }}
            onTouchEnd={() => {
              if (pullDownY > 150) {
                closeConfirmReportModal()
              }
              setPullDownY(0)
            }}
          >
            <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-slate-200/50 dark:border-slate-800/50 flex flex-col max-h-[85vh]">
              {/* Drag handle for mobile */}
              <div className="w-full flex justify-center pt-2 pb-1 sm:hidden cursor-pointer shrink-0" style={{ touchAction: 'none' }} onClick={() => !confirmReporting && closeConfirmReportModal()}>
                <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></div>
              </div>

              <div className="px-6 py-5 sm:p-8 overflow-y-auto overscroll-contain">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shadow-sm">
                      <span className="material-symbols-outlined text-[26px]">warning</span>
                    </div>
                    <span>Reportar encuesta</span>
                  </h3>
                  <button 
                    type="button" 
                    onClick={() => closeConfirmReportModal()} 
                    disabled={confirmReporting} 
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-[#0f172a] text-white hover:bg-[#1e293b] active:scale-95 transition-all duration-300 outline-none shadow-sm group hidden sm:flex"
                    aria-label="Cerrar"
                  >
                    <span className="material-symbols-outlined text-[20px] group-hover:rotate-90 transition-transform duration-300">close</span>
                  </button>
                </div>
                
                <p className="text-[15px] text-slate-500 dark:text-slate-400 mb-8 leading-relaxed font-medium pl-1">
                  Describe detalladamente el problema con esta encuesta para que la moderación evalúe el caso.
                </p>

                <div className="mb-8">
                  <textarea 
                    value={reportComment} 
                    onChange={e => setReportComment(e.target.value)} 
                    rows={5} 
                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:border-red-400 focus:ring-4 focus:ring-red-400/20 rounded-2xl text-sm p-4 text-slate-700 dark:text-slate-200 outline-none resize-none transition-all placeholder:text-slate-400 shadow-inner" 
                    placeholder="¿Qué problema encontraste?" 
                  />
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => closeConfirmReportModal()} 
                    disabled={confirmReporting} 
                    className="btn btn-ghost px-8"
                  >
                    Cancelar y Volver
                  </button>
                  <button 
                    type="button" 
                    disabled={confirmReporting}
                    onClick={async () => {
                      try {
                        if (!reportComment || reportComment.trim().length < 3) {
                          setToastMessage('Escribe un comentario válido para reportar')
                          setTimeout(() => setToastMessage(null), 3000)
                          return
                        }
                        const myEmail = currentUser?.email || (typeof currentUserId === 'string' && currentUserId.includes('@') ? currentUserId : null);
                        const myUid = currentUser?.id || (typeof currentUserId === 'string' && !currentUserId.includes('@') ? currentUserId : null);
                        
                        const existingReport = (surveyReports || []).find(r => {
                          if (String(r.surveyId) !== String(confirmReportId)) return false;
                          const rId = String(r.reporterId || '');
                          const rEmail = String(r.reporterEmail || '');
                          return (myUid && rId === String(myUid)) || (myEmail && (rEmail === String(myEmail) || rId === String(myEmail)));
                        });
                        if (existingReport) {
                          setToastMessage('Ya has reportado esta encuesta. Solo se permite un reporte activo por encuesta.')
                          setTimeout(() => setToastMessage(null), 4000)
                          closeConfirmReportModal()
                          return
                        }
                        setConfirmReporting(true)
                        const _reportSurvey = (surveys || []).find((sv: any) => String(sv.id) === String(confirmReportId))
                        const report = {
                          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
                          closeConfirmReportModal()
                          setSurveyReports(prev => [...prev, report])
                          try { window.dispatchEvent(new CustomEvent('survey:reported', { detail: { report } })) } catch (e) { }
                          setToastMessage('Reporte enviado. Gracias.')
                          setTimeout(() => setToastMessage(null), 3000)
                        } else {
                          setToastMessage('No se puede enviar reportes: no hay servicio de datos configurado.')
                          setTimeout(() => setToastMessage(null), 3000)
                          setConfirmReporting(false)
                          return
                        }
                      } catch (e) { console.error(e) }
                      finally { setConfirmReporting(false) }
                    }} 
                    className={`btn btn-primary px-10 ${confirmReporting ? 'opacity-60 cursor-not-allowed' : '!bg-red-600 hover:!bg-red-700 !shadow-red-600/30'}`}
                  >
                    {confirmReporting ? (
                      <><span className="material-symbols-outlined text-[18px] animate-spin">refresh</span> Procesando...</>
                    ) : (
                      <><span className="material-symbols-outlined text-[20px]">send</span> Enviar reporte</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>, document.body
      )}
      {/* Create modal */}
      <Modal
        isOpen={createModalOpen}
        onClose={closeCreateModal}
        maxWidth="max-w-xl"
        title={editSurvey ? 'Editar encuesta' : 'Crear encuesta'}
        fullHeightOnMobile={true}
        scrollableBody={false}
      >
        <div className="flex-1 flex flex-col min-h-0 w-full h-full relative">
          <React.Suspense fallback={<div className="flex items-center justify-center h-full min-h-[50vh]"><Loader size={56} text="Cargando..." innerColor="#a5b4fc" outerColor="#4f46e5" /></div>}>
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
                    try { setSurveys(arr) } catch (e) { }
                  }).catch(() => { })
                } catch (e) { }
              }}
              onClose={() => { setCreateModalOpen(false); setEditSurvey(null); setCreateInitialType(undefined); }}
            />
          </React.Suspense>
        </div>
      </Modal>
      {/* Manage Access (Evaluators) modal */}
      {manageAccessSurveyId && (() => {
        const s = surveys.find(x => String(x.id) === String(manageAccessSurveyId))
        if (!s) return null;
        return (
          <EvaluatorModalContent 
            isOpen={manageAccessSurveyId !== null}
            onClose={() => setManageAccessSurveyId(null)}
            survey={s}
            evaluatorUsers={evaluatorUsers}
            dataClientNow={dataClientNow}
            onSave={(updatedSurvey: any) => {
              setSurveys(prev => prev.map(x => String(x.id) === String(s.id) ? updatedSurvey : x))
              setToastMessage('Evaluadores guardados')
              setTimeout(() => setToastMessage(null), 3000)
              setManageAccessSurveyId(null)
            }}
          />
        );
      })()}
      {generateLinkSurveyId && (() => {
        const s = surveys.find(x => String(x.id) === String(generateLinkSurveyId))
        if (!s) return null;
        return (
          <GenerateLinkModal 
            isOpen={generateLinkSurveyId !== null}
            onClose={() => setGenerateLinkSurveyId(null)}
            survey={s}
            dataClientNow={dataClientNow}
            onSave={(updatedSurvey: any) => {
              setSurveys(prev => prev.map(x => String(x.id) === String(s.id) ? updatedSurvey : x))
              setToastMessage('Fecha guardada correctamente')
              setTimeout(() => setToastMessage(null), 3000)
              setGenerateLinkSurveyId(null)
            }}
          />
        );
      })()}
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
        /* Mobile-only: forzar alineación izquierda en el header de encuestas */
        @media (max-width: 767px) {
          #surveys-header-inner {
            align-items: flex-start !important;
          }
          #surveys-header-title-row {
            justify-content: flex-start !important;
            align-items: center !important;
          }
          #surveys-header-text {
            width: 100% !important;
            text-align: left !important;
          }
          #surveys-header-buttons {
            width: 100% !important;
            flex-direction: row !important;
          }
          #surveys-header-buttons button {
            flex: 1 1 0 !important;
          }
        }
      `}</style>
      {/* Confirm Deactivate Link modal */}
      <Modal
        isOpen={confirmDeactivateLinkSurveyId !== null}
        onClose={() => setConfirmDeactivateLinkSurveyId(null)}
        maxWidth="max-w-sm"
        hideCloseButton={true}
      >
        <div className="p-6 text-center bg-white dark:bg-slate-900 flex-1 flex flex-col justify-center">
          <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 mx-auto mb-4 shadow-sm">
            <span className="material-symbols-outlined text-[32px]">warning</span>
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">¿Desactivar enlace?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 font-medium">Esta acción invalidará el link de inscripción inmediatamente. No podrás deshacer este cambio.</p>
          <div className="flex flex-col-reverse sm:flex-row gap-3 mt-auto sm:mt-0">
            <button 
              type="button" 
              onClick={() => setConfirmDeactivateLinkSurveyId(null)} 
              className="btn btn-ghost flex-1"
            >
              Cancelar y Volver
            </button>
            <button 
              type="button" 
              onClick={async () => {
                try {
                  const s = surveys.find(x => String(x.id) === String(confirmDeactivateLinkSurveyId));
                  if (s) {
                    const updated = { ...s, linkExpiresAt: null, linkToken: null };
                    await dataClientNow.setSurvey(String(s.id), updated);
                    setSurveys(prev => prev.map(x => String(x.id) === String(s.id) ? updated : x));
                    setToastMessage('Enlace desactivado');
                    setTimeout(() => setToastMessage(null), 3000);
                  }
                  setConfirmDeactivateLinkSurveyId(null);
                } catch (err) {
                  setToastMessage('Error');
                  setTimeout(() => setToastMessage(null), 3000);
                }
              }} 
              className="btn btn-primary flex-1 !bg-amber-600 hover:!bg-amber-700 !shadow-amber-600/30"
            >
              Sí, desactivar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
