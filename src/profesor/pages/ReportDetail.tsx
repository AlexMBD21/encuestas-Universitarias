import React, { useEffect, useState } from 'react'
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
        if (report && Array.isArray(report.rows)) {
          const uids = Array.from(new Set(
            report.rows
              .map((r: any) => String(r.userId || r.user || r.reporterId || ''))
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
    <div id="report-detail-root" className="px-4 py-4 sm:p-6">

      {/* Breadcrumb */}
      <nav className="page-breadcrumb" aria-label="Ruta de navegación">
        <button className="page-breadcrumb-link" onClick={() => navigate('/profesor/encuestas/reports')}>
          <span className="material-symbols-outlined">bar_chart</span>
          Reportes
        </button>
        <span className="material-symbols-outlined page-breadcrumb-sep">chevron_right</span>
        <span className="page-breadcrumb-current">{surveyTitle}</span>
      </nav>

      <h1 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">{surveyTitle}</h1>

      {loading && (
        <div className="mt-10 flex flex-col items-center justify-center gap-3">
          <svg className="animate-spin" width="40" height="40" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="#d1d5db" strokeWidth="3" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span className="text-slate-500 text-sm">Cargando informe...</span>
        </div>
      )}

      {!loading && !report && (
        <div className="mt-6 p-4 border rounded bg-yellow-50">
          <div className="font-semibold mb-2">No se pudo cargar el reporte de esta encuesta</div>
          <div className="text-sm text-slate-700 mb-2">Posibles causas: la encuesta no tiene preguntas, no hay respuestas registradas, o no tienes permisos de lectura.</div>
          <div className="flex items-center gap-3">
            <button onClick={reload} className="px-3 py-2 bg-blue-600 text-white rounded">Reintentar</button>
          </div>
        </div>
      )}

      {!loading && report && (
        <div>
          {report.totalResponses === 0 && (
            <div className="mb-4 p-3 border rounded bg-yellow-50">
              <div className="font-semibold">No hay respuestas registradas</div>
              <div className="text-sm text-slate-600">Esta encuesta no tiene respuestas aún.</div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-4">
            <div className="lg:col-span-2">
              {report.questionStats && (
                <div className="mb-4">
                  <h3 className="font-semibold mb-2">Resumen por pregunta</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {report.questionStats.map((q: any, i: number) => (
                      <QuestionStatCard key={i} question={q.question} counts={q.counts} answered={q.answered} options={q.options || []} texts={q.texts} questionType={q.questionType} />
                    ))}
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={() => reportHelpers.exportSimpleSurveyPdf(report, usersCache)}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                    >
                      Exportar informe (PDF)
                    </button>
                  </div>
                </div>
              )}

              {report.projectSummaries && (
                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-base text-slate-800 tracking-tight">Ranking de proyectos</h3>
                    <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-3 py-1 font-medium">
                      {report.projectSummaries.length} proyecto{report.projectSummaries.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {report.projectSummaries.map((ps: any, i: number) => {
                      const overall: number | null = ps.overall ?? null
                      const overallPct = overall !== null
                        ? Math.max(0, Math.min(100, Math.round(((overall - 1) / 4) * 100)))
                        : null

                      // Detect tie
                      const prevOverall = i > 0 ? (report.projectSummaries[i - 1].overall ?? null) : null
                      const isTied = overall !== null && prevOverall !== null && Number(overall) === Number(prevOverall)
                      const nextOverall = i < report.projectSummaries.length - 1 ? (report.projectSummaries[i + 1].overall ?? null) : null
                      const tiedWithNext = overall !== null && nextOverall !== null && Number(overall) === Number(nextOverall)
                      const showTieBadge = isTied || tiedWithNext

                      let colorIdx = i
                      if (isTied) {
                        let j = i
                        while (j > 0 && Number(report.projectSummaries[j].overall) === Number(report.projectSummaries[j - 1].overall)) j--
                        colorIdx = j
                      }

                      const rankAccents = ['#f59e0b', '#94a3b8', '#f97316']
                      const rankBgs = ['#fffbeb', '#f8fafc', '#fff7ed']
                      const accentColor = rankAccents[colorIdx] ?? '#6366f1'
                      const cardBg = rankBgs[colorIdx] ?? '#ffffff'
                      const medals = ['🥇', '🥈', '🥉']

                      const members: string[] = Array.isArray(ps.project.members)
                        ? ps.project.members
                        : typeof ps.project.members === 'string'
                          ? ps.project.members.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean)
                          : []

                      return (
                        <div
                          key={ps.project.id}
                          className="flex items-stretch rounded-xl overflow-hidden border border-slate-200 transition-all duration-200 hover:shadow-md hover:-translate-y-px"
                          style={{ background: cardBg }}
                        >
                          {/* Left accent stripe */}
                          <div className="w-1 self-stretch shrink-0" style={{ background: accentColor }} />

                          {/* Main content */}
                          <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center">
                            {/* Row 1: rank + project info */}
                            <div className="flex items-center flex-1 min-w-0">
                              {/* Rank badge */}
                              <div className="shrink-0 w-10 sm:w-12 flex flex-col items-center justify-center py-3 sm:py-4 px-1 gap-0.5 self-stretch">
                                <span className="text-base sm:text-lg leading-none">{medals[colorIdx] ?? '🏅'}</span>
                                <span className="text-[10px] font-black tabular-nums" style={{ color: accentColor }}>#{colorIdx + 1}</span>
                              </div>

                              {/* Divider */}
                              <div className="w-px self-stretch bg-slate-100 shrink-0" />

                              {/* Project info */}
                              <div className="flex-1 min-w-0 py-2.5 px-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-slate-800 text-sm leading-snug">{ps.project.name}</span>
                                  {showTieBadge && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 whitespace-nowrap">= Empate</span>
                                  )}
                                </div>
                                {members.length > 0 && (
                                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                                    {members.slice(0, 3).join(' · ')}{members.length > 3 ? ` +${members.length - 3}` : ''}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Row 2 (mobile) / right section (sm+): score + button */}
                            <div className="flex items-center border-t border-slate-100 sm:border-t-0 sm:border-l">
                              {/* Score block */}
                              <div className="flex-1 sm:flex-none sm:w-32 py-2.5 sm:py-3 px-3">
                                {overall !== null ? (
                                  <>
                                    <div className="flex items-baseline gap-1 sm:justify-end mb-1.5">
                                      <span className="text-sm sm:text-base font-black tabular-nums leading-none" style={{ color: accentColor }}>{overall.toFixed(2)}</span>
                                      <span className="text-[10px] text-slate-400 font-medium">/5</span>
                                      {overallPct !== null && (
                                        <span className="text-xs font-bold text-slate-500 ml-0.5">{overallPct}%</span>
                                      )}
                                    </div>
                                    {overallPct !== null && (
                                      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: accentColor + '22' }}>
                                        <div
                                          className="h-full rounded-full transition-all duration-700"
                                          style={{ width: `${overallPct}%`, background: accentColor }}
                                        />
                                      </div>
                                    )}
                                    <div className="text-[10px] text-slate-400 mt-1 sm:text-right">{ps.responses} calificación{ps.responses !== 1 ? 'es' : ''}</div>
                                  </>
                                ) : (
                                  <span className="text-xs text-slate-400 italic">Sin datos</span>
                                )}
                              </div>

                              {/* Action */}
                              <div className="shrink-0 pr-3 pl-2">
                                <button
                                  onClick={() => setModalProject(ps)}
                                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 whitespace-nowrap hover:opacity-80"
                                  style={{ color: accentColor, borderColor: accentColor + '66', background: accentColor + '10' }}
                                >
                                  Ver detalle
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="mt-4">
                    <button
                      onClick={() => reportHelpers.exportProjectSurveyPdf(report, usersCache)}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                    >
                      Exportar informe (PDF)
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              <div className="rounded border bg-white">
                <SurveyDetailPanel report={report} usersCache={usersCache} />
              </div>
            </div>
          </div>
        </div>
      )}

      {modalProject && (
        <ProjectDetailModal ps={modalProject} onClose={() => setModalProject(null)} />
      )}
    </div>
  )
}
