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
    <div className="animate-in fade-in zoom-in-95 duration-200">
      <div className="mb-6 pb-6 border-b border-slate-100 dark:border-slate-800">
        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">{project.name || 'Proyecto sin nombre'}</h3>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {project.category && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-bold" style={{ backgroundColor: 'var(--color-primary-100, #e0f2fe)', color: 'var(--color-primary)' }}>
              <span className="material-symbols-outlined text-[16px]">category</span> {project.category}
            </span>
          )}
          {project.description && (
             <span className="text-sm text-slate-500 dark:text-slate-400 italic flex-1 min-w-[200px]">{project.description}</span>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {project.members && (
            <div className="flex-1 text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <span className="material-symbols-outlined text-[18px] text-slate-400 shrink-0 mt-0.5">groups</span>
              <div className="leading-relaxed whitespace-pre-wrap"><span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Integrantes:</span>{String(project.members).replace(/([a-zñáéíóú])([A-Z])/g, '$1, $2')}</div>
            </div>
          )}
          {project.advisor && (
            <div className="sm:w-1/3 text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <span className="material-symbols-outlined text-[18px] text-slate-400 shrink-0 mt-0.5">school</span>
              <div className="leading-relaxed"><span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">Profesor asesor:</span>{project.advisor}</div>
            </div>
          )}
        </div>
      </div>

      {already && (
         <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl mb-6 text-emerald-800 dark:text-emerald-400 font-medium shadow-sm">
           <span className="material-symbols-outlined text-[24px]">check_circle</span>
           Ya calificaste este proyecto. {readonlyMode ? 'Puedes revisar tus respuestas abajo.' : ''}
         </div>
      )}

      <form onSubmit={submit}>
        <div className="space-y-6">
          {rubric.length === 0 && <div className="text-slate-600 dark:text-slate-400 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl text-center">No hay rúbrica definida para esta encuesta.</div>}
          
          {rubric.map((q: RubricQuestion, i: number) => (
            <div key={q.id} className="p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 rounded-2xl bg-white dark:bg-slate-800/50 shadow-sm transition-colors">
              <div className="flex gap-3 mb-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: 'var(--color-primary-100, rgba(0,98,141,0.1))', color: 'var(--color-primary)' }}>
                  {i + 1}
                </div>
                <div className="font-semibold text-slate-800 dark:text-slate-100 text-[15px] sm:text-base leading-relaxed pt-1">
                  {q.text}
                </div>
              </div>

              <div className="pl-0 sm:pl-11">
                {q.kind === 'score' ? (
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    {[1,2,3,4,5].map(n => {
                      const isSelected = answers[q.id] === n;
                      return (
                        <label key={n} className={`w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-xl font-bold text-lg transition-all shadow-sm ${readonlyMode ? (isSelected ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 opacity-60 cursor-default') : (isSelected ? 'text-white border-transparent scale-105 ring-2 ring-offset-2 cursor-pointer' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/20 cursor-pointer')}`} style={(!readonlyMode && isSelected) ? { backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)', '--tw-ring-color': 'var(--color-primary)'} as React.CSSProperties : {}}>
                          <input type="radio" name={`q_${q.id}`} value={n} checked={isSelected} onChange={() => { if (!readonlyMode) setAnswer(q.id, n) }} style={{display: 'none'}} disabled={readonlyMode} />
                          {n}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <textarea 
                    className={`w-full p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-slate-700 dark:text-slate-200 outline-none transition-all placeholder:text-slate-400 resize-y min-h-[100px] ${readonlyMode ? 'opacity-80 cursor-default' : 'focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/20'}`} 
                    placeholder="Escribe tus comentarios aquí..."
                    value={(answers[q.id] as string) || ''} 
                    onChange={e => { if (!readonlyMode) setAnswer(q.id, e.target.value) }} 
                    readOnly={readonlyMode} 
                  />
                )}
              </div>
            </div>
          ))}
        </div>
        
        {message && (
          <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 font-medium ${message.includes('Error') || message.includes('Por favor') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>
            <span className="material-symbols-outlined text-[20px]">{message.includes('Error') || message.includes('Por favor') ? 'error' : 'info'}</span>
            {message}
          </div>
        )}
        
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button type="button" onClick={() => { if (onClose) onClose() }} className="w-full sm:w-auto px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors">{readonlyMode ? 'Volver' : 'Cancelar'}</button>
          {!readonlyMode && (
            <button type="submit" disabled={saving || already} className="w-full sm:w-auto px-8 py-3 font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 hover:brightness-110 text-white disabled:opacity-70 disabled:cursor-not-allowed" style={{ backgroundColor: 'var(--color-primary)' }}>
              {saving ? <><span className="material-symbols-outlined text-[20px] animate-spin">refresh</span> Guardando...</> : <><span className="material-symbols-outlined text-[20px]">send</span> Guardar Calificación</>}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
