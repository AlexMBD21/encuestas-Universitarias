import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import surveyHelpers from '../../services/surveyHelpers'
import supabaseClient from '../../services/supabaseClient'
import Loader from '../../components/Loader'

type ViewSurveyProps = {
  surveyId?: string | null
  onClose?: () => void
  hideCloseButton?: boolean
}

export default function ViewSurvey({ surveyId, onClose, hideCloseButton }: ViewSurveyProps): JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const idFromQuery = params.get('id')
  const effectiveId = surveyId ?? idFromQuery

  const [survey, setSurvey] = useState<any | null>(null)
  const [surveyLoading, setSurveyLoading] = useState(true)
  const [respondent, setRespondent] = useState('')
  const [answers, setSurveyAnswers] = useState<any>({})
  const [submitted, setSubmitted] = useState<boolean>(false)
  const [summary, setSummary] = useState<any>(null)

  const supabaseEnabledNow = (supabaseClient && (supabaseClient as any).isEnabled && (supabaseClient as any).isEnabled())
  const dataClientNow: any = supabaseClient

  const computeSummary = (responses: any[]) => {
    if (!survey) return
    const qsummary: any = []
    survey.questions.forEach((q: any, qi: number) => {
      if (q.type === 'multiple') {
        const counts = (q.options || []).map((o: string) => 0)
        responses.forEach(r => {
          let val: any = undefined
          try {
            if (r && r.answersList && Array.isArray(r.answersList)) {
              const found = r.answersList.find((it: any) => String(it.qid) === String(qi) || String(it.qid) === String(q.id))
              if (found) val = found.value
            }
          } catch (e) {}
          if (val === undefined) {
            try {
              const sk = String(q.id).replace(/[.#$\/\[\]]/g, '_')
              val = r.answers && (r.answers[String(qi)] ?? r.answers[q.id] ?? r.answers[sk])
            } catch (e) { val = undefined }
          }
          if (typeof val === 'number' && counts[val] != null) counts[val]++
        })
        qsummary[qi] = { type: 'multiple', counts }
      } else {
        const texts: string[] = []
        responses.forEach(r => {
          let val: any = undefined
          try {
            if (r && r.answersList && Array.isArray(r.answersList)) {
              const found = r.answersList.find((it: any) => String(it.qid) === String(qi) || String(it.qid) === String(q.id))
              if (found) val = found.value
            }
          } catch (e) {}
          if (val === undefined) {
            try {
              const sk = String(q.id).replace(/[.#$\/\[\]]/g, '_')
              val = r.answers && (r.answers[String(qi)] ?? r.answers[q.id] ?? r.answers[sk])
            } catch (e) { val = undefined }
          }
          if (val && String(val).trim()) texts.push(String(val))
        })
        qsummary[qi] = { type: 'text', texts }
      }
    })
    setSummary({ total: responses.length, qsummary })
  }

  useEffect(() => {
    const id = surveyId ?? idFromQuery
    if (!id) return
    const load = async () => {
      setSurveyLoading(true)
      try {
        if (!dataClientNow || !(dataClientNow as any).isEnabled || !(dataClientNow as any).isEnabled()) {
          // Enforce DB-only mode: do not use localStorage fallback
          setSurvey(null)
          setSurveyLoading(false)
          return
        }
        // Firebase is enabled: fetch from RTDB
        if ((dataClientNow as any).getSurveyById) {
          try {
            const remote = await (dataClientNow as any).getSurveyById(String(id))
            if (remote) { setSurvey(remote); setSurveyLoading(false); return }
          } catch (e) {
            setSurvey(null); setSurveyLoading(false); return
          }
        }
        setSurvey(null)
        setSurveyLoading(false)
      } catch (e) {
        setSurvey(null)
        setSurveyLoading(false)
      }
    }
    load()
  }, [location.search, surveyId])

  useEffect(() => {
    if (!survey) return
    // initialize answers object
    const initialAnswers: any = {}
    const qlist = survey && Array.isArray(survey.questions) ? survey.questions : []
    for (let i = 0; i < qlist.length; i++) {
      const q = qlist[i]
      initialAnswers[i] = (q && q.type === 'multiple') ? null : ''
    };
    // defer state update to avoid parser/ASI edge-cases in certain TS builds
    setTimeout(() => setSurveyAnswers(initialAnswers), 0);
    // load existing summary from DB via unified data client (Supabase preferred)
    (async () => {
      try {
        if (dataClientNow && (dataClientNow as any).isEnabled && (dataClientNow as any).isEnabled()) {
          const authUser = (dataClientNow && (dataClientNow as any).getAuthCurrentUser && (dataClientNow as any).getAuthCurrentUser()) || null
          const myUid = (authUser && (authUser as any).uid) || surveyHelpers.getCurrentUserId()
          // owner: can read all responses
          if (myUid && String(survey.ownerId) === String(myUid) && (dataClientNow as any).getSurveyResponsesOnce) {
            const arr = await (dataClientNow as any).getSurveyResponsesOnce(String(survey.id))
            computeSummary(arr)
            try {
              const uid = surveyHelpers.getCurrentUserId()
              const existingByUser = arr.find((r: any) => r.userId && String(r.userId) === String(uid) && (r as any).projectId == null)
              if (existingByUser) {
                setSubmitted(true)
                if (existingByUser.respondent) setRespondent(existingByUser.respondent)
              }
            } catch (e) {}
            return
          }

          // non-owner: can check only their own responses via per-user index
          if (myUid && (dataClientNow as any).getUserResponsesOnce) {
            const arr = await (dataClientNow as any).getUserResponsesOnce(String(myUid), String(survey.id))
            // compute minimal summary from own responses only
            computeSummary(arr)
            try {
              const existingByUser = arr.find((r: any) => (r as any).projectId == null)
              if (existingByUser) {
                setSubmitted(true)
                if (existingByUser.respondent) setRespondent(existingByUser.respondent)
              }
            } catch (e) {}
            return
          }
        }
        // DB disabled or no permissions: show empty summary
        computeSummary([])
      } catch (e) {
        computeSummary([])
      }
    })()
  }, [survey])

  if (surveyLoading) {
    return (
      <div className="flex-1 w-full flex items-center justify-center py-16">
        <Loader size={56} text="Cargando..." />
      </div>
    )
  }

  if (!survey) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl border p-6 shadow mb-6">
        <div className="text-slate-600">Encuesta no encontrada.</div>
        <div className="mt-4">
                  {!hideCloseButton && (
                    <button onClick={() => onClose ? onClose() : navigate('/profesor/encuestas')} className="px-3 py-2 bg-gray-200 rounded">Volver</button>
                  )}
                </div>
      </div>
    )
  }

  const isModal = !!onClose;

  return (
    <div className={isModal ? "animate-in fade-in duration-300 flex flex-col flex-1 h-full min-h-0 w-full relative" : "bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-xl shadow-slate-200/40 dark:shadow-none mb-6 animate-in fade-in zoom-in-95 duration-300 flex flex-col flex-1 h-full min-h-0 w-full relative overflow-hidden"}>
      {!isModal && <div className="absolute top-0 left-0 w-full h-2" style={{ backgroundColor: 'var(--color-primary)' }}></div>}
      
      <div className={isModal ? "flex-1 overflow-y-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-6 custom-scrollbar-sm w-full relative z-0 bg-white dark:bg-slate-900" : ""}>

      <div className={`flex justify-between items-start pb-6 border-b border-slate-100 dark:border-slate-800 ${isModal ? 'mb-6' : 'mb-8'}`}>
        <div className="w-full">
          {!onClose && (
            <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 mb-3 leading-tight">{survey.title}</h2>
          )}
          {survey.description && (
             <div className="text-[15px] sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700/50 mb-3">
               {survey.description}
             </div>
          )}
          <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-wide uppercase px-1 flex items-center gap-1.5"><span className="material-symbols-outlined text-[14px]">calendar_month</span> Creada: {new Date(survey.createdAt).toLocaleString()}</div>
        </div>
        {!hideCloseButton && (
          <div className="ml-4 shrink-0">
            <button type="button" onClick={() => onClose ? onClose() : navigate('/profesor/encuestas')} aria-label="Cerrar" title="Cerrar" className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors">
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}
      </div>

      <div>
        {!submitted ? (
          <form id={`view-survey-form-${survey.id}`} onSubmit={async (e) => {
            e.preventDefault()
            // save response via unified data client (Supabase preferred)
            try {
              if (dataClientNow && (dataClientNow as any).isEnabled && (dataClientNow as any).isEnabled() && (dataClientNow as any).pushSurveyResponse) {
                const authUser = (dataClientNow && (dataClientNow as any).getAuthCurrentUser && (dataClientNow as any).getAuthCurrentUser()) || null
                const uid = (authUser && (authUser as any).uid) || surveyHelpers.getCurrentUserId()
                const resp: any = { respondent: respondent?.trim() || null, answers, submittedAt: new Date().toISOString(), userId: uid, surveyId: survey.id }
                const key = await (dataClientNow as any).pushSurveyResponse(resp)
                // refresh responses and summary
                let arr: any[] = []
                try {
                  const authUser = (dataClientNow && (dataClientNow as any).getAuthCurrentUser && (dataClientNow as any).getAuthCurrentUser()) || null
                  const myUid = (authUser && ((authUser as any).uid || (authUser as any).id)) || surveyHelpers.getCurrentUserId()
                  // if owner, read all responses
                  if (myUid && String(survey.ownerId) === String(myUid) && (dataClientNow as any).getSurveyResponsesOnce) {
                    arr = await (dataClientNow as any).getSurveyResponsesOnce(String(survey.id))
                  } else if (myUid && (dataClientNow as any).getUserResponsesOnce) {
                    // non-owner: read only own responses
                    arr = await (dataClientNow as any).getUserResponsesOnce(String(myUid), String(survey.id))
                  } else {
                    arr = []
                  }
                } catch (err: any) {
                  // If permission denied when trying to read full responses, fallback to per-user read
                  console.warn('getSurveyResponsesOnce fallback', err)
                  try {
                    const authUser = (dataClientNow && (dataClientNow as any).getAuthCurrentUser && (dataClientNow as any).getAuthCurrentUser()) || null
                    const myUid = (authUser && ((authUser as any).uid || (authUser as any).id)) || surveyHelpers.getCurrentUserId()
                    if (myUid && (dataClientNow as any).getUserResponsesOnce) {
                      arr = await (dataClientNow as any).getUserResponsesOnce(String(myUid), String(survey.id))
                    }
                  } catch (e) {
                    arr = []
                  }
                }
                computeSummary(arr)
                setSubmitted(true)
                try { window.dispatchEvent(new CustomEvent('survey:responded', { detail: { surveyId: survey.id } })) } catch (e) {}
              } else {
                // No DB backend: inform user
                alert('No es posible guardar: servicio de datos no configurado.')
              }
            } catch (e) {
              console.error('Error saving survey response', e)
              alert('Error al guardar la respuesta. Revisa la consola para más detalles.')
            }
          }}>
            <div className="mb-8 p-1">
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2.5">Tu Nombre <span className="text-slate-400 font-normal ml-1">(Opcional)</span></label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">person</span>
                <input className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 outline-none focus:ring-4 transition-all placeholder:text-slate-400 shadow-sm" style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties} value={respondent} onChange={e => setRespondent(e.target.value)} placeholder="Ej: Maria Perez" onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'} onBlur={(e) => e.target.style.borderColor = ''} />
              </div>
            </div>

            <div className="space-y-6">
              {survey.questions && survey.questions.length ? (
                survey.questions.map((q: any, idx: number) => (
                  <div key={idx} className="p-5 sm:p-6 border border-slate-200 dark:border-slate-700/80 rounded-2xl bg-white dark:bg-slate-800/30 shadow-sm transition-colors"
                       onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--color-primary)'}
                       onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}>
                    <div className="flex items-start gap-3 mb-5">
                       <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm" style={{ backgroundColor: 'var(--color-primary-100, rgba(0,98,141,0.1))', color: 'var(--color-primary)' }}>
                         {idx + 1}
                       </div>
                       <div className="font-semibold text-slate-800 dark:text-slate-100 text-[15px] sm:text-base leading-relaxed pt-1">
                         {q.text}
                       </div>
                    </div>
                    
                    <div className="pl-0 sm:pl-11">
                      {q.type === 'multiple' ? (
                        <div className="space-y-3">
                          {(q.options || []).map((opt: string, oi: number) => {
                            const isSelected = answers[idx] === oi;
                            return (
                              <label key={oi} className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${isSelected ? 'shadow-sm' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800'}`} style={isSelected ? { borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary-100, rgba(0,98,141,0.05))' } : {}}>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? '' : 'border-slate-300 dark:border-slate-600'}`} style={isSelected ? { borderColor: 'var(--color-primary)', backgroundColor: 'var(--color-primary)' } : {}}>
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-white"></div>}
                                </div>
                                <input type="radio" name={`q_${idx}`} checked={isSelected} onChange={() => setSurveyAnswers((a: any) => ({ ...a, [idx]: oi }))} className="hidden" />
                                <span className={`text-[15px] font-medium leading-tight ${isSelected ? '' : 'text-slate-700 dark:text-slate-300'}`} style={isSelected ? { color: 'var(--color-primary)' } : {}}>{opt}</span>
                              </label>
                            )
                          })}
                        </div>
                      ) : (
                        <textarea 
                          className="w-full p-4 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-slate-700 dark:text-slate-200 outline-none transition-all placeholder:text-slate-400 min-h-[120px] focus:ring-4 shadow-sm" 
                          style={{ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties}
                          placeholder="Escribe tu respuesta aquí..."
                          value={answers[idx] || ''} 
                          onChange={e => setSurveyAnswers((a: any) => ({ ...a, [idx]: e.target.value }))} 
                          onFocus={(e) => e.target.style.borderColor = 'var(--color-primary)'} 
                          onBlur={(e) => e.target.style.borderColor = ''}
                        />
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-slate-500 dark:text-slate-400 text-center p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">No hay preguntas en esta encuesta.</div>
              )}
            </div>
          </form>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 p-6 sm:p-5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl mb-8 shadow-sm">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-800/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
                 <span className="material-symbols-outlined text-[32px]">task_alt</span>
              </div>
              <div className="text-center sm:text-left mt-1">
                 <h4 className="text-xl font-bold text-emerald-800 dark:text-emerald-400 mb-1">¡Gracias por responder!</h4>
                 <p className="text-emerald-700/80 dark:text-emerald-500 font-medium">Tus respuestas han sido guardadas correctamente.</p>
              </div>
            </div>
            
            <div className="mb-6 flex items-center gap-2 px-2">
              <span className="material-symbols-outlined text-[20px] text-slate-400">monitoring</span>
              <strong className="text-slate-700 dark:text-slate-300">Total de respuestas recibidas:</strong> 
              <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold px-2.5 py-0.5 rounded-md">{summary?.total ?? 0}</span>
            </div>
            
            <div className="space-y-6">
              {survey.questions.map((q: any, idx: number) => (
                <div key={idx} className="p-5 sm:p-6 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800/30">
                  <div className="flex items-start gap-3 mb-4">
                     <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-sm">
                       {idx + 1}
                     </div>
                     <div className="font-semibold text-slate-800 dark:text-slate-100 text-[15px] sm:text-base pt-0.5">
                       {q.text}
                     </div>
                  </div>
                  
                  <div className="pl-0 sm:pl-10">
                    {q.type === 'multiple' ? (
                      <div className="space-y-3">
                        {q.options.map((opt: string, oi: number) => {
                          const count = summary?.qsummary?.[idx]?.counts?.[oi] ?? 0;
                          const total = summary?.total || 1;
                          const percent = Math.round((count / total) * 100);
                          return (
                            <div key={oi} className="relative">
                              <div className="flex justify-between items-end mb-1 px-1 relative z-10">
                                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">{opt}</div>
                                <div className="text-sm font-bold text-slate-600 dark:text-slate-400">{count} <span className="font-normal text-slate-400 text-xs">({percent}%)</span></div>
                              </div>
                              <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${percent}%`, backgroundColor: 'var(--color-primary)' }}></div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(summary?.qsummary?.[idx]?.texts || []).slice(-10).reverse().map((t: string, i: number) => (
                          <div key={i} className="p-3.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 shadow-sm flex gap-3 items-start">
                             <span className="material-symbols-outlined text-[16px] text-slate-400 mt-0.5 shrink-0">format_quote</span>
                             <div className="leading-relaxed">{t}</div>
                          </div>
                        ))}
                        {!(summary?.qsummary?.[idx]?.texts?.length) && <div className="text-sm text-slate-400 italic px-2">Aún no hay respuestas de texto.</div>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
          </div>
        )}
      </div>

      </div> {/* end scrollable boundary */}

      <div className={`shrink-0 p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 relative z-10 flex flex-col-reverse sm:flex-row justify-end gap-3 ${isModal ? 'rounded-b-[1.5rem] shadow-[0_-8px_20px_-4px_rgba(0,0,0,0.14)] dark:shadow-[0_-8px_20px_-4px_rgba(0,0,0,0.45)]' : 'mt-8 pt-6 -mx-8 -mb-8 rounded-b-2xl sm:rounded-b-3xl'}`}>
        {!submitted ? (
          <>
            <button type="button" onClick={() => onClose ? onClose() : navigate('/profesor/encuestas')} className="w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-2.5 bg-transparent hover:bg-slate-50 text-slate-600 font-bold rounded-2xl dark:hover:bg-slate-800/60 dark:text-slate-400 transition-all text-sm border border-slate-300 dark:border-slate-600 active:scale-[0.98]">Cancelar y Volver</button>
            <button type="submit" form={`view-survey-form-${survey.id}`} className="w-full sm:w-auto px-5 py-2 sm:px-8 sm:py-2.5 bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 border border-blue-600 hover:border-blue-700 disabled:opacity-60 text-white font-black rounded-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.25),0_4px_14px_0_rgba(37,99,235,0.3)] transition-all flex items-center justify-center gap-2 active:scale-[0.98] outline-none">
              <span className="material-symbols-outlined text-[20px]">send</span> Enviar respuestas
            </button>
          </>
        ) : (
          <button type="button" onClick={() => onClose ? onClose() : navigate('/profesor/encuestas')} className="w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-2.5 bg-transparent hover:bg-slate-50 text-slate-600 font-bold rounded-2xl dark:hover:bg-slate-800/60 dark:text-slate-400 transition-all text-sm border border-slate-300 dark:border-slate-600 active:scale-[0.98]">Volver a encuestas</button>
        )}
      </div>

    </div>
  )
}
