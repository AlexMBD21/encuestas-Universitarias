import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import surveyHelpers from '../../services/surveyHelpers'
import supabaseClient from '../../services/supabaseClient'

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
      <div className="bg-white dark:bg-slate-900 rounded-xl border p-6 shadow mb-6">
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 0',gap:10}}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{animation:'spin 0.9s linear infinite'}}>
            <circle cx="18" cy="18" r="14" stroke="#e2e8f0" strokeWidth="4"/>
            <path d="M18 4a14 14 0 0 1 14 14" stroke="#00628d" strokeWidth="4" strokeLinecap="round"/>
          </svg>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{fontSize:'0.8rem',color:'#94a3b8',fontWeight:500}}>Cargando...</div>
        </div>
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

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border p-6 shadow mb-6">
      <div className="flex justify-between items-start">
        <div>
          {!onClose && (
            <h2 className="text-2xl font-bold mb-1">{survey.title}</h2>
          )}
          <div className="text-sm text-slate-500 mb-3">{survey.description}</div>
          <div className="text-xs text-slate-400">Creada: {new Date(survey.createdAt).toLocaleString()}</div>
        </div>
        <div>
          {!hideCloseButton && (
            <button onClick={() => onClose ? onClose() : navigate('/profesor/encuestas')} aria-label="Cerrar" title="Cerrar" className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M18 6L6 18" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 6L18 18" stroke="#0f172a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="mt-6">
        {!submitted ? (
          <form onSubmit={async (e) => {
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
            <div className="mb-4">
              <label className="block text-sm text-slate-600 mb-2">Nombre (opcional)</label>
              <input className="p-2 border rounded w-full" value={respondent} onChange={e => setRespondent(e.target.value)} placeholder="Tu nombre (opcional)" />
            </div>

            <div className="space-y-4">
              {survey.questions && survey.questions.length ? (
                survey.questions.map((q: any, idx: number) => (
                  <div key={idx} className="p-3 border rounded">
                    <div className="font-semibold mb-1">Pregunta {idx + 1}</div>
                    <div className="mb-2">{q.text}</div>
                    {q.type === 'multiple' ? (
                      <div className="space-y-2">
                        {(q.options || []).map((opt: string, oi: number) => (
                          <label key={oi} className="flex items-center gap-2">
                            <input type="radio" name={`q_${idx}`} checked={answers[idx] === oi} onChange={() => setSurveyAnswers((a: any) => ({ ...a, [idx]: oi }))} />
                            <span>{opt}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <textarea className="w-full p-2 border rounded" value={answers[idx] || ''} onChange={e => setSurveyAnswers((a: any) => ({ ...a, [idx]: e.target.value }))} />
                    )}
                  </div>
                ))
              ) : (
                <div className="text-slate-600">No hay preguntas en esta encuesta.</div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button type="submit" className="px-4 py-2 bg-primary text-white rounded">Enviar respuestas</button>
              <button type="button" onClick={() => onClose ? onClose() : navigate('/profesor/encuestas')} className="px-4 py-2 bg-gray-200 rounded">Cancelar</button>
            </div>
          </form>
        ) : (
          <div>
            <div className="p-4 bg-green-50 border border-green-200 rounded mb-4">Gracias por responder. Respuestas guardadas.</div>
            <div className="mb-4">
              <strong>Total de respuestas:</strong> {summary?.total ?? 0}
            </div>
            <div className="space-y-4">
              {survey.questions.map((q: any, idx: number) => (
                <div key={idx} className="p-3 border rounded">
                  <div className="font-semibold mb-2">Pregunta {idx + 1}</div>
                  <div className="mb-2">{q.text}</div>
                  {q.type === 'multiple' ? (
                    <div>
                      {(summary?.qsummary?.[idx]?.counts || []).map((c: number, oi: number) => (
                        <div key={oi} className="flex justify-between">
                          <div>{q.options[oi]}</div>
                          <div className="font-semibold">{c}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div>
                      {(summary?.qsummary?.[idx]?.texts || []).slice(-10).reverse().map((t: string, i: number) => (
                        <div key={i} className="p-2 border-b text-sm">{t}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4">
              {/* Single response per user: no 'Responder nuevamente' button */}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
