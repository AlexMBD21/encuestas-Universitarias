/* Helpers for generating reports from surveys and responses.
  Prefer Firebase RTDB when available; fall back to localStorage for legacy data.
*/
import supabaseClient from '../../services/supabaseClient'

function getDataClient() {
  try {
    const supabaseEnabledNow = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
    return supabaseEnabledNow ? supabaseClient : null
  } catch (e) { return null }
}

export type ReportOpts = { respondentId?: string | null; from?: string | null; to?: string | null; projectId?: string | null }

export type SimpleResponse = {
  surveyId: string
  answers: Record<string, any>
  userId?: string
  submittedAt?: string
}

export type ProjectResponse = {
  surveyId: string
  projectId: string
  userId?: string
  answers: Record<string, number | string>
  submittedAt?: string
}

function _sanitizedKey(k: any) {
  try { return String(k).replace(/[.#$/\[\]]/g, '_') } catch (e) { return String(k) }
}

function extractAnswerFromResponse(resp: any, qid: any, qi?: number, qtext?: string) {
  if (!resp) return undefined
  // prefer top-level answers map
  const answers = resp.answers || {}

  // try numeric/index access
  if (qi !== undefined) {
    if (answers[qi] !== undefined) return answers[qi]
    if (answers[String(qi)] !== undefined) return answers[String(qi)]
  }

  // try direct id/key
  if (qid !== undefined) {
    if (answers[qid] !== undefined) return answers[qid]
    if (answers[String(qid)] !== undefined) return answers[String(qid)]
    const sk = _sanitizedKey(qid)
    if (answers[sk] !== undefined) return answers[sk]
  }

  // sometimes answers were stored under an `answersList` array: [{ qid, value }]
  const al = resp.answersList
  if (Array.isArray(al)) {
    // look for matching qid first, then numeric index
    for (const it of al) {
      try {
        if (!it) continue
        const itqid = String(it.qid)
        if (qid !== undefined && itqid === String(qid)) return it.value
        if (qi !== undefined && itqid === String(qi)) return it.value
        if (qtext && itqid === String(qtext)) return it.value
      } catch (e) {}
    }
  }

  return undefined
}

function readSurveys(): any[] {
  // localStorage fallback removed — data is DB-only
  return []
}

function readResponses(surveyId: string): Array<SimpleResponse | ProjectResponse> {
  // localStorage fallback removed — responses are DB-only
  return []
}

export async function getSurveyList() {
  try {
    const dataClient: any = getDataClient()
    if (dataClient && (dataClient as any).isEnabled && (dataClient as any).isEnabled() && dataClient.getPublishedSurveysOnce) {
      const pubs = await dataClient.getPublishedSurveysOnce()
      return Array.isArray(pubs) ? pubs : []
    }
  } catch (e) {}
  return []
}

export async function getSimpleSurveyReport(surveyId: string, opts?: ReportOpts) {
  let survey: any = null
  try {
    const dataClient: any = getDataClient()
    if (dataClient && (dataClient as any).isEnabled && (dataClient as any).isEnabled() && dataClient.getSurveyById) {
      survey = await dataClient.getSurveyById(String(surveyId))
    }
  } catch (e) { survey = null }
  if (!survey) return null
  const responses = (await (async () => {
    try {
      const dataClient: any = getDataClient()
      if (dataClient && (dataClient as any).isEnabled && (dataClient as any).isEnabled() && dataClient.getSurveyResponsesOnce) {
        return await dataClient.getSurveyResponsesOnce(String(surveyId))
      }
    } catch (e) {}
    return []
  })()) as SimpleResponse[]
  // If responses are empty and no filters are requested, try to use any precomputed report stored under `surveyReports`
  try {
    if ((!responses || responses.length === 0) && (!opts || Object.keys(opts).length === 0)) {
      try {
        const dataClient: any = getDataClient()
        if (dataClient && (dataClient as any).getSurveyReportsOnce) {
          const reps = await (dataClient as any).getSurveyReportsOnce()
          if (Array.isArray(reps) && reps.length > 0) {
            // prefer the most recent report for this surveyId
            const matching = reps.filter(r => r && String(r.surveyId) === String(surveyId))
            if (matching && matching.length > 0) {
              const latest = matching.sort((a: any, b: any) => { try { return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() } catch (e) { return 0 } })[0]
              // the stored report may include the same fields we expect: survey, questionStats, rows
              if (latest) {
                const fromReport = (latest.report || latest.payload || latest) as any
                // Basic validation
                if (fromReport && (fromReport.questionStats || fromReport.rows || fromReport.projectSummaries)) {
                  return { survey: fromReport.survey || survey, questionStats: fromReport.questionStats || [], totalResponses: fromReport.totalResponses ?? 0, rows: fromReport.rows || [] }
                }
              }
            }
          }
        }
      } catch (e) { /* ignore fallback errors */ }
    }
  } catch (e) { /* ignore fallback errors */ }

  // apply client-side filters when provided
  let filteredResponses = Array.isArray(responses) ? responses.slice() : []
  try {
    if (opts) {
      filteredResponses = filteredResponses.filter((r: SimpleResponse) => {
        try {
          if (opts.respondentId) {
            const rid = String((r as any).userId || (r as any).reporterUid || (r as any).reporterId || 'anónimo')
            if (String(opts.respondentId) !== rid) return false
          }
          if (opts.from && r.submittedAt) {
            const rd = new Date(r.submittedAt).getTime()
            if (isNaN(rd) || rd < new Date(opts.from).getTime()) return false
          }
          if (opts.to && r.submittedAt) {
            const rd = new Date(r.submittedAt).getTime()
            if (isNaN(rd) || rd > new Date(opts.to).getTime()) return false
          }
          return true
        } catch (e) { return true }
      })
    }
  } catch (e) { /* ignore filter errors */ }
  const questions = survey.questions || []
  // Build question aggregates using filtered responses
  const questionStats = questions.map((q: any, qi: number) => {
    const counts: Record<string, number> = {}
    const texts: string[] = []
    let answered = 0
    filteredResponses.forEach((r: SimpleResponse) => {
      const rawAns = extractAnswerFromResponse(r, q.id ?? q.qid ?? q.name, qi, q.text)
      if (rawAns !== undefined && rawAns !== null && String(rawAns).trim() !== '') {
        answered++
        let key = String(rawAns)
        try {
          if (q && q.type === 'multiple' && Array.isArray(q.options)) {
            const idx = Number(rawAns)
            if (!isNaN(idx) && q.options[idx] !== undefined) {
              key = String(q.options[idx])
            } else if (q.options.includes(String(rawAns))) {
              key = String(rawAns)
            }
          }
        } catch (e) {}
        counts[key] = (counts[key] || 0) + 1
        if (q.type === 'text') texts.push(String(rawAns).trim())
      }
    })
    return { question: q.text || `Pregunta ${qi+1}`, counts, answered, options: Array.isArray(q.options) ? q.options : [], texts, questionType: q.type || 'text' }
  })

  // Rows for CSV: each (filtered) response as a row
  const rows = filteredResponses.map((r: SimpleResponse) => {
    const row: any = { userId: r.userId || 'anónimo', submittedAt: r.submittedAt || '' }
    questions.forEach((q: any, qi: number) => {
      let a = extractAnswerFromResponse(r, q.id ?? q.qid ?? q.name, qi, q.text)
      try {
        if (a !== undefined && a !== null && q && q.type === 'multiple' && Array.isArray(q.options)) {
          const idx = Number(a)
          if (!isNaN(idx) && q.options[idx] !== undefined) a = q.options[idx]
        }
      } catch (e) {}
      row[q.text || `Pregunta ${qi+1}`] = a ?? ''
    })
    return row
  })

  // extract respondent ids for UI filters
  const respondentIds = Array.from(new Set((filteredResponses || []).map(r => String((r as any).userId || (r as any).reporterUid || (r as any).reporterId || 'anónimo'))))

  return { survey, questionStats, totalResponses: filteredResponses.length, rows, respondentIds }
}

export async function getProjectSurveyReport(surveyId: string, opts?: ReportOpts) {
  let survey: any = null
  try {
    const dataClient: any = getDataClient()
    if (dataClient && (dataClient as any).isEnabled && (dataClient as any).isEnabled() && dataClient.getSurveyById) {
      survey = await dataClient.getSurveyById(String(surveyId))
    }
  } catch (e) { survey = null }
  if (!survey) return null
  const responses = (await (async () => {
    try {
      const dataClient: any = getDataClient()
      if (dataClient && (dataClient as any).isEnabled && (dataClient as any).isEnabled() && dataClient.getSurveyResponsesOnce) {
        return await dataClient.getSurveyResponsesOnce(String(surveyId))
      }
    } catch (e) {}
    return []
  })()) as ProjectResponse[]
  // apply client-side filters when provided
  // and filter out responses for projects that no longer exist in the survey
  const projects = survey.projects || []
  const activeProjectIds = new Set(projects.map((p: any) => String(p.id)))

  let filteredResponses = (Array.isArray(responses) ? responses : [])
    .filter((r: ProjectResponse) => r && r.projectId && activeProjectIds.has(String(r.projectId)))

  try {
    if (opts) {
      filteredResponses = filteredResponses.filter((r: ProjectResponse) => {
        try {
          if (opts.respondentId) {
            const rid = String((r as any).userId || (r as any).reporterUid || (r as any).reporterId || 'anónimo')
            if (String(opts.respondentId) !== rid) return false
          }
          if (opts.projectId) {
            if (String((r as any).projectId) !== String(opts.projectId)) return false
          }
          if (opts.from && r.submittedAt) {
            const rd = new Date(r.submittedAt).getTime()
            if (isNaN(rd) || rd < new Date(opts.from).getTime()) return false
          }
          if (opts.to && r.submittedAt) {
            const rd = new Date(r.submittedAt).getTime()
            if (isNaN(rd) || rd > new Date(opts.to).getTime()) return false
          }
          return true
        } catch (e) { return true }
      })
    }
  } catch (e) { /* ignore filter errors */ }
  const rubric = survey.rubric || []

  // For each project compute per-criterion averages and overall average
  const projectSummaries = projects.map((p: any) => {
    const projResponses = filteredResponses.filter((r: ProjectResponse) => String(r.projectId) === String(p.id))
    const criteria: Array<{ id: string; text: string; avg: number | null; count: number; texts: string[] }> = rubric.map((r: any) => {
      let sum = 0
      let count = 0
      const texts: string[] = []
      const qid = r.id ?? r.text

      projResponses.forEach((pr: ProjectResponse) => {
        const scoreRaw = extractAnswerFromResponse(pr, qid, undefined, r.text)
        const commentRaw = extractAnswerFromResponse(pr, `${qid}_comment`)
        
        // Handle Score
        const num = Number(scoreRaw)
        if (scoreRaw !== '' && scoreRaw !== null && scoreRaw !== undefined && !isNaN(num)) {
          sum += num
          count++
        } else if (scoreRaw !== null && scoreRaw !== undefined && String(scoreRaw).trim() !== '' && isNaN(num)) {
          // Legacy: if it was a text question, the scoreRaw WAS the text
          texts.push(String(scoreRaw).trim())
        }

        // Handle Comment (New dual-key format)
        if (commentRaw !== null && commentRaw !== undefined && String(commentRaw).trim() !== '') {
          texts.push(String(commentRaw).trim())
        }
      })
      return { id: r.id, text: r.text, avg: count ? +(sum / count).toFixed(2) : null, count, texts }
    })
    // overall average across numeric criteria (ignore text criteria)
    const numericAvgs = criteria.filter(c => c.avg !== null).map(c => c.avg as number)
    const overall = numericAvgs.length ? +(numericAvgs.reduce((a,b) => a+b, 0) / numericAvgs.length).toFixed(2) : null
    return { project: p, criteria, responses: projResponses.length, overall }
  })

  // sort by overall desc (nulls last)
  projectSummaries.sort((a: any, b: any) => {
    if (a.overall === null && b.overall === null) return 0
    if (a.overall === null) return 1
    if (b.overall === null) return -1
    return (b.overall as number) - (a.overall as number)
  })

  // CSV rows: one row per project with averages per criterion
  const rows = projectSummaries.map((ps: any) => {
    const row: any = { projectId: ps.project.id, projectName: ps.project.name || '', responses: ps.responses, overall: ps.overall ?? '' }
    ps.criteria.forEach((c: any) => (row[c.text || c.id] = c.avg ?? ''))
    return row
  })

  // extract respondent ids for UI filters
  const respondentIds = Array.from(new Set((filteredResponses || []).map(r => String((r as any).userId || (r as any).reporterUid || (r as any).reporterId || 'anónimo'))))

  return { survey, rubric, projectSummaries, totalResponses: filteredResponses.length, rows, rawResponses: filteredResponses, respondentIds }
}

export function exportCsv(rows: any[], filename = 'report.csv') {
  if (!rows || rows.length === 0) {
    const blob = new Blob([""], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    return
  }
  const keys: string[] = Array.from(rows.reduce((acc, r: any) => { Object.keys(r).forEach((k: string) => acc.add(k)); return acc }, new Set<string>()))
  const csv = [keys.join(','), ...rows.map((r: any) => keys.map((k: string) => {
    const v = (r as any)[k]
    if (v === undefined || v === null) return ''
    const s = String(v).replace(/"/g, '""')
    return `"${s}"`
  }).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
}

function csvCell(v: any): string {
  if (v === undefined || v === null) return '""'
  return `"${String(v).replace(/"/g, '""')}"`
}

function csvRow(cells: any[]): string {
  return cells.map(csvCell).join(',')
}

/**
 * Exports a rich CSV for a simple survey with three sections:
 *   1. Metadata block (survey title, description, export date, total responses)
 *   2. Summary per question (option → count → %)
 *   3. Raw responses (one row per respondent with all answers)
 */
export function exportSimpleSurveyReport(report: {
  survey: any
  questionStats: Array<{ question: string; counts: Record<string,number>; answered: number; options?: string[]; texts?: string[]; questionType?: string }>
  rows: any[]
  totalResponses: number
}, filename?: string) {
  const title = report.survey?.title || 'Encuesta'
  const description = report.survey?.description || ''
  const exportDate = new Date().toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })
  const fname = filename || `${title.replace(/\s+/g, '_')}_reporte.csv`

  const lines: string[] = []

  // ── SECTION 1: Metadata ──────────────────────────────────────────────────
  lines.push(csvRow(['ENCUESTA', title]))
  if (description) lines.push(csvRow(['DESCRIPCIÓN', description]))
  lines.push(csvRow(['FECHA DE EXPORTACIÓN', exportDate]))
  lines.push(csvRow(['TOTAL RESPUESTAS', report.totalResponses]))
  lines.push('')

  // ── SECTION 2: Summary per question ─────────────────────────────────────
  lines.push(csvRow(['RESUMEN POR PREGUNTA', '', '', '']))
  lines.push(csvRow(['PREGUNTA', 'TIPO', 'OPCIÓN / RESPUESTA', 'CANTIDAD', '%']))

  for (const qs of report.questionStats) {
    const tipo = qs.questionType === 'text' ? 'Abierta' : 'Opción múltiple'
    if (qs.questionType === 'text') {
      const textCount = qs.texts?.length ?? 0
      if (textCount === 0) {
        lines.push(csvRow([qs.question, tipo, '(sin respuestas)', 0, '0%']))
      } else {
        qs.texts?.forEach((t, i) => {
          lines.push(csvRow([i === 0 ? qs.question : '', i === 0 ? tipo : '', t, '', '']))
        })
      }
    } else {
      // multiple choice — show all options incl. those with 0 votes
      const options = qs.options && qs.options.length > 0 ? qs.options : Object.keys(qs.counts)
      options.forEach((opt, i) => {
        const cnt = qs.counts[opt] || 0
        const pct = qs.answered > 0 ? Math.round((cnt / qs.answered) * 100) : 0
        lines.push(csvRow([i === 0 ? qs.question : '', i === 0 ? tipo : '', opt, cnt, `${pct}%`]))
      })
    }
    lines.push('') // blank line between questions
  }

  // ── SECTION 3: Raw responses ─────────────────────────────────────────────
  lines.push(csvRow(['RESPUESTAS INDIVIDUALES', '', '', '']))
  if (report.rows.length === 0) {
    lines.push(csvRow(['Sin respuestas registradas']))
  } else {
    const keys: string[] = Array.from(
      report.rows.reduce((acc: Set<string>, r: any) => { Object.keys(r).forEach(k => acc.add(k)); return acc }, new Set<string>())
    )
    // Friendly header labels
    const headerLabels = keys.map(k => {
      if (k === 'userId') return 'Usuario'
      if (k === 'submittedAt') return 'Fecha de respuesta'
      return k
    })
    lines.push(csvRow(headerLabels))
    for (const r of report.rows) {
      lines.push(csvRow(keys.map(k => {
        if (k === 'submittedAt' && r[k]) {
          try { return new Date(r[k]).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) } catch { return r[k] }
        }
        return r[k]
      })))
    }
  }

  const bom = '\uFEFF' // UTF-8 BOM for correct accents in Excel
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = fname
  link.click()
}


const reportHelpers = { getSurveyList, getSimpleSurveyReport, getProjectSurveyReport, exportCsv, exportSimpleSurveyReport }
export default reportHelpers
