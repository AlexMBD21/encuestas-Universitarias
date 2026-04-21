import React from 'react'
import ProgressBar from './ProgressBar'

type Props = {
  question: string
  counts: Record<string, number>
  answered: number
  options?: string[]
  texts?: string[]
  questionType?: string
  variant?: 'project' | 'simple'
}

export default function QuestionStatCard({ question, counts, answered, options, texts, questionType, variant = 'simple' }: Props) {
  const isText = questionType === 'text' || ((!options || options.length === 0) && !!texts)
  const entries = Object.entries(counts || {})
  const total = answered || entries.reduce((s, [, c]) => s + (Number(c) || 0), 0)

  const isProject = variant === 'project'
  const primaryColor = isProject ? '#6366f1' : '#10b981' // Indigo-500 : Emerald-500
  const bgClass = isProject ? 'hover:border-indigo-200/60' : 'hover:border-emerald-200/60'
  const badgeClass = isProject ? 'text-indigo-600 bg-indigo-100/50 border-indigo-100' : 'text-emerald-600 bg-emerald-100/50 border-emerald-100'

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border border-slate-200/70 bg-slate-50/50 hover:bg-white hover:shadow-lg hover:shadow-slate-200/40 ${bgClass} transition-all duration-300 overflow-hidden`}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <h4 className="font-bold text-slate-800 text-sm sm:text-base leading-snug flex-1">
          {question}
        </h4>
        <div className={`shrink-0 text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-full border ${badgeClass}`}>
          {total} RESPUESTAS
        </div>
      </div>

      {/* TEXT / COMENTARIO */}
      {isText && (
        <div className="mt-4">
          {(!texts || texts.length === 0) && (
            <div className="text-slate-400 text-sm italic p-4 bg-white rounded-xl border border-dashed border-slate-200 text-center">
              Sin comentarios aún.
            </div>
          )}
          {texts && texts.length > 0 && (
            <div className="space-y-2.5 overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: '220px' }}>
              {texts.map((t, i) => (
                <div key={i} className="px-4 py-3 bg-white border border-slate-100 rounded-xl text-sm text-slate-700 leading-relaxed shadow-sm hover:border-slate-200 transition-colors">
                  <span className="text-xl leading-none text-slate-200 block float-left mr-2 font-serif">&ldquo;</span>
                  {t}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* OPCIÓN MÚLTIPLE */}
      {!isText && (
        <div className="mt-4">
          {entries.length === 0 && (
            <div className="text-slate-400 text-sm italic p-4 bg-white rounded-xl border border-dashed border-slate-200 text-center">
              No hay datos.
            </div>
          )}
          {((options && options.length > 0) || entries.length > 0) && (() => {
            const displayOptions = (options && options.length > 0 ? options.map(opt => [opt, counts[opt] || 0] as [string, number]) : entries)

            // Heuristic for vertical layout: Many short numeric/emoji options
            const isScale = displayOptions.every(([opt]) => {
              const clean = opt.replace(/[0-9\s]/g, '');
              return clean.length <= 2 || !isNaN(parseInt(opt));
            });
            const useVerticalLayout = isScale && displayOptions.length >= 5;
            const isWideScale = displayOptions.length >= 9;

            if (useVerticalLayout) {
              const BAR_AREA_H  = isWideScale ? 140 : 130; // px
              const LABEL_AREA_H = isWideScale ? 40  : 52;  // px
              const PCT_AREA_H  = 18;                        // px
              const TOTAL_H = PCT_AREA_H + BAR_AREA_H + LABEL_AREA_H;

              return (
                <div
                  className="flex items-stretch justify-between gap-0.5 px-1 bg-slate-100/30 rounded-2xl border border-slate-100/50 overflow-hidden"
                  style={{ height: `${TOTAL_H}px` }}
                >
                  {(() => {
                    const maxCnt = Math.max(...displayOptions.map(([, c]) => Number(c) || 0));
                    return displayOptions.map(([opt, cnt]) => {
                      const n = Number(cnt) || 0;
                      const pct = total ? Math.round((n / total) * 100) : 0;
                      const isWinner = n > 0 && n === maxCnt;

                      let itemColor = primaryColor;
                      const numericOpt = parseInt(opt);
                      if (!isNaN(numericOpt) && !opt.includes(' ')) {
                        if (numericOpt <= 6) itemColor = '#f43f5e';
                        else if (numericOpt <= 8) itemColor = '#f59e0b';
                        else itemColor = '#10b981';
                      } else if (opt.includes('🤩') || opt.includes('🙂')) {
                        itemColor = '#10b981';
                      } else if (opt.includes('😐')) {
                        itemColor = '#f59e0b';
                      } else if (opt.includes('🙁') || opt.includes('😡')) {
                        itemColor = '#f43f5e';
                      }

                      return (
                        <div key={opt} className="flex-1 flex flex-col items-center min-w-0">
                          {/* ① Percentage — fixed top area */}
                          <div
                            className={`w-full text-center leading-none flex items-center justify-center ${isWideScale ? 'text-[8px]' : 'text-[9px] sm:text-[10px]'} ${n === 0 ? 'text-slate-300 font-bold' : isWinner ? 'text-blue-600 font-black' : 'text-slate-600 font-bold'}`}
                            style={{ height: `${PCT_AREA_H}px` }}
                          >
                            {pct}%
                          </div>

                          {/* ② Bar — grows to fill middle */}
                          <div className="flex-1 w-full flex items-end justify-center pb-1">
                            <ProgressBar
                              value={pct}
                              orientation="vertical"
                              height={isProject ? 10 : 8}
                              showPercent={false}
                              color={itemColor}
                              className="h-full"
                            />
                          </div>

                          {/* ③ Label — fixed bottom area, in normal flow */}
                          <div
                            className="w-full flex flex-col items-center justify-start pt-1 overflow-hidden"
                            style={{ height: `${LABEL_AREA_H}px` }}
                          >
                            {/* For emoji options: show count then emoji-word labels */}
                            {opt.includes('🤩') || opt.includes('🙂') || opt.includes('😐') || opt.includes('🙁') || opt.includes('😡') ? (
                              <>
                                <span className={`leading-none mb-0.5 text-[17px] sm:text-[19px] ${n > 0 ? 'opacity-100' : 'opacity-35'}`}>
                                  {opt.split(' ').pop()}
                                </span>
                                {opt.includes('🤩') && <span className="text-[8px] font-bold text-emerald-600 leading-tight">Excelente</span>}
                                {opt.includes('🙂') && <span className="text-[8px] font-bold text-emerald-500 leading-tight">Bueno</span>}
                                {opt.includes('😐') && <span className="text-[8px] font-bold text-amber-500 leading-tight">Regular</span>}
                                {opt.includes('🙁') && <span className="text-[8px] font-bold text-rose-400 leading-tight">Malo</span>}
                                {opt.includes('😡') && <span className="text-[8px] font-bold text-rose-600 leading-tight">Pésimo</span>}
                                <span className={`font-black text-slate-500 leading-none ${isWideScale ? 'text-[7px]' : 'text-[8px]'}`}>
                                  {n} val.
                                </span>
                              </>
                            ) : (
                              /* For numeric options (NPS 0-10): scale number big on top, count small below */
                              <>
                                <span className={`leading-none font-bold ${isWideScale ? 'text-[12px]' : 'text-[16px] sm:text-[18px]'} ${n > 0 ? 'text-slate-700 opacity-100' : 'text-slate-400 opacity-50'}`}>
                                  {opt.split(' ').pop()}
                                </span>
                                <span className="text-[6px] font-bold text-slate-400 leading-none mt-0.5 uppercase tracking-wide">
                                  val.
                                </span>
                                <span className={`font-black leading-none ${isWideScale ? 'text-[8px]' : 'text-[9px]'} ${n > 0 ? 'text-slate-600' : 'text-slate-400'}`}>
                                  {n}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  })()}
                </div>
              );
            }

            return (
              <div className="space-y-3.5">
                {(() => {
                  const maxCnt = Math.max(...displayOptions.map(([, c]) => Number(c) || 0));
                  return displayOptions.map(([opt, cnt]) => {
                    const n = Number(cnt) || 0
                    const pct = total ? Math.round((n / total) * 100) : 0
                    const isWinner = n > 0 && n === maxCnt;

                    const labelClass = n === 0
                      ? 'text-sm text-slate-400/60 truncate mb-1.5'
                      : isWinner
                        ? 'text-sm font-black text-blue-600 truncate mb-1.5'
                        : 'text-sm font-semibold text-slate-600 truncate mb-1.5'
                    const countClass = n === 0
                      ? 'text-xs font-medium text-slate-400/60 shrink-0 w-10 text-right'
                      : isWinner
                        ? 'text-xs font-black text-blue-600 shrink-0 w-10 text-right'
                        : 'text-xs font-bold text-slate-500 shrink-0 w-10 text-right'

                    // Dynamic color
                    let itemColor = primaryColor;
                    const numericOpt = parseInt(opt);
                    if (!isNaN(numericOpt) && !opt.includes(' ')) {
                      if (numericOpt <= 6) itemColor = '#f43f5e';
                      else if (numericOpt <= 8) itemColor = '#f59e0b';
                      else itemColor = '#10b981';
                    } else if (opt.includes('🤩') || opt.includes('🙂')) {
                      itemColor = '#10b981';
                    } else if (opt.includes('😐')) {
                      itemColor = '#f59e0b';
                    } else if (opt.includes('🙁') || opt.includes('😡')) {
                      itemColor = '#f43f5e';
                    }

                    return (
                      <div key={opt} className="group">
                        <div className="flex items-center justify-between">
                          <div className={labelClass} title={opt}>{opt}</div>
                          <div className={countClass}>{pct}%</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <ProgressBar value={pct} height={8} showPercent={false} color={itemColor} />
                          </div>
                          <div className="shrink-0 text-[10px] font-medium text-slate-400 w-10 text-right tabular-nums">
                            {n} val.
                          </div>
                        </div>
                      </div>
                    )
                  })
                })()}
                {options && options.length > 0 && entries.length > 0 && (() => {
                  const extra = entries.filter(([k]) => !options.includes(k))
                  return extra.length ? extra.map(([opt, cnt]) => {
                    const n = Number(cnt) || 0
                    const pct = total ? Math.round((n / total) * 100) : 0
                    const labelClass = n === 0 ? 'text-sm text-slate-400 truncate mb-1.5' : 'text-sm font-medium text-slate-700 truncate mb-1.5'
                    const countClass = n === 0 ? 'text-xs font-medium text-slate-400 shrink-0 w-10 text-right' : 'text-xs font-bold text-slate-600 shrink-0 w-10 text-right'
                    return (
                      <div key={opt} className="group mt-3 pt-3 border-t border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className={labelClass} title={opt}>{opt} <span className="text-[9px] bg-slate-100 text-slate-500 rounded px-1 py-0.5 ml-1">Extra</span></div>
                          <div className={countClass}>{pct}%</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <ProgressBar value={pct} height={8} showPercent={false} color="#94a3b8" />
                          </div>
                          <div className="shrink-0 text-[10px] font-medium text-slate-400 w-10 text-right tabular-nums">
                            {n} val.
                          </div>
                        </div>
                      </div>
                    )
                  }) : null
                })()}
              </div>
            );
          })()}
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #cbd5e1;
          border-radius: 10px;
        }
      `}</style>
    </div>
  )
}
