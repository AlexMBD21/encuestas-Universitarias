import React, { useEffect, useState, useLayoutEffect, useRef } from 'react'
import ReactDOM from 'react-dom'
import { useNavigate, useParams } from 'react-router-dom'
import reportHelpers from '../services/reportHelpers'
import { useReactToPrint } from 'react-to-print'
import supabaseClient from '../../services/supabaseClient'
import QuestionStatCard from '../components/QuestionStatCard'
import SurveyDetailPanel from '../components/SurveyDetailPanel'
import ProjectDetailModal from '../components/ProjectDetailModal'
import PrintConfigModal, { PrintConfig } from '../components/PrintConfigModal'
import PrintLayout from '../components/PrintLayout'
import { toast } from '../../components/ui/Toast'
import Dropdown from '../../components/ui/Dropdown'

export default function ReportDetail(): JSX.Element {
  const navigate = useNavigate()
  const { surveyId } = useParams<{ surveyId: string }>()
  const dataClientNow: any = supabaseClient

  const [survey, setSurvey] = useState<any>(null)
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modalProject, setModalProject] = useState<any>(null)
  const [usersCache, setUsersCache] = useState<Record<string, any>>({})
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas')
  const [showWinnersOnly, setShowWinnersOnly] = useState<boolean>(false)
  const [expandedTitles, setExpandedTitles] = useState<Set<string>>(new Set())

  // --- Print Configuration State ---
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [printConfig, setPrintConfig] = useState<PrintConfig | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const surveyTitleHeader =
    (survey && (survey.title || survey.name)) ||
    (report && report.survey && (report.survey.title || report.survey.name)) ||
    'Reporte'

  const handlePrintFn = useReactToPrint({
    contentRef: printRef,
    documentTitle: surveyTitleHeader + ' - Reporte',
  })

  const categoriesSet = new Set<string>();
  if (report?.projectSummaries) {
    report.projectSummaries.forEach((ps: any) => {
      const cat = (ps.project?.category || 'Sin Categoría').trim();
      categoriesSet.add(cat);
    });
  }
  const availableCategories = Array.from(categoriesSet).sort();

  const handleGeneratePdf = (config: PrintConfig) => {
    setPrintConfig(config);
    
    const isMobile = typeof navigator !== 'undefined' && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    
    if (isMobile) {
      setShowPrintModal(false);
      toast({ message: 'Preparando vista de impresión...', type: 'info', duration: 2000 })
      setTimeout(() => {
        if (handlePrintFn) handlePrintFn();
      }, 400); // Dar más tiempo para que el modal se cierre visualmente en móvil
    } else {
      toast({ message: 'Preparando vista de impresión...', type: 'info', duration: 2000 })
      setTimeout(() => {
        if (handlePrintFn) handlePrintFn();
      }, 150);
    }
  };
  // ----------------------------------

  const toggleTitleExpansion = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setExpandedTitles(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Reiniciar scroll al entrar y cuando termina de cargar
  const resetScroll = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any })
    if (document.documentElement) document.documentElement.scrollTop = 0
    if (document.body) document.body.scrollTop = 0
    
    // Reset all potential containers
    const ids = ['main-content', 'report-detail-root', 'reports-root', 'surveys-root']
    ids.forEach(id => {
      const el = document.getElementById(id)
      if (el) el.scrollTop = 0
    })

    // Reset layout containers
    document.querySelectorAll('.layout-container').forEach((el: any) => { el.scrollTop = 0 })
  }

  useLayoutEffect(() => {
    resetScroll()
    requestAnimationFrame(resetScroll)
    // Minimal resets to catch initial render shifts
    const t1 = setTimeout(resetScroll, 150)
    return () => { clearTimeout(t1); }
  }, [])

  useEffect(() => {
    if (!loading) {
      // ONE reset after large data renders is sufficient
      const t1 = setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' as any })
        const anchor = document.getElementById('layout-top-anchor')
        if (anchor) try { anchor.scrollIntoView({ block: 'start' }) } catch (e) {}
      }, 100)
      return () => clearTimeout(t1)
    }
  }, [loading])

  useEffect(() => {
    if (!surveyId) return
    let mounted = true
    const load = async () => {
      if (mounted) setLoading(true)
      try {
        // get survey metadata
        let s: any = null
        try {
          if (dataClientNow.getSurveyById) s = await dataClientNow.getSurveyById(surveyId)
          if (!s && dataClientNow.getPublishedSurveysOnce) {
            const all = await dataClientNow.getPublishedSurveysOnce()
            s = (all || []).find((x: any) => String(x.id) === String(surveyId))
          }
        } catch (e) {}
        if (mounted) setSurvey(s)

        const kind = s && s.type === 'project' ? 'projects' : 'simple'
        let r: any = null
        if (kind === 'simple') r = await (reportHelpers as any).getSimpleSurveyReport(surveyId!)
        else r = await (reportHelpers as any).getProjectSurveyReport(surveyId!)
        if (mounted) setReport(r)
      } catch (e) {
        if (mounted) setReport(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    load()

    // reload when reports are updated externally
    const onReportsUpdated = (ev: any) => {
      try {
        const sid = ev && ev.detail && ev.detail.surveyId
        if (!sid || String(sid) === String(surveyId)) load()
      } catch (e) {}
    }
    window.addEventListener('survey:reports:updated', onReportsUpdated as EventListener)
    return () => {
      mounted = false
      window.removeEventListener('survey:reports:updated', onReportsUpdated as EventListener)
    }
  }, [surveyId])

  // Seed users cache: current auth user + resolve respondent UUIDs from report rows
  useEffect(() => {
    let mounted = true
    const resolve = async () => {
      try {
        const idx: Record<string, any> = {}
        // Seed current auth user
        try {
          const authUser = dataClientNow.getAuthCurrentUser ? dataClientNow.getAuthCurrentUser() : null
          if (authUser && authUser.id && authUser.email) idx[String(authUser.id)] = authUser
        } catch (e) {}
        // Extract unique respondent IDs from report rows
        // For project surveys individual responses live in rawResponses; for simple surveys in rows
        const responseRows = (report && Array.isArray(report.rawResponses) && report.rawResponses.length > 0)
          ? report.rawResponses
          : (report && Array.isArray(report.rows) ? report.rows : [])
        if (report && responseRows.length > 0) {
          const uids = Array.from(new Set(
            responseRows
              .map((r: any) => String(r.userId || r.user || r.reporterId || r.reporterUid || ''))
              .filter((id: string) => id && id.length > 10 && !idx[id])
          ))
          if (uids.length > 0 && dataClientNow.resolveOwnerEmails) {
            const resolved = await dataClientNow.resolveOwnerEmails(uids)
            Object.entries(resolved).forEach(([uid, email]) => {
              if (uid && email) idx[uid] = { id: uid, email }
            })
          }
        }
        if (mounted) setUsersCache(prev => ({ ...prev, ...idx }))
      } catch (e) {}
    }
    resolve()
    return () => { mounted = false }
  }, [report])

  const surveyTitle =
    (survey && (survey.title || survey.name)) ||
    (report && report.survey && (report.survey.title || report.survey.name)) ||
    'Reporte sin título'

  const reload = async () => {
    if (!surveyId) return
    setLoading(true)
    try {
      const kind = survey && survey.type === 'project' ? 'projects' : 'simple'
      let r: any = null
      if (kind === 'simple') r = await (reportHelpers as any).getSimpleSurveyReport(surveyId)
      else r = await (reportHelpers as any).getProjectSurveyReport(surveyId)
      setReport(r)
    } catch (e) { setReport(null) }
    finally { setLoading(false) }
  }

  return (
    <>
      <div id="report-detail-root" className="min-h-screen bg-slate-50/50 pb-24 print:hidden">

      {/* Header Premium */}
      <div className="bg-white border-b border-slate-200/60 shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.03] to-blue-500/[0.04]" />
        
        <div className="px-5 sm:px-8 py-6 md:py-8 relative z-10 max-w-7xl mx-auto">
          {/* Breadcrumb glassmorphic */}
          <nav className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 backdrop-blur-sm border border-slate-200/50 text-xs font-medium text-slate-600 mb-6">
            <button 
              className="flex items-center gap-1.5 hover:text-slate-900 transition-colors" 
              onClick={() => navigate('/profesor/encuestas/reports')}
            >
              <span className="material-symbols-outlined text-[16px]">bar_chart</span>
              Reportes
            </button>
            <span className="material-symbols-outlined text-[14px] text-slate-400">chevron_right</span>
            {loading ? (
              <div className="w-32 h-4 bg-slate-200/70 rounded-md animate-pulse" />
            ) : (
              <span className="text-slate-800 truncate max-w-[150px] sm:max-w-xs">{surveyTitle}</span>
            )}
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-fade-in-up">
            <div className="flex-1">
              {loading ? (
                <div className="h-9 sm:h-10 lg:h-12 w-[80%] max-w-md bg-slate-200/70 rounded-xl animate-pulse" />
              ) : (
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  {surveyTitle}
                </h1>
              )}
            </div>
            
            {/* Quick Actions (Export) si el reporte está cargado */}
            {report && !loading && (
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="btn btn-primary px-8"
                >
                  <span className="material-symbols-outlined text-[20px]">print</span>
                  Visualizar / Imprimir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">

        {loading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12 mt-2 animate-pulse">
            {/* Left col skeleton */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 lg:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-slate-100" />
                  <div className="h-5 w-48 bg-slate-100 rounded-lg" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
                      <div className="h-4 w-3/4 bg-slate-200 rounded mb-3" />
                      <div className="h-8 w-1/3 bg-slate-200 rounded mb-2" />
                      <div className="h-2.5 w-full bg-slate-100 rounded-full" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Right col skeleton */}
            <div className="lg:col-span-5 xl:col-span-4">
              <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
                <div className="h-5 w-40 bg-slate-100 rounded-lg mb-5" />
                {[0,1,2,3,4].map(i => (
                  <div key={i} className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
                    <div className="w-8 h-8 rounded-full bg-slate-100 shrink-0" />
                    <div className="flex-1">
                      <div className="h-3.5 w-24 bg-slate-100 rounded mb-1.5" />
                      <div className="h-3 w-32 bg-slate-50 rounded" />
                    </div>
                    <div className="h-4 w-10 bg-slate-100 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && !report && (
          <div className="mt-2 bg-yellow-50/80 border border-yellow-200 p-6 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center shrink-0">
               <span className="material-symbols-outlined text-2xl">warning</span>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-bold text-yellow-800 text-lg">No se pudo cargar el reporte</h3>
              <p className="text-sm text-yellow-700 mt-1">Es posible que la encuesta no tenga preguntas, aún no haya recibido respuestas o no cuentes con permisos.</p>
            </div>
            <button onClick={reload} className="px-5 py-2.5 bg-yellow-600 hover:bg-yellow-700 text-white font-semibold rounded-xl transition-colors shrink-0">
              Reintentar
            </button>
          </div>
        )}

        {!loading && report && (
          <div className="animate-fade-in-up" style={{ animationDelay: '50ms' }}>
            
            {report.totalResponses === 0 && (
              <div className="mb-6 bg-slate-50 border border-slate-200 p-5 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">inbox</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900">
                    {survey?.type === 'project' ? 'Aún no hay calificaciones' : 'Aún no hay respuestas'}
                  </h4>
                  <p className="text-sm text-slate-600">
                    {survey?.type === 'project' 
                      ? 'Este proyecto aún no ha sido evaluado. Asigna evaluadores desde el menú de la encuesta para comenzar a recibir resultados.' 
                      : 'Esta encuesta está vacía. ¡Comparte el enlace para empezar a recibir datos!'}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">
              
              {/* Left Column (Main Stats / Ranking) */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">

                {/* Preguntas Simples */}
                {report.questionStats && (
                  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 lg:p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${survey?.type === 'project' ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        <span className="material-symbols-outlined text-[18px]">analytics</span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 tracking-tight">Desglose por pregunta</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {report.questionStats.map((q: any, i: number) => (
                        <QuestionStatCard 
                          key={i} 
                          question={q.question} 
                          counts={q.counts} 
                          answered={q.answered} 
                          options={q.options || []} 
                          texts={q.texts} 
                          questionType={q.questionType} 
                          variant={survey?.type === 'project' ? 'project' : 'simple'}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Ranking de Proyectos */}
                {report.projectSummaries && (
                  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 lg:p-8">
                    <div className="flex items-center justify-between mb-8">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[18px]">trophy</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 tracking-tight">Top proyectos por categoría</h3>
                      </div>
                      <span className="text-xs font-bold bg-slate-100 text-slate-600 rounded-full px-3 py-1 border border-slate-200">
                        {report.projectSummaries.length} proyecto{report.projectSummaries.length !== 1 ? 's' : ''} eval.
                      </span>
                    </div>

                    <div className="space-y-12">
                      {(() => {
                        // Group by category
                        const groups: Record<string, any[]> = {}
                        report.projectSummaries.forEach((ps: any) => {
                           const cat = (ps.project?.category || 'Sin Categoría').trim()
                           if (!groups[cat]) groups[cat] = []
                           groups[cat].push(ps)
                        })

                        // Calculate category maximums
                        const catMaxScore: Record<string, number> = {}
                        Object.keys(groups).forEach(cat => {
                           let max = -1;
                           groups[cat].forEach((ps: any) => { 
                               if (ps.overall !== null && ps.overall > max) { max = ps.overall }
                           })
                           catMaxScore[cat] = max;
                        })

                        const sortedGroupsEntry = Object.entries(groups).sort(([catA], [catB]) => {
                           if (showWinnersOnly) return catMaxScore[catB] - catMaxScore[catA]
                           return catA.localeCompare(catB)
                        })
                        const uniqueCats = sortedGroupsEntry.map(x => x[0])

                        let globalRankCounter = 0;
                        let lastGlobalScore: number | null = null;
                        let lastGlobalRank = 0;
                        let globalScoreCounts: Record<string, number> = {};

                        if (showWinnersOnly && selectedCategory === 'Todas') {
                            sortedGroupsEntry.forEach(([cat, catSummaries]) => {
                                const maxSc = catMaxScore[cat];
                                const winners = catSummaries.filter(ps => ps.overall !== null && ps.overall === maxSc && maxSc > -1);
                                winners.forEach(w => {
                                    const sc = String(w.overall);
                                    globalScoreCounts[sc] = (globalScoreCounts[sc] || 0) + 1;
                                });
                            });
                        }

                        return (
                          <div className="flex flex-col">
                            {uniqueCats.length > 0 && (
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 mb-8 mt-[-10px]">
                                <div className="flex flex-1 items-center gap-2 w-full">
                                  <span className="text-sm font-bold text-slate-500 flex items-center gap-1.5 ml-1 shrink-0 hidden md:flex">
                                    <span className="material-symbols-outlined text-[18px]">filter_list</span> Filtrar
                                  </span>
                                  <Dropdown 
                                    value={selectedCategory} 
                                    label="Todas las Categorías"
                                    icon="category"
                                    options={[
                                      { id: 'Todas', label: 'Todas las Categorías' },
                                      ...uniqueCats.map(cat => ({ id: cat, label: cat }))
                                    ]} 
                                    onChange={setSelectedCategory} 
                                  />
                                </div>
                                
                                  <button
                                    onClick={() => setShowWinnersOnly(prev => !prev)}
                                    className={`shrink-0 mt-2 sm:mt-0 w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold rounded-xl transition-all border ${showWinnersOnly ? 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm ring-1 ring-amber-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                    title={selectedCategory === 'Todas' ? "Ver el mejor proyecto de cada categoría" : `Ver el mejor proyecto de ${selectedCategory}`}
                                  >
                                    <span className="material-symbols-outlined text-[18px]">workspace_premium</span>
                                    {showWinnersOnly ? 'Ocultar resto' : 'Mostrar Ganadores'}
                                  </button>
                              </div>
                            )}

                            <div className="space-y-12">
                              {sortedGroupsEntry
                                .filter(([category]) => selectedCategory === 'Todas' || category === selectedCategory)
                                .map(([category, catSummaries]) => {
                            
                            let visibleSummaries = [...catSummaries]
                            if (showWinnersOnly) {
                                const maxScore = catMaxScore[category]
                                visibleSummaries = visibleSummaries.filter(ps => ps.overall !== null && ps.overall === maxScore && maxScore > -1)
                            }

                            // Sort by score
                            visibleSummaries.sort((a: any, b: any) => {
                               const aScore = a.overall !== null ? a.overall : -1
                               const bScore = b.overall !== null ? b.overall : -1
                               return bScore - aScore
                            })

                            return (
                              <div key={category} className="space-y-4 relative">
                                <h4 className="text-lg font-black text-slate-800 pb-3 border-b-2 border-slate-100 flex items-center gap-2 mb-5">
                                  <span className="material-symbols-outlined text-[20px] text-indigo-500">category</span>
                                  {category}
                                  <span className="ml-auto text-xs font-bold bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md">
                                    {visibleSummaries.length} result.
                                  </span>
                                </h4>
                                <div className="space-y-3">
                                  {visibleSummaries.map((ps: any, i: number) => {
                                    const overall: number | null = ps.overall ?? null
                                    const overallPct = overall !== null
                                      ? Math.max(0, Math.min(100, Math.round(((overall - 1) / 4) * 100)))
                                      : null

                                    let colorIdx = i;
                                    let showTieBadge = false;

                                    if (showWinnersOnly && selectedCategory === 'Todas') {
                                        if (overall !== null && lastGlobalScore !== null && Number(overall) === Number(lastGlobalScore)) {
                                            colorIdx = lastGlobalRank;
                                            globalRankCounter++;
                                        } else {
                                            colorIdx = globalRankCounter;
                                            lastGlobalRank = colorIdx;
                                            lastGlobalScore = overall;
                                            globalRankCounter++;
                                        }
                                        showTieBadge = overall !== null && (globalScoreCounts[String(overall)] || 0) > 1;
                                    } else {
                                        const prevOverall = i > 0 ? (visibleSummaries[i - 1].overall ?? null) : null
                                        const isTied = overall !== null && prevOverall !== null && Number(overall) === Number(prevOverall)
                                        const nextOverall = i < visibleSummaries.length - 1 ? (visibleSummaries[i + 1].overall ?? null) : null
                                        const tiedWithNext = overall !== null && nextOverall !== null && Number(overall) === Number(nextOverall)
                                        showTieBadge = isTied || tiedWithNext

                                        if (isTied) {
                                          let j = i
                                          while (j > 0 && Number(visibleSummaries[j].overall) === Number(visibleSummaries[j - 1].overall)) j--
                                          colorIdx = j
                                        }
                                    }

                                    // Premium colors for podioum (Top 3)
                                    const isTop3 = colorIdx < 3
                                    const rankAccents = ['#f59e0b', '#64748b', '#d97706']
                                    const rankBgs = ['bg-amber-50/50', 'bg-slate-50', 'bg-orange-50/30']
                                    const accentColor = isTop3 ? (rankAccents[colorIdx] ?? '#6366f1') : '#94a3b8'
                                    const cardBgClass = isTop3 ? (rankBgs[colorIdx] ?? 'bg-white') : 'bg-white'
                                    const medals = ['🥇', '🥈', '🥉']

                                    const members: string[] = Array.isArray(ps.project.members)
                                      ? ps.project.members
                                      : typeof ps.project.members === 'string'
                                        ? ps.project.members.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean)
                                        : []

                                    return (
                                      <div
                                        key={ps.project.id}
                                        className={`flex flex-col sm:flex-row sm:items-center rounded-2xl overflow-hidden border ${isTop3 ? 'border-slate-200 shadow-sm' : 'border-slate-100'} hover:border-slate-300 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${cardBgClass} relative group`}
                                      >
                                        <div className={`absolute left-0 top-0 bottom-0 ${isTop3 ? 'w-1.5' : 'w-1'}`} style={{ background: accentColor }} />
                                        
                                        {/* Ranking Num & Medal */}
                                        <div className={`flex sm:flex-col items-center justify-center p-3 sm:py-5 sm:px-6 sm:border-r border-slate-200/60 ${isTop3 ? 'bg-white/40 min-w-[80px]' : 'bg-slate-50/50 min-w-[70px]'}`}>
                                          {isTop3 && <span className="text-2xl mr-2 sm:mr-0 sm:mb-1 drop-shadow-sm">{medals[colorIdx] ?? '🏅'}</span>}
                                          <span className={`${isTop3 ? 'text-sm font-black' : 'text-sm font-bold'} tabular-nums`} style={{ color: accentColor }}>#{colorIdx + 1}</span>
                                        </div>

                                        {/* Project Details */}
                                          <div className="flex-1 p-4 flex flex-col justify-center min-w-0 overflow-hidden">
                                            <div className="mb-1">
                                              <span 
                                                onClick={(e) => toggleTitleExpansion(e, ps.project.id)}
                                                className={`font-black text-slate-800 text-sm sm:text-base leading-tight cursor-pointer transition-all ${expandedTitles.has(ps.project.id) ? 'whitespace-normal' : 'line-clamp-2 break-all'}`}
                                                title={ps.project.name}
                                              >
                                                {ps.project.name}
                                              </span>
                                              {showTieBadge && (
                                                <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500 shadow-sm shrink-0">EMPATE</span>
                                              )}
                                            </div>
                                          {members.length > 0 && (
                                            <div className="text-xs text-slate-500 font-medium">
                                              {members.slice(0, 3).join(' • ')}{members.length > 3 ? ` +${members.length - 3}` : ''}
                                            </div>
                                          )}
                                        </div>

                                        {/* Score & Action */}
                                        <div className="flex items-center justify-between sm:justify-end p-4 border-t sm:border-t-0 border-slate-100 bg-white/30 sm:w-48">
                                          <div className="w-full">
                                            {overall !== null ? (
                                              <>
                                                <div className="flex items-end justify-between mb-2">
                                                  <div className="flex items-baseline gap-1">
                                                    <span className={`text-2xl tabular-nums leading-none tracking-tight ${isTop3 ? 'font-black' : 'font-bold'}`} style={{ color: accentColor }}>{overall.toFixed(2)}</span>
                                                    <span className="text-xs font-bold text-slate-400">/5</span>
                                                  </div>
                                                  <button
                                                    onClick={() => {
                                                      const projectRaw = Array.isArray(report.rawResponses)
                                                        ? report.rawResponses.filter((r: any) => String(r.projectId) === String(ps.project.id))
                                                        : []
                                                      setModalProject({ ...ps, _rawResponses: projectRaw })
                                                    }}
                                                    className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50 transition-all shadow-sm group-hover:scale-105"
                                                    title="Ver detalle"
                                                  >
                                                    <span className="material-symbols-outlined text-[18px]">visibility</span>
                                                  </button>
                                                </div>
                                                <div className="h-1.5 w-full rounded-full bg-slate-200/60 overflow-hidden">
                                                  <div
                                                    className="h-full rounded-full transition-all duration-1000 ease-out"
                                                    style={{ width: `${overallPct}%`, background: accentColor }}
                                                  />
                                                </div>
                                                <div className="text-[10px] text-slate-400 mt-1.5 font-medium">{ps.responses} evaluación{ps.responses !== 1 ? 'es' : ''}</div>
                                              </>
                                            ) : (
                                              <span className="text-sm font-medium text-slate-400 italic">Sin evaluar</span>
                                            )}
                                          </div>
                                        </div>

                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            )
                          })}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column (Panel Lateral) */}
              <div className="lg:col-span-5 xl:col-span-4">
                <div className="sticky top-6">
                  <SurveyDetailPanel report={report} usersCache={usersCache} />
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      </div>

      {modalProject && (
        <ProjectDetailModal ps={modalProject} onClose={() => setModalProject(null)} usersCache={usersCache} />
      )}
      
      {/* Print System */}
      <PrintConfigModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        onPrint={handleGeneratePdf}
        isProject={survey?.type === 'project'}
        categories={availableCategories}
      />
      
      <div className="hidden print:block">
        <PrintLayout
          ref={printRef}
          report={report}
          config={printConfig}
          usersCache={usersCache}
        />
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .animate-fade-in-down {
          animation: fadeInDown 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
  )
}
