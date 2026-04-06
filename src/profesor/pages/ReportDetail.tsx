import React, { useEffect, useState, useLayoutEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import reportHelpers from '../services/reportHelpers'
import supabaseClient from '../../services/supabaseClient'
import QuestionStatCard from '../components/QuestionStatCard'
import SurveyDetailPanel from '../components/SurveyDetailPanel'
import ProjectDetailModal from '../components/ProjectDetailModal'

export default function ReportDetail(): JSX.Element {
  const navigate = useNavigate()
  const { surveyId } = useParams<{ surveyId: string }>()
  const dataClientNow: any = supabaseClient

  const [survey, setSurvey] = useState<any>(null)
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [modalProject, setModalProject] = useState<any>(null)
  const [usersCache, setUsersCache] = useState<Record<string, any>>({})

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
    surveyId

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
    <div id="report-detail-root" className="min-h-screen bg-slate-50/50 pb-24">

      {/* Header Premium */}
      <div className="bg-white border-b border-slate-200/60 shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/[0.03] to-blue-500/[0.04]" />
        
        <div className="px-5 sm:px-8 py-6 md:py-8 relative z-10 max-w-7xl mx-auto">
          {/* Breadcrumb glassmorphic */}
          <nav className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 backdrop-blur-sm border border-slate-200/50 text-xs font-medium text-slate-600 mb-6">
            <button 
              className="flex items-center gap-1.5 hover:text-blue-600 transition-colors" 
              onClick={() => navigate('/profesor/encuestas/reports')}
            >
              <span className="material-symbols-outlined text-[16px]">bar_chart</span>
              Reportes
            </button>
            <span className="material-symbols-outlined text-[14px] text-slate-400">chevron_right</span>
            <span className="text-slate-800 truncate max-w-[150px] sm:max-w-xs">{surveyTitle}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-fade-in-up">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
                {surveyTitle}
              </h1>
            </div>
            
            {/* Quick Actions (Export) si el reporte está cargado */}
            {report && !loading && (
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => report.projectSummaries ? reportHelpers.exportProjectSurveyPdf(report, usersCache, 'preview') : reportHelpers.exportSimpleSurveyPdf(report, usersCache, 'preview')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-slate-900/10 active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[18px]">print</span>
                  Visualizar / Imprimir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">

        {loading && (
          <div className="py-20 flex flex-col items-center justify-center animate-pulse">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
            </div>
            <span className="text-slate-500 font-medium">Buscando datos del informe...</span>
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
              <div className="mb-6 bg-blue-50/50 border border-blue-100 p-5 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined">inbox</span>
                </div>
                <div>
                  <h4 className="font-bold text-blue-900">Aún no hay respuestas</h4>
                  <p className="text-sm text-blue-700">Esta encuesta está vacía. ¡Comparte el enlace para empezar a recibir datos!</p>
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
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                        <span className="material-symbols-outlined text-[18px]">analytics</span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-800 tracking-tight">Desglose por pregunta</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {report.questionStats.map((q: any, i: number) => (
                        <QuestionStatCard key={i} question={q.question} counts={q.counts} answered={q.answered} options={q.options || []} texts={q.texts} questionType={q.questionType} />
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

                        return Object.entries(groups)
                          .sort(([catA], [catB]) => catA.localeCompare(catB))
                          .map(([category, catSummaries]) => {
                            // Sort by score
                            catSummaries.sort((a: any, b: any) => {
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
                                    {catSummaries.length} result.
                                  </span>
                                </h4>
                                <div className="space-y-3">
                                  {catSummaries.map((ps: any, i: number) => {
                                    const overall: number | null = ps.overall ?? null
                                    const overallPct = overall !== null
                                      ? Math.max(0, Math.min(100, Math.round(((overall - 1) / 4) * 100)))
                                      : null

                                    const prevOverall = i > 0 ? (catSummaries[i - 1].overall ?? null) : null
                                    const isTied = overall !== null && prevOverall !== null && Number(overall) === Number(prevOverall)
                                    const nextOverall = i < catSummaries.length - 1 ? (catSummaries[i + 1].overall ?? null) : null
                                    const tiedWithNext = overall !== null && nextOverall !== null && Number(overall) === Number(nextOverall)
                                    const showTieBadge = isTied || tiedWithNext

                                    let colorIdx = i
                                    if (isTied) {
                                      let j = i
                                      while (j > 0 && Number(catSummaries[j].overall) === Number(catSummaries[j - 1].overall)) j--
                                      colorIdx = j
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
                                        <div className="flex-1 p-4 flex flex-col justify-center">
                                          <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <span className="font-bold text-slate-800 text-base">{ps.project.name}</span>
                                            {showTieBadge && (
                                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-500 shadow-sm">EMPATE</span>
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
                                                    onClick={() => setModalProject(ps)}
                                                    className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-all shadow-sm group-hover:scale-105"
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
                          })
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

      {modalProject && (
        <ProjectDetailModal ps={modalProject} onClose={() => setModalProject(null)} />
      )}
      
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  )
}
