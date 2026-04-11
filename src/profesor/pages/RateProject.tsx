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
  const setComment = (qid: string, val: string) => setAnswers(a => ({ ...a, [`${qid}_comment`]: val }))

  const submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (already) {
      setMessage('Ya has calificado este proyecto')
      return
    }
    // validation: ensure EVERY question has a numeric score (Mandatory for tie-breaking)
    for (const q of rubric) {
      const v = answers[q.id]
      if (v === undefined || v === null || v === '' || isNaN(Number(v))) {
        setMessage(`Por favor asigna una puntuación al criterio: "${q.text.substring(0, 30)}..."`)
        return
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
                  // Map answers object into expected keys
                  try {
                    const mapped: Record<string, any> = { ...found.answers }
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
        <div className="flex flex-col gap-3 mb-6">
          {project.description && (
             <p className="text-[15px] sm:text-base text-slate-500 dark:text-slate-400 italic leading-relaxed">
               {project.description}
             </p>
          )}
          {project.category && (
            <div className="flex">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm border" style={{ backgroundColor: 'var(--color-primary-100, #e0f2fe)', color: 'var(--color-primary)', borderColor: 'var(--color-primary-200, rgba(0,98,141,0.15))' }}>
                <span className="material-symbols-outlined text-[16px]">category</span>
                {project.category}
              </span>
            </div>
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
          
          {rubric.map((q: RubricQuestion, i: number) => {
            const isScoreKind = q.kind === 'score';
            const scoreValue = answers[q.id];
            const commentValue = (answers[`${q.id}_comment`] as string) || (isScoreKind ? '' : (answers[q.id] as string)) || '';
            
            return (
              <div key={q.id} className="p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 rounded-2xl bg-white dark:bg-slate-800/50 shadow-sm transition-colors">
                <div className="flex gap-3 mb-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: 'var(--color-primary-100, rgba(0,98,141,0.1))', color: 'var(--color-primary)' }}>
                    {i + 1}
                  </div>
                  <div className="font-semibold text-slate-800 dark:text-slate-100 text-[15px] sm:text-base leading-relaxed pt-1 flex-1">
                    {q.text}
                    {!isScoreKind && (
                       <span className="ml-2 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 text-[9px] font-black uppercase rounded border border-indigo-100 tracking-tighter align-middle">
                         Respuesta Evaluada
                       </span>
                    )}
                  </div>
                </div>

                <div className="pl-0 sm:pl-11 space-y-4">
                  {/* Score Selector (Mandatory for ALL types per user request to break ties) */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                         {isScoreKind ? 'Puntuación' : 'Calificación del Criterio'} <span className="text-red-500">*</span>
                       </span>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-3">
                      {[1,2,3,4,5].map(n => {
                        const isSelected = Number(scoreValue) === n;
                        return (
                          <label key={n} className={`w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center rounded-xl font-bold text-lg transition-all shadow-sm ${readonlyMode ? (isSelected ? 'bg-emerald-500 text-white border-emerald-600 shadow-emerald-500/30' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 opacity-60 cursor-default') : (isSelected ? 'text-white border-transparent scale-105 ring-2 ring-offset-2 cursor-pointer shadow-lg' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900/20 cursor-pointer')}`} style={(!readonlyMode && isSelected) ? { backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-primary)', '--tw-ring-color': 'var(--color-primary)'} as React.CSSProperties : {}}>
                            <input type="radio" name={`q_${q.id}`} value={n} checked={isSelected} onChange={() => { if (!readonlyMode) setAnswer(q.id, n) }} style={{display: 'none'}} disabled={readonlyMode} />
                            {n}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Comment Area: ONLY for 'text' kind (evaluator's response) */}
                  {!isScoreKind && (
                    <div className="mt-4">
                      <div className="flex items-center gap-2 mb-2">
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                           Respuesta / Observación del evaluador
                         </span>
                      </div>
                      <textarea 
                        className={`w-full p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-slate-700 dark:text-slate-200 outline-none transition-all placeholder:text-slate-400 resize-y min-h-[100px] ${readonlyMode ? 'opacity-80 cursor-default' : 'focus:border-indigo-400 focus:ring-4 focus:ring-indigo-400/20'}`} 
                        placeholder="Escribe aquí tu análisis o respuesta a la pregunta..."
                        value={commentValue} 
                        onChange={e => { if (!readonlyMode) setComment(q.id, e.target.value) }} 
                        readOnly={readonlyMode} 
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {message && (
          <div className={`mt-6 p-4 rounded-xl flex items-center gap-3 font-medium ${message.includes('Error') || message.includes('Por favor') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>
            <span className="material-symbols-outlined text-[20px]">{message.includes('Error') || message.includes('Por favor') ? 'error' : 'info'}</span>
            {message}
          </div>
        )}
        
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col-reverse sm:flex-row justify-end gap-3">
          <button type="button" onClick={() => { if (onClose) onClose() }} className="w-full sm:w-auto px-6 py-3 sm:py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl transition-colors">{readonlyMode ? 'Volver' : 'Cancelar y Volver'}</button>
          {!readonlyMode && (
            <button type="submit" disabled={saving || already} className="w-full sm:w-auto px-8 py-3 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed">
              {saving ? <><span className="material-symbols-outlined text-[20px] animate-spin">refresh</span> Guardando...</> : <><span className="material-symbols-outlined text-[20px]">save</span> Guardar Calificación</>}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
