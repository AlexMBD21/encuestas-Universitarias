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

/**
 * Opens a new browser window with a styled HTML report and triggers the
 * print/Save-as-PDF dialog. No external libraries required.
 */
function _openOrDownload(html: string, filename: string, autoPrint: boolean) {
  if (autoPrint) {
    // Use a hidden iframe so no popup window is needed — works on mobile
    try {
      const iframe = document.createElement('iframe')
      iframe.setAttribute('aria-hidden', 'true')
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;opacity:0;border:none;'
      document.body.appendChild(iframe)
      const iDoc = iframe.contentDocument || (iframe.contentWindow && iframe.contentWindow.document)
      if (!iDoc) throw new Error('no iframe doc')
      iDoc.open(); iDoc.write(html); iDoc.close()
      const iWin = iframe.contentWindow
      if (!iWin) throw new Error('no iframe window')
      let printed = false
      const cleanup = () => { try { iframe.remove() } catch (e2) {} }
      const triggerPrint = () => {
        if (printed) return
        printed = true
        try { iWin.focus(); iWin.print() } catch (e) {}
        setTimeout(cleanup, 2000)
      }
      // Most browsers fire onload after content is ready
      iWin.onload = triggerPrint
      // Fallback: if onload doesn't fire, try after a short delay
      setTimeout(triggerPrint, 600)
      return
    } catch (e) {}
    // Last resort: download HTML file
    try {
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename
      document.body.appendChild(a); a.click()
      setTimeout(() => { try { URL.revokeObjectURL(url); a.remove() } catch (e) {} }, 1500)
    } catch (e) {}
    return
  }
  // Preview mode: open in new window, fallback to download
  try {
    const win = window.open('', '_blank', 'width=960,height=720')
    if (win) { win.document.write(html); win.document.close(); return }
  } catch (e) {}
  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename
    document.body.appendChild(a); a.click()
    setTimeout(() => { try { URL.revokeObjectURL(url); a.remove() } catch (e) {} }, 1500)
  } catch (e) {}
}

export function exportSimpleSurveyPdf(report: {
  survey: any
  questionStats: Array<{ question: string; counts: Record<string,number>; answered: number; options?: string[]; texts?: string[]; questionType?: string }>
  rows: any[]
  totalResponses: number
}, usersCache?: Record<string, any>, mode?: 'preview' | 'print') {
  const autoPrint = mode === 'print'
  const title = report.survey?.title || 'Encuesta'
  const description = report.survey?.description || ''
  const exportDate = new Date().toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' })

  const esc = (s: any) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

  // Build question blocks
  const questionBlocks = report.questionStats.map((qs, qi) => {
    const isText = qs.questionType === 'text'
    const badge = isText
      ? `<span class="badge badge-open">Abierta</span>`
      : `<span class="badge badge-multi">Opción múltiple</span>`

    const answered = qs.answered || 0

    let body = ''
    if (isText) {
      if (!qs.texts || qs.texts.length === 0) {
        body = `<p class="empty">Sin comentarios registrados.</p>`
      } else {
        body = qs.texts.map(t => `<div class="comment">${esc(t)}</div>`).join('')
        body = `<div class="comment-list">${body}</div>`
      }
    } else {
      const options = qs.options && qs.options.length > 0 ? qs.options : Object.keys(qs.counts)
      const bars = options.map(opt => {
        const cnt = qs.counts[opt] || 0
        const pct = answered > 0 ? Math.round((cnt / answered) * 100) : 0
        const dimmed = cnt === 0 ? 'dimmed' : ''
        return `
          <div class="bar-row ${dimmed}">
            <div class="bar-label">${esc(opt)}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
            <div class="bar-meta">${cnt} <span class="bar-pct">${pct}%</span></div>
          </div>`
      }).join('')
      body = `<div class="bar-list">${bars}</div>`
    }

    return `
      <div class="q-card">
        <div class="q-header">
          <div class="q-num">P${qi + 1}</div>
          <div class="q-title">${esc(qs.question)}</div>
          ${badge}
        </div>
        <div class="q-meta">${answered} respuesta${answered !== 1 ? 's' : ''}</div>
        ${body}
      </div>`
  }).join('')

  // Build responses table
  const questions = report.questionStats.map(qs => qs.question)
  const resolveUser = (uid: string) => {
    if (!uid || uid === 'anónimo') return uid
    if (usersCache && usersCache[uid]) {
      const u = usersCache[uid]
      return u.email || u.name || u.displayName || uid
    }
    return uid
  }

  const tableRows = report.rows.map((r: any, i: number) => {
    const date = r.submittedAt ? (() => { try { return new Date(r.submittedAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' }) } catch { return r.submittedAt } })() : '—'
    const cells = questions.map(q => `<td>${esc(r[q] ?? '—')}</td>`).join('')
    return `<tr class="${i % 2 === 0 ? 'even' : ''}"><td class="user-cell">${esc(resolveUser(r.userId || '—'))}</td><td>${esc(date)}</td>${cells}</tr>`
  }).join('')

  const tableHeaders = questions.map(q => `<th>${esc(q)}</th>`).join('')

  const _simpleToolbar = autoPrint
    ? ''
    : `<div style="position:sticky;top:0;z-index:9999;background:#1e293b;padding:8px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.3);">
        <span style="font-size:13px;font-weight:700;color:#e2e8f0;white-space:nowrap;flex:1">&#128196; Vista previa</span>
        <button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;">&#128424;&#65039; Imprimir / Guardar PDF</button>
      </div>`
  const _simpleAutoprint = ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${esc(title)} — Informe</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #f8fafc; }

  /* ── Header ── */
  .report-header {
    background: linear-gradient(135deg, #0f4c81 0%, #1565c0 60%, #0891b2 100%);
    color: #fff; padding: 32px 40px 28px; border-radius: 0 0 16px 16px;
  }
  .report-header h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
  .report-header p { font-size: 12px; opacity: .85; }
  .meta-pills { display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
  .meta-pill { background: rgba(255,255,255,0.15); border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 600; }

  /* ── Sections ── */
  .section { padding: 24px 40px 0; }
  .section-title { font-size: 15px; font-weight: 700; color: #0f172a; border-left: 4px solid #0891b2; padding-left: 10px; margin-bottom: 16px; }

  /* ── Question cards ── */
  .q-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 18px; margin-bottom: 14px; break-inside: avoid; }
  .q-header { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 4px; }
  .q-num { background: #0891b2; color: #fff; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; shrink: 0; flex-shrink: 0; }
  .q-title { font-size: 13px; font-weight: 600; color: #0f172a; flex: 1; line-height: 1.4; }
  .q-meta { font-size: 11px; color: #94a3b8; margin-bottom: 12px; margin-left: 34px; }
  .badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
  .badge-open { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  .badge-multi { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }

  /* ── Bars ── */
  .bar-list { display: flex; flex-direction: column; gap: 8px; }
  .bar-row { display: flex; align-items: center; gap: 10px; }
  .bar-row.dimmed .bar-label { color: #94a3b8; }
  .bar-label { width: 160px; font-size: 12px; color: #334155; flex-shrink: 0; }
  .bar-track { flex: 1; background: #f1f5f9; border-radius: 99px; height: 10px; overflow: hidden; }
  .bar-fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #0891b2); border-radius: 99px; }
  .bar-row.dimmed .bar-fill { background: #e2e8f0; }
  .bar-meta { width: 60px; text-align: right; font-size: 11px; font-weight: 600; color: #0f172a; }
  .bar-pct { color: #64748b; font-weight: 400; margin-left: 2px; }

  /* ── Comments ── */
  .comment-list { display: flex; flex-direction: column; gap: 6px; }
  .comment { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 12px; font-size: 12px; color: #334155; line-height: 1.5; }
  .empty { font-size: 12px; color: #94a3b8; font-style: italic; }

  /* ── Responses table ── */
  .table-wrap { overflow: hidden; border-radius: 12px; border: 1px solid #e2e8f0; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead { background: #0f4c81; color: #fff; }
  thead th { padding: 10px 12px; text-align: left; font-weight: 600; }
  tbody tr { border-bottom: 1px solid #f1f5f9; }
  tbody tr.even { background: #f8fafc; }
  tbody td { padding: 8px 12px; color: #334155; }
  .user-cell { color: #0891b2; font-weight: 600; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  /* ── Footer ── */
  .footer { padding: 20px 40px 32px; font-size: 10px; color: #94a3b8; text-align: center; }

  /* ── Print ── */
  @page { margin: 16mm 12mm; }
  @media print {
    html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: #fff; }
    .report-header { border-radius: 0; }
  }
  .toolbar{position:sticky;top:0;z-index:9999;background:#1e293b;padding:8px 16px;display:flex;align-items:center;box-shadow:0 2px 8px rgba(0,0,0,.3);}
  .toolbar-inner{display:flex;align-items:center;flex-wrap:wrap;gap:10px;width:100%;}
  .toolbar-brand{font-size:13px;font-weight:700;color:#e2e8f0;white-space:nowrap;}
  .t-sep{width:1px;height:22px;background:rgba(255,255,255,.15);flex-shrink:0;}
  .ctrl{display:flex;align-items:center;gap:5px;cursor:pointer;}
  .ctrl-lbl{font-size:11px;color:#94a3b8;white-space:nowrap;user-select:none;}
  .ctrl input[type=color]{width:26px;height:26px;border:2px solid rgba(255,255,255,.2);border-radius:6px;cursor:pointer;padding:1px;background:transparent;}
  .ctrl-check{gap:6px;}
  .ctrl-check input[type=checkbox]{width:14px;height:14px;cursor:pointer;accent-color:#3b82f6;}
  .ctrl-check .ctrl-lbl{color:#e2e8f0;}
  .btn-print{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;margin-left:auto;}
  .btn-print:hover{background:#1d4ed8;}
  @media print{.toolbar{display:none!important;}body{padding-top:0!important;}}
  .edit-active{outline:2px dashed #3b82f6!important;min-width:10px;}
</style>
</head>
<body>
${_simpleToolbar}

<div class="report-header">
  <h1>${esc(title)}</h1>
  ${description ? `<p>${esc(description)}</p>` : ''}
  <div class="meta-pills">
    <div class="meta-pill">📊 ${report.questionStats.length} pregunta${report.questionStats.length !== 1 ? 's' : ''}</div>
    <div class="meta-pill">📋 ${report.totalResponses} respuesta${report.totalResponses !== 1 ? 's' : ''}</div>
    <div class="meta-pill">📅 ${esc(exportDate)}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Resumen por pregunta</div>
  ${questionBlocks}
</div>

<div class="section" style="padding-top:24px;">
  <div class="section-title">Respuestas individuales</div>
  ${report.rows.length === 0
    ? '<p class="empty" style="margin-bottom:24px">Sin respuestas registradas.</p>'
    : `<div class="table-wrap"><table>
        <thead><tr><th>Usuario</th><th>Fecha</th>${tableHeaders}</tr></thead>
        <tbody>${tableRows}</tbody>
      </table></div>`
  }
</div>

<div class="footer">Generado el ${esc(exportDate)} · ${esc(title)}</div>

<script>
function setHdrColor(v){document.querySelectorAll('.report-header').forEach(function(e){e.style.background=v;});}
function setAccent(v){
  var s=document.getElementById('dyn');
  if(!s){s=document.createElement('style');s.id='dyn';document.head.appendChild(s);}
  s.textContent='.section-title{border-left-color:'+v+' !important}.q-num{background:'+v+' !important}.user-cell{color:'+v+' !important}';
  document.querySelectorAll('.bar-fill').forEach(function(e){e.style.background=v;});
}
function toggleEdit(on){
  var sel='h1,p,.q-title,.comment,.bar-label,.meta-pill,.section-title,.footer';
  document.querySelectorAll(sel).forEach(function(e){
    if(on){e.contentEditable='true';e.classList.add('edit-active');}
    else{e.removeAttribute('contenteditable');e.classList.remove('edit-active');}
  });
}
${_simpleAutoprint}<\/script>
</body>
</html>`

  _openOrDownload(html, title.replace(/\s+/g, '_') + '_informe.html', autoPrint)
}

/**
 * Opens a styled print/PDF window for a project-type survey report.
 */
export function exportProjectSurveyPdf(report: {
  survey: any
  projectSummaries: Array<{
    project: { id: string; name: string; description?: string; members?: any; advisor?: string }
    responses: number
    overall: number | null
    criteria: Array<{ id: string; text: string; avg: number | null; count: number; texts?: string[] }>
  }>
  totalResponses: number
  rawResponses?: any[]
}, usersCache?: Record<string, any>, mode?: 'preview' | 'print') {
  const autoPrint = mode !== 'preview'
  const title = report.survey?.title || 'Encuesta de Proyectos'
  const description = report.survey?.description || ''
  const exportDate = new Date().toLocaleString('es', { dateStyle: 'long', timeStyle: 'short' })

  const esc = (s: any) => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

  const toPercent = (v: number | null) => {
    if (v === null || v === undefined) return 0
    return Math.max(0, Math.min(100, Math.round(((Number(v) - 1) / 4) * 100)))
  }

  const scoreColor = (avg: number | null) => {
    if (avg === null) return '#06b6d4'
    const v = Number(avg)
    if (v <= 1.5) return '#ef4444'
    if (v <= 2.5) return '#f97316'
    if (v <= 3.5) return '#eab308'
    if (v <= 4.5) return '#22c55e'
    return '#06b6d4'
  }

  const medals = ['🥇', '🥈', '🥉']
  const rankBorders = ['#f59e0b', '#94a3b8', '#f97316']

  const resolveUser = (uid: string) => {
    if (!uid || uid === 'anónimo') return uid
    if (usersCache && usersCache[uid]) {
      const u = usersCache[uid]
      return u.email || u.name || u.displayName || uid
    }
    return uid
  }

  // Build project cards
  const projectCards = report.projectSummaries.map((ps, i) => {
    const prevOverall = i > 0 ? report.projectSummaries[i - 1].overall : null
    const nextOverall = i < report.projectSummaries.length - 1 ? report.projectSummaries[i + 1].overall : null
    const isTied = (prevOverall !== null && ps.overall !== null && Number(ps.overall) === Number(prevOverall)) ||
                   (nextOverall !== null && ps.overall !== null && Number(ps.overall) === Number(nextOverall))
    let tieGroupIdx = i
    if (isTied) {
      let j = i
      while (j > 0 && Number(report.projectSummaries[j].overall) === Number(report.projectSummaries[j-1].overall)) j--
      tieGroupIdx = j
    }

    const pct = toPercent(ps.overall)
    const border = rankBorders[tieGroupIdx] ?? '#06b6d4'
    const medal = medals[tieGroupIdx] ?? `#${tieGroupIdx + 1}`

    const members: string[] = Array.isArray(ps.project.members)
      ? ps.project.members
      : typeof ps.project.members === 'string'
        ? ps.project.members.split(/[;,]/).map((s: string) => s.trim()).filter(Boolean)
        : []

    // Overall bar
    const overallBar = ps.overall !== null ? `
      <div class="bar-row">
        <div class="bar-label-wide"><strong>Promedio global</strong></div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${border}"></div></div>
        <div class="bar-meta">${ps.overall.toFixed(2)}/5 <span class="bar-pct">${pct}%</span></div>
      </div>` : ''

    // Criteria bars
    const criteriaRows = ps.criteria.map(c => {
      if (c.avg === null) return '' // text criteria handled separately
      const cpct = toPercent(c.avg)
      const col = scoreColor(c.avg)
      return `
        <div class="bar-row">
          <div class="bar-label-wide">${esc(c.text)}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${cpct}%;background:${col}"></div></div>
          <div class="bar-meta" style="color:${col}">${c.avg.toFixed(2)}/5 <span class="bar-pct">${cpct}%</span></div>
        </div>`
    }).join('')

    // Open text criteria (now includes comments from scorable criteria too)
    const textWithComments = ps.criteria.filter(c => c.texts && c.texts.length > 0)
    const textBlocks = textWithComments.map(c => `
      <div class="text-criterion">
        <div class="text-criterion-title">${esc(c.text)}</div>
        ${c.texts!.map(t => `<div class="comment">${esc(t)}</div>`).join('')}
      </div>`).join('')

    return `
      <div class="proj-card" style="border-left-color:${border}">
        <div class="proj-header">
          <span class="medal">${medal}</span>
          <div class="proj-info">
            <div class="proj-name">${esc(ps.project.name)}</div>
            ${ps.project.description ? `<div class="proj-desc">${esc(ps.project.description)}</div>` : ''}
            ${members.length > 0 ? `<div class="proj-members">${members.map(esc).join(' · ')}</div>` : ''}
            ${ps.project.advisor ? `<div class="proj-members">Asesor: ${esc(ps.project.advisor)}</div>` : ''}
          </div>
          <div class="proj-badges">
            <div class="resp-badge">${ps.responses} calificación${ps.responses !== 1 ? 'es' : ''}</div>
            ${isTied ? '<div class="tie-badge">= Empate</div>' : ''}
          </div>
        </div>
        <div class="bar-list">
          ${overallBar}
          ${criteriaRows}
        </div>
        ${textBlocks ? `<div class="text-criteria-section">${textBlocks}</div>` : ''}
      </div>`
  }).join('')

  // Evaluators table
  const userMap: Record<string, Set<string>> = {}
  const projectMap: Record<string, string> = {}
  report.projectSummaries.forEach(ps => { projectMap[String(ps.project.id)] = ps.project.name })

  if (Array.isArray(report.rawResponses)) {
    report.rawResponses.forEach((r: any) => {
      const uid = String(r.userId || r.user || r.reporterId || 'anónimo')
      const pid = String(r.projectId || '')
      if (!userMap[uid]) userMap[uid] = new Set()
      if (pid) userMap[uid].add(pid)
    })
  }

  const totalProjects = report.projectSummaries.length
  const evaluatorRows = Object.entries(userMap).map(([uid, pids], i) => {
    const email = esc(resolveUser(uid))
    const rated = pids.size
    const missing = totalProjects - rated
    const allDone = missing === 0
    const statusColor = allDone ? '#15803d' : '#b45309'
    const ratedNames = Array.from(pids).map(pid => projectMap[pid] || pid)
    const missingProjects = Object.keys(projectMap).filter(id => !pids.has(id)).map(id => projectMap[id])

    const ratedList = ratedNames.map(n => `<span class="eval-tag eval-done">${esc(n)}</span>`).join(' ')
    const missingList = missingProjects.map(n => `<span class="eval-tag eval-miss">${esc(n)}</span>`).join(' ')

    return `<tr class="${i % 2 === 0 ? 'even' : ''}">
      <td class="user-cell">${email}</td>
      <td style="color:${statusColor};font-weight:700;text-align:center">${rated}/${totalProjects}</td>
      <td>${ratedList}${missingList}</td>
    </tr>`
  }).join('')

  const _projToolbar = autoPrint
    ? ''
    : `<div style="position:sticky;top:0;z-index:9999;background:#1e293b;padding:8px 16px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px rgba(0,0,0,.3);"><span style="font-size:13px;font-weight:700;color:#e2e8f0;white-space:nowrap;flex:1">&#128196; Vista previa</span><button onclick="window.print()" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;">&#128424;&#65039; Imprimir / Guardar PDF</button></div>`
  const _projAutoprint = ''

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${esc(title)} — Informe</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  html { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1e293b; background: #f8fafc; }

  .report-header { background: linear-gradient(135deg, #0f4c81 0%, #1565c0 60%, #0891b2 100%); color: #fff; padding: 32px 40px 28px; border-radius: 0 0 16px 16px; }
  .report-header h1 { font-size: 22px; font-weight: 700; margin-bottom: 6px; }
  .report-header p { font-size: 12px; opacity: .85; }
  .meta-pills { display: flex; gap: 12px; margin-top: 16px; flex-wrap: wrap; }
  .meta-pill { background: rgba(255,255,255,0.15); border-radius: 20px; padding: 4px 14px; font-size: 11px; font-weight: 600; }

  .scale-strip { display: flex; margin: 20px 40px 0; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
  .scale-cell { flex: 1; text-align: center; padding: 8px 4px; background: #fff; border-right: 1px solid #e2e8f0; }
  .scale-cell:last-child { border-right: none; }
  .scale-num { font-size: 16px; font-weight: 800; }
  .scale-lbl { font-size: 9px; color: #64748b; }
  .scale-pct { font-size: 9px; font-weight: 700; }

  .section { padding: 20px 40px 0; }
  .section-title { font-size: 15px; font-weight: 700; color: #0f172a; border-left: 4px solid #0891b2; padding-left: 10px; margin-bottom: 14px; }

  .proj-card { background: #fff; border: 1px solid #e2e8f0; border-left: 5px solid #0891b2; border-radius: 12px; padding: 16px 18px; margin-bottom: 16px; break-inside: avoid; }
  .proj-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 14px; }
  .medal { font-size: 28px; flex-shrink: 0; line-height: 1; }
  .proj-info { flex: 1; min-width: 0; }
  .proj-name { font-size: 14px; font-weight: 700; color: #0f172a; }
  .proj-desc { font-size: 11px; color: #64748b; margin-top: 2px; }
  .proj-members { font-size: 10px; color: #94a3b8; margin-top: 2px; }
  .proj-badges { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .resp-badge { background: #f0fdf4; color: #15803d; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; border: 1px solid #bbf7d0; }
  .tie-badge { background: #f3e8ff; color: #7c3aed; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }

  .bar-list { display: flex; flex-direction: column; gap: 7px; }
  .bar-row { display: flex; align-items: center; gap: 10px; }
  .bar-label-wide { width: 200px; font-size: 11px; color: #334155; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar-track { flex: 1; background: #f1f5f9; border-radius: 99px; height: 10px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 99px; }
  .bar-meta { width: 90px; text-align: right; font-size: 11px; font-weight: 700; color: #0f172a; flex-shrink: 0; }
  .bar-pct { font-weight: 400; color: #64748b; font-size: 10px; margin-left: 2px; }

  .text-criteria-section { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
  .text-criterion-title { font-size: 11px; font-weight: 600; color: #334155; margin-bottom: 5px; }
  .comment { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 7px 10px; font-size: 11px; color: #475569; line-height: 1.5; margin-bottom: 4px; }

  .table-wrap { overflow: hidden; border-radius: 12px; border: 1px solid #e2e8f0; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead { background: #0f4c81; color: #fff; }
  thead th { padding: 10px 12px; text-align: left; font-weight: 600; }
  tbody tr { border-bottom: 1px solid #f1f5f9; }
  tbody tr.even { background: #f8fafc; }
  tbody td { padding: 8px 12px; color: #334155; vertical-align: top; }
  .user-cell { color: #0891b2; font-weight: 600; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .eval-tag { display: inline-block; font-size: 10px; padding: 1px 7px; border-radius: 20px; margin: 1px 2px; }
  .eval-done { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
  .eval-miss { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }

  .footer { padding: 20px 40px 32px; font-size: 10px; color: #94a3b8; text-align: center; }

  @page { margin: 14mm 12mm; }
  @media print {
    html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body { background: #fff; }
    .report-header { border-radius: 0; }
  }
</style>
</head>
<body>
${_projToolbar}

<div class="report-header">
  <h1>${esc(title)}</h1>
  ${description ? `<p>${esc(description)}</p>` : ''}
  <div class="meta-pills">
    <div class="meta-pill">🏆 ${report.projectSummaries.length} proyecto${report.projectSummaries.length !== 1 ? 's' : ''}</div>
    <div class="meta-pill">📋 ${report.totalResponses} calificación${report.totalResponses !== 1 ? 'es' : ''}</div>
    <div class="meta-pill">📅 ${esc(exportDate)}</div>
  </div>
</div>

<!-- Scale legend -->
<div class="scale-strip">
  <div class="scale-cell"><div class="scale-num" style="color:#ef4444">1</div><div class="scale-lbl">Deficiente</div><div class="scale-pct" style="color:#ef4444">0%</div></div>
  <div class="scale-cell"><div class="scale-num" style="color:#f97316">2</div><div class="scale-lbl">Regular</div><div class="scale-pct" style="color:#f97316">25%</div></div>
  <div class="scale-cell"><div class="scale-num" style="color:#eab308">3</div><div class="scale-lbl">Bueno</div><div class="scale-pct" style="color:#eab308">50%</div></div>
  <div class="scale-cell"><div class="scale-num" style="color:#22c55e">4</div><div class="scale-lbl">Muy bueno</div><div class="scale-pct" style="color:#22c55e">75%</div></div>
  <div class="scale-cell"><div class="scale-num" style="color:#06b6d4">5</div><div class="scale-lbl">Excelente</div><div class="scale-pct" style="color:#06b6d4">100%</div></div>
</div>

<div class="section" style="padding-top:24px">
  <div class="section-title">Ranking de proyectos</div>
  ${projectCards}
</div>

${Object.keys(userMap).length > 0 ? `
<div class="section" style="padding-top:20px">
  <div class="section-title">Actividad de evaluadores</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Evaluador</th><th style="text-align:center">Proyectos</th><th>Detalle</th></tr></thead>
      <tbody>${evaluatorRows}</tbody>
    </table>
  </div>
</div>` : ''}

<div class="footer">Generado el ${esc(exportDate)} · ${esc(title)}</div>

<script>
function setHdrColor(v){document.querySelectorAll('.report-header').forEach(function(e){e.style.background=v;});}
function setAccent(v){
  var s=document.getElementById('dyn');
  if(!s){s=document.createElement('style');s.id='dyn';document.head.appendChild(s);}
  s.textContent='.section-title{border-left-color:'+v+' !important}.user-cell{color:'+v+' !important}';
}
${_projAutoprint}<\/script>
</body>
</html>`

  _openOrDownload(html, title.replace(/\s+/g, '_') + '_informe.html', autoPrint)
}

const reportHelpers = { getSurveyList, getSimpleSurveyReport, getProjectSurveyReport, exportCsv, exportSimpleSurveyReport, exportSimpleSurveyPdf, exportProjectSurveyPdf }
export default reportHelpers
