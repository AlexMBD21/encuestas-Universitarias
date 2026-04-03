import React, { useState } from 'react'
import surveyHelpers, { RubricQuestion, ProjectResponse } from '../../services/surveyHelpers'
import supabaseClient from '../../services/supabaseClient'

type RateProjectProps = {
  survey: any
  project: any
  onClose?: () => void
  onSaved?: (opts?: { autoNext?: boolean, projectId?: string }) => void
  readOnly?: boolean
}

export default function RateProject({ survey, project, onClose, onSaved, readOnly }: RateProjectProps): JSX.Element {
  const userId = surveyHelpers.getCurrentUserId()
  const [already, setAlready] = useState<boolean>(false)
  const [answers, setAnswers] = useState<Record<string, number | string | null>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const rubric: RubricQuestion[] = survey.rubric || []

  const setAnswer = (qid: string, val: number | string | null) => setAnswers(a => ({ ...a, [qid]: val }))

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (already) {
      setMessage('Ya has calificado este proyecto')
      return
    }
    // basic validation: ensure score questions have a value
    for (const q of rubric) {
      if (q.kind === 'score') {
        const v = answers[q.id]
        if (v === undefined || v === null || v === '') {
          setMessage('Por favor responde todas las preguntas de puntuación')
          return
        }
      }
    }
    setSaving(true)
    try {
      const authUser = (supabaseClient && (supabaseClient as any).getAuthCurrentUser && (supabaseClient as any).getAuthCurrentUser()) || null
      const uidToStore = (authUser && ((authUser as any).id || (authUser as any).uid)) || userId
      const resp: ProjectResponse = {
        surveyId: String(survey.id),
        projectId: String(project.id),
        userId: uidToStore,
        answers,
        submittedAt: new Date().toISOString()
      }
      const ok = await surveyHelpers.saveProjectResponse(resp)
      setSaving(false)
      if (!ok) {
        setMessage('No fue posible guardar. Asegúrate de estar conectado y autenticado.')
        return
      }
      // mark locally as already rated so UI updates immediately
      setAlready(true)
      setMessage('Calificación guardada')
      setTimeout(() => {
        // Prefer parent `onSaved` (which can auto-advance). Only call `onClose`
        // when there is no `onSaved` handler — otherwise parent decides.
        if (onSaved) {
          onSaved({ autoNext: true, projectId: resp.projectId })
        } else if (onClose) {
          onClose()
        }
      }, 300)
    } catch (e) {
      setSaving(false)
      setMessage('Error al guardar')
    }
  }

  // update already when survey or project changes (in case parent navigates between projects)
  React.useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        // prefer per-user index when available (allows non-owners to check their own responses)
        const supabaseNow = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
        if (supabaseNow) {
          const authUser = (supabaseClient && (supabaseClient as any).getAuthCurrentUser && (supabaseClient as any).getAuthCurrentUser()) || null
          const uid = (authUser && ((authUser as any).id || (authUser as any).uid)) || userId
          if ((supabaseClient as any).getUserResponsesOnce) {
            const arr = await (supabaseClient as any).getUserResponsesOnce(String(uid), String(survey.id))
            const found = arr.find((r: any) => String(r.projectId) === String(project.id) && String(r.userId) === String(uid))
            const exists = !!found
            if (mounted) {
              setAlready(exists)
              if (exists && found) {
                if (found.answersList && Array.isArray(found.answersList)) {
                  const mapped: Record<string, any> = {}
                  for (const it of found.answersList) {
                    try { mapped[String(it.qid)] = it.value } catch (e) {}
                  }
                  setAnswers(mapped)
                } else if (found.answers && typeof found.answers === 'object') {
                  // Map answers object into expected keys (try original q.id first, then sanitized key)
                  try {
                    const mapped: Record<string, any> = {}
                    for (const q of rubric) {
                      const qk = String(q.id)
                      const sk = qk.replace(/[.#$\/\[\]]/g, '_')
                      if (found.answers.hasOwnProperty(qk)) mapped[qk] = found.answers[qk]
                      else if (found.answers.hasOwnProperty(sk)) mapped[qk] = found.answers[sk]
                      else if (found.answers.hasOwnProperty(String(qk))) mapped[qk] = found.answers[String(qk)]
                    }
                    setAnswers(mapped)
                  } catch (e) {
                    setAnswers(found.answers || {})
                  }
                }
              }
              return
            }
          }
          // if we're owner, we can read full responses
          const ownerUid = (supabaseClient && (supabaseClient as any).getAuthCurrentUser && (supabaseClient as any).getAuthCurrentUser()) || null
          const ownerUidId = ownerUid && ((ownerUid as any).id || (ownerUid as any).uid)
          if (ownerUidId && String(ownerUidId) === String(survey.ownerId) && (supabaseClient as any).getSurveyResponsesOnce) {
            const arr = await (supabaseClient as any).getSurveyResponsesOnce(String(survey.id))
            const found = arr.find((r: any) => String(r.projectId) === String(project.id) && String(r.userId) === String(uid))
            const exists = !!found
            if (mounted) {
              setAlready(exists)
              if (exists && found) {
                if (found.answersList && Array.isArray(found.answersList)) {
                  const mapped: Record<string, any> = {}
                  for (const it of found.answersList) {
                    try { mapped[String(it.qid)] = it.value } catch (e) {}
                  }
                  setAnswers(mapped)
                } else if (found.answers && typeof found.answers === 'object') {
                  setAnswers(found.answers || {})
                }
              }
              return
            }
          }
        }
        // fallback to local check (if any)
        try { if (mounted) setAlready(surveyHelpers.hasUserRated(String(survey.id), String(project.id), userId)) } catch (e) { if (mounted) setAlready(false) }
      } catch (e) { if (mounted) setAlready(false) }
    })()
    return () => { mounted = false }
  }, [survey?.id, project?.id, userId])

  // Debug logs to help trace why the form might not render
  React.useEffect(() => {
    try {
      console.debug('[RateProject] mounted', { surveyId: survey?.id, projectId: project?.id, project, rubricLength: (survey?.rubric || []).length, already })
    } catch (e) {
      console.debug('[RateProject] mount error', e)
    }
  }, [survey?.id, project?.id, already])

  const readonlyMode = !!readOnly
  return (
    <div>
      <h3 className="text-xl font-semibold mb-2">{project.name}</h3>
      <div className="text-sm text-slate-500 mb-2">{project.category} {project.description ? `· ${project.description}` : ''}</div>
      {project.members && <div className="text-sm text-slate-500 mb-1">Integrantes: <span className="font-medium">{project.members}</span></div>}
      {project.advisor && <div className="text-sm text-slate-500 mb-3">Profesor asesor: <span className="font-medium">{project.advisor}</span></div>}
      {already && <div className="p-3 bg-yellow-50 border rounded mb-3">Ya calificaste este proyecto.</div>}
      <form onSubmit={submit}>
        <div className="space-y-4">
          {rubric.length === 0 && <div className="text-slate-600">No hay rúbrica definida para esta encuesta.</div>}
          {rubric.map((q: RubricQuestion) => (
            <div key={q.id} className="p-3 border rounded">
              <div className="font-semibold mb-2">{q.text}</div>
              {q.kind === 'score' ? (
                <div className="flex gap-2">
                  {[1,2,3,4,5].map(n => (
                    <label key={n} className={`px-3 py-2 border rounded cursor-pointer ${answers[q.id] === n ? 'bg-primary text-white' : ''} ${readonlyMode ? 'opacity-60 cursor-default' : ''}`}>
                      <input type="radio" name={`q_${q.id}`} value={n} checked={answers[q.id] === n} onChange={() => { if (!readonlyMode) setAnswer(q.id, n) }} style={{display: 'none'}} disabled={readonlyMode} />
                      {n}
                    </label>
                  ))}
                </div>
              ) : (
                <textarea className="w-full p-2 border rounded" value={(answers[q.id] as string) || ''} onChange={e => { if (!readonlyMode) setAnswer(q.id, e.target.value) }} readOnly={readonlyMode} />
              )}
            </div>
          ))}
        </div>
        {message && <div className="mt-3 text-sm text-slate-700">{message}</div>}
        <div className="mt-4 flex gap-2">
          {!readonlyMode && (
            <button type="submit" disabled={saving || already} className="px-4 py-2 bg-primary text-white rounded">{saving ? 'Guardando...' : 'Guardar calificación'}</button>
          )}
          <button type="button" onClick={() => { if (onClose) onClose() }} className="px-4 py-2 bg-gray-200 rounded">{readonlyMode ? 'Cerrar' : 'Cancelar'}</button>
        </div>
      </form>
    </div>
  )
}
