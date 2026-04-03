import React from 'react'
import ProgressBar from './ProgressBar'

type Props = {
  question: string
  counts: Record<string, number>
  answered: number
  options?: string[]
  texts?: string[]
  questionType?: string
}

export default function QuestionStatCard({ question, counts, answered, options, texts, questionType }: Props) {
  const isText = questionType === 'text' || ((!options || options.length === 0) && !!texts)
  const entries = Object.entries(counts || {})
  const total = answered || entries.reduce((s, [,c]) => s + (Number(c) || 0), 0)

  return (
    <div className="p-3 border rounded bg-white shadow-sm">
      <div className="font-medium mb-1">{question}</div>
      <div className="text-sm text-slate-600 mb-2">Respondieron: {total}</div>

      {/* TEXT / COMENTARIO */}
      {isText && (
        <>
          {(!texts || texts.length === 0) && (
            <div className="text-slate-400 text-sm italic">Sin comentarios aún.</div>
          )}
          {texts && texts.length > 0 && (
            <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: '220px' }}>
              {texts.map((t, i) => (
                <div key={i} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded text-sm text-slate-700 leading-snug">
                  {t}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* OPCIÓN MÚLTIPLE */}
      {!isText && (
        <>
          {entries.length === 0 && <div className="text-slate-500">No hay datos.</div>}
          {((options && options.length > 0) || entries.length > 0) && (
            <div>
              <div className="space-y-3">
                {(options && options.length > 0 ? options.map(opt => [opt, counts[opt] || 0] as [string, number]) : entries).map(([opt, cnt]) => {
                  const n = Number(cnt) || 0
                  const pct = total ? Math.round((n / total) * 100) : 0
                  const labelClass = n === 0 ? 'flex-1 min-w-0 text-sm text-slate-400 italic' : 'flex-1 min-w-0 text-sm text-slate-700'
                  const countClass = n === 0 ? 'w-12 shrink-0 text-right text-sm text-slate-400' : 'w-12 shrink-0 text-right text-sm text-slate-600'
                  return (
                    <div key={opt} className="flex items-center gap-2">
                      <div className={labelClass}>{opt}</div>
                      <div style={{ flex: 2, minWidth: 0 }}>
                        <ProgressBar value={pct} height={14} showPercent={false} />
                      </div>
                      <div className={countClass}>{n}</div>
                    </div>
                  )
                })}
                {options && options.length > 0 && entries.length > 0 && (() => {
                  const extra = entries.filter(([k]) => !options.includes(k))
                  return extra.length ? extra.map(([opt, cnt]) => {
                    const n = Number(cnt) || 0
                    const pct = total ? Math.round((n / total) * 100) : 0
                    const labelClass = n === 0 ? 'flex-1 min-w-0 text-sm text-slate-400 italic' : 'flex-1 min-w-0 text-sm text-slate-700'
                    const countClass = n === 0 ? 'w-12 shrink-0 text-right text-sm text-slate-400' : 'w-12 shrink-0 text-right text-sm text-slate-600'
                    return (
                      <div key={opt} className="flex items-center gap-2">
                        <div className={labelClass}>{opt}</div>
                        <div style={{ flex: 2, minWidth: 0 }}>
                          <ProgressBar value={pct} height={14} showPercent={false} />
                        </div>
                        <div className={countClass}>{n}</div>
                      </div>
                    )
                  }) : null
                })()}
              </div>
              <div className="mt-3 text-xs text-slate-500">
                <strong>Nota:</strong> los porcentajes están calculados sobre las respuestas recibidas para esta pregunta.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
